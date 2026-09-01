import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildRefusalPlan } from '../scripts/run-local-qwen-hostile-refusal.js';
import { buildLocalLearnerBehaviorPrompt } from '../scripts/run-local-qwen-resistant-learner.js';
import {
  buildBenchmarkJobs,
  assertCompleteScore,
  scoreBenchmarkArms,
} from '../scripts/score-local-qwen-resistant-learner-benchmark.js';
import { runFactorialExperiment } from '../scripts/run-local-qwen-superego-experiment.js';
import { renderRefusalReport } from '../services/localQwenRefusalReport.js';
import { getRubricDimensions } from '../services/evalConfigLoader.js';
import { getLearnerDimensions } from '../services/learnerRubricEvaluator.js';
import { getDialogueDimensions } from '../services/rubricEvaluator.js';
import { parseRefusalPartialQuality } from '../scripts/render-local-qwen-refusal-report.js';
import { qualitySummary } from '../services/localQwenFactorialReport.js';

const turns = () =>
  Array.from({ length: 8 }, (_, i) => ({
    turn: i + 1,
    learner: `Fixture refusal ${i + 1}.`,
    tutor: `Fixture tutor ${i + 1}.`,
  }));
const quality = () => ({
  scores: Object.fromEntries(
    ['overall_quality', 'successful_pedagogy', 'surprise_nonrepetition', 'character_adherence'].map((k) => [
      k,
      { score: 3, reasoning: 'Fixture only.' },
    ]),
  ),
  learner_turns: turns().map((t) => ({
    turn: t.turn,
    new_move: 'Fixture refusal',
    semantic_repeat_of: null,
    character_fidelity: 3,
    new_move_is_substantive: true,
    unsupported_evidence_assertion: false,
    accepted_objection_reopened: false,
    evidence_reasoning: 'Fixture public text.',
  })),
  tutor_turns: turns().map((t) => ({
    turn: t.turn,
    unsupported_evidence_assertion: false,
    evidence_reasoning: 'Fixture public text.',
  })),
  measurement_indeterminate: false,
  indeterminate_reason: '',
  strengths: [],
  limitations: [],
  overall_assessment: 'Fixture only.',
});

test('refusal plan has matched contemporary direct arms, explicit mockery override, no hidden targets, and 40 slots', () => {
  const p = buildRefusalPlan();
  assert.equal(p.generationCap + p.judge_calls, 40);
  assert.equal(p.arms.length, 2);
  assert.deepEqual(
    p.arms.map((a) => a.cap),
    [16, 16],
  );
  assert.deepEqual(p.arms[0].spec.character, p.arms[1].spec.character);
  assert.deepEqual(p.arms[0].spec.tone, p.arms[1].spec.tone);
  assert.deepEqual(p.arms[0].spec.generation, p.arms[1].spec.generation);
  const brief = buildLocalLearnerBehaviorPrompt(p.arms[0].spec);
  assert.match(brief, /Alex/u);
  assert.match(brief, /sarcastic and verbally confrontational/u);
  assert.doesNotMatch(brief, /Do not rely on insults|mustRecurMinRate|scoreBands|basinFeedHose|hairline split/u);
  assert.ok(p.arms.every((a) => a.spec.generation.deliberation.superegoModel === null));
  const invalid = structuredClone(p);
  invalid.total_attempt_ceiling = 41;
  assert.throws(() => buildRefusalPlan(invalid), /40 available attempts/u);
});

test('all four scorer families use the new setting and character without checkpoint identity or stale Tamsin instructions', () => {
  const p = buildRefusalPlan();
  const arms = p.arms.map((a) => ({
    id: a.id,
    snapshot: { turns: turns() },
    opening: 'Fixture opening.',
    transcript: 'Fixture public transcript.',
  }));
  const jobs = buildBenchmarkJobs(arms, { extendedQuality: true, assessmentContext: p.assessmentContext });
  assert.equal(jobs.length, 8);
  for (const job of jobs) {
    assert.doesNotMatch(job.prompt, /Tamsin|Marrick|Light Shillings|mlx-local|gpt-5\.6|Qwen3/u);
    assert.match(job.prompt, /refus|tenant/iu);
  }
  const q = jobs.find((j) => j.kind === 'quality').prompt;
  assert.match(q, /"accepted_objection_reopened":false/u);
  assert.match(q, /faithful refusal can coexist with little learning/u);
  assertCompleteScore('quality', quality(), 8, { extendedQuality: true });
  const missing = quality();
  delete missing.learner_turns[0].accepted_objection_reopened;
  assert.throws(() => assertCompleteScore('quality', missing, 8, { extendedQuality: true }), /novelty annotations/u);
});

