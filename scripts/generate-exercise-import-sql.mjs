#!/usr/bin/env node
/**
 * Generates SQL migrations + manifests from master exercise CSV.
 *
 * Usage: node scripts/generate-exercise-import-sql.mjs
 *
 * Outputs:
 *   supabase/migrations/YYYYMMDD_import_master_exercises_from_csv.sql
 *   scripts/output/muscle-key-normalization.json
 *   scripts/output/exercise-image-manifest.json
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  normalizeMuscleArray,
  normalizeImplicitHits,
} from './lib/muscleKeyNormalization.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CSV_PATH = path.join(
  ROOT,
  'supabase/seed/master_exercises_and_stretches_expanded_advanced.csv',
);
const OUTPUT_DIR = path.join(ROOT, 'scripts/output');

/** Existing DB exercises (45) — UPDATE by name, preserve UUIDs. */
const EXISTING_EXERCISE_NAMES = new Set([
  'Arnold Press', 'Bench Press (Barbell)', 'Bent Over Row (Barbell)',
  'Bicep Curl (Barbell/Dumbbell)', 'Bulgarian Split Squat', 'Calf Raise',
  'Chin Up (Supinated)', 'Cossack Squat', 'Deadlift (Conventional)',
  'Diamond Push Up', 'Dip', 'Dumbbell Fly', 'Face Pull', "Farmer's Walk",
  'Front Squat', 'Hammer Curl', 'Hanging Knee Raise', 'Hanging Leg Raise',
  'Hip Thrust', 'Incline Dumbbell Press', 'L-Sit', 'Lat Pulldown',
  'Lateral Raise', 'Leg Curl (Seated/Lying)', 'Leg Extension', 'Leg Press',
  'Nordic Curl', 'Overhead Press', 'Overhead Tricep Extension', 'Pike Push Up',
  'Pistol Squat', 'Pull Up', 'Pull Up (Overhand)', 'Pull Up (Wide Grip)',
  'Push Up', 'Reverse Nordic Curl', 'Romanian Deadlift (RDL)', 'Seated Cable Row',
  'Side Plank', 'Skullcrusher', 'Squat (Barbell)', 'Superman Hold',
  'Tricep Pushdown', 'V-Sit', 'Walking Lunge',
]);

const EXISTING_IMAGE_SLUGS = new Set(
  fs.readdirSync(path.join(ROOT, 'assets/exercises'))
    .filter((f) => f.endsWith('.jpg'))
    .map((f) => f.replace(/\.jpg$/, '')),
);

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Minimal CSV parser handling quoted fields with embedded commas and doubled quotes. */
function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  function readField() {
    if (text[i] === '"') {
      i++;
      let field = '';
      while (i < len) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += text[i++];
        }
      }
      if (text[i] === ',') i++;
      return field;
    }
    let field = '';
    while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
      field += text[i++];
    }
    if (text[i] === ',') i++;
    return field;
  }

  const headers = [];
  while (i < len && text[i] !== '\n' && text[i] !== '\r') {
    headers.push(readField());
  }
  if (text[i] === '\r') i++;
  if (text[i] === '\n') i++;

  while (i < len) {
    if (text[i] === '\r' || text[i] === '\n') {
      i++;
      continue;
    }
    const row = {};
    for (const h of headers) {
      row[h] = readField();
    }
    if (Object.values(row).some((v) => v !== '')) rows.push(row);
    while (i < len && (text[i] === '\r' || text[i] === '\n')) i++;
  }
  return rows;
}

