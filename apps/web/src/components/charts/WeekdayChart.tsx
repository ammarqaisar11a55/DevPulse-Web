import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDuration } from '@/lib/format';
import { AXIS_TICK, BAR_RADIUS, GRID_STROKE, hourTicks, hoursTick } from './axis';
import { ChartFrame } from './ChartFrame';
import { ChartTooltipCard } from './ChartTooltip';

// 2023-01-01 was a Sunday; used only to get localised weekday names.
const names = (style: 'short' | 'long') =>
  Array.from({ length: 7 }, (_, day) =>
    new Intl.DateTimeFormat(undefined, { weekday: style, timeZone: 'UTC' }).format(
      new Date(Date.UTC(2023, 0, 1 + day, 12)),
    ),
  );
const SHORT = names('short');
const LONG = names('long');

interface WeekdayChartProps {
  data: { weekday: number; seconds: number }[];
  weekStartsOn: number;
  height?: number;
}

/** Total coding time per weekday, ordered from the user's first day of the week. */
export function WeekdayChart({ data, weekStartsOn, height = 220 }: WeekdayChartProps) {
  const ordered = Array.from({ length: 7 }, (_, index) => {
    const day = (weekStartsOn + index) % 7;
    return {
      weekday: day,
      name: SHORT[day]!,
      seconds: data.find((point) => point.weekday === day)?.seconds ?? 0,
    };
  });
  const ticks = hourTicks(Math.max(0, ...ordered.map((point) => point.seconds)));

  return (
    <ChartFrame
      height={height}
      summary="Coding time by day of the week."
      table={{
        headers: ['Day', 'Coding time'],
        rows: ordered.map((point) => [LONG[point.weekday]!, formatDuration(point.seconds)]),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={ordered}
          margin={{ top: 8, right: 4, bottom: 0, left: -12 }}
          barCategoryGap="28%"
        >
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis
            dataKey="name"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: GRID_STROKE }}
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
              const point = payload?.[0]?.payload as
                { weekday: number; seconds: number } | undefined;
              if (!active || !point) return null;
              return (
                <ChartTooltipCard
                  title={LONG[point.weekday]}
                  rows={[{ label: 'Coding time', value: formatDuration(point.seconds) }]}
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
