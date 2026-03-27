from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.models import (
    CitationMeta,
    QueryResponse,
    ResponseSegment,
    SegmentType,
    SourceInfo,
    StructuredAnswer,
)
from backend.orchestrator import main as orchestrator_main


def _mock_query_response() -> QueryResponse:
    citation = CitationMeta(
        source_id="NV-HB-123",
        title="Nevada Tax Reform Act",
        bill_id="NV-HB-123",
        chunk_id="chunk_001",
        bill_type="HB",
        bill_number="123",
        session="2024",
        state="Nevada",
        policy_area="Taxation",
        relevance_score=0.95,
    )
    return QueryResponse(
        answer="Nevada requires a new threshold.",
        structured_answer=StructuredAnswer(
            raw_answer=(
                "Nevada requires a new threshold. "
                "\u00abVERBATIM\u00bbSection 5: All individuals earning above "
                "$80,000 shall be subject to...\u00ab/VERBATIM\u00bb "
                "[Source: Nevada Tax Reform Act]"
            ),
            segments=[
                ResponseSegment(
                    type=SegmentType.GENERATED,
                    text="Nevada requires a new threshold.",
                    citations=[citation],
                ),
                ResponseSegment(
                    type=SegmentType.VERBATIM,
                    text=(
                        "Section 5: All individuals earning above $80,000 "
                        "shall be subject to..."
                    ),
                    citations=[citation],
                ),
            ],
        ),
        sources=[
            SourceInfo(
                title="Nevada Tax Reform Act",
                source_id="NV-HB-123",
                bill_id="NV-HB-123",
                chunk_id="chunk_001",
                state="Nevada",
                bill_type="HB",
                bill_number="123",
                session="2024",
                policy_area="Taxation",
                source_file=(
                    "Section 5: All individuals earning above $80,000 shall "
                    "be subject to..."
                ),
                relevance_score=0.95,
            )
        ],
        model_used="gpt-4-legal",
        provider="nvidia",
        token_count=42,
        citation_validation={
            "valid_citations": ["Nevada Tax Reform Act"],
            "hallucinated_citations": [],
            "uncited_sources": [],
            "citation_accuracy": 1.0,
        },
    )


@pytest.fixture(autouse=True)
def reset_orchestrator_state():
    orchestrator_main.RUN_STORE.clear()
    orchestrator_main.SOURCE_STORE.clear()
    orchestrator_main.SESSION_STORE.clear()
    orchestrator_main._query_cache.clear()
    yield
    orchestrator_main.RUN_STORE.clear()
    orchestrator_main.SOURCE_STORE.clear()
    orchestrator_main.SESSION_STORE.clear()
    orchestrator_main._query_cache.clear()


@pytest.mark.asyncio
async def test_orchestrator_run_returns_structured_answer_and_chunk_metadata():
    mock_result = _mock_query_response()

    with patch.object(
        orchestrator_main,
        "query_endpoint",
        new=AsyncMock(return_value=mock_result),
    ):
        created = await orchestrator_main.create_run(
            orchestrator_main.CreateRunRequest(query="What does Nevada HB 123 do?")
        )

    run = await orchestrator_main.get_run(created["runId"])
    source = await orchestrator_main.get_source(f"{created['runId']}_src_001")

    assert run["structured_answer"]["segments"][1]["type"] == "verbatim"
    assert (
        run["structured_answer"]["segments"][1]["citations"][0]["chunk_id"]
        == "chunk_001"
    )
    assert run["documents"][0]["chunk_id"] == "chunk_001"
    assert run["documents"][0]["chunk_text"].startswith("Section 5:")
    assert source["documentId"] == "NV-HB-123"
    assert source["chunkId"] == "chunk_001"


@pytest.mark.asyncio
async def test_cached_runs_keep_structured_answer_payload():
    cached_result = _mock_query_response().model_dump()
    orchestrator_main._query_cache.set("What does Nevada HB 123 do?", cached_result)

    with patch.object(
        orchestrator_main,
        "query_endpoint",
        new=AsyncMock(side_effect=AssertionError("query_endpoint should not run")),
    ):
        created = await orchestrator_main.create_run(
            orchestrator_main.CreateRunRequest(query="What does Nevada HB 123 do?")
        )

    run = await orchestrator_main.get_run(created["runId"])

    assert run["structured_answer"] == cached_result["structured_answer"]
    assert run["documents"][0]["chunk_id"] == "chunk_001"
