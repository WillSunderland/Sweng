import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from app.graph.state import GraphState  # noqa: E402
from app.services.llm_client import LLMResponse  # noqa: E402


@pytest.fixture
def mock_search_results():
    return [
        {
            "bill_id": "NV-HB-123",
            "state": "Nevada",
            "session": "2024",
            "title": "Nevada Tax Reform Act",
            "policy_area": "Taxation",
            "bill_type": "HB",
            "bill_number": "123",
            "latest_action": "Signed by Governor",
            "chunk_id": "chunk_001",
            "chunk_text": "Section 5: All individuals earning above $80,000 shall be subject to...",
            "_score": 0.95,
            "_source": {
                "bill_id": "NV-HB-123",
                "state": "Nevada",
                "session": "2024",
                "title": "Nevada Tax Reform Act",
                "policy_area": "Taxation",
                "bill_type": "HB",
                "bill_number": "123",
                "chunk_text": "Section 5: All individuals earning above $80,000 shall be subject to...",
            },
        },
        {
            "bill_id": "NV-SB-456",
            "state": "Nevada",
            "session": "2024",
            "title": "Nevada Revenue Code Update",
            "policy_area": "Taxation",
            "bill_type": "SB",
            "bill_number": "456",
            "latest_action": "Passed Senate",
            "chunk_id": "chunk_002",
            "chunk_text": "The standard deduction for single filers shall be adjusted to...",
            "_score": 0.87,
            "_source": {
                "bill_id": "NV-SB-456",
                "state": "Nevada",
                "session": "2024",
                "title": "Nevada Revenue Code Update",
                "policy_area": "Taxation",
                "bill_type": "SB",
                "bill_number": "456",
                "chunk_text": "The standard deduction for single filers shall be adjusted to...",
            },
        },
        {
            "bill_id": "NY-AB-789",
            "state": "New York",
            "session": "2024",
            "title": "New York Income Tax Amendment",
            "policy_area": "Taxation",
            "bill_type": "AB",
            "bill_number": "789",
            "latest_action": "In Committee",
            "chunk_id": "chunk_003",
            "chunk_text": "Residents of New York State with annual income exceeding $100,000...",
            "_score": 0.82,
            "_source": {
                "bill_id": "NY-AB-789",
                "state": "New York",
                "session": "2024",
                "title": "New York Income Tax Amendment",
                "policy_area": "Taxation",
                "bill_type": "AB",
                "bill_number": "789",
                "chunk_text": "Residents of New York State with annual income exceeding $100,000...",
            },
        },
    ]


@pytest.fixture
def mock_nvidia_response():
    return LLMResponse(
        content="Nvidia Answer",
        model="nvidia/llama-3.1-nemotron-70b-instruct",
        provider="nvidia",
        prompt_tokens=10,
        completion_tokens=20,
        total_tokens=30,
    )


@pytest.fixture
def mock_hf_response():
    return LLMResponse(
        content="HF Answer",
        model="mistralai/Mistral-7B-Instruct-v0.3",
        provider="huggingface",
        prompt_tokens=15,
        completion_tokens=25,
        total_tokens=40,
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
        "route_decision": None,
    }
