import { z } from 'zod';
import { currencyCode, isoDate, money } from './common';
import { shipmentStatus } from './orders';

/** Draft produced by metadata extraction; every field is optional and unverified until confirmed. */
export const productDraft = z.object({
  canonicalUrl: z.string().url(),
  merchantId: z.string().optional(),
  title: z.string().optional(),
  imageUrl: z.string().url().optional(),
  price: money.optional(),
  /** Variant exposed by the page (sku / color / size), when present. */
  variant: z.string().max(120).optional(),
  /** Which fields could not be read, so the UI can ask the user instead of guessing. */
  missing: z.array(z.enum(['title', 'imageUrl', 'price'])),
});
export type ProductDraft = z.infer<typeof productDraft>;

export const pickupInput = z.object({
  name: z.string().trim().max(120).optional(),
  address: z.string().trim().max(300).optional(),
  until: isoDate.optional(),
  instructions: z.string().trim().max(500).optional(),
  /** Collection / pickup code. Sensitive: only ever shown to its owner. */
  code: z.string().trim().max(60).optional(),
});
export type PickupInput = z.infer<typeof pickupInput>;

export const orderCreateInput = z.object({
  merchantId: z.string().max(60).optional(),
  merchantName: z.string().trim().min(1).max(120),
  externalOrderId: z.string().trim().max(80).optional(),
  purchasedAt: isoDate.optional(),
  total: money.optional(),
  /** How the draft was produced; defaults to manual. */
  importSource: z.enum(['manual', 'screenshot', 'link', 'extension']).optional(),
  /** Field names that were read by AI and left unedited by the user (provenance). */
  aiFields: z.array(z.string().max(40)).max(12).optional(),
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        quantity: z.number().int().min(1).max(999),
        imageUrl: z.string().url().max(2048).optional(),
        productUrl: z.string().url().max(2048).optional(),
      }),
    )
    .max(50),
  shipments: z
    .array(
      z.object({
        carrier: z.string().trim().max(60).optional(),
        trackingNumber: z.string().trim().max(60).optional(),
        estimatedDeliveryAt: isoDate.optional(),
        /** Only meaningful for screenshot/link imports; stored as unverified. */
        status: shipmentStatus.optional(),
        /** Carrier wording of the status, as read from the page/screenshot. */
        statusText: z.string().trim().max(200).optional(),
        estimatedDeliveryFrom: isoDate.optional(),
        pickup: pickupInput.optional(),
        events: z
          .array(z.object({ description: z.string().trim().min(1).max(300), occurredAt: isoDate }))
          .max(30)
          .optional(),
      }),
    )
    .max(5),
});
export type OrderCreateInput = z.infer<typeof orderCreateInput>;

/** Edits to an existing order. Only the fields present are changed; null clears an optional field. */
export const orderUpdateInput = z
  .object({
    merchantId: z.string().max(60).nullable().optional(),
    merchantName: z.string().trim().min(1).max(120).optional(),
    externalOrderId: z.string().trim().max(80).nullable().optional(),
    purchasedAt: isoDate.nullable().optional(),
    total: money.nullable().optional(),
    items: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(200),
          quantity: z.number().int().min(1).max(999),
          imageUrl: z.string().url().max(2048).optional(),
          productUrl: z.string().url().max(2048).optional(),
        }),
      )
      .max(50)
      .optional(),
    /** true: move to the archive (package received); false: restore. */
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'nothing to update' });
export type OrderUpdateInput = z.infer<typeof orderUpdateInput>;

export const shipmentInput = z.object({
  carrier: z.string().trim().max(60).nullable().optional(),
  trackingNumber: z.string().trim().max(60).nullable().optional(),
  estimatedDeliveryAt: isoDate.nullable().optional(),
  estimatedDeliveryFrom: isoDate.nullable().optional(),
  /** Set by the user: stored as a user-supplied status, never as carrier-verified. */
  status: shipmentStatus.optional(),
  statusText: z.string().trim().max(200).nullable().optional(),
  pickup: pickupInput.nullable().optional(),
});
export type ShipmentInput = z.infer<typeof shipmentInput>;

export const shipmentCreateInput = shipmentInput.extend({
  orderId: z.string().min(1).max(128),
});
export type ShipmentCreateInput = z.infer<typeof shipmentCreateInput>;

export const goRequest = z.object({
  merchantId: z.string().max(60).optional(),
  productUrl: z.string().url().max(2048).optional(),
});
export type GoRequest = z.infer<typeof goRequest>;

export const goResponse = z.object({
  url: z.string().url(),
  kind: z.enum(['affiliate', 'web']),
  /** Present only when an affiliate link is actually used. */
  disclosure: z.string().optional(),
});
export type GoResponse = z.infer<typeof goResponse>;

export { currencyCode };

export const priceObservationRequest = z.object({
  pageUrl: z.string().url().max(2048),
  price: money,
  /** Title as shown on the page, used to confirm it is the same product. */
  pageTitle: z.string().max(300).optional(),
  /** Variant as exposed by the page (sku / color / size); compared only with the same variant. */
  variant: z.string().max(120).optional(),
  /** True when the price was read by AI from text rather than from the page's structured data. */
  aiRead: z.boolean().optional(),
  /** The user confirmed that this page is the saved product despite a title mismatch. */
  confirmed: z.boolean().optional(),
});
export type PriceObservationRequest = z.infer<typeof priceObservationRequest>;
