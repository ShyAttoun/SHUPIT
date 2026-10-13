import { z } from 'zod';
import { fieldProvenance, isoDate, money } from './common';

export const shipmentStatus = z.enum([
  'processing',
  'shipped',
  'in_transit',
  'customs',
  'out_for_delivery',
  'ready_for_pickup',
  'delivered',
  'exception',
  'returned',
  'unknown',
]);
export type ShipmentStatus = z.infer<typeof shipmentStatus>;

export const importSource = z.enum([
  'manual',
  'screenshot',
  'link',
  'pasted_text',
  'forwarded_email',
  'extension',
  'connected_email',
]);
export type ImportSource = z.infer<typeof importSource>;

export const orderItem = z.object({
  title: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: money.optional(),
  imageUrl: z.string().url().optional(),
  productUrl: z.string().url().optional(),
});
export type OrderItem = z.infer<typeof orderItem>;

export const order = z.object({
  id: z.string().min(1),
  merchantId: z.string().optional(),
  merchantName: z.string().min(1),
  externalOrderId: z.string().optional(),
  purchasedAt: isoDate.optional(),
  total: money.optional(),
  items: z.array(orderItem),
  importSource: importSource,
  provenance: z.record(z.string(), fieldProvenance),
  /** Conservative duplicate key: merchant + external order id (+ date). */
  dedupeKey: z.string().optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type Order = z.infer<typeof order>;

export const shipment = z.object({
  id: z.string().min(1),
  orderId: z.string().min(1),
  carrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  status: shipmentStatus,
  estimatedDeliveryAt: isoDate.optional(),
  lastEventAt: isoDate.optional(),
  /** Last time a carrier source confirmed the status. */
  lastVerifiedAt: isoDate.optional(),
  pickup: z
    .object({ name: z.string(), address: z.string().optional(), until: isoDate.optional() })
    .optional(),
});
export type Shipment = z.infer<typeof shipment>;

export const trackingEvent = z.object({
  id: z.string().min(1),
  shipmentId: z.string().min(1),
  status: shipmentStatus,
  description: z.string().optional(),
  occurredAt: isoDate,
  location: z
    .object({ text: z.string().optional(), lat: z.number().optional(), lng: z.number().optional() })
    .optional(),
});
export type TrackingEvent = z.infer<typeof trackingEvent>;
