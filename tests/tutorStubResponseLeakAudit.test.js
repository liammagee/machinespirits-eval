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

// Shaped after world_001_nocturne: the answer is a person the learner has
// already named aloud, and no rule can reach the verdict yet.
function nocturneWorld() {
  const premises = [{ id: 'p1', fact: ['held', 'folio'], surface: 'The folio was dried and catalogued.' }];
  return {
    question: 'Who composed the unsigned nocturne?',
    setting: 'The dried archive of the Cassia Conservatory.',
    openingFrame: { situation: 'An unsigned nocturne waits.' },
    questionPattern: ['composed', '?who', 'nocturne'],
    secret: { fact: ['composed', 'liane', 'nocturne'] },
    background: [],
    premises,
    premiseById: new Map(premises.map((row) => [row.id, row])),
    releaseSchedule: [{ turn: 1, premise: 'p1' }],
    rules: [],
  };
}

const NOCTURNE_LEARNER_TURN =
  'Liane’s presence in the copy-room makes her a possible maker of the folio during that winter, but it provides no evidence yet that she composed the music.';

test('quoting the learner back is not the tutor asserting the private conclusion', () => {
  // Verbatim from the turn-16 deterministic fallback that killed a paid
  // world_001_nocturne dialogue on 2026-07-30 (pilot-2 trace, seq 773). The
  // learner's own hedged sentence carries both the answer name and the
  // conclusion verb, and the guard read the quotation as the tutor's claim.
  const text =
    'Your reading of “Liane’s presence in the copy-room makes her a possible maker of the folio during that winter, but it provides no…” is the one I will answer now. Keep only what the public evidence already shows. What does that let us carry forward about “Liane’s presence in the copy-room makes her a possible maker of the folio during that winter, but it provides no evidence yet that she composed the music”?';
  const result = auditModel().auditTutorResponseLeak({
    text,
    world: nocturneWorld(),
    tutorTurn: 16,
    learnerText: NOCTURNE_LEARNER_TURN,
  });

  assert.equal(result.finalEntailed, false);
  assert.equal(result.answerNamePublic, true);
  assert.deepEqual(
    result.leaks.filter((row) => row.type === 'private_final_conclusion'),
    [],
  );
});

test('the private conclusion is still caught when the tutor states it in its own voice', () => {
  const result = auditModel().auditTutorResponseLeak({
    text: 'Liane composed the nocturne, and your reading of “she was in the copy-room that winter” settles it.',
    world: nocturneWorld(),
    tutorTurn: 16,
    learnerText: NOCTURNE_LEARNER_TURN,
  });

  assert.deepEqual(
    result.leaks.filter((row) => row.type === 'private_final_conclusion').map((row) => row.fact),
    ['composed(liane, nocturne)'],
  );
});

test('the CLI binds rather than redeclares the response-leak audit', () => {
  const source = fs.readFileSync(new URL('../scripts/tutor-stub.js', import.meta.url), 'utf8');
  assert.match(source, /createTutorStubResponseLeakAudit/u);
  assert.doesNotMatch(source, /function (?:unreleasedPremiseLeakRows|auditTutorResponseLeak)\(/u);
  assert.doesNotMatch(source, /const PRIVATE_TOKEN_STOPWORDS/u);
});
