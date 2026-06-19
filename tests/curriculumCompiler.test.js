import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import {
  compileCurriculumToWorldAdaptationSpec,
  computeWorldAdaptationSpecHash,
  compileCurriculumToDramaSpec,
  parseAiFoundationsMarkdown,
  validateCanonicalCurriculum,
  validateWorldAdaptationSpec,
} from '../services/curriculum/curriculumCompiler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const AI_FOUNDATIONS_MD = path.join(ROOT, 'curriculum', 'ai-foundations-adaptive-tutor-curriculum.md');

function loadCurriculum() {
  return parseAiFoundationsMarkdown(fs.readFileSync(AI_FOUNDATIONS_MD, 'utf8'), {
    sourcePath: 'curriculum/ai-foundations-adaptive-tutor-curriculum.md',
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('AI Foundations markdown converts to canonical curriculum graph', () => {
  const curriculum = loadCurriculum();
  validateCanonicalCurriculum(curriculum);

  assert.equal(curriculum.schema_version, 'ms-curriculum-v0.1');
  assert.equal(curriculum.id, 'ai_foundations_v1');
  assert.equal(curriculum.modules.length, 13);
  assert.equal(curriculum.modules[0].id, 'AF0');
  assert.equal(curriculum.modules[12].id, 'AF12');

  const module6 = curriculum.modules.find((module) => module.id === 'AF6');
  assert.ok(module6, 'expected Module 6');
  assert.ok(module6.knowledge_components.some((kc) => kc.id === 'AF-611'));
  assert.match(module6.primary_verifier, /metric engine/i);
  assert.ok(module6.misconception_signatures.some((signature) => /High accuracy/u.test(signature)));

  assert.ok(
    curriculum.associations.some(
      (association) =>
        association.from === 'AF5' && association.to === 'AF6' && association.relation === 'prerequisite_of',
    ),
  );
});

test('curriculum drama compiler emits runnable drama seeds with curriculum bindings', () => {
  const curriculum = loadCurriculum();
  const spec = compileCurriculumToDramaSpec(curriculum);

  assert.equal(spec.meta.schema_version, 'ms-curriculum-drama-v0.1');
  assert.equal(spec.dramas.length, 13);

  const module6Drama = spec.dramas.find((drama) => drama.curriculum_binding.module_id === 'AF6');
  assert.ok(module6Drama, 'expected AF6 drama');
  assert.equal(module6Drama.tutor_adaptation_policy, 'peripeteia');
  assert.equal(module6Drama.director_revisit_policy, 'reframe');
  assert.equal(module6Drama.curriculum_binding.curriculum_id, 'ai_foundations_v1');
  assert.ok(module6Drama.curriculum_binding.kc_ids.includes('AF-611'));
  assert.equal(module6Drama.curriculum_binding.world_adaptation_spec_id, 'W_AF6_CURRICULUM');
  assert.match(module6Drama.curriculum_binding.world_adaptation_spec_hash, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(module6Drama.curriculum_binding.world_locked_at_compile_time, true);
  assert.ok(
    module6Drama.curriculum_binding.world_public_constraints.preferred_action_families.includes(
      'repair_overconfidence',
    ),
  );
  assert.ok(
    module6Drama.curriculum_binding.world_public_constraints.success_observables.some((observable) =>
      /Learner/u.test(observable),
    ),
  );
  assert.ok(module6Drama.turn_plan.some((entry) => entry.role === 'tutor'));

  const worlds = compileCurriculumToWorldAdaptationSpec(curriculum, { mode: 'mvp' });
  const module6World = worlds.world_adaptation_specs.find((world) => world.module_id === 'AF6');
  assert.equal(module6Drama.curriculum_binding.world_adaptation_spec_hash, module6World.spec_hash);

  const reparsed = yaml.parse(yaml.stringify(spec));
  assert.equal(reparsed.dramas.length, spec.dramas.length);
});

test('MVP compilation selects the vertical-slice modules', () => {
  const curriculum = loadCurriculum();
  const spec = compileCurriculumToDramaSpec(curriculum, { mode: 'mvp' });
  const moduleIds = spec.dramas.map((drama) => drama.curriculum_binding.module_id);
  assert.deepEqual(moduleIds, ['AF1', 'AF4', 'AF5', 'AF6', 'AF11', 'AF12']);
});

test('curriculum world compiler emits locked MVP world adaptation specs', () => {
  const curriculum = loadCurriculum();
  const spec = compileCurriculumToWorldAdaptationSpec(curriculum);

  assert.equal(spec.meta.schema_version, 'ms-curriculum-worlds-v0.1');
  assert.equal(spec.meta.mode, 'mvp');
  assert.equal(spec.world_adaptation_specs.length, 6);

  const module6 = spec.world_adaptation_specs.find((world) => world.module_id === 'AF6');
  assert.ok(module6, 'expected AF6 world adaptation spec');
  assert.equal(module6.version, 'ms-world-adaptation-v0.1');
  assert.equal(module6.locked_at_compile_time, true);
  assert.match(module6.spec_hash, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(module6.spec_hash, computeWorldAdaptationSpecHash(module6));
  assert.ok(module6.action_policy.preferred_action_families.includes('repair_overconfidence'));
  assert.ok(module6.action_policy.disallowed_action_families.includes('model_worked_example'));
  assert.ok(module6.learner_state_evidence.misconception_signatures.length > 0);
  assert.ok(module6.expected_transitions.some((entry) => entry.action_type === 'request_evidence'));
  assert.equal(module6.outcome_observability.spec_is_not_evaluator, true);
  assert.equal(validateWorldAdaptationSpec(module6), true);

  const reparsed = yaml.parse(yaml.stringify(spec));
  assert.equal(reparsed.world_adaptation_specs.length, spec.world_adaptation_specs.length);
});

test('world adaptation spec hashes are deterministic and content-sensitive', () => {
  const curriculum = loadCurriculum();
  const first = compileCurriculumToWorldAdaptationSpec(curriculum);
  const second = compileCurriculumToWorldAdaptationSpec(curriculum);
  const firstHashes = first.world_adaptation_specs.map((world) => world.spec_hash);
  const secondHashes = second.world_adaptation_specs.map((world) => world.spec_hash);

  assert.deepEqual(firstHashes, secondHashes);

  const tampered = clone(first.world_adaptation_specs[0]);
  tampered.action_policy.preferred_action_families = ['request_evidence'];
  assert.notEqual(tampered.spec_hash, computeWorldAdaptationSpecHash(tampered));
  assert.throws(() => validateWorldAdaptationSpec(tampered), /spec_hash/u);
});

test('runnable world compilation requires verifier and misconception evidence', () => {
  const missingVerifier = clone(loadCurriculum());
  missingVerifier.modules.find((module) => module.id === 'AF1').primary_verifier = null;
  missingVerifier.modules.find((module) => module.id === 'AF1').verifiers = [];
  assert.throws(
    () => compileCurriculumToWorldAdaptationSpec(missingVerifier),
    /without verifier evidence/u,
  );

  const missingMisconception = clone(loadCurriculum());
  missingMisconception.modules.find((module) => module.id === 'AF1').misconception_signatures = [];
  assert.throws(
    () => compileCurriculumToWorldAdaptationSpec(missingMisconception),
    /without misconception evidence/u,
  );
});
