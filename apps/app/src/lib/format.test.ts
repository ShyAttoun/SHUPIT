import { formatDate, percentChange } from './format';

describe('format', () => {
  it('percentChange is same-currency only', () => {
    expect(percentChange({ amountMinor: 10000, currency: 'ILS' }, { amountMinor: 8000, currency: 'ILS' })).toBe(-20);
    expect(percentChange({ amountMinor: 10000, currency: 'USD' }, { amountMinor: 8000, currency: 'ILS' })).toBeNull();
  });
  it('formatDate handles missing and invalid input', () => {
    expect(formatDate(null, 'en')).toBeNull();
    expect(formatDate('nope', 'en')).toBeNull();
    expect(formatDate('2026-10-13T10:00:00Z', 'en')).toMatch(/2026/);
  });
});
