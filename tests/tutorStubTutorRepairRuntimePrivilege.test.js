import assert from 'node:assert/strict';
import test from 'node:test';

import { createTutorStubTutorRepairRuntime } from '../services/tutorStubTutorRepairRuntime.js';
import { createTutorStubRecoveryAccountingRuntime } from '../services/tutorStubRecoveryAccountingRuntime.js';
import { tutorStubSimplifiedRecoveryPrompt } from '../services/tutorStubGuardRecovery.js';
import { tutorStubGuardIssueRows } from '../services/tutorStubGuardDisposition.js';
import { projectTutorStubGuardAttemptEnvelope } from '../services/tutorStubGuardAttemptProjection.js';
import { auditTutorStubSpeakerPrivilege, sanitizeTutorStubSpeakerAdvisory } from '../services/tutorStubPromptAudit.js';

// World 102, board_blind-r1, turn 3, 2026-09-05: the first draft failed the
// source-alignment check, the recovery prompt carried the planner's learner
// move line with the premise id in it, and the privilege audit failed the
// whole dialogue. The world here keeps only the fields the two audits read.
const WORLD = {
  secret: {
    surface: 'The archivist cleared the shelf.',
    recognition_surfaces: [],
    fact: ['clearedShelf', 'archivist'],
  },
  mirror: null,
  rules: [{ id: 'R1_clear' }],
  premises: [
    {
      id: 'p_noon',
      surface: 'The badge log has Felix in the records room at 12:02.',
      recognition_surfaces: [],
      fact: ['badgedIntoKitchen', 'felix', 'closingWindow'],
    },
    {
      id: 'p_crew',
      surface: 'One more badge in the closing window: a visitor code, WF-11.',
      recognition_surfaces: [],
      fact: ['visitorBadge', 'crew', 'closingWindow'],
    },
  ],
  releaseSchedule: [
    { premise: 'p_noon', turn: 2 },
    { premise: 'p_crew', turn: 3 },
  ],
};

const FIRST_DRAFT_CONTRACT = {
  schema: 'machinespirits.tutor-stub.first-draft-turn-contract.v1',
  learner_move: 'Learner correctly limits p_noon to presence only, then asks whether to state this or defer to tutor.',
  development: {
    instruction: 'Put the next available public evidence into the scene before asking the learner to interpret it.',
  },
  evidence: { cues: [] },
  progression: { handoff_contract: { question_allowed: true } },
};

const HARD_ISSUE = {
  guard: 'live_source_action_alignment_v1',
  type: 'due_source_exact_occurrence_count',
  reason:
    'the live response must contain the host-rendered source once, word for word; only quotation marks may differ',
};

class RecoveryReached extends Error {}

async function captureRecoveryCall() {
  const accounting = createTutorStubRecoveryAccountingRuntime({
    TUTOR_GUARD_ACCOUNTING_SCHEMA: 'test',
    appendTraceEvent() {},
    jsonClone: (value) => structuredClone(value),
    projectTutorStubGuardAttemptEnvelope,
    tutorStubGuardIssueRows,
  });
  const captured = [];
  const runTutorRepairLadder = createTutorStubTutorRepairRuntime({
    appendTraceEvent() {},
    attachTutorGuardAccounting: ({ response }) => response,
    buildTutorStubSimplifiedRecoveryConfiguration: () => ({ actorial_part: 'record_keeper' }),
    dagTurnContext: () => '',
    deterministicTutorStubLearnerUptake: () => 'Yes.',
    deterministicTutorStubTurnProgressionUptake: () => 'Yes.',
    exactTutorRepairSpans: () => [],
    repairTutorStubMissingActorialPart: () => ({ changed: false }),
    sanitizeTutorStubSpeakerAdvisory,
    stateRunDebugId: () => 'test',
    tutorGuardAttemptEnvelope: (row) => row,
    tutorResponseRecoveryPrompt: accounting.tutorResponseRecoveryPrompt,
    tutorStubGuardIssueRows,
    tutorStubSimplifiedRecoveryPrompt,
  });
  const audits = {
    deliveryDecision: { hardIssues: [HARD_ISSUE] },
    liveSourceActionAlignmentAudit: { ok: false, issues: [HARD_ISSUE] },
  };
  await assert.rejects(
    runTutorRepairLadder({
      response: { text: 'The rejected draft.' },
      audits,
      attempts: [{ guardedSpans: [] }],
      repairsApplied: [],
      auditTutorDraft: () => audits,
      attachTutorDraftAudits() {},
      withTutorDeliveryDecision: (value) => value,
      preservableTutorUptake: () => 'You read the badge entry as presence only, and that is right.',
      tutorResponseFromSimplifiedRecovery: (value) => value,
      invokeTutorAttempt: async (call) => {
        captured.push(call);
        throw new RecoveryReached('recovery reached');
      },
      roleBase: 'tutor_stub_tutor',
      state: null,
      trace: [],
      tutorTurn: 3,
      guards: [],
      canStreamTutor: false,
      learnerText: 'The badge shows he was there. It does not say he could clear the shelf.',
      learnerRequestedPlainStyle: false,
      classification: null,
      responseCompositionFrame: {},
      recentTutorTexts: [],
      world: WORLD,
      speakingResponseConfiguration: {},
      firstDraftContract: FIRST_DRAFT_CONTRACT,
      dialogueClosureFrame: null,
      dag: true,
      instructionalMetaRepair: false,
      tutorLearnerDagModel: null,
      firstDraftHumanDiscourseAdvisory: null,
      instructionalMetaRestatementAdvisory: null,
      comprehensionAdvisory: null,
      directorGuidanceAdvisory: null,
      coachAdvisory: null,
      tutorFeedbackAdvisory: null,
      learnerPrompt: 'Learner: The badge shows he was there.',
      systemPrompt: 'You are the tutor in a public scene.',
      dramaticReleaseFrame: null,
    }),
    RecoveryReached,
  );
  assert.equal(captured.length, 1);
  return captured[0];
}

test('the unsanitised minimal recovery contract carries the planner premise id', () => {
  const raw = tutorStubSimplifiedRecoveryPrompt({
    configuration: { actorial_part: 'record_keeper' },
    firstDraftContract: FIRST_DRAFT_CONTRACT,
  });
  assert.match(raw, /p_noon/u);
  const audit = auditTutorStubSpeakerPrivilege({ world: WORLD, tutorTurn: 3, privateAdvisory: raw });
  assert.equal(audit.ok, false);
  assert.deepEqual(
    audit.issues.map((issue) => `${issue.code}:${issue.needle}`),
    ['private_premise_id:p_noon'],
  );
});

test('the recovery call hands the privilege audit an advisory with no premise id', async () => {
  const call = await captureRecoveryCall();
  assert.equal(call.role, 'tutor_stub_tutor_recovery');
  assert.equal(call.repairAttempt, 1);
  for (const text of [call.privilegeAdvisoryOverride, call.attemptUserPrompt]) {
    assert.doesNotMatch(text, /p_noon|p_crew|R1_clear/u);
    assert.match(text, /limits the relevant public evidence item to presence only/u);
  }
  const audit = auditTutorStubSpeakerPrivilege({
    world: WORLD,
    tutorTurn: 3,
    systemPrompt: call.systemPromptOverride,
    privateAdvisory: call.privilegeAdvisoryOverride,
  });
  assert.deepEqual(audit.issues, []);
  assert.equal(audit.ok, true);
});