test('report-only partial extraction preserves values and leaves seven omitted judgments unknown', () => {
  const partial = quality();
  for (const row of partial.learner_turns.slice(1)) delete row.accepted_objection_reopened;
  const malformed = JSON.stringify(partial).replace('}},"learner_turns"', '},"learner_turns"');
  assert.throws(() => JSON.parse(malformed), SyntaxError);
  const result = parseRefusalPartialQuality(malformed);
  assert.deepEqual(result.raw, partial);
  assert.equal(result.partial, true);
  assert.equal(result.missingFields.length, 7);
  assert.equal(qualitySummary(result.raw).freshGroundedTurns, null);
  assert.equal(qualitySummary(result.raw).reopenedObjections, null);
  assert.throws(() => assertCompleteScore('quality', result.raw, 8, { extendedQuality: true }), /novelty annotations/u);
  assert.throws(
    () =>
      parseRefusalPartialQuality(
        malformed.replace('"measurement_indeterminate":false', '"measurement_indeterminate":true'),
      ),
    /indeterminate/u,
  );
});

test('missing novelty judgments remain failed evidence in the scoring runner, with no replacement call', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'refusal-missing-judge-')), 'evaluation');
  const arm = { id: 'A', snapshot: { turns: turns() }, opening: 'Fixture opening.', transcript: 'Fixture transcript.' };
  const priorScores = [
    ['tutor', getRubricDimensions()],
    ['learner', getLearnerDimensions()],
    ['dialogue', getDialogueDimensions()],
  ].map(([kind, dims]) => {
    const scores = Object.fromEntries(Object.keys(dims).map((key) => [key, { score: 3, reasoning: 'Fixture only.' }]));
    const raw =
      kind === 'dialogue'
        ? { scores }
        : { turns: turns().map((_, i) => ({ [kind === 'tutor' ? 'turn_index' : 'learner_turn_index']: i, scores })) };
    return { arm: 'A', kind, raw, scored: { overall: 50 } };
  });
  const partial = quality();
  for (const row of partial.learner_turns.slice(1)) delete row.accepted_objection_reopened;
  const response = JSON.stringify(partial);
  let calls = 0;
  await assert.rejects(
    scoreBenchmarkArms([arm], out, {
      ceiling: 4,
      priorAttempts: 3,
      priorScores,
      extendedQuality: true,
      async callJudge(_config, _system, _prompt, _role, options) {
        calls += 1;
        assert.equal(options.singleAttempt, true);
        assert.ok(options.outputSchema.properties.learner_turns.items.required.includes('accepted_objection_reopened'));
        options.onRawOutput({ stdout: response, stderr: '', exitCode: 0 });
        return { text: response };
      },
    }),
    /quality judge response failed its output schema: .*accepted_objection_reopened:required/u,
  );
  assert.equal(calls, 1);
  assert.equal(fs.readFileSync(path.join(out, 'A-quality.response.txt'), 'utf8'), response);
  assert.equal(fs.existsSync(path.join(out, 'A-quality.json')), false);
  assert.equal(fs.existsSync(path.join(out, 'scores.json')), false);
  assert.match(fs.readFileSync(path.join(out, 'A-quality.error.json'), 'utf8'), /accepted_objection_reopened/u);
  const ledger = fs.readFileSync(path.join(out, 'judge-ledger.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(
    ledger.map((row) => [row.event, row.call]),
    [
      ['reserved', 4],
      ['failed', 4],
    ],
  );
});

