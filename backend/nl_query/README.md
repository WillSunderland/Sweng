# Ticket 2.3 - Build "Natural Language" Querying

This folder contains the component that is responsible for accepting plain text legal research questions
from the user and forwarding them to the orchestration for retrieval

It acts as an interface between the user and the Orchestration Layer

## What Ticket 2.3 is for

We need a place in which we can implement the Natural Language Querying Endpoint, which allows users to
ask questions in natural languages(e.g. English) within the backend system

This serves as the primary endpoint for the use questions and is later required in ticket 2.6
in front end for the interface

1) Accepts plaint text user questions
2) Captures Contextual Information and keywords
3) forwards the request to orchestration layer for retrieval and summarisation
4) Returns structured JSON results

## Files in this folder

### 'schemas.py'
This file defines the data models for the Natural Language Querying using the Pydantic Component
It has 3 main functions in it
1) DocumentHits(BaseModel) -> represents a single document returned by the semantic retrieval
    It assigns each document the following
    - document_id
    - bill_id
    - title
    - chunk_id
    - text
    - score
2) NLQueryRequest
   It represents a Request from the user asking a legal research questions
   - query
   - top_k
3) NLQueryResult
   It represents the structured response returned by the NL Query Service
   - query
   - top_k
   - results

### 'service.py'
NLQueryService accepts a natural language query, forwards it to the orchestrator or MCP tool, and returns
a structured JSON result
1) NLQueryService(request: NLQueryRequest) -> NLQueryResult
   - Logs an incoming Query 
   - Calls the orchestrator to retreive the relevant documents
   - Returns an NLQueryResult containing the query and the top_k results
   - Handles exceptions and returns an empty result on failure
This file acts as an interface between user queries and the orchestration layer
