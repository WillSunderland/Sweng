# AI-Native Legislative Research Workflow (Group 16)
**Partner:** Propylon | **Course:** SWENG 2026

## 🚀 Project Overview
An AI-native legislative research tool using **RAG (Retrieval-Augmented Generation)** and **MCP (Model Context Protocol)**. It allows users to query complex legal documents and get cited, trustworthy answers.

## ⚡ Getting Started

### Prerequisites
Ensure you have the following installed on your machine:
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Running)
*   [Git](https://git-scm.com/downloads)
*   **Optional:** Python 3.11+ (for local pre-commit checks)

### Installation
1.  **Clone the repository**:
    ```bash
    git clone https://gitlab.scss.tcd.ie/soodkr/sweng26_group16_propylon.git
    cd sweng26_group16_propylon
    ```

2.  **Environment Setup**:
    Copy the example environment file and configure your keys.
    ```bash
    cp .env.example .env
    ```
    > **Note:** You must fill in `NVIDIA_API_KEY` and LangSmith keys (`LANGCHAIN_API_KEY`, etc.) in the `.env` file for the app to function correctly.

3.  **Run with Docker**:
    Start the entire stack (Frontend, Backend, Database) with one command:
    ```bash
    docker-compose up --build
    ```
    *   **Frontend**: [http://localhost:3000](http://localhost:3000)
    *   **Orchestrator API**: [http://localhost:8000/docs](http://localhost:8000/docs)
    *   **MCP Server**: Intended for internal container communication on port 8001.
    *   **ElasticSearch**: [http://localhost:9200](http://localhost:9200)

## 🛠️ Development Workflow

### Code Quality (Pre-commit)
We enforce coding standards using `pre-commit`.
1.  **Install hooks** (Run once):
    ```bash
    pip install pre-commit
    pre-commit install
    ```
    Now, every `git commit` will automatically format your code (Black) and check for errors.

### Environment Variables
| Variable | Description |
| :--- | :--- |
| `NVIDIA_API_KEY` | Required for accessing the LLM (gpt-102b). |
| `LANGCHAIN_TRACING_V2` | Enable LangSmith tracing for debugging. |
| `ELASTICSEARCH_URL` | URL for the ElasticSearch instance (default: internal Docker DNS). |

## 🛠️ Tech Stack
- **Frontend:** React, TypeScript, Tailwind (Agentic UI)
- **Orchestrator:** Python, LangGraph, Nvidia NIM (gpt-120b)
- **Tooling:** MCP Server, ElasticSearch (Semantic Search)
- **Infrastructure:** Docker, AWS

## 📂 Repository Structure
- `/backend/mcp_server`: The tool host (William)
- `/backend/orchestrator`: The RAG logic & API (Krish/Backenders)
- `/frontend`: The React application (Nandana/Keith)
- `/docs`: Requirements & Design PDFs

## 📅 Sprint Schedule
- **Sprint 1 (Weeks 3-6):** MVP with Containerized MCP Server & Basic Search.
- **Sprint 2 (Weeks 7-10):** RAG Pipeline & LangGraph Integration.
- **Sprint 3 (Weeks 11-13):** Final UI & "Green" Computing Indicators.
