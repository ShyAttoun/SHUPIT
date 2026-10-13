import { buildOrderInput, dateToIso, type OrderFormValues } from './orderForm';

const base: OrderFormValues = {
  merchantId: 'ksp',
  merchantName: 'KSP',
  orderNumber: ' 12345 ',
  purchaseDate: '2026-10-01',
  total: '1,299.90',
  currency: 'ils',
  items: [
    { title: 'Cable', quantity: '2' },
    { title: '  ', quantity: '1' },
  ],
  carrier: 'Israel Post',
  trackingNumber: 'RR123456789IL',
  eta: '2026-10-20',
};

describe('dateToIso', () => {
  it('accepts real dates and rejects impossible ones', () => {
    expect(dateToIso('2026-10-01')).toBe('2026-10-01T12:00:00.000Z');
    expect(dateToIso('2026-02-30')).toBeNull();
    expect(dateToIso('01/10/2026')).toBeNull();
  });
});

describe('buildOrderInput', () => {
  it('builds a normalized payload', () => {
    const r = buildOrderInput(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.externalOrderId).toBe('12345');
    expect(r.input.total).toEqual({ amountMinor: 129990, currency: 'ILS' });
    expect(r.input.items).toEqual([{ title: 'Cable', quantity: 2 }]);
    expect(r.input.shipments).toHaveLength(1);
    expect(r.input.shipments[0]?.estimatedDeliveryAt).toBe('2026-10-20T12:00:00.000Z');
  });

  it('creates no shipment when no tracking info is given', () => {
    const r = buildOrderInput({ ...base, carrier: '', trackingNumber: '', eta: '' });
    expect(r.ok && r.input.shipments).toEqual([]);
  });

  it('reports field errors instead of guessing', () => {
    const r = buildOrderInput({ ...base, merchantName: '', purchaseDate: 'x', total: 'abc' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(['merchantName', 'purchaseDate', 'total']);
  });
});
