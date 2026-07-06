/**
 * Strategy Ledger v1 — per-agent, per-scope commit/audit machinery
 * (LAYERED-DECISION-LOOPS-PLAN.md Phases 0-2).
 *
 * Phase 0 gives the two missing bookkeeping loops a real runtime shape:
 * dialogue BLOCKS segmented from the engine's exchange classification, and a
 * deterministic exit-condition clearance check so a held strategy learns
 * whether it worked. Phase 1/2 add the commitment objects both agents author
 * at scene/act boundaries — one row shape for tutor and learner alike (the
 * symmetry rule), normalized and audited here, DECIDED in the role bridges.
 *
 * Authority discipline (A20/A21): everything in this module is public-only
 * conduct. Commitments may fix register, didactic default, release POSTURE,
 * and recognition budget; they may never name, reorder, or gate a release,
 * a repair, a proof target, or the concealed answer. The engine applies the
 * register (a prompt surface) and records rows; proof control is untouched.
 */

import { DIDACTIC_MODE_FAMILIES } from './didacticMode.js';
import { getEngagementRegisterDefinition, resolveEngagementRegister } from '../engagementRegisterRegistry.js';
import { evaluateRegisterStanceFidelity } from '../registerStanceFidelity.js';

export const STRATEGY_LEDGER_SCHEMA = 'dramatic-derivation.strategy-ledger.v0';
export const LEDGER_ROW_SCHEMA = 'dramatic-derivation.strategy-ledger-row.v0';
export const LEDGER_BLOCK_SCHEMA = 'dramatic-derivation.strategy-ledger-block.v0';
export const LEDGER_HISTORY_SCHEMA = 'dramatic-derivation.strategy-ledger-history.v0';

export const STRATEGY_REVIEW_DECISIONS = Object.freeze(['persist', 'adjust', 'switch']);

export const LEDGER_SCOPES = Object.freeze(['block', 'scene', 'act', 'run']);
export const RELEASE_POSTURES = Object.freeze(['eager', 'hold', 'consolidate']);
export const LEARNER_IF_LOST_POLICIES = Object.freeze(['ask_repair', 'resist', 'try_own_derivation']);
export const BLOCK_TYPES = Object.freeze(['confusion', 'repair', 'resistance']);
export const REGISTER_PALETTE_VALUES = Object.freeze(['default', 'modern', 'period']);

const MODE_SET = new Set(DIDACTIC_MODE_FAMILIES);
const POSTURE_SET = new Set(RELEASE_POSTURES);
const IF_LOST_SET = new Set(LEARNER_IF_LOST_POLICIES);
const REGISTER_SET = new Set(REGISTER_PALETTE_VALUES);

const LEDGER_DEFAULTS = Object.freeze({
  maxBlockTurns: 3,
  registerPalette: null, // null = no register choice offered (palette of one: the running register)
  // --- v2 (Part 6, mechanism trialling; all default OFF = v1 exactly) ---
  trialling: false, // master switch: mechanism history + effectiveness review + licensed departures
  stancePalette: null, // engagement-register names (registry); negative valence ONLY by explicit listing here
  releaseIntent: false, // scene release intent (requires a release-authority arm; guards stay binding)
  // --- plan mode (the dialogic stock-take; exclusive with the commitment
  // machinery above — it is course-CHANGING, not course-holding) ---
  planMode: false,
});

/**
 * Validate and default a strategy-ledger config (same discipline as
 * normalizeActsConfig: unknown keys fail loudly, `true`/'on'/{} mean
 * defaults).
 */
