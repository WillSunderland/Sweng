import React from 'react';
import { FOOTER_LINKS } from '../../../constants/landingConstants';
import propylonLogo from '../../../assets/propylon_logo.svg';

const CURRENT_YEAR = new Date().getFullYear();

export const Footer: React.FC = () => {
  return (
    <footer className="py-8 px-10 border-t" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-light)' }}>
      <div className="max-w-[1200px] mx-auto flex justify-between items-center">
        <div className="flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <img src={propylonLogo} alt="Propylon logo" className="w-8 h-8" />
            <span className="font-bold text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--text)' }}>
              rws
            </span>
            <span className="text-lg font-light" style={{ color: 'var(--text-muted)' }}>|</span>
            <span className="font-semibold text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--text)' }}>
              Propylon
            </span>
          </div>
        </div>

        <nav className="flex gap-8">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.label}
              
              href={link.href}
              className="text-sm no-underline transition-colors"
              style={{ color: 'var(--text-body)' }}
            >
            
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex gap-4">
          <a href="#" className="w-9 h-9 rounded-lg flex items-center justify-center no-underline transition-all"
            style={{ background: 'var(--bg-light)', color: 'var(--text-body)' }}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </a>
          <a href="#" className="w-9 h-9 rounded-lg flex items-center justify-center no-underline transition-all"
            style={{ background: 'var(--bg-light)', color: 'var(--text-body)' }}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.953 4.57a10 10 0 0 1-2.825.775 4.958 4.958 0 0 0 2.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 0 0-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 0 0-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 0 1-2.228-.616v.06a4.923 4.923 0 0 0 3.946 4.827 4.996 4.996 0 0 1-2.212.085 4.936 4.936 0 0 0 4.604 3.417 9.867 9.867 0 0 1-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 0 0 7.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0 0 24 4.59z" />
            </svg>
          </a>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto mt-6 pt-6 border-t text-center text-[13px]"
        style={{ borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}>
        © {CURRENT_YEAR} RWS | Propylon Platform. All rights reserved. Built for professional legal use only.
      </div>
    </footer>
  );
};