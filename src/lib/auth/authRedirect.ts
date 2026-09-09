import * as Linking from 'expo-linking';

export type AuthCallbackType = 'signup' | 'recovery' | 'email_change';

export function authCallbackRedirectTo(type: AuthCallbackType): string {
  const base =
    process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL ?? Linking.createURL('/auth/callback');
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}type=${encodeURIComponent(type)}`;
}
