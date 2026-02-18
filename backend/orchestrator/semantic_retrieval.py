# backend/orchestrator/semantic_retrieval.py
import os
from typing import Any, Dict, List, Optional

from elasticsearch import Elasticsearch
from sentence_transformers import SentenceTransformer


class SemanticRetriever:
    """
    Semantic retrieval helper used by the orchestrator.

    Reads config from env by default:
      - ELASTICSEARCH_URL (default: http://elasticsearch:9200)
      - INDEX_NAME        (default: legislation_chunks)
      - EMBED_MODEL       (default: all-MiniLM-L6-v2)
      - STATE_CODE        (default: TX)
    """

    def __init__(
        self,
        es_url: Optional[str] = None,
        index_name: Optional[str] = None,
        embed_model: Optional[str] = None,
        state_code: Optional[str] = None,
    ):
        self.es_url = es_url or os.getenv(
            "ELASTICSEARCH_URL", "http://elasticsearch:9200"
        )
        self.index_name = index_name or os.getenv("INDEX_NAME", "legislation_chunks")
        self.embed_model = embed_model or os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2")
        self.state_code = state_code or os.getenv("STATE_CODE", "TX")

        self._es_client: Optional[Elasticsearch] = None
        self._embedder: Optional[SentenceTransformer] = None

    def get_es_client(self) -> Elasticsearch:
        if self._es_client is None:
            self._es_client = Elasticsearch(self.es_url)
        return self._es_client

    def get_embedder(self) -> SentenceTransformer:
        if self._embedder is None:
            self._embedder = SentenceTransformer(self.embed_model)
        return self._embedder

    def embed_query(self, user_question: str) -> List[float]:
        model = self.get_embedder()
        vec = model.encode([user_question], normalize_embeddings=True)
        return vec[0].tolist()

    def vector_search(
        self, query_vector: List[float], top_k: int = 5, state: Optional[str] = None
    ) -> Dict[str, Any]:
        client = self.get_es_client()
        state_filter = state or self.state_code

        body: Dict[str, Any] = {
            "size": top_k,
            "knn": {
                "field": "embedding",
                "query_vector": query_vector,
                "k": top_k,
                "num_candidates": max(50, top_k * 10),
            },
            "_source": [
                "bill_id",
                "state",
                "session",
                "title",
                "policy_area",
                "bill_type",
                "bill_number",
                "latest_action",
                "chunk_id",
                "chunk_text",
            ],
        }

        if state_filter:
            body["knn"]["filter"] = {"term": {"state": state_filter}}

        return client.search(index=self.index_name, body=body)

    @staticmethod
    def format_hits(raw_res: Dict[str, Any]) -> List[Dict[str, Any]]:
        hits = raw_res.get("hits", {}).get("hits", [])
        results = []
        for h in hits:
            src = h.get("_source", {})
            results.append(
                {
                    "doc_id": h.get("_id"),
                    "score": h.get("_score"),
                    "bill_id": src.get("bill_id"),
                    "title": src.get("title"),
                    "policy_area": src.get("policy_area"),
                    "bill_type": src.get("bill_type"),
                    "bill_number": src.get("bill_number"),
                    "latest_action": src.get("latest_action"),
                    "session": src.get("session"),
                    "state": src.get("state"),
                    "chunk_id": src.get("chunk_id"),
                    "chunk_text": src.get("chunk_text"),
                }
            )
        return results

    def search(
        self, query: str, top_k: int = 5, state: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        qvec = self.embed_query(query)
        raw = self.vector_search(qvec, top_k=top_k, state=state)
        return self.format_hits(raw)
