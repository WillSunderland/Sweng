from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.config import getSettings
from app.graph.state import GraphState
from app.prompts.rag_prompt import SYSTEM_PROMPT, build_rag_user_prompt
from app.services.nvidia_client import NvidiaLLMClient
from app.services.hf_client import HuggingFaceLLMClient

logger = logging.getLogger(__name__)

# Module-level clients
nvidia_client = NvidiaLLMClient()
hf_client = HuggingFaceLLMClient()
settings = getSettings()

JSON_BLOCK_RE = re.compile(r"(\{.*\}|\[.*\])", re.DOTALL)


def _reasoning_step(
    state: GraphState, node: str, detail: str, status: str = "completed"
) -> list[dict[str, Any]]:
    steps = list(state.get("reasoning_steps", []))
    steps.append({"node": node, "status": status, "detail": detail})
    return steps


def _chat_excerpt(chat_history: list[dict[str, str]]) -> str:
    if not chat_history:
        return "No chat history provided."

    lines = []
    for message in chat_history[-6:]:
        role = message.get("role", "user").upper()
        content = message.get("content", "").strip()
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines) if lines else "No chat history provided."


def _extract_json_payload(content: str) -> Any:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json\n", "", 1).replace("JSON\n", "", 1)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = JSON_BLOCK_RE.search(cleaned)
        if not match:
            raise
        return json.loads(match.group(1))


async def _generate_control_json(
    system_prompt: str,
    user_prompt: str,
    *,
    fallback: dict[str, Any],
) -> dict[str, Any]:
    try:
        response = await nvidia_client.generate(
            system_prompt,
            user_prompt,
            temperature=0.0,
            max_tokens=400,
        )
        payload = _extract_json_payload(response.content)
        if isinstance(payload, dict):
            return payload
    except Exception as exc:
        logger.warning("Nvidia control node failed, attempting HF fallback: %s", exc)

    try:
        response = await hf_client.generate(
            system_prompt,
            user_prompt,
            temperature=0.0,
            max_tokens=400,
        )
        payload = _extract_json_payload(response.content)
        if isinstance(payload, dict):
            return payload
    except Exception as exc:
        logger.warning("HF control node failed, using heuristic fallback: %s", exc)

    return fallback


async def queryRewriteNode(state: GraphState) -> dict[str, Any]:
    query = state.get("query", "").strip()
    chat_history = list(state.get("chat_history", []))

    if not chat_history:
        return {
            "processedQuery": query,
            "rewrittenQuery": query,
            "standaloneQuery": query,
            "reasoning_steps": _reasoning_step(
                state,
                "rewrite",
                "No follow-up context supplied, so the original query was used unchanged.",
            ),
        }

    fallback_query = (
        f"{query} (conversation context: {_chat_excerpt(chat_history[-2:])})"
    )
    payload = await _generate_control_json(
        "Rewrite follow-up legislative research questions into standalone search-ready queries. Respond with JSON only.",
        (
            "Return JSON with keys rewritten_query and reason.\n\n"
            f"Chat history:\n{_chat_excerpt(chat_history)}\n\n"
            f"Current user query:\n{query}"
        ),
        fallback={
            "rewritten_query": fallback_query,
            "reason": "Fallback rewrite concatenated the latest conversation context.",
        },
    )

    rewritten_query = str(payload.get("rewritten_query") or query).strip()
    reason = str(
        payload.get("reason") or "Query rewritten for follow-up continuity."
    ).strip()

    return {
        "processedQuery": rewritten_query,
        "rewrittenQuery": rewritten_query,
        "standaloneQuery": rewritten_query,
        "currentSearchQuery": rewritten_query,
        "reasoning_steps": _reasoning_step(
            state,
            "rewrite",
            f"{reason} Rewritten query: {rewritten_query}",
        ),
    }


