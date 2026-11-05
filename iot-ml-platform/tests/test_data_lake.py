import time

from storage.data_lake import DataLake


def _event(device, n, ts=None):
    return {"deviceId": device, "timestamp": ts or f"2026-01-01T00:00:{n:02d}", "enrichedData": {"temperature": 20.0 + n}}


def test_latest_data_newest_first_and_limited(tmp_path):
    lake = DataLake(str(tmp_path))
    for i in range(6):
        lake.store_event(_event("a", i))
        time.sleep(0.002)
    df = lake.get_latest_data(limit=3)
    assert len(df) == 3
    # newest events first
    assert list(df["enrichedData.temperature"]) == [25.0, 24.0, 23.0]


def test_recent_events_from_memory_cache_oldest_first(tmp_path):
    lake = DataLake(str(tmp_path))
    for i in range(8):
        lake.store_event(_event("a", i))
        lake.store_event(_event("b", i))
    df = lake.get_recent_events_for_device("a", limit=5)
    assert list(df["enrichedData.temperature"]) == [23.0, 24.0, 25.0, 26.0, 27.0]
    assert set(df["deviceId"]) == {"a"}


def test_recent_events_cold_start_reads_disk_and_warms_cache(tmp_path):
    writer = DataLake(str(tmp_path))
    for i in range(6):
        writer.store_event(_event("a", i))
        time.sleep(0.002)
    reader = DataLake(str(tmp_path))  # fresh instance == restart, empty cache
    df = reader.get_recent_events_for_device("a", limit=4)
    assert list(df["enrichedData.temperature"]) == [22.0, 23.0, 24.0, 25.0]
    assert len(reader._recent["a"]) == 4  # cache warmed


def test_unknown_device_returns_empty(tmp_path):
    lake = DataLake(str(tmp_path))
    lake.store_event(_event("a", 1))
    assert lake.get_recent_events_for_device("nope").empty
