#!/usr/bin/env node
/**
 * analyze-timing-pair.js — segment the step-3 panel results.
 *
 * The 2x2 pools all bases, but the coherence of the decoupling differs by pivot type:
 *  - ACTION-ONLY pivots (the arrow bases) displace cleanly (no verbal anaphora) — the clean test;
 *  - SPEECH pivots that name the obstruction ("That objection...", element-tile) break anaphora
 *    when relocated in EITHER direction — coherence-caveated.
 * So we segment by domain, gate on the measured globalCoherence, and check the timing contrast
 * per critic family (does it survive the Sonnet vs GPT/codex swap?).
 *
 *   node scripts/analyze-timing-pair.js [stamp]
 */
import fs from 'node:fs';
import path from 'node:path';

const stamp = process.argv[2] || '20260605real';
const root = `exports/timing-pair-panel-${stamp}`;
const agg = JSON.parse(fs.readFileSync(path.join(root, 'aggregate.json'), 'utf8'));
const tidMap = agg.tidMap;
const scoreDir = path.join(root, 'panel', 'scores');

const rows = [];
for (const f of fs.readdirSync(scoreDir).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(scoreDir, f), 'utf8'));
  const critic = j.critic || f.replace(/^replay-r01-|\.json$/g, '');
  for (const r of j.scored || []) {
    const m = tidMap[r.id];
    if (!m) continue;
    const cls = (r.recognitionOrigin || {}).class || null;
    rows.push({
      critic,
      tid: r.id,
      ...m,
      origin: cls,
      induced: cls === 'peripeteia_induced' ? 1 : 0,
      coherence: r.globalCoherence,
    });
  }
}

const ARMS = ['bridged', 'displacedPivotal', 'decoyBridged', 'displacedNeutral'];
const LAB = {
  bridged: 'A pivotal/adjacent ',
  displacedPivotal: 'B pivotal/decoupled',
  decoyBridged: 'C neutral/adjacent ',
  displacedNeutral: 'D neutral/decoupled',
};
const fmt = (x) => (x == null ? ' -- ' : x.toFixed(2));
const cell = (filter, arm) => {
  const rs = rows.filter((r) => r.arm === arm && filter(r));
  const ind = rs.reduce((s, r) => s + r.induced, 0);
  const coh = rs.reduce((s, r) => s + (Number.isFinite(r.coherence) ? r.coherence : 0), 0);
  const cohN = rs.filter((r) => Number.isFinite(r.coherence)).length;
  return { rate: rs.length ? ind / rs.length : null, n: rs.length, coh: cohN ? coh / cohN : null };
};
const sub = (x, y) => (x == null || y == null ? null : x - y);

function table(label, filter) {
  console.log(`\n### ${label}`);
  for (const a of ARMS) {
    const c = cell(filter, a);
    console.log(
      `  ${LAB[a]}  induced ${fmt(c.rate)} (n=${String(c.n).padStart(2)})   coherence ${c.coh == null ? '--' : c.coh.toFixed(0)}`,
    );
  }
  const A = cell(filter, 'bridged').rate;
  const B = cell(filter, 'displacedPivotal').rate;
  const C = cell(filter, 'decoyBridged').rate;
  const D = cell(filter, 'displacedNeutral').rate;
  const inter = [A, B, C, D].every((x) => x != null) ? A - B - (C - D) : null;
  console.log(
    `  TIMING A-B (clean core): ${fmt(sub(A, B))} | MOVE-TYPE A-C: ${fmt(sub(A, C))} | interaction: ${fmt(inter)}`,
  );
}

const isArrow = (r) => r.domain === 'arrow-direction';
console.log(`timing-pair analysis — ${stamp}`);
console.log(`critics: ${[...new Set(rows.map((r) => r.critic))].join(', ')}`);
console.log(`rows: ${rows.length} (${rows.length / 4 || 0} per arm expected = bases x critics)`);

table('ALL 6 bases (pooled)', () => true);
table('CLEAN — arrow bases (action-only pivot, displacement coherent)', isArrow);
table('CAVEATED — element-tile+music (speech pivot, anaphora broken both ways)', (r) => !isArrow(r));

console.log('\n### per-critic family — A-B timing contrast on the clean arrow subset (must survive the critic swap)');
for (const c of [...new Set(rows.map((r) => r.critic))]) {
  const f = (r) => isArrow(r) && r.critic === c;
  const A = cell(f, 'bridged').rate;
  const B = cell(f, 'displacedPivotal').rate;
  console.log(`  ${c.padEnd(30)} A=${fmt(A)} B=${fmt(B)}  A-B=${fmt(sub(A, B))}`);
}

console.log('\n### coherence gate — mean globalCoherence per arm (decoupled << bridged = the confound)');
for (const a of ARMS)
  console.log(
    `  ${LAB[a]}  all=${cell(() => true, a).coh?.toFixed(0) ?? '--'}  arrow=${cell(isArrow, a).coh?.toFixed(0) ?? '--'}  speech=${cell((r) => !isArrow(r), a).coh?.toFixed(0) ?? '--'}`,
  );

console.log('\nreadings: interaction>0 & A high = critic tracks the genuine bridge (instrument valid);');
console.log('  A&C both high (timing main effect, move-type flat) = post-hoc gullibility (D6);');
console.log(
  '  A&B both high (timing flat) = timing is not a lever. Trust the CLEAN/arrow subset where coherence holds.',
);
