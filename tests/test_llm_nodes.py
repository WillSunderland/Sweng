import pytest
from unittest.mock import AsyncMock, patch
from app.graph.nodes_llm import nvidiaLlmNode, hfLlmNode
from app.graph.output_formatter import llmOutputNode


@pytest.mark.asyncio
async def test_nvidia_node_success(sample_state, mock_nvidia_response):
    with patch(
        "app.graph.nodes_llm.nvidia_client.generate", new_callable=AsyncMock
    ) as mock_gen:
        mock_gen.return_value = mock_nvidia_response

        result = await nvidiaLlmNode(sample_state)

        assert result["llm_response"] == "Nvidia Answer"
        assert result["provider_used"] == "nvidia"


@pytest.mark.asyncio
async def test_nvidia_node_fallback(sample_state, mock_hf_response):
    with patch(
        "app.graph.nodes_llm.nvidia_client.generate", new_callable=AsyncMock
    ) as mock_nv_gen, patch(
        "app.graph.nodes_llm.hf_client.generate", new_callable=AsyncMock
    ) as mock_hf_gen:

        # Nvidia fails
        mock_nv_gen.side_effect = Exception("Nvidia Down")
        # HF succeeds
        mock_hf_gen.return_value = mock_hf_response

        result = await nvidiaLlmNode(sample_state)

        assert result["llm_response"] == "HF Answer"
        assert result["provider_used"] == "huggingface"


@pytest.mark.asyncio
async def test_hf_node_success(sample_state, mock_hf_response):
    with patch(
        "app.graph.nodes_llm.hf_client.generate", new_callable=AsyncMock
    ) as mock_gen:
        mock_gen.return_value = mock_hf_response

        result = await hfLlmNode(sample_state)

        assert result["llm_response"] == "HF Answer"
        assert result["provider_used"] == "huggingface"


@pytest.mark.asyncio
async def test_hf_node_failure(sample_state):
    with patch(
        "app.graph.nodes_llm.hf_client.generate", new_callable=AsyncMock
    ) as mock_gen:
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
    assert response["sources"][0]["title"] == "Nevada Tax Reform Act"
    assert response["carbonCountInTons"] > 0


def test_output_formatter_structures_verbatim_segments_with_document_and_chunk_ids(
    sample_state,
):
    state = sample_state.copy()
    state["llm_response"] = (
        "Nevada requires a new threshold. [Source: Nevada Tax Reform Act] "
        "\u00abVERBATIM\u00bbSection 5: All individuals earning above $80,000 "
        "shall be subject to...\u00ab/VERBATIM\u00bb [Source: Nevada Tax Reform Act] "
        "This is the controlling text."
    )
    state["model_used"] = "gpt-4"
    state["provider_used"] = "test"

    result = llmOutputNode(state)
    response = result["response"]
    structured = response["structured_answer"]

    assert structured is not None
    assert [segment["type"] for segment in structured["segments"]] == [
        "generated",
        "verbatim",
        "generated",
    ]
    assert structured["segments"][0]["citations"][0]["source_id"] == "NV-HB-123"
    assert structured["segments"][0]["citations"][0]["chunk_id"] == "chunk_001"
    assert structured["segments"][1]["citations"][0]["source_id"] == "NV-HB-123"
    assert structured["segments"][1]["citations"][0]["chunk_id"] == "chunk_001"
    assert response["sources"][0]["source_id"] == "NV-HB-123"
    assert response["sources"][0]["chunk_id"] == "chunk_001"
    assert response["sources"][0]["source_file"].startswith("Section 5:")
    assert "\u00abVERBATIM\u00bb" not in response["answer"]


def test_output_formatter_error(sample_state):
    state = sample_state.copy()
    state["error"] = "Major Error"

    result = llmOutputNode(state)
    response = result["response"]

    assert "error" in response["answer"]
    assert response["sources"] == []
    assert response["carbonCountInTons"] > 0
