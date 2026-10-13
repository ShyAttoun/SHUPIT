import { adminDb } from '../_lib/firebaseAdmin';
import { errorResponse, json } from '../_lib/http';
import { configuredProvider, refreshShipment } from '../_lib/tracking/service';

const BATCH = 20;

/**
 * Vercel Cron dispatcher. Authenticated by CRON_SECRET (Vercel sends it as a bearer token).
 * Processes a bounded batch of due, non-terminal shipments each run.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return errorResponse(401, 'unauthorized', 'Invalid cron credentials');
  }
  const provider = configuredProvider();
  if (!provider) return json({ skipped: 'no tracking provider configured' });

  const db = adminDb();
  const now = new Date();
  const due = await db
    .collectionGroup('shipments')
    .where('trackable', '==', true)
    .where('nextCheckAt', '<=', now.toISOString())
    .orderBy('nextCheckAt', 'asc')
    .limit(BATCH)
    .get();

  const counts: Record<string, number> = {};
  for (const doc of due.docs) {
    const uid = doc.ref.parent.parent?.id;
    if (!uid) continue;
    try {
      const outcome = await refreshShipment(db, uid, doc.id, provider, { now });
      counts[outcome] = (counts[outcome] ?? 0) + 1;
    } catch (e) {
      counts.error = (counts.error ?? 0) + 1;
      console.error('refresh_error', e instanceof Error ? e.name : 'unknown');
    }
  }
  return json({ due: due.size, ...counts });
}
