from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, AsyncGenerator
import asyncio
import json
import random
import re
import time
import uuid
from datetime import datetime, timezone
from graph import app as graph_app
from semantic_retrieval import SemanticRetriever
from url_utils import resolve_source_url
from cache import QueryCache
from services.carbon_estimator import estimate_carbon_tons, tons_to_grams
import logging

logger = logging.getLogger(__name__)

app = FastAPI(title="Orchestrator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Models (Schema)
class CreateRunRequest(BaseModel):
    query: str


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


# Constants
RUN_STATUS_RUNNING = "running"
RUN_STATUS_COMPLETED = "completed"
DEFAULT_TRUST_SCORE = 85
DEFAULT_CARBON_G = 0.5

# In-memory stores
RUN_STORE = {}
SOURCE_STORE = {}
query_cache = QueryCache(ttl_seconds=3600, max_size=100)


def get_iso_timestamp():
    return datetime.now(timezone.utc).isoformat()


def _store_sources(run_id: str, result: dict) -> None:
    # Build source store entries for this run
    # Include every field the frontend might use to resolve a URL or build a citation
    documents = result.get("documents", []) or []
    source_ids = []
    for doc in documents:
        source_id = doc.get("doc_id") or f"src_{uuid.uuid4().hex[:8]}"
        source_ids.append(source_id)

        # Try to extract congress number from bill_id
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
        # Resolve and store URL immediately
        source_entry["url"] = resolve_source_url(source_entry)
        SOURCE_STORE[source_id] = source_entry

    RUN_STORE[run_id]["sourceIds"] = source_ids
    # Also store the raw documents list for the run response
    RUN_STORE[run_id]["documents"] = documents


async def _generate_run_events(query: str) -> AsyncGenerator[str, None]:

    # Streams SSE events to the frontend as the LangGraph pipeline runs.

    run_id = f"run_{uuid.uuid4().hex[:12]}"
    start = time.monotonic()

    # Store initial state (mirrors what create_run does for polling compatibility)
    RUN_STORE[run_id] = {
        "query": query,
        "createdAt": get_iso_timestamp(),
        "status": RUN_STATUS_RUNNING,
    }

    # Small helper to build a consistently shaped SSE frame
    def sse(event_type: str, label: str, **kwargs) -> str:
        elapsed = round(time.monotonic() - start, 2)
        payload = json.dumps(
            {"event": event_type, "label": label, "elapsed": elapsed, **kwargs}
        )
        return f"data: {payload}\n\n"

    try:
        yield sse("init", "Starting analysis...", runId=run_id)

        # Check cache first, no point re-running the full pipeline
        cached = query_cache.get(query)
        if cached:
            yield sse("thinking", "Checking cache...")
            await asyncio.sleep(0.1)
            RUN_STORE[run_id]["result"] = cached
            RUN_STORE[run_id]["status"] = RUN_STATUS_COMPLETED
            _store_sources(run_id, cached)
            carbon_g = round(
                tons_to_grams(
                    estimate_carbon_tons(
                        cached.get("model_used"), cached.get("provider_used")
                    )
                ),
                4,
            )
            yield sse(
                "complete",
                "Analysis complete",
                runId=run_id,
                tokenCount=cached.get("token_count", 0),
                carbonG=carbon_g,
            )
            return

        initial_state = {
            "query": query,
            "processed_query": "",
            "documents": [],
            "answer": "",
            "model_used": "",
            "provider_used": "",
            "token_count": 0,
            "error": "",
        }

        yield sse("thinking", "Thinking...")
        await asyncio.sleep(random.uniform(5.0, 12.0))

        result: dict = {}
        async for chunk in graph_app.astream(initial_state):
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

        query_cache.set(query, result)
        RUN_STORE[run_id]["result"] = result
        RUN_STORE[run_id]["status"] = RUN_STATUS_COMPLETED
        _store_sources(run_id, result)

        carbon_g = round(
            tons_to_grams(
                estimate_carbon_tons(
                    result.get("model_used"), result.get("provider_used")
                )
            ),
            4,
        )
        yield sse(
            "complete",
            "Analysis complete",
            runId=run_id,
            tokenCount=result.get("token_count", 0),
            carbonG=carbon_g,
        )

    except Exception as e:
        logger.error("Stream error for run %s: %s", run_id, e)
        yield sse("error", str(e), runId=run_id)


@app.post("/api/runs", response_model=RunResponse, status_code=201)
async def create_run(request: CreateRunRequest):
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    created_at = get_iso_timestamp()

    # Store initial state
    RUN_STORE[run_id] = {
        "query": request.query,
        "createdAt": created_at,
        "status": RUN_STATUS_RUNNING,
    }

    # Trigger LangGraph workflow (async in background in real app)
    # For now, we just invoke it so we verify it works
    # Check cache first
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

    # In a real app we'd update the run result here
    RUN_STORE[run_id]["result"] = result
    RUN_STORE[run_id]["status"] = RUN_STATUS_COMPLETED
    _store_sources(run_id, result)

    return {"runId": run_id, "status": RUN_STATUS_RUNNING, "createdAt": created_at}


@app.get("/api/runs/stream")
async def stream_run(query: str):
    """SSE endpoint — streams agent thought events while processing a query."""
    return StreamingResponse(
        _generate_run_events(query),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/runs", response_model=RunList)
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

    # Build a cleaned documents list for the frontend
    # Include every field the frontend might use to resolve a URL or build a citation
    raw_docs = run.get("documents", result.get("documents", []) or [])
    enriched_docs = []
    for doc in raw_docs:
        source_id = doc.get("doc_id") or doc.get("id")
        # Pull pre-resolved URL from SOURCE_STORE if available
        stored_url = None
        if source_id and source_id in SOURCE_STORE:
            stored_url = SOURCE_STORE[source_id].get("url")

        enriched_docs.append(
            {
                **doc,
                "id": source_id,
                # Expose URL at the top level for easy consumption
                "url": stored_url or doc.get("url"),
            }
        )

    return {
        "runId": run_id,
        "status": run.get("status", RUN_STATUS_COMPLETED),
        "title": f"Legal Analysis: {run.get('query')}",
        "lastUpdatedAt": run["createdAt"],
        "answer": result.get("answer", ""),
        "model_used": result.get("model_used", ""),
        "provider_used": result.get("provider_used", ""),
        "keyFinding": {
            "summary": result.get("answer", ""),
            "impactLevel": "high",
            "actionRequired": True,
        },
        "statutoryBasis": {"analysis": []},
        "agentCommentary": {
            "aiGenerated": True,
            "content": result.get("answer", "No result yet"),
            "suggestedActions": [],
        },
        "documents": enriched_docs,
        "reasoningPath": {
            "engine": "langgraph",
            "steps": [],
            "trustScore": DEFAULT_TRUST_SCORE,
            "carbonTotalG": DEFAULT_CARBON_G,
        },
        "references": {
            "sourceIds": ["src_001"],
        },
    }


@app.get("/api/sources/{source_id}")
async def get_source(source_id: str):
    source = SOURCE_STORE.get(source_id)
    if not source:
        raise HTTPException(status_code=404, detail=f"Source {source_id} not found")

    # Ensure URL is resolved even if it wasn't at ingest time
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
