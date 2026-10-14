import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { apiFetch } from '@/lib/api';
import { haversineKm, type LatLng } from '@/lib/distance';
import type { ShipmentDoc } from './hooks';

/**
 * The device location is read only when the user asks for it, kept in memory for this session and
 * used purely on the device to compute distances. It is never sent to the server.
 */
export function useDeviceLocation() {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [state, setState] = useState<'idle' | 'asking' | 'denied' | 'unavailable'>('idle');
  const supported = Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.geolocation;

  const request = useCallback(() => {
    if (!supported) {
      setState('unavailable');
      return;
    }
    setState('asking');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
        setState('idle');
      },
      (e) => setState(e.code === 1 ? 'denied' : 'unavailable'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, [supported]);

  return { position, state, request, supported };
}

/** Coordinates for a shipment's pickup address: stored ones, or resolved once by the server. */
export function usePickupCoords(shipment: ShipmentDoc | undefined, enabled: boolean) {
  const stored =
    typeof shipment?.pickup?.lat === 'number' && typeof shipment.pickup.lng === 'number'
      ? { lat: shipment.pickup.lat, lng: shipment.pickup.lng }
      : null;
  const query = useQuery({
    queryKey: ['pickup-coords', shipment?.id],
    enabled: enabled && !!shipment && !!shipment.pickup?.address && !stored,
    staleTime: Infinity,
    retry: false,
    queryFn: async (): Promise<LatLng | null> => {
      const res = await apiFetch<{ located: boolean; lat?: number; lng?: number }>('/api/geocode', {
        method: 'POST',
        body: { shipmentId: shipment!.id },
      });
      return res.located && typeof res.lat === 'number' && typeof res.lng === 'number'
        ? { lat: res.lat, lng: res.lng }
        : null;
    },
  });
  return stored ?? query.data ?? null;
}

export function distanceFrom(position: LatLng | null, coords: LatLng | null): number | null {
  return position && coords ? haversineKm(position, coords) : null;
}
