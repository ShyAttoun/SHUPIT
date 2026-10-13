import { chartGeometry } from './PriceChart';

describe('chartGeometry', () => {
  it('needs at least two points', () => {
    expect(chartGeometry([], 100, 50)).toBeNull();
    expect(chartGeometry([{ t: 1, v: 5 }], 100, 50)).toBeNull();
  });
  it('maps lowest value to the bottom and highest to the top', () => {
    const g = chartGeometry(
      [
        { t: 0, v: 10 },
        { t: 10, v: 20 },
      ],
      100,
      50,
      0,
    )!;
    expect(g.xy[0]).toEqual({ x: 0, y: 50 });
    expect(g.xy[1]).toEqual({ x: 100, y: 0 });
  });
  it('handles flat series without NaN', () => {
    const g = chartGeometry([{ t: 0, v: 7 }, { t: 5, v: 7 }], 100, 50)!;
    expect(g.xy.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });
});
