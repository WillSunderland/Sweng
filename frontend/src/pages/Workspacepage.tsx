import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppSidebar from '../components/AppSidebar';
import '../styles/SharedSidebar.css';
import '../styles/Workspacepage.css';

type CaseStatus = 'review-needed' | 'processing' | 'completed' | 'draft';
type ActionType = 'analysis' | 'trace' | 'report' | 'draft';

interface Case {
  id: number;
  caseNumber: string;
  title: string;
  description: string;
  status: CaseStatus;
  statusLabel: string;
  lastRun: string;
  assignee: string;
  actionLabel: string;
  actionType: ActionType;
  progress?: number;
}

type FilterType = 'all-cases' | 'drafts' | 'completed' | 'high-priority';

const WorkspacePage: React.FC = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all-cases');
  const [showFilterDropdown, setShowFilterDropdown] = useState<boolean>(false);
  const [showSortDropdown, setShowSortDropdown] = useState<boolean>(false);

  // Hardcoded cases matching the reference image
  const cases: Case[] = [
    {
      id: 1,
      caseNumber: 'CASE-ID-08252',
      title: 'Commercial Tenancies Review',
      description: 'Analyzing 2023 legislative amendments impacting mixed-use properties and commercial...',
      status: 'review-needed',
      statusLabel: 'REVIEW NEEDED',
      lastRun: 'Last run: 3 hours ago',
      assignee: 'AI Paralegal: Chp PLLC',
      actionLabel: 'Open Case',
      actionType: 'analysis'
    },
    {
      id: 2,
      caseNumber: 'CASE-ID-08253',
      title: 'Data Protection Bill Analysis',
      description: 'Comprehensive cross-referencing of the upcoming EU Data Governance Act...',
      status: 'processing',
      statusLabel: 'PROCESSING',
      lastRun: 'Last run: 14 hours ago',
      assignee: 'AI Paralegal: Corp PLLC',
      actionLabel: 'Open Case',
      actionType: 'trace'
    },
    {
      id: 3,
      caseNumber: 'CASE-ID-08256',
      title: 'Intellectual Property Audit',
      description: 'Full-chain IP title verification for Project Sunburst software repositories and...',
      status: 'completed',
      statusLabel: 'COMPLETED',
      lastRun: 'Last run: Dec 10, 2025',
      assignee: 'AI Paralegal: Chp PLLC',
      actionLabel: 'View Report',
      actionType: 'report'
    },
    {
      id: 4,
      caseNumber: 'CASE-ID-08259',
      title: 'Employment Contract Synthesis',
      description: 'Drafting standardized new contracts to address compliance with recent FTC no...',
      status: 'draft',
      statusLabel: 'DRAFT',
      lastRun: 'Started: 4 hours ago',
      assignee: 'In Progress: 0% now',
      actionLabel: 'Continue Draft',
      actionType: 'draft',
      progress: 0
    }
  ];

  const handleCaseClick = (caseItem: Case): void => {
    if (caseItem.actionType === 'report') navigate(`/report/${caseItem.id}`);
    else if (caseItem.actionType === 'trace') navigate(`/trace/${caseItem.id}`);
    else if (caseItem.actionType === 'analysis') navigate(`/analysis/${caseItem.id}`);
  };

  const getFilteredCases = (): Case[] => {
    if (activeFilter === 'all-cases') return cases;
    if (activeFilter === 'drafts') return cases.filter((c: Case) => c.status === 'draft');
    if (activeFilter === 'completed') return cases.filter((c: Case) => c.status === 'completed');
    if (activeFilter === 'high-priority') return cases.filter((c: Case) => c.status === 'review-needed');
    return cases;
  };

  return (
    <div className="workspace-page">
      <AppSidebar activeItem="workspace" />

      <main className="main-workspace">
        <header className="workspace-header">
          <div className="search-container">
            <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM18 18l-4.35-4.35" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search briefs, case law or archive research..."
              className="search-input"
            />
          </div>
          <div className="header-actions">
            <button className="icon-btn notification-btn">
              <span className="notification-badge"></span>
              🔔
            </button>
            <button className="icon-btn">⚙️</button>
          </div>
        </header>

        <div className="page-header">
          <div className="page-title-section">
            <h1 className="page-title">Active Research Cases</h1>
            <p className="page-subtitle">Platform-assisted legal synthesis and documentation</p>
          </div>
          <div className="page-actions">
            <div className="filter-sort-container">
              <div className="dropdown">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setShowFilterDropdown(!showFilterDropdown);
                    setShowSortDropdown(false);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Filter
                </button>
                {showFilterDropdown && (
                  <div className="dropdown-menu">
                    <button onClick={() => { setActiveFilter('all-cases'); setShowFilterDropdown(false); }}>All Cases</button>
                    <button onClick={() => { setActiveFilter('drafts'); setShowFilterDropdown(false); }}>Drafts</button>
                    <button onClick={() => { setActiveFilter('completed'); setShowFilterDropdown(false); }}>Completed</button>
                    <button onClick={() => { setActiveFilter('high-priority'); setShowFilterDropdown(false); }}>High Priority</button>
                  </div>
                )}
              </div>

              <div className="dropdown">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setShowSortDropdown(!showSortDropdown);
                    setShowFilterDropdown(false);
                  }}
                >
                  Sort
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
                {showSortDropdown && (
                  <div className="dropdown-menu">
                    <button onClick={() => setShowSortDropdown(false)}>By Date</button>
                    <button onClick={() => setShowSortDropdown(false)}>By Priority</button>
                    <button onClick={() => setShowSortDropdown(false)}>By Name</button>
                  </div>
                )}
              </div>
            </div>

            <button className="btn-primary">
              + New Research Case
            </button>
          </div>
        </div>

        <div className="filter-tabs">
          <button
            className={`filter-tab ${activeFilter === 'all-cases' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all-cases')}
          >
            All Cases
          </button>
          <button
            className={`filter-tab ${activeFilter === 'drafts' ? 'active' : ''}`}
            onClick={() => setActiveFilter('drafts')}
          >
            Drafts (1)
          </button>
          <button
            className={`filter-tab ${activeFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveFilter('completed')}
          >
            Completed (1)
          </button>
          <button
            className={`filter-tab ${activeFilter === 'high-priority' ? 'active' : ''}`}
            onClick={() => setActiveFilter('high-priority')}
          >
            High Priority
          </button>
        </div>

        <div className="cases-container">
          <div className="cases-grid">
            {getFilteredCases().map((caseItem) => (
              <div
                key={caseItem.id}
                className="case-card"
                onClick={() => handleCaseClick(caseItem)}
              >
                <div className="case-header">
                  <span className={`case-status status-${caseItem.status}`}>
                    {caseItem.statusLabel}
                  </span>
                  <span className="case-number">{caseItem.caseNumber}</span>
                </div>

                <h3 className="case-title">{caseItem.title}</h3>
                <p className="case-description">{caseItem.description}</p>

                <div className="case-footer">
                  <div className="case-meta">
                    <div className="meta-row">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="6" stroke="#9CA3AF" strokeWidth="1.5"/>
                        <path d="M7 3.5V7h3.5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <span>{caseItem.lastRun}</span>
                    </div>
                    <div className="meta-row">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="4.5" r="2.5" stroke="#9CA3AF" strokeWidth="1.5"/>
                        <path d="M2 12.5c0-2.5 2-4.5 5-4.5s5 2 5 4.5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <span>{caseItem.assignee}</span>
                    </div>
                  </div>
                  <button className="case-action-btn">
                    {caseItem.actionLabel}
                  </button>
                </div>

                {caseItem.progress !== undefined && (
                  <div className="progress-container">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${caseItem.progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pagination">
            <span className="pagination-info">Showing 1-4 of 57 active research cases</span>
            <div className="pagination-controls">
              <button className="page-btn" disabled>‹</button>
              <button className="page-btn active">1</button>
              <button className="page-btn">2</button>
              <button className="page-btn">3</button>
              <span className="page-ellipsis">...</span>
              <button className="page-btn">14</button>
              <button className="page-btn">›</button>
            </div>
          </div>
        </div>

        <div className="bottom-action">
          <button className="btn-primary-large">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4v12M4 10h12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            New Research Case
          </button>
        </div>
      </main>

      <aside className="right-sidebar">
        <div className="sidebar-widget">
          <div className="widget-header">
            <h3>RESEARCH TRENDS</h3>
            <a href="#" className="widget-link">SEE ALL</a>
          </div>
          <div className="widget-content">
            <div className="trend-card">
              <span className="trend-badge">TRENDING TOPIC</span>
              <h4 className="trend-title">EU Sustainable Finance Laws</h4>
              <p className="trend-description">New reporting regulatory pressure to HFNZ for reporting...</p>
              <span className="trend-tag global">Global</span>
            </div>
          </div>
        </div>

        <div className="efficiency-card">
          <div className="efficiency-icon">✓</div>
          <h4 className="efficiency-title">AI Efficiency</h4>
          <p className="efficiency-stat">Up to 99.9% of 1,023 file-months compared to legacy search manual...</p>
          <div className="efficiency-badge">Efficiency</div>
        </div>

        <div className="sidebar-widget">
          <div className="widget-header">
            <h3>SYSTEM ACTIVITY</h3>
          </div>
          <div className="widget-content">
            <div className="activity-item">
              <div className="activity-icon">⚡</div>
              <div className="activity-content">
                <p className="activity-title">Legislation updates will be reflected in...</p>
                <p className="activity-time">Starts automatically at 11:00pm...</p>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-icon">🔄</div>
              <div className="activity-content">
                <p className="activity-title">Server routine activity</p>
                <p className="activity-time">Starts automatically at 2:00am...</p>
              </div>
            </div>
          </div>
        </div>

        <div className="ai-assistant-launch" onClick={() => navigate('/ai-agent')}>
          <div className="ai-launch-inner">
            <div className="ai-launch-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" stroke="white" strokeWidth="1.8"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                <circle cx="18" cy="6" r="3" fill="#10b981" stroke="white" strokeWidth="1.5"/>
              </svg>
            </div>
            <div className="ai-launch-text">
              <h3>AI ON-DEMAND ASSISTANT</h3>
              <p>Ask me anything about your current research portfolio.</p>
            </div>
            <svg className="ai-launch-arrow" width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 9h10M9 4l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="ai-launch-cta">
            <span>Open AI Agent</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default WorkspacePage;
