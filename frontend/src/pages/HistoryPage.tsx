import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/HistoryPage.css';

const HistoryPage = () => {
  const navigate = useNavigate();

  const cases = [
    { id: 1, title: "Patent Infringement Analysis", date: "2026-01-15", confidence: "98.4%" },
    { id: 2, title: "Employment Law Review", date: "2026-01-10", confidence: "96.2%" },
    { id: 3, title: "Commercial Lease", date: "2026-01-05", confidence: "94.8%" },
    { id: 4, title: "Data Privacy Compliance", date: "2026-01-28", confidence: "97.1%" }
  ];

  return (
    <div className="history-page">
      <header>
        <div>
          <button onClick={() => navigate('/workspace')}>← Back</button>
          <h1>Research History</h1>
        </div>
        <button className="btn btn-primary">Export All</button>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Cases</div>
          <div className="stat-value">247</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Confidence</div>
          <div className="stat-value">96.8%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">This Month</div>
          <div className="stat-value">23</div>
        </div>
      </div>

      <div className="filters">
        <button className="btn">Date Range</button>
        <button className="btn">Document Type</button>
        <input type="text" placeholder="Search archived cases..." />
      </div>

      <div className="timeline">
        <h2>January 2026</h2>
        <div className="history-grid">
          {cases.map(c => (
            <div key={c.id} className="history-card">
              <div className="card-header">
                <span className="date">{c.date}</span>
                <span className="confidence">Confidence: {c.confidence}</span>
              </div>
              <h3>{c.title}</h3>
              <div className="card-actions">
                <button className="btn btn-primary" onClick={() => navigate(`/report/${c.id}`)}>
                  View Report
                </button>
                <button className="btn">Download</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;