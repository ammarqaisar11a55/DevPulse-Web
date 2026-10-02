import type { LeaderboardDto, LeaderboardEntry } from '@devpulse/shared';
import { describe, expect, it } from 'vitest';
import { ordinal, standingSentence } from '@/features/leaderboard/standing';

const entry = (rank: number, fullName: string, hours: number, isCurrentUser = false) =>
  ({
    rank,
    fullName,
    username: fullName.toLowerCase(),
    avatarUrl: null,
    seconds: hours * 3600,
    isCurrentUser,
  }) satisfies LeaderboardEntry;

function board(
  entries: LeaderboardEntry[],
  me: LeaderboardDto['me'],
  participants = entries.length,
): LeaderboardDto {
  return { period: 'week', from: '', to: '', participants, entries, me };
}

describe('ordinal', () => {
  it('uses English ordinal suffixes', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '101st',
    ]);
  });
});

describe('standingSentence', () => {
  const field = [entry(1, 'Priya Raman', 10), entry(2, 'Sam Carter', 7, true), entry(3, 'Noah', 2)];

  it('names who the user is chasing', () => {
    const data = board(field, { optedIn: true, rank: 2, seconds: 7 * 3600 });
    expect(standingSentence(data, 'week')).toBe("You're 2nd of 3 this week, 3h 00m behind Priya.");
  });

  it('names who is behind when the user leads', () => {
    const data = board([entry(1, 'Sam Carter', 9, true), entry(2, 'Jordan Lee', 4)], {
      optedIn: true,
      rank: 1,
      seconds: 9 * 3600,
    });
    expect(standingSentence(data, 'day')).toBe("You're 1st of 2 today, 5h 00m ahead of Jordan.");
  });

  it('compares with the last listed developer when ranked below the list', () => {
    const data = board(field.slice(0, 1), { optedIn: true, rank: 60, seconds: 3600 }, 80);
    expect(standingSentence(data, 'month')).toBe(
      "You're 60th of 80 this month, 9h 00m behind Priya.",
    );
  });

  it('covers being alone, unranked and not listed', () => {
    expect(
      standingSentence(
        board([entry(1, 'Sam', 1, true)], { optedIn: true, rank: 1, seconds: 3600 }),
        'week',
      ),
    ).toBe("You're 1st of 1 this week, the only developer listed so far.");
    expect(standingSentence(board(field, { optedIn: true, rank: null, seconds: 0 }), 'day')).toBe(
      'You will be ranked once you record some coding today.',
    );
    expect(standingSentence(board(field, { optedIn: false, rank: null, seconds: 0 }), 'week')).toBe(
      'You are not listed. 3 developers are ranked this week.',
    );
  });
});
