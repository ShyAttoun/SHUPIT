import type { Merchant } from './merchant';
import type { MonitoringStatus } from './pricewatch';

/**
 * Whether automatic price monitoring can exist for this merchant at all.
 * Never returns 'active' unless an authorized price provider is configured.
 */
export function monitoringAvailability(merchant: Merchant | undefined): MonitoringStatus {
  // No authorized automatic source: the price is verified manually via the extension.
  if (!merchant || !merchant.priceProviderId) return 'manual';
  return 'active';
}
