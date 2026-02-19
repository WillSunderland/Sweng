import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Workspacepage.css';

const WorkspacePage = () => {
  const navigate = useNavigate();

  const cases = [
    { id: 1, title: "Commercial Tenancies Review", status: "complete" },
    { id: 2, title: "Data Protection Analysis", status: "processing" },
    { id: 3, title: "IP Audit", status: "review-needed" },
    { id: 4, title: "Employment Contract", status: "draft" }
  ];

  const handleCaseClick = (caseItem) => {
    if (caseItem.status === 'complete') navigate(`/report/${caseItem.id}`);
    else if (caseItem.status === 'processing') navigate(`/trace/${caseItem.id}`);
    else if (caseItem.status === 'review-needed') navigate(`/analysis/${caseItem.id}`);
  };

  return (
    <div className="workspace-page">
      <aside className="sidebar">
        <h3 onClick={() => navigate('/')}>RWS Propylon</h3>
        <nav>
          <div className="nav-item active">Workspace</div>
          <div className="nav-item">Drafts</div>
          <div className="nav-item" onClick={() => navigate('/history')}>History</div>
        </nav>
      </aside>

      <main className="main-content">
        <header>
          <h1>Active Research Cases</h1>
          <input type="text" placeholder="Search..." />
        </header>

        <div className="cases-grid">
          {cases.map(c => (
            <div key={c.id} className="case-card" onClick={() => handleCaseClick(c)}>
              <span className={`status ${c.status}`}>{c.status}</span>
              <h3>{c.title}</h3>
              <button className="btn btn-primary">Open</button>
            </div>
          ))}
        </div>

        <button className="btn btn-primary">+ New Case</button>
      </main>

      <aside className="right-sidebar">
        <div className="sidebar-section">
          <h4>Trends</h4>
          <p>AI Efficiency Laws trending globally</p>
        </div>
        <div className="sidebar-section">
          <h4>Activity</h4>
          <p>Legislation update detected</p>
        </div>
      </aside>
    </div>
  );
};

export default WorkspacePage;