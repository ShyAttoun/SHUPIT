import type { Money } from './common';

/** ISO 4217 minor-unit exponent (ILS → 2, JPY → 0). */
export function currencyExponent(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function toMinor(amount: number, currency: string): number {
  return Math.round(amount * 10 ** currencyExponent(currency));
}

export function fromMinor(m: Money): number {
  return m.amountMinor / 10 ** currencyExponent(m.currency);
}

export function formatMoney(m: Money, locale = 'en'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: m.currency }).format(
      fromMinor(m),
    );
  } catch {
    return `${fromMinor(m)} ${m.currency}`;
  }
}

/**
 * Parses a user- or page-supplied price string ("1,299.90", "1.299,90", "₪89").
 * Returns null when it cannot be interpreted confidently.
 */
export function parsePriceNumber(input: string | number): number | null {
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? input : null;
  let s = input.replace(/[^\d.,-]/g, '').trim();
  if (!s || s === '-' || s.startsWith('-')) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSep = lastDot > lastComma ? '.' : ',';
    const thousandSep = decimalSep === '.' ? ',' : '.';
    s = s.split(thousandSep).join('').replace(decimalSep, '.');
  } else if (lastComma !== -1) {
    // "12,50" → decimal; "1,299" → thousands
    const digitsAfter = s.length - lastComma - 1;
    s = digitsAfter === 3 && s.indexOf(',') === lastComma ? s.replace(',', '') : s.replace(',', '.');
  } else if (lastDot !== -1) {
    const digitsAfter = s.length - lastDot - 1;
    if (digitsAfter === 3 && s.indexOf('.') !== lastDot) s = s.split('.').join('');
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
