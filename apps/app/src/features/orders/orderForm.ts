import {
  parsePriceNumber,
  toMinor,
  type OrderCreateInput,
  type PickupInput,
  type ShipmentStatus,
} from '@shupit/contracts';

export interface OrderFormValues {
  merchantId: string | null; // catalog id, or null for "other"
  merchantName: string;
  orderNumber: string;
  purchaseDate: string; // YYYY-MM-DD or ''
  total: string;
  currency: string;
  /** `thumb`: small picture cut from the user's screenshot (optional, never typed by the user). */
  items: { title: string; quantity: string; thumb?: string }[];
  carrier: string;
  trackingNumber: string;
  eta: string; // YYYY-MM-DD or ''
  /** Status read from a screenshot (unverified snapshot); not user-editable in the form. */
  status?: ShipmentStatus | null;
  /** Extra shipment details read from the screenshot; carried through unchanged. */
  extras?: {
    statusText?: string | null;
    estimatedDeliveryFrom?: string | null;
    events?: { description: string; occurredAt: string }[];
    pickup?: {
      name?: string | null;
      address?: string | null;
      until?: string | null;
      instructions?: string | null;
      collectionCode?: string | null;
    } | null;
  };
}

export type OrderFormErrors = Partial<
  Record<'merchantName' | 'purchaseDate' | 'total' | 'eta' | 'items', string>
>;

/** YYYY-MM-DD → ISO at 12:00Z, or null if not a real calendar date. */
export function dateToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d, 12));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString();
}

