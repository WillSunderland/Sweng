from __future__ import annotations

import logging
import re
from typing import Any
from app.graph.state import GraphState
from app.services.carbon_estimator import estimate_carbon_tons

logger = logging.getLogger(__name__)

CITATION_PATTERN = re.compile(r"\[Source:\s*([^\]]+)\]")

# Pattern to find «VERBATIM»...«/VERBATIM» blocks (with optional trailing citation)
VERBATIM_PATTERN = re.compile(
    r"\u00abVERBATIM\u00bb(.*?)\u00ab/VERBATIM\u00bb\s*(?:\[Source:\s*([^\]]+)\])?",
    re.DOTALL,
)


def _extract_citations(answer: str) -> list[str]:
    return [m.strip() for m in CITATION_PATTERN.findall(answer)]


def _normalize_title(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().lower()


def _titles_match(left: str, right: str) -> bool:
    norm_left = _normalize_title(left)
    norm_right = _normalize_title(right)
    if not norm_left or not norm_right:
        return False
    return norm_left in norm_right or norm_right in norm_left


def _clean_segment_text(text: str) -> str:
    without_citations = CITATION_PATTERN.sub("", text)
    return re.sub(r"\s+", " ", without_citations).strip()


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


def _find_source_for_title(title: str, formatted_sources: list[dict]) -> dict | None:
    """Fuzzy-match a cited title to a formatted source dict."""
    for src in formatted_sources:
        src_title = src.get("title", "")
        if _titles_match(title, src_title):
            return src
    return None


def _find_hit_for_title(title: str, hits: list[dict]) -> dict | None:
    """Find the first retrieved hit whose title matches the cited title."""
    for hit in hits:
        hit_source = hit.get("_source", {})
        if _titles_match(title, hit_source.get("title", "")):
            return hit
    return None


def _build_citation_meta(title: str, source: dict | None, hit: dict | None) -> dict:
    """Build a CitationMeta-compatible dict from a source and its search hit."""
    hit_source = (hit or {}).get("_source", {})
    resolved_bill_id = (
        (source or {}).get("bill_id", "")
        or hit_source.get("bill_id", "")
        or (hit or {}).get("bill_id", "")
    )
    resolved_chunk_id = (
        (source or {}).get("chunk_id", "")
        or hit_source.get("chunk_id", "")
        or (hit or {}).get("chunk_id", "")
        or (hit or {}).get("_id", "")
    )
    resolved_title = (
        (source or {}).get("title", "") or hit_source.get("title", "") or title
    )

    if source is None:
        return {
            "source_id": resolved_bill_id or "",
            "title": resolved_title,
            "bill_id": resolved_bill_id,
            "chunk_id": resolved_chunk_id,
            "bill_type": hit_source.get("bill_type", "") or (hit or {}).get("bill_type", ""),
            "bill_number": hit_source.get("bill_number", "")
            or (hit or {}).get("bill_number", ""),
            "session": hit_source.get("session", "") or (hit or {}).get("session", ""),
            "state": hit_source.get("state", "") or (hit or {}).get("state", ""),
            "policy_area": hit_source.get("policy_area", "")
            or (hit or {}).get("policy_area", ""),
            "relevance_score": (hit or {}).get("_score", 0.0) or 0.0,
        }
    return {
        "source_id": (source or {}).get("source_id", "") or resolved_bill_id,
        "title": resolved_title,
        "bill_id": resolved_bill_id,
        "chunk_id": resolved_chunk_id,
        "bill_type": source.get("bill_type", ""),
        "bill_number": source.get("bill_number", ""),
        "session": source.get("session", ""),
        "state": source.get("state", ""),
        "policy_area": source.get("policy_area", ""),
        "relevance_score": source.get("relevance_score", 0.0),
    }


def _build_citations_for_titles(
    cited_titles: list[str],
    formatted_sources: list[dict],
    hits: list[dict],
) -> list[dict]:
    citations: list[dict] = []
    seen: set[tuple[str, str, str]] = set()

    for cited_title in cited_titles:
        source = _find_source_for_title(cited_title, formatted_sources)
        hit_match = _find_hit_for_title(cited_title, hits)
        citation = _build_citation_meta(cited_title, source, hit_match)
        key = (
            citation.get("source_id", ""),
            citation.get("chunk_id", ""),
            citation.get("title", ""),
        )
        if key in seen:
            continue
        seen.add(key)
        citations.append(citation)

    return citations


def _build_structured_segments(
    answer: str,
    formatted_sources: list[dict],
    hits: list[dict],
) -> list[dict]:
    """Parse the LLM answer into an ordered list of generated/verbatim segments."""
    segments: list[dict] = []
    last_end = 0

    for match in VERBATIM_PATTERN.finditer(answer):
        # Any text before this verbatim block is AI-generated
        preceding_text = answer[last_end : match.start()].strip()
        if preceding_text:
            clean_preceding = _clean_segment_text(preceding_text)
            gen_citations = _build_citations_for_titles(
                _extract_citations(preceding_text),
                formatted_sources,
                hits,
            )
            if clean_preceding:
                segments.append(
                    {
                        "type": "generated",
                        "text": clean_preceding,
                        "citations": gen_citations,
                    }
                )

        # The verbatim block itself
        verbatim_text = match.group(1).strip()
        cited_title = (match.group(2) or "").strip()

        citations = (
            _build_citations_for_titles([cited_title], formatted_sources, hits)
            if cited_title
            else []
        )

        if verbatim_text:
            segments.append(
                {
                    "type": "verbatim",
                    "text": verbatim_text,
                    "citations": citations,
                }
            )

        last_end = match.end()

    # Any remaining text after the last verbatim block
    trailing_text = answer[last_end:].strip()
    if trailing_text:
        clean_trailing = _clean_segment_text(trailing_text)
        trail_citations = _build_citations_for_titles(
            _extract_citations(trailing_text),
            formatted_sources,
            hits,
        )
        if clean_trailing:
            segments.append(
                {
                    "type": "generated",
                    "text": clean_trailing,
                    "citations": trail_citations,
                }
            )

    # Fallback: if no verbatim tags were found, treat entire answer as generated
    if not segments:
        clean_answer = _clean_segment_text(answer)
        all_citations = _build_citations_for_titles(
            _extract_citations(answer),
            formatted_sources,
            hits,
        )
        segments.append(
            {
                "type": "generated",
                "text": clean_answer or answer,
                "citations": all_citations,
            }
        )

    return segments


def _strip_verbatim_tags(answer: str) -> str:
    """Remove «VERBATIM»/«/VERBATIM» tags for the plain-text answer field."""
    return answer.replace("\u00abVERBATIM\u00bb", "").replace(
        "\u00ab/VERBATIM\u00bb", ""
    )


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
                "structured_answer": None,
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
                "source_id": source_data.get("bill_id", "") or hit.get("_id", ""),
                "bill_id": source_data.get("bill_id", ""),
                "chunk_id": source_data.get("chunk_id", "")
                or hit.get("chunk_id", "")
                or hit.get("_id", ""),
                "state": source_data.get("state", ""),
                "bill_type": source_data.get("bill_type", ""),
                "bill_number": source_data.get("bill_number", ""),
                "session": source_data.get("session", ""),
                "policy_area": source_data.get("policy_area", ""),
                "source_file": source_data.get("chunk_text", "")
                or source_data.get("source_file", "")
                or f"{source_data.get('state', '')} {source_data.get('bill_type', '')} {source_data.get('bill_number', '')}".strip(),
                "relevance_score": hit.get("_score", 0.0),
            }
        )

    raw_answer = state.get("llm_response", "No answer generated.")
    cited_titles = _extract_citations(raw_answer)
    citation_validation = _validate_citations(cited_titles, formatted_sources)

    if citation_validation["hallucinated_citations"]:
        logger.warning(
            "Hallucinated citations detected: %s",
            citation_validation["hallucinated_citations"],
        )

    # Build structured segments for trust UI
    segments = _build_structured_segments(raw_answer, formatted_sources, hits)

    # Clean answer: strip verbatim tags for the plain-text field
    clean_answer = _strip_verbatim_tags(raw_answer)

    carbon_count_in_tons = estimate_carbon_tons(
        state.get("model_used"),
        state.get("provider_used"),
    )

    return {
        "response": {
            "answer": clean_answer,
            "structured_answer": {
                "raw_answer": raw_answer,
                "segments": segments,
            },
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
