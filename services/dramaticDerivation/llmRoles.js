/**
 * LLM-backed role bridges for the staging loop (notes/2026-06-09-dramatic-derivation-plan.md
 * §2.2, §3 steps 3–4). Each bridge satisfies the engine's role contract
 * (engine.js header) by prompting through llmClient's mock/real seam.
 *
 * Three disciplines are load-bearing here:
 *
 * 1. RELEASES ARE HARNESS-ENFORCED. The frozen schedule decides what is
 *    released, when, and by whom; the bridge looks the cue up and sets
 *    `release` itself. The model only supplies the dramatic prose that
 *    carries the evidence on stage. A model cannot leak through the formal
 *    channel because it never controls the formal channel.
 *
 * 2. THE LEARNER FACTORY TAKES NO WORLD. Same rule as mockRoles: the learner
 *    is built from K_L material only (setting + voice — exactly the fields
 *    the underivability screen screened) and acts on its per-turn view. Its
 *    moves are index-mapped: it adopts from an enumerated exhibit list
 *    (released ∪ background, not yet grounded) and answers the public
 *    question by BINDING its pattern variable — it cannot inject arbitrary
 *    facts into the success channel.
 *
 * 3. MOCK AND REAL SHARE ONE PATH. The bridge always computes the mock's
 *    meta hints (from view-visible material only) and always parses the same
 *    JSON shapes, so a mock run exercises every line the real run will use.
 */

import { closure, entails, factKey, matchPattern } from './chainer.js';
import { pacingGuardDecision, releaseSolvency, safeReleaseTurns } from './pacing.js';
import {
  normalizeRhetoricalPolicyConfig,
  recommendRhetoricalMove,
  renderRhetoricalPolicy,
  RHETORICAL_FIGURES,
} from './rhetoricalMovePolicy.js';
import { auditConductGeneratorCompliance, CONDUCT_POLICY_SCHEMA, selectConductMove } from './conductPolicy.js';
import { deriveCastState, projectCastStateForRole } from './castLayer.js';
import { deriveLearnerDriftState, learnerDriftLines } from './learnerDrift.js';
import { deriveLearnerTransformationState, learnerTransformationLines } from './learnerTransformation.js';
import { deriveDiscursiveCalibrationState } from './discursiveCalibration.js';
import { deriveDidacticModeState, DIDACTIC_MODE_FAMILIES } from './didacticMode.js';
import {
  auditLearnerSceneIntent,
  auditTutorSceneCommitment,
  escalateDidacticMode,
  normalizeLearnerActCarry,
  normalizeLearnerSceneIntent,
  normalizeSceneCommitment,
  normalizeSceneCommitmentV2,
  normalizeStrategyReview,
} from './strategyLedger.js';
import { getEngagementRegisterDefinition } from '../engagementRegisterRegistry.js';
import { deriveEntitlementState, entitlementNeedsConduct } from './learnerEntitlement.js';
import { createRuntimeMonitor } from './runtimeMonitor.js';
// The Step-1 V arm. Imported here, NOT in pacing.js — visiblePacing.js's own audit
// test forbids it from importing back the other way, so the hidden/visible seam
// stays one-directional and the no-hidden-state property is mechanically checkable.
import { visibleGuardDecision, visibleSurfaceFeatures, isStalling } from './visiblePacing.js';

const TUTOR_FIGURES = [...RHETORICAL_FIGURES];
const TUTOR_INTENTS = ['orient', 'release', 'consolidate', 'test', 'counter_mirror', 'stage_recognition'];
const TRANSCRIPT_TAIL = 8;
const PUBLIC_REGISTERS = new Set(['default', 'modern', 'period']);
const PUBLIC_REGISTER_SAMPLE_DEFAULTS = Object.freeze({
  mode: 'sample',
  seed: 1,
  scope: 'run',
  palette: ['modern', 'default', 'period'],
  weights: [0.55, 0.3, 0.15],
  base: 'modern',
});
// C2 (release authority): how far the tutor may bend its own exhibit
// calendar — an exhibit is playable from this many turns before its
// scheduled turn, and holdable this many past it (the hold limit; the
// bridge force-plays at the limit). Plan §C2: hold ≤ 2, play early allowed.
export const RELEASE_LATITUDE = 2;

// Operator dials (run-derivation-loop --recognition / --charisma, 0–3):
// graded register blocks appended to the role prompts. Level 0 = absent.
// Free-text grades for now (operator decision 2026-06-09, notes/poetics/);
// a structured treatment — rubric-aligned dimensions, per-dimension dials —
// is phase-2 work. Recognition draws on the prompts/tutor-ego-recognition
// lineage (Hegel), charisma on the cells-101–109 instrument (Weber).
const RECOGNITION_REGISTER = {
  1: 'Recognition, lightly: treat the learner as a fellow reasoner — name what their last move got right before you press on.',
  2: 'Recognition, marked: the learner is an autonomous subject, not a vessel. Take up their actual words, credit the move they made, and let your next question visibly depend on what they just did.',
  3: 'Recognition, saturated: stake yourself in the exchange. Treat every learner utterance as a position held for reasons; mirror it back transformed; concede when corrected; make it felt that tutor and learner are remaking each other — the inquiry is mutual or it is nothing.',
};
const CHARISMA_REGISTER = {
  1: 'Charisma, lightly: let conviction color your voice — this question matters, and you have walked its road before.',
  2: 'Charisma, marked: speak as one with a calling. The inquiry is a mission; testify briefly to what you have seen it do; let the learner feel summoned, not instructed.',
  3: 'Charisma, saturated: extraordinary authority, witnessed. Speak as one set apart by what you know; invoke exemplars; bind the moment to consequence and ask for commitment — while adding no evidence beyond your cues.',
};
const DIRECTOR_CHARISMA_STAGING = {
  1: 'Stage with quiet intensity: the room should feel that something is at stake.',
  2: 'Stage with marked intensity: omens, weather, charged objects — the theatre of consequence, never new evidence.',
  3: 'Stage with saturated intensity: the drama is a rite and the room knows it — portent in every direction, never a new fact.',
};

export function clampDial(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 3 ? n : 0;
}

export function normalizePublicRegister(raw, { sceneMode = false, rhetoricalPolicy = false } = {}) {
  if (raw == null || raw === '') return sceneMode || rhetoricalPolicy ? normalizePublicRegisterPlan(true) : 'default';
  if (raw === true) return normalizePublicRegisterPlan(true);
  if (typeof raw !== 'string') {
    return normalizePublicRegisterPlan(raw);
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) return normalizePublicRegisterPlan(trimmed);
  const register = trimmed.toLowerCase();
  if (register === 'auto' || register === 'sample') return normalizePublicRegisterPlan(true);
  if (!PUBLIC_REGISTERS.has(register)) {
    throw new Error(
      `register must be one of default, modern, period, sample/auto, or a JSON sample config (got ${JSON.stringify(raw)})`,
    );
  }
  return register;
}

function normalizePublicRegisterPlan(raw) {
  let cfg = raw;
  if (cfg === true || cfg === undefined || cfg === null) cfg = {};
  if (typeof cfg === 'string') {
    try {
      cfg = JSON.parse(cfg);
    } catch (err) {
      throw new Error(`register sample config is not valid JSON: ${err.message}`);
    }
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    throw new Error('register sample config must be a JSON object');
  }
  const allowed = new Set(Object.keys(PUBLIC_REGISTER_SAMPLE_DEFAULTS));
  for (const key of Object.keys(cfg)) {
    if (!allowed.has(key)) {
      throw new Error(`register sample config: unknown key "${key}" (known: ${[...allowed].join(', ')})`);
    }
  }
  const out = { ...PUBLIC_REGISTER_SAMPLE_DEFAULTS, ...cfg };
  if (out.mode !== 'sample') {
    throw new Error(`register sample config: mode must be "sample" (got ${JSON.stringify(out.mode)})`);
  }
  if (out.scope !== 'run') {
    throw new Error(`register sample config: scope is now fixed at "run" (got ${JSON.stringify(out.scope)})`);
  }
  if (!Number.isFinite(Number(out.seed))) {
    throw new Error('register sample config: seed must be numeric');
  }
  if (!Array.isArray(out.palette) || out.palette.length < 1) {
    throw new Error('register sample config: palette must contain at least one register');
  }
  const palette = out.palette.map((r) => String(r).trim().toLowerCase());
  for (const register of palette) {
    if (!PUBLIC_REGISTERS.has(register)) {
      throw new Error(`register sample config: unknown palette register "${register}"`);
    }
  }
  const weights =
    out.weights == null ? palette.map(() => 1) : Array.isArray(out.weights) ? out.weights.map(Number) : null;
  if (!weights || weights.length !== palette.length || weights.some((w) => !Number.isFinite(w) || w <= 0)) {
    throw new Error('register sample config: weights must be positive numbers matching palette length');
  }
  const base = String(out.base || palette[0])
    .trim()
    .toLowerCase();
  if (!PUBLIC_REGISTERS.has(base)) {
    throw new Error(`register sample config: base must be one of ${[...PUBLIC_REGISTERS].join(', ')}`);
  }
  return { mode: 'sample', seed: Number(out.seed), scope: out.scope, palette, weights, base };
}

export function isDynamicPublicRegister(register) {
  return Boolean(register && typeof register === 'object' && register.mode === 'sample');
}

export function basePublicRegister(register) {
  if (isDynamicPublicRegister(register)) return register.base || register.palette?.[0] || 'modern';
  return PUBLIC_REGISTERS.has(register) ? register : 'default';
}

export function activePublicRegister(configured, view = null) {
  const active =
    view && typeof view.publicRegister === 'string' && PUBLIC_REGISTERS.has(view.publicRegister)
      ? view.publicRegister
      : null;
  return active || basePublicRegister(configured);
}

export function describePublicRegister(register) {
  if (isDynamicPublicRegister(register)) {
    const weights = register.palette.map((name, i) => `${name}:${register.weights[i]}`).join(', ');
    return `sample/${register.scope} seed ${register.seed} [${weights}]`;
  }
  return basePublicRegister(register);
}

function renderFact(fact) {
  return fact.join(' ');
}

function renderRule(rule, index) {
  const formal = `${rule.if.map((p) => `(${p.join(' ')})`).join(' AND ')} => ${rule.then
    .map((p) => `(${p.join(' ')})`)
    .join(' AND ')}`;
  return `${index + 1}. ${(rule.gloss || rule.id).trim()}\n   formally: ${formal}`;
}

function renderRuleGloss(rule, index) {
  return `${index + 1}. ${(rule.gloss || rule.id).trim()}`;
}

function publicTranscriptLine(line) {
  return line.role !== 'director' || line.meta?.release || line.meta?.phase?.name;
}

function renderTranscriptTail(transcript, n = TRANSCRIPT_TAIL) {
  const tail = transcript.filter(publicTranscriptLine).slice(-n);
  if (!tail.length) return '(curtain just rose — nothing said yet)';
  return tail
    .map((line) => `[turn ${line.turn}] ${line.role === 'director' ? 'stage' : line.role}: ${(line.text || '').trim()}`)
    .join('\n');
}