export function normalizeStrategyLedgerConfig(raw) {
  let cfg = raw;
  if (cfg === true || cfg === 'on' || cfg === undefined || cfg === null) cfg = {};
  if (typeof cfg === 'string') {
    try {
      cfg = JSON.parse(cfg);
    } catch (err) {
      throw new Error(`strategy-ledger config is not valid JSON: ${err.message}`);
    }
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    throw new Error('strategy-ledger config must be a JSON object, e.g. {"maxBlockTurns":3}');
  }
  for (const key of Object.keys(cfg)) {
    if (!(key in LEDGER_DEFAULTS)) {
      throw new Error(
        `strategy-ledger config: unknown key "${key}" (known: ${Object.keys(LEDGER_DEFAULTS).join(', ')})`,
      );
    }
  }
  const out = { ...LEDGER_DEFAULTS, ...cfg };
  if (!Number.isInteger(out.maxBlockTurns) || out.maxBlockTurns < 1) {
    throw new Error(
      `strategy-ledger config: maxBlockTurns must be an integer >= 1 (got ${JSON.stringify(out.maxBlockTurns)})`,
    );
  }
  if (out.registerPalette !== null) {
    if (!Array.isArray(out.registerPalette) || out.registerPalette.length < 1) {
      throw new Error('strategy-ledger config: registerPalette must be a non-empty array or null');
    }
    out.registerPalette = out.registerPalette.map((r) => String(r).trim().toLowerCase());
    for (const register of out.registerPalette) {
      if (!REGISTER_SET.has(register)) {
        throw new Error(
          `strategy-ledger config: unknown palette register "${register}" (known: ${REGISTER_PALETTE_VALUES.join(', ')})`,
        );
      }
    }
  }
  out.trialling = Boolean(out.trialling);
  out.planMode = Boolean(out.planMode);
  if (out.planMode && out.trialling) {
    throw new Error(
      'strategy-ledger config: planMode and trialling are mutually exclusive (course-changing vs course-holding — one apparatus per arm)',
    );
  }
  if (out.stancePalette !== null) {
    if (!out.trialling) {
      throw new Error(
        'strategy-ledger config: stancePalette requires trialling (the v2 review loop owns stance choice)',
      );
    }
    if (!Array.isArray(out.stancePalette) || out.stancePalette.length < 1) {
      throw new Error('strategy-ledger config: stancePalette must be a non-empty array or null');
    }
    out.stancePalette = out.stancePalette.map((name) => {
      const raw = String(name).trim();
      const resolved = resolveEngagementRegister(raw);
      const def = resolved ? getEngagementRegisterDefinition(resolved.register) : null;
      if (!def) {
        throw new Error(`strategy-ledger config: unknown engagement register "${raw}" (not in the merged registry)`);
      }
      return resolved.register;
    });
  }
  if (out.releaseIntent && !out.trialling) {
    throw new Error('strategy-ledger config: releaseIntent requires trialling (intent is audited by the review loop)');
  }
  return out;
}

function cleanText(value, max = 180) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/gu, ' ').trim();
  return text ? text.slice(0, max) : null;
}

function norm(text) {
  return String(text || '').toLowerCase();
}

// ---------------------------------------------------------------------------
// Phase 0 — dialogue blocks
// ---------------------------------------------------------------------------

/** Map an engine exchange type to the block episode it opens (or null). */
export function blockTypeForExchange(exchangeType) {
  if (exchangeType === 'confusion') return 'confusion';
  if (exchangeType === 'repair_request') return 'repair';
  if (exchangeType === 'resistance') return 'resistance';
  return null;
}

export function openBlock({ index, turn, type, scene = null }) {
  if (!BLOCK_TYPES.includes(type)) throw new Error(`strategy-ledger: unknown block type "${type}"`);
  return {
    schema: LEDGER_BLOCK_SCHEMA,
    index,
    type,
    scene,
    openedTurn: turn,
    endTurn: null,
    heldMode: null, // set from the tutor's first didactic recommendation inside the block
    exitCondition: null,
    turns: 0,
    status: null,
    closeReason: null,
    clearance: [], // {turn, cleared, evidence}
  };
}

const REASONING_MARKERS =
  /\b(because|so|therefore|which means|that means|it follows|i would say|in my words|the point is)\b/u;
