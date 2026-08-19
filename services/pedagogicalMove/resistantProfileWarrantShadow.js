import { createPedagogicalMove } from './contract.js';
import { observeResistantLearnerTurn } from '../resistantLearnerObservation.js';
import { observeResistantLearnerAxes } from '../resistantLearnerAxisObservation.js';

export const RESISTANT_PROFILE_WARRANT_SCHEMA = 'machinespirits.resistant-profile-move-warrant.v1';
export const RESISTANT_PROFILE_MOVE_SHADOW_SCHEMA = 'machinespirits.resistant-profile-move-shadow.v1';
export const RESISTANT_AXIS_WARRANT_SCHEMA = 'machinespirits.resistant-axis-move-warrant.v1';
export const RESISTANT_AXIS_MOVE_SHADOW_SCHEMA = 'machinespirits.resistant-axis-move-shadow.v1';

export const RESISTANT_PROFILE_MOVE_CONTRACTS = Object.freeze({
  bored: Object.freeze({
    observation_type: 'bored_effort_withholding',
    primary_move_type: 'ask_discriminating_question',
    target: Object.freeze({
      kind: 'adjacent_concrete_hook',
      reference: null,
      axes: Object.freeze(['public_effort', 'thread_pickup', 'learner_authorship']),
    }),
    expected_uptake: Object.freeze({
      required_signals: Object.freeze(['content_bearing_answer_to_one_adjacent_concrete_question']),
      forbidden_signals: Object.freeze(['permission_seeking', 'mere_assent_without_thread_pickup']),
      match: 'any',
      deadline_turns: 1,
    }),
    forbidden_move_types: Object.freeze(['state_outcome_and_close_inquiry', 'model_complete_worked_example']),
    expected_state_delta: Object.freeze({ public_effort: 0.25, thread_pickup: 0.25 }),
  }),
  frame_defiant: Object.freeze({
    observation_type: 'frame_jurisdiction_dispute',
    primary_move_type: 'test_bounded_distinction',
    target: Object.freeze({
      kind: 'disputed_inquiry_frame',
      reference: null,
      axes: Object.freeze(['frame_consent', 'local_claim_merits', 'refusal_rights']),
    }),
    expected_uptake: Object.freeze({
      required_signals: Object.freeze(['engages_local_test_on_its_merits', 'restates_frame_dispute_more_precisely']),
      forbidden_signals: Object.freeze(['mere_compliance', 'escalation_without_a_public_issue']),
      match: 'any',
      deadline_turns: 2,
    }),
    forbidden_move_types: Object.freeze([
      'acknowledge_affect_and_redirect',
      'challenge_to_agentive_evidence_move',
      'explain_governing_principle',
    ]),
    expected_state_delta: Object.freeze({ on_merits_engagement: 0.2, frame_dispute_precision: 0.2 }),
  }),
  frame_refuser: Object.freeze({
    observation_type: 'frame_jurisdiction_refusal',
    primary_move_type: 'test_bounded_distinction',
    target: Object.freeze({
      kind: 'refused_inquiry_frame',
      reference: null,
      axes: Object.freeze(['frame_consent', 'local_claim_merits', 'refusal_rights']),
    }),
    expected_uptake: Object.freeze({
      required_signals: Object.freeze(['engages_local_test_on_its_merits', 'restates_frame_dispute_more_precisely']),
      forbidden_signals: Object.freeze(['mere_compliance', 'escalation_without_a_public_issue']),
      match: 'any',
      deadline_turns: 2,
    }),
    forbidden_move_types: Object.freeze([
      'acknowledge_affect_and_redirect',
      'challenge_to_agentive_evidence_move',
      'explain_governing_principle',
    ]),
    expected_state_delta: Object.freeze({ on_merits_engagement: 0.2, frame_dispute_precision: 0.2 }),
  }),
});

function warrant(profileId, contract, observationResult) {
  const matches = observationResult.observations.filter((row) => row.type === contract.observation_type);
  const licensed = matches.length === 1 && observationResult.ambiguous === false;
  return {
    schema: RESISTANT_PROFILE_WARRANT_SCHEMA,
    status: licensed ? 'licensed' : 'not_licensed',
    profile_id: profileId,
    required_observation_type: contract.observation_type,
    basis: licensed ? matches[0] : null,
    defeated_candidates: observationResult.defeated,
    ambiguity_blocks_license: observationResult.ambiguous,
    primary_move_type: licensed ? contract.primary_move_type : null,
    forbidden_move_types: licensed ? [...contract.forbidden_move_types] : [],
  };
}

