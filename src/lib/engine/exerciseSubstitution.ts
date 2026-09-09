/**
 * Suggest alternative exercises that share primary muscle coverage.
 */

export type SubstitutionCandidate = {
  id: string;
  primary_muscles: string[];
};

const DEFAULT_SUBSTITUTION_LIMIT = 5;

function overlapCount(left: string[], right: Set<string>): number {
  let count = 0;
  for (const muscle of left) {
    if (muscle && right.has(muscle)) count += 1;
  }
  return count;
}

/**
 * Return up to `limit` catalog exercises that share at least one primary muscle
 * with `exercise`, excluding the current id, sorted by overlap count (desc).
 */
export function suggestExerciseSubstitutions<T extends SubstitutionCandidate>(
  exercise: SubstitutionCandidate,
  catalog: T[],
  limit: number = DEFAULT_SUBSTITUTION_LIMIT,
): T[] {
  const currentMuscles = new Set(
    (exercise.primary_muscles ?? []).filter((muscle) => typeof muscle === 'string' && muscle.length > 0),
  );
  if (currentMuscles.size === 0 || limit <= 0) return [];

  return catalog
    .filter((item) => item.id !== exercise.id)
    .map((item) => ({
      item,
      overlap: overlapCount(item.primary_muscles ?? [], currentMuscles),
    }))
    .filter((row) => row.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit)
    .map((row) => row.item);
}
