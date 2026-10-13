import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { statusUpdateFrom } from '../api/_lib/statusUpdate';

const ship = (over: Partial<{ trackingNumber: string | null; status: any; estimatedDelivery: string | null }>) => ({
  carrier: null,
  trackingNumber: null,
  status: null,
  estimatedDelivery: null,
  ...over,
});

test('returns null when the screenshot shows no status', () => {
  assert.equal(statusUpdateFrom({ shipments: [ship({})] }, 'RR1'), null);
  assert.equal(statusUpdateFrom({ shipments: [] }, 'RR1'), null);
});

test('matches by tracking number, ignoring case and punctuation', () => {
  const r = statusUpdateFrom(
    { shipments: [ship({ trackingNumber: 'AA1', status: 'shipped' }), ship({ trackingNumber: 'rr-1', status: 'in_transit' })] },
    'RR1',
  );
  assert.equal(r?.status, 'in_transit');
});

test('uses the only shipment when numbers differ; refuses to guess among several', () => {
  assert.equal(statusUpdateFrom({ shipments: [ship({ trackingNumber: '9', status: 'ready_for_pickup' })] }, 'RR1')?.status, 'ready_for_pickup');
  assert.equal(
    statusUpdateFrom({ shipments: [ship({ trackingNumber: 'A', status: 'shipped' }), ship({ trackingNumber: 'B', status: 'delivered' })] }, 'RR1'),
    null,
  );
});

test('drops ETA once delivered', () => {
  const r = statusUpdateFrom({ shipments: [ship({ status: 'delivered', estimatedDelivery: '2026-10-20' })] }, null);
  assert.equal(r?.estimatedDeliveryAt, undefined);
});
