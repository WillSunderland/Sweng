import uuid
from datetime import datetime, timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from orchestrator.audit_logger import log_audit

try:
    from orchestrator.api.schemas.runSchemas import (
        CreateRunRequestSerializer,
        PatchRunRequestSerializer,
    )
    from orchestrator.api.errors.errorMapping import (
        invalidRequestError,
        runNotFoundError,
        sourceNotFoundError,
    )
    from orchestrator.api.constants.runConstants import (
        RUN_STATUS_RUNNING,
        RUN_STATUS_COMPLETED,
        DEFAULT_TRUST_SCORE,
        DEFAULT_CARBON_G,
    )
except ModuleNotFoundError:
    from api.schemas.runSchemas import (
        CreateRunRequestSerializer,
        PatchRunRequestSerializer,
    )
    from api.errors.errorMapping import (
        invalidRequestError,
        runNotFoundError,
        sourceNotFoundError,
    )
    from api.constants.runConstants import (
        RUN_STATUS_RUNNING,
        RUN_STATUS_COMPLETED,
        DEFAULT_TRUST_SCORE,
        DEFAULT_CARBON_G,
    )

RUN_STORE = {}
SOURCE_STORE = {}


def getIsoTimestamp():
    return datetime.now(timezone.utc).isoformat()


def _infer_priority(query: str) -> str:
    high_indicators = ["urgent", "critical", "deadline", "immediate", "compliance"]
    low_indicators = ["general", "overview", "summary", "curious"]
    q_lower = query.lower()
    if any(kw in q_lower for kw in high_indicators):
        return "high"
    if any(kw in q_lower for kw in low_indicators):
        return "low"
    return "medium"


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def createRun(request):
    serializer = CreateRunRequestSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            invalidRequestError(serializer.errors),
            status=status.HTTP_400_BAD_REQUEST,
        )

    request_id = str(uuid.uuid4())
    runId = f"run_{uuid.uuid4().hex[:12]}"
    createdAt = getIsoTimestamp()
    query = serializer.validated_data["query"]

    # Use explicitly provided priority, otherwise infer from query text
    priority = serializer.validated_data.get("priority") or _infer_priority(query)

    RUN_STORE[runId] = {
        "query": query,
        "createdAt": createdAt,
        "status": RUN_STATUS_RUNNING,
        "priority": priority,
        "request_id": request_id,
    }

    SOURCE_STORE["src_001"] = {
        "sourceId": "src_001",
        "title": "Legislative Source Document",
        "fullText": "Source content pending retrieval.",
    }

    return Response(
        {
            "runId": runId,
            "status": RUN_STATUS_RUNNING,
            "priority": priority,
            "createdAt": createdAt,
            "request_id": request_id,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listRuns(request):
    items = []
    for runId, run in RUN_STORE.items():
        items.append(
            {
                "runId": runId,
                "title": f"Analysis: {run.get('query', 'Research query')[:60]}",
                "updatedAt": run["createdAt"],
                "status": run.get("status", RUN_STATUS_RUNNING),
                "priority": run.get("priority", _infer_priority(run.get("query", ""))),
            }
        )

    return Response({"items": items}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def getRun(request, runId):
    run = RUN_STORE.get(runId)
    if not run:
        return Response(runNotFoundError(runId), status=status.HTTP_404_NOT_FOUND)

    start_time = datetime.now(timezone.utc)

    query_text = run.get("query", "Legal research query")

    responseBody = {
        "runId": runId,
        "status": run.get("status", RUN_STATUS_COMPLETED),
        "priority": run.get("priority", _infer_priority(query_text)),
        "title": f"Analysis: {query_text[:80]}",
        "lastUpdatedAt": run["createdAt"],
        "keyFinding": {
            "summary": f"Analysis completed for: {query_text[:120]}",
            "impactLevel": "high",
            "actionRequired": True,
        },
        "statutoryBasis": {
            "analysis": [
                {
                    "text": "Statutory analysis pending full retrieval pipeline.",
                    "citations": ["src_001"],
                }
            ]
        },
        "precedents": [
            {
                "caseName": "Pending precedent retrieval",
                "court": "N/A",
                "year": 2024,
                "authority": "persuasive",
                "timesCited": 0,
                "summary": "Precedent analysis will be populated by the RAG pipeline.",
            }
        ],
        "agentCommentary": {
            "aiGenerated": True,
            "content": f"AI analysis initiated for query: {query_text[:120]}",
            "suggestedActions": [
                {"label": "View detailed trace", "actionId": "viewTrace"}
            ],
        },
        "reasoningPath": {
            "engine": "langgraph",
            "steps": [
                {
                    "stepId": "semanticSearch",
                    "label": "Semantic Search",
                    "status": "completed",
                },
                {
                    "stepId": "summarization",
                    "label": "Summarization",
                    "status": "completed",
                },
            ],
            "trustScore": DEFAULT_TRUST_SCORE,
            "carbonTotalG": DEFAULT_CARBON_G,
        },
        "references": {
            "sourceIds": ["src_001"],
        },
    }

    end_time = datetime.now(timezone.utc)
    latency_ms = (end_time - start_time).total_seconds() * 1000

    audit_log = {
        "request_id": run.get("request_id"),
        "run_id": runId,
        "timestamp": getIsoTimestamp(),
        "query": run.get("query"),
        "sources": responseBody["references"]["sourceIds"],
        "response": responseBody["agentCommentary"]["content"],
        "model_used": "stub-model",
        "latency_ms": latency_ms,
    }

    log_audit(audit_log)

    return Response(responseBody, status=status.HTTP_200_OK)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def patchRun(request, runId):
    run = RUN_STORE.get(runId)
    if not run:
        return Response(runNotFoundError(runId), status=status.HTTP_404_NOT_FOUND)

    serializer = PatchRunRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            invalidRequestError(serializer.errors),
            status=status.HTTP_400_BAD_REQUEST,
        )

    if "status" in serializer.validated_data:
        RUN_STORE[runId]["status"] = serializer.validated_data["status"]
    if "priority" in serializer.validated_data:
        RUN_STORE[runId]["priority"] = serializer.validated_data["priority"]

    RUN_STORE[runId]["updatedAt"] = getIsoTimestamp()

    return Response(
        {
            "runId": runId,
            "status": RUN_STORE[runId].get("status"),
            "priority": RUN_STORE[runId].get("priority"),
            "updatedAt": RUN_STORE[runId]["updatedAt"],
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def getSource(request, sourceId):
    source = SOURCE_STORE.get(sourceId)
    if not source:
        return Response(
            sourceNotFoundError(sourceId),
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(source, status=status.HTTP_200_OK)
