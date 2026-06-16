/**
 * In-memory buffer for live heart-rate samples and watch HK UUID during an active workout.
 * Cleared after workout completion export.
 */

export type HeartRateSample = {
  bpm: number;
  timestamp: number;
};

export type WorkoutHealthPayload = {
  heartRateSamples: HeartRateSample[];
  watchHkWorkoutUuid?: string;
};

const MAX_SAMPLES_PER_SESSION = 500;

const buffers = new Map<string, WorkoutHealthPayload>();

function getOrCreate(sessionId: string): WorkoutHealthPayload {
  let buf = buffers.get(sessionId);
  if (!buf) {
    buf = { heartRateSamples: [] };
    buffers.set(sessionId, buf);
  }
  return buf;
}

export function appendHeartRateSample(
  sessionId: string,
  bpm: number,
  timestampSec?: number,
): void {
  if (!sessionId || bpm <= 0 || bpm > 250) return;
  const buf = getOrCreate(sessionId);
  if (buf.heartRateSamples.length >= MAX_SAMPLES_PER_SESSION) {
    buf.heartRateSamples.shift();
  }
  buf.heartRateSamples.push({
    bpm: Math.round(bpm),
    timestamp: timestampSec ?? Date.now() / 1000,
  });
}

export function setWatchHkWorkoutUuid(sessionId: string, uuid: string): void {
  if (!sessionId || !uuid) return;
  const buf = getOrCreate(sessionId);
  buf.watchHkWorkoutUuid = uuid;
}

export function peekWorkoutHealthBuffer(sessionId: string): WorkoutHealthPayload | null {
  return buffers.get(sessionId) ?? null;
}

export function consumeWorkoutHealthBuffer(sessionId: string): WorkoutHealthPayload | null {
  const buf = buffers.get(sessionId);
  buffers.delete(sessionId);
  return buf ?? null;
}

export function clearWorkoutHealthBuffer(sessionId: string): void {
  buffers.delete(sessionId);
}

export function aggregateHeartRate(samples: HeartRateSample[]): {
  avg: number | null;
  max: number | null;
} {
  if (samples.length === 0) return { avg: null, max: null };
  const sum = samples.reduce((a, s) => a + s.bpm, 0);
  const max = Math.max(...samples.map((s) => s.bpm));
  return { avg: Math.round(sum / samples.length), max };
}
