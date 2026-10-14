import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { sanitizeCoupons } from '../api/_lib/coupons';

test('codes must literally appear in text sources', () => {
  const text = 'Use code SAVE10 for 10% off. Also WELCOME15 at checkout.';
  const out = sanitizeCoupons(
    [{ code: 'save10' }, { code: 'WELCOME15' }, { code: 'INVENTED99' }],
    text,
  );
  assert.deepEqual(out.map((c) => c.code), ['SAVE10', 'WELCOME15']);
});

test('shape is enforced and duplicates removed', () => {
  const out = sanitizeCoupons(
    [{ code: 'ab' }, { code: 'has space' }, { code: 'GOOD-1' }, { code: 'good-1' }, { code: 'https://x.y' }],
    null,
  );
  assert.deepEqual(out.map((c) => c.code), ['GOOD-1']);
});

test('only full valid dates are kept', () => {
  const out = sanitizeCoupons(
    [{ code: 'AAA1', expiresAt: '2026-12-31' }, { code: 'BBB2', expiresAt: 'soon' }],
    null,
  );
  assert.equal(out[0]!.expiresAt, '2026-12-31');
  assert.equal(out[1]!.expiresAt, undefined);
});
