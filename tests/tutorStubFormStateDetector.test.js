import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_FORM_FEATURE_NAMES,
  TUTOR_STUB_FORM_FEATURE_VERSION,
  TUTOR_STUB_FORM_FEATURE_VERSIONS,
  TUTOR_STUB_FORM_STATES,
  compileTutorStubFormDetector,
  computeTutorStubFormFeatures,
  predictTutorStubFormState,
  readTutorStubFormState,
  tutorStubFormFeatureNames,
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
  assert.equal(TUTOR_STUB_FORM_FEATURE_VERSION, 'form-v2');
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
  assert.throws(
    () => compileTutorStubFormDetector({ featureVersion: TUTOR_STUB_FORM_FEATURE_VERSION, weights: { lost: [0, 1] } }),
    /length/,
  );
  const detector = compileTutorStubFormDetector({
    version: 'zero',
    featureVersion: TUTOR_STUB_FORM_FEATURE_VERSION,
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
    featureVersion: TUTOR_STUB_FORM_FEATURE_VERSION,
    threshold: 0.6,
    weights: biased,
  });
  const r2 = readTutorStubFormState(d2, 'anything');
  assert.equal(r2.state, 'irritated');
  assert.equal(r2.pressure, 'mockery');
  assert.equal(r2.quiet, null);
  const d3 = compileTutorStubFormDetector({
    version: 'lost',
    featureVersion: TUTOR_STUB_FORM_FEATURE_VERSION,
    threshold: 0.6,
    weights: { ...zero, lost: [...new Array(dim).fill(0), 2] },
  });
  const r3 = readTutorStubFormState(d3, 'anything');
  assert.equal(r3.state, 'lost');
  assert.equal(r3.pressure, null);
  assert.equal(r3.quiet, 'confused');
});

test('form-v1 stays loadable and frozen beside form-v2', () => {
  assert.deepEqual([...TUTOR_STUB_FORM_FEATURE_VERSIONS], ['form-v1', 'form-v2']);
  assert.equal(tutorStubFormFeatureNames('form-v1').length, 40);
  assert.equal(tutorStubFormFeatureNames('form-v2').length, 45);
  const shipped = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/manner-trigger/form-v1.json'), 'utf8'));
  const v1 = compileTutorStubFormDetector(shipped);
  assert.equal(v1.featureVersion, 'form-v1');
  assert.deepEqual(shipped.featureNames, [...tutorStubFormFeatureNames('form-v1')]);
  // Reads compute with the artifact's own feature set, not the default one.
  const line = "Hang on. Was it the first one or the second? I wrote it down and now I can't tell which I meant.";
  assert.equal(computeTutorStubFormFeatures(line, {}, 'form-v1').length, 40);
  assert.equal(computeTutorStubFormFeatures(line).length, 45);
  assert.equal(readTutorStubFormState(v1, line).state, 'lost');
  assert.throws(() => computeTutorStubFormFeatures(line, {}, 'form-v9'), /unknown featureVersion/);
});

test('shipped form-v2 artifact compiles on the form-v2 cue set', () => {
  const artifact = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/manner-trigger/form-v2.json'), 'utf8'));
  assert.equal(artifact.version, 'form-v2');
  assert.equal(artifact.featureVersion, 'form-v2');
  assert.deepEqual([...artifact.featureNames], [...tutorStubFormFeatureNames('form-v2')]);
  const detector = compileTutorStubFormDetector(artifact);
  assert.equal(detector.featureVersion, 'form-v2');
  // The demand for the answer no longer reads as a stumble.
  const demand = readTutorStubFormState(
    detector,
    'You are pushing me. I did every question, so what did I do that counted?',
  );
  assert.notEqual(demand.state, 'lost');
});

test('shipped form-v3 artifact is form-v2 cues on the widened pool', () => {
  const artifact = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/manner-trigger/form-v3.json'), 'utf8'));
  assert.equal(artifact.version, 'form-v3');
  assert.equal(artifact.featureVersion, 'form-v2');
  assert.deepEqual([...artifact.featureNames], [...tutorStubFormFeatureNames('form-v2')]);
  // The pool is the archive worlds plus the three lesson worlds of the
  // 2026-09-02 bench; the hero worlds 035/036/037 stay held out.
  for (const world of ['world_038_seasons_tilt', 'world_039_percent_up_down', 'world_040_sam_and_me'])
    assert.ok(artifact.trainedOn.worlds.includes(world), world);
  for (const world of ['world_035_nine_oclock_ghost', 'world_036_class_plant', 'world_037_fraction_sum'])
    assert.ok(!artifact.trainedOn.worlds.includes(world), world);
  const v3 = compileTutorStubFormDetector(artifact);
  assert.equal(v3.version, 'form-v3');
  assert.equal(v3.featureVersion, 'form-v2');
  // A question-shaped demand from held-out world 037 (step-4 trace, Sonnet
  // learner) reads as the demand under form-v3; form-v2 read it as a stumble.
  const line =
    "Just tell me what to write already — is it two fifths or not? Priya's saying it's five sixths. Which one do I put down?";
  assert.equal(readTutorStubFormState(v3, line).state, 'jumping_ahead');
  const v2 = compileTutorStubFormDetector(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'config/manner-trigger/form-v2.json'), 'utf8')),
  );
  assert.equal(readTutorStubFormState(v2, line).state, 'lost');
});

