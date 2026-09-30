import { prisma } from '../../database/prisma';

interface TrackedFields {
  branch?: string | null;
  repository?: string | null;
  project?: { name: string; repositoryUrl?: string | null };
}

/**
 * Enforces the user's tracking preferences on data sent by an editor, regardless of what the
 * client sends: disabled fields are dropped before anything is stored.
 */
export async function applyTrackingPreferences<T extends TrackedFields>(
  userId: string,
  input: T,
): Promise<T> {
  const settings = await prisma.userSetting.findUnique({
    where: { userId },
    select: { trackBranchNames: true, trackRepositoryUrl: true },
  });
  const result = { ...input };
  if (settings && !settings.trackBranchNames && 'branch' in result) result.branch = null;
  if (settings && !settings.trackRepositoryUrl) {
    if ('repository' in result) result.repository = null;
    if (result.project) result.project = { name: result.project.name };
  }
  return result;
}
