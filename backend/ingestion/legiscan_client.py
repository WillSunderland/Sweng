# backend/ingestion/legiscan_client.py
import requests

# LegiScan endpoint (constant)
BASE_URL = "https://api.legiscan.com/"

# Texas-only scope for this project
STATE = "TX"

# LegiScan operations (constant strings)
OP_SEARCH = "search"
OP_GET_BILL = "getBill"


class LegiScanClient:
    """
    Texas-only LegiScan API client.

    How we get bill IDs:
      1) We call search (op=search, state=TX, query=...)
      2) LegiScan returns results containing bill_id values
      3) We then call getBill (op=getBill, id=<bill_id>) to fetch full bill details

    This class intentionally stays simple: one request -> one JSON dict returned.
    """

    def __init__(self, api_key):
        self.api_key = api_key
        self.timeout_seconds = 30

    def search_tx_bills(self, query):
        """
        Search Texas bills matching the query string.

        Args:
          query (str): search term like "privacy" or "data breach"

        Returns:
          dict: JSON response from LegiScan.
        """
        params = {
            "key": self.api_key,
            "op": OP_SEARCH,
            "state": STATE,
            "query": query,
        }
        r = requests.get(BASE_URL, params=params, timeout=self.timeout_seconds)
        r.raise_for_status()
        return r.json()

    def get_bill_json(self, bill_id):
        """
        Fetch a single bill's full details using a bill_id discovered from search.

        Args:
          bill_id (str|int): bill identifier from LegiScan search results

        Returns:
          dict: JSON response from LegiScan.
        """
        params = {
            "key": self.api_key,
            "op": OP_GET_BILL,
            "id": bill_id,
        }
        r = requests.get(BASE_URL, params=params, timeout=self.timeout_seconds)
        r.raise_for_status()
        return r.json()
