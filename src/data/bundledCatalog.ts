/**
 * Local master catalog shipped with the app (exercises + prescriptions).
 * Customs / overrides still come from Supabase.
 */

import catalog from './bundledCatalog.json';
import type { ExercisePrescription } from '../lib/supabase/queries/prescriptions';

export type BundledMasterExercise = {
  id: string;
  name: string;
  description?: string;
  density_score: number;
  primary_muscles: string[];
  secondary_muscles?: string[];
  implicit_hits: Record<string, number>;
  is_unilateral: boolean;
  setup_buffer_sec: number;
  avg_time_per_set_sec: number;
  is_timed: boolean;
  is_stretch?: boolean;
  equipment_needed?: string[];
  movement_pattern?: string;
  tempo_category?: string;
};

type BundledPrescription = ExercisePrescription;

type CatalogFile = {
  generatedAt: string;
  exercises: BundledMasterExercise[];
  prescriptions: BundledPrescription[];
  aiRecommended: { exercise_id: string; priority_order: number; is_active: boolean }[];
};

const data = catalog as unknown as CatalogFile;

const exercisesById = new Map<string, BundledMasterExercise>(
  data.exercises.map((ex) => [ex.id, ex])
);

/** Key: `${exerciseId}|${experience}|${mode}` */
const prescriptionsByKey = new Map<string, BundledPrescription>();
/** Key: `${experience}|${mode}` → list */
const prescriptionsByExperienceMode = new Map<string, BundledPrescription[]>();

for (const p of data.prescriptions) {
  if (p.is_active === false) continue;
  prescriptionsByKey.set(`${p.exercise_id}|${p.experience}|${p.mode}`, p);
  const emKey = `${p.experience}|${p.mode}`;
  const list = prescriptionsByExperienceMode.get(emKey) ?? [];
  list.push(p);
  prescriptionsByExperienceMode.set(emKey, list);
}

export const BUNDLED_CATALOG_GENERATED_AT = data.generatedAt;

export function getBundledMasterExercises(): BundledMasterExercise[] {
  return data.exercises;
}

export function getBundledMasterExercise(id: string): BundledMasterExercise | undefined {
  return exercisesById.get(id);
}

export function getBundledMasterExercisesByIds(ids: string[]): BundledMasterExercise[] {
  const out: BundledMasterExercise[] = [];
  for (const id of ids) {
    const ex = exercisesById.get(id);
    if (ex) out.push(ex);
  }
  return out;
}

export function getBundledPrescription(
  exerciseId: string,
  experience: string,
  mode: 'reps' | 'timed'
): BundledPrescription | null {
  return prescriptionsByKey.get(`${exerciseId}|${experience}|${mode}`) ?? null;
}

export function getBundledPrescriptionsForExercises(
  exerciseIds: string[],
  experience: string,
  mode: 'reps' | 'timed'
): Map<string, BundledPrescription> {
  const map = new Map<string, BundledPrescription>();
  for (const id of exerciseIds) {
    const p = prescriptionsByKey.get(`${id}|${experience}|${mode}`);
    if (p) map.set(id, p);
  }
  return map;
}

export function getBundledAiRecommended(): {
  exercise_id: string;
  priority_order: number;
}[] {
  return (data.aiRecommended ?? [])
    .filter((r) => r.is_active !== false)
    .map((r) => ({ exercise_id: r.exercise_id, priority_order: r.priority_order }))
    .sort((a, b) => a.priority_order - b.priority_order);
}
