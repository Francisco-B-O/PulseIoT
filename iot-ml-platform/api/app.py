"""
FastAPI application for the IoT ML Platform.
Provides endpoints for health checks, anomaly prediction, model training,
anomaly statistics, and auto-retraining configuration.
"""

import logging
import os
import threading
import time
from typing import Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from api.auth import require_admin, require_user
from ml.predict import predictor
from ml.train_model import ModelTrainer
from ml import shared_state
from storage.data_lake import data_lake
from config.settings import settings
from ingestion.kafka_consumer import KafkaIngestor

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="IoT ML Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:4200").split(",")],
    allow_credentials=False,  # auth is a bearer header, not cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prediction history and autotrain state live in ml.shared_state so the
# Kafka consumer thread and the FastAPI handlers share the same objects.


shared_state.load_state()


def _state_saver_loop():
    """Snapshot prediction history / autotrain config every 30 s (only when it changed)."""
    last = None
    while True:
        time.sleep(30)
        with shared_state.history_lock:
            marker = (len(shared_state.prediction_history), shared_state.last_train_time,
                      tuple(sorted(shared_state.autotrain_config.items())))
        if marker != last and shared_state.save_state():
            last = marker


threading.Thread(target=_state_saver_loop, daemon=True).start()

# Serialises manual and automatic training so they never write the model dir concurrently.
_train_lock = threading.Lock()


def _autotrain_loop():
    """Background thread that triggers model retraining on a configurable schedule."""
    while True:
        time.sleep(60)  # check every minute
        with shared_state.autotrain_lock:
            enabled = shared_state.autotrain_config["enabled"]
            interval_seconds = shared_state.autotrain_config["interval_hours"] * 3600

        if not enabled:
            continue

        now = time.time()
        if shared_state.last_train_time is None or (now - shared_state.last_train_time) >= interval_seconds:
            if not _train_lock.acquire(blocking=False):
                continue  # a manual training run is already in progress
            try:
                logger.info("Auto-retrain triggered.")
                trainer = ModelTrainer()
                model = trainer.train_anomaly_model()
                if model:
                    predictor.load_model()
                    shared_state.last_train_time = time.time()
                    logger.info("Auto-retrain completed. New threshold: %.4f", predictor.threshold)
            except Exception as e:
                logger.error("Auto-retrain failed: %s", e, exc_info=True)
            finally:
                _train_lock.release()


_autotrain_thread = threading.Thread(target=_autotrain_loop, daemon=True)
_autotrain_thread.start()

# Start Kafka consumer in the same process so it shares shared_state memory
def _run_consumer():
    # Restart with backoff so a transient Kafka failure does not silently kill ingestion.
    backoff = 5
    while True:
        try:
            ingestor = KafkaIngestor()
            ingestor.consume_events()
            backoff = 5
        except Exception as e:
            logger.error("Kafka consumer crashed, restarting in %ss: %s", backoff, e, exc_info=True)
        time.sleep(backoff)
        backoff = min(backoff * 2, 60)

_consumer_thread = threading.Thread(target=_run_consumer, daemon=True)
_consumer_thread.start()


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class PredictionRequest(BaseModel):
    device_id: str = Field(..., alias="deviceId")
    timestamp: str
    enriched_data: dict[str, Any] = Field(..., alias="enrichedData")

    class Config:
        populate_by_name = True


class BatchPredictionRequest(BaseModel):
    device_id: str = Field(..., alias="deviceId")
    events: list[dict[str, Any]]

    class Config:
        populate_by_name = True


class PredictionResponse(BaseModel):
    is_anomaly: bool
    anomaly_score: float
    prediction: str
    threshold: float
    # Ensemble fields
    severity: str = "NORMAL"
    scores: dict[str, Any] = Field(default_factory=dict)
    reason: str = ""


class BatchPredictionResponse(BaseModel):
    device_id: str
    results: list[PredictionResponse]


class AutoTrainRequest(BaseModel):
    enabled: bool
    interval_hours: float = 6.0


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check() -> dict[str, Any]:
    return {
        "status": "healthy",
        "model_version": predictor.current_version,
        "threshold": predictor.threshold,
    }


@app.post("/predict", response_model=PredictionResponse, dependencies=[Depends(require_user)])
def predict(request: PredictionRequest) -> dict[str, Any]:
    """Score a single telemetry event for anomaly and record the result."""
    try:
        event_data = request.model_dump(by_alias=True)
        prediction = predictor.predict_anomaly(event_data)

        is_anomaly = prediction["is_anomaly"]
        score      = prediction["anomaly_score"]

        # Store in shared prediction history
        with shared_state.history_lock:
            shared_state.prediction_history.append({
                "device_id":  request.device_id,
                "timestamp":  request.timestamp,
                "is_anomaly": is_anomaly,
                "score":      round(score, 4),
                "severity":   prediction.get("severity", "NORMAL"),
                "reason":     prediction.get("reason",   ""),
            })

        logger.info(
            "Prediction for %s: is_anomaly=%s score=%.4f severity=%s",
            request.device_id, is_anomaly, score, prediction.get("severity"),
        )
        return {
            "is_anomaly":   is_anomaly,
            "anomaly_score": score,
            "prediction":   "ANOMALY" if is_anomaly else "NORMAL",
            "threshold":    predictor.threshold,
            "severity":     prediction.get("severity", "NORMAL"),
            "scores":       prediction.get("scores",   {}),
            "reason":       prediction.get("reason",   ""),
        }
    except Exception as e:
        logger.error("Error during prediction: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during prediction.") from e


