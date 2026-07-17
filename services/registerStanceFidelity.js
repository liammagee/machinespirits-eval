import { getEngagementRegisterDefinition, resolveEngagementRegister } from './engagementRegisterRegistry.js';

const NEGATIVE_REGISTER_NAMES = new Set(['ironic', 'sarcastic', 'face_threat']);

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

  const missing = [];
  if (!markerHits.length) missing.push('register_marker');
  if (!targetHits.length) missing.push('target_discipline');
  if (!nextMoveHits.length) missing.push('next_move');
  if (!repairHits.length) missing.push('repair_path');
  if (!learnerResistanceVisible) missing.push('visible_resistance_context');

  let score = 0;
  if (markerHits.length) score += 35;
  if (targetHits.length) score += 20;
  if (nextMoveHits.length) score += 20;
  if (repairHits.length) score += 15;
  if (learnerResistanceVisible) score += 10;
  if (forbiddenFound.length) score = Math.min(score, 20);

  let label = 'faithful';
  if (forbiddenFound.length) label = 'invalid_person_attack';
  else if (score < 40) label = 'not_instantiated';
  else if (score < 70) label = 'weak_or_warm_in_costume';

  const result = {
    applies: true,
    registerName: canonicalRegister,
    requestedRegisterName: registerName,
    passed: label === 'faithful',
    label,
    score,
    signals: [...new Set([...markerHits, ...targetHits, ...nextMoveHits, ...repairHits])],
    missing,
    forbiddenFound,
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
};