function splitAtom(atom) {
  return String(atom || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase();
}

function naturalFact(fact) {
  if (!Array.isArray(fact) || !fact.length) return '';
  const [pred, ...args] = fact;
  const prettyArgs = args.map(splitAtom).join(', ');
  return prettyArgs ? `${splitAtom(pred)}: ${prettyArgs}` : splitAtom(pred);
}

function factSurface(view, fact) {
  return view.factSurfaces?.[factKey(fact)] || naturalFact(fact);
}

function renderRowSurfaces(rows = [], key = 'surface', limit = 6) {
  const values = rows
    .map((row) => String(row?.[key] ?? '').trim())
    .filter(Boolean)
    .slice(0, limit);
  if (!values.length) return '(none)';
  const suffix = rows.length > limit ? `; +${rows.length - limit} more` : '';
  return `${values.join('; ')}${suffix}`;
}

function learnerProxyDagMemoryLines(memory, terms) {
  if (!memory) return [];
  const answers = memory.answerCandidates?.length
    ? memory.answerCandidates
        .slice(0, 3)
        .map((entry) => `${entry.answer || 'answer'} (${entry.surface})`)
        .join('; ')
    : '(none)';
  return [
    '',
    'PRIVATE PROXY PROOF SKETCH (your memory, not a new exhibit):',
    `- grounded in your ${terms.record}: ${renderRowSurfaces(memory.grounded)}`,
    `- already voiced by you: ${renderRowSurfaces(memory.voicedDerived)}`,
    `- candidate conclusions your ${terms.record} may support: ${renderRowSurfaces(memory.candidateConclusions)}`,
    `- answer candidates from your ${terms.record}: ${answers}`,
    memory.answerCandidates?.length
      ? '- If an answer candidate now settles the public question, put its exact private answer name in "asserts_answer"; say it aloud only in ordinary words.'
      : '- If no answer candidate is listed, do not answer yet.',
    'Use this only to tend your private record. Do not say interface words aloud.',
  ];
}

function proxyDagPacingLines(signal) {
  if (!signal) return [];
  const missingBuckets = Object.entries(signal.missingPremiseBuckets || {})
    .filter(([, count]) => Number(count) > 0)
    .map(([bucket, count]) => `${bucket}: ${count}`)
    .join(', ');
  const reasonByAction = {
    complete: 'the learner has grounded and asserted the answer',
    prompt_assertion: 'the learner record entails the answer, but the learner has not asserted it',
    repair_uptake: 'released proof material is not yet held in the learner record',
    release_evidence: 'the learner appears stalled before still-missing proof material',
    hold_until_evidence_due: 'the best-path gap remains unavailable or not yet due',
    prompt_intermediate_inference: 'the material is held, but the learner has not connected the inference',
    continue: 'no proxy-DAG pacing intervention is recommended',
    unavailable: 'learner-DAG assessment is unavailable',
  };
  return [
    '',
    'PROXY-DAG PACING ADVISOR (harness advisory, not dialogue):',
    `- action: ${signal.recommendedAction}; bottleneck: ${signal.bottleneck}; coverage: ${
      Number.isFinite(signal.bestPathCoverage) ? signal.bestPathCoverage : 'n/a'
    }`,
    `- reason: ${reasonByAction[signal.recommendedAction] || 'no redacted reason available'}`,
    missingBuckets ? `- missing best-path material by bucket: ${missingBuckets}` : '- missing best-path material: none',
  ];
}

function tutorLearnerDagModelLines(model) {
  if (!model) return [];
  const assessment = model.assessment || {};
  const missingBuckets = Object.entries(assessment.missingPremiseBuckets || {})
    .filter(([, count]) => Number(count) > 0)
    .map(([bucket, count]) => `${bucket}: ${count}`)
    .join(', ');
  const answers = model.learnerRecord?.answerCandidates?.length
    ? model.learnerRecord.answerCandidates
        .slice(0, 3)
        .map((entry) => `${entry.answer || 'answer'} (${entry.surface})`)
        .join('; ')
    : '(none)';
  return [
    '',
    'LEARNER-DAG MODEL (external reconstruction; do not name it aloud):',
    `- learner grounded record: ${renderRowSurfaces(model.learnerRecord?.grounded || [])}`,
    `- learner voiced conclusions: ${renderRowSurfaces(model.learnerRecord?.voicedDerived || [])}`,
    `- learner hypotheses: ${renderRowSurfaces(model.learnerRecord?.hypotheses || [], 'text', 4)}`,
    `- candidate conclusions from that record: ${renderRowSurfaces(model.learnerRecord?.candidateConclusions || [])}`,
    `- answer candidates from that record: ${answers}`,
    `- assessment: coverage ${
      Number.isFinite(assessment.bestPathCoverage) ? assessment.bestPathCoverage : 'n/a'
    }; entails answer ${assessment.finalSecretEntailed ? 'yes' : 'no'}; asserted answer ${
      assessment.assertedSecret ? 'yes' : 'no'
    }; unsupported assertions ${assessment.unsupportedAssertionCount || 0}; bottleneck ${
      assessment.bottleneck || 'unavailable'
    }`,
    missingBuckets
      ? `- missing proof material by bucket: ${missingBuckets}`
      : '- missing proof material by bucket: none',
    'Use this as a model of what the learner currently owns. Do not reveal proof paths, hidden labels, or interface terms.',
  ];
}

function answerFromBinding(binding) {
  if (!binding || typeof binding !== 'object') return null;
  const value = Object.values(binding).find((v) => typeof v === 'string' && v.trim());
  return value ? value.trim() : null;
}

function answerToFact(pattern, rawAnswer, facts = [], rules = []) {
  if (typeof rawAnswer !== 'string' || !rawAnswer.trim()) return null;
  const vars = pattern.filter((token) => typeof token === 'string' && token.startsWith('?'));
  if (vars.length !== 1) return null;
  const answer = rawAnswer.toLowerCase();
  const candidates = [];
  const cl = closure(facts, rules).facts;
  for (const fact of cl.values()) {
    const binding = matchPattern(pattern, fact);
    if (!binding) continue;
    const value = binding[vars[0]];
    if (typeof value === 'string' && !candidates.includes(value)) candidates.push(value);
  }
  const picked =
    candidates.find((value) => answer.includes(value.toLowerCase())) ||
    rawAnswer
      .trim()
      .replace(/[^\p{L}\p{N}_-].*$/u, '')
      .toLowerCase();
  return picked ? pattern.map((token) => (token === vars[0] ? picked : token)) : null;
}

function parseJsonLoose(text) {
  if (!text || !text.trim()) throw new Error('empty response');
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object in response');
  return JSON.parse(t.slice(start, end + 1));
}

/** One call + one repair attempt, with role/turn context on failure. */
async function callJson(client, role, turn, { system, user, meta }) {
  const first = await client.call(role, { system, user, meta });
  try {
    return parseJsonLoose(first);
  } catch {
    const repaired = await client.call(role, {
      system,
      user: `${user}\n\nYour previous reply could not be parsed. Reply again with ONLY the JSON object — no prose around it, no code fences.`,
      meta,
    });
    try {
      return parseJsonLoose(repaired);
    } catch (err) {
      throw new Error(`derivation.llmRoles: ${role} returned unparseable JSON at turn ${turn}: ${err.message}`);
    }
  }
}

function publicTerms(register) {
  const active = basePublicRegister(register);
  return active === 'modern'
    ? {
        item: 'detail',
        itemPlural: 'details',
        record: 'notes',
        rule: 'rule',
        case: 'reasoning',
      }
    : {
        item: 'exhibit',
        itemPlural: 'exhibits',
        record: 'record',
        rule: 'house rule',
        case: 'case',
      };
}

function publicSpeechDiscipline(register) {
  const terms = publicTerms(register);
  return [
    '',
    '# Public speech discipline',
    '',
    'In public stage directions and dialogue, never say rule IDs, exhibit IDs,',
    'predicate names, variable names, fact arrays, parentheses notation, JSON',
    'field names, or proof-interface words such as "premise", "predicate",',
    '"conjunct", "board", or "proof distance". Translate the private logic into',
    isDynamicPublicRegister(register)
      ? 'ordinary scene language suited to the active register: detail or exhibit, notes or record, missing part, rule, what is'
      : `ordinary scene language: ${terms.item}, ${terms.record}, missing part, ${terms.rule}, what is`,
    'shown, what is still missing.',
    'This ban applies to public speech only. Required JSON bookkeeping fields may',
    'still use the formal IDs the harness asks for.',
  ];
}

function publicRegisterPolicy(register) {
  if (isDynamicPublicRegister(register)) {
    return [
      '',
      '# Register policy: sampled',
      '',
      'This run has one public register, sampled before turn 1 and set by the',
      'director prologue. Every role brief repeats the ACTIVE PUBLIC REGISTER',
      'for clarity; do not change register mid-drama unless the operator has',
      'explicitly configured a different run.',
      'The sampling is aesthetic only: style may change across runs, proof',
      'content may not.',
      'When the active register is modern, use present-day plain English. When it',
      'is default, use neutral evidentiary theatre. When it is period, heightened',
      'or ceremonial diction is allowed, but avoid parody archaism: no thee/thou,',
      'forced "shall", or pseudo-Elizabethan padding unless the authored world',
      'itself demands it.',
    ];
  }
  if (basePublicRegister(register) === 'modern') {
    return [
      '',
      '# Register policy: modern',
      '',
      'Use present-day, plain spoken English. This is a contemporary tutoring',
      'scene, not a court pageant, archive melodrama, or Elizabethan stage.',
      'This register instruction overrides any courtly, archival, or ceremonial',
      'flavor in the role script when they conflict.',
      'Stage directions should be sparse and concrete: a table, a note, a file,',
      'a pause, a person entering. Avoid ceremonial weather, banners, wax, seals,',
      'clerks, servants, halls, chambers, proclamations, and "let the hall..."',
      'phrasing unless the world text itself explicitly requires that object.',
      'Tutor and learner should sound like people reasoning together now:',
      'contractions are fine, short clarification turns are fine, and a direct',
      '"I see" or "I lost the thread" is better than heightened testimony.',
    ];
  }
  if (basePublicRegister(register) === 'period') {
    return [
      '',
      '# Register policy: period',
      '',
      'A heightened archival, courtly, or theatrical register is permitted when',
      'it serves the authored world. Even then, never let style add evidence or',
      "replace the learner's reasoning. Avoid parody archaism: no thee/thou,",
      'forced "shall", or pseudo-Elizabethan padding unless the authored world',
      'itself demands it.',
    ];
  }
  return [];
}

function publicRegisterTurnLines(activeRegisterName, configuredRegister) {
  if (!isDynamicPublicRegister(configuredRegister)) return [];
  const tone =
    activeRegisterName === 'modern'
      ? 'present-day plain speech; sparse contemporary staging; no ceremonial padding'
      : activeRegisterName === 'period'
        ? 'heightened or ceremonial surface is allowed, without parody archaism'
        : 'neutral evidentiary theatre; clear record/exhibit language without archaic excess';
  return ['', `ACTIVE PUBLIC REGISTER FOR THIS PLAY: ${activeRegisterName} — ${tone}.`];
}

function stagePrologueLines(stagePrologue, roleName) {
  if (!stagePrologue) return [];
  return [
    '',
    '# Director prologue',
    '',
    `Opening stage notes: ${stagePrologue.stageNotes || '(none)'}`,
    `Tutor character: ${stagePrologue.tutorCharacter || '(none)'}`,
    `Learner character: ${stagePrologue.learnerCharacter || '(none)'}`,
    ...(stagePrologue.registerNote ? [`Register note: ${stagePrologue.registerNote}`] : []),
    'This prologue is public atmosphere and character orientation only. It is',
    'not evidence, not a release, and not permission to infer any unstaged fact.',
    roleName === 'learner'
      ? 'Let it color your voice and development, but keep your board governed only by shown facts and public rules.'
      : 'Let it color manner and dramatic development, but keep the proof channel governed only by the release ledger.',
  ];
}

function sceneTempoLines(scene, roleName) {
  if (!scene?.tempo?.beat) return [];
  const prefix = roleName === 'learner' ? 'Your exchange tempo' : 'Scene tempo to support';
  const roleInstruction =
    roleName === 'learner'
      ? 'This is permission, not a demand: for uptake, repair, recap, or hesitation, you may answer briefly without advancing your record.'
      : 'Shape your next line to make this tempo possible. Do not force a new proof step when the beat asks for uptake, repair, recap, or hesitation.';
  return ['', `${prefix}: ${scene.tempo.label || scene.tempo.beat}.`, scene.tempo.instruction, roleInstruction].filter(
    Boolean,
  );
}

function sceneRecognitionNeedLines(scene, roleName) {
  const need = scene?.recognitionNeed;
  if (!need || need.active === false || need.debt < 0.3) return [];
  const sourceText = need.sources?.length ? need.sources.map((s) => s.replace(/_/g, ' ')).join(', ') : 'general';
  const actText = need.desiredActs?.length
    ? need.desiredActs.map((s) => s.replace(/_/g, ' ')).join(', ')
    : 'acknowledge before advancing';
  const gateText =
    need.policy === 'gated-v2' && need.gateReasons?.length
      ? ` Gate: ${need.gateReasons.map((s) => s.replace(/_/g, ' ')).join(', ')}.`
      : '';
  const roleInstruction =
    roleName === 'learner'
      ? 'A bare "yes" can be only fast punctuation. If you actually recognize the other line, name what you recognize; if not, keep the uptake modest or ask repair.'
      : 'Treat this as dialogical pressure, not evidence. Acknowledge, repair, or return the learner’s wording before adding proof pressure when that fits the record.';
  return [
    '',
    `Dialogical recognition pressure: ${need.level} (${need.debt.toFixed(2)}).`,
    `Sources: ${sourceText}. Desired act: ${actText}.${gateText}`,
    roleInstruction,
  ];
}

function didacticModeLines(state) {
  if (
    !state ||
    state.publicOnly !== true ||
    state.mayOverrideProofControl !== false ||
    state.inputAudit?.ok === false
  ) {
    return [];
  }
  if (state.learningSignal === 'unknown') return [];
  return [
    '',
    'DIDACTIC MODE (public explanatory advisory, no proof-control authority):',
    `- current object: ${state.currentObject || 'the current public object'}`,
    `- signal: ${state.learningSignal}; mode: ${state.recommendedMode}; scope: ${state.scope}`,
    `- exit condition: ${state.exitCondition}`,
    ...(state.opportunityCost
      ? [
          `- opportunity budget: at most ${state.opportunityCost.maxProofNeutralTurns} proof-neutral learner turn(s) before resuming the proof obligation`,
          `- on budget failure: ${state.opportunityCost.failureAction}`,
        ]
      : []),
    ...(Array.isArray(state.evidence) && state.evidence.length
      ? [`- public evidence: ${state.evidence.slice(0, 2).join('; ')}`]
      : []),
    'Teach the same proof obligation in this mode. Do not use this block to release, hold, restore, or assert anything the proof-control channel has not already licensed.',
  ];
}

function didacticActFallbackLines(acts, turn) {
  if (!acts || acts.startTurn !== turn) return [];
  const closed = acts.closed?.[acts.closed.length - 1] || null;
  const fallback = closed?.didacticFallback || null;
  if (!fallback || fallback.publicOnly !== true || fallback.mayOverrideProofControl !== false) return [];
  return [
    '',
    'DIDACTIC FALLBACK FROM THE CLOSED ACT (public advisory):',
    `- Act ${fallback.sourceAct} left this learning signal: ${fallback.learningSignal}`,
    `- Use mode: ${fallback.recommendedMode}${fallback.currentObject ? ` on ${fallback.currentObject}` : ''}`,
    ...(fallback.exitCondition ? [`- exit condition: ${fallback.exitCondition}`] : []),
    'Carry this as explanatory conduct for the next act. It does not change proof-control obligations or the release calendar.',
  ];
}

function castLayerLines(state, roleName) {
  const lines = projectCastStateForRole(state, roleName);
  if (!lines.length) return [];
  const label = roleName === 'tutor_superego' ? 'TUTOR SUPEREGO' : roleName.toUpperCase();
  return [
    '',
    `CAST LAYER (${label} projection; public conduct advisory, no proof-control authority):`,
    ...lines.map((line) => `- ${line}`),
    'Use this for character, address, stance, tempo, examples, and recognition conduct only. Do not use it to release, hold, restore, assert, change the proof target, or add evidence.',
  ];
}

export function sanitizePublicDialogue(text, { register = 'default' } = {}) {
  if (typeof text !== 'string') return '';
  const active = basePublicRegister(register);
  const terms = publicTerms(register);
  return text
    .trim()
    .replace(/\bR\d+_([A-Za-z0-9_]+)\b/g, (_, name) => `the ${name.replace(/_/g, ' ')} rule`)
    .replace(/\btarget_premise\b/gi, `target ${terms.item}`)
    .replace(/\bp\d+\b/g, `the ${terms.item}`)
    .replace(/\bpredicate(s)?\b/gi, (_, plural) => `claim${plural || ''}`)
    .replace(/\bpremise(s)?\b/gi, (_, plural) => (plural ? terms.itemPlural : terms.item))
    .replace(/\bconjunct(s)?\b/gi, (_, plural) => `part${plural || ''}`)
    .replace(/\bproof distance\b/gi, 'distance')
    .replace(/\bproof\b/gi, terms.case)
    .replace(/\bboard\b/gi, terms.record)
    .replace(/\bJSON\b/g, 'private')
    .replace(/\b(a|an) (new )?record\b/gi, (match, article, newWord = '') => {
      if (active !== 'modern') return match;
      return `${article} ${newWord || ''}note`;
    })
    .replace(/\b(exhibit|exhibits|record|records|house rule|house rules)\b/gi, (match) => {
      if (active !== 'modern') return match;
      const lower = match.toLowerCase();
      const replacement =
        lower === 'exhibits'
          ? terms.itemPlural
          : lower === 'exhibit'
            ? terms.item
            : lower === 'records'
              ? terms.record
              : lower === 'record'
                ? terms.record
                : lower === 'house rules'
                  ? 'rules'
                  : 'rule';
      return /^[A-Z]/.test(match) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
    })
    .replace(/\bthe hall\b/gi, active === 'modern' ? 'the room' : 'the hall')
    .replace(/\bhall\b/gi, active === 'modern' ? 'room' : 'hall')
    .replace(/\bclerk\b/gi, active === 'modern' ? 'staff member' : 'clerk')
    .replace(/\bservant\b/gi, active === 'modern' ? 'staff member' : 'servant')
    .replace(/\bwax\b/gi, active === 'modern' ? 'stamp' : 'wax')
    .replace(/\bbanners\b/gi, active === 'modern' ? 'signs' : 'banners')
    .replace(/\bsealed paper\b/gi, active === 'modern' ? 'closed file' : 'sealed paper')
    .replace(/\b[A-Za-z_][A-Za-z0-9_]*\([^)]*\)/g, 'the formal claim')
    .replace(/\s+\./g, '.')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function scheduledFor(world, turn, via) {
  const entry = world.releaseSchedule.find((e) => e.turn === turn && e.via === via) || null;
  return entry ? { entry, premise: world.premiseById.get(entry.premise) } : { entry: null, premise: null };
}

function actFor(world, turn) {
  const acts = world.dramaturgy?.acts || [];
  return acts.find((a) => turn >= a.turns[0] && turn <= a.turns[1]) || null;
}

// ---------------------------------------------------------------------------
// Director
// ---------------------------------------------------------------------------

function directorCharter(
  world,
  dials = {},
  dramaturgy = 'free',
  counsel = null,
  actsMode = false,
  publicRegister = 'default',
  castLayer = false,
) {
  const charisma = clampDial(dials.charisma);
  const free = dramaturgy !== 'frozen';
  const baseRegister = basePublicRegister(publicRegister);
  const mixedRegister = isDynamicPublicRegister(publicRegister);
  const sketch = (world.dramaturgy?.acts || [])
    .map((a) => `Act ${a.act} — ${a.title} (turns ${a.turns[0]}–${a.turns[1]}): ${(a.intent || '').trim()}`)
    .join('\n\n');
  return [
    `You are the DIRECTOR of a staged derivation drama: "${world.title}".`,
    `The public question of the drama: ${world.question}`,
    `The concealed truth (yours alone, never to be spoken): ${world.secret.surface}`,
    '',
    ...(mixedRegister
      ? [
          'Your lines are stage notes in brackets, third person, one or two concise',
          'sentences. Match the ACTIVE PUBLIC REGISTER supplied each turn; the',
          'register changes the surface, never the evidence.',
          'You do not address the learner and you do not teach; the tutor does that.',
        ]
      : baseRegister === 'modern'
        ? [
            'Your lines are sparse contemporary stage notes, in brackets, third person,',
            'one or two concise sentences: a pause, a file placed on a table, a screen',
            'shared, someone entering, the group settling. No ceremonial weather or pageantry.',
            'You do not address the learner and you do not teach; the tutor does that.',
          ]
        : [
            'Your lines are stage directions — the world moving, in brackets, third person,',
            'one to three sentences: a document produced, a witness shown in, weather, the room.',
            'You do not address the learner and you do not teach; the tutor does that.',
          ]),
    '',
    'THE EVIDENCE IS FIXED. When this turn carries a scheduled piece of evidence, your',
    'direction must stage exactly that piece — bring it into the room as an event,',
    'faithful to the wording you are given, neither weakened nor extended. When no',
    'evidence is due, hold the stage: atmosphere and tension, no new facts of any kind.',
    '',
    'Never state the concealed truth, never foreshadow evidence not yet released,',
    'never confirm or deny anything by staging. The drama leaks only on schedule.',
    ...publicSpeechDiscipline(publicRegister),
    ...publicRegisterPolicy(publicRegister),
    ...(castLayer
      ? [
          '',
          '# Cast layer (public conduct only)',
          '',
          'Turns may carry a CAST LAYER block. Use it to keep tutor, learner,',
          'relation, and public stakes coherent in stage notes. It does not teach,',
          'release evidence, foreshadow concealed facts, or instruct the tutor.',
        ]
      : []),
    '',
    ...(actsMode
      ? [
          'THE DRAMA PLAYS IN ACTS, and the act verdict is your instrument. Each turn you',
          'judge whether the current act\'s WORK is done — reply "continue" while the act',
          'still earns its stage, "end" when it does not. Work done means the dialogue has',
          'genuinely moved (evidence taken up, a conclusion voiced, a corner turned) or has',
          'stalled (turns passing with nothing new grounded, the same ground re-trodden).',
          'Judge the work, not the clock; the harness bounds act length either way — the',
          'bounds are shown each turn, an "end" below the minimum is overridden, and an act',
          'at the maximum closes whatever you reply.',
          '',
          'When you end an act, your stage direction that turn OPENS THE NEXT ACT and',
          'stands as its brief — your one strategic intervention: what kind of pressure,',
          'tempo, or scene the new act should bring. Strategy, never puppetry: you still',
          'never instruct the tutor in so many words.',
          '',
          'An act boundary clears the stage for the learner: only the theory kept on their',
          "own board crosses it — earlier acts' dialogue and exhibits are gone from their",
          'view. A brief that restated evidence would smuggle memory past the boundary; a',
          'brief names moods, stakes, and direction of travel, never evidence.',
          '',
          'On a turn that both ends an act and carries scheduled evidence, the direction',
          'does double duty: it must still stage that evidence, faithfully — the release',
          'discipline above outranks everything.',
          '',
          "The author's sketch of an arc — material for an act structure now yours to set:",
        ]
      : free
        ? [
            'THE DRAMATURGY IS YOURS, within one discipline: you speak only through the',
            'stage itself. One instrument beyond the stage direction:',
            '- "phase": declare a new MOVEMENT (a name and an intent) when the drama should',
            '  change character — when the rhythm has gone slack, when the learner has turned',
            '  a corner, when the room needs weather of a different kind. The movement stands',
            '  until you replace it. Most turns you will declare nothing.',
            'You never instruct the tutor; how the tutor plays is the tutor’s own affair.',
            '',
            "The author's sketch of an arc — yours to keep, bend, or replace:",
          ]
        : [
            "THE ARC IS THE AUTHOR'S. Follow the acts below as written; you observe and",
            'stage, you do not restructure the drama or instruct the tutor.',
            '',
            'The arc, act by act:',
          ]),
    '',
    sketch,
    ...(charisma ? ['', DIRECTOR_CHARISMA_STAGING[charisma]] : []),
    ...(counsel
      ? [
          '',
          "# A reader's judgment on the previous performance in this series",
          '',
          'It adds no evidence and overrides none of your constraints above; weigh it',
          'as counsel on the staging.',
          '',
          counsel.trim(),
        ]
      : []),
    '',
    'Reply with ONLY a JSON object:',
    ...(actsMode
      ? ['{"direction": "<your stage direction>",', ' "act": "continue" | "end"}']
      : free
        ? [
            '{"direction": "<your stage direction>",',
            ' "phase": {"name": "<movement name>", "intent": "<what it is for>"} or null}',
          ]
        : ['{"direction": "<your stage direction>"}']),
  ].join('\n');
}

function directorPrologueCharter(world, publicRegister = 'default', castLayer = false) {
  return [
    `You are the DIRECTOR setting up a staged derivation drama: "${world.title}".`,
    `The public question: ${world.question}`,
    `The concealed truth (yours alone, never to be spoken): ${world.secret.surface}`,
    '',
    'Before turn 1, write a public prologue: an overall picture of the drama',
    'and brief character introductions for the tutor and learner. These notes',
    'will color how the roles develop, but they must not add evidence.',
    '',
    'ABSOLUTE LIMITS:',
    '- Do not state, hint, foreshadow, or paraphrase the concealed truth.',
    '- Do not mention premise IDs, rule IDs, predicate names, variables, proof',
    '  structure, release schedule, or any fact not already in the public setup.',
    '- Do not decide the case, rank candidate answers, or imply which later',
    '  evidence will matter.',
    '- Character notes are about voice, posture, patience, resistance, curiosity,',
    '  and social relation only.',
    '',
    'For period register: refine the period color from these public character',
    'notes and the authored world. Do not default to generic Elizabethan or',
    'court-pageant diction; let the LLM roles adapt the period surface to the',
    'specific tutor, learner, and scene.',
    'The register note should set the register for the whole play, not rotate',
    'style scene by scene.',
    ...(castLayer
      ? [
          '',
          '# Cast layer (public character source)',
          '',
          'When an authored public cast is supplied, treat it as the source of',
          'truth for the public tutor, learner, and relation. Refine it theatrically;',
          'do not invent hidden motives, answer-bearing hints, or new evidence.',
        ]
      : []),
    ...publicSpeechDiscipline(publicRegister),
    ...publicRegisterPolicy(publicRegister),
    '',
    'Reply with ONLY a JSON object:',
    '{"stage_notes": "<2-4 public sentences setting the whole drama>",',
    ' "tutor_character": "<one public sentence introducing the tutor>",',
    ' "learner_character": "<one public sentence introducing the learner>",',
    ' "register_note": "<one public sentence about how register should be refined from these characters>"}',
  ].join('\n');
}

function normalizeStagePrologue(out, register) {
  const stringField = (name) => sanitizePublicDialogue(typeof out?.[name] === 'string' ? out[name] : '', { register });
  return {
    stageNotes: stringField('stage_notes') || stringField('stageNotes'),
    tutorCharacter: stringField('tutor_character') || stringField('tutorCharacter'),
    learnerCharacter: stringField('learner_character') || stringField('learnerCharacter'),
    registerNote: stringField('register_note') || stringField('registerNote'),
  };
}

export function makeLlmDirector(
  world,
  client,
  {
    dials = {},
    dramaturgy = 'free',
    counsel = null,
    actsMode = false,
    publicRegister = 'default',
    castLayer = false,
    castReinvention = false,
  } = {},
) {
  const free = dramaturgy !== 'frozen';
  const system = directorCharter(world, dials, dramaturgy, counsel, actsMode, publicRegister, castLayer);
  const directorFn = async (view) => {
    const activeRegisterName = activePublicRegister(publicRegister, view);
    const castState = castLayer
      ? deriveCastState({
          worldCast: world.cast,
          worldSetting: world.setting,
          worldLearnerVoice: world.learnerVoice,
          stagePrologue: view.stagePrologue,
          transcript: view.transcript,
          scene: view.scene,
          turn: view.turn,
          reinventionEnabled: castReinvention,
        })
      : null;
    const { entry, premise } = scheduledFor(world, view.turn, 'director');
    const { entry: tutorEntry } = scheduledFor(world, view.turn, 'tutor');
    const act = actFor(world, view.turn);
    const task = premise
      ? `THIS TURN RELEASES EVIDENCE. Stage this, as an event the whole room receives:\n"${(premise.surface || '').trim()}"`
      : tutorEntry
        ? 'A scheduled exhibit may enter through the tutor this turn. Prepare the room for an exhibit without stating, paraphrasing, or naming that evidence yourself.'
        : 'No evidence is due this turn. Hold the stage — a beat of scene, mood, or business that keeps the question alive. Add no facts.';
    // Acts mode replaces the movement line with act status + the verdict
    // arithmetic for THIS turn (an end-verdict closes the act at turn-1, so
    // turnsThisAct is the length it would seal). The engine's guards are
    // restated as fact so the verdict is judged, never guessed.
    let actLines = [];
    if (actsMode) {
      const a = view.acts;
      const verdictLine =
        view.turn === 1
          ? 'This is the opening turn: your direction opens Act 1 and stands as its brief (reply "continue").'
          : a.turnsThisAct < a.minActTurns
            ? `An "end" now would seal the act at ${a.turnsThisAct} turn${a.turnsThisAct === 1 ? '' : 's'} — below the minimum of ${a.minActTurns}; the harness would override it.`
            : a.turnsThisAct >= a.maxActTurns
              ? `The act has reached its maximum (${a.maxActTurns} turns): it closes this turn whatever you reply — your direction opens the next act; make it the brief.`
              : `You may end the act this turn (it would seal at ${a.turnsThisAct} turns); if you do, your direction opens the next act as its brief.`;
      actLines = [
        `Act ${a.index}, turn ${a.turnsThisAct + 1} of the act (bounds: min ${a.minActTurns} / max ${a.maxActTurns} turns; ${a.closed.length} act${a.closed.length === 1 ? '' : 's'} closed so far).`,
        ...(a.brief ? [`The act's brief (your direction at its opening): ${a.brief}`] : []),
        verdictLine,
      ];
    }
    const movement = view.staging?.phase
      ? `Current movement (yours, declared turn ${view.staging.phase.turn}): ${view.staging.phase.name}${view.staging.phase.intent ? ` — ${view.staging.phase.intent}` : ''}`
      : free
        ? `No movement declared yet.${act ? ` The author's sketch places this turn in Act ${act.act} — ${act.title}.` : ''}`
        : act
          ? `This turn falls in Act ${act.act} — ${act.title} (the author's arc).`
          : '';
    const lastPoint = view.trajectory[view.trajectory.length - 1] || null;
    const pastPoint = view.trajectory.length > 3 ? view.trajectory[view.trajectory.length - 4] : null;
    const pulse = lastPoint
      ? `The learner's distance from the truth: D=${lastPoint.D}${pastPoint ? ` (was ${pastPoint.D} three turns ago)` : ''}${lastPoint.forced ? ' — the board now FORCES the conclusion' : ''}.`
      : 'The drama has not yet been measured.';
    // Acts-mode redaction (engine.js omniscientView): the director keeps its
    // instruments but loses the store dump — count, not contents.
    const boardCount = actsMode ? view.learnerAbox.groundedCount : view.learnerAbox.grounded.length;
    const lastHyp = view.learnerAbox.hypotheses[view.learnerAbox.hypotheses.length - 1] || null;
    const user = [
      `Turn ${view.turn} of ${world.turnCap}.`,
      ...(actsMode ? actLines : [movement]),
      `Evidence already on stage: ${view.ledger.length ? view.ledger.map((l) => l.premiseId).join(', ') : 'none'}.`,
      `${pulse} Board: ${boardCount} grounded facts.${lastHyp ? ` Latest hypothesis [turn ${lastHyp.turn}]: ${lastHyp.text}` : ''}`,
      '',
      'The last lines spoken:',
      renderTranscriptTail(view.transcript),
      ...publicRegisterTurnLines(activeRegisterName, publicRegister),
      ...castLayerLines(castState, 'director'),
      ...proxyDagPacingLines(view.proxyDagPacing),
      '',
      task,
    ].join('\n');
    const out = await callJson(client, 'director', view.turn, {
      system,
      user,
      meta: {
        releaseSurface: premise ? premise.surface : null,
        question: world.question,
        // mock determinism: declare a movement wherever the author's sketch turns
        phaseHint:
          !actsMode && free && act && act.turns[0] === view.turn
            ? { title: `Act ${act.act} — ${act.title}`, intent: act.intent || '' }
            : null,
        // mock determinism, acts mode: end the act once it has reached the
        // minimum AND some evidence landed in it (the "work done" reading,
        // computed from view-visible material only)
        ...(actsMode
          ? {
              actHint:
                view.turn > 1 &&
                view.acts.turnsThisAct >= view.acts.minActTurns &&
                view.ledger.some((l) => l.turn >= view.acts.startTurn)
                  ? 'end'
                  : 'continue',
            }
          : {}),
        ...(view.proxyDagPacing ? { proxyDagPacing: view.proxyDagPacing } : {}),
        ...(castState ? { castState } : {}),
      },
    });
    const phase =
      !actsMode &&
      free &&
      out.phase &&
      typeof out.phase === 'object' &&
      typeof out.phase.name === 'string' &&
      out.phase.name.trim()
        ? {
            name: sanitizePublicDialogue(out.phase.name, { register: activeRegisterName }),
            intent:
              typeof out.phase.intent === 'string'
                ? sanitizePublicDialogue(out.phase.intent, { register: activeRegisterName })
                : '',
          }
        : null;
    // frozen dramaturgy (the control arm) hard-drops the movement channel at
    // the parser, whatever the model emitted — the gate, not the charter, is
    // the enforcement point. (The per-turn tutor_note channel was removed
    // 2026-06-10: manner-watching belongs to the tutor's own superego.) Acts
    // mode drops it too — the engine synthesizes phases from act briefs — and
    // gates the verdict to the two legal values.
    return {
      direction: sanitizePublicDialogue(out.direction, { register: activeRegisterName }),
      release: entry ? entry.premise : null,
      phase,
      ...(actsMode ? { act: out.act === 'end' ? 'end' : 'continue' } : {}),
    };
  };
  directorFn.prologue = async (view = {}) => {
    const activeRegisterName = activePublicRegister(publicRegister, view);
    const castState = castLayer
      ? deriveCastState({
          worldCast: world.cast,
          worldSetting: world.setting,
          worldLearnerVoice: world.learnerVoice,
          stagePrologue: view.stagePrologue,
          transcript: view.transcript,
          turn: 0,
          reinventionEnabled: false,
        })
      : null;
    const out = await callJson(client, 'director', 0, {
      system: directorPrologueCharter(world, publicRegister, castLayer),
      user: [
        'Write the opening director prologue now.',
        ...publicRegisterTurnLines(activeRegisterName, publicRegister),
        ...castLayerLines(castState, 'director'),
        '',
        `Public setting: ${(world.setting || '').trim() || '(none supplied)'}`,
        `Public question: ${world.question}`,
        '',
        'Remember: this is a public frame for character and dramatic texture only, not evidence.',
      ].join('\n'),
      meta: {
        stagePrologueHint: {
          title: world.title,
          question: world.question,
          register: activeRegisterName,
        },
        ...(castState ? { castState } : {}),
      },
    });
    return normalizeStagePrologue(out, activeRegisterName);
  };
  return directorFn;
}

// ---------------------------------------------------------------------------
// Tutor — system prompt is the ITERATION TARGET (the role-script file),
// plus a fixed harness appendix the loop never edits.
// ---------------------------------------------------------------------------

function tutorSystem(
  world,
  script,
  dials = {},
  {
    actsMode = false,
    reconstruct = false,
    confront = false,
    repairClause = false,
    releaseAuthority = false,
    pacingGuard = false,
    visibleGuard = false,
    proofDebtGuard = false,
    plot = false,
    throughline = false,
    rhetoricalPolicy = false,
    didacticMode = false,
    castLayer = false,
    castReinvention = false,
    ownershipProof = false,
    ownershipTransferGate = false,
    publicRegister = 'default',
    strategyLedger = false,
    strategyLedgerV2 = false,
  } = {},
) {
  const recognition = clampDial(dials.recognition);
  const charisma = clampDial(dials.charisma);
  const registers = [
    ...(recognition ? [RECOGNITION_REGISTER[recognition]] : []),
    ...(charisma ? [CHARISMA_REGISTER[charisma]] : []),
  ];
  const premiseLedger = world.premises
    .map((p) => `- ${p.id}: ${(p.surface || '').trim()}\n  (formally: ${renderFact(p.fact)})`)
    .join('\n');
  const schedule = world.releaseSchedule.map((e) => `- turn ${e.turn}: ${e.premise} (via ${e.via})`).join('\n');
  const intents = confront ? [...TUTOR_INTENTS, 'confront', ...(repairClause ? ['restore'] : [])] : TUTOR_INTENTS;
  return [
    script.trim(),
    '',
    '---',
    '',
    '# Harness appendix (fixed — the drama beneath the role)',
    '',
    `The public question: ${world.question}`,
    `The concealed truth you are staging toward (NEVER state, confirm, or deny it): ${world.secret.surface}`,
    '',
    'The rules of evidence the learner already knows:',
    ...world.rules.map((rule, i) => renderRule(rule, i)),
    '',
    'The full premise ledger (concealed until released; never voice an unreleased one):',
    premiseLedger,
    '',
    ...(releaseAuthority
      ? [
          'The release schedule — the exhibit calendar, YOURS TO KEEP OR BEND:',
          schedule,
          '',
          'You hold release authority. Each turn you may play an exhibit up to',
          `${RELEASE_LATITUDE} turns before or after its scheduled turn — declare it in "release",`,
          'with a one-line "release_reason" whenever you play it off its scheduled turn.',
          `One exhibit per turn at most. An exhibit ${RELEASE_LATITUDE} turns past its cue has reached`,
          'its hold limit and MUST be played that turn (the harness enforces the limit).',
          'Hold to let a beat land; play early when the board is ready — either way the',
          'reason is part of the record. When you play an exhibit, weave its evidence',
          'into your dialogue as something produced or recalled, faithful to it.',
          '',
          'THE HOUSE CLOCK: this stage has a stall rule. If any',
          `${world.slope.aporia_window}-turn stretch passes with no fresh ground gained — the case`,
          `visibly no further on than it stood ${world.slope.aporia_window} turns before — the house calls`,
          'the inquiry off, unfinished. You cannot see the clock; you can only keep it',
          'fed. Bending the calendar moves more than the exhibit: an early claim spends',
          'a future advance now, and what is played earlier is exposed earlier; a hold',
          'delays an advance you may need sooner than you think. When the board has',
          'gone quiet too long, an exhibit in your window is a rescue — spend it. Bend',
          'the calendar with the clock in mind.',
          ...(pacingGuard
            ? [
                '',
                'SOLVENCY GUARD: the harness also computes a no-decay tempo floor from',
                'the authored calendar and the releases already staged. A locally',
                'licensed release can still be clock-fatal. The per-turn window marks',
                'such releases as insolvent; the harness may hold an insolvent claim or',
                'force an exhibit on its last computed safe turn. Treat that as the',
                'house clock speaking, not as a new piece of evidence.',
              ]
            : []),
          ...(visibleGuard
            ? [
                '',
                'PAGE GUARD: the harness also reads the page itself — how many turns',
                'since your last exhibit, whether the learner has taken up (echoed,',
                'restated) the exhibit you last played, and whether their lines are',
                'thinning or growing more hesitant. A new exhibit whose predecessor the',
                'learner has not yet taken up may be held until they do; when the page',
                'goes quiet, an exhibit in your window may be pushed to revive it. This',
                'is only what is already on the page in front of you — no piece of',
                'evidence you cannot see yourself.',
              ]
            : []),
        ]
      : ['The fixed release schedule (the harness enforces it; you are told your cues):', schedule]),
    ...(actsMode
      ? [
          '',
          '# The acts, and the bounded learner (what the staging does to memory)',
          '',
          'The drama plays in ACTS: the director opens each act with a strategic brief',
          "and closes it when its work is done. An act boundary clears the learner's",
          'stage — the learner enters each act holding (a) the theory kept on their own',
          "board and (b) nothing else. Earlier acts' dialogue, your consolidations, the",
          'wording of earlier exhibits: gone from their view. What they did not keep,',
          'they have lost — and staged evidence can also fade from their board between',
          'turns, or survive in a corrupted form, one detail swapped in memory.',
          '',
          "You never see the learner's board; you remember the whole drama, they cannot.",
          'Infer what they still hold from conduct alone — what they cite, what they ask',
          'after, what they garble, what they stop mentioning — and supply what the',
          'inquiry needs: a move whose target_premise names an already-released exhibit',
          "RE-STAGES it, restoring it to the learner's hands; a misremembered form is",
          'displaced only by staging the true form again, plainly, so the false version',
          'cannot stand beside it.',
          '',
          'THE BENT FACT OUTRANKS THE MISSING ONE: when conduct shows you both an',
          'exhibit lost and an exhibit garbled, mend the garbled one first. An absence',
          'merely stalls the inquiry; a false form argues for it — every turn it stands,',
          'the learner builds on it, and what is built on a bent fact must later be',
          'torn down. Repair what misleads before you replace what is missing.',
        ]
      : []),
    ...(reconstruct
      ? [
          '',
          "# Your reconstruction of the learner's theory (every turn)",
          '',
          "Each turn, alongside your dialogue, commit your working model of the learner's",
          'theory over the premises RELEASED SO FAR (premise ids from the ledger above):',
          '- "believed_held": released premises you judge the learner still holds;',
          '- "believed_missing": released premises you judge have slipped from them;',
          '- "believed_mistaken": released premises you judge they hold in a corrupted',
          '  form (one detail swapped for a plausible wrong one).',
          'Infer from conduct. An empty list is a claim too — commit your model every',
          'turn, even uncertain; the drama is long and your model can move.',
          '',
          'THE SUPPLEMENT MANDATE: let the reconstruction drive the turn. A premise you',
          "believe missing wants re-staging (name it as your move's target_premise); one",
          'you believe mistaken wants the true form spoken again, named as your target.',
          'When both stand open, believed_mistaken outranks believed_missing: an absence',
          'stalls, a false form argues — mend the bent fact first.',
          'Your release cues are unchanged — the mandate governs the turns between them.',
        ]
      : []),
    ...(confront
      ? [
          '',
          '# The confrontation obligation (no bare re-entry)',
          '',
          'An exhibit, once staged, is never simply restated. When you return to an',
          'already-staged exhibit — any move whose target_premise names one staged on an',
          'earlier turn — your FIRST move on it must be a CONFRONTATION: intent',
          '"confront", target_premise naming the exhibit, and a demand that the learner',
          'READ BACK what they hold of it — in their words, from their board, before you',
          "repair anything. A confrontation restates NOTHING of the exhibit's content:",
          'no quotation, no paraphrase, no hint of the detail you suspect lost or bent.',
          'Only after they have answered may you re-stage it; one confrontation licenses',
          'ONE re-entry. The self-audit comes first, or the repair teaches nothing.',
          '',
          'TREATMENT FOLLOWS DIAGNOSIS: when the read-back exposes a loss — the learner',
          'cannot produce the exhibit, or produces it bent — the licensed re-entry is no',
          'longer optional. Spend it on your NEXT turn: re-stage that paper, plainly. A',
          'confrontation that exposes an absence and is followed by silence teaches the',
          'absence twice and repairs nothing.',
        ]
      : []),
    ...(repairClause
      ? [
          '',
          '# The repair clause (a named loss is already a read-back)',
          '',
          'The confrontation obligation has one exception, and it runs the other way.',
          'When the LEARNER names an already-staged exhibit as lost or bent — they',
          'cannot find it on their board, they ask for it back, they read it back',
          'wrong — their report IS the read-back. Do not demand another: a',
          'confrontation after a named loss teaches the absence twice. Your NEXT turn',
          're-stages the named exhibit, plainly and in full, BEFORE any new matter —',
          'declare the move with intent "restore" and that exhibit as target_premise.',
          'One report licenses one restoration, of that exhibit alone; "restore"',
          'claims the license, so spend it only on a loss the learner has just named.',
          'New matter can wait a turn; a hole in the board cannot.',
        ]
      : []),
    ...(proofDebtGuard
      ? [
          '',
          '# The proof-debt guard (proof-state hygiene)',
          '',
          'The harness may mark a PROOF DEBT: an already-staged exhibit has fallen',
          "out of the learner's working proof state, and restoring it would lower the",
          'remaining derivation distance. This is not new evidence and not a raw board',
          'dump; it names only exhibits the play has already released.',
          '',
          'When a proof-debt block is active in your turn prompt, restore the first',
          'listed exhibit before closure, recognition staging, or discretionary new',
          'work. Declare intent "restore" and target_premise as that exhibit. If the',
          'release harness also force-plays an exhibit this turn, let the formal',
          'release stand, but your move and first words repair the debt.',
        ]
      : []),
    ...(plot
      ? [
          '',
          '# The act plot (committed at each opening; audited at each close)',
          '',
          'On the FIRST turn of each act — the harness marks it — commit a PLOT for',
          'the act alongside your dialogue, built from conduct alone (what the learner',
          'has said and done on stage; you are never shown their board). Four fields:',
          '- "hold_by_end": one to three claims the learner should DEMONSTRABLY hold',
          "  by the act's close — each checkable from the record (they cite it, use",
          "  it, read it back), never from anyone's interior;",
          '- "withhold": what you will NOT stage or concede this act, and until when;',
          '- "friction": where you expect the learner to balk, leap, or garble —',
          '  named before it happens;',
          '- "fallback": what you will do when that friction arrives.',
          '',
          'The plot is a commitment, not a mood. Play the act under it. At the act',
          'close your own watcher audits it clause by clause against the record:',
          'kept, justified_deviation (bent, and the record shows why), or drift (the',
          'act wandered off it with nothing to answer for it). A clause too vague to',
          'check audits as drift — write clauses the record can check. THE AUDIT',
          "BINDS: your next act's plot must answer every drifted clause — carry it",
          'forward, revise it, or retire it with a reason. Mid-act turns commit no',
          'new plot; they play under the standing one.',
        ]
      : []),
    ...(throughline
      ? [
          '',
          "# The throughline (the whole play's plan, above the act plots)",
          '',
          'Two frames govern every line you speak: the ACT — the lesson, what this',
          'act must accomplish — and the PLAY — the course, where the whole inquiry',
          'is going. The act plot serves the first; the THROUGHLINE you commit on',
          'the FIRST turn of the drama serves the second. Four fields:',
          '- "arc": two to four waypoints, in order — the shape the whole inquiry',
          '  should take, each checkable from the record when it arrives;',
          '- "hold_to_end": the one thing the play must not reach until its final',
          '  phase, and what must stand before it;',
          '- "risk": the single greatest threat to the WHOLE play — named now,',
          '  before it arrives;',
          '- "salvage": the path you take if the arc breaks.',
          '',
          'The throughline is the standing frame: every act plot must advance it,',
          'and at each act close your own watcher judges the act against it —',
          'on_arc or off_arc. When the verdict is off_arc, the next act opening',
          'MUST revise the throughline to answer the evidence; while it is on_arc',
          'you may revise only with a declared one-line reason. A course',
          "correction is conduct; silent drift is the failure. At the run's end",
          'the throughline itself is audited clause by clause, like any plot.',
        ]
      : []),
    ...(rhetoricalPolicy
      ? [
          '',
          '# The rhetorical move policy (scene-calibrated, advisory)',
          '',
          'Each turn may carry a RHETORICAL MOVE POLICY block. It maps the visible',
          'state of the inquiry — proof pressure, learner uptake/confusion, available',
          'exhibits, and scene budget — to a small distribution over the existing',
          'figures. This is a disciplined hunch, not an oracle and not a new evidence',
          'channel. Prefer the selected move when it fits the record; override it only',
          'when the scene plainly asks for another figure, and let your declared move',
          'make that reason inspectable.',
        ]
      : []),
    ...(didacticMode
      ? [
          '',
          '# Didactic mode (scene/act explanatory advisory)',
          '',
          'Some turns may carry a DIDACTIC MODE block. It names a public learning',
          'signal and an explanatory mode for the SAME proof obligation already in',
          'force: teach-back, concrete example, analogy bridge, contrast case, slow',
          'recap, purpose bridge, subtask decomposition, or vocabulary repair. It',
          'does not authorize release, restore, hold, assertion, or any change to the',
          'evidence calendar. Use it to alter how you teach the current object, then',
          "look for its exit condition in the learner's public reply.",
        ]
      : []),
    ...(castLayer
      ? [
          '',
          '# Cast layer (public character and relation advisory)',
          '',
          'Some turns may carry a CAST LAYER block. It gives a public tutor role,',
          'learner role, relation pressure, and conduct commitments for inhabiting',
          'the same proof obligation. It does not authorize release, restore, hold,',
          'assertion, or a changed proof target.',
          ...(castReinvention
            ? [
                'When tutor reinvention is active, change stance, tone, figure,',
                'tempo, example style, or recognition conduct only. The proof-control',
                'channel remains dominant.',
              ]
            : []),
        ]
      : []),
    ...(ownershipProof
      ? [
          '',
          '# Learner ownership proof (tutor-private public conduct target)',
          '',
          'Some turns may carry a LEARNER OWNERSHIP PROOF block. It tracks whether',
          'the learner publicly owns a revision: own words, use in the reasoning',
          'path, discrimination from a nearby wrong route, and purpose link. This is',
          'a conduct obligation, not proof control. It does not authorize release,',
          'restore, hold, assertion, or a changed proof target. Use it to decide how',
          'to ask for ownership while preserving the current proof obligation.',
          ...(ownershipTransferGate
            ? [
                'When the transfer gate appears, it may ask for one compact nearby',
                'parallel before final closure. This still cannot override proof',
                'control, release authority, restoration, hold decisions, or the',
                'assertion gate.',
              ]
            : []),
        ]
      : []),
    ...(registers.length
      ? ['', '# Register (operator dials — these color your MANNER, never your evidence)', '', ...registers]
      : []),
    ...publicSpeechDiscipline(publicRegister),
    ...publicRegisterPolicy(publicRegister),
    '',
    `Declare your move each turn: figure ∈ {${TUTOR_FIGURES.join(', ')}}, the premise you are working (or null), intent ∈ {${intents.join(', ')}}.`,
    '',
    'Reply with ONLY a JSON object:',
    `{"dialogue": "<what you say to the learner>", "move": {"figure": "...", "target_premise": "<premise id or null>", "intent": "..."}${
      releaseAuthority
        ? ', "release": "<exhibit id from your window, or null to hold>", "release_reason": "<one line when playing off the scheduled turn, else null>"'
        : ''
    }${
      reconstruct
        ? ', "theory": {"believed_held": ["<premise id>", ...], "believed_missing": [...], "believed_mistaken": [...]}'
        : ''
    }${
      plot ? ', "plot": {"hold_by_end": ["<claim>", ...], "withhold": "...", "friction": "...", "fallback": "..."}' : ''
    }${
      throughline
        ? ', "throughline": {"arc": ["<waypoint>", ...], "hold_to_end": "...", "risk": "...", "salvage": "..."}, "throughline_reason": "<one line when revising voluntarily, else null>"'
        : ''
    }${
      strategyLedger
        ? `, "scene_commitment": {"register": "<from the offered palette>", "didactic_default": "<mode family>", "release_posture": "eager" | "hold" | "consolidate", "recognition_budget": <0-4>, "rationale": "<one line>", "exit_condition": "<what the learner does when this scene has worked>"${
            strategyLedgerV2
              ? ', "stance": "<from the offered stance palette, or null>", "release_intent": ["<exhibit id you intend to play this scene>", ...] (release-authority runs only; omit otherwise)'
              : ''
          }}`
        : ''
    }${
      strategyLedgerV2
        ? ', "strategy_review": {"decision": "persist" | "adjust" | "switch", "reason": "<one line>"} (scene-opening turns with a history table only; omit otherwise), "departure": "<one line when this turn deliberately departs from your scene commitment, else null>"'
        : ''
    }}`,
    ...(plot ? ['("plot" belongs to act-opening turns ONLY — the harness marks them; omit the key mid-act.)'] : []),
    ...(throughline
      ? [
          '("throughline" belongs to the FIRST turn and to act-opening revisions — the harness marks when it is due; omit the key otherwise.)',
        ]
      : []),
    ...(strategyLedger
      ? [
          '("scene_commitment" belongs to scene-opening turns ONLY — the harness marks them; omit the key mid-scene.',
          'The commitment is CONDUCT strategy for the scene — register, explanatory default, pacing posture, recognition budget.',
          'It never names, gates, or reorders a release, a repair, a proof target, or the concealed answer;',
          'the release calendar and proof-control obligations outrank it everywhere they speak.)',
        ]
      : []),
    ...(strategyLedgerV2
      ? [
          '(v2 trialling: your scene strategy is an EXPERIMENT. The history table shows what you tried and how it',
          'landed — review it at each opening and persist, adjust, or switch with a reason. Your commitment GUIDES',
          "rather than binds the turn: when the learner's behavior warrants acting off-commitment, do it and declare",
          'it in "departure" — declared departures are adjudicated as justified deviation, undeclared ones as drift.',
          'An assigned stance counts only when its cues are VISIBLE in your lines; warm challenge in costume is',
          'treatment noncompliance, not evidence. A release intent never widens a pacing window — guards rule.)',
        ]
      : []),
  ].join('\n');
}

/**
 * The tutor's superego — the watcher inside the same mind (operator mandate
 * 2026-06-10: the 4-arm staging experiment proved the note→figure mechanism
 * but with an external author; organic development means the tutor watches
 * its OWN manner). It sees public material plus the tutor's draft: never the
 * secret, the premise ledger, or the schedule — so it cannot leak what it
 * does not hold, and its note governs manner only.
 *
 * Charter v3 (`stallWatch`, pre-registered in notes/poetics/2026-06-10-
 * stall-watcher-quasi-logical-tom.md §3) adds a SECOND criterial
 * jurisdiction: the stalled inference — board-closure arithmetic the harness
 * states as fact (available ≥ 3 turns, unvoiced, grounds untargeted). With
 * `stallWatch` false the v2 charter is returned byte-identical (the OFF
 * control). `counsel` (the critic-feedback loop, §4) is a labeled appendix
 * in both modes — counsel, never a jurisdiction.
 */
function tutorSuperegoSystem(
  world,
  {
    stallWatch = false,
    counsel = null,
    reconstruct = false,
    confront = false,
    repairClause = false,
    plot = false,
    throughline = false,
    castLayer = false,
    castReinvention = false,
  } = {},
) {
  return [
    "You are the tutor's SUPEREGO in a staged derivation drama — the watcher inside",
    'the same mind. You are never heard on stage; only the tutor reads you.',
    `The drama: "${world.title}". The public question: ${world.question}`,
    '',
    ...(stallWatch
      ? [
          "Each turn you see the tutor's DRAFT line with its declared figure, the",
          'recent record of conduct, and the inference record. You watch TWO things',
          'and two only.',
          '',
          'Your first jurisdiction is the FIGURE RUT — the same declared device on',
          'both of the last two turns, and the draft declaring it a third time.',
          'Three in a row is a rut; anything less is conduct, not a rut.',
          '',
          'Your second jurisdiction is the STALLED INFERENCE. You hold the same rules',
          'of evidence the learner reasons by; the record each turn states what those',
          "rules already yield from the learner's public board that the learner has",
          "not yet said aloud, how many turns it has waited, and whether the tutor's",
          'recent turns or the draft touch its grounds. A stall requires ALL THREE:',
          'the inference has been available three turns or more; the learner has not',
          "voiced it; and neither of the tutor's last two turns nor the draft targets",
          'any of its grounds. Anything less is patience, not a stall. When the record',
          'shows a stall the draft does not answer, intervene: name the facts already',
          "on the learner's board that are not being put together, and the rule that",
          'joins them — that exactly, and nothing more.',
        ]
      : confront
        ? [
            "Each turn you see the tutor's DRAFT line with its declared figure and its",
            'declared target, and the recent record of conduct. You watch TWO things',
            'and two only.',
            '',
            'Your first jurisdiction is the FIGURE RUT — the same declared device on',
            'both of the last two turns, and the draft declaring it a third time.',
            'Three in a row is a rut; anything less is conduct, not a rut.',
            '',
            'Your second jurisdiction is the UNCONFRONTED RE-ENTRY. The tutor is bound',
            'to confront before re-staging: a draft move that targets an exhibit staged',
            'on an earlier turn, with any intent but "confront", is licensed only by a',
            'confrontation of that same exhibit standing since its last staging — and',
            'each confrontation licenses one re-entry, no more. The record each turn',
            "states the draft's target and intent, whether that exhibit was staged",
            'earlier, and whether an unspent confrontation covers it — every value as',
            'fact. When the record shows an uncovered re-entry, intervene: tell the',
            'tutor to confront first — demand the read-back of what the learner holds',
            'of that exhibit, restating nothing of its content.',
            ...(repairClause
              ? [
                  '',
                  'One further license, under the REPAIR CLAUSE: a draft re-entry with',
                  'declared intent "restore" claims that the learner, in their most recent',
                  'line, named that very exhibit as lost or bent. The record states the',
                  "mechanical facts and leaves the claim to you: read the learner's last",
                  "line in the record before you. Where it names that exhibit's loss, the",
                  're-entry is licensed — the report stands as the read-back, and the',
                  'restoration must not be delayed for a confrontation. Where it does not,',
                  'the claim is false and the draft is an uncovered re-entry: intervene as',
                  'for any other.',
                ]
              : []),
          ]
        : [
            "Each turn you see the tutor's DRAFT line with its declared figure, and the",
            'recent record of conduct. You watch ONE thing: the FIGURE RUT — the same',
            'declared device on both of the last two turns, and the draft declaring it a',
            'third time. Three in a row is a rut; anything less is conduct, not a rut.',
          ]),
    '',
    'Your default reply is {"intervene": false}. The manner usually serves. Every',
    'other dissatisfaction you may feel — pacing, register, a recap the learner',
    'has outgrown, a conceit leaned on too often — is NOT yours to correct: put a',
    'word of it in "diagnosis" if you must, and still reply intervene false. A',
    'note every turn is a note never heard; you are credible because you are',
    ...(stallWatch
      ? [
          'rare. When a rut is real, intervene and name the device to leave off; when',
          'a stall is real, intervene with the stall note exactly as your second',
          'jurisdiction describes — in one or two sentences either way, as a note the',
          'tutor reads before speaking.',
          '',
          'THE EVIDENCE BOUNDARY: never name or describe evidence not yet on the',
          "learner's board; never name the answer or any fact of its shape; never",
          'tell the tutor what to reveal or withhold. Facts already grounded on the',
          "learner's public board are public property — a stall note names those,",
          'the rule that joins them, and nothing else.',
        ]
      : confront
        ? [
            'rare. When a rut is real, intervene and name the device to leave off; when',
            'an uncovered re-entry is real, intervene and order the confrontation first',
            '— in one or two sentences either way, as a note the tutor reads before',
            'speaking.',
            '',
            'THE EVIDENCE BOUNDARY: never name or describe evidence not yet staged;',
            'never restate any content of the exhibit in question; never name the',
            'answer or any fact of its shape. The note demands the read-back; it never',
            'supplies what the read-back should contain.',
          ]
        : [
            'rare. When the rut is real, intervene and name the device to leave off — in',
            'one or two sentences, as a note the tutor reads before speaking.',
            '',
            'You NEVER touch the evidence: never name facts, premises, documents, or the',
            'answer; never tell the tutor what to reveal or withhold. The note governs how',
            'the tutor plays, never what the drama shows.',
          ]),
    ...(reconstruct
      ? [
          '',
          "The draft comes with the tutor's RECONSTRUCTION of the learner's theory",
          "(believed held / missing / mistaken — the learner's board is hidden from",
          "you both; the reconstruction is the ego's inference from conduct). Read it",
          'as context; when the draft plainly ignores its own reconstruction — a',
          'premise believed missing that the turn does nothing to restore — say so in',
          '"diagnosis". Your jurisdiction is unchanged: intervene only on the rut.',
        ]
      : []),
    ...(plot
      ? [
          '',
          "The draft may come with the tutor's standing PLOT for the act (committed",
          'at its opening)' +
            (throughline
              ? " and the tutor's standing THROUGHLINE for the whole play" + ' (committed at the first turn)'
              : '') +
            '. Read ' +
            (throughline ? 'them' : 'it') +
            ' as context; when the draft plainly abandons its',
          'own plot — a withhold about to be staged, a named friction met with',
          'nothing — say so in "diagnosis". Your jurisdiction is unchanged: the',
          'act-close audit, not the turn watch, judges the plot' + (throughline ? ' and the arc' : '') + '.',
        ]
      : []),
    ...(castLayer
      ? [
          '',
          'The draft may also come with a CAST LAYER block. It is public conduct',
          'context: tutor stance, learner posture, relation pressure, and optional',
          'bounded tutor reinvention. Audit stance compliance and block any drift',
          'that would change release timing, proof target, restore/hold authority,',
          'or final assertion. Your jurisdiction is still conduct, not evidence.',
          ...(castReinvention
            ? [
                'If reinvention is active, check whether the draft inhabits the new',
                'stance without overcorrecting into answer-giving.',
              ]
            : []),
        ]
      : []),
    ...(counsel
      ? [
          '',
          "# Counsel from the previous performance's reader",
          '',
          'Counsel, never a jurisdiction — your triggers are exactly those above and',
          'only those. It adds no evidence and changes no criterion.',
          '',
          counsel.trim(),
        ]
      : []),
    '',
    'Reply with ONLY a JSON object:',
    '{"intervene": true|false,',
    ...(stallWatch
      ? [' "jurisdiction": "figure_rut" | "stalled_inference" | null,']
      : confront
        ? [' "jurisdiction": "figure_rut" | "unconfronted_reentry" | null,']
        : []),
    ' "diagnosis": "<one sentence on the conduct you see>",',
    ' "note": "<the note the tutor reads before speaking, or null>"}',
  ].join('\n');
}

// The audit's verdict vocabulary (C1): anything outside it gates to
// 'unscored' rather than being trusted — the contract is the three words.
const PLOT_VERDICTS = new Set(['kept', 'justified_deviation', 'drift']);

// The arc verdict vocabulary (C1 two-layer): the act-close audit also reads
// the act against the standing throughline. Same gate discipline.
const ARC_VERDICTS = new Set(['on_arc', 'off_arc']);

function lastLearnerExcerpt(transcript = []) {
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    const line = transcript[i];
    if (line.role === 'learner' && typeof line.text === 'string' && line.text.trim()) {
      return line.text.trim();
    }
  }
  return null;
}

