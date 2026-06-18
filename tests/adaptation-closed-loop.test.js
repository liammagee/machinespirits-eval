import assert from 'node:assert/strict';
import test from 'node:test';
import { runScenario } from '../services/adaptiveTutor/runner.js';

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
