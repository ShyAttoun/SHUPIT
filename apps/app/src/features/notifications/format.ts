import type { AppNotification } from './hooks';

type T = (key: string, opts?: Record<string, unknown>) => string;

const money = (m: { amountMinor: number; currency: string } | null | undefined, lang: string) =>
  m
    ? new Intl.NumberFormat(lang, { style: 'currency', currency: m.currency }).format(
        m.amountMinor / 10 ** (new Intl.NumberFormat('en', { style: 'currency', currency: m.currency }).resolvedOptions().maximumFractionDigits ?? 2),
      )
    : '';

/** One-line, human description of a notification. */
export function notificationTitle(n: AppNotification, t: T, lang: string): string {
  switch (n.type) {
    case 'price_drop':
      return t('notifications.priceDrop', {
        product: n.productTitle ?? '',
        newPrice: money(n.newPrice, lang),
        percent: n.dropPercent != null ? Math.round(n.dropPercent) : '',
      });
    case 'target_reached':
      return t('notifications.targetReached', {
        product: n.productTitle ?? '',
        newPrice: money(n.newPrice, lang),
      });
    case 'shipment_eta':
      return t('notifications.eta', {
        merchant: n.merchantName ?? '',
        date: n.etaTo ? new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(n.etaTo)) : '',
      });
    default:
      return t(`notifications.status.${n.status ?? 'in_transit'}`, { merchant: n.merchantName ?? '' });
  }
}

/** Where tapping the notification should go. */
export function notificationRoute(n: AppNotification): string | null {
  if (n.type === 'price_drop' || n.type === 'target_reached') return n.productId ? `/product/${n.productId}` : null;
  return n.orderId ? `/order/${n.orderId}` : null;
}
