import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_RESISTANCE_FIDELITY_MODEL_SCHEMA_V8,
  TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_MODEL_SCHEMA_V8,
  buildTutorStubResistanceMeasurementZeroCallFixtureV8,
} from '../services/tutorStubResistanceRecoverySemanticAdjudicationV8.js';
import { createTutorStubResistanceConfirmationSemanticRuntime } from '../services/tutorStubResistanceConfirmationSemanticRuntime.js';
import { loadTutorStubResistanceActionRegisterConfirmation } from '../services/tutorStubResistanceActionRegisterConfirmation.js';
import { buildTutorStubResistanceSemanticZeroCallFixtureResponseV3 } from '../services/tutorStubResistanceSemanticAdjudicationV3.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V4,
  createTutorStubResistanceSemanticRuntime,
  loadTutorStubResistanceSemanticRegistration,
  validateTutorStubResistanceSemanticRuntimeResult,
} from '../services/tutorStubResistanceSemanticRuntime.js';
import { loadTutorStubResistanceSemanticValidationV4 } from '../services/tutorStubResistanceSemanticValidationV4.js';
import {
  hashPaidStudyEndpointValue,
  validatePaidStudyEndpointGoCertificate,
} from '../services/paidStudyEndpointPreflight.js';
import {
  analyzeTutorStubResistanceActionRegisterConfirmationTrace,
  tutorStubResistanceActionRegisterConfirmationFisherGate,
} from '../scripts/analyze-tutor-stub-resistance-action-register-confirmation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION = 'config/tutor-stub-resistance-action-register-crossed-registration.v9.json';
const ENDPOINT = 'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v9.json';
const CERTIFICATE =
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v9.endpoint-go.json';
const V8_CORPUS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v2.json'), 'utf8'),
);

function adaptV8Case(row, caseId) {
  return {
    ...row,
    case_id: caseId,
    expected: {
      primary: {
        bounded_test_merits_engagement: row.expected.judgment.bounded_test_merits_engagement,
        grounded_precise_jurisdictional_condition: row.expected.judgment.grounded_precise_jurisdictional_condition,
        final_recovery: row.expected.judgment.final_recovery,
      },
      primary_evidence: row.expected.evidence.filter((quote) =>
        ['bounded_test_merits_engagement', 'grounded_precise_jurisdictional_condition'].includes(quote.field),
      ),
      fidelity: {
        delivered_clarify_distinction: row.expected.judgment.delivered_clarify_distinction,
        delivered_register: row.expected.judgment.delivered_register,
      },
      fidelity_evidence: row.expected.evidence.filter((quote) =>
        ['delivered_clarify_distinction', 'delivered_register'].includes(quote.field),
      ),
    },
  };
}

function v8RuntimeFixture({ exhaustJudgeIds = [] } = {}) {
  const loaded = loadTutorStubResistanceActionRegisterConfirmation({ registrationPath: REGISTRATION });
  const job = loaded.plan.jobs[0];
  const source = V8_CORPUS.cases.find(
    (row) =>
      row.expected.judgment.final_recovery === 'yes' &&
      row.expected.judgment.delivered_clarify_distinction === 'yes' &&
      row.expected.judgment.delivered_register === job.treatment.realization &&
      row.expected.evidence
        .filter((quote) =>
          ['bounded_test_merits_engagement', 'grounded_precise_jurisdictional_condition'].includes(quote.field),
        )
        .every((quote) => quote.source_id !== 'trigger'),
  );
  assert.ok(source);
  const corpusCase = adaptV8Case(source, job.id);
  const events = [];
  const prompts = [];
  const judges = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, loaded.registration.outcomeSemanticAdjudication.instrumentRegistrationPath),
      'utf8',
    ),
  ).measurement.judges;
  const runtime = createTutorStubResistanceConfirmationSemanticRuntime({
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
    async callPromptModel(request) {
      prompts.push(JSON.parse(request.prompt));
      const instrument = request.role.includes('_primary_recovery_') ? 'primary_recovery' : 'intervention_fidelity';
      const judge = judges.find((candidate) => request.role.endsWith(`_${candidate.id}`));
      assert.ok(judge);
      assert.deepEqual(request.semanticRetryDelaysMs, [15000, 45000]);
      if (exhaustJudgeIds.includes(judge.id)) throw new Error('zero-call response-free fixture');
      const fixture = buildTutorStubResistanceMeasurementZeroCallFixtureV8({ corpusCase, judge, instrument });
      return {
        text: JSON.stringify({
          schema:
            instrument === 'primary_recovery'
              ? TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_MODEL_SCHEMA_V8
              : TUTOR_STUB_RESISTANCE_FIDELITY_MODEL_SCHEMA_V8,
          case_id: job.id,
          judgment: fixture.response.judgment,
        }),
        provider: judge.provider,
        model: judge.model,
        effort: judge.effort,
        structuredOutput: true,
        prohibitedToolEventCount: 0,
        prohibitedToolEventCountObserved: true,
        modelAttestationBasis: judge.modelAttestationBasis,
        modelIndependentlyAttested: false,
      };
    },
    resolveModel(modelRef) {
      const judge = judges.find((candidate) => candidate.modelRef === modelRef);
      assert.ok(judge);
      return { provider: judge.provider, model: judge.model };
    },
  });
  const state = {
    trace: null,
    interim: null,
    resistanceActionRegisterStudy: {
      registration: loaded.registration,
      dynamic_confirmation: true,
      job_id: job.id,
      trigger_turn: 1,
    },
    turns: [
      { turn: 1, learner: corpusCase.trigger, tutor: corpusCase.intervention },
      { turn: 2, learner: corpusCase.prior_post_trigger, tutor: corpusCase.intervening_tutor },
    ],
  };
  return { corpusCase, events, job, loaded, prompts, runtime, state };
}