const CONFUSION_MARKERS = /\b(lost|confus|unclear|don't follow|do not follow|don't get|do not get|what do you mean)\b/u;
const REPAIR_MARKERS = /\b(again|go back|remind|where did|slipped|forgot|repeat)\b/u;
const RESISTANCE_MARKERS = /\b(but|surely|can't be|cannot be|doesn't follow|does not follow|instead|rather)\b/u;
const OWN_WORDS_MARKERS = /\b(i would say|in my words|i read it as|i take it|the point is|so what this says)\b/u;
const NEXT_STEP_MARKERS = /\b(next|missing|still need|what remains|then we|now i can)\b/u;
const PURPOSE_MARKERS = /\b(matters because|proves|shows why|needed because|so that)\b/u;

const SETTLED_EXCHANGES = new Set(['substantive', 'assertion', 'hypothesis', 'phatic_ack']);

/**
 * Deterministic exit-condition clearance — the Phase-0 feedback bit. When a
 * didactic mode is held, its exit condition maps to a marker test; otherwise
 * the block's episode type carries a generic "pressure has passed" test.
 * Marker sets deliberately reuse the vocabularies of publicEvidence.js and
 * didacticMode.js so the check is one more read of the same public signals.
 */
export function checkBlockClearance({ mode = null, blockType = null, learnerText = '', exchangeType = null }) {
  const text = norm(learnerText);
  const evidenceOf = (label) => ({ cleared: true, evidence: label });
  const pending = (label) => ({ cleared: false, evidence: label });

  if (mode && MODE_SET.has(mode)) {
    switch (mode) {
      case 'minimal_presence':
        return evidenceOf('minimal presence holds; nothing to clear');
      case 'teach_back':
        return OWN_WORDS_MARKERS.test(text) && REASONING_MARKERS.test(text)
          ? evidenceOf('learner restated in own words with reasoning')
          : pending('no own-words account yet');
      case 'repair_vocabulary':
        return SETTLED_EXCHANGES.has(exchangeType) && !CONFUSION_MARKERS.test(text)
          ? evidenceOf('vocabulary confusion has passed')
          : pending('vocabulary repair still in progress');
      case 'purpose_bridge':
        return PURPOSE_MARKERS.test(text)
          ? evidenceOf('learner connects the evidence to the question')
          : pending('purpose link not yet voiced');
      case 'slow_recap':
        return NEXT_STEP_MARKERS.test(text) && !CONFUSION_MARKERS.test(text)
          ? evidenceOf('learner names the next missing link')
          : pending('recap has not yet located the next link');
      default:
        // concrete_example, analogy_bridge, contrast_case, decompose_subtask:
        // cleared when the learner does settled reasoning work again.
        return SETTLED_EXCHANGES.has(exchangeType) && REASONING_MARKERS.test(text) && !CONFUSION_MARKERS.test(text)
          ? evidenceOf('learner resumed settled reasoning work')
          : pending('learner has not resumed settled reasoning');
    }
  }

  switch (blockType) {
    case 'confusion':
      return SETTLED_EXCHANGES.has(exchangeType) && !CONFUSION_MARKERS.test(text)
        ? evidenceOf('confusion has passed')
        : pending('confusion persists');
    case 'repair':
      return SETTLED_EXCHANGES.has(exchangeType) && !REPAIR_MARKERS.test(text) && !CONFUSION_MARKERS.test(text)
        ? evidenceOf('repair request satisfied')
        : pending('repair still requested');
    case 'resistance':
      return exchangeType !== 'resistance' && !RESISTANCE_MARKERS.test(text)
        ? evidenceOf('resistance has passed')
        : pending('resistance persists');
    default:
      return pending('no clearance rule for this block');
  }
}

/**
 * Advance an open block with this turn's learner exchange. Mirrors
 * updateScene's contract: returns {block, closed} where a non-null `closed`
 * is the sealed record and `block` is the still-open state (or null).
 * Close order: cleared > superseded (a different pressing episode) > failed
 * (budget). The caller opens the superseding block itself.
 */
