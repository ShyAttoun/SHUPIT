import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { addressKey, normalizeAddress } from '../api/_lib/geocode';

test('equal addresses normalize to one cache key regardless of case and spacing', () => {
  assert.equal(normalizeAddress('  Herzl   1,  Tel Aviv '), 'herzl 1, tel aviv');
  assert.equal(addressKey('Herzl 1, Tel Aviv'), addressKey('  herzl   1,  TEL aviv '));
  assert.notEqual(addressKey('Herzl 1, Tel Aviv'), addressKey('Herzl 2, Tel Aviv'));
});

test('addresses are length bounded', () => {
  assert.equal(normalizeAddress('x'.repeat(1000)).length, 300);
});
