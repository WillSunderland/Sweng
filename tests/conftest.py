import pytest
from unittest.mock import AsyncMock, MagicMock
from app.graph.state import GraphState
from app.services.llm_client import LLMResponse

@pytest.fixture
def mock_search_results():
    return [
        {
            "_id": "1",
            "_score": 0.9,
            "_source": {
                "title": "Doc 1",
                "content": "Content 1",
                "source_file": "doc1.pdf"
            }
        },
        {
            "_id": "2",
            "_score": 0.8,
            "_source": {
                "title": "Doc 2",
                "content": "Content 2",
                "source_file": "doc2.pdf"
            }
        },
        {
            "_id": "3",
            "_score": 0.7,
            "_source": {
                "title": "Doc 3",
                "content": "Content 3",
                "source_file": "doc3.pdf"
            }
        }
    ]

@pytest.fixture
def mock_nvidia_response():
    return LLMResponse(
        content="Nvidia Answer",
        model="nvidia/llama-3.1-nemotron-70b-instruct",
        provider="nvidia",
        prompt_tokens=10,
        completion_tokens=20,
        total_tokens=30
    )

@pytest.fixture
def mock_hf_response():
    return LLMResponse(
        content="HF Answer",
        model="mistralai/Mistral-7B-Instruct-v0.3",
        provider="huggingface",
        prompt_tokens=15,
        completion_tokens=25,
        total_tokens=40
    )

@pytest.fixture
def sample_state(mock_search_results):
    return {
        "query": "test query",
        "processedQuery": "test query",
        "searchResults": mock_search_results,
        "response": {},
        "error": None,
        "llm_response": None,
        "model_used": None,
        "provider_used": None,
        "token_count": 0,
        "route_decision": None
    }
