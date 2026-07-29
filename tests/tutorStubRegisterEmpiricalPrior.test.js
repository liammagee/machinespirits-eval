import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { createTutorStubRegisterEmpiricalPriorModel } from '../services/tutorStubRegisterEmpiricalPrior.js';

function model(files = {}) {
  return createTutorStubRegisterEmpiricalPriorModel({
    resolveWorkspacePath: (value) => `/workspace/${value}`,
    defaultPath: '/workspace/.tutor-stub-auto-eval/register-empirical-priors.json',
    existsSync: (filePath) => Object.hasOwn(files, filePath),
    readFileSync: (filePath) => JSON.stringify(files[filePath]),
  });
}

test('register prior path resolution preserves opt-outs, explicit paths, auto, and empirical policies', () => {
  const prior = model();
  for (const value of ['off', 'NONE', 'false', '0']) {
    assert.equal(prior.resolveRegisterEmpiricalPriorPath(value, { policy: 'field' }), null, value);
  }
  assert.equal(prior.resolveRegisterEmpiricalPriorPath('custom.json', { policy: 'field' }), '/workspace/custom.json');
  assert.equal(
    prior.resolveRegisterEmpiricalPriorPath('', { policy: 'empirical_dynamical_system' }),
    '/workspace/.tutor-stub-auto-eval/register-empirical-priors.json',
  );
  assert.equal(prior.resolveRegisterEmpiricalPriorPath('', { policy: 'field' }), null);
});

test('register prior loading distinguishes off and missing files', () => {
  const prior = model();
  assert.deepEqual(prior.loadRegisterEmpiricalPrior('off', { policy: 'field' }), {
    prior: null,
    filePath: null,
    status: 'off',
  });
  assert.equal(prior.loadRegisterEmpiricalPrior('auto', { policy: 'field' }).status, 'missing');
});

test('register prior loading preserves legacy, held-out, and eligible statuses', () => {
  const filePath = '/workspace/prior.json';
  for (const [payload, status] of [
    [{ schema: 'machinespirits.register-empirical-priors.v1' }, 'loaded_legacy_requires_rebuild'],
    [
      { schema: 'machinespirits.register-empirical-priors.v2', deployment: { objectiveRegisterPriorEligible: false } },
      'loaded_holdout_not_passed',
    ],
    [{ schema: 'machinespirits.register-empirical-priors.v2' }, 'loaded'],
  ]) {
    assert.equal(
      model({ [filePath]: payload }).loadRegisterEmpiricalPrior('prior.json', { policy: 'field' }).status,
      status,
    );
  }
});

test('invalid register prior schemas retain exact path and schema diagnostics', () => {
  assert.throws(
    () => model({ '/workspace/prior.json': { schema: 'other.v1' } }).loadRegisterEmpiricalPrior('prior.json'),
    /Invalid register empirical prior schema in \/workspace\/prior\.json: other\.v1/u,
  );
});

test('the CLI binds rather than redeclares register-prior loading', () => {
  const source = fs.readFileSync(new URL('../scripts/tutor-stub.js', import.meta.url), 'utf8');
  assert.match(source, /createTutorStubRegisterEmpiricalPriorModel/u);
  assert.doesNotMatch(
    source,
    /function (?:defaultRegisterEmpiricalPriorPath|resolveRegisterEmpiricalPriorPath|loadRegisterEmpiricalPrior)\(/u,
  );
});
