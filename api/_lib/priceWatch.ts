import {
  alertableKinds,
  dropPercent,
  type Money,
  type ObservationKind,
} from '@shupit/contracts';

export interface PreviousObservation {
  price: Money;
  kind: ObservationKind;
  variantKey: string;
}

export interface Subscription {
  enabled: boolean;
  targetPrice?: Money | null;
  minDropPercent?: number | null;
}

export type PriceAlert =
  | { type: 'price_drop'; dedupeKey: string; dropPercent: number; oldPrice: Money; newPrice: Money }
  | { type: 'target_reached'; dedupeKey: string; oldPrice: Money | null; newPrice: Money; target: Money };

export interface Evaluation {
  /** Percent change vs the previous comparable verified observation (negative = price went up). */
  dropPercent: number | null;
  comparedWith: Money | null;
  alerts: PriceAlert[];
  reason: 'ok' | 'not_alertable' | 'no_subscription' | 'no_previous' | 'currency_mismatch' | 'no_change';
}

/** Variant key: same string → comparable. Empty means "no variant information". */
export const variantKeyOf = (variant: string | undefined | null) =>
  (variant ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Picks the latest previous observation that can be compared: same variant, alertable (verified)
 * kind. Different currency is reported separately so we never compare across currencies.
 */
export function pickComparable(
  history: PreviousObservation[],
  variantKey: string,
): PreviousObservation | null {
  for (const o of history) {
    if (o.variantKey === variantKey && alertableKinds.includes(o.kind)) return o;
  }
  return null;
}

/**
 * Pure alert decision. `history` is newest-first. Alerts only come from verified kinds, only for
 * enabled subscriptions, and only for genuine same-currency, same-variant price movements.
 */
export function evaluateObservation(input: {
  history: PreviousObservation[];
  next: { price: Money; kind: ObservationKind; variantKey: string };
  subscription: Subscription | null;
  productId: string;
}): Evaluation {
  const { history, next, subscription, productId } = input;
  const prev = pickComparable(history, next.variantKey);

  let drop: number | null = null;
  let comparedWith: Money | null = null;
  let reason: Evaluation['reason'] = 'ok';

  if (prev) {
    if (prev.price.currency !== next.price.currency) {
      reason = 'currency_mismatch';
    } else {
      comparedWith = prev.price;
      drop = dropPercent(prev.price, next.price);
    }
  } else {
    reason = 'no_previous';
  }

  if (!alertableKinds.includes(next.kind)) {
    return { dropPercent: drop, comparedWith, alerts: [], reason: 'not_alertable' };
  }
  if (!subscription || !subscription.enabled) {
    return { dropPercent: drop, comparedWith, alerts: [], reason: 'no_subscription' };
  }

  const alerts: PriceAlert[] = [];
  const target = subscription.targetPrice ?? null;

  const crossedTarget =
    !!target &&
    target.currency === next.price.currency &&
    next.price.amountMinor <= target.amountMinor &&
    (!comparedWith || comparedWith.amountMinor > target.amountMinor);

  if (crossedTarget && target) {
    alerts.push({
      type: 'target_reached',
      dedupeKey: `${productId}:target:${next.price.amountMinor}:${next.price.currency}`,
      oldPrice: comparedWith,
      newPrice: next.price,
      target,
    });
  } else if (drop !== null && comparedWith) {
    const min = subscription.minDropPercent ?? 5;
    if (drop >= min) {
      alerts.push({
        type: 'price_drop',
        dedupeKey: `${productId}:drop:${next.price.amountMinor}:${next.price.currency}`,
        dropPercent: Math.round(drop * 10) / 10,
        oldPrice: comparedWith,
        newPrice: next.price,
      });
    }
  }
  if (alerts.length === 0 && reason === 'ok') reason = 'no_change';
  return { dropPercent: drop, comparedWith, alerts, reason };
}
