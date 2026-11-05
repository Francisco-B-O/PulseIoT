"""
Unit tests for IsolationForestModel.

All file-system and data-lake interactions are mocked so these tests run
without a real model on disk and without Kafka/Parquet infrastructure.
"""
from __future__ import annotations

import json
import os
import tempfile
from unittest.mock import MagicMock, patch

import joblib
import pandas as pd
import pytest
from sklearn.ensemble import IsolationForest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_model_dir(tmp_dir: str, version: str = "v1") -> str:
    """
    Write a minimal trained IsolationForest + feature_names into *tmp_dir*
    so that IsolationForestModel.load() can find them.
    Returns the version string used.
    """
    version_dir = os.path.join(tmp_dir, version)
    os.makedirs(version_dir)

    clf = IsolationForest(n_estimators=10, random_state=0)
    feature_names = ["enrichedData.temperature", "enrichedData.humidity"]
    X = [[25.0, 50.0], [26.0, 51.0], [24.0, 49.0]]
    clf.fit(X)

    joblib.dump(clf, os.path.join(version_dir, "anomaly_detector.joblib"))
    joblib.dump(feature_names, os.path.join(version_dir, "feature_names.joblib"))

    info = {
        "latest_version": version,
        "metrics": {"threshold": -0.05},
    }
    with open(os.path.join(tmp_dir, "latest_model.json"), "w") as f:
        json.dump(info, f)

    return version


# ---------------------------------------------------------------------------
# Patching helpers
# ---------------------------------------------------------------------------

def _patch_settings(model_path: str):
    """Return a context manager that overrides settings.MODEL_STORAGE_PATH."""
    mock_settings = MagicMock()
    mock_settings.MODEL_STORAGE_PATH = model_path
    mock_settings.ANOMALY_THRESHOLD = -0.05
    return patch("ml.models.isolation_forest_model.settings", mock_settings)


def _patch_data_lake_empty():
    """Patch data_lake to return an empty DataFrame (no historical context)."""
    mock_lake = MagicMock()
    mock_lake.get_recent_events_for_device.return_value = pd.DataFrame()
    return patch("streaming.features", mock_lake, create=True), \
           patch("ml.models.isolation_forest_model.data_lake", mock_lake, create=True)


# ---------------------------------------------------------------------------
# load() — missing info file
# ---------------------------------------------------------------------------

class TestLoadMissingInfoFile:
    def test_model_stays_none_when_no_info_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            # tmp has no latest_model.json
            with _patch_settings(tmp):
                from ml.models.isolation_forest_model import IsolationForestModel
                m = IsolationForestModel.__new__(IsolationForestModel)
                m.model_path = tmp
                m.latest_info_file = os.path.join(tmp, "latest_model.json")
                m.model = None
                m.feature_names = None
                m.current_version = None
                m.threshold = -0.05
                m.load()

            assert m.model is None

    def test_feature_names_stays_none_when_no_info_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            with _patch_settings(tmp):
                from ml.models.isolation_forest_model import IsolationForestModel
                m = IsolationForestModel.__new__(IsolationForestModel)
                m.model_path = tmp
                m.latest_info_file = os.path.join(tmp, "latest_model.json")
                m.model = None
                m.feature_names = None
                m.current_version = None
                m.threshold = -0.05
                m.load()

            assert m.feature_names is None


# ---------------------------------------------------------------------------
# load() — unsafe version string
# ---------------------------------------------------------------------------

