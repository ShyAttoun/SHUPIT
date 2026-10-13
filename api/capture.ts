import { captureRequest, merchantByName, merchantForUrl, normalizeProductUrl, fromMinor } from '@shupit/contracts';
import { htmlFromCapture } from './_lib/page';
import { sanitizeItemImages } from './_lib/orderEnrich';
import { parseProductHtml } from './_lib/extract';
import { errorResponse, json, preflight, readJson } from './_lib/http';
import { consumeAiQuota } from './_lib/usage';
import { ExtractionFailedError, NotConfiguredError, extractOrders, extractProduct } from './_lib/vision';
import { withAuth } from './_lib/withAuth';
import { AI_RULE } from './_lib/rateLimit';
import { hasAiConsent } from './_lib/consent';
import { adminDb } from './_lib/firebaseAdmin';

export const OPTIONS = preflight;

/**
 * POST { kind, page } → preview for the extension.
 * Product: structured data first (free); AI reads the visible text only for what is still missing.
 * Order: AI reads the visible text (the user is logged in, so this is the page they see).
 */
export const POST = withAuth(async (request, user) => {
  const parsed = captureRequest.safeParse(await readJson(request, 4_400_000));
  if (!parsed.success) return errorResponse(400, 'bad_request', 'Invalid request');
  const { kind, page, screenshot } = parsed.data;
  const merchant = merchantForUrl(page.url);

  if (kind === 'product') {
    const draft = parseProductHtml(htmlFromCapture(page), page.url);
    let { title, price } = draft;
    let usedAi = false;

    if (
      (!title || !price) &&
      page.text &&
      page.text.length >= 40 &&
      process.env.ANTHROPIC_API_KEY &&
      (await hasAiConsent(adminDb(), user.uid))
    ) {
      if (await consumeAiQuota(user.uid)) {
        try {
          const ai = await extractProduct({ text: page.text });
          if (ai.isProductPage) {
            usedAi = true;
            title = title ?? ai.title ?? undefined;
            if (!price && ai.price) {
              // AI-read price: caller shows it as "please confirm".
              const exp = ai.price.currency === 'JPY' ? 0 : 2;
              price = { amountMinor: Math.round(ai.price.amount * 10 ** exp), currency: ai.price.currency };
            }
          }
        } catch (e) {
          if (!(e instanceof ExtractionFailedError) && !(e instanceof NotConfiguredError)) throw e;
        }
      }
    }
    if (!title) return errorResponse(422, 'not_a_product', 'No product found on this page');

    return json(
      {
        kind,
        data: {
          title,
          imageUrl: draft.imageUrl ?? null,
          price: price ?? null,
          priceDisplay: price ? fromMinor(price) : null,
          merchantId: merchant?.id ?? null,
          canonicalUrl: draft.canonicalUrl,
          urlKey: normalizeProductUrl(draft.canonicalUrl),
          // Fields not taken straight from the page's own structured data:
          aiFields: usedAi ? [!draft.title && title ? 'title' : null, !draft.price && price ? 'price' : null].filter(Boolean) : [],
        },
      },
      200,
      {},
      request,
    );
  }

  // order
  if (!process.env.ANTHROPIC_API_KEY) return errorResponse(503, 'not_configured', 'AI extraction is not configured yet');
  if (!(await hasAiConsent(adminDb(), user.uid))) {
    return errorResponse(403, 'consent_required', 'AI processing consent is required');
  }
  const text = (page.text ?? '').trim();
  if (text.length < 40) return errorResponse(422, 'unreadable', 'The page has no readable content');
  if (!(await consumeAiQuota(user.uid))) return errorResponse(429, 'quota_exceeded', 'Daily extraction limit reached');
  try {
    const result = await extractOrders({
      text,
      images: page.images,
      ...(screenshot ? { screenshot: { base64: screenshot.imageBase64, mediaType: screenshot.mediaType } } : {}),
    });
    const found = result.orders.filter((o) => o.isOrderScreenshot);
    if (found.length === 0) return errorResponse(422, 'not_an_order', 'No order found');
    const allowed = page.images?.map((i) => i.src);
    const orders = found.map((data) => {
      // Item pictures may only be URLs that really exist on the page.
      data.items = sanitizeItemImages(data.items, allowed);
      const m = merchantByName(data.merchantName) ?? merchant;
      return { data, merchantId: m?.id ?? null };
    });
    // `data`/`merchantId` = first order, kept for older clients.
    return json({ kind, orders, data: orders[0]!.data, merchantId: orders[0]!.merchantId }, 200, {}, request);
  } catch (e) {
    if (e instanceof NotConfiguredError) return errorResponse(503, 'not_configured', 'AI extraction is not configured yet');
    if (e instanceof ExtractionFailedError) return errorResponse(422, 'extraction_failed', 'Could not read this');
    throw e;
  }
}, { rate: AI_RULE });
