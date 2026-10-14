import { shouldShowWalkthrough } from './store';

describe('shouldShowWalkthrough', () => {
  it('shows on first entry for a user, not again afterwards', () => {
    expect(shouldShowWalkthrough({ uid: 'a', seenFor: null, replaying: false })).toBe(true);
    expect(shouldShowWalkthrough({ uid: 'a', seenFor: 'a', replaying: false })).toBe(false);
  });
  it('shows again for a different user on the same device', () => {
    expect(shouldShowWalkthrough({ uid: 'b', seenFor: 'a', replaying: false })).toBe(true);
  });
  it('can be replayed manually and never shows signed out', () => {
    expect(shouldShowWalkthrough({ uid: 'a', seenFor: 'a', replaying: true })).toBe(true);
    expect(shouldShowWalkthrough({ uid: null, seenFor: null, replaying: false })).toBe(false);
  });
});
