import { describe, expect, it } from 'vitest';
import {
  CHUNK_SIZE,
  chunkIndexKeys,
  extraChunkKeysToDelete,
  nextChunkCount,
  parseChunkCount,
} from './authStorageKeys';

describe('authStorageKeys', () => {
  it('parseChunkCount rejects missing and invalid counts', () => {
    expect(parseChunkCount(null)).toBeNull();
    expect(parseChunkCount('0')).toBeNull();
    expect(parseChunkCount('-1')).toBeNull();
    expect(parseChunkCount('abc')).toBeNull();
    expect(parseChunkCount('3')).toBe(3);
  });

  it('lists only the stored chunk keys', () => {
    expect(chunkIndexKeys('sb-session', 0)).toEqual([]);
    expect(chunkIndexKeys('sb-session', 2)).toEqual([
      'sb-session_chunk_0',
      'sb-session_chunk_1',
    ]);
  });

  it('deletes leftover chunks when shrinking, never a fixed 0..31 range', () => {
    expect(extraChunkKeysToDelete('k', 4, 1)).toEqual(['k_chunk_1', 'k_chunk_2', 'k_chunk_3']);
    expect(extraChunkKeysToDelete('k', 2, 2)).toEqual([]);
    expect(extraChunkKeysToDelete('k', null, 0)).toEqual([]);
  });

  it('uses a single key when the value fits one chunk', () => {
    expect(nextChunkCount(CHUNK_SIZE)).toBe(0);
    expect(nextChunkCount(CHUNK_SIZE + 1)).toBe(2);
  });
});
