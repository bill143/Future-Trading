"""
analysis/agents/sentiment_analyst.py
Sentiment analysis agent: news headlines, VIX, and cross-asset signals.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import pandas as pd
import requests

from analysis.agents.base_agent import BaseAnalystAgent
from analysis.config.prompts import SENTIMENT_ANALYST_HUMAN, SENTIMENT_ANALYST_SYSTEM

logger = logging.getLogger(__name__)


def _fetch_news_headlines(symbol: str, max_items: int = 10) -> list[str]:
    """
    Attempt to fetch recent news headlines via the Alpha Vantage News API.
    Returns an empty list if the API key is absent or the call fails.
    """
    api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
    if not api_key:
        return []

    # Map futures to equity proxies for news lookup
    news_tickers = {
        "ES": "SPY", "MES": "SPY",
        "NQ": "QQQ", "MNQ": "QQQ",
        "YM": "DIA", "MYM": "DIA",
        "GC": "GLD", "CL": "USO",
    }
    ticker = news_tickers.get(symbol.upper(), symbol)

    url = "https://www.alphavantage.co/query"
    params = {
        "function": "NEWS_SENTIMENT",
        "tickers": ticker,
        "limit": max_items,
        "apikey": api_key,
    }
    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        feed = data.get("feed", [])
        return [item.get("title", "") for item in feed[:max_items]]
    except Exception as exc:
        logger.warning("News fetch failed: %s", exc)
        return []


def _build_sentiment_summary(
    headlines: list[str],
    vix: float | None,
    symbol: str,
) -> str:
    lines = [f"  Symbol proxy: {symbol}"]

    if vix is not None:
        fear_level = "extreme_fear" if vix > 30 else "fear" if vix > 20 else "neutral" if vix > 15 else "complacency"
        lines.append(f"  VIX: {vix:.2f} ({fear_level})")

    if headlines:
        lines.append("  Recent Headlines:")
        for h in headlines:
            lines.append(f"    - {h}")
    else:
        lines.append("  No recent headlines available (no API key configured).")

    return "\n".join(lines)


class SentimentAnalystAgent(BaseAnalystAgent):
    """
    Analyses news sentiment, VIX levels, and macro risk-on/risk-off signals.
    """

    name = "sentiment_analyst"

    def analyse(
        self,
        symbol: str,
        timeframe: str,
        vix: float | None = None,
        external_headlines: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Run sentiment analysis.

        Parameters
        ----------
        symbol             : Futures short code (e.g. "ES")
        timeframe          : Bar timeframe (context only)
        vix                : Current VIX level (optional)
        external_headlines : Pre-fetched headlines (overrides API fetch)
        """
        headlines = external_headlines if external_headlines is not None else _fetch_news_headlines(symbol)
        sentiment_summary = _build_sentiment_summary(headlines, vix, symbol)

        human_prompt = SENTIMENT_ANALYST_HUMAN.format(
            symbol=symbol,
            timeframe=timeframe,
            sentiment_summary=sentiment_summary,
        )

        result = self._call_llm(SENTIMENT_ANALYST_SYSTEM, human_prompt)
        result.setdefault("agent", self.name)
        result.setdefault("bias", "neutral")
        result.setdefault("sentiment", "neutral")
        result.setdefault("confidence", 0.0)
        result.setdefault("signals", [])
        return result
