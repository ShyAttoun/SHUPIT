import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { generateKey, hashKey, looksLikeKey } from '../api/_lib/automation';
import { matchShipment } from '../api/_lib/smsMatch';

test('keys have a recognizable prefix, are long, and hash deterministically', () => {
  const k = generateKey();
  assert.ok(looksLikeKey(k));
  assert.notEqual(generateKey(), k);
  assert.equal(hashKey(k), hashKey(k));
  assert.notEqual(hashKey(k), k);
  assert.ok(!looksLikeKey('shp_short'));
  assert.ok(!looksLikeKey(null));
});

test('a tracking number in the message wins over everything else', () => {
  const r = matchShipment(['hfd-0091122'], [
    { id: 'a', status: 'in_transit', trackingNumber: 'RR778899IL' },
    { id: 'b', status: 'ready_for_pickup', trackingNumber: 'HFD0091122' },
  ]);
  assert.deepEqual(r, { shipmentId: 'b', by: 'tracking' });
});

test('without a tracking number only an unambiguous shipment is used', () => {
  assert.deepEqual(matchShipment([], [{ id: 'a', status: 'in_transit' }]), { shipmentId: 'a', by: 'only_open' });
  assert.deepEqual(
    matchShipment([], [
      { id: 'a', status: 'in_transit' },
      { id: 'b', status: 'ready_for_pickup' },
    ]),
    { shipmentId: 'b', by: 'only_ready' },
  );
  assert.deepEqual(
    matchShipment([], [
      { id: 'a', status: 'in_transit' },
      { id: 'b', status: 'shipped' },
    ]),
    { shipmentId: null, reason: 'ambiguous' },
  );
});

test('delivered shipments are never matched', () => {
  assert.deepEqual(matchShipment([], [{ id: 'a', status: 'delivered' }]), { shipmentId: null, reason: 'no_open_shipments' });
});
