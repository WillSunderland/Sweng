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
        """
        Make a GET request to the Congress.gov API.

        Handles:
          - API key injection
          - JSON format
          - Basic rate-limit safety (small sleep between calls)
          - Error handling
        """
        if params is None:
            params = {}

        params["api_key"] = self.api_key
        params["format"] = "json"

        url = f"{self.BASE_URL}{endpoint}"

        # Small delay to be respectful of rate limits (5000/hr = ~1.4/sec)
        time.sleep(0.5)

        resp = self.session.get(url, params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()

    # ------------------------------------------------------------------
    # 1) Get members from a specific state
    # ------------------------------------------------------------------
    def get_state_members(self, state_code="TX", limit=250):
        """
        Fetch all current congress members for a given state.

        Endpoint: /v3/member?stateCode=TX&limit=250

        Returns list of member dicts, each containing:
          - bioguideId
          - name
          - state
          - district
          - party
          - terms (list)
        """
        members = []
        offset = 0

        while True:
            data = self._get("/member", params={
                "stateCode": state_code,
                "limit": limit,
                "offset": offset,
            })

            batch = data.get("members", [])
            if not batch:
                break

            members.extend(batch)

            # Check if there are more pages
            pagination = data.get("pagination", {})
            if pagination.get("next"):
                offset += limit
            else:
                break

        return members

    # ------------------------------------------------------------------
    # 2) Get bills sponsored by a specific member
    # ------------------------------------------------------------------
    def get_member_bills(self, bioguide_id, limit=50):
        """
        Fetch bills sponsored by a specific member.

        Endpoint: /v3/member/{bioguideId}/sponsored-legislation

        Returns list of bill summary dicts containing:
          - congress
          - type (HR, S, HJRES, etc.)
          - number
          - title
          - latestAction
          - policyArea
          - url (API url for detail)
        """
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

    # ------------------------------------------------------------------
    # 3) Get full bill detail
    # ------------------------------------------------------------------
    def get_bill_detail(self, congress, bill_type, bill_number):
        """
        Fetch detailed info for a specific bill.

        Endpoint: /v3/bill/{congress}/{billType}/{billNumber}

        Example: /v3/bill/118/hr/1234

        Returns dict with keys like:
          - title
          - number
          - type
          - congress
          - originChamber
          - policyArea
          - subjects
          - latestAction
          - sponsors
          - summaries (URL to summaries endpoint)
        """
        data = self._get(f"/bill/{congress}/{bill_type}/{bill_number}")
        return data.get("bill", {})

    # ------------------------------------------------------------------
    # 4) Get bill summaries (CRS summary text)
    # ------------------------------------------------------------------
    def get_bill_summaries(self, congress, bill_type, bill_number):
        """
        Fetch CRS summaries for a specific bill.

        Endpoint: /v3/bill/{congress}/{billType}/{billNumber}/summaries

        Returns list of summary dicts, each containing:
          - text (HTML-formatted summary text)
          - actionDate
          - actionDesc
          - versionCode
          - updateDate

        The 'text' field contains the actual searchable content.
        Note: text may contain HTML tags — we strip them during extraction.
        """
        data = self._get(f"/bill/{congress}/{bill_type}/{bill_number}/summaries")
        return data.get("summaries", [])

    # ------------------------------------------------------------------
    # 5) Search bills by keyword (alternative discovery method)
    # ------------------------------------------------------------------
    def search_bills(self, congress=None, bill_type=None, limit=20, offset=0):
        """
        List bills, optionally filtered by congress and type.

        Endpoint: /v3/bill
        Or:       /v3/bill/{congress}
        Or:       /v3/bill/{congress}/{billType}

        NOTE: The Congress.gov API does NOT have a keyword search endpoint
        for bills. To find bills by topic, you need to either:
          a) Browse by congress/type and filter client-side
          b) Use member-sponsored-legislation approach
          c) Use the /v3/summaries endpoint for keyword-based discovery

        This method returns bills at the list level for pagination.
        """
        if congress and bill_type:
            endpoint = f"/bill/{congress}/{bill_type}"
        elif congress:
            endpoint = f"/bill/{congress}"
        else:
            endpoint = "/bill"

        data = self._get(endpoint, params={"limit": limit, "offset": offset})
        return data.get("bills", [])

    # ------------------------------------------------------------------
    # 6) Get bill subjects
    # ------------------------------------------------------------------
    def get_bill_subjects(self, congress, bill_type, bill_number):
        """
        Fetch legislative subject terms for a bill.

        Endpoint: /v3/bill/{congress}/{billType}/{billNumber}/subjects

        Returns dict with:
          - legislativeSubjects: list of {name: "..."}
          - policyArea: {name: "..."}
        """
        data = self._get(f"/bill/{congress}/{bill_type}/{bill_number}/subjects")
        return data.get("subjects", {})

    # ------------------------------------------------------------------
    # 7) Get bill actions (legislative history)
    # ------------------------------------------------------------------
    def get_bill_actions(self, congress, bill_type, bill_number, limit=50):
        """
        Fetch actions/history for a specific bill.

        Endpoint: /v3/bill/{congress}/{billType}/{billNumber}/actions
        """
        data = self._get(
            f"/bill/{congress}/{bill_type}/{bill_number}/actions",
            params={"limit": limit},
        )
        return data.get("actions", [])