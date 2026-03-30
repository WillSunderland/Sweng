import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppSidebar from '../../components/AppSidebar/AppSidebar';
import '../../components/AppSidebar/SharedSidebar.css';
import './AnalysisPage.css';
import { API_BASE_URL } from '../../constants/apiConfig';

interface AnalysisPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

interface RunData {
  runId: string;
  title: string;
  status: string;
  keyFinding?: { summary: string; impactLevel: string; actionRequired: boolean };
  statutoryBasis?: { analysis: { text: string; citations: string[] }[] };
  precedents?: { caseName: string; court: string; year: number; authority: string; summary: string }[];
  reasoningPath?: { trustScore: number };
}

const AnalysisPage: React.FC<AnalysisPageProps> = ({ darkMode, toggleDarkMode }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [run, setRun] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);

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

  const trustScore = run?.reasoningPath?.trustScore ?? 0;

  return (
    <div className="analysis-page">
      <AppSidebar activeItem="workspace" darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      <main className="analysis-content">
        {loading ? (
          <p style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading analysis...</p>
        ) : !run ? (
          <p style={{ padding: '2rem', color: 'var(--text-muted)' }}>
            No analysis found for this ID.{' '}
            <button onClick={() => navigate('/workspace')} style={{ color: '#2563eb', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
              Return to Workspace
            </button>
          </p>
        ) : (
          <>
            <p className="analysis-kicker">LEGAL ANALYSIS</p>
            <h1>{run.title}</h1>
            {run.keyFinding && (
              <div className="key-finding">
                <h3>KEY FINDING</h3>
                <p>{run.keyFinding.summary}</p>
              </div>
            )}
            {run.statutoryBasis?.analysis?.length ? (
              <section>
                <h2>Statutory Basis</h2>
                {run.statutoryBasis.analysis.map((a, i) => (
                  <div className="info-box" key={i}>
                    <span className="badge">OFFICIAL</span>
                    <p>{a.text}</p>
                  </div>
                ))}
              </section>
            ) : null}
            {run.precedents?.length ? (
              <section>
                <h2>Precedent Support</h2>
                {run.precedents.map((p, i) => (
                  <div className="precedent-card" key={i}>
                    <div className="precedent-header">
                      <span>{p.court} {p.year}</span>
                      <span className="badge" style={{ textTransform: 'uppercase' }}>{p.authority}</span>
                    </div>
                    <h4>{p.caseName}</h4>
                    <p>{p.summary}</p>
                  </div>
                ))}
              </section>
            ) : null}
            <button className="analysis-primary-btn" onClick={() => navigate(`/trace/${id}`)}>
              View Full Trace
            </button>
          </>
        )}
      </main>
      <aside className="analysis-right-sidebar">
        <div className="sidebar-box">
          <h4>AI REASONING</h4>
          <p>Semantic Search + Cross-Reference</p>
        </div>
        <div className="sidebar-box">
          <h4>CONFIDENCE</h4>
          <div className="confidence">{run ? `${(trustScore * 100).toFixed(1)}%` : '—'}</div>
        </div>
      </aside>
    </div>
  );
};

export default AnalysisPage;
