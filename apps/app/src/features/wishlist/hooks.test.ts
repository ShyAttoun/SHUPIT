import type { SavedProduct } from '@shupit/contracts';
import { buildProduct, findDuplicate } from './hooks';

const NOW = '2026-10-13T10:00:00.000Z';

describe('buildProduct', () => {
  it('marks page-read values as page_metadata and user values as user', () => {
    const p = buildProduct(
      'p1',
      {
        title: ' Lamp ',
        productUrl: 'https://www.ksp.co.il/p/1?utm_source=x',
        savedPrice: { amountMinor: 5000, currency: 'ILS' },
        priceFromPage: true,
        titleFromPage: true,
        collectionIds: [],
      },
      NOW,
    );
    expect(p.title).toBe('Lamp');
    expect(p.urlKey).toBe('ksp.co.il/p/1');
    expect(p.provenance.title?.source).toBe('page_metadata');
    expect(p.provenance.savedPrice?.source).toBe('page_metadata');
    expect(p.priceVerifiedAt).toBe(NOW);
  });

  it('never marks a user-typed price as verified', () => {
    const p = buildProduct(
      'p2',
      { title: 'Chair', savedPrice: { amountMinor: 100, currency: 'USD' }, collectionIds: [] },
      NOW,
    );
    expect(p.provenance.savedPrice?.source).toBe('user');
    expect(p.priceVerifiedAt).toBeUndefined();
  });

  it('omits fields it does not have instead of fabricating them', () => {
    const p = buildProduct('p3', { title: 'Thing', collectionIds: [] }, NOW);
    expect(p.savedPrice).toBeUndefined();
    expect(p.imageUrl).toBeUndefined();
    expect(p.merchantId).toBeUndefined();
  });
});

describe('findDuplicate', () => {
  const existing = buildProduct(
    'e1',
    { title: 'Lamp', productUrl: 'https://shop.example/p/9', collectionIds: [] },
    NOW,
  );
  it('matches the same product regardless of tracking params', () => {
    expect(findDuplicate([existing], 'https://www.shop.example/p/9/?utm_campaign=z')?.id).toBe('e1');
  });
  it('does not match a different product or missing url', () => {
    expect(findDuplicate([existing], 'https://shop.example/p/10')).toBeUndefined();
    expect(findDuplicate([existing], undefined)).toBeUndefined();
    expect(findDuplicate([] as SavedProduct[], 'https://shop.example/p/9')).toBeUndefined();
  });
});
