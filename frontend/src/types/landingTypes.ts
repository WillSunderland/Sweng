export interface StatItem {
  label: string;
  value: string;
  counter?: CounterConfig;
}

export interface CounterConfig {
  target: number;
  suffix: string;
  decimals: number;
}

export interface FeatureCard {
  icon: string;
  title: string;
  description: string;
  linkText: string;
  linkHref: string;
  accentColor: 'blue' | 'purple' | 'green';
}

export interface NavLink {
  label: string;
  href: string;
}

export interface SuggestionCard {
  icon: string;
  title: string;
  description: string;
}

export interface FooterLink {
  label: string;
  href: string;
}

export interface SidebarNavItem {
  icon: string;
  label: string;
  active: boolean;
  section?: string;
}

export interface TrustAvatar {
  initials: string;
  color: string;
}
