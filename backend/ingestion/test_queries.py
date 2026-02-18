# backend/ingestion/test_queries.py
from backend.ingestion.config import get_settings
from backend.ingestion.embeddings import Embedder
from backend.ingestion.search_store import SearchStore


def print_hits(res, max_text_len=200):
    """
    Print hits from ES/OpenSearch response in a readable way.
    """
    hits = res.get("hits", {}).get("hits", [])
    if not hits:
        print("No hits.")
        return

    for hit in hits:
        source = hit.get("_source", {})
        print("-" * 60)
        print("Score:", hit.get("_score"))
        print("Doc ID:", hit.get("_id"))
        print("Bill ID:", source.get("bill_id"))
        print("Title:", source.get("title"))
        print("Policy Area:", source.get("policy_area"))
        print("Bill Type:", source.get("bill_type"))
        print("Latest Action:", source.get("latest_action"))
        text = source.get("chunk_text", "")
        print(
            "Chunk Text:",
            (text[:max_text_len] + "...") if len(text) > max_text_len else text,
        )


def main():
    settings = get_settings()

    store = SearchStore(
        url=settings["SEARCH_URL"],
        index_name=settings["INDEX_NAME"],
        backend=settings["SEARCH_BACKEND"],
    )
    store.connect()

    embedder = Embedder(settings["EMBED_MODEL"])

    query = "data privacy penalties"

    print("\n=== KEYWORD SEARCH ===")
    res_kw = store.keyword_search(query, k=5)
    print_hits(res_kw)

    print("\n=== VECTOR SEARCH ===")
    qvec = embedder.embed_query(query)
    res_vec = store.vector_search(qvec, k=5)
    print_hits(res_vec)


if __name__ == "__main__":
    main()
