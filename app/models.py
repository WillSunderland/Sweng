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
        json_schema_extra={"example": "What are the latest regulations on data privacy?"},
    )


class SearchResult(BaseModel):
    id: str | None = None
    score: float | None = None
    source: dict[str, Any] = Field(default_factory=dict)


class SourceInfo(BaseModel):
    title: str
    source_file: str
    relevance_score: float = 0.0


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceInfo] = Field(default_factory=list)
    model_used: str | None = None
    provider: str | None = None
    token_count: int = 0
    error: str | None = None


class HealthResponse(BaseModel):
    status: str
    opensearch: str | None = None
    nvidia_llm: str | None = None
    hf_llm: str | None = None
    version: str
    isOpensearchConnected: bool
