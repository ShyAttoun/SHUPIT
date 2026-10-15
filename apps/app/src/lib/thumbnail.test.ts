import { sanitizeBox } from './thumbnail';

describe('sanitizeBox', () => {
  it('accepts a normal product-photo box', () => {
    expect(sanitizeBox({ x: 0.1, y: 0.2, w: 0.5, h: 0.4 })).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.4 });
  });
  it('clamps a box that runs past the edge', () => {
    expect(sanitizeBox({ x: 0.8, y: 0.1, w: 0.5, h: 0.4 })).toEqual({ x: 0.8, y: 0.1, w: expect.closeTo(0.2, 5), h: 0.4 });
  });
  it('rejects tiny, extreme or invalid boxes', () => {
    expect(sanitizeBox({ x: 0.1, y: 0.1, w: 0.02, h: 0.5 })).toBeNull();
    expect(sanitizeBox({ x: 0, y: 0, w: 1, h: 0.1 })).toBeNull();
    expect(sanitizeBox({ x: NaN, y: 0, w: 0.5, h: 0.5 })).toBeNull();
    expect(sanitizeBox(null)).toBeNull();
  });
});
