import type { Money, ObservationKind, PriceWatchSubscription } from '@shupit/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { useAuth } from '@/features/auth/AuthProvider';
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
    mutationFn: async (p: { enabled?: boolean; targetPrice?: Money | null; minDropPercent?: number }) => {
      const id = subId(uid, productId);
      const ref = doc(db, 'priceWatchSubscriptions', id);
      const existing = await getDoc(ref);
      const now = new Date().toISOString();
      const prev = existing.exists() ? (existing.data() as PriceWatchSubscription) : null;
      const next: Record<string, unknown> = {
        id,
        uid,
        savedProductId: productId,
        enabled: p.enabled ?? prev?.enabled ?? false,
        minDropPercent: p.minDropPercent ?? prev?.minDropPercent ?? 5,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
      };
      const target = p.targetPrice === undefined ? (prev?.targetPrice ?? null) : p.targetPrice;
      if (target) next.targetPrice = target;
      if (prev?.variantId) next.variantId = prev.variantId;
      await setDoc(ref, next);
      return next as unknown as PriceWatchSubscription;
    },
    // Optimistic: the switch/target reflect the tap immediately instead of flipping after the round trip.
    onMutate: async (p) => {
      const key = ['pricewatch', uid, productId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PriceWatchSubscription | null>(key);
      const base = previous ?? ({ id: subId(uid, productId), uid, savedProductId: productId, minDropPercent: 5 } as PriceWatchSubscription);
      qc.setQueryData<PriceWatchSubscription | null>(key, {
        ...base,
        ...(p.enabled !== undefined ? { enabled: p.enabled } : {}),
        ...(p.minDropPercent !== undefined ? { minDropPercent: p.minDropPercent } : {}),
        ...(p.targetPrice !== undefined ? { targetPrice: p.targetPrice ?? undefined } : {}),
      });
      return { previous };
    },
    onError: (_e, _p, ctx) => {
      qc.setQueryData(['pricewatch', uid, productId], ctx?.previous ?? null);
    },
    onSuccess: (saved) => {
      qc.setQueryData(['pricewatch', uid, productId], saved);
    },
  });
}

export interface Observation {
  id: string;
  price: Money;
  kind: ObservationKind;
  observedAt: string;
  dropPercent?: number | null;
}

/** Verified price history for a saved product (written by the server when you verify a price). */
export function useObservations(productId: string) {
  const uid = useUid();
  return useQuery({
    queryKey: ['observations', uid, productId],
    queryFn: async (): Promise<Observation[]> => {
      const snap = await getDocs(collection(db, 'users', uid, 'savedProducts', productId, 'priceObservations'));
      return snap.docs
        .map((d) => d.data() as Observation)
        .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    },
  });
}
