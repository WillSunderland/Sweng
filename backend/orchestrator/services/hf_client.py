import logging
import httpx

from orchestrator.config import getSettings
from orchestrator.services.llm_client import BaseLLMClient, LLMResponse

logger = logging.getLogger(__name__)


class HuggingFaceLLMClient(BaseLLMClient):
    def __init__(self):
        settings = getSettings()
        self.server_url = settings.hf_server_url.rstrip("/")
        self.model = settings.hf_model
        self.timeout = settings.hf_timeout
        self.client = httpx.AsyncClient(timeout=self.timeout)

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        """
        Calls the local HuggingFace server.
        Uses gpt-oss specific "harmony" format:
        <|system|>{system}<|end|><|user|>{user}<|end|><|assistant|>
        """
        full_prompt = (
            f"<|system|>{system_prompt}<|end|>"
            f"<|user|>{user_prompt}<|end|>"
            f"<|assistant|>"
        )

        # Fail fast if HF server isn't healthy
        if not await self.health_check():
            raise RuntimeError("HuggingFace server is not healthy or not ready.")

        payload = {
            "repoId": self.model,
            "capability": "text-generation",
            "inputs": full_prompt,
            "params": {
                "max_new_tokens": max_tokens,
                "temperature": temperature,
                "do_sample": False,
                "top_p": 0.9,
                "repetition_penalty": 1.15,
                "no_repeat_ngram_size": 3,
                "return_full_text": False,
            },
        }

        try:
            response = await self.client.post(f"{self.server_url}/run", json=payload)
            response.raise_for_status()

            result = response.json()
            data = result.get("result", [])
            generated_text = ""
            if isinstance(data, list) and len(data) > 0:
                generated_text = data[0].get("generated_text", "")
            elif isinstance(data, str):
                generated_text = data

            if generated_text.startswith(full_prompt):
                generated_text = generated_text[len(full_prompt) :].strip()

            generated_text = (
                generated_text.replace("<|end|>", "")
                .replace("<|assistant|>", "")
                .replace("<|system|>", "")
                .replace("<|user|>", "")
            ).strip()

            if "Answer:" in generated_text:
                generated_text = generated_text.split("Answer:", 1)[1].strip()
            if "Question:" in generated_text:
                generated_text = generated_text.split("Question:", 1)[0].strip()

            prompt_words = len(full_prompt.split())
            completion_words = len(generated_text.split())

            return LLMResponse(
                content=generated_text,
                model=self.model,
                provider="huggingface",
                prompt_tokens=int(prompt_words * 1.3),
                completion_tokens=int(completion_words * 1.3),
                total_tokens=int((prompt_words + completion_words) * 1.3),
            )

        except Exception as e:
            logger.error("HuggingFace server call failed: %s", repr(e))
            raise

    async def health_check(self) -> bool:
        try:
            response = await self.client.get(f"{self.server_url}/health")
            if response.status_code == 200:
                data = response.json()
                return data.get("status") == "ok"
            return False
        except Exception:
            return False
