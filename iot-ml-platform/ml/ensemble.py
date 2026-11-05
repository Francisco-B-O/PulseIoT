"""
Ensemble decision engine for multi-model anomaly detection.

Combines Isolation Forest, Z-score, and Trend model outputs via weighted
majority voting to produce a final anomaly decision with severity level
and a human-readable explanation.

Weights
-------
    Isolation Forest  x 2   (unsupervised, learns normal patterns from history)
    Z-score           x 1   (statistical, detects value outliers)
    Trend             x 1   (temporal,    detects escalation patterns)

An anomaly is declared when total weighted votes >= VOTE_THRESHOLD (2).

Severity mapping (by total votes)
----------------------------------
    0      -> NORMAL
    1      -> LOW
    2-3    -> HIGH
    4      -> CRITICAL
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

_WEIGHTS: dict[str, int] = {
    "isolation": 2,
    "zscore":    1,
    "trend":     1,
}

VOTE_THRESHOLD = 2
MAX_VOTES      = sum(_WEIGHTS.values())  # 4


def _severity(votes: int) -> str:
    if votes == 0:
        return "NORMAL"
    if votes == 1:
        return "LOW"
    if votes <= MAX_VOTES - 1:
        return "HIGH"
    return "CRITICAL"


def _build_reason(
    if_result: dict[str, Any],
    zs_result: dict[str, Any],
    tr_result: dict[str, Any],
) -> str:
    parts: list[str] = []

    if if_result["is_anomaly"]:
        parts.append(
            f"Isolation Forest score {if_result['score']:.3f} below threshold"
        )
    if zs_result["is_anomaly"]:
        parts.append(
            f"Z-score {zs_result['max_zscore']:.1f}\u03c3 exceeds 3\u03c3 threshold"
        )
    if tr_result["is_anomaly"]:
        parts.append(
            f"Rapidly {tr_result['trend']} temperature "
            f"(range {tr_result['temp_range']}\u00b0C, \u03c3={tr_result['temp_std']}\u00b0C)"
        )

    return "; ".join(parts) if parts else "All models nominal"


class EnsembleDecision:
    """
    Aggregates the three model results into a single prediction with
    severity, scores, reason, and per-feature breakdown.
    """

    def decide(
        self,
        if_result: dict[str, Any],
        zs_result: dict[str, Any],
        tr_result: dict[str, Any],
    ) -> dict[str, Any]:
        votes = (
            _WEIGHTS["isolation"] * int(if_result["is_anomaly"])
            + _WEIGHTS["zscore"]  * int(zs_result["is_anomaly"])
            + _WEIGHTS["trend"]   * int(tr_result["is_anomaly"])
        )
        is_anomaly = votes >= VOTE_THRESHOLD

        return {
            "anomaly":  is_anomaly,
            "severity": _severity(votes),
            "scores": {
                "isolation": if_result["score"],
                "zscore":    zs_result["max_zscore"],
                "trend":     tr_result["is_anomaly"],
            },
            "reason": _build_reason(if_result, zs_result, tr_result),
            "features": {
                "isolation_score":  if_result["score"],
                "zscore_breakdown": zs_result.get("scores", {}),
                "trend_info": {
                    "trend":      tr_result.get("trend"),
                    "temp_std":   tr_result.get("temp_std"),
                    "temp_range": tr_result.get("temp_range"),
                },
            },
        }
