import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  auditTutorStubGenerousInferenceResponse,
  resolveTutorStubGenerousInference,
} from '../tutorStubGenerousInference.js';

describe('tutor-stub generous inference', () => {
  it('accepts an adjacent same-referent answer as a completed local move', () => {
    const resolution = resolveTutorStubGenerousInference({
      mode: 'defeasible_human_scaffold',
      learnerText: 'it will be the same',
      previousTutorText:
        'Exactly. The entry says one hand alone drew and worked that crucible. What does that make you think about who cast these blanks?',
      branchId: 'blank_chain',
      classification: {
        turn: { discourse_move: 'claim', evidence_use: 'none', epistemic_stance: 'confused' },
      },
    });

    assert.equal(resolution.applied, true);
    assert.equal(resolution.kind, 'contextual_same_referent');
    assert.equal(resolution.confidence, 'high');
    assert.match(resolution.tutorInstruction, /Do not ask the learner to restate/u);
  });

  it('does not compress a case-closing answer', () => {
    const resolution = resolveTutorStubGenerousInference({
      mode: 'defeasible_human_scaffold',
      learnerText: 'the same one',
      previousTutorText: 'The two trails meet in one hand. Who struck the false coins?',
      branchId: 'join',
    });

    assert.equal(resolution.applied, false);
    assert.equal(resolution.reason, 'case_closing_question_requires_explicit_grounding');
  });

  it('rejects same when the preceding question has no single referent', () => {
    const resolution = resolveTutorStubGenerousInference({
      mode: 'defeasible_human_scaffold',
      learnerText: 'the same',
      previousTutorText: 'Several hands used the mint. Who cast these blanks?',
      branchId: 'blank_chain',
    });

    assert.equal(resolution.applied, false);
    assert.equal(resolution.reason, 'no_single_public_referent_to_resolve_same');
  });

  it('flags the observed redundant follow-up question', () => {
    const resolution = resolveTutorStubGenerousInference({
      mode: 'defeasible_human_scaffold',
      learnerText: 'it will be the same',
      previousTutorText:
        'Exactly. The entry says one hand alone drew and worked that crucible. What does that make you think about who cast these blanks?',
      branchId: 'blank_chain',
    });
    const audit = auditTutorStubGenerousInferenceResponse({
      resolution,
      text: 'Right—the blank’s metal points to the one hand that alone worked that crucible. What does that license you to write about who cast the blanks?',
    });

    assert.equal(audit.ok, false);
    assert.equal(audit.issues[0].type, 'redundant_local_requestion');
  });

  it('allows the tutor to accept the step and advance', () => {
    const resolution = resolveTutorStubGenerousInference({
      mode: 'defeasible_human_scaffold',
      learnerText: 'it will be the same',
      previousTutorText:
        'Exactly. The entry says one hand alone drew and worked that crucible. What does that make you think about who cast these blanks?',
      branchId: 'blank_chain',
    });
    const audit = auditTutorStubGenerousInferenceResponse({
      resolution,
      text: 'Yes—that settles the blank’s origin for now. What does the flaw on the coin suggest about the tool that cut its die?',
    });

    assert.equal(audit.ok, true);
  });
});
