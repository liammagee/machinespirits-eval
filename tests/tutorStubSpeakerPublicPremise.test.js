import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import { compileTutorStubWritableEntryCausalContract } from '../services/tutorStubRequestedEntryCausality.js';
import {
  projectTutorStubSpeakerPublicPremise,
  TUTOR_STUB_SPEAKER_PUBLIC_PREMISE_SCHEMA,
} from '../services/tutorStubSpeakerPublicPremise.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('live and frozen speaker projection preserve the same typed public causal relation', () => {
  const world = loadWorld(path.join(ROOT, 'config', 'drama-derivation', 'world-025-tallow-street.yaml'));
  const premise = world.premiseById.get('p_idle');
  const live = projectTutorStubSpeakerPublicPremise(premise, {
    premise: premise.id,
    turn: 5,
    via: 'tutor',
  });
  const frozen = projectTutorStubSpeakerPublicPremise(world.premiseById.get('p_idle'), {
    premise: 'p_idle',
  });

  assert.equal(live.schema, TUTOR_STUB_SPEAKER_PUBLIC_PREMISE_SCHEMA);
  assert.deepEqual(live.causal_relation, premise.causal_relation);
  assert.deepEqual(frozen.causal_relation, live.causal_relation);
  const liveContract = compileTutorStubWritableEntryCausalContract({
    evidence: [live],
    surfaces: [live.surface],
  });
  const frozenContract = compileTutorStubWritableEntryCausalContract({
    evidence: [frozen],
    surfaces: [frozen.surface],
  });
  assert.deepEqual(frozenContract, liveContract);
  assert.equal(liveContract.subject, 'depot chargers');
  assert.equal(liveContract.outcome, 'Tallow Street brownout');
});
