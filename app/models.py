from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

MIN_QUERY_LENGTH = 1
MAX_QUERY_LENGTH = 1000


class QueryRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=MIN_QUERY_LENGTH,
        max_length=MAX_QUERY_LENGTH,
        description="Natural language search query",
        json_schema_extra={
            "example": "What are the latest regulations on data privacy?"
        },
    )
    chat_history: list["ChatMessage"] = Field(
        default_factory=list,
        description="Optional prior conversation turns used for follow-up rewriting.",
    )
    max_reasoning_steps: int | None = Field(
        default=None,
        ge=1,
        le=5,
        description="Maximum number of search/read reasoning loops.",
    )


class ChatMessage(BaseModel):
    role: str
    content: str


class SearchResult(BaseModel):
    id: str | None = None
    score: float | None = None
    source: dict[str, Any] = Field(default_factory=dict)


class SourceInfo(BaseModel):
    title: str
    source_id: str = ""
    bill_id: str = ""
    chunk_id: str = ""
    state: str = ""
    bill_type: str = ""
    bill_number: str = ""
    session: str = ""
    policy_area: str = ""
    source_file: str = ""
    relevance_score: float = 0.0


# ── Ticket 5.2: Structured Response Schema for Trust UI ──────────────────────


class SegmentType(str, Enum):
    """Discriminator for response segments."""

    GENERATED = "generated"
    VERBATIM = "verbatim"


class CitationMeta(BaseModel):
    """Citation metadata linking a verbatim quote back to its source document."""

    source_id: str = Field(..., description="Unique identifier for the source document")
    title: str = Field(..., description="Human-readable title of the source document")
    bill_id: str = ""
    chunk_id: str = Field(
        default="", description="Chunk reference within the source document"
    )
    bill_type: str = ""
    bill_number: str = ""
    session: str = ""
    state: str = ""
    policy_area: str = ""
    relevance_score: float = 0.0


class ResponseSegment(BaseModel):
    """A single segment of the structured response."""

    type: SegmentType = Field(
        ..., description="Whether this segment is AI-generated or verbatim quoted text"
    )
    text: str = Field(..., description="The text content of this segment")
    citations: list[CitationMeta] = Field(
        default_factory=list,
        description="Citation metadata (populated for verbatim segments)",
    )


class StructuredAnswer(BaseModel):
    """Top-level structured answer containing typed segments."""

    raw_answer: str = Field(
        ..., description="The original unstructured LLM answer for backwards compat"
    )
    segments: list[ResponseSegment] = Field(
        default_factory=list,
        description="Ordered list of generated/verbatim segments with citation metadata",
    )


class QueryResponse(BaseModel):
    answer: str
    structured_answer: StructuredAnswer | None = Field(
        default=None,
        description="Structured response with typed segments for trust UI rendering",
    )
    sources: list[SourceInfo] = Field(default_factory=list)
    model_used: str | None = None
    provider: str | None = None
    carbonCountInTons: float = 0.0
    token_count: int = 0
    error: str | None = None
    rewritten_query: str | None = None
    plan: list[str] = Field(default_factory=list)
    reasoning_steps: list[dict[str, Any]] = Field(default_factory=list)
    retrieval_skipped: bool = False
    citation_validation: dict[str, Any] | None = None


class HealthResponse(BaseModel):
    status: str
    opensearch: str | None = None
    nvidia_llm: str | None = None
    hf_llm: str | None = None
    version: str
    isOpensearchConnected: bool


QueryRequest.model_rebuild()
