import type {
  AuthResponse,
  AuthSessionDto,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@devpulse/shared';
import { api, apiRequest } from '@/lib/api-client';

export const authApi = {
  login: (input: LoginInput) => api.post<AuthResponse>('/auth/login', input, { auth: false }),
  register: (input: RegisterInput) =>
    api.post<AuthResponse>('/auth/register', input, { auth: false }),
  refresh: () => api.post<AuthResponse>('/auth/refresh', undefined, { auth: false }),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST', auth: false }),
  logoutAll: () => apiRequest<void>('/auth/logout-all', { method: 'POST' }),
  forgotPassword: (input: ForgotPasswordInput) =>
    api.post<{ message: string }>('/auth/forgot-password', input, { auth: false }),
  resetPassword: (input: ResetPasswordInput) =>
    apiRequest<void>('/auth/reset-password', { method: 'POST', body: input, auth: false }),
  sessions: () => api.get<AuthSessionDto[]>('/auth/sessions'),
  revokeSession: (id: string) => api.delete(`/auth/sessions/${id}`),
};
