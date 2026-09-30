import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readStoredTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  writeStoredTheme,
} from '@/features/theme/theme-storage';

function mockSystemDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query.includes('dark'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('theme storage', () => {
  it('persists the preference and defaults to system', () => {
    expect(readStoredTheme()).toBe('system');
    writeStoredTheme('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readStoredTheme()).toBe('dark');
  });

  it('ignores unexpected stored values', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(readStoredTheme()).toBe('system');
  });

  it('resolves system preference from the OS', () => {
    mockSystemDark(true);
    expect(resolveTheme('system')).toBe('dark');
    mockSystemDark(false);
    expect(resolveTheme('system')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });
});
