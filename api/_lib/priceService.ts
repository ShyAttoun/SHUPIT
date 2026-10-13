import {
  fromMinor,
  normalizeProductUrl,
  titleSimilarity,
  type Money,
  type ObservationKind,
  type PriceObservationRequest,
} from '@shupit/contracts';
import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { createNotification, loadPrefs, type NotifyResult } from './notify';
import { evaluateObservation, variantKeyOf, type PreviousObservation, type Subscription } from './priceWatch';

export class ProductNotSavedError extends Error {}
export class IdentityMismatchError extends Error {
  constructor(
    public savedTitle: string,
    public pageTitle: string,
  ) {
    super('identity_mismatch');
  }
}
export class InvalidUrlError extends Error {}

/** Same price re-seen within this window is not stored again (keeps history meaningful). */
const DEDUPE_WINDOW_MS = 30 * 60_000;
const SIMILARITY_THRESHOLD = 0.2;

export interface ObservationResult {
  recorded: boolean;
  observationId: string | null;
  kind: ObservationKind;
  dropPercent: number | null;
  comparedWith: Money | null;
  alerts: { type: string; result: NotifyResult }[];
  reason: string;
  productId: string;
}

/**
 * Records a price the user verified on the merchant's own page and evaluates alerts.
 * This is a manual verification workflow, not automatic monitoring.
 */
export async function recordObservation(
  db: Firestore,
  uid: string,
  input: PriceObservationRequest,
  now = new Date(),
): Promise<ObservationResult> {
  const urlKey = normalizeProductUrl(input.pageUrl);
  if (!urlKey) throw new InvalidUrlError('url');

  const userRef = db.collection('users').doc(uid);
  const found = await userRef.collection('savedProducts').where('urlKey', '==', urlKey).limit(1).get();
  const productSnap = found.docs[0];
  if (!productSnap) throw new ProductNotSavedError('product_not_saved');
  const productId = productSnap.id;
  const product = productSnap.data();

  // Identity: the page must plausibly be the product that was saved.
  if (input.pageTitle && !input.confirmed) {
    if (titleSimilarity(String(product.title ?? ''), input.pageTitle) < SIMILARITY_THRESHOLD) {
      throw new IdentityMismatchError(String(product.title ?? ''), input.pageTitle);
    }
  }

  const variantKey = variantKeyOf(input.variant);
  const kind: ObservationKind = input.aiRead ? 'page_ai' : 'page';

  const obsCol = productSnap.ref.collection('priceObservations');
  const histSnap = await obsCol.orderBy('observedAt', 'desc').limit(50).get();
  const history: PreviousObservation[] = histSnap.docs.map((d) => ({
    price: d.get('price') as Money,
    kind: d.get('kind') as ObservationKind,
    variantKey: (d.get('variantKey') as string) ?? '',
  }));

  // De-duplicate identical, very recent observations.
  const latest = histSnap.docs[0];
  if (
    latest &&
    latest.get('price.amountMinor') === input.price.amountMinor &&
    latest.get('price.currency') === input.price.currency &&
    (latest.get('variantKey') ?? '') === variantKey &&
    latest.get('kind') === kind &&
    now.getTime() - Date.parse(latest.get('observedAt') as string) < DEDUPE_WINDOW_MS
  ) {
    return {
      recorded: false,
      observationId: latest.id,
      kind,
      dropPercent: null,
      comparedWith: null,
      alerts: [],
      reason: 'unchanged',
      productId,
    };
  }

  const subSnap = await db.collection('priceWatchSubscriptions').doc(`${uid}_${productId}`).get();
  const subscription: Subscription | null =
    subSnap.exists && subSnap.get('uid') === uid
      ? {
          enabled: subSnap.get('enabled') === true,
          targetPrice: (subSnap.get('targetPrice') as Money | null) ?? null,
          minDropPercent: (subSnap.get('minDropPercent') as number | null) ?? null,
        }
      : null;

  const evaluation = evaluateObservation({
    history,
    next: { price: input.price, kind, variantKey },
    subscription,
    productId,
  });

  const obsRef = obsCol.doc();
  const observedAt = now.toISOString();
  await obsRef.set({
    id: obsRef.id,
    price: input.price,
    kind,
    variantKey,
    observedAt,
    source: 'extension',
    comparedWith: evaluation.comparedWith,
    dropPercent: evaluation.dropPercent,
  });
  await productSnap.ref.update({
    latestObservation: { price: input.price, kind, observedAt, variantKey },
    updatedAt: observedAt,
  });

  const prefs = await loadPrefs(db, uid);
  const alerts: ObservationResult['alerts'] = [];
  for (const a of evaluation.alerts) {
    const result = await createNotification(
      db,
      uid,
      {
        type: a.type,
        dedupeKey: a.dedupeKey,
        data: {
          productId,
          productTitle: String(product.title ?? ''),
          merchantId: (product.merchantId as string | null) ?? null,
          oldPrice: a.oldPrice,
          newPrice: a.newPrice,
          dropPercent: a.type === 'price_drop' ? a.dropPercent : evaluation.dropPercent,
          oldDisplay: a.oldPrice ? fromMinor(a.oldPrice) : null,
          newDisplay: fromMinor(a.newPrice),
          source: 'manual_verification',
        },
      },
      { prefs, now },
    );
    alerts.push({ type: a.type, result });

    // Server-only audit record (idempotent).
    const eventId = createHash('sha1').update(a.dedupeKey).digest('hex').slice(0, 24);
    await db
      .collection('priceAlertEvents')
      .doc(`${uid}_${eventId}`)
      .set(
        {
          id: `${uid}_${eventId}`,
          uid,
          subscriptionId: `${uid}_${productId}`,
          productId,
          type: a.type,
          oldPrice: a.oldPrice,
          newPrice: a.newPrice,
          dedupeKey: a.dedupeKey,
          createdAt: observedAt,
        },
        { merge: true },
      );
  }

  return {
    recorded: true,
    observationId: obsRef.id,
    kind,
    dropPercent: evaluation.dropPercent,
    comparedWith: evaluation.comparedWith,
    alerts,
    reason: evaluation.reason,
    productId,
  };
}