/** Page-read pickup details → API shape (collectionCode → code, until → ISO). */
export function pickupPayload(
  p:
    | {
        name?: string | null;
        address?: string | null;
        until?: string | null;
        instructions?: string | null;
        collectionCode?: string | null;
      }
    | null
    | undefined,
): PickupInput | undefined {
  if (!p) return undefined;
  const until = p.until ? eventToIso(p.until.length === 10 ? `${p.until}T23:59` : p.until) : null;
  const out: PickupInput = {
    ...(p.name ? { name: p.name } : {}),
    ...(p.address ? { address: p.address } : {}),
    ...(until ? { until } : {}),
    ...(p.instructions ? { instructions: p.instructions } : {}),
    ...(p.collectionCode ? { code: p.collectionCode } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

/** YYYY-MM-DD[THH:MM] (wall-clock as shown on the page) → ISO, or null. */
export function eventToIso(value: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(value);
  if (!m) return null;
  const iso = `${m[1]}T${m[2] ?? '12:00'}:00.000Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** Validates the form and returns either an API payload or field error keys (translated by the UI). */
export function buildOrderInput(
  v: OrderFormValues,
): { ok: true; input: OrderCreateInput } | { ok: false; errors: OrderFormErrors } {
  const errors: OrderFormErrors = {};
  if (!v.merchantName.trim()) errors.merchantName = 'required';

  let purchasedAt: string | undefined;
  if (v.purchaseDate.trim()) {
    const iso = dateToIso(v.purchaseDate);
    if (!iso) errors.purchaseDate = 'invalidDate';
    else purchasedAt = iso;
  }
  let eta: string | undefined;
  if (v.eta.trim()) {
    const iso = dateToIso(v.eta);
    if (!iso) errors.eta = 'invalidDate';
    else eta = iso;
  }

  let total: OrderCreateInput['total'];
  if (v.total.trim()) {
    const n = parsePriceNumber(v.total);
    const cur = v.currency.trim().toUpperCase();
    if (n === null || !/^[A-Z]{3}$/.test(cur)) errors.total = 'invalidTotal';
    else total = { amountMinor: toMinor(n, cur), currency: cur };
  }

  const items: OrderCreateInput['items'] = [];
  for (const it of v.items) {
    const title = it.title.trim();
    if (!title) continue;
    const q = Number(it.quantity || '1');
    if (!Number.isInteger(q) || q < 1 || q > 999) {
      errors.items = 'invalidQuantity';
      continue;
    }
    items.push({ title, quantity: q, ...(it.thumb ? { thumbDataUrl: it.thumb } : {}) });
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  const carrier = v.carrier.trim();
  const trackingNumber = v.trackingNumber.trim();
  const status = v.status ?? undefined;
  const hasShipment = !!(carrier || trackingNumber || eta || status);

  return {
    ok: true,
    input: {
      ...(v.merchantId ? { merchantId: v.merchantId } : {}),
      merchantName: v.merchantName.trim(),
      ...(v.orderNumber.trim() ? { externalOrderId: v.orderNumber.trim() } : {}),
      ...(purchasedAt ? { purchasedAt } : {}),
      ...(total ? { total } : {}),
      items,
      shipments: hasShipment
        ? [
            {
              ...(carrier ? { carrier } : {}),
              ...(trackingNumber ? { trackingNumber } : {}),
              ...(eta ? { estimatedDeliveryAt: eta } : {}),
              ...(status ? { status } : {}),
              ...(v.extras?.statusText ? { statusText: v.extras.statusText } : {}),
              ...(pickupPayload(v.extras?.pickup) ? { pickup: pickupPayload(v.extras?.pickup)! } : {}),
              ...(dateToIso(v.extras?.estimatedDeliveryFrom ?? '')
                ? { estimatedDeliveryFrom: dateToIso(v.extras?.estimatedDeliveryFrom ?? '')! }
                : {}),
              ...(v.extras?.events?.length
                ? {
                    events: v.extras.events
                      .map((e) => ({ description: e.description, occurredAt: eventToIso(e.occurredAt) }))
                      .filter((e): e is { description: string; occurredAt: string } => !!e.occurredAt),
                  }
                : {}),
            },
          ]
        : [],
    },
  };
}

export const emptyOrderForm = (currency: string): OrderFormValues => ({
  merchantId: null,
  merchantName: '',
  orderNumber: '',
  purchaseDate: '',
  total: '',
  currency,
  items: [{ title: '', quantity: '1' }],
  carrier: '',
  trackingNumber: '',
  eta: '',
});

/** AI field names, matching the provenance keys the API understands. */
export type AiField = 'merchantName' | 'externalOrderId' | 'purchasedAt' | 'total' | 'items';

/** Maps a model extraction into editable form values. Missing values stay empty (never guessed). */
export function draftFromExtraction(
  data: {
    merchantName: string | null;
    orderNumber: string | null;
    purchaseDate: string | null;
    total: { amount: number; currency: string | null } | null;
    items: { title: string; quantity: number }[];
    shipments: {
      carrier: string | null;
      trackingNumber: string | null;
      status?: ShipmentStatus | null;
      statusText?: string | null;
      estimatedDeliveryFrom?: string | null;
      estimatedDelivery: string | null;
      events?: { description: string; occurredAt: string }[];
      pickup?: {
        name?: string | null;
        address?: string | null;
        until?: string | null;
        instructions?: string | null;
        collectionCode?: string | null;
      } | null;
    }[];
  },
  merchant: { id: string; name: string } | null,
  fallbackCurrency: string,
): { values: OrderFormValues; aiFields: AiField[] } {
  const ship = data.shipments[0];
  const values: OrderFormValues = {
    merchantId: merchant?.id ?? null,
    merchantName: merchant?.name ?? data.merchantName ?? '',
    orderNumber: data.orderNumber ?? '',
    purchaseDate: data.purchaseDate ?? '',
    total: data.total ? String(data.total.amount) : '',
    currency: data.total?.currency ?? fallbackCurrency,
    items: data.items.length
      ? data.items.map((i) => ({ title: i.title, quantity: String(i.quantity) }))
      : [{ title: '', quantity: '1' }],
    carrier: ship?.carrier ?? '',
    trackingNumber: ship?.trackingNumber ?? '',
    eta: ship?.estimatedDelivery ?? '',
    status: ship?.status ?? null,
    extras: {
      statusText: ship?.statusText ?? null,
      estimatedDeliveryFrom: ship?.estimatedDeliveryFrom ?? null,
      events: ship?.events ?? [],
      pickup: ship?.pickup ?? null,
    },
  };
  const aiFields: AiField[] = [];
  if (values.merchantName) aiFields.push('merchantName');
  if (values.orderNumber) aiFields.push('externalOrderId');
  if (values.purchaseDate) aiFields.push('purchasedAt');
  if (values.total) aiFields.push('total');
  if (data.items.length) aiFields.push('items');
  return { values, aiFields };
}

/** Keeps only the AI fields the user did not change after extraction. */
export function unchangedAiFields(
  initial: OrderFormValues,
  current: OrderFormValues,
  aiFields: AiField[],
): AiField[] {
  const same: Record<AiField, boolean> = {
    merchantName: initial.merchantName === current.merchantName,
    externalOrderId: initial.orderNumber === current.orderNumber,
    purchasedAt: initial.purchaseDate === current.purchaseDate,
    total: initial.total === current.total && initial.currency === current.currency,
    items: JSON.stringify(initial.items) === JSON.stringify(current.items),
  };
  return aiFields.filter((f) => same[f]);
}

// ------------------------------------------------------------------ editing an existing order

import { fromMinor, type Order, type OrderUpdateInput } from '@shupit/contracts';

export function valuesFromOrder(o: Order, fallbackCurrency: string): OrderFormValues {
  return {
    merchantId: o.merchantId ?? null,
    merchantName: o.merchantName,
    orderNumber: o.externalOrderId ?? '',
    purchaseDate: o.purchasedAt ? o.purchasedAt.slice(0, 10) : '',
    total: o.total ? String(fromMinor(o.total)) : '',
    currency: o.total?.currency ?? fallbackCurrency,
    items: o.items.length
      ? o.items.map((i) => ({
          title: i.title,
          quantity: String(i.quantity),
          ...(i.thumbDataUrl ? { thumb: i.thumbDataUrl } : {}),
        }))
      : [{ title: '', quantity: '1' }],
    carrier: '',
    trackingNumber: '',
    eta: '',
  };
}

/**
 * Only the fields the user actually changed (so unchanged machine-read fields keep their provenance).
 * Item pictures are preserved by position/title match.
 */
export function diffOrderUpdate(
  existing: Order,
  v: OrderFormValues,
):
  | { ok: true; input: OrderUpdateInput | null }
  | { ok: false; errors: OrderFormErrors } {
  const built = buildOrderInput({ ...v, carrier: '', trackingNumber: '', eta: '' });
  if (!built.ok) return { ok: false, errors: built.errors };
  const n = built.input;
  const out: OrderUpdateInput = {};

  if (n.merchantName !== existing.merchantName) out.merchantName = n.merchantName;
  if ((n.merchantId ?? null) !== (existing.merchantId ?? null)) out.merchantId = n.merchantId ?? null;
  if ((n.externalOrderId ?? null) !== (existing.externalOrderId ?? null)) out.externalOrderId = n.externalOrderId ?? null;
  const prevDay = existing.purchasedAt ? existing.purchasedAt.slice(0, 10) : null;
  if ((n.purchasedAt ? n.purchasedAt.slice(0, 10) : null) !== prevDay) out.purchasedAt = n.purchasedAt ?? null;
  const t0 = existing.total ?? null;
  const t1 = n.total ?? null;
  if ((t0?.amountMinor ?? null) !== (t1?.amountMinor ?? null) || (t0?.currency ?? null) !== (t1?.currency ?? null)) {
    out.total = t1;
  }

  const prevItems = existing.items.map((i) => ({ title: i.title, quantity: i.quantity }));
  const nextPlain = n.items.map((i) => ({ title: i.title, quantity: i.quantity }));
  if (JSON.stringify(prevItems) !== JSON.stringify(nextPlain)) {
    out.items = n.items.map((it) => {
      const old = existing.items.find((o) => o.title === it.title);
      return {
        ...it,
        ...(old?.imageUrl ? { imageUrl: old.imageUrl } : {}),
        ...(old?.thumbDataUrl ? { thumbDataUrl: old.thumbDataUrl } : {}),
        ...(old?.productUrl ? { productUrl: old.productUrl } : {}),
      };
    });
  }
  return { ok: true, input: Object.keys(out).length ? out : null };
}
