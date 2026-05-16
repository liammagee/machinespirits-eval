import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  initialChallengeState,
  updateChallengeState,
} from '../src/challengeState.js';
import { selectPolicy } from '../src/stateMachine.js';

const hardStatsScenario = Object.freeze({
  id: 'hard_stats_confounding_skeptical_closed_loop',
  challenge_profile: {
    mode: 'hard',
    stressors: ['skepticism_toward_teacher', 'apparent_forgetfulness'],
  },
});

test('resolved hard-mode readiness de-escalates repeated proof demands', () => {
  const evidence = {
    obsId: 'l3',
    quote: 'I think I already did that: I reproduced the input, traced the root cause, and added the regression test.',
    kcCandidates: ['debugging_root_cause_trace'],
    outcome: 'correct',
    affect: 'engaged',
    stance: 'corrective',
    domainDiagnosis: {
      repairNeeded: false,
      successMarkers: ['reproduce', 'root cause', 'regression test'],
    },
  };
  const policy = selectPolicy({
    evidence,
    mastery: {
      debugging_root_cause_trace: {
        pMastery: 0.78,
      },
    },
    relationState: 'repair',
    validationNeed: 'repair_first',
    challengeState: {
      mode: 'hard',
      level: 'resolved',
      resolvedTurns: 3,
      directive: '',
    },
  });
  assert.equal(policy.selectedPolicy, 'productive_struggle_hold');
  assert.match(policy.actionTemplate.messageFrame, /hand control back|adding another demand/i);
});

test('challenge state escalates repeated skeptical reversion', () => {
  const first = updateChallengeState({
    scenario: hardStatsScenario,
    previous: initialChallengeState(hardStatsScenario),
    turnIndex: 0,
    evidence: {
      quote: 'The graph still looks too strong, why not call it causal?',
      outcome: 'incorrect',
      affect: 'neutral',
      stance: 'claim',
      kcCandidates: ['causal_inference_confounding'],
      domainDiagnosis: { repairNeeded: true },
    },
  });

  const second = updateChallengeState({
    scenario: hardStatsScenario,
    previous: first,
    turnIndex: 1,
    evidence: {
      quote: 'I keep forgetting the point because the graph still feels convincing.',
      outcome: 'partial',
      affect: 'frustrated',
      stance: 'questioning',
      kcCandidates: ['causal_inference_confounding'],
      domainDiagnosis: { repairNeeded: true },
    },
  });

  assert.equal(first.level, 'active');
  assert.equal(second.level, 'escalated');
  assert.ok(second.signals.includes('forgetfulness'));
  assert.ok(second.signals.includes('reversion'));
  assert.match(second.directive, /confounder|third variable/i);
  assert.match(second.directive, /matched|controlled/i);
});
