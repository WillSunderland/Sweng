from __future__ import annotations

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
    bill_id: str = ""
    state: str = ""
    bill_type: str = ""
    bill_number: str = ""
    session: str = ""
    policy_area: str = ""
    source_file: str = ""
    relevance_score: float = 0.0


class QueryResponse(BaseModel):
    answer: str
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


class HealthResponse(BaseModel):
    status: str
    opensearch: str | None = None
    nvidia_llm: str | None = None
    hf_llm: str | None = None
    version: str
    isOpensearchConnected: bool


QueryRequest.model_rebuild()
