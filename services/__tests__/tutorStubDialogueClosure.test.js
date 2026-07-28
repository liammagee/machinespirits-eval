import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  advanceTutorStubDialogueClosure,
  auditTutorStubDialogueClosureResponse,
  buildTutorStubDialogueClosureFrame,
  createTutorStubDialogueClosureLifecycle,
  deterministicTutorStubClosureResponse,
  tutorStubClosureAcknowledgement,
} from '../tutorStubDialogueClosure.js';

function completeTutorDag() {
  return { derivable: true, leavesReleased: 6, leavesTotal: 6 };
}

describe('tutor-stub dialogue closure', () => {
  it('makes strict grounded learner-DAG closure mandatory', () => {
    const lifecycle = createTutorStubDialogueClosureLifecycle({ enabled: true, allowCheckIn: true });
    const frame = buildTutorStubDialogueClosureFrame({
      lifecycle,
      learnerDagModel: { assessment: { finalSecretEntailed: true, assertedSecret: true } },
      tutorDagSnapshot: completeTutorDag(),
      answerTerm: 'Edony',
    });

    assert.equal(frame.mandatory, true);
    assert.equal(frame.phase, 'grounded_closing_invitation');
    assert.equal(frame.basis, 'strict_learner_dag_grounded_and_asserted');
  });

  it('offers conversational closure when the authored DAG is public without changing strict status', () => {
    const lifecycle = createTutorStubDialogueClosureLifecycle({
      enabled: true,
      allowCheckIn: true,
      allowAuthoredDagClosure: true,
    });
    const frame = buildTutorStubDialogueClosureFrame({
      lifecycle,
      learnerDagModel: { assessment: { finalSecretEntailed: false, assertedSecret: false } },
      tutorDagSnapshot: completeTutorDag(),
      answerTerm: 'Edony',
    });

    assert.equal(frame.available, true);
    assert.equal(frame.mandatory, false);
    assert.equal(frame.strictGrounded, false);
    assert.equal(frame.basis, 'authored_dag_fully_public');
  });

  it('rejects the observed verdict response because it never closes', () => {
    const frame = buildTutorStubDialogueClosureFrame({
      lifecycle: createTutorStubDialogueClosureLifecycle({
        enabled: true,
        allowCheckIn: true,
        allowAuthoredDagClosure: true,
      }),
      tutorDagSnapshot: completeTutorDag(),
      answerTerm: 'Edony',
    });
    const audit = auditTutorStubDialogueClosureResponse({
      frame,
      text: 'The verdict is now licensed: Edony struck the false shillings. The dross and die both point to her.',
    });

    assert.equal(audit.closesDialogue, true);
    assert.equal(audit.ok, false);
    assert.equal(audit.issues[0].type, 'missing_explicit_dialogue_close');
  });

  it('does not mistake a pending-verdict prompt for a declaration', () => {
    const frame = buildTutorStubDialogueClosureFrame({
      lifecycle: createTutorStubDialogueClosureLifecycle({
        enabled: true,
        allowCheckIn: true,
        allowAuthoredDagClosure: true,
      }),
      tutorDagSnapshot: completeTutorDag(),
      answerTerm: 'Edony',
    });
    const audit = auditTutorStubDialogueClosureResponse({
      frame,
      text: 'Before a verdict, what public link would connect the two hands?',
    });

    assert.equal(audit.ok, true);
    assert.equal(audit.closesDialogue, false);
  });

  // The showcase run of 2026-07-26 (riverside_clinic__instrumented) declared the
  // case closed at turn 5 while the lifecycle stayed open until turn 7, then said
  // it twice more. The audit passed all three without reading them.
  const RIVERSIDE_PREMATURE_CLOSE =
    'I mark the case closed: DUP-SWEEP-04 cancelled Noor’s appointment. The duplicate mark and its ' +
    '02:00 start made it eligible, and the 02:03 action ledger names it as the canceller.';

  function unearnedFrame() {
    return buildTutorStubDialogueClosureFrame({
      lifecycle: createTutorStubDialogueClosureLifecycle({ enabled: true }),
      learnerDagModel: { assessment: { finalSecretEntailed: true, assertedSecret: false } },
      tutorDagSnapshot: completeTutorDag(),
      answerTerm: 'DUP-SWEEP-04',
    });
  }

  it('rejects a close declared before the closure conditions are met', () => {
    const frame = unearnedFrame();
    assert.equal(frame.mandatory, false);
    assert.equal(frame.available, false);

    const audit = auditTutorStubDialogueClosureResponse({ frame, text: RIVERSIDE_PREMATURE_CLOSE });

    assert.equal(audit.ok, false);
    assert.equal(audit.closesDialogue, false);
    assert.equal(audit.issues[0].type, 'premature_dialogue_close');
    assert.deepEqual(audit.issues[0].matches, ['case closed']);
  });

  it('leaves an unearned turn alone when it only saybacks the answer term', () => {
    const audit = auditTutorStubDialogueClosureResponse({
      frame: unearnedFrame(),
      text:
        'So the 02:03 ledger entry names DUP-SWEEP-04 beside the cancellation, and Mara’s entry is a view. ' +
        'What would you say the ledger settles?',
    });

    assert.equal(audit.ok, true);
    assert.equal(audit.issues.length, 0);
  });

  it('does not raise a premature close once the lifecycle has already closed', () => {
    const frame = buildTutorStubDialogueClosureFrame({
      lifecycle: { ...createTutorStubDialogueClosureLifecycle({ enabled: true }), phase: 'closed' },
      learnerDagModel: { assessment: { finalSecretEntailed: true, assertedSecret: true } },
      tutorDagSnapshot: completeTutorDag(),
      answerTerm: 'DUP-SWEEP-04',
    });

    assert.equal(frame.phase, 'closed');
    const audit = auditTutorStubDialogueClosureResponse({ frame, text: RIVERSIDE_PREMATURE_CLOSE });
    assert.equal(audit.ok, true);
  });

  it('reads nothing when the closure guard is off', () => {
    const frame = buildTutorStubDialogueClosureFrame({
      lifecycle: createTutorStubDialogueClosureLifecycle({ enabled: false }),
      tutorDagSnapshot: completeTutorDag(),
      answerTerm: 'DUP-SWEEP-04',
    });

    const audit = auditTutorStubDialogueClosureResponse({ frame, text: RIVERSIDE_PREMATURE_CLOSE });
    assert.equal(audit.ok, true);
    assert.equal(audit.verdict, undefined);
  });

  it('rejects closure language while the strict learner DAG remains open', () => {
    const frame = buildTutorStubDialogueClosureFrame({
      lifecycle: createTutorStubDialogueClosureLifecycle({ enabled: true }),
      learnerDagModel: {
        assessment: {
          bottleneck: 'learner_integration_gap',
          finalSecretEntailed: false,
          assertedSecret: false,
          missingPremiseCount: 1,
        },
      },
      tutorDagSnapshot: completeTutorDag(),
      answerTerm: 'the bolted shutter',
    });
    const audit = auditTutorStubDialogueClosureResponse({
      frame,
      text: 'Warm launch, bolted shutter, and forced spiral — the full chain stands, and the case is closed.',
    });

    assert.equal(frame.available, false);
    assert.equal(frame.mandatory, false);
    assert.equal(audit.ok, false);
    assert.equal(audit.closesDialogue, false);
    assert.equal(audit.issues[0].type, 'premature_dialogue_close');
  });

  it('allows one optional check-in and then advances to awaiting_checkin', () => {
    const lifecycle = createTutorStubDialogueClosureLifecycle({
      enabled: true,
      allowCheckIn: true,
      allowAuthoredDagClosure: true,
    });
    const frame = buildTutorStubDialogueClosureFrame({
      lifecycle,
      tutorDagSnapshot: completeTutorDag(),
      answerTerm: 'Edony',
    });
    const audit = auditTutorStubDialogueClosureResponse({
      frame,
      text: 'Edony struck the shillings, so the case is closed. Before we close the book, is there one link you want to revisit?',
    });
    const next = advanceTutorStubDialogueClosure(lifecycle, { frame, audit, turn: 25 });

    assert.equal(audit.ok, true);
    assert.equal(audit.invitesCheckIn, true);
    assert.equal(next.phase, 'awaiting_checkin');
    assert.equal(next.reachedAtTurn, 25);
  });

  it('requires the check-in response to end without another question', () => {
    const lifecycle = {
      ...createTutorStubDialogueClosureLifecycle({ enabled: true, allowCheckIn: true }),
      phase: 'awaiting_checkin',
      reachedAtTurn: 25,
      basis: 'authored_dag_fully_public',
    };
    const frame = buildTutorStubDialogueClosureFrame({ lifecycle, answerTerm: 'Edony' });
    const good = auditTutorStubDialogueClosureResponse({
      frame,
      text: 'The record names Edony as the widow, so that identity link is public. The case is closed.',
    });
    const bad = auditTutorStubDialogueClosureResponse({
      frame,
      text: 'The record names Edony as the widow. The case is closed. Is anything else unclear?',
    });

    assert.equal(good.ok, true);
    assert.equal(bad.ok, false);
    assert.equal(bad.issues[0].type, 'closure_response_opens_another_turn');
  });

  it('recognizes acknowledgements and provides deterministic terminal speech', () => {
    assert.equal(tutorStubClosureAcknowledgement('no thanks'), true);
    assert.match(
      deterministicTutorStubClosureResponse({ phase: 'final_checkin_response', allowCheckIn: false }),
      /inquiry is complete/u,
    );
  });

  it('recognizes a plainly closed incident record but not a record left open', () => {
    const frame = buildTutorStubDialogueClosureFrame({
      lifecycle: createTutorStubDialogueClosureLifecycle({ enabled: true }),
      learnerDagModel: { assessment: { bottleneck: 'grounded_asserted_secret' } },
      answerTerm: 'Larkin',
    });
    const closed = auditTutorStubDialogueClosureResponse({
      frame,
      text: 'Larkin ruined the culture; the incident record is closed.',
    });
    const open = auditTutorStubDialogueClosureResponse({
      frame,
      text: 'Larkin remains a hypothesis; the incident record is still open.',
    });

    assert.equal(closed.ok, true);
    assert.equal(closed.closesDialogue, true);
    assert.equal(open.ok, false);
    assert.equal(open.verdict.explicitClosure, false);
  });

  it('realizes a closure-compatible selected performance without reopening the case', () => {
    const response = deterministicTutorStubClosureResponse(
      { phase: 'grounded_closing_invitation', allowCheckIn: false },
      {
        responseConfiguration: {
          actorial_part: 'foreperson',
          actorial_performance: { id: 'evidentiary_boundary' },
        },
      },
    );

    assert.match(response, /establishes this finding, and no more/iu);
    assert.match(response, /close the public record/iu);
    assert.doesNotMatch(response, /\?/u);
  });
});
