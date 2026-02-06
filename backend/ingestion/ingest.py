# backend/ingestion/ingest.py
import json

from backend.ingestion.config import get_settings
from backend.ingestion.legiscan_client import LegiScanClient
from backend.ingestion.chunking import make_chunks
from backend.ingestion.embeddings import Embedder
from backend.ingestion.search_store import SearchStore


def extract_text_from_legiscan_json(data, fallback_bill_id=""):
    """
    Convert a LegiScan "getBill" JSON response into:
      - meta: bill metadata (bill_id, state, session, title)
      - text: searchable text for chunking + embeddings

    Sprint 1 (MVP):
      text = title + "\\n" + (description or summary)

    Later improvements:
      - add full bill text if available in response
      - add more metadata fields for filtering
    """
    bill = data.get("bill", {}) if isinstance(data, dict) else {}

    bill_id = bill.get("bill_id") or bill.get("id") or fallback_bill_id
    title = bill.get("title", "")
    description = bill.get("description", "") or bill.get("summary", "")

    meta = {
        "bill_id": str(bill_id),
        "state": str(bill.get("state", "")),
        "session": str(bill.get("session", "")),
        "title": str(title),
    }

    text = (str(title).strip() + "\n" + str(description).strip()).strip()
    return meta, text


def pick_bill_ids_via_search(legiscan, query, limit):
    """
    Discover bill IDs from LegiScan search.

    We call search for Texas (TX) and extract bill_id values from results.

    This function also writes a sample JSON file so you can inspect the response:
      - sample_legiscan_search.json
    """
    result = legiscan.search_tx_bills(query)

    # Save response for debugging / confirming JSON structure
    with open("sample_legiscan_search.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    bill_ids = []

    # Common response pattern: result["searchresult"] is a list of dicts.
    # If LegiScan changes structure, inspect sample_legiscan_search.json and adjust here.
    search_results = result.get("searchresult", [])
    if isinstance(search_results, list):
        for item in search_results:
            if not isinstance(item, dict):
                continue
            bid = item.get("bill_id") or item.get("id")
            if bid:
                bill_ids.append(str(bid))

    return bill_ids[:limit]


def main():
    settings = get_settings()

    # 1) Create clients
    legiscan = LegiScanClient(settings["LEGISCAN_API_KEY"])

    store = SearchStore(
        url=settings["SEARCH_URL"],
        index_name=settings["INDEX_NAME"],
        backend=settings["SEARCH_BACKEND"],
    )
    store.connect()

    embedder = Embedder(settings["EMBED_MODEL"])

    # 2) Decide which bills to ingest:
    #    - If BILL_ID is set in env, ingest that single bill
    #    - Otherwise discover bills using TX search query
    if settings["BILL_ID"]:
        bill_ids = [settings["BILL_ID"]]
    else:
        bill_ids = pick_bill_ids_via_search(
            legiscan,
            settings["SEARCH_QUERY"],
            settings["SEARCH_LIMIT"],
        )

    if not bill_ids:
        raise RuntimeError(
            "No bill IDs found. Inspect sample_legiscan_search.json and adjust bill_id parsing if needed."
        )

    all_docs = []
    vector_dim = None

    # 3) Ingest bills one by one
    for bill_id in bill_ids:
        data = legiscan.get_bill_json(bill_id)

        # Save sample bill response for inspection (first bill only)
        if bill_id == bill_ids[0]:
            with open("sample_legiscan_bill.json", "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)

        meta, text = extract_text_from_legiscan_json(data, fallback_bill_id=bill_id)
        if not text:
            # Rare: skip bills that produce no text
            continue

        # 4) Chunk & embed
        chunks = make_chunks(text, chunk_size=1000, overlap=150)
        vectors = embedder.embed_texts(chunks)

        if not vectors:
            continue

        if vector_dim is None:
            vector_dim = len(vectors[0])

        # 5) Build documents (one doc per chunk)
        for i in range(len(chunks)):
            all_docs.append(
                {
                    "doc_id": f"{meta['bill_id']}_{i}",
                    "bill_id": meta["bill_id"],
                    "state": meta.get("state", ""),
                    "session": meta.get("session", ""),
                    "title": meta.get("title", ""),
                    "chunk_id": i,
                    "chunk_text": chunks[i],
                    "embedding": vectors[i],
                }
            )

    if not all_docs:
        raise RuntimeError("No documents built for indexing. Check extraction/chunking outputs.")

    # 6) Create index and bulk index documents
    store.create_index_if_missing(vector_dim)
    store.index_documents_bulk(all_docs)

    # 7) Print summary
    print("DONE ✅")
    print("Backend:", settings["SEARCH_BACKEND"])
    print("Index:", settings["INDEX_NAME"])
    print("Documents indexed:", len(all_docs))
    print("Saved:")
    print(" - sample_legiscan_search.json (TX search response)")
    print(" - sample_legiscan_bill.json   (first getBill response)")


if __name__ == "__main__":
    main()
