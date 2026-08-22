import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { analyzeTutorStubBoredomProofDag } from '../scripts/analyze-tutor-stub-boredom-action-register-proof-dag.js';
import {
  assertTutorStubBoredomProofDagLaunchAuthorization,
  assertTutorStubBoredomProofDagRecoveryBudget,
  assertTutorStubBoredomProofDagSourceClosure,
  buildTutorStubBoredomProofDagBatchPlan,
  sealTutorStubBoredomProofDagBatchWithRegisteredStops,
  classifyTutorStubBoredomProofDagChildFailure,
  frozenTutorStubBoredomProofDagSourceClosure,
  runTutorStubBoredomProofDagBatch,
  selectTutorStubBoredomProofDagRecoveryCandidates,
  tutorStubBoredomProofDagDesignFingerprint,
} from '../scripts/run-tutor-stub-boredom-action-register-proof-dag.js';
import {
  configureTutorStubBoredomProofDagFromCli,
  configureTutorStubBoredomProofDagExecution,
  loadTutorStubBoredomProofDagStudy,
} from '../services/tutorStubBoredomActionRegisterProofDagStudy.js';
import { createTutorStubAutomatedLearnerGenerationRuntime } from '../services/tutorStubAutomatedLearnerGenerationRuntime.js';
import { applyTutorStubResistanceActionRegisterStudyIntervention } from '../services/tutorStubResistanceActionRegisterStudy.js';
import {
  learnerProfileContract,
  learnerProfileIds,
  learnerProfilePrompt,
} from '../scripts/tutor-stub-learner-profile-contracts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v2.json';
const REGISTRATION_V3 = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v3.json';
const REGISTRATION_V4 = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v4.json';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function commandArgs(command) {
  const values = {};
  for (let index = 1; index < command.args.length; index += 1) {
    const token = command.args[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = command.args[index + 1];
    if (next && !next.startsWith('--')) {
      values[key] = next;
      index += 1;
    } else {
      values[key] = true;
    }
  }
  return values;
}

function route(model = 'gpt-5.6-luna') {
  return { ref: `codex.${model}`, provider: 'codex', model, cli: true };
}

function calls(role, turn) {
  const model = role === 'tutor_stub_boredom_performance_adjudication' ? 'gpt-5.6-sol' : 'gpt-5.6-luna';
  return [
    { type: 'model_call_budget_reserved', role, turn, provider: 'codex', model },
    { type: 'model_call', role, turn, provider: 'codex', model, response: { effort: 'low' } },
  ];
}

function boredClassification() {
  return {
    turn: {
      request_type: 'off_task_or_mixed',
      discourse_move: 'off_task',
      evidence_use: 'none',
      epistemic_stance: 'resistant',
      agency: 'complying',
    },
  };
}

function engagedClassification() {
  return {
    turn: {
      request_type: 'bounded_test_response',
      discourse_move: 'evidence_adoption',
      evidence_use: 'cites_public_evidence',
      epistemic_stance: 'grounded',
      agency: 'attempting',
    },
  };
}

function dagModel({ progressed }) {
  return {
    metrics: {
      groundedCount: progressed ? 5 : 4,
      missingPremiseCount: progressed ? 5 : 6,
    },
    assessment: {
      bestPathCoverage: progressed ? 0.6 : 0.4,
      unsupportedAssertionCount: 0,
    },
  };
}

