import * as Linking from 'expo-linking';

export type AuthCallbackType = 'signup' | 'recovery' | 'email_change';

export const DEFAULT_PASSWORD_RESET_PAGE_URL = 'https://tryironpath.com/reset-password';

export function passwordResetPageUrl(): string {
  const override = process.env.EXPO_PUBLIC_PASSWORD_RESET_URL?.trim();
  if (override) return override.replace(/\/$/, '');
  return DEFAULT_PASSWORD_RESET_PAGE_URL;
}

export function authCallbackRedirectTo(type: AuthCallbackType): string {
  if (type === 'recovery') {
    return passwordResetPageUrl();
  }

  const base =
    process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL ?? Linking.createURL('/auth/callback');
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}type=${encodeURIComponent(type)}`;
}
