import assert from 'node:assert/strict';
import test from 'node:test';
import { runScenario } from '../services/adaptiveTutor/runner.js';
import { WORLD_SPEC } from './fixtures/world-adaptation-spec.js';

test('state_policy_closed_loop emits contracts and closes non-final interventions', async () => {
  process.env.ADAPTIVE_TUTOR_LLM = 'mock';
  const result = await runScenario(
    {
      id: 'closed-loop-test',
      openingTurns: [{ role: 'learner', content: "I don't get why that works." }],
      hidden: { triggerTurn: 1, triggerSignal: 'confusion' },
      maxTurns: 3,
    },
    {
      architecture: 'state_policy_closed_loop',
      adaptationPolicyMode: 'closed_loop',
      adaptivePolicy: { mode: 'closed_loop', max_hypotheses: 3 },
    },
  );

  const contracts = result.final.adaptationTrace.filter((entry) => entry.type === 'validate_adaptation_contract');
  const ledger = result.final.interventionLedger;
  assert.equal(result.final.adaptationPolicyMode, 'closed_loop');
  assert.equal(result.final.dialogue.filter((m) => m.role === 'tutor').length, 3);
  assert.equal(contracts.length, 3);
  assert.equal(ledger.length, 3);
  assert.ok(ledger.slice(0, -1).every((record) => record.status === 'closed'));
  assert.equal(ledger.at(-1).status, 'pending');
});

test('state_policy_closed_loop can end after successful learner-owned no-intervention closure', async () => {
  process.env.ADAPTIVE_TUTOR_LLM = 'mock';
  const result = await runScenario(
    {
      id: 'closed-loop-early-completion-test',
      openingTurns: [
        {
          role: 'learner',
          content:
            'I have a workable route now: next I would compare the claims and test my own example before asking for more help.',
        },
      ],
      hidden: {
        triggerTurn: -1,
        actualSophistication: 'intermediate',
        scriptedResponses: {},
      },
      maxTurns: 4,
    },
    {
      architecture: 'state_policy_closed_loop',
      adaptationPolicyMode: 'closed_loop',
      adaptivePolicy: {
        mode: 'closed_loop',
        max_hypotheses: 3,
        realization_context: true,
        early_completion_after_successful_no_intervention: true,
      },
    },
  );

  const ledger = result.final.interventionLedger;
  const completionTraces = result.final.adaptationTrace.filter((entry) => entry.type === 'adaptive_completion');

  assert.equal(result.final.dialogue.filter((m) => m.role === 'tutor').length, 1);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].action_type, 'observe_no_intervention');
  assert.equal(ledger[0].status, 'closed');
  assert.equal(ledger[0].outcome, 'success');
  assert.equal(result.final.pendingIntervention, null);
  assert.equal(result.final.adaptiveCompletion.reason, 'successful_no_intervention_after_productive_progress');
  assert.equal(completionTraces.length, 1);
});

test('state_policy_closed_loop carries locked world adaptation spec into contracts and traces', async () => {
  process.env.ADAPTIVE_TUTOR_LLM = 'mock';
  const result = await runScenario(
    {
      id: 'closed-loop-world-spec-test',
      openingTurns: [
        {
          role: 'learner',
          content: "I don't get why high accuracy is not enough to prove this model is good.",
        },
      ],
      hidden: { triggerTurn: 1, triggerSignal: 'metric misconception' },
      maxTurns: 1,
    },
    {
      architecture: 'state_policy_closed_loop',
      adaptationPolicyMode: 'closed_loop',
      adaptivePolicy: {
        mode: 'closed_loop',
        world_adaptation_spec: WORLD_SPEC,
      },
    },
  );

  const tutorText = result.final.dialogue.find((message) => message.role === 'tutor')?.content || '';
  const selectTrace = result.final.adaptationTrace.find((entry) => entry.type === 'select_pedagogical_action');
  const contract = result.final.adaptationContract;

  assert.equal(result.final.adaptivePolicyConfig.world_adaptation_spec.id, 'W_AF6_CURRICULUM');
  assert.equal(result.final.selectedPedagogicalAction.action_type, 'request_evidence');
  assert.equal(contract.world_adaptation_spec.id, 'W_AF6_CURRICULUM');
  assert.equal(contract.world_adaptation_spec.spec_hash, 'sha256:test');
  assert.equal(contract.selected_action.world_adaptation.id, 'W_AF6_CURRICULUM');
  assert.ok(contract.selected_action.success_signal.required_evidence.includes('learner-authored rationale'));
  assert.equal(selectTrace.payload.world_adaptation_spec.id, 'W_AF6_CURRICULUM');
  assert.doesNotMatch(tutorText, /hidden_label|High accuracy means a good classifier|W_AF6_CURRICULUM/u);
});
