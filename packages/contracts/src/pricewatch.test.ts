import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { dropPercent } from './pricewatch';

test('dropPercent computes same-currency drops', () => {
  const p = dropPercent(
    { amountMinor: 10000, currency: 'ILS' },
    { amountMinor: 8000, currency: 'ILS' },
  );
  assert.equal(p, 20);
});

test('dropPercent refuses cross-currency comparison', () => {
  const p = dropPercent(
    { amountMinor: 10000, currency: 'USD' },
    { amountMinor: 8000, currency: 'ILS' },
  );
  assert.equal(p, null);
});

test('dropPercent is negative on price increase', () => {
  const p = dropPercent(
    { amountMinor: 5000, currency: 'ILS' },
    { amountMinor: 6000, currency: 'ILS' },
  );
  assert.equal(p, -20);
});
