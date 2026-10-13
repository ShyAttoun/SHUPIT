import { getMerchant, orderCreateInput, type OrderCreateInput } from '@shupit/contracts';
import { adminDb } from './_lib/firebaseAdmin';
import { errorResponse, json, preflight, readJson } from './_lib/http';
import { orderDedupeKey } from './_lib/orderKeys';
import { toEventDocs } from './_lib/orderEnrich';
import { withAuth } from './_lib/withAuth';

/** AI-read fields that the user left unedited are marked ai_vision; everything else is user-entered. */
function provenanceFor(input: OrderCreateInput, now: string) {
  const ai = new Set(input.aiFields ?? []);
  const source = (field: string) => ({ source: ai.has(field) ? 'ai_vision' : 'user', capturedAt: now });
  return {
    merchantName: source('merchantName'),
    items: source('items'),
    ...(input.total ? { total: source('total') } : {}),
    ...(input.externalOrderId ? { externalOrderId: source('externalOrderId') } : {}),
    ...(input.purchasedAt ? { purchasedAt: source('purchasedAt') } : {}),
  };
}

export const OPTIONS = preflight;

/** POST → create a manual order (+ shipments). Shipments are server-written only. */
export const POST = withAuth(async (request, user) => {
  const parsed = orderCreateInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return json(
      { error: { code: 'validation', message: 'Invalid order', fields: parsed.error.issues.map((i) => i.path.join('.')) } },
      400,
      {},
      request,
    );
  }
  const input = parsed.data;
  if (input.merchantId && !getMerchant(input.merchantId)) {
    return errorResponse(400, 'unknown_merchant', 'Unknown merchant');
  }

  const db = adminDb();
  const orders = db.collection('users').doc(user.uid).collection('orders');
  const dedupeKey = orderDedupeKey(input);

  if (dedupeKey) {
    const existing = await orders.where('dedupeKey', '==', dedupeKey).limit(1).get();
    if (!existing.empty) {
      return json({ error: { code: 'duplicate', message: 'Order already exists' }, existingId: existing.docs[0]!.id }, 409, {}, request);
    }
  }

  const now = new Date().toISOString();
  const orderRef = orders.doc();
  const orderDoc = {
    id: orderRef.id,
    merchantId: input.merchantId ?? null,
    merchantName: input.merchantName,
    externalOrderId: input.externalOrderId ?? null,
    purchasedAt: input.purchasedAt ?? null,
    total: input.total ?? null,
    items: input.items,
    importSource: input.importSource ?? 'manual',
    provenance: provenanceFor(input, now),
    dedupeKey: dedupeKey ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const batch = db.batch();
  batch.set(orderRef, orderDoc);
  const shipmentIds: string[] = [];
  for (const s of input.shipments) {
    const ref = db.collection('users').doc(user.uid).collection('shipments').doc();
    shipmentIds.push(ref.id);
    batch.set(ref, {
      id: ref.id,
      orderId: orderRef.id,
      carrier: s.carrier ?? null,
      trackingNumber: s.trackingNumber ?? null,
      // No carrier source connected: never claim a status we have not verified.
      // A status read from a screenshot is a user-supplied snapshot, never carrier-verified.
      status: s.status ?? 'unknown',
      statusSource: s.status ? (input.importSource === 'manual' || !input.importSource ? 'user' : 'ai_vision') : null,
      statusAsOf: s.status ? now : null,
      estimatedDeliveryAt: s.estimatedDeliveryAt ?? null,
      estimatedDeliveryFrom: s.estimatedDeliveryFrom ?? null,
      statusText: s.statusText ?? null,
      estimatedDeliverySource: s.estimatedDeliveryAt ? 'user' : null,
      lastEventAt: null,
      lastVerifiedAt: null,
      // Picked up by the refresh cron once a tracking provider is configured.
      trackable: !!s.trackingNumber && s.status !== 'delivered' && s.status !== 'returned',
      nextCheckAt: s.trackingNumber ? now : null,
      createdAt: now,
    });
    for (const ev of toEventDocs(ref.id, s.events, 'page')) {
      batch.set(ref.collection('trackingEvents').doc(ev.id), ev.doc, { merge: true });
    }
  }
  await batch.commit();

  return json({ id: orderRef.id, shipmentIds }, 201, {}, request);
});

/** DELETE ?id=<orderId> → removes the order and its shipments/events. */
export const DELETE = withAuth(async (request, user) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id || id.length > 128 || id.includes('/')) {
    return errorResponse(400, 'bad_request', 'Missing order id');
  }
  const db = adminDb();
  const userRef = db.collection('users').doc(user.uid);
  const orderRef = userRef.collection('orders').doc(id);
  if (!(await orderRef.get()).exists) return errorResponse(404, 'not_found', 'Order not found');

  const shipments = await userRef.collection('shipments').where('orderId', '==', id).get();
  for (const s of shipments.docs) {
    await db.recursiveDelete(s.ref); // includes trackingEvents
  }
  await db.recursiveDelete(orderRef);
  return json({ ok: true }, 200, {}, request);
});
