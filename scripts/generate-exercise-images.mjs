#!/usr/bin/env node
/**
 * Batch-generates anatomical exercise illustrations via OpenAI Images API.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/generate-exercise-images.mjs [options]
 *
 * Options:
 *   --resume           Skip slugs whose JPG already exists
 *   --batch-size N     Max images this run (default: all pending)
 *   --only-stretches   Generate stretch entries only
 *   --only-exercises   Generate strength entries only (non-stretch)
 *   --delay-ms N       Pause between API calls (default: 1500)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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

const REFERENCE_SLUGS = ['arnold-press', 'bench-press-barbell', 'bent-over-row-barbell'];
const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const API_KEY = process.env.OPENAI_API_KEY;

function parseArgs(argv) {
  const opts = {
    resume: false,
    batchSize: Infinity,
    onlyStretches: false,
    onlyExercises: false,
    delayMs: 1500,
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

/** Minimal CSV parser (same as import script). */
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
    'Fitness app anatomical illustration, exact style match to reference:',
    '768x512 landscape, pure white background.',
    'Grayscale 3D anatomical male figure with visible muscle striations and definition.',
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

function loadReferenceImages() {
  return REFERENCE_SLUGS.map((slug) => {
    const filePath = path.join(ASSETS_DIR, `${slug}.jpg`);
    const buf = fs.readFileSync(filePath);
    return {
      slug,
      base64: buf.toString('base64'),
      mime: 'image/jpeg',
    };
  });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateImage(prompt, references) {
  const body = {
    model: MODEL,
    prompt,
    size: '1536x1024',
    quality: 'medium',
    output_format: 'jpeg',
    n: 1,
  };

  // gpt-image-1 supports reference images via the edits endpoint when available;
  // fall back to generations-only if references fail.
  const tryEdits = references.length > 0;

  if (tryEdits) {
    const form = new FormData();
    form.append('model', MODEL);
    form.append('prompt', prompt);
    form.append('size', '1536x1024');
    form.append('quality', 'medium');
    form.append('output_format', 'jpeg');
    form.append('n', '1');
    for (const ref of references.slice(0, 2)) {
      const blob = new Blob([Buffer.from(ref.base64, 'base64')], { type: ref.mime });
      form.append('image[]', blob, `${ref.slug}.jpg`);
    }

    const editRes = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}` },
      body: form,
    });

    if (editRes.ok) {
      const data = await editRes.json();
      const b64 = data.data?.[0]?.b64_json;
      if (b64) return Buffer.from(b64, 'base64');
    }
  }

  const genRes = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!genRes.ok) {
    const errText = await genRes.text();
    throw new Error(`OpenAI API ${genRes.status}: ${errText.slice(0, 500)}`);
  }

  const data = await genRes.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data in API response');
  return Buffer.from(b64, 'base64');
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

async function main() {
  if (!API_KEY) {
    console.error('OPENAI_API_KEY is required.');
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

  console.log(`Generating ${pending.length} images (model=${MODEL})...`);
  const references = loadReferenceImages();
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < pending.length; i++) {
    const entry = pending[i];
    const outPath = path.join(ASSETS_DIR, `${entry.slug}.jpg`);
    const csvRow = csvByName.get(entry.name);
    const prompt = buildPrompt(entry, csvRow);

    process.stdout.write(`[${i + 1}/${pending.length}] ${entry.name} ... `);

    try {
      const buf = await generateImage(prompt, references);
      const rawPath = `${outPath}.raw.jpg`;
      fs.writeFileSync(rawPath, buf);
      resizeToTarget(rawPath, outPath);
      fs.unlinkSync(rawPath);
      ok++;
      console.log('ok');
    } catch (err) {
      fail++;
      console.log(`FAIL: ${err.message}`);
    }

    if (i < pending.length - 1 && opts.delayMs > 0) {
      await sleep(opts.delayMs);
    }
  }

  console.log(`Done: ${ok} ok, ${fail} failed, ${pending.length} attempted.`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
