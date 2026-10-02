import type {
  ChangePasswordInput,
  DeleteAccountInput,
  PendingEmailChangeDto,
  UpdateIdentityInput,
  UpdateProfileInput,
  UpdateSettingsInput,
  UserDto,
} from '@devpulse/shared';
import { api, apiRequest } from '@/lib/api-client';

export const emailChangeKey = ['users', 'email-change'] as const;

export const settingsApi = {
  me: () => api.get<UserDto>('/users/me'),
  updateProfile: (input: UpdateProfileInput) => api.patch<UserDto>('/users/me', input),
  updateIdentity: (input: UpdateIdentityInput) => api.patch<UserDto>('/users/me/identity', input),
  updateSettings: (input: UpdateSettingsInput) => api.patch<UserDto>('/users/me/settings', input),
  changePassword: (input: ChangePasswordInput) =>
    apiRequest<void>('/users/me/password', { method: 'POST', body: input }),
  pendingEmailChange: (signal?: AbortSignal) =>
    api.get<PendingEmailChangeDto | null>('/users/me/email-change', { signal }),
  cancelEmailChange: () => apiRequest<void>('/users/me/email-change', { method: 'DELETE' }),
  /** Public: the token from the emailed link is the only credential needed. */
  confirmEmailChange: (token: string) =>
    api.post<{ email: string }>('/users/email-change/confirm', { token }),
  deleteAccount: (input: DeleteAccountInput) =>
    apiRequest<void>('/users/me', { method: 'DELETE', body: input }),
};
