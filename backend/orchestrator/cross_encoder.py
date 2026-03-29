import logging
from typing import List, Dict, Any
from sentence_transformers import CrossEncoder

logger = logging.getLogger(__name__)

# Lightweight cross-encoder, good for relevance scoring
DEFAULT_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"


class CrossEncoderReranker:
    """
    Re-ranks chunks by scoring (query, chunk_text) pairs directly.
    More accurate than embedding similarity because it reads both texts together.
    """

    def __init__(self, model_name: str = DEFAULT_MODEL):
        self.model_name = model_name
        self._model = None

    def get_model(self) -> CrossEncoder:
        if self._model is None:
            logger.info("Loading cross-encoder model: %s", self.model_name)
            self._model = CrossEncoder(self.model_name)
        return self._model

    def rerank(
        self, query: str, chunks: List[Dict[str, Any]], top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Score each chunk against the query and return the top_k highest scored.

        Args:
            query: the user's question
            chunks: list of chunk dicts, must have "chunk_text"
            top_k: how many to return

        Returns:
            top_k chunks sorted by cross-encoder score
        """
        if not chunks:
            return []

        if len(chunks) <= top_k:
            return chunks

        model = self.get_model()

        # Build (query, chunk_text) pairs for scoring
        pairs = []
        for chunk in chunks:
            text = chunk.get("chunk_text") or chunk.get("text") or ""
            pairs.append((query, text))

        # Score all pairs
        scores = model.predict(pairs)

        # Attach scores to chunks
        scored_chunks = []
        for i, chunk in enumerate(chunks):
            chunk_copy = chunk.copy()
            chunk_copy["cross_encoder_score"] = float(scores[i])
            scored_chunks.append(chunk_copy)

        # Sort by cross-encoder score (highest first)
        scored_chunks.sort(key=lambda x: x["cross_encoder_score"], reverse=True)

        # Return top_k, remove the temporary score field
        results = []
        for chunk in scored_chunks[:top_k]:
            chunk.pop("cross_encoder_score", None)
            results.append(chunk)

        return results
