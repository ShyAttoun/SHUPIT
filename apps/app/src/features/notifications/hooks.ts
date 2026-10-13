import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
} from '@shupit/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '@/features/auth/AuthProvider';
import { db } from '@/lib/firebase';

export interface AppNotification {
  id: string;
  type: 'price_drop' | 'target_reached' | 'shipment_status' | 'shipment_eta';
  status?: string | null;
  createdAt: string;
  readAt: string | null;
  // shipments
  orderId?: string;
  shipmentId?: string;
  merchantName?: string;
  etaTo?: string | null;
  // prices
  productId?: string;
  productTitle?: string;
  oldDisplay?: number | null;
  newDisplay?: number | null;
  newPrice?: { amountMinor: number; currency: string } | null;
  oldPrice?: { amountMinor: number; currency: string } | null;
  dropPercent?: number | null;
}

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications', user?.uid],
    enabled: !!user,
    queryFn: async (): Promise<AppNotification[]> => {
      const snap = await getDocs(collection(db, 'users', user!.uid, 'notifications'));
      return snap.docs
        .map((d) => ({ ...(d.data() as Omit<AppNotification, 'id'>), id: d.id }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 100);
    },
  });
}

export function useUnreadCount(): number {
  const { data } = useNotifications();
  return (data ?? []).filter((n) => !n.readAt).length;
}

export function useNotificationActions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications', user?.uid] });

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      const batch = writeBatch(db);
      const at = new Date().toISOString();
      for (const id of ids) batch.update(doc(db, 'users', user!.uid, 'notifications', id), { readAt: at });
      await batch.commit();
    },
    onSuccess: refresh,
  });
  return { markRead };
}

export function useNotificationPrefs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notificationPrefs', user?.uid],
    enabled: !!user,
    queryFn: async (): Promise<NotificationPrefs> => {
      const snap = await getDoc(doc(db, 'users', user!.uid, 'preferences', 'notifications'));
      return { ...DEFAULT_NOTIFICATION_PREFS, ...((snap.data() as Partial<NotificationPrefs> | undefined) ?? {}) };
    },
  });
}

export function useSetNotificationPref() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<NotificationPrefs>) => {
      await setDoc(doc(db, 'users', user!.uid, 'preferences', 'notifications'), patch, { merge: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificationPrefs', user?.uid] }),
  });
}
