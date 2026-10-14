import { adminDb } from './_lib/firebaseAdmin';
import { errorResponse, json, preflight, readJson } from './_lib/http';
import { uidForKey } from './_lib/automation';
import { hasAiConsent } from './_lib/consent';
import { consumeAi } from './_lib/usage';
import { aiGateResponse } from './_lib/aiGate';
import { AI_RULE, checkRate, firestoreRateStore } from './_lib/rateLimit';
import { matchShipment } from './_lib/smsMatch';
import { pickupFrom } from './_lib/statusUpdate';
import { ExtractionFailedError, NotConfiguredError, extractOrders } from './_lib/vision';
import { errorFields, hashId, log } from './_lib/log';

export const OPTIONS = preflight;

/**
 * POST { text } with header `x-shupit-key: shp_…` — for phone automations (iOS Shortcuts, Tasker) that
 * forward a delivery SMS. The message is read in memory, not stored. Pickup details are applied to a
 * shipment only when the match is unambiguous (tracking number, or exactly one open shipment).
 */
export async function POST(request: Request): Promise<Response> {
  const key = request.headers.get('x-shupit-key') ?? '';
  const db = adminDb();
  try {
    const uid = await uidForKey(db, key);
    if (!uid) return errorResponse(401, 'unauthenticated', 'Invalid key');

    const rate = await checkRate(firestoreRateStore, uid, { ...AI_RULE, bucket: 'smshook', limit: 30 });
    if (!rate.allowed) return errorResponse(429, 'rate_limited', 'Too many requests');

    const body = (await readJson(request, 20_000)) as { text?: unknown };
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (text.length < 10 || text.length > 2000) return errorResponse(400, 'bad_request', 'Message text required');

    if (!process.env.ANTHROPIC_API_KEY) return errorResponse(503, 'not_configured', 'AI extraction is not configured yet');
    if (!(await hasAiConsent(db, uid))) return errorResponse(403, 'consent_required', 'AI processing consent is required');
    const gate = aiGateResponse(await consumeAi(uid));
    if (gate) return gate;

    const result = await extractOrders({ text });
    const shipmentsOut = result.orders.flatMap((o) => o.shipments);
    const pickup = shipmentsOut.map((s) => pickupFrom(s.pickup)).find((p) => p && (p.address || p.name));
    if (!pickup) return json({ applied: false, reason: 'no_pickup' }, 200, {}, request);

    const snap = await db.collection('users').doc(uid).collection('shipments').get();
    const mine = snap.docs.map((d) => ({
      id: d.id,
      status: d.get('status') as string,
      trackingNumber: d.get('trackingNumber') as string | null,
    }));
    const match = matchShipment(shipmentsOut.map((s) => s.trackingNumber), mine);
    if (match.shipmentId === null) return json({ applied: false, reason: match.reason }, 200, {}, request);
    const targetId = match.shipmentId;

    await snap.docs
      .find((d) => d.id === targetId)!
      .ref.update({ pickup, updatedAt: new Date().toISOString() });
    log('info', 'sms_hook_applied', { uid: hashId(uid), by: match.by });
    return json({ applied: true, by: match.by }, 200, {}, request);
  } catch (e) {
    if (e instanceof NotConfiguredError) return errorResponse(503, 'not_configured', 'AI extraction is not configured yet');
    if (e instanceof ExtractionFailedError) return json({ applied: false, reason: 'unreadable' }, 200, {}, request);
    if (e instanceof SyntaxError) return errorResponse(400, 'bad_request', 'Invalid JSON');
    log('error', 'sms_hook_error', errorFields(e));
    return errorResponse(500, 'internal', 'Unexpected error');
  }
}
