import { captureRequest, extractRequest } from '@shupit/contracts';
import { adminDb } from './_lib/firebaseAdmin';
import { errorResponse, json, preflight, readJson } from './_lib/http';
import { statusUpdateFrom } from './_lib/statusUpdate';
import { toEventDocs } from './_lib/orderEnrich';
import { consumeAiQuota } from './_lib/usage';
import { ExtractionFailedError, NotConfiguredError, extractOrders } from './_lib/vision';
import { withAuth } from './_lib/withAuth';
import { AI_RULE } from './_lib/rateLimit';
import { hasAiConsent } from './_lib/consent';
import { createNotification } from './_lib/notify';
import { notificationsFor } from './_lib/tracking/refresh';

export const OPTIONS = preflight;

/**
 * POST ?id=<shipmentId> with { kind:'order', imageBase64, mediaType }
 * Reads the shipment status from a screenshot of a tracking/order page and stores it
 * as a user-supplied snapshot (source 'ai_vision'), never as carrier-verified.
 */
export const POST = withAuth(async (request, user) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id || id.length > 128 || id.includes('/')) return errorResponse(400, 'bad_request', 'Missing id');
  const raw = await readJson(request, 4_400_000);
  const asImage = extractRequest.safeParse(raw);
  const asPage = captureRequest.safeParse(raw);
  const image =
    asImage.success && asImage.data.imageBase64 && asImage.data.mediaType
      ? { base64: asImage.data.imageBase64, mediaType: asImage.data.mediaType }
      : null;
  const pageText = asPage.success ? (asPage.data.page.text ?? '').trim() : '';
  if (!image && pageText.length < 40) {
    return errorResponse(400, 'bad_request', 'A screenshot or page is required');
  }
  if (!process.env.ANTHROPIC_API_KEY) return errorResponse(503, 'not_configured', 'AI extraction is not configured yet');

  const db = adminDb();
  if (!(await hasAiConsent(db, user.uid))) {
    return errorResponse(403, 'consent_required', 'AI processing consent is required');
  }
  const ref = db.collection('users').doc(user.uid).collection('shipments').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return errorResponse(404, 'not_found', 'Shipment not found');

  if (!(await consumeAiQuota(user.uid))) return errorResponse(429, 'quota_exceeded', 'Daily extraction limit reached');

  try {
    const result = await extractOrders(
      image
        ? { image }
        : {
            text: pageText,
            images: asPage.success ? asPage.data.page.images : undefined,
            ...(asPage.success && asPage.data.screenshot
              ? { screenshot: { base64: asPage.data.screenshot.imageBase64, mediaType: asPage.data.screenshot.mediaType } }
              : {}),
          },
    );
    const found = result.orders.filter((o) => o.isOrderScreenshot);
    if (found.length === 0) return errorResponse(422, 'not_an_order', 'No order found');
    // The page may list several orders: use the one that has our tracking number, else the first with a status.
    const tn = snap.get('trackingNumber') as string | null;
    const update =
      found.map((o) => statusUpdateFrom(o, tn)).find((u): u is NonNullable<typeof u> => u !== null) ?? null;
    if (!update) return errorResponse(422, 'no_status', 'No status visible');

    const now = new Date().toISOString();
    const previous = {
      status: snap.get('status') as string,
      estimatedDeliveryAt: (snap.get('estimatedDeliveryAt') as string | null) ?? null,
      hasCarrierEta: false,
    };
    const terminal = update.status === 'delivered' || update.status === 'returned';
    const batch = db.batch();
    batch.update(ref, {
      status: update.status,
      statusSource: 'ai_vision',
      statusAsOf: now,
      statusText: update.statusText ?? null,
      ...(update.pickup ? { pickup: update.pickup } : {}),
      ...(update.estimatedDeliveryAt
        ? {
            estimatedDeliveryAt: update.estimatedDeliveryAt,
            estimatedDeliveryFrom: update.estimatedDeliveryFrom ?? null,
            estimatedDeliverySource: 'user',
          }
        : {}),
      ...(terminal ? { trackable: false, nextCheckAt: null } : {}),
    });
    for (const ev of toEventDocs(id, update.events, 'page')) {
      batch.set(ref.collection('trackingEvents').doc(ev.id), ev.doc, { merge: true });
    }
    await batch.commit();

    // A manual update that changes the status goes through the same notification engine.
    const orderId = snap.get('orderId') as string;
    const orderSnap = await db.collection('users').doc(user.uid).collection('orders').doc(orderId).get();
    for (const n of notificationsFor(id, previous as never, {
      status: update.status,
      estimatedDeliveryAt: update.estimatedDeliveryAt,
    })) {
      await createNotification(db, user.uid, {
        type: n.type,
        status: n.status,
        dedupeKey: n.dedupeKey,
        data: {
          shipmentId: id,
          orderId,
          merchantName: (orderSnap.get('merchantName') as string | undefined) ?? '',
          etaFrom: n.etaFrom ?? null,
          etaTo: n.etaTo ?? null,
          source: 'manual',
        },
      });
    }
    return json(
      { status: update.status, estimatedDeliveryAt: update.estimatedDeliveryAt ?? null, events: update.events.length },
      200,
      {},
      request,
    );
  } catch (e) {
    if (e instanceof NotConfiguredError) return errorResponse(503, 'not_configured', 'AI extraction is not configured yet');
    if (e instanceof ExtractionFailedError) return errorResponse(422, 'extraction_failed', 'Could not read this');
    throw e;
  }
}, { rate: AI_RULE });
