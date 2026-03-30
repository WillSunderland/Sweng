import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu, BookOpen, Sparkles, CheckCircle2,
  Leaf, Zap, ArrowLeft, Shield, GitBranch,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppSidebar from '../../components/AppSidebar/AppSidebar';
import '../../components/AppSidebar/SharedSidebar.css';
import './ExecutionTracePage.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExecutionTracePageProps {
  darkMode?: boolean;
  toggleDarkMode?: () => void;
}

type StageKey = 'init' | 'accessing' | 'synthesizing' | 'checking';
type StepStatus = 'complete' | 'running' | 'pending';

interface TraceStep {
  id: number;
  key: StageKey;
  title: string;
  status: StepStatus;
  elapsed: number | null;
  detail: string;
  docCount?: number;
  tokens?: number;
}

// ─── Stage Metadata ───────────────────────────────────────────────────────────

const STAGE_META: Record<StageKey, { Icon: React.ElementType; color: string; thoughts: string[] }> = {
  init: {
    Icon: Cpu,
    color: '#64748b',
    thoughts: [
      'Initialising legal intelligence engine...',
      'Loading legislative knowledge base...',
    ],
  },
  accessing: {
    Icon: BookOpen,
    color: '#f59e0b',
    thoughts: [
      'Fetching primary statutes from corpus...',
      'Loading citation anchors and references...',
      'Mapping linked legislative sections...',
    ],
  },
  synthesizing: {
    Icon: Sparkles,
    color: 'var(--accent-blue)',
    thoughts: [
      'Cross-referencing obligations and precedents...',
      'Mapping statutory relationships...',
      'Confidence scoring retrieved clauses...',
      'Evaluating legislative intent...',
    ],
  },
  checking: {
    Icon: CheckCircle2,
    color: 'var(--accent-green)',
    thoughts: [
      'Calculating carbon impact estimate...',
      'Optimising retrieval efficiency...',
    ],
  },
};

// ─── useLiveTimer ─────────────────────────────────────────────────────────────

function useLiveTimer(active: boolean, startFrom = 0): number {
  const [elapsed, setElapsed] = useState(startFrom);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) { startRef.current = null; return; }
    startRef.current = Date.now() - startFrom * 1000;
    const id = setInterval(() => {
      setElapsed((Date.now() - startRef.current!) / 1000);
    }, 80);
    return () => clearInterval(id);
  }, [active]);

  return elapsed;
}

// ─── CompletedStageCard ───────────────────────────────────────────────────────

