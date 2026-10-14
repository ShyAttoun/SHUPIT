import { couponsForFavorites, type CouponView } from './hooks';

const c = (over: Partial<CouponView>): CouponView => ({
  id: 'x',
  merchantId: 'nike',
  code: 'A',
  createdAt: '2026-10-01T00:00:00.000Z',
  source: 'mine',
  ...over,
});

describe('couponsForFavorites', () => {
  it('keeps only favorite stores and drops expired coupons', () => {
    const list = [
      c({ id: '1' }),
      c({ id: '2', merchantId: 'zara' }),
      c({ id: '3', expiresAt: '2020-01-01T00:00:00.000Z' }),
    ];
    expect(couponsForFavorites(list, ['nike']).map((x) => x.id)).toEqual(['1']);
  });
  it('lists the user’s own coupons before partner ones', () => {
    const list = [c({ id: 'p', source: 'partner' }), c({ id: 'm' })];
    expect(couponsForFavorites(list, ['nike']).map((x) => x.id)).toEqual(['m', 'p']);
  });
});
