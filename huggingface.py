from collections import OrderedDict
import os
import threading
import time
import logging
import json
from typing import Any, Dict, List, Optional, Union
from enum import Enum

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from transformers import pipeline
import torch

HF_HOME_DIR = os.path.expanduser(os.environ.get("HF_HOME_DIR", "~/.cache/huggingface"))
os.environ["HF_HOME"] = HF_HOME_DIR

app = FastAPI(
    title="HuggingFace Pipeline API",
    description="""
## Run HuggingFace models via a simple REST API

This API wraps HuggingFace's `transformers.pipeline` and provides:

- **Model caching** - Models stay loaded in memory for fast subsequent requests
- **GPU support** - Automatically uses CUDA if available
- **Multiple capabilities** - Text generation, sentiment analysis, and more
- **Backward-compatible aliases** - Old task names like `summarization` are auto-mapped

### Quick Start

1. Hit `/test` to try text generation with a pre-loaded model
2. Use `/run` for custom models and inputs
3. Check `/health` for service status

### Supported Capabilities

`text-generation` · `text-classification` · `sentiment-analysis` · `question-answering` · `fill-mask` · `ner` · `zero-shot-classification` · `token-classification` · `feature-extraction`

### Backward-Compatible Aliases

`summarization` → `text-generation` · `translation` → `text-generation`
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

MAX_CACHE_ITEMS = int(os.environ.get("MAX_CACHE_ITEMS", "8"))
DEFAULT_TIMEOUT_MS = int(os.environ.get("DEFAULT_TIMEOUT_MS", "30000"))
DEFAULT_TRUST_REMOTE_CODE = os.environ.get(
    "ALLOW_TRUST_REMOTE_CODE", "false"
).lower() in ("1", "true", "yes")
MAX_INPUT_CHARS = int(os.environ.get("MAX_INPUT_CHARS", "10000"))

_runner_cache: OrderedDict[str, Any] = OrderedDict()
_cache_lock = threading.Lock()
_load_locks: Dict[str, threading.Lock] = {}
_load_locks_lock = threading.Lock()

ERRORS = {
    "MODEL_NOT_FOUND": "Model or revision not found",
    "UNSUPPORTED_CAPABILITY": "Requested capability is not supported",
    "SECURITY_POLICY_BLOCKED": "Remote code execution blocked by policy",
    "INFERENCE_ERROR": "Inference failed",
    "INPUT_TOO_LONG": f"Input exceeds maximum length of {MAX_INPUT_CHARS} characters",
    "OUT_OF_MEMORY": "Model ran out of memory - try shorter input or smaller model",
}

logger = logging.getLogger("hf_api")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.setLevel(logging.INFO)
    logger.addHandler(handler)


# Aliases for tasks removed/renamed in transformers v5+
TASK_ALIASES = {
    "summarization": "text-generation",
    "translation": "text-generation",
}


def resolve_task(capability: str) -> str:
    """Map old task names to their transformers v5 equivalents."""
    return TASK_ALIASES.get(capability, capability)


class Capability(str, Enum):
    text_generation = "text-generation"
    text_classification = "text-classification"
    sentiment_analysis = "sentiment-analysis"
    question_answering = "question-answering"
    fill_mask = "fill-mask"
    ner = "ner"
    token_classification = "token-classification"
    zero_shot = "zero-shot-classification"
    feature_extraction = "feature-extraction"
    # Legacy aliases (accepted but mapped)
    summarization = "summarization"
    translation = "translation"


class CanonicalRequest(BaseModel):
    repo_id: str = Field(
        ...,
        alias="repoId",
        description="HuggingFace model identifier",
        json_schema_extra={"example": "sshleifer/distilbart-cnn-12-6"},
    )
    capability: str = Field(
        ...,
        description="Pipeline task type",
        json_schema_extra={"example": "summarization"},
    )
    inputs: Union[str, List[str]] = Field(
        ...,
        description="Text input(s) to process",
        json_schema_extra={
            "example": "The tower is 324 metres tall and was built in 1889. It is located in Paris, France."
        },
    )
    params: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional pipeline parameters (max_length, min_length, temperature, etc.)",
        json_schema_extra={"example": {"max_length": 50, "min_length": 10}},
    )
    revision: Optional[str] = Field(
        default=None,
        description="Model revision/branch to use",
    )
    allow_trust_remote_code: bool = Field(
        default=DEFAULT_TRUST_REMOTE_CODE,
        alias="allowTrustRemoteCode",
        description="Allow execution of model's custom code (security risk)",
    )

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "examples": [
                {
                    "repoId": "sshleifer/distilbart-cnn-12-6",
                    "capability": "summarization",
                    "inputs": "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It is named after the engineer Gustave Eiffel, whose company designed and built the tower from 1887 to 1889.",
                    "params": {"max_length": 50, "min_length": 10},
                }
            ]
        },
    }

    @field_validator("repo_id")
    @classmethod
    def repo_id_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("repoId must be provided")
        return v.strip()


def _make_key(capability: str, repo_id: str, revision: Optional[str]) -> str:
    return f"{capability}::{repo_id}::{revision or ''}"


def _validate_input(
    inputs: Union[str, List[str]], truncate: bool = False
) -> Union[str, List[str]]:
    if isinstance(inputs, str):
        if len(inputs) > MAX_INPUT_CHARS:
            if truncate:
                return inputs[:MAX_INPUT_CHARS]
            raise ValueError(ERRORS["INPUT_TOO_LONG"])
        return inputs

    validated = []
    for text in inputs:
        if len(text) > MAX_INPUT_CHARS:
            if truncate:
                validated.append(text[:MAX_INPUT_CHARS])
            else:
                raise ValueError(ERRORS["INPUT_TOO_LONG"])
        else:
            validated.append(text)
    return validated


def _safe_inference(
    runner: Any, inputs: Union[str, List[str]], params: Dict[str, Any]
) -> Any:
    try:
        return runner(inputs, **params)
    except RuntimeError as e:
        if "out of memory" in str(e).lower() or "CUDA" in str(e):
            torch.cuda.empty_cache() if torch.cuda.is_available() else None
            raise RuntimeError(ERRORS["OUT_OF_MEMORY"])
        raise
    except Exception as e:
        if "too long" in str(e).lower() or "maximum" in str(e).lower():
            raise RuntimeError(ERRORS["INPUT_TOO_LONG"])
        raise


def _get_load_lock(key: str) -> threading.Lock:
    with _load_locks_lock:
        if key not in _load_locks:
            _load_locks[key] = threading.Lock()
        return _load_locks[key]


def _evict_oldest() -> None:
    while len(_runner_cache) >= MAX_CACHE_ITEMS:
        evicted_key, _ = _runner_cache.popitem(last=False)
        logger.info(json.dumps({"event": "cache_evict", "key": evicted_key}))


def load_runner(
    capability: str,
    repo_id: str,
    revision: Optional[str],
    allow_trust_remote_code: bool,
) -> tuple[Any, bool]:
    key = _make_key(capability, repo_id, revision)

    with _cache_lock:
        if key in _runner_cache:
            _runner_cache.move_to_end(key)
            logger.info(json.dumps({"event": "cache_hit", "key": key}))
            return _runner_cache[key], True

    load_lock = _get_load_lock(key)

    with load_lock:
        with _cache_lock:
            if key in _runner_cache:
                _runner_cache.move_to_end(key)
                return _runner_cache[key], True

        if allow_trust_remote_code and not DEFAULT_TRUST_REMOTE_CODE:
            raise RuntimeError(ERRORS["SECURITY_POLICY_BLOCKED"])

        device = 0 if torch.cuda.is_available() else -1

        resolved = resolve_task(capability)
        try:
            runner = pipeline(
                resolved,
                model=repo_id,
                revision=revision,
                device=device,
                trust_remote_code=allow_trust_remote_code,
            )
        except ValueError as e:
            logger.info(
                json.dumps({"event": "load_failed", "key": key, "error": str(e)})
            )
            raise RuntimeError(ERRORS["UNSUPPORTED_CAPABILITY"])
        except Exception as e:
            logger.info(
                json.dumps({"event": "load_failed", "key": key, "error": str(e)})
            )
            raise RuntimeError(ERRORS["MODEL_NOT_FOUND"])

        with _cache_lock:
            _evict_oldest()
            _runner_cache[key] = runner
            _runner_cache.move_to_end(key)

        logger.info(
            json.dumps(
                {
                    "event": "load_ok",
                    "key": key,
                    "has_gpu": torch.cuda.is_available(),
                }
            )
        )

        return runner, False


class TestResponse(BaseModel):
    status: str
    model: str
    capability: str
    cache_hit: bool
    latency_ms: int
    has_gpu: bool
    input_text: str
    result: Any


class HealthResponse(BaseModel):
    status: str
    cache_size: int
    max_cache_items: int
    gpu_available: bool


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Status"],
    summary="Check API health",
    description="Returns service status and cache info",
)
async def health():
    with _cache_lock:
        cache_size = len(_runner_cache)
    return {
        "status": "ok",
        "cache_size": cache_size,
        "max_cache_items": MAX_CACHE_ITEMS,
        "gpu_available": torch.cuda.is_available(),
    }


@app.get(
    "/test",
    response_model=TestResponse,
    tags=["Testing"],
    summary="Test text-generation pipeline",
    description="""
Try the API instantly with a pre-configured text generation model.

**Default model**: `gpt2` (small, fast, ~500MB)

Customize the input prompt and generation length using the query parameters below.
First request downloads the model, subsequent requests are fast.
    """,
)
async def test(
    text: str = Query(
        default="The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France.",
        description="Input prompt for text generation",
        min_length=10,
    ),
    model: str = Query(
        default="gpt2",
        description="HuggingFace model ID",
    ),
    max_length: int = Query(
        default=60,
        description="Maximum generation length (tokens)",
        ge=10,
        le=500,
    ),
    truncate: bool = Query(
        default=True,
        description="Truncate input if too long instead of failing",
    ),
):
    start = time.time()

    try:
        text = _validate_input(text, truncate=truncate)

        runner, cache_hit = load_runner(
            capability="text-generation",
            repo_id=model,
            revision=None,
            allow_trust_remote_code=False,
        )

        output = _safe_inference(runner, text, {"max_length": max_length})
        latency_ms = int((time.time() - start) * 1000)

        return {
            "status": "ok",
            "model": model,
            "capability": "text-generation",
            "cache_hit": cache_hit,
            "latency_ms": latency_ms,
            "has_gpu": torch.cuda.is_available(),
            "input_text": text[:100] + "..." if len(text) > 100 else text,
            "result": output,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "status": "error",
                "errorCode": "INPUT_TOO_LONG",
                "message": str(e),
            },
        )
    except RuntimeError as e:
        error_msg = str(e)
        if error_msg == ERRORS["OUT_OF_MEMORY"]:
            raise HTTPException(
                status_code=413,
                detail={
                    "status": "error",
                    "errorCode": "OUT_OF_MEMORY",
                    "message": error_msg,
                },
            )
        raise HTTPException(
            status_code=500, detail={"status": "error", "message": error_msg}
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail={"status": "error", "message": str(e)}
        )


class RunResponse(BaseModel):
    result: Any


@app.post(
    "/run",
    response_model=RunResponse,
    tags=["Inference"],
    summary="Run any HuggingFace pipeline",
    description="""
Execute inference on any HuggingFace model.

### Example Request

```json
{
  "repoId": "sshleifer/distilbart-cnn-12-6",
  "capability": "summarization",
  "inputs": "Your long text here...",
  "params": {"max_length": 100}
}
```

### Popular Models

| Capability | Model | Size |
|------------|-------|------|
| text-generation | `gpt2` | 500MB |
| text-classification | `distilbert-base-uncased-finetuned-sst-2-english` | 250MB |
| sentiment-analysis | `distilbert-base-uncased-finetuned-sst-2-english` | 250MB |
| question-answering | `distilbert-base-cased-distilled-squad` | 250MB |
    """,
)
async def run_request(req: CanonicalRequest):
    start = time.time()
    request_id = f"r-{int(start * 1000)}"

    try:
        validated_inputs = _validate_input(req.inputs, truncate=False)
    except ValueError as e:
        logger.info(
            json.dumps(
                {
                    "request_id": request_id,
                    "repo_id": req.repo_id,
                    "capability": req.capability,
                    "error": str(e),
                    "error_code": "INPUT_TOO_LONG",
                }
            )
        )
        raise HTTPException(
            status_code=400, detail={"errorCode": "INPUT_TOO_LONG", "message": str(e)}
        )

    try:
        runner, cache_hit = load_runner(
            req.capability,
            req.repo_id,
            req.revision,
            req.allow_trust_remote_code,
        )
    except RuntimeError as e:
        error_msg = str(e)
        if error_msg == ERRORS["SECURITY_POLICY_BLOCKED"]:
            error_code = "SECURITY_POLICY_BLOCKED"
        elif error_msg == ERRORS["UNSUPPORTED_CAPABILITY"]:
            error_code = "UNSUPPORTED_CAPABILITY"
        else:
            error_code = "MODEL_NOT_FOUND"

        logger.info(
            json.dumps(
                {
                    "request_id": request_id,
                    "repo_id": req.repo_id,
                    "capability": req.capability,
                    "latency_ms": int((time.time() - start) * 1000),
                    "error": error_msg,
                    "error_code": error_code,
                }
            )
        )
        raise HTTPException(
            status_code=400, detail={"errorCode": error_code, "message": error_msg}
        )

    params = req.params or {}

    try:
        output = _safe_inference(runner, validated_inputs, params)
    except RuntimeError as e:
        error_msg = str(e)
        if error_msg == ERRORS["OUT_OF_MEMORY"]:
            error_code = "OUT_OF_MEMORY"
            status_code = 413
        elif error_msg == ERRORS["INPUT_TOO_LONG"]:
            error_code = "INPUT_TOO_LONG"
            status_code = 400
        else:
            error_code = "INFERENCE_ERROR"
            status_code = 500

        logger.info(
            json.dumps(
                {
                    "request_id": request_id,
                    "repo_id": req.repo_id,
                    "capability": req.capability,
                    "latency_ms": int((time.time() - start) * 1000),
                    "error": error_msg,
                    "error_code": error_code,
                }
            )
        )
        raise HTTPException(
            status_code=status_code,
            detail={"errorCode": error_code, "message": error_msg},
        )
    except Exception as e:
        logger.info(
            json.dumps(
                {
                    "request_id": request_id,
                    "repo_id": req.repo_id,
                    "capability": req.capability,
                    "latency_ms": int((time.time() - start) * 1000),
                    "error": str(e),
                    "error_code": "INFERENCE_ERROR",
                }
            )
        )
        raise HTTPException(
            status_code=500,
            detail={
                "errorCode": "INFERENCE_ERROR",
                "message": ERRORS["INFERENCE_ERROR"],
            },
        )

    latency_ms = int((time.time() - start) * 1000)
    logger.info(
        json.dumps(
            {
                "request_id": request_id,
                "repo_id": req.repo_id,
                "capability": req.capability,
                "latency_ms": latency_ms,
                "cache_hit": cache_hit,
            }
        )
    )

    return {"result": output}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("huggingface:app", host="0.0.0.0", port=8000)
