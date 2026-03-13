from __future__ import annotations

from pathlib import Path
import sys

from fastapi.testclient import TestClient

ORCH_DIR = Path(__file__).resolve().parents[1] / "backend" / "orchestrator"
sys.path.insert(0, str(ORCH_DIR))

import main as orchestrator_main  # noqa: E402


class DummyGraph:
    async def ainvoke(self, _state):
        return {
            "answer": "Test answer",
            "model_used": "test-model",
            "provider_used": "test-provider",
            "documents": [
                {
                    "doc_id": "doc_1",
                    "bill_id": "118-hr-12",
                    "bill_type": "hr",
                    "bill_number": "12",
                    "congress": "118",
                    "title": "Test Bill",
                    "chunk_text": "Test chunk",
                }
            ],
        }


def _reset_store():
    orchestrator_main.RUN_STORE.clear()
    orchestrator_main.SOURCE_STORE.clear()
    orchestrator_main.query_cache.clear()


def test_create_run_and_get_run(monkeypatch):
    _reset_store()
    monkeypatch.setattr(orchestrator_main, "graph_app", DummyGraph())

    client = TestClient(orchestrator_main.app)
    resp = client.post("/api/runs", json={"query": "What is GDPR?"})
    assert resp.status_code == 201
    run_id = resp.json()["runId"]

    get_resp = client.get(f"/api/runs/{run_id}")
    assert get_resp.status_code == 200
    body = get_resp.json()
    assert body["answer"] == "Test answer"
    assert body["provider_used"] == "test-provider"
    assert body["documents"][0]["url"].startswith("https://www.congress.gov/")


def test_get_run_not_found():
    _reset_store()
    client = TestClient(orchestrator_main.app)
    resp = client.get("/api/runs/run_missing")
    assert resp.status_code == 404


def test_get_source_resolves_url(monkeypatch):
    _reset_store()
    monkeypatch.setattr(orchestrator_main, "graph_app", DummyGraph())

    client = TestClient(orchestrator_main.app)
    resp = client.post("/api/runs", json={"query": "What is GDPR?"})
    run_id = resp.json()["runId"]

    run = client.get(f"/api/runs/{run_id}").json()
    source_id = run["documents"][0]["id"]

    source_resp = client.get(f"/api/sources/{source_id}")
    assert source_resp.status_code == 200
    assert source_resp.json()["url"].startswith("https://www.congress.gov/")


def test_stats_endpoint(monkeypatch):
    _reset_store()

    class DummyRetriever:
        def get_index_stats(self):
            return {"ok": True}

    monkeypatch.setattr(orchestrator_main, "SemanticRetriever", DummyRetriever)

    client = TestClient(orchestrator_main.app)
    resp = client.get("/api/stats")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
