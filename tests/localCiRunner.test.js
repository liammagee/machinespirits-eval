import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildLocalCiPlan,
  changedFilesForRange,
  classifyLocalSurfaceRequirement,
  displayCommand,
  executeLocalCiPlan,
  localCiEnvironment,
  parseLocalCiArgs,
  pathTriggersSurfaceAcceptance,
  resolveLocalCiProfile,
} from '../scripts/run-local-ci.js';
import {
  classifySurfaceAcceptance,
  packageManifestChangeRequiresSurfaceAcceptance,
} from '../scripts/tutor-stub-surface-ci-policy.js';

function displays(plan) {
  return plan.flatMap((lane) => lane.commands.map(displayCommand));
}

function git(projectRoot, args) {
  return execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' }).trim();
}

function createGitFixture() {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'local-ci-git-'));
  git(projectRoot, ['init', '--quiet']);
  git(projectRoot, ['config', 'user.email', 'ci-test@example.invalid']);
  git(projectRoot, ['config', 'user.name', 'CI Test']);
  fs.mkdirSync(path.join(projectRoot, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'workplan/items'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'docs/base.md'), 'base\n');
  fs.writeFileSync(path.join(projectRoot, 'workplan/items/unstaged.md'), 'base\n');
  git(projectRoot, ['add', '.']);
  git(projectRoot, ['commit', '--quiet', '-m', 'base']);
  return projectRoot;
}

function buildAutoPlan(changedFiles, argv = []) {
  const requested = parseLocalCiArgs(argv);
  const selection = resolveLocalCiProfile(requested, changedFiles);
  const options = { ...requested, profile: selection.profile, requestedProfile: selection.requestedProfile };
  return {
    options,
    selection,
    plan: buildLocalCiPlan(options, {
      projectRoot: '/repo',
      changedFiles,
      classification: selection.classification,
    }),
  };
}

test('local CI arguments expose bounded profiles and explicit parity switches', () => {
  assert.equal(parseLocalCiArgs([]).profile, 'auto');
  const options = parseLocalCiArgs([
    '--profile=quick',
    '--lane',
    'contract,lint',
    '--skip=lint',
    '--no-install',
    '--offline',
    '--keep-going',
    '--node24-container',
    '--surface=never',
    '--base',
    'upstream/main',
    '--head=topic',
  ]);
  assert.equal(options.profile, 'quick');
  assert.deepEqual(options.lanes, ['contract', 'lint']);
  assert.deepEqual(options.skip, ['lint']);
  assert.equal(options.install, false);
  assert.equal(options.offline, true);
  assert.equal(options.keepGoing, true);
  assert.equal(options.includeNode24, true);
  assert.equal(options.surface, 'never');
  assert.equal(options.base, 'upstream/main');
  assert.equal(options.head, 'topic');
  assert.throws(() => parseLocalCiArgs(['--profile=imaginary']), /Unknown local CI profile/u);
  assert.throws(() => parseLocalCiArgs(['--surface=maybe']), /Unknown surface mode/u);
  assert.throws(() => parseLocalCiArgs(['--node20-container']), /Unknown local CI option/u);
});

test('automatic local CI selection matches hosted full, validator-only, and retired-request boundaries', () => {
  const pr699 = buildAutoPlan([
    'config/paid-study-endpoints/tutor-stub-frame-refuser-opportunity.endpoint-go.json',
    'config/paid-study-endpoints/tutor-stub-frame-refuser-opportunity.json',
    'config/tutor-stub-frame-refuser-opportunity-registration.v1.json',
    'scripts/analyze-tutor-stub-resistance-axis-calibration.js',
    'services/tutorStubResistanceAxisDiscriminationPreflight.js',
    'tests/resistantLearnerAxisCalibration.test.js',
    'tests/tutorStubResistantProfileStudyGoRequest.test.js',
    'workplan/items/resistance-action-register-integration.md',
  ]);
  assert.equal(pr699.selection.profile, 'full');
  assert.equal(
    pr699.plan.some((lane) => lane.id === 'node-tests'),
    true,
  );
  assert.equal(
    pr699.plan.some((lane) => lane.id === 'focused'),
    false,
  );

  const pr700Files = ['tests/tutorStubResistantProfileStudyGoRequest.test.js', 'workplan/items/example.md'];
  const pr700 = buildAutoPlan(pr700Files);
  assert.equal(pr700.selection.profile, 'validator-only');
  assert.deepEqual(
    pr700.plan.map((lane) => lane.id),
    ['install', 'contract', 'validator-only', 'workplan'],
  );
  const pr700Commands = displays(pr700.plan);
  assert.ok(pr700Commands.includes('node --test tests/tutorStubResistantProfileStudyGoRequest.test.js'));
  assert.ok(pr700Commands.includes('./node_modules/.bin/eslint tests/tutorStubResistantProfileStudyGoRequest.test.js'));
  assert.equal(
    pr700Commands.some((command) => command === 'npm run lint'),
    false,
  );

  const pr701Files = [
    'config/tutor-stub-frame-refuser-opportunity-study-go-request.v1.json',
    'workplan/items/resistance-action-register-integration.md',
  ];
  const pr701 = buildAutoPlan(pr701Files);
  assert.equal(pr701.selection.profile, 'full');
  assert.equal(pr701.selection.classification.authorizationRequired, false);
  assert.equal(
    pr701.plan.some((lane) => lane.id === 'node-tests'),
    true,
  );

  const sharedValidator = buildAutoPlan(['scripts/check-tutor-stub-resistant-profile-study-go-request.js']);
  assert.equal(sharedValidator.selection.profile, 'full');
  assert.equal(
    sharedValidator.plan.some((lane) => lane.id === 'node-tests'),
    true,
  );
});

test('automatic local CI preserves fail-closed selection and research validation', () => {
  const mixed = buildAutoPlan(['workplan/items/example.md', 'services/evaluationStore.js']);
  assert.equal(mixed.selection.profile, 'full');
  assert.equal(
    mixed.plan.some((lane) => lane.id === 'node-tests'),
    true,
  );

  const unknown = buildAutoPlan(['unexpected.bin']);
  assert.equal(unknown.selection.profile, 'full');

  const research = buildAutoPlan(['docs/research/methods-paper.md']);
  assert.equal(research.selection.profile, 'focused');
  assert.deepEqual(
    research.plan.map((lane) => lane.id),
    ['install', 'contract', 'focused', 'validation', 'workplan'],
  );

  const canonicalPaper = buildAutoPlan(['docs/research/paper-full-2.0.md']);
  assert.equal(canonicalPaper.selection.profile, 'full');
  assert.equal(
    canonicalPaper.plan.some((lane) => lane.id === 'node-tests'),
    true,
  );

  const refStatus = buildAutoPlan(['docs/ref-status.md']);
  assert.equal(refStatus.selection.classification.refGovernanceRequired, true);
  assert.equal(
    refStatus.plan.some((lane) => lane.id === 'ref-governance'),
    true,
  );

  const unrelatedRuntime = buildAutoPlan(['services/evaluationStore.js']);
  assert.equal(unrelatedRuntime.selection.profile, 'full');
  assert.equal(unrelatedRuntime.selection.classification.refGovernanceRequired, false);
  assert.equal(
    unrelatedRuntime.plan.some((lane) => lane.id === 'ref-governance'),
    false,
  );

  const explicitFull = parseLocalCiArgs(['--profile=full', '--no-install', '--surface=never']);
  const selection = resolveLocalCiProfile(explicitFull, ['docs/local-ci.md']);
  assert.equal(selection.profile, 'full');
  assert.equal(selection.classification.profile, 'focused');
});

