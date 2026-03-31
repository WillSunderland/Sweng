from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SERVER_PORT = 8000
DEFAULT_OPENSEARCH_PORT = 9200


class Settings(BaseSettings):
    # Fields use snake_case to match env var contract (APP_NAME, OPENSEARCH_HOST, etc.)
    app_name: str = "LangGraph RAG Pipeline"
    app_version: str = "0.1.0"
    debug: bool = False

    opensearch_host: str = "localhost"
    opensearch_port: int = DEFAULT_OPENSEARCH_PORT
    opensearch_index: str = "documents"
    opensearch_use_ssl: bool = False
    opensearch_verify_certs: bool = False

    server_host: str = "0.0.0.0"
    server_port: int = DEFAULT_SERVER_PORT
    cors_allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Nvidia LLM
    nvidia_api_key: str = ""
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    nvidia_model: str = "openai/gpt-oss-120b"
    nvidia_timeout: int = 30
    nvidia_max_retries: int = 3

    # HuggingFace Local Server
    hf_server_url: str = "http://hf-server:8000"
    hf_model: str = "openai/gpt-oss-20b"
    hf_timeout: int = 15

    # Routing
    simple_query_threshold: int = 2
    search_top_k: int = 5
    max_reasoning_steps: int = 2

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug_flag(cls, value):
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"release", "prod", "production", "false", "0", "no", "off"}:
                return False
            if lowered in {"debug", "dev", "development", "true", "1", "yes", "on"}:
                return True
        return value

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )


def getSettings() -> Settings:
    return Settings()
