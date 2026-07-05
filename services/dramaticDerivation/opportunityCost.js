export const OPPORTUNITY_COST_SCHEMA = 'dramatic-derivation.opportunity-cost.v0';
export const OPPORTUNITY_COST_AUDIT_SCHEMA = 'dramatic-derivation.opportunity-cost-audit.v0';

const SCOPE_SET = new Set(['turn', 'dialogue_block', 'scene', 'act']);

const BUDGETS = Object.freeze({
  release_pending: Object.freeze({ tutor: 0, learner: 1 }),
  repair_pending: Object.freeze({ tutor: 1, learner: 1 }),
  no_proof_debt: Object.freeze({ tutor: 2, learner: 2 }),
  near_final: Object.freeze({ tutor: 0, learner: 0 }),
});

function clampCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function opportunityCostContext(input = {}) {
  if (input.nearFinal || input.context === 'near_final') return 'near_final';
  if (input.proofCriticalReleasePending || input.context === 'release_pending') return 'release_pending';
  if (input.repairPending || input.context === 'repair_pending') return 'repair_pending';
  return 'no_proof_debt';
}

export function deriveOpportunityCostBudget(input = {}) {
  const context = opportunityCostContext(input);
  const defaults = BUDGETS[context];
  const scope = SCOPE_SET.has(input.scope) ? input.scope : 'turn';
  const budget = {
    schema: OPPORTUNITY_COST_SCHEMA,
    publicOnly: true,
    scope,
    context,
    maxProofNeutralTutorTurns: Number.isInteger(input.maxProofNeutralTutorTurns)
      ? input.maxProofNeutralTutorTurns
      : defaults.tutor,
    maxProofNeutralLearnerTurns: Number.isInteger(input.maxProofNeutralLearnerTurns)
      ? input.maxProofNeutralLearnerTurns
      : defaults.learner,
    currentProofNeutralTutorTurns: clampCount(input.currentProofNeutralTutorTurns),
    currentProofNeutralLearnerTurns: clampCount(input.currentProofNeutralLearnerTurns),
    proofCriticalReleasePending: Boolean(input.proofCriticalReleasePending || context === 'release_pending'),
    decayHeadroomRisk: ['low', 'medium', 'high'].includes(input.decayHeadroomRisk)
      ? input.decayHeadroomRisk
      : context === 'release_pending' || context === 'near_final'
        ? 'high'
        : 'low',
    counterReset: ['on_proof_action', 'on_scene_exit', 'on_act_exit'].includes(input.counterReset)
      ? input.counterReset
      : scope === 'act'
        ? 'on_act_exit'
        : scope === 'scene'
          ? 'on_scene_exit'
          : 'on_proof_action',
    onBudgetExhausted: ['return_to_proof_control', 'mark_ownership_unproven', 'ask_single_exit_probe'].includes(
      input.onBudgetExhausted,
    )
      ? input.onBudgetExhausted
      : 'return_to_proof_control',
  };
  return budget;
}

export function isProofNeutralTutorMove(move = {}) {
  if (move.proofNeutral === false) return false;
  if (move.pairedWithBindingProofAction === true) return false;
  const conduct = typeof move === 'string' ? move : move.conduct || move.mode || move.recommendedMode || '';
  if (conduct === 'return_to_proof_control') return false;
  return true;
}

export function auditOpportunityCost(budget = {}, move = {}) {
  const normalized = budget.schema === OPPORTUNITY_COST_SCHEMA ? budget : deriveOpportunityCostBudget(budget);
  const actor = move.actor === 'learner' ? 'learner' : 'tutor';
  const proofNeutral = actor === 'tutor' ? isProofNeutralTutorMove(move) : move.proofNeutral !== false;
  const current =
    actor === 'tutor' ? normalized.currentProofNeutralTutorTurns : normalized.currentProofNeutralLearnerTurns;
  const max = actor === 'tutor' ? normalized.maxProofNeutralTutorTurns : normalized.maxProofNeutralLearnerTurns;
  const exhausted = proofNeutral && current >= max;
  const blocked =
    exhausted &&
    (normalized.proofCriticalReleasePending ||
      normalized.context === 'near_final' ||
      normalized.context === 'repair_pending');
  return {
    schema: OPPORTUNITY_COST_AUDIT_SCHEMA,
    ok: !blocked,
    blocked,
    actor,
    proofNeutral,
    current,
    max,
    context: normalized.context,
    actionOnBlocked: normalized.onBudgetExhausted,
    reason: blocked
      ? `${actor} proof-neutral budget exhausted for ${normalized.context}`
      : 'opportunity-cost budget permits move',
  };
}

export function nextOpportunityCostBudget(budget = {}, move = {}) {
  const normalized = budget.schema === OPPORTUNITY_COST_SCHEMA ? { ...budget } : deriveOpportunityCostBudget(budget);
  if (move.proofActionTaken || move.reset === 'on_proof_action') {
    normalized.currentProofNeutralTutorTurns = 0;
    normalized.currentProofNeutralLearnerTurns = 0;
    return normalized;
  }
  if (move.actor === 'learner') {
    normalized.currentProofNeutralLearnerTurns += move.proofNeutral === false ? 0 : 1;
  } else if (isProofNeutralTutorMove(move)) {
    normalized.currentProofNeutralTutorTurns += 1;
  }
  return normalized;
}
