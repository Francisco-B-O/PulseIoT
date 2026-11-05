# ML Platform

## Overview

The ML Platform (`iot-ml-platform/`) is a Python 3.11 service exposing a FastAPI REST API on port 8000. It consumes enriched telemetry from Kafka, runs multi-model anomaly detection, and publishes predictions back to Kafka.

## Multi-Model Ensemble

Three models vote on each event. Their votes are weighted and summed:

| Model | Weight | Detects |
|-------|--------|---------|
| Isolation Forest | 2 | Global statistical outliers (trained on historical data) |
| Z-score | 1 | Sensor readings deviating more than N std devs from rolling mean |
| Trend | 1 | Increasing temperature trend with high variance |

**Anomaly threshold**: total votes >= 2 (out of max 4).

### Severity

| Votes | Severity |
|-------|----------|
| 0 | NORMAL |
| 1 | LOW |
| 2–3 | HIGH |
| 4 | CRITICAL |

## Models

### Isolation Forest (`ml/models/isolation_forest_model.py`)

- Trained on Parquet files in `data/`
- Features: `temperature`, `humidity`, `vibration` (raw + rolling stats if `sparkFeatures` present)
- Score < threshold → anomaly (default threshold: -0.05)
- Retrained via `POST /train` or auto-retrain schedule

### Z-score (`ml/models/zscore_model.py`)

- Uses `sparkFeatures.temp_mean`, `temp_std`, `hum_mean`, `hum_std`, `vib_mean`, `vib_std`
- Default threshold: 3 standard deviations
- Reports per-sensor z-scores in result dict

### Trend (`ml/models/trend_model.py`)

- Requires `sparkFeatures.trend == "increasing"`
- AND `temp_std > std_threshold` (default 5.0)
- AND `temp_range > range_threshold` (default 10.0)
- All three conditions must hold for anomaly flag

## Ensemble Decision (`ml/ensemble.py`)

```python
votes = (2 * isolation_forest_anomaly) + (1 * zscore_anomaly) + (1 * trend_anomaly)
is_anomaly = votes >= 2
```

Output dict includes `reason` (human-readable explanation) and `features` breakdown for explainability.

## Prediction Output Format

```json
{
  "is_anomaly": true,
  "anomaly_score": -0.12,
  "prediction": "ANOMALY",
  "threshold": -0.05,
  "severity": "HIGH",
  "scores": {
    "isolation": -0.12,
    "zscore": 3.8,
    "trend": false
  },
  "reason": "Isolation Forest score -0.120 below threshold; Z-score anomaly (max z=3.80)"
}
```

`is_anomaly` and `anomaly_score` are kept for backward compatibility with existing Kafka consumers.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health + model status |
| POST | `/predict` | Single-event prediction |
| POST | `/predict/batch` | Batch predictions |
| GET | `/stats` | Data lake summary (total events, device list, latest timestamp) — cached 60 s |
| GET | `/anomaly-stats` | Aggregated stats from in-memory history (last 500) |
| GET | `/autotrain` | Current auto-retrain schedule |
| POST | `/autotrain` | Set `enabled` (bool) + `interval_hours` (float) |
| POST | `/train` | Trigger immediate model retraining |

## Kafka Integration

- **Consumes**: `device-data-enriched` (produced by Spark Streaming Service)
- **Publishes**: `ml-predictions` (all events), `ml-anomalies` (anomalous events only)
- Consumer retries on startup: 30 attempts with 2-second backoff

## Spark Features

When present, `sparkFeatures` in the event payload provides rolling window statistics:

```json
{
  "sparkFeatures": {
    "temp_mean": 45.2, "temp_std": 8.1, "temp_min": 30.0, "temp_max": 72.0,
    "temp_range": 42.0, "hum_mean": 60.3, "hum_std": 5.2,
    "vib_mean": 0.8, "vib_std": 0.3, "event_count": 20, "trend": "increasing"
  }
}
```

Models gracefully fall back to raw sensor values when `sparkFeatures` is absent.

## Auto-Retrain

A daemon thread checks every 60 seconds whether `enabled=true` and `interval_hours` have elapsed since last training. Configure via `POST /autotrain`. Prediction history (in-memory `deque(maxlen=500)`) resets on service restart.
