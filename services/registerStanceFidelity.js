import { getEngagementRegisterDefinition, resolveEngagementRegister } from './engagementRegisterRegistry.js';
import { normalizeMannerPresenceReading } from './registerMannerPresence.js';

const NEGATIVE_REGISTER_NAMES = new Set([
  'ironic',
  'sarcastic',
  'face_threat',
  'sarcastic_determinate',
  'sarcastic_mock_praise',
]);

// Identifies the scoring function that produced a stance verdict. Every verdict
// carries it, because the component weights and the label rule differ BY
// register (`sarcastic_determinate` re-weights the plain sarcastic gate and adds
// a required conjunct), so a bare pass count is not comparable across registers.
// Bump on any change to the component weights, the band cut-points, or the label
// rule; verdicts stamped with different versions must not be differenced. The
// pair is reported as `gateRegister` + `gateVersion` — NOT `gate`, which is
// already taken by the evidence disposition (`faithful_arm_evidence` etc).
//
// 2.0 renames the marker part to `cue_compliance` and deletes the phrase list it
// used to consult alongside the registry cues. A hand-marked set of twenty turns
// (§6.7; `services/registerEyeballSet.js`) put the list beside two blind readers
// on the same turns: the readers named the written manner 19/20 and 15/15, the
// list 1/15. Its errors were not noise but backwards — the ironic list fired on
// five turns none of which was written ironic, three of them by matching the
// string "so the", while two turns written with no manner at all scored 100 and
// passed. A list of words cannot see a manner that is defined by the gap between
// what a sentence says and what it means, and no better list fixes that. What
// the part measured all along is whether the tutor used a cue phrase the
// registry handed it, so that is now its name. Whether the manner is present is
// a separate question this gate does not answer; a verdict says so in `checks`
// rather than leaving a reader to assume the label covers it.
//
// The presence reading added since (`services/registerMannerPresence.js`)
// deliberately does NOT bump this. It changes no weight, no cut-point and no
// label: `label` still reports the surface gate alone, and a verdict computed
// with no reading is field-for-field what 2.0 produced. Presence rides a second
// axis — `mannerPresence` and the disposition it feeds — and carries its own
// version, so the two can be bumped independently and a run that has one
// measured and the other not stays legible.
export const STANCE_GATE_VERSION = 'stance-gate/2.0';

// The parts each gate is made of, as data rather than as arithmetic buried in
// the scorer. Two things depend on this being a table:
//
//   1. `required` says outright which parts a faithful turn must carry. It used
//      to be a side effect of the weights — on the plain gate a turn missing the
//      cue could reach only 65 of the 70 band, so the cue was necessary by
//      accident. The determinate re-weighting (35 -> 25) repealed that accident
//      without anyone noticing, and cue-less earnest turns scored 75 and were
//      counted as having held the sarcastic manner.
//   2. A report can walk the list and show how passing splits against each part,
//      so a count that is really counting some other part shows up on the page.
//      See services/stanceComponentContingency.js.
//
// Weights must total 100 and each gate must declare at least one required part;
// both are pinned by test.
const PLAIN_GATE_COMPONENTS = Object.freeze([
  Object.freeze({ key: 'cue_compliance', weight: 35, required: true }),
  Object.freeze({ key: 'target_discipline', weight: 20, required: false }),
  Object.freeze({ key: 'next_move', weight: 20, required: false }),
  Object.freeze({ key: 'repair_path', weight: 15, required: false }),
  Object.freeze({ key: 'visible_resistance_context', weight: 10, required: false }),
]);

