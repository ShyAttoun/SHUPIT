import { parsePriceNumber, toMinor, type OrderCreateInput, type ShipmentStatus } from '@shupit/contracts';

export interface OrderFormValues {
  merchantId: string | null; // catalog id, or null for "other"
  merchantName: string;
  orderNumber: string;
  purchaseDate: string; // YYYY-MM-DD or ''
  total: string;
  currency: string;
  items: { title: string; quantity: string }[];
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
    items.push({ title, quantity: q });
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
    total: { amount: number; currency: string } | null;
    items: { title: string; quantity: number }[];
    shipments: {
      carrier: string | null;
      trackingNumber: string | null;
      status?: ShipmentStatus | null;
      statusText?: string | null;
      estimatedDeliveryFrom?: string | null;
      estimatedDelivery: string | null;
      events?: { description: string; occurredAt: string }[];
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
