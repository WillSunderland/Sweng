"""
Ticket 2.5 Validation Script
Verifies both LLM providers are connected and generating responses.
Run: python scripts/validate_llm_connection.py

Requires:
- NVIDIA_API_KEY set in .env or environment
- HuggingFace server running (optional — will skip if unavailable)
"""

import asyncio
import os
import sys
from dotenv import load_dotenv

# Add project root to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import getSettings
from app.services.nvidia_client import NvidiaLLMClient
from app.services.hf_client import HuggingFaceLLMClient
from app.prompts.rag_prompt import build_rag_user_prompt
from app.graph.nodes_llm import routerNode

load_dotenv()

async def main():
    settings = getSettings()
    print(f"Validation Script Settings Loaded: Nvidia Key [{'SET' if settings.nvidia_api_key else 'MISSING'}]")
    
    results = {
        "Nvidia Connection": "FAIL",
        "Nvidia Generation": "FAIL",
        "HF Connection": "FAIL",
        "HF Generation": "FAIL",
        "RAG Prompt": "FAIL",
        "Router Logic": "FAIL"
    }

    # 1. Test Nvidia
    print("\n--- Testing Nvidia API ---")
    try:
        nvidia = NvidiaLLMClient()
        if await nvidia.health_check():
            print("Health Check: PASS")
            results["Nvidia Connection"] = "PASS"
            
            try:
                print("Generating test response...")
                resp = await nvidia.generate("You are a helpful assistant.", "What is 2+2? Answer in one word.")
                print(f"Response: {resp.content}")
                print(f"Model: {resp.model}")
                print(f"Tokens: {resp.total_tokens}")
                results["Nvidia Generation"] = "PASS"
            except Exception as e:
                print(f"Generation Failed: {e}")
        else:
            print("Health Check: FAIL")
    except Exception as e:
        print(f"Nvidia Init Failed: {e}")

    # 2. Test HuggingFace
    print("\n--- Testing HuggingFace Server ---")
    try:
        hf = HuggingFaceLLMClient()
        if await hf.health_check():
            print("Health Check: PASS")
            results["HF Connection"] = "PASS"
            
            try:
                print("Generating test response...")
                resp = await hf.generate("You are a helpful assistant.", "What is 2+2? Answer in one word.")
                print(f"Response: {resp.content}")
                print(f"Model: {resp.model}")
                results["HF Generation"] = "PASS"
            except Exception as e:
                print(f"Generation Failed: {e}")
        else:
            print(f"Health Check: FAIL (Server at {settings.hf_server_url} not reachable)")
            results["HF Connection"] = "SKIP"
            results["HF Generation"] = "SKIP"
    except Exception as e:
        print(f"HF Init Failed: {e}")

    # 3. Test RAG Prompt
    print("\n--- Testing RAG Prompt ---")
    try:
        query = "test query"
        docs = [{
            "title": "Nevada Tax Reform Act",
            "chunk_text": "Section 5: All individuals earning above $80,000...",
            "state": "Nevada",
            "bill_type": "HB",
            "bill_number": "123",
            "session": "2024",
            "policy_area": "Taxation"
        }]
        prompt = build_rag_user_prompt(query, docs)
        if "Nevada Tax Reform Act" in prompt and "Section 5" in prompt and query in prompt:
            print("Prompt Built Successfully")
            results["RAG Prompt"] = "PASS"
        else:
            print(f"Prompt Content Missing or Incorrect:\n{prompt}")
    except Exception as e:
        print(f"Prompt Error: {e}")

    # 4. Test Router
    print("\n--- Testing Router ---")
    try:
        # Simple
        state_simple = {
            "processedQuery": "simple", 
            "searchResults": [{"_id": "1"}], # 1 result
            "error": None
        }
        dec_simple = routerNode(state_simple)
        
        # Complex
        state_complex = {
            "processedQuery": "compare A and B", 
            "searchResults": [{"_id": "1"}],
            "error": None
        }
        dec_complex = routerNode(state_complex)
        
        if dec_simple["route_decision"] == "huggingface" and dec_complex["route_decision"] == "nvidia":
            print("Router Logic: PASS")
            results["Router Logic"] = "PASS"
        else:
            print(f"Router Logic Check Failed: Simple->{dec_simple['route_decision']}, Complex->{dec_complex['route_decision']}")
    except Exception as e:
        print(f"Router Error: {e}")

    # Summary
    print("\n============================================")
    print("TICKET 2.5 VALIDATION RESULTS")
    print("============================================")
    for k, v in results.items():
        print(f"{k:<25}: {v}")
    print("============================================")

if __name__ == "__main__":
    asyncio.run(main())
