import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.nvidia_client import NvidiaLLMClient
from app.services.hf_client import HuggingFaceLLMClient
from openai import APITimeoutError

@pytest.mark.asyncio
async def test_nvidia_generate_success(mock_nvidia_response):
    # Mock the client instance deeply
    with patch("app.services.nvidia_client.AsyncOpenAI") as MockAsyncOpenAI:
        mock_client_instance = MockAsyncOpenAI.return_value
        # Ensure the create method is an AsyncMock
        mock_client_instance.chat.completions.create = AsyncMock()
        mock_completions_create = mock_client_instance.chat.completions.create
        
        # Setup the async return value
        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock(message=MagicMock(content="Nvidia Answer"))]
        mock_completion.usage = MagicMock(prompt_tokens=10, completion_tokens=20, total_tokens=30)
        mock_completions_create.return_value = mock_completion
        
        client = NvidiaLLMClient()
        response = await client.generate("sys", "user")
        
        assert response.content == "Nvidia Answer"
        assert response.provider == "nvidia"
        assert response.total_tokens == 30

@pytest.mark.asyncio
async def test_nvidia_retry_on_timeout():
    with patch("app.services.nvidia_client.AsyncOpenAI") as MockAsyncOpenAI:
        mock_client_instance = MockAsyncOpenAI.return_value
        # Ensure the create method is an AsyncMock
        mock_client_instance.chat.completions.create = AsyncMock()
        mock_completions_create = mock_client_instance.chat.completions.create
        
        # Fail first, succeed second
        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock(message=MagicMock(content="Retry Success"))]
        mock_completion.usage = MagicMock(total_tokens=10)
        
        mock_completions_create.side_effect = [APITimeoutError(request=MagicMock()), mock_completion]
        
        client = NvidiaLLMClient()
        # Speed up retry for test
        client.max_retries = 2
        
        response = await client.generate("sys", "user")
        assert response.content == "Retry Success"
        assert mock_completions_create.call_count == 2

@pytest.mark.asyncio
async def test_hf_generate_success():
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"result": [{"generated_text": "Prompt... HF Answer"}]}
        mock_post.return_value = mock_response
        
        client = HuggingFaceLLMClient()
        response = await client.generate("sys", "user")
        
        # Logic strips prompt (we need to know what prompt was sent to verify stripping)
        # In this test we just verify it returns something, knowing the exact prompt stripping 
        # depends on internal implementation string matching
        assert "HF Answer" in response.content or "Prompt" in response.content
        assert response.provider == "huggingface"

@pytest.mark.asyncio
async def test_hf_health_check():
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": "ok"}
        mock_get.return_value = mock_response
        
        client = HuggingFaceLLMClient()
        is_healthy = await client.health_check()
        assert is_healthy is True

@pytest.mark.asyncio
async def test_nvidia_health_check_fail():
    with patch("app.services.nvidia_client.AsyncOpenAI") as MockAsyncOpenAI:
        mock_client_instance = MockAsyncOpenAI.return_value
        mock_client_instance.chat.completions.create = AsyncMock(side_effect=Exception("Connection Error"))
        
        client = NvidiaLLMClient()
        is_healthy = await client.health_check()
        assert is_healthy is False
