import { adminDb } from './_lib/firebaseAdmin';
import { errorResponse, json, preflight } from './_lib/http';
import { withAuth } from './_lib/withAuth';

export const OPTIONS = preflight;

/** GET ?savedProductId= → verified price observations for the caller's own saved product. */
export const GET = withAuth(async (request, user) => {
  const savedProductId = new URL(request.url).searchParams.get('savedProductId');
  if (!savedProductId || savedProductId.length > 128 || savedProductId.includes('/')) {
    return errorResponse(400, 'bad_request', 'Missing savedProductId');
  }
  const ref = adminDb()
    .collection('users')
    .doc(user.uid)
    .collection('savedProducts')
    .doc(savedProductId)
    .collection('priceObservations');
  const obs = await ref.orderBy('observedAt', 'asc').limit(200).get();
  const points = obs.docs.map((d) => ({
    observedAt: d.get('observedAt') as string,
    price: d.get('price') as { amountMinor: number; currency: string },
    kind: d.get('kind') as string,
  }));
  return json({ points }, 200, {}, request);
});
