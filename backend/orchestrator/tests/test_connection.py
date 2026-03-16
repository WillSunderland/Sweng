import httpx
import asyncio


async def check():
    async with httpx.AsyncClient() as client:
        r = await client.get("http://localhost:8002/health")
        print(r.status_code, r.text)
        print(await r.aread())  # just to see the body
        print(r.json())


asyncio.run(check())
