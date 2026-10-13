import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { GET as health } from '../api/health';
import { bearerToken } from '../api/_lib/http';
import { withAuth } from '../api/_lib/withAuth';

const fakeUser = { uid: 'u1', email: 'a@b.c' } as DecodedIdToken;
const req = (auth?: string) =>
  new Request('http://x/api/me', { headers: auth ? { authorization: auth } : {} });

test('health is public and ok', async () => {
  const res = health();
  assert.equal(res.status, 200);
  assert.equal(((await res.json()) as { ok: boolean }).ok, true);
});

test('bearerToken parsing', () => {
  assert.equal(bearerToken(req('Bearer abc')), 'abc');
  assert.equal(bearerToken(req('bearer abc')), 'abc');
  assert.equal(bearerToken(req('Basic abc')), null);
  assert.equal(bearerToken(req()), null);
});

test('withAuth rejects missing and invalid tokens', async () => {
  const handler = withAuth(() => new Response('ok'), {
    rate: false,
    verify: async () => {
      throw new Error('bad');
    },
  });
  assert.equal((await handler(req())).status, 401);
  assert.equal((await handler(req('Bearer nope'))).status, 401);
});

test('withAuth passes verified user to handler', async () => {
  const handler = withAuth((_r, u) => new Response(u.uid), { rate: false, verify: async () => fakeUser });
  const res = await handler(req('Bearer good'));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'u1');
});

test('withAuth maps handler crashes to 500 without leaking details', async () => {
  const handler = withAuth(
    () => {
      throw new Error('secret db detail');
    },
    { rate: false, verify: async () => fakeUser },
  );
  const res = await handler(req('Bearer good'));
  assert.equal(res.status, 500);
  assert.ok(!(await res.text()).includes('secret'));
});
