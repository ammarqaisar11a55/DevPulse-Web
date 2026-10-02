import type { CodingSessionDto } from '@devpulse/shared';
import { localDateKey } from '@/lib/timezone';

export interface DayGroup {
  /** Local calendar date, YYYY-MM-DD. */
  key: string;
  sessions: CodingSessionDto[];
  activeSeconds: number;
}

/**
 * Groups newest-first sessions by the calendar day they started on in the user's time zone.
 * Consecutive pages of the timeline can be concatenated before grouping: a day split across
 * pages merges into one group.
 */
export function groupByDay(sessions: CodingSessionDto[], timeZone: string): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const session of sessions) {
    const key = localDateKey(session.startedAt, timeZone);
    let group = groups.at(-1);
    if (group?.key !== key) {
      group = { key, sessions: [], activeSeconds: 0 };
      groups.push(group);
    }
    group.sessions.push(session);
    group.activeSeconds += session.activeSeconds;
  }
  return groups;
}