@app.post("/predict/batch", response_model=BatchPredictionResponse, dependencies=[Depends(require_user)])
def predict_batch(request: BatchPredictionRequest) -> dict[str, Any]:
    """Score a time-ordered sequence of events for a single device."""
    try:
        if not request.events:
            raise HTTPException(status_code=400, detail="events list cannot be empty.")

        events = [
            {**e, "deviceId": request.device_id}
            if "deviceId" not in e else e
            for e in request.events
        ]

        results_raw = predictor.predict_window(events)
        results = [
            {
                "is_anomaly":    pred["is_anomaly"],
                "anomaly_score": pred["anomaly_score"],
                "prediction":    "ANOMALY" if pred["is_anomaly"] else "NORMAL",
                "threshold":     predictor.threshold,
                "severity":      pred.get("severity", "NORMAL"),
                "scores":        pred.get("scores",   {}),
                "reason":        pred.get("reason",   ""),
            }
            for pred in results_raw
        ]

        # Store batch results in shared history
        with shared_state.history_lock:
            for event, pred in zip(request.events, results_raw, strict=False):
                shared_state.prediction_history.append({
                    "device_id":  request.device_id,
                    "timestamp":  event.get("timestamp", ""),
                    "is_anomaly": pred["is_anomaly"],
                    "score":      round(pred["anomaly_score"], 4),
                    "severity":   pred.get("severity", "NORMAL"),
                    "reason":     pred.get("reason",   ""),
                })

        logger.info(
            "Batch prediction for %s: %d events, %d anomalies detected.",
            request.device_id, len(results),
            sum(1 for r in results if r["is_anomaly"]),
        )
        return {"device_id": request.device_id, "results": results}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error during batch prediction: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during batch prediction.") from e


_stats_cache: dict[str, Any] = {}
_stats_cache_time: float = 0.0
_STATS_CACHE_TTL = 60.0  # seconds

@app.get("/stats")
def get_stats() -> dict[str, Any]:
    """Data lake summary statistics (cached for 60 s to avoid full lake scan on every call)."""
    global _stats_cache, _stats_cache_time
    now = time.time()
    if _stats_cache and (now - _stats_cache_time) < _STATS_CACHE_TTL:
        return _stats_cache
    try:
        df = data_lake.get_latest_data(limit=1000)
        if df.empty:
            result = {"total_events": 0, "devices": [], "latest_timestamp": None}
        else:
            result = {
                "total_events": len(df),
                "devices": df['deviceId'].unique().tolist() if 'deviceId' in df.columns else [],
                "latest_timestamp": str(df['timestamp'].max()) if 'timestamp' in df.columns else None,
            }
        _stats_cache = result
        _stats_cache_time = now
        return result
    except Exception as e:
        logger.error("Error fetching stats: %s", e, exc_info=True)
        return {"error": "Could not retrieve statistics", "total_events": 0, "devices": []}


@app.post("/train", dependencies=[Depends(require_admin)])
def train_model() -> dict[str, Any]:
    """Trigger a manual model retraining."""
    if not _train_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Training already in progress.")
    try:
        logger.info("Starting manual model retraining.")
        trainer = ModelTrainer()
        model = trainer.train_anomaly_model()
        if model:
            predictor.load_model()
            shared_state.last_train_time = time.time()
            logger.info(
                f"Model retrained and reloaded. New threshold: {predictor.threshold:.4f}"
            )
            return {
                "status": "success",
                "message": "Model retrained successfully.",
                "threshold": predictor.threshold,
                "model_version": predictor.current_version,
            }
        raise HTTPException(status_code=500, detail="Training returned no model. Check logs.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error during model training: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error during training: {e!s}") from e
    finally:
        _train_lock.release()


@app.get("/anomaly-stats")
def get_anomaly_stats() -> dict[str, Any]:
    """
    Returns aggregated statistics from the in-memory prediction history.
    Includes total predictions, anomaly count, anomaly rate, breakdown by device,
    and the 10 most recent anomalies.
    """
    with shared_state.history_lock:
        history = list(shared_state.prediction_history)

    if not history:
        return {
            "total_predictions": 0,
            "anomaly_count": 0,
            "anomaly_rate": 0.0,
            "anomalies_by_device": {},
            "recent_anomalies": [],
        }

    anomalies = [p for p in history if p["is_anomaly"]]

    by_device: dict[str, int] = {}
    for p in anomalies:
        did = p["device_id"]
        by_device[did] = by_device.get(did, 0) + 1

    recent_anomalies = [p for p in reversed(history) if p["is_anomaly"]][:10]

    return {
        "total_predictions": len(history),
        "anomaly_count": len(anomalies),
        "anomaly_rate": round(len(anomalies) / len(history) * 100, 1),
        "anomalies_by_device": by_device,
        "recent_anomalies": recent_anomalies,
    }


@app.get("/autotrain")
def get_autotrain() -> dict[str, Any]:
    """Returns the current auto-retrain configuration and last train timestamp."""
    with shared_state.autotrain_lock:
        config = dict(shared_state.autotrain_config)
    config["last_train_time"] = shared_state.last_train_time
    return config


@app.post("/autotrain", dependencies=[Depends(require_admin)])
def set_autotrain(req: AutoTrainRequest) -> dict[str, Any]:
    """Updates the auto-retrain schedule configuration."""
    with shared_state.autotrain_lock:
        shared_state.autotrain_config["enabled"] = req.enabled
        shared_state.autotrain_config["interval_hours"] = req.interval_hours
    logger.info("Auto-retrain config updated: enabled=%s, interval=%sh", req.enabled, req.interval_hours)
    return {"status": "ok", "config": dict(shared_state.autotrain_config)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)
