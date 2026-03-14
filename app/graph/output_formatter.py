from __future__ import annotations

import logging
from typing import Any
from app.graph.state import GraphState
from app.services.carbon_estimator import estimate_carbon_tons

logger = logging.getLogger(__name__)


def llmOutputNode(state: GraphState) -> dict[str, Any]:
    """Formats the final response including LLM answer and sources."""
    error = state.get("error")

    # If there's an error and no LLM response (fallback failed too)
    if error and not state.get("llm_response"):
        carbon_count_in_tons = estimate_carbon_tons(
            state.get("model_used"),
            state.get("provider_used"),
        )
        return {
            "response": {
                "answer": f"I encountered an error processing your request: {error}",
                "sources": [],
                "model_used": None,
                "provider": None,
                "carbonCountInTons": carbon_count_in_tons,
                "token_count": 0,
                "error": error,
                "rewritten_query": state.get("rewrittenQuery"),
                "plan": list(state.get("plan", [])),
                "reasoning_steps": list(state.get("reasoning_steps", [])),
                "retrieval_skipped": not state.get("shouldFetch", True),
            }
        }

    # Extract sources from search results
    hits = state.get("accumulatedSources") or state.get("searchResults", [])
    formatted_sources = []

    for hit in hits:
        source_data = hit.get("_source", {})
        formatted_sources.append({
            "title": source_data.get("title", "Unknown"),
            "bill_id": source_data.get("bill_id", ""),
            "state": source_data.get("state", ""),
            "bill_type": source_data.get("bill_type", ""),
            "bill_number": source_data.get("bill_number", ""),
            "session": source_data.get("session", ""),
            "policy_area": source_data.get("policy_area", ""),
            "source_file": f"{source_data.get('state', '')} {source_data.get('bill_type', '')} {source_data.get('bill_number', '')}".strip(),
            "relevance_score": hit.get("_score", 0.0)
        })

    carbon_count_in_tons = estimate_carbon_tons(
        state.get("model_used"),
        state.get("provider_used"),
    )
    return {
        "response": {
            "answer": state.get("llm_response", "No answer generated."),
            "sources": formatted_sources,
            "model_used": state.get("model_used"),
            "provider": state.get("provider_used"),
            "carbonCountInTons": carbon_count_in_tons,
            "token_count": state.get("token_count", 0),
            "error": None,
            "rewritten_query": state.get("rewrittenQuery"),
            "plan": list(state.get("plan", [])),
            "reasoning_steps": list(state.get("reasoning_steps", [])),
            "retrieval_skipped": not state.get("shouldFetch", True),
        }
    }
