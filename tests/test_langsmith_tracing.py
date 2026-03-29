"""Unit tests for the LangSmith tracing module (backend/orchestrator/langsmith_tracing.py)."""

from __future__ import annotations

import os
import time
from unittest.mock import patch, MagicMock

import pytest

from backend.orchestrator.langsmith_tracing import (
    configure_langsmith_tracing,
    is_tracing_enabled,
    get_langsmith_client,
    trace_node,
    build_trace_metadata,
    create_traced_run_config,
    _tracing_enabled,
)
import backend.orchestrator.langsmith_tracing as tracing_mod


# ---------------------------------------------------------------------------
# configure_langsmith_tracing
# ---------------------------------------------------------------------------

class TestConfigureLangsmithTracing:
    """Tests for configure_langsmith_tracing()."""

    def teardown_method(self):
        """Reset module state and clean env vars after each test."""
        tracing_mod._tracing_enabled = False
        for key in [
            "LANGCHAIN_TRACING_V2",
            "LANGCHAIN_ENDPOINT",
            "LANGCHAIN_API_KEY",
            "LANGCHAIN_PROJECT",
        ]:
            os.environ.pop(key, None)

    def test_disabled_when_tracing_v2_false(self):
        result = configure_langsmith_tracing(
            tracing_v2=False, api_key="some-key"
        )
        assert result is False
        assert is_tracing_enabled() is False
        assert "LANGCHAIN_TRACING_V2" not in os.environ

    def test_disabled_when_api_key_empty(self):
        result = configure_langsmith_tracing(
            tracing_v2=True, api_key=""
        )
        assert result is False
        assert is_tracing_enabled() is False

    def test_disabled_when_both_missing(self):
        result = configure_langsmith_tracing(
            tracing_v2=False, api_key=""
        )
        assert result is False
        assert is_tracing_enabled() is False

    def test_enabled_sets_env_vars(self):
        result = configure_langsmith_tracing(
            tracing_v2=True,
            endpoint="https://custom.endpoint.com",
            api_key="lsv2-test-key-123",
            project="test-project",
        )
        assert result is True
        assert is_tracing_enabled() is True
        assert os.environ["LANGCHAIN_TRACING_V2"] == "true"
        assert os.environ["LANGCHAIN_ENDPOINT"] == "https://custom.endpoint.com"
        assert os.environ["LANGCHAIN_API_KEY"] == "lsv2-test-key-123"
        assert os.environ["LANGCHAIN_PROJECT"] == "test-project"

    def test_uses_default_endpoint_and_project(self):
        result = configure_langsmith_tracing(
            tracing_v2=True, api_key="lsv2-key"
        )
        assert result is True
        assert os.environ["LANGCHAIN_ENDPOINT"] == "https://api.smith.langchain.com"
        assert os.environ["LANGCHAIN_PROJECT"] == "propylon-sweng-group16"

    def test_can_toggle_off_after_enabling(self):
        configure_langsmith_tracing(tracing_v2=True, api_key="lsv2-key")
        assert is_tracing_enabled() is True

        configure_langsmith_tracing(tracing_v2=False, api_key="lsv2-key")
        assert is_tracing_enabled() is False


# ---------------------------------------------------------------------------
# is_tracing_enabled
# ---------------------------------------------------------------------------

class TestIsTracingEnabled:
    def teardown_method(self):
        tracing_mod._tracing_enabled = False

    def test_false_by_default(self):
        assert is_tracing_enabled() is False

    def test_true_after_configure(self):
        tracing_mod._tracing_enabled = True
        assert is_tracing_enabled() is True


# ---------------------------------------------------------------------------
# get_langsmith_client
# ---------------------------------------------------------------------------

