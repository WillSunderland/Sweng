import logging
from nl_query.schemas import DocumentHits, NLQueryRequest, NLQueryResult

logger = logging.getLogger("nl-query-service")


async def NLQueryService(request: NLQueryRequest) -> NLQueryResult:
    """

    Accepts a natural language query, calls the orchestrator / MCP tool, and returns the
    structured results

    """
    logger.info("Received NLQuery request: %s", request.query)
    try:
        intial_state = {"query": request.query, "messages": [], "documents": []}
        # graph_app is the result from the graph.py in orchestrator
        result = await graph_app.ainvoke(intial_state)  # noqa: F821

        results = [
            DocumentHits(
                document_id=h["document_id"],
                bill_id=h["bill_id"],
                title=h["title"],
                chunk_id=h["chunk_id"],
                text=h["text"],
                score=h.get("score", 1.0),
            )
            for h in result.get("results", [])
        ]

        return NLQueryResult(query=request.query, top_k=request.top_k, results=results)

    except Exception as e:
        logger.exception("NLQuery request failed: %s", e)
        return NLQueryResult(query=request.query, top_k=request.top_k, results=[])
