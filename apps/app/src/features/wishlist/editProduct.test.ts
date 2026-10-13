import type { SavedProduct } from '@shupit/contracts';
import { buildProductPatch, valuesFromProduct } from './editProduct';

const NOW = '2026-10-14T10:00:00.000Z';
const base: SavedProduct = {
  id: 'p1',
  title: 'Nike Air',
  productUrl: 'https://www.nike.com/t/air-1',
  urlKey: 'nike.com/t/air-1',
  merchantId: 'nike',
  imageUrl: 'https://cdn.nike.com/a.jpg',
  savedPrice: { amountMinor: 53900, currency: 'ILS' },
  priceVerifiedAt: '2026-10-13T10:00:00.000Z',
  collectionIds: [],
  provenance: {
    title: { source: 'page_metadata', capturedAt: '2026-10-13T10:00:00.000Z' },
    savedPrice: { source: 'page_metadata', capturedAt: '2026-10-13T10:00:00.000Z' },
  },
  createdAt: '2026-10-13T10:00:00.000Z',
  updatedAt: '2026-10-13T10:00:00.000Z',
};

describe('buildProductPatch', () => {
  it('returns no changes when nothing was edited', () => {
    const r = buildProductPatch(base, valuesFromProduct(base, 'ILS'), 'ILS', NOW);
    expect(r.ok && r.value.changed).toEqual([]);
    expect(r.ok && r.value.patch).toEqual({});
  });

  it('marks only edited fields as user-provided and keeps page provenance on the rest', () => {
    const v = { ...valuesFromProduct(base, 'ILS'), title: 'Nike Air Force 1' };
    const r = buildProductPatch(base, v, 'ILS', NOW);
    if (!r.ok) throw new Error('expected ok');
    const prov = r.value.patch.provenance as Record<string, { source: string }>;
    expect(prov.title?.source).toBe('user');
    expect(prov.savedPrice?.source).toBe('page_metadata');
    expect(r.value.patch.priceVerifiedAt).toBeUndefined();
  });

  it('a hand-edited price is no longer marked verified', () => {
    const v = { ...valuesFromProduct(base, 'ILS'), price: '449.00' };
    const r = buildProductPatch(base, v, 'ILS', NOW);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.patch.savedPrice).toEqual({ amountMinor: 44900, currency: 'ILS' });
    expect(r.value.patch.priceVerifiedAt).toBeNull();
    expect((r.value.patch.provenance as Record<string, { source: string }>).savedPrice?.source).toBe('user');
  });

  it('recomputes the duplicate key when the link changes and infers the store', () => {
    const noMerchant = { ...base, merchantId: undefined };
    const v = { ...valuesFromProduct(noMerchant, 'ILS'), productUrl: 'https://www.ksp.co.il/web/item/5?utm_source=x' };
    const r = buildProductPatch(noMerchant, v, 'ILS', NOW);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.patch.urlKey).toBe('ksp.co.il/web/item/5');
    expect(r.value.patch.merchantId).toBe('ksp');
  });

  it('validates required title, price and links', () => {
    const v = { ...valuesFromProduct(base, 'ILS'), title: ' ', price: 'abc', imageUrl: 'nope', productUrl: 'ftp://x' };
    const r = buildProductPatch(base, v, 'ILS', NOW);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(['imageUrl', 'price', 'productUrl', 'title']);
  });

  it('clearing the price removes it', () => {
    const v = { ...valuesFromProduct(base, 'ILS'), price: '' };
    const r = buildProductPatch(base, v, 'ILS', NOW);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.patch.savedPrice).toBeNull();
  });
});
