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

import { draftFromExtraction, emptyOrderForm, unchangedAiFields } from './orderForm';

describe('draftFromExtraction', () => {
  const data = {
    merchantName: 'KSP',
    orderNumber: '555',
    purchaseDate: '2026-10-02',
    total: { amount: 99.9, currency: 'ILS' },
    items: [{ title: 'Cable', quantity: 2 }],
    shipments: [{ carrier: null, trackingNumber: 'RR1', estimatedDelivery: null }],
  };
  it('fills values and lists AI fields', () => {
    const r = draftFromExtraction(data, { id: 'ksp', name: 'KSP' }, 'USD');
    expect(r.values.merchantId).toBe('ksp');
    expect(r.values.currency).toBe('ILS');
    expect(r.values.trackingNumber).toBe('RR1');
    expect(r.aiFields.sort()).toEqual(['externalOrderId', 'items', 'merchantName', 'purchasedAt', 'total']);
  });
  it('leaves unknowns empty and falls back to the default currency', () => {
    const r = draftFromExtraction(
      { merchantName: null, orderNumber: null, purchaseDate: null, total: null, items: [], shipments: [] },
      null,
      'USD',
    );
    expect(r.values.currency).toBe('USD');
    expect(r.values.merchantName).toBe('');
    expect(r.aiFields).toEqual([]);
  });
  it('drops AI provenance for edited fields only', () => {
    const { values, aiFields } = draftFromExtraction(data, null, 'USD');
    const edited = { ...values, total: '120', orderNumber: '555' };
    expect(unchangedAiFields(values, edited, aiFields).sort()).toEqual(
      ['externalOrderId', 'items', 'merchantName', 'purchasedAt'],
    );
    expect(unchangedAiFields(values, emptyOrderForm('USD'), aiFields)).toEqual([]);
  });
});

import { diffOrderUpdate, valuesFromOrder } from './orderForm';
import type { Order } from '@shupit/contracts';

const order: Order = {
  id: 'o1',
  merchantId: 'ksp',
  merchantName: 'KSP',
  externalOrderId: '555',
  purchasedAt: '2026-10-01T12:00:00.000Z',
  total: { amountMinor: 9990, currency: 'ILS' },
  items: [{ title: 'Cable', quantity: 2, imageUrl: 'https://cdn.x/c.jpg' }],
  importSource: 'screenshot',
  provenance: {},
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
};

describe('diffOrderUpdate', () => {
  it('reports no change when nothing was edited', () => {
    const r = diffOrderUpdate(order, valuesFromOrder(order, 'ILS'));
    expect(r).toEqual({ ok: true, input: null });
  });

  it('includes only the edited fields', () => {
    const v = { ...valuesFromOrder(order, 'ILS'), orderNumber: '556' };
    const r = diffOrderUpdate(order, v);
    expect(r).toEqual({ ok: true, input: { externalOrderId: '556' } });
  });

  it('keeps item pictures when only quantities change', () => {
    const v = { ...valuesFromOrder(order, 'ILS'), items: [{ title: 'Cable', quantity: '3' }] };
    const r = diffOrderUpdate(order, v);
    expect(r.ok && r.input?.items).toEqual([{ title: 'Cable', quantity: 3, imageUrl: 'https://cdn.x/c.jpg' }]);
  });

  it('can clear the total and reports validation problems', () => {
    expect(diffOrderUpdate(order, { ...valuesFromOrder(order, 'ILS'), total: '' })).toEqual({
      ok: true,
      input: { total: null },
    });
    const bad = diffOrderUpdate(order, { ...valuesFromOrder(order, 'ILS'), purchaseDate: 'x' });
    expect(bad.ok).toBe(false);
  });
});
