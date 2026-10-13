import { moveInList, toggleFavoriteList } from './hooks';

describe('favorite list helpers', () => {
  it('toggles membership and appends new favorites last', () => {
    expect(toggleFavoriteList(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(toggleFavoriteList(['a', 'b'], 'a')).toEqual(['b']);
  });
  it('moves within bounds only', () => {
    expect(moveInList(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveInList(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(moveInList(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
    expect(moveInList(['a', 'b', 'c'], 'x', 1)).toEqual(['a', 'b', 'c']);
  });
});
