import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DRAMA_FUNCTIONAL_COMPONENTS,
  DRAMA_FUNCTIONAL_COMPONENT_ORDER,
  DRAMA_PARAMETER_COMPONENTS,
  DRAMA_PARAMETER_COMPONENT_ORDER,
  DRAMA_PARAMETER_FIELDS,
  RUN_PARAM_FUNCTIONAL_COMPONENT_BY_NAME,
  RUN_PARAM_COMPONENT_BY_NAME,
  buildComposerVocab,
  componentForRunParam,
  dramaFunctionalComponent,
  dramaParameterComponent,
  fieldsForFunctionalComponent,
  fieldsForComponent,
  functionalComponentsForField,
  functionalComponentsForRunParam,
} from '../services/poetics/dramaParameters.js';

const COMPONENT_IDS = DRAMA_PARAMETER_COMPONENTS.map((component) => component.id);
const FUNCTIONAL_COMPONENT_IDS = DRAMA_FUNCTIONAL_COMPONENTS.map((component) => component.id);
const FIELD_PATHS = new Set(DRAMA_PARAMETER_FIELDS.map((field) => field.path));

test('drama parameter components are the small shared Scriptorium vocabulary', () => {
  assert.deepEqual(COMPONENT_IDS, ['matter', 'form', 'agents', 'scene', 'cast', 'audience', 'runtime']);
  assert.deepEqual(DRAMA_PARAMETER_COMPONENT_ORDER, COMPONENT_IDS);
  assert.ok(Object.isFrozen(DRAMA_PARAMETER_COMPONENTS));
  assert.ok(Object.isFrozen(DRAMA_PARAMETER_COMPONENTS[0]));
});

test('every drama-machine field is assigned to a valid component and surface', () => {
  assert.ok(DRAMA_PARAMETER_FIELDS.length > 50, 'the catalog should cover the broad drama spec surface');
  for (const field of DRAMA_PARAMETER_FIELDS) {
    assert.ok(COMPONENT_IDS.includes(field.component), `${field.path} uses an unknown component`);
    assert.ok(Array.isArray(field.surfaces) && field.surfaces.length > 0, `${field.path} should name a surface`);
  }

  assert.ok(fieldsForComponent('form', { surface: 'compose' }).some((field) => field.path === 'turn_plan'));
  assert.ok(fieldsForComponent('audience', { surface: 'run' }).some((field) => field.path === 'audience.panel'));
});

test('drama functional components name the architecture-facing subsystems', () => {
  assert.deepEqual(FUNCTIONAL_COMPONENT_IDS, [
    'recognition',
    'superego_critic',
    'adaptation',
    'proof_dag',
    'cast_layer',
    'audience_critic',
    'run_orchestration',
  ]);
  assert.deepEqual(DRAMA_FUNCTIONAL_COMPONENT_ORDER, FUNCTIONAL_COMPONENT_IDS);
  assert.ok(Object.isFrozen(DRAMA_FUNCTIONAL_COMPONENTS));
  assert.ok(Object.isFrozen(DRAMA_FUNCTIONAL_COMPONENTS[0]));

  for (const component of DRAMA_FUNCTIONAL_COMPONENTS) {
    for (const parameterComponent of component.parameterComponents) {
      assert.ok(
        COMPONENT_IDS.includes(parameterComponent),
        `${component.id} references unknown facet ${parameterComponent}`,
      );
    }
    for (const path of component.fieldPaths) {
      assert.ok(FIELD_PATHS.has(path), `${component.id} references unknown field ${path}`);
    }
  }
});

