import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKOUT_SETTINGS, parseWorkoutSettings } from './workoutSettings';

describe('parseWorkoutSettings', () => {
  it('returns defaults for invalid input', () => {
    expect(parseWorkoutSettings(null)).toEqual(DEFAULT_WORKOUT_SETTINGS);
    expect(parseWorkoutSettings('x')).toEqual(DEFAULT_WORKOUT_SETTINGS);
  });

  it('accepts a valid rest option and rir mode', () => {
    expect(
      parseWorkoutSettings({
        defaultRestSec: 120,
        keepScreenAwake: false,
        intensityMode: 'rir',
      }),
    ).toEqual({
      defaultRestSec: 120,
      keepScreenAwake: false,
      intensityMode: 'rir',
    });
  });

  it('rejects unknown rest values', () => {
    expect(parseWorkoutSettings({ defaultRestSec: 75 }).defaultRestSec).toBe(
      DEFAULT_WORKOUT_SETTINGS.defaultRestSec,
    );
  });
});
