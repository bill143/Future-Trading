"""
analysis/agents/market_structure_analyst.py
Market structure analysis agent: trend, swing sequence, and breakout detection.
"""

from __future__ import annotations

import logging
from typing import Any

import pandas as pd

from analysis.agents.base_agent import BaseAnalystAgent
from analysis.config.prompts import (
    MARKET_STRUCTURE_ANALYST_HUMAN,
    MARKET_STRUCTURE_ANALYST_SYSTEM,
)
from analysis.indicators.price_action import (
    detect_market_structure,
    detect_support_resistance,
    get_recent_swings,
)

logger = logging.getLogger(__name__)


def _build_swings_summary(swings: dict, structure: dict) -> str:
    lines = [
        f"  Market Structure: {structure.get('structure')}",
        f"  Recent Swing Highs: {swings.get('swing_highs', [])}",
        f"  Recent Swing Lows:  {swings.get('swing_lows', [])}",
        f"  Last 4 Highs: {structure.get('recent_highs', [])}",
        f"  Last 4 Lows:  {structure.get('recent_lows', [])}",
    ]
    return "\n".join(lines)


def _build_structure_summary(sr: dict, price: float) -> str:
    lines = [
        f"  Current Price: {price}",
        f"  Key Resistance Levels: {sr.get('resistance', [])[:5]}",
        f"  Key Support Levels:    {sr.get('support', [])[:5]}",
    ]
    return "\n".join(lines)


class MarketStructureAnalystAgent(BaseAnalystAgent):
    """Analyses higher highs/lows, trends, breakouts, and key structure levels."""

    name = "market_structure_analyst"

    def analyse(
        self,
        symbol: str,
        timeframe: str,
        df: pd.DataFrame,
    ) -> dict[str, Any]:
        if df.empty or len(df) < 20:
            return {
                "agent": self.name,
                "bias": "neutral",
                "confidence": 0.0,
                "structure": "ranging",
                "signals": [],
                "key_levels": {"support": [], "resistance": []},
                "analysis": "Insufficient data for market structure analysis.",
            }

        swings    = get_recent_swings(df)
        structure = detect_market_structure(df)
        sr        = detect_support_resistance(df)
        price     = float(df["close"].iloc[-1])

        swings_summary    = _build_swings_summary(swings, structure)
        structure_summary = _build_structure_summary(sr, price)

        human_prompt = MARKET_STRUCTURE_ANALYST_HUMAN.format(
            symbol=symbol,
            timeframe=timeframe,
            current_price=price,
            swings_summary=swings_summary,
            structure_summary=structure_summary,
        )

        result = self._call_llm(MARKET_STRUCTURE_ANALYST_SYSTEM, human_prompt)
        result.setdefault("agent", self.name)
        result.setdefault("bias", "neutral")
        result.setdefault("confidence", 0.0)
        result.setdefault("structure", structure.get("structure", "ranging"))
        result.setdefault("signals", [])
        result.setdefault("key_levels", {"support": sr["support"][:3],
                                          "resistance": sr["resistance"][:3]})
        return result
