import { getSession } from './auth';
import { APP_URL } from './config';
import { JOB_KEY, type BgRequest, type BgResponse, type Job, type OrderData } from './job';

const he = (navigator.language || 'en').toLowerCase().startsWith('he');
document.documentElement.lang = he ? 'he' : 'en';
document.documentElement.dir = he ? 'rtl' : 'ltr';

const T = {
  connectBody: he
    ? 'פתחו את SHUPIT, היכנסו להגדרות ולחצו על "חיבור תוסף Chrome".'
    : 'Open SHUPIT, go to Settings and press “Connect Chrome extension”.',
  openSettings: he ? 'פתיחת ההגדרות' : 'Open settings',
  signedInAs: he ? 'מחובר כ-' : 'Signed in as ',
  disconnect: he ? 'ניתוק' : 'Disconnect',
  saveProduct: he ? 'הוספה ל-Wishlist ב-SHUPIT' : 'Add to your SHUPIT Wishlist',
  saveProductSub: he ? 'שומר את המוצר שמופיע בדף הזה' : 'Saves the product shown on this page',
  addOrder: he ? 'הוספה להזמנות ב-SHUPIT' : 'Add to your SHUPIT Orders',
  addOrderSub: he
    ? 'קורא את ההזמנה (או כמה הזמנות) מהדף ומוסיף אותן לרשימת ההזמנות'
    : 'Reads the order (or several orders) on this page and adds them',
  verifyPrice: he ? 'אימות מחיר ב-SHUPIT' : 'Verify price in SHUPIT',
  verifyPriceSub: he
    ? 'בודק את המחיר המוצג בדף הזה ומתעד אותו בהיסטוריה של מוצר שמור. זה אימות ידני, לא ניטור אוטומטי.'
    : 'Checks the price shown on this page and records it in a saved product’s history. A manual check, not automatic monitoring.',
  priceRecorded: he ? 'המחיר תועד ✓' : 'Price recorded ✓',
  priceUnchanged: he ? 'אותו מחיר כמו בבדיקה האחרונה.' : 'Same as the last check.',
  priceWas: (v: string) => (he ? `לפני כן: ${v}` : `Previously: ${v}`),
  priceChange: he ? 'שינוי' : 'Change',
  alertCreated: he ? 'נוצרה התראה באפליקציה.' : 'An in-app alert was created.',
  alertOff: he ? 'ההתראה כבויה בהעדפות.' : 'The alert is turned off in your preferences.',
  noSubscription: he
    ? 'הפעילו "מעקב מחיר" במוצר כדי לקבל התראות.'
    : 'Turn on “Track price” on the product to get alerts.',
  priceAi: he
    ? 'המחיר נקרא על ידי AI ולא מאומת: תועד, אך לא יופעלו ממנו התראות.'
    : 'The price was read by AI and is not verified: recorded, but no alerts come from it.',
  notSaved: he
    ? 'המוצר הזה עדיין לא שמור ב-SHUPIT. שמרו אותו קודם.'
    : 'This product isn’t saved in SHUPIT yet. Save it first.',
  noPrice: he ? 'לא מצאנו מחיר בדף.' : 'No price found on this page.',
  identityTitle: he ? 'האם זה אותו מוצר?' : 'Is this the same product?',
  identitySaved: he ? 'שמור' : 'Saved',
  identityPage: he ? 'בדף' : 'On this page',
  recordAnyway: he ? 'כן, לתעד' : 'Yes, record it',
  updateShipment: he ? 'עדכון מעקב משלוח ב-SHUPIT' : 'Update shipment tracking in SHUPIT',
  updateShipmentSub: he
    ? 'קורא סטטוס, תאריך הגעה ואירועים מדף המעקב ומעדכן משלוח קיים'
    : 'Reads status, delivery estimate and events from a tracking page and updates a shipment',
  privacy: he
    ? 'התוסף קורא את הדף הנוכחי רק כשלוחצים על פעולה, ושולח ל-SHUPIT את הטקסט הנראה (ובהזמנות ומעקב גם צילום של האזור הנראה).'
    : 'The extension reads the current page only when you press an action, and sends its visible text (and a screenshot of the visible area, for orders and tracking) to SHUPIT.',
  reading: he ? 'קורא את הדף…' : 'Reading the page…',
  runningNote: he
    ? 'אפשר לסגור את החלון. הקריאה ממשיכה ברקע, וסמל התוסף יציג ✓ כשהיא מוכנה. פתחו אותו שוב כדי לראות את התוצאה.'
    : 'You can close this window. Reading continues in the background and the icon shows ✓ when it’s ready. Open it again to see the result.',
  title: he ? 'שם' : 'Name',
  price: he ? 'מחיר' : 'Price',
  store: he ? 'חנות' : 'Store',
  save: he ? 'שמירה' : 'Save',
  saved: he ? 'נשמר ב-SHUPIT ✓' : 'Saved to SHUPIT ✓',
  duplicate: he ? 'כבר שמרתם את המוצר הזה.' : 'You already saved this product.',
  checkDetails: he ? 'קרוא מהדף. בדקו לפני השמירה.' : 'Read from the page. Please check before saving.',
  orderNumber: he ? 'מספר הזמנה' : 'Order number',
  total: he ? 'סה״כ' : 'Total',
  items: he ? 'פריטים' : 'Items',
  tracking: he ? 'מעקב' : 'Tracking',
  statusLabel: he ? 'סטטוס' : 'Status',
  eta: he ? 'צפי הגעה' : 'Estimated delivery',
  events: he ? 'אירועי מעקב' : 'Tracking events',
  ordersFound: (n: number) => (he ? `נמצאו ${n} הזמנות בדף` : `Found ${n} orders on this page`),
  addN: (n: number) => (he ? `הוספת ${n} הזמנות` : `Add ${n} orders`),
  addOne: he ? 'הוספת ההזמנה' : 'Add this order',
  addedResult: (added: number, dup: number, failed: number) =>
    he
      ? `נוספו ${added}${dup ? ` · כבר היו ${dup}` : ''}${failed ? ` · נכשלו ${failed}` : ''}`
      : `Added ${added}${dup ? ` · already added ${dup}` : ''}${failed ? ` · failed ${failed}` : ''}`,
  pickShipment: he ? 'איזה משלוח לעדכן?' : 'Which shipment should be updated?',
  noShipments: he ? 'אין משלוחים פעילים.' : 'You have no active shipments.',
  statusUpdated: he ? 'הסטטוס עודכן ✓' : 'Status updated ✓',
  back: he ? 'חזרה' : 'Back',
  notProduct: he ? 'לא מצאנו מוצר בדף הזה.' : 'No product found on this page.',
  notOrder: he ? 'לא מצאנו הזמנה בדף הזה.' : 'No order found on this page.',
  noStatus: he ? 'לא מצאנו סטטוס משלוח בדף.' : 'No delivery status found on this page.',
  unreadable: he ? 'אין בדף תוכן קריא.' : 'This page has no readable content.',
  notConfigured: he ? 'הקריאה האוטומטית עדיין לא זמינה.' : 'Automatic reading isn’t available yet.',
  quota: he ? 'הגעתם למגבלה היומית.' : 'You reached today’s limit.',
  consentRequired: he
    ? 'קריאת AI כבויה. הפעילו אותה באפליקציה: הגדרות ← פרטיות.'
    : 'AI reading is off. Turn it on in the app: Settings → Privacy.',
  rateLimited: he ? 'יותר מדי בקשות. המתינו רגע.' : 'Too many requests. Please wait a moment.',
  generic: he ? 'משהו השתבש. נסו שוב.' : 'Something went wrong. Try again.',
  disconnected: he ? 'החיבור פג. חברו מחדש מהאפליקציה.' : 'Your connection expired. Reconnect from the app.',
  unsupportedPage: he ? 'לא ניתן לקרוא את הדף הזה.' : 'This page can’t be read.',
};

