import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  LOCAL_LEARNER_SPEC_SCHEMA,
  buildLocalLearnerBehaviorPrompt,
  buildLocalLearnerChildEnv,
  buildTutorStubArgs,
  discoverLoadedModel,
  normalizeLocalLearnerSpec,
  readLocalLearnerSpec,
} from '../scripts/run-local-qwen-resistant-learner.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = path.join(
  ROOT,
  'config',
  'tutor-stub-local-learners',
  'qwen-abliterated-frame-defiant.v1.yaml',
);
const PROGRESSIVE_SPEC_PATH = path.join(
  ROOT,
  'config',
  'tutor-stub-local-learners',
  'qwen-abliterated-frame-defiant-progressive.v1.yaml',
);
const SUPEREGO_SPEC_PATH = path.join(
  ROOT,
  'config',
  'tutor-stub-local-learners',
  'qwen-abliterated-frame-defiant-luna-superego.v1.yaml',
);

test('the tracked Qwen learner spec surfaces behavior, character, tone, route, and a bounded run', () => {
  const spec = readLocalLearnerSpec(SPEC_PATH);
  assert.equal(spec.profile, 'frame_defiant');
  assert.equal(spec.character.name, 'Tamsin');
  assert.match(spec.tone.description, /Plainspoken, clipped, skeptical/u);
  assert.equal(spec.models.tutor, 'codex.gpt-5.6-luna');
  assert.equal(spec.models.learner, 'mlx-local.qwen-abliterated-27b');
  assert.equal(spec.run.turns, 4);
  assert.equal(spec.run.modelCallBudget, 10);
  assert.equal(spec.run.plannedModelCalls, 8);
  assert.equal(spec.generation.systemPromptStyle, 'standard');
  assert.equal(spec.generation.deliberation.mode, 'direct');
  assert.match(spec.claimBoundary, /does not establish learner-profile transportability/u);

  const prompt = buildLocalLearnerBehaviorPrompt(spec);
  assert.match(prompt, /automated learner profile: frame_defiant/u);
  assert.match(prompt, /Name: Tamsin/u);
  assert.match(prompt, /Use at most 2 sentences/u);
  assert.match(prompt, /never weaken the recurring behavior/u);

  const args = buildTutorStubArgs(spec, { savePath: '/tmp/local-qwen-smoke.json' });
  assert.equal(args[args.indexOf('--lab') + 1], 'learner_role_smoke');
  assert.equal(args[args.indexOf('--model') + 1], 'codex.gpt-5.6-luna');
  assert.equal(args[args.indexOf('--auto-learner-model') + 1], 'mlx-local.qwen-abliterated-27b');
  assert.equal(args[args.indexOf('--model-call-budget') + 1], '10');
  assert.equal(args.includes('--no-auto-stop-on-grounded'), true);
});

test('local learner spec rejects remote endpoints and underfunded plans before launch', () => {
  const base = {
    schema: LOCAL_LEARNER_SPEC_SCHEMA,
    id: 'test',
    profile: 'frame_defiant',
    character: { name: 'T', role: 'apprentice', situation: 'under pressure', commitments: ['stay skeptical'] },
    tone: { description: 'short', max_sentences: 2, avoid: ['insults'] },
    scenario: { world: 'world_005_marrick', tutor: 'dramatic-detective@v1' },
    models: { tutor: 'codex.gpt-5.6-luna', learner: 'mlx-local.qwen-abliterated-27b' },
    run: { turns: 4, model_call_budget: 10, stop_on_grounded: false },
    local_service: {
      base_url: 'http://127.0.0.1:8080/v1',
      profile: 'uncensored',
      model_id_contains: 'Qwen3.8-27B-Uncensored-MLX/4-bit',
    },
    claim_boundary: 'feasibility only',
  };
  assert.throws(
    () =>
      normalizeLocalLearnerSpec({
        ...base,
        local_service: { ...base.local_service, base_url: 'https://example.com/v1' },
      }),
    /loopback host/u,
  );
  assert.throws(
    () => normalizeLocalLearnerSpec({ ...base, run: { ...base.run, model_call_budget: 7 } }),
    /planned 8 model calls/u,
  );
});

