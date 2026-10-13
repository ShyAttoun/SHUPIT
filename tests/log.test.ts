import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { hashId, redact, redactString } from '../api/_lib/log';

test('emails, bearer tokens, JWTs and long secrets are scrubbed from strings', () => {
  const s = redactString(
    'user shy.attoun@example.com sent Bearer abcdef1234567890 and eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJlMTIzNDU2 plus ' +
      'A'.repeat(60),
  );
  assert.ok(!s.includes('shy.attoun@example.com'));
  assert.ok(!s.includes('abcdef1234567890'));
  assert.ok(!s.includes('eyJhbGciOiJSUzI1NiJ9'));
  assert.ok(!s.includes('A'.repeat(40)));
  assert.match(s, /s\*\*\*@example\.com/);
});

test('URL query strings (which may carry tokens) are dropped', () => {
  const s = redactString('GET https://il.shein.com/user/orders/detail/X?msgId=SECRET123&requestId=abc failed');
  assert.ok(!s.includes('SECRET123'));
  assert.match(s, /https:\/\/il\.shein\.com\/user\/orders\/detail\/X\?\[redacted\]/);
});

test('sensitive keys are redacted at any depth and arrays/depth are bounded', () => {
  const out = redact({
    route: '/api/orders',
    authorization: 'Bearer abc',
    nested: { email: 'a@b.co', imageBase64: 'AAAA', ok: 'fine', deep: { a: { b: { c: { d: 1 } } } } },
    list: Array.from({ length: 50 }, (_, i) => i),
  }) as Record<string, unknown>;
  assert.equal(out.authorization, '[redacted]');
  const nested = out.nested as Record<string, unknown>;
  assert.equal(nested.email, '[redacted]');
  assert.equal(nested.imageBase64, '[redacted]');
  assert.equal(nested.ok, 'fine');
  assert.equal((out.list as unknown[]).length, 20);
  assert.equal(JSON.stringify(out).includes('"d":1'), false);
});

test('hashed ids are stable, short and do not reveal the uid', () => {
  const h = hashId('user-123456');
  assert.equal(h, hashId('user-123456'));
  assert.equal(h.length, 10);
  assert.ok(!h.includes('user'));
});
