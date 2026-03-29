from __future__ import annotations

import json
import logging
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from typing import Annotated

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from fastapi import Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

import app.main as app_main
from app.config import getSettings as getAppSettings
from app.main import app as shared_app
from app.main import query_endpoint
from app.models import ChatMessage, QueryRequest, SourceInfo
from app.services.carbon_estimator import tons_to_grams
from backend.orchestrator.cache import QueryCache
from backend.orchestrator.config import getSettings as getOrchestratorSettings
from backend.orchestrator.auth import get_current_user, get_user_id
from backend.orchestrator.langsmith_tracing import (
    configure_langsmith_tracing,
    is_tracing_enabled,
    trace_node,
    build_trace_metadata,
)
try:
    from backend.orchestrator.semantic_retrieval import SemanticRetriever
except Exception as exc:  # pragma: no cover - fallback for runtime import issues
    logging.getLogger(__name__).warning(
        "Failed to import SemanticRetriever: %s", exc
    )

    class SemanticRetriever:  # type: ignore[no-redef]
        def get_index_stats(self):
            return {"ok": False, "error": "SemanticRetriever unavailable"}

from backend.orchestrator.url_utils import resolve_source_url

logger = logging.getLogger(__name__)

RUN_STATUS_COMPLETED = "completed"
RUN_STATUS_RUNNING = "running"
DEFAULT_TRUST_SCORE = 85
DEFAULT_CARBON_G = 0.3

VALID_PRIORITIES = {"high", "medium", "low"}
PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}

RUN_STORE: dict[str, dict] = {}
SOURCE_STORE: dict[str, dict] = {}
SESSION_STORE: dict[str, list[dict]] = {}
_query_cache = QueryCache(ttl_seconds=3600, max_size=100)
query_cache = _query_cache

_orch_settings = getOrchestratorSettings()
configure_langsmith_tracing(
    tracing_v2=_orch_settings.langchain_tracing_v2,
    endpoint=_orch_settings.langchain_endpoint,
    api_key=_orch_settings.langchain_api_key,
    project=_orch_settings.langchain_project,
)

app = shared_app
graph_app = None

CurrentUser = Annotated[dict, Depends(get_current_user)]


@app.get("/health")
async def health_check():
    return {"status": "ok"}


class CreateRunRequest(BaseModel):
    query: str
    chat_history: list[ChatMessage] = Field(default_factory=list)
    max_reasoning_steps: int | None = None
    session_id: str | None = None
    priority: str | None = None


def get_iso_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _infer_priority(query: str) -> str:
    high_indicators = ["urgent", "critical", "deadline", "immediate", "compliance"]
    low_indicators = ["general", "overview", "summary", "curious"]
    q_lower = query.lower()
    if any(kw in q_lower for kw in high_indicators):
        return "high"
    if any(kw in q_lower for kw in low_indicators):
        return "low"
    return "medium"


def _resolve_priority(priority: str | None, query: str) -> str:
    if priority in VALID_PRIORITIES:
        return priority
    return _infer_priority(query)


def _scoped_session_key(user_id: str, session_id: str) -> str:
    """Scope session keys by user so different users never share history."""
    return f"user_{user_id}_{session_id}"


def _store_sources(run_id: str, sources: list[SourceInfo | dict]) -> None:
    for idx, source in enumerate(sources, start=1):
        source_id = f"{run_id}_src_{idx:03d}"
        source_data = (
            source.model_dump()
            if hasattr(source, "model_dump")
            else (source if isinstance(source, dict) else {})
        )
        bill_id = source_data.get("bill_id", "")
        SOURCE_STORE[source_id] = {
            "sourceId": source_id,
            "documentId": source_data.get("source_id", "") or bill_id or source_id,
            "title": source_data.get("title", "Untitled"),
            "fullText": source_data.get("source_file", source_data.get("title", "")),
            "billId": bill_id,
            "congress": source_data.get("congress", ""),
            "chunkId": source_data.get("chunk_id", ""),
            "state": source_data.get("state", ""),
            "billType": source_data.get("bill_type", ""),
            "billNumber": source_data.get("bill_number", ""),
            "session": source_data.get("session", ""),
            "policyArea": source_data.get("policy_area", ""),
        }


