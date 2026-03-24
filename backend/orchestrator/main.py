from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, AsyncGenerator
import asyncio
import json
import logging
import random
import re
import time
import uuid
from datetime import datetime, timezone
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from graph import app as graph_app
from semantic_retrieval import SemanticRetriever
from url_utils import resolve_source_url
from cache import QueryCache
from services.carbon_estimator import estimate_carbon_tons, tons_to_grams

logger = logging.getLogger(__name__)

app = FastAPI(title="Orchestrator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Models ───────────────────────────────────────────────────────────────────


class CreateRunRequest(BaseModel):
    query: str
    chat_history: list = Field(default_factory=list)
    max_reasoning_steps: Optional[int] = None
    priority: Optional[str] = (
        None  # high | medium | low — if omitted, inferred from query
    )


class RunResponse(BaseModel):
    runId: str
    status: str
    createdAt: str


class RunItem(BaseModel):
    runId: str
    title: str
    updatedAt: str


class RunList(BaseModel):
    items: List[RunItem]


class PatchRunRequest(BaseModel):
    status: Optional[str] = None  # running | completed | draft | in-review
    priority: Optional[str] = None  # high | medium | low

    def is_empty(self) -> bool:
        return self.status is None and self.priority is None


# ─── Constants ────────────────────────────────────────────────────────────────

RUN_STATUS_RUNNING = "running"
RUN_STATUS_COMPLETED = "completed"
RUN_STATUS_DRAFT = "draft"
DEFAULT_TRUST_SCORE = 85
DEFAULT_CARBON_G = 0.5

PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}

VALID_STATUSES = {"running", "completed", "draft", "in-review"}
VALID_PRIORITIES = {"high", "medium", "low"}

# ─── In-memory stores ─────────────────────────────────────────────────────────

RUN_STORE = {}
SOURCE_STORE = {}
query_cache = QueryCache(ttl_seconds=3600, max_size=100)


# ─── Helpers ──────────────────────────────────────────────────────────────────


def get_iso_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _infer_priority(query: str) -> str:
    """Infer priority from query keywords — only used at creation time if not explicitly set."""
    high_indicators = ["urgent", "critical", "deadline", "immediate", "compliance"]
    low_indicators = ["general", "overview", "summary", "curious"]
    q_lower = query.lower()
    if any(kw in q_lower for kw in high_indicators):
        return "high"
    if any(kw in q_lower for kw in low_indicators):
        return "low"
    return "medium"


def _store_sources(run_id: str, result: dict) -> None:
    """
    Extract documents from a completed run result, build SOURCE_STORE entries
    (including resolved URLs), and attach sourceIds + documents to the run.
    """
    documents = result.get("documents", []) or []
    source_ids = []

    for doc in documents:
        source_id = doc.get("doc_id") or f"src_{uuid.uuid4().hex[:8]}"
        source_ids.append(source_id)

        bill_id = doc.get("bill_id") or doc.get("id") or source_id
        congress_match = re.match(r"^(\d+)-", bill_id or "")
        congress = congress_match.group(1) if congress_match else None

        source_entry = {
            "sourceId": source_id,
            "title": doc.get("title", "Unknown Source"),
            "fullText": doc.get("chunk_text", ""),
            "billId": bill_id,
            "state": doc.get("state"),
            "billType": doc.get("bill_type"),
            "billNumber": doc.get("bill_number"),
            "congress": congress,
            "session": doc.get("session"),
            "policyArea": doc.get("policy_area"),
            "latestAction": doc.get("latest_action"),
            "chunkId": doc.get("chunk_id"),
        }
        source_entry["url"] = resolve_source_url(source_entry)
        SOURCE_STORE[source_id] = source_entry

    RUN_STORE[run_id]["sourceIds"] = source_ids
    RUN_STORE[run_id]["documents"] = documents


def _build_initial_state(query: str) -> dict:
    return {
        "query": query,
        "processed_query": "",
        "documents": [],
        "answer": "",
        "model_used": "",
        "provider_used": "",
        "token_count": 0,
        "error": "",
    }


def _compute_carbon(result: dict) -> float:
    return round(
        tons_to_grams(
            estimate_carbon_tons(result.get("model_used"), result.get("provider_used"))
        ),
        4,
    )


# ─── SSE Streaming ────────────────────────────────────────────────────────────


