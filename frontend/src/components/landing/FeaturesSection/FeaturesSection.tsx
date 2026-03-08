import React from 'react';
import { FEATURES } from '../../../constants/landingConstants';
import type { FeatureCard as FeatureCardType } from '../../../types/landingTypes';

export const FeaturesSection: React.FC = () => {
  return (
    <section className="py-[120px] px-10" style={{ background: 'var(--card-bg)' }}>
      <div className="max-w-[1200px] mx-auto">
        <div className="text-center mb-16">
          <h2
            className="text-[42px] font-bold tracking-tight mb-4"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--text)' }}
          >
            Enterprise-Grade AI Excellence
          </h2>
          <p className="text-lg max-w-[600px] mx-auto leading-relaxed" style={{ color: 'var(--text-body)' }}>
            Designed for the courtroom, built for the future. Our platform goes beyond standard LLMs to provide a verifiable legal source of truth.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
};

interface FeatureCardProps {
  feature: FeatureCardType;
}

const accentIconBg: Record<string, string> = {
  blue: 'bg-blue-500/15',
  purple: 'bg-purple-500/15',
  green: 'bg-emerald-500/15',
};

const accentLinkColor: Record<string, string> = {
  blue: 'text-blue-600',
  purple: 'text-purple-600',
  green: 'text-emerald-600',
};

const FeatureCard: React.FC<FeatureCardProps> = ({ feature }) => {
  return (
    <article
      className="rounded-2xl p-8 transition-all duration-300 border hover:-translate-y-1 hover:shadow-xl"
      style={{ background: 'var(--bg-light)', borderColor: 'transparent' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = 'var(--card-bg)';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'var(--bg-light)';
        (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
      }}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 text-xl ${accentIconBg[feature.accentColor]}`}>
        {feature.icon}
      </div>
      <h3
        className="text-xl font-semibold mb-3"
        style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--text)' }}
      >
        {feature.title}
      </h3>
      <p className="text-[15px] leading-relaxed mb-4" style={{ color: 'var(--text-body)' }}>
        {feature.description}
      </p>
      <a
        href={feature.linkHref}
        className={`inline-flex items-center gap-1.5 text-sm font-semibold no-underline hover:gap-2.5 transition-all ${accentLinkColor[feature.accentColor]}`}
      >
        {feature.linkText} →
      </a>
    </article>
  );
};