async function v4TriggerFixture() {
  const validation = loadTutorStubResistanceSemanticValidationV4();
  const binding = loadTutorStubResistanceSemanticRegistration(TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V4);
  const corpusCase = validation.corpus.cases[0];
  const events = [];
  const runtime = createTutorStubResistanceSemanticRuntime({
    registrationBinding: binding,
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
    async callPromptModel(request) {
      const prompt = JSON.parse(request.prompt);
      const judge = binding.registration.measurement.judges.find((candidate) =>
        request.role.endsWith(`_${candidate.id}`),
      );
      const fixture = buildTutorStubResistanceSemanticZeroCallFixtureResponseV3({
        corpusCase: { ...corpusCase, case_id: prompt.case_id },
        judge,
      });
      return {
        text: JSON.stringify(fixture.modelOutput),
        provider: judge.provider,
        model: judge.model,
        effort: judge.effort,
        structuredOutput: true,
        prohibitedToolEventCount: 0,
        prohibitedToolEventCountObserved: true,
        modelAttestationBasis: judge.modelAttestationBasis,
        modelIndependentlyAttested: false,
      };
    },
    resolveModel(modelRef) {
      const judge = binding.registration.measurement.judges.find((candidate) => candidate.modelRef === modelRef);
      return { provider: judge.provider, model: judge.model };
    },
  });
  const result = await runtime.adjudicateCandidate({
    state: {
      trace: null,
      interim: null,
      history: corpusCase.public_context.map((row) => ({
        role: row.role === 'assistant' ? 'assistant' : 'user',
        content: row.text,
      })),
    },
    learnerText: corpusCase.source,
    turnNumber: 1,
  });
  return { binding, corpusCase, events, result };
}

function attemptEvents(role, turn, provider, model) {
  return [
    { type: 'model_call_budget_reserved', role, turn, provider, model },
    { type: 'model_call', role, turn, provider, model, response: { effort: 'low' } },
  ];
}

test('V9 freezes 36 wholly fresh balanced dialogues and the 123/492/4428 operational safeguards', () => {
  const loaded = loadTutorStubResistanceActionRegisterConfirmation({ registrationPath: REGISTRATION });
  assert.equal(loaded.plan.jobs.length, 36);
  assert.equal(new Set(loaded.plan.jobs.map((job) => job.run_seed)).size, 36);
  assert.equal(loaded.plan.jobs.filter((job) => job.treatment.realization === 'plain').length, 18);
  assert.equal(loaded.plan.jobs.filter((job) => job.treatment.realization === 'warm').length, 18);
  assert.ok(loaded.plan.jobs.every((job) => job.id.startsWith('frame_refuser-confirmation-v5-')));
  assert.equal(loaded.registration.executionReadiness.maximumModelAttemptReservationsPerDialogue, 123);
  assert.ok(
    loaded.registration.executionReadiness.batches.every(
      (batch) => batch.dialogues === 4 && batch.maximumModelAttemptReservations === 492,
    ),
  );
  assert.equal(loaded.registration.executionReadiness.combinedMaximumModelAttemptReservations, 4428);
  assert.deepEqual(loaded.registration.executionReadiness.programmeLedgerAfterMaximum, {
    role: 'conservative_operational_maximum_after_confirmation',
    reservedAttempts: 8182,
    ceiling: 10000,
    remaining: 1818,
  });
});