function syntheticTrace({ job, plan, recovered, progressed, observationSemantics = 'prospective_v8' }) {
  const triggerTurn = job.assignment_index % 2 === 0 ? 2 : 1;
  const outcomeTurn = triggerTurn + 2;
  const triggerText = `Whatever. I will not work through this proof ${job.id}.`;
  const triggerSha = sha256(triggerText);
  const recoveryText = 'The public mark supports the left branch, so I will test that premise next.';
  const nonRecoveryText = 'Fine. Whatever you say.';
  const callRows = [
    ...calls('tutor_stub_opening', 0),
    ...Array.from({ length: outcomeTurn }, (_, index) => calls('tutor_stub_auto_learner', index + 1)).flat(),
    ...Array.from({ length: outcomeTurn }, (_, index) => calls('tutor_stub_learner_analysis', index + 1)).flat(),
    ...Array.from({ length: outcomeTurn - 1 }, (_, index) => calls('tutor_stub_tutor', index + 1)).flat(),
    ...(observationSemantics === 'prospective_v9'
      ? Array.from({ length: triggerTurn }, (_, index) =>
          calls('tutor_stub_boredom_performance_adjudication', index + 1),
        ).flat()
      : []),
  ];
  const completed = Array.from({ length: outcomeTurn - 1 }, (_, index) => {
    const turn = index + 1;
    const isTrigger = turn === triggerTurn;
    const isPost = turn === triggerTurn + 1;
    return {
      type: 'turn_complete',
      turn,
      turnRecord: {
        learner: isTrigger
          ? triggerText
          : isPost
            ? recovered
              ? recoveryText
              : nonRecoveryText
            : 'I am inspecting the public record.',
        tutor: `Tutor turn ${turn}.`,
        classification: isTrigger
          ? boredClassification()
          : isPost && recovered
            ? engagedClassification()
            : boredClassification(),
        ...(isTrigger
          ? {
              tutorLearnerDagModel: dagModel({ progressed: false }),
              responseConfigurationAudit: {
                axes: {
                  action_family: { selected: 'stage_next_step', visible: true },
                  engagement_stance: { selected: job.realization, visible: true },
                },
              },
            }
          : {}),
      },
    };
  });
  return [
    {
      type: 'run_start',
      metadata: {
        provenance: { git: { sha: plan.source.commit, dirty: false } },
        lab: { admission: { modelCallBudget: 60 } },
        experiment: {
          runSeed: job.seed,
          profile: 'bored',
          policy: 'field',
          repeat: job.assignment_index,
          jobId: job.id,
        },
        autoLearner: {
          observationSemantics,
          maxTurns: 4,
          profileId: 'bored',
          modelRef: 'codex.gpt-5.6-luna',
        },
        sessionRecipe: {
          schema: 'machinespirits.tutor-stub.session-recipe.v1',
          config: {
            identity: {
              models: { classifier: route(), learner: route(), reasoning: route(), tutor: route() },
              world: { id: job.world },
            },
            options: {
              'cli-effort': 'low',
              'run-seed': String(job.seed),
              'auto-turns': '4',
              'model-call-budget': '60',
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
      type: 'resistance_action_register_boredom_proof_dag_execution_start',
      jobId: job.id,
      batchId: job.batch_id,
      assignmentIndex: job.assignment_index,
      runSeed: job.seed,
      world: job.world,
      registrationSha256: plan.source.registration_sha256,
      assignmentManifestSha256: job.assignment_manifest_sha256,
      assignmentRankSha256: job.assignment_rank_sha256,
      freshIndependentDialogue: true,
      priorDialogueReused: false,
      priorOutcomePooled: false,
    },
    ...(observationSemantics === 'prospective_v9'
      ? Array.from({ length: triggerTurn }, (_, index) => {
          const turn = index + 1;
          const candidate = turn === triggerTurn ? triggerText : 'I am inspecting the public record.';
          return {
            type: 'boredom_semantic_adjudication',
            turn,
            adjudication: {
              candidate_sha256: sha256(candidate),
              measurement_disposition: turn === triggerTurn ? 'actionable_boredom' : 'productive_uptake',
              independent_route: { required_model_ref: 'codex.gpt-5.6-sol', matches: true },
              low_confidence: false,
              parse_ok: true,
            },
          };
        })
      : []),
    {
      type: 'resistance_action_register_intervention_applied',
      turn: triggerTurn,
      triggerTurn,
      triggerLearnerSha256: triggerSha,
      intervention: {
        status: 'applied',
        assignment: {
          action_fit: 'matched',
          pedagogical_move: 'ask_discriminating_question',
          realization: job.realization,
          register: job.realization,
          repeat: job.batch_id,
          batch_id: job.batch_id,
        },
        safety_override: {
          applied: false,
          assigned_register: job.realization,
          delivered_register: job.realization,
          reason: null,
        },
      },
    },
    ...callRows,
    ...completed,
    {
      type: 'resistance_action_register_outcome_learner_turn',
      turn: outcomeTurn,
      triggerTurn,
      triggerLearnerSha256: triggerSha,
      learnerText: recovered ? recoveryText : nonRecoveryText,
      classification: recovered ? engagedClassification() : boredClassification(),
      tutorLearnerDag: { model: dagModel({ progressed }) },
      tutorReplyGenerated: false,
    },
  ];
}

function writeSyntheticBatch(
  root,
  plan,
  outcomes,
  { observationSemantics = 'prospective_v8', stoppedJobIds = [] } = {},
) {
  fs.mkdirSync(path.join(root, 'jobs'), { recursive: true });
  writeJson(path.join(root, 'batch-plan.json'), plan);
  const results = plan.jobs.map((job) => {
    fs.mkdirSync(job.command.trace_dir, { recursive: true });
    const tracePath = path.join(job.command.trace_dir, `${job.id}.jsonl`);
    const source = `${syntheticTrace({
      job,
      plan,
      ...outcomes.get(job.id),
      observationSemantics,
    })
      .map((event) => JSON.stringify(event))
      .join('\n')}\n`;
    fs.writeFileSync(tracePath, source);
    if (stoppedJobIds.includes(job.id)) {
      return {
        job_id: job.id,
        status: 'failed',
        exit_code: 1,
        signal: null,
        trace: path.relative(ROOT, tracePath),
        trace_sha256: sha256(source),
        trace_bytes: Buffer.byteLength(source),
        failure: {
          category: 'substantive_registered_failure',
          code: 'TUTOR_STUB_BOREDOM_MEASUREMENT_INDETERMINATE',
          disposition: 'measurement_indeterminate_stop_no_repair_no_replacement',
          recoverable: false,
        },
        stdout: path.relative(ROOT, path.join(job.command.job_root, 'stdout.log')),
        stderr: path.relative(ROOT, path.join(job.command.job_root, 'stderr.log')),
        transcript: path.relative(ROOT, job.command.transcript),
      };
    }
    return {
      job_id: job.id,
      status: 'complete',
      exit_code: 0,
      signal: null,
      trace: path.relative(ROOT, tracePath),
      trace_sha256: sha256(source),
      trace_bytes: Buffer.byteLength(source),
      stdout: path.relative(ROOT, path.join(job.command.job_root, 'stdout.log')),
      stderr: path.relative(ROOT, path.join(job.command.job_root, 'stderr.log')),
      transcript: path.relative(ROOT, job.command.transcript),
    };
  });
  const resultPath = path.join(root, 'batch-result.json');
  writeJson(resultPath, {
    schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-live-batch-result.v1',
    batch_id: plan.batch_id,
    status: stoppedJobIds.length ? 'incomplete' : 'complete',
    completed_dialogues: 4 - stoppedJobIds.length,
    failed_or_missing_dialogues: stoppedJobIds.length,
    maximum_model_attempt_reservations: 240,
    results,
  });
  if (stoppedJobIds.length) {
    // Seal through the runner's own code, so the test covers the real seal
    // rather than a copy of it.
    sealTutorStubBoredomProofDagBatchWithRegisteredStops({ destination: root });
    return;
  }
  writeJson(path.join(root, 'batch-seal.json'), {
    schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-live-batch-seal.v1',
    status: 'sealed_complete',
    batch_id: plan.batch_id,
    plan_sha256: sha256(fs.readFileSync(path.join(root, 'batch-plan.json'))),
    result_sha256: sha256(fs.readFileSync(resultPath)),
    dialogues: 4,
    hard_ceiling: 240,
    valid_unit_reruns: false,
    outcome_selection: false,
  });
}

function mutateTrace(root, jobId, mutate) {
  const resultPath = path.join(root, 'batch-result.json');
  const sealPath = path.join(root, 'batch-seal.json');
  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  const row = result.results.find((candidate) => candidate.job_id === jobId);
  const tracePath = path.resolve(ROOT, row.trace);
  const events = fs
    .readFileSync(tracePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const source = `${mutate(events)
    .map((event) => JSON.stringify(event))
    .join('\n')}\n`;
  fs.writeFileSync(tracePath, source);
  row.trace_sha256 = sha256(source);
  row.trace_bytes = Buffer.byteLength(source);
  writeJson(resultPath, result);
  const seal = JSON.parse(fs.readFileSync(sealPath, 'utf8'));
  seal.result_sha256 = sha256(fs.readFileSync(resultPath));
  writeJson(sealPath, seal);
}

test('boredom proof-DAG study configuration holds treatment dormant until one public boredom trigger', () => {
  const events = [];
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION) });
  const job = loaded.plan.jobs[0];
  const state = {
    trace: null,
    turns: [],
    history: [],
    register: { palette: ['plain', 'warm'], history: [] },
    world: {},
  };
  configureTutorStubBoredomProofDagExecution({
    state,
    loaded,
    jobId: job.id,
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
  });
  const selection = { response_configuration: {}, selected_register: 'plain' };
  assert.equal(
    applyTutorStubResistanceActionRegisterStudyIntervention({
      selection,
      state,
      learnerText: 'I am inspecting the public record.',
      classification: engagedClassification(),
      tutorLearnerDag: { model: { turn: 1 } },
    }),
    selection,
  );
  const applied = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection,
    state,
    learnerText: 'Whatever. I will not work through this proof.',
    classification: boredClassification(),
    tutorLearnerDag: { model: { turn: 2 } },
  });
  assert.equal(applied.action_family, 'stage_next_step');
  assert.equal(applied.selected_register, job.realization);
  assert.equal(state.resistanceActionRegisterStudy.trigger_turn, 2);
  assert.equal(events[0].assignmentManifestSha256, loaded.plan.assignment_manifest_sha256);
});

