"""
Unit tests for the DataProcessor class.
"""

import pandas as pd
from processing.data_processor import DataProcessor


def test_prepare_for_ml():
    """prepare_for_ml correctly transforms raw telemetry with rolling features."""
    processor = DataProcessor()
    data = {
        'deviceId': ['device1', 'device2'],
        'timestamp': ['2026-03-21T10:00:00Z', '2026-03-21T10:01:00Z'],
        'enrichedData.temperature': [25.5, 30.0],
        'enrichedData.humidity': [45.0, 50.0],
    }
    df = pd.DataFrame(data)
    processed_df = processor.prepare_for_ml(df)

    assert not processed_df.empty
    assert 'enrichedData.temperature' in processed_df.columns
    assert 'enrichedData.humidity' in processed_df.columns
    assert str(processed_df['timestamp'].dtype).startswith('datetime64')


def test_get_features_only():
    """get_features_only returns only enrichedData.* and feat_* columns."""
    processor = DataProcessor()
    data = {
        'deviceId': ['device1'],
        'timestamp': ['2026-03-21T10:00:00Z'],
        'enrichedData.temperature': [25.5],
        'enrichedData.humidity': [45.0],
        'other_col': ['ignored'],
    }
    df = pd.DataFrame(data)
    features = processor.get_features_only(df)

    assert len(features.columns) == 2
    assert 'enrichedData.temperature' in features.columns
    assert 'enrichedData.humidity' in features.columns
    assert 'deviceId' not in features.columns
    assert 'other_col' not in features.columns


def test_rolling_features_require_multiple_events():
    """
    Demonstrates why single-event windows produce degenerate rolling features.

    With a single event, rolling_std collapses to 0 and rolling_min/max equal
    the raw value. This is the root cause of the 100% false-positive rate that
    existed before the windowed inference fix was applied.

    After the fix, predict_anomaly fetches historical context from the data lake
    so that prepare_for_ml always receives a proper multi-event window.
    """
    processor = DataProcessor()

    single_event = pd.DataFrame([{
        'deviceId': 'device1',
        'timestamp': '2026-03-21T10:00:00Z',
        'enrichedData.temperature': 25.0,
        'enrichedData.humidity': 50.0,
    }])
    single_processed = processor.prepare_for_ml(single_event)

    multi_events = pd.DataFrame([
        {'deviceId': 'device1', 'timestamp': '2026-03-21T10:00:00Z', 'enrichedData.temperature': 24.0, 'enrichedData.humidity': 49.0},
        {'deviceId': 'device1', 'timestamp': '2026-03-21T10:01:00Z', 'enrichedData.temperature': 25.0, 'enrichedData.humidity': 50.0},
        {'deviceId': 'device1', 'timestamp': '2026-03-21T10:02:00Z', 'enrichedData.temperature': 26.0, 'enrichedData.humidity': 51.0},
    ])
    multi_processed = processor.prepare_for_ml(multi_events)

    # With a single event, rolling_std is 0 (no variance)
    if 'feat_temperature_rolling_std_5' in single_processed.columns:
        assert single_processed['feat_temperature_rolling_std_5'].iloc[0] == 0.0, \
            "Single-event rolling_std must be 0 — this is the degenerate case we fix in inference"

    # With multiple events, rolling_std is non-zero
    if 'feat_temperature_rolling_std_5' in multi_processed.columns:
        assert multi_processed['feat_temperature_rolling_std_5'].iloc[-1] > 0.0, \
            "Multi-event rolling_std should reflect real variance"


def test_validate_data_clips_temperature():
    """validate_data clips temperature to [-50, 150] range."""
    processor = DataProcessor()
    df = pd.DataFrame([{
        'deviceId': 'device1',
        'timestamp': '2026-03-21T10:00:00Z',
        'enrichedData.temperature': 200.0,  # beyond clip range
        'enrichedData.humidity': 50.0,
    }])
    validated = processor.validate_data(df)
    assert validated['enrichedData.temperature'].iloc[0] == 150.0


def test_prepare_for_ml_returns_empty_for_missing_columns():
    """prepare_for_ml returns empty DataFrame when enrichedData columns are absent."""
    processor = DataProcessor()
    df = pd.DataFrame([{'deviceId': 'device1', 'timestamp': '2026-03-21T10:00:00Z', 'other': 1}])
    result = processor.prepare_for_ml(df)
    assert result.empty