const CompletedStageCard: React.FC<{ step: TraceStep; index: number }> = ({ step, index }) => {
  const { Icon, color, thoughts } = STAGE_META[step.key];
  return (
    <div className="tc-wrapper">
      <div className="tc-row">
        <div className="tc-index-col">
          <div className="tc-index tc-index--done">{index + 1}</div>
          <div className="tc-index-line tc-index-line--done" />
        </div>
        <div className="tc-card" style={{ borderLeftColor: color }}>
          <div className="tc-header">
            <div className="tc-step-name">
              <Icon size={11} strokeWidth={2.5} style={{ color }} />
              <span style={{ color }}>{step.key.toUpperCase()}</span>
              <span className="tc-badge tc-badge--done">
                <CheckCircle2 size={8} strokeWidth={3} />
                Done
              </span>
            </div>
            <span className="tc-time">{step.elapsed?.toFixed(3)}s</span>
          </div>
          <p className="tc-title-text">{step.title}</p>
          <div className="tc-logic">
            <span className="tc-logic-label">AGENT REASONING</span>
            <p className="tc-logic-text">"{thoughts[0]}"</p>
          </div>
          <div className="tc-metrics">
            <div className="tc-metric">
              <span className="tc-metric-label">ELAPSED</span>
              <span className="tc-metric-val">{step.elapsed?.toFixed(3)}s</span>
            </div>
            {step.docCount != null && (
              <div className="tc-metric">
                <span className="tc-metric-label">DOCS</span>
                <span className="tc-metric-val">{step.docCount}</span>
              </div>
            )}
            {step.tokens != null && (
              <div className="tc-metric">
                <span className="tc-metric-label">TOKENS</span>
                <span className="tc-metric-val">{step.tokens}</span>
              </div>
            )}
            <div className="tc-metric">
              <span className="tc-metric-label">STATUS</span>
              <span className="tc-metric-val tc-metric-val--done">PROCESSED</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── RunningStageCard ─────────────────────────────────────────────────────────

const RunningStageCard: React.FC<{ step: TraceStep; index: number }> = ({ step, index }) => {
  const { Icon, color, thoughts } = STAGE_META[step.key];
  const [thoughtIdx, setThoughtIdx] = useState(0);
  const [thoughtKey, setThoughtKey] = useState(0);
  const liveElapsed = useLiveTimer(true, step.elapsed ?? 0);

  useEffect(() => {
    if (thoughts.length <= 1) return;
    const id = setInterval(() => {
      setThoughtIdx((i) => { setThoughtKey((k) => k + 1); return (i + 1) % thoughts.length; });
    }, 2500);
    return () => clearInterval(id);
  }, [thoughts.length]);

  return (
    <div className="tc-wrapper">
      <div className="tc-row">
        <div className="tc-index-col">
          <div className="tc-index tc-index--running">
            <span className="tc-index-spinner" style={{ borderTopColor: color }} />
          </div>
          <div className="tc-index-line tc-index-line--pending" />
        </div>
        <div className="tc-card tc-card--active" style={{ borderLeftColor: color }} role="status" aria-live="polite">
          <div className="tc-header">
            <div className="tc-step-name">
              <Icon size={11} strokeWidth={2.5} style={{ color }} />
              <span style={{ color }}>{step.key.toUpperCase()}</span>
              <span className="tc-badge tc-badge--running">
                <div className="tc-neural-bars" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="tc-neural-bar" style={{ animationDelay: `${i * 0.18}s`, background: color }} />
                  ))}
                </div>
                Processing
              </span>
            </div>
            <span className="tc-time tc-time--live">{liveElapsed.toFixed(2)}s</span>
          </div>
          <p className="tc-title-text">{step.title}</p>
          <div className="tc-logic tc-logic--active" style={{ borderColor: `color-mix(in srgb, ${color} 20%, var(--border-light))` }}>
            <span className="tc-logic-label" style={{ color }}>AGENT REASONING</span>
            <p key={thoughtKey} className="tc-logic-text tc-logic-text--animated">"{thoughts[thoughtIdx]}"</p>
          </div>
          <div className="tc-metrics">
            <div className="tc-metric">
              <span className="tc-metric-label">ELAPSED</span>
              <span className="tc-metric-val">{liveElapsed.toFixed(2)}s</span>
            </div>
            <div className="tc-metric">
              <span className="tc-metric-label">STATUS</span>
              <span className="tc-metric-val tc-metric-val--active">LIVE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── PendingStageCard ─────────────────────────────────────────────────────────

const PendingStageCard: React.FC<{ step: TraceStep; index: number; isLast: boolean }> = ({ step, index, isLast }) => {
  const { Icon } = STAGE_META[step.key];
  return (
    <div className="tc-wrapper tc-wrapper--pending">
      <div className="tc-row">
        <div className="tc-index-col">
          <div className="tc-index tc-index--pending">{index + 1}</div>
          {!isLast && <div className="tc-index-line tc-index-line--pending" />}
        </div>
        <div className="tc-card tc-card--pending">
          <div className="tc-header">
            <div className="tc-step-name">
              <Icon size={11} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
              <span style={{ color: 'var(--text-muted)' }}>{step.key.toUpperCase()}</span>
              <span className="tc-badge tc-badge--pending">Queued</span>
            </div>
            <span className="tc-time tc-time--muted">—</span>
          </div>
          <p className="tc-title-text tc-title-text--muted">{step.title}</p>
          <p className="tc-desc">{step.detail}</p>
        </div>
      </div>
    </div>
  );
};

// ─── ExecutionTracePage ───────────────────────────────────────────────────────

const ExecutionTracePage: React.FC<ExecutionTracePageProps> = ({ darkMode, toggleDarkMode }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) { navigate(-1); return; }
    navigate('/workspace');
  };

  const steps: TraceStep[] = [
    {
      id: 1, key: 'init', title: 'Agent Initialisation', status: 'complete',
      elapsed: 0.157, detail: 'Model context and retrieval index initialised for current report scope.',
      tokens: 128,
    },
    {
      id: 2, key: 'accessing', title: 'Statute Corpus Access', status: 'complete',
      elapsed: 0.404, detail: 'Primary statutes and linked references loaded with citation anchors.',
      docCount: 847, tokens: 412,
    },
    {
      id: 3, key: 'synthesizing', title: 'Synthesis — Section 12', status: 'running',
      elapsed: 0.987, detail: 'Cross-referencing obligations, precedents, and confidence adjustments.',
    },
    {
      id: 4, key: 'checking', title: 'Sustainability Validation', status: 'pending',
      elapsed: null, detail: 'Final carbon estimate calculation and optimisation scoring.',
    },
  ];

  const completedCount = steps.filter(s => s.status === 'complete').length;
  const progressPct = (completedCount / steps.length) * 100;

  return (
    <div className="trace-page">
      <AppSidebar activeItem="workspace" darkMode={darkMode} toggleDarkMode={toggleDarkMode} />

      <main className="trace-main">

        {/* ── Page Header ── */}
        <header className="trace-header">
          <div className="trace-breadcrumb">
            <button className="trace-back-btn" onClick={handleBack}>
              <ArrowLeft size={14} strokeWidth={2.5} />
              Active Research Cases
            </button>
            <span className="trace-breadcrumb-sep">/</span>
            <span className="trace-breadcrumb-current">Execution Trace</span>
          </div>

          <div className="trace-title-row">
            <div className="trace-title-left">
              <div className="trace-title-badge">
                <span className="trace-live-dot" />
                LIVE
              </div>
              <div>
                <h1 className="trace-title">Execution Trace</h1>
                <p className="trace-query">
                  "What are the compliance requirements for commercial tenancies under the 2023 amendments?"
                </p>
              </div>
            </div>
            <div className="trace-title-meta">
              <div className="trace-meta-item">
                <span className="trace-meta-label">Agent</span>
                <span className="trace-meta-val">propylon-vm-a9-3</span>
              </div>
              <div className="trace-meta-item">
                <span className="trace-meta-label">Started</span>
                <span className="trace-meta-val">12:41:08 UTC</span>
              </div>
            </div>
          </div>

          {/* Pipeline progress bar */}
          <div className="trace-progress-wrap">
            <div className="trace-progress-labels">
              <span>{completedCount} of {steps.length} stages complete</span>
              <span>{progressPct.toFixed(0)}%</span>
            </div>
            <div className="trace-progress-bar">
              <div className="trace-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </header>

        {/* ── KPI Strip ── */}
        <section className="trace-kpi-strip">
          <div className="trace-kpi-card">
            <div className="trace-kpi-icon" style={{ background: 'color-mix(in srgb, var(--accent-blue) 10%, var(--card-bg))' }}>
              <Zap size={14} style={{ color: 'var(--accent-blue)' }} strokeWidth={2.5} />
            </div>
            <div>
              <strong>1.248s</strong>
              <span>Total Latency</span>
            </div>
          </div>
          <div className="trace-kpi-card">
            <div className="trace-kpi-icon" style={{ background: 'color-mix(in srgb, #f59e0b 10%, var(--card-bg))' }}>
              <BookOpen size={14} style={{ color: '#f59e0b' }} strokeWidth={2.5} />
            </div>
            <div>
              <strong>847</strong>
              <span>Documents</span>
            </div>
          </div>
          <div className="trace-kpi-card">
            <div className="trace-kpi-icon" style={{ background: 'color-mix(in srgb, var(--accent-green) 10%, var(--card-bg))' }}>
              <Shield size={14} style={{ color: 'var(--accent-green)' }} strokeWidth={2.5} />
            </div>
            <div>
              <strong>98.4%</strong>
              <span>Confidence</span>
            </div>
          </div>
          <div className="trace-kpi-card">
            <div className="trace-kpi-icon" style={{ background: 'color-mix(in srgb, #10b981 10%, var(--card-bg))' }}>
              <Leaf size={14} style={{ color: '#10b981' }} strokeWidth={2.5} />
            </div>
            <div>
              <strong>0.168g</strong>
              <span>CO₂ Emitted</span>
            </div>
          </div>
        </section>

        {/* ── Main Content ── */}
        <div className="trace-content">

          {/* Timeline */}
          <section className="trace-timeline">
            <div className="trace-timeline-header">
              <h2>Pipeline Stages</h2>
              <span className="trace-timeline-badge">
                {completedCount}/{steps.length} complete
              </span>
            </div>
            <div className="thought-stream">
              {steps.map((step, i) => {
                const isLast = i === steps.length - 1;
                if (step.status === 'complete') return <CompletedStageCard key={step.id} step={step} index={i} />;
                if (step.status === 'running')  return <RunningStageCard   key={step.id} step={step} index={i} />;
                return <PendingStageCard key={step.id} step={step} index={i} isLast={isLast} />;
              })}
            </div>
          </section>

          {/* Right Panel */}
          <aside className="trace-inspector">

            {/* Session Info */}
            <div className="insp-section">
              <h3 className="insp-title">Session Info</h3>
              <div className="insp-kv-grid">
                {[
                  { label: 'Agent ID',   value: 'propylon-vm-a9-3' },
                  { label: 'Latency',    value: '589.22 ms' },
                  { label: 'Retrieval',  value: '847 hits' },
                  { label: 'Run ID',     value: 'run_a9f3c1' },
                ].map(({ label, value }) => (
                  <div key={label} className="insp-kv-row">
                    <span className="insp-kv-label">{label}</span>
                    <span className="insp-kv-val">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Confidence */}
            <div className="insp-section">
              <div className="insp-section-header">
                <h3 className="insp-title">Confidence Score</h3>
                <span className="insp-score-val">98.4%</span>
              </div>
              <div className="insp-bar-track">
                <div className="insp-bar-fill insp-bar-fill--confidence" style={{ width: '98.4%' }} />
              </div>
              <p className="insp-bar-caption">High-confidence synthesis · enterprise grade</p>
            </div>

            {/* Carbon Footprint */}
            <div className="insp-section insp-section--green">
              <div className="insp-green-header">
                <div className="insp-green-icon">
                  <Leaf size={13} strokeWidth={2} />
                </div>
                <div>
                  <h3 className="insp-title">Carbon Footprint</h3>
                  <p className="insp-green-sub">This session</p>
                </div>
                <span className="insp-green-badge">↓42% avg</span>
              </div>
              <div className="insp-co2-row">
                <span className="insp-co2-val">0.168g</span>
                <span className="insp-co2-unit">CO₂e</span>
              </div>
              <div className="insp-bar-track insp-bar-track--thin">
                <div className="insp-bar-fill insp-bar-fill--green" style={{ width: '23%' }} />
                <div className="insp-bar-avg-marker" title="Industry average" />
              </div>
              <div className="insp-co2-scale">
                <span>0g</span>
                <span className="insp-co2-avg-label">↑ industry avg</span>
                <span>1.89g</span>
              </div>
            </div>

            {/* Model Routing */}
            <div className="insp-section">
              <h3 className="insp-title">Model Routing</h3>
              <div className="insp-routing-stack">
                <div className="insp-routing-node insp-routing-node--primary">
                  <GitBranch size={12} strokeWidth={2} />
                  <div className="insp-routing-info">
                    <span className="insp-routing-name">NVIDIA NIM</span>
                    <span className="insp-routing-role">Primary Inference</span>
                  </div>
                  <span className="insp-routing-dot insp-routing-dot--active" />
                </div>
                <div className="insp-routing-connector" />
                <div className="insp-routing-node">
                  <Sparkles size={12} strokeWidth={2} />
                  <div className="insp-routing-info">
                    <span className="insp-routing-name">LangGraph</span>
                    <span className="insp-routing-role">Orchestration</span>
                  </div>
                  <span className="insp-routing-dot insp-routing-dot--active" />
                </div>
              </div>
            </div>

          </aside>
        </div>
      </main>
    </div>
  );
};

export default ExecutionTracePage;
