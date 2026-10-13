import { firstUrl, useShareInbox } from './shareInbox';

describe('firstUrl', () => {
  it('finds a link embedded in shared text and trims trailing punctuation', () => {
    expect(firstUrl('', 'Look at this: https://www.nike.com/t/shoe-123?x=1.')).toBe('https://www.nike.com/t/shoe-123?x=1');
  });
  it('prefers earlier parts and returns undefined when there is none', () => {
    expect(firstUrl('https://a.example/x', 'https://b.example/y')).toBe('https://a.example/x');
    expect(firstUrl('no link here', undefined)).toBeUndefined();
  });
});

describe('share inbox', () => {
  it('is consumed exactly once', () => {
    useShareInbox.getState().set({ url: 'https://a.example' });
    expect(useShareInbox.getState().take()).toEqual({ url: 'https://a.example' });
    expect(useShareInbox.getState().take()).toBeNull();
  });
});
