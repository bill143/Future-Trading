"""
analysis/agents/technical_analyst.py
Technical analysis agent: computes indicators + price action, then calls LLM.
"""

from __future__ import annotations

import logging
from typing import Any

import pandas as pd

from analysis.agents.base_agent import BaseAnalystAgent
from analysis.config.prompts import TECHNICAL_ANALYST_HUMAN, TECHNICAL_ANALYST_SYSTEM
from analysis.indicators.technical_indicators import (
    compute_all_indicators,
    indicators_to_summary,
)
from analysis.indicators.price_action import (
    price_action_summary,
    price_action_to_summary_str,
)

logger = logging.getLogger(__name__)


class TechnicalAnalystAgent(BaseAnalystAgent):
    """
    Combines indicator readings and price action into an LLM-powered
    technical analysis output.
    """

    name = "technical_analyst"

    def analyse(
        self,
        symbol: str,
        timeframe: str,
        df: pd.DataFrame,
    ) -> dict[str, Any]:
        """
        Run technical analysis on the provided OHLCV DataFrame.

        Parameters
        ----------
        symbol    : Instrument short code (e.g. "ES")
        timeframe : Bar timeframe (e.g. "1h")
        df        : Normalised OHLCV DataFrame

        Returns
        -------
        Agent output dict conforming to the analysis JSON schema.
        """
        if df.empty or len(df) < 20:
            return {
                "agent": self.name,
                "bias": "neutral",
                "confidence": 0.0,
                "signals": [],
                "key_levels": {"support": [], "resistance": []},
                "analysis": "Insufficient data for technical analysis.",
            }

        indicators  = compute_all_indicators(df)
        ind_summary = indicators_to_summary(indicators)

        pa          = price_action_summary(df)
        pa_summary  = price_action_to_summary_str(pa)

        current_price = float(df["close"].iloc[-1])

        human_prompt = TECHNICAL_ANALYST_HUMAN.format(
            symbol=symbol,
            timeframe=timeframe,
            current_price=current_price,
            indicators_summary=ind_summary,
            price_action_summary=pa_summary,
        )

        result = self._call_llm(TECHNICAL_ANALYST_SYSTEM, human_prompt)
        result.setdefault("agent", self.name)
        result.setdefault("bias", "neutral")
        result.setdefault("confidence", 0.0)
        result.setdefault("signals", [])
        result.setdefault("key_levels", {"support": pa["nearest_support"],
                                         "resistance": pa["nearest_resistance"]})
        return result