test('shipped form-v4 artifact is form-v2 cues on the step-6 pool', () => {
  const artifact = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/manner-trigger/form-v4.json'), 'utf8'));
  assert.equal(artifact.version, 'form-v4');
  assert.equal(artifact.featureVersion, 'form-v2');
  assert.deepEqual([...artifact.featureNames], [...tutorStubFormFeatureNames('form-v2')]);
  // The pool is the form-v3 pool plus the six plants-only traces on the
  // 2026-09-03 lesson worlds 041/042/043; the hero worlds 035/036/037 stay
  // held out.
  for (const world of [
    'world_038_seasons_tilt',
    'world_039_percent_up_down',
    'world_040_sam_and_me',
    'world_041_log_and_pebble',
    'world_042_half_a_moon',
    'world_043_tails_is_due',
  ])
    assert.ok(artifact.trainedOn.worlds.includes(world), world);
  for (const world of ['world_035_nine_oclock_ghost', 'world_036_class_plant', 'world_037_fraction_sum'])
    assert.ok(!artifact.trainedOn.worlds.includes(world), world);
  const v4 = compileTutorStubFormDetector(artifact);
  assert.equal(v4.version, 'form-v4');
  assert.equal(v4.featureVersion, 'form-v2');
  // A forced-choice demand from world 043 (Sonnet learner, t2) reads as the
  // demand with a clear margin. The line is in form-v4's pool, so this pins
  // behaviour, not transfer; form-v3 sits on the threshold for it (p 0.51).
  const line = "Is it a half or isn't it? Mina says a half, I say more. Which one do I write down? Can you just say?";
  const demand = readTutorStubFormState(v4, line);
  assert.equal(demand.state, 'jumping_ahead');
  assert.ok(demand.p > 0.9, String(demand.p));
  // The two irritated shapes the new worlds added are not read by either
  // artifact: no closed-class cue carries them.
  for (const silent of [
    'Are you reading that off a card? Just tell me what the torch shows.',
    "Stop doing the slow bit. I'm not five. Say it once, normally, and I'll write it.",
  ])
    assert.notEqual(readTutorStubFormState(v4, silent).state, 'irritated', silent);
});

test('form-v2 tells question kinds apart by grammar', () => {
  const idx = (name) => TUTOR_STUB_FORM_FEATURE_NAMES.indexOf(name);
  const on = (text) => {
    const f = computeTutorStubFormFeatures(text);
    return new Set(TUTOR_STUB_FORM_FEATURE_NAMES.filter((_, i) => f[i] > 0));
  };
  // Doubt about one's own past act.
  const doubt = on("Wait — which one did I mean? I wrote it down and now I can't tell.");
  assert.ok(doubt.has('q_self_doubt'));
  assert.ok(doubt.has('confusion_marker'));
  assert.ok(!doubt.has('q_to_you'));
  assert.ok(!doubt.has('wait_no_correct'));
  // A demand aimed at the other speaker for the answer.
  const demand = on('Just tell me what to write already — is it the first or not? Which one do I put down?');
  assert.ok(demand.has('q_to_you'));
  assert.ok(!demand.has('q_self_doubt'));
  // A correction opener is not a stumble.
  const correct = on('Wait, no — we did that step and it came out the other way, I saw it!');
  assert.ok(correct.has('wait_no_correct'));
  assert.ok(!correct.has('confusion_marker'));
  // The stake is a conditional AND a cost; the commitment is neither.
  const stake = on(
    'If I write that down, I am the one apologizing in front of everyone. So it can still be the other thing.',
  );
  assert.ok(stake.has('stake_conditional'));
  assert.ok(!stake.has('commit_future'));
  const commit = on("Right — I'll write that down, and I'll say sorry separately.");
  assert.ok(commit.has('commit_future'));
  assert.ok(!commit.has('stake_conditional'));
  // The form-v1 leak is closed: "why" plus any number word, not two words from one schedule.
  assert.ok(on('Why four pieces and not nine?').has('why_challenge'));
  assert.equal(idx('q_self_doubt') >= 0, true);
});
