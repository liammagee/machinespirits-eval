/**
 * Adaptation-sweep harness for the dramatic-derivation decay condition.
 *
 * Usage:
 *   node harness.mjs --strategy ./strategy.mjs [--worlds 000-smoke,002-lantern]
 *                    [--grid full|quick|boundary] [--seeds 1,2,3,4,5]
 *                    [--rates 0.5,1.0] [--graces 0] [--maxc 2,8] [--starts 1]
 *                    [--out results.json]
 *   (--rates/--graces/--maxc/--starts override the chosen grid axis-by-axis)
 *
 * Strategy module contract (ESM):
 *   export const name = 'my-strategy';
 *   export const description = 'one line';
 *   export function makeRoles(world, helpers, ctx) {
 *     return { director, tutor, learner };   // FRESH role fns per call
 *   }
 *   ctx = { seed }  — the run's decay seed; stochastic strategies MUST seed
 *   their randomness from it (helpers.mulberry32) so runs stay reproducible.
 *
 * helpers = { makeMockDirector, makeMockTutor, makeMockLearner,
 *             factKey, closure, matchPattern, detectStall, mulberry32 }
 *
 * Hard rules enforced by this harness (not by trust):
 *   - mock tier only: no network, no LLM clients, zero paid calls.
 *   - frozen formal channel: the release ledger of every run is compared
 *     against the world's release schedule (prefix up to turnsPlayed).
 *     Any off-cue / skipped / extra release marks the row scheduleOk=false
 *     and the run does NOT count as a success regardless of verdict.
 */
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const REPO = '/Users/lmagee/Dev/machinespirits/machinespirits-eval-derivation';
const lib = await import(pathToFileURL(path.join(REPO, 'services/dramaticDerivation/index.js')).href);

const {
  loadWorld,
  runDrama,
  makeMockDirector,
  makeMockTutor,
  makeMockLearner,
  factKey,
  closure,
  matchPattern,
  detectStall,
  mulberry32,
  corruptionReport,
} = lib;

const helpers = { makeMockDirector, makeMockTutor, makeMockLearner, factKey, closure, matchPattern, detectStall, mulberry32 };

// --- CLI ---------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};

const strategyPath = arg('strategy');
if (!strategyPath) {
  console.error('--strategy <module.mjs> is required');
  process.exit(1);
}
const strategy = await import(pathToFileURL(path.resolve(strategyPath)).href);
if (typeof strategy.makeRoles !== 'function') {
  console.error(`${strategyPath} does not export makeRoles(world, helpers)`);
  process.exit(1);
}

const ALL_WORLDS = ['000-smoke', '001-nocturne', '002-lantern', '003-bitterwell', '004-withercombe'];
const worldNames = (arg('worlds') || ALL_WORLDS.join(',')).split(',').map((w) => w.trim()).filter(Boolean);
const seeds = (arg('seeds') || '1,2,3,4,5').split(',').map(Number);

const GRIDS = {
  // full: the pre-registered sweep grid — 5 rates × 3 graces × 3 maxC × 2 starts = 90 configs × seeds
  full: {
    rates: [0.15, 0.3, 0.5, 0.75, 1.0],
    graces: [0, 1, 2],
    maxConcurrents: [1, 2, 4],
    startTurns: [1, 4],
  },
  // quick: refinement-loop grid — 2×2×2×1 = 8 configs × seeds
  quick: {
    rates: [0.3, 0.75],
    graces: [0, 2],
    maxConcurrents: [1, 2],
    startTurns: [1],
  },
  // boundary: the harsh corner — where strategies die
  boundary: {
    rates: [0.75, 1.0],
    graces: [0],
    maxConcurrents: [2, 4],
    startTurns: [1],
  },
};
const preset = GRIDS[arg('grid', 'full')];
if (!preset) {
  console.error(`unknown grid '${arg('grid')}' (full|quick|boundary)`);
  process.exit(1);
}
const nums = (s) => s.split(',').map(Number);
const grid = {
  rates: arg('rates') ? nums(arg('rates')) : preset.rates,
  graces: arg('graces') ? nums(arg('graces')) : preset.graces,
  maxConcurrents: arg('maxc') ? nums(arg('maxc')) : preset.maxConcurrents,
  startTurns: arg('starts') ? nums(arg('starts')) : preset.startTurns,
};

// --- frozen-channel guard ------------------------------------------------
function scheduleIntact(world, result) {
  const expected = world.releaseSchedule.filter((e) => e.turn <= result.turnsPlayed);
  if (result.ledger.length !== expected.length) return false;
  return expected.every((s, i) => {
    const l = result.ledger[i];
    return l && l.turn === s.turn && l.premiseId === s.premise && l.via === s.via;
  });
}

