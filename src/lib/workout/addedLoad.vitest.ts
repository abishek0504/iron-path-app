import { describe, expect, it } from 'vitest';
import {
  BODYWEIGHT_LOAD_LABEL,
  canProgressAddedLoad,
  formatAddedLoadLabel,
  isBodyweightLoad,
  isBodyweightLoadInput,
  nullableAddedLoad,
  parseAddedLoadInput,
} from './addedLoad';

describe('addedLoad', () => {
  it('preserves 0 instead of wiping it to null', () => {
    expect(nullableAddedLoad(0)).toBe(0);
    expect(nullableAddedLoad(null)).toBeNull();
    expect(nullableAddedLoad(undefined)).toBeNull();
    expect(nullableAddedLoad(25)).toBe(25);
  });

  it('treats 0 as bodyweight and does not increment load', () => {
    expect(isBodyweightLoad(0)).toBe(true);
    expect(isBodyweightLoad(2.5)).toBe(false);
    expect(canProgressAddedLoad(0)).toBe(false);
    expect(canProgressAddedLoad(135)).toBe(true);
    expect(formatAddedLoadLabel(0)).toBe(BODYWEIGHT_LOAD_LABEL);
    expect(formatAddedLoadLabel(null)).toBeNull();
  });

  it('parses Bodyweight / 0 input as added-load 0', () => {
    expect(isBodyweightLoadInput('0')).toBe(true);
    expect(isBodyweightLoadInput(BODYWEIGHT_LOAD_LABEL)).toBe(true);
    expect(isBodyweightLoadInput('')).toBe(false);
    expect(parseAddedLoadInput('0')).toBe(0);
    expect(parseAddedLoadInput(BODYWEIGHT_LOAD_LABEL)).toBe(0);
    expect(parseAddedLoadInput('')).toBeNull();
    expect(parseAddedLoadInput('25')).toBe(25);
  });
});
