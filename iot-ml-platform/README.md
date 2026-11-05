# Python ML Platform

The Python side of the IoT platform. It consumes Kafka events from the Spring microservices, runs anomaly detection with a trained Isolation Forest model, and stores everything in a local Parquet data lake.

## What's here

```
iot-ml-platform/
├── api/          # FastAPI server (port 8000) — prediction and training endpoints
├── ingestion/    # Kafka consumer — reads device-data-processed, runs ML per event
├── ml/           # Isolation Forest model: training, prediction, versioning
├── processing/   # Feature engineering — rolling stats, deltas per device
├── storage/      # Data lake — Parquet files partitioned by day
├── config/       # Settings (env vars with defaults)
└── data/         # raw/ and processed/ parquet data
```

## Running locally

Requires Kafka running (use the main `docker compose up` or point `KAFKA_BOOTSTRAP_SERVERS` at a local broker).

```bash
pip install -r requirements.txt
export PYTHONPATH=$PYTHONPATH:.

# Start Kafka consumer (ML pipeline)
python ingestion/kafka_consumer.py

# Start API
python api/app.py

# Train or retrain model
python ml/train_model.py
```

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check, model version, current threshold |
| POST | `/predict` | Score a single event (fetches data lake context internally) |
| POST | `/predict/batch` | Score a time-ordered sequence of events for one device |
| POST | `/train` | Retrain model on data lake history |
| GET | `/stats` | Data lake summary |

Full docs at `http://localhost:8000/docs` when running.

## Model details

**Algorithm:** Isolation Forest (`n_estimators=100`, `contamination='auto'`, `random_state=42`)

**Training data:** Historical events from the Parquet data lake (up to 10,000 records)

**Features:** Raw sensor values (`temperature`, `humidity`, `vibration`) plus per-device rolling stats over 5-event windows: mean, std, min, max, delta. 24 features total.

**Threshold:** Computed from the training score distribution (5th percentile of `decision_function` scores on training data). Stored in `latest_model.json` and reloaded with the model — no hardcoded constant. Current value: approximately **-0.036**.

**Model versioning:** Each training run saves to `ml/models/YYYYMMDD_HHMMSS/` and updates `latest_model.json`. A registry file tracks all versions.

### Windowed inference

Rolling features require a temporal sequence to be meaningful. Before scoring, `predict_anomaly` fetches the last 4 events for the device from the data lake and prepends them to the current event. This gives `prepare_for_ml` a proper 5-event window, producing non-degenerate rolling stats that match the training distribution.

This is transparent to callers: the `/predict` endpoint takes a single event and returns a correct prediction. Use `/predict/batch` to supply the temporal context explicitly (useful when the data lake is empty or for testing).

## Kafka integration

- **Consumes:** `device-data-processed`
- **Produces:** `ml-predictions` (every event), `ml-anomalies` (anomalous events only)
- **Group ID:** `iot-ml-platform-group`
- Retry logic: 30 attempts with 2-second backoff on subscription failures
