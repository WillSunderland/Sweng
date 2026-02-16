<<<<<<< HEAD
=======
import React from 'react';
>>>>>>> 89f298109 (Add all page components for frontend)
import { useNavigate, useParams } from 'react-router-dom';
import '../styles/AnalysisPage.css';

const AnalysisPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <div className="analysis-page">
      <aside className="sidebar">
        <h3 onClick={() => navigate('/')}>RWS Propylon</h3>
        <nav>
          <div onClick={() => navigate('/workspace')}>Dashboard</div>
          <div className="active">Research</div>
          <div onClick={() => navigate('/history')}>Archive</div>
        </nav>
      </aside>

      <main className="analysis-content">
        <h1>Legal Analysis: Residential Tenancies Act 2024</h1>
        
        <div className="key-finding">
          <h3>KEY FINDING</h3>
          <p>The 2024 Amendment strictly regulates rent increases in Rent Pressure Zones, introducing mandatory 90-day notice periods.</p>
        </div>

        <section>
          <h2>Statutory Basis</h2>
          <div className="info-box">
            <span className="badge">OFFICIAL</span>
            <p>Pursuant to <strong>Section 63(a) of the Residential Tenancies Act 2024</strong>, mandated rent increase caps are now tied to Dublin rent pressure zones.</p>
          </div>
        </section>

        <section>
          <h2>Precedent Support</h2>
          <div className="precedent-card">
            <div className="precedent-header">
              <span>SUPREME COURT 2022</span>
              <span className="badge">BINDING</span>
            </div>
            <h4>Doyle v. Residential Tenancies Board</h4>
            <p>Supreme Court affirmed restrictive construction of residential rental agreements...</p>
          </div>
        </section>

        <button className="btn btn-primary" onClick={() => navigate(`/trace/${id}`)}>
          View Full Trace
        </button>
      </main>

      <aside className="right-sidebar">
        <div className="sidebar-box">
          <h4>AI REASONING</h4>
          <p>✓ Semantic Search</p>
          <p>✓ Cross-Reference Mapping</p>
        </div>
        <div className="sidebar-box">
          <h4>CONFIDENCE</h4>
          <div className="confidence">98.4%</div>
        </div>
      </aside>
    </div>
  );
};

export default AnalysisPage;