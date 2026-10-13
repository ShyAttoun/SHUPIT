import { z } from 'zod';
import { currencyCode, isoDate, money } from './common';

/** Draft produced by metadata extraction; every field is optional and unverified until confirmed. */
export const productDraft = z.object({
  canonicalUrl: z.string().url(),
  merchantId: z.string().optional(),
  title: z.string().optional(),
  imageUrl: z.string().url().optional(),
  price: money.optional(),
  /** Which fields could not be read, so the UI can ask the user instead of guessing. */
  missing: z.array(z.enum(['title', 'imageUrl', 'price'])),
});
export type ProductDraft = z.infer<typeof productDraft>;

export const orderCreateInput = z.object({
  merchantId: z.string().max(60).optional(),
  merchantName: z.string().trim().min(1).max(120),
  externalOrderId: z.string().trim().max(80).optional(),
  purchasedAt: isoDate.optional(),
  total: money.optional(),
  /** How the draft was produced; defaults to manual. */
  importSource: z.enum(['manual', 'screenshot', 'link']).optional(),
  /** Field names that were read by AI and left unedited by the user (provenance). */
  aiFields: z.array(z.string().max(40)).max(12).optional(),
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .max(50),
  shipments: z
    .array(
      z.object({
        carrier: z.string().trim().max(60).optional(),
        trackingNumber: z.string().trim().max(60).optional(),
        estimatedDeliveryAt: isoDate.optional(),
      }),
    )
    .max(5),
});
export type OrderCreateInput = z.infer<typeof orderCreateInput>;

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
