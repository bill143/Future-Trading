"""
analysis/data/market_data.py
Normalise and validate OHLCV market data.
"""

from __future__ import annotations

import logging
from typing import Optional

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


def normalize_ohlcv(df: pd.DataFrame) -> pd.DataFrame:
    """
    Ensure the DataFrame has standard OHLCV columns, a DatetimeIndex,
    correct dtypes, and no NaN rows.

    Parameters
    ----------
    df : pd.DataFrame
        Raw OHLCV data from any fetcher.

    Returns
    -------
    pd.DataFrame
        Clean, normalised OHLCV DataFrame.
    """
    # Standardise column names to lower-case
    df = df.copy()
    df.columns = [c.lower() for c in df.columns]

    # Rename common variants
    rename_map = {
        "open": "open",
        "high": "high",
        "low": "low",
        "close": "close",
        "volume": "volume",
        "vol": "volume",
        "adj close": "close",
        "adj_close": "close",
    }
    df = df.rename(columns=rename_map)

    required = ["open", "high", "low", "close"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required OHLCV columns: {missing}")

    if "volume" not in df.columns:
        df["volume"] = np.nan

    # Ensure DatetimeIndex
    if not isinstance(df.index, pd.DatetimeIndex):
        try:
            df.index = pd.to_datetime(df.index)
        except Exception as exc:
            raise ValueError(f"Cannot convert index to DatetimeIndex: {exc}") from exc

    # Cast numeric columns
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Drop rows where OHLC are all NaN
    df = df.dropna(subset=required)

    # Sort ascending by time
    df = df.sort_index()

    return df[["open", "high", "low", "close", "volume"]]


def validate_ohlcv(df: pd.DataFrame) -> tuple[bool, list[str]]:
    """
    Run basic sanity checks on normalised OHLCV data.

    Returns
    -------
    (is_valid, issues)
    """
    issues: list[str] = []

    if df.empty:
        issues.append("DataFrame is empty.")
        return False, issues

    if len(df) < 20:
        issues.append(f"Too few bars: {len(df)} (minimum 20 required).")

    # High >= Low
    bad_hl = (df["high"] < df["low"]).sum()
    if bad_hl:
        issues.append(f"{bad_hl} rows where high < low.")

    # Close within [low, high]
    bad_close = ((df["close"] < df["low"]) | (df["close"] > df["high"])).sum()
    if bad_close:
        issues.append(f"{bad_close} rows where close is outside [low, high].")

    # No negative prices
    neg = (df[["open", "high", "low", "close"]] <= 0).any(axis=1).sum()
    if neg:
        issues.append(f"{neg} rows with non-positive prices.")

    return len(issues) == 0, issues


def resample_to_4h(df: pd.DataFrame) -> pd.DataFrame:
    """Resample 1-hour OHLCV data to 4-hour bars."""
    resampled = df.resample("4h").agg(
        {
            "open":   "first",
            "high":   "max",
            "low":    "min",
            "close":  "last",
            "volume": "sum",
        }
    ).dropna(subset=["open", "close"])
    return resampled


def get_latest_price(df: pd.DataFrame) -> Optional[float]:
    """Return the most recent close price, or None if the DataFrame is empty."""
    if df.empty:
        return None
    return float(df["close"].iloc[-1])
