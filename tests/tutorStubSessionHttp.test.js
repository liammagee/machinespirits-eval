import assert from 'node:assert/strict';
import { once } from 'node:events';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import express from 'express';

import { TUTOR_STUB_SESSION_HTTP_SCHEMA } from '../routes/tutorStubSessionRoutes.js';
import { resolveTutorStubCapabilities } from '../services/tutorStubCapabilities.js';
import { mountEvalSurfaces } from '../services/evalSurfaces.js';
import { createTutorStubSessionHost } from '../services/tutorStubSessionHost.js';
import { createTutorStubCommandHandlers, createTutorStubSessionRuntime } from '../services/tutorStubSessionRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function capabilities() {
  return resolveTutorStubCapabilities({
    interactive: true,
    world: true,
    classifier: true,
    registerSelection: true,
    responseChecks: true,
  });
}

function fakeSessionFactory({ delayMs = 0 } = {}) {
  return (specification) => {
    let state = {
      label: specification.label || specification.id,
      turns: [],
      commands: [],
      resumes: 0,
      resets: 0,
      finalizedReason: null,
    };
    return createTutorStubSessionRuntime({
      id: specification.id,
      capabilities: capabilities(),
      initialState: state,
      commandHandlers: createTutorStubCommandHandlers(async (invocation) => {
        state = { ...state, commands: [...state.commands, invocation.id] };
        return { handled: invocation.id };
      }),
      adapters: {
        snapshot: () => state,
        async step({ payload }) {
          if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
          const turn = { learner: payload.input, tutor: `fake:${payload.input}` };
          state = { ...state, turns: [...state.turns, turn] };
          return turn;
        },
        resume() {
          state = { ...state, resumes: state.resumes + 1 };
        },
        reset() {
          state = { ...state, turns: [], resets: state.resets + 1 };
        },
        finalize({ payload }) {
          state = { ...state, finalizedReason: payload.reason };
        },
      },
    });
  };
}

