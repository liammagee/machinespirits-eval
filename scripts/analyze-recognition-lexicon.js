#!/usr/bin/env node

/**
 * Recognition Lexicon Mechanism Analysis (TODO §D1, first pass)
 *
 * Where `analyze-text-behaviors.js` §2 measures data-driven vocabulary divergence
 * (which words happen to differ between base and recog runs), this script asks
 * the theory-driven question: do tutor outputs under the recognition prompt
 * actually USE more of the specific Hegelian recognition vocabulary, and does
 * that usage correlate with rubric scores?
 *
 * Concept families (all case-insensitive, word-boundary matched):
 *
 *   recognition     — recognition / recognize / recognizing / recognise (UK)
 *   mutuality       — mutual / mutually / mutuality
 *   autonomy        — autonomous / autonomy
 *   dialectic       — dialectic / dialectical / dialectically
 *   transformation  — transform / transformation / transformative
 *   intersubject    — intersubjective / intersubjectivity
 *   struggle        — struggle / productive tension
 *   repair          — repair / misrecognition / rupture
 *   hegel           — hegel / hegelian / master-slave
 *   genuine         — genuine / genuinely
 *
 * Per response we compute (for the final tutor message — suggestions.message,
 * suggestions.reasoning, suggestions.title concatenated):
 *
 *   density[concept]  = occurrences(concept) / word_count
 *   totalDensity      = Σ density[c] over all concepts
 *
 * Then aggregate by (run_id, profile, condition) and, optionally, correlate
 * with `overall_score` / `tutor_first_turn_score` / `tutor_holistic_overall_score`.
 *
 * Pure computation on the DB — no LLM calls, no dialogue logs required.
 *
 * Usage:
 *   node scripts/analyze-recognition-lexicon.js [<runId> ...] [--json] [--output PATH] [--min-rows N]
 *
 * If no run IDs are given, reports across ALL scored rows in the DB.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '..', 'data', 'evaluations.db');

// ── Lexicon ─────────────────────────────────────────────────────────────
//
// Each concept is a list of regex patterns. Patterns use `\b` word boundaries
// and are matched case-insensitively. Keep each pattern tight so that we
// don't spuriously match, e.g., "recognize_pattern" the generic English verb
// from "I don't recognize this format."
//
// Note: "recognize/recognition" CAN appear in placebo output (it's ordinary
// English). The analysis is a DENSITY comparison, not a presence/absence
// one — the hypothesis is that recog-prompt cells *concentrate* the concept
// more densely, not that base cells never mention it.

export const RECOGNITION_LEXICON = {
  recognition: [/\brecogn(?:ition|itions|ize|ized|izes|izing|ise|ised|ising)\b/i],
  mutuality: [/\bmutual(?:ly|ity)?\b/i],
  autonomy: [/\bautonomous\b/i, /\bautonomy\b/i],
  dialectic: [/\bdialectic(?:al|ally|s)?\b/i],
  transformation: [/\btransform(?:ative|ation|ations|ed|ing|s)?\b/i],
  intersubject: [/\binter[-\s]?subjective(?:ly|ity)?\b/i],
  struggle: [/\bstruggl(?:e|es|ed|ing)\b/i, /\bproductive\s+tension\b/i],
  repair: [/\brepair(?:ed|ing|s)?\b/i, /\bmisrecognition\b/i, /\brupture(?:s|d)?\b/i],
  hegel: [/\bhegel(?:ian)?\b/i, /\bmaster[-\s]slave\b/i],
  genuine: [/\bgenuine(?:ly)?\b/i],
};

export const CONCEPTS = Object.keys(RECOGNITION_LEXICON);

// ── Text processing ─────────────────────────────────────────────────────

export function extractText(suggestionsJson) {
  if (!suggestionsJson) return '';
  let arr;
  try {
    arr = typeof suggestionsJson === 'string' ? JSON.parse(suggestionsJson) : suggestionsJson;
  } catch {
    return '';
  }
  if (!Array.isArray(arr)) return '';
  return arr
    .map((s) => [s?.title, s?.message, s?.reasoning].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(' ');
}

export function wordCount(text) {
  if (!text) return 0;
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

export function countConcept(text, patterns) {
  let n = 0;
  for (const p of patterns) {
    const matches = text.match(new RegExp(p.source, p.flags.includes('g') ? p.flags : `${p.flags}g`));
    n += matches ? matches.length : 0;
  }
  return n;
}

export function computeConceptDensities(text) {
  const wc = wordCount(text);
  const perConcept = {};
  let total = 0;
  for (const concept of CONCEPTS) {
    const count = countConcept(text, RECOGNITION_LEXICON[concept]);
    perConcept[concept] = { count, density: wc > 0 ? count / wc : 0 };
    total += count;
  }
  return { wordCount: wc, totalCount: total, totalDensity: wc > 0 ? total / wc : 0, perConcept };
}

// ── Stats ───────────────────────────────────────────────────────────────

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function sd(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function cohensD(a, b) {
  if (a.length < 2 || b.length < 2) return 0;
  const pooled = Math.sqrt(((a.length - 1) * sd(a) ** 2 + (b.length - 1) * sd(b) ** 2) / (a.length + b.length - 2));
  if (pooled === 0) return 0;
  return (mean(a) - mean(b)) / pooled;
}

export function pearson(xs, ys) {
  if (xs.length !== ys.length || xs.length < 3) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

// ── Aggregation ─────────────────────────────────────────────────────────

function isRecog(profile) {
  return /(_recog_|_recog$|recognition)/i.test(profile);
}

/**
 * Summarize row measurements by concept × condition.
 * Returns: concept densities in base vs recog, Cohen's d, pair-level pearson
 * with the row's primary score.
 */
