#!/usr/bin/env node
/**
 * human-validation-sample.js — Build a stratified coding packet for human raters.
 *
 * Picks N critiques (default 40) from data/superego-critiques-classified.jsonl,
 * stratified across the 10 substantive taxonomy categories so each category has
 * coverage for Cohen's κ computation. Writes two files:
 *
 *   - exports/human-validation-pilot-sample.csv  → rater packet (no LLM labels)
 *   - exports/human-validation-pilot-key.jsonl   → matching LLM labels + metadata
 *
 * Raters fill the CSV's `human_primary` column (and optionally `human_secondary`,
 * `human_notes`). The analyze script reconstructs LLM↔human agreement by joining
 * on `item_id`.
 *
 * Usage:
 *   node scripts/human-validation-sample.js                    # 40 items, 4 per category
 *   node scripts/human-validation-sample.js --size 60          # 60 items
 *   node scripts/human-validation-sample.js --seed 42          # deterministic sample
 *   node scripts/human-validation-sample.js --include-approval # include APPROVAL rows
 *
 * Flags:
 *   --input  <path>    classified jsonl (default data/superego-critiques-classified.jsonl)
 *   --size   <N>       target sample size (default 40)
 *   --seed   <N>       RNG seed (default 20260416)
 *   --per-cat <N>      override items-per-category (default floor(size/10))
 *   --include-approval include APPROVAL/OTHER categories (default excluded as noise)
 *   --max-feedback-chars <N>  truncate feedback text (default 1500)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const argVal = (flag, def) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : def;
};
const hasFlag = (flag) => args.includes(flag);

const inputPath = argVal('--input', join(ROOT, 'data', 'superego-critiques-classified.jsonl'));
const size = parseInt(argVal('--size', '40'));
const seed = parseInt(argVal('--seed', '20260416'));
const perCatOverride = argVal('--per-cat', null);
const includeApproval = hasFlag('--include-approval');
const maxFeedbackChars = parseInt(argVal('--max-feedback-chars', '1500'));

const SUBSTANTIVE_CATEGORIES = [
  'CONTEXT_BLINDNESS',
  'RECOGNITION_FAILURE',
  'REDIRECTION',
  'FABRICATION',
  'VAGUENESS',
  'EMOTIONAL_NEGLECT',
  'REGISTER_MISMATCH',
  'PEDAGOGICAL_MISJUDGMENT',
  'LACK_OF_AGENCY',
  'MEMORY_FAILURE',
];
const NOISE_CATEGORIES = ['APPROVAL', 'OTHER', 'PARSE_ERROR', 'DRY_RUN', 'MISSING'];

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function csvEscape(val) {
  if (val == null) return '';
  const s = String(val).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.includes(',') || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function itemId(row) {
  const h = createHash('sha1')
    .update(`${row.dialogueId || ''}::${row.round || 0}::${(row.feedback || '').slice(0, 200)}`)
    .digest('hex');
  return h.slice(0, 10);
}

function learnerSnippet(ctx) {
  if (!ctx) return '';
  const match =
    ctx.match(/### User Profile[\s\S]{0,400}/) ||
    ctx.match(/### Current Session[\s\S]{0,400}/) ||
    ctx.match(/### Recent Chat History[\s\S]{0,400}/);
  return match ? match[0] : ctx.slice(0, 400);
}

function main() {
  if (!existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}`);
    console.error('Run scripts/classify-superego-critiques.js first.');
    process.exit(1);
  }
  const lines = readFileSync(inputPath, 'utf-8').trim().split('\n');
  const all = lines.map((l) => JSON.parse(l));
  console.error(`Loaded ${all.length} classified critiques`);

  const categories = includeApproval
    ? [...SUBSTANTIVE_CATEGORIES, ...NOISE_CATEGORIES]
    : SUBSTANTIVE_CATEGORIES;

  const perCat = perCatOverride
    ? parseInt(perCatOverride)
    : Math.max(1, Math.floor(size / categories.length));

  console.error(
    `Target: ${size} items, ${perCat} per category across ${categories.length} categories`
  );

  const rng = mulberry32(seed);

  const buckets = {};
  for (const cat of categories) buckets[cat] = [];
  for (const row of all) {
    const primary = row.classification?.primary;
    if (!primary) continue;
    if (!buckets[primary]) continue;
    if (!row.feedback || row.feedback.length < 40) continue;
    buckets[primary].push(row);
  }

  const sample = [];
  const categoryCounts = {};
  for (const cat of categories) {
    const pool = shuffle(buckets[cat], rng);
    const take = Math.min(perCat, pool.length);
    sample.push(...pool.slice(0, take));
    categoryCounts[cat] = take;
  }

  if (sample.length < size) {
    const deficit = size - sample.length;
    const remaining = all.filter(
      (r) =>
        r.classification?.primary &&
        categories.includes(r.classification.primary) &&
        r.feedback &&
        r.feedback.length >= 40 &&
        !sample.includes(r)
    );
    const extra = shuffle(remaining, rng).slice(0, deficit);
    sample.push(...extra);
    for (const e of extra) {
      const p = e.classification.primary;
      categoryCounts[p] = (categoryCounts[p] || 0) + 1;
    }
  }

  const shuffled = shuffle(sample, rng);

  const exportsDir = join(ROOT, 'exports');
  if (!existsSync(exportsDir)) mkdirSync(exportsDir, { recursive: true });
  const csvPath = join(exportsDir, 'human-validation-pilot-sample.csv');
  const keyPath = join(exportsDir, 'human-validation-pilot-key.jsonl');

  const header = [
    'item_id',
    'feedback',
    'ego_generate',
    'ego_revision',
    'learner_context_snippet',
    'human_primary',
    'human_secondary',
    'human_confident',
    'human_notes',
  ];
  const rows = [];
  const keys = [];
  for (const row of shuffled) {
    const id = itemId(row);
    const fb = (row.feedback || '').slice(0, maxFeedbackChars);
    const eg = (row.egoGenerate || '').slice(0, 500);
    const er = (row.egoRevision || '').slice(0, 500);
    const snip = learnerSnippet(row.learnerContext).slice(0, 400);
    rows.push(
      [
        csvEscape(id),
        csvEscape(fb),
        csvEscape(eg),
        csvEscape(er),
        csvEscape(snip),
        '',
        '',
        '',
        '',
      ].join(',')
    );
    keys.push(
      JSON.stringify({
        item_id: id,
        llm_primary: row.classification.primary,
        llm_secondary: row.classification.secondary || [],
        llm_confidence: row.classification.confidence,
        llm_rationale: row.classification.brief_rationale,
        dialogue_id: row.dialogueId,
        profile: row.profileName,
        model: row.model,
        provider: row.provider,
        learner_architecture: row.learnerArchitecture,
        approved: row.approved,
        intervention_type: row.interventionType,
      })
    );
  }

  writeFileSync(csvPath, header.join(',') + '\n' + rows.join('\n') + '\n');
  writeFileSync(keyPath, keys.join('\n') + '\n');

  console.error('\n=== Sample built ===');
  console.error(`  CSV (rater packet): ${csvPath}`);
  console.error(`  Key (LLM labels):   ${keyPath}`);
  console.error(`  Total items: ${shuffled.length}`);
  console.error('\nCategory coverage:');
  for (const cat of categories) {
    const n = categoryCounts[cat] || 0;
    console.error(`  ${cat.padEnd(26)} n=${n}`);
  }
  console.error('\nNext steps:');
  console.error('  1. Send exports/human-validation-pilot-sample.csv to 2 human raters');
  console.error('  2. Raters fill the human_primary column (required) using docs/research/human-coding-codebook.md');
  console.error('  3. Save filled copies as exports/human-validation-pilot-rater-A.csv and -rater-B.csv');
  console.error('  4. Run: node scripts/human-validation-analyze.js');
}

main();
