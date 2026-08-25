"""
analysis/indicators/price_action.py
Support/resistance detection, swing highs/lows, and basic candlestick patterns.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from analysis.config.config import SR_LOOKBACK, SR_PROXIMITY_PCT, SWING_LOOKBACK


# ── Swing Highs / Lows ────────────────────────────────────────────────────

def find_swing_highs(df: pd.DataFrame, lookback: int = SWING_LOOKBACK) -> pd.Series:
    """Return a boolean Series that is True at swing high bars."""
    high = df["high"]
    swing_indices: list[int] = []
    for i in range(lookback, len(high) - lookback):
        window = high.iloc[i - lookback: i + lookback + 1]
        if high.iloc[i] == window.max():
            swing_indices.append(i)
    is_swing = pd.Series(False, index=high.index)
    if swing_indices:
        is_swing.iloc[swing_indices] = True
    return is_swing


def find_swing_lows(df: pd.DataFrame, lookback: int = SWING_LOOKBACK) -> pd.Series:
    """Return a boolean Series that is True at swing low bars."""
    low = df["low"]
    swing_indices: list[int] = []
    for i in range(lookback, len(low) - lookback):
        window = low.iloc[i - lookback: i + lookback + 1]
        if low.iloc[i] == window.min():
            swing_indices.append(i)
    is_swing = pd.Series(False, index=low.index)
    if swing_indices:
        is_swing.iloc[swing_indices] = True
    return is_swing


def get_recent_swings(df: pd.DataFrame, n: int = 5) -> dict[str, list[float]]:
    """Return the n most recent swing high and swing low price levels."""
    sh = find_swing_highs(df)
    sl = find_swing_lows(df)
    swing_highs = df.loc[sh, "high"].tail(n).tolist()
    swing_lows  = df.loc[sl, "low"].tail(n).tolist()
    return {"swing_highs": swing_highs, "swing_lows": swing_lows}


# ── Support / Resistance ──────────────────────────────────────────────────

def detect_support_resistance(
    df: pd.DataFrame,
    lookback: int = SR_LOOKBACK,
) -> dict[str, list[float]]:
    """
    Identify significant support and resistance levels from swing highs/lows
    within the most recent `lookback` bars.
    """
    subset = df.tail(lookback).copy()
    sh = find_swing_highs(subset)
    sl = find_swing_lows(subset)

    resistance_levels = sorted(subset.loc[sh, "high"].unique().tolist(), reverse=True)
    support_levels    = sorted(subset.loc[sl, "low"].unique().tolist(), reverse=True)

    # Cluster levels that are within SR_PROXIMITY_PCT of each other
    def cluster(levels: list[float]) -> list[float]:
        if not levels:
            return []
        clustered: list[float] = [levels[0]]
        for lvl in levels[1:]:
            if abs(lvl - clustered[-1]) / clustered[-1] > SR_PROXIMITY_PCT:
                clustered.append(lvl)
        return clustered

    return {
        "resistance": cluster(resistance_levels),
        "support": cluster(support_levels),
    }


def nearest_levels(
    price: float,
    sr: dict[str, list[float]],
    n: int = 3,
) -> dict[str, list[float]]:
    """Return the n closest support levels below and resistance levels above price."""
    below = sorted([s for s in sr["support"] if s < price], reverse=True)[:n]
    above = sorted([r for r in sr["resistance"] if r > price])[:n]
    return {"support": below, "resistance": above}


# ── Market Structure ──────────────────────────────────────────────────────

def detect_market_structure(df: pd.DataFrame) -> dict[str, Any]:
    """
    Identify the current market structure based on recent swing sequence.
    Returns structure type and the last four swing points.
    """
    sh = find_swing_highs(df)
    sl = find_swing_lows(df)

    highs = df.loc[sh, "high"].tolist()
    lows  = df.loc[sl, "low"].tolist()

    structure = "ranging"
    if len(highs) >= 2 and len(lows) >= 2:
        hh = highs[-1] > highs[-2]  # higher high
        hl = lows[-1]  > lows[-2]   # higher low
        lh = highs[-1] < highs[-2]  # lower high
        ll = lows[-1]  < lows[-2]   # lower low

        if hh and hl:
            structure = "uptrend"
        elif lh and ll:
            structure = "downtrend"
        elif hh and ll:
            structure = "expansion"

    return {
        "structure": structure,
        "recent_highs": highs[-4:] if highs else [],
        "recent_lows":  lows[-4:]  if lows  else [],
    }


# ── Candlestick Patterns ──────────────────────────────────────────────────

def detect_candlestick_patterns(df: pd.DataFrame) -> list[str]:
    """
    Detect basic candlestick patterns on the last few bars.
    Returns a list of pattern names detected.
    """
    if len(df) < 3:
        return []

    patterns: list[str] = []
    o = df["open"].values
    h = df["high"].values
    lo = df["low"].values
    c = df["close"].values

    # Last bar
    i = -1
    body     = abs(c[i] - o[i])
    rng      = h[i] - lo[i]
    upper_wick = h[i] - max(c[i], o[i])
    lower_wick = min(c[i], o[i]) - lo[i]

    # Doji
    if rng > 0 and body / rng < 0.1:
        patterns.append("doji")

    # Hammer (bullish)
    if (body > 0 and lower_wick >= 2 * body and upper_wick < body
            and c[i] > o[i]):
        patterns.append("hammer")

    # Shooting star (bearish)
    if (body > 0 and upper_wick >= 2 * body and lower_wick < body
            and c[i] < o[i]):
        patterns.append("shooting_star")

    # Bullish engulfing
    if (len(df) >= 2
            and c[i-1] < o[i-1]   # previous bar bearish
            and c[i]   > o[i]     # current bar bullish
            and o[i]   < c[i-1]   # opens below previous close
            and c[i]   > o[i-1]): # closes above previous open
        patterns.append("bullish_engulfing")

    # Bearish engulfing
    if (len(df) >= 2
            and c[i-1] > o[i-1]
            and c[i]   < o[i]
            and o[i]   > c[i-1]
            and c[i]   < o[i-1]):
        patterns.append("bearish_engulfing")

    # Morning star (3-bar)
    if len(df) >= 3:
        i1, i2, i3 = -3, -2, -1
        bear = c[i1] < o[i1]
        small_body = abs(c[i2] - o[i2]) < (h[i2] - lo[i2]) * 0.3
        bull = c[i3] > o[i3]
        if bear and small_body and bull and c[i3] > (o[i1] + c[i1]) / 2:
            patterns.append("morning_star")

    # Evening star (3-bar)
    if len(df) >= 3:
        i1, i2, i3 = -3, -2, -1
        bull = c[i1] > o[i1]
        small_body = abs(c[i2] - o[i2]) < (h[i2] - lo[i2]) * 0.3
        bear = c[i3] < o[i3]
        if bull and small_body and bear and c[i3] < (o[i1] + c[i1]) / 2:
            patterns.append("evening_star")

    return patterns


def price_action_summary(df: pd.DataFrame) -> dict[str, Any]:
    """Build a combined price action summary dict."""
    swings    = get_recent_swings(df)
    sr        = detect_support_resistance(df)
    structure = detect_market_structure(df)
    patterns  = detect_candlestick_patterns(df)
    price     = float(df["close"].iloc[-1])
    nearby    = nearest_levels(price, sr)

    return {
        **swings,
        **structure,
        "nearest_support":    nearby["support"],
        "nearest_resistance": nearby["resistance"],
        "all_support":        sr["support"],
        "all_resistance":     sr["resistance"],
        "candlestick_patterns": patterns,
    }


def price_action_to_summary_str(pa: dict[str, Any]) -> str:
    """Format price action dict as human-readable string for LLM prompts."""
    lines = [
        f"  Market Structure: {pa.get('structure', 'unknown')}",
        f"  Recent Swing Highs: {pa.get('swing_highs', [])}",
        f"  Recent Swing Lows: {pa.get('swing_lows', [])}",
        f"  Nearest Resistance: {pa.get('nearest_resistance', [])}",
        f"  Nearest Support:    {pa.get('nearest_support', [])}",
        f"  Candlestick Patterns: {pa.get('candlestick_patterns', [])}",
    ]
    return "\n".join(lines)
