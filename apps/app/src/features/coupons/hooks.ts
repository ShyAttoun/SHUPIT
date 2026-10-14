import type { StoreCoupon } from '@shupit/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { useAuth } from '@/features/auth/AuthProvider';
import { db } from '@/lib/firebase';

export type CouponSource = 'mine' | 'partner';
export type CouponView = StoreCoupon & { source: CouponSource };

function useUid(): string {
  const { user } = useAuth();
  if (!user) throw new Error('Signed-in user required');
  return user.uid;
}

/** Coupons saved by the user plus partner coupons published by SHUPIT (currently none). */
export function useCoupons() {
  const uid = useUid();
  return useQuery({
    queryKey: ['coupons', uid],
    queryFn: async (): Promise<CouponView[]> => {
      const [mine, partner] = await Promise.all([
        getDocs(collection(db, 'users', uid, 'coupons')),
        getDocs(collection(db, 'partnerCoupons')).catch(() => null),
      ]);
      return [
        ...mine.docs.map((d) => ({ ...(d.data() as StoreCoupon), id: d.id, source: 'mine' as const })),
        ...(partner?.docs ?? []).map((d) => ({ ...(d.data() as StoreCoupon), id: d.id, source: 'partner' as const })),
      ];
    },
  });
}

export function useCouponActions() {
  const uid = useUid();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['coupons', uid] });
  const add = useMutation({
    mutationFn: async (input: { merchantId: string; code: string; description?: string }) => {
      const ref = doc(collection(db, 'users', uid, 'coupons'));
      const coupon: StoreCoupon = {
        id: ref.id,
        merchantId: input.merchantId,
        code: input.code.trim(),
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        createdAt: new Date().toISOString(),
      };
      await setDoc(ref, coupon);
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => deleteDoc(doc(db, 'users', uid, 'coupons', id)),
    onSuccess: invalidate,
  });
  return { add, remove };
}

/** Coupons for stores the user marked as favorites, user's own first. */
export function couponsForFavorites(coupons: CouponView[], favoriteIds: string[]): CouponView[] {
  const fav = new Set(favoriteIds);
  return coupons
    .filter((c) => fav.has(c.merchantId))
    .filter((c) => !c.expiresAt || Date.parse(c.expiresAt) >= Date.now())
    .sort((a, b) => (a.source === b.source ? b.createdAt.localeCompare(a.createdAt) : a.source === 'mine' ? -1 : 1));
}
