"""
analysis/config/config.py
Configuration for timeframes, indicator parameters, and supported symbols.
"""

# Supported futures symbols (Yahoo Finance tickers)
FUTURES_SYMBOLS = {
    "ES": "ES=F",   # E-mini S&P 500
    "NQ": "NQ=F",   # E-mini Nasdaq-100
    "YM": "YM=F",   # E-mini Dow Jones
    "MES": "MES=F", # Micro E-mini S&P 500
    "MNQ": "MNQ=F", # Micro E-mini Nasdaq-100
    "MYM": "MYM=F", # Micro E-mini Dow Jones
    "GC": "GC=F",   # Gold
    "CL": "CL=F",   # Crude Oil
}

# Valid timeframes for analysis
VALID_TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"]

# Yahoo Finance interval mapping
YFINANCE_INTERVALS = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "1h",
    "4h": "1h",  # Yahoo does not have 4h; use 1h and resample
    "1d": "1d",
}

# Default bar count per timeframe
DEFAULT_BARS = {
    "1m": 200,
    "5m": 200,
    "15m": 200,
    "30m": 200,
    "1h": 200,
    "4h": 100,
    "1d": 200,
}

# ── Moving average periods ─────────────────────────────────────────────────
MA_FAST = 20
MA_MID  = 50
MA_SLOW = 200

# ── RSI ───────────────────────────────────────────────────────────────────
RSI_PERIOD    = 14
RSI_OVERBOUGHT = 70
RSI_OVERSOLD   = 30

# ── MACD ──────────────────────────────────────────────────────────────────
MACD_FAST   = 12
MACD_SLOW   = 26
MACD_SIGNAL = 9

# ── Stochastic ────────────────────────────────────────────────────────────
STOCH_K      = 14
STOCH_D      = 3
STOCH_SMOOTH = 3
STOCH_OVERBOUGHT = 80
STOCH_OVERSOLD   = 20

# ── ATR ───────────────────────────────────────────────────────────────────
ATR_PERIOD = 14

# ── Bollinger Bands ───────────────────────────────────────────────────────
BB_PERIOD = 20
BB_STD    = 2.0

# ── Support / Resistance ──────────────────────────────────────────────────
SR_LOOKBACK     = 50   # bars to look back for S/R levels
SR_PROXIMITY_PCT = 0.002  # 0.2 % proximity to consider a level "tested"

# ── Swing detection ───────────────────────────────────────────────────────
SWING_LOOKBACK = 5   # bars each side to confirm a swing high/low

# ── Signal confidence thresholds ──────────────────────────────────────────
MIN_CONFIDENCE_TO_TRADE  = 0.65  # auto-execute above this confidence
REVIEW_CONFIDENCE_LOWER  = 0.50  # send to dashboard between lower and min

# ── LLM defaults ──────────────────────────────────────────────────────────
DEFAULT_LLM_PROVIDER = "openai"
DEFAULT_LLM_MODEL    = "gpt-4o-mini"
LLM_TEMPERATURE      = 0.1
