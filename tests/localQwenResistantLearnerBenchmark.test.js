import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import {
  buildBenchmarkJobs,
  buildBenchmarkOutputSchema,
  repetitionMetrics,
  technicalMetrics,
  scoreBenchmarkArms,
  assertCompleteScore,
  parseBenchmarkScore,
} from '../scripts/score-local-qwen-resistant-learner-benchmark.js';
import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { getRubricDimensions } from '../services/evalConfigLoader.js';
import { getLearnerDimensions } from '../services/learnerRubricEvaluator.js';
import { getDialogueDimensions } from '../services/rubricEvaluator.js';
import { scoreBilateralArms } from '../scripts/run-local-qwen-bilateral-superego.js';
import { continuityBudget } from '../services/localQwenRefusalContinuity.js';

function completeBilateralFixture(kind) {
  const value = fixtureScore(kind);
  if (kind === 'quality') {
    Object.assign(value, {
      measurement_indeterminate: false,
      indeterminate_reason: '',
      tutor_turns: Array.from({ length: 8 }, (_, index) => ({
        turn: index + 1,
        unsupported_evidence_assertion: false,
        evidence_reasoning: 'Fixture public source.',
      })),
    });
    value.learner_turns.forEach((row) =>
      Object.assign(row, {
        new_move_is_substantive: true,
        accepted_objection_reopened: false,
        unsupported_evidence_assertion: false,
        evidence_reasoning: 'Fixture public move.',
      }),
    );
  }
  return value;
}

const bilateralFixtureArm = () => ({
  id: 'C',
  opening: 'Fixture opening.',
  transcript: 'Fixture public transcript.',
  snapshot: {
    turns: Array.from({ length: 8 }, (_, index) => ({
      turn: index + 1,
      learner: 'Fixture learner.',
      tutor: 'Fixture tutor.',
    })),
  },
});
const bilateralDestination = () =>
  path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-bilateral-score-test-')), 'evaluation');
function rejectedEnvelope(input) {
  return {
    stdout: JSON.stringify([
      { type: 'system', subtype: 'init', model: 'claude-opus-5' },
      {
        type: 'assistant',
        message: { id: 'fixture-one-response', content: [{ type: 'tool_use', name: 'StructuredOutput', input }] },
      },
      { type: 'result', is_error: true },
    ]),
    stderr: '',
    exitCode: 1,
  };
}
function providerEmptyError() {
  const error = new Error('Fixture response-free provider error');
  error.code = 'CLI_PROVIDER_RESPONSE_FREE_ERROR';
  return error;
}

test('bilateral scorer retries an empty provider result once with the exact same packet and counts both attempts', async () => {
  const calls = [];
  const budget = continuityBudget(100);
  for (let i = 0; i < 80; i++) budget.reserve({ role: 'fixture-prior-generation' });
  const result = await scoreBilateralArms([bilateralFixtureArm()], bilateralDestination(), {
    budget,
    callJudge: async (_model, _system, prompt, role, options) => {
      calls.push({ prompt, schema: options.outputSchema, role });
      assert.equal(options.singleAttempt, true);
      if (calls.length === 1) {
        options.onRawOutput(rejectedEnvelope({}));
        throw providerEmptyError();
      }
      return { text: JSON.stringify(completeBilateralFixture(role.replace('local-qwen-benchmark-', ''))) };
    },
  });
  assert.equal(result.scores.length, 4);
  assert.equal(result.attemptsUsed, 5);
  assert.equal(budget.snapshot().used, 85);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(result.failures.length, 1);
});

test('bilateral scorer recovers a complete rejected payload unchanged without another attempt', async () => {
  let calls = 0;
  const original = { ...completeBilateralFixture('dialogue'), reasoning: 'Extra preserved context.' };
  const result = await scoreBilateralArms([bilateralFixtureArm()], bilateralDestination(), {
    budget: continuityBudget(100),
    callJudge: async (_m, _s, _p, role, options) => {
      calls++;
      const kind = role.replace('local-qwen-benchmark-', '');
      if (kind === 'dialogue') {
        options.onRawOutput(rejectedEnvelope(original));
        throw providerEmptyError();
      }
      return { text: JSON.stringify(completeBilateralFixture(kind)) };
    },
  });
  assert.equal(calls, 4);
  assert.equal(result.scores.length, 4);
  assert.deepEqual(result.scores.find((s) => s.kind === 'dialogue').raw, original);
  assert.equal(result.recoveries[0].newModelCalls, 0);
});

