import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { projectTutorStubResponsePolicyContext } from '../services/tutorStubResponsePolicyContext.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function fullSelection() {
  return {
    engagement_stance: 'face_threat',
    activated_policy: 'continuous_dynamical_system',
    policy_composition: {
      policy_stack: 'field + state overlay',
      activated_overlay: 'state',
      overlay_threshold: 0.62,
    },
    legacy_selected_register: 'adversarial',
    valence: 'negative',
    request_type: 'answer_seeking_or_overreach',
    action_family: 'stage_next_step',
    addressee_profile: 'peer',
    audience_register: 'peer',
    lexical_accessibility: 'plain',
    scene_immersion: 'scene_grounded',
    actorial_part: 'skeptic',
    reviewer_signal: 'premature claim without warrant',
    register_reason: 'Controlled pressure tests whether the learner can defend the public edge.',
    temperature: 1.35,
    continuous_register_policy: {
      style_instruction: '  Keep the edge local to the claim, never the learner.  ',
    },
    register_vector: {
      warm: 0.25,
      precise: 0.25,
      brisk: 0.5,
    },
    expected_dag_move: 'Test the public warrant before accepting the verdict.',
    expected_field_move: 'Measure whether pressure changes accountable uptake.',
    simulated_only: true,
    unresolved_terms: ['warrant'],
    typed_action_decision: {
      chosen_action: {
        action_type: 'probe',
        move_family: 'test_warrant',
        support_level: 1,
        task_id: 'marrick-warrant-2',
        knowledge_component: 'evidence-to-claim relation',
        prerequisite_path: ['public clue', 'candidate claim'],
        item_difficulty: 'medium',
        expected_evidence: {
          success: ['names the clue', 'limits the inference'],
          failure: ['repeats the verdict'],
        },
        responsibility_owner: 'learner',
      },
    },
  };
}

test('response-policy context returns empty text without a selection', () => {
  assert.equal(projectTutorStubResponsePolicyContext(null), '');
  assert.equal(projectTutorStubResponsePolicyContext(undefined), '');
});

test('full response-policy context is byte-exact and leaves its inputs untouched', () => {
  const selection = deepFreeze(fullSelection());
  const options = deepFreeze({
    multipleChoice: true,
    humanDiscourseFrame: {
      generousInference: {
        applied: true,
      },
    },
    dialogueClosureFrame: {
      mandatory: true,
      available: true,
    },
    world: {
      title: 'The Light Shillings',
      presentation: {
        ledger_term: 'trial-book',
      },
    },
    ledgerTerm: 'trial-book',
  });
  const before = structuredClone({ selection, options });
  const context = projectTutorStubResponsePolicyContext(selection, options);

  assert.equal(Buffer.byteLength(context), 6561);
  assert.equal(sha256(context), '46df548034fca17c8df538c61bb5ec41169b70819130678cc5891df65838cac1');
  assert.deepEqual({ selection, options }, before);
  assert.match(context, /\[Tutor-only typed pedagogical action\][\s\S]*Action type: probe/u);
  assert.match(context, /Continuous register vector: brisk 50%, precise 25%, warm 25%/u);
  assert.match(context, /Keep the edge local to the claim, never the learner\./u);
  assert.match(context, /Forbidden phrase families: obviously you, even you/u);
  assert.match(context, /This is a simulated-only register/u);
  assert.match(context, /write their own trial-book line/u);
  assert.match(context, /or trial-book version of the same answer/u);
  assert.match(context, /Dialogue-closure override: the proof is complete for this dialogue/u);
  assert.ok(
    context.indexOf('[Tutor-only typed pedagogical action]') < context.indexOf('[Tutor-only response-policy evidence]'),
  );
});

test('response-policy context preserves policy-specific move labels and continuous blend precedence', () => {
  const cases = [
    ['state', 'Expected learner-state move'],
    ['trajectory', 'Expected learner-trajectory move'],
    ['dynamical_system', 'Expected learner-dynamical move'],
    ['empirical_dynamical_system', 'Expected learner-dynamical move'],
    ['continuous_dynamical_system', 'Expected learner-dynamical move'],
    ['continuous_empirical_dynamical_system', 'Expected learner-dynamical move'],
    ['field', 'Expected learner-field move'],
  ];
  for (const [policy, label] of cases) {
    const selection = {
      ...fullSelection(),
      activated_policy: policy,
      continuous_register_policy: {
        dominant_blend: 'brisk + precise',
        style_instruction: '',
      },
    };
    const context = projectTutorStubResponsePolicyContext(selection);
    assert.match(context, new RegExp(`${label}: Measure whether pressure changes accountable uptake\\.`));
    assert.match(context, /Continuous register vector: brisk \+ precise/u);
    assert.doesNotMatch(context, /Continuous register vector: brisk 50%/u);
  }
});

test('an explicit response configuration remains authoritative over selection fallbacks', () => {
  const selection = {
    ...fullSelection(),
    action_family: 'stage_next_step',
    response_configuration: {
      engagement_stance: 'plain',
      action_family: 'answer_accountably',
      addressee_profile: 'peer',
      lexical_accessibility: 'plain',
      scene_immersion: 'scene_grounded',
      actorial_part: 'examiner',
      unresolved_terms: [],
    },
  };
  const context = projectTutorStubResponsePolicyContext(selection, {
    dialogueClosureFrame: { available: true },
  });

  assert.match(context, /\[Tutor-only response configuration\][\s\S]*Action family: answer_accountably\./u);
  assert.match(context, /\[Tutor-only response-policy evidence\][\s\S]*Action family: stage_next_step/u);
  assert.match(context, /Dialogue-closure override: the authored public proof is complete/u);
  assert.doesNotMatch(context, /Human-scaffold override/u);
});

test('the CLI retains authorial ledger resolution, runtime call sites, and prompt ownership', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubResponsePolicyContext.js'), 'utf8');
  const learnerRuntimeSource = fs.readFileSync(
    path.join(ROOT, 'services', 'tutorStubInteractiveLearnerRuntime.js'),
    'utf8',
  );
  const compositionSource = fs.readFileSync(
    path.join(ROOT, 'services', 'tutorStubInteractiveApplicationComposition.js'),
    'utf8',
  );
  const wrapper = cliSource.slice(
    cliSource.indexOf('function responseConfigurationContext'),
    cliSource.indexOf('function registerTemperatureApplies'),
  );

  assert.match(cliSource, /from '\.\.\/services\/tutorStubResponsePolicyContext\.js';/u);
  assert.match(wrapper, /projectTutorStubResponsePolicyContext/u);
  assert.match(wrapper, /ledgerTerm: worldLedgerTerm\(world\)/u);
  assert.match(cliSource, /createTutorStubInteractiveApplicationComposition/u);
  assert.match(compositionSource, /createTutorStubInteractiveLearnerRuntime/u);
  assert.match(learnerRuntimeSource, /register: responseConfigurationContext\(registerSelection/u);
  assert.match(serviceSource, /normalizeTutorStubResponseConfiguration/u);
  assert.match(serviceSource, /tutorStubResponseConfigurationPrompt/u);
  assert.doesNotMatch(serviceSource, /\b(?:spawnSync|fs|console|process|fetch|Date\.now)\s*[.(]/u);
});
