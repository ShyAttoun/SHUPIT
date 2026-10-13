import { z } from 'zod';
import { shipmentStatus } from './orders';

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
    .array(
      z.object({
        title: z.string().min(1).max(200),
        quantity: z.number().int().min(1).max(999),
        /** Must be one of the image URLs found on the page; null when unsure. */
        imageUrl: z.string().url().max(2048).nullable().optional(),
      }),
    )
    .max(30),
  shipments: z
    .array(
      z.object({
        carrier: z.string().max(60).nullable(),
        trackingNumber: z.string().max(60).nullable(),
        /** Current delivery status if the screenshot shows one (progress bar or status text). */
        status: shipmentStatus.nullable().optional(),
        /** The carrier's own wording of the current status, verbatim. */
        statusText: z.string().max(200).nullable().optional(),
        estimatedDeliveryFrom: ymd.optional(),
        estimatedDelivery: ymd,
        /** Tracking history shown on the page, newest first. occurredAt: YYYY-MM-DD or YYYY-MM-DDTHH:MM (local time as shown). */
        events: z
          .array(
            z.object({
              description: z.string().min(1).max(300),
              occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/),
            }),
          )
          .max(30)
          .optional(),
      }),
    )
    .max(5),
  confidence,
});
export type ExtractedOrder = z.infer<typeof extractedOrder>;

/** A page may list several orders (e.g. an order-history page); one entry per distinct order. */
export const extractedOrders = z.object({
  orders: z.array(extractedOrder).max(10),
});
export type ExtractedOrders = z.infer<typeof extractedOrders>;

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

/** A page as seen inside the user's own browser (extension). Text is bounded; nothing here is a credential. */
export const pageCapture = z.object({
  url: z.string().url().max(2048),
  title: z.string().max(500).optional(),
  metas: z.record(z.string().max(100), z.string().max(1000)).optional(),
  jsonLd: z.array(z.string().max(50_000)).max(5).optional(),
  text: z.string().max(30_000).optional(),
  /** Images visible on the page, so item pictures can be matched without guessing URLs. */
  images: z
    .array(
      z.object({
        src: z.string().url().max(2048),
        alt: z.string().max(200).optional(),
        /** Text of the nearest enclosing block (item/row), to match a picture to its item. */
        context: z.string().max(300).optional(),
      }),
    )
    .max(40)
    .optional(),
});
export type PageCapture = z.infer<typeof pageCapture>;

export const captureRequest = z.object({
  kind: z.enum(['product', 'order']),
  page: pageCapture,
  /** Visible area of the tab, so highlighted progress-bar steps (visual only) can be read. */
  screenshot: z
    .object({
      imageBase64: z.string().max(3_500_000),
      mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    })
    .optional(),
});
export type CaptureRequest = z.infer<typeof captureRequest>;

export const saveProductRequest = z.object({
  title: z.string().trim().min(1).max(300),
  productUrl: z.string().url().max(2048),
  imageUrl: z.string().url().max(2048).optional(),
  price: z
    .object({ amountMinor: z.number().int().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/) })
    .optional(),
  merchantId: z.string().max(60).optional(),
  /** Which fields were read by the page/AI and left unedited. */
  readFields: z.array(z.enum(['title', 'imageUrl', 'price'])).max(3).optional(),
});
export type SaveProductRequest = z.infer<typeof saveProductRequest>;