export function summarizeByConcept(rows) {
  const byCond = { base: [], recog: [] };
  for (const r of rows) byCond[r.condition].push(r);

  const summary = [];
  for (const concept of CONCEPTS) {
    const baseDensities = byCond.base.map((r) => r.perConcept[concept].density);
    const recogDensities = byCond.recog.map((r) => r.perConcept[concept].density);

    const xs = [];
    const ys = [];
    for (const r of [...byCond.base, ...byCond.recog]) {
      if (r.score == null) continue;
      xs.push(r.perConcept[concept].density);
      ys.push(r.score);
    }

    summary.push({
      concept,
      baseN: baseDensities.length,
      recogN: recogDensities.length,
      baseMeanDensity: mean(baseDensities),
      recogMeanDensity: mean(recogDensities),
      dCondition: cohensD(recogDensities, baseDensities),
      rWithScore: pearson(xs, ys),
      rN: xs.length,
    });
  }
  summary.sort((a, b) => Math.abs(b.dCondition) - Math.abs(a.dCondition));
  return summary;
}

/**
 * Overall density by condition (sum across all concepts per row).
 */
export function summarizeOverall(rows) {
  const baseTotals = rows.filter((r) => r.condition === 'base').map((r) => r.totalDensity);
  const recogTotals = rows.filter((r) => r.condition === 'recog').map((r) => r.totalDensity);

  const xs = [];
  const ys = [];
  for (const r of rows) {
    if (r.score == null) continue;
    xs.push(r.totalDensity);
    ys.push(r.score);
  }

  return {
    baseN: baseTotals.length,
    recogN: recogTotals.length,
    baseMeanDensity: mean(baseTotals),
    recogMeanDensity: mean(recogTotals),
    dCondition: cohensD(recogTotals, baseTotals),
    rWithScore: pearson(xs, ys),
    rN: xs.length,
  };
}

// ── Report ──────────────────────────────────────────────────────────────

function fmtNum(v, digits = 4) {
  if (v == null || Number.isNaN(v)) return '–';
  return v.toFixed(digits);
}

