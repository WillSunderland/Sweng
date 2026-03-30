import { useNavigate } from 'react-router-dom';
import { useEffect, useState, type JSX } from 'react';
import {
  ArrowLeft, Search, Download, FileText,
  Scale, Briefcase, FileCheck, Shield,
  TrendingUp, Users, BarChart2, Clock,
  ChevronUp, ChevronDown, ExternalLink, Filter,
} from 'lucide-react';
import AppSidebar from '../../components/AppSidebar/AppSidebar';
import '../../components/AppSidebar/SharedSidebar.css';
import './HistoryPage.css';
import { API_BASE_URL, buildAuthHeaders } from '../../constants/apiConfig';
import { isRunShared } from '../../lib/sharedRuns';

type SortKey = 'date' | 'type' | 'confidence' | 'team';
type SortDirection = 'asc' | 'desc';

interface ArchiveCase {
  id: string;
  title: string;
  date: string;
  confidence: number | null;
  type: string;
  team: string;
}

interface HistoryPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

type IconComponent = (props: { size?: number; strokeWidth?: number }) => JSX.Element;

const TYPE_CONFIG: Record<string, { bg: string; color: string; Icon: IconComponent }> = {
  Litigation:      { bg: '#eff6ff', color: '#2563eb', Icon: Scale as IconComponent },
  Advisory:        { bg: '#f5f3ff', color: '#8b5cf6', Icon: Briefcase as IconComponent },
  Contracts:       { bg: '#fffbeb', color: '#f59e0b', Icon: FileCheck as IconComponent },
  Regulatory:      { bg: '#ecfdf5', color: '#10b981', Icon: Shield as IconComponent },
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

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

const HistoryPage = ({ darkMode, toggleDarkMode }: HistoryPageProps) => {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [search, setSearch] = useState('');
  const [cases, setCases] = useState<ArchiveCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadRuns(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/runs?page=1&limit=1000&sort=date&order=desc`, {
          headers: buildAuthHeaders(),
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed to fetch history (${res.status})`);
        const data = (await res.json()) as {
          items?: Array<{
            runId: string;
            title?: string;
            query?: string;
            updatedAt?: string;
            createdAt?: string;
            status?: string;
            trustScore?: number;
          }>;
        };

        const mapped = (data.items ?? []).map((item): ArchiveCase => {
          const status = item.status ?? 'running';
          const type =
            status === 'completed'
              ? 'Litigation'
              : status === 'draft'
                ? 'Contracts'
                : status === 'in-review'
                  ? 'Regulatory'
                  : 'Advisory';

          return {
            id: item.runId,
            title: item.title ?? item.query ?? 'Untitled Analysis',
            date: item.updatedAt ?? item.createdAt ?? new Date().toISOString(),
            confidence: typeof item.trustScore === 'number' ? item.trustScore * 100 : null,
            type,
            team: isRunShared(item.runId) ? 'Shared Team' : 'Personal Workspace',
          };
        });

        if (!ignore) setCases(mapped);
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadRuns();
    return () => { ignore = true; };
  }, []);

  const handleSortChange = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'date' || key === 'confidence' ? 'desc' : 'asc');
  };

  const sortCases = (items: ArchiveCase[]) =>
    [...items].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortKey === 'confidence') cmp = (a.confidence ?? -1) - (b.confidence ?? -1);
      else if (sortKey === 'type') cmp = a.type.localeCompare(b.type);
      else if (sortKey === 'team') cmp = a.team.localeCompare(b.team);
      return sortDirection === 'asc' ? cmp : -cmp;
    });

  const query = search.toLowerCase();
  const filtered = cases.filter((c) =>
    !query ||
    c.title.toLowerCase().includes(query) ||
    c.type.toLowerCase().includes(query) ||
    c.team.toLowerCase().includes(query)
  );

  const groupedByMonth = sortCases(filtered).reduce<Record<string, ArchiveCase[]>>((acc, item) => {
    const monthLabel = new Date(item.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    acc[monthLabel] = acc[monthLabel] ?? [];
    acc[monthLabel].push(item);
    return acc;
  }, {});

  const monthSections = Object.entries(groupedByMonth).sort((a, b) => {
    const aTime = new Date(a[1][0]?.date ?? 0).getTime();
    const bTime = new Date(b[1][0]?.date ?? 0).getTime();
    return bTime - aTime;
  });

  const totalCases = cases.length;
  const completedCases = cases.filter((c) => c.type === 'Litigation').length;
  const sharedCases = cases.filter((c) => c.team === 'Shared Team').length;
  const thisMonthCases = cases.filter((c) => {
    const d = new Date(c.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

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
            <div className="case-conf-fill" style={{ width: `${c.confidence ?? 0}%` }} />
          </div>
          <span className="case-conf-pct">{c.confidence != null ? `${c.confidence.toFixed(1)}%` : '—'}</span>
        </div>

        <div className="case-actions">
          <button className="case-action-primary" onClick={() => navigate(`/report/${c.id}`)}>
            <ExternalLink size={12} strokeWidth={2} />
            View Report
          </button>
          <button className="case-action-icon" title="Download">
            <Download size={13} strokeWidth={1.8} />
          </button>
          <button className="case-action-icon" title="View Trace" onClick={() => navigate(`/trace/${c.id}`)}>
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
          {items.map((c) => <CaseRow key={c.id} c={c} />)}
        </div>
      </section>
    );
  };

  return (
    <div className="history-page">
      <AppSidebar activeItem="archive" darkMode={darkMode} toggleDarkMode={toggleDarkMode} />

      <main className="history-main">
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

        <div className="arch-kpi-strip">
          <div className="arch-kpi-card arch-kpi-card--blue">
            <div className="arch-kpi-icon arch-kpi-icon--blue">
              <BarChart2 size={16} strokeWidth={1.8} />
            </div>
            <div className="arch-kpi-body">
              <strong>{totalCases}</strong>
              <span>Total Cases</span>
              <em className="arch-kpi-sub arch-kpi-sub--positive">{thisMonthCases} this month</em>
            </div>
          </div>

          <div className="arch-kpi-card arch-kpi-card--green">
            <div className="arch-kpi-icon arch-kpi-icon--green">
              <TrendingUp size={16} strokeWidth={1.8} />
            </div>
            <div className="arch-kpi-body">
              <strong>{completedCases}</strong>
              <span>Completed Cases</span>
              <em className="arch-kpi-sub arch-kpi-sub--neutral">Live from run history</em>
            </div>
          </div>

          <div className="arch-kpi-card arch-kpi-card--purple">
            <div className="arch-kpi-icon arch-kpi-icon--purple">
              <Clock size={16} strokeWidth={1.8} />
            </div>
            <div className="arch-kpi-body">
              <strong>{thisMonthCases}</strong>
              <span>This Month</span>
              <em className="arch-kpi-sub arch-kpi-sub--warning">Recent activity</em>
            </div>
          </div>

          <div className="arch-kpi-card arch-kpi-card--orange">
            <div className="arch-kpi-icon arch-kpi-icon--orange">
              <Users size={16} strokeWidth={1.8} />
            </div>
            <div className="arch-kpi-body">
              <strong>{sharedCases}</strong>
              <span>Shared Cases</span>
              <em className="arch-kpi-sub arch-kpi-sub--neutral">Team-visible items</em>
            </div>
          </div>
        </div>

        <div className="arch-toolbar">
          <div className="arch-search-wrap">
            <Search size={15} strokeWidth={1.8} className="arch-search-icon" />
            <input
              className="arch-search"
              type="text"
              placeholder="Search cases, citations, or tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="arch-sort-pills">
            <span className="arch-sort-label">
              <Filter size={12} strokeWidth={2} />
              Sort:
            </span>
            {(['date', 'type', 'confidence', 'team'] as SortKey[]).map((k) => (
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

        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : error ? (
          <div className="arch-empty">
            <Search size={30} strokeWidth={1.3} />
            <p>{error}</p>
          </div>
        ) : (
          <>
            {monthSections.map(([month, items]) => (
              <ArchiveSection key={month} title={month} items={items} />
            ))}

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
