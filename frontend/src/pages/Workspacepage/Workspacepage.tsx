import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AppSidebar from '../../components/AppSidebar/AppSidebar';
import '../../components/AppSidebar/SharedSidebar.css';
import './Workspacepage.css';
import {
  fetchRuns,
  fetchResearchTrends,
  fetchSystemActivity,
  fetchAiEfficiency,
  createRun,
  type RunItem,
  type FilterTab,
  type SortField,
  type SortOrder,
  type TrendItem,
  type ActivityItem,
  type AiEfficiencyResponse,
} from './workspaceService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkspacePageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(status: string): string {
  switch (status) {
    case 'completed': return 'COMPLETED';
    case 'running':   return 'PROCESSING';
    case 'draft':     return 'DRAFT';
    default:          return 'REVIEW NEEDED';
  }
}

function statusCssClass(status: string): string {
  switch (status) {
    case 'completed': return 'status-completed';
    case 'running':   return 'status-processing';
    case 'draft':     return 'status-draft';
    default:          return 'status-review-needed';
  }
}

function actionLabel(item: RunItem): string {
  if (item.status === 'completed') return 'View Report';
  if (item.status === 'draft')     return 'Continue Draft';
  if (item.status === 'running')   return 'Open Case';
  return 'Open Case';
}

