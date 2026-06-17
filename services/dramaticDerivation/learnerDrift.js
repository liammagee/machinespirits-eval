export const LEARNER_DRIFT_SCHEMA = 'dramatic-derivation.learner-drift.v0';

const FORBIDDEN_KEYS = new Set([
  'secret',
  'proofPath',
  'proof_path',
  'rawBoard',
  'raw_board',
  'hiddenBoard',
  'hidden_board',
  'corruptionLedger',
  'corruption_ledger',
  'D',
  'dNow',
  'dIfRestored',
  'deltaD',
  'finalD',
  'trajectoryD',
  'boardD',
  'sourcePremiseIds',
  'sourceProofPathIds',
  'proofTree',
  'closureTrace',
  'premiseId',
  'premiseIds',
  'ruleId',
  'ruleIds',
  'predicate',
  'predicateName',
  'releaseSchedule',
  'release_schedule',
  'releasedFacts',
  'released_facts',
  'ledger',
]);

function cleanText(value, fallback = null, max = 220) {
  if (typeof value !== 'string') return fallback;
  const text = value.replace(/\s+/gu, ' ').trim();
  return text ? text.slice(0, max) : fallback;
}

function cleanList(value, maxItems = 5, maxChars = 120) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item, null, maxChars)).filter(Boolean).slice(0, maxItems);
}

function auditForbiddenKeys(value, path = []) {
  const leaks = [];
  if (!value || typeof value !== 'object') return leaks;
  if (Array.isArray(value)) {
    value.forEach((item, index) => leaks.push(...auditForbiddenKeys(item, [...path, String(index)])));
    return leaks;
  }
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (FORBIDDEN_KEYS.has(key)) leaks.push({ path: nextPath.join('.'), key });
    leaks.push(...auditForbiddenKeys(child, nextPath));
  }
  return leaks;
}

export function auditLearnerDriftPublicInput(input = {}) {
  const leaks = auditForbiddenKeys(input);
  return {
    ok: leaks.length === 0,
    leaks,
    forbiddenKeys: [...FORBIDDEN_KEYS].sort(),
  };
}

function norm(text) {
  return String(text || '').toLowerCase();
}

function publicTranscriptLines(transcript = []) {
  return (Array.isArray(transcript) ? transcript : [])
    .filter((line) => ['learner', 'tutor', 'stage', 'director'].includes(line?.role))
    .map((line) => ({
      role: line.role === 'director' ? 'stage' : line.role,
      text: cleanText(line.text, '', 300),
    }))
    .filter((line) => line.text);
}

function recentTutorLines(lines, count = 4) {
  return lines.filter((line) => line.role === 'tutor').slice(-count);
}

function recentLearnerLines(lines, count = 4) {
  return lines.filter((line) => line.role === 'learner').slice(-count);
}

const EXPLICIT_ACK_RE =
  /\b(i hear|i see why|i'm not dismissing|i am not dismissing|your caution|your draft|your point|you caught|you wrote|you are right to|that concern belongs|keep your|not taking .* away|not throwing .* out)\b/u;
const THIN_APPROVAL_RE = /\b(good|right|yes|fine)\b/u;
const DIRECTIVE_RE =
  /\b(don't|do not|must|keep it|keep this|take only|take the smaller|set .* aside|leave .* blank|before you|say .* back|strip it back|put it in|write .* as|no yard|no person|not the whole|one smaller job)\b/u;
const RESISTANCE_RE =
  /\b(i don't love|i do not love|i don't like|i do not like|i'm not sure|i am not sure|why does|why would|not what i meant|the town|the bond|the draft|i wrote|i already|i'll grant|i will grant|but)\b/u;
const OWNERSHIP_RE =
  /\b(i see why|i see that|i can write|i'll write|i will write|i take your point|that is the split|that does change|wait|yes,.*those two lines|i don't love.*but)\b/u;

function countMatches(lines, re) {
  return lines.reduce((sum, line) => sum + (re.test(norm(line.text)) ? 1 : 0), 0);
}

function chooseMode({ recentTutor, recentLearner, driftConfig }) {
  const tutorAck = countMatches(recentTutor, EXPLICIT_ACK_RE);
  const tutorThinApproval = countMatches(recentTutor, THIN_APPROVAL_RE);
  const tutorDirective = countMatches(recentTutor, DIRECTIVE_RE);
  const learnerResistance = countMatches(recentLearner, RESISTANCE_RE);
  const learnerOwnership = countMatches(recentLearner, OWNERSHIP_RE);
  const dogmaticSensitivity = cleanText(driftConfig?.dogmatic_sensitivity || driftConfig?.dogmaticSensitivity, 'high', 40);

  if (tutorAck >= 2 && learnerOwnership >= 1) {
    return {
      mode: 'reluctant_owned_revision',
      pressure: 'releasing',
      rationale: 'recent tutor conduct preserved the learner concern and the learner has begun owning a revision',
      metrics: { tutorAck, tutorThinApproval, tutorDirective, learnerResistance, learnerOwnership },
    };
  }
  if (tutorAck >= 1 && tutorDirective <= 1) {
    return {
      mode: 'watchful_softening',
      pressure: learnerResistance ? 'medium' : 'low',
      rationale: 'recent tutor conduct acknowledges the learner position before pressing the next step',
      metrics: { tutorAck, tutorThinApproval, tutorDirective, learnerResistance, learnerOwnership },
    };
  }
  if (learnerResistance >= 1 && (tutorDirective >= 1 || tutorThinApproval >= 1 || dogmaticSensitivity === 'high')) {
    return {
      mode: 'defensive_reversion',
      pressure: 'high',
      rationale: 'recent exchange reads as correction without enough face-saving acknowledgement',
      metrics: { tutorAck, tutorThinApproval, tutorDirective, learnerResistance, learnerOwnership },
    };
  }
  if (tutorDirective >= 2 && tutorAck === 0) {
    return {
      mode: 'compliant_echo',
      pressure: 'medium',
      rationale: 'recent tutor conduct is directive enough to invite surface compliance rather than owned uptake',
      metrics: { tutorAck, tutorThinApproval, tutorDirective, learnerResistance, learnerOwnership },
    };
  }
  return {
    mode: 'guarded_baseline',
    pressure: 'medium',
    rationale: 'learner remains socially guarded but has no acute drift trigger',
    metrics: { tutorAck, tutorThinApproval, tutorDirective, learnerResistance, learnerOwnership },
  };
}

export function deriveLearnerDriftState({
  worldLearnerDrift = null,
  transcript = [],
  turn = null,
  scene = null,
  stagePrologue = null,
  enabled = true,
} = {}) {
  const inputAudit = auditLearnerDriftPublicInput({
    worldLearnerDrift,
    transcript,
    turn,
    scene,
    stagePrologue,
  });
  if (!enabled || !worldLearnerDrift || inputAudit.ok !== true) {
    return null;
  }
  const lines = publicTranscriptLines(transcript);
  const recentTutor = recentTutorLines(lines);
  const recentLearner = recentLearnerLines(lines);
  const selected = chooseMode({ recentTutor, recentLearner, driftConfig: worldLearnerDrift });
  const modeNotes = worldLearnerDrift.modes && typeof worldLearnerDrift.modes === 'object' ? worldLearnerDrift.modes : {};
  const guidance = cleanList(modeNotes[selected.mode]?.guidance, 5, 160);
  const state = {
    schema: LEARNER_DRIFT_SCHEMA,
    publicOnly: true,
    authority: 'public_learner_character_drift',
    mayOverrideProofControl: false,
    proofControlAuthority: 'none',
    mode: selected.mode,
    pressure: selected.pressure,
    rationale: selected.rationale,
    baseline: cleanText(worldLearnerDrift.baseline, 'face-saving resistant learner', 120),
    allowedChanges: ['stance', 'tempo', 'phatic_markers', 'willingness_to_concede', 'face_saving_language'],
    forbiddenChanges: ['fact_adoption_without_grounding', 'answer_assertion_without_board', 'proof_target', 'release_timing'],
    guidance: guidance.length
      ? guidance
      : [
          selected.mode === 'reluctant_owned_revision' || selected.mode === 'watchful_softening'
            ? 'Let acknowledgement lower defensiveness, but preserve the old public concern as a separate line.'
            : 'Do not concede merely because the tutor presses; show whether you are convinced, complying, or still protecting the draft.',
        ],
    exitCondition: cleanText(
      modeNotes[selected.mode]?.exit_condition || modeNotes[selected.mode]?.exitCondition,
      'learner can revise the public claim while preserving face and grounding',
      180,
    ),
    evidence: {
      recentTutor: recentTutor.map((line) => line.text).slice(-2),
      recentLearner: recentLearner.map((line) => line.text).slice(-2),
      metrics: selected.metrics,
    },
    inputAudit,
  };
  return {
    ...state,
    nonLeakAudit: auditLearnerDriftPublicInput(state),
  };
}

export function learnerDriftLines(state) {
  if (!state || state.publicOnly !== true || state.mayOverrideProofControl !== false || state.inputAudit?.ok === false) {
    return [];
  }
  return [
    '',
    'LEARNER DRIFT (public character pressure only):',
    `- current stance pressure: ${state.mode} (${state.pressure})`,
    `- rationale: ${state.rationale}`,
    `- baseline: ${state.baseline}`,
    ...state.guidance.map((line) => `- ${line}`),
    `- exit condition: ${state.exitCondition}`,
    '- This changes how you inhabit resistance, acknowledgement, concession, and uncertainty. It never changes what facts you may adopt, derive, or assert.',
  ];
}