async def _generate_run_events(
    query: str, priority: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """
    Streams SSE events to the frontend as the LangGraph pipeline runs.
    Also writes the completed run into RUN_STORE so it is available via
    the normal polling endpoints once the stream finishes.
    """
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    start = time.monotonic()
    created_at = get_iso_timestamp()

    resolved_priority = (
        priority if priority in VALID_PRIORITIES else _infer_priority(query)
    )

    RUN_STORE[run_id] = {
        "query": query,
        "createdAt": created_at,
        "updatedAt": created_at,
        "status": RUN_STATUS_RUNNING,
        "priority": resolved_priority,
    }

    def sse(event_type: str, label: str, **kwargs) -> str:
        elapsed = round(time.monotonic() - start, 2)
        payload = json.dumps(
            {"event": event_type, "label": label, "elapsed": elapsed, **kwargs}
        )
        return f"data: {payload}\n\n"

    try:
        yield sse("init", "Starting analysis...", runId=run_id)

        # ── Cache hit ──────────────────────────────────────────────────────
        cached = query_cache.get(query)
        if cached:
            yield sse("thinking", "Checking cache...")
            await asyncio.sleep(0.1)

            carbon_g = _compute_carbon(cached)
            RUN_STORE[run_id]["result"] = cached
            RUN_STORE[run_id]["status"] = RUN_STATUS_COMPLETED
            RUN_STORE[run_id]["carbon_g"] = carbon_g
            RUN_STORE[run_id]["tokens_used"] = cached.get("token_count", 0)
            RUN_STORE[run_id]["latency_ms"] = 0
            _store_sources(run_id, cached)

            yield sse(
                "complete",
                "Analysis complete",
                runId=run_id,
                tokenCount=cached.get("token_count", 0),
                carbonG=carbon_g,
            )
            return

        # ── Live pipeline ──────────────────────────────────────────────────
        yield sse("thinking", "Thinking...")
        await asyncio.sleep(random.uniform(5.0, 12.0))

        result: dict = {}
        t0 = time.monotonic()

        async for chunk in graph_app.astream(_build_initial_state(query)):
            node_name = next(iter(chunk))
            node_state = chunk[node_name]

            if node_name == "rewrite":
                yield sse("searching", "Searching documents...")
                await asyncio.sleep(2.0)

            elif node_name == "retrieve":
                doc_count = len(node_state.get("documents") or [])
                label = f"Reading {doc_count} source{'s' if doc_count != 1 else ''}..."
                yield sse("reading", label, docCount=doc_count)
                result.update(node_state)
                await asyncio.sleep(2.0)

            elif node_name == "generate":
                yield sse("generating", "Generating answer...")
                await asyncio.sleep(2.5)
                result.update(node_state)

        latency_ms = int((time.monotonic() - t0) * 1000)
        carbon_g = _compute_carbon(result)

        query_cache.set(query, result)

        RUN_STORE[run_id]["result"] = result
        RUN_STORE[run_id]["status"] = RUN_STATUS_COMPLETED
        RUN_STORE[run_id]["latency_ms"] = latency_ms
        RUN_STORE[run_id]["carbon_g"] = carbon_g
        RUN_STORE[run_id]["tokens_used"] = result.get("token_count", 0)
        _store_sources(run_id, result)

        yield sse(
            "complete",
            "Analysis complete",
            runId=run_id,
            tokenCount=result.get("token_count", 0),
            carbonG=carbon_g,
        )

    except Exception as e:
        logger.error("Stream error for run %s: %s", run_id, e)
        RUN_STORE[run_id]["status"] = "error"
        yield sse("error", str(e), runId=run_id)


# ─── Endpoints ────────────────────────────────────────────────────────────────


@app.post("/api/runs", response_model=RunResponse, status_code=201)
async def create_run(request: CreateRunRequest):
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    created_at = get_iso_timestamp()

    priority = (
        request.priority
        if request.priority in VALID_PRIORITIES
        else _infer_priority(request.query)
    )

    RUN_STORE[run_id] = {
        "query": request.query,
        "createdAt": created_at,
        "updatedAt": created_at,
        "status": RUN_STATUS_RUNNING,
        "priority": priority,
    }

    cached_result = query_cache.get(request.query)
    if cached_result:
        result = cached_result
        latency_ms = 0
    else:
        t0 = time.time()
        result = await graph_app.ainvoke(_build_initial_state(request.query))
        latency_ms = int((time.time() - t0) * 1000)
        query_cache.set(request.query, result)

    carbon_g = _compute_carbon(result)

    RUN_STORE[run_id]["result"] = result
    RUN_STORE[run_id]["status"] = RUN_STATUS_COMPLETED
    RUN_STORE[run_id]["latency_ms"] = latency_ms
    RUN_STORE[run_id]["carbon_g"] = carbon_g
    RUN_STORE[run_id]["tokens_used"] = result.get("token_count", 0)
    _store_sources(run_id, result)

    return {"runId": run_id, "status": RUN_STATUS_RUNNING, "createdAt": created_at}


@app.get("/api/runs/stream")
async def stream_run(query: str, priority: Optional[str] = Query(None)):
    """SSE endpoint — streams agent thought events while processing a query."""
    return StreamingResponse(
        _generate_run_events(query, priority=priority),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/runs")
async def list_runs(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    status: Optional[str] = Query(None),
    sort: Optional[str] = Query("date"),
    order: Optional[str] = Query("desc"),
    q: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
):
    items = []
    for run_id, run in RUN_STORE.items():
        result = run.get("result", {})
        run_status = run.get("status", RUN_STATUS_COMPLETED)
        query_text = run.get("query", "Unknown")
        stored_priority = run.get("priority") or _infer_priority(query_text)

        items.append(
            {
                "runId": run_id,
                "title": f"Analysis for: {query_text}",
                "query": query_text,
                "status": run.get("status", RUN_STATUS_COMPLETED),
                "priority": stored_priority,
                "createdAt": run["createdAt"],
                "updatedAt": run.get("updatedAt", run["createdAt"]),
                "carbonG": run.get("carbon_g", DEFAULT_CARBON_G),
                "latency_ms": run.get("latency_ms"),
                "tokens_used": run.get("tokens_used", 0),
                "model_used": result.get("model_used"),
                "provider": result.get("provider_used"),
                "sourceCount": len(run.get("sourceIds", [])),
            }
        )

    # Filtering
    if status:
        items = [i for i in items if i["status"] == status]
    if priority:
        items = [i for i in items if i["priority"] == priority]
    if q:
        q_lower = q.lower()
        items = [
            i
            for i in items
            if q_lower in i["query"].lower() or q_lower in i["title"].lower()
        ]

    # Sorting
    if sort == "name":
        items.sort(key=lambda x: x.get("title", "").lower(), reverse=(order != "asc"))
    elif sort == "priority":
        items.sort(
            key=lambda x: PRIORITY_ORDER.get(x.get("priority", "medium"), 1),
            reverse=(order == "asc"),
        )
    else:
        # date (default) — newest first
        items.sort(key=lambda x: x.get("createdAt", ""), reverse=(order != "asc"))

    total = len(items)
    start = (page - 1) * limit
    paginated = items[start : start + limit]

    return {
        "items": paginated,
        "total": total,
        "page": page,
        "limit": limit,
        "totalPages": (total + limit - 1) // limit if total > 0 else 1,
    }


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str):
    run = RUN_STORE.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    result = run.get("result", {})
    raw_docs = run.get("documents", result.get("documents", []) or [])

    enriched_docs = []
    for doc in raw_docs:
        source_id = doc.get("doc_id") or doc.get("id")
        stored_url = SOURCE_STORE.get(source_id, {}).get("url") if source_id else None
        enriched_docs.append(
            {**doc, "id": source_id, "url": stored_url or doc.get("url")}
        )

    source_ids = run.get("sourceIds", [])
    answer = result.get("answer", "No answer generated.")
    reasoning_steps = result.get("reasoning_steps", [])

    return {
        "runId": run_id,
        "status": run.get("status", RUN_STATUS_COMPLETED),
        "priority": run.get("priority", "medium"),
        "title": f"Legal Analysis: {run.get('query')}",
        "lastUpdatedAt": run.get("updatedAt", run["createdAt"]),
        "answer": answer,
        "model_used": result.get("model_used", ""),
        "provider_used": result.get("provider_used", ""),
        "keyFinding": {
            "summary": answer,
            "impactLevel": "medium",
            "actionRequired": False,
        },
        "statutoryBasis": {"analysis": [{"text": answer, "citations": source_ids}]},
        "precedents": [],
        "agentCommentary": {
            "aiGenerated": True,
            "content": answer,
            "suggestedActions": [],
        },
        "documents": enriched_docs,
        "reasoningPath": {
            "engine": "langgraph",
            "steps": reasoning_steps,
            "trustScore": DEFAULT_TRUST_SCORE,
            "carbonTotalG": run.get("carbon_g", DEFAULT_CARBON_G),
            "latencyMs": run.get("latency_ms"),
            "tokensUsed": run.get("tokens_used", 0),
        },
        "references": {"sourceIds": source_ids},
    }


@app.patch("/api/runs/{run_id}")
async def patch_run(run_id: str, request: PatchRunRequest):
    run = RUN_STORE.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    if request.is_empty():
        raise HTTPException(
            status_code=400,
            detail="At least one of 'status' or 'priority' must be provided.",
        )

    VALID_STATUSES = {"running", "completed", "draft", "in-review"}
    VALID_PRIORITIES = {"high", "medium", "low"}

    if request.status and request.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {request.status}")
    if request.priority and request.priority not in VALID_PRIORITIES:
        raise HTTPException(
            status_code=400, detail=f"Invalid priority: {request.priority}"
        )

    if request.status:
        RUN_STORE[run_id]["status"] = request.status
    if request.priority:
        RUN_STORE[run_id]["priority"] = request.priority

    updated_at = get_iso_timestamp()
    RUN_STORE[run_id]["updatedAt"] = updated_at

    return {
        "runId": run_id,
        "status": RUN_STORE[run_id].get("status"),
        "priority": RUN_STORE[run_id].get("priority"),
        "updatedAt": updated_at,
    }


@app.get("/api/sources/{source_id}")
async def get_source(source_id: str):
    source = SOURCE_STORE.get(source_id)
    if not source:
        raise HTTPException(status_code=404, detail=f"Source {source_id} not found")
    if not source.get("url"):
        source["url"] = resolve_source_url(source)
    return source


@app.get("/api/stats")
async def get_stats():
    try:
        retriever = SemanticRetriever()
        return retriever.get_index_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {e}")


@app.get("/health")
async def health_check():
    return {"status": "ok"}


# ─── Dashboard endpoints ──────────────────────────────────────────────────────


@app.get("/api/dashboard/summary")
async def dashboard_summary():
    total = len(RUN_STORE)
    completed = sum(
        1 for r in RUN_STORE.values() if r.get("status") == RUN_STATUS_COMPLETED
    )
    running = sum(
        1 for r in RUN_STORE.values() if r.get("status") == RUN_STATUS_RUNNING
    )
    drafts = sum(1 for r in RUN_STORE.values() if r.get("status") == RUN_STATUS_DRAFT)
    priorities = {"high": 0, "medium": 0, "low": 0}
    for run in RUN_STORE.values():
        p = run.get("priority") or _infer_priority(run.get("query", ""))
        if p in priorities:
            priorities[p] += 1
    return {
        "totalCases": total,
        "completed": completed,
        "running": running,
        "drafts": drafts,
        "priorities": priorities,
    }


@app.get("/api/dashboard/research-trends")
async def research_trends():
    from collections import Counter

    words_to_skip = {
        "the",
        "a",
        "an",
        "is",
        "are",
        "was",
        "were",
        "what",
        "how",
        "does",
        "do",
        "in",
        "on",
        "of",
        "for",
        "to",
        "and",
        "or",
        "with",
        "about",
        "this",
        "that",
        "it",
        "can",
        "be",
        "has",
        "have",
        "from",
        "by",
        "at",
    }
    word_counts: Counter = Counter()
    for run in RUN_STORE.values():
        for w in run.get("query", "").lower().split():
            cleaned = w.strip("?.,!\"'()[]{}").lower()
            if len(cleaned) > 2 and cleaned not in words_to_skip:
                word_counts[cleaned] += 1
    return {
        "trends": [{"topic": w, "count": c} for w, c in word_counts.most_common(10)],
        "totalQueries": len(RUN_STORE),
    }


@app.get("/api/dashboard/system-activity")
async def system_activity():
    activities = []
    for run_id, run in sorted(
        RUN_STORE.items(), key=lambda x: x[1].get("createdAt", ""), reverse=True
    )[:20]:
        result = run.get("result", {})
        activities.append(
            {
                "runId": run_id,
                "type": "query",
                "query": run.get("query", ""),
                "status": run.get("status", "unknown"),
                "model_used": result.get("model_used"),
                "provider": result.get("provider_used"),
                "timestamp": run.get("createdAt"),
            }
        )
    return {"activities": activities}


@app.get("/api/dashboard/ai-efficiency")
async def ai_efficiency():
    total_carbon_g = 0.0
    total_tokens = 0
    model_usage: dict = {}
    provider_usage: dict = {}

    for run in RUN_STORE.values():
        result = run.get("result", {})
        total_carbon_g += run.get("carbon_g", DEFAULT_CARBON_G)
        total_tokens += run.get("tokens_used", result.get("token_count", 0))
        model = result.get("model_used", "unknown")
        provider = result.get("provider_used", "unknown")
        model_usage[model] = model_usage.get(model, 0) + 1
        provider_usage[provider] = provider_usage.get(provider, 0) + 1

    total_runs = len(RUN_STORE) or 1
    return {
        "totalCarbonG": round(total_carbon_g, 4),
        "avgCarbonPerQueryG": round(total_carbon_g / total_runs, 4),
        "totalTokens": total_tokens,
        "avgTokensPerQuery": total_tokens // total_runs,
        "totalQueries": len(RUN_STORE),
        "modelUsage": model_usage,
        "providerUsage": provider_usage,
    }


@app.get("/health")
async def health_check():
    return {"status": "ok"}
