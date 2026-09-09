export function requiresPaywallForAi(isPro: boolean): boolean {
  return !isPro;
}

export function isProProfile(
  tier: string | null | undefined,
  expiresAt: string | null | undefined,
): boolean {
  if (tier !== 'pro' || !expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}
