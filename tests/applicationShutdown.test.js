import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import test from 'node:test';

import {
  ApplicationShutdownTimeoutError,
  installApplicationShutdownHandlers,
  shutdownApplication,
} from '../services/applicationShutdown.js';

function fakeServer(events) {
  return {
    listening: true,
    close(callback) {
      events.push('server.close');
      this.listening = false;
      setImmediate(callback);
    },
    closeIdleConnections() {
      events.push('server.closeIdleConnections');
    },
  };
}

test('shutdown drains tutor sessions before closing the application database', async () => {
  const events = [];
  const app = {
    locals: {
      tutorStubSessionHost: {
        async closeAll(reason) {
          events.push(`host.closeAll:${reason}`);
        },
      },
      db: {
        open: true,
        close() {
          events.push('db.close');
          this.open = false;
        },
      },
    },
  };

  const result = await shutdownApplication({
    app,
    server: fakeServer(events),
    reason: 'SIGTERM',
    timeoutMs: 250,
  });

  assert.deepEqual(result, { reason: 'SIGTERM', closed: true });
  assert.ok(events.includes('server.close'));
  assert.ok(events.includes('server.closeIdleConnections'));
  assert.ok(events.includes('host.closeAll:SIGTERM'));
  assert.equal(events.at(-1), 'db.close');
});

test('shutdown is bounded when a session host cannot finish draining', async () => {
  const app = {
    locals: {
      tutorStubSessionHost: {
        closeAll() {
          return new Promise(() => {});
        },
      },
    },
  };

  await assert.rejects(
    shutdownApplication({ app, server: fakeServer([]), timeoutMs: 15 }),
    (error) => error instanceof ApplicationShutdownTimeoutError && error.code === 'application_shutdown_timeout',
  );
});

test('shutdown closes the database even when tutor cleanup rejects', async () => {
  let databaseClosed = false;
  const app = {
    locals: {
      tutorStubSessionHost: {
        async closeAll() {
          throw new Error('child cleanup failed');
        },
      },
      db: {
        close() {
          databaseClosed = true;
        },
      },
    },
  };

  await assert.rejects(
    shutdownApplication({ app, server: fakeServer([]), timeoutMs: 250 }),
    /application shutdown failed/u,
  );
  assert.equal(databaseClosed, true);
});

test('installed signal handlers share one cleanup and one exit decision', async () => {
  const signals = new EventEmitter();
  const events = [];
  const app = {
    locals: {
      tutorStubSessionHost: {
        async closeAll(reason) {
          events.push(`host.closeAll:${reason}`);
        },
      },
    },
  };
  const exits = new EventEmitter();
  const controller = installApplicationShutdownHandlers({
    app,
    server: fakeServer(events),
    signalTarget: signals,
    timeoutMs: 250,
    logger: { log() {}, error() {} },
    exit(code) {
      events.push(`exit:${code}`);
      exits.emit('exit', code);
    },
  });

  signals.emit('SIGINT', 'SIGINT');
  signals.emit('SIGTERM', 'SIGTERM');
  const [code] = await once(exits, 'exit');
  assert.equal(code, 0);
  assert.equal(events.filter((event) => event.startsWith('host.closeAll')).length, 1);
  assert.ok(events.includes('host.closeAll:SIGINT'));
  assert.equal(events.filter((event) => event.startsWith('exit:')).length, 1);
  assert.equal(signals.listenerCount('SIGINT'), 0);
  assert.equal(signals.listenerCount('SIGTERM'), 0);
  controller.dispose();
});
