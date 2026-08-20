import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubFirstDraftContract,
  tutorStubFirstDraftContractPrompt,
} from '../services/tutorStubFirstDraftContract.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  acknowledgeTutorStubOpeningRelease,
  createTutorStubReleasePacingState,
} from '../services/tutorStubReleasePacing.js';
import {
  assembleTutorStubResistanceActionRegisterPreflight,
  buildTutorStubResistanceActionRegisterPreflightPackets,
  buildTutorStubResistanceActionRegisterSyntheticCorpus,
  runTutorStubResistanceActionRegisterEndpointPreflight,
} from '../services/tutorStubResistanceActionRegisterPreflight.js';
import {
  hashPaidStudyEndpointValue,
  validatePaidStudyEndpointGoCertificate,
} from '../services/paidStudyEndpointPreflight.js';
import {
  applyTutorStubResistanceActionRegisterSafetyOverride,
  applyTutorStubResistanceActionRegisterStudyIntervention,
  buildTutorStubResistanceActionRegisterPlan,
  createTutorStubResistanceActionRegisterStudyRuntime,
  extractTutorStubResistanceActionRegisterPrefix,
  loadTutorStubResistanceActionRegisterRegistration,
  prepareTutorStubResistanceActionRegisterFrozenBranch,
  scoreTutorStubResistanceRecovery,
  TUTOR_STUB_RESISTANCE_ACTION_REGISTER_PREFIX_SCHEMA,
} from '../services/tutorStubResistanceActionRegisterStudy.js';
import {
  configureTutorStubResistanceActionRegisterExecution,
  loadTutorStubResistanceActionRegisterPrefixBundle,
  validateTutorStubResistanceActionRegisterPrefixBundle,
} from '../services/tutorStubResistanceActionRegisterExecution.js';
import {
  assertTutorStubResistanceActionRegisterCleanSource,
  buildTutorStubResistanceActionRegisterBatchPlan,
  buildTutorStubResistanceActionRegisterRecoveryJob,
  runTutorStubResistanceActionRegisterZeroCall,
} from '../scripts/run-tutor-stub-resistance-action-register-crossed.js';
import { analyzeTutorStubResistanceActionRegisterBaseline } from '../scripts/analyze-tutor-stub-resistance-action-register-baseline.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION_PATH = path.join(ROOT, 'config/tutor-stub-resistance-action-register-crossed-registration.v1.json');
const ENDPOINT_PATH = path.join(
  ROOT,
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-baseline.json',
);
const REGISTRATION_V2_PATH = path.join(
  ROOT,
  'config/tutor-stub-resistance-action-register-crossed-registration.v2.json',
);
const ENDPOINT_V2_PATH = path.join(
  ROOT,
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-baseline.v2.json',
);
const ENDPOINT_GO_V2_PATH = path.join(
  ROOT,
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-baseline.v2.endpoint-go.json',
);
const PREFIX_BUNDLE_V2_PATH = path.join(
  ROOT,
  'config/tutor-stub-resistance-action-register-v4-public-prefixes.v1.json',
);

function fileSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function valueSha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function syntheticLiveTrace({ job, plan, bundleSha256, fidelity = {}, modelCallBudget = 39 }) {
  const prefix = JSON.parse(fs.readFileSync(PREFIX_BUNDLE_V2_PATH, 'utf8')).prefixes.find(
    (candidate) => candidate.id === job.prefix_id,
  );
  const triggerClassification = {
    turn: {
      request_type: 'authority_refusal_or_status_challenge',
      discourse_move: 'challenge',
      evidence_use: 'none',
      epistemic_stance: 'resistant',
      agency: 'steering',
    },
  };
  const recoveryClassification = {
    turn: {
      request_type: 'conceptual_clarity_request',
      discourse_move: 'evidence_adoption',
      evidence_use: 'cites_public_evidence',
      epistemic_stance: 'exploratory',
      agency: 'attempting',
    },
  };
  const route = {
    ref: 'codex.gpt-5.6-luna',
    provider: 'codex',
    model: 'gpt-5.6-luna',
    cli: true,
  };
  const observedCalls = [
    ['tutor_stub_tutor', 1],
    ['tutor_stub_auto_learner', 2],
    ['tutor_stub_learner_analysis', 2],
    ['tutor_stub_tutor', 2],
    ['tutor_stub_auto_learner', 3],
    ['tutor_stub_learner_analysis', 3],
  ].flatMap(([role, turn]) => [
    { type: 'model_call_budget_reserved', role, turn },
    {
      type: 'model_call',
      role,
      turn,
      provider: 'codex',
      model: 'gpt-5.6-luna',
      response: { effort: 'low' },
    },
  ]);
  const safetyOverrideReason = fidelity.safetyOverrideReason || null;
  return [
    {
      type: 'run_start',
      metadata: {
        provenance: { git: { sha: plan.source.commit, dirty: false } },
        lab: { admission: { modelCallBudget } },
        experiment: {
          runSeed: 20260820,
          profile: 'frame_refuser',
          policy: 'field',
          repeat: job.treatment.repeat === 'A' ? 1 : 2,
          jobId: job.id,
        },
        autoLearner: {
          observationSemantics: 'prospective_v4',
          maxTurns: 3,
          profileId: 'frame_refuser',
          modelRef: 'codex.gpt-5.6-luna',
        },
        sessionRecipe: {
          schema: 'machinespirits.tutor-stub.session-recipe.v1',
          config: {
            identity: {
              models: {
                classifier: route,
                learner: route,
                reasoning: route,
                tutor: route,
              },
              world: { id: 'world_005_marrick' },
            },
            options: {
              'cli-effort': 'low',
              'run-seed': '20260820',
              'auto-turns': '3',
              'model-call-budget': String(modelCallBudget),
              'dag-mode': 'strict_dag',
              'register-policy': 'field',
              'register-palette': 'plain,warm',
              'eval-repeat': job.treatment.repeat === 'A' ? '1' : '2',
              'eval-job-id': job.id,
              'resistance-action-register-job': job.id,
              'resistance-action-register-registration':
                'config/tutor-stub-resistance-action-register-crossed-registration.v2.json',
              'resistance-action-register-prefix-bundle':
                'config/tutor-stub-resistance-action-register-v4-public-prefixes.v1.json',
              'no-opening': true,
              'no-auto-stop-on-grounded': true,
            },
          },
        },
      },
    },
    {
      type: 'resistance_action_register_execution_start',
      jobId: job.id,
      batchId: job.treatment.batch_id,
      prefixId: job.prefix_id,
      publicPrefixSha256: job.public_prefix_sha256,
      prefixBundleSha256: bundleSha256,
      registrationSha256: plan.source.registration_sha256,
    },
    {
      type: 'resistance_action_register_intervention_applied',
      turn: 1,
      intervention: {
        status: safetyOverrideReason ? 'safety_override_nonadherent' : 'applied',
        assignment: {
          action_fit: 'matched',
          pedagogical_move: 'test_bounded_distinction',
          realization: job.treatment.realization,
          register: job.treatment.register,
          repeat: job.treatment.repeat,
          batch_id: job.treatment.batch_id,
        },
        safety_override: safetyOverrideReason
          ? {
              applied: true,
              assigned_register: job.treatment.register,
              delivered_register: 'plain',
              reason: safetyOverrideReason,
            }
          : { applied: false, assigned_register: job.treatment.register, delivered_register: job.treatment.register },
      },
    },
    ...observedCalls,
    {
      type: 'turn_complete',
      turn: 1,
      turnRecord: {
        learner: prefix.trigger_learner_text,
        classification: triggerClassification,
        tutorLearnerDagModel: { metrics: { missingPremiseCount: 6, groundedCount: 4 } },
        ...(fidelity.omitResponseAudit
          ? {}
          : {
              responseConfigurationAudit: {
                axes: {
                  action_family: {
                    selected: job.treatment.host_action_family,
                    visible: fidelity.actionVisible ?? true,
                  },
                  engagement_stance: {
                    selected: safetyOverrideReason ? 'plain' : job.treatment.register,
                    visible: fidelity.registerVisible ?? true,
                  },
                },
              },
            }),
      },
    },
    {
      type: 'turn_complete',
      turn: 2,
      turnRecord: {
        learner: 'I will test the bounded public die-mark distinction against the clipped edge.',
        classification: recoveryClassification,
      },
    },
    {
      type: 'resistance_action_register_outcome_learner_turn',
      turn: 3,
      learnerText: 'The public comparison can proceed without granting the wider frame.',
      classification: recoveryClassification,
      tutorLearnerDag: { model: { metrics: { missingPremiseCount: 5, groundedCount: 5 } } },
      tutorReplyGenerated: false,
    },
  ];
}

