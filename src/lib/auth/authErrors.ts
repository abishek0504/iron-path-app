/**
 * Map Supabase Auth errors to safe user-facing messages (no raw API details).
 */

export function mapAuthError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const message = (error as { message?: string })?.message?.toLowerCase() ?? '';

  if (message.includes('invalid login credentials') || message.includes('invalid email or password')) {
    return 'Invalid email or password.';
  }
  if (message.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }
  if (message.includes('user already registered') || message.includes('already been registered')) {
    return 'An account with this email already exists.';
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (message.includes('password') && message.includes('weak')) {
    return 'Password is too weak. Use at least 8 characters with a mix of letters, numbers, and symbols.';
  }
  if (message.includes('password') && message.includes('length')) {
    return 'Password must be at least 8 characters long.';
  }
  if (message.includes('password') && (message.includes('common') || message.includes('dictionary'))) {
    return 'Password is too common. Please choose a more unique password.';
  }
  if (message.includes('password')) {
    return 'Password does not meet security requirements.';
  }
  if (message.includes('email') && message.includes('invalid')) {
    return 'Enter a valid email address.';
  }
  if (message.includes('session') && (message.includes('expired') || message.includes('invalid'))) {
    return 'Your session expired. Please sign in again.';
  }
  if (message.includes('otp') || message.includes('token') || message.includes('code')) {
    return 'This link is invalid or has expired. Request a new one.';
  }

  return fallback;
}
