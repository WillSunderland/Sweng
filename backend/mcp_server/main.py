from mcp.server.fastmcp import FastMCP
from typing import List

# Initialize the MCP Server
mcp = FastMCP("Propylon-Legislative-Research")

@mcp.tool()
def search_elasticsearch(query: str, top_k: int = 5) -> str:
    """
    Search for legislative documents in the Propylon ElasticSearch index.
    Args:
        query: The user's natural language question regarding laws.
        top_k: Number of documents to retrieve.
    """
    # TODO: Connect to actual ElasticSearch instance provided by Propylon
    # Implementation pending Sprint 1
    return f"Mock results for: {query}"

if __name__ == "__main__":
    mcp.run()
