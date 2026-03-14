# LegisRAG — AI-Native Legislative Research Platform

![LegisRAG Architecture & Workflow](./assets/legisrag_banner.png)
*(Tip: You can replace the above image by placing your own image at `assets/legisrag_banner.png`!)*

**Group 16 | CS3012 Software Engineering | Trinity College Dublin**  
**Partner:** Propylon (RWS) | **Client Contact:** Paul Higgins | **Mentor:** Akshay Sayar

---

## Project Overview

LegisRAG is an AI-native legislative research platform that enables users to query complex legal documents using natural language. Built on a Retrieval-Augmented Generation (RAG) pipeline and the Model Context Protocol (MCP), the system retrieves accurate, cited answers from a semantic vector index of US congressional legislation.

Core design values: **transparency**, **auditability**, and **green computing**.

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Services](#services)
- [Query Flow](#query-flow)
- [API Reference](#api-reference)
- [Testing](#testing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Data Ingestion](#data-ingestion)
- [Project Structure](#project-structure)
- [Team](#team)
- [Sprint Schedule](#sprint-schedule)

---

## Architecture

![LegisRAG Architecture Diagram](./assets/architecture_diagram.png)

The system is divided into four primary layers:

1. **Frontend** — React/TypeScript interface with agent thought visualisation, trust highlighting, and carbon cost display.
2. **Orchestration Layer** — FastAPI + LangGraph state machine managing query rewriting, routing, and response generation.
3. **MCP Server** — Tool host exposing semantic retrieval over OpenSearch via the Model Context Protocol.
4. **Auth Server** — Django REST Framework handling JWT-based login/logout and session management.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Tailwind CSS, Vite |
| Orchestration | Python, FastAPI, LangGraph |
| Authentication | Django REST Framework, SimpleJWT, SQLite |
| Vector Database | AWS Managed OpenSearch (KNN index) |
| Embeddings | `all-MiniLM-L6-v2` (sentence-transformers) |
| Cloud LLM | Nvidia NIM API — `openai/gpt-oss-120b` |
| Local LLM | HuggingFace Pipeline Server — `openai/gpt-oss-20b` |
| MCP | `mcp-python` (FastMCP) |
| Observability | LangSmith (tracing, audit logs) |
| Infrastructure | AWS EC2, S3, Docker, GitLab CI/CD |
| Data Source | Congress.gov API |

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running)
- [Git](https://git-scm.com/downloads)
- Python 3.11+ (optional, for local pre-commit hooks)

### Installation

**1. Clone the repository**

```bash
git clone https://gitlab.scss.tcd.ie/soodkr/sweng26_group16_propylon.git
cd sweng26_group16_propylon
```

**2. Configure environment variables**

```bash
cp .env.example .env
```

Edit `.env` and fill in the required keys (see [Environment Variables](#environment-variables)).

**3. Start all services**

```bash
docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Orchestrator API (Swagger) | http://localhost:8000/docs |
| Django Auth Server | http://localhost:8002 |
| MCP Server | http://localhost:8001 (internal) |
| Elasticsearch (local dev) | http://localhost:9201 |
| HuggingFace Model Server | http://localhost:8002 |

**4. Ingest legislative data (first run)**

```bash
docker compose run ingestion
```

### Code Quality (Pre-commit)

```bash
pip install pre-commit
pre-commit install
```

Every `git commit` will now automatically run Black formatting and YAML checks.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NVIDIA_API_KEY` | ✅ | Nvidia NIM API key for cloud LLM |
| `CONGRESS_GOV_API_KEY` | ✅ | Congress.gov API key for data ingestion |
| `LANGCHAIN_API_KEY` | ✅ | LangSmith tracing key |
| `LANGCHAIN_TRACING_V2` | ✅ | Enable LangSmith (`true`/`false`) |
| `SECRET_KEY` | ✅ | Django secret key |
| `ELASTICSEARCH_URL` | ✅ | OpenSearch/Elasticsearch endpoint |
| `INDEX_NAME` | ✅ | Search index name (default: `legislation_chunks`) |
| `EMBED_MODEL` | ❌ | Embedding model (default: `all-MiniLM-L6-v2`) |
| `STATE_CODE` | ❌ | State filter for ingestion (default: `TX`) |
| `CONGRESS_NUMBER` | ❌ | Congress session to ingest (default: `118`) |
| `SEARCH_LIMIT` | ❌ | Max bills to ingest (default: `10`) |
| `FORCE_HF_ONLY` | ❌ | Bypass Nvidia and always use HF (`false`) |

---

## Services

### Orchestrator (`backend/orchestrator`)

FastAPI application exposing the RAG pipeline via REST. On startup it connects to OpenSearch and compiles the LangGraph state machine.

**Key files:**
- `main.py` — FastAPI app, route handlers, run/source stores
- `graph.py` — LangGraph workflow definition
- `semantic_retrieval.py` — OpenSearch KNN search with MMR re-ranking
- `mmr.py` — Maximum Marginal Relevance diversity re-ranking
- `services/nvidia_client.py` — Async Nvidia NIM client with exponential backoff
- `services/hf_client.py` — Async HuggingFace pipeline server client
- `prompts/rag_prompt.py` — RAG system prompt and context builder
- `cache.py` — In-memory query result cache (TTL-based, LRU eviction)
- `url_utils.py` — Congress.gov URL resolver from bill IDs

### MCP Server (`backend/mcp_server`)

Hosts the `search_elasticsearch` tool via FastMCP. Called by LangGraph's Tool Node during the retrieval step.

```
Tool: search_elasticsearch(query, top_k, state)
Returns: { query, top_k, results: [ { doc_id, score, bill_id, title, ... } ] }
```

### Django Auth Server (`backend/django_server`)

Handles user registration, login/logout, and JWT token management using HTTP-only cookies.

See [Auth API](#auth-api) for endpoints.

### HuggingFace Model Server (`huggingface.py`)

Serves any HuggingFace pipeline model over HTTP. Supports model caching (LRU), GPU auto-detection, and input validation.

```
POST /run   — run inference on any model
GET  /test  — quick test with gpt2
GET  /health — service status + cache info
```

### Frontend (`frontend/`)

React SPA with the following pages:

| Route | Page |
|---|---|
| `/` | Landing page |
| `/login` | Login |
| `/register` | Register |
| `/workspace` | Active research cases |
| `/ai-agent` | AI chat assistant |
| `/analysis/:id` | Legal analysis view |
| `/report/:id` | Report view |
| `/trace/:id` | Execution trace |
| `/history` | Case archive |

---

## Query Flow

### New Session

```
1. User logs in → Django issues JWT (HTTP-only cookie)
2. User submits query → Frontend POST /api/runs
3. Guardrails layer → scope check, profanity filter, injection prevention
4. FastAPI → LangGraph state machine
5. Input Node → clean and normalise query
6. Tool Node → MCP search_elasticsearch → OpenSearch KNN
7. MMR re-ranking → top 5 diverse documents returned
8. Router Node → route by complexity:
     - ≤2 results, no complex keywords → HuggingFace (local)
     - complex query or many results → Nvidia NIM API
     - Nvidia unavailable → HuggingFace fallback
9. LLM Node → RAG prompt + retrieved chunks → generate answer
10. Output Node → format response with citations [Source: State - BillType Number]
11. Audit log → requestID + sources + response + model used (LangSmith)
12. Frontend polls GET /api/runs/:id → displays streamed answer + citations
```

### Follow-up Query (Same Session)

```
1. Query Rewriting Node → incorporates previous chat history
2. Rewritten query → Tool Node → retrieval → LLM → response
```

### LLM Routing Table

| Route | Condition |
|---|---|
| `gpt-oss-20b` (HuggingFace) | Simple query, ≤2 results, no complex language |
| `gpt-oss-120b` (Nvidia NIM) | Complex query, comparative language (`vs`, `compare`, `implications`), many results, or default |
| `gpt-oss-20b` (Fallback) | Nvidia API unavailable or returns error |

---

## API Reference

### Orchestrator API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/runs` | Submit a query and start a run |
| `GET` | `/api/runs` | List all runs |
| `GET` | `/api/runs/{run_id}` | Get run result with answer and sources |
| `GET` | `/api/sources/{source_id}` | Get full source document |
| `GET` | `/api/stats` | OpenSearch index statistics |
| `GET` | `/health` | Health check |

**POST /api/runs**

```json
// Request
{ "query": "What are the tax implications for a salary of 100k in Nevada?" }

// Response
{ "runId": "run_abc123", "status": "running", "createdAt": "2026-03-14T..." }
```

**GET /api/runs/{run_id}**

```json
{
  "runId": "run_abc123",
  "status": "completed",
  "answer": "Based on the Nevada Tax Reform Act...",
  "model_used": "openai/gpt-oss-120b",
  "provider_used": "nvidia",
  "documents": [ { "title": "...", "bill_id": "118-hr-1234", "url": "https://congress.gov/..." } ],
  "reasoningPath": { "trustScore": 85, "carbonTotalG": 0.5 }
}
```

### Auth API

All endpoints prefixed with `/login_logout_server/`.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/register/` | Create a new user account |
| `POST` | `/login/` | Log in, sets `token_access` and `token_refresh` cookies |
| `POST` | `/token/refresh/` | Refresh access token using refresh cookie |
| `POST` | `/logout/` | Clear auth cookies |
| `GET` | `/authenticated/` | Check if current user is authenticated |

---

## Testing

### Backend (Pytest)

```bash
# Run all unit tests
pytest --testmon -m "not integration"

# Run integration tests (requires running services)
pytest --testmon -m integration

# With coverage report
pytest --cov=app --cov-report=term-missing
```

**Test modules:**

| File | What it tests |
|---|---|
| `tests/test_router.py` | LangGraph routing logic (simple/complex/fallback) |
| `tests/test_llm_nodes.py` | Nvidia and HuggingFace node behaviour |
| `tests/test_llm_clients.py` | API client retry logic and health checks |
| `tests/test_llm_graph_only.py` | Full LLM sub-graph end-to-end |
| `tests/test_orchestrator_api.py` | FastAPI run/source endpoints |
| `tests/test_query_cache.py` | Cache TTL and LRU eviction |
| `tests/test_mmr.py` | MMR re-ranking logic |
| `tests/orchestrator/test_url_utils.py` | Congress.gov URL construction |
| `tests/integration/test_orchestrator_service.py` | Live orchestrator integration |

### Frontend (Vitest)

```bash
cd frontend
npm run test        # watch mode
npm run test -- --run  # single run (used in CI)
```

**Test files:**

- `AIagentPage.test.tsx` — chat flow, error handling, accessibility
- `LandingPage.test.tsx` — auth modal, navigation, animations

---

## CI/CD Pipeline

GitLab CI/CD pipeline defined in `.gitlab-ci.yml`. Triggered on all merge requests and pushes to `main` / `dev`.

**Stages:** `lint → test → build → sync`

| Job | Stage | What it does |
|---|---|---|
| `backend-lint` | lint | `black --check backend/` |
| `frontend-lint` | lint | `eslint` on TypeScript source |
| `backend-unit-tests` | test | Pytest with testmon (unit tests only) |
| `backend-integration-tests` | test | Pytest integration tests (main branch only) |
| `frontend-tests` | test | Vitest component tests |
| `backend-build` | build | Verify all Python dependencies install cleanly |
| `frontend-build` | build | Full Vite + TypeScript production build |
| `github-sync` | sync | Mirror `main` to GitHub (main branch only) |

Coverage target: **80% on unit tests**.

---

## Data Ingestion

The ingestion pipeline populates OpenSearch with chunked, embedded US congressional bills via the Congress.gov API.

### Run ingestion

```bash
# Full ingestion (default: TX members, 118th Congress, 10 bills)
docker compose run ingestion

# Ingest a single bill
BILL_ID=118-hr-8775 docker compose run ingestion

# Custom parameters
STATE_CODE=NY SEARCH_LIMIT=50 CONGRESS_NUMBER=118 docker compose run ingestion
```

### Pipeline steps

1. Fetch TX congressional members via Congress.gov API
2. For each member, retrieve sponsored bills
3. Fetch full bill detail + CRS summaries
4. Extract searchable text (title + policy area + summaries + actions)
5. Chunk text (1000 chars, 150 char overlap)
6. Generate embeddings with `all-MiniLM-L6-v2`
7. Bulk index into OpenSearch KNN index

### Document schema (OpenSearch)

| Field | Type | Description |
|---|---|---|
| `doc_id` | keyword | Stable ID: `{bill_id}_{chunk_id}` |
| `bill_id` | keyword | e.g. `118-hr-8775` |
| `state` | keyword | e.g. `TX` |
| `session` | keyword | Congress number, e.g. `118` |
| `title` | text | Bill title |
| `policy_area` | keyword | CRS policy area |
| `bill_type` | keyword | `HR`, `S`, `HJRES`, etc. |
| `bill_number` | keyword | e.g. `8775` |
| `latest_action` | text | Most recent legislative action |
| `chunk_id` | integer | Chunk index within bill |
| `chunk_text` | text | Searchable text chunk |
| `embedding` | knn_vector | Dense vector (384 dims, `all-MiniLM-L6-v2`) |

### Validate retrieval

```bash
docker compose run ingestion python -m backend.ingestion.test_queries
```

---

## Project Structure

```
sweng26_group16_propylon/
│
├── backend/
│   ├── orchestrator/         # FastAPI + LangGraph RAG pipeline
│   │   ├── main.py
│   │   ├── graph.py
│   │   ├── semantic_retrieval.py
│   │   ├── mmr.py
│   │   ├── cache.py
│   │   ├── url_utils.py
│   │   ├── services/
│   │   │   ├── nvidia_client.py
│   │   │   ├── hf_client.py
│   │   │   └── llm_client.py
│   │   └── prompts/
│   │       └── rag_prompt.py
│   │
│   ├── mcp_server/           # FastMCP tool host
│   │   ├── main.py
│   │   └── semantic_retrieval.py
│   │
│   ├── django_server/        # JWT auth server
│   │   ├── login_logout_server/
│   │   └── config/
│   │
│   ├── ingestion/            # Congress.gov → OpenSearch pipeline
│   │   ├── ingest.py
│   │   ├── congress_client.py
│   │   ├── chunking.py
│   │   ├── embeddings.py
│   │   └── search_store.py
│   │
│   └── nl_query/             # Natural language query schemas
│
├── frontend/                 # React/TypeScript SPA
│   └── src/
│       ├── pages/
│       │   ├── AIagentPage/
│       │   ├── Workspacepage/
│       │   ├── LandingPage/
│       │   ├── AnalysisPage/
│       │   ├── ReportViewPage/
│       │   ├── ExecutionTracePage/
│       │   └── HistoryPage/
│       └── components/
│
├── tests/                    # Backend unit + integration tests
│   ├── conftest.py
│   ├── test_router.py
│   ├── test_llm_nodes.py
│   ├── test_llm_clients.py
│   ├── test_orchestrator_api.py
│   ├── test_query_cache.py
│   ├── test_mmr.py
│   ├── orchestrator/
│   └── integration/
│
├── app/                      # Alternate orchestrator (graph-only variant)
├── huggingface.py            # HuggingFace pipeline server
├── docker-compose.yml
├── .gitlab-ci.yml
├── .pre-commit-config.yaml
└── pytest.ini
```

---

## Team

| Name | Role |
|---|---|
| Krish Sood | Project Lead & AI Architect |
| William Sunderland | Backend Architect & MCP Server Lead |
| Nandana Arun | Frontend Architect |
| Keith Lyons | UI/UX Designer |
| Pavit | AI / HuggingFace |
| Aziz | Backend / AI |
| Finn | Frontend |
| Prad | Social Media / Backend |

**Scrum Masters:** Will (Sprint 1), Nandana (Sprint 2), Keith (Sprint 3)

---

## Sprint Schedule

| Phase | Weeks | Focus |
|---|---|---|
| Phase 1 — Setup | 1–2 | Infrastructure, Docker, scaffolding, data ingestion |
| Phase 2 — Sprint 1 | 3–6 | MCP server, semantic retrieval, basic chat UI |
| Phase 3 — Sprint 2 | 7–8 | Agentic reasoning, LangSmith tracing, thought visualisation |
| Phase 4 — Sprint 3 | 9–10 | Source attribution, auth, trust highlighting, doc preview |
| Phase 5 — Sprint 4 | 11–13 | Carbon metrics, PDF export, AWS deployment, load testing |

---

## Functional Requirements Summary

| ID | Requirement |
|---|---|
| FR-01 | Natural language querying |
| FR-02 | Semantic vector search (OpenSearch KNN) |
| FR-03 | Source attribution with citations |
| FR-04 | Agentic multi-step reasoning (Plan → Search → Read → Answer) |
| FR-05 | Dynamic tool use via MCP |
| FR-06 | Agent thought visualisation in UI |
| FR-07 | Trust highlighting (AI summary vs verbatim law text) |
| FR-08 | Document preview panel on citation click |
| FR-09 | Carbon cost indicator per query |
| FR-10 | Downloadable PDF report export |

## Non-Functional Requirements Summary

| ID | Requirement |
|---|---|
| NFR-01 | Minimal hallucinations — ground answers strictly in retrieved context; say "I don't know" when unable |
| NFR-02 | Carbon footprint tracked and displayed per query |
| NFR-03 | Simple queries first token < 3s; complex agentic workflows < 15s |
| NFR-04 | Docker containerisation for minimal idle overhead |
| NFR-05 | Graceful MCP failure handling (no crash on OpenSearch disconnect) |
| NFR-06 | Full audit log per query (requestID + sources + response + model used) |

---

## License

This project is developed as part of CS3012 at Trinity College Dublin in collaboration with Propylon (RWS). All rights reserved.
