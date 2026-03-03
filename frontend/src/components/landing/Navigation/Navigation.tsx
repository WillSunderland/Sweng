import React from 'react';
import { NAV_LINKS } from '../../../constants/landingConstants';
import propylonLogo from '../../../assets/propylon_logo.svg';

interface NavigationProps {
  isRevealed: boolean;
  onLoginClick: () => void;
  onGetStartedClick: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ isRevealed, onLoginClick, onGetStartedClick }) => {
  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 px-10 py-4 flex items-center justify-between bg-slate-50/80 backdrop-blur-xl border-b border-slate-200/50 transition-all duration-700 ${
        isRevealed ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
    >
      <a href="#" className="no-underline">
        <div className="flex items-center gap-2.5">
          <img src={propylonLogo} alt="Propylon logo" className="w-7 h-7" />
          <span className="font-bold text-lg tracking-tight text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            rws
          </span>
          <span className="text-slate-300 text-lg font-light">|</span>
          <span className="font-semibold text-lg tracking-tight text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Propylon
          </span>
        </div>
      </a>

      <div className="flex items-center gap-8">
        {NAV_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="no-underline text-slate-600 text-sm font-medium hover:text-slate-900 transition-colors"
          >
            {link.label}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={onLoginClick}
          className="text-slate-600 font-semibold text-sm hover:text-slate-900 bg-transparent border-none cursor-pointer"
        >
          Login
        </button>
        <button
          onClick={onGetStartedClick}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-lg transition-all border-none cursor-pointer"
        >
          Get Started
        </button>
      </div>
    </nav>
  );
};