export function buildReport({ runIds, overall, byConcept, rowCount, minRows }) {
  const lines = [];
  lines.push('# Recognition Lexicon Mechanism (D1, first pass)');
  lines.push('');
  lines.push(`**Runs:** ${runIds.length ? runIds.join(', ') : '(all scored rows)'}`);
  lines.push(`**Rows analyzed:** ${rowCount}`);
  lines.push('');
  lines.push('Measures per-response density of ten Hegelian recognition concepts, then asks:');
  lines.push('1. Do recog-prompt cells use the vocabulary more densely than base cells? (Cohen\'s d row-level)');
  lines.push('2. Is concept density correlated with the rubric score? (Pearson r row-level)');
  lines.push('');
  lines.push('## Overall recognition density');
  lines.push('');
  lines.push('| Cond | N | Mean density (all concepts) |');
  lines.push('| --- | --- | --- |');
  lines.push(`| base  | ${overall.baseN}  | ${fmtNum(overall.baseMeanDensity)} |`);
  lines.push(`| recog | ${overall.recogN} | ${fmtNum(overall.recogMeanDensity)} |`);
  lines.push('');
  lines.push(`- **Cohen's d (recog − base):** ${fmtNum(overall.dCondition, 3)}`);
  lines.push(`- **Pearson r (density × score):** ${fmtNum(overall.rWithScore, 3)} (n=${overall.rN})`);
  lines.push('');

  const keptConcepts = byConcept.filter((c) => c.baseN + c.recogN >= minRows);
  const droppedCount = byConcept.length - keptConcepts.length;
  lines.push('## Per-concept decomposition');
  lines.push('');
  if (droppedCount > 0) {
    lines.push(`_(${droppedCount} concepts hidden for having fewer than ${minRows} row contributions)_`);
    lines.push('');
  }
  lines.push('| Concept | Base density | Recog density | d (recog−base) | r (density × score) |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const c of keptConcepts) {
    lines.push(
      `| ${c.concept} | ${fmtNum(c.baseMeanDensity)} | ${fmtNum(c.recogMeanDensity)} | ${fmtNum(c.dCondition, 3)} | ${fmtNum(c.rWithScore, 3)} |`,
    );
  }
  lines.push('');
  lines.push('## How to read');
  lines.push('');
  lines.push('A **large d** with a **meaningfully-positive r** is the cleanest signal that a concept is BOTH distinctive of the recognition prompt AND associated with higher scores — a candidate mechanism for the recognition effect.');
  lines.push('');
  lines.push('A **large d** with an r near zero means the prompt induces the vocabulary, but the vocabulary itself does not predict quality (stylistic effect, not mechanism).');
  lines.push('');
  lines.push('A **small d** with any r means the prompt is not shifting usage of that concept in output — the effect, if present, must flow through a different channel.');
  return lines.join('\n');
}

// ── Data loading ────────────────────────────────────────────────────────

function loadRows(db, runIds) {
  const whereRunId = runIds.length > 0 ? `AND run_id IN (${runIds.map(() => '?').join(',')})` : '';
  const sql = `
    SELECT run_id, profile_name, suggestions,
           COALESCE(tutor_first_turn_score, overall_score) AS primary_score
    FROM evaluation_results
    WHERE success = 1
      AND suggestions IS NOT NULL AND suggestions <> ''
      ${whereRunId}
  `;
  return db.prepare(sql).all(...runIds);
}

export function processRows(rawRows) {
  const rows = [];
  for (const r of rawRows) {
    const text = extractText(r.suggestions);
    if (!text) continue;
    const { wordCount: wc, totalCount, totalDensity, perConcept } = computeConceptDensities(text);
    if (wc < 20) continue; // skip trivially short outputs
    rows.push({
      profile: r.profile_name,
      condition: isRecog(r.profile_name) ? 'recog' : 'base',
      wordCount: wc,
      totalCount,
      totalDensity,
      perConcept,
      score: r.primary_score,
    });
  }
  return rows;
}

// ── CLI ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { runIds: [], json: false, output: null, minRows: 30 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--output') args.output = argv[++i];
    else if (a === '--min-rows') args.minRows = parseInt(argv[++i], 10);
    else if (!a.startsWith('--')) args.runIds.push(a);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = new Database(DB_PATH, { readonly: true });

  const raw = loadRows(db, args.runIds);
  console.log(`Loaded ${raw.length} candidate rows`);
  const rows = processRows(raw);
  console.log(`Kept ${rows.length} rows after text extraction / min-length filter`);

  const overall = summarizeOverall(rows);
  const byConcept = summarizeByConcept(rows);
  const report = buildReport({ runIds: args.runIds, overall, byConcept, rowCount: rows.length, minRows: args.minRows });

  const tag = args.runIds[0] || 'all-runs';
  const outPath = args.output || path.join(__dirname, '..', 'exports', `recognition-lexicon-${tag}.md`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, report, 'utf8');
  console.log(`Wrote report → ${outPath}`);

  if (args.json) {
    const jsonPath = outPath.replace(/\.md$/, '.json');
    fs.writeFileSync(jsonPath, JSON.stringify({ runIds: args.runIds, overall, byConcept, rowCount: rows.length }, null, 2));
    console.log(`Wrote JSON   → ${jsonPath}`);
  }
}

const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
