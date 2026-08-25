"""
analysis/agents/coordinator_agent.py
Coordinator agent: synthesises all analyst outputs into a final trading signal.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

import pandas as pd

from analysis.agents.base_agent import BaseAnalystAgent
from analysis.config.prompts import COORDINATOR_HUMAN, COORDINATOR_SYSTEM

logger = logging.getLogger(__name__)


def _agents_summary(agents: list[dict]) -> str:
    """Format list of agent results as JSON string for the coordinator prompt."""
    return json.dumps(agents, indent=2)


def _merge_key_levels(agents: list[dict]) -> dict[str, list[float]]:
    """Union all key levels from agent outputs."""
    supports: set[float] = set()
    resistances: set[float] = set()
    for a in agents:
        kl = a.get("key_levels", {})
        if isinstance(kl, dict):
            for s in kl.get("support", []):
                try:
                    supports.add(float(s))
                except (TypeError, ValueError):
                    pass
            for r in kl.get("resistance", []):
                try:
                    resistances.add(float(r))
                except (TypeError, ValueError):
                    pass
    return {
        "support":    sorted(supports, reverse=True),
        "resistance": sorted(resistances),
    }


class CoordinatorAgent(BaseAnalystAgent):
    """
    Combines outputs from all analyst agents into a final trading recommendation.
    Also handles the case where the LLM is unavailable (rule-based fallback).
    """

    name = "coordinator_agent"

    def synthesise(
        self,
        symbol: str,
        timeframe: str,
        df: pd.DataFrame,
        agents: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Synthesise analyst results into a final trading recommendation.

        Parameters
        ----------
        symbol    : Instrument short code (e.g. "ES")
        timeframe : Bar timeframe (e.g. "1h")
        df        : Normalised OHLCV DataFrame (used for price reference)
        agents    : List of agent result dicts

        Returns
        -------
        Full analysis output dict.
        """
        current_price = float(df["close"].iloc[-1]) if not df.empty else 0.0
        timestamp     = datetime.now(timezone.utc).isoformat()

        agents_summary = _agents_summary(agents)
        human_prompt   = COORDINATOR_HUMAN.format(
            symbol=symbol,
            timeframe=timeframe,
            current_price=current_price,
            timestamp=timestamp,
            agents_summary=agents_summary,
        )

        coord_result = self._call_llm(COORDINATOR_SYSTEM, human_prompt)

        # Build and return the full output
        key_levels = _merge_key_levels(agents)

        # Fallback signal if LLM parsing failed
        coord_result.setdefault("consensus_bias", "neutral")
        coord_result.setdefault("confidence", 0.0)
        coord_result.setdefault("trading_signal", {
            "action": "hold",
            "entry": current_price,
            "stop_loss": None,
            "take_profit": None,
            "risk_reward": None,
        })
        coord_result.setdefault("reasoning", "Coordination result unavailable.")

        return {
            "symbol":         symbol,
            "timeframe":      timeframe,
            "timestamp":      timestamp,
            "consensus_bias": coord_result["consensus_bias"],
            "confidence":     coord_result["confidence"],
            "agents":         agents,
            "key_levels":     key_levels,
            "trading_signal": coord_result["trading_signal"],
            "reasoning":      coord_result["reasoning"],
        }