class TestGetLangsmithClient:
    def teardown_method(self):
        tracing_mod._tracing_enabled = False
        for key in ["LANGCHAIN_TRACING_V2", "LANGCHAIN_ENDPOINT",
                     "LANGCHAIN_API_KEY", "LANGCHAIN_PROJECT"]:
            os.environ.pop(key, None)

    def test_returns_none_when_disabled(self):
        tracing_mod._tracing_enabled = False
        assert get_langsmith_client() is None

    def test_returns_client_when_enabled(self):
        tracing_mod._tracing_enabled = True
        mock_client_cls = MagicMock()
        mock_instance = MagicMock()
        mock_client_cls.return_value = mock_instance
        mock_langsmith = MagicMock(Client=mock_client_cls)
        with patch.dict("sys.modules", {"langsmith": mock_langsmith}):
            client = get_langsmith_client()
            assert client is not None
            mock_client_cls.assert_called_once()

    def test_returns_none_on_exception(self):
        tracing_mod._tracing_enabled = True
        with patch(
            "backend.orchestrator.langsmith_tracing.get_langsmith_client",
            wraps=get_langsmith_client,
        ):
            # Simulate import failure
            import sys
            original = sys.modules.get("langsmith")
            sys.modules["langsmith"] = None  # type: ignore[assignment]
            try:
                result = get_langsmith_client()
                # Should gracefully return None
                assert result is None
            finally:
                if original is not None:
                    sys.modules["langsmith"] = original
                else:
                    sys.modules.pop("langsmith", None)


# ---------------------------------------------------------------------------
# trace_node
# ---------------------------------------------------------------------------

class TestTraceNode:
    def teardown_method(self):
        tracing_mod._tracing_enabled = False

    def test_measures_latency(self):
        with trace_node("test_node") as meta:
            time.sleep(0.01)  # 10ms

        assert "latency_ms" in meta
        assert meta["latency_ms"] >= 5  # at least a few ms
        assert meta["node"] == "test_node"

    def test_stores_custom_metadata(self):
        with trace_node("gen_node", {"query": "test"}) as meta:
            meta["token_count"] = 42
            meta["model"] = "gpt-oss-120b"

        assert meta["token_count"] == 42
        assert meta["model"] == "gpt-oss-120b"
        assert meta["inputs"] == {"query": "test"}

    def test_latency_captured_even_on_exception(self):
        meta_ref = None
        with pytest.raises(ValueError):
            with trace_node("failing_node") as meta:
                meta_ref = meta
                raise ValueError("boom")

        assert meta_ref is not None
        assert "latency_ms" in meta_ref

    def test_tracing_disabled_still_works(self):
        tracing_mod._tracing_enabled = False
        with trace_node("quiet_node") as meta:
            meta["result"] = "ok"

        assert meta["result"] == "ok"
        assert "latency_ms" in meta

    def test_tracing_enabled_logs_debug(self):
        tracing_mod._tracing_enabled = True
        with patch("backend.orchestrator.langsmith_tracing.logger") as mock_logger:
            with trace_node("logged_node") as meta:
                pass
            mock_logger.debug.assert_called_once()


# ---------------------------------------------------------------------------
# build_trace_metadata
# ---------------------------------------------------------------------------

class TestBuildTraceMetadata:
    def test_basic_metadata(self):
        state = {
            "query": "What is HB 101?",
            "model_used": "gpt-oss-120b",
            "provider_used": "nvidia",
            "token_count": 150,
        }
        result = build_trace_metadata(state, "nvidiaLlmNode")

        assert result["node"] == "nvidiaLlmNode"
        assert result["query"] == "What is HB 101?"
        assert result["model_used"] == "gpt-oss-120b"
        assert result["provider_used"] == "nvidia"
        assert result["token_count"] == 150

    def test_with_extras(self):
        state = {"query": "test"}
        result = build_trace_metadata(
            state, "retrieve", extras={"doc_count": 5, "latency_ms": 123.4}
        )
        assert result["doc_count"] == 5
        assert result["latency_ms"] == 123.4

    def test_handles_empty_state(self):
        result = build_trace_metadata({}, "empty_node")
        assert result["query"] == ""
        assert result["model_used"] is None
        assert result["provider_used"] is None
        assert result["token_count"] == 0

    def test_extras_override_base(self):
        state = {"query": "original", "token_count": 10}
        result = build_trace_metadata(
            state, "node", extras={"token_count": 999}
        )
        assert result["token_count"] == 999


