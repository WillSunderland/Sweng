import React, { useState } from 'react';
import { useIntersectionReveal, useCounterAnimation } from '../../../hooks/useAnimations';
import { STATS, ANIMATION_DELAYS_MS, COUNTER_DURATION_MS } from '../../../constants/landingConstants';
import type { StatItem, CounterConfig } from '../../../types/landingTypes';

export const StatsBar: React.FC = () => {
  const { ref, isVisible } = useIntersectionReveal();
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className="py-10 px-10 relative z-10 border-t"
      style={{ background: 'var(--card-bg)', borderColor: 'var(--border-light)' }}
    >
      <div className="max-w-[1200px] mx-auto grid grid-cols-4 gap-10">
        {STATS.map((stat, index) => (
          <StatDisplay key={stat.label} stat={stat} index={index} isVisible={isVisible} />
        ))}
      </div>
    </div>
  );
};

interface StatDisplayProps {
  stat: StatItem;
  index: number;
  isVisible: boolean;
}

const StatDisplay: React.FC<StatDisplayProps> = ({ stat, index, isVisible }) => {
  const delayMs = index * ANIMATION_DELAYS_MS.STAT_ITEM_STAGGER;
  const [isRevealed, setIsRevealed] = useState(false);

  React.useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => setIsRevealed(true), delayMs);
      return () => clearTimeout(timer);
    }
  }, [isVisible, delayMs]);

  return (
    <div
      className={`text-center transition-all duration-500 ${
        isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
      }`}
    >
      <div className="text-[11px] uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
        {stat.label}
      </div>
      <div
        className="text-2xl font-bold"
        style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--text)' }}
      >
        {stat.counter ? (
          <CounterValue config={stat.counter} suffix={stat.counter.suffix} shouldStart={isRevealed} />
        ) : (
          stat.value
        )}
      </div>
    </div>
  );
};

interface CounterValueProps {
  config: CounterConfig;
  suffix: string;
  shouldStart: boolean;
}

const CounterValue: React.FC<CounterValueProps> = ({ config, suffix, shouldStart }) => {
  const value = useCounterAnimation(config.target, config.decimals, COUNTER_DURATION_MS, shouldStart);
  return (
    <span className="inline-block min-w-[80px]">
      {config.decimals > 0 ? value.toFixed(config.decimals) : Math.round(value)}
      {suffix}
    </span>
  );
};