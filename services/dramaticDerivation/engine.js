/**
 * The drama engine: turn loop, role-scoped views, release ledger, slope
 * trajectory, failure taxonomy (notes/2026-06-09-dramatic-derivation-plan.md §2–§3).
 *
 * Roles are injected async functions (mock now, LLM-backed later — same
 * seam as services/adaptiveTutor's mock/real split):
 *   director(view) -> { direction, release?: premiseId,
 *                       phase?: {name, intent} }  // declare/replace the current movement
 *   tutor(view)    -> { dialogue, move?: {figure,targetPremise,intent}, release?: premiseId,
 *                       deliberation?: {draftFigure, intervened, diagnosis, note, stall?} }
 *   learner(view)  -> { dialogue, adopt?: fact[], retract?: fact[], derive?: fact[],
 *                       hypothesis?: string, asserts?: fact }
 *
 * THE DERIVE CHANNEL (2026-06-10, stall-watcher experiment): the learner may
 * VOICE intermediate conclusions — facts it claims follow from its board
 * under the public rules. The learner composes them itself (an enumerated
 * pick-list would measure list-picking, not inference). Validation is
 * mechanical: in the closure of the valid board → the voiced ledger; not in
 * the closure → `overreach` event; base or question-pattern facts →
 * mischanneled (adopt and assert are those channels). Voicing changes
 * NOTHING formal — a derivable fact is in the closure whether or not spoken;
 * D(t), forcing, and the verdict are untouched by construction. The engine
 * also tracks the INFERENCE FRONTIER (derivable, non-base, non-pattern,
 * unvoiced facts with first-available turns) and exposes it to the
 * tutor-side view — the raw material of the superego's stall jurisdiction.
 * Question-pattern facts are excluded BEFORE the frontier exists, so the
 * superego never sees even a derivable S.
 *
 * THE DRAMATURGY IS THE DIRECTOR'S (operator decision 2026-06-09, logged in
 * notes/poetics/): the world's authored acts are a SKETCH; the director may
 * declare movements as the drama needs. The per-turn tutor-note channel was
 * REMOVED 2026-06-10 (operator decision): manner-watching belongs to the
 * tutor's own superego (llmRoles.makeLlmTutor, surfaced here only as the
 * tutor line's `deliberation` meta). What stays frozen is the formal channel:
 * the release schedule, the checker, the slope constraints, the turn cap.
 * The learner never sees staging state or tutor deliberation.
 *
 * STAGE V2 — ACTS, THE BOUNDED LEARNER, THE RECONSTRUCTING TUTOR
 * (notes/poetics/2026-06-11-act-bounded-learner-design.md; opt-in via
 * options.acts, off-state invariant when absent). The act becomes a
 * first-class unit: the director is still consulted every turn but returns an
 * act verdict ({act:'continue'|'end', direction?}) instead of free movements;
 * the engine owns the boundaries (minActTurns/maxActTurns guards) and
 * synthesizes an `Act N` staging phase at each boundary so every
 * phase-reading instrument works unchanged. Turn 1's direction is Act 1's
 * brief. The LEARNER is bounded: its view carries (a) its own theory store
 * and (b) the current act's dialogue/releases/voicings only — the theory is
 * the only thing that crosses an act boundary. The TUTOR view is redacted to
 * dialogue + its own release ledger (no learnerAbox, no corruption ledger, no
 * frontier/trajectory — each is computed FROM the hidden store and would leak
 * decay as deltas): §6.13.7's conduct condition made total at the view layer,
 * in BOTH probe arms. The director keeps its evaluative instruments
 * (trajectory, frontier, grounded count) but loses the corruption ledger and
 * the store dump, so act briefs cannot smuggle slip identities to the tutor.
 * Decay gains a mutation mode (corruption.js `mutateShare`): a hit may
 * misremember instead of delete — the false form sits on the learner's
 * BELIEF board (visible to the learner, never valid for forcing) until the
 * learner retracts it (`retract_false` ledger row); the true premise comes
 * back only via tutor repair or re-adoption, exactly as v1. The swap
 * constant's pool is config-keyed (corruption.js `pool`): "world" samples
 * all premises — which can leak an unreleased premise's constant into a
 * false form, a hole in the concealment invariant below — while "staged"
 * (registration §13) samples only background + premises released so far. A reconstructing
 * tutor (roles-layer dial) may emit per-turn `theory` — its model of the
 * learner's store — which the engine records beside a harness-truth snapshot
 * (result.reconstruction); arm-internal color, never cross-arm scoring.
 *
 * THE SINGLE-CONCEALMENT INVARIANT: the learner's view contains the public
 * question (+ pattern), the world RULES (the learner knows the law, lacks
 * the facts), its own background, the public transcript, and facts already
 * released. Never: the secret, the mirror, unreleased premises, the
 * schedule, or the proof paths. Tested in tests/dramaticDerivation.test.js.
 *
 * Success is computed, never judged: grounded anagnorisis requires the
 * learner to ASSERT the secret while the closure of its VALID grounded
 * facts (grounded ∩ (released ∪ background)) forces it. Adopted facts that
 * were never released are logged as `fabricated_fact` and excluded from the
 * success channel.
 */

import { closure, entails, factKey, matchPattern, proofTree } from './chainer.js';
import { normalizeDecayConfig, mulberry32 } from './corruption.js';
import { DIDACTIC_ACT_FALLBACK_SCHEMA } from './didacticMode.js';
import { buildLearnerCharacterArcView } from './characterDesire.js';
import { buildWorldIR, projectWorldIRLogic } from './guardCompiler.js';
import { deriveLearnerTransformationState, summarizeLearnerTransformationDurability } from './learnerTransformation.js';
import { buildLearnerDag, buildLearnerDagSnapshot } from './learnerDag.js';
import { buildDynamicLearnerField } from './learnerField.js';
import { proofDebtReport, tutorProofDebtView } from './proofDebt.js';
import { buildLearnerProxyDagMemory, buildTutorLearnerDagModel, deriveProxyDagPacingSignal } from './proxyDagMemory.js';
import { buildPedagogicalInteractionField } from './interactionField.js';
import { selectFieldPlannerMove, summarizeFieldPlannerOutcome } from './fieldPlanner.js';
import {
  classifyLearnerExchange,
  applyRecognitionNeedPolicy,
  detectPhaticRecognition,
  estimateRecognitionNeed,
  normalizeSceneConfig,
  openScene,
  recommendSceneTempoBeat,
  sceneMeta,
  sceneView,
  updateScene,
} from './rhetoricalMovePolicy.js';
import { createRuntimeMonitor } from './runtimeMonitor.js';
import { derivationDistance, detectStall } from './slope.js';
import { deriveOpportunityCostBudget, nextOpportunityCostBudget, auditOpportunityCost } from './opportunityCost.js';
import {
  blockTypeForExchange,
  buildMechanismHistoryEntry,
  ledgerRow,
  normalizeStrategyLedgerConfig,
  openBlock,
  sceneStanceFidelity,
  updateBlockLedger,
} from './strategyLedger.js';
import {
  buildLemmaDag,
  classifyRelease as classifyLemmaRelease,
  computeLemmaState,
  normalizeLemmaConfig,
  renderLearnerLemmaLines,
  renderTutorLemmaLines,
  supportRemaining as lemmaSupportRemaining,
} from './lemmaLayer.js';

function renderFact(fact) {
  return fact.join(' ');
}

function learnerTransformationRow(state, turn, act, phase, extra = {}) {
  return {
    turn,
    ...(act ? { act } : {}),
    phase,
    schema: state.schema,
    publicOnly: state.publicOnly === true,
    mayOverrideProofControl: state.mayOverrideProofControl === true,
    status: state.status || null,
    complete: state.complete === true,
    target: state.target?.currentObject || null,
    ownershipLevel: state.ownership?.ownershipLevel || null,
    ownershipScore: state.ownership?.score ?? null,
    requiredFamilies: state.requiredFamilies || [],
    passedFamilies: state.passedFamilies || [],
    missingFamilies: state.missingFamilies || [],
    recommendedMode: state.recommendedMode || null,
    finalAssertionAvailable: state.finalAssertionAvailable === true,
    lateOwnershipCheck: state.lateOwnershipCheck === true,
    inputAuditOk: state.inputAudit?.ok === true,
    nonLeakAuditOk: state.nonLeakAudit?.ok === true,
    ...extra,
  };
}

const ACTS_DEFAULTS = Object.freeze({
  minActTurns: 3,
  maxActTurns: 8,
});

const DIRECTOR_CADENCES = new Set(['turn', 'scene', 'release']);
const PUBLIC_REGISTERS = new Set(['default', 'modern', 'period']);

export function normalizeDirectorCadence(raw, { sceneMode = false } = {}) {
  if (raw == null || raw === '') return sceneMode ? 'scene' : 'turn';
  if (typeof raw !== 'string') {
    throw new Error(`director cadence must be one of turn, scene, release (got ${JSON.stringify(raw)})`);
  }
  const cadence = raw.trim().toLowerCase();
  if (!DIRECTOR_CADENCES.has(cadence)) {
    throw new Error(`director cadence must be one of turn, scene, release (got ${JSON.stringify(raw)})`);
  }
  return cadence;
}

function isDynamicPublicRegisterPlan(plan) {
  return Boolean(plan && typeof plan === 'object' && plan.mode === 'sample');
}

function staticPublicRegister(plan) {
  return PUBLIC_REGISTERS.has(plan)
    ? plan
    : isDynamicPublicRegisterPlan(plan)
      ? plan.base || plan.palette?.[0] || 'modern'
      : 'default';
}

