#!/usr/bin/env node
/**
 * Inter-critic agreement for the Phase-1 poetics scorer.
 *
 * Reads N exports/poetics-phase1-<critic>.json artifacts (produced by
 * score-poetics-phase1.js) and reports, pairwise, how much the critics agree on
 * the primary axis (recontextualization) and the corroborating axes:
 *   - exact raw-score match (1-5) and mean |Δ| on the 0-100 mapping
 *   - Spearman rank correlation across all items — flagged as INFLATED by the
 *     bimodal pole separation (high band vs zero band)
 *   - within-high-band rank agreement (the discriminating test)
 *   - quadratic-weighted Cohen's kappa on the 1-5 raw scores
 *   - §76 quadrant concordance, gate-decision concordance, reversal localization
 *
 * Pure computation — no API calls.
 *
 * Usage:
 *   node scripts/compare-poetics-critics.js [file1.json file2.json ...]
 *   (defaults to all exports/poetics-phase1-*.json)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const EXPORTS_DIR = path.join(ROOT, 'exports');

// ── stats helpers ───────────────────────────────────────────────────────────

function mean(a) {
  return a.reduce((s, x) => s + x, 0) / a.length;
}

function pearson(x, y) {
  const n = x.length;
  const mx = mean(x);
  const my = mean(y);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? NaN : num / den;
}

// average-rank (handles ties)
function rankify(arr) {
  const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const ranks = new Array(arr.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1; // 1-based average rank
    for (let k = i; k <= j; k++) ranks[idx[k][1]] = avg;
    i = j + 1;
  }
  return ranks;
}

function spearman(x, y) {
  return pearson(rankify(x), rankify(y));
}

// unweighted Cohen's kappa on integer categories [lo..hi] (nominal agreement —
// every disagreement counts equally; no ordering assumption)
function cohenKappa(a, b, lo = 1, hi = 5) {
  const k = hi - lo + 1;
  const n = a.length;
  if (!n) return NaN;
  const O = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < n; i++) O[a[i] - lo][b[i] - lo]++;
  const rowSum = O.map((r) => r.reduce((s, v) => s + v, 0));
  const colSum = new Array(k).fill(0);
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) colSum[j] += O[i][j];
  let po = 0;
  let pe = 0;
  for (let i = 0; i < k; i++) {
    po += O[i][i] / n;
    pe += (rowSum[i] / n) * (colSum[i] / n);
  }
  return pe === 1 ? NaN : (po - pe) / (1 - pe);
}

// quadratic-weighted Cohen's kappa on integer categories [lo..hi]
function quadraticWeightedKappa(a, b, lo = 1, hi = 5) {
  const k = hi - lo + 1;
  const n = a.length;
  const O = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < n; i++) O[a[i] - lo][b[i] - lo]++;
  const rowSum = O.map((r) => r.reduce((s, v) => s + v, 0));
  const colSum = new Array(k).fill(0);
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) colSum[j] += O[i][j];
  let num = 0;
  let den = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const w = (i - j) ** 2 / (k - 1) ** 2;
      const E = (rowSum[i] * colSum[j]) / n;
      num += w * O[i][j];
      den += w * E;
    }
  }
  return den === 0 ? NaN : 1 - num / den;
}

function fmt(x, d = 2) {
  return Number.isFinite(x) ? x.toFixed(d) : 'n/a';
}

// ── load + index a critic artifact ──────────────────────────────────────────

function loadCritic(file) {
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  const byId = {};
  for (const r of d.scored) {
    byId[r.id] = {
      reconRaw: r.rawScores.recon,
      recon100: r.recontextualization,
      ruptRaw: r.rawScores.rupture,
      rupt100: r.rupture,
      cohRaw: r.rawScores.coherence,
      coh100: r.globalCoherence,
      rev: r.reversalTurn,
    };
  }
  for (const q of d.quadrant || []) {
    if (byId[q.id]) {
      byId[q.id].pole = q.pole;
      byId[q.id].cell = q.cell;
    }
  }
  for (const l of d.localization || []) {
    if (byId[l.id]) {
      byId[l.id].truth = l.truth;
      byId[l.id].predicted = l.predicted;
    }
  }
  const g = d.gate || {};
  const gatePass = g.gatePass ?? g.pass ?? g.passed ?? null;
  return { name: d.critic || path.basename(file), byId, gatePass };
}

// ── pairwise agreement on one axis ──────────────────────────────────────────

function axisAgreement(A, B, ids, rawKey, hundredKey) {
  const araw = ids.map((id) => A.byId[id][rawKey]);
  const braw = ids.map((id) => B.byId[id][rawKey]);
  const a100 = ids.map((id) => A.byId[id][hundredKey]);
  const b100 = ids.map((id) => B.byId[id][hundredKey]);
  const exact = ids.filter((id) => A.byId[id][rawKey] === B.byId[id][rawKey]).length;
  const meanAbs = mean(ids.map((_, i) => Math.abs(a100[i] - b100[i])));
  return {
    exact,
    n: ids.length,
    meanAbs,
    spearman: spearman(a100, b100),
    kappa: quadraticWeightedKappa(araw, braw),
  };
}

// ── report ──────────────────────────────────────────────────────────────────

function report(critics) {
  const ids = Object.keys(critics[0].byId).sort();
  const poleOf = (id) => critics[0].byId[id].pole;
  const highIds = ids.filter((id) => poleOf(id) === 'high');

  console.log('\n══ Inter-critic agreement — Phase 1 (recontextualization = primary axis) ══\n');
  console.log(`critics: ${critics.map((c) => c.name).join(', ')}   (n=${ids.length} items)\n`);

  // per-item recon table
  console.log('── Per-item recontextualization (raw 1-5 / 0-100) ──');
  console.log(`id   pole   ${critics.map((c) => c.name.padEnd(14)).join('')}`);
  for (const id of ids) {
    const cells = critics.map((c) => `${c.byId[id].reconRaw}/${c.byId[id].recon100}`.padEnd(14)).join('');
    console.log(`${id.padEnd(4)} ${(poleOf(id) || '?').padEnd(6)} ${cells}`);
  }

  // pairwise, all axes
  for (let i = 0; i < critics.length; i++) {
    for (let j = i + 1; j < critics.length; j++) {
      const A = critics[i];
      const B = critics[j];
      console.log(`\n── ${A.name} × ${B.name} ──`);

      const rec = axisAgreement(A, B, ids, 'reconRaw', 'recon100');
      console.log('  RECONTEXTUALIZATION (primary, gating axis):');
      console.log(`    exact raw match: ${rec.exact}/${rec.n}   mean |Δ100|: ${fmt(rec.meanAbs, 1)}`);
      console.log(`    Spearman ρ (all ${rec.n}): ${fmt(rec.spearman)}  [INFLATED by bimodal pole separation]`);
      console.log(`    quadratic-weighted κ: ${fmt(rec.kappa)}`);
      if (highIds.length >= 2) {
        const ha = highIds.map((id) => A.byId[id].recon100);
        const hb = highIds.map((id) => B.byId[id].recon100);
        console.log(
          `    within high-band rank agreement (${highIds.join(',')}): Spearman ρ = ${fmt(spearman(ha, hb))}  [discriminating test]`,
        );
      }

      const rup = axisAgreement(A, B, ids, 'ruptRaw', 'rupt100');
      console.log('  RUPTURE (corroborating):');
      console.log(
        `    exact raw match: ${rup.exact}/${rup.n}   mean |Δ100|: ${fmt(rup.meanAbs, 1)}   κ: ${fmt(rup.kappa)}`,
      );

      const coh = axisAgreement(A, B, ids, 'cohRaw', 'coh100');
      console.log('  COHERENCE (corroborating, expected high across poles):');
      console.log(
        `    exact raw match: ${coh.exact}/${coh.n}   mean |Δ100|: ${fmt(coh.meanAbs, 1)}   κ: ${fmt(coh.kappa)}`,
      );

      // quadrant concordance
      const sameQuad = ids.filter((id) => A.byId[id].cell === B.byId[id].cell).length;
      console.log(`  §76 quadrant concordance: ${sameQuad}/${ids.length} items in same cell`);

      // localization on high items
      const agree = highIds.filter((id) => A.byId[id].rev === B.byId[id].rev).length;
      console.log(`  reversal localization (high items): critics agree on ${agree}/${highIds.length}`);
      for (const id of highIds) {
        const t = critics[0].byId[id].truth;
        console.log(
          `    ${id}  truth=${t}  ${A.name}=${A.byId[id].rev}  ${B.name}=${B.byId[id].rev}  agree=${A.byId[id].rev === B.byId[id].rev}`,
        );
      }
    }
  }

  // gate decisions
  console.log('\n── Gate decision per critic ──');
  for (const c of critics)
    console.log(`  ${c.name}: ${c.gatePass === null ? 'unknown' : c.gatePass ? 'PASS' : 'FAIL'}`);
  const allPass = critics.every((c) => c.gatePass === true);
  console.log(`  concordant: ${allPass ? 'yes — all critics PASS' : 'no'}`);
  console.log('');
}

// ── main ─────────────────────────────────────────────────────────────────────

function main() {
  let files = process.argv.slice(2);
  if (files.length === 0) {
    files = fs
      .readdirSync(EXPORTS_DIR)
      .filter((f) => /^poetics-phase1-.*\.json$/.test(f))
      .map((f) => path.join(EXPORTS_DIR, f))
      .sort();
  }
  if (files.length < 2) {
    console.error(
      `Need >=2 critic artifacts; found ${files.length}. Run score-poetics-phase1.js with different --model first.`,
    );
    process.exit(1);
  }
  const critics = files.map(loadCritic);
  report(critics);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (invokedDirectly) main();

// Reusable stats — the Phase-2 transfer gate imports the same kappa math so the
// gate statistic has a single source of truth (no divergent re-implementation).
export { quadraticWeightedKappa, cohenKappa, spearman, pearson, rankify, mean };
