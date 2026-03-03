import logging
from openai import AsyncOpenAI, APITimeoutError, APIConnectionError, RateLimitError
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from app.config import getSettings
from app.services.llm_client import BaseLLMClient, LLMResponse

logger = logging.getLogger(__name__)


class NvidiaLLMClient(BaseLLMClient):
    def __init__(self):
        settings = getSettings()
        self.api_key = settings.nvidia_api_key
        self.base_url = settings.nvidia_base_url
        self.model = settings.nvidia_model
        self.timeout = settings.nvidia_timeout
        self.max_retries = settings.nvidia_max_retries

        self.client = AsyncOpenAI(
            api_key=self.api_key, base_url=self.base_url, timeout=self.timeout
        )

    @property
    def _retry_decorator(self):
        return retry(
            reraise=True,
            stop=stop_after_attempt(self.max_retries),
            wait=wait_exponential(multiplier=1, min=1, max=10),
            retry=retry_if_exception_type(
                (APITimeoutError, APIConnectionError, RateLimitError)
            ),
        )

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        @self._retry_decorator
        async def _call_api():
            return await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=temperature,
                max_tokens=max_tokens,
            )

        try:
            response = await _call_api()

            content = response.choices[0].message.content or ""
            usage = response.usage

            return LLMResponse(
                content=content,
                model=self.model,
                provider="nvidia",
                prompt_tokens=usage.prompt_tokens if usage else 0,
                completion_tokens=usage.completion_tokens if usage else 0,
                total_tokens=usage.total_tokens if usage else 0,
            )
        except Exception as e:
            logger.error(f"Nvidia API call failed: {e}")
            raise

    async def health_check(self) -> bool:
        try:
            # We don't use the retry decorator for health check to fail fast
            await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=1,
            )
            return True
        except Exception:
            return False
