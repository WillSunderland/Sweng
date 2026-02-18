import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/AIagentPage.css';

interface Message {
  id: number;
  type: 'user' | 'assistant' | 'error';
  text: string;
  time: string;
  runId?: string;        // shown as a small badge under the message
  routedTo?: string;     // 'nvidia' | 'huggingface' — shown as a badge
}

interface ContextCase {
  icon: string;
  label: string;
  status: 'review-needed' | 'processing' | 'completed' | 'draft';
  statusLabel: string;
}

// Shape returned by GET /api/runs/{runId} in orchestrator/main.py
interface RunResult {
  runId: string;
  status: string;         // "running" | "completed"
  title: string;
  agentCommentary: {
    aiGenerated: boolean;
    content: string;
    suggestedActions: string[];
  };
  keyFinding?: {
    summary: string;
    impactLevel: string;
    actionRequired: boolean;
  };
  reasoningPath?: {
    engine: string;
    steps: unknown[];
    trustScore: number;
    carbonTotalG: number;
  };
}

// ─── Config ───────────────────────────────────────────────────────────────────

// Set REACT_APP_ORCHESTRATOR_URL in your .env file
// e.g. REACT_APP_ORCHESTRATOR_URL=http://localhost:8000
// This points at the FastAPI server in orchestrator/main.py
const BASE_URL ='http://localhost:8000';

const POLL_INTERVAL_MS = 1500;   // how often to poll for run completion
const POLL_TIMEOUT_MS  = 60000;  // give up after 60 s

// ─── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS: string[] = [
  'Summarize all active cases with review needed',
  'What are the key risks in the Commercial Tenancies case?',
  'Draft a brief on EU Data Protection compliance',
  'Compare IP audit findings with industry standards',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const now = (): string =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * POST /api/runs
 * Body: { query: string }
 * Returns: { runId, status, createdAt }
 *
 * Defined in orchestrator/main.py → create_run()
 */
