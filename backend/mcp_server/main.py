from mcp.server.fastmcp import FastMCP
from typing import List, Dict
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mcp-server")

# Initialize the MCP Server
mcp = FastMCP(name = "Propylon-Legislative-Research",
              instructions=("This MCP server provides AI-assisted legislative research tools, "
                            "retrieving an summarising relevant legal documents."),
              )

DUMMY_DOCS = [
    {
        "title": "Planning and Development Act 2000",
        "summary": "Core legalisation regarding planning in Ireland"
    },
    {
        "title": "Housing (Regulation of Approved Housing Bodies) Act 2019",
        "summary": "Regulates approved housing bodies.",
    },
]

@mcp.tool()
def search_elasticsearch(query: str, top_k: int = 5) -> List[Dict[str, str]]:
    """
    Search for legislative documents in the Propylon ElasticSearch index.
    Args:
        query: The user's natural language question regarding laws.
        top_k: Number of documents to retrieve.
    """
    # TODO: Connect to actual ElasticSearch instance provided by Propylon
    logger.info("Received search query: %s", query)
    try:
        # TODO (Ticket 2.2): Replace with real ElasticSearch query
        results = DUMMY_DOCS[:top_k]
        return results

    except Exception as e:
        logger.error("Search failed: %s", e)
        return []

def main():
    logger.info("Starting MCP Server: Propylon Legislative Research")
    try:
        mcp.run()
    except KeyboardInterrupt:
        logger.info("MCP Server stopped by user")

if __name__ == "__main__":
    main()

