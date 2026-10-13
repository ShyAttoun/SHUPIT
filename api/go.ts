import { getMerchant, goRequest, merchantForUrl } from '@shupit/contracts';
import { resolveDestination, urlBelongsToMerchant } from './_lib/affiliate';
import { adminDb } from './_lib/firebaseAdmin';
import { errorResponse, json, preflight, readJson } from './_lib/http';
import { withAuth } from './_lib/withAuth';

export const OPTIONS = preflight;

/** POST { merchantId?, productUrl? } → where "Buy at Store" should go, and whether it is an affiliate link. */
export const POST = withAuth(async (request, user) => {
  const parsed = goRequest.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(400, 'bad_request', 'Invalid request');
  const { merchantId, productUrl } = parsed.data;

  const merchant =
    getMerchant(merchantId) ?? (productUrl ? merchantForUrl(productUrl) : undefined);

  if (!merchant) {
    // Unknown merchant: send the user to the original URL, no attribution claimed.
    if (!productUrl) return errorResponse(404, 'unknown_merchant', 'Merchant not found');
    return json({ url: productUrl, kind: 'web' }, 200, {}, request);
  }
  if (productUrl && !urlBelongsToMerchant(merchant, productUrl)) {
    return errorResponse(400, 'url_mismatch', 'URL does not belong to this merchant');
  }

  const result = resolveDestination(merchant, productUrl);

  // Click log: server-only collection, no URL stored (privacy).
  await adminDb()
    .collection('affiliateClicks')
    .add({
      uid: user.uid,
      merchantId: merchant.id,
      kind: result.kind,
      hasProductUrl: !!productUrl,
      createdAt: new Date().toISOString(),
    })
    .catch(() => undefined);

  return json(result, 200, {}, request);
});
