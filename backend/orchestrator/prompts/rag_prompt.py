SYSTEM_PROMPT = """You are a legal research assistant that answers questions about legislative documents. You MUST follow these rules:
1. ONLY use information from the provided source documents.
2. ALWAYS cite your sources using the format [Source: document_title].
3. If the provided documents do not contain enough information to answer the question, explicitly say "I don't have enough information to answer this question based on the available documents."
4. Distinguish clearly between your summary and direct quotes from the law.
5. Be precise and concise."""


def build_rag_user_prompt(query: str, documents: list[dict]) -> str:
    """
    Formats the user query and retrieved documents into a single prompt.

    Args:
        query: The user's natural language query
        documents: List of document dicts with keys like 'title', 'chunk_text'

    Returns:
        The formatted user prompt string
    """
    context_parts = []
    max_total_chars = 2400
    max_chunk_chars = 600
    total_chars = 0

    for i, doc in enumerate(documents, 1):
        source_title = doc.get("title", "Unknown Source")
        chunk_text = doc.get("chunk_text", "").strip()
        if len(chunk_text) > max_chunk_chars:
            chunk_text = chunk_text[:max_chunk_chars].rstrip() + "…"

        state = doc.get("state", "Unknown")
        bill_type = doc.get("bill_type", "")
        bill_number = doc.get("bill_number", "")
        session = doc.get("session", "")
        policy_area = doc.get("policy_area", "")

        source_info = f"{state} - {bill_type} {bill_number} ({session})".strip()
        if policy_area:
            source_info += f" | Policy Area: {policy_area}"

        entry = f"Document {i} (Title: {source_title} | Source: {source_info}):\n{chunk_text}\n"
        if total_chars + len(entry) > max_total_chars:
            break
        context_parts.append(entry)
        total_chars += len(entry)

    context_str = "\n".join(context_parts)

    return (
        "Here are the relevant documents:\n\n" f"{context_str}\n\n" f"Question: {query}"
    )
