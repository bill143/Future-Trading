"""
analysis/indicators/technical_indicators.py
Compute core technical indicators on a normalised OHLCV DataFrame.
All functions accept a normalised DataFrame and return a dict of scalar values
(the latest bar's reading) plus a DataFrame column for historical values.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd

from analysis.config.config import (
    ATR_PERIOD,
    BB_PERIOD, BB_STD,
    MA_FAST, MA_MID, MA_SLOW,
    MACD_FAST, MACD_SLOW, MACD_SIGNAL,
    RSI_OVERBOUGHT, RSI_OVERSOLD, RSI_PERIOD,
    STOCH_D, STOCH_K, STOCH_OVERBOUGHT, STOCH_OVERSOLD, STOCH_SMOOTH,
)

logger = logging.getLogger(__name__)


# ── RSI ───────────────────────────────────────────────────────────────────

def compute_rsi(close: pd.Series, period: int = RSI_PERIOD) -> pd.Series:
    """Wilder's RSI."""
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def rsi_reading(df: pd.DataFrame) -> dict[str, Any]:
    rsi = compute_rsi(df["close"])
    latest = float(rsi.iloc[-1]) if not rsi.empty else None
    signal = (
        "oversold" if latest is not None and latest < RSI_OVERSOLD
        else "overbought" if latest is not None and latest > RSI_OVERBOUGHT
        else "neutral"
    )
    return {"rsi": latest, "rsi_signal": signal, "_series": rsi}


# ── MACD ──────────────────────────────────────────────────────────────────

