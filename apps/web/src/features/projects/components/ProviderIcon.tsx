import type { RepositoryProvider } from '@devpulse/shared';
import { GitBranch } from 'lucide-react';

import { providerLabel } from '../provider-label';

/** Generic repository glyph with the provider name as its accessible label. */
export function ProviderIcon({ provider }: { provider: RepositoryProvider | null }) {
  if (!provider) return null;
  return <GitBranch className="size-3.5" aria-label={providerLabel(provider) ?? 'Repository'} />;
}
