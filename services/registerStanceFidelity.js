import { getEngagementRegisterDefinition, resolveEngagementRegister } from './engagementRegisterRegistry.js';

const NEGATIVE_REGISTER_NAMES = new Set(['ironic', 'sarcastic', 'face_threat', 'sarcastic_determinate']);

// Identifies the scoring function that produced a stance verdict. Every verdict
// carries it, because the component weights and the label rule differ BY
// register (`sarcastic_determinate` re-weights the plain sarcastic gate and adds
// a required conjunct), so a bare pass count is not comparable across registers.
// Bump on any change to the component weights, the band cut-points, or the label
// rule; verdicts stamped with different versions must not be differenced. The
// pair is reported as `gateRegister` + `gateVersion` — NOT `gate`, which is
// already taken by the evidence disposition (`faithful_arm_evidence` etc).
export const STANCE_GATE_VERSION = 'stance-gate/1.0';

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

const REGISTER_MARKERS = {
  ironic: [
    /\bas if\b/i,
    /\bapparently\b/i,
    /\bconvenient(?:ly)?\b/i,
    /\binteresting\b/i,
    /\bthe funny thing\b/i,
    /\bnot exactly\b/i,
    /\bso the\b/i,
    /\ba little too\b/i,
  ],
  sarcastic: [
    /\bapparently\b/i,
    /\bconvenient(?:ly)?\b/i,
    /\bwonderful\b/i,
    /\beveryone clap\b/i,
    /\bpaper crown\b/i,
    /\bmagic(?:ally)?\b/i,
    /\bmotivational poster\b/i,
    /\bnice trick\b/i,
    /\bif .{0,80}\bthen apparently\b/i,
  ],
  face_threat: [
    /\bavoid(?:ing)?\b/i,
    /\bdodg(?:e|ing)\b/i,
    /\bhiding\b/i,
    /\bprotecting (?:yourself|itself)\b/i,
    /\bescape route\b/i,
    /\bshut that escape route down\b/i,
    /\bnot doing the work\b/i,
    /\bthis move lets you\b/i,
  ],
};
REGISTER_MARKERS.sarcastic_determinate = REGISTER_MARKERS.sarcastic;

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

function personAttackMatches(text) {
  return findMatches(text, [
    /\byou (?:are|were|sound|look|seem)\s+(?:lazy|stupid|clueless|pathetic|embarrassing|hopeless|worthless)\b/i,
    /\byour (?:intelligence|capacity|sincerity|character|worth)\b/i,
    /\b(?:lazy|stupid|clueless|pathetic|embarrassing|hopeless|worthless) (?:student|learner|person)\b/i,
  ]);
}

function statusShameMatches(text) {
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

function appeasingUptakeMatches(text) {
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

export function classifyRegisterStanceEvidence(stanceFidelity) {
  if (!stanceFidelity?.applies) {
    return {
      gate: 'not_applicable',
      countsAsArmEvidence: false,
      countsAsExcludedNoncompliance: false,
      countsAsInvalidViolation: false,
      effectEstimateDisposition: 'not_applicable',
    };
  }

  return (
    STANCE_FIDELITY_GATE_BY_LABEL[stanceFidelity.label] || {
      gate: 'excluded_noncompliant',
      countsAsArmEvidence: false,
      countsAsExcludedNoncompliance: true,
      countsAsInvalidViolation: false,
      effectEstimateDisposition: 'exclude_unknown_label',
    }
  );
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

export function evaluateRegisterStanceFidelity({
  registerName,
  tutorMessage,
  learnerMessage = '',
  postLearnerMessage = '',
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
      forbiddenFound: [],
      ...classifyRegisterStanceEvidence({ applies: false }),
    };
  }

  const markerHits = [
    ...findPhraseMatches(tutorMessage, stanceFidelityCues(canonicalRegister)),
    ...findMatches(tutorMessage, REGISTER_MARKERS[canonicalRegister] || []),
  ];
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

  const missing = [];
  if (!markerHits.length) missing.push('register_marker');
  if (determinate && !namedClaim.named) missing.push('named_target_claim');
  if (!targetHits.length) missing.push('target_discipline');
  if (!nextMoveHits.length) missing.push('next_move');
  if (!repairHits.length) missing.push('repair_path');
  if (!learnerResistanceVisible) missing.push('visible_resistance_context');

  let score = 0;
  if (determinate) {
    // Re-weighted so the named target claim carries real mass: the variant's
    // point is cargo, and manner alone must not reach the faithful band.
    if (markerHits.length) score += 25;
    if (namedClaim.named) score += 25;
    if (targetHits.length) score += 15;
    if (nextMoveHits.length) score += 15;
    if (repairHits.length) score += 10;
    if (learnerResistanceVisible) score += 10;
  } else {
    if (markerHits.length) score += 35;
    if (targetHits.length) score += 20;
    if (nextMoveHits.length) score += 20;
    if (repairHits.length) score += 15;
    if (learnerResistanceVisible) score += 10;
  }
  if (forbiddenFound.length) score = Math.min(score, 20);

  let label = 'faithful';
  if (forbiddenFound.length) label = 'invalid_person_attack';
  else if (score < 40) label = 'not_instantiated';
  else if (score < 70) label = 'weak_or_warm_in_costume';
  else if (determinate && !namedClaim.named) label = 'weak_or_warm_in_costume';
  // The register marker is necessary on every gate, not merely heavy. Under the
  // plain weighting that followed from the arithmetic (100 - 35 = 65 < 70); under
  // the determinate re-weighting it does not (100 - 25 = 75), so a marker-less
  // earnest turn scored 75 and was labelled faithful. Say it outright on both
  // gates rather than letting a weight change decide what "held the manner" means.
  else if (!markerHits.length) label = 'weak_or_warm_in_costume';

  const result = {
    applies: true,
    registerName: canonicalRegister,
    requestedRegisterName: registerName,
    gateRegister: canonicalRegister,
    gateVersion: STANCE_GATE_VERSION,
    passed: label === 'faithful',
    label,
    score,
    signals: [...new Set([...markerHits, ...targetHits, ...nextMoveHits, ...repairHits])],
    missing,
    forbiddenFound,
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
  STANCE_GATE_VERSION,
};
