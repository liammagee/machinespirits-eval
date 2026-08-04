import assert from 'node:assert/strict';
import test from 'node:test';

import { createTutorStubCommandRuntime } from '../services/tutorStubCommandRuntime.js';

const colors = new Proxy({}, { get: () => '' });

test('command runtime dispatches help without owning terminal presentation', () => {
  const events = [];
  let helpCalls = 0;
  const state = { trace: {}, turns: [] };
  const runtime = createTutorStubCommandRuntime({
    C: colors,
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
    clearStatusLine() {},
    pauseInterimAnimation() {
      return false;
    },
    printInteractiveHelp(receivedState) {
      assert.equal(receivedState, state);
      helpCalls += 1;
    },
    repriseLatestTutorUtterance() {
      return false;
    },
    resumeInterimAnimation() {},
    state,
  });

  assert.equal(runtime.executeSlashCommand({ canonicalToken: '/help' }), true);
  assert.equal(helpCalls, 1);
  assert.deepEqual(events, [{ type: 'interactive_help', turns: 0, duringTurn: false }]);
});

test('dialogue-settings handler delegates training-reuse changes', async () => {
  const actions = [];
  const runtime = createTutorStubCommandRuntime({
    C: colors,
    clearStatusLine() {},
    handleTrainingReuseSetting(action) {
      actions.push(action);
    },
    state: { passthrough: { enabled: false } },
  });

  await runtime.handleDialogueSettings('training-reuse off');
  assert.deepEqual(actions, ['off']);
});

test('slash settings route preserves async prompt-blocking metadata', async () => {
  const actions = [];
  const runtime = createTutorStubCommandRuntime({
    C: colors,
    clearStatusLine() {},
    handleTrainingReuseSetting(action) {
      actions.push(action);
    },
    liveSettingsPickerAvailable() {
      return true;
    },
    pauseInterimAnimation() {
      return false;
    },
    repriseLatestTutorUtterance() {
      return false;
    },
    resumeInterimAnimation() {},
    state: { interim: {}, passthrough: { enabled: false } },
  });

  const pending = runtime.executeSlashCommand({
    canonicalToken: '/settings',
    argument: 'training-reuse status',
  });
  assert.equal(pending.tutorStubBlocksPrompt, true);
  await pending;
  assert.deepEqual(actions, ['status']);
});
