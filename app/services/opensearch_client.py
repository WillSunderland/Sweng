from __future__ import annotations

from opensearchpy import OpenSearch


def createOpensearchClient(settings) -> OpenSearch:
    return OpenSearch(
        hosts=[
            {
                "host": settings.opensearch_host,
                "port": settings.opensearch_port,
            }
        ],
        use_ssl=settings.opensearch_use_ssl,
        verify_certs=settings.opensearch_verify_certs,
    )