function actionRoute(item: RunItem): string {
  if (item.status === 'completed') return `/report/${item.runId}`;
  if (item.status === 'running')   return `/trace/${item.runId}`;
  return `/analysis/${item.runId}`;
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffH = Math.floor(diffMs / 3_600_000);
    const diffD = Math.floor(diffH / 24);
    if (diffH < 1)  return 'Last run: just now';
    if (diffH < 24) return `Last run: ${diffH} hour${diffH === 1 ? '' : 's'} ago`;
    if (diffD < 7)  return `Last run: ${diffD} day${diffD === 1 ? '' : 's'} ago`;
    return `Last run: ${date.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  } catch {
    return 'Last run: unknown';
  }
}

function caseNumberFromId(runId: string): string {
  const hex = runId.replace('run_', '').toUpperCase();
  return `CASE-ID-${hex.slice(0, 5)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Spinner: React.FC = () => (
  <div className="ws-spinner" aria-label="Loading">
    <div className="ws-spinner-ring" />
  </div>
);

const ErrorBanner: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="ws-error-banner" role="alert">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
    <span>{message}</span>
    <button className="ws-retry-btn" onClick={onRetry}>Retry</button>
  </div>
);

const EmptyState: React.FC<{ onNew: () => void }> = ({ onNew }) => (
  <div className="ws-empty-state">
    <div className="ws-empty-icon">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="6" y="4" width="28" height="32" rx="4" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M13 13h14M13 19h14M13 25h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
    <h3 className="ws-empty-title">No cases found</h3>
    <p className="ws-empty-body">There are no research cases matching your current filters.</p>
    <button className="btn-primary" onClick={onNew}>+ New Research Case</button>
  </div>
);

// New Research Case modal
const NewCaseModal: React.FC<{
  onClose: () => void;
  onSubmit: (query: string) => void;
  submitting: boolean;
}> = ({ onClose, onSubmit, submitting }) => {
  const [query, setQuery] = useState('');

  return (
    <div className="ws-modal-backdrop" onClick={onClose}>
      <div className="ws-modal" onClick={e => e.stopPropagation()}>
        <div className="ws-modal-header">
          <h2>New Research Case</h2>
          <button className="ws-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="ws-modal-body">
          <label className="ws-modal-label" htmlFor="new-case-query">Research query</label>
          <textarea
            id="new-case-query"
            className="ws-modal-textarea"
            placeholder="e.g. What are the compliance requirements for commercial tenancies under the 2023 amendments?"
            rows={4}
            value={query}
            onChange={e => setQuery(e.target.value)}
            disabled={submitting}
            autoFocus
          />
        </div>
        <div className="ws-modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => query.trim() && onSubmit(query.trim())}
            disabled={submitting || !query.trim()}
          >
            {submitting ? 'Creating…' : 'Create Case'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const WorkspacePage: React.FC<WorkspacePageProps> = ({ darkMode, toggleDarkMode }) => {
  const navigate = useNavigate();

  // ── Cases state ──
  const [cases, setCases] = useState<RunItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Controls ──
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all-cases');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // ── Sidebar widget state ──
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [efficiency, setEfficiency] = useState<AiEfficiencyResponse | null>(null);
  const [widgetsLoading, setWidgetsLoading] = useState(true);
  const [widgetsError, setWidgetsError] = useState<string | null>(null);

  // ── Modal state ──
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Debounce search ──
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 400);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery]);

  // ── Fetch cases ──
  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRuns({
        page: currentPage,
        limit: 10,
        tab: activeFilter,
        sort: sortField,
        order: sortOrder,
        q: debouncedSearch || undefined,
      });
      setCases(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, [currentPage, activeFilter, sortField, sortOrder, debouncedSearch]);

  useEffect(() => { loadCases(); }, [loadCases]);

  // ── Fetch sidebar widgets ──
  const loadWidgets = useCallback(async () => {
    setWidgetsLoading(true);
    setWidgetsError(null);
    try {
      const [trendsData, activityData, efficiencyData] = await Promise.all([
        fetchResearchTrends(),
        fetchSystemActivity(),
        fetchAiEfficiency(),
      ]);
      setTrends(trendsData.trends);
      setActivity(activityData.activities.slice(0, 3));
      setEfficiency(efficiencyData);
    } catch (err) {
      setWidgetsError(err instanceof Error ? err.message : 'Failed to load widgets');
    } finally {
      setWidgetsLoading(false);
    }
  }, []);

  useEffect(() => { loadWidgets(); }, [loadWidgets]);

  // ── Create new case ──
  const handleCreateCase = async (query: string) => {
    setCreating(true);
    try {
      const { runId } = await createRun(query);
      setShowNewCaseModal(false);
      // Refresh list then navigate to the new run
      await loadCases();
      navigate(`/analysis/${runId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create case');
    } finally {
      setCreating(false);
    }
  };

  // ── Filter tab change ──
  const handleFilterChange = (tab: FilterTab) => {
    setActiveFilter(tab);
    setCurrentPage(1);
    setShowFilterDropdown(false);
  };

  // ── Sort change ──
  const handleSortChange = (field: SortField) => {
    setSortField(field);
    setCurrentPage(1);
    setShowSortDropdown(false);
  };

  // ── Tab counts from total (approximation while data loads) ──
  const tabCounts: Record<FilterTab, number | null> = {
    'all-cases': total,
    'drafts': null,
    'completed': null,
    'high-priority': null,
  };

  // ── Pagination helpers ──
  const pageNumbers = (): (number | '…')[] => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '…')[] = [1];
    if (currentPage > 3) pages.push('…');
    for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) pages.push(p);
    if (currentPage < totalPages - 2) pages.push('…');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="workspace-page">
      <AppSidebar activeItem="workspace" darkMode={darkMode} toggleDarkMode={toggleDarkMode} />

      {/* ── Main ── */}
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
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="ws-clear-search" onClick={() => setSearchQuery('')} aria-label="Clear search">✕</button>
            )}
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
              {/* Filter dropdown */}
              <div className="dropdown">
                <button className="btn-secondary" onClick={() => { setShowFilterDropdown(!showFilterDropdown); setShowSortDropdown(false); }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Filter
                </button>
                {showFilterDropdown && (
                  <div className="dropdown-menu">
                    <button onClick={() => handleFilterChange('all-cases')}>All Cases</button>
                    <button onClick={() => handleFilterChange('drafts')}>Drafts</button>
                    <button onClick={() => handleFilterChange('completed')}>Completed</button>
                    <button onClick={() => handleFilterChange('high-priority')}>High Priority</button>
                  </div>
                )}
              </div>

              {/* Sort dropdown */}
              <div className="dropdown">
                <button className="btn-secondary" onClick={() => { setShowSortDropdown(!showSortDropdown); setShowFilterDropdown(false); }}>
                  Sort
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
                {showSortDropdown && (
                  <div className="dropdown-menu">
                    <button onClick={() => handleSortChange('date')}>By Date</button>
                    <button onClick={() => handleSortChange('priority')}>By Priority</button>
                    <button onClick={() => handleSortChange('name')}>By Name</button>
                  </div>
                )}
              </div>
            </div>

            <button className="btn-primary" onClick={() => setShowNewCaseModal(true)}>
              + New Research Case
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="filter-tabs">
          {(['all-cases', 'drafts', 'completed', 'high-priority'] as FilterTab[]).map(tab => {
            const labels: Record<FilterTab, string> = {
              'all-cases': 'All Cases',
              'drafts': 'Drafts',
              'completed': 'Completed',
              'high-priority': 'High Priority',
            };
            const count = tab === 'all-cases' && total > 0 ? ` (${total})` : '';
            return (
              <button
                key={tab}
                className={`filter-tab ${activeFilter === tab ? 'active' : ''}`}
                onClick={() => handleFilterChange(tab)}
              >
                {labels[tab]}{count}
              </button>
            );
          })}
        </div>

        {/* Cases area */}
        <div className="cases-container">
          {error && <ErrorBanner message={error} onRetry={loadCases} />}

          {loading ? (
            <div className="ws-loading-grid">
              {[1, 2, 3, 4].map(i => <div key={i} className="ws-skeleton-card" />)}
            </div>
          ) : cases.length === 0 ? (
            <EmptyState onNew={() => setShowNewCaseModal(true)} />
          ) : (
            <>
              <div className="cases-grid">
                {cases.map(item => (
                  <div
                    key={item.runId}
                    className="case-card"
                    onClick={() => navigate(actionRoute(item))}
                  >
                    <div className="case-header">
                      <span className={`case-status ${statusCssClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                      <span className="case-number">{caseNumberFromId(item.runId)}</span>
                    </div>
                    <h3 className="case-title">{item.query}</h3>
                    <p className="case-description">
                      {item.title}
                      {item.sourceCount > 0 && (
                        <span className="ws-source-count"> · {item.sourceCount} source{item.sourceCount !== 1 ? 's' : ''}</span>
                      )}
                    </p>
                    <div className="case-footer">
                      <div className="case-meta">
                        <div className="meta-row">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <circle cx="7" cy="7" r="6" stroke="#9CA3AF" strokeWidth="1.5"/>
                            <path d="M7 3.5V7h3.5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          <span>{formatTimestamp(item.updatedAt)}</span>
                        </div>
                        {item.model_used && (
                          <div className="meta-row">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <circle cx="7" cy="4.5" r="2.5" stroke="#9CA3AF" strokeWidth="1.5"/>
                              <path d="M2 12.5c0-2.5 2-4.5 5-4.5s5 2 5 4.5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            <span>{item.model_used}{item.provider ? ` · ${item.provider}` : ''}</span>
                          </div>
                        )}
                        <div className="meta-row">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M7 1.5l1.5 3 3.5.5-2.5 2.5.5 3.5L7 9.5l-3 1.5.5-3.5L2 5l3.5-.5L7 1.5z" stroke="#9CA3AF" strokeWidth="1.2" strokeLinejoin="round"/>
                          </svg>
                          <span className={`ws-priority-badge ws-priority-${item.priority}`}>{item.priority}</span>
                        </div>
                      </div>
                      <button className="case-action-btn" onClick={e => { e.stopPropagation(); navigate(actionRoute(item)); }}>
                        {actionLabel(item)}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="pagination">
                <span className="pagination-info">
                  Showing {Math.min((currentPage - 1) * 10 + 1, total)}–{Math.min(currentPage * 10, total)} of {total} research case{total !== 1 ? 's' : ''}
                </span>
                <div className="pagination-controls">
                  <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
                  {pageNumbers().map((p, i) =>
                    p === '…'
                      ? <span key={`ellipsis-${i}`} className="page-ellipsis">…</span>
                      : <button key={p} className={`page-btn ${currentPage === p ? 'active' : ''}`} onClick={() => setCurrentPage(p as number)}>{p}</button>
                  )}
                  <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>›</button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bottom-action">
          <button className="btn-primary-large" onClick={() => setShowNewCaseModal(true)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4v12M4 10h12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            New Research Case
          </button>
        </div>
      </main>

      {/* ── Right sidebar ── */}
      <aside className="right-sidebar">

        {/* Research Trends */}
        <div className="sidebar-widget">
          <div className="widget-header">
            <h3>RESEARCH TRENDS</h3>
            <a href="#" className="widget-link">SEE ALL</a>
          </div>
          <div className="widget-content">
            {widgetsLoading ? (
              <div className="ws-widget-skeleton" />
            ) : widgetsError ? (
              <p className="ws-widget-error">Could not load trends.</p>
            ) : trends.length === 0 ? (
              <p className="ws-widget-empty">No trends yet — run some queries first.</p>
            ) : (
              trends.slice(0, 3).map((t, i) => (
                <div key={t.topic} className="trend-card">
                  <span className="trend-badge">{i === 0 ? 'TRENDING TOPIC' : 'TOPIC'}</span>
                  <h4 className="trend-title" style={{ textTransform: 'capitalize' }}>{t.topic}</h4>
                  <p className="trend-description">{t.count} mention{t.count !== 1 ? 's' : ''} across research queries</p>
                  <span className="trend-tag global">Research</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Efficiency */}
        <div className="efficiency-card">
          <div className="efficiency-icon">✓</div>
          <h4 className="efficiency-title">AI Efficiency</h4>
          {widgetsLoading ? (
            <p className="efficiency-stat">Loading…</p>
          ) : efficiency ? (
            <>
              <p className="efficiency-stat">
                {efficiency.totalQueries} queries processed · avg {efficiency.avgCarbonPerQueryG}g CO₂ per query
                {efficiency.avgTokensPerQuery > 0 && ` · ~${efficiency.avgTokensPerQuery.toLocaleString()} tokens avg`}
              </p>
              {Object.keys(efficiency.modelUsage).length > 0 && (
                <p className="efficiency-stat" style={{ fontSize: '11px', opacity: 0.85, marginTop: '4px' }}>
                  Models: {Object.entries(efficiency.modelUsage).map(([m, c]) => `${m} (${c})`).join(', ')}
                </p>
              )}
            </>
          ) : (
            <p className="efficiency-stat">No efficiency data yet.</p>
          )}
          <div className="efficiency-badge">Efficiency</div>
        </div>

        {/* System Activity */}
        <div className="sidebar-widget">
          <div className="widget-header"><h3>SYSTEM ACTIVITY</h3></div>
          <div className="widget-content">
            {widgetsLoading ? (
              <div className="ws-widget-skeleton" />
            ) : widgetsError ? (
              <p className="ws-widget-error">Could not load activity.</p>
            ) : activity.length === 0 ? (
              <p className="ws-widget-empty">No recent activity.</p>
            ) : (
              activity.map(a => (
                <div key={a.runId} className="activity-item">
                  <div className="activity-icon">
                    {a.status === 'completed' ? '✓' : a.status === 'running' ? '🔄' : '⚡'}
                  </div>
                  <div className="activity-content">
                    <p className="activity-title">{a.query.length > 60 ? a.query.slice(0, 60) + '…' : a.query}</p>
                    <p className="activity-time">
                      {a.status} · {a.model_used ?? 'unknown model'} · {formatTimestamp(a.timestamp).replace('Last run: ', '')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Agent launch */}
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

      {/* ── New Case Modal ── */}
      {showNewCaseModal && (
        <NewCaseModal
          onClose={() => !creating && setShowNewCaseModal(false)}
          onSubmit={handleCreateCase}
          submitting={creating}
        />
      )}
    </div>
  );
};

export default WorkspacePage;