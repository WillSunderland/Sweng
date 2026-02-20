import React, { useState, useEffect } from 'react';
import { Navigation } from '../components/landing/Navigation';
import { HeroSection } from '../components/landing/HeroSection';
import { StatsBar } from '../components/landing/StatsBar';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { CTASection } from '../components/landing/CTASection';
import { Footer } from '../components/landing/Footer';
import { AuthModal } from '../components/landing/AuthModal';
import { ANIMATION_DELAYS_MS } from '../constants/landingConstants';

type AuthView = 'login' | 'register';

const LandingPage: React.FC = () => {
  const [isNavRevealed, setIsNavRevealed] = useState(false);
  const [isHeroContentRevealed, setIsHeroContentRevealed] = useState(false);
  const [isHeroPreviewRevealed, setIsHeroPreviewRevealed] = useState(false);
  const [isPreviewFlat, setIsPreviewFlat] = useState(false);
  const [authModal, setAuthModal] = useState<AuthView | null>(null);

  useEffect(() => {
    const timers = [
      setTimeout(() => setIsNavRevealed(true), ANIMATION_DELAYS_MS.NAV_REVEAL),
      setTimeout(() => setIsHeroContentRevealed(true), ANIMATION_DELAYS_MS.HERO_CONTENT_REVEAL),
      setTimeout(() => setIsHeroPreviewRevealed(true), ANIMATION_DELAYS_MS.HERO_PREVIEW_REVEAL),
      setTimeout(() => setIsPreviewFlat(true), ANIMATION_DELAYS_MS.PARALLAX_COMPLETE),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="landing-page min-h-screen bg-gray-50 font-sans text-gray-900 overflow-x-hidden">
      <Navigation
        isRevealed={isNavRevealed}
        onLoginClick={() => setAuthModal('login')}
        onGetStartedClick={() => setAuthModal('register')}
      />
      <HeroSection
        isContentRevealed={isHeroContentRevealed}
        isPreviewRevealed={isHeroPreviewRevealed}
        isPreviewFlat={isPreviewFlat}
        onRequestDemo={() => setAuthModal('register')}
      />
      <StatsBar />
      <FeaturesSection />
      <CTASection onStartTrial={() => setAuthModal('register')} />
      <Footer />

      {authModal && (
        <AuthModal
          view={authModal}
          onClose={() => setAuthModal(null)}
          onSwitchView={(view) => setAuthModal(view)}
        />
      )}
    </div>
  );
};

export default LandingPage;