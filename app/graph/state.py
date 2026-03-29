from __future__ import annotations

from typing import Any, TypedDict


class GraphState(TypedDict, total=False):
    query: str
    chat_history: list[dict[str, str]]
    max_reasoning_steps: int
    processedQuery: str
    rewrittenQuery: str
    standaloneQuery: str
    currentSearchQuery: str
    followUpQuery: str | None
    plan: list[str]
    reasoning_steps: list[dict[str, Any]]
    searchQueries: list[str]
    accumulatedSources: list[dict[str, Any]]
    readNotes: list[str]
    prefetchDecision: str
    shouldFetch: bool
    search_iteration: int
    finalContext: str
    searchResults: list[dict[str, Any]]
    response: dict[str, Any]
    error: str | None

    # LLM additions
    llm_response: str | None
    model_used: str | None
    provider_used: str | None
    token_count: int | None
    route_decision: str | None
