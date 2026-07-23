import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_TUTOR_STUB_MODEL_CALL_BUDGET,
  TUTOR_STUB_LAB_CATALOG_VERSION,
  assertTutorStubLabCatalogInvariants,
  assertTutorStubLabRequirements,
  createTutorStubModelCallBudget,
  formatTutorStubLabList,
  getTutorStubLab,
  listTutorStubLabs,
  resolveTutorStubLab,
  resolveTutorStubMeteredLabAdmission,
  tutorStubLabTraceMetadata,
} from '../services/tutorStubLabs.js';

test('v1 lab catalog exposes the ten declared labs through public-safe projections', () => {
  const labs = listTutorStubLabs();
  assert.equal(TUTOR_STUB_LAB_CATALOG_VERSION, 1);
  assert.equal(labs.length, 10);
  assert.deepEqual(
    labs.map((entry) => entry.id),
    [
      'pure_chat',
      'human_scaffold',
      'mixed_drafting',
      'coaching',
      'feedback_tuning',
      'voice',
      'curriculum',
      'labelling',
      'automated_eval',
      'research_controls',
    ],
  );
  assert.equal(Object.isFrozen(labs), true);
  assert.equal(Object.isFrozen(labs[0]), true);
  assert.equal('cliDefaults' in labs[0], false);
  assert.equal('requiredOptions' in labs[0], false);
  for (const entry of labs) {
    assert.equal(resolveTutorStubLab(entry.id).lab.id, entry.id);
  }
  assert.equal(assertTutorStubLabCatalogInvariants(), true);
});

test('learner-safe catalog never silently enables a simulated learner or negative control', () => {
  const labs = listTutorStubLabs({ audience: 'learner_safe' });
  assert.deepEqual(
    labs.map((entry) => entry.id),
    ['pure_chat', 'human_scaffold', 'mixed_drafting', 'coaching', 'voice', 'curriculum'],
  );
  for (const entry of labs) {
    const resolution = resolveTutorStubLab(entry.id);
    assert.notEqual(resolution.cliOptions['register-policy'], 'negative');
    assert.notEqual(resolution.cliOptions['register-policy'], 'random');
    assert.notEqual(resolution.cliOptions['auto-learner'], true);
  }
  assert.equal(getTutorStubLab('research_controls').audience, 'research');
  assert.equal(resolveTutorStubLab('research_controls').cliOptions['register-policy'], 'negative');

  const unsafe = resolveTutorStubLab('human_scaffold', {
    overrides: {
      world: 'world_005_marrick',
      'auto-learner': true,
      'register-policy': 'negative',
    },
  });
  assert.deepEqual(
    unsafe.conflictViolations.map((entry) => entry.code),
    ['simulated_learner', 'unsafe_register_policy'],
  );
  assert.throws(
    () => assertTutorStubLabRequirements(unsafe, unsafe.cliOptions),
    /--auto-learner is research-only.*--register-policy negative is not learner-safe/u,
  );
});

test('lab resolution is model-free, immutable, capability-aware, and trace-ready', () => {
  const resolution = resolveTutorStubLab('mixed_drafting', { overrides: { world: 'world_005_marrick' } });
  assert.equal(resolution.lab.maturity, 'stable');
  assert.equal(resolution.cliOptions['mixed-learner'], true);
  assert.equal(resolution.capabilities.active.includes('mixed_drafting'), true);
  assert.equal(resolution.capabilities.active.includes('learner_reasoning'), true);
  assert.equal(resolution.costClass, 'medium');
  assert.equal(Object.isFrozen(resolution), true);

  const metadata = tutorStubLabTraceMetadata(resolution);
  assert.deepEqual(metadata.resolvedCapabilities, resolution.capabilities.active);
  assert.equal(metadata.id, 'mixed_drafting');
  assert.equal(metadata.maturity, 'stable');
  assert.equal(metadata.costClass, 'medium');
  assert.equal(metadata.modelCalls.roles.includes('learner_draft'), true);
});

