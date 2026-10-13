import { getMerchant, type GoResponse } from '@shupit/contracts';
import { useCallback, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { openExternal } from '@/lib/platform';

/**
 * Resolves "Shop now / Buy at store" through the affiliate router and opens the result.
 * If the router is unreachable we open the original merchant URL (no attribution claimed).
 */
export function useShopNow() {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [disclosure, setDisclosure] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const shop = useCallback(async (opts: { merchantId?: string; productUrl?: string }) => {
    const key = opts.productUrl ?? opts.merchantId ?? '';
    setBusyKey(key);
    setFailed(false);
    setDisclosure(null);
    try {
      let res: GoResponse | null = null;
      try {
        res = await apiFetch<GoResponse>('/api/go', { method: 'POST', body: opts });
      } catch {
        res = null;
      }
      const fallback = opts.productUrl ?? getMerchant(opts.merchantId)?.homepageUrl;
      const url = res?.url ?? fallback;
      if (!url) {
        setFailed(true);
        return;
      }
      if (res?.kind === 'affiliate' && res.disclosure) setDisclosure(res.disclosure);
      await openExternal(url);
    } catch {
      setFailed(true);
    } finally {
      setBusyKey(null);
    }
  }, []);

  return { shop, busyKey, disclosure, failed };
}