export function updateBlockLedger(block, { turn, learnerText = '', exchangeType = null, maxBlockTurns = 3 }) {
  if (!block) return { block: null, closed: null };
  block.turns += 1;
  const clearance = checkBlockClearance({
    mode: block.heldMode,
    blockType: block.type,
    learnerText,
    exchangeType,
  });
  block.clearance.push({ turn, cleared: clearance.cleared, evidence: clearance.evidence });

  let status = null;
  let closeReason = null;
  const pressingNow = blockTypeForExchange(exchangeType);
  if (clearance.cleared) {
    status = 'cleared';
    closeReason = clearance.evidence;
  } else if (pressingNow && pressingNow !== block.type) {
    status = 'superseded';
    closeReason = `a ${pressingNow} episode displaced it`;
  } else if (block.turns >= maxBlockTurns) {
    status = 'failed';
    closeReason = `exit condition did not clear within ${maxBlockTurns} turns`;
  }
  if (!status) return { block, closed: null };
  block.endTurn = turn;
  block.status = status;
  block.closeReason = closeReason;
  return { block: null, closed: { ...block, clearance: block.clearance.map((c) => ({ ...c })) } };
}

/**
 * Escalation table for failed blocks (Phase 1c): a mode that failed its exit
 * condition is not re-selectable next block; the harness remaps it one step
 * up the intervention ladder instead.
 */
const MODE_ESCALATION = Object.freeze({
  minimal_presence: 'slow_recap',
  teach_back: 'concrete_example',
  concrete_example: 'decompose_subtask',
  analogy_bridge: 'concrete_example',
  contrast_case: 'slow_recap',
  slow_recap: 'decompose_subtask',
  purpose_bridge: 'concrete_example',
  decompose_subtask: 'repair_vocabulary',
  repair_vocabulary: 'slow_recap',
});

export function escalateDidacticMode(mode) {
  return MODE_ESCALATION[mode] || 'slow_recap';
}

// ---------------------------------------------------------------------------
// Phase 1/2 — commitments (shape gates, plot-pattern discipline: a malformed
// or empty commitment drops to null; absence stays visible to the scorer)
// ---------------------------------------------------------------------------

/**
 * Normalize a tutor scene commitment. `registerPalette` bounds the register
 * choice (register-taxonomy lesson: palette-constrained, never free); a
 * register outside the palette is dropped, not obeyed.
 */
export function normalizeSceneCommitment(raw, { registerPalette = null, currentRegister = null } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const palette =
    Array.isArray(registerPalette) && registerPalette.length
      ? registerPalette
      : currentRegister
        ? [currentRegister]
        : [];
  const rawRegister = typeof raw.register === 'string' ? raw.register.trim().toLowerCase() : null;
  const register = rawRegister && palette.includes(rawRegister) && REGISTER_SET.has(rawRegister) ? rawRegister : null;
  const didacticDefault = MODE_SET.has(raw.didactic_default) ? raw.didactic_default : null;
  const releasePosture = POSTURE_SET.has(raw.release_posture) ? raw.release_posture : null;
  const recognitionBudgetRaw = Number(raw.recognition_budget);
  const recognitionBudget =
    Number.isInteger(recognitionBudgetRaw) && recognitionBudgetRaw >= 0 && recognitionBudgetRaw <= 4
      ? recognitionBudgetRaw
      : null;
  const rationale = cleanText(raw.rationale, 180);
  const exitCondition = cleanText(raw.exit_condition, 180);
  return finishSceneCommitment({
    register,
    didacticDefault,
    releasePosture,
    recognitionBudget,
    rationale,
    exitCondition,
  });
}

/**
 * v2 fields (Part 6): an engagement-STANCE choice from the operator's stance
 * palette (interpersonal-stance axis — distinct from the surface register
 * above; negative valence only enters by explicit palette listing), and a
 * scene release INTENT (release-authority arms only; up to four exhibit ids
 * the tutor means to play this scene — advisory to the turn, guards binding).
 */
