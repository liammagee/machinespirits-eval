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
  assertTutorStubBoredomProofDagRecoveryBudget,
  buildTutorStubBoredomProofDagBatchPlan,
  classifyTutorStubBoredomProofDagChildFailure,
  selectTutorStubBoredomProofDagRecoveryCandidates,
} from '../scripts/run-tutor-stub-boredom-action-register-proof-dag.js';
import {
  configureTutorStubBoredomProofDagExecution,
  loadTutorStubBoredomProofDagStudy,
} from '../services/tutorStubBoredomActionRegisterProofDagStudy.js';
import { applyTutorStubResistanceActionRegisterStudyIntervention } from '../services/tutorStubResistanceActionRegisterStudy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v1.json';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function route() {
  return { ref: 'codex.gpt-5.6-luna', provider: 'codex', model: 'gpt-5.6-luna', cli: true };
}

function calls(role, turn) {
  return [
    { type: 'model_call_budget_reserved', role, turn, provider: 'codex', model: 'gpt-5.6-luna' },
    { type: 'model_call', role, turn, provider: 'codex', model: 'gpt-5.6-luna', response: { effort: 'low' } },
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

function syntheticTrace({ job, plan, recovered, progressed }) {
  const triggerTurn = job.assignment_index % 2 === 0 ? 2 : 1;
  const outcomeTurn = triggerTurn + 2;
  const triggerText = `Whatever. I have no interest in working through this proof ${job.id}.`;
  const triggerSha = sha256(triggerText);
  const recoveryText = 'The public mark supports the left branch, so I will test that premise next.';
  const nonRecoveryText = 'Fine. Whatever you say.';
  const callRows = [
    ...calls('tutor_stub_opening', 0),
    ...Array.from({ length: outcomeTurn }, (_, index) => calls('tutor_stub_auto_learner', index + 1)).flat(),
    ...Array.from({ length: outcomeTurn }, (_, index) => calls('tutor_stub_learner_analysis', index + 1)).flat(),
    ...Array.from({ length: outcomeTurn - 1 }, (_, index) => calls('tutor_stub_tutor', index + 1)).flat(),
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
          observationSemantics: 'prospective_v4',
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

function writeSyntheticBatch(root, plan, outcomes) {
  fs.mkdirSync(path.join(root, 'jobs'), { recursive: true });
  writeJson(path.join(root, 'batch-plan.json'), plan);
  const results = plan.jobs.map((job) => {
    fs.mkdirSync(job.command.trace_dir, { recursive: true });
    const tracePath = path.join(job.command.trace_dir, `${job.id}.jsonl`);
    const source = `${syntheticTrace({ job, plan, ...outcomes.get(job.id) })
      .map((event) => JSON.stringify(event))
      .join('\n')}\n`;
    fs.writeFileSync(tracePath, source);
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
    status: 'complete',
    completed_dialogues: 4,
    failed_or_missing_dialogues: 0,
    maximum_model_attempt_reservations: 240,
    results,
  });
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
    learnerText: 'Whatever. I have no interest in working through this proof.',
    classification: boredClassification(),
    tutorLearnerDag: { model: { turn: 2 } },
  });
  assert.equal(applied.action_family, 'stage_next_step');
  assert.equal(applied.selected_register, job.realization);
  assert.equal(state.resistanceActionRegisterStudy.trigger_turn, 2);
  assert.equal(events[0].assignmentManifestSha256, loaded.plan.assignment_manifest_sha256);
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
  assert.equal(report.assembly.dialogues, 36);
  assert.equal(report.assembly.distinct_fresh_public_prefixes, 36);
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