def _store_run_result(run_id: str, result: dict, latency_ms: int | None = None) -> None:
    RUN_STORE[run_id]["result"] = result
    RUN_STORE[run_id]["status"] = RUN_STATUS_COMPLETED
    RUN_STORE[run_id]["updatedAt"] = get_iso_timestamp()
    if latency_ms is not None:
        RUN_STORE[run_id]["latency_ms"] = latency_ms

    carbon_tons = float(result.get("carbonCountInTons", 0.0))
    RUN_STORE[run_id]["carbon_g"] = (
        tons_to_grams(carbon_tons) if carbon_tons else DEFAULT_CARBON_G
    )
    RUN_STORE[run_id]["tokens_used"] = result.get("token_count", 0)

    sources = result.get("sources", []) or []
    _store_sources(run_id, sources)


def _normalize_graph_app_result(result: dict) -> dict:
    documents = result.get("documents", []) or []
    sources = []
    for doc in documents:
        sources.append(
            {
                "source_id": doc.get("doc_id", "") or doc.get("bill_id", ""),
                "title": doc.get("title", ""),
                "source_file": doc.get("chunk_text", ""),
                "bill_id": doc.get("bill_id", ""),
                "bill_type": doc.get("bill_type", ""),
                "bill_number": doc.get("bill_number", ""),
                "congress": doc.get("congress", ""),
            }
        )
    return {
        "answer": result.get("answer", ""),
        "model_used": result.get("model_used"),
        "provider": result.get("provider") or result.get("provider_used"),
        "sources": sources,
        "token_count": result.get("token_count", 0),
    }


NODE_EVENT_MAP = {
    "inputNode": ("thinking", "Parsing query..."),
    "queryRewriteNode": ("thinking", "Refining query..."),
    "planNode": ("thinking", "Planning approach..."),
    "prefetchDecisionNode": ("thinking", "Checking cache..."),
    "searchNode": ("searching", "Searching documents..."),
    "readNode": ("reading", "Reading sources..."),
    "routerNode": ("thinking", "Routing model..."),
    "nvidiaLlmNode": ("generating", "Generating answer..."),
    "hfLlmNode": ("generating", "Generating answer..."),
    "llmOutputNode": ("generating", "Formatting response..."),
}


def _sse_payload(event_type: str, label: str, start: float, **kwargs: object) -> str:
    elapsed = round(time.monotonic() - start, 2)
    payload = {"event": event_type, "label": label, "elapsed": elapsed, **kwargs}
    return f"data: {json.dumps(payload)}\n\n"


