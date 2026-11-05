"""
Unit tests for ml.ensemble.EnsembleDecision.
"""
import pytest

from ml.ensemble import EnsembleDecision


@pytest.fixture
def ensemble() -> EnsembleDecision:
    return EnsembleDecision()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _if(anom: bool, score: float = 0.0) -> dict:
    return {"is_anomaly": anom, "score": score}


def _zs(anom: bool, zscore: float = 0.0) -> dict:
    return {"is_anomaly": anom, "max_zscore": zscore, "scores": {}}


def _tr(anom: bool, trend: str = "stable", std: float = 0.0, rng: float = 0.0) -> dict:
    return {"is_anomaly": anom, "trend": trend, "temp_std": std, "temp_range": rng}


# ---------------------------------------------------------------------------
# Voting / anomaly decision
# ---------------------------------------------------------------------------

class TestVoting:
    def test_all_normal_is_not_anomaly(self, ensemble):
        r = ensemble.decide(_if(False), _zs(False), _tr(False))
        assert r["anomaly"] is False

    def test_isolation_forest_alone_triggers(self, ensemble):
        # IF weight=2 ≥ VOTE_THRESHOLD(2) → anomaly
        r = ensemble.decide(_if(True, -0.2), _zs(False), _tr(False))
        assert r["anomaly"] is True

    def test_zscore_alone_does_not_trigger(self, ensemble):
        # Z-score weight=1 < VOTE_THRESHOLD(2)
        r = ensemble.decide(_if(False), _zs(True, 4.0), _tr(False))
        assert r["anomaly"] is False

    def test_trend_alone_does_not_trigger(self, ensemble):
        r = ensemble.decide(_if(False), _zs(False), _tr(True))
        assert r["anomaly"] is False

    def test_zscore_plus_trend_triggers(self, ensemble):
        # 1 + 1 = 2 ≥ VOTE_THRESHOLD
        r = ensemble.decide(_if(False), _zs(True), _tr(True))
        assert r["anomaly"] is True


# ---------------------------------------------------------------------------
# Severity
# ---------------------------------------------------------------------------

class TestSeverity:
    def test_no_votes_normal(self, ensemble):
        assert ensemble.decide(_if(False), _zs(False), _tr(False))["severity"] == "NORMAL"

    def test_if_only_is_high(self, ensemble):
        r = ensemble.decide(_if(True), _zs(False), _tr(False))
        assert r["severity"] == "HIGH"

    def test_all_models_is_critical(self, ensemble):
        r = ensemble.decide(_if(True, -0.3), _zs(True, 5.0), _tr(True))
        assert r["severity"] == "CRITICAL"

    def test_zscore_and_trend_is_high(self, ensemble):
        r = ensemble.decide(_if(False), _zs(True), _tr(True))
        assert r["severity"] == "HIGH"

    def test_one_minor_model_is_low(self, ensemble):
        # Only Z-score: votes=1 → LOW
        r = ensemble.decide(_if(False), _zs(True), _tr(False))
        assert r["severity"] == "LOW"


# ---------------------------------------------------------------------------
# Scores structure
# ---------------------------------------------------------------------------

class TestScores:
    def test_scores_keys_present(self, ensemble):
        r = ensemble.decide(_if(True, -0.1), _zs(False, 1.0), _tr(False))
        assert set(r["scores"].keys()) == {"isolation", "zscore", "trend"}

    def test_isolation_score_propagated(self, ensemble):
        r = ensemble.decide(_if(True, -0.25), _zs(False), _tr(False))
        assert r["scores"]["isolation"] == pytest.approx(-0.25)

    def test_zscore_value_propagated(self, ensemble):
        r = ensemble.decide(_if(False), _zs(True, 3.7), _tr(False))
        assert r["scores"]["zscore"] == pytest.approx(3.7)

    def test_trend_bool_propagated(self, ensemble):
        r = ensemble.decide(_if(False), _zs(False), _tr(True))
        assert r["scores"]["trend"] is True


# ---------------------------------------------------------------------------
# Reason / explainability
# ---------------------------------------------------------------------------

class TestReason:
    def test_all_normal_gives_nominal_message(self, ensemble):
        r = ensemble.decide(_if(False), _zs(False), _tr(False))
        assert r["reason"] == "All models nominal"

    def test_isolation_mentioned_in_reason(self, ensemble):
        r = ensemble.decide(_if(True, -0.2), _zs(False), _tr(False))
        assert "Isolation Forest" in r["reason"]

    def test_zscore_mentioned_in_reason(self, ensemble):
        r = ensemble.decide(_if(False), _zs(True, 4.5), _tr(False))
        assert "\u03c3" in r["reason"]  # sigma

    def test_trend_mentioned_in_reason(self, ensemble):
        r = ensemble.decide(_if(False), _zs(False), _tr(True, "increasing", 6.0, 12.0))
        assert "increasing" in r["reason"]

    def test_multiple_reasons_concatenated(self, ensemble):
        r = ensemble.decide(_if(True, -0.2), _zs(True, 4.0), _tr(False))
        assert ";" in r["reason"]


# ---------------------------------------------------------------------------
# Features (explainability breakdown)
# ---------------------------------------------------------------------------

class TestFeatures:
    def test_features_key_present(self, ensemble):
        r = ensemble.decide(_if(False), _zs(False), _tr(False))
        assert "features" in r

    def test_isolation_score_in_features(self, ensemble):
        r = ensemble.decide(_if(False, -0.05), _zs(False), _tr(False))
        assert r["features"]["isolation_score"] == pytest.approx(-0.05)

    def test_zscore_breakdown_in_features(self, ensemble):
        zs = _zs(False)
        zs["scores"] = {"temperature": 1.2, "humidity": 0.3}
        r = ensemble.decide(_if(False), zs, _tr(False))
        assert r["features"]["zscore_breakdown"]["temperature"] == pytest.approx(1.2)

    def test_trend_info_in_features(self, ensemble):
        r = ensemble.decide(_if(False), _zs(False), _tr(True, "increasing", 7.0, 15.0))
        assert r["features"]["trend_info"]["trend"] == "increasing"
