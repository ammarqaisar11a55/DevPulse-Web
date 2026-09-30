import { Reveal, StaggerGroup, StaggerItem } from './motion';

const STEPS = [
  { title: 'Create an account', body: 'Sign up with your email. It takes under a minute.' },
  {
    title: 'Connect DevPulse',
    body: 'Generate a one-time key and enter it in the VS Code extension.',
  },
  {
    title: 'Code normally',
    body: 'The extension notices when you are actively coding and when you step away.',
  },
  {
    title: 'Track activity',
    body: 'Sessions sync in the background with project, language and duration.',
  },
  {
    title: 'Analyse your progress',
    body: 'Review trends, set goals and see how your habits change.',
  },
];

export function LandingHowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6"
    >
      <Reveal>
        <h2 id="how-heading" className="text-3xl font-semibold sm:text-4xl">
          How it works
        </h2>
      </Reveal>
      <StaggerGroup as="ol" className="mt-12 grid gap-8 md:grid-cols-5 md:gap-6">
        {STEPS.map((step, index) => (
          <StaggerItem as="li" key={step.title} className="relative">
            <span className="tabular font-display text-4xl font-semibold text-accent/80">
              {index + 1}
            </span>
            <span
              aria-hidden
              className="absolute top-5 right-0 left-12 hidden h-px bg-line md:block"
            />
            <h3 className="mt-3 font-sans text-base font-semibold">{step.title}</h3>
            <p className="mt-1.5 text-sm text-ink-muted">{step.body}</p>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}
