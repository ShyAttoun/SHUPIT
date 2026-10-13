import { z } from 'zod';
import { fieldProvenance, isoDate, money } from './common';
import { observationKind } from './pricewatch';

export const savedProduct = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(300),
  merchantId: z.string().optional(),
  productUrl: z.string().url().optional(),
  /** normalizeProductUrl(productUrl); used for duplicate detection. */
  urlKey: z.string().optional(),
  note: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
  /** Price at the moment of saving. Not a live price. */
  savedPrice: money.optional(),
  priceVerifiedAt: isoDate.optional(),
  variant: z.record(z.string(), z.string()).optional(),
  /** Latest price the user verified on the merchant's page (manual verification). */
  latestObservation: z
    .object({ price: money, kind: observationKind, observedAt: isoDate, variantKey: z.string().optional() })
    .nullable()
    .optional(),
  collectionIds: z.array(z.string()),
  canonicalProductId: z.string().optional(),
  provenance: z.record(z.string(), fieldProvenance),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type SavedProduct = z.infer<typeof savedProduct>;

export const wishlistCollection = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  order: z.number().int().nonnegative(),
  createdAt: isoDate,
});
export type WishlistCollection = z.infer<typeof wishlistCollection>;
