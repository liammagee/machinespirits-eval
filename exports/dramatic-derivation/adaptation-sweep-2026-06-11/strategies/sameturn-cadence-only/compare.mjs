// Per-cell comparison: sameturn-cadence-only vs s01-tutor-repair (and s00 floor).
import fs from 'node:fs';

const load = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const mine = load('/tmp/adaptation-sweep/results/sameturn-cadence-only.json');
const s01 = load('/tmp/adaptation-sweep/results/s01-tutor-repair.json');

const key = (r) => [r.world, r.rate, r.grace, r.maxC, r.start, r.seed].join('|');
const s01Map = new Map(s01.rows.map((r) => [key(r), r]));

const pct = (xs) => (xs.length ? +(xs.filter(Boolean).length / xs.length).toFixed(3) : null);

// --- maxC marginals (mine vs s01) ---
for (const m of [1, 2, 4]) {
  const a = mine.rows.filter((r) => r.maxC === m);
  const b = s01.rows.filter((r) => r.maxC === m);
  console.log(`maxC=${m}: mine=${pct(a.map((r) => r.success))}  s01=${pct(b.map((r) => r.success))}`);
}
// --- rate marginals for s01 (mine already in summary) ---
console.log('s01 byRate:', [0.15, 0.3, 0.5, 0.75, 1].map((rt) => `${rt}:${pct(s01.rows.filter((r) => r.rate === rt).map((r) => r.success))}`).join(' '));

// --- per-cell flips ---
let flipsUp = 0, flipsDown = 0, both = 0, neither = 0, missing = 0;
const flipDownCells = [];
for (const r of mine.rows) {
  const o = s01Map.get(key(r));
  if (!o) { missing++; continue; }
  if (r.success && o.success) both++;
  else if (r.success && !o.success) flipsUp++;
  else if (!r.success && o.success) { flipsDown++; flipDownCells.push(key(r) + ` mine:${r.verdict} s01:${o.verdict}`); }
  else neither++;
}
console.log(`\nper-cell vs s01 (n=${mine.rows.length}, matched=${mine.rows.length - missing}):`);
console.log(`  both succeed: ${both}   mine-only (flip up): ${flipsUp}   s01-only (flip down): ${flipsDown}   both fail: ${neither}`);
if (flipDownCells.length) console.log('  flip-down cells (first 20):\n   ' + flipDownCells.slice(0, 20).join('\n   '));

// --- maxC=1 detail (prediction: ~1.000) ---
const m1 = mine.rows.filter((r) => r.maxC === 1);
console.log(`\nmaxC=1: ${pct(m1.map((r) => r.success))} (${m1.filter((r) => r.success).length}/${m1.length})`);
const m1Fails = m1.filter((r) => !r.success);
for (const f of m1Fails.slice(0, 15)) console.log(`  FAIL ${key(f)} verdict=${f.verdict} decayEvents=${f.decayEvents} repairsTutor=${f.repairsTutor} unrepaired=${f.unrepaired}`);
if (m1Fails.length > 15) console.log(`  ... ${m1Fails.length - 15} more`);

// --- failure modes by maxC at rate>=0.75 (head-of-line starvation prediction) ---
console.log('\nfailure modes at rate>=0.75, by maxC (mine):');
for (const m of [1, 2, 4]) {
  const sub = mine.rows.filter((r) => r.rate >= 0.75 && r.maxC === m && !r.success);
  const modes = {};
  for (const r of sub) modes[r.verdict] = (modes[r.verdict] || 0) + 1;
  const n = mine.rows.filter((r) => r.rate >= 0.75 && r.maxC === m).length;
  console.log(`  maxC=${m}: sr=${pct(mine.rows.filter((r) => r.rate >= 0.75 && r.maxC === m).map((r) => r.success))} (n=${n}) fails=${JSON.stringify(modes)}`);
}

// --- per-world at rate>=0.75, maxC>=2 (worlds that release a mirror premise first vs smoke) ---
console.log('\nper-world success at rate>=0.75 & maxC>=2 (mine vs s01):');
for (const w of ['000-smoke', '001-nocturne', '002-lantern', '003-bitterwell', '004-withercombe']) {
  const a = mine.rows.filter((r) => r.world === w && r.rate >= 0.75 && r.maxC >= 2);
  const b = s01.rows.filter((r) => r.world === w && r.rate >= 0.75 && r.maxC >= 2);
  console.log(`  ${w}: mine=${pct(a.map((r) => r.success))}  s01=${pct(b.map((r) => r.success))} (n=${a.length})`);
}

// --- smoke maxC=4 corner ("window-4 + maxC=4 corner stays dead"?) ---
console.log('\nsmoke maxC=4 by rate (mine):');
for (const rt of [0.15, 0.3, 0.5, 0.75, 1]) {
  const sub = mine.rows.filter((r) => r.world === '000-smoke' && r.maxC === 4 && r.rate === rt);
  console.log(`  rate=${rt}: ${pct(sub.map((r) => r.success))} (n=${sub.length})`);
}

// --- repair volume sanity: same-turn repairs should raise repairsTutor vs s01 ---
const meanOf = (rows, f) => +(rows.reduce((s, r) => s + (f(r) ?? 0), 0) / rows.length).toFixed(2);
console.log(`\nmean repairsTutor: mine=${meanOf(mine.rows, (r) => r.repairsTutor)}  s01=${meanOf(s01.rows, (r) => r.repairsTutor)}`);
console.log(`mean decayEvents:  mine=${meanOf(mine.rows, (r) => r.decayEvents)}  s01=${meanOf(s01.rows, (r) => r.decayEvents)}`);
console.log(`mean unrepaired:   mine=${meanOf(mine.rows, (r) => r.unrepaired)}  s01=${meanOf(s01.rows, (r) => r.unrepaired)}`);
console.log(`cap_reached: mine=${mine.rows.filter((r) => r.verdict === 'cap_reached').length}  s01=${s01.rows.filter((r) => r.verdict === 'cap_reached').length}`);
