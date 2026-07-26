import assert from 'node:assert/strict';
import test from 'node:test';

import { createTutorStubComprehensionState } from '../services/tutorStubComprehensionState.js';
import {
  TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA,
  buildTutorStubLearningSummary,
  tutorStubDialogueCaseStatus,
  tutorStubLearningSummaryEndReason,
} from '../services/tutorStubLearningSummary.js';

function comprehensionFixture() {
  return createTutorStubComprehensionState({
    terms: [
      { key: 'blank', term: 'blank', status: 'explained' },
      { key: 'cupel', term: 'cupel', status: 'unresolved' },
    ],
  });
}

function turnFixture({
  turn,
  learner,
  tutor,
  grounded,
  voicedDerived,
  coverage,
  authorship,
  assessment = {},
  classification = {},
  learnerAdvance = null,
  proofDebt = null,
}) {
  return {
    turn,
    turnId: `summary-turn-${turn}`,
    learner,
    tutor,
    learnerResponseProvenance: { authorship, inputMethod: authorship === 'human' ? 'terminal' : 'generated' },
    classification,
    learnerAdvance,
    humanDiscourseFrame: proofDebt ? { proofDebt } : null,
    tutorLearnerDagModel: {
      learnerRecord: { grounded, voicedDerived },
      assessment: { bestPathCoverage: coverage, ...assessment },
      metrics: { missingPremiseCount: assessment.missingPremiseCount ?? 0 },
    },
  };
}

test('learning summary projection preserves public evidence, movement, provenance, and next-step priority', () => {
  const state = {
    debugRunId: 'summary-run',
    topic: 'coin evidence',
    world: {
      id: 'light-shillings',
      title: 'The Light Shillings',
      question: 'Whose hand struck the false shillings?',
      discipline: 'historical reasoning',
    },
    comprehension: comprehensionFixture(),
    releasePacing: null,
    trainingReuse: { status: 'training_candidate', requested: 'auto' },
    turns: [
      turnFixture({
        turn: 1,
        learner: 'The residue points to a crucible.',
        tutor: 'Which crucible matches it?',
        grounded: [{ surface: 'The residue is distinctive.' }],
        voicedDerived: [{ text: 'The residue can identify a crucible.' }],
        coverage: 0.25,
        authorship: 'human',
        classification: { turn: { summary: 'The learner proposed a comparison.' } },
      }),
      turnFixture({
        turn: 2,
        learner: 'The mint crucible bears the same residue.',
        tutor: 'Who had sole access to it?',
        grounded: [
          { surface: 'The residue is distinctive.' },
          { text: 'The mint crucible bears the same residue.' },
          { text: 'the MINT crucible bears the same residue.' },
        ],
        voicedDerived: [
          { text: 'The residue can identify a crucible.' },
          { surface: 'That crucible narrows the possible maker.' },
        ],
        coverage: 0.75,
        authorship: 'ai',
        assessment: {
          finalSecretEntailed: true,
          assertedSecret: false,
          bottleneck: 'grounded_unasserted_secret',
        },
        classification: {
          turn: { summary: 'The learner connected residue to the mint crucible.' },
          overall: {
            summary: 'The learner moved from comparison to attribution.',
            trajectory: 'Evidence became progressively more specific.',
          },
        },
        learnerAdvance: {
          accelerated: true,
          supportedMoveCount: 3,
          adoptedPremiseCount: 2,
          derivedFactCount: 1,
        },
        proofDebt: { counts: { open: 1 } },
      }),
    ],
  };

  const summary = buildTutorStubLearningSummary(state, {
    reason: 'report',
    generatedAt: '2026-07-25T00:00:00.000Z',
    trace: 'dialogue-logs/summary-run.json',
  });

  assert.equal(summary.schema, TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA);
  assert.equal(summary.generatedAt, '2026-07-25T00:00:00.000Z');
  assert.equal(summary.trace, 'dialogue-logs/summary-run.json');
  assert.deepEqual(summary.world, state.world);
  assert.deepEqual(summary.evidenceHeld, ['The residue is distinctive.', 'The mint crucible bears the same residue.']);
  assert.deepEqual(summary.reasoningVoiced, [
    'The residue can identify a crucible.',
    'That crucible narrows the possible maker.',
  ]);
  assert.deepEqual(
    summary.journey.map((row) => row.newEvidence),
    [['The residue is distinctive.'], ['The mint crucible bears the same residue.']],
  );
  assert.deepEqual(
    summary.journey.map((row) => row.newReasoning),
    [['The residue can identify a crucible.'], ['That crucible narrows the possible maker.']],
  );
  assert.deepEqual(summary.learnerResponseProvenance.counts, { human: 1, ai: 1, hybrid: 0, unknown: 0 });
  assert.deepEqual(summary.comprehension, { explainedTerms: ['blank'], unresolvedTerms: ['cupel'] });
  assert.deepEqual(summary.openQuestions, [
    'Clarify the remaining terms: cupel.',
    'The public evidence supports a verdict, but it has not yet been stated in the learner’s own words.',
    'At least one compressed reasoning step still needs an explicit public warrant.',
  ]);
  assert.equal(summary.nextStep, 'Resolve cupel first, then return to the evidence it affects.');
  assert.equal(summary.progress.acceleratedTurnCount, 1);
  assert.equal(summary.progress.maxSupportedMoves, 3);
  assert.equal(summary.completion.natural, false);
  assert.equal(summary.completion.plainReason, 'You requested a summary at this point.');
});

