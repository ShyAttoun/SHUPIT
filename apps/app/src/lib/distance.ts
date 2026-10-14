export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in kilometers. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "450 m" under 1 km, "3.2 km" under 10 km, otherwise whole kilometers. */
export function formatDistance(km: number, language: 'en' | 'he'): string {
  const m = language === 'he' ? 'מ׳' : 'm';
  const k = language === 'he' ? 'ק״מ' : 'km';
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} ${m}`;
  if (km < 10) return `${km.toFixed(1)} ${k}`;
  return `${Math.round(km)} ${k}`;
}
