import { z } from 'zod';

/** ISO-8601 timestamp. Firestore Timestamps are converted at the data layer. */
export const isoDate = z.string().datetime({ offset: true });

export const currencyCode = z.string().regex(/^[A-Z]{3}$/, 'ISO 4217 code');

/** Amount in minor units (e.g. agorot / cents) to avoid float drift. */
export const money = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency: currencyCode,
});
export type Money = z.infer<typeof money>;

export const locale = z.enum(['he', 'en']);
export type Locale = z.infer<typeof locale>;

/** Where a field value came from. Never present AI/guessed data as verified. */
export const provenanceSource = z.enum([
  'user',
  'page_metadata',
  'extension',
  'ai_vision',
  'email',
  'merchant_api',
  'affiliate_feed',
  'carrier',
]);
export type ProvenanceSource = z.infer<typeof provenanceSource>;

export const fieldProvenance = z.object({
  source: provenanceSource,
  capturedAt: isoDate,
  /** 0..1, present for AI-derived values. */
  confidence: z.number().min(0).max(1).optional(),
});
export type FieldProvenance = z.infer<typeof fieldProvenance>;
