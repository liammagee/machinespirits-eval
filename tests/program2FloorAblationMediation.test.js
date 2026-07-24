import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  componentVector,
  extractCuePreservingSpanV2,
  questionSentences,
  selectAuthoritativeTraces,
  transitionVector,
} from '../scripts/analyze-program2-floor-ablation-mediation.mjs';
import { validateProvenanceEvidence } from '../scripts/audit-program2-floor-ablation-provenance.mjs';

test('cue-preserving span v2 prefers a cue-bearing question', () => {
  const result = extractCuePreservingSpanV2(
    'What would you try next? Which evidence licenses that inference?',
  );
  assert.deepEqual(result, {
    status: 'ok',
    span: 'Which evidence licenses that inference?',
    carriedStatement: false,
  });
});

test('cue-preserving span v2 carries an existing cue-bearing statement', () => {
  const result = extractCuePreservingSpanV2(
    'The record still lacks the bridge. What follows from the mark?',
  );
  assert.deepEqual(result, {
    status: 'ok',
    span: 'The record still lacks the bridge. What follows from the mark?',
    carriedStatement: true,
  });
});

test('cue-preserving span v2 neither invents a cue nor adds a question', () => {
  const result = extractCuePreservingSpanV2('The bridge is still missing. What follows from the mark?');
  assert.deepEqual(result, {
    status: 'ok',
    span: 'What follows from the mark?',
    carriedStatement: false,
  });
  assert.equal(componentVector(result.span).cue, false);
  assert.equal(componentVector(result.span).exactlyOneQuestion, true);
});

test('cue-preserving span v2 reports no_span when no valid question exists', () => {
  assert.deepEqual(extractCuePreservingSpanV2('The evidence is on the table.'), {
    status: 'no_span',
    span: null,
    carriedStatement: false,
  });
});

test('cue-preserving span v2 handles malformed quotation and whitespace deterministically', () => {
  const text = '  The item remains public.\n\n"   What follows from it?   ';
  const result = extractCuePreservingSpanV2(text);
  assert.equal(result.status, 'ok');
  assert.equal(result.carriedStatement, true);
  assert.equal(result.span, 'The item remains public. "   What follows from it?');
});

test('cue-preserving span v2 remains bounded on the 44-question degeneration shape', () => {
  const text = Array.from({ length: 44 }, (_, index) =>
    index === 43
      ? `Which evidence supports candidate ${index}?`
      : `What about candidate number ${index}?`,
  ).join(' ');
  assert.equal(questionSentences(text).length, 44);
  const result = extractCuePreservingSpanV2(text);
  assert.equal(result.span, 'Which evidence supports candidate 43?');
  assert.ok(result.span.length < 100);
  assert.equal(componentVector(result.span).questionMarks, 1);
});

test('transition vector identifies cue loss, question repair, containment, and overwrite', () => {
  const cueLoss = transitionVector('The evidence is public. What follows?', 'What follows?');
  assert.equal(cueLoss.cueLoss, true);
  assert.equal(cueLoss.currentContainedInPrevious, true);

  const questionRepair = transitionVector('What follows? What else?', 'What follows?');
  assert.equal(questionRepair.questionRepair, true);

  const overwrite = transitionVector('What follows?', 'Which mark matters?');
  assert.equal(overwrite.overwrite, true);

  const missingSpan = transitionVector('The evidence is public. What follows?', null);
  assert.equal(missingSpan.comparable, true);
  assert.equal(missingSpan.missingCurrent, true);
  assert.equal(missingSpan.cueLoss, true);
});

