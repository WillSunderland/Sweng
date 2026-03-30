
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  ArrowLeft, Search, Download, FileText,
  Scale, Briefcase, FileCheck, Shield,
  TrendingUp, Users, BarChart2, Clock,
  ChevronUp, ChevronDown, ExternalLink, Filter,
} from 'lucide-react';
import AppSidebar from '../../components/AppSidebar/AppSidebar';
import '../../components/AppSidebar/SharedSidebar.css';
import './HistoryPage.css';

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface HistoryPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

// ─── Config ───────────────────────────────────────────────────────────────────

type IconComponent = React.FC<{ size?: number; strokeWidth?: number }>;

const TYPE_CONFIG: Record<string, { bg: string; color: string; Icon: IconComponent }> = {
  Litigation:      { bg: '#eff6ff', color: '#2563eb', Icon: Scale as IconComponent },
  Advisory:        { bg: '#f5f3ff', color: '#8b5cf6', Icon: Briefcase as IconComponent },
  Contracts:       { bg: '#fffbeb', color: '#f59e0b', Icon: FileCheck as IconComponent },
  Regulatory:      { bg: '#ecfdf5', color: '#10b981', Icon: Shield as IconComponent },
  'Due Diligence': { bg: '#f0f9ff', color: '#0ea5e9', Icon: FileText as IconComponent },
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <div className="skeleton-row">
    <div className="sk sk-icon" />
    <div className="sk-body">
      <div className="sk sk-line sk-line--title" />
      <div className="sk sk-line sk-line--tag" />
    </div>
    <div className="sk sk-line sk-line--date" />
    <div className="sk-conf-wrap">
      <div className="sk sk-bar" />
      <div className="sk sk-line sk-line--pct" />
    </div>
    <div className="sk sk-btn" />
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

const HistoryPage = ({ darkMode, toggleDarkMode }: HistoryPageProps) => {
  const navigate = useNavigate();
  const [sortKey, setSortKey]             = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [search, setSearch]               = useState('');

  const cases: ArchiveCase[] = [
    { id: 1, title: 'Patent Infringement Analysis',     date: '2026-01-28', confidence: '97.1', type: 'Litigation',     team: 'IP Counsel' },
    { id: 2, title: 'Data Privacy Compliance Audit',    date: '2026-01-15', confidence: '98.4', type: 'Regulatory',     team: 'Privacy Desk' },
    { id: 3, title: 'Employment Law Review',            date: '2026-01-10', confidence: '96.2', type: 'Advisory',       team: 'Labor & Employment' },
    { id: 4, title: 'Commercial Lease Review',          date: '2026-01-05', confidence: '94.8', type: 'Contracts',      team: 'Commercial Team' },
    { id: 5, title: 'M&A Risk Summary',                 date: '2025-12-22', confidence: '95.6', type: 'Due Diligence',  team: 'Transactions' },
    { id: 6, title: 'Vendor Terms Reconciliation',      date: '2025-12-11', confidence: '93.9', type: 'Contracts',      team: 'Procurement Legal' },
  ];

  const handleSortChange = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'date' || key === 'confidence' ? 'desc' : 'asc');
  };

  const sortCases = (items: ArchiveCase[]) =>
    [...items].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date')            cmp = a.date.localeCompare(b.date);
      else if (sortKey === 'confidence') cmp = parseFloat(a.confidence) - parseFloat(b.confidence);
      else if (sortKey === 'type')       cmp = a.type.localeCompare(b.type);
      else if (sortKey === 'team')       cmp = a.team.localeCompare(b.team);
      return sortDirection === 'asc' ? cmp : -cmp;
    });

  const query = search.toLowerCase();
  const filtered = cases.filter(c =>
    !query ||
    c.title.toLowerCase().includes(query) ||
    c.type.toLowerCase().includes(query) ||
    c.team.toLowerCase().includes(query)
  );

  const januaryCases  = sortCases(filtered.filter(c => c.date.startsWith('2026-01')));
  const decemberCases = sortCases(filtered.filter(c => c.date.startsWith('2025-12')));

  const SortArrow = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return null;
    return sortDirection === 'asc'
      ? <ChevronUp size={12} strokeWidth={2.5} />
      : <ChevronDown size={12} strokeWidth={2.5} />;
  };

  const CaseRow = ({ c }: { c: ArchiveCase }) => {
    const cfg = TYPE_CONFIG[c.type] ?? { bg: '#f8fafc', color: 'var(--text-muted)', Icon: FileText as IconComponent };
    const { Icon } = cfg;
    return (
      <div className="case-row">
        <div className="case-type-icon" style={{ background: cfg.bg, color: cfg.color }}>
          <Icon size={16} strokeWidth={1.8} />
        </div>

        <div className="case-row-body">
          <div className="case-row-title">{c.title}</div>
          <div className="case-row-tags">
            <span className="case-tag">{c.type}</span>
            <span className="case-tag">{c.team}</span>
          </div>
        </div>

        <div className="case-row-date">{formatDate(c.date)}</div>

        <div className="case-row-conf">
          <div className="case-conf-track">
            <div className="case-conf-fill" style={{ width: `${c.confidence}%` }} />
          </div>
          <span className="case-conf-pct">{c.confidence}%</span>
        </div>

        <div className="case-actions">
          <button
            className="case-action-primary"
            onClick={() => navigate(`/report/${c.id}`)}
          >
            <ExternalLink size={12} strokeWidth={2} />
            View Report
          </button>
          <button className="case-action-icon" title="Download">
            <Download size={13} strokeWidth={1.8} />
          </button>
          <button
            className="case-action-icon"
            title="View Trace"
            onClick={() => navigate(`/trace/${c.id}`)}
          >
            <ExternalLink size={13} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    );
  };

  const ArchiveSection = ({ title, items }: { title: string; items: ArchiveCase[] }) => {
    if (items.length === 0) return null;
    return (
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '28px 0 12px' }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-dark)', whiteSpace: 'nowrap' }}>
            {title}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-light)', border: '1px solid var(--border-light)', borderRadius: '20px', padding: '1px 8px' }}>
            {items.length} case{items.length !== 1 ? 's' : ''}
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
        </div>
        <div>
          {items.map(c => <CaseRow key={c.id} c={c} />)}
        </div>
      </section>
    );
  };

  const isLoading = false; // flip to preview skeleton state

  return (
    <div className="history-page">
      <AppSidebar activeItem="archive" darkMode={darkMode} toggleDarkMode={toggleDarkMode} />

      <main className="history-main">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <header className="history-header">
          <div className="history-header-left">
            <button className="history-back-btn" onClick={() => navigate('/workspace')}>
              <ArrowLeft size={16} strokeWidth={2} />
            </button>
            <div>
              <h1 className="history-title">Case Archive</h1>
              <p className="history-subtitle">Historical research cases, reports, and trace outputs</p>
            </div>
          </div>
          <div className="history-header-actions">
            <button className="history-secondary-btn">Bulk Select</button>
            <button className="history-primary-btn">
              <Download size={13} strokeWidth={2} />
              Export All
            </button>
          </div>
        </header>

        {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
        <div className="arch-kpi-strip">

          <div className="arch-kpi-card arch-kpi-card--blue">
            <div className="arch-kpi-icon arch-kpi-icon--blue">
              <BarChart2 size={16} strokeWidth={1.8} />
            </div>
            <div className="arch-kpi-body">
              <strong>247</strong>
              <span>Total Cases</span>
              <em className="arch-kpi-sub arch-kpi-sub--positive">+14 this month</em>
            </div>
          </div>

          <div className="arch-kpi-card arch-kpi-card--green">
            <div className="arch-kpi-icon arch-kpi-icon--green">
              <TrendingUp size={16} strokeWidth={1.8} />
            </div>
            <div className="arch-kpi-body">
              <strong>96.8%</strong>
              <span>Avg Confidence</span>
              <em className="arch-kpi-sub arch-kpi-sub--neutral">Model stable</em>
            </div>
          </div>

          <div className="arch-kpi-card arch-kpi-card--purple">
            <div className="arch-kpi-icon arch-kpi-icon--purple">
              <Clock size={16} strokeWidth={1.8} />
            </div>
            <div className="arch-kpi-body">
              <strong>23</strong>
              <span>This Month</span>
              <em className="arch-kpi-sub arch-kpi-sub--warning">7 pending review</em>
            </div>
          </div>

          <div className="arch-kpi-card arch-kpi-card--orange">
            <div className="arch-kpi-icon arch-kpi-icon--orange">
              <Users size={16} strokeWidth={1.8} />
            </div>
            <div className="arch-kpi-body">
              <strong>8</strong>
              <span>Active Teams</span>
              <em className="arch-kpi-sub arch-kpi-sub--neutral">5 practice areas</em>
            </div>
          </div>

        </div>

        {/* ── Search + Sort toolbar ─────────────────────────────────────────── */}
        <div className="arch-toolbar">
          <div className="arch-search-wrap">
            <Search size={15} strokeWidth={1.8} className="arch-search-icon" />
            <input
              className="arch-search"
              type="text"
              placeholder="Search cases, citations, or tags…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="arch-sort-pills">
            <span className="arch-sort-label">
              <Filter size={12} strokeWidth={2} />
              Sort:
            </span>
            {(['date', 'type', 'confidence', 'team'] as SortKey[]).map(k => (
              <button
                key={k}
                className={`arch-sort-pill${sortKey === k ? ' arch-sort-pill--active' : ''}`}
                onClick={() => handleSortChange(k)}
              >
                {{ date: 'Date', type: 'Type', confidence: 'Confidence', team: 'Team' }[k]}
                <SortArrow k={k} />
              </button>
            ))}
          </div>
        </div>

        {/* ── Archive sections ──────────────────────────────────────────────── */}
        {isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          <>
            <ArchiveSection title="January 2026"  items={januaryCases} />
            <ArchiveSection title="December 2025" items={decemberCases} />

            {filtered.length === 0 && (
              <div className="arch-empty">
                <Search size={30} strokeWidth={1.3} />
                <p>No cases match your search.</p>
              </div>
            )}
          </>
        )}

      </main>
    </div>
  );
};

export default HistoryPage;
