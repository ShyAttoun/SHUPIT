import type { ExtractedOrder, ShipmentStatus } from '@shupit/contracts';

export interface PickupDetails {
  name?: string;
  address?: string;
  until?: string;
  instructions?: string;
  code?: string;
}

/** Page-read pickup info → stored shape (collectionCode → code; wall-clock until → ISO). */
export function pickupFrom(
  p:
    | {
        name?: string | null;
        address?: string | null;
        until?: string | null;
        instructions?: string | null;
        collectionCode?: string | null;
      }
    | null
    | undefined,
): PickupDetails | undefined {
  if (!p) return undefined;
  const m = p.until ? /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(p.until) : null;
  const until = m ? new Date(`${m[1]}T${m[2] ?? '23:59'}:00.000Z`) : null;
  const out: PickupDetails = {
    ...(p.name ? { name: p.name } : {}),
    ...(p.address ? { address: p.address } : {}),
    ...(until && !Number.isNaN(until.getTime()) ? { until: until.toISOString() } : {}),
    ...(p.instructions ? { instructions: p.instructions } : {}),
    ...(p.collectionCode ? { code: p.collectionCode } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

export interface StatusUpdate {
  status: ShipmentStatus;
  statusText?: string;
  estimatedDeliveryAt?: string;
  estimatedDeliveryFrom?: string;
  events: { description: string; occurredAt: string }[];
  pickup?: PickupDetails;
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
    ...(pickupFrom(match.pickup) ? { pickup: pickupFrom(match.pickup) } : {}),
  };
}