test('learning summary projection falls back to grounded public learner speech when no derived record exists', () => {
  const groundedTurn = turnFixture({
    turn: 1,
    learner: '  I would compare   the residue first.  ',
    tutor: 'Good. What would that comparison establish?',
    grounded: [],
    voicedDerived: [],
    coverage: null,
    authorship: 'human',
    classification: {
      turn: { evidence_use: 'direct', epistemic_stance: 'grounded', summary: 'A grounded proposal.' },
      overall: { next_best_tutor_move: '  Ask for the warrant   linking the comparison to attribution. ' },
    },
  });
  const summary = buildTutorStubLearningSummary(
    { turns: [groundedTurn], comprehension: createTutorStubComprehensionState(), releasePacing: null },
    { generatedAt: 'fixed', reason: 'once' },
  );

  assert.deepEqual(summary.reasoningVoiced, ['I would compare the residue first.']);
  assert.equal(summary.nextStep, 'Ask for the warrant linking the comparison to attribution.');
  assert.equal(summary.completion.plainReason, 'The requested single turn is complete.');
  assert.deepEqual(summary.openQuestions, [
    'The inquiry ended before a natural close, so the current conclusion remains provisional.',
  ]);
});

test('learning summary status and end-reason helpers cover grounded, check-in, and unknown stops', () => {
  assert.equal(
    tutorStubDialogueCaseStatus({
      tutorLearnerDagModel: { assessment: { finalSecretEntailed: true, assertedSecret: true } },
    }),
    'The learner reached and stated a conclusion supported by the public evidence.',
  );
  assert.equal(
    tutorStubDialogueCaseStatus({ dialogueClosure: { lifecycle: { phase: 'awaiting_checkin' } } }),
    'The conclusion has been stated; one optional final check-in remains.',
  );
  assert.equal(
    tutorStubDialogueCaseStatus({
      tutorLearnerDagModel: {
        assessment: { bottleneck: 'warrant_gap' },
        metrics: { missingPremiseCount: 2 },
      },
    }),
    '2 evidence steps remain. Next need: the learner needs a clearer reasoning link.',
  );
  // An assertion gap reads two ways, and the summary is the one place a person
  // sees it. `secretStatedVia` is what separates them: the learner who derived
  // the conclusion aloud and never claimed it is not the learner who never got
  // there, and reporting both as "has not fully stated it" loses that.
  assert.equal(
    tutorStubDialogueCaseStatus({
      tutorLearnerDagModel: {
        assessment: { finalSecretEntailed: true, assertedSecret: false, secretStatedVia: 'voiced_derivation' },
      },
    }),
    'The learner reached the conclusion and said it in passing, but never claimed it as the answer.',
  );
  assert.equal(
    tutorStubDialogueCaseStatus({
      tutorLearnerDagModel: {
        assessment: { finalSecretEntailed: true, assertedSecret: false, secretStatedVia: null },
      },
    }),
    'The evidence supports the conclusion, but the learner has not fully stated it.',
  );
  assert.equal(tutorStubLearningSummaryEndReason('custom_pause', false), 'The session ended at custom pause.');
  assert.equal(
    tutorStubLearningSummaryEndReason('exit', true),
    'The inquiry reached its natural conclusion on the public evidence.',
  );
});
