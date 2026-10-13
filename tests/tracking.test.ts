import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { mapMilestone, parseShip24, eventId } from '../api/_lib/tracking/ship24';
import { isTerminal, nextCheckDelayMinutes, notificationsFor } from '../api/_lib/tracking/refresh';
import { ProviderError } from '../api/_lib/tracking/types';

test('mapMilestone covers every documented milestone', () => {
  assert.equal(mapMilestone('info_received'), 'processing');
  assert.equal(mapMilestone('in_transit'), 'in_transit');
  assert.equal(mapMilestone('in_transit', 'customs'), 'customs');
  assert.equal(mapMilestone('out_for_delivery'), 'out_for_delivery');
  assert.equal(mapMilestone('failed_attempt'), 'exception');
  assert.equal(mapMilestone('available_for_pickup'), 'ready_for_pickup');
  assert.equal(mapMilestone('delivered'), 'delivered');
  assert.equal(mapMilestone('exception'), 'exception');
  assert.equal(mapMilestone('pending'), 'unknown');
  assert.equal(mapMilestone('something_new'), 'unknown');
  assert.equal(mapMilestone(undefined), 'unknown');
});

const body = {
  data: {
    trackings: [
      {
        shipment: { statusMilestone: 'out_for_delivery', delivery: { estimatedDeliveryDate: '2026-10-20T00:00:00Z' } },
        events: [
          { occurrenceDatetime: '2026-10-18T08:00:00Z', status: 'Departed facility', statusMilestone: 'in_transit', location: 'Tel Aviv' },
          { occurrenceDatetime: '2026-10-19T07:00:00Z', status: 'Out for delivery', statusMilestone: 'out_for_delivery', location: null },
          { status: 'no time → dropped', statusMilestone: 'in_transit' },
        ],
      },
    ],
  },
};

test('parseShip24 normalizes status, ETA and orders events newest-first', () => {
  const s = parseShip24(body, 'RR1');
  assert.equal(s.status, 'out_for_delivery');
  assert.equal(s.estimatedDeliveryAt, '2026-10-20T00:00:00.000Z');
  assert.equal(s.events.length, 2);
  assert.equal(s.events[0]!.status, 'out_for_delivery');
  assert.equal(s.notFoundYet, false);
});

test('parseShip24 ids are stable (idempotent writes)', () => {
  const a = parseShip24(body, 'RR1').events.map((e) => e.id);
  const b = parseShip24(body, 'RR1').events.map((e) => e.id);
  assert.deepEqual(a, b);
  assert.notEqual(eventId('RR1', { occurrenceDatetime: 'x', status: 'a' }), eventId('RR2', { occurrenceDatetime: 'x', status: 'a' }));
});

test('parseShip24: pending / empty → notFoundYet, never a fabricated status', () => {
  const s = parseShip24({ data: { trackings: [{ shipment: { statusMilestone: 'pending' }, events: [] }] } }, 'RR1');
  assert.equal(s.status, 'unknown');
  assert.equal(s.notFoundYet, true);
  assert.equal(parseShip24({ data: { trackings: [] } }, 'RR1').notFoundYet, true);
});

test('parseShip24 fails closed on an unexpected shape', () => {
  assert.throws(() => parseShip24({ nope: true }, 'RR1'), ProviderError);
  assert.throws(() => parseShip24(null, 'RR1'), ProviderError);
});

test('delivered shipments drop the ETA', () => {
  const s = parseShip24({ data: { trackings: [{ shipment: { statusMilestone: 'delivered', delivery: { estimatedDeliveryDate: '2026-10-20T00:00:00Z' } }, events: [] }] } }, 'RR1');
  assert.equal(s.estimatedDeliveryAt, undefined);
});

test('check cadence: terminal never, faster when closer, capped backoff', () => {
  assert.equal(isTerminal('delivered'), true);
  assert.equal(nextCheckDelayMinutes('delivered'), 0);
  assert.ok(nextCheckDelayMinutes('out_for_delivery') < nextCheckDelayMinutes('in_transit'));
  assert.equal(nextCheckDelayMinutes('in_transit', 10), 24 * 60);
});

test('notifications: meaningful transitions only, no repeats, deduped keys', () => {
  const prev = { status: 'in_transit' as const };
  assert.deepEqual(notificationsFor('s1', prev, { status: 'in_transit' }), []);
  assert.deepEqual(notificationsFor('s1', prev, { status: 'unknown' }), []);
  const n = notificationsFor('s1', prev, { status: 'out_for_delivery' });
  assert.equal(n.length, 1);
  assert.equal(n[0]!.dedupeKey, 's1:status:out_for_delivery');
});

test('ETA change notifies only for carrier-verified ETAs moving >= 1 day', () => {
  const base = { status: 'in_transit' as const, estimatedDeliveryAt: '2026-10-20T00:00:00.000Z' };
  const next = { status: 'in_transit' as const, estimatedDeliveryAt: '2026-10-23T00:00:00.000Z' };
  assert.equal(notificationsFor('s1', { ...base, hasCarrierEta: false }, next).length, 0); // user-entered ETA
  assert.equal(notificationsFor('s1', { ...base, hasCarrierEta: true }, next).length, 1);
  assert.equal(
    notificationsFor('s1', { ...base, hasCarrierEta: true }, { ...next, estimatedDeliveryAt: '2026-10-20T06:00:00.000Z' }).length,
    0,
  );
});
