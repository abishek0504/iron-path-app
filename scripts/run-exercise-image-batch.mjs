#!/usr/bin/env node
/**
 * Batch-generates exercise images by calling the generate-exercise-image Edge Function
 * (uses OPENAI_API_KEY from Supabase secrets — no local key required).
 *
 * Usage:
 *   node scripts/run-exercise-image-batch.mjs [options]
 *
 * Options:
 *   --resume           Skip slugs whose JPG already exists
 *   --batch-size N     Max images this run (default: all pending)
 *   --only-stretches   Stretch entries only
 *   --only-exercises   Strength entries only
 *   --delay-ms N       Pause between calls (default: 2000)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'scripts/output/exercise-image-manifest.json');
const CSV_PATH = path.join(
  ROOT,
  'supabase/seed/master_exercises_and_stretches_expanded_advanced.csv',
);
const ASSETS_DIR = path.join(ROOT, 'assets/exercises');
const TARGET_WIDTH = 768;
const TARGET_HEIGHT = 512;

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

function parseArgs(argv) {
  const opts = {
    resume: false,
    batchSize: Infinity,
    onlyStretches: false,
    onlyExercises: false,
    delayMs: 2000,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--resume') opts.resume = true;
    else if (arg === '--only-stretches') opts.onlyStretches = true;
    else if (arg === '--only-exercises') opts.onlyExercises = true;
    else if (arg === '--batch-size') opts.batchSize = Number(argv[++i]);
    else if (arg === '--delay-ms') opts.delayMs = Number(argv[++i]);
  }
  return opts;
}

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
      return field;
    }
    let field = '';
    while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
      field += text[i++];
    }
    return field;
  }

  const headers = [];
  while (i < len && text[i] !== '\n' && text[i] !== '\r') {
    if (text[i] === ',') {
      i++;
      continue;
    }
    headers.push(readField());
    if (text[i] === ',') i++;
  }
  while (text[i] === '\r' || text[i] === '\n') i++;

  while (i < len) {
    const row = {};
    for (let h = 0; h < headers.length; h++) {
      if (i >= len) break;
      row[headers[h]] = readField();
      if (text[i] === ',') i++;
    }
    while (text[i] === '\r' || text[i] === '\n') i++;
    if (Object.values(row).some((v) => v)) rows.push(row);
  }
  return rows;
}

function parseJsonField(raw, fallback) {
  if (!raw || raw.trim() === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function formatMuscles(keys) {
  return keys.map((k) => k.replace(/_/g, ' ')).join(', ');
}

function buildPrompt(entry, csvRow) {
  const muscles = formatMuscles(entry.primary_muscles);
  const equipment = parseJsonField(csvRow?.equipment_needed, []);
  const equipmentText =
    equipment.length > 0
      ? `Equipment shown in gray/black: ${equipment.map((e) => e.replace(/_/g, ' ')).join(', ')}.`
      : 'Bodyweight only — no equipment.';

  const poseInstruction = entry.is_stretch
    ? 'Single held stretch pose showing proper form.'
    : 'Side-by-side start and end positions for the movement (two figures left and right).';

  return [
    'Fitness app anatomical illustration:',
    '768x512 landscape, pure white background.',
    'Grayscale 3D anatomical male figure with visible muscle striations.',
    `Primary target muscle(s) highlighted in bright red: ${muscles}.`,
    equipmentText,
    poseInstruction,
    `Exercise: ${entry.name}.`,
    csvRow?.description ? `Movement: ${csvRow.description}` : '',
    'No text, labels, watermarks, or logos. Clean clinical fitness diagram.',
  ]
    .filter(Boolean)
    .join(' ');
}

function resizeToTarget(inputPath, outputPath) {
  const tmp = `${outputPath}.tmp.jpg`;
  fs.copyFileSync(inputPath, tmp);
  try {
    execSync(
      `sips -z ${TARGET_HEIGHT} ${TARGET_WIDTH} "${tmp}" --out "${outputPath}" 2>/dev/null`,
      { stdio: 'pipe' },
    );
    fs.unlinkSync(tmp);
  } catch {
    fs.renameSync(tmp, outputPath);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateViaEdgeFunction(supabaseUrl, anonKey, prompt) {
  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/generate-exercise-image`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.detail || `HTTP ${res.status}`);
  }
  if (!data.image_base64) throw new Error('Missing image_base64 in response');
  return Buffer.from(data.image_base64, 'base64');
}

async function main() {
  loadEnv();
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    console.error('EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY required in .env');
    process.exit(1);
  }

  const opts = parseArgs(process.argv);
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const csvRows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  const csvByName = new Map(csvRows.map((r) => [r.name, r]));

  let pending = manifest.filter((e) => !e.has_image);
  if (opts.onlyStretches) pending = pending.filter((e) => e.is_stretch);
  if (opts.onlyExercises) pending = pending.filter((e) => !e.is_stretch);
  if (opts.resume) {
    pending = pending.filter((e) => !fs.existsSync(path.join(ASSETS_DIR, `${e.slug}.jpg`)));
  }
  pending = pending.slice(0, opts.batchSize);

  if (pending.length === 0) {
    console.log('No pending images.');
    return;
  }

  console.log(`Generating ${pending.length} images via Edge Function...`);
  let ok = 0;
  let fail = 0;
  const failures = [];

  for (let i = 0; i < pending.length; i++) {
    const entry = pending[i];
    const outPath = path.join(ASSETS_DIR, `${entry.slug}.jpg`);
    const csvRow = csvByName.get(entry.name);
    const prompt = buildPrompt(entry, csvRow);

    process.stdout.write(`[${i + 1}/${pending.length}] ${entry.name} ... `);

    try {
      const buf = await generateViaEdgeFunction(supabaseUrl, anonKey, prompt);
      const rawPath = `${outPath}.raw.jpg`;
      fs.writeFileSync(rawPath, buf);
      resizeToTarget(rawPath, outPath);
      fs.unlinkSync(rawPath);
      ok++;
      console.log('ok');
    } catch (err) {
      fail++;
      failures.push({ name: entry.name, slug: entry.slug, error: err.message });
      console.log(`FAIL: ${err.message}`);
    }

    if (i < pending.length - 1 && opts.delayMs > 0) {
      await sleep(opts.delayMs);
    }
  }

  console.log(`Done: ${ok} ok, ${fail} failed.`);
  if (failures.length) {
    fs.writeFileSync(
      path.join(ROOT, 'scripts/output/image-gen-failures.json'),
      JSON.stringify(failures, null, 2),
    );
  }
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
