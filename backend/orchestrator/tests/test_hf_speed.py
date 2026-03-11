import asyncio
import time

try:
    from orchestrator.services.hf_client import HuggingFaceLLMClient
except ModuleNotFoundError:
    from services.hf_client import HuggingFaceLLMClient


async def main():
    hf_client = HuggingFaceLLMClient()

    # Check HF server health first
    is_healthy = await hf_client.health_check()
    if not is_healthy:
        print(
            "HuggingFace server is NOT healthy. Please check the container and model."
        )
        return
    else:
        print("HuggingFace server is healthy ✅")

    system_prompt = "You are a helpful legal assistant"
    user_prompt = "Define 'contract' in simple legal terms"

    # Measure response time
    start_time = time.perf_counter()

    response = await hf_client.generate(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.1,
        max_tokens=50,
    )

    end_time = time.perf_counter()
    elapsed_time = end_time - start_time

    print("\nGenerated Text:\n", response.content)
    print(f"\nModel: {response.model}")
    print(f"Provider: {response.provider}")
    print(f"Response Time: {elapsed_time:.3f} seconds")


if __name__ == "__main__":
    asyncio.run(main())