async def planNode(state: GraphState) -> dict[str, Any]:
    query = (
        state.get("standaloneQuery")
        or state.get("processedQuery")
        or state.get("query", "")
    )
    complex_query = any(
        token in query.lower()
        for token in ["compare", "difference", "impact", "analyze", "steps", "timeline"]
    )
    fallback_plan = [
        "Clarify the question using prior chat context if needed.",
        "Decide whether chat context alone is enough or whether retrieval is required.",
        (
            "Retrieve legislative passages and synthesize a cited answer."
            if complex_query
            else "Answer concisely with the available grounded context."
        ),
    ]

    payload = await _generate_control_json(
        "Create concise research plans for a legislative RAG agent. Respond with JSON only.",
        (
            "Return JSON with keys plan (array of strings) and search_query (string).\n\n"
            f"Standalone query:\n{query}"
        ),
        fallback={
            "plan": fallback_plan,
            "search_query": query,
        },
    )

    plan = payload.get("plan") or fallback_plan
    if not isinstance(plan, list):
        plan = fallback_plan
    plan = [str(item).strip() for item in plan if str(item).strip()]
    if not plan:
        plan = fallback_plan

    search_query = str(payload.get("search_query") or query).strip() or query

    return {
        "plan": plan,
        "currentSearchQuery": search_query,
        "reasoning_steps": _reasoning_step(
            state,
            "plan",
            f"Planned {len(plan)} reasoning steps. Initial search query: {search_query}",
        ),
    }


async def prefetchDecisionNode(state: GraphState) -> dict[str, Any]:
    query = state.get("standaloneQuery") or state.get("query", "")
    chat_history = list(state.get("chat_history", []))
    lower_query = query.lower()

    heuristic_skip = bool(chat_history) and any(
        phrase in lower_query
        for phrase in [
            "what did you say",
            "summarize that",
            "repeat that",
            "rephrase that",
            "your previous answer",
        ]
    )

    payload = await _generate_control_json(
        "Decide if a legislative assistant can answer from chat context alone or needs document retrieval. Respond with JSON only.",
        (
            "Return JSON with keys needs_retrieval (boolean) and reason (string).\n\n"
            f"Chat history:\n{_chat_excerpt(chat_history)}\n\n"
            f"Standalone query:\n{query}"
        ),
        fallback={
            "needs_retrieval": not heuristic_skip,
            "reason": "Fallback heuristic used chat-history-only only for explicit requests about the prior answer.",
        },
    )

    needs_retrieval = bool(payload.get("needs_retrieval", True))
    reason = str(payload.get("reason") or "Prefetch decision computed.").strip()
    decision = "search" if needs_retrieval else "context_only"

    return {
        "shouldFetch": needs_retrieval,
        "prefetchDecision": decision,
        "reasoning_steps": _reasoning_step(
            state,
            "prefetch_decision",
            f"{reason} Decision: {decision}.",
        ),
    }


async def readNode(state: GraphState) -> dict[str, Any]:
    query = state.get("standaloneQuery") or state.get("query", "")
    hits = list(state.get("searchResults", []))
    max_steps = int(state.get("max_reasoning_steps", settings.max_reasoning_steps))
    search_iteration = int(state.get("search_iteration", 0))

    if not hits:
        note = "No documents were retrieved, so the graph will answer with the current context only."
        return {
            "readNotes": list(state.get("readNotes", [])) + [note],
            "followUpQuery": None,
            "reasoning_steps": _reasoning_step(state, "read", note),
        }

    titles = [hit.get("_source", {}).get("title", "Unknown Source") for hit in hits[:3]]
    unique_titles = {title for title in titles if title}
    needs_more_context = (
        "compare" in query.lower()
        and len(unique_titles) < 2
        and search_iteration < max_steps
    )
    follow_up_query = f"{query} comparison details" if needs_more_context else None

    payload = await _generate_control_json(
        "Read retrieved legislative snippets and decide whether another search is needed. Respond with JSON only.",
        (
            "Return JSON with keys enough_context (boolean), summary (string), and follow_up_query (string).\n\n"
            f"Question:\n{query}\n\n"
            "Retrieved snippets:\n"
            + "\n\n".join(
                f"Title: {hit.get('_source', {}).get('title', 'Unknown')}\n"
                f"Snippet: {hit.get('_source', {}).get('chunk_text', '')[:500]}"
                for hit in hits[:3]
            )
        ),
        fallback={
            "enough_context": not needs_more_context,
            "summary": f"Reviewed {len(hits)} documents, including {', '.join(titles)}.",
            "follow_up_query": follow_up_query or "",
        },
    )

    enough_context = bool(payload.get("enough_context", True))
    summary = str(
        payload.get("summary") or f"Reviewed {len(hits)} retrieved documents."
    ).strip()
    if search_iteration >= max_steps:
        enough_context = True

    follow_up_query = str(payload.get("follow_up_query") or "").strip() or None
    if enough_context or search_iteration >= max_steps:
        follow_up_query = None

    return {
        "readNotes": list(state.get("readNotes", [])) + [summary],
        "followUpQuery": follow_up_query,
        "reasoning_steps": _reasoning_step(
            state,
            "read",
            f"{summary} {'Another search will run.' if follow_up_query else 'Current context is sufficient for answering.'}",
        ),
    }


