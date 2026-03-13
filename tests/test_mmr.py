from __future__ import annotations

from backend.orchestrator.mmr import mmr_rerank


def test_mmr_empty():
    assert mmr_rerank([], query_embedding=[0.0, 1.0]) == []


def test_mmr_returns_without_embeddings_when_short():
    chunks = [
        {"bill_id": "A", "embedding": [1.0, 0.0]},
        {"bill_id": "B", "embedding": [0.0, 1.0]},
    ]
    result = mmr_rerank(chunks, query_embedding=[1.0, 0.0], top_k=5)
    assert len(result) == 2
    assert "embedding" not in result[0]
    assert "embedding" not in result[1]
