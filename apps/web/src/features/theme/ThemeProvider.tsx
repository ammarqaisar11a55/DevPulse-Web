import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeContext } from './theme-context';
import {
  readStoredTheme,
  resolveTheme,
  systemDarkQuery,
  writeStoredTheme,
  type ResolvedTheme,
  type ThemePreference,
} from './theme-storage';

const TRANSITION_MS = 250;

function applyTheme(theme: ResolvedTheme, animate: boolean) {
  const root = document.documentElement;
  if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('theme-transition');
    window.setTimeout(() => root.classList.remove('theme-transition'), TRANSITION_MS);
  }
  root.classList.toggle('dark', theme === 'dark');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredTheme);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(preference));

  // Follow OS changes while the preference is "system".
  useEffect(() => {
    if (preference !== 'system') return;
    const query = systemDarkQuery();
    const onChange = () => {
      const next = query.matches ? 'dark' : 'light';
      applyTheme(next, true);
      setResolved(next);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [preference]);

  // Keep tabs in sync when the preference changes elsewhere.
  useEffect(() => {
    const onStorage = () => {
      const next = readStoredTheme();
      setPreferenceState(next);
      const nextResolved = resolveTheme(next);
      applyTheme(nextResolved, false);
      setResolved(nextResolved);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    writeStoredTheme(next);
    setPreferenceState(next);
    const nextResolved = resolveTheme(next);
    applyTheme(nextResolved, true);
    setResolved(nextResolved);
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
