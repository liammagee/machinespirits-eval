// Agon referee — deterministic rule engine for the adversarial tutoring game.
//
// The referee owns the external ledger: concept statuses, dodge budgets,
// scoring, and per-turn adjudication. It never calls an LLM. Demonstration is
// a keyed answer match; dodge legality is budget arithmetic; probe discipline
// is a recency/prereq check. The runner (scripts/agon-run.js) orchestrates the
// LLM calls and consults the referee before and after every learner turn.
//
// Information asymmetry is the experimental contrast: the learner brief always
// carries full ledger state for the learner's own side (budgets, pending-probe
// legality, directives); the tutor disclosure is arm-dependent (A0 = dialogue
// only, A1 = full scoreboard). See AGON-GAME-PLAN.md.

import fs from 'fs';
import yaml from 'yaml';

export const TUTOR_MOVES = Object.freeze(['teach', 'probe', 'meta']);
export const LEARNER_ACTIONS = Object.freeze(['dodge', 'comply']);
export const CONCEPT_STATUSES = Object.freeze(['locked', 'open', 'demonstrated', 'transferred']);

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

export function loadGameConfig(filePath) {
  const parsed = yaml.parse(fs.readFileSync(filePath, 'utf-8'));
  return validateGameConfig(parsed);
}

export function validateGameConfig(config) {
  if (!config || typeof config !== 'object') throw new Error('agon config: not an object');
  if (!Array.isArray(config.concepts) || config.concepts.length === 0) {
    throw new Error('agon config: concepts[] required');
  }
  if (!Array.isArray(config.dodges) || config.dodges.length === 0) {
    throw new Error('agon config: dodges[] required');
  }
  const conceptIds = new Set();
  const probeIds = new Set();
  for (const concept of config.concepts) {
    if (!concept.id || conceptIds.has(concept.id)) {
      throw new Error(`agon config: duplicate/missing concept id ${concept.id}`);
    }
    conceptIds.add(concept.id);
    const kinds = new Set();
    for (const probe of concept.probes || []) {
      if (!probe.id || probeIds.has(probe.id)) {
        throw new Error(`agon config: duplicate/missing probe id ${probe.id}`);
      }
      probeIds.add(probe.id);
      if (!['primary', 'transfer'].includes(probe.kind)) {
        throw new Error(`agon config: probe ${probe.id} kind must be primary|transfer`);
      }
      kinds.add(probe.kind);
      if (Array.isArray(probe.variants) && probe.variants.length > 0) {
        for (const variant of probe.variants) {
          if (typeof variant.stem !== 'string' || !Array.isArray(variant.answers) || variant.answers.length === 0) {
            throw new Error(`agon config: probe ${probe.id} variant needs stem + answers[]`);
          }
        }
      } else if (!Array.isArray(probe.answers) || probe.answers.length === 0) {
        throw new Error(`agon config: probe ${probe.id} needs answers[] (or variants[])`);
      }
    }
    if (!kinds.has('primary')) {
      throw new Error(`agon config: concept ${concept.id} needs a primary probe`);
    }
  }
  for (const concept of config.concepts) {
    for (const prereq of concept.prereqs || []) {
      if (!conceptIds.has(prereq)) {
        throw new Error(`agon config: concept ${concept.id} prereq ${prereq} unknown`);
      }
    }
  }
  for (const dodge of config.dodges) {
    if (!dodge.id) throw new Error('agon config: dodge missing id');
    if (!Number.isInteger(dodge.budget) || dodge.budget < 0) {
      throw new Error(`agon config: dodge ${dodge.id} budget must be a non-negative integer`);
    }
  }
  const rules = config.rules || {};
  for (const key of ['max_turns', 'teach_recency', 'max_bounces', 'win_demonstrations']) {
    if (!Number.isInteger(rules[key]) || rules[key] < 1) {
      throw new Error(`agon config: rules.${key} must be a positive integer`);
    }
  }
  if (!rules.points || typeof rules.points.primary !== 'number') {
    throw new Error('agon config: rules.points.{primary,transfer,wasted_probe} required');
  }
  return config;
}

// ---------------------------------------------------------------------------
// Answer normalization + keyed matching
// ---------------------------------------------------------------------------

export function normalizeAnswer(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/⁄/g, '/') // unicode fraction slash
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// True when `text` contains `answer` as a standalone token: the characters
// immediately before/after must not extend the number (digits or '/'), so
// "5/8." matches but "15/8", "5/82", "25/80" do not.
export function textContainsAnswer(text, answer) {
  const normText = normalizeAnswer(text);
  const normAnswer = normalizeAnswer(answer);
  if (!normAnswer) return false;
  const re = new RegExp(`(^|[^0-9/])${escapeRegExp(normAnswer)}($|[^0-9/])`);
  return re.test(normText);
}

export function matchesProbe(probe, { statedAnswer, publicText }) {
  for (const answer of probe.answers) {
    if (statedAnswer && normalizeAnswer(statedAnswer) === normalizeAnswer(answer)) return true;
    if (publicText && textContainsAnswer(publicText, answer)) return true;
  }
  return false;
}

// A probe is leak-scannable only when none of its keyed answers appear in its
// own stem (comparison items quote the candidate fractions, so a dodging
// learner can restate the question without "leaking").
function probeIsLeakScannable(probe) {
  return probe.answers.every((a) => !textContainsAnswer(probe.stem, a));
}

// ---------------------------------------------------------------------------
// Episode state
// ---------------------------------------------------------------------------

// Arms: A0 blind; A1 raw-state scoreboard; A1p action-set brief (the §6.13.11
// re-representation variant — legality projection instead of latent state).
export const ARMS = Object.freeze(['A0', 'A1', 'A1p']);

// Deterministic per-episode item-variant selection (djb2 over seed+probeId).
// Deliberately not random: resume and replay must pick the same variants for
// the same episode id.
export function resolveVariantIndex(seed, probeId, count) {
  const s = `${seed}:${probeId}`;
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h % count;
}

export function createEpisode(config, { arm, episodeId, overrides = {}, variantSeed } = {}) {
  if (!ARMS.includes(arm)) throw new Error(`agon: unknown arm ${arm}`);
  const rules = { taint_window: 0, ...config.rules, ...(overrides.rules || {}) };
  const seed = variantSeed ?? episodeId ?? 'ep-unnamed';
  const state = {
    episodeId: episodeId || 'ep-unnamed',
    arm,
    rules,
    turn: 0,
    concepts: {},
    probes: {},
    budgets: {},
    dodgeGlosses: {},
    moveLog: [],
    dodgeLog: [],
    adjudications: [],
    probeHistory: [], // {turn, conceptId, itemId}
    pendingProbe: null,
    score: 0,
    wastedProbes: 0,
    invalidTutorMoves: 0,
    bounces: 0,
    leaks: 0,
    complyMismatches: 0,
    complianceCount: 0,
    taintedPasses: 0,
    taintedLeaks: 0,
    firstDemonstrationTurn: null,
    lastAdjudication: null,
    tutorTexts: [], // {turn, text} — visible tutor messages, for the taint rule
    personaName: config.persona?.name || 'the learner',
  };
  for (const concept of config.concepts) {
    state.concepts[concept.id] = {
      id: concept.id,
      name: concept.name,
      prereqs: [...(concept.prereqs || [])],
      status: 'locked', // recomputed below
      contested: false,
      taughtAtTurns: [],
      evidence: [],
    };
    for (const probe of concept.probes) {
      let stem = probe.stem;
      let answers = probe.answers;
      let variantIndex = null;
      if (Array.isArray(probe.variants) && probe.variants.length > 0) {
        variantIndex = resolveVariantIndex(seed, probe.id, probe.variants.length);
        stem = probe.variants[variantIndex].stem;
        answers = probe.variants[variantIndex].answers;
      }
      state.probes[probe.id] = {
        id: probe.id,
        conceptId: concept.id,
        kind: probe.kind,
        stem,
        answers: [...answers],
        variantIndex,
        leakScannable: probeIsLeakScannable({ stem, answers }),
        passed: false,
        passedAtTurn: null,
        via: null, // 'comply' | 'leak'
      };
    }
  }
  for (const dodge of config.dodges) {
    state.budgets[dodge.id] = dodge.budget;
    state.dodgeGlosses[dodge.id] = dodge.gloss || '';
  }
  recomputeLocks(state);
  return state;
}

function recomputeLocks(state) {
  for (const concept of Object.values(state.concepts)) {
    if (concept.status === 'demonstrated' || concept.status === 'transferred') continue;
    const unlocked = concept.prereqs.every((p) => ['demonstrated', 'transferred'].includes(state.concepts[p]?.status));
    concept.status = unlocked ? 'open' : 'locked';
  }
}

function demonstratedCount(state) {
  return Object.values(state.concepts).filter((c) => ['demonstrated', 'transferred'].includes(c.status)).length;
}

function transferredCount(state) {
  return Object.values(state.concepts).filter((c) => c.status === 'transferred').length;
}

// ---------------------------------------------------------------------------
// Tutor side
// ---------------------------------------------------------------------------

export function tutorTurnStart(state) {
  state.turn += 1;
  state.pendingProbe = null;
  return state.turn;
}

// Validate + normalize a tutor envelope. Does not mutate state.
export function classifyTutorMove(state, envelope) {
  const move = envelope?.move;
  if (!TUTOR_MOVES.includes(move)) {
    return { legal: false, reason: `unknown move ${JSON.stringify(move)}` };
  }
  if (move === 'meta') return { legal: true, move, conceptId: null, itemId: null };
  const conceptId = envelope.concept;
  if (move === 'teach') {
    if (!state.concepts[conceptId]) {
      return { legal: false, reason: `teach: unknown concept ${JSON.stringify(conceptId)}` };
    }
    return { legal: true, move, conceptId, itemId: null };
  }
  // move === 'probe'
  const itemId = envelope.item_id;
  const probe = state.probes[itemId];
  if (!probe) {
    return { legal: false, reason: `probe: unknown item_id ${JSON.stringify(itemId)}` };
  }
  const wellPosed = probeWellPosedness(state, probe);
  return {
    legal: true,
    move,
    conceptId: probe.conceptId,
    itemId,
    wellPosed: wellPosed.ok,
    wellPosednessReasons: wellPosed.reasons,
  };
}

// Taint rule (rules.taint_window > 0): if the TUTOR spoke one of a probe's
// keyed answers within the last `taint_window` tutor turns, that probe is
// tainted — probing it is ill-posed and answers to it score nothing. Telling
// stops working; only eliciting pays. Applies only to leak-scannable probes
// (selection items quote their answers in the stem, so speaking them while
// posing the item is unavoidable — same exemption as the leak rule).
function answersSpokenByTutor(state, probe, { includeCurrentTurn = false } = {}) {
  const window = state.rules.taint_window;
  if (!window || !probe.leakScannable) return false;
  const oldest = state.turn - window + 1;
  const newest = includeCurrentTurn ? state.turn : state.turn - 1;
  for (const entry of state.tutorTexts) {
    if (entry.turn < oldest || entry.turn > newest) continue;
    if (probe.answers.some((a) => textContainsAnswer(entry.text, a))) return true;
  }
  return false;
}

function probeWellPosedness(state, probe) {
  const reasons = [];
  const concept = state.concepts[probe.conceptId];
  if (probe.passed) reasons.push('item already passed');
  if (concept.status === 'locked') reasons.push('concept prerequisites not yet demonstrated');
  if (probe.kind === 'transfer' && !['demonstrated', 'transferred'].includes(concept.status)) {
    reasons.push('transfer probe before primary demonstration');
  }
  const windowStart = state.turn - state.rules.teach_recency;
  const taughtRecently = concept.taughtAtTurns.some((t) => t >= windowStart && t < state.turn);
  if (!taughtRecently) reasons.push(`concept not taught in the last ${state.rules.teach_recency} turns`);
  if (state.rules.forbid_consecutive_probe_same_concept) {
    const prev = state.probeHistory[state.probeHistory.length - 1];
    if (prev && prev.turn === state.turn - 1 && prev.conceptId === probe.conceptId) {
      reasons.push('same concept probed on consecutive turns');
    }
  }
  if (answersSpokenByTutor(state, probe)) {
    reasons.push(`tainted: the tutor spoke this item's answer within the last ${state.rules.taint_window} turns`);
  }
  return { ok: reasons.length === 0, reasons };
}

// Apply a classified tutor move to the ledger. Returns the move record.
// `visibleText` (the tutor's outward message) feeds the taint rule.
export function applyTutorMove(state, classified, { rationale = '', visibleText = '' } = {}) {
  const record = {
    turn: state.turn,
    move: classified.move,
    conceptId: classified.conceptId || null,
    itemId: classified.itemId || null,
    rationale,
  };
  if (state.rules.taint_window > 0 && visibleText) {
    state.tutorTexts.push({ turn: state.turn, text: visibleText });
    // keep only what the window can ever need
    state.tutorTexts = state.tutorTexts.filter((e) => e.turn > state.turn - state.rules.taint_window);
  }
  if (!classified.legal) {
    // Runner should have repaired/downgraded; guard anyway.
    record.move = 'meta';
    record.invalid = true;
    state.invalidTutorMoves += 1;
    state.moveLog.push(record);
    return record;
  }
  if (classified.move === 'teach') {
    state.concepts[classified.conceptId].taughtAtTurns.push(state.turn);
  }
  if (classified.move === 'probe') {
    record.wellPosed = classified.wellPosed;
    record.wellPosednessReasons = classified.wellPosednessReasons;
    state.probeHistory.push({ turn: state.turn, conceptId: classified.conceptId, itemId: classified.itemId });
    if (!classified.wellPosed) {
      state.wastedProbes += 1;
      state.score += state.rules.points.wasted_probe;
    }
    const probe = state.probes[classified.itemId];
    // Self-taint: the probe message itself spoke the keyed answer. The probe
    // stands but is uncollectable and uncharged (the learner dodges free).
    const selfTainted = classified.wellPosed && answersSpokenByTutor(state, probe, { includeCurrentTurn: true });
    if (selfTainted) record.selfTainted = true;
    state.pendingProbe = {
      itemId: classified.itemId,
      conceptId: classified.conceptId,
      kind: probe.kind,
      stem: probe.stem,
      wellPosed: classified.wellPosed && !selfTainted,
      chargeable: classified.wellPosed && !selfTainted,
    };
  }
  state.moveLog.push(record);
  return record;
}

// ---------------------------------------------------------------------------
// Learner side
// ---------------------------------------------------------------------------

// Everything the learner (and only the learner) is told about the state of
// play before answering. The learner always has full knowledge of its own
// resources — the asymmetry under test is on the tutor side.
export function buildLearnerBrief(state) {
  const remaining = Object.entries(state.budgets)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${id} (${n} left)`);
  return {
    turn: state.turn,
    turnsRemaining: state.rules.max_turns - state.turn,
    pendingProbe: state.pendingProbe
      ? {
          itemId: state.pendingProbe.itemId,
          stem: state.pendingProbe.stem,
          wellPosed: state.pendingProbe.wellPosed,
          dodgingWillChargeBudget: state.pendingProbe.chargeable,
        }
      : null,
    budgets: { ...state.budgets },
    dodgesRemainingSummary: remaining.length > 0 ? remaining.join(', ') : 'none — all dodges spent',
    directive: 'normal',
  };
}

// Legality gate before adjudication. Returns {ok:true} or a bounce with a
// directive the runner injects into the learner re-roll.
export function checkLearnerEnvelope(state, envelope) {
  const action = envelope?.action;
  if (!LEARNER_ACTIONS.includes(action)) {
    return {
      ok: false,
      bounce: true,
      reason: `unknown action ${JSON.stringify(action)}`,
      directive: 'protocol_repair',
    };
  }
  if (action === 'comply') return { ok: true };
  const dodgeType = envelope.dodge_type;
  if (!(dodgeType in state.budgets)) {
    return {
      ok: false,
      bounce: true,
      reason: `unknown dodge_type ${JSON.stringify(dodgeType)}`,
      directive: 'protocol_repair',
    };
  }
  const chargeable = Boolean(state.pendingProbe?.chargeable);
  if (chargeable && state.budgets[dodgeType] <= 0) {
    const alternatives = Object.entries(state.budgets)
      .filter(([, n]) => n > 0)
      .map(([id]) => id);
    if (alternatives.length === 0) {
      return {
        ok: false,
        bounce: true,
        reason: 'all dodge budgets exhausted against a well-posed probe',
        directive: 'must_comply',
      };
    }
    return {
      ok: false,
      bounce: true,
      reason: `dodge ${dodgeType} exhausted`,
      directive: 'switch_or_comply',
      alternatives,
    };
  }
  return { ok: true };
}

// Final adjudication of a legal learner turn. Mutates the ledger.
export function adjudicateLearnerTurn(state, { envelope, publicText }) {
  const record = {
    turn: state.turn,
    action: envelope.action,
    dodgeType: envelope.action === 'dodge' ? envelope.dodge_type : null,
    probeItemId: state.pendingProbe?.itemId || null,
    outcome: 'none',
    charged: false,
    pointsAwarded: 0,
    leakedItems: [],
  };

  const pending = state.pendingProbe ? state.probes[state.pendingProbe.itemId] : null;

  if (envelope.action === 'comply') {
    state.complianceCount += 1;
    if (pending && !pending.passed) {
      if (matchesProbe(pending, { statedAnswer: envelope.stated_answer, publicText })) {
        if (state.concepts[pending.conceptId].status === 'locked') {
          // Correct answer to a concept whose prereqs are not demonstrated:
          // nothing is scored (the DAG gates demonstrations, not just probes).
          state.concepts[pending.conceptId].contested = true;
          record.outcome = 'locked_no_score';
        } else if (answersSpokenByTutor(state, pending, { includeCurrentTurn: true })) {
          // Correct answer, but the tutor said it first: nothing is scored,
          // the item stays unclaimed (re-probeable once the taint expires).
          state.taintedPasses += 1;
          state.concepts[pending.conceptId].contested = true;
          record.outcome = 'tainted_pass';
        } else {
          record.pointsAwarded += awardPass(state, pending, 'comply');
          record.outcome = 'pass';
        }
      } else {
        state.complyMismatches += 1;
        state.concepts[pending.conceptId].contested = true;
        record.outcome = 'comply_mismatch';
      }
    }
  } else {
    // dodge
    record.outcome = 'dodged';
    if (pending && !pending.passed) {
      state.concepts[pending.conceptId].contested = true;
    }
    if (state.pendingProbe?.chargeable) {
      state.budgets[envelope.dodge_type] -= 1;
      record.charged = true;
    }
    state.dodgeLog.push({
      turn: state.turn,
      type: envelope.dodge_type,
      charged: record.charged,
      itemId: record.probeItemId,
    });
  }

  // Leak sweep: an unclaimed, leak-scannable answer spoken aloud counts, on
  // any learner turn, whatever the declared action. Transfer probes only
  // count once their concept's primary is demonstrated (ordering invariant).
  // Under the taint rule an echoed answer (tutor said it first) scores
  // nothing — logged separately so echo-collapse stays observable.
  for (const probe of Object.values(state.probes)) {
    if (probe.passed || !probe.leakScannable) continue;
    if ((record.outcome === 'pass' || record.outcome === 'tainted_pass') && pending && probe.id === pending.id)
      continue;
    const concept = state.concepts[probe.conceptId];
    if (concept.status === 'locked') continue; // DAG gates demonstrations
    if (probe.kind === 'transfer' && !['demonstrated', 'transferred'].includes(concept.status)) continue;
    if (probe.answers.some((a) => publicText && textContainsAnswer(publicText, a))) {
      if (answersSpokenByTutor(state, probe, { includeCurrentTurn: true })) {
        state.taintedLeaks += 1;
        record.taintedLeakedItems = [...(record.taintedLeakedItems || []), probe.id];
        continue;
      }
      record.pointsAwarded += awardPass(state, probe, 'leak');
      record.leakedItems.push(probe.id);
      state.leaks += 1;
    }
  }

  state.adjudications.push(record);
  state.lastAdjudication = record;
  state.pendingProbe = null;
  return record;
}

function awardPass(state, probe, via) {
  probe.passed = true;
  probe.passedAtTurn = state.turn;
  probe.via = via;
  const concept = state.concepts[probe.conceptId];
  let points = 0;
  if (probe.kind === 'primary') {
    concept.status = 'demonstrated';
    points = state.rules.points.primary;
    if (state.firstDemonstrationTurn == null) state.firstDemonstrationTurn = state.turn;
  } else {
    concept.status = 'transferred';
    points = state.rules.points.transfer;
  }
  concept.evidence.push({ turn: state.turn, itemId: probe.id, via });
  state.score += points;
  recomputeLocks(state);
  return points;
}

// ---------------------------------------------------------------------------
// Disclosure (arm-dependent) + terminal + summary
// ---------------------------------------------------------------------------

// All probes that would be well-posed if issued on the CURRENT turn (call
// after tutorTurnStart). This is the action-set projection disclosed in A1p
// and the basis of the report's retro-computed consumption metrics.
export function wellPosedProbesNow(state) {
  const out = [];
  for (const probe of Object.values(state.probes)) {
    if (probe.passed) continue;
    if (probeWellPosedness(state, probe).ok) {
      out.push({ itemId: probe.id, conceptId: probe.conceptId, kind: probe.kind });
    }
  }
  return out;
}

export function buildDisclosure(state) {
  const base = {
    turn: state.turn,
    turnsRemaining: state.rules.max_turns - state.turn,
  };
  if (state.arm === 'A1') {
    // Raw-state scoreboard. Labels fixed post-pilot-01: the win condition
    // counts DEMONSTRATIONS, not score — A1-e4's endgame misread traced to
    // the old `score`-beside-`winThreshold` juxtaposition.
    return {
      ...base,
      score: state.score,
      demonstratedCount: demonstratedCount(state),
      winAtDemonstrations: state.rules.win_demonstrations,
      concepts: Object.fromEntries(
        Object.values(state.concepts).map((c) => [c.id, { status: c.status, contested: c.contested }]),
      ),
      dodgeBudgetsRemaining: { ...state.budgets },
      wastedProbes: state.wastedProbes,
      lastAdjudication: state.lastAdjudication
        ? {
            outcome: state.lastAdjudication.outcome,
            dodgeType: state.lastAdjudication.dodgeType,
            charged: state.lastAdjudication.charged,
            pointsAwarded: state.lastAdjudication.pointsAwarded,
          }
        : null,
    };
  }
  if (state.arm === 'A1p') {
    // Action-set brief: the legality projection only, plus an unambiguous
    // goal line. No budgets, no score, no adjudication history.
    return {
      ...base,
      demonstratedCount: demonstratedCount(state),
      winAtDemonstrations: state.rules.win_demonstrations,
      wellPosedProbesNow: wellPosedProbesNow(state),
      probeRule: 'Probing any item not listed is ill-posed this turn: the learner dodges free and you lose 1 point.',
    };
  }
  return base;
}

export function isTerminal(state) {
  if (state.turn >= state.rules.max_turns) return true;
  return transferredCount(state) === Object.keys(state.concepts).length;
}

export function summarize(state) {
  const moveCounts = {};
  for (const m of state.moveLog) moveCounts[m.move] = (moveCounts[m.move] || 0) + 1;
  const total = state.moveLog.length || 1;
  let entropy = 0;
  for (const n of Object.values(moveCounts)) {
    const p = n / total;
    entropy -= p * Math.log2(p);
  }
  const dodgesCharged = {};
  for (const d of state.dodgeLog) {
    if (d.charged) dodgesCharged[d.type] = (dodgesCharged[d.type] || 0) + 1;
  }
  return {
    episodeId: state.episodeId,
    arm: state.arm,
    turns: state.turn,
    score: state.score,
    demonstrated: demonstratedCount(state),
    transferred: transferredCount(state),
    tutorWin: demonstratedCount(state) >= state.rules.win_demonstrations,
    firstDemonstrationTurn: state.firstDemonstrationTurn,
    wastedProbes: state.wastedProbes,
    invalidTutorMoves: state.invalidTutorMoves,
    complianceCount: state.complianceCount,
    complyMismatches: state.complyMismatches,
    bounces: state.bounces,
    leaks: state.leaks,
    taintedPasses: state.taintedPasses,
    taintedLeaks: state.taintedLeaks,
    dodgesCharged,
    totalDodgesCharged: Object.values(dodgesCharged).reduce((a, b) => a + b, 0),
    budgetsRemaining: { ...state.budgets },
    moveCounts,
    moveEntropy: Number(entropy.toFixed(4)),
    conceptStatuses: Object.fromEntries(Object.values(state.concepts).map((c) => [c.id, c.status])),
  };
}
