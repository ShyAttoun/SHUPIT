import type { ExtractedOrder, ShipmentStatus } from '@shupit/contracts';

export interface StatusUpdate {
  status: ShipmentStatus;
  estimatedDeliveryAt?: string;
}

const norm = (v: string | null | undefined) => (v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Picks the shipment in an extraction that corresponds to ours (by tracking number when
 * both have one, otherwise the only/first one) and returns its visible status. Null if
 * the screenshot shows no status — we never invent one.
 */
export function statusUpdateFrom(
  data: Pick<ExtractedOrder, 'shipments'>,
  trackingNumber: string | null | undefined,
): StatusUpdate | null {
  const want = norm(trackingNumber);
  const list = data.shipments;
  const match =
    (want && list.find((s) => norm(s.trackingNumber) === want)) ||
    (list.length === 1 ? list[0] : undefined) ||
    (!want ? list[0] : undefined);
  if (!match?.status) return null;
  const eta = match.estimatedDelivery ? new Date(`${match.estimatedDelivery}T12:00:00.000Z`) : null;
  return {
    status: match.status,
    ...(eta && !Number.isNaN(eta.getTime()) && match.status !== 'delivered'
      ? { estimatedDeliveryAt: eta.toISOString() }
      : {}),
  };
}
