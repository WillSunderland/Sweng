import pytest
from unittest.mock import patch, MagicMock
from app.graph.nodes_llm import routerNode
from app.config import getSettings

settings = getSettings()


def test_router_simple_query(sample_state):
    # 1 result, simple query -> should use HF (if threshold is >= 1)
    # Default threshold is 2
    state = sample_state.copy()
    state["searchResults"] = [sample_state["searchResults"][0]]  # 1 result
    state["processedQuery"] = "what is the safe harbor provision"

    result = routerNode(state)
    assert result["route_decision"] == "huggingface"


def test_router_complex_query(sample_state):
    # Contains "compare", even with few results -> Nvidia
    state = sample_state.copy()
    state["searchResults"] = [sample_state["searchResults"][0]]
    state["processedQuery"] = "compare section 512 to gdpr"

    result = routerNode(state)
    assert result["route_decision"] == "nvidia"


def test_router_many_results(sample_state):
    # 3 results > threshold (2) -> Nvidia
    state = sample_state.copy()
    # sample_state has 3 results by default
    state["processedQuery"] = "simple query"

    result = routerNode(state)
    assert result["route_decision"] == "nvidia"


def test_router_error_state(sample_state):
    state = sample_state.copy()
    state["error"] = "Something went wrong upstream"

    result = routerNode(state)
    assert result["route_decision"] == "nvidia"


def test_router_zero_results(sample_state):
    # 0 results -> Nvidia (default fallback logic, though searchNode might handle 0 differently)
    state = sample_state.copy()
    state["searchResults"] = []

    result = routerNode(state)
    assert result["route_decision"] == "nvidia"
