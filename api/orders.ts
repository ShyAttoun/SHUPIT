import { getMerchant, orderCreateInput } from '@shupit/contracts';
import { adminDb } from './_lib/firebaseAdmin';
import { errorResponse, json, preflight, readJson } from './_lib/http';
import { orderDedupeKey } from './_lib/orderKeys';
import { withAuth } from './_lib/withAuth';

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
  const prov = { source: 'user', capturedAt: now } as const;
  const orderDoc = {
    id: orderRef.id,
    merchantId: input.merchantId ?? null,
    merchantName: input.merchantName,
    externalOrderId: input.externalOrderId ?? null,
    purchasedAt: input.purchasedAt ?? null,
    total: input.total ?? null,
    items: input.items,
    importSource: 'manual',
    provenance: { merchantName: prov, items: prov, ...(input.total ? { total: prov } : {}) },
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
      status: 'unknown',
      estimatedDeliveryAt: s.estimatedDeliveryAt ?? null,
      estimatedDeliverySource: s.estimatedDeliveryAt ? 'user' : null,
      lastEventAt: null,
      lastVerifiedAt: null,
      createdAt: now,
    });
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
