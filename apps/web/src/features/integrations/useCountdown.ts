import { useEffect, useState } from 'react';

/** Seconds remaining until `expiresAt`, updated every second; 0 once expired. */
export function useCountdown(expiresAt: string | null) {
  const compute = () =>
    expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0;
  const [remaining, setRemaining] = useState(compute);
  useEffect(() => {
    setRemaining(compute());
    if (!expiresAt) return;
    const timer = window.setInterval(() => setRemaining(compute()), 1000);
    return () => window.clearInterval(timer);
    // compute only depends on expiresAt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);
  return remaining;
}

export function formatCountdown(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
