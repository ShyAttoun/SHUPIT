import { formatMoney, type Money } from '@shupit/contracts';

export function formatPrice(m: Money | null | undefined, language: string): string | null {
  return m ? formatMoney(m, language) : null;
}

export function formatDate(iso: string | null | undefined, language: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(d);
}

export function formatDateTime(iso: string | null | undefined, language: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

/** Percent change from `from` to `to` (same currency only); null if not comparable. */
export function percentChange(from: Money, to: Money): number | null {
  if (from.currency !== to.currency || from.amountMinor <= 0) return null;
  return ((to.amountMinor - from.amountMinor) / from.amountMinor) * 100;
}
