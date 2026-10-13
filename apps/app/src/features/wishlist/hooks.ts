import {
  normalizeProductUrl,
  type FieldProvenance,
  type Money,
  type SavedProduct,
  type WishlistCollection,
} from '@shupit/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { useAuth } from '@/features/auth/AuthProvider';
import { apiFetch } from '@/lib/api';
import { db } from '@/lib/firebase';

function useUid(): string {
  const { user } = useAuth();
  if (!user) throw new Error('Signed-in user required');
  return user.uid;
}

export function useCollections() {
  const uid = useUid();
  return useQuery({
    queryKey: ['collections', uid],
    queryFn: async (): Promise<WishlistCollection[]> => {
      const snap = await getDocs(collection(db, 'users', uid, 'collections'));
      return snap.docs.map((d) => d.data() as WishlistCollection).sort((a, b) => a.order - b.order);
    },
  });
}

export function useSavedProducts() {
  const uid = useUid();
  return useQuery({
    queryKey: ['products', uid],
    queryFn: async (): Promise<SavedProduct[]> => {
      const snap = await getDocs(collection(db, 'users', uid, 'savedProducts'));
      return snap.docs
        .map((d) => d.data() as SavedProduct)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  });
}

export interface NewProductInput {
  title: string;
  merchantId?: string;
  productUrl?: string;
  imageUrl?: string;
  savedPrice?: Money;
  /** True when the price came from the page itself (not typed by the user). */
  priceFromPage?: boolean;
  titleFromPage?: boolean;
  imageFromPage?: boolean;
  note?: string;
  collectionIds: string[];
}

/** Finds an already-saved product with the same normalized URL. */
export function findDuplicate(products: SavedProduct[], url: string | undefined): SavedProduct | undefined {
  const key = url ? normalizeProductUrl(url) : null;
  if (!key) return undefined;
  return products.find((p) => p.urlKey === key);
}

export function buildProduct(id: string, input: NewProductInput, now = new Date().toISOString()): SavedProduct {
  const prov = (fromPage: boolean | undefined): FieldProvenance => ({
    source: fromPage ? 'page_metadata' : 'user',
    capturedAt: now,
  });
  const product: SavedProduct = {
    id,
    title: input.title.trim(),
    collectionIds: input.collectionIds,
    provenance: {
      title: prov(input.titleFromPage),
      ...(input.savedPrice ? { savedPrice: prov(input.priceFromPage) } : {}),
      ...(input.imageUrl ? { imageUrl: prov(input.imageFromPage) } : {}),
    },
    createdAt: now,
    updatedAt: now,
  };
  if (input.merchantId) product.merchantId = input.merchantId;
  if (input.productUrl) {
    product.productUrl = input.productUrl;
    const key = normalizeProductUrl(input.productUrl);
    if (key) product.urlKey = key;
  }
  if (input.imageUrl) product.imageUrl = input.imageUrl;
  if (input.note?.trim()) product.note = input.note.trim();
  if (input.savedPrice) {
    product.savedPrice = input.savedPrice;
    // Only a price read from the page counts as "verified at save time".
    if (input.priceFromPage) product.priceVerifiedAt = now;
  }
  return product;
}

export function useWishlistMutations() {
  const uid = useUid();
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['products', uid] }),
      qc.invalidateQueries({ queryKey: ['collections', uid] }),
    ]);

  const addProduct = useMutation({
    mutationFn: async (input: NewProductInput): Promise<SavedProduct> => {
      const ref = doc(collection(db, 'users', uid, 'savedProducts'));
      const product = buildProduct(ref.id, input);
      await setDoc(ref, product);
      return product;
    },
    onSuccess: refresh,
  });

  const updateProduct = useMutation({
    mutationFn: async (p: { id: string; patch: Record<string, unknown> }) => {
      await updateDoc(doc(db, 'users', uid, 'savedProducts', p.id), {
        ...p.patch,
        updatedAt: new Date().toISOString(),
      });
    },
    onSuccess: refresh,
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch<{ ok: true }>(`/api/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    onSuccess: refresh,
  });

  const createCollection = useMutation({
    mutationFn: async (p: { name: string; order: number }) => {
      const ref = doc(collection(db, 'users', uid, 'collections'));
      const value: WishlistCollection = {
        id: ref.id,
        name: p.name.trim(),
        order: p.order,
        createdAt: new Date().toISOString(),
      };
      await setDoc(ref, value);
      return value;
    },
    onSuccess: refresh,
  });

  const renameCollection = useMutation({
    mutationFn: (p: { id: string; name: string }) =>
      updateDoc(doc(db, 'users', uid, 'collections', p.id), { name: p.name.trim() }),
    onSuccess: refresh,
  });

  const deleteCollection = useMutation({
    mutationFn: async (id: string) => {
      const snap = await getDocs(collection(db, 'users', uid, 'savedProducts'));
      const batch = writeBatch(db);
      for (const d of snap.docs) {
        const ids = (d.data() as SavedProduct).collectionIds ?? [];
        if (ids.includes(id)) batch.update(d.ref, { collectionIds: arrayRemove(id) });
      }
      batch.delete(doc(db, 'users', uid, 'collections', id));
      await batch.commit();
    },
    onSuccess: refresh,
  });

  return { addProduct, updateProduct, deleteProduct, createCollection, renameCollection, deleteCollection };
}