class TestLoadUnsafeVersion:
    def test_skips_load_for_path_traversal_version(self):
        with tempfile.TemporaryDirectory() as tmp:
            info = {"latest_version": "../../etc/passwd"}
            with open(os.path.join(tmp, "latest_model.json"), "w") as f:
                json.dump(info, f)

            with _patch_settings(tmp):
                from ml.models.isolation_forest_model import IsolationForestModel
                m = IsolationForestModel.__new__(IsolationForestModel)
                m.model_path = tmp
                m.latest_info_file = os.path.join(tmp, "latest_model.json")
                m.model = None
                m.feature_names = None
                m.current_version = None
                m.threshold = -0.05
                m.load()

            assert m.model is None

    def test_skips_load_for_version_with_spaces(self):
        with tempfile.TemporaryDirectory() as tmp:
            info = {"latest_version": "version with spaces"}
            with open(os.path.join(tmp, "latest_model.json"), "w") as f:
                json.dump(info, f)

            with _patch_settings(tmp):
                from ml.models.isolation_forest_model import IsolationForestModel
                m = IsolationForestModel.__new__(IsolationForestModel)
                m.model_path = tmp
                m.latest_info_file = os.path.join(tmp, "latest_model.json")
                m.model = None
                m.feature_names = None
                m.current_version = None
                m.threshold = -0.05
                m.load()

            assert m.model is None

    def test_skips_load_for_version_with_semicolon(self):
        with tempfile.TemporaryDirectory() as tmp:
            info = {"latest_version": "v1;rm -rf /"}
            with open(os.path.join(tmp, "latest_model.json"), "w") as f:
                json.dump(info, f)

            with _patch_settings(tmp):
                from ml.models.isolation_forest_model import IsolationForestModel
                m = IsolationForestModel.__new__(IsolationForestModel)
                m.model_path = tmp
                m.latest_info_file = os.path.join(tmp, "latest_model.json")
                m.model = None
                m.feature_names = None
                m.current_version = None
                m.threshold = -0.05
                m.load()

            assert m.model is None


# ---------------------------------------------------------------------------
# load() — happy path (real files in temp dir)
# ---------------------------------------------------------------------------

class TestLoadHappyPath:
    def test_loads_model_from_temp_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            version = _make_model_dir(tmp, "v1")

            mock_settings = MagicMock()
            mock_settings.MODEL_STORAGE_PATH = tmp
            mock_settings.ANOMALY_THRESHOLD = -0.05

            with patch("ml.models.isolation_forest_model.settings", mock_settings):
                from ml.models.isolation_forest_model import IsolationForestModel
                m = IsolationForestModel.__new__(IsolationForestModel)
                m.model_path = tmp
                m.latest_info_file = os.path.join(tmp, "latest_model.json")
                m.model = None
                m.feature_names = None
                m.current_version = None
                m.threshold = -0.05
                m.load()

            assert m.model is not None
            assert m.current_version == version
            assert m.feature_names == ["enrichedData.temperature", "enrichedData.humidity"]

    def test_threshold_set_from_metrics(self):
        with tempfile.TemporaryDirectory() as tmp:
            _make_model_dir(tmp, "v1")

            mock_settings = MagicMock()
            mock_settings.MODEL_STORAGE_PATH = tmp
            mock_settings.ANOMALY_THRESHOLD = -0.99  # default, should be overridden

            with patch("ml.models.isolation_forest_model.settings", mock_settings):
                from ml.models.isolation_forest_model import IsolationForestModel
                m = IsolationForestModel.__new__(IsolationForestModel)
                m.model_path = tmp
                m.latest_info_file = os.path.join(tmp, "latest_model.json")
                m.model = None
                m.feature_names = None
                m.current_version = None
                m.threshold = -0.99
                m.load()

            assert m.threshold == pytest.approx(-0.05)


# ---------------------------------------------------------------------------
# predict() — model is None
# ---------------------------------------------------------------------------

class TestPredictNoModel:
    def _make_no_model_instance(self) -> object:
        from ml.models.isolation_forest_model import IsolationForestModel
        m = IsolationForestModel.__new__(IsolationForestModel)
        m.model = None
        m.feature_names = None
        m.current_version = None
        m.threshold = -0.05
        m.model_path = "/nonexistent"
        m.latest_info_file = "/nonexistent/latest_model.json"
        return m

    def test_returns_is_anomaly_false_when_no_model(self):
        m = self._make_no_model_instance()
        # load() will be called internally; patch os.path.exists to return False
        with patch("os.path.exists", return_value=False):
            result = m.predict({"deviceId": "d1", "timestamp": "2026-01-01T00:00:00Z"})
        assert result["is_anomaly"] is False

    def test_returns_score_zero_when_no_model(self):
        m = self._make_no_model_instance()
        with patch("os.path.exists", return_value=False):
            result = m.predict({"deviceId": "d1", "timestamp": "2026-01-01T00:00:00Z"})
        assert result["score"] == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# predict() — with a real (mocked-attribute) model
