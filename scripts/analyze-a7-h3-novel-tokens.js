#!/usr/bin/env node
/**
 * A7 Phase 2 — H3 refinement: novel-token analysis.
 *
 * The original H3 measurement (analyze-a7-h3-overlap.js) used Jaccard
 * overlap between the cumulative pad-trace text and the session-N
 * tutor message. That metric conflates two distinct phenomena:
 *
 *   (a) "tutor draws on pad" — tutor message reuses content that
 *       emerged through prior-session interaction (specific learner
 *       phrasings, named breakthroughs, struggle markers).
 *   (b) "tutor stays on topic" — tutor message and pad both contain
 *       the lecture's core vocabulary (Hegel, master-slave, recognition,
 *       dialectic) regardless of whether the tutor consulted the pad.
 *
 * This refinement separates the two by computing **novel-token
 * recurrence**: the share of session-N tutor message tokens that are
 * (i) present in the pad's cumulative trace text AND (ii) ABSENT from
 * the arc's session-1 baseline. Session 1 is the tutor's first message
 * in the arc — its vocabulary represents what the tutor would say
 * absent any cross-session memory. Tokens that only appear in pad
 * traces from later sessions and then re-surface in the tutor message
 * are the "draws on pad" signal.
 *
 * Method:
 *   1. For each arc, tokenise the tutor's session-1 message → BASELINE.
 *   2. For each session N ≥ 2, take the cumulative `recognition_moments`
 *      text from rows with `created_at < session N` → PAD_N.
 *   3. NOVEL_PAD_N = PAD_N \ BASELINE (set difference).
 *   4. Tokenise the tutor's session-N message → MSG_N.
 *   5. recurrence_N = |MSG_N ∩ NOVEL_PAD_N| / |MSG_N|
 *      (fraction of session-N message tokens that come from pad-novel
 *      vocabulary, normalised by message length).
 *   6. Per-arc Spearman ρ between session index N (2..8) and recurrence_N.
 *      Compare base vs recog mean ρ and mean recurrence.
 *
 * Same tokenisation rules as the original H3 (lowercase alphanumeric,
 * length ≥ 3, common stopwords removed).
 *
 * Usage: node scripts/analyze-a7-h3-novel-tokens.js --timestamp 1777173286
 */

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

function lastTutorMessage(suggestionsJson) {
  try {
    const arr = JSON.parse(suggestionsJson);
    if (!Array.isArray(arr) || arr.length === 0) return '';
    const last = arr[arr.length - 1];
    if (typeof last === 'string') return last;
    if (last && typeof last === 'object') {
      return [last.suggestion, last.message, last.text, last.content].filter(Boolean).join(' ');
    }
    return String(last);
  } catch {
    return suggestionsJson || '';
  }
}

function rank(arr) {
  const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
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

const arcs = evalDb
  .prepare(
    `SELECT DISTINCT learner_id FROM evaluation_results
       WHERE learner_id LIKE ? ORDER BY learner_id`,
  )
  .all(`%-${TIMESTAMP}`)
  .map((r) => r.learner_id);

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

const arcMoments = {};
for (const arc of arcs) {
  const padRow = tutorDb.prepare(`SELECT id FROM writing_pads WHERE learner_id = ?`).get(arc);
  arcMoments[arc] = padRow
    ? tutorDb
        .prepare(
          `SELECT created_at, synthesis_resolution, thesis_position, antithesis_position
             FROM recognition_moments
             WHERE writing_pad_id = ?
             ORDER BY created_at`,
        )
        .all(padRow.id)
    : [];
}

const series = {};
for (const arc of arcs) {
  const sessions = arcRows[arc];
  const moments = arcMoments[arc];
  if (sessions.length === 0) continue;

  // BASELINE = session 1 tutor message tokens
  const baseline = tokenise(lastTutorMessage(sessions[0].suggestions));

  const out = [];
  for (let i = 1; i < sessions.length; i++) {
    const session = sessions[i];
    const accumulatedText = moments
      .filter((m) => m.created_at < session.created_at)
      .map((m) => [m.synthesis_resolution, m.thesis_position, m.antithesis_position].filter(Boolean).join(' '))
      .join(' ');
    const padTokens = tokenise(accumulatedText);
    // NOVEL = pad tokens not present in baseline
    const novelPad = new Set([...padTokens].filter((t) => !baseline.has(t)));
    const msgTokens = tokenise(lastTutorMessage(session.suggestions));
    if (msgTokens.size === 0 || novelPad.size === 0) {
      out.push({ seqIdx: i + 1, recurrence: 0, msgN: msgTokens.size, novelN: novelPad.size, hits: 0 });
      continue;
    }
    let hits = 0;
    for (const t of msgTokens) if (novelPad.has(t)) hits += 1;
    out.push({
      seqIdx: i + 1,
      recurrence: hits / msgTokens.size,
      msgN: msgTokens.size,
      novelN: novelPad.size,
      hits,
    });
  }
  series[arc] = out;
}

console.log(`=== H3 refinement (novel-token recurrence) — timestamp ${TIMESTAMP} ===`);
console.log('');
console.log('arc                      ρ      recurrence series (sess 2..8)');

const rhoByArc = {};
for (const arc of arcs) {
  const xs = series[arc].map((s) => s.seqIdx);
  const ys = series[arc].map((s) => s.recurrence);
  const rho = spearman(xs, ys);
  rhoByArc[arc] = rho;
  const cond = arc.includes('recog') ? 'recog' : 'base';
  const tag = arc.replace('a7-phase2-', '').replace(`-${TIMESTAMP}`, '');
  const fmt = ys.map((v) => v.toFixed(3)).join(' ');
  console.log(`  ${cond.padEnd(6)}${tag.padEnd(16)}${(rho ?? 0).toFixed(3).padStart(7)}   ${fmt}`);
}

const baseRhos = arcs.filter((a) => !a.includes('recog')).map((a) => rhoByArc[a]).filter((r) => r !== null);
const recogRhos = arcs.filter((a) => a.includes('recog')).map((a) => rhoByArc[a]).filter((r) => r !== null);
const meanArr = (a) => (a.length === 0 ? 0 : a.reduce((s, x) => s + x, 0) / a.length);
const sdArr = (a, m = meanArr(a)) => Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));

