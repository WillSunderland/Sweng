import httpx
import pytest
import os


@pytest.mark.anyio
@pytest.mark.skipif(os.getenv("CI") == "true", reason="No backend server in CI")
async def test_health_endpoint():
    async with httpx.AsyncClient() as client:
        r = await client.get("http://localhost:8002/health")
        assert r.status_code == 200
