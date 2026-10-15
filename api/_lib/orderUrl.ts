import { merchantForUrl } from '@shupit/contracts';

const SECRET = /[?&](token|session|sess|auth|password|pwd|key|sig|signature|code|otp|access_token)=/i;

/**
 * The page a user imported an order from, kept so the app can reopen it. Only https pages of the
 * order's own store, without credentials, tokens or fragments. Anything else is dropped.
 */
export function sanitizeOrderUrl(raw: string | undefined | null, merchantId: string | null | undefined): string | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  u.hash = '';
  const out = u.toString();
  if (out.length > 2048 || SECRET.test(out)) return null;
  if (merchantId) {
    const m = merchantForUrl(out);
    if (!m || m.id !== merchantId) return null;
  }
  return out;
}
