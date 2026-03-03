import React from 'react';
import { useCounterAnimation, useIntersectionReveal } from '../../hooks/useAnimations';

const marqueeItems = [
  'Eco-Conscious AI',
  'Full Audit Trail',
  'Enterprise Security',
  'Legal Intelligence',
  'Verifiable Citations',
  'Courtroom Ready',
];

const impactStats = [
  { label: 'Legal queries processed', target: 2.4, suffix: 'M+', decimals: 1 },
  { label: 'Citation accuracy rate', target: 99.7, suffix: '%', decimals: 1 },
  { label: 'Research time saved', target: 73, suffix: '%', decimals: 0 },
  { label: 'Enterprise law firms', target: 200, suffix: '+', decimals: 0 },
];

const traceRows = [
  {
    id: 1,
    title: 'Ask in plain language',
    description:
      'Pose complex legal questions naturally. Our AI understands nuanced legal context, jurisdictional variations, and multi-layered regulatory frameworks.',
    bullets: [
      'Multi-jurisdictional awareness',
      'Context-aware follow-up queries',
      'Natural language processing',
    ],
    direction: 'left' as const,
  },
  {
    id: 2,
    title: 'Trace every reasoning step',
    description:
      'Our execution trace provides full transparency into how the AI reaches its conclusions. Every citation and logical connection is mapped and auditable.',
    bullets: [
      'Step-by-step reasoning chain',
      'Primary source verification',
      'Conflict-of-law detection',
    ],
    direction: 'right' as const,
  },
  {
    id: 3,
    title: 'Deploy with confidence',
    description:
      'Export courtroom-ready documents with full citation trails. Integrate directly into your case management workflow and share verified research quickly.',
    bullets: [
      'Export to Word, PDF, or case systems',
      'Team collaboration and sharing',
      'Version-controlled research history',
    ],
    direction: 'left' as const,
  },
];

