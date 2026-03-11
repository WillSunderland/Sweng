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
      className={`fixed top-0 left-0 right-0 z-50 px-10 py-4 flex items-center justify-between backdrop-blur-xl border-b transition-all duration-700 ${
        isRevealed ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
      style={{ background: 'var(--nav-bg, var(--bg))', borderColor: 'var(--border-light)' }}
    >
      <a href="#" className="no-underline">
        <div className="flex items-center gap-2.5">
          <img src={propylonLogo} alt="Propylon logo" className="w-7 h-7" />
          <span className="font-bold text-lg tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--text)' }}>
            rws
          </span>
          <span className="text-lg font-light" style={{ color: 'var(--text-muted)' }}>|</span>
          <span className="font-semibold text-lg tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--text)' }}>
            Propylon
          </span>
        </div>
      </a>

      <div className="flex items-center gap-8">
        {NAV_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="no-underline text-sm font-medium transition-colors"
            style={{ color: 'var(--text-body)' }}
          >
            {link.label}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={onLoginClick}
          className="font-semibold text-sm bg-transparent border-none cursor-pointer"
          style={{ color: 'var(--text-body)' }}
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