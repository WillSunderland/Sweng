import pytest
from app.services.carbon_estimator import estimate_carbon_tons, tons_to_grams


def test_estimate_carbon_tons_prefers_model_mapping():
    value = estimate_carbon_tons("openai/gpt-oss-120b", "huggingface")
    assert value == 0.0000006


def test_estimate_carbon_tons_falls_back_to_provider_mapping():
    value = estimate_carbon_tons("unknown-model", "huggingface")
    assert value == 0.0000002


def test_estimate_carbon_tons_uses_default_when_both_unknown():
    value = estimate_carbon_tons("unknown-model", "unknown-provider")
    assert value == 0.0000003


def test_tons_to_grams_conversion():
    assert tons_to_grams(0.0000006) == pytest.approx(0.6)


def test_tons_to_grams_default():
    assert tons_to_grams(0.0000003) == pytest.approx(0.3)
