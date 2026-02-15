import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from langgraph.graph import StateGraph, START, END
from app.graph.state import GraphState
from app.graph.nodes_llm import routerNode, nvidiaLlmNode, hfLlmNode
from app.graph.output_formatter import llmOutputNode

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

# Mini-graph builder for testing
def build_test_graph():
    graph = StateGraph(GraphState)
    
    graph.add_node("routerNode", routerNode)
    graph.add_node("nvidiaLlmNode", nvidiaLlmNode)
    graph.add_node("hfLlmNode", hfLlmNode)
    graph.add_node("llmOutputNode", llmOutputNode)
    
    graph.add_edge(START, "routerNode")
    
    graph.add_conditional_edges(
        "routerNode",
        lambda state: state.get("route_decision", "nvidia"),
        {
            "nvidia": "nvidiaLlmNode",
            "huggingface": "hfLlmNode",
        },
    )
    
    graph.add_edge("nvidiaLlmNode", "llmOutputNode")
    graph.add_edge("hfLlmNode", "llmOutputNode")
    graph.add_edge("llmOutputNode", END)
    
    return graph.compile()

@pytest.mark.asyncio
async def test_llm_graph_simple_query(mock_search_results):
    app = build_test_graph()
    
    # 1 result, simple query -> HF
    state = {
        "query": "simple question",
        "processedQuery": "simple question",
        "searchResults": [mock_search_results[0]],
        "response": {},
        "error": None,
        "llm_response": None,
        "model_used": None,
        "provider_used": None,
        "token_count": 0,
        "route_decision": None
    }
    
    mock_response = MagicMock(content="HF Answer", model="hf-model", provider="huggingface", total_tokens=10)
    
    with patch("app.graph.nodes_llm.hf_client.generate", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = mock_response
        
        result = await app.ainvoke(state)
        
        assert result["route_decision"] == "huggingface"
        assert result["response"]["answer"] == "HF Answer"
        assert result["response"]["provider"] == "huggingface"

@pytest.mark.asyncio
async def test_llm_graph_complex_query(mock_search_results):
    app = build_test_graph()
    
    # Complex keyword -> Nvidia
    state = {
        "query": "compare A vs B",
        "processedQuery": "compare A vs B",
        "searchResults": mock_search_results,
        "response": {},
        "error": None,
        "llm_response": None,
        "model_used": None,
        "provider_used": None,
        "token_count": 0,
        "route_decision": None
    }
    
    mock_response = MagicMock(content="Nvidia Answer", model="nv-model", provider="nvidia", total_tokens=50)
    
    with patch("app.graph.nodes_llm.nvidia_client.generate", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = mock_response
        
        result = await app.ainvoke(state)
        
        assert result["route_decision"] == "nvidia"
        assert result["response"]["answer"] == "Nvidia Answer"
        assert result["response"]["provider"] == "nvidia"

@pytest.mark.asyncio
async def test_llm_graph_fallback(mock_search_results):
    app = build_test_graph()
    
    # Complex query -> Nvidia -> Fails -> HF
    state = {
        "query": "compare A vs B",
        "processedQuery": "compare A vs B",
        "searchResults": mock_search_results,
        "response": {},
        "error": None,
        "llm_response": None,
        "model_used": None,
        "provider_used": None,
        "token_count": 0,
        "route_decision": None
    }
    
    mock_hf_response = MagicMock(content="HF Fallback Answer", model="hf-model", provider="huggingface", total_tokens=15)
    
    with patch("app.graph.nodes_llm.nvidia_client.generate", new_callable=AsyncMock) as mock_nv, \
         patch("app.graph.nodes_llm.hf_client.generate", new_callable=AsyncMock) as mock_hf:
        
        mock_nv.side_effect = Exception("Nvidia Error")
        mock_hf.return_value = mock_hf_response
        
        result = await app.ainvoke(state)
        
        # Router simulated Nvidia
        assert result["route_decision"] == "nvidia"
        # But provider used was HF due to fallback
        assert result["response"]["answer"] == "HF Fallback Answer"
        assert result["response"]["provider"] == "huggingface"