export const ImpactTraceShowcase: React.FC = () => {
  const { ref, isVisible } = useIntersectionReveal(0.2);

  return (
    <section className="bg-slate-100">
      <div className="relative overflow-hidden bg-slate-950 text-white py-[110px] px-8">
        <div className="impact-stars absolute inset-0 opacity-60" />

        <div className="absolute top-8 left-0 right-0 overflow-hidden whitespace-nowrap">
          <div className="impact-marquee-track inline-flex items-center gap-6 text-[20px] text-white/25 font-medium tracking-[0.02em]">
            {[...marqueeItems, ...marqueeItems].map((item, index, arr) => (
              <span key={`${item}-${index}`} className="inline-flex items-center gap-6">
                <span>{item}</span>
                {index < arr.length - 1 && <span className="text-white/30 text-sm">•</span>}
              </span>
            ))}
          </div>
        </div>

        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          className={`max-w-[1200px] mx-auto relative z-10 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="text-center mb-12">
            <p className="text-blue-400 text-sm font-semibold tracking-[0.18em] uppercase mb-5">Platform Impact</p>
            <h2
              className="text-[46px] leading-[1.15] tracking-[-0.02em] mb-4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Trusted by legal teams worldwide
            </h2>
            <p className="text-slate-300 text-[19px] max-w-[760px] mx-auto leading-[1.65]">
              Our platform delivers measurable results across every metric that matters to legal professionals.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-5">
            {impactStats.map((stat, index) => (
              <div
                key={stat.label}
                className={`bg-slate-900/55 border border-white/10 rounded-3xl px-7 py-8 text-center transition-all duration-500 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${140 + index * 90}ms` }}
              >
                <AnimatedStat
                  target={stat.target}
                  decimals={stat.decimals}
                  suffix={stat.suffix}
                  shouldStart={isVisible}
                />
                <p className="mt-3 text-slate-300 text-[18px] leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="py-24 px-8">
        <div className="max-w-[1200px] mx-auto text-center mb-14">
          <p className="text-blue-600 text-sm font-semibold tracking-[0.18em] uppercase mb-4">How It Works</p>
          <h3
            className="text-[48px] leading-[1.15] text-slate-900 mb-4 tracking-[-0.02em]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            From question to courtroom-ready answer
          </h3>
          <p className="text-slate-500 text-[19px] max-w-[720px] mx-auto leading-[1.65]">
            Three simple steps to transform your legal research workflow with AI-powered intelligence.
          </p>
        </div>

        <div className="space-y-24">
          {traceRows.map((row, index) => (
            <TraceRow key={row.id} row={row} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

interface AnimatedStatProps {
  target: number;
  decimals: number;
  suffix: string;
  shouldStart: boolean;
}

const AnimatedStat: React.FC<AnimatedStatProps> = ({ target, decimals, suffix, shouldStart }) => {
  const value = useCounterAnimation(target, decimals, 1400, shouldStart);
  return (
    <p
      className="text-[52px] font-semibold leading-none"
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
    >
      {decimals > 0 ? value.toFixed(decimals) : Math.round(value)}
      <span className="text-blue-400">{suffix}</span>
    </p>
  );
};

interface TraceRowData {
  id: number;
  title: string;
  description: string;
  bullets: string[];
  direction: 'left' | 'right';
}

interface TraceRowProps {
  row: TraceRowData;
  index: number;
}

const TraceRow: React.FC<TraceRowProps> = ({ row, index }) => {
  const { ref, isVisible } = useIntersectionReveal(0.25);
  const textAnimation = row.direction === 'left' ? 'trace-slide-left' : 'trace-slide-right';
  const contentAnimation = row.direction === 'left' ? 'trace-slide-right' : 'trace-slide-left';

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`grid grid-cols-2 gap-16 items-center ${index % 2 === 1 ? 'md:[&>*:first-child]:order-2 md:[&>*:last-child]:order-1' : ''}`}
    >
      <div className={`transition-all duration-700 ${isVisible ? `${textAnimation} trace-visible` : 'opacity-0'}`}>
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white font-bold text-base mb-5">
          {row.id}
        </span>
        <h4
          className="text-[42px] text-slate-900 leading-[1.15] mb-5 tracking-[-0.015em]"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {row.title}
        </h4>
        <p className="text-slate-600 text-[20px] leading-[1.7] mb-8 max-w-[92%]">{row.description}</p>
        <ul className="space-y-4">
          {row.bullets.map((bullet) => (
            <li key={bullet} className="flex items-center gap-3 text-slate-700 text-[22px] leading-[1.45]">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-500 flex items-center justify-center text-base">✓</span>
              {bullet}
            </li>
          ))}
        </ul>
      </div>

      <div className={`transition-all duration-700 ${isVisible ? `${contentAnimation} trace-visible` : 'opacity-0'}`}>
        <TracePanel step={row.id} active={isVisible} />
      </div>
    </div>
  );
};

interface TracePanelProps {
  step: number;
  active: boolean;
}

const TracePanel: React.FC<TracePanelProps> = ({ step, active }) => {
  if (step === 2) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-7 shadow-sm">
        <div className="space-y-4">
          {[
            'Query Analysis',
            'Source Retrieval',
            'Reasoning Chain',
            'Citation Validation',
          ].map((item, index) => (
            <div key={item} className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
              <div className="flex items-center justify-between">
                <p className="text-slate-800 text-[17px] font-semibold">{item}</p>
                <span className="bg-emerald-100 text-emerald-600 text-xs px-3 py-1 rounded-full">
                  {index === 2 ? 'Audited' : 'Verified'}
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-700"
                  style={{ width: active ? `${85 + index * 3}%` : '0%', transitionDelay: `${index * 100}ms` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-7 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <p className="text-slate-700 text-[17px] font-semibold">Research Complete</p>
          <span className="text-slate-700 text-[17px] font-semibold">100%</span>
        </div>

        <div className="h-3 bg-slate-200 rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-blue-600 rounded-full transition-all duration-1000"
            style={{ width: active ? '100%' : '0%' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <MetricCard label="Accuracy" value="99.7%" subline="↑ 2.1% vs manual" />
          <MetricCard label="Time Saved" value="4.2hrs" subline="↑ 73% faster" />
          <MetricCard label="Sources Verified" value="47" subline="All primary sources" />
          <MetricCard label="Carbon Offset" value="0.3kg" subline="Net zero query" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-7 shadow-sm">
      <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-500 text-[16px] leading-snug mb-4">
        What are the GDPR implications for cross-border data transfers post-Schrems II?
      </div>
      <div className="space-y-3">
        {[
          'CJEU C-311/18 — Schrems II Decision',
          'EDPB Recommendations 01/2020',
          'EU-US Data Privacy Framework',
        ].map((item, index) => (
          <div key={item} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-700 text-[16px] font-semibold">{item}</p>
              <span className="bg-emerald-100 text-emerald-600 text-xs px-3 py-1 rounded-full">Verified</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-300 rounded-full transition-all duration-700"
                style={{ width: active ? `${88 - index * 8}%` : '0%', transitionDelay: `${index * 100}ms` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface MetricCardProps {
  label: string;
  value: string;
  subline: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, subline }) => {
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
      <p className="text-slate-400 uppercase tracking-[0.08em] text-xs mb-2">{label}</p>
      <p className="text-[28px] leading-none text-slate-900 mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
        {value}
      </p>
      <p className="text-emerald-500 text-sm font-semibold">{subline}</p>
    </div>
  );
};
