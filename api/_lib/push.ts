import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import webpush from 'web-push';

export interface PushPayload {
  title: string;
  body: string;
  /** In-app path to open when the notification is tapped. */
  url: string;
  /** Collapses duplicates on the device. */
  tag: string;
}

export interface StoredSubscription {
  /** 'expo' = a native app token (sent through the Expo push service); default is a Web Push endpoint. */
  kind?: 'web' | 'expo';
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expoToken?: string;
  lang: 'he' | 'en';
}

export const subscriptionId = (endpoint: string) =>
  createHash('sha256').update(endpoint).digest('hex').slice(0, 40);

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'https://shupit.vercel.app', pub, priv);
  configured = true;
  return true;
}

export const pushConfigured = () => configure();

/** Localized push text. Product titles/merchant names are the only variable parts. */
export function pushText(
  d: { type: string; status?: string | null; data: Record<string, unknown> },
  lang: 'he' | 'en',
): { title: string; body: string; url: string } {
  const he = lang === 'he';
  const merchant = String(d.data.merchantName ?? '');
  const product = String(d.data.productTitle ?? '');
  const fmt = (m: unknown) => {
    const p = m as { amountMinor?: number; currency?: string } | null;
    return p?.amountMinor !== undefined && p.currency
      ? `${(p.amountMinor / 100).toFixed(2)} ${p.currency}`
      : '';
  };
  if (d.type === 'price_drop') {
    const pct = d.data.dropPercent != null ? `${Math.round(Number(d.data.dropPercent))}%` : '';
    return {
      title: he ? 'ירידת מחיר' : 'Price drop',
      body: he ? `${product}: ירד ב-${pct} ל-${fmt(d.data.newPrice)}` : `${product}: down ${pct} to ${fmt(d.data.newPrice)}`,
      url: d.data.productId ? `/product/${d.data.productId}` : '/notifications',
    };
  }
  if (d.type === 'target_reached') {
    return {
      title: he ? 'הגעתם למחיר היעד' : 'Target price reached',
      body: he ? `${product}: ${fmt(d.data.newPrice)}` : `${product}: ${fmt(d.data.newPrice)}`,
      url: d.data.productId ? `/product/${d.data.productId}` : '/notifications',
    };
  }
  const labels: Record<string, [string, string]> = {
    ready_for_pickup: ['Ready for pickup', 'מוכן לאיסוף'],
    out_for_delivery: ['Out for delivery', 'יצא לחלוקה'],
    delivered: ['Delivered', 'נמסר'],
    exception: ['Delivery problem', 'בעיה במשלוח'],
    returned: ['Returned', 'הוחזר'],
    customs: ['In customs', 'במכס'],
    in_transit: ['On its way', 'בדרך'],
    shipped: ['Shipped', 'נשלח'],
  };
  const l = labels[d.status ?? ''];
  return {
    title: he ? 'עדכון משלוח' : 'Shipment update',
    body: `${merchant ? merchant + ': ' : ''}${l ? (he ? l[1] : l[0]) : he ? 'יש עדכון' : 'There is an update'}`,
    url: d.data.orderId ? `/order/${d.data.orderId}` : '/notifications',
  };
}

export async function listSubscriptions(db: Firestore, uid: string) {
  const snap = await db.collection('users').doc(uid).collection('pushSubscriptions').get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredSubscription) }));
}

/**
 * Sends a push to every registered device of the user. Best effort: failures never affect the
 * in-app notification. Subscriptions the push service reports as gone are removed.
 */
export async function sendPush(
  db: Firestore,
  uid: string,
  build: (lang: 'he' | 'en') => PushPayload,
): Promise<{ sent: number; removed: number }> {
  const subs = await listSubscriptions(db, uid);
  let sent = 0;
  let removed = 0;
  const webOk = configure();
  for (const s of subs) {
    if (s.kind === 'expo' && s.expoToken) {
      const p = build(s.lang === 'he' ? 'he' : 'en');
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ to: s.expoToken, title: p.title, body: p.body, data: { url: p.url }, sound: 'default', collapseId: p.tag }),
          signal: AbortSignal.timeout(8000),
        });
        const out = (await res.json()) as { data?: { status?: string; details?: { error?: string } } };
        if (out.data?.status === 'ok') sent++;
        else if (out.data?.details?.error === 'DeviceNotRegistered') {
          await db.collection('users').doc(uid).collection('pushSubscriptions').doc(s.id).delete().catch(() => undefined);
          removed++;
        }
      } catch {
        console.error('push_send_error', 'expo');
      }
      continue;
    }
    if (!webOk) continue;
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: s.keys },
        JSON.stringify(build(s.lang === 'he' ? 'he' : 'en')),
        { TTL: 60 * 60 * 24, urgency: 'normal' },
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.collection('users').doc(uid).collection('pushSubscriptions').doc(s.id).delete().catch(() => undefined);
        removed++;
      } else {
        console.error('push_send_error', status ?? 'unknown');
      }
    }
  }
  return { sent, removed };
}
