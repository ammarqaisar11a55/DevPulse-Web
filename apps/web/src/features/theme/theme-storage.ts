export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Must match the key read by the inline boot script in index.html. */
export const THEME_STORAGE_KEY = 'devpulse:theme';

export function readStoredTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function writeStoredTheme(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the theme still applies for this visit.
  }
}

export const systemDarkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return systemDarkQuery().matches ? 'dark' : 'light';
  return preference;
}
