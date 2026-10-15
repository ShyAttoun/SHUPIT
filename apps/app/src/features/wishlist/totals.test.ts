import { basketTotals, compareLinks } from './totals';

const p = (amountMinor?: number, currency = 'ILS') => ({ savedPrice: amountMinor === undefined ? undefined : { amountMinor, currency } });

describe('basketTotals', () => {
  it('sums per currency and counts items without a price', () => {
    const t = basketTotals([p(1000), p(2550), p(999, 'USD'), p(undefined)]);
    expect(t.byCurrency).toEqual([
      { currency: 'ILS', amountMinor: 3550 },
      { currency: 'USD', amountMinor: 999 },
    ]);
    expect(t.priced).toBe(3);
    expect(t.unpriced).toBe(1);
  });
  it('is empty for an empty list', () => {
    expect(basketTotals([])).toEqual({ byCurrency: [], priced: 0, unpriced: 0 });
  });
});

describe('compareLinks', () => {
  it('encodes the title and adds the Israeli site only in Hebrew', () => {
    const he = compareLinks('Air Force 1 & more', 'he');
    expect(he.map((l) => l.id)).toEqual(['google', 'zap']);
    expect(he[0]!.url).toContain('Air%20Force%201%20%26%20more');
    expect(compareLinks('x', 'en').map((l) => l.id)).toEqual(['google']);
  });
});