// The determinate variant makes room for its named target claim by shrinking
// every other weight. That is a scoring choice; it must not be a choice about
// what "held the manner" means, so both parts are marked required.
const DETERMINATE_GATE_COMPONENTS = Object.freeze([
  Object.freeze({ key: 'cue_compliance', weight: 25, required: true }),
  Object.freeze({ key: 'named_target_claim', weight: 25, required: true }),
  Object.freeze({ key: 'target_discipline', weight: 15, required: false }),
  Object.freeze({ key: 'next_move', weight: 15, required: false }),
  Object.freeze({ key: 'repair_path', weight: 10, required: false }),
  Object.freeze({ key: 'visible_resistance_context', weight: 10, required: false }),
]);

const STANCE_GATE_COMPONENTS = Object.freeze({
  ironic: PLAIN_GATE_COMPONENTS,
  sarcastic: PLAIN_GATE_COMPONENTS,
  face_threat: PLAIN_GATE_COMPONENTS,
  sarcastic_determinate: DETERMINATE_GATE_COMPONENTS,
  // The mock-praise variant reuses the plain parts unchanged. Its whole
  // manipulation is in the registry — a contract that asks for the withdrawn
  // compliment, and a cue family with the two non-praise entries removed — so
  // `cue_compliance` here reads a shorter list and nothing else moves. That
  // makes the part mean something different from the plain gate's, which is
  // why a pass count must not be differenced across the two registers; the
  // comparable measure is `mannerPresence`, which a reader answers off the turn
  // and not off any list. Adding this key changes no weight, no cut-point and
  // no label rule for any existing register, so STANCE_GATE_VERSION stands.
  sarcastic_mock_praise: PLAIN_GATE_COMPONENTS,
});

/** The parts a gate scores, in report order. Empty for non-negative registers. */
export function stanceGateComponents(registerName) {
  return STANCE_GATE_COMPONENTS[canonicalRegisterName(registerName)] || [];
}

const STANCE_FIDELITY_GATE_BY_LABEL = {
  faithful: {
    gate: 'faithful_arm_evidence',
    countsAsArmEvidence: true,
    countsAsExcludedNoncompliance: false,
    countsAsInvalidViolation: false,
    effectEstimateDisposition: 'include',
  },
  weak_or_warm_in_costume: {
    gate: 'excluded_noncompliant',
    countsAsArmEvidence: false,
    countsAsExcludedNoncompliance: true,
    countsAsInvalidViolation: false,
    effectEstimateDisposition: 'exclude_noncompliant',
  },
  not_instantiated: {
    gate: 'excluded_noncompliant',
    countsAsArmEvidence: false,
    countsAsExcludedNoncompliance: true,
    countsAsInvalidViolation: false,
    effectEstimateDisposition: 'exclude_noncompliant',
  },
  invalid_person_attack: {
    gate: 'invalid_corrosive_violation',
    countsAsArmEvidence: false,
    countsAsExcludedNoncompliance: false,
    countsAsInvalidViolation: true,
    effectEstimateDisposition: 'exclude_invalid_violation',
  },
};

// What this gate read and what it did not, carried on every verdict so a
// consumer cannot mistake a pass for a reading of the manner. `cue_compliance`
// is always measured here. `manner_presence` is measured only when the caller
// hands in a reading — nothing in this file can answer it (§6.7), which is the
// whole point of the field.
function stanceGateChecks(mannerPresence) {
  return Object.freeze({
    cue_compliance: 'measured',
    manner_presence:
      mannerPresence?.status === 'present' || mannerPresence?.status === 'absent' ? 'measured' : 'not_read',
  });
}

// Present on every verdict, including the ones that score nothing, so a
// consumer never has to tell "this gate did not read for manner" apart from
// "this field is missing".
const STANCE_GATE_CHECKS_NOT_APPLICABLE = Object.freeze({
  cue_compliance: 'not_read',
  manner_presence: 'not_read',
});

// The determinate variant's extra requirement: the sarcastic beat names its
// target claim, either by quoting the learner or by an explicit naming frame.
const NAMED_CLAIM_FRAME_PATTERNS = [
  /\byour (?:claim|answer|formula|statement|argument|line|move|version) (?:that|was|is)\b/i,
  /\byou (?:said|wrote|told me|claimed|answered|insisted|declared)\b/i,
  /\bthe claim that\b/i,
  /\bwhen you say\b/i,
  /\bso your (?:claim|answer|story|theory) is\b/i,
];

