import { parsePriceNumber, toMinor, type OrderCreateInput } from '@shupit/contracts';

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
  const hasShipment = !!(carrier || trackingNumber || eta);

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
            },
          ]
        : [],
    },
  };
}
