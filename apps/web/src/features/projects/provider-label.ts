import type { RepositoryProvider } from '@devpulse/shared';

const LABELS: Record<RepositoryProvider, string> = {
  GITHUB: 'GitHub',
  GITLAB: 'GitLab',
  BITBUCKET: 'Bitbucket',
  AZURE_DEVOPS: 'Azure DevOps',
  OTHER: 'Git',
};

export function providerLabel(provider: RepositoryProvider | null) {
  return provider ? LABELS[provider] : null;
}
