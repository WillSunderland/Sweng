from __future__ import annotations
from typing import Final

TONS_TO_GRAMS: Final[float] = 1_000_000.0

MODEL_CARBON_TONS: Final[dict[str, float]] = {
    "openai/gpt-oss-120b": 0.0000006,
    "openai/gpt-oss-20b": 0.0000002,
    "nvidia/llama-3.1-nemotron-70b-instruct": 0.0000005,
    "mistralai/Mistral-7B-Instruct-v0.3": 0.0000001,
}

PROVIDER_CARBON_TONS: Final[dict[str, float]] = {
    "nvidia": 0.0000006,
    "huggingface": 0.0000002,
}

DEFAULT_CARBON_TONS: Final[float] = 0.0000003


def estimate_carbon_tons(model_name: str | None, provider_name: str | None) -> float:
    if model_name and model_name in MODEL_CARBON_TONS:
        return MODEL_CARBON_TONS[model_name]
    if provider_name and provider_name in PROVIDER_CARBON_TONS:
        return PROVIDER_CARBON_TONS[provider_name]
    return DEFAULT_CARBON_TONS


def tons_to_grams(tons: float) -> float:
    return tons * TONS_TO_GRAMS
