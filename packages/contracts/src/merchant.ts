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
  affiliateProgramId: z.string().optional(),
  priceProviderId: z.string().optional(),
  active: z.boolean(),
});
export type Merchant = z.infer<typeof merchant>;

export const favoriteStore = z.object({
  merchantId: z.string().min(1),
  order: z.number().int().nonnegative(),
  addedAt: z.string(),
});
export type FavoriteStore = z.infer<typeof favoriteStore>;
