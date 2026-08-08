import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_REPLY_FEATURES_VERSION,
  describeTutorStubReplyFeatures,
  tutorStubReplyFeatureAttributes,
} from '../tutorStubReplyFeatures.js';

const acts = (text, learnerText = null) =>
  Object.entries(describeTutorStubReplyFeatures(text, { learnerText }).acts)
    .filter(([, present]) => present)
    .map(([act]) => act)
    .sort();

test('an empty or blank reply has no features', () => {
  assert.equal(describeTutorStubReplyFeatures(''), null);
  assert.equal(describeTutorStubReplyFeatures('   \n '), null);
  assert.equal(describeTutorStubReplyFeatures(null), null);
  assert.deepEqual(tutorStubReplyFeatureAttributes(null), []);
});

test('each act fires on its own shape and stays quiet on a bare telling', () => {
  assert.ok(acts('What did the strip show?').includes('ask'));
  assert.ok(acts('The entry says the hose stayed dry.').includes('cite'));
  assert.ok(acts('You said the strip came back dry, and that stands.').includes('credit'));
  assert.ok(acts('Go and check the second entry, then bring me what it says.').includes('assign'));
  assert.ok(acts('Either the hose let go or the shower did.').includes('contrast'));
  assert.ok(acts('Fair — plain words then.').includes('restate'));
  assert.ok(acts('Fair call, I put that badly.').includes('concede'));

  // The residual. A flat telling with none of the marked acts is `assert`,
  // and `assert` is never claimed alongside one of them.
  assert.deepEqual(acts('Water moves downhill and it collects at the lowest joint.'), ['assert']);
  assert.ok(!acts('The entry says the hose stayed dry.').includes('assert'));
});

test('the register-swap announcement counts as restating, whatever word is mocked', () => {
  // The shape is "<anything>-speak, dropped" — the filled-in word belongs to
  // whichever world is running, so the pattern must not carry a scene noun.
  assert.ok(acts('No more invoice-talk. The pipe weeps when pressure climbs.').includes('restate'));
  assert.ok(acts("I'll drop the ledger-speak: water got in upstairs.").includes('restate'));
  assert.ok(acts('Enough of the courtroom-talk — here it is straight.').includes('restate'));
});

test('authority records whose say-so is doing the work', () => {
  const at = (text) => describeTutorStubReplyFeatures(text).authority;
  assert.equal(at('The entry says it stayed dry.'), 'record');
  assert.equal(at('You said it came back dry.'), 'learner');
  assert.equal(at('You said it came back dry, but the entry says otherwise.'), 'shared');
  assert.equal(at('Trust me, it stayed dry.'), 'own');
  assert.equal(at('It stayed dry.'), 'none');
});

test('the conditional stake needs both halves', () => {
  const stakes = (text) => describeTutorStubReplyFeatures(text).stakes;
  assert.equal(stakes('If that entry reads as you expect, send your letter tonight.'), true);
  assert.equal(stakes('If it rains the yard floods.'), false);
  assert.equal(stakes('Send your letter tonight.'), false);
});

test('the two measured properties bucket at the stated cut points', () => {
  const short = describeTutorStubReplyFeatures('Water got in. It ran down. That is the mark.');
  assert.equal(short.sentenceLength, 'short');
  assert.equal(short.latinate, 'low');

  const long = describeTutorStubReplyFeatures(
    'The documentation of the investigation shows a progressive deterioration of the installation, ' +
      'and the confirmation of that determination rests on an examination of the relevant identification ' +
      'material that the organisation retained through the duration of the operation.',
  );
  assert.equal(long.sentenceLength, 'long');
  assert.equal(long.latinate, 'high');
});

test('the learner echo counts their content words coming back, and needs their turn to do it', () => {
  const withLearner = describeTutorStubReplyFeatures('The paper strip and the hairline split, then.', {
    learnerText: 'We did the paper strip and it came back dry.',
  });
  assert.ok(withLearner.counts.learnerEcho.shared >= 2);
  assert.ok(withLearner.counts.learnerEcho.rate > 0);
  assert.equal(describeTutorStubReplyFeatures('The paper strip.').counts.learnerEcho, null);
});

