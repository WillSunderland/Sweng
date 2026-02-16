# Ticket 1.6 — Texas Data Ingestion (Congress.gov API → Elasticsearch/OpenSearch)

This folder contains the ingestion pipeline for **Ticket 1.6**.

## What Ticket 1.6 is for
We need a searchable dataset of **Texas (TX)** federal legislative bills inside our search backend so later tickets (especially **Ticket 2.2: Semantic Retrieval Tool**) can query it.

This pipeline:
1) fetches bill data from the **Congress.gov API** (bills sponsored by TX members),
2) extracts text (title + CRS summaries),
3) splits it into chunks,
4) generates vector embeddings,
5) stores the chunks + embeddings in **Elasticsearch (local dev)** or **OpenSearch (AWS later)**,
6) validates retrieval with test queries.

> **Note:** Congress.gov covers **federal** legislation (U.S. Congress), not Texas state legislature bills. We fetch bills sponsored by Texas members of Congress.

---

## Files in this folder

### `config.py`
Reads environment variables and returns a settings dict used by all other scripts.

**Key settings:**
- `CONGRESS_GOV_API_KEY` — required API key (sign up at https://api.congress.gov/sign-up/)
- `STATE_CODE` — which state's members to fetch bills for (default: `TX`)
- `CONGRESS_NUMBER` — which congress session (default: `118`)
- `SEARCH_BACKEND` — `elasticsearch` or `opensearch`
- `SEARCH_LIMIT` — max number of bills to ingest (default: `10`)
- `BILL_ID` — optional, ingest a single bill (format: `118-hr-1234` or `118/hr/1234`)

### `congress_client.py`
Congress.gov API client (replaces the old `legiscan_client.py`).

**Methods:**
- `get_state_members(state_code)` → fetch all congress members for a state (e.g. TX)
- `get_member_bills(bioguide_id)` → fetch bills sponsored by a specific member
- `get_bill_detail(congress, bill_type, bill_number)` → fetch full bill metadata
- `get_bill_summaries(congress, bill_type, bill_number)` → fetch CRS summary text (main searchable content)
- `get_bill_subjects(congress, bill_type, bill_number)` → fetch legislative subject terms
- `get_bill_actions(congress, bill_type, bill_number)` → fetch bill action history

**API details:**
- Base URL: `https://api.congress.gov/v3`
- Rate limit: 5,000 requests/hour
- Pagination: default 20 results, max 250 per request
- Auth: API key passed as `?api_key=KEY` query param

### `chunking.py`
`make_chunks(text, chunk_size=1000, overlap=150)` splits text into overlapping chunks.

- `chunk_size` — max characters per chunk
- `overlap` — repeated characters between chunks (preserves context at boundaries)
- Returns `list[str]`

### `embeddings.py`
`Embedder` generates vectors using `sentence-transformers`:
- `embed_texts(list[str])` → list of vectors (for bulk embedding of chunks)
- `embed_query(str)` → single vector (for search queries)
- Default model: `all-MiniLM-L6-v2`

### `search_store.py`
Database wrapper that supports both backends:
- **Elasticsearch** (local dev)
- **OpenSearch** (AWS later)

**Methods:**
- `connect()` — connect to the selected backend
- `create_index_if_missing(vector_dim)` — create index with correct vector mapping
- `index_documents_bulk(docs)` — bulk insert docs (uses `doc_id` for upsert, no duplicates)
- `keyword_search(query, k)` — standard text search on `chunk_text`
- `vector_search(query_vector, k)` — semantic search using embeddings

### `ingest.py`
Main ingestion script. Run this to populate the search index.

**Flow:**
1. Fetches TX congress members via `get_state_members("TX")`
2. For each member, fetches their sponsored bills via `get_member_bills()`
3. Filters to the target congress (default: 118th)
4. Deduplicates bills
5. For each bill, fetches detail + CRS summaries
6. Extracts searchable text: `title + policy area + summary text`
7. Chunks text, generates embeddings
8. Bulk indexes into ES/OpenSearch

**Debug output files (saved on first run):**
- `sample_congress_members.json` — first 3 TX members
- `sample_congress_bill.json` — first bill detail response
- `sample_congress_summaries.json` — first bill summaries response

### `test_queries.py`
Validation script — run after ingestion to confirm retrieval works:
- Runs a keyword search on `chunk_text`
- Runs a vector (semantic) search using embeddings
- Prints top hits with scores, bill IDs, titles, and chunk text

---

## Document format stored in ES/OpenSearch
One chunk = one document in the index:

| Field | Type | Description |
|-------|------|-------------|
| `doc_id` | keyword | Stable ID: `<bill_id>_<chunk_id>` |
| `bill_id` | keyword | e.g. `118-hr-1234` |
| `state` | keyword | e.g. `TX` |
| `session` | keyword | Congress number, e.g. `118` |
| `title` | text | Bill title |
| `policy_area` | keyword | CRS policy area, e.g. `Government Operations and Politics` |
| `bill_type` | keyword | e.g. `HR`, `S`, `HJRES` |
| `bill_number` | keyword | e.g. `1234` |
| `latest_action` | text | Most recent action text |
| `chunk_id` | integer | Chunk index within the bill |
| `chunk_text` | text | The actual text chunk (searchable) |
| `embedding` | vector | Dense vector for semantic search |

Re-running ingestion overwrites the same `doc_id` (no duplicates).

---

## Environment variables (.env)

### Required
- `CONGRESS_GOV_API_KEY` — your Congress.gov API key
- `SEARCH_BACKEND` = `elasticsearch` or `opensearch`
- `INDEX_NAME` — name of the search index
- `ELASTICSEARCH_URL` if `SEARCH_BACKEND=elasticsearch`
- `OPENSEARCH_URL` if `SEARCH_BACKEND=opensearch`

### Ingestion controls
- `BILL_ID` (optional: ingest exactly one bill, format: `118-hr-1234`)
- `STATE_CODE` (default: `TX`)
- `CONGRESS_NUMBER` (default: `118`)
- `SEARCH_LIMIT` (default: `10`)

### Example .env (Docker network + Elasticsearch local dev)
```env
SEARCH_BACKEND=elasticsearch
ELASTICSEARCH_URL=http://elasticsearch:9200
INDEX_NAME=legislation_chunks
EMBED_MODEL=all-MiniLM-L6-v2

CONGRESS_GOV_API_KEY=your_key_here
STATE_CODE=TX
CONGRESS_NUMBER=118
SEARCH_LIMIT=20
```

---

## docker-compose.yml addition

```yaml
ingestion:
  build:
    context: .
    dockerfile: backend/ingestion/Dockerfile
  environment:
    - CONGRESS_GOV_API_KEY=${CONGRESS_GOV_API_KEY}
    - SEARCH_BACKEND=elasticsearch
    - ELASTICSEARCH_URL=http://elasticsearch:9200
    - INDEX_NAME=legislation_chunks
    - EMBED_MODEL=all-MiniLM-L6-v2
    - STATE_CODE=TX
    - CONGRESS_NUMBER=118
    - SEARCH_LIMIT=20
  depends_on:
    - elasticsearch
```

---

## How to run

### Ingest bills
```bash
docker compose run ingestion
```
Or locally:
```bash
python -m backend.ingestion.ingest
```

### Test retrieval
```bash
docker compose run ingestion python -m backend.ingestion.test_queries
```
Or locally:
```bash
python -m backend.ingestion.test_queries
```

### Ingest a single bill
Set `BILL_ID` in your `.env`:
```env
BILL_ID=118-hr-1234
```
Then run ingestion as normal. Only that bill will be fetched and indexed.