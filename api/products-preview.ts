import { isHttpUrl, merchantForUrl, normalizeProductUrl } from '@shupit/contracts';
import { fetchPageHtml, parseProductHtml } from './_lib/extract';
import { errorResponse, json, preflight, readJson } from './_lib/http';
import { UnsafeUrlError } from './_lib/ssrf';
import { withAuth } from './_lib/withAuth';

export const OPTIONS = preflight;

/**
 * POST { url } → draft product read from the page's own metadata.
 * Never invents fields: unreadable ones are listed in `missing`.
 */
export const POST = withAuth(async (request) => {
  const body = (await readJson(request)) as { url?: unknown };
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url || url.length > 2048 || !isHttpUrl(url)) {
    return errorResponse(400, 'invalid_url', 'A valid http(s) URL is required');
  }

  try {
    const { html, finalUrl } = await fetchPageHtml(url);
    const draft = parseProductHtml(html, finalUrl);
    return json({ draft, urlKey: normalizeProductUrl(draft.canonicalUrl) }, 200, {}, request);
  } catch (e) {
    if (e instanceof UnsafeUrlError) return errorResponse(400, 'unsafe_url', 'This URL cannot be fetched');
    // Page blocked us or is not readable: fall back to a bare draft so the user can enter details.
    const merchant = merchantForUrl(url);
    return json(
      {
        draft: { canonicalUrl: url, merchantId: merchant?.id, missing: ['title', 'imageUrl', 'price'] },
        urlKey: normalizeProductUrl(url),
        unreadable: true,
      },
      200,
      {},
      request,
    );
  }
});
