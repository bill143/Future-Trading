# Analysis Agent Architecture

This document describes the LangChain multi-agent trading analysis system
integrated into **Future-Trading**.

---

## Architecture Overview

```
Price Data (Yahoo Finance / Alpha Vantage)    Economic Data (FRED)
         │                                           │
         ▼                                           ▼
┌────────────────────────────────────────────────────────────────┐
│                     analysis/main.py                           │
│                                                                │
│  ┌──────────────────┐  ┌──────────────────────────────────┐   │
│  │  data_fetcher.py │  │       market_data.py             │   │
│  │  (OHLCV fetch)   │  │  (normalise + validate)          │   │
│  └────────┬─────────┘  └───────────────┬──────────────────┘   │
│           └──────────────┬─────────────┘                      │
│                          ▼                                     │
│             ┌────────────────────────┐                        │
│             │  Technical Indicators  │                        │
│             │  + Price Action        │                        │
│             │  + Volume Analysis     │                        │
│             └────────────┬───────────┘                        │
│                          │                                     │
│          ┌───────────────┼──────────────────┐                 │
│          ▼               ▼                  ▼                 │
│  ┌───────────────┐ ┌──────────────┐ ┌──────────────────┐     │
│  │  Technical    │ │  Market      │ │  Sentiment       │     │
│  │  Analyst      │ │  Structure   │ │  Analyst         │     │
│  │  (LLM)        │ │  Analyst     │ │  (LLM + news)    │     │
│  └───────┬───────┘ │  (LLM)       │ └────────┬─────────┘     │
│          │         └──────┬───────┘          │               │
│          │                │          ┌───────┴───────┐        │
│          │                │          │  Fundamental  │        │
│          │                │          │  Analyst      │        │
│          │                │          │  (LLM + FRED) │        │
│          │                │          └───────┬───────┘        │
│          └────────────────┴──────────────────┘                │
│                           │                                    │
│                           ▼                                    │
│               ┌───────────────────────┐                       │
│               │   Coordinator Agent   │                       │
│               │   (LLM synthesis)     │                       │
│               └───────────┬───────────┘                       │
└───────────────────────────┼────────────────────────────────────┘
                            ▼
               ┌────────────────────────┐
               │  Trading Signal JSON   │
               │  consensus_bias        │
               │  confidence            │
               │  action / entry / SL   │
               │  take_profit / R:R     │
               └────────────┬───────────┘
                            │
               ┌────────────▼───────────┐
               │   /api/analyze         │
               │   (Node.js endpoint)   │
               └────────────┬───────────┘
                            │ (if autoTrade & confidence >= threshold)
                            ▼
               ┌────────────────────────┐
               │   /api/webhook         │
               │   → Tradovate / Schwab │
               └────────────────────────┘
```

---

## Agent Descriptions

### 1. Technical Analyst (`analysis/agents/technical_analyst.py`)

Computes all technical indicators and price action, then asks the LLM to
interpret them in the context of ES/NQ/YM futures trading.

**Indicators computed:**
- RSI (14) – oversold/overbought detection
- MACD (12/26/9) – momentum and crossovers
- Stochastic (14/3/3) – momentum oscillator
- ATR (14) – volatility
- Bollinger Bands (20, 2σ) – volatility expansion/contraction
- SMA 20/50/200 & EMA 20/50/200 – trend alignment
- Support/Resistance levels (swing-based)
- Candlestick patterns (doji, hammer, engulfing, morning/evening star)

**Output schema:**
```json
{
  "agent": "technical_analyst",
  "bias": "bullish|bearish|neutral",
  "confidence": 0.0-1.0,
  "signals": ["<string>", "..."],
  "key_levels": { "support": [...], "resistance": [...] },
  "analysis": "<detailed paragraph>"
}
```

---

### 2. Market Structure Analyst (`analysis/agents/market_structure_analyst.py`)

Detects the current trend structure based on swing high/low sequences.

**Detects:**
- Higher Highs + Higher Lows → Uptrend
- Lower Highs + Lower Lows → Downtrend
- Mixed → Ranging or Expansion
- Breakout / Retest conditions

**Output schema:**
```json
{
  "agent": "market_structure_analyst",
  "bias": "bullish|bearish|neutral",
  "confidence": 0.0-1.0,
  "structure": "uptrend|downtrend|ranging|expansion",
  "signals": ["..."],
  "key_levels": { "support": [...], "resistance": [...] },
  "analysis": "<paragraph>"
}
```

---

### 3. Sentiment Analyst (`analysis/agents/sentiment_analyst.py`)

Analyses news headlines (Alpha Vantage News API) and VIX levels.

**Inputs:**
- VIX from Yahoo Finance (`^VIX`)
- News headlines from Alpha Vantage (requires `ALPHA_VANTAGE_API_KEY`)

**Output schema:**
```json
{
  "agent": "sentiment_analyst",
  "bias": "bullish|bearish|neutral",
  "sentiment": "risk_on|risk_off|neutral",
  "confidence": 0.0-1.0,
  "signals": ["..."],
  "analysis": "<paragraph>"
}
```

---

### 4. Fundamental Analyst (`analysis/agents/fundamental_analyst.py`)

Uses FRED economic data to assess the macroeconomic backdrop.

**Data series fetched:**
- Federal Funds Rate
- CPI (inflation)
- PCE price index
- Nonfarm Payrolls
- Real GDP
- Unemployment Rate
- 10-Year and 2-Year Treasury yields
- VIX

