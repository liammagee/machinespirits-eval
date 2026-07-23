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
  assert.equal(fetched.body.session.lifecycle.finalizedReason, 'http_test_complete');
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
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error.code, 'session_state_conflict');
});
