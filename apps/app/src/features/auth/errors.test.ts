import { authErrorKey } from './errors';

describe('authErrorKey', () => {
  it('maps known Firebase codes', () => {
    expect(authErrorKey({ code: 'auth/invalid-credential' })).toBe('invalidCredentials');
    expect(authErrorKey({ code: 'auth/email-already-in-use' })).toBe('emailInUse');
    expect(authErrorKey({ code: 'auth/network-request-failed' })).toBe('network');
  });
  it('falls back to generic for unknown or malformed errors', () => {
    expect(authErrorKey({ code: 'auth/whatever' })).toBe('generic');
    expect(authErrorKey(null)).toBe('generic');
    expect(authErrorKey('boom')).toBe('generic');
  });
});
