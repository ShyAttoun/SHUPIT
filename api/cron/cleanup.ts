import { adminDb } from '../_lib/firebaseAdmin';
import { errorResponse, json } from '../_lib/http';

const LIMIT = 400;
const DAY = 86_400_000;

export const RETENTION_DAYS = {
  affiliateClicks: 90,
  usageCounters: 35,
  readNotifications: 180,
  errorReports: 30,
  systemCounters: 35,
} as const;

/** Deletes up to LIMIT docs matching a query; returns how many. */
async function purge(query: FirebaseFirestore.Query, filter?: (d: FirebaseFirestore.QueryDocumentSnapshot) => boolean) {
  const snap = await query.limit(LIMIT).get();
  const docs = filter ? snap.docs.filter(filter) : snap.docs;
  if (docs.length === 0) return 0;
  const batch = adminDb().batch();
  docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return docs.length;
}

/**
 * Daily retention job (Vercel Cron, authenticated by CRON_SECRET). Bounded per run;
 * repeated runs converge. Policy documented in docs/PRIVACY-RETENTION.md.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return errorResponse(401, 'unauthorized', 'Invalid cron credentials');
  }
  const db = adminDb();
  const now = Date.now();
  const iso = (days: number) => new Date(now - days * DAY).toISOString();

  const result: Record<string, number> = {};
  result.rateLimits = await purge(db.collection('rateLimits').where('expireAt', '<', new Date(now).toISOString()));
  result.affiliateClicks = await purge(
    db.collection('affiliateClicks').where('createdAt', '<', iso(RETENTION_DAYS.affiliateClicks)),
  );
  result.usageCounters = await purge(
    db.collectionGroup('usage').where('updatedAt', '<', iso(RETENTION_DAYS.usageCounters)),
  );
  result.readNotifications = await purge(
    db.collectionGroup('notifications').where('createdAt', '<', iso(RETENTION_DAYS.readNotifications)),
    (d) => !!d.get('readAt'),
  );
  result.errorReports = await purge(
    db.collection('errorReports').where('createdAt', '<', iso(RETENTION_DAYS.errorReports)),
  );
  result.systemCounters = await purge(
    db.collection('system').where('updatedAt', '<', iso(RETENTION_DAYS.systemCounters)),
  );
  return json(result);
}