test('V9 endpoint and certificate pass zero-call semantic-panel readiness', async () => {
  const loaded = loadTutorStubResistanceActionRegisterConfirmation({ registrationPath: REGISTRATION });
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, ENDPOINT), 'utf8'));
  const certificate = JSON.parse(fs.readFileSync(path.join(ROOT, CERTIFICATE), 'utf8'));
  const { runTutorStubResistanceActionRegisterConfirmationPreflight } =
    await import('../services/tutorStubResistanceActionRegisterConfirmation.js');
  const preflight = runTutorStubResistanceActionRegisterConfirmationPreflight({
    contract,
    registration: loaded.registration,
  });
  const validation = validatePaidStudyEndpointGoCertificate({ certificate, contract, preflight });
  assert.equal(preflight.status, 'passed');
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(certificate.contract_sha256, hashPaidStudyEndpointValue(contract));
  assert.equal(validation.ok, true, validation.errors.join('; '));
  assert.equal(contract.channels.deterministic_resistance_recovery, undefined);
  assert.equal(contract.channels.independent_recovery_semantic_panel.enabled, true);
  assert.equal(contract.channels.independent_outcome_blind_fidelity_panel.enabled, true);
});

test('V4 production wrapper validates a determinate three-judge trigger result', async () => {
  const validation = loadTutorStubResistanceSemanticValidationV4();
  const binding = loadTutorStubResistanceSemanticRegistration(TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V4);
  const corpusCase = validation.corpus.cases[0];
  const events = [];
  const runtime = createTutorStubResistanceSemanticRuntime({
    registrationBinding: binding,
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
    async callPromptModel(request) {
      const prompt = JSON.parse(request.prompt);
      const judge = binding.registration.measurement.judges.find((candidate) =>
        request.role.endsWith(`_${candidate.id}`),
      );
      const fixture = buildTutorStubResistanceSemanticZeroCallFixtureResponseV3({
        corpusCase: { ...corpusCase, case_id: prompt.case_id },
        judge,
      });
      return {
        text: JSON.stringify(fixture.modelOutput),
        provider: judge.provider,
        model: judge.model,
        effort: judge.effort,
        structuredOutput: true,
        prohibitedToolEventCount: 0,
        prohibitedToolEventCountObserved: true,
        modelAttestationBasis: judge.modelAttestationBasis,
        modelIndependentlyAttested: false,
      };
    },
    resolveModel(modelRef) {
      const judge = binding.registration.measurement.judges.find((candidate) => candidate.modelRef === modelRef);
      return { provider: judge.provider, model: judge.model };
    },
  });
  const result = await runtime.adjudicateCandidate({
    state: {
      trace: null,
      interim: null,
      history: corpusCase.public_context.map((row) => ({
        role: row.role === 'assistant' ? 'assistant' : 'user',
        content: row.text,
      })),
    },
    learnerText: corpusCase.source,
    turnNumber: 1,
  });
  const checked = validateTutorStubResistanceSemanticRuntimeResult({
    result,
    learnerText: corpusCase.source,
    turnNumber: 1,
    registrationBinding: binding,
    expectedPublicContext: corpusCase.public_context,
  });
  assert.equal(result.judgeRecordCount, 3);
  assert.equal(result.aggregate.final_label, 'frame_refuser');
  assert.equal(checked.valid, true, checked.issues.join('; '));
  assert.equal(events.filter((event) => event.type === 'resistance_semantic_judge_result').length, 3);
});

test('V9 outcome runtime uses separate blinded panels and returns their determinate semantic measurements', async () => {
  const fixture = v8RuntimeFixture();
  const result = await fixture.runtime.adjudicateFinalHorizon({
    state: fixture.state,
    turnNumber: 3,
    learnerText: fixture.corpusCase.current_learner,
  });
  assert.equal(result.measurement_disposition, 'determinate');
  assert.equal(result.primary.final_recovery, 'yes');
  assert.equal(result.fidelity.action_measurement.value, 'yes');
  assert.equal(result.fidelity.register_measurement.value, fixture.job.treatment.realization);
  assert.equal(result.regex_keyword_learner_classifier_or_generator_authority, 'none');
  assert.equal(
    fixture.events.filter((event) => event.type === 'resistance_confirmation_semantic_judge_result').length,
    6,
  );
  const fidelityPrompts = fixture.prompts.filter((prompt) => prompt.instrument === 'intervention_fidelity');
  assert.equal(fidelityPrompts.length, 3);
  assert.ok(fidelityPrompts.every((prompt) => Object.keys(prompt.public_packet).join(',') === 'intervention'));
  assert.equal(JSON.stringify(fidelityPrompts).includes(fixture.corpusCase.current_learner), false);
});

