import type { CreatedPairingKeyDto, PairingKeyDto } from '@devpulse/shared';
import { api } from '@/lib/api-client';

export const integrationKeys = {
  pairingKeys: ['integrations', 'pairing-keys'] as const,
};

export const integrationsApi = {
  createKey: () => api.post<CreatedPairingKeyDto>('/integrations/pairing-keys'),
  listKeys: (signal?: AbortSignal) =>
    api.get<PairingKeyDto[]>('/integrations/pairing-keys', { signal }),
  revokeKey: (id: string) => api.delete(`/integrations/pairing-keys/${id}`),
};
