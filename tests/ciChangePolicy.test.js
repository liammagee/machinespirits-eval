import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  classifyCiChanges,
  pathAllowsFocusedCi,
  pathAllowsValidatorOnlyCi,
  pathRequiresValidationFramework,
  selectValidatorOnlyCi,
  validateChangedPath,
  validateFocusedChanges,
} from '../scripts/ci-change-policy.js';

function git(projectRoot, args) {
  return execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' }).trim();
}

function createGitFixture() {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-change-policy-git-'));
  git(projectRoot, ['init', '--quiet']);
  git(projectRoot, ['config', 'user.email', 'ci-test@example.invalid']);
  git(projectRoot, ['config', 'user.name', 'CI Test']);
  fs.mkdirSync(path.join(projectRoot, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'docs/tracked.md'), 'base\n');
  git(projectRoot, ['add', '.']);
  git(projectRoot, ['commit', '--quiet', '-m', 'base']);
  return projectRoot;
}

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
    'scripts/tutor-stub-surface-acceptance-scenario.mjs',
    'data/schema.sql',
    'routes/evalRoutes.js',
    'scripts/ci-change-policy.js',
    'scripts/check-unregistered-validator.js',
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

test('the registered study-GO validator and its paired test use validator-only CI', () => {
  const changedFiles = [
    'scripts/check-tutor-stub-resistant-profile-study-go-request.js',
    'tests/tutorStubResistantProfileStudyGoRequest.test.js',
    'workplan/items/resistance-action-register-integration.md',
  ];
  const result = classifyCiChanges({ changedFiles });
  assert.equal(result.profile, 'validator-only');
  assert.equal(result.fullRequired, false);
  assert.deepEqual(result.validatorPaths, changedFiles.slice(0, 2));
  assert.deepEqual(result.validatorTests, ['tests/tutorStubResistantProfileStudyGoRequest.test.js']);
  assert.equal(pathAllowsValidatorOnlyCi(changedFiles[0]), true);
  assert.equal(pathAllowsValidatorOnlyCi(changedFiles[1]), true);
  assert.deepEqual(selectValidatorOnlyCi([changedFiles[0]]).tests, result.validatorTests);
  assert.deepEqual(selectValidatorOnlyCi([changedFiles[1]]).tests, result.validatorTests);
});

