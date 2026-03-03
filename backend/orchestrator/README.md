# Orchestrator Folder

This folder contains the component that is responsible for creating a Fast API eng and a LangGraph
Orchestrator.

It acts as the control layer between User Facing API Endpoints and MCP Tools and the RAG Pipelines

## What it is for

We need a place in which we can implement the FastAPI endpoint, which is responsible for 
1) Exposing the FASTAPI endpoints
2) Intialise the FastAPI endpoint
3) Configure the environment variables
4) Add the Langgraph Project structure
5) verify the backend runs locally

## Files in this Folder

## 'graph.py'
It defines the LangGraph orchestration workflow used to process the user's natural language query.

It models the querying process as a set of states graphs, where each node represents a distinct step in
the reasoning and retrieval process

The Workflow nodes are 
1) query_rewriter
2) retrieve_docs
3) generate_answer

## 'main.py'
This file defines the FastAPI-based Orchestrator API, which acts as the control layer between user-facing 
endpoints and the LangGraph workflow. It is responsible for receiving user queries, triggering the 
LangGraph orchestration pipeline, and exposing run metadata and results via REST endpoints.

API Responsibilities
1) Accepts the Natural Language Query
2) Creates a run for each query
3) Invokes the LangGraph workflow to process each query
4) Returns a structured response

Key Endpoints
1) Post /api/runs
2) GET  /api/runs
3) GET  /api/runs/{run_id}
4) GET  /api/sources/{source_id}
5) GET  /api/stats
6) GET  /health

## 'urls.py'
Describes the URL patterns

## 'runConstants.py'
Declares a few constants that will be used in later parts of the project

## 'errorMapping.py'
This file defines the standardised error response helpers used by the Orchestrator

It encapsulates common error formats and generates structured error responses. It improves maintainability 
and consistency across endpoints

1) invalidRequestError(details) -> is returned when request validation has failed
2) runNotFoundError(details) -> returns when runID doesn't exist in the system
3) sourceNotFoundError(details) -> requested source document couldn't be found

## 'runSchemas.py'
Creates a serializer for each run

## 'runViews.py'
Defines the user-facing API endpoints for managing and retrieving legal analysis runs in the orchestration
layer.

It uses Django Rest Framework to expose stubbed Endpoints.

## 'mmr.py'
Implements Maximum Marginal Relevance (MMR) re-ranking for document retrieval.

When searching for relevant legislation, multiple chunks from the same bill often dominate the results. 
MMR re-ranks the initial 50 chunks retrieved from Elasticsearch by balancing relevance to the query 
with diversity across different bills. Chunks from the same bill receive an extra similarity penalty 
to prevent them from dominating results. Returns the top 5 most relevant and diverse chunks.

Key function:
1) mmr_rerank(chunks, query_embedding, top_k, lambda_param, same_doc_penalty) -> re-ranked list of chunks

## 'semantic_retrieval.py'
Handles semantic search against the Elasticsearch index. Embeds user queries using sentence-transformers 
(all-MiniLM-L6-v2), performs kNN vector search, and formats results. Integrates MMR re-ranking to ensure 
diverse document retrieval.

Key methods:
1) embed_query(user_question) -> converts query to embedding vector
2) vector_search(query_vector, fetch_k, state) -> kNN search against Elasticsearch
3) search(query, top_k, state) -> end-to-end search with MMR re-ranking
4) get_index_stats() -> returns metadata about indexed documents

## Ingestion Stats Endpoint

### GET /api/stats
Returns metadata about what's currently indexed in Elasticsearch. Useful for understanding what 
context the LLM has access to and debugging weak answers.

Response fields:
- `total_chunks` — Total number of text chunks in the index
- `unique_bills` — Number of distinct bills indexed
- `bill_types` — Breakdown of chunks by bill type (HR, S, HJRES, etc.)
- `policy_areas` — Breakdown of chunks by policy area (Health, Taxation, etc.)
- `sessions` — Breakdown of chunks by congress session

Example response:
```json
{
    "total_chunks": 342,
    "unique_bills": 47,
    "bill_types": [
        {"type": "HR", "count": 210},
        {"type": "S", "count": 95},
        {"type": "HJRES", "count": 37}
    ],
    "policy_areas": [
        {"area": "Health", "count": 85},
        {"area": "Taxation", "count": 62},
        {"area": "Education", "count": 45}
    ],
    "sessions": [
        {"session": "118", "count": 342}
    ]
}
```

