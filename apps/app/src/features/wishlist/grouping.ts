import { getMerchant, hostOf, merchantForUrl, type SavedProduct } from '@shupit/contracts';

export interface BrandSite {
  /** Host of the product pages (e.g. "nike.com"); null when the product has no link. */
  host: string | null;
  items: SavedProduct[];
}

export interface BrandGroup {
  key: string;
  merchantId: string | null;
  /** Display name; null → the UI shows "Other stores". */
  name: string | null;
  /** Domain used for the brand icon. */
  domain: string | null;
  /** More than one entry means the brand's products come from different sites. */
  sites: BrandSite[];
  count: number;
}

/**
 * Groups saved products under their brand. A brand is the known merchant (explicit or inferred
 * from the link) or, for unknown stores, the site itself. Inside a brand, products from different
 * sites are kept apart.
 */
export function groupByBrand(products: SavedProduct[]): BrandGroup[] {
  const groups = new Map<string, { group: Omit<BrandGroup, 'sites' | 'count'>; sites: Map<string, BrandSite> }>();

  for (const p of products) {
    const host = p.productUrl ? hostOf(p.productUrl) : null;
    const merchant = getMerchant(p.merchantId) ?? (p.productUrl ? merchantForUrl(p.productUrl) : undefined);

    const key = merchant ? `m:${merchant.id}` : host ? `h:${host}` : 'other';
    let entry = groups.get(key);
    if (!entry) {
      entry = {
        group: {
          key,
          merchantId: merchant?.id ?? null,
          name: merchant?.name ?? host ?? null,
          domain: merchant?.domains[0] ?? host ?? null,
        },
        sites: new Map(),
      };
      groups.set(key, entry);
    }
    const siteKey = host ?? '';
    const site = entry.sites.get(siteKey) ?? { host, items: [] };
    site.items.push(p);
    entry.sites.set(siteKey, site);
  }

  const byNewest = (a: SavedProduct, b: SavedProduct) => b.createdAt.localeCompare(a.createdAt);
  return [...groups.values()]
    .map(({ group, sites }) => {
      const siteList = [...sites.values()]
        .map((s) => ({ ...s, items: [...s.items].sort(byNewest) }))
        .sort((a, b) => (a.host === null ? 1 : b.host === null ? -1 : b.items.length - a.items.length || a.host.localeCompare(b.host)));
      return { ...group, sites: siteList, count: siteList.reduce((n, s) => n + s.items.length, 0) };
    })
    .sort((a, b) => {
      if (a.key === 'other') return 1;
      if (b.key === 'other') return -1;
      return b.count - a.count || (a.name ?? '').localeCompare(b.name ?? '');
    });
}
