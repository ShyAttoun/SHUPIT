import type { Firestore } from 'firebase-admin/firestore';
import { isTerminal, latestEventAt, nextCheckDelayMinutes, notificationsFor } from './refresh';
import { ship24Provider } from './ship24';
import { ProviderError, type TrackingProvider } from './types';

export function configuredProvider(): TrackingProvider | null {
  const key = process.env.SHIP24_API_KEY;
  return key ? ship24Provider(key) : null;
}

export type RefreshOutcome = 'updated' | 'skipped' | 'unchanged' | 'provider_error' | 'terminal';

const LEASE_MINUTES = 15;

/** Claims, fetches and persists one shipment. Idempotent: events are keyed by content hash. */
export async function refreshShipment(
  db: Firestore,
  uid: string,
  shipmentId: string,
  provider: TrackingProvider,
  opts: { now?: Date; force?: boolean } = {},
): Promise<RefreshOutcome> {
  const now = opts.now ?? new Date();
  const ref = db.collection('users').doc(uid).collection('shipments').doc(shipmentId);

  // Claim with a lease so overlapping cron runs don't double-process.
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const d = snap.data()!;
    if (!d.trackingNumber) return null;
    if (isTerminal(d.status)) return null;
    if (!opts.force && d.nextCheckAt && d.nextCheckAt > now.toISOString()) return null;
    tx.update(ref, { nextCheckAt: new Date(now.getTime() + LEASE_MINUTES * 60_000).toISOString() });
    return d;
  });
  if (!claimed) return 'skipped';

  const orderSnap = await db.collection('users').doc(uid).collection('orders').doc(claimed.orderId).get();
  const merchantName = (orderSnap.get('merchantName') as string | undefined) ?? '';

  let snapshot;
  try {
    snapshot = await provider.fetch({ trackingNumber: claimed.trackingNumber, carrier: claimed.carrier ?? undefined });
  } catch (e) {
    const attempts = ((claimed.checkAttempts as number | undefined) ?? 0) + 1;
    const retryable = e instanceof ProviderError ? e.retryable : true;
    await ref.update({
      checkAttempts: attempts,
      lastCheckedAt: now.toISOString(),
      nextCheckAt: new Date(
        now.getTime() + nextCheckDelayMinutes(claimed.status, retryable ? attempts : 6) * 60_000,
      ).toISOString(),
    });
    console.error('tracking_provider_error', provider.id, e instanceof Error ? e.name : 'unknown');
    return 'provider_error';
  }

  const prev = {
    status: claimed.status,
    estimatedDeliveryAt: claimed.estimatedDeliveryAt ?? null,
    hasCarrierEta: claimed.estimatedDeliverySource === 'carrier',
  };

  // Never downgrade a known status to "unknown" because a provider has no data yet.
  const effectiveStatus = snapshot.notFoundYet && snapshot.status === 'unknown' ? claimed.status : snapshot.status;
  const drafts = notificationsFor(shipmentId, prev, {
    status: effectiveStatus,
    estimatedDeliveryAt: snapshot.estimatedDeliveryAt,
  });

  const batch = db.batch();
  for (const ev of snapshot.events) {
    batch.set(
      ref.collection('trackingEvents').doc(ev.id),
      {
        id: ev.id,
        shipmentId,
        status: ev.status,
        description: ev.description ?? null,
        occurredAt: ev.occurredAt,
        location: ev.locationText ? { text: ev.locationText } : null,
        source: provider.id,
      },
      { merge: true },
    );
  }

  const verified = !snapshot.notFoundYet;
  batch.update(ref, {
    status: effectiveStatus,
    lastCheckedAt: now.toISOString(),
    checkAttempts: 0,
    ...(verified ? { lastVerifiedAt: now.toISOString() } : {}),
    ...(latestEventAt(snapshot.events) ? { lastEventAt: latestEventAt(snapshot.events) } : {}),
    ...(snapshot.estimatedDeliveryAt
      ? { estimatedDeliveryAt: snapshot.estimatedDeliveryAt, estimatedDeliverySource: 'carrier' }
      : {}),
    trackable: !isTerminal(effectiveStatus),
    nextCheckAt: isTerminal(effectiveStatus)
      ? null
      : new Date(now.getTime() + nextCheckDelayMinutes(effectiveStatus) * 60_000).toISOString(),
  });

  for (const n of drafts) {
    // Deterministic doc id = dedupe key → at-most-once even if a run is repeated.
    const nRef = db
      .collection('users')
      .doc(uid)
      .collection('notifications')
      .doc(Buffer.from(n.dedupeKey).toString('base64url'));
    batch.create(nRef, {
      type: n.type,
      status: n.status,
      shipmentId,
      orderId: claimed.orderId,
      merchantName,
      etaFrom: n.etaFrom ?? null,
      etaTo: n.etaTo ?? null,
      dedupeKey: n.dedupeKey,
      createdAt: now.toISOString(),
      readAt: null,
    });
  }

  try {
    await batch.commit();
  } catch (e) {
    // ALREADY_EXISTS on a notification create means a previous run already notified; redo without them.
    if ((e as { code?: number }).code === 6) {
      const retry = db.batch();
      retry.update(ref, { lastCheckedAt: now.toISOString() });
      await retry.commit();
      return 'unchanged';
    }
    throw e;
  }
  return 'updated';
}
