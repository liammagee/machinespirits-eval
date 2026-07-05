import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PUBLIC_EVIDENCE_SCHEMA,
  auditPublicOnlyInput,
  derivePublicLearnerEvidence,
} from '../services/dramaticDerivation/index.js';

test('public evidence rejects hidden proof-state inputs recursively', () => {
  const audit = auditPublicOnlyInput({
    transcript: [{ role: 'learner', text: 'I think this follows.' }],
    hiddenBoard: [['x']],
    nested: { proofPath: ['p1'], finalD: 0 },
  });

  assert.equal(audit.ok, false);
  assert.deepEqual(audit.leaks.map((leak) => leak.key).sort(), ['finalD', 'hiddenBoard', 'proofPath']);

  const evidence = derivePublicLearnerEvidence({
    learnerText: 'I think this follows.',
    proofPath: ['p1'],
  });
  assert.equal(evidence.schema, PUBLIC_EVIDENCE_SCHEMA);
  assert.equal(evidence.publicOnly, true);
  assert.equal(evidence.inputAudit.ok, false);
  assert.equal(evidence.currentUtterance, '');
  assert.equal(evidence.evidenceConfidence, 0);
});

test('public evidence classifies purpose, echo, resistance, and productive reasoning', () => {
  assert.equal(
    derivePublicLearnerEvidence({ learnerText: 'Why does that mark matter for the question?' }).stance,
    'purpose_question',
  );
  assert.equal(
    derivePublicLearnerEvidence({ learnerText: 'As you said, the crowsfoot mark is the phrase.' }).stance,
    'fluent_echo',
  );
  assert.equal(
    derivePublicLearnerEvidence({ learnerText: "But that doesn't follow from the line." }).stance,
    'resistant',
  );
  const productive = derivePublicLearnerEvidence({
    scope: 'dialogue_block',
    learnerText: 'I would say the bond line answers who pays, so cause still needs another line.',
  });
  assert.equal(productive.scope, 'dialogue_block');
  assert.equal(productive.stance, 'tentative_correct');
  assert.ok(productive.uptakeMarkers.includes('own_words'));
  assert.ok(productive.uptakeMarkers.includes('uses_reasoning'));
  assert.ok(productive.evidenceConfidence > 0.7);
});
