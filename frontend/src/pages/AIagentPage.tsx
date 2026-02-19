import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/AIagentPage.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Citation {
  id: string;
  title: string;
  url?: string;
  excerpt?: string;
}

interface ParsedResponse {
  summary: string;
  bullets: string[];
  citations: Citation[];
}

interface Message {
  id: number;
  type: 'user' | 'assistant' | 'error';
  text: string;
  parsed?: ParsedResponse;
  time: string;
  runId?: string;
  routedTo?: string;
}

interface ContextCase {
  icon: string;
  label: string;
  status: 'review-needed' | 'processing' | 'completed' | 'draft';
  statusLabel: string;
}

interface RetrievedDocument {
  id?: string;
  _id?: string;
  doc_id?: string;
  title?: string;
  source?: string;
  url?: string;
  text?: string;
  content?: string;
  chunk_text?: string;
  score?: number;
  bill_id?: string;
  bill_type?: string;
  bill_number?: string;
  state?: string;
  session?: string;
  policy_area?: string;
  latest_action?: string;
  metadata?: {
    title?: string;
    source?: string;
    url?: string;
    [key: string]: unknown;
  };
}

interface RunResult {
  runId: string;
  status: string;
  title?: string;
  answer?: string;
  agentCommentary?: {
    aiGenerated?: boolean;
    content?: string;
    suggestedActions?: string[];
  };
  keyFinding?: {
    summary?: string;
    impactLevel?: string;
    actionRequired?: boolean;
  };
  documents?: RetrievedDocument[];
  model_used?: string;
  provider_used?: string;
  statutoryBasis?: {
    analysis: Array<{ text: string; citations: string[] }>;
  };
  references?: {
    sourceIds: string[];
  };
}

