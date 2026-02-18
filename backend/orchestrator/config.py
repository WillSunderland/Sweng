from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Elasticsearch
    elasticsearch_url: str = "http://elasticsearch:9200"
    index_name: str = "legislation_chunks"
    embed_model: str = "all-MiniLM-L6-v2"
    search_k: int = 5
    state_code: str = "TX"

    # Nvidia LLM
    nvidia_api_key: str = ""
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    nvidia_model: str = "openai/gpt-oss-120b"
    nvidia_timeout: int = 30
    nvidia_max_retries: int = 3

    # HuggingFace Local Server
    hf_server_url: str = "http://hf-server:8000"
    hf_model: str = "gpt2"
    hf_timeout: int = 60

    # Routing
    simple_query_threshold: int = 2
    force_hf_only: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


def getSettings() -> Settings:
    return Settings()
