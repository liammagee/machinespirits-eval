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
import {
  applyTutorStubResistanceActionRegisterStudyIntervention,
  tutorStubResistanceHostActionFamily,
} from '../services/tutorStubResistanceActionRegisterStudy.js';
import {
  learnerProfileContract,
  learnerProfileIds,
  learnerProfilePrompt,
} from '../scripts/tutor-stub-learner-profile-contracts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v2.json';
const REGISTRATION_V3 = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v3.json';
const REGISTRATION_V4 = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v4.json';
const REGISTRATION_V5 = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v5.json';
const REGISTRATION_V6 = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v6.json';

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

// A live outcome turn carries two assessments: the counts inside the model, and
// the path detail beside it. Only the second says when the world hands out each
// premise that is still missing, so the fixture must keep them apart the way a
// real trace does.
function dagPathAssessment({ premiseWasAvailable = false, finalTurn = 3 } = {}) {
  return {
    finalTurn,
    bestPathCoverage: 0,
    missingOnBestPath: ['p_two', 'p_three'],
    // A premise the world had already handed out and the learner did not take is
    // one the objective endpoint could have moved on. A premise the world does
    // not hand out until a later turn is one it could not.
    missingPremises: [
      premiseWasAvailable
        ? { premiseId: 'p_two', bucket: 'released_but_not_held', releaseTurn: 2 }
        : { premiseId: 'p_two', bucket: 'unreleased', releaseTurn: 9 },
      { premiseId: 'p_three', bucket: 'unreleased', releaseTurn: 14 },
    ],
  };
}

function syntheticTrace({
  job,
  plan,
  recovered,
  progressed,
  observationSemantics = 'prospective_v8',
  protectedPassOver = false,
  authoredWorldOpening = false,
  premiseWasAvailable = false,
  // The dialogue shape is the registration's, not this file's. v2 to v4 read a
  // trigger by turn 2 and two turns after it; v5 reads a trigger by turn 4 and
  // five turns after it. Written here as literals, a v5 fixture would prove
  // nothing about a v5 run.
  maximumTriggerTurn = 2,
  postTriggerLearnerTurns = 2,
  perDialogueBudget = 60,
  // Pre-trigger turns the adjudicator could not read. Under v5 each one is
  // passed over and the next turn is read, which is what moves the trigger later.
  unreadablePassOverTurns = [],
  forcedTriggerTurn = null,
  // Which post-trigger learner turn the recovery lands on. v1 to v5 read the
  // first turn and no other, so one was the only answer and the fixture never
  // had to say it. v6 reads five, and a recovery on a later turn is the case
  // that tells its primary apart from the one-turn reading it carries forward.
  recoveryPostTriggerTurn = 1,
  // Every fixture dialogue opens on its own job id, so no two openings can
  // repeat by accident. Pass one label to two jobs in one world to build the
  // case the registration's duplicate-opening rule is written for.
  sharedOpeningLabel = null,
  // What the tutor actually said at the trigger turn. v1 to v7 never needed
  // this: no gate read the tutor's words, which is how v7 shipped two arms that
  // both asked a question. v8's deciding floor counts question marks in this
  // text, so a fixture that cannot set it cannot test the floor.
  triggerTutorText = null,
  // The host action family the response audit recorded. v1 to v7 all ran on
  // stage_next_step, so the fixture wrote it once. v8's two arms take different
  // families, and the family is what earns the declarative handoff, so the
  // default now follows the job's own assigned move. Pass a literal to build the
  // case where the audit names a family the assigned move does not host.
  triggerActionFamily = null,
}) {
  const maxTurns = maximumTriggerTurn + postTriggerLearnerTurns;
  const triggerTurn = Number.isInteger(forcedTriggerTurn) ? forcedTriggerTurn : job.assignment_index % 2 === 0 ? 2 : 1;
  const outcomeTurn = triggerTurn + postTriggerLearnerTurns;
  const triggerText = `Whatever. I will not work through this proof ${sharedOpeningLabel ?? job.id}.`;
  const triggerSha = sha256(triggerText);
  // A pre-trigger turn the adjudicator reads as actionable boredom while a
  // registered protected exclusion blocks the treatment there.
  const preTriggerText = protectedPassOver
    ? 'I am overwhelmed by this and I have stopped trying.'
    : 'I am inspecting the public record.';
  const recoveryText = 'The public mark supports the left branch, so I will test that premise next.';
  const nonRecoveryText = 'Fine. Whatever you say.';
  const callRows = [
    ...(authoredWorldOpening ? [] : calls('tutor_stub_opening', 0)),
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
    const isPost = turn === triggerTurn + recoveryPostTriggerTurn;
    return {
      type: 'turn_complete',
      turn,
      turnRecord: {
        learner: isTrigger ? triggerText : isPost ? (recovered ? recoveryText : nonRecoveryText) : preTriggerText,
        tutor: isTrigger && triggerTutorText ? triggerTutorText : `Tutor turn ${turn}.`,
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
                  action_family: {
                    selected:
                      triggerActionFamily ??
                      (job.pedagogical_move
                        ? tutorStubResistanceHostActionFamily(job.pedagogical_move)
                        : 'stage_next_step'),
                    visible: true,
                  },
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
        lab: { admission: { modelCallBudget: perDialogueBudget } },
        experiment: {
          runSeed: job.seed,
          profile: 'bored',
          policy: 'field',
          repeat: job.assignment_index,
          jobId: job.id,
        },
        autoLearner: {
          observationSemantics,
          maxTurns,
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
              'auto-turns': String(maxTurns),
              'model-call-budget': String(perDialogueBudget),
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
      type: 'tutor_opening_realization',
      turn: 0,
      realization: {
        schema: 'machinespirits.tutor-stub.opening-realization.v1',
        source: authoredWorldOpening ? 'authored_world_opening' : 'speaking_tutor_model',
      },
    },
    { type: 'tutor_opening', turnId: `${job.id}:opening`, reason: 'auto_start', text: `Opening for ${job.world}.` },
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
          const candidate = turn === triggerTurn ? triggerText : preTriggerText;
          // A turn the adjudicator could not read. The run still writes the
          // reading it attempted, so the turn's identity and route stay on the
          // record; only the verdict is absent.
          const unreadable = unreadablePassOverTurns.includes(turn) && turn < triggerTurn;
          return {
            type: 'boredom_semantic_adjudication',
            turn,
            adjudication: {
              candidate_sha256: sha256(candidate),
              measurement_disposition: unreadable
                ? 'measurement_indeterminate'
                : turn === triggerTurn || protectedPassOver
                  ? 'actionable_boredom'
                  : 'productive_uptake',
              independent_route: { required_model_ref: 'codex.gpt-5.6-sol', matches: true },
              low_confidence: unreadable,
              parse_ok: !unreadable,
            },
          };
        })
      : []),
    // The mark the run leaves each time it passes a turn over. Without it the
    // analyzer treats the indeterminate reading as a dropped verdict, not a
    // registered pass-over.
    ...(observationSemantics === 'prospective_v9'
      ? unreadablePassOverTurns
          .filter((turn) => turn < triggerTurn)
          .map((turn) => ({
            type: 'boredom_semantic_measurement_indeterminate_passed_over',
            turn,
            code: 'TUTOR_STUB_BOREDOM_MEASUREMENT_INDETERMINATE_TURN_INELIGIBLE',
            disposition: 'measurement_indeterminate_turn_ineligible_read_next_turn',
            maximumTriggerTurn,
          }))
      : []),
    {
      type: 'resistance_action_register_intervention_applied',
      turn: triggerTurn,
      triggerTurn,
      triggerLearnerSha256: triggerSha,
      intervention: {
        status: 'applied',
        assignment: {
          // The level the contrast is read on. Under a registration that holds
          // the move fixed there is one level for every unit and the analyzer
          // calls it "matched"; under v6 the level is the assigned move, and a
          // literal here would refuse all thirty-six dialogues.
          action_fit: job.pedagogical_move_level ?? 'matched',
          // The move the plan assigned this dialogue, never a name typed here.
          // v1 to v5 assigned one move to every unit, so a literal was right by
          // accident; under v6 half the units are assigned the other move and a
          // literal would make every one of them read as undelivered.
          pedagogical_move: job.pedagogical_move,
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
      tutorLearnerDag: {
        model: dagModel({ progressed }),
        assessment: dagPathAssessment({ premiseWasAvailable, finalTurn: outcomeTurn }),
      },
      tutorReplyGenerated: false,
    },
  ];
}

function writeSyntheticBatch(
  root,
  plan,
  outcomes,
  {
    observationSemantics = 'prospective_v8',
    stoppedJobIds = [],
    protectedPassOverJobIds = [],
    authoredWorldOpeningWorlds = [],
    // Turns the adjudicator could not read, per dialogue, and the trigger turn
    // each dialogue lands on once those turns are passed over.
    unreadablePassOverTurnsByJobId = {},
    forcedTriggerTurnByJobId = {},
    sharedOpeningLabelByJobId = {},
    // What each arm's tutor said at the trigger turn, keyed by the assigned
    // move. A whole v8 batch differs arm by arm, not dialogue by dialogue, so
    // the move is the key that matches how the run is built.
    triggerTutorTextByMove = {},
    // One dialogue's tutor turn, whatever its arm. This wins over the arm's
    // text, so a single unit can be made to break a floor the rest of its arm
    // clears.
    triggerTutorTextByJobId = {},
    triggerActionFamilyByJobId = {},
    maximumTriggerTurn = 2,
    postTriggerLearnerTurns = 2,
    recoveryPostTriggerTurn = 1,
  } = {},
) {
  // The batch's own frozen numbers, never this file's. The analyzer audits the
  // sealed batch against these same three, so writing a different set here
  // would make the fixture prove the wrong thing.
  const batchSize = plan.budget.dialogues;
  const perDialogueBudget = plan.budget.maximum_model_attempt_reservations_per_dialogue;
  const perBatchBudget = plan.budget.maximum_model_attempt_reservations;
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
      protectedPassOver: protectedPassOverJobIds.includes(job.id),
      authoredWorldOpening: authoredWorldOpeningWorlds.includes(job.world),
      maximumTriggerTurn,
      postTriggerLearnerTurns,
      recoveryPostTriggerTurn,
      perDialogueBudget,
      unreadablePassOverTurns: unreadablePassOverTurnsByJobId[job.id] || [],
      forcedTriggerTurn: forcedTriggerTurnByJobId[job.id] ?? null,
      sharedOpeningLabel: sharedOpeningLabelByJobId[job.id] ?? null,
      triggerTutorText: triggerTutorTextByJobId[job.id] ?? triggerTutorTextByMove[job.pedagogical_move] ?? null,
      triggerActionFamily: triggerActionFamilyByJobId[job.id] ?? null,
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
    completed_dialogues: batchSize - stoppedJobIds.length,
    failed_or_missing_dialogues: stoppedJobIds.length,
    maximum_model_attempt_reservations: perBatchBudget,
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
    dialogues: batchSize,
    hard_ceiling: perBatchBudget,
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
    /launch pins, 4-turn window, or remaining 60-attempt ceiling drifted/u,
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
  // The caps travel with the plan, so the audit reads the numbers this batch was
  // planned under. These are the v2 numbers, which is what this batch is.
  const plan = {
    jobs: [job('valid'), job('failed'), job('partial-technical'), job('missing')],
    budget: {
      dialogues: 4,
      maximum_model_attempt_reservations_per_dialogue: 60,
      maximum_model_attempt_reservations: 240,
    },
  };
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
      plan,
    }),
    true,
  );
  assert.throws(
    () =>
      assertTutorStubBoredomProofDagRecoveryBudget({
        missing: [{ id: 'missing' }],
        initialReservations: { valid: 0, missing: 60 },
        usedBefore: 60,
        plan,
      }),
    /no room under the unchanged caps/u,
  );
  // A plan with no caps cannot be audited. It must not fall back to a number in
  // this file, because that number is what v4 got wrong.
  assert.throws(
    () =>
      assertTutorStubBoredomProofDagRecoveryBudget({
        missing: [{ id: 'missing' }],
        initialReservations: { valid: 60, missing: 0 },
        usedBefore: 60,
        plan: { jobs: plan.jobs },
      }),
    /requires candidates, observed reservations, and a plan/u,
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
  assert.equal(report.attrition.balanced_across_contrast_levels, true);
  assert.equal(report.amendment, null);
  assert.equal(report.primary_analysis.allocation_realised_as_predeclared, true);
  assert.equal(
    report.primary_analysis.conditioning,
    'world_success_totals_and_realised_per_world_plain_warm_allocation',
  );
  assert.deepEqual(report.primary_analysis.reference, { level: 'plain', successes: 4, total: 18, rate: 4 / 18 });
  assert.deepEqual(report.primary_analysis.treatment, { level: 'warm', successes: 13, total: 18, rate: 13 / 18 });
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
  assert.equal(report.assembly.scored_by_contrast_level.plain, 18);
  assert.equal(report.assembly.scored_by_contrast_level.warm, 15);
  assert.equal(report.assembly.batches_sealed_with_registered_stops, 3);
  assert.equal(report.amendment.id, 'A1_realised_block_allocation');
  assert.equal(report.attrition.stopped, 3);
  assert.deepEqual(report.attrition.stopped_by_contrast_level, { plain: 0, warm: 3 });
  assert.equal(report.attrition.balanced_across_contrast_levels, false);
  assert.equal(report.primary_analysis.allocation_realised_as_predeclared, false);
  // The three touched worlds carry three plain against two warm, and the test
  // conditions on exactly those counts.
  assert.equal(
    report.primary_analysis.blocks.filter((block) => block.referenceN === 3 && block.treatmentN === 2).length,
    3,
  );
  assert.equal(
    report.primary_analysis.blocks.filter((block) => block.referenceN === 3 && block.treatmentN === 3).length,
    3,
  );
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

test('two dialogues that open alike leave one unit, and the one that ran later is the one dropped', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-proof-dag-duplicate-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION) });
  const outcomes = new Map(loaded.plan.jobs.map((job) => [job.id, { recovered: true, progressed: true }]));
  // Two dialogues in one world, opening word for word alike. The opening digest
  // is taken over the world and the turns up to the trigger, so a shared world
  // and a shared trigger turn are the whole of what makes them repeat.
  const world = loaded.plan.jobs[0].world;
  const pair = loaded.plan.jobs.filter((job) => job.world === world).slice(0, 2);
  assert.equal(pair.length, 2);
  const batchNumber = (job) => Number(String(job.batch_id).replace(/^\D+/u, ''));
  const [first, second] = [...pair].sort(
    (left, right) => batchNumber(left) - batchNumber(right) || left.id.localeCompare(right.id),
  );
  const options = {
    sharedOpeningLabelByJobId: Object.fromEntries(pair.map((job) => [job.id, 'shared-opening'])),
    forcedTriggerTurnByJobId: Object.fromEntries(pair.map((job) => [job.id, 1])),
  };
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
    writeSyntheticBatch(root, plan, outcomes, options);
    roots.push(root);
  }

  // A repeat costs a unit, so the study comes up short and needs the same
  // written amendment any other shortfall needs.
  assert.throws(
    () =>
      analyzeTutorStubBoredomProofDag({
        batchRoots: roots,
        registrationPath: REGISTRATION,
        expectedSourceCommit: head,
      }),
    /requires a written amendment/u,
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
  assert.equal(report.assembly.dialogues_scored, 35);
  assert.equal(report.attrition.stopped, 1);
  assert.deepEqual(report.attrition.stop_reasons, {
    measurement_indeterminate_stop_no_repair_no_replacement: 0,
    duplicate_public_prefix_stop_no_replacement_no_analysis: 1,
  });
  // Both dialogues ran to the end and both batches sealed clean. Nothing at run
  // time can see a repeat, because an opening exists only once its dialogue has
  // reached the trigger turn and batches run in separate processes. The rule is
  // therefore applied in analysis, and it drops the later of the two.
  assert.equal(report.assembly.batches_sealed_with_registered_stops, 0);
  assert.deepEqual(
    report.attrition.duplicate_public_prefix_stops.map((stop) => ({
      case_id: stop.case_id,
      repeats_the_opening_of: stop.repeats_the_opening_of,
    })),
    [{ case_id: second.id, repeats_the_opening_of: first.id }],
  );
  assert.deepEqual(
    report.attrition.stopped_units.map((unit) => ({ case_id: unit.case_id, stop_reason: unit.stop_reason })),
    [{ case_id: second.id, stop_reason: 'duplicate_public_prefix_stop_no_replacement_no_analysis' }],
  );
  // The loss lands on the one world that repeated, and nowhere else. Which of
  // the two is dropped is decided by run order alone, so it could be read off
  // the plan before any outcome was.
  const sum = (counts) => Object.values(counts).reduce((total, value) => total + value, 0);
  for (const entry of report.attrition.per_world) {
    const lost = entry.world === world ? 1 : 0;
    assert.equal(sum(entry.scored_by_contrast_level), sum(entry.planned_by_contrast_level) - lost, entry.world);
  }
  assert.ok(report.interpretation_status.includes('unbalanced_attrition_caveat'));
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

test('a registered protected exclusion moves the trigger later without breaking trigger provenance', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-proof-dag-protected-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION_V4) });
  assert.ok(loaded.registration.design.freshPrefixGeneration.protectedExclusions.includes('protected_affect'));
  const outcomes = new Map(loaded.plan.jobs.map((job) => [job.id, { recovered: true, progressed: true }]));
  const roots = [];
  const passedOver = [];
  for (let index = 1; index <= 9; index += 1) {
    const root = path.join(temp, `batch-${index}`);
    const plan = buildTutorStubBoredomProofDagBatchPlan({
      registrationPath: REGISTRATION_V4,
      batchId: `execution_batch_${index}`,
      destination: root,
    });
    fs.mkdirSync(root, { recursive: true });
    // Only turn-2 triggers have a pre-trigger turn to protect at all.
    const protectedPassOverJobIds = plan.jobs
      .filter((job) => job.assignment_index % 2 === 0)
      .slice(0, 1)
      .map((job) => job.id);
    passedOver.push(...protectedPassOverJobIds);
    writeSyntheticBatch(root, plan, outcomes, {
      observationSemantics: 'prospective_v9',
      protectedPassOverJobIds,
    });
    roots.push(root);
  }
  assert.equal(passedOver.length, 9);

  const report = analyzeTutorStubBoredomProofDag({
    batchRoots: roots,
    registrationPath: REGISTRATION_V4,
    expectedSourceCommit: head,
  });
  assert.equal(report.rows.length, 36);

  // The turn the adjudicator called actionable is disclosed, its trigger stayed
  // at the later turn, and the judge label was not recoded to something else.
  const disclosed = report.treatment_fidelity.protected_pass_over_units;
  assert.equal(disclosed.length, 9);
  assert.deepEqual(disclosed.map((unit) => unit.case_id).sort(), [...passedOver].sort());
  assert.ok(disclosed.every((unit) => unit.trigger_turn === 2));
  assert.ok(
    disclosed.every((unit) => unit.passed_over.every((entry) => entry.reasons.join(',') === 'protected_affect')),
  );
  assert.ok(disclosed.every((unit) => unit.passed_over.every((entry) => entry.turn === 1)));
  assert.ok(
    report.rows
      .filter((row) => passedOver.includes(row.case_id))
      .every((row) => row.semantic_measurement.trigger_disposition === 'actionable_boredom'),
  );
  // Every other unit stays clean, so the disclosure is not a blanket pass.
  assert.equal(report.rows.filter((row) => (row.trigger.protected_pass_overs || []).length === 0).length, 36 - 9);

  // An earlier turn that was genuinely eligible is still a hard stop: strip the
  // protected affect from the learner text and the same trace must be refused.
  const mutationPlan = JSON.parse(fs.readFileSync(path.join(roots[0], 'batch-plan.json'), 'utf8'));
  const passedOverJob = mutationPlan.jobs.find((job) => passedOver.includes(job.id));
  mutateTrace(roots[0], passedOverJob.id, (events) =>
    events.map((event) => {
      if (event.type === 'turn_complete' && Number(event.turn) === 1) {
        return {
          ...event,
          turnRecord: { ...event.turnRecord, learner: 'This is dull and I have stopped trying.' },
        };
      }
      if (event.type === 'boredom_semantic_adjudication' && Number(event.turn) === 1) {
        return {
          ...event,
          adjudication: {
            ...event.adjudication,
            candidate_sha256: sha256('This is dull and I have stopped trying.'),
          },
        };
      }
      return event;
    }),
  );
  assert.throws(
    () =>
      analyzeTutorStubBoredomProofDag({
        batchRoots: roots,
        registrationPath: REGISTRATION_V4,
        expectedSourceCommit: head,
      }),
    /an_earlier_turn_was_already_eligible/u,
  );
});

test('a world that carries its own opening line needs no opening model call', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-proof-dag-opening-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION_V4) });
  const authoredWorlds = loaded.registration.design.worlds.slice(2);
  assert.equal(authoredWorlds.length, 4);
  const outcomes = new Map(loaded.plan.jobs.map((job) => [job.id, { recovered: true, progressed: true }]));
  const roots = [];
  for (let index = 1; index <= 9; index += 1) {
    const root = path.join(temp, `batch-${index}`);
    const plan = buildTutorStubBoredomProofDagBatchPlan({
      registrationPath: REGISTRATION_V4,
      batchId: `execution_batch_${index}`,
      destination: root,
    });
    fs.mkdirSync(root, { recursive: true });
    writeSyntheticBatch(root, plan, outcomes, {
      observationSemantics: 'prospective_v9',
      authoredWorldOpeningWorlds: authoredWorlds,
    });
    roots.push(root);
  }
  const report = analyzeTutorStubBoredomProofDag({
    batchRoots: roots,
    registrationPath: REGISTRATION_V4,
    expectedSourceCommit: head,
  });
  assert.equal(report.rows.length, 36);

  // The source is disclosed, and it is fixed per world, so the blocked design
  // absorbs it: within a world every unit reports the same opening source.
  const byWorld = report.treatment_fidelity.opening_source_by_world;
  assert.equal(byWorld.length, 6);
  assert.ok(byWorld.every((entry) => entry.sources.length === 1));
  assert.ok(
    byWorld.every((entry) => entry.units_by_contrast_level.plain === 3 && entry.units_by_contrast_level.warm === 3),
  );
  assert.deepEqual(
    byWorld.filter((entry) => entry.sources[0] === 'authored_world_opening').map((entry) => entry.world),
    authoredWorlds,
  );

  // A dialogue that never opened at all is still refused, and so is a
  // model-opened world that lost its opening call.
  const mutationRoot = roots.find((root) =>
    JSON.parse(fs.readFileSync(path.join(root, 'batch-plan.json'), 'utf8')).jobs.some((job) =>
      authoredWorlds.includes(job.world),
    ),
  );
  const authoredJob = JSON.parse(fs.readFileSync(path.join(mutationRoot, 'batch-plan.json'), 'utf8')).jobs.find((job) =>
    authoredWorlds.includes(job.world),
  );
  mutateTrace(mutationRoot, authoredJob.id, (events) => events.filter((event) => event.type !== 'tutor_opening'));
  assert.throws(
    () =>
      analyzeTutorStubBoredomProofDag({
        batchRoots: roots,
        registrationPath: REGISTRATION_V4,
        expectedSourceCommit: head,
      }),
    /the_dialogue_never_opened/u,
  );
});

test('the report separates an objective zero the tutor could have moved from one it could not', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-proof-dag-reach-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION_V4) });

  // Two worlds hand out a premise on the path to the answer before the dialogue
  // ends; four do not. Nothing progresses anywhere, so the objective endpoint is
  // zero in all 36 units. The two zeros mean different things, and the report
  // must say which is which instead of leaving one reading for both.
  const reachableWorlds = loaded.registration.design.worlds.slice(0, 2);
  const outcomes = new Map(
    loaded.plan.jobs.map((job) => [
      job.id,
      { recovered: false, progressed: false, premiseWasAvailable: reachableWorlds.includes(job.world) },
    ]),
  );
  const roots = [];
  for (let index = 1; index <= 9; index += 1) {
    const root = path.join(temp, `batch-${index}`);
    const plan = buildTutorStubBoredomProofDagBatchPlan({
      registrationPath: REGISTRATION_V4,
      batchId: `execution_batch_${index}`,
      destination: root,
    });
    fs.mkdirSync(root, { recursive: true });
    writeSyntheticBatch(root, plan, outcomes, { observationSemantics: 'prospective_v9' });
    roots.push(root);
  }
  const report = analyzeTutorStubBoredomProofDag({
    batchRoots: roots,
    registrationPath: REGISTRATION_V4,
    expectedSourceCommit: head,
  });

  // The endpoint itself is zero everywhere, exactly as before this diagnostic.
  assert.equal(report.rows.length, 36);
  assert.ok(report.rows.every((row) => row.outcome.proof_progress_by_two_turns === false));
  assert.equal(report.key_secondary_analysis.reference.successes, 0);
  assert.equal(report.key_secondary_analysis.treatment.successes, 0);

  const reach = report.treatment_fidelity.objective_endpoint_reachability;
  assert.equal(reach.units, 36);
  assert.equal(reach.units_where_progress_was_reachable, 12);
  assert.equal(reach.units_where_no_best_path_premise_had_been_released, 24);
  assert.deepEqual(
    reach.by_world.filter((entry) => entry.reachable === entry.units).map((entry) => entry.world),
    reachableWorlds,
  );
  // A world that never released a best-path premise still reports when it would
  // have, so a reader can see the gap against the turn the dialogue ended on.
  const unreachable = reach.by_world.find((entry) => entry.reachable === 0);
  assert.ok(unreachable.earliest_release_turns.every((turn) => turn > Math.max(...unreachable.final_turns)));
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

test('v5 reads a widened window and passes over a turn the instrument could not read', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-proof-dag-v5-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION_V5) });
  // The two numbers this whole test exists to protect. v4 wrote them into the
  // analyzer by hand; if either moves, every literal that used to shadow it has
  // to be found again.
  const maximumTriggerTurn = loaded.registration.design.freshPrefixGeneration.maximumTriggerTurn;
  const postTriggerLearnerTurns = loaded.registration.design.treatment.postTriggerLearnerTurns;
  assert.equal(maximumTriggerTurn, 4);
  assert.equal(postTriggerLearnerTurns, 5);
  assert.equal(
    loaded.registration.design.freshPrefixGeneration.unreadableTurnDisposition,
    'pass_over_this_turn_and_read_the_next_one',
  );

  const outcomes = new Map(loaded.plan.jobs.map((job) => [job.id, { recovered: true, progressed: true }]));
  const roots = [];
  const passedOver = [];
  for (let index = 1; index <= 9; index += 1) {
    const root = path.join(temp, `batch-${index}`);
    const plan = buildTutorStubBoredomProofDagBatchPlan({
      registrationPath: REGISTRATION_V5,
      batchId: `execution_batch_${index}`,
      destination: root,
    });
    fs.mkdirSync(root, { recursive: true });
    // One dialogue a batch loses turns 1 and 2 to an unreadable reading and
    // triggers on turn 3 instead. Under v4 that dialogue was thrown away.
    const lostTwoTurns = plan.jobs.slice(0, 1).map((job) => job.id);
    passedOver.push(...lostTwoTurns);
    writeSyntheticBatch(root, plan, outcomes, {
      observationSemantics: 'prospective_v9',
      maximumTriggerTurn,
      postTriggerLearnerTurns,
      unreadablePassOverTurnsByJobId: Object.fromEntries(lostTwoTurns.map((id) => [id, [1, 2]])),
      forcedTriggerTurnByJobId: Object.fromEntries(lostTwoTurns.map((id) => [id, 3])),
    });
    roots.push(root);
  }
  assert.equal(passedOver.length, 9);

  const report = analyzeTutorStubBoredomProofDag({
    batchRoots: roots,
    registrationPath: REGISTRATION_V5,
    expectedSourceCommit: head,
  });
  assert.equal(report.rows.length, 36);

  // The nine dialogues v4 would have lost are read, disclosed by turn, and
  // still carry an ordinary trigger.
  const disclosed = report.treatment_fidelity.unreadable_pass_over_units;
  assert.equal(disclosed.length, 9);
  assert.deepEqual(disclosed.map((unit) => unit.case_id).sort(), [...passedOver].sort());
  assert.ok(disclosed.every((unit) => unit.trigger_turn === 3));
  assert.ok(disclosed.every((unit) => unit.passed_over.join(',') === '1,2'));
  assert.ok(
    report.rows
      .filter((row) => passedOver.includes(row.case_id))
      .every((row) => row.semantic_measurement.trigger_disposition === 'actionable_boredom'),
  );
  // Every other dialogue stays clean, so the disclosure is not a blanket pass.
  assert.equal(report.rows.filter((row) => (row.trigger.unreadable_pass_overs || []).length === 0).length, 36 - 9);

  // Every trigger sits inside the registered window, and no dialogue was read
  // on v4's two-turn horizon.
  assert.ok(report.rows.every((row) => row.trigger.observed_by_turn >= 1));
  assert.ok(report.rows.every((row) => row.trigger.observed_by_turn <= maximumTriggerTurn));
  assert.ok(report.rows.some((row) => row.trigger.observed_by_turn > 2));

  // The objective endpoint carries the registered window in its own name, and
  // it moved: a v4-shaped reader would have looked for the two-turn field.
  const field = `proof_progress_by_${'five'}_turns`;
  assert.ok(report.rows.every((row) => typeof row.outcome[field] === 'boolean'));
  assert.ok(report.rows.every((row) => row.outcome.proof_progress_by_two_turns === undefined));
  assert.ok(report.rows.every((row) => row.outcome.recovered === true));
  assert.ok(report.rows.every((row) => row.outcome.deadline_turns === 1));

  // A pass-over counts only where the run marked one at the time. Strip the
  // mark and the same trace must be refused, so an adjudication that simply
  // went missing can never be read back as a registered pass-over.
  mutateTrace(roots[0], passedOver[0], (events) =>
    events.filter(
      (event) => !(event.type === 'boredom_semantic_measurement_indeterminate_passed_over' && Number(event.turn) === 2),
    ),
  );
  assert.throws(
    () =>
      analyzeTutorStubBoredomProofDag({
        batchRoots: roots,
        registrationPath: REGISTRATION_V5,
        expectedSourceCommit: head,
      }),
    /unreadable_pass_overs_do_not_match_the_marks_the_run_left/u,
  );
});

test('a marked unread learner reading keeps its unit, and an unmarked one does not', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-proof-dag-unread-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION_V5) });
  const maximumTriggerTurn = loaded.registration.design.freshPrefixGeneration.maximumTriggerTurn;
  const postTriggerLearnerTurns = loaded.registration.design.treatment.postTriggerLearnerTurns;
  const outcomes = new Map(loaded.plan.jobs.map((job) => [job.id, { recovered: true, progressed: true }]));
  const roots = [];
  for (let index = 1; index <= 9; index += 1) {
    const root = path.join(temp, `batch-${index}`);
    const plan = buildTutorStubBoredomProofDagBatchPlan({
      registrationPath: REGISTRATION_V5,
      batchId: `execution_batch_${index}`,
      destination: root,
    });
    fs.mkdirSync(root, { recursive: true });
    writeSyntheticBatch(root, plan, outcomes, {
      observationSemantics: 'prospective_v9',
      maximumTriggerTurn,
      postTriggerLearnerTurns,
    });
    roots.push(root);
  }
  const firstPlan = JSON.parse(fs.readFileSync(path.join(roots[0], 'batch-plan.json'), 'utf8'));
  const jobId = firstPlan.jobs[0].id;
  // The reading of the learner beside the dialogue failed to the retry limit on
  // turn 2. The run wrote its mark, put a no-signal record on the turn and went
  // on, and the measurement on its own route was made as usual. Three paid v5
  // dialogues ended exactly this way and the route pin refused all three.
  // The reservation stays and the attempt stays; only the accepted response is
  // gone. That is what a refused call leaves behind, and it keeps the
  // reservation-for-attempt count exact, as the real traces do.
  const failAnalysisCall = (events, turn) =>
    events.map((event) =>
      event.type === 'model_call' && event.role === 'tutor_stub_learner_analysis' && Number(event.turn) === turn
        ? {
            ...event,
            type: 'model_call_error',
            request: { cliEffort: 'low' },
            error: 'codex CLI turn failed before producing an accepted response',
          }
        : event,
    );
  const mark = (turn) => ({
    type: 'learner_analysis_unanalyzed',
    turn,
    analysisStatus: 'unanalyzed',
    signal: { state: 'none' },
    failure: { code: 'analysis_model_call_failed' },
  });

  mutateTrace(roots[0], jobId, (events) => [...failAnalysisCall(events, 2), mark(2)]);
  const report = analyzeTutorStubBoredomProofDag({
    batchRoots: roots,
    registrationPath: REGISTRATION_V5,
    expectedSourceCommit: head,
  });
  assert.equal(report.rows.length, 36);
  const kept = report.rows.find((row) => row.case_id === jobId);
  assert.deepEqual(kept.execution.unanalyzed_learner_turns, [2]);
  assert.equal(kept.execution.post_trigger_learner_turns, postTriggerLearnerTurns);
  const disclosed = report.treatment_fidelity.unanalyzed_learner_turn_units;
  assert.equal(disclosed.length, 1);
  assert.equal(disclosed[0].case_id, jobId);
  assert.deepEqual(disclosed[0].unread_turns, [2]);
  // Turn 2 is the first post-trigger turn when the trigger lands on turn 1, so
  // the disclosure has to say the primary endpoint is read from an unread turn.
  assert.deepEqual(disclosed[0].unread_turns_that_an_endpoint_is_read_from, [2]);
  assert.ok(report.rows.every((row) => Array.isArray(row.execution.unanalyzed_learner_turns)));

  // Without the mark the same gap is still a route violation. The run has to
  // have said at the time that the turn went unread.
  mutateTrace(roots[0], jobId, (events) => events.filter((event) => event.type !== 'learner_analysis_unanalyzed'));
  assert.throws(
    () =>
      analyzeTutorStubBoredomProofDag({
        batchRoots: roots,
        registrationPath: REGISTRATION_V5,
        expectedSourceCommit: head,
      }),
    /a_required_role_and_turn_call_is_missing/u,
  );

  // A mark on a turn whose reading did land would let a unit claim a gap it
  // never had, so the marks are checked both ways.
  mutateTrace(roots[0], jobId, (events) => [...events, mark(3)]);
  assert.throws(
    () =>
      analyzeTutorStubBoredomProofDag({
        batchRoots: roots,
        registrationPath: REGISTRATION_V5,
        expectedSourceCommit: head,
      }),
    /an_unread_learner_analysis_mark_does_not_match_a_missing_call/u,
  );
});

test('a warm unit that came out plain is recorded nonadherent, not refused', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-proof-dag-adherence-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION_V5) });
  // The two registered lines this test stands on.
  assert.equal(loaded.registration.measurement.primaryEndpoint.intentionToTreat, true);
  assert.equal(
    loaded.registration.design.treatment.safetyOverride,
    'record_as_nonadherent_in_intention_to_treat_never_reroll',
  );
  const maximumTriggerTurn = loaded.registration.design.freshPrefixGeneration.maximumTriggerTurn;
  const postTriggerLearnerTurns = loaded.registration.design.treatment.postTriggerLearnerTurns;
  const outcomes = new Map(loaded.plan.jobs.map((job) => [job.id, { recovered: true, progressed: true }]));
  const roots = [];
  for (let index = 1; index <= 9; index += 1) {
    const root = path.join(temp, `batch-${index}`);
    const plan = buildTutorStubBoredomProofDagBatchPlan({
      registrationPath: REGISTRATION_V5,
      batchId: `execution_batch_${index}`,
      destination: root,
    });
    fs.mkdirSync(root, { recursive: true });
    writeSyntheticBatch(root, plan, outcomes, {
      observationSemantics: 'prospective_v9',
      maximumTriggerTurn,
      postTriggerLearnerTurns,
    });
    roots.push(root);
  }
  const firstPlan = JSON.parse(fs.readFileSync(path.join(roots[0], 'batch-plan.json'), 'utf8'));
  const warmJob = firstPlan.jobs.find((job) => job.realization === 'warm');
  const setDeliveredRegister = (events, register) =>
    events.map((event) =>
      event.type === 'turn_complete' && event.turnRecord?.responseConfigurationAudit
        ? {
            ...event,
            turnRecord: {
              ...event.turnRecord,
              responseConfigurationAudit: {
                ...event.turnRecord.responseConfigurationAudit,
                axes: {
                  ...event.turnRecord.responseConfigurationAudit.axes,
                  engagement_stance: {
                    ...event.turnRecord.responseConfigurationAudit.axes.engagement_stance,
                    selected: register,
                  },
                },
              },
            },
          }
        : event,
    );

  mutateTrace(roots[0], warmJob.id, (events) => setDeliveredRegister(events, 'plain'));
  const report = analyzeTutorStubBoredomProofDag({
    batchRoots: roots,
    registrationPath: REGISTRATION_V5,
    expectedSourceCommit: head,
  });
  assert.equal(report.rows.length, 36);
  const kept = report.rows.find((row) => row.case_id === warmJob.id);
  // It stays in the warm group. That is what intention to treat means.
  assert.equal(kept.arm, 'warm');
  assert.equal(kept.fidelity.assigned_register, 'warm');
  assert.equal(kept.fidelity.delivered_register, 'plain');
  assert.equal(kept.fidelity.register_delivered_as_assigned, false);
  // And the miss lands on the registered visibility floor rather than nowhere.
  assert.equal(kept.fidelity.register_visible, false);
  const disclosed = report.treatment_fidelity.register_nonadherent_units;
  assert.equal(disclosed.length, 1);
  assert.equal(disclosed[0].case_id, warmJob.id);
  assert.equal(disclosed[0].delivered_register, 'plain');
  assert.equal(report.treatment_fidelity.register_visibility_rate, 35 / 36);

  // A register outside the registered palette is missing evidence, not a result.
  mutateTrace(roots[0], warmJob.id, (events) => setDeliveredRegister(events, 'edged'));
  assert.throws(
    () =>
      analyzeTutorStubBoredomProofDag({
        batchRoots: roots,
        registrationPath: REGISTRATION_V5,
        expectedSourceCommit: head,
      }),
    /lacks adherent typed action\/register visibility evidence/u,
  );
});

test('v6 reads the move contrast end to end, blocks the manner, and discloses content separation', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-proof-dag-v6-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION_V6) });
  const treatment = loaded.registration.design.treatment;
  const measurement = loaded.registration.measurement;
  // What v6 moved. The contrast is the tutor move; the manner is a block that
  // is balanced and reported, never tested. The window did not move, so a v6
  // row can be read beside a v5 one.
  assert.equal(treatment.contrast, 'pedagogical_move');
  assert.deepEqual(treatment.pedagogicalMoveLevels, ['ask_question', 'shrink_step']);
  assert.equal(treatment.realizationRole, 'balancing_block_not_the_contrast');
  assert.equal(measurement.primaryEndpoint.deadlinePostTriggerLearnerTurns, 5);
  assert.equal(measurement.comparabilityEndpoint.deadlinePostTriggerLearnerTurns, 1);
  const maximumTriggerTurn = loaded.registration.design.freshPrefixGeneration.maximumTriggerTurn;
  const postTriggerLearnerTurns = treatment.postTriggerLearnerTurns;

  // Every unit recovers, and every one of them recovers on the fourth
  // post-trigger turn. That is the reading the two endpoints have to disagree
  // about: the five-turn primary finds it, the carried-forward one-turn
  // comparability cannot.
  const outcomes = new Map(loaded.plan.jobs.map((job) => [job.id, { recovered: true, progressed: true }]));
  const roots = [];
  for (let index = 1; index <= 9; index += 1) {
    const root = path.join(temp, `batch-${index}`);
    const plan = buildTutorStubBoredomProofDagBatchPlan({
      registrationPath: REGISTRATION_V6,
      batchId: `execution_batch_${index}`,
      destination: root,
    });
    fs.mkdirSync(root, { recursive: true });
    writeSyntheticBatch(root, plan, outcomes, {
      observationSemantics: 'prospective_v9',
      maximumTriggerTurn,
      postTriggerLearnerTurns,
      recoveryPostTriggerTurn: 4,
    });
    roots.push(root);
  }

  const report = analyzeTutorStubBoredomProofDag({
    batchRoots: roots,
    registrationPath: REGISTRATION_V6,
    expectedSourceCommit: head,
  });
  assert.equal(report.rows.length, 36);

  // The contrast is read on the move, eighteen a side, and the move a row was
  // assigned is the move the catalogue names for its level.
  const byMove = (level) => report.rows.filter((row) => row.move_level === level);
  assert.equal(byMove('ask_question').length, 18);
  assert.equal(byMove('shrink_step').length, 18);
  assert.ok(byMove('ask_question').every((row) => row.pedagogical_move === treatment.pedagogicalMoves.ask_question));
  assert.ok(byMove('shrink_step').every((row) => row.pedagogical_move === treatment.pedagogicalMoves.shrink_step));
  // The manner is balanced inside each move, nine and nine, so a move result
  // cannot be a manner result under another name.
  for (const level of treatment.pedagogicalMoveLevels) {
    assert.equal(byMove(level).filter((row) => row.arm === 'plain').length, 9);
    assert.equal(byMove(level).filter((row) => row.arm === 'warm').length, 9);
  }

  // The two windows part company on the same thirty-six dialogues.
  assert.ok(report.rows.every((row) => row.outcome.recovered === true));
  assert.ok(report.rows.every((row) => row.outcome.deadline_turns === 5));
  assert.ok(report.rows.every((row) => row.outcome.first_recovery_turn === 4));
  assert.ok(report.rows.every((row) => row.outcome.comparability_recovered === false));
  assert.ok(report.rows.every((row) => row.outcome.comparability_deadline_turns === 1));

  // The primary reads the move, reports the manner as a block, and says which
  // decision it reached. Both moves recover thirty-six of thirty-six here, so
  // the registered decision is that no separation was confirmed.
  const primary = report.primary_analysis;
  assert.equal(primary.endpoint, 'bored_resistance_recovery_within_outcome_horizon');
  assert.equal(primary.deadline_post_trigger_learner_turns, 5);
  assert.equal(primary.balanced_block.axis, 'realization_manner');
  assert.equal(primary.balanced_block.role, 'balancing_block_not_the_contrast');
  assert.equal(primary.balanced_block.analysis, 'descriptive_only_no_hypothesis_test');
  // Four cells, nine dialogues each: the balance a reader has to be able to see.
  assert.deepEqual(
    primary.balanced_block.cells.map((cell) => [cell.contrast_level, cell.block_level, cell.scored, cell.successes]),
    [
      ['ask_question', 'plain', 9, 9],
      ['ask_question', 'warm', 9, 9],
      ['shrink_step', 'plain', 9, 9],
      ['shrink_step', 'warm', 9, 9],
    ],
  );
  assert.equal(primary.significant_two_sided, false);
  assert.equal(primary.registered_decision, 'shrink_step_ask_question_recovery_not_confirmed');
  // The key secondary stays shut behind it. That is the fixed sequence.
  assert.equal(report.key_secondary_analysis.fixed_sequence_gate_open, false);

  // The carried-forward v5 reading travels with the result and carries no test.
  const comparability = report.comparability_analysis;
  assert.equal(comparability.endpoint, 'profile_specific_resistance_recovery');
  assert.equal(comparability.analysis, 'descriptive_only_no_hypothesis_test');
  assert.equal(comparability.scored, 36);
  assert.deepEqual(
    comparability.by_contrast_level.map((level) => [level.contrast_level, level.scored, level.recovered]),
    [
      ['ask_question', 18, 0],
      ['shrink_step', 18, 0],
    ],
  );

  // Content separation is reported per move whatever it comes to. Here the
  // learner brings back words the tutor never made public, so it is zero — and
  // zero has to be written down, not left out.
  const leakage = report.content_leakage_disclosure;
  assert.deepEqual(
    leakage.by_contrast_level.map((level) => [
      level.contrast_level,
      level.scoring_turns,
      level.scoring_turns_that_only_restate_the_tutor,
    ]),
    [
      ['ask_question', 18, 0],
      ['shrink_step', 18, 0],
    ],
  );

  // Every unit delivered the move it was assigned, so the fidelity floor is met
  // and no unit is nonadherent on the move.
  assert.ok(report.rows.every((row) => row.fidelity.move_delivered_as_assigned === true));
  assert.equal(report.treatment_fidelity.assigned_move_delivery_rate, 1);
  assert.equal(report.treatment_fidelity.move_nonadherent_units.length, 0);
  assert.equal(
    report.treatment_fidelity.assigned_move_delivery_minimum,
    measurement.treatmentFidelity.minimumAssignedMoveDelivery,
  );

  // And a unit that came out under the other move is recorded nonadherent in
  // its assigned group, never rerolled into the group it happened to deliver.
  // The assignment record is left alone on purpose: change that and the run has
  // drifted from the sealed manifest, which is a refusal, not a nonadherence.
  // What moves is the record of what came out.
  const firstPlan = JSON.parse(fs.readFileSync(path.join(roots[0], 'batch-plan.json'), 'utf8'));
  const shrinkJob = firstPlan.jobs.find((job) => job.pedagogical_move_level === 'shrink_step');
  mutateTrace(roots[0], shrinkJob.id, (events) =>
    events.map((event) =>
      event.type === 'resistance_action_register_intervention_applied'
        ? {
            ...event,
            intervention: {
              ...event.intervention,
              delivered_pedagogical_move: treatment.pedagogicalMoves.ask_question,
            },
          }
        : event,
    ),
  );
  const withMiss = analyzeTutorStubBoredomProofDag({
    batchRoots: roots,
    registrationPath: REGISTRATION_V6,
    expectedSourceCommit: head,
  });
  const kept = withMiss.rows.find((row) => row.case_id === shrinkJob.id);
  assert.equal(kept.move_level, 'shrink_step');
  assert.equal(kept.fidelity.assigned_pedagogical_move, treatment.pedagogicalMoves.shrink_step);
  assert.equal(kept.fidelity.delivered_pedagogical_move, treatment.pedagogicalMoves.ask_question);
  assert.equal(kept.fidelity.move_delivered_as_assigned, false);
  assert.equal(withMiss.rows.filter((row) => row.move_level === 'shrink_step').length, 18);
  assert.equal(withMiss.treatment_fidelity.move_nonadherent_units.length, 1);
  assert.equal(withMiss.treatment_fidelity.move_nonadherent_units[0].case_id, shrinkJob.id);
  assert.equal(withMiss.treatment_fidelity.assigned_move_delivery_rate, 35 / 36);
});

const REGISTRATION_V7 = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v7.json';
const REGISTRATION_V8 = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v8.json';

test('v8 decides the run on the tutor own words, and a blurred pair of arms fails the gate', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-proof-dag-v8-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION_V8) });
  const treatment = loaded.registration.design.treatment;
  const moves = treatment.pedagogicalMoves;
  const maximumTriggerTurn = loaded.registration.design.freshPrefixGeneration.maximumTriggerTurn;
  const postTriggerLearnerTurns = treatment.postTriggerLearnerTurns;

  // The one behaviour the two arms are built to differ on, written out as the
  // words a tutor would say. The question arm asks once. The carry-on arm names
  // the public object and stops, so it holds no question mark at all. Every
  // later assertion in this test is a count of these two sentences.
  const asks = 'Which entry in the delivery ledger covers the third week?';
  const carriesOn = 'The delivery ledger is on the table, and its third week entry is the part it does not settle yet.';
  const arms = { [moves.ask_question]: asks, [moves.carry_on]: carriesOn };

  const outcomes = new Map(loaded.plan.jobs.map((job) => [job.id, { recovered: true, progressed: true }]));
  const build = (options = {}) => {
    const root = path.join(temp, options.label ?? 'clean');
    fs.rmSync(root, { recursive: true, force: true });
    const roots = [];
    for (let index = 1; index <= 18; index += 1) {
      const batchRoot = path.join(root, `batch-${index}`);
      const plan = buildTutorStubBoredomProofDagBatchPlan({
        registrationPath: REGISTRATION_V8,
        batchId: `execution_batch_${index}`,
        destination: batchRoot,
      });
      fs.mkdirSync(batchRoot, { recursive: true });
      writeSyntheticBatch(batchRoot, plan, outcomes, {
        observationSemantics: 'prospective_v9',
        maximumTriggerTurn,
        postTriggerLearnerTurns,
        recoveryPostTriggerTurn: 1,
        triggerTutorTextByMove: arms,
        triggerTutorTextByJobId: options.overrides ? options.overrides(plan, index) : {},
      });
      roots.push(batchRoot);
    }
    return analyzeTutorStubBoredomProofDag({
      batchRoots: roots,
      registrationPath: REGISTRATION_V8,
      expectedSourceCommit: head,
    });
  };

  const report = build();
  assert.equal(report.rows.length, 72);
  assert.equal(report.rows.filter((row) => row.move_level === 'ask_question').length, 36);
  assert.equal(report.rows.filter((row) => row.move_level === 'carry_on').length, 36);

  // The question count is read per unit and it comes off the tutor turn, not
  // off the assignment. One in every question-arm unit, none in any carry-on
  // unit.
  const byLevel = (level) => report.rows.filter((row) => row.move_level === level);
  assert.ok(byLevel('ask_question').every((row) => row.fidelity.delivered_question_count === 1));
  assert.ok(byLevel('carry_on').every((row) => row.fidelity.delivered_question_count === 0));
  assert.ok(report.rows.every((row) => row.fidelity.move_contrast_delivered === true));

  const fidelity = report.treatment_fidelity;
  assert.equal(fidelity.move_contrast_delivery_rate, 1);
  assert.deepEqual(fidelity.move_contrast_delivery_rate_by_level, { carry_on: 1, ask_question: 1 });
  assert.equal(fidelity.move_contrast_delivery_minimum, 0.9);
  assert.equal(fidelity.move_contrast_undelivered_units.length, 0);
  assert.equal(report.status, 'complete_registered_confirmation');
  // The two echoed gates read 1.00 beside it, and the report says in its own
  // words that they are echoes rather than readings of the tutor.
  assert.equal(fidelity.assigned_move_delivery_rate, 1);
  assert.match(fidelity.assigned_move_delivery_reading, /dead field/u);

  // v7's fault, replayed. Both arms ask, which is what v7 shipped and what its
  // move gate could not see. Here the carry-on arm reads zero and the run is
  // refused rather than analysed.
  const blurred = build({
    label: 'blurred',
    overrides: (plan) =>
      Object.fromEntries(
        plan.jobs.filter((job) => job.pedagogical_move_level === 'carry_on').map((job) => [job.id, asks]),
      ),
  });
  assert.equal(blurred.treatment_fidelity.move_contrast_delivery_rate, 0.5);
  assert.deepEqual(blurred.treatment_fidelity.move_contrast_delivery_rate_by_level, { carry_on: 0, ask_question: 1 });
  assert.equal(blurred.treatment_fidelity.move_contrast_undelivered_units.length, 36);
  assert.equal(blurred.status, 'failed_interpretability_gate_not_rerun');

  // And the case the pooled rate alone would wave through. Five carry-on units
  // ask a question: pooled is 67 of 72, above the floor, while the carry-on arm
  // is 31 of 36, below it. Only the per-arm check refuses this one.
  const lopsided = build({
    label: 'lopsided',
    // One spoiled dialogue in each of the first five batches, and none after.
    // Spoiling one per batch across all eighteen would put the pooled rate
    // under the floor too, and then the test could not tell which of the two
    // checks refused the run.
    overrides: (plan, index) =>
      index > 5
        ? {}
        : Object.fromEntries(
            plan.jobs
              .filter((job) => job.pedagogical_move_level === 'carry_on')
              .slice(0, 1)
              .map((job) => [job.id, asks]),
          ),
  });
  assert.equal(lopsided.treatment_fidelity.move_contrast_delivery_rate, 67 / 72);
  assert.ok(lopsided.treatment_fidelity.move_contrast_delivery_rate >= 0.9);
  assert.equal(lopsided.treatment_fidelity.move_contrast_delivery_rate_by_level.carry_on, 31 / 36);
  assert.equal(lopsided.status, 'failed_interpretability_gate_not_rerun');
});

test('the runner takes its batch ids from the registration, not from a written range', () => {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const destination = path.join(os.tmpdir(), 'boredom-proof-dag-v7-batch-id-range');
  const registration = JSON.parse(fs.readFileSync(path.join(ROOT, REGISTRATION_V7), 'utf8'));
  const batches = registration.executionReadiness.batches.executionBatches;
  const build = (batchId) =>
    buildTutorStubBoredomProofDagBatchPlan({
      registrationPath: REGISTRATION_V7,
      batchId,
      destination,
      expectedSourceCommit: head,
    });
  // v7 is spent, and its analysis was corrected afterwards to apply a rule the
  // registration always carried, so its frozen request no longer matches the
  // tree and no v7 plan can be built at all. That is the seal working, not a
  // fault: the analyzer sits inside the frozen closure exactly so that changing
  // the analysis after seeing the data cannot happen quietly, and so that the
  // analysis cannot be edited between two batches of one live run.
  //
  // The batch id property outlives the seal, because ids are checked before the
  // closure is. A registered id must get past the id check and fail later, on
  // drift. An id past the registered range must fail on the id check itself.
  // The runner used to accept execution_batch_1 through 9 and refuse the rest,
  // and it refused them all with one message, so two runs of batch ten agreed
  // byte for byte and read as stable.
  for (let index = 1; index <= batches; index += 1) {
    assert.throws(
      () => build(`execution_batch_${index}`),
      /closure drift against the frozen request/u,
      `execution_batch_${index} must be a registered id`,
    );
  }
  assert.throws(() => build(`execution_batch_${batches + 1}`), /must be one of the 21 registered ids/u);
  // What each registered batch deals is read off the plan the registration
  // derives offline, which the seal does not gate, rather than off a build it
  // now refuses.
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, REGISTRATION_V7) });
  assert.equal(loaded.plan.batches.length, batches);
  assert.equal(new Set(loaded.plan.jobs.map((job) => job.batch_id)).size, batches);
  assert.equal(new Set(loaded.plan.jobs.map((job) => job.id)).size, registration.executionReadiness.dialogue.dialogues);
  // v6 is not exercised here, for the reason v7 can no longer be built either.
  // Its request pins the runner's bytes, so building a v6 plan on an edited
  // runner fails on closure drift before it reaches the batch id at all.
});

test('every registered version builds a live runtime, not just a plan', () => {
  // The plan and the runtime are two different things, and until now only the
  // plan was tested. A plan row carries the move level as text; the runtime has
  // to turn that text into an assigned move the tutor can deliver. v7 built a
  // correct plan and then failed in the runtime, because the adapter asked
  // `version !== 6` to decide whether the study varies the move. v7 is not 6,
  // so it took the fixed-move path, found no fixed move, and killed four live
  // dialogues after they had opened sessions and spent budget.
  //
  // Every version this file can reach is exercised, so the next version cannot
  // pass the plan tests and die on first contact with a paid session.
  const versions = [
    { path: REGISTRATION_V8, movesVary: true },
    { path: REGISTRATION_V7, movesVary: true },
    { path: REGISTRATION_V5, movesVary: false },
    { path: REGISTRATION_V4, movesVary: false },
    { path: REGISTRATION_V3, movesVary: false },
    { path: REGISTRATION, movesVary: false },
  ];
  for (const version of versions) {
    const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, version.path) });
    // One job from the first batch and one from the last, so a version whose
    // batch list is written out too short fails here rather than in a live run.
    const lastBatch = loaded.plan.batches[loaded.plan.batches.length - 1].id;
    const probes = [loaded.plan.jobs[0], loaded.plan.jobs.find((job) => job.batch_id === lastBatch)];
    for (const job of probes) {
      const state = {
        trace: null,
        turns: [],
        history: [],
        register: { palette: ['plain', 'warm'], history: [] },
        world: {},
      };
      configureTutorStubBoredomProofDagExecution({ state, loaded, jobId: job.id, appendTraceEvent() {} });
      const runtime = state.resistanceActionRegisterStudy;
      const assignments = runtime.registration.design.factors.actionFit.assignments.bored;
      // The move the runtime will deliver must be a real named move, and it
      // must be the one the sealed plan row assigned.
      const move = assignments[runtime.action_fit];
      assert.equal(typeof move, 'string', `${version.path} ${job.id} resolves no assigned move`);
      assert.ok(move.trim(), `${version.path} ${job.id} resolves an empty assigned move`);
      if (version.movesVary) {
        assert.equal(runtime.action_fit, job.pedagogical_move_level);
        assert.equal(move, job.pedagogical_move);
      } else {
        assert.equal(runtime.action_fit, 'matched');
      }
      // The batch this job belongs to must be a level the runtime accepts.
      assert.ok(
        runtime.registration.design.factors.replicationBlock.levels.includes(job.batch_id),
        `${version.path} runtime does not accept batch ${job.batch_id}`,
      );
      assert.equal(runtime.repeat, job.batch_id);
    }
  }
});

test('a v8 intervention carries its registered delivered-contrast rule, and a v7 one carries none', () => {
  // The rule reached only the preflight and the analyzer before this. Putting
  // it on the intervention is what lets the draft contract hold it while the
  // turn is still being written, instead of reading the miss afterwards.
  const applyOnce = (registrationPath) => {
    const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.join(ROOT, registrationPath) });
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
      appendTraceEvent() {},
    });
    const applied = applyTutorStubResistanceActionRegisterStudyIntervention({
      selection: { response_configuration: {}, selected_register: 'plain' },
      state,
      learnerText: 'Whatever. I will not work through this proof.',
      classification: boredClassification(),
      tutorLearnerDag: { model: { turn: 2 } },
      semanticAdjudication: { measurement_disposition: 'actionable_boredom' },
    });
    assert.equal(applied.source, 'resistance_action_register_study_intervention');
    return { job, intervention: applied.resistance_action_register_intervention, applied };
  };

  const eight = applyOnce(REGISTRATION_V8);
  const expected =
    eight.job.pedagogical_move === 'ask_discriminating_question' ? 'requires_question' : 'forbids_question';
  assert.equal(eight.intervention.delivered_contrast_rule, expected);
  assert.equal(
    eight.applied.response_configuration.resistance_action_register_intervention.delivered_contrast_rule,
    expected,
  );

  // v7 registers no delivered-contrast rule, so its intervention keeps the
  // shape every closed study was run under. The key is absent, not null.
  const seven = applyOnce(REGISTRATION_V7);
  assert.ok(!('delivered_contrast_rule' in seven.intervention));
});
