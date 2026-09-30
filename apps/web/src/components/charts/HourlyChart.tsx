import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDuration } from '@/lib/format';
import { AXIS_TICK, BAR_RADIUS, GRID_STROKE, hourTicks, hoursTick } from './axis';
import { ChartFrame } from './ChartFrame';
import { ChartTooltipCard } from './ChartTooltip';

const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

/** Active coding time by local hour of day (single series). */
export function HourlyChart({
  data,
  height = 220,
}: {
  data: { hour: number; seconds: number }[];
  height?: number;
}) {
  const max = Math.max(0, ...data.map((point) => point.seconds));
  const ticks = hourTicks(max);
  const peak = data.reduce(
    (best, point) => (point.seconds > best.seconds ? point : best),
    data[0] ?? { hour: 0, seconds: 0 },
  );

  return (
    <ChartFrame
      height={height}
      summary={
        max === 0
          ? 'No coding time by hour in this range.'
          : `Coding time by hour of day. Busiest hour starts at ${hourLabel(peak.hour)}.`
      }
      table={{
        headers: ['Hour', 'Coding time'],
        rows: data.map((point) => [hourLabel(point.hour), formatDuration(point.seconds)]),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 4, bottom: 0, left: -12 }}
          barCategoryGap="18%"
        >
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis
            dataKey="hour"
            ticks={[0, 3, 6, 9, 12, 15, 18, 21]}
            tickFormatter={(hour: number) => String(hour).padStart(2, '0')}
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
              const point = payload?.[0]?.payload as { hour: number; seconds: number } | undefined;
              if (!active || !point) return null;
              return (
                <ChartTooltipCard
                  title={`${hourLabel(point.hour)} to ${hourLabel((point.hour + 1) % 24)}`}
                  rows={[{ label: 'Coding time', value: formatDuration(point.seconds) }]}
                />
              );
            }}
          />
          <Bar
            dataKey="seconds"
            fill="var(--chart-1)"
            radius={BAR_RADIUS}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
