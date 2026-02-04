# Ticket 1.6 — Texas Data Ingestion (LegiScan → Elasticsearch/OpenSearch)

This folder contains the ingestion pipeline for **Ticket 1.6**.

## What Ticket 1.6 is for
We need a searchable dataset of **Texas (TX)** legislative bills inside our search backend so later tickets (especially **Ticket 2.2: Semantic Retrieval Tool**) can query it.

This pipeline:
1) fetches bill data from **LegiScan** (Texas only),
2) extracts text,
3) splits it into chunks,
4) generates vector embeddings,
5) stores the chunks + embeddings in **Elasticsearch (local dev)** or **OpenSearch (AWS later)**,
6) validates retrieval with test queries.

---



## Files in this folder

### `config.py`
Reads environment variables and returns a settings dict used by the scripts.

### `legiscan_client.py`
Texas-only LegiScan client:
- `search_tx_bills(query)` → search TX bills and discover `bill_id`s
- `get_bill_json(bill_id)` → fetch full bill JSON for a discovered `bill_id`

### `chunking.py`
`make_chunks(text, chunk_size=1000, overlap=150)` splits text into overlapping chunks.

### `embeddings.py`
`Embedder` generates vectors using `sentence-transformers`:
- `embed_texts(list[str])` → list of vectors
- `embed_query(str)` → one vector

### `search_store.py`
Database wrapper that supports both backends:
- Elasticsearch (local dev)
- OpenSearch (AWS later)

It handles:
- connecting
- index creation (vector mapping differs for ES vs OpenSearch)
- bulk indexing
- keyword search + vector search

### `ingest.py`
Main ingestion script:
- decides which bills to ingest (single `BILL_ID` or search-based)
- builds chunk docs
- creates index
- bulk indexes docs
- writes sample JSON files:
  - `sample_legiscan_search.json`
  - `sample_legiscan_bill.json`

### `test_queries.py`
Validation script:
- runs keyword search + vector search
- prints top hits to confirm retrieval works

---

## Document format stored in ES/OpenSearch
One chunk = one document in the index:

- `doc_id`  (stable ID: `<bill_id>_<chunk_id>`)
- `bill_id`
- `state`
- `session`
- `title`
- `chunk_id`
- `chunk_text`
- `embedding` (vector)

Re-running ingestion overwrites the same `doc_id` (no duplicates).

---

## Environment variables (.env)

### Required
- `LEGISCAN_API_KEY`
- `SEARCH_BACKEND` = `elasticsearch` or `opensearch`
- `INDEX_NAME`
- `ELASTICSEARCH_URL` if `SEARCH_BACKEND=elasticsearch`
- `OPENSEARCH_URL` if `SEARCH_BACKEND=opensearch`

### Ingestion controls
- `BILL_ID` (optional: ingest exactly one bill)
- `SEARCH_QUERY` (default: `privacy`)
- `SEARCH_LIMIT` (default: `3`)

### Example (Docker network + Elasticsearch local dev)
```env
SEARCH_BACKEND=elasticsearch
ELASTICSEARCH_URL=http://elasticsearch:9200
INDEX_NAME=legislation_chunks

LEGISCAN_API_KEY=YOUR_KEY_HERE
SEARCH_QUERY=privacy
SEARCH_LIMIT=10
