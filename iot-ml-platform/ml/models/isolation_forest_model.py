"""
Isolation Forest wrapper for use in the ensemble predictor.

Implements the same windowed-inference logic that was previously embedded
in predict.py (historical context from the data lake so that rolling
features are computed over a real time sequence rather than a degenerate
single-row window).
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

import joblib
import pandas as pd

from config.settings import settings
from processing.data_processor import data_processor

logger = logging.getLogger(__name__)

INFERENCE_WINDOW_SIZE = 5
_SAFE_VERSION_RE = re.compile(r'^[A-Za-z0-9_\-]+$')
_BASE_COLS = {"deviceId", "timestamp"}


def _keep_ml_cols(df: pd.DataFrame) -> pd.DataFrame:
    keep = [c for c in df.columns if c in _BASE_COLS or c.startswith("enrichedData.")]
    return df[keep]


class IsolationForestModel:
    """
    Versioned Isolation Forest model with windowed inference.

    Result dict
    -----------
    {
        "is_anomaly": bool,
        "score":      float   # raw decision_function value
    }
    """

    def __init__(self, model_path: str | None = None) -> None:
        self.model_path       = model_path or settings.MODEL_STORAGE_PATH
        self.latest_info_file = os.path.join(self.model_path, "latest_model.json")
        self.model            = None
        self.feature_names: list[str] | None = None
        self.current_version: str | None     = None
        self.threshold: float                = settings.ANOMALY_THRESHOLD
        self.load()

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------

    def load(self) -> None:
        try:
            if not os.path.exists(self.latest_info_file):
                logger.warning("No latest_model.json — Isolation Forest unavailable.")
                return

            with open(self.latest_info_file) as f:
                info = json.load(f)

            version = str(info["latest_version"])
            if not _SAFE_VERSION_RE.match(version):
                logger.warning("Skipping model load: unsafe version string in latest_model.json")
                return

            version_dir = os.path.join(self.model_path, version)
            model_file  = os.path.join(version_dir, "anomaly_detector.joblib")
            feat_file   = os.path.join(version_dir, "feature_names.joblib")

            if os.path.exists(model_file) and os.path.exists(feat_file):
                self.model           = joblib.load(model_file)
                self.feature_names   = joblib.load(feat_file)
                self.current_version = version
                self.threshold       = info.get("metrics", {}).get("threshold", self.threshold)
                logger.info(
                    "IsolationForestModel loaded version=%s threshold=%.4f",
                    self.current_version, self.threshold,
                )
        except Exception as exc:
            logger.error("Failed to load Isolation Forest: %s", exc, exc_info=True)
            self.model = None

    # ------------------------------------------------------------------
    # Windowed inference helpers
    # ------------------------------------------------------------------

    def _build_window(self, event: dict[str, Any]) -> pd.DataFrame:
        device_id  = event.get("deviceId", "")
        current_df = _keep_ml_cols(pd.json_normalize(event))

        if not device_id:
            return current_df

        from storage.data_lake import data_lake  # avoid circular import at module load

        historical = data_lake.get_recent_events_for_device(
            device_id, limit=INFERENCE_WINDOW_SIZE - 1
        )
        if historical.empty:
            return current_df

        return pd.concat([_keep_ml_cols(historical), current_df], ignore_index=True)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def predict(self, event: dict[str, Any]) -> dict[str, Any]:
        if self.model is None or self.feature_names is None:
            self.load()
            if self.model is None:
                return {"is_anomaly": False, "score": 0.0}

        try:
            window_df = self._build_window(event)
            processed = data_processor.prepare_for_ml(window_df)

            if processed.empty:
                return {"is_anomaly": False, "score": 0.0}

            last_row    = processed.iloc[-1]
            features_df = pd.DataFrame(columns=self.feature_names)
            for feat in self.feature_names:
                features_df.at[0, feat] = last_row[feat] if feat in last_row.index else 0.0
            features_df = features_df.astype(float)

            score      = float(self.model.decision_function(features_df)[0])
            is_anomaly = bool(score < self.threshold)
            return {"is_anomaly": is_anomaly, "score": round(score, 4)}

        except Exception as exc:
            logger.error("IsolationForestModel.predict error: %s", exc, exc_info=True)
            return {"is_anomaly": False, "score": 0.0}