test('boredom proof-DAG launch verifies the resolved production learner profile by stable id', () => {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION) });
  const plan = buildTutorStubBoredomProofDagBatchPlan({
    registrationPath: REGISTRATION,
    batchId: 'execution_batch_1',
    destination: path.join(os.tmpdir(), 'boredom-proof-dag-production-profile-id'),
    expectedSourceCommit: head,
  });
  const args = commandArgs(plan.jobs[0].command);
  const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
    appendTraceEvent() {},
    callPromptModel() {
      throw new Error('profile-id launch validation must not call a model');
    },
    classificationFromCombinedAnalysis() {},
    env: { TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS: 'prospective_v8' },
    extractCombinedLearnerAnalysis() {},
    learnerProfileContract,
    learnerProfileIds,
    learnerProfilePrompt,
    negativeFloorRegisters: [],
  });
  args['auto-learner-profile'] = runtime.resolveAutomatedLearnerProfile(args['auto-learner-profile']);
  assert.notEqual(args['auto-learner-profile'], 'bored');
  const resolvedProfileId = runtime.automatedLearnerProfileId(args['auto-learner-profile']);
  assert.equal(resolvedProfileId, 'bored');
  const events = [];
  const state = { trace: null, turns: [], history: [], register: { palette: ['plain', 'warm'], history: [] } };
  const configured = configureTutorStubBoredomProofDagFromCli({
    args,
    state,
    root: ROOT,
    autoLearnerEnabled: true,
    autoLearnerProfileId: resolvedProfileId,
    autoTurns: Number(args['auto-turns']),
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
    observationSemantics: 'prospective_v8',
  });
  assert.equal(configured.loaded.sha256, loaded.sha256);
  assert.equal(configured.job.id, plan.jobs[0].id);
  assert.equal(events[0].type, 'resistance_action_register_boredom_proof_dag_execution_start');
  assert.throws(
    () =>
      configureTutorStubBoredomProofDagFromCli({
        args,
        state,
        root: ROOT,
        autoLearnerEnabled: true,
        autoLearnerProfileId: 'diligent',
        autoTurns: Number(args['auto-turns']),
        appendTraceEvent() {},
        observationSemantics: 'prospective_v8',
      }),
    /launch pins or remaining 60-attempt ceiling drifted/u,
  );
});

test('boredom proof-DAG recovery selects only absent or trace-proven technical units', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-proof-dag-recovery-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const job = (id) => ({ id, command: { trace_dir: path.join(temp, id) } });
  const writeTrace = (id, events) => {
    const directory = path.join(temp, id);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, `${id}.jsonl`),
      `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
    );
  };
  const terminal = { type: 'resistance_action_register_outcome_learner_turn' };
  const transportFailure = {
    type: 'model_call_error',
    cliPolicyViolation: { reason: 'call_retry_limit_reached', audit: { prohibited_event_count: 0 } },
  };
  writeTrace('valid', [terminal]);
  writeTrace('failed', [transportFailure]);
  writeTrace('partial-technical', [transportFailure]);
  const plan = { jobs: [job('valid'), job('failed'), job('partial-technical'), job('missing')] };
  const initial = {
    results: [
      { job_id: 'valid', status: 'complete' },
      { job_id: 'failed', status: 'failed', failure: { category: 'technical_recoverable', recoverable: true } },
    ],
  };
  const selected = selectTutorStubBoredomProofDagRecoveryCandidates({ plan, initial });
  assert.deepEqual([...selected.valid.keys()], ['valid']);
  assert.deepEqual(
    selected.missing.map((row) => row.id),
    ['failed', 'partial-technical', 'missing'],
  );
  const substantive = structuredClone(initial);
  substantive.results[1].failure = classifyTutorStubBoredomProofDagChildFailure({
    events: [{ type: 'auto_learner_profile_adherence_exhausted', profile: 'bored' }],
  });
  assert.equal(substantive.results[1].failure.recoverable, false);
  assert.throws(
    () => selectTutorStubBoredomProofDagRecoveryCandidates({ plan, initial: substantive }),
    /refuses nontechnical or unclassified partial failure/u,
  );

  const semanticIndeterminateEvent = {
    type: 'boredom_semantic_measurement_indeterminate',
    code: 'TUTOR_STUB_BOREDOM_MEASUREMENT_INDETERMINATE',
    disposition: 'measurement_indeterminate_stop_no_repair_no_replacement',
  };
  const semanticIndeterminate = classifyTutorStubBoredomProofDagChildFailure({
    events: [semanticIndeterminateEvent],
    signal: 'SIGTERM',
  });
  assert.deepEqual(semanticIndeterminate, {
    category: 'substantive_registered_failure',
    code: 'TUTOR_STUB_BOREDOM_MEASUREMENT_INDETERMINATE',
    disposition: 'measurement_indeterminate_stop_no_repair_no_replacement',
    recoverable: false,
  });
  writeTrace('semantic-indeterminate', [semanticIndeterminateEvent]);
  assert.throws(
    () =>
      selectTutorStubBoredomProofDagRecoveryCandidates({
        plan: { jobs: [job('semantic-indeterminate')] },
        initial: {
          results: [{ job_id: 'semantic-indeterminate', status: 'failed', failure: semanticIndeterminate }],
        },
      }),
    /refuses nontechnical or unclassified partial failure/u,
  );

  writeTrace('terminal-without-row', [terminal]);
  assert.throws(
    () =>
      selectTutorStubBoredomProofDagRecoveryCandidates({
        plan: { jobs: [job('terminal-without-row')] },
        initial: { results: [] },
      }),
    /refuses completed original output/u,
  );
  writeTrace('unclassified-partial', [{ type: 'run_start' }]);
  assert.throws(
    () =>
      selectTutorStubBoredomProofDagRecoveryCandidates({
        plan: { jobs: [job('unclassified-partial')] },
        initial: { results: [] },
      }),
    /refuses nontechnical or unclassified partial failure/u,
  );

  assert.equal(
    assertTutorStubBoredomProofDagRecoveryBudget({
      missing: [{ id: 'missing' }],
      initialReservations: { valid: 60, missing: 0 },
      usedBefore: 60,
    }),
    true,
  );
  assert.throws(
    () =>
      assertTutorStubBoredomProofDagRecoveryBudget({
        missing: [{ id: 'missing' }],
        initialReservations: { valid: 0, missing: 60 },
        usedBefore: 60,
      }),
    /no room under the unchanged caps/u,
  );
});

test('combined boredom proof-DAG analyzer accepts nine sealed batches and fails closed on provenance drift', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-proof-dag-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION) });
  const outcomes = new Map();
  let plain = 0;
  let warm = 0;
  for (const job of loaded.plan.jobs) {
    const index = job.realization === 'plain' ? ++plain : ++warm;
    const recovered = job.realization === 'plain' ? index <= 4 : index <= 13;
    const progressed = job.realization === 'plain' ? index <= 3 : index <= 12;
    outcomes.set(job.id, { recovered, progressed });
  }
  const roots = [];
  for (let index = 1; index <= 9; index += 1) {
    const root = path.join(temp, `batch-${index}`);
    const plan = buildTutorStubBoredomProofDagBatchPlan({
      registrationPath: REGISTRATION,
      batchId: `execution_batch_${index}`,
      destination: root,
      expectedSourceCommit: head,
    });
    fs.mkdirSync(root, { recursive: true });
    writeSyntheticBatch(root, plan, outcomes);
    roots.push(root);
  }
  const report = analyzeTutorStubBoredomProofDag({
    batchRoots: roots,
    registrationPath: REGISTRATION,
    expectedSourceCommit: head,
  });
  assert.equal(report.assembly.dialogues_planned, 36);
  assert.equal(report.assembly.dialogues_scored, 36);
  assert.equal(report.assembly.distinct_fresh_public_prefixes, 36);
  assert.equal(report.assembly.batches_sealed_complete, 9);
  assert.equal(report.assembly.batches_sealed_with_registered_stops, 0);
  assert.equal(report.attrition.stopped, 0);
  assert.equal(report.attrition.balanced_across_arms, true);
  assert.equal(report.amendment, null);
  assert.equal(report.primary_analysis.allocation_realised_as_predeclared, true);
  assert.equal(
    report.primary_analysis.conditioning,
    'world_success_totals_and_realised_per_world_plain_warm_allocation',
  );
  assert.deepEqual(report.primary_analysis.plain, { successes: 4, total: 18, rate: 4 / 18 });
  assert.deepEqual(report.primary_analysis.warm, { successes: 13, total: 18, rate: 13 / 18 });
  assert.equal(report.primary_analysis.test, 'two_sided_exact_conditional_blocked_score_test');
  assert.equal(report.key_secondary_analysis.fixed_sequence_gate_open, report.primary_analysis.significant_two_sided);
  assert.equal(report.treatment_fidelity.status, 'complete');
  assert.equal(report.assembly.prior_dialogues_reused, 0);
  assert.equal(report.assembly.prior_outcomes_pooled, 0);

  const mutationRoot = roots[0];
  const mutationPlan = JSON.parse(fs.readFileSync(path.join(mutationRoot, 'batch-plan.json'), 'utf8'));
  mutateTrace(mutationRoot, mutationPlan.jobs[0].id, (events) =>
    events.map((event) =>
      event.type === 'resistance_action_register_boredom_proof_dag_execution_start'
        ? { ...event, assignmentManifestSha256: '0'.repeat(64) }
        : event,
    ),
  );
  assert.throws(
    () =>
      analyzeTutorStubBoredomProofDag({
        batchRoots: roots,
        registrationPath: REGISTRATION,
        expectedSourceCommit: head,
      }),
    /blocked randomized assignment/u,
  );
});

test('amendment A1 lets the analyzer read a study short by registered indeterminate stops, and only under a citing amendment', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-proof-dag-short-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION) });
  const outcomes = new Map(loaded.plan.jobs.map((job) => [job.id, { recovered: true, progressed: true }]));
  // Stop one warm unit in each of three different worlds, which is the shape
  // the live run produced: three worlds at three plain against two warm.
  const stoppedByWorld = new Map();
  for (const job of loaded.plan.jobs) {
    if (job.realization === 'warm' && !stoppedByWorld.has(job.world) && stoppedByWorld.size < 3) {
      stoppedByWorld.set(job.world, job.id);
    }
  }
  const stopped = [...stoppedByWorld.values()];
  assert.equal(stopped.length, 3);
  const roots = [];
  for (let index = 1; index <= 9; index += 1) {
    const root = path.join(temp, `batch-${index}`);
    const plan = buildTutorStubBoredomProofDagBatchPlan({
      registrationPath: REGISTRATION,
      batchId: `execution_batch_${index}`,
      destination: root,
      expectedSourceCommit: head,
    });
    fs.mkdirSync(root, { recursive: true });
    writeSyntheticBatch(root, plan, outcomes, {
      stoppedJobIds: plan.jobs.filter((job) => stopped.includes(job.id)).map((job) => job.id),
    });
    roots.push(root);
  }

  // Without an amendment the short study is refused outright.
  assert.throws(
    () =>
      analyzeTutorStubBoredomProofDag({
        batchRoots: roots,
        registrationPath: REGISTRATION,
        expectedSourceCommit: head,
      }),
    /requires a written amendment/u,
  );

  // An amendment citing the wrong registration is refused too.
  const wrongAmendment = path.join(temp, 'wrong-amendment.json');
  writeJson(wrongAmendment, { id: 'A1_wrong', amends: { registrationSha256: '0'.repeat(64) } });
  assert.throws(
    () =>
      analyzeTutorStubBoredomProofDag({
        batchRoots: roots,
        registrationPath: REGISTRATION,
        amendmentPath: path.relative(ROOT, wrongAmendment),
        expectedSourceCommit: head,
      }),
    /does not cite the registration/u,
  );

  const amendmentPath = path.join(temp, 'amendment.json');
  writeJson(amendmentPath, { id: 'A1_realised_block_allocation', amends: { registrationSha256: loaded.sha256 } });
  const report = analyzeTutorStubBoredomProofDag({
    batchRoots: roots,
    registrationPath: REGISTRATION,
    amendmentPath: path.relative(ROOT, amendmentPath),
    expectedSourceCommit: head,
  });
  assert.equal(report.assembly.dialogues_planned, 36);
  assert.equal(report.assembly.dialogues_scored, 33);
  assert.equal(report.assembly.plain_scored, 18);
  assert.equal(report.assembly.warm_scored, 15);
  assert.equal(report.assembly.batches_sealed_with_registered_stops, 3);
  assert.equal(report.amendment.id, 'A1_realised_block_allocation');
  assert.equal(report.attrition.stopped, 3);
  assert.deepEqual(report.attrition.stopped_by_arm, { plain: 0, warm: 3 });
  assert.equal(report.attrition.balanced_across_arms, false);
  assert.equal(report.primary_analysis.allocation_realised_as_predeclared, false);
  // The three touched worlds carry three plain against two warm, and the test
  // conditions on exactly those counts.
  assert.equal(report.primary_analysis.blocks.filter((block) => block.plainN === 3 && block.warmN === 2).length, 3);
  assert.equal(report.primary_analysis.blocks.filter((block) => block.plainN === 3 && block.warmN === 3).length, 3);
  assert.ok(report.interpretation_status.includes('unbalanced_attrition_caveat'));
  assert.match(report.claim_boundary, /Attrition was unbalanced/u);
  // Every unit still spent its model calls, stopped or not, so the reservation
  // total is unchanged by the shortfall.
  assert.equal(report.assembly.total_model_attempt_reservations > 0, true);

  // A technical failure is still refused: only the registered indeterminate
  // stop is admitted as a reason for a missing outcome.
  const technicalRoot = roots[0];
  const technicalResultPath = path.join(technicalRoot, 'batch-result.json');
  const technicalResult = JSON.parse(fs.readFileSync(technicalResultPath, 'utf8'));
  const stoppedRow = technicalResult.results.find((row) => row.status !== 'complete');
  assert.ok(stoppedRow);
  stoppedRow.failure = { category: 'technical_recoverable', code: 'CHILD_KILLED', recoverable: true };
  writeJson(technicalResultPath, technicalResult);
  assert.throws(
    () =>
      analyzeTutorStubBoredomProofDag({
        batchRoots: roots,
        registrationPath: REGISTRATION,
        amendmentPath: path.relative(ROOT, amendmentPath),
        expectedSourceCommit: head,
      }),
    /source, result, or seal contract/u,
  );
});

test('prospective-v9 analyzer requires the independent semantic sequence and rejects indeterminacy', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-proof-dag-v9-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION_V3) });
  const outcomes = new Map(loaded.plan.jobs.map((job) => [job.id, { recovered: true, progressed: true }]));
  const roots = [];
  for (let index = 1; index <= 9; index += 1) {
    const root = path.join(temp, `batch-${index}`);
    const plan = buildTutorStubBoredomProofDagBatchPlan({
      registrationPath: REGISTRATION_V3,
      batchId: `execution_batch_${index}`,
      destination: root,
      expectedSourceCommit: head,
    });
    assert.equal(plan.budget.programme_ceiling, 5000);
    fs.mkdirSync(root, { recursive: true });
    writeSyntheticBatch(root, plan, outcomes, { observationSemantics: 'prospective_v9' });
    roots.push(root);
  }
  const report = analyzeTutorStubBoredomProofDag({
    batchRoots: roots,
    registrationPath: REGISTRATION_V3,
    expectedSourceCommit: head,
  });
  assert.equal(report.rows.length, 36);
  assert.ok(report.rows.every((row) => row.semantic_measurement.authority === 'independent_llm_semantic_adjudicator'));
  assert.ok(report.rows.every((row) => row.semantic_measurement.model_ref === 'codex.gpt-5.6-sol'));
  assert.ok(report.rows.every((row) => row.semantic_measurement.measurement_indeterminate === false));

  const mutationPlan = JSON.parse(fs.readFileSync(path.join(roots[0], 'batch-plan.json'), 'utf8'));
  mutateTrace(roots[0], mutationPlan.jobs[0].id, (events) => [
    ...events,
    {
      type: 'boredom_semantic_measurement_indeterminate',
      turn: 1,
      code: 'TUTOR_STUB_BOREDOM_MEASUREMENT_INDETERMINATE',
    },
  ]);
  assert.throws(
    () =>
      analyzeTutorStubBoredomProofDag({
        batchRoots: roots,
        registrationPath: REGISTRATION_V3,
        expectedSourceCommit: head,
      }),
    /lacks its exact fresh execution, treatment, or outcome event/u,
  );
});

test('validated-instrument v4 lineage runs the same analyzer and still rejects indeterminacy', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-proof-dag-v4-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION_V4) });
  assert.equal(loaded.registration.version, 4);
  const outcomes = new Map(loaded.plan.jobs.map((job) => [job.id, { recovered: true, progressed: true }]));
  const roots = [];
  for (let index = 1; index <= 9; index += 1) {
    const root = path.join(temp, `batch-${index}`);
    // No commit pin, which is how v4 actually launches: the plan records the
    // checkout it ran from instead of refusing to run unless the bytes match a
    // frozen list. The analyser below reads that recorded pin back out.
    const plan = buildTutorStubBoredomProofDagBatchPlan({
      registrationPath: REGISTRATION_V4,
      batchId: `execution_batch_${index}`,
      destination: root,
    });
    assert.equal(plan.budget.programme_ceiling, 5000);
    fs.mkdirSync(root, { recursive: true });
    writeSyntheticBatch(root, plan, outcomes, { observationSemantics: 'prospective_v9' });
    roots.push(root);
  }
  const report = analyzeTutorStubBoredomProofDag({
    batchRoots: roots,
    registrationPath: REGISTRATION_V4,
    expectedSourceCommit: head,
  });
  assert.equal(report.rows.length, 36);
  assert.ok(report.rows.every((row) => row.semantic_measurement.authority === 'independent_llm_semantic_adjudicator'));
  assert.ok(report.rows.every((row) => row.semantic_measurement.model_ref === 'codex.gpt-5.6-sol'));
  assert.ok(report.rows.every((row) => row.semantic_measurement.measurement_indeterminate === false));

  const mutationPlan = JSON.parse(fs.readFileSync(path.join(roots[0], 'batch-plan.json'), 'utf8'));
  mutateTrace(roots[0], mutationPlan.jobs[0].id, (events) => [
    ...events,
    {
      type: 'boredom_semantic_measurement_indeterminate',
      turn: 1,
      code: 'TUTOR_STUB_BOREDOM_MEASUREMENT_INDETERMINATE',
    },
  ]);
  assert.throws(
    () =>
      analyzeTutorStubBoredomProofDag({
        batchRoots: roots,
        registrationPath: REGISTRATION_V4,
        expectedSourceCommit: head,
      }),
    /lacks its exact fresh execution, treatment, or outcome event/u,
  );
});

test('v4 live execution demands an approval bound to the registered design, not to source bytes', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-proof-dag-gate-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION_V4) });

  // Only v4 carries an approval gate at all.
  const loadedV3 = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION_V3) });
  assert.equal(assertTutorStubBoredomProofDagLaunchAuthorization({ loaded: loadedV3 }), null);

  assert.throws(
    () =>
      assertTutorStubBoredomProofDagLaunchAuthorization({
        loaded,
        authorizationPath: path.join(temp, 'missing-authorization.json'),
      }),
    /requires a launch authorization/u,
  );

  const destination = path.join(temp, 'live-batch');
  await assert.rejects(
    runTutorStubBoredomProofDagBatch({
      registrationPath: REGISTRATION_V4,
      batchId: 'execution_batch_1',
      destination,
      launchAuthorizationPath: path.join(temp, 'missing-authorization.json'),
    }),
    /requires a launch authorization/u,
  );
  assert.equal(fs.existsSync(destination), false);

  const fingerprint = tutorStubBoredomProofDagDesignFingerprint({ registration: loaded.registration });
  const authorization = {
    schema: 'machinespirits.tutor-stub.boredom-proof-dag-launch-authorization.v2',
    approvedBy: 'test-fixture-human',
    modelCallsAuthorized: true,
    liveRunAuthorized: true,
    designFingerprint: fingerprint,
    approvalStatement: 'go',
  };
  const authorizationPath = path.join(temp, 'launch-authorization.v4.json');
  writeJson(authorizationPath, authorization);
  const summary = assertTutorStubBoredomProofDagLaunchAuthorization({ loaded, authorizationPath });
  assert.equal(summary.approved_by, 'test-fixture-human');
  assert.equal(summary.design_fingerprint, fingerprint);
  assert.equal(summary.binds, 'study_design');

  // The point of the scheme: an uncommitted file in a dirty checkout is fine,
  // because the approval is about the study, not about which bytes are on disk.
  const untrackedInRepoPath = path.join(
    ROOT,
    'config',
    'test-untracked-boredom-proof-dag-launch-authorization.v4.json',
  );
  assert.equal(fs.existsSync(untrackedInRepoPath), false);
  t.after(() => fs.rmSync(untrackedInRepoPath, { force: true }));
  writeJson(untrackedInRepoPath, authorization);
  assert.equal(
    assertTutorStubBoredomProofDagLaunchAuthorization({
      loaded,
      authorizationPath: path.relative(ROOT, untrackedInRepoPath),
    }).binds,
    'study_design',
  );
  fs.rmSync(untrackedInRepoPath, { force: true });

  // Changing the study does break it. Each of these is a different design.
  const designChanges = [
    (registration) => (registration.design.dialoguesPerArm = 9),
    (registration) => (registration.design.freshPrefixGeneration.seedBase += 1),
    (registration) => (registration.power.targetPower = 0.5),
    (registration) => (registration.measurement.semanticAdjudicator.modelRef = 'codex.gpt-5.6-luna'),
    (registration) => (registration.executionReadiness.hardStudyAttemptCeiling = 9000),
  ];
  for (const mutate of designChanges) {
    const mutated = JSON.parse(JSON.stringify(loaded.registration));
    mutate(mutated);
    assert.notEqual(tutorStubBoredomProofDagDesignFingerprint({ registration: mutated }), fingerprint);
  }

  // Correcting the instrument does not. That is the whole reason for the change.
  const corrected = JSON.parse(JSON.stringify(loaded.registration));
  corrected.measurement.semanticAdjudicator.moduleSha256 = 'f'.repeat(64);
  assert.equal(tutorStubBoredomProofDagDesignFingerprint({ registration: corrected }), fingerprint);

  const refusals = [
    [{ approvedBy: '  ' }, /must name a human/u],
    [{ modelCallsAuthorized: false }, /must name a human/u],
    [{ liveRunAuthorized: false }, /must name a human/u],
    [{ designFingerprint: 'f'.repeat(64) }, /approves a different study design/u],
    [{ approvalStatement: '' }, /must record the approval statement/u],
    [{ schema: 'machinespirits.tutor-stub.boredom-proof-dag-launch-authorization.v1' }, /must use .*\.v2/u],
  ];
  for (const [mutation, pattern] of refusals) {
    const mutatedPath = path.join(temp, `mutated-${Object.keys(mutation)[0]}.json`);
    writeJson(mutatedPath, { ...authorization, ...mutation });
    assert.throws(
      () => assertTutorStubBoredomProofDagLaunchAuthorization({ loaded, authorizationPath: mutatedPath }),
      pattern,
    );
  }
});

test('v4 source pin binds the frozen closure bytes rather than the checkout head', (t) => {
  const loadedV3 = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION_V3) });
  assert.equal(frozenTutorStubBoredomProofDagSourceClosure({ loaded: loadedV3 }), null);
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION_V4) });
  const registeredClosure = frozenTutorStubBoredomProofDagSourceClosure({ loaded });
  assert.equal(registeredClosure.length, 54);
  assert.ok(registeredClosure.some((entry) => entry.path === 'scripts/tutor-stub.js'));

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-proof-dag-closure-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: temp, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.email', 'closure@example.test');
  git('config', 'user.name', 'closure fixture');
  fs.mkdirSync(path.join(temp, 'services'));
  fs.writeFileSync(path.join(temp, 'services', 'pinned-one.js'), 'export const one = 1;\n');
  fs.writeFileSync(path.join(temp, 'services', 'pinned-two.js'), 'export const two = 2;\n');
  git('add', '-A');
  git('commit', '-qm', 'closure');
  const pinnedCommit = git('rev-parse', 'HEAD');

  // The launch authorization can only ever land in a commit after the one the request pins.
  fs.writeFileSync(path.join(temp, 'launch-authorization.json'), '{}\n');
  git('add', '-A');
  git('commit', '-qm', 'launch authorization');
  const head = git('rev-parse', 'HEAD');
  assert.notEqual(head, pinnedCommit);

  const closure = ['services/pinned-one.js', 'services/pinned-two.js'].map((relative) => ({
    path: relative,
    sha256: sha256(fs.readFileSync(path.join(temp, relative))),
  }));
  assert.equal(
    assertTutorStubBoredomProofDagSourceClosure({ expectedSourceCommit: pinnedCommit, closure, root: temp }),
    2,
  );

  assert.throws(
    () => assertTutorStubBoredomProofDagSourceClosure({ expectedSourceCommit: 'HEAD~1', closure, root: temp }),
    /requires one pinned forty-character commit/u,
  );
  assert.throws(
    () => assertTutorStubBoredomProofDagSourceClosure({ expectedSourceCommit: pinnedCommit, closure: [], root: temp }),
    /requires the frozen closure file list/u,
  );
  assert.throws(
    () =>
      assertTutorStubBoredomProofDagSourceClosure({
        expectedSourceCommit: pinnedCommit,
        closure: [...closure, { path: 'services/absent.js', sha256: sha256('') }],
        root: temp,
      }),
    /closure file is absent: services\/absent\.js/u,
  );
  assert.throws(
    () =>
      assertTutorStubBoredomProofDagSourceClosure({
        expectedSourceCommit: pinnedCommit,
        closure: [{ ...closure[0], sha256: 'f'.repeat(64) }],
        root: temp,
      }),
    /closure drift against the frozen request: services\/pinned-one\.js/u,
  );

  // Bytes that match a rewritten closure entry but not the pinned commit still fail closed.
  fs.writeFileSync(path.join(temp, 'services', 'pinned-one.js'), 'export const one = 99;\n');
  assert.throws(
    () =>
      assertTutorStubBoredomProofDagSourceClosure({
        expectedSourceCommit: pinnedCommit,
        closure: [
          { path: 'services/pinned-one.js', sha256: sha256(fs.readFileSync(path.join(temp, closure[0].path))) },
        ],
        root: temp,
      }),
    /closure drift against [0-9a-f]{40}: services\/pinned-one\.js/u,
  );

  const laterOnlyCommit = (() => {
    fs.writeFileSync(path.join(temp, 'services', 'pinned-three.js'), 'export const three = 3;\n');
    git('add', '-A');
    git('commit', '-qm', 'later file');
    return git('rev-parse', 'HEAD');
  })();
  assert.throws(
    () =>
      assertTutorStubBoredomProofDagSourceClosure({
        expectedSourceCommit: pinnedCommit,
        closure: [
          {
            path: 'services/pinned-three.js',
            sha256: sha256(fs.readFileSync(path.join(temp, 'services', 'pinned-three.js'))),
          },
        ],
        root: temp,
      }),
    /closure file is absent at [0-9a-f]{40}: services\/pinned-three\.js/u,
  );
  assert.equal(/^[0-9a-f]{40}$/u.test(laterOnlyCommit), true);
});