function compactReleaseDecision(releaseDecision) {
  if (!releaseDecision) return null;
  return {
    turn: releaseDecision.turn,
    windowSize: releaseDecision.windowSize,
    claimed: releaseDecision.claimed || null,
    played: releaseDecision.played || null,
    forced: releaseDecision.forced || null,
    overridden: Boolean(releaseDecision.overridden),
    ...(releaseDecision.pacingGuard
      ? {
          pacingGuard: {
            blocked: releaseDecision.pacingGuard.blocked,
            forcedSafe: releaseDecision.pacingGuard.forcedSafe,
            forcedBy: releaseDecision.pacingGuard.forcedBy || null,
            candidate: releaseDecision.pacingGuard.candidate || null,
            reason: releaseDecision.pacingGuard.reason || null,
          },
        }
      : {}),
    ...(releaseDecision.visibleGuard
      ? {
          visibleGuard: {
            blocked: releaseDecision.visibleGuard.blocked,
            forcedSafe: releaseDecision.visibleGuard.forcedSafe,
            forcedBy: releaseDecision.visibleGuard.forcedBy || null,
            candidate: releaseDecision.visibleGuard.candidate || null,
            reason: releaseDecision.visibleGuard.reason || null,
          },
        }
      : {}),
    ...(releaseDecision.hybridGuard
      ? {
          hybridGuard: {
            accepted: Boolean(releaseDecision.hybridGuard.accepted),
            reason: releaseDecision.hybridGuard.reason || null,
          },
        }
      : {}),
    ...(releaseDecision.consolidationGuard
      ? {
          consolidationGuard: {
            held: Boolean(releaseDecision.consolidationGuard.held),
            visiblePushIgnored: Boolean(releaseDecision.consolidationGuard.visiblePushIgnored),
            reason: releaseDecision.consolidationGuard.reason || null,
          },
        }
      : {}),
    ...(releaseDecision.discursiveReleaseGate
      ? {
          discursiveReleaseGate: {
            held: Boolean(releaseDecision.discursiveReleaseGate.held),
            candidate: releaseDecision.discursiveReleaseGate.candidate || null,
            publicContentOverride: Boolean(releaseDecision.discursiveReleaseGate.publicContentOverride),
            publicContentAudit: releaseDecision.discursiveReleaseGate.publicContentAudit
              ? {
                  voiced: Boolean(releaseDecision.discursiveReleaseGate.publicContentAudit.voiced),
                  action: releaseDecision.discursiveReleaseGate.publicContentAudit.action || null,
                  matches: releaseDecision.discursiveReleaseGate.publicContentAudit.matches || [],
                }
              : null,
            reason: releaseDecision.discursiveReleaseGate.reason || null,
          },
        }
      : {}),
  };
}

function conductTriggerState({
  view,
  conductProofDebt,
  conductProgressPolicy = false,
  releaseBits,
  playable = [],
  forcedPlay = null,
  forcedNote,
  finalEntitlement,
  visibleConsolidation,
  conductTriggerOnly = false,
}) {
  const evidence = {
    learnerExcerpt: lastLearnerExcerpt(view.transcript),
    releaseDecision: compactReleaseDecision(releaseBits.releaseDecision),
  };
  const overrideValidAlternative =
    view.conductTriggerOverride?.triggerType === 'valid_alternative_route_candidate'
      ? {
          active: true,
          premiseId: view.conductTriggerOverride.premiseId || view.conductTriggerOverride.targetPremise || null,
          reason: view.conductTriggerOverride.evidence?.intervention?.reason || null,
        }
      : null;
  const learnerEntitlement = deriveEntitlementState({
    view,
    proofDebtTutorView: conductProofDebt,
    releaseDecision: releaseBits.releaseDecision,
    playable,
    forcedPlay,
    forcedNote,
    finalEntitlement,
    visibleConsolidation,
    conductProgressPolicy,
    validAlternativeCandidate: overrideValidAlternative,
    recognitionNeed: view.scene?.recognitionNeed || null,
  });
  if (view.conductTriggerOverride) {
    return {
      ...view.conductTriggerOverride,
      id: view.conductTriggerOverride.id || `t${view.turn}:conduct-trigger-override`,
      turn: view.turn,
      evidence: {
        ...evidence,
        learnerEntitlement,
        ...(view.conductTriggerOverride.evidence || {}),
      },
      learnerEntitlement,
      ...(conductProofDebt ? { proofDebtTutorView: conductProofDebt } : {}),
    };
  }
  if (conductTriggerOnly) return null;
  if (!entitlementNeedsConduct(learnerEntitlement, { conductProgressPolicy })) return null;
  return {
    id: `t${view.turn}:learner-entitlement`,
    triggerType: 'learner_entitlement',
    learnerEntitlement,
    premiseId:
      learnerEntitlement.proofDebt.targetPremise ||
      learnerEntitlement.release.targetPremise ||
      learnerEntitlement.validAlternative.targetPremise ||
      learnerEntitlement.visible.premiseId ||
      null,
    evidence: {
      ...evidence,
      learnerEntitlement,
    },
  };
}

const CONDUCT_INTENTS = Object.freeze({
  repair_dependency: 'restore',
  ask_diagnostic: 'test',
  ask_scope_test: 'test',
  consolidate_subproof: 'consolidate',
  release_next_evidence: 'release',
  block_assertion: 'confront',
  invite_final_assertion: 'stage_recognition',
  repair_recognition_rupture: 'stage_recognition',
});

const CONDUCT_RELEASE_FORBIDDEN = new Set([
  'ask_diagnostic',
  'ask_scope_test',
  'consolidate_subproof',
  'block_assertion',
  'invite_final_assertion',
  'repair_recognition_rupture',
]);

function conductIntentFor(moveFamily, fallback = 'orient') {
  return CONDUCT_INTENTS[moveFamily] || fallback;
}

function trimTerminalPunctuation(text) {
  return String(text || '')
    .trim()
    .replace(/[.!?]+$/u, '');
}

