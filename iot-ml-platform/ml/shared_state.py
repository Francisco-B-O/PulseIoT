"""
Shared in-memory state for ML predictions, accessible by both the Kafka consumer
thread and the FastAPI request handlers.
"""
import json
import logging
import os
import tempfile
import threading
from collections import deque

# Prediction history (last 500 entries) populated by the Kafka consumer
prediction_history: deque = deque(maxlen=500)
history_lock = threading.Lock()

# Auto-retrain configuration
autotrain_config: dict = {"enabled": False, "interval_hours": 6.0}
autotrain_lock = threading.Lock()

# Last train time (epoch seconds)
last_train_time: float | None = None


# ---------------------------------------------------------------------------
# Persistence: prediction history, auto-retrain config and last train time are
# snapshotted to a JSON file so they survive a container restart.
# ---------------------------------------------------------------------------
_logger = logging.getLogger(__name__)
STATE_PATH = os.getenv(
    "ML_STATE_PATH",
    os.path.join(os.getenv("MODEL_STORAGE_PATH", "ml/models"), "state.json"),
)


def save_state(path: str | None = None) -> bool:
    """Atomically write the current state to disk. Returns True on success."""
    path = path or STATE_PATH
    try:
        with history_lock:
            history = list(prediction_history)
        with autotrain_lock:
            config = dict(autotrain_config)
        payload = {"prediction_history": history, "autotrain_config": config, "last_train_time": last_train_time}
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)), suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, default=str)
        os.replace(tmp, path)
        return True
    except Exception as exc:  # never let persistence break inference
        _logger.warning("Could not persist ML state: %s", exc)
        return False


def load_state(path: str | None = None) -> bool:
    """Restore state written by :func:`save_state`. Returns True if something was loaded."""
    global last_train_time
    path = path or STATE_PATH
    try:
        with open(path, encoding="utf-8") as fh:
            payload = json.load(fh)
    except FileNotFoundError:
        return False
    except Exception as exc:
        _logger.warning("Ignoring unreadable ML state file %s: %s", path, exc)
        return False
    with history_lock:
        prediction_history.clear()
        prediction_history.extend(payload.get("prediction_history", []))
    with autotrain_lock:
        autotrain_config.update(payload.get("autotrain_config", {}))
    last_train_time = payload.get("last_train_time")
    _logger.info("Restored ML state: %d predictions", len(prediction_history))
    return True