const app = document.getElementById('app')!;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { class: cls, ...rest } = props as Record<string, unknown>;
  if (cls) node.className = String(cls);
  Object.assign(node, rest);
  for (const c of children) node.append(c);
  return node;
}

function render(...nodes: Node[]) {
  app.replaceChildren(...nodes);
}

// --------------------------------------------------------------- background bridge

function bg(req: BgRequest): Promise<BgResponse> {
  return chrome.runtime.sendMessage(req) as Promise<BgResponse>;
}

class BgError extends Error {
  constructor(
    public status: number,
    public code: string,
    public body?: unknown,
  ) {
    super(code);
  }
}

async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await bg({ type: 'api', path, ...init });
  if (!res.ok) throw new BgError(res.status, res.code, res.body);
  return res.data as T;
}

async function getJob(): Promise<Job | null> {
  const res = await chrome.storage.local.get(JOB_KEY);
  return (res[JOB_KEY] as Job | undefined) ?? null;
}

async function clearJob() {
  await bg({ type: 'clear-job' });
}

function errorText(code: string | undefined): string {
  switch (code) {
    case 'disconnected':
      return T.disconnected;
    case 'not_a_product':
      return T.notProduct;
    case 'not_an_order':
      return T.notOrder;
    case 'no_status':
      return T.noStatus;
    case 'unreadable':
      return T.unreadable;
    case 'not_configured':
      return T.notConfigured;
    case 'quota_exceeded':
      return T.quota;
    case 'consent_required':
      return T.consentRequired;
    case 'rate_limited':
      return T.rateLimited;
    case 'unsupported':
      return T.unsupportedPage;
    case 'product_not_saved':
      return T.notSaved;
    case 'no_price':
      return T.noPrice;
    default:
      return T.generic;
  }
}

