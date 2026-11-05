"""
Pure-Python feature engineering for IoT telemetry windows.

No PySpark dependency — fully unit-testable without a running Spark context.
The Spark processor delegates all business logic here, keeping the two layers
cleanly separated:

    streaming.features  →  feature computation  (pure Python + numpy)
    streaming.processor →  Spark plumbing        (PySpark Structured Streaming)
"""
from __future__ import annotations

from collections import defaultdict, deque
from typing import Any

import numpy as np


class DeviceWindowState:
    """
    Maintains a capped rolling window of telemetry readings per device
    and computes descriptive statistics on demand.

    Thread-safety: callers are responsible for external locking when
    multiple threads share the same instance (see processor.py).
    """

    def __init__(self, window_size: int = 20) -> None:
        self.window_size = window_size
        self._windows: dict[str, deque] = defaultdict(
            lambda: deque(maxlen=window_size)
        )

    # ------------------------------------------------------------------
    # Mutation
    # ------------------------------------------------------------------

    def update(self, device_id: str, reading: dict[str, float]) -> None:
        """Append a new sensor reading to the device's rolling window."""
        self._windows[device_id].append(reading)

    # ------------------------------------------------------------------
    # Query
    # ------------------------------------------------------------------

    def compute_features(self, device_id: str) -> dict[str, Any]:
        """
        Compute descriptive statistics over the current rolling window.

        Returns an empty dict if no data exists for the device yet.
        """
        window = list(self._windows[device_id])
        if not window:
            return {}

        temps = [e.get("temperature", 0.0) for e in window]
        hums  = [e.get("humidity",    0.0) for e in window]
        vibs  = [e.get("vibration",   0.0) for e in window]

        # Simple point-to-point trend from the two most recent readings
        if len(temps) >= 2:
            if temps[-1] > temps[-2]:
                trend = "increasing"
            elif temps[-1] < temps[-2]:
                trend = "decreasing"
            else:
                trend = "stable"
        else:
            trend = "stable"

        return {
            "temp_mean":   float(np.mean(temps)),
            "temp_std":    float(np.std(temps)),
            "temp_min":    float(np.min(temps)),
            "temp_max":    float(np.max(temps)),
            "temp_range":  float(np.max(temps) - np.min(temps)),
            "hum_mean":    float(np.mean(hums)),
            "hum_std":     float(np.std(hums)),
            "vib_mean":    float(np.mean(vibs)),
            "vib_std":     float(np.std(vibs)),
            "event_count": len(window),
            "trend":       trend,
        }

    def get_window_size(self, device_id: str) -> int:
        """Return the number of readings currently held for a device."""
        return len(self._windows[device_id])
