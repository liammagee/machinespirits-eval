import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeTutorStubEngagementStanceTemperature,
  normalizeTutorStubRegisterTemperature,
  temperTutorStubEngagementStanceScores,
  temperTutorStubRegisterScores,
} from '../tutorStubRegisterTemperature.js';

function probabilities(scores) {
  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(Object.entries(scores).map(([key, value]) => [key, value / total]));
}

test('lower engagement-stance temperature sharpens the dominant stance score', () => {
  const base = { warm: 4, plain: 2, precise: 1 };
  const sharp = probabilities(temperTutorStubEngagementStanceScores(base, { temperature: 0.4 }));
  const neutral = probabilities(temperTutorStubEngagementStanceScores(base, { temperature: 1 }));
  const broad = probabilities(temperTutorStubEngagementStanceScores(base, { temperature: 1.4 }));

  assert.ok(sharp.warm > neutral.warm);
  assert.ok(neutral.warm > broad.warm);
  assert.ok(sharp.precise < neutral.precise);
  assert.ok(neutral.precise < broad.precise);
});

test('engagement-stance temperature validation accepts the documented range and legacy aliases', () => {
  assert.equal(normalizeTutorStubEngagementStanceTemperature('1.0'), 1);
  assert.equal(normalizeTutorStubEngagementStanceTemperature('0.05'), 0.05);
  assert.equal(normalizeTutorStubEngagementStanceTemperature('3'), 3);
  assert.throws(() => normalizeTutorStubEngagementStanceTemperature('0'), /between 0\.05 and 3/u);
  assert.throws(() => normalizeTutorStubEngagementStanceTemperature('hot'), /between 0\.05 and 3/u);
  assert.equal(normalizeTutorStubRegisterTemperature('1'), 1);
  assert.deepEqual(
    temperTutorStubRegisterScores({ warm: 2, plain: 1 }, { temperature: 1 }),
    temperTutorStubEngagementStanceScores({ warm: 2, plain: 1 }, { temperature: 1 }),
  );
});