function parseJsonField(raw, fallback) {
  if (!raw || raw.trim() === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON: ${raw.slice(0, 80)}`);
  }
}

function sqlStr(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlTextArray(arr) {
  if (!arr || arr.length === 0) return 'ARRAY[]::text[]';
  return `ARRAY[${arr.map((v) => sqlStr(v)).join(', ')}]`;
}

function sqlJsonb(obj) {
  return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`;
}

function sqlBool(v) {
  return v ? 'true' : 'false';
}

function normalizeRow(row, audit) {
  const name = row.name?.trim();
  if (!name) throw new Error('Row missing name');

  const primary = normalizeMuscleArray(
    parseJsonField(row.primary_muscles, []),
    name,
    audit,
  );
  const secondary = normalizeMuscleArray(
    parseJsonField(row.secondary_muscles, []),
    name,
    audit,
  );
  const implicit = normalizeImplicitHits(
    parseJsonField(row.implicit_hits, {}),
    name,
    audit,
  );
  const equipmentRaw = parseJsonField(row.equipment_needed, []);

  return {
    name,
    description: row.description?.trim() || null,
    density_score: Number(row.density_score),
    primary_muscles: primary,
    secondary_muscles: secondary,
    implicit_hits: implicit,
    is_unilateral: row.is_unilateral === 'true',
    setup_buffer_sec: Number(row.setup_buffer_sec),
    avg_time_per_set_sec: Number(row.avg_time_per_set_sec),
    is_timed: row.is_timed === 'true',
    equipment_needed: equipmentRaw,
    movement_pattern: row.movement_pattern?.trim() || null,
    tempo_category: row.tempo_category?.trim() || null,
    is_stretch: row.is_stretch === 'true',
  };
}

function buildUpdateSql(n) {
  return `UPDATE v2_exercises SET
  description = ${sqlStr(n.description)},
  density_score = ${n.density_score},
  primary_muscles = ${sqlTextArray(n.primary_muscles)},
  secondary_muscles = ${sqlTextArray(n.secondary_muscles)},
  implicit_hits = ${sqlJsonb(n.implicit_hits)},
  is_unilateral = ${sqlBool(n.is_unilateral)},
  setup_buffer_sec = ${n.setup_buffer_sec},
  avg_time_per_set_sec = ${n.avg_time_per_set_sec},
  is_timed = ${sqlBool(n.is_timed)},
  equipment_needed = ${sqlTextArray(n.equipment_needed)},
  movement_pattern = ${sqlStr(n.movement_pattern)},
  tempo_category = ${sqlStr(n.tempo_category)},
  is_stretch = ${sqlBool(n.is_stretch)},
  updated_at = now()
WHERE name = ${sqlStr(n.name)};`;
}

function buildInsertSql(n, id) {
  return `INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '${id}',
  ${sqlStr(n.name)},
  ${sqlStr(n.description)},
  ${n.density_score},
  ${sqlTextArray(n.primary_muscles)},
  ${sqlTextArray(n.secondary_muscles)},
  ${sqlJsonb(n.implicit_hits)},
  ${sqlBool(n.is_unilateral)},
  ${n.setup_buffer_sec},
  ${n.avg_time_per_set_sec},
  ${sqlBool(n.is_timed)},
  ${sqlTextArray(n.equipment_needed)},
  ${sqlStr(n.movement_pattern)},
  ${sqlStr(n.tempo_category)},
  ${sqlBool(n.is_stretch)}
);`;
}

function main() {
  const csvText = fs.readFileSync(CSV_PATH, 'utf8');
  const rawRows = parseCsv(csvText);
  const audit = { mapped: [], unresolved: [] };
  const normalized = rawRows.map((r) => normalizeRow(r, audit));

  const names = normalized.map((n) => n.name);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupes.length) throw new Error(`Duplicate names: ${dupes.join(', ')}`);
  if (audit.unresolved.length) {
    throw new Error(
      `Unresolved muscle keys: ${JSON.stringify(audit.unresolved.slice(0, 5))}`,
    );
  }

  for (const n of normalized) {
    if (n.density_score < 0 || n.density_score > 10) {
      throw new Error(`Invalid density_score for ${n.name}: ${n.density_score}`);
    }
    if (n.primary_muscles.length === 0) {
      throw new Error(`No primary muscles for ${n.name}`);
    }
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const updates = [];
  const inserts = [];
  const manifest = [];

  for (const n of normalized) {
    const slug = slugify(n.name);
    manifest.push({
      name: n.name,
      slug,
      primary_muscles: n.primary_muscles,
      is_stretch: n.is_stretch,
      has_image: EXISTING_IMAGE_SLUGS.has(slug),
    });

    if (EXISTING_EXERCISE_NAMES.has(n.name)) {
      updates.push(buildUpdateSql(n));
    } else {
      inserts.push(buildInsertSql(n, crypto.randomUUID()));
    }
  }

  if (updates.length !== 45) {
    console.warn(`Warning: expected 45 updates, got ${updates.length}`);
  }

  const migrationName = '20260611120000_import_master_exercises_from_csv.sql';
  const migrationPath = path.join(ROOT, 'supabase/migrations', migrationName);
  const sql = `-- Auto-generated from supabase/seed/master_exercises_and_stretches_expanded_advanced.csv
-- ${normalized.length} exercises: ${updates.length} updates, ${inserts.length} inserts

${updates.join('\n\n')}

${inserts.join('\n\n')}
`;

  fs.writeFileSync(migrationPath, sql);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'muscle-key-normalization.json'),
    JSON.stringify(
      {
        mappedCount: audit.mapped.length,
        mapped: audit.mapped,
        unresolved: audit.unresolved,
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'exercise-image-manifest.json'),
    JSON.stringify(manifest, null, 2),
  );

  console.log(`Wrote ${migrationPath}`);
  console.log(`  Updates: ${updates.length}, Inserts: ${inserts.length}`);
  console.log(`  Muscle mappings: ${audit.mapped.length}`);
  console.log(
    `  Images needed: ${manifest.filter((m) => !m.has_image).length}`,
  );
}

main();