function writeSyntheticBatch(root, plan, { fidelityByJob = {} } = {}) {
  fs.mkdirSync(root, { recursive: true });
  const results = plan.jobs.map((job) => {
    fs.mkdirSync(job.command.trace_dir, { recursive: true });
    const tracePath = path.join(job.command.trace_dir, 'trace.jsonl');
    const trace = syntheticLiveTrace({
      job,
      plan,
      bundleSha256: plan.source.prefix_bundle_sha256,
      fidelity: fidelityByJob[job.id],
    });
    fs.writeFileSync(tracePath, `${trace.map((event) => JSON.stringify(event)).join('\n')}\n`);
    return {
      job_id: job.id,
      status: 'complete',
      trace: tracePath,
      trace_sha256: fileSha256(tracePath),
    };
  });
  const result = {
    schema: 'machinespirits.tutor-stub.resistance-action-register-live-batch-result.v1',
    batch_id: plan.batch_id,
    repeat: plan.repeat,
    status: 'complete',
    completed_dialogues: 6,
    failed_or_missing_dialogues: 0,
    maximum_model_attempt_reservations: 234,
    results,
  };
  const planPath = path.join(root, 'batch-plan.json');
  const resultPath = path.join(root, 'batch-result.json');
  writeJson(planPath, plan);
  writeJson(resultPath, result);
  writeJson(path.join(root, 'batch-seal.json'), {
    schema: 'machinespirits.tutor-stub.resistance-action-register-live-batch-seal.v1',
    status: 'sealed_complete',
    batch_id: plan.batch_id,
    repeat: plan.repeat,
    plan_sha256: fileSha256(planPath),
    result_sha256: fileSha256(resultPath),
    dialogues: 6,
    hard_ceiling: 234,
    valid_unit_reruns: false,
    outcome_selection: false,
  });
}

function mutateSyntheticBatchTrace(root, jobId, mutateEvents) {
  const resultPath = path.join(root, 'batch-result.json');
  const sealPath = path.join(root, 'batch-seal.json');
  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  const row = result.results.find((candidate) => candidate.job_id === jobId);
  const events = fs
    .readFileSync(row.trace, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const mutated = mutateEvents(events);
  fs.writeFileSync(row.trace, `${mutated.map((event) => JSON.stringify(event)).join('\n')}\n`);
  row.trace_sha256 = fileSha256(row.trace);
  writeJson(resultPath, result);
  const seal = JSON.parse(fs.readFileSync(sealPath, 'utf8'));
  seal.result_sha256 = fileSha256(resultPath);
  writeJson(sealPath, seal);
}

function writeSyntheticRecoveredBatch(root, plan, recoveredJobId) {
  fs.mkdirSync(root, { recursive: true });
  const initialResults = [];
  const finalRows = [];
  let recoveredTracePath = null;
  for (const job of plan.jobs) {
    fs.mkdirSync(job.command.trace_dir, { recursive: true });
    const tracePath = path.join(job.command.trace_dir, 'trace.jsonl');
    if (job.id === recoveredJobId) {
      fs.writeFileSync(
        tracePath,
        `${JSON.stringify({ type: 'model_call_budget_reserved', role: 'learner', turn: 2 })}\n`,
      );
      initialResults.push({ job_id: job.id, status: 'failed', exit_code: 1 });
      continue;
    }
    const trace = syntheticLiveTrace({ job, plan, bundleSha256: plan.source.prefix_bundle_sha256 });
    fs.writeFileSync(tracePath, `${trace.map((event) => JSON.stringify(event)).join('\n')}\n`);
    const row = { job_id: job.id, status: 'complete', trace: tracePath, trace_sha256: fileSha256(tracePath) };
    initialResults.push(row);
    finalRows.push({ ...row, origin: 'initial_valid_unit' });
  }
  const planPath = path.join(root, 'batch-plan.json');
  const initialResultPath = path.join(root, 'batch-result.json');
  writeJson(planPath, plan);
  writeJson(initialResultPath, {
    schema: 'machinespirits.tutor-stub.resistance-action-register-live-batch-result.v1',
    batch_id: plan.batch_id,
    repeat: plan.repeat,
    status: 'incomplete',
    completed_dialogues: 5,
    failed_or_missing_dialogues: 1,
    maximum_model_attempt_reservations: 234,
    results: initialResults,
  });
  const originalJob = plan.jobs.find((job) => job.id === recoveredJobId);
  const recoveryRoot = path.join(root, 'recoveries', 'recovery-001');
  const loaded = loadTutorStubResistanceActionRegisterPrefixBundle({
    registrationPath: REGISTRATION_V2_PATH,
    bundlePath: PREFIX_BUNDLE_V2_PATH,
  });
  const recoveryJob = buildTutorStubResistanceActionRegisterRecoveryJob({
    loaded,
    job: originalJob,
    destination: recoveryRoot,
    priorModelAttemptReservations: 1,
  });
  const recoveryTraceDir = recoveryJob.command.trace_dir;
  fs.mkdirSync(recoveryTraceDir, { recursive: true });
  recoveredTracePath = path.join(recoveryTraceDir, 'trace.jsonl');
  const recoveredTrace = syntheticLiveTrace({
    job: originalJob,
    plan,
    bundleSha256: plan.source.prefix_bundle_sha256,
    modelCallBudget: 38,
  });
  fs.writeFileSync(recoveredTracePath, `${recoveredTrace.map((event) => JSON.stringify(event)).join('\n')}\n`);
  const recoveryPlanPath = path.join(recoveryRoot, 'recovery-plan.json');
  const recoveryResultPath = path.join(recoveryRoot, 'recovery-result.json');
  const recoveredRow = {
    job_id: recoveredJobId,
    status: 'complete',
    trace: recoveredTracePath,
    trace_sha256: fileSha256(recoveredTracePath),
  };
  writeJson(recoveryPlanPath, {
    schema: 'machinespirits.tutor-stub.resistance-action-register-live-batch-recovery-plan.v1',
    status: 'planned_missing_or_failed_only',
    batch_id: plan.batch_id,
    repeat: plan.repeat,
    source: plan.source,
    original_plan_sha256: fileSha256(planPath),
    original_result_sha256: fileSha256(initialResultPath),
    used_reservations_before_recovery: 31,
    hard_ceiling: 234,
    valid_unit_ids_excluded: plan.jobs
      .filter((job) => job.id !== recoveredJobId)
      .map((job) => job.id)
      .sort(),
    jobs: [recoveryJob],
  });
  writeJson(recoveryResultPath, {
    schema: 'machinespirits.tutor-stub.resistance-action-register-live-batch-recovery-result.v1',
    batch_id: plan.batch_id,
    repeat: plan.repeat,
    results: [recoveredRow],
  });
  finalRows.push({ ...recoveredRow, origin: 'bounded_technical_recovery_missing_or_failed_unit' });
  finalRows.sort((a, b) => a.job_id.localeCompare(b.job_id));
  const finalResultPath = path.join(root, 'batch-final-result.json');
  const reservationsByJob = Object.fromEntries(plan.jobs.map((job) => [job.id, job.id === recoveredJobId ? 7 : 6]));
  writeJson(finalResultPath, {
    schema: 'machinespirits.tutor-stub.resistance-action-register-live-batch-result.v1',
    batch_id: plan.batch_id,
    repeat: plan.repeat,
    status: 'complete',
    completed_dialogues: 6,
    failed_or_missing_dialogues: 0,
    maximum_model_attempt_reservations: 234,
    observed_model_attempt_reservations: 37,
    observed_model_attempt_reservations_by_job: reservationsByJob,
    technical_recovery_used: true,
    recovery_unit_ids: [recoveredJobId],
    results: finalRows,
  });
  const sealPath = path.join(root, 'batch-seal.json');
  writeJson(sealPath, {
    schema: 'machinespirits.tutor-stub.resistance-action-register-live-batch-seal.v1',
    status: 'sealed_complete',
    batch_id: plan.batch_id,
    repeat: plan.repeat,
    plan_sha256: fileSha256(planPath),
    result_sha256: fileSha256(finalResultPath),
    recovery_plan_sha256: fileSha256(recoveryPlanPath),
    recovery_result_sha256: fileSha256(recoveryResultPath),
    dialogues: 6,
    hard_ceiling: 234,
    observed_model_attempt_reservations: 37,
    observed_model_attempt_reservations_by_job: reservationsByJob,
    valid_unit_reruns: false,
    outcome_selection: false,
  });
  return { recoveryPlanPath, sealPath, recoveredJobId };
}

function loadedRegistration() {
  return loadTutorStubResistanceActionRegisterRegistration(REGISTRATION_PATH);
}

function baseSelection(register = 'precise') {
  return {
    engagement_stance: register,
    selected_register: register,
    action_family: 'challenge_resistance',
    source: 'legacy_test_selection',
    response_configuration: {
      schema: 'machinespirits.tutor-stub.response-configuration.v3',
      policy: 'field',
      engagement_stance: register,
      action_family: 'challenge_resistance',
      addressee_profile: 'domain_apprentice',
      audience_register: 'domain_apprentice',
      lexical_accessibility: 'standard',
      scene_immersion: 'grounded',
      actorial_part: 'scene_partner',
      actorial_part_label: 'fellow investigator',
      actorial_performance: { id: 'unadorned_report' },
      surface_budgets: { max_average_sentence_words: 24 },
      selection_reasons: {},
      compatibility: { selected_register: register },
    },
  };
}

function runtime(profile, actionFit, realization, repeat = 'A') {
  const loaded = loadedRegistration();
  return createTutorStubResistanceActionRegisterStudyRuntime({
    registration: loaded.registration,
    registrationPath: path.relative(ROOT, loaded.path),
    registrationSha256: loaded.sha256,
    profile,
    actionFit,
    realization,
    repeat,
  });
}

function stateWith(study, selection) {
  return {
    resistanceActionRegisterStudy: study,
    turns: [],
    world: null,
    register: {
      palette: ['plain', 'warm', 'precise', 'brisk', 'ironic', 'sarcastic'],
      history: [selection],
      current: selection,
    },
  };
}

test('study-only intervention assigns the typed action before its compatible register and consumes once', () => {
  const selection = baseSelection();
  const state = stateWith(runtime('bored', 'matched', 'edged'), selection);
  const classification = {
    turn: {
      request_type: 'off_task_or_mixed',
      discourse_move: 'off_task',
      evidence_use: 'none',
      epistemic_stance: 'resistant',
      agency: 'complying',
    },
  };
  const applied = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection,
    state,
    learnerText: 'Sure. Whatever.',
    classification,
    tutorLearnerDag: { model: { turn: 3 } },
  });

  assert.equal(applied.action_family, 'stage_next_step');
  assert.equal(applied.selected_register, 'sarcastic');
  assert.equal(applied.response_configuration.action_family, 'stage_next_step');
  assert.equal(applied.response_configuration.engagement_stance, 'sarcastic');
  assert.equal(
    applied.resistance_action_register_intervention.assignment.pedagogical_move,
    'ask_discriminating_question',
  );
  assert.deepEqual(applied.resistance_action_register_intervention.assignment.application_order, [
    'public_observation',
    'warrant',
    'assigned_typed_pedagogical_move',
    'assigned_compatible_register',
    'public_realization',
  ]);
  assert.equal(applied.resistance_action_register_intervention.profile_identity_triggered, false);
  assert.equal(Object.hasOwn(applied.resistance_action_register_intervention.assignment, 'batch_id'), false);
  assert.equal(state.resistanceActionRegisterStudy.consumed, true);
  assert.equal(state.register.current, applied);

  const later = baseSelection('warm');
  const unchanged = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection: later,
    state,
    learnerText: 'Whatever.',
    classification,
    tutorLearnerDag: { model: { turn: 4 } },
  });
  assert.equal(unchanged, later);
});

