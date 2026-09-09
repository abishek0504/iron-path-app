import { describe, expect, it } from 'vitest';
import { isProProfile } from './gates';

describe('isProProfile', () => {
  it('requires an unexpired subscription_expires_at', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isProProfile('pro', future)).toBe(true);
    expect(isProProfile('pro', past)).toBe(false);
    expect(isProProfile('pro', null)).toBe(false);
    expect(isProProfile('pro', undefined)).toBe(false);
    expect(isProProfile('free', future)).toBe(false);
  });
});
