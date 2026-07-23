import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  TUTOR_STUB_RECIPE_OPTION_KEYS,
  TUTOR_STUB_SESSION_RECIPE_SCHEMA,
  applyTutorStubRecipeOptions,
  assertTutorStubResumeCompatibility,
  buildTutorStubSessionRecipe,
  compareTutorStubResumeRecipe,
  latestTutorStubResumeSource,
  normalizeTutorStubResumeTrace,
  readTutorStubSessionRecipe,
  resolveTutorStubResumeSource,
  tutorStubExactRelaunchCommand,
  writeTutorStubSessionRecipe,
} from '../services/tutorStubSessionRecipe.js';

function modelIdentity(ref, overrides = {}) {
  const [provider] = ref.split('.', 1);
  return {
    ref,
    provider,
    model: ref.slice(ref.indexOf('.') + 1),
    baseUrl: provider === 'codex' ? null : 'https://models.example/v1',
    cli: provider === 'codex',
    routingHash: `route-${provider}-${ref.slice(ref.indexOf('.') + 1)}`,
    ...overrides,
  };
}

function identity(overrides = {}) {
  return {
    schema: 'machinespirits.tutor-stub.session-runtime.v1',
    world: { id: 'world_005_marrick' },
    prompt: { systemPromptHash: 'prompt-a', tutorRolePromptHash: 'role-a' },
    tutor: { ref: 'dramatic-detective@v1', rolePromptHash: 'role-a' },
    models: {
      tutor: 'codex.gpt-5.6-terra',
      classifier: 'codex.gpt-5.6-sol',
      reasoning: 'codex.gpt-5.6-sol',
      learner: 'codex.gpt-5.6-terra',
    },
    ...overrides,
  };
}

function recipe(overrides = {}) {
  return buildTutorStubSessionRecipe({
    args: {
      world: 'world_005_marrick',
      tutor: 'dramatic-detective@v1',
      model: 'codex.gpt-5.6-terra',
      'classifier-model': 'codex.gpt-5.6-sol',
      'learner-record-model': 'codex.gpt-5.6-sol',
      'auto-learner-model': 'codex.gpt-5.6-terra',
      dag: true,
      ...overrides.args,
    },
    lab: 'human_scaffold',
    identity: identity(overrides.identity),
    createdAt: overrides.createdAt || '2026-07-23T00:00:00.000Z',
  });
}

test('recipe hash is deterministic and ignores creation time and presentation-only options', () => {
  const first = recipe({
    createdAt: '2026-07-23T00:00:00.000Z',
    args: {
      theme: 'dark',
      motion: 'full',
      'no-color': true,
      'no-stream': true,
      'trace-dir': '/tmp/not-semantic',
    },
  });
  const second = buildTutorStubSessionRecipe({
    args: {
      dag: true,
      'auto-learner-model': 'codex.gpt-5.6-terra',
      'learner-record-model': 'codex.gpt-5.6-sol',
      'classifier-model': 'codex.gpt-5.6-sol',
      model: 'codex.gpt-5.6-terra',
      tutor: 'dramatic-detective@v1',
      world: 'world_005_marrick',
    },
    lab: 'human_scaffold',
    identity: identity(),
    createdAt: '2030-01-01T00:00:00.000Z',
  });
  assert.equal(first.schema, TUTOR_STUB_SESSION_RECIPE_SCHEMA);
  assert.equal(first.configHash, second.configHash);
  assert.notEqual(first.createdAt, second.createdAt);
  assert.equal(Object.isFrozen(first), true);
});

test('recipe captures every semantic committee, pressure, and evaluation identity option', () => {
  const semantic = {
    'committee-mini-model': 'llama3.2:3b',
    'committee-ollama-url': 'http://127.0.0.1:11434',
    'committee-fallback-policy': 'v2',
    'pressure-turns': '3,6',
    'eval-repeat': '4',
    'eval-job-id': 'job-17',
  };
  const built = recipe({ args: semantic });
  for (const [key, value] of Object.entries(semantic)) {
    assert.equal(TUTOR_STUB_RECIPE_OPTION_KEYS.includes(key), true, key);
    assert.equal(built.config.options[key], value, key);
  }
});

test('recipe files verify their embedded hash and explicit identity overrides are reported', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-recipe-'));
  const filePath = writeTutorStubSessionRecipe({ recipe: recipe(), filePath: path.join(tmp, 'session.json') });
  const loaded = readTutorStubSessionRecipe(filePath);
  assert.equal(loaded.configHash, recipe().configHash);

  const target = { world: 'other-world', model: 'codex.gpt-5.6-terra' };
  const applied = applyTutorStubRecipeOptions(target, loaded, {
    optionProvided: (key) => key === 'world',
  });
  assert.equal(target.world, 'other-world');
  assert.equal(target.tutor, 'dramatic-detective@v1');
  assert.deepEqual(
    applied.explicitOverrides.map((entry) => entry.axis),
    ['world'],
  );

  const damaged = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  damaged.config.options.world = 'tampered';
  fs.writeFileSync(path.join(tmp, 'damaged.json'), `${JSON.stringify(damaged)}\n`);
  assert.throws(() => readTutorStubSessionRecipe(path.join(tmp, 'damaged.json')), /config hash mismatch/u);
});

test('explicit resume selectors beat mtime ordering and preserve trace input read-only', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-resume-'));
  const oldFile = path.join(tmp, 'run-old.jsonl');
  const newFile = path.join(tmp, 'run-new.jsonl');
  const writeTrace = (filePath, runId, learner) => {
    fs.writeFileSync(
      filePath,
      [
        JSON.stringify({ type: 'run_start', runId, metadata: { sessionRecipe: recipe() } }),
        JSON.stringify({ type: 'turn_complete', runId, turnRecord: { turn: 1, learner, tutor: 'reply' } }),
        '',
      ].join('\n'),
    );
  };
  writeTrace(oldFile, 'run-old', 'explicit');
  writeTrace(newFile, 'run-new', 'latest');
  const before = fs.readFileSync(oldFile, 'utf8');
  const now = Date.now() / 1000;
  fs.utimesSync(oldFile, now - 30, now - 30);
  fs.utimesSync(newFile, now, now);

  assert.equal(latestTutorStubResumeSource({ traceDir: tmp }).runId, 'run-new');
  assert.equal(resolveTutorStubResumeSource('run-old', { traceDir: tmp }).runId, 'run-old');
  assert.equal(resolveTutorStubResumeSource(oldFile, { traceDir: tmp }).turns[0].learner, 'explicit');
  assert.equal(fs.readFileSync(oldFile, 'utf8'), before);
});

test('legacy traces are normalized in memory without rewriting the source', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-legacy-resume-'));
  const filePath = path.join(tmp, 'legacy.jsonl');
  fs.writeFileSync(
    filePath,
    `${JSON.stringify({
      type: 'run_start',
      runId: 'legacy',
      metadata: {
        world: { id: 'world_005_marrick' },
        modelRef: 'codex.gpt-5.6-terra',
        tutorInstance: { activeRef: 'dramatic-detective@v1', rolePromptHash: 'role-a' },
      },
    })}\n${JSON.stringify({ type: 'turn_complete', turnRecord: { turn: 1, learner: 'L', tutor: 'T' } })}\n`,
  );
  const before = fs.readFileSync(filePath, 'utf8');
  const source = normalizeTutorStubResumeTrace(filePath);
  assert.equal(source.migration.mode, 'read_only_normalization');
  assert.equal(source.migration.sourceModified, false);
  assert.equal(source.recipe.config.options.world, 'world_005_marrick');
  assert.equal(source.turns.length, 1);
  assert.equal(fs.readFileSync(filePath, 'utf8'), before);
});

test('turn-only legacy traces remain resumable without rewriting the source', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-turn-only-resume-'));
  const filePath = path.join(tmp, 'turn-only.jsonl');
  fs.writeFileSync(
    filePath,
    `${JSON.stringify({
      type: 'turn_complete',
      runId: 'legacy-turn-only',
      turnRecord: { turn: 1, learner: 'L', tutor: 'T' },
    })}\n`,
  );
  const before = fs.readFileSync(filePath, 'utf8');
  const source = normalizeTutorStubResumeTrace(filePath);
  assert.equal(source.runId, 'legacy-turn-only');
  assert.equal(source.migration.from, 'legacy_turn_events');
  assert.equal(source.turns.length, 1);
  assert.equal(fs.readFileSync(filePath, 'utf8'), before);
});

test('world, prompt, tutor, model, and schema drift fail closed unless acknowledged', () => {
  const source = recipe();
  const current = recipe({
    args: { world: 'world_other', model: 'openai.mini' },
    identity: {
      schema: 'machinespirits.tutor-stub.session-runtime.v2',
      world: { id: 'world_other' },
      prompt: { systemPromptHash: 'prompt-b', tutorRolePromptHash: 'role-b' },
      tutor: { ref: 'other-tutor@v2', rolePromptHash: 'role-b' },
      models: {
        tutor: 'openai.mini',
        classifier: 'codex.gpt-5.6-sol',
        reasoning: 'codex.gpt-5.6-sol',
        learner: 'codex.gpt-5.6-terra',
      },
    },
  });
  const report = compareTutorStubResumeRecipe(source, current);
  assert.equal(report.ok, false);
  assert.deepEqual(
    report.drift.map((entry) => entry.axis),
    ['schema', 'world', 'prompt', 'tutor', 'tutor_prompt', 'model.tutor'],
  );
  assert.throws(() => assertTutorStubResumeCompatibility(report), /--acknowledge-drift/u);
  assert.equal(assertTutorStubResumeCompatibility(report, { acknowledgeDrift: true }), true);
});

test('resolved model identity detects alias remapping while legacy string recipes remain compatible', () => {
  const resolved = recipe({
    identity: {
      models: {
        tutor: modelIdentity('codex.gpt-5.6-terra'),
        classifier: modelIdentity('codex.gpt-5.6-sol'),
        reasoning: modelIdentity('codex.gpt-5.6-sol'),
        learner: modelIdentity('codex.gpt-5.6-terra'),
      },
    },
  });
  assert.equal(compareTutorStubResumeRecipe(recipe(), resolved).ok, true);

  const remapped = recipe({
    identity: {
      models: {
        tutor: modelIdentity('codex.gpt-5.6-terra', {
          model: 'gpt-5.7-terra',
          routingHash: 'route-codex-gpt-5.7-terra',
        }),
        classifier: modelIdentity('codex.gpt-5.6-sol'),
        reasoning: modelIdentity('codex.gpt-5.6-sol'),
        learner: modelIdentity('codex.gpt-5.6-terra'),
      },
    },
  });
  const report = compareTutorStubResumeRecipe(resolved, remapped);
  assert.equal(report.ok, false);
  assert.deepEqual(
    report.drift.map((entry) => entry.axis),
    ['model.tutor'],
  );
  assert.equal(report.drift[0].expected.ref, 'codex.gpt-5.6-terra');
  assert.equal(report.drift[0].actual.model, 'gpt-5.7-terra');
  assert.equal(Object.hasOwn(report.drift[0].expected, 'configured'), false);
  assert.equal(Object.hasOwn(report.drift[0].expected, 'apiKeyEnv'), false);
});

test('exact relaunch commands quote paths and combine explicit recipe and resume selectors', () => {
  assert.equal(
    tutorStubExactRelaunchCommand({ resume: '.tutor-stub-traces/run one.jsonl' }),
    "npm run tutor:stub -- --resume '.tutor-stub-traces/run one.jsonl'",
  );
  assert.equal(
    tutorStubExactRelaunchCommand({ recipePath: "recipes/learner's.json", resume: 'run-1' }),
    "npm run tutor:stub -- --recipe 'recipes/learner'\\''s.json' --resume 'run-1'",
  );
});
