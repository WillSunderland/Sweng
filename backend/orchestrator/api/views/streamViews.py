import json
import logging
import uuid
from datetime import datetime, timezone

from django.http import StreamingHttpResponse
from backend.orchestrator.audit_logger import log_audit

logger = logging.getLogger(__name__)

# Node name → SSE state event mapping
NODE_STATE_MAP = {
    "inputNode": "thinking",
    "queryRewriteNode": "thinking",
    "planNode": "thinking",
    "prefetchDecisionNode": "thinking",
    "searchNode": "searching",
    "readNode": "reading",
    "routerNode": "thinking",
    "nvidiaLlmNode": "answering",
    "hfLlmNode": "answering",
    "llmOutputNode": "answering",
}


def _get_graph():
    """Lazily import the compiled graph from the FastAPI app context."""
    try:
        from app.main import _compiledGraph
        return _compiledGraph
    except Exception as e:
        logger.error("Failed to import compiled graph: %s", e)
        return None


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _stream_events(query: str, request_id: str = None):
    """
    Synchronous generator that runs the async LangGraph pipeline
    and yields SSE-formatted strings.
    """
    import asyncio

    async def _run():

        graph = _get_graph()
        if graph is None:
            yield _sse("error", {"message": "Graph not initialised"})
            yield _sse("done", {"status": "error"})
            return

        initial_state = {
            "query": query,
            "chat_history": [],
            "max_reasoning_steps": 3,
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

        emitted_states = set()

        final_answer = ""
        sources = []
        start_time = datetime.now(timezone.utc)

        # Stream node-level events from LangGraph
        async for event in graph.astream_events(initial_state, version="v2"):
            kind = event.get("event")
            node = event.get("name", "")

            if kind == "on_chain_start" and node in NODE_STATE_MAP:
                state_label = NODE_STATE_MAP[node]
                if state_label not in emitted_states:
                    emitted_states.add(state_label)
                    yield _sse("state", {"state": state_label})

            elif kind == "on_chain_end" and node == "llmOutputNode":
                # Final answer is ready — stream it token by token
                output = event.get("data", {}).get("output", {})
                response = output.get("response", {})
                answer = response.get("answer", "")

                if answer:
                    final_answer = answer

                    for token in answer.split():
                        yield _sse("token", {"token": token})
                        await asyncio.sleep(0.02)

        # ---- AUDIT LOGGING ----
        end_time = datetime.now(timezone.utc)
        latency_ms = (end_time - start_time).total_seconds() * 1000

        audit_log = {
            "request_id": request_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "query": query,
            "sources": sources,
            "response": final_answer,
            "model_used": "streaming-llm",
            "latency_ms": latency_ms,
        }

        log_audit(audit_log)
        # -----------------------

        yield _sse("done", {"status": "complete"})

    # Run async generator and collect outputs
    async def _collect():
        results = []
        async for chunk in _run():
            results.append(chunk)
        return results

    loop = asyncio.new_event_loop()
    try:
        chunks = loop.run_until_complete(_collect())
        for chunk in chunks:
            yield chunk
    finally:
        loop.close()


def streamResponse(request):
    query = request.GET.get("query", "")
    if not query:

        def empty():
            yield f"event: error\ndata: {json.dumps({'message': 'query parameter is required'})}\n\n"

        return StreamingHttpResponse(empty(), content_type="text/event-stream")

    request_id = str(uuid.uuid4())

    response = StreamingHttpResponse(
        _stream_events(query, request_id),
        content_type="text/event-stream"
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"

    return response