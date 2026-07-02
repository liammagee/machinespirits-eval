import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BLUEPRINT_CONTRACT_TRACE_ROLE,
  buildContractDialogue,
  buildContractTracePayload,
  extractContractLedger,
  finalizeBlueprintContractTurn,
  prepareBlueprintContractTurn,
} from '../blueprintActionContracts.js';

test('buildContractDialogue maps user/assistant roles onto learner/tutor', () => {
  const dialogue = buildContractDialogue(
    [
      { role: 'user', content: 'I am stuck on the master-slave passage.' },
      { role: 'assistant', content: 'Which sentence stops you?' },
    ],
    'Honestly the whole thing feels pointless.',
  );
  assert.deepEqual(
    dialogue.map((d) => d.role),
    ['learner', 'tutor', 'learner'],
  );
  assert.equal(dialogue[2].content, 'Honestly the whole thing feels pointless.');
});

test('prepare issues a validated contract with a prompt block', () => {
  const turn = prepareBlueprintContractTurn({
    learnerMessage: 'This feels pointless — why does any of this matter?',
    history: [
      { role: 'user', content: 'Walk me through recognition step by step.' },
      { role: 'assistant', content: 'Step one: the two self-consciousnesses meet.' },
    ],
    priorLedger: [],
    turnIndex: 1,
    dialogueId: 'test-dialogue',
  });
  assert.ok(turn.contract.contract_id.startsWith('blueprint-test-dialogue-turn-1'));
  assert.ok(turn.selectedAction.action_type, 'a pedagogical action must be selected');
  assert.equal(turn.contract.gate_result.allowed, true);
  assert.match(turn.promptBlock, /<adaptation_contract>/);
  assert.match(turn.promptBlock, new RegExp(turn.selectedAction.action_type));
});

test('finalize records realization checks and opens a pending intervention', () => {
  const turn = prepareBlueprintContractTurn({
    learnerMessage: 'Why should I care about this?',
    history: [],
    priorLedger: [],
    turnIndex: 0,
    dialogueId: 'test-dialogue',
  });
  const final = finalizeBlueprintContractTurn({
    contract: turn.contract,
    ledger: turn.ledger,
    tutorText: 'Take the lab report you wrote yesterday — which sentence would this claim break? Try it and tell me.',
  });
  assert.equal(typeof final.realization.action_consistent, 'boolean');
  assert.equal(final.contract.realization_checks.action_consistent, final.realization.action_consistent);
  assert.equal(final.pendingIntervention.status, 'pending');
  assert.equal(final.ledger.filter((r) => r.status === 'pending').length, 1);
});

test('ledger round-trips through both trace persistence shapes', () => {
  const turn = prepareBlueprintContractTurn({
    learnerMessage: 'What is the point of this?',
    history: [],
    priorLedger: [],
    turnIndex: 0,
    dialogueId: 'round-trip',
  });
  const final = finalizeBlueprintContractTurn({
    contract: turn.contract,
    ledger: turn.ledger,
    tutorText: 'Here is one test you can run yourself — what would break it?',
  });
  const payload = buildContractTracePayload({
    contract: final.contract,
    ledger: final.ledger,
    closedRecord: turn.closedRecord,
    realization: final.realization,
  });

  const interactionShape = [{ role: BLUEPRINT_CONTRACT_TRACE_ROLE, state: payload }];
  const adapterShape = {
    consolidatedTrace: [{ agent: BLUEPRINT_CONTRACT_TRACE_ROLE, detail: JSON.stringify(payload) }],
  };
  assert.deepEqual(extractContractLedger(interactionShape), final.ledger);
  assert.deepEqual(extractContractLedger(adapterShape), final.ledger);

  const nextTurn = prepareBlueprintContractTurn({
    learnerMessage: 'Fine — the claim would break if the report contradicted it. What next?',
    history: [
      { role: 'user', content: 'What is the point of this?' },
      { role: 'assistant', content: 'Here is one test you can run yourself — what would break it?' },
    ],
    priorLedger: extractContractLedger(interactionShape),
    turnIndex: 1,
    dialogueId: 'round-trip',
  });
  assert.equal(
    nextTurn.ledger.filter((r) => r.status === 'pending').length,
    0,
    'the pending intervention must be closed or staged by the next learner turn',
  );
});

test('extractContractLedger returns empty ledger when no contract entries exist', () => {
  assert.deepEqual(extractContractLedger(null), []);
  assert.deepEqual(extractContractLedger([{ role: 'engagement_router', state: {} }]), []);
});
