import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/features/auth/AuthProvider';
import { db } from '@/lib/firebase';

export interface AppNotification {
  id: string;
  type: 'shipment_status' | 'shipment_eta';
  status: string;
  orderId: string;
  shipmentId: string;
  merchantName: string;
  etaTo?: string | null;
  createdAt: string;
  readAt: string | null;
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
        .slice(0, 20);
    },
  });
}

export function useMarkNotificationRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      updateDoc(doc(db, 'users', user!.uid, 'notifications', id), { readAt: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', user?.uid] }),
  });
}
