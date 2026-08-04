import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildCliProviderEnv } from '../services/cliProviderBridge.js';
import { terminateTutorStubProcessTree } from '../services/tutorStubProcessSessionFactory.js';
import { createTutorStubSessionHost } from '../services/tutorStubSessionHost.js';
import {
  TUTOR_STUB_SURFACE_ACCEPTANCE_SCHEMA,
  TUTOR_STUB_SURFACE_PRIVATE_PROJECTION_SCHEMA,
  assertTutorStubSurfaceAcceptanceContract,
  assertTutorStubSurfacePrivateProjection,
} from '../services/tutorStubSurfaceAcceptanceContract.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'fixtures', 'tutor-stub-surface-acceptance');

function expectedContract() {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE, 'expected-contract.json'), 'utf8'));
}

function resultFor(host) {
  return {
    schema: TUTOR_STUB_SURFACE_ACCEPTANCE_SCHEMA,
    host:
      host === 'web'
        ? { kind: 'web', authRequired: false, unauthenticatedStatus: 200, cspPresent: false }
        : {
            kind: 'packaged-electron',
            authRequired: true,
            unauthenticatedStatus: 401,
            cspPresent: true,
          },
    contract: expectedContract(),
  };
}

test('the same stable acceptance contract validates for web and packaged Electron hosts', () => {
  assert.equal(assertTutorStubSurfaceAcceptanceContract(resultFor('web'), expectedContract()).host.kind, 'web');
  assert.equal(
    assertTutorStubSurfaceAcceptanceContract(resultFor('packaged-electron'), expectedContract()).host.kind,
    'packaged-electron',
  );

  const broken = resultFor('web');
  broken.contract.lifecycle.lateResultSuppressed = false;
  assert.throws(
    () => assertTutorStubSurfaceAcceptanceContract(broken, expectedContract()),
    /contract\.lifecycle\.lateResultSuppressed/u,
  );
});

test('the private provider projection is explicit and independently validated', () => {
  const projection = {
    schema: TUTOR_STUB_SURFACE_PRIVATE_PROJECTION_SCHEMA,
    providerRequestsStarted: 2,
    providerRequestsCompleted: 1,
    providerPromptObserved: true,
    privateCanaryObserved: true,
    credentialCanaryObserved: true,
    completedReplyObserved: true,
    delayedRequestObserved: true,
    delayedCompletionAbsent: true,
  };
  assert.equal(assertTutorStubSurfacePrivateProjection(projection), projection);
  assert.throws(
    () => assertTutorStubSurfacePrivateProjection({ ...projection, delayedCompletionAbsent: false }),
    /delayedCompletionAbsent/u,
  );
  assert.throws(
    () => assertTutorStubSurfacePrivateProjection({ ...projection, providerRequestsCompleted: 2 }),
    /two starts and one completion/u,
  );
});

test('surface acceptance canaries cross only the explicit fake-provider environment gate', () => {
  const source = {
    PATH: '/fixture/bin',
    OPENAI_API_KEY: 'credential-canary',
    FAKE_CODEX_LOG: '/tmp/provider-events.jsonl',
    ACCEPTANCE_PRIVATE_PROMPT_CANARY: 'private-canary',
    ACCEPTANCE_CREDENTIAL_CANARY: 'credential-canary',
    UNRELATED_SECRET: 'must-not-cross',
    TUTOR_STUB_SURFACE_ACCEPTANCE: '1',
  };
  assert.deepEqual(buildCliProviderEnv('codex', source), {
    PATH: '/fixture/bin',
    OPENAI_API_KEY: 'credential-canary',
    FAKE_CODEX_LOG: '/tmp/provider-events.jsonl',
    ACCEPTANCE_PRIVATE_PROMPT_CANARY: 'private-canary',
    ACCEPTANCE_CREDENTIAL_CANARY: 'credential-canary',
  });
  const ordinary = buildCliProviderEnv('codex', { ...source, TUTOR_STUB_SURFACE_ACCEPTANCE: '0' });
  assert.equal('FAKE_CODEX_LOG' in ordinary, false);
  assert.equal('ACCEPTANCE_PRIVATE_PROMPT_CANARY' in ordinary, false);
  assert.equal('UNRELATED_SECRET' in ordinary, false);
});

test('process-session termination reaches the isolated tutor process group on POSIX', () => {
  const groupSignals = [];
  const directSignals = [];
  const child = {
    pid: 43210,
    exitCode: null,
    signalCode: null,
    kill(signal) {
      directSignals.push(signal);
      return true;
    },
  };
  terminateTutorStubProcessTree(child, 'SIGTERM', {
    killProcess(pid, signal) {
      groupSignals.push([pid, signal]);
    },
  });
  if (process.platform === 'win32') {
    assert.deepEqual(directSignals, ['SIGTERM']);
    assert.deepEqual(groupSignals, []);
  } else {
    assert.deepEqual(groupSignals, [[-43210, 'SIGTERM']]);
    assert.deepEqual(directSignals, []);
  }
});

test('an expected host interrupt presents a bounded conflict instead of an internal failure', async () => {
  let rejectStep;
  let status = 'created';
  const runtime = {
    id: 'interrupt-presentation',
    get status() {
      return status;
    },
    snapshot() {
      return { sessionId: runtime.id, status, state: { publicMessages: [] } };
    },
    load() {
      status = 'active';
    },
    resume() {},
    reset() {},
    step() {
      return new Promise((_resolve, reject) => {
        rejectStep = reject;
      });
    },
    terminate() {
      status = 'terminated';
      const error = new Error('private termination detail');
      error.code = 'session_terminated';
      error.fatalSession = true;
      rejectStep?.(error);
    },
    finalize() {},
  };
  const host = createTutorStubSessionHost({ createSession: () => runtime });
  await host.create({ id: runtime.id });
  const pending = host.step(runtime.id, 'delayed turn');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(host.interrupt(runtime.id, 'acceptance_interrupt').result.interrupted, true);
  await assert.rejects(
    pending,
    (error) => error.code === 'session_interrupted' && error.status === 409 && !error.message.includes('private'),
  );
});

test('named commands and CI run the shared scenario without forced exit or paid providers', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/tutor-stub-surface-acceptance.yml'), 'utf8');
  const desktopMain = fs.readFileSync(path.join(ROOT, 'desktop/main.js'), 'utf8');
  const webRunner = fs.readFileSync(path.join(ROOT, 'desktop/tutorStubAcceptanceRunner.mjs'), 'utf8');
  const fakeProvider = fs.readFileSync(path.join(FIXTURE, 'fake-codex.mjs'), 'utf8');

  assert.equal(
    manifest.scripts['tutor:stub:acceptance:web'],
    'node scripts/run-tutor-stub-surface-acceptance.mjs --host web',
  );
  assert.equal(
    manifest.scripts['tutor:stub:acceptance:packaged'],
    'node scripts/run-tutor-stub-surface-acceptance.mjs --host packaged-electron',
  );
  assert.match(workflow, /npm run tutor:stub:acceptance:web/u);
  assert.match(workflow, /npm run tutor:stub:acceptance:packaged/u);
  assert.match(workflow, /if: failure\(\)/u);
  assert.doesNotMatch(workflow, /test-force-exit/u);
  assert.match(desktopMain, /import\('\.\/tutorStubAcceptanceScenario\.mjs'\)/u);
  assert.match(webRunner, /runTutorStubSurfaceAcceptance/u);
  assert.match(fakeProvider, /ACCEPTANCE_DELAYED_TUTOR_RESULT/u);
  assert.doesNotMatch(fakeProvider, /https?:\/\//u);
});
