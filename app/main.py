from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from opensearchpy import OpenSearch

from app.config import getSettings
from app.graph.builder import buildGraph
from app.models import HealthResponse, QueryRequest, QueryResponse, SourceInfo
from app.services.opensearch_client import createOpensearchClient

logger = logging.getLogger(__name__)

ERROR_GRAPH_NOT_INITIALIZED = "GRAPH_NOT_INITIALIZED"
ERROR_GRAPH_EXECUTION = "GRAPH_EXECUTION_ERROR"

_opensearchClient: OpenSearch | None = None
_compiledGraph = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _opensearchClient, _compiledGraph

    settings = getSettings()
    _opensearchClient = createOpensearchClient(settings)
    _compiledGraph = buildGraph(
        client=_opensearchClient, index=settings.opensearch_index
    )

    logger.info("LangGraph state machine compiled successfully")
    logger.info(
        "OpenSearch target: %s:%s/%s",
        settings.opensearch_host,
        settings.opensearch_port,
        settings.opensearch_index,
    )

    yield

    if _opensearchClient:
        _opensearchClient.close()
        logger.info("OpenSearch client closed")


settings = getSettings()
cors_origins = [
    origin.strip()
    for origin in settings.cors_allowed_origins.split(",")
    if origin.strip()
]

app = FastAPI(
    title=settings.app_name,
    description="## LangGraph RAG Pipeline API\n\n"
    "Exposes a LangGraph state machine: **Input -> Search -> Output**.\n\n"
    "Send a POST to `/query` with a natural language query.",
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get(
    "/health", response_model=HealthResponse, tags=["Status"], summary="Health check"
)
async def health():
    isConnected = False
    if _opensearchClient:
        try:
            info = _opensearchClient.info()
            isConnected = bool(info)
        except Exception:
            pass

    # LLM health checks
    from app.services.nvidia_client import NvidiaLLMClient
    from app.services.hf_client import HuggingFaceLLMClient

    nv_client = NvidiaLLMClient()
    hf_client_inst = HuggingFaceLLMClient()

    nvidia_ok = await nv_client.health_check()
    hf_ok = await hf_client_inst.health_check()

    return HealthResponse(
        status="ok" if (isConnected and nvidia_ok) else "degraded",
        opensearch="ok" if isConnected else "down",
        nvidia_llm="ok" if nvidia_ok else "down",
        hf_llm="ok" if hf_ok else "down",
        version=settings.app_version,
        isOpensearchConnected=isConnected,
    )


@app.post("/query", response_model=QueryResponse)
async def query_endpoint(request: QueryRequest):
    if _compiledGraph is None:
        raise HTTPException(status_code=503, detail=ERROR_GRAPH_NOT_INITIALIZED)

    initialState = {
        "query": request.query,
        "chat_history": [message.model_dump() for message in request.chat_history],
        "max_reasoning_steps": request.max_reasoning_steps
        or settings.max_reasoning_steps,
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

    try:
        # Use ainvoke for async compatibility
        result = await _compiledGraph.ainvoke(initialState)

        # Map graph output to new response model
        response_data = result.get("response", {})

        return QueryResponse(
            answer=response_data.get("answer", "No answer generated."),
            sources=[SourceInfo(**s) for s in response_data.get("sources", [])],
            model_used=response_data.get("model_used"),
            provider=response_data.get("provider"),
            carbonCountInTons=response_data.get("carbonCountInTons", 0.0),
            token_count=response_data.get("token_count", 0),
            error=response_data.get("error"),
            rewritten_query=response_data.get("rewritten_query"),
            plan=response_data.get("plan", []),
            reasoning_steps=response_data.get("reasoning_steps", []),
            retrieval_skipped=response_data.get("retrieval_skipped", False),
            citation_validation=response_data.get("citation_validation"),
        )

    except Exception as exc:
        logger.error("Graph execution failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"{ERROR_GRAPH_EXECUTION}: {exc}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.server_host,
        port=settings.server_port,
        reload=settings.debug,
    )