def prefetchRoute(state: GraphState) -> str:
    return (
        "search"
        if state.get("prefetchDecision", "search") == "search"
        else "context_only"
    )


def readLoopRoute(state: GraphState) -> str:
    if state.get("followUpQuery"):
        return "search_again"
    return "answer"


def routerNode(state: GraphState) -> dict[str, Any]:
    """Decides which LLM provider to use based on query complexity."""
    if state.get("error"):
        logger.warning("Upstream error detected, routing to Nvidia for robust handling")
        return {"route_decision": "nvidia"}

    query = (state.get("rewrittenQuery") or state.get("processedQuery") or "").lower()
    results = state.get("accumulatedSources") or state.get("searchResults", [])
    # Complex query indicators
    complex_indicators = [
        "compare",
        "vs",
        "versus",
        "difference between",
        "implications",
        "impact",
        "analyze",
        "explain",
        "what if",
        "how does",
        "multiple",
    ]

    is_complex = any(indicator in query for indicator in complex_indicators)
    result_count = len(results)

    # Routing logic
    if (
        result_count <= settings.simple_query_threshold
        and result_count > 0
        and not is_complex
    ):
        decision = "huggingface"
    else:
        decision = "nvidia"

    logger.info(
        f"Router decision: {decision} (complex={is_complex}, results={result_count})"
    )
    return {"route_decision": decision}


async def nvidiaLlmNode(state: GraphState) -> dict[str, Any]:
    """Calls Nvidia LLM, falls back to HuggingFace on failure."""
    query = state.get("standaloneQuery") or state.get("query", "")
    documents = [
        hit.get("_source", {})
        for hit in (state.get("accumulatedSources") or state.get("searchResults", []))
    ]

    user_prompt = build_rag_user_prompt(
        query,
        documents,
        chat_history=list(state.get("chat_history", [])),
        reasoning_notes=list(state.get("readNotes", [])),
        retrieval_skipped=not state.get("shouldFetch", True),
    )
    try:
        response = await nvidia_client.generate(SYSTEM_PROMPT, user_prompt)
        return {
            "llm_response": response.content,
            "model_used": response.model,
            "provider_used": response.provider,
            "token_count": response.total_tokens,
            "reasoning_steps": _reasoning_step(
                state,
                "answer",
                f"Nvidia generated the final answer using {len(documents)} retrieved documents.",
            ),
        }
    except Exception as e:
        logger.error(f"Nvidia node failed: {e}. Falling back to HuggingFace.")
        # Fallback to HF
        return await hfLlmNode(state)


async def hfLlmNode(state: GraphState) -> dict[str, Any]:
    """Calls local HuggingFace LLM."""
    query = state.get("standaloneQuery") or state.get("query", "")
    documents = [
        hit.get("_source", {})
        for hit in (state.get("accumulatedSources") or state.get("searchResults", []))
    ]

    user_prompt = build_rag_user_prompt(
        query,
        documents,
        chat_history=list(state.get("chat_history", [])),
        reasoning_notes=list(state.get("readNotes", [])),
        retrieval_skipped=not state.get("shouldFetch", True),
    )
    try:
        response = await hf_client.generate(SYSTEM_PROMPT, user_prompt)
        return {
            "llm_response": response.content,
            "model_used": response.model,
            "provider_used": response.provider,
            "token_count": response.total_tokens,
            "reasoning_steps": _reasoning_step(
                state,
                "answer",
                f"HuggingFace generated the final answer using {len(documents)} retrieved documents.",
            ),
        }
    except Exception as e:
        logger.error(f"HuggingFace node failed: {e}")
        return {
            "error": f"LLM generation failed: {str(e)}",
            "reasoning_steps": _reasoning_step(
                state,
                "answer",
                f"HuggingFace failed to generate an answer: {e}",
                "failed",
            ),
        }
