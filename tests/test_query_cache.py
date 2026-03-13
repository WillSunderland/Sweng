from __future__ import annotations

import backend.orchestrator.cache as cache_mod


def test_query_cache_hit_and_expiry(monkeypatch):
    now = {"t": 1_000.0}
    monkeypatch.setattr(cache_mod.time, "time", lambda: now["t"])

    cache = cache_mod.QueryCache(ttl_seconds=10, max_size=10)
    cache.set("  GDPR  ", {"answer": "ok"})
    assert cache.get("gdpr") == {"answer": "ok"}

    now["t"] += 11
    assert cache.get("gdpr") is None


def test_query_cache_eviction(monkeypatch):
    now = {"t": 1_000.0}
    monkeypatch.setattr(cache_mod.time, "time", lambda: now["t"])

    cache = cache_mod.QueryCache(ttl_seconds=100, max_size=2)
    cache.set("q1", {"answer": "a"})
    now["t"] += 1
    cache.set("q2", {"answer": "b"})
    now["t"] += 1
    cache.set("q3", {"answer": "c"})

    assert cache.get("q1") is None
    assert cache.get("q2") == {"answer": "b"}
    assert cache.get("q3") == {"answer": "c"}
