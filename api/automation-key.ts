import { adminDb } from './_lib/firebaseAdmin';
import { json, preflight } from './_lib/http';
import { createKey, keyStatus, revokeKeys } from './_lib/automation';
import { withAuth } from './_lib/withAuth';

export const OPTIONS = preflight;

/** GET → whether a personal automation key exists (never the key itself). */
export const GET = withAuth(async (request, user) => json(await keyStatus(adminDb(), user.uid), 200, {}, request));

/** POST → create (or replace) the key. The plaintext is returned once and never stored. */
export const POST = withAuth(
  async (request, user) => json({ key: await createKey(adminDb(), user.uid) }, 201, {}, request),
  { rate: { bucket: 'automation-key', limit: 10, windowSec: 3600 } },
);

/** DELETE → revoke the key. */
export const DELETE = withAuth(async (request, user) =>
  json({ revoked: await revokeKeys(adminDb(), user.uid) }, 200, {}, request),
);
