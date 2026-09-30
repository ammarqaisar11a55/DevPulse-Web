import { useQuery } from '@tanstack/react-query';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { ConnectEditorPanel } from './components/ConnectEditorPanel';
import { KeyHistoryPanel } from './components/KeyHistoryPanel';
import { TrackingPrivacyPanel } from './components/TrackingPrivacyPanel';
import { integrationKeys, integrationsApi } from './integrations-api';

export function IntegrationsSettingsPage() {
  const keys = useQuery({
    queryKey: integrationKeys.pairingKeys,
    queryFn: ({ signal }) => integrationsApi.listKeys(signal),
  });
  const pairedCount = keys.data?.filter((key) => key.device).length ?? 0;

  return (
    <>
      <ConnectEditorPanel connectedCount={pairedCount} />
      <TrackingPrivacyPanel />
      {keys.isPending ? (
        <SkeletonRows rows={2} />
      ) : keys.isError ? (
        <ErrorState error={keys.error} onRetry={() => void keys.refetch()} />
      ) : (
        <KeyHistoryPanel keys={keys.data} />
      )}
    </>
  );
}
