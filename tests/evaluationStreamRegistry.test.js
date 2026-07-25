import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { createEvaluationStreamRegistry } from '../services/evaluationStreamRegistry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESTART_EVENT = 'event: error\ndata: {"error": "Server restarting"}\n\n';
const TIMEOUT_EVENT =
  'event: error\ndata: {"error": "Evaluation timeout - exceeded maximum duration", "timeout": true}\n\n';

function quietLogger() {
  return { log() {}, warn() {}, error() {} };
}

function fakeResponse(label, events) {
  return {
    writableEnded: false,
    write(message) {
      events.push(`${label}:write:${message}`);
    },
    end() {
      events.push(`${label}:end`);
      this.writableEnded = true;
    },
  };
}

test('cleanup closes every tracked evaluation stream with the existing restart event', () => {
  const events = [];
  const registry = createEvaluationStreamRegistry({ logger: quietLogger() });
  const firstKeepAlive = setInterval(() => {}, 60_000);
  const secondKeepAlive = setInterval(() => {}, 60_000);
  const first = fakeResponse('first', events);
  const second = fakeResponse('second', events);

  registry.registerStream(first, firstKeepAlive);
  registry.registerStream(second, secondKeepAlive);
  assert.equal(registry.activeCount, 2);

  registry.cleanupAllStreams();

  assert.equal(registry.activeCount, 0);
  assert.equal(first.writableEnded, true);
  assert.equal(second.writableEnded, true);
  assert.deepEqual(events, [
    `first:write:${RESTART_EVENT}`,
    'first:end',
    `second:write:${RESTART_EVENT}`,
    'second:end',
  ]);

  registry.cleanupAllStreams();
  assert.equal(events.length, 4, 'cleanup remains idempotent after the registry is empty');
});

test('unregister removes only the completed stream', () => {
  const events = [];
  const registry = createEvaluationStreamRegistry({ logger: quietLogger() });
  const firstId = registry.registerStream(
    fakeResponse('first', events),
    setInterval(() => {}, 60_000),
  );
  registry.registerStream(
    fakeResponse('second', events),
    setInterval(() => {}, 60_000),
  );

  registry.unregisterStream(firstId);
  assert.equal(registry.activeCount, 1);
  registry.cleanupAllStreams();

  assert.deepEqual(events, [`second:write:${RESTART_EVENT}`, 'second:end']);
});

test('maximum duration preserves the timeout event and unregisters the stream', async () => {
  const events = [];
  const registry = createEvaluationStreamRegistry({
    logger: quietLogger(),
    maxStreamDurationMs: 5,
  });
  const response = fakeResponse('timed', events);
  registry.registerStream(response);

  await delay(20);

  assert.equal(registry.activeCount, 0);
  assert.equal(response.writableEnded, true);
  assert.deepEqual(events, [`timed:write:${TIMEOUT_EVENT}`, 'timed:end']);
});

test('watchdog preserves the approaching-timeout warning event', async () => {
  const events = [];
  let currentTime = 0;
  const registry = createEvaluationStreamRegistry({
    logger: quietLogger(),
    now: () => currentTime,
    maxStreamDurationMs: 1_000,
    timeoutWarningMs: 500,
    watchdogIntervalMs: 5,
  });
  const response = fakeResponse('warning', events);
  registry.registerStream(response);
  currentTime = 600;

  await delay(20);

  assert.equal(response.writableEnded, false);
  assert.deepEqual(events, [
    'warning:write:event: warning\ndata: {"message": "Evaluation will timeout in 0 minutes", "remainingMs": 400}\n\n',
  ]);
  registry.cleanupAllStreams();
});

test('cleaning a tracked stream releases its refed timers so a process exits naturally', () => {
  const source = `
    import { createEvaluationStreamRegistry } from './services/evaluationStreamRegistry.js';
    const registry = createEvaluationStreamRegistry({ logger: { log() {}, warn() {}, error() {} } });
    const response = {
      writableEnded: false,
      write() {},
      end() { this.writableEnded = true; },
    };
    registry.registerStream(response, setInterval(() => {}, 60_000));
    registry.cleanupAllStreams();
    if (!response.writableEnded || registry.activeCount !== 0) process.exitCode = 2;
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 2_500,
  });

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, result.stderr);
});
