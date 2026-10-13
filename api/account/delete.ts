import { adminAuth, adminDb } from '../_lib/firebaseAdmin';
import { deleteAccountData } from '../_lib/account';
import { errorResponse, json, preflight } from '../_lib/http';
import { SENSITIVE_RULE } from '../_lib/rateLimit';
import { withAuth } from '../_lib/withAuth';

export const OPTIONS = preflight;

/** A destructive action requires a login from the last 5 minutes. */
const MAX_AUTH_AGE_SEC = 5 * 60;

/** POST → permanently deletes the caller's account and data. */
export const POST = withAuth(
  async (request, user) => {
    const authTime = typeof user.auth_time === 'number' ? user.auth_time : 0;
    if (Date.now() / 1000 - authTime > MAX_AUTH_AGE_SEC) {
      return errorResponse(401, 'recent_login_required', 'Please sign in again to delete your account');
    }
    const summary = await deleteAccountData(adminDb(), adminAuth(), user.uid);
    return json({ ok: true, summary }, 200, {}, request);
  },
  { rate: SENSITIVE_RULE },
);