console.log('');
console.log('=== Verdict ===');
console.log(`Base  arc ρs: [${baseRhos.map((r) => r.toFixed(3)).join(', ')}]   mean = ${meanArr(baseRhos).toFixed(3)}`);
console.log(`Recog arc ρs: [${recogRhos.map((r) => r.toFixed(3)).join(', ')}]   mean = ${meanArr(recogRhos).toFixed(3)}`);

// Mean recurrence by condition
const baseAll = arcs.filter((a) => !a.includes('recog')).flatMap((a) => series[a].map((s) => s.recurrence));
const recogAll = arcs.filter((a) => a.includes('recog')).flatMap((a) => series[a].map((s) => s.recurrence));
console.log('');
console.log(`Base  mean recurrence: ${meanArr(baseAll).toFixed(4)} (n=${baseAll.length} session-indexed observations)`);
console.log(`Recog mean recurrence: ${meanArr(recogAll).toFixed(4)} (n=${recogAll.length})`);
const liftPct = ((meanArr(recogAll) - meanArr(baseAll)) / meanArr(baseAll)) * 100;
console.log(`Lift: ${(meanArr(recogAll) - meanArr(baseAll)).toFixed(4)} (${liftPct.toFixed(1)}% in recog favour)`);

// Welch t on per-arc rhos
const sb = sdArr(baseRhos);
const sr = sdArr(recogRhos);
const t = (meanArr(recogRhos) - meanArr(baseRhos))
  / Math.sqrt(sb * sb / baseRhos.length + sr * sr / recogRhos.length);
console.log(`Welch t on per-arc ρ (recog − base): ${t.toFixed(3)}`);

// Welch t on per-observation recurrence (richer test)
const mb = meanArr(baseAll), mr = meanArr(recogAll);
const sbAll = sdArr(baseAll, mb), srAll = sdArr(recogAll, mr);
const tObs = (mr - mb) / Math.sqrt(sbAll * sbAll / baseAll.length + srAll * srAll / recogAll.length);
const numObs = (sbAll * sbAll / baseAll.length + srAll * srAll / recogAll.length) ** 2;
const denObs = (sbAll * sbAll / baseAll.length) ** 2 / (baseAll.length - 1)
  + (srAll * srAll / recogAll.length) ** 2 / (recogAll.length - 1);
const dfObs = numObs / denObs;

// p-value: for large df (> 30) the t-distribution is well-approximated by
// a standard normal. We skip the small-df incomplete-beta path (which has
// numerical-stability issues near a/(a+b)) and use the normal asymptotic
// directly for the per-observation test where df is always large.
function normCdf(z) {
  // Abramowitz-Stegun 7.1.26 approximation, |error| < 7.5e-8
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}
const pObs = 2 * (1 - normCdf(Math.abs(tObs)));
console.log(`Welch t on per-observation recurrence: t = ${tObs.toFixed(3)}, df = ${dfObs.toFixed(2)}, p ≈ ${pObs.toFixed(3)} (normal approx, df = ${dfObs.toFixed(0)} so t ≈ z)`);

evalDb.close();
tutorDb.close();
