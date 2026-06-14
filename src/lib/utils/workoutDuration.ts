const MIN_DURATION_SEC = 5;
const MAX_DURATION_SEC = 3600;

/** Elapsed hold time clamped to v2_session_sets duration_sec bounds. */
export function computeElapsedDurationSec(startedAtMs: number, nowMs: number): number {
  const elapsed = Math.round((nowMs - startedAtMs) / 1000);
  return clampSessionDurationSec(elapsed);
}

/** Hold time from the exercise countdown only (excludes any prep countdown). */
export function computeHeldDurationSec(
  targetDurationSec: number,
  secondsRemaining: number,
): number {
  const held = Math.max(0, targetDurationSec - secondsRemaining);
  return Math.min(MAX_DURATION_SEC, held);
}

/** Clamp to v2_session_sets duration_sec CHECK constraint before persisting. */
export function clampSessionDurationSec(durationSec: number): number {
  return Math.max(MIN_DURATION_SEC, Math.min(MAX_DURATION_SEC, durationSec));
}
