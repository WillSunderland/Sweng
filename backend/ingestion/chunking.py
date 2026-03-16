# backend/ingestion/chunking.py
import re


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


def split_sections(text):
    """
    Detect Legal sections headers and split documents

    Examples:
        Section 1
        Section 2.
        SEC. 3
    """

    pattern = r"(Section\s+\d+\.?|SEC\.\s*\d+)"
    parts = re.split(pattern, text)

    sections = []
    current_header = "Introduction"

    for part in parts:
        part = part.strip()
        if not part:
            continue
        if re.match(pattern, part):
            current_header = part
        else:
            sections.append({"section": current_header, "text": part})
    return sections


def chunk_legal_document(text, chunk_size=1000, overlap=150):
    """
    Full pipeline for legal document chunking.

    Steps:
      1. Detect sections
      2. Chunk each section with overlap
      3. Preserve section metadata
    """

    chunks = []

    sections = split_sections(text)

    for sec in sections:

        section_name = sec["section"]
        section_text = sec["text"]

        sub_chunks = make_chunks(section_text, chunk_size, overlap)

        for c in sub_chunks:
            chunks.append({"section": section_name, "text": c})
    return chunks
