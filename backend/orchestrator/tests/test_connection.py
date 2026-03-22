import httpx
import pytest


@pytest.mark.anyio
async def test_health_endpoint():
    async with httpx.AsyncClient() as client:
        r = await client.get("http://localhost:8002/health")
        assert r.status_code == 200
