import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  classifyCiChanges,
  pathAllowsFocusedCi,
  pathRequiresValidationFramework,
  validateFocusedChanges,
} from '../scripts/ci-change-policy.js';

test('focused CI is allowlisted to authored metadata and workplan surfaces', () => {
  for (const file of [
    'AGENTS.md',
    '.github/pull_request_template.md',
    '.agents/skills/ms-workplan/SKILL.md',
    'docs/local-ci.md',
    'workplan/items/example.md',
    'config/tutor-stub-example-study-go-request.v1.json',
  ]) {
    assert.equal(pathAllowsFocusedCi(file), true, file);
  }
});

test('runtime, dependency, workflow, database, evaluator, and tutor paths fail closed to full CI', () => {
  for (const file of [
    '.github/workflows/test.yml',
    'package.json',
    'package-lock.json',
    'desktop/main.js',
    'data/schema.sql',
    'routes/evalRoutes.js',
    'scripts/ci-change-policy.js',
    'services/evaluationStore.js',
    'tests/ciChangePolicy.test.js',
    'tutor-core/services/dialogueEngine.js',
    'config/tutor-agents.yaml',
    'config/example-authorization.consumed.v1.json',
  ]) {
    assert.equal(pathAllowsFocusedCi(file), false, file);
    assert.equal(classifyCiChanges({ changedFiles: [file] }).profile, 'full', file);
  }
});

test('unknown, empty, and mixed change sets use full CI', () => {
  assert.equal(classifyCiChanges({ changedFiles: [] }).profile, 'full');
  assert.equal(classifyCiChanges({ changedFiles: ['unexpected.bin'] }).profile, 'full');
  assert.equal(
    classifyCiChanges({ changedFiles: ['workplan/items/example.md', 'services/evaluationStore.js'] }).profile,
    'full',
  );
  assert.equal(classifyCiChanges({ changedFiles: ['AGENTS.md'], forceFull: true }).reason, 'manual workflow dispatch');
});

test('research prose keeps the validation framework without allocating runtime tests', () => {
  const result = classifyCiChanges({ changedFiles: ['docs/research/paper-full-2.0.md'] });
  assert.equal(result.profile, 'focused');
  assert.equal(result.fullRequired, false);
  assert.equal(result.validationRequired, true);
  assert.equal(pathRequiresValidationFramework('docs/research/paper-full-2.0.md'), true);

  const ordinaryDocs = classifyCiChanges({ changedFiles: ['docs/local-ci.md'] });
  assert.equal(ordinaryDocs.validationRequired, false);

  const studyGo = classifyCiChanges({
    changedFiles: ['config/tutor-stub-example-study-go-request.v1.json'],
  });
  assert.equal(studyGo.authorizationRequired, true);
});

test('focused validation parses changed JSON and rejects malformed or widened changes', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-change-policy-'));
  try {
    fs.mkdirSync(path.join(projectRoot, 'config'));
    fs.writeFileSync(path.join(projectRoot, 'config', 'sample-study-go-request.v1.json'), '{"ok":true}\n');
    assert.equal(
      validateFocusedChanges({
        changedFiles: ['config/sample-study-go-request.v1.json'],
        projectRoot,
      }).profile,
      'focused',
    );

    fs.writeFileSync(path.join(projectRoot, 'config', 'sample-study-go-request.v1.json'), '{bad json}\n');
    assert.throws(
      () =>
        validateFocusedChanges({
          changedFiles: ['config/sample-study-go-request.v1.json'],
          projectRoot,
        }),
      /JSON/u,
    );
    assert.throws(
      () => validateFocusedChanges({ changedFiles: ['services/runtime.js'], projectRoot }),
      /focused validation refused/u,
    );
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('workflows expose the classifier, focused gate, and Electron download boundary', () => {
  const ci = fs.readFileSync(path.resolve('.github/workflows/test.yml'), 'utf8');
  const validation = fs.readFileSync(path.resolve('.github/workflows/validate.yml'), 'utf8');
  assert.match(ci, /node scripts\/ci-change-policy\.js/u);
  assert.match(ci, /needs\.classify\.outputs\.full_required == 'true'/u);
  assert.match(ci, /--validate-focused/u);
  assert.match(ci, /ELECTRON_SKIP_BINARY_DOWNLOAD: "1"/u);
  assert.match(validation, /needs\.classify\.outputs\.validation_required == 'true'/u);
  assert.match(validation, /ELECTRON_SKIP_BINARY_DOWNLOAD: "1"/u);
});
