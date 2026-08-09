import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTutorStubGuardFindingsFeedForward,
  summarizeTutorStubGuardFindingRecurrence,
} from '../services/tutorStubGuardFindingsFeedForward.js';
import { buildGuardFindingsFeedForwardPlan } from '../scripts/run-guard-findings-feed-forward.js';
import { createTutorStubTutorTurnPreparation } from '../services/tutorStubTutorTurnPreparation.js';
import { tutorStubGuardDispositionCatalog } from '../services/tutorStubGuardDisposition.js';

function turn(number, { advisory = [], hard = [], reportOnly = [] } = {}) {
  return {
    tutorTurn: number,
    tutorGuardAccounting: {
      finalDelivery: {
        audits: {
          deliveryDecision: {
            boundaryPolicy: 'shadow_advisory',
            catalogVersion: 7,
            advisoryIssues: advisory,
            hardIssues: hard,
            reportOnlyIssues: reportOnly,
          },
        },
      },
    },
  };
}

test('feed-forward is inert when disabled and never projects hard or report-only findings', () => {
  const envelope = buildTutorStubGuardFindingsFeedForward({
    enabled: false,
    previousTurn: turn(2, {
      advisory: [{ guard: 'repetition', type: 'tutor_turn_without_advance', reason: 'raw audit prose' }],
      hard: [{ guard: 'leak', type: 'future_fact', premiseId: 'secret-4' }],
      reportOnly: [{ guard: 'response_configuration', type: 'axis_not_visible', axis: 'action_family' }],
    }),
  });

  assert.equal(envelope.enabled, false);
  assert.equal(envelope.applied, false);
  assert.equal(envelope.prompt, null);
  assert.equal(envelope.eligibleFindingCount, 1);
  assert.deepEqual(
    envelope.findings.map((row) => `${row.guard}:${row.type}`),
    ['repetition:tutor_turn_without_advance'],
  );
  assert.doesNotMatch(JSON.stringify(envelope), /secret-4|raw audit prose|future_fact/u);
});

test('feed-forward projects each distinct effective advisory as public-safe prospective guidance', () => {
  const envelope = buildTutorStubGuardFindingsFeedForward({
    enabled: true,
    previousTurn: turn(4, {
      advisory: [
        { guard: 'response_composition', type: 'missing_learner_uptake', reason: 'hidden raw reason' },
        { guard: 'response_composition', type: 'missing_learner_uptake', reason: 'duplicate' },
        { guard: 'response_configuration', type: 'axis_not_visible', axis: 'lexical_accessibility' },
      ],
    }),
  });

  assert.equal(envelope.applied, true);
  assert.equal(envelope.sourceTurn, 4);
  assert.equal(envelope.sourcePolicy, 'shadow_advisory');
  assert.equal(envelope.sourceCatalogVersion, 7);
  assert.equal(envelope.eligibleFindingCount, 2);
  assert.equal(envelope.projectedFindingCount, 2);
  assert.equal(envelope.omittedFindingCount, 0);
  assert.match(envelope.prompt, /Respond to one specific idea or concern/u);
  assert.match(envelope.prompt, /selected level of language accessibility/u);
  assert.match(envelope.prompt, /Current public evidence and the current turn contract take priority/u);
  assert.doesNotMatch(envelope.prompt, /response_composition|axis_not_visible|hidden raw reason|duplicate/u);
});

test('every advisory in the current shadow catalog has prospective guidance', () => {
  const advisoryIssues = tutorStubGuardDispositionCatalog()
    .filter((rule) => rule.shadow === 'advisory')
    .map((rule) => ({
      guard: rule.guard,
      type: rule.type,
      ...(rule.type === 'axis_not_visible' ? { axis: 'action_family' } : {}),
    }));
  const envelope = buildTutorStubGuardFindingsFeedForward({
    enabled: true,
    previousTurn: turn(2, { advisory: advisoryIssues }),
  });

  assert.equal(envelope.eligibleFindingCount, advisoryIssues.length);
  assert.equal(envelope.projectedFindingCount, advisoryIssues.length);
  assert.equal(envelope.omittedFindingCount, 0);
});

test('recurrence summary compares the same finding on consecutive delivered turns', () => {
  const summary = summarizeTutorStubGuardFindingRecurrence([
    turn(1, {
      advisory: [
        { guard: 'repetition', type: 'tutor_turn_without_advance' },
        { guard: 'response_configuration', type: 'axis_not_visible', axis: 'action_family' },
      ],
    }),
    turn(2, {
      advisory: [
        { guard: 'repetition', type: 'tutor_turn_without_advance' },
        { guard: 'response_composition', type: 'missing_learner_uptake' },
      ],
    }),
    turn(3),
  ]);

  assert.equal(summary.eligible, 4);
  assert.equal(summary.repeated, 1);
  assert.equal(summary.cleared, 3);
  assert.equal(summary.recurrenceRate, 0.25);
});

