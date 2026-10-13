import type { Order, OrderCreateInput, Shipment, ShipmentStatus } from '@shupit/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { useAuth } from '@/features/auth/AuthProvider';
import { apiFetch } from '@/lib/api';
import { db } from '@/lib/firebase';

function useUid(): string {
  const { user } = useAuth();
  if (!user) throw new Error('Signed-in user required');
  return user.uid;
}

export type ShipmentDoc = Shipment & {
  createdAt?: string;
  estimatedDeliverySource?: 'user' | 'carrier' | null;
  /** 'ai_vision' = read from a user's screenshot (snapshot, not carrier-verified). */
  statusSource?: 'user' | 'ai_vision' | 'carrier' | null;
  statusAsOf?: string | null;
  /** The carrier's own wording of the status, as read from the page/screenshot. */
  statusText?: string | null;
  estimatedDeliveryFrom?: string | null;
  pickup?: {
    name?: string;
    address?: string;
    until?: string;
    instructions?: string;
    code?: string;
  } | null;
};

export function useOrders() {
  const uid = useUid();
  return useQuery({
    queryKey: ['orders', uid],
    queryFn: async (): Promise<Order[]> => {
      const snap = await getDocs(collection(db, 'users', uid, 'orders'));
      return snap.docs
        .map((d) => d.data() as Order)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  });
}

export function useShipments() {
  const uid = useUid();
  return useQuery({
    queryKey: ['shipments', uid],
    queryFn: async (): Promise<ShipmentDoc[]> => {
      const snap = await getDocs(collection(db, 'users', uid, 'shipments'));
      return snap.docs.map((d) => d.data() as ShipmentDoc);
    },
  });
}

export function useOrderMutations() {
  const uid = useUid();
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['orders', uid] }),
      qc.invalidateQueries({ queryKey: ['shipments', uid] }),
    ]);

  const createOrder = useMutation({
    mutationFn: (input: OrderCreateInput) =>
      apiFetch<{ id: string; shipmentIds: string[] }>('/api/orders', { method: 'POST', body: input }),
    onSuccess: refresh,
  });

  const deleteOrder = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/orders?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });

  return { createOrder, deleteOrder };
}

/** Statuses that mean the shipment is still on its way (or unknown, so still worth watching). */
const DONE: ShipmentStatus[] = ['delivered', 'returned'];
export const isActiveShipment = (s: Pick<Shipment, 'status'>) => !DONE.includes(s.status);

export function orderIsDelivered(shipments: Pick<Shipment, 'status'>[]): boolean {
  return shipments.length > 0 && shipments.every((s) => s.status === 'delivered');
}

/** Shipments expected within `days` (verified or user-entered ETA), not yet delivered. */
export function arrivingSoon(shipments: ShipmentDoc[], now: Date, days = 3): ShipmentDoc[] {
  const limit = now.getTime() + days * 86_400_000;
  return shipments.filter((s) => {
    if (!isActiveShipment(s) || !s.estimatedDeliveryAt) return false;
    const t = Date.parse(s.estimatedDeliveryAt);
    return Number.isFinite(t) && t >= now.getTime() - 86_400_000 && t <= limit;
  });
}
