import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';

import {
  ApplicationShutdownTimeoutError,
  installApplicationShutdownHandlers,
  shutdownApplication,
} from '../services/applicationShutdown.js';
import { createEvaluationStreamRegistry } from '../services/evaluationStreamRegistry.js';

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
  const streamRegistry = createEvaluationStreamRegistry({ logger: { log() {}, warn() {}, error() {} } });
  const streamResponse = {
    writableEnded: false,
    write(message) {
      events.push(`stream.write:${message}`);
    },
    end() {
      events.push('stream.end');
      this.writableEnded = true;
    },
  };
  streamRegistry.registerStream(
    streamResponse,
    setInterval(() => {}, 60_000),
  );
  const app = {
    locals: {
      cleanupEvaluationStreams: streamRegistry.cleanupAllStreams,
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
  assert.ok(events.includes('stream.write:event: error\ndata: {"error": "Server restarting"}\n\n'));
  assert.ok(events.includes('stream.end'));
  assert.equal(streamResponse.writableEnded, true);
  assert.equal(streamRegistry.activeCount, 0);
  assert.ok(events.includes('host.closeAll:SIGTERM'));
  assert.equal(events.at(-1), 'db.close');
});

test('shutdown drains a live tracked SSE response before the HTTP server closes', async (t) => {
  const streamRegistry = createEvaluationStreamRegistry({ logger: { log() {}, warn() {}, error() {} } });
  const registered = new EventEmitter();
  const server = createServer((_request, response) => {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const keepAlive = setInterval(() => response.write(': keep-alive\n\n'), 60_000);
    streamRegistry.registerStream(response, keepAlive);
    response.write('event: ready\ndata: {}\n\n');
    registered.emit('stream');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    streamRegistry.cleanupAllStreams();
    if (server.listening) server.close();
  });

  const response = await fetch(`http://127.0.0.1:${server.address().port}`);
  if (streamRegistry.activeCount === 0) await once(registered, 'stream');
  const body = response.text();

  const result = await shutdownApplication({
    app: { locals: { cleanupEvaluationStreams: streamRegistry.cleanupAllStreams } },
    server,
    reason: 'SIGTERM',
    timeoutMs: 250,
  });

  assert.deepEqual(result, { reason: 'SIGTERM', closed: true });
  assert.equal(server.listening, false);
  assert.equal(streamRegistry.activeCount, 0);
  assert.equal(await body, 'event: ready\ndata: {}\n\nevent: error\ndata: {"error": "Server restarting"}\n\n');
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
