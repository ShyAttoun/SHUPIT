import { wazeUrl } from './waze';

describe('wazeUrl', () => {
  it('prefers exact coordinates', () => {
    expect(wazeUrl({ address: 'x', lat: 32.1, lng: 34.8 })).toBe('https://waze.com/ul?ll=32.1,34.8&navigate=yes');
  });
  it('falls back to the encoded address', () => {
    expect(wazeUrl({ address: 'הרצל 5, תל אביב' })).toBe(
      `https://waze.com/ul?q=${encodeURIComponent('הרצל 5, תל אביב')}&navigate=yes`,
    );
  });
  it('returns null with nothing to navigate to', () => {
    expect(wazeUrl({ address: '  ' })).toBeNull();
    expect(wazeUrl({})).toBeNull();
  });
});
