from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime, timezone
import re
from graph import app as graph_app
from semantic_retrieval import SemanticRetriever
from url_utils import resolve_source_url
from cache import QueryCache

app = FastAPI(title="Orchestrator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Models
class CreateRunRequest(BaseModel):
    query: str
    chat_history: list = Field(default_factory=list)
    max_reasoning_steps: Optional[int] = None
    priority: Optional[str] = None  # high | medium | low — if omitted, inferred from query


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
    status: Optional[str] = None   # running | completed | draft | in-review
    priority: Optional[str] = None  # high | medium | low

    def is_empty(self) -> bool:
        return self.status is None and self.priority is None


# Constants
RUN_STATUS_RUNNING = "running"
RUN_STATUS_COMPLETED = "completed"
RUN_STATUS_DRAFT = "draft"
DEFAULT_TRUST_SCORE = 85
DEFAULT_CARBON_G = 0.5

# Priority sort order for backend sorting
PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}

# In-memory stores
RUN_STORE = {}
SOURCE_STORE = {}
query_cache = QueryCache(ttl_seconds=3600, max_size=100)


def get_iso_timestamp():
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


@app.post("/api/runs", response_model=RunResponse, status_code=201)
async def create_run(request: CreateRunRequest):
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    created_at = get_iso_timestamp()

    # Use explicitly provided priority; fall back to keyword inference
    priority = request.priority if request.priority in ("high", "medium", "low") else _infer_priority(request.query)

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
    else:
        initial_state = {
            "query": request.query,
            "processed_query": "",
            "documents": [],
            "answer": "",
            "model_used": "",
            "provider_used": "",
            "token_count": 0,
            "error": "",
        }
        result = await graph_app.ainvoke(initial_state)
        query_cache.set(request.query, result)

    RUN_STORE[run_id]["result"] = result
    RUN_STORE[run_id]["status"] = RUN_STATUS_COMPLETED

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

    return {"runId": run_id, "status": RUN_STATUS_RUNNING, "createdAt": created_at}


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

        # Always read stored priority — never re-infer at list time
        stored_priority = run.get("priority") or _infer_priority(query_text)

        items.append({
            "runId": run_id,
            "title": f"Analysis for: {query_text}",
            "query": query_text,
            "status": run_status,
            "priority": stored_priority,
            "createdAt": run["createdAt"],
            "updatedAt": run.get("updatedAt", run["createdAt"]),
            "carbonG": DEFAULT_CARBON_G,
            "model_used": result.get("model_used"),
            "provider": result.get("provider_used"),
            "sourceCount": len(run.get("sourceIds", [])),
        })

    if status:
        items = [i for i in items if i["status"] == status]
    if priority:
        items = [i for i in items if i["priority"] == priority]
    if q:
        q_lower = q.lower()
        items = [
            i for i in items
            if q_lower in i["query"].lower() or q_lower in i["title"].lower()
        ]

    # Sort — name is case-insensitive A→Z, priority uses explicit order, date is newest first
    if sort == "name":
        items.sort(key=lambda x: x.get("title", "").lower(), reverse=(order != "asc"))
    elif sort == "priority":
        items.sort(key=lambda x: PRIORITY_ORDER.get(x.get("priority", "medium"), 1), reverse=(order == "asc"))
    else:
        # date (default)
        items.sort(key=lambda x: x.get("createdAt", ""), reverse=(order != "asc"))

    total = len(items)
    start = (page - 1) * limit
    paginated = items[start: start + limit]

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
            "carbonTotalG": DEFAULT_CARBON_G,
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

    VALID_STATUSES   = {"running", "completed", "draft", "in-review"}
    VALID_PRIORITIES = {"high", "medium", "low"}

    if request.status and request.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {request.status}")
    if request.priority and request.priority not in VALID_PRIORITIES:
        raise HTTPException(status_code=400, detail=f"Invalid priority: {request.priority}")

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


@app.get("/api/dashboard/summary")
async def dashboard_summary():
    total = len(RUN_STORE)
    completed = sum(1 for r in RUN_STORE.values() if r.get("status") == RUN_STATUS_COMPLETED)
    running = sum(1 for r in RUN_STORE.values() if r.get("status") == RUN_STATUS_RUNNING)
    drafts = sum(1 for r in RUN_STORE.values() if r.get("status") == RUN_STATUS_DRAFT)
    priorities = {"high": 0, "medium": 0, "low": 0}
    for run in RUN_STORE.values():
        p = run.get("priority") or _infer_priority(run.get("query", ""))
        if p in priorities:
            priorities[p] += 1
    return {"totalCases": total, "completed": completed, "running": running, "drafts": drafts, "priorities": priorities}


@app.get("/api/dashboard/research-trends")
async def research_trends():
    from collections import Counter
    words_to_skip = {"the","a","an","is","are","was","were","what","how","does","do","in","on","of","for","to","and","or","with","about","this","that","it","can","be","has","have","from","by","at"}
    word_counts: Counter = Counter()
    for run in RUN_STORE.values():
        for w in run.get("query", "").lower().split():
            cleaned = w.strip("?.,!\"'()[]{}").lower()
            if len(cleaned) > 2 and cleaned not in words_to_skip:
                word_counts[cleaned] += 1
    return {"trends": [{"topic": w, "count": c} for w, c in word_counts.most_common(10)], "totalQueries": len(RUN_STORE)}


@app.get("/api/dashboard/system-activity")
async def system_activity():
    activities = []
    for run_id, run in sorted(RUN_STORE.items(), key=lambda x: x[1].get("createdAt", ""), reverse=True)[:20]:
        result = run.get("result", {})
        activities.append({
            "runId": run_id, "type": "query", "query": run.get("query", ""),
            "status": run.get("status", "unknown"), "model_used": result.get("model_used"),
            "provider": result.get("provider_used"), "timestamp": run.get("createdAt"),
        })
    return {"activities": activities}


@app.get("/api/dashboard/ai-efficiency")
async def ai_efficiency():
    total_carbon_g = 0.0
    total_tokens = 0
    model_usage: dict = {}
    provider_usage: dict = {}
    for run in RUN_STORE.values():
        result = run.get("result", {})
        total_carbon_g += DEFAULT_CARBON_G
        total_tokens += result.get("token_count", 0)
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
