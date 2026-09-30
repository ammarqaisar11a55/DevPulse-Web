import { PulseAxis, PulseStrip, type PulseBlock } from './PulseStrip';

/* Illustrative week used on public pages; decorative, not user data. */
const SAMPLE_WEEK: { day: string; blocks: [number, number, number][] }[] = [
  {
    day: 'Mon',
    blocks: [
      [540, 610, 0.9],
      [640, 745, 0.75],
      [840, 990, 0.95],
    ],
  },
  {
    day: 'Tue',
    blocks: [
      [560, 700, 0.8],
      [900, 960, 0.45],
      [1260, 1350, 0.9],
    ],
  },
  {
    day: 'Wed',
    blocks: [
      [600, 690, 0.6],
      [780, 930, 0.85],
    ],
  },
  {
    day: 'Thu',
    blocks: [
      [520, 640, 0.95],
      [700, 760, 0.35],
      [820, 1010, 0.8],
    ],
  },
  {
    day: 'Fri',
    blocks: [
      [570, 720, 0.7],
      [860, 950, 0.9],
    ],
  },
  {
    day: 'Sat',
    blocks: [
      [660, 780, 0.55],
      [1320, 1410, 0.95],
    ],
  },
  { day: 'Sun', blocks: [[1140, 1230, 0.7]] },
];

const toBlocks = (day: string, blocks: [number, number, number][]): PulseBlock[] =>
  blocks.map(([startMinute, endMinute, activeRatio], index) => ({
    id: `${day}-${index}`,
    startMinute,
    endMinute,
    activeRatio,
    label: '',
  }));

/** A decorative week of pulse strips with a gentle staggered reveal. */
export function PulseWeekPreview({ className }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-2.5 ${className ?? ''}`} aria-hidden>
      {SAMPLE_WEEK.map(({ day, blocks }, index) => (
        <div
          key={day}
          className="grid grid-cols-[2.5rem_1fr] items-center gap-3 animate-rise"
          style={{ animationDelay: `${index * 60}ms` }}
        >
          <span className="text-xs text-ink-subtle">{day}</span>
          <PulseStrip blocks={toBlocks(day, blocks)} height="sm" />
        </div>
      ))}
      <div className="grid grid-cols-[2.5rem_1fr] gap-3">
        <span />
        <PulseAxis />
      </div>
    </div>
  );
}
