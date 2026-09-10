/** Allow-list validation, padding, and stretch prescriptions. */

import {
  MAX_EXERCISES_PER_SESSION,
  MIN_EXERCISES_PER_SESSION,
  STRETCH_TARGETS_BY_EXPERIENCE,
  TARGET_BOUNDS,
} from './constants.ts';
import {
  exerciseHitsAvoidedMuscles,
  exerciseMatchesDayFocus,
  filterExercisesByDayFocus,
  normalizeExerciseName,
} from './dayFocus.ts';
import type { AiExercisePlan, AllowListedExercise, DayConstraints } from './types.ts';

export function inRange(value: number | null, min: number, max: number): boolean {
  return value !== null && Number.isFinite(value) && value >= min && value <= max;
}

/**
 * Validate one exercise prescription against the catalog entry. Returns the
 * plan with targets nulled if they are out of bounds or mismatch the exercise
 * mode — the exercise itself is kept so the client can fall back to
 * prescription-based targets instead of losing the whole generation.
 */
export function sanitizeTargets(plan: AiExercisePlan, exercise: AllowListedExercise): AiExercisePlan {
  const nulled: AiExercisePlan = {
    exercise_id: plan.exercise_id,
    sets: null,
    reps: null,
    duration_sec: null,
    weight: null,
    target_rpe: null,
  };

  const sets =
    plan.sets !== null && Number.isInteger(plan.sets) &&
    inRange(plan.sets, TARGET_BOUNDS.sets.min, TARGET_BOUNDS.sets.max)
      ? plan.sets
      : null;
  if (sets === null) return nulled;

  let reps: number | null = null;
  let durationSec: number | null = null;
  if (exercise.is_timed) {
    if (
      plan.duration_sec === null || !Number.isInteger(plan.duration_sec) ||
      !inRange(plan.duration_sec, TARGET_BOUNDS.durationSec.min, TARGET_BOUNDS.durationSec.max)
    ) {
      return nulled;
    }
    durationSec = plan.duration_sec;
  } else {
    if (
      plan.reps === null || !Number.isInteger(plan.reps) ||
      plan.reps < TARGET_BOUNDS.reps.min
    ) {
      return nulled;
    }
    reps = plan.reps;
  }

  const weight = inRange(plan.weight, TARGET_BOUNDS.weight.min, TARGET_BOUNDS.weight.max)
    ? plan.weight
    : null;
  const targetRpe = inRange(plan.target_rpe, TARGET_BOUNDS.rpe.min, TARGET_BOUNDS.rpe.max)
    ? plan.target_rpe
    : null;

  return {
    exercise_id: plan.exercise_id,
    sets,
    reps,
    duration_sec: durationSec,
    weight,
    target_rpe: targetRpe,
  };
}

export function stretchTargetsForExperience(experience: string): {
  sets: number;
  duration_sec: number;
} {
  return STRETCH_TARGETS_BY_EXPERIENCE[experience] ?? STRETCH_TARGETS_BY_EXPERIENCE.beginner;
}

/** Overwrite LLM stretch targets with evidence-based static-hold defaults (no RPE). */
export function applyStretchPrescription(plan: AiExercisePlan, experience: string): AiExercisePlan {
  const t = stretchTargetsForExperience(experience);
  return {
    exercise_id: plan.exercise_id,
    sets: t.sets,
    reps: null,
    duration_sec: t.duration_sec,
    weight: null,
    target_rpe: null,
  };
}

export function emptyStrengthPlan(exerciseId: string): AiExercisePlan {
  return {
    exercise_id: exerciseId,
    sets: null,
    reps: null,
    duration_sec: null,
    weight: null,
    target_rpe: null,
  };
}

export function sessionMuscleSet(strengthExercises: AllowListedExercise[]): Set<string> {
  const muscles = new Set<string>();
  for (const ex of strengthExercises) {
    for (const m of ex.primary_muscles) muscles.add(m);
  }
  return muscles;
}

export function scoreStretchOverlap(stretch: AllowListedExercise, sessionMuscles: Set<string>): number {
  let score = 0;
  for (const m of stretch.primary_muscles) {
    if (sessionMuscles.has(m)) score += 1;
  }
  return score;
}

export function pickStretchesForSession(
  stretchCatalog: AllowListedExercise[],
  count: number,
  sessionMuscles: Set<string>,
  seenAcrossDay: Set<string>,
): AllowListedExercise[] {
  if (count <= 0) return [];
  return stretchCatalog
    .filter((ex) => !seenAcrossDay.has(ex.id))
    .sort((a, b) => scoreStretchOverlap(b, sessionMuscles) - scoreStretchOverlap(a, sessionMuscles))
    .slice(0, count);
}

export function pickStrengthForSession(
  catalog: AllowListedExercise[],
  count: number,
  seenAcrossDay: Set<string>,
  seenNames: Set<string>,
): AllowListedExercise[] {
  if (count <= 0) return [];
  return catalog
    .filter((ex) => {
      if (ex.is_stretch || seenAcrossDay.has(ex.id)) return false;
      const nameKey = normalizeExerciseName(ex.name);
      return !seenNames.has(nameKey);
    })
    .sort((a, b) => a.priority_order - b.priority_order)
    .slice(0, count);
}

/**
 * Enforce the allow-list, dedupe, pad to user-requested counts, and apply
 * stretch prescriptions. When the user picks an exact exercise or stretch
 * count, we pad deterministically if the LLM returns too few.
 */
