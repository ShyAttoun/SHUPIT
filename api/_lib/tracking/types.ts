import type { ShipmentStatus } from '@shupit/contracts';

export interface NormalizedEvent {
  /** Stable id derived from the event content so re-fetches never duplicate events. */
  id: string;
  status: ShipmentStatus;
  description?: string;
  occurredAt: string; // ISO
  locationText?: string;
}

export interface TrackingSnapshot {
  status: ShipmentStatus;
  estimatedDeliveryAt?: string;
  carrier?: string;
  events: NormalizedEvent[];
  /** Provider-reported "no data yet" — the shipment is not known to carriers (yet). */
  notFoundYet: boolean;
}

export interface TrackingProvider {
  id: string;
  /** Throws ProviderError on transport/shape problems; never fabricates a snapshot. */
  fetch(input: { trackingNumber: string; carrier?: string }): Promise<TrackingSnapshot>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
  ) {
    super(message);
  }
}
