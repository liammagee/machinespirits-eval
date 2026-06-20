// Shared world-adaptation-spec fixture for the adaptive-tutor tests. A well-formed,
// hash-bearing locked spec (module AF6): request_evidence is allowed/preferred, and the
// proof-supply families are disallowed. Imported by adaptation-policy and
// adaptation-closed-loop tests so the lock fixture lives in one place.
export const WORLD_SPEC = {
  id: 'W_AF6_CURRICULUM',
  version: 'ms-world-adaptation-v0.1',
  source_curriculum_id: 'ai_foundations_v1',
  module_id: 'AF6',
  spec_hash: 'sha256:test',
  action_policy: {
    allowed_action_families: ['request_evidence'],
    preferred_action_families: ['request_evidence'],
    disallowed_action_families: ['diagnose_with_discriminating_question', 'model_worked_example'],
  },
  expected_transitions: [
    {
      action_type: 'request_evidence',
      success_evidence: ['learner-authored rationale'],
      failure_evidence: ['mere agreement'],
      world_success_observables: ['Learner checks the model-performance claim against the metric table.'],
    },
  ],
  forbidden_moves: [
    { id: 'no_hidden_label_exposure', move: 'hidden_label_exposure' },
    { id: 'no_premature_proof_supply', move: 'supply_decisive_step' },
  ],
};
