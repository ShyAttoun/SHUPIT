import { createHash } from 'node:crypto';

/** imageUrl may only be one of the URLs actually present on the page; anything else is dropped. */
export function sanitizeItemImages<T extends { imageUrl?: string | null }>(
  items: T[],
  allowed: string[] | undefined,
): (T & { imageUrl?: string })[] {
  const set = new Set(allowed ?? []);
  return items.map((it) => {
    const { imageUrl, ...rest } = it;
    return (imageUrl && set.has(imageUrl) ? { ...rest, imageUrl } : rest) as T & { imageUrl?: string };
  });
}

/**
 * Page events carry no time zone. We keep the wall-clock time exactly as shown by
 * storing it as UTC; the UI renders these with timeZone=UTC so it reads as written.
 */
export function eventTimeToIso(value: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(value);
  if (!m) return null;
  const iso = `${m[1]}T${m[2] ?? '12:00'}:00.000Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

export function toEventDocs(
  shipmentId: string,
  events: { description: string; occurredAt: string }[] | undefined,
  source: string,
): { id: string; doc: Record<string, unknown> }[] {
  const out: { id: string; doc: Record<string, unknown> }[] = [];
  for (const e of events ?? []) {
    const occurredAt = eventTimeToIso(e.occurredAt);
    if (!occurredAt) continue;
    const id = createHash('sha1').update(`${shipmentId}|${occurredAt}|${e.description}`).digest('hex').slice(0, 20);
    out.push({
      id,
      doc: { id, shipmentId, description: e.description, occurredAt, source, timeIsWallClock: true },
    });
  }
  return out;
}
