import { API_BASE_URL } from '../../constants/apiConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RunStatus = 'running' | 'completed' | 'draft';
export type RunPriority = 'high' | 'medium' | 'low';
export type SortField = 'date' | 'name' | 'priority';
export type SortOrder = 'asc' | 'desc';
export type FilterTab = 'all-cases' | 'drafts' | 'completed' | 'high-priority';

export interface RunItem {
  runId: string;
  title: string;
  query: string;
  status: RunStatus;
  priority: RunPriority;
  createdAt: string;
  updatedAt: string;
  carbonG: number;
  model_used: string | null;
  provider: string | null;
  sourceCount: number;
}

export interface RunsResponse {
  items: RunItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateRunResponse {
  runId: string;
  status: RunStatus;
  createdAt: string;
}

export interface TrendItem {
  topic: string;
  count: number;
}

export interface ResearchTrendsResponse {
  trends: TrendItem[];
  totalQueries: number;
}

export interface ActivityItem {
  runId: string;
  type: string;
  query: string;
  status: string;
  model_used: string | null;
  provider: string | null;
  timestamp: string;
}

export interface SystemActivityResponse {
  activities: ActivityItem[];
}

export interface AiEfficiencyResponse {
  totalCarbonG: number;
  avgCarbonPerQueryG: number;
  totalTokens: number;
  avgTokensPerQuery: number;
  totalQueries: number;
  modelUsage: Record<string, number>;
  providerUsage: Record<string, number>;
}

export interface DashboardSummaryResponse {
  totalCases: number;
  completed: number;
  running: number;
  drafts: number;
  priorities: { high: number; medium: number; low: number };
}

// ─── Query param helpers ───────────────────────────────────────────────────────

function filterTabToParams(tab: FilterTab): { status?: string; priority?: string } {
  switch (tab) {
    case 'drafts':      return { status: 'draft' };
    case 'completed':   return { status: 'completed' };
    case 'high-priority': return { priority: 'high' };
    default:            return {};
  }
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchRuns(params: {
  page?: number;
  limit?: number;
  tab?: FilterTab;
  sort?: SortField;
  order?: SortOrder;
  q?: string;
}): Promise<RunsResponse> {
  const { page = 1, limit = 10, tab = 'all-cases', sort = 'date', order = 'desc', q } = params;
  const tabParams = filterTabToParams(tab);

  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort,
    order,
    ...(tabParams.status   && { status: tabParams.status }),
    ...(tabParams.priority && { priority: tabParams.priority }),
    ...(q                  && { q }),
  });

  const res = await fetch(`${API_BASE_URL}/api/runs?${qs}`);
  if (!res.ok) throw new Error(`Failed to fetch runs: ${res.status}`);
  return res.json();
}

export async function createRun(query: string): Promise<CreateRunResponse> {
  const res = await fetch(`${API_BASE_URL}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Failed to create run: ${res.status}`);
  return res.json();
}

export async function fetchResearchTrends(): Promise<ResearchTrendsResponse> {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/research-trends`);
  if (!res.ok) throw new Error(`Failed to fetch trends: ${res.status}`);
  return res.json();
}

export async function fetchSystemActivity(): Promise<SystemActivityResponse> {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/system-activity`);
  if (!res.ok) throw new Error(`Failed to fetch activity: ${res.status}`);
  return res.json();
}

export async function fetchAiEfficiency(): Promise<AiEfficiencyResponse> {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/ai-efficiency`);
  if (!res.ok) throw new Error(`Failed to fetch efficiency: ${res.status}`);
  return res.json();
}

export async function fetchDashboardSummary(): Promise<DashboardSummaryResponse> {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/summary`);
  if (!res.ok) throw new Error(`Failed to fetch summary: ${res.status}`);
  return res.json();
}