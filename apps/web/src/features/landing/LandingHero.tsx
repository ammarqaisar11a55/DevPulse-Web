import { Download } from 'lucide-react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { PulseWeekPreview } from '@/components/pulse/PulseWeekPreview';
import { ButtonLink } from '@/components/ui/Button';
import { EXTENSION_DOWNLOAD_URL } from './links';

export function LandingHero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  // The preview drifts slower than the page and the copy eases out as the hero leaves view.
  const previewY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 80]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.7], reduce ? [1, 1] : [1, 0.2]);

  return (
    <section
      ref={ref}
      className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pt-24"
    >
      <motion.div style={{ opacity: copyOpacity }}>
        <h1 className="text-[2.75rem] leading-[1.02] font-semibold sm:text-6xl">
          Understand how you code.
        </h1>
        <p className="mt-6 max-w-lg text-lg text-ink-muted">
          DevPulse measures your development time across projects, languages and editors, so you can
          see where your hours go and build better coding habits.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink to="/register" size="lg">
            Get started
          </ButtonLink>
          <ButtonLink to="/dashboard" size="lg" variant="secondary">
            View dashboard
          </ButtonLink>
        </div>
        <a
          href={EXTENSION_DOWNLOAD_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <Download className="size-4" aria-hidden />
          Download the VS Code extension
        </a>
        <p className="mt-4 text-sm text-ink-subtle">
          Free to use. Your source code never leaves your machine.
        </p>
      </motion.div>
      <motion.figure
        style={{ y: previewY }}
        className="rounded-sheet border border-line bg-surface p-6 sm:p-8"
      >
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <p className="font-display text-xl font-semibold">A week of coding</p>
          <p className="tabular text-sm text-ink-muted">27h 41m active</p>
        </div>
        <PulseWeekPreview />
        <figcaption className="mt-5 text-xs text-ink-subtle">
          Example data. Each block is a session; stronger blue means more active time.
        </figcaption>
      </motion.figure>
    </section>
  );
}