// --------------------------------------------------------------- views

function header(email?: string | null) {
  const out: Node[] = [el('h1', {}, el('img', { src: 'icons/icon48.png', alt: '' }), 'SHUPIT')];
  if (email) {
    out.push(
      el(
        'div',
        { class: 'note' },
        `${T.signedInAs}${email} · `,
        el('button', {
          class: 'link',
          textContent: T.disconnect,
          onclick: async () => {
            await chrome.storage.local.remove('shupit.session');
            void main();
          },
        }),
      ),
    );
  }
  return out;
}

function actionButton(title: string, sub: string, onclick: () => void, primary = false) {
  const b = el('button', { class: primary ? 'btn primary' : 'btn', onclick });
  b.append(el('strong', {}, title), el('small', {}, sub));
  return b;
}

function backButton() {
  return el('button', {
    class: 'btn',
    textContent: T.back,
    onclick: async () => {
      await clearJob();
      void main();
    },
  });
}

async function startJob(kind: 'product' | 'orders' | 'shipment' | 'price', shipmentId?: string) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) {
    render(...header(), el('p', { class: 'error' }, T.unsupportedPage), backButton());
    return;
  }
  render(...header(), el('p', {}, T.reading), el('p', { class: 'note' }, T.runningNote));
  await bg({ type: 'start', kind, tabId: tab.id, windowId: tab.windowId, shipmentId });
}

async function home() {
  const s = await getSession();
  render(
    ...header(s?.email),
    actionButton(T.saveProduct, T.saveProductSub, () => void startJob('product'), true),
    actionButton(T.addOrder, T.addOrderSub, () => void startJob('orders')),
    actionButton(T.verifyPrice, T.verifyPriceSub, () => void startJob('price')),
    actionButton(T.updateShipment, T.updateShipmentSub, () => void pickShipment()),
    el('p', { class: 'note' }, T.privacy),
  );
}

async function pickShipment() {
  render(...header(), el('p', {}, T.reading));
  try {
    const { shipments } = await api<{
      shipments: { id: string; merchantName: string; trackingNumber: string | null }[];
    }>('/api/shipments-list');
    if (shipments.length === 0) {
      render(...header(), el('p', {}, T.noShipments), backButton());
      return;
    }
    render(
      ...header(),
      el('p', {}, T.pickShipment),
      ...shipments.map((s) =>
        el('button', {
          class: 'btn',
          textContent: [s.merchantName, s.trackingNumber].filter(Boolean).join(' · ') || s.id,
          onclick: () => void startJob('shipment', s.id),
        }),
      ),
      backButton(),
    );
  } catch (e) {
    render(...header(), el('p', { class: 'error' }, errorText(e instanceof BgError ? e.code : undefined)), backButton());
  }
}

