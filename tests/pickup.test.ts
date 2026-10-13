import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { pickupFrom } from '../api/_lib/statusUpdate';
import { orderUpdateInput, shipmentCreateInput } from '@shupit/contracts';

test('pickup details map to the stored shape and keep the collection code', () => {
  const p = pickupFrom({
    name: 'Locker 12',
    address: 'Herzl 1, Tel Aviv',
    until: '2026-10-20',
    instructions: 'Bring ID',
    collectionCode: '4821',
  });
  assert.equal(p?.code, '4821');
  assert.equal(p?.until, '2026-10-20T23:59:00.000Z');
  assert.equal(p?.name, 'Locker 12');
});

test('empty or missing pickup yields nothing', () => {
  assert.equal(pickupFrom(null), undefined);
  assert.equal(pickupFrom({ name: null, address: null, until: null, instructions: null, collectionCode: null }), undefined);
  assert.equal(pickupFrom({ until: 'not a date' }), undefined);
});

test('order update requires at least one field and validates items', () => {
  assert.equal(orderUpdateInput.safeParse({}).success, false);
  assert.equal(orderUpdateInput.safeParse({ merchantName: 'KSP' }).success, true);
  assert.equal(orderUpdateInput.safeParse({ items: [{ title: '', quantity: 1 }] }).success, false);
  assert.equal(orderUpdateInput.safeParse({ total: null }).success, true);
});

test('shipment create requires an order id and bounds fields', () => {
  assert.equal(shipmentCreateInput.safeParse({}).success, false);
  assert.equal(shipmentCreateInput.safeParse({ orderId: 'o1', carrier: 'HFD' }).success, true);
  assert.equal(shipmentCreateInput.safeParse({ orderId: 'o1', status: 'teleported' }).success, false);
  assert.equal(shipmentCreateInput.safeParse({ orderId: 'o1', pickup: { code: 'x'.repeat(61) } }).success, false);
});
