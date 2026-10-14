/** Shared between the popup (renders) and the background worker (does the work). */
export const JOB_KEY = 'shupit.job';

export type JobKind = 'product' | 'orders' | 'shipment' | 'price';

export interface ProductData {
  title: string;
  imageUrl: string | null;
  price: { amountMinor: number; currency: string } | null;
  priceDisplay: number | null;
  merchantId: string | null;
  canonicalUrl: string;
  aiFields: string[];
  variant?: string | null;
}

export interface PriceOutcome {
  recorded: boolean;
  kind: string;
  dropPercent: number | null;
  comparedWith: { amountMinor: number; currency: string } | null;
  alerts: { type: string; result: string }[];
  reason: string;
  price: { amountMinor: number; currency: string };
}

export interface PriceConfirm {
  savedTitle: string;
  pageTitle: string;
  body: Record<string, unknown>;
}

export interface OrderData {
  merchantName: string | null;
  orderNumber: string | null;
  purchaseDate: string | null;
  total: { amount: number; currency: string | null } | null;
  items: { title: string; quantity: number; imageUrl?: string | null }[];
  shipments: {
    carrier: string | null;
    trackingNumber: string | null;
    status?: string | null;
    statusText?: string | null;
    estimatedDeliveryFrom?: string | null;
    estimatedDelivery: string | null;
    events?: { description: string; occurredAt: string }[];
    pickup?: {
      name?: string | null;
      address?: string | null;
      until?: string | null;
      instructions?: string | null;
      collectionCode?: string | null;
    } | null;
  }[];
}

export interface Job {
  id: string;
  kind: JobKind;
  status: 'running' | 'ready' | 'error';
  startedAt: number;
  pageUrl?: string;
  shipmentId?: string;
  error?: string;
  product?: ProductData;
  orders?: { data: OrderData; merchantId: string | null }[];
  result?: { status: string; estimatedDeliveryAt: string | null; events: number };
  price?: PriceOutcome;
  /** Set when the page looks like a different product than the saved one: needs the user's OK. */
  priceConfirm?: PriceConfirm;
}

export type BgRequest =
  | { type: 'api'; path: string; method?: string; body?: unknown }
  | { type: 'start'; kind: JobKind; tabId: number; windowId: number; shipmentId?: string }
  | { type: 'clear-job' };

export type BgResponse =
  | { ok: true; data?: unknown }
  | { ok: false; status: number; code: string; body?: unknown };
