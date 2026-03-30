import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import AppSidebar from '../../components/AppSidebar/AppSidebar';
import '../../components/AppSidebar/SharedSidebar.css';
import './ReportViewPage.css';
import { isRunShared, toggleRunShared } from '../../lib/sharedRuns';
import { API_BASE_URL } from '../../constants/apiConfig';

interface ReportViewPageProps {
  darkMode?: boolean;
  toggleDarkMode?: () => void;
}

interface RunData {
  runId: string;
  title: string;
  status: string;
  priority: string;
  keyFinding?: { summary: string; impactLevel: string; actionRequired: boolean };
  statutoryBasis?: { analysis: { text: string; citations: string[] }[] };
  precedents?: { caseName: string; court: string; year: number; summary: string }[];
  agentCommentary?: { content: string };
  reasoningPath?: { trustScore: number; carbonTotalG: number; steps: { label: string; status: string }[] };
}

const ReportViewPage: React.FC<ReportViewPageProps> = ({ darkMode, toggleDarkMode }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [run, setRun] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isShared, setIsShared] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_BASE_URL}/api/runs/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setRun(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (id) setIsShared(isRunShared(id));
  }, [id]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/workspace');
  };

  const trustScore = run?.reasoningPath?.trustScore ?? 0;
  const carbonG = run?.reasoningPath?.carbonTotalG ?? 0;
  const steps = run?.reasoningPath?.steps ?? [];

  const exportReportJson = () => {
    if (!run) return;
    const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${run.runId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleShared = () => {
    if (!id) return;
    setIsShared(toggleRunShared(id));
  };

  return (
    <div className="report-page">
      <AppSidebar activeItem="workspace" darkMode={darkMode} toggleDarkMode={toggleDarkMode} />

      <main className="report-content">
        <header className="report-header">
          <div className="report-header-main">
            <button className="report-back-btn" onClick={handleBack}>← Back</button>
            <div className="report-id-chip">Report #{id}</div>
          </div>

          <nav className="report-anchor-nav">
            <a href="#summary">Executive Summary</a>
            <a href="#statutory">Statutory Basis</a>
            <a href="#precedent">Precedents</a>
            <a href="#reasoning">AI Reasoning</a>
          </nav>
        </header>

        {loading ? (
          <p style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading report data...</p>
        ) : !run ? (
          <p style={{ padding: '2rem', color: 'var(--text-muted)' }}>
            No report found for this ID. <button onClick={() => navigate('/workspace')} style={{ color: '#2563eb', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>Return to Workspace</button>
          </p>
        ) : (
          <>
            <section className="report-kpis">
              <article className="report-kpi-card">
                <span>Priority</span>
                <strong style={{ textTransform: 'capitalize' }}>{run.priority}</strong>
                <p>{run.keyFinding?.actionRequired ? 'Action required' : 'For review'}</p>
              </article>
              <article className="report-kpi-card">
                <span>Status</span>
                <strong style={{ textTransform: 'capitalize' }}>{run.status}</strong>
                <p>{steps.length} analysis step{steps.length !== 1 ? 's' : ''} completed</p>
              </article>
              <article className="report-kpi-card">
                <span>Trust Score</span>
                <strong>{(trustScore * 100).toFixed(1)}%</strong>
                <p>AI confidence rating</p>
              </article>
            </section>

            <h1>{run.title}</h1>

            <section id="summary" className="report-section">
              <h2>Executive Summary</h2>
              <p>{run.keyFinding?.summary ?? 'No key findings available yet.'}</p>
            </section>

            <section id="statutory" className="report-section">
              <h2>Statutory Basis</h2>
              {run.statutoryBasis?.analysis?.map((a, i) => (
                <div className="info-box" key={i}>
                  <span className="badge">OFFICIAL SOURCE</span>
                  <p>{a.text}</p>
                </div>
              )) ?? <p>No statutory analysis available.</p>}
            </section>

            <section id="precedent" className="report-section">
              <h2>Precedents</h2>
              {run.precedents?.map((p, i) => (
                <div className="info-box" key={i}>
                  <span className="badge">CASE LAW</span>
                  <p><strong>{p.caseName}</strong> ({p.court}, {p.year}) — {p.summary}</p>
                </div>
              )) ?? <p>No precedents found.</p>}
            </section>

            <section id="reasoning" className="report-section">
              <h2>AI Reasoning Path</h2>
              <p>{run.agentCommentary?.content ?? 'No AI commentary available.'}</p>
              <button className="report-primary-btn" onClick={() => navigate(`/trace/${id}`)}>
                View Full Trace →
              </button>
            </section>
          </>
        )}
      </main>

      <aside className="report-right-sidebar">
        <div className="metric-box highlight">
          <h4>Trust Score</h4>
          <div className="confidence">{run ? `${(trustScore * 100).toFixed(1)}%` : '—'}</div>
          <p>Validated against primary legislative sources.</p>
        </div>

        <div className="metric-box">
          <h4>Quick Actions</h4>
          <button className="report-side-btn" onClick={() => navigate(`/trace/${id}`)}>Open Execution Trace</button>
          <button className="report-side-btn" onClick={exportReportJson}>Export Report (JSON)</button>
          <button className="report-side-btn" onClick={toggleShared}>
            {isShared ? 'Remove from Team Share' : 'Share with Team'}
          </button>
          <button className="report-side-btn" onClick={() => window.print()}>Export PDF (Print)</button>
        </div>

        <div className="metric-box">
          <h4>Sustainability</h4>
          <p className="impact-value">{carbonG.toFixed(3)}g CO₂</p>
        </div>
      </aside>
    </div>
  );
};

export default ReportViewPage;
