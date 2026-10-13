import { priceObservationRequest } from '@shupit/contracts';
import { adminDb } from './_lib/firebaseAdmin';
import { errorResponse, json, preflight, readJson } from './_lib/http';
import {
  IdentityMismatchError,
  InvalidUrlError,
  ProductNotSavedError,
  recordObservation,
} from './_lib/priceService';
import { withAuth } from './_lib/withAuth';

export const OPTIONS = preflight;

/**
 * POST → record a price the user verified on the product page (via the extension) and evaluate
 * alerts. A manual verification, not automatic monitoring.
 */
export const POST = withAuth(async (request, user) => {
  const parsed = priceObservationRequest.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(400, 'validation', 'Invalid observation');
  try {
    const result = await recordObservation(adminDb(), user.uid, parsed.data);
    return json(result, 200, {}, request);
  } catch (e) {
    if (e instanceof InvalidUrlError) return errorResponse(400, 'invalid_url', 'Invalid page address');
    if (e instanceof ProductNotSavedError) {
      return errorResponse(404, 'product_not_saved', 'This product is not in your wishlist');
    }
    if (e instanceof IdentityMismatchError) {
      return json(
        {
          error: { code: 'identity_mismatch', message: 'Page does not look like the saved product' },
          savedTitle: e.savedTitle,
          pageTitle: e.pageTitle,
        },
        409,
        {},
        request,
      );
    }
    throw e;
  }
});