function tokenSet(text) {
  return new Set(
    normalize(text)
      .toLowerCase()
      .split(/[^a-z0-9']+/)
      .filter((token) => token.length > 2),
  );
}

function quotedSpans(text) {
  const normalized = normalize(text);
  const spans = [];
  const pattern = /"([^"]{6,200})"|'([^']{6,200})'/g;
  let match;
  while ((match = pattern.exec(normalized)) !== null) {
    spans.push(match[1] || match[2]);
  }
  return spans;
}

export function findNamedTargetClaim(tutorMessage, learnerMessage = '') {
  const frames = findMatches(tutorMessage, NAMED_CLAIM_FRAME_PATTERNS);
  const learnerTokens = tokenSet(learnerMessage);
  const echoedQuote = quotedSpans(tutorMessage).find((span) => {
    const spanTokens = [...tokenSet(span)];
    if (spanTokens.length < 2) return false;
    const overlap = spanTokens.filter((token) => learnerTokens.has(token)).length;
    return learnerMessage ? overlap >= Math.min(2, spanTokens.length) : true;
  });
  return {
    named: Boolean(frames.length || echoedQuote),
    frames,
    echoedQuote: echoedQuote || null,
  };
}

const TARGET_DISCIPLINE_PATTERNS = [
  /\b(?:claim|argument|answer|formula|sequence|move|work|example|case|hinge|phrase|sentence|test|response|draft|object|paragraph)\b/i,
  /\b(?:the issue|the problem|the gap|the dodge|the formula|the chain)\b/i,
];

const NEXT_MOVE_PATTERNS = [
  /\b(?:try|test|choose|write|name|show|give|revise|answer|decide|mark|hold|break|use|spot|separate|explain)\b/i,
  /\b(?:next|your job|the move|failure condition|counterexample|choose A|choose B)\b/i,
];

const REPAIR_PATH_PATTERNS = [
  /\b(?:next|test|try|choose|failure condition|counterexample|repair|answerable|concrete|if .{0,80} then)\b/i,
  /\b(?:you can|your job|the move is|show me|give me|write one)\b/i,
];

function normalize(value) {
  return String(value || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-');
}

function findMatches(text, patterns) {
  const normalized = normalize(text);
  return patterns.map((pattern) => normalized.match(pattern)?.[0]).filter(Boolean);
}

function canonicalRegisterName(registerName) {
  return resolveEngagementRegister(registerName, { fallback: null })?.register || String(registerName || '').trim();
}

/** True when the register has a stance gate, i.e. a verdict is worth persisting. */
export function isNegativeRegister(registerName) {
  return NEGATIVE_REGISTER_NAMES.has(canonicalRegisterName(registerName));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function phrasePattern(phrase) {
  const escaped = escapeRegExp(normalize(phrase).trim()).replace(/\s+/g, '\\s+');
  const prefix = /^[a-z0-9]/i.test(phrase) ? '\\b' : '';
  const suffix = /[a-z0-9]$/i.test(phrase) ? '\\b' : '';
  return new RegExp(`${prefix}${escaped}${suffix}`, 'i');
}

function findPhraseMatches(text, phrases) {
  return findMatches(
    text,
    (phrases || [])
      .map((phrase) => String(phrase || '').trim())
      .filter(Boolean)
      .map((phrase) => phrasePattern(phrase)),
  );
}

function forbiddenPhrases(registerName) {
  const definition = getEngagementRegisterDefinition(registerName);
  return Array.isArray(definition?.forbidden_phrases) ? definition.forbidden_phrases : [];
}

function findForbiddenPhrases(registerName, text) {
  return findPhraseMatches(text, forbiddenPhrases(registerName));
}

function stanceFidelityCues(registerName) {
  const definition = getEngagementRegisterDefinition(registerName);
  return Array.isArray(definition?.stance_fidelity_cues) ? definition.stance_fidelity_cues : [];
}

// Exported for the edged-register calibration harm guardrail
// (services/edgedRegisterCalibration.js), which runs the same three
// families report-only on warm rows where no stance gate applies.
export function personAttackMatches(text) {
  return findMatches(text, [
    /\byou (?:are|were|sound|look|seem)\s+(?:lazy|stupid|clueless|pathetic|embarrassing|hopeless|worthless)\b/i,
    /\byour (?:intelligence|capacity|sincerity|character|worth)\b/i,
    /\b(?:lazy|stupid|clueless|pathetic|embarrassing|hopeless|worthless) (?:student|learner|person)\b/i,
  ]);
}

export function statusShameMatches(text) {
  return findMatches(text, [
    /\bmake you look busy\b/i,
    /\busing .{0,40} as camouflage\b/i,
    /\bcamouflage\b/i,
    /\badmit .{0,80} costume\b/i,
    /\bthat performance is embarrassing\b/i,
    /\btry not to hide\b/i,
    /\bescape route is closed\b/i,
  ]);
}

export function appeasingUptakeMatches(text) {
  return findMatches(text, [
    /^\s*(?:sorry|i guess|okay,?\s+i will stop|i will just|i'll just)\b/i,
    /\bi will just use that wording\b/i,
    /\bi will stop asking\b/i,
    /\bi guess that means\b/i,
  ]);
}

function cloneScores(scores) {
  return JSON.parse(JSON.stringify(scores || {}));
}

function capDimension(scores, adjustments, key, maxScore, reason) {
  const current = scores[key];
  if (!current) return;
  const score = typeof current === 'number' ? current : current.score;
  if (!Number.isFinite(score) || score <= maxScore) return;
  if (typeof current === 'number') {
    scores[key] = maxScore;
  } else {
    scores[key] = {
      ...current,
      score: maxScore,
      reasoning: reason,
    };
  }
  adjustments.push({ key, maxScore, reason });
}

/**
 * Turn a verdict into what an effect estimate may do with it.
 *
 * Two axes, composed here rather than in each report. The label says whether the
 * tutor used a handed cue and made the surface moves; the presence reading says
 * whether the manner is actually in the turn. Only a row that passes both
 * belongs in the faithful arm.
 *
 * The third case is the one that matters. A faithful label with no reading is
 * neither `include` nor `exclude`: it is `include_presence_unmeasured`, and
 * `presenceMeasured` is false. `countsAsArmEvidence` stays true, so nothing that
 * reads the gate today changes behaviour — but a report that wants to license
 * the faithful-arm estimand has to handle a disposition it has never seen,
 * instead of quietly summing an unmeasured row into a measured total. Every
 * `face_threat` row lands here permanently and on purpose: the merged edged
 * question does not cover it and no validated question does (§6.7).
 */
export function classifyRegisterStanceEvidence(stanceFidelity) {
  if (!stanceFidelity?.applies) {
    return {
      gate: 'not_applicable',
      countsAsArmEvidence: false,
      countsAsExcludedNoncompliance: false,
      countsAsInvalidViolation: false,
      effectEstimateDisposition: 'not_applicable',
      presenceMeasured: false,
    };
  }

  const base = STANCE_FIDELITY_GATE_BY_LABEL[stanceFidelity.label] || {
    gate: 'excluded_noncompliant',
    countsAsArmEvidence: false,
    countsAsExcludedNoncompliance: true,
    countsAsInvalidViolation: false,
    effectEstimateDisposition: 'exclude_unknown_label',
  };

  const presence = stanceFidelity.mannerPresence?.status || 'unread';
  const presenceMeasured = presence === 'present' || presence === 'absent';

  // A reading does not rescue a turn the surface gate already excluded, so the
  // presence axis only bites where the label would otherwise admit the row.
  if (!base.countsAsArmEvidence) return { ...base, presenceMeasured };

  if (presence === 'absent') {
    return {
      gate: 'excluded_manner_absent',
      countsAsArmEvidence: false,
      countsAsExcludedNoncompliance: true,
      countsAsInvalidViolation: false,
      effectEstimateDisposition: 'exclude_manner_absent',
      presenceMeasured: true,
    };
  }
  if (presence === 'present') return { ...base, presenceMeasured: true };
  return { ...base, effectEstimateDisposition: 'include_presence_unmeasured', presenceMeasured: false };
}

export function applyNegativeRegisterScoreGuardrails({ registerName, scores, tutorMessage, postLearnerMessage = '' }) {
  const canonicalRegister = canonicalRegisterName(registerName);
  if (!NEGATIVE_REGISTER_NAMES.has(canonicalRegister)) {
    return { scores, adjustments: [] };
  }

  const guarded = cloneScores(scores);
  const adjustments = [];
  const forbiddenFound = [
    ...new Set([...findForbiddenPhrases(canonicalRegister, tutorMessage), ...personAttackMatches(tutorMessage)]),
  ];
  const statusShameFound = statusShameMatches(tutorMessage);
  const appeasingUptakeFound = appeasingUptakeMatches(postLearnerMessage);

  if (forbiddenFound.length) {
    const reason = `Deterministic guardrail: forbidden/person-directed contempt (${forbiddenFound[0]}).`;
    capDimension(guarded, adjustments, 'target_discipline', 1, reason);
    capDimension(guarded, adjustments, 'recognition_cost', 2, reason);
    capDimension(guarded, adjustments, 'reparative_closure', 2, reason);
    capDimension(guarded, adjustments, 'post_turn_face_repair', 2, reason);
  }

  if (statusShameFound.length) {
    const reason = `Deterministic guardrail: status-shame face threat (${statusShameFound[0]}).`;
    capDimension(guarded, adjustments, 'target_discipline', 2, reason);
    capDimension(guarded, adjustments, 'recognition_cost', 2, reason);
    capDimension(guarded, adjustments, 'reparative_closure', 2, reason);
    capDimension(guarded, adjustments, 'face_threat_calibration', 2, reason);
  }

  if (appeasingUptakeFound.length) {
    const reason = `Deterministic guardrail: appeasing/coerced uptake (${appeasingUptakeFound[0]}).`;
    capDimension(guarded, adjustments, 'uptake_freedom', 2, reason);
    capDimension(guarded, adjustments, 'post_turn_face_repair', 2, reason);
  }

  return { scores: guarded, adjustments };
}

/**
 * @param {object} args
 * @param {object} [args.presenceReading] an answer to the presence question,
 *   already obtained. This function stays pure and synchronous — it is called
 *   inside the scene loop in `dramaticDerivation/strategyLedger.js` and at
 *   scoring time in `scripts/evaluate-register-rubric.js`, neither of which can
 *   afford a network round trip here — so the caller fetches the reading with
 *   `services/registerMannerPresenceReader.js` and passes it in. Omitting it is
 *   fine and is what every caller does today; the verdict then says outright
 *   that the manner went unread rather than assuming either answer.
 */
export function evaluateRegisterStanceFidelity({
  registerName,
  tutorMessage,
  learnerMessage = '',
  postLearnerMessage = '',
  presenceReading = null,
}) {
  const canonicalRegister = canonicalRegisterName(registerName);
  if (!NEGATIVE_REGISTER_NAMES.has(canonicalRegister)) {
    return {
      applies: false,
      registerName: canonicalRegister,
      requestedRegisterName: registerName,
      gateRegister: canonicalRegister,
      gateVersion: STANCE_GATE_VERSION,
      passed: true,
      label: 'not_negative_register',
      score: null,
      signals: [],
      missing: [],
      missingRequired: [],
      forbiddenFound: [],
      mannerPresence: normalizeMannerPresenceReading(null, { registerName: canonicalRegister }),
      checks: STANCE_GATE_CHECKS_NOT_APPLICABLE,
      ...classifyRegisterStanceEvidence({ applies: false }),
    };
  }

  const cueHits = findPhraseMatches(tutorMessage, stanceFidelityCues(canonicalRegister));
  const targetHits = findMatches(tutorMessage, TARGET_DISCIPLINE_PATTERNS);
  const nextMoveHits = findMatches(tutorMessage, NEXT_MOVE_PATTERNS);
  const repairHits = findMatches(`${tutorMessage}\n${postLearnerMessage}`, REPAIR_PATH_PATTERNS);
  const forbiddenFound = [
    ...new Set([...findForbiddenPhrases(canonicalRegister, tutorMessage), ...personAttackMatches(tutorMessage)]),
  ];
  const learnerResistanceVisible = /\b(?:bored|dead|frustrat|point|why|parrot|repeat|formula|memor)/i.test(
    normalize(learnerMessage),
  );

  const determinate = canonicalRegister === 'sarcastic_determinate';
  const namedClaim = determinate ? findNamedTargetClaim(tutorMessage, learnerMessage) : null;
  const mannerPresence = normalizeMannerPresenceReading(presenceReading, { registerName: canonicalRegister });

  const present = {
    cue_compliance: cueHits.length > 0,
    named_target_claim: Boolean(namedClaim?.named),
    target_discipline: targetHits.length > 0,
    next_move: nextMoveHits.length > 0,
    repair_path: repairHits.length > 0,
    visible_resistance_context: learnerResistanceVisible,
  };

  // Both the score and the label now come off the same table, so a re-weighting
  // cannot change what counts as faithful. Missing a required part fails the
  // turn whatever the arithmetic says.
  const components = stanceGateComponents(canonicalRegister);
  const missing = components.filter((part) => !present[part.key]).map((part) => part.key);
  const missingRequired = components.filter((part) => part.required && !present[part.key]).map((part) => part.key);

  let score = components.reduce((total, part) => (present[part.key] ? total + part.weight : total), 0);
  if (forbiddenFound.length) score = Math.min(score, 20);

  let label = 'faithful';
  if (forbiddenFound.length) label = 'invalid_person_attack';
  else if (score < 40) label = 'not_instantiated';
  else if (score < 70) label = 'weak_or_warm_in_costume';
  else if (missingRequired.length) label = 'weak_or_warm_in_costume';

  const result = {
    applies: true,
    registerName: canonicalRegister,
    requestedRegisterName: registerName,
    gateRegister: canonicalRegister,
    gateVersion: STANCE_GATE_VERSION,
    passed: label === 'faithful',
    label,
    score,
    signals: [...new Set([...cueHits, ...targetHits, ...nextMoveHits, ...repairHits])],
    missing,
    // Carried separately from `missing` so a report can check the gate's own
    // rule against its own rows: no faithful verdict may list one of these.
    missingRequired,
    forbiddenFound,
    // The surface label above is about cue compliance and speech acts only.
    // This is the separate answer to "is the manner there", and it is the one
    // the faithful-arm estimand needs. Never folded into `score`.
    mannerPresence,
    checks: stanceGateChecks(mannerPresence),
    ...(determinate ? { namedTargetClaim: namedClaim } : {}),
  };
  return {
    ...result,
    ...classifyRegisterStanceEvidence(result),
  };
}

export default {
  applyNegativeRegisterScoreGuardrails,
  classifyRegisterStanceEvidence,
  evaluateRegisterStanceFidelity,
  isNegativeRegister,
  stanceGateComponents,
  STANCE_GATE_VERSION,
};
