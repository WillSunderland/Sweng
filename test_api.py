# test_api.py
from backend.ingestion.congress_client import CongressClient

client = CongressClient("SyVYRHgYl4QfhXZbftH6UOtvUHKwFKfeonBadhnx")

print("=== TX Members (118th Congress) ===")
members = client.get_state_members("TX", congress=118)
print(f"Found {len(members)} members")
for m in members[:3]:
    print(f"  {m['name']} - {m['bioguideId']}")

bio_id = members[0]["bioguideId"]
print(f"\n=== Bills for {members[0]['name']} ===")
bills = client.get_member_bills(bio_id, limit=5)
print(f"Found {len(bills)} bills")
for b in bills[:3]:
    print(f"  {b.get('congress')}-{b.get('type')}-{b.get('number')}: {b.get('title','')[:80]}")

if bills:
    b = bills[0]
    c, t, n = b["congress"], b["type"].lower(), b["number"]
    print(f"\n=== Detail: {c}/{t}/{n} ===")
    detail = client.get_bill_detail(c, t, n)
    print(f"Title: {detail.get('title','')[:100]}")
    print(f"\n=== Summaries ===")
    sums = client.get_bill_summaries(c, t, n)
    print(f"Found {len(sums)} summaries")
    if sums:
        print(f"Preview: {sums[0].get('text','')[:200]}")