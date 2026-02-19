import { useState, useEffect, useRef, useCallback } from 'react';
import { INTERSECTION_THRESHOLD } from '../constants/landingConstants';

export function useIntersectionReveal(threshold = INTERSECTION_THRESHOLD): {
  ref: React.RefObject<HTMLDivElement>;
  isVisible: boolean;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

export function useCounterAnimation(
  target: number,
  decimals: number,
  durationMs: number,
  shouldStart: boolean
): number {
  const [value, setValue] = useState(0);
  const animationRef = useRef<number | null>(null);

  const animate = useCallback(() => {
    const startTime = performance.now();

    const updateValue = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const easeOutProgress = 1 - Math.pow(1 - progress, 3);
      
      setValue(target * easeOutProgress);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(updateValue);
      }
    };

    animationRef.current = requestAnimationFrame(updateValue);
  }, [target, durationMs]);

  useEffect(() => {
    if (shouldStart) {
      animate();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [shouldStart, animate]);

  return Number(value.toFixed(decimals));
}