test('mismatch swaps only the registered move and the edged register follows that move', () => {
  const selection = baseSelection();
  const state = stateWith(runtime('frame_defiant', 'mismatched', 'edged', 'B'), selection);
  const applied = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection,
    state,
    learnerText: 'I reject your frame. You do not get to set this question.',
    classification: {
      turn: {
        request_type: 'resistance_or_low_agency',
        discourse_move: 'challenge',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
        agency: 'steering',
      },
    },
    tutorLearnerDag: { model: { turn: 2 } },
  });

  assert.equal(
    applied.resistance_action_register_intervention.assignment.pedagogical_move,
    'ask_discriminating_question',
  );
  assert.equal(applied.resistance_action_register_intervention.assignment.register, 'sarcastic');
  assert.equal(applied.resistance_action_register_intervention.assignment.repeat, 'B');
});

test('an ambiguous two-axis signal fails closed without consuming the study treatment', () => {
  const selection = baseSelection();
  const state = stateWith(runtime('bored', 'matched', 'plain'), selection);
  const unchanged = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection,
    state,
    learnerText: 'Whatever. I reject the premise of this test.',
    classification: {
      turn: {
        request_type: 'resistance_or_low_agency',
        discourse_move: 'off_task',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
        agency: 'complying',
      },
    },
  });

  assert.equal(unchanged, selection);
  assert.equal(state.resistanceActionRegisterStudy.consumed, false);
  assert.ok(state.resistanceActionRegisterStudy.history[0].reasons.includes('no_single_axis_public_warrant'));
});

test('protected conditions suppress assignment and a post-assignment safety change records nonadherence without reroll', () => {
  const selection = baseSelection();
  const state = stateWith(runtime('frame_defiant', 'matched', 'edged'), selection);
  const suppressed = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection,
    state,
    learnerText: 'I reject your frame, and I am ashamed and overwhelmed by this question.',
    classification: {
      turn: {
        request_type: 'vulnerability_or_moral_exposure',
        discourse_move: 'challenge',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
      },
    },
  });
  assert.equal(suppressed, selection);
  assert.equal(state.resistanceActionRegisterStudy.consumed, false);
  assert.ok(state.resistanceActionRegisterStudy.history[0].reasons.includes('protected_affect'));

  const cleanSelection = baseSelection();
  const cleanState = stateWith(runtime('frame_defiant', 'matched', 'edged'), cleanSelection);
  const applied = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection: cleanSelection,
    state: cleanState,
    learnerText: 'I reject the premise of this exercise.',
    classification: {
      turn: {
        request_type: 'resistance_or_low_agency',
        discourse_move: 'challenge',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
      },
    },
  });
  const overridden = applyTutorStubResistanceActionRegisterSafetyOverride(applied, {
    reason: 'protected_affect',
  });
  assert.equal(overridden.selected_register, 'plain');
  assert.equal(overridden.resistance_action_register_intervention.status, 'safety_override_nonadherent');
  assert.equal(overridden.resistance_action_register_intervention.safety_override.assigned_register, 'ironic');
  assert.equal(overridden.resistance_action_register_intervention.reroll_authorized, false);
});

test('the byte-pinned legacy contract builder ignores study metadata outside the frozen overlay', () => {
  const selection = baseSelection();
  const state = stateWith(runtime('bored', 'matched', 'warm'), selection);
  const applied = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection,
    state,
    learnerText: 'Whatever.',
    classification: {
      turn: {
        request_type: 'off_task_or_mixed',
        discourse_move: 'off_task',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
        agency: 'complying',
      },
    },
  });
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'Whatever.',
    responseConfiguration: applied.response_configuration,
  });

  assert.equal(contract.development.pedagogical_move, undefined);
  assert.doesNotMatch(contract.development.instruction, /genuinely discriminating/u);
  assert.equal(contract.performance.engagement_stance, 'warm');
});

