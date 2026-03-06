SYSTEM_PROMPT = """You are a legal research assistant. Follow these rules:
1. Use only the supplied documents, reasoning notes, and chat context.
2. If documents are supplied, cite them using [Source: document_title].
3. If retrieval was skipped and only chat context is supplied, answer from that context alone and do not invent citations.
4. If the available context is insufficient, explicitly say so.
5. Be precise, concise, and avoid unsupported claims."""


def _format_chat_history(chat_history: list[dict]) -> str:
    if not chat_history:
        return "No prior chat context."

    lines = []
    for message in chat_history[-6:]:
        role = message.get("role", "user").upper()
        content = message.get("content", "").strip()
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines) if lines else "No prior chat context."


def build_rag_user_prompt(
    query: str,
    documents: list[dict],
    *,
    chat_history: list[dict] | None = None,
    reasoning_notes: list[str] | None = None,
    retrieval_skipped: bool = False,
) -> str:
    """
    Formats the user query and retrieved documents into a single prompt.
    
    Args:
        query: The user's natural language query
        documents: List of document dicts with keys 'title', 'content', 'source_file'
        
    Returns:
        The formatted user prompt string
    """
    context_parts = []
    reasoning_notes = reasoning_notes or []
    chat_history = chat_history or []
    
    for i, doc in enumerate(documents, 1):
        source_title = doc.get("title", "Unknown Source")
        chunk_text = doc.get("chunk_text", "").strip()
        
        # Build source identifier
        state = doc.get("state", "Unknown")
        bill_type = doc.get("bill_type", "")
        bill_number = doc.get("bill_number", "")
        session = doc.get("session", "")
        policy_area = doc.get("policy_area", "")
        
        source_info = f"{state} - {bill_type} {bill_number} ({session})".strip()
        if policy_area:
            source_info += f" | Policy Area: {policy_area}"
        
        context_parts.append(f"Document {i} (Title: {source_title} | Source: {source_info}):\n{chunk_text}\n")
        
    if not context_parts:
        context_parts.append("No retrieved documents were provided.")

    context_str = "\n".join(context_parts)
    notes_str = "\n".join(f"- {note}" for note in reasoning_notes) if reasoning_notes else "None"
    retrieval_mode = "chat-context-only" if retrieval_skipped else "document-grounded"

    return (
        f"Answer mode: {retrieval_mode}\n\n"
        f"Prior chat context:\n{_format_chat_history(chat_history)}\n\n"
        f"Reasoning notes:\n{notes_str}\n\n"
        f"Relevant documents:\n\n{context_str}\n\n"
        f"Question: {query}"
    )