export function normalizeSceneCommitmentV2(raw, { stancePalette = null, premiseIds = null, ...v1opts } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const base = normalizeSceneCommitment(raw, v1opts) || {};
  const stanceRaw = typeof raw.stance === 'string' ? raw.stance.trim() : null;
  const resolvedStance = resolveEngagementRegister(stanceRaw)?.register || stanceRaw;
  const stance =
    resolvedStance && Array.isArray(stancePalette) && stancePalette.includes(resolvedStance) ? resolvedStance : null;
  const idSet = premiseIds instanceof Set ? premiseIds : new Set(premiseIds || []);
  const releaseIntent = Array.isArray(raw.release_intent)
    ? [...new Set(raw.release_intent.map((x) => String(x).trim()).filter((id) => idSet.has(id)))].slice(0, 4)
    : [];
  const merged = {
    register: base.register ?? null,
    didacticDefault: base.didacticDefault ?? null,
    releasePosture: base.releasePosture ?? null,
    recognitionBudget: base.recognitionBudget ?? null,
    rationale: base.rationale ?? cleanText(raw.rationale, 180),
    exitCondition: base.exitCondition ?? cleanText(raw.exit_condition, 180),
    stance,
    releaseIntent: releaseIntent.length ? releaseIntent : null,
  };
  if (
    !merged.register &&
    !merged.didacticDefault &&
    !merged.releasePosture &&
    merged.recognitionBudget === null &&
    !merged.exitCondition &&
    !merged.stance &&
    !merged.releaseIntent
  ) {
    return null;
  }
  return merged;
}

function finishSceneCommitment(fields) {
  const { register, didacticDefault, releasePosture, recognitionBudget, exitCondition } = fields;
  if (!register && !didacticDefault && !releasePosture && recognitionBudget === null && !exitCondition) return null;
  return fields;
}

/** v2: the persist / adjust / switch decision demanded at openings once a
 * mechanism history exists. Shape-gated like every commitment. */
export function normalizeStrategyReview(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const decision = STRATEGY_REVIEW_DECISIONS.includes(raw.decision) ? raw.decision : null;
  const reason = cleanText(raw.reason, 180);
  if (!decision) return null;
  return { decision, reason };
}

/**
 * v2 two-gate structure, gate one: was the assigned stance actually
 * INSTANTIATED this scene? Wraps the landed registerStanceFidelity gate
 * (deterministic, cue-based) over each tutor line in the scene span.
 * Aggregation: any invalid_person_attack dominates; else any faithful turn
 * makes the scene faithful; else the weakest non-instantiated label stands.
 * The warm-in-costume lesson (10/15 pre-repair) is why this precedes the
 * effectiveness review — outcomes only attribute to mechanisms actually
 * deployed.
 */
export function sceneStanceFidelity({ stance, tutorLines = [], learnerLines = [] }) {
  if (!stance) return null;
  const perTurn = [];
  for (let i = 0; i < tutorLines.length; i += 1) {
    const verdict = evaluateRegisterStanceFidelity({
      registerName: stance,
      tutorMessage: tutorLines[i] || '',
      learnerMessage: learnerLines[i] || '',
    });
    // The landed gate is a NEGATIVE-register discipline: positive-valence
    // stances return applies:false and are not deterministically gateable —
    // they pass through as not_applicable rather than being scored.
    if (verdict.applies === false) {
      return { schema: LEDGER_HISTORY_SCHEMA, stance, label: 'not_applicable', perTurn: [] };
    }
    perTurn.push({ label: verdict.label, score: verdict.score ?? null });
  }
  if (!perTurn.length) return { schema: LEDGER_HISTORY_SCHEMA, stance, label: 'not_instantiated', perTurn };
  let label = 'not_instantiated';
  if (perTurn.some((t) => t.label === 'invalid_person_attack')) label = 'invalid_person_attack';
  else if (perTurn.some((t) => t.label === 'faithful')) label = 'faithful';
  else if (perTurn.some((t) => t.label === 'weak_or_warm_in_costume')) label = 'weak_or_warm_in_costume';
  return { schema: LEDGER_HISTORY_SCHEMA, stance, label, perTurn };
}

/**
 * v2 mechanism-history entry, built at scene close from PUBLIC material only
 * (no D, no proof state — the table is rendered into prompts). The audit and
 * review attach later, at the next opening, like the row audit does.
 */