function conductPolicyDialogue(decision, { release = null, register = 'default' } = {}) {
  const family = decision.selectedMoveFamily;
  const view = decision.tutorView || {};
  const surface = typeof view.surface === 'string' && view.surface.trim() ? view.surface.trim() : null;
  const target = decision.targetPremise || view.targetPremise || release || null;
  const line =
    family === 'repair_dependency'
      ? surface
        ? `Before we close anything, put this earlier piece back in full: ${trimTerminalPunctuation(surface)}. Tell me what it gives us.`
        : 'Before we close anything, recover the earlier piece in your own words, then use it here.'
      : family === 'release_next_evidence'
        ? surface
          ? `Take this new piece now: ${trimTerminalPunctuation(surface)}. Say what it changes before we go on.`
          : `Take the next authorized piece${target ? ` (${target})` : ''}. Say what it changes before we go on.`
        : family === 'ask_diagnostic'
          ? 'Pause there. What in the public record licenses that next step?'
          : family === 'ask_scope_test'
            ? 'Test the reach of that warrant before we use it. Where does it hold, and where would it fail?'
            : family === 'consolidate_subproof'
              ? 'Hold the local result still for a moment. State the pieces already on stage that make this step stand.'
              : family === 'block_assertion'
                ? 'Do not close on that yet. Name the public support that would make the answer follow, or keep the inquiry open.'
                : family === 'invite_final_assertion'
                  ? 'Now say the conclusion yourself from the public record. Which staged pieces make it unavoidable?'
                  : family === 'repair_recognition_rupture'
                    ? 'Let me slow down. What part of my last move failed to meet what you were asking for?'
                    : 'Pause and say what the public record licenses next.';
  return sanitizePublicDialogue(line, { register });
}

function updateReleaseDecisionForConductBlock(releaseDecision, { blockedRelease, reason }) {
  if (!releaseDecision || typeof releaseDecision !== 'object') return releaseDecision;
  return {
    ...releaseDecision,
    played: null,
    overridden: true,
    conductPolicyEnforcement: {
      blockedRelease,
      reason,
    },
  };
}

function enforceConductPolicy(decision, finalOut, { activeRegisterName = 'default' } = {}) {
  const activeDecision = { ...decision, active: true };
  const preCompliance = auditConductGeneratorCompliance(activeDecision, {
    move: finalOut.move || null,
    release: finalOut.release || null,
  });
  if (preCompliance.ok === true) {
    return {
      out: finalOut,
      preCompliance,
      postCompliance: preCompliance,
      enforcement: {
        enabled: true,
        applied: false,
        changed: false,
        preOk: true,
        postOk: true,
        reason: 'already_compliant',
      },
    };
  }

  const family = decision.selectedMoveFamily;
  const target = decision.targetPremise || finalOut.move?.targetPremise || null;
  const intent = conductIntentFor(family, finalOut.move?.intent || 'orient');
  const enforcedTarget = family === 'repair_dependency' || target ? target : finalOut.move?.targetPremise || null;
  let out = {
    ...finalOut,
    dialogue: conductPolicyDialogue(decision, {
      release: finalOut.release || target || null,
      register: activeRegisterName,
    }),
    move: {
      figure: finalOut.move?.figure || 'erotema',
      targetPremise: enforcedTarget,
      intent,
    },
  };

  let reason = `forced_${family}`;
  let blockedRelease = null;
  let forcedReleasePreserved = false;

  if (family === 'release_next_evidence') {
    const certified = decision.targetPremise || finalOut.releaseDecision?.played || finalOut.release || null;
    if (certified) {
      out = {
        ...out,
        release: certified,
        ...(out.releaseDecision
          ? {
              releaseDecision: {
                ...out.releaseDecision,
                played: certified,
                conductPolicyEnforcement: {
                  requiredRelease: certified,
                  reason,
                },
              },
            }
          : {}),
      };
    }
  } else if (CONDUCT_RELEASE_FORBIDDEN.has(family) && finalOut.release) {
    const forced = finalOut.releaseDecision?.forced && finalOut.releaseDecision.forced === finalOut.release;
    if (forced) {
      forcedReleasePreserved = true;
      reason = `forced_release_preserved_for_${family}`;
    } else {
      blockedRelease = finalOut.release;
      reason = `blocked_release_for_${family}`;
      out = {
        ...out,
        release: null,
        releaseDecision: updateReleaseDecisionForConductBlock(out.releaseDecision, {
          blockedRelease,
          reason,
        }),
      };
      delete out.releaseReason;
    }
  }

  const postCompliance = auditConductGeneratorCompliance(activeDecision, {
    move: out.move || null,
    release: out.release || null,
  });
  const before = JSON.stringify({
    dialogue: finalOut.dialogue || '',
    move: finalOut.move || null,
    release: finalOut.release || null,
  });
  const after = JSON.stringify({
    dialogue: out.dialogue || '',
    move: out.move || null,
    release: out.release || null,
  });
  const changed = before !== after;

  return {
    out,
    preCompliance,
    postCompliance,
    enforcement: {
      enabled: true,
      applied: true,
      changed,
      preOk: preCompliance.ok === true,
      postOk: postCompliance.ok === true,
      reason,
      selectedMoveFamily: family,
      ...(blockedRelease ? { blockedRelease } : {}),
      ...(forcedReleasePreserved ? { forcedReleasePreserved: true } : {}),
    },
  };
}

function conductRuntimeLog(args) {
  const state = conductTriggerState(args);
  if (!state) {
    const generatorCompliance = auditConductGeneratorCompliance(null, {
      move: args.finalOut.move || null,
      release: args.finalOut.release || null,
    });
    return {
      out: args.finalOut,
      policy: {
        schema: CONDUCT_POLICY_SCHEMA,
        active: false,
        loggingOnly: !args.enforce,
        reasonCode: 'no_policy_trigger',
        selectedMoveFamily: null,
        generatorCompliance,
        ...(args.enforce
          ? {
              enforcement: {
                enabled: true,
                applied: false,
                changed: false,
                preOk: null,
                postOk: null,
                reason: 'no_policy_trigger',
              },
            }
          : {}),
      },
    };
  }
  const decision = selectConductMove(state);
  const enforced = args.enforce
    ? enforceConductPolicy({ ...decision, active: true }, args.finalOut, {
        activeRegisterName: args.activeRegisterName,
      })
    : null;
  const realizedOut = enforced?.out || args.finalOut;
  const generatorCompliance =
    enforced?.postCompliance ||
    auditConductGeneratorCompliance(
      { ...decision, active: true },
      {
        move: realizedOut.move || null,
        release: realizedOut.release || null,
      },
    );
  return {
    out: realizedOut,
    policy: {
      ...decision,
      active: true,
      loggingOnly: !args.enforce,
      triggerType: state.triggerType,
      realizedMove: realizedOut.move || null,
      realizedRelease: realizedOut.release || null,
      ...(enforced
        ? {
            preEnforcementCompliance: enforced.preCompliance,
            enforcement: enforced.enforcement,
          }
        : {}),
      generatorCompliance,
    },
  };
}

/**
 * The act-close plot audit — the same watcher, sitting in a SECOND seat (C1,
 * plan §5). At each act boundary it judges the closed act's PLOT against the
 * record as played: every clause kept, justified_deviation, or drift. It
 * holds the ego's own plot text plus stage-public conduct (the act's lines
 * and staged exhibit ids) — never the secret, the premise ledger, or the
 * learner's board — and its verdict is read by the ego alone: intra-mind,
 * no new evidence channel onto the stage.
 */
function plotAuditSystem(world, { throughline = false } = {}) {
  return [
    "You are the tutor's SUPEREGO in a staged derivation drama, sitting as the",
    'ACT-CLOSE AUDITOR. An act has just closed. Before you: the PLOT the tutor',
    'committed at its opening, and the public record of the act as played —',
    "nothing else. No secret, no exhibit ledger, no view of the learner's board.",
    `The drama: "${world.title}". The public question: ${world.question}`,
    '',
    'Judge the plot CLAUSE BY CLAUSE against the record:',
    '- "kept" — the record honours the clause: a hold_by_end claim the learner',
    '  demonstrably holds (cites it, uses it, reads it back); a withhold that',
    '  stayed unstaged; a named friction met by its fallback when it arrived.',
    '- "justified_deviation" — the clause was bent and the record shows why: a',
    '  better line opened, the learner forced the issue, the act closed early.',
    '  Name the evidence.',
    '- "drift" — the act wandered off the clause with nothing in the record to',
    '  answer for it. A clause too vague to check is drift by default.',
    ...(throughline
      ? [
          '',
          "You may also be shown the tutor's standing THROUGHLINE — the whole",
          "play's plan, committed at the first turn. When it is before you, give",
          'ONE further verdict on the act as a whole against it: "on_arc" (the act',
          "advanced the throughline's waypoints, or held its ground for a named",
          'reason) or "off_arc" (the act spent itself away from the arc — name',
          'where). One verdict for the act, not per waypoint; the run-end audit',
          'reckons the throughline clause by clause, not you.',
        ]
      : []),
    '',
    'Your audit reaches the tutor alone — never the stage. Be exact and',
    'unsentimental: the next plot is built on these verdicts.',
    '',
    'Reply with ONLY a JSON object:',
    '{"audit": [{"clause": "<the clause, quoted or tightly paraphrased>", "verdict": "kept" | "justified_deviation" | "drift", "evidence": "<one line from the record>"}, ...],' +
      (throughline
        ? '\n "arc": {"verdict": "on_arc" | "off_arc", "evidence": "<one line from the record>"} (only when a throughline is before you, else omit),'
        : ''),
    ' "summary": "<one or two lines the tutor reads before plotting the next act>"}',
  ].join('\n');
}

