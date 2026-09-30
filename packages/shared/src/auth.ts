import { z } from 'zod';

export const RESERVED_USERNAMES = [
  'admin',
  'administrator',
  'api',
  'app',
  'auth',
  'dashboard',
  'devpulse',
  'help',
  'login',
  'logout',
  'me',
  'register',
  'root',
  'settings',
  'support',
  'system',
] as const;

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email address')
  .max(254, 'Email address is too long')
  .pipe(z.email('Enter a valid email address'))
  .transform((value) => value.toLowerCase());

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(32, 'Username must be at most 32 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Use only letters, numbers, hyphens and underscores')
  .transform((value) => value.toLowerCase())
  .refine(
    (value) => !(RESERVED_USERNAMES as readonly string[]).includes(value),
    'This username is not available',
  );

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter your name')
  .max(80, 'Name must be at most 80 characters');

export const PASSWORD_MIN_LENGTH = 10;

/** Length-first policy (NIST 800-63B) with a light composition check. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128, 'Password must be at most 128 characters')
  .refine(
    (value) => /[A-Za-z]/.test(value) && /[^A-Za-z]/.test(value),
    'Include at least one letter and one number or symbol',
  );

export const registerSchema = z
  .object({
    fullName: fullNameSchema,
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or username').max(254),
  password: z.string().min(1, 'Enter your password').max(128),
});
export type LoginInput = z.input<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20, 'This reset link is invalid').max(200),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

export type ThemePreferenceDto = 'LIGHT' | 'DARK' | 'SYSTEM';

export interface UserSettingsDto {
  theme: ThemePreferenceDto;
  weekStartsOn: number;
  idleTimeoutMinutes: number;
  trackBranchNames: boolean;
  trackRepositoryUrl: boolean;
  emailNotifications: boolean;
}

export interface UserDto {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  timezone: string;
  isDemo: boolean;
  createdAt: string;
  settings: UserSettingsDto;
}

export interface AuthResponse {
  user: UserDto;
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

export interface AuthSessionDto {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}
