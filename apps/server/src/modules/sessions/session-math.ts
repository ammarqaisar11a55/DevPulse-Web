import { MAX_SESSION_SECONDS } from '@devpulse/shared';
import { badRequest } from '../../utils/errors';

/** Tolerated client clock drift for timestamps slightly in the future. */
export const CLOCK_SKEW_MS = 5 * 60 * 1000;

export interface SessionTiming {
  durationSeconds: number;
  activeSeconds: number;
  idleSeconds: number;
}

/**
 * Derives duration, active and idle time for a session.
 * Active time is clamped to the wall-clock duration; idle time is the remainder.
 */
export function computeTiming(
  startedAt: Date,
  effectiveEnd: Date,
  requestedActiveSeconds: number,
): SessionTiming {
  const durationSeconds = Math.round((effectiveEnd.getTime() - startedAt.getTime()) / 1000);
  if (durationSeconds < 0) {
    throw badRequest('The session cannot end before it starts', [
      { path: 'endedAt', message: 'Must be after startedAt' },
    ]);
  }
  if (durationSeconds > MAX_SESSION_SECONDS) {
    throw badRequest('Sessions cannot be longer than 24 hours', [
      { path: 'endedAt', message: 'Session is too long' },
    ]);
  }
  const activeSeconds = Math.min(Math.max(0, Math.round(requestedActiveSeconds)), durationSeconds);
  return { durationSeconds, activeSeconds, idleSeconds: durationSeconds - activeSeconds };
}

export function assertNotInFuture(value: Date, field: string, now = new Date()) {
  if (value.getTime() > now.getTime() + CLOCK_SKEW_MS) {
    throw badRequest('Timestamps cannot be in the future', [
      { path: field, message: 'Cannot be in the future' },
    ]);
  }
}

/**
 * Normalises a per-language breakdown so it never exceeds the session's active time.
 * Falls back to attributing all active time to the primary language.
 */
export function normaliseLanguages(
  languages: { language: string; activeSeconds: number }[] | undefined,
  primary: string | null | undefined,
  activeSeconds: number,
) {
  if (languages && languages.length > 0) {
    const merged = new Map<string, number>();
    for (const entry of languages)
      merged.set(entry.language, (merged.get(entry.language) ?? 0) + entry.activeSeconds);
    const total = [...merged.values()].reduce((sum, value) => sum + value, 0);
    const scale = total > activeSeconds && total > 0 ? activeSeconds / total : 1;
    return [...merged.entries()]
      .map(([language, seconds]) => ({ language, activeSeconds: Math.round(seconds * scale) }))
      .filter((entry) => entry.activeSeconds > 0)
      .sort((a, b) => b.activeSeconds - a.activeSeconds);
  }
  return primary && activeSeconds > 0 ? [{ language: primary, activeSeconds }] : [];
}
