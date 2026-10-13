import { adminDb } from './_lib/firebaseAdmin';
import { errorResponse, json, preflight } from './_lib/http';
import { withAuth } from './_lib/withAuth';

export const OPTIONS = preflight;

/**
 * GET ?savedProductId= → verified observations for the caller's own watch.
 * Observations are server-only data; returns [] when nothing is monitored.
 */
export const GET = withAuth(async (request, user) => {
  const savedProductId = new URL(request.url).searchParams.get('savedProductId');
  if (!savedProductId || savedProductId.length > 128 || savedProductId.includes('/')) {
    return errorResponse(400, 'bad_request', 'Missing savedProductId');
  }
  const db = adminDb();
  const subs = await db
    .collection('priceWatchSubscriptions')
    .where('uid', '==', user.uid)
    .where('savedProductId', '==', savedProductId)
    .limit(1)
    .get();
  const variantId = subs.docs[0]?.get('variantId') as string | undefined;
  if (!variantId) return json({ points: [] }, 200, {}, request);

  const obs = await db
    .collection('priceObservations')
    .where('variantId', '==', variantId)
    .orderBy('observedAt', 'asc')
    .limit(200)
    .get();
  const points = obs.docs.map((d) => ({
    observedAt: d.get('observedAt') as string,
    price: d.get('price') as { amountMinor: number; currency: string },
    kind: d.get('kind') as string,
  }));
  return json({ points }, 200, {}, request);
});
