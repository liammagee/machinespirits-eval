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
