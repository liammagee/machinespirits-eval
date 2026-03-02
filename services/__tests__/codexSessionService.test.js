import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import pty from 'node-pty';
import fs from 'fs';
import path from 'path';

import {
  createCodexSession,
  listCodexSessions,
  getCodexSession,
  pollCodexSession,
  writeCodexSessionInput,
  terminateCodexSession,
} from '../codexSessionService.js';

describe('codexSessionService', () => {
  let spawnMock;
  let mockProcess;

  beforeEach(() => {
    // Clear the sessions map by exploiting the stale cleanup (since it's private state)
    // Actually, since it's private state, the best way to reset is to mock Date.now() to
    // a time far in the future and call listCodexSessions(), but we need to fake exitedAt.
    // We'll just trust the isolation or mock what we can.

    mockProcess = {
      pid: 1234,
      write: mock.fn(),
      kill: mock.fn(),
      onData: mock.fn(),
      onExit: mock.fn(),
    };

    spawnMock = mock.method(pty, 'spawn', () => mockProcess);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('creates a session successfully', () => {
    const session = createCodexSession({ args: ['--help'], cwd: process.cwd() });

    assert.equal(session.command, 'codex');
    assert.deepEqual(session.args, ['--help']);
    assert.equal(session.status, 'running');
    assert.equal(session.pid, 1234);

    // Verify pty.spawn was called correctly
    assert.equal(spawnMock.mock.calls.length, 1);
    const callArgs = spawnMock.mock.calls[0].arguments;
    assert.equal(callArgs[0], 'codex');
    assert.deepEqual(callArgs[1], ['--help']);
    assert.equal(callArgs[2].cwd, process.cwd());
  });

  it('sanitizes args and handles bad cwd', () => {
    assert.throws(() => {
      createCodexSession({ cwd: '/does/not/exist/at/all/123' });
    }, /cwd does not exist/);

    const session = createCodexSession({ args: [null, '', 'valid', 123] });
    assert.deepEqual(session.args, ['valid']);
  });

  it('lists and gets sessions', () => {
    const session = createCodexSession();

    const list = listCodexSessions();
    assert.ok(list.some((s) => s.id === session.id));

    const fetched = getCodexSession(session.id);
    assert.equal(fetched.id, session.id);

    assert.equal(getCodexSession('bad-id'), null);
  });

  it('captures data and handles terminal queries', () => {
    const session = createCodexSession();
    const onDataCallback = mockProcess.onData.mock.calls[0].arguments[0];

    onDataCallback('hello world');

    const polled = pollCodexSession(session.id);
    assert.equal(polled.events.length, 1);
    assert.equal(polled.events[0].text, 'hello world');

    // Test device status report
    onDataCallback('\u001b[6n');
    assert.equal(mockProcess.write.mock.calls.length, 1);
    assert.equal(mockProcess.write.mock.calls[0].arguments[0], '\u001b[1;1R');
  });

  it('polls events correctly with cursors', () => {
    const session = createCodexSession();
    const onDataCallback = mockProcess.onData.mock.calls[0].arguments[0];

    onDataCallback('event 1');
    onDataCallback('event 2');

    const poll1 = pollCodexSession(session.id, -1);
    assert.equal(poll1.events.length, 2);
    assert.equal(poll1.nextCursor, 1); // event 0 and 1

    const poll2 = pollCodexSession(session.id, 0);
    assert.equal(poll2.events.length, 1);
    assert.equal(poll2.events[0].text, 'event 2');
  });

  it('writes input to session', () => {
    const session = createCodexSession();

    const result = writeCodexSessionInput(session.id, 'ls -la');
    assert.equal(result.accepted, true);

    assert.equal(mockProcess.write.mock.calls.length, 1);
    assert.equal(mockProcess.write.mock.calls[0].arguments[0], 'ls -la\r');

    // Without newline
    writeCodexSessionInput(session.id, 'ctrl-c', false);
    assert.equal(mockProcess.write.mock.calls[1].arguments[0], 'ctrl-c');

    assert.throws(() => writeCodexSessionInput('bad', 'test'), /not found/);
    assert.throws(() => writeCodexSessionInput(session.id, 123), /must be a string/);
  });

  it('handles exit events', () => {
    const session = createCodexSession();
    const onExitCallback = mockProcess.onExit.mock.calls[0].arguments[0];

    onExitCallback({ exitCode: 1, signal: 9 });

    const fetched = getCodexSession(session.id);
    assert.equal(fetched.status, 'exited');
    assert.equal(fetched.exitCode, 1);
    assert.equal(fetched.signal, 9);

    assert.throws(() => writeCodexSessionInput(session.id, 'test'), /not running/);
  });

  it('terminates sessions gracefully', () => {
    const session = createCodexSession();

    const result = terminateCodexSession(session.id);
    assert.equal(result.id, session.id);

    assert.equal(mockProcess.kill.mock.calls.length, 1);
    assert.equal(mockProcess.kill.mock.calls[0].arguments[0], 'SIGTERM');
  });

  it('returns alreadyExited for dead sessions', () => {
    const session = createCodexSession();
    const onExitCallback = mockProcess.onExit.mock.calls[0].arguments[0];
    onExitCallback({ exitCode: 0, signal: 0 });

    const result = terminateCodexSession(session.id);
    assert.equal(result.alreadyExited, true);
  });
});
