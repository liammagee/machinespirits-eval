#!/usr/bin/env node
/**
 * A7 Phase 2 — H3 analysis (memory use).
 *
 * Pre-registration:
 *   "Token-overlap between session N's `conscious_state.permanentTraces`
 *    and the tutor's final message in session N grows monotonically
 *    across N ∈ [2, 8] for recognition arcs, but not (or less reliably)
 *    for base arcs. Spearman ρ > 0.5 on recog; ρ ≤ 0.3 on base."
 *
 * (Pre-reg said `conscious_state.permanentTraces`; the actual field is
 *  `unconscious_state.permanentTraces`. Pre-reg typo, no measurement
 *  implication.)
 *
 * Method:
 *   For each arc (10 total), for each session N in created_at order:
 *     - Take all `recognition_moments` for the arc's pad with
 *       `created_at < min(eval_results.created_at) for session N`.
 *     - Concatenate their text content (synthesis_resolution, plus
 *       thesis/antithesis positions as fallback).
 *     - Get the session-N tutor's message text from
 *       `evaluation_results.suggestions` (last suggestion in the JSON
 *       array for multi-turn).
 *     - Compute Jaccard overlap on lowercased token sets (alphanumeric,
 *       common stopwords removed).
 *   Per arc, Spearman rank correlation between session-index N (2-8) and
 *   the overlap. Compare base vs recog.
 *
 * Caveat: 3 arcs have out-of-sequence resumed sessions
 *   (base-02 sess 5; recog-01 sess 7+8; recog-05 sess 7+8). The
 *   created_at ordering reflects what the tutor actually saw in the pad
 *   at run time; the canonical-index sensitivity check is reported
 *   separately.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const tsIdx = args.indexOf('--timestamp');
const TIMESTAMP = tsIdx !== -1 ? args[tsIdx + 1] : '1777173286';

const evalDb = new Database(path.join(REPO_ROOT, 'data', 'evaluations.db'), { readonly: true });
const tutorDb = new Database(
  path.join(REPO_ROOT, 'node_modules', '@machinespirits', 'tutor-core', 'data', 'lms.sqlite'),
  { readonly: true },
);

// ─── Tokenisation ────────────────────────────────────────────────────────
const STOPWORDS = new Set(`
  a an and are as at be been being but by can could did do does doing for from
  had has have having he her here him his how i if in into is it its itself
  just like me more most my no nor not now of off on once only or our out over
  same she should so some such than that the their them then there these they
  this those through to too under until up very was we were what when where
  which while who whom why will with you your yours yourself
`.split(/\s+/).filter(Boolean));

function tokenise(text) {
  if (!text) return new Set();
  const tokens = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return new Set(tokens);
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return inter / union;
}

// ─── Spearman rank correlation ───────────────────────────────────────────
function rank(arr) {
  const sorted = arr
    .map((v, i) => ({ v, i }))
    .sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].v === sorted[i].v) j += 1;
    const r = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) ranks[sorted[k].i] = r;
    i = j + 1;
  }
  return ranks;
}

function spearman(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const rx = rank(xs);
  const ry = rank(ys);
  const meanX = rx.reduce((s, x) => s + x, 0) / n;
  const meanY = ry.reduce((s, y) => s + y, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i] - meanX) * (ry[i] - meanY);
    dx += (rx[i] - meanX) ** 2;
    dy += (ry[i] - meanY) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

// ─── Per-arc analysis ────────────────────────────────────────────────────
const arcs = evalDb
  .prepare(
    `SELECT DISTINCT learner_id FROM evaluation_results
       WHERE learner_id LIKE ? ORDER BY learner_id`,
  )
  .all(`%-${TIMESTAMP}`)
  .map((r) => r.learner_id);

console.log(`Found ${arcs.length} arcs for timestamp ${TIMESTAMP}.\n`);

const CANONICAL = [
  'new_user_first_visit',
  'returning_user_mid_course',
  'concept_confusion',
  'misconception_correction_flow',
  'epistemic_resistance_impasse',
  'mood_frustration_to_breakthrough',
  'mutual_transformation_journey',
  'productive_deadlock_impasse',
];

const arcRows = {};
for (const arc of arcs) {
  arcRows[arc] = evalDb
    .prepare(
      `SELECT scenario_id, suggestions, created_at
         FROM evaluation_results
         WHERE learner_id = ?
         ORDER BY created_at`,
    )
    .all(arc);
}

const padIdRow = (arc) =>
  tutorDb.prepare(`SELECT id FROM writing_pads WHERE learner_id = ?`).get(arc);

const arcMoments = {};
for (const arc of arcs) {
  const pad = padIdRow(arc);
  arcMoments[arc] = pad
    ? tutorDb
        .prepare(
          `SELECT created_at, synthesis_resolution, thesis_position, antithesis_position
             FROM recognition_moments
             WHERE writing_pad_id = ?
             ORDER BY created_at`,
        )
        .all(pad.id)
    : [];
}

function lastTutorMessage(suggestionsJson) {
  try {
    const arr = JSON.parse(suggestionsJson);
    if (!Array.isArray(arr) || arr.length === 0) return '';
    const last = arr[arr.length - 1];
    if (typeof last === 'string') return last;
    if (last && typeof last === 'object') {
      return [last.suggestion, last.message, last.text, last.content]
        .filter(Boolean)
        .join(' ');
    }
    return String(last);
  } catch {
    return suggestionsJson || '';
  }
}

// Token-overlap series per arc
const series = {};
for (const arc of arcs) {
  const sessions = arcRows[arc];
  const moments = arcMoments[arc];
  const out = [];
  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    if (i === 0) continue; // pre-reg specifies N ∈ [2, 8]; session 1 has no prior pad state
    // Cumulative moments with created_at < session.created_at
    const accumulated = moments
      .filter((m) => m.created_at < session.created_at)
      .map((m) => [m.synthesis_resolution, m.thesis_position, m.antithesis_position].filter(Boolean).join(' '))
      .join(' ');
    const tutorMsg = lastTutorMessage(session.suggestions);
    const padTokens = tokenise(accumulated);
    const msgTokens = tokenise(tutorMsg);
    const overlap = jaccard(padTokens, msgTokens);
    out.push({
      seqIdx: i + 1, // 1-based session index in created_at order (2..8 since we skip i=0)
      canonicalIdx: CANONICAL.indexOf(session.scenario_id) + 1,
      scenario: session.scenario_id,
      padTokens: padTokens.size,
      msgTokens: msgTokens.size,
      overlap,
    });
  }
  series[arc] = out;
}

// ─── Reporting ───────────────────────────────────────────────────────────
console.log('=== Per-arc Spearman ρ (session-order in created_at, sessions 2..8) ===');
console.log('arc                      ρ      overlap series (sess 2..8)');
const rhoByArc = {};
for (const arc of arcs) {
  const xs = series[arc].map((s) => s.seqIdx);
  const ys = series[arc].map((s) => s.overlap);
  const rho = spearman(xs, ys);
  rhoByArc[arc] = rho;
  const cond = arc.includes('recog') ? 'recog' : 'base';
  const tag = arc.replace('a7-phase2-', '').replace(`-${TIMESTAMP}`, '');
  const fmtSeries = ys.map((v) => v.toFixed(3)).join(' ');
  console.log(`  ${cond.padEnd(6)}${tag.padEnd(16)}${(rho ?? 0).toFixed(3).padStart(7)}   ${fmtSeries}`);
}

const baseRhos = arcs.filter((a) => !a.includes('recog')).map((a) => rhoByArc[a]).filter((r) => r !== null);
const recogRhos = arcs.filter((a) => a.includes('recog')).map((a) => rhoByArc[a]).filter((r) => r !== null);
const meanArr = (a) => (a.length === 0 ? 0 : a.reduce((s, x) => s + x, 0) / a.length);
console.log('');
console.log('=== H3 verdict ===');
console.log('H3 predicted: recog Spearman ρ > 0.5; base ρ ≤ 0.3');
console.log(`Base  arc ρs: [${baseRhos.map((r) => r.toFixed(3)).join(', ')}]   mean = ${meanArr(baseRhos).toFixed(3)}`);
console.log(`Recog arc ρs: [${recogRhos.map((r) => r.toFixed(3)).join(', ')}]   mean = ${meanArr(recogRhos).toFixed(3)}`);

const baseOver = baseRhos.filter((r) => r > 0.5).length;
const recogOver = recogRhos.filter((r) => r > 0.5).length;
const baseUnder = baseRhos.filter((r) => r <= 0.3).length;
const recogUnder = recogRhos.filter((r) => r <= 0.3).length;
console.log(`Recog arcs with ρ > 0.5: ${recogOver}/${recogRhos.length}`);
console.log(`Base  arcs with ρ ≤ 0.3: ${baseUnder}/${baseRhos.length}`);

// Also report mean overlap by condition (descriptive, not pre-registered)
const baseAllOverlap = arcs.filter((a) => !a.includes('recog')).flatMap((a) => series[a].map((s) => s.overlap));
const recogAllOverlap = arcs.filter((a) => a.includes('recog')).flatMap((a) => series[a].map((s) => s.overlap));
console.log('');
console.log('=== Descriptive: mean overlap by condition ===');
console.log(`Base  mean overlap: ${meanArr(baseAllOverlap).toFixed(3)} (n=${baseAllOverlap.length})`);
console.log(`Recog mean overlap: ${meanArr(recogAllOverlap).toFixed(3)} (n=${recogAllOverlap.length})`);

// Welch t on the per-arc rhos
function tStat(a, b) {
  const ma = meanArr(a), mb = meanArr(b);
  const sa = Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0) / (a.length - 1));
  const sb = Math.sqrt(b.reduce((s, x) => s + (x - mb) ** 2, 0) / (b.length - 1));
  const t = (mb - ma) / Math.sqrt(sa * sa / a.length + sb * sb / b.length);
  return { t, sa, sb, ma, mb };
}
const ts = tStat(baseRhos, recogRhos);
console.log('');
console.log(`Welch t on per-arc ρ (recog − base): ${ts.t.toFixed(3)}   (Base SD ${ts.sa.toFixed(3)}, Recog SD ${ts.sb.toFixed(3)})`);

evalDb.close();
tutorDb.close();