test('V9 outcome abstentions become measurement indeterminate without repair, rerun, replacement, or selection', async () => {
  const fixture = v8RuntimeFixture({
    exhaustJudgeIds: ['recovery_semantic_judge_b', 'recovery_semantic_judge_c'],
  });
  const result = await fixture.runtime.adjudicateFinalHorizon({
    state: fixture.state,
    turnNumber: 3,
    learnerText: fixture.corpusCase.current_learner,
  });
  assert.equal(result.measurement_disposition, 'measurement_indeterminate');
  assert.equal(result.primary.status, 'measurement_indeterminate');
  assert.equal(result.primary.final_recovery, 'indeterminate');
  assert.equal(result.repair_rerun_replacement_or_selection_allowed, false);
  assert.equal(
    fixture.events.filter((event) => event.type === 'resistance_confirmation_semantic_judge_result').length,
    6,
  );
  assert.equal(
    fixture.events.filter((event) => event.type === 'resistance_confirmation_semantic_adjudication').length,
    1,
  );
});

test('V9 withholds the whole Fisher analysis when any semantic measurement is indeterminate', () => {
  const gate = tutorStubResistanceActionRegisterConfirmationFisherGate([
    { case_id: 'determinate-a', measurement_disposition: 'determinate' },
    { case_id: 'indeterminate-b', measurement_disposition: 'measurement_indeterminate' },
  ]);
  assert.deepEqual(gate, {
    execute: false,
    indeterminate_case_ids: ['indeterminate-b'],
    rerun_repair_replacement_or_selection_allowed: false,
  });
});

