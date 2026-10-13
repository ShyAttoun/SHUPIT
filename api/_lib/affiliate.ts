import { hostOf, type GoResponse, type Merchant } from '@shupit/contracts';

export interface AffiliateProgram {
  id: string;
  /** Only `approved` programs may ever be used for redirects. */
  status: 'approved' | 'pending' | 'suspended';
  /** Must contain {url} (URL-encoded destination). */
  urlTemplate: string;
  disclosure: string;
}

/**
 * Registry of verified affiliate programs. Intentionally empty: no program is
 * approved yet, so every redirect falls back to the original merchant URL.
 */
export const affiliatePrograms: Record<string, AffiliateProgram> = {};

export function resolveDestination(
  merchant: Merchant,
  productUrl: string | undefined,
  programs: Record<string, AffiliateProgram> = affiliatePrograms,
): GoResponse {
  const target = productUrl ?? merchant.homepageUrl;
  const program = merchant.affiliateProgramId ? programs[merchant.affiliateProgramId] : undefined;

  if (program && program.status === 'approved' && program.urlTemplate.includes('{url}')) {
    return {
      url: program.urlTemplate.replace('{url}', encodeURIComponent(target)),
      kind: 'affiliate',
      disclosure: program.disclosure,
    };
  }
  return { url: target, kind: 'web' };
}

/** A product URL may only be routed for the merchant that owns its domain. */
export function urlBelongsToMerchant(merchant: Merchant, url: string): boolean {
  const host = hostOf(url);
  return !!host && merchant.domains.some((d) => host === d || host.endsWith(`.${d}`));
}
