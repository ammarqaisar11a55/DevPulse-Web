import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreatedPairingKeyDto } from '@devpulse/shared';
import { Check, Copy, KeyRound, RefreshCw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { GitHubMark } from '@/components/GitHubMark';
import { Button } from '@/components/ui/Button';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { EXTENSION_DOWNLOAD_URL, EXTENSION_REPOSITORY_URL } from '@/features/landing/links';
import { getErrorMessage } from '@/lib/api-client';
import { integrationKeys, integrationsApi } from '../integrations-api';
import { formatCountdown, useCountdown } from '../useCountdown';

const STEPS: { key: string; content: ReactNode }[] = [
  {
    key: 'install',
    content: (
      <>
        <a
          href={EXTENSION_DOWNLOAD_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-accent hover:underline"
        >
          Download the DevPulse extension
        </a>{' '}
        (the <code className="font-mono text-xs">.vsix</code> file) and install it in VS Code: open
        Extensions, choose <span className="font-medium">⋯</span> then{' '}
        <span className="font-medium">Install from VSIX…</span>
      </>
    ),
  },
  { key: 'key', content: 'Generate a connection key below.' },
  {
    key: 'connect',
    content: (
      <>
        In VS Code, run <span className="font-medium">DevPulse: Connect Account</span> and enter the
        key.
      </>
    ),
  },
];

function ActiveKey({
  pairingKey,
  onRevoke,
  revoking,
}: {
  pairingKey: CreatedPairingKeyDto;
  onRevoke: () => void;
  revoking: boolean;
}) {
  const remaining = useCountdown(pairingKey.expiresAt);
  const [copied, setCopied] = useState(false);
  const expired = remaining === 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pairingKey.key);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed. Select the key and copy it manually.');
    }
  };

  return (
    <div className="rounded-panel border border-line bg-surface-2 p-5">
      <p className="text-sm text-ink-muted">Connection key</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <code
          aria-label={`Connection key ${pairingKey.key.split('').join(' ')}`}
          className={`font-mono text-2xl font-medium tracking-[0.12em] select-all sm:text-3xl ${expired ? 'text-ink-subtle line-through' : 'text-ink'}`}
        >
          {pairingKey.key}
        </code>
        {!expired && (
          <Button
            variant="secondary"
            size="sm"
            onClick={copy}
            leadingIcon={copied ? <Check /> : <Copy />}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        )}
      </div>
      <p className="mt-3 text-sm text-ink-muted" aria-live="polite">
        {expired ? (
          'This key has expired. Generate a new one to continue.'
        ) : (
          <>
            Works once. Expires in{' '}
            <span className="tabular font-medium text-ink">{formatCountdown(remaining)}</span>.
          </>
        )}
      </p>
      {!expired && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 -ml-3 text-danger"
          loading={revoking}
          onClick={onRevoke}
        >
          Revoke key
        </Button>
      )}
    </div>
  );
}

/** Walks the user through connecting an editor and shows the one-time key. */
export function ConnectEditorPanel({ connectedCount }: { connectedCount: number }) {
  const queryClient = useQueryClient();
  const [created, setCreated] = useState<CreatedPairingKeyDto | null>(null);

  const generate = useMutation({
    mutationFn: integrationsApi.createKey,
    onSuccess: (key) => {
      setCreated(key);
      void queryClient.invalidateQueries({ queryKey: integrationKeys.pairingKeys });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => integrationsApi.revokeKey(id),
    onSuccess: () => {
      setCreated(null);
      toast.success('Connection key revoked');
      void queryClient.invalidateQueries({ queryKey: integrationKeys.pairingKeys });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <Panel>
      <PanelHeader
        title="VS Code"
        description={
          connectedCount === 0
            ? 'Not connected. Connect VS Code to track your development activity automatically.'
            : `Connected on ${connectedCount} ${connectedCount === 1 ? 'device' : 'devices'}. Connect another editor below.`
        }
      />
      <PanelBody className="grid gap-6">
        <ol className="grid gap-3">
          {STEPS.map((step, index) => (
            <li key={step.key} className="flex gap-3 text-sm">
              <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink">
                {index + 1}
              </span>
              <span className="pt-0.5">{step.content}</span>
            </li>
          ))}
        </ol>
        <a
          href={EXTENSION_REPOSITORY_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex w-fit items-center gap-2 text-sm text-ink-muted hover:text-ink"
        >
          <GitHubMark />
          View the extension's source code on GitHub
        </a>

        {created ? (
          <ActiveKey
            pairingKey={created}
            revoking={revoke.isPending}
            onRevoke={() => revoke.mutate(created.id)}
          />
        ) : null}

        <div>
          <Button
            variant={created ? 'secondary' : 'primary'}
            loading={generate.isPending}
            onClick={() => generate.mutate()}
            leadingIcon={created ? <RefreshCw /> : <KeyRound />}
          >
            {created ? 'Generate a new key' : 'Generate connection key'}
          </Button>
          <p className="mt-2 text-xs text-ink-muted">
            Generating a new key cancels any unused key. The key is shown only once.
          </p>
        </div>
      </PanelBody>
    </Panel>
  );
}