def compute_macd(
    close: pd.Series,
    fast: int = MACD_FAST,
    slow: int = MACD_SLOW,
    signal: int = MACD_SIGNAL,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Returns (macd_line, signal_line, histogram)."""
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    hist = macd_line - signal_line
    return macd_line, signal_line, hist


def macd_reading(df: pd.DataFrame) -> dict[str, Any]:
    macd, sig, hist = compute_macd(df["close"])
    latest_macd = float(macd.iloc[-1]) if not macd.empty else None
    latest_hist  = float(hist.iloc[-1]) if not hist.empty else None
    prev_hist    = float(hist.iloc[-2]) if len(hist) >= 2 else None

    crossover = None
    if latest_hist is not None and prev_hist is not None:
        if prev_hist < 0 <= latest_hist:
            crossover = "bullish_crossover"
        elif prev_hist > 0 >= latest_hist:
            crossover = "bearish_crossover"
        elif latest_hist > 0:
            crossover = "bullish"
        else:
            crossover = "bearish"

    return {
        "macd": latest_macd,
        "macd_signal": float(sig.iloc[-1]) if not sig.empty else None,
        "macd_hist": latest_hist,
        "macd_crossover": crossover,
        "_series": {"macd": macd, "signal": sig, "hist": hist},
    }


# ── Stochastic ────────────────────────────────────────────────────────────

def compute_stochastic(
    df: pd.DataFrame,
    k: int = STOCH_K,
    d: int = STOCH_D,
    smooth: int = STOCH_SMOOTH,
) -> tuple[pd.Series, pd.Series]:
    low_min  = df["low"].rolling(k).min()
    high_max = df["high"].rolling(k).max()
    raw_k = 100 * (df["close"] - low_min) / (high_max - low_min).replace(0, np.nan)
    k_smooth = raw_k.rolling(smooth).mean()
    d_smooth = k_smooth.rolling(d).mean()
    return k_smooth, d_smooth


def stochastic_reading(df: pd.DataFrame) -> dict[str, Any]:
    k, d = compute_stochastic(df)
    latest_k = float(k.iloc[-1]) if not k.empty else None
    signal = (
        "oversold" if latest_k is not None and latest_k < STOCH_OVERSOLD
        else "overbought" if latest_k is not None and latest_k > STOCH_OVERBOUGHT
        else "neutral"
    )
    return {
        "stoch_k": latest_k,
        "stoch_d": float(d.iloc[-1]) if not d.empty else None,
        "stoch_signal": signal,
        "_series": {"k": k, "d": d},
    }


# ── ATR ───────────────────────────────────────────────────────────────────

def compute_atr(df: pd.DataFrame, period: int = ATR_PERIOD) -> pd.Series:
    high  = df["high"]
    low   = df["low"]
    prev_close = df["close"].shift(1)
    tr = pd.concat(
        [high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1
    ).max(axis=1)
    return tr.ewm(alpha=1 / period, adjust=False).mean()


def atr_reading(df: pd.DataFrame) -> dict[str, Any]:
    atr = compute_atr(df)
    latest = float(atr.iloc[-1]) if not atr.empty else None
    pct = (latest / float(df["close"].iloc[-1]) * 100) if latest else None
    return {"atr": latest, "atr_pct": pct, "_series": atr}


# ── Bollinger Bands ───────────────────────────────────────────────────────

def compute_bollinger(
    close: pd.Series,
    period: int = BB_PERIOD,
    std: float = BB_STD,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    mid   = close.rolling(period).mean()
    sigma = close.rolling(period).std()
    upper = mid + std * sigma
    lower = mid - std * sigma
    return upper, mid, lower


def bollinger_reading(df: pd.DataFrame) -> dict[str, Any]:
    upper, mid, lower = compute_bollinger(df["close"])
    price = float(df["close"].iloc[-1])
    u = float(upper.iloc[-1]) if not upper.empty else None
    m = float(mid.iloc[-1])   if not mid.empty  else None
    lo = float(lower.iloc[-1]) if not lower.empty else None

    position = None
    if u is not None and lo is not None:
        if price >= u:
            position = "above_upper"
        elif price <= lo:
            position = "below_lower"
        elif mid is not None and price > m:
            position = "upper_half"
        else:
            position = "lower_half"

    band_width = ((u - lo) / m * 100) if (u is not None and lo is not None and m is not None) else None

    return {
        "bb_upper": u,
        "bb_mid": m,
        "bb_lower": lo,
        "bb_position": position,
        "bb_bandwidth": band_width,
        "_series": {"upper": upper, "mid": mid, "lower": lower},
    }


# ── Moving Averages ───────────────────────────────────────────────────────

def moving_average_reading(df: pd.DataFrame) -> dict[str, Any]:
    close = df["close"]
    price = float(close.iloc[-1])

    def sma(n: int) -> float | None:
        s = close.rolling(n).mean()
        return float(s.iloc[-1]) if len(close) >= n else None

    def ema(n: int) -> float | None:
        e = close.ewm(span=n, adjust=False).mean()
        return float(e.iloc[-1]) if len(close) >= 2 else None

    sma20, sma50, sma200 = sma(MA_FAST), sma(MA_MID), sma(MA_SLOW)
    ema20, ema50, ema200 = ema(MA_FAST), ema(MA_MID), ema(MA_SLOW)

    trend = "neutral"
    if sma20 and sma50 and sma200:
        if price > sma20 > sma50 > sma200:
            trend = "strong_uptrend"
        elif price > sma20 and price > sma50:
            trend = "uptrend"
        elif price < sma20 < sma50 < sma200:
            trend = "strong_downtrend"
        elif price < sma20 and price < sma50:
            trend = "downtrend"

    return {
        "sma20": sma20, "sma50": sma50, "sma200": sma200,
        "ema20": ema20, "ema50": ema50, "ema200": ema200,
        "ma_trend": trend,
    }


# ── All indicators in one call ────────────────────────────────────────────

def compute_all_indicators(df: pd.DataFrame) -> dict[str, Any]:
    """
    Compute all technical indicators and return a combined dict
    (without internal _series keys).
    """
    result: dict[str, Any] = {}

    for fn in [rsi_reading, macd_reading, stochastic_reading,
               atr_reading, bollinger_reading, moving_average_reading]:
        try:
            r = fn(df)
            # Strip internal series objects
            for k, v in r.items():
                if not k.startswith("_"):
                    result[k] = v
        except Exception as exc:
            logger.warning("Indicator error in %s: %s", fn.__name__, exc)

    return result


def indicators_to_summary(indicators: dict[str, Any]) -> str:
    """Format indicators dict as a human-readable string for LLM prompts."""
    lines = []
    skip = {"_series"}
    for k, v in indicators.items():
        if k in skip or (isinstance(v, dict)):
            continue
        if v is None:
            continue
        if isinstance(v, float):
            lines.append(f"  {k}: {v:.4f}")
        else:
            lines.append(f"  {k}: {v}")
    return "\n".join(lines)
