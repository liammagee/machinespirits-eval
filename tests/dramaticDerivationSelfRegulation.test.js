import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SELF_REGULATION_SCHEMA,
  deriveSelfRegulationState,
  evaluateSelfRegulationBenchmark,
} from '../services/dramaticDerivation/index.js';

test('self-regulation detects planning, monitoring, gap detection, help seeking, checks, and strategy reflection', () => {
  const state = deriveSelfRegulationState({
    learnerText:
      'Next I will check the source line. I am not sure yet; the gap is which line names the yard. Can you show that line? Before I assert it, the condition has to be true. My strategy is source first, cause second.',
  });

  assert.equal(state.schema, SELF_REGULATION_SCHEMA);
  assert.equal(state.publicOnly, true);
  assert.equal(state.plansNextStep, 1);
  assert.equal(state.monitorsConfidence, 1);
  assert.equal(state.detectsOwnGap, 1);
  assert.equal(state.requestsSpecificHelp, 1);
  assert.equal(state.checksAnswerConditions, 1);
  assert.equal(state.reflectsOnStrategy, 1);
  assert.equal(state.selfRegulationScore, 1);
});

test('self-regulation benchmark controls pass', () => {
  const report = evaluateSelfRegulationBenchmark();
  assert.equal(report.summary.fail, 0);
  assert.equal(report.summary.allPassed, true);
  assert.ok(report.summary.count >= 7);
});

test('self-regulation public-only audit rejects hidden proof fields', () => {
  const state = deriveSelfRegulationState({
    learnerText: 'Next I will check the source line.',
    hiddenBoard: [['x']],
  });
  assert.equal(state.inputAudit.ok, false);
  assert.equal(state.selfRegulationScore, 0);
  assert.equal(state.recommendedCoachMove, 'return_to_task');
});
