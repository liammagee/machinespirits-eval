import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildLocalCiPlan,
  displayCommand,
  executeLocalCiPlan,
  localCiEnvironment,
  parseLocalCiArgs,
  pathTriggersSurfaceAcceptance,
} from '../scripts/run-local-ci.js';
import { nativeRebuildPlan } from '../scripts/rebuild-node-native-modules.js';
import {
  classifySurfaceAcceptance,
  packageManifestChangeRequiresSurfaceAcceptance,
} from '../scripts/tutor-stub-surface-ci-policy.js';

function displays(plan) {
  return plan.flatMap((lane) => lane.commands.map(displayCommand));
}

test('local CI arguments expose bounded profiles and explicit parity switches', () => {
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

test('local CI keeps npm cache and logs outside the source tree', () => {
  const environment = localCiEnvironment('/repo');
  assert.equal(environment.CI, '1');
  assert.equal(environment.npm_config_cache.startsWith('/repo/'), false);
  assert.match(environment.npm_config_cache, /machinespirits-local-ci\/repo\/npm-cache$/u);
  assert.equal(localCiEnvironment('/repo', { npm_config_cache: '/override' }).npm_config_cache, '/override');
});

test('full local CI plan covers the data-independent GitHub command contract', () => {
  const options = parseLocalCiArgs(['--no-install', '--offline', '--surface=never']);
  const plan = buildLocalCiPlan(options, { projectRoot: '/repo', changedFiles: [] });
  const commands = displays(plan);
  for (const expected of [
    'npm run test:manifest',
    'npm run skills:permissions:check',
    'npm run refs:check',
    'npm run lint',
    'npm run lint:cycles',
    'npm run format:check',
    'npm run test:root -- --shard=1/2 --quiet',
    'npm run test:root -- --shard=2/2 --quiet',
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
  assert.equal(pathTriggersSurfaceAcceptance('desktop/main.js'), true);
  assert.equal(pathTriggersSurfaceAcceptance('docs/local-ci.md'), false);

  const options = parseLocalCiArgs(['--no-install', '--node24-container']);
  const plan = buildLocalCiPlan(options, { projectRoot: '/repo', changedFiles: ['package.json'] });
  assert.ok(plan.some((lane) => lane.id === 'surface'));
  const node24 = plan.find((lane) => lane.id === 'node24');
  assert.ok(node24);
  assert.equal(node24.commands[0].program, 'docker');
  assert.match(displayCommand(node24.commands[0]), /node:24-bookworm/u);
  assert.match(displayCommand(node24.commands[0]), /type=bind,src=\/repo,dst=\/source,readonly/u);

  const surface = plan.find((lane) => lane.id === 'surface');
  assert.equal(displays([surface]).filter((command) => command === 'npm run native:rebuild:node').length, 2);
  assert.equal(surface.commands.at(-1).always, true);

  const node24Only = buildLocalCiPlan(
    parseLocalCiArgs(['--lane=node24', '--node24-container', '--no-install', '--offline']),
    { projectRoot: '/repo', changedFiles: ['package.json'] },
  );
  assert.deepEqual(
    node24Only.map((lane) => lane.id),
    ['node24'],
  );

  const docsOnly = buildLocalCiPlan(parseLocalCiArgs(['--no-install']), {
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
      'desktop:pack': 'desktop/node_modules/.bin/electron-builder --dir',
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
    scripts: { ...baseManifest.scripts, 'desktop:pack': 'electron-builder --dir --config alternate.yml' },
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

  const scriptOnlyPlan = buildLocalCiPlan(parseLocalCiArgs(['--no-install']), {
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
  assert.equal(manifest.scripts['native:rebuild:node'], 'node scripts/rebuild-node-native-modules.js');
  const rebuild = nativeRebuildPlan({
    projectRoot: '/repo',
    nodeGypPath: '/npm/node-gyp.js',
    nodePath: '/node',
    npmPath: '/npm',
  });
  assert.deepEqual(rebuild[0], {
    label: 'better-sqlite3',
    program: '/npm',
    args: ['rebuild', 'better-sqlite3'],
    cwd: '/repo',
  });
  assert.deepEqual(rebuild[1], {
    label: 'node-pty',
    program: '/node',
    args: ['/npm/node-gyp.js', 'rebuild', '--release'],
    cwd: '/repo/node_modules/node-pty',
  });
  const workflow = fs.readFileSync(path.resolve('.github/workflows/test.yml'), 'utf8');
  assert.match(workflow, /^ {2}workflow_dispatch: \{\}$/mu);
});
