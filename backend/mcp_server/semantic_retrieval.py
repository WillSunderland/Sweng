# backend/mcp_server/semantic_retrieval.py
import os
from typing import List, Dict, Any, Optional

from elasticsearch import Elasticsearch
from sentence_transformers import SentenceTransformer
from mmr import mmr_rerank


class SemanticRetriever:
    """
    Semantic retrieval helper used by the MCP tool.

    Reads config from env by default:
      - ELASTICSEARCH_URL (default: http://localhost:9200)
      - INDEX_NAME        (default: legislation_chunks)
      - EMBED_MODEL       (default: all-MiniLM-L6-v2)

    Flow:
      user_query -> embed_query() -> vector_search() -> format_hits()
    """

    def __init__(
        self,
        es_url: Optional[str] = None,
        index_name: Optional[str] = None,
        embed_model: Optional[str] = None,
    ):
        self.es_url = es_url or os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")
        self.index_name = index_name or os.getenv("INDEX_NAME", "legislation_chunks")
        self.embed_model = embed_model or os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2")

        self._es_client: Optional[Elasticsearch] = None
        self._embedder: Optional[SentenceTransformer] = None

    def get_es_client(self) -> Elasticsearch:
        """
        Create and cache an Elasticsearch client.
        """
        if self._es_client is None:
            self._es_client = Elasticsearch(self.es_url)
        return self._es_client

    def get_embedder(self) -> SentenceTransformer:
        """
        Load and cache the sentence-transformers model.
        """
        if self._embedder is None:
            self._embedder = SentenceTransformer(self.embed_model)
        return self._embedder

    def embed_query(self, user_question: str) -> List[float]:
        """
        Convert a user question into an embedding vector (list of floats).
        """
        model = self.get_embedder()
        vec = model.encode([user_question], normalize_embeddings=True)
        return vec[0].tolist()

    def vector_search(
        self, query_vector: List[float], fetch_k: int = 50, state: str = "TX"
    ) -> Dict[str, Any]:
        """
        Run kNN vector search on Elasticsearch.

        Returns:
          Raw Elasticsearch response JSON (dict).

        Notes:
          - Requires your ES index documents to have:
              embedding (dense vector), state, bill_id, session, title, chunk_id, chunk_text
          - Filters to Texas by default (state="TX")
        """
        client = self.get_es_client()

        body = {
            "size": fetch_k,
            "knn": {
                "field": "embedding",
                "query_vector": query_vector,
                "k": fetch_k,
                "num_candidates": max(50, fetch_k * 10),
                "filter": {"term": {"state": state}},
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
                "embedding",
            ],
        }

        return client.search(index=self.index_name, body=body)

    @staticmethod
    def format_hits(
        raw_res: Dict[str, Any], user_question: str, top_k: int
    ) -> Dict[str, Any]:
        """
        Convert raw Elasticsearch response into structured JSON output.
        """
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
                    "chunk_id": src.get("chunk_id"),
                    "text": src.get("chunk_text"),
                    "embedding": src.get("embedding"),
                }
            )

        return {
            "query": user_question,
            "top_k": top_k,
            "results": results,
        }

    def search(self, query: str, top_k: int = 5, state: str = "TX") -> Dict[str, Any]:

        qvec = self.embed_query(query)
        raw = self.vector_search(qvec, fetch_k=50, state=state)
        formatted = self.format_hits(raw, query, top_k)

        chunks = formatted["results"]
        reranked = mmr_rerank(chunks, query_embedding=qvec, top_k=top_k)

        return {
            "query": query,
            "top_k": top_k,
            "results": reranked,
        }
