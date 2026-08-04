import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditGroundingValidatorTrace,
  evaluateGroundingValidatorDecisions,
  extractGroundingEvidenceCitations,
  observableGroundingTerminalEvents,
  summarizeGroundingValidatorBranches,
} from '../services/adaptiveTutor/groundingValidatorAudit.js';

const evidence = (...ids) => ids.map((obs_id) => ({ obs_id, validated: true }));

const hypothesis = (overrides = {}) => ({
  hypothesis_id: 'hyp_known',
  claim: 'The learner is testing the claim.',
  confidence: 0.7,
  supporting_evidence: ['t0_0_aaaa1111', 't1_0_bbbb2222', 't2_0_cccc3333'],
  contradicting_evidence: [],
  status: 'tentative',
  created_at_turn: 0,
  expires_after_turns: 2,
  next_validation_action: '',
  ...overrides,
});

test('extractGroundingEvidenceCitations returns unique structured obs ids', () => {
  assert.deepEqual(extractGroundingEvidenceCitations('Use t0_0_aaaa1111 and t1_0_bbbb2222; repeat t0_0_aaaa1111.'), [
    't0_0_aaaa1111',
    't1_0_bbbb2222',
  ]);
});

test('grounding-validator audit preserves an applied, structurally grounded promotion', () => {
  const h = hypothesis();
  const result = evaluateGroundingValidatorDecisions({
    decisions: [
      {
        hypothesis_id: h.hypothesis_id,
        new_status: 'validated',
        reasoning: 'Supported by t0_0_aaaa1111, t1_0_bbbb2222, and t2_0_cccc3333.',
      },
    ],
    tentativeHypotheses: [h],
    validatedEvidence: evidence(...h.supporting_evidence),
    turn: 2,
  });

  assert.equal(result.appliedUpdates.length, 1);
  assert.equal(result.appliedUpdates[0].status, 'validated');
  assert.equal(result.auditEvents[0].payload.dropped_count, 0);
  assert.equal(result.auditEvents[1].payload.structurally_grounded, true);
});

test('grounding-validator audit makes an unknown-id silent drop observable', () => {
  const result = evaluateGroundingValidatorDecisions({
    decisions: [
      {
        hypothesis_id: 'hyp_hallucinated',
        new_status: 'validated',
        reasoning: 'Supported by t0_0_aaaa1111.',
      },
    ],
    tentativeHypotheses: [hypothesis()],
    validatedEvidence: evidence('t0_0_aaaa1111'),
    turn: 1,
  });

  assert.deepEqual(result.appliedUpdates, []);
  assert.equal(result.auditEvents[0].payload.dropped_count, 1);
  assert.equal(result.auditEvents[1].payload.applied, false);
  assert.equal(result.auditEvents[1].payload.drop_reason, 'unknown_hypothesis_id');
});

test('grounding-validator audit rejects reasoning-only and off-hypothesis evidence as grounded', () => {
  const h = hypothesis();
  const result = evaluateGroundingValidatorDecisions({
    decisions: [
      { hypothesis_id: h.hypothesis_id, new_status: 'validated', reasoning: 'High confidence.' },
      {
        hypothesis_id: h.hypothesis_id,
        new_status: 'validated',
        reasoning: 'Supported by t3_0_deadbeef.',
      },
    ],
    tentativeHypotheses: [h],
    validatedEvidence: evidence(...h.supporting_evidence, 't3_0_deadbeef'),
    turn: 3,
  });

  assert.equal(result.auditEvents[1].payload.structurally_grounded, false);
  assert.equal(result.auditEvents[1].payload.cited_evidence_ids.length, 0);
  assert.equal(result.auditEvents[2].payload.structurally_grounded, false);
  assert.deepEqual(result.auditEvents[2].payload.cited_outside_hypothesis_ids, ['t3_0_deadbeef']);
});

test('legacy end-of-turn traces expose grounded transitions but not validator attribution', () => {
  const h = hypothesis({ status: 'validated' });
  const branch = {
    perTurn: [
      {
        turn: 0,
        evidenceLog: evidence(...h.supporting_evidence),
        hypotheses: [h],
      },
    ],
  };

  const transitions = observableGroundingTerminalEvents(branch);
  assert.equal(transitions.length, 1);
  assert.equal(transitions[0].structurally_grounded_snapshot, true);
  assert.equal(transitions[0].attribution, 'unidentifiable_between_hypothesis_updater_and_grounding_validator');

  const audited = auditGroundingValidatorTrace({ original: branch }, { profileName: 'cell_127' });
  const summary = summarizeGroundingValidatorBranches(audited);
  assert.equal(summary.silent_drop_rate, null);
  assert.equal(summary.observed_terminal_event_grounding_rate, 1);
  assert.equal(summary.first_observed_terminal_appearances, 1);
  assert.equal(summary.within_trace_terminal_transitions, 0);
  assert.match(summary.legacy_identifiability, /unidentifiable/);
});

test('fully instrumented traces report exact silent-drop rate', () => {
  const h = hypothesis();
  const evaluated = evaluateGroundingValidatorDecisions({
    decisions: [
      {
        hypothesis_id: h.hypothesis_id,
        new_status: 'validated',
        reasoning: 't0_0_aaaa1111, t1_0_bbbb2222, t2_0_cccc3333',
      },
      { hypothesis_id: 'hyp_missing', new_status: 'validated', reasoning: 't0_0_aaaa1111' },
    ],
    tentativeHypotheses: [h],
    validatedEvidence: evidence(...h.supporting_evidence),
    turn: 2,
  });
  const trace = {
    original: {
      finalAdaptationTrace: evaluated.auditEvents,
      perTurn: [],
    },
  };
  const summary = summarizeGroundingValidatorBranches(auditGroundingValidatorTrace(trace));

  assert.equal(summary.raw_decisions_observed, 2);
  assert.equal(summary.dropped_decisions, 1);
  assert.equal(summary.silent_drop_rate, 0.5);
  assert.equal(summary.structurally_grounded_decisions, 1);
});
