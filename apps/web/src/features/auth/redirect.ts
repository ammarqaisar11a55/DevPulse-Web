/** Only allows same-app relative redirects, preventing open redirects via ?next=. */
export function safeNextPath(next: string | null) {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\'))
    return '/dashboard';
  return next;
}
