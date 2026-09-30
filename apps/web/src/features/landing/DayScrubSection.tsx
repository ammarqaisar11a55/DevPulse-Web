import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import { useRef, useState } from 'react';
import { PulseAxis, PulseStrip, type PulseBlock } from '@/components/pulse/PulseStrip';
import { ColorDot } from '@/components/ui/Badge';
import { projectColor } from '@/lib/colors';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/format';

const DAY_MINUTES = 24 * 60;

/* An illustrative coding day; decorative example data. [start, end, active share, project, colour] */
const SAMPLE_DAY: [number, number, number, string, string][] = [
  [8 * 60 + 50, 10 * 60 + 5, 0.9, 'Notes Saver', 'blue'],
  [10 * 60 + 25, 12 * 60 + 20, 0.82, 'Notes Saver', 'blue'],
  [14 * 60, 16 * 60 + 10, 0.94, 'PortPilot', 'teal'],
  [16 * 60 + 40, 17 * 60 + 20, 0.48, 'DevPulse', 'violet'],
  [20 * 60 + 30, 22 * 60 + 15, 0.88, 'Ray Tracer', 'amber'],
];

const BLOCKS: PulseBlock[] = SAMPLE_DAY.map(
  ([startMinute, endMinute, activeRatio, project], index) => ({
    id: `sample-${index}`,
    startMinute,
    endMinute,
    activeRatio,
    label: project,
  }),
);

/** Active seconds recorded up to `minute`, counting partially elapsed sessions proportionally. */
function activeSecondsUntil(minute: number) {
  return SAMPLE_DAY.reduce((total, [start, end, ratio]) => {
    const elapsed = Math.max(0, Math.min(end, minute) - start);
    return total + elapsed * 60 * ratio;
  }, 0);
}

const clock = (minute: number) => {
  const clamped = Math.min(minute, DAY_MINUTES - 1);
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
};

/**
 * The landing page's signature moment: the section pins while scrolling through it, and scroll
 * position becomes the time of day. The pulse strip is revealed session by session as the clock
 * advances. With reduced motion, the completed day is shown without pinning or scrubbing.
 */
export function DayScrubSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  // Leave a little dwell at both ends so the day starts empty and finishes complete.
  const dayProgress = useTransform(scrollYProgress, [0.08, 0.92], [0, 1], { clamp: true });
  const coverScale = useTransform(dayProgress, [0, 1], [1, 0]);
  const markerX = useTransform(dayProgress, [0, 1], ['0%', '100%']);

  const [minute, setMinute] = useState(reduce ? DAY_MINUTES : 0);
  useMotionValueEvent(dayProgress, 'change', (value) => {
    // Update the readout in 5-minute steps to keep re-renders cheap.
    const next = Math.round((value * DAY_MINUTES) / 5) * 5;
    setMinute((current) => (current === next ? current : next));
  });

  const shownMinute = reduce ? DAY_MINUTES : minute;
  const reached = SAMPLE_DAY.filter(([start]) => start <= shownMinute);

  return (
    <section
      ref={ref}
      aria-labelledby="day-heading"
      className={cn('relative border-y border-line bg-surface', !reduce && 'h-[260vh]')}
    >
      <div className={cn('flex items-center', !reduce && 'sticky top-0 h-dvh')}>
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-20">
          <div className="grid gap-6 sm:gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
            <div>
              <h2 id="day-heading" className="text-3xl font-semibold sm:text-4xl">
                A day of coding, as DevPulse sees it
              </h2>
              <p className="mt-4 max-w-md text-ink-muted">
                Each session lands on your timeline with its project and how much of it you spent
                actively writing code.
                {!reduce && ' Keep scrolling to play through the day.'}
              </p>
            </div>
            <div className="flex items-end justify-between gap-6 lg:justify-end lg:gap-12">
              <div>
                <p className="text-sm text-ink-muted">Time of day</p>
                <p
                  className="tabular font-display text-5xl leading-none font-semibold tracking-tight sm:text-6xl"
                  aria-live="off"
                >
                  {clock(shownMinute)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-ink-muted">Active so far</p>
                <p className="tabular font-display text-3xl leading-none font-semibold tracking-tight text-accent sm:text-4xl">
                  {formatDuration(activeSecondsUntil(shownMinute))}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 sm:mt-12">
            {/* overflow-x-clip keeps the moving marker from widening the page without breaking sticky. */}
            <div className="relative overflow-x-clip py-2">
              <PulseStrip
                blocks={BLOCKS}
                height="lg"
                label="Example day with five coding sessions between 08:50 and 22:15"
              />
              {!reduce && (
                <>
                  {/* Covers the part of the day that has not "happened" yet. */}
                  <motion.div
                    aria-hidden
                    style={{ scaleX: coverScale }}
                    className="absolute -inset-y-px right-0 left-0 origin-right bg-surface"
                  />
                  <motion.div
                    aria-hidden
                    style={{ x: markerX }}
                    className="pointer-events-none absolute inset-0"
                  >
                    <span className="absolute inset-y-0 left-0 w-0.5 -translate-x-1/2 rounded-full bg-amber" />
                  </motion.div>
                </>
              )}
            </div>
            <PulseAxis className="mt-2" />
          </div>

          <ol
            className="mt-6 grid grid-cols-2 gap-2 sm:mt-10 sm:gap-3 lg:grid-cols-5"
            aria-label="Sessions so far"
          >
            {SAMPLE_DAY.map(([start, end, ratio, project, color], index) => {
              const visible = reached.length > index;
              return (
                <li
                  key={`${project}-${start}`}
                  className={cn(
                    'rounded-control border border-line bg-canvas px-3 py-2.5 text-sm transition-[opacity,transform] duration-500',
                    visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
                  )}
                  aria-hidden={!visible}
                >
                  <p className="flex items-center gap-2 font-medium">
                    <ColorDot color={projectColor(color)} />
                    {project}
                  </p>
                  <p className="tabular mt-0.5 text-ink-muted">
                    {clock(start)} to {clock(end)}, {Math.round(ratio * 100)}% active
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
