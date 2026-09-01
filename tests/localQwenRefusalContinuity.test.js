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
import { buildBenchmarkJobs, readBenchmarkArm } from '../scripts/score-local-qwen-resistant-learner-benchmark.js';
import { deliveredSourceContext } from '../scripts/run-local-qwen-bilateral-superego.js';
import { buildFactorialInterchange } from '../services/localQwenFactorialReport.js';
import { learnerProfileContract } from '../scripts/tutor-stub-learner-profile-contracts.js';
import { renderContinuityReport } from '../services/localQwenRefusalContinuityReport.js';
import {
  armBoundaryRecoveryContract,
  buildInvestedRivalPlan,
  configuredServiceModel,
  generationRecoveryContract,
  localModelRouteRecoveryContract,
  main as runInvestedRival,
  readArmBoundaryRecovery,
  readGenerationRecovery,
  readLocalModelRouteRecovery,
  runtimeServiceArm,
  technicalRecoveryEligible,
} from '../scripts/run-local-qwen-invested-rival.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plan = loadContinuityPlan(root);
const proofPlan = loadContinuityPlan(root, 'config/tutor-stub-local-learners/qwen-refusal-dag-restored.v1.yaml');
const bilateralPlan = loadContinuityPlan(
  root,
  'config/tutor-stub-local-learners/qwen-refusal-bilateral-superego.v1.yaml',
);
const rivalPlan = buildInvestedRivalPlan(root);
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
const reviewFixture = {
  role_fidelity: 'Keep the role.',
  repetition: 'Check the previous move.',
  next_move: 'Keep a useful boundary.',
  evidence_boundary: 'No new facts.',
};

test('invested rival plan is a direct matched pair with an enforced 32 + 8 + 8 ceiling', () => {
  assert.equal(rivalPlan.total_attempt_ceiling, 48);
  assert.equal(rivalPlan.generationCap, 32);
  assert.equal(rivalPlan.judge_calls, 8);
  assert.equal(rivalPlan.recovery_attempt_reserve, 8);
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
});