# ---------------------------------------------------------------------------

class TestPredictWithModel:
    def _make_loaded_instance(self, tmp: str) -> object:
        """Build an IsolationForestModel with its model attribute set directly."""
        _make_model_dir(tmp, "v1")

        mock_settings = MagicMock()
        mock_settings.MODEL_STORAGE_PATH = tmp
        mock_settings.ANOMALY_THRESHOLD = -0.05

        with patch("ml.models.isolation_forest_model.settings", mock_settings):
            from ml.models.isolation_forest_model import IsolationForestModel
            m = IsolationForestModel.__new__(IsolationForestModel)
            m.model_path = tmp
            m.latest_info_file = os.path.join(tmp, "latest_model.json")
            m.model = None
            m.feature_names = None
            m.current_version = None
            m.threshold = -0.05
            m.load()
        return m

    def test_predict_returns_is_anomaly_bool(self):
        with tempfile.TemporaryDirectory() as tmp:
            m = self._make_loaded_instance(tmp)
            event = {
                "deviceId": "d1",
                "timestamp": "2026-01-01T00:00:00Z",
                "enrichedData.temperature": 25.0,
                "enrichedData.humidity": 50.0,
            }
            mock_lake = MagicMock()
            mock_lake.get_recent_events_for_device.return_value = pd.DataFrame()

            with patch("storage.data_lake.data_lake", mock_lake):
                result = m.predict(event)

            assert isinstance(result["is_anomaly"], bool)

    def test_predict_returns_score_float(self):
        with tempfile.TemporaryDirectory() as tmp:
            m = self._make_loaded_instance(tmp)
            event = {
                "deviceId": "d1",
                "timestamp": "2026-01-01T00:00:00Z",
                "enrichedData.temperature": 25.0,
                "enrichedData.humidity": 50.0,
            }
            mock_lake = MagicMock()
            mock_lake.get_recent_events_for_device.return_value = pd.DataFrame()

            with patch("storage.data_lake.data_lake", mock_lake):
                result = m.predict(event)

            assert isinstance(result["score"], float)

    def test_predict_uses_threshold(self):
        """score < threshold → is_anomaly True; score >= threshold → False."""
        with tempfile.TemporaryDirectory() as tmp:
            m = self._make_loaded_instance(tmp)
            # Override model with one that always returns a known decision value
            mock_clf = MagicMock()
            mock_clf.decision_function.return_value = [-1.0]  # well below any threshold
            m.model = mock_clf
            m.threshold = -0.05
            m.feature_names = ["enrichedData.temperature", "enrichedData.humidity"]

            event = {
                "deviceId": "d1",
                "timestamp": "2026-01-01T00:00:00Z",
                "enrichedData.temperature": 25.0,
                "enrichedData.humidity": 50.0,
            }
            mock_lake = MagicMock()
            mock_lake.get_recent_events_for_device.return_value = pd.DataFrame()

            with patch("storage.data_lake.data_lake", mock_lake):
                result = m.predict(event)

            assert result["is_anomaly"] is True

    def test_predict_normal_score_above_threshold(self):
        with tempfile.TemporaryDirectory() as tmp:
            m = self._make_loaded_instance(tmp)
            mock_clf = MagicMock()
            mock_clf.decision_function.return_value = [0.5]  # well above threshold
            m.model = mock_clf
            m.threshold = -0.05
            m.feature_names = ["enrichedData.temperature", "enrichedData.humidity"]

            event = {
                "deviceId": "d1",
                "timestamp": "2026-01-01T00:00:00Z",
                "enrichedData.temperature": 25.0,
                "enrichedData.humidity": 50.0,
            }
            mock_lake = MagicMock()
            mock_lake.get_recent_events_for_device.return_value = pd.DataFrame()

            with patch("storage.data_lake.data_lake", mock_lake):
                result = m.predict(event)

            assert result["is_anomaly"] is False


# ---------------------------------------------------------------------------
# _build_window() — no historical data
# ---------------------------------------------------------------------------

