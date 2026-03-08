import React from 'react';

interface CTASectionProps {
  onStartTrial: () => void;
}

export const CTASection: React.FC<CTASectionProps> = ({ onStartTrial }) => {
  return (
    <section className="py-20 px-10" style={{ background: 'var(--card-bg)' }}>
      <div className="max-w-[900px] mx-auto">
        <div className="bg-[#0a0f1a] rounded-3xl p-16 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          <h2
            className="text-4xl font-bold text-white mb-4"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Ready to transform your
            <br />
            legal research?
          </h2>
          <p className="text-base text-slate-400 max-w-[500px] mx-auto mb-8 leading-relaxed">
            Join elite law firms and legal departments already using Propylon's
            auditable AI platform to win cases faster and with more confidence.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={onStartTrial}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-base hover:bg-blue-700 transition-all border-none cursor-pointer"
            >
              Start Free Trial
            </button>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-transparent text-white font-semibold text-base border border-white/20 hover:bg-white/5 hover:border-white/30 transition-all no-underline"
            >
            
              Talk to Sales
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};