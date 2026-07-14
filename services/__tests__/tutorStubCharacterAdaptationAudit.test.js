import assert from 'node:assert/strict';
import test from 'node:test';

import { auditTutorStubCharacterAdaptationTurns } from '../tutorStubCharacterAdaptationAudit.js';

function turn({
  id,
  tutor,
  part = 'record_keeper',
  partVisible = true,
  clue = null,
  roleStageDirection = false,
} = {}) {
  return {
    turn: id,
    turnId: `run:t${id}`,
    tutor,
    responseConfiguration: { actorial_part: part, actorial_host_part: part },
    responseConfigurationAudit: { axes: { actorial_part: { visible: partVisible } } },
    dramaticRelease: clue
      ? {
          frame: { active: true, entries: [{ premise: `p${id}`, surface: clue }] },
          audit: { roleStageDirection },
        }
      : null,
  };
}

test('character adaptation audit detects duplicate clue delivery and meta-performance', () => {
  const clue = 'The badge log has Dario in the kitchen at 12:02, mug in hand.';
  const audit = auditTutorStubCharacterAdaptationTurns([
    turn({
      id: 1,
      tutor:
        "Let's role-play it. The badge log has Dario in the kitchen at 12:02, mug in hand. I read: The badge log has Dario in the kitchen at 12:02, mug in hand. What changes?",
      part: 'authored_source',
      partVisible: false,
      clue,
      roleStageDirection: true,
    }),
  ]);

  assert.equal(audit.metaPerformanceTurns, 1);
  assert.equal(audit.roleStageDirectionTurns, 1);
  assert.equal(audit.sourceReplacementTurns, 1);
  assert.equal(audit.duplicateClueDeliveryTurns, 1);
  assert.equal(audit.hostVisibilityRate, 0);
});

test('character adaptation audit accepts a continuous adaptive host plus source enactment', () => {
  const clue = 'The badge log has Dario in the kitchen at 12:02, mug in hand.';
  const audit = auditTutorStubCharacterAdaptationTurns([
    turn({
      id: 1,
      tutor:
        'You are right to keep suspicion separate from proof. I tap the badge log and test its line; “I entered Dario at 12:02, mug in hand.” What does that establish?',
      part: 'examiner',
      clue,
    }),
    turn({ id: 2, tutor: 'Not so fast—I test that claim against the crucible. What survives?', part: 'skeptic' }),
  ]);

  assert.equal(audit.metaPerformanceTurns, 0);
  assert.equal(audit.roleStageDirectionTurns, 0);
  assert.equal(audit.sourceReplacementTurns, 0);
  assert.equal(audit.duplicateClueDeliveryTurns, 0);
  assert.equal(audit.hostVisibilityRate, 1);
  assert.equal(audit.distinctHostParts, 2);
});
