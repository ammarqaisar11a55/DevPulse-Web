import { z } from 'zod';

/** Characters used in pairing keys: no 0/O, 1/I/L to avoid transcription mistakes. */
export const PAIRING_KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const PAIRING_KEY_GROUPS = 3;
export const PAIRING_KEY_GROUP_LENGTH = 4;
/** Prefix of device credentials, useful for secret scanning. */
export const DEVICE_CREDENTIAL_PREFIX = 'dpd_';

/**
 * Normalises user-typed pairing keys: case-insensitive, spaces and dashes ignored,
 * with or without the "DP" prefix. Returns the canonical DP-XXXX-XXXX-XXXX form or null.
 */
export function normalizePairingKey(input: string): string | null {
  let compact = input.toUpperCase().replace(/[\s-]/g, '');
  if (compact.startsWith('DP')) compact = compact.slice(2);
  const length = PAIRING_KEY_GROUPS * PAIRING_KEY_GROUP_LENGTH;
  if (compact.length !== length) return null;
  for (const char of compact) if (!PAIRING_KEY_ALPHABET.includes(char)) return null;
  const groups = compact.match(new RegExp(`.{${PAIRING_KEY_GROUP_LENGTH}}`, 'g')) ?? [];
  return `DP-${groups.join('-')}`;
}

const optionalText = (max: number) => z.string().trim().min(1).max(max).optional();

export const pairDeviceSchema = z.object({
  key: z.string().trim().min(1, 'Enter the connection key').max(40),
  device: z.object({
    /** A human label such as "Ubuntu Laptop". */
    name: z.string().trim().min(1).max(60),
    platform: z.enum(['linux', 'darwin', 'win32', 'other']).optional(),
    /** Optional; not displayed unless the user chooses to. */
    hostname: optionalText(100),
    editor: optionalText(40),
    editorVersion: optionalText(40),
    extensionVersion: optionalText(40),
  }),
});
export type PairDeviceInput = z.input<typeof pairDeviceSchema>;

export type PairingKeyStatus = 'active' | 'used' | 'expired' | 'revoked';

export interface PairingKeyDto {
  id: string;
  /** Last four characters only; the full key is never retrievable after creation. */
  hint: string;
  status: PairingKeyStatus;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
  device: { id: string; name: string } | null;
}

/** Returned once, at creation. */
export interface CreatedPairingKeyDto extends PairingKeyDto {
  key: string;
}

/** Tracking preferences the extension must honour. */
export interface ExtensionConfigDto {
  idleTimeoutMinutes: number;
  trackBranchNames: boolean;
  trackRepositoryUrl: boolean;
  /** Recommended heartbeat interval for active sessions. */
  heartbeatIntervalSeconds: number;
}

export interface PairDeviceResponse {
  /** Long-lived device credential. Shown once; store it in the editor's secret storage. */
  credential: string;
  device: { id: string; name: string };
  account: { username: string; fullName: string };
  config: ExtensionConfigDto;
}
