import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

import {
  learnerTurnIndexForTutorTurn,
  scoredTutorTurnAfterTrigger,
  shiftWindowTutorTurns,
} from '../scripts/lib/trapTurnConvention.js';

describe('trap turn convention', () => {
  it('scores the first tutor turn after the learner trigger', () => {
    const triggerTurn = 2;

    assert.equal(learnerTurnIndexForTutorTurn(0), 0);
    assert.equal(learnerTurnIndexForTutorTurn(1), 1);
    assert.equal(learnerTurnIndexForTutorTurn(2), triggerTurn);
    assert.equal(scoredTutorTurnAfterTrigger(triggerTurn), 3);
    assert.deepEqual(shiftWindowTutorTurns(triggerTurn), [3, 4, 5]);
  });

  it('keeps standard trap adapters on the shared learner-turn convention', () => {
    const adapterFiles = [
      'scripts/run-dialogue-engine-trap-baseline.js',
      'scripts/run-id-director-trap-pilot.js',
    ];

    for (const file of adapterFiles) {
      const source = readFileSync(file, 'utf8');
      assert.match(source, /learnerTurnIndexForTutorTurn\(turn\)/, `${file} must use the shared helper`);
      assert.doesNotMatch(source, /turn:\s*turn\s*\+\s*1/, `${file} must not advance learner turn early`);
    }
  });

  it('keeps strict_shift tied to the named post-trigger tutor turn', () => {
    const source = readFileSync('scripts/analyze-strategy-shift.js', 'utf8');

    assert.match(source, /scoredTutorTurnAfterTrigger\(triggerTurn\)/);
    assert.doesNotMatch(source, /t\.turn\s*===\s*triggerTurn\s*\+\s*1/);
  });
});