function projectMove(
  profileId,
  contract,
  moveWarrant,
  {
    sourceSchema = RESISTANT_PROFILE_WARRANT_SCHEMA,
    mappingVersion = RESISTANT_PROFILE_MOVE_SHADOW_SCHEMA,
    host = 'resistant_learner_profile_shadow',
  } = {},
) {
  if (moveWarrant.status !== 'licensed') return null;
  return createPedagogicalMove({
    moveType: contract.primary_move_type,
    target: structuredClone(contract.target),
    expectedUptake: structuredClone(contract.expected_uptake),
    constraints: {
      required_moves: [],
      forbidden_moves: [...contract.forbidden_move_types],
    },
    transitionContract: {
      expected_state_delta: { ...contract.expected_state_delta },
      lifecycle: { success: null, defeat: null, expiry: null },
      terminal: false,
    },
    responsibilityOwner: 'shared',
    compatibility: { action_type: null, action_family: null },
    provenance: {
      host,
      source_action: profileId,
      source_schema: sourceSchema,
      source_version: '1.0',
      mapping_version: mappingVersion,
    },
  });
}

export function createResistantProfileMoveShadow({ profileId, learnerText = '', classification = null } = {}) {
  const contract = RESISTANT_PROFILE_MOVE_CONTRACTS[profileId];
  if (!contract) throw new Error(`resistantProfileMoveShadow: unsupported profile ${JSON.stringify(profileId)}`);
  const observation = observeResistantLearnerTurn({ learnerText, classification });
  const moveWarrant = warrant(profileId, contract, observation);
  return {
    schema: RESISTANT_PROFILE_MOVE_SHADOW_SCHEMA,
    authority: 'design_shadow',
    runtime_selection_authorized: false,
    consumer_switch_authorized: false,
    profile_id: profileId,
    observation,
    warrant: moveWarrant,
    projected_move: projectMove(profileId, contract, moveWarrant),
  };
}

const RESISTANT_AXIS_CANDIDATES = Object.freeze([
  Object.freeze({
    resistance_kind: 'bored',
    axis: 'effort_investment',
    observed_state: 'withheld',
  }),
  Object.freeze({
    resistance_kind: 'frame_defiant',
    axis: 'frame_legitimacy',
    observed_state: 'jurisdiction_disputed',
  }),
]);

/**
 * Project the held-out public resistance axes into the same design-only move
 * contracts without consulting learner profile identity. Multiple matching
 * axes fail closed: a compound signal needs an explicit precedence ruling,
 * not an accidental first-match decision.
 */
export function createResistantAxisMoveShadow({ learnerText = '', classification = null } = {}) {
  const observation = observeResistantLearnerAxes({ learnerText, classification });
  const candidates = RESISTANT_AXIS_CANDIDATES.filter(
    (candidate) => observation.axes[candidate.axis]?.state === candidate.observed_state,
  );
  const licensedCandidate = candidates.length === 1 ? candidates[0] : null;
  const resistanceKind = licensedCandidate?.resistance_kind || null;
  const contract = resistanceKind ? RESISTANT_PROFILE_MOVE_CONTRACTS[resistanceKind] : null;
  const basis = licensedCandidate
    ? {
        axis: licensedCandidate.axis,
        observed_state: licensedCandidate.observed_state,
        evidence_span: observation.axes[licensedCandidate.axis]?.evidence_span || null,
      }
    : null;
  const moveWarrant = {
    schema: RESISTANT_AXIS_WARRANT_SCHEMA,
    status: licensedCandidate ? 'licensed' : 'not_licensed',
    resistance_kind: resistanceKind,
    basis,
    ambiguity_blocks_license: candidates.length > 1,
    candidate_axes: candidates.map(({ resistance_kind, axis, observed_state }) => ({
      resistance_kind,
      axis,
      observed_state,
    })),
    primary_move_type: contract?.primary_move_type || null,
    forbidden_move_types: contract ? [...contract.forbidden_move_types] : [],
  };

  return {
    schema: RESISTANT_AXIS_MOVE_SHADOW_SCHEMA,
    authority: 'design_shadow',
    runtime_selection_authorized: false,
    consumer_switch_authorized: false,
    profile_identity_used: false,
    resistance_kind: resistanceKind,
    observation,
    warrant: moveWarrant,
    projected_move: contract
      ? projectMove(resistanceKind, contract, moveWarrant, {
          sourceSchema: RESISTANT_AXIS_WARRANT_SCHEMA,
          mappingVersion: RESISTANT_AXIS_MOVE_SHADOW_SCHEMA,
          host: 'resistant_learner_axis_shadow',
        })
      : null,
  };
}
