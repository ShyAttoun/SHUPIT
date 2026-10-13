import { z } from 'zod';
import { currencyCode, isoDate, money } from './common';

/**
 * Only `live` and `feed` observations may trigger a price-drop alert.
 * `screenshot` and `user` are display-only and never alert.
 */
export const observationKind = z.enum(['live', 'feed', 'screenshot', 'user']);
export type ObservationKind = z.infer<typeof observationKind>;

export const alertableKinds: readonly ObservationKind[] = ['live', 'feed'];

export const priceObservation = z.object({
  id: z.string().min(1),
  variantId: z.string().min(1),
  price: money,
  inStock: z.boolean().optional(),
  kind: observationKind,
  providerId: z.string().optional(),
  observedAt: isoDate,
});
export type PriceObservation = z.infer<typeof priceObservation>;

export const monitoringStatus = z.enum([
  'active',
  'unsupported_merchant',
  'no_source_connected',
  'paused',
  'stale',
  'unavailable',
]);
export type MonitoringStatus = z.infer<typeof monitoringStatus>;

export const priceWatchSubscription = z.object({
  id: z.string().min(1),
  uid: z.string().min(1),
  savedProductId: z.string().min(1),
  variantId: z.string().optional(),
  enabled: z.boolean(),
  targetPrice: money.optional(),
  /** Minimum drop (percent) from the last notified price to alert. */
  minDropPercent: z.number().min(1).max(90).default(5),
  currency: currencyCode.optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type PriceWatchSubscription = z.infer<typeof priceWatchSubscription>;

export const priceAlertEvent = z.object({
  id: z.string().min(1),
  uid: z.string().min(1),
  subscriptionId: z.string().min(1),
  fromObservationId: z.string().min(1),
  toObservationId: z.string().min(1),
  oldPrice: money,
  newPrice: money,
  dropPercent: z.number(),
  /** `${subscriptionId}:${toObservationId}` — guarantees at-most-once alerts. */
  dedupeKey: z.string().min(1),
  createdAt: isoDate,
});
export type PriceAlertEvent = z.infer<typeof priceAlertEvent>;

/** Percent drop between two prices in the SAME currency; null if not comparable. */
export function dropPercent(
  previous: { amountMinor: number; currency: string },
  current: { amountMinor: number; currency: string },
): number | null {
  if (previous.currency !== current.currency) return null;
  if (previous.amountMinor <= 0) return null;
  return ((previous.amountMinor - current.amountMinor) / previous.amountMinor) * 100;
}