const row = (k: string, v: string | null | undefined) =>
  v ? el('div', { class: 'row' }, el('span', {}, k), el('span', {}, v)) : null;

function renderProduct(job: Job) {
  const data = job.product!;
  const title = el('input', { value: data.title, maxLength: 300 });
  const priceLine = data.price ? `${data.priceDisplay} ${data.price.currency}` : '—';
  const msg = el('p', { class: 'note' }, T.checkDetails);
  const saveBtn = el('button', { class: 'btn primary', textContent: T.save });

  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    try {
      const edited = title.value.trim();
      const read = [
        ...(edited === data.title ? (['title'] as const) : []),
        ...(data.imageUrl ? (['imageUrl'] as const) : []),
        ...(data.price && !data.aiFields.includes('price') ? (['price'] as const) : []),
      ];
      await api('/api/products', {
        method: 'POST',
        body: {
          title: edited,
          productUrl: data.canonicalUrl,
          ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
          ...(data.price ? { price: data.price } : {}),
          ...(data.merchantId ? { merchantId: data.merchantId } : {}),
          readFields: read,
        },
      });
      await clearJob();
      render(...header(), el('p', { class: 'ok' }, T.saved), backButton());
    } catch (e) {
      if (e instanceof BgError && e.code === 'duplicate') {
        await clearJob();
        render(...header(), el('p', { class: 'ok' }, T.duplicate), backButton());
      } else {
        saveBtn.disabled = false;
        msg.className = 'error';
        msg.textContent = errorText(e instanceof BgError ? e.code : undefined);
      }
    }
  };

  render(
    ...header(),
    el(
      'div',
      { class: 'card' },
      el('label', {}, T.title, title),
      el('div', { class: 'row' }, el('span', {}, T.price), el('span', {}, priceLine)),
    ),
    msg,
    saveBtn,
    backButton(),
  );
}

const isoNoon = (ymd: string | null | undefined) =>
  ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? `${ymd}T12:00:00.000Z` : undefined;
const eventIso = (v: string) => {
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(v);
  return m ? `${m[1]}T${m[2] ?? '12:00'}:00.000Z` : null;
};

