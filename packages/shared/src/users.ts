import { z } from 'zod';
import { emailSchema, fullNameSchema, passwordSchema, usernameSchema } from './auth';

export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isValidTimeZone, 'Choose a valid time zone');

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === '' ? null : value))
    .nullable();

export const updateProfileSchema = z
  .object({
    fullName: fullNameSchema,
    bio: optionalText(280, 'Bio must be at most 280 characters'),
    timezone: timezoneSchema,
    avatarUrl: z
      .string()
      .trim()
      .max(2048)
      .refine(
        (value) => value === '' || /^https:\/\/[^\s]+$/i.test(value),
        'Use an https:// image URL',
      )
      .transform((value) => (value === '' ? null : value))
      .nullable(),
  })
  .partial();
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

/** Changing sign-in identifiers requires re-entering the current password. */
export const updateIdentitySchema = z
  .object({
    username: usernameSchema.optional(),
    email: emailSchema.optional(),
    currentPassword: z.string().min(1, 'Enter your current password').max(128),
  })
  .refine((data) => data.username !== undefined || data.email !== undefined, {
    message: 'Provide a new username or email',
    path: ['username'],
  });
export type UpdateIdentityInput = z.input<typeof updateIdentitySchema>;

export const updateSettingsSchema = z
  .object({
    theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']),
    weekStartsOn: z.union([z.literal(0), z.literal(1)]),
    idleTimeoutMinutes: z.number().int().min(1).max(60),
    trackBranchNames: z.boolean(),
    trackRepositoryUrl: z.boolean(),
    emailNotifications: z.boolean(),
  })
  .partial();
export type UpdateSettingsInput = z.input<typeof updateSettingsSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'Choose a password you are not already using',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password to confirm').max(128),
  confirmation: z.literal('DELETE', { error: 'Type DELETE to confirm' }),
});
export type DeleteAccountInput = z.input<typeof deleteAccountSchema>;
