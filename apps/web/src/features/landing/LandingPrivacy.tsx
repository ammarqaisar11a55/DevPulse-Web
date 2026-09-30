import { Check, X } from 'lucide-react';
import { Reveal } from './motion';

const RECORDED = [
  'Coding duration and idle time',
  'Activity timestamps',
  'Project and repository names',
  'Languages and git branch',
  'Editor and device name',
];
const NEVER = [
  'Source code or file contents',
  'Passwords, secrets or .env values',
  'Keystrokes or screenshots',
  'Anything outside your editor',
];

export function LandingPrivacy() {
  return (
    <section
      id="privacy"
      aria-labelledby="privacy-heading"
      className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6"
    >
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Reveal>
          <h2 id="privacy-heading" className="text-3xl font-semibold sm:text-4xl">
            Metadata, not surveillance
          </h2>
          <p className="mt-4 max-w-md text-ink-muted">
            DevPulse is built to measure your time, not to watch your work. Branch names and
            repository URLs can be switched off, and the server discards them when you do.
          </p>
        </Reveal>
        <div className="grid gap-8 sm:grid-cols-2">
          <Reveal delay={0.05}>
            <h3 className="font-sans text-base font-semibold">What DevPulse records</h3>
            <ul className="mt-4 grid gap-3">
              {RECORDED.map((item) => (
                <li key={item} className="flex gap-2.5 text-ink-muted">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.15}>
            <h3 className="font-sans text-base font-semibold">What it never collects</h3>
            <ul className="mt-4 grid gap-3">
              {NEVER.map((item) => (
                <li key={item} className="flex gap-2.5 text-ink-muted">
                  <X className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
