import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  appendRunEvent,
  buildExperimentRunPlan,
  createRunPlan,
  createRunSeal,
  hashCanonicalJson,
  verifyExperimentRun,
} from '../services/experimentRunArtifacts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function writeFakeCodex(binDir) {
  const executable = path.join(binDir, 'codex');
  fs.writeFileSync(
    executable,
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const outputIndex = args.indexOf('-o');
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const response = input.includes('You are an automated learner')
    ? 'I would test the newest public mark before deciding.'
    : input.includes('compact up-front reviewer')
      ? '{}'
      : 'Which public mark would you test next, and what would it show?';
  if (outputPath) fs.writeFileSync(outputPath, response);
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
});
`,
    'utf8',
  );
  fs.chmodSync(executable, 0o755);
}

function fixturePlan(overrides = {}) {
  const hashes = Object.fromEntries(
    ['runner', 'analyzer', 'policy', 'profile', 'prompt', 'world', 'config'].map((kind) => [
      kind,
      hashCanonicalJson({ kind }),
    ]),
  );
  return buildExperimentRunPlan({
    runId: 'package-fixture',
    createdAt: '2026-07-11T00:00:00.000Z',
    runner: 'tests/package-fixture',
    provenance: {
      git: {
        sha: '0123456789abcdef',
        branch: 'test',
        dirty: false,
        fingerprintSha256: hashCanonicalJson({ clean: true }),
      },
    },
    models: {
      tutor: { requested: 'mock/tutor', resolved: 'mock/tutor', observed: 'mock/tutor' },
    },
    hashes,
    masterSeed: 23,
    jobs: [{ id: 'fixture-job', profile: 'fixture', policy: 'mock', repeat: 1 }],
    requiredObservedModelRoles: [],
    ...overrides,
  });
}

test('a sealed adaptive run packages and restores into a verified clean directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-run-package-'));
  const source = path.join(root, 'source');
  const archives = path.join(root, 'archives');
  const manifests = path.join(root, 'manifests');
  const restored = path.join(root, 'restored');
  try {
    createRunPlan(source, fixturePlan());
    const child = path.join(source, 'child');
    createRunPlan(
      child,
      fixturePlan({
        runId: 'package-child-fixture',
        jobs: [{ id: 'child-job', profile: 'fixture', policy: 'mock', repeat: 1 }],
        lineage: { parentRunId: 'package-fixture', resumeOf: null, supersedes: [] },
      }),
    );
    appendRunEvent(child, { type: 'run_started', recordedAt: '2026-07-11T00:00:00.000Z' });
    createRunSeal(child, { closedAt: '2026-07-11T00:00:00.500Z' });
    appendRunEvent(source, { type: 'run_started', recordedAt: '2026-07-11T00:00:01.000Z' });
    fs.writeFileSync(
      path.join(source, 'result.json'),
      `${JSON.stringify({ schema: 'machinespirits.package-fixture-result.v1', value: 42 })}\n`,
    );
    createRunSeal(source, { closedAt: '2026-07-11T00:00:02.000Z' });
    const sourceVerification = verifyExperimentRun(source);
    assert.equal(sourceVerification.ok, true, sourceVerification.errors.join('\n'));

    execFileSync(
      process.execPath,
      [
        'scripts/package-adaptive-run.js',
        '--run-dir',
        source,
        '--archive-dir',
        archives,
        '--manifest-dir',
        manifests,
        '--claim-status',
        'methods',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );

    const manifestName = fs.readdirSync(manifests).find((name) => name.endsWith('.manifest.json'));
    assert.ok(manifestName);
    const manifest = JSON.parse(fs.readFileSync(path.join(manifests, manifestName), 'utf8'));
    assert.equal(manifest.schema, 'machinespirits.adaptive-tutor-evidence-manifest.v1');
    assert.equal(manifest.runId, 'package-fixture');
    assert.equal(manifest.claimStatus, 'methods');
    assert.equal(manifest.archive.availability, 'local_file_pointer');
    assert.match(manifest.archive.sha256, /^[0-9a-f]{64}$/u);
    assert.match(manifest.source.sealSha256, /^[0-9a-f]{64}$/u);
    assert.ok(manifest.archive.files >= 7);
    assert.ok(manifest.exclusions.includes('model outputs are archived, not regenerated'));
    assert.ok(fs.existsSync(manifest.archive.path));

    execFileSync(
      process.execPath,
      [
        'scripts/restore-adaptive-run.js',
        '--archive',
        manifest.archive.path,
        '--manifest',
        path.join(manifests, manifestName),
        '--out',
        restored,
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const restoredVerification = verifyExperimentRun(restored);
    assert.equal(restoredVerification.ok, true, restoredVerification.errors.join('\n'));
    const restoredChildVerification = verifyExperimentRun(path.join(restored, 'child'));
    assert.equal(restoredChildVerification.ok, true, restoredChildVerification.errors.join('\n'));
    assert.ok(restoredVerification.inventory.some((entry) => entry.path === 'child/run-seal.json'));
    assert.deepEqual(
      fs.readFileSync(path.join(restored, 'run-plan.json')),
      fs.readFileSync(path.join(source, 'run-plan.json')),
    );
    assert.deepEqual(
      fs.readFileSync(path.join(restored, 'run-events.jsonl')),
      fs.readFileSync(path.join(source, 'run-events.jsonl')),
    );

    const cliVerification = JSON.parse(
      execFileSync(process.execPath, ['scripts/verify-experiment-run.js', '--run-dir', restored, '--json'], {
        cwd: ROOT,
        encoding: 'utf8',
      }),
    );
    assert.equal(cliVerification.ok, true);
    assert.equal(cliVerification.runId, 'package-fixture');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('restore refuses an archive that does not match its tracked manifest', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-run-manifest-auth-'));
  const source = path.join(root, 'source');
  const archives = path.join(root, 'archives');
  const manifests = path.join(root, 'manifests');
  try {
    createRunPlan(source, fixturePlan());
    appendRunEvent(source, { type: 'run_started', recordedAt: '2026-07-11T00:00:01.000Z' });
    createRunSeal(source, { closedAt: '2026-07-11T00:00:02.000Z' });
    execFileSync(
      process.execPath,
      ['scripts/package-adaptive-run.js', '--run-dir', source, '--archive-dir', archives, '--manifest-dir', manifests],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const manifestPath = path.join(
      manifests,
      fs.readdirSync(manifests).find((name) => name.endsWith('.manifest.json')),
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    fs.appendFileSync(manifest.archive.path, 'tamper');
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [
            'scripts/restore-adaptive-run.js',
            '--archive',
            manifest.archive.path,
            '--manifest',
            manifestPath,
            '--out',
            path.join(root, 'restored'),
          ],
          { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' },
        ),
      /Archive byte count does not match manifest/u,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('restore refuses a manifest whose source hashes do not match the restored seal', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-run-manifest-source-tamper-'));
  const source = path.join(root, 'source');
  const archives = path.join(root, 'archives');
  const manifests = path.join(root, 'manifests');
  try {
    createRunPlan(source, fixturePlan());
    appendRunEvent(source, { type: 'run_started', recordedAt: '2026-07-11T00:00:01.000Z' });
    createRunSeal(source, { closedAt: '2026-07-11T00:00:02.000Z' });
    execFileSync(
      process.execPath,
      ['scripts/package-adaptive-run.js', '--run-dir', source, '--archive-dir', archives, '--manifest-dir', manifests],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const manifestPath = path.join(
      manifests,
      fs.readdirSync(manifests).find((name) => name.endsWith('.manifest.json')),
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.source.planSha256 = '0'.repeat(64);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [
            'scripts/restore-adaptive-run.js',
            '--archive',
            manifest.archive.path,
            '--manifest',
            manifestPath,
            '--out',
            path.join(root, 'restored'),
          ],
          { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' },
        ),
      /Restored planSha256 does not match evidence manifest/u,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a stochastic mock QA parent and child replay after checksum-verified clean-room restore', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-run-qa-clean-room-'));
  const qaDir = path.join(root, 'qa');
  const archiveDir = path.join(root, 'archives');
  const manifestDir = path.join(root, 'manifests');
  const restored = path.join(root, 'restored');
  const binDir = path.join(root, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  writeFakeCodex(binDir);
  const env = {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
    CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
  };
  try {
    execFileSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-qa-matrix.js',
        '--trace-dir',
        qaDir,
        '--profiles',
        'diligent',
        '--policies',
        'bland,field',
        '--runs',
        '1',
        '--turns',
        '1',
        '--primary-horizon',
        '1',
        '--model',
        'codex.gpt-5.6-terra',
        '--analysis-model',
        'codex.gpt-5.6-terra',
        '--auto-learner-model',
        'codex.gpt-5.6-terra',
        '--parallelism',
        '1',
        '--no-html-report',
        '--no-ledger',
        '--no-memory-summary',
        '--no-analyze',
      ],
      { cwd: ROOT, encoding: 'utf8', timeout: 30_000, env },
    );
    const source = verifyExperimentRun(qaDir);
    const sourceChild = verifyExperimentRun(path.join(qaDir, 'diligent'));
    assert.equal(source.ok, true, source.errors.join('\n'));
    assert.equal(sourceChild.ok, true, sourceChild.errors.join('\n'));
    assert.ok(source.replay.decisions.length >= 1);
    assert.ok(sourceChild.replay.decisions.length >= 1);
    assert.ok(source.inventory.some((entry) => entry.path === 'diligent/run-seal.json'));
    assert.equal(sourceChild.plan.lineage.parentRunId, source.plan.runId);

    execFileSync(
      process.execPath,
      [
        'scripts/package-adaptive-run.js',
        '--run-dir',
        qaDir,
        '--archive-dir',
        archiveDir,
        '--manifest-dir',
        manifestDir,
        '--claim-status',
        'methods',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const manifestPath = path.join(
      manifestDir,
      fs.readdirSync(manifestDir).find((name) => name.endsWith('.manifest.json')),
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    execFileSync(
      process.execPath,
      [
        'scripts/restore-adaptive-run.js',
        '--archive',
        manifest.archive.path,
        '--manifest',
        manifestPath,
        '--out',
        restored,
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const restoredParent = verifyExperimentRun(restored);
    const restoredChild = verifyExperimentRun(path.join(restored, 'diligent'));
    assert.equal(restoredParent.ok, true, restoredParent.errors.join('\n'));
    assert.equal(restoredChild.ok, true, restoredChild.errors.join('\n'));
    assert.equal(restoredParent.replay.decisions.length, source.replay.decisions.length);
    assert.equal(restoredChild.replay.decisions.length, sourceChild.replay.decisions.length);
    assert.equal(restoredChild.plan.lineage.parentRunId, restoredParent.plan.runId);
    assert.deepEqual(
      fs.readFileSync(path.join(restored, 'run-plan.json')),
      fs.readFileSync(path.join(qaDir, 'run-plan.json')),
    );
    assert.deepEqual(
      fs.readFileSync(path.join(restored, 'run-seal.json')),
      fs.readFileSync(path.join(qaDir, 'run-seal.json')),
    );
    execFileSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-qa-matrix.js',
        '--from-dir',
        restored,
        '--dry-run',
        '--no-html-report',
        '--no-ledger',
        '--no-memory-summary',
      ],
      { cwd: ROOT, encoding: 'utf8', timeout: 30_000 },
    );
    const postReportParent = verifyExperimentRun(restored);
    const postReportChild = verifyExperimentRun(path.join(restored, 'diligent'));
    assert.equal(postReportParent.ok, true, postReportParent.errors.join('\n'));
    assert.equal(postReportChild.ok, true, postReportChild.errors.join('\n'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
