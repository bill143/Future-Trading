"""
analysis/agents/fundamental_analyst.py
Fundamental/macro analysis agent using FRED economic data.
"""

from __future__ import annotations

import logging
from typing import Any

from analysis.agents.base_agent import BaseAnalystAgent
from analysis.config.prompts import FUNDAMENTAL_ANALYST_HUMAN, FUNDAMENTAL_ANALYST_SYSTEM
from analysis.data.data_fetcher import get_latest_economic_snapshot

logger = logging.getLogger(__name__)


def _build_economic_summary(snapshot: dict) -> str:
    if not snapshot:
        return "  No economic data available (FRED_API_KEY not configured)."

    label_map = {
        "fed_rate":     "Fed Funds Rate",
        "cpi":          "CPI Index",
        "pce":          "PCE Index",
        "nfp":          "Nonfarm Payrolls (thousands)",
        "gdp":          "Real GDP (billions USD)",
        "unemployment": "Unemployment Rate (%)",
        "10y_treasury": "10-Year Treasury Yield (%)",
        "2y_treasury":  "2-Year Treasury Yield (%)",
        "vix":          "VIX",
    }
    lines = []
    for key, value in snapshot.items():
        label = label_map.get(key, key)
        lines.append(f"  {label}: {value:.2f}")
    return "\n".join(lines)


class FundamentalAnalystAgent(BaseAnalystAgent):
    """
    Analyses macroeconomic backdrop (Fed rates, inflation, employment, GDP)
    and assesses implications for equity index futures.
    """

    name = "fundamental_analyst"

    def analyse(
        self,
        symbol: str,
        economic_snapshot: dict | None = None,
    ) -> dict[str, Any]:
        """
        Run fundamental analysis.

        Parameters
        ----------
        symbol            : Futures short code (e.g. "ES")
        economic_snapshot : Pre-fetched FRED data dict (optional; fetched if None).
        """
        snapshot = economic_snapshot
        if snapshot is None:
            snapshot = get_latest_economic_snapshot()

        economic_summary = _build_economic_summary(snapshot)

        human_prompt = FUNDAMENTAL_ANALYST_HUMAN.format(
            symbol=symbol,
            economic_summary=economic_summary,
        )

        result = self._call_llm(FUNDAMENTAL_ANALYST_SYSTEM, human_prompt)
        result.setdefault("agent", self.name)
        result.setdefault("bias", "neutral")
        result.setdefault("backdrop", "uncertain")
        result.setdefault("confidence", 0.0)
        result.setdefault("signals", [])
        return result
