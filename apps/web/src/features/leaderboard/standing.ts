import type { LeaderboardDto, LeaderboardPeriod } from '@devpulse/shared';
import { formatDuration } from '@/lib/format';

export const PERIOD_NOUN: Record<LeaderboardPeriod, string> = {
  day: 'today',
  week: 'this week',
  month: 'this month',
};

const ordinalRules = new Intl.PluralRules('en', { type: 'ordinal' });
const SUFFIXES: Record<Intl.LDMLPluralRule, string> = {
  one: 'st',
  two: 'nd',
  few: 'rd',
  other: 'th',
  zero: 'th',
  many: 'th',
};

/** 1 → "1st", 22 → "22nd". */
export function ordinal(value: number) {
  return `${value}${SUFFIXES[ordinalRules.select(value)]}`;
}

/** First name, for compact references to other developers. */
const firstName = (fullName: string) => fullName.split(' ')[0] ?? fullName;

/**
 * One sentence describing the user's position in the race: their place and who they are
 * chasing (or leading), so the ranking reads as something to act on.
 */
export function standingSentence(data: LeaderboardDto, period: LeaderboardPeriod) {
  const when = PERIOD_NOUN[period];
  const { me, entries, participants } = data;

  if (!me.optedIn) {
    return participants === 0
      ? `Nobody is listed ${when} yet. Turn on your listing to be the first.`
      : `You are not listed. ${participants} ${participants === 1 ? 'developer is' : 'developers are'} ranked ${when}.`;
  }
  if (!me.rank) return `You will be ranked once you record some coding ${when}.`;

  const place = `You're ${ordinal(me.rank)} of ${participants} ${when}`;
  if (participants === 1) return `${place}, the only developer listed so far.`;

  if (me.rank === 1) {
    const second = entries[1];
    return second
      ? `${place}, ${formatDuration(me.seconds - second.seconds)} ahead of ${firstName(second.fullName)}.`
      : `${place}.`;
  }
  // The person directly above, or the last listed one when the user ranks below the list.
  const above = entries.find((entry) => entry.rank === me.rank! - 1) ?? entries.at(-1);
  return above
    ? `${place}, ${formatDuration(above.seconds - me.seconds)} behind ${firstName(above.fullName)}.`
    : `${place}.`;
}
