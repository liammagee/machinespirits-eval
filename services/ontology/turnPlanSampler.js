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
export const TURN_PLAN_ROLES = Object.freeze(Object.keys(ROLE_CLASS));
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
  const roleKey = String(role || '').toLowerCase();
  const roleClass = ROLE_CLASS[roleKey] || null;
  if (!roleClass) {
    throw new RangeError(
      `Unsupported turn-plan role "${role}". Expected one of: ${TURN_PLAN_ROLES.join(', ')}. Audience is a non-enacted position and cannot perform moves.`,
    );
  }
  const targetLocals = new Set((targets || []).map(formLocal));
  const present = opts.agencies ? new Set(opts.agencies.map((a) => AGENCY_LOCAL[a] || a)) : null;
  const pool = [];
  for (const [m, info] of Object.entries(catalog)) {
    if (!info.roles.has(roleClass)) continue;
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

// Illustrative slot priors for the full-spec sampler. Lists may repeat a value to weight it.
// (Not load-bearing — the validity guarantee is the turn_plan round-trip; these just fill slots.)
const SPEC_PRIORS = {
  tutorArch: ['ego_superego', 'ego_superego', 'ego_only', 'id_director'],
  tutorPromptType: ['recognition', 'recognition', 'base', 'dialectical_suspicious'],
  tutorSuperego: ['suspicious', 'standard', 'advocate'],
  learnerArch: ['ego_superego_recognition_authentic', 'ego_superego', 'unified'],
  persona: ['struggling_anxious', 'confused_novice', 'eager_explorer', 'focused_achiever', 'adversarial_tester'],
  pedagogical: ['socratic_elenchus', 'worked_example', 'analogical_bridge'],
  dialogue: ['aristotelian_reversal', 'dialectical'],
  openingSpeaker: ['learner', 'tutor'],
  maxTurns: [6, 7, 8],
};

// Stage 3: sample a form-valid drama spec (drama / cast / audience / turn_plan). Slots are
// filled from priors; the turn_plan is sampled per role CONDITIONED on the sampled cast
// architectures (the alter-egos) and persona — so the spec is internally coherent (an ego_only
// tutor's turn_plan has no route_change) and round-trips through validateTurnPlan.
//
// SCOPE (honest): this is FORM-VALID, partly DECLARATIVE. Only the TUTOR turn_plan entry
// currently executes at runtime (the engine's resolveTutorTurnPlan reads tutor entries); the
// learner/director entries are valid declarative spec that is NOT yet lowered to the engine's
// interventions[] (SPEC.md, roadmap). Do not read the sampled learner/director moves as
// executed behavior. Pass a brief via opts (topic/hamartia/targets/seed/...) to steer.
export async function sampleDramaSpec(opts = {}) {
  const targets = opts.targets && opts.targets.length ? opts.targets : ['peripeteia'];
  const seed = opts.seed ?? `spec:${targets.join(',')}`;
  const rng = mulberry32(seedFrom(seed));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const tutorArch = opts.tutorArchitecture || pick(SPEC_PRIORS.tutorArch);
  const learnerArch = opts.learnerArchitecture || pick(SPEC_PRIORS.learnerArch);
  const persona = opts.persona || pick(SPEC_PRIORS.persona);
  const maxTurns = opts.maxTurns || pick(SPEC_PRIORS.maxTurns);
  const pivot = Math.max(2, Math.ceil(maxTurns / 2));

  const drama = {
    id: opts.id || `D_SAMPLED_${seedFrom(seed) % 100000}`,
    targets,
    topic: opts.topic || '<topic — fill in>',
    hamartia: opts.hamartia || '<the misconception — fill in>',
    tutor: {
      prompt_type: pick(SPEC_PRIORS.tutorPromptType),
      architecture: tutorArch,
      superego_disposition: pick(SPEC_PRIORS.tutorSuperego),
      recognition_mode: true,
    },
    learner: { persona, architecture: learnerArch },
    pedagogical_approach: pick(SPEC_PRIORS.pedagogical),
    dialogue_approach: pick(SPEC_PRIORS.dialogue),
    scene: { opening_speaker: pick(SPEC_PRIORS.openingSpeaker), ending_speaker: 'learner' },
    max_turns: maxTurns,
  };
  const cast = {
    director: 'llm:api:sonnet',
    tutor: 'llm:api:sonnet',
    learner: 'llm:api:sonnet',
    critic: 'llm:api:gpt',
    default_backend: 'api',
  };
  const audience = { panel: ['gpt', 'deepseek-v4-pro', 'qwen3.7-max'], consensus: '2-of-3', grading: 'graded' };

  const tutorTurn = await sampleTurnPlan(targets, 'tutor', {
    agencies: agenciesForArchitecture(tutorArch),
    persona,
    seed: `${seed}:tutor`,
    turn: pivot,
  });
  const learnerTurn = await sampleTurnPlan(targets, 'learner', {
    agencies: agenciesForArchitecture(learnerArch),
    persona,
    seed: `${seed}:learner`,
    turn: pivot,
  });
  const turn_plan = [tutorTurn, learnerTurn].filter((t) => t.moves.length); // drop empty (agency-gated) turns

  return { drama, cast, audience, turn_plan };
}

export default { moveCatalog, validMovesFor, sampleTurnPlan, agenciesForArchitecture, sampleDramaSpec, TURN_PLAN_ROLES };
