from __future__ import annotations

import logging
import re
from typing import Any
from app.graph.state import GraphState
from app.services.carbon_estimator import estimate_carbon_tons

logger = logging.getLogger(__name__)

CITATION_PATTERN = re.compile(r"\[Source:\s*([^\]]+)\]")


def _extract_citations(answer: str) -> list[str]:
    return [m.strip() for m in CITATION_PATTERN.findall(answer)]


def _validate_citations(cited_titles: list[str], retrieved_sources: list[dict]) -> dict:
    retrieved_titles = {s.get("title", "").strip() for s in retrieved_sources}
    valid, hallucinated = [], []
    for title in cited_titles:
        matched = any(
            title.lower() in rt.lower() or rt.lower() in title.lower()
            for rt in retrieved_titles
        )
        if matched:
            valid.append(title)
        else:
            hallucinated.append(title)
    uncited = [
        t
        for t in retrieved_titles
        if not any(
            t.lower() in c.lower() or c.lower() in t.lower() for c in cited_titles
        )
    ]
    total = len(cited_titles)
    return {
        "valid_citations": valid,
        "hallucinated_citations": hallucinated,
        "uncited_sources": uncited,
        "citation_accuracy": round(len(valid) / total if total > 0 else 1.0, 2),
    }


def llmOutputNode(state: GraphState) -> dict[str, Any]:
    """Formats the final response including LLM answer, sources, and citation validation."""
    error = state.get("error")

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
                "citation_validation": None,
            }
        }

    hits = state.get("accumulatedSources") or state.get("searchResults", [])
    formatted_sources = []

    for hit in hits:
        source_data = hit.get("_source", {})
        formatted_sources.append(
            {
                "title": source_data.get("title", "Unknown"),
                "bill_id": source_data.get("bill_id", ""),
                "state": source_data.get("state", ""),
                "bill_type": source_data.get("bill_type", ""),
                "bill_number": source_data.get("bill_number", ""),
                "session": source_data.get("session", ""),
                "policy_area": source_data.get("policy_area", ""),
                "source_file": f"{source_data.get('state', '')} {source_data.get('bill_type', '')} {source_data.get('bill_number', '')}".strip(),
                "relevance_score": hit.get("_score", 0.0),
            }
        )

    answer = state.get("llm_response", "No answer generated.")
    cited_titles = _extract_citations(answer)
    citation_validation = _validate_citations(cited_titles, formatted_sources)

    if citation_validation["hallucinated_citations"]:
        logger.warning(
            "Hallucinated citations detected: %s",
            citation_validation["hallucinated_citations"],
        )

    carbon_count_in_tons = estimate_carbon_tons(
        state.get("model_used"),
        state.get("provider_used"),
    )

    return {
        "response": {
            "answer": answer,
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
            "citation_validation": citation_validation,
        }
    }
