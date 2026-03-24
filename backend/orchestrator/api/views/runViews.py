import uuid
from datetime import datetime, timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from orchestrator.audit_logger import log_audit

from orchestrator.api.schemas.runSchemas import CreateRunRequestSerializer
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

RUN_STORE = {}
SOURCE_STORE = {}


def getIsoTimestamp():
    return datetime.now(timezone.utc).isoformat()


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

    RUN_STORE[runId] = {
        "query": serializer.validated_data["query"],
        "createdAt": createdAt,
        "request_id": request_id,
    }

    SOURCE_STORE["src_001"] = {
        "sourceId": "src_001",
        "title": "Placeholder Source",
        "fullText": "Lorem Ipsum Source content.",
    }

    return Response(
        {
            "runId": runId,
            "status": RUN_STATUS_RUNNING,
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
                "title": "Placeholder Analysis",
                "updatedAt": run["createdAt"],
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

    responseBody = {
        "runId": runId,
        "status": RUN_STATUS_COMPLETED,
        "title": "Placeholder Legal Analysis",
        "lastUpdatedAt": run["createdAt"],
        "keyFinding": {
            "summary": "Lorem ipsum placeholder key finding.",
            "impactLevel": "high",
            "actionRequired": True,
        },
        "statutoryBasis": {
            "analysis": [
                {
                    "text": "Lorem ipsum statutory analysis paragraph.",
                    "citations": ["src_001"],
                }
            ]
        },
        "precedents": [
            {
                "caseName": "Placeholder Case",
                "court": "High Court",
                "year": 2024,
                "authority": "persuasive",
                "timesCited": 0,
                "summary": "Lorem ipsum case summary.",
            }
        ],
        "agentCommentary": {
            "aiGenerated": True,
            "content": "Lorem ipsum agent commentary.",
            "suggestedActions": [
                {"label": "Placeholder action", "actionId": "placeholderAction"}
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