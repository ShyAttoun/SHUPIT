import { captureRequest, extractRequest } from '@shupit/contracts';
import { adminDb } from './_lib/firebaseAdmin';
import { errorResponse, json, preflight, readJson } from './_lib/http';
import { pickupFrom } from './_lib/statusUpdate';
import { consumeAi } from './_lib/usage';
import { aiGateResponse } from './_lib/aiGate';
import { ExtractionFailedError, NotConfiguredError, extractOrders } from './_lib/vision';
import { withAuth } from './_lib/withAuth';
import { AI_RULE } from './_lib/rateLimit';
import { hasAiConsent } from './_lib/consent';

export const OPTIONS = preflight;

/**
 * POST ?id=<shipmentId> with { kind:'order', imageBase64, mediaType } or { kind:'order', text }
 * Reads pickup-point details (name, address, deadline, collection code) from a pasted SMS/message or a
 * screenshot, and stores them on the shipment. The shipment status is never changed here.
 */
export const POST = withAuth(
  async (request, user) => {
    const id = new URL(request.url).searchParams.get('id');
    if (!id || id.length > 128 || id.includes('/')) return errorResponse(400, 'bad_request', 'Missing id');
    const raw = await readJson(request, 4_400_000);
    const asReq = extractRequest.safeParse(raw);
    const asPage = captureRequest.safeParse(raw);
    const image =
      asReq.success && asReq.data.imageBase64 && asReq.data.mediaType
        ? { base64: asReq.data.imageBase64, mediaType: asReq.data.mediaType }
        : null;
    const text = asReq.success && asReq.data.text ? asReq.data.text : asPage.success ? (asPage.data.page.text ?? '').trim() : '';
    if (!image && text.length < 10) return errorResponse(400, 'bad_request', 'A message or screenshot is required');
    if (!process.env.ANTHROPIC_API_KEY) return errorResponse(503, 'not_configured', 'AI extraction is not configured yet');

    const db = adminDb();
    if (!(await hasAiConsent(db, user.uid))) {
      return errorResponse(403, 'consent_required', 'AI processing consent is required');
    }
    const ref = db.collection('users').doc(user.uid).collection('shipments').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return errorResponse(404, 'not_found', 'Shipment not found');

    const gate = aiGateResponse(await consumeAi(user.uid));
    if (gate) return gate;

    try {
      const result = await extractOrders(image ? { image } : { text });
      const pickup = result.orders
        .flatMap((o) => o.shipments)
        .map((s) => pickupFrom(s.pickup))
        .find((p) => p && (p.address || p.name));
      if (!pickup) return errorResponse(422, 'no_pickup', 'No pickup details found');

      // A new address invalidates previously resolved coordinates (the object is replaced).
      await ref.update({ pickup, updatedAt: new Date().toISOString() });
      return json({ pickup: { ...pickup, code: pickup.code ? true : undefined } }, 200, {}, request);
    } catch (e) {
      if (e instanceof NotConfiguredError) return errorResponse(503, 'not_configured', 'AI extraction is not configured yet');
      if (e instanceof ExtractionFailedError) return errorResponse(422, 'extraction_failed', 'Could not read this');
      throw e;
    }
  },
  { rate: AI_RULE },
);