class TestBuildWindow:
    def _make_instance(self) -> object:
        from ml.models.isolation_forest_model import IsolationForestModel
        m = IsolationForestModel.__new__(IsolationForestModel)
        m.model = None
        m.feature_names = None
        m.current_version = None
        m.threshold = -0.05
        m.model_path = "/nonexistent"
        m.latest_info_file = "/nonexistent/latest_model.json"
        return m

    def test_build_window_no_history_returns_single_row(self):
        m = self._make_instance()
        event = {
            "deviceId": "d1",
            "timestamp": "2026-01-01T00:00:00Z",
            "enrichedData.temperature": 25.0,
        }
        mock_lake = MagicMock()
        mock_lake.get_recent_events_for_device.return_value = pd.DataFrame()

        with patch("storage.data_lake.data_lake", mock_lake):
            window = m._build_window(event)

        assert len(window) == 1

    def test_build_window_no_device_id_returns_single_row(self):
        m = self._make_instance()
        event = {
            "timestamp": "2026-01-01T00:00:00Z",
            "enrichedData.temperature": 25.0,
        }
        # No deviceId → data_lake should not be queried
        window = m._build_window(event)
        assert len(window) == 1

    def test_build_window_with_history_concatenates(self):
        m = self._make_instance()
        event = {
            "deviceId": "d1",
            "timestamp": "2026-01-01T00:00:01Z",
            "enrichedData.temperature": 26.0,
        }
        historical = pd.DataFrame([{
            "deviceId": "d1",
            "timestamp": "2026-01-01T00:00:00Z",
            "enrichedData.temperature": 25.0,
        }])
        mock_lake = MagicMock()
        mock_lake.get_recent_events_for_device.return_value = historical

        with patch("storage.data_lake.data_lake", mock_lake):
            window = m._build_window(event)

        assert len(window) == 2


# ---------------------------------------------------------------------------
# load() — exception in load path
# ---------------------------------------------------------------------------

class TestLoadException:
    def test_model_is_none_when_joblib_raises(self):
        """If joblib.load raises, the exception should be caught and model set None."""
        with tempfile.TemporaryDirectory() as tmp:
            _make_model_dir(tmp, "v1")

            mock_settings = MagicMock()
            mock_settings.MODEL_STORAGE_PATH = tmp
            mock_settings.ANOMALY_THRESHOLD = -0.05

            with patch("ml.models.isolation_forest_model.settings", mock_settings), \
                 patch("joblib.load", side_effect=Exception("disk error")):
                from ml.models.isolation_forest_model import IsolationForestModel
                m = IsolationForestModel.__new__(IsolationForestModel)
                m.model_path = tmp
                m.latest_info_file = os.path.join(tmp, "latest_model.json")
                m.model = None
                m.feature_names = None
                m.current_version = None
                m.threshold = -0.05
                m.load()

            assert m.model is None


# ---------------------------------------------------------------------------
# predict() — exception in prediction path
# ---------------------------------------------------------------------------

class TestPredictException:
    def test_predict_returns_false_on_exception(self):
        """If data_processor raises during predict, should return safe default."""
        with tempfile.TemporaryDirectory() as tmp:
            _make_model_dir(tmp, "v1")

            mock_settings = MagicMock()
            mock_settings.MODEL_STORAGE_PATH = tmp
            mock_settings.ANOMALY_THRESHOLD = -0.05

            with patch("ml.models.isolation_forest_model.settings", mock_settings):
                from ml.models.isolation_forest_model import IsolationForestModel
                m = IsolationForestModel.__new__(IsolationForestModel)
                m.model_path = tmp
                m.latest_info_file = os.path.join(tmp, "latest_model.json")
                m.model = None
                m.feature_names = None
                m.current_version = None
                m.threshold = -0.05
                m.load()

            assert m.model is not None

            mock_lake = MagicMock()
            mock_lake.get_recent_events_for_device.return_value = pd.DataFrame()

            with patch("storage.data_lake.data_lake", mock_lake), \
                 patch("ml.models.isolation_forest_model.data_processor") as mock_proc:
                mock_proc.prepare_for_ml.side_effect = Exception("processing error")
                result = m.predict({
                    "deviceId": "d1",
                    "timestamp": "2026-01-01T00:00:00Z",
                    "enrichedData.temperature": 25.0,
                    "enrichedData.humidity": 50.0,
                })

            assert result["is_anomaly"] is False
            assert result["score"] == pytest.approx(0.0)
