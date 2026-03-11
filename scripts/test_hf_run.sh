#!/usr/bin/env bash
set -euo pipefail

HF_URL="${1:-http://localhost:8002}"
MODEL="${HF_MODEL:-openai/gpt-oss-20b}"

payload=$(cat <<'JSON'
{
  "repoId": "__MODEL__",
  "capability": "text-generation",
  "inputs": "Say 'ok' in one short sentence.",
  "params": {
    "max_new_tokens": 32,
    "temperature": 0.1
  }
}
JSON
)

payload="${payload/__MODEL__/$MODEL}"

curl -s -X POST "${HF_URL}/run" \
  -H "Content-Type: application/json" \
  -d "${payload}"
