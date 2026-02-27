import os

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "hf")
LLM_MODEL = os.getenv("LLM_MODEL", "openai/gpt-oss-20b")

HF_SERVER_URL = os.getenv("HF_SERVER_URL")
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL")
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")