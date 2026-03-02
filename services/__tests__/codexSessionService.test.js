import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import pty from 'node-pty';

import {
  createCodexSession,
  listCodexSessions,
  getCodexSession,
  pollCodexSession,
  writeCodexSessionInput,
  terminateCodexSession
} from '../codexSessionService.js';

describe('codexSessionService', () => {
  let mockProcess;

  beforeEach(() => {
    mockProcess = {
      pid: 1234,
      write: mock.fn(),
      kill: mock.fn(),
      onData: mock.fn(),
      onExit: mock.fn()
    };

    mock.method(pty, 'spawn', () => mockProcess);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('handles basic lifecycle: create, list, data, input, exit, terminate', () => {
    // 1. Create
    const session = createCodexSession({ args: ['--help'], cwd: process.cwd() });
    assert.equal(session.command, 'codex');
    assert.deepEqual(session.args, ['--help']);
    assert.equal(session.status, 'running');
    
    // 2. List & Get
    const list = listCodexSessions();
    assert.ok(list.some(s => s.id === session.id));
    assert.equal(getCodexSession(session.id).id, session.id);
    assert.equal(getCodexSession('bad-id'), null);

    // 3. Data & Terminal Queries
    const onDataCallback = mockProcess.onData.mock.calls[0].arguments[0];
    onDataCallback('hello world');
    onDataCallback('\u001b[6n'); // Query
    assert.equal(mockProcess.write.mock.calls[0].arguments[0], '\u001b[1;1R'); // Response

    // 4. Polling with cursor
    const polled = pollCodexSession(session.id, -1);
    assert.equal(polled.events.length, 2);
    assert.equal(polled.events[0].text, 'hello world');
    
    const polledLater = pollCodexSession(session.id, 0);
    assert.equal(polledLater.events.length, 1);
    assert.equal(polledLater.events[0].text, '\u001b[6n');

    // 5. Input
    writeCodexSessionInput(session.id, 'ls -la');
    assert.equal(mockProcess.write.mock.calls[1].arguments[0], 'ls -la\r');
    
    // 6. Terminate
    terminateCodexSession(session.id);
    assert.equal(mockProcess.kill.mock.calls[0].arguments[0], 'SIGTERM');

    // 7. Exit
    const onExitCallback = mockProcess.onExit.mock.calls[0].arguments[0];
    onExitCallback({ exitCode: 0, signal: 0 });
    
    const final = getCodexSession(session.id);
    assert.equal(final.status, 'exited');
    assert.equal(final.exitCode, 0);

    // 8. Re-terminate
    const retryTerm = terminateCodexSession(session.id);
    assert.equal(retryTerm.alreadyExited, true);
  });

  it('handles edge cases: bad cwd, sanitized args, write validation', () => {
    assert.throws(() => {
      createCodexSession({ cwd: '/does/not/exist/at/all/123' });
    }, /cwd does not exist/);

    const session = createCodexSession({ args: [null, '', 'valid', 123] });
    assert.deepEqual(session.args, ['valid']);

    assert.throws(() => writeCodexSessionInput(session.id, 123), /must be a string/);
    assert.throws(() => writeCodexSessionInput('missing', 'test'), /not found/);
  });
});