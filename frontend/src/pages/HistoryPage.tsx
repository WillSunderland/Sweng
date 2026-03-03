
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import AppSidebar from '../components/AppSidebar';
import '../styles/SharedSidebar.css';
import '../styles/HistoryPage.css';

type SortKey = 'date' | 'type' | 'confidence' | 'team';
type SortDirection = 'asc' | 'desc';

interface ArchiveCase {
  id: number;
  title: string;
  date: string;
  confidence: string;
  type: string;
  team: string;
}

const HistoryPage = () => {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const cases: ArchiveCase[] = [
    { id: 1, title: 'Patent Infringement Analysis', date: '2026-01-15', confidence: '98.4%', type: 'Litigation', team: 'IP Counsel' },
    { id: 2, title: 'Employment Law Review', date: '2026-01-10', confidence: '96.2%', type: 'Advisory', team: 'Labor & Employment' },
    { id: 3, title: 'Commercial Lease', date: '2026-01-05', confidence: '94.8%', type: 'Contracts', team: 'Commercial Team' },
    { id: 4, title: 'Data Privacy Compliance', date: '2026-01-28', confidence: '97.1%', type: 'Regulatory', team: 'Privacy Desk' },
    { id: 5, title: 'M&A Risk Summary', date: '2025-12-22', confidence: '95.6%', type: 'Due Diligence', team: 'Transactions' },
    { id: 6, title: 'Vendor Terms Reconciliation', date: '2025-12-11', confidence: '93.9%', type: 'Contracts', team: 'Procurement Legal' },
  ];

  const handleSortChange = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prevDirection) => (prevDirection === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    setSortDirection(key === 'date' || key === 'confidence' ? 'desc' : 'asc');
  };

  const sortCases = (items: ArchiveCase[]) => {
    const sorted = [...items];

    sorted.sort((firstCase, secondCase) => {
      let comparison = 0;

      if (sortKey === 'date') {
        comparison = firstCase.date.localeCompare(secondCase.date);
      } else if (sortKey === 'confidence') {
        const firstConfidence = parseFloat(firstCase.confidence);
        const secondConfidence = parseFloat(secondCase.confidence);
        comparison = firstConfidence - secondConfidence;
      } else if (sortKey === 'type') {
        comparison = firstCase.type.localeCompare(secondCase.type);
      } else if (sortKey === 'team') {
        comparison = firstCase.team.localeCompare(secondCase.team);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  };

  const sortedJanuaryCases = sortCases(cases.filter((item) => item.date.startsWith('2026-01')));

  const sortedDecemberCases = sortCases(cases.filter((item) => item.date.startsWith('2025-12')));

  const getSortLabel = (label: string, key: SortKey) => {
    if (sortKey !== key) return label;
    return `${label} ${sortDirection === 'asc' ? '↑' : '↓'}`;
  };

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
          <button
            className={`history-filter-btn ${sortKey === 'date' ? 'active-sort' : ''}`}
            onClick={() => handleSortChange('date')}
          >
            {getSortLabel('Date Range', 'date')}
          </button>
          <button
            className={`history-filter-btn ${sortKey === 'type' ? 'active-sort' : ''}`}
            onClick={() => handleSortChange('type')}
          >
            {getSortLabel('Document Type', 'type')}
          </button>
          <button
            className={`history-filter-btn ${sortKey === 'confidence' ? 'active-sort' : ''}`}
            onClick={() => handleSortChange('confidence')}
          >
            {getSortLabel('Confidence', 'confidence')}
          </button>
          <button
            className={`history-filter-btn ${sortKey === 'team' ? 'active-sort' : ''}`}
            onClick={() => handleSortChange('team')}
          >
            {getSortLabel('Team', 'team')}
          </button>
        </div>

        <div className="timeline">
          <h2>January 2026</h2>
          <div className="history-grid">
            {sortedJanuaryCases.map((c) => (
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
            {sortedDecemberCases.map((c) => (
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