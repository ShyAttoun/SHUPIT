import type { OrderCreateInput } from '@shupit/contracts';

/** Conservative duplicate key: same merchant + same order number. Without an order number there is no key. */
export function orderDedupeKey(input: OrderCreateInput): string | undefined {
  const id = input.externalOrderId?.toLowerCase().replace(/[\s#-]/g, '');
  if (!id) return undefined;
  const merchant = input.merchantId ?? input.merchantName.toLowerCase().trim();
  return `${merchant}:${id}`;
}
