from __future__ import annotations

import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest


def _get_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _wait_for_health(base_url: str, timeout_s: float = 12.0) -> None:
    deadline = time.time() + timeout_s
    last_err: Exception | None = None
    while time.time() < deadline:
        try:
            r = httpx.get(f"{base_url}/health", timeout=1.5)
            if r.status_code == 200:
                return
        except Exception as exc:  # pragma: no cover - timing dependent
            last_err = exc
        time.sleep(0.2)
    if last_err:
        raise RuntimeError(f"Orchestrator health check failed: {last_err}")
    raise RuntimeError("Orchestrator health check failed with no response.")


@pytest.fixture(scope="session")
def orchestrator_base_url():
    orch_dir = Path(__file__).resolve().parents[2] / "backend" / "orchestrator"
    port = _get_free_port()
    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "main:app",
        "--host",
        "127.0.0.1",
        "--port",
        str(port),
        "--log-level",
        "warning",
    ]

    proc = subprocess.Popen(
        cmd,
        cwd=str(orch_dir),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    base_url = f"http://127.0.0.1:{port}"
    try:
        _wait_for_health(base_url)
        yield base_url
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:  # pragma: no cover - safety net
            proc.kill()


@pytest.mark.integration
def test_health_endpoint(orchestrator_base_url: str):
    r = httpx.get(f"{orchestrator_base_url}/health", timeout=2.0)
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


@pytest.mark.integration
def test_runs_list_empty(orchestrator_base_url: str):
    r = httpx.get(f"{orchestrator_base_url}/api/runs", timeout=2.0)
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert isinstance(body["items"], list)


@pytest.mark.integration
def test_run_not_found(orchestrator_base_url: str):
    r = httpx.get(f"{orchestrator_base_url}/api/runs/run_does_not_exist", timeout=2.0)
    assert r.status_code == 404


@pytest.mark.integration
def test_source_not_found(orchestrator_base_url: str):
    r = httpx.get(
        f"{orchestrator_base_url}/api/sources/src_does_not_exist", timeout=2.0
    )
    assert r.status_code == 404
