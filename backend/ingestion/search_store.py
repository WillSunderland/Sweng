# backend/ingestion/search_store.py
from urllib.parse import urlparse


class SearchStore:
    """
    SearchStore supports BOTH:
      - Elasticsearch (local dev with docker elastic)
      - OpenSearch (AWS managed OpenSearch or local container)

    This class handles:
      1) connect()
      2) create_index_if_missing(vector_dim)
      3) index_documents_bulk(docs)
      4) keyword_search(query, k)
      5) vector_search(query_vector, k)

    IMPORTANT:
      OpenSearch and Elasticsearch have different vector mappings and vector queries.
      This class hides that difference so your ingest/test code stays simple.
    """

    def __init__(self, url, index_name, backend):
        self.url = url
        self.index_name = index_name
        self.backend = backend  # "elasticsearch" or "opensearch"
        self.client = None

    def connect(self):
        """
        Connect to the selected backend.
        """
        if self.backend == "opensearch":
            from opensearchpy import OpenSearch

            # Parse URL into host/port/ssl options (more reliable than OpenSearch(self.url))
            u = urlparse(self.url)
            host = u.hostname or "localhost"
            port = u.port or (443 if u.scheme == "https" else 9200)
            use_ssl = u.scheme == "https"

            self.client = OpenSearch(
                hosts=[{"host": host, "port": port}],
                use_ssl=use_ssl,
                verify_certs=False,
                ssl_show_warn=False,
            )
        else:
            from elasticsearch import Elasticsearch

            # Elasticsearch client accepts URL directly
            self.client = Elasticsearch(self.url)

    def create_index_if_missing(self, vector_dim):
        """
        Create an index (like a table) if it doesn't exist.

        We store documents like:
          doc_id, bill_id, title, chunk_id, chunk_text, embedding

        Vector mapping:
          - OpenSearch: knn_vector + index.knn enabled
          - Elasticsearch: dense_vector with indexing enabled
        """
        if self.client.indices.exists(index=self.index_name):
            return

        if self.backend == "opensearch":
            body = {
                "settings": {"index": {"knn": True}},
                "mappings": {
                    "properties": {
                        "doc_id": {"type": "keyword"},
                        "bill_id": {"type": "keyword"},
                        "state": {"type": "keyword"},
                        "session": {"type": "keyword"},
                        "title": {"type": "text"},
                        "policy_area": {"type": "keyword"},
                        "bill_type": {"type": "keyword"},
                        "bill_number": {"type": "keyword"},
                        "latest_action": {"type": "text"},
                        "chunk_id": {"type": "integer"},
                        "chunk_text": {"type": "text"},
                        "embedding": {"type": "knn_vector", "dimension": vector_dim},
                    }
                },
            }
        else:
            # Elasticsearch mapping for vector search
            body = {
                "mappings": {
                    "properties": {
                        "doc_id": {"type": "keyword"},
                        "bill_id": {"type": "keyword"},
                        "state": {"type": "keyword"},
                        "session": {"type": "keyword"},
                        "title": {"type": "text"},
                        "policy_area": {"type": "keyword"},
                        "bill_type": {"type": "keyword"},
                        "bill_number": {"type": "keyword"},
                        "latest_action": {"type": "text"},
                        "chunk_id": {"type": "integer"},
                        "chunk_text": {"type": "text"},
                        "embedding": {
                            "type": "dense_vector",
                            "dims": vector_dim,
                            "index": True,
                            "similarity": "cosine",
                        },
                    }
                }
            }

        self.client.indices.create(index=self.index_name, body=body)

    def index_documents_bulk(self, docs):
        """
        Bulk insert docs.

        Each doc must have:
          doc["doc_id"] = unique stable ID (ex: f"{bill_id}_{chunk_id}")

        So re-running ingestion overwrites documents, not duplicates.
        """
        if not docs:
            return

        if self.backend == "opensearch":
            from opensearchpy import helpers
        else:
            from elasticsearch import helpers

        actions = []
        for d in docs:
            actions.append(
                {
                    "_op_type": "index",
                    "_index": self.index_name,
                    "_id": d["doc_id"],
                    "_source": d,
                }
            )

        helpers.bulk(self.client, actions)

    def index_exists(self):
        return self.client.indices.exists(index=self.index_name)

    def bill_exists(self, bill_id):
        body = {"size": 0, "query": {"term": {"bill_id": bill_id}}}
        res = self.client.search(index=self.index_name, body=body)
        return res["hits"]["total"]["value"] > 0

    def keyword_search(self, query, k=5):
        """
        Standard text search on chunk_text (works on both ES and OpenSearch).
        """
        body = {
            "size": k,
            "query": {"match": {"chunk_text": {"query": query}}},
        }
        return self.client.search(index=self.index_name, body=body)

    def vector_search(self, query_vector, k=5):
        """
        Semantic (vector) search.

        OpenSearch: uses knn query on "embedding"
        Elasticsearch: uses top-level "knn" query (8.x)
        """
        if self.backend == "opensearch":
            body = {
                "size": k,
                "query": {"knn": {"embedding": {"vector": query_vector, "k": k}}},
            }
            return self.client.search(index=self.index_name, body=body)

        # Elasticsearch
        body = {
            "knn": {
                "field": "embedding",
                "query_vector": query_vector,
                "k": k,
                "num_candidates": max(50, k * 10),
            },
            "_source": True,
        }
        return self.client.search(index=self.index_name, body=body)
