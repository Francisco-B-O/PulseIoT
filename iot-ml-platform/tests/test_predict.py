"""
Unit tests for EnsemblePredictor (ml/predict.py).

All three sub-models are patched so these tests exercise only the wiring
and result-merging logic in EnsemblePredictor, not model internals.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Minimal result builders
# ---------------------------------------------------------------------------

def _if_result(is_anomaly: bool = False, score: float = 0.1) -> dict:
    return {"is_anomaly": is_anomaly, "score": score}


def _zs_result(is_anomaly: bool = False, max_zscore: float = 0.5) -> dict:
    return {
        "is_anomaly": is_anomaly,
        "max_zscore": max_zscore,
        "scores": {"temperature": max_zscore, "humidity": 0.0, "vibration": 0.0},
    }


def _tr_result(is_anomaly: bool = False, trend: str = "stable") -> dict:
    return {
        "is_anomaly": is_anomaly,
        "trend": trend,
        "temp_std": 2.0,
        "temp_range": 5.0,
    }


def _ensemble_result(
    anomaly: bool,
    severity: str,
    isolation_score: float = 0.1,
    zscore: float = 0.5,
    trend_anomaly: bool = False,
    reason: str = "All models nominal",
) -> dict:
    """Mimics the dict returned by EnsembleDecision.decide()."""
    return {
        "anomaly":  anomaly,
        "severity": severity,
        "scores": {
            "isolation": isolation_score,
            "zscore":    zscore,
            "trend":     trend_anomaly,
        },
        "reason": reason,
        "features": {
            "isolation_score": isolation_score,
            "zscore_breakdown": {},
            "trend_info": {"trend": "stable", "temp_std": 2.0, "temp_range": 5.0},
        },
    }


# ---------------------------------------------------------------------------
# Fixture: patched EnsemblePredictor
# ---------------------------------------------------------------------------

def _make_predictor(
    if_result: dict | None = None,
    zs_result: dict | None = None,
    tr_result: dict | None = None,
    ensemble_result: dict | None = None,
):
    """
    Create an EnsemblePredictor with all sub-models replaced by MagicMocks
    whose predict() / decide() return the supplied dicts.
    """
    if_result       = if_result       or _if_result()
    zs_result       = zs_result       or _zs_result()
    tr_result       = tr_result       or _tr_result()
    ensemble_result = ensemble_result or _ensemble_result(False, "NORMAL")

    mock_if = MagicMock()
    mock_if.predict.return_value = if_result
    mock_if.current_version      = "v1"
    mock_if.threshold            = -0.05

    mock_zs = MagicMock()
    mock_zs.predict.return_value = zs_result

    mock_tr = MagicMock()
    mock_tr.predict.return_value = tr_result

    mock_ensemble = MagicMock()
    mock_ensemble.decide.return_value = ensemble_result

    with (
        patch("ml.predict.IsolationForestModel", return_value=mock_if),
        patch("ml.predict.ZScoreModel",          return_value=mock_zs),
        patch("ml.predict.TrendModel",           return_value=mock_tr),
        patch("ml.predict.EnsembleDecision",     return_value=mock_ensemble),
    ):
        from ml.predict import EnsemblePredictor
        predictor = EnsemblePredictor()

    # Manually attach our mocks so tests can inspect call counts
    predictor.if_model  = mock_if
    predictor.zs_model  = mock_zs
    predictor.tr_model  = mock_tr
    predictor.ensemble  = mock_ensemble

    return predictor


# ---------------------------------------------------------------------------
# predict_anomaly — basic structure
# ---------------------------------------------------------------------------

class TestPredictAnomalyStructure:
    def test_result_has_is_anomaly_key(self):
        predictor = _make_predictor()
        result = predictor.predict_anomaly({"deviceId": "d1"})
        assert "is_anomaly" in result

    def test_result_has_anomaly_score_key(self):
        predictor = _make_predictor()
        result = predictor.predict_anomaly({"deviceId": "d1"})
        assert "anomaly_score" in result

    def test_result_has_severity_key(self):
        predictor = _make_predictor()
        result = predictor.predict_anomaly({"deviceId": "d1"})
        assert "severity" in result

    def test_result_has_scores_key(self):
        predictor = _make_predictor()
        result = predictor.predict_anomaly({"deviceId": "d1"})
        assert "scores" in result

    def test_result_has_reason_key(self):
        predictor = _make_predictor()
        result = predictor.predict_anomaly({"deviceId": "d1"})
        assert "reason" in result

    def test_is_anomaly_is_alias_for_anomaly(self):
        ensemble = _ensemble_result(True, "HIGH", isolation_score=-0.3)
        predictor = _make_predictor(ensemble_result=ensemble)
        result = predictor.predict_anomaly({"deviceId": "d1"})
        assert result["is_anomaly"] == result["anomaly"]

    def test_anomaly_score_is_isolation_score(self):
        ensemble = _ensemble_result(False, "NORMAL", isolation_score=0.42)
        predictor = _make_predictor(ensemble_result=ensemble)
        result = predictor.predict_anomaly({"deviceId": "d1"})
        assert result["anomaly_score"] == pytest.approx(0.42)


# ---------------------------------------------------------------------------
# predict_anomaly — all models normal → no anomaly
# ---------------------------------------------------------------------------

class TestAllModelsNormal:
    def test_no_anomaly_when_all_models_normal(self):
        predictor = _make_predictor(
            if_result=_if_result(False, 0.2),
            zs_result=_zs_result(False, 0.3),
            tr_result=_tr_result(False, "stable"),
            ensemble_result=_ensemble_result(False, "NORMAL"),
        )
        result = predictor.predict_anomaly({"deviceId": "d1"})
        assert result["is_anomaly"] is False

    def test_severity_normal_when_no_anomaly(self):
        predictor = _make_predictor(
            ensemble_result=_ensemble_result(False, "NORMAL"),
        )
        result = predictor.predict_anomaly({"deviceId": "d1"})
        assert result["severity"] == "NORMAL"


# ---------------------------------------------------------------------------
# predict_anomaly — Isolation Forest flags alone (weighted 2 ≥ threshold)
# ---------------------------------------------------------------------------

class TestIsolationForestAloneTriggersAnomaly:
    def test_anomaly_true_when_if_flags(self):
        predictor = _make_predictor(
            if_result=_if_result(True, -0.3),
            zs_result=_zs_result(False, 1.0),
            tr_result=_tr_result(False, "stable"),
            ensemble_result=_ensemble_result(True, "HIGH", isolation_score=-0.3),
        )
        result = predictor.predict_anomaly({"deviceId": "d1"})
        assert result["is_anomaly"] is True

    def test_severity_high_when_only_if_flags(self):
        predictor = _make_predictor(
            ensemble_result=_ensemble_result(True, "HIGH", isolation_score=-0.3),
        )
        result = predictor.predict_anomaly({"deviceId": "d1"})
        assert result["severity"] == "HIGH"


# ---------------------------------------------------------------------------
# predict_anomaly — all models flag → CRITICAL
# ---------------------------------------------------------------------------

class TestAllModelsFlagCritical:
    def test_critical_severity_when_all_flag(self):
        predictor = _make_predictor(
            if_result=_if_result(True, -0.5),
            zs_result=_zs_result(True, 4.5),
            tr_result=_tr_result(True, "increasing"),
            ensemble_result=_ensemble_result(True, "CRITICAL", isolation_score=-0.5),
        )
        result = predictor.predict_anomaly({"deviceId": "d1"})
        assert result["severity"] == "CRITICAL"


# ---------------------------------------------------------------------------
# predict_anomaly — sub-models are each called exactly once
# ---------------------------------------------------------------------------

class TestSubModelCallCounts:
    def test_if_model_called_once(self):
        predictor = _make_predictor()
        predictor.predict_anomaly({"deviceId": "d1"})
        predictor.if_model.predict.assert_called_once()

    def test_zs_model_called_once(self):
        predictor = _make_predictor()
        predictor.predict_anomaly({"deviceId": "d1"})
        predictor.zs_model.predict.assert_called_once()

    def test_tr_model_called_once(self):
        predictor = _make_predictor()
        predictor.predict_anomaly({"deviceId": "d1"})
        predictor.tr_model.predict.assert_called_once()

    def test_ensemble_decide_called_once(self):
        predictor = _make_predictor()
        predictor.predict_anomaly({"deviceId": "d1"})
        predictor.ensemble.decide.assert_called_once()


# ---------------------------------------------------------------------------
# predict_window
# ---------------------------------------------------------------------------

class TestPredictWindow:
    def test_empty_list_returns_empty_list(self):
        predictor = _make_predictor()
        assert predictor.predict_window([]) == []

    def test_returns_one_result_per_event(self):
        predictor = _make_predictor()
        events = [{"deviceId": "d1"}, {"deviceId": "d1"}, {"deviceId": "d2"}]
        results = predictor.predict_window(events)
        assert len(results) == 3

    def test_each_result_has_is_anomaly(self):
        predictor = _make_predictor()
        events = [{"deviceId": "d1"}, {"deviceId": "d2"}]
        for r in predictor.predict_window(events):
            assert "is_anomaly" in r


# ---------------------------------------------------------------------------
# load_model — propagates version and threshold from IF model
# ---------------------------------------------------------------------------

class TestLoadModel:
    def test_load_model_updates_current_version(self):
        predictor = _make_predictor()
        predictor.if_model.current_version = "v2"
        predictor.if_model.threshold       = -0.08
        predictor.load_model()
        assert predictor.current_version == "v2"

    def test_load_model_updates_threshold(self):
        predictor = _make_predictor()
        predictor.if_model.threshold = -0.08
        predictor.load_model()
        assert predictor.threshold == pytest.approx(-0.08)
