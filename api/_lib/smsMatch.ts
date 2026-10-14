import type { ShipmentStatus } from '@shupit/contracts';

export interface MatchableShipment {
  id: string;
  status: ShipmentStatus | string;
  trackingNumber?: string | null;
}

const OPEN: string[] = ['processing', 'shipped', 'in_transit', 'customs', 'out_for_delivery', 'ready_for_pickup', 'unknown'];
const norm = (v: string | null | undefined) => (v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export type MatchResult =
  | { shipmentId: string; by: 'tracking' | 'only_open' | 'only_ready' }
  | { shipmentId: null; reason: 'no_open_shipments' | 'ambiguous' };

/**
 * Decides which shipment a pickup message belongs to. A tracking number in the message wins;
 * otherwise only an unambiguous candidate is used — we never guess between several shipments.
 */
export function matchShipment(trackingNumbers: (string | null | undefined)[], shipments: MatchableShipment[]): MatchResult {
  const wanted = trackingNumbers.map(norm).filter((n) => n.length >= 6);
  for (const w of wanted) {
    const hit = shipments.find((s) => norm(s.trackingNumber) === w);
    if (hit) return { shipmentId: hit.id, by: 'tracking' };
  }
  const open = shipments.filter((s) => OPEN.includes(s.status));
  if (open.length === 0) return { shipmentId: null, reason: 'no_open_shipments' };
  if (open.length === 1) return { shipmentId: open[0]!.id, by: 'only_open' };
  const ready = open.filter((s) => s.status === 'ready_for_pickup');
  if (ready.length === 1) return { shipmentId: ready[0]!.id, by: 'only_ready' };
  return { shipmentId: null, reason: 'ambiguous' };
}
