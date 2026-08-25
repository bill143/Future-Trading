"""
analysis/agents/base_agent.py
Base class for all LangChain analyst agents.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from analysis.config.config import (
    DEFAULT_LLM_MODEL,
    DEFAULT_LLM_PROVIDER,
    LLM_TEMPERATURE,
)

logger = logging.getLogger(__name__)


def build_llm(
    provider: str | None = None,
    model: str | None = None,
    temperature: float = LLM_TEMPERATURE,
) -> Any:
    """
    Build a LangChain LLM client based on the configured provider.

    Supported providers: openai, anthropic, groq
    Falls back to a mock LLM when no API key is available (for testing).
    """
    _provider = (provider or os.getenv("LLM_PROVIDER") or DEFAULT_LLM_PROVIDER).lower()
    _model    = model or os.getenv("LLM_MODEL") or DEFAULT_LLM_MODEL

    if _provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=_model, temperature=temperature)

    if _provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(model=_model, temperature=temperature)  # type: ignore[call-arg]

    if _provider == "groq":
        from langchain_groq import ChatGroq
        return ChatGroq(model=_model, temperature=temperature)

    raise ValueError(f"Unsupported LLM provider: '{_provider}'. Choose openai, anthropic, or groq.")


class BaseAnalystAgent:
    """Minimal base class for analyst agents that call an LLM."""

    name: str = "base_agent"

    def __init__(
        self,
        provider: str | None = None,
        model: str | None = None,
        temperature: float = LLM_TEMPERATURE,
    ) -> None:
        self.llm = build_llm(provider, model, temperature)

    def _parse_json_response(self, text: str) -> dict[str, Any]:
        """Extract and parse the first JSON object from an LLM response."""
        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try to extract JSON block from markdown code fence
        import re
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # Try to find any JSON object
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        logger.warning("[%s] Could not parse JSON from LLM response.", self.name)
        return {}

    def _call_llm(self, system_prompt: str, human_prompt: str) -> dict[str, Any]:
        """Call the LLM with system + human messages and return parsed JSON."""
        from langchain_core.messages import HumanMessage, SystemMessage

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_prompt),
        ]
        try:
            response = self.llm.invoke(messages)
            return self._parse_json_response(response.content)
        except Exception as exc:
            logger.error("[%s] LLM call failed: %s", self.name, exc)
            return {"agent": self.name, "error": str(exc), "bias": "neutral", "confidence": 0.0}
