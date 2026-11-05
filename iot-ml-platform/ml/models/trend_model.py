"""
Trend-based anomaly detection model.

Detects escalating conditions (e.g. motor overheating) by combining the
directional trend from Spark with high variance and a wide temperature range.
This catches gradual runaway scenarios that point-in-time models can miss.

An event is flagged when ALL three conditions hold simultaneously:
    1. Spark-computed trend == "increasing"
    2. Rolling temp std  > std_threshold
    3. Rolling temp range > range_threshold

Result dict
-----------
{
    "is_anomaly": bool,
    "trend":       str,    # "increasing" | "decreasing" | "stable"
    "temp_std":    float,
    "temp_range":  float,
}
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class TrendModel:
    def __init__(
        self,
        std_threshold: float   = 5.0,
        range_threshold: float = 10.0,
    ) -> None:
        self.std_threshold   = std_threshold
        self.range_threshold = range_threshold

    def predict(self, event: dict[str, Any]) -> dict[str, Any]:
        spark = event.get("sparkFeatures", {})

        trend      = spark.get("trend",      "stable")
        temp_std   = float(spark.get("temp_std",   0.0))
        temp_range = float(spark.get("temp_range", 0.0))

        is_anomaly = (
            trend == "increasing"
            and temp_std   > self.std_threshold
            and temp_range > self.range_threshold
        )

        return {
            "is_anomaly": is_anomaly,
            "trend":      trend,
            "temp_std":   round(temp_std,   3),
            "temp_range": round(temp_range, 3),
        }
