import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createTutorStubLineSelection,
  tutorStubWordBoundaryLeft,
  tutorStubWordBoundaryRight,
} from '../services/tutorStubLineSelection.js';

function fixture({ line = '', cursor = line.length, tty = false } = {}) {
  let written = '';
  let refreshes = 0;
  const output = {
    isTTY: tty,
    write(value) {
      written += String(value);
      return true;
    },
  };
  const rl = {
    line,
    cursor,
    _refreshLine() {
      refreshes += 1;
    },
    getCursorPos() {
      return { cols: 10 + this.cursor, rows: 0 };
    },
  };
  const selection = createTutorStubLineSelection({ rl, output });
  return { output, rl, selection, written: () => written, refreshes: () => refreshes };
}

test('word boundaries treat whitespace, words, and punctuation as separate runs', () => {
  const line = 'alpha beta... gamma';

  assert.equal(tutorStubWordBoundaryLeft(line, line.length), 14);
  assert.equal(tutorStubWordBoundaryLeft(line, 14), 10);
  assert.equal(tutorStubWordBoundaryLeft(line, 10), 6);
  assert.equal(tutorStubWordBoundaryRight(line, 0), 5);
  assert.equal(tutorStubWordBoundaryRight(line, 5), 10);
  assert.equal(tutorStubWordBoundaryRight(line, 10), 13);
  assert.equal(tutorStubWordBoundaryRight(line, 13), line.length);
});

test('Alt/Option+Shift+Arrow selects a word and typing replaces it', () => {
  const { rl, selection } = fixture({ line: 'alpha beta gamma' });

  selection.handleKeypress(undefined, { name: 'left', meta: true, shift: true });
  assert.deepEqual(selection.snapshot(), {
    active: true,
    anchor: 16,
    focus: 11,
    range: [11, 16],
    text: 'gamma',
  });

  // Readline handles the printable key before the selection controller does.
  rl.line = 'alpha beta Xgamma';
  rl.cursor = 12;
  selection.handleKeypress('X', { name: 'x' });

  assert.equal(rl.line, 'alpha beta X');
  assert.equal(rl.cursor, 12);
  assert.equal(selection.snapshot().active, false);
});

test('Shift+Home selects the line prefix and Backspace removes it', () => {
  const { rl, selection } = fixture({ line: 'discard this' });

  // Shift+Home has already moved Readline's cursor when our listener runs.
  rl.cursor = 0;
  selection.handleKeypress(undefined, { name: 'home', shift: true });
  assert.equal(selection.snapshot().text, 'discard this');

  selection.handleKeypress('\b', { name: 'backspace' });
  assert.equal(rl.line, '');
  assert.equal(rl.cursor, 0);
});

test('Ctrl+Arrow supplies word movement when the terminal reports arrow modifiers', () => {
  const { rl, selection } = fixture({ line: 'alpha beta gamma', cursor: 0 });

  selection.handleKeypress(undefined, { name: 'right', ctrl: true });
  assert.equal(rl.cursor, 5);
  selection.handleKeypress(undefined, { name: 'right', ctrl: true });
  assert.equal(rl.cursor, 10);
  selection.handleKeypress(undefined, { name: 'left', ctrl: true });
  assert.equal(rl.cursor, 6);
});

test('selection is visibly decorated and keeps the logical cursor in place', () => {
  const { rl, selection, written, refreshes } = fixture({ line: 'alpha beta', tty: true });

  selection.handleKeypress(undefined, { name: 'left', ctrl: true, shift: true });

  assert.equal(rl.cursor, 6);
  assert.equal(refreshes(), 1);
  assert.ok(written().includes(`${String.fromCharCode(27)}[7mbeta${String.fromCharCode(27)}[27m`));
  assert.ok(written().includes(`${String.fromCharCode(27)}7`));
  assert.ok(written().includes(`${String.fromCharCode(27)}8`));
});
