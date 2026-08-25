"""
analysis/data/data_fetcher.py
Fetch OHLCV data from Yahoo Finance, Alpha Vantage, and economic data from FRED.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import requests

from analysis.config.config import (
    FUTURES_SYMBOLS,
    VALID_TIMEFRAMES,
    YFINANCE_INTERVALS,
    DEFAULT_BARS,
)
from analysis.data.market_data import normalize_ohlcv

logger = logging.getLogger(__name__)

# ── Yahoo Finance ──────────────────────────────────────────────────────────

def fetch_ohlcv_yfinance(
    symbol: str,
    timeframe: str = "1h",
    bars: Optional[int] = None,
) -> pd.DataFrame:
    """
    Fetch OHLCV bars from Yahoo Finance using the yfinance library.

    Parameters
    ----------
    symbol    : Futures short code (e.g. "ES") or Yahoo ticker (e.g. "ES=F")
    timeframe : One of VALID_TIMEFRAMES
    bars      : Number of bars to retrieve (uses DEFAULT_BARS if None)

    Returns
    -------
    Normalised OHLCV DataFrame.
    """
    try:
        import yfinance as yf  # lazy import – optional dependency
    except ImportError as exc:
        raise ImportError("yfinance is required: pip install yfinance") from exc

    if timeframe not in VALID_TIMEFRAMES:
        raise ValueError(f"Invalid timeframe '{timeframe}'. Valid: {VALID_TIMEFRAMES}")

    ticker = FUTURES_SYMBOLS.get(symbol.upper(), symbol)
    interval = YFINANCE_INTERVALS[timeframe]
    n_bars = bars or DEFAULT_BARS.get(timeframe, 200)

    # Calculate period from bar count × approximate bar duration
    minutes_per_bar = {
        "1m": 1, "5m": 5, "15m": 15, "30m": 30,
        "1h": 60, "4h": 240, "1d": 1440,
    }
    total_minutes = n_bars * minutes_per_bar.get(timeframe, 60) * 1.5  # add 50 % buffer
    period_days = max(int(total_minutes / (60 * 6.5)) + 1, 2)  # trading hours only

    # yfinance caps intraday history: 1m → 7 days, 5–30m → 60 days, 1h → 730 days
    max_days = {"1m": 7, "5m": 60, "15m": 60, "30m": 60, "1h": 730}.get(timeframe, 730)
    period_days = min(period_days, max_days)

    start = datetime.utcnow() - timedelta(days=period_days)
    logger.debug("yfinance fetch: %s %s from %s", ticker, interval, start.date())

    data = yf.download(ticker, start=start.strftime("%Y-%m-%d"), interval=interval, progress=False)

    if data.empty:
        raise ValueError(f"No data returned for {ticker} ({timeframe})")

    # Flatten MultiIndex columns if present (yfinance >= 0.2.38)
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)

    df = normalize_ohlcv(data)

    if timeframe == "4h":
        from analysis.data.market_data import resample_to_4h
        df = resample_to_4h(df)

    return df.tail(n_bars)


# ── Alpha Vantage ─────────────────────────────────────────────────────────

_AV_BASE = "https://www.alphavantage.co/query"
_AV_TF_MAP = {
    "1m": "1min", "5m": "5min", "15m": "15min",
    "30m": "30min", "1h": "60min",
}


def fetch_ohlcv_alpha_vantage(
    symbol: str,
    timeframe: str = "1h",
    api_key: Optional[str] = None,
) -> pd.DataFrame:
    """
    Fetch intraday OHLCV from Alpha Vantage (requires API key).
    Falls back to Yahoo Finance when timeframe is daily.
    """
    key = api_key or os.getenv("ALPHA_VANTAGE_API_KEY")
    if not key:
        raise EnvironmentError("ALPHA_VANTAGE_API_KEY not set.")

    if timeframe not in _AV_TF_MAP:
        # Daily – use Yahoo Finance
        return fetch_ohlcv_yfinance(symbol, "1d")

    av_interval = _AV_TF_MAP[timeframe]
    ticker = FUTURES_SYMBOLS.get(symbol.upper(), symbol)
    # Alpha Vantage does not directly serve futures – use the Yahoo symbol as-is;
    # this is mainly for equity/equity-index proxies (SPY, QQQ, DIA).
    params = {
        "function": "TIME_SERIES_INTRADAY",
        "symbol": ticker.replace("=F", ""),  # strip futures suffix
        "interval": av_interval,
        "outputsize": "full",
        "apikey": key,
    }
    resp = requests.get(_AV_BASE, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    series_key = f"Time Series ({av_interval})"
    if series_key not in data:
        raise ValueError(f"Unexpected Alpha Vantage response: {list(data.keys())}")

    records = [
        {
            "timestamp": ts,
            "open":   float(v["1. open"]),
            "high":   float(v["2. high"]),
            "low":    float(v["3. low"]),
            "close":  float(v["4. close"]),
            "volume": float(v["5. volume"]),
        }
        for ts, v in data[series_key].items()
    ]
    df = pd.DataFrame(records).set_index("timestamp")
    return normalize_ohlcv(df)


# ── FRED Economic Data ─────────────────────────────────────────────────────

_FRED_SERIES = {
    "fed_rate":       "FEDFUNDS",       # Federal Funds Rate
    "cpi":            "CPIAUCSL",       # Consumer Price Index
    "pce":            "PCEPI",          # PCE Price Index
    "nfp":            "PAYEMS",         # Nonfarm Payrolls
    "gdp":            "GDP",            # Real GDP
    "unemployment":   "UNRATE",         # Unemployment Rate
    "10y_treasury":   "DGS10",          # 10-Year Treasury Yield
    "2y_treasury":    "DGS2",           # 2-Year Treasury Yield
    "vix":            "VIXCLS",         # CBOE VIX
}


def fetch_fred_data(
    series_ids: Optional[list[str]] = None,
    api_key: Optional[str] = None,
    lookback_days: int = 365,
) -> dict[str, pd.Series]:
    """
    Fetch economic time series from FRED.

    Parameters
    ----------
    series_ids   : List of friendly keys from _FRED_SERIES, or raw FRED IDs.
    api_key      : FRED API key (falls back to FRED_API_KEY env var).
    lookback_days: Number of days of history to retrieve.

    Returns
    -------
    Dict mapping series id → pandas Series (date index, float values).
    """
    try:
        from fredapi import Fred
    except ImportError as exc:
        raise ImportError("fredapi is required: pip install fredapi") from exc

    key = api_key or os.getenv("FRED_API_KEY")
    if not key:
        raise EnvironmentError("FRED_API_KEY not set.")

    fred = Fred(api_key=key)
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=lookback_days)

    ids_to_fetch = series_ids or list(_FRED_SERIES.keys())
    result: dict[str, pd.Series] = {}

    for sid in ids_to_fetch:
        fred_id = _FRED_SERIES.get(sid, sid)
        try:
            series = fred.get_series(
                fred_id,
                observation_start=start_date.strftime("%Y-%m-%d"),
                observation_end=end_date.strftime("%Y-%m-%d"),
            )
            result[sid] = series.dropna()
            logger.debug("FRED %s (%s): %d observations", sid, fred_id, len(result[sid]))
        except Exception as exc:
            logger.warning("Failed to fetch FRED series %s: %s", fred_id, exc)

    return result


def get_latest_economic_snapshot(api_key: Optional[str] = None) -> dict:
    """
    Return the most recent value for each key FRED series as a flat dict.
    Returns an empty dict if FRED_API_KEY is not configured.
    """
    api_key = api_key or os.getenv("FRED_API_KEY")
    if not api_key:
        logger.warning("FRED_API_KEY not set – skipping economic data.")
        return {}

    try:
        data = fetch_fred_data(api_key=api_key, lookback_days=400)
    except Exception as exc:
        logger.warning("FRED fetch failed: %s", exc)
        return {}

    snapshot = {}
    for key, series in data.items():
        if not series.empty:
            snapshot[key] = float(series.iloc[-1])
    return snapshot
