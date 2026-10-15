import { z } from 'zod';

/** How "Shop Now" resolves. Never assume an app deep link keeps attribution. */
export const routingKind = z.enum(['affiliate', 'app_deep_link', 'web']);
export type RoutingKind = z.infer<typeof routingKind>;

export const merchant = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  domains: z.array(z.string().min(1)).min(1),
  logoUrl: z.string().url().optional(),
  country: z.string().length(2).optional(),
  homepageUrl: z.string().url(),
  /** Ordered preference; the router picks the first that is configured and verified. */
  routing: z.array(routingKind).min(1),
  /** null = explicitly no program. Set only after an approved program exists. */
  affiliateProgramId: z.string().nullable().optional(),
  priceProviderId: z.string().optional(),
  active: z.boolean(),
  /** Shopping category, used for grouping and future filters. */
  category: z.enum(['general', 'electronics', 'appliances', 'home', 'fashion', 'sports', 'beauty', 'baby', 'books', 'toys', 'health', 'travel']).optional(),
  /** The store's own "my orders" page, when known (opened directly, never through affiliate routing). */
  ordersUrl: z.string().url().optional(),
  /** Where the store matters most to our users; Israeli stores are listed first in Hebrew. */
  market: z.enum(['il', 'global']).optional(),
  /** Extra names people may type when searching (e.g. the Hebrew name). */
  aliases: z.array(z.string().min(1)).optional(),
});
export type Merchant = z.infer<typeof merchant>;

export const favoriteStore = z.object({
  merchantId: z.string().min(1),
  order: z.number().int().nonnegative(),
  addedAt: z.string(),
});
export type FavoriteStore = z.infer<typeof favoriteStore>;

/** A coupon code the user saved for one of their stores (or a partner coupon published by SHUPIT). */
export const storeCoupon = z.object({
  id: z.string().min(1),
  merchantId: z.string().min(1),
  /** Set when the code only works for one saved product (e.g. an iHerb product coupon). */
  productId: z.string().min(1).max(128).optional(),
  code: z.string().min(1).max(60),
  description: z.string().max(200).optional(),
  expiresAt: z.string().optional(),
  createdAt: z.string(),
});
export type StoreCoupon = z.infer<typeof storeCoupon>;
