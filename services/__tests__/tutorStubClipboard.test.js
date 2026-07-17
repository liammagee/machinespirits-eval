import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { copyTutorStubTextToClipboard, formatTutorStubDebugClipboardText } from '../tutorStubClipboard.js';

describe('tutor-stub clipboard', () => {
  it('formats the complete debug block for pasting into Codex', () => {
    assert.equal(
      formatTutorStubDebugClipboardText({
        runId: 'run-123',
        selectedId: 'run-123:t004',
        completedId: 'run-123:t003',
        activeId: 'run-123:t004',
        tracePath: '/tmp/run-123.jsonl',
      }),
      [
        'debug id > run-123:t004',
        'run id: run-123',
        'last completed turn: run-123:t003',
        'in-progress turn: run-123:t004',
        'trace: /tmp/run-123.jsonl',
      ].join('\n'),
    );
  });

  it('uses the native macOS clipboard command with the debug block on stdin', () => {
    const calls = [];
    const result = copyTutorStubTextToClipboard('debug id > run:t001', {
      platform: 'darwin',
      env: {},
      spawn(command, args, options) {
        calls.push({ command, args, options });
        return { status: 0 };
      },
    });

    assert.equal(result.copied, true);
    assert.equal(result.method, 'pbcopy');
    assert.equal(calls[0].command, 'pbcopy');
    assert.deepEqual(calls[0].args, []);
    assert.equal(calls[0].options.input, 'debug id > run:t001');
  });

  it('falls through Linux clipboard commands without failing the CLI', () => {
    const commands = [];
    const result = copyTutorStubTextToClipboard('debug block', {
      platform: 'linux',
      env: {},
      spawn(command) {
        commands.push(command);
        return { status: 1 };
      },
    });

    assert.equal(result.copied, false);
    assert.equal(result.status, 'unavailable');
    assert.deepEqual(commands, ['wl-copy', 'xclip', 'xsel']);
  });
});