function hashUnit(text) {
  let h = 2166136261;
  for (const ch of String(text)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function weightedRegisterPick(plan, key, previous = null) {
  const entries = plan.palette.map((register, i) => ({ register, weight: Number(plan.weights[i]) || 1 }));
  const pick = (choices, unit) => {
    const total = choices.reduce((sum, entry) => sum + entry.weight, 0);
    let cursor = unit * total;
    for (const entry of choices) {
      cursor -= entry.weight;
      if (cursor <= 0) return entry.register;
    }
    return choices[choices.length - 1].register;
  };
  let selected = pick(entries, hashUnit(key));
  if (previous && selected === previous && entries.length > 1) {
    selected = pick(
      entries.filter((entry) => entry.register !== previous),
      hashUnit(`${key}:alternate`),
    );
  }
  return selected;
}

function normalizeStagePrologue(raw, world) {
  const field = (...names) => {
    for (const name of names) {
      if (typeof raw?.[name] === 'string' && raw[name].trim()) return raw[name].trim();
    }
    return '';
  };
  return {
    stageNotes:
      field('stageNotes', 'stage_notes') ||
      `[Before the first exchange, ${world.title} is set as a public inquiry: ${world.question}]`,
    tutorCharacter:
      field('tutorCharacter', 'tutor_character') ||
      'The tutor enters as a careful guide who must let the learner make the decisive step.',
    learnerCharacter:
      field('learnerCharacter', 'learner_character') ||
      'The learner enters as curious, fallible, and entitled to test each claim before keeping it.',
    registerNote:
      field('registerNote', 'register_note') ||
      'Register should follow these characters and this world, never a generic period costume.',
  };
}

/**
 * Validate and default an acts config (stage v2). Accepts an object or a
 * JSON string (the CLI's `--acts '<json>'`). Unknown keys are rejected — a
 * typo'd guard must fail loudly, not silently run at its default.
 */
export function normalizeActsConfig(raw) {
  let cfg = raw;
  if (typeof cfg === 'string') {
    try {
      cfg = JSON.parse(cfg);
    } catch (err) {
      throw new Error(`acts config is not valid JSON: ${err.message}`);
    }
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    throw new Error('acts config must be a JSON object, e.g. {"minActTurns":3,"maxActTurns":8}');
  }
  for (const key of Object.keys(cfg)) {
    if (!(key in ACTS_DEFAULTS)) {
      throw new Error(`acts config: unknown key "${key}" (known: ${Object.keys(ACTS_DEFAULTS).join(', ')})`);
    }
  }
  const out = { ...ACTS_DEFAULTS, ...cfg };
  for (const name of ['minActTurns', 'maxActTurns']) {
    if (!Number.isInteger(out[name]) || out[name] < 1) {
      throw new Error(`acts config: ${name} must be an integer >= 1 (got ${JSON.stringify(out[name])})`);
    }
  }
  if (out.minActTurns > out.maxActTurns) {
    throw new Error(`acts config: minActTurns (${out.minActTurns}) must not exceed maxActTurns (${out.maxActTurns})`);
  }
  return out;
}

export async function runDrama({ world, roles, options = {} }) {
  const opts = {
    stopOnStall: true,
    stopOnLeak: true,
    learnerProxyDag: false,
    proxyDagPacing: false,
    tutorLearnerDag: false,
    recognitionGrace: 3,
    maxTurns: Infinity, // episode replay (replay.js) stops the loop early; world.turnCap still bounds it
    ...options,
  };
  // The unreliable-learner condition (corruption.js header): seeded decay of
  // the learner's grounded board, a RUN-LEVEL condition — worlds stay frozen.
  // null = condition absent, and absent means absent: no entry ever gains a
  // `decayed` flag, no new event types appear, and the result object is
  // field-for-field what the engine returned before the condition existed
  // (the decay-off invariance the tests pin).
  const decay = options.decay ? normalizeDecayConfig(options.decay) : null;
  const corruption = decay ? { config: decay, rng: mulberry32(decay.seed), ledger: [] } : null;
  // Stage v2 (header): acts mode is opt-in and, like decay, absent means
  // absent — no act state, no view bounding, no redaction, no new fields.
  const acts = options.acts ? normalizeActsConfig(options.acts) : null;
  const sceneConfig = options.sceneMode ? normalizeSceneConfig(options.sceneMode) : null;
  const fieldPlannerActive = Boolean(options.fieldPlanner || options.fieldPlannerEnforce);
  const fieldPlannerEnforceActive = Boolean(options.fieldPlannerEnforce);
  if (fieldPlannerActive && acts) {
    throw new Error(
      'field planner currently requires non-acts mode; acts mode redacts learner-store state from the tutor view',
    );
  }
  // Strategy ledger (LAYERED-DECISION-LOOPS-PLAN.md Phases 0-2): opt-in and,
  // like decay/acts, absent means absent — no block state, no commitment or
  // audit rows, no new result fields. Both dials need the scene/exchange
  // overlay: blocks segment its exchange types, commitments bind at its
  // boundaries. Conduct-only by construction: nothing here may name, gate,
  // or reorder a release/repair — the register is the one surface the
  // engine applies, and it is a prompt surface.
  const strategyLedgerConfig = options.strategyLedger ? normalizeStrategyLedgerConfig(options.strategyLedger) : null;
  const learnerLedgerActive = Boolean(options.learnerLedger);
  if (strategyLedgerConfig && !sceneConfig) {
    throw new Error(
      'strategy ledger requires scene mode (blocks segment scene exchanges; commitments bind at scene boundaries)',
    );
  }
  if (learnerLedgerActive && !sceneConfig) {
    throw new Error('learner ledger requires scene mode (scene intents bind at scene boundaries)');
  }
  // Lemma layer (opt-in; LEMMA-LAYER-PREREGISTRATION.md): a maintained proof
  // structure one level above the premise grain. display = the map as prompt
  // signal only; bind = the map also gates the tutor's VOLUNTARY proof
  // releases and takes a formal frontier choice at scene openings. Harness
  // forcings (hold limits, guard rescues) and director releases pass through
  // binding and are logged, never blocked.
  const lemmaConfig = options.lemmaLayer ? normalizeLemmaConfig(options.lemmaLayer) : null;
  if (lemmaConfig && !sceneConfig) {
    throw new Error('lemma layer requires scene mode (the frontier choice is a scene-opening decision)');
  }
  const lemmaDag = lemmaConfig ? buildLemmaDag(world) : null;
  if (lemmaConfig && !lemmaDag) {
    throw new Error('lemma layer: the authored proof path does not entail S (plot lint should have caught this)');
  }
  // Learner mirror refusal (exploration 6, refusal-learner-mirror.md): the
  // learner's mirror-fixation treated as an incumbent strategy. Fires at most
  // once per run; the payload is computed HERE so concealment lives engine-
  // side (grounds = the learner's OWN grounded base facts only).
  const learnerMirrorRefusalConfig = options.learnerMirrorRefusal
    ? options.learnerMirrorRefusal === true
      ? {}
      : options.learnerMirrorRefusal
    : null;
  const mirrorRefusalState = { fired: false, record: null };
  let sceneTempoThisTurn = null;
  let sceneRecognitionNeedThisTurn = null;
  const directorCadence = normalizeDirectorCadence(options.directorCadence, { sceneMode: Boolean(sceneConfig) });
  const publicRegisterPlan = options.publicRegister || 'default';
  const dynamicPublicRegisterPlan = isDynamicPublicRegisterPlan(publicRegisterPlan) ? publicRegisterPlan : null;
  const registerRows = [];
  let publicRegisterForTurn = staticPublicRegister(publicRegisterPlan);
  if (dynamicPublicRegisterPlan) {
    publicRegisterForTurn = weightedRegisterPick(
      dynamicPublicRegisterPlan,
      `${dynamicPublicRegisterPlan.seed}:${world.id}:run`,
    );
    registerRows.push({ turn: 0, register: publicRegisterForTurn, scope: 'run', scene: null });
  }
  // The run's baseline register — what scene-scoped commitments revert to.
  const baseRegisterForRun = publicRegisterForTurn;
  const stagePrologueEnabled = Boolean(options.stagePrologue);
  let stagePrologue = null;
  const runtimeMonitor = options.guardSpec ? createRuntimeMonitor(world, options.guardSpec) : null;
  const proofDebtGuardActive = Boolean(options.proofDebtGuard);
  const conductPolicyActive = Boolean(options.conductPolicy || options.conductProgressPolicy);
  const conductPolicyEnforceActive = Boolean(options.conductPolicyEnforce);
  const conductTriggerOverrides = Array.isArray(options.conductTriggerOverrides)
    ? options.conductTriggerOverrides
    : options.conductTriggerOverride
      ? [options.conductTriggerOverride]
      : [];
  const proofDebtViewActive = proofDebtGuardActive || conductPolicyActive || conductPolicyEnforceActive;
  const logicProjectionActive = Boolean(options.logicProjection);
  const worldIR = logicProjectionActive ? buildWorldIR(world) : null;
  const actState = acts ? { index: 1, startTurn: 1, brief: '', history: [] } : null;
  // Strategy-ledger runtime state (opt-in; guard above). Blocks, counters,
  // and the applied scene commitment live here; the COMMITMENT DECISIONS live
  // in the role bridges (the plot pattern) — the engine records and applies.
  const ledgerState = strategyLedgerConfig
    ? {
        config: strategyLedgerConfig,
        block: null,
        blockIndex: 0,
        blockRows: [],
        blockedModes: [],
        budget: deriveOpportunityCostBudget({ scope: 'dialogue_block' }),
        appliedCommitment: null,
        rows: [],
        stocktakes: [], // plan-mode stock-take records (planMode dial only)
        // v2 (trialling): the mechanism history table + this scene's declared
        // departures. History is PUBLIC-ONLY by construction — it renders
        // into prompts, so no D, no proof state, ever.
        history: [],
        departuresThisScene: 0,
      }
    : null;
  const learnerLedgerRows = []; // learner-authored rows (learnerLedger dial)
  let lastClosedSceneSummary = null; // public-only sealed-scene record; both boundary audits read it
  const reconstructionRows = []; // {turn, believed, truth} — reconstructing-tutor dial (roles-layer)
  const plotRows = []; // {act, turn, holdByEnd, withhold, friction, fallback} — C1 act-plot dial (roles-layer)
  const plotAuditRows = []; // {turn, [final,] act, clauses, summary[, arc][, throughlineAudit]} — C1 act-close audits
  const throughlineRows = []; // {act, turn, trigger[, reason], arc, holdToEnd, risk, salvage} — two-layer planning
  const proofDebtRows = []; // guard audit rows — proof-critical decayed exhibits offered to the tutor
  const logicSnapshots = []; // harness-only per-turn board closure over the canonical logic IR
  const sceneRows = []; // opt-in scene/exchange overlay — does not replace the formal turn loop
  const didacticModeRows = []; // public-only tutor advisory states, if the roles layer emits them
  const castLayerRows = []; // public-only cast/reinvention advisory states, if the roles layer emits them
  const learnerTransformationRows = []; // public-only ownership proof states, if the roles layer emits them
  const learnerTransformationPostRows = []; // post-learner public ownership proof snapshots
  const proxyDagPacingRows = []; // harness-only advisory assessment rows, if enabled
  const tutorLearnerDagRows = []; // redacted tutor-side model of learner DAG state, if enabled
  const fieldPlannerRows = []; // coupled-field runtime policy choices and post-turn outcomes
  let sceneState = null;
  const ledger = []; // {turn, premiseId, via}
  const releasedKeys = new Set();
  const releasedFacts = [];
  const releasedAtByKey = new Map(); // factKey -> release turn (act-bounding needs WHEN, not just whether)
  const backgroundKeys = new Set(world.background.map(factKey));

  const grounded = new Map(); // key -> {fact, turn, valid}
  for (const fact of world.background) {
    grounded.set(factKey(fact), { fact, turn: 0, valid: true });
  }
  const hypotheses = []; // {turn, text}

  const transcript = [];
  const trajectory = []; // {turn, D, forced, groundedCount}
  const learnerDagSnapshots = []; // learner-owned proof sketches, derived from learner-visible board actions
  const events = []; // {turn, type, detail}
  // Director-declared staging: the current movement persists until replaced.
  // The learner never sees it; since 2026-06-10 the tutor doesn't either —
  // movements are diagnostic dramaturgy, read only by the instruments.
  const staging = { phase: null };
  let firstForcedTurn = null;
  let assertedGroundedTurn = null;
  let endedBy = null;

  // Lemma-layer runtime state: clearance recomputed each turn from the valid
  // grounded board; the active lemma persists within a scene.
  const lemmaRun = lemmaDag
    ? {
        grounded: new Set(),
        frontier: [],
        active: null, // {key, label, by, sceneIndex, turn}
        clearedAt: new Map(), // label -> first turn grounded
        choices: [],
        departures: [],
        blocks: [],
        passthroughs: [],
        regressions: [],
        openings: 0,
        multiFrontierOpenings: 0,
        tutorChoices: 0,
      }
    : null;

  const validGroundedFacts = () =>
    [...grounded.values()].filter((entry) => entry.valid && !entry.decayed).map((entry) => entry.fact);

  // The learner's BELIEF board — what it would assent to. Differs from the
  // forcing board in exactly one class: mutation-born false beliefs
  // (mutatedFalse) are visible to the learner, which believes them, while
  // staying invalid for forcing/D. Fabricated adoptions stay invisible in
  // both (v1 behavior). With mutateShare 0 this is validGroundedFacts(),
  // fact for fact, in the same insertion order.
  const learnerBoardFacts = () =>
    [...grounded.values()]
      .filter((entry) => !entry.decayed && (entry.valid || entry.mutatedFalse))
      .map((entry) => entry.fact);

  // F(t): Jaccard fidelity between the learner's belief board and the ideal
  // no-decay store (background ∪ everything released so far). 1 = the theory
  // is exactly what the play has staged; deletions and false beliefs both
  // drag it down. Recorded onto trajectory rows only when corruption is on
  // (the design note's documented additive relaxation of v1 byte-identity).
  const theoryFidelity = () => {
    const idealKeys = new Set([...backgroundKeys, ...releasedKeys]);
    const union = new Set(idealKeys);
    let inter = 0;
    for (const [key, entry] of grounded) {
      if (entry.decayed || !(entry.valid || entry.mutatedFalse)) continue;
      if (idealKeys.has(key)) inter += 1;
      union.add(key);
    }
    return union.size ? inter / union.size : 1;
  };

  // --- derive channel + inference frontier state (stall-watcher instrument) ---
  const voicedLedger = []; // {fact, turn} — canonical closure facts the learner voiced via derive
  const voicedKeys = new Set();
  const firstAvailable = new Map(); // key -> {fact, turn} — first turn the fact was derivable from the valid board
  const overreaches = []; // {turn, fact} — derive claims NOT in the closure (false inferences)
  const mischanneled = []; // {turn, fact, kind: 'base'|'pattern'} — adopt/assert material sent down derive
  const premiseIdByKey = new Map([...world.premiseById.values()].map((p) => [factKey(p.fact), p.id]));
  // Twin-fact premises stage the SAME fact under different ids (alternative
  // evidentiary routes — lantern's p_residue/p_glimpse; only one twin is ever
  // scheduled). premiseIdByKey is last-writer-wins over that many-to-one map,
  // so it can name the twin that was never staged. Reported identity must be
  // the id whose release actually put the fact on the board: repairs BY id
  // are immune (they collapse to the fact key), but id-COMPARING consumers
  // (corruptionReport pairing, repair guards) silently mismatch otherwise.
  const releasedIdByKey = new Map(); // factKey -> premise id whose release staged it
  const premiseIdForKey = (key) => releasedIdByKey.get(key) ?? premiseIdByKey.get(key) ?? null;

  // Token-normalized matching for learner-composed derive claims: case and
  // punctuation are forgiven, content is not (pre-registered in
  // notes/poetics/2026-06-10-stall-watcher-quasi-logical-tom.md §2).
  const normToken = (atom) =>
    String(atom)
      .toLowerCase()
      .replace(/[^a-z0-9?]/gu, '');
  const normKey = (fact) => JSON.stringify(fact.map(normToken));

  // Question-pattern facts (S, the mirror, any fact of their shape) are the
  // assert channel's property — excluded from the frontier BEFORE it exists,
  // so the tutor-side view never contains even a derivable S.
  const isPatternFact = (fact) => matchPattern(world.questionPattern, fact) !== null;

  // Mutation ("misremembering") support, stage v2: a decay hit may, at
  // mutateShare odds, swap one argument of the lost fact for a plausible
  // same-slot constant — a mistaken axiom the learner now believes. The
  // candidate pool is deterministic (sorted constants seen at the same
  // predicate+position); the pick is one seeded rng draw over the filtered
  // candidate list. Constraints keep the false form strictly false and
  // strictly novel: no collision with any premise (released or not),
  // background fact, current board entry, the secret, the mirror, or the
  // question pattern. An empty candidate list falls back to a plain delete.
  //
  // Stage v3 (`pool` key, registration §13): under pool "world" constants are
  // harvested from ALL premises plus background — including unreleased
  // premises, so a false form can whisper a name the learner has never met
  // (the lantern-p3 defect: corruption staged "senna" before any exhibit
  // did). Under pool "staged" the harvest is background plus premises
  // RELEASED SO FAR — a misremembering can only confuse entities already met
  // on stage. The pool then grows with the release ledger, so the cache is
  // keyed by released-count (monotone within a run).
  const mutationPoolByPredPos = new Map(); // "pred|pos|epoch" -> sorted constants
  const mutationPool = (pred, pos) => {
    const staged = corruption?.config.pool === 'staged';
    const poolKey = `${pred}|${pos}|${staged ? releasedKeys.size : 'w'}`;
    if (mutationPoolByPredPos.has(poolKey)) return mutationPoolByPredPos.get(poolKey);
    const constants = new Set();
    const harvest = (fact) => {
      if (fact[0] === pred && fact.length > pos) constants.add(fact[pos]);
    };
    for (const premise of world.premiseById.values()) {
      if (staged && !releasedKeys.has(factKey(premise.fact))) continue;
      harvest(premise.fact);
    }
    for (const fact of world.background) harvest(fact);
    const sorted = [...constants].sort();
    mutationPoolByPredPos.set(poolKey, sorted);
    return sorted;
  };
  const mutationCandidates = (fact) => {
    const candidates = [];
    for (let pos = 1; pos < fact.length; pos += 1) {
      for (const constant of mutationPool(fact[0], pos)) {
        if (constant === fact[pos]) continue;
        const candidate = [...fact];
        candidate[pos] = constant;
        const key = factKey(candidate);
        if (grounded.has(key)) continue;
        if (premiseIdByKey.has(key)) continue;
        if (backgroundKeys.has(key)) continue;
        if (key === factKey(world.secret.fact)) continue;
        if (world.mirror && key === factKey(world.mirror.fact)) continue;
        if (isPatternFact(candidate)) continue;
        candidates.push(candidate);
      }
    }
    return candidates;
  };

  // Record first-availability for every derived, non-pattern fact in the
  // closure of the learner's valid board. Returns the closure for reuse.
  const recordAvailability = (turn) => {
    const cl = closure(validGroundedFacts(), world.rules);
    for (const [key, fact] of cl.facts) {
      if (!cl.proofs.get(key)) continue; // base fact
      if (isPatternFact(fact)) continue;
      if (!firstAvailable.has(key)) firstAvailable.set(key, { fact, turn });
    }
    return cl;
  };

  const lastTutorTargets = (n = 2) => {
    const targets = [];
    for (let i = transcript.length - 1; i >= 0 && targets.length < n; i -= 1) {
      if (transcript[i].role !== 'tutor') continue;
      targets.push(transcript[i].meta?.move?.targetPremise || null);
    }
    return targets.filter(Boolean);
  };

  // The inference frontier: derivable, non-base, non-pattern, not-yet-voiced
  // facts with ages and ground premise ids — the raw material of the
  // superego's stall jurisdiction. Computed fresh per view; availability
  // history lives in firstAvailable.
  const computeFrontier = (turn) => {
    const cl = closure(validGroundedFacts(), world.rules);
    const recentTargets = lastTutorTargets(2);
    const items = [];
    for (const [key, fact] of cl.facts) {
      const proof = cl.proofs.get(key);
      if (!proof) continue;
      if (isPatternFact(fact)) continue;
      if (voicedKeys.has(key)) continue;
      const grounds = proof.premises.map((pk) => ({
        fact: cl.facts.get(pk),
        premiseId: premiseIdForKey(pk),
      }));
      const groundPremiseIds = grounds.map((g) => g.premiseId).filter(Boolean);
      const since = firstAvailable.get(key)?.turn ?? turn;
      items.push({
        fact,
        rule: proof.rule,
        grounds,
        groundPremiseIds,
        firstAvailable: since,
        age: turn - since,
        targetedByLast2: groundPremiseIds.some((id) => recentTargets.includes(id)),
      });
    }
    items.sort((a, b) => a.firstAvailable - b.firstAvailable || factKey(a.fact).localeCompare(factKey(b.fact)));
    return items;
  };

  const applyRelease = (turn, premiseId, via, extra = null) => {
    if (!premiseId) return null;
    const premise = world.premiseById.get(premiseId);
    if (!premise || releasedKeys.has(factKey(premise.fact))) return null;
    releasedKeys.add(factKey(premise.fact));
    releasedIdByKey.set(factKey(premise.fact), premiseId);
    releasedAtByKey.set(factKey(premise.fact), turn);
    releasedFacts.push(premise.fact);
    // `extra` (C2 release authority): the tutor's declared reason and the
    // offset from the scheduled turn ride on the ledger row, so adherence
    // instruments read deviation-as-strategy without joining the transcript.
    // Hold turns (nothing played) never reach here — their decision records
    // live only in the tutor transcript meta.
    ledger.push({ turn, premiseId, via, ...(extra || {}) });
    return premise.fact;
  };

  // What the world has staged is not what the learner still holds: a decayed
  // fact vanishes from the learner's view of the released record too —
  // otherwise the learner would trivially re-adopt it from the list each turn
  // and the condition would be a no-op. The transcript prose still carries
  // the staging dialogue; re-deriving the fact from there is a legitimate
  // (and measured) recovery path.
  const visibleToLearner = (facts) =>
    corruption ? facts.filter((fact) => !grounded.get(factKey(fact))?.decayed) : facts;

  const naturalFact = (fact) =>
    Array.isArray(fact) && fact.length
      ? `${String(fact[0])
          .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
          .replace(/[_-]+/g, ' ')
          .toLowerCase()}: ${fact
          .slice(1)
          .map((x) =>
            String(x)
              .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
              .replace(/[_-]+/g, ' ')
              .toLowerCase(),
          )
          .join(', ')}`
      : '';

  const learnerSurfaceForFact = (fact) => {
    const key = factKey(fact);
    const premiseId = releasedIdByKey.get(key) ?? premiseIdByKey.get(key);
    const premise = premiseId ? world.premiseById.get(premiseId) : null;
    return premise?.surface || naturalFact(fact);
  };

  const learnerFactSurfaces = (facts) =>
    Object.fromEntries(facts.map((fact) => [factKey(fact), learnerSurfaceForFact(fact)]));

  const publicStageLine = (entry) => entry.role !== 'director' || entry.meta?.release || entry.meta?.phase?.name;

  const currentProofDebt = (turn) =>
    proofDebtViewActive && corruption
      ? proofDebtReport(world, { grounded, releasedIdByKey, turn })
      : { turn, active: false, dNow: derivationDistance(world, validGroundedFacts()), debts: [] };

  const nextScheduledRelease = (turn) =>
    world.releaseSchedule
      .filter((entry) => !ledger.some((row) => row.premiseId === entry.premise) && entry.turn >= turn)
      .sort((a, b) => a.turn - b.turn)[0] || null;

  const currentProxyDagPacing = (turn, roleName) => {
    const snapshot = buildLearnerDagSnapshot(world, {
      turn,
      boardFacts: learnerBoardFacts(),
      validFacts: validGroundedFacts(),
      voiced: voicedLedger,
      hypotheses,
      ledger,
      source: 'engine_proxy_pacing',
    });
    const learnerDag = buildLearnerDag([snapshot], world);
    const firstReleaseTurn = ledger.length > 0 ? ledger[0].turn : Infinity;
    return deriveProxyDagPacingSignal({
      turn,
      role: roleName,
      assessment: learnerDag.assessment,
      stallType: detectStall(trajectory, world.slope.aporia_window, firstReleaseTurn),
      nextScheduledRelease: nextScheduledRelease(turn),
    });
  };

  const currentTutorLearnerDagModel = (turn, roleName) => {
    const grounded = learnerBoardFacts();
    const voiced = voicedLedger.map((entry) => ({ ...entry }));
    const snapshot = buildLearnerDagSnapshot(world, {
      turn,
      boardFacts: grounded,
      validFacts: validGroundedFacts(),
      voiced,
      hypotheses,
      ledger,
      source: 'engine_tutor_learner_dag_model',
    });
    const learnerDag = buildLearnerDag([snapshot], world);
    const surfaceFacts = [
      ...world.background,
      ...visibleToLearner([...releasedFacts]),
      ...grounded,
      ...voiced.map((entry) => entry.fact),
    ];
    const factSurfaces = learnerFactSurfaces(surfaceFacts);
    const proxyDagMemory = buildLearnerProxyDagMemory({
      turn,
      questionPattern: world.questionPattern,
      rules: world.rules,
      groundedFacts: grounded,
      voiced,
      hypotheses,
      factSurface: (fact) => factSurfaces[factKey(fact)] || learnerSurfaceForFact(fact),
    });
    return buildTutorLearnerDagModel({
      turn,
      role: roleName,
      proxyDagMemory,
      assessment: learnerDag.assessment,
    });
  };

  const currentFieldPlanner = (turn) => {
    const snapshot = buildLearnerDagSnapshot(world, {
      turn,
      boardFacts: learnerBoardFacts(),
      validFacts: validGroundedFacts(),
      voiced: voicedLedger,
      hypotheses,
      ledger,
      source: 'engine_field_planner',
    });
    const snapshots = [...learnerDagSnapshots.filter((row) => Number(row.turn) < Number(turn)), snapshot];
    const learnerDag = buildLearnerDag(snapshots, world);
    const learnerField = buildDynamicLearnerField(world, learnerDag);
    const resultLike = {
      worldId: world.id,
      events: [...events],
      trajectory: [...trajectory],
      transcript: [...transcript],
      ledger: [...ledger],
      firstForcedTurn,
      assertedGroundedTurn,
      turnsPlayed: Math.max(0, turn - 1),
      learnerDag,
    };
    const interactionField = buildPedagogicalInteractionField(world, resultLike, { learnerField });
    return selectFieldPlannerMove({
      world,
      turn,
      interactionField,
      learnerField,
      nextScheduledRelease: nextScheduledRelease(turn),
      canAssertFinal: entails(validGroundedFacts(), world.rules, world.secret.fact),
      proofDebt: currentProofDebt(turn),
    });
  };

  const openSceneForTurn = (turn, reason = 'opening') => {
    if (!sceneConfig || sceneState) return null;
    const dNow = derivationDistance(world, validGroundedFacts());
    const debt = currentProofDebt(turn).debts?.[0] || null;
    const frontier = computeFrontier(turn)[0] || null;
    const nextRelease = nextScheduledRelease(turn);
    const targetPremise = debt?.premiseId || frontier?.groundPremiseIds?.[0] || nextRelease?.premise || null;
    const targetFact = frontier?.fact || (targetPremise ? world.premiseById.get(targetPremise)?.fact || null : null);
    const goal = debt
      ? `Repair proof debt on ${debt.premiseId} before new work.`
      : frontier
        ? `Bring the learner to voice a waiting local conclusion from ${frontier.groundPremiseIds.join(', ') || 'the current board'}.`
        : nextRelease
          ? `Prepare or seat ${nextRelease.premise} without forcing the concealed answer.`
          : 'Keep the inquiry socially live while locating the next proof obligation.';
    sceneState = openScene({
      index: sceneRows.length + 1,
      turn,
      dNow,
      targetPremise,
      targetFact,
      goal,
      reason,
    });
    events.push({ turn, type: 'scene_open', detail: `scene ${sceneState.index}: ${sceneState.goal}` });
    return sceneState;
  };

  const unreleasedScheduledThisTurn = (turn) =>
    world.releaseSchedule.filter(
      (entry) => entry.turn === turn && !ledger.some((row) => row.premiseId === entry.premise),
    );

  const selectSceneTempoForTurn = (turn) => {
    if (!sceneState || !sceneConfig?.tempo) return null;
    return recommendSceneTempoBeat(
      world,
      sceneState,
      {
        turn,
        dNow: derivationDistance(world, validGroundedFacts()),
        releaseDue: unreleasedScheduledThisTurn(turn).length > 0,
        maxPhaticExchanges: sceneConfig.maxPhaticExchanges,
        recognitionNeed: sceneRecognitionNeedThisTurn,
      },
      sceneConfig.tempo,
    );
  };

  const selectSceneRecognitionNeedForTurn = () =>
    sceneConfig?.recognitionNeed !== false && sceneState
      ? applyRecognitionNeedPolicy(
          estimateRecognitionNeed(sceneState, {
            forced: entails(validGroundedFacts(), world.rules, world.secret.fact),
          }),
          sceneState,
          {
            policy: sceneConfig.recognitionNeed,
            forced: entails(validGroundedFacts(), world.rules, world.secret.fact),
          },
        )
      : null;

  const currentSceneView = () =>
    sceneState ? sceneView(sceneState, sceneTempoThisTurn, sceneRecognitionNeedThisTurn) : null;
  const currentSceneMeta = () =>
    sceneState ? sceneMeta(sceneState, sceneTempoThisTurn, sceneRecognitionNeedThisTurn) : null;
  const didacticFallbackForAct = (actIndex, startTurn, endTurn) => {
    const rows = didacticModeRows.filter((row) => row.act === actIndex && row.turn >= startTurn && row.turn <= endTurn);
    if (!rows.length) return null;
    const strainedSignals = new Set(['stalled', 'echo_only', 'misapplied', 'overloaded', 'purpose_gap']);
    let selected = null;
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (rows[i].scope === 'act' || rows[i].scope === 'next_act') {
        selected = rows[i];
        break;
      }
      if (!selected && strainedSignals.has(rows[i].learningSignal)) selected = rows[i];
    }
    if (!selected) return null;
    return {
      schema: DIDACTIC_ACT_FALLBACK_SCHEMA,
      publicOnly: true,
      mayOverrideProofControl: false,
      sourceAct: actIndex,
      sourceTurn: selected.turn,
      learningSignal: selected.learningSignal,
      recommendedMode: selected.recommendedMode,
      currentObject: selected.currentObject || null,
      exitCondition: selected.exitCondition || null,
      evidence: Array.isArray(selected.evidence) ? selected.evidence.slice(0, 3) : [],
    };
  };

  const shouldCallDirector = (turn, openedScene) => {
    if (acts) return true;
    if (directorCadence === 'turn') return true;
    const releaseDue = unreleasedScheduledThisTurn(turn).length > 0;
    if (directorCadence === 'release') return releaseDue;
    return Boolean(openedScene) || releaseDue;
  };

  const decayedPremiseIds = () =>
    [...grounded.entries()]
      .filter(([, entry]) => entry.decayed)
      .map(([key]) => premiseIdForKey(key))
      .filter(Boolean)
      .sort();

  const groundedPremiseIds = () =>
    validGroundedFacts()
      .map((fact) => premiseIdForKey(factKey(fact)))
      .filter(Boolean)
      .sort();

  const recordLogicSnapshot = (turn, { trajectoryD, forced }) => {
    if (!logicProjectionActive) return;
    const valid = validGroundedFacts();
    const releasedPremiseIds = ledger.map((entry) => entry.premiseId);
    const projection = projectWorldIRLogic(worldIR, {
      groundedFacts: valid,
      voicedFacts: voicedLedger.map((entry) => entry.fact),
      releasedPremiseIds,
      decayedPremiseIds: decayedPremiseIds(),
    });
    logicSnapshots.push({
      turn,
      trajectoryD,
      boardD: derivationDistance(world, valid),
      forced,
      groundedPremiseIds: groundedPremiseIds(),
      releasedPremiseIds,
      decayedPremiseIds: decayedPremiseIds(),
      projection,
    });
  };

  // Strategy-ledger projection for the tutor bridge: current block, blocked
  // modes, live opportunity counters, the applied commitment, and the sealed
  // record of the last closed scene (what the boundary audit reads). All
  // public-only — nothing here names hidden proof state.
  const strategyLedgerView = () => ({
    block: ledgerState.block
      ? {
          index: ledgerState.block.index,
          type: ledgerState.block.type,
          openedTurn: ledgerState.block.openedTurn,
          turns: ledgerState.block.turns,
          heldMode: ledgerState.block.heldMode,
          exitCondition: ledgerState.block.exitCondition,
        }
      : null,
    blockedModes: [...ledgerState.blockedModes],
    budget: {
      context: ledgerState.budget.context,
      currentProofNeutralTutorTurns: ledgerState.budget.currentProofNeutralTutorTurns,
      maxProofNeutralTutorTurns: ledgerState.budget.maxProofNeutralTutorTurns,
      currentProofNeutralLearnerTurns: ledgerState.budget.currentProofNeutralLearnerTurns,
      maxProofNeutralLearnerTurns: ledgerState.budget.maxProofNeutralLearnerTurns,
      exhausted: auditOpportunityCost(ledgerState.budget, { actor: 'tutor', conduct: 'advisory_probe' }).blocked,
    },
    lastClosedScene: lastClosedSceneSummary,
    commitment: ledgerState.appliedCommitment,
    config: {
      maxBlockTurns: ledgerState.config.maxBlockTurns,
      registerPalette: ledgerState.config.registerPalette,
      trialling: ledgerState.config.trialling,
      stancePalette: ledgerState.config.stancePalette,
      releaseIntent: ledgerState.config.releaseIntent,
      planMode: ledgerState.config.planMode,
    },
    // v2: the mechanism history table (public-only), most recent last,
    // capped so the prompt block stays bounded.
    ...(ledgerState.config.trialling
      ? {
          history: ledgerState.history.slice(-6).map((entry) => ({ ...entry })),
          departuresThisScene: ledgerState.departuresThisScene,
        }
      : {}),
  });

  // Stage v2 bounding (header): in acts mode the learner's context is (a) its
  // own theory store and (b) the current act only — prior acts' prose,
  // releases, and voiced theorems drop from view; the theory is the only
  // thing that crosses an act boundary. Hypotheses stay unbounded by design
  // (the learner's own conjectural thread, not staged evidence). The board
  // shown is the BELIEF board: mutation-born false axioms are visible (the
  // learner believes them); fabrications stay invisible, as in v1.
  const learnerView = (turn, releasedThisTurn) => {
    const background = world.background;
    const visibleReleasedFacts = visibleToLearner(
      actState
        ? releasedFacts.filter((fact) => (releasedAtByKey.get(factKey(fact)) ?? 0) >= actState.startTurn)
        : [...releasedFacts],
    );
    const releasedThisTurnVisible = visibleToLearner(releasedThisTurn);
    const grounded = learnerBoardFacts();
    const voiced = voicedLedger
      .filter((entry) => !actState || entry.turn >= actState.startTurn)
      .map((entry) => ({ ...entry }));
    const surfaceFacts = [
      ...background,
      ...visibleReleasedFacts,
      ...releasedThisTurnVisible,
      ...grounded,
      ...voiced.map((entry) => entry.fact),
    ];
    const factSurfaces = learnerFactSurfaces(surfaceFacts);
    // Mirror-refusal payload (concealment-safe by construction): present only
    // while unfired AND evidence incompatible with the mirror is derivable
    // from the learner's OWN grounded record. The cited grounds are the
    // proof-tree BASE facts of the incompatible partner — every one a fact
    // the learner has themselves grounded; the derived conclusion is never
    // named (the stall-watcher's charter-v3 discipline, learner-side).
    const mirrorRefusal = (() => {
      if (!learnerMirrorRefusalConfig || !world.mirror || mirrorRefusalState.fired) return null;
      const mirrorKey = factKey(world.mirror.fact);
      const cl = closure(grounded, world.rules);
      const partnerKeys = (world.incompatible || [])
        .filter((pair) => pair.some((f) => factKey(f) === mirrorKey))
        .map((pair) => pair.find((f) => factKey(f) !== mirrorKey))
        .filter((f) => f && cl.facts.has(factKey(f)))
        .map((f) => factKey(f));
      const groundKeys = new Set();
      for (const pk of partnerKeys) {
        const stack = [pk];
        while (stack.length) {
          const key = stack.pop();
          const proof = cl.proofs.get(key);
          if (!proof) {
            groundKeys.add(key);
            continue;
          }
          for (const prem of proof.premises) stack.push(prem);
        }
      }
      const grounds = grounded
        .filter((fact) => groundKeys.has(factKey(fact)))
        .map((fact) => factSurfaces[factKey(fact)] || learnerSurfaceForFact(fact));
      // Real runs: the payload exists only while the window is live (the
      // refusal trigger guards on grounds). Mock runs: emit the mock fields
      // pre-window too — the mock learner voices the mirror instead of
      // insta-asserting the true answer, so a zero-paid run can REACH the
      // window at all (start-of-turn derivability has zero width under the
      // mock's same-turn assertion pace).
      if (!grounds.length && !learnerMirrorRefusalConfig.mock) return null;
      const varIndex = world.questionPattern.findIndex((tok) => typeof tok === 'string' && tok.startsWith('?'));
      return {
        mirrorKey,
        mirrorSurface: String(world.mirror.fact[varIndex] ?? world.mirror.fact[world.mirror.fact.length - 1]),
        grounds,
        ...(learnerMirrorRefusalConfig.mock
          ? {
              mock: learnerMirrorRefusalConfig.mock,
              mockAnswer: String(world.mirror.fact[varIndex] ?? ''),
            }
          : {}),
      };
    })();
    const proxyDagMemory = opts.learnerProxyDag
      ? buildLearnerProxyDagMemory({
          turn,
          questionPattern: world.questionPattern,
          rules: world.rules,
          groundedFacts: grounded,
          voiced,
          hypotheses,
          factSurface: (fact) => factSurfaces[factKey(fact)] || learnerSurfaceForFact(fact),
        })
      : null;
    // Live character arc (§8 open item): public-safe disposition stance for THIS
    // turn, computed engine-side from world.motivation + the learner's held
    // facts. Leak-safe — only levels + a mirror-named stance line cross over.
    const characterArc = opts.characterArc ? buildLearnerCharacterArcView(world, grounded) : null;
    return {
      turn,
      question: world.question,
      questionPattern: world.questionPattern,
      rules: world.rules,
      background,
      // Lemma mirror (symmetry): the learner's own map, computed from their
      // grounded assertions only — pre-rendered so concealment lives in one
      // place (renderLearnerLemmaLines).
      ...(lemmaRun ? { lemmaLayer: lemmaView('learner') } : {}),
      ...(mirrorRefusal ? { mirrorRefusal } : {}),
      releasedFacts: visibleReleasedFacts,
      releasedThisTurn: releasedThisTurnVisible,
      factSurfaces,
      transcript: transcript
        .filter((entry) => (!actState || entry.turn >= actState.startTurn) && publicStageLine(entry))
        .map(({ turn: t, role, text }) => ({ turn: t, role: role === 'director' ? 'stage' : role, text })),
      abox: {
        grounded,
        hypotheses: [...hypotheses],
      },
      voiced,
      ...(proxyDagMemory ? { proxyDagMemory } : {}),
      ...(characterArc ? { characterArc } : {}),
      ...(actState ? { act: { index: actState.index, startTurn: actState.startTurn, brief: actState.brief } } : {}),
      ...(sceneState ? { scene: currentSceneView() } : {}),
      ...(stagePrologue ? { stagePrologue } : {}),
      // Learner-ledger boundary material: the sealed last scene (public-only,
      // and act-bounded — a scene sealed before this act's start stays gone,
      // like everything else across the boundary).
      ...(learnerLedgerActive &&
      lastClosedSceneSummary &&
      (!actState || lastClosedSceneSummary.endTurn >= actState.startTurn)
        ? { lastClosedScene: lastClosedSceneSummary }
        : {}),
      publicRegister: publicRegisterForTurn,
    };
  };

  const actsView = (turn) => ({
    index: actState.index,
    startTurn: actState.startTurn,
    brief: actState.brief,
    turnsThisAct: turn - actState.startTurn,
    minActTurns: acts.minActTurns,
    maxActTurns: acts.maxActTurns,
    closed: actState.history.map((a) => ({ ...a })),
  });

  // Lemma-layer per-turn clearance (criterial: the chainer over the valid
  // grounded board; under decay a lemma can UN-ground and the frontier moves
  // backward — recorded, never judged).
  const refreshLemmaState = (turn) => {
    if (!lemmaRun) return;
    const state = computeLemmaState(lemmaDag, validGroundedFacts(), world.rules);
    for (const node of lemmaDag.nodes) {
      const now = state.groundedKeys.has(node.key);
      const before = lemmaRun.grounded.has(node.key);
      if (now && !before) {
        if (!lemmaRun.clearedAt.has(node.label)) lemmaRun.clearedAt.set(node.label, turn);
        events.push({ turn, type: 'lemma_grounded', detail: node.label });
        if (lemmaRun.active?.key === node.key) {
          events.push({ turn, type: 'lemma_cleared', detail: `active lemma ${node.label} grounded` });
        }
      } else if (!now && before) {
        lemmaRun.regressions.push({ turn, label: node.label });
        events.push({ turn, type: 'lemma_regressed', detail: node.label });
      }
    }
    lemmaRun.grounded = state.groundedKeys;
    lemmaRun.frontier = state.frontier;
    // A grounded active lemma binds nothing sensible: advance to the sole
    // frontier element, or unbind until the next scene-opening choice.
    if (lemmaRun.active && lemmaRun.grounded.has(lemmaRun.active.key)) {
      const next = lemmaRun.frontier.length === 1 ? lemmaDag.byKey.get(lemmaRun.frontier[0]) : null;
      lemmaRun.active = next
        ? { key: next.key, label: next.label, by: 'auto_advance', sceneIndex: sceneState?.index ?? null, turn }
        : null;
      if (next) {
        lemmaRun.choices.push({ turn, label: next.label, by: 'auto_advance' });
        events.push({ turn, type: 'lemma_choice', detail: `${next.label} (auto_advance)` });
      }
    }
  };

  const lemmaStateShape = () => ({
    groundedKeys: lemmaRun.grounded,
    frontier: lemmaRun.frontier,
    goalGrounded: lemmaRun.grounded.has(lemmaDag.goalKey),
  });

  // Stall span since the active lemma was chosen: consecutive trailing
  // trajectory steps with no strict D decrease (the house clock's own
  // arithmetic, detectStall), counted only over turns at/after the pick.
  const lemmaStallSpanSinceActive = () => {
    if (!lemmaRun?.active) return 0;
    let span = 0;
    for (let i = trajectory.length - 1; i > 0; i--) {
      if (trajectory[i].turn < lemmaRun.active.turn) break;
      if (trajectory[i].D < trajectory[i - 1].D) break;
      span++;
    }
    return span;
  };

  const lemmaView = (roleName) => {
    if (!lemmaRun) return null;
    if (roleName === 'learner') {
      return { mirrorLines: renderLearnerLemmaLines(lemmaDag, lemmaStateShape()) };
    }
    if (roleName !== 'tutor') return null;
    const releasedIds = new Set(ledger.map((row) => row.premiseId));
    return {
      config: { ...lemmaConfig },
      tutorLines: renderTutorLemmaLines(lemmaDag, lemmaStateShape(), lemmaRun.active?.key || null, {
        bind: lemmaConfig.bind,
      }),
      proofPremiseIds: [...lemmaDag.proofPremiseIds],
      activeKey: lemmaRun.active?.key || null,
      activeLabel: lemmaRun.active?.label || null,
      stallWindow: world.slope.aporia_window,
      stallSpanSinceActive: lemmaStallSpanSinceActive(),
      regressionsSinceActive: lemmaRun.active
        ? lemmaRun.regressions
            .filter((r) => r.turn >= lemmaRun.active.turn)
            .map((r) => ({ turn: r.turn, label: r.label }))
        : [],
      activeSupportRemaining: lemmaRun.active ? lemmaSupportRemaining(lemmaDag, lemmaRun.active.key, releasedIds) : [],
      frontier: lemmaRun.frontier.map((key) => {
        const node = lemmaDag.byKey.get(key);
        return {
          key,
          label: node.label,
          support: [...node.support],
          supportRemaining: lemmaSupportRemaining(lemmaDag, key, releasedIds),
        };
      }),
    };
  };

  const omniscientView = (turn, roleName) => {
    const proofDebt = roleName === 'tutor' && proofDebtViewActive ? currentProofDebt(turn) : null;
    const proxyDagPacing =
      opts.proxyDagPacing && (roleName === 'director' || (roleName === 'tutor' && !actState))
        ? currentProxyDagPacing(turn, roleName)
        : null;
    const tutorLearnerDagModel =
      opts.tutorLearnerDag && roleName === 'tutor' && !actState ? currentTutorLearnerDagModel(turn, roleName) : null;
    const fieldPlanner =
      fieldPlannerActive && roleName === 'tutor' && !actState ? currentFieldPlanner(turn, roleName) : null;
    const conductTriggerOverride =
      roleName === 'tutor' && (conductPolicyActive || conductPolicyEnforceActive)
        ? conductTriggerOverrides.find((trigger) => Number(trigger?.turn) === turn) || null
        : null;
    const conductEntitlement =
      roleName === 'tutor' && (conductPolicyActive || conductPolicyEnforceActive)
        ? { canAssertFinal: entails(validGroundedFacts(), world.rules, world.secret.fact) }
        : null;
    const base = {
      turn,
      role: roleName,
      world,
      ledger: [...ledger],
      releasedFacts: [...releasedFacts],
      transcript: [...transcript],
      staging: { phase: staging.phase },
      ...(actState ? { acts: actsView(turn) } : {}),
      ...(sceneState ? { scene: currentSceneView() } : {}),
      ...(stagePrologue ? { stagePrologue } : {}),
      publicRegister: publicRegisterForTurn,
      ...(proxyDagPacing ? { proxyDagPacing } : {}),
      ...(tutorLearnerDagModel ? { tutorLearnerDagModel } : {}),
      ...(fieldPlanner ? { fieldPlanner } : {}),
      ...(conductEntitlement ? { conductEntitlement } : {}),
      ...(conductTriggerOverride ? { conductTriggerOverride } : {}),
      ...(ledgerState && roleName === 'tutor' ? { strategyLedger: strategyLedgerView() } : {}),
      ...(lemmaRun && roleName === 'tutor' ? { lemmaLayer: lemmaView('tutor') } : {}),
      ...(proofDebt
        ? { proofDebt: runtimeMonitor ? runtimeMonitor.proofDebtTutorView(proofDebt) : tutorProofDebtView(proofDebt) }
        : {}),
    };
    // Stage v2 redaction (header): in acts mode the TUTOR's blindness is
    // total and structural, in both probe arms — no learner store, no
    // corruption ledger, no frontier or trajectory (each is computed FROM
    // the hidden store and would leak decay as deltas). The tutor works from
    // the dialogue and its own release ledger; reconstruction is its job,
    // not its input.
    if (actState && roleName === 'tutor') return base;
    return {
      ...base,
      trajectory: [...trajectory],
      // The director keeps its evaluative instruments (it must judge an
      // act's work done — that IS board movement) but in acts mode loses the
      // store dump: its briefs open acts in front of the tutor, so they must
      // not be able to name what only the hidden board could tell it.
      learnerAbox:
        actState && roleName === 'director'
          ? { groundedCount: validGroundedFacts().length, hypotheses: [...hypotheses] }
          : {
              grounded: validGroundedFacts(),
              hypotheses: [...hypotheses],
            },
      inference: {
        frontier: computeFrontier(turn),
        voiced: voicedLedger.map((entry) => ({ ...entry })),
        overreachCount: overreaches.length,
      },
      // v1 visibility: world-side roles read the corruption ground truth (the
      // harness owns what was lost and when). Acts mode strips it from the
      // director too — slip identities must not reach the stage through a
      // brief. Outside acts mode this block is what the told arm reads.
      ...(corruption && !actState
        ? {
            corruption: {
              decayed: [...grounded.entries()]
                .filter(([, entry]) => entry.decayed)
                .map(([key, entry]) => ({
                  premiseId: premiseIdForKey(key),
                  fact: entry.fact,
                  sinceTurn: entry.decayTurn,
                })),
              ledger: corruption.ledger.map((e) => ({ ...e })),
            },
          }
        : {}),
    };
  };

  recordAvailability(0); // background-only board may already yield derivations
  if (stagePrologueEnabled) {
    const prologueView = {
      turn: 0,
      role: 'director',
      world,
      ledger: [],
      releasedFacts: [],
      transcript: [],
      staging: { phase: null },
      trajectory: [],
      learnerAbox: { grounded: validGroundedFacts(), hypotheses: [] },
      inference: { frontier: computeFrontier(0), voiced: [], overreachCount: 0 },
      publicRegister: publicRegisterForTurn,
    };
    const rawPrologue =
      typeof roles.director.prologue === 'function'
        ? await roles.director.prologue(prologueView)
        : normalizeStagePrologue(null, world);
    stagePrologue = normalizeStagePrologue(rawPrologue, world);
    transcript.push({
      turn: 0,
      role: 'director',
      text: stagePrologue.stageNotes,
      meta: {
        prologue: stagePrologue,
        publicRegister: publicRegisterForTurn,
      },
    });
  }
  const turnLimit = Math.min(world.turnCap, Number.isFinite(opts.maxTurns) ? opts.maxTurns : Infinity);
  let turn = 0;
  while (turn < turnLimit && !endedBy) {
    turn += 1;
    const releasedThisTurn = [];
    const openedScene = openSceneForTurn(turn, turn === 1 ? 'opening' : 'continuation');
    refreshLemmaState(turn);
    if (lemmaRun && lemmaConfig.bind && openedScene) {
      lemmaRun.openings += 1;
      if (lemmaRun.frontier.length > 1) lemmaRun.multiFrontierOpenings += 1;
    }
    sceneRecognitionNeedThisTurn = selectSceneRecognitionNeedForTurn();
    sceneTempoThisTurn = selectSceneTempoForTurn(turn);
    const sceneMetaThisTurn = currentSceneMeta();

    // --- director ---
    const callDirector = shouldCallDirector(turn, openedScene);
    const directorView = omniscientView(turn, 'director');
    if (directorView.proxyDagPacing) proxyDagPacingRows.push({ ...directorView.proxyDagPacing });
    const directorOut = callDirector ? (await roles.director(directorView)) || {} : {};
    const directorRelease = applyRelease(turn, directorOut.release, 'director');
    if (directorRelease) releasedThisTurn.push(directorRelease);
    if (directorRelease && lemmaRun && lemmaConfig.bind) {
      // Director releases are the Big Other's calendar, never the tutor's
      // choice: binding does not touch them, but out-of-support ones are on
      // the record.
      const cls = classifyLemmaRelease(lemmaDag, lemmaRun.active?.key || null, directorOut.release);
      if (cls === 'out_of_support') {
        lemmaRun.passthroughs.push({ turn, premise: directorOut.release, by: 'director' });
        events.push({ turn, type: 'lemma_passthrough', detail: `${directorOut.release} (director)` });
      }
    }
    if (actState) {
      // The act verdict (stage v2, header). Turn 1's direction is Act 1's
      // brief; afterwards {act:'end', direction} closes the act at turn-1 and
      // opens the next with the direction as its strategic brief. Guards: an
      // end below minActTurns is overridden (act_min_blocked); an act at
      // maxActTurns is force-closed (harness_max). The synthesized `Act N`
      // phase keeps every phase-reading instrument working unchanged;
      // directorOut.phase is ignored in acts mode.
      const turnsThisAct = turn - actState.startTurn;
      if (turn === 1) {
        actState.brief = (directorOut.direction || '').trim();
        staging.phase = { name: 'Act 1', intent: actState.brief, turn };
      } else {
        const wantsEnd = directorOut.act === 'end';
        const mustEnd = turnsThisAct >= acts.maxActTurns;
        if (wantsEnd && turnsThisAct < acts.minActTurns) {
          events.push({
            turn,
            type: 'act_min_blocked',
            detail: `director end of act ${actState.index} overridden at ${turnsThisAct} turns (min ${acts.minActTurns})`,
          });
        } else if (wantsEnd || mustEnd) {
          const direction = (directorOut.direction || '').trim() || '[The act turns.]';
          const endedByAct = wantsEnd ? 'director' : 'harness_max';
          const didacticFallback = didacticFallbackForAct(actState.index, actState.startTurn, turn - 1);
          actState.history.push({
            act: actState.index,
            turns: [actState.startTurn, turn - 1],
            endedBy: endedByAct,
            brief: actState.brief,
            ...(didacticFallback ? { didacticFallback } : {}),
          });
          events.push({
            turn,
            type: 'act_end',
            detail: `act ${actState.index} closed (${endedByAct}) after ${turnsThisAct} turns`,
          });
          actState.index += 1;
          actState.startTurn = turn;
          actState.brief = direction;
          staging.phase = { name: `Act ${actState.index}`, intent: direction, turn };
        }
      }
    } else if (directorOut.phase && typeof directorOut.phase.name === 'string' && directorOut.phase.name.trim()) {
      staging.phase = {
        name: directorOut.phase.name.trim(),
        intent: typeof directorOut.phase.intent === 'string' ? directorOut.phase.intent.trim() : '',
        turn,
      };
    }
    if (callDirector || directorOut.release || (staging.phase && staging.phase.turn === turn)) {
      transcript.push({
        turn,
        role: 'director',
        text: directorOut.direction || '',
        meta: {
          release: directorOut.release || null,
          phase: staging.phase && staging.phase.turn === turn ? { ...staging.phase } : null,
          ...(actState ? { act: directorOut.act || null } : {}),
          ...(sceneMetaThisTurn ? { scene: sceneMetaThisTurn } : {}),
          ...(directorView.proxyDagPacing ? { proxyDagPacing: directorView.proxyDagPacing } : {}),
          publicRegister: publicRegisterForTurn,
        },
      });
    }

    // --- tutor ---
    const tutorView = omniscientView(turn, 'tutor');
    if (tutorView.proxyDagPacing) proxyDagPacingRows.push({ ...tutorView.proxyDagPacing });
    if (tutorView.tutorLearnerDagModel) tutorLearnerDagRows.push({ ...tutorView.tutorLearnerDagModel });
    let fieldPlannerRow = null;
    const debtAudit = proofDebtGuardActive ? currentProofDebt(turn) : null;
    if (debtAudit?.active) {
      proofDebtRows.push({
        turn,
        dNow: debtAudit.dNow,
        debts: debtAudit.debts.map(({ premiseId, sinceTurn, dIfRestored, deltaD, closesProof }) => ({
          premiseId,
          sinceTurn,
          dIfRestored,
          deltaD,
          closesProof,
        })),
      });
    }
    const tutorOut = (await roles.tutor(tutorView)) || {};
    if (tutorOut.fieldPlanner || tutorView.fieldPlanner) {
      const planner = tutorOut.fieldPlanner || tutorView.fieldPlanner;
      fieldPlannerRow = {
        turn,
        schema: planner.schema,
        selectedMoveFamily: planner.selectedMoveFamily || null,
        reasonCode: planner.reasonCode || null,
        rationale: planner.rationale || null,
        targetPremise: planner.targetPremise || null,
        targetSurface: planner.targetSurface || null,
        didacticMode: planner.didacticMode
          ? {
              recommendedMode: planner.didacticMode.recommendedMode || null,
              learningSignal: planner.didacticMode.learningSignal || null,
              currentObject: planner.didacticMode.currentObject || null,
            }
          : null,
        scriptStage: planner.scriptStage || null,
        jointAttractor: planner.jointAttractor || null,
        metrics: planner.metrics || null,
        conductDecision: planner.conductDecision
          ? {
              selectedMoveFamily: planner.conductDecision.selectedMoveFamily || null,
              reasonCode: planner.conductDecision.reasonCode || null,
              targetPremise: planner.conductDecision.targetPremise || null,
              nonLeakAuditOk: planner.conductDecision.nonLeakAudit?.ok === true,
            }
          : null,
        enforcementRequested: fieldPlannerEnforceActive,
        realizedMove: tutorOut.move || null,
        realizedRelease: tutorOut.release || null,
        conductPolicy: tutorOut.conductPolicy
          ? {
              selectedMoveFamily: tutorOut.conductPolicy.selectedMoveFamily || null,
              reasonCode: tutorOut.conductPolicy.reasonCode || null,
              enforcement: tutorOut.conductPolicy.enforcement || null,
            }
          : null,
      };
      fieldPlannerRows.push(fieldPlannerRow);
    }
    const tutorRelease = applyRelease(
      turn,
      tutorOut.release,
      'tutor',
      tutorOut.releaseDecision
        ? { reason: tutorOut.releaseReason || null, offset: tutorOut.releaseDecision.offset ?? null }
        : null,
    );
    if (tutorRelease) releasedThisTurn.push(tutorRelease);
    if (lemmaRun && tutorOut.lemma) {
      // The bridge adjudicated (choice validation, departure tagging, blocks);
      // the engine records and applies — the plot pattern.
      const lm = tutorOut.lemma;
      if (lm.choice) {
        lemmaRun.active = {
          key: lm.choice.key,
          label: lm.choice.label,
          by: lm.choice.by,
          sceneIndex: sceneState?.index ?? null,
          turn,
        };
        lemmaRun.choices.push({ turn, ...lm.choice });
        if (['tutor', 'tutor_retry', 'delegate'].includes(lm.choice.by) && lemmaRun.frontier.length > 1)
          lemmaRun.tutorChoices += 1;
        events.push({ turn, type: 'lemma_choice', detail: `${lm.choice.label} (${lm.choice.by})` });
      }
      if (lm.departure) {
        lemmaRun.departures.push({ turn, premise: lm.departure.premise, reason: lm.departure.reason });
        events.push({ turn, type: 'lemma_departure', detail: `${lm.departure.premise}: ${lm.departure.reason}` });
      }
      if (lm.blocked) {
        lemmaRun.blocks.push({ turn, premise: lm.blocked.premise });
        events.push({ turn, type: 'lemma_block', detail: `${lm.blocked.premise} held (untagged departure)` });
      }
      if (lm.forcedPassthrough) {
        lemmaRun.passthroughs.push({ turn, premise: lm.forcedPassthrough.premise, by: lm.forcedPassthrough.by });
        events.push({
          turn,
          type: 'lemma_passthrough',
          detail: `${lm.forcedPassthrough.premise} (${lm.forcedPassthrough.by})`,
        });
      }
    }
    const tutorPhaticRecognition = detectPhaticRecognition(tutorOut.dialogue || '', {
      role: 'tutor',
      tempo: sceneTempoThisTurn,
    });
    transcript.push({
      turn,
      role: 'tutor',
      text: tutorOut.dialogue || '',
      meta: {
        move: tutorOut.move || null,
        release: tutorOut.release || null,
        deliberation: tutorOut.deliberation || null,
        ...(tutorOut.releaseDecision ? { releaseDecision: tutorOut.releaseDecision } : {}),
        ...(tutorOut.releaseReason ? { releaseReason: tutorOut.releaseReason } : {}),
        ...(tutorOut.theory ? { theory: tutorOut.theory } : {}),
        ...(tutorOut.plot ? { plot: tutorOut.plot } : {}),
        ...(tutorOut.plotAudit ? { plotAudit: tutorOut.plotAudit } : {}),
        ...(tutorOut.throughline ? { throughline: tutorOut.throughline } : {}),
        ...(tutorOut.proofDebt ? { proofDebt: tutorOut.proofDebt } : {}),
        ...(tutorOut.conductPolicy ? { conductPolicy: tutorOut.conductPolicy } : {}),
        ...(tutorOut.rhetoricalPolicy ? { rhetoricalPolicy: tutorOut.rhetoricalPolicy } : {}),
        ...(tutorOut.discursiveCalibration ? { discursiveCalibration: tutorOut.discursiveCalibration } : {}),
        ...(tutorOut.didacticMode ? { didacticMode: tutorOut.didacticMode } : {}),
        ...(tutorOut.fieldPlanner || tutorView.fieldPlanner
          ? { fieldPlanner: tutorOut.fieldPlanner || tutorView.fieldPlanner }
          : {}),
        ...(tutorOut.learnerTransformation ? { learnerTransformation: tutorOut.learnerTransformation } : {}),
        ...(tutorOut.castState ? { castState: tutorOut.castState } : {}),
        ...(tutorOut.tutorReinvention ? { tutorReinvention: tutorOut.tutorReinvention } : {}),
        ...(tutorPhaticRecognition.length ? { phaticRecognition: tutorPhaticRecognition } : {}),
        ...(sceneMetaThisTurn ? { scene: sceneMetaThisTurn } : {}),
        ...(tutorView.proxyDagPacing ? { proxyDagPacing: tutorView.proxyDagPacing } : {}),
        publicRegister: publicRegisterForTurn,
      },
    });
    if (tutorOut.didacticMode) {
      didacticModeRows.push({
        turn,
        ...(actState ? { act: actState.index } : {}),
        schema: tutorOut.didacticMode.schema,
        publicOnly: tutorOut.didacticMode.publicOnly,
        mayOverrideProofControl: tutorOut.didacticMode.mayOverrideProofControl,
        currentObject: tutorOut.didacticMode.currentObject || null,
        learningSignal: tutorOut.didacticMode.learningSignal || null,
        recommendedMode: tutorOut.didacticMode.recommendedMode || null,
        scope: tutorOut.didacticMode.scope || null,
        exitCondition: tutorOut.didacticMode.exitCondition || null,
        ...(tutorOut.didacticMode.opportunityCost
          ? {
              opportunityCost: {
                maxProofNeutralTurns: tutorOut.didacticMode.opportunityCost.maxProofNeutralTurns,
                failureAction: tutorOut.didacticMode.opportunityCost.failureAction,
                proofObligationPreserved: tutorOut.didacticMode.opportunityCost.proofObligationPreserved === true,
              },
            }
          : {}),
        evidence: Array.isArray(tutorOut.didacticMode.evidence) ? tutorOut.didacticMode.evidence.slice(0, 4) : [],
        inputAuditOk: tutorOut.didacticMode.inputAudit?.ok === true,
        nonLeakAuditOk: tutorOut.didacticMode.nonLeakAudit?.ok === true,
      });
    }
    if (tutorOut.castState) {
      castLayerRows.push({
        turn,
        ...(actState ? { act: actState.index } : {}),
        schema: tutorOut.castState.schema,
        publicOnly: tutorOut.castState.publicOnly === true,
        mayOverrideProofControl: tutorOut.castState.mayOverrideProofControl === true,
        tutorRole: tutorOut.castState.tutor?.stableRole || null,
        tutorStance: tutorOut.castState.tutor?.currentStance || null,
        learnerRole: tutorOut.castState.learner?.stableRole || null,
        learnerPosture: tutorOut.castState.learner?.currentPosture || null,
        relationTrust: tutorOut.castState.relation?.currentTrust || null,
        reinvention: tutorOut.castState.reinvention
          ? {
              schema: tutorOut.castState.reinvention.schema,
              active: tutorOut.castState.reinvention.active === true,
              trigger: tutorOut.castState.reinvention.trigger || null,
              fromStance: tutorOut.castState.reinvention.fromStance || null,
              toStance: tutorOut.castState.reinvention.toStance || null,
              mayOverrideProofControl: tutorOut.castState.reinvention.mayOverrideProofControl === true,
            }
          : null,
        inputAuditOk: tutorOut.castState.inputAudit?.ok === true,
        nonLeakAuditOk: tutorOut.castState.nonLeakAudit?.ok === true,
      });
    }
    // Strategy-ledger recording (the plot pattern: the bridge DECIDES, the
    // engine records and applies). A scene commitment lands on a scene-opening
    // turn; the register — the one surface the engine applies — switches for
    // the scene's remainder and reverts at its close. The audit of the
    // PREVIOUS scene arrives on the same opening turn (audit -> commit order
    // lives in the bridge) and is attached to its row here.
    if (ledgerState && tutorOut.sceneCommitment && sceneState) {
      const commitment = tutorOut.sceneCommitment;
      ledgerState.appliedCommitment = { sceneIndex: sceneState.index, ...commitment };
      ledgerState.rows.push(
        ledgerRow({
          agent: 'tutor',
          scope: 'scene',
          commitment: {
            register: commitment.register || null,
            didacticDefault: commitment.didacticDefault || null,
            releasePosture: commitment.releasePosture || null,
            recognitionBudget: commitment.recognitionBudget ?? null,
            ...(commitment.stance ? { stance: commitment.stance } : {}),
            ...(commitment.releaseIntent ? { releaseIntent: [...commitment.releaseIntent] } : {}),
          },
          committedTurn: turn,
          expires: `scene_${sceneState.index}_close`,
          rationale: commitment.rationale || null,
          exitCondition: commitment.exitCondition || null,
        }),
      );
      events.push({
        turn,
        type: 'strategy_commit',
        detail: `scene ${sceneState.index}: ${
          [
            commitment.register ? `register ${commitment.register}` : null,
            commitment.stance ? `stance ${commitment.stance}` : null,
            commitment.didacticDefault ? `didactic ${commitment.didacticDefault}` : null,
            commitment.releasePosture ? `releases ${commitment.releasePosture}` : null,
            commitment.releaseIntent ? `intends ${commitment.releaseIntent.join('+')}` : null,
            commitment.recognitionBudget !== null && commitment.recognitionBudget !== undefined
              ? `recognition budget ${commitment.recognitionBudget}`
              : null,
          ]
            .filter(Boolean)
            .join('; ') || 'committed'
        }`,
      });
      if (
        commitment.register &&
        PUBLIC_REGISTERS.has(commitment.register) &&
        commitment.register !== publicRegisterForTurn
      ) {
        publicRegisterForTurn = commitment.register;
        registerRows.push({ turn, register: commitment.register, scope: 'scene', scene: sceneState.index });
      }
    }
    if (ledgerState && tutorOut.sceneCommitmentAudit) {
      const audit = tutorOut.sceneCommitmentAudit;
      const row = [...ledgerState.rows]
        .reverse()
        .find(
          (r) =>
            r.agent === 'tutor' && r.scope === 'scene' && r.expires === `scene_${audit.sceneIndex}_close` && !r.audit,
        );
      if (row) row.audit = { clauses: audit.clauses, summary: audit.summary };
      const historyEntry = ledgerState.history.find((h) => h.sceneIndex === audit.sceneIndex && !h.audit);
      if (historyEntry) historyEntry.audit = { summary: audit.summary };
      events.push({
        turn,
        type: 'strategy_audit',
        detail: `scene ${audit.sceneIndex} commitment audited: ${audit.summary}`,
      });
    }
    // v2 (trialling): the persist/adjust/switch review answers the newest
    // history entry; a declared departure licenses off-commitment conduct
    // this scene and is adjudicated at the close.
    if (ledgerState?.config.trialling && tutorOut.strategyReview) {
      const pending = [...ledgerState.history].reverse().find((h) => !h.review);
      if (pending) pending.review = { ...tutorOut.strategyReview, turn };
      events.push({
        turn,
        type: 'strategy_review',
        detail: `${tutorOut.strategyReview.decision}${tutorOut.strategyReview.reason ? `: ${tutorOut.strategyReview.reason}` : ''}`,
      });
    }
    // Plan mode: record the stock-take exchange (note + the reorientation
    // that answered it). Conduct-only; nothing here feeds back into control.
    if (ledgerState?.config.planMode && tutorOut.stocktake) {
      ledgerState.stocktakes.push({ turn, ...tutorOut.stocktake });
      events.push({
        turn,
        type: 'stocktake',
        detail: `scene ${tutorOut.stocktake.sceneIndex}: ${
          tutorOut.stocktake.correction
            ? `correction demanded${tutorOut.stocktake.reorientation ? '; reoriented' : '; unanswered'}`
            : 'course holds'
        }`,
      });
    }
    if (ledgerState?.config.trialling && tutorOut.departure) {
      ledgerState.departuresThisScene += 1;
      events.push({ turn, type: 'strategy_departure', detail: tutorOut.departure });
    }
    // Phase-0d hold: an open block adopts the tutor's first non-minimal
    // didactic recommendation as its held mode; the bridge holds it steady
    // until the block closes (clearance, supersession, or budget).
    if (
      ledgerState?.block &&
      !ledgerState.block.heldMode &&
      tutorOut.didacticMode?.recommendedMode &&
      tutorOut.didacticMode.recommendedMode !== 'minimal_presence'
    ) {
      ledgerState.block.heldMode = tutorOut.didacticMode.recommendedMode;
      ledgerState.block.exitCondition = tutorOut.didacticMode.exitCondition || null;
    }
    if (tutorOut.learnerTransformation) {
      learnerTransformationRows.push(
        learnerTransformationRow(tutorOut.learnerTransformation, turn, actState?.index, 'pre_tutor'),
      );
    }

    // Reconstructing-tutor recording (stage v2, header): when the roles layer
    // emits a per-turn `theory` — the tutor's model of the learner's store —
    // pair it with a harness-truth snapshot taken at the same moment: which
    // released premises the learner actually holds, which are absent (decayed
    // or never adopted), and which stand misremembered (a mutation-born false
    // form on the board). Arm-internal color; cross-arm endpoints never read it.
    if (tutorOut.theory) {
      const held = [];
      const missing = [];
      for (const [key, premiseId] of releasedIdByKey) {
        const entry = grounded.get(key);
        if (entry && entry.valid && !entry.decayed) held.push(premiseId);
        else missing.push(premiseId);
      }
      const mistaken = [];
      for (const entry of grounded.values()) {
        if (!entry.mutatedFalse) continue;
        const id = premiseIdForKey(entry.mutationOf);
        if (id && !mistaken.includes(id)) mistaken.push(id);
      }
      reconstructionRows.push({ turn, believed: tutorOut.theory, truth: { held, missing, mistaken } });
    }

    // C1 plot recording (roles-layer dial, zero engine config — the theory
    // pattern): when the tutor bridge emits a per-act `plot` (act-opening
    // turns) or a `plotAudit` (the previous act, audited on the same boundary
    // turn), store them and mark the events; instruments read the rows later.
    if (tutorOut.plot) {
      plotRows.push({ ...tutorOut.plot });
      events.push({ turn, type: 'plot', detail: `act ${tutorOut.plot.act} plot committed` });
    }
    if (tutorOut.plotAudit) {
      plotAuditRows.push({ turn, ...tutorOut.plotAudit });
      events.push({ turn, type: 'plot_audit', detail: plotAuditDetail(tutorOut.plotAudit) });
    }
    // Two-layer planning: the whole-play throughline, committed at the first
    // turn and revised at act openings (trigger says which demand produced it).
    if (tutorOut.throughline) {
      throughlineRows.push({ ...tutorOut.throughline });
      events.push({
        turn,
        type: 'throughline',
        detail: `throughline ${tutorOut.throughline.trigger === 'voluntary' || tutorOut.throughline.trigger === 'audit_bound' ? 'revised' : 'committed'} (${tutorOut.throughline.trigger})`,
      });
    }

    // Tutor-side repair: a move that TARGETS a decayed premise restores it —
    // the tutor re-staged the evidence, so it is back in the learner's hands
    // before the learner speaks this turn. Repair is declared move metadata,
    // never inferred from prose. A confront move (C5) is the one exception:
    // it demands the learner produce the exhibit and restates nothing, so it
    // cannot put the words back in the learner's hands — if the read-back
    // fails, the licensed re-entry that follows is what repairs. Repairing on
    // the confrontation itself would make the read-back test nothing.
    const tutorIntent = String(tutorOut.move?.intent || '')
      .toLowerCase()
      .trim();
    const repairTargets = [];
    if (tutorOut.move?.targetPremise && tutorIntent !== 'confront') {
      repairTargets.push(tutorOut.move.targetPremise);
    }
    if (tutorIntent === 'restore' && Array.isArray(tutorOut.proofDebt?.targets)) {
      repairTargets.push(...tutorOut.proofDebt.targets);
    }
    for (const targetPremise of [...new Set(repairTargets)]) {
      if (!corruption) break;
      const premise = world.premiseById.get(targetPremise);
      const entry = premise ? grounded.get(factKey(premise.fact)) : null;
      if (entry?.decayed) {
        entry.decayed = false;
        entry.regroundedTurn = turn;
        // Ledger identity is the staged id, not the raw target: a move may
        // name a twin alias and still repair (key collapse), but the decay
        // entry it answers names the released id — pairing must agree. The
        // raw target survives in the transcript's move metadata.
        const repairedId = premiseIdForKey(factKey(premise.fact));
        corruption.ledger.push({ turn, type: 'repair', premiseId: repairedId, via: 'tutor' });
        events.push({ turn, type: 'repair', detail: `${repairedId} restored by the tutor` });
      }
    }

    // Runtime anti-reveal guard (plotLint should make this unreachable).
    if (turn < world.slope.t_min && entails([...world.background, ...releasedFacts], world.rules, world.secret.fact)) {
      events.push({ turn, type: 'leak', detail: 'released closure forces S before t_min' });
      if (opts.stopOnLeak) {
        endedBy = 'leak';
        break;
      }
    }

    // --- learner ---
    const dBeforeLearner = derivationDistance(world, validGroundedFacts());
    const groundedBeforeLearner = validGroundedFacts().length;
    const learnerOut = (await roles.learner(learnerView(turn, releasedThisTurn))) || {};
    if (learnerOut.mirrorRefusal && !mirrorRefusalState.fired) {
      mirrorRefusalState.fired = true;
      mirrorRefusalState.record = { ...learnerOut.mirrorRefusal };
      events.push({ turn, type: 'mirror_refusal', detail: learnerOut.mirrorRefusal.outcome });
    }
    for (const fact of learnerOut.retract || []) {
      const key = factKey(fact);
      // Retracting a mutation-born false belief is half of a REVISION (the
      // other half is the true premise coming back via repair/re-adoption);
      // the ledger row lets the scorer pair the two without inference.
      const entry = grounded.get(key);
      if (corruption && entry?.mutatedFalse) {
        const premiseId = premiseIdForKey(entry.mutationOf);
        corruption.ledger.push({ turn, type: 'retract_false', premiseId, falseForm: entry.fact });
        events.push({
          turn,
          type: 'retract_false',
          detail: `${premiseId || 'unknown'}: false form "${renderFact(entry.fact)}" retracted`,
        });
      }
      grounded.delete(key);
    }
    for (const fact of learnerOut.adopt || []) {
      const key = factKey(fact);
      const existing = grounded.get(key);
      if (existing) {
        // Re-adoption heals decay: taking the fact up again restores it to
        // the board (the learner-side repair channel).
        if (corruption && existing.decayed) {
          existing.decayed = false;
          existing.regroundedTurn = turn;
          const premiseId = premiseIdForKey(key);
          corruption.ledger.push({ turn, type: 'repair', premiseId, via: 'readoption' });
          events.push({ turn, type: 'repair', detail: `${premiseId || renderFact(fact)} restored by re-adoption` });
        }
        continue;
      }
      const valid = releasedKeys.has(key) || backgroundKeys.has(key);
      grounded.set(key, { fact, turn, valid });
      if (!valid) {
        events.push({ turn, type: 'fabricated_fact', detail: renderFact(fact) });
      }
    }
    if (learnerOut.hypothesis) {
      hypotheses.push({ turn, text: learnerOut.hypothesis });
    }

    // --- derive channel: validate learner-composed inference claims ---
    // Order matters: adopt/retract above first, so "I adopt X and can now
    // derive Y" validates against the board the learner just updated.
    const deriveOutcomes = []; // {fact, status: 'voiced'|'overreach'|'base'|'pattern'|'repeat'}
    if (Array.isArray(learnerOut.derive) && learnerOut.derive.length) {
      const cl = closure(validGroundedFacts(), world.rules);
      const byNorm = new Map();
      for (const [key, fact] of cl.facts) byNorm.set(normKey(fact), { key, fact });
      for (const claim of learnerOut.derive) {
        if (!Array.isArray(claim) || !claim.length) continue;
        const hit = byNorm.get(normKey(claim));
        if (!hit) {
          overreaches.push({ turn, fact: claim });
          events.push({ turn, type: 'overreach', detail: renderFact(claim) });
          deriveOutcomes.push({ fact: claim, status: 'overreach' });
          continue;
        }
        if (voicedKeys.has(hit.key)) {
          deriveOutcomes.push({ fact: hit.fact, status: 'repeat' });
          continue;
        }
        if (!cl.proofs.get(hit.key)) {
          mischanneled.push({ turn, fact: hit.fact, kind: 'base' });
          deriveOutcomes.push({ fact: hit.fact, status: 'base' });
          continue;
        }
        if (isPatternFact(hit.fact)) {
          mischanneled.push({ turn, fact: hit.fact, kind: 'pattern' });
          deriveOutcomes.push({ fact: hit.fact, status: 'pattern' });
          continue;
        }
        voicedKeys.add(hit.key);
        voicedLedger.push({ fact: hit.fact, turn });
        deriveOutcomes.push({ fact: hit.fact, status: 'voiced' });
      }
    }

    transcript.push({
      turn,
      role: 'learner',
      text: learnerOut.dialogue || '',
      meta: {
        adopt: learnerOut.adopt || [],
        retract: learnerOut.retract || [],
        derive: learnerOut.derive || [],
        deriveOutcomes,
        hypothesis: learnerOut.hypothesis || null,
        ...(learnerOut.retractionFilter ? { retractionFilter: learnerOut.retractionFilter } : {}),
        ...(learnerOut.learnerDrift ? { learnerDrift: learnerOut.learnerDrift } : {}),
        asserts: learnerOut.asserts || null,
        ...(learnerOut.assertionGate ? { assertionGate: learnerOut.assertionGate } : {}),
        exchangeType: learnerOut.exchangeType || null,
        ...(sceneMetaThisTurn ? { scene: sceneMetaThisTurn } : {}),
        publicRegister: publicRegisterForTurn,
      },
    });

    // --- instrumentation ---
    let postLearnerTransformation = null;
    const valid = validGroundedFacts();
    recordAvailability(turn); // frontier availability reflects this turn's adoptions
    const forced = entails(valid, world.rules, world.secret.fact);
    if (tutorOut.learnerTransformation && world.ownershipTarget) {
      postLearnerTransformation = deriveLearnerTransformationState({
        target: world.ownershipTarget,
        transcript,
        learnerText: learnerOut.dialogue || null,
        turn,
        enabled: true,
        finalAssertionAvailable: forced,
      });
      if (postLearnerTransformation) {
        learnerTransformationPostRows.push(
          learnerTransformationRow(postLearnerTransformation, turn, actState?.index, 'post_learner', {
            forced,
            asserted: Boolean(learnerOut.asserts),
          }),
        );
      }
    }
    if (forced && firstForcedTurn === null) {
      firstForcedTurn = turn;
      events.push({ turn, type: 'forced', detail: 'learner facts now force S' });
    }
    const D = derivationDistance(world, valid);
    if (fieldPlannerRow) {
      fieldPlannerRow.outcome = summarizeFieldPlannerOutcome(fieldPlannerRow, {
        distanceBefore: dBeforeLearner,
        distanceAfter: D,
        groundedBefore: groundedBeforeLearner,
        groundedAfter: valid.length,
        adoptedCount: (learnerOut.adopt || []).length,
        retractedCount: (learnerOut.retract || []).length,
        derivedCount: deriveOutcomes.filter((o) => o.status === 'voiced').length,
        overreachCount: deriveOutcomes.filter((o) => o.status === 'overreach').length,
        asserted: Boolean(learnerOut.asserts),
        forced,
      });
    }
    learnerDagSnapshots.push(
      buildLearnerDagSnapshot(world, {
        turn,
        boardFacts: learnerBoardFacts(),
        validFacts: valid,
        voiced: voicedLedger,
        hypotheses,
        assertion: learnerOut.asserts || null,
        learnerText: learnerOut.dialogue || null,
        ledger,
        source: 'engine_board',
      }),
    );
    // F(t) is decay-conditional and additive: trajectory rows in corruption
    // runs gain a fidelity field (design note §2's documented relaxation of
    // strict v1 byte-identity); decay-off rows are untouched.
    const F = corruption ? theoryFidelity() : null;
    trajectory.push({ turn, D, forced, groundedCount: valid.length, ...(corruption ? { F } : {}) });
    let sceneExchange = null;
    if (sceneConfig && sceneState) {
      sceneExchange = classifyLearnerExchange({
        dialogue: learnerOut.dialogue || '',
        adopt: learnerOut.adopt || [],
        retract: learnerOut.retract || [],
        deriveOutcomes,
        hypothesis: learnerOut.hypothesis || null,
        asserts: learnerOut.asserts || null,
        dBefore: dBeforeLearner,
        dAfter: D,
        groundedBefore: groundedBeforeLearner,
        groundedAfter: valid.length,
      });
      if (sceneTempoThisTurn) sceneExchange.tempo = sceneTempoThisTurn.beat;
      const learnerPhaticRecognition = detectPhaticRecognition(learnerOut.dialogue || '', {
        role: 'learner',
        exchangeType: sceneExchange.type,
        tempo: sceneTempoThisTurn,
        cognitiveTempo: sceneExchange.cognitiveTempo,
      });
      if (learnerPhaticRecognition.length) {
        sceneExchange.phaticRecognition = learnerPhaticRecognition;
        transcript[transcript.length - 1].meta.phaticRecognition = learnerPhaticRecognition;
      }
      transcript[transcript.length - 1].meta.exchange = sceneExchange;
    }

    // Learner-ledger recording (Phase 2, mirrored on the tutor rows above):
    // the learner's own scene intent and act carry-forward, authored in its
    // bridge, recorded here. Private to the learner — nothing below enters a
    // tutor view.
    if (learnerLedgerActive && learnerOut.sceneIntent && sceneState) {
      learnerLedgerRows.push(
        ledgerRow({
          agent: 'learner',
          scope: 'scene',
          commitment: learnerOut.sceneIntent,
          committedTurn: turn,
          expires: `scene_${sceneState.index}_close`,
        }),
      );
      events.push({
        turn,
        type: 'learner_intent',
        detail: `scene ${sceneState.index}: ${learnerOut.sceneIntent.want || learnerOut.sceneIntent.ifLost || 'committed'}`,
      });
    }
    if (learnerLedgerActive && learnerOut.actCarry && actState) {
      learnerLedgerRows.push(
        ledgerRow({
          agent: 'learner',
          scope: 'act',
          commitment: learnerOut.actCarry,
          committedTurn: turn,
          expires: `act_${actState.index}_close`,
        }),
      );
      events.push({
        turn,
        type: 'learner_carry',
        detail: `act ${actState.index}: ${learnerOut.actCarry.carryForward || 'carry committed'}`,
      });
    }
    if (learnerLedgerActive && learnerOut.sceneIntentAudit) {
      const audit = learnerOut.sceneIntentAudit;
      const row = [...learnerLedgerRows]
        .reverse()
        .find(
          (r) =>
            r.agent === 'learner' && r.scope === 'scene' && r.expires === `scene_${audit.sceneIndex}_close` && !r.audit,
        );
      if (row) row.audit = { clauses: audit.clauses, summary: audit.summary };
      events.push({
        turn,
        type: 'learner_intent_audit',
        detail: `scene ${audit.sceneIndex} intent audited: ${audit.summary}`,
      });
    }

    // Phase-0c blocks: update the open block with this turn's exchange, then
    // open a new one if a pressing episode stands unhoused. Update-first means
    // the opening exchange never double-counts against its own block.
    if (ledgerState && sceneExchange) {
      if (ledgerState.block) {
        const updated = updateBlockLedger(ledgerState.block, {
          turn,
          learnerText: learnerOut.dialogue || '',
          exchangeType: sceneExchange.type,
          maxBlockTurns: ledgerState.config.maxBlockTurns,
        });
        ledgerState.block = updated.block;
        if (updated.closed) {
          ledgerState.blockRows.push(updated.closed);
          events.push({
            turn,
            type: 'block_close',
            detail: `block ${updated.closed.index} (${updated.closed.type}) ${updated.closed.status}: ${updated.closed.closeReason}`,
          });
          if (updated.closed.status === 'failed' && updated.closed.heldMode) {
            // Phase-1c escalation: a mode that failed its exit condition is
            // not re-selectable next block (the bridge remaps it).
            ledgerState.blockedModes = [updated.closed.heldMode];
          } else if (updated.closed.status === 'cleared') {
            ledgerState.blockedModes = [];
          }
        }
      }
      if (!ledgerState.block) {
        const blockType = blockTypeForExchange(sceneExchange.type);
        if (blockType) {
          ledgerState.blockIndex += 1;
          ledgerState.block = openBlock({
            index: ledgerState.blockIndex,
            turn,
            type: blockType,
            scene: sceneState?.index ?? null,
          });
          events.push({
            turn,
            type: 'block_open',
            detail: `block ${ledgerState.blockIndex} (${blockType}) opened`,
          });
        }
      }
    }

    // Phase-0b opportunity counters, maintained live with the library's own
    // update rule: any formal proof progress this turn resets both counters;
    // otherwise each side's proof-neutral turn increments its own.
    if (ledgerState) {
      const repairedThisTurn = events.some((e) => e.turn === turn && e.type === 'repair');
      const tutorProofAction = Boolean(tutorRelease) || repairedThisTurn;
      const learnerProofAction =
        Boolean(learnerOut.asserts) ||
        (learnerOut.adopt || []).length > 0 ||
        deriveOutcomes.some((o) => o.status === 'voiced');
      if (tutorProofAction || learnerProofAction) {
        ledgerState.budget = nextOpportunityCostBudget(ledgerState.budget, { proofActionTaken: true });
      } else {
        ledgerState.budget = nextOpportunityCostBudget(ledgerState.budget, {
          actor: 'tutor',
          conduct: 'advisory',
          proofNeutral: true,
        });
        ledgerState.budget = nextOpportunityCostBudget(ledgerState.budget, { actor: 'learner', proofNeutral: true });
      }
    }

    for (const [a, b] of world.incompatible) {
      const cl = closure(valid, world.rules).facts;
      if (cl.has(factKey(a)) && cl.has(factKey(b))) {
        if (!events.some((e) => e.type === 'inconsistency')) {
          events.push({
            turn,
            type: 'inconsistency',
            detail: `${renderFact(a)} vs ${renderFact(b)}`,
          });
        }
      }
    }

    // --- assertion handling ---
    if (learnerOut.asserts) {
      const assertedKey = factKey(learnerOut.asserts);
      if (assertedKey === factKey(world.secret.fact)) {
        if (forced) {
          assertedGroundedTurn = turn;
          events.push({ turn, type: 'grounded_anagnorisis', detail: world.secret.surface });
          endedBy = 'grounded_anagnorisis';
        } else {
          events.push({ turn, type: 'lucky_leap', detail: 'asserted S unforced' });
        }
      } else if (world.mirror && assertedKey === factKey(world.mirror.fact)) {
        events.push({ turn, type: 'mirror', detail: renderFact(world.mirror.fact) });
      } else {
        events.push({ turn, type: 'wrong_assertion', detail: renderFact(learnerOut.asserts) });
      }
    }

    // --- unstaged recognition (forced but never asserted, past grace) ---
    if (
      firstForcedTurn !== null &&
      assertedGroundedTurn === null &&
      turn - firstForcedTurn >= opts.recognitionGrace &&
      !events.some((e) => e.type === 'unstaged_recognition')
    ) {
      events.push({ turn, type: 'unstaged_recognition', detail: 'forced, not asserted' });
    }

    let closedScene = null;
    if (sceneConfig && sceneState && sceneExchange) {
      const updated = updateScene(sceneState, sceneExchange, { turn, dNow: D, forced, endedBy, config: sceneConfig });
      sceneState = updated.scene;
      if (updated.closed) {
        closedScene = updated.closed;
        sceneRows.push(closedScene);
        events.push({
          turn,
          type: 'scene_close',
          detail: `scene ${closedScene.index} closed: ${closedScene.status} (${closedScene.closeReason})`,
        });
        // Seal the scene for the boundary audits (either ledger dial): a
        // public-only record — exchange types, counts, releases and schedule
        // entries within the span (both already tutor-known), last learner
        // line. The bridges audit against this at the next scene opening.
        if (ledgerState || learnerLedgerActive) {
          const span = (row) => row.turn >= closedScene.startTurn && row.turn <= closedScene.endTurn;
          const learnerLines = transcript.filter((entry) => entry.role === 'learner' && span(entry));
          lastClosedSceneSummary = {
            index: closedScene.index,
            startTurn: closedScene.startTurn,
            endTurn: closedScene.endTurn,
            status: closedScene.status,
            closeReason: closedScene.closeReason,
            counts: { ...closedScene.counts },
            exchanges: closedScene.exchanges.map((e) => ({
              turn: e.turn,
              type: e.type,
              formalActions: e.formalActions,
            })),
            lastLearnerText: learnerLines.length ? learnerLines[learnerLines.length - 1].text : '',
            lastExchangeType: closedScene.exchanges.length
              ? closedScene.exchanges[closedScene.exchanges.length - 1].type
              : null,
            releases: ledger.filter(span).map((entry) => ({ turn: entry.turn, premiseId: entry.premiseId })),
            scheduled: world.releaseSchedule
              .filter((entry) => entry.turn >= closedScene.startTurn && entry.turn <= closedScene.endTurn)
              .map((entry) => ({ turn: entry.turn, premise: entry.premise })),
            didacticModes: didacticModeRows.filter(span).map((row) => row.recommendedMode),
            registerHeld: true,
            ...(ledgerState?.config.trialling ? { departures: ledgerState.departuresThisScene } : {}),
          };
        }
        // v2 (trialling): the two-gate close. Gate one — was the assigned
        // stance actually instantiated (the landed registerStanceFidelity
        // gate, per tutor line in the span)? Then the public-only mechanism
        // history entry; the audit and review attach at the next opening.
        if (ledgerState?.config.trialling && ledgerState.appliedCommitment) {
          const span = (row) => row.turn >= closedScene.startTurn && row.turn <= closedScene.endTurn;
          const tutorLines = transcript
            .filter((entry) => entry.role === 'tutor' && span(entry))
            .map((entry) => entry.text || '');
          const learnerLinesInSpan = transcript
            .filter((entry) => entry.role === 'learner' && span(entry))
            .map((entry) => entry.text || '');
          const fidelity = ledgerState.appliedCommitment.stance
            ? sceneStanceFidelity({
                stance: ledgerState.appliedCommitment.stance,
                tutorLines,
                learnerLines: learnerLinesInSpan,
              })
            : null;
          if (fidelity) {
            lastClosedSceneSummary = { ...lastClosedSceneSummary, stanceFidelity: { label: fidelity.label } };
            events.push({
              turn,
              type: 'stance_fidelity',
              detail: `scene ${closedScene.index} stance ${ledgerState.appliedCommitment.stance}: ${fidelity.label}`,
            });
          }
          const historyEntry = buildMechanismHistoryEntry({
            sceneRecord: lastClosedSceneSummary,
            commitment: ledgerState.appliedCommitment,
            fidelity,
          });
          if (historyEntry) ledgerState.history.push(historyEntry);
        }
        // Scene exit under the strategy ledger: revert a scene-committed
        // register to the run baseline, clear the applied commitment, and
        // reset the opportunity counters (the documented on_scene_exit
        // policy).
        if (ledgerState) {
          if (ledgerState.appliedCommitment?.register && publicRegisterForTurn !== baseRegisterForRun) {
            publicRegisterForTurn = baseRegisterForRun;
            registerRows.push({ turn, register: baseRegisterForRun, scope: 'scene_end', scene: closedScene.index });
          }
          ledgerState.appliedCommitment = null;
          ledgerState.budget = deriveOpportunityCostBudget({ scope: 'dialogue_block' });
          ledgerState.departuresThisScene = 0;
        }
      }
    }

    // --- stall detection ---
    const firstReleaseTurn = ledger.length > 0 ? ledger[0].turn : Infinity;
    const stall = detectStall(trajectory, world.slope.aporia_window, firstReleaseTurn);
    if (stall && !events.some((e) => e.type === stall)) {
      events.push({ turn, type: stall, detail: `no progress over ${world.slope.aporia_window} turns` });
      if (opts.stopOnStall) endedBy = stall;
    }

    // --- decay draw (end of turn, after the learner has acted) ---
    // One PRNG draw per eligible entry per turn, in board insertion order, so
    // the corruption schedule is a pure function of (seed, role outputs).
    // Decayed facts vanish from next turn's views and from D(t): the drama
    // can move BACKWARD, which is the point of the condition.
    const decayedNow = [];
    if (corruption && !endedBy && turn >= corruption.config.startTurn) {
      const active = [...grounded.values()].filter((entry) => entry.decayed).length;
      const eligible = [];
      for (const [key, entry] of grounded) {
        if (!entry.valid || entry.decayed) continue;
        if (!releasedKeys.has(key)) continue; // background is immune — released premises are the experimental material
        const since = entry.regroundedTurn ?? entry.turn;
        if (turn - since < corruption.config.graceTurns) continue;
        eligible.push([key, entry]);
      }
      // Every eligible entry gets its draw (the draw count never depends on
      // earlier hits); maxConcurrent then caps how many hits land.
      const hits = eligible.filter(() => corruption.rng() < corruption.config.rate);
      for (const [key, entry] of hits.slice(0, Math.max(0, corruption.config.maxConcurrent - active))) {
        entry.decayed = true;
        entry.decayTurn = turn;
        const premiseId = premiseIdForKey(key);
        // Mutation mode (stage v2): the extra mode/pick draws happen ONLY
        // when mutateShare > 0, so the default stream is byte-identical to
        // v1. A mutate hit is formally a deletion (the victim decays exactly
        // as above) PLUS a false belief: the misremembered form lands on the
        // board invalid-but-believed until the learner retracts it. Delete
        // ledger rows keep the exact v1 shape; mutate rows add mode/falseForm.
        let falseForm = null;
        if (corruption.config.mutateShare > 0 && corruption.rng() < corruption.config.mutateShare) {
          const candidates = mutationCandidates(entry.fact);
          if (candidates.length) {
            falseForm = candidates[Math.floor(corruption.rng() * candidates.length)];
          }
        }
        if (falseForm) {
          grounded.set(factKey(falseForm), {
            fact: falseForm,
            turn,
            valid: false,
            mutatedFalse: true,
            mutationOf: key,
          });
          corruption.ledger.push({ turn, type: 'decay', mode: 'mutate', premiseId, fact: entry.fact, falseForm });
          events.push({
            turn,
            type: 'decay',
            detail: `${premiseId || renderFact(entry.fact)} slips — misremembered as "${renderFact(falseForm)}"`,
          });
        } else {
          corruption.ledger.push({ turn, type: 'decay', premiseId, fact: entry.fact });
          events.push({
            turn,
            type: 'decay',
            detail: `${premiseId || renderFact(entry.fact)} slips from the learner's board`,
          });
        }
        decayedNow.push(premiseId || renderFact(entry.fact));
      }
    }

    recordLogicSnapshot(turn, { trajectoryD: D, forced });

    // --- live status hook (the attended shell watches the drama through this) ---
    options.onTurn?.({
      turn,
      turnCap: world.turnCap,
      D,
      forced,
      lines: transcript.filter((entry) => entry.turn === turn),
      released: [...releasedThisTurn],
      adopted: (learnerOut.adopt || []).length,
      retracted: (learnerOut.retract || []).length,
      derived: deriveOutcomes.filter((o) => o.status === 'voiced').length,
      overreached: deriveOutcomes.filter((o) => o.status === 'overreach').length,
      hypothesis: Boolean(learnerOut.hypothesis),
      asserted: Boolean(learnerOut.asserts),
      ...(learnerOut.learnerDrift
        ? {
            learnerDrift: {
              mode: learnerOut.learnerDrift.mode || null,
              pressure: learnerOut.learnerDrift.pressure || null,
              mayOverrideProofControl: learnerOut.learnerDrift.mayOverrideProofControl === true,
            },
          }
        : {}),
      ...(tutorOut.learnerTransformation
        ? {
            learnerTransformation: {
              status: tutorOut.learnerTransformation.status || null,
              complete: tutorOut.learnerTransformation.complete === true,
              ownershipLevel: tutorOut.learnerTransformation.ownership?.ownershipLevel || null,
              missingFamilies: tutorOut.learnerTransformation.missingFamilies || [],
              lateOwnershipCheck: tutorOut.learnerTransformation.lateOwnershipCheck === true,
              mayOverrideProofControl: tutorOut.learnerTransformation.mayOverrideProofControl === true,
            },
          }
        : {}),
      ...(postLearnerTransformation
        ? {
            learnerTransformationPost: {
              status: postLearnerTransformation.status || null,
              complete: postLearnerTransformation.complete === true,
              ownershipLevel: postLearnerTransformation.ownership?.ownershipLevel || null,
              missingFamilies: postLearnerTransformation.missingFamilies || [],
              lateOwnershipCheck: postLearnerTransformation.lateOwnershipCheck === true,
              mayOverrideProofControl: postLearnerTransformation.mayOverrideProofControl === true,
            },
          }
        : {}),
      ...(sceneConfig
        ? {
            exchange: sceneExchange,
            scene: sceneState ? currentSceneView() : null,
            closedScene: closedScene
              ? {
                  index: closedScene.index,
                  status: closedScene.status,
                  closeReason: closedScene.closeReason,
                  turns: [closedScene.startTurn, closedScene.endTurn],
                }
              : null,
          }
        : {}),
      intervened: Boolean(tutorOut.deliberation?.intervened),
      phase: staging.phase ? { ...staging.phase } : null,
      events: events.filter((e) => e.turn === turn).map(({ type, detail }) => ({ type, detail })),
      ...(corruption
        ? {
            decayedNow,
            repairedNow: corruption.ledger
              .filter((e) => e.type === 'repair' && e.turn === turn)
              .map((e) => e.premiseId),
            decayActive: [...grounded.values()].filter((entry) => entry.decayed).length,
            F,
          }
        : {}),
      ...(actState ? { act: { index: actState.index, startTurn: actState.startTurn } } : {}),
      ...(ledgerState
        ? {
            strategyLedger: {
              block: ledgerState.block
                ? {
                    index: ledgerState.block.index,
                    type: ledgerState.block.type,
                    heldMode: ledgerState.block.heldMode,
                    turns: ledgerState.block.turns,
                  }
                : null,
              ...(tutorOut.sceneCommitment
                ? {
                    commitment: {
                      register: tutorOut.sceneCommitment.register || null,
                      didacticDefault: tutorOut.sceneCommitment.didacticDefault || null,
                      releasePosture: tutorOut.sceneCommitment.releasePosture || null,
                      recognitionBudget: tutorOut.sceneCommitment.recognitionBudget ?? null,
                    },
                  }
                : {}),
              ...(tutorOut.sceneCommitmentAudit
                ? {
                    audit: {
                      sceneIndex: tutorOut.sceneCommitmentAudit.sceneIndex,
                      summary: tutorOut.sceneCommitmentAudit.summary,
                    },
                  }
                : {}),
            },
          }
        : {}),
      ...(learnerLedgerActive && (learnerOut.sceneIntent || learnerOut.actCarry)
        ? {
            learnerLedger: {
              ...(learnerOut.sceneIntent ? { intent: learnerOut.sceneIntent } : {}),
              ...(learnerOut.actCarry ? { carry: learnerOut.actCarry } : {}),
            },
          }
        : {}),
      ...(tutorOut.didacticMode
        ? {
            didacticMode: {
              learningSignal: tutorOut.didacticMode.learningSignal || null,
              recommendedMode: tutorOut.didacticMode.recommendedMode || null,
              scope: tutorOut.didacticMode.scope || null,
              currentObject: tutorOut.didacticMode.currentObject || null,
            },
          }
        : {}),
      ...(fieldPlannerRow
        ? {
            fieldPlanner: {
              selectedMoveFamily: fieldPlannerRow.selectedMoveFamily,
              reasonCode: fieldPlannerRow.reasonCode,
              targetPremise: fieldPlannerRow.targetPremise,
              didacticMode: fieldPlannerRow.didacticMode?.recommendedMode || null,
              efficacy: fieldPlannerRow.outcome?.efficacy || null,
            },
          }
        : {}),
      ...(tutorOut.castState
        ? {
            castState: {
              tutor: {
                role: tutorOut.castState.tutor?.stableRole || null,
                currentStance: tutorOut.castState.tutor?.currentStance || null,
              },
              learner: {
                role: tutorOut.castState.learner?.stableRole || null,
                posture: tutorOut.castState.learner?.currentPosture || null,
              },
              relation: {
                currentTrust: tutorOut.castState.relation?.currentTrust || null,
              },
            },
          }
        : {}),
      ...(tutorOut.tutorReinvention
        ? {
            tutorReinvention: {
              active: tutorOut.tutorReinvention.active === true,
              trigger: tutorOut.tutorReinvention.trigger || null,
              toStance: tutorOut.tutorReinvention.toStance || null,
              mayOverrideProofControl: tutorOut.tutorReinvention.mayOverrideProofControl === true,
            },
          }
        : {}),
      publicRegister: publicRegisterForTurn,
      tutorLearnerDagModel: tutorView.tutorLearnerDagModel || null,
      proxyDagPacing: tutorView.proxyDagPacing || directorView.proxyDagPacing || null,
      endedBy,
    });
  }

  // Close any open scene after the formal loop stops. A scene can remain open
  // when the turn cap, a leak, or an external maxTurns replay boundary cuts
  // through the exchange budget.
  if (sceneState) {
    sceneState.endTurn = turn;
    sceneState.dEnd = trajectory[trajectory.length - 1]?.D ?? sceneState.dStart;
    sceneState.status = endedBy ? 'failed' : 'run_end';
    sceneState.closeReason = endedBy ? `run ended: ${endedBy}` : 'run ended before the scene budget closed';
    sceneRows.push({ ...sceneState, exchanges: sceneState.exchanges.map((e) => ({ ...e })) });
    sceneState = null;
  }

  // Seal an open strategy block at run end (the mirror of the scene seal).
  if (ledgerState?.block) {
    const open = ledgerState.block;
    open.endTurn = turn;
    open.status = 'run_end';
    open.closeReason = endedBy ? `run ended: ${endedBy}` : 'run ended before the block cleared';
    ledgerState.blockRows.push({ ...open, clearance: open.clearance.map((c) => ({ ...c })) });
    ledgerState.block = null;
  }

  // Close the final open act at the last turn played (stage v2).
  if (actState) {
    const didacticFallback = didacticFallbackForAct(actState.index, actState.startTurn, turn);
    actState.history.push({
      act: actState.index,
      turns: [actState.startTurn, turn],
      endedBy: 'run_end',
      brief: actState.brief,
      ...(didacticFallback ? { didacticFallback } : {}),
    });
  }

  // C1: the run-end act close has no following opening turn, so the final
  // act's plot is audited here — the engine hands the tutor bridge the sealed
  // record and stores the verdict like any boundary audit. Plot-off arms
  // (and non-plot tutors) have no finalAudit and skip this entirely.
  if (actState && typeof roles.tutor.finalAudit === 'function') {
    const fin = await roles.tutor.finalAudit({
      transcript: [...transcript],
      ledger: [...ledger],
      acts: actState.history.map((a) => ({ ...a })),
    });
    if (fin) {
      plotAuditRows.push({ turn, final: true, ...fin });
      events.push({ turn, type: 'plot_audit', detail: plotAuditDetail(fin, ' at run end') });
    }
  }

  const verdict = resolveVerdict({ endedBy, events, firstForcedTurn, assertedGroundedTurn });
  const proof = assertedGroundedTurn !== null ? proofTree(validGroundedFacts(), world.rules, world.secret.fact) : null;

  const availability = [...firstAvailable.values()]
    .map(({ fact, turn: avail }) => {
      const voicedEntry = voicedLedger.find((entry) => factKey(entry.fact) === factKey(fact));
      return { fact, firstAvailable: avail, firstVoiced: voicedEntry ? voicedEntry.turn : null };
    })
    .sort((a, b) => a.firstAvailable - b.firstAvailable || factKey(a.fact).localeCompare(factKey(b.fact)));

  const learnerTransformationDurability = learnerTransformationPostRows.length
    ? summarizeLearnerTransformationDurability({
        rows: learnerTransformationPostRows,
        releaseTurns: ledger.map((entry) => entry.turn),
        finalTurn: assertedGroundedTurn ?? turn,
      })
    : null;
  const learnerDag = buildLearnerDag(learnerDagSnapshots, world);
  // Final lemma refresh: clearances that land on the closing turn (the goal
  // itself, most of all) happen after that turn's start-of-turn refresh.
  if (lemmaRun) refreshLemmaState(turn);

  return {
    worldId: world.id,
    verdict,
    events,
    trajectory,
    transcript,
    ledger,
    ...(stagePrologue ? { stagePrologue } : {}),
    firstForcedTurn,
    assertedGroundedTurn,
    turnsPlayed: turn,
    proof,
    learnerDag,
    inference: {
      voiced: voicedLedger,
      overreaches,
      mischanneled,
      availability,
      frontierFinal: computeFrontier(turn),
    },
    ...(sceneRows.length ? { scenes: sceneRows } : {}),
    ...(lemmaRun
      ? {
          lemmaLayer: {
            config: { ...lemmaConfig },
            nodes: lemmaDag.nodes.map((n) => ({ label: n.label, isGoal: n.isGoal, support: [...n.support] })),
            clearedAt: Object.fromEntries(lemmaRun.clearedAt),
            groundedFinal: lemmaDag.nodes.filter((n) => lemmaRun.grounded.has(n.key)).map((n) => n.label),
            choices: lemmaRun.choices,
            departures: lemmaRun.departures,
            blocks: lemmaRun.blocks,
            passthroughs: lemmaRun.passthroughs,
            regressions: lemmaRun.regressions,
            frontierCoverage: {
              openings: lemmaRun.openings,
              multiFrontierOpenings: lemmaRun.multiFrontierOpenings,
              tutorChoices: lemmaRun.tutorChoices,
            },
          },
        }
      : {}),
    ...(mirrorRefusalState.record ? { mirrorRefusal: mirrorRefusalState.record } : {}),
    ...(sceneConfig ? { directorCadence } : {}),
    ...(publicRegisterPlan !== 'default' ? { publicRegister: publicRegisterPlan } : {}),
    ...(registerRows.length ? { publicRegisters: registerRows } : {}),
    ...(actState ? { acts: actState.history } : {}),
    ...(ledgerState || learnerLedgerActive
      ? {
          strategyLedger: {
            ...(ledgerState
              ? {
                  config: {
                    maxBlockTurns: ledgerState.config.maxBlockTurns,
                    registerPalette: ledgerState.config.registerPalette,
                    ...(ledgerState.config.trialling
                      ? {
                          trialling: true,
                          stancePalette: ledgerState.config.stancePalette,
                          releaseIntent: ledgerState.config.releaseIntent,
                        }
                      : {}),
                  },
                  blocks: ledgerState.blockRows,
                  budgetFinal: {
                    context: ledgerState.budget.context,
                    currentProofNeutralTutorTurns: ledgerState.budget.currentProofNeutralTutorTurns,
                    currentProofNeutralLearnerTurns: ledgerState.budget.currentProofNeutralLearnerTurns,
                  },
                  ...(ledgerState.config.trialling ? { history: ledgerState.history } : {}),
                  ...(ledgerState.config.planMode ? { stocktakes: ledgerState.stocktakes } : {}),
                }
              : {}),
            rows: [...(ledgerState?.rows || []), ...learnerLedgerRows],
          },
        }
      : {}),
    ...(reconstructionRows.length ? { reconstruction: reconstructionRows } : {}),
    ...(plotRows.length || plotAuditRows.length || throughlineRows.length
      ? {
          plot: {
            plots: plotRows,
            audits: plotAuditRows,
            ...(throughlineRows.length ? { throughlines: throughlineRows } : {}),
          },
        }
      : {}),
    ...(proofDebtRows.length ? { proofDebt: proofDebtRows } : {}),
    ...(didacticModeRows.length ? { didacticMode: didacticModeRows } : {}),
    ...(castLayerRows.length ? { castLayer: castLayerRows } : {}),
    ...(learnerTransformationRows.length ? { learnerTransformation: learnerTransformationRows } : {}),
    ...(learnerTransformationPostRows.length ? { learnerTransformationPost: learnerTransformationPostRows } : {}),
    ...(learnerTransformationDurability ? { learnerTransformationDurability } : {}),
    ...(tutorLearnerDagRows.length ? { tutorLearnerDagModel: tutorLearnerDagRows } : {}),
    ...(proxyDagPacingRows.length ? { proxyDagPacing: proxyDagPacingRows } : {}),
    ...(fieldPlannerRows.length ? { fieldPlanner: fieldPlannerRows } : {}),
    ...(logicSnapshots.length ? { logicSnapshots } : {}),
    ...(corruption
      ? {
          corruption: {
            config: corruption.config,
            ledger: corruption.ledger,
            decayedAtEnd: [...grounded.entries()]
              .filter(([, entry]) => entry.decayed)
              .map(([key, entry]) => ({
                premiseId: premiseIdForKey(key),
                fact: entry.fact,
                sinceTurn: entry.decayTurn,
              })),
          },
        }
      : {}),
  };
}

// One-line tally for plot_audit events: a verdict outside the contract
// counts as unscored rather than crashing the event log.
function plotAuditDetail(audit, suffix = '') {
  const mix = { kept: 0, justified_deviation: 0, drift: 0, unscored: 0 };
  for (const c of audit.clauses || []) {
    mix[Object.hasOwn(mix, c.verdict) ? c.verdict : 'unscored'] += 1;
  }
  return (
    `act ${audit.act} plot audited${suffix}: kept ${mix.kept}, justified ${mix.justified_deviation}, ` +
    `drift ${mix.drift}${mix.unscored ? `, unscored ${mix.unscored}` : ''}` +
    (audit.arc ? `; arc ${audit.arc.verdict}` : '') +
    (audit.throughlineAudit?.length ? `; throughline reckoned (${audit.throughlineAudit.length} clauses)` : '')
  );
}

function resolveVerdict({ endedBy, events, firstForcedTurn, assertedGroundedTurn }) {
  if (endedBy === 'grounded_anagnorisis') return 'grounded_anagnorisis';
  if (endedBy === 'leak') return 'leak';
  if (firstForcedTurn !== null && assertedGroundedTurn === null) return 'unstaged_recognition';
  if (events.some((e) => e.type === 'mirror')) return 'mirror';
  if (endedBy === 'aporia' || endedBy === 'disengagement') return endedBy;
  if (events.some((e) => e.type === 'aporia')) return 'aporia';
  if (events.some((e) => e.type === 'disengagement')) return 'disengagement';
  if (events.some((e) => e.type === 'lucky_leap')) return 'lucky_leap_only';
  return 'cap_reached';
}