test('validator-only CI fails closed when a runtime, endpoint, or unregistered validator is mixed in', () => {
  const registered = 'scripts/check-tutor-stub-resistant-profile-study-go-request.js';
  for (const widenedPath of [
    'services/tutorStubResistanceAxisDiscriminationPreflight.js',
    'config/paid-study-endpoints/tutor-stub-frame-refuser-opportunity.json',
    'scripts/check-unregistered-validator.js',
  ]) {
    const result = classifyCiChanges({ changedFiles: [registered, widenedPath] });
    assert.equal(result.profile, 'full', widenedPath);
    assert.equal(result.fullRequired, true, widenedPath);
    assert.deepEqual(result.validatorTests, [], widenedPath);
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

test('changed paths reject absolute, traversal, empty, and non-canonical forms', () => {
  for (const file of [
    '',
    '/tmp/docs.md',
    'C:\\tmp\\docs.md',
    './docs/local-ci.md',
    'docs//local-ci.md',
    'docs/../services/evaluationStore.js',
  ]) {
    assert.throws(() => validateChangedPath(file), /changed path/u, file || '<empty>');
    assert.equal(classifyCiChanges({ changedFiles: [file] }).profile, 'full', file || '<empty>');
  }
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

test('classifier CLI unions the committed range with supplemental paths and fails closed on missing refs', () => {
  const projectRoot = createGitFixture();
  const script = path.resolve('scripts/ci-change-policy.js');
  try {
    const base = git(projectRoot, ['rev-parse', 'HEAD']);
    fs.mkdirSync(path.join(projectRoot, 'services'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'services/evaluationStore.js'), 'export const runtime = true;\n');
    git(projectRoot, ['add', 'services/evaluationStore.js']);
    git(projectRoot, ['commit', '--quiet', '-m', 'runtime']);
    const head = git(projectRoot, ['rev-parse', 'HEAD']);
    fs.writeFileSync(path.join(projectRoot, 'docs/supplemental.md'), 'supplemental\n');

    const common = [
      script,
      '--project-root',
      projectRoot,
      '--base',
      base,
      '--head',
      head,
      '--changed-file',
      'docs/supplemental.md',
    ];
    const result = JSON.parse(execFileSync(process.execPath, common, { encoding: 'utf8' }));
    assert.equal(result.profile, 'full');
    assert.match(result.reason, /services\/evaluationStore\.js/u);

    const missingRange = JSON.parse(
      execFileSync(
        process.execPath,
        [
          script,
          '--project-root',
          projectRoot,
          '--base',
          'missing-base',
          '--head',
          head,
          '--changed-file',
          'docs/supplemental.md',
        ],
        { encoding: 'utf8' },
      ),
    );
    assert.equal(missingRange.profile, 'full');
    assert.match(missingRange.reason, /range could not be classified/u);
    const missingMetadata = JSON.parse(
      execFileSync(
        process.execPath,
        [script, '--project-root', projectRoot, '--changed-file', 'docs/supplemental.md'],
        { encoding: 'utf8' },
      ),
    );
    assert.equal(missingMetadata.profile, 'full');
    assert.match(missingMetadata.reason, /base and head are required/u);
    assert.throws(
      () =>
        execFileSync(process.execPath, [
          script,
          '--project-root',
          projectRoot,
          '--base',
          'missing-base',
          '--head',
          head,
          '--changed-file',
          'docs/supplemental.md',
          '--validate-focused',
        ]),
      /focused validation refused/u,
    );

    for (const invalid of ['', path.join(projectRoot, 'docs/supplemental.md'), 'docs/../services/evaluationStore.js']) {
      assert.throws(
        () =>
          execFileSync(
            process.execPath,
            [script, '--project-root', projectRoot, '--base', base, '--head', head, '--changed-file', invalid],
            { encoding: 'utf8' },
          ),
        /changed path|changed-file/u,
      );
    }
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('focused validation checks whitespace in staged, unstaged, and untracked paths', () => {
  for (const state of ['staged', 'unstaged', 'untracked']) {
    const projectRoot = createGitFixture();
    try {
      const file = state === 'untracked' ? 'docs/untracked.md' : 'docs/tracked.md';
      fs.writeFileSync(path.join(projectRoot, file), 'trailing whitespace \n');
      if (state === 'staged') git(projectRoot, ['add', file]);
      assert.throws(
        () =>
          validateFocusedChanges({
            changedFiles: [file],
            projectRoot,
            base: 'HEAD',
            head: 'HEAD',
          }),
        undefined,
        state,
      );
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  }
});

test('manual full classifier mode does not require range metadata', () => {
  assert.equal(
    JSON.parse(execFileSync(process.execPath, ['scripts/ci-change-policy.js', '--force-full'], { encoding: 'utf8' }))
      .profile,
    'full',
  );
});

test('workflows expose the classifier and focused gate without retired runtime flags', () => {
  const ci = fs.readFileSync(path.resolve('.github/workflows/test.yml'), 'utf8');
  const validation = fs.readFileSync(path.resolve('.github/workflows/validate.yml'), 'utf8');
  assert.match(ci, /node scripts\/ci-change-policy\.js/u);
  assert.match(ci, /needs\.classify\.outputs\.full_required == 'true'/u);
  assert.match(ci, /--validate-focused/u);
  assert.match(ci, /^ {2}validator-only:\n {4}name: Focused validator checks$/mu);
  assert.match(ci, /needs\.classify\.outputs\.validator_required == 'true'/u);
  assert.match(ci, /node --test \$VALIDATOR_TESTS/u);
  assert.match(ci, /\.\/node_modules\/\.bin\/eslint \$VALIDATOR_PATHS/u);
  assert.doesNotMatch(ci, /ELECTRON_/u);
  assert.match(validation, /needs\.classify\.outputs\.validation_required == 'true'/u);
  assert.doesNotMatch(validation, /ELECTRON_/u);

  for (const workflow of [
    ci,
    validation,
    fs.readFileSync(path.resolve('.github/workflows/tutor-stub-surface-acceptance.yml'), 'utf8'),
    fs.readFileSync(path.resolve('.github/workflows/workplan-validate.yml'), 'utf8'),
    fs.readFileSync(path.resolve('.github/workflows/workplan-commit-trailer.yml'), 'utf8'),
  ]) {
    assert.match(workflow, /fetch-depth: 0\n {10}filter: blob:none/u);
  }
});
