from mcp.server.fastmcp import FastMCP
from typing import List, Dict
import logging
import os
from elasticsearch import Elasticsearch
from sentence_transformers import SentenceTransformer

ES_URL = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")
INDEX_NAME = os.getenv("INDEX_NAME", "legislation_chunks")
EMBED_MODEL = os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2")

_es_client = None
_embedder = None



logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mcp-server")

# Initialize the MCP Server
mcp = FastMCP(name = "Propylon-Legislative-Research",
              instructions=("This MCP server provides AI-assisted legislative research tools, "
                            "retrieving an summarising relevant legal documents."),
              )

def get_es_client() -> Elasticsearch:
    """
    - Creates and caches a connection to Elasticsearch using ELASTICSEARCH_URL.
    - Meaning the MCP server can talk to the search index.
    """
    global _es_client
    if _es_client is None:
        _es_client = Elasticsearch(ES_URL)
    return _es_client


def get_embedder() -> SentenceTransformer:
    """
    Load and cache the embedding model.
    Used to convert user queries into vectors for semantic search.
    """
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(EMBED_MODEL)
    return _embedder

def embed_query(user_question: str) -> List[float]:
    """
    Convert a user question string into an embedding vector (list of floats).
    """
    model = get_embedder()
    vec = model.encode([user_question], normalize_embeddings=True)
    return vec[0].tolist()

def vector_search(query_vector: List[float], top_k: int = 5, state: str = "TX") -> dict:
    """
    Run kNN vector search on Elasticsearch.

    Returns:
      Raw Elasticsearch response JSON (dict).

    - Sends a kNN query to Elasticsearch:
    - uses the embedding field
    - asks for top_k best matches
    - filters results to Texas only (state="TX")

    - Returns the raw Elasticsearch response JSON.
    """
    client = get_es_client()

    body = {
        "size": top_k,
        "knn": {
            "field": "embedding",
            "query_vector": query_vector,
            "k": top_k,
            "num_candidates": max(50, top_k * 10),
        },
        "query": {
            "bool": {
                "filter": [
                    {"term": {"state": state}}
                ]
            }
        },
        "_source": [
            "bill_id",
            "state",
            "session",
            "title",
            "chunk_id",
            "chunk_text",
        ],
    }

    return client.search(index=INDEX_NAME, body=body)

def format_hits(raw_res: dict, user_question: str, top_k: int) -> dict:
    """
    Convert raw Elasticsearch response into structured JSON output.

    - Extracts the important bits from raw Elasticsearch JSON:
    -   doc_id, score, bill_id, title, chunk_id, chunk text
    - Returns a clean structured JSON response.   
    """
    hits = raw_res.get("hits", {}).get("hits", [])

    results = []
    for h in hits:
        src = h.get("_source", {})
        results.append({
            "doc_id": h.get("_id"),
            "score": h.get("_score"),
            "bill_id": src.get("bill_id"),
            "title": src.get("title"),
            "chunk_id": src.get("chunk_id"),
            "text": src.get("chunk_text"),
        })

    return {
        "query": user_question,
        "top_k": top_k,
        "results": results,
    }


@mcp.tool()
def search_elasticsearch(query: str, top_k: int = 5, state: str = "TX") -> dict:
    """
    Input:
      query: user natural language question
      top_k: number of chunks to return
      state: metadata filter (default TX)

    Output:
      Structured JSON:
        {
          "query": "...",
          "top_k": 5,
          "results": [
            {"doc_id": "...", "score": ..., "bill_id": "...", "title": "...", "chunk_id": 0, "text": "..."}
          ]
        }
    """
    logger.info("Received semantic search query: %s", query)

    try:
        # 1) Convert user query -> embedding vector
        qvec = embed_query(query)

        # 2) Vector search in Elasticsearch
        raw = vector_search(qvec, top_k=top_k, state=state)

        # 3) Format results into clean JSON
        return format_hits(raw, query, top_k)

    except Exception as e:
        logger.exception("Search failed: %s", e)
        return {"query": query, "top_k": top_k, "results": []}

def main():
    logger.info("Starting MCP Server: Propylon Legislative Research")
    try:
        mcp.run()
    except KeyboardInterrupt:
        logger.info("MCP Server stopped by user")

if __name__ == "__main__":
    main()

