import assert from 'node:assert/strict';
import test from 'node:test';
import { TUTOR_STUB_LAUNCH_MODES, normalizeTutorStubLaunchMode } from '../services/tutorStubLaunchMode.js';

test('launch-mode catalogue preserves the default chat and labelling contracts', () => {
  assert.equal(Object.isFrozen(TUTOR_STUB_LAUNCH_MODES), true);
  assert.deepEqual(TUTOR_STUB_LAUNCH_MODES, [
    {
      id: 'chat',
      label: 'Mixed tutor chat',
      description: 'Open the default human + AI learner-drafting conversation.',
    },
    {
      id: 'labelling-game',
      label: 'Labelling game',
      description: 'Human-label the superego taxonomy or tutor-stub impasse corpus.',
    },
  ]);
});

test('launch-mode normalization preserves aliases, empty admission, and exact failures', () => {
  for (const alias of ['chat', 'default', 'tutor', 'tutor-chat', 'Tutor Chat', 'tutor_chat']) {
    assert.equal(normalizeTutorStubLaunchMode(alias), 'chat');
  }
  for (const alias of ['labelling', 'labeling', 'labelling-game', 'labeling_game']) {
    assert.equal(normalizeTutorStubLaunchMode(alias), 'labelling-game');
  }
  assert.equal(normalizeTutorStubLaunchMode('', { allowEmpty: true }), '');
  assert.throws(() => normalizeTutorStubLaunchMode(''), /unknown --launch-mode ""; use chat or labelling-game/u);
  assert.throws(
    () => normalizeTutorStubLaunchMode('unknown'),
    /unknown --launch-mode "unknown"; use chat or labelling-game/u,
  );
});
