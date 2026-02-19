from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uuid
import re
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
SOURCE_STORE = {}


def get_iso_timestamp():
    return datetime.now(timezone.utc).isoformat()


# ─── URL resolution helpers ───────────────────────────────────────────────────

BILL_TYPE_MAP = {
    "hr": "house-bill",
    "s": "senate-bill",
    "hjres": "house-joint-resolution",
    "sjres": "senate-joint-resolution",
    "hres": "house-resolution",
    "sres": "senate-resolution",
    "hconres": "house-concurrent-resolution",
    "sconres": "senate-concurrent-resolution",
}

BILL_LABEL_MAP = {
    "hr": "H.R.",
    "s": "S.",
    "hjres": "H.J.Res.",
    "sjres": "S.J.Res.",
    "hres": "H.Res.",
    "sres": "S.Res.",
    "hconres": "H.Con.Res.",
    "sconres": "S.Con.Res.",
}


def congress_url_from_id(bill_id: Optional[str]) -> Optional[str]:
    """
    Try to build a congress.gov URL from a bill ID string.
    Accepts formats like: '118-hr-8775', '118-hr-8775_0'
    Also accepts structured fields passed separately.
    """
    if not bill_id:
        return None
    base = re.sub(r"_\d+$", "", bill_id)
    m = re.match(
        r"^(\d+)-(hr|s|hjres|sjres|hres|sres|hconres|sconres)-(\d+)$", base, re.I
    )
    if not m:
        return None
    congress, bill_type, number = m.group(1), m.group(2).lower(), m.group(3)
    bill_path = BILL_TYPE_MAP.get(bill_type)
    if not bill_path:
        return None
    return f"https://www.congress.gov/bill/{congress}th-congress/{bill_path}/{number}"


def congress_url_from_fields(
    bill_type: Optional[str],
    bill_number: Optional[str],
    congress: Optional[str],
) -> Optional[str]:
    """Build a congress.gov URL from separate bill_type, bill_number, congress fields."""
    if not (bill_type and bill_number and congress):
        return None
    bill_path = BILL_TYPE_MAP.get(bill_type.lower())
    if not bill_path:
        return None
    return f"https://www.congress.gov/bill/{congress}th-congress/{bill_path}/{bill_number}"


def resolve_source_url(source: dict) -> Optional[str]:
    """
    Try every available field to find or construct a real URL for a source.
    """
    # 1. Already a real URL stored
    existing = source.get("url")
    if existing and existing.startswith("http"):
        return existing

    # 2. From bill_id field
    url = congress_url_from_id(source.get("billId") or source.get("bill_id"))
    if url:
        return url

    # 3. From separate bill fields
    url = congress_url_from_fields(
        source.get("billType") or source.get("bill_type"),
        source.get("billNumber") or source.get("bill_number"),
        source.get("congress"),
    )
    if url:
        return url

    # 4. Try to parse the sourceId itself as a bill ID
    url = congress_url_from_id(source.get("sourceId"))
    if url:
        return url

    return None


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

    # In a real app we'd update the run result here
    RUN_STORE[run_id]["result"] = result
    RUN_STORE[run_id]["status"] = RUN_STATUS_COMPLETED

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

    return {"runId": run_id, "status": RUN_STATUS_RUNNING, "createdAt": created_at}


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
            "sourceIds": run.get("sourceIds", []),
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


@app.get("/health")
async def health_check():
    return {"status": "ok"}