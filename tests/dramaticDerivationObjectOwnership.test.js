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

test('structural learner restatement counts as own words without ritual phrase', () => {
  const state = deriveObjectOwnershipState({
    currentObject: 'Reyner liability and causal fall split',
    objectKeywords: ['reyner', 'liability', 'bond', 'cause', 'fall', 'draft', 'oswin'],
    transcript: [
      {
        role: 'learner',
        text: "The bond line says who must answer if the work fails; that's Reyner. A cause line would say what actually brought the arch down. I can see those aren't the same sentence.",
      },
      {
        role: 'learner',
        text: "The draft has to carry two lines, not one: Reyner's bond says he pays when the span fails, and that line holds; but the cause is the centering drawn early, and that's a different question with a different answer.",
      },
    ],
  });

  assert.equal(state.probes.find((probe) => probe.family === 'own_words').passed, true);
  assert.equal(state.probes.find((probe) => probe.family === 'use_in_path').passed, true);
  assert.equal(state.probes.find((probe) => probe.family === 'discriminate_wrong_route').passed, true);
  assert.equal(state.probes.find((probe) => probe.family === 'purpose_link').passed, true);
  assert.notEqual(state.ownershipLevel, 'echo_only');
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

test('early echo does not cancel later owned restatement', () => {
  const state = deriveObjectOwnershipState({
    currentObject: 'Reyner liability and causal fall split',
    objectKeywords: ['reyner', 'bond', 'cause', 'fall', 'oswin'],
    transcript: [
      {
        role: 'learner',
        text: 'As you said, Reyner and cause are the words here.',
      },
      {
        role: 'learner',
        text: "The bond line says who must answer if the work fails; that's Reyner. A cause line would say what actually brought the arch down, and those aren't the same sentence.",
      },
    ],
  });

  assert.equal(state.echoOnly, false);
  assert.equal(state.probes.find((probe) => probe.family === 'own_words').passed, true);
  assert.equal(state.probes.find((probe) => probe.family === 'discriminate_wrong_route').passed, true);
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
        text: 'As with the crown joint earlier, the same pattern keeps the payment line separate from the cause line.',
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

test('near transfer ignores ordinary preference uses of like', () => {
  const ordinaryPreference = deriveObjectOwnershipState({
    currentObject: 'liability cause split',
    objectKeywords: ['liability', 'cause', 'split'],
    learnerText: "I would like to know why before we go further, but I see the liability and cause split.",
  });
  const analogy = deriveObjectOwnershipState({
    currentObject: 'liability cause split',
    objectKeywords: ['liability', 'cause', 'split'],
    learnerText:
      'This is a parallel case with the same pattern: the liability and cause split keeps payment apart from what happened.',
  });

  assert.equal(ordinaryPreference.probes.find((probe) => probe.family === 'near_transfer').passed, false);
  assert.equal(analogy.probes.find((probe) => probe.family === 'near_transfer').passed, true);
});

test('near transfer credits a different-file transfer only when the distinction travels', () => {
  const transferred = deriveObjectOwnershipState({
    currentObject: 'liability cause split',
    objectKeywords: ['liability', 'cause', 'split', 'warranty', 'hand', 'props'],
    learnerText:
      "All right, try it on a different file. First line: the bonded builder holds the warranty, so that line is liability. Second line: the yard mark and toll book put the removed props in one carrier's hands, so that line is cause.",
  });
  const merelyTopical = deriveObjectOwnershipState({
    currentObject: 'liability cause split',
    objectKeywords: ['liability', 'cause', 'split', 'file'],
    learnerText: 'I opened a different file and I would like to know why the liability and cause split matters.',
  });

  assert.equal(transferred.probes.find((probe) => probe.family === 'near_transfer').passed, true);
  assert.equal(merelyTopical.probes.find((probe) => probe.family === 'near_transfer').passed, false);
});

test('near transfer credits structure-travel language paired with the liability cause distinction', () => {
  const state = deriveObjectOwnershipState({
    currentObject: 'liability cause split',
    objectKeywords: ['liability', 'cause', 'split', 'bond', 'hand'],
    learnerText:
      "The same structure travels to another case: the bond line answers who pays, while the hand line answers what brought the work down.",
  });

  assert.equal(state.probes.find((probe) => probe.family === 'near_transfer').passed, true);
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
