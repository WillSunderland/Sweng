from langchain_openai import ChatOpenAI
from sympy import Dummy

from llm_config import (
    LLM_PROVIDER,
    LLM_MODEL,
    HF_SERVER_URL,
    NVIDIA_BASE_URL,
    NVIDIA_API_KEY
)

def get_llm():
    if LLM_PROVIDER == "hf":
        return ChatOpenAI(
            base_url=HF_SERVER_URL,
            model=LLM_MODEL,
            api_key="None"
        )
    elif LLM_PROVIDER == "nvidia":
        return ChatOpenAI(
            base_url=NVIDIA_BASE_URL,
            model=LLM_MODEL,
            api_key=NVIDIA_API_KEY
        )
    else:
        raise Exception("Invalid LLM provider")