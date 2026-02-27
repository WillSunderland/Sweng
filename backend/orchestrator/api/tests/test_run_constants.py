"""
Unit tests for backend/orchestrator/api/constants/runConstants.py

These tests are intentionally dependency-free (no Django, no DRF, no DB)
so they run cleanly in the CI pipeline with only pytest installed.
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))

from backend.orchestrator.api.constants.runConstants import (
    RUN_STATUS_RUNNING,
    RUN_STATUS_COMPLETED,
    DEFAULT_TRUST_SCORE,
    DEFAULT_CARBON_G,
)


class TestRunStatusConstants:
    def test_run_status_running_is_string(self):
        assert isinstance(RUN_STATUS_RUNNING, str)

    def test_run_status_completed_is_string(self):
        assert isinstance(RUN_STATUS_COMPLETED, str)

    def test_run_status_running_value(self):
        assert RUN_STATUS_RUNNING == "running"

    def test_run_status_completed_value(self):
        assert RUN_STATUS_COMPLETED == "completed"

    def test_statuses_are_distinct(self):
        assert RUN_STATUS_RUNNING != RUN_STATUS_COMPLETED


class TestDefaultNumericConstants:
    def test_default_trust_score_is_numeric(self):
        assert isinstance(DEFAULT_TRUST_SCORE, (int, float))

    def test_default_carbon_g_is_numeric(self):
        assert isinstance(DEFAULT_CARBON_G, (int, float))

    def test_default_trust_score_valid_percentage(self):
        assert 0.0 <= DEFAULT_TRUST_SCORE <= 100.0

    def test_default_carbon_g_non_negative(self):
        assert DEFAULT_CARBON_G >= 0.0

    def test_default_trust_score_value(self):
        assert DEFAULT_TRUST_SCORE == 95.0

    def test_default_carbon_g_value(self):
        assert DEFAULT_CARBON_G == 0.0