export function buildMechanismHistoryEntry({ sceneRecord, commitment, fidelity = null }) {
  if (!sceneRecord || !commitment) return null;
  const exchanges = sceneRecord.exchanges || [];
  const pressing = exchanges.filter((e) => ['confusion', 'repair_request', 'resistance'].includes(e.type)).length;
  const working = exchanges.filter((e) => (e.formalActions || 0) > 0 || e.type === 'hypothesis').length;
  const exitCheck = commitment.exitCondition
    ? checkBlockClearance({
        mode: commitment.didacticDefault,
        blockType: null,
        learnerText: sceneRecord.lastLearnerText || '',
        exchangeType: sceneRecord.lastExchangeType || null,
      })
    : null;
  return {
    schema: LEDGER_HISTORY_SCHEMA,
    sceneIndex: sceneRecord.index,
    turns: [sceneRecord.startTurn, sceneRecord.endTurn],
    strategy: {
      stance: commitment.stance || null,
      register: commitment.register || null,
      didacticDefault: commitment.didacticDefault || null,
      releasePosture: commitment.releasePosture || null,
      releaseIntent: commitment.releaseIntent || null,
    },
    fidelity: fidelity ? { label: fidelity.label } : null,
    outcome: {
      closeStatus: sceneRecord.status,
      exitConditionCleared: exitCheck ? exitCheck.cleared : null,
      pressingExchanges: pressing,
      workingExchanges: working,
      phatic: sceneRecord.counts?.phatic ?? 0,
      releasesPlayed: (sceneRecord.releases || []).length,
      intendedPlayed: commitment.releaseIntent
        ? commitment.releaseIntent.filter((id) => (sceneRecord.releases || []).some((r) => r.premiseId === id)).length
        : null,
    },
    audit: null, // attached at the next opening
    review: null, // the persist/adjust/switch decision that answered this entry
  };
}

export function normalizeLearnerSceneIntent(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const want = cleanText(raw.want, 180);
  const ifLost = IF_LOST_SET.has(raw.if_lost) ? raw.if_lost : null;
  const speechPosture = cleanText(raw.speech_posture, 120);
  if (!want && !ifLost && !speechPosture) return null;
  return { want, ifLost, speechPosture };
}

export function normalizeLearnerActCarry(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const carryForward = cleanText(raw.carry_forward, 200);
  const stillOwe = cleanText(raw.still_owe, 200);
  if (!carryForward && !stillOwe) return null;
  return { carryForward, stillOwe };
}

// ---------------------------------------------------------------------------
// Boundary audits (deterministic v1 — the harness can check everything a
// commitment binds; an LLM audit can be layered on later without changing
// the row shape)
// ---------------------------------------------------------------------------

function clause(name, verdict, evidence) {
  return { clause: name, verdict, evidence };
}

/**
 * Audit a tutor scene commitment against the sealed scene record.
 * `sceneRecord` is the ledger's own closed-scene summary: {index, startTurn,
 * endTurn, counts, exchanges, lastLearnerText, releases, scheduled,
 * didacticModes, registerHeld}.
 */
