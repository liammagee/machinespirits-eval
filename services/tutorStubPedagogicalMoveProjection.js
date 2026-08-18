/**
 * Shadow-only projection from tutor-stub's expected-uptake action-family
 * contracts into the neutral PedagogicalMove boundary.
 *
 * The explicit table prevents a broad family label from silently becoming the
 * shared move type. The existing warrant decision and response configuration
 * remain authoritative.
 */

import {
  ADAPTIVE_WARRANT_ACTION_CONTRACT_SCHEMA,
  ADAPTIVE_WARRANT_ACTION_FAMILY_CONTRACTS,
  getAdaptiveWarrantActionContract,
} from './adaptiveWarrantActionContracts.js';
import { createPedagogicalMove } from './pedagogicalMove/contract.js';

export const TUTOR_STUB_PEDAGOGICAL_MOVE_MAPPING_VERSION = 'machinespirits.tutor-stub.pedagogical-move-projection.v1';

export const TUTOR_STUB_ACTION_FAMILY_TO_PEDAGOGICAL_MOVE = Object.freeze({
  clarify_term: 'clarify_public_term',
  repair_explanation: 'restate_explanation_plainly',
  clarify_distinction: 'test_bounded_distinction',
  stage_next_step: 'stage_public_evidence_for_next_step',
  answer_accountably: 'answer_specific_public_request',
  compress_sayback: 'request_compressed_sayback',
  reanchor_lived_stake: 'reconnect_inquiry_to_lived_stake',
  reanchor_public_evidence: 'restage_public_evidence',
  ground_in_material: 'direct_attention_to_named_material',
  challenge_resistance: 'challenge_to_agentive_evidence_move',
  receive_vulnerability: 'receive_vulnerability_without_seizing_control',
  close_inquiry: 'state_outcome_and_close_inquiry',
  baseline_plain_response: 'respond_plainly_without_policy_intervention',
});

export function projectTutorStubActionFamilyToPedagogicalMove({
  actionFamily,
  target = { kind: 'public_dialogue_object', reference: null, axes: [] },
  requiredMoves = [],
  forbiddenMoves = [],
  responsibilityOwner = null,
} = {}) {
  const contract = getAdaptiveWarrantActionContract(actionFamily);
  if (!contract) {
    throw new Error(`tutorStubPedagogicalMoveProjection: unknown action family ${JSON.stringify(actionFamily)}`);
  }
  const moveType = TUTOR_STUB_ACTION_FAMILY_TO_PEDAGOGICAL_MOVE[actionFamily];
  if (!moveType) {
    throw new Error(`tutorStubPedagogicalMoveProjection: unmapped action family ${JSON.stringify(actionFamily)}`);
  }
  return createPedagogicalMove({
    moveType,
    target,
    expectedUptake: {
      required_signals: [...contract.expected_learner_responses],
      forbidden_signals: [],
      match: contract.expected_response_match,
      deadline_turns: contract.deadline_turns,
    },
    constraints: {
      required_moves: [...requiredMoves],
      forbidden_moves: [...forbiddenMoves],
    },
    transitionContract: {
      expected_state_delta: {},
      lifecycle: {
        success: contract.success_transition,
        defeat: contract.defeat_transition,
        expiry: contract.expiry_transition,
      },
      terminal: contract.terminal,
    },
    responsibilityOwner,
    compatibility: {
      action_type: null,
      action_family: actionFamily,
    },
    provenance: {
      host: 'tutor_stub',
      source_action: actionFamily,
      source_schema: ADAPTIVE_WARRANT_ACTION_CONTRACT_SCHEMA,
      source_version: null,
      mapping_version: TUTOR_STUB_PEDAGOGICAL_MOVE_MAPPING_VERSION,
    },
  });
}

export function assertTutorStubPedagogicalMoveMappingComplete() {
  const sourceFamilies = Object.keys(ADAPTIVE_WARRANT_ACTION_FAMILY_CONTRACTS).sort();
  const mappedFamilies = Object.keys(TUTOR_STUB_ACTION_FAMILY_TO_PEDAGOGICAL_MOVE).sort();
  if (JSON.stringify(sourceFamilies) !== JSON.stringify(mappedFamilies)) {
    throw new Error('tutorStubPedagogicalMoveProjection: mapping must cover the exact action-family catalogue');
  }
  return true;
}