test('the procedure vocabulary is seen where word length misses it', () => {
  const label = (text) => describeTutorStubReplyFeatures(text).abstractLabel;
  // Every word here is one the tutor role prompt names as an abstract label.
  assert.equal(label('The condition holds on that route.'), true);
  assert.equal(label('Take the reading as the rule for the whole case.'), true);
  assert.equal(label('That is the procedure.'), true);
  assert.equal(label('Water got in upstairs and ran along the timber.'), false);

  // The point of a separate column: these are short Anglo-Saxon words, so the
  // Latin-suffix count cannot see them.
  const both = describeTutorStubReplyFeatures('The rule and the route both hold.');
  assert.equal(both.abstractLabel, true);
  assert.equal(both.latinate, 'low');
});

test('announcing plain speech is its own column, not a second name for restating', () => {
  const plain = (text) => describeTutorStubReplyFeatures(text);
  assert.equal(plain('Plain talk: the pipe let go.').plainSpeech, true);
  assert.equal(plain('Simply put, water found the lowest joint.').plainSpeech, true);
  assert.equal(plain('It is a hairline split.').plainSpeech, false);

  // The two columns overlap on some phrases and not others, which is why both
  // are kept: "put plainly" is a restating too, "plain talk" is only the
  // announcement. On the four falsifier runs, 81 of the 86 replies announcing
  // plain speech carried no restate flag.
  assert.equal(plain('Put plainly, the hose let go.').acts.restate, true);
  assert.equal(plain('Plain talk: the pipe let go.').acts.restate, false);
});

test('the learner echo buckets at the stated cut points, and stays null without their turn', () => {
  const learnerText = 'The paper strip came back dry, so the shower pan cannot be leaking there.';
  const echo = (reply) => describeTutorStubReplyFeatures(reply, { learnerText }).echo;
  assert.equal(echo('Water moves downhill.'), 'low');
  assert.equal(echo('The paper strip came back dry, so the shower pan is not leaking there.'), 'high');
  assert.equal(describeTutorStubReplyFeatures('The paper strip.').echo, null);
});

test('the attribute list carries present features only, and no counts', () => {
  const attributes = tutorStubReplyFeatureAttributes(
    describeTutorStubReplyFeatures('The entry says otherwise. What do you make of that?'),
  );
  assert.ok(attributes.includes('act:ask'));
  assert.ok(attributes.includes('act:cite'));
  assert.ok(attributes.includes('authority:record'));
  assert.ok(!attributes.some((a) => a.includes('act:credit')));
  assert.ok(!attributes.some((a) => /words|questions|rate/u.test(a)));
});

test('the same reply measures the same way every time', () => {
  const text = 'Fair — plain words. The entry says the hose stayed dry. Go and check it, then tell me.';
  const first = describeTutorStubReplyFeatures(text);
  const second = describeTutorStubReplyFeatures(text);
  assert.deepEqual(first, second);
  assert.equal(first.version, TUTOR_STUB_REPLY_FEATURES_VERSION);
});

test('the stamp cannot see the card', () => {
  // The whole point of the instrument: it measures the reply blind, so a
  // figure separating on these features is a fact about the replies and not
  // the card copied into a new column. Enforced here rather than left to
  // review, because the tempting "improvement" is exactly to peek.
  const source = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tutorStubReplyFeatures.js'),
    'utf8',
  );
  const body = source.slice(source.indexOf('export const TUTOR_STUB_REPLY_FEATURES_SCHEMA'));
  for (const forbidden of [
    'mannerSwitch',
    'forcedCard',
    'cardActive',
    'quietType',
    'lastAdvance',
    'CARD_FORCE',
    'tutorStubMannerCard',
    'classifyTutorStubLearnerPressure',
  ]) {
    assert.ok(!body.includes(forbidden), `reply features must not read ${forbidden}`);
  }
  assert.ok(!/^import\s/mu.test(source), 'reply features must stay dependency-free');
});
