import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useCurrentUser } from '@/features/auth/auth-context';
import { ThemePicker } from '@/features/theme/ThemeToggle';
import { useUpdateSettings } from '../useUpdateSettings';

export function AppearanceSettingsPage() {
  const user = useCurrentUser();
  const update = useUpdateSettings({ successMessage: 'Week start saved' });
  const weekStartsOn = String(update.variables?.weekStartsOn ?? user.settings.weekStartsOn) as
    '0' | '1';

  return (
    <>
      <Panel>
        <PanelHeader
          title="Theme"
          description="Choose how DevPulse looks. System follows your operating system setting."
        />
        <PanelBody className="flex flex-col items-start gap-5">
          <ThemePicker />
          <div className="grid w-full grid-cols-2 gap-3 sm:max-w-md" aria-hidden>
            <ThemePreviewCard mode="light" />
            <ThemePreviewCard mode="dark" />
          </div>
          <p className="text-sm text-ink-muted">
            Your choice is saved to your account and applies in every browser you sign in to.
          </p>
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader
          title="Calendar"
          description="Weekly totals, charts and weekly goals start on this day."
        />
        <PanelBody>
          <SegmentedControl
            label="First day of the week"
            value={weekStartsOn}
            onChange={(value) => update.mutate({ weekStartsOn: Number(value) as 0 | 1 })}
            options={[
              { value: '1', label: 'Monday' },
              { value: '0', label: 'Sunday' },
            ]}
          />
        </PanelBody>
      </Panel>
    </>
  );
}

/** Miniature, theme-independent rendering of each theme for comparison. */
function ThemePreviewCard({ mode }: { mode: 'light' | 'dark' }) {
  return (
    <div
      className={`${mode === 'dark' ? 'dark' : 'light-preview'} overflow-hidden rounded-control border border-line`}
    >
      <div className="flex h-20 bg-canvas" style={mode === 'light' ? lightVars : undefined}>
        <div className="w-5 border-r border-line bg-surface" />
        <div className="flex flex-1 flex-col gap-1.5 p-2">
          <div className="h-1.5 w-10 rounded bg-ink/70" />
          <div className="flex flex-1 items-center rounded border border-line bg-surface px-1.5">
            <div className="h-2 w-full rounded-sm bg-pulse-0">
              <div className="ml-[20%] h-full w-[35%] rounded-sm bg-pulse-4" />
            </div>
          </div>
        </div>
      </div>
      <p
        className="bg-surface-2 px-2 py-1 text-xs text-ink-muted capitalize"
        style={mode === 'light' ? lightVars : undefined}
      >
        {mode}
      </p>
    </div>
  );
}

// Light preview must render light even when the app is in dark mode.
const lightVars = {
  '--canvas': '#f2f4f7',
  '--surface': '#ffffff',
  '--surface-2': '#f6f7f9',
  '--line': '#dde2ea',
  '--ink': '#121a26',
  '--ink-muted': '#586476',
  '--pulse-0': '#e6e9ef',
  '--pulse-4': '#2445d6',
} as React.CSSProperties;
