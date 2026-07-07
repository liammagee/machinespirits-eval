import { deriveOpportunityCostBudget } from './opportunityCost.js';
import { derivePublicLearnerEvidence, auditPublicOnlyInput } from './publicEvidence.js';

export const DISCURSIVE_ADAPTATION_SCHEMA = 'dramatic-derivation.discursive-adaptation.v0';

export const DISCURSIVE_MODES = Object.freeze([
  'minimal_presence',
  'recognition_repair',
  'low_pressure_prompt',
  'permission_to_assert',
  'purpose_acknowledgement',
  'phatic_repair',
  'firm_boundary',
  'unknown',
]);

const MODE_SET = new Set(DISCURSIVE_MODES);

function evidenceLine(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function modeFromEvidence(evidence, input = {}) {
  if (input.mode && MODE_SET.has(input.mode)) return input.mode;
  if (input.shouldAvoidIntervention || input.learnerAlreadyReasoning) return 'minimal_presence';
  switch (evidence.stance) {
    case 'tentative_correct':
      return 'minimal_presence';
    case 'near_final':
      return 'permission_to_assert';
    case 'purpose_question':
      return 'purpose_acknowledgement';
    case 'fluent_echo':
      return 'low_pressure_prompt';
    case 'confused':
      return 'phatic_repair';
    case 'defensive':
    case 'resistant':
      return input.boundaryNeeded ? 'firm_boundary' : 'recognition_repair';
    case 'social_disengagement':
      return 'phatic_repair';
    default:
      return 'unknown';
  }
}

function pressureFor(mode) {
  if (mode === 'minimal_presence' || mode === 'phatic_repair' || mode === 'recognition_repair') return 'lower';
  if (mode === 'permission_to_assert' || mode === 'firm_boundary') return 'raise';
  return 'hold';
}

function acknowledgementFor(mode) {
  if (mode === 'minimal_presence') return 'light';
  if (['recognition_repair', 'purpose_acknowledgement', 'phatic_repair'].includes(mode)) return 'explicit';
  return 'none';
}

export function deriveDiscursiveAdaptationState(input = {}) {
  const inputAudit = auditPublicOnlyInput(input);
  const publicEvidence = input.publicEvidence || derivePublicLearnerEvidence(input);
  const scope = ['turn', 'dialogue_block', 'scene', 'act'].includes(input.scope || publicEvidence.scope)
    ? input.scope || publicEvidence.scope
    : 'turn';
  if (!inputAudit.ok || publicEvidence.inputAudit?.ok === false) {
    return {
      schema: DISCURSIVE_ADAPTATION_SCHEMA,
      publicOnly: true,
      scope,
      mode: 'unknown',
      pressure: 'hold',
      acknowledgementNeed: 'none',
      shouldAskQuestion: false,
      shouldAvoidIntervention: false,
      evidence: ['input rejected by public-only audit'],
      opportunityCostBudget: deriveOpportunityCostBudget({ scope }),
      inputAudit: inputAudit.ok ? publicEvidence.inputAudit : inputAudit,
    };
  }

  const mode = modeFromEvidence(publicEvidence, input);
  const shouldAvoidIntervention =
    mode === 'minimal_presence' &&
    (publicEvidence.stance === 'tentative_correct' || input.learnerAlreadyReasoning || input.shouldAvoidIntervention);
  const shouldAskQuestion = !shouldAvoidIntervention && !['permission_to_assert', 'firm_boundary'].includes(mode);
  const evidence = [
    publicEvidence.stance !== 'unknown' ? `public stance: ${publicEvidence.stance}` : null,
    ...publicEvidence.uptakeMarkers.map((marker) => `uptake marker: ${marker}`),
    ...publicEvidence.purposeMarkers.map((marker) => `purpose marker: ${marker}`),
    ...publicEvidence.resistanceMarkers.map((marker) => `resistance marker: ${marker}`),
    ...publicEvidence.affectMarkers.map((marker) => `affect marker: ${marker}`),
  ]
    .map(evidenceLine)
    .filter(Boolean)
    .slice(0, 5);

  return {
    schema: DISCURSIVE_ADAPTATION_SCHEMA,
    publicOnly: true,
    scope,
    mode,
    pressure: pressureFor(mode),
    acknowledgementNeed: acknowledgementFor(mode),
    shouldAskQuestion,
    shouldAvoidIntervention,
    evidence: evidence.length ? evidence : ['no public discursive pressure detected'],
    opportunityCostBudget: deriveOpportunityCostBudget({
      scope,
      proofCriticalReleasePending: input.proofCriticalReleasePending,
      repairPending: input.repairPending,
      nearFinal: publicEvidence.stance === 'near_final' || input.nearFinal,
      currentProofNeutralTutorTurns: input.currentProofNeutralTutorTurns,
      currentProofNeutralLearnerTurns: input.currentProofNeutralLearnerTurns,
    }),
    inputAudit,
  };
}
