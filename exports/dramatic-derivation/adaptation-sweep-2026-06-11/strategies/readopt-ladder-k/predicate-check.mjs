/**
 * Analysis-only (omniscient is fine here — this is the experimenter's desk,
 * not a role): compute the designer's keep-oldest-k closure predicate
 *
 *   pred(world, m, k) = S in closure( bg
 *                                     + (released \ pool)
 *                                     + oldest-k(pool)
 *                                     + final premise (its release turn),
 *                                     rules )
 *   pool = oldest-m released premises (release order)
 *
 * and compare it cell-for-cell against the observed rate-1.0 phase surface.
 */
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const REPO = '/Users/lmagee/Dev/machinespirits/machinespirits-eval-derivation';
const lib = await import(pathToFileURL(path.join(REPO, 'services/dramaticDerivation/index.js')).href);
const { loadWorld, closure, factKey } = lib;

const WORLDS = ['000-smoke', '001-nocturne', '002-lantern', '003-bitterwell', '004-withercombe'];
const MS = [2, 3, 4, 6, 8];
const KS = [1, 2, 3, 4];

const worlds = WORLDS.map((w) => ({
  name: w,
  world: loadWorld(path.join(REPO, `config/drama-derivation/world-${w}.yaml`)),
}));

function predicate(world, m, k) {
  const releasedIds = world.releaseSchedule.map((e) => e.premise); // release order (sorted by turn)
  const released = releasedIds.map((id) => world.premiseById.get(id).fact);
  const pool = released.slice(0, Math.min(m, released.length));
  const rest = released.slice(pool.length);
  const oldestK = pool.slice(0, k);
  const finalPremise = released[released.length - 1];
  const board = [...world.background, ...rest, ...oldestK, finalPremise];
  return closure(board, world.rules).facts.has(factKey(world.secret.fact));
}

// observed: success at rate 1.0 / grace 0 / start 1, seeds 1&2 (seed-invariant, verified)
const observed = {};
for (const k of KS) {
  const d = JSON.parse(fs.readFileSync(`/tmp/adaptation-sweep/results/readopt-ladder-k${k}-phase.json`));
  for (const r of d.rows) {
    const cell = `${k}|${r.maxC}|${r.world}`;
    if (!(cell in observed)) observed[cell] = { success: true, verdict: r.verdict, turns: r.turnsPlayed };
    observed[cell].success = observed[cell].success && r.success;
  }
}

let match = 0;
let total = 0;
const misses = [];
const predTable = {};
for (const k of KS) {
  for (const m of MS) {
    let predCount = 0;
    let obsCount = 0;
    for (const { name, world } of worlds) {
      const pred = predicate(world, m, k);
      const obs = observed[`${k}|${m}|${name}`];
      total += 1;
      if (pred === obs.success) match += 1;
      else misses.push({ k, m, world: name, predicted: pred, observed: obs.success, verdict: obs.verdict, turns: obs.turns });
      if (pred) predCount += 1;
      if (obs.success) obsCount += 1;
    }
    predTable[`k${k}m${m}`] = { predicted: predCount, observed: obsCount };
  }
}

console.log('predicate vs observed (rate 1.0, grace 0, start 1):');
console.log(`cells matched: ${match}/${total}`);
console.log('\nper-cell counts predicted/5 -> observed/5:');
for (const k of KS) {
  const line = MS.map((m) => {
    const t = predTable[`k${k}m${m}`];
    return `m=${m}: ${t.predicted}->${t.observed}`;
  });
  console.log(` k=${k}  ${line.join('   ')}`);
}
console.log('\nmismatched cells (all should be predicted=true, observed=false if stall-kill is the only gap):');
for (const x of misses) console.log(' ', JSON.stringify(x));

// world metadata for diagnosis
console.log('\nworld shapes:');
for (const { name, world } of worlds) {
  const gaps = [];
  const sched = world.releaseSchedule;
  for (let i = 1; i < sched.length; i += 1) gaps.push(sched[i].turn - sched[i - 1].turn);
  console.log(
    ` ${name}: premises=${world.premises.length} releases=${sched.length} lastRelease=t${sched[sched.length - 1].turn} cap=${world.turnCap} window=${world.slope.aporia_window} maxGap=${Math.max(...gaps)}`,
  );
}
