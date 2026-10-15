import type { Merchant } from './merchant';
import { hostOf } from './url';

/**
 * Launch merchant registry. No affiliate program or price provider is
 * configured for any merchant yet: every route resolves to the original site
 * and no automatic price monitoring is claimed. Add `affiliateProgramId` /
 * `priceProviderId` only once an approved program / authorized source exists.
 */
type Category = NonNullable<Merchant['category']>;

const m = (
  id: string,
  name: string,
  domains: string[],
  homepageUrl: string,
  country?: string,
  extra: { category?: Category; aliases?: string[] } = {},
): Merchant => ({
  id,
  name,
  domains,
  homepageUrl,
  country,
  routing: ['web'],
  active: true,
  market: country === 'IL' ? 'il' : 'global',
  ...extra,
});

/** A merchant added in the catalog expansion: web routing only, no affiliate program, no claims. */
const n = (
  id: string,
  name: string,
  domain: string,
  category: Category,
  opts: { il?: boolean; homepage?: string; aliases?: string[] } = {},
): Merchant => ({
  ...m(id, name, [domain], opts.homepage ?? `https://www.${domain}`, opts.il ? 'IL' : undefined, {
    category,
    ...(opts.aliases ? { aliases: opts.aliases } : {}),
  }),
  affiliateProgramId: null,
});

/** "My orders" pages checked to exist (they redirect to sign-in when logged out). */
const ORDERS_URL: Record<string, string> = {
  amazon: 'https://www.amazon.com/gp/css/order-history',
  ebay: 'https://www.ebay.com/mye/myebay/purchase',
  etsy: 'https://www.etsy.com/your/purchases',
  aliexpress: 'https://www.aliexpress.com/p/order/index.html',
  temu: 'https://www.temu.com/bgt_orders.html',
  shein: 'https://il.shein.com/user/orders/list',
  asos: 'https://my.asos.com/my-account/orders',
  nike: 'https://www.nike.com/orders',
  ikea: 'https://www.ikea.com/il/he/profile/orders/',
};

