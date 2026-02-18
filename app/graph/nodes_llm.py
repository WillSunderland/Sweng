from __future__ import annotations

import logging
from typing import Any

from app.config import getSettings
from app.graph.state import GraphState
from app.prompts.rag_prompt import SYSTEM_PROMPT, build_rag_user_prompt
from app.services.nvidia_client import NvidiaLLMClient
from app.services.hf_client import HuggingFaceLLMClient

logger = logging.getLogger(__name__)

# Module-level clients
nvidia_client = NvidiaLLMClient()
hf_client = HuggingFaceLLMClient()
settings = getSettings()


def routerNode(state: GraphState) -> dict[str, Any]:
    """Decides which LLM provider to use based on query complexity."""
    if state.get("error"):
        logger.warning("Upstream error detected, routing to Nvidia for robust handling")
        return {"route_decision": "nvidia"}

    query = state.get("processedQuery", "").lower()
    results = state.get("searchResults", [])
    
    # Complex query indicators
    complex_indicators = [
        "compare", "vs", "versus", "difference between", 
        "implications", "impact", "analyze", "explain", 
        "what if", "how does", "multiple"
    ]
    
    is_complex = any(indicator in query for indicator in complex_indicators)
    result_count = len(results)
    
    # Routing logic
    if (result_count <= settings.simple_query_threshold 
        and result_count > 0 
        and not is_complex):
        decision = "huggingface"
    else:
        decision = "nvidia"
        
    logger.info(f"Router decision: {decision} (complex={is_complex}, results={result_count})")
    return {"route_decision": decision}


async def nvidiaLlmNode(state: GraphState) -> dict[str, Any]:
    """Calls Nvidia LLM, falls back to HuggingFace on failure."""
    query = state.get("query", "")
    documents = [hit.get("_source", {}) for hit in state.get("searchResults", [])]
    
    user_prompt = build_rag_user_prompt(query, documents)
    
    try:
        response = await nvidia_client.generate(SYSTEM_PROMPT, user_prompt)
        return {
            "llm_response": response.content,
            "model_used": response.model,
            "provider_used": response.provider,
            "token_count": response.total_tokens
        }
    except Exception as e:
        logger.error(f"Nvidia node failed: {e}. Falling back to HuggingFace.")
        # Fallback to HF
        return await hfLlmNode(state)


async def hfLlmNode(state: GraphState) -> dict[str, Any]:
    """Calls local HuggingFace LLM."""
    query = state.get("query", "")
    documents = [hit.get("_source", {}) for hit in state.get("searchResults", [])]
    
    user_prompt = build_rag_user_prompt(query, documents)
    
    try:
        response = await hf_client.generate(SYSTEM_PROMPT, user_prompt)
        return {
            "llm_response": response.content,
            "model_used": response.model,
            "provider_used": response.provider,
            "token_count": response.total_tokens
        }
    except Exception as e:
        logger.error(f"HuggingFace node failed: {e}")
        return {"error": f"LLM generation failed: {str(e)}"}