test('bilateral scorer stops on repeated empty responses and on substantive indeterminacy', async () => {
  for (const mode of ['empty_twice', 'indeterminate']) {
    let calls = 0;
    const outDir = bilateralDestination();
    await assert.rejects(
      scoreBilateralArms([bilateralFixtureArm()], outDir, {
        budget: continuityBudget(100),
        callJudge: async (_m, _s, _p, role, options) => {
          calls++;
          if (mode === 'empty_twice') {
            options.onRawOutput(rejectedEnvelope({}));
            throw providerEmptyError();
          }
          const kind = role.replace('local-qwen-benchmark-', '');
          const value = completeBilateralFixture(kind);
          if (kind === 'quality') value.measurement_indeterminate = true;
          return { text: JSON.stringify(value) };
        },
      }),
      mode === 'empty_twice' ? /response-free/u : /measurement indeterminate/u,
    );
    assert.equal(calls, mode === 'empty_twice' ? 2 : 4);
    assert.ok(fs.existsSync(path.join(outDir, 'stopped.json')));
  }
});

test('bilateral technical metrics account symmetrically for both full mechanisms', () => {
  const events = ['tutor_stub_auto_learner', 'tutor_stub_tutor'].flatMap((role) =>
    ['', '_superego', '_revision'].map((suffix, index) => ({
      type: 'model_call',
      role: role + suffix,
      turn: 1,
      response: { latencyMs: (index + 1) * 10, usage: { outputTokens: 10 } },
    })),
  );
  const measured = technicalMetrics(events);
  assert.deepEqual(measured.learnerMechanism, measured.tutorMechanism);
  assert.deepEqual(measured.learnerFinal, measured.tutorFinal);
  assert.equal(measured.tutorMechanism.totalLatencyMs, 60);
  assert.equal(measured.tutorFinal.totalLatencyMs, 30);
});

test('bilateral nonempty malformed wrapper stops without resampling and retains completed scores', async () => {
  const outDir = bilateralDestination();
  let calls = 0;
  const transport = rejectedEnvelope({ input: JSON.stringify(completeBilateralFixture('quality')).slice(0, -1) });
  await assert.rejects(
    scoreBilateralArms([bilateralFixtureArm()], outDir, {
      budget: continuityBudget(100),
      callJudge: async (_m, _s, _p, role, options) => {
        calls++;
        const kind = role.replace('local-qwen-benchmark-', '');
        if (kind === 'quality') {
          options.onRawOutput(transport);
          throw providerEmptyError();
        }
        return { text: JSON.stringify(completeBilateralFixture(kind)) };
      },
    }),
    /response-free/u,
  );
  const stopped = JSON.parse(fs.readFileSync(path.join(outDir, 'stopped.json'), 'utf8'));
  assert.equal(calls, 4);
  assert.equal(stopped.scores.length, 3);
  assert.equal(stopped.attemptsUsed, 4);
  assert.equal(stopped.failures.length, 1);
  assert.deepEqual(stopped.recoveries, []);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(outDir, 'C-quality-attempt-1.transport.json'), 'utf8')),
    transport,
  );
});

function fixtureScore(kind) {
  const dimensions =
    kind === 'tutor'
      ? getRubricDimensions()
      : kind === 'learner'
        ? getLearnerDimensions()
        : kind === 'dialogue'
          ? getDialogueDimensions()
          : Object.fromEntries(
              ['overall_quality', 'successful_pedagogy', 'surprise_nonrepetition', 'character_adherence'].map((key) => [
                key,
                {},
              ]),
            );
  const scores = Object.fromEntries(Object.keys(dimensions).map((key) => [key, { score: 3, reasoning: 'Fixture.' }]));
  if (kind === 'tutor' || kind === 'learner')
    return {
      turns: Array.from({ length: 8 }, (_, index) => ({
        [kind === 'tutor' ? 'turn_index' : 'learner_turn_index']: index,
        scores,
      })),
    };
  return kind === 'dialogue'
    ? { scores }
    : {
        scores,
        learner_turns: Array.from({ length: 8 }, (_, index) => ({
          turn: index + 1,
          new_move: 'Fixture move.',
          semantic_repeat_of: null,
          character_fidelity: 3,
        })),
        strengths: [],
        limitations: [],
        overall_assessment: 'Fixture only.',
      };
}

