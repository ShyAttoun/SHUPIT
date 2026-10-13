import { z } from 'zod';
import { getConsents, setConsent } from '../_lib/consent';
import { adminDb } from '../_lib/firebaseAdmin';
import { errorResponse, json, preflight, readJson } from '../_lib/http';
import { withAuth } from '../_lib/withAuth';

export const OPTIONS = preflight;

/** GET → which consents are active for the current policy version. */
export const GET = withAuth(async (request, user) =>
  json(await getConsents(adminDb(), user.uid), 200, {}, request),
);

const body = z
  .object({ aiProcessing: z.boolean().optional(), terms: z.boolean().optional() })
  .refine((v) => v.aiProcessing !== undefined || v.terms !== undefined);

/** POST { aiProcessing?, terms? } → grant (true) or withdraw (false) a consent. */
export const POST = withAuth(async (request, user) => {
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(400, 'bad_request', 'Invalid consent');
  const db = adminDb();
  if (parsed.data.aiProcessing !== undefined) await setConsent(db, user.uid, 'aiProcessing', parsed.data.aiProcessing);
  if (parsed.data.terms !== undefined) await setConsent(db, user.uid, 'terms', parsed.data.terms);
  return json(await getConsents(db, user.uid), 200, {}, request);
});
