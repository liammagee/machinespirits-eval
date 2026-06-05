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

const AGENCY_LOCAL = { ego: 'Ego', superego: 'Superego', id: 'Id' };
// Cast architecture -> the interior agencies the character HAS (the alter-egos present).
const ARCH_AGENCIES = {
  ego_only: ['ego'],
  unified: ['ego'],
  ego_superego: ['ego', 'superego'],
  ego_superego_recognition: ['ego', 'superego'],
  ego_superego_recognition_authentic: ['ego', 'superego'],
  id_director: ['ego', 'superego', 'id'],
};
export function agenciesForArchitecture(arch) {
  return ARCH_AGENCIES[String(arch || '').toLowerCase()] || ['ego', 'superego', 'id']; // unknown -> all present
}
// Generic persona prior on move COUNT (a context weight, not a per-move mapping): anxious/
// novice personas take fewer moves; eager/adversarial take more. Validity is unchanged.
const PERSONA_MAX = {
  struggling_anxious: 2,
  confused_novice: 2,
  focused_achiever: 2,
  eager_explorer: 3,
  adversarial_tester: 3,
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
      moves[q.subject.value.replace(NS, '')] = {
        aims: new Set(),
        contra: new Set(),
        roles: new Set(),
        requires: new Set(),
      };
    }
  }
  for (const q of quads) {
    const s = q.subject.value.replace(NS, '');
    if (!moves[s]) continue;
    const o = q.object.value.replace(NS, '');
    if (q.predicate.value === NS + 'aimsAtForm') moves[s].aims.add(o);
    else if (q.predicate.value === NS + 'contraindicatesForm') moves[s].contra.add(o);
    else if (q.predicate.value === NS + 'performedByRole') moves[s].roles.add(o);
    else if (q.predicate.value === NS + 'requiresAgency') moves[s].requires.add(o);
  }
  _catalog = moves;
  return moves;
}

// The valid move pool for a role + targets: performed by the role, serves >= 1 target,
// contraindicates NONE (so a sampled plan can never trip R6). When opts.agencies is given
// (the alter-egos present, e.g. ['ego','superego']), a move requiring an ABSENT agency is
// excluded — the alter-ego conditioning: an ego_only tutor cannot route_change (no superego
// mechanism-critic to drive it). Returns snake_case names.
export async function validMovesFor(role, targets = [], opts = {}) {
  const catalog = await moveCatalog();
  const roleClass = ROLE_CLASS[role] || null;
  const targetLocals = new Set((targets || []).map(formLocal));
  const present = opts.agencies ? new Set(opts.agencies.map((a) => AGENCY_LOCAL[a] || a)) : null;
  const pool = [];
  for (const [m, info] of Object.entries(catalog)) {
    if (roleClass && !info.roles.has(roleClass)) continue;
    const serves = [...info.aims].some((f) => targetLocals.has(f));
    const conflicts = [...info.contra].some((f) => targetLocals.has(f));
    const agencyMissing = present && [...info.requires].some((a) => !present.has(a));
    if (serves && !conflicts && !agencyMissing) pool.push(pascalToSnake(m));
  }
  return pool.sort();
}

// Sample ONE turn_plan entry: a varied, valid move-set for (role, targets), deterministic
// from opts.seed. Conditioned on opts.agencies (alter-egos present — gates the pool) and
// opts.persona (a generic context prior on move COUNT). Valid by construction — round-trips
// through validateTurnPlan with ok=true.
export async function sampleTurnPlan(targets = [], role = 'tutor', opts = {}) {
  const pool = await validMovesFor(role, targets, opts);
  const rng = mulberry32(seedFrom(opts.seed ?? `${role}:${(targets || []).join(',')}`));
  const cap = opts.persona && PERSONA_MAX[opts.persona] ? PERSONA_MAX[opts.persona] : (opts.maxMoves ?? 3);
  const max = Math.min(pool.length, cap);
  const n = pool.length ? 1 + Math.floor(rng() * max) : 0;
  const moves = shuffle(pool, rng).slice(0, n).sort();
  const entry = { at: { turn: opts.turn ?? 3 }, role, moves };
  if ((targets || []).length === 1) entry.target = targets[0]; // a single, explicit target
  return entry;
}

export default { moveCatalog, validMovesFor, sampleTurnPlan, agenciesForArchitecture };
