#!/usr/bin/env node
/**
 * analyze-d2-support-pilot.js — D2 Path 1 adjudication.
 *
 * Tests whether the recognition main effect transfers to a
 * coaching-a-peer-support-volunteer domain. The skill being coached runs
 * counter to traditional pedagogy (listener presence, sitting with distress,
 * declining to fix). Generation model (Haiku 4.5) and judge (Sonnet 4.6) are
 * matched to the A6 five-domain contrast (cells 1/5, single-prompt mode).
 *
 * Comparison contexts pulled in for reference:
 *   - A6 philosophy anchor (cells 80/84, messages mode, eval-2026-03-02-45163390)
 *   - A6 programming (cells 1/5, single-prompt mode, eval-2026-04-17-c92ad6c7)
 *   - A6 SEL (cells 1/5, single-prompt mode, closest-domain adjacency)
 *
 * Usage:
 *   node scripts/analyze-d2-support-pilot.js
 *   node scripts/analyze-d2-support-pilot.js --out exports/d2-support-pilot.md
 */

import Database from 'better-sqlite3';
import path from 'path';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'evaluations.db');

const args = process.argv.slice(2);
const getOption = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const outPath = getOption('out');

function mean(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }
function variance(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
}
function std(arr) { return Math.sqrt(variance(arr)); }
function cohensD(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const vA = variance(a), vB = variance(b), nA = a.length, nB = b.length;
  const pooled = Math.sqrt(((nA - 1) * vA + (nB - 1) * vB) / (nA + nB - 2));
  return pooled === 0 ? null : (mean(a) - mean(b)) / pooled;
}
function r(v, d = 2) { return v == null || !Number.isFinite(v) ? '—' : v.toFixed(d); }

function queryScores(db, runIds, profile, judge) {
  const ids = Array.isArray(runIds) ? runIds : [runIds];
  const placeholders = ids.map(() => '?').join(',');
  return db
    .prepare(
      `SELECT tutor_first_turn_score
       FROM evaluation_results
       WHERE run_id IN (${placeholders}) AND profile_name = ? AND judge_model = ?
         AND tutor_first_turn_score IS NOT NULL`,
    )
    .all(...ids, profile, judge)
    .map((row) => row.tutor_first_turn_score);
}

function summarize(label, base, recog, mode) {
  return {
    label,
    mode,
    nBase: base.length,
    nRecog: recog.length,
    meanBase: mean(base),
    meanRecog: mean(recog),
    sdBase: std(base),
    sdRecog: std(recog),
    delta: mean(recog) - mean(base),
    d: cohensD(recog, base),
  };
}

function magnitudeLabel(d) {
  if (d == null) return 'unavailable';
  if (d > 1.3) return 'very large';
  if (d > 0.8) return 'large';
  if (d > 0.5) return 'moderate';
  if (d > 0.2) return 'small';
  return 'negligible';
}

const JUDGE = 'claude-code/sonnet';

const D2 = {
  label: 'D2 Path 1: Peer support coaching (cells 1/5, single-prompt mode)',
  runIds: ['eval-2026-04-17-6766015b'],
  baseCell: 'cell_1_base_single_unified',
  recogCell: 'cell_5_recog_single_unified',
  mode: 'single-prompt',
};

const COMPARISONS = [
  {
    label: 'A6 SEL (cells 1/5, single-prompt mode)',
    runIds: ['eval-2026-04-17-44fa989c', 'eval-2026-04-17-5833830a'],
    baseCell: 'cell_1_base_single_unified',
    recogCell: 'cell_5_recog_single_unified',
    mode: 'single-prompt',
  },
  {
    label: 'A6 Programming (cells 1/5, single-prompt mode)',
    runIds: ['eval-2026-04-17-c92ad6c7'],
    baseCell: 'cell_1_base_single_unified',
    recogCell: 'cell_5_recog_single_unified',
    mode: 'single-prompt',
  },
  {
    label: 'A6 Philosophy anchor (cells 80/84, messages mode)',
    runIds: ['eval-2026-03-02-45163390'],
    baseCell: 'cell_80_messages_base_single_unified',
    recogCell: 'cell_84_messages_recog_single_unified',
    mode: 'messages',
  },
];

