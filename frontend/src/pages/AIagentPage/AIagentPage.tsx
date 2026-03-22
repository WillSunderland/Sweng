import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import propylonLogo from '../../assets/propylon_logo.svg';
import './AIagentPage.css';
import sunIcon from '../../assets/lighModeSun.png';
import moonIcon from '../../assets/darkModeMoon.png';

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

// Green metrics captured per query from real backend values
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
  metrics?: GreenMetrics;
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
  // Real green metrics from backend
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

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:8000';
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 60_000;

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
  id: string, rawSource?: string, billId?: string,
  billType?: string, billNumber?: string, congress?: string,
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
  } catch { return null; }
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
  if (run?.provider_used) return run.provider_used.toLowerCase().includes('nvidia') ? 'nvidia' : 'huggingface';
  const complex = ['compare', 'analyse', 'analyze', 'draft', 'summarize', 'cross-reference'];
  return complex.some((k) => query.toLowerCase().includes(k)) ? 'nvidia' : 'huggingface';
}

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
          <p className="citations-label">📎 Sources</p>
          <div className="citations-list">
            {parsed.citations.map((c) => (
              <div key={c.id} className="citation-item">
                <div className="citation-row">
                  {c.excerpt && (
                    <button className="citation-chevron-btn" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} aria-label="Toggle excerpt">
                      {expandedId === c.id ? '▼' : '▶'}
                    </button>
                  )}
                  <span className="citation-id">[{c.id}]</span>
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

// ─── Research Tasks ───────────────────────────────────────────────────────────

interface ResearchTask { icon: 'regulatory' | 'compliance' | 'research' | 'contract'; title: string; description: string; query: string; }

const RESEARCH_TASKS: ResearchTask[] = [
  { icon: 'regulatory', title: 'Regulatory Analysis', description: 'Review legislative changes and impact assessments.', query: 'Perform a regulatory analysis on recent legislative changes and their impact assessments' },
  { icon: 'compliance', title: 'Compliance Check', description: 'Generate documentation and verification checklists.', query: 'Generate a compliance check with documentation and verification checklists' },
  { icon: 'research', title: 'Case Research', description: 'Find legal precedents and court rulings across jurisdictions.', query: 'Find legal precedents and court rulings across jurisdictions for case research' },
  { icon: 'contract', title: 'Contract Review', description: 'Analyze, revise, and detect anomalies in legal agreements.', query: 'Analyze and review legal agreements to detect anomalies and suggest revisions' },
];

const TaskIcon: React.FC<{ type: ResearchTask['icon'] }> = ({ type }) => {
  const icons: Record<string, React.ReactNode> = {
    regulatory: (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18" /><path d="M3 6c2 2 4-2 6 0s4-2 6 0s4-2 6 0" /></svg>),
    compliance: (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4" /><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /></svg>),
    research: (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3L2 8l10 5 10-5-10-5z" /><path d="M2 8v8l10 5 10-5V8" /><path d="M12 13v9" /></svg>),
    contract: (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>),
  };
  return <div className="task-icon-svg">{icons[type]}</div>;
};

// ─── Reasoning Panel ──────────────────────────────────────────────────────────

interface ReasoningStep { label: string; description: string; status: 'done' | 'active' | 'pending'; time?: string; tags?: string[]; resultCount?: string; progress?: number; }

const ReasoningPanel: React.FC<{
  routedTo?: string;
  isTyping?: boolean;
  sessionMetrics?: { totalCarbonG: number; totalTokens: number; queryCount: number };
  lastMetrics?: GreenMetrics;
}> = ({ routedTo, isTyping, sessionMetrics, lastMetrics }) => {
  const steps: ReasoningStep[] = [
    { label: 'Semantic Search', description: 'Indexed legislative documents for relevant provisions.', status: isTyping ? 'active' : 'done', time: nowStr(), tags: ['VectorDB', 'Hybrid Search'] },
    { label: 'Jurisdiction Filtering', description: 'Applied multi-layer filter for applicable jurisdiction.', status: isTyping ? 'pending' : 'done', time: nowStr(), resultCount: '12 RESULTS' },
    { label: 'Cross-Reference Mapping', description: 'Analyzing dependency graphs between sections.', status: isTyping ? 'pending' : 'done', time: nowStr(), progress: isTyping ? 65 : 100 },
    { label: 'Conclusion Synthesis', description: isTyping ? 'Waiting for graph completion.' : 'Final analysis generated.', status: isTyping ? 'pending' : 'done' },
  ];

  return (
    <div className="reasoning-panel">
      <div className="rpanel-header">
        <span className="rpanel-title">AI Reasoning Path</span>
        <span className="rpanel-badge">{routedTo === 'nvidia' ? 'NVIDIA NIM' : 'LANGGRAPH V2'}</span>
      </div>

      <div className="rpanel-steps">
        {steps.map((step, i) => (
          <div key={i} className={`rpanel-step status-${step.status}`}>
            <div className="rpanel-step-dot">
              {step.status === 'done' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#10b981" /><path d="M7 13l3 3 7-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              ) : step.status === 'active' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#2563eb" /><circle cx="12" cy="12" r="4" fill="white" /></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" stroke="#d1d5db" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="#d1d5db" /></svg>
              )}
              {i < steps.length - 1 && <div className={`rpanel-line ${step.status === 'done' ? 'done' : ''}`} />}
            </div>
            <div className="rpanel-step-body">
              <div className="rpanel-step-header">
                <span className="rpanel-step-label">{step.label}</span>
                {step.status === 'active' && <span className="rpanel-processing-badge">Processing</span>}
                {step.time && step.status === 'done' && <span className="rpanel-step-time">{step.time}</span>}
              </div>
              <p className="rpanel-step-desc">{step.description}</p>
              {step.tags && <div className="rpanel-tags">{step.tags.map((t) => <span key={t} className="rpanel-tag">{t}</span>)}</div>}
              {step.resultCount && step.status === 'done' && <span className="rpanel-result-count">{step.resultCount}</span>}
              {step.progress !== undefined && step.status === 'active' && (
                <div className="rpanel-progress-wrap">
                  <div className="rpanel-progress-bar"><div className="rpanel-progress-fill" style={{ width: `${step.progress}%` }} /></div>
                  <span className="rpanel-progress-pct">{step.progress}%</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="trust-score-card">
        <div className="trust-score-header">
          <span className="trust-label">TRUST SCORE</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#10b981" /><path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div className="trust-score-value">
          <span className="trust-number">98.4</span>
          <span className="trust-confidence">High Confidence</span>
        </div>
        <p className="trust-desc">Verified against official legal statute datasets.</p>
      </div>

      {/* Green Metrics Stats — real backend values */}
      <div className="rpanel-stats">
        {(!sessionMetrics || sessionMetrics.queryCount === 0) ? (
          <div className="rpanel-green-empty">
            <span>🌿</span>
            <span>Carbon metrics will appear after your first query.</span>
          </div>
        ) : (
          <>
            <div className="rpanel-stats-section-label">LAST QUERY</div>
            <div className="rpanel-stat-row">
              <span>CO₂ Footprint</span>
              <strong className="rpanel-green-value">
                {lastMetrics && lastMetrics.carbonG > 0 ? `${lastMetrics.carbonG.toFixed(4)}g` : '0.0000g'}
              </strong>
            </div>
            <div className="rpanel-stat-row">
              <span>Tokens Used</span>
              <strong>{lastMetrics && lastMetrics.tokensUsed > 0 ? lastMetrics.tokensUsed.toLocaleString() : '0'}</strong>
            </div>
            <div className="rpanel-stat-row">
              <span>Latency</span>
              <strong>{lastMetrics && lastMetrics.latencyMs > 0 ? `${(lastMetrics.latencyMs / 1000).toFixed(1)}s` : '0.0s'}</strong>
            </div>

            <div className="rpanel-stats-divider" />
            <div className="rpanel-stats-section-label">THIS SESSION</div>
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
            <div className="rpanel-carbon-context">
              <span className="rpanel-carbon-leaf">🌿</span>
              <span>
                {sessionMetrics.totalCarbonG < 1
                  ? `${sessionMetrics.totalCarbonG.toFixed(4)}g CO₂ — less than driving 1 metre`
                  : `${sessionMetrics.totalCarbonG.toFixed(2)}g CO₂ this session`}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const AIagentPage: React.FC<{ darkMode?: boolean; toggleDarkMode?: () => void }> = ({ darkMode, toggleDarkMode }) => {
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([
    { id: 1, type: 'assistant', text: "Hello, I'm your AI Legal Assistant. How can I help you today?", time: nowStr() },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Document preview state
  const [previewCitation, setPreviewCitation] = useState<Citation | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Session-level cumulative green metrics
  const [sessionMetrics, setSessionMetrics] = useState({
    totalCarbonG: 0,
    totalTokens: 0,
    queryCount: 0,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Citation click → fetch full text, show doc preview panel
  const handleCitationClick = useCallback(async (c: Citation) => {
    setPreviewCitation(c);
    setPreviewLoading(true);
    const detail = await fetchSourceDetail(c.id);
    if (detail?.fullText) {
      setPreviewCitation({
        ...c,
        excerpt: cleanText(detail.fullText).slice(0, 6000),
      });
    }
    setPreviewLoading(false);
  }, []);

  const handleSend = useCallback(async (text?: string): Promise<void> => {
    const messageText = (text ?? input).trim();
    if (!messageText || isTyping) return;

    setMessages((prev) => [...prev, { id: Date.now(), type: 'user', text: messageText, time: nowStr() }]);
    setInput('');
    setIsTyping(true);

    try {
      const runId = await createRun(messageText);
      const run = await pollRun(runId);
      const parsed = await parseResponse(run);
      const routedTo = guessRoute(messageText, run);

      // Extract real green metrics from backend reasoningPath
      const metrics: GreenMetrics = {
        carbonG: run.reasoningPath?.carbonTotalG ?? 0,
        tokensUsed: run.reasoningPath?.tokensUsed ?? 0,
        latencyMs: run.reasoningPath?.latencyMs ?? 0,
      };

      // Accumulate into session totals
      setSessionMetrics((prev) => ({
        totalCarbonG: prev.totalCarbonG + metrics.carbonG,
        totalTokens: prev.totalTokens + metrics.tokensUsed,
        queryCount: prev.queryCount + 1,
      }));

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
        },
      ]);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setMessages((prev) => [...prev, { id: Date.now(), type: 'error', text: `⚠ ${errorMsg}`, time: nowStr() }]);
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const lastAssistant = [...messages].reverse().find((m) => m.type === 'assistant' && m.parsed);
  const activeRoutedTo = lastAssistant?.routedTo;
  const hasStartedChat = messages.some((m) => m.type === 'user');

  return (
    <div className="ai-agent-page">
      {/* ─── Left Sidebar ── */}
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
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                <span>Drafts</span>
              </div>
              <div className="sidebar-nav-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>Shared with Team</span>
              </div>
              <NavLink to="/history" className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" />
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
                  <path d="M12 2a4 4 0 0 1 4 4v2H8V6a4 4 0 0 1 4-4z" /><rect x="4" y="8" width="16" height="12" rx="2" />
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

      {/* ─── Main Content ── */}
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
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>Trust Score 98%</span>
              </div>
              {/* Live session CO₂ in header once queries run */}
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
          {/* ── Chat Column ── */}
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
                            <circle cx="12" cy="8" r="4" /><path d="M6 20v-2a6 6 0 0 1 12 0v2" />
                          </svg>
                        </div>
                      )}

                      <div className="message-content">
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
                          {/* Per-query green metrics badge — only shows real non-zero values */}
                          {msg.metrics && (msg.metrics.carbonG > 0 || msg.metrics.tokensUsed > 0) && (
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

                      {msg.type === 'user' && <div className="msg-avatar user-avatar">You</div>}
                    </div>
                  ))}

                  {isTyping && (
                    <div className="message-row assistant">
                      <div className="msg-avatar assistant-avatar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="8" r="4" /><path d="M6 20v-2a6 6 0 0 1 12 0v2" />
                        </svg>
                      </div>
                      <div className="message-content">
                        <div className="message-bubble assistant typing-bubble">
                          <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                        </div>
                      </div>
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
                    <button className={`send-btn ${input.trim() && !isTyping ? 'active' : ''}`} onClick={() => handleSend()} disabled={!input.trim() || isTyping} aria-label="Send message">
                      {isTyping ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <circle cx="12" cy="12" r="9" /><line x1="9" y1="9" x2="15" y2="9" /><line x1="9" y1="15" x2="15" y2="15" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="input-bottom-row">
                    <div className="input-tools">
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
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                      </button>
                      <div className="model-indicator">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#10b981" /></svg>
                        GPT-4 LEGAL MODEL ACTIVE
                      </div>
                    </div>
                  </div>
                  <p className="input-disclaimer">Propylon AI can make mistakes. Check important information before finalizing legal documents.</p>
                </div>
              </main>
            )}

            {!hasStartedChat && (
              <div className="welcome-content">
                <div className="welcome-hero">
                  <div className="welcome-icon-wrap">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3L2 8l10 5 10-5-10-5z" /><path d="M2 8v8l10 5 10-5V8" /><path d="M12 13v9" />
                    </svg>
                  </div>
                  <h1 className="welcome-title">Hi James, Where should we start?</h1>
                  <p className="welcome-subtitle">Select a task or type a query to begin your legal research.</p>
                </div>
                <div className="welcome-tasks-section">
                  <div className="welcome-tasks-label">SUGGESTED RESEARCH TASKS</div>
                  <div className="research-tasks-grid">
                    {RESEARCH_TASKS.map((task, i) => (
                      <button key={i} className="research-task-card" onClick={() => handleSend(task.query)} disabled={isTyping}>
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
                  <button className={`send-btn ${input.trim() && !isTyping ? 'active' : ''}`} onClick={() => handleSend()} disabled={!input.trim() || isTyping} aria-label="Send message">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
                <div className="input-bottom-row">
                  <div className="input-tools">
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
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    </button>
                    <div className="model-indicator">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#10b981" /></svg>
                      GPT-4 LEGAL MODEL ACTIVE
                    </div>
                  </div>
                </div>
                <p className="input-disclaimer">Propylon AI can make mistakes. Check important information before finalizing legal documents.</p>
              </div>
            )}
          </div>

          {/* ── Right Panel — Doc Preview (when open) or Reasoning + Green Metrics ── */}
          {hasStartedChat && (
            <aside className="right-panel">
              <div className="right-panel-content" style={{ paddingTop: '12px' }}>
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
                    sessionMetrics={sessionMetrics}
                    lastMetrics={lastAssistant?.metrics}
                  />
                )}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIagentPage;