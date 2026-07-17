import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aggregateTutorStubLearnerResponseProvenance,
  createTutorStubLearnerResponseProvenance,
  summarizeTutorStubLearnerResponseProvenance,
  tutorStubLearnerResponseProvenanceLabel,
} from '../services/tutorStubLearnerResponseProvenance.js';

test('learner response provenance distinguishes human, automated, accepted, and edited responses', () => {
  const human = createTutorStubLearnerResponseProvenance({
    authorship: 'human',
    origin: 'human_direct',
    inputMethod: 'terminal',
  });
  const automated = createTutorStubLearnerResponseProvenance({
    authorship: 'ai',
    origin: 'automated_learner',
    inputMethod: 'automated_learner',
    humanInLoop: false,
    modelRef: 'codex.gpt-5.6-terra',
    provider: 'codex',
    model: 'gpt-5.6-terra',
  });
  const accepted = createTutorStubLearnerResponseProvenance({
    authorship: 'ai',
    origin: 'mixed_suggestion_accepted',
    inputMethod: 'slash_use',
    humanInLoop: true,
  });
  const edited = createTutorStubLearnerResponseProvenance({
    authorship: 'hybrid',
    origin: 'mixed_suggestion_edited',
    inputMethod: 'tab_completion_then_edit',
    humanInLoop: true,
  });

  assert.deepEqual(
    [human, automated, accepted, edited].map((row) => [
      row.authorship,
      row.humanGenerated,
      row.aiGenerated,
      row.aiAssisted,
      row.humanInLoop,
    ]),
    [
      ['human', true, false, false, true],
      ['ai', false, true, false, false],
      ['ai', false, true, false, true],
      ['hybrid', true, true, true, true],
    ],
  );
  assert.equal(automated.model.modelRef, 'codex.gpt-5.6-terra');
  assert.match(tutorStubLearnerResponseProvenanceLabel(accepted), /accepted by a human/u);
});

test('compound learner provenance preserves fragment authorship and aggregates mixed input as hybrid', () => {
  const human = createTutorStubLearnerResponseProvenance({
    authorship: 'human',
    origin: 'human_direct',
    inputMethod: 'terminal',
  });
  const ai = createTutorStubLearnerResponseProvenance({
    authorship: 'ai',
    origin: 'mixed_suggestion_accepted',
    inputMethod: 'tab_completion',
    humanInLoop: true,
  });
  const compound = aggregateTutorStubLearnerResponseProvenance([ai, human]);

  assert.equal(compound.authorship, 'hybrid');
  assert.equal(compound.humanGenerated, true);
  assert.equal(compound.aiGenerated, true);
  assert.equal(compound.origin, 'compound_learner_turn');
  assert.deepEqual(
    compound.components.map((row) => row.authorship),
    ['ai', 'human'],
  );
});

test('learner provenance summary counts legacy turns as unknown', () => {
  const summary = summarizeTutorStubLearnerResponseProvenance([
    {
      learnerResponseProvenance: createTutorStubLearnerResponseProvenance({
        authorship: 'human',
        origin: 'human_direct',
        inputMethod: 'terminal',
      }),
    },
    {
      learnerResponseProvenance: createTutorStubLearnerResponseProvenance({
        authorship: 'ai',
        origin: 'automated_learner',
        inputMethod: 'automated_learner',
      }),
    },
    {},
  ]);

  assert.deepEqual(summary.counts, { human: 1, ai: 1, hybrid: 0, unknown: 1 });
  assert.equal(summary.humanInvolved, 1);
  assert.equal(summary.aiInvolved, 1);
});
