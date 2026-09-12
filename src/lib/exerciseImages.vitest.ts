import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveExerciseImageSource } from './exerciseImages';

const PREVIOUSLY_BROKEN_NAMES = [
  'Burpee',
  'Crunch',
  'Dip',
  'Elliptical',
  'Skullcrusher',
] as const;

const MAP_ENTRY_RE =
  /^(?<key>"[^"]+"|[A-Za-z0-9_]+):\s*(?<value>\(\)\s*=>\s*require\('[^']+'\)|require\('[^']+'\)|.+)$/;
const LOADER_VALUE_RE = /^\(\)\s*=>\s*require\('[^']+'\)$/;

function parseExerciseImageEntries(source: string) {
  const mapDecl = source.indexOf('const EXERCISE_IMAGES');
  const bodyStart = source.indexOf('{', mapDecl);
  const bodyEnd = source.indexOf('};\n', bodyStart);
  const body = source.slice(bodyStart + 1, bodyEnd);
  const nonemptyLines = body.split('\n').filter((line) => line.trim().length > 0);

  const entries: { key: string; value: string }[] = [];
  const unparsed: string[] = [];

  for (const line of nonemptyLines) {
    const match = line.trim().replace(/,$/, '').match(MAP_ENTRY_RE);
    if (!match?.groups) {
      unparsed.push(line);
      continue;
    }
    const rawKey = match.groups.key;
    entries.push({
      key: rawKey.startsWith('"') ? rawKey.slice(1, -1) : rawKey,
      value: match.groups.value,
    });
  }

  return { entries, unparsed };
}

describe('EXERCISE_IMAGES map', () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'exerciseImages.ts'),
    'utf8',
  );
  const { entries, unparsed } = parseExerciseImageEntries(source);

  it('parses every map entry', () => {
    expect(unparsed).toEqual([]);
    expect(entries.length).toBeGreaterThanOrEqual(388);
  });

  it('wraps every value as a require loader', () => {
    const rawRequires = entries.filter((entry) => !LOADER_VALUE_RE.test(entry.value));
    expect(rawRequires).toEqual([]);
  });

  it('includes the names that previously stored a raw require', () => {
    const names = new Set(entries.map((entry) => entry.key));
    expect([...PREVIOUSLY_BROKEN_NAMES].filter((name) => !names.has(name))).toEqual([]);
  });
});

describe('resolveExerciseImageSource', () => {
  it('invokes function loaders', () => {
    const source = { uri: 'test-image' };
    expect(resolveExerciseImageSource(() => source)).toBe(source);
  });

  it('returns a non-function source instead of calling it', () => {
    const numericAssetId = 42;
    expect(resolveExerciseImageSource(numericAssetId)).toBe(numericAssetId);
  });

  it('returns null when the mapping is missing', () => {
    expect(resolveExerciseImageSource(undefined)).toBeNull();
  });
});
