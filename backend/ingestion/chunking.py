# backend/ingestion/chunking.py


def make_chunks(text, chunk_size=1000, overlap=150):
    """
    Split a long string into overlapping chunks.

    Why overlap?
      When you split text, you don't want to lose context at boundaries.
      Overlap repeats a small part of the previous chunk at the start of the next.

    Args:
      text (str): input text to split
      chunk_size (int): max chars per chunk
      overlap (int): repeated chars between chunks

    Returns:
      list[str]: chunks
    """
    if text is None:
        return []

    text = text.strip()
    if not text:
        return []

    if overlap >= chunk_size:
        # Avoid infinite loops or weird stepping
        overlap = max(0, chunk_size // 4)

    chunks = []
    start = 0
    n = len(text)

    step = chunk_size - overlap

    while start < n:
        end = min(start + chunk_size, n)
        chunks.append(text[start:end])
        if end == n:
            break
        start += step

    return chunks
