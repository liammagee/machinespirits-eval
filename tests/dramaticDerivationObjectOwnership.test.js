import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OBJECT_OWNERSHIP_SCHEMA,
  OWNERSHIP_PROBE_FAMILIES,
  auditObjectOwnershipPublicInput,
  deriveObjectOwnershipState,
  summarizeOwnershipStates,
} from '../services/dramaticDerivation/index.js';

test('object ownership exposes the compact public probe family set', () => {
  assert.deepEqual([...OWNERSHIP_PROBE_FAMILIES].sort(), [
    'discriminate_wrong_route',
    'near_transfer',
    'own_words',
    'purpose_link',
    'recover_after_break',
    'use_in_path',
  ]);
});

test('object ownership audit rejects hidden proof-state inputs recursively', () => {
  const audit = auditObjectOwnershipPublicInput({
    currentObject: 'the bridge measure',
    learnerText: 'I think it fixes the break point.',
    hiddenBoard: [['failedAt', 'hethelSpan', 'crownJoint']],
    nested: { proofPath: ['p_point'], finalD: 4 },
  });

  assert.equal(audit.ok, false);
  assert.deepEqual(
    audit.leaks.map((leak) => leak.key).sort(),
    ['finalD', 'hiddenBoard', 'proofPath'],
  );

  const state = deriveObjectOwnershipState({
    currentObject: 'p_point',
    proofPath: ['p_point'],
    learnerText: 'I can repeat it.',
  });
  assert.equal(state.schema, OBJECT_OWNERSHIP_SCHEMA);
  assert.equal(state.publicOnly, true);
  assert.equal(state.mayOverrideProofControl, false);
  assert.equal(state.inputAudit.ok, false);
  assert.equal(state.ownershipLevel, 'unknown');
  assert.equal(state.nonLeakAudit.ok, true);
  assert.doesNotMatch(JSON.stringify(state), /p_point.*p_point.*p_point/u);
});

test('own words and proof-path use produce emerging ownership', () => {
  const state = deriveObjectOwnershipState({
    currentObject: 'crown joint failure point',
    objectKeywords: ['crown', 'joint', 'failure'],
    transcript: [
      {
        role: 'learner',
        text: 'I read it as the crown joint fixing where the span failed, so the next question is what that point betrays.',
      },
    ],
  });

  assert.equal(state.ownershipLevel, 'emerging');
  assert.equal(state.probes.find((probe) => probe.family === 'own_words').passed, true);
  assert.equal(state.probes.find((probe) => probe.family === 'use_in_path').passed, true);
  assert.equal(state.gaps.includes('own_words'), false);
});

test('echo without own words is classified separately from ownership', () => {
  const state = deriveObjectOwnershipState({
    currentObject: 'crowsfoot mark',
    objectKeywords: ['crowsfoot', 'mark'],
    learnerText: 'As you said, the crowsfoot mark is the phrase to keep.',
  });

  assert.equal(state.echoOnly, true);
  assert.equal(state.ownershipLevel, 'echo_only');
  assert.equal(state.probes.find((probe) => probe.family === 'own_words').passed, false);
});

test('contrast, purpose, transfer, and recovery support durable ownership', () => {
  const state = deriveObjectOwnershipState({
    currentObject: 'crowsfoot mark',
    objectKeywords: ['crowsfoot', 'mark'],
    recoveryProbe: true,
    transcript: [
      {
        role: 'learner',
        text: 'I would say the crowsfoot mark is not a random bruise but the yard brand, because it proves where the centering came from.',
      },
      {
        role: 'learner',
        text: 'Like the crown joint earlier, the same pattern turns a visible trace into the next rule step.',
      },
      {
        role: 'learner',
        text: 'Back to the crowsfoot mark: it still matters because without it I cannot connect the fall to a yard.',
      },
    ],
  });

  assert.equal(state.ownershipLevel, 'durable');
  for (const family of OWNERSHIP_PROBE_FAMILIES) {
    assert.equal(state.probes.find((probe) => probe.family === family).passed, true, family);
  }
});

test('ownership summaries expose level and gap aggregates', () => {
  const absent = deriveObjectOwnershipState({
    currentObject: 'crown point',
    objectKeywords: ['crown'],
    learnerText: 'I am lost.',
  });
  const owned = deriveObjectOwnershipState({
    currentObject: 'crown point',
    objectKeywords: ['crown'],
    learnerText: 'I read the crown point as the break location, so it matters because the cause has to be found there.',
  });
  const summary = summarizeOwnershipStates([absent, owned]);

  assert.equal(summary.count, 2);
  assert.equal(summary.auditClean, true);
  assert.equal(summary.byLevel.absent, 1);
  assert.equal(summary.byLevel.emerging, 1);
  assert.ok(summary.byGap.near_transfer >= 1);
});
