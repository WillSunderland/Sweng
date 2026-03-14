from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from pydantic import BaseModel
from pydantic import Field

from app.main import app as shared_app
from app.main import query_endpoint
from app.models import ChatMessage, QueryRequest
from app.services.carbon_estimator import tons_to_grams

RUN_STATUS_COMPLETED = "completed"
RUN_STATUS_RUNNING = "running"
DEFAULT_TRUST_SCORE = 85
DEFAULT_CARBON_G = 0.3

RUN_STORE: dict[str, dict] = {}
SOURCE_STORE: dict[str, dict] = {}

app = shared_app


class CreateRunRequest(BaseModel):
    query: str
    chat_history: list[ChatMessage] = Field(default_factory=list)
    max_reasoning_steps: int | None = None


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

    result = await query_endpoint(
        QueryRequest(
            query=request.query,
            chat_history=request.chat_history,
            max_reasoning_steps=request.max_reasoning_steps,
        )
    )
    RUN_STORE[run_id]["result"] = result.model_dump()
    RUN_STORE[run_id]["status"] = RUN_STATUS_COMPLETED

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
    }


@app.get("/api/sources/{source_id}")
async def get_source(source_id: str):
    source = SOURCE_STORE.get(source_id)
    if not source:
        raise HTTPException(status_code=404, detail=f"Source {source_id} not found")
    return source
