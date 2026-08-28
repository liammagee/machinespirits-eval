import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  changedFilesBetween,
  classifyCiChanges,
  classifyCiRange,
  pathAllowsFocusedCi,
  pathAllowsValidatorOnlyCi,
  pathRequiresRefGovernance,
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
  ]) {
    assert.equal(pathAllowsFocusedCi(file), true, file);
  }
});

test('runtime, dependency, workflow, database, evaluator, and tutor paths fail closed to full CI', () => {
  for (const file of [
    '.github/workflows/test.yml',
    'README.md',
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
    'config/tutor-stub-example-study-go-request.v1.json',
    'docs/adaptation-refinement/outcome-study-a1/pilot-manifest.json',
    'docs/pedagogical-move-contract.md',
    'docs/ref-status.md',
    'docs/research/human-coding-codebook.md',
    'docs/research/paper-full-2.0.md',
    'workplan/items/adaptive-warrant-outcome-study.md',
    'workplan/items/guarded-learner-outcome-study.md',
    'workplan/items/resistance-action-register-integration.md',
  ]) {
    assert.equal(pathAllowsFocusedCi(file), false, file);
    assert.equal(classifyCiChanges({ changedFiles: [file] }).profile, 'full', file);
  }
});

test('the self-running validator test uses validator-only CI', () => {
  const changedFiles = ['tests/tutorStubResistantProfileStudyGoRequest.test.js', 'workplan/items/example.md'];
  const result = classifyCiChanges({ changedFiles });
  assert.equal(result.profile, 'validator-only');
  assert.equal(result.fullRequired, false);
  assert.deepEqual(result.validatorPaths, changedFiles.slice(0, 1));
  assert.deepEqual(result.validatorTests, ['tests/tutorStubResistantProfileStudyGoRequest.test.js']);
  assert.equal(pathAllowsValidatorOnlyCi(changedFiles[0]), true);
  assert.deepEqual(selectValidatorOnlyCi([changedFiles[0]]).tests, result.validatorTests);
});

