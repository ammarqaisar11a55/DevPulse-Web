import type { PairingKeyDto } from '@devpulse/shared';
import { Badge } from '@/components/ui/Badge';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { formatRelative } from '@/lib/format';

const STATUS: Record<
  PairingKeyDto['status'],
  { label: string; tone: 'success' | 'accent' | 'neutral' | 'danger' }
> = {
  active: { label: 'Active', tone: 'accent' },
  used: { label: 'Used', tone: 'success' },
  expired: { label: 'Expired', tone: 'neutral' },
  revoked: { label: 'Revoked', tone: 'danger' },
};

export function KeyHistoryPanel({ keys }: { keys: PairingKeyDto[] }) {
  if (keys.length === 0) return null;
  return (
    <Panel>
      <PanelHeader
        title="Recent connection keys"
        description="Keys are listed by their last four characters."
      />
      <PanelBody className="pt-3">
        <ul className="divide-y divide-line text-sm">
          {keys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="flex items-center gap-3">
                <code className="font-mono text-ink-muted">DP-····-····-{key.hint}</code>
                <Badge tone={STATUS[key.status].tone}>{STATUS[key.status].label}</Badge>
              </span>
              <span className="text-ink-muted">
                {key.device
                  ? `Paired ${key.device.name}`
                  : `Created ${formatRelative(key.createdAt).toLowerCase()}`}
              </span>
            </li>
          ))}
        </ul>
      </PanelBody>
    </Panel>
  );
}
