import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildFactorialPlan,
  runFactorialExperiment,
  verifyGeneratedArm,
} from '../scripts/run-local-qwen-superego-experiment.js';
import { compareMechanisms, qualitySummary, renderFactorialReport } from '../services/localQwenFactorialReport.js';
import { createReportPreviewServer } from '../scripts/preview-local-qwen-report.js';
import { parsePartialQualityForReport } from '../scripts/render-local-qwen-factorial-report.js';
import { tutorStubCliPolicyRetryDecision } from '../services/tutorStubCliPolicyRetry.js';
import { getRubricDimensions } from '../services/evalConfigLoader.js';
import { getLearnerDimensions } from '../services/learnerRubricEvaluator.js';
import { getDialogueDimensions } from '../services/rubricEvaluator.js';

test('factorial plan contains four unique conditions and exact 112-attempt ceiling', () => {
  const plan = buildFactorialPlan();
  assert.equal(plan.arms.length, 4);
  assert.equal(plan.generationCap, 96);
  assert.equal(plan.judge_calls, 16);
  assert.equal(plan.generationCap + plan.judge_calls, 112);
  assert.deepEqual(
    plan.arms.map((arm) => arm.cap),
    [16, 32, 32, 16],
  );
  assert.equal(new Set(plan.arms.map((arm) => `${arm.variant}/${arm.mode}`)).size, 4);
  assert.ok(plan.arms.every((arm) => arm.spec.generation.systemPromptStyle === 'active_resistance_v2'));
});

test('default command only executes zero-call child dry runs into a disposable destination', async () => {
  const plan = buildFactorialPlan();
  const outDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'factorial-test-')), 'out');
  const calls = [];
  await runFactorialExperiment(plan, {
    outDir,
    dryRun: true,
    async runArm(_command, args, options) {
      calls.push({ args, options });
      fs.writeFileSync(options.log, 'dry run only\n');
      return { code: 0, signal: null };
    },
    async callJudge() {
      throw new Error('judge must not be called by dry run');
    },
  });
  assert.equal(calls.length, 4);
  assert.ok(calls.every(({ args }) => args.includes('--dry-run')));
  assert.ok(calls.every(({ options }) => options.dryRun === true));
  assert.ok(calls.every(({ options }) => options.env.TUTOR_STUB_CLI_POLICY_RETRY === 'off'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(outDir, 'dry-run.json'))).modelAttempts, 0);
  assert.doesNotMatch(fs.readFileSync(path.join(outDir, 'run-ledger.jsonl'), 'utf8'), /arm_allocated|judge_allocated/u);
});

test('the common CLI policy stops on the first failure when retries are disabled', () => {
  const error = Object.assign(new Error('synthetic failure'), { code: 'CLI_PROVIDER_TURN_FAILED', provider: 'codex' });
  const decision = tutorStubCliPolicyRetryDecision(error, { allowRetry: false });
  assert.equal(decision.retry, false);
  assert.equal(decision.delay_ms, 0);
  assert.equal(decision.reason, 'retries_disabled_for_run');
});

test('arm verification requires one reservation and realized call per planned role and turn', () => {
  const base = buildFactorialPlan().arms.find((arm) => arm.mode === 'ego_superego');
  const roles = [
    'tutor_stub_auto_learner',
    'tutor_stub_auto_learner_superego',
    'tutor_stub_auto_learner_revision',
    'tutor_stub_tutor',
  ];
  const snapshot = {
    turns: Array.from({ length: 8 }, (_, index) => ({
      turn: index + 1,
      learner: 'A learner move.',
      tutor: 'A tutor move.',
    })),
  };
  const events = roles.flatMap((role) =>
    Array.from({ length: 8 }, (_, index) => ({
      type: 'model_call',
      role,
      turn: index + 1,
      provider: role.includes('auto_learner') && role !== 'tutor_stub_auto_learner_superego' ? 'mlx-local' : 'codex',
      model:
        role === 'tutor_stub_tutor'
          ? 'gpt-5.6-sol'
          : role === 'tutor_stub_auto_learner_superego'
            ? 'gpt-5.6-luna'
            : base.spec.localService.modelIdContains,
      request: { maxTokens: 900 },
      response: { text: 'ok', usage: { outputTokens: 2 } },
    })),
  );
  events.push(...Array.from({ length: 32 }, () => ({ type: 'model_call_budget_reserved' })));
  const arm = { ...base, snapshot, technical: { modelCallErrors: 0 } };
  assert.doesNotThrow(() => verifyGeneratedArm(arm, events));
  assert.throws(() => verifyGeneratedArm(arm, events.slice(1)), /call accounting/u);
});

