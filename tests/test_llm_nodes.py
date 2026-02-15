import pytest
from unittest.mock import AsyncMock, patch
from app.graph.nodes_llm import nvidiaLlmNode, hfLlmNode
from app.graph.output_formatter import llmOutputNode

@pytest.mark.asyncio
async def test_nvidia_node_success(sample_state, mock_nvidia_response):
    with patch("app.graph.nodes_llm.nvidia_client.generate", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = mock_nvidia_response
        
        result = await nvidiaLlmNode(sample_state)
        
        assert result["llm_response"] == "Nvidia Answer"
        assert result["provider_used"] == "nvidia"

@pytest.mark.asyncio
async def test_nvidia_node_fallback(sample_state, mock_hf_response):
    with patch("app.graph.nodes_llm.nvidia_client.generate", new_callable=AsyncMock) as mock_nv_gen, \
         patch("app.graph.nodes_llm.hf_client.generate", new_callable=AsyncMock) as mock_hf_gen:
        
        # Nvidia fails
        mock_nv_gen.side_effect = Exception("Nvidia Down")
        # HF succeeds
        mock_hf_gen.return_value = mock_hf_response
        
        result = await nvidiaLlmNode(sample_state)
        
        assert result["llm_response"] == "HF Answer"
        assert result["provider_used"] == "huggingface"

@pytest.mark.asyncio
async def test_hf_node_success(sample_state, mock_hf_response):
    with patch("app.graph.nodes_llm.hf_client.generate", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = mock_hf_response
        
        result = await hfLlmNode(sample_state)
        
        assert result["llm_response"] == "HF Answer"
        assert result["provider_used"] == "huggingface"

@pytest.mark.asyncio
async def test_hf_node_failure(sample_state):
    with patch("app.graph.nodes_llm.hf_client.generate", new_callable=AsyncMock) as mock_gen:
        mock_gen.side_effect = Exception("HF Down")
        
        result = await hfLlmNode(sample_state)
        
        assert "error" in result
        assert "LLM generation failed" in result["error"]

def test_output_formatter_success(sample_state):
    state = sample_state.copy()
    state["llm_response"] = "Final Answer"
    state["model_used"] = "gpt-4"
    state["provider_used"] = "test"
    
    result = llmOutputNode(state)
    response = result["response"]
    
    assert response["answer"] == "Final Answer"
    assert len(response["sources"]) == 3
    assert response["sources"][0]["title"] == "Doc 1"

def test_output_formatter_error(sample_state):
    state = sample_state.copy()
    state["error"] = "Major Error"
    
    result = llmOutputNode(state)
    response = result["response"]
    
    assert "error" in response["answer"]
    assert response["sources"] == []
