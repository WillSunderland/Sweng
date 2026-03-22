# backend/ingestion/ingest.py
import json

from backend.ingestion.config import get_settings
import re
from backend.ingestion.congress_client import CongressClient
from backend.ingestion.chunking import chunk_legal_document
from backend.ingestion.embeddings import Embedder
from backend.ingestion.search_store import SearchStore


def strip_html(text):
    """Remove HTML tags from summary text returned by Congress.gov API."""
    if not text:
        return ""
    return re.sub(r"<[^>]+>", "", text).strip()


def extract_text_from_congress_bill(
    bill_detail, summaries, actions=None, subjects=None, bill_text=None, state_code="TX"
):
    """
    Convert Congress.gov bill detail + summaries into:
      - meta: bill metadata
      - text: searchable text for chunking + embeddings
    """
    congress = bill_detail.get("congress", "")
    bill_type = bill_detail.get("type", "").lower()
    bill_number = bill_detail.get("number", "")
    title = bill_detail.get("title", "")

    bill_id = f"{congress}-{bill_type}-{bill_number}"

    policy_area = ""
    pa = bill_detail.get("policyArea")
    if pa and isinstance(pa, dict):
        policy_area = pa.get("name", "")

    latest_action = ""
    la = bill_detail.get("latestAction")
    if la and isinstance(la, dict):
        latest_action = la.get("text", "")

    meta = {
        "bill_id": str(bill_id),
        "state": str(state_code),
        "session": str(congress),
        "title": str(title),
        "policy_area": str(policy_area),
        "bill_type": str(bill_type).upper(),
        "bill_number": str(bill_number),
        "latest_action": str(latest_action),
    }

    text_parts = [str(title).strip()]

    if policy_area:
        text_parts.append(f"Policy Area: {policy_area}")

    for summary in summaries:
        clean_text = strip_html(summary.get("text", ""))
        if clean_text:
            text_parts.append(clean_text)

    # Use full bill text if available — much richer than summaries
    if bill_text and bill_text.strip():
        clean_bill_text = strip_html(bill_text)[:6000]
        text_parts.append(clean_bill_text)
    elif len(text_parts) <= 2 and latest_action:
        # Fallback if no summaries and no bill text
        text_parts.append(latest_action)

    if subjects:
        leg_subjects = subjects.get("legislativeSubjects", [])
        if leg_subjects:
            names = [s.get("name", "") for s in leg_subjects if s.get("name")]
            if names:
                text_parts.append("Subjects: " + ", ".join(names))

    if actions:
        for action in actions[:10]:
            action_text = action.get("text", "").strip()
            if action_text:
                text_parts.append(action_text)

    text = "\n".join(text_parts).strip()
    return meta, text


def discover_tx_bills(client, state_code, congress_number, limit):
    """
    Discover bills sponsored by members from the given state.
    """
    print(f"Fetching {state_code} members from Congress.gov...")
    members = client.get_state_members(state_code, congress=int(congress_number))
    print(f"Found {len(members)} members for {state_code}")

    if members:
        with open("sample_congress_members.json", "w", encoding="utf-8") as f:
            json.dump(members[:3], f, indent=2)

    seen_bills = set()
    bills = []

    for member in members:
        if len(bills) >= limit:
            break

        bioguide_id = member.get("bioguideId", "")
        member_name = member.get("name", "Unknown")

        if not bioguide_id:
            continue

        print(f"  Fetching bills for {member_name} ({bioguide_id})...")

        try:
            member_bills = client.get_member_bills(bioguide_id, limit=50)
        except Exception as e:
            print(f"    Warning: Error fetching bills for {bioguide_id}: {e}")
            continue

        for bill in member_bills:
            if len(bills) >= limit:
                break

            congress = bill.get("congress", "")
            bill_type = (bill.get("type") or "").lower()
            bill_number = str(bill.get("number", ""))
            if not bill_type or not bill_number:
                continue
            bill_number = bill.get("number", "")

            if str(congress) != str(congress_number):
                continue

            bill_key = f"{congress}-{bill_type}-{bill_number}"
            if bill_key in seen_bills:
                continue

            seen_bills.add(bill_key)
            bills.append(
                {
                    "congress": str(congress),
                    "type": bill_type,
                    "number": str(bill_number),
                    "title": bill.get("title", ""),
                }
            )

    return bills


