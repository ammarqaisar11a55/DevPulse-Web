import { useQuery } from '@tanstack/react-query';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { devicesApi, devicesKey } from '@/features/devices/devices-api';
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
  const devices = useQuery({
    queryKey: devicesKey,
    queryFn: ({ signal }) => devicesApi.list(signal),
  });
  const connectedCount = devices.data?.filter((device) => !device.revokedAt).length ?? 0;

  return (
    <>
      <ConnectEditorPanel connectedCount={connectedCount} />
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
