import { afterEach, describe, expect, it, vi } from 'vitest';
import { authCallbackRedirectTo, DEFAULT_PASSWORD_RESET_PAGE_URL } from './authRedirect';

vi.mock('expo-linking', () => ({
  createURL: (path: string) => `ironpath://${path.replace(/^\//, '')}`,
}));

describe('authCallbackRedirectTo', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_PASSWORD_RESET_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL;
  });

  it('sends recovery to the website reset page', () => {
    expect(authCallbackRedirectTo('recovery')).toBe(DEFAULT_PASSWORD_RESET_PAGE_URL);
  });

  it('uses EXPO_PUBLIC_PASSWORD_RESET_URL for recovery when set', () => {
    process.env.EXPO_PUBLIC_PASSWORD_RESET_URL = 'https://www.tryironpath.com/reset-password/';
    expect(authCallbackRedirectTo('recovery')).toBe('https://www.tryironpath.com/reset-password');
  });

  it('keeps signup on the app callback', () => {
    expect(authCallbackRedirectTo('signup')).toBe('ironpath://auth/callback?type=signup');
  });
});