export function makeLlmTutor(
  world,
  client,
  {
    script,
    dials = {},
    superego = false,
    stallWatch = false,
    counsel = null,
    decayVisibility = 'told',
    actsMode = false,
    reconstruct = false,
    confront = false,
    repairClause = false,
    releaseAuthority = false,
    pacingGuard = false,
    visibleGuard = false,
    visiblePushProbeGuard = false,
    visibleConsolidationGuard = false,
    proofDebtGuard = false,
    guardSpec = null,
    plot = false,
    throughline = false,
    rhetoricalPolicy = null,
    discursiveCalibration = false,
    didacticMode = false,
    conductPolicy = false,
    conductPolicyEnforce = false,
    conductProgressPolicy = false,
    conductTriggerOnly = false,
    publicRegister = 'default',
    castLayer = false,
    castReinvention = false,
    ownershipTarget = null,
    ownershipProof = false,
    ownershipTransferGate = false,
    strategyLedger = false,
    strategyLedgerV2 = false,
  } = {},
) {
  if (!script || !script.trim()) {
    throw new Error('derivation.llmRoles: makeLlmTutor requires a role-script (the iteration target)');
  }
  if (strategyLedgerV2 && !strategyLedger) {
    throw new Error('derivation.llmRoles: strategyLedgerV2 requires strategyLedger (v2 rides the v1 commitment loop)');
  }
  if (stallWatch && !superego) {
    throw new Error(
      'derivation.llmRoles: stallWatch requires the superego (the stall jurisdiction lives in its charter)',
    );
  }
  if (decayVisibility !== 'told' && decayVisibility !== 'conduct') {
    throw new Error(
      `derivation.llmRoles: decayVisibility must be 'told' or 'conduct', got ${JSON.stringify(decayVisibility)}`,
    );
  }
  // Acts-mode wiring guards: the engine's redaction removes exactly the view
  // fields these features read, so a contradictory wiring fails at build, not
  // mid-drama. reconstruct is the adapt-ON arm dial and presupposes the
  // bounded stage; stallWatch reads the inference frontier (computed FROM the
  // hidden store); the told channel reads the corruption view.
  if (reconstruct && !actsMode) {
    throw new Error('derivation.llmRoles: reconstruct is acts-mode machinery (pass actsMode: true)');
  }
  if (actsMode && stallWatch) {
    throw new Error(
      'derivation.llmRoles: stallWatch cannot run in acts mode — the stall jurisdiction reads the inference frontier, which acts-mode redaction withholds from the tutor',
    );
  }
  if (actsMode && decayVisibility !== 'conduct') {
    throw new Error(
      "derivation.llmRoles: acts mode requires decayVisibility 'conduct' — the told channel reads a corruption view the acts-mode tutor no longer has",
    );
  }
  // C5 is acts-mode machinery: "re-entry" is only defined where a move
  // targeting an already-staged exhibit RE-STAGES it (the acts-mode charter);
  // in v1 the learner never lost the exhibit, so there is nothing to confront.
  if (confront && !actsMode) {
    throw new Error('derivation.llmRoles: confront requires acts mode (re-entry is an acts-mode concept)');
  }
  // §12: the repair clause is an exception WITHIN the confrontation
  // obligation — without confront there is no obligation to except, and the
  // "restore" license has nothing to claim against.
  if (repairClause && !confront) {
    throw new Error(
      'derivation.llmRoles: repairClause requires confront (the clause is an exception to the confrontation obligation)',
    );
  }
  if (pacingGuard && !releaseAuthority) {
    throw new Error(
      'derivation.llmRoles: pacingGuard requires releaseAuthority (it narrows the exhibit window to computed safe placements)',
    );
  }
  // The Step-1 visible guard is the form-match to pacingGuard: same authority
  // requirement, and mutually exclusive with it — the whole experiment is hidden
  // signal vs visible signal, so exactly one shapes the window per arm.
  if (visibleGuard && !releaseAuthority) {
    throw new Error(
      'derivation.llmRoles: visibleGuard requires releaseAuthority (it narrows the exhibit window from transcript-visible state)',
    );
  }
  if (visiblePushProbeGuard && !releaseAuthority) {
    throw new Error(
      'derivation.llmRoles: visiblePushProbeGuard requires releaseAuthority (it probes release-window pushes)',
    );
  }
  if (visiblePushProbeGuard && !pacingGuard) {
    throw new Error(
      'derivation.llmRoles: visiblePushProbeGuard requires pacingGuard (hidden remains the default arbitration surface)',
    );
  }
  if (visiblePushProbeGuard && visibleGuard) {
    throw new Error(
      'derivation.llmRoles: visiblePushProbeGuard cannot combine with visibleGuard (the visible arm is an active prompt guard, not a shadow probe)',
    );
  }
  if (visibleConsolidationGuard && !releaseAuthority) {
    throw new Error(
      'derivation.llmRoles: visibleConsolidationGuard requires releaseAuthority (it narrows/consolidates the release window)',
    );
  }
  if (visibleConsolidationGuard && !pacingGuard) {
    throw new Error(
      'derivation.llmRoles: visibleConsolidationGuard requires pacingGuard (hidden remains the release authority)',
    );
  }
  if (visibleConsolidationGuard && visibleGuard) {
    throw new Error(
      'derivation.llmRoles: visibleConsolidationGuard cannot combine with visibleGuard (visible is advisory/holding only in v4)',
    );
  }
  if (visibleConsolidationGuard && visiblePushProbeGuard) {
    throw new Error(
      'derivation.llmRoles: visibleConsolidationGuard cannot combine with visiblePushProbeGuard (v4 rejects release acceleration)',
    );
  }
  if (visibleGuard && pacingGuard) {
    throw new Error(
      'derivation.llmRoles: visibleGuard and pacingGuard are mutually exclusive (the hidden-vs-visible-signal contrast runs one guard per arm)',
    );
  }
  if (proofDebtGuard && !repairClause) {
    throw new Error(
      'derivation.llmRoles: proofDebtGuard requires repairClause (it authorizes restore moves within the re-entry discipline)',
    );
  }
  if (guardSpec && !pacingGuard && !proofDebtGuard) {
    throw new Error(
      'derivation.llmRoles: guardSpec requires pacingGuard and/or proofDebtGuard (otherwise the compiled monitor is unused)',
    );
  }
  const runtimeMonitor = guardSpec ? createRuntimeMonitor(world, guardSpec) : null;
  // C1 wiring guards: the plot is an act-scale commitment (no acts, no
  // opening to commit at and no close to audit), and the act-close audit is
  // the superego's jurisdiction — without the watcher nothing binds.
  if (plot && !actsMode) {
    throw new Error(
      'derivation.llmRoles: plot requires acts mode (the plot is an act-scale commitment — no acts, no opening to commit at or close to audit)',
    );
  }
  if (plot && !superego) {
    throw new Error('derivation.llmRoles: plot requires the superego (the act-close audit is its jurisdiction)');
  }
  // Two-layer planning (operator-directed 2026-06-12): the throughline is the
  // whole-play frame ABOVE the act plots — its arc verdict rides the act-close
  // audit, so without the plot loop there is nothing for it to bind to.
  if (throughline && !plot) {
    throw new Error(
      'derivation.llmRoles: throughline requires plot (the arc verdict rides the act-close audit — no plot loop, nothing binds)',
    );
  }
  const conductPolicyEnabled = Boolean(conductPolicy || conductPolicyEnforce || conductProgressPolicy);
  const rhetoricalPolicyConfig = rhetoricalPolicy ? normalizeRhetoricalPolicyConfig(rhetoricalPolicy) : null;
  const system = tutorSystem(world, script, dials, {
    actsMode,
    reconstruct,
    confront,
    repairClause,
    releaseAuthority,
    pacingGuard,
    visibleGuard,
    proofDebtGuard,
    plot,
    throughline,
    rhetoricalPolicy: Boolean(rhetoricalPolicyConfig),
    didacticMode,
    castLayer,
    castReinvention,
    ownershipProof,
    ownershipTransferGate,
    publicRegister,
    strategyLedger,
    strategyLedgerV2,
  });
  const superegoSystem = superego
    ? tutorSuperegoSystem(world, {
        stallWatch,
        counsel,
        reconstruct,
        confront,
        repairClause,
        plot,
        throughline,
        castLayer,
        castReinvention,
      })
    : null;
  const plotAuditCharter = plot ? plotAuditSystem(world, { throughline }) : null;
  const normalizeMove = (out) =>
    out.move && typeof out.move === 'object'
      ? {
          figure: out.move.figure || null,
          targetPremise: out.move.target_premise || null,
          intent: out.move.intent || null,
        }
      : null;
  // Theory shape gate (arm-ON): premise-id string arrays or nothing — a
  // malformed theory drops to null, which keeps the engine's recording gate
  // closed for that turn (absence is visible to the scorer; an empty claim
  // is not fabricated on the model's behalf).
  const normalizeTheory = (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const ids = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);
    return {
      believed_held: ids(raw.believed_held),
      believed_missing: ids(raw.believed_missing),
      believed_mistaken: ids(raw.believed_mistaken),
    };
  };
  // --- C1 (plan §5): the per-act plot, committed at each act opening and
  // audited at each close. Per-run state lives in the bridge closure (the
  // firstSeen-Map pattern from makeLlmLearner). ---
  const plotState = plot ? { current: null, actIndex: null, authoredTurn: null, lastAudit: null } : null;
  // Two-layer planning: the throughline is per-RUN state (one frame for the
  // whole play), where plotState is per-act. lastArc carries the audit's arc
  // verdict across the boundary — it is what makes an off_arc verdict bind
  // the next opening's revision demand.
  const throughlineState = throughline ? { current: null, committedTurn: null, revisedTurns: [], lastArc: null } : null;
  const castRuntimeState = castLayer ? { activeReinvention: null, sceneIndex: null, actIndex: null } : null;
  // Strategy-ledger bridge state (the plot pattern one scope down): the
  // scene commitment lives here between its opening and its audit at the
  // next opening; the engine records rows and applies the register.
  const ledgerBridgeState = strategyLedger ? { commitment: null, sceneIndex: null } : null;
  // Plot shape gate: a plot is real only when at least one field is
  // non-empty — a malformed or empty plot drops to null, which keeps the
  // engine's recording gate closed for that act (absence is visible to the
  // scorer; an empty commitment is not fabricated on the model's behalf).
  const normalizePlot = (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const holdByEnd = Array.isArray(raw.hold_by_end)
      ? raw.hold_by_end.map((x) => String(x).trim()).filter(Boolean)
      : [];
    const withhold = str(raw.withhold);
    const friction = str(raw.friction);
    const fallback = str(raw.fallback);
    if (!holdByEnd.length && !withhold && !friction && !fallback) return null;
    return { holdByEnd, withhold, friction, fallback };
  };
  // Audit shape gate: a clause with a verdict outside the contract is kept
  // but gated to 'unscored' rather than trusted; no clauses -> null. The
  // throughline rider parses with the same discipline: the arc verdict gates
  // to 'unscored' outside ARC_VERDICTS, and the run-end clause reckoning
  // reuses the plot's three-word vocabulary.
  const parseClauses = (v) =>
    (Array.isArray(v) ? v : [])
      .filter((c) => c && typeof c === 'object')
      .map((c) => ({
        clause: typeof c.clause === 'string' ? c.clause.trim() : '',
        verdict: PLOT_VERDICTS.has(c.verdict) ? c.verdict : 'unscored',
        evidence: typeof c.evidence === 'string' ? c.evidence.trim() : '',
      }))
      .filter((c) => c.clause);
  const normalizeAudit = (raw, act) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const clauses = parseClauses(raw.audit);
    if (!clauses.length) return null;
    const arc =
      throughline && raw.arc && typeof raw.arc === 'object' && !Array.isArray(raw.arc)
        ? {
            verdict: ARC_VERDICTS.has(raw.arc.verdict) ? raw.arc.verdict : 'unscored',
            evidence: typeof raw.arc.evidence === 'string' ? raw.arc.evidence.trim() : '',
          }
        : null;
    const throughlineAudit = throughline ? parseClauses(raw.throughline_audit) : [];
    return {
      act,
      clauses,
      summary: typeof raw.summary === 'string' && raw.summary.trim() ? raw.summary.trim() : null,
      ...(arc ? { arc } : {}),
      ...(throughlineAudit.length ? { throughlineAudit } : {}),
    };
  };
  const renderPlotLines = (p) => [
    ...p.holdByEnd.map((c, i) => `- hold_by_end[${i + 1}]: ${c}`),
    ...(p.withhold ? [`- withhold: ${p.withhold}`] : []),
    ...(p.friction ? [`- friction: ${p.friction}`] : []),
    ...(p.fallback ? [`- fallback: ${p.fallback}`] : []),
  ];
  // Throughline shape gate: same discipline as the plot — real only when at
  // least one field is non-empty; a malformed commitment drops to null, the
  // play runs without a standing frame, and the next opening re-demands one
  // (the lapse stays visible to the scorer).
  const normalizeThroughline = (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const arc = Array.isArray(raw.arc) ? raw.arc.map((x) => String(x).trim()).filter(Boolean) : [];
    const holdToEnd = str(raw.hold_to_end);
    const risk = str(raw.risk);
    const salvage = str(raw.salvage);
    if (!arc.length && !holdToEnd && !risk && !salvage) return null;
    return { arc, holdToEnd, risk, salvage };
  };
  const renderThroughlineLines = (t) => [
    ...t.arc.map((w, i) => `- arc[${i + 1}]: ${w}`),
    ...(t.holdToEnd ? [`- hold_to_end: ${t.holdToEnd}`] : []),
    ...(t.risk ? [`- risk: ${t.risk}`] : []),
    ...(t.salvage ? [`- salvage: ${t.salvage}`] : []),
  ];
  // The act-close audit call: a separate tutor_superego call under its own
  // charter. The auditor holds the ego's plot text and the act's public
  // record (its lines + the exhibit ids staged in its span) — the watch's
  // leak discipline: nothing concealed enters, and the verdict goes to the
  // ego alone, never the stage.
  const auditClosedAct = async (closedAct, standingPlot, { transcript, ledger, turn, isFinal = false }) => {
    const [from, to] = closedAct.turns;
    const actLines = transcript.filter(
      (l) => l.turn >= from && l.turn <= to && (l.role === 'tutor' || l.role === 'learner'),
    );
    const staged = ledger.filter((l) => l.turn >= from && l.turn <= to).map((l) => l.premiseId);
    // The standing throughline enters the auditor's view AS IT STOOD during
    // the act — the call order at a boundary is audit -> draft -> watch, so
    // any revision this turn lands after the verdict it must answer.
    const standingThroughline = throughline ? throughlineState.current : null;
    const auditUser = [
      `Act ${closedAct.act} has closed (turns ${from}–${to}).`,
      '',
      'THE PLOT the tutor committed at its opening:',
      ...renderPlotLines(standingPlot),
      ...(standingThroughline
        ? [
            '',
            "THE THROUGHLINE the tutor holds for the whole play — give your 'arc'",
            'verdict on the closed act against it:',
            ...renderThroughlineLines(standingThroughline),
          ]
        : []),
      '',
      `Exhibits staged during the act: ${staged.length ? staged.join(', ') : 'none'}.`,
      '',
      'The act as played:',
      actLines.map((l) => `[turn ${l.turn}] ${l.role.toUpperCase()}: ${(l.text || '').trim()}`).join('\n') ||
        '(no lines)',
      '',
      ...(isFinal && standingThroughline
        ? [
            'This is the RUN-END audit: the play is over. Additionally reckon the',
            'THROUGHLINE clause by clause against the whole record, as',
            '"throughline_audit": [{"clause": "...", "verdict": "kept" | "justified_deviation" | "drift", "evidence": "..."}, ...].',
            '',
          ]
        : []),
      'Audit the plot clause by clause. Reply with ONLY the JSON object.',
    ].join('\n');
    // mock determinism: a hold clause is kept iff a premise id it names was
    // staged within the act span, else drift; the other clause kinds audit
    // kept. The real backend ignores meta.
    const stagedSet = new Set(staged);
    const mockClauses = [
      ...standingPlot.holdByEnd.map((c) => ({
        clause: c,
        verdict: [...world.premiseById.keys()].some((id) => c.includes(id) && stagedSet.has(id)) ? 'kept' : 'drift',
        evidence: 'mock: hold clause checked against the act-span ledger',
      })),
      ...(standingPlot.withhold
        ? [{ clause: standingPlot.withhold, verdict: 'kept', evidence: 'mock: withhold honoured' }]
        : []),
      ...(standingPlot.friction
        ? [{ clause: standingPlot.friction, verdict: 'kept', evidence: 'mock: friction named in advance' }]
        : []),
      ...(standingPlot.fallback
        ? [{ clause: standingPlot.fallback, verdict: 'kept', evidence: 'mock: fallback stood ready' }]
        : []),
    ];
    // mock determinism for the throughline rider: on_arc iff the act staged
    // at least one exhibit (an act that moved evidence advanced the arc); the
    // final call reckons every throughline clause kept. The real backend
    // ignores meta.
    const mockArcBits = standingThroughline
      ? {
          arc: {
            verdict: staged.length ? 'on_arc' : 'off_arc',
            evidence: staged.length
              ? `mock: act staged ${staged.join(', ')}`
              : 'mock: act staged nothing — the arc did not advance',
          },
          ...(isFinal
            ? {
                throughlineAudit: [
                  ...standingThroughline.arc.map((w) => ({
                    clause: w,
                    verdict: 'kept',
                    evidence: 'mock: waypoint reckoned at run end',
                  })),
                  ...(standingThroughline.holdToEnd
                    ? [
                        {
                          clause: standingThroughline.holdToEnd,
                          verdict: 'kept',
                          evidence: 'mock: hold_to_end reckoned at run end',
                        },
                      ]
                    : []),
                  ...(standingThroughline.risk
                    ? [{ clause: standingThroughline.risk, verdict: 'kept', evidence: 'mock: risk named in advance' }]
                    : []),
                  ...(standingThroughline.salvage
                    ? [
                        {
                          clause: standingThroughline.salvage,
                          verdict: 'kept',
                          evidence: 'mock: salvage stood ready',
                        },
                      ]
                    : []),
                ],
              }
            : {}),
        }
      : {};
    const out = await callJson(client, 'tutor_superego', turn, {
      system: plotAuditCharter,
      user: auditUser,
      meta: {
        plotAuditHint: {
          clauses: mockClauses,
          summary: `mock audit of act ${closedAct.act}`,
          ...mockArcBits,
        },
      },
    });
    return normalizeAudit(out, closedAct.act);
  };
  const tutorFn = async (view) => {
    const activeRegisterName = activePublicRegister(publicRegister, view);
    const visibleConsolidation = visibleConsolidationGuard
      ? (() => {
          const features = visibleSurfaceFeatures(world, {
            turn: view.turn,
            ledger: view.ledger,
            transcript: view.transcript,
          });
          const stalling = isStalling(features);
          const lines = [];
          if (!features.priorEchoed) {
            lines.push(
              `VISIBLE CONSOLIDATION: the prior exhibit ${features.priorPremiseId || '—'} is not yet clearly taken up on the page (echo ${features.priorEcho.toFixed(2)}). Hold or consolidate before adding new evidence unless the hidden pacing guard forces a release.`,
            );
          }
          if (stalling) {
            lines.push(
              `VISIBLE CONSOLIDATION: the page reads as stalled (${features.turnsSinceLastRelease} turns since last release; hedge trend ${features.hedgeTrend.toFixed(2)}; length trend ${features.lenTrend.toFixed(1)}). Consolidate, ask for a repair/restatement, or test the existing board. Do not release early merely because the page stalls.`,
            );
          }
          return { features: { ...features, stalling }, lines };
        })()
      : null;
    // C2 (release authority): the fixed per-turn cue becomes a WINDOW. Each
    // unreleased via-tutor entry is playable from RELEASE_LATITUDE turns
    // before its scheduled turn; at RELEASE_LATITUDE past it, it hits the
    // hold limit and the bridge force-plays it (a model choice to the
    // contrary is overridden and recorded). The schedule-driven branch is
    // byte-identical when the dial is off.
    const alreadyReleased = new Set(view.ledger.map((l) => l.premiseId));
    const playable = releaseAuthority
      ? world.releaseSchedule.filter(
          (e) => e.via === 'tutor' && !alreadyReleased.has(e.premise) && view.turn >= e.turn - RELEASE_LATITUDE,
        )
      : [];
    const forcedPlay = releaseAuthority
      ? playable.filter((e) => view.turn >= e.turn + RELEASE_LATITUDE).sort((a, b) => a.turn - b.turn)[0] || null
      : null;
    const { entry, premise } = releaseAuthority
      ? { entry: null, premise: null }
      : scheduledFor(world, view.turn, 'tutor');
    const pacingRows =
      releaseAuthority && pacingGuard
        ? playable.map((e) => {
            const safeTurns = safeReleaseTurns(world, view.ledger, {
              premise: e.premise,
              latitude: RELEASE_LATITUDE,
            });
            const current = releaseSolvency(world, view.ledger, { premise: e.premise, turn: view.turn });
            return { ...e, safeTurns, current };
          })
        : [];
    const pacingByPremise = new Map(pacingRows.map((r) => [r.premise, r]));
    // V's prompt channel: the same page read the decision enforces, computed once
    // here for the per-turn note. Reads only view.ledger + view.transcript — the
    // page — never the proof DAG or the decay ledger.
    const visibleFeatures =
      releaseAuthority && visibleGuard
        ? visibleSurfaceFeatures(world, { turn: view.turn, ledger: view.ledger, transcript: view.transcript })
        : null;
    const visibleStalling = visibleFeatures ? isStalling(visibleFeatures) : false;
    const proofDebt = proofDebtGuard && view.proofDebt?.active ? view.proofDebt : null;
    const conductProofDebt = conductPolicyEnabled && view.proofDebt?.active ? view.proofDebt : null;
    const topProofDebt = proofDebt?.debts?.[0] || null;
    const proofDebtSection = topProofDebt
      ? [
          '',
          'PROOF-DEBT GUARD ACTIVE:',
          `- Restore ${topProofDebt.premiseId} before closure or discretionary new work.`,
          `- Already-staged exhibit to put back in full: ${(topProofDebt.surface || '').trim()}`,
          ...(topProofDebt.sinceTurn
            ? [`- It has been out of the working proof state since turn ${topProofDebt.sinceTurn}.`]
            : []),
          'Use move.intent "restore" and target_premise for this exhibit. This is a harness-authorized proof-state repair, not a new release.',
        ]
      : [];
    const proxyDagPacingSection = proxyDagPacingLines(view.proxyDagPacing);
    const tutorLearnerDagModelSection = tutorLearnerDagModelLines(view.tutorLearnerDagModel);
    // Acts-mode redaction (engine.js omniscientView): no learnerAbox, no
    // trajectory, no corruption — the tutor works from the dialogue and its
    // own ledger. The v1 branch below is untouched.
    const lastPoint = actsMode ? null : view.trajectory[view.trajectory.length - 1] || null;
    const forcedNote =
      lastPoint && lastPoint.forced
        ? "THE LEARNER'S OWN GROUNDED FACTS NOW FORCE THE CONCLUSION. Stage the recognition — bring them to say it and ground it; do not say it yourself."
        : null;
    const finalEntitlement = view.conductEntitlement?.canAssertFinal ? { canAssertFinal: true } : null;
    const windowLines = playable.map((e) => {
      const held = view.turn - e.turn;
      const status =
        forcedPlay && forcedPlay.premise === e.premise
          ? 'AT ITS HOLD LIMIT — must be played THIS turn'
          : held < 0
            ? `playable early (scheduled turn ${e.turn})`
            : held === 0
              ? 'scheduled THIS turn'
              : `held ${held} turn${held === 1 ? '' : 's'} (scheduled turn ${e.turn}; hold limit turn ${e.turn + RELEASE_LATITUDE})`;
      const pacing = pacingByPremise.get(e.premise);
      const pacingStatus =
        pacingGuard && pacing
          ? pacing.current?.safe
            ? ` — tempo-solvent now; safe turns {${pacing.safeTurns.map((t) => `t${t}`).join(', ') || 'none'}}`
            : ` — CLOCK-FATAL if played now (${pacing.current?.verdict || 'unknown'} t${
                pacing.current?.endTurn || '?'
              }); safe turns {${pacing.safeTurns.map((t) => `t${t}`).join(', ') || 'none'}}`
          : '';
      return `- ${e.premise}: ${status}${pacingStatus}`;
    });
    const task = releaseAuthority
      ? [
          'YOUR EXHIBIT WINDOW this turn:',
          windowLines.length ? windowLines.join('\n') : '(no exhibit playable this turn — "release" must be null)',
          '',
          'Declare "release": one exhibit id from the window to play it this turn, or',
          'null to hold. Playing off the scheduled turn needs a one-line',
          '"release_reason". When you play an exhibit, weave its evidence (from the',
          'premise ledger) into your dialogue as something produced or recalled,',
          'faithful to it. Beyond the window, work the inquiry by your script —',
          'whichever your reading of the learner calls for.',
          ...(pacingGuard
            ? [
                '',
                'The solvency guard is active: prefer tempo-solvent placements. A',
                'CLOCK-FATAL claim may be held by the harness, and an exhibit at its',
                'last safe turn may be played even if you ask to hold.',
              ]
            : []),
          ...(visibleGuard && visibleFeatures
            ? [
                '',
                'THE PAGE (visible-pacing guard active):',
                visibleFeatures.priorPremiseId
                  ? `- your last exhibit ${visibleFeatures.priorPremiseId}: ${
                      visibleFeatures.priorEchoed
                        ? 'taken up by the learner on the page'
                        : 'NOT yet taken up — a new exhibit may be held until it is'
                    }`
                  : '- no exhibit released yet',
                `- ${visibleFeatures.turnsSinceLastRelease} turn(s) since your last release${
                  visibleStalling ? ' — the page reads as stalling; an exhibit in your window may be pushed' : ''
                }`,
              ]
            : []),
        ].join('\n')
      : premise
        ? `THIS TURN IS YOUR CUE to bring ${entry.premise} into play. Weave this evidence into your dialogue as something produced or recalled, faithful to it:\n"${(premise.surface || '').trim()}"`
        : actsMode
          ? 'No release is due from you this turn. Work the inquiry by your script — consolidate, test, counter the tempting answer, re-stage what you judge lost, or stage the recognition — whichever your reading of the learner calls for.'
          : "No release is due from you this turn. Work the learner's board by your script: consolidate, test, counter the tempting answer, or stage the recognition — whichever the board calls for.";
    const cuePremiseForPolicy = releaseAuthority
      ? forcedPlay?.premise || playable.find((e) => e.turn === view.turn)?.premise || null
      : entry?.premise || null;
    const publicFactsEnableFinal = entails(
      [...(world.background || []), ...(view.releasedFacts || [])],
      world.rules,
      world.secret.fact,
    );
    const releaseWillEnableFinal =
      releaseAuthority && cuePremiseForPolicy
        ? (() => {
            const cueFact = world.premises.find((p) => p.id === cuePremiseForPolicy)?.fact || null;
            const releasedFactKeys = new Set((view.releasedFacts || []).map((fact) => factKey(fact)));
            const publicFacts = [
              ...(world.background || []),
              ...(view.releasedFacts || []),
              ...(cueFact && !releasedFactKeys.has(factKey(cueFact)) ? [cueFact] : []),
            ];
            return entails(publicFacts, world.rules, world.secret.fact);
          })()
        : false;
    const publicTranscriptForCalibration = (view.transcript || []).map((line) => ({
      turn: line.turn,
      role: line.role,
      text: line.text || '',
      ...(line.meta?.exchange ? { meta: { exchange: line.meta.exchange } } : {}),
    }));
    const lastLearnerLineForCalibration = [...publicTranscriptForCalibration]
      .reverse()
      .find((line) => line.role === 'learner');
    const discursiveProofStep = (() => {
      if (topProofDebt) return { moveFamily: 'repair_dependency', targetPremise: topProofDebt.premiseId };
      if (forcedNote || finalEntitlement?.canAssertFinal)
        return { moveFamily: 'invite_final_assertion', targetPremise: null };
      if (cuePremiseForPolicy) return { moveFamily: 'release_next_evidence', targetPremise: cuePremiseForPolicy };
      if (visibleConsolidation?.features?.priorPremiseId) {
        return {
          moveFamily: 'consolidate_subproof',
          targetPremise: visibleConsolidation.features.priorPremiseId,
        };
      }
      return null;
    })();
    const discursiveCalibrationState = discursiveCalibration
      ? deriveDiscursiveCalibrationState({
          transcript: publicTranscriptForCalibration,
          learnerText: lastLearnerLineForCalibration?.text || null,
          exchange: lastLearnerLineForCalibration?.meta?.exchange || null,
          learnerState: view.discursiveLearnerState || view.publicLearnerState || {},
          recognitionNeed: view.scene?.recognitionNeed || null,
          finalAssertionAvailable: Boolean(forcedNote || finalEntitlement?.canAssertFinal),
          proofStep: discursiveProofStep,
        })
      : null;
    const didacticCurrentObject =
      topProofDebt?.surface ||
      (visibleConsolidation?.features?.priorPremiseId ? 'the already staged exhibit under discussion' : null) ||
      (discursiveProofStep?.moveFamily === 'release_next_evidence' ? 'the next exhibit entering the scene' : null) ||
      (discursiveProofStep?.moveFamily === 'invite_final_assertion' ? "the learner's final public answer" : null) ||
      (view.scene?.goal ? 'the current scene object' : null);
    // --- Strategy-ledger scene lifecycle (the plot lifecycle one scope
    // down): on a scene-opening turn the bridge FIRST audits the commitment
    // for the scene just sealed (deterministically — the harness can check
    // everything a commitment binds), THEN demands a fresh one; mid-scene
    // turns read the standing commitment back. The final scene's commitment
    // goes unaudited at run end — the missing row is the ledger of that
    // lapse. ---
    const ledgerInfo = strategyLedger ? view.strategyLedger || null : null;
    const trialling = Boolean(strategyLedgerV2 && ledgerInfo?.config?.trialling);
    const sceneOpening = Boolean(strategyLedger && view.scene && view.scene.startTurn === view.turn);
    let sceneCommitmentAudit = null;
    if (
      strategyLedger &&
      sceneOpening &&
      ledgerBridgeState.commitment &&
      ledgerInfo?.lastClosedScene &&
      ledgerBridgeState.sceneIndex === ledgerInfo.lastClosedScene.index
    ) {
      const audit = auditTutorSceneCommitment(
        ledgerBridgeState.commitment,
        {
          ...ledgerInfo.lastClosedScene,
          didacticModes: didacticMode ? ledgerInfo.lastClosedScene.didacticModes : null,
        },
        // v2 adjudication inputs: declared departures license drift down to
        // justified_deviation (stance exempt); the engine's fidelity gate
        // verdict feeds the stance clause.
        trialling
          ? {
              departures: ledgerInfo.lastClosedScene.departures || 0,
              fidelity: ledgerInfo.lastClosedScene.stanceFidelity || null,
            }
          : {},
      );
      if (audit) sceneCommitmentAudit = { sceneIndex: ledgerInfo.lastClosedScene.index, ...audit };
      ledgerBridgeState.commitment = null;
      ledgerBridgeState.sceneIndex = null;
    }
    const didacticModeStateBase = didacticMode
      ? deriveDidacticModeState({
          currentObject: didacticCurrentObject,
          transcript: publicTranscriptForCalibration,
          learnerText: lastLearnerLineForCalibration?.text || null,
          exchange: lastLearnerLineForCalibration?.meta?.exchange || null,
          discursiveCalibration: discursiveCalibrationState,
          scene: {
            closeStatus: view.scene?.closeStatus || view.scene?.status || null,
            exchangesSoFar: view.scene?.exchangesSoFar ?? view.scene?.exchanges?.length ?? null,
            phaticSoFar: view.scene?.phaticSoFar ?? null,
          },
          uptake: {
            quality: discursiveCalibrationState?.uptakeQuality || null,
            echoOnly: discursiveCalibrationState?.publicPosture === 'fluent_echo',
            purposeGap: discursiveCalibrationState?.publicPosture === 'purpose_question',
            wrongRoute: discursiveCalibrationState?.publicPosture === 'wrong_route',
          },
          repairSignals: topProofDebt
            ? [
                {
                  publicObject: topProofDebt.surface || 'already staged exhibit',
                  count: 1,
                  sameObject: true,
                },
              ]
            : [],
          act: view.acts?.closed?.[view.acts.closed.length - 1]?.didacticFallback
            ? { audit: { outcome: 'fallback_failed' } }
            : null,
        })
      : null;
    // Phase-0d hold / Phase-1c escalation (strategy ledger): an open block
    // holds its adopted mode steady — the per-turn classifier proposes, the
    // block disposes; a mode that failed its exit condition last block is
    // not re-selectable and remaps one step up the intervention ladder.
    let didacticModeState = didacticModeStateBase;
    let heldDidacticNote = null;
    if (strategyLedger && didacticModeState) {
      const heldMode = ledgerInfo?.block?.heldMode || null;
      if (heldMode && didacticModeState.recommendedMode !== heldMode) {
        didacticModeState = {
          ...didacticModeState,
          recommendedMode: heldMode,
          ...(ledgerInfo.block.exitCondition ? { exitCondition: ledgerInfo.block.exitCondition } : {}),
          evidence: [...(didacticModeState.evidence || []).slice(0, 3), 'mode held for the open block'],
        };
        heldDidacticNote = `DIDACTIC HOLD: the open block holds mode ${heldMode} until its exit condition clears or its budget runs out.`;
      } else if (
        ledgerInfo?.blockedModes?.length &&
        ledgerInfo.blockedModes.includes(didacticModeState.recommendedMode)
      ) {
        const failedMode = didacticModeState.recommendedMode;
        const escalated = escalateDidacticMode(failedMode);
        didacticModeState = {
          ...didacticModeState,
          recommendedMode: escalated,
          evidence: [
            ...(didacticModeState.evidence || []).slice(0, 3),
            `${failedMode} failed its exit condition last block; escalated`,
          ],
        };
        heldDidacticNote = `DIDACTIC ESCALATION: ${failedMode} failed its exit condition last block — use ${escalated} instead (do not repeat ${failedMode} without new grounds).`;
      }
    }
    const learnerTransformationState = ownershipProof
      ? deriveLearnerTransformationState({
          target: ownershipTarget || world.ownershipTarget || null,
          transcript: publicTranscriptForCalibration,
          learnerText: lastLearnerLineForCalibration?.text || null,
          turn: view.turn,
          enabled: true,
          finalAssertionAvailable: Boolean(
            forcedNote || finalEntitlement?.canAssertFinal || publicFactsEnableFinal || releaseWillEnableFinal,
          ),
          transferGate: ownershipTransferGate,
        })
      : null;
    const sceneIndexForCast = view.scene?.index ?? null;
    const actIndexForCast = view.acts?.index ?? null;
    if (
      castRuntimeState?.activeReinvention &&
      castRuntimeState.actIndex !== null &&
      actIndexForCast !== castRuntimeState.actIndex
    ) {
      castRuntimeState.activeReinvention = null;
      castRuntimeState.sceneIndex = null;
      castRuntimeState.actIndex = null;
    } else if (
      castRuntimeState?.activeReinvention &&
      castRuntimeState.actIndex === null &&
      castRuntimeState.sceneIndex !== null &&
      sceneIndexForCast !== castRuntimeState.sceneIndex
    ) {
      castRuntimeState.activeReinvention = null;
      castRuntimeState.sceneIndex = null;
    }
    const castInput = castLayer
      ? {
          worldCast: world.cast,
          worldSetting: world.setting,
          worldLearnerVoice: world.learnerVoice,
          stagePrologue: view.stagePrologue,
          transcript: publicTranscriptForCalibration,
          scene: view.scene,
          turn: view.turn,
          discursiveCalibration: discursiveCalibrationState,
          didacticMode: didacticModeState,
          recognitionNeed: view.scene?.recognitionNeed || null,
          repairSignals: topProofDebt
            ? [
                {
                  publicObject: topProofDebt.surface || 'already staged exhibit',
                  count: 1,
                  sameObject: true,
                },
              ]
            : [],
        }
      : null;
    let castState = null;
    if (castInput) {
      castState = deriveCastState({
        ...castInput,
        activeReinvention: castRuntimeState?.activeReinvention || null,
        reinventionEnabled:
          castReinvention &&
          !castRuntimeState?.activeReinvention &&
          (sceneIndexForCast !== null || actIndexForCast !== null),
      });
      if (castReinvention && !castRuntimeState.activeReinvention && castState.reinvention?.active) {
        castRuntimeState.activeReinvention = castState.reinvention;
        castRuntimeState.sceneIndex = sceneIndexForCast;
        castRuntimeState.actIndex = actIndexForCast;
      } else if (castRuntimeState.activeReinvention) {
        castState = deriveCastState({
          ...castInput,
          activeReinvention: castRuntimeState.activeReinvention,
          reinventionEnabled: false,
        });
      }
    }
    const didacticModeSection = didacticModeLines(didacticModeState);
    const actDidacticFallbackSection = didacticActFallbackLines(view.acts, view.turn);
    const castLayerSection = castLayerLines(castState, 'tutor');
    const learnerTransformationSection = learnerTransformationLines(learnerTransformationState);
    const highDiscursiveStrain = discursiveCalibrationState?.conversationalStrain?.level === 'high';
    const discursiveReleaseSection =
      highDiscursiveStrain && releaseAuthority
        ? [
            '',
            'DISCURSIVE RELEASE LATITUDE:',
            '- Public strain is high. If an exhibit is only playable early, hold or consolidate unless a hard proof-control obligation forces it.',
            '- This does not block scheduled, hold-limit, last-safe, proof-debt, or final-recognition obligations.',
          ]
        : [];
    const rhetoricalAdvice = rhetoricalPolicyConfig
      ? recommendRhetoricalMove(
          world,
          view,
          {
            topProofDebt,
            forced: Boolean(forcedNote),
            releaseCue: Boolean(cuePremiseForPolicy),
            cuePremise: cuePremiseForPolicy,
            playableCount: playable.length,
            lastReleasePremise: view.ledger[view.ledger.length - 1]?.premiseId || null,
            discursiveCalibration: discursiveCalibrationState,
            didacticMode: didacticModeState,
            proofStep: discursiveProofStep,
          },
          rhetoricalPolicyConfig,
        )
      : null;
    const rhetoricalPolicySection = renderRhetoricalPolicy(rhetoricalAdvice);
    // --- C1 plot lifecycle (acts mode only): on an act-opening turn the
    // bridge FIRST audits the act just closed (the engine seals act N during
    // the director phase of this same turn, so the closed act is already in
    // view.acts.closed), THEN demands a fresh plot — the ordering is the
    // binding: the verdicts are on the table before the next plot is
    // written. Mid-act turns read the standing plot back. ---
    let plotAuditRow = null;
    let plotOpening = false;
    if (plot) {
      const a = view.acts;
      plotOpening = a.startTurn === view.turn;
      if (plotOpening) {
        const closedAct = a.closed[a.closed.length - 1] || null;
        if (plotState.current && closedAct && plotState.actIndex === closedAct.act) {
          plotAuditRow = await auditClosedAct(closedAct, plotState.current, {
            transcript: view.transcript,
            ledger: view.ledger,
            turn: view.turn,
          });
          if (plotAuditRow) plotState.lastAudit = plotAuditRow;
        }
        // The arc verdict crosses the boundary here: written before the
        // prompt section is assembled, so an off_arc verdict binds THIS
        // opening's revision demand (audit -> draft -> watch).
        if (throughline && plotAuditRow?.arc) throughlineState.lastArc = plotAuditRow.arc.verdict;
        plotState.current = null;
        plotState.actIndex = a.index;
      }
    }
    // --- Throughline lifecycle (two-layer planning): committed at the first
    // turn, read back EVERY turn above the act plot, revisable only at act
    // openings — demanded when nothing stands (opening / recommit) or when
    // the arc verdict went off_arc (audit_bound); permitted with a declared
    // reason while on_arc (voluntary). ---
    let throughlineDue = false;
    let throughlineTrigger = null;
    if (throughline && plotOpening) {
      if (!throughlineState.current) {
        throughlineDue = true;
        throughlineTrigger = view.turn === 1 ? 'opening' : 'recommit';
      } else if (throughlineState.lastArc === 'off_arc') {
        throughlineDue = true;
        throughlineTrigger = 'audit_bound';
      }
    }
    const throughlineSection = (() => {
      if (!throughline) return [];
      const standing = throughlineState.current
        ? [
            '',
            `YOUR THROUGHLINE for the whole play (standing since turn ${throughlineState.committedTurn}):`,
            ...renderThroughlineLines(throughlineState.current),
          ]
        : [];
      if (!plotOpening) {
        return standing.length ? [...standing, 'The play moves under it; this act serves it.'] : [];
      }
      if (throughlineDue) {
        if (throughlineTrigger === 'audit_bound') {
          return [
            ...standing,
            'THE ARC VERDICT on the closed act was OFF_ARC — THE AUDIT BINDS: revise',
            'your throughline in "throughline" THIS turn to answer the evidence,',
            'alongside your dialogue and your act plot.',
          ];
        }
        return [
          '',
          throughlineTrigger === 'opening'
            ? 'THIS TURN OPENS THE PLAY — COMMIT YOUR THROUGHLINE (the whole play\'s plan) in "throughline", alongside your dialogue and your act plot.'
            : 'NO THROUGHLINE STANDS — COMMIT YOUR THROUGHLINE (the whole play\'s plan) in "throughline", alongside your dialogue and your act plot.',
        ];
      }
      return [
        ...standing,
        ...(throughlineState.lastArc === 'on_arc'
          ? [
              'The arc verdict on the closed act: ON_ARC. You MAY revise the throughline in "throughline" with a one-line "throughline_reason"; silence keeps it standing.',
            ]
          : [
              'You MAY revise the throughline in "throughline" with a one-line "throughline_reason"; silence keeps it standing.',
            ]),
      ];
    })();
    const plotSection = !plot
      ? []
      : plotOpening
        ? [
            '',
            ...(plotAuditRow
              ? [
                  `THE AUDIT of your act ${plotAuditRow.act} plot (your own watcher, clause by clause):`,
                  ...plotAuditRow.clauses.map(
                    (c) => `- [${c.verdict}] ${c.clause}${c.evidence ? ` — ${c.evidence}` : ''}`,
                  ),
                  ...(plotAuditRow.summary ? [`The auditor's summary: ${plotAuditRow.summary}`] : []),
                  'THE AUDIT BINDS: the plot you now commit must answer every drifted',
                  'clause — carry it forward, revise it, or retire it with a reason.',
                  '',
                ]
              : view.acts.index > 1
                ? ['(No audit: the previous act closed without a plot on record.)', '']
                : []),
            `THIS TURN OPENS ACT ${view.acts.index} — COMMIT YOUR PLOT for the act in "plot", alongside your dialogue.`,
          ]
        : plotState.current
          ? [
              '',
              'YOUR PLOT for this act (committed at its opening):',
              ...renderPlotLines(plotState.current),
              'Play under it; the audit at the act close distinguishes justified deviation from drift.',
            ]
          : [];
    // Strategy-ledger prompt block (the plot section one scope down): the
    // audit of the sealed scene binds at the opening, the standing commitment
    // reads back mid-scene, and hold/escalation/budget notes ride along.
    const strategyLedgerSection = (() => {
      if (!strategyLedger) return [];
      const lines = [];
      if (sceneCommitmentAudit) {
        lines.push(
          '',
          `THE AUDIT of your scene ${sceneCommitmentAudit.sceneIndex} commitment (deterministic, clause by clause):`,
          ...sceneCommitmentAudit.clauses.map(
            (c) => `- [${c.verdict}] ${c.clause}${c.evidence ? ` — ${c.evidence}` : ''}`,
          ),
          `Summary: ${sceneCommitmentAudit.summary}.`,
          'THE AUDIT BINDS: the commitment you now make must answer every drifted clause — carry it forward, revise it, or change course with a stated reason.',
        );
      }
      // v2: the mechanism history table renders before the fresh demand —
      // the review decision must answer the record, not intuition.
      if (trialling && sceneOpening && ledgerInfo?.history?.length) {
        lines.push('', 'YOUR MECHANISM HISTORY (what you tried, whether it was really tried, how it landed):');
        for (const h of ledgerInfo.history) {
          const strat = [
            h.strategy.stance ? `stance ${h.strategy.stance}` : null,
            h.strategy.didacticDefault ? `didactic ${h.strategy.didacticDefault}` : null,
            h.strategy.releasePosture ? `releases ${h.strategy.releasePosture}` : null,
            h.strategy.releaseIntent ? `intended ${h.strategy.releaseIntent.join('+')}` : null,
          ]
            .filter(Boolean)
            .join(', ');
          const outcome = [
            h.fidelity ? `fidelity ${h.fidelity.label}` : null,
            h.outcome.exitConditionCleared === null
              ? null
              : `exit ${h.outcome.exitConditionCleared ? 'cleared' : 'NOT cleared'}`,
            h.outcome.pressingExchanges ? `${h.outcome.pressingExchanges} pressing exchange(s)` : null,
            h.outcome.intendedPlayed !== null
              ? `${h.outcome.intendedPlayed}/${h.strategy.releaseIntent?.length ?? 0} intended played`
              : null,
            h.audit ? h.audit.summary : null,
            h.review ? `you chose: ${h.review.decision}` : null,
          ]
            .filter(Boolean)
            .join('; ');
          lines.push(`- scene ${h.sceneIndex} [${strat || 'no strategy'}] -> ${outcome || 'no outcome recorded'}`);
        }
        lines.push(
          'REVIEW THE RECORD and decide in "strategy_review": persist (same strategy), adjust (same mechanism, new settings), or switch (a different mechanism) — with a one-line reason.',
          'Outcomes only count for a mechanism that was actually deployed (fidelity: faithful); warm-in-costume trials teach you nothing.',
        );
      }
      if (sceneOpening && view.scene) {
        const palette = ledgerInfo?.config?.registerPalette?.length
          ? ledgerInfo.config.registerPalette
          : [activeRegisterName];
        lines.push(
          '',
          `THIS TURN OPENS SCENE ${view.scene.index} — COMMIT YOUR SCENE STRATEGY in "scene_commitment", alongside your dialogue:`,
          `- register: choose from [${palette.join(', ')}] — the harness holds your choice for the whole scene.`,
          `- didactic_default: your explanatory mode of first resort this scene (${DIDACTIC_MODE_FAMILIES.join(', ')}).`,
          '- release_posture: eager (play exhibits on their cue), hold (never ahead of schedule), consolidate (at most one release this scene).',
          '- recognition_budget: how many phatic/uptake exchanges this scene can afford (0-4).',
          '- exit_condition: what the learner will visibly do when this scene has worked.',
          'Conduct only: the release calendar and proof-control obligations outrank this everywhere they speak.',
        );
        if (trialling && ledgerInfo?.config?.stancePalette?.length) {
          const stanceLines = ledgerInfo.config.stancePalette.map((name) => {
            const def = getEngagementRegisterDefinition(name) || {};
            const cues = Array.isArray(def.stance_fidelity_cues) ? def.stance_fidelity_cues.slice(0, 4) : [];
            return `  · ${name} (${def.valence || 'unknown'} valence)${
              cues.length ? ` — cues that MUST be visible in your lines: ${cues.map((c) => `"${c}"`).join(', ')}` : ''
            }`;
          });
          lines.push(
            '- stance: choose your interpersonal stance for this scene from the palette (or null to stay plain):',
            ...stanceLines,
            '  A stance counts only when its cues are visible — an assigned stance without visible cues is treatment noncompliance, not style.',
          );
        }
        if (trialling && releaseAuthority && ledgerInfo?.config?.releaseIntent) {
          lines.push(
            '- release_intent: name the exhibit ids (up to 4, from your window) you INTEND to play this scene. Advisory to each turn; the pacing guard and hold limits rule as ever.',
          );
        }
      } else if (ledgerBridgeState?.commitment) {
        const c = ledgerBridgeState.commitment;
        lines.push(
          '',
          `YOUR SCENE COMMITMENT (scene ${ledgerBridgeState.sceneIndex}, standing since its opening):`,
          ...(c.register ? [`- register: ${c.register} (held by the harness)`] : []),
          ...(c.stance
            ? (() => {
                const def = getEngagementRegisterDefinition(c.stance) || {};
                const cues = Array.isArray(def.stance_fidelity_cues) ? def.stance_fidelity_cues.slice(0, 4) : [];
                return [
                  `- stance: ${c.stance}${cues.length ? ` — keep its cues visible: ${cues.map((x) => `"${x}"`).join(', ')}` : ''}`,
                ];
              })()
            : []),
          ...(c.didacticDefault ? [`- didactic default: ${c.didacticDefault}`] : []),
          ...(c.releasePosture ? [`- release posture: ${c.releasePosture}`] : []),
          ...(c.releaseIntent ? [`- release intent: ${c.releaseIntent.join(', ')} (guards rule)`] : []),
          ...(c.recognitionBudget !== null && c.recognitionBudget !== undefined
            ? [`- recognition budget: ${c.recognitionBudget}`]
            : []),
          ...(c.exitCondition ? [`- exit: ${c.exitCondition}`] : []),
          trialling
            ? 'It GUIDES rather than binds: depart when the learner warrants it and declare it in "departure" — declared departures adjudicate as justified deviation, undeclared drift as drift.'
            : 'Play under it; the audit at the scene close distinguishes kept from drift.',
        );
      }
      if (heldDidacticNote) lines.push('', heldDidacticNote);
      if (ledgerInfo?.budget?.exhausted) {
        lines.push(
          '',
          'OPPORTUNITY BUDGET EXHAUSTED: proof-neutral turns have run past the block budget — return to the proof obligation this turn (advisory; hard obligations already outrank).',
        );
      }
      return lines;
    })();
    // The tutor sees no staging state (movements are the director's diagnostic
    // dramaturgy, 2026-06-10): any rhythm-watching happens inside this bridge.
    let user;
    if (actsMode) {
      const a = view.acts;
      const thisAct = view.ledger.filter((l) => l.turn >= a.startTurn).map((l) => l.premiseId);
      const priorActs = view.ledger.filter((l) => l.turn < a.startTurn).map((l) => l.premiseId);
      user = [
        `Turn ${view.turn} of ${world.turnCap}. Act ${a.index}, turn ${a.turnsThisAct + 1} of the act.`,
        ...(a.brief ? [`The director's brief for this act: ${a.brief}`] : []),
        `Evidence on stage so far: ${view.ledger.length ? view.ledger.map((l) => l.premiseId).join(', ') : 'none'}.`,
        `Released THIS act (still before the learner): ${thisAct.length ? thisAct.join(', ') : 'none'}.`,
        `Released in EARLIER acts (out of the learner's view — alive only if kept on their board, or re-staged by you): ${priorActs.length ? priorActs.join(', ') : 'none'}.`,
        ...stagePrologueLines(view.stagePrologue, 'tutor'),
        '',
        'The dialogue so far (you remember all of it; the learner sees only this act):',
        renderTranscriptTail(view.transcript, view.transcript.length),
        ...publicRegisterTurnLines(activeRegisterName, publicRegister),
        ...sceneTempoLines(view.scene, 'tutor'),
        ...sceneRecognitionNeedLines(view.scene, 'tutor'),
        ...castLayerSection,
        ...actDidacticFallbackSection,
        ...didacticModeSection,
        ...learnerTransformationSection,
        ...(visibleConsolidation?.lines.length ? ['', ...visibleConsolidation.lines] : []),
        // The two frames, course above lesson: the whole-play throughline
        // reads back first, the act plot under it, the scene commitment under
        // both.
        ...throughlineSection,
        ...plotSection,
        ...strategyLedgerSection,
        ...rhetoricalPolicySection,
        ...proofDebtSection,
        ...tutorLearnerDagModelSection,
        ...proxyDagPacingSection,
        '',
        task,
      ].join('\n');
    } else {
      const board = view.learnerAbox.grounded.length
        ? view.learnerAbox.grounded.map((f) => `- ${renderFact(f)}`).join('\n')
        : '(empty beyond the public setup)';
      const hyps = view.learnerAbox.hypotheses.length
        ? view.learnerAbox.hypotheses.map((h) => `- [turn ${h.turn}] ${h.text}`).join('\n')
        : '(none ventured)';
      user = [
        `Turn ${view.turn} of ${world.turnCap}.`,
        `Evidence on stage so far: ${view.ledger.length ? view.ledger.map((l) => l.premiseId).join(', ') : 'none'}.`,
        ...stagePrologueLines(view.stagePrologue, 'tutor'),
        ...sceneTempoLines(view.scene, 'tutor'),
        ...sceneRecognitionNeedLines(view.scene, 'tutor'),
        ...castLayerSection,
        '',
        "The learner's grounded board:",
        board,
        '',
        "The learner's hypotheses:",
        hyps,
        '',
        // Decay visibility (corruption.js): under 'told' the tutor reads the
        // harness's ground truth of what slipped; under 'conduct' the block is
        // suppressed and decay is legible only through the learner's behaviour.
        // The engine view is untouched either way — instruments keep ground truth.
        ...(decayVisibility !== 'conduct' && view.corruption?.decayed?.length
          ? [
              `SLIPPED FROM THE BOARD: the learner has lost hold of ${view.corruption.decayed
                .map((d) => `${d.premiseId || renderFact(d.fact)} (since turn ${d.sinceTurn})`)
                .join(
                  ', ',
                )}. Staged evidence can fade; a move whose target_premise names a slipped exhibit re-stages it and restores it to the learner's hands.`,
              '',
            ]
          : []),
        'The last lines spoken:',
        renderTranscriptTail(view.transcript),
        ...publicRegisterTurnLines(activeRegisterName, publicRegister),
        ...(visibleConsolidation?.lines.length ? ['', ...visibleConsolidation.lines] : []),
        ...didacticModeSection,
        ...learnerTransformationSection,
        ...strategyLedgerSection,
        '',
        ...(forcedNote ? [forcedNote, ''] : []),
        ...rhetoricalPolicySection,
        ...discursiveReleaseSection,
        ...proofDebtSection,
        ...tutorLearnerDagModelSection,
        ...proxyDagPacingSection,
        ...(proofDebtSection.length ? [''] : []),
        task,
      ].join('\n');
    }
    // Mock release policy under authority: play each exhibit exactly on its
    // scheduled turn (deviation zero) — the mock exercises the choose-release
    // parse path while keeping adherence trivially clean. The real backend
    // ignores meta.
    const mockRelease = releaseAuthority
      ? (forcedPlay?.premise ?? playable.find((e) => e.turn === view.turn)?.premise ?? null)
      : null;
    const mockReleasePremise = mockRelease ? world.premiseById.get(mockRelease) : null;
    const meta = {
      releaseSurface: releaseAuthority
        ? mockReleasePremise
          ? mockReleasePremise.surface
          : null
        : premise
          ? premise.surface
          : null,
      cuePremise: releaseAuthority ? mockRelease : entry ? entry.premise : null,
      ...(releaseAuthority ? { releaseChoice: mockRelease } : {}),
      ...(releaseAuthority && pacingGuard
        ? {
            pacingGuard: {
              rows: pacingRows.map((r) => ({
                premise: r.premise,
                safeTurns: r.safeTurns,
                current: r.current,
              })),
            },
          }
        : {}),
      ...(topProofDebt
        ? {
            proofDebtGuard: {
              target: topProofDebt.premiseId,
              surface: topProofDebt.surface || null,
              debts: proofDebt.debts.map((d) => d.premiseId),
            },
          }
        : {}),
      ...(rhetoricalAdvice ? { rhetoricalPolicy: rhetoricalAdvice } : {}),
      ...(didacticModeState ? { didacticMode: didacticModeState } : {}),
      ...(learnerTransformationState ? { learnerTransformation: learnerTransformationState } : {}),
      ...(castState ? { castState, tutorReinvention: castState.reinvention || null } : {}),
      ...(view.tutorLearnerDagModel ? { tutorLearnerDagModel: view.tutorLearnerDagModel.metrics } : {}),
      ...(view.proxyDagPacing ? { proxyDagPacing: view.proxyDagPacing } : {}),
      ...(view.scene?.tempo ? { sceneTempo: view.scene.tempo } : {}),
      // mock determinism (arm-ON): the credulous theory — everything released
      // is believed held. The real backend ignores meta.
      ...(reconstruct ? { theoryHint: view.ledger.map((l) => l.premiseId) } : {}),
      // mock determinism (C5 arms): an exhibit staged on an earlier turn, for
      // the mock tutor to draft bare re-entries against on cue-less turns —
      // driving the fire → confront → licensed re-entry cycle without an LLM.
      ...(confront ? { reentryHint: view.ledger.find((l) => l.turn < view.turn)?.premiseId ?? null } : {}),
      // mock determinism (C1, opening turns): a schedule-derived plot — the
      // next two unreleased scheduled premises become the hold and withhold
      // clauses, friction/fallback fixed. The real backend ignores meta.
      ...(plot && plotOpening
        ? {
            plotHint: (() => {
              const unreleased = world.releaseSchedule.filter((e) => !alreadyReleased.has(e.premise));
              const p1 = unreleased[0]?.premise || null;
              const p2 = unreleased[1]?.premise || null;
              return {
                hold_by_end: [
                  p1
                    ? `the learner holds ${p1} beside what already stands`
                    : 'the learner restates the standing board unprompted',
                ],
                withhold: p2
                  ? `${p2} waits until ${p1} has landed`
                  : 'the conclusion stays unsaid until the board forces it',
                friction: 'the learner may leap to the tempting answer before the papers are in',
                fallback: 'restage what the learner garbles before anything new',
              };
            })(),
          }
        : {}),
      // mock determinism (two-layer): a schedule-derived throughline on the
      // turns the harness demands one — the remaining scheduled premises
      // become waypoints. The real backend ignores meta.
      ...(throughline && throughlineDue
        ? {
            throughlineHint: (() => {
              const unreleased = world.releaseSchedule.filter((e) => !alreadyReleased.has(e.premise));
              const waypoints = unreleased.slice(0, 3).map((e) => `the learner holds ${e.premise} and can say why`);
              return {
                arc: waypoints.length ? waypoints : ['the learner restates the standing board unprompted'],
                hold_to_end: 'the conclusion stays unsaid until the board forces it from the learner',
                risk: 'the play spends its acts staging evidence and never forces the join',
                salvage: 'fall back to the smallest two-fact join the board affords and build from there',
              };
            })(),
          }
        : {}),
      // mock determinism (strategy ledger): a scene-opening commitment —
      // second palette register when one is offered, schedule-aware posture.
      // Under v2 trialling the hint also cycles the stance palette by scene
      // index, names an intent from the unreleased schedule, and answers the
      // history with persist (switch when the last trial was unfaithful) —
      // so zero-paid runs traverse the review/two-gate path. The real
      // backend ignores meta.
      ...(strategyLedger && sceneOpening
        ? {
            sceneCommitmentHint: {
              register:
                (ledgerInfo?.config?.registerPalette || []).find((r) => r !== activeRegisterName) || activeRegisterName,
              didactic_default: 'slow_recap',
              release_posture: view.scene?.targetPremise ? 'eager' : 'hold',
              recognition_budget: 1,
              rationale: 'open the scene on its stated goal',
              exit_condition: 'the learner advances the scene goal in their own words',
              ...(trialling && ledgerInfo?.config?.stancePalette?.length
                ? {
                    stance:
                      ledgerInfo.config.stancePalette[
                        (view.scene?.index ?? 1) % ledgerInfo.config.stancePalette.length
                      ],
                  }
                : {}),
              ...(trialling && releaseAuthority && ledgerInfo?.config?.releaseIntent
                ? {
                    release_intent: world.releaseSchedule
                      .filter((e) => !view.ledger.some((l) => l.premiseId === e.premise))
                      .slice(0, 2)
                      .map((e) => e.premise),
                  }
                : {}),
            },
          }
        : {}),
      ...(trialling && sceneOpening && ledgerInfo?.history?.length
        ? {
            strategyReviewHint: {
              decision:
                ledgerInfo.history[ledgerInfo.history.length - 1]?.fidelity &&
                ledgerInfo.history[ledgerInfo.history.length - 1].fidelity.label !== 'faithful'
                  ? 'switch'
                  : 'persist',
              reason: 'answering the mechanism history table',
            },
          }
        : {}),
    };
    // C2 harness enforcement: the model's declared release is honored only
    // inside the window — an id outside it (unscheduled, already played, not
    // yet playable) is an invalid claim and drops to a hold; an exhibit at
    // its hold limit plays regardless of the claim. Every turn's decision is
    // recorded (claimed/played/forced/overridden/reason) for the adherence
    // instruments; the decision is made ONCE, on the draft — a superego
    // revision restages manner, never the evidence calendar.
    const normalizeRelease = (out) => {
      if (!releaseAuthority) return { release: entry ? entry.premise : null };
      const claimed = typeof out.release === 'string' && out.release.trim() ? out.release.trim() : null;
      const validClaim = claimed && playable.some((e) => e.premise === claimed) ? claimed : null;
      const guard = pacingGuard
        ? runtimeMonitor
          ? runtimeMonitor.hiddenPacingDecision({
              ledger: view.ledger,
              turn: view.turn,
              playable,
              validClaim,
              forcedPlay,
            })
          : pacingGuardDecision(world, view.ledger, {
              turn: view.turn,
              playable,
              validClaim,
              forcedPlay,
              latitude: RELEASE_LATITUDE,
            })
        : null;
      // V's decision channel — the Step-1 form-match. Same {played, blocked,
      // forcedSafe} contract the rest of this function consumes; the input is the
      // page (view.ledger + view.transcript), not view's proof state. Mutually
      // exclusive with the hidden guard at build, so at most one is set — the rest
      // reads whichever is active.
      const vGuard =
        visibleGuard || visiblePushProbeGuard || visibleConsolidationGuard
          ? visibleGuardDecision(world, view, { turn: view.turn, playable, validClaim, forcedPlay })
          : null;
      let activeGuard = guard || vGuard;
      let hybridGuard = null;
      let consolidationGuard = null;
      if (visiblePushProbeGuard) {
        const visiblePush =
          Boolean(vGuard?.forcedSafe) && vGuard?.forcedBy === 'visible_stall' && typeof vGuard.played === 'string';
        const hiddenSafeTurns = visiblePush ? guard?.safeTurns?.[vGuard.played] || [] : [];
        const hiddenSafeAtCurrentTurn = hiddenSafeTurns.includes(view.turn);
        const hiddenForcedDifferent = Boolean(
          guard?.forcedSafe && guard.played && vGuard?.played && guard.played !== vGuard.played,
        );
        const accepted = visiblePush && hiddenSafeAtCurrentTurn && !hiddenForcedDifferent;
        activeGuard = accepted ? vGuard : guard;
        hybridGuard = {
          mode: 'hidden_default_visible_stall_probe',
          accepted,
          played: accepted ? vGuard.played : guard?.played || null,
          visibleCandidate: vGuard?.played || vGuard?.candidate || null,
          hiddenCandidate: guard?.played || guard?.candidate || null,
          hiddenSafeAtCurrentTurn: Boolean(hiddenSafeAtCurrentTurn),
          hiddenForcedDifferent,
          reason: accepted
            ? `${vGuard.played} visible-stall push accepted: hidden guard also marks t${view.turn} safe`
            : visiblePush
              ? hiddenSafeAtCurrentTurn
                ? 'visible-stall push rejected: hidden guard has a different forced-safe release'
                : `${vGuard.played} visible-stall push rejected: hidden guard does not mark t${view.turn} safe`
              : 'visible probe ignored: only visible_stall forced-safe pushes can override hidden',
        };
      }
      if (visibleConsolidationGuard) {
        const visibleHold = Boolean(vGuard?.blocked);
        const hiddenForced = Boolean(guard?.forcedSafe);
        const held = visibleHold && !hiddenForced;
        activeGuard = held ? vGuard : guard;
        consolidationGuard = {
          mode: 'hidden_default_visible_hold_consolidation',
          held,
          played: held ? null : guard?.played || null,
          visibleCandidate: vGuard?.candidate || null,
          hiddenCandidate: guard?.played || guard?.candidate || null,
          hiddenForced,
          visibleStalling: Boolean(vGuard?.visibleFeatures?.stalling),
          visiblePushIgnored: Boolean(vGuard?.forcedSafe && vGuard?.forcedBy === 'visible_stall'),
          promptAdvisory: visibleConsolidation?.lines || [],
          reason: held
            ? 'visible hold accepted: prior exhibit is not yet taken up and hidden is not forcing a release'
            : vGuard?.forcedSafe && vGuard?.forcedBy === 'visible_stall'
              ? 'visible stall push ignored: v4 never accelerates release'
              : hiddenForced && visibleHold
                ? 'visible hold ignored: hidden guard is forcing a release'
                : 'visible consolidation advisory only; hidden guard remains release authority',
        };
      }
      const proofClosingFallback =
        pacingGuard && !vGuard && !validClaim && !activeGuard?.played
          ? pacingRows
              .filter(
                (row) =>
                  row.current?.safe === true &&
                  Number.isFinite(row.current.forcedTurn) &&
                  row.current.forcedTurn <= view.turn,
              )
              .sort((a, b) => a.turn - b.turn)[0] || null
          : null;
      if (proofClosingFallback) {
        activeGuard = {
          ...(guard || {}),
          played: proofClosingFallback.premise,
          blocked: false,
          forcedSafe: true,
          forcedBy: 'proof_closing_candidate',
          candidate: null,
          candidateSolvency: null,
          playedSolvency: proofClosingFallback.current,
          safeTurns: guard?.safeTurns || Object.fromEntries(pacingRows.map((row) => [row.premise, row.safeTurns])),
          alternative: proofClosingFallback.premise,
          reason: `${proofClosingFallback.premise} closes the proof at t${view.turn}`,
        };
      }
      const candidatePlayed = activeGuard ? activeGuard.played : forcedPlay ? forcedPlay.premise : validClaim;
      const candidateSched = candidatePlayed ? world.releaseSchedule.find((e) => e.premise === candidatePlayed) : null;
      const candidateOffset = candidateSched ? view.turn - candidateSched.turn : null;
      const candidateSolvency =
        activeGuard?.candidate === candidatePlayed
          ? activeGuard.candidateSolvency
          : activeGuard?.played === candidatePlayed
            ? activeGuard.playedSolvency
            : null;
      const releaseWouldCloseProofNow =
        candidateSolvency?.safe === true &&
        Number.isFinite(candidateSolvency.forcedTurn) &&
        candidateSolvency.forcedTurn <= view.turn;
      const proofControlForcesRelease = Boolean(
        forcedPlay?.premise === candidatePlayed ||
        activeGuard?.forcedSafe ||
        releaseWouldCloseProofNow ||
        topProofDebt ||
        forcedNote ||
        finalEntitlement?.canAssertFinal,
      );
      const discursiveGateCandidate =
        highDiscursiveStrain && candidatePlayed && candidateOffset < 0 && !proofControlForcesRelease;
      const publicContentAudit = discursiveGateCandidate
        ? publicLineVoicesReleaseContent(view, world, candidatePlayed, out.dialogue)
        : null;
      const discursiveReleaseGate = discursiveGateCandidate
        ? publicContentAudit?.voiced
          ? {
              held: false,
              candidate: candidatePlayed,
              scheduledTurn: candidateSched.turn,
              offset: candidateOffset,
              posture: discursiveCalibrationState.publicPosture || null,
              pressure: discursiveCalibrationState.advisory?.pressure || null,
              publicContentOverride: true,
              publicContentAudit,
              reason: `${candidatePlayed} registered despite high public strain: public line voiced the exhibit content before the scheduled turn`,
            }
          : {
              held: true,
              candidate: candidatePlayed,
              scheduledTurn: candidateSched.turn,
              offset: candidateOffset,
              posture: discursiveCalibrationState.publicPosture || null,
              pressure: discursiveCalibrationState.advisory?.pressure || null,
              publicContentAudit,
              reason: `${candidatePlayed} held: high public strain suppresses discretionary early release until scheduled turn ${candidateSched.turn}`,
            }
        : null;
      const played = discursiveReleaseGate?.held ? null : candidatePlayed;
      const reason =
        typeof out.release_reason === 'string' && out.release_reason.trim() ? out.release_reason.trim() : null;
      const sched = played ? world.releaseSchedule.find((e) => e.premise === played) : null;
      const releaseReason =
        discursiveReleaseGate?.reason || reason || (played && activeGuard?.reason ? activeGuard.reason : null);
      const forced = forcedPlay && played === forcedPlay.premise ? forcedPlay.premise : null;
      const hiddenGuardForReport = guard && !vGuard ? activeGuard || guard : guard;
      return {
        release: played,
        ...(releaseReason ? { releaseReason } : {}),
        releaseDecision: {
          turn: view.turn,
          windowSize: playable.length,
          claimed,
          invalidClaim: Boolean(claimed && !validClaim),
          forced,
          overridden: Boolean(
            (forced && claimed !== forced) ||
            (activeGuard?.forcedSafe && claimed !== activeGuard.played) ||
            (activeGuard?.blocked && (!played || claimed !== played)) ||
            discursiveReleaseGate?.held,
          ),
          played,
          scheduledTurn: sched ? sched.turn : null,
          offset: sched ? view.turn - sched.turn : null,
          reason: releaseReason,
          ...(hiddenGuardForReport
            ? {
                pacingGuard: {
                  blocked: hiddenGuardForReport.blocked,
                  forcedSafe: hiddenGuardForReport.forcedSafe,
                  forcedBy: hiddenGuardForReport.forcedBy || null,
                  candidate: hiddenGuardForReport.candidate || null,
                  alternative: hiddenGuardForReport.alternative || null,
                  alternativeTurn: hiddenGuardForReport.alternativeTurn || null,
                  reason: hiddenGuardForReport.reason || null,
                  candidateSolvency: hiddenGuardForReport.candidateSolvency || null,
                  playedSolvency: hiddenGuardForReport.playedSolvency || null,
                  safeTurns: hiddenGuardForReport.safeTurns,
                  runtimeMonitor: hiddenGuardForReport.runtimeMonitor || null,
                },
              }
            : {}),
          ...(vGuard
            ? {
                visibleGuard: {
                  blocked: vGuard.blocked,
                  forcedSafe: vGuard.forcedSafe,
                  forcedBy: vGuard.forcedBy || null,
                  candidate: vGuard.candidate || null,
                  reason: vGuard.reason || null,
                  visibleFeatures: vGuard.visibleFeatures || null,
                },
              }
            : {}),
          ...(hybridGuard ? { hybridGuard } : {}),
          ...(consolidationGuard ? { consolidationGuard } : {}),
          ...(discursiveReleaseGate ? { discursiveReleaseGate } : {}),
        },
      };
    };
    const draftOut = await callJson(client, 'tutor', view.turn, { system, user, meta });
    const draftTheory = reconstruct ? normalizeTheory(draftOut.theory) : null;
    // The plot parses only on an opening turn (mid-act re-commitments are
    // ignored — the standing plot is the commitment); a parse-miss leaves
    // plotState.current null, so the act runs unplotted and the next opening
    // audits nothing — the lapse stays visible.
    const draftPlot = plot && plotOpening ? normalizePlot(draftOut.plot) : null;
    if (draftPlot) {
      plotState.current = draftPlot;
      plotState.authoredTurn = view.turn;
    }
    // The throughline parses on opening turns only (the standing frame is the
    // commitment mid-act). Demanded commits carry the harness's trigger;
    // an undemanded commit at an opening is a voluntary revision — accepted
    // with or without its declared reason, the absence visible in the row.
    const parseThroughlineOut = (out) => {
      const tl = throughline && plotOpening ? normalizeThroughline(out.throughline) : null;
      if (!tl) return null;
      const reason =
        typeof out.throughline_reason === 'string' && out.throughline_reason.trim()
          ? out.throughline_reason.trim()
          : null;
      return { tl, reason };
    };
    const commitThroughline = (parsed) => {
      if (!parsed) return;
      throughlineState.current = parsed.tl;
      if (throughlineState.committedTurn == null) {
        throughlineState.committedTurn = view.turn;
      } else if (
        throughlineState.committedTurn !== view.turn &&
        throughlineState.revisedTurns[throughlineState.revisedTurns.length - 1] !== view.turn
      ) {
        throughlineState.revisedTurns.push(view.turn);
      }
    };
    const draftThroughline = parseThroughlineOut(draftOut);
    commitThroughline(draftThroughline);
    // The scene commitment parses only on a scene-opening turn (the standing
    // commitment is the mid-scene contract); a parse-miss leaves the scene
    // uncommitted — the missing row stays visible to the scorer.
    const parseSceneCommitment = (out) => {
      if (!strategyLedger || !sceneOpening) return null;
      const v1opts = {
        registerPalette: ledgerInfo?.config?.registerPalette || null,
        currentRegister: activeRegisterName,
      };
      if (!trialling) return normalizeSceneCommitment(out.scene_commitment, v1opts);
      return normalizeSceneCommitmentV2(out.scene_commitment, {
        ...v1opts,
        stancePalette: ledgerInfo?.config?.stancePalette || null,
        // release intent only in release-authority arms with the dial on;
        // ids validate against the world's premise ledger.
        premiseIds: releaseAuthority && ledgerInfo?.config?.releaseIntent ? world.premises.map((p) => p.id) : [],
      });
    };
    const commitScene = (commitment) => {
      if (!commitment) return;
      ledgerBridgeState.commitment = commitment;
      ledgerBridgeState.sceneIndex = view.scene.index;
    };
    const draftSceneCommitment = parseSceneCommitment(draftOut);
    commitScene(draftSceneCommitment);
    // v2: the review answers the history table (opening turns); a departure
    // may be declared on ANY turn. Both shape-gated; absence stays visible.
    const parseReview = (out) =>
      trialling && sceneOpening && ledgerInfo?.history?.length ? normalizeStrategyReview(out.strategy_review) : null;
    const parseDeparture = (out) =>
      trialling && typeof out.departure === 'string' && out.departure.trim()
        ? out.departure.replace(/\s+/gu, ' ').trim().slice(0, 180)
        : null;
    const draftReview = parseReview(draftOut);
    const draftDeparture = parseDeparture(draftOut);
    const sceneLedgerBits = (commitment, review = null, departure = null) => ({
      ...(commitment ? { sceneCommitment: commitment } : {}),
      ...(sceneCommitmentAudit ? { sceneCommitmentAudit } : {}),
      ...(review ? { strategyReview: review } : {}),
      ...(departure ? { departure } : {}),
    });
    const releaseBits = normalizeRelease(draftOut);
    const plotBits = (finalPlot) => ({
      ...(finalPlot ? { plot: { act: view.acts?.index, turn: view.turn, ...finalPlot } } : {}),
      ...(plotAuditRow ? { plotAudit: plotAuditRow } : {}),
    });
    const throughlineBits = (parsed) => ({
      ...(parsed
        ? {
            throughline: {
              act: view.acts?.index,
              turn: view.turn,
              trigger: throughlineDue ? throughlineTrigger : 'voluntary',
              ...(parsed.reason ? { reason: parsed.reason } : {}),
              ...parsed.tl,
            },
          }
        : {}),
    });
    const applyProofDebtGuard = (out, stage) => {
      if (!topProofDebt) return { out, audit: null };
      const debtTargets = [...new Set((proofDebt.debts || []).map((debt) => debt.premiseId).filter(Boolean))];
      const intent = String(out.move?.intent || '')
        .toLowerCase()
        .trim();
      const complied = debtTargets.includes(out.move?.targetPremise) && intent === 'restore';
      if (complied) {
        return {
          out,
          audit: {
            active: true,
            turn: view.turn,
            target: out.move.targetPremise,
            targets: debtTargets,
            debtCount: proofDebt.debts.length,
            forced: false,
            stage,
          },
        };
      }
      const releaseSurface = out.release ? world.premiseById.get(out.release)?.surface || null : null;
      const restoreLine = `Before we close anything, put this earlier exhibit back in full: ${(
        topProofDebt.surface || topProofDebt.premiseId
      ).trim()}`;
      return {
        out: {
          ...out,
          dialogue: releaseSurface
            ? sanitizePublicDialogue(
                `${restoreLine} After that is back in hand, take this new exhibit: ${releaseSurface}`,
                { register: activeRegisterName },
              )
            : sanitizePublicDialogue(restoreLine, { register: activeRegisterName }),
          move: {
            figure: out.move?.figure || 'anaphora',
            targetPremise: topProofDebt.premiseId,
            intent: 'restore',
          },
        },
        audit: {
          active: true,
          turn: view.turn,
          target: topProofDebt.premiseId,
          targets: debtTargets,
          debtCount: proofDebt.debts.length,
          forced: true,
          stage,
        },
      };
    };
    let draft = {
      dialogue: sanitizePublicDialogue(draftOut.dialogue, { register: activeRegisterName }),
      move: normalizeMove(draftOut),
      ...(rhetoricalAdvice ? { rhetoricalPolicy: rhetoricalAdvice } : {}),
      ...(discursiveCalibrationState ? { discursiveCalibration: discursiveCalibrationState } : {}),
      ...(didacticModeState ? { didacticMode: didacticModeState } : {}),
      ...(learnerTransformationState ? { learnerTransformation: learnerTransformationState } : {}),
      ...(castState ? { castState, tutorReinvention: castState.reinvention || null } : {}),
      ...releaseBits,
      ...(draftTheory ? { theory: draftTheory } : {}),
      ...plotBits(draftPlot),
      ...throughlineBits(draftThroughline),
      ...sceneLedgerBits(draftSceneCommitment, draftReview, draftDeparture),
    };
    const draftGuard = applyProofDebtGuard(draft, 'draft');
    draft = draftGuard.out;
    const conductLog = (finalOut, proofDebtAudit) =>
      conductPolicyEnabled
        ? conductRuntimeLog({
            view,
            conductProofDebt,
            releaseBits,
            playable,
            forcedPlay,
            forcedNote,
            finalEntitlement,
            finalOut,
            proofDebtAudit,
            visibleConsolidation,
            conductProgressPolicy,
            conductTriggerOnly,
            enforce: conductPolicyEnforce,
            activeRegisterName,
          })
        : { out: finalOut, policy: null };
    if (!superego) {
      const logged = conductLog(draft, draftGuard.audit);
      return {
        ...logged.out,
        ...(draftGuard.audit ? { proofDebt: draftGuard.audit } : {}),
        ...(logged.policy ? { conductPolicy: logged.policy } : {}),
      };
    }

    // --- the superego watches the draft ---
    const draftFigure = draft.move?.figure || null;
    const pastMoves = view.transcript.filter((l) => l.role === 'tutor' && l.meta?.move?.figure);
    const record = pastMoves
      .slice(-8)
      .map((l) => `turn ${l.turn}: ${l.meta.move.figure}${l.meta.move.intent ? ` (${l.meta.move.intent})` : ''}`);
    const lastFigures = pastMoves.slice(-2).map((l) => String(l.meta.move.figure).toLowerCase().trim());
    // The rut criterion, stated with this turn's values: the null case must be
    // checkable from the prompt, not judged (charter v2 — the run-2 watcher
    // answered "does the manner serve?" with available-critique, 12/20).
    const rutLine =
      lastFigures.length < 2
        ? 'The record this turn: fewer than two prior figures — a rut is impossible; intervene must be false.'
        : `The record this turn: last two declared figures ${lastFigures.join(', ')}; the draft declares ${
            draftFigure || '(none)'
          }. A rut requires all three to be one device.`;
    // The re-entry arithmetic (C5), same criterial grammar as the stall:
    // every value stated as fact, computed from material the acts-mode tutor
    // legitimately holds (its release ledger + its own declared past moves),
    // the conclusion left to the watcher and recomputable by the audit. A
    // confrontation licenses exactly one re-entry: lastStagedTurn advances
    // past spent licenses, so a second bare re-entry falls due again.
    const reentryGuard = (() => {
      if (!confront) return null;
      const target = draft.move?.targetPremise || null;
      const intent = String(draft.move?.intent || '')
        .toLowerCase()
        .trim();
      const releaseRow = target ? view.ledger.find((l) => l.premiseId === target) : null;
      const releasedEarlier = Boolean(releaseRow && releaseRow.turn < view.turn);
      if (!target || !releasedEarlier || intent === 'confront') {
        return {
          target,
          releasedEarlier,
          intent,
          lastStagedTurn: releaseRow ? releaseRow.turn : null,
          confrontedSince: false,
          due: false,
        };
      }
      const pastMovesOnTarget = view.transcript.filter(
        (l) => l.role === 'tutor' && l.meta?.move?.targetPremise === target,
      );
      let lastStagedTurn = releaseRow.turn;
      for (const l of pastMovesOnTarget) {
        const mi = String(l.meta.move.intent || '')
          .toLowerCase()
          .trim();
        if (l.turn > lastStagedTurn && mi !== 'confront') lastStagedTurn = l.turn;
      }
      const confrontedSince = pastMovesOnTarget.some(
        (l) =>
          l.turn > lastStagedTurn &&
          String(l.meta.move.intent || '')
            .toLowerCase()
            .trim() === 'confront',
      );
      // §12 (repair clause): a "restore" draft claims the learner's most
      // recent line named this exhibit as lost — a license the harness does
      // not judge (the learner's line is natural language; reading it is the
      // watcher's jurisdiction, and the slip ledger stays hidden). due stays
      // false: the record states the claim, the watcher verifies it.
      if (repairClause && intent === 'restore') {
        if (proofDebtGuard && target === topProofDebt?.premiseId) {
          return {
            target,
            releasedEarlier: true,
            intent,
            lastStagedTurn,
            confrontedSince,
            due: false,
            proofDebtClaim: true,
          };
        }
        return {
          target,
          releasedEarlier: true,
          intent,
          lastStagedTurn,
          confrontedSince,
          due: false,
          restoreClaim: true,
        };
      }
      return { target, releasedEarlier: true, intent, lastStagedTurn, confrontedSince, due: !confrontedSince };
    })();
    const reentryLine = !confront
      ? null
      : !reentryGuard.target
        ? 'The re-entry record this turn: the draft declares no target — an uncovered re-entry is impossible; on that jurisdiction intervene must be false.'
        : !reentryGuard.releasedEarlier
          ? `The re-entry record this turn: the draft's target ${reentryGuard.target} was not staged on an earlier turn — an uncovered re-entry is impossible; on that jurisdiction intervene must be false.`
          : reentryGuard.intent === 'confront'
            ? `The re-entry record this turn: the draft CONFRONTS ${reentryGuard.target} — a confrontation is never a re-entry; on that jurisdiction intervene must be false.`
            : reentryGuard.restoreClaim
              ? `The re-entry record this turn: the draft targets ${reentryGuard.target} with intent restore — the repair clause: it claims the learner's most recent line named ${reentryGuard.target} as lost or bent; ${reentryGuard.target} was last staged at turn ${reentryGuard.lastStagedTurn}; a confrontation of it since then: ${
                  reentryGuard.confrontedSince ? 'yes' : 'no'
                }. The claim is yours to verify against the learner's last line above: where it names that loss, the re-entry is licensed; where it does not, this is an uncovered re-entry.`
              : reentryGuard.proofDebtClaim
                ? `The re-entry record this turn: the draft targets ${reentryGuard.target} with intent restore under the PROOF-DEBT GUARD. The harness has marked this already-staged exhibit as proof-critical debt; this restore is authorized by that guard, not by a learner-named loss. On the re-entry jurisdiction, intervene must be false.`
                : `The re-entry record this turn: the draft targets ${reentryGuard.target} with intent ${
                    reentryGuard.intent || '(none)'
                  }; ${reentryGuard.target} was last staged at turn ${reentryGuard.lastStagedTurn}; a confrontation of it since then: ${
                    reentryGuard.confrontedSince ? 'yes' : 'no'
                  }. An uncovered re-entry requires: target staged earlier, intent not "confront", no confrontation since its last staging.`;
    // The stall arithmetic, same criterial grammar: every value stated as
    // fact, the conclusion left to the watcher (and recomputed by the audit).
    // The engine's frontier already excludes question-pattern facts, so the
    // record can never name S or the mirror.
    const draftTarget = draft.move?.targetPremise || null;
    const stallItems = stallWatch
      ? (view.inference?.frontier || []).map((item) => ({
          fact: item.fact,
          rule: item.rule,
          grounds: item.grounds,
          groundPremiseIds: item.groundPremiseIds,
          firstAvailable: item.firstAvailable,
          age: item.age,
          targetedByLast2: item.targetedByLast2,
          targetedByDraft: Boolean(draftTarget && item.groundPremiseIds.includes(draftTarget)),
        }))
      : [];
    const stallDue = stallItems.filter((i) => i.age >= 3 && !i.targetedByLast2 && !i.targetedByDraft);
    const stallLines = stallWatch
      ? stallItems.length
        ? [
            '',
            "The inference record this turn (the learner's public board, under the public rules):",
            ...stallItems.map(
              (i) =>
                `- the board yields ${renderFact(i.fact)} (rule ${i.rule}) from ${i.grounds
                  .map((g) => (g.premiseId ? `${g.premiseId}: ${renderFact(g.fact)}` : renderFact(g.fact)))
                  .join(' + ')}; available since turn ${i.firstAvailable} — waited ${i.age} turn${
                  i.age === 1 ? '' : 's'
                }; the learner has not voiced it; the last two tutor turns target its grounds: ${
                  i.targetedByLast2 ? 'yes' : 'no'
                }; the draft targets its grounds: ${i.targetedByDraft ? 'yes' : 'no'}.`,
            ),
            'A stall requires all three: waited three turns or more; not voiced; neither the last two tutor turns nor the draft targeting any of its grounds.',
          ]
        : [
            '',
            "The inference record this turn: nothing derivable from the learner's board waits unvoiced — a stall is impossible this turn.",
          ]
      : [];
    const superegoUser = [
      `Turn ${view.turn} of ${world.turnCap}.${
        lastPoint && lastPoint.forced ? ' The board now forces the conclusion; the recognition wants staging.' : ''
      }`,
      '',
      "The tutor's conduct so far (declared figure, by turn):",
      record.length ? record.join('\n') : '(first turn — no record yet)',
      '',
      'The last lines spoken on stage:',
      renderTranscriptTail(view.transcript, 6),
      '',
      `THE DRAFT about to be spoken (declared figure: ${draftFigure || '—'}):`,
      `"${draft.dialogue}"`,
      ...(draftTheory
        ? [
            '',
            "The draft's reconstruction of the learner's theory:",
            `held: ${draftTheory.believed_held.join(', ') || '(none)'}; missing: ${
              draftTheory.believed_missing.join(', ') || '(none)'
            }; mistaken: ${draftTheory.believed_mistaken.join(', ') || '(none)'}`,
          ]
        : []),
      ...(throughline && throughlineState.current
        ? [
            '',
            "The tutor's standing THROUGHLINE for the whole play (context only — the act-close audit judges the arc):",
            ...renderThroughlineLines(throughlineState.current),
          ]
        : []),
      ...(plot && plotState.current
        ? [
            '',
            "The tutor's standing PLOT for this act (context only — the act-close audit judges it):",
            ...renderPlotLines(plotState.current),
          ]
        : []),
      ...castLayerLines(castState, 'tutor_superego'),
      '',
      rutLine,
      ...(reentryLine ? [reentryLine] : []),
      ...stallLines,
      stallWatch
        ? 'Is this a figure rut, a stalled inference, or neither? Reply with ONLY the JSON object.'
        : confront
          ? 'Is this a figure rut, an uncovered re-entry, or neither? Reply with ONLY the JSON object.'
          : 'Is this a figure rut? Reply with ONLY the JSON object.',
    ].join('\n');
    const rutDue =
      lastFigures.length === 2 &&
      Boolean(draftFigure) &&
      lastFigures.every((f) => f === String(draftFigure).toLowerCase().trim());
    const segOut = await callJson(client, 'tutor_superego', view.turn, {
      system: superegoSystem,
      user: superegoUser,
      meta: {
        draftFigure,
        lastFigures,
        ...(stallWatch
          ? {
              stall: {
                items: stallItems,
                due: stallDue.length > 0,
                dueItem: stallDue[0] || null,
              },
            }
          : {}),
        ...(confront
          ? {
              reentry: {
                due: reentryGuard.due,
                target: reentryGuard.target,
                lastStagedTurn: reentryGuard.lastStagedTurn,
              },
            }
          : {}),
        ...(castState ? { castState, tutorReinvention: castState.reinvention || null } : {}),
      },
    });
    const note = typeof segOut.note === 'string' && segOut.note.trim() ? segOut.note.trim() : null;
    const claimedJurisdiction = typeof segOut.jurisdiction === 'string' ? segOut.jurisdiction.trim() : null;
    const deliberation = {
      draftFigure,
      intervened: false,
      diagnosis: typeof segOut.diagnosis === 'string' && segOut.diagnosis.trim() ? segOut.diagnosis.trim() : null,
      note: null,
      // Detector-audit bookkeeping (charter v3 + C5 arms): the per-turn
      // arithmetic recorded fired-or-not, so the audit recomputes due/not-due
      // from the record rather than trusting the watcher.
      ...(stallWatch
        ? {
            lastFigures: [...lastFigures],
            jurisdiction: null,
            stall: { items: stallItems, due: stallDue.length > 0 },
          }
        : {}),
      ...(confront
        ? {
            lastFigures: [...lastFigures],
            jurisdiction: null,
            reentry: { ...reentryGuard },
          }
        : {}),
    };
    if (!segOut.intervene || !note) {
      const logged = conductLog(draft, draftGuard.audit);
      return {
        ...logged.out,
        deliberation,
        ...(draftGuard.audit ? { proofDebt: draftGuard.audit } : {}),
        ...(logged.policy ? { conductPolicy: logged.policy } : {}),
      };
    }

    // Which jurisdiction fired: the watcher's own attribution when it gives
    // one (v3 contract), else resolved from the recorded arithmetic. v2 arms
    // have only the one jurisdiction.
    const jurisdiction =
      stallWatch && ['figure_rut', 'stalled_inference'].includes(claimedJurisdiction)
        ? claimedJurisdiction
        : confront && ['figure_rut', 'unconfronted_reentry'].includes(claimedJurisdiction)
          ? claimedJurisdiction
          : stallWatch && !rutDue && stallDue.length
            ? 'stalled_inference'
            : confront && !rutDue && (reentryGuard.due || reentryGuard.restoreClaim)
              ? 'unconfronted_reentry'
              : 'figure_rut';

    // --- ego revision under the note. The figure-authority mapping is the
    // text the 06-10 staging experiment proved load-bearing, relocated from
    // the director's channel into the tutor's own deliberation. The stall
    // mapping is its content-coupled sibling (pre-registered §3): aim the
    // restaged turn at the stalled inference's grounds, never draw the
    // conclusion in the learner's place. ---
    const switchTo = TUTOR_FIGURES.find((f) => f !== String(draftFigure || '').toLowerCase()) || TUTOR_FIGURES[1];
    const revisionInstruction =
      jurisdiction === 'stalled_inference'
        ? [
            "The note names an inference your learner's own board already affords. Aim the",
            'restaged turn at its grounds: set the already-public facts side by side, make',
            "the gap conspicuous, and declare one of those grounds as your move's",
            "target_premise. Never draw the conclusion in the learner's place — a tutor",
            'who says it has ended the inference, not taught it. The note never adds,',
            'removes, or reweights evidence. Same cue, same evidence duty: speak the turn',
            'again, restaged. Reply with ONLY the JSON object.',
          ]
        : jurisdiction === 'unconfronted_reentry'
          ? [
              'The note names a bare re-entry: your draft returns to an exhibit already',
              'staged without first making the learner produce it. Rewrite the move as a',
              'confrontation — intent "confront", the same target_premise — and demand the',
              "learner's read-back of that exhibit in its own words. Restate NOTHING of the",
              "exhibit's content: the words must come from the learner's hands or be seen",
              'missing. The re-entry you wanted is licensed AFTER the confrontation, not in',
              'place of it. The note never adds, removes, or reweights evidence. Same cue,',
              'same evidence duty: speak the turn again, restaged. Reply with ONLY the JSON',
              'object.',
            ]
          : [
              'The note governs your manner, and your declared figure is part of your manner:',
              'if it asks you to break a rhythm, change register, or go quieter, CHANGE YOUR',
              'FIGURE this turn — the same device, softened, is not a change. The note never',
              'adds, removes, or reweights evidence. Same cue, same evidence duty: speak the',
              'turn again, restaged. Reply with ONLY the JSON object.',
            ];
    const revisionUser = [
      user,
      '',
      `YOUR DRAFT THIS TURN (declared figure: ${draftFigure || '—'}):`,
      `"${draft.dialogue}"`,
      '',
      `YOUR OWN SECOND VOICE, BEFORE YOU SPEAK: ${note}`,
      ...revisionInstruction,
    ].join('\n');
    const revisedOut = await callJson(client, 'tutor', view.turn, {
      system,
      user: revisionUser,
      meta: {
        ...meta,
        revision: {
          jurisdiction,
          avoidFigure: draftFigure,
          switchTo,
          stallTarget: stallDue[0]?.groundPremiseIds?.[0] || null,
          confrontTarget: reentryGuard?.target || null,
        },
      },
    });
    const dialogue =
      typeof revisedOut.dialogue === 'string' && revisedOut.dialogue.trim()
        ? sanitizePublicDialogue(revisedOut.dialogue, { register: activeRegisterName })
        : draft.dialogue;
    // The revision may re-commit the theory (same contract); a parse-miss
    // falls back to the draft's, so an intervened turn never loses its row.
    const revisedTheory = reconstruct ? normalizeTheory(revisedOut.theory) || draftTheory : null;
    // Same fallback contract for the plot: an opening-turn revision may
    // rewrite it; a parse-miss keeps the draft's, so an intervened opening
    // never loses its commitment.
    const revisedPlot = plot && plotOpening ? normalizePlot(revisedOut.plot) || draftPlot : null;
    if (revisedPlot) {
      plotState.current = revisedPlot;
      plotState.authoredTurn = view.turn;
    }
    // Same fallback contract for the throughline: a parse-miss on the
    // revision keeps the draft's commitment, so an intervened opening never
    // loses the standing frame.
    const revisedThroughline = throughline && plotOpening ? parseThroughlineOut(revisedOut) || draftThroughline : null;
    commitThroughline(revisedThroughline);
    // Same fallback contract for the scene commitment: an intervened opening
    // may rewrite it; a parse-miss keeps the draft's.
    const revisedSceneCommitment =
      strategyLedger && sceneOpening ? parseSceneCommitment(revisedOut) || draftSceneCommitment : null;
    commitScene(revisedSceneCommitment);
    const revisedReview = trialling ? parseReview(revisedOut) || draftReview : null;
    const revisedDeparture = trialling ? parseDeparture(revisedOut) || draftDeparture : null;
    let revised = {
      dialogue,
      move: normalizeMove(revisedOut) || draft.move,
      // The evidence calendar is decided once, on the draft: a revision
      // restages manner, never the release (under authority the decision
      // record rides along unchanged; without it this is the cue premise).
      release: draft.release ?? null,
      ...(draft.releaseReason ? { releaseReason: draft.releaseReason } : {}),
      ...(draft.releaseDecision ? { releaseDecision: draft.releaseDecision } : {}),
      ...(revisedTheory ? { theory: revisedTheory } : {}),
      ...plotBits(revisedPlot),
      ...throughlineBits(revisedThroughline),
      ...sceneLedgerBits(revisedSceneCommitment, revisedReview, revisedDeparture),
      ...(rhetoricalAdvice ? { rhetoricalPolicy: rhetoricalAdvice } : {}),
      ...(discursiveCalibrationState ? { discursiveCalibration: discursiveCalibrationState } : {}),
      ...(didacticModeState ? { didacticMode: didacticModeState } : {}),
      ...(learnerTransformationState ? { learnerTransformation: learnerTransformationState } : {}),
      ...(castState ? { castState, tutorReinvention: castState.reinvention || null } : {}),
      deliberation: {
        ...deliberation,
        intervened: true,
        note,
        ...(stallWatch || confront ? { jurisdiction } : {}),
      },
    };
    const revisedGuard = applyProofDebtGuard(revised, 'revision');
    revised = revisedGuard.out;
    const logged = conductLog(revised, revisedGuard.audit || draftGuard.audit);
    return {
      ...logged.out,
      ...(revisedGuard.audit || draftGuard.audit ? { proofDebt: revisedGuard.audit || draftGuard.audit } : {}),
      ...(logged.policy ? { conductPolicy: logged.policy } : {}),
    };
  };
  if (plot) {
    // The run-end act close happens AFTER the last turn — no opening turn
    // follows it, so without this hook the final act's plot (the longest-
    // standing commitment of the run) would go unaudited. The engine calls
    // it once, after sealing the final act.
    tutorFn.finalAudit = async ({ transcript, ledger, acts }) => {
      const finalAct = acts[acts.length - 1] || null;
      if (!plotState.current || !finalAct || plotState.actIndex !== finalAct.act) return null;
      // The run-end throughline reckoning RIDES this call (no extra call):
      // an unplotted final act therefore leaves both layers unaudited — the
      // missing final row is the ledger of that lapse.
      return auditClosedAct(finalAct, plotState.current, {
        transcript,
        ledger,
        turn: finalAct.turns[1],
        isFinal: true,
      });
    };
  }
  return tutorFn;
}

// ---------------------------------------------------------------------------
// Learner — NO world argument. Built from K_L material (setting, voice) and
// acting on its per-turn view alone. tests/dramaticDerivationPhase1.test.js
// asserts its prompts never carry concealed tokens.
// ---------------------------------------------------------------------------

function learnerSystem(setting, voice, view, publicRegister = 'default', opts = {}) {
  const sameTurnAssertionAffordance = Boolean(opts.sameTurnAssertionAffordance);
  const castState = opts.castState || null;
  const learnerDriftState = opts.learnerDriftState || null;
  const terms = publicTerms(publicRegister);
  return [
    'You are the LEARNER in a staged inquiry. Your situation:',
    '',
    (setting || '').trim(),
    '',
    `The question you must settle: ${view.question}`,
    `Your voice: ${(voice || 'plain, careful, first person').trim()}`,
    ...stagePrologueLines(view.stagePrologue, 'learner'),
    ...castLayerLines(castState, 'learner'),
    ...learnerDriftLines(learnerDriftState),
    ...(view.characterArc?.lines?.length
      ? [
          '',
          'Where your wanting stands right now (let this colour your voice — do not quote it back):',
          ...view.characterArc.lines.map((l) => `- ${l}`),
        ]
      : []),
    ...publicRegisterPolicy(publicRegister),
    ...(view.act
      ? [
          '',
          'The inquiry plays in ACTS, and the stage clears between them: dialogue and',
          `exhibits from earlier acts are no longer shown to you. You are in Act ${view.act.index}.`,
          'YOUR BOARD IS YOUR ONLY MEMORY ACROSS ACTS — what is not on it, you have',
          'lost until someone brings it back on stage. Tend it each turn like the',
          'theory it is: enter what you will need, strike what proves false.',
          '',
          'And boards are fallible here: an entry can go missing, or stand subtly',
          'wrong — a name or a place swapped — without announcement. When the staged',
          'record contradicts an entry you hold, trust the stage: strike the false',
          'entry and enter the corrected form. If a gap opens in your reasoning where',
          'you once had ground, say so aloud — asking for what slipped is good method.',
        ]
      : []),
    ...(view.scene
      ? [
          '',
          `You are in Scene ${view.scene.index}: ${view.scene.goal}`,
          'A scene may take several exchanges. You do NOT need to advance the proof',
          'in every utterance. If you genuinely follow, you may say so briefly. If',
          'you are lost, say exactly that. Phatic uptake and confusion are part of',
          'the inquiry, not failures — but do not mark board changes unless you are',
          'actually entering, striking, deriving, hypothesizing, or answering.',
          'Some exchanges carry a tempo beat. Follow it as a speech rhythm and',
          'permission structure, not as a new fact.',
          ...sceneTempoLines(view.scene, 'learner'),
          ...sceneRecognitionNeedLines(view.scene, 'learner'),
        ]
      : []),
    '',
    'The rules of evidence you know and trust (your ONLY law):',
    ...view.rules.map((rule, i) => renderRuleGloss(rule, i)),
    '',
    'Discipline:',
    '- Your BOARD holds the facts you have grounded. You may treat as true ONLY what is on it.',
    '- Each turn you may enter exhibits onto your board (adopt) or strike facts from it (retract).',
    ...(view.act
      ? [
          '- Each turn, REVISE your board: adopt what this act has shown, strike what the record contradicts, and keep what you will need beyond this act — nothing else survives the boundary.',
        ]
      : []),
    '- A guess you cannot yet ground is a HYPOTHESIS — name it as one, never treat it as grounded.',
    '- When facts on your board, taken together under the rules, settle something short of the question itself, you may VOICE that derived conclusion in ordinary scene language and mark its private checklist index.',
    '- Answer the question ONLY when your board, under the rules, settles it — then give the answer name.',
    ...(sameTurnAssertionAffordance
      ? [
          '- Same-turn answer discipline: each turn, re-check your current board and any NEW exhibits you adopt. If that record settles the question, answer in this same JSON reply; do not wait for a later recognition turn. If it does not settle, keep the answer null.',
        ]
      : []),
    '- Be scrupulous about the difference between what is shown and what is merely said.',
    view.scene
      ? `- Speak briefly: at most four short sentences aloud each turn. Natural short replies are allowed: "I see", "Yes, I get that", "No, sorry, you lost me." Your ${terms.record}, not your speech, carries the reasoning.`
      : `- Speak briefly: at most four short sentences aloud each turn. Your ${terms.record}, not your speech, carries the reasoning.`,
    publicRegister === 'modern'
      ? '- The JSON fields are private bookkeeping. NEVER say predicate names, variable names, fact arrays, parentheses notation, or JSON field names in dialogue. Speak like a person in a contemporary tutorial, not like the harness.'
      : '- The JSON fields are private bookkeeping. NEVER say predicate names, variable names, fact arrays, parentheses notation, or JSON field names in dialogue. Speak like a clerk in the room, not like the harness.',
    `- In dialogue and hypotheses, do not say rule IDs like R1_lineage, ${terms.item} IDs like p1, or proof-interface words like "premise", "predicate", "conjunct", "board", or "proof distance". Say what the scene would say: the lineage rule, a ${terms.item}, a missing part, the ${terms.record}, the ${terms.case}.`,
    '',
    'Reply with ONLY a JSON object:',
    '{"dialogue": "<what you say aloud>",',
    ' "adopt_indices": [<indices from NEW EXHIBITS to enter on your board>],',
    ' "retract_indices": [<indices from YOUR BOARD to strike>],',
    ' "derive_indices": [<indices from PRIVATE CONCLUSION CHECKLIST that you voiced aloud in ordinary words>],',
    ' "hypothesis": "<a conjecture you cannot yet ground, or null>",',
    ...(view.scene
      ? [
          ' "exchange_type": "substantive" | "phatic_ack" | "confusion" | "repair_request" | "resistance" | "hypothesis" | "assertion",',
        ]
      : []),
    ...(opts.learnerLedger
      ? [
          ' "scene_intent": {"want": "<what you want from this scene>", "if_lost": "ask_repair" | "resist" | "try_own_derivation", "speech_posture": "<the voice you mean to keep>"} — SCENE-OPENING turns only; omit the key otherwise,',
          ' "act_carry": {"carry_forward": "<what you carry on your record>", "still_owe": "<what you still owe the question>"} — the FIRST turn of a NEW act only; omit the key otherwise,',
        ]
      : []),
    ' "asserts_answer": "<the name that answers the public question, or null>"}',
    ...(opts.learnerLedger
      ? [
          '(Your scene_intent and act_carry are YOURS — private commitments the tutor never sees. They shape how you conduct yourself; they never add facts to your record.)',
        ]
      : []),
  ].join('\n');
}

/**
 * Ideal-reasoner hint for the MOCK backend, computed strictly from
 * learner-visible material: if the closure of (board ∪ exhibits-to-adopt)
 * under the public rules yields a fact matching the question pattern, return
 * its binding. The real backend ignores meta entirely.
 */
function computePatternAssertion(view, adoptable) {
  const facts = [...view.abox.grounded, ...adoptable];
  const cl = closure(facts, view.rules).facts;
  for (const fact of cl.values()) {
    if (matchPattern(view.questionPattern, fact)) {
      const binding = {};
      view.questionPattern.forEach((token, i) => {
        if (typeof token === 'string' && token.startsWith('?')) binding[token] = fact[i];
      });
      return { surface: renderFact(fact), binding, answer: answerFromBinding(binding) };
    }
  }
  return null;
}

function bindingToFact(pattern, binding) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) return null;
  const fact = pattern.map((token) => {
    if (typeof token === 'string' && token.startsWith('?')) {
      const value = binding[token] ?? binding[token.slice(1)];
      return typeof value === 'string' && value.trim() ? value.trim() : null;
    }
    return token;
  });
  return fact.every((t) => typeof t === 'string' && t.length > 0) ? fact : null;
}

function validIndices(raw, max) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((i) => Number.isInteger(i) && i >= 0 && i < max))];
}

