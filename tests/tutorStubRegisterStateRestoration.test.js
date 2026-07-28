import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { restoreTutorStubRegisterStateFromTurns } from '../services/tutorStubRegisterStateRestoration.js';

test('disabled register restoration remains a no-op', () => {
  const state = { register: { enabled: false, history: ['keep'], current: 'keep' } };
  assert.deepEqual(restoreTutorStubRegisterStateFromTurns(state, [{ turn: 1, registerSelection: { turn: 1 } }]), {
    restored: 0,
  });
  assert.deepEqual(state.register, { enabled: false, history: ['keep'], current: 'keep' });
});

test('register restoration preserves filtering, replacement, efficacy, sorting, cloning, and current selection', () => {
  const first = { turn: 3, selected_register: 'warm' };
  const replacement = { turn: 3, selected_register: 'firm', efficacy: { label: 'embedded' } };
  const second = { selected_register: 'curious' };
  const turns = [
    { turn: 3, registerSelection: first },
    { turn: 'invalid', registerSelection: { selected_register: 'ignored' } },
    { turn: 1, registerSelection: second },
    { turn: 3, registerSelection: replacement },
    { previousRegisterEfficacy: { registerTurn: 1, label: 'attached' } },
    { previousRegisterEfficacy: { registerTurn: 3, label: 'must-not-overwrite' } },
    { previousRegisterEfficacy: { registerTurn: 9, label: 'unmatched' } },
  ];
  const state = { register: { enabled: true, history: [], current: null } };
  assert.deepEqual(restoreTutorStubRegisterStateFromTurns(state, turns), { restored: 2 });
  assert.deepEqual(state.register.history, [
    { selected_register: 'curious', efficacy: { registerTurn: 1, label: 'attached' } },
    { turn: 3, selected_register: 'firm', efficacy: { label: 'embedded' } },
  ]);
  assert.equal(state.register.current, state.register.history[1]);
  assert.notEqual(state.register.history[0], second);
  assert.notEqual(state.register.history[1], replacement);
  assert.notEqual(state.register.history[0].efficacy, turns[4].previousRegisterEfficacy);
});

test('enabled register restoration clears stale history when no valid selections exist', () => {
  const state = { register: { enabled: true, history: ['stale'], current: 'stale' } };
  assert.deepEqual(restoreTutorStubRegisterStateFromTurns(state, [{ turn: 1 }]), { restored: 0 });
  assert.deepEqual(state.register.history, []);
  assert.equal(state.register.current, null);
});

test('the CLI imports rather than redeclares register-state restoration', () => {
  const source = fs.readFileSync(new URL('../scripts/tutor-stub.js', import.meta.url), 'utf8');
  assert.match(source, /from '\.\.\/services\/tutorStubRegisterStateRestoration\.js'/u);
  assert.doesNotMatch(source, /function restoreRegisterStateFromTurns\(/u);
});