interface SourceDetail {
  sourceId: string;
  title?: string;
  fullText?: string;
  billId?: string;
  state?: string;
  billType?: string;
  billNumber?: string;
  session?: string;
  policyArea?: string;
  latestAction?: string;
  chunkId?: string;
  url?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:8000';
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 60_000;

const SUGGESTED_PROMPTS: string[] = [
  'Summarize all active cases with review needed',
  'What are the key risks in the Commercial Tenancies case?',
  'Draft a brief on EU Data Protection compliance',
  'Compare IP audit findings with industry standards',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nowStr = (): string =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * Aggressively strip ALL inline citation noise and HTML, then decode entities.
 * Handles: [*], [**], [^], [^1], [118-hr-8775_0], (*), (**), (^), "[*][*][^]", etc.
 */
function cleanText(raw: string): string {
  if (!raw) return '';
  return raw
    // Remove HTML tags
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    // Remove ALL bracket groups: [anything] — catches [*], [**], [^], [^1], [id], etc.
    .replace(/\[[^\]]*\]/g, '')
    // Remove parenthetical noise markers: (*), (**), (^), (†), (1), etc.
    .replace(/\([*^†‡§¶\d]+\)/g, '')
    // Remove stray asterisks (1 or more) that remain after bracket removal
    .replace(/\*+/g, '')
    // Remove stray carets
    .replace(/\^+/g, '')
    // Decode HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Collapse multiple punctuation/spaces left behind
    .replace(/\.{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Build a congress.gov URL from a congressional bill ID.
 * Pattern:  {congress}-{type}-{number}  or  {congress}-{type}-{number}_{chunk}
 */
function congressUrl(id: string): string | undefined {
  const base = id.replace(/_\d+$/, '');
  const match = base.match(/^(\d+)-(hr|s|hjres|sjres|hres|sres|hconres|sconres)-(\d+)$/i);
  if (!match) return undefined;

  const [, congress, typeRaw, number] = match;
  const typeMap: Record<string, string> = {
    hr: 'house-bill',
    s: 'senate-bill',
    hjres: 'house-joint-resolution',
    sjres: 'senate-joint-resolution',
    hres: 'house-resolution',
    sres: 'senate-resolution',
    hconres: 'house-concurrent-resolution',
    sconres: 'senate-concurrent-resolution',
  };
  const billType = typeMap[typeRaw.toLowerCase()];
  if (!billType) return undefined;
  return `https://www.congress.gov/bill/${congress}th-congress/${billType}/${number}`;
}

/**
 * Resolve a URL from any available data about a source/document.
 */
function resolveUrl(
  id: string,
  rawSource?: string,
  billId?: string,
  billType?: string,
  billNumber?: string,
  congress?: string,
): string | undefined {
  
  if (rawSource && /^https?:\/\//.test(rawSource)) return rawSource;

  if (billId) {
    const fromBillId = congressUrl(billId);
    if (fromBillId) return fromBillId;
  }

  if (billType && billNumber && congress) {
    const synth = `${congress}-${billType}-${billNumber}`;
    const fromFields = congressUrl(synth);
    if (fromFields) return fromFields;
  }

  const fromId = congressUrl(id);
  if (fromId) return fromId;

  return undefined;
}

/**
 * Build a human-readable title from a bill ID.
 * "118-hr-8775_0" → "H.R. 8775 (118th Congress)"
 */
function titleFromId(id: string): string {
  const base = id.replace(/_\d+$/, '');
  const match = base.match(/^(\d+)-(hr|s|hjres|sjres|hres|sres|hconres|sconres)-(\d+)$/i);
  if (!match) return id;

  const [, congress, typeRaw, number] = match;
  const labelMap: Record<string, string> = {
    hr: `H.R. ${number}`,
    s: `S. ${number}`,
    hjres: `H.J.Res. ${number}`,
    sjres: `S.J.Res. ${number}`,
    hres: `H.Res. ${number}`,
    sres: `S.Res. ${number}`,
    hconres: `H.Con.Res. ${number}`,
    sconres: `S.Con.Res. ${number}`,
  };
  const label = labelMap[typeRaw.toLowerCase()] ?? id;
  return `${label} (${congress}th Congress)`;
}

/** Fetch full source details from the backend for a given sourceId */
async function fetchSourceDetail(sourceId: string): Promise<SourceDetail | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/sources/${sourceId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Build citations by fetching full source details from the backend */
async function buildCitationsFromSourceIds(sourceIds: string[]): Promise<Citation[]> {
  const seen = new Set<string>();
  const citations: Citation[] = [];

  for (const id of sourceIds) {
    if (seen.has(id)) continue;
    seen.add(id);

    // Fetch full details from /api/sources/{id}
    const detail = await fetchSourceDetail(id);

    const title = detail?.title || titleFromId(id);
    const excerpt = detail?.fullText ? cleanText(detail.fullText).slice(0, 220) : undefined;

    const url = resolveUrl(
      id,
      undefined,
      detail?.billId,
      detail?.billType,
      detail?.billNumber,
      // Extract congress number from the sourceId or billId if present
      detail?.billId?.match(/^(\d+)-/)?.[1],
    );

    citations.push({ id, title, url, excerpt });
  }

  return citations;
}

/** Build citations directly from embedded document objects */
function buildCitationsFromDocs(docs: RetrievedDocument[]): Citation[] {
  const seen = new Set<string>();
  return docs
    .map((doc, i) => {
      const id = doc.id ?? doc._id ?? doc.doc_id ?? String(i + 1);
      if (seen.has(id)) return null;
      seen.add(id);

      const rawSource = doc.url ?? doc.source ?? doc.metadata?.url ?? doc.metadata?.source;

      const title =
        doc.title ??
        doc.metadata?.title ??
        titleFromId(id);

      // Try to resolve URL from all available fields
      const url = resolveUrl(
        id,
        rawSource as string | undefined,
        doc.bill_id,
        doc.bill_type,
        doc.bill_number,
        doc.bill_id?.match(/^(\d+)-/)?.[1],
      );

      const rawExcerpt = doc.text ?? doc.content ?? doc.chunk_text ?? '';
      const excerpt = cleanText(rawExcerpt).slice(0, 220) || undefined;

      return { id, title, url, excerpt } as Citation;
    })
    .filter((c): c is Citation => c !== null);
}

/** Extract the main answer text from the run result. */
function extractAnswer(run: RunResult): string {
  if (run.answer) return cleanText(run.answer);

  let text = cleanText(run.agentCommentary?.content ?? '');
  text = text.replace(/^Graph Result:\s*/i, '').trim();

  const msgMatch = text.match(/'messages':\s*\[([^\]]+)\]/);
  if (msgMatch) {
    text = msgMatch[1].replace(/'/g, '').split(',').map((s) => s.trim()).filter(Boolean).join(' ');
  }

  if (text && text !== 'No result yet') return text;
  return cleanText(run.keyFinding?.summary ?? '');
}

/** Full parser: run result → {summary, bullets, citations} */
async function parseResponse(run: RunResult): Promise<ParsedResponse> {
  const text = extractAnswer(run);

  if (!text) {
    return {
      summary: 'The analysis completed but did not produce a readable response.',
      bullets: [],
      citations: [],
    };
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const summary = sentences[0] ?? text;
  const bullets = sentences.length > 1 ? sentences.slice(1) : [];

  let citations: Citation[] = [];

  if (run.documents && run.documents.length > 0) {
    // Embedded documents in the run response — build citations directly
    citations = buildCitationsFromDocs(run.documents);
  } else if (run.references?.sourceIds && run.references.sourceIds.length > 0) {
    // Source IDs only — fetch full details from /api/sources/{id}
    citations = await buildCitationsFromSourceIds(run.references.sourceIds);
  }

  return { summary, bullets, citations };
}

async function createRun(query: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Failed to start run (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.runId as string;
}

async function pollRun(runId: string): Promise<RunResult> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`${BASE_URL}/api/runs/${runId}`);
    if (!res.ok) throw new Error(`Poll failed (${res.status})`);
    const data: RunResult = await res.json();
    if (data.status === 'completed') return data;
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('The AI took too long to respond. Please try again.');
}

function guessRoute(query: string, run?: RunResult): 'nvidia' | 'huggingface' {
  if (run?.provider_used) {
    return run.provider_used.toLowerCase().includes('nvidia') ? 'nvidia' : 'huggingface';
  }
  const complex = ['compare', 'analyse', 'analyze', 'draft', 'summarize', 'cross-reference'];
  return complex.some((k) => query.toLowerCase().includes(k)) ? 'nvidia' : 'huggingface';
}

// ─── FormattedResponse ────────────────────────────────────────────────────────

const FormattedResponse: React.FC<{ parsed: ParsedResponse }> = ({ parsed }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="formatted-response">
      <p className="response-summary">{parsed.summary}</p>

      {parsed.bullets.length > 0 && (
        <ul className="response-bullets">
          {parsed.bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      )}

      {parsed.citations.length > 0 && (
        <div className="response-citations">
          <p className="citations-label">📎 Sources</p>
          <div className="citations-list">
            {parsed.citations.map((c) => (
              <div key={c.id} className="citation-item">
                <div className="citation-row">
                  {c.excerpt && (
                    <button
                      className="citation-chevron-btn"
                      onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      aria-label="Toggle excerpt"
                    >
                      {expandedId === c.id ? '▼' : '▶'}
                    </button>
                  )}

                  <span className="citation-id">[{c.id}]</span>
                  <span className="citation-title">{c.title}</span>

                  {c.url ? (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="citation-open-btn"
                      title={`Open: ${c.url}`}
                    >
                      Open ↗
                    </a>
                  ) : (
                    <span className="citation-no-link">No link</span>
                  )}
                </div>

                {expandedId === c.id && c.excerpt && (
                  <p className="citation-excerpt">"{c.excerpt}…"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const AIagentPage: React.FC = () => {
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: 'assistant',
      text: "Hello, I'm your AI Legal Assistant. How can I help you today?",
      time: nowStr(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSend = useCallback(async (text?: string): Promise<void> => {
    const messageText = (text ?? input).trim();
    if (!messageText || isTyping) return;

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), type: 'user', text: messageText, time: nowStr() },
    ]);
    setInput('');
    setIsTyping(true);

    try {
      const runId = await createRun(messageText);
      const run = await pollRun(runId);
      // parseResponse is now async (fetches source details)
      const parsed = await parseResponse(run);
      const routedTo = guessRoute(messageText, run);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: 'assistant',
          text: parsed.summary,
          parsed,
          time: nowStr(),
          runId,
          routedTo,
        },
      ]);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), type: 'error', text: `⚠ ${errorMsg}`, time: nowStr() },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const contextCases: ContextCase[] = [
    { icon: '📋', label: 'Commercial Tenancies Review',   status: 'review-needed', statusLabel: 'REVIEW'     },
    { icon: '🔄', label: 'Data Protection Bill Analysis', status: 'processing',    statusLabel: 'PROCESSING' },
  ];

  return (
    <div className="ai-agent-page">
      {/* Header */}
      <header className="ai-agent-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back to Workspace</button>

        <div className="agent-identity">
          <div className="agent-avatar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 1 4 4v2H8V6a4 4 0 0 1 4-4z"/>
              <rect x="4" y="8" width="16" height="12" rx="2"/>
            </svg>
            <span className="agent-status-dot" />
          </div>
          <div className="agent-info">
            <span className="agent-name">Legal AI Assistant</span>
            <span className="agent-desc">Powered by multi-agent orchestration</span>
          </div>
        </div>

        <div className="header-controls">
          <button className="ctrl-btn" title="Settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
            </svg>
          </button>
        </div>
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
                  <span className={`context-item-status status-${item.status}`}>{item.statusLabel}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="context-section">
            <h3 className="context-label">SUGGESTED PROMPTS</h3>
            <div className="suggested-prompts">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button key={i} className="suggested-btn" onClick={() => handleSend(prompt)} disabled={isTyping}>
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
              <div key={msg.id} className={`message-row ${msg.type === 'error' ? 'assistant' : msg.type}`}>
                {(msg.type === 'assistant' || msg.type === 'error') && (
                  <div className="msg-avatar assistant-avatar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="4"/>
                      <path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
                    </svg>
                  </div>
                )}

                <div className="message-content">
                  <div className={`message-bubble ${msg.type}`}>
                    {msg.type === 'assistant' && msg.parsed
                      ? <FormattedResponse parsed={msg.parsed} />
                      : msg.text}
                  </div>
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

                {msg.type === 'user' && (
                  <div className="msg-avatar user-avatar">You</div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="message-row assistant">
                <div className="msg-avatar assistant-avatar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4"/>
                    <path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
                  </svg>
                </div>
                <div className="message-content">
                  <div className="message-bubble assistant typing-bubble">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
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
                rows={1}
              />
              <div className="input-actions">
                <button
                  className={`send-btn ${input.trim() && !isTyping ? 'active' : ''}`}
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping}
                  aria-label="Send message"
                >
                  {isTyping ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <circle cx="12" cy="12" r="9"/>
                      <line x1="9" y1="9" x2="15" y2="9"/>
                      <line x1="9" y1="15" x2="15" y2="15"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  )}
                </button>
              </div>
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