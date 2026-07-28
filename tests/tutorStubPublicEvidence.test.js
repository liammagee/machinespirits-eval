import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  createTutorStubPublicEvidenceModel,
  projectTutorStubPublicReleaseLedger,
} from '../services/tutorStubPublicEvidence.js';

function fixtureWorld() {
  const premises = [
    { id: 'p1', fact: ['seen', 'coin'], surface: 'The coin was seen.' },
    { id: 'p2', fact: ['marked', 'coin'], surface: 'The coin bears a mark.' },
  ];
  return {
    question: 'Who marked the coin?',
    setting: 'The assay room.',
    openingFrame: { situation: 'A coin waits.' },
    questionPattern: ['marked', 'coin', '?who'],
    secret: { fact: ['marked', 'coin', 'verrell'] },
    background: [['coin', 'coin']],
    premises,
    premiseById: new Map(premises.map((row) => [row.id, row])),
    releaseSchedule: [
      { turn: 1, premise: 'p1' },
      { turn: 3, premise: 'p2' },
    ],
    rules: [{ if: [['seen', '?x']], then: [['available', '?x']] }],
  };
}

test('public release ledger preserves row order and the learner-visible release shape', () => {
  assert.deepEqual(
    projectTutorStubPublicReleaseLedger([
      { premise: 'p1', turn: 1, via: 'tutor', surface: 'ignored' },
      { premise: 'p2', turn: 3, via: 'director', fact: ['ignored'] },
    ]),
    [
      { premiseId: 'p1', turn: 1, via: 'tutor' },
      { premiseId: 'p2', turn: 3, via: 'director' },
    ],
  );
  assert.deepEqual(projectTutorStubPublicReleaseLedger(), []);
});

test('candidate premise ids honor explicit overrides and authored schedules', () => {
  const model = createTutorStubPublicEvidenceModel();
  const world = fixtureWorld();
  assert.deepEqual([...model.candidatePublicPremiseIds({ world, tutorTurn: 1 })], ['p1']);
  assert.deepEqual([...model.candidatePublicPremiseIds({ world, tutorTurn: 1, publicPremiseIds: ['p2', ''] })], ['p2']);
  assert.deepEqual([...model.candidatePublicPremiseIds({ world, publicPremiseIds: new Set(['p2']) })], ['p2']);
});

test('release-pacing state delegates only row selection to the CLI adapters', () => {
  const model = createTutorStubPublicEvidenceModel({
    committedReleaseRows: () => [{ premise: 'p1' }],
    currentReleaseRows: () => [{ premise: 'p2' }],
  });
  assert.deepEqual(
    [...model.candidatePublicPremiseIds({ world: fixtureWorld(), tutorTurn: 1, state: { releasePacing: {} } })],
    ['p1', 'p2'],
  );
});

test('public facts and closure preserve authored order and entailment', () => {
  const model = createTutorStubPublicEvidenceModel();
  const world = fixtureWorld();
  assert.deepEqual(model.publicFactsAtTurn(world, 1), [world.background[0], world.premises[0].fact]);
  assert.equal(model.entailsFactAtTurn(world, 1, ['available', 'coin']), true);
  assert.equal(model.entailsFactAtTurn(world, 1, world.secret.fact), false);
});

test('answer terms follow the variable position in the question pattern', () => {
  const model = createTutorStubPublicEvidenceModel();
  assert.equal(model.answerTermForWorld(fixtureWorld()), 'verrell');
  assert.equal(model.answerTermForWorld({ questionPattern: ['fixed'], secret: { fact: ['fixed'] } }), null);
});

test('guard-visible prose includes released surfaces and public dialogue only', () => {
  const model = createTutorStubPublicEvidenceModel();
  const world = fixtureWorld();
  const state = { turns: [{ learner: 'I saw it.', tutor: 'Keep looking.' }] };
  const provenance = model.publicTextForTurn(world, 1, 'Now what?', state);
  const assertion = model.publicEvidenceTextForAssertion(world, 1, 'Now what?', state);
  for (const text of [provenance, assertion]) {
    assert.match(text, /The coin was seen\./u);
    assert.match(text, /I saw it\./u);
    assert.match(text, /Now what\?/u);
    assert.doesNotMatch(text, /bears a mark/u);
  }
});

test('missing worlds fail closed to empty public projections', () => {
  const model = createTutorStubPublicEvidenceModel();
  assert.deepEqual([...model.candidatePublicPremiseIds()], []);
  assert.deepEqual(model.publicFactsAtTurn(null, 1), []);
  assert.deepEqual(model.entailedFactsAtTurn(null, 1), []);
  assert.equal(model.publicTextForTurn(null, 1), '');
  assert.equal(model.publicEvidenceTextForAssertion(null, 1), '');
});

test('the CLI binds rather than redeclares the public-evidence model', () => {
  const source = fs.readFileSync(new URL('../scripts/tutor-stub.js', import.meta.url), 'utf8');
  assert.match(source, /createTutorStubPublicEvidenceModel/u);
  assert.doesNotMatch(
    source,
    /function (?:candidatePublicPremiseIds|publicFactsAtTurn|entailedFactsAtTurn|entailsFactAtTurn|answerTermForWorld|publicTextForTurn|publicEvidenceTextForAssertion)\(/u,
  );
});
