from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from pydantic import BaseModel
from pydantic import Field

from app.main import app as shared_app
from app.main import query_endpoint
from app.models import ChatMessage, QueryRequest, SourceInfo
from app.services.carbon_estimator import tons_to_grams
from backend.orchestrator.cache import QueryCache
from backend.orchestrator.config import getSettings as getOrchestratorSettings
from backend.orchestrator.langsmith_tracing import (
    configure_langsmith_tracing,
    is_tracing_enabled,
    trace_node,
    build_trace_metadata,
)

logger = logging.getLogger(__name__)

RUN_STATUS_COMPLETED = "completed"
RUN_STATUS_RUNNING = "running"
DEFAULT_TRUST_SCORE = 85
DEFAULT_CARBON_G = 0.3

RUN_STORE: dict[str, dict] = {}
SOURCE_STORE: dict[str, dict] = {}
SESSION_STORE: dict[str, list[dict]] = {}
_query_cache = QueryCache(ttl_seconds=3600, max_size=100)

# --- Configure LangSmith tracing on module load ---
_orch_settings = getOrchestratorSettings()
configure_langsmith_tracing(
    tracing_v2=_orch_settings.langchain_tracing_v2,
    endpoint=_orch_settings.langchain_endpoint,
    api_key=_orch_settings.langchain_api_key,
    project=_orch_settings.langchain_project,
)

app = shared_app


class CreateRunRequest(BaseModel):
    query: str
    chat_history: list[ChatMessage] = Field(default_factory=list)
    max_reasoning_steps: int | None = None
    session_id: str | None = (
        None  # if provided, server loads + saves history automatically
    )


def get_iso_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


@app.post("/api/runs", status_code=201)
async def create_run(request: CreateRunRequest):
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    created_at = get_iso_timestamp()
    RUN_STORE[run_id] = {
        "query": request.query,
        "createdAt": created_at,
        "status": RUN_STATUS_RUNNING,
    }

    if request.session_id:
        session_history = SESSION_STORE.get(request.session_id, [])
        history_for_query = [ChatMessage(**turn) for turn in session_history]
    else:
        history_for_query = request.chat_history

    # Only use cache for stateless queries — skip when session history exists
    # so follow-up queries always get fresh context-aware answers
    cached = None if history_for_query else _query_cache.get(request.query)

    if cached:

        class _CachedResult:
            answer = cached.get("answer", "")
            sources = [SourceInfo(**s) for s in cached.get("sources", [])]
            citation_validation = cached.get("citation_validation")
            error = None

        result = _CachedResult()
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

        # Only cache successful stateless queries
        if not history_for_query and not getattr(result, "error", None):
            _query_cache.set(request.query, result.model_dump())

    RUN_STORE[run_id]["result"] = (
        result.model_dump()
        if hasattr(result, "model_dump")
        else {
            "answer": result.answer,
            "sources": [s.model_dump() for s in result.sources],
            "citation_validation": result.citation_validation,
        }
    )
    RUN_STORE[run_id]["status"] = RUN_STATUS_COMPLETED

    if request.session_id:
        if request.session_id not in SESSION_STORE:
            SESSION_STORE[request.session_id] = []
        SESSION_STORE[request.session_id].append(
            {"role": "user", "content": request.query}
        )
        SESSION_STORE[request.session_id].append(
            {"role": "assistant", "content": result.answer}
        )
        SESSION_STORE[request.session_id] = SESSION_STORE[request.session_id][-40:]

    for idx, source in enumerate(result.sources, start=1):
        source_id = f"{run_id}_src_{idx:03d}"
        source_data = (
            source.model_dump()
            if hasattr(source, "model_dump")
            else (source if isinstance(source, dict) else {})
        )
        SOURCE_STORE[source_id] = {
            "sourceId": source_id,
            "title": source_data.get("title", "Untitled"),
            "fullText": source_data.get("title", ""),
            "billId": source_data.get("bill_id", ""),
            "billType": source_data.get("bill_type", ""),
            "billNumber": source_data.get("bill_number", ""),
        }

    return {"runId": run_id, "status": RUN_STATUS_RUNNING, "createdAt": created_at}


