import type { ReactNode } from 'react';
import { LandingFooter } from './LandingFooter';
import { LandingHeader } from './LandingHeader';
import { ISSUES_URL } from './links';

const LAST_UPDATED = 'October 3, 2026';

const SECTIONS: { id: string; title: string; body: ReactNode }[] = [
  {
    id: 'service',
    title: 'The service',
    body: (
      <p>
        DevPulse measures how much time you spend coding, on which projects, in which languages and
        on which machines, and shows it as a dashboard, analytics and goals. Time is recorded by the
        DevPulse editor extension once you pair it with your account, or entered by you.
      </p>
    ),
  },
  {
    id: 'account',
    title: 'Your account',
    body: (
      <ul>
        <li>Give accurate details and keep your password to yourself.</li>
        <li>
          You are responsible for activity under your account and on the devices you connect. Revoke
          a device from the Devices page as soon as you no longer use or trust it.
        </li>
        <li>
          Changing your sign-in email only takes effect after you confirm the new address from the
          link we send to it.
        </li>
      </ul>
    ),
  },
  {
    id: 'data',
    title: 'Your data',
    body: (
      <>
        <p>
          You own the activity data you record. DevPulse stores metadata only: durations,
          timestamps, project names, languages, repository and branch names, and device details. It
          never collects source code, file contents, passwords or environment values.
        </p>
        <p>
          You can stop sending branch names and repository URLs in Settings. You can delete
          sessions, projects or your whole account at any time; deleting your account removes your
          data permanently. Read more in{' '}
          <a href="/#privacy" className="text-accent hover:underline">
            how DevPulse handles privacy
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: 'leaderboard',
    title: 'The leaderboard',
    body: (
      <p>
        The leaderboard is opt-in. Your name and coding totals appear on it only after you turn it
        on in Settings, and you can turn it off again at any time.
      </p>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <ul>
        <li>Do not try to access other people&apos;s accounts or data.</li>
        <li>
          Do not send fabricated activity to inflate totals or rankings, or overload the API beyond
          its published rate limits.
        </li>
        <li>Do not use DevPulse to monitor people without their knowledge and consent.</li>
      </ul>
    ),
  },
  {
    id: 'availability',
    title: 'Availability and changes',
    body: (
      <p>
        DevPulse is provided as is. We work to keep it available and accurate but cannot guarantee
        uninterrupted service. We may change features or these terms; material changes will be
        announced in the app before they take effect.
      </p>
    ),
  },
  {
    id: 'ending',
    title: 'Ending your use',
    body: (
      <p>
        You can stop using DevPulse and delete your account from Settings at any time. Accounts that
        break these terms may be suspended.
      </p>
    ),
  },
];

export function TermsPage() {
  return (
    <div className="min-h-dvh">
      <LandingHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="text-sm text-ink-muted">Last updated {LAST_UPDATED}</p>
        <h1 className="mt-2 text-4xl font-semibold">Terms of service</h1>
        <p className="mt-4 text-lg text-ink-muted">
          These terms cover your use of DevPulse. They are short on purpose: by creating an account
          you agree to them.
        </p>

        <nav aria-label="On this page" className="mt-10 rounded-panel border border-line p-5">
          <p className="text-sm font-medium">On this page</p>
          <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
            {SECTIONS.map((section, index) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-ink-muted hover:text-ink">
                  {index + 1}. {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 flex flex-col gap-10">
          {SECTIONS.map((section, index) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-xl font-semibold">
                {index + 1}. {section.title}
              </h2>
              <div className="mt-3 flex flex-col gap-3 leading-relaxed text-ink-muted [&_li]:pl-1 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5">
                {section.body}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-14 border-t border-line pt-6 text-sm text-ink-muted">
          Questions about these terms?{' '}
          <a
            href={ISSUES_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent hover:underline"
          >
            Contact us
          </a>
          .
        </p>
      </main>
      <LandingFooter />
    </div>
  );
}
