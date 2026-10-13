import { merchantForUrl, normalizeProductUrl, parsePriceNumber, toMinor, type ProductDraft } from '@shupit/contracts';
import { assertPublicHttpUrl } from './ssrf';

const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-\w:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    out[m[1]!.toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? '');
  }
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function metaMap(html: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = (a.property ?? a.name ?? a.itemprop)?.toLowerCase();
    if (key && a.content && !(key in map)) map[key] = a.content;
  }
  return map;
}

type Json = unknown;

function* walk(node: Json): Generator<Record<string, Json>> {
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n);
  } else if (node && typeof node === 'object') {
    const o = node as Record<string, Json>;
    yield o;
    for (const v of Object.values(o)) yield* walk(v);
  }
}

function isProduct(o: Record<string, Json>): boolean {
  const t = o['@type'];
  return Array.isArray(t) ? t.includes('Product') : t === 'Product';
}

function firstString(v: Json): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return firstString(v[0]);
  if (v && typeof v === 'object') return firstString((v as Record<string, Json>).url);
  return undefined;
}

function jsonLdProduct(
  html: string,
): { title?: string; image?: string; price?: string | number; currency?: string; variant?: string } | null {
  for (const m of html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: Json;
    try {
      data = JSON.parse(m[1]!.trim());
    } catch {
      continue;
    }
    for (const o of walk(data)) {
      if (!isProduct(o)) continue;
      const offers = Array.isArray(o.offers) ? o.offers[0] : o.offers;
      const off = (offers && typeof offers === 'object' ? offers : {}) as Record<string, Json>;
      const spec = (off.priceSpecification && typeof off.priceSpecification === 'object'
        ? off.priceSpecification
        : {}) as Record<string, Json>;
      const price = off.price ?? off.lowPrice ?? spec.price;
      const currency = off.priceCurrency ?? spec.priceCurrency;
      const part = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined);
      const variant = [part(o.sku) ?? part(off.sku), part(o.color), part(o.size)].filter(Boolean).join('|');
      return {
        title: typeof o.name === 'string' ? o.name : undefined,
        variant: variant || undefined,
        image: firstString(o.image),
        price: typeof price === 'string' || typeof price === 'number' ? price : undefined,
        currency: typeof currency === 'string' ? currency : undefined,
      };
    }
  }
  return null;
}

function absoluteUrl(candidate: string | undefined, base: string): string | undefined {
  if (!candidate) return undefined;
  try {
    const u = new URL(candidate, base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Pure: reads only what the page itself declares (JSON-LD, Open Graph, product
 * meta). Anything absent is reported in `missing`; nothing is inferred.
 */
export function parseProductHtml(html: string, pageUrl: string): ProductDraft {
  const meta = metaMap(html);
  const ld = jsonLdProduct(html);

  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const title = (ld?.title ?? meta['og:title'] ?? meta['twitter:title'] ?? titleTag)
    ?.replace(/\s+/g, ' ')
    .trim();
  const imageUrl = absoluteUrl(ld?.image ?? meta['og:image'] ?? meta['twitter:image'], pageUrl);

  const rawPrice = ld?.price ?? meta['product:price:amount'] ?? meta['og:price:amount'];
  const rawCurrency = (ld?.currency ?? meta['product:price:currency'] ?? meta['og:price:currency'])
    ?.toUpperCase()
    .trim();
  let price: ProductDraft['price'];
  if (rawPrice !== undefined && rawCurrency && /^[A-Z]{3}$/.test(rawCurrency)) {
    const n = parsePriceNumber(rawPrice);
    if (n !== null) price = { amountMinor: toMinor(n, rawCurrency), currency: rawCurrency };
  }

  const canonical = absoluteUrl(meta['og:url'], pageUrl);
  const merchant = merchantForUrl(pageUrl);
  const missing: ProductDraft['missing'] = [];
  if (!title) missing.push('title');
  if (!imageUrl) missing.push('imageUrl');
  if (!price) missing.push('price');

  return {
    // Trust the page's canonical URL only if it stays on the same merchant domain.
    canonicalUrl:
      canonical && merchantForUrl(canonical)?.id === merchant?.id && normalizeProductUrl(canonical)
        ? canonical
        : pageUrl,
    merchantId: merchant?.id,
    title: title ? title.slice(0, 300) : undefined,
    imageUrl,
    price,
    ...(ld?.variant ? { variant: ld.variant.slice(0, 120) } : {}),
    missing,
  };
}

export class FetchPageError extends Error {}

/** SSRF-guarded fetch with redirect re-validation, size and time limits. */
export async function fetchPageHtml(
  rawUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ html: string; finalUrl: string }> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicHttpUrl(current);
    const res = await fetchImpl(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'user-agent': 'SHUPITBot/0.1 (+https://shupit.vercel.app)',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new FetchPageError('redirect without location');
      current = new URL(loc, url).toString();
      continue;
    }
    if (!res.ok) throw new FetchPageError(`status ${res.status}`);
    const type = res.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml/i.test(type)) throw new FetchPageError('not html');
    const reader = res.body?.getReader();
    if (!reader) throw new FetchPageError('no body');
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
    void reader.cancel().catch(() => {});
    return { html: Buffer.concat(chunks).toString('utf8').slice(0, MAX_BYTES), finalUrl: url.toString() };
  }
  throw new FetchPageError('too many redirects');
}
