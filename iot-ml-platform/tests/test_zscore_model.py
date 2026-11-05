"""
Unit tests for ml.models.zscore_model.ZScoreModel.
"""
import pytest

from ml.models.zscore_model import ZScoreModel


@pytest.fixture
def model() -> ZScoreModel:
    return ZScoreModel(threshold=3.0)


def _event(temp: float = 25.0, hum: float = 50.0, vib: float = 0.01, spark: dict | None = None) -> dict:
    e: dict = {"enrichedData": {"temperature": temp, "humidity": hum, "vibration": vib}}
    if spark:
        e["sparkFeatures"] = spark
    return e


def _spark(temp_mean=25.0, temp_std=2.0, hum_mean=50.0, hum_std=5.0, vib_mean=0.01, vib_std=0.005) -> dict:
    return {
        "temp_mean": temp_mean, "temp_std": temp_std,
        "hum_mean":  hum_mean,  "hum_std":  hum_std,
        "vib_mean":  vib_mean,  "vib_std":  vib_std,
    }


class TestNoSparkFeatures:
    def test_no_anomaly_without_spark(self, model):
        r = model.predict(_event(25.0))
        assert r["is_anomaly"] is False

    def test_zscore_zero_without_std(self, model):
        r = model.predict(_event(25.0))
        assert r["max_zscore"] == pytest.approx(0.0)


class TestWithSparkFeatures:
    def test_high_temp_zscore_flags_anomaly(self, model):
        # temp=35, mean=25, std=2 → z=5 > 3.0
        r = model.predict(_event(35.0, spark=_spark(temp_std=2.0)))
        assert r["is_anomaly"] is True
        assert r["max_zscore"] > 3.0

    def test_normal_reading_no_anomaly(self, model):
        r = model.predict(_event(26.0, spark=_spark()))
        assert r["is_anomaly"] is False

    def test_high_humidity_zscore(self, model):
        # hum=80, mean=50, std=5 → z=6 > 3.0
        r = model.predict(_event(hum=80.0, spark=_spark()))
        assert r["is_anomaly"] is True

    def test_high_vibration_zscore(self, model):
        # vib=0.025, mean=0.01, std=0.005 → z=3 ≥ 3.0 → boundary
        r = model.predict(_event(vib=0.025, spark=_spark()))
        # exactly at threshold → not > threshold
        assert r["scores"]["vibration"] == pytest.approx(3.0)

    def test_zero_std_gives_zero_zscore(self, model):
        spark = _spark(temp_std=0.0, hum_std=0.0, vib_std=0.0)
        r = model.predict(_event(100.0, spark=spark))
        assert r["max_zscore"] == pytest.approx(0.0)
        assert r["is_anomaly"] is False


class TestScoresStructure:
    def test_scores_has_all_sensors(self, model):
        r = model.predict(_event(25.0))
        assert "temperature" in r["scores"]
        assert "humidity"    in r["scores"]
        assert "vibration"   in r["scores"]

    def test_max_zscore_equals_max_of_scores(self, model):
        r = model.predict(_event(35.0, spark=_spark(temp_std=2.0)))
        assert r["max_zscore"] == pytest.approx(
            max(r["scores"].values()), abs=0.01
        )


class TestCustomThreshold:
    def test_lower_threshold_catches_more(self):
        strict = ZScoreModel(threshold=2.0)
        r = strict.predict(_event(30.0, spark=_spark(temp_std=2.0)))
        assert r["is_anomaly"] is True

    def test_higher_threshold_misses_mild_outlier(self):
        lenient = ZScoreModel(threshold=5.0)
        r = lenient.predict(_event(30.0, spark=_spark(temp_std=2.0)))
        assert r["is_anomaly"] is False
