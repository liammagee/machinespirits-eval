#!/usr/bin/env node
/**
 * sampler-diversity-vs-baseline.js — does walking the ontology HELP? (zero-API)
 *
 * Compares the ONTOLOGY turn-plan sampler against a NAIVE baseline (random moves from the
 * role's repertoire, ignoring aimsAtForm / contraindicatesForm — "you know the role but not
 * the form semantics") on the metrics that matter for a generator:
 *   - validity   : % with no form-conflict (would pass validateTurnPlan / R6)
 *   - on-target  : % with >=1 move that serves a target (moveServesTarget)
 *   - usable     : % both valid AND on-target (the yield of usable plans)
 *   - distinct / distinct-valid : raw vs USABLE move-set variety
 *
 * Validity/on-target are computed from the cached catalog (the same aimsAt/contra facts the
 * reasoner uses) for speed; a spot-check confirms equivalence with the real validateTurnPlan.
 */
import { moveCatalog, sampleTurnPlan } from '../services/ontology/turnPlanSampler.js';
import { validateTurnPlan } from '../services/ontology/reasoningOntology.js';

const ROLE_CLASS = { tutor: 'TutorRole', learner: 'LearnerRole', director: 'DirectorRole' };
const FORM_LOCAL = {
  peripeteia: 'Peripeteia',
  anagnorisis: 'Anagnorisis',
  catharsis: 'Catharsis',
  surprise_inevitability: 'SurpriseInevitability',
  unity_of_action: 'UnityOfAction',
  hamartia_integration: 'HamartiaIntegration',
};
const pascalToSnake = (s) =>
  String(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const seedFrom = (str) => {
  let h = 2166136261;
  for (const c of String(str)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
const shuffle = (arr, rng) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const K = 200;
const CONFIGS = [
  { role: 'tutor', targets: ['peripeteia'] },
  { role: 'learner', targets: ['anagnorisis'] },
  { role: 'tutor', targets: ['catharsis'] },
];

const catalog = await moveCatalog();
const bySnake = {};
for (const [m, info] of Object.entries(catalog)) bySnake[pascalToSnake(m)] = info;

function evalSample(moves, targetLocals) {
  let conflict = false;
  let anyServe = false;
  let allServe = moves.length > 0;
  for (const mv of moves) {
    const info = bySnake[mv];
    const serves = info ? [...info.aims].some((f) => targetLocals.has(f)) : false;
    const contra = info ? [...info.contra].some((f) => targetLocals.has(f)) : false;
    if (contra) conflict = true;
    if (serves) anyServe = true;
    else allServe = false; // an off-target move breaks purity
  }
  return { valid: !conflict, onTarget: anyServe, pure: allServe }; // pure = EVERY move serves a target
}

function repertoire(role) {
  const rc = ROLE_CLASS[role];
  return Object.entries(catalog)
    .filter(([, info]) => info.roles.has(rc))
    .map(([m]) => pascalToSnake(m))
    .sort();
}

function summarize(samples, targetLocals) {
  let valid = 0;
  let usable = 0;
  let pure = 0;
  const sets = new Set();
  const pureSets = new Set();
  for (const moves of samples) {
    const key = moves.join('+');
    sets.add(key);
    const e = evalSample(moves, targetLocals);
    if (e.valid) valid += 1;
    if (e.valid && e.onTarget) usable += 1;
    if (e.valid && e.pure) {
      pure += 1;
      pureSets.add(key); // FOCUSED variety: distinct sets where every move is on-target
    }
  }
  const n = samples.length;
  return {
    validity: valid / n,
    usable: usable / n,
    pure: pure / n,
    distinct: sets.size,
    distinctPure: pureSets.size,
  };
}

const pct = (x) => `${(x * 100).toFixed(0)}%`;
let spotChecks = 0;
let spotMatches = 0;

for (const cfg of CONFIGS) {
  const targetLocals = new Set(cfg.targets.map((t) => FORM_LOCAL[t] || t));
  const rep = repertoire(cfg.role);

  const onto = [];
  for (let i = 0; i < K; i++) {
    const e = await sampleTurnPlan(cfg.targets, cfg.role, { seed: `onto-${cfg.role}-${i}` });
    onto.push(e.moves);
  }
  const naive = [];
  for (let i = 0; i < K; i++) {
    const rng = mulberry32(seedFrom(`naive-${cfg.role}-${i}`));
    const n = rep.length ? 1 + Math.floor(rng() * Math.min(3, rep.length)) : 0;
    naive.push(shuffle(rep, rng).slice(0, n).sort());
  }

  // spot-check the fast evaluator against the real validateTurnPlan (5 per config)
  for (let i = 0; i < 5; i++) {
    const moves = naive[i];
    const fast = evalSample(moves, targetLocals);
    const real = await validateTurnPlan(
      [{ at: { turn: 3 }, role: cfg.role, target: cfg.targets[0], moves }],
      cfg.targets,
    );
    spotChecks += 1;
    if (fast.valid === real.ok) spotMatches += 1;
  }

  const om = summarize(onto, targetLocals);
  const nm = summarize(naive, targetLocals);
  console.log(`\n${cfg.role} / [${cfg.targets.join(',')}]   (role repertoire ${rep.length} moves, K=${K})`);
  console.log(
    `  ontology : valid ${pct(om.validity)}  usable ${pct(om.usable)}  PURE ${pct(om.pure)}  | raw-distinct ${om.distinct}  focused-distinct ${om.distinctPure}`,
  );
  console.log(
    `  naive    : valid ${pct(nm.validity)}  usable ${pct(nm.usable)}  PURE ${pct(nm.pure)}  | raw-distinct ${nm.distinct}  focused-distinct ${nm.distinctPure}`,
  );
}

console.log(`\nspot-check (fast evaluator vs real validateTurnPlan): ${spotMatches}/${spotChecks} agree`);
console.log('\nReading:');
console.log('  • USABLE = valid (no form-conflict) AND >=1 on-target move; PURE = valid AND EVERY move on-target.');
console.log('  • The ontology sampler is 100% usable + 100% PURE by construction; the naive wastes most samples');
console.log('    and its "usable" sets are padded with off-target moves (raw-distinct >> focused-distinct).');
console.log('  • Compare focused-distinct: that is the apples-to-apples FOCUSED variety (off-target padding removed).');
