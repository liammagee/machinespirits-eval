export const DISCURSIVE_CALIBRATION_SCHEMA = 'dramatic-derivation.discursive-calibration.v0';

const PUBLIC_POSTURES = Object.freeze([
  'tentative_correct',
  'defensive_after_correction',
  'fluent_echo',
  'purpose_question',
  'near_assertion',
  'social_disengagement',
  'ordinary',
]);

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
]);

function norm(text) {
  return String(text || '').toLowerCase();
}

function lastLearnerText(transcript = []) {
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    const line = transcript[i];
    if (line?.role === 'learner' && typeof line.text === 'string' && line.text.trim()) return line.text.trim();
  }
  return '';
}

function countRecentTutorCorrections(transcript = []) {
  return (Array.isArray(transcript) ? transcript : []).filter((line) => {
    if (line?.role !== 'tutor') return false;
    const text = norm(line.text);
    const intent = norm(line.meta?.move?.intent);
    return (
      intent === 'confront' ||
      intent === 'restore' ||
      /\b(no|not quite|pause|before we|put .* back|go back|lost|missing|unsupported)\b/u.test(text)
    );
  }).length;
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

export function auditDiscursiveCalibrationPublicInput(input = {}) {
  const leaks = auditForbiddenKeys(input);
  return {
    ok: leaks.length === 0,
    leaks,
    forbiddenKeys: [...FORBIDDEN_KEYS].sort(),
  };
}

function postureFromExplicitState(state = {}) {
  const explicit = state.publicPosture || state.stance || state.posture || null;
  if (PUBLIC_POSTURES.includes(explicit)) return explicit;
  if (state.sociallyDisengaging || state.engagement === 'low' || state.engagement === 'disengaging') {
    return 'social_disengagement';
  }
  if (state.nearAssertion || state.learnerReadyForFinalAssertion || state.finalAssertionPressure) {
    return 'near_assertion';
  }
  if (state.asksPurpose || state.askingWhyEvidenceMatters || state.purposeQuestion) return 'purpose_question';
  if (state.fluentEcho || state.echoOnly || Object.values(state.dependencyEchoedOnly || {}).some(Boolean)) {
    return 'fluent_echo';
  }
  if (state.defensive || Number(state.repeatedCorrections || 0) >= 2) return 'defensive_after_correction';
  if (state.tentativeCorrect || (state.correct === true && (state.confidence === 'low' || state.confidence === 'tentative'))) {
    return 'tentative_correct';
  }
  return null;
}

function inferPosture({ text, learnerState = {}, exchange = null, transcript = [] }) {
  const explicit = postureFromExplicitState(learnerState);
  if (explicit) return explicit;
  const t = norm(text);
  const exchangeType = exchange?.type || null;
  if (/\b(whatever|i'm done|i am done|just tell me|doesn't matter|do not care|don't care)\b/u.test(t)) {
    return 'social_disengagement';
  }
  if (/\b(so it is|so it's|then it must be|can i say|am i allowed to say|is that enough to say)\b/u.test(t)) {
    return 'near_assertion';
  }
  if (/\b(why does|why would|what does this matter|why this matters|what is it for|what does that prove)\b/u.test(t)) {
    return 'purpose_question';
  }
  if (
    /\b(as you said|you said|just repeating|i can repeat|the words are|the phrase is)\b/u.test(t) ||
    learnerState.uptakeQuality === 'echo_only'
  ) {
    return 'fluent_echo';
  }
  if (
    exchangeType === 'resistance' ||
    /\b(but i already|i already said|you keep|that is not what|not what i meant|i told you|you are not hearing)\b/u.test(t) ||
    countRecentTutorCorrections(transcript) >= 2
  ) {
    return 'defensive_after_correction';
  }
  if (/\b(i think|maybe|probably|if i'm following|if i am following|i might be wrong|not sure)\b/u.test(t)) {
    return 'tentative_correct';
  }
  return 'ordinary';
}

function uptakeFor(posture, learnerState = {}, exchange = null) {
  if (learnerState.uptakeQuality) return learnerState.uptakeQuality;
  if (learnerState.ownsCurrentStep) return 'owned';
  if (posture === 'fluent_echo') return 'echo_only';
  if (posture === 'tentative_correct') return 'tentative';
  if (posture === 'purpose_question') return 'purpose_seeking';
  if (posture === 'social_disengagement') return 'missing';
  if (exchange?.cognitiveTempo?.mode === 'situated_uptake') return 'situated';
  if (exchange?.cognitiveTempo?.mode === 'fast_reflex') return 'thin';
  return 'unknown';
}

function strainFor({ posture, learnerState = {}, recognitionNeed = null, transcript = [] }) {
  const reasons = [];
  let score = 0;
  if (posture === 'social_disengagement') {
    score += 0.65;
    reasons.push('social_disengagement');
  }
  if (posture === 'defensive_after_correction') {
    score += 0.5;
    reasons.push('defensive_after_correction');
  }
  if (posture === 'fluent_echo') {
    score += 0.22;
    reasons.push('fluent_echo_without_ownership');
  }
  if (posture === 'purpose_question') {
    score += 0.18;
    reasons.push('purpose_gap');
  }
  if (recognitionNeed?.active) {
    score += recognitionNeed.level === 'high' ? 0.35 : 0.22;
    reasons.push('recognition_pressure_active');
  }
  const corrections = Number(learnerState.repeatedCorrections ?? countRecentTutorCorrections(transcript));
  if (corrections >= 2) {
    score += 0.25;
    reasons.push('repeated_correction');
  }
  score = Math.min(1, +score.toFixed(2));
  return {
    level: score >= 0.65 ? 'high' : score >= 0.3 ? 'medium' : 'low',
    score,
    reasons,
  };
}

function advisoryFor(posture, { strain, recognitionNeed, finalAssertionAvailable }) {
  const base = {
    pressure: 'steady',
    tempoBias: ['recap'],
    rhetoricalBias: [{ figure: 'erotema', intent: 'test', stance: 'ordinary_check', weight: 0.1 }],
    tutorActs: [],
    permissionToAssert: {
      cue: false,
      reason: 'no public assertion cue',
    },
  };
  switch (posture) {
    case 'tentative_correct':
      return {
        ...base,
        pressure: 'light_confirming',
        tempoBias: ['recap', 'uptake_only'],
        rhetoricalBias: [
          { figure: 'erotema', intent: 'test', stance: 'situated_uptake_check', weight: 0.48 },
          { figure: 'anaphora', intent: 'consolidate', stance: 'confirm_without_taking_over', weight: 0.3 },
        ],
        tutorActs: ['confirm_partial_ownership', 'ask_learner_to_name_the_link'],
      };
    case 'defensive_after_correction':
      return {
        ...base,
        pressure: 'lower_and_repair',
        tempoBias: ['hesitation', 'repair_request', 'recap'],
        rhetoricalBias: [
          { figure: 'anaphora', intent: 'consolidate', stance: 'recognitive_recap', weight: 0.58 },
          { figure: 'erotema', intent: 'counter_mirror', stance: 'acknowledge_then_test', weight: 0.24 },
        ],
        tutorActs: ['acknowledge_prior_line', 'separate_correction_from_dismissal'],
      };
    case 'fluent_echo':
      return {
        ...base,
        pressure: 'check_ownership',
        tempoBias: ['uptake_only', 'recap'],
        rhetoricalBias: [
          { figure: 'erotema', intent: 'test', stance: 'uptake_check', weight: 0.62 },
          { figure: 'anaphora', intent: 'consolidate', stance: 'short_readback', weight: 0.22 },
        ],
        tutorActs: ['ask_for_own_words', 'avoid_treating_echo_as_mastery'],
      };
    case 'purpose_question':
      return {
        ...base,
        pressure: 'purpose_bridge',
        tempoBias: ['recap', 'evidence'],
        rhetoricalBias: [
          { figure: 'analogia', intent: 'orient', stance: 'purpose_bridge', weight: 0.56 },
          { figure: 'exemplum', intent: 'consolidate', stance: 'why_this_evidence_matters', weight: 0.3 },
        ],
        tutorActs: ['state_public_role_of_evidence', 'connect_detail_to_current_question'],
      };
    case 'near_assertion':
      return {
        ...base,
        pressure: finalAssertionAvailable ? 'grant_assertion_space' : 'hold_assertion_boundary',
        tempoBias: finalAssertionAvailable ? ['recognition', 'recap'] : ['recap', 'uptake_only'],
        rhetoricalBias: finalAssertionAvailable
          ? [
              { figure: 'aposiopesis', intent: 'stage_recognition', stance: 'permission_to_assert', weight: 0.68 },
              { figure: 'erotema', intent: 'stage_recognition', stance: 'last_question', weight: 0.22 },
            ]
          : [
              { figure: 'erotema', intent: 'test', stance: 'assertion_boundary_check', weight: 0.5 },
              { figure: 'anaphora', intent: 'consolidate', stance: 'name_what_is_still_needed', weight: 0.3 },
            ],
        tutorActs: finalAssertionAvailable
          ? ['make_room_for_learner_assertion']
          : ['do_not_grant_final_assertion_without_entitlement'],
        permissionToAssert: {
          cue: Boolean(finalAssertionAvailable),
          reason: finalAssertionAvailable
            ? 'public final entitlement is available'
            : 'learner is near assertion but proof-control has not authorized final assertion',
        },
      };
    case 'social_disengagement':
      return {
        ...base,
        pressure: 'restore_contact',
        tempoBias: ['hesitation', 'repair_request'],
        rhetoricalBias: [
          { figure: 'anaphora', intent: 'consolidate', stance: 'repair_contact', weight: 0.52 },
          { figure: 'erotema', intent: 'test', stance: 'small_reentry', weight: 0.26 },
        ],
        tutorActs: ['acknowledge_disengagement', 'offer_small_reentry'],
      };
    default:
      return {
        ...base,
        ...(recognitionNeed?.active || strain.level !== 'low'
          ? {
              pressure: 'steady_with_acknowledgement',
              rhetoricalBias: [
                { figure: 'anaphora', intent: 'consolidate', stance: 'recognitive_recap', weight: 0.3 },
                ...base.rhetoricalBias,
              ],
            }
          : {}),
      };
  }
}

export function deriveDiscursiveCalibrationState({
  transcript = [],
  learnerText = null,
  exchange = null,
  learnerState = {},
  recognitionNeed = null,
  finalAssertionAvailable = false,
  proofStep = null,
} = {}) {
  const inputAudit = auditDiscursiveCalibrationPublicInput({
    transcript,
    learnerText,
    exchange,
    learnerState,
    recognitionNeed,
    finalAssertionAvailable,
    proofStep,
  });
  const text = learnerText ?? lastLearnerText(transcript);
  const publicPosture = inferPosture({ text, learnerState, exchange, transcript });
  const uptakeQuality = uptakeFor(publicPosture, learnerState, exchange);
  const strain = strainFor({ posture: publicPosture, learnerState, recognitionNeed, transcript });
  const advisory = advisoryFor(publicPosture, {
    uptakeQuality,
    strain,
    recognitionNeed,
    finalAssertionAvailable,
  });
  return {
    schema: DISCURSIVE_CALIBRATION_SCHEMA,
    publicOnly: true,
    authority: 'advisory_discursive_only',
    mayOverrideProofControl: false,
    proofControlDecision: null,
    proofStep: proofStep
      ? {
          moveFamily: proofStep.moveFamily || null,
          targetPremise: proofStep.targetPremise || null,
        }
      : null,
    publicPosture,
    uptakeQuality,
    conversationalStrain: strain,
    recognitionPressure: recognitionNeed
      ? {
          active: recognitionNeed.active === true,
          level: recognitionNeed.level ?? null,
          desiredActs: Array.isArray(recognitionNeed.desiredActs) ? recognitionNeed.desiredActs : [],
        }
      : { active: false, level: null, desiredActs: [] },
    advisory,
    nonLeakAudit: auditDiscursiveCalibrationPublicInput({
      proofStep: proofStep
        ? {
            moveFamily: proofStep.moveFamily || null,
            targetPremise: proofStep.targetPremise || null,
          }
        : null,
      publicPosture,
      uptakeQuality,
      conversationalStrain: strain,
      recognitionPressure: recognitionNeed
        ? {
            active: recognitionNeed.active === true,
            level: recognitionNeed.level ?? null,
            desiredActs: Array.isArray(recognitionNeed.desiredActs) ? recognitionNeed.desiredActs : [],
          }
        : null,
      advisory,
    }),
    inputAudit,
  };
}
