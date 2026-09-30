import type { DeviceDto, UpdateDeviceInput } from '@devpulse/shared';
import { api } from '@/lib/api-client';

export const devicesKey = ['devices'] as const;

export const devicesApi = {
  list: (signal?: AbortSignal) => api.get<DeviceDto[]>('/devices', { signal }),
  rename: (id: string, input: UpdateDeviceInput) => api.patch<DeviceDto>(`/devices/${id}`, input),
  revoke: (id: string) => api.delete(`/devices/${id}`),
};

const PLATFORMS: Record<string, string> = { linux: 'Linux', darwin: 'macOS', win32: 'Windows' };

export function platformName(platform: string | null) {
  return platform ? (PLATFORMS[platform] ?? 'Other') : 'Unknown platform';
}

/** A device is shown as online if it reported within the last few minutes. */
export function isOnline(lastSeenAt: string | null, now = Date.now()) {
  return lastSeenAt !== null && now - new Date(lastSeenAt).getTime() < 5 * 60_000;
}
