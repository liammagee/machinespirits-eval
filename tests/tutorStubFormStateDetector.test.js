import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_FORM_FEATURE_NAMES,
  TUTOR_STUB_FORM_FEATURE_VERSION,
  TUTOR_STUB_FORM_STATES,
  compileTutorStubFormDetector,
  computeTutorStubFormFeatures,
  predictTutorStubFormState,
  readTutorStubFormState,
} from '../services/tutorStubFormStateDetector.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'services/tutorStubFormStateDetector.js'), 'utf8').toLowerCase();

// Closed-class or generic words that a form cue may legitimately use even
// though the v6 token bags (the training story's vocabulary) also hold them.
// `tutor` and `line` are here for the module's own comments and parameter
// names ("the tutor's previous line"); neither appears inside a cue.
const CLOSED_CLASS_ALLOW = new Set(
  `actually again all anything back because came case cause chance choose claim close doing down either every
   feels final fine flat four full given going gone got harder his how however keep kept last later like likes
   make making must name need next nothing now off open out perfectly personal personally pick question quote
   read reads real reason right send sending sentence settled settles something sound split standing state stay
   stop stops talks thats them thing third three through time tired today tonight two ten seven eight ultimatum
   under understand unless uses waiting way week who why words work wrong writing written years youre youve
   answers asking assert concede conclusion confidence content counted demand entry established failed false
   finding record refuse register result reward route path phrase plainer sharper soften cleared minute minutes
   apology apologizing amend attack bitter careful circles dare date day delay drafted dry gloat holding memory
   months mock mockingly moved note order paper protecting public purchase showed slow survived traced
   vindicated voice walked contact mark marks mate meets hitting grind tutor line`.split(/\s+/),
);

test('form detector source carries no training-story noun from the v6 bags', () => {
  const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/manner-trigger/v6-cascade.json'), 'utf8'));
  const storyTokens = new Set();
  for (const bag of Object.values(v6.bags || {}))
    for (const token of bag.tokens) if (!CLOSED_CLASS_ALLOW.has(token)) storyTokens.add(token);
  // Sanity: the deny list really holds the story's things and people.
  for (const token of ['shower', 'hose', 'notebook', 'ledger', 'thursday', 'meeting', 'strip', 'sam', 'tank'])
    assert.ok(storyTokens.has(token), `expected ${token} in the deny list`);
  const leaked = [...storyTokens].filter((token) => new RegExp(`\\b${token.replace(/-/g, '\\W')}\\b`).test(SOURCE));
  assert.deepEqual(leaked, [], `story tokens found in detector source: ${leaked.join(', ')}`);
  // Weekday names and the training story's characters never appear either.
  for (const word of [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
    'priya',
    'pip',
    'rowan',
    'alder',
  ])
    assert.ok(!new RegExp(`\\b${word}\\b`).test(SOURCE), `${word} appears in detector source`);
});

test('feature vector length matches the feature-name contract', () => {
  const f = computeTutorStubFormFeatures('Just tell me what to write already—is it two or three?', {
    tutorText: 'Look at the record before you decide.',
    priorLearnerTexts: ['I already told you.'],
  });
  assert.equal(f.length, TUTOR_STUB_FORM_FEATURE_NAMES.length);
  assert.ok(f.every((v) => typeof v === 'number' && Number.isFinite(v)));
  const on = new Set(TUTOR_STUB_FORM_FEATURE_NAMES.filter((_, i) => f[i] > 0));
  assert.ok(on.has('imperative_opener'));
  assert.ok(on.has('just_already'));
  assert.ok(on.has('forced_choice_q'));
  assert.equal(TUTOR_STUB_FORM_FEATURE_VERSION, 'form-v1');
});

test('relational features fire on echo, not on any particular word', () => {
  const echo = computeTutorStubFormFeatures('"Check the history around that edit first" — you said that already.', {
    tutorText: 'Check the history around that edit first.',
  });
  const noEcho = computeTutorStubFormFeatures('"Check the history around that edit first" — you said that already.', {
    tutorText: 'What does the timing tell us?',
  });
  const idx = (name) => TUTOR_STUB_FORM_FEATURE_NAMES.indexOf(name);
  assert.equal(echo[idx('has_quote')], 1);
  assert.equal(echo[idx('quote_echoes_tutor')], 1);
  assert.equal(noEcho[idx('quote_echoes_tutor')], 0);
  assert.ok(echo[idx('tutor_echo')] > noEcho[idx('tutor_echo')]);
});

test('compile checks version and weight lengths; predict returns neutral below threshold', () => {
  const dim = TUTOR_STUB_FORM_FEATURE_NAMES.length;
  const zero = Object.fromEntries(TUTOR_STUB_FORM_STATES.map((s) => [s, new Array(dim + 1).fill(0)]));
  assert.throws(() => compileTutorStubFormDetector({ featureVersion: 'other', weights: zero }), /featureVersion/);
  assert.throws(() => compileTutorStubFormDetector({ featureVersion: 'form-v1', weights: { lost: [0, 1] } }), /length/);
  const detector = compileTutorStubFormDetector({
    version: 'zero',
    featureVersion: 'form-v1',
    threshold: 0.6,
    weights: zero,
  });
  const read = predictTutorStubFormState(detector, new Array(dim).fill(0));
  assert.equal(read.state, 'neutral');
  assert.equal(read.p, null);
  // A hand-set bias pushes one class over threshold; the read maps to both channels.
  const biased = { ...zero, irritated: [...new Array(dim).fill(0), 3], lost: [...new Array(dim).fill(0), 2] };
  const d2 = compileTutorStubFormDetector({
    version: 'biased',
    featureVersion: 'form-v1',
    threshold: 0.6,
    weights: biased,
  });
  const r2 = readTutorStubFormState(d2, 'anything');
  assert.equal(r2.state, 'irritated');
  assert.equal(r2.pressure, 'mockery');
  assert.equal(r2.quiet, null);
  const d3 = compileTutorStubFormDetector({
    version: 'lost',
    featureVersion: 'form-v1',
    threshold: 0.6,
    weights: { ...zero, lost: [...new Array(dim).fill(0), 2] },
  });
  const r3 = readTutorStubFormState(d3, 'anything');
  assert.equal(r3.state, 'lost');
  assert.equal(r3.pressure, null);
  assert.equal(r3.quiet, 'confused');
});
