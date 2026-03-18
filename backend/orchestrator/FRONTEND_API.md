# Frontend API Reference

This document covers everything the frontend needs to integrate with the orchestrator backend.

## Base URL

```
http://localhost:8000
```

In production this will be the EC2 instance URL.

---

## Endpoints

### POST `/api/runs` — Submit a query

Send a user question to the AI pipeline. The server processes it synchronously and stores the result — use the returned `runId` to fetch the full answer.

**Request**
```json
{
  "query": "What healthcare bills exist in Texas?",
  "session_id": "user-abc-123",
  "max_reasoning_steps": 2
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `query` | string | ✅ | The user's question. Max 1000 chars. |
| `session_id` | string | ❌ | Unique ID per conversation. If provided, the server automatically loads and saves chat history — the frontend does not need to send previous messages. Generate once per conversation (e.g. a UUID) and reuse it for all follow-up turns. |
| `max_reasoning_steps` | int 1–5 | ❌ | How many search iterations the agent runs. Default 2. |

**Response — 201 Created**
```json
{
  "runId": "run_abc123",
  "status": "running",
  "createdAt": "2026-03-17T15:00:00Z"
}
```

> Note: despite `status: "running"`, the run is already complete by the time you receive this response. Fetch the result immediately with GET `/api/runs/{runId}`.

---

### GET `/api/runs/{runId}` — Get run result

Fetch the full result of a completed run.

**Response — 200 OK**
```json
{
  "runId": "run_abc123",
  "status": "completed",
  "title": "Legal Analysis: What healthcare bills exist in Texas?",
  "lastUpdatedAt": "2026-03-17T15:00:00Z",
  "keyFinding": {
    "summary": "The following healthcare bills were identified...",
    "impactLevel": "medium",
    "actionRequired": false
  },
  "statutoryBasis": {
    "analysis": [
      {
        "text": "Full answer text...",
        "citations": ["run_abc123_src_001", "run_abc123_src_002"]
      }
    ]
  },
  "agentCommentary": {
    "aiGenerated": true,
    "content": "Full answer text...",
    "suggestedActions": []
  },
  "reasoningPath": {
    "engine": "langgraph",
    "steps": [
      { "node": "input", "status": "completed", "detail": "Initialized request with 2 prior chat messages." },
      { "node": "rewrite", "status": "completed", "detail": "Rewritten query: ..." },
      { "node": "plan", "status": "completed", "detail": "Planned 3 reasoning steps." },
      { "node": "prefetch_decision", "status": "completed", "detail": "Decision: search." },
      { "node": "search", "status": "completed", "detail": "BM25 fetched 20, MMR selected 10 diverse, cross-encoder ranked to 5 across 4 unique titles." },
      { "node": "read", "status": "completed", "detail": "..." },
      { "node": "answer", "status": "completed", "detail": "Nvidia generated the final answer using 5 retrieved documents." }
    ],
    "trustScore": 85,
    "carbonTotalG": 0.6
  },
  "references": {
    "sourceIds": ["run_abc123_src_001", "run_abc123_src_002"]
  }
}
```

**Key fields to use:**

| Field | What to render |
|-------|---------------|
| `keyFinding.summary` | The main AI answer — render this as markdown in the chat bubble |
| `reasoningPath.steps` | Agent thought process — use for the thought visualisation component (ticket 4.10) |
| `reasoningPath.carbonTotalG` | Carbon cost in grams — display in the green metrics badge |
| `reasoningPath.trustScore` | Trust score 0–100 — display in the trust UI |
| `references.sourceIds` | Use these to call GET `/api/sources/{id}` for clickable citations |

---

### GET `/api/runs` — List all runs

Returns all runs in the current server session (in-memory, resets on restart).

**Response**
```json
{
  "items": [
    {
      "runId": "run_abc123",
      "title": "Analysis for: What healthcare bills exist in Texas?",
      "updatedAt": "2026-03-17T15:00:00Z"
    }
  ]
}
```

---

### GET `/api/sources/{sourceId}` — Get source document

Fetch the full metadata for a cited source document.

**Response**
```json
{
  "sourceId": "run_abc123_src_001",
  "title": "Personalized Care Act of 2023",
  "fullText": {
    "title": "Personalized Care Act of 2023",
    "bill_id": "118-s-2621",
    "state": "TX",
    "bill_type": "S",
    "bill_number": "2621",
    "session": "118",
    "policy_area": "Taxation",
    "source_file": "TX S 2621",
    "relevance_score": 4.91
  }
}
```

Use this when the user clicks a citation link to open the source document panel (ticket 5.12).

---

### GET `/api/sessions/{sessionId}` — Inspect session history

Returns the stored conversation history for a session. Useful for debugging or if you want to display a conversation recap.

**Response**
```json
{
  "session_id": "user-abc-123",
  "history": [
    { "role": "user", "content": "What healthcare bills exist in Texas?" },
    { "role": "assistant", "content": "The following bills were identified..." }
  ],
  "turn_count": 1
}
```

---

### DELETE `/api/sessions/{sessionId}` — Clear session

Call this when the user starts a new conversation or logs out. Clears all stored history for that session.

**Response**
```json
{
  "session_id": "user-abc-123",
  "cleared": true
}
```

---

### GET `/health` — Health check

**Response**
```json
{
  "status": "ok",
  "opensearch": "ok",
  "nvidia_llm": "ok",
  "hf_llm": "ok",
  "version": "0.1.0",
  "isOpensearchConnected": true
}
```

`status` is `"ok"` when both OpenSearch and Nvidia are up. It is `"degraded"` if any service is down but the server is still running.

---

## Multi-Turn Conversation Flow

This is the most important change from the previous API version. The frontend no longer needs to manage or send chat history manually.

```javascript
// Generate a session ID once per conversation
const sessionId = crypto.randomUUID();

