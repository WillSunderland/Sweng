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
        documents: List of document dicts with keys 'title', 'content', 'source_file'
        
    Returns:
        The formatted user prompt string
    """
    context_parts = []
    
    for i, doc in enumerate(documents, 1):
        source_title = doc.get("title", "Unknown Source")
        content = doc.get("content", "").strip()
        
        context_parts.append(f"Document {i} (Title: {source_title}):\n{content}\n")
        
    context_str = "\n".join(context_parts)
    
    return (
        f"Here are the relevant documents:\n\n"
        f"{context_str}\n\n"
        f"Question: {query}"
    )
