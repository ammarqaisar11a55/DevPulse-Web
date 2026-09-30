import { BarChart3, Clock3, FolderGit2, History, Laptop, Target } from 'lucide-react';
import { Reveal, StaggerGroup, StaggerItem } from './motion';

const FEATURES = [
  {
    icon: Clock3,
    title: 'Coding time',
    body: 'Active time is measured separately from idle time, per day, week and month, in your own time zone.',
  },
  {
    icon: FolderGit2,
    title: 'Projects',
    body: 'Workspaces map to projects automatically, so you see exactly where each week went.',
  },
  {
    icon: History,
    title: 'Sessions',
    body: 'Every session keeps its start, end, languages, branch and editor, with idle time broken out.',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    body: 'The hours you code best, your busiest weekdays and how your languages shift over time.',
  },
  {
    icon: Target,
    title: 'Goals',
    body: 'Daily, weekly or monthly targets for time or sessions, with a nudge when you are close.',
  },
  {
    icon: Laptop,
    title: 'VS Code integration',
    body: 'Pair an editor with a one-time key. Revoke any device instantly from the web app.',
  },
];

export function LandingFeatures() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6"
    >
      <Reveal>
        <h2 id="features-heading" className="max-w-2xl text-3xl font-semibold sm:text-4xl">
          Everything you need to see how your development time is spent
        </h2>
      </Reveal>
      <StaggerGroup className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <StaggerItem key={title} className="border-t border-line pt-6">
            <Icon className="size-5 text-accent" aria-hidden />
            <h3 className="mt-4 font-sans text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-ink-muted">{body}</p>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}
