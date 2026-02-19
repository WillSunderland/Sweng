import type { StatItem, FeatureCard, NavLink, FooterLink, SidebarNavItem } from '../types/landingTypes';

export const ANIMATION_DELAYS_MS = {
  NAV_REVEAL: 100,
  HERO_CONTENT_REVEAL: 300,
  HERO_PREVIEW_REVEAL: 500,
  PARALLAX_COMPLETE: 1500,
  STAT_ITEM_STAGGER: 100,
} as const;

export const COUNTER_DURATION_MS = 1200;
export const INTERSECTION_THRESHOLD = 0.3;

export const NAV_LINKS: NavLink[] = [
  { label: 'Solutions', href: '#solutions' },
  { label: 'Features', href: '#features' },
  { label: 'Compliance', href: '#compliance' },
  { label: 'Pricing', href: '#pricing' },
];

export const STATS: StatItem[] = [
  { label: 'Compliance', value: 'SOC2 Type II' },
  { label: 'Data Privacy', value: 'GDPR + CCPA' },
  { label: 'Uptime', value: '99.99% SLA', counter: { target: 99.99, suffix: '% SLA', decimals: 2 } },
  { label: 'Footprint', value: 'Net Zero AI' },
];

export const FEATURES: FeatureCard[] = [
  {
    icon: '🛡️',
    title: 'Verifiable Citations',
    description:
      "Eliminate hallucinations with our 'Source of Truth' engine. Every answer includes direct links to primary legal precedents and statutory law.",
    linkText: 'Learn more',
    linkHref: '#citations',
    accentColor: 'blue',
  },
  {
    icon: '🔍',
    title: 'Full Execution Trace',
    description:
      "We've solved the 'Black Box' problem. Inspect every step of the AI's reasoning process for complete auditability in high-stakes litigation.",
    linkText: 'Explore Traceability',
    linkHref: '#traceability',
    accentColor: 'purple',
  },
  {
    icon: '🌱',
    title: 'Eco-Friendly Compute',
    description:
      'Research with a conscience. Our infrastructure uses low-carbon processing and high-efficiency models to minimize environmental impact.',
    linkText: 'Our ESG Commitment',
    linkHref: '#esg',
    accentColor: 'green',
  },
];

export const FOOTER_LINKS: FooterLink[] = [
  { label: 'Privacy Policy', href: '#privacy' },
  { label: 'Terms of Service', href: '#terms' },
  { label: 'Accessibility', href: '#accessibility' },
  { label: 'Security', href: '#security' },
];

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { icon: 'grid', label: 'Workspace', active: false },
  { icon: 'file', label: 'Drafts', active: false },
  { icon: 'users', label: 'Shared with Team', active: false },
  { icon: 'search', label: 'Parallel Research', active: false, section: 'INTERNAL TOOLS' },
  { icon: 'chat', label: 'AI Assistant', active: true },
];

export const SUGGESTION_CARDS = [
  { icon: '📋', title: 'Regulatory Analysis', description: 'Review legislative changes' },
  { icon: '✅', title: 'Compliance Check', description: 'Generate documentation' },
  { icon: '⚖️', title: 'Case Research', description: 'Find legal precedents' },
  { icon: '📄', title: 'Contract Review', description: 'Analyze and revise' },
];