const baseCatalog: readonly Merchant[] = [
  m('amazon', 'Amazon', ['amazon.com', 'amazon.co.uk', 'amazon.de'], 'https://www.amazon.com', undefined, { category: 'general' }),
  m('aliexpress', 'AliExpress', ['aliexpress.com'], 'https://www.aliexpress.com', undefined, { category: 'general' }),
  m('shein', 'SHEIN', ['shein.com', 'il.shein.com'], 'https://il.shein.com', 'IL', { category: 'fashion' }),
  m('temu', 'Temu', ['temu.com'], 'https://www.temu.com', undefined, { category: 'general' }),
  m('ebay', 'eBay', ['ebay.com'], 'https://www.ebay.com', undefined, { category: 'general' }),
  m('etsy', 'Etsy', ['etsy.com'], 'https://www.etsy.com', undefined, { category: 'general' }),
  m('iherb', 'iHerb', ['iherb.com'], 'https://il.iherb.com', undefined, { category: 'health' }),
  m('asos', 'ASOS', ['asos.com'], 'https://www.asos.com', undefined, { category: 'fashion' }),
  m('zara', 'Zara', ['zara.com'], 'https://www.zara.com', undefined, { category: 'fashion' }),
  m('hm', 'H&M', ['hm.com'], 'https://www2.hm.com', undefined, { category: 'fashion' }),
  m('nike', 'Nike', ['nike.com'], 'https://www.nike.com', undefined, { category: 'sports' }),
  m('adidas', 'Adidas', ['adidas.com'], 'https://www.adidas.com', undefined, { category: 'sports' }),
  m('ikea', 'IKEA', ['ikea.com'], 'https://www.ikea.com', undefined, { category: 'home' }),
  m('apple', 'Apple', ['apple.com'], 'https://www.apple.com', undefined, { category: 'electronics' }),
  m('ksp', 'KSP', ['ksp.co.il'], 'https://ksp.co.il', 'IL', { category: 'electronics', aliases: ["קיי אס פי", "קי אס פי"] }),
  m('ivory', 'Ivory', ['ivory.co.il'], 'https://www.ivory.co.il', 'IL', { category: 'electronics', aliases: ["איבורי"] }),
  m('terminalx', 'TERMINAL X', ['terminalx.com'], 'https://www.terminalx.com', 'IL', { category: 'fashion', aliases: ["טרמינל איקס", "טרמינל"] }),
  m('castro', 'Castro', ['castro.com'], 'https://www.castro.com', 'IL', { category: 'fashion', aliases: ["קסטרו"] }),
  m('fox', 'FOX', ['fox.co.il'], 'https://www.fox.co.il', 'IL', { category: 'fashion', aliases: ["פוקס"] }),
  m('superpharm', 'Super-Pharm', ['super-pharm.co.il'], 'https://shop.super-pharm.co.il', 'IL', { category: 'health', aliases: ["סופר-פארם", "סופר פארם"] }),
  m('zer4u', 'Zer4U', ['zer4u.co.il'], 'https://www.zer4u.co.il', 'IL', { category: 'general', aliases: ["זר4יו"] }),
  // ── Catalog expansion: web routing only, affiliateProgramId null. No shipping-to-Israel claims. ──
  n('payngo', 'מחסני חשמל', 'payngo.co.il', 'appliances', { il: true, aliases: ["Pay N Go", "פיי אן גו", "מחסני חשמל"] }),
  n('bug', 'BUG', 'bug.co.il', 'electronics', { il: true, aliases: ["באג"] }),
  n('lastprice', 'LastPrice', 'lastprice.co.il', 'general', { il: true, aliases: ["לאסט פרייס", "לאסטפרייס"] }),
  n('ace', 'ACE', 'ace.co.il', 'home', { il: true, aliases: ["אייס"] }),
  n('homecenter', 'Home Center', 'homecenter.co.il', 'home', { il: true, aliases: ["הום סנטר"] }),
  n('renuar', 'Renuar', 'renuar.co.il', 'fashion', { il: true, aliases: ["רנואר"] }),
  n('golf', 'Golf', 'golfco.co.il', 'fashion', { il: true, aliases: ["גולף"] }),
  n('delta', 'Delta', 'delta.co.il', 'fashion', { il: true, aliases: ["דלתא"] }),
  n('shilav', 'Shilav', 'shilav.co.il', 'baby', { il: true, aliases: ["שילב"] }),
  n('motsesim', 'Motsesim', 'motsesim.co.il', 'baby', { il: true, aliases: ["מוצצים"] }),
  n('steimatzky', 'Steimatzky', 'steimatzky.co.il', 'books', { il: true, aliases: ["סטימצקי"] }),
  n('tzometsfarim', 'Tzomet Sfarim', 'booknet.co.il', 'books', { il: true, aliases: ["צומת ספרים"] }),
  n('laline', 'Laline', 'laline.co.il', 'beauty', { il: true, aliases: ["לאלין"] }),
  n('sacara', 'SACARA', 'sacara.co.il', 'beauty', { il: true }),
  n('naaman', 'Naaman', 'naamanp.co.il', 'home', { il: true, aliases: ["נעמן"] }),
  n('vardinon', 'Vardinon', 'vardinon.co.il', 'home', { il: true, aliases: ["ורדינון"] }),
  n('lookfantastic', 'LOOKFANTASTIC', 'lookfantastic.com', 'beauty'),
  n('myprotein', 'Myprotein', 'myprotein.com', 'sports'),
  n('cultbeauty', 'Cult Beauty', 'cultbeauty.com', 'beauty'),
  n('sephora', 'Sephora', 'sephora.com', 'beauty'),
  n('crocs', 'Crocs', 'crocs.com', 'fashion'),
  n('underarmour', 'Under Armour', 'underarmour.com', 'sports'),
  n('footlocker', 'Foot Locker', 'footlocker.com', 'sports'),
  n('jdsports', 'JD Sports', 'jdsports.com', 'sports'),
  n('lenovo', 'Lenovo', 'lenovo.com', 'electronics'),
  n('dell', 'Dell', 'dell.com', 'electronics'),
  n('samsung', 'Samsung', 'samsung.com', 'electronics'),
  n('bhphoto', 'B&H Photo', 'bhphotovideo.com', 'electronics'),
  n('newbalance', 'New Balance', 'newbalance.com', 'sports'),
  n('thenorthface', 'The North Face', 'thenorthface.com', 'sports'),
  n('next', 'NEXT', 'next.co.uk', 'fashion'),
  n('uniqlo', 'UNIQLO', 'uniqlo.com', 'fashion'),
  n('mango', 'Mango', 'mango.com', 'fashion', { homepage: 'https://shop.mango.com' }),
  n('stradivarius', 'Stradivarius', 'stradivarius.com', 'fashion'),
  n('bershka', 'Bershka', 'bershka.com', 'fashion'),
  n('decathlon', 'Decathlon', 'decathlon.com', 'sports'),
  n('lego', 'LEGO', 'lego.com', 'toys'),
  n('walmart', 'Walmart', 'walmart.com', 'general'),
  n('target', 'Target', 'target.com', 'general'),
  n('wayfair', 'Wayfair', 'wayfair.com', 'home'),
];

export const merchantCatalog: readonly Merchant[] = baseCatalog.map((x) =>
  ORDERS_URL[x.id] ? { ...x, ordersUrl: ORDERS_URL[x.id] } : x,
);

export function getMerchant(id: string | undefined): Merchant | undefined {
  return id ? merchantCatalog.find((x) => x.id === id) : undefined;
}

/** Finds the catalog merchant whose domain matches the URL host (or a subdomain). */
export function merchantForUrl(url: string): Merchant | undefined {
  const host = hostOf(url);
  if (!host) return undefined;
  return merchantCatalog.find((x) =>
    x.domains.some((d) => host === d || host.endsWith(`.${d}`)),
  );
}

/** True when the typed query matches the merchant's name, id, domain or an alias (e.g. the Hebrew name). */
export function merchantMatchesQuery(merchant: Merchant, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    merchant.name.toLowerCase().includes(q) ||
    merchant.id.includes(q) ||
    merchant.domains.some((d) => d.includes(q)) ||
    (merchant.aliases ?? []).some((a) => a.toLowerCase().includes(q))
  );
}

/** Catalog order for pickers: Israeli stores first in Hebrew, otherwise the catalog's own order. */
export function merchantsForPicker(language: 'he' | 'en'): readonly Merchant[] {
  if (language !== 'he') return merchantCatalog;
  return [...merchantCatalog.filter((x) => x.market === 'il'), ...merchantCatalog.filter((x) => x.market !== 'il')];
}

/** Case-insensitive exact name match against the catalog (e.g. "ksp" → KSP). */
export function merchantByName(name: string | null | undefined): Merchant | undefined {
  const n = name?.trim().toLowerCase();
  if (!n) return undefined;
  return merchantCatalog.find((x) => x.name.toLowerCase() === n || x.id === n);
}

/** Icon URL for a merchant domain (Google favicon service; sizes vary, UI falls back to a monogram). */
export function merchantLogoUrl(domain: string, size = 128): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}
