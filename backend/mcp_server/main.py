from mcp.server.fastmcp import FastMCP
from typing import List, Dict
import logging
from semantic_retrieval import SemanticRetriever




logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mcp-server")

# Initialize the MCP Server
mcp = FastMCP(name = "Propylon-Legislative-Research",
              instructions=("This MCP server provides AI-assisted legislative research tools, "
                            "retrieving and summarising relevant legal documents."),
              )

# Create ONE retriever instance (caches ES connection + embedding model)
retriever = SemanticRetriever()


@mcp.tool()
def search_elasticsearch(query: str, top_k: int = 5, state: str = "TX") -> dict:
    """

    Input:
      query: user natural language question
      top_k: number of chunks to return
      state: metadata filter (default TX)

    Output:
      {
        "query": "...",
        "top_k": 5,
        "results": [
          {"doc_id": "...", "score": ..., "bill_id": "...", "title": "...", "policy_area": "...", 
          "bill_type": "...", "bill_number": "...", "latest_action": "...", "chunk_id": 0, "text": "..."}
        ]
      }
    """
    logger.info("Received semantic search query: %s", query)
    try:
        return retriever.search(query=query, top_k=top_k, state=state)
    except Exception:
        logger.exception("Search failed")
        return {"query": query, "top_k": top_k, "results": []}

def main():
    logger.info("Starting MCP Server: Propylon Legislative Research")
    try:
        mcp.run()
    except KeyboardInterrupt:
        logger.info("MCP Server stopped by user")

if __name__ == "__main__":
    main()