test('frozen branch recompiles only the speaking contract and preserves the exact public prefix', () => {
  const registration = loadedRegistration().registration;
  const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-005-marrick.yaml'));
  const configuration = baseSelection().response_configuration;
  const originalContract = buildTutorStubFirstDraftContract({
    learnerText: 'Sure. Whatever.',
    responseConfiguration: configuration,
  });
  const prefix = {
    schema: TUTOR_STUB_RESISTANCE_ACTION_REGISTER_PREFIX_SCHEMA,
    id: 'bored:prefix:1',
    profile: 'bored',
    world: world.id,
    trigger_turn: 2,
    trigger_learner_text: 'Sure. Whatever.',
    trigger_classification: {
      turn: {
        request_type: 'off_task_or_mixed',
        discourse_move: 'off_task',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
        agency: 'complying',
      },
    },
    public_prefix_sha256: 'a'.repeat(64),
    frozen_bundle: {
      schema: 'machinespirits.tutor-stub.frozen-replay.v1',
      worldId: world.id,
      turn: 2,
      learnerText: 'Sure. Whatever.',
      priorTurns: [{ turn: 1, learner: 'The edge is visible.', tutor: 'Which edge matters?' }],
      priorTutorTexts: ['Which edge matters?'],
      selectedResponseConfiguration: configuration,
      firstDraftContract: originalContract,
      frames: {
        responseComposition: null,
        dramaticRelease: null,
        questionSupport: null,
        dialogueClosure: null,
        generousInference: null,
      },
      guards: {},
      publicPremiseIds: [],
      duePremiseIds: [],
      request: {
        systemPrompt: `World: ${world.id}`,
        messages: [
          {
            role: 'user',
            content: `${tutorStubFirstDraftContractPrompt(originalContract)}\n\nLearner says:\nSure. Whatever.`,
          },
        ],
        config: {},
        provider: 'codex',
        model: 'gpt-5.6-luna',
        effort: 'low',
      },
    },
  };
  const branch = prepareTutorStubResistanceActionRegisterFrozenBranch({
    prefix,
    registration,
    world,
    actionFit: 'matched',
    realization: 'warm',
    repeat: 'A',
  });

  assert.deepEqual(branch.bundle.priorTurns, prefix.frozen_bundle.priorTurns);
  assert.equal(branch.bundle.learnerText, prefix.frozen_bundle.learnerText);
  assert.equal(branch.treatment.pedagogical_move, 'ask_discriminating_question');
  assert.equal(branch.treatment.register, 'warm');
  assert.equal(branch.bundle.firstDraftContract.development.pedagogical_move, 'ask_discriminating_question');
  assert.match(branch.bundle.request.messages.at(-1).content, /Ask exactly one concrete.*question/u);
});

test('prefix extractor stops before the first eligible trigger and baseline plan makes 24 paired branches', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'resistance-prefix-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const traces = [];
  for (const profile of ['bored', 'frame_defiant']) {
    for (let repeat = 1; repeat <= 3; repeat += 1) {
      const tracePath = path.join(directory, `${profile}-${repeat}.jsonl`);
      const learner =
        profile === 'bored'
          ? 'Sure. Whatever.'
          : `I reject the premise of this exercise, but let us test whether public mark ${repeat} bears on the question.`;
      const classification =
        profile === 'bored'
          ? {
              turn: {
                request_type: 'off_task_or_mixed',
                discourse_move: 'off_task',
                evidence_use: 'none',
                epistemic_stance: 'resistant',
                agency: 'complying',
              },
            }
          : {
              turn: {
                request_type: 'resistance_or_low_agency',
                discourse_move: 'challenge',
                evidence_use: 'none',
                epistemic_stance: 'resistant',
                agency: 'steering',
              },
            };
      const events = [
        { type: 'run_start', runId: `${profile}-${repeat}`, metadata: { world: { id: 'world_005_marrick' } } },
        {
          type: 'turn_complete',
          turn: 1,
          turnId: `${profile}-${repeat}:t1`,
          turnRecord: {
            turnId: `${profile}-${repeat}:t1`,
            learner: `The public mark ${repeat} is visible.`,
            tutor: 'Which public mark matters?',
            classification: { turn: { discourse_move: 'inference', evidence_use: 'cites_public_evidence' } },
          },
        },
        { type: 'auto_learner_turn', turn: 2, text: learner },
        {
          type: 'turn_complete',
          turn: 2,
          turnId: `${profile}-${repeat}:t2`,
          turnRecord: { turnId: `${profile}-${repeat}:t2`, learner, tutor: 'legacy response', classification },
        },
        { type: 'run_end', reason: 'test' },
      ];
      fs.writeFileSync(tracePath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
      traces.push(extractTutorStubResistanceActionRegisterPrefix({ tracePath, profile, requireFrozenBundle: false }));
    }
  }

  assert.ok(traces.every((prefix) => !prefix.prefix_source.includes('legacy response')));
  const plan = buildTutorStubResistanceActionRegisterPlan({
    registration: loadedRegistration().registration,
    prefixes: traces,
    stage: 'baseline',
  });
  assert.equal(plan.jobs.length, 24);
  assert.equal(plan.model_calls, 0);
  assert.equal(plan.production_writes, 0);
  for (const prefix of traces) {
    const jobs = plan.jobs.filter((job) => job.prefix_id === prefix.id);
    assert.equal(jobs.length, 4);
    assert.deepEqual(jobs.map((job) => `${job.treatment.realization}:${job.treatment.repeat}`).sort(), [
      'plain:A',
      'plain:B',
      'warm:A',
      'warm:B',
    ]);
    assert.ok(jobs.every((job) => job.public_prefix_sha256 === prefix.public_prefix_sha256));
    assert.ok(jobs.every((job) => !Object.hasOwn(job.treatment, 'batch_id')));
  }
});

test('prospective frame-refuser prefix gate requires jurisdictional refusal before content-bearing uptake', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-refuser-prefix-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const writeCandidate = (name, { learner, classification }) => {
    const tracePath = path.join(directory, `${name}.jsonl`);
    const events = [
      { type: 'run_start', runId: name, metadata: { world: { id: 'world_005_marrick' } } },
      { type: 'auto_learner_turn', turn: 1, text: learner },
      {
        type: 'turn_complete',
        turn: 1,
        turnId: `${name}:t1`,
        turnRecord: { turnId: `${name}:t1`, learner, tutor: 'legacy response', classification },
      },
      { type: 'run_end', reason: 'test' },
    ];
    fs.writeFileSync(tracePath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
    return tracePath;
  };

  const refusalTrace = writeCandidate('refusal', {
    learner: 'I reject that test, and I will not answer inside it.',
    classification: {
      turn: {
        request_type: 'authority_refusal_or_status_challenge',
        discourse_move: 'challenge',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
        agency: 'steering',
      },
    },
  });
  const refusal = extractTutorStubResistanceActionRegisterPrefix({
    tracePath: refusalTrace,
    profile: 'frame_refuser',
    requireFrozenBundle: false,
  });
  assert.equal(refusal.profile, 'frame_refuser');
  assert.equal(refusal.trigger_turn, 1);
  assert.ok(
    refusal.trigger_observation.observations.some((observation) => observation.type === 'frame_jurisdiction_refusal'),
  );

  const productiveTrace = writeCandidate('productive', {
    learner:
      'I reject the frame, but the public assay still supports testing whether this mark came from the same die.',
    classification: {
      turn: {
        request_type: 'authority_refusal_or_status_challenge',
        discourse_move: 'hypothesis',
        evidence_use: 'links_evidence_to_rule',
        epistemic_stance: 'resistant',
        agency: 'steering',
      },
    },
  });
  assert.throws(
    () =>
      extractTutorStubResistanceActionRegisterPrefix({
        tracePath: productiveTrace,
        profile: 'frame_refuser',
        requireFrozenBundle: false,
      }),
    /no eligible frame_refuser resistance trigger/u,
  );

  const boundedControlTrace = writeCandidate('bounded-control', {
    learner:
      'I do not accept that you get to set the coin as the compulsory test; if you propose one bounded feature to examine, name it, and I will consider whether that test is properly framed.',
    classification: {
      turn: {
        request_type: 'authority_refusal_or_status_challenge',
        discourse_move: 'challenge',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
        agency: 'steering',
      },
    },
  });
  assert.throws(
    () =>
      extractTutorStubResistanceActionRegisterPrefix({
        tracePath: boundedControlTrace,
        profile: 'frame_refuser',
        requireFrozenBundle: false,
      }),
    /no eligible frame_refuser resistance trigger/u,
  );
});

test('deterministic endpoint implements the two registered recovery horizons', () => {
  const bored = scoreTutorStubResistanceRecovery({
    profile: 'bored',
    postLearnerTurns: [
      {
        learnerText: 'The clipped edge supports the die-mark comparison.',
        classification: { turn: { discourse_move: 'inference', evidence_use: 'links_evidence_to_rule' } },
      },
    ],
  });
  const permission = scoreTutorStubResistanceRecovery({
    profile: 'bored',
    postLearnerTurns: [
      {
        learnerText: 'Is it okay if I compare the clipped edge?',
        classification: { turn: { discourse_move: 'inference', evidence_use: 'cites_public_evidence' } },
      },
    ],
  });
  const frame = scoreTutorStubResistanceRecovery({
    profile: 'frame_defiant',
    triggerLearnerText: 'I reject your frame.',
    postLearnerTurns: [
      {
        learnerText: 'I dispute the frame because this public test assumes the mark is decisive.',
        classification: { turn: { discourse_move: 'challenge', evidence_use: 'none', epistemic_stance: 'resistant' } },
      },
    ],
  });
  assert.equal(bored.recovered, true);
  assert.equal(permission.recovered, false);
  assert.equal(frame.recovered, true);
  assert.equal(frame.observed_turn, 1);
});

test('full 24-case production endpoint preflight passes with zero calls and writes', () => {
  const loaded = loadedRegistration();
  const contract = JSON.parse(fs.readFileSync(ENDPOINT_PATH, 'utf8'));
  const cases = buildTutorStubResistanceActionRegisterSyntheticCorpus(loaded.registration);
  const packets = buildTutorStubResistanceActionRegisterPreflightPackets(cases);
  const assembled = assembleTutorStubResistanceActionRegisterPreflight({ packets, contract });
  const preflight = runTutorStubResistanceActionRegisterEndpointPreflight({
    contract,
    registration: loaded.registration,
  });
  const readiness = runTutorStubResistanceActionRegisterZeroCall();

  assert.equal(preflight.status, 'passed');
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(preflight.packet_audit.covered_cases, 24);
  assert.equal(preflight.packet_audit.packets, 6);
  assert.ok(Object.values(preflight.assembly_audit.endpoint_status).every((status) => status === 'complete'));
  assert.equal(readiness.status, 'passed_hold');
  assert.equal(readiness.live_execution_available, false);
  assert.equal(valueSha256(cases), '9f081a1204b1e1f4e661df322da2e4e96d7e2ca60c822aea3dba58adcb51eb89');
  assert.equal(valueSha256(packets), '09cdb48af0e7b343db872269e834ce497ec7fb4cd19fd6b77e46c3cd05c56b34');
  assert.equal(preflight.preflight_sha256, '00a178cbc344bed48d5689679c160fc3eddbf0d1c8be8ec5d2c14ba4faff9e11');
  assert.equal(Object.hasOwn(assembled.report, 'recovery_by_realization_and_repeat'), false);
  assert.equal(Object.hasOwn(assembled.report, 'same_treatment_repeat_drift'), false);
});

test('historical v1 resistance action/register artifacts retain exact byte digests', () => {
  assert.equal(fileSha256(REGISTRATION_PATH), '8e2e2a6c5fde795b668d2a9ecc81a527e29a0d970aaf419badde5fb037fa87e7');
  assert.equal(fileSha256(ENDPOINT_PATH), '3f82e6b70f037ecff8422a13fde0728d8e974d37537c6e570764df8cc47ed309');
});

test('v2 admits a prospective-v4 frame refusal into the fixed matched action and warm realization', () => {
  const loaded = loadTutorStubResistanceActionRegisterRegistration(REGISTRATION_V2_PATH);
  const study = createTutorStubResistanceActionRegisterStudyRuntime({
    registration: loaded.registration,
    registrationPath: path.relative(ROOT, loaded.path),
    registrationSha256: loaded.sha256,
    profile: 'frame_refuser',
    actionFit: 'matched',
    realization: 'warm',
    repeat: 'A',
  });
  const selection = baseSelection();
  const state = stateWith(study, selection);
  const applied = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection,
    state,
    learnerText: 'I reject your right to set this question, and I will not answer within it.',
    classification: {
      turn: {
        request_type: 'authority_refusal_or_status_challenge',
        discourse_move: 'challenge',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
        agency: 'steering',
      },
    },
    tutorLearnerDag: { model: { turn: 1 } },
  });

  assert.equal(applied.source, 'resistance_action_register_study_intervention');
  assert.equal(applied.selected_register, 'warm');
  assert.equal(applied.resistance_action_register_intervention.public_trigger.resistance_kind, 'frame_refuser');
  assert.equal(applied.resistance_action_register_intervention.assignment.action_fit, 'matched');
  assert.equal(applied.resistance_action_register_intervention.assignment.pedagogical_move, 'test_bounded_distinction');
  assert.equal(applied.resistance_action_register_intervention.assignment.batch_id, 'batch_A');
});

test('v2 keeps productive frame defiance diagnostic-only and does not consume treatment', () => {
  const loaded = loadTutorStubResistanceActionRegisterRegistration(REGISTRATION_V2_PATH);
  const study = createTutorStubResistanceActionRegisterStudyRuntime({
    registration: loaded.registration,
    profile: 'frame_refuser',
    actionFit: 'matched',
    realization: 'plain',
    repeat: 'B',
  });
  const selection = baseSelection();
  const state = stateWith(study, selection);
  const unchanged = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection,
    state,
    learnerText:
      'I reject your authority to define the question, but name one bounded public test and I will examine it.',
    classification: {
      turn: {
        request_type: 'authority_refusal_or_status_challenge',
        discourse_move: 'challenge',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
        agency: 'steering',
      },
    },
  });

  assert.equal(unchanged, selection);
  assert.equal(study.consumed, false);
  assert.ok(study.history[0].reasons.includes('no_single_axis_public_warrant'));
  assert.throws(
    () =>
      createTutorStubResistanceActionRegisterStudyRuntime({
        registration: loaded.registration,
        profile: 'frame_defiant',
        actionFit: 'matched',
        realization: 'plain',
        repeat: 'A',
      }),
    /study profile must be one of frame_refuser/u,
  );
});

test('v2 frame-refuser recovery requires bounded merits engagement or a more precise public dispute within two turns', () => {
  const merits = scoreTutorStubResistanceRecovery({
    profile: 'frame_refuser',
    triggerLearnerText: 'I reject your test and will not answer within it.',
    postLearnerTurns: [
      {
        learnerText: 'The bounded die-mark comparison is worth testing against the clipped edge.',
        classification: {
          turn: {
            discourse_move: 'evidence_adoption',
            evidence_use: 'cites_public_evidence',
            epistemic_stance: 'exploratory',
          },
        },
      },
    ],
  });
  const continuedRefusal = scoreTutorStubResistanceRecovery({
    profile: 'frame_refuser',
    triggerLearnerText: 'I reject your test and will not answer within it.',
    postLearnerTurns: [
      {
        learnerText: 'No. I still will not answer.',
        classification: {
          turn: {
            discourse_move: 'refusal',
            evidence_use: 'none',
            epistemic_stance: 'resistant',
          },
        },
      },
      {
        learnerText: 'I refuse.',
        classification: {
          turn: {
            discourse_move: 'refusal',
            evidence_use: 'none',
            epistemic_stance: 'resistant',
          },
        },
      },
    ],
  });
  const authorityQuestion = scoreTutorStubResistanceRecovery({
    profile: 'frame_refuser',
    triggerLearnerText: 'I reject your test and will not answer within it.',
    postLearnerTurns: [
      {
        learnerText: 'Why should I accept your authority?',
        classification: {
          turn: {
            discourse_move: 'question',
            evidence_use: 'none',
            epistemic_stance: 'exploratory',
          },
        },
      },
    ],
  });
  const reflectiveRefusal = scoreTutorStubResistanceRecovery({
    profile: 'frame_refuser',
    triggerLearnerText: 'I reject your test and will not answer within it.',
    postLearnerTurns: [
      {
        learnerText: 'I reject your authority to define this test, and I will not test it.',
        classification: {
          turn: {
            discourse_move: 'challenge',
            evidence_use: 'none',
            epistemic_stance: 'reflective',
          },
        },
      },
    ],
  });

  assert.equal(merits.recovered, true);
  assert.equal(merits.deadline_turns, 2);
  assert.equal(continuedRefusal.recovered, false);
  assert.equal(authorityQuestion.recovered, false);
  assert.equal(reflectiveRefusal.recovered, false);
});

test('v2 baseline plan binds three prefixes to two six-dialogue repeat batches without a factorial arm', () => {
  const registration = loadTutorStubResistanceActionRegisterRegistration(REGISTRATION_V2_PATH).registration;
  const prefixBindings = registration.design.trigger.frozenPrefixSource.prefixes;
  const prefixes = prefixBindings.map((binding) => ({
    schema: TUTOR_STUB_RESISTANCE_ACTION_REGISTER_PREFIX_SCHEMA,
    id: binding.id,
    profile: 'frame_refuser',
    world: 'world_005_marrick',
    trigger_turn: binding.triggerTurn,
    trigger_turn_id: `${binding.id}:trigger`,
    trigger_learner_text: 'I reject your right to set this question, and I will not answer within it.',
    trigger_classification: {
      turn: {
        request_type: 'authority_refusal_or_status_challenge',
        discourse_move: 'challenge',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
      },
    },
    observation_semantics: 'prospective_v4',
    source_trace_sha256: binding.sourceTraceSha256,
    prefix_trace_sha256: binding.sourceTraceSha256,
    public_prefix_sha256: binding.publicPrefixSha256,
    prior_turn_count: 0,
  }));
  const plan = buildTutorStubResistanceActionRegisterPlan({ registration, prefixes, stage: 'baseline' });

  assert.equal(plan.jobs.length, 12);
  assert.equal(plan.model_calls, 0);
  assert.equal(plan.production_writes, 0);
  assert.deepEqual([...new Set(plan.jobs.map((job) => job.treatment.action_fit))], ['matched']);
  assert.deepEqual([...new Set(plan.jobs.map((job) => job.treatment.pedagogical_move))], ['test_bounded_distinction']);
  assert.deepEqual([...new Set(plan.jobs.map((job) => job.treatment.realization))].sort(), ['plain', 'warm']);
  assert.equal(plan.jobs.filter((job) => job.treatment.batch_id === 'batch_A').length, 6);
  assert.equal(plan.jobs.filter((job) => job.treatment.batch_id === 'batch_B').length, 6);
  assert.throws(
    () => buildTutorStubResistanceActionRegisterPlan({ registration, prefixes, stage: 'factorial' }),
    /does not authorize a factorial stage/u,
  );
  const driftedPrefix = structuredClone(prefixes);
  driftedPrefix[0].source_trace_sha256 = 'f'.repeat(64);
  assert.throws(
    () => buildTutorStubResistanceActionRegisterPlan({ registration, prefixes: driftedPrefix, stage: 'baseline' }),
    /does not match the frozen prospective-v4 source binding/u,
  );
});

test('v2 public prefix bundle reproduces all three registered hashes and seeds one exact execution job', () => {
  const loaded = loadTutorStubResistanceActionRegisterPrefixBundle({
    bundlePath: PREFIX_BUNDLE_V2_PATH,
    registrationPath: REGISTRATION_V2_PATH,
  });
  assert.equal(loaded.bundle.prefixes.length, 3);
  assert.equal(
    loaded.bundle.provenance.v4_report_sha256,
    '771076330d58ec8818182a1924e3ea8dd2c8e54bdc1c9f32a822e491f405b431',
  );
  assert.equal(loaded.bundle.provenance.private_archive_commit, 'e5eb71f22f0c36f6e286272caf5b041e71d8e2ba');

  const events = [];
  const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-005-marrick.yaml'));
  const state = {
    history: [],
    turns: [],
    world,
    releasePacing: createTutorStubReleasePacingState({ world, speed: 1 }),
    trace: { enabled: false },
  };
  const configured = configureTutorStubResistanceActionRegisterExecution({
    state,
    loaded,
    jobId: 'frame_refuser-v4-r1-t1__matched_warm_A',
    appendTraceEvent: (_trace, event) => events.push(event),
    acknowledgeTutorStubOpeningRelease,
  });
  assert.equal(configured.job.treatment.pedagogical_move, 'test_bounded_distinction');
  assert.equal(configured.job.treatment.register, 'warm');
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].content, loaded.bundle.prefixes[0].opening_text);
  assert.equal(state.resistanceActionRegisterStudy.trigger_precomputed_raw.dagPreflight.publicOnly, true);
  assert.equal(state.resistanceActionRegisterStudy.final_learner_without_tutor_reply, true);
  assert.deepEqual(
    events.map((event) => event.type),
    ['resistance_action_register_execution_start', 'tutor_opening'],
  );

  const drifted = structuredClone(loaded.bundle);
  drifted.prefixes[0].trigger_learner_text += ' drift';
  assert.throws(
    () =>
      validateTutorStubResistanceActionRegisterPrefixBundle({
        bundle: drifted,
        registration: loaded.registration.registration,
        registrationSha256: loaded.registration.sha256,
      }),
    /public bytes do not reproduce/u,
  );
});

test('v2 execution prebinds exactly six unique jobs in each 234-cap create-once batch', () => {
  const temporary = path.join(os.tmpdir(), `resistance-action-register-preflight-${process.pid}`);
  const a = buildTutorStubResistanceActionRegisterBatchPlan({ repeat: 'A', destination: `${temporary}-a` });
  const b = buildTutorStubResistanceActionRegisterBatchPlan({ repeat: 'B', destination: `${temporary}-b` });
  for (const [plan, repeat] of [
    [a, 'A'],
    [b, 'B'],
  ]) {
    assert.equal(plan.repeat, repeat);
    assert.equal(plan.jobs.length, 6);
    assert.equal(new Set(plan.jobs.map((job) => `${job.prefix_id}:${job.treatment.realization}`)).size, 6);
    assert.equal(plan.budget.maximum_model_attempt_reservations_per_dialogue, 39);
    assert.equal(plan.budget.maximum_model_attempt_reservations, 234);
    assert.ok(plan.jobs.every((job) => job.command.args.includes('--acknowledge-research-use')));
    assert.ok(
      plan.jobs.every((job) =>
        job.command.args.some(
          (value, index) => value === '--artifact-archive' && job.command.args[index + 1] === 'required',
        ),
      ),
    );
    assert.ok(plan.jobs.every((job) => job.command.args.includes('--expected-source-commit') === false));
    assert.ok(
      plan.jobs.every((job) => job.command.env.TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS === 'prospective_v4'),
    );
  }
  assert.notEqual(a.destination, b.destination);
  assert.throws(
    () => assertTutorStubResistanceActionRegisterCleanSource(' M services/drift.js'),
    /requires a clean source checkout/u,
  );
});

test('v2 combined analyzer refuses partial assembly and completes all 12 exact cells only after both seals', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'resistance-action-register-analysis-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const batchA = path.join(temporary, 'batch-a');
  const batchB = path.join(temporary, 'batch-b');
  const planA = buildTutorStubResistanceActionRegisterBatchPlan({ repeat: 'A', destination: batchA });
  const planB = buildTutorStubResistanceActionRegisterBatchPlan({ repeat: 'B', destination: batchB });
  writeSyntheticBatch(batchA, planA);
  assert.throws(
    () =>
      analyzeTutorStubResistanceActionRegisterBaseline({
        batchA,
        batchB,
        expectedSourceCommit: planA.source.commit,
      }),
    /refuses partial batch/u,
  );
  writeSyntheticBatch(batchB, planB);
  const report = analyzeTutorStubResistanceActionRegisterBaseline({
    batchA,
    batchB,
    expectedSourceCommit: planA.source.commit,
  });
  assert.equal(report.status, 'complete_registered_baseline');
  assert.equal(report.assembly.dialogues, 12);
  assert.equal(report.assembly.exact_cells, 12);
  assert.deepEqual(report.assembly.reservations_by_batch, { batch_A: 36, batch_B: 36 });
  assert.equal(report.endpoint_status.same_treatment_repeat_stability, 'complete');
  assert.equal(report.endpoint_status.action_register_fidelity_and_safety, 'complete');
  assert.deepEqual(report.summary.treatment_fidelity, {
    status: 'complete',
    action_visibility_rate: 1,
    action_visibility_minimum: 0.9,
    register_visibility_rate: 1,
    register_visibility_minimum: 0.9,
    primary_analysis: 'intention_to_treat',
    failed_disposition: 'fail_interpretability_gate_not_rerun',
    protected_condition_rate: 0,
    safety_override_rate: 0,
    valid_unit_rerun_authorized: false,
  });
  assert.equal(
    report.rows.every((row) => row.outcome.recovered),
    true,
  );
  assert.equal(
    report.rows.every((row) => row.execution.technical_recovery_used === false),
    true,
  );
  assert.equal(report.summary.stable_repeat_pairs, 6);
  assert.match(report.claim_boundary, /does not establish matched-versus-mismatched action efficacy/u);
});

test('v2 combined analyzer reads treatment fidelity and fails its interpretability gate without rerunning', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'resistance-action-register-fidelity-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const batchA = path.join(temporary, 'batch-a');
  const batchB = path.join(temporary, 'batch-b');
  const planA = buildTutorStubResistanceActionRegisterBatchPlan({ repeat: 'A', destination: batchA });
  const planB = buildTutorStubResistanceActionRegisterBatchPlan({ repeat: 'B', destination: batchB });
  writeSyntheticBatch(batchA, planA, {
    fidelityByJob: { [planA.jobs[0].id]: { actionVisible: false } },
  });
  writeSyntheticBatch(batchB, planB, {
    fidelityByJob: { [planB.jobs[0].id]: { actionVisible: false } },
  });

  const report = analyzeTutorStubResistanceActionRegisterBaseline({
    batchA,
    batchB,
    expectedSourceCommit: planA.source.commit,
  });
  assert.equal(report.endpoint_status.action_register_fidelity_and_safety, 'failed_interpretability_gate_not_rerun');
  assert.equal(report.summary.treatment_fidelity.action_visibility_rate, 10 / 12);
  assert.equal(report.summary.treatment_fidelity.register_visibility_rate, 1);
  assert.equal(report.summary.treatment_fidelity.valid_unit_rerun_authorized, false);
  assert.equal(report.interpretation_status, 'interpretability_gate_failed_no_rerun_or_efficacy_interpretation');
});

test('v2 combined analyzer retains a protected safety override ITT without crediting assigned-register fidelity', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'resistance-action-register-safety-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const batchA = path.join(temporary, 'batch-a');
  const batchB = path.join(temporary, 'batch-b');
  const planA = buildTutorStubResistanceActionRegisterBatchPlan({ repeat: 'A', destination: batchA });
  const planB = buildTutorStubResistanceActionRegisterBatchPlan({ repeat: 'B', destination: batchB });
  const overrideJob = planA.jobs.find((job) => job.treatment.register === 'warm');
  writeSyntheticBatch(batchA, planA, {
    fidelityByJob: { [overrideJob.id]: { safetyOverrideReason: 'protected_affect' } },
  });
  writeSyntheticBatch(batchB, planB);

  const report = analyzeTutorStubResistanceActionRegisterBaseline({
    batchA,
    batchB,
    expectedSourceCommit: planA.source.commit,
  });
  const row = report.rows.find((candidate) => candidate.case_id === overrideJob.id);
  assert.deepEqual(row.fidelity, {
    action_visible: true,
    register_visible: false,
    safety_override: true,
    protected_condition: true,
  });
  assert.equal(report.summary.treatment_fidelity.register_visibility_rate, 11 / 12);
  assert.equal(report.summary.treatment_fidelity.protected_condition_rate, 1 / 12);
  assert.equal(report.summary.treatment_fidelity.safety_override_rate, 1 / 12);
  assert.equal(report.endpoint_status.action_register_fidelity_and_safety, 'complete');
  assert.equal(report.summary.treatment_fidelity.valid_unit_rerun_authorized, false);
});

test('v2 combined analyzer fails closed on missing fidelity, runtime drift, and alternative traces', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'resistance-action-register-integrity-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const makePair = (label) => {
    const batchA = path.join(temporary, `${label}-batch-a`);
    const batchB = path.join(temporary, `${label}-batch-b`);
    const planA = buildTutorStubResistanceActionRegisterBatchPlan({ repeat: 'A', destination: batchA });
    const planB = buildTutorStubResistanceActionRegisterBatchPlan({ repeat: 'B', destination: batchB });
    writeSyntheticBatch(batchA, planA);
    writeSyntheticBatch(batchB, planB);
    return { batchA, batchB, planA, planB };
  };

  const missingFidelity = makePair('missing-fidelity');
  mutateSyntheticBatchTrace(missingFidelity.batchA, missingFidelity.planA.jobs[0].id, (events) => {
    const trigger = events.find((event) => event.type === 'turn_complete' && event.turn === 1);
    delete trigger.turnRecord.responseConfigurationAudit;
    return events;
  });
  assert.throws(
    () =>
      analyzeTutorStubResistanceActionRegisterBaseline({
        batchA: missingFidelity.batchA,
        batchB: missingFidelity.batchB,
        expectedSourceCommit: missingFidelity.planA.source.commit,
      }),
    /lacks typed action\/register visibility evidence/u,
  );

  const runtimeDrift = makePair('runtime-drift');
  mutateSyntheticBatchTrace(runtimeDrift.batchA, runtimeDrift.planA.jobs[0].id, (events) => {
    const start = events.find((event) => event.type === 'run_start');
    start.metadata.sessionRecipe.config.options['cli-effort'] = 'medium';
    return events;
  });
  assert.throws(
    () =>
      analyzeTutorStubResistanceActionRegisterBaseline({
        batchA: runtimeDrift.batchA,
        batchB: runtimeDrift.batchB,
        expectedSourceCommit: runtimeDrift.planA.source.commit,
      }),
    /violates its observed Luna route, runtime, horizon, or semantics pins/u,
  );

  const dirtyTrace = makePair('dirty-trace');
  mutateSyntheticBatchTrace(dirtyTrace.batchA, dirtyTrace.planA.jobs[0].id, (events) => {
    const start = events.find((event) => event.type === 'run_start');
    start.metadata.provenance.git.dirty = true;
    return events;
  });
  assert.throws(
    () =>
      analyzeTutorStubResistanceActionRegisterBaseline({
        batchA: dirtyTrace.batchA,
        batchB: dirtyTrace.batchB,
        expectedSourceCommit: dirtyTrace.planA.source.commit,
      }),
    /violates its observed Luna route, runtime, horizon, or semantics pins/u,
  );

  const effortDrift = makePair('effort-drift');
  mutateSyntheticBatchTrace(effortDrift.batchA, effortDrift.planA.jobs[0].id, (events) => {
    const call = events.find((event) => event.type === 'model_call');
    call.response.effort = 'medium';
    return events;
  });
  assert.throws(
    () =>
      analyzeTutorStubResistanceActionRegisterBaseline({
        batchA: effortDrift.batchA,
        batchB: effortDrift.batchB,
        expectedSourceCommit: effortDrift.planA.source.commit,
      }),
    /violates its observed Luna route, runtime, horizon, or semantics pins/u,
  );

  const outOfEnvelope = makePair('out-of-envelope');
  mutateSyntheticBatchTrace(outOfEnvelope.batchA, outOfEnvelope.planA.jobs[0].id, (events) => {
    events.push(
      { type: 'model_call_budget_reserved', role: 'tutor_stub_tutor', turn: 3 },
      {
        type: 'model_call',
        role: 'tutor_stub_tutor',
        turn: 3,
        provider: 'codex',
        model: 'gpt-5.6-luna',
        response: { effort: 'low' },
      },
    );
    return events;
  });
  assert.throws(
    () =>
      analyzeTutorStubResistanceActionRegisterBaseline({
        batchA: outOfEnvelope.batchA,
        batchB: outOfEnvelope.batchB,
        expectedSourceCommit: outOfEnvelope.planA.source.commit,
      }),
    /violates its observed Luna route, runtime, horizon, or semantics pins/u,
  );

  const loneReservation = makePair('lone-reservation');
  mutateSyntheticBatchTrace(loneReservation.batchA, loneReservation.planA.jobs[0].id, (events) => {
    events.push({ type: 'model_call_budget_reserved', role: 'tutor_stub_tutor', turn: 3 });
    return events;
  });
  assert.throws(
    () =>
      analyzeTutorStubResistanceActionRegisterBaseline({
        batchA: loneReservation.batchA,
        batchB: loneReservation.batchB,
        expectedSourceCommit: loneReservation.planA.source.commit,
      }),
    /model-attempt reservations do not match its observed attempt envelope/u,
  );

  const planDrift = makePair('plan-drift');
  const planPath = path.join(planDrift.batchA, 'batch-plan.json');
  const sealPath = path.join(planDrift.batchA, 'batch-seal.json');
  const driftedPlan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  driftedPlan.jobs[0].treatment.register = 'warm';
  writeJson(planPath, driftedPlan);
  const driftedSeal = JSON.parse(fs.readFileSync(sealPath, 'utf8'));
  driftedSeal.plan_sha256 = fileSha256(planPath);
  writeJson(sealPath, driftedSeal);
  assert.throws(
    () =>
      analyzeTutorStubResistanceActionRegisterBaseline({
        batchA: planDrift.batchA,
        batchB: planDrift.batchB,
        expectedSourceCommit: planDrift.planA.source.commit,
      }),
    /plan or command drifted from the registered live execution plan/u,
  );

  const commandDrift = makePair('command-drift');
  const commandPlanPath = path.join(commandDrift.batchA, 'batch-plan.json');
  const commandSealPath = path.join(commandDrift.batchA, 'batch-seal.json');
  const commandPlan = JSON.parse(fs.readFileSync(commandPlanPath, 'utf8'));
  commandPlan.jobs[0].command.env.TUTOR_STUB_REMEMBER_SETTINGS = '1';
  writeJson(commandPlanPath, commandPlan);
  const commandSeal = JSON.parse(fs.readFileSync(commandSealPath, 'utf8'));
  commandSeal.plan_sha256 = fileSha256(commandPlanPath);
  writeJson(commandSealPath, commandSeal);
  assert.throws(
    () =>
      analyzeTutorStubResistanceActionRegisterBaseline({
        batchA: commandDrift.batchA,
        batchB: commandDrift.batchB,
        expectedSourceCommit: commandDrift.planA.source.commit,
      }),
    /plan or command drifted from the registered live execution plan/u,
  );

  const alternatives = makePair('alternatives');
  fs.writeFileSync(path.join(alternatives.planA.jobs[0].command.trace_dir, 'alternative.jsonl'), '');
  assert.throws(
    () =>
      analyzeTutorStubResistanceActionRegisterBaseline({
        batchA: alternatives.batchA,
        batchB: alternatives.batchB,
        expectedSourceCommit: alternatives.planA.source.commit,
      }),
    /exactly its one selected trace; alternatives are forbidden/u,
  );
});

