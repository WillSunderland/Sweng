from __future__ import annotations

import logging
from typing import Any

from opensearchpy import OpenSearch
from sentence_transformers import CrossEncoder

from app.config import getSettings
from app.graph.state import GraphState

logger = logging.getLogger(__name__)
settings = getSettings()

_cross_encoder_model = None


def _get_cross_encoder() -> CrossEncoder:
    global _cross_encoder_model
    if _cross_encoder_model is None:
        logger.info("Loading cross-encoder model: cross-encoder/ms-marco-MiniLM-L-6-v2")
        _cross_encoder_model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
    return _cross_encoder_model

def _reasoning_step(
    state: GraphState, node: str, detail: str, status: str = "completed"
) -> list[dict[str, Any]]:
    steps = list(state.get("reasoning_steps", []))
    steps.append({"node": node, "status": status, "detail": detail})
    return steps


def _merge_hits(
    existing: list[dict[str, Any]], new_hits: list[dict[str, Any]]
) -> list[dict[str, Any]]:
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

def _text_similarity(text1: str, text2: str) -> float:
    """Jaccard similarity between two texts based on word overlap."""
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    if not words1 or not words2:
        return 0.0
    return len(words1 & words2) / len(words1 | words2)


def _mmr_rerank(hits: list[dict[str, Any]], top_k: int, lambda_param: float = 0.7) -> list[dict[str, Any]]:
    """
    Maximum Marginal Relevance re-ranking using text similarity.
    Balances relevance (BM25 score) with diversity across chunks.
    """
    if len(hits) <= top_k:
        return hits

    top_score = hits[0].get("_score", 1.0) or 1.0
    selected: list[dict[str, Any]] = []
    remaining = list(hits)

    for _ in range(top_k):
        if not remaining:
            break

        if not selected:
            selected.append(remaining.pop(0))
            continue

        best_idx = None
        best_score = -float("inf")

        for i, candidate in enumerate(remaining):
            candidate_text = candidate.get("_source", {}).get("chunk_text", "")
            rel = (candidate.get("_score", 0.0) or 0.0) / top_score

            max_sim = max(
                _text_similarity(candidate_text, s.get("_source", {}).get("chunk_text", ""))
                for s in selected
            )

            mmr_score = lambda_param * rel - (1 - lambda_param) * max_sim

            if mmr_score > best_score:
                best_score = mmr_score
                best_idx = i

        if best_idx is not None:
            selected.append(remaining.pop(best_idx))

    return selected


def _cross_encoder_rerank(query: str, hits: list[dict[str, Any]], top_k: int) -> list[dict[str, Any]]:
    """
    Cross-encoder reranking — scores each (query, chunk) pair together
    for more accurate relevance than BM25 or embedding similarity alone.
    """
    if len(hits) <= top_k:
        return hits

    if not settings.nvidia_api_key:
        # Demo fallback: avoid loading heavy reranker on CPU-only/no-key setups.
        return hits[:top_k]

    try:
        model = _get_cross_encoder()
        pairs = [(query, h.get("_source", {}).get("chunk_text", "")) for h in hits]
        scores = model.predict(pairs)

        scored = sorted(zip(hits, scores), key=lambda x: x[1], reverse=True)
        return [h for h, _ in scored[:top_k]]
    except Exception as exc:
        logger.warning("Cross-encoder failed, falling back to MMR results: %s", exc)
        return hits[:top_k]


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
                "reasoning_steps": _reasoning_step(
                    state,
                    "search",
                    "Search skipped because the query was empty.",
                    "failed",
                ),
            }

        search_iteration = int(state.get("search_iteration", 0)) + 1

        try:
             # Step 1: BM25 — fetch large candidate pool
            fetch_k = max(settings.search_top_k * 4, 20)
            body = {
                "size": fetch_k,
                "query": {
                    "multi_match": {
                        "query": query,
                        "fields": [
                            "title^3",
                            "chunk_text^5",
                            "policy_area^2",
                            "latest_action",
                        ],
                        "type": "best_fields",
                    }
                },
            }
            try:
                raw = client.search(index=index, body=body, request_timeout=8)
            except TypeError:
                # Test doubles may not support request_timeout.
                raw = client.search(index=index, body=body)
            raw_hits = raw.get("hits", {}).get("hits", [])

            # Step 2: MMR — pick diverse candidates (fetch_k → mmr_k)
            mmr_k = min(len(raw_hits), settings.search_top_k * 2)
            mmr_hits = _mmr_rerank(raw_hits, top_k=mmr_k)

            # Step 3: Cross-encoder — pick most relevant (mmr_k → top_k)
            hits = _cross_encoder_rerank(query, mmr_hits, top_k=settings.search_top_k)
            accumulated = _merge_hits(list(state.get("accumulatedSources", [])), hits)
            unique_titles = len(
                {
                    h.get("_source", {}).get("title", "")
                    for h in accumulated
                    if h.get("_source", {}).get("title")
                }
            )

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
                    f"Search iteration {search_iteration}: BM25 fetched {len(raw_hits)}, MMR selected {len(mmr_hits)} diverse, cross-encoder ranked to {len(hits)} across {unique_titles} unique titles.",
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
