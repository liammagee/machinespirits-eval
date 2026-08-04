import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { projectTutorStubTrainingReuseStatusLines } from '../services/tutorStubTrainingReusePresentation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COLORS = Object.freeze({ dim: '<dim>', reset: '<reset>' });

function terminalBytes(lines) {
  return lines.map((line) => `${line}\n`).join('');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function candidateFixture(overrides = {}) {
  return {
    prefix: 'current session',
    label: 'training candidate',
    requested: 'on',
    humanSubjectLabel: 'owner operator',
    sourceLabel: 'repository default',
    failClosed: false,
    status: 'training_candidate',
    colors: COLORS,
    ...overrides,
  };
}

test('candidate status projection pins exact lines, bytes, and input immutability', () => {
  const presentation = candidateFixture();
  const before = structuredClone(presentation);
  const lines = projectTutorStubTrainingReuseStatusLines(presentation);
  const output = terminalBytes(lines);

  assert.deepEqual(lines, [
    '<dim>  current session: training candidate; requested on; owner operator; source repository default<reset>',
    '<dim>  candidate means eligible for later review, not automatically approved or exported for training<reset>',
  ]);
  assert.equal(sha256(output), '88d620403de4e6d09fb425cce5b307952ce2bd3a2df1283640c805d0ccad71ee');
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(presentation, before, 'presentation must not mutate its input');
});

test('owner opt-out projects the descendant exclusion explanation', () => {
  const lines = projectTutorStubTrainingReuseStatusLines(
    candidateFixture({
      label: 'do not train',
      requested: 'off',
      sourceLabel: 'cli opt out',
      status: 'do_not_train',
    }),
  );
  const output = terminalBytes(lines);

  assert.equal(lines.length, 2);
  assert.equal(sha256(output), 'bf2e4d3cf20587a8f259b526d62c83cf1779d5cece5ed75a4c6882e400cc8f58');
  assert.match(output, /source and derived descendants must remain outside training corpora/u);
});

test('fail-closed explanation takes precedence for external or unknown human data', () => {
  const output = terminalBytes(
    projectTutorStubTrainingReuseStatusLines(
      candidateFixture({
        label: 'do not train',
        humanSubjectLabel: 'external user',
        sourceLabel: 'cli',
        failClosed: true,
        status: 'do_not_train',
      }),
    ),
  );

  assert.equal(sha256(output), 'e0faf31676b1800d9cbcd90c74ffca03348c088d06f387165602cad97c6a07ca');
  assert.match(output, /external or unknown human data stays do not train/u);
  assert.doesNotMatch(output, /derived descendants/u);
});

test('not-applicable status emits only its resolved base line', () => {
  const lines = projectTutorStubTrainingReuseStatusLines(
    candidateFixture({
      label: 'not applicable',
      requested: 'on',
      humanSubjectLabel: 'not applicable',
      sourceLabel: 'automated run',
      status: 'not_applicable',
    }),
  );

  assert.deepEqual(lines, [
    '<dim>  current session: not applicable; requested on; not applicable; source automated run<reset>',
  ]);
});

test('real candidate, opt-out, and fail-closed status commands preserve exact no-model terminal blocks', () => {
  const commonArgs = [
    'scripts/tutor-stub.js',
    '--no-opening',
    '--no-closeout-report',
    '--no-interim-animation',
    '--no-stream',
    '--no-trace',
    '--no-remember-settings',
    '--world',
    'world_005_marrick',
  ];
  const variants = [
    {
      name: 'candidate',
      args: [],
      bytes: 210,
      hash: '772098bccee3df25e15b5223f0199c7f1199f55eedaeb3a0f134d6964958e1f3',
    },
    {
      name: 'opt-out',
      args: ['--no-training-reuse'],
      bytes: 176,
      hash: 'a8e5f6794dc1266189f10a75e3a99dea3bbc97eccc5b23fcd741e9ec42d5aa39',
    },
    {
      name: 'fail-closed',
      args: ['--human-subject-class', 'external_user', '--training-reuse', 'on'],
      bytes: 172,
      hash: '753ef493c427c455f9e5a0ea55425e58c16ee4e5033c64d7485a5f624e245f0f',
    },
  ];

  for (const variant of variants) {
    const result = spawnSync(process.execPath, [...commonArgs, ...variant.args], {
      cwd: ROOT,
      encoding: 'utf8',
      input: '/settings training-reuse status\n/quit\n',
      timeout: 15_000,
      env: {
        ...process.env,
        NO_COLOR: '1',
        TUTOR_STUB_OPENING_REALIZER: 'deterministic',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });
    const block = result.stdout.match(/training reuse >[\s\S]*?\n\n/u)?.[0] || '';

    assert.equal(result.status, 0, `${variant.name}: ${result.stderr}`);
    assert.equal(Buffer.byteLength(block), variant.bytes, variant.name);
    assert.equal(sha256(block), variant.hash, variant.name);
  }
});

test('the CLI retains reuse resolution, state, persistence, trace, and terminal ownership', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubTrainingReusePresentation.js'), 'utf8');
  const controllerSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubLiveSettingsController.js'), 'utf8');
  const reuseSlice = controllerSource.slice(
    controllerSource.indexOf('function trainingReuseStatusLines'),
    controllerSource.indexOf('function printDialogueSettings'),
  );

  assert.match(cliSource, /from '\.\.\/services\/tutorStubTrainingReusePresentation\.js';/u);
  assert.match(cliSource, /createTutorStubLiveSettingsController/u);
  assert.match(reuseSlice, /state\.trainingReuse/u);
  assert.match(reuseSlice, /tutorStubTrainingReuseLabel/u);
  assert.match(reuseSlice, /displayDiagnosticLabel/u);
  assert.match(reuseSlice, /projectTutorStubTrainingReuseStatusLines/u);
  assert.match(reuseSlice, /console\.log\(line\)/u);
  assert.match(reuseSlice, /normalizeTutorStubTrainingReuseSetting/u);
  assert.match(reuseSlice, /resolveTutorStubTrainingReuse/u);
  assert.match(reuseSlice, /args\['training-reuse'\]/u);
  assert.match(reuseSlice, /persistCurrentInteractiveSettings\('training_reuse_changed'\)/u);
  assert.match(reuseSlice, /type: 'training_reuse_changed'/u);
  assert.doesNotMatch(reuseSlice, /external or unknown human data stays/u);
  assert.doesNotMatch(reuseSlice, /derived descendants must remain/u);
  assert.match(serviceSource, /export function projectTutorStubTrainingReuseStatusLines/u);
  assert.doesNotMatch(serviceSource, /^import\s/mu);
  assert.doesNotMatch(serviceSource, /\b(?:spawnSync|fs|console|process|fetch|Date\.now)\s*[.(]/u);
});
