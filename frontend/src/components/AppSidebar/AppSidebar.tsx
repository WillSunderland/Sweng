import React from 'react';
import { useNavigate } from 'react-router-dom';
import propylonLogo from '../../assets/propylon_logo.svg';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import '../../components/AppSidebar/SharedSidebar.css';

export type SidebarActiveItem = 'workspace' | 'archive' | 'assistant' | 'green';

interface AppSidebarProps {
  activeItem: SidebarActiveItem;
  darkMode?: boolean;
  toggleDarkMode?: () => void;
}

const AppSidebar: React.FC<AppSidebarProps> = ({ activeItem, darkMode = false, toggleDarkMode }) => {
  const navigate = useNavigate();

  return (
    <aside className="ai-sidebar">
      <div className="sidebar-top">
        <div className="sidebar-logo-area" onClick={() => navigate('/workspace')}>
          <img src={propylonLogo} alt="Propylon" className="sidebar-logo-svg" />
          <div className="sidebar-logo-text">
            <div className="sidebar-brand">
              <span className="brand-rws">rws</span>
              <span className="brand-divider">|</span>
              <span className="brand-propylon">Propylon</span>
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">MAIN MENU</div>
          <nav className="sidebar-nav">
            <button
              type="button"
              className={`sidebar-nav-item${activeItem === 'workspace' ? ' active' : ''}`}
              onClick={() => navigate('/workspace')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
              <span>Workspace</span>
            </button>

            <button type="button" className="sidebar-nav-item" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>Drafts</span>
            </button>

            <button type="button" className="sidebar-nav-item" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>Shared with Team</span>
            </button>

            <button
              type="button"
              className={`sidebar-nav-item${activeItem === 'archive' ? ' active' : ''}`}
              onClick={() => navigate('/history')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" />
                <path d="M10 12h4" />
              </svg>
              <span>Archive</span>
            </button>
          </nav>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">INTERNAL TOOLS</div>
            <nav className="sidebar-nav">
              <button
                type="button"
                className={`sidebar-nav-item${activeItem === 'green' ? ' active' : ''}`}
                onClick={() => navigate('/green-computing')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
                  <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
                </svg>
                <span>Green Computing</span>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item${activeItem === 'assistant' ? ' active' : ''}`}
                onClick={() => navigate('/ai-agent')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a4 4 0 0 1 4 4v2H8V6a4 4 0 0 1 4-4z" />
                  <rect x="4" y="8" width="16" height="12" rx="2" />
                  <circle cx="9" cy="14" r="1" fill="currentColor" />
                  <circle cx="15" cy="14" r="1" fill="currentColor" />
                </svg>
                <span>AI Assistant</span>
              </button></nav>
        </div>
      </div>

      <div className="sidebar-bottom">
        <button className="new-case-btn" onClick={() => navigate('/workspace')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Research Case
        </button>

        {toggleDarkMode && (
          <ThemeToggle darkMode={darkMode} toggle={toggleDarkMode} />
        )}

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=James&backgroundColor=b6e3f4"
              alt="JS"
            />
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">James Sterling</span>
            <span className="sidebar-user-role">Senior Counsel</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
