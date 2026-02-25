import numpy as np
from typing import List, Dict, Any


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two vectors."""
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return 0.0
    return float(np.dot(a, b) / norm)


def mmr_rerank(
    chunks: List[Dict[str, Any]],
    query_embedding: List[float],
    top_k: int = 5,
    lambda_param: float = 0.5,
    same_doc_penalty: float = 0.3,
) -> List[Dict[str, Any]]:
    """
    Maximum Marginal Relevance re-ranking.

    Args:
        chunks: list of chunk dicts, each must have "embedding" and "bill_id"
        query_embedding: the query vector
        top_k: how many chunks to return
        lambda_param: balance between relevance (1.0) and diversity (0.0)
        same_doc_penalty: extra penalty when chunk shares bill_id with already-selected chunk

    Returns:
        top_k re-ranked chunks (without embeddings)
    """
    if not chunks:
        return []

    if len(chunks) <= top_k:
        for c in chunks:
            c.pop("embedding", None)
        return chunks

    query_vec = np.array(query_embedding)
    embeddings = [np.array(c["embedding"]) for c in chunks]

    # Relevance scores (similarity to query)
    relevance = [cosine_similarity(emb, query_vec) for emb in embeddings]

    selected_indices = []
    remaining = list(range(len(chunks)))

    for _ in range(top_k):
        best_idx = None
        best_score = -float("inf")

        for idx in remaining:
            rel = relevance[idx]

            # Max similarity to already selected chunks
            max_sim = 0.0
            for sel_idx in selected_indices:
                sim = cosine_similarity(embeddings[idx], embeddings[sel_idx])

                # Extra penalty if same bill
                if chunks[idx].get("bill_id") == chunks[sel_idx].get("bill_id"):
                    sim += same_doc_penalty

                max_sim = max(max_sim, sim)

            # MMR score
            score = lambda_param * rel - (1 - lambda_param) * max_sim

            if score > best_score:
                best_score = score
                best_idx = idx

        if best_idx is not None:
            selected_indices.append(best_idx)
            remaining.remove(best_idx)

    results = []
    for idx in selected_indices:
        chunk = chunks[idx].copy()
        chunk.pop("embedding", None)
        results.append(chunk)

    return results
