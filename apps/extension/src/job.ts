/** Shared between the popup (renders) and the background worker (does the work). */
export const JOB_KEY = 'shupit.job';

export type JobKind = 'product' | 'orders' | 'shipment';

export interface ProductData {
  title: string;
  imageUrl: string | null;
  price: { amountMinor: number; currency: string } | null;
  priceDisplay: number | null;
  merchantId: string | null;
  canonicalUrl: string;
  aiFields: string[];
}

export interface OrderData {
  merchantName: string | null;
  orderNumber: string | null;
  purchaseDate: string | null;
  total: { amount: number; currency: string } | null;
  items: { title: string; quantity: number; imageUrl?: string | null }[];
  shipments: {
    carrier: string | null;
    trackingNumber: string | null;
    status?: string | null;
    statusText?: string | null;
    estimatedDeliveryFrom?: string | null;
    estimatedDelivery: string | null;
    events?: { description: string; occurredAt: string }[];
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
}

export type BgRequest =
  | { type: 'api'; path: string; method?: string; body?: unknown }
  | { type: 'start'; kind: JobKind; tabId: number; windowId: number; shipmentId?: string }
  | { type: 'clear-job' };

export type BgResponse =
  | { ok: true; data?: unknown }
  | { ok: false; status: number; code: string; body?: unknown };