function main() {
  const db = new Database(DB_PATH, { readonly: true });

  const d2Base = queryScores(db, D2.runIds, D2.baseCell, JUDGE);
  const d2Recog = queryScores(db, D2.runIds, D2.recogCell, JUDGE);
  const d2 = summarize(D2.label, d2Base, d2Recog, D2.mode);

  const refs = COMPARISONS.map((c) => {
    const base = queryScores(db, c.runIds, c.baseCell, JUDGE);
    const recog = queryScores(db, c.runIds, c.recogCell, JUDGE);
    return summarize(c.label, base, recog, c.mode);
  });

  db.close();

  const lines = [];
  lines.push('# D2 Path 1 — Peer Support Coaching: Cross-Application Adjacency Pilot');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('Tests whether the recognition main effect transfers to a domain where the skill being coached is itself de-pedagogical (listener presence, sitting with distress, declining to fix). Haiku 4.5 generation × Sonnet 4.6 judge, matched to the A6 single-prompt-mode contrasts.');
  lines.push('');
  lines.push('## Primary result');
  lines.push('');
  lines.push('| Contrast | N base | N recog | Mean base (SD) | Mean recog (SD) | Δ | d (recog − base) |');
  lines.push('|----------|--------|---------|----------------|-----------------|---|------------------|');
  lines.push(
    `| ${d2.label} | ${d2.nBase} | ${d2.nRecog} | ${r(d2.meanBase)} (${r(d2.sdBase)}) | ${r(d2.meanRecog)} (${r(d2.sdRecog)}) | ${r(d2.delta)} | **${r(d2.d, 2)}** |`,
  );
  lines.push('');
  lines.push(`Magnitude: ${magnitudeLabel(d2.d)} under Cohen's conventions.`);
  lines.push('');

  lines.push('## Comparison against A6 domains');
  lines.push('');
  lines.push('| Contrast | N base | N recog | Mean base (SD) | Mean recog (SD) | Δ | d (recog − base) |');
  lines.push('|----------|--------|---------|----------------|-----------------|---|------------------|');
  lines.push(
    `| ${d2.label} | ${d2.nBase} | ${d2.nRecog} | ${r(d2.meanBase)} (${r(d2.sdBase)}) | ${r(d2.meanRecog)} (${r(d2.sdRecog)}) | ${r(d2.delta)} | **${r(d2.d, 2)}** |`,
  );
  for (const c of refs) {
    lines.push(
      `| ${c.label} | ${c.nBase} | ${c.nRecog} | ${r(c.meanBase)} (${r(c.sdBase)}) | ${r(c.meanRecog)} (${r(c.sdRecog)}) | ${r(c.delta)} | ${r(c.d, 2)} |`,
    );
  }
  lines.push('');

  const selRef = refs.find((c) => c.label.includes('SEL'));
  if (selRef && selRef.d != null && d2.d != null) {
    const deltaVsSel = d2.d - selRef.d;
    lines.push(`Δd vs closest A6 domain (SEL): ${r(deltaVsSel, 2)}.`);
    lines.push('');
  }

  lines.push('## Interpretation');
  lines.push('');
  if (d2.d != null && d2.d > 0.5) {
    lines.push(`Recognition produces a ${magnitudeLabel(d2.d)} positive effect (d = ${r(d2.d, 2)}) on tutor-side quality when the domain being coached is peer support listening rather than traditional knowledge transfer. The directional claim — that recognition-enhanced tutoring helps the tutor coach even a de-pedagogical skill — replicates. This is an *adjacency* test, not a full cross-application test (the tutor prompt still frames the LLM as a tutor); the stronger claim requires role-reframed prompts, deferred to D2 Path 2.`);
    lines.push('');
  } else if (d2.d != null && d2.d > 0) {
    lines.push(`Recognition produces a small positive effect (d = ${r(d2.d, 2)}) in direction but not at the "very large" class seen in A6's five domains (d = 1.45–2.71). This suggests the recognition benefit may attenuate when the domain being coached runs counter to traditional pedagogy. Interpretation is limited by the single-application scope of this pilot.`);
    lines.push('');
  } else {
    lines.push(`Recognition does NOT produce a positive effect on peer-support coaching (d = ${r(d2.d, 2)}). This would suggest the recognition mechanism is pedagogy-bound rather than application-general, and would require scoping the §6.1–6.2 mechanism language accordingly.`);
    lines.push('');
  }

  lines.push('## Confounds and caveats');
  lines.push('');
  lines.push('- **Structurally still tutoring**: the LLM is prompted as a tutor coaching a trainee, not as a peer support listener directly. A true cross-application test requires role-reframed prompts (D2 Path 2, deferred).');
  lines.push('- **Single application**: one application does not support a cross-application generalization claim. The pilot shows whether recognition *can* help in at least one non-philosophical-tutoring-like domain, not whether it helps across applications broadly.');
  lines.push('- **Same generation and judge as A6**: Haiku 4.5 generation, Sonnet 4.6 judge, held constant. Cross-judge validation on D2 was not run for this pilot (Sonnet-only).');
  lines.push('- **Scenario counts match A6**: 4 core + 1 mood = 5 scenarios × 3 runs = n=15 per cell, matching the A6 per-domain sample size.');
  lines.push('');

  const report = lines.join('\n');
  if (outPath) {
    writeFileSync(outPath, report);
    console.error(`Wrote ${report.split('\n').length} lines to ${outPath}`);
  } else {
    process.stdout.write(report + '\n');
  }
}

main();
