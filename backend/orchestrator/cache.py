import time
from typing import Optional, Dict, Any


class QueryCache:
    """
    Simple in-memory cache for query results.
    
    Stores answers + documents for previously seen queries
    so we don't re-embed, re-search, and re-call the LLM.
    """

    def __init__(self, ttl_seconds: int = 3600, max_size: int = 100):
        """
        Args:
            ttl_seconds: how long a cached result stays valid (default 1 hour)
            max_size: max number of queries to cache
        """
        self.ttl_seconds = ttl_seconds
        self.max_size = max_size
        self._cache: Dict[str, Dict[str, Any]] = {}

    def _normalize_query(self, query: str) -> str:
        """Normalize query for cache key — lowercase and strip whitespace."""
        return query.strip().lower()

    def get(self, query: str) -> Optional[Dict[str, Any]]:
        """
        Look up a cached result. Returns None if not found or expired.
        """
        key = self._normalize_query(query)
        entry = self._cache.get(key)

        if entry is None:
            return None

        # Check if expired
        if time.time() - entry["timestamp"] > self.ttl_seconds:
            del self._cache[key]
            return None

        return entry["result"]

    def set(self, query: str, result: Dict[str, Any]) -> None:
        """
        Cache a result for a query.
        """
        # Evict oldest if at max size
        if len(self._cache) >= self.max_size:
            oldest_key = min(self._cache, key=lambda k: self._cache[k]["timestamp"])
            del self._cache[oldest_key]

        key = self._normalize_query(query)
        self._cache[key] = {
            "result": result,
            "timestamp": time.time(),
        }

    def size(self) -> int:
        return len(self._cache)

    def clear(self) -> None:
        self._cache.clear()