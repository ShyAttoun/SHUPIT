import { shouldPromptStores } from './firstRun';

describe('shouldPromptStores', () => {
  const base = { loaded: true, favoriteCount: 0, promptedFor: null, uid: 'u1' };
  it('prompts once on first entry with no favorites', () => {
    expect(shouldPromptStores(base)).toBe(true);
  });
  it('does not prompt again for the same user, or when favorites exist', () => {
    expect(shouldPromptStores({ ...base, promptedFor: 'u1' })).toBe(false);
    expect(shouldPromptStores({ ...base, favoriteCount: 2 })).toBe(false);
  });
  it('prompts a different user on the same device, and waits for data', () => {
    expect(shouldPromptStores({ ...base, promptedFor: 'someone-else' })).toBe(true);
    expect(shouldPromptStores({ ...base, loaded: false })).toBe(false);
    expect(shouldPromptStores({ ...base, uid: null })).toBe(false);
  });
});
