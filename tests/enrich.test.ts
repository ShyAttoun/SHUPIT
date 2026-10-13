import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { eventTimeToIso, sanitizeItemImages, toEventDocs } from '../api/_lib/orderEnrich';
import { statusUpdateFrom } from '../api/_lib/statusUpdate';

test('item images are kept only when they exist on the page', () => {
  const items = [
    { title: 'a', quantity: 1, imageUrl: 'https://cdn.x/a.jpg' },
    { title: 'b', quantity: 1, imageUrl: 'https://evil.example/b.jpg' },
    { title: 'c', quantity: 1, imageUrl: null },
  ];
  const out = sanitizeItemImages(items, ['https://cdn.x/a.jpg']);
  assert.equal(out[0]!.imageUrl, 'https://cdn.x/a.jpg');
  assert.equal(out[1]!.imageUrl, undefined);
  assert.equal(out[2]!.imageUrl, undefined);
  assert.equal(sanitizeItemImages(items, undefined)[0]!.imageUrl, undefined);
});

test('event times: wall-clock stored as written, bad input rejected', () => {
  assert.equal(eventTimeToIso('2026-10-13T16:46'), '2026-10-13T16:46:00.000Z');
  assert.equal(eventTimeToIso('2026-10-13'), '2026-10-13T12:00:00.000Z');
  assert.equal(eventTimeToIso('13/10/2026'), null);
  // Full ISO as sent by the app/extension when saving an order must NOT be dropped.
  assert.equal(eventTimeToIso('2026-10-13T16:46:00.000Z'), '2026-10-13T16:46:00.000Z');
  assert.equal(eventTimeToIso('2026-10-13T16:46:00+03:00'), '2026-10-13T13:46:00.000Z');
  assert.equal(eventTimeToIso('2026-13-45'), null);
});

test('event docs are idempotent and skip invalid dates', () => {
  const ev = [
    { description: 'Package handed over', occurredAt: '2026-10-13T16:46' },
    { description: 'Bad', occurredAt: 'nope' },
  ];
  const a = toEventDocs('s1', ev, 'page');
  const b = toEventDocs('s1', ev, 'page');
  assert.equal(a.length, 1);
  assert.equal(a[0]!.id, b[0]!.id);
  assert.notEqual(toEventDocs('s2', ev, 'page')[0]!.id, a[0]!.id);
});

test('status update carries wording, delivery window and events', () => {
  const r = statusUpdateFrom(
    {
      shipments: [
        {
          carrier: 'HFD',
          trackingNumber: '96894192',
          status: 'in_transit',
          statusText: 'Arrived at the airport ahead of departure',
          estimatedDeliveryFrom: '2026-10-19',
          estimatedDelivery: '2026-10-25',
          events: [{ description: 'Package transferred to destination', occurredAt: '2026-10-13T16:46' }],
        },
      ],
    },
    '96894192',
  );
  assert.equal(r?.status, 'in_transit');
  assert.equal(r?.statusText, 'Arrived at the airport ahead of departure');
  assert.equal(r?.estimatedDeliveryFrom, '2026-10-19T12:00:00.000Z');
  assert.equal(r?.estimatedDeliveryAt, '2026-10-25T12:00:00.000Z');
  assert.equal(r?.events.length, 1);
});