function pickupBody(p: NonNullable<OrderData['shipments'][number]['pickup']> | null | undefined) {
  if (!p) return undefined;
  const m = p.until ? /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(p.until) : null;
  const out = {
    ...(p.name ? { name: p.name } : {}),
    ...(p.address ? { address: p.address } : {}),
    ...(m ? { until: `${m[1]}T${m[2] ?? '23:59'}:00.000Z` } : {}),
    ...(p.instructions ? { instructions: p.instructions } : {}),
    ...(p.collectionCode ? { code: p.collectionCode } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

function orderBody(d: OrderData, merchantId: string | null, pageUrl: string) {
  const ship = d.shipments[0];
  const exp = d.total?.currency === 'JPY' ? 0 : 2;
  const aiFields = [
    ...(d.merchantName ? ['merchantName'] : []),
    ...(d.orderNumber ? ['externalOrderId'] : []),
    ...(d.purchaseDate ? ['purchasedAt'] : []),
    ...(d.total ? ['total'] : []),
    ...(d.items.length ? ['items'] : []),
  ];
  let host = '';
  try {
    host = new URL(pageUrl).hostname;
  } catch {
    // ignore
  }
  return {
    ...(merchantId ? { merchantId } : {}),
    merchantName: d.merchantName ?? host,
    ...(d.orderNumber ? { externalOrderId: d.orderNumber } : {}),
    ...(isoNoon(d.purchaseDate) ? { purchasedAt: isoNoon(d.purchaseDate) } : {}),
    // A total whose currency was not shown is left out rather than guessed.
    ...(d.total && d.total.currency
      ? { total: { amountMinor: Math.round(d.total.amount * 10 ** exp), currency: d.total.currency } }
      : {}),
    items: d.items.map((it) => ({
      title: it.title,
      quantity: it.quantity,
      ...(it.imageUrl ? { imageUrl: it.imageUrl } : {}),
    })),
    shipments: ship
      ? [
          {
            ...(ship.carrier ? { carrier: ship.carrier } : {}),
            ...(ship.trackingNumber ? { trackingNumber: ship.trackingNumber } : {}),
            ...(isoNoon(ship.estimatedDelivery) ? { estimatedDeliveryAt: isoNoon(ship.estimatedDelivery) } : {}),
            ...(isoNoon(ship.estimatedDeliveryFrom) ? { estimatedDeliveryFrom: isoNoon(ship.estimatedDeliveryFrom) } : {}),
            ...(ship.status ? { status: ship.status } : {}),
            ...(ship.statusText ? { statusText: ship.statusText } : {}),
            ...(pickupBody(ship.pickup) ? { pickup: pickupBody(ship.pickup) } : {}),
            ...(ship.events?.length
              ? {
                  events: ship.events
                    .map((e) => ({ description: e.description, occurredAt: eventIso(e.occurredAt) }))
                    .filter((e): e is { description: string; occurredAt: string } => !!e.occurredAt),
                }
              : {}),
          },
        ]
      : [],
    importSource: 'extension',
    aiFields,
  };
}

function renderOrders(job: Job) {
  const orders = job.orders ?? [];
  const checks: HTMLInputElement[] = [];
  const msg = el('p', { class: 'note' }, T.checkDetails);

  const cards = orders.map((o, i) => {
    const d = o.data;
    const ship = d.shipments[0];
    const box = el('input', { type: 'checkbox', checked: true }) as HTMLInputElement;
    checks[i] = box;
    const thumbs = el(
      'div',
      { class: 'thumbs' },
      ...d.items
        .filter((it) => it.imageUrl)
        .slice(0, 6)
        .map((it) => el('img', { src: it.imageUrl!, alt: '', referrerPolicy: 'no-referrer' })),
    );
    return el(
      'div',
      { class: 'card' },
      orders.length > 1
        ? el('label', { class: 'check' }, box, ` ${d.merchantName ?? ''} ${d.orderNumber ?? ''}`.trim())
        : el('div', {}),
      ...[
        orders.length > 1 ? null : row(T.store, d.merchantName),
        orders.length > 1 ? null : row(T.orderNumber, d.orderNumber),
        row(T.total, d.total ? `${d.total.amount} ${d.total.currency ?? '?'}` : null),
        row(T.items, d.items.length ? String(d.items.length) : null),
        row(T.tracking, [ship?.carrier, ship?.trackingNumber].filter(Boolean).join(' · ') || null),
        row(T.statusLabel, ship?.statusText ?? ship?.status ?? null),
        row(
          T.eta,
          ship?.estimatedDelivery
            ? ship.estimatedDeliveryFrom
              ? `${ship.estimatedDeliveryFrom} → ${ship.estimatedDelivery}`
              : ship.estimatedDelivery
            : null,
        ),
        row(T.events, ship?.events?.length ? String(ship.events.length) : null),
      ].filter((n): n is HTMLDivElement => !!n),
      thumbs.childElementCount ? thumbs : el('span', {}),
    );
  });

  const saveBtn = el('button', {
    class: 'btn primary',
    textContent: orders.length > 1 ? T.addN(orders.length) : T.addOne,
  });
  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    let added = 0;
    let dup = 0;
    let failed = 0;
    for (let i = 0; i < orders.length; i++) {
      if (orders.length > 1 && !checks[i]?.checked) continue;
      const o = orders[i]!;
      try {
        await api('/api/orders', {
          method: 'POST',
          body: orderBody(o.data, o.merchantId, job.pageUrl ?? ''),
        });
        added++;
      } catch (e) {
        if (e instanceof BgError && e.code === 'duplicate') dup++;
        else failed++;
      }
    }
    await clearJob();
    render(
      ...header(),
      el('p', { class: failed ? 'error' : 'ok' }, T.addedResult(added, dup, failed)),
      backButton(),
    );
  };

  render(
    ...header(),
    ...(orders.length > 1 ? [el('p', {}, T.ordersFound(orders.length))] : []),
    ...cards,
    msg,
    saveBtn,
    backButton(),
  );
}

function renderShipmentResult(job: Job) {
  void clearJob();
  render(
    ...header(),
    el('p', { class: 'ok' }, T.statusUpdated),
    ...(job.result
      ? [el('div', { class: 'card' }, ...[row(T.statusLabel, job.result.status), row(T.events, String(job.result.events))].filter((n): n is HTMLDivElement => !!n))]
      : []),
    backButton(),
  );
}

function renderPrice(job: Job) {
  void clearJob();
  if (job.priceConfirm) {
    const c = job.priceConfirm;
    const go = el('button', { class: 'btn primary', textContent: T.recordAnyway });
    go.onclick = async () => {
      go.disabled = true;
      try {
        const r = await api<NonNullable<Job['price']>>('/api/price-observations', {
          method: 'POST',
          body: { ...c.body, confirmed: true },
        });
        renderPrice({ ...job, priceConfirm: undefined, price: { ...r, price: c.body.price as never } });
      } catch (e) {
        render(...header(), el('p', { class: 'error' }, errorText(e instanceof BgError ? e.code : undefined)), backButton());
      }
    };
    render(
      ...header(),
      el('p', {}, T.identityTitle),
      el(
        'div',
        { class: 'card' },
        ...[row(T.identitySaved, c.savedTitle), row(T.identityPage, c.pageTitle)].filter((n): n is HTMLDivElement => !!n),
      ),
      go,
      backButton(),
    );
    return;
  }
  const p = job.price;
  if (!p) {
    render(...header(), el('p', { class: 'error' }, T.generic), backButton());
    return;
  }
  const fmt = (m: { amountMinor: number; currency: string }) =>
    `${(m.amountMinor / 100).toFixed(2)} ${m.currency}`;
  const lines: Node[] = [];
  lines.push(el('p', { class: p.recorded ? 'ok' : '' }, p.recorded ? T.priceRecorded : T.priceUnchanged));
  const rows = [
    row(T.price, fmt(p.price)),
    p.comparedWith ? row(T.priceWas(''), fmt(p.comparedWith)) : null,
    p.dropPercent !== null ? row(T.priceChange, `${p.dropPercent > 0 ? '-' : '+'}${Math.abs(p.dropPercent).toFixed(1)}%`) : null,
  ].filter((n): n is HTMLDivElement => !!n);
  lines.push(el('div', { class: 'card' }, ...rows));
  if (p.kind === 'page_ai') lines.push(el('p', { class: 'note' }, T.priceAi));
  else if (p.alerts.some((a) => a.result === 'created')) lines.push(el('p', { class: 'ok' }, T.alertCreated));
  else if (p.alerts.some((a) => a.result === 'disabled')) lines.push(el('p', { class: 'note' }, T.alertOff));
  else if (p.reason === 'no_subscription') lines.push(el('p', { class: 'note' }, T.noSubscription));
  render(...header(), ...lines, backButton());
}

function renderJob(job: Job) {
  if (job.status === 'running') {
    render(...header(), el('p', {}, T.reading), el('p', { class: 'note' }, T.runningNote));
    return;
  }
  if (job.status === 'error') {
    void clearJob();
    render(...header(), el('p', { class: 'error' }, errorText(job.error)), backButton());
    return;
  }
  if (job.kind === 'price') renderPrice(job);
  else if (job.kind === 'product' && job.product) renderProduct(job);
  else if (job.kind === 'orders') renderOrders(job);
  else renderShipmentResult(job);
}

// --------------------------------------------------------------- entry

async function main() {
  const s = await getSession();
  if (!s) {
    render(
      ...header(),
      el('p', {}, T.connectBody),
      el('button', {
        class: 'btn primary',
        textContent: T.openSettings,
        onclick: () => void chrome.tabs.create({ url: `${APP_URL}/settings` }),
      }),
    );
    return;
  }
  const job = await getJob();
  // A finished job is shown until acted on; stale jobs (>30 min) are dropped.
  if (job && Date.now() - job.startedAt < 30 * 60_000) {
    renderJob(job);
    return;
  }
  if (job) await clearJob();
  await home();
}

// Live updates while the popup is open (the background finishing a job).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !(JOB_KEY in changes)) return;
  const job = changes[JOB_KEY]?.newValue as Job | undefined;
  if (job) renderJob(job);
});

void main();
