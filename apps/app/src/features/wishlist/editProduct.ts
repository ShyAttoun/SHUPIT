import {
  merchantForUrl,
  normalizeProductUrl,
  parsePriceNumber,
  toMinor,
  fromMinor,
  isHttpUrl,
  type SavedProduct,
} from '@shupit/contracts';

export interface ProductEditValues {
  title: string;
  price: string;
  currency: string;
  imageUrl: string;
  merchantId: string | null;
  productUrl: string;
  note: string;
}

export type ProductEditErrors = Partial<Record<'title' | 'price' | 'imageUrl' | 'productUrl', string>>;

export function valuesFromProduct(p: SavedProduct, fallbackCurrency: string): ProductEditValues {
  return {
    title: p.title,
    price: p.savedPrice ? String(fromMinor(p.savedPrice)) : '',
    currency: p.savedPrice?.currency ?? fallbackCurrency,
    imageUrl: p.imageUrl ?? '',
    merchantId: p.merchantId ?? null,
    productUrl: p.productUrl ?? '',
    note: p.note ?? '',
  };
}

export interface ProductPatch {
  patch: Record<string, unknown>;
  changed: string[];
}

/**
 * Builds a Firestore patch from the edit form. Only changed fields are touched; each changed field gets
 * `user` provenance, and a hand-edited price is no longer marked as verified from the store.
 */
export function buildProductPatch(
  existing: SavedProduct,
  v: ProductEditValues,
  fallbackCurrency: string,
  now = new Date().toISOString(),
): { ok: true; value: ProductPatch } | { ok: false; errors: ProductEditErrors } {
  const errors: ProductEditErrors = {};
  const title = v.title.trim();
  if (!title) errors.title = 'required';

  let price: { amountMinor: number; currency: string } | null = null;
  if (v.price.trim()) {
    const n = parsePriceNumber(v.price);
    const cur = v.currency.trim().toUpperCase();
    if (n === null || !/^[A-Z]{3}$/.test(cur)) errors.price = 'invalidPrice';
    else price = { amountMinor: toMinor(n, cur), currency: cur };
  }
  const imageUrl = v.imageUrl.trim();
  if (imageUrl && !isHttpUrl(imageUrl)) errors.imageUrl = 'invalidUrl';
  const productUrl = v.productUrl.trim();
  if (productUrl && !isHttpUrl(productUrl)) errors.productUrl = 'invalidUrl';
  if (Object.keys(errors).length) return { ok: false, errors };

  const patch: Record<string, unknown> = {};
  const changed: string[] = [];
  const provenance: Record<string, unknown> = { ...(existing.provenance as Record<string, unknown>) };
  const mark = (field: string, provKey = field) => {
    changed.push(field);
    provenance[provKey] = { source: 'user', capturedAt: now };
  };

  if (title !== existing.title) {
    patch.title = title;
    mark('title');
  }

  const prevPrice = existing.savedPrice ?? null;
  const priceChanged =
    (price?.amountMinor ?? null) !== (prevPrice?.amountMinor ?? null) ||
    (price?.currency ?? null) !== (prevPrice?.currency ?? null);
  if (priceChanged) {
    patch.savedPrice = price;
    // A typed price is not a store-verified price.
    patch.priceVerifiedAt = null;
    mark('savedPrice');
  }

  if (imageUrl !== (existing.imageUrl ?? '')) {
    patch.imageUrl = imageUrl || null;
    mark('imageUrl');
  }

  if (productUrl !== (existing.productUrl ?? '')) {
    patch.productUrl = productUrl || null;
    patch.urlKey = (productUrl && normalizeProductUrl(productUrl)) || null;
    mark('productUrl');
  }

  // Merchant: explicit choice wins; otherwise infer from a newly entered URL when none is set.
  let merchantId = v.merchantId;
  if (!merchantId && productUrl) merchantId = merchantForUrl(productUrl)?.id ?? null;
  if (merchantId !== (existing.merchantId ?? null)) {
    patch.merchantId = merchantId;
    mark('merchantId');
  }

  const note = v.note.trim();
  if (note !== (existing.note ?? '')) {
    patch.note = note || null;
    changed.push('note');
  }

  if (changed.length) {
    patch.provenance = provenance;
    patch.updatedAt = now;
  }
  void fallbackCurrency;
  return { ok: true, value: { patch, changed } };
}
