import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import propylonLogo from '../../assets/propylon_logo.svg';
import './AIagentPage.css';
import sunIcon from '../../assets/lighModeSun.png';
import moonIcon from '../../assets/darkModeMoon.png';
import { Brain, Search, BookOpen, CheckCircle2, Leaf, Paperclip, Cpu, Sparkles, AlertCircle } from 'lucide-react';

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

// Green metrics captured per query from real backend values (polling fallback path)
interface GreenMetrics {
  carbonG: number;
  tokensUsed: number;
  latencyMs: number;
}

interface Message {
  id: number;
  type: 'user' | 'assistant' | 'error';
  text: string;
  parsed?: ParsedResponse;
  time: string;
  runId?: string;
  routedTo?: string;
  metrics?: GreenMetrics;       // polling path carbon data
  streamEvents?: AgentEvent[];  // SSE path stage history
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
  // Real green metrics from backend (used when SSE streaming is unavailable)
  reasoningPath?: {
    carbonTotalG?: number;
    latencyMs?: number;
    tokensUsed?: number;
    trustScore?: number;
    engine?: string;
    steps?: unknown[];
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

// ─── Agent Stream Types ────────────────────────────────────────────────────────

type AgentEventType = 'init' | 'thinking' | 'searching' | 'reading' | 'generating' | 'complete' | 'error';

interface AgentEvent {
  event: AgentEventType;
  label: string;
  elapsed: number;
  tokenCount?: number;
  runId?: string;
  docCount?: number;
  carbonG?: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:8000';
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 60_000;
const STREAM_TIMEOUT_MS = 90_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nowStr = (): string =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function cleanText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([*^†‡§¶\d]+\)/g, '')
    .replace(/\*+/g, '')
    .replace(/\^+/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\.{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function congressUrl(id: string): string | undefined {
  const base = id.replace(/_\d+$/, '');
  const match = base.match(/^(\d+)-(hr|s|hjres|sjres|hres|sres|hconres|sconres)-(\d+)$/i);
  if (!match) return undefined;
  const [, congress, typeRaw, number] = match;
  const typeMap: Record<string, string> = {
    hr: 'house-bill', s: 'senate-bill',
    hjres: 'house-joint-resolution', sjres: 'senate-joint-resolution',
    hres: 'house-resolution', sres: 'senate-resolution',
    hconres: 'house-concurrent-resolution', sconres: 'senate-concurrent-resolution',
  };
  const billType = typeMap[typeRaw.toLowerCase()];
  if (!billType) return undefined;
  return `https://www.congress.gov/bill/${congress}th-congress/${billType}/${number}`;
}

function resolveUrl(
  id: string,
  rawSource?: string,
  billId?: string,
  billType?: string,
  billNumber?: string,
  congress?: string,
): string | undefined {
  if (rawSource && /^https?:\/\//.test(rawSource)) return rawSource;
  if (billId) { const u = congressUrl(billId); if (u) return u; }
  if (billType && billNumber && congress) {
    const u = congressUrl(`${congress}-${billType}-${billNumber}`);
    if (u) return u;
  }
  return congressUrl(id);
}

function titleFromId(id: string): string {
  const base = id.replace(/_\d+$/, '');
  const match = base.match(/^(\d+)-(hr|s|hjres|sjres|hres|sres|hconres|sconres)-(\d+)$/i);
  if (!match) return id;
  const [, congress, typeRaw, number] = match;
  const labelMap: Record<string, string> = {
    hr: `H.R. ${number}`, s: `S. ${number}`,
    hjres: `H.J.Res. ${number}`, sjres: `S.J.Res. ${number}`,
    hres: `H.Res. ${number}`, sres: `S.Res. ${number}`,
    hconres: `H.Con.Res. ${number}`, sconres: `S.Con.Res. ${number}`,
  };
  return `${labelMap[typeRaw.toLowerCase()] ?? id} (${congress}th Congress)`;
}

async function fetchSourceDetail(sourceId: string): Promise<SourceDetail | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/sources/${sourceId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function buildCitationsFromSourceIds(sourceIds: string[]): Promise<Citation[]> {
  const seen = new Set<string>();
  const citations: Citation[] = [];
  for (const id of sourceIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const detail = await fetchSourceDetail(id);
    const title = detail?.title || titleFromId(id);
    const excerpt = detail?.fullText ? cleanText(detail.fullText).slice(0, 220) : undefined;
    const url = resolveUrl(
      id, undefined, detail?.billId, detail?.billType,
      detail?.billNumber, detail?.billId?.match(/^(\d+)-/)?.[1],
    );
    citations.push({ id, title, url, excerpt });
  }
  return citations;
}

function buildCitationsFromDocs(docs: RetrievedDocument[]): Citation[] {
  const seen = new Set<string>();
  return docs
    .map((doc, i) => {
      const id = doc.id ?? doc._id ?? doc.doc_id ?? String(i + 1);
      if (seen.has(id)) return null;
      seen.add(id);
      const rawSource = doc.url ?? doc.source ?? doc.metadata?.url ?? doc.metadata?.source;
      const title = doc.title ?? doc.metadata?.title ?? titleFromId(id);
      const url = resolveUrl(
        id, rawSource as string | undefined, doc.bill_id,
        doc.bill_type, doc.bill_number, doc.bill_id?.match(/^(\d+)-/)?.[1],
      );
      const excerpt = cleanText(doc.text ?? doc.content ?? doc.chunk_text ?? '').slice(0, 220) || undefined;
      return { id, title, url, excerpt } as Citation;
    })
    .filter((c): c is Citation => c !== null);
}

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

async function parseResponse(run: RunResult): Promise<ParsedResponse> {
  const text = extractAnswer(run);
  if (!text) {
    return { summary: 'The analysis completed but did not produce a readable response.', bullets: [], citations: [] };
  }
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 0);
  const summary = sentences[0] ?? text;
  const bullets = sentences.length > 1 ? sentences.slice(1) : [];
  let citations: Citation[] = [];
  if (run.documents && run.documents.length > 0) citations = buildCitationsFromDocs(run.documents);
  else if (run.references?.sourceIds?.length) citations = await buildCitationsFromSourceIds(run.references.sourceIds);
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

// ─── useAgentStream ───────────────────────────────────────────────────────────

interface AgentStreamState {
  currentEvent: AgentEvent | null;
  events: AgentEvent[];
  isStreaming: boolean;
  completedRunId: string | null;
  streamError: string | null;
}

function useAgentStream() {
  const [state, setState] = useState<AgentStreamState>({
    currentEvent: null,
    events: [],
    isStreaming: false,
    completedRunId: null,
    streamError: null,
  });

  const esRef = useRef<EventSource | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startStream = useCallback((query: string): Promise<{ runId: string; capturedEvents: AgentEvent[] }> => {
    return new Promise((resolve, reject) => {
      setState({ currentEvent: null, events: [], isStreaming: true, completedRunId: null, streamError: null });

      const url = `${BASE_URL}/api/runs/stream?query=${encodeURIComponent(query)}`;
      const es = new EventSource(url);
      esRef.current = es;
      const localEvents: AgentEvent[] = [];

      timeoutRef.current = setTimeout(() => {
        es.close();
        setState((prev) => ({ ...prev, isStreaming: false, streamError: 'timeout' }));
        reject(new Error('Stream timed out'));
      }, STREAM_TIMEOUT_MS);

      es.onmessage = (e: MessageEvent) => {
        try {
          const event: AgentEvent = JSON.parse(e.data as string);
          localEvents.push(event);
          setState((prev) => ({ ...prev, currentEvent: event, events: [...prev.events, event] }));

          if (event.event === 'complete' && event.runId) {
            clearTimeout(timeoutRef.current!);
            es.close();
            setState((prev) => ({ ...prev, isStreaming: false, completedRunId: event.runId! }));
            resolve({ runId: event.runId, capturedEvents: localEvents });
          } else if (event.event === 'error') {
            clearTimeout(timeoutRef.current!);
            es.close();
            setState((prev) => ({ ...prev, isStreaming: false, streamError: event.label }));
            reject(new Error(event.label));
          }
        } catch {
          // Ignore malformed SSE frames
        }
      };

      es.onerror = () => {
        clearTimeout(timeoutRef.current!);
        es.close();
        setState((prev) => ({ ...prev, isStreaming: false, streamError: 'connection' }));
        reject(new Error('Stream connection failed'));
      };
    });
  }, []);

  const reset = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setState({ currentEvent: null, events: [], isStreaming: false, completedRunId: null, streamError: null });
  }, []);

  useEffect(() => {
    return () => {
      esRef.current?.close();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { ...state, startStream, reset };
}

// ─── useLiveTimer ─────────────────────────────────────────────────────────────

function useLiveTimer(isActive: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) { startRef.current = null; return; }
    startRef.current = Date.now();
    const id = setInterval(() => {
      if (startRef.current !== null) setElapsed((Date.now() - startRef.current) / 1000);
    }, 100);
    return () => clearInterval(id);
  }, [isActive]);

  return elapsed;
}

// ─── Stage metadata ───────────────────────────────────────────────────────────

const STAGE_THOUGHTS: Record<AgentEventType, string[]> = {
  init:       ['Initialising legal intelligence engine...', 'Loading legislative knowledge base...'],
  thinking:   ['Parsing query intent and jurisdiction...', 'Identifying key legal concepts...', 'Mapping statutory relationships...', 'Classifying legal domain and scope...'],
  searching:  ['Running semantic vector search...', 'Querying indexed legislative corpus...', 'Applying jurisdiction and relevance filters...', 'Scoring document similarity...'],
  reading:    ['Extracting key statutory clauses...', 'Analysing legislative language...', 'Cross-referencing bill amendments...', 'Evaluating source credibility...'],
  generating: ['Synthesising retrieved evidence...', 'Formulating legal analysis...', 'Structuring compliance framework...', 'Validating against regulatory standards...'],
  complete:   ['Analysis complete.'],
  error:      ['Analysis failed.'],
};

const STAGE_META: Partial<Record<AgentEventType, { Icon: React.ElementType }>> = {
  init:       { Icon: Cpu },
  thinking:   { Icon: Brain },
  searching:  { Icon: Search },
  reading:    { Icon: BookOpen },
  generating: { Icon: Sparkles },
  complete:   { Icon: CheckCircle2 },
  error:      { Icon: AlertCircle },
};

const STEP_ACCENT: Partial<Record<AgentEventType, string>> = {
  thinking:   'var(--accent-blue)',
  searching:  'var(--accent-purple)',
  reading:    '#f59e0b',
  generating: 'var(--accent-green)',
};

// ─── CompletedThoughtCard ─────────────────────────────────────────────────────

const CompletedThoughtCard: React.FC<{
  event: AgentEvent;
  nextElapsed?: number;
  isLast?: boolean;
}> = ({ event, nextElapsed, isLast }) => {
  const Icon = STAGE_META[event.event]?.Icon ?? Cpu;
  const color = STEP_ACCENT[event.event] ?? 'var(--accent-green)';
  const thought = (STAGE_THOUGHTS[event.event] ?? [])[0] ?? '';
  const stageDuration = nextElapsed !== undefined ? nextElapsed - event.elapsed : event.elapsed;

  return (
    <div className="tc-wrapper">
      <div className="tc-card" style={{ borderLeftColor: color }}>
        <div className="tc-header">
          <div className="tc-step-name">
            <Icon size={10} strokeWidth={2.5} style={{ color }} />
            <span style={{ color }}>{event.event.toUpperCase()}</span>
          </div>
          <span className="tc-time">{stageDuration.toFixed(2)}s</span>
        </div>
        <p className="tc-desc">{event.label}</p>
        {thought && (
          <div className="tc-logic">
            <span className="tc-logic-label">AGENT LOGIC</span>
            <p className="tc-logic-text">"{thought}"</p>
          </div>
        )}
        <div className="tc-metrics">
          <div className="tc-metric">
            <span className="tc-metric-label">ELAPSED</span>
            <span className="tc-metric-val">{stageDuration.toFixed(2)}s</span>
          </div>
          {event.docCount != null && (
            <div className="tc-metric">
              <span className="tc-metric-label">SOURCES</span>
              <span className="tc-metric-val">{event.docCount}</span>
            </div>
          )}
          <div className="tc-metric">
            <span className="tc-metric-label">STATUS</span>
            <span className="tc-metric-val tc-metric-val--done">PROCESSED</span>
          </div>
        </div>
      </div>
      {!isLast && <div className="tc-connector" />}
    </div>
  );
};

// ─── AgentThinkingBlock ───────────────────────────────────────────────────────

const AgentThinkingBlock: React.FC<{
  currentEvent: AgentEvent | null;
  isStreaming: boolean;
}> = ({ currentEvent, isStreaming }) => {
  const [thoughtIdx, setThoughtIdx] = useState(0);
  const [thoughtKey, setThoughtKey] = useState(0);
  const liveElapsed = useLiveTimer(isStreaming);

  const effectiveEvent: AgentEvent = currentEvent ?? (
    isStreaming
      ? { event: 'thinking', label: 'Thinking...', elapsed: 0 }
      : { event: 'init',     label: 'Initialising...', elapsed: 0 }
  );

  useEffect(() => {
    const eventType = effectiveEvent.event;
    if (eventType === 'complete' || eventType === 'error') return;
    setTimeout(() => { setThoughtIdx(0); setThoughtKey((k) => k + 1); }, 0);
    const thoughts = STAGE_THOUGHTS[eventType] ?? [];
    if (thoughts.length <= 1) return;
    const id = setInterval(() => {
      setThoughtIdx((i) => { setThoughtKey((k) => k + 1); return (i + 1) % thoughts.length; });
    }, 2500);
    return () => clearInterval(id);
  }, [effectiveEvent.event]);

  if (!isStreaming && !currentEvent) return null;

  const isComplete = effectiveEvent.event === 'complete';
  const isError    = effectiveEvent.event === 'error';
  const color      = STEP_ACCENT[effectiveEvent.event] ?? 'var(--accent-blue)';
  const currentThought = (STAGE_THOUGHTS[effectiveEvent.event] ?? [])[thoughtIdx] ?? '';
  const displayElapsed = isComplete ? (effectiveEvent.elapsed ?? 0) : liveElapsed;

  return (
    <div
      className={`tc-card tc-card--active${isComplete ? ' tc-card--done' : isError ? ' tc-card--error' : ''}`}
      style={{ borderLeftColor: isComplete ? 'var(--accent-green)' : isError ? '#ef4444' : color }}
      role="status"
      aria-live="polite"
      aria-label={effectiveEvent.label}
    >
      <div className="tc-header">
        <div className="tc-step-name">
          {isComplete ? (
            <CheckCircle2 size={10} strokeWidth={2.5} style={{ color: 'var(--accent-green)' }} />
          ) : isError ? (
            <AlertCircle size={10} strokeWidth={2.5} style={{ color: '#ef4444' }} />
          ) : (
            <span className="tc-spinner" style={{ borderTopColor: color }} />
          )}
          <span style={{ color: isComplete ? 'var(--accent-green)' : isError ? '#ef4444' : color }}>
            {isComplete ? 'COMPLETE' : isError ? 'ERROR' : effectiveEvent.event.toUpperCase()}
          </span>
          {!isComplete && !isError && (
            <div className="tc-neural-bars" aria-hidden="true">
              {[0,1,2,3,4].map((i) => (
                <span key={i} className="tc-neural-bar" style={{ animationDelay: `${i * 0.13}s`, background: color }} />
              ))}
            </div>
          )}
        </div>
        <span className="tc-time">{displayElapsed.toFixed(2)}s</span>
      </div>

      <p className="tc-desc">{isComplete ? 'Analysis complete' : effectiveEvent.label}</p>

      {!isComplete && !isError && (
        <>
          <div className="tc-logic">
            <span className="tc-logic-label">AGENT LOGIC</span>
            <p key={thoughtKey} className="tc-logic-text tc-logic-text--animated">"{currentThought}"</p>
          </div>
          <div className="tc-metrics">
            <div className="tc-metric">
              <span className="tc-metric-label">ELAPSED</span>
              <span className="tc-metric-val">{displayElapsed.toFixed(2)}s</span>
            </div>
            {effectiveEvent.docCount != null && (
              <div className="tc-metric">
                <span className="tc-metric-label">SOURCES</span>
                <span className="tc-metric-val">{effectiveEvent.docCount}</span>
              </div>
            )}
            <div className="tc-metric">
              <span className="tc-metric-label">STATUS</span>
              <span className="tc-metric-val tc-metric-val--active">VALIDATING</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ─── FormattedResponse ────────────────────────────────────────────────────────

const FormattedResponse: React.FC<{
  parsed: ParsedResponse;
  onCitationClick: (c: Citation) => void;
}> = ({ parsed, onCitationClick }) => {
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
          <p className="citations-label">
            <Paperclip size={11} strokeWidth={2} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
            Sources
          </p>
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
                  {/* Clickable title opens doc preview panel */}
                  <button className="citation-title-btn" onClick={() => onCitationClick(c)}>
                    {c.title}
                  </button>
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

// ─── Research Tasks (Empty State) ────────────────────────────────────────────

interface ResearchTask {
  icon: 'regulatory' | 'compliance' | 'research' | 'contract';
  title: string;
  description: string;
  query: string;
}

const RESEARCH_TASKS: ResearchTask[] = [
  {
    icon: 'regulatory',
    title: 'Regulatory Analysis',
    description: 'Review legislative changes and impact assessments.',
    query: 'Perform a regulatory analysis on recent legislative changes and their impact assessments',
  },
  {
    icon: 'compliance',
    title: 'Compliance Check',
    description: 'Generate documentation and verification checklists.',
    query: 'Generate a compliance check with documentation and verification checklists',
  },
  {
    icon: 'research',
    title: 'Case Research',
    description: 'Find legal precedents and court rulings across jurisdictions.',
    query: 'Find legal precedents and court rulings across jurisdictions for case research',
  },
  {
    icon: 'contract',
    title: 'Contract Review',
    description: 'Analyze, revise, and detect anomalies in legal agreements.',
    query: 'Analyze and review legal agreements to detect anomalies and suggest revisions',
  },
];

const TaskIcon: React.FC<{ type: ResearchTask['icon'] }> = ({ type }) => {
  const icons: Record<string, React.ReactNode> = {
    regulatory: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18M3 12h18M3 18h18" />
        <path d="M3 6c2 2 4-2 6 0s4-2 6 0s4-2 6 0" />
      </svg>
    ),
    compliance: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4" />
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      </svg>
    ),
    research: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3L2 8l10 5 10-5-10-5z" />
        <path d="M2 8v8l10 5 10-5V8" />
        <path d="M12 13v9" />
      </svg>
    ),
    contract: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  };
  return <div className="task-icon-svg">{icons[type]}</div>;
};

// ─── Reasoning Panel ──────────────────────────────────────────────────────────

interface ReasoningStep {
  label: string;
  description: string;
  status: 'done' | 'active' | 'pending';
  elapsed?: number;
  tags?: string[];
  progress?: number;
  Icon: React.ElementType;
}

const ReasoningPanel: React.FC<{
  routedTo?: string;
  isTyping?: boolean;
  currentEvent?: AgentEvent | null;
  events?: AgentEvent[];
  carbonG?: number;
  // Polling-path fallback metrics
  sessionMetrics?: { totalCarbonG: number; totalTokens: number; queryCount: number };
  lastMetrics?: GreenMetrics;
}> = ({ routedTo, isTyping, currentEvent, events = [], carbonG, sessionMetrics, lastMetrics }) => {
  const liveElapsed = useLiveTimer(!!isTyping);

  const ORDER: AgentEventType[] = ['init', 'thinking', 'searching', 'reading', 'generating', 'complete'];
  const activeEvent = currentEvent?.event;
  const activeIdx   = activeEvent ? ORDER.indexOf(activeEvent) : (isTyping ? 0 : ORDER.length);

  const stepStatus = (reachedAt: AgentEventType): ReasoningStep['status'] => {
    if (!isTyping) return 'done';
    const stepIdx = ORDER.indexOf(reachedAt);
    if (activeIdx > stepIdx)   return 'done';
    if (activeIdx === stepIdx) return 'active';
    return 'pending';
  };

  const getElapsed = (e: AgentEventType) => events.find((ev) => ev.event === e)?.elapsed;

  const docCount     = currentEvent?.docCount ?? events.find((e) => e.event === 'reading')?.docCount;
  const tokenCount   = events.find((e) => e.event === 'complete')?.tokenCount ?? currentEvent?.tokenCount;
  const totalElapsed = events.find((e) => e.event === 'complete')?.elapsed ?? currentEvent?.elapsed;

  const hasStreamData = events.length > 0;
  const realCarbonG   = carbonG ?? events.find((e) => e.event === 'complete')?.carbonG;
  const co2g = realCarbonG
    ?? (hasStreamData ? (tokenCount ? tokenCount * 0.0003 : 0.3) : (lastMetrics?.carbonG ?? 0));
  const co2Display = co2g < 0.001
    ? `${(co2g * 1_000_000).toFixed(2)} μg`
    : co2g < 1
      ? `${(co2g * 1000).toFixed(2)} mg`
      : `${co2g.toFixed(3)} g`;

  const steps: ReasoningStep[] = [
    {
      label: 'Semantic Search',
      description: 'Queried legislative index using vector similarity.',
      status: stepStatus('searching'),
      elapsed: getElapsed('searching'),
      tags: ['Vector DB', 'Hybrid Search'],
      Icon: Search,
    },
    {
      label: 'Document Retrieval',
      description: docCount != null
        ? `${docCount} source${docCount !== 1 ? 's' : ''} selected for analysis.`
        : 'Applied jurisdiction and relevance filters.',
      status: stepStatus('reading'),
      elapsed: getElapsed('reading'),
      Icon: BookOpen,
    },
    {
      label: 'Answer Synthesis',
      description: stepStatus('generating') === 'active'
        ? 'Synthesising context with the language model…'
        : 'Generated response from retrieved context.',
      status: stepStatus('generating'),
      elapsed: getElapsed('generating'),
      progress: stepStatus('generating') === 'active' ? 60 : undefined,
      Icon: Sparkles,
    },
    {
      label: 'Final Output',
      description: !isTyping ? 'Analysis complete.' : 'Awaiting completion.',
      status: isTyping ? 'pending' : 'done',
      elapsed: getElapsed('complete'),
      Icon: CheckCircle2,
    },
  ];

  return (
    <div className="reasoning-panel">

      {/* ── Header ── */}
      <div className="rpanel-header">
        <span className="rpanel-title">AI Reasoning Path</span>
        {routedTo && (
          <span className="rpanel-provider-tag">
            {routedTo === 'nvidia' ? 'NVIDIA NIM' : 'RAG Pipeline'}
          </span>
        )}
      </div>

      {/* ── Steps ── */}
      <div className="rpanel-steps">
        {steps.map((step, i) => (
          <div key={i} className={`rpanel-step status-${step.status}`}>
            <div className="rpanel-step-dot">
              <div className={`rpanel-step-num rpanel-step-num--${step.status}`}>
                {step.status === 'done'
                  ? <CheckCircle2 size={10} strokeWidth={2.5} />
                  : step.status === 'active'
                    ? <span className="rpanel-step-spinner" />
                    : <span>{i + 1}</span>}
              </div>
              {i < steps.length - 1 && (
                <div className={`rpanel-line${step.status === 'done' ? ' done' : ''}`} />
              )}
            </div>
            <div className="rpanel-step-body">
              <div className="rpanel-step-header">
                <span className="rpanel-step-label">{step.label}</span>
                {step.status === 'active' && (
                  <span className="rpanel-step-live">{liveElapsed.toFixed(1)}s</span>
                )}
                {step.elapsed !== undefined && step.status !== 'active' && (
                  <span className="rpanel-step-time">{step.elapsed.toFixed(1)}s</span>
                )}
              </div>
              <p className="rpanel-step-desc">{step.description}</p>
              {step.tags && step.status !== 'pending' && (
                <div className="rpanel-tags">
                  {step.tags.map((t) => <span key={t} className="rpanel-tag">{t}</span>)}
                </div>
              )}
              {step.progress !== undefined && step.status === 'active' && (
                <div className="rpanel-progress-wrap">
                  <div className="rpanel-progress-bar">
                    <div className="rpanel-progress-fill" style={{ width: `${step.progress}%` }} />
                  </div>
                  <span className="rpanel-progress-pct">{step.progress}%</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Impact Report ── */}
      <div className="impact-report">
        <div className="ir-header">
          <div className="ir-header-left">
            <Leaf size={13} strokeWidth={2} />
            <span className="ir-title">Impact Report</span>
          </div>
          <span className="ir-badge">LOW CARBON</span>
        </div>

        <div className="ir-co2-block">
          <span className="ir-co2-value">{co2Display}</span>
          <div className="ir-co2-right">
            <span className="ir-co2-label">TOTAL CO₂ EQUIVALENT</span>
            <span className="ir-vs-avg">-42% VS INDUSTRY AVG</span>
          </div>
        </div>

        <div className="ir-range">
          <div className="ir-range-track">
            <div className="ir-range-fill" />
            <div className="ir-range-marker" />
          </div>
          <div className="ir-range-ends">
            <span>0.00g</span>
            <span>{tokenCount != null && tokenCount > 0 ? `${(tokenCount * 0.0003).toFixed(3)}g` : '1.89g'}</span>
          </div>
        </div>

        <div className="ir-stats">
          <div className="ir-stat">
            <span className="ir-stat-label">SOURCES</span>
            <span className="ir-stat-val">{docCount ?? '—'}</span>
          </div>
          <div className="ir-stat">
            <span className="ir-stat-label">TIME</span>
            <span className="ir-stat-val">{totalElapsed != null ? `${totalElapsed.toFixed(1)}s` : '—'}</span>
          </div>
        </div>

        {/* Session totals — only shown when polling fallback was used (no stream data) */}
        {!hasStreamData && sessionMetrics && sessionMetrics.queryCount > 0 && (
          <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border-light)', marginTop: '4px' }}>
            <div className="rpanel-stats-section-label" style={{ padding: '4px 0 6px' }}>THIS SESSION</div>
            <div className="rpanel-stat-row">
              <span>Total CO₂</span>
              <strong className="rpanel-green-value">{sessionMetrics.totalCarbonG.toFixed(4)}g</strong>
            </div>
            <div className="rpanel-stat-row">
              <span>Total Tokens</span>
              <strong>{sessionMetrics.totalTokens.toLocaleString()}</strong>
            </div>
            <div className="rpanel-stat-row">
              <span>Queries Run</span>
              <strong>{sessionMetrics.queryCount}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const AIagentPage: React.FC<{ darkMode?: boolean; toggleDarkMode?: () => void }> = ({ darkMode, toggleDarkMode }) => {
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

  // SSE streaming state
  const { currentEvent, events, isStreaming, startStream, reset: resetStream } = useAgentStream();

  // Right panel collapse
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // Document preview state
  const [previewCitation, setPreviewCitation] = useState<Citation | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Session-level green metrics (polling fallback only)
  const [sessionMetrics, setSessionMetrics] = useState({
    totalCarbonG: 0,
    totalTokens: 0,
    queryCount: 0,
  });

  // Persist last SSE complete event so panel stays populated after stream resets
  const [lastCompleteEvent, setLastCompleteEvent] = useState<AgentEvent | null>(null);
  useEffect(() => {
    const ce = events.find((e) => e.event === 'complete');
    if (ce) setLastCompleteEvent(ce);
  }, [events]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isStreaming, events]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Citation click → fetch full text, open doc preview panel
  const handleCitationClick = useCallback(async (c: Citation) => {
    setPreviewCitation(c);
    setPreviewLoading(true);
    const detail = await fetchSourceDetail(c.id);
    if (detail?.fullText) {
      setPreviewCitation({ ...c, excerpt: cleanText(detail.fullText).slice(0, 6000) });
    }
    setPreviewLoading(false);
  }, []);

  const handleSend = useCallback(async (text?: string): Promise<void> => {
    const messageText = (text ?? input).trim();
    if (!messageText || isTyping) return;

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), type: 'user', text: messageText, time: nowStr() },
    ]);
    setInput('');
    setIsTyping(true);
    resetStream();

    try {
      let runId: string;
      let capturedStreamEvents: AgentEvent[] = [];

      try {
        // Primary path: SSE streaming for real-time thought visualisation
        const result = await startStream(messageText);
        runId = result.runId;
        capturedStreamEvents = result.capturedEvents.filter(
          (e) => !['init', 'error'].includes(e.event)
        );
      } catch {
        // Graceful fallback to standard polling if streaming is unavailable
        resetStream();
        runId = await createRun(messageText);
      }

      const run = await pollRun(runId);
      const parsed = await parseResponse(run);
      const routedTo = guessRoute(messageText, run);

      // Extract green metrics from backend reasoningPath (polling fallback)
      const metrics: GreenMetrics = {
        carbonG: run.reasoningPath?.carbonTotalG ?? 0,
        tokensUsed: run.reasoningPath?.tokensUsed ?? 0,
        latencyMs: run.reasoningPath?.latencyMs ?? 0,
      };

      // Only accumulate session totals when SSE wasn't available
      if (capturedStreamEvents.length === 0) {
        setSessionMetrics((prev) => ({
          totalCarbonG: prev.totalCarbonG + metrics.carbonG,
          totalTokens: prev.totalTokens + metrics.tokensUsed,
          queryCount: prev.queryCount + 1,
        }));
      }

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
          metrics,
          streamEvents: capturedStreamEvents.length > 0 ? capturedStreamEvents : undefined,
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
      resetStream();
    }
  }, [input, isTyping, startStream, resetStream]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const lastAssistant = [...messages].reverse().find((m) => m.type === 'assistant' && m.parsed);
  const activeRoutedTo = lastAssistant?.routedTo;
  const hasStartedChat = messages.some((m) => m.type === 'user');

  return (
    <div className="ai-agent-page">
      {/* ─── Left Sidebar ──────────────────────────────────────────────── */}
      <aside className="ai-sidebar">
        <div className="sidebar-top">
          <div className="sidebar-logo-area">
            <img src={propylonLogo} alt="Propylon" className="sidebar-logo-svg" />
            <div className="sidebar-logo-text">
              <div className="sidebar-brand">
                <span className="brand-rws" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>rws</span>
                <span className="brand-divider">|</span>
                <span className="brand-propylon" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Propylon</span>
              </div>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-label">MAIN MENU</div>
            <nav className="sidebar-nav">
              <NavLink to="/workspace" className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                </svg>
                <span>Workspace</span>
              </NavLink>
              <div className="sidebar-nav-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>Drafts</span>
              </div>
              <div className="sidebar-nav-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>Shared with Team</span>
              </div>
              <NavLink to="/history" className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" />
                  <path d="M10 12h4" />
                </svg>
                <span>Archive</span>
              </NavLink>
            </nav>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-label">INTERNAL TOOLS</div>
            <nav className="sidebar-nav">
              <div className="sidebar-nav-item" onClick={() => navigate('/workspace')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span>Propylon Research</span>
              </div>
              <NavLink to="/ai-agent" className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a4 4 0 0 1 4 4v2H8V6a4 4 0 0 1 4-4z" />
                  <rect x="4" y="8" width="16" height="12" rx="2" />
                  <circle cx="9" cy="14" r="1" fill="currentColor" /><circle cx="15" cy="14" r="1" fill="currentColor" />
                </svg>
                <span>AI Assistant</span>
              </NavLink>
            </nav>
          </div>
        </div>

        <div className="sidebar-bottom">
          <button className="new-case-btn" onClick={() => navigate('/workspace')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Research Case
          </button>
          {toggleDarkMode && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {darkMode ? 'Dark Mode' : 'Light Mode'}
              </span>
              <button
                onClick={toggleDarkMode}
                style={{
                  width: '44px', height: '24px', borderRadius: '999px',
                  border: 'none', cursor: 'pointer', padding: 0,
                  background: darkMode ? '#3b82f6' : '#e2e8f0',
                  transition: 'background 0.3s ease',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <span className="toggle-thumb" style={{
                  width: '18px', height: '18px', borderRadius: '50%',
                  background: 'white', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', overflow: 'hidden',
                  transform: darkMode ? 'translateX(22px)' : 'translateX(3px)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                }}>
                  <img src={darkMode ? moonIcon : sunIcon} width="12" height="12" style={{ objectFit: 'contain' }} />
                </span>
              </button>
            </div>
          )}
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              <img src="https://ui-avatars.com/api/?name=James+Sterling&background=e2e8f0&color=475569&size=36&font-size=0.4&bold=true" alt="JS" />
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">James Sterling</span>
              <span className="sidebar-user-role">Senior Counsel</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Main Content ──────────────────────────────────────────────── */}
      <div className="ai-main-content">
        {hasStartedChat && (
          <header className="chat-header-bar">
            <div className="chat-header-left">
              <span className="chat-header-title">AI Legal Assistant</span>
            </div>
            <div className="chat-header-badges">
              <div className="header-badge">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Enterprise Encryption Active</span>
              </div>
              <div className="header-badge">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span>RAG Pipeline Active</span>
              </div>
              {/* Session CO₂ badge — only shown when polling fallback was used */}
              {sessionMetrics.queryCount > 0 && (
                <div className="header-badge header-badge-green">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                    <path d="M12 2C6 2 2 8 2 12c0 5.5 4.5 10 10 10s10-4.5 10-10c0-1-.2-2-.5-3" />
                    <path d="M12 6v6l4 2" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span>🌿 {sessionMetrics.totalCarbonG.toFixed(4)}g CO₂ session</span>
                </div>
              )}
              <div className="header-badge">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" />
                </svg>
                <span>Net Zero Badge</span>
              </div>
            </div>
            <button className="chat-header-settings" title="Settings">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </header>
        )}

        <div className="ai-content-body">
          {/* ── Chat Column ─────────────────────────────────────────────── */}
          <div className="chat-column">
            {hasStartedChat && (
              <main className="chat-area">
                <div className="date-separator">
                  <span>TODAY, {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase()}</span>
                </div>

                <div className="messages-list">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`message-row ${msg.type === 'error' ? 'assistant' : msg.type}`}>
                      {(msg.type === 'assistant' || msg.type === 'error') && (
                        <div className="msg-avatar assistant-avatar">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="8" r="4" />
                            <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
                          </svg>
                        </div>
                      )}

                      <div className="message-content">
                        {/* Replay completed thought cards above the message bubble */}
                        {msg.type === 'assistant' && msg.streamEvents && msg.streamEvents.length > 0 && (() => {
                          const stageEvents = msg.streamEvents.filter(e => e.event !== 'complete');
                          const completeEvt = msg.streamEvents.find(e => e.event === 'complete');
                          return (
                            <div className="thought-stream thought-stream--history">
                              {stageEvents.map((evt, i) => {
                                const nextEvt = stageEvents[i + 1] ?? completeEvt;
                                return (
                                  <CompletedThoughtCard
                                    key={`${msg.id}-${evt.event}`}
                                    event={evt}
                                    nextElapsed={nextEvt?.elapsed}
                                    isLast={i === stageEvents.length - 1}
                                  />
                                );
                              })}
                            </div>
                          );
                        })()}

                        <div className={`message-bubble ${msg.type}`}>
                          {msg.type === 'assistant' && msg.parsed
                            ? <FormattedResponse parsed={msg.parsed} onCitationClick={handleCitationClick} />
                            : msg.text}
                        </div>

                        <div className="message-meta">
                          <span className="message-time">
                            {msg.type === 'assistant' ? 'AI Assistant' : 'Legal Counsel'} · {msg.time}
                          </span>
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
                          {/* Per-query carbon badge — only when polling fallback was used */}
                          {!msg.streamEvents && msg.metrics && (msg.metrics.carbonG > 0 || msg.metrics.tokensUsed > 0) && (
                            <span className="green-metrics-badge" title="Green computing metrics for this query">
                              🌿 {msg.metrics.carbonG.toFixed(4)}g CO₂
                              &nbsp;·&nbsp;
                              🔢 {msg.metrics.tokensUsed.toLocaleString()} tok
                              {msg.metrics.latencyMs > 0 && (
                                <>&nbsp;·&nbsp;⏱ {(msg.metrics.latencyMs / 1000).toFixed(1)}s</>
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      {msg.type === 'user' && (
                        <div className="msg-avatar user-avatar">You</div>
                      )}
                    </div>
                  ))}

                  {/* Live thought stream during active query */}
                  {isTyping && (
                    <div className="thought-stream">
                      <div className="thought-stream-header">
                        <span className="ts-status-pill ts-status-pill--done">● Processed</span>
                        <span className="ts-status-pill ts-status-pill--active">● Validating</span>
                        <span className="ts-status-pill ts-status-pill--pending">● Pending</span>
                      </div>
                      {(() => {
                        const visibleEvents = events.filter(
                          e => !['init', 'complete', 'error'].includes(e.event) && e.event !== currentEvent?.event
                        );
                        return visibleEvents.map((evt, i) => {
                          const nextEvt = visibleEvents[i + 1] ?? currentEvent ?? events.find(e => e.event === 'complete');
                          return (
                            <CompletedThoughtCard
                              key={evt.event}
                              event={evt}
                              nextElapsed={nextEvt?.elapsed}
                              isLast={i === visibleEvents.length - 1 && !isStreaming && !currentEvent}
                            />
                          );
                        });
                      })()}
                      {isStreaming || currentEvent ? (
                        <AgentThinkingBlock
                          currentEvent={currentEvent}
                          isStreaming={isStreaming}
                        />
                      ) : (
                        <div className="message-bubble assistant">
                          <div className="typing-bubble">
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input Bar (chat state) */}
                <div className="input-area">
                  <div className="input-wrapper">
                    <textarea
                      ref={inputRef}
                      className="message-input"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask a legal question…"
                      disabled={isTyping}
                      rows={1}
                    />
                    <button
                      className={`send-btn ${input.trim() && !isTyping ? 'active' : ''}`}
                      onClick={() => handleSend()}
                      disabled={!input.trim() || isTyping}
                      aria-label="Send message"
                    >
                      {isTyping ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <circle cx="12" cy="12" r="9" />
                          <line x1="9" y1="9" x2="15" y2="9" />
                          <line x1="9" y1="15" x2="15" y2="15" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="input-bottom-row">
                    <div className="input-tools">
                      <div className="model-indicator">
                        <svg width="7" height="7" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" fill="#10b981" />
                        </svg>
                        GPT-4 LEGAL MODEL ACTIVE
                      </div>
                      <button className="input-tool-btn" title="Attach file" aria-label="Attach file">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                      </button>
                      <button className="input-tool-btn" title="Upload image" aria-label="Upload image">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                        </svg>
                      </button>
                      <button className="input-tool-btn" title="Voice input" aria-label="Voice input">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p className="input-disclaimer">
                    Propylon AI can make mistakes. Check important information before finalizing legal documents.
                  </p>
                </div>
              </main>
            )}

            {!hasStartedChat && (
              <div className="welcome-content">
                <div className="welcome-hero">
                  <div className="welcome-icon-wrap">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3L2 8l10 5 10-5-10-5z" />
                      <path d="M2 8v8l10 5 10-5V8" />
                      <path d="M12 13v9" />
                    </svg>
                  </div>
                  <h1 className="welcome-title">Hi James, Where should we start?</h1>
                  <p className="welcome-subtitle">Select a task or type a query to begin your legal research.</p>
                </div>

                <div className="welcome-tasks-section">
                  <div className="welcome-tasks-label">SUGGESTED RESEARCH TASKS</div>
                  <div className="research-tasks-grid">
                    {RESEARCH_TASKS.map((task, i) => (
                      <button
                        key={i}
                        className="research-task-card"
                        onClick={() => handleSend(task.query)}
                        disabled={isTyping}
                      >
                        <TaskIcon type={task.icon} />
                        <h3 className="task-card-title">{task.title}</h3>
                        <p className="task-card-desc">{task.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Input Bar (welcome state) */}
            {!hasStartedChat && (
              <div className="input-area">
                <div className="input-wrapper">
                  <textarea
                    ref={inputRef}
                    className="message-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a legal question…"
                    disabled={isTyping}
                    rows={1}
                  />
                  <button
                    className={`send-btn ${input.trim() && !isTyping ? 'active' : ''}`}
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isTyping}
                    aria-label="Send message"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
                <div className="input-bottom-row">
                  <div className="input-tools">
                    <div className="model-indicator">
                      <svg width="7" height="7" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" fill="#10b981" />
                      </svg>
                      GPT-4 LEGAL MODEL ACTIVE
                    </div>
                    <button className="input-tool-btn" title="Attach file" aria-label="Attach file">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </button>
                    <button className="input-tool-btn" title="Upload image" aria-label="Upload image">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                      </svg>
                    </button>
                    <button className="input-tool-btn" title="Voice input" aria-label="Voice input">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="input-disclaimer">
                  Propylon AI can make mistakes. Check important information before finalizing legal documents.
                </p>
              </div>
            )}
          </div>

          {/* ── Right Panel ────────────────────────────────────────────── */}
          {hasStartedChat && (
            <aside className={`right-panel${!rightPanelOpen ? ' right-panel--collapsed' : ''}`}>
              <button
                className="rp-collapse-btn"
                onClick={() => setRightPanelOpen(o => !o)}
                title={rightPanelOpen ? 'Collapse panel' : 'Expand panel'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points={rightPanelOpen ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
                </svg>
              </button>
              {rightPanelOpen && (
                <div className="right-panel-content" style={{ paddingTop: '12px' }}>
                  {/* Doc preview replaces reasoning panel when a citation is clicked */}
                  {previewCitation ? (
                    <div className="doc-preview-panel">
                      <div className="doc-preview-header">
                        <span className="doc-preview-title">{previewCitation.title}</span>
                        <button
                          className="doc-preview-close"
                          onClick={() => setPreviewCitation(null)}
                          aria-label="Close preview"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="doc-preview-body">
                        {previewLoading ? (
                          <p className="doc-preview-no-content">Loading document…</p>
                        ) : previewCitation.excerpt ? (
                          <>
                            <div className="doc-preview-highlight">
                              <span className="doc-preview-highlight-label">Cited section</span>
                              <p className="doc-preview-excerpt">"{previewCitation.excerpt}…"</p>
                            </div>
                            {previewCitation.url && (
                              <a
                                href={previewCitation.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="doc-preview-open-btn"
                              >
                                Open full document ↗
                              </a>
                            )}
                          </>
                        ) : previewCitation.url ? (
                          <a
                            href={previewCitation.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="doc-preview-open-btn"
                          >
                            Open full document ↗
                          </a>
                        ) : (
                          <p className="doc-preview-no-content">No preview available for this source.</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <ReasoningPanel
                      routedTo={activeRoutedTo}
                      isTyping={isTyping}
                      currentEvent={currentEvent}
                      events={events}
                      carbonG={lastCompleteEvent?.carbonG}
                      sessionMetrics={sessionMetrics}
                      lastMetrics={lastAssistant?.metrics}
                    />
                  )}
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIagentPage;
