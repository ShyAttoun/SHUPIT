import type { ShipmentStatus } from '@shupit/contracts';
import type { NormalizedEvent, TrackingSnapshot } from './types';

const TERMINAL: ShipmentStatus[] = ['delivered', 'returned'];
export const isTerminal = (s: ShipmentStatus) => TERMINAL.includes(s);

/** How long to wait before checking again, by current status. */
export function nextCheckDelayMinutes(status: ShipmentStatus, attempts = 0): number {
  const base: Record<ShipmentStatus, number> = {
    out_for_delivery: 30,
    ready_for_pickup: 120,
    in_transit: 180,
    customs: 180,
    shipped: 180,
    processing: 360,
    exception: 360,
    unknown: 360,
    delivered: 0,
    returned: 0,
  };
  const delay = base[status];
  if (delay === 0) return 0;
  // Bounded backoff for repeated failures: x2 per attempt, capped at 24h.
  return Math.min(delay * 2 ** Math.max(0, attempts), 24 * 60);
}

/** Notify only on meaningful transitions; never for 'unknown' or repeats. */
const NOTIFY: ShipmentStatus[] = [
  'shipped',
  'in_transit',
  'customs',
  'out_for_delivery',
  'ready_for_pickup',
  'delivered',
  'exception',
];

export interface NotificationDraft {
  type: 'shipment_status' | 'shipment_eta';
  status: ShipmentStatus;
  dedupeKey: string;
  etaFrom?: string;
  etaTo?: string;
}

const DAY = 86_400_000;

/** Decides which notifications (if any) a snapshot warrants. Pure. */
export function notificationsFor(
  shipmentId: string,
  prev: { status: ShipmentStatus; estimatedDeliveryAt?: string | null; hasCarrierEta?: boolean },
  next: Pick<TrackingSnapshot, 'status' | 'estimatedDeliveryAt'>,
): NotificationDraft[] {
  const out: NotificationDraft[] = [];
  if (next.status !== prev.status && NOTIFY.includes(next.status)) {
    out.push({ type: 'shipment_status', status: next.status, dedupeKey: `${shipmentId}:status:${next.status}` });
  }
  // ETA change: only when a previous carrier-verified ETA existed and moved by >= 1 day.
  if (
    next.status === prev.status &&
    prev.hasCarrierEta &&
    prev.estimatedDeliveryAt &&
    next.estimatedDeliveryAt
  ) {
    const shift = Math.abs(Date.parse(next.estimatedDeliveryAt) - Date.parse(prev.estimatedDeliveryAt));
    if (shift >= DAY) {
      out.push({
        type: 'shipment_eta',
        status: next.status,
        dedupeKey: `${shipmentId}:eta:${next.estimatedDeliveryAt.slice(0, 10)}`,
        etaFrom: prev.estimatedDeliveryAt,
        etaTo: next.estimatedDeliveryAt,
      });
    }
  }
  return out;
}

/** Latest event time, used for lastEventAt. */
export function latestEventAt(events: NormalizedEvent[]): string | undefined {
  return events.reduce<string | undefined>((m, e) => (!m || e.occurredAt > m ? e.occurredAt : m), undefined);
}
