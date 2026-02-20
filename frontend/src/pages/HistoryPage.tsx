
import { useNavigate } from 'react-router-dom';
import AppSidebar from '../components/AppSidebar';
import '../styles/SharedSidebar.css';
import '../styles/HistoryPage.css';

const HistoryPage = () => {
  const navigate = useNavigate();

  const cases = [
    { id: 1, title: 'Patent Infringement Analysis', date: '2026-01-15', confidence: '98.4%', type: 'Litigation', team: 'IP Counsel' },
    { id: 2, title: 'Employment Law Review', date: '2026-01-10', confidence: '96.2%', type: 'Advisory', team: 'Labor & Employment' },
    { id: 3, title: 'Commercial Lease', date: '2026-01-05', confidence: '94.8%', type: 'Contracts', team: 'Commercial Team' },
    { id: 4, title: 'Data Privacy Compliance', date: '2026-01-28', confidence: '97.1%', type: 'Regulatory', team: 'Privacy Desk' },
    { id: 5, title: 'M&A Risk Summary', date: '2025-12-22', confidence: '95.6%', type: 'Due Diligence', team: 'Transactions' },
    { id: 6, title: 'Vendor Terms Reconciliation', date: '2025-12-11', confidence: '93.9%', type: 'Contracts', team: 'Procurement Legal' },
  ];

  const januaryCases = cases.filter((item) => item.date.startsWith('2026-01'));
  const decemberCases = cases.filter((item) => item.date.startsWith('2025-12'));

  return (
    <div className="history-page">
      <AppSidebar activeItem="archive" />

      <main className="history-main">
        <header className="history-header">
          <div className="history-header-left">
            <button className="history-back-btn" onClick={() => navigate('/workspace')}>←</button>
            <div>
              <h1>Archive</h1>
              <p>Historical research cases, reports, and trace outputs.</p>
            </div>
          </div>
          <div className="history-header-actions">
            <button className="history-secondary-btn">Bulk Select</button>
            <button className="history-primary-btn">Export All</button>
          </div>
        </header>

        <div className="history-search-row">
          <input type="text" placeholder="Search archived cases, citations, or tags..." />
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Cases</div>
            <div className="stat-value">247</div>
            <div className="stat-meta">+14 in last 30 days</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Confidence</div>
            <div className="stat-value">96.8%</div>
            <div className="stat-meta">Model quality stable</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">This Month</div>
            <div className="stat-value">23</div>
            <div className="stat-meta">7 pending review</div>
          </div>
        </div>

        <div className="filters">
          <button className="history-filter-btn">Date Range</button>
          <button className="history-filter-btn">Document Type</button>
          <button className="history-filter-btn">Confidence</button>
          <button className="history-filter-btn">Team</button>
        </div>

        <div className="timeline">
          <h2>January 2026</h2>
          <div className="history-grid">
            {januaryCases.map((c) => (
              <div key={c.id} className="history-card">
                <div className="card-header">
                  <span className="date">{c.date}</span>
                  <span className="confidence">Confidence: {c.confidence}</span>
                </div>
                <h3>{c.title}</h3>
                <div className="history-card-tags">
                  <span>{c.type}</span>
                  <span>{c.team}</span>
                </div>
                <div className="card-actions">
                  <button className="history-primary-btn" onClick={() => navigate(`/report/${c.id}`)}>
                    View Report
                  </button>
                  <button className="history-link-btn">Download</button>
                  <button className="history-link-btn" onClick={() => navigate(`/trace/${c.id}`)}>Trace</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="timeline">
          <h2>December 2025</h2>
          <div className="history-grid">
            {decemberCases.map((c) => (
              <div key={c.id} className="history-card">
                <div className="card-header">
                  <span className="date">{c.date}</span>
                  <span className="confidence">Confidence: {c.confidence}</span>
                </div>
                <h3>{c.title}</h3>
                <div className="history-card-tags">
                  <span>{c.type}</span>
                  <span>{c.team}</span>
                </div>
                <div className="card-actions">
                  <button className="history-primary-btn" onClick={() => navigate(`/report/${c.id}`)}>
                    View Report
                  </button>
                  <button className="history-link-btn">Download</button>
                  <button className="history-link-btn" onClick={() => navigate(`/trace/${c.id}`)}>Trace</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

    </div>
  );
};

export default HistoryPage;