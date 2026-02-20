import { useNavigate, useParams } from 'react-router-dom';
import AppSidebar from '../components/AppSidebar';
import '../styles/SharedSidebar.css';
import '../styles/ReportViewPage.css';

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
            <div>
              <h3>RWS Propylon</h3>
              <p>Report #{id}</p>
            </div>
          </div>

          <nav className="report-anchor-nav">
            <a href="#summary">Executive Summary</a>
            <a href="#statutory">Statutory Basis</a>
            <a href="#precedent">Precedents</a>
            <a href="#reasoning">AI Reasoning</a>
          </nav>
        </header>

        <h1>Legal Research Report: IP Infringement Risk</h1>

        <section id="summary">
          <h2>Executive Summary</h2>
          <p>Based on comprehensive analysis, there is a <strong>moderate-to-high risk</strong> of patent infringement regarding our AI ML Platform software.</p>
        </section>

        <section id="statutory">
          <h2>Statutory Basis</h2>
          <div className="info-box">
            <span className="badge">OFFICIAL SOURCE</span>
            <p>...</p>
          </div>
        </section>

        <section id="precedent">
          <h2>Precedents</h2>
          <div className="info-box">
            <span className="badge">CASE LAW</span>
            <p>Doyle v. Residential Tenancies Board supports a restrictive reading where broad software licensing may trigger infringement concerns.</p>
          </div>
        </section>

        <section id="reasoning">
          <h2>AI Reasoning Path</h2>
          <p>The AI analyzed 847 documents across 4 execution steps.</p>
          <button className="report-primary-btn" onClick={() => navigate(`/trace/${id}`)}>
            View Full Trace →
          </button>
        </section>
      </main>

      <aside className="report-right-sidebar">
        <div className="metric-box">
          <h4>Confidence</h4>
          <div className="confidence">98.4%</div>
        </div>
        <div className="metric-box">
          <h4>Impact</h4>
          <p>0.168g CO₂</p>
          <span className="change">↓42%</span>
        </div>
      </aside>
    </div>
  );
};

export default ReportViewPage;