test('index-only correction preserves all scores and reasons and rejects mixed or incomplete indices', () => {
  const original = fixtureScore('learner');
  original.turns.forEach((row) => {
    row.learner_turn_index += 1;
  });
  const text = JSON.stringify(original);
  assert.throws(() => parseBenchmarkScore('learner', text, 8), /invalid turn index/u);
  const repaired = parseBenchmarkScore('learner', text, 8, { allowOneBasedIndices: true });
  assert.equal(repaired.indexNormalization.from, '1-based');
  assert.deepEqual(
    repaired.parsed.turns.map((row) => row.scores),
    original.turns.map((row) => row.scores),
  );
  assert.deepEqual(
    original.turns.map((row) => row.learner_turn_index),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  original.turns[0].learner_turn_index = 0;
  assert.throws(
    () => parseBenchmarkScore('learner', JSON.stringify(original), 8, { allowOneBasedIndices: true }),
    /invalid turn index/u,
  );
  original.turns.pop();
  assert.throws(
    () => parseBenchmarkScore('learner', JSON.stringify(original), 8, { allowOneBasedIndices: true }),
    /incomplete/u,
  );
});

test('four-arm recovery reuses two assessments and makes only calls 3–16 within the original ceiling', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-recovery-test-'));
  const arms = ['A', 'B', 'C', 'D'].map((id) => ({
    id,
    opening: 'Fixture opening',
    transcript: 'Fixture transcript',
    snapshot: { turns: Array.from({ length: 8 }, (_, index) => ({ turn: index + 1, learner: 'a', tutor: 'b' })) },
  }));
  const priorScores = ['tutor', 'learner'].map((kind) => ({
    arm: 'A',
    kind,
    raw: fixtureScore(kind),
    scored: { overall: 50 },
  }));
  let calls = 0;
  const options = {
    ceiling: 16,
    priorAttempts: 2,
    priorScores,
    async callJudge(_judge, _system, _prompt, role) {
      calls += 1;
      return { text: JSON.stringify(fixtureScore(role.replace('local-qwen-benchmark-', ''))) };
    },
  };
  const result = await scoreBenchmarkArms(arms, path.join(root, 'evaluation'), options);
  assert.equal(calls, 14);
  assert.equal(result.attemptsUsed, 16);
  assert.equal(result.scores.length, 16);
  const ledger = fs
    .readFileSync(path.join(root, 'evaluation/judge-ledger.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);
  assert.deepEqual(
    ledger.filter((row) => row.event === 'reserved').map((row) => row.call),
    Array.from({ length: 14 }, (_, index) => index + 3),
  );
  assert.equal(fs.existsSync(path.join(root, 'evaluation/A-tutor.prompt.txt')), false);
  assert.equal(fs.existsSync(path.join(root, 'evaluation/A-learner.prompt.txt')), false);
  await assert.rejects(
    scoreBenchmarkArms(arms, path.join(root, 'over-budget'), { ...options, priorAttempts: 3 }),
    /original attempt ceiling/u,
  );
  assert.equal(calls, 14);
});

test('repetition metrics distinguish repeated from developing learner turns', () => {
  const repeated = repetitionMetrics([
    { learner: 'I reject this test because the mark is not a name.' },
    { learner: 'I reject this test because the mark is not a name.' },
  ]);
  const developing = repetitionMetrics([
    { learner: 'Could the pale streak come from clipped sterling?' },
    { learner: 'That rules out clipping; now compare the die marks.' },
  ]);
  assert.equal(repeated.perTurn[1].lexicalSurprise, 0);
  assert.ok(developing.perTurn[1].lexicalSurprise > repeated.perTurn[1].lexicalSurprise);
});

test('explicitly expanded nine-attempt judge ceiling reuses three results and permits only five new calls', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-expanded-ceiling-'));
  const arms = ['A', 'B'].map((id) => ({
    id,
    opening: '',
    transcript: 'Fixture transcript',
    snapshot: { turns: Array.from({ length: 8 }, (_, i) => ({ turn: i + 1, learner: 'a', tutor: 'b' })) },
  }));
  const priorScores = ['tutor', 'learner', 'dialogue'].map((kind) => ({
    arm: 'A',
    kind,
    raw: fixtureScore(kind),
    scored: { overall: 50 },
  }));
  const calls = [];
  const options = {
    priorScores,
    priorAttempts: 4,
    async callJudge(_config, _system, _prompt, role) {
      const kind = role.replace('local-qwen-benchmark-', '');
      calls.push(kind);
      return { text: JSON.stringify(fixtureScore(kind)) };
    },
  };
  await assert.rejects(
    scoreBenchmarkArms(arms, path.join(root, 'old-ceiling'), { ...options, ceiling: 8 }),
    /original attempt ceiling/u,
  );
  assert.equal(calls.length, 0);
  const result = await scoreBenchmarkArms(arms, path.join(root, 'expanded-ceiling'), { ...options, ceiling: 9 });
  assert.deepEqual(calls, ['quality', 'tutor', 'learner', 'dialogue', 'quality']);
  assert.equal(result.attemptsUsed, 9);
  assert.equal(32 + result.attemptsUsed, 41);
  assert.equal(result.scores.length, 8);
  assert.deepEqual(result.scores.slice(0, 3), priorScores);
});

test('judge parse failure preserves the raw reply and failed reservation and never retries', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-judge-failure-')), 'evaluation');
  const arm = {
    id: 'A',
    opening: 'Public opening.',
    transcript: 'Learner: a\nTutor: b',
    snapshot: { turns: [{ turn: 1, learner: 'a', tutor: 'b' }] },
  };
  let calls = 0;
  await assert.rejects(
    scoreBenchmarkArms([arm], out, {
      ceiling: 4,
      async callJudge() {
        calls += 1;
        return { text: 'Not a JSON response.' };
      },
    }),
  );
  assert.equal(calls, 1);
  assert.equal(fs.readFileSync(path.join(out, 'A-tutor.response.txt'), 'utf8'), 'Not a JSON response.');
  const ledger = fs.readFileSync(path.join(out, 'judge-ledger.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(
    ledger.map((entry) => entry.event),
    ['reserved', 'failed'],
  );
  assert.throws(
    () => assertCompleteScore('quality', { measurement_indeterminate: true }, 8, { extendedQuality: true }),
    /indeterminate/u,
  );
});

test('technical metrics report only matched learner and tutor model calls', () => {
  const metrics = technicalMetrics([
    {
      type: 'model_call',
      role: 'tutor_stub_auto_learner',
      turn: 1,
      response: { latencyMs: 1000, usage: { inputTokens: 10, outputTokens: 4 } },
    },
    {
      type: 'model_call',
      role: 'tutor_stub_tutor',
      turn: 1,
      response: { latencyMs: 2000, usage: { inputTokens: 20, outputTokens: 8 } },
    },
  ]);
  assert.equal(metrics.learner.calls, 1);
  assert.equal(metrics.learner.meanEndToEndOutputTokensPerSecond, 4);
  assert.equal(metrics.tutor.calls, 1);
});

test('the blinded plan contains four scoring calls per transcript', () => {
  const snapshot = {
    turns: [
      { turn: 1, learner: 'Could the same mark come from clipping?', tutor: 'Test that rival against the edge.' },
    ],
  };
  const arms = ['A', 'B'].map((id) => ({
    id,
    snapshot,
    opening: 'Let us begin with the coin.',
    transcript: 'Turn 1\nLearner: x\nTutor: y',
  }));
  const jobs = buildBenchmarkJobs(arms);
  assert.equal(jobs.length, 8);
  assert.deepEqual(
    jobs.map((job) => job.kind),
    ['tutor', 'learner', 'dialogue', 'quality', 'tutor', 'learner', 'dialogue', 'quality'],
  );
  const learnerPrompt = jobs.find((job) => job.arm === 'A' && job.kind === 'learner').prompt;
  assert.match(learnerPrompt, /Let us begin with the coin\./u);
  assert.match(learnerPrompt, /Learner Turn 1 \(at dialogue position 2\)/u);
});

test('schemas require every rubric dimension and all extended annotations without forcing determinate judgments', () => {
  for (const [kind, dimensions, indexKey] of [
    ['tutor', getRubricDimensions(), 'turn_index'],
    ['learner', getLearnerDimensions(), 'learner_turn_index'],
    ['dialogue', getDialogueDimensions(), null],
  ]) {
    const schema = buildBenchmarkOutputSchema(kind, 8);
    const row = indexKey ? schema.properties.turns.items : schema;
    assert.deepEqual(row.properties.scores.required, Object.keys(dimensions));
    assert.equal(row.properties.scores.additionalProperties, false);
    if (indexKey) {
      assert.equal(schema.properties.turns.minItems, 8);
      assert.equal(schema.properties.turns.maxItems, 8);
      assert.deepEqual(row.properties[indexKey], { type: 'integer', minimum: 0, maximum: 7 });
    }
  }
  const schema = buildBenchmarkOutputSchema('quality', 8, { extendedQuality: true });
  assert.deepEqual(schema.properties.measurement_indeterminate, { type: 'boolean' });
  for (const speaker of ['learner', 'tutor']) {
    const annotations = schema.properties[`${speaker}_turns`];
    assert.equal(annotations.minItems, 8);
    assert.equal(annotations.maxItems, 8);
    assert.ok(annotations.items.required.includes('unsupported_evidence_assertion'));
    assert.ok(annotations.items.required.includes('evidence_reasoning'));
    assert.equal(annotations.items.additionalProperties, false);
  }
  assert.ok(schema.properties.learner_turns.items.required.includes('accepted_objection_reopened'));
  assert.deepEqual(
    buildBenchmarkOutputSchema('quality', 1).properties.learner_turns.items.properties.semantic_repeat_of,
    { type: 'null' },
  );
});

test('extra rubric judgments and malformed envelopes are not silently accepted or imputed', () => {
  const extra = fixtureScore('dialogue');
  extra.scores.sycophancy_or_capitulation = { score: 3, reasoning: 'Not a rubric dimension.' };
  const before = JSON.stringify(extra);
  assert.throws(() => parseBenchmarkScore('dialogue', before, 8), /extra: sycophancy_or_capitulation/u);
  assert.equal(JSON.stringify(extra), before);
  assert.throws(() => parseBenchmarkScore('quality', '{"scores":', 8), SyntaxError);
  assert.throws(() => parseBenchmarkScore('tutor', 'null', 8), /no assessment object/u);
});

test('benchmark passes schemas through the real bridge, archives envelopes and makes exactly one child call per job', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-schema-bridge-')), 'evaluation');
  const arm = {
    id: 'A',
    opening: '',
    transcript: 'Fixture public transcript',
    snapshot: { turns: Array.from({ length: 8 }, (_, i) => ({ turn: i + 1, learner: 'a', tutor: 'b' })) },
  };
  const calls = [];
  const result = await scoreBenchmarkArms([arm], out, {
    ceiling: 4,
    callJudge(config, system, prompt, role, options) {
      return callAIWithCliBridge(config, system, prompt, role, {
        ...options,
        spawnImpl(_command, args, processOptions) {
          const kind = role.replace('local-qwen-benchmark-', '');
          calls.push(kind);
          const ledger = fs
            .readFileSync(path.join(out, 'judge-ledger.jsonl'), 'utf8')
            .trim()
            .split('\n')
            .map(JSON.parse);
          assert.equal(ledger.at(-1).event, 'reserved');
          assert.equal(args[args.indexOf('--max-turns') + 1], '1');
          assert.equal(processOptions.env.CLAUDE_CODE_MAX_RETRIES, '0');
          assert.equal(processOptions.env.MAX_STRUCTURED_OUTPUT_RETRIES, '0');
          const savedSchema = JSON.parse(fs.readFileSync(path.join(out, `A-${kind}.schema.json`), 'utf8'));
          assert.deepEqual(JSON.parse(args[args.indexOf('--json-schema') + 1]), savedSchema);
          const child = new EventEmitter();
          child.stdout = new PassThrough();
          child.stderr = new PassThrough();
          child.kill = () => {};
          child.stdin = {
            write() {},
            end() {
              queueMicrotask(() => {
                child.stdout.write(
                  JSON.stringify({
                    type: 'result',
                    is_error: false,
                    num_turns: 1,
                    structured_output: fixtureScore(kind),
                  }),
                );
                child.emit('close', 0);
              });
            },
          };
          return child;
        },
      });
    },
  });
  assert.deepEqual(calls, ['tutor', 'learner', 'dialogue', 'quality']);
  assert.equal(result.attemptsUsed, 4);
  for (const kind of calls) {
    const transport = JSON.parse(fs.readFileSync(path.join(out, `A-${kind}.transport.json`), 'utf8'));
    assert.deepEqual(JSON.parse(transport.stdout).structured_output, fixtureScore(kind));
  }
});
