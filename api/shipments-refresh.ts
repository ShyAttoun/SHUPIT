import { adminDb } from './_lib/firebaseAdmin';
import { errorResponse, json, preflight } from './_lib/http';
import { configuredProvider, refreshShipment } from './_lib/tracking/service';
import { withAuth } from './_lib/withAuth';

export const OPTIONS = preflight;

const MIN_MANUAL_INTERVAL_MS = 5 * 60_000;

/** POST ?id=<shipmentId> → on-demand refresh for the caller's own shipment (rate limited per shipment). */
export const POST = withAuth(async (request, user) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id || id.length > 128 || id.includes('/')) return errorResponse(400, 'bad_request', 'Missing id');
  const provider = configuredProvider();
  if (!provider) return json({ outcome: 'not_configured' }, 200, {}, request);

  const db = adminDb();
  const ref = db.collection('users').doc(user.uid).collection('shipments').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return errorResponse(404, 'not_found', 'Shipment not found');

  const last = snap.get('lastCheckedAt') as string | undefined;
  if (last && Date.now() - Date.parse(last) < MIN_MANUAL_INTERVAL_MS) {
    return json({ outcome: 'too_soon' }, 200, {}, request);
  }
  const outcome = await refreshShipment(db, user.uid, id, provider, { force: true });
  return json({ outcome }, 200, {}, request);
});