test('V9 trace analysis accepts semantic positives even when the advisory typed audit says invisible', async (t) => {
  const outcomeFixture = v8RuntimeFixture();
  const triggerFixture = await v4TriggerFixture();
  outcomeFixture.corpusCase.trigger = triggerFixture.corpusCase.source;
  outcomeFixture.state.turns[0].learner = triggerFixture.corpusCase.source;
  const semanticOutcome = await outcomeFixture.runtime.adjudicateFinalHorizon({
    state: outcomeFixture.state,
    turnNumber: 3,
    learnerText: outcomeFixture.corpusCase.current_learner,
  });
  const { job, loaded } = outcomeFixture;
  const sourceCommit = 'a'.repeat(40);
  const triggerSha = crypto.createHash('sha256').update(triggerFixture.corpusCase.source).digest('hex');
  const coreAttempts = [
    ...attemptEvents('tutor_stub_opening', 0, 'codex', 'gpt-5.6-luna'),
    ...[1, 2, 3].flatMap((turn) => attemptEvents('tutor_stub_auto_learner', turn, 'codex', 'gpt-5.6-luna')),
    ...[1, 2, 3].flatMap((turn) => attemptEvents('tutor_stub_learner_analysis', turn, 'codex', 'gpt-5.6-luna')),
    ...[1, 2].flatMap((turn) => attemptEvents('tutor_stub_tutor', turn, 'codex', 'gpt-5.6-luna')),
  ];
  const semanticAttempts = [...triggerFixture.events, ...outcomeFixture.events]
    .filter((event) =>
      ['resistance_semantic_judge_result', 'resistance_confirmation_semantic_judge_result'].includes(event.type),
    )
    .flatMap((event) => attemptEvents(event.role, Number(event.turn), event.expectedProvider, event.expectedModel));
  const triggerRecord = {
    turn: 1,
    learner: triggerFixture.corpusCase.source,
    tutor: outcomeFixture.corpusCase.intervention,
    classification: { turn: { request_type: 'authority_refusal_or_status_challenge' } },
    tutorLearnerDagModel: { turn: 1, metrics: { missingPremiseCount: 6, groundedCount: 4 } },
    learnerResponseProvenance: {
      automation: { resistanceSemanticAdjudication: triggerFixture.result },
    },
    responseConfigurationAudit: {
      axes: {
        action_family: { selected: 'clarify_distinction', visible: false },
        engagement_stance: { selected: 'neither', visible: false },
      },
    },
  };
  const postRecord = {
    turn: 2,
    learner: outcomeFixture.corpusCase.prior_post_trigger,
    tutor: outcomeFixture.corpusCase.intervening_tutor,
    classification: { turn: { request_type: 'bounded_test_response' } },
    tutorLearnerDagModel: { turn: 2, metrics: { missingPremiseCount: 5, groundedCount: 5 } },
  };
  const events = [
    {
      type: 'run_start',
      metadata: {
        provenance: { git: { sha: sourceCommit, dirty: false } },
        lab: { admission: { modelCallBudget: 123 } },
        experiment: {
          runSeed: job.run_seed,
          profile: 'frame_refuser',
          policy: 'field',
          repeat: job.assignment_index,
          jobId: job.id,
        },
        autoLearner: {
          observationSemantics: loaded.registration.design.trigger.observationSemantics,
          maxTurns: 4,
          profileId: 'frame_refuser',
          modelRef: 'codex.gpt-5.6-luna',
        },
        sessionRecipe: {
          schema: 'machinespirits.tutor-stub.session-recipe.v1',
          config: {
            identity: {
              world: { id: 'world_005_marrick' },
              models: Object.fromEntries(
                ['classifier', 'learner', 'reasoning', 'tutor'].map((role) => [
                  role,
                  { provider: 'codex', model: 'gpt-5.6-luna' },
                ]),
              ),
            },
            options: {
              'cli-effort': 'low',
              'run-seed': String(job.run_seed),
              'auto-turns': '4',
              'model-call-budget': '123',
              'dag-mode': 'strict_dag',
              'register-policy': 'field',
              'register-palette': 'plain,warm',
              'eval-repeat': String(job.assignment_index),
              'eval-job-id': job.id,
            },
          },
        },
      },
    },
    {
      type: 'resistance_action_register_confirmation_execution_start',
      jobId: job.id,
      batchId: job.block_id,
      assignmentIndex: job.assignment_index,
      runSeed: job.run_seed,
      registrationSha256: loaded.sha256,
      freshIndependentDialogue: true,
      calibrationDialogueReused: false,
    },
    ...coreAttempts,
    ...semanticAttempts,
    ...triggerFixture.events,
    ...outcomeFixture.events,
    { type: 'turn_complete', turn: 1, turnRecord: triggerRecord },
    { type: 'turn_complete', turn: 2, turnRecord: postRecord },
    {
      type: 'resistance_action_register_intervention_applied',
      turn: 1,
      triggerTurn: 1,
      triggerLearnerSha256: triggerSha,
      intervention: {
        status: 'applied',
        assignment: {
          action_fit: 'matched',
          pedagogical_move: 'test_bounded_distinction',
          realization: job.treatment.realization,
          register: job.treatment.register,
          repeat: job.block_id,
          batch_id: job.block_id,
        },
        safety_override: {
          applied: false,
          reason: null,
          assigned_register: job.treatment.register,
          delivered_register: job.treatment.register,
        },
      },
    },
    {
      type: 'resistance_action_register_outcome_learner_turn',
      turn: 3,
      triggerTurn: 1,
      triggerLearnerSha256: triggerSha,
      learnerText: outcomeFixture.corpusCase.current_learner,
      classification: { turn: { request_type: 'bounded_test_response' } },
      tutorLearnerDag: { model: { metrics: { missingPremiseCount: 4, groundedCount: 6 } } },
      resistanceConfirmationSemanticOutcome: semanticOutcome,
      tutorReplyGenerated: false,
    },
  ];
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'v9-confirmation-trace-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const tracePath = path.join(temporary, 'trace.jsonl');
  const traceSource = `${events.map((event) => JSON.stringify(event)).join('\n')}\n`;
  fs.writeFileSync(tracePath, traceSource);
  const resultRow = {
    job_id: job.id,
    trace: path.relative(ROOT, tracePath),
    trace_sha256: crypto.createHash('sha256').update(traceSource).digest('hex'),
  };
  const row = analyzeTutorStubResistanceActionRegisterConfirmationTrace(
    {
      plan: { source: { commit: sourceCommit } },
      planJobs: new Map([[job.id, job]]),
      recoveredIds: new Set(),
      reservationsByJob: new Map([
        [job.id, events.filter((event) => event.type === 'model_call_budget_reserved').length],
      ]),
      finalTraceBudgetByJob: new Map([[job.id, 123]]),
    },
    resultRow,
    loaded,
  );
  assert.equal(row.outcome.recovered, true);
  assert.equal(row.outcome.authority, 'v8_three_judge_primary_recovery_panel');
  assert.equal(row.fidelity.action_visible, true);
  assert.equal(row.fidelity.register_visible, true);
  assert.equal(row.measurement_disposition, 'determinate');
  assert.equal(triggerRecord.responseConfigurationAudit.axes.action_family.visible, false);
  assert.equal(triggerRecord.responseConfigurationAudit.axes.engagement_stance.visible, false);
});