# ---------------------------------------------------------------------------
# create_traced_run_config
# ---------------------------------------------------------------------------

class TestCreateTracedRunConfig:
    def teardown_method(self):
        tracing_mod._tracing_enabled = False
        for key in ["LANGCHAIN_TRACING_V2", "LANGCHAIN_ENDPOINT",
                     "LANGCHAIN_API_KEY", "LANGCHAIN_PROJECT"]:
            os.environ.pop(key, None)

    def test_minimal_config_when_disabled(self):
        tracing_mod._tracing_enabled = False
        config = create_traced_run_config("test-run")

        assert config["run_name"] == "test-run"
        assert config["metadata"] == {}
        assert "callbacks" not in config

    def test_includes_metadata(self):
        config = create_traced_run_config(
            "run-with-meta", metadata={"query": "test", "run_id": "abc"}
        )
        assert config["metadata"]["query"] == "test"
        assert config["metadata"]["run_id"] == "abc"

    def test_attaches_callbacks_when_enabled(self):
        tracing_mod._tracing_enabled = True
        os.environ["LANGCHAIN_PROJECT"] = "test-project"

        mock_tracer = MagicMock()
        with patch(
            "backend.orchestrator.langsmith_tracing.LangChainTracer",
            return_value=mock_tracer,
            create=True,
        ) as MockTracer:
            # Need to patch the import
            import importlib
            with patch.dict("sys.modules", {
                "langchain_core": MagicMock(),
                "langchain_core.tracers": MagicMock(LangChainTracer=MockTracer),
            }):
                config = create_traced_run_config("traced-run")
                assert "callbacks" in config
                assert len(config["callbacks"]) == 1

    def test_no_callbacks_on_import_error(self):
        tracing_mod._tracing_enabled = True
        import sys
        original = sys.modules.get("langchain_core")
        original_tracers = sys.modules.get("langchain_core.tracers")
        sys.modules["langchain_core"] = None  # type: ignore[assignment]
        sys.modules["langchain_core.tracers"] = None  # type: ignore[assignment]
        try:
            config = create_traced_run_config("no-tracer-run")
            assert "callbacks" not in config
        finally:
            if original is not None:
                sys.modules["langchain_core"] = original
            else:
                sys.modules.pop("langchain_core", None)
            if original_tracers is not None:
                sys.modules["langchain_core.tracers"] = original_tracers
            else:
                sys.modules.pop("langchain_core.tracers", None)


# ---------------------------------------------------------------------------
# Integration-style: config from Settings
# ---------------------------------------------------------------------------

class TestConfigFromSettings:
    """Verify that the orchestrator Settings class includes LangSmith fields."""

    def teardown_method(self):
        tracing_mod._tracing_enabled = False
        for key in ["LANGCHAIN_TRACING_V2", "LANGCHAIN_ENDPOINT",
                     "LANGCHAIN_API_KEY", "LANGCHAIN_PROJECT"]:
            os.environ.pop(key, None)

    def test_settings_has_langsmith_fields(self):
        from backend.orchestrator.config import Settings

        s = Settings(
            langchain_tracing_v2=True,
            langchain_api_key="lsv2-test",
            langchain_project="my-project",
        )
        assert s.langchain_tracing_v2 is True
        assert s.langchain_api_key == "lsv2-test"
        assert s.langchain_project == "my-project"
        assert s.langchain_endpoint == "https://api.smith.langchain.com"

    def test_settings_feeds_configure(self):
        from backend.orchestrator.config import Settings

        s = Settings(
            langchain_tracing_v2=True,
            langchain_api_key="lsv2-integration-test",
            langchain_project="integration-proj",
        )
        result = configure_langsmith_tracing(
            tracing_v2=s.langchain_tracing_v2,
            endpoint=s.langchain_endpoint,
            api_key=s.langchain_api_key,
            project=s.langchain_project,
        )
        assert result is True
        assert os.environ["LANGCHAIN_PROJECT"] == "integration-proj"
