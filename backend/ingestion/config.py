# backend/ingestion/config.py
import os


def get_settings():
    """
    Read ingestion settings from environment variables.

    This pipeline is intended to run in Docker, so the Elasticsearch/OpenSearch
    URL is usually the docker service name (e.g. http://elasticsearch:9200).

    Required:
      - CONGRESS_GOV_API_KEY

    Backend selection:
      - SEARCH_BACKEND=elasticsearch (default) OR opensearch

    URLs:
      - If SEARCH_BACKEND=elasticsearch -> ELASTICSEARCH_URL must be set
      - If SEARCH_BACKEND=opensearch    -> OPENSEARCH_URL must be set
        (we also allow ELASTICSEARCH_URL as a fallback if desired)

    Optional:
      - INDEX_NAME   (default: legislation_chunks)
      - EMBED_MODEL  (default: all-MiniLM-L6-v2)

      Ingestion controls:
      - BILL_ID      (if set, ingest exactly this bill only)
      - STATE_CODE       (default: "TX")
      - CONGRESS_NUMBER  (default: "118")
      - SEARCH_LIMIT     (default: 10)     max bills to ingest
    """
    settings = {}

    # --- Required: Congress.gov API key ---
    settings["CONGRESS_GOV_API_KEY"] = os.getenv("CONGRESS_GOV_API_KEY", "").strip()
    if not settings["CONGRESS_GOV_API_KEY"]:
        raise ValueError("CONGRESS_GOV_API_KEY environment variable is required.")

    # --- Backend selection ---
    settings["SEARCH_BACKEND"] = (
        os.getenv("SEARCH_BACKEND", "elasticsearch").strip().lower()
    )
    if settings["SEARCH_BACKEND"] not in ("elasticsearch", "opensearch"):
        raise ValueError("SEARCH_BACKEND must be 'elasticsearch' or 'opensearch'.")

    # --- Index & embedding model ---
    settings["INDEX_NAME"] = os.getenv("INDEX_NAME", "legislation_chunks").strip()
    settings["EMBED_MODEL"] = os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2").strip()

    # --- Backend URL selection ---
    es_url = os.getenv("ELASTICSEARCH_URL", "").strip()
    os_url = os.getenv("OPENSEARCH_URL", "").strip()

    if settings["SEARCH_BACKEND"] == "elasticsearch":
        if not es_url:
            raise ValueError(
                "ELASTICSEARCH_URL is required when SEARCH_BACKEND=elasticsearch."
            )
        settings["SEARCH_URL"] = es_url
    else:
        # Prefer OPENSEARCH_URL, but allow ELASTICSEARCH_URL as fallback.
        if not os_url and not es_url:
            raise ValueError(
                "OPENSEARCH_URL (or ELASTICSEARCH_URL fallback) is required when SEARCH_BACKEND=opensearch."
            )
        settings["SEARCH_URL"] = os_url if os_url else es_url

    # --- ingestion controls ---
    settings["BILL_ID"] = os.getenv(
        "BILL_ID", ""
    ).strip()  # ingest this bill only if set
    settings["STATE_CODE"] = os.getenv("STATE_CODE", "TX").strip().upper()
    settings["CONGRESS_NUMBER"] = os.getenv("CONGRESS_NUMBER", "118").strip()

    # Safe parsing for SEARCH_LIMIT
    limit_raw = os.getenv("SEARCH_LIMIT", "10").strip()
    try:
        settings["SEARCH_LIMIT"] = int(limit_raw)
    except ValueError as e:
        raise ValueError("SEARCH_LIMIT must be an integer.") from e

    # Simple guardrails
    if settings["SEARCH_LIMIT"] < 1:
        settings["SEARCH_LIMIT"] = 1

    return settings