test('local change collection unions committed, staged, unstaged, and untracked paths', async () => {
  const projectRoot = createGitFixture();
  try {
    const base = git(projectRoot, ['rev-parse', 'HEAD']);
    fs.mkdirSync(path.join(projectRoot, 'services'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'services/evaluationStore.js'), 'export const runtime = true;\n');
    git(projectRoot, ['add', 'services/evaluationStore.js']);
    git(projectRoot, ['commit', '--quiet', '-m', 'runtime']);
    fs.writeFileSync(path.join(projectRoot, 'docs/staged.md'), 'staged\n');
    git(projectRoot, ['add', 'docs/staged.md']);
    fs.writeFileSync(path.join(projectRoot, 'workplan/items/unstaged.md'), 'changed\n');
    fs.writeFileSync(path.join(projectRoot, 'docs/untracked.md'), 'untracked\n');

    const result = await changedFilesForRange(base, 'HEAD', projectRoot);
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.changedFiles, [
      'docs/staged.md',
      'docs/untracked.md',
      'services/evaluationStore.js',
      'workplan/items/unstaged.md',
    ]);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('local change collection preserves a committed leading-whitespace path', async () => {
  const projectRoot = createGitFixture();
  try {
    const base = git(projectRoot, ['rev-parse', 'HEAD']);
    const file = ' docs/runtime.md';
    fs.mkdirSync(path.dirname(path.join(projectRoot, file)), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, file), 'runtime\n');
    git(projectRoot, ['add', '--', file]);
    git(projectRoot, ['commit', '--quiet', '-m', 'leading whitespace path']);

    const result = await changedFilesForRange(base, 'HEAD', projectRoot);
    assert.equal(result.ok, true);
    assert.deepEqual(result.changedFiles, [file]);
    const selection = resolveLocalCiProfile(parseLocalCiArgs([]), result.changedFiles, {
      collectionOk: result.ok,
      errors: result.errors,
    });
    assert.equal(selection.profile, 'full');
    assert.match(selection.classification.reason, /invalid changed path/u);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('local change collection preserves both sides of committed and staged renames', async () => {
  for (const state of ['committed', 'staged']) {
    const projectRoot = createGitFixture();
    try {
      fs.mkdirSync(path.join(projectRoot, 'services'), { recursive: true });
      fs.writeFileSync(path.join(projectRoot, 'services/runtime.js'), 'export const runtime = true;\n');
      git(projectRoot, ['add', 'services/runtime.js']);
      git(projectRoot, ['commit', '--quiet', '-m', 'runtime base']);
      const base = git(projectRoot, ['rev-parse', 'HEAD']);

      git(projectRoot, ['mv', 'services/runtime.js', 'docs/runtime.md']);
      if (state === 'committed') git(projectRoot, ['commit', '--quiet', '-m', 'hide runtime as docs']);

      const result = await changedFilesForRange(base, 'HEAD', projectRoot);
      assert.equal(result.ok, true, state);
      assert.deepEqual(result.changedFiles, ['docs/runtime.md', 'services/runtime.js'], state);
      const selection = resolveLocalCiProfile(parseLocalCiArgs([]), result.changedFiles, {
        collectionOk: result.ok,
        errors: result.errors,
      });
      assert.equal(selection.profile, 'full', state);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  }
});

test('local change collection failure is explicit and forces full CI plus surface validation', async () => {
  const projectRoot = createGitFixture();
  try {
    fs.writeFileSync(path.join(projectRoot, 'docs/staged.md'), 'staged\n');
    git(projectRoot, ['add', 'docs/staged.md']);
    fs.writeFileSync(path.join(projectRoot, 'workplan/items/unstaged.md'), 'changed\n');
    fs.writeFileSync(path.join(projectRoot, 'docs/untracked.md'), 'untracked\n');

    const result = await changedFilesForRange('missing-base', 'HEAD', projectRoot);
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /^range:/mu);
    assert.deepEqual(result.changedFiles, ['docs/staged.md', 'docs/untracked.md', 'workplan/items/unstaged.md']);

    const options = parseLocalCiArgs([]);
    const selection = resolveLocalCiProfile(options, result.changedFiles, {
      collectionOk: result.ok,
      errors: result.errors,
    });
    assert.equal(selection.profile, 'full');
    assert.match(selection.classification.reason, /collection failed/u);
    const surface = classifyLocalSurfaceRequirement({
      surfaceMode: 'auto',
      base: 'missing-base',
      changedFileResult: result,
      projectRoot,
    });
    assert.deepEqual(surface, {
      required: true,
      reason: 'changed-file collection failed; surface impact is unknown',
    });
    const resolvedOptions = { ...options, profile: selection.profile };
    const plan = buildLocalCiPlan(resolvedOptions, {
      projectRoot,
      changedFiles: result.changedFiles,
      surfaceRequired: surface.required,
      classification: selection.classification,
    });
    assert.equal(
      plan.some((lane) => lane.id === 'node-tests'),
      true,
    );
    assert.equal(
      plan.some((lane) => lane.id === 'surface'),
      true,
    );

    const explicitFull = resolveLocalCiProfile(parseLocalCiArgs(['--profile=full']), result.changedFiles, {
      collectionOk: result.ok,
      errors: result.errors,
    });
    assert.equal(explicitFull.profile, 'full');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('missing package comparison metadata conservatively requires surface validation', () => {
  const result = classifyLocalSurfaceRequirement({
    surfaceMode: 'auto',
    base: 'HEAD',
    changedFileResult: { ok: true, changedFiles: ['package.json'], errors: [] },
    readBaseManifest: () => {
      throw new Error('missing manifest');
    },
  });
  assert.deepEqual(result, { required: true, reason: 'package comparison metadata is unavailable' });
});

test('local CI keeps npm cache and logs outside the source tree', () => {
  const environment = localCiEnvironment('/repo');
  assert.equal(environment.CI, '1');
  assert.equal(environment.npm_config_cache.startsWith('/repo/'), false);
  assert.match(environment.npm_config_cache, /machinespirits-local-ci\/repo\/npm-cache$/u);
  assert.equal(localCiEnvironment('/repo', { npm_config_cache: '/override' }).npm_config_cache, '/override');
});

test('full local CI plan covers the data-independent GitHub command contract', () => {
  const options = parseLocalCiArgs(['--profile=full', '--no-install', '--offline', '--surface=never']);
  const plan = buildLocalCiPlan(options, { projectRoot: '/repo', changedFiles: [] });
  const commands = displays(plan);
  for (const expected of [
    'npm run test:manifest',
    'npm run skills:permissions:check',
    'node --test tests/ciChangePolicy.test.js tests/localCiRunner.test.js',
    'npm run refs:check',
    'npm run lint',
    'npm run lint:tutor-core',
    'npm run lint:cycles',
    'npm run format:check',
    'npm run format:check:tutor-core',
    'npm run test:root -- --shard=1/4 --quiet',
    'npm run test:root -- --shard=2/4 --quiet',
    'npm run test:root -- --shard=3/4 --quiet',
    'npm run test:root -- --shard=4/4 --quiet',
    'npm run test:core -- --quiet',
    'npm run test:pty:ci',
    'npm run test:lifecycle:ci',
    'npm run test:coverage:risk',
    'npm run content:validate',
    'npm run paper:provable-discourse:smoke',
    'npm run wp:source-check',
    'npm run wp:test',
    'npm run wp:generated-pr-check -- --base origin/main --head HEAD',
    'npm run wp:commit-link -- --range origin/main..HEAD',
  ]) {
    assert.ok(commands.includes(expected), `missing local CI command: ${expected}`);
  }
});

test('surface acceptance uses the same path family and can add isolated Node 24 parity', () => {
  assert.equal(pathTriggersSurfaceAcceptance('package.json'), true);
  assert.equal(pathTriggersSurfaceAcceptance('scripts/tutor-stub-surface-acceptance-scenario.mjs'), true);
  assert.equal(pathTriggersSurfaceAcceptance('docs/local-ci.md'), false);

  const options = parseLocalCiArgs(['--profile=full', '--no-install', '--node24-container']);
  const plan = buildLocalCiPlan(options, { projectRoot: '/repo', changedFiles: ['package.json'] });
  assert.ok(plan.some((lane) => lane.id === 'surface'));
  const node24 = plan.find((lane) => lane.id === 'node24');
  assert.ok(node24);
  assert.equal(node24.commands[0].program, 'docker');
  assert.match(displayCommand(node24.commands[0]), /node:24-bookworm/u);
  assert.match(displayCommand(node24.commands[0]), /type=bind,src=\/repo,dst=\/source,readonly/u);

  const surface = plan.find((lane) => lane.id === 'surface');
  assert.deepEqual(displays([surface]), ['npm run tutor:stub:acceptance:web']);

  const node24Only = buildLocalCiPlan(
    parseLocalCiArgs(['--profile=full', '--lane=node24', '--node24-container', '--no-install', '--offline']),
    { projectRoot: '/repo', changedFiles: ['package.json'] },
  );
  assert.deepEqual(
    node24Only.map((lane) => lane.id),
    ['node24'],
  );

  const docsOnly = buildLocalCiPlan(parseLocalCiArgs(['--profile=full', '--no-install']), {
    projectRoot: '/repo',
    changedFiles: ['docs/local-ci.md'],
  });
  assert.equal(
    docsOnly.some((lane) => lane.id === 'surface'),
    false,
  );
});

test('surface acceptance skips unrelated package scripts but fails closed for runtime and acceptance changes', () => {
  const baseManifest = {
    name: '@machinespirits/eval',
    type: 'module',
    dependencies: { yaml: '2.9.0' },
    scripts: {
      'tutor:stub:acceptance:web': 'node scripts/run-tutor-stub-surface-acceptance.mjs --host web',
      'tutor:stub:qa': 'node scripts/run-tutor-stub-qa-matrix.js',
    },
  };
  const unrelatedScript = {
    ...baseManifest,
    scripts: { ...baseManifest.scripts, 'one-off:validator': 'node scripts/check-once.js' },
  };
  assert.equal(packageManifestChangeRequiresSurfaceAcceptance(baseManifest, unrelatedScript), false);
  assert.deepEqual(
    classifySurfaceAcceptance({ changedFiles: ['package.json'], baseManifest, headManifest: unrelatedScript }),
    { required: false, reason: 'package.json change is unrelated scripts only' },
  );

  const relevantScript = {
    ...baseManifest,
    scripts: {
      ...baseManifest.scripts,
      'tutor:stub:acceptance:web': 'node scripts/run-tutor-stub-surface-acceptance.mjs --host browser',
    },
  };
  assert.equal(packageManifestChangeRequiresSurfaceAcceptance(baseManifest, relevantScript), true);
  assert.equal(
    packageManifestChangeRequiresSurfaceAcceptance(baseManifest, {
      ...baseManifest,
      scripts: { ...baseManifest.scripts, postinstall: 'node scripts/configure-runtime.js' },
    }),
    true,
  );
  assert.equal(
    classifySurfaceAcceptance({ changedFiles: ['package.json'], baseManifest, headManifest: relevantScript }).required,
    true,
  );
  assert.equal(
    classifySurfaceAcceptance({
      changedFiles: ['package.json'],
      baseManifest,
      headManifest: { ...baseManifest, dependencies: { yaml: '2.10.0' } },
    }).required,
    true,
  );
  assert.equal(classifySurfaceAcceptance({ changedFiles: ['package-lock.json'] }).required, true);
  assert.equal(classifySurfaceAcceptance({ changedFiles: ['package.json'] }).required, true);

  const scriptOnlyPlan = buildLocalCiPlan(parseLocalCiArgs(['--profile=full', '--no-install']), {
    projectRoot: '/repo',
    changedFiles: ['package.json'],
    surfaceRequired: false,
  });
  assert.equal(
    scriptOnlyPlan.some((lane) => lane.id === 'surface'),
    false,
  );
});

test('local CI execution writes an auditable report and stops after a failed lane by default', async () => {
  const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'machinespirits-local-ci-test-'));
  const options = { ...parseLocalCiArgs([]), reportDir, keepGoing: false };
  const plan = [
    {
      id: 'first',
      label: 'first',
      commands: [
        { program: 'pass', args: [] },
        { program: 'fail', args: [] },
        { program: 'skip', args: [] },
        { program: 'cleanup', args: [], always: true },
      ],
    },
    { id: 'later', label: 'later', commands: [{ program: 'never', args: [] }] },
  ];
  let tick = 0;
  const start = Date.parse('2026-08-07T00:00:00.000Z');
  const executed = [];
  const execute = async (command) => {
    executed.push(command.program);
    return { code: command.program === 'fail' ? 2 : 0, signal: null };
  };
  const result = await executeLocalCiPlan(plan, options, {
    projectRoot: '/',
    reportDir,
    sourceSha: 'abc123',
    execute,
    now: () => new Date(start + tick++ * 1000),
  });
  assert.equal(result.report.status, 'failed');
  assert.deepEqual(
    result.report.lanes.map((lane) => lane.id),
    ['first'],
  );
  assert.equal(result.report.lanes[0].commands[1].exitCode, 2);
  assert.equal(result.report.lanes[0].commands[2].status, 'skipped');
  assert.deepEqual(executed, ['pass', 'fail', 'cleanup']);
  assert.ok(fs.existsSync(path.join(reportDir, 'summary.json')));
  assert.match(fs.readFileSync(path.join(reportDir, 'summary.md'), 'utf8'), /Status: \*\*failed\*\*/u);
});

test('npm and workflow integration expose local and manual recovery entry points', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
  assert.equal(manifest.scripts['ci:local'], 'node scripts/run-local-ci.js');
  assert.equal(manifest.scripts['ci:local:quick'], 'node scripts/run-local-ci.js --profile quick --no-install');
  assert.equal(
    manifest.scripts['ci:local:node24'],
    'node scripts/run-local-ci.js --lane node24 --node24-container --no-install --offline',
  );
  assert.equal(manifest.scripts['ci:local:node20'], undefined);
  assert.equal(manifest.scripts['native:rebuild:node'], undefined);
  const workflow = fs.readFileSync(path.resolve('.github/workflows/test.yml'), 'utf8');
  assert.match(workflow, /^ {2}workflow_dispatch: \{\}$/mu);
  const refWorkflow = fs.readFileSync(path.resolve('.github/workflows/ref-governance.yml'), 'utf8');
  assert.match(refWorkflow, /^ {2}schedule:$/mu);
  assert.match(refWorkflow, /^ {2}workflow_dispatch: \{\}$/mu);
  assert.match(refWorkflow, /archive-snapshot\/\*\*/u);
});
