import { ShieldCheck } from 'lucide-react';
import { Field, Select } from '@/components/ui/Field';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { Switch } from '@/components/ui/Switch';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useUpdateSettings } from '@/features/settings/useUpdateSettings';

const IDLE_OPTIONS = [1, 3, 5, 10, 15, 30];

/** Preferences the extension applies; the server also enforces the privacy toggles. */
export function TrackingPrivacyPanel() {
  const { settings } = useCurrentUser();
  const update = useUpdateSettings({ successMessage: 'Tracking preferences saved' });

  return (
    <Panel>
      <PanelHeader
        title="Tracking and privacy"
        description="Controls what connected editors record."
      />
      <PanelBody className="grid gap-5">
        <Field
          label="Idle timeout"
          hint="After this long without typing or navigating, time stops counting as active."
        >
          <Select
            value={settings.idleTimeoutMinutes}
            onChange={(event) => update.mutate({ idleTimeoutMinutes: Number(event.target.value) })}
            className="sm:w-48"
          >
            {IDLE_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} {minutes === 1 ? 'minute' : 'minutes'}
              </option>
            ))}
          </Select>
        </Field>
        <Switch
          checked={settings.trackBranchNames}
          onCheckedChange={(checked) => update.mutate({ trackBranchNames: checked })}
          label="Record git branch names"
          description="Branch names can reveal client or feature names. When off, they are discarded before storage."
        />
        <Switch
          checked={settings.trackRepositoryUrl}
          onCheckedChange={(checked) => update.mutate({ trackRepositoryUrl: checked })}
          label="Record repository URLs"
          description="Used to match workspaces to projects. When off, projects are matched by folder name only."
        />
        <p className="flex gap-2.5 rounded-control bg-success-soft px-3.5 py-3 text-sm text-success">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          DevPulse never collects source code, file contents, secrets or environment values. Editors
          send durations, timestamps, languages and project names only.
        </p>
      </PanelBody>
    </Panel>
  );
}
