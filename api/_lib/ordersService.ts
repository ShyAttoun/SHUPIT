import type { Firestore } from 'firebase-admin/firestore';
import type { OrderUpdateInput, ShipmentCreateInput, ShipmentInput } from '@shupit/contracts';
import { orderDedupeKey } from './orderKeys';

export class NotFoundError extends Error {}
export class DuplicateError extends Error {
  constructor(public existingId: string) {
    super('duplicate');
  }
}

const TERMINAL = new Set(['delivered', 'returned']);

const userRef = (db: Firestore, uid: string) => db.collection('users').doc(uid);

/** Drops `undefined`s (Firestore rejects them) while keeping explicit nulls. */
function clean<T extends Record<string, unknown>>(o: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

/**
 * Applies edits to an existing order. Edited fields get `user` provenance (so AI/page-read values
 * that were corrected are no longer presented as machine-read). Re-checks duplicates conservatively.
 */
export async function updateOrder(
  db: Firestore,
  uid: string,
  orderId: string,
  input: OrderUpdateInput,
  now = new Date().toISOString(),
): Promise<void> {
  const ref = userRef(db, uid).collection('orders').doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new NotFoundError('order');
  const cur = snap.data() as Record<string, unknown>;

  const merchantId = input.merchantId !== undefined ? input.merchantId : (cur.merchantId as string | null);
  const merchantName = input.merchantName ?? (cur.merchantName as string);
  const externalOrderId =
    input.externalOrderId !== undefined ? input.externalOrderId : (cur.externalOrderId as string | null);

  const dedupeKey =
    orderDedupeKey({
      merchantName,
      ...(merchantId ? { merchantId } : {}),
      ...(externalOrderId ? { externalOrderId } : {}),
      items: [],
      shipments: [],
    }) ?? null;

  if (dedupeKey && dedupeKey !== cur.dedupeKey) {
    const clash = await userRef(db, uid).collection('orders').where('dedupeKey', '==', dedupeKey).limit(2).get();
    const other = clash.docs.find((d) => d.id !== orderId);
    if (other) throw new DuplicateError(other.id);
  }

  const provenance = { ...((cur.provenance as Record<string, unknown>) ?? {}) };
  const edited = (field: string) => {
    provenance[field] = { source: 'user', capturedAt: now };
  };
  if (input.merchantName !== undefined || input.merchantId !== undefined) edited('merchantName');
  if (input.externalOrderId !== undefined) edited('externalOrderId');
  if (input.purchasedAt !== undefined) edited('purchasedAt');
  if (input.total !== undefined) edited('total');
  if (input.items !== undefined) edited('items');

  await ref.update(
    clean({
      merchantId: input.merchantId,
      merchantName: input.merchantName,
      externalOrderId: input.externalOrderId,
      purchasedAt: input.purchasedAt,
      total: input.total,
      items: input.items,
      archivedAt: input.archived === undefined ? undefined : input.archived ? now : null,
      dedupeKey,
      provenance,
      updatedAt: now,
    }),
  );
}

/** Creates a shipment on an existing order (the order must belong to `uid`). */
export async function createShipment(
  db: Firestore,
  uid: string,
  input: ShipmentCreateInput,
  now = new Date().toISOString(),
): Promise<string> {
  const u = userRef(db, uid);
  if (!(await u.collection('orders').doc(input.orderId).get()).exists) throw new NotFoundError('order');
  const ref = u.collection('shipments').doc();
  const status = input.status ?? 'unknown';
  await ref.set({
    id: ref.id,
    orderId: input.orderId,
    carrier: input.carrier ?? null,
    trackingNumber: input.trackingNumber ?? null,
    status,
    statusSource: input.status ? 'user' : null,
    statusAsOf: input.status ? now : null,
    statusText: input.statusText ?? null,
    estimatedDeliveryAt: input.estimatedDeliveryAt ?? null,
    estimatedDeliveryFrom: input.estimatedDeliveryFrom ?? null,
    estimatedDeliverySource: input.estimatedDeliveryAt ? 'user' : null,
    pickup: input.pickup ?? null,
    lastEventAt: null,
    lastVerifiedAt: null,
    trackable: !!input.trackingNumber && !TERMINAL.has(status),
    nextCheckAt: input.trackingNumber && !TERMINAL.has(status) ? now : null,
    createdAt: now,
  });
  return ref.id;
}

/** Edits a shipment. Tracking history (events) is left untouched. */
export async function updateShipment(
  db: Firestore,
  uid: string,
  shipmentId: string,
  input: ShipmentInput,
  now = new Date().toISOString(),
): Promise<void> {
  const ref = userRef(db, uid).collection('shipments').doc(shipmentId);
  const snap = await ref.get();
  if (!snap.exists) throw new NotFoundError('shipment');
  const cur = snap.data() as Record<string, unknown>;

  const status = (input.status ?? cur.status) as string;
  // Editing the pickup details keeps resolved coordinates only while the address is unchanged.
  const prevPickup = (cur.pickup as { address?: string; lat?: number; lng?: number } | null) ?? null;
  const nextPickup =
    input.pickup && prevPickup?.address && input.pickup.address === prevPickup.address && prevPickup.lat !== undefined
      ? { ...input.pickup, lat: prevPickup.lat, lng: prevPickup.lng }
      : input.pickup;
  const trackingNumber =
    input.trackingNumber !== undefined ? input.trackingNumber : (cur.trackingNumber as string | null);

  await ref.update(
    clean({
      carrier: input.carrier,
      trackingNumber: input.trackingNumber,
      estimatedDeliveryAt: input.estimatedDeliveryAt,
      estimatedDeliveryFrom: input.estimatedDeliveryFrom,
      estimatedDeliverySource:
        input.estimatedDeliveryAt !== undefined ? (input.estimatedDeliveryAt ? 'user' : null) : undefined,
      status: input.status,
      statusSource: input.status ? 'user' : undefined,
      statusAsOf: input.status ? now : undefined,
      statusText: input.statusText,
      pickup: nextPickup,
      trackable: !!trackingNumber && !TERMINAL.has(status),
      nextCheckAt: !!trackingNumber && !TERMINAL.has(status) ? ((cur.nextCheckAt as string | null) ?? now) : null,
    }),
  );
}

/** Deletes a shipment and its tracking events. */
export async function deleteShipment(db: Firestore, uid: string, shipmentId: string): Promise<void> {
  const ref = userRef(db, uid).collection('shipments').doc(shipmentId);
  if (!(await ref.get()).exists) throw new NotFoundError('shipment');
  await db.recursiveDelete(ref);
}
