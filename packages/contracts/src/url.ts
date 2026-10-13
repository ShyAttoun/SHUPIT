const TRACKING_PARAMS = new Set([
  'fbclid', 'gclid', 'dclid', 'msclkid', 'igshid', 'mc_cid', 'mc_eid', 'ref', 'ref_',
  'referrer', 'source', 'cmpid', 'campaign', 'affid', 'aff_id', 'spm', 'scm', 'gad_source',
]);

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Lowercased hostname without leading "www.", or null if not a valid http(s) URL. */
export function hostOf(value: string): string | null {
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Stable key for duplicate detection: host + path + meaningful query params,
 * with tracking params, hash and trailing slash removed.
 */
export function normalizeProductUrl(value: string): string | null {
  const host = hostOf(value);
  if (!host) return null;
  const u = new URL(value);
  const params = [...u.searchParams.entries()]
    .filter(([k]) => !k.toLowerCase().startsWith('utm_') && !TRACKING_PARAMS.has(k.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));
  const path = u.pathname.replace(/\/+$/, '') || '';
  const qs = params.map(([k, v]) => `${k}=${v}`).join('&');
  return `${host}${path}${qs ? `?${qs}` : ''}`;
}
