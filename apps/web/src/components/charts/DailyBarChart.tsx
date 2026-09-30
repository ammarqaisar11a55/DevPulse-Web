import type { DailyPoint, Granularity } from '@devpulse/shared';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDuration } from '@/lib/format';
import { AXIS_TICK, BAR_RADIUS, GRID_STROKE, hourTicks, hoursTick } from './axis';
import { ChartFrame } from './ChartFrame';
import { ChartTooltipCard } from './ChartTooltip';

interface DailyBarChartProps {
  data: DailyPoint[];
  height?: number;
  /** Bucket size of each point; dates are the first day of the bucket. */
  granularity?: Granularity;
  /** Label format for daily x-axis ticks. */
  tickFormat?: 'weekday' | 'day';
}

const dateOf = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!, 12));
};
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const longDate = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});
const monthName = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' });
const monthLong = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Single-series bar chart of active coding time per day, week or month. */
export function DailyBarChart({
  data,
  height = 240,
  granularity = 'day',
  tickFormat = 'weekday',
}: DailyBarChartProps) {
  const max = Math.max(0, ...data.map((point) => point.seconds));
  const ticks = hourTicks(max);
  const total = data.reduce((sum, point) => sum + point.seconds, 0);

  const tickLabel = (key: string) => {
    if (granularity === 'month') return monthName.format(dateOf(key));
    if (granularity === 'week' || tickFormat === 'day') return shortDate.format(dateOf(key));
    return weekday.format(dateOf(key));
  };
  const periodTitle = (key: string) => {
    if (granularity === 'month') return monthLong.format(dateOf(key));
    if (granularity === 'week') return `Week of ${shortDate.format(dateOf(key))}`;
    return longDate.format(dateOf(key));
  };

  return (
    <ChartFrame
      height={height}
      summary={`Coding time per ${granularity}, ${formatDuration(total)} in total over ${data.length} ${granularity}s.`}
      table={{
        headers: ['Period', 'Coding time', 'Sessions'],
        rows: data.map((point) => [
          periodTitle(point.date),
          formatDuration(point.seconds),
          point.sessions,
        ]),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 4, bottom: 0, left: -12 }}
          barCategoryGap="28%"
        >
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis
            dataKey="date"
            tickFormatter={tickLabel}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: GRID_STROKE }}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            ticks={ticks}
            domain={[0, ticks.at(-1) ?? 3600]}
            tickFormatter={hoursTick}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ fill: 'var(--surface-3)', opacity: 0.6 }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as DailyPoint | undefined;
              if (!active || !point) return null;
              return (
                <ChartTooltipCard
                  title={periodTitle(point.date)}
                  rows={[
                    { label: 'Coding time', value: formatDuration(point.seconds) },
                    { label: 'Sessions', value: point.sessions },
                  ]}
                />
              );
            }}
          />
          <Bar
            dataKey="seconds"
            fill="var(--chart-1)"
            radius={BAR_RADIUS}
            maxBarSize={44}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
