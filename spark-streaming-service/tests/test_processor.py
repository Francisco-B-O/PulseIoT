"""
Unit tests for streaming.processor._enrich_row.

PySpark is not installed in the unit-test environment (see requirements-test.txt).
The module-level PySpark imports are patched out via sys.modules before importing
the module under test.

Plain dicts are used instead of PySpark Row objects — both support row["key"]
subscript access, so the enrichment logic is exercised without a SparkContext.
"""
import sys
import types
from unittest.mock import MagicMock
import pytest


# ---------------------------------------------------------------------------
# Patch PySpark and confluent_kafka before importing processor
# ---------------------------------------------------------------------------

def _make_pyspark_stub() -> None:
    """Insert minimal pyspark stubs so processor.py can be imported."""
    # pyspark top-level
    pyspark = types.ModuleType("pyspark")

    # pyspark.sql (must look like a package so sub-module lookups work)
    pyspark_sql = types.ModuleType("pyspark.sql")
    pyspark_sql.DataFrame   = MagicMock
    pyspark_sql.SparkSession = MagicMock()
    pyspark.__path__ = []        # marks it as a package
    pyspark_sql.__path__ = []

    # pyspark.sql.functions
    pyspark_sql_functions = types.ModuleType("pyspark.sql.functions")
    pyspark_sql_functions.col       = MagicMock()
    pyspark_sql_functions.from_json = MagicMock()

    # pyspark.sql.types — used by schemas.py
    pyspark_sql_types = types.ModuleType("pyspark.sql.types")
    for name in ("StructType", "StructField", "StringType", "DoubleType"):
        setattr(pyspark_sql_types, name, MagicMock)

    # confluent_kafka
    confluent_kafka = types.ModuleType("confluent_kafka")
    confluent_kafka.Producer = MagicMock()

    sys.modules.setdefault("pyspark",               pyspark)
    sys.modules.setdefault("pyspark.sql",            pyspark_sql)
    sys.modules.setdefault("pyspark.sql.functions",  pyspark_sql_functions)
    sys.modules.setdefault("pyspark.sql.types",      pyspark_sql_types)
    sys.modules.setdefault("confluent_kafka",        confluent_kafka)


_make_pyspark_stub()

# Now safe to import
from streaming.processor import _enrich_row, _state  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_row(
    device_id: str = "dev-01",
    temperature=25.0,
    humidity=60.0,
    vibration=0.02,
    device_type: str | None = "TEMPERATURE",
    device_location: str | None = "Zone-A",
    enriched_data_override=...,
) -> dict:
    """Build a dict that mimics a PySpark Row from the INPUT_SCHEMA."""
    if enriched_data_override is ...:
        enriched_data = {
            "temperature":    temperature,
            "humidity":       humidity,
            "vibration":      vibration,
            "deviceType":     device_type,
            "deviceLocation": device_location,
        }
    else:
        enriched_data = enriched_data_override

    return {
        "deviceId":     device_id,
        "eventId":      "evt-123",
        "timestamp":    "2026-04-07T10:00:00Z",
        "status":       "NORMAL",
        "enrichedData": enriched_data,
    }


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

class TestEnrichRowHappyPath:
    def test_returns_expected_keys(self):
        result = _enrich_row(_make_row())
        assert set(result.keys()) == {
            "deviceId", "eventId", "timestamp", "status",
            "enrichedData", "sparkFeatures",
        }

    def test_reading_values_passed_through(self):
        result = _enrich_row(_make_row(temperature=30.5, humidity=55.0, vibration=0.1))
        ed = result["enrichedData"]
        assert ed["temperature"] == pytest.approx(30.5)
        assert ed["humidity"]    == pytest.approx(55.0)
        assert ed["vibration"]   == pytest.approx(0.1)

    def test_device_type_and_location_preserved(self):
        result = _enrich_row(_make_row(device_type="HUMIDITY", device_location="Lab"))
        assert result["enrichedData"]["deviceType"]     == "HUMIDITY"
        assert result["enrichedData"]["deviceLocation"] == "Lab"

    def test_spark_features_populated_after_multiple_readings(self):
        for t in [20.0, 25.0, 30.0]:
            _enrich_row(_make_row(device_id="multi-dev", temperature=t))
        result = _enrich_row(_make_row(device_id="multi-dev", temperature=35.0))
        sf = result["sparkFeatures"]
        assert "temp_mean" in sf
        assert sf["event_count"] >= 2

    def test_spark_features_dict_for_first_event(self):
        result = _enrich_row(_make_row(device_id="brand-new-xyz-unique"))
        assert isinstance(result["sparkFeatures"], dict)

    def test_null_sensor_values_default_to_zero(self):
        result = _enrich_row(_make_row(temperature=None, humidity=None, vibration=None))
        ed = result["enrichedData"]
        assert ed["temperature"] == pytest.approx(0.0)
        assert ed["humidity"]    == pytest.approx(0.0)
        assert ed["vibration"]   == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# Null enrichedData guard (Bug fix: was crashing with TypeError)
# ---------------------------------------------------------------------------

