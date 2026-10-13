import { z } from 'zod';

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

const amount = z
  .object({
    amount: z.number().nonnegative(),
    currency: z.string().regex(/^[A-Z]{3}$/),
  })
  .nullable();

const confidence = z.enum(['high', 'medium', 'low']);

/** What the vision/text model may report for an order. null = not visible. Never guessed. */
export const extractedOrder = z.object({
  isOrderScreenshot: z.boolean(),
  merchantName: z.string().max(120).nullable(),
  orderNumber: z.string().max(80).nullable(),
  purchaseDate: ymd,
  total: amount,
  items: z
    .array(z.object({ title: z.string().min(1).max(200), quantity: z.number().int().min(1).max(999) }))
    .max(30),
  shipments: z
    .array(
      z.object({
        carrier: z.string().max(60).nullable(),
        trackingNumber: z.string().max(60).nullable(),
        estimatedDelivery: ymd,
      }),
    )
    .max(5),
  confidence,
});
export type ExtractedOrder = z.infer<typeof extractedOrder>;

export const extractedProduct = z.object({
  isProductPage: z.boolean(),
  title: z.string().max(300).nullable(),
  merchantName: z.string().max(120).nullable(),
  price: amount,
  confidence,
});
export type ExtractedProduct = z.infer<typeof extractedProduct>;

export const extractRequest = z
  .object({
    kind: z.enum(['order', 'product']),
    imageBase64: z.string().max(4_000_000).optional(),
    mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
    url: z.string().url().max(2048).optional(),
  })
  .refine((v) => (v.imageBase64 && v.mediaType) || v.url, {
    message: 'image or url required',
  });
export type ExtractRequest = z.infer<typeof extractRequest>;