@app.get("/api/runs")
async def list_runs(
    page: int = 1,
    limit: int = 10,
    status: str = None,
    priority: str = None,
    sort: str = "date",
    order: str = "desc",
    q: str = None,
):
    all_items = []
    for run_id, run in RUN_STORE.items():
        result = run.get("result", {})
        carbon_tons = float(result.get("carbonCountInTons", 0.0))
        item = {
            "runId": run_id,
            "title": f"Analysis for: {run.get('query', 'Unknown')}",
            "query": run.get("query", ""),
            "status": run.get("status", "running"),
            "priority": run.get("priority", "medium"),
            "createdAt": run["createdAt"],
            "updatedAt": run["createdAt"],
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

    # Sort
    if sort == "name":
        all_items.sort(key=lambda x: x["title"].lower(), reverse=(order == "desc"))
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
async def get_run(run_id: str):
    run = RUN_STORE.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    result = run.get("result", {})
    source_ids = [
        source_id
        for source_id in SOURCE_STORE
        if source_id.startswith(f"{run_id}_src_")
    ]
    answer = result.get("answer", "No answer generated.")
    reasoning_steps = result.get("reasoning_steps", [])
    carbon_tons = float(result.get("carbonCountInTons", 0.0))
    carbon_grams = tons_to_grams(carbon_tons) if carbon_tons else DEFAULT_CARBON_G
    citation_validation = result.get("citation_validation")

    return {
        "runId": run_id,
        "status": run.get("status", RUN_STATUS_COMPLETED),
        "title": f"Legal Analysis: {run.get('query')}",
        "lastUpdatedAt": run["createdAt"],
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
        "reasoningPath": {
            "engine": "langgraph",
            "steps": reasoning_steps,
            "trustScore": DEFAULT_TRUST_SCORE,
            "carbonTotalG": carbon_grams,
        },
        "references": {
            "sourceIds": source_ids,
        },
        "citationValidation": citation_validation,
    }


@app.get("/api/sources/{source_id}")
async def get_source(source_id: str):
    source = SOURCE_STORE.get(source_id)
    if not source:
        raise HTTPException(status_code=404, detail=f"Source {source_id} not found")
    return source


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    history = SESSION_STORE.get(session_id)
    if history is None:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return {
        "session_id": session_id,
        "history": history,
        "turn_count": len(history) // 2,
    }


@app.delete("/api/sessions/{session_id}")
async def clear_session(session_id: str):
    if session_id not in SESSION_STORE:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    SESSION_STORE.pop(session_id)
    return {"session_id": session_id, "cleared": True}


@app.patch("/api/runs/{run_id}")
async def patch_run(run_id: str, updates: dict):
    run = RUN_STORE.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    if "status" in updates:
        run["status"] = updates["status"]
    if "priority" in updates:
        run["priority"] = updates["priority"]
    return {
        "runId": run_id,
        "status": run.get("status", "running"),
        "priority": run.get("priority", "medium"),
        "updatedAt": get_iso_timestamp(),
    }


@app.get("/api/dashboard/summary")
async def dashboard_summary():
    total = len(RUN_STORE)
    completed = sum(
        1 for r in RUN_STORE.values() if r.get("status") == RUN_STATUS_COMPLETED
    )
    running = sum(
        1 for r in RUN_STORE.values() if r.get("status") == RUN_STATUS_RUNNING
    )
    drafts = sum(1 for r in RUN_STORE.values() if r.get("status") == "draft")
    high = sum(1 for r in RUN_STORE.values() if r.get("priority") == "high")
    medium = sum(1 for r in RUN_STORE.values() if r.get("priority") == "medium")
    low = sum(1 for r in RUN_STORE.values() if r.get("priority") == "low")
    return {
        "totalCases": total,
        "completed": completed,
        "running": running,
        "drafts": drafts,
        "priorities": {"high": high, "medium": medium, "low": low},
    }


@app.get("/api/dashboard/research-trends")
async def research_trends():
    topics: dict[str, int] = {}
    for run in RUN_STORE.values():
        q = run.get("query", "Unknown")
        first_word = q.split()[0] if q.split() else "Unknown"
        topics[first_word] = topics.get(first_word, 0) + 1
    trends = [{"topic": t, "count": c} for t, c in topics.items()]
    return {"trends": trends, "totalQueries": len(RUN_STORE)}


@app.get("/api/dashboard/system-activity")
async def system_activity():
    activities = []
    for run_id, run in RUN_STORE.items():
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
async def ai_efficiency():
    total_carbon = 0.0
    total_tokens = 0
    model_usage: dict[str, int] = {}
    provider_usage: dict[str, int] = {}
    for run in RUN_STORE.values():
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
    n = max(len(RUN_STORE), 1)
    return {
        "totalCarbonG": round(total_carbon, 2),
        "avgCarbonPerQueryG": round(total_carbon / n, 2),
        "totalTokens": total_tokens,
        "avgTokensPerQuery": total_tokens // n,
        "totalQueries": len(RUN_STORE),
        "modelUsage": model_usage,
        "providerUsage": provider_usage,
    }
