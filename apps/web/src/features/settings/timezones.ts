/** All IANA time zones supported by the browser, with a small fallback list. */
export function listTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] };
  const zones = intl.supportedValuesOf?.('timeZone') ?? [
    'UTC',
    'Europe/London',
    'America/New_York',
    'Asia/Karachi',
    'Asia/Tokyo',
  ];
  return zones.includes('UTC') ? zones : ['UTC', ...zones];
}

export function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