test('composer vocab composes fixed drama vocab with live learner vocab', () => {
  const vocab = buildComposerVocab({
    personas: ['test_persona'],
    learnerArch: ['test_architecture'],
  });

  assert.ok(Object.isFrozen(vocab));
  assert.deepEqual(vocab.personas, ['test_persona']);
  assert.deepEqual(vocab.learnerArch, ['test_architecture']);
  assert.ok(vocab.forms.includes('peripeteia'));
  assert.ok(vocab.adaptationPolicy.includes('socratic_discovery'));
  assert.ok(vocab.adaptationPolicy.includes('withhold_secret'));
  assert.equal(vocab.components.length, DRAMA_PARAMETER_COMPONENTS.length);
  assert.equal(vocab.functionalComponents.length, DRAMA_FUNCTIONAL_COMPONENTS.length);
  assert.deepEqual(vocab.functionalComponentOrder, DRAMA_FUNCTIONAL_COMPONENT_ORDER);
});

test('run launcher parameter names resolve to stable components', () => {
  assert.equal(componentForRunParam('spec'), 'matter');
  assert.equal(componentForRunParam('generator'), 'cast');
  assert.equal(componentForRunParam('critic'), 'audience');
  assert.equal(componentForRunParam('dramaturgy'), 'form');
  assert.equal(componentForRunParam('superego'), 'agents');
  assert.equal(componentForRunParam('maxTurns'), 'runtime');
  assert.equal(componentForRunParam('unknown_future_toggle'), 'runtime');

  for (const [name, component] of Object.entries(RUN_PARAM_COMPONENT_BY_NAME)) {
    assert.ok(COMPONENT_IDS.includes(component), `${name} maps to an unknown component`);
  }
});

test('run launcher parameter names resolve to stable functional components', () => {
  assert.deepEqual(functionalComponentsForRunParam('world'), ['proof_dag']);
  assert.deepEqual(functionalComponentsForRunParam('labels'), ['proof_dag']);
  assert.deepEqual(functionalComponentsForRunParam('rubrics'), ['audience_critic']);
  assert.deepEqual(functionalComponentsForRunParam('judgeCli'), ['audience_critic']);
  assert.deepEqual(functionalComponentsForRunParam('superego'), ['superego_critic']);
  assert.deepEqual(functionalComponentsForRunParam('generator'), ['cast_layer']);
  assert.deepEqual(functionalComponentsForRunParam('critic'), ['audience_critic']);
  assert.deepEqual(functionalComponentsForRunParam('unknown_future_toggle'), ['run_orchestration']);

  assert.equal(RUN_PARAM_FUNCTIONAL_COMPONENT_BY_NAME.world, 'proof_dag');
  assert.equal(RUN_PARAM_FUNCTIONAL_COMPONENT_BY_NAME.labels, 'proof_dag');
  assert.equal(RUN_PARAM_FUNCTIONAL_COMPONENT_BY_NAME.critic, 'audience_critic');
  assert.equal(RUN_PARAM_FUNCTIONAL_COMPONENT_BY_NAME.judgeCli, 'audience_critic');

  for (const [name, component] of Object.entries(RUN_PARAM_FUNCTIONAL_COMPONENT_BY_NAME)) {
    assert.ok(FUNCTIONAL_COMPONENT_IDS.includes(component), `${name} maps to an unknown functional component`);
  }
});

test('component lookup falls back to runtime for forward-compatible callers', () => {
  assert.equal(dramaParameterComponent('matter').label, 'Learning matter');
  assert.equal(dramaParameterComponent('new-later').id, 'runtime');
});

test('functional lookup exposes related fields without guessing from labels', () => {
  assert.equal(dramaFunctionalComponent('recognition').label, 'Recognition');
  assert.equal(dramaFunctionalComponent('new-later'), null);
  assert.ok(functionalComponentsForField('drama.tutor.recognition_mode').includes('recognition'));
  assert.ok(
    fieldsForFunctionalComponent('recognition', { surface: 'compose' }).some(
      (field) => field.path === 'drama.tutor.recognition_mode',
    ),
  );
  assert.ok(fieldsForFunctionalComponent('proof_dag').some((field) => field.path === 'drama.secret.premise_ledger'));
});
