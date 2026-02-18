from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import uuid
from datetime import datetime, timezone
from graph import app as graph_app

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
SOURCE_STORE = {
    "src_001": {
        "sourceId": "src_001",
        "title": "Placeholder Source",
        "fullText": "Lorem Ipsum Source content.",
    }
}


def get_iso_timestamp():
    return datetime.now(timezone.utc).isoformat()


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
    initial_state = {"query": request.query, "messages": [], "documents": []}
    result = await graph_app.ainvoke(initial_state)

    # In a real app we'd update the run result here
    RUN_STORE[run_id]["result"] = result
    RUN_STORE[run_id]["status"] = RUN_STATUS_COMPLETED

    return {"runId": run_id, "status": RUN_STATUS_RUNNING, "createdAt": created_at}


@app.get("/api/runs", response_model=RunList)
async def list_runs():
    items = []
    for run_id, run in RUN_STORE.items():
        items.append(
            {
                "runId": run_id,
                "title": f"Analysis for: {run.get('query', 'Unknown')}",
                "updatedAt": run["createdAt"],
            }
        )
    return {"items": items}


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str):
    run = RUN_STORE.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    # Mock full response for now, merging with real data if available
    return {
        "runId": run_id,
        "status": run.get("status", RUN_STATUS_COMPLETED),
        "title": f"Legal Analysis: {run.get('query')}",
        "lastUpdatedAt": run["createdAt"],
        "keyFinding": {
            "summary": "Lorem ipsum placeholder key finding.",
            "impactLevel": "high",
            "actionRequired": True,
        },
        "statutoryBasis": {
            "analysis": [
                {"text": "Lorem ipsum statutory analysis paragraph.", "citations": ["src_001"]}
            ]
        },
        "precedents": [],
        "agentCommentary": {
            "aiGenerated": True,
            "content": f"Graph Result: {run.get('result', 'No result yet')}",
            "suggestedActions": [],
        },
        "reasoningPath": {
            "engine": "langgraph",
            "steps": [],
            "trustScore": DEFAULT_TRUST_SCORE,
            "carbonTotalG": DEFAULT_CARBON_G,
        },
        "references": {"sourceIds": ["src_001"]},
    }


@app.get("/api/sources/{source_id}")
async def get_source(source_id: str):
    source = SOURCE_STORE.get(source_id)
    if not source:
        raise HTTPException(status_code=404, detail=f"Source {source_id} not found")
    return source


@app.get("/health")
async def health_check():
    return {"status": "ok"}