def main():
    settings = get_settings()

    client = CongressClient(settings["CONGRESS_GOV_API_KEY"])

    store = SearchStore(
        url=settings["SEARCH_URL"],
        index_name=settings["INDEX_NAME"],
        backend=settings["SEARCH_BACKEND"],
    )
    store.connect()

    embedder = Embedder(settings["EMBED_MODEL"])

    if settings["BILL_ID"]:
        parts = settings["BILL_ID"].replace("-", "/").split("/")
        if len(parts) != 3:
            raise ValueError("BILL_ID must be in format '118/hr/1234' or '118-hr-1234'")
        bills_to_ingest = [
            {
                "congress": parts[0],
                "type": parts[1].lower(),
                "number": parts[2],
                "title": "",
            }
        ]
    else:
        bills_to_ingest = discover_tx_bills(
            client,
            state_code=settings["STATE_CODE"],
            congress_number=settings["CONGRESS_NUMBER"],
            limit=settings["SEARCH_LIMIT"],
        )

    if not bills_to_ingest:
        raise RuntimeError(
            "No bills found. Check CONGRESS_GOV_API_KEY, STATE_CODE, CONGRESS_NUMBER. "
            "Inspect sample_congress_members.json for debugging."
        )

    print(f"\nIngesting {len(bills_to_ingest)} bills...")

    all_docs = []
    vector_dim = None

    for i, bill_info in enumerate(bills_to_ingest):
        congress = bill_info["congress"]
        bill_type = bill_info["type"]
        bill_number = bill_info["number"]
        bill_key = f"{congress}-{bill_type}-{bill_number}"

        print(f"\n[{i+1}/{len(bills_to_ingest)}] Processing {bill_key}...")

        bill_id = f"{congress}-{bill_type}-{bill_number}"
        if store.index_exists() and store.bill_exists(bill_id):
            print(f"  Skipping {bill_key} — already indexed")
            continue

        try:
            bill_detail = client.get_bill_detail(congress, bill_type, bill_number)
        except Exception as e:
            print(f"  Warning: Error fetching detail for {bill_key}: {e}")
            continue

        try:
            summaries = client.get_bill_summaries(congress, bill_type, bill_number)
        except Exception as e:
            print(f"  Warning: Error fetching summaries for {bill_key}: {e}")
            summaries = []

        try:
            actions = client.get_bill_actions(congress, bill_type, bill_number)
        except Exception:
            actions = []

        try:
            subjects = client.get_bill_subjects(congress, bill_type, bill_number)
        except Exception:
            subjects = {}

        try:
            bill_text = client.get_bill_text(congress, bill_type, bill_number)
            if bill_text:
                print(f"  Bill text fetched: {len(bill_text)} chars")
        except Exception:
            bill_text = ""

        if i == 0:
            with open("sample_congress_bill.json", "w", encoding="utf-8") as f:
                json.dump(bill_detail, f, indent=2)
            with open("sample_congress_summaries.json", "w", encoding="utf-8") as f:
                json.dump(summaries, f, indent=2)

        meta, text = extract_text_from_congress_bill(
            bill_detail,
            summaries,
            actions=actions,
            subjects=subjects,
            bill_text=bill_text,
            state_code=settings["STATE_CODE"],
        )

        if not text:
            print(f"  Warning: No text extracted for {bill_key}, skipping")
            continue

        print(f"  Title: {meta['title'][:80]}...")
        print(f"  Text length: {len(text)} chars")

        chunk_objects = chunk_legal_document(text, chunk_size=1000, overlap=150)

        chunk_texts = [c["text"] for c in chunk_objects]
        vectors = embedder.embed_texts(chunk_texts)
        if not vectors:
            continue

        if vector_dim is None:
            vector_dim = len(vectors[0])

        for ci in range(len(chunk_objects)):
            chunk = chunk_objects[ci]

            all_docs.append(
                {
                    "doc_id": f"{meta['bill_id']}_{ci}",
                    "bill_id": meta["bill_id"],
                    "state": meta.get("state", ""),
                    "session": meta.get("session", ""),
                    "title": meta.get("title", ""),
                    "policy_area": meta.get("policy_area", ""),
                    "bill_type": meta.get("bill_type", ""),
                    "bill_number": meta.get("bill_number", ""),
                    "latest_action": meta.get("latest_action"),
                    # NEW metadata
                    "section": chunk.get("section", ""),
                    "chunk_id": ci,
                    "chunk_text": chunk["text"],
                    "embedding": vectors[ci],
                }
            )

    if not all_docs:
        raise RuntimeError(
            "No documents built for indexing. Check extraction/chunking outputs."
        )

    store.create_index_if_missing(vector_dim)
    store.index_documents_bulk(all_docs)

    print("\nDONE ✅")
    print("Backend:", settings["SEARCH_BACKEND"])
    print("Index:", settings["INDEX_NAME"])
    print("Documents indexed:", len(all_docs))
    print("Bills processed:", len(bills_to_ingest))
    print("State:", settings["STATE_CODE"])
    print("Congress:", settings["CONGRESS_NUMBER"])


if __name__ == "__main__":
    main()