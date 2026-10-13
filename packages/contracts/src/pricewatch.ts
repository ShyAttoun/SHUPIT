import { z } from 'zod';
import { currencyCode, isoDate, money } from './common';

/**
 * Only `live` and `feed` observations may trigger a price-drop alert.
 * `screenshot` and `user` are display-only and never alert.
 */
export const observationKind = z.enum([
  'live',
  'feed',
  /** Price read from the structured data of a page the user was viewing (extension). Verified at that moment. */
  'page',
  /** Price read by AI from page text: shown, but too uncertain to alert on. */
  'page_ai',
  'screenshot',
  'user',
]);
export type ObservationKind = z.infer<typeof observationKind>;

export const alertableKinds: readonly ObservationKind[] = ['live', 'feed', 'page'];

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
  /** No automatic source: the price is verified when the user visits the product page with the extension. */
  'manual',
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

/** What a notification is about. */
export const notificationType = z.enum([
  'price_drop',
  'target_reached',
  'shipment_status',
  'shipment_eta',
]);
export type NotificationType = z.infer<typeof notificationType>;

/** Per-user switches. Missing keys default to ON (see DEFAULT_NOTIFICATION_PREFS). */
export const notificationPrefs = z.object({
  priceDrops: z.boolean(),
  targetReached: z.boolean(),
  shipmentStatus: z.boolean(),
  readyForPickup: z.boolean(),
  deliveryExceptions: z.boolean(),
  /** Browser push (requires permission and a registered device). */
  push: z.boolean(),
});
export type NotificationPrefs = z.infer<typeof notificationPrefs>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  priceDrops: true,
  targetReached: true,
  shipmentStatus: true,
  readyForPickup: true,
  deliveryExceptions: true,
  push: false,
};

/** Which preference switch governs a notification. */
export function prefKeyFor(type: NotificationType, status?: string): keyof NotificationPrefs {
  if (type === 'price_drop') return 'priceDrops';
  if (type === 'target_reached') return 'targetReached';
  if (status === 'ready_for_pickup') return 'readyForPickup';
  if (status === 'exception' || status === 'returned') return 'deliveryExceptions';
  return 'shipmentStatus';
}

/** Lower-cased token overlap between two product titles (0..1). */
export function titleSimilarity(a: string, b: string): number {
  const tok = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .normalize('NFKD')
        .split(/[^\p{L}\p{N}]+/u)
        .filter((t) => t.length > 1),
    );
  const A = tok(a);
  const B = tok(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}
