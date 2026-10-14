import { z } from 'zod';
import { adminDb } from './_lib/firebaseAdmin';
import { errorResponse, json, preflight, readJson } from './_lib/http';
import { geocodeAddress } from './_lib/geocode';
import { withAuth } from './_lib/withAuth';

export const OPTIONS = preflight;

const body = z.object({ shipmentId: z.string().min(1).max(128) });

/**
 * POST { shipmentId } → coordinates of that shipment's pickup address (cached, stored on the
 * shipment). The address is read server-side from the caller's own shipment, never from the request.
 */
export const POST = withAuth(
  async (request, user) => {
    const parsed = body.safeParse(await readJson(request));
    if (!parsed.success || parsed.data.shipmentId.includes('/')) {
      return errorResponse(400, 'validation', 'Invalid request');
    }
    const db = adminDb();
    const ref = db.collection('users').doc(user.uid).collection('shipments').doc(parsed.data.shipmentId);
    const snap = await ref.get();
    if (!snap.exists) return errorResponse(404, 'not_found', 'Shipment not found');

    const pickup = snap.get('pickup') as { address?: string; lat?: number; lng?: number } | null;
    if (!pickup?.address) return json({ located: false, reason: 'no_address' }, 200, {}, request);
    if (typeof pickup.lat === 'number' && typeof pickup.lng === 'number') {
      return json({ located: true, lat: pickup.lat, lng: pickup.lng }, 200, {}, request);
    }

    const coords = await geocodeAddress(db, pickup.address);
    if (!coords) return json({ located: false, reason: 'not_found' }, 200, {}, request);

    await ref.update({
      'pickup.lat': coords.lat,
      'pickup.lng': coords.lng,
      'pickup.geocodedAt': new Date().toISOString(),
    });
    return json({ located: true, ...coords }, 200, {}, request);
  },
  { rate: { bucket: 'geocode', limit: 30, windowSec: 60 } },
);
