"""
Z-score based anomaly detection model.

Uses rolling mean and std from Spark-computed sparkFeatures to detect
sensor readings that deviate significantly from the device's recent baseline.
Falls back gracefully when sparkFeatures are absent (z-score = 0).

Result dict
-----------
{
    "is_anomaly": bool,
    "max_zscore": float,
    "scores": {
        "temperature": float,
        "humidity":    float,
        "vibration":   float,
    }
}
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_THRESHOLD = 3.0


class ZScoreModel:
    """
    Flags an event as anomalous when any sensor's z-score exceeds *threshold*
    standard deviations from the rolling mean.
    """

    def __init__(self, threshold: float = DEFAULT_THRESHOLD) -> None:
        self.threshold = threshold

    def predict(self, event: dict[str, Any]) -> dict[str, Any]:
        spark = event.get("sparkFeatures", {})
        data  = event.get("enrichedData",  {})

        temp = float(data.get("temperature", 0.0))
        hum  = float(data.get("humidity",    0.0))
        vib  = float(data.get("vibration",   0.0))

        temp_mean = float(spark.get("temp_mean", temp))
        temp_std  = float(spark.get("temp_std",  0.0))
        hum_mean  = float(spark.get("hum_mean",  hum))
        hum_std   = float(spark.get("hum_std",   0.0))
        vib_mean  = float(spark.get("vib_mean",  vib))
        vib_std   = float(spark.get("vib_std",   0.0))

        z_temp = abs(temp - temp_mean) / temp_std if temp_std > 0 else 0.0
        z_hum  = abs(hum  - hum_mean)  / hum_std  if hum_std  > 0 else 0.0
        z_vib  = abs(vib  - vib_mean)  / vib_std  if vib_std  > 0 else 0.0

        max_zscore = max(z_temp, z_hum, z_vib)
        is_anomaly = max_zscore > self.threshold

        return {
            "is_anomaly": is_anomaly,
            "max_zscore": round(max_zscore, 3),
            "scores": {
                "temperature": round(z_temp, 3),
                "humidity":    round(z_hum,  3),
                "vibration":   round(z_vib,  3),
            },
        }
