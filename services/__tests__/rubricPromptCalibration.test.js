import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBatchedPerTurnTutorPrompt, buildPerTurnTutorEvaluationPrompt } from '../rubricEvaluator.js';
import {
  buildBatchedLearnerPrompt,
  buildLearnerEvaluationPrompt,
  buildLearnerHolisticEvaluationPrompt,
} from '../learnerRubricEvaluator.js';

const tutorTurns = [
  {
    turnId: 'turn-0',
    suggestions: [{ title: 'Opening', message: 'Let us inspect the first premise.' }],
    learnerMessage: null,
  },
  {
    turnId: 'turn-1',
    suggestions: [{ title: 'Follow-up', message: 'How does that change your hypothesis?' }],
    learnerMessage: 'It weakens my first guess.',
  },
];

const scenario = {
  name: 'Calibration scenario',
  description: 'A multi-turn calibration fixture.',
  expectedBehavior: 'Adapt to the learner.',
  learnerContext: 'The learner is revising a hypothesis.',
  requiredElements: [],
  forbiddenElements: [],
};

const learnerTurns = [
  { turnNumber: 0, phase: 'tutor', externalMessage: 'What follows from the first premise?' },
  { turnNumber: 1, phase: 'learner', externalMessage: 'I need to revise my first guess.' },
];

function calibrationParagraph(prompt) {
  const start = prompt.indexOf('CROSS-TURN CALIBRATION');
  assert.notEqual(start, -1, 'prompt should contain a calibration paragraph');
  const end = prompt.indexOf('\n\n', start);
  assert.notEqual(end, -1, 'calibration paragraph should have a clear boundary');
  return prompt.slice(start, end);
}

test('tutor prompt calibration names only the active v2.2 cross-turn dimension', () => {
  const prompts = [
    buildPerTurnTutorEvaluationPrompt({
      turnResults: tutorTurns,
      dialogueTrace: [],
      targetTurnIndex: 1,
      scenario,
    }),
    buildBatchedPerTurnTutorPrompt({ turnResults: tutorTurns, dialogueTrace: [], scenario }),
  ];

  for (const prompt of prompts) {
    const calibration = calibrationParagraph(prompt);
    assert.match(calibration, /adaptive_responsiveness/u);
    assert.doesNotMatch(calibration, /tutor_adaptation|learner_growth|dialectical_responsiveness/u);
  }
});

test('learner prompt calibration names only active cross-turn development dimensions', () => {
  const prompts = [
    buildLearnerEvaluationPrompt({ turns: learnerTurns, targetTurnIndex: 1 }),
    buildLearnerHolisticEvaluationPrompt({ turns: learnerTurns }),
    buildBatchedLearnerPrompt({
      turns: learnerTurns,
      learnerTurnTargets: [{ lt: 0, targetIdx: 1 }],
    }),
  ];

  for (const prompt of prompts) {
    const calibration = calibrationParagraph(prompt);
    assert.match(calibration, /revision_signals/u);
    assert.match(calibration, /conceptual_progression/u);
    assert.doesNotMatch(calibration, /metacognitive_awareness|metacognitive_development/u);
  }
});
