import { extractRequest } from '@shupit/contracts';
import { adminDb } from './_lib/firebaseAdmin';
import { errorResponse, json, preflight, readJson } from './_lib/http';
import { statusUpdateFrom } from './_lib/statusUpdate';
import { consumeAiQuota } from './_lib/usage';
import { ExtractionFailedError, NotConfiguredError, extractOrder } from './_lib/vision';
import { withAuth } from './_lib/withAuth';

export const OPTIONS = preflight;

/**
 * POST ?id=<shipmentId> with { kind:'order', imageBase64, mediaType }
 * Reads the shipment status from a screenshot of a tracking/order page and stores it
 * as a user-supplied snapshot (source 'ai_vision'), never as carrier-verified.
 */
export const POST = withAuth(async (request, user) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id || id.length > 128 || id.includes('/')) return errorResponse(400, 'bad_request', 'Missing id');
  const parsed = extractRequest.safeParse(await readJson(request, 4_400_000));
  if (!parsed.success || !parsed.data.imageBase64 || !parsed.data.mediaType) {
    return errorResponse(400, 'bad_request', 'A screenshot is required');
  }
  if (!process.env.ANTHROPIC_API_KEY) return errorResponse(503, 'not_configured', 'AI extraction is not configured yet');

  const db = adminDb();
  const ref = db.collection('users').doc(user.uid).collection('shipments').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return errorResponse(404, 'not_found', 'Shipment not found');

  if (!(await consumeAiQuota(user.uid))) return errorResponse(429, 'quota_exceeded', 'Daily extraction limit reached');

  try {
    const data = await extractOrder({
      image: { base64: parsed.data.imageBase64, mediaType: parsed.data.mediaType },
    });
    if (!data.isOrderScreenshot) return errorResponse(422, 'not_an_order', 'No order found');
    const update = statusUpdateFrom(data, snap.get('trackingNumber') as string | null);
    if (!update) return errorResponse(422, 'no_status', 'No status visible');

    const now = new Date().toISOString();
    const terminal = update.status === 'delivered' || update.status === 'returned';
    await ref.update({
      status: update.status,
      statusSource: 'ai_vision',
      statusAsOf: now,
      ...(update.estimatedDeliveryAt
        ? { estimatedDeliveryAt: update.estimatedDeliveryAt, estimatedDeliverySource: 'user' }
        : {}),
      ...(terminal ? { trackable: false, nextCheckAt: null } : {}),
    });
    return json({ status: update.status, estimatedDeliveryAt: update.estimatedDeliveryAt ?? null }, 200, {}, request);
  } catch (e) {
    if (e instanceof NotConfiguredError) return errorResponse(503, 'not_configured', 'AI extraction is not configured yet');
    if (e instanceof ExtractionFailedError) return errorResponse(422, 'extraction_failed', 'Could not read this');
    throw e;
  }
});
