import { useNavigate, useParams } from 'react-router-dom';
import AppSidebar from '../../components/AppSidebar/AppSidebar';
import '../../components/AppSidebar/SharedSidebar.css';
import './ReportViewPage.css';

const ReportViewPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/workspace');
  };

  return (
    <div className="report-page">
      <AppSidebar activeItem="workspace" />

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

        <section className="report-kpis">
          <article className="report-kpi-card">
            <span>Risk Level</span>
            <strong>Moderate-High</strong>
            <p>Immediate legal review recommended</p>
          </article>
          <article className="report-kpi-card">
            <span>Sources Reviewed</span>
            <strong>847</strong>
            <p>Statute, case law, and policy records</p>
          </article>
          <article className="report-kpi-card">
            <span>Confidence</span>
            <strong>98.4%</strong>
            <p>High reliability synthesis</p>
          </article>
        </section>

        <h1>Legal Research Report: IP Infringement Risk</h1>

        <section id="summary" className="report-section">
          <h2>Executive Summary</h2>
          <p>Based on comprehensive analysis, there is a <strong>moderate-to-high risk</strong> of patent infringement regarding our AI ML Platform software.</p>
        </section>

        <section id="statutory" className="report-section">
          <h2>Statutory Basis</h2>
          <div className="info-box">
            <span className="badge">OFFICIAL SOURCE</span>
            <p>...</p>
          </div>
        </section>

        <section id="precedent" className="report-section">
          <h2>Precedents</h2>
          <div className="info-box">
            <span className="badge">CASE LAW</span>
            <p>Doyle v. Residential Tenancies Board supports a restrictive reading where broad software licensing may trigger infringement concerns.</p>
          </div>
        </section>

        <section id="reasoning" className="report-section">
          <h2>AI Reasoning Path</h2>
          <p>The AI analyzed 847 documents across 4 execution steps.</p>
          <button className="report-primary-btn" onClick={() => navigate(`/trace/${id}`)}>
            View Full Trace →
          </button>
        </section>
      </main>

      <aside className="report-right-sidebar">
        <div className="metric-box highlight">
          <h4>Confidence</h4>
          <div className="confidence">98.4%</div>
          <p>Validated against primary legislative sources.</p>
        </div>

        <div className="metric-box">
          <h4>Quick Actions</h4>
          <button className="report-side-btn">Export PDF</button>
          <button className="report-side-btn">Share to Team</button>
          <button className="report-side-btn" onClick={() => navigate(`/trace/${id}`)}>Open Execution Trace</button>
        </div>

        <div className="metric-box">
          <h4>Source Coverage</h4>
          <ul className="report-side-list">
            <li><span>Statutory Sources</span><strong>512</strong></li>
            <li><span>Precedent Cases</span><strong>221</strong></li>
            <li><span>Secondary Notes</span><strong>114</strong></li>
          </ul>
        </div>

        <div className="metric-box">
          <h4>Risk Snapshot</h4>
          <ul className="report-side-list risk">
            <li>License scope ambiguity detected</li>
            <li>Comparable precedent indicates heightened exposure</li>
            <li>Action required prior to external release</li>
          </ul>
        </div>

        <div className="metric-box">
          <h4>Sustainability</h4>
          <p className="impact-value">0.168g CO₂</p>
          <span className="change">↓42% vs baseline</span>
        </div>
      </aside>
    </div>
  );
};

export default ReportViewPage;