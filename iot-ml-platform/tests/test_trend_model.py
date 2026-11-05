"""
Unit tests for ml.models.trend_model.TrendModel.
"""
import pytest

from ml.models.trend_model import TrendModel


@pytest.fixture
def model() -> TrendModel:
    return TrendModel(std_threshold=5.0, range_threshold=10.0)


def _event(trend: str = "stable", temp_std: float = 0.0, temp_range: float = 0.0) -> dict:
    return {"sparkFeatures": {"trend": trend, "temp_std": temp_std, "temp_range": temp_range}}


class TestNoAnomaly:
    def test_stable_trend_no_anomaly_even_with_high_variance(self, model):
        r = model.predict(_event("stable", temp_std=10.0, temp_range=20.0))
        assert r["is_anomaly"] is False

    def test_decreasing_no_anomaly_even_with_high_variance(self, model):
        r = model.predict(_event("decreasing", temp_std=10.0, temp_range=20.0))
        assert r["is_anomaly"] is False

    def test_increasing_low_std_no_anomaly(self, model):
        r = model.predict(_event("increasing", temp_std=2.0, temp_range=15.0))
        assert r["is_anomaly"] is False

    def test_increasing_low_range_no_anomaly(self, model):
        r = model.predict(_event("increasing", temp_std=8.0, temp_range=5.0))
        assert r["is_anomaly"] is False

    def test_no_spark_features_no_anomaly(self, model):
        r = model.predict({})
        assert r["is_anomaly"] is False


class TestAnomaly:
    def test_increasing_high_std_high_range_is_anomaly(self, model):
        r = model.predict(_event("increasing", temp_std=8.0, temp_range=15.0))
        assert r["is_anomaly"] is True

    def test_boundary_std_exact_threshold_no_anomaly(self, model):
        # std == threshold (not >) → no anomaly
        r = model.predict(_event("increasing", temp_std=5.0, temp_range=15.0))
        assert r["is_anomaly"] is False

    def test_boundary_range_exact_threshold_no_anomaly(self, model):
        r = model.predict(_event("increasing", temp_std=8.0, temp_range=10.0))
        assert r["is_anomaly"] is False


class TestResultStructure:
    def test_result_contains_trend(self, model):
        r = model.predict(_event("increasing", 8.0, 15.0))
        assert r["trend"] == "increasing"

    def test_result_contains_std(self, model):
        r = model.predict(_event("increasing", temp_std=8.0, temp_range=15.0))
        assert r["temp_std"] == pytest.approx(8.0)

    def test_result_contains_range(self, model):
        r = model.predict(_event("increasing", temp_std=8.0, temp_range=15.0))
        assert r["temp_range"] == pytest.approx(15.0)


class TestCustomThresholds:
    def test_stricter_std_threshold(self):
        strict = TrendModel(std_threshold=3.0, range_threshold=10.0)
        r = strict.predict(_event("increasing", temp_std=4.0, temp_range=15.0))
        assert r["is_anomaly"] is True

    def test_stricter_range_threshold(self):
        strict = TrendModel(std_threshold=5.0, range_threshold=5.0)
        r = strict.predict(_event("increasing", temp_std=8.0, temp_range=8.0))
        assert r["is_anomaly"] is True
