// Attribution detail: rate-1.0 x maxC cross, starvation signature, flip directions by world.
import fs from 'node:fs';
const load = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const mine = load('/tmp/adaptation-sweep/results/sameturn-cadence-only.json');
const s01 = load('/tmp/adaptation-sweep/results/s01-tutor-repair.json');
const pct = (xs) => (xs.length ? +(xs.filter(Boolean).length / xs.length).toFixed(3) : null);
const key = (r) => [r.world, r.rate, r.grace, r.maxC, r.start, r.seed].join('|');
const s01Map = new Map(s01.rows.map((r) => [key(r), r]));

console.log('rate x maxC success (mine / s01):');
for (const rt of [0.15, 0.3, 0.5, 0.75, 1]) {
  const line = [1, 2, 4].map((m) => {
    const a = pct(mine.rows.filter((r) => r.rate === rt && r.maxC === m).map((r) => r.success));
    const b = pct(s01.rows.filter((r) => r.rate === rt && r.maxC === m).map((r) => r.success));
    return `maxC${m}: ${a}/${b}`;
  });
  console.log(`  rate=${rt}  ${line.join('   ')}`);
}

// starvation signature at rate=1, maxC=4: many tutor repairs yet many unrepaired at end
const harsh = mine.rows.filter((r) => r.rate === 1 && r.maxC === 4 && !r.success);
const meanOf = (rows, f) => (rows.length ? +(rows.reduce((s, r) => s + (f(r) ?? 0), 0) / rows.length).toFixed(2) : null);
console.log(`\nrate=1 maxC=4 FAILED runs (n=${harsh.length}): mean repairsTutor=${meanOf(harsh, (r) => r.repairsTutor)} mean decayEvents=${meanOf(harsh, (r) => r.decayEvents)} mean unrepaired=${meanOf(harsh, (r) => r.unrepaired)} mean turnsPlayed=${meanOf(harsh, (r) => r.turnsPlayed)}`);
const harsh01 = s01.rows.filter((r) => r.rate === 1 && r.maxC === 4 && !r.success);
console.log(`s01 same cell  FAILED runs (n=${harsh01.length}): mean repairsTutor=${meanOf(harsh01, (r) => r.repairsTutor)} mean decayEvents=${meanOf(harsh01, (r) => r.decayEvents)} mean unrepaired=${meanOf(harsh01, (r) => r.unrepaired)} mean turnsPlayed=${meanOf(harsh01, (r) => r.turnsPlayed)}`);

// flip directions by world
console.log('\nflips by world (up = mine-only success, down = s01-only):');
for (const w of ['000-smoke', '001-nocturne', '002-lantern', '003-bitterwell', '004-withercombe']) {
  let up = 0, down = 0;
  for (const r of mine.rows.filter((x) => x.world === w)) {
    const o = s01Map.get(key(r));
    if (r.success && !o.success) up++;
    if (!r.success && o.success) down++;
  }
  console.log(`  ${w}: +${up} / -${down}`);
}

// cap_reached cluster location
const caps = mine.rows.filter((r) => r.verdict === 'cap_reached');
const capBy = {};
for (const r of caps) capBy[`${r.world}|rate${r.rate}|maxC${r.maxC}`] = (capBy[`${r.world}|rate${r.rate}|maxC${r.maxC}`] || 0) + 1;
console.log('\ncap_reached clusters:', JSON.stringify(capBy, null, 1));
