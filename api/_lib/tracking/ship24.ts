import { createHash } from 'node:crypto';
import type { ShipmentStatus } from '@shupit/contracts';
import { z } from 'zod';
import { ProviderError, type NormalizedEvent, type TrackingProvider, type TrackingSnapshot } from './types';

const BASE = 'https://api.ship24.com/public/v1';

/**
 * statusMilestone values are taken from Ship24's documentation
 * (docs.ship24.com/status). The response *shape* below follows Ship24's
 * public data format but is UNVERIFIED against a live response until a key is
 * configured; parsing is strict-but-tolerant and fails closed (ProviderError).
 */
export function mapMilestone(milestone: string | undefined, category?: string): ShipmentStatus {
  switch (milestone) {
    case 'info_received':
      return 'processing';
    case 'in_transit':
      return category === 'customs' ? 'customs' : 'in_transit';
    case 'out_for_delivery':
      return 'out_for_delivery';
    case 'failed_attempt':
      return 'exception';
    case 'available_for_pickup':
      return 'ready_for_pickup';
    case 'delivered':
      return 'delivered';
    case 'exception':
      return 'exception';
    default:
      return 'unknown'; // includes 'pending' and anything we do not recognise
  }
}

const event = z.object({
  occurrenceDatetime: z.string().optional(),
  status: z.string().optional(),
  statusMilestone: z.string().optional(),
  statusCategory: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  courierCode: z.string().nullable().optional(),
});

const response = z.object({
  data: z.object({
    trackings: z
      .array(
        z.object({
          shipment: z
            .object({
              statusMilestone: z.string().optional(),
              statusCategory: z.string().nullable().optional(),
              delivery: z
                .object({ estimatedDeliveryDate: z.string().nullable().optional() })
                .partial()
                .optional(),
            })
            .partial()
            .optional(),
          events: z.array(event).default([]),
        }),
      )
      .default([]),
  }),
});

export function eventId(trackingNumber: string, e: { occurrenceDatetime?: string; status?: string; location?: string | null }): string {
  return createHash('sha1')
    .update([trackingNumber, e.occurrenceDatetime ?? '', e.status ?? '', e.location ?? ''].join('|'))
    .digest('hex')
    .slice(0, 20);
}

/** Pure: turn a raw provider body into our snapshot. Exported for fixture tests. */
export function parseShip24(body: unknown, trackingNumber: string): TrackingSnapshot {
  const parsed = response.safeParse(body);
  if (!parsed.success) throw new ProviderError('unexpected response shape', false);
  const tracking = parsed.data.data.trackings[0];
  if (!tracking) return { status: 'unknown', events: [], notFoundYet: true };

  const events: NormalizedEvent[] = tracking.events
    .filter((e) => e.occurrenceDatetime && !Number.isNaN(Date.parse(e.occurrenceDatetime)))
    .map((e) => ({
      id: eventId(trackingNumber, e),
      status: mapMilestone(e.statusMilestone, e.statusCategory ?? undefined),
      description: e.status ?? undefined,
      occurredAt: new Date(e.occurrenceDatetime!).toISOString(),
      locationText: e.location ?? undefined,
    }))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const shipment = tracking.shipment;
  const milestone = shipment?.statusMilestone;
  const status = mapMilestone(milestone, shipment?.statusCategory ?? undefined);
  const eta = shipment?.delivery?.estimatedDeliveryDate;
  const etaIso = eta && !Number.isNaN(Date.parse(eta)) ? new Date(eta).toISOString() : undefined;

  return {
    status,
    estimatedDeliveryAt: status === 'delivered' ? undefined : etaIso,
    events,
    notFoundYet: milestone === 'pending' || (events.length === 0 && status === 'unknown'),
  };
}

export function ship24Provider(apiKey: string, fetchImpl: typeof fetch = fetch): TrackingProvider {
  return {
    id: 'ship24',
    async fetch({ trackingNumber }) {
      let res: Response;
      try {
        res = await fetchImpl(`${BASE}/trackers/track`, {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ trackingNumber }),
          signal: AbortSignal.timeout(60_000), // docs: first response may take up to a minute
        });
      } catch {
        throw new ProviderError('network', true);
      }
      if (res.status === 429 || res.status >= 500) throw new ProviderError(`status ${res.status}`, true);
      if (!res.ok) throw new ProviderError(`status ${res.status}`, false);
      return parseShip24(await res.json().catch(() => null), trackingNumber);
    },
  };
}
