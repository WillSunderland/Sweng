from __future__ import annotations

from typing import Any, TypedDict


class GraphState(TypedDict):
    query: str
    processedQuery: str
    searchResults: list[dict[str, Any]]
    response: dict[str, Any]
    error: str | None

    # LLM additions
    llm_response: str | None
    model_used: str | None
    provider_used: str | None
    token_count: int | None
    route_decision: str | None