async function createRun(query: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Failed to start run (${res.status}): ${detail}`);
  }

  const data = await res.json();
  return data.runId as string;
}

/**
 * GET /api/runs/{runId}
 * Polls every POLL_INTERVAL_MS until status === "completed".
 *
 * Defined in orchestrator/main.py → get_run()
 * The graph that generates the result lives in orchestrator/graph.py:
 *   rewrite → retrieve → generate
 * Routing between Nvidia (complex) and HuggingFace (simple) is handled
 * by app/graph/nodes_llm.py → routerNode, per the validation script.
 */
async function pollRun(runId: string): Promise<RunResult> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const res = await fetch(`${BASE_URL}/api/runs/${runId}`);

    if (!res.ok) {
      throw new Error(`Failed to fetch run ${runId} (${res.status})`);
    }

    const data: RunResult = await res.json();
    if (data.status === 'completed') return data;

    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error('The AI took too long to respond. Please try again.');
}

/**
 * Pull a readable answer out of the run result.
 * Priority:
 *   1. agentCommentary.content  (set by graph generate node)
 *   2. keyFinding.summary       (fallback)
 *   3. Generic fallback
 */
function extractAnswer(run: RunResult): string {
  const raw = run.agentCommentary?.content?.trim();

  if (raw && raw !== 'No result yet') {
    // Graph currently returns raw state dict string, e.g.:
    // "Graph Result: {'messages': ['Final answer based on context'], 'query': 'Rewritten: hi', ...}"
    // Extract the messages array content until the generate node returns real LLM output.
    const messagesMatch = raw.match(/'messages':\s*\[([^\]]+)\]/);
    if (messagesMatch) {
      const cleaned = messagesMatch[1]
        .replace(/'/g, '')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)
        .join(' ');
      if (cleaned) return cleaned;
    }
    // Strip "Graph Result:" prefix if present
    if (raw.startsWith('Graph Result:')) {
      return raw.replace('Graph Result:', '').trim();
    }
    return raw;
  }

  const finding = run.keyFinding?.summary?.trim();
  if (finding) return finding;

  return 'The analysis completed but did not produce a readable response. Please try again.';
}

/**
 * Rough heuristic matching what routerNode does in nodes_llm.py:
 *   complex keywords  → nvidia
 *   otherwise         → huggingface
 * This is only used to show an informational badge — the actual routing
 * happens server-side.
 */
function guessRoute(query: string): 'nvidia' | 'huggingface' {
  const complexKeywords = ['compare', 'analyse', 'analyze', 'draft', 'summarize', 'cross-reference'];
  const lower = query.toLowerCase();
  return complexKeywords.some((k) => lower.includes(k)) ? 'nvidia' : 'huggingface';
}

// ─── Component ────────────────────────────────────────────────────────────────

const AIagentPage: React.FC = () => {
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: 'assistant',
      text: "Hello, I'm your AI Legal Assistant. How can I help you today?",
      time: now(),
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(
    async (text?: string): Promise<void> => {
      const messageText = (text ?? input).trim();
      if (!messageText || isTyping) return;

      // Append user message immediately so the UI feels responsive
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), type: 'user', text: messageText, time: now() },
      ]);
      setInput('');
      setIsTyping(true);

      try {
        // Step 1 — POST /api/runs to kick off the LangGraph pipeline
        const runId = await createRun(messageText);

        // Step 2 — Poll GET /api/runs/{runId} until the graph finishes
        //           Graph: rewrite → retrieve → generate (orchestrator/graph.py)
        //           LLM routing: routerNode in app/graph/nodes_llm.py
        const run = await pollRun(runId);

        // Step 3 — Extract the answer from agentCommentary.content
        const answer = extractAnswer(run);
        const routedTo = guessRoute(messageText); // informational only

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            type: 'assistant',
            text: answer,
            time: now(),
            runId,
            routedTo,
          },
        ]);
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error ? err.message : 'An unexpected error occurred.';
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            type: 'error',
            text: `⚠ ${errorMsg}`,
            time: now(),
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [input, isTyping],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const contextCases: ContextCase[] = [
    { icon: '📋', label: 'Commercial Tenancies Review',  status: 'review-needed', statusLabel: 'REVIEW'     },
    { icon: '🔄', label: 'Data Protection Bill Analysis', status: 'processing',    statusLabel: 'PROCESSING' },
  ];

  return (
    <div className="ai-agent-page">
      {/* Header */}
      <header className="ai-agent-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          Back to Workspace
        </button>
      </header>

      {/* Body */}
      <div className="ai-agent-body">

        {/* Context Panel */}
        <aside className="context-panel">
          <div className="context-section">
            <h3 className="context-label">ACTIVE CONTEXT</h3>
            <div className="context-items">
              {contextCases.map((item, i) => (
                <div key={i} className="context-item">
                  <span className="context-item-icon">{item.icon}</span>
                  <span className="context-item-label">{item.label}</span>
                  <span className={`context-item-status status-${item.status}`}>
                    {item.statusLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="context-section">
            <h3 className="context-label">SUGGESTED PROMPTS</h3>
            <div className="suggested-prompts">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  className="suggested-btn"
                  onClick={() => handleSend(prompt)}
                  disabled={isTyping}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Chat Area */}
        <main className="chat-area">
          <div className="messages-list">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`message-row ${msg.type === 'error' ? 'assistant' : msg.type}`}
              >
                <div className={`message-bubble ${msg.type}`}>
                  {msg.text}
                </div>

                {/* Metadata row: timestamp + optional badges */}
                <div className="message-meta">
                  <span className="message-time">{msg.time}</span>

                  {msg.routedTo && (
                    <span className={`route-badge route-${msg.routedTo}`}>
                      {msg.routedTo === 'nvidia' ? '⚡ Nvidia' : '🤗 HuggingFace'}
                    </span>
                  )}

                  {msg.runId && (
                    <span className="run-id-badge" title="Orchestrator run ID">
                      {msg.runId.slice(0, 18)}…
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="message-row assistant">
                <div className="message-bubble assistant typing-bubble">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="input-area">
            <div className="input-wrapper">
              <textarea
                ref={inputRef}
                className="message-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your AI assistant..."
                disabled={isTyping}
              />
              <button
                className={`send-btn ${input.trim() && !isTyping ? 'active' : ''}`}
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
              >
                {isTyping ? 'Thinking…' : 'Send'}
              </button>
            </div>
            <p className="input-hint">
              Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line
            </p>
          </div>
        </main>

      </div>
    </div>
  );
};

export default AIagentPage;