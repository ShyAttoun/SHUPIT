import type { Merchant } from './merchant';
import { hostOf } from './url';

/**
 * Launch merchant registry. No affiliate program or price provider is
 * configured for any merchant yet: every route resolves to the original site
 * and no automatic price monitoring is claimed. Add `affiliateProgramId` /
 * `priceProviderId` only once an approved program / authorized source exists.
 */
const m = (
  id: string,
  name: string,
  domains: string[],
  homepageUrl: string,
  country?: string,
): Merchant => ({
  id,
  name,
  domains,
  homepageUrl,
  country,
  routing: ['web'],
  active: true,
});

export const merchantCatalog: readonly Merchant[] = [
  m('amazon', 'Amazon', ['amazon.com', 'amazon.co.uk', 'amazon.de'], 'https://www.amazon.com'),
  m('aliexpress', 'AliExpress', ['aliexpress.com'], 'https://www.aliexpress.com'),
  m('shein', 'SHEIN', ['shein.com', 'il.shein.com'], 'https://il.shein.com', 'IL'),
  m('temu', 'Temu', ['temu.com'], 'https://www.temu.com'),
  m('ebay', 'eBay', ['ebay.com'], 'https://www.ebay.com'),
  m('etsy', 'Etsy', ['etsy.com'], 'https://www.etsy.com'),
  m('iherb', 'iHerb', ['iherb.com'], 'https://il.iherb.com'),
  m('asos', 'ASOS', ['asos.com'], 'https://www.asos.com'),
  m('zara', 'Zara', ['zara.com'], 'https://www.zara.com'),
  m('hm', 'H&M', ['hm.com'], 'https://www2.hm.com'),
  m('nike', 'Nike', ['nike.com'], 'https://www.nike.com'),
  m('adidas', 'Adidas', ['adidas.com'], 'https://www.adidas.com'),
  m('ikea', 'IKEA', ['ikea.com'], 'https://www.ikea.com'),
  m('apple', 'Apple', ['apple.com'], 'https://www.apple.com'),
  m('ksp', 'KSP', ['ksp.co.il'], 'https://ksp.co.il', 'IL'),
  m('ivory', 'Ivory', ['ivory.co.il'], 'https://www.ivory.co.il', 'IL'),
  m('terminalx', 'TERMINAL X', ['terminalx.com'], 'https://www.terminalx.com', 'IL'),
  m('castro', 'Castro', ['castro.com'], 'https://www.castro.com', 'IL'),
  m('fox', 'FOX', ['fox.co.il'], 'https://www.fox.co.il', 'IL'),
  m('superpharm', 'Super-Pharm', ['super-pharm.co.il'], 'https://shop.super-pharm.co.il', 'IL'),
  m('zer4u', 'Zer4U', ['zer4u.co.il'], 'https://www.zer4u.co.il', 'IL'),
];

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
