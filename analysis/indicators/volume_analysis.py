"""
analysis/indicators/volume_analysis.py
Volume profile and conviction scoring.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


def volume_summary(df: pd.DataFrame, lookback: int = 20) -> dict[str, Any]:
    """
    Compare the most recent bar's volume to the rolling average and
    compute a conviction score.

    Returns
    -------
    dict with keys:
      current_volume, avg_volume, volume_ratio, conviction, rising_volume
    """
    if "volume" not in df.columns or df["volume"].isna().all():
        return {
            "current_volume": None,
            "avg_volume": None,
            "volume_ratio": None,
            "conviction": "unknown",
            "rising_volume": None,
        }

    vol = df["volume"].dropna()
    if vol.empty:
        return {
            "current_volume": None,
            "avg_volume": None,
            "volume_ratio": None,
            "conviction": "unknown",
            "rising_volume": None,
        }

    current    = float(vol.iloc[-1])
    avg        = float(vol.tail(lookback).mean())
    ratio      = current / avg if avg > 0 else None

    if ratio is None:
        conviction = "unknown"
    elif ratio >= 1.5:
        conviction = "high"
    elif ratio >= 0.8:
        conviction = "normal"
    else:
        conviction = "low"

    # Check if volume is trending up over last 5 bars
    rising_volume = None
    if len(vol) >= 5:
        recent = vol.tail(5).values
        rising_volume = bool(np.polyfit(range(5), recent, 1)[0] > 0)

    return {
        "current_volume": current,
        "avg_volume": avg,
        "volume_ratio": ratio,
        "conviction": conviction,
        "rising_volume": rising_volume,
    }


def volume_profile(
    df: pd.DataFrame,
    bins: int = 20,
) -> dict[str, Any]:
    """
    Build a simple volume-at-price profile over the entire DataFrame.

    Returns the price bin with highest volume (Point of Control) and
    the value area (70 % of volume) high and low.
    """
    if df.empty or df["volume"].isna().all():
        return {"poc": None, "vah": None, "val": None}

    price_min = df["low"].min()
    price_max = df["high"].max()
    bin_edges = np.linspace(price_min, price_max, bins + 1)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2

    vol_per_bin = np.zeros(bins)
    # Vectorised approach: for each bar assign its volume to overlapping bins
    for idx in range(len(df)):
        row_low  = df["low"].iat[idx]
        row_high = df["high"].iat[idx]
        row_vol  = df["volume"].iat[idx]
        if np.isnan(row_vol):
            continue
        overlapping = np.where(
            (bin_edges[1:] >= row_low) & (bin_edges[:-1] <= row_high)
        )[0]
        if len(overlapping):
            vol_per_bin[overlapping] += row_vol / len(overlapping)

    poc_idx = int(np.argmax(vol_per_bin))
    poc     = float(bin_centers[poc_idx])

    # Value area: 70 % of total volume centred on POC
    total_vol  = vol_per_bin.sum()
    target_vol = total_vol * 0.70
    lo_idx = hi_idx = poc_idx
    accumulated = vol_per_bin[poc_idx]
    while accumulated < target_vol:
        expand_lo = lo_idx > 0
        expand_hi = hi_idx < bins - 1
        if not expand_lo and not expand_hi:
            break
        lo_add = vol_per_bin[lo_idx - 1] if expand_lo else 0
        hi_add = vol_per_bin[hi_idx + 1] if expand_hi else 0
        if lo_add >= hi_add:
            lo_idx -= 1
            accumulated += lo_add
        else:
            hi_idx += 1
            accumulated += hi_add

    return {
        "poc":  poc,
        "vah":  float(bin_centers[hi_idx]),
        "val":  float(bin_centers[lo_idx]),
    }


def volume_to_summary_str(vs: dict[str, Any]) -> str:
    lines = [
        f"  Current Volume: {vs.get('current_volume')}",
        f"  Avg Volume ({20} bars): {vs.get('avg_volume')}",
        f"  Volume Ratio (vs avg): {vs.get('volume_ratio')}",
        f"  Conviction: {vs.get('conviction')}",
        f"  Rising Volume: {vs.get('rising_volume')}",
    ]
    return "\n".join(l for l in lines if not l.endswith(": None"))
