import type { Money, PriceWatchSubscription } from '@shupit/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/features/auth/AuthProvider';
import { apiFetch } from '@/lib/api';
import { db } from '@/lib/firebase';

function useUid(): string {
  const { user } = useAuth();
  if (!user) throw new Error('Signed-in user required');
  return user.uid;
}

const subId = (uid: string, productId: string) => `${uid}_${productId}`;

export function usePriceWatch(productId: string) {
  const uid = useUid();
  return useQuery({
    queryKey: ['pricewatch', uid, productId],
    queryFn: async (): Promise<PriceWatchSubscription | null> => {
      const snap = await getDoc(doc(db, 'priceWatchSubscriptions', subId(uid, productId)));
      return snap.exists() ? (snap.data() as PriceWatchSubscription) : null;
    },
  });
}

export function useSetPriceWatch(productId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { enabled: boolean; targetPrice?: Money | null; minDropPercent?: number }) => {
      const id = subId(uid, productId);
      const ref = doc(db, 'priceWatchSubscriptions', id);
      const existing = await getDoc(ref);
      const now = new Date().toISOString();
      const prev = existing.exists() ? (existing.data() as PriceWatchSubscription) : null;
      const next: PriceWatchSubscription = {
        id,
        uid,
        savedProductId: productId,
        enabled: p.enabled,
        minDropPercent: p.minDropPercent ?? prev?.minDropPercent ?? 5,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
        ...(p.targetPrice === undefined
          ? prev?.targetPrice
            ? { targetPrice: prev.targetPrice }
            : {}
          : p.targetPrice
            ? { targetPrice: p.targetPrice }
            : {}),
        ...(prev?.variantId ? { variantId: prev.variantId } : {}),
      } as PriceWatchSubscription;
      await setDoc(ref, next);
      return next;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricewatch', uid, productId] }),
  });
}

export interface HistoryPoint {
  observedAt: string;
  price: Money;
  kind: string;
}

export function usePriceHistory(productId: string, enabled: boolean) {
  const uid = useUid();
  return useQuery({
    queryKey: ['pricehistory', uid, productId],
    enabled,
    queryFn: async (): Promise<HistoryPoint[]> => {
      const res = await apiFetch<{ points: HistoryPoint[] }>(
        `/api/price-history?savedProductId=${encodeURIComponent(productId)}`,
      );
      return res.points;
    },
  });
}
