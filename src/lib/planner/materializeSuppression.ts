import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'ironpath.skip_materialize_days.v1';

export function materializeSuppressionKey(userId: string, startIso: string): string {
  return `${userId}:${startIso}`;
}

async function readKeys(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

async function writeKeys(keys: Set<string>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]));
}

export async function isMaterializeSuppressed(userId: string, startIso: string): Promise<boolean> {
  const keys = await readKeys();
  return keys.has(materializeSuppressionKey(userId, startIso));
}

export async function suppressMaterializeForDay(userId: string, startIso: string): Promise<void> {
  const keys = await readKeys();
  keys.add(materializeSuppressionKey(userId, startIso));
  await writeKeys(keys);
}

export async function clearMaterializeSuppressionForDay(
  userId: string,
  startIso: string,
): Promise<void> {
  const keys = await readKeys();
  if (!keys.delete(materializeSuppressionKey(userId, startIso))) return;
  await writeKeys(keys);
}
