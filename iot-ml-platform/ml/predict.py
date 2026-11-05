"""
Ensemble anomaly predictor for the IoT ML Platform.

Combines three complementary models via weighted majority voting:

    Model               Weight   Strength
    ─────────────────── ──────   ────────────────────────────────────────
    Isolation Forest      2      Learns the normal distribution from history
    Z-score               1      Detects statistical outliers per sensor
    Trend                 1      Detects escalating / runaway conditions

An anomaly is declared when weighted votes ≥ 2.

Public interface
----------------
    predictor.predict_anomaly(event) -> dict
    predictor.predict_window(events) -> list[dict]
    predictor.load_model()           (reload after retraining)

Each result dict contains:
    anomaly      bool     final ensemble decision
    severity     str      NORMAL | LOW | HIGH | CRITICAL
    scores       dict     per-model raw outputs
    reason       str      human-readable explanation
    features     dict     per-feature breakdown (explainability)
    is_anomaly   bool     alias for `anomaly`   (backward compat)
    anomaly_score float   IF decision_function  (backward compat)
"""
from __future__ import annotations

import logging
from typing import Any

from ml.models.isolation_forest_model import IsolationForestModel
from ml.models.zscore_model import ZScoreModel
from ml.models.trend_model import TrendModel
from ml.ensemble import EnsembleDecision

logger = logging.getLogger(__name__)


class EnsemblePredictor:
    """Multi-model anomaly predictor with weighted voting."""

    def __init__(self) -> None:
        self.if_model = IsolationForestModel()
        self.zs_model = ZScoreModel()
        self.tr_model = TrendModel()
        self.ensemble = EnsembleDecision()

        # Expose for backward compatibility (app.py / shared_state consumers)
        self.current_version = self.if_model.current_version
        self.threshold       = self.if_model.threshold

    def load_model(self) -> None:
        """Reload the Isolation Forest model from disk (called after retraining)."""
        self.if_model.load()
        self.current_version = self.if_model.current_version
        self.threshold       = self.if_model.threshold

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def predict_anomaly(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """
        Predict anomaly for a single telemetry event.

        Returns a result dict with ensemble decision and backward-compat aliases
        ``is_anomaly`` and ``anomaly_score``.
        """
        if_result = self.if_model.predict(event_data)
        zs_result = self.zs_model.predict(event_data)
        tr_result = self.tr_model.predict(event_data)

        result = self.ensemble.decide(if_result, zs_result, tr_result)

        # Backward-compat aliases consumed by kafka_consumer and kafka_producer
        result["is_anomaly"]    = result["anomaly"]
        result["anomaly_score"] = result["scores"]["isolation"]

        return result

    def predict_window(self, events: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Predict anomaly for each event in a time-ordered sequence.
        Each event is scored independently; historical context for the
        Isolation Forest model is fetched from the data lake per-event.
        """
        return [self.predict_anomaly(e) for e in events]


predictor = EnsemblePredictor()
