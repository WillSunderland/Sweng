"""LangSmith tracing integration for the LangGraph RAG pipeline.

Provides utilities to:
- Configure LangSmith tracing via environment variables
- Create traced runs for each graph invocation
- Log per-node metadata (token counts, latency, model, provider)
- Support trace replay and auditability
"""

from __future__ import annotations

import logging
import os
import time
from contextlib import contextmanager
from typing import Any, Generator

logger = logging.getLogger(__name__)

_tracing_enabled: bool = False


def configure_langsmith_tracing(
    *,
    tracing_v2: bool = False,
    endpoint: str = "https://api.smith.langchain.com",
    api_key: str = "",
    project: str = "propylon-sweng-group16",
) -> bool:
    """Set LangSmith environment variables and return whether tracing is active.

    Parameters come from ``backend.orchestrator.config.Settings`` and are
    forwarded here by the application startup code so this module stays
    decoupled from Pydantic.
    """
    global _tracing_enabled

    if not tracing_v2 or not api_key:
        logger.info(
            "LangSmith tracing is disabled (LANGCHAIN_TRACING_V2=%s, API key %s)",
            tracing_v2,
            "set" if api_key else "missing",
        )
        _tracing_enabled = False
        return False

    # LangSmith SDK reads these env vars automatically
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_ENDPOINT"] = endpoint
    os.environ["LANGCHAIN_API_KEY"] = api_key
    os.environ["LANGCHAIN_PROJECT"] = project

    _tracing_enabled = True
    logger.info(
        "LangSmith tracing enabled — project: %s, endpoint: %s",
        project,
        endpoint,
    )
    return True


def is_tracing_enabled() -> bool:
    """Return whether LangSmith tracing is currently active."""
    return _tracing_enabled


def get_langsmith_client():
    """Return a LangSmith ``Client`` instance, or ``None`` if tracing is disabled."""
    if not _tracing_enabled:
        return None
    try:
        from langsmith import Client

        return Client()
    except Exception as exc:
        logger.warning("Failed to create LangSmith client: %s", exc)
        return None


@contextmanager
def trace_node(
    node_name: str, inputs: dict[str, Any] | None = None
) -> Generator[dict[str, Any], None, None]:
    """Context manager that measures wall-clock latency for a graph node.

    Yields a mutable dict where callers can store outputs/metadata.
    After the block, the dict is enriched with ``latency_ms``.

    Usage::

        with trace_node("nvidiaLlmNode", {"query": q}) as meta:
            result = await nvidia_client.generate(...)
            meta["token_count"] = result.total_tokens
        # meta["latency_ms"] is now populated
    """
    meta: dict[str, Any] = {"node": node_name, "inputs": inputs or {}}
    start = time.perf_counter()
    try:
        yield meta
    finally:
        elapsed_ms = (time.perf_counter() - start) * 1000
        meta["latency_ms"] = round(elapsed_ms, 2)
        if _tracing_enabled:
            logger.debug(
                "LangSmith trace — node=%s latency=%.2fms meta=%s",
                node_name,
                elapsed_ms,
                {k: v for k, v in meta.items() if k != "inputs"},
            )


def build_trace_metadata(
    state: dict[str, Any],
    node_name: str,
    extras: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a metadata dict suitable for attaching to a LangSmith run.

    Captures: query, model, provider, token count, and any caller-supplied extras.
    """
    metadata = {
        "node": node_name,
        "query": state.get("query", ""),
        "model_used": state.get("model_used"),
        "provider_used": state.get("provider_used"),
        "token_count": state.get("token_count", 0),
    }
    if extras:
        metadata.update(extras)
    return metadata


def create_traced_run_config(
    run_name: str, metadata: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Build a LangGraph-compatible config dict with LangSmith tracing callbacks.

    If tracing is disabled, returns a minimal config without callbacks so
    the graph still runs normally.
    """
    config: dict[str, Any] = {
        "run_name": run_name,
        "metadata": metadata or {},
    }

    if _tracing_enabled:
        try:
            from langchain_core.tracers import LangChainTracer

            tracer = LangChainTracer(
                project_name=os.environ.get(
                    "LANGCHAIN_PROJECT", "propylon-sweng-group16"
                ),
            )
            config["callbacks"] = [tracer]
        except ImportError:
            logger.warning(
                "langchain_core.tracers not available — tracing callbacks skipped"
            )
        except Exception as exc:
            logger.warning("Failed to attach LangSmith tracer: %s", exc)

    return config
