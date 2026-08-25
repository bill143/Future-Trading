"""
analysis/main.py
Main entry point for the LangChain multi-agent trading analysis system.

Usage:
    # As a module
    from analysis.main import run_analysis
    result = run_analysis("ES", "1h")

    # CLI
    python -m analysis.main --symbol ES --timeframe 1h
    python -m analysis.main --symbol NQ --timeframe 15m --output json
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from typing import Any

# Ensure the repo root is on sys.path when running as a script
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from analysis.agents.coordinator_agent import CoordinatorAgent
from analysis.agents.fundamental_analyst import FundamentalAnalystAgent
from analysis.agents.market_structure_analyst import MarketStructureAnalystAgent
from analysis.agents.sentiment_analyst import SentimentAnalystAgent
from analysis.agents.technical_analyst import TechnicalAnalystAgent
from analysis.config.config import VALID_TIMEFRAMES
from analysis.data.data_fetcher import fetch_ohlcv_yfinance, get_latest_economic_snapshot
from analysis.data.market_data import validate_ohlcv

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def run_analysis(
    symbol: str,
    timeframe: str = "1h",
    bars: int | None = None,
    provider: str | None = None,
    model: str | None = None,
    skip_fundamental: bool = False,
    skip_sentiment: bool = False,
) -> dict[str, Any]:
    """
    Run the full multi-agent analysis pipeline for a given futures symbol.

    Parameters
    ----------
    symbol           : Futures short code, e.g. "ES", "NQ", "YM"
    timeframe        : Bar timeframe, e.g. "1h", "15m", "1d"
    bars             : Number of historical bars to fetch
    provider         : LLM provider override (openai, anthropic, groq)
    model            : LLM model override
    skip_fundamental : Skip FRED economic data fetch
    skip_sentiment   : Skip news/sentiment fetch

    Returns
    -------
    Full analysis dict including individual agent results and trading signal.
    """
    if timeframe not in VALID_TIMEFRAMES:
        raise ValueError(f"Invalid timeframe '{timeframe}'. Valid: {VALID_TIMEFRAMES}")

    logger.info("Starting analysis for %s (%s)", symbol, timeframe)

    # ── 1. Fetch market data ──────────────────────────────────────────────
    df = fetch_ohlcv_yfinance(symbol, timeframe, bars)
    valid, issues = validate_ohlcv(df)
    if not valid:
        logger.warning("Data quality issues: %s", issues)

    current_price = float(df["close"].iloc[-1])
    logger.info("Fetched %d bars for %s; current price: %.2f", len(df), symbol, current_price)

    # ── 2. Instantiate agents ─────────────────────────────────────────────
    agent_kwargs = {"provider": provider, "model": model}

    technical_agent      = TechnicalAnalystAgent(**agent_kwargs)
    market_struct_agent  = MarketStructureAnalystAgent(**agent_kwargs)
    sentiment_agent      = SentimentAnalystAgent(**agent_kwargs)
    fundamental_agent    = FundamentalAnalystAgent(**agent_kwargs)
    coordinator          = CoordinatorAgent(**agent_kwargs)

    agent_results: list[dict[str, Any]] = []

    # ── 3. Run specialist agents ──────────────────────────────────────────
    logger.info("Running Technical Analyst …")
    tech_result = technical_agent.analyse(symbol, timeframe, df)
    agent_results.append(tech_result)

    logger.info("Running Market Structure Analyst …")
    ms_result = market_struct_agent.analyse(symbol, timeframe, df)
    agent_results.append(ms_result)

    if not skip_sentiment:
        logger.info("Running Sentiment Analyst …")
        # Optionally pass in a VIX reading if available
        vix = None
        try:
            import yfinance as yf
            vix_data = yf.download("^VIX", period="1d", interval="1d", progress=False)
            if not vix_data.empty:
                vix = float(vix_data["Close"].iloc[-1])
        except Exception:
            pass
        sent_result = sentiment_agent.analyse(symbol, timeframe, vix=vix)
        agent_results.append(sent_result)

    if not skip_fundamental:
        logger.info("Running Fundamental Analyst …")
        economic_data = get_latest_economic_snapshot()
        fund_result = fundamental_agent.analyse(symbol, economic_snapshot=economic_data)
        agent_results.append(fund_result)

    # ── 4. Coordinator synthesis ──────────────────────────────────────────
    logger.info("Running Coordinator Agent …")
    final = coordinator.synthesise(symbol, timeframe, df, agent_results)

    logger.info(
        "Analysis complete | bias=%s | confidence=%.2f | action=%s",
        final["consensus_bias"],
        final["confidence"],
        final.get("trading_signal", {}).get("action", "?"),
    )

    return final


# ── CLI ───────────────────────────────────────────────────────────────────

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="LangChain multi-agent futures trading analysis"
    )
    parser.add_argument("--symbol",    default="ES",  help="Futures symbol (ES, NQ, YM)")
    parser.add_argument("--timeframe", default="1h",  help="Bar timeframe (1m,5m,15m,30m,1h,4h,1d)")
    parser.add_argument("--bars",      type=int,      help="Number of historical bars")
    parser.add_argument("--provider",  default=None,  help="LLM provider (openai, anthropic, groq)")
    parser.add_argument("--model",     default=None,  help="LLM model name")
    parser.add_argument(
        "--skip-fundamental", action="store_true",
        help="Skip FRED economic data fetch"
    )
    parser.add_argument(
        "--skip-sentiment", action="store_true",
        help="Skip news/sentiment fetch"
    )
    parser.add_argument(
        "--output", choices=["json", "pretty"], default="pretty",
        help="Output format"
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()

    result = run_analysis(
        symbol=args.symbol,
        timeframe=args.timeframe,
        bars=args.bars,
        provider=args.provider,
        model=args.model,
        skip_fundamental=args.skip_fundamental,
        skip_sentiment=args.skip_sentiment,
    )

    if args.output == "json":
        print(json.dumps(result))
    else:
        print(json.dumps(result, indent=2))
