import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  loadContinuityPlan,
  continuityBudget,
  buildContinuityRequest,
  parseContinuityReply,
  runContinuityArm,
  callContinuityModel,
  CONTINUITY_OUTPUT_SCHEMA,
  buildContinuityProofPlan,
  verifyContinuityProofRelease,
  buildContinuityReviewRequest,
  buildContinuityRevisionRequest,
  parseContinuityReview,
} from '../services/localQwenRefusalContinuity.js';
import {
  buildBenchmarkJobs,
  buildBenchmarkOutputSchema,
  readBenchmarkArm,
  scoreBenchmarkArms,
} from '../scripts/score-local-qwen-resistant-learner-benchmark.js';
import { deliveredSourceContext } from '../scripts/run-local-qwen-bilateral-superego.js';
import { buildFactorialInterchange } from '../services/localQwenFactorialReport.js';
import { learnerProfileContract } from '../scripts/tutor-stub-learner-profile-contracts.js';
import { renderContinuityReport } from '../services/localQwenRefusalContinuityReport.js';
import {
  armBoundaryRecoveryContract,
  buildInvestedRivalPlan,
  configuredServiceModel,
  generationRecoveryContract,
  finalQualityRecoveryContract,
  finalCompletionRecoveryContract,
  investedRivalDeliveredSourceContext,
  investedRivalJudgeCallOptions,
  allowUnknownRootOutputFields,
  projectRegisteredRootOutput,
  linkedAssessmentRecoveryContract,
  localModelRouteRecoveryContract,
  main as runInvestedRival,
  qualityJsonTransportRecoveryContract,
  qualitySplitRecoveryContract,
  qualitySplitStructuredRecoveryContract,
  readArmBoundaryRecovery,
  readGenerationRecovery,
  readFinalQualityRecovery,
  readFinalCompletionRecovery,
  readLinkedAssessmentRecovery,
  readLocalModelRouteRecovery,
  readQualityJsonTransportRecovery,
  readQualitySplitRecovery,
  readQualitySplitStructuredRecovery,
  runtimeServiceArm,
  technicalRecoveryEligible,
} from '../scripts/run-local-qwen-invested-rival.js';
import {
  buildLunaReferencePlan,
  callLunaReferenceModel,
  makeLunaJudgeCaller,
} from '../scripts/run-invested-rival-luna-reference.js';
import {
  buildLearnerIterationPlan,
  callLearnerIterationModel,
  main as runLearnerIteration,
} from '../scripts/run-invested-rival-learner-iteration.js';
import {
  analyzeLearnerReplication,
  buildLearnerReplicationPlan,
  callLearnerReplicationModel,
  replicationAssessmentBatches,
  main as runLearnerReplication,
} from '../scripts/run-invested-rival-learner-replication.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plan = loadContinuityPlan(root);
const proofPlan = loadContinuityPlan(root, 'config/tutor-stub-local-learners/qwen-refusal-dag-restored.v1.yaml');
const bilateralPlan = loadContinuityPlan(
  root,
  'config/tutor-stub-local-learners/qwen-refusal-bilateral-superego.v1.yaml',
);
const rivalPlan = buildInvestedRivalPlan(root);
const lunaReferencePlan = buildLunaReferencePlan(root);
const learnerIterationPlan = buildLearnerIterationPlan(root);
const learnerReplicationPlan = buildLearnerReplicationPlan(root);
const opening = [{ role: 'assistant', content: plan.world.opening_frame.authored_text }];
const destination = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-continuity-test-')), 'arm');
const reply = (speech, end_dialogue = false, settled = [], open = []) =>
  JSON.stringify({ settled, open, speech, end_dialogue });
const fake = (text) => ({
  text,
  provider: 'fixture',
  model: 'fixture',
  latencyMs: 100,
  usage: { inputTokens: 100, outputTokens: 30 },
});

test('Luna reference keeps the matched direct architecture inside the 23-attempt ceiling', () => {
  assert.equal(lunaReferencePlan.total_attempt_ceiling, 23);
  assert.equal(lunaReferencePlan.generationCap, 16);
  assert.equal(lunaReferencePlan.judge_calls, 5);
  assert.equal(lunaReferencePlan.recovery_attempt_reserve, 2);
  assert.deepEqual(
    lunaReferencePlan.arms.map(({ id, variant, mode, tutorMode, model }) => ({ id, variant, mode, tutorMode, model })),
    [
      {
        id: 'C',
        variant: 'luna',
        mode: 'direct',
        tutorMode: 'direct',
        model: 'codex.gpt-5.6-luna',
      },
    ],
  );
  assert.equal(lunaReferencePlan.interaction.learnerSystem, rivalPlan.interaction.learnerSystem);
  assert.equal(lunaReferencePlan.characterBrief, rivalPlan.characterBrief);
  assert.equal(lunaReferencePlan.tutor, rivalPlan.tutor);
});

test('learner iteration fixes two Luna development rungs and a three-model held-out test under 110 attempts', () => {
  assert.equal(learnerIterationPlan.total_attempt_ceiling, 110);
  assert.equal(learnerIterationPlan.generation_attempt_ceiling, 80);
  assert.equal(learnerIterationPlan.assessment_packets, 25);
  assert.equal(learnerIterationPlan.recovery_attempt_reserve, 5);
  assert.deepEqual(
    learnerIterationPlan.development.map((stage) => ({ world: stage.world.id, arms: stage.arms.map((arm) => arm.id) })),
    [
      { world: 'world_030_rowan_flat', arms: ['D1'] },
      { world: 'world_030_rowan_flat', arms: ['D2'] },
    ],
  );
  assert.equal(learnerIterationPlan.holdout.world.id, 'world_034_groupwork_flag');
  assert.deepEqual(
    learnerIterationPlan.holdout.arms.map(({ id, variant, mode, tutorMode, model }) => ({
      id,
      variant,
      mode,
      tutorMode,
      model,
    })),
    [
      {
        id: 'A',
        variant: 'luna',
        mode: 'direct',
        tutorMode: 'direct',
        model: 'codex.gpt-5.6-luna',
      },
      {
        id: 'B',
        variant: 'normal',
        mode: 'direct',
        tutorMode: 'direct',
        model: 'mlx-community/Qwen3.8-27B-4bit',
      },
      {
        id: 'C',
        variant: 'abliterated',
        mode: 'direct',
        tutorMode: 'direct',
        model: 'Qwen3.8-27B-Uncensored-MLX/4-bit',
      },
    ],
  );
  assert.match(learnerIterationPlan.development[0].interaction.learnerTurn, /commit to the assigned initial/iu);
  assert.doesNotMatch(learnerIterationPlan.development[0].interaction.learnerTurn, /same kind of move/iu);
  assert.match(learnerIterationPlan.development[1].interaction.learnerTurn, /same kind of move on adjacent turns/iu);
  assert.equal(
    learnerIterationPlan.development[1].interaction.learnerTurn,
    learnerIterationPlan.holdout.interaction.learnerTurn,
  );
});

test('learner iteration routes Luna to Codex and leaves Qwen on the local direct path', async () => {
  const calls = [];
  const callCli = async (agent, _system, _prompt, role, options) => {
    calls.push({ agent, role, options });
    return fake(reply('Fixture line.'));
  };
  const request = { systemPrompt: 'system', prompt: 'prompt', messageHistory: [] };
  await callLearnerIterationModel(
    {
      plan: learnerIterationPlan.holdout,
      arm: learnerIterationPlan.holdout.arms[0],
      speaker: 'learner',
      request,
      role: 'learner',
    },
    callCli,
  );
  await callLearnerIterationModel(
    {
      plan: learnerIterationPlan.holdout,
      arm: learnerIterationPlan.holdout.arms[0],
      speaker: 'tutor',
      request,
      role: 'tutor',
    },
    callCli,
  );
  assert.deepEqual(
    calls.map((call) => call.agent),
    [
      { provider: 'codex', model: 'gpt-5.6-luna' },
      { provider: 'codex', model: 'gpt-5.6-sol' },
    ],
  );
  assert.ok(calls.every((call) => call.options.singleAttempt === true));
});

test('learner iteration zero-call preview audits both worlds and builds all 25 assessment packets', async () => {
  const outDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'learner-iteration-preview-')), 'out');
  const result = await runLearnerIteration(['--output', outDir]);
  assert.deepEqual(
    {
      dryRun: result.dryRun,
      modelCalls: result.modelCalls,
      developmentPackets: result.developmentPackets,
      holdoutPackets: result.holdoutPackets,
    },
    { dryRun: true, modelCalls: 0, developmentPackets: 10, holdoutPackets: 15 },
  );
  const preflight = JSON.parse(fs.readFileSync(path.join(outDir, 'preflight.json'), 'utf8'));
  assert.equal(preflight.developmentLearnerRequests.length, 2);
  assert.equal(preflight.developmentTutorRequests.flat().length, 16);
  assert.equal(preflight.holdoutTutorRequests.length, 8);
  assert.ok(preflight.developmentLearnerRequests.every((request) => request.audit.ok && request.privilege.ok));
  assert.ok(preflight.holdoutTutorRequests.every((request) => request.audit.ok && request.privilege.ok));
  assert.ok(fs.existsSync(path.join(outDir, 'development-report-preview.html')));
  assert.ok(fs.existsSync(path.join(outDir, 'report-preview.html')));
});

test('learner replication fixes nine matched scaffold pairs under 396 attempts', () => {
  assert.equal(learnerReplicationPlan.total_attempt_ceiling, 396);
  assert.equal(learnerReplicationPlan.generation_attempt_ceiling, 288);
  assert.equal(learnerReplicationPlan.assessment_packets, 90);
  assert.equal(learnerReplicationPlan.recovery_attempt_reserve, 18);
  assert.deepEqual(
    learnerReplicationPlan.worlds.map((world) => world.conditions.baseline.world.id),
    ['world_028_larkspur_fridge', 'world_029_riverside_clinic', 'world_031_tideway_makerspace'],
  );
  for (const world of learnerReplicationPlan.worlds) {
    assert.deepEqual(
      world.conditions.baseline.arms.map((arm) => `${arm.id}:${arm.route}:${arm.mechanism}`),
      ['L0:luna:baseline', 'N0:qwen_normal:baseline', 'A0:qwen_abliterated:baseline'],
    );
    assert.deepEqual(
      world.conditions.active_progression.arms.map((arm) => `${arm.id}:${arm.route}:${arm.mechanism}`),
      ['L1:luna:active_progression', 'N1:qwen_normal:active_progression', 'A1:qwen_abliterated:active_progression'],
    );
    assert.doesNotMatch(world.conditions.baseline.interaction.learnerSystem, /\bAlex\b/u);
    assert.doesNotMatch(world.conditions.active_progression.interaction.learnerSystem, /\bAlex\b/u);
    assert.doesNotMatch(world.conditions.baseline.interaction.learnerTurn, /same kind of move/iu);
    assert.match(world.conditions.active_progression.interaction.learnerTurn, /same kind of move on adjacent turns/iu);
    assert.equal(
      world.conditions.active_progression.interaction.learnerSystem.split('\n\n').at(-1),
      learnerIterationPlan.development[1].interaction.learnerSystem.split('\n\n').at(-1),
    );
    assert.equal(
      world.conditions.active_progression.interaction.learnerTurn.split('\n\n').at(-1),
      learnerIterationPlan.development[1].interaction.learnerTurn.split('\n\n').at(-1),
    );
    const batches = replicationAssessmentBatches(world, [
      ...world.conditions.baseline.arms,
      ...world.conditions.active_progression.arms,
    ]);
    assert.deepEqual(
      batches.map((batch) => ({
        mechanism: batch.mechanism,
        arms: batch.arms.map((arm) => arm.id),
        packetCeiling: batch.packetCeiling,
      })),
      [
        { mechanism: 'baseline', arms: ['L0', 'N0', 'A0'], packetCeiling: 15 },
        { mechanism: 'active_progression', arms: ['L1', 'N1', 'A1'], packetCeiling: 15 },
      ],
    );
  }
});

test('learner replication analysis applies the frozen mechanism and paper gates', () => {
  const quality = (arm, value, unsupported = false) => ({
    arm,
    kind: 'quality',
    raw: {
      measurement_indeterminate: false,
      scores: Object.fromEntries(
        ['overall_quality', 'successful_pedagogy', 'surprise_nonrepetition', 'character_adherence'].map((dimension) => [
          dimension,
          { score: value },
        ]),
      ),
      learner_turns: [{ unsupported_evidence_assertion: unsupported }],
    },
  });
  const worldResults = learnerReplicationPlan.worlds.map((world) => ({
    key: world.key,
    evaluation: {
      scores: ['L', 'N', 'A'].flatMap((prefix) => [quality(`${prefix}0`, 2), quality(`${prefix}1`, 3)]),
    },
  }));
  const passing = analyzeLearnerReplication(learnerReplicationPlan, worldResults);
  assert.equal(passing.primaryMeanDelta, 1);
  assert.equal(passing.supportiveMeanDelta, 1);
  assert.deepEqual(passing.gates, { replication: true, mainTextPaper: true });

  worldResults[0].evaluation.scores.find(
    (score) => score.arm === 'L1',
  ).raw.learner_turns[0].unsupported_evidence_assertion = true;
  const failing = analyzeLearnerReplication(learnerReplicationPlan, worldResults);
  assert.equal(failing.unsupportedAssertions, 1);
  assert.deepEqual(failing.gates, { replication: false, mainTextPaper: false });
});

test('learner replication routes Luna and Sol directly with no superego call', async () => {
  const calls = [];
  const callCli = async (agent, _system, _prompt, role, options) => {
    calls.push({ agent, role, options });
    return fake(reply('Fixture line.'));
  };
  const condition = learnerReplicationPlan.worlds[0].conditions.active_progression;
  const request = { systemPrompt: 'system', prompt: 'prompt', messageHistory: [] };
  await callLearnerReplicationModel(
    { plan: condition, arm: condition.arms[0], speaker: 'learner', request, role: 'learner' },
    callCli,
  );
  await callLearnerReplicationModel(
    { plan: condition, arm: condition.arms[0], speaker: 'tutor', request, role: 'tutor' },
    callCli,
  );
  assert.deepEqual(
    calls.map((call) => call.agent),
    [
      { provider: 'codex', model: 'gpt-5.6-luna' },
      { provider: 'codex', model: 'gpt-5.6-sol' },
    ],
  );
  assert.ok(calls.every((call) => call.options.singleAttempt === true));
});

test('learner replication zero-call preview audits 18 dialogues and all 90 packets', async () => {
  const outDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'learner-replication-preview-')), 'out');
  const result = await runLearnerReplication(['--output', outDir]);
  assert.deepEqual(
    {
      dryRun: result.dryRun,
      modelCalls: result.modelCalls,
      dialogues: result.dialogues,
      matchedPairs: result.matchedPairs,
      assessmentPackets: result.assessmentPackets,
    },
    { dryRun: true, modelCalls: 0, dialogues: 18, matchedPairs: 9, assessmentPackets: 90 },
  );
  const preflight = JSON.parse(fs.readFileSync(path.join(outDir, 'preflight.json'), 'utf8'));
  assert.equal(preflight.worlds.length, 3);
  assert.equal(preflight.worlds.flatMap((world) => world.learnerRequests).length, 18);
  assert.equal(preflight.worlds.flatMap((world) => world.tutorRequests).length, 24);
  assert.ok(
    preflight.worlds
      .flatMap((world) => world.learnerRequests)
      .every(({ request }) => request.audit.ok && request.privilege.ok),
  );
  assert.ok(
    preflight.worlds
      .flatMap((world) => world.tutorRequests)
      .every((request) => request.audit.ok && request.privilege.ok),
  );
  assert.ok(
    learnerReplicationPlan.worlds.every((world) => fs.existsSync(path.join(outDir, world.key, 'report-preview.html'))),
  );
});

test('learner replication paid path fails before writing without standing launch authority', async () => {
  const outDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'learner-replication-authority-')), 'out');
  await assert.rejects(runLearnerReplication(['--live', '--output', outDir]), /shared launch arguments/iu);
  assert.equal(fs.existsSync(outDir), false);
});

test('Luna reference routes learner to Luna, tutor to Sol, and never adds a superego call', async () => {
  const calls = [];
  const callCli = async (agent, _system, _prompt, role, options) => {
    calls.push({ agent, role, options });
    return fake(reply('Fixture line.'));
  };
  const request = { systemPrompt: 'system', prompt: 'prompt', messageHistory: [] };
  await callLunaReferenceModel(
    { plan: lunaReferencePlan, arm: lunaReferencePlan.lunaArm, speaker: 'learner', request, role: 'learner' },
    callCli,
  );
  await callLunaReferenceModel(
    { plan: lunaReferencePlan, arm: lunaReferencePlan.lunaArm, speaker: 'tutor', request, role: 'tutor' },
    callCli,
  );
  assert.deepEqual(
    calls.map((call) => call.agent),
    [
      { provider: 'codex', model: 'gpt-5.6-luna' },
      { provider: 'codex', model: 'gpt-5.6-sol' },
    ],
  );
  assert.ok(calls.every((call) => call.options.singleAttempt === true));
  assert.ok(calls.every((call) => call.options.outputSchema === CONTINUITY_OUTPUT_SCHEMA));
});

test('Luna judge transport retries only response-free failures and projects surplus root fields once', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-reference-judge-'));
  let reserved = 0;
  const budget = {
    reserve() {
      reserved += 1;
      return { call: reserved, limit: 23, remaining: 23 - reserved };
    },
  };
  let calls = 0;
  const callCli = async (_agent, _system, _prompt, _role, options) => {
    calls += 1;
    assert.equal(options.outputSchema.additionalProperties, true);
    if (calls === 1) {
      const error = new Error('response-free');
      error.code = 'CLI_PROVIDER_RESPONSE_FREE_ERROR';
      error.classification = 'response_free_error';
      error.reason = 'result_error_without_structured_output';
      throw error;
    }
    options.onRawOutput({ fixture: true });
    return fake(JSON.stringify({ wanted: 'kept', surplus: 'discarded' }));
  };
  const caller = makeLunaJudgeCaller({ budget, outDir, callCli });
  let transported;
  const response = await caller({ provider: 'claude-code', model: 'claude-opus-5' }, '', 'prompt', 'fixture-quality', {
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['wanted'],
      properties: { wanted: { type: 'string' } },
    },
    onRawOutput: (value) => {
      transported = value;
    },
  });
  assert.deepEqual(JSON.parse(response.text), { wanted: 'kept' });
  assert.deepEqual(transported, { fixture: true });
  assert.deepEqual(caller.snapshot(), { physicalAttempts: 2, responseFreeRetries: 1 });
  assert.equal(reserved, 2);
});
const reviewFixture = {
  role_fidelity: 'Keep the role.',
  repetition: 'Check the previous move.',
  next_move: 'Keep a useful boundary.',
  evidence_boundary: 'No new facts.',
};

function schemaFixture(schema, key = '', index = 0) {
  if (Object.hasOwn(schema, 'const')) return schema.const;
  if (schema.anyOf) return schemaFixture(schema.anyOf[0], key, index);
  if (schema.type === 'null') return null;
  if (schema.type === 'string') return 'fixture';
  if (schema.type === 'boolean') return false;
  if (schema.type === 'number') return schema.minimum ?? 3;
  if (schema.type === 'integer') {
    if (key === 'turn') return index + 1;
    if (key.endsWith('_index')) return index;
    return schema.minimum ?? 0;
  }
  if (schema.type === 'array') {
    return Array.from({ length: schema.minItems || 0 }, (_, row) => schemaFixture(schema.items, key, row));
  }
  if (schema.type === 'object') {
    return Object.fromEntries(
      (schema.required || []).map((child) => [child, schemaFixture(schema.properties[child], child, index)]),
    );
  }
  throw new Error(`unsupported fixture schema at ${key}`);
}

function createLinkedAssessmentRecoveryFixture() {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-rival-linked-assessment-test-'));
  const evaluationDir = path.join(sourceDir, 'evaluation');
  fs.mkdirSync(evaluationDir);
  const releasedPremiseIds = rivalPlan.world.premises.map((premise) => premise.id);
  const turns = Array.from({ length: rivalPlan.max_exchanges }, (_, index) => ({
    turn: index + 1,
    learner: `Learner fixture ${index + 1}`,
    tutor: rivalPlan.world.premises[index]?.surface || `Tutor fixture ${index + 1}`,
  }));
  const arms = rivalPlan.arms.map((arm) => ({
    ...arm,
    snapshot: { turns, proofControl: { releasedPremiseIds } },
    opening: rivalPlan.world.opening_frame.authored_text,
    transcript: turns.map((turn) => `Learner: ${turn.learner}\nTutor: ${turn.tutor}`).join('\n'),
  }));
  fs.writeFileSync(
    path.join(sourceDir, 'plan.json'),
    JSON.stringify({
      id: rivalPlan.id,
      provenance: {
        recovery: true,
        linkedRecoveryStudyId: `${rivalPlan.id}-generation-recovery-v3`,
        linkedRecoveryAttemptCeiling: 31,
        priorAttemptCount: 17,
      },
    }),
  );
  fs.writeFileSync(
    path.join(sourceDir, 'stopped.json'),
    JSON.stringify({
      error:
        'claude CLI structured response classified as response_free_error (result_error_without_structured_output)',
      budget: { used: 37, limit: 48 },
      armsCompleted: 2,
      recoveryPermitted: false,
    }),
  );
  fs.writeFileSync(path.join(sourceDir, 'arms.json'), JSON.stringify(arms));
  fs.writeFileSync(
    path.join(sourceDir, 'run-ledger.jsonl'),
    `${Array.from({ length: 20 }, () => JSON.stringify({ type: 'model_attempt_reserved', count: 1 })).join('\n')}\n${JSON.stringify(
      {
        type: 'run_sealed',
        status: 'failed',
        reserved_attempts: 20,
      },
    )}\n`,
  );
  const judgeEvents = [
    { event: 'reserved', arm: 'A', kind: 'tutor' },
    { event: 'completed', arm: 'A', kind: 'tutor' },
    { event: 'reserved', arm: 'A', kind: 'learner' },
    { event: 'completed', arm: 'A', kind: 'learner' },
    { event: 'reserved', arm: 'A', kind: 'dialogue' },
    { event: 'completed', arm: 'A', kind: 'dialogue' },
    { event: 'reserved', arm: 'A', kind: 'quality' },
    { event: 'failed', arm: 'A', kind: 'quality' },
  ];
  fs.writeFileSync(
    path.join(evaluationDir, 'judge-ledger.jsonl'),
    `${judgeEvents.map((event) => JSON.stringify(event)).join('\n')}\n`,
  );
  fs.writeFileSync(
    path.join(evaluationDir, 'A-quality.error.json'),
    JSON.stringify({
      message:
        'claude CLI structured response classified as response_free_error (result_error_without_structured_output)',
      code: 'CLI_PROVIDER_RESPONSE_FREE_ERROR',
      classification: 'response_free_error',
      reason: 'result_error_without_structured_output',
    }),
  );
  const publicSourceContextByArm = Object.fromEntries(
    arms.map((arm) => [arm.id, investedRivalDeliveredSourceContext(rivalPlan, arm)]),
  );
  const failedJob = buildBenchmarkJobs(arms, {
    extendedQuality: true,
    assessmentContext: rivalPlan.assessmentContext,
    publicSourceContextByArm,
  }).find((job) => job.arm === 'A' && job.kind === 'quality');
  fs.writeFileSync(path.join(evaluationDir, 'A-quality.prompt.txt'), failedJob.prompt);
  fs.writeFileSync(path.join(evaluationDir, 'A-quality.schema.json'), JSON.stringify(failedJob.outputSchema));
  for (const kind of ['tutor', 'learner', 'dialogue']) {
    fs.writeFileSync(
      path.join(evaluationDir, `A-${kind}.json`),
      JSON.stringify(schemaFixture(buildBenchmarkOutputSchema(kind, rivalPlan.max_exchanges))),
    );
  }
  return { sourceDir, arms, failedJob };
}

function createQualityTransportRecoveryFixture() {
  const prior = createLinkedAssessmentRecoveryFixture();
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-rival-quality-transport-test-'));
  const evaluationDir = path.join(sourceDir, 'evaluation');
  fs.mkdirSync(evaluationDir);
  fs.writeFileSync(
    path.join(sourceDir, 'plan.json'),
    JSON.stringify({
      id: rivalPlan.id,
      provenance: {
        recovery: true,
        linkedRecoveryStudyId: `${rivalPlan.id}-generation-recovery-v4`,
        linkedRecoveryAttemptCeiling: 11,
        priorAttemptCount: 37,
        reusedCompletedAssessments: ['A/tutor', 'A/learner', 'A/dialogue'],
        recoverySource: prior.sourceDir,
      },
    }),
  );
  fs.writeFileSync(
    path.join(sourceDir, 'stopped.json'),
    JSON.stringify({
      error:
        'claude CLI structured response classified as response_free_error (result_error_without_structured_output)',
      budget: { used: 38, limit: 48 },
    }),
  );
  fs.writeFileSync(path.join(sourceDir, 'arms.json'), JSON.stringify(prior.arms));
  fs.writeFileSync(
    path.join(sourceDir, 'run-ledger.jsonl'),
    `${JSON.stringify({ type: 'model_attempt_reserved', count: 1 })}\n${JSON.stringify({
      type: 'run_sealed',
      status: 'failed',
      reserved_attempts: 1,
    })}\n`,
  );
  fs.writeFileSync(
    path.join(evaluationDir, 'judge-ledger.jsonl'),
    `${JSON.stringify({ event: 'reserved', arm: 'A', kind: 'quality' })}\n${JSON.stringify({
      event: 'failed',
      arm: 'A',
      kind: 'quality',
    })}\n`,
  );
  fs.writeFileSync(
    path.join(evaluationDir, 'A-quality.error.json'),
    JSON.stringify({
      message:
        'claude CLI structured response classified as response_free_error (result_error_without_structured_output)',
      code: 'CLI_PROVIDER_RESPONSE_FREE_ERROR',
      classification: 'response_free_error',
      reason: 'result_error_without_structured_output',
    }),
  );
  fs.writeFileSync(path.join(evaluationDir, 'A-quality.prompt.txt'), prior.failedJob.prompt);
  fs.writeFileSync(path.join(evaluationDir, 'A-quality.schema.json'), JSON.stringify(prior.failedJob.outputSchema));
  return { sourceDir, prior };
}

function createQualitySplitRecoveryFixture() {
  const previous = createQualityTransportRecoveryFixture();
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-rival-quality-split-test-'));
  const evaluationDir = path.join(sourceDir, 'evaluation');
  fs.mkdirSync(evaluationDir);
  fs.writeFileSync(
    path.join(sourceDir, 'plan.json'),
    JSON.stringify({
      id: rivalPlan.id,
      provenance: {
        recovery: true,
        linkedRecoveryStudyId: `${rivalPlan.id}-generation-recovery-v5`,
        linkedRecoveryAttemptCeiling: 10,
        priorAttemptCount: 38,
        reusedCompletedAssessments: ['A/tutor', 'A/learner', 'A/dialogue'],
        recoverySource: previous.sourceDir,
      },
    }),
  );
  fs.writeFileSync(
    path.join(sourceDir, 'stopped.json'),
    JSON.stringify({
      error: 'claude CLI structured response classified as indeterminate (invalid_json_result_text)',
      budget: { used: 39, limit: 48 },
    }),
  );
  fs.writeFileSync(path.join(sourceDir, 'arms.json'), JSON.stringify(previous.prior.arms));
  fs.writeFileSync(
    path.join(sourceDir, 'run-ledger.jsonl'),
    `${JSON.stringify({ type: 'model_attempt_reserved', count: 1 })}\n${JSON.stringify({
      type: 'run_sealed',
      status: 'failed',
      reserved_attempts: 1,
    })}\n`,
  );
  fs.writeFileSync(
    path.join(evaluationDir, 'judge-ledger.jsonl'),
    `${JSON.stringify({ event: 'reserved', arm: 'A', kind: 'quality' })}\n${JSON.stringify({
      event: 'failed',
      arm: 'A',
      kind: 'quality',
    })}\n`,
  );
  fs.writeFileSync(
    path.join(evaluationDir, 'A-quality.error.json'),
    JSON.stringify({
      message: 'claude CLI structured response classified as indeterminate (invalid_json_result_text)',
      code: 'CLI_PROVIDER_AMBIGUOUS_OUTPUT',
      classification: 'indeterminate',
      reason: 'invalid_json_result_text',
    }),
  );
  fs.writeFileSync(path.join(evaluationDir, 'A-quality.prompt.txt'), previous.prior.failedJob.prompt);
  fs.writeFileSync(
    path.join(evaluationDir, 'A-quality.schema.json'),
    JSON.stringify(previous.prior.failedJob.outputSchema),
  );
  fs.writeFileSync(
    path.join(evaluationDir, 'A-quality.transport.json'),
    JSON.stringify({
      stdout: JSON.stringify([
        { type: 'system', subtype: 'init', tools: [] },
        { type: 'assistant', message: { content: [{ type: 'text', text: '{"scores":' }] } },
        { type: 'result', is_error: false, subtype: 'success', num_turns: 1, result: '{"scores":' },
      ]),
      stderr: '',
      exitCode: 0,
    }),
  );
  return { sourceDir, previous };
}

function createQualitySplitStructuredRecoveryFixture() {
  const previous = createQualitySplitRecoveryFixture();
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-rival-quality-split-structured-test-'));
  const evaluationDir = path.join(sourceDir, 'evaluation');
  fs.mkdirSync(evaluationDir);
  fs.writeFileSync(
    path.join(sourceDir, 'plan.json'),
    JSON.stringify({
      id: rivalPlan.id,
      provenance: {
        recovery: true,
        linkedRecoveryStudyId: `${rivalPlan.id}-generation-recovery-v6`,
        linkedRecoveryAttemptCeiling: 9,
        priorAttemptCount: 39,
        reusedCompletedAssessments: ['A/tutor', 'A/learner', 'A/dialogue'],
        recoverySource: previous.sourceDir,
      },
    }),
  );
  fs.writeFileSync(
    path.join(sourceDir, 'stopped.json'),
    JSON.stringify({
      error: 'claude CLI structured response classified as indeterminate (invalid_json_result_text)',
      budget: { used: 40, limit: 48 },
    }),
  );
  fs.writeFileSync(path.join(sourceDir, 'arms.json'), JSON.stringify(previous.previous.prior.arms));
  fs.writeFileSync(
    path.join(sourceDir, 'run-ledger.jsonl'),
    `${JSON.stringify({ type: 'model_attempt_reserved', count: 1 })}\n${JSON.stringify({
      type: 'run_sealed',
      status: 'failed',
      reserved_attempts: 1,
    })}\n`,
  );
  fs.writeFileSync(
    path.join(evaluationDir, 'judge-ledger.jsonl'),
    `${JSON.stringify({ event: 'reserved', arm: 'A', kind: 'quality-summary' })}\n${JSON.stringify({
      event: 'failed',
      arm: 'A',
      kind: 'quality-summary',
    })}\n`,
  );
  fs.writeFileSync(
    path.join(evaluationDir, 'A-quality-summary.error.json'),
    JSON.stringify({
      message: 'claude CLI structured response classified as indeterminate (invalid_json_result_text)',
      code: 'CLI_PROVIDER_AMBIGUOUS_OUTPUT',
      classification: 'indeterminate',
      reason: 'invalid_json_result_text',
    }),
  );
  const arms = previous.previous.prior.arms;
  const job = buildBenchmarkJobs(arms, {
    extendedQuality: true,
    assessmentContext: rivalPlan.assessmentContext,
    publicSourceContextByArm: Object.fromEntries(
      arms.map((arm) => [arm.id, investedRivalDeliveredSourceContext(rivalPlan, arm)]),
    ),
    splitQuality: true,
  }).find((candidate) => candidate.arm === 'A' && candidate.kind === 'quality-summary');
  fs.writeFileSync(path.join(evaluationDir, 'A-quality-summary.prompt.txt'), job.prompt);
  fs.writeFileSync(path.join(evaluationDir, 'A-quality-summary.schema.json'), JSON.stringify(job.outputSchema));
  const invalidResult = `${JSON.stringify(schemaFixture(job.outputSchema))}\n\nThe assessment is complete.\n${JSON.stringify({ extra: true })}`;
  fs.writeFileSync(
    path.join(evaluationDir, 'A-quality-summary.transport.json'),
    JSON.stringify({
      stdout: JSON.stringify([
        { type: 'system', subtype: 'init', tools: [] },
        { type: 'assistant', message: { content: [{ type: 'text', text: invalidResult }] } },
        { type: 'result', is_error: false, subtype: 'success', num_turns: 1, result: invalidResult },
      ]),
      stderr: '',
      exitCode: 0,
    }),
  );
  return { sourceDir, previous };
}

function createFinalQualityRecoveryFixture() {
  const previous = createQualitySplitStructuredRecoveryFixture();
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-rival-final-quality-test-'));
  const evaluationDir = path.join(sourceDir, 'evaluation');
  fs.mkdirSync(evaluationDir);
  const arms = JSON.parse(fs.readFileSync(path.join(previous.sourceDir, 'arms.json'), 'utf8'));
  fs.writeFileSync(
    path.join(sourceDir, 'plan.json'),
    JSON.stringify({
      id: rivalPlan.id,
      provenance: {
        recovery: true,
        linkedRecoveryStudyId: `${rivalPlan.id}-generation-recovery-v7`,
        linkedRecoveryAttemptCeiling: 8,
        priorAttemptCount: 40,
        reusedCompletedAssessments: ['A/tutor', 'A/learner', 'A/dialogue'],
        recoverySource: previous.sourceDir,
      },
    }),
  );
  fs.writeFileSync(
    path.join(sourceDir, 'stopped.json'),
    JSON.stringify({
      error: 'claude CLI structured response classified as response_free_error',
      budget: { used: 46, limit: 48 },
    }),
  );
  fs.writeFileSync(path.join(sourceDir, 'arms.json'), JSON.stringify(arms));
  fs.writeFileSync(
    path.join(sourceDir, 'run-ledger.jsonl'),
    `${Array.from({ length: 6 }, () => JSON.stringify({ type: 'model_attempt_reserved', count: 1 })).join('\n')}\n${JSON.stringify(
      { type: 'run_sealed', status: 'failed', reserved_attempts: 6 },
    )}\n`,
  );
  const judgeEvents = [
    { event: 'reserved', arm: 'A', kind: 'quality-summary' },
    { event: 'completed', arm: 'A', kind: 'quality-summary' },
    { event: 'reserved', arm: 'A', kind: 'quality-turns' },
    { event: 'completed', arm: 'A', kind: 'quality-turns' },
    { event: 'reserved', arm: 'B', kind: 'tutor' },
    { event: 'completed', arm: 'B', kind: 'tutor' },
    { event: 'reserved', arm: 'B', kind: 'learner' },
    { event: 'completed', arm: 'B', kind: 'learner' },
    { event: 'reserved', arm: 'B', kind: 'dialogue' },
    { event: 'completed', arm: 'B', kind: 'dialogue' },
    { event: 'reserved', arm: 'B', kind: 'quality-summary' },
    { event: 'failed', arm: 'B', kind: 'quality-summary' },
  ];
  fs.writeFileSync(
    path.join(evaluationDir, 'judge-ledger.jsonl'),
    `${judgeEvents.map((event) => JSON.stringify(event)).join('\n')}\n`,
  );
  fs.writeFileSync(
    path.join(evaluationDir, 'B-quality-summary.error.json'),
    JSON.stringify({
      message: 'claude CLI structured response classified as response_free_error',
      code: 'CLI_PROVIDER_RESPONSE_FREE_ERROR',
      classification: 'response_free_error',
      reason: 'result_error_without_structured_output',
    }),
  );
  const jobs = buildBenchmarkJobs(arms, {
    extendedQuality: true,
    assessmentContext: rivalPlan.assessmentContext,
    publicSourceContextByArm: Object.fromEntries(
      arms.map((arm) => [arm.id, investedRivalDeliveredSourceContext(rivalPlan, arm)]),
    ),
    splitQuality: true,
  });
  const failedJob = jobs.find((job) => job.arm === 'B' && job.kind === 'quality-summary');
  fs.writeFileSync(path.join(evaluationDir, 'B-quality-summary.prompt.txt'), failedJob.prompt);
  fs.writeFileSync(path.join(evaluationDir, 'B-quality-summary.schema.json'), JSON.stringify(failedJob.outputSchema));
  fs.writeFileSync(
    path.join(evaluationDir, 'B-quality-summary.transport.json'),
    JSON.stringify({
      stdout: JSON.stringify([
        { type: 'system', subtype: 'init' },
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                name: 'StructuredOutput',
                input: { reasoning_effort: 'medium', ...schemaFixture(failedJob.outputSchema) },
              },
            ],
          },
        },
        {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                is_error: true,
                content: 'Output does not match required schema: root: must NOT have additional properties',
              },
            ],
          },
        },
        { type: 'result', subtype: 'error_max_structured_output_retries', is_error: true },
      ]),
      stderr: '',
      exitCode: 1,
    }),
  );
  for (const [arm, kind] of [
    ['A', 'quality'],
    ['B', 'tutor'],
    ['B', 'learner'],
    ['B', 'dialogue'],
  ]) {
    fs.writeFileSync(
      path.join(evaluationDir, `${arm}-${kind}.json`),
      JSON.stringify(
        schemaFixture(buildBenchmarkOutputSchema(kind, rivalPlan.max_exchanges, { extendedQuality: true })),
      ),
    );
  }
  return { sourceDir, previous };
}

function createFinalCompletionRecoveryFixture() {
  const previous = createFinalQualityRecoveryFixture();
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-rival-final-completion-test-'));
  const evaluationDir = path.join(sourceDir, 'evaluation');
  fs.mkdirSync(evaluationDir);
  const arms = JSON.parse(fs.readFileSync(path.join(previous.sourceDir, 'arms.json'), 'utf8'));
  fs.writeFileSync(
    path.join(sourceDir, 'plan.json'),
    JSON.stringify({
      id: rivalPlan.id,
      provenance: {
        recovery: true,
        linkedRecoveryStudyId: `${rivalPlan.id}-generation-recovery-v8`,
        linkedRecoveryAttemptCeiling: 2,
        priorAttemptCount: 46,
        reusedCompletedAssessments: [
          'A/tutor',
          'A/learner',
          'A/dialogue',
          'A/quality',
          'B/tutor',
          'B/learner',
          'B/dialogue',
        ],
        recoverySource: previous.sourceDir,
      },
    }),
  );
  fs.writeFileSync(
    path.join(sourceDir, 'stopped.json'),
    JSON.stringify({
      error: 'claude CLI structured response classified as response_free_error',
      budget: { used: 48, limit: 48 },
    }),
  );
  fs.writeFileSync(path.join(sourceDir, 'arms.json'), JSON.stringify(arms));
  fs.writeFileSync(
    path.join(sourceDir, 'run-ledger.jsonl'),
    `${Array.from({ length: 2 }, () => JSON.stringify({ type: 'model_attempt_reserved', count: 1 })).join('\n')}\n${JSON.stringify(
      { type: 'run_sealed', status: 'failed', reserved_attempts: 2 },
    )}\n`,
  );
  const judgeEvents = [
    { event: 'reserved', arm: 'B', kind: 'quality-summary' },
    { event: 'completed', arm: 'B', kind: 'quality-summary' },
    { event: 'reserved', arm: 'B', kind: 'quality-turns' },
    { event: 'failed', arm: 'B', kind: 'quality-turns' },
  ];
  fs.writeFileSync(
    path.join(evaluationDir, 'judge-ledger.jsonl'),
    `${judgeEvents.map((event) => JSON.stringify(event)).join('\n')}\n`,
  );
  const jobs = buildBenchmarkJobs(arms, {
    extendedQuality: true,
    assessmentContext: rivalPlan.assessmentContext,
    publicSourceContextByArm: Object.fromEntries(
      arms.map((arm) => [arm.id, investedRivalDeliveredSourceContext(rivalPlan, arm)]),
    ),
    splitQuality: true,
  });
  const summaryJob = jobs.find((job) => job.arm === 'B' && job.kind === 'quality-summary');
  const turnsJob = jobs.find((job) => job.arm === 'B' && job.kind === 'quality-turns');
  fs.writeFileSync(path.join(evaluationDir, 'B-quality-summary.prompt.txt'), summaryJob.prompt);
  fs.writeFileSync(path.join(evaluationDir, 'B-quality-summary.schema.json'), JSON.stringify(summaryJob.outputSchema));
  fs.writeFileSync(
    path.join(evaluationDir, 'B-quality-summary.json'),
    JSON.stringify(schemaFixture(summaryJob.outputSchema)),
  );
  fs.writeFileSync(path.join(evaluationDir, 'B-quality-turns.prompt.txt'), turnsJob.prompt);
  fs.writeFileSync(path.join(evaluationDir, 'B-quality-turns.schema.json'), JSON.stringify(turnsJob.outputSchema));
  fs.writeFileSync(
    path.join(evaluationDir, 'B-quality-turns.error.json'),
    JSON.stringify({
      message: 'claude CLI structured response classified as response_free_error',
      code: 'CLI_PROVIDER_RESPONSE_FREE_ERROR',
      classification: 'response_free_error',
      reason: 'result_error_without_structured_output',
    }),
  );
  fs.writeFileSync(
    path.join(evaluationDir, 'B-quality-turns.transport.json'),
    JSON.stringify({
      stdout: JSON.stringify([
        { type: 'system', subtype: 'init' },
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                name: 'StructuredOutput',
                input: { turns: '[]', ...schemaFixture(turnsJob.outputSchema) },
              },
            ],
          },
        },
        {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                is_error: true,
                content: 'Output does not match required schema: root: must NOT have additional properties',
              },
            ],
          },
        },
        { type: 'result', subtype: 'error_max_structured_output_retries', is_error: true },
      ]),
      stderr: '',
      exitCode: 1,
    }),
  );
  return { sourceDir, previous, arms, summaryJob, turnsJob };
}

test('invested rival plan preserves the original ceiling and adds only the bounded completion amendment', () => {
  assert.equal(rivalPlan.total_attempt_ceiling, 48);
  assert.equal(rivalPlan.generationCap, 32);
  assert.equal(rivalPlan.judge_calls, 8);
  assert.equal(rivalPlan.recovery_attempt_reserve, 8);
  assert.equal(rivalPlan.completion_attempt_ceiling, 50);
  assert.equal(rivalPlan.completion_recovery_attempt_ceiling, 2);
  assert.equal(rivalPlan.tutor_control, 'public_proof_dag');
  assert.deepEqual(
    rivalPlan.arms.map((arm) => [arm.id, arm.variant, arm.mode, arm.tutorMode || 'direct']),
    [
      ['A', 'normal', 'direct', 'direct'],
      ['B', 'abliterated', 'direct', 'direct'],
    ],
  );
  assert.equal(rivalPlan.assessmentContext.profileId, 'invested_rival_theorist_v1');
  assert.match(rivalPlan.characterBrief, /initially favour the shower explanation/u);
  assert.match(rivalPlan.characterBrief, /acknowledge that exact point/u);
});

test('invested rival prompts contain no inherited handoff/refuser instruction or future evidence', () => {
  const history = [{ role: 'assistant', content: rivalPlan.world.opening_frame.authored_text }];
  const learner = buildContinuityRequest({ plan: rivalPlan, speaker: 'learner', turn: 1, history });
  const tutor = buildContinuityRequest({ plan: rivalPlan, speaker: 'tutor', turn: 1, history });
  const learnerText = learner.systemPrompt + learner.prompt;
  const tutorText = tutor.systemPrompt + tutor.prompt;
  for (const text of [learnerText, tutorText]) {
    assert.doesNotMatch(
      text,
      /Pursue your handoff goal|assistant solving the leak|unpaid investigation|refuses the investigator role|repeated refusal cue/u,
    );
    assert.doesNotMatch(text, /Blue tracing dye|hairline split|p_dye|p_split|basinFeedHose/u);
  }
  assert.match(learnerText, /learner in this fictional household inquiry/u);
  assert.match(learnerText, /React to the latest public claim/u);
  assert.match(tutorText, /answer Alex's actual rival explanation/u);
  assert.ok(learner.audit.ok && learner.privilege.ok && tutor.audit.ok && tutor.privilege.ok);
});

test('invested rival zero-call rehearsal composes judge packets and a synthetic report', async () => {
  const result = await runInvestedRival([]);
  assert.equal(result.dryRun, true);
  assert.equal(result.attempts, 0);
  assert.equal(result.packets, 8);
  const packet = JSON.parse(fs.readFileSync(path.join(result.outDir, 'judge-packet-preflight.json'), 'utf8'));
  assert.equal(packet.synthetic, true);
  assert.equal(packet.modelCalls, 0);
  assert.equal(packet.packets.length, 8);
  for (const job of packet.packets) {
    assert.doesNotMatch(job.prompt, /Qwen|abliterated|p_dye|p_split|basinFeedHose/u);
    assert.match(job.prompt, /Alex|Water Mark in Rowan Flat/u);
  }
  const report = fs.readFileSync(path.join(result.outDir, 'report-preview.html'), 'utf8');
  assert.match(report, /SYNTHETIC PREVIEW/u);
  assert.match(report, /adversarial learner care about the answer/u);
  assert.doesNotMatch(report, /of 40 total attempts/u);
});

test('invested rival paid path fails before writing unless standing launch authority is supplied', async () => {
  const outDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-rival-paid-gate-test-')), 'run');
  await assert.rejects(
    runInvestedRival(['--live', '--output', outDir]),
    /paid launch requires --accept-charges, --launch-commit, --go-note-commit, and --go-note-path/u,
  );
  assert.equal(fs.existsSync(outDir), false);
});

test('invested rival recovery admits one empty technical packet and rejects nonempty output', () => {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-rival-recovery-test-'));
  const evaluationDir = path.join(sourceDir, 'evaluation');
  fs.mkdirSync(evaluationDir);
  fs.writeFileSync(
    path.join(evaluationDir, 'judge-ledger.jsonl'),
    [
      JSON.stringify({ event: 'reserved', arm: 'A', kind: 'tutor' }),
      JSON.stringify({ event: 'failed', arm: 'A', kind: 'tutor' }),
    ].join('\n') + '\n',
  );
  fs.writeFileSync(
    path.join(evaluationDir, 'A-tutor.error.json'),
    JSON.stringify({ message: 'provider transport timed out with empty output' }),
  );
  assert.deepEqual(technicalRecoveryEligible(sourceDir), {
    priorAttempts: 1,
    failure: {
      arm: 'A',
      kind: 'tutor',
      error: { message: 'provider transport timed out with empty output' },
    },
  });
  fs.writeFileSync(path.join(evaluationDir, 'A-tutor.response.txt'), '{"nonempty":"malformed"}');
  assert.throws(() => technicalRecoveryEligible(sourceDir), /nonempty or substantive/u);

  const responseFreeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-rival-response-free-recovery-test-'));
  const responseFreeEvaluation = path.join(responseFreeDir, 'evaluation');
  fs.mkdirSync(responseFreeEvaluation);
  fs.writeFileSync(
    path.join(responseFreeEvaluation, 'judge-ledger.jsonl'),
    `${JSON.stringify({ event: 'reserved', arm: 'A', kind: 'quality' })}\n${JSON.stringify({
      event: 'failed',
      arm: 'A',
      kind: 'quality',
    })}\n`,
  );
  fs.writeFileSync(
    path.join(responseFreeEvaluation, 'A-quality.error.json'),
    JSON.stringify({
      message: 'claude CLI structured response classified as response_free_error',
      code: 'CLI_PROVIDER_RESPONSE_FREE_ERROR',
      classification: 'response_free_error',
      reason: 'result_error_without_structured_output',
    }),
  );
  assert.equal(technicalRecoveryEligible(responseFreeDir).failure.kind, 'quality');

  const budget = continuityBudget(48, rivalPlan.id);
  for (let index = 0; index < 48; index += 1) budget.reserve({ role: 'fixture', index });
  assert.throws(() => budget.reserve({ role: 'blocked' }), /budget/u);
});

test('invested rival generation recovery reuses only the preserved first reply', () => {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-rival-generation-recovery-test-'));
  fs.mkdirSync(path.join(sourceDir, 'A'));
  fs.writeFileSync(
    path.join(sourceDir, 'plan.json'),
    JSON.stringify({ id: rivalPlan.id, provenance: { recovery: false } }),
  );
  fs.writeFileSync(
    path.join(sourceDir, 'stopped.json'),
    JSON.stringify({ error: 'unsupported open quotation', budget: { used: 1, limit: 48 }, armsCompleted: 0 }),
  );
  const request = buildContinuityRequest({
    plan: rivalPlan,
    speaker: 'learner',
    turn: 1,
    history: [{ role: 'assistant', content: rivalPlan.world.opening_frame.authored_text }],
  });
  fs.writeFileSync(path.join(sourceDir, 'A', '1-learner.request.json'), JSON.stringify(request));
  const speech = 'Pressure test? So the building admits a leak, yet you want to blame my shower?';
  fs.writeFileSync(
    path.join(sourceDir, 'A', '1-learner.response.json'),
    JSON.stringify(
      fake(
        reply(
          speech,
          false,
          [],
          [
            { point: 'Pressure test timing vs shower', quote: 'Sam showered just before it appeared' },
            { point: 'Blank repair notebook', quote: 'repair notebook is still blank' },
          ],
        ),
      ),
    ),
  );
  const recovery = readGenerationRecovery(rivalPlan, sourceDir);
  assert.deepEqual(generationRecoveryContract(rivalPlan, recovery), {
    studyId: 'qwen-invested-rival-theorist-v1-generation-recovery-v1',
    spendCap: 47,
    priorAttemptCount: 1,
  });
  assert.equal(recovery.firstLearnerReply.response.text.includes(speech), true);
  assert.equal(recovery.firstLearnerReply.parsedSpeech, speech);
  assert.deepEqual(recovery.failure.droppedPrivateLedgerRows, [
    {
      field: 'open',
      row: { point: 'Blank repair notebook', quote: 'repair notebook is still blank' },
    },
  ]);
  fs.writeFileSync(path.join(sourceDir, 'A', 'checkpoint-1.json'), '{}');
  assert.throws(() => readGenerationRecovery(rivalPlan, sourceDir), /accepted downstream output/u);
  assert.throws(
    () => generationRecoveryContract(rivalPlan, { stop: { budget: { used: 48 } } }),
    /below the study ceiling/u,
  );
});

test('invested rival validates the loaded checkpoint against the exact configured service target', () => {
  const service = {
    profiles: {
      regular: { model: { target: 'mlx-community/Qwen3.8-27B-4bit' } },
      uncensored: {
        model: { target: '/Users/example/models/Qwen3.8-27B-Uncensored-MLX/4-bit' },
      },
    },
  };
  assert.equal(configuredServiceModel(service, rivalPlan.arms[0]), 'mlx-community/Qwen3.8-27B-4bit');
  assert.equal(
    configuredServiceModel(service, rivalPlan.arms[1]),
    '/Users/example/models/Qwen3.8-27B-Uncensored-MLX/4-bit',
  );
  const runtimeArm = runtimeServiceArm(
    service,
    rivalPlan.arms[1],
    '/Users/example/models/Qwen3.8-27B-Uncensored-MLX/4-bit',
  );
  assert.equal(runtimeArm.model, '/Users/example/models/Qwen3.8-27B-Uncensored-MLX/4-bit');
  assert.equal(rivalPlan.arms[1].model, 'Qwen3.8-27B-Uncensored-MLX/4-bit');
  assert.throws(
    () => runtimeServiceArm(service, rivalPlan.arms[1], rivalPlan.arms[1].model),
    /configured service target/u,
  );
  assert.throws(() => configuredServiceModel({ profiles: {} }, rivalPlan.arms[1]), /service target required/u);
});

test('invested rival arm-boundary recovery preserves the completed normal arm and only the remaining 32 attempts', () => {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-rival-arm-boundary-recovery-test-'));
  const armDir = path.join(sourceDir, 'A');
  fs.mkdirSync(armDir);
  fs.writeFileSync(
    path.join(sourceDir, 'plan.json'),
    JSON.stringify({
      id: rivalPlan.id,
      provenance: {
        recovery: true,
        linkedRecoveryStudyId: `${rivalPlan.id}-generation-recovery-v1`,
        priorAttemptCount: 1,
      },
    }),
  );
  fs.writeFileSync(
    path.join(sourceDir, 'stopped.json'),
    JSON.stringify({
      error: 'loaded model does not exactly match the planned arm',
      budget: { used: 16, limit: 48 },
      armsCompleted: 1,
      recoveryPermitted: false,
    }),
  );
  fs.writeFileSync(
    path.join(sourceDir, 'run-ledger.jsonl'),
    `${Array.from({ length: 15 }, (_, index) =>
      JSON.stringify({ type: 'model_attempt_reserved', count: 1, reserved: index + 1 }),
    ).join('\n')}\n`,
  );
  const tracePath = path.join(armDir, 'trace.jsonl');
  fs.writeFileSync(
    tracePath,
    `${JSON.stringify({ at: '2026-09-01T00:00:00.000Z', type: 'tutor_opening', text: 'Opening' })}\n${JSON.stringify({ at: '2026-09-01T00:04:00.000Z', type: 'continuity_state' })}\n`,
  );
  fs.writeFileSync(
    path.join(armDir, 'dialogue.json'),
    JSON.stringify({
      turns: Array.from({ length: 8 }, (_, index) => ({
        turn: index + 1,
        learner: `Learner ${index + 1}`,
        tutor: `Tutor ${index + 1}`,
      })),
      trace: tracePath,
      disposition: 'learner_exit',
      proofControl: { releasedPremiseIds: [] },
    }),
  );
  const recovery = readArmBoundaryRecovery(rivalPlan, sourceDir);
  assert.equal(recovery.priorArms.length, 1);
  assert.equal(recovery.priorArms[0].id, 'A');
  assert.equal(recovery.priorArms[0].snapshot.turns.length, 8);
  assert.equal(recovery.priorArms[0].wallTimeMs, 240_000);
  assert.deepEqual(armBoundaryRecoveryContract(rivalPlan, recovery), {
    studyId: 'qwen-invested-rival-theorist-v1-generation-recovery-v2',
    spendCap: 32,
    priorAttemptCount: 16,
  });
  fs.mkdirSync(path.join(sourceDir, 'B'));
  assert.throws(() => readArmBoundaryRecovery(rivalPlan, sourceDir), /downstream output/u);
});

test('invested rival local-route recovery charges the failed lookup and starts arm B with 31 attempts remaining', () => {
  const firstSource = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-rival-route-first-source-test-'));
  const firstArm = path.join(firstSource, 'A');
  fs.mkdirSync(firstArm);
  fs.writeFileSync(
    path.join(firstSource, 'plan.json'),
    JSON.stringify({
      id: rivalPlan.id,
      provenance: {
        recovery: true,
        linkedRecoveryStudyId: `${rivalPlan.id}-generation-recovery-v1`,
        priorAttemptCount: 1,
      },
    }),
  );
  fs.writeFileSync(
    path.join(firstSource, 'stopped.json'),
    JSON.stringify({
      error: 'loaded model does not exactly match the planned arm',
      budget: { used: 16, limit: 48 },
      armsCompleted: 1,
    }),
  );
  fs.writeFileSync(
    path.join(firstSource, 'run-ledger.jsonl'),
    `${Array.from({ length: 15 }, () => JSON.stringify({ type: 'model_attempt_reserved', count: 1 })).join('\n')}\n`,
  );
  const firstTrace = path.join(firstArm, 'trace.jsonl');
  fs.writeFileSync(
    firstTrace,
    `${JSON.stringify({ at: '2026-09-01T00:00:00.000Z', type: 'tutor_opening', text: 'Opening' })}\n${JSON.stringify({ at: '2026-09-01T00:04:00.000Z', type: 'continuity_state' })}\n`,
  );
  fs.writeFileSync(
    path.join(firstArm, 'dialogue.json'),
    JSON.stringify({
      turns: Array.from({ length: 8 }, (_, index) => ({
        turn: index + 1,
        learner: `Learner ${index + 1}`,
        tutor: `Tutor ${index + 1}`,
      })),
      trace: firstTrace,
      disposition: 'learner_exit',
      proofControl: { releasedPremiseIds: [] },
    }),
  );

  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-rival-route-recovery-test-'));
  const armDir = path.join(sourceDir, 'B');
  fs.mkdirSync(armDir);
  fs.writeFileSync(
    path.join(sourceDir, 'plan.json'),
    JSON.stringify({
      id: rivalPlan.id,
      provenance: {
        recovery: true,
        linkedRecoveryStudyId: `${rivalPlan.id}-generation-recovery-v2`,
        priorAttemptCount: 16,
        reusedCompletedArms: ['A'],
        recoverySource: firstSource,
      },
    }),
  );
  fs.writeFileSync(
    path.join(sourceDir, 'stopped.json'),
    JSON.stringify({ error: 'Qwen HTTP 400', budget: { used: 17, limit: 48 }, armsCompleted: 1 }),
  );
  fs.writeFileSync(
    path.join(sourceDir, 'run-ledger.jsonl'),
    `${JSON.stringify({ type: 'model_attempt_reserved', count: 1 })}\n`,
  );
  fs.writeFileSync(
    path.join(armDir, 'stopped.json'),
    JSON.stringify({ error: 'Qwen HTTP 400', turns: [], partialTurn: { turn: 1 } }),
  );
  fs.writeFileSync(
    path.join(armDir, '1-learner.request.json'),
    JSON.stringify(
      buildContinuityRequest({
        plan: rivalPlan,
        speaker: 'learner',
        turn: 1,
        history: [{ role: 'assistant', content: rivalPlan.world.opening_frame.authored_text }],
      }),
    ),
  );
  fs.writeFileSync(
    path.join(armDir, 'trace.jsonl'),
    `${JSON.stringify({
      type: 'provider_event',
      event: {
        type: 'local_transport',
        status: 400,
        body: 'Repository Not Found for Qwen3.8-27B-Uncensored-MLX/4-bit',
      },
    })}\n${JSON.stringify({ type: 'model_call_failed', turn: 1 })}\n`,
  );
  const recovery = readLocalModelRouteRecovery(rivalPlan, sourceDir);
  assert.equal(recovery.priorArms[0].id, 'A');
  assert.equal(recovery.priorArms[0].snapshot.turns.length, 8);
  assert.deepEqual(localModelRouteRecoveryContract(rivalPlan, recovery), {
    studyId: 'qwen-invested-rival-theorist-v1-generation-recovery-v3',
    spendCap: 31,
    priorAttemptCount: 17,
  });
  fs.writeFileSync(path.join(armDir, '1-learner.response.json'), '{}');
  assert.throws(() => readLocalModelRouteRecovery(rivalPlan, sourceDir), /downstream output/u);
});

test('invested rival linked assessment recovery preserves 37 attempts and retries only unresolved judge packets', () => {
  const { sourceDir } = createLinkedAssessmentRecoveryFixture();
  const recovery = readLinkedAssessmentRecovery(rivalPlan, sourceDir);
  assert.deepEqual(
    recovery.priorScores.map((score) => `${score.arm}/${score.kind}`),
    ['A/tutor', 'A/learner', 'A/dialogue'],
  );
  assert.deepEqual(linkedAssessmentRecoveryContract(rivalPlan, recovery), {
    studyId: 'qwen-invested-rival-theorist-v1-generation-recovery-v4',
    spendCap: 11,
    priorAttemptCount: 37,
  });
  fs.writeFileSync(path.join(sourceDir, 'completed.json'), '{}');
  assert.throws(() => readLinkedAssessmentRecovery(rivalPlan, sourceDir), /completed output/u);
});

test('invested rival quality transport recovery preserves 38 attempts and bypasses only the quality schema tool', () => {
  const { sourceDir } = createQualityTransportRecoveryFixture();
  const recovery = readQualityJsonTransportRecovery(rivalPlan, sourceDir);
  assert.equal(recovery.plainJsonQuality, true);
  assert.equal(recovery.eligibility.priorAttempts, 5);
  assert.deepEqual(
    recovery.priorScores.map((score) => `${score.arm}/${score.kind}`),
    ['A/tutor', 'A/learner', 'A/dialogue'],
  );
  assert.deepEqual(qualityJsonTransportRecoveryContract(rivalPlan, recovery), {
    studyId: 'qwen-invested-rival-theorist-v1-generation-recovery-v5',
    spendCap: 10,
    priorAttemptCount: 38,
  });
  assert.equal(
    investedRivalJudgeCallOptions('local-qwen-benchmark-quality', { singleAttempt: true }, true).singleAttemptJsonText,
    true,
  );
  assert.equal(
    investedRivalJudgeCallOptions('local-qwen-benchmark-tutor', { singleAttempt: true }, true).singleAttemptJsonText,
    false,
  );
  fs.writeFileSync(path.join(sourceDir, 'completed.json'), '{}');
  assert.throws(() => readQualityJsonTransportRecovery(rivalPlan, sourceDir), /completed output/u);
});

test('invested rival quality split recovery preserves 39 attempts and plans seven calls under the remaining nine', () => {
  const { sourceDir } = createQualitySplitRecoveryFixture();
  const recovery = readQualitySplitRecovery(rivalPlan, sourceDir);
  assert.equal(recovery.plainJsonQuality, true);
  assert.equal(recovery.splitQuality, true);
  assert.equal(recovery.eligibility.priorAttempts, 6);
  assert.equal(recovery.failedTransport.parseable, false);
  assert.deepEqual(
    recovery.priorScores.map((score) => `${score.arm}/${score.kind}`),
    ['A/tutor', 'A/learner', 'A/dialogue'],
  );
  assert.deepEqual(qualitySplitRecoveryContract(rivalPlan, recovery), {
    studyId: 'qwen-invested-rival-theorist-v1-generation-recovery-v6',
    spendCap: 9,
    priorAttemptCount: 39,
  });
  assert.equal(
    investedRivalJudgeCallOptions('local-qwen-benchmark-quality-summary', { singleAttempt: true }, true)
      .singleAttemptJsonText,
    true,
  );
  fs.writeFileSync(path.join(sourceDir, 'completed.json'), '{}');
  assert.throws(() => readQualitySplitRecovery(rivalPlan, sourceDir), /completed output/u);
});

test('invested rival structured split-quality recovery preserves 40 attempts and restores schema tools for seven calls', () => {
  const { sourceDir } = createQualitySplitStructuredRecoveryFixture();
  const recovery = readQualitySplitStructuredRecovery(rivalPlan, sourceDir);
  assert.equal(recovery.plainJsonQuality, false);
  assert.equal(recovery.splitQuality, true);
  assert.equal(recovery.structuredSplitQuality, true);
  assert.equal(recovery.eligibility.priorAttempts, 7);
  assert.equal(recovery.failedTransport.parseable, false);
  assert.deepEqual(
    recovery.priorScores.map((score) => `${score.arm}/${score.kind}`),
    ['A/tutor', 'A/learner', 'A/dialogue'],
  );
  assert.deepEqual(qualitySplitStructuredRecoveryContract(rivalPlan, recovery), {
    studyId: 'qwen-invested-rival-theorist-v1-generation-recovery-v7',
    spendCap: 8,
    priorAttemptCount: 40,
  });
  assert.equal(
    investedRivalJudgeCallOptions('local-qwen-benchmark-quality-summary', { singleAttempt: true }, false)
      .singleAttemptJsonText,
    false,
  );
  fs.writeFileSync(path.join(sourceDir, 'completed.json'), '{}');
  assert.throws(() => readQualitySplitStructuredRecovery(rivalPlan, sourceDir), /completed output/u);
});

test('invested rival final quality recovery preserves 46 attempts and exposes exactly two terminal calls', () => {
  const { sourceDir } = createFinalQualityRecoveryFixture();
  const recovery = readFinalQualityRecovery(rivalPlan, sourceDir);
  assert.equal(recovery.plainJsonQuality, false);
  assert.equal(recovery.splitQuality, true);
  assert.equal(recovery.finalQualityRecovery, true);
  assert.equal(recovery.eligibility.priorAttempts, 13);
  assert.deepEqual(recovery.failedTransport.unexpectedProperties, ['reasoning_effort']);
  assert.deepEqual(
    recovery.priorScores.map((score) => `${score.arm}/${score.kind}`),
    ['A/tutor', 'A/learner', 'A/dialogue', 'A/quality', 'B/tutor', 'B/learner', 'B/dialogue'],
  );
  assert.deepEqual(finalQualityRecoveryContract(rivalPlan, recovery), {
    studyId: 'qwen-invested-rival-theorist-v1-generation-recovery-v8',
    spendCap: 2,
    priorAttemptCount: 46,
  });
  fs.writeFileSync(path.join(sourceDir, 'completed.json'), '{}');
  assert.throws(() => readFinalQualityRecovery(rivalPlan, sourceDir), /completed output/u);
});

test('completion transport drops only surplus root fields and preserves every registered value', () => {
  const { turnsJob } = createFinalCompletionRecoveryFixture();
  const registered = schemaFixture(turnsJob.outputSchema);
  const relaxed = allowUnknownRootOutputFields(turnsJob.outputSchema);
  assert.equal(relaxed.additionalProperties, true);
  assert.equal(relaxed.properties.learner_turns.items.additionalProperties, false);
  const projected = projectRegisteredRootOutput(
    JSON.stringify({ turns: '[]', diagnostic: 'ignored', ...registered }),
    turnsJob.outputSchema,
  );
  assert.deepEqual(projected.discardedRootKeys, ['diagnostic', 'turns']);
  assert.deepEqual(JSON.parse(projected.text), registered);
});

test('final completion recovery preserves 48 attempts and exposes only the missing B turns packet', async () => {
  const { sourceDir } = createFinalCompletionRecoveryFixture();
  const recovery = readFinalCompletionRecovery(rivalPlan, sourceDir);
  assert.equal(recovery.finalCompletionRecovery, true);
  assert.equal(recovery.effectiveAttemptCeiling, 50);
  assert.equal(recovery.completionTechnicalAttemptLimit, 2);
  assert.equal(recovery.eligibility.priorAttempts, 15);
  assert.deepEqual(recovery.eligibility.failure.arm, 'B');
  assert.deepEqual(recovery.eligibility.failure.kind, 'quality-turns');
  assert.deepEqual(recovery.failedTransport.unexpectedProperties, ['turns']);
  assert.deepEqual(
    recovery.priorScores.map((score) => `${score.arm}/${score.kind}`),
    ['A/tutor', 'A/learner', 'A/dialogue', 'A/quality', 'B/tutor', 'B/learner', 'B/dialogue'],
  );
  assert.deepEqual(
    recovery.priorSplitQualityParts.map((packet) => `${packet.arm}/quality-${packet.part}`),
    ['B/quality-summary'],
  );
  assert.deepEqual(finalCompletionRecoveryContract(rivalPlan, recovery), {
    studyId: 'qwen-invested-rival-theorist-v1-generation-recovery-v9',
    spendCap: 2,
    priorAttemptCount: 48,
  });

  const outDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-final-completion-score-test-')), 'evaluation');
  const called = [];
  const evaluation = await scoreBenchmarkArms(recovery.arms, outDir, {
    ceiling: 18,
    extendedQuality: true,
    allowOneBasedIndices: true,
    assessmentContext: rivalPlan.assessmentContext,
    publicSourceContextByArm: Object.fromEntries(
      recovery.arms.map((arm) => [arm.id, investedRivalDeliveredSourceContext(rivalPlan, arm)]),
    ),
    priorScores: recovery.priorScores,
    priorSplitQualityParts: recovery.priorSplitQualityParts,
    priorAttempts: recovery.eligibility.priorAttempts,
    splitQuality: true,
    callJudge: async (_agent, _systemPrompt, _userPrompt, role, options) => {
      called.push(role);
      options.onRawOutput({ mock: true });
      return { text: JSON.stringify(schemaFixture(options.outputSchema)), mock: true };
    },
  });
  assert.deepEqual(called, ['local-qwen-benchmark-quality-turns']);
  assert.equal(evaluation.scores.length, 8);
  assert.equal(evaluation.newAttempts, 1);
  assert.ok(fs.existsSync(path.join(outDir, 'B-quality.json')));

  fs.writeFileSync(path.join(sourceDir, 'completed.json'), '{}');
  assert.throws(() => readFinalCompletionRecovery(rivalPlan, sourceDir), /completed output/u);
});

test('bilateral plan inherits the unchanged actor and proof controller with an explicit 100-attempt ceiling', () => {
  assert.deepEqual(bilateralPlan.character, proofPlan.character);
  assert.deepEqual(bilateralPlan.world, proofPlan.world);
  assert.equal(bilateralPlan.tutor, proofPlan.tutor);
  assert.equal(bilateralPlan.generationCap, 80);
  assert.equal(bilateralPlan.total_attempt_ceiling, 100);
  assert.deepEqual(
    bilateralPlan.arms.map((a) => [a.id, a.variant, a.mode, a.tutorMode]),
    [
      ['C', 'abliterated', 'ego_superego', 'direct'],
      ['D', 'abliterated', 'ego_superego', 'ego_superego'],
    ],
  );
});

test('advisers see native public history and their speaker draft, not private notes or future clues', () => {
  const history = [
    ...opening,
    ...Array.from({ length: 4 }, () => ({
      role: 'user',
      content: 'I need the same repair appointment, not another repeated explanation of this ceiling.',
    })),
  ];
  for (const speaker of ['learner', 'tutor']) {
    const request = buildContinuityRequest({
      plan: bilateralPlan,
      speaker,
      turn: 2,
      history,
      ledger: { settled: [{ point: 'PRIVATE_LEDGER_SENTINEL', quote: 'repair appointment' }], open: [] },
    });
    const reviewed = buildContinuityReviewRequest({
      plan: bilateralPlan,
      speaker,
      turn: 2,
      history,
      request,
      draft: { speech: 'Who owns the follow-up?', settled: [{ point: 'DRAFT_LEDGER_SENTINEL' }] },
    });
    assert.ok(reviewed.audit.ok && reviewed.privilege.ok);
    assert.equal(reviewed.messageHistory.length, history.length);
    const text = reviewed.systemPrompt + reviewed.prompt;
    assert.doesNotMatch(
      text,
      /PRIVATE_LEDGER_SENTINEL|DRAFT_LEDGER_SENTINEL|p_shower|Blue tracing dye|hairline split/u,
    );
    if (speaker === 'tutor') assert.match(text, /08:05/u);
    else assert.doesNotMatch(text, /08:05/u);
    const revision = buildContinuityRevisionRequest({
      plan: bilateralPlan,
      speaker,
      turn: 2,
      request,
      draft: { speech: 'Who owns the follow-up?' },
      review: reviewFixture,
    });
    assert.ok(revision.audit.ok && revision.privilege.ok);
    assert.match(revision.prompt, /PRIVATE_LEDGER_SENTINEL/u);
    assert.match(revision.prompt, /not the discarded draft or adviser text/u);
  }
});

test('single review loops have exact symmetric counts and only final replies advance notes, history and proof', async () => {
  for (const arm of bilateralPlan.arms) {
    const outDir = destination();
    const budget = continuityBudget(100, bilateralPlan.id);
    const snapshot = await runContinuityArm({
      plan: bilateralPlan,
      arm,
      outDir,
      budget,
      callModel: async ({ speaker, role, request }) => {
        const draft = !role.endsWith('_revision') && (speaker === 'learner' || arm.tutorMode === 'ego_superego');
        return fake(
          reply(
            draft
              ? 'PRIVATE_DRAFT_SPEECH'
              : speaker === 'learner'
                ? 'A concrete handoff, please.'
                : ['I can own this.', ...(request.proofPlan?.sources.map((s) => s.text) || [])].join(' '),
            false,
            draft ? [{ point: 'DRAFT_NOTE_SENTINEL', quote: 'PRIVATE_DRAFT_SPEECH' }] : [],
          ),
        );
      },
      callReview: async ({ request }) => {
        assert.doesNotMatch(request.prompt, /DRAFT_NOTE_SENTINEL/u);
        return fake(JSON.stringify(reviewFixture));
      },
    });
    assert.equal(budget.snapshot().used, arm.id === 'C' ? 32 : 48);
    assert.doesNotMatch(JSON.stringify(snapshot.history), /PRIVATE_DRAFT_SPEECH/u);
    assert.deepEqual(snapshot.ledgers, { learner: { settled: [], open: [] }, tutor: { settled: [], open: [] } });
    assert.equal(snapshot.proofControl.publicProofEntailed, true);
    assert.equal(snapshot.deliberations.length, arm.id === 'C' ? 8 : 16);
    const scoredArm = readBenchmarkArm({ ...arm, path: path.join(outDir, 'dialogue.json') });
    assert.equal(scoredArm.technical.learnerMechanism.calls, 24);
    assert.equal(scoredArm.technical.tutorMechanism.calls, arm.id === 'C' ? 8 : 24);
    assert.equal(scoredArm.technical.learnerFinal.calls, 8);
    assert.equal(scoredArm.technical.tutorFinal.calls, 8);
    const sources = deliveredSourceContext(bilateralPlan, scoredArm);
    assert.match(sources, /Delivered in housemate turn 7: Blue tracing dye/u);
    assert.doesNotMatch(sources, /p_dye|causedWaterMark|PRIVATE_DRAFT/u);
  }
});

test('an exit in the final learner revision is respected through a bilateral closing loop', async () => {
  const budget = continuityBudget(100, bilateralPlan.id);
  const snapshot = await runContinuityArm({
    plan: bilateralPlan,
    arm: bilateralPlan.arms[1],
    outDir: destination(),
    budget,
    callModel: async ({ speaker, role, request }) => {
      if (speaker === 'tutor') assert.equal(request.proofPlan.action, 'acknowledge_exit');
      return fake(
        reply(
          speaker === 'learner' ? 'I am leaving.' : 'Understood.',
          speaker === 'learner' && role.endsWith('_revision'),
        ),
      );
    },
    callReview: async ({ speaker, request }) => {
      if (speaker === 'tutor') assert.match(request.prompt, /Alex has ended participation/u);
      return fake(JSON.stringify(reviewFixture));
    },
  });
  assert.equal(budget.snapshot().used, 6);
  assert.equal(snapshot.turns.length, 1);
  assert.equal(snapshot.disposition, 'learner_exit');
  assert.equal(snapshot.proofControl.publicProofEntailed, false);
});

test('an invalid adviser response is preserved and stops before the revision call', async () => {
  const outDir = destination();
  const budget = continuityBudget(100, bilateralPlan.id);
  await assert.rejects(
    runContinuityArm({
      plan: bilateralPlan,
      arm: bilateralPlan.arms[0],
      outDir,
      budget,
      callModel: async () => fake(reply('Who will call?')),
      callReview: async () => fake('{}'),
    }),
    /invalid continuity superego/u,
  );
  assert.equal(budget.snapshot().used, 2);
  assert.ok(fs.existsSync(path.join(outDir, '1-learner-superego.response.json')));
  assert.ok(!fs.existsSync(path.join(outDir, '1-learner.response.json')));
  assert.throws(() => parseContinuityReview('{"role_fidelity":"nice"}'), /invalid/u);
});

test('judge source context includes delivered sources only, and applies to every instrument', () => {
  const arm = {
    id: 'C',
    opening: plan.world.opening_frame.authored_text,
    transcript: 'Fixture transcript.',
    snapshot: {
      turns: [{ turn: 1, learner: 'Who calls?', tutor: 'I will.' }],
      proofControl: { releasedPremiseIds: [] },
    },
  };
  const source = deliveredSourceContext(bilateralPlan, arm);
  assert.match(source, /morning pressure test/u);
  assert.doesNotMatch(source, /Blue tracing dye|hairline split|08:05/u);
  const jobs = buildBenchmarkJobs([arm], {
    extendedQuality: true,
    assessmentContext: { characterBrief: plan.characterBrief },
    publicSourceContextByArm: { C: source },
  });
  assert.equal(jobs.length, 4);
  for (const job of jobs) {
    assert.match(job.prompt, /PUBLIC SOURCE PROVENANCE/u);
    assert.doesNotMatch(job.prompt, /Luna|ego_superego|PRIVATE_DRAFT/u);
  }
});

test('proof rerun preserves the learner and replaces only the optional tutor control', () => {
  assert.deepEqual(proofPlan.character, plan.character);
  for (const key of ['seed', 'temperature', 'max_tokens', 'max_exchanges', 'judge_calls', 'total_attempt_ceiling']) {
    assert.equal(proofPlan[key], plan[key]);
  }
  assert.equal(proofPlan.tutor_control, 'public_proof_dag');
  const request = buildContinuityRequest({
    plan: proofPlan,
    speaker: 'tutor',
    turn: 3,
    history: opening,
    releasedPremiseIds: ['p_shower'],
  });
  assert.equal(request.proofPlan.owner, 'deterministic_harness');
  assert.equal(request.proofPlan.modelCall, false);
  assert.match(request.prompt, /required inquiry|Required inquiry/u);
  assert.match(request.prompt, /due NOW/u);
  assert.match(request.prompt, /hairline split/u);
  assert.doesNotMatch(request.prompt, /if relevant|Blue tracing dye|p_split|basinFeedHose/u);
  assert.doesNotMatch(request.systemPrompt, /need not.*give a lesson|UPTAKE > PART/u);
  assert.ok(request.audit.ok && request.privilege.ok);
});

test('proof sufficiency depends on delivered sources, not the clock or private continuity claims', () => {
  const overdue = buildContinuityProofPlan({ plan: proofPlan, turn: 7 });
  assert.deepEqual(
    overdue.requiredReleases.map((row) => row.premise),
    ['p_shower'],
  );
  assert.equal(overdue.candidatePublicProofEntailed, false);
  let releasedPremiseIds = [];
  for (let turn = 1; turn <= 8; turn++) {
    const next = buildContinuityProofPlan({ plan: proofPlan, turn, releasedPremiseIds });
    assert.equal(next.candidatePublicProofEntailed, turn >= 7);
    const speech = next.requiredReleases.map((row) => row.surface).join(' ') || 'I will distinguish timing from cause.';
    releasedPremiseIds = verifyContinuityProofRelease(next, speech);
  }
  const final = buildContinuityProofPlan({ plan: proofPlan, turn: 8, releasedPremiseIds, closing: true });
  assert.equal(final.publicProofEntailedBefore, true);
  assert.ok(final.proofBefore);
  assert.match(final.learnerUnderstanding, /not_inferred/u);
});

test('missing or duplicated due evidence cannot advance the proof ledger', () => {
  const next = buildContinuityProofPlan({ plan: proofPlan, turn: 2 });
  const source = next.requiredReleases[0].surface;
  assert.throws(() => verifyContinuityProofRelease(next, 'I will call repairs.'), /exactly once/u);
  assert.throws(() => verifyContinuityProofRelease(next, `${source} ${source}`), /exactly once/u);
  assert.deepEqual(verifyContinuityProofRelease(next, `I will handle this. ${source}`), ['p_shower']);
});

test('proof control adds no model roles and records public sufficiency without invented learning', async () => {
  const budget = continuityBudget(40, proofPlan.id);
  let calls = 0;
  const snapshot = await runContinuityArm({
    plan: proofPlan,
    arm: proofPlan.arms[0],
    outDir: destination(),
    budget,
    callModel: async ({ speaker, request }) => {
      calls++;
      return fake(
        reply(
          speaker === 'learner'
            ? 'I am still deciding whether to engage.'
            : [
                'I can handle the report while separating timing from cause.',
                ...request.proofPlan.sources.map((source) => source.text),
              ].join(' '),
        ),
      );
    },
  });
  assert.equal(calls, 16);
  assert.equal(snapshot.proofControl.publicProofEntailed, true);
  assert.equal(snapshot.proofControl.releasedPremiseIds.length, 4);
  assert.equal(snapshot.proofControl.learnerUnderstanding, 'unassessed');
  assert.notEqual(snapshot.proofControl.inquiryDisposition, 'grounded');
});

test('proof-driven tutor honors an early learner exit and records the unresolved inquiry', async () => {
  const snapshot = await runContinuityArm({
    plan: proofPlan,
    arm: proofPlan.arms[0],
    outDir: destination(),
    budget: continuityBudget(),
    callModel: async ({ speaker, request }) => {
      if (speaker === 'tutor') {
        assert.equal(request.proofPlan.action, 'acknowledge_exit');
        assert.equal(request.proofPlan.requiredReleases.length, 0);
        assert.match(request.prompt, /without new evidence/u);
      }
      return fake(reply(speaker === 'learner' ? 'I am leaving.' : 'Understood.', speaker === 'learner'));
    },
  });
  assert.equal(snapshot.turns.length, 1);
  assert.equal(snapshot.proofControl.inquiryDisposition, 'inquiry_unresolved');
  assert.equal(snapshot.proofControl.publicProofEntailed, false);
});

test('proof-directed source failure is saved and stops without resampling', async () => {
  const outDir = destination();
  const budget = continuityBudget();
  await assert.rejects(
    runContinuityArm({
      plan: proofPlan,
      arm: proofPlan.arms[0],
      outDir,
      budget,
      callModel: async () => fake(reply('I will only discuss logistics.')),
    }),
    /required public clue/u,
  );
  assert.equal(budget.snapshot().used, 4);
  assert.ok(fs.existsSync(path.join(outDir, '2-tutor.response.json')));
  const stopped = JSON.parse(fs.readFileSync(path.join(outDir, 'stopped.json'), 'utf8'));
  assert.equal(stopped.turns.length, 1);
});

test('four-change prompts remove both inherited compulsory templates without changing canonical contract', () => {
  assert.equal(plan.total_attempt_ceiling, 40);
  const contract = learnerProfileContract('frame_refuser');
  assert.ok(contract.observabilityContract.minEligibleRate > 0);
  for (const speaker of ['learner', 'tutor']) {
    const request = buildContinuityRequest({ plan, speaker, turn: 1, history: opening });
    const text = request.systemPrompt + request.prompt;
    assert.doesNotMatch(text, /This turn MUST|UPTAKE > PART|X, not Y|inclined to treat bad habits|mustRecurMinRate/u);
    assert.match(text, /speech, end_dialogue, settled, open/u);
    assert.ok(request.audit.ok && request.privilege.ok);
  }
  assert.match(
    buildContinuityRequest({ plan, speaker: 'learner', turn: 1, history: opening }).systemPrompt,
    /Get the ceiling leak handled/u,
  );
});

test('corrected role instructions preserve handoff stakes without forcing continued refusal', () => {
  const learner = buildContinuityRequest({ plan, speaker: 'learner', turn: 1, history: opening });
  const tutor = buildContinuityRequest({ plan, speaker: 'tutor', turn: 1, history: opening });
  assert.match(learner.systemPrompt, /priority over generic assistant helpfulness/u);
  assert.match(learner.systemPrompt, /owns chasing a response/u);
  assert.match(learner.systemPrompt, /do not reopen it or invent another hurdle/u);
  assert.match(learner.prompt, /Write only Alex’s next spoken reply/u);
  assert.match(tutor.prompt, /Write only the housemate’s next spoken reply/u);
  assert.match(tutor.systemPrompt, /Do not declare the conversation over merely/u);
  assert.deepEqual(Object.keys(CONTINUITY_OUTPUT_SCHEMA.properties), ['speech', 'end_dialogue', 'settled', 'open']);
});

test('speaker perspectives and separate notes remain symmetric; future clues are withheld', () => {
  const history = [
    ...opening,
    { role: 'user', content: 'No unpaid homework.' },
    { role: 'assistant', content: 'I will handle the report.' },
  ];
  const ledger = { settled: [{ point: 'Notebook withdrawn', quote: 'I will handle the report.' }], open: [] };
  const learner = buildContinuityRequest({ plan, speaker: 'learner', turn: 3, history, ledger });
  assert.equal(learner.messageHistory.at(-1).role, 'user');
  assert.equal(learner.messageHistory.at(-2).role, 'assistant');
  assert.match(learner.prompt, /Notebook withdrawn/u);
  const tutor = buildContinuityRequest({ plan, speaker: 'tutor', turn: 3, history });
  assert.doesNotMatch(tutor.prompt, /Notebook withdrawn/u);
  assert.match(tutor.prompt, /hairline split/u);
  assert.doesNotMatch(learner.prompt, /hairline split/u);
  assert.doesNotMatch(tutor.prompt, /Blue tracing dye|p_dye|basinFeedHose/u);
  const contaminated = structuredClone(plan);
  contaminated.tutor += '\n' + plan.world.secret.surface;
  assert.throws(
    () => buildContinuityRequest({ plan: contaminated, speaker: 'tutor', turn: 1, history: opening }),
    /audit failed/u,
  );
});

test('continuity parsing validates evidence quotes and never fabricates repairs', () => {
  const history = [{ role: 'assistant', content: 'I will handle the report.' }];
  const text = reply('Fine. Do that.', true, [{ point: 'Report offered', quote: 'I will handle the report.' }]);
  assert.equal(parseContinuityReply(text, history).end_dialogue, true);
  assert.throws(() => parseContinuityReply(text, opening), /unsupported settled quotation/u);
  assert.throws(() => parseContinuityReply(reply(''), history), /envelope/u);
  assert.throws(() => parseContinuityReply('{"speech":"Fine"}', history), /envelope/u);
});

test('learner exit receives one closing reply and no additional exchange or model', async () => {
  const outDir = destination();
  const budget = continuityBudget();
  let calls = 0;
  const snapshot = await runContinuityArm({
    plan,
    arm: plan.arms[0],
    outDir,
    budget,
    callModel: async ({ speaker, request }) => {
      calls++;
      if (speaker === 'tutor') assert.match(request.prompt, /brief closing acknowledgement/u);
      return fake(
        reply(speaker === 'learner' ? 'I am leaving this conversation.' : 'Understood.', speaker === 'learner'),
      );
    },
  });
  assert.equal(calls, 2);
  assert.equal(snapshot.turns.length, 1);
  assert.equal(snapshot.disposition, 'learner_exit');
  assert.equal(budget.snapshot().used, 2);
  const arm = readBenchmarkArm({ ...plan.arms[0], path: path.join(outDir, 'dialogue.json') });
  assert.equal(arm.technical.learnerFinal.calls, 1);
  assert.equal(arm.technical.tutor.calls, 1);
  assert.throws(() => fs.mkdirSync(outDir), /EEXIST/u);
});

test('current-speech quotes are accepted symmetrically without accepting invented quotations', () => {
  for (const speech of ['Who will contact repairs?', 'I will contact repairs.']) {
    const text = reply(speech, false, [], [{ point: 'Repair contact', quote: speech }]);
    assert.equal(parseContinuityReply(text, opening).speech, speech);
    assert.throws(
      () =>
        parseContinuityReply(
          reply(speech, false, [], [{ point: 'False claim', quote: 'The repair has been completed.' }]),
          opening,
        ),
      /unsupported open quotation/u,
    );
  }
});

test('quotation matching tolerates apostrophe typography but not changed words or negation', () => {
  const history = [{ role: 'assistant', content: 'I’ll make the call by 10:00.' }];
  const text = reply('Ten is fine.', true, [{ point: 'Call deadline', quote: "I'll make the call by 10:00" }]);
  const parsed = parseContinuityReply(text, history);
  assert.equal(parsed.settled[0].quote, "I'll make the call by 10:00");
  for (const quote of ["I'll make the call by 11:00", "I won't make the call by 10:00"]) {
    assert.throws(
      () => parseContinuityReply(reply('Ten is fine.', true, [{ point: 'Call deadline', quote }]), history),
      /unsupported settled quotation/u,
    );
  }
});

test('unsupported private ledger quotations can be dropped without changing public speech', () => {
  const history = [
    {
      role: 'assistant',
      content:
        'There is a new water mark above the kitchen table, Sam showered just before it appeared, and the repair notebook has no finding yet.',
    },
  ];
  const speech =
    'Pressure test? So the building admits a leak, yet you want to blame my shower? The notebook is blank.';
  const dropped = [];
  const parsed = parseContinuityReply(
    reply(
      speech,
      false,
      [],
      [
        { point: 'Pressure test timing vs shower', quote: 'Sam showered just before it appeared' },
        { point: 'Blank repair notebook', quote: 'repair notebook is still blank' },
      ],
    ),
    history,
    {
      unsupportedQuotationPolicy: 'drop',
      onUnsupportedQuotation: (row) => dropped.push(row),
    },
  );
  assert.equal(parsed.speech, speech);
  assert.deepEqual(parsed.open, [
    { point: 'Pressure test timing vs shower', quote: 'Sam showered just before it appeared' },
  ]);
  assert.deepEqual(dropped, [
    {
      field: 'open',
      row: { point: 'Blank repair notebook', quote: 'repair notebook is still blank' },
    },
  ]);
  assert.throws(
    () =>
      parseContinuityReply(reply(speech, false, [], [{ point: '', quote: 'The notebook is blank.' }]), history, {
        unsupportedQuotationPolicy: 'drop',
      }),
    /invalid open ledger row/u,
  );
});

test('a saved mixed-speaker prefix is replayed without regenerating completed replies', async () => {
  const budget = continuityBudget();
  const savedReplies = {};
  for (const [turn, speaker, text, end] of [
    [1, 'learner', 'Who calls?', false],
    [1, 'tutor', 'I will.', false],
    [2, 'learner', 'When?', false],
    [2, 'tutor', 'By ten.', false],
    [3, 'learner', 'Ten is fine. I am leaving.', true],
  ]) {
    budget.reserve({ role: speaker, turn });
    savedReplies[`${turn}-${speaker}`] = { source: 'fixture', request: {}, response: fake(reply(text, end)) };
  }
  let calls = 0;
  const result = await runContinuityArm({
    plan,
    arm: plan.arms[0],
    outDir: destination(),
    budget,
    savedReplies,
    callModel: async ({ speaker, request }) => {
      calls++;
      assert.equal(speaker, 'tutor');
      assert.match(request.prompt, /brief closing acknowledgement/u);
      return fake(reply('Understood.', true));
    },
  });
  assert.equal(calls, 1);
  assert.equal(budget.snapshot().used, 6);
  assert.equal(result.turns.length, 3);
});

test('continuation reuses the exact first reply and request, and counts it only once', async () => {
  const outDir = destination();
  const budget = continuityBudget();
  budget.reserve({ role: 'tutor_stub_auto_learner', turn: 1 });
  const request = buildContinuityRequest({ plan, speaker: 'learner', turn: 1, history: opening });
  const response = fake(
    reply('Who will contact repairs?', false, [], [{ point: 'Repair contact', quote: 'Who will contact repairs?' }]),
  );
  let newCalls = 0;
  const snapshot = await runContinuityArm({
    plan,
    arm: plan.arms[0],
    outDir,
    budget,
    firstLearnerReply: { source: 'fixture-saved-reply', request, response },
    callModel: async ({ speaker, request: next }) => {
      newCalls++;
      if (newCalls === 1) {
        assert.equal(speaker, 'tutor');
        assert.equal(next.messageHistory.at(-1).content, 'Who will contact repairs?');
      }
      return fake(reply('Fixture speech.'));
    },
  });
  assert.equal(snapshot.turns.length, 8);
  assert.equal(newCalls, 15);
  assert.equal(budget.snapshot().used, 16);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outDir, '1-learner.request.json'))), request);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outDir, '1-learner.response.json'))), response);
  await assert.rejects(
    runContinuityArm({
      plan,
      arm: plan.arms[0],
      outDir: destination(),
      budget: continuityBudget(),
      firstLearnerReply: { request, response },
      callModel: () => {
        throw new Error('must not call');
      },
    }),
    /already be included/u,
  );
});

test('generation recovery traces the dropped private row and preserves the saved public reply', async () => {
  const outDir = destination();
  const budget = continuityBudget(48, rivalPlan.id);
  budget.reserve({ role: 'tutor_stub_auto_learner', turn: 1 });
  const history = [{ role: 'assistant', content: rivalPlan.world.opening_frame.authored_text }];
  const request = buildContinuityRequest({ plan: rivalPlan, speaker: 'learner', turn: 1, history });
  const speech = 'Pressure test? So the building admits a leak, yet you want to blame my shower?';
  const response = fake(
    reply(
      speech,
      false,
      [],
      [
        { point: 'Pressure test timing vs shower', quote: 'Sam showered just before it appeared' },
        { point: 'Blank repair notebook', quote: 'repair notebook is still blank' },
      ],
    ),
  );
  const snapshot = await runContinuityArm({
    plan: rivalPlan,
    arm: rivalPlan.arms[0],
    outDir,
    budget,
    firstLearnerReply: { source: 'preserved-failed-attempt', request, response },
    unsupportedQuotationPolicy: 'drop',
    callModel: async ({ speaker }) => {
      assert.equal(speaker, 'tutor');
      return fake(reply('Understood; I will keep the live explanations separate.', true));
    },
  });
  assert.equal(snapshot.turns[0].learner, speech);
  assert.deepEqual(snapshot.ledgers.learner.open, [
    { point: 'Pressure test timing vs shower', quote: 'Sam showered just before it appeared' },
  ]);
  assert.equal(budget.snapshot().used, 2);
  const trace = fs.readFileSync(path.join(outDir, 'trace.jsonl'), 'utf8');
  assert.match(trace, /"type":"continuity_ledger_row_dropped"/u);
  assert.match(trace, /"publicSpeechPreserved":true/u);
});

test('tutor can close; otherwise eight exchanges means exactly sixteen calls', async () => {
  for (const close of [true, false]) {
    const budget = continuityBudget();
    const result = await runContinuityArm({
      plan,
      arm: plan.arms[1],
      outDir: destination(),
      budget,
      callModel: async ({ speaker }) => fake(reply('Fixture speech.', close && speaker === 'tutor')),
    });
    assert.equal(result.turns.length, close ? 1 : 8);
    assert.equal(budget.snapshot().used, close ? 2 : 16);
    assert.equal(result.disposition, close ? 'tutor_closure' : 'exchange_cap');
  }
});

test('failed reply is charged and preserved without retry; shared ceiling blocks dispatch', async () => {
  const outDir = destination();
  const budget = continuityBudget();
  let calls = 0;
  await assert.rejects(
    runContinuityArm({
      plan,
      arm: plan.arms[0],
      outDir,
      budget,
      callModel: async () => {
        calls++;
        return fake('malformed');
      },
    }),
  );
  assert.equal(calls, 1);
  assert.equal(budget.snapshot().used, 1);
  assert.ok(fs.existsSync(path.join(outDir, '1-learner.response.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'stopped.json')));
  const smallBudget = continuityBudget(1);
  calls = 0;
  await assert.rejects(
    runContinuityArm({
      plan,
      arm: plan.arms[0],
      outDir: destination(),
      budget: smallBudget,
      callModel: async () => {
        calls++;
        return fake(reply('Fixture speech.'));
      },
    }),
    /exhausted/u,
  );
  assert.equal(calls, 1);
});

test('local request carries matched sampling, native history, no retry and exact model check', async () => {
  const request = buildContinuityRequest({ plan, speaker: 'learner', turn: 1, history: opening });
  let calls = 0;
  await callContinuityModel({
    plan,
    arm: plan.arms[0],
    speaker: 'learner',
    request,
    fetchImpl: async (_url, options) => {
      calls++;
      const body = JSON.parse(options.body);
      assert.equal(body.seed, 17);
      assert.equal(body.temperature, 0.6);
      assert.equal(body.max_tokens, 900);
      assert.equal(body.enable_thinking, false);
      assert.equal(body.response_format.type, 'json_schema');
      assert.equal(body.response_format.json_schema.strict, true);
      assert.deepEqual(body.response_format.json_schema.schema, CONTINUITY_OUTPUT_SCHEMA);
      assert.equal(body.messages[1].content, opening[0].content);
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            model: plan.arms[0].model,
            choices: [{ finish_reason: 'stop', message: { content: reply('No.') } }],
            usage: { completion_tokens: 8 },
          }),
      };
    },
  });
  assert.equal(calls, 1);
});

test('Sol and Qwen request the same structured envelope', async () => {
  await callContinuityModel({
    plan,
    arm: plan.arms[0],
    speaker: 'tutor',
    request: buildContinuityRequest({ plan, speaker: 'tutor', turn: 1, history: opening }),
    callCli: async (_route, _system, _prompt, _role, options) => {
      assert.deepEqual(options.outputSchema, CONTINUITY_OUTPUT_SCHEMA);
      return fake(reply('I can contact the repair service.'));
    },
  });
});

test('scoring and swimlanes use actual unequal lengths without inventing extra turns', () => {
  const arms = plan.arms.map((arm, index) => ({
    ...arm,
    opening: 'Fixture opening.',
    transcript: 'Fixture transcript.',
    snapshot: {
      turns: Array.from({ length: index ? 3 : 1 }, (_, i) => ({
        turn: i + 1,
        learner: 'Fixture learner.',
        tutor: 'Fixture tutor.',
      })),
    },
  }));
  const jobs = buildBenchmarkJobs(arms, {
    extendedQuality: true,
    assessmentContext: { characterBrief: plan.characterBrief, qualityInstructions: 'Fixture instructions.' },
  });
  assert.match(jobs.find((j) => j.arm === 'B' && j.kind === 'quality').prompt, /1 through 3/u);
  assert.doesNotMatch(jobs.find((j) => j.arm === 'A' && j.kind === 'quality').prompt, /eight numbered/u);
  const inter = buildFactorialInterchange(arms, [], { groups: [{ id: 'test', label: 'Fixture', arms }] });
  assert.equal(inter[0].turns.length, 4);
  assert.equal(inter[0].turns[2].messages.length, 2);
  assert.equal(inter[0].turns.flatMap((t) => t.messages).length, 10);
  const reportArms = arms.map((arm) => ({
    ...arm,
    snapshot: { ...arm.snapshot, disposition: 'learner_exit', maxExchanges: 8, ledgers: null },
    technical: { learnerMechanism: { calls: 0 }, learnerFinal: {}, tutor: { calls: 0 } },
    repetition: {},
  }));
  const report = renderContinuityReport({
    arms: reportArms,
    evaluation: { scores: [] },
    provenance: { budget: { used: 3 } },
    characterBrief: 'Fixture only.',
    failures: [{ arm: 'B', text: '<script>fixture</script>', reason: 'Fixture invalid reply.', latencyMs: 10 }],
  });
  assert.match(report.html, /INCOMPLETE RE-TEST/u);
  assert.match(report.html, /Not measurable: fewer than two replies/u);
  assert.match(report.html, /&lt;script&gt;fixture/u);
  assert.match(report.html, /0\/8 assessments accepted/u);
  assert.match(report.html, /3 of 40 total attempts used/u);
  const partialAssessment = renderContinuityReport({
    arms: reportArms,
    evaluation: { scores: [], attemptsUsed: 8 },
    provenance: { budget: { used: 22 }, priorAttempts: 5 },
    characterBrief: 'Fixture only.',
    assessmentFailures: [{ arm: 'A', kind: 'quality', reason: 'Provider retained only part of the output.' }],
    baseline: { arms: reportArms, evaluation: { scores: [] } },
    proofControl: true,
    measurementCaveats: ['Fixture <source> provenance was absent from the judge packet.'],
  });
  assert.match(partialAssessment.html, /INCOMPLETE ASSESSMENT · both dialogues complete/u);
  assert.doesNotMatch(partialAssessment.html, /generation stopped/u);
  assert.match(partialAssessment.html, /quality assessment unavailable/u);
  assert.match(partialAssessment.html, /8 of 8 Opus attempts used/u);
  assert.match(partialAssessment.html, /continuation only/u);
  assert.match(partialAssessment.html, /Not assessed → Not assessed/u);
  assert.match(partialAssessment.html, /Public proof progress is not learner understanding/u);
  assert.match(partialAssessment.html, /Measurement caveats · scores preserved, not corrected/u);
  assert.match(partialAssessment.html, /Fixture &lt;source&gt; provenance/u);
  const retryAccounting = renderContinuityReport({
    arms: reportArms,
    evaluation: {
      scores: [],
      newPhysicalAttempts: 6,
      plannedNewAssessmentPackets: 5,
    },
    provenance: { budget: { used: 22, limit: 23 } },
    characterBrief: 'Fixture only.',
  });
  assert.match(retryAccounting.html, /6 physical Opus attempts for 5 planned packets/u);
  assert.doesNotMatch(retryAccounting.html, /6 of 5/u);
});
