import type { Money, SavedProduct } from '@shupit/contracts';

export interface BasketTotals {
  /** One sum per currency — different currencies are never added together. */
  byCurrency: Money[];
  priced: number;
  unpriced: number;
}

/** Sum of the saved prices (what was saved, not live prices). */
export function basketTotals(products: Pick<SavedProduct, 'savedPrice'>[]): BasketTotals {
  const sums = new Map<string, number>();
  let priced = 0;
  for (const p of products) {
    const price = p.savedPrice;
    if (!price) continue;
    priced++;
    sums.set(price.currency, (sums.get(price.currency) ?? 0) + price.amountMinor);
  }
  return {
    byCurrency: [...sums.entries()].map(([currency, amountMinor]) => ({ currency, amountMinor })),
    priced,
    unpriced: products.length - priced,
  };
}

const q = (title: string) => encodeURIComponent(title.trim().slice(0, 120));

/** Search links on price-comparison sites. We only open the search; the prices shown there are theirs. */
export function compareLinks(title: string, language: 'he' | 'en'): { id: string; url: string }[] {
  const links = [{ id: 'google', url: `https://www.google.com/search?tbm=shop&q=${q(title)}` }];
  if (language === 'he') links.push({ id: 'zap', url: `https://www.zap.co.il/search.aspx?keyword=${q(title)}` });
  return links;
}
