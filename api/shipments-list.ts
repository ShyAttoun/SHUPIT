import { adminDb } from './_lib/firebaseAdmin';
import { json, preflight } from './_lib/http';
import { withAuth } from './_lib/withAuth';

export const OPTIONS = preflight;

/** GET → the caller's non-final shipments (for the extension's "update status" picker). */
export const GET = withAuth(async (request, user) => {
  const db = adminDb();
  const userRef = db.collection('users').doc(user.uid);
  const [ships, orders] = await Promise.all([
    userRef.collection('shipments').limit(100).get(),
    userRef.collection('orders').limit(100).get(),
  ]);
  const names = new Map(orders.docs.map((o) => [o.id, (o.get('merchantName') as string) ?? '']));
  const items = ships.docs
    .map((s) => ({
      id: s.id,
      orderId: s.get('orderId') as string,
      merchantName: names.get(s.get('orderId') as string) ?? '',
      status: s.get('status') as string,
      trackingNumber: (s.get('trackingNumber') as string | null) ?? null,
      carrier: (s.get('carrier') as string | null) ?? null,
    }))
    .filter((s) => s.status !== 'delivered' && s.status !== 'returned');
  return json({ shipments: items }, 200, {}, request);
});
