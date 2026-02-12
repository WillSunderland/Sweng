from pydantic import BaseModel
from typing import Optional, List

class DocumentHits(BaseModel):
    document_id: str
    bill_id: str
    title: str
    chunk_id: str
    text: str
    score: Optional[float] = None

class NLQueryRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5

class NLQueryResult(BaseModel):
    query: str
    top_k: int
    results: List[DocumentHits]
