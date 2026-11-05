"""
Data Lake storage module for the IoT ML Platform.
Handles persistence and retrieval of telemetry events using Parquet files partitioned by day.
"""

import os
import logging
import threading
from collections import defaultdict, deque
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any

import pandas as pd

from config.settings import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class DataLake:
    """
    Manages storage and retrieval of telemetry data in a local file-based data lake.
    """
    RECENT_PER_DEVICE = 20
    READ_WORKERS = 8

    def _files_newest_first(self) -> Iterator[str]:
        """
        Yields Parquet paths newest-first without stat-ing every file.

        Partitions are ``day=YYYY-MM-DD`` and file names embed ``HHMMSS_microseconds``,
        so reverse lexicographic order is reverse chronological order.
        """
        try:
            days = sorted((d for d in os.listdir(self.base_path) if d.startswith("day=")), reverse=True)
        except FileNotFoundError:
            return
        seen = False
        for day in days:
            day_path = os.path.join(self.base_path, day)
            for name in sorted(os.listdir(day_path), reverse=True):
                if name.endswith(".parquet"):
                    seen = True
                    yield os.path.join(day_path, name)
        if not seen:  # non-partitioned layout: fall back to a full walk
            found = []
            for root, _, files in os.walk(self.base_path):
                found.extend(os.path.join(root, f) for f in files if f.endswith(".parquet"))
            found.sort(key=os.path.getmtime, reverse=True)
            yield from found

    def _read_files(self, files: list[str]) -> list[pd.DataFrame]:
        """Reads Parquet files concurrently, preserving input order and skipping unreadable ones."""
        def _read(path: str) -> pd.DataFrame | None:
            try:
                return pd.read_parquet(path)
            except Exception as file_error:
                logger.error(f"Error reading Parquet file {path}: {file_error}")
                return None

        with ThreadPoolExecutor(max_workers=self.READ_WORKERS) as pool:
            return [df for df in pool.map(_read, files) if df is not None]

    def __init__(self, base_path: str | None = None):
        """
        Initializes the DataLake and ensures the base storage path exists.

        Args:
            base_path (Optional[str]): Root directory for the data lake storage.
        """
        self.base_path = base_path or settings.DATA_LAKE_PATH
        # Last rows per device, filled at write time, so inference does not have to
        # open Parquet files (one tiny file per event) to build its temporal window.
        self._recent: dict[str, deque] = defaultdict(lambda: deque(maxlen=self.RECENT_PER_DEVICE))
        self._recent_lock = threading.Lock()
        # Devices whose history was already loaded from disk once; the cache is authoritative for them.
        self._scanned: set[str] = set()
        try:
            if not os.path.exists(self.base_path):
                os.makedirs(self.base_path, exist_ok=True)
                logger.info(f"Created data lake base directory at {self.base_path}")
        except Exception as e:
            logger.error(f"Failed to create data lake base directory: {e}")
            raise

    def store_event(self, event_data: dict[str, Any]) -> str | None:
        """
        Stores a single event in the data lake as a Parquet file.
        Enforces inclusion of ML fields and partitioning by date.

        Args:
            event_data (Dict[str, Any]): The telemetry event data to store.

        Returns:
            Optional[str]: Path to the saved Parquet file, or None if storage failed.
        """
        try:
            df = pd.json_normalize(event_data)

            # Manually ensure ML fields are present if they exist in the dict
            for field in ['anomaly_score', 'is_anomaly']:
                if field in event_data and field not in df.columns:
                    df[field] = event_data[field]

            # Add arrival timestamp
            if 'arrival_timestamp' not in df.columns:
                df['arrival_timestamp'] = datetime.now().isoformat()

            # Partition by day for simple data lake structure
            today = datetime.now().strftime("%Y-%m-%d")
            daily_path = os.path.join(self.base_path, f"day={today}")

            if not os.path.exists(daily_path):
                os.makedirs(daily_path, exist_ok=True)

            timestamp_str = datetime.now().strftime("%H%M%S_%f")
            file_path = os.path.join(daily_path, f"event_{timestamp_str}.parquet")

            df.to_parquet(file_path, index=False)
            device_id = event_data.get("deviceId")
            if device_id is not None:
                with self._recent_lock:
                    self._recent[device_id].append(df.iloc[0].to_dict())
            logger.debug(f"Event stored at {file_path}")
            return file_path
        except Exception as e:
            logger.error(f"Error storing event in data lake: {e}", exc_info=True)
            return None

    def get_latest_data(self, limit: int = 1000) -> pd.DataFrame:
        """
        Retrieves the latest data from the data lake across all partitions.

        Args:
            limit (int): Approximate number of records to retrieve.

        Returns:
            pd.DataFrame: A dataframe containing the concatenated records.
        """
        try:
            # Newest files first; a file holds one event, so `limit` files is the right budget.
            files = []
            for path in self._files_newest_first():
                files.append(path)
                if len(files) >= limit:
                    break

            if not files:
                logger.warning("No Parquet files found in data lake.")
                return pd.DataFrame()

            dfs = self._read_files(files)
            if not dfs:
                return pd.DataFrame()

            combined_df = pd.concat(dfs, ignore_index=True)
            logger.info(f"Retrieved {len(combined_df)} records from data lake.")
            return combined_df
        except Exception as e:
            logger.error(f"Error retrieving data from lake: {e}", exc_info=True)
            return pd.DataFrame()

    def get_recent_events_for_device(self, device_id: str, limit: int = 5) -> pd.DataFrame:
        """
        Retrieves the most recent N events for a specific device from the data lake.

        Used to build temporal context for rolling-window feature computation during
        inference. Each stored event has enrichedData.* columns (from json_normalize
        at store time), which are directly compatible with data_processor.prepare_for_ml.

        Args:
            device_id (str): The device identifier to filter events by.
            limit (int): Maximum number of recent events to return.

        Returns:
            pd.DataFrame: Events for the device, sorted oldest-first (for rolling order),
                          or empty DataFrame if none found.
        """
        try:
            with self._recent_lock:
                cached = list(self._recent.get(device_id, ()))
            if len(cached) >= limit or device_id in self._scanned:
                if not cached:
                    return pd.DataFrame()
                combined = pd.DataFrame(cached[-limit:])
                return combined.sort_values('timestamp', ascending=True) if 'timestamp' in combined.columns else combined

            # Cold path (e.g. right after a restart): scan the newest files in batches
            device_events: list[pd.DataFrame] = []
            found = 0
            scanned = 0
            batch: list[str] = []
            for path in self._files_newest_first():
                batch.append(path)
                scanned += 1
                if len(batch) < 32 and scanned < 300:
                    continue
                for df in self._read_files(batch):
                    if 'deviceId' not in df.columns:
                        continue
                    rows = df[df['deviceId'] == device_id]
                    if not rows.empty:
                        device_events.append(rows)
                        found += len(rows)
                batch = []
                if found >= limit or scanned >= 300:
                    break
            if batch:  # tail batch shorter than 32 files when the lake ran out
                for df in self._read_files(batch):
                    if 'deviceId' in df.columns:
                        rows = df[df['deviceId'] == device_id]
                        if not rows.empty:
                            device_events.append(rows)

            if not device_events:
                with self._recent_lock:
                    self._scanned.add(device_id)
                return pd.DataFrame()

            combined = pd.concat(device_events, ignore_index=True)
            # Return oldest-first so rolling windows are in chronological order
            if 'timestamp' in combined.columns:
                combined = combined.sort_values('timestamp', ascending=True)
            combined = combined.tail(limit)
            # Warm the cache so subsequent calls skip the disk
            with self._recent_lock:
                if not self._recent.get(device_id):
                    for row in combined.to_dict("records"):
                        self._recent[device_id].append(row)
                self._scanned.add(device_id)
            return combined
        except Exception as e:
            logger.error(f"Error retrieving recent events for device {device_id}: {e}", exc_info=True)
            return pd.DataFrame()


data_lake = DataLake()
