import React from 'react';
import { SIDEBAR_NAV_ITEMS, SUGGESTION_CARDS } from '../../constants/landingConstants';
import propylonLogo from '../../assets/propylon_logo.svg';

interface AppPreviewProps {
  isFlat: boolean;
}

export const AppPreview: React.FC<AppPreviewProps> = ({ isFlat }) => {
  return (
    <div
      className={`transition-transform duration-800 origin-top ${
        isFlat ? 'scale-100' : 'scale-95'
      }`}
      style={{
        transform: isFlat ? 'rotateX(0deg) scale(1)' : 'rotateX(12deg) scale(0.95)',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        transformOrigin: 'center top',
      }}
    >
      <div className="bg-[#0a0f1a] rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        <div className="flex items-center gap-2 px-[18px] py-3.5 bg-white/[0.03] border-b border-white/5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28ca41]" />
        </div>

        <div className="min-h-[480px] flex">
          <Sidebar />
          <ChatArea />
        </div>
      </div>
    </div>
  );
};

const Sidebar: React.FC = () => {
  const iconPaths: Record<string, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </>
    ),
    file: (
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    ),
    users: (
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    ),
    search: (
      <path d="M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM21 21l-4.35-4.35" />
    ),
    chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  };

  return (
    <div className="w-[220px] bg-[#0d1320] border-r border-white/5 p-4 flex-shrink-0">
      <div className="flex items-center gap-2.5 mb-6">
        <img src={propylonLogo} alt="Propylon logo" className="w-7 h-7" />
        <span className="text-[13px] font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          rws
        </span>
        <span className="text-slate-500 text-[13px] font-light">|</span>
        <span className="text-[13px] font-semibold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Propylon
        </span>
      </div>

      {SIDEBAR_NAV_ITEMS.map((item) => (
        <div key={item.label}>
          {item.section && (
            <div className="text-[10px] text-slate-500 uppercase tracking-wide px-3 pt-4 pb-2">
              {item.section}
            </div>
          )}
          <div
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] mb-1 ${
              item.active
                ? 'bg-blue-600 text-white'
                : 'text-slate-400'
            }`}
          >
            <svg
              className={`w-[18px] h-[18px] ${item.active ? 'opacity-100' : 'opacity-70'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {iconPaths[item.icon]}
            </svg>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
};

const ChatArea: React.FC = () => {
  const accentClasses = ['accent-blue', 'accent-green', 'accent-orange', 'accent-purple'];
  const accentBgMap: Record<string, string> = {
    'accent-blue': 'bg-blue-500/20',
    'accent-green': 'bg-emerald-500/20',
    'accent-orange': 'bg-amber-500/20',
    'accent-purple': 'bg-purple-500/20',
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-10">
      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4 text-xl">
        ✦
      </div>

      <span className="text-blue-500 text-sm mb-1">Hi James</span>
      <h2
        className="text-white text-[28px] font-semibold mb-6"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        Where should we start?
      </h2>

      <div className="grid grid-cols-2 gap-2.5 w-full max-w-[400px]">
        {SUGGESTION_CARDS.map((card, i) => (
          <div key={i} className="bg-[#141c2e] border border-white/5 rounded-xl p-3.5">
            <div
              className={`w-7 h-7 rounded-md mb-2 flex items-center justify-center text-xs ${
                accentBgMap[accentClasses[i % accentClasses.length]]
              }`}
            >
              {card.icon}
            </div>
            <div className="text-white text-xs font-semibold mb-0.5">{card.title}</div>
            <div className="text-slate-500 text-[10px]">{card.description}</div>
          </div>
        ))}
      </div>

      <div className="w-full max-w-[400px] mt-6 bg-[#1a2438] border border-white/5 rounded-xl px-[18px] py-3.5 flex items-center justify-between">
        <span className="text-slate-500 text-[13px]">Ask the AI Assistant...</span>
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </div>
      </div>
    </div>
  );
};