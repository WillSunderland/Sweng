export type CaseStatus = 'review-needed' | 'processing' | 'completed' | 'draft';
export type ActionType = 'analysis' | 'trace' | 'report' | 'draft';

export interface Case {
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

export interface Message {
  id: number;
  type: 'user' | 'assistant' | 'error';
  text: string;
  time: string;
  runId?: string;
  routedTo?: 'nvidia' | 'huggingface';
}

export interface HistoryItem {
  id: number;
  title: string;
  date: string;
  confidence: number;
}

export interface Source {
  title: string;
  bill_id: string;
  relevance_score: number;
}

export const initialCases: Case[] = [
  {
    id: 1,
    caseNumber: 'CASE-ID-08252',
    title: 'Commercial Tenancies Review',
    description: 'Analyzing 2023 legislative amendments impacting mixed-use properties and commercial tenancy disputes across urban districts...',
    status: 'review-needed',
    statusLabel: 'Review Needed',
    lastRun: 'Last run: 3 hours ago',
    assignee: 'AI Paralegal: Chp PLLC',
    actionLabel: 'Open Case',
    actionType: 'analysis',
  },
  {
    id: 2,
    caseNumber: 'CASE-ID-08253',
    title: 'Data Protection Bill Analysis',
    description: 'Comprehensive cross-referencing of the upcoming EU Data Governance Act with existing GDPR framework and national implementations...',
    status: 'processing',
    statusLabel: 'Processing',
    lastRun: 'Last run: 14 hours ago',
    assignee: 'AI Paralegal: Corp PLLC',
    actionLabel: 'Open Case',
    actionType: 'trace',
  },
  {
    id: 3,
    caseNumber: 'CASE-ID-08256',
    title: 'Intellectual Property Audit',
    description: 'Full-chain IP title verification for Project Sunburst software repositories and associated trademark registrations...',
    status: 'completed',
    statusLabel: 'Completed',
    lastRun: 'Last run: Dec 10, 2025',
    assignee: 'AI Paralegal: Chp PLLC',
    actionLabel: 'View Report',
    actionType: 'report',
  },
  {
    id: 4,
    caseNumber: 'CASE-ID-08259',
    title: 'Employment Contract Synthesis',
    description: 'Drafting standardized new contracts to address compliance with recent FTC non-compete guidance and state-level amendments...',
    status: 'draft',
    statusLabel: 'Draft',
    lastRun: 'Started: 4 hours ago',
    assignee: 'In Progress: 0% now',
    actionLabel: 'Continue Draft',
    actionType: 'draft',
    progress: 0,
  },
];

export const initialMessages: Message[] = [
  {
    id: 1,
    type: 'assistant',
    text: "Hello, I'm your AI Legal Assistant. How can I help you today? I can analyze cases, review legislation, and provide cited answers from your research portfolio.",
    time: '09:00 AM',
  },
];

export const suggestedPrompts = [
  'Summarize all active cases with review needed',
  'What are the key risks in the Commercial Tenancies case?',
  'Draft a brief on EU Data Protection compliance',
  'Compare IP audit findings with industry standards',
];

export const historyItems: HistoryItem[] = [
  { id: 3, title: 'Patent Infringement Analysis', date: '2026-01-15', confidence: 98.4 },
  { id: 1, title: 'Employment Law Review', date: '2026-01-10', confidence: 96.2 },
  { id: 2, title: 'Commercial Lease Analysis', date: '2026-01-05', confidence: 94.8 },
  { id: 4, title: 'Data Privacy Compliance', date: '2026-01-28', confidence: 97.1 },
];

export const traceSources: Source[] = [
  { title: 'Residential Tenancies Act 2024', bill_id: 'RTA-2024-63', relevance_score: 0.94 },
  { title: 'EU Data Governance Regulation', bill_id: 'DGA-EU-2022', relevance_score: 0.88 },
  { title: 'Irish Commercial Property Act', bill_id: 'CPA-IE-2021', relevance_score: 0.79 },
];

export const activeUser = {
  name: 'James Sterling',
  role: 'Senior Counsel',
  avatarUrl: 'https://ui-avatars.com/api/?name=James+Sterling&background=2563eb&color=fff&size=40',
};
