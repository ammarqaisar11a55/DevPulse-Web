import type { DailyPoint } from '@devpulse/shared';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDuration } from '@/lib/format';
import { AXIS_TICK, BAR_RADIUS, GRID_STROKE, hourTicks, hoursTick } from './axis';
import { ChartFrame } from './ChartFrame';
import { ChartTooltipCard } from './ChartTooltip';

interface DailyBarChartProps {
  data: DailyPoint[];
  height?: number;
  /** Label format for the x axis. */
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

/** Single-series bar chart of active coding time per day. */
export function DailyBarChart({ data, height = 240, tickFormat = 'weekday' }: DailyBarChartProps) {
  const max = Math.max(0, ...data.map((point) => point.seconds));
  const ticks = hourTicks(max);
  const total = data.reduce((sum, point) => sum + point.seconds, 0);
  const label = (key: string) =>
    tickFormat === 'weekday' ? weekday.format(dateOf(key)) : shortDate.format(dateOf(key));

  return (
    <ChartFrame
      height={height}
      summary={`Coding time per day, ${formatDuration(total)} in total over ${data.length} days.`}
      table={{
        headers: ['Day', 'Coding time', 'Sessions'],
        rows: data.map((point) => [
          longDate.format(dateOf(point.date)),
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
            tickFormatter={label}
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
                  title={longDate.format(dateOf(point.date))}
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