test('validator-only CI fails closed when shared code, runtime, endpoint, or unregistered validators are mixed in', () => {
  const registered = 'tests/tutorStubResistantProfileStudyGoRequest.test.js';
  for (const widenedPath of [
    'scripts/check-tutor-stub-resistant-profile-study-go-request.js',
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

test('machine-coupled authored surfaces and legacy study requests require full CI', () => {
  for (const file of [
    'README.md',
    'docs/adaptation-refinement/outcome-study-a1/worlds/world_101_kestrel_signal_lamp.yaml',
    'docs/adaptation-refinement/relay/118-go-guarded-main-block.md',
    'docs/pedagogical-move-contract.md',
    'docs/ref-status.md',
    'docs/research/human-coding-codebook.md',
    'docs/research/paper-full-2.0.md',
    'workplan/items/adaptive-warrant-outcome-study.md',
    'workplan/items/guarded-learner-outcome-study.md',
    'workplan/items/resistance-action-register-integration.md',
    'config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v4.json',
  ]) {
    const result = classifyCiChanges({ changedFiles: [file] });
    assert.equal(result.profile, 'full', file);
    assert.equal(result.fullRequired, true, file);
  }
});

test('ref governance is selected only for its managed inputs and fails closed when classification is unavailable', () => {
  for (const file of [
    '.github/workflows/ref-governance.yml',
    '.github/workflows/test.yml',
    'docs/ref-status.md',
    'docs/tagging-and-version-protocol.md',
    'scripts/ci-change-policy.js',
    'scripts/ref-governance.js',
    'tests/ciChangePolicy.test.js',
    'tests/refGovernance.test.js',
  ]) {
    assert.equal(pathRequiresRefGovernance(file), true, file);
    assert.equal(classifyCiChanges({ changedFiles: [file] }).refGovernanceRequired, true, file);
  }

  for (const file of ['docs/local-ci.md', 'services/evaluationStore.js', 'tests/localCiRunner.test.js']) {
    assert.equal(pathRequiresRefGovernance(file), false, file);
    assert.equal(classifyCiChanges({ changedFiles: [file] }).refGovernanceRequired, false, file);
  }

  assert.equal(classifyCiChanges({ changedFiles: [] }).refGovernanceRequired, true);
  assert.equal(classifyCiChanges({ changedFiles: ['docs/local-ci.md'], forceFull: true }).refGovernanceRequired, true);
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

test('classifier preserves a committed leading-whitespace path and fails closed', () => {
  const projectRoot = createGitFixture();
  const script = path.resolve('scripts/ci-change-policy.js');
  try {
    const base = git(projectRoot, ['rev-parse', 'HEAD']);
    const file = ' docs/runtime.md';
    fs.mkdirSync(path.dirname(path.join(projectRoot, file)), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, file), 'runtime\n');
    git(projectRoot, ['add', '--', file]);
    git(projectRoot, ['commit', '--quiet', '-m', 'leading whitespace path']);
    const head = git(projectRoot, ['rev-parse', 'HEAD']);
    const args = [script, '--project-root', projectRoot, '--base', base, '--head', head];

    const result = JSON.parse(execFileSync(process.execPath, args, { encoding: 'utf8' }));
    assert.equal(result.profile, 'full');
    assert.match(result.reason, /invalid changed path/u);
    assert.match(result.reason, / docs\/runtime\.md/u);
    assert.throws(() => execFileSync(process.execPath, [...args, '--validate-focused']), /changed path/u);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('a runtime file renamed into focused docs preserves both paths and requires full CI', () => {
  const projectRoot = createGitFixture();
  try {
    fs.mkdirSync(path.join(projectRoot, 'services'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'services/runtime.js'), 'export const runtime = true;\n');
    git(projectRoot, ['add', 'services/runtime.js']);
    git(projectRoot, ['commit', '--quiet', '-m', 'runtime base']);
    const base = git(projectRoot, ['rev-parse', 'HEAD']);

    git(projectRoot, ['mv', 'services/runtime.js', 'docs/runtime.md']);
    git(projectRoot, ['commit', '--quiet', '-m', 'hide runtime as docs']);
    const head = git(projectRoot, ['rev-parse', 'HEAD']);

    assert.deepEqual(changedFilesBetween(base, head, projectRoot), ['docs/runtime.md', 'services/runtime.js']);
    const result = classifyCiRange({ base, head, projectRoot });
    assert.equal(result.profile, 'full');
    assert.match(result.reason, /services\/runtime\.js/u);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('a deleted test retains its old path and requires full CI', () => {
  const projectRoot = createGitFixture();
  try {
    fs.mkdirSync(path.join(projectRoot, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'tests/deleted.test.js'), 'export const covered = true;\n');
    git(projectRoot, ['add', 'tests/deleted.test.js']);
    git(projectRoot, ['commit', '--quiet', '-m', 'test base']);
    const base = git(projectRoot, ['rev-parse', 'HEAD']);

    fs.rmSync(path.join(projectRoot, 'tests/deleted.test.js'));
    git(projectRoot, ['add', '-u']);
    git(projectRoot, ['commit', '--quiet', '-m', 'delete test']);
    const head = git(projectRoot, ['rev-parse', 'HEAD']);

    assert.deepEqual(changedFilesBetween(base, head, projectRoot), ['tests/deleted.test.js']);
    assert.equal(classifyCiRange({ base, head, projectRoot }).profile, 'full');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('ordinary research prose keeps the validation framework while protected research inputs run full', () => {
  const result = classifyCiChanges({ changedFiles: ['docs/research/methods-paper.md'] });
  assert.equal(result.profile, 'focused');
  assert.equal(result.fullRequired, false);
  assert.equal(result.validationRequired, true);
  assert.equal(pathRequiresValidationFramework('docs/research/methods-paper.md'), true);

  const ordinaryDocs = classifyCiChanges({ changedFiles: ['docs/local-ci.md'] });
  assert.equal(ordinaryDocs.validationRequired, false);

  const studyGo = classifyCiChanges({
    changedFiles: ['config/tutor-stub-example-study-go-request.v1.json'],
  });
  assert.equal(studyGo.profile, 'full');
  assert.equal(studyGo.authorizationRequired, false);
});

test('focused validation parses changed JSON and rejects malformed or widened changes', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-change-policy-'));
  try {
    fs.mkdirSync(path.join(projectRoot, 'docs'));
    fs.writeFileSync(path.join(projectRoot, 'docs', 'sample.json'), '{"ok":true}\n');
    assert.equal(
      validateFocusedChanges({
        changedFiles: ['docs/sample.json'],
        projectRoot,
      }).profile,
      'focused',
    );

    fs.writeFileSync(path.join(projectRoot, 'docs', 'sample.json'), '{bad json}\n');
    assert.throws(
      () =>
        validateFocusedChanges({
          changedFiles: ['docs/sample.json'],
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
  assert.match(ci, /node --test tests\/ciChangePolicy\.test\.js tests\/localCiRunner\.test\.js/u);
  assert.match(
    ci,
    /validator_required: \$\{\{ steps\.manual\.outputs\.validator_required \|\| steps\.changes\.outputs\.validator_required \}\}/u,
  );
  assert.match(
    ci,
    /ref_governance_required: \$\{\{ steps\.manual\.outputs\.ref_governance_required \|\| steps\.main\.outputs\.ref_governance_required \|\| steps\.changes\.outputs\.ref_governance_required \}\}/u,
  );
  assert.match(ci, /echo "validator_required=false" >> "\$GITHUB_OUTPUT"/u);
  assert.match(ci, /echo "ref_governance_required=true" >> "\$GITHUB_OUTPUT"/u);
  assert.match(ci, /needs\.classify\.outputs\.full_required == 'true'/u);
  assert.match(ci, /--validate-focused/u);
  assert.match(ci, /^ {2}validator-only:\n {4}name: Focused validator checks$/mu);
  assert.match(ci, /needs\.classify\.outputs\.validator_required == 'true'/u);
  assert.match(ci, /node --test \$VALIDATOR_TESTS/u);
  assert.match(ci, /\.\/node_modules\/\.bin\/eslint \$VALIDATOR_PATHS/u);
  assert.match(ci, /case "\$PROFILE:\$FULL_REQUIRED:\$VALIDATOR_REQUIRED" in/u);
  assert.match(ci, /require_result "\$CLASSIFY_RESULT" success "classifier"/u);
  assert.match(ci, /require_result "\$CONTRACT_RESULT" success "test contract"/u);
  assert.match(ci, /case "\$REF_GOVERNANCE_REQUIRED:\$REF_GOVERNANCE_RESULT" in/u);
  assert.match(ci, /true:success\|false:skipped\)/u);
  assert.match(ci, /CI lane conclusions:/u);
  assert.match(ci, /CI result: \$failures lane contract mismatch/u);

  function resultArm(label) {
    const startMarker = `            ${label})\n`;
    const start = ci.indexOf(startMarker);
    assert.notEqual(start, -1, label);
    const end = ci.indexOf('              ;;', start);
    assert.notEqual(end, -1, label);
    return ci.slice(start + startMarker.length, end);
  }

  for (const [label, expectations] of [
    [
      'full:true:false',
      [
        ['FOCUSED_RESULT', 'skipped'],
        ['VALIDATOR_RESULT', 'skipped'],
        ['LINT_RESULT', 'success'],
        ['TEST_RESULT', 'success'],
        ['PTY_RESULT', 'success'],
        ['COVERAGE_RESULT', 'success'],
      ],
    ],
    [
      'focused:false:false',
      [
        ['FOCUSED_RESULT', 'success'],
        ['VALIDATOR_RESULT', 'skipped'],
        ['LINT_RESULT', 'skipped'],
        ['TEST_RESULT', 'skipped'],
        ['PTY_RESULT', 'skipped'],
        ['COVERAGE_RESULT', 'skipped'],
      ],
    ],
    [
      'validator-only:false:true',
      [
        ['FOCUSED_RESULT', 'skipped'],
        ['VALIDATOR_RESULT', 'success'],
        ['LINT_RESULT', 'skipped'],
        ['TEST_RESULT', 'skipped'],
        ['PTY_RESULT', 'skipped'],
        ['COVERAGE_RESULT', 'skipped'],
      ],
    ],
  ]) {
    const arm = resultArm(label);
    for (const [variable, expected] of expectations) {
      assert.ok(
        arm.includes(`require_result "$${variable}" ${expected} `),
        `${label} must require ${variable}=${expected}`,
      );
    }
  }
  assert.match(ci, /Invalid CI classifier outputs/u);
  assert.doesNotMatch(ci, /ELECTRON_/u);
  assert.match(validation, /needs\.classify\.outputs\.validation_required == 'true'/u);
  assert.match(validation, /case "\$VALIDATION_REQUIRED:\$VALIDATE_RESULT" in/u);
  assert.match(validation, /true:success\|false:skipped\)/u);
  assert.match(validation, /Validation selection mismatch/u);
  assert.doesNotMatch(validation, /ELECTRON_/u);

  for (const workflow of [
    ci,
    validation,
    fs.readFileSync(path.resolve('.github/workflows/ref-governance.yml'), 'utf8'),
    fs.readFileSync(path.resolve('.github/workflows/tutor-stub-surface-acceptance.yml'), 'utf8'),
    fs.readFileSync(path.resolve('.github/workflows/workplan-validate.yml'), 'utf8'),
    fs.readFileSync(path.resolve('.github/workflows/workplan-commit-trailer.yml'), 'utf8'),
  ]) {
    assert.match(workflow, /fetch-depth: 0\n {10}filter: blob:none/u);
  }
});

test('test-contract installs dependencies before every dependency-bearing bootstrap check', () => {
  const workflow = fs.readFileSync(path.resolve('.github/workflows/test.yml'), 'utf8');
  const start = workflow.indexOf('  test-contract:\n');
  const end = workflow.indexOf('\n  focused:\n', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const contract = workflow.slice(start, end);

  const setup = contract.indexOf('uses: actions/setup-node@v7');
  const staticOrderingCheck = contract.indexOf('name: Validate dependency bootstrap ordering');
  const install = contract.indexOf('run: npm ci');
  const manifest = contract.indexOf('run: npm run test:manifest');
  const permissions = contract.indexOf('run: npm run skills:permissions:check');
  const classifier = contract.indexOf('run: node --test tests/ciChangePolicy.test.js tests/localCiRunner.test.js');

  for (const [label, index] of [
    ['setup-node', setup],
    ['static ordering check', staticOrderingCheck],
    ['npm ci', install],
    ['test manifest', manifest],
    ['skill permissions', permissions],
    ['classifier contract', classifier],
  ]) {
    assert.notEqual(index, -1, `${label} must be present in test-contract`);
  }
  assert.ok(setup < staticOrderingCheck, 'setup-node must precede the dependency-free ordering check');
  assert.ok(staticOrderingCheck < install, 'the dependency-free ordering check must run before installation');
  for (const [label, index] of [
    ['test manifest', manifest],
    ['skill permissions', permissions],
    ['classifier contract', classifier],
  ]) {
    assert.ok(install < index, `npm ci must precede ${label}`);
  }
  assert.equal(contract.match(/^ {6}- run: npm ci$/gmu)?.length, 1);
});