async def _stream_run_events(query: str, priority: str | None, user_id: str):
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    created_at = get_iso_timestamp()
    resolved_priority = _resolve_priority(priority, query)

    RUN_STORE[run_id] = {
        "query": query,
        "createdAt": created_at,
        "updatedAt": created_at,
        "status": RUN_STATUS_RUNNING,
        "priority": resolved_priority,
        "user_id": user_id,
    }

    start = time.monotonic()
    yield _sse_payload("init", "Starting analysis...", start, runId=run_id)

    cached = _query_cache.get(query)
    if cached:
        _store_run_result(run_id, cached, latency_ms=0)
        yield _sse_payload(
            "complete",
            "Analysis complete",
            start,
            runId=run_id,
            tokenCount=cached.get("token_count", 0),
            carbonG=RUN_STORE[run_id].get("carbon_g", DEFAULT_CARBON_G),
        )
        return

    graph = app_main._compiledGraph
    if graph is None:
        RUN_STORE[run_id]["status"] = "error"
        yield _sse_payload("error", "Graph not initialised", start, runId=run_id)
        return

    settings = getAppSettings()
    initial_state = {
        "query": query,
        "chat_history": [],
        "max_reasoning_steps": settings.max_reasoning_steps,
        "processedQuery": "",
        "searchResults": [],
        "accumulatedSources": [],
        "searchQueries": [],
        "readNotes": [],
        "plan": [],
        "reasoning_steps": [],
        "response": {},
        "error": None,
    }

    emitted_events: set[str] = set()
    result_payload: dict | None = None

    try:
        async for event in graph.astream_events(initial_state, version="v2"):
            kind = event.get("event")
            node = event.get("name")

            if kind == "on_chain_start" and node in NODE_EVENT_MAP:
                event_type, label = NODE_EVENT_MAP[node]
                if event_type not in emitted_events:
                    emitted_events.add(event_type)
                    yield _sse_payload(event_type, label, start, runId=run_id)

            if kind == "on_chain_end" and node == "llmOutputNode":
                output = event.get("data", {}).get("output", {})
                result_payload = output.get("response")

        if not isinstance(result_payload, dict):
            raise RuntimeError("No response returned from graph execution")

        latency_ms = int((time.monotonic() - start) * 1000)
        _query_cache.set(query, result_payload)
        _store_run_result(run_id, result_payload, latency_ms=latency_ms)

        yield _sse_payload(
            "complete",
            "Analysis complete",
            start,
            runId=run_id,
            tokenCount=result_payload.get("token_count", 0),
            carbonG=RUN_STORE[run_id].get("carbon_g", DEFAULT_CARBON_G),
        )

    except Exception as exc:
        logger.exception("Stream error for run %s", run_id)
        RUN_STORE[run_id]["status"] = "error"
        yield _sse_payload("error", str(exc), start, runId=run_id)


@app.post("/api/runs", status_code=201)
async def create_run(
    request: CreateRunRequest, current_user: CurrentUser | None = None
):
    user_id = get_user_id(current_user) if current_user else "anonymous"
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    created_at = get_iso_timestamp()
    resolved_priority = _resolve_priority(request.priority, request.query)

    RUN_STORE[run_id] = {
        "query": request.query,
        "createdAt": created_at,
        "updatedAt": created_at,
        "status": RUN_STATUS_RUNNING,
        "priority": resolved_priority,
        "user_id": user_id,
    }

    if request.session_id:
        scoped_key = _scoped_session_key(user_id, request.session_id)
        session_history = SESSION_STORE.get(scoped_key, [])
        history_for_query = [ChatMessage(**turn) for turn in session_history]
    else:
        history_for_query = request.chat_history

    cached = None if history_for_query else _query_cache.get(request.query)

    if cached:

        class _CachedResult:
            def __init__(self, payload: dict):
                self.answer = payload.get("answer", "")
                self.structured_answer = payload.get("structured_answer")
                self.sources = [SourceInfo(**s) for s in payload.get("sources", [])]
                self.model_used = payload.get("model_used")
                self.provider = payload.get("provider")
                self.carbonCountInTons = payload.get("carbonCountInTons", 0.0)
                self.token_count = payload.get("token_count", 0)
                self.error = payload.get("error")
                self.rewritten_query = payload.get("rewritten_query")
                self.plan = payload.get("plan", [])
                self.reasoning_steps = payload.get("reasoning_steps", [])
                self.retrieval_skipped = payload.get("retrieval_skipped", False)
                self.citation_validation = payload.get("citation_validation")

            def model_dump(self):
                return dict(cached)

        result = _CachedResult(cached)
    elif graph_app is not None:
        graph_result = await graph_app.ainvoke({"query": request.query})
        result_payload = _normalize_graph_app_result(graph_result)
        _store_run_result(run_id, result_payload)
        result = result_payload
    else:
        with trace_node(
            "orchestrator_query",
            build_trace_metadata(
                {"query": request.query},
                "create_run",
                extras={"run_id": run_id, "has_history": bool(history_for_query)},
            ),
        ) as t_ctx:
            result = await query_endpoint(
                QueryRequest(
                    query=request.query,
                    chat_history=history_for_query,
                    max_reasoning_steps=request.max_reasoning_steps,
                )
            )
            t_ctx["model_used"] = getattr(result, "model_used", None)
            t_ctx["provider"] = getattr(result, "provider", None)
            t_ctx["token_count"] = getattr(result, "token_count", 0)

        if is_tracing_enabled():
            logger.info(
                "LangSmith trace for run %s: latency=%.2fms tokens=%s model=%s",
                run_id,
                t_ctx.get("latency_ms", 0),
                t_ctx.get("token_count", 0),
                t_ctx.get("model_used"),
            )

        if not history_for_query and not getattr(result, "error", None):
            _query_cache.set(request.query, result.model_dump())

    if isinstance(result, dict):
        result_payload = result
    else:
        result_payload = (
            result.model_dump()
            if hasattr(result, "model_dump")
            else {
                "answer": result.answer,
                "structured_answer": getattr(result, "structured_answer", None),
                "sources": [s.model_dump() for s in result.sources],
                "citation_validation": result.citation_validation,
            }
        )
        _store_run_result(run_id, result_payload)

    if request.session_id:
        scoped_key = _scoped_session_key(user_id, request.session_id)
        if scoped_key not in SESSION_STORE:
            SESSION_STORE[scoped_key] = []
        SESSION_STORE[scoped_key].append({"role": "user", "content": request.query})
        assistant_reply = (
            result_payload.get("answer", "")
            if isinstance(result_payload, dict)
            else result.answer
        )
        SESSION_STORE[scoped_key].append(
            {"role": "assistant", "content": assistant_reply}
        )
        SESSION_STORE[scoped_key] = SESSION_STORE[scoped_key][-40:]

    return {"runId": run_id, "status": RUN_STATUS_RUNNING, "createdAt": created_at}


@app.get("/api/runs/stream")
async def stream_run(
    query: str,
    current_user: CurrentUser,
    priority: str | None = Query(None),
):
    """SSE endpoint — streams agent thought events while processing a query."""
    user_id = get_user_id(current_user)
    return StreamingResponse(
        _stream_run_events(query, priority=priority, user_id=user_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/runs")
async def list_runs(
    current_user: CurrentUser | None = None,
    page: int = 1,
    limit: int = 10,
    status: str = None,
    priority: str = None,
    sort: str = "date",
    order: str = "desc",
    q: str = None,
):
    user_id = get_user_id(current_user) if current_user else "anonymous"
    all_items = []

    for run_id, run in RUN_STORE.items():
        if run.get("user_id") != user_id:
            continue
        result = run.get("result", {})
        carbon_tons = float(result.get("carbonCountInTons", 0.0))
        item = {
            "runId": run_id,
            "title": f"Analysis for: {run.get('query', 'Unknown')}",
            "query": run.get("query", ""),
            "status": run.get("status", "running"),
            "priority": run.get("priority", "medium"),
            "createdAt": run["createdAt"],
            "updatedAt": run.get("updatedAt", run["createdAt"]),
            "carbonG": tons_to_grams(carbon_tons) if carbon_tons else DEFAULT_CARBON_G,
            "latency_ms": result.get("latency_ms"),
            "tokens_used": result.get("token_count"),
            "model_used": result.get("model_used"),
            "provider": result.get("provider"),
            "sourceCount": len(
                [k for k in SOURCE_STORE if k.startswith(f"{run_id}_src_")]
            ),
        }
        if status and item["status"] != status:
            continue
        if priority and item["priority"] != priority:
            continue
        if q and q.lower() not in item["query"].lower():
            continue
        all_items.append(item)

    if sort == "name":
        all_items.sort(key=lambda x: x["title"].lower(), reverse=(order == "desc"))
    elif sort == "priority":
        all_items.sort(
            key=lambda x: PRIORITY_ORDER.get(x.get("priority", "medium"), 1),
            reverse=(order == "asc"),
        )
    else:
        all_items.sort(key=lambda x: x["createdAt"], reverse=(order == "desc"))

    total = len(all_items)
    total_pages = max(1, (total + limit - 1) // limit)
    start = (page - 1) * limit
    paged = all_items[start : start + limit]

    return {
        "items": paged,
        "total": total,
        "page": page,
        "limit": limit,
        "totalPages": total_pages,
    }


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str, current_user: CurrentUser | None = None):
    user_id = get_user_id(current_user) if current_user else "anonymous"
    run = RUN_STORE.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    if run.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied.")

    result = run.get("result", {})
    source_ids = [s for s in SOURCE_STORE if s.startswith(f"{run_id}_src_")]
    answer = result.get("answer", "No answer generated.")
    structured_answer = result.get("structured_answer")
    reasoning_steps = result.get("reasoning_steps", [])
    carbon_tons = float(result.get("carbonCountInTons", 0.0))
    carbon_grams = tons_to_grams(carbon_tons) if carbon_tons else DEFAULT_CARBON_G
    citation_validation = result.get("citation_validation")
    token_count = result.get("token_count", 0)

    return {
        "runId": run_id,
        "status": run.get("status", RUN_STATUS_COMPLETED),
        "title": f"Legal Analysis: {run.get('query')}",
        "lastUpdatedAt": run.get("updatedAt", run["createdAt"]),
        "answer": answer,
        "structured_answer": structured_answer,
        "keyFinding": {
            "summary": answer,
            "impactLevel": "medium",
            "actionRequired": False,
        },
        "statutoryBasis": {
            "analysis": [
                {
                    "text": answer,
                    "citations": source_ids,
                }
            ]
        },
        "precedents": [],
        "agentCommentary": {
            "aiGenerated": True,
            "content": answer,
            "suggestedActions": [],
        },
        "documents": [
            {
                "id": sid,
                "_id": SOURCE_STORE[sid].get("billId", sid),
                "doc_id": SOURCE_STORE[sid].get("billId", sid),
                "title": SOURCE_STORE[sid].get("title", ""),
                "bill_id": SOURCE_STORE[sid].get("billId", ""),
                "bill_type": SOURCE_STORE[sid].get("billType", ""),
                "bill_number": SOURCE_STORE[sid].get("billNumber", ""),
                "url": resolve_source_url(SOURCE_STORE[sid]) or "",
                "state": SOURCE_STORE[sid].get("state", ""),
                "session": SOURCE_STORE[sid].get("session", ""),
                "policy_area": SOURCE_STORE[sid].get("policyArea", ""),
                "chunk_id": SOURCE_STORE[sid].get("chunkId", ""),
                "chunk_text": SOURCE_STORE[sid].get("fullText", ""),
            }
            for sid in source_ids
            if sid in SOURCE_STORE
        ],
        "model_used": result.get("model_used"),
        "provider_used": result.get("provider"),
        "reasoningPath": {
            "engine": "langgraph",
            "steps": reasoning_steps,
            "trustScore": DEFAULT_TRUST_SCORE,
            "carbonTotalG": carbon_grams,
            "latencyMs": result.get("latency_ms", run.get("latency_ms", 0)),
            "tokensUsed": token_count,
        },
        "references": {"sourceIds": source_ids},
        "citationValidation": citation_validation,
    }


@app.get("/api/sources/{source_id}")
async def get_source(source_id: str, current_user: CurrentUser | None = None):
    source = SOURCE_STORE.get(source_id)
    if not source:
        raise HTTPException(status_code=404, detail=f"Source {source_id} not found")
    return {**source, "url": resolve_source_url(source) or ""}


@app.get("/api/stats")
async def get_stats():
    retriever = SemanticRetriever()
    if hasattr(retriever, "get_index_stats"):
        return retriever.get_index_stats()
    return {"ok": False}


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str, current_user: CurrentUser):
    user_id = get_user_id(current_user)
    scoped_key = _scoped_session_key(user_id, session_id)
    history = SESSION_STORE.get(scoped_key)
    if history is None:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return {
        "session_id": session_id,
        "history": history,
        "turn_count": len(history) // 2,
    }


@app.delete("/api/sessions/{session_id}")
async def clear_session(session_id: str, current_user: CurrentUser):
    user_id = get_user_id(current_user)
    scoped_key = _scoped_session_key(user_id, session_id)
    if scoped_key not in SESSION_STORE:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    SESSION_STORE.pop(scoped_key)
    return {"session_id": session_id, "cleared": True}


@app.patch("/api/runs/{run_id}")
async def patch_run(run_id: str, updates: dict, current_user: CurrentUser):
    user_id = get_user_id(current_user)
    run = RUN_STORE.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    if run.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied.")
    if "status" in updates:
        run["status"] = updates["status"]
    if "priority" in updates:
        run["priority"] = updates["priority"]
    run["updatedAt"] = get_iso_timestamp()
    return {
        "runId": run_id,
        "status": run.get("status", "running"),
        "priority": run.get("priority", "medium"),
        "updatedAt": run["updatedAt"],
    }


@app.get("/api/dashboard/summary")
async def dashboard_summary(current_user: CurrentUser):
    user_id = get_user_id(current_user)
    user_runs = {k: v for k, v in RUN_STORE.items() if v.get("user_id") == user_id}
    total = len(user_runs)
    completed = sum(
        1 for r in user_runs.values() if r.get("status") == RUN_STATUS_COMPLETED
    )
    running = sum(
        1 for r in user_runs.values() if r.get("status") == RUN_STATUS_RUNNING
    )
    drafts = sum(1 for r in user_runs.values() if r.get("status") == "draft")
    high = sum(1 for r in user_runs.values() if r.get("priority") == "high")
    medium = sum(1 for r in user_runs.values() if r.get("priority") == "medium")
    low = sum(1 for r in user_runs.values() if r.get("priority") == "low")
    return {
        "totalCases": total,
        "completed": completed,
        "running": running,
        "drafts": drafts,
        "priorities": {"high": high, "medium": medium, "low": low},
    }


@app.get("/api/dashboard/research-trends")
async def research_trends(current_user: CurrentUser):
    user_id = get_user_id(current_user)
    topics: dict[str, int] = {}
    for run in RUN_STORE.values():
        if run.get("user_id") != user_id:
            continue
        q = run.get("query", "Unknown")
        first_word = q.split()[0] if q.split() else "Unknown"
        topics[first_word] = topics.get(first_word, 0) + 1
    trends = [{"topic": t, "count": c} for t, c in topics.items()]
    return {"trends": trends, "totalQueries": len(topics)}


@app.get("/api/dashboard/system-activity")
async def system_activity(current_user: CurrentUser):
    user_id = get_user_id(current_user)
    activities = []
    for run_id, run in RUN_STORE.items():
        if run.get("user_id") != user_id:
            continue
        result = run.get("result", {})
        activities.append(
            {
                "runId": run_id,
                "type": "query",
                "query": run.get("query", ""),
                "status": run.get("status", "running"),
                "model_used": result.get("model_used"),
                "provider": result.get("provider"),
                "timestamp": run.get("createdAt", ""),
            }
        )
    return {"activities": activities}


@app.get("/api/dashboard/ai-efficiency")
async def ai_efficiency(current_user: CurrentUser):
    user_id = get_user_id(current_user)
    total_carbon = 0.0
    total_tokens = 0
    model_usage: dict[str, int] = {}
    provider_usage: dict[str, int] = {}
    user_run_count = 0
    for run in RUN_STORE.values():
        if run.get("user_id") != user_id:
            continue
        user_run_count += 1
        result = run.get("result", {})
        carbon_tons = float(result.get("carbonCountInTons", 0.0))
        total_carbon += tons_to_grams(carbon_tons) if carbon_tons else 0
        total_tokens += result.get("token_count", 0)
        m = result.get("model_used")
        p = result.get("provider")
        if m:
            model_usage[m] = model_usage.get(m, 0) + 1
        if p:
            provider_usage[p] = provider_usage.get(p, 0) + 1
    n = max(user_run_count, 1)
    return {
        "totalCarbonG": round(total_carbon, 2),
        "avgCarbonPerQueryG": round(total_carbon / n, 2),
        "totalTokens": total_tokens,
        "avgTokensPerQuery": total_tokens // n,
        "totalQueries": user_run_count,
        "modelUsage": model_usage,
        "providerUsage": provider_usage,
    }