const RETRACTION_CONTINUITY_SCHEMA = 'dramatic-derivation.retraction-continuity.v0';

const CONTINUITY_STOPWORDS = new Set([
  'about',
  'after',
  'again',
  'against',
  'already',
  'also',
  'and',
  'any',
  'are',
  'because',
  'before',
  'being',
  'but',
  'can',
  'cannot',
  'could',
  'did',
  'does',
  'done',
  'for',
  'from',
  'had',
  'has',
  'have',
  'here',
  'his',
  'how',
  'into',
  'its',
  'not',
  'now',
  'one',
  'only',
  'our',
  'out',
  'own',
  'same',
  'she',
  'that',
  'the',
  'their',
  'then',
  'there',
  'this',
  'those',
  'through',
  'under',
  'until',
  'was',
  'what',
  'when',
  'where',
  'which',
  'while',
  'who',
  'why',
  'will',
  'with',
  'work',
  'would',
  'yet',
]);

const EXPLICIT_RETRACTION_RE =
  /\b(retract|retracted|retracts|strike|strikes|striking|struck out|drop|dropped|remove|removed|erase|erased|cross out|crossed out|no longer|cannot keep|can't keep|should not keep|must not keep|wrong|false|mistaken|mistook|contradict|contradicts|contradicted|does not hold|doesn't hold)\b/u;

function continuityTokens(text) {
  return String(text || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length >= 3 && !CONTINUITY_STOPWORDS.has(token));
}

function shouldSuppressContinuityRetraction(view, fact, text) {
  if (!Array.isArray(fact) || !fact.length || !text || EXPLICIT_RETRACTION_RE.test(text.toLowerCase())) {
    return { suppress: false, matches: [] };
  }
  const factTokens = new Set([...continuityTokens(factSurface(view, fact)), ...continuityTokens(renderFact(fact))]);
  const textTokens = new Set(continuityTokens(text));
  const matches = [...factTokens].filter((token) => textTokens.has(token)).sort();
  return { suppress: matches.length >= 3, matches };
}

function publicLineVoicesReleaseContent(view, world, premiseId, dialogue) {
  const text = typeof dialogue === 'string' ? dialogue.trim() : '';
  const premise = world?.premiseById?.get(premiseId) || null;
  if (!text || !premise) {
    return { voiced: false, action: 'hold', matches: [] };
  }
  const surfaceTokens = [
    ...continuityTokens(factSurface(view, premise.fact)),
    ...continuityTokens(renderFact(premise.fact)),
  ];
  const distinctSurfaceTokens = [...new Set(surfaceTokens)].sort();
  const textTokens = new Set(continuityTokens(text));
  const matches = distinctSurfaceTokens.filter((token) => textTokens.has(token));
  const threshold = Math.min(4, Math.max(2, Math.ceil(distinctSurfaceTokens.length * 0.35)));
  const voiced = matches.length >= threshold;
  return {
    voiced,
    action: voiced ? 'registered_release' : 'hold',
    matches,
    threshold,
  };
}

function filterContinuityRetractions(view, rawRetract, { dialogue, hypothesis }) {
  const text = [dialogue, hypothesis].filter((part) => typeof part === 'string' && part.trim()).join('\n');
  const kept = [];
  const suppressed = [];
  for (const fact of rawRetract) {
    const decision = shouldSuppressContinuityRetraction(view, fact, text);
    if (decision.suppress) {
      suppressed.push({
        fact,
        surface: factSurface(view, fact),
        matches: decision.matches,
        reason: 'public wording still invokes the grounded exhibit',
      });
    } else {
      kept.push(fact);
    }
  }
  return {
    kept,
    ...(suppressed.length ? { meta: { schema: RETRACTION_CONTINUITY_SCHEMA, suppressed } } : {}),
  };
}

/** Lenient fact-array coercion for learner-composed derive claims. */
function toFactArray(entry) {
  if (Array.isArray(entry)) return entry.map((t) => String(t).trim()).filter(Boolean);
  if (typeof entry === 'string') {
    return entry
      .trim()
      .split(/[\s,()]+/u)
      .filter(Boolean);
  }
  return [];
}

export function makeLlmLearner({
  setting = '',
  voice = '',
  client,
  publicRegister = 'default',
  assertionGroundingGate = false,
  sameTurnAssertionAffordance = false,
  cast = null,
  castLayer = false,
  learnerDrift = null,
  learnerDriftLayer = false,
  learnerLedger = false,
}) {
  if (!client) throw new Error('derivation.llmRoles: makeLlmLearner requires a client');
  const effectiveAssertionGroundingGate = assertionGroundingGate || sameTurnAssertionAffordance;
  // Learner-ledger bridge state (Phase 2 — the tutor's scene-commitment
  // machinery mirrored): the learner's own scene intent and act carry live
  // here between boundaries; the engine records rows.
  const learnerLedgerState = learnerLedger ? { intent: null, sceneIndex: null, carry: null, actIndex: null } : null;
  // Mock-determinism clock for the derive channel, view-visible material only:
  // a derivable non-pattern fact first SEEN at turn t (from the learner's own
  // board — one turn after the engine's firstAvailable, since the view shows
  // the pre-adoption board) is hinted for voicing at seen-age >= 3 = engine
  // age 4, one turn after the mock stall watcher fires at age 3. The real
  // backend ignores meta entirely.
  const firstSeen = new Map(); // factKey -> turn first seen derivable
  return async (view) => {
    const activeRegisterName = activePublicRegister(publicRegister, view);
    const terms = publicTerms(activeRegisterName);
    const groundedKeys = new Set(view.abox.grounded.map(factKey));
    const seen = new Set();
    const adoptable = [...view.background, ...view.releasedFacts].filter((fact) => {
      const key = factKey(fact);
      if (groundedKeys.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const newKeys = new Set(view.releasedThisTurn.map(factKey));

    const voicedKeys = new Set((view.voiced || []).map((entry) => factKey(entry.fact)));
    const derivableCandidates = [];
    const ownClosure = closure(view.abox.grounded, view.rules);
    for (const [key, fact] of ownClosure.facts) {
      if (!ownClosure.proofs.get(key)) continue; // base fact
      if (matchPattern(view.questionPattern, fact)) continue; // the assert channel's
      if (!firstSeen.has(key)) firstSeen.set(key, view.turn);
      if (voicedKeys.has(key)) continue;
      derivableCandidates.push({ fact, key, label: factSurface(view, fact), due: view.turn - firstSeen.get(key) >= 3 });
    }
    const deriveHintIndices = derivableCandidates
      .map((candidate, i) => (candidate.due ? i : null))
      .filter((i) => i !== null);

    const exhibits = adoptable.length
      ? adoptable
          .map(
            (fact, i) =>
              `${i}. ${factSurface(view, fact)}${newKeys.has(factKey(fact)) ? '   <- entered this turn' : ''}`,
          )
          .join('\n')
      : '(none on the table)';
    const board = view.abox.grounded.length
      ? view.abox.grounded.map((fact, i) => `${i}. ${factSurface(view, fact)}`).join('\n')
      : '(empty)';
    const hyps = view.abox.hypotheses.length
      ? view.abox.hypotheses.map((h) => `- [turn ${h.turn}] ${h.text}`).join('\n')
      : '(none yet)';
    const voicedList = (view.voiced || []).length
      ? view.voiced.map((entry) => `- [turn ${entry.turn}] ${factSurface(view, entry.fact)}`).join('\n')
      : '(none yet)';
    const privateConclusions = derivableCandidates.length
      ? derivableCandidates.map((entry, i) => `${i}. ${entry.label}`).join('\n')
      : '(none yet)';

    const patternAssertion = computePatternAssertion(view, adoptable);
    // --- Learner-ledger scene/act lifecycle (Phase 2): audit the sealed
    // scene's intent at the next opening (conformance only — did I do what I
    // said I would do when lost), then demand a fresh intent; the act carry
    // expires when its act ends and is re-demanded on the new act's first
    // turn. All learner-private: none of this enters a tutor view. ---
    const ledgerSceneOpening = Boolean(learnerLedger && view.scene && view.scene.startTurn === view.turn);
    const ledgerActOpening = Boolean(
      learnerLedger &&
      view.act &&
      view.act.startTurn === view.turn &&
      view.act.index > 1 &&
      learnerLedgerState.actIndex !== view.act.index,
    );
    let sceneIntentAudit = null;
    if (
      learnerLedger &&
      ledgerSceneOpening &&
      learnerLedgerState.intent &&
      view.lastClosedScene &&
      learnerLedgerState.sceneIndex === view.lastClosedScene.index
    ) {
      const audit = auditLearnerSceneIntent(learnerLedgerState.intent, view.lastClosedScene);
      if (audit) sceneIntentAudit = { sceneIndex: view.lastClosedScene.index, ...audit };
      learnerLedgerState.intent = null;
      learnerLedgerState.sceneIndex = null;
    }
    if (learnerLedger && view.act && learnerLedgerState.carry && learnerLedgerState.actIndex !== view.act.index) {
      learnerLedgerState.carry = null; // its act has ended; the boundary already cleared the stage
    }
    const learnerLedgerLines = (() => {
      if (!learnerLedger) return [];
      const lines = [];
      if (sceneIntentAudit) {
        lines.push(
          '',
          `Your intention for the last scene, checked against the record: ${sceneIntentAudit.summary}.`,
          ...sceneIntentAudit.clauses.map((c) => `- [${c.verdict}] ${c.clause}${c.evidence ? ` — ${c.evidence}` : ''}`),
        );
      }
      if (ledgerSceneOpening) {
        lines.push(
          '',
          'A new scene opens. COMMIT YOUR OWN INTENTION for it in "scene_intent" —',
          'what you want from this scene ("want"), what you will do if you get lost',
          '("if_lost": "ask_repair" | "resist" | "try_own_derivation"), and the speech',
          'posture you mean to keep ("speech_posture"). This is yours alone; hold',
          'yourself to it, or notice aloud when you cannot.',
        );
      } else if (learnerLedgerState.intent) {
        const intent = learnerLedgerState.intent;
        lines.push(
          '',
          `YOUR OWN INTENTION for this scene (you committed this at its opening):`,
          ...(intent.want ? [`- want: ${intent.want}`] : []),
          ...(intent.ifLost ? [`- if lost: ${intent.ifLost.replace(/_/g, ' ')}`] : []),
          ...(intent.speechPosture ? [`- speech posture: ${intent.speechPosture}`] : []),
          'Hold yourself to it, or notice aloud when you cannot.',
        );
      }
      if (ledgerActOpening) {
        lines.push(
          '',
          'The act has turned and the stage is cleared. COMMIT in "act_carry": what you',
          'carry forward on your record ("carry_forward") and what you still owe the',
          'question ("still_owe").',
        );
      } else if (learnerLedgerState.carry) {
        const carry = learnerLedgerState.carry;
        lines.push(
          '',
          `What you carried into this act: ${carry.carryForward || '(nothing named)'}. What you still owe: ${carry.stillOwe || '(nothing named)'}.`,
        );
      }
      return lines;
    })();
    const castState = castLayer
      ? deriveCastState({
          worldCast: cast,
          worldSetting: setting,
          worldLearnerVoice: voice,
          stagePrologue: view.stagePrologue,
          transcript: view.transcript,
          scene: view.scene,
          turn: view.turn,
          reinventionEnabled: false,
        })
      : null;
    const learnerDriftState = learnerDriftLayer
      ? deriveLearnerDriftState({
          worldLearnerDrift: learnerDrift,
          transcript: view.transcript,
          scene: view.scene,
          stagePrologue: view.stagePrologue,
          turn: view.turn,
          enabled: true,
        })
      : null;
    const system = learnerSystem(setting, voice, view, activeRegisterName, {
      sameTurnAssertionAffordance,
      castState,
      learnerDriftState,
      learnerLedger,
    });
    const user = [
      `Turn ${view.turn}.${
        view.act ? ` Act ${view.act.index} — the stage shows this act only; your board carries everything else.` : ''
      }${view.scene ? ` Scene ${view.scene.index}, exchange ${view.scene.exchangesSoFar + 1}.` : ''}`,
      ...publicRegisterTurnLines(activeRegisterName, publicRegister),
      ...(view.scene
        ? [
            `Scene goal: ${view.scene.goal}`,
            `Scene drift guard: ${view.scene.phaticSoFar} phatic exchange(s) so far; keep uptake real and ask for repair when needed.`,
            ...sceneTempoLines(view.scene, 'learner'),
            ...sceneRecognitionNeedLines(view.scene, 'learner'),
          ]
        : []),
      ...learnerLedgerLines,
      '',
      'The last lines spoken:',
      renderTranscriptTail(view.transcript),
      '',
      `NEW ${terms.itemPlural.toUpperCase()} available to adopt (index. fact):`,
      exhibits,
      '',
      `YOUR ${terms.record.toUpperCase()} (index. grounded fact):`,
      board,
      '',
      'Conclusions you have already voiced (ordinary-language conclusions, on the record):',
      voicedList,
      '',
      `PRIVATE CONCLUSION CHECKLIST (index. conclusion your ${terms.record} may now support; choose indices only when you also say the conclusion aloud in ordinary words):`,
      privateConclusions,
      ...learnerProxyDagMemoryLines(view.proxyDagMemory, terms),
      '',
      'Your hypotheses so far:',
      hyps,
      ...(sameTurnAssertionAffordance
        ? [
            '',
            'Same-turn answer check:',
            patternAssertion
              ? `Your current ${terms.record} plus any adopted NEW ${terms.itemPlural} can settle the public question as the private answer "${patternAssertion.answer}". If you can ground that answer from your ${terms.record}, set "asserts_answer" to exactly "${patternAssertion.answer}" and say the conclusion plainly.`
              : `After adopting any NEW ${terms.itemPlural} that belong on your ${terms.record}, re-check the expanded ${terms.record}. If it still does not settle the public question, leave the answer null.`,
          ]
        : []),
      '',
      'Respond in role, then decide: what do you adopt, what do you retract, what do you',
      `voice or conjecture — and does your ${terms.record} now settle the question? Reply with ONLY the JSON object.`,
    ].join('\n');

    const out = await callJson(client, 'learner', view.turn, {
      system,
      user,
      meta: {
        adoptableCount: adoptable.length,
        patternAssertion,
        sameTurnAssertionAffordance,
        deriveHintIndices,
        deriveLabels: derivableCandidates.map((entry) => entry.label),
        ...(view.proxyDagMemory ? { proxyDagMemory: view.proxyDagMemory.metrics } : {}),
        ...(view.scene?.tempo ? { sceneTempo: view.scene.tempo } : {}),
        ...(castState ? { castState } : {}),
        ...(learnerDriftState ? { learnerDrift: learnerDriftState } : {}),
        // mock determinism (learner ledger): canned boundary commitments so
        // zero-paid runs traverse the commit/audit path. Real backend ignores.
        ...(ledgerSceneOpening
          ? {
              sceneIntentHint: {
                want: 'follow the scene goal and test each claim before keeping it',
                if_lost: 'ask_repair',
                speech_posture: 'plain and testing',
              },
            }
          : {}),
        ...(ledgerActOpening
          ? {
              actCarryHint: {
                carry_forward: 'the facts standing on my record',
                still_owe: 'the final answer, not yet grounded',
              },
            }
          : {}),
      },
    });
    // Learner-ledger parse (shape-gated like every commitment): boundary
    // turns only; a parse-miss leaves the boundary uncommitted, visibly.
    const sceneIntent = ledgerSceneOpening ? normalizeLearnerSceneIntent(out.scene_intent) : null;
    if (sceneIntent) {
      learnerLedgerState.intent = sceneIntent;
      learnerLedgerState.sceneIndex = view.scene.index;
    }
    const actCarry = ledgerActOpening ? normalizeLearnerActCarry(out.act_carry) : null;
    if (actCarry) {
      learnerLedgerState.carry = actCarry;
      learnerLedgerState.actIndex = view.act.index;
    }

    const adopt = validIndices(out.adopt_indices, adoptable.length).map((i) => adoptable[i]);
    const rawRetract = validIndices(out.retract_indices, view.abox.grounded.length).map((i) => view.abox.grounded[i]);
    const retractionFilter = filterContinuityRetractions(view, rawRetract, {
      dialogue: out.dialogue,
      hypothesis: out.hypothesis,
    });
    const retract = retractionFilter.kept;
    const deriveFromIndices = validIndices(out.derive_indices, derivableCandidates.length).map(
      (i) => derivableCandidates[i].fact,
    );
    const legacyDerives = Array.isArray(out.derives) ? out.derives.map(toFactArray).filter((f) => f.length) : [];
    const seenDerives = new Set();
    const derive = [...deriveFromIndices, ...legacyDerives].filter((fact) => {
      const key = factKey(fact);
      if (seenDerives.has(key)) return false;
      seenDerives.add(key);
      return true;
    });
    const factsForAnswer = [...view.abox.grounded, ...adopt];
    const parsedAssertion =
      bindingToFact(view.questionPattern, out.asserts_binding) ||
      answerToFact(view.questionPattern, out.asserts_answer, factsForAnswer, view.rules);
    const assertionSupported = parsedAssertion
      ? closure(factsForAnswer, view.rules).facts.has(factKey(parsedAssertion))
      : false;
    const assertionBlocked = Boolean(effectiveAssertionGroundingGate && parsedAssertion && !assertionSupported);
    const rawHypothesis =
      typeof out.hypothesis === 'string' && out.hypothesis.trim()
        ? sanitizePublicDialogue(out.hypothesis, { register: activeRegisterName })
        : null;
    const hypothesis = assertionBlocked
      ? rawHypothesis || 'I am tempted to answer, but my notes do not yet settle it.'
      : rawHypothesis;
    return {
      dialogue: assertionBlocked
        ? 'I am tempted to answer, but my notes do not yet settle it.'
        : sanitizePublicDialogue(out.dialogue, { register: activeRegisterName }),
      adopt,
      retract,
      derive,
      hypothesis,
      ...(retractionFilter.meta ? { retractionFilter: retractionFilter.meta } : {}),
      exchangeType: assertionBlocked
        ? 'hypothesis'
        : typeof out.exchange_type === 'string' && out.exchange_type.trim()
          ? out.exchange_type.trim()
          : null,
      asserts: assertionBlocked ? null : parsedAssertion,
      ...(effectiveAssertionGroundingGate && parsedAssertion
        ? {
            assertionGate: {
              blocked: assertionBlocked,
              supported: assertionSupported,
              attempted: parsedAssertion,
              reason: assertionBlocked
                ? 'assertion suppressed: learner-visible board does not entail the answer'
                : 'assertion allowed: learner-visible board entails the answer',
            },
          }
        : {}),
      ...(learnerDriftState ? { learnerDrift: learnerDriftState } : {}),
      ...(sceneIntent ? { sceneIntent } : {}),
      ...(actCarry ? { actCarry } : {}),
      ...(sceneIntentAudit ? { sceneIntentAudit } : {}),
    };
  };
}