function quality(turns, { fresh = 4, character = 4, pedagogy = 4, unsupported = 0 } = {}) {
  return {
    scores: Object.fromEntries(
      ['overall_quality', 'successful_pedagogy', 'surprise_nonrepetition', 'character_adherence'].map((key) => [
        key,
        {
          score: key === 'character_adherence' ? character : key === 'successful_pedagogy' ? pedagogy : 4,
          reasoning: 'Synthetic preview.',
        },
      ]),
    ),
    learner_turns: turns.map((_, index) => ({
      turn: index + 1,
      new_move: 'Synthetic move',
      semantic_repeat_of: null,
      character_fidelity: 4,
      new_move_is_substantive: index > 0 && index <= fresh,
      unsupported_evidence_assertion: index < unsupported,
      accepted_objection_reopened: false,
      evidence_reasoning: 'Synthetic preview.',
    })),
    tutor_turns: turns.map((_, index) => ({
      turn: index + 1,
      unsupported_evidence_assertion: false,
      evidence_reasoning: 'Synthetic preview.',
    })),
    measurement_indeterminate: false,
    indeterminate_reason: '',
    strengths: [],
    limitations: [],
    overall_assessment: 'Synthetic preview.',
  };
}

test('predeclared triage rule needs a two-turn gain without character, pedagogy or evidence regression', () => {
  const turns = Array.from({ length: 8 }, () => ({}));
  const direct = qualitySummary(quality(turns, { fresh: 3 }));
  const superego = qualitySummary(quality(turns, { fresh: 5 }));
  assert.deepEqual(compareMechanisms(direct, superego), { freshTurnGain: 2, promising: true });
  assert.equal(
    compareMechanisms(direct, qualitySummary(quality(turns, { fresh: 6, unsupported: 1 }))).promising,
    false,
  );
});

test('partial quality reporting preserves returned judgments but never treats missing reopening labels as false', () => {
  const turns = Array.from({ length: 8 }, () => ({}));
  const raw = quality(turns);
  for (const turn of raw.learner_turns) delete turn.accepted_objection_reopened;
  const original = JSON.stringify(raw);
  const partial = parsePartialQualityForReport(original, 8);
  assert.equal(JSON.stringify(partial.raw), original);
  assert.equal(partial.partial, true);
  assert.equal(partial.missingFields.length, 8);
  const summary = qualitySummary(partial.raw);
  assert.equal(summary.freshGroundedTurns, null);
  assert.equal(summary.reopenedObjections, null);
  assert.equal(summary.semanticRepeats, 0);
  assert.equal(summary.unsupportedLearner, 0);
  assert.equal(summary.pedagogy, 4);
  assert.deepEqual(compareMechanisms(summary, qualitySummary(quality(turns))), {
    freshTurnGain: null,
    promising: null,
  });
  const invalid = structuredClone(raw);
  delete invalid.tutor_turns[0].unsupported_evidence_assertion;
  assert.throws(() => parsePartialQualityForReport(JSON.stringify(invalid), 8), /additional invalid evidence/u);
  invalid.tutor_turns[0].unsupported_evidence_assertion = false;
  invalid.measurement_indeterminate = true;
  assert.throws(() => parsePartialQualityForReport(JSON.stringify(invalid), 8), /measurement indeterminate/u);
  assert.throws(() => parsePartialQualityForReport(JSON.stringify(quality(turns)), 8), /only supports/u);
});

