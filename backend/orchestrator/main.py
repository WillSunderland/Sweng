from __future__ import annotations

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

RUN_STATUS_COMPLETED = "completed"
RUN_STATUS_RUNNING = "running"
DEFAULT_TRUST_SCORE = 85
DEFAULT_CARBON_G = 0.3

RUN_STORE: dict[str, dict] = {}
SOURCE_STORE: dict[str, dict] = {}
SESSION_STORE: dict[str, list[dict]] = {}
_query_cache = QueryCache(ttl_seconds=3600, max_size=100)

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
        result = await query_endpoint(
            QueryRequest(
                query=request.query,
                chat_history=history_for_query,
                max_reasoning_steps=request.max_reasoning_steps,
            )
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
        SOURCE_STORE[source_id] = {
            "sourceId": source_id,
            "title": source.title,
            "fullText": source.model_dump(),
        }

    return {"runId": run_id, "status": RUN_STATUS_RUNNING, "createdAt": created_at}


@app.get("/api/runs")
async def list_runs():
    items = [
        {
            "runId": run_id,
            "title": f"Analysis for: {run.get('query', 'Unknown')}",
            "updatedAt": run["createdAt"],
        }
        for run_id, run in RUN_STORE.items()
    ]
    return {"items": items}


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
