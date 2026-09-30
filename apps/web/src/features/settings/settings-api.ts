import type {
  ChangePasswordInput,
  DeleteAccountInput,
  UpdateIdentityInput,
  UpdateProfileInput,
  UpdateSettingsInput,
  UserDto,
} from '@devpulse/shared';
import { api, apiRequest } from '@/lib/api-client';

export const settingsApi = {
  me: () => api.get<UserDto>('/users/me'),
  updateProfile: (input: UpdateProfileInput) => api.patch<UserDto>('/users/me', input),
  updateIdentity: (input: UpdateIdentityInput) => api.patch<UserDto>('/users/me/identity', input),
  updateSettings: (input: UpdateSettingsInput) => api.patch<UserDto>('/users/me/settings', input),
  changePassword: (input: ChangePasswordInput) =>
    apiRequest<void>('/users/me/password', { method: 'POST', body: input }),
  deleteAccount: (input: DeleteAccountInput) =>
    apiRequest<void>('/users/me', { method: 'DELETE', body: input }),
};
