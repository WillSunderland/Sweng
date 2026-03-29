import React from 'react';
import { GradientBackground } from './GradientBackground';
import { AppPreview } from './AppPreview';

interface HeroSectionProps {
  isContentRevealed: boolean;
  isPreviewRevealed: boolean;
  isPreviewFlat: boolean;
  onRequestDemo: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  isContentRevealed,
  isPreviewRevealed,
  isPreviewFlat,
  onRequestDemo,
}) => {
  return (
    <section className="min-h-screen bg-slate-50 pt-[100px] pb-[40px] px-10 relative overflow-hidden">
      <GradientBackground />

      <div className="max-w-[1400px] mx-auto flex flex-col items-center relative z-10">
        <div
          className={`text-center max-w-[900px] mb-10 transition-all duration-800 ${
            isContentRevealed
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-[60px]'
          }`}
        >
          <div className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-lg border border-slate-200/80 px-4 py-2 rounded-full text-[13px] font-semibold text-slate-600 mb-6 shadow-sm">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            NEXT-GEN LEGAL INTELLIGENCE
          </div>

          <h1
            className="text-[62px] font-bold leading-[1.1] tracking-[-2px] text-slate-900 mb-5"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Transparency, Auditability, and
            <br />
            <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              AI Legal Research
            </span>
          </h1>

          <p className="text-lg leading-[1.7] text-slate-600 mb-8 max-w-[620px] mx-auto">
            Empowering legal professionals with verifiable intelligence and eco-conscious compute power. Bridge the gap between AI speed and courtroom-grade accuracy.
          </p>

          <div className="flex justify-center gap-3 mb-8">
            <button
              onClick={onRequestDemo}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold text-[15px] hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-lg transition-all border-none cursor-pointer"
            >
              Request Demo
            </button>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-slate-900 font-semibold text-[15px] border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all no-underline"
            >
              Platform Overview
            </a>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div className="flex">
              <div className="w-9 h-9 rounded-full border-[2px] border-white flex items-center justify-center text-[12px] font-semibold text-white bg-gradient-to-br from-indigo-400 to-purple-700">
                JD
              </div>
              <div className="w-9 h-9 rounded-full border-[2px] border-white flex items-center justify-center text-[12px] font-semibold text-white bg-gradient-to-br from-fuchsia-300 to-rose-500 -ml-2.5">
                SK
              </div>
              <div className="w-9 h-9 rounded-full border-[2px] border-white flex items-center justify-center text-[12px] font-semibold text-white bg-gradient-to-br from-sky-400 to-cyan-300 -ml-2.5">
                ML
              </div>
            </div>
            <span className="text-sm text-slate-400">
              Trusted by <strong className="text-slate-900">200+</strong> global law firms
            </span>
          </div>
        </div>

        <div
          className={`relative w-full max-w-[1200px] transition-all duration-1000 delay-300 ${
            isPreviewRevealed
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-[100px]'
          }`}
          style={{ perspective: '1500px' }}
        >
          <AppPreview isFlat={isPreviewFlat} />
        </div>
      </div>
    </section>
  );
};
