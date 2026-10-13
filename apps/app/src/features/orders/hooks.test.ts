import { arrivingSoon, isActiveShipment, orderIsDelivered, type ShipmentDoc } from './hooks';

const NOW = new Date('2026-10-13T10:00:00Z');
const s = (over: Partial<ShipmentDoc>): ShipmentDoc => ({
  id: 'x',
  orderId: 'o',
  status: 'unknown',
  ...over,
});

describe('orders helpers', () => {
  it('treats unknown as still active, delivered/returned as done', () => {
    expect(isActiveShipment(s({ status: 'unknown' }))).toBe(true);
    expect(isActiveShipment(s({ status: 'delivered' }))).toBe(false);
    expect(isActiveShipment(s({ status: 'returned' }))).toBe(false);
  });
  it('order is delivered only when it has shipments and all are delivered', () => {
    expect(orderIsDelivered([])).toBe(false);
    expect(orderIsDelivered([{ status: 'delivered' }, { status: 'shipped' }])).toBe(false);
    expect(orderIsDelivered([{ status: 'delivered' }])).toBe(true);
  });
  it('arrivingSoon uses ETA within the window and excludes delivered', () => {
    const list = [
      s({ id: 'a', estimatedDeliveryAt: '2026-10-14T10:00:00Z' }),
      s({ id: 'b', estimatedDeliveryAt: '2026-10-30T10:00:00Z' }),
      s({ id: 'c', status: 'delivered', estimatedDeliveryAt: '2026-10-14T10:00:00Z' }),
      s({ id: 'd' }),
    ];
    expect(arrivingSoon(list, NOW).map((x) => x.id)).toEqual(['a']);
  });
});
