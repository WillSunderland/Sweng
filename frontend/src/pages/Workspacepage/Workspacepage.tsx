import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bell, Settings, TrendingUp, CheckCircle2, RefreshCw, FileText,
  Leaf, Hash, Clock,
} from 'lucide-react';
import AppSidebar from '../../components/AppSidebar/AppSidebar';
import '../../components/AppSidebar/SharedSidebar.css';
import './Workspacepage.css';
import {
  fetchRuns,
  fetchResearchTrends,
  fetchSystemActivity,
  fetchAiEfficiency,
  fetchTabCounts,
  createRun,
  patchRun,
  type RunItem,
  type RunStatus,
  type RunPriority,
  type FilterTab,
  type SortField,
  type TrendItem,
  type ActivityItem,
  type AiEfficiencyResponse,
  type TabCounts,
} from './workspaceService';
import { getSharedRunIds, isRunShared, toggleRunShared } from '../../lib/sharedRuns';

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
    case 'in-review': return 'IN REVIEW';
    default:          return 'REVIEW NEEDED';
  }
}

function statusCssClass(status: string): string {
  switch (status) {
    case 'completed': return 'status-completed';
    case 'running':   return 'status-processing';
    case 'draft':     return 'status-draft';
    case 'in-review': return 'status-review-needed';
    default:          return 'status-review-needed';
  }
}

function actionLabel(item: RunItem): string {
  if (item.status === 'completed') return 'View Report';
  if (item.status === 'draft')     return 'Continue Draft';
  if (item.status === 'running')   return 'Open Case';
  if (item.status === 'in-review') return 'Open Case';
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
    if (diffH < 1)  return 'just now';
    if (diffH < 24) return `${diffH}h ago`;
    if (diffD < 7)  return `${diffD}d ago`;
    return date.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return 'unknown';
  }
}