test('progressive and Luna-superego specs expose bounded generation mechanisms', () => {
  const progressive = readLocalLearnerSpec(PROGRESSIVE_SPEC_PATH);
  assert.equal(progressive.generation.systemPromptStyle, 'progressive_resistance_v1');
  assert.equal(progressive.generation.deliberation.mode, 'direct');
  assert.equal(progressive.run.plannedModelCalls, 8);
  assert.equal(progressive.run.modelCallBudget, 10);

  const superego = readLocalLearnerSpec(SUPEREGO_SPEC_PATH);
  assert.equal(superego.generation.systemPromptStyle, 'progressive_resistance_v1');
  assert.equal(superego.generation.deliberation.mode, 'ego_superego');
  assert.equal(superego.generation.deliberation.superegoModel, 'codex.gpt-5.6-luna');
  assert.equal(superego.generation.deliberation.superegoPromptStyle, 'authenticity_progress_v1');
  assert.equal(superego.run.plannedModelCalls, 16);
  assert.equal(superego.run.modelCallBudget, 18);

  const childEnv = buildLocalLearnerChildEnv(superego, {
    baseEnv: { PATH: '/test/bin' },
    localModelId: '/models/qwen-abliterated',
  });
  assert.equal(childEnv.PATH, '/test/bin');
  assert.equal(childEnv.MLX_LOCAL_AI_MODEL, '/models/qwen-abliterated');
  assert.equal(childEnv.TUTOR_STUB_AUTO_LEARNER_SYSTEM_STYLE, 'progressive_resistance_v1');
  assert.equal(childEnv.TUTOR_STUB_AUTO_LEARNER_DELIBERATION, 'ego_superego');
  assert.equal(childEnv.TUTOR_STUB_AUTO_LEARNER_SUPEREGO_MODEL, 'codex.gpt-5.6-luna');
  assert.equal(childEnv.TUTOR_STUB_AUTO_LEARNER_SUPEREGO_STYLE, 'authenticity_progress_v1');
  assert.equal(childEnv.TUTOR_STUB_AUTO_LEARNER_SUPEREGO_EFFORT, 'low');
});

test('learner ego-superego specs fail closed when their full call plan or reviewer is missing', () => {
  const base = {
    schema: LOCAL_LEARNER_SPEC_SCHEMA,
    id: 'test-superego',
    profile: 'frame_defiant',
    character: { name: 'T', role: 'apprentice', situation: 'under pressure', commitments: ['stay skeptical'] },
    tone: { description: 'short', max_sentences: 2, avoid: ['insults'] },
    scenario: { world: 'world_005_marrick', tutor: 'dramatic-detective@v1' },
    models: { tutor: 'codex.gpt-5.6-luna', learner: 'mlx-local.qwen-abliterated-27b' },
    generation: {
      system_prompt_style: 'progressive_resistance_v1',
      deliberation: {
        mode: 'ego_superego',
        superego_model: 'codex.gpt-5.6-luna',
        superego_prompt_style: 'authenticity_progress_v1',
      },
    },
    run: { turns: 4, model_call_budget: 16, stop_on_grounded: false },
    local_service: {
      base_url: 'http://127.0.0.1:8080/v1',
      profile: 'uncensored',
      model_id_contains: 'Qwen3.8-27B-Uncensored-MLX/4-bit',
    },
    claim_boundary: 'feasibility only',
  };
  assert.equal(normalizeLocalLearnerSpec(base).run.plannedModelCalls, 16);
  assert.throws(
    () => normalizeLocalLearnerSpec({ ...base, run: { ...base.run, model_call_budget: 15 } }),
    /planned 16 model calls/u,
  );
  assert.throws(
    () =>
      normalizeLocalLearnerSpec({
        ...base,
        generation: { ...base.generation, deliberation: { ...base.generation.deliberation, superego_model: '' } },
      }),
    /generation\.deliberation\.superego_model must be a non-empty string/u,
  );
});

test('loaded MLX model discovery selects one configured runtime model id', async () => {
  const fetchImpl = async (url) => ({
    ok: true,
    json: async () => ({
      data: [
        { id: 'mlx-community/Qwen3.8-27B-4bit' },
        { id: 'mlx-community/Qwen3.8-27B-MTP-4bit' },
        { id: '/models/Qwen3.8-27B-Uncensored-MLX/4-bit' },
      ],
    }),
    url,
  });
  const model = await discoverLoadedModel('http://127.0.0.1:8080/v1', {
    modelIdContains: 'Qwen3.8-27B-Uncensored-MLX/4-bit',
    fetchImpl,
  });
  assert.equal(model, '/models/Qwen3.8-27B-Uncensored-MLX/4-bit');

  await assert.rejects(
    discoverLoadedModel('http://127.0.0.1:8080/v1', {
      modelIdContains: 'missing-model',
      fetchImpl,
    }),
    /expected exactly one loaded local model matching missing-model/u,
  );
});