async function withServer(t, createSession = fakeSessionFactory()) {
  const host = createTutorStubSessionHost({ createSession, maxSessions: 8 });
  const app = express();
  app.use(express.json());
  mountEvalSurfaces(app, { root: ROOT, tutorStubSessionHost: host });
  app.use((error, _req, res, _next) => {
    res.status(500).json({ error: error.message });
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const { port } = server.address();
  return `http://127.0.0.1:${port}/api/tutor-stub`;
}

async function request(base, path = '', { method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test('headless HTTP mutations reject form posts and cross-origin JSON before allocating a session', async (t) => {
  const base = await withServer(t);
  const formResponse = await fetch(`${base}/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'id=foreign-form',
  });
  const formBody = await formResponse.json();
  assert.equal(formResponse.status, 415);
  assert.equal(formBody.error.code, 'invalid_content_type');

  const crossOriginResponse = await fetch(`${base}/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://foreign.example' },
    body: JSON.stringify({ id: 'foreign-json' }),
  });
  const crossOriginBody = await crossOriginResponse.json();
  assert.equal(crossOriginResponse.status, 403);
  assert.equal(crossOriginBody.error.code, 'cross_origin_request_denied');

  const { port } = new URL(base);
  const rebindingResponse = await fetch(`${base}/sessions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: `evil.example:${port}`,
      origin: `http://evil.example:${port}`,
    },
    body: JSON.stringify({ id: 'dns-rebinding-json' }),
  });
  const rebindingBody = await rebindingResponse.json();
  assert.equal(rebindingResponse.status, 403);
  assert.equal(rebindingBody.error.code, 'cross_origin_request_denied');

  const list = await request(base, '/sessions');
  assert.equal(list.body.count, 0);
});

test('headless HTTP transport redacts unexpected runtime diagnostics', async (t) => {
  const secretCanary = 'PRIVATE-PROVIDER-STDERR-CANARY';
  const createSession = (specification) => {
    let status = 'created';
    return {
      id: specification.id,
      get status() {
        return status;
      },
      load() {
        status = 'active';
      },
      resume() {},
      reset() {},
      step() {
        throw new Error(secretCanary);
      },
      finalize() {},
      snapshot() {
        return {
          sessionId: specification.id,
          status,
          state: {},
          events: [{ type: 'adapter_error', error: secretCanary }],
        };
      },
    };
  };
  const base = await withServer(t, createSession);
  await request(base, '/sessions', { method: 'POST', body: { id: 'redacted-runtime' } });
  const failed = await request(base, '/sessions/redacted-runtime/steps', {
    method: 'POST',
    body: { input: 'trigger failure' },
  });
  assert.equal(failed.status, 500);
  assert.equal(failed.body.error.code, 'session_internal_error');
  assert.doesNotMatch(JSON.stringify(failed.body), new RegExp(secretCanary, 'u'));

  const fetched = await request(base, '/sessions/redacted-runtime');
  const listed = await request(base, '/sessions');
  assert.equal('events' in fetched.body.session, false);
  assert.equal('events' in listed.body.sessions[0], false);
  assert.doesNotMatch(JSON.stringify({ fetched: fetched.body, listed: listed.body }), new RegExp(secretCanary, 'u'));
});

test('headless HTTP transport exposes the versioned lifecycle contract', async (t) => {
  const base = await withServer(t);

  const contract = await request(base);
  assert.equal(contract.status, 200);
  assert.equal(contract.body.schema, TUTOR_STUB_SESSION_HTTP_SCHEMA);
  assert.equal(contract.body.runtime.version, 1);

  const created = await request(base, '/sessions', {
    method: 'POST',
    body: { id: 'alpha', label: 'Alpha session' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.session.sessionId, 'alpha');
  assert.equal(created.body.session.status, 'active');

  const stepped = await request(base, '/sessions/alpha/steps', {
    method: 'POST',
    body: { input: 'hello', kind: 'learner', context: { source: 'http_test' } },
  });
  assert.deepEqual(stepped.body.result, { learner: 'hello', tutor: 'fake:hello' });
  assert.deepEqual(stepped.body.session.state.turns, [{ learner: 'hello', tutor: 'fake:hello' }]);

  const commanded = await request(base, '/sessions/alpha/steps', {
    method: 'POST',
    body: { input: '/analysis technical', kind: 'command' },
  });
  assert.deepEqual(commanded.body.result, { handled: 'analysis' });
  assert.deepEqual(commanded.body.session.state.commands, ['analysis']);

  const resumed = await request(base, '/sessions/alpha/resume', { method: 'POST', body: { source: 'saved-trace' } });
  assert.equal(resumed.body.session.state.resumes, 1);

  const reset = await request(base, '/sessions/alpha/reset', { method: 'POST', body: { reason: 'new_topic' } });
  assert.deepEqual(reset.body.session.state.turns, []);
  assert.equal(reset.body.session.state.resets, 1);

  const finalized = await request(base, '/sessions/alpha/finalize', {
    method: 'POST',
    body: { reason: 'http_test_complete' },
  });
  assert.equal(finalized.body.session.status, 'finalized');
  assert.equal(finalized.body.session.state.finalizedReason, 'http_test_complete');

  const fetched = await request(base, '/sessions/alpha');
  assert.equal(fetched.status, 404);
  assert.equal(fetched.body.error.code, 'session_not_found');
});

test('headless HTTP sessions remain isolated and listable', async (t) => {
  const base = await withServer(t);
  await request(base, '/sessions', { method: 'POST', body: { id: 'alpha' } });
  await request(base, '/sessions', { method: 'POST', body: { id: 'beta' } });
  await request(base, '/sessions/alpha/steps', { method: 'POST', body: { input: 'only alpha' } });

  const beta = await request(base, '/sessions/beta');
  assert.deepEqual(beta.body.session.state.turns, []);

  const list = await request(base, '/sessions');
  assert.equal(list.body.count, 2);
  assert.deepEqual(
    list.body.sessions.map((session) => session.sessionId),
    ['alpha', 'beta'],
  );
});

test('headless host serializes concurrent mutations within one session', async (t) => {
  const base = await withServer(t, fakeSessionFactory({ delayMs: 15 }));
  await request(base, '/sessions', { method: 'POST', body: { id: 'serialized' } });

  const [first, second] = await Promise.all([
    request(base, '/sessions/serialized/steps', { method: 'POST', body: { input: 'first' } }),
    request(base, '/sessions/serialized/steps', { method: 'POST', body: { input: 'second' } }),
  ]);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const current = await request(base, '/sessions/serialized');
  assert.deepEqual(
    current.body.session.state.turns.map((turn) => turn.learner),
    ['first', 'second'],
  );
});

test('headless HTTP transport returns stable validation and lifecycle errors', async (t) => {
  const base = await withServer(t);
  await request(base, '/sessions', { method: 'POST', body: { id: 'alpha' } });

  const duplicate = await request(base, '/sessions', { method: 'POST', body: { id: 'alpha' } });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'session_exists');

  const invalid = await request(base, '/sessions/alpha/steps', {
    method: 'POST',
    body: { input: '', kind: 'learner' },
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'invalid_request');

  const invalidReason = await request(base, '/sessions/alpha/finalize', {
    method: 'POST',
    body: { reason: { not: 'text' } },
  });
  assert.equal(invalidReason.status, 400);
  assert.equal(invalidReason.body.error.code, 'invalid_request');

  const missing = await request(base, '/sessions/missing');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, 'session_not_found');

  await request(base, '/sessions/alpha/finalize', { method: 'POST', body: {} });
  const conflict = await request(base, '/sessions/alpha/steps', { method: 'POST', body: { input: 'too late' } });
  assert.equal(conflict.status, 404);
  assert.equal(conflict.body.error.code, 'session_not_found');
});

test('headless host shutdown interrupts in-flight work and releases capacity', async () => {
  let status = 'created';
  let rejectStep;
  let terminated = 0;
  let state = { turnCount: 0 };
  const createSession = () => ({
    id: 'interruptible',
    get status() {
      return status;
    },
    load() {
      status = 'active';
      return this.snapshot();
    },
    resume() {},
    reset() {},
    step() {
      return new Promise((_resolve, reject) => {
        rejectStep = reject;
      });
    },
    finalize() {
      status = 'finalized';
      return this.snapshot();
    },
    snapshot() {
      return { sessionId: 'interruptible', status, state };
    },
    terminate(reason) {
      terminated += 1;
      state = { ...state, terminationReason: reason };
      const error = new Error(`terminated: ${reason}`);
      error.fatalSession = true;
      rejectStep?.(error);
    },
  });
  const host = createTutorStubSessionHost({ createSession, maxSessions: 1 });
  await host.create({ id: 'interruptible' });
  const pendingStep = host.step('interruptible', 'never completes');
  await new Promise((resolve) => setImmediate(resolve));

  await host.closeAll('test_shutdown');
  await assert.rejects(pendingStep, /terminated: test_shutdown/u);
  assert.equal(terminated, 1);
  assert.deepEqual(host.list(), []);

  const replacement = await host.create({ id: 'interruptible' });
  assert.equal(replacement.status, 'active');
  await host.closeAll('replacement_cleanup');
});

test('headless HTTP interruption bypasses an in-flight mutation, evicts the session, and releases capacity', async (t) => {
  let rejectStep;
  let signalStepStarted;
  const stepStarted = new Promise((resolve) => {
    signalStepStarted = resolve;
  });
  let terminationReason = null;
  const createSession = (specification) => {
    let status = 'created';
    return {
      id: specification.id,
      get status() {
        return status;
      },
      load() {
        status = 'active';
      },
      resume() {},
      reset() {},
      step() {
        return new Promise((_resolve, reject) => {
          rejectStep = reject;
          signalStepStarted();
        });
      },
      finalize() {},
      snapshot() {
        return { sessionId: specification.id, status, state: {} };
      },
      terminate(reason) {
        terminationReason = reason;
        const error = new Error(`terminated: ${reason}`);
        error.fatalSession = true;
        rejectStep?.(error);
      },
    };
  };
  const base = await withServer(t, createSession);
  await request(base, '/sessions', { method: 'POST', body: { id: 'interrupt-http' } });
  const pendingStep = request(base, '/sessions/interrupt-http/steps', {
    method: 'POST',
    body: { input: 'wait forever' },
  });
  await stepStarted;

  const interrupted = await request(base, '/sessions/interrupt-http/interrupt', {
    method: 'POST',
    body: { reason: 'browser_stop' },
  });
  assert.equal(interrupted.status, 200);
  assert.deepEqual(interrupted.body.result, {
    sessionId: 'interrupt-http',
    interrupted: true,
    reason: 'browser_stop',
  });
  assert.equal(terminationReason, 'browser_stop');
  assert.equal((await request(base, '/sessions/interrupt-http')).status, 404);
  assert.equal((await request(base, '/sessions', { method: 'POST', body: { id: 'interrupt-http' } })).status, 201);

  const terminatedStep = await pendingStep;
  assert.equal(terminatedStep.status, 500);
  assert.deepEqual(terminatedStep.body.error, {
    code: 'session_internal_error',
    message: 'Tutor-stub session operation failed',
  });
  assert.doesNotMatch(JSON.stringify(terminatedStep.body), /terminated: browser_stop/u);
});

test('headless host evicts a process-like runtime when its closed signal settles', async () => {
  let status = 'created';
  let closeRuntime;
  let terminated = 0;
  const closed = new Promise((resolve) => {
    closeRuntime = resolve;
  });
  const runtime = {
    id: 'crashable',
    get status() {
      return status;
    },
    closed,
    load() {
      status = 'active';
    },
    resume() {},
    reset() {},
    step() {},
    finalize() {
      status = 'finalized';
    },
    snapshot() {
      return { sessionId: 'crashable', status, state: {} };
    },
    terminate() {
      terminated += 1;
    },
  };
  const host = createTutorStubSessionHost({ createSession: () => runtime });
  await host.create({ id: 'crashable' });
  closeRuntime({ reason: 'process_exit' });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(host.list(), []);
  assert.equal(terminated, 1);
});

test('headless host rejects a runtime that closes during creation', async () => {
  let status = 'created';
  let terminated = 0;
  const runtime = {
    id: 'closed-during-create',
    get status() {
      return status;
    },
    closed: Promise.resolve({ reason: 'startup_failure' }),
    load() {
      status = 'active';
    },
    resume() {},
    reset() {},
    step() {},
    finalize() {},
    snapshot() {
      return { sessionId: 'closed-during-create', status, state: {} };
    },
    terminate() {
      terminated += 1;
    },
  };
  const host = createTutorStubSessionHost({ createSession: () => runtime });

  await assert.rejects(
    host.create({ id: 'closed-during-create' }),
    (error) => error?.code === 'session_closed_during_create' && error?.status === 503,
  );
  assert.deepEqual(host.list(), []);
  assert.equal(terminated, 1);
});
