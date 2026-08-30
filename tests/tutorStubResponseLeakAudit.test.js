import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { readTutorStubApplicationSource } from './helpers/tutorStubSourceContract.js';
import { fileURLToPath } from 'node:url';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import { createTutorStubPublicEvidenceModel } from '../services/tutorStubPublicEvidence.js';
import { createTutorStubResponseLeakAudit } from '../services/tutorStubResponseLeakAudit.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

// Shaped after world_005_marrick: the rules carry the castBlankFor/cutDieFor
// components, so the intermediate die check is live, and the answer is named
// publicly by a released custody clue.
function marrickWorld() {
  const premises = [
    { id: 'p1', fact: ['lightCoin', 'falseShilling'], surface: 'The fair shillings weigh light.' },
    { id: 'p2', fact: ['drewCrucible', 'edony'], surface: 'Edony alone drew the weir crucible.' },
  ];
  return {
    question: 'Who struck the false shillings?',
    setting: 'The guild-hall assay.',
    openingFrame: { situation: 'Light shillings wait.' },
    questionPattern: ['struckBy', 'falseShilling', '?who'],
    secret: { fact: ['struckBy', 'falseShilling', 'edony'] },
    background: [],
    premises,
    premiseById: new Map(premises.map((row) => [row.id, row])),
    releaseSchedule: [
      { turn: 1, premise: 'p1' },
      { turn: 2, premise: 'p2' },
    ],
    rules: [
      {
        if: [
          ['castBlankFor', 'falseShilling', '?who'],
          ['cutDieFor', 'falseShilling', '?who'],
        ],
        then: [['struckBy', 'falseShilling', '?who']],
      },
    ],
  };
}

test('evidence talk that names the die beside the answer is not the cutting conclusion', () => {
  // The sentence that killed the first resistant block's sharp run 6 on
  // 2026-08-29: a stage direction that lays a record beside other records.
  const result = auditModel().auditTutorResponseLeak({
    text: 'I place the broken-R die record beside Edony’s forge records.',
    world: marrickWorld(),
    tutorTurn: 3,
    learnerText: '',
  });
  assert.deepEqual(
    result.leaks.filter((row) => row.type === 'private_die_conclusion'),
    [],
    JSON.stringify(result.leaks),
  );
});

test('stating that the answer cut the die is still the cutting conclusion', () => {
  const result = auditModel().auditTutorResponseLeak({
    text: 'Edony cut the die for these shillings.',
    world: marrickWorld(),
    tutorTurn: 3,
    learnerText: '',
  });
  assert.deepEqual(
    result.leaks.filter((row) => row.type === 'private_die_conclusion').map((row) => row.fact),
    ['cutDieFor(falseShilling, edony)'],
  );
});

test('Rowan Flat correspondence clears only after its structured dye-path fact is released', () => {
  const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-030-rowan-flat.yaml'));
  const text = 'The dye traces a path from the hose split to the ceiling mark.';
  const audit = auditModel();

  const beforeRelease = audit.auditTutorResponseLeak({ text, world, tutorTurn: 6, learnerText: '' });
  assert.ok(beforeRelease.leaks.some((row) => row.type === 'unsupported_evidence_correspondence'));

  const afterRelease = audit.auditTutorResponseLeak({ text, world, tutorTurn: 7, learnerText: '' });
  assert.equal(
    afterRelease.leaks.some((row) => row.type === 'unsupported_evidence_correspondence'),
    false,
  );
});

test('Foxtrot fallback keeps an exact released correspondence separate from its declarative handoff', () => {
  const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-022-foxtrot-jukebox.yaml'));
  const source = world.premiseById.get('p_clamp').surface;
  const text =
    'I look at the inquiry log; “I can confirm this: ' + `${source}” That named public-record release is next.`;
  const result = auditModel().auditTutorResponseLeak({
    text,
    world,
    tutorTurn: 3,
    learnerText: '',
    publicPremiseIds: ['p_glare', 'p_clamp'],
  });

  assert.equal(result.ok, true, JSON.stringify(result.leaks));
});

test('the CLI binds rather than redeclares the response-leak audit', () => {
  const source = readTutorStubApplicationSource();
  assert.match(source, /createTutorStubResponseLeakAudit/u);
  assert.doesNotMatch(source, /function (?:unreleasedPremiseLeakRows|auditTutorResponseLeak)\(/u);
  assert.doesNotMatch(source, /const PRIVATE_TOKEN_STOPWORDS/u);
});
