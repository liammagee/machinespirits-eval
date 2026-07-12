import assert from 'node:assert/strict';
import test from 'node:test';

import { createTutorStubConcurrentTerminal } from '../services/tutorStubConcurrentTerminal.js';

function fixture() {
  let written = '';
  const output = {
    isTTY: true,
    write(value) {
      written += String(value);
      return true;
    },
  };
  const rl = {
    line: '/sta',
    cursor: 4,
    promptCalls: [],
    prompt(preserveCursor) {
      this.promptCalls.push(preserveCursor);
      output.write(`learner > ${this.line}`);
    },
  };
  return { output, rl, written: () => written };
}

test('concurrent terminal redraws activity above preserved readline input', () => {
  const { output, rl, written } = fixture();
  const terminal = createTutorStubConcurrentTerminal({ rl, output });

  terminal.show();
  terminal.setStatus('calling auto learner · 0.8s');
  terminal.print(() => output.write('learner(auto) > generated reply\n'));

  assert.deepEqual(rl.promptCalls, [true, true, true]);
  assert.match(written(), /calling auto learner · 0\.8s\nlearner > \/sta/u);
  assert.match(written(), /learner\(auto\) > generated reply\ncalling auto learner · 0\.8s\nlearner > \/sta/u);
  assert.deepEqual(terminal.snapshot(), {
    enabled: true,
    closed: false,
    surfaceVisible: true,
    statusVisible: true,
    renderedRows: 1,
    status: 'calling auto learner · 0.8s',
    palette: [],
  });
});

test('concurrent terminal keeps a multi-line command palette above preserved input', () => {
  const { output, rl, written } = fixture();
  const terminal = createTutorStubConcurrentTerminal({ rl, output });

  terminal.show();
  terminal.setStatus('model working');
  terminal.setPalette(['slash commands · 2 matches', '  /status  /settings']);
  terminal.print(() => output.write('background result\n'));

  assert.match(
    written(),
    /background result\nmodel working\nslash commands · 2 matches\n {2}\/status {2}\/settings\nlearner > \/sta/u,
  );
  assert.deepEqual(terminal.snapshot(), {
    enabled: true,
    closed: false,
    surfaceVisible: true,
    statusVisible: true,
    renderedRows: 3,
    status: 'model working',
    palette: ['slash commands · 2 matches', '  /status  /settings'],
  });
});

test('submitted input turns the old activity row into scrollback until the next prompt', () => {
  const { output, rl } = fixture();
  const terminal = createTutorStubConcurrentTerminal({ rl, output });

  terminal.show();
  terminal.setStatus('model working');
  terminal.acceptLine();
  terminal.setStatus('finalizing result');

  assert.equal(rl.promptCalls.length, 2);
  assert.deepEqual(terminal.snapshot(), {
    enabled: true,
    closed: false,
    surfaceVisible: false,
    statusVisible: false,
    renderedRows: 0,
    status: 'finalizing result',
    palette: [],
  });

  terminal.show();
  assert.equal(rl.promptCalls.length, 3);
  assert.equal(terminal.snapshot().statusVisible, true);
});
