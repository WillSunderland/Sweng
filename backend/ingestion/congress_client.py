# backend/ingestion/congress_client.py
"""
Congress.gov API client — Texas-focused bill ingestion.

API docs: https://github.com/LibraryOfCongress/api.congress.gov
Base URL: https://api.congress.gov/v3

Rate limit: 5,000 requests/hour
Pagination: default 20 results, max 250 per request

This client replaces legiscan_client.py and provides:
  1) get_tx_members()             → list of TX congress member bioguide IDs
  2) get_member_bills(bioguideId) → bills sponsored by that member
  3) get_bill_detail(congress, billType, billNumber) → full bill metadata
  4) get_bill_summaries(congress, billType, billNumber) → CRS summary text
  5) search_bills(query, congress, limit) → search bills by keyword
"""

import time
import requests


class CongressClient:
    BASE_URL = "https://api.congress.gov/v3"

    def __init__(self, api_key):
        self.api_key = api_key
        self.session = requests.Session()

    def _get(self, endpoint, params=None):
        if params is None:
            params = {}

        params["api_key"] = self.api_key
        params["format"] = "json"

        url = f"{self.BASE_URL}{endpoint}"

        time.sleep(0.5)

        resp = self.session.get(url, params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def get_state_members(self, state_code="TX", congress=118, limit=250):
        members = []
        offset = 0

        while True:
            data = self._get(
                f"/member/congress/{congress}/{state_code}",
                params={"limit": limit, "offset": offset},
            )

            batch = data.get("members", [])
            if not batch:
                break

            members.extend(batch)

            pagination = data.get("pagination", {})
            if pagination.get("next"):
                offset += limit
            else:
                break

        return members

    def get_member_bills(self, bioguide_id, limit=50):
        bills = []
        offset = 0

        while True:
            data = self._get(
                f"/member/{bioguide_id}/sponsored-legislation",
                params={"limit": limit, "offset": offset},
            )

            batch = data.get("sponsoredLegislation", [])
            if not batch:
                break

            bills.extend(batch)

            pagination = data.get("pagination", {})
            if pagination.get("next"):
                offset += limit
            else:
                break

        return bills

    def get_bill_detail(self, congress, bill_type, bill_number):
        data = self._get(f"/bill/{congress}/{bill_type}/{bill_number}")
        return data.get("bill", {})

    def get_bill_summaries(self, congress, bill_type, bill_number):
        data = self._get(f"/bill/{congress}/{bill_type}/{bill_number}/summaries")
        return data.get("summaries", [])

    def search_bills(self, congress=None, bill_type=None, limit=20, offset=0):
        if congress and bill_type:
            endpoint = f"/bill/{congress}/{bill_type}"
        elif congress:
            endpoint = f"/bill/{congress}"
        else:
            endpoint = "/bill"

        data = self._get(endpoint, params={"limit": limit, "offset": offset})
        return data.get("bills", [])

    def get_bill_subjects(self, congress, bill_type, bill_number):
        data = self._get(f"/bill/{congress}/{bill_type}/{bill_number}/subjects")
        return data.get("subjects", {})

    def get_bill_actions(self, congress, bill_type, bill_number, limit=50):
        data = self._get(
            f"/bill/{congress}/{bill_type}/{bill_number}/actions",
            params={"limit": limit},
        )
        return data.get("actions", [])

    def get_bill_text(self, congress, bill_type, bill_number):
        """
        Fetch the plain text of a bill by finding its latest text version URL.

        Endpoint: /v3/bill/{congress}/{billType}/{billNumber}/text

        Returns the plain text string, or "" if unavailable.
        """
        try:
            data = self._get(f"/bill/{congress}/{bill_type}/{bill_number}/text")
            text_versions = data.get("textVersions", [])
            if not text_versions:
                return ""

            # Pick the latest version — they come sorted newest first
            for version in text_versions:
                formats = version.get("formats", [])
                for fmt in formats:
                    if fmt.get("type", "").lower() == "formatted text":
                        url = fmt.get("url", "")
                        if url:
                            resp = self.session.get(url, timeout=30)
                            resp.raise_for_status()
                            return resp.text[:8000]  # cap at 8000 chars
            return ""
        except Exception:
            return ""