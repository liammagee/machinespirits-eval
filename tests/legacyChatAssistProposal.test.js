import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeAssistProposal } from '../services/legacyChatAssistProposal.js';

test('legacy chat assist compatibility keeps valid proposal fields and drops unsupported values', () => {
  const { proposal, dropped } = normalizeAssistProposal(
    {
      features: { approach: 'charismatic', critic: 'nonsense' },
      curriculumRef: 'module:AF1',
      lectureRef: 'missing',
      personaId: 'struggling_anxious',
      mode: 'observer',
      director: { act: 'recognition', beat: 'bad-beat' },
      action: 'start_scene',
    },
    {
      sceneRefs: ['module:AF1'],
      lectureRefs: ['1001-lecture-1'],
      personaIds: ['struggling_anxious'],
    },
  );

  assert.equal(proposal.features.approach, 'charismatic');
  assert.equal(proposal.curriculumRef, 'module:AF1');
  assert.equal(proposal.personaId, 'struggling_anxious');
  assert.equal(proposal.director.act, 'recognition');
  assert.equal(proposal.action, 'start_scene');
  assert.ok(dropped.includes('features.critic'));
  assert.ok(dropped.includes('lectureRef'));
  assert.ok(dropped.includes('mode'));
  assert.ok(dropped.includes('director.beat'));
});