test('two-arm injected end-to-end run uses exactly 32+8 attempts and produces a contemporary report', async () => {
  const p = buildRefusalPlan();
  const outDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-refusal-mock-')), 'out');
  let generations = 0;
  let judges = 0;
  const result = await runFactorialExperiment(p, {
    outDir,
    dryRun: false,
    mock: true,
    scoringOptions: { assessmentContext: p.assessmentContext, allowOneBasedIndices: true },
    renderReport: (options) => renderRefusalReport({ ...options, characterBrief: p.assessmentContext.characterBrief }),
    async runArm(_command, _args, { arm, savePath, env }) {
      assert.equal(env.TUTOR_STUB_CLI_POLICY_RETRY, 'off');
      fs.mkdirSync(env.TUTOR_STUB_TRACE_DIR);
      const trace = path.join(env.TUTOR_STUB_TRACE_DIR, 'fixture.jsonl');
      const events = [{ type: 'tutor_opening', text: 'Fixture opening.' }];
      for (const turn of turns())
        for (const role of ['tutor_stub_auto_learner', 'tutor_stub_tutor']) {
          generations++;
          events.push({ type: 'model_call_budget_reserved', role, turn: turn.turn });
          events.push({
            type: 'model_call',
            role,
            turn: turn.turn,
            provider: role === 'tutor_stub_tutor' ? 'codex' : 'mlx-local',
            model: role === 'tutor_stub_tutor' ? 'gpt-5.6-sol' : arm.spec.localService.modelIdContains,
            request: { maxTokens: 900 },
            response: { text: 'Fixture only.', latencyMs: 1000, usage: { inputTokens: 30, outputTokens: 10 } },
          });
        }
      fs.writeFileSync(trace, events.map((row) => JSON.stringify(row)).join('\n'));
      fs.writeFileSync(savePath, JSON.stringify({ turns: turns(), trace }));
      return { code: 0 };
    },
    async callJudge(judge, _system, prompt, role) {
      judges++;
      assert.equal(judge.model, 'claude-opus-5');
      assert.doesNotMatch(prompt, /Tamsin|Marrick|mlx-local/u);
      const kind = role.replace('local-qwen-benchmark-', '');
      const dimensions =
        kind === 'tutor'
          ? getRubricDimensions()
          : kind === 'learner'
            ? getLearnerDimensions()
            : getDialogueDimensions();
      const scores = Object.fromEntries(
        Object.keys(dimensions).map((k) => [k, { score: 3, reasoning: 'Fixture only.' }]),
      );
      const raw =
        kind === 'quality'
          ? quality()
          : kind === 'dialogue'
            ? { scores }
            : {
                turns: turns().map((_, i) => ({ [kind === 'tutor' ? 'turn_index' : 'learner_turn_index']: i, scores })),
              };
      return { text: JSON.stringify(raw) };
    },
  });
  assert.equal(generations, 32);
  assert.equal(judges, 8);
  const html = fs.readFileSync(path.join(outDir, 'report.html'), 'utf8');
  assert.match(html, /SYNTHETIC PREVIEW ONLY/u);
  assert.match(html, /Accepted assessments: 8\/8/u);
  assert.match(html, /data-dd-layout="parallel"/u);
  assert.doesNotMatch(html, /Luna \+ revision|Tamsin|Marrick|112 attempts/u);
  assert.equal((html.match(/<\/script>/giu) || []).length, 1);
  const partial = renderRefusalReport({
    arms: result.arms,
    evaluation: { scores: result.evaluation.scores.slice(0, 1) },
  });
  assert.match(partial.html, /ASSESSMENT INCOMPLETE/u);
  assert.match(partial.html, /Accepted assessments: 1\/8/u);
  assert.match(partial.html, /Unavailable/u);
  assert.ok(fs.existsSync(path.join(outDir, 'report-data.json')));
  const amended = renderRefusalReport({
    arms: result.arms,
    evaluation: result.evaluation,
    provenance: { totalAttemptCeiling: 41 },
  });
  assert.match(amended.html, /Maximum 41 attempts: 16 local Qwen, 16 Sol and 9 Opus/u);
  assert.match(amended.html, /three valid assessments and both dialogues were reused unchanged/u);
  assert.doesNotMatch(amended.html, /Maximum 40 attempts/u);
  const finished = renderRefusalReport({
    arms: result.arms,
    evaluation: result.evaluation,
    provenance: {
      continuationCallCeiling: 4,
      continuationCallsCompleted: 4,
      continuationHelperCallsObserved: 0,
      recordedStudyInvocations: 41,
      knownModelCallLowerBound: 42,
    },
  });
  assert.match(finished.html, /4 of 4 additionally authorized Opus calls/u);
  assert.match(finished.html, /cumulative total is not verified/u);
  assert.match(finished.html, /Accepted assessments: 8\/8/u);
  assert.doesNotMatch(finished.html, /Maximum 40 attempts|Maximum 41 attempts/u);
});