// Turn 1
const r1 = await fetch('/api/runs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "What healthcare bills exist in Texas?",
    session_id: sessionId
  })
});
const { runId: runId1 } = await r1.json();
const result1 = await fetch(`/api/runs/${runId1}`).then(r => r.json());
// Display result1.keyFinding.summary

// Turn 2 — server remembers turn 1 automatically
const r2 = await fetch('/api/runs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "Tell me more about the first one",
    session_id: sessionId  // same ID, no history needed
  })
});
const { runId: runId2 } = await r2.json();
const result2 = await fetch(`/api/runs/${runId2}`).then(r => r.json());
// Display result2.keyFinding.summary
// The server will have rewritten "the first one" into the actual bill name

// On logout or new conversation — clear the session
await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
```

---

## Reasoning Steps Reference

The `reasoningPath.steps` array is useful for the agent thought visualisation UI. Each step has a `node`, `status`, and `detail`.

| Node | What it means | What to show the user |
|------|--------------|----------------------|
| `input` | Request received | "Starting analysis..." |
| `rewrite` | Query rewritten for follow-ups | "Understanding your question..." |
| `plan` | Research plan created | "Planning research..." |
| `prefetch_decision` | Decided whether to search or answer from context | "Deciding approach..." |
| `search` | Documents retrieved | "Searching documents..." |
| `read` | Agent reviewed results | "Reading sources..." |
| `answer` | LLM generating response | "Generating answer..." |

If `prefetch_decision` detail contains `"context_only"`, no search was done — the agent answered from conversation history alone.

---

## Error Handling

All endpoints return standard HTTP status codes.

| Code | Meaning |
|------|---------|
| 201 | Run created successfully |
| 200 | OK |
| 404 | Run or session not found |
| 503 | Graph not initialised — server still starting up |
| 500 | Internal error — check `error` field in response |

If the LLM fails, the response still returns 201/200 but `keyFinding.summary` will contain an error message. Always check for an `error` field in the run result.

---

## What Changed From Previous Version

### New: `session_id` on POST `/api/runs`
Previously the frontend had to send the full `chat_history` array with every request. Now just pass a `session_id` string and the server handles everything. Old-style `chat_history` in the request body still works if you prefer the stateless approach.

### New: `/api/sessions/{id}` endpoints
GET and DELETE session endpoints for inspecting or clearing conversation history.

### Improved answer quality
The retrieval pipeline now runs three stages — BM25 keyword search, MMR diversity reranking, and cross-encoder relevance reranking — before passing documents to the LLM. Answers are more relevant and draw from more diverse sources.

### Reasoning steps updated
The `search` step detail now includes retrieval pipeline info:
```
"BM25 fetched 20, MMR selected 10 diverse, cross-encoder ranked to 5 across 4 unique titles."
```
This is safe to display in the thought visualisation component.