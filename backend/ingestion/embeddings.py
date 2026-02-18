# backend/ingestion/embeddings.py
from sentence_transformers import SentenceTransformer


class Embedder:
    """
    Local embedder using sentence-transformers.

    You will use:
      - embed_texts([...]) -> list of vectors
      - embed_query("...") -> single vector

    A vector is: list[float]
    """

    def __init__(self, model_name):
        """
        model_name example: "all-MiniLM-L6-v2"
        """
        self.model = SentenceTransformer(model_name)

    def embed_texts(self, texts):
        """
        Convert a list of strings into a list of embedding vectors.

        Returns:
          list[list[float]]
        """
        if not texts:
            return []

        vecs = self.model.encode(texts, normalize_embeddings=True)
        return vecs.tolist()

    def embed_query(self, query):
        """
        Convert one query string into one embedding vector.

        Returns:
          list[float]
        """
        return self.embed_texts([query])[0]
