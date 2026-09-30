import { describe, expect, it } from 'vitest';
import { safeNextPath } from '@/features/auth/redirect';

describe('safeNextPath', () => {
  it('allows in-app paths', () => {
    expect(safeNextPath('/projects?page=2')).toBe('/projects?page=2');
  });

  it.each([
    null,
    '',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
  ])('falls back to the dashboard for %s', (value) => {
    expect(safeNextPath(value)).toBe('/dashboard');
  });
});