test('synthetic report is self-contained, conspicuously marked and uses paired public swimlanes', () => {
  const turns = Array.from({ length: 8 }, (_, index) => ({
    turn: index + 1,
    learner: `Synthetic learner ${index + 1}.`,
    tutor: `Synthetic tutor ${index + 1}.`,
  }));
  const arms = ['normal', 'abliterated'].flatMap((variant) =>
    ['direct', 'ego_superego'].map((mode, index) => ({
      id: `${variant[0]}${index}`,
      variant,
      mode,
      opening: 'Synthetic opening.',
      snapshot: { turns },
      wallTimeMs: 1000,
      repetition: { meanLexicalSurpriseAfterOpening: 0.5, distinct2: 0.5 },
      technical: {
        learnerMechanism: { medianLatencyMs: 100 },
        learnerFinal: { medianLatencyMs: 100, meanEndToEndOutputTokensPerSecond: 2 },
        tutor: { totalLatencyMs: 200 },
        guardedTutorTurns: 0,
        promptAuditRecoveries: 0,
      },
    })),
  );
  const dimensions = { x: { score: 4, reasoning: 'Synthetic.' } };
  const scores = arms.flatMap((arm) => [
    {
      arm: arm.id,
      kind: 'tutor',
      scored: { overall: 50 },
      raw: { turns: turns.map((_, index) => ({ turn_index: index, scores: dimensions })) },
    },
    {
      arm: arm.id,
      kind: 'learner',
      scored: { overall: 50 },
      raw: { turns: turns.map((_, index) => ({ learner_turn_index: index, scores: dimensions })) },
    },
    { arm: arm.id, kind: 'dialogue', scored: { overall: 50 }, raw: { scores: dimensions } },
    { arm: arm.id, kind: 'quality', scored: { overall: 50 }, raw: quality(turns) },
  ]);
  const rendered = renderFactorialReport({ arms, evaluation: { scores }, mock: true });
  assert.match(rendered.html, /SYNTHETIC PREVIEW ONLY/u);
  assert.match(rendered.html, /data-dd-layout="parallel"/u);
  assert.equal(rendered.interchange.length, 2);
  assert.equal(
    (rendered.html.match(/<\/script>/giu) || []).length,
    1,
    'embedded asset comments must not close the script element',
  );
  assert.doesNotMatch(rendered.html, /<link|src="https?:/u);
  const partial = renderFactorialReport({
    arms,
    evaluation: {
      scores: scores.slice(0, 1),
      stopReason: 'learner judge returned an invalid turn index',
      rejected: [{ arm: 'n0', kind: 'learner', error: 'invalid index', text: '<unaccepted reply>' }],
    },
  });
  assert.match(partial.html, /ASSESSMENT INCOMPLETE/u);
  assert.match(partial.html, /Accepted assessments: 1\/16/u);
  assert.match(partial.html, /Not assessed/u);
  assert.match(partial.html, /Rejected response/u);
  assert.match(partial.html, /&lt;unaccepted reply&gt;/u);
  assert.doesNotMatch(partial.html, /Promising for a replicated follow-up|Not yet demonstrated/u);
  assert.equal(partial.interchange.flatMap((pair) => pair.turns.flatMap((turn) => turn.messages)).length, 68);
  const partiallyAnnotated = structuredClone(scores);
  const missingAnnotation = partiallyAnnotated.find((score) => score.arm === 'a0' && score.kind === 'quality');
  for (const turn of missingAnnotation.raw.learner_turns) delete turn.accepted_objection_reopened;
  Object.assign(missingAnnotation, parsePartialQualityForReport(JSON.stringify(missingAnnotation.raw), 8));
  const comparison = renderFactorialReport({ arms, evaluation: { scores: partiallyAnnotated } });
  assert.match(comparison.html, /Accepted assessments: 15\/16/u);
  assert.match(comparison.html, /Partial assessments: 1/u);
  assert.match(comparison.html, /all four dialogues have complete v2.2 rubric assessments/u);
  assert.match(comparison.html, /combined fresh-contribution comparison is unavailable/u);
  assert.match(comparison.html, /unknown, not false/u);
  assert.match(comparison.html, /Fresh-contribution difference: 0/u);
});

test('report-only preview refuses every path except the root report without requiring a network socket', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'report-preview-'));
  const file = path.join(root, 'report.html');
  fs.writeFileSync(file, '<!doctype html><title>safe fixture</title>');
  const server = createReportPreviewServer(file);
  const request = (url, method = 'GET') => {
    const response = {
      writeHead(status, headers) {
        this.status = status;
        this.headers = headers;
        return this;
      },
      end(body) {
        this.body = body;
        return this;
      },
    };
    server.emit('request', { url, method }, response);
    return response;
  };
  assert.equal(request('/').status, 200);
  assert.match(request('/').headers['Content-Security-Policy'], /connect-src 'none'/u);
  assert.equal(request('/../.git/config').status, 404);
  assert.equal(request('/', 'POST').status, 404);
});

