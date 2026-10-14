import type { SavedProduct } from '@shupit/contracts';
import { groupByBrand } from './grouping';

const p = (id: string, over: Partial<SavedProduct>): SavedProduct => ({
  id,
  title: id,
  collectionIds: [],
  provenance: {},
  createdAt: `2026-10-0${id.length}T10:00:00.000Z`,
  updatedAt: '2026-10-01T10:00:00.000Z',
  ...over,
});

describe('groupByBrand', () => {
  it('puts all products of one merchant under one brand, newest first', () => {
    const groups = groupByBrand([
      p('a', { merchantId: 'nike', productUrl: 'https://www.nike.com/t/a', createdAt: '2026-10-01T00:00:00Z' }),
      p('bb', { merchantId: 'nike', productUrl: 'https://www.nike.com/t/b', createdAt: '2026-10-03T00:00:00Z' }),
      p('c', { merchantId: 'ksp', productUrl: 'https://ksp.co.il/web/item/1' }),
    ]);
    const nike = groups.find((g) => g.merchantId === 'nike')!;
    expect(nike.name).toBe('Nike');
    expect(nike.count).toBe(2);
    expect(nike.sites).toHaveLength(1);
    expect(nike.sites[0]!.items.map((i) => i.id)).toEqual(['bb', 'a']);
    expect(groups[0]!.merchantId).toBe('nike'); // largest brand first
  });

  it('keeps products from different sites of the same brand apart', () => {
    const groups = groupByBrand([
      p('a', { merchantId: 'nike', productUrl: 'https://www.nike.com/t/a' }),
      p('bb', { merchantId: 'nike', productUrl: 'https://www.nike.com/t/b' }),
      p('c', { merchantId: 'nike', productUrl: 'https://outlet.nike.com/t/c' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.sites.map((s) => [s.host, s.items.length])).toEqual([
      ['nike.com', 2],
      ['outlet.nike.com', 1],
    ]);
  });

  it('infers the brand from the link when the merchant was not set', () => {
    const g = groupByBrand([p('a', { productUrl: 'https://www.ksp.co.il/web/item/9' })]);
    expect(g[0]!.merchantId).toBe('ksp');
    expect(g[0]!.name).toBe('KSP');
  });

  it('uses the site for unknown stores and "other" for products without a link, last', () => {
    const g = groupByBrand([
      p('a', { productUrl: 'https://shop.example/p/1' }),
      p('b', {}),
      p('c', { productUrl: 'https://shop.example/p/2' }),
    ]);
    expect(g.map((x) => x.name)).toEqual(['shop.example', null]);
    expect(g[0]!.count).toBe(2);
    expect(g[1]!.key).toBe('other');
  });
});
