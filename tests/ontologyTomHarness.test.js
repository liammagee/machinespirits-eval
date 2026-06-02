import assert from 'node:assert/strict';
import test from 'node:test';
import { GROUNDED } from '../services/ontology/acquiredAbox.js';
import { computeTomBrief, impliedTreatment, detectReachedGoal } from '../scripts/run-ontology-tom-ab.js';

test('impliedTreatment maps a tutor move to the perceived_role it assumes', () => {
  assert.equal(impliedTreatment('invite'), 'ThinkingPartner');
  assert.equal(impliedTreatment('tell'), 'AuthorityToDeferTo');
  assert.equal(impliedTreatment('repair'), null);
});

test('detectReachedGoal fires on warrant-ownership, not on surface acceptance', () => {
  assert.equal(detectReachedGoal('I need another premise that rules out the other causes.'), true);
  assert.equal(detectReachedGoal('I copied the cleaner style, so I assume it is fine now.'), false);
});

test('computeTomBrief flags surface compliance as a CONSISTENCY ALERT (grounded inconsistency)', async () => {
  // The tutor has observed the learner BOTH claiming the conclusion AND showing weak ownership.
  const tutorRecords = [
    {
      role: 'tutor',
      subject: 'learner',
      dimension: 'claim_ownership',
      type: 'ConclusionOwned',
      turn: 1,
      tier: GROUNDED,
    },
    {
      role: 'tutor',
      subject: 'learner',
      dimension: 'claim_ownership',
      type: 'ClaimOwnershipWeak',
      turn: 1,
      tier: GROUNDED,
    },
  ];
  const brief = await computeTomBrief({ tutorRecords, def: { targetKC: 'ArticulateWarrant' }, turn: 1 });

  assert.equal(brief.surfaceCompliance, true);
  assert.match(brief.text, /CONSISTENCY ALERT/);
  assert.match(brief.text, /reconstruct the warrant/);
});

test('computeTomBrief tells the tutor to scaffold a deferring learner toward partnership', async () => {
  const tutorRecords = [
    {
      role: 'tutor',
      subject: 'learner',
      dimension: 'perceived_role',
      type: 'AuthorityToDeferTo',
      turn: 1,
      tier: GROUNDED,
    },
  ];
  const brief = await computeTomBrief({ tutorRecords, def: { targetKC: 'ArticulateWarrant' }, turn: 1 });

  assert.equal(brief.surfaceCompliance, false);
  assert.equal(brief.recognitionState, 'AuthorityToDeferTo');
  assert.match(brief.text, /thinking-partner/);
});