// --- sweep ---------------------------------------------------------------
const rows = [];
const worlds = worldNames.map((w) => ({
  name: w,
  world: loadWorld(path.join(REPO, `config/drama-derivation/world-${w}.yaml`)),
}));

const t0 = Date.now();
for (const { name: worldName, world } of worlds) {
  for (const rate of grid.rates) {
    for (const graceTurns of grid.graces) {
      for (const maxConcurrent of grid.maxConcurrents) {
        for (const startTurn of grid.startTurns) {
          for (const seed of seeds) {
            const decay = { seed, rate, graceTurns, maxConcurrent, startTurn };
            const roles = strategy.makeRoles(world, helpers, { seed }); // FRESH per run
            // eslint-disable-next-line no-await-in-loop
            const result = await runDrama({ world, roles, options: { decay } });
            const ok = scheduleIntact(world, result);
            const report = corruptionReport ? corruptionReport(result) : null;
            rows.push({
              world: worldName,
              rate,
              grace: graceTurns,
              maxC: maxConcurrent,
              start: startTurn,
              seed,
              verdict: result.verdict,
              success: ok && result.verdict === 'grounded_anagnorisis',
              scheduleOk: ok,
              turnsPlayed: result.turnsPlayed,
              firstForcedTurn: result.firstForcedTurn,
              decayEvents: report?.decayEvents ?? 0,
              repairsTutor: report?.repairs?.byTutor ?? 0,
              repairsReadopt: report?.repairs?.byReadoption ?? 0,
              meanRepairLatency: report?.meanRepairLatency ?? null,
              unrepaired: report?.unrepairedAtEnd ?? 0,
              integral: report?.degradedTurnIntegral ?? 0,
              dReversals: report?.dReversals ?? 0,
            });
          }
        }
      }
    }
  }
}
const elapsedMs = Date.now() - t0;

// --- aggregates ------------------------------------------------------------
const pct = (xs) => (xs.length ? +(xs.filter(Boolean).length / xs.length).toFixed(3) : null);
const byWorld = worldNames.map((w) => {
  const sub = rows.filter((r) => r.world === w);
  return { world: w, runs: sub.length, successRate: pct(sub.map((r) => r.success)) };
});
const byRate = grid.rates.map((rate) => {
  const sub = rows.filter((r) => r.rate === rate);
  return { rate, successRate: pct(sub.map((r) => r.success)) };
});
const rateGraceMatrix = grid.rates.map((rate) =>
  grid.graces.map((grace) => pct(rows.filter((r) => r.rate === rate && r.grace === grace).map((r) => r.success))),
);
const failureModes = {};
for (const r of rows.filter((x) => !x.success)) {
  const key = r.scheduleOk ? r.verdict : `SCHEDULE_VIOLATION(${r.verdict})`;
  failureModes[key] = (failureModes[key] || 0) + 1;
}
// strongest config survived: hardest (rate, then maxC, then -grace) with 100% success across seeds+worlds
const configKey = (r) => `${r.rate}|${r.grace}|${r.maxC}|${r.start}`;
const configs = new Map();
for (const r of rows) {
  if (!configs.has(configKey(r))) configs.set(configKey(r), []);
  configs.get(configKey(r)).push(r.success);
}
let strongest = null;
for (const [key, succ] of configs) {
  if (!succ.every(Boolean)) continue;
  const [rate, grace, maxC, start] = key.split('|').map(Number);
  const harder =
    !strongest ||
    rate > strongest.rate ||
    (rate === strongest.rate && maxC > strongest.maxConcurrent) ||
    (rate === strongest.rate && maxC === strongest.maxConcurrent && grace < strongest.grace);
  if (harder) strongest = { rate, grace, maxConcurrent: maxC, startTurn: start };
}

const summary = {
  strategy: { name: strategy.name || path.basename(strategyPath), description: strategy.description || '' },
  grid: { ...grid, seeds, worlds: worldNames },
  runs: rows.length,
  successes: rows.filter((r) => r.success).length,
  successRate: pct(rows.map((r) => r.success)),
  scheduleViolations: rows.filter((r) => !r.scheduleOk).length,
  byWorld,
  byRate,
  rateGraceMatrix: { rates: grid.rates, graces: grid.graces, successRate: rateGraceMatrix },
  failureModes,
  strongestFullySurvived: strongest,
  elapsedMs,
};

const out = arg('out');
if (out) {
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(path.resolve(out), JSON.stringify({ summary, rows }, null, 2));
}

console.log(JSON.stringify(summary, null, 2));
