import { ApiError, api, clearSession, getSession } from './auth';
import { APP_URL } from './config';
import { readPage, withoutQuery, type PageCapture } from './capture';

const he = (navigator.language || 'en').toLowerCase().startsWith('he');
document.documentElement.lang = he ? 'he' : 'en';
document.documentElement.dir = he ? 'rtl' : 'ltr';

const T = {
  connectTitle: he ? 'חיבור לחשבון SHUPIT' : 'Connect your SHUPIT account',
  connectBody: he
    ? 'פתחו את SHUPIT, היכנסו להגדרות ולחצו על "חיבור תוסף Chrome".'
    : 'Open SHUPIT, go to Settings and press “Connect Chrome extension”.',
  openSettings: he ? 'פתיחת ההגדרות' : 'Open settings',
  signedInAs: he ? 'מחובר כ-' : 'Signed in as ',
  disconnect: he ? 'ניתוק' : 'Disconnect',
  saveProduct: he ? 'שמירת המוצר מהדף' : 'Save this product',
  addOrder: he ? 'הוספת ההזמנה מהדף' : 'Add this order',
  updateShipment: he ? 'עדכון סטטוס משלוח מהדף' : 'Update a shipment’s status from this page',
  privacy: he
    ? 'התוסף קורא את הדף הנוכחי רק כשלוחצים על פעולה, ושולח את הטקסט הנראה ל-SHUPIT.'
    : 'The extension reads the current page only when you press an action, and sends its visible text to SHUPIT.',
  reading: he ? 'קורא את הדף…' : 'Reading the page…',
  product: he ? 'מוצר' : 'Product',
  title: he ? 'שם' : 'Name',
  price: he ? 'מחיר' : 'Price',
  store: he ? 'חנות' : 'Store',
  save: he ? 'שמירה' : 'Save',
  saved: he ? 'נשמר ב-SHUPIT ✓' : 'Saved to SHUPIT ✓',
  duplicate: he ? 'כבר שמרתם את המוצר הזה.' : 'You already saved this product.',
  duplicateOrder: he ? 'כבר הוספתם את ההזמנה הזו.' : 'You already added this order.',
  checkDetails: he ? 'קרוא מהדף. בדקו לפני השמירה.' : 'Read from the page. Please check before saving.',
  orderNumber: he ? 'מספר הזמנה' : 'Order number',
  total: he ? 'סה״כ' : 'Total',
  items: he ? 'פריטים' : 'Items',
  tracking: he ? 'מעקב' : 'Tracking',
  status: he ? 'סטטוס' : 'Status',
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

function header(email?: string | null) {
  const h = el('h1', {}, el('img', { src: 'icons/icon48.png', alt: '' }), 'SHUPIT');
  const out: Node[] = [h];
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
            await clearSession();
            void start();
          },
        }),
      ),
    );
  }
  return out;
}

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'disconnected' || e.status === 401) return T.disconnected;
    if (e.code === 'not_a_product') return T.notProduct;
    if (e.code === 'not_an_order') return T.notOrder;
    if (e.code === 'no_status') return T.noStatus;
    if (e.code === 'unreadable') return T.unreadable;
    if (e.code === 'not_configured') return T.notConfigured;
    if (e.code === 'quota_exceeded') return T.quota;
  }
  return T.generic;
}

async function activePage(): Promise<PageCapture> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) throw new Error('unsupported');
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readPage });
  if (!res?.result) throw new Error('unsupported');
  return res.result as PageCapture;
}

function backButton() {
  return el('button', { class: 'btn', textContent: T.back, onclick: () => void home() });
}

// ---------------------------------------------------------------- views

async function start() {
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
  void home();
}

async function home() {
  const s = await getSession();
  render(
    ...header(s?.email),
    el('button', { class: 'btn primary', textContent: T.saveProduct, onclick: () => void productFlow() }),
    el('button', { class: 'btn', textContent: T.addOrder, onclick: () => void orderFlow() }),
    el('button', { class: 'btn', textContent: T.updateShipment, onclick: () => void shipmentFlow() }),
    el('p', { class: 'note' }, T.privacy),
  );
}

function busy(text: string) {
  render(...header(), el('p', {}, text));
}

function failure(e: unknown) {
  const msg = e instanceof Error && e.message === 'unsupported' ? T.unsupportedPage : errorText(e);
  render(...header(), el('p', { class: 'error' }, msg), backButton());
}

interface ProductPreview {
  data: {
    title: string;
    imageUrl: string | null;
    price: { amountMinor: number; currency: string } | null;
    priceDisplay: number | null;
    merchantId: string | null;
    canonicalUrl: string;
    aiFields: string[];
  };
}

async function productFlow() {
  busy(T.reading);
  try {
    const page = await activePage();
    const { data } = await api<ProductPreview>('/api/capture', { method: 'POST', body: { kind: 'product', page } });

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
        render(...header(), el('p', { class: 'ok' }, T.saved), backButton());
      } catch (e) {
        if (e instanceof ApiError && e.code === 'duplicate') {
          render(...header(), el('p', { class: 'ok' }, T.duplicate), backButton());
        } else {
          saveBtn.disabled = false;
          msg.className = 'error';
          msg.textContent = errorText(e);
        }
      }
    };

    render(
      ...header(),
      el('div', { class: 'card' }, el('label', {}, T.title, title), el('div', { class: 'row' }, el('span', {}, T.price), el('span', {}, priceLine))),
      msg,
      saveBtn,
      backButton(),
    );
  } catch (e) {
    failure(e);
  }
}

