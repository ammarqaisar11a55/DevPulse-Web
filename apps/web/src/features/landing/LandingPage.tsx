import { ButtonLink } from '@/components/ui/Button';
import { DayScrubSection } from './DayScrubSection';
import { LandingFeatures } from './LandingFeatures';
import { LandingFooter } from './LandingFooter';
import { LandingHeader } from './LandingHeader';
import { LandingHero } from './LandingHero';
import { LandingHowItWorks } from './LandingHowItWorks';
import { LandingPrivacy } from './LandingPrivacy';
import { Reveal, ScrollProgressBar } from './motion';

export function LandingPage() {
  return (
    <div className="min-h-dvh">
      <ScrollProgressBar />
      <LandingHeader />
      <main>
        <LandingHero />
        <DayScrubSection />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingPrivacy />
        <section aria-labelledby="cta-heading" className="border-t border-line bg-surface">
          <Reveal className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 id="cta-heading" className="text-3xl font-semibold sm:text-4xl">
                Start measuring how you code
              </h2>
              <p className="mt-3 text-ink-muted">
                Create an account, connect VS Code, and your first session appears within minutes.
              </p>
            </div>
            <ButtonLink to="/register" size="lg">
              Get started
            </ButtonLink>
          </Reveal>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
