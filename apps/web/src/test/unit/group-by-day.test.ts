import type { CodingSessionDto } from '@devpulse/shared';
import { describe, expect, it } from 'vitest';
import { groupByDay } from '@/features/activity/group-by-day';

let nextId = 0;
function session(startedAt: string, activeSeconds = 600): CodingSessionDto {
  return {
    id: String(++nextId),
    source: 'EXTENSION',
    status: 'ENDED',
    title: null,
    startedAt,
    endedAt: null,
    lastHeartbeatAt: null,
    durationSeconds: activeSeconds,
    activeSeconds,
    idleSeconds: 0,
    language: null,
    repository: null,
    branch: null,
    editor: null,
    filesChanged: 0,
    linesAdded: 0,
    linesRemoved: 0,
    commits: 0,
    project: null,
    device: null,
    createdAt: startedAt,
  };
}

describe('groupByDay', () => {
  it('groups newest-first sessions by local day and totals active time', () => {
    const groups = groupByDay(
      [
        session('2026-10-02T15:00:00Z', 1200),
        session('2026-10-02T09:00:00Z', 600),
        session('2026-10-01T09:00:00Z', 300),
      ],
      'UTC',
    );
    expect(groups.map((group) => [group.key, group.sessions.length, group.activeSeconds])).toEqual([
      ['2026-10-02', 2, 1800],
      ['2026-10-01', 1, 300],
    ]);
  });

  it("uses the user's time zone, not UTC, to decide the day", () => {
    // 21:30 UTC on 1 October is 02:30 on 2 October in Karachi (UTC+5).
    const groups = groupByDay(
      [session('2026-10-01T21:30:00Z'), session('2026-10-01T18:00:00Z')],
      'Asia/Karachi',
    );
    expect(groups.map((group) => group.key)).toEqual(['2026-10-02', '2026-10-01']);
  });

  it('merges a day that is split across concatenated timeline pages', () => {
    const page1 = [session('2026-10-02T15:00:00Z'), session('2026-10-02T12:00:00Z')];
    const page2 = [session('2026-10-02T08:00:00Z'), session('2026-10-01T08:00:00Z')];
    const groups = groupByDay([...page1, ...page2], 'UTC');
    expect(groups).toHaveLength(2);
    expect(groups[0]?.sessions).toHaveLength(3);
  });
});
