import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createTutorStubPublicEvidenceModel } from '../services/tutorStubPublicEvidence.js';
import { createTutorStubResponseLeakAudit } from '../services/tutorStubResponseLeakAudit.js';

function fixtureWorld() {
  const premises = [
    { id: 'p1', fact: ['seen', 'coin'], surface: 'The public coin was seen.' },
    { id: 'p2', fact: ['carried', 'moonstone', 'verrell'], surface: 'Verrell carried the moonstone die.' },
  ];
  return {
    question: 'Who struck the coin?',
    setting: 'The assay room.',
    openingFrame: { situation: 'A public coin waits.' },
    questionPattern: ['struckBy', 'coin', '?who'],
    secret: { fact: ['struckBy', 'coin', 'verrell'] },
    background: [],
    premises,
    premiseById: new Map(premises.map((row) => [row.id, row])),
    releaseSchedule: [
      { turn: 1, premise: 'p1' },
      { turn: 3, premise: 'p2' },
    ],
    rules: [],
  };
}

function auditModel() {
  return createTutorStubResponseLeakAudit({ publicEvidenceModel: createTutorStubPublicEvidenceModel() });
}

test('missing worlds pass without inventing audit state', () => {
  assert.deepEqual(auditModel().auditTutorResponseLeak({ text: 'anything', world: null }), { ok: true, leaks: [] });
});

test('unreleased premise rows preserve token thresholds, schedule, and sorted matches', () => {
  const rows = auditModel().unreleasedPremiseLeakRows({
    text: 'The moonstone belongs with Verrell.',
    world: fixtureWorld(),
    tutorTurn: 1,
    learnerText: '',
  });
  assert.deepEqual(rows, [{ premise: 'p2', scheduledTurn: 3, matches: ['moonstone', 'verrell'] }]);
});

test('concealed answer names and unreleased content remain distinct leak records', () => {
  const result = auditModel().auditTutorResponseLeak({
    text: 'Verrell carried the moonstone.',
    world: fixtureWorld(),
    tutorTurn: 1,
    learnerText: '',
  });
  assert.equal(result.ok, false);
  assert.equal(result.finalEntailed, false);
  assert.deepEqual(
    result.leaks
      .map((row) => row.type)
      .filter((type) => ['concealed_answer_name', 'unreleased_premise_content'].includes(type)),
    ['concealed_answer_name', 'unreleased_premise_content'],
  );
  assert.deepEqual(result.publicPremiseIds, ['p1']);
});

test('the CLI binds rather than redeclares the response-leak audit', () => {
  const source = fs.readFileSync(new URL('../scripts/tutor-stub.js', import.meta.url), 'utf8');
  assert.match(source, /createTutorStubResponseLeakAudit/u);
  assert.doesNotMatch(source, /function (?:unreleasedPremiseLeakRows|auditTutorResponseLeak)\(/u);
  assert.doesNotMatch(source, /const PRIVATE_TOKEN_STOPWORDS/u);
});
