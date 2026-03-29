from app.services.carbon_estimator import estimate_carbon_tons, tons_to_grams


def test_estimate_carbon_tons_prefers_model_mapping():
    value = estimate_carbon_tons("openai/gpt-oss-120b", "huggingface")
    assert value == 0.0000006


def test_estimate_carbon_tons_falls_back_to_provider_mapping():
    value = estimate_carbon_tons("unknown-model", "huggingface")
    assert value == 0.0000002


def test_tons_to_grams_conversion():
    assert tons_to_grams(0.0000006) == 0.6
