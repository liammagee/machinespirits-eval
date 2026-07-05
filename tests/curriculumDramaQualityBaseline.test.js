import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import yaml from 'yaml';
import {
  checkCurriculumDramaQualityBaseline,
  initialStageLineCount,
  publicLeakFindings,
} from '../scripts/check-curriculum-drama-quality-baseline.js';
import { makeCallTelemetryRecorder, wrapLlmCallWithTelemetry } from '../scripts/generate-pedagogical-dramas.js';

function writeBaselineFixture({ publicText, itemPatch = {}, keyPatch = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-drama-quality-'));
  const transcriptsDir = path.join(dir, 'transcripts');
  fs.mkdirSync(transcriptsDir);
  fs.writeFileSync(
    path.join(transcriptsDir, 'T01.public.txt'),
    publicText ||
      [
        'STAGE: [A review desk with the submitted model card, risk register, and oversight plan open.]',
        '',
        'LEARNER: "I still think one fairness number should be enough."',
        '',
        'TUTOR: "Show which stakeholder is protected by that number, and which harm remains outside it."',
      ].join('\n'),
    'utf8',
  );
  const key = {
    transcripts_dir: transcriptsDir,
    quality_blocking_warning_count: 0,
    items: {
      T01: {
        drama_id: 'D_AF1_CURRICULUM_ADAPTIVE',
        curriculum_binding: {
          curriculum_id: 'ai_foundations_v1',
          module_id: 'AF1',
        },
        world_adaptation: {
          spec_id: 'W_AF1_CURRICULUM',
          spec_hash: `sha256:${'a'.repeat(64)}`,
          locked_at_compile_time: true,
        },
        rhetorical_dramatic_plan: {
          plan_id: 'RDP_AF1_CURRICULUM_ADAPTIVE',
          plan_hash: `sha256:${'b'.repeat(64)}`,
        },
        curriculum_script_notes: {
          rhetoric: { public_task: 'Name the evidence pressure.' },
          script_lowering: { dramatic_shape: 'claim -> pressure -> repair' },
        },
        opening_speaker: 'learner',
        quality_status: 'ok',
        quality_warnings: [{ code: 'stage_direction_leak_stripped', severity: 'info' }],
        ...itemPatch,
      },
    },
    ...keyPatch,
  };
  const keyPath = path.join(dir, 'key.yaml');
  fs.writeFileSync(keyPath, yaml.stringify(key), 'utf8');
  return { dir, keyPath, transcriptsDir };
}

test('curriculum drama quality baseline accepts a locked public-safe artifact', () => {
  const { keyPath } = writeBaselineFixture();
  const result = checkCurriculumDramaQualityBaseline({ keyPath, requireWorld: true });
  assert.equal(result.pass, true);
  assert.deepEqual(result.failures, []);
});

test('curriculum drama quality baseline rejects public hidden-contract leakage', () => {
  const { keyPath } = writeBaselineFixture({
    publicText: [
      'STAGE: [A review desk.]',
      '',
      'LEARNER: "The world adaptation spec hash is sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa."',
    ].join('\n'),
  });
  const result = checkCurriculumDramaQualityBaseline({ keyPath, requireWorld: true });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((failure) => failure.code === 'public_hidden_leak'));
  assert.ok(publicLeakFindings('W_AF1_CURRICULUM').includes('world_spec_id_leak'));
});

test('curriculum drama quality baseline rejects repeated initial stage-note lines', () => {
  const { keyPath } = writeBaselineFixture({
    publicText: [
      'STAGE: [REVIEW SESSION.]',
      'STAGE: [Setting: A governance checkpoint.]',
      '',
      'LEARNER: "I still think one number is enough."',
    ].join('\n'),
  });
  const result = checkCurriculumDramaQualityBaseline({ keyPath, requireWorld: true });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((failure) => failure.code === 'stage_preamble_not_consolidated'));
  assert.equal(initialStageLineCount('STAGE: [One.]\nSTAGE: [Two.]\nLEARNER: "Go."'), 2);
});

test('curriculum drama quality baseline rejects missing world provenance and opening-speaker mismatch', () => {
  const { keyPath } = writeBaselineFixture({
    itemPatch: {
      world_adaptation: null,
      opening_speaker: 'tutor',
    },
  });
  const result = checkCurriculumDramaQualityBaseline({
    keyPath,
    requireWorld: true,
    expectOpeningSpeaker: 'learner',
  });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((failure) => failure.code === 'missing_world_adaptation'));
  assert.ok(result.failures.some((failure) => failure.code === 'opening_speaker_mismatch'));
});

test('call telemetry wrapper records hashes and counts without raw prompt text', async () => {
  const recorder = makeCallTelemetryRecorder({ enabled: true });
  const wrapped = wrapLlmCallWithTelemetry(
    async (_model, _systemPrompt, _messages, opts = {}) => ({
      content: 'visible output',
      provider: 'test-provider',
      model: 'test/model',
      latencyMs: 3,
      provenance: {
        agentRole: opts.agentRole,
        backend: 'test-backend',
        cli: 'test-cli',
        model: 'test/model',
        reasoningEffort: 'low',
        latencyMs: 3,
        worker: {
          persistent: true,
          key: 'director:test:model:abcdef',
          reused: true,
          created: false,
          disabledReason: null,
        },
      },
    }),
    recorder,
  );

  await wrapped('ignored-model', 'secret system prompt', [{ content: 'private user prompt' }], {
    agentRole: 'director',
  });

  assert.equal(recorder.records.length, 1);
  assert.equal(recorder.records[0].role, 'director');
  assert.equal(recorder.records[0].prompt_chars.system, 'secret system prompt'.length);
  assert.equal(recorder.records[0].output_chars, 'visible output'.length);
  assert.equal(recorder.records[0].worker.reused, true);
  const serialized = JSON.stringify(recorder.records);
  assert.equal(serialized.includes('secret system prompt'), false);
  assert.equal(serialized.includes('private user prompt'), false);
  assert.equal(serialized.includes('visible output'), false);
});
