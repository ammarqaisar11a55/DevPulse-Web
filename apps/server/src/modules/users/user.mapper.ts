import type { UserDto } from '@devpulse/shared';
import type { User, UserSetting } from '@prisma/client';

export const DEFAULT_SETTINGS = {
  theme: 'SYSTEM',
  weekStartsOn: 1,
  idleTimeoutMinutes: 5,
  trackBranchNames: true,
  trackRepositoryUrl: true,
  emailNotifications: true,
  showOnLeaderboard: false,
} as const;

export type UserWithSettings = User & { settings: UserSetting | null };

/** Public representation of a user. Never includes credentials or internal flags. */
export function toUserDto(user: UserWithSettings): UserDto {
  const settings = user.settings ?? DEFAULT_SETTINGS;
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    timezone: user.timezone,
    isDemo: user.isDemo,
    createdAt: user.createdAt.toISOString(),
    settings: {
      theme: settings.theme,
      weekStartsOn: settings.weekStartsOn,
      idleTimeoutMinutes: settings.idleTimeoutMinutes,
      trackBranchNames: settings.trackBranchNames,
      trackRepositoryUrl: settings.trackRepositoryUrl,
      emailNotifications: settings.emailNotifications,
      showOnLeaderboard: settings.showOnLeaderboard,
    },
  };
}
