import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase/client', () => ({
  supabase: {},
}));

vi.mock('../monitoring/aiGenerationBreadcrumb', () => ({
  addAiGenerationBreadcrumb: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
  devLog: vi.fn(),
  devError: vi.fn(),
}));

import { mapGenerateWorkoutHttpError } from './generateWorkoutDay';

describe('mapGenerateWorkoutHttpError', () => {
  it('maps 401 to auth_error', () => {
    expect(mapGenerateWorkoutHttpError(401)).toBe('auth_error');
  });

  it('maps 403 to forbidden, not auth_error', () => {
    expect(mapGenerateWorkoutHttpError(403)).toBe('forbidden');
  });

  it('maps 402 to paywall_required', () => {
    expect(mapGenerateWorkoutHttpError(402)).toBe('paywall_required');
  });

  it('maps 429 to quota_exceeded', () => {
    expect(mapGenerateWorkoutHttpError(429)).toBe('quota_exceeded');
  });

  it('returns null for other HTTP statuses', () => {
    expect(mapGenerateWorkoutHttpError(400)).toBeNull();
    expect(mapGenerateWorkoutHttpError(500)).toBeNull();
  });
});
