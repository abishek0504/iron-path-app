/**
 * Human-readable duration for exercise targets (planner, stretches, holds).
 * Uses seconds below 60; minutes (and remainder seconds) at 60+.
 */
export function formatDurationDisplay(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (total < 60) return `${total} sec`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (secs === 0) return `${mins} min`;
  return `${mins} min ${secs} sec`;
}

/** Compact duration for PRs and tight UI: "30s", "1:30". */
export function formatDurationCompact(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** "N sets × {duration}" for timed / stretch exercises. */
export function formatTimedSetsTarget(
  sets: number,
  durationSec: number | null | undefined,
): string {
  return `${sets} sets × ${formatDurationDisplay(durationSec)}`;
}
