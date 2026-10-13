import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { checkRate, memoryRateStore, windowStartMs } from '../api/_lib/rateLimit';
import { withAuth } from '../api/_lib/withAuth';

const rule = { bucket: 'api', limit: 3, windowSec: 60 };

test('fixed window: allows up to the limit, then blocks with a retry hint', async () => {
  const store = memoryRateStore();
  const t0 = 1_000_000_000_000;
  const results = [];
  for (let i = 0; i < 5; i++) results.push(await checkRate(store, 'u1', rule, t0));
  assert.deepEqual(results.map((r) => r.allowed), [true, true, true, false, false]);
  assert.ok(results[3]!.retryAfterSec >= 1 && results[3]!.retryAfterSec <= 60);
});

test('limits are per user, per bucket and reset in the next window', async () => {
  const store = memoryRateStore();
  const t0 = windowStartMs(1_000_000_000_000, 60);
  for (let i = 0; i < 4; i++) await checkRate(store, 'u1', rule, t0);
  assert.equal((await checkRate(store, 'u2', rule, t0)).allowed, true);
  assert.equal((await checkRate(store, 'u1', { ...rule, bucket: 'other' }, t0)).allowed, true);
  assert.equal((await checkRate(store, 'u1', rule, t0 + 61_000)).allowed, true);
});

test('withAuth returns 429 with Retry-After once the limit is exceeded', async () => {
  const store = memoryRateStore();
  const handler = withAuth(() => new Response('ok'), {
    verify: async () => ({ uid: 'u1' }) as DecodedIdToken,
    rate: { bucket: 'api', limit: 2, windowSec: 60 },
    store,
  });
  const req = () => new Request('http://x/api', { headers: { authorization: 'Bearer t' } });
  assert.equal((await handler(req())).status, 200);
  assert.equal((await handler(req())).status, 200);
  const blocked = await handler(req());
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
});

test('a failing rate store fails open instead of blocking users', async () => {
  const handler = withAuth(() => new Response('ok'), {
    verify: async () => ({ uid: 'u1' }) as DecodedIdToken,
    store: {
      async hit() {
        throw new Error('store down');
      },
    },
  });
  const res = await handler(new Request('http://x/api', { headers: { authorization: 'Bearer t' } }));
  assert.equal(res.status, 200);
});
