import { normalizeProductUrl, saveProductRequest } from '@shupit/contracts';
import { adminDb } from './_lib/firebaseAdmin';
import { errorResponse, json, preflight, readJson } from './_lib/http';
import { withAuth } from './_lib/withAuth';

export const OPTIONS = preflight;

/** POST → saves a product captured by the extension (server-validated, de-duplicated by URL key). */
export const POST = withAuth(async (request, user) => {
  const parsed = saveProductRequest.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(400, 'bad_request', 'Invalid product');
  const p = parsed.data;
  const urlKey = normalizeProductUrl(p.productUrl);

  const col = adminDb().collection('users').doc(user.uid).collection('savedProducts');
  if (urlKey) {
    const existing = await col.where('urlKey', '==', urlKey).limit(1).get();
    if (!existing.empty) {
      return json(
        { error: { code: 'duplicate', message: 'Product already saved' }, existingId: existing.docs[0]!.id },
        409,
        {},
        request,
      );
    }
  }

  const now = new Date().toISOString();
  const read = new Set(p.readFields ?? []);
  const ref = col.doc();
  const src = (f: 'title' | 'imageUrl' | 'price') => ({
    source: read.has(f) ? 'extension' : 'user',
    capturedAt: now,
  });
  await ref.set({
    id: ref.id,
    title: p.title,
    productUrl: p.productUrl,
    ...(urlKey ? { urlKey } : {}),
    ...(p.merchantId ? { merchantId: p.merchantId } : {}),
    ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
    ...(p.price ? { savedPrice: p.price } : {}),
    // A price read from the page the user was looking at counts as verified at save time.
    ...(p.price && read.has('price') ? { priceVerifiedAt: now } : {}),
    collectionIds: [],
    provenance: {
      title: src('title'),
      ...(p.imageUrl ? { imageUrl: src('imageUrl') } : {}),
      ...(p.price ? { savedPrice: src('price') } : {}),
    },
    createdAt: now,
    updatedAt: now,
  });
  return json({ id: ref.id }, 201, {}, request);
});