**Output schema:**
```json
{
  "agent": "fundamental_analyst",
  "bias": "bullish|bearish|neutral",
  "backdrop": "expansionary|contractionary|uncertain",
  "confidence": 0.0-1.0,
  "signals": ["..."],
  "analysis": "<paragraph>"
}
```

---

### 5. Coordinator Agent (`analysis/agents/coordinator_agent.py`)

Synthesises all four agent outputs into a final trading signal.

**Final output schema:**
```json
{
  "symbol": "ES",
  "timeframe": "1h",
  "timestamp": "2024-01-01T12:00:00Z",
  "consensus_bias": "bullish|bearish|neutral",
  "confidence": 0.72,
  "agents": [...],
  "key_levels": { "support": [...], "resistance": [...] },
  "trading_signal": {
    "action": "buy|sell|hold",
    "entry": 5505.0,
    "stop_loss": 5482.0,
    "take_profit": 5551.0,
    "risk_reward": 2.0
  },
  "reasoning": "<full reasoning paragraph>"
}
```

---

## `/api/analyze` Endpoint

### GET Request (manual analysis, no trade)

```
GET /api/analyze?symbol=ES&timeframe=1h
```

| Parameter        | Default | Description                              |
|------------------|---------|------------------------------------------|
| `symbol`         | `ES`    | Futures code: ES, NQ, YM, MES, MNQ, MYM |
| `timeframe`      | `1h`    | 1m, 5m, 15m, 30m, 1h, 4h, 1d            |
| `bars`           | auto    | Number of historical bars                |
| `skipFundamental`| false   | Skip FRED economic data fetch            |
| `skipSentiment`  | false   | Skip news/sentiment fetch                |
| `provider`       | env     | LLM provider override                   |
| `model`          | env     | LLM model override                      |

### POST Request (with optional auto-trade)

```json
{
  "secret": "your-webhook-secret",
  "symbol": "ES",
  "timeframe": "1h",
  "autoTrade": true,
  "broker": "tradovate",
  "qty": 1,
  "orderType": "Market"
}
```

If `autoTrade=true` and the analysis confidence is ≥ `AUTO_TRADE_MIN_CONFIDENCE`
(default 0.65) and the action is not `hold`, the signal is automatically
forwarded to `/api/webhook` for execution.

---

## Environment Variables

See `.env.example` for all required and optional variables.

| Variable                   | Required | Description                               |
|----------------------------|----------|-------------------------------------------|
| `LLM_PROVIDER`             | Yes      | `openai`, `anthropic`, or `groq`          |
| `LLM_MODEL`                | No       | LLM model name                            |
| `OPENAI_API_KEY`           | Cond.    | Required if `LLM_PROVIDER=openai`         |
| `ANTHROPIC_API_KEY`        | Cond.    | Required if `LLM_PROVIDER=anthropic`      |
| `GROQ_API_KEY`             | Cond.    | Required if `LLM_PROVIDER=groq`           |
| `ALPHA_VANTAGE_API_KEY`    | No       | News sentiment + technical indicators     |
| `FRED_API_KEY`             | No       | Macroeconomic data                        |
| `ANALYSIS_ENABLED`         | No       | `true` (default) or `false` to disable    |
| `ANALYSIS_TIMEOUT_MS`      | No       | Python subprocess timeout (default 120000)|
| `AUTO_TRADE_MIN_CONFIDENCE`| No       | Min confidence for auto-trade (default 0.65)|

---

## Setup

### 1. Install Python dependencies

```bash
cd analysis
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example analysis/.env
# Edit analysis/.env with your API keys
```

### 3. Test the Python module directly

```bash
# Quick analysis (no trade execution)
python -m analysis.main --symbol ES --timeframe 1h

# Skip FRED and news for faster results (no API keys needed beyond LLM)
python -m analysis.main --symbol NQ --timeframe 15m --skip-fundamental --skip-sentiment

# JSON output for piping
python -m analysis.main --symbol YM --timeframe 1d --output json | jq .trading_signal
```

### 4. Test the API endpoint

```bash
node api/test-analysis.js
```

---

## Customisation

### Changing LLM Provider

Set `LLM_PROVIDER` to `openai`, `anthropic`, or `groq` in your `.env`.

Groq provides the fastest inference (recommended for live trading):
```
LLM_PROVIDER=groq
LLM_MODEL=llama3-70b-8192
GROQ_API_KEY=gsk_...
```

### Modifying Indicator Parameters

Edit `analysis/config/config.py` to adjust RSI periods, MA windows,
Bollinger Band parameters, support/resistance lookback, etc.

### Modifying LLM Prompts

Edit `analysis/config/prompts.py` to refine the system and human prompts
for any agent.

### Adding a New Agent

1. Create `analysis/agents/my_agent.py` subclassing `BaseAnalystAgent`
2. Add a system + human prompt in `analysis/config/prompts.py`
3. Instantiate and call the agent in `analysis/main.py`
4. Pass the result to `coordinator.synthesise()`

---

## Example Outputs

See `analysis/examples/` for realistic example outputs:
- `es_1h_bullish.json` – ES 1h bullish setup
- `nq_15m_bearish.json` – NQ 15m bearish setup

---

## Kill Switches

The existing kill switches in `/api/kill.js` remain fully functional.
They apply **after** any analysis-triggered trade, ensuring you can always
halt execution regardless of the analysis signal.

```bash
# Halt all trading
curl -X POST /api/kill -d '{"secret":"...","broker":"all","kill":true}'

# Resume Tradovate only
curl -X POST /api/kill -d '{"secret":"...","broker":"tradovate","kill":false}'
```
