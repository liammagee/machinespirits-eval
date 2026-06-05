// turnPlanSampler.js — the generative side of the shared TBox (the sampler walks the
// ontology to GENERATE, the same vocabulary the critic walks to SCORE).
//
// validateTurnPlan REJECTS a turn_plan with a form-conflict (a move that contraindicates a
// targeted form, R6). This sampler is that constraint RUN BACKWARDS: it enumerates the valid
// move pool from the poetics TBox — moves performedByRole the acting role, aimsAtForm at least
// one target, and NOT contraindicatesForm any target — then samples varied move-sets from it.
// Acceptance is a round-trip: every sampled plan must pass validateTurnPlan (see the test).
//
// Stage 1 (this file): the core turn-plan sampler. Conditioning on context/alter-egos and
// widening to full drama specs are later stages — see
// notes/poetics/2026-06-05-sampler-walks-the-tbox-scope.md.

import { loadSharedTBox } from './reasoningOntology.js';
import { n3reasoner } from 'eyereasoner';
import { Parser } from 'n3';

const NS = 'https://machinespirits.dev/ontology/reasoning#';
const TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
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
const formLocal = (t) => FORM_LOCAL[String(t).toLowerCase()] || t;

// Deterministic PRNG (seeded) — reproducible sampling without Math.random.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFrom(str) {
  let h = 2166136261;
  for (const c of String(str)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Reason the poetics TBox ONCE and cache the per-move {aimsAtForm, contraindicatesForm,
// performedByRole} closure — the same facts validateTurnPlan keys on.
let _catalog = null;
export async function moveCatalog() {
  if (_catalog) return _catalog;
  const data = loadSharedTBox(['poetics']);
  const quads = new Parser({ format: 'text/n3' }).parse(
    await n3reasoner(data, undefined, { output: 'deductive_closure', outputType: 'string' }),
  );
  const moves = {};
  for (const q of quads) {
    if (q.predicate.value === TYPE && q.object.value === NS + 'AdaptationMove') {
      moves[q.subject.value.replace(NS, '')] = { aims: new Set(), contra: new Set(), roles: new Set() };
    }
  }
  for (const q of quads) {
    const s = q.subject.value.replace(NS, '');
    if (!moves[s]) continue;
    const o = q.object.value.replace(NS, '');
    if (q.predicate.value === NS + 'aimsAtForm') moves[s].aims.add(o);
    else if (q.predicate.value === NS + 'contraindicatesForm') moves[s].contra.add(o);
    else if (q.predicate.value === NS + 'performedByRole') moves[s].roles.add(o);
  }
  _catalog = moves;
  return moves;
}

// The valid move pool for a role + targets: performed by the role, serves >= 1 target,
// contraindicates NONE (so a sampled plan can never trip R6). Returns snake_case names.
export async function validMovesFor(role, targets = []) {
  const catalog = await moveCatalog();
  const roleClass = ROLE_CLASS[role] || null;
  const targetLocals = new Set((targets || []).map(formLocal));
  const pool = [];
  for (const [m, info] of Object.entries(catalog)) {
    if (roleClass && !info.roles.has(roleClass)) continue;
    const serves = [...info.aims].some((f) => targetLocals.has(f));
    const conflicts = [...info.contra].some((f) => targetLocals.has(f));
    if (serves && !conflicts) pool.push(pascalToSnake(m));
  }
  return pool.sort();
}

// Sample ONE turn_plan entry: a varied, valid move-set for (role, targets), deterministic
// from opts.seed. Valid by construction — round-trips through validateTurnPlan with ok=true.
export async function sampleTurnPlan(targets = [], role = 'tutor', opts = {}) {
  const pool = await validMovesFor(role, targets);
  const rng = mulberry32(seedFrom(opts.seed ?? `${role}:${(targets || []).join(',')}`));
  const max = Math.min(pool.length, opts.maxMoves ?? 3);
  const n = pool.length ? 1 + Math.floor(rng() * max) : 0;
  const moves = shuffle(pool, rng).slice(0, n).sort();
  const entry = { at: { turn: opts.turn ?? 3 }, role, moves };
  if ((targets || []).length === 1) entry.target = targets[0]; // a single, explicit target
  return entry;
}

export default { moveCatalog, validMovesFor, sampleTurnPlan };
