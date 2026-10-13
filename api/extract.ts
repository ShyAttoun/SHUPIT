import { extractRequest, merchantByName, merchantForUrl } from '@shupit/contracts';
import { fetchPageHtml } from './_lib/extract';
import { errorResponse, json, preflight, readJson } from './_lib/http';
import { UnsafeUrlError } from './_lib/ssrf';
import { consumeAiQuota } from './_lib/usage';
import {
  ExtractionFailedError,
  NotConfiguredError,
  extractOrders,
  extractProduct,
} from './_lib/vision';
import { withAuth } from './_lib/withAuth';

export const OPTIONS = preflight;

/** Visible text of an HTML page (scripts/styles removed), capped to keep the call small. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20_000);
}

/**
 * POST { kind: 'order'|'product', imageBase64+mediaType | url }
 * → AI-read draft. Images are processed in memory and never stored or logged.
 */
export const POST = withAuth(async (request, user) => {
  const parsed = extractRequest.safeParse(await readJson(request, 4_400_000));
  if (!parsed.success) return errorResponse(400, 'bad_request', 'Invalid request');
  const { kind, imageBase64, mediaType, url } = parsed.data;

  if (!process.env.ANTHROPIC_API_KEY) {
    return errorResponse(503, 'not_configured', 'AI extraction is not configured yet');
  }
  if (!(await consumeAiQuota(user.uid))) {
    return errorResponse(429, 'quota_exceeded', 'Daily extraction limit reached');
  }

  try {
    let input: Parameters<typeof extractOrders>[0];
    if (imageBase64 && mediaType) {
      input = { image: { base64: imageBase64, mediaType } };
    } else {
      const { html } = await fetchPageHtml(url!);
      const text = htmlToText(html);
      if (text.length < 40) return errorResponse(422, 'unreadable', 'The page has no readable content');
      input = { text };
    }

    if (kind === 'order') {
      const result = await extractOrders(input);
      const found = result.orders.filter((o) => o.isOrderScreenshot);
      if (found.length === 0) return errorResponse(422, 'not_an_order', 'No order found');
      const orders = found.map((data) => {
        const m = merchantByName(data.merchantName) ?? (url ? merchantForUrl(url) : undefined);
        return { data, merchantId: m?.id ?? null };
      });
      return json(
        { kind, orders, data: orders[0]!.data, merchantId: orders[0]!.merchantId },
        200,
        {},
        request,
      );
    }
    const data = await extractProduct(input);
    if (!data.isProductPage) return errorResponse(422, 'not_a_product', 'No product found');
    const merchant = merchantByName(data.merchantName) ?? (url ? merchantForUrl(url) : undefined);
    return json({ kind, data, merchantId: merchant?.id ?? null }, 200, {}, request);
  } catch (e) {
    if (e instanceof NotConfiguredError) {
      return errorResponse(503, 'not_configured', 'AI extraction is not configured yet');
    }
    if (e instanceof UnsafeUrlError) return errorResponse(400, 'unsafe_url', 'This URL cannot be fetched');
    if (e instanceof ExtractionFailedError) return errorResponse(422, 'extraction_failed', 'Could not read this');
    // Fetch/network errors on link mode: the site blocked us.
    if (url && !imageBase64) return errorResponse(422, 'unreadable', 'The page could not be read');
    throw e;
  }
});
