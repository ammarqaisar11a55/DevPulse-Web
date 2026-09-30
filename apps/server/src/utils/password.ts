import argon2 from 'argon2';

// OWASP-recommended Argon2id parameters (19 MiB, 2 iterations, 1 lane).
const OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string) {
  return argon2.hash(password, OPTIONS);
}

export async function verifyPassword(hash: string, password: string) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/**
 * Burns the same amount of time as a real verification so response timing does not
 * reveal whether an account exists.
 */
export async function verifyAgainstDummy(password: string) {
  dummyHash ??= hashPassword('devpulse-timing-equaliser');
  await verifyPassword(await dummyHash, password);
  return false;
}
