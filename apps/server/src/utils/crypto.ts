import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** URL-safe random token with `bytes` of entropy. */
export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

/** Keyed hash for secrets that must be looked up by value (refresh tokens, pairing keys). */
export function hmacSha256(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Uniformly random string drawn from `alphabet` (no modulo bias). */
export function randomFromAlphabet(length: number, alphabet: string) {
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += alphabet[randomInt(alphabet.length)];
  }
  return output;
}