function writeTrace(file, events) {
  fs.writeFileSync(file, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
}

test('authoritative selection separates sealed, counted-failure, and interrupted traces', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'floor-mediation-selection-'));
  const jobs = [
    { id: 'job-resumed', condition: 'untuned_committee', profile: 'proof_skipper' },
    { id: 'job-attrition', condition: 'trained_committee', profile: 'affective_resistant' },
  ];
  fs.writeFileSync(path.join(root, 'launch-plan.json'), JSON.stringify({ plan: { jobs } }));
  fs.writeFileSync(
    path.join(root, 'launch-state.json'),
    JSON.stringify({
      jobs: {
        'job-resumed': {
          status: 'sealed',
          attempts: 2,
          failures: [{ traceFile: 'traces/job-resumed/failure.jsonl' }],
        },
        'job-attrition': {
          status: 'failed',
          attrition: true,
          attempts: 2,
          failures: [
            { traceFile: 'traces/job-attrition/attempt-1.jsonl' },
            { traceFile: 'traces/job-attrition/attempt-2.jsonl' },
          ],
        },
      },
    }),
  );
  for (const job of jobs) fs.mkdirSync(path.join(root, 'traces', job.id), { recursive: true });
  writeTrace(path.join(root, 'traces/job-resumed/failure.jsonl'), [
    { seq: 1, type: 'model_call_error', turn: 4 },
  ]);
  writeTrace(path.join(root, 'traces/job-resumed/interrupted.jsonl'), [
    { seq: 1, type: 'run_start' },
    { seq: 2, type: 'turn_complete', turn: 1 },
  ]);
  writeTrace(path.join(root, 'traces/job-resumed/sealed.jsonl'), [
    { seq: 1, type: 'run_start' },
    { seq: 2, type: 'run_end' },
  ]);
  writeTrace(path.join(root, 'traces/job-attrition/attempt-1.jsonl'), [
    { seq: 1, type: 'model_call_error', turn: 3 },
  ]);
  writeTrace(path.join(root, 'traces/job-attrition/attempt-2.jsonl'), [
    { seq: 1, type: 'model_call_error', turn: 7 },
  ]);

  const selection = selectAuthoritativeTraces(root);
  const resumed = selection.jobs.find((entry) => entry.job.id === 'job-resumed');
  const attrition = selection.jobs.find((entry) => entry.job.id === 'job-attrition');
  assert.equal(resumed.authoritative.relative, 'traces/job-resumed/sealed.jsonl');
  assert.deepEqual(
    resumed.traces.map((trace) => trace.classification).sort(),
    ['counted_failure', 'interrupted', 'sealed'],
  );
  assert.equal(attrition.authoritative, null);
  assert.deepEqual(
    attrition.traces.map((trace) => trace.classification),
    ['counted_failure', 'counted_failure'],
  );
});

test('provenance validation fails closed on an Ollama alias collision and template drift', () => {
  const makeModel = (name, digest, template) => ({
    name,
    manifest: {
      modelLayerDigest: digest,
      modelBlobExists: true,
      modelBlobBytes: 10,
      modelLayerBytes: 10,
      configDigest: digest,
      templateDigest: 'shared-template',
      paramsDigest: 'shared-params',
    },
    config: { family: 'qwen35', quantization: 'Q8_0' },
    template,
    system: '',
    modelfile: { fromDigest: digest },
  });
  const sharedDigest = 'sha256:collision';
  const checks = validateProvenanceEvidence({
    models: {
      'program2-sft-instruct-v2': makeModel('program2-sft-instruct-v2', sharedDigest, 'drifted'),
      'program2-floor-instruct-q8': makeModel('program2-floor-instruct-q8', sharedDigest, '{{ .Prompt }}'),
    },
    reports: {
      trained: { file: 'trained.json', hashMatches: true, model: 'program2-sft-instruct-v2' },
      untuned: { file: 'untuned.json', hashMatches: true, model: 'program2-floor-instruct-q8' },
    },
    traceEvidence: {
      momentModels: [{ condition: 'trained_committee', model: 'program2-sft-instruct-v2' }],
      firstDrafts: [
        {
          config: { temperature: 0, numCtx: 16384, maxTokens: 4096, think: false },
        },
      ],
      resamples: [{ config: { temperature: 0.35 } }],
    },
    selection: {
      jobs: [
        {
          job: {
            id: 'trained',
            condition: 'trained_committee',
            command: [
              '--committee-mini-model',
              'program2-sft-instruct-v2',
              '--committee-ollama-url',
              'http://127.0.0.1:11434',
            ],
          },
        },
      ],
    },
    sourceContract: {
      nativeApiChat: true,
      thinkFalse: true,
      numCtx: true,
      numPredict: true,
      sampleTemperature: true,
    },
    phase5c: { runtime: { artifact: 'program2-sft-instruct-v2 (Phase 4 verified-merge SFT, q8_0)' } },
  });
  assert.equal(checks.find((entry) => entry.id === 'distinct_model_layer_digests').pass, false);
  assert.equal(checks.find((entry) => entry.id === 'program2-sft-instruct-v2:template').pass, false);
});
