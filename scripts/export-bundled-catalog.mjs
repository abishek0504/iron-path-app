/**
 * Refresh src/data/bundledCatalog.json from Supabase.
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or a logged-in user JWT that can read the tables).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/export-bundled-catalog.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const client = createClient(url, key);

async function fetchAll(table, select, orderCol) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    let q = client.from(table).select(select).range(from, from + pageSize - 1);
    if (orderCol) q = q.order(orderCol, { ascending: true });
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

const exercises = await fetchAll(
  'v2_exercises',
  'id,name,description,density_score,primary_muscles,secondary_muscles,implicit_hits,is_unilateral,setup_buffer_sec,avg_time_per_set_sec,is_timed,is_stretch,equipment_needed,movement_pattern,tempo_category',
  'name'
);
const prescriptions = (
  await fetchAll(
    'v2_exercise_prescriptions',
    'id,exercise_id,experience,mode,sets_min,sets_max,reps_min,reps_max,duration_sec_min,duration_sec_max,suggested_weight_lbs,suggested_weight_kg,suggested_weight_multiplier_bw,is_active',
    'exercise_id'
  )
).filter((p) => p.is_active !== false);
const aiRecommended = (
  await fetchAll(
    'v2_ai_recommended_exercises',
    'exercise_id,priority_order,is_active',
    'priority_order'
  )
).filter((r) => r.is_active !== false);

const outPath = path.join('src', 'data', 'bundledCatalog.json');
const payload = {
  generatedAt: new Date().toISOString(),
  exercises,
  prescriptions,
  aiRecommended,
};
fs.writeFileSync(outPath, JSON.stringify(payload));
console.log(
  JSON.stringify(
    {
      outPath,
      exercises: exercises.length,
      prescriptions: prescriptions.length,
      aiRecommended: aiRecommended.length,
      bytes: fs.statSync(outPath).size,
    },
    null,
    2
  )
);
