import { deterministicChoice } from './deterministicExperimentSampler.js';
import { assignPedagogicalActionSelection } from './adaptiveTutor/actionPolicy.js';
import { tutorStubMoveFamilyForAction } from './adaptiveTutor/tutorStubActionAdapter.js';

export const TUTOR_STUB_TYPED_ACTION_ASSIGNMENT_MODES = Object.freeze(['policy', 'uniform_family_eligible']);

export function normalizeTutorStubTypedActionAssignmentMode(value) {
  const mode = String(value || 'policy')
    .trim()
    .toLowerCase();
  if (!TUTOR_STUB_TYPED_ACTION_ASSIGNMENT_MODES.includes(mode)) {
    throw new Error(`--typed-action-assignment must be ${TUTOR_STUB_TYPED_ACTION_ASSIGNMENT_MODES.join(' or ')}`);
  }
  return mode;
}

export function assignTutorStubTypedAction({ mode = 'policy', selection, selectionInput, samplingContext } = {}) {
  const normalizedMode = normalizeTutorStubTypedActionAssignmentMode(mode);
  const baselineActionType = selection?.selectedAction?.action_type || null;
  if (normalizedMode === 'policy') {
    return {
      selection,
      probability: 1,
      audit: {
        mode: normalizedMode,
        disposition: 'policy_selected',
        baseline_action_type: baselineActionType,
        selected_action_type: baselineActionType,
        draw: null,
      },
    };
  }
  if (selection?.selectionAuthority?.assignable !== true) {
    return {
      selection,
      probability: 1,
      audit: {
        mode: normalizedMode,
        disposition: 'mandatory_policy_authority_preserved',
        baseline_action_type: baselineActionType,
        selected_action_type: baselineActionType,
        authority: selection?.selectionAuthority || null,
        draw: null,
      },
    };
  }
  const candidates = selection.candidateActions || [];
  if (!candidates.length) throw new Error('uniform eligible assignment requires at least one policy candidate');
  const context = samplingContext || {};
  const byFamily = new Map();
  for (const candidate of candidates) {
    const family = tutorStubMoveFamilyForAction(candidate.action_type);
    if (!byFamily.has(family)) byFamily.set(family, []);
    byFamily.get(family).push(candidate.action_type);
  }
  const material = {
    profile: context.profile,
    policy: 'typed_action_uniform_family_eligible',
    repeat: context.repeat,
    learnerTurn: context.learnerTurn,
    jobId: context.jobId || null,
  };
  const familyDraw = deterministicChoice(
    [...byFamily.keys()].map((family) => ({ value: family, weight: 1 })),
    {
      masterSeed: context.runSeed,
      material: {
        ...material,
        decisionKind: 'typed_action_family_assignment',
      },
    },
  );
  const selectedFamily = familyDraw.selectedValue;
  const actionDraw = deterministicChoice(
    byFamily.get(selectedFamily).map((actionType) => ({ value: actionType, weight: 1 })),
    {
      masterSeed: context.runSeed,
      material: {
        ...material,
        decisionKind: 'typed_action_within_family_assignment',
        selectedFamily,
      },
    },
  );
  const selectedActionType = actionDraw.selectedValue;
  const assigned = assignPedagogicalActionSelection({
    selection,
    actionType: selectedActionType,
    stateBelief: selectionInput.stateBelief,
    config: selectionInput.config,
  });
  return {
    selection: assigned,
    probability:
      familyDraw.distribution[familyDraw.selectedIndex].probability *
      actionDraw.distribution[actionDraw.selectedIndex].probability,
    familyProbability: familyDraw.distribution[familyDraw.selectedIndex].probability,
    audit: {
      mode: normalizedMode,
      disposition: 'seeded_uniform_family_assignment',
      baseline_action_type: baselineActionType,
      selected_action_type: selectedActionType,
      selected_move_family: selectedFamily,
      eligible_action_types: candidates.map((candidate) => candidate.action_type),
      eligible_move_families: [...byFamily].map(([family, actionTypes]) => ({ family, action_types: actionTypes })),
      selected_family_probability: familyDraw.distribution[familyDraw.selectedIndex].probability,
      selected_action_within_family_probability: actionDraw.distribution[actionDraw.selectedIndex].probability,
      family_draw: familyDraw,
      action_draw: actionDraw,
    },
  };
}