export function normalizeSessionGroups(
  raw: AiExercisePlan[][],
  sessionsPerDay: number,
): { groups: AiExercisePlan[][]; reason: null } | { groups: null; reason: string } {
  if (raw.length === sessionsPerDay) {
    return { groups: raw, reason: null };
  }
  if (raw.length > sessionsPerDay) {
    return { groups: raw.slice(0, sessionsPerDay), reason: null };
  }
  return {
    groups: null,
    reason: `session_count_mismatch: got ${raw.length}, expected ${sessionsPerDay}`,
  };
}

export function finalizeAiSessions(
  raw: AiExercisePlan[][],
  catalog: AllowListedExercise[],
  stretchCatalog: AllowListedExercise[],
  catalogById: Map<string, AllowListedExercise>,
  sessionsPerDay: number,
  requestedExercisesPerSession: number | null,
  stretchCount: number,
  experience: string,
  constraints: DayConstraints,
): { sessions: AiExercisePlan[][]; reason: null } | { sessions: null; reason: string } {
  const normalized = normalizeSessionGroups(raw, sessionsPerDay);
  if (!normalized.groups) {
    return { sessions: null, reason: normalized.reason ?? 'session_count_mismatch' };
  }
  const sessionGroups = normalized.groups;

  const maxStrengthPerSession = requestedExercisesPerSession !== null
    ? requestedExercisesPerSession
    : MAX_EXERCISES_PER_SESSION;
  const minStrengthPerSession = requestedExercisesPerSession !== null
    ? requestedExercisesPerSession
    : MIN_EXERCISES_PER_SESSION;

  const seenAcrossDay = new Set<string>();
  const seenNames = new Set<string>();
  const finalized: AiExercisePlan[][] = [];
  const focusCatalog = filterExercisesByDayFocus(
    catalog.filter((ex) => !exerciseHitsAvoidedMuscles(ex, constraints.avoidMuscles)),
    constraints.dayFocus,
  );

  for (const group of sessionGroups) {
    const sessionExercises: AiExercisePlan[] = [];
    const sessionStrengthMeta: AllowListedExercise[] = [];
    let strengthCount = 0;
    let stretchInSession = 0;

    for (const plan of group) {
      const exercise = catalogById.get(plan.exercise_id);
      if (!exercise) continue;
      if (seenAcrossDay.has(plan.exercise_id)) continue;
      const nameKey = normalizeExerciseName(exercise.name);
      if (seenNames.has(nameKey)) continue;
      if (
        !exercise.is_stretch &&
        !exerciseMatchesDayFocus(exercise, constraints.dayFocus)
      ) {
        continue;
      }
      if (
        !exercise.is_stretch &&
        exerciseHitsAvoidedMuscles(exercise, constraints.avoidMuscles)
      ) {
        continue;
      }

      if (exercise.is_stretch) {
        if (stretchCount === 0 || stretchInSession >= stretchCount) continue;
        stretchInSession += 1;
        seenAcrossDay.add(plan.exercise_id);
        seenNames.add(nameKey);
        sessionExercises.push(applyStretchPrescription(plan, experience));
      } else {
        if (strengthCount >= maxStrengthPerSession) continue;
        strengthCount += 1;
        seenAcrossDay.add(plan.exercise_id);
        seenNames.add(nameKey);
        sessionStrengthMeta.push(exercise);
        sessionExercises.push(sanitizeTargets(plan, exercise));
      }
    }

    const sessionMuscles = sessionMuscleSet(sessionStrengthMeta);

    if (requestedExercisesPerSession !== null && strengthCount < requestedExercisesPerSession) {
      const need = requestedExercisesPerSession - strengthCount;
      const fillers = pickStrengthForSession(focusCatalog, need, seenAcrossDay, seenNames);
      if (fillers.length < need) {
        return {
          sessions: null,
          reason: `too_few_exercises: could only pad ${fillers.length}/${need} strength exercises`,
        };
      }
      for (const ex of fillers) {
        seenAcrossDay.add(ex.id);
        seenNames.add(normalizeExerciseName(ex.name));
        sessionStrengthMeta.push(ex);
        sessionExercises.push(emptyStrengthPlan(ex.id));
        strengthCount += 1;
        for (const m of ex.primary_muscles) sessionMuscles.add(m);
      }
    }

    if (stretchCount > 0 && stretchInSession < stretchCount) {
      const need = stretchCount - stretchInSession;
      const fillers = pickStretchesForSession(
        stretchCatalog,
        need,
        sessionMuscles,
        seenAcrossDay,
      );
      if (fillers.length < need) {
        return {
          sessions: null,
          reason: `too_few_stretches: could only pad ${fillers.length}/${need} stretches`,
        };
      }
      for (const ex of fillers) {
        seenAcrossDay.add(ex.id);
        sessionExercises.push(applyStretchPrescription(emptyStrengthPlan(ex.id), experience));
        stretchInSession += 1;
      }
    }

    if (strengthCount < minStrengthPerSession) {
      return {
        sessions: null,
        reason: `too_few_exercises: session had ${strengthCount} strength exercises, need ${minStrengthPerSession}`,
      };
    }

    if (requestedExercisesPerSession !== null && strengthCount !== requestedExercisesPerSession) {
      return {
        sessions: null,
        reason: `strength_count_mismatch: got ${strengthCount}, expected ${requestedExercisesPerSession}`,
      };
    }

    if (stretchCount > 0 && stretchInSession !== stretchCount) {
      return {
        sessions: null,
        reason: `stretch_count_mismatch: got ${stretchInSession}, expected ${stretchCount}`,
      };
    }

    if (requestedExercisesPerSession === null && strengthCount > MAX_EXERCISES_PER_SESSION) {
      return {
        sessions: null,
        reason: `too_many_exercises: session had ${strengthCount} strength exercises, max ${MAX_EXERCISES_PER_SESSION}`,
      };
    }

    finalized.push(sessionExercises);
  }

  return { sessions: finalized, reason: null };
}
