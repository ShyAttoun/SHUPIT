import { formatDistance, haversineKm } from './distance';

describe('distance', () => {
  it('computes Tel Aviv → Jerusalem roughly 54 km', () => {
    const km = haversineKm({ lat: 32.0853, lng: 34.7818 }, { lat: 31.7683, lng: 35.2137 });
    expect(km).toBeGreaterThan(50);
    expect(km).toBeLessThan(58);
  });
  it('is zero for the same point', () => {
    expect(haversineKm({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
  });
  it('formats short, medium and long distances', () => {
    expect(formatDistance(0.43, 'en')).toBe('430 m');
    expect(formatDistance(3.24, 'en')).toBe('3.2 km');
    expect(formatDistance(54.4, 'he')).toBe('54 ק״מ');
  });
});
