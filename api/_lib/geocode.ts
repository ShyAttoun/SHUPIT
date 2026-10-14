import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';

export interface Coords {
  lat: number;
  lng: number;
}

const NEGATIVE_TTL_MS = 7 * 86_400_000;

/** Normalizes an address so equal addresses share one cache entry. */
export function normalizeAddress(address: string): string {
  return address.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 300);
}

export const addressKey = (address: string) =>
  createHash('sha256').update(normalizeAddress(address)).digest('hex').slice(0, 40);

/**
 * Resolves an address to coordinates through OpenStreetMap Nominatim (public usage policy: identify
 * the app, low volume, cache results). Results — including "not found" — are cached server-side.
 * Only the address text is sent; no user identifier.
 */
export async function geocodeAddress(
  db: Firestore,
  address: string,
  fetchImpl: typeof fetch = fetch,
  now = new Date(),
): Promise<Coords | null> {
  const clean = normalizeAddress(address);
  if (clean.length < 4) return null;

  const ref = db.collection('geocodeCache').doc(addressKey(clean));
  const cached = await ref.get();
  if (cached.exists) {
    const lat = cached.get('lat') as number | null;
    const lng = cached.get('lng') as number | null;
    if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
    const at = Date.parse(cached.get('updatedAt') as string);
    if (Number.isFinite(at) && now.getTime() - at < NEGATIVE_TTL_MS) return null; // known miss
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', clean);

  let coords: Coords | null = null;
  try {
    const res = await fetchImpl(url, {
      headers: { 'user-agent': 'SHUPIT/1.0 (https://shupit.vercel.app)', accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null; // transient: do not cache
    const rows = (await res.json()) as { lat?: string; lon?: string }[];
    const first = rows[0];
    const lat = Number(first?.lat);
    const lng = Number(first?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      coords = { lat, lng };
    }
  } catch {
    return null; // transient: do not cache
  }

  await ref.set({
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    updatedAt: now.toISOString(),
  });
  return coords;
}
