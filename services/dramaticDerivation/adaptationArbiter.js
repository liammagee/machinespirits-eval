import { auditOpportunityCost, deriveOpportunityCostBudget } from './opportunityCost.js';
import { auditPublicOnlyInput } from './publicEvidence.js';

export const ADAPTATION_ARBITER_SCHEMA = 'dramatic-derivation.adaptation-arbiter.v0';
export const ADAPTATION_TRACE_SCHEMA = 'dramatic-derivation.adaptation-trace.v0';

const PROOF_ACTIONS = new Set([
  'release_next_evidence',
  'repair_dependency',
  'hold_release',
  'block_assertion',
  'invite_final_assertion',
  'no_proof_action',
]);

export function normalizeProofControlDecision(input = {}) {
  const action = PROOF_ACTIONS.has(input.action) ? input.action : 'no_proof_action';
  return {
    schema: 'dramatic-derivation.proof-control-decision.v0',
    source: input.source || 'hidden_proofDebt',
    scope: 'turn',
    action,
    target: input.target || input.targetPremise || null,
    proofCritical: Boolean(input.proofCritical),
    releaseSafe: input.releaseSafe !== false,
    nonLeakAudit: input.nonLeakAudit || { ok: true, leaks: [] },
    explanationForLogs: input.explanationForLogs || 'normalized proof-control decision',
    tutorFacingSummary: input.tutorFacingSummary || '',
  };
}

function overlayRows(input = {}) {
  return [
    ['discursive', input.discursive],
    ['didactic', input.didactic],
    ['ownership', input.ownership],
    ['uptake', input.uptake],
    ['selfRegulation', input.selfRegulation],
  ].filter(([, value]) => value && typeof value === 'object');
}

function requestedConduct({ discursive, didactic, uptake, selfRegulation }) {
  if (discursive?.mode === 'minimal_presence' || uptake?.nextActionRecommendation === 'minimal_presence') {
    return 'minimal_presence';
  }
  if (uptake?.nextActionRecommendation === 'return_to_proof_control') return 'return_to_proof_control';
  if (selfRegulation?.recommendedCoachMove) return selfRegulation.recommendedCoachMove;
  if (didactic?.recommendedMode) return didactic.recommendedMode;
  if (discursive?.mode && discursive.mode !== 'unknown') return discursive.mode;
  return 'default_proof_conduct';
}

function budgetFor(input, proofControl) {
  return (
    input.opportunityCostBudget ||
    input.discursive?.opportunityCostBudget ||
    input.didactic?.opportunityCostBudget ||
    input.selfRegulation?.opportunityCostBudget ||
    deriveOpportunityCostBudget({
      scope: input.scope || 'turn',
      proofCriticalReleasePending: proofControl.proofCritical || proofControl.action === 'release_next_evidence',
      repairPending: proofControl.action === 'repair_dependency',
      nearFinal: proofControl.action === 'invite_final_assertion',
      currentProofNeutralTutorTurns: input.currentProofNeutralTutorTurns,
      currentProofNeutralLearnerTurns: input.currentProofNeutralLearnerTurns,
    })
  );
}

export function arbitrateAdaptation(input = {}) {
  const proofControl = normalizeProofControlDecision(input.proofControl || {});
  const selectedConduct =
    input.discursive?.shouldAvoidIntervention && proofControl.action === 'no_proof_action'
      ? 'minimal_presence'
      : requestedConduct(input);
  const opportunityCostBudget = budgetFor(input, proofControl);
  const opportunityCostAudit = auditOpportunityCost(opportunityCostBudget, {
    actor: 'tutor',
    conduct: selectedConduct,
    proofNeutral: selectedConduct !== 'return_to_proof_control',
    pairedWithBindingProofAction: proofControl.action !== 'no_proof_action' && selectedConduct === 'minimal_presence',
  });
  const blockedActions = [];
  let finalConduct = selectedConduct;
  if (!opportunityCostAudit.ok && selectedConduct !== 'return_to_proof_control') {
    blockedActions.push(selectedConduct);
    finalConduct = opportunityCostAudit.actionOnBlocked;
  }

  const runtime = {
    schema: ADAPTATION_ARBITER_SCHEMA,
    proofAction: proofControl.action,
    proofTarget: proofControl.target,
    conduct: finalConduct,
    proofControlBinding: proofControl.action !== 'no_proof_action',
    conductAuthority: 'advisory',
    blockedActions,
  };
  const trace = {
    schema: ADAPTATION_TRACE_SCHEMA,
    turn: Number.isFinite(Number(input.turn)) ? Number(input.turn) : null,
    proofControl,
    publicEvidence: input.publicEvidence || null,
    ...(input.discursive ? { discursive: input.discursive } : {}),
    ...(input.didactic ? { didactic: input.didactic } : {}),
    ...(input.ownership ? { ownership: input.ownership } : {}),
    ...(input.uptake ? { uptake: input.uptake } : {}),
    ...(input.selfRegulation ? { selfRegulation: input.selfRegulation } : {}),
    selectedConduct: finalConduct,
    blockedActions,
    nonLeakAudit: auditPublicOnlyInput(input.publicEvidence || {}),
    opportunityCostAudit,
  };
  return {
    ...runtime,
    trace,
    overlays: overlayRows(input).map(([name, value]) => ({
      name,
      scope: value.scope || null,
      advisory: value.mayOverrideProofControl === false || value.publicOnly === true,
    })),
  };
}
