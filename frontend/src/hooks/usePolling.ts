import { useRef, useCallback } from 'react';

export function usePolling() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPolling = useCallback(
    (fn: () => Promise<boolean>, intervalMs = 1500, timeoutMs = 60000) => {
      return new Promise<void>((resolve, reject) => {
        timeoutRef.current = setTimeout(() => {
          if (intervalRef.current) clearInterval(intervalRef.current);
          reject(new Error('Polling timeout'));
        }, timeoutMs);

        intervalRef.current = setInterval(async () => {
          try {
            const done = await fn();
            if (done) {
              if (intervalRef.current) clearInterval(intervalRef.current);
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              resolve();
            }
          } catch (e) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            reject(e);
          }
        }, intervalMs);
      });
    },
    []
  );

  const stopPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return { startPolling, stopPolling };
}