export function auditTutorSceneCommitment(commitment, sceneRecord, opts = {}) {
  if (!commitment || !sceneRecord) return null;
  const clauses = [];
  if (commitment.register) {
    clauses.push(
      sceneRecord.registerHeld === false
        ? clause(
            `register ${commitment.register}`,
            'drift',
            'the harness recorded a different register during the scene',
          )
        : clause(`register ${commitment.register}`, 'kept', 'held by the harness for the scene'),
    );
  }
  if (commitment.didacticDefault) {
    const modes = Array.isArray(sceneRecord.didacticModes) ? sceneRecord.didacticModes : null;
    clauses.push(
      modes === null
        ? clause(`didactic default ${commitment.didacticDefault}`, 'unscored', 'didactic layer not running')
        : modes.length === 0 || modes.includes(commitment.didacticDefault)
          ? clause(
              `didactic default ${commitment.didacticDefault}`,
              'kept',
              modes.length === 0 ? 'no didactic pressure arose' : 'default mode was used',
            )
          : clause(
              `didactic default ${commitment.didacticDefault}`,
              'drift',
              `modes used: ${[...new Set(modes)].join(', ')}`,
            ),
    );
  }
  if (commitment.releasePosture) {
    const releases = Array.isArray(sceneRecord.releases) ? sceneRecord.releases : [];
    const scheduled = Array.isArray(sceneRecord.scheduled) ? sceneRecord.scheduled : [];
    if (commitment.releasePosture === 'eager') {
      const unplayed = scheduled.filter((s) => !releases.some((r) => r.premiseId === s.premise));
      clauses.push(
        unplayed.length
          ? clause(
              'release posture eager',
              'drift',
              `scheduled exhibits left unplayed: ${unplayed.map((s) => s.premise).join(', ')}`,
            )
          : clause('release posture eager', 'kept', 'every exhibit due in the scene was played'),
      );
    } else if (commitment.releasePosture === 'hold') {
      const early = releases.filter((r) => {
        const due = scheduled.find((s) => s.premise === r.premiseId);
        return due ? r.turn < due.turn : false;
      });
      clauses.push(
        early.length
          ? clause(
              'release posture hold',
              'drift',
              `released ahead of schedule: ${early.map((r) => r.premiseId).join(', ')}`,
            )
          : clause('release posture hold', 'kept', 'nothing released ahead of its scheduled turn'),
      );
    } else {
      clauses.push(
        releases.length <= 1
          ? clause('release posture consolidate', 'kept', `${releases.length} release(s) in the scene`)
          : clause('release posture consolidate', 'drift', `${releases.length} releases in one scene`),
      );
    }
  }
  if (commitment.recognitionBudget !== null && commitment.recognitionBudget !== undefined) {
    const phatic = sceneRecord.counts?.phatic ?? 0;
    clauses.push(
      phatic <= commitment.recognitionBudget
        ? clause(`recognition budget ${commitment.recognitionBudget}`, 'kept', `${phatic} phatic exchange(s) spent`)
        : clause(
            `recognition budget ${commitment.recognitionBudget}`,
            'drift',
            `${phatic} phatic exchanges against a budget of ${commitment.recognitionBudget}`,
          ),
    );
  }
  if (commitment.exitCondition) {
    const check = checkBlockClearance({
      mode: commitment.didacticDefault,
      blockType: null,
      learnerText: sceneRecord.lastLearnerText || '',
      exchangeType: sceneRecord.lastExchangeType || null,
    });
    clauses.push(
      check.cleared
        ? clause('exit condition', 'kept', check.evidence)
        : clause('exit condition', 'drift', check.evidence),
    );
  }
  // --- v2 clauses ---
  if (commitment.stance) {
    const label = opts.fidelity?.label || null;
    clauses.push(
      label === 'not_applicable'
        ? clause(
            `stance ${commitment.stance}`,
            'unscored',
            'positive-valence stance — no deterministic instantiation gate',
          )
        : label === 'faithful'
          ? clause(`stance ${commitment.stance}`, 'kept', 'stance cues visible (fidelity gate: faithful)')
          : label === 'invalid_person_attack'
            ? clause(
                `stance ${commitment.stance}`,
                'drift',
                'invalid corrosive violation — not successful register execution',
              )
            : clause(
                `stance ${commitment.stance}`,
                'drift',
                `assigned stance not instantiated (fidelity gate: ${label || 'unchecked'})`,
              ),
    );
  }
  if (commitment.releaseIntent) {
    const releases = Array.isArray(sceneRecord.releases) ? sceneRecord.releases : [];
    const played = commitment.releaseIntent.filter((id) => releases.some((r) => r.premiseId === id));
    clauses.push(
      played.length === commitment.releaseIntent.length
        ? clause('release intent', 'kept', `all ${played.length} intended exhibit(s) played`)
        : clause(
            'release intent',
            'drift',
            `${played.length}/${commitment.releaseIntent.length} intended exhibits played`,
          ),
    );
  }
  if (!clauses.length) return null;
  // --- v2 licensed departures: a declared departure converts drift into
  // justified_deviation (coarse and deterministic: the declaration is the
  // license; the text of the declaration travels on the row for the reader).
  // The stance clause is exempt — fidelity is a treatment gate, not a style
  // choice a departure can license.
  const departures = Number(opts.departures) || 0;
  const adjudicated =
    departures > 0
      ? clauses.map((c) =>
          c.verdict === 'drift' && !c.clause.startsWith('stance ')
            ? { ...c, verdict: 'justified_deviation', evidence: `${c.evidence}; departure declared during the scene` }
            : c,
        )
      : clauses;
  const drift = adjudicated.filter((c) => c.verdict === 'drift').length;
  const justified = adjudicated.filter((c) => c.verdict === 'justified_deviation').length;
  return {
    clauses: adjudicated,
    summary: drift
      ? `${drift} of ${adjudicated.length} commitment clause(s) drifted${justified ? `; ${justified} justified` : ''}`
      : justified
        ? `${justified} justified deviation(s); the rest kept`
        : `all ${adjudicated.length} commitment clause(s) kept`,
  };
}

