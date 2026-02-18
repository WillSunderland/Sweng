from typing import List, TypedDict
import logging

from langgraph.graph import StateGraph, END

from config import getSettings
from semantic_retrieval import SemanticRetriever
from prompts.rag_prompt import SYSTEM_PROMPT, build_rag_user_prompt
from services.nvidia_client import NvidiaLLMClient
from services.hf_client import HuggingFaceLLMClient

logger = logging.getLogger(__name__)


class AgentState(TypedDict):
    query: str
    processed_query: str
    documents: List[dict]
    answer: str
    model_used: str
    provider_used: str
    token_count: int
    error: str


settings = getSettings()
retriever = SemanticRetriever(
    es_url=settings.elasticsearch_url,
    index_name=settings.index_name,
    embed_model=settings.embed_model,
    state_code=settings.state_code,
)
nvidia_client = NvidiaLLMClient()
hf_client = HuggingFaceLLMClient()


def query_rewriter(state: AgentState):
    query = state.get("query", "")
    # Placeholder for future query rewriting, keep simple for now.
    return {"processed_query": query}


def retrieve_docs(state: AgentState):
    query = state.get("processed_query") or state.get("query", "")
    try:
        docs = retriever.search(
            query=query,
            top_k=settings.search_k,
            state=settings.state_code,
        )
        return {"documents": docs}
    except Exception as e:
        logger.error("Document retrieval failed: %s", e)
        return {"documents": [], "error": f"Retrieval failed: {e}"}


def _route_provider(query: str, result_count: int) -> str:
    complex_indicators = [
        "compare",
        "vs",
        "versus",
        "difference between",
        "implications",
        "impact",
        "analyze",
        "explain",
        "what if",
        "how does",
        "multiple",
    ]
    lower = query.lower()
    is_complex = any(indicator in lower for indicator in complex_indicators)

    if (
        result_count <= settings.simple_query_threshold
        and result_count > 0
        and not is_complex
    ):
        return "huggingface"
    return "nvidia"


async def generate_answer(state: AgentState):
    query = state.get("processed_query") or state.get("query", "")
    documents = state.get("documents", [])
    error = state.get("error")

    if error:
        return {"answer": f"I encountered an error before generation: {error}"}

    user_prompt = build_rag_user_prompt(query, documents)
    provider = _route_provider(query, len(documents))

    try:
        if provider == "huggingface":
            response = await hf_client.generate(SYSTEM_PROMPT, user_prompt)
        else:
            response = await nvidia_client.generate(SYSTEM_PROMPT, user_prompt)

        return {
            "answer": response.content,
            "model_used": response.model,
            "provider_used": response.provider,
            "token_count": response.total_tokens,
        }
    except Exception as e:
        logger.error("LLM generation failed: %s", e)
        return {"answer": f"LLM generation failed: {e}", "error": str(e)}


workflow = StateGraph(AgentState)
workflow.add_node("rewrite", query_rewriter)
workflow.add_node("retrieve", retrieve_docs)
workflow.add_node("generate", generate_answer)

workflow.set_entry_point("rewrite")
workflow.add_edge("rewrite", "retrieve")
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", END)

app = workflow.compile()