test('v2 combined analyzer admits only bounded missing-unit recovery under unchanged dialogue and batch caps', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'resistance-action-register-recovery-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const batchA = path.join(temporary, 'batch-a');
  const batchB = path.join(temporary, 'batch-b');
  const planA = buildTutorStubResistanceActionRegisterBatchPlan({ repeat: 'A', destination: batchA });
  const planB = buildTutorStubResistanceActionRegisterBatchPlan({ repeat: 'B', destination: batchB });
  const recoveredJobId = planA.jobs[0].id;
  const recovery = writeSyntheticRecoveredBatch(batchA, planA, recoveredJobId);
  writeSyntheticBatch(batchB, planB);

  const report = analyzeTutorStubResistanceActionRegisterBaseline({
    batchA,
    batchB,
    expectedSourceCommit: planA.source.commit,
  });
  assert.deepEqual(report.assembly.reservations_by_batch, { batch_A: 37, batch_B: 36 });
  assert.deepEqual(
    report.rows.filter((row) => row.execution.technical_recovery_used).map((row) => row.case_id),
    [recoveredJobId],
  );
  assert.equal(report.rows.find((row) => row.case_id === recoveredJobId).execution.model_attempt_reservations, 7);

  const recoveryPlan = JSON.parse(fs.readFileSync(recovery.recoveryPlanPath, 'utf8'));
  recoveryPlan.jobs[0].command.env.TUTOR_STUB_REMEMBER_SETTINGS = '1';
  writeJson(recovery.recoveryPlanPath, recoveryPlan);
  const seal = JSON.parse(fs.readFileSync(recovery.sealPath, 'utf8'));
  seal.recovery_plan_sha256 = fileSha256(recovery.recoveryPlanPath);
  writeJson(recovery.sealPath, seal);
  assert.throws(
    () =>
      analyzeTutorStubResistanceActionRegisterBaseline({
        batchA,
        batchB,
        expectedSourceCommit: planA.source.commit,
      }),
    /recovery command drifted/u,
  );
  recoveryPlan.jobs[0].command.env.TUTOR_STUB_REMEMBER_SETTINGS = '0';
  recoveryPlan.valid_unit_ids_excluded.pop();
  writeJson(recovery.recoveryPlanPath, recoveryPlan);
  seal.recovery_plan_sha256 = fileSha256(recovery.recoveryPlanPath);
  writeJson(recovery.sealPath, seal);
  assert.throws(
    () =>
      analyzeTutorStubResistanceActionRegisterBaseline({
        batchA,
        batchB,
        expectedSourceCommit: planA.source.commit,
      }),
    /reran a valid unit or drifted/u,
  );
});

test('v2 registration fails closed on prefix, assignment, and reservation drift', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'resistance-registration-v2-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const registration = JSON.parse(fs.readFileSync(REGISTRATION_V2_PATH, 'utf8'));
  const rejects = (name, mutate, pattern) => {
    const candidate = structuredClone(registration);
    mutate(candidate);
    const filePath = path.join(directory, `${name}.json`);
    fs.writeFileSync(filePath, `${JSON.stringify(candidate, null, 2)}\n`);
    assert.throws(() => loadTutorStubResistanceActionRegisterRegistration(filePath), pattern);
  };

  rejects(
    'missing-prefix',
    (candidate) => candidate.design.trigger.frozenPrefixSource.prefixes.pop(),
    /three distinct V4 target prefixes/u,
  );
  rejects(
    'mismatched-action',
    (candidate) => {
      candidate.design.factors.actionFit.assignments.frame_refuser.matched = 'ask_discriminating_question';
    },
    /matched move at test_bounded_distinction/u,
  );
  rejects(
    'batch-ceiling',
    (candidate) => {
      candidate.executionReadiness.batches[0].maximumModelAttemptReservations = 235;
    },
    /two six-dialogue batches capped at 234/u,
  );
});

test('v2 endpoint proves the combined 12-case baseline and its two-repeat stability with zero calls and writes', () => {
  const loaded = loadTutorStubResistanceActionRegisterRegistration(REGISTRATION_V2_PATH);
  const contract = JSON.parse(fs.readFileSync(ENDPOINT_V2_PATH, 'utf8'));
  const certificate = JSON.parse(fs.readFileSync(ENDPOINT_GO_V2_PATH, 'utf8'));
  const preflight = runTutorStubResistanceActionRegisterEndpointPreflight({
    contract,
    registration: loaded.registration,
  });
  const readiness = runTutorStubResistanceActionRegisterZeroCall({
    registrationPath: path.relative(ROOT, REGISTRATION_V2_PATH),
    endpointContractPath: path.relative(ROOT, ENDPOINT_V2_PATH),
  });
  const certificateValidation = validatePaidStudyEndpointGoCertificate({ certificate, contract, preflight });

  assert.equal(contract.registration.registration_sha256, loaded.sha256);
  assert.equal(preflight.status, 'passed');
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(preflight.registered_scale.cases, 12);
  assert.equal(preflight.packet_audit.packets, 3);
  assert.equal(preflight.packet_audit.covered_cases, 12);
  assert.equal(preflight.assembly_audit.endpoint_status.same_treatment_repeat_stability, 'complete');
  assert.equal(certificate.contract_sha256, hashPaidStudyEndpointValue(contract));
  assert.equal(certificateValidation.ok, true, certificateValidation.errors.join('; '));
  assert.equal(readiness.status, 'passed_hold');
  assert.equal(readiness.live_execution_available, true);
});
