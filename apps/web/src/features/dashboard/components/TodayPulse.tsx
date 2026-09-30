import type { DayBlock } from '@devpulse/shared';
import { useEffect, useState } from 'react';
import { PulseAxis, PulseStrip, type PulseBlock } from '@/components/pulse/PulseStrip';
import { Panel } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDuration, formatTime } from '@/lib/format';
import { localDateKey, minutesOfDay } from '@/lib/timezone';

interface TodayPulseProps {
  blocks: DayBlock[] | undefined;
  todaySeconds: number | undefined;
  timeZone: string;
}

/** Re-renders every minute so the "now" marker moves. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function TodayPulse({ blocks, todaySeconds, timeZone }: TodayPulseProps) {
  const now = useNow();
  const todayKey = localDateKey(now, timeZone);

  const pulseBlocks: PulseBlock[] = (blocks ?? []).map((block) => {
    // Clip sessions that began yesterday to the start of today.
    const startsToday = localDateKey(block.startedAt, timeZone) === todayKey;
    const startMinute = startsToday ? minutesOfDay(block.startedAt, timeZone) : 0;
    const endMinute =
      localDateKey(block.endedAt, timeZone) === todayKey
        ? minutesOfDay(block.endedAt, timeZone)
        : 24 * 60;
    return {
      id: block.id,
      startMinute,
      endMinute,
      activeRatio: block.activeRatio,
      label: `${block.projectName ?? 'No project'}, ${formatTime(block.startedAt, timeZone)} to ${formatTime(block.endedAt, timeZone)}, ${Math.round(block.activeRatio * 100)}% active`,
    };
  });

  const count = pulseBlocks.length;
  return (
    <Panel className="mb-6 overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-5">
        <div>
          <h2 className="text-base font-semibold">Today</h2>
          {todaySeconds === undefined ? (
            <Skeleton className="mt-2 h-12 w-40" />
          ) : (
            <p className="tabular mt-1 font-display text-5xl leading-none font-semibold tracking-tight">
              {formatDuration(todaySeconds)}
            </p>
          )}
        </div>
        <p className="text-sm text-ink-muted">
          {count === 0
            ? 'No sessions yet today'
            : `${count} ${count === 1 ? 'session' : 'sessions'} so far`}
        </p>
      </div>
      <div className="px-5 pt-6 pb-5">
        {blocks === undefined ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <PulseStrip
            height="lg"
            blocks={pulseBlocks}
            nowMinute={minutesOfDay(now, timeZone)}
            label={
              count === 0
                ? 'No coding sessions today'
                : `Today's coding sessions: ${pulseBlocks.map((block) => block.label).join('; ')}`
            }
          />
        )}
        <PulseAxis className="mt-1.5" />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-5 rounded-sm bg-pulse-4" />
            Mostly active
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-5 rounded-sm bg-pulse-1" />
            More idle time
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-0.5 rounded-full bg-amber" />
            Now
          </span>
        </div>
      </div>
    </Panel>
  );
}
