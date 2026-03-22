from __future__ import annotations

import logging
from typing import Any

from opensearchpy import OpenSearch

from app.config import getSettings
from app.graph.state import GraphState

logger = logging.getLogger(__name__)
settings = getSettings()


def _reasoning_step(state: GraphState, node: str, detail: str, status: str = "completed") -> list[dict[str, Any]]:
    steps = list(state.get("reasoning_steps", []))
    steps.append({"node": node, "status": status, "detail": detail})
    return steps


def _merge_hits(existing: list[dict[str, Any]], new_hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    seen: set[str] = set()

    for hit in existing + new_hits:
        source = hit.get("_source", {})
        key = "|".join(
            [
                str(hit.get("_id", "")),
                str(source.get("bill_id", "")),
                str(source.get("chunk_id", "")),
            ]
        )
        if key in seen:
            continue
        seen.add(key)
        merged.append(hit)
    return merged


def _build_context_summary(hits: list[dict[str, Any]]) -> str:
    if not hits:
        return "No documents were retrieved."

    lines = []
    for hit in hits[:5]:
        source = hit.get("_source", {})
        title = source.get("title", "Unknown Source")
        chunk = (source.get("chunk_text", "") or "").strip().replace("\n", " ")
        snippet = chunk[:220]
        lines.append(f"{title}: {snippet}")
    return "\n".join(lines)


def inputNode(state: GraphState) -> dict[str, Any]:
    query = state.get("query", "").strip()
    chat_history = list(state.get("chat_history", []))
    max_steps = state.get("max_reasoning_steps") or settings.max_reasoning_steps

    return {
        "query": query,
        "processedQuery": query,
        "rewrittenQuery": query,
        "standaloneQuery": query,
        "chat_history": chat_history,
        "plan": list(state.get("plan", [])),
        "reasoning_steps": _reasoning_step(
            state,
            "input",
            f"Initialized request with {len(chat_history)} prior chat messages.",
        ),
        "searchQueries": list(state.get("searchQueries", [])),
        "searchResults": list(state.get("searchResults", [])),
        "accumulatedSources": list(state.get("accumulatedSources", [])),
        "readNotes": list(state.get("readNotes", [])),
        "response": dict(state.get("response", {})),
        "error": state.get("error"),
        "search_iteration": int(state.get("search_iteration", 0)),
        "max_reasoning_steps": int(max_steps),
        "prefetchDecision": state.get("prefetchDecision", "search"),
        "shouldFetch": state.get("shouldFetch", True),
        "currentSearchQuery": state.get("currentSearchQuery", query),
        "followUpQuery": state.get("followUpQuery"),
    }


def makeSearchNode(client: OpenSearch, index: str):
    def searchNode(state: GraphState) -> dict[str, Any]:
        query = (
            state.get("followUpQuery")
            or state.get("currentSearchQuery")
            or state.get("standaloneQuery")
            or state.get("processedQuery")
            or state.get("query", "")
        ).strip()

        if not query:
            return {
                "error": "Search query is empty.",
                "reasoning_steps": _reasoning_step(state, "search", "Search skipped because the query was empty.", "failed"),
            }

        search_iteration = int(state.get("search_iteration", 0)) + 1

        try:
            body = {
                "size": settings.search_top_k,
                "query": {
                    "multi_match": {
                        "query": query,
                        "fields": ["title^3", "chunk_text^5", "policy_area^2", "latest_action"],
                        "type": "best_fields",
                    }
                },
            }
            raw = client.search(index=index, body=body)
            hits = raw.get("hits", {}).get("hits", [])
            accumulated = _merge_hits(list(state.get("accumulatedSources", [])), hits)
            unique_titles = len({h.get("_source", {}).get("title", "") for h in accumulated if h.get("_source", {}).get("title")})

            return {
                "search_iteration": search_iteration,
                "currentSearchQuery": query,
                "followUpQuery": None,
                "searchQueries": list(state.get("searchQueries", [])) + [query],
                "searchResults": hits,
                "accumulatedSources": accumulated,
                "finalContext": _build_context_summary(accumulated),
                "reasoning_steps": _reasoning_step(
                    state,
                    "search",
                    f"Search iteration {search_iteration} returned {len(hits)} hits across {unique_titles} unique titles.",
                ),
            }
        except Exception as exc:
            logger.exception("Search node failed")
            return {
                "error": f"Document retrieval failed: {exc}",
                "search_iteration": search_iteration,
                "reasoning_steps": _reasoning_step(
                    state,
                    "search",
                    f"Search iteration {search_iteration} failed: {exc}",
                    "failed",
                ),
            }

    return searchNode
