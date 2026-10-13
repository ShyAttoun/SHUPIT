import type { FavoriteStore } from '@shupit/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { useAuth } from '@/features/auth/AuthProvider';
import { db } from '@/lib/firebase';

function useUid(): string {
  const { user } = useAuth();
  if (!user) throw new Error('Signed-in user required');
  return user.uid;
}

export function useFavoriteStores() {
  const uid = useUid();
  return useQuery({
    queryKey: ['favorites', uid],
    queryFn: async (): Promise<FavoriteStore[]> => {
      const snap = await getDocs(collection(db, 'users', uid, 'favoriteStores'));
      return snap.docs
        .map((d) => d.data() as FavoriteStore)
        .sort((a, b) => a.order - b.order);
    },
  });
}

/** Pure: next ordered list after toggling a favorite. */
export function toggleFavoriteList(current: string[], merchantId: string): string[] {
  return current.includes(merchantId)
    ? current.filter((id) => id !== merchantId)
    : [...current, merchantId];
}

/** Pure: swap an item with its neighbour; returns the same array if out of range. */
export function moveInList(ids: string[], merchantId: string, direction: -1 | 1): string[] {
  const i = ids.indexOf(merchantId);
  const j = i + direction;
  if (i === -1 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export function useStoresMutations() {
  const uid = useUid();
  const qc = useQueryClient();

  /** Writes the whole ordered list (idempotent): removes dropped stores, re-numbers the rest. */
  const saveFavorites = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const existing = await getDocs(collection(db, 'users', uid, 'favoriteStores'));
      const batch = writeBatch(db);
      const keep = new Set(orderedIds);
      const prev = new Map(existing.docs.map((d) => [d.id, d.data() as FavoriteStore]));
      for (const d of existing.docs) if (!keep.has(d.id)) batch.delete(d.ref);
      const now = new Date().toISOString();
      orderedIds.forEach((merchantId, order) => {
        batch.set(doc(db, 'users', uid, 'favoriteStores', merchantId), {
          merchantId,
          order,
          addedAt: prev.get(merchantId)?.addedAt ?? now,
        } satisfies FavoriteStore);
      });
      await batch.commit();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites', uid] }),
  });

  return { saveFavorites };
}