function caseNumberFromId(runId: string): string {
  const hex = runId.replace('run_', '').toUpperCase();
  return `CASE-ID-${hex.slice(0, 5)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Page-level spinner shown in the header bar during any fetch
const PageSpinner: React.FC = () => (
  <div className="ws-page-spinner" aria-label="Loading">
    <div className="ws-page-spinner-ring" />
    <span className="ws-page-spinner-text">Loading…</span>
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

// ── New Research Case modal ──
const NewCaseModal: React.FC<{
  onClose: () => void;
  onSubmit: (query: string, priority: RunPriority) => void;
  submitting: boolean;
}> = ({ onClose, onSubmit, submitting }) => {
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState<RunPriority>('medium');

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
          <label className="ws-modal-label" style={{ marginTop: '12px' }}>Priority</label>
          <div className="ws-priority-picker">
            {(['low', 'medium', 'high'] as RunPriority[]).map(p => (
              <button
                key={p}
                className={`ws-priority-option ws-priority-option-${p} ${priority === p ? 'active' : ''}`}
                onClick={() => setPriority(p)}
                disabled={submitting}
                type="button"
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="ws-modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => query.trim() && onSubmit(query.trim(), priority)}
            disabled={submitting || !query.trim()}
          >
            {submitting
              ? <><span className="ws-btn-spinner" /> Creating…</>
              : 'Create Case'
            }
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Case Detail modal (status + priority editing) ──
const CaseDetailModal: React.FC<{
  item: RunItem;
  onClose: () => void;
  onSave: (runId: string, updates: { status?: RunStatus; priority?: RunPriority }) => Promise<void>;
  saving: boolean;
}> = ({ item, onClose, onSave, saving }) => {
  const [selectedStatus, setSelectedStatus] = useState<RunStatus>(item.status);
  const [selectedPriority, setSelectedPriority] = useState<RunPriority>(item.priority);
  const navigate = useNavigate();

  const hasChanges = selectedStatus !== item.status || selectedPriority !== item.priority;

  const statusOptions: { value: RunStatus; label: string }[] = [
    { value: 'running',   label: 'In Progress' },
    { value: 'in-review', label: 'In Review' },
    { value: 'completed', label: 'Completed' },
    { value: 'draft',     label: 'Draft' },
  ];

  return (
    <div className="ws-modal-backdrop" onClick={onClose}>
      <div className="ws-modal ws-modal--detail" onClick={e => e.stopPropagation()}>
        <div className="ws-modal-header">
          <div>
            <h2 style={{ marginBottom: '4px' }}>{item.query}</h2>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              {caseNumberFromId(item.runId)} · Last updated {formatTimestamp(item.updatedAt)}
            </span>
          </div>
          <button className="ws-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="ws-modal-body">
          {/* Status */}
          <label className="ws-modal-label">Status</label>
          <div className="ws-status-picker">
            {statusOptions.map(opt => (
              <button
                key={opt.value}
                className={`ws-status-option ws-status-option-${opt.value} ${selectedStatus === opt.value ? 'active' : ''}`}
                onClick={() => setSelectedStatus(opt.value)}
                disabled={saving}
                type="button"
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Priority */}
          <label className="ws-modal-label" style={{ marginTop: '20px' }}>Priority</label>
          <div className="ws-priority-picker">
            {(['low', 'medium', 'high'] as RunPriority[]).map(p => (
              <button
                key={p}
                className={`ws-priority-option ws-priority-option-${p} ${selectedPriority === p ? 'active' : ''}`}
                onClick={() => setSelectedPriority(p)}
                disabled={saving}
                type="button"
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="ws-modal-footer" style={{ justifyContent: 'space-between' }}>
          <button
            className="btn-secondary"
            onClick={() => navigate(actionRoute(item))}
          >
            Open Full Case →
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button
              className="btn-primary"
              onClick={() => onSave(item.runId, { status: selectedStatus, priority: selectedPriority })}
              disabled={saving || !hasChanges}
            >
              {saving
                ? <><span className="ws-btn-spinner" /> Saving…</>
                : 'Save Changes'
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const WorkspacePage: React.FC<WorkspacePageProps> = ({ darkMode, toggleDarkMode }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Cases state ──
  const [cases, setCases] = useState<RunItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Tab counts ──
  const [tabCounts, setTabCounts] = useState<TabCounts | null>(null);

  // ── Controls ──
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all-cases');
  const [sortField, setSortField] = useState<SortField>('date');
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
  const [detailItem, setDetailItem] = useState<RunItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshSharedKey, setRefreshSharedKey] = useState(0);

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

  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'drafts') {
      setActiveFilter('drafts');
    } else if (view === 'shared') {
      setActiveFilter('shared');
    }
  }, [searchParams]);

  // ── Fetch cases ──
  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeFilter === 'shared') {
        const [allData, counts] = await Promise.all([
          fetchRuns({
            page: 1,
            limit: 1000,
            tab: 'all-cases',
            sort: sortField,
            q: debouncedSearch || undefined,
          }),
          fetchTabCounts(),
        ]);

        const sharedIds = new Set(getSharedRunIds());
        const sharedItems = allData.items.filter((item) => sharedIds.has(item.runId));
        const pagedItems = sharedItems.slice((currentPage - 1) * 10, currentPage * 10);
        const sharedTotalPages = Math.max(1, Math.ceil(sharedItems.length / 10));

        setCases(pagedItems);
        setTotal(sharedItems.length);
        setTotalPages(sharedTotalPages);
        setTabCounts({ ...counts, shared: sharedItems.length });
      } else {
        const [data, counts] = await Promise.all([
          fetchRuns({
            page: currentPage,
            limit: 10,
            tab: activeFilter,
            sort: sortField,
            q: debouncedSearch || undefined,
          }),
          fetchTabCounts(),
        ]);
        setCases(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setTabCounts({ ...counts, shared: getSharedRunIds().length });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, [currentPage, activeFilter, sortField, debouncedSearch]);

  useEffect(() => { loadCases(); }, [loadCases]);
  useEffect(() => {
    if (refreshSharedKey !== 0) {
      loadCases();
    }
  }, [refreshSharedKey, loadCases]);

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
  const handleCreateCase = async (query: string, priority: RunPriority) => {
    setCreating(true);
    try {
      const { runId } = await createRun(query, priority);
      setShowNewCaseModal(false);
      await loadCases();
      navigate(`/analysis/${runId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create case');
    } finally {
      setCreating(false);
    }
  };

  // ── Patch run (status / priority) ──
  const handlePatchRun = async (
    runId: string,
    updates: { status?: RunStatus; priority?: RunPriority },
  ) => {
    setSaving(true);
    try {
      const updated = await patchRun(runId, updates);
      // Optimistically update the local list
      setCases(prev =>
        prev.map(c =>
          c.runId === runId
            ? { ...c, status: updated.status, priority: updated.priority, updatedAt: updated.updatedAt }
            : c,
        ),
      );
      // Refresh tab counts since status/priority changed
      fetchTabCounts().then(setTabCounts).catch(() => {});
      setDetailItem(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update case');
    } finally {
      setSaving(false);
    }
  };

  // ── Filter / sort helpers ──
  const handleFilterChange = (tab: FilterTab) => {
    setActiveFilter(tab);
    setCurrentPage(1);
    setShowFilterDropdown(false);
    if (tab === 'drafts' || tab === 'shared') {
      setSearchParams({ view: tab });
    } else {
      setSearchParams({});
    }
  };

  const handleSortChange = (field: SortField) => {
    setSortField(field);
    setCurrentPage(1);
    setShowSortDropdown(false);
  };

  // ── Pagination ──
  const pageNumbers = (): (number | '…')[] => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '…')[] = [1];
    if (currentPage > 3) pages.push('…');
    for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) pages.push(p);
    if (currentPage < totalPages - 2) pages.push('…');
    pages.push(totalPages);
    return pages;
  };

  // ── Tab label helper ──
  const tabLabel = (tab: FilterTab, label: string) => {
    const count = tabCounts?.[tab];
    return count !== undefined && count > 0 ? `${label} (${count})` : label;
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
            {loading && <PageSpinner />}
            <button className="icon-btn notification-btn" aria-label="Notifications">
              <span className="notification-badge"></span>
              <Bell size={15} strokeWidth={1.8} />
            </button>
            <button className="icon-btn" aria-label="Settings">
              <Settings size={15} strokeWidth={1.8} />
            </button>
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
                    <button onClick={() => handleFilterChange('shared')}>Shared with Team</button>
                    <button onClick={() => handleFilterChange('completed')}>Completed</button>
                    <button onClick={() => handleFilterChange('high-priority')}>High Priority</button>
                  </div>
                )}
              </div>

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

        {/* Filter tabs with live counts */}
        <div className="filter-tabs">
          {([
            { tab: 'all-cases'     as FilterTab, label: 'All Cases' },
            { tab: 'drafts'        as FilterTab, label: 'Drafts' },
            { tab: 'shared'        as FilterTab, label: 'Shared with Team' },
            { tab: 'completed'     as FilterTab, label: 'Completed' },
            { tab: 'high-priority' as FilterTab, label: 'High Priority' },
          ]).map(({ tab, label }) => (
            <button
              key={tab}
              className={`filter-tab ${activeFilter === tab ? 'active' : ''}`}
              onClick={() => handleFilterChange(tab)}
            >
              {tabLabel(tab, label)}
            </button>
          ))}
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
                    onClick={() => setDetailItem(item)}
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
                          {/* ...existing meta rows unchanged... */}
                        </div>
                        {/* Green metrics badge */}
                        {(item.carbonG > 0 || item.tokens_used || item.latency_ms) && (
                          <div className="ws-green-badge">
                            {item.carbonG > 0 && (
                              <span className="ws-green-badge-item" title="Estimated CO₂">
                                <Leaf size={10} strokeWidth={2} /> {item.carbonG.toFixed(4)}g CO₂
                              </span>
                            )}
                            {!!item.tokens_used && item.tokens_used > 0 && (
                              <span className="ws-green-badge-item" title="Tokens used">
                                <Hash size={10} strokeWidth={2} /> {item.tokens_used.toLocaleString()} tok
                              </span>
                            )}
                            {!!item.latency_ms && item.latency_ms > 0 && (
                              <span className="ws-green-badge-item" title="Query latency">
                                <Clock size={10} strokeWidth={2} /> {(item.latency_ms / 1000).toFixed(1)}s
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        className="case-action-btn"
                        onClick={e => { e.stopPropagation(); navigate(actionRoute(item)); }}
                      >
                        {actionLabel(item)}
                      </button>
                      <button
                        className="case-action-btn"
                        onClick={e => {
                          e.stopPropagation();
                          toggleRunShared(item.runId);
                          setRefreshSharedKey((prev) => prev + 1);
                        }}
                      >
                        {isRunShared(item.runId) ? 'Unshare' : 'Share'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

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

        
      </main>

      {/* ── Right sidebar ── */}
      <aside className="right-sidebar">
        <div className="sidebar-widget">
          <div className="widget-header">
            <h3>RESEARCH TRENDS</h3>
            <button type="button" className="widget-link" onClick={() => navigate('/history')}>SEE ALL</button>
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

        <div className="efficiency-card">
          <div className="efficiency-header">
            <div className="efficiency-icon">
              <TrendingUp size={14} strokeWidth={2} />
            </div>
            <span className="efficiency-label">AI EFFICIENCY</span>
            <span className="efficiency-live-pill">Live</span>
          </div>

          {widgetsLoading ? (
            <div className="ws-widget-skeleton" style={{ margin: '8px 0' }} />
          ) : efficiency ? (
            <>
              <div className="efficiency-metrics">
                <div className="efficiency-metric">
                  <span className="efficiency-metric-val">{efficiency.totalQueries}</span>
                  <span className="efficiency-metric-label">Queries</span>
                </div>
                <div className="efficiency-metric">
                  <span className="efficiency-metric-val">{efficiency.avgCarbonPerQueryG}g</span>
                  <span className="efficiency-metric-label">Avg CO₂</span>
                </div>
              </div>
              {efficiency.avgTokensPerQuery > 0 && (
                <p className="efficiency-sub">
                  ~{efficiency.avgTokensPerQuery.toLocaleString()} avg tokens
                  {Object.keys(efficiency.modelUsage).length > 0 && (
                    <> · {Object.keys(efficiency.modelUsage)[0]}</>
                  )}
                </p>
              )}
            </>
          ) : (
            <p className="efficiency-stat">No efficiency data yet.</p>
          )}

          <div className="efficiency-badge">
            <CheckCircle2 size={11} strokeWidth={2.5} />
            Efficient
          </div>
        </div>

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
                  <div className={`activity-icon activity-icon--${a.status}`}>
                    {a.status === 'completed'
                      ? <CheckCircle2 size={14} strokeWidth={2} />
                      : a.status === 'running'
                        ? <RefreshCw size={14} strokeWidth={2} />
                        : <FileText size={14} strokeWidth={2} />}
                  </div>
                  <div className="activity-content">
                    <p className="activity-title">{a.query.length > 60 ? a.query.slice(0, 60) + '…' : a.query}</p>
                    <p className="activity-time">
                      {a.status} · {a.model_used ?? 'unknown model'} · {formatTimestamp(a.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            )}
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

      {/* ── Modals ── */}
      {showNewCaseModal && (
        <NewCaseModal
          onClose={() => !creating && setShowNewCaseModal(false)}
          onSubmit={handleCreateCase}
          submitting={creating}
        />
      )}

      {detailItem && (
        <CaseDetailModal
          item={detailItem}
          onClose={() => !saving && setDetailItem(null)}
          onSave={handlePatchRun}
          saving={saving}
        />
      )}
    </div>
  );
};

export default WorkspacePage;