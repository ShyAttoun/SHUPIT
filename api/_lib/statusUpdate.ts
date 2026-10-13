import type { ExtractedOrder, ShipmentStatus } from '@shupit/contracts';

export interface StatusUpdate {
  status: ShipmentStatus;
  statusText?: string;
  estimatedDeliveryAt?: string;
  estimatedDeliveryFrom?: string;
  events: { description: string; occurredAt: string }[];
}

const norm = (v: string | null | undefined) => (v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const noon = (ymd: string | null | undefined) => {
  if (!ymd) return undefined;
  const d = new Date(`${ymd}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

/**
 * Picks the shipment in an extraction that corresponds to ours (by tracking number when
 * both have one, otherwise the only/first one) and returns what is visible about it.
 * Null if no status is shown — we never invent one.
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
  const delivered = match.status === 'delivered';
  return {
    status: match.status,
    ...(match.statusText ? { statusText: match.statusText } : {}),
    ...(!delivered && noon(match.estimatedDelivery) ? { estimatedDeliveryAt: noon(match.estimatedDelivery) } : {}),
    ...(!delivered && noon(match.estimatedDeliveryFrom) ? { estimatedDeliveryFrom: noon(match.estimatedDeliveryFrom) } : {}),
    events: match.events ?? [],
  };
}
