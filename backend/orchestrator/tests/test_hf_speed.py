import asyncio
import time
from orchestrator.services.hf_client import HuggingFaceLLMClient

async def main():
    hf_client = HuggingFaceLLMClient()

    system_prompt = "You are a helpful legal assistant"
    user_prompt = "Define 'contract' in simple legal terms"

    # measure
    start_time = time.perf_counter()

    response = await hf_client.generate(
        system_prompt = system_prompt,
        user_prompt = user_prompt,
        temperature=0.1,
        max_tokens=50,
    )

    #measure
    end_time = time.perf_counter()
    elapsed_time = end_time - start_time

    print("Generated Text:\n", response.content)
    print(f"\nModel: {response.model}")
    print(f"Provider: {response.provider}")
    print(f"Response Time: {elapsed_time:.3f} seconds")

if __name__ == "__main__":
    asyncio.run(main())