import re
from typing import Optional

BILL_TYPE_MAP = {
    "hr": "house-bill",
    "s": "senate-bill",
    "hjres": "house-joint-resolution",
    "sjres": "senate-joint-resolution",
    "hres": "house-resolution",
    "sres": "senate-resolution",
    "hconres": "house-concurrent-resolution",
    "sconres": "senate-concurrent-resolution",
}

BILL_LABEL_MAP = {
    "hr": "H.R.",
    "s": "S.",
    "hjres": "H.J.Res.",
    "sjres": "S.J.Res.",
    "hres": "H.Res.",
    "sres": "S.Res.",
    "hconres": "H.Con.Res.",
    "sconres": "S.Con.Res.",
}


def congress_url_from_id(bill_id: Optional[str]) -> Optional[str]:
    """
    Try to build a congress.gov URL from a bill ID string.
    Accepts formats like: '118-hr-8775', '118-hr-8775_0'
    Also accepts structured fields passed separately.
    """
    if not bill_id:
        return None
    base = re.sub(r"_\d+$", "", bill_id)
    m = re.match(
        r"^(\d+)-(hr|s|hjres|sjres|hres|sres|hconres|sconres)-(\d+)$", base, re.I
    )
    if not m:
        return None
    congress, bill_type, number = m.group(1), m.group(2).lower(), m.group(3)
    bill_path = BILL_TYPE_MAP.get(bill_type)
    if not bill_path:
        return None
    return f"https://www.congress.gov/bill/{congress}th-congress/{bill_path}/{number}"


def congress_url_from_fields(
    bill_type: Optional[str],
    bill_number: Optional[str],
    congress: Optional[str],
) -> Optional[str]:
    """Build a congress.gov URL from separate bill_type, bill_number, congress fields."""
    if not (bill_type and bill_number and congress):
        return None
    bill_path = BILL_TYPE_MAP.get(bill_type.lower())
    if not bill_path:
        return None
    return (
        f"https://www.congress.gov/bill/{congress}th-congress/{bill_path}/{bill_number}"
    )


def resolve_source_url(source: dict) -> Optional[str]:
    """
    Try every available field to find or construct a real URL for a source.
    """
    # 1. Already a real URL stored
    existing = source.get("url")
    if existing and existing.startswith("http"):
        return existing

    # 2. From bill_id field
    url = congress_url_from_id(source.get("billId") or source.get("bill_id"))
    if url:
        return url

    # 3. From separate bill fields
    url = congress_url_from_fields(
        source.get("billType") or source.get("bill_type"),
        source.get("billNumber") or source.get("bill_number"),
        source.get("congress"),
    )
    if url:
        return url

    # 4. Try to parse the sourceId itself as a bill ID
    url = congress_url_from_id(source.get("sourceId"))
    if url:
        return url

    return None
