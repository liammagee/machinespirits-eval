import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveTutorStubCapabilities } from '../services/tutorStubCapabilities.js';
import {
  TUTOR_STUB_SESSION_EVENT_SCHEMA,
  TUTOR_STUB_SESSION_RUNTIME_SCHEMA,
  TUTOR_STUB_SESSION_RUNTIME_VERSION,
  assertTutorStubCommandHandlers,
  createTutorStubCommandHandlers,
  createTutorStubSessionRuntime,
} from '../services/tutorStubSessionRuntime.js';

function capabilities(overrides = {}) {
  return resolveTutorStubCapabilities({
    interactive: true,
    world: true,
    classifier: true,
    registerSelection: true,
    responseChecks: true,
    ...overrides,
  });
}

function fixedClock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 6, 23, 2, 0, tick++));
}

test('session runtime owns explicit create, load, resume, step, reset, and finalize transitions', async () => {
  let projected = { turns: [], resumed: false, finalized: false };
  const invocations = [];
  const events = [];
  const handlers = createTutorStubCommandHandlers((invocation) => {
    invocations.push(invocation);
    projected.lastCommand = invocation.id;
    return { handled: true, id: invocation.id };
  });
  assert.equal(assertTutorStubCommandHandlers(handlers), true);

  const runtime = createTutorStubSessionRuntime({
    id: 'runtime-contract',
    capabilities: capabilities(),
    initialState: projected,
    commandHandlers: handlers,
    now: fixedClock(),
    onEvent: (event) => events.push(event),
    adapters: {
      snapshot: () => projected,
      resume: ({ payload }) => {
        projected = { ...projected, resumed: true, resumeSource: payload.source };
      },
      step: ({ payload }) => {
        projected = {
          ...projected,
          turns: [...projected.turns, { learner: payload.input, tutor: `fake:${payload.input}` }],
        };
        return projected.turns.at(-1);
      },
      reset: () => {
        projected = { ...projected, turns: [] };
        return true;
      },
      finalize: ({ payload }) => {
        projected = { ...projected, finalized: true, finalizedReason: payload.reason };
      },
    },
  });

  assert.equal(runtime.status, 'created');
  runtime.load({ source: 'configuration' });
  runtime.resume({ source: 'trace/example.jsonl', turns: 0 });
  assert.deepEqual(runtime.step('hello', { kind: 'learner', context: { source: 'test' } }), {
    learner: 'hello',
    tutor: 'fake:hello',
  });
  assert.deepEqual(runtime.step('/a technical', { kind: 'command' }), {
    handled: true,
    id: 'analysis',
  });
  await runtime.reset({ reason: 'test_reset' });
  const finalized = runtime.finalize('test_complete');

  assert.equal(finalized.schema, TUTOR_STUB_SESSION_RUNTIME_SCHEMA);
  assert.equal(finalized.version, TUTOR_STUB_SESSION_RUNTIME_VERSION);
  assert.equal(finalized.status, 'finalized');
  assert.equal(finalized.lifecycle.finalizedReason, 'test_complete');
  assert.deepEqual(finalized.state.turns, []);
  assert.equal(finalized.state.resumed, true);
  assert.equal(finalized.state.finalized, true);
  assert.deepEqual(finalized.counters, {
    loads: 1,
    resumes: 1,
    resets: 1,
    steps: 2,
    commands: 1,
    learnerSteps: 1,
  });
  assert.equal(invocations[0].id, 'analysis');
  assert.equal(invocations[0].canonicalToken, '/analysis');
  assert.equal(invocations[0].argument, 'technical');
  assert.equal(
    events.every((event) => event.schema === TUTOR_STUB_SESSION_EVENT_SCHEMA),
    true,
  );
  assert.equal(
    events.some((event) => event.traceEvent === 'interactive_command_analysis'),
    true,
  );
  assert.equal(Object.isFrozen(finalized), true);
  assert.equal(Object.isFrozen(finalized.events), true);
  assert.deepEqual(runtime.finalize('ignored_after_finalize'), finalized);
});

test('two session runtimes remain isolated in one process', () => {
  const makeRuntime = (id) => {
    let state = { id, inputs: [] };
    const runtime = createTutorStubSessionRuntime({
      id,
      capabilities: capabilities(),
      initialState: state,
      now: fixedClock(),
      adapters: {
        snapshot: () => state,
        step: ({ payload }) => {
          state = { ...state, inputs: [...state.inputs, payload.input] };
          return state.inputs.length;
        },
      },
    });
    runtime.load();
    return runtime;
  };
  const alpha = makeRuntime('alpha');
  const beta = makeRuntime('beta');

  alpha.step('one', { kind: 'learner' });
  alpha.step('two', { kind: 'learner' });
  beta.step('other', { kind: 'learner' });

  assert.deepEqual(alpha.snapshot().state.inputs, ['one', 'two']);
  assert.deepEqual(beta.snapshot().state.inputs, ['other']);
  assert.equal(alpha.snapshot().counters.steps, 2);
  assert.equal(beta.snapshot().counters.steps, 1);
});

test('capability filtering rejects inactive commands before their registered handler runs', () => {
  let invoked = 0;
  let rejection = null;
  const runtime = createTutorStubSessionRuntime({
    id: 'direct-command-filter',
    capabilities: capabilities(),
    commandHandlers: createTutorStubCommandHandlers(() => {
      invoked += 1;
      return true;
    }),
    adapters: {
      commandUnavailable: (details) => {
        rejection = details;
        return true;
      },
    },
  });
  runtime.load();

  assert.equal(runtime.step('/suggest', { kind: 'command' }), true);
  assert.equal(invoked, 0);
  assert.equal(rejection.id, 'suggest');
  assert.deepEqual(rejection.reasons, ['mixed learner drafting is not active']);
  assert.equal(runtime.snapshot().events.at(-1).event, 'command_rejected');
});

test('six session modes preserve the same fake-provider lifecycle trace and public turn', () => {
  const configurations = {
    passthrough: {
      passthrough: true,
      interactive: false,
      world: false,
      classifier: false,
      registerSelection: false,
      responseChecks: false,
    },
    direct: {},
    scaffold: { learnerDag: true },
    mixed: { mixedLearner: true },
    auto: { interactive: false, autoLearner: true },
    curriculum: { curriculum: true, world: false },
  };
  const expectedEvents = [
    'created',
    'load_started',
    'load_completed',
    'step_started',
    'step_completed',
    'finalize_started',
    'finalize_completed',
  ];

  for (const [mode, overrides] of Object.entries(configurations)) {
    let state = { publicTurns: [] };
    const runtime = createTutorStubSessionRuntime({
      id: `mode-${mode}`,
      capabilities: capabilities(overrides),
      initialState: state,
      now: fixedClock(),
      adapters: {
        snapshot: () => state,
        step: ({ payload }) => {
          state = {
            publicTurns: [...state.publicTurns, { learner: payload.input, tutor: 'fake-provider-response' }],
          };
          return state.publicTurns.at(-1);
        },
      },
    });
    runtime.load({ source: 'golden-fixture' });
    runtime.step('same learner input', { kind: 'learner' });
    const snapshot = runtime.finalize('golden_complete');

    assert.equal(snapshot.capabilitySnapshot.mode, mode);
    assert.deepEqual(snapshot.state.publicTurns, [{ learner: 'same learner input', tutor: 'fake-provider-response' }]);
    assert.deepEqual(
      snapshot.events.map((event) => event.event),
      expectedEvents,
      mode,
    );
  }
});

test('runtime rejects incompatible capability snapshots and incomplete handler maps', () => {
  assert.throws(
    () =>
      createTutorStubSessionRuntime({
        capabilities: capabilities({ curriculum: true, world: true }),
      }),
    /capability snapshot is incompatible/u,
  );
  assert.throws(() => assertTutorStubCommandHandlers({ analysis: () => true }), /missing tutor-stub command handlers/u);
});
