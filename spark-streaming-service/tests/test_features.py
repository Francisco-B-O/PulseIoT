"""
Unit tests for streaming.features.DeviceWindowState.

No PySpark dependency — runs with vanilla pytest and numpy only.
These tests validate all feature computation logic in isolation.
"""
import pytest

from streaming.features import DeviceWindowState


# ---------------------------------------------------------------------------
# Fixtures & helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def state() -> DeviceWindowState:
    return DeviceWindowState(window_size=5)


def _r(temp: float = 25.0, hum: float = 50.0, vib: float = 0.01) -> dict:
    return {"temperature": temp, "humidity": hum, "vibration": vib}


# ---------------------------------------------------------------------------
# Empty / missing state
# ---------------------------------------------------------------------------

class TestEmptyState:
    def test_unknown_device_returns_empty_dict(self, state):
        assert state.compute_features("ghost-device") == {}

    def test_window_size_zero_for_unknown_device(self, state):
        assert state.get_window_size("ghost-device") == 0


# ---------------------------------------------------------------------------
# Single reading
# ---------------------------------------------------------------------------

class TestSingleReading:
    def test_populates_temp_mean(self, state):
        state.update("d1", _r(25.0))
        assert state.compute_features("d1")["temp_mean"] == pytest.approx(25.0)

    def test_std_is_zero_for_one_reading(self, state):
        state.update("d1", _r(25.0))
        assert state.compute_features("d1")["temp_std"] == pytest.approx(0.0)

    def test_min_max_equal_value(self, state):
        state.update("d1", _r(30.0))
        f = state.compute_features("d1")
        assert f["temp_min"] == pytest.approx(30.0)
        assert f["temp_max"] == pytest.approx(30.0)

    def test_trend_stable_with_one_reading(self, state):
        state.update("d1", _r(25.0))
        assert state.compute_features("d1")["trend"] == "stable"

    def test_event_count_is_one(self, state):
        state.update("d1", _r())
        assert state.compute_features("d1")["event_count"] == 1


# ---------------------------------------------------------------------------
# Multiple readings — statistics
# ---------------------------------------------------------------------------

class TestStatistics:
    def test_rolling_mean(self, state):
        for t in [10.0, 20.0, 30.0, 40.0]:
            state.update("d1", _r(t))
        assert state.compute_features("d1")["temp_mean"] == pytest.approx(25.0)

    def test_rolling_std_nonzero_with_variance(self, state):
        for t in [10.0, 30.0, 50.0]:
            state.update("d1", _r(t))
        assert state.compute_features("d1")["temp_std"] > 0.0

    def test_min_max_range(self, state):
        for t in [5.0, 15.0, 25.0]:
            state.update("d1", _r(t))
        f = state.compute_features("d1")
        assert f["temp_min"]   == pytest.approx(5.0)
        assert f["temp_max"]   == pytest.approx(25.0)
        assert f["temp_range"] == pytest.approx(20.0)

    def test_humidity_mean(self, state):
        state.update("d1", {"temperature": 25.0, "humidity": 60.0, "vibration": 0.01})
        state.update("d1", {"temperature": 25.0, "humidity": 80.0, "vibration": 0.01})
        assert state.compute_features("d1")["hum_mean"] == pytest.approx(70.0)

    def test_humidity_std(self, state):
        for h in [40.0, 60.0, 80.0]:
            state.update("d1", {"temperature": 25.0, "humidity": h, "vibration": 0.01})
        assert state.compute_features("d1")["hum_std"] > 0.0

    def test_vibration_mean(self, state):
        state.update("d1", {"temperature": 25.0, "humidity": 50.0, "vibration": 0.02})
        state.update("d1", {"temperature": 25.0, "humidity": 50.0, "vibration": 0.04})
        assert state.compute_features("d1")["vib_mean"] == pytest.approx(0.03)

    def test_vibration_std(self, state):
        for v in [0.01, 0.05, 0.09]:
            state.update("d1", {"temperature": 25.0, "humidity": 50.0, "vibration": v})
        assert state.compute_features("d1")["vib_std"] > 0.0


# ---------------------------------------------------------------------------
# Trend detection
# ---------------------------------------------------------------------------

class TestTrend:
    def test_increasing_trend(self, state):
        state.update("d1", _r(20.0))
        state.update("d1", _r(25.0))
        assert state.compute_features("d1")["trend"] == "increasing"

    def test_decreasing_trend(self, state):
        state.update("d1", _r(25.0))
        state.update("d1", _r(20.0))
        assert state.compute_features("d1")["trend"] == "decreasing"

    def test_stable_trend_same_values(self, state):
        state.update("d1", _r(25.0))
        state.update("d1", _r(25.0))
        assert state.compute_features("d1")["trend"] == "stable"

    def test_trend_reflects_last_two_readings(self, state):
        # After rising then falling, last pair determines trend
        for t in [20.0, 25.0, 30.0, 28.0]:
            state.update("d1", _r(t))
        assert state.compute_features("d1")["trend"] == "decreasing"


# ---------------------------------------------------------------------------
# Rolling window cap
# ---------------------------------------------------------------------------

class TestWindowCap:
    def test_window_capped_at_window_size(self, state):
        for t in range(10, 70, 10):  # 6 readings into window_size=5
            state.update("d1", _r(float(t)))
        assert state.get_window_size("d1") == 5

    def test_oldest_reading_evicted(self, state):
        for t in range(10, 70, 10):  # 10,20,30,40,50,60 → keeps 20..60
            state.update("d1", _r(float(t)))
        f = state.compute_features("d1")
        assert f["temp_min"] == pytest.approx(20.0)

    def test_event_count_capped(self, state):
        for _ in range(10):
            state.update("d1", _r())
        assert state.compute_features("d1")["event_count"] == 5


# ---------------------------------------------------------------------------
# Device isolation
# ---------------------------------------------------------------------------

class TestDeviceIsolation:
    def test_devices_do_not_share_state(self, state):
        state.update("d1", _r(100.0))
        state.update("d2", _r(20.0))
        assert state.compute_features("d1")["temp_mean"] == pytest.approx(100.0)
        assert state.compute_features("d2")["temp_mean"] == pytest.approx(20.0)

    def test_update_one_device_does_not_affect_other(self, state):
        state.update("d1", _r(30.0))
        state.update("d2", _r(50.0))
        state.update("d1", _r(35.0))
        assert state.compute_features("d2")["temp_mean"] == pytest.approx(50.0)
