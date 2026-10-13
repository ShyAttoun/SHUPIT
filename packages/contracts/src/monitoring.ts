import type { Merchant } from './merchant';
import type { MonitoringStatus } from './pricewatch';

/**
 * Whether automatic price monitoring can exist for this merchant at all.
 * Never returns 'active' unless an authorized price provider is configured.
 */
export function monitoringAvailability(merchant: Merchant | undefined): MonitoringStatus {
  if (!merchant) return 'unsupported_merchant';
  if (!merchant.priceProviderId) return 'unsupported_merchant';
  return 'active';
}
