"""
Unit tests for backend/orchestrator/api/errors/errorMapping.py

These tests are intentionally dependency-free (no Django, no DRF, no DB)
so they run cleanly in the CI pipeline with only pytest installed.
"""

import sys
import os

# Ensure the backend root is on the path when pytest is invoked from the repo root.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))

from backend.orchestrator.api.errors.errorMapping import (
    invalidRequestError,
    runNotFoundError,
    sourceNotFoundError,
)


class TestInvalidRequestError:
    def test_returns_correct_error_code(self):
        result = invalidRequestError({"field": "required"})
        assert result["errorCode"] == "INVALID_REQUEST"

    def test_returns_correct_message(self):
        result = invalidRequestError({})
        assert result["message"] == "Request validation failed"

    def test_embeds_details(self):
        details = {"query": ["This field is required."]}
        result = invalidRequestError(details)
        assert result["details"] == details

    def test_details_can_be_empty_dict(self):
        result = invalidRequestError({})
        assert result["details"] == {}

    def test_result_is_dict(self):
        result = invalidRequestError("bad input")
        assert isinstance(result, dict)


class TestRunNotFoundError:
    def test_returns_correct_error_code(self):
        result = runNotFoundError("run_abc123")
        assert result["errorCode"] == "RUN_NOT_FOUND"

    def test_returns_correct_message(self):
        result = runNotFoundError("run_abc123")
        assert result["message"] == "Run not found"

    def test_embeds_run_id_in_details(self):
        result = runNotFoundError("run_abc123")
        assert result["details"]["runId"] == "run_abc123"

    def test_different_run_ids(self):
        for run_id in ["run_001", "run_xyz", "run_999"]:
            result = runNotFoundError(run_id)
            assert result["details"]["runId"] == run_id

    def test_result_is_dict(self):
        result = runNotFoundError("run_abc123")
        assert isinstance(result, dict)


class TestSourceNotFoundError:
    def test_returns_correct_error_code(self):
        result = sourceNotFoundError("src_001")
        assert result["errorCode"] == "SOURCE_NOT_FOUND"

    def test_returns_correct_message(self):
        result = sourceNotFoundError("src_001")
        assert result["message"] == "Source not found"

    def test_embeds_source_id_in_details(self):
        result = sourceNotFoundError("src_001")
        assert result["details"]["sourceId"] == "src_001"

    def test_different_source_ids(self):
        for src_id in ["src_a", "src_b", "src_999"]:
            result = sourceNotFoundError(src_id)
            assert result["details"]["sourceId"] == src_id

    def test_result_is_dict(self):
        result = sourceNotFoundError("src_001")
        assert isinstance(result, dict)