class TestNullEnrichedData:
    def test_null_enriched_data_does_not_raise(self):
        row = _make_row(enriched_data_override=None)
        result = _enrich_row(row)
        assert result is not None

    def test_null_enriched_data_returns_zero_readings(self):
        row = _make_row(enriched_data_override=None)
        result = _enrich_row(row)
        ed = result["enrichedData"]
        assert ed["temperature"] == pytest.approx(0.0)
        assert ed["humidity"]    == pytest.approx(0.0)
        assert ed["vibration"]   == pytest.approx(0.0)

    def test_null_enriched_data_returns_none_device_fields(self):
        row = _make_row(enriched_data_override=None)
        result = _enrich_row(row)
        ed = result["enrichedData"]
        assert ed["deviceType"]     is None
        assert ed["deviceLocation"] is None

    def test_null_enriched_data_still_includes_spark_features(self):
        row = _make_row(device_id="null-enc-dev-unique", enriched_data_override=None)
        result = _enrich_row(row)
        assert "sparkFeatures" in result
        assert isinstance(result["sparkFeatures"], dict)


# ---------------------------------------------------------------------------
# Metadata passthrough
# ---------------------------------------------------------------------------

class TestMetadataPassthrough:
    def test_event_id_preserved(self):
        row = _make_row()
        row["eventId"] = "special-event-id"
        assert _enrich_row(row)["eventId"] == "special-event-id"

    def test_timestamp_preserved(self):
        row = _make_row()
        row["timestamp"] = "2026-01-01T00:00:00Z"
        assert _enrich_row(row)["timestamp"] == "2026-01-01T00:00:00Z"

    def test_status_preserved(self):
        row = _make_row()
        row["status"] = "CRITICAL"
        assert _enrich_row(row)["status"] == "CRITICAL"

    def test_device_id_preserved(self):
        result = _enrich_row(_make_row(device_id="sensor-99"))
        assert result["deviceId"] == "sensor-99"


# ---------------------------------------------------------------------------
# make_batch_processor — process_batch inner function
# ---------------------------------------------------------------------------

class TestMakeBatchProcessor:
    def test_returns_callable(self):
        from streaming.processor import make_batch_processor
        fn = make_batch_processor({"bootstrap.servers": "localhost:9092"}, "output-topic")
        assert callable(fn)

    def test_process_batch_skips_empty_dataframe(self):
        from streaming.processor import make_batch_processor
        fn = make_batch_processor({"bootstrap.servers": "localhost:9092"}, "out")
        batch_df = MagicMock()
        batch_df.rdd.isEmpty.return_value = True
        # Should not raise and should not call collect
        fn(batch_df, 0)
        batch_df.collect.assert_not_called()

    def test_process_batch_publishes_enriched_rows(self):
        from streaming.processor import make_batch_processor
        fn = make_batch_processor({"bootstrap.servers": "localhost:9092"}, "out")
        row = {
            "deviceId":     "dev-batch",
            "eventId":      "e-1",
            "timestamp":    "2026-01-01T00:00:00Z",
            "status":       "NORMAL",
            "enrichedData": {
                "temperature":    20.0,
                "humidity":       50.0,
                "vibration":      0.01,
                "deviceType":     "TEMP",
                "deviceLocation": None,
            },
        }
        batch_df = MagicMock()
        batch_df.rdd.isEmpty.return_value = False
        batch_df.collect.return_value = [row]
        # Should not raise
        fn(batch_df, 1)

    def test_process_batch_handles_enrich_exception(self):
        from streaming.processor import make_batch_processor
        fn = make_batch_processor({"bootstrap.servers": "localhost:9092"}, "out")
        # Passing a malformed row (missing required keys) will raise in _enrich_row
        batch_df = MagicMock()
        batch_df.rdd.isEmpty.return_value = False
        batch_df.collect.return_value = [{"unexpected": "keys"}]
        # Should not propagate — exception caught per-row
        fn(batch_df, 2)


    def test_process_batch_raises_when_messages_not_delivered(self):
        """Transient broker failure must fail the batch so Spark retries it."""
        from unittest.mock import patch
        from streaming import processor
        producer = MagicMock()
        producer.flush.return_value = 3  # 3 messages still queued after the timeout
        with patch.object(processor, "Producer", return_value=producer):
            fn = processor.make_batch_processor({"bootstrap.servers": "localhost:9092"}, "out")
        row = {"deviceId": "d", "eventId": "e", "timestamp": "t", "status": "NORMAL",
               "enrichedData": {"temperature": 1.0, "humidity": 1.0, "vibration": 0.0,
                                "deviceType": "T", "deviceLocation": None}}
        batch_df = MagicMock()
        batch_df.rdd.isEmpty.return_value = False
        batch_df.collect.return_value = [row]
        with pytest.raises(RuntimeError):
            fn(batch_df, 9)


# ---------------------------------------------------------------------------
# create_spark_session
# ---------------------------------------------------------------------------

class TestCreateSparkSession:
    def test_returns_spark_session_mock(self):
        from streaming.processor import create_spark_session
        result = create_spark_session(master="local[*]")
        # SparkSession is fully mocked; just verify it returned something non-None
        assert result is not None