test('labs with external selections fail before launch when required options are absent', () => {
  const curriculum = resolveTutorStubLab('curriculum');
  assert.deepEqual(curriculum.missingOptions, ['curriculum']);
  assert.throws(() => assertTutorStubLabRequirements(curriculum, curriculum.cliOptions), /--curriculum <value>/u);
  assert.equal(assertTutorStubLabRequirements(curriculum, { ...curriculum.cliOptions, curriculum: 'workplan' }), true);

  const labelling = resolveTutorStubLab('labelling');
  assert.throws(
    () => assertTutorStubLabRequirements(labelling, { ...labelling.cliOptions, 'label-dataset': 'superego-taxonomy' }),
    /--label-coder <value>/u,
  );
});

test('metered research labs require and enforce finite model-call admission before launch', () => {
  const missing = resolveTutorStubLab('automated_eval');
  assert.deepEqual(missing.missingOptions, ['model-call-budget']);
  assert.throws(() => assertTutorStubLabRequirements(missing, missing.cliOptions), /--model-call-budget <value>/u);

  for (const value of ['0', '-1', '1.5', 'unbounded', String(MAX_TUTOR_STUB_MODEL_CALL_BUDGET + 1)]) {
    const resolution = resolveTutorStubLab('automated_eval', { overrides: { 'model-call-budget': value } });
    assert.throws(() => assertTutorStubLabRequirements(resolution, resolution.cliOptions), /model-call-budget/u);
  }

  const admittedResolution = resolveTutorStubLab('automated_eval', {
    overrides: { 'model-call-budget': '2' },
  });
  assert.equal(assertTutorStubLabRequirements(admittedResolution, admittedResolution.cliOptions), true);
  const admission = resolveTutorStubMeteredLabAdmission(admittedResolution, admittedResolution.cliOptions);
  assert.equal(admission.modelCallBudget, 2);
  assert.equal(admission.researchUseAcknowledged, false);
  assert.throws(
    () => createTutorStubModelCallBudget({ metered: true, modelCallBudget: 2 }),
    /metered lab admission must use/u,
  );
  const budget = createTutorStubModelCallBudget(admission);
  assert.deepEqual(budget.reserve({ role: 'tutor', turn: 1 }), {
    labId: 'automated_eval',
    role: 'tutor',
    turn: 1,
    call: 1,
    limit: 2,
    remaining: 1,
  });
  budget.reserve({ role: 'learner_reasoning', turn: 1 });
  assert.throws(
    () => budget.reserve({ role: 'automated_learner', turn: 1 }),
    (error) => error.code === 'model_call_budget_exhausted',
  );
  assert.deepEqual(budget.snapshot(), { labId: 'automated_eval', used: 2, limit: 2, remaining: 0 });

  const research = resolveTutorStubLab('research_controls', {
    overrides: { 'model-call-budget': '6' },
  });
  assert.deepEqual(research.missingOptions, ['acknowledge-research-use']);
  assert.throws(() => assertTutorStubLabRequirements(research, research.cliOptions), /--acknowledge-research-use/u);
  const acknowledged = resolveTutorStubLab('research_controls', {
    overrides: { 'model-call-budget': '6', 'acknowledge-research-use': true },
  });
  assert.equal(assertTutorStubLabRequirements(acknowledged, acknowledged.cliOptions), true);
  assert.equal(
    resolveTutorStubMeteredLabAdmission(acknowledged, acknowledged.cliOptions).researchUseAcknowledged,
    true,
  );
});

test('catalog lookup and text listing are deterministic', () => {
  assert.equal(getTutorStubLab('human_scaffold').title, 'Human scaffold');
  assert.equal(getTutorStubLab('missing'), null);
  assert.match(formatTutorStubLabList(), /^pure_chat\tlearner_safe\tstable\tlow\tPure chat/mu);
  assert.match(formatTutorStubLabList({ audience: 'research' }), /research_controls/u);
  assert.throws(() => listTutorStubLabs({ audience: 'public' }), /unknown tutor-stub lab audience/u);
  assert.throws(() => resolveTutorStubLab('missing'), /use --list-labs/u);
});