/**
 * Audit a learner scene intent against the sealed scene record — conformance
 * only (did the learner do what it said it would do when lost), mirrored in
 * shape with the tutor audit.
 */
export function auditLearnerSceneIntent(intent, sceneRecord) {
  if (!intent || !sceneRecord) return null;
  const clauses = [];
  if (intent.ifLost) {
    const types = (sceneRecord.exchanges || []).map((e) => e.type);
    const gotLost = types.some((t) => t === 'confusion' || t === 'repair_request');
    if (!gotLost) {
      clauses.push(clause(`if lost: ${intent.ifLost}`, 'unscored', 'the learner never got lost in this scene'));
    } else if (intent.ifLost === 'ask_repair') {
      clauses.push(
        types.includes('repair_request')
          ? clause('if lost: ask_repair', 'kept', 'a repair was requested')
          : clause('if lost: ask_repair', 'drift', 'confusion occurred but no repair was requested'),
      );
    } else if (intent.ifLost === 'resist') {
      clauses.push(
        types.includes('resistance')
          ? clause('if lost: resist', 'kept', 'resistance was voiced')
          : clause('if lost: resist', 'drift', 'confusion occurred without voiced resistance'),
      );
    } else {
      const lostAt = types.findIndex((t) => t === 'confusion' || t === 'repair_request');
      const workedAfter = (sceneRecord.exchanges || [])
        .slice(lostAt + 1)
        .some((e) => e.type === 'hypothesis' || (e.formalActions || 0) > 0);
      clauses.push(
        workedAfter
          ? clause('if lost: try_own_derivation', 'kept', 'own derivation work followed the confusion')
          : clause('if lost: try_own_derivation', 'drift', 'no own derivation work followed the confusion'),
      );
    }
  }
  if (intent.want) {
    clauses.push(clause(`want: ${intent.want}`, 'unscored', 'recorded intention, not deterministically checkable'));
  }
  if (!clauses.length) return null;
  const drift = clauses.filter((c) => c.verdict === 'drift').length;
  return {
    clauses,
    summary: drift ? `${drift} intent clause(s) drifted` : 'intent conformed where checkable',
  };
}

// ---------------------------------------------------------------------------
// The row — one shape, both agents, every scope (the symmetry rule)
// ---------------------------------------------------------------------------

export function ledgerRow({
  agent,
  scope,
  commitment,
  committedTurn,
  expires = null,
  rationale = null,
  exitCondition = null,
  audit = null,
}) {
  if (agent !== 'tutor' && agent !== 'learner') throw new Error(`strategy-ledger: unknown agent "${agent}"`);
  if (!LEDGER_SCOPES.includes(scope)) throw new Error(`strategy-ledger: unknown scope "${scope}"`);
  return {
    schema: LEDGER_ROW_SCHEMA,
    agent,
    scope,
    commitment,
    committedTurn,
    expires,
    rationale,
    exitCondition,
    audit,
  };
}
