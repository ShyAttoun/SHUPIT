import { z } from 'zod';
import { adminDb } from '../_lib/firebaseAdmin';
import { errorResponse, json, preflight, readJson } from '../_lib/http';
import { pushConfigured, subscriptionId } from '../_lib/push';
import { withAuth } from '../_lib/withAuth';

export const OPTIONS = preflight;

const body = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(1000),
    keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
  }),
  lang: z.enum(['he', 'en']).default('en'),
});

/** GET → whether server push is configured, and how many devices are registered. */
export const GET = withAuth(async (request, user) => {
  const snap = await adminDb().collection('users').doc(user.uid).collection('pushSubscriptions').get();
  return json({ configured: pushConfigured(), devices: snap.size }, 200, {}, request);
});

/** POST → register this browser for push (call only after the user granted permission). */
export const POST = withAuth(async (request, user) => {
  if (!pushConfigured()) return errorResponse(503, 'not_configured', 'Push is not configured');
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(400, 'validation', 'Invalid subscription');
  const { subscription, lang } = parsed.data;
  const id = subscriptionId(subscription.endpoint);
  await adminDb()
    .collection('users')
    .doc(user.uid)
    .collection('pushSubscriptions')
    .doc(id)
    .set({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      lang,
      createdAt: new Date().toISOString(),
    });
  return json({ ok: true, id }, 200, {}, request);
});

/** DELETE ?endpoint= (or no param = all devices) → unregister. */
export const DELETE = withAuth(async (request, user) => {
  const endpoint = new URL(request.url).searchParams.get('endpoint');
  const col = adminDb().collection('users').doc(user.uid).collection('pushSubscriptions');
  if (endpoint) {
    await col.doc(subscriptionId(endpoint)).delete();
  } else {
    const all = await col.get();
    await Promise.all(all.docs.map((d) => d.ref.delete()));
  }
  return json({ ok: true }, 200, {}, request);
});
