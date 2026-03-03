from pathlib import Path
import sys

ORCH_DIR = Path(__file__).resolve().parents[2] / "backend" / "orchestrator"
sys.path.insert(0, str(ORCH_DIR))

from url_utils import (  # noqa: E402
    congress_url_from_fields,
    congress_url_from_id,
    resolve_source_url,
)


def test_congress_url_from_id_basic():
    url = congress_url_from_id("118-hr-8775")
    assert url == "https://www.congress.gov/bill/118th-congress/house-bill/8775"


def test_congress_url_from_id_suffix():
    url = congress_url_from_id("118-hr-8775_0")
    assert url == "https://www.congress.gov/bill/118th-congress/house-bill/8775"


def test_congress_url_from_id_invalid():
    assert congress_url_from_id("bad-format") is None
    assert congress_url_from_id(None) is None


def test_congress_url_from_fields():
    url = congress_url_from_fields("s", "12", "118")
    assert url == "https://www.congress.gov/bill/118th-congress/senate-bill/12"


def test_resolve_source_url_prefers_existing():
    source = {
        "url": "https://example.com/source",
        "bill_id": "118-hr-8775",
    }
    assert resolve_source_url(source) == "https://example.com/source"


def test_resolve_source_url_from_bill_id():
    source = {"bill_id": "118-hr-8775"}
    assert (
        resolve_source_url(source)
        == "https://www.congress.gov/bill/118th-congress/house-bill/8775"
    )


def test_resolve_source_url_from_fields():
    source = {"bill_type": "s", "bill_number": "12", "congress": "118"}
    assert (
        resolve_source_url(source)
        == "https://www.congress.gov/bill/118th-congress/senate-bill/12"
    )


def test_resolve_source_url_from_source_id():
    source = {"sourceId": "118-hr-8775"}
    assert (
        resolve_source_url(source)
        == "https://www.congress.gov/bill/118th-congress/house-bill/8775"
    )


def test_resolve_source_url_none():
    assert resolve_source_url({"title": "Unknown"}) is None