test('pilot plan freezes paired treatment and control cells on Luna with one attempt per job', () => {
  const plan = buildGuardFindingsFeedForwardPlan({
    sourceSha: 'a'.repeat(40),
    outputDir: new URL('../exports/tutor-stub-guard-feed-forward/test-plan', import.meta.url).pathname,
  });

  assert.equal(plan.jobs.length, 12);
  assert.equal(plan.attemptsPerJob, 1);
  assert.equal(plan.maxModelCalls, 720);
  assert.equal(plan.routing.allModelBackedRoles, 'codex.gpt-5.6-luna');
  assert.equal(plan.routing.committee, false);
  assert.equal(new Set(plan.jobs.map((job) => job.id)).size, 12);
  for (const pairId of new Set(plan.jobs.map((job) => job.pairId))) {
    const pair = plan.jobs.filter((job) => job.pairId === pairId);
    assert.deepEqual(pair.map((job) => job.arm).sort(), ['control', 'feed_forward']);
    assert.equal(pair[0].repeat, pair[1].repeat);
    assert.ok(pair.every((job) => job.argv.includes('--no-committee')));
    assert.ok(pair.some((job) => job.argv.includes('--guard-findings-feed-forward')));
    assert.ok(pair.some((job) => job.argv.includes('--no-guard-findings-feed-forward')));
  }
});

test('turn preparation places prior advisory guidance in the next private speaking prompt and trace', () => {
  const trace = [];
  const prepare = createTutorStubTutorTurnPreparation({
    appendTraceEvent: (_target, event) => trace.push(event),
    auditTutorStubSpeakerPrivilege: () => ({ ok: true, issues: [] }),
    buildTutorStubDramaticReleaseFrame: () => ({ active: false, entries: [] }),
    buildTutorStubFirstDraftContract: () => null,
    buildTutorStubGuardFindingsFeedForward,
    buildTutorStubResponseCompositionFrame: () => ({ active: false }),
    classifierTutorContext: () => '',
    committedReleaseRows: () => [],
    compileTutorStubPerformanceObligationContract: () => null,
    currentReleaseRows: () => [],
    dagTurnContext: () => '',
    emptyPlanAdvisory: '',
    humanDiscourseTutorContext: () => '',
    reconcileTutorStubPointOfActionHandoffEligibility: (value) => value,
    recoverTutorStubSpeakerPrompt: () => assert.fail('recovery should not run'),
    resolveTutorStubPublicCounterpressure: () => null,
    sanitizeTutorStubSpeakerAdvisory: ({ text }) => text,
    snapshotTutorStubPublicPremiseIds: () => new Set(),
    tutorCoachGuidanceContext: () => '',
    tutorLearnerDagModelContext: () => '',
    tutorMessageContext: () => ({ messages: [], replayedMessageCount: 2 }),
    tutorStubComprehensionPrompt: () => '',
    tutorStubDirectorGuidancePrompt: () => '',
    tutorStubFirstDraftContractPrompt: () => '',
    tutorStubPointOfActionPrompt: () => '',
    tutorStubTuningTurnAdvisory: () => '',
    tutorStubTurnFeedbackPrompt: () => '',
  });
  const state = {
    world: {},
    pointOfAction: { current: null },
    turns: [
      turn(1, {
        advisory: [{ guard: 'repetition', type: 'tutor_turn_without_advance' }],
      }),
    ],
  };

  const prepared = prepare({
    classification: null,
    dag: null,
    dialogueClosureFrame: null,
    feedbackAdaptationPlan: null,
    guardFindingsFeedForward: true,
    history: [{ role: 'assistant', content: 'Earlier reply.' }],
    humanDiscourseFrame: null,
    learnerMessages: ['Can we move on?'],
    learnerText: 'Can we move on?',
    passthrough: false,
    registerSelection: null,
    state,
    systemPrompt: 'Public-safe system prompt.',
    trace,
    tutorFeedback: null,
    tutorLearnerDagModel: null,
    world: {},
  });

  assert.equal(prepared.guardFindingsFeedForwardEnvelope.applied, true);
  assert.match(prepared.effectiveSpeakerUserPrompt, /Make one visible advance beyond the ground already covered/u);
  assert.match(prepared.effectiveSpeakerUserPrompt, /Learner says:\nCan we move on\?/u);
  const event = trace.find((row) => row.type === 'tutor_guard_findings_feed_forward');
  assert.equal(event.envelope.sourceTurn, 1);
  assert.equal(event.publicTranscriptChanged, false);
});
