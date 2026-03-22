import json
import sys
import types
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

# Provide a minimal django.http shim so importing streamViews doesn't require Django.
django_module = types.ModuleType("django")
django_http_module = types.ModuleType("django.http")


class _StreamingHttpResponse:  # pragma: no cover - used only for import-time compatibility
    pass


django_http_module.StreamingHttpResponse = _StreamingHttpResponse
django_module.http = django_http_module
sys.modules.setdefault("django", django_module)
sys.modules.setdefault("django.http", django_http_module)

from backend.orchestrator.api.views import streamViews  # noqa: E402


def _parse_sse(chunks):
    events = []
    for chunk in chunks:
        lines = [line for line in chunk.strip().split("\n") if line]
        assert lines[0].startswith("event: ")
        assert lines[1].startswith("data: ")
        event = lines[0].replace("event: ", "", 1)
        data = json.loads(lines[1].replace("data: ", "", 1))
        events.append((event, data))
    return events


class _FakeGraph:
    def __init__(self, events):
        self._events = events

    async def astream_events(self, initial_state, version="v2"):
        for event in self._events:
            yield event


@pytest.mark.unit
def test_stream_events_emits_states_tokens_and_done():
    fake_events = [
        {"event": "on_chain_start", "name": "inputNode"},
        {"event": "on_chain_start", "name": "searchNode"},
        {"event": "on_chain_start", "name": "llmOutputNode"},
        {
            "event": "on_chain_end",
            "name": "llmOutputNode",
            "data": {"output": {"response": {"answer": "hello world"}}},
        },
    ]

    with patch.object(streamViews, "_get_graph", return_value=_FakeGraph(fake_events)):
        chunks = list(streamViews._stream_events("test query"))

    events = _parse_sse(chunks)

    assert events == [
        ("state", {"state": "thinking"}),
        ("state", {"state": "searching"}),
        ("state", {"state": "answering"}),
        ("token", {"token": "hello"}),
        ("token", {"token": "world"}),
        ("done", {"status": "complete"}),
    ]


@pytest.mark.unit
def test_stream_events_handles_missing_graph():
    with patch.object(streamViews, "_get_graph", return_value=None):
        chunks = list(streamViews._stream_events("test query"))

    events = _parse_sse(chunks)

    assert events == [
        ("error", {"message": "Graph not initialised"}),
        ("done", {"status": "error"}),
    ]
