from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class LLMResponse:
    """Standardised response from any LLM provider."""

    content: str
    model: str
    provider: str  # "nvidia" or "huggingface"
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class BaseLLMClient(ABC):
    @abstractmethod
    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        pass