test('the complete injected pipeline reserves 96+16, archives all scores and renders without real providers', async () => {
  const plan = buildFactorialPlan();
  const outDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'factorial-full-mock-')), 'out');
  let generatedCalls = 0;
  let judgeCalls = 0;
  const runArm = async (_command, _args, { arm, savePath, env }) => {
    assert.equal(env.TUTOR_STUB_CLI_POLICY_RETRY, 'off');
    const turns = Array.from({ length: 8 }, (_, index) => ({
      turn: index + 1,
      learner: `Fixture learner ${index + 1}.`,
      tutor: `Fixture tutor ${index + 1}.`,
    }));
    const roles = [
      'tutor_stub_auto_learner',
      ...(arm.mode === 'ego_superego' ? ['tutor_stub_auto_learner_superego', 'tutor_stub_auto_learner_revision'] : []),
      'tutor_stub_tutor',
    ];
    const events = [{ type: 'tutor_opening', text: 'Fixture public opening.' }];
    for (const turn of turns)
      for (const role of roles) {
        generatedCalls += 1;
        const local = role === 'tutor_stub_auto_learner' || role === 'tutor_stub_auto_learner_revision';
        events.push({ type: 'model_call_budget_reserved', role, turn: turn.turn });
        events.push({
          type: 'model_call',
          role,
          turn: turn.turn,
          provider: local ? 'mlx-local' : 'codex',
          model: local
            ? arm.spec.localService.modelIdContains
            : role === 'tutor_stub_tutor'
              ? 'gpt-5.6-sol'
              : 'gpt-5.6-luna',
          request: { maxTokens: 900 },
          response: { text: 'Fixture result.', latencyMs: 1000, usage: { inputTokens: 30, outputTokens: 10 } },
        });
      }
    fs.mkdirSync(env.TUTOR_STUB_TRACE_DIR);
    const trace = path.join(env.TUTOR_STUB_TRACE_DIR, 'fixture.jsonl');
    fs.writeFileSync(trace, events.map((event) => JSON.stringify(event)).join('\n'));
    fs.writeFileSync(savePath, JSON.stringify({ turns, trace }));
    return { code: 0 };
  };
  const callJudge = async (judge, _system, prompt, role) => {
    judgeCalls += 1;
    assert.equal(judge.model, 'claude-opus-5');
    assert.doesNotMatch(prompt, /mlx-local|gpt-5\.6|evidence_novelty_v2|initialDraft/u);
    const kind = role.replace('local-qwen-benchmark-', '');
    const dimensions =
      kind === 'tutor' ? getRubricDimensions() : kind === 'learner' ? getLearnerDimensions() : getDialogueDimensions();
    const scores = Object.fromEntries(
      Object.keys(dimensions).map((key) => [key, { score: 3, reasoning: 'Synthetic fixture.' }]),
    );
    const parsed =
      kind === 'quality'
        ? quality(Array.from({ length: 8 }, () => ({})))
        : kind === 'dialogue'
          ? { scores }
          : {
              turns: Array.from({ length: 8 }, (_, index) => ({
                [kind === 'tutor' ? 'turn_index' : 'learner_turn_index']: index,
                scores,
              })),
            };
    return { text: JSON.stringify(parsed) };
  };
  await runFactorialExperiment(plan, { outDir, dryRun: false, mock: true, runArm, callJudge });
  assert.equal(generatedCalls, 96);
  assert.equal(judgeCalls, 16);
  assert.match(fs.readFileSync(path.join(outDir, 'report.html'), 'utf8'), /SYNTHETIC PREVIEW ONLY/u);
  const ledger = fs
    .readFileSync(path.join(outDir, 'evaluation/judge-ledger.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);
  assert.equal(ledger.filter((row) => row.event === 'reserved').length, 16);
  assert.equal(ledger.filter((row) => row.event === 'completed').length, 16);
  await assert.rejects(
    runFactorialExperiment(plan, { outDir, dryRun: false, mock: true, runArm, callJudge }),
    /EEXIST/u,
  );
  assert.equal(generatedCalls + judgeCalls, 112);
});

test('failed arm stops before subsequent arms or any judge and preserves its allocation', async () => {
  const plan = buildFactorialPlan();
  const outDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'factorial-fail-')), 'out');
  let arms = 0;
  await assert.rejects(
    runFactorialExperiment(plan, {
      outDir,
      dryRun: false,
      mock: true,
      async runArm() {
        arms += 1;
        return { code: 1 };
      },
      async callJudge() {
        throw new Error('judge must not run');
      },
    }),
    /arm A stopped/u,
  );
  assert.equal(arms, 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(outDir, 'stopped.json'))).allocated, 16);
});
