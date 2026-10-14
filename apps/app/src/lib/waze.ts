import { openExternal } from './platform';

/**
 * Opens navigation to a place in Waze. Uses exact coordinates when we have them, otherwise the address
 * text. The https link opens the Waze app when installed and Waze on the web otherwise.
 */
export function wazeUrl(target: { address?: string | null; lat?: number | null; lng?: number | null }): string | null {
  if (typeof target.lat === 'number' && typeof target.lng === 'number') {
    return `https://waze.com/ul?ll=${target.lat},${target.lng}&navigate=yes`;
  }
  const q = target.address?.trim();
  return q ? `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes` : null;
}

export async function openWaze(target: Parameters<typeof wazeUrl>[0]): Promise<void> {
  const url = wazeUrl(target);
  if (url) await openExternal(url);
}