interface OrderPreview {
  data: {
    merchantName: string | null;
    orderNumber: string | null;
    purchaseDate: string | null;
    total: { amount: number; currency: string } | null;
    items: { title: string; quantity: number }[];
    shipments: { carrier: string | null; trackingNumber: string | null; status?: string | null; estimatedDelivery: string | null }[];
  };
  merchantId: string | null;
}

const isoNoon = (ymd: string | null) => (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? `${ymd}T12:00:00.000Z` : undefined);

async function orderFlow() {
  busy(T.reading);
  try {
    const page = withoutQuery(await activePage());
    const res = await api<OrderPreview>('/api/capture', { method: 'POST', body: { kind: 'order', page } });
    const d = res.data;
    const ship = d.shipments[0];
    const exp = d.total?.currency === 'JPY' ? 0 : 2;

    const row = (k: string, v: string | null | undefined) =>
      v ? el('div', { class: 'row' }, el('span', {}, k), el('span', {}, v)) : null;
    const msg = el('p', { class: 'note' }, T.checkDetails);
    const saveBtn = el('button', { class: 'btn primary', textContent: T.save });

    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      try {
        const aiFields = [
          ...(d.merchantName ? ['merchantName'] : []),
          ...(d.orderNumber ? ['externalOrderId'] : []),
          ...(d.purchaseDate ? ['purchasedAt'] : []),
          ...(d.total ? ['total'] : []),
          ...(d.items.length ? ['items'] : []),
        ];
        await api('/api/orders', {
          method: 'POST',
          body: {
            ...(res.merchantId ? { merchantId: res.merchantId } : {}),
            merchantName: d.merchantName ?? new URL(page.url).hostname,
            ...(d.orderNumber ? { externalOrderId: d.orderNumber } : {}),
            ...(isoNoon(d.purchaseDate) ? { purchasedAt: isoNoon(d.purchaseDate) } : {}),
            ...(d.total ? { total: { amountMinor: Math.round(d.total.amount * 10 ** exp), currency: d.total.currency } } : {}),
            items: d.items,
            shipments: ship
              ? [
                  {
                    ...(ship.carrier ? { carrier: ship.carrier } : {}),
                    ...(ship.trackingNumber ? { trackingNumber: ship.trackingNumber } : {}),
                    ...(isoNoon(ship.estimatedDelivery) ? { estimatedDeliveryAt: isoNoon(ship.estimatedDelivery) } : {}),
                    ...(ship.status ? { status: ship.status } : {}),
                  },
                ]
              : [],
            importSource: 'extension',
            aiFields,
          },
        });
        render(...header(), el('p', { class: 'ok' }, T.saved), backButton());
      } catch (e) {
        if (e instanceof ApiError && e.code === 'duplicate') {
          render(...header(), el('p', { class: 'ok' }, T.duplicateOrder), backButton());
        } else {
          saveBtn.disabled = false;
          msg.className = 'error';
          msg.textContent = errorText(e);
        }
      }
    };

    render(
      ...header(),
      el(
        'div',
        { class: 'card' },
        ...[
          row(T.store, d.merchantName),
          row(T.orderNumber, d.orderNumber),
          row(T.total, d.total ? `${d.total.amount} ${d.total.currency}` : null),
          row(T.items, d.items.length ? String(d.items.length) : null),
          row(T.tracking, [ship?.carrier, ship?.trackingNumber].filter(Boolean).join(' · ') || null),
          row(T.status, ship?.status ?? null),
        ].filter((n): n is HTMLDivElement => !!n),
      ),
      msg,
      saveBtn,
      backButton(),
    );
  } catch (e) {
    failure(e);
  }
}

interface ShipmentItem {
  id: string;
  merchantName: string;
  status: string;
  trackingNumber: string | null;
  carrier: string | null;
}

async function shipmentFlow() {
  busy(T.reading);
  try {
    const { shipments } = await api<{ shipments: ShipmentItem[] }>('/api/shipments-list');
    if (shipments.length === 0) {
      render(...header(), el('p', {}, T.noShipments), backButton());
      return;
    }
    const buttons = shipments.map((s) =>
      el('button', {
        class: 'btn',
        textContent: [s.merchantName, s.trackingNumber].filter(Boolean).join(' · ') || s.id,
        onclick: async () => {
          busy(T.reading);
          try {
            const page = withoutQuery(await activePage());
            await api(`/api/shipments-status?id=${encodeURIComponent(s.id)}`, {
              method: 'POST',
              body: { kind: 'order', page },
            });
            render(...header(), el('p', { class: 'ok' }, T.statusUpdated), backButton());
          } catch (e) {
            failure(e);
          }
        },
      }),
    );
    render(...header(), el('p', {}, T.pickShipment), ...buttons, backButton());
  } catch (e) {
    failure(e);
  }
}

void start();
