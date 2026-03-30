import React from 'react';
import './ThemeToggle.css';

interface ThemeToggleProps {
  darkMode: boolean;
  toggle: () => void;
}

const SunIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

const MoonIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const ThemeToggle: React.FC<ThemeToggleProps> = ({ darkMode, toggle }) => {
  return (
    <button
      className={`theme-toggle${darkMode ? ' theme-toggle--dark' : ''}`}
      onClick={toggle}
      role="switch"
      aria-checked={darkMode}
      aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="theme-toggle__label">
        {darkMode ? <MoonIcon /> : <SunIcon />}
        {darkMode ? 'Dark mode' : 'Light mode'}
      </span>
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb" />
      </span>
    </button>
  );
};

export default ThemeToggle;
