import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadWorld } from '../services/dramaticDerivation/index.js';
import {
  projectTutorStubWorldPublicPrompt,
  projectTutorStubTeachingCharter,
} from '../services/tutorStubWorldPromptContext.js';
import {
  buildTutorStubClosingPattern,
  resolveTutorStubWorldFrame,
  tutorStubWorldClosingPattern,
  tutorStubWorldFrameIsLesson,
  tutorStubWorldFrameProjection,
  validateTutorStubWorldFrame,
} from '../services/tutorStubWorldFrame.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_DIR = path.join(ROOT, 'config', 'drama-derivation');

const INQUIRY_WORLD = {
  title: 'The Cellar Key',
  setting: 'A country house.',
  question: 'Who took the key?',
  publicObjects: [],
};

test('a world with no frame block resolves to the inquiry nouns the prompts carried before', () => {
  const frame = resolveTutorStubWorldFrame(INQUIRY_WORLD);
  assert.equal(frame.kind, 'inquiry');
  assert.equal(frame.heading, 'Detective-story world');
  assert.equal(frame.task_noun, 'case');
  assert.equal(frame.learner_noun, 'investigator');
  assert.equal(frame.candidate_noun, 'suspect');
  assert.equal(frame.answer_noun, 'verdict');
  assert.equal(frame.closing_words, null);
  assert.equal(resolveTutorStubWorldFrame(null).heading, 'Detective-story world');
  assert.equal(tutorStubWorldFrameIsLesson(INQUIRY_WORLD), false);
  assert.equal(tutorStubWorldFrameProjection(INQUIRY_WORLD), null, 'no block means no projection field');
});

test('a lesson frame swaps every noun and supplies closing words, with per-field overrides', () => {
  const world = { ...INQUIRY_WORLD, presentation: { frame: { kind: 'lesson', learner_noun: 'student' } } };
  const frame = resolveTutorStubWorldFrame(world);
  assert.equal(frame.kind, 'lesson');
  assert.equal(frame.heading, 'Lesson world');
  assert.equal(frame.task_noun, 'problem');
  assert.equal(frame.learner_noun, 'student');
  assert.equal(frame.candidate_noun, 'candidate answer');
  assert.equal(frame.answer_noun, 'answer');
  assert.ok(frame.closing_words.includes('final answer'));
  assert.equal(tutorStubWorldFrameIsLesson(world), true);
  const projection = tutorStubWorldFrameProjection(world);
  assert.equal(projection.learner_noun, 'student');
  assert.ok(Array.isArray(projection.closing_words));
  assert.equal(resolveTutorStubWorldFrame({ frame: 'lesson' }).kind, 'lesson', 'a bare kind string is accepted');
  assert.equal(resolveTutorStubWorldFrame({ frame: { kind: 'opera' } }).kind, 'inquiry', 'unknown kinds degrade');
});

test('closing patterns come from the world only when it declares words', () => {
  const fallback = /\bculprit\b/iu;
  assert.equal(tutorStubWorldClosingPattern(INQUIRY_WORLD, fallback), fallback);
  const lesson = { presentation: { frame: { kind: 'lesson', closing_words: ['the sum is', 'equals'] } } };
  const pattern = tutorStubWorldClosingPattern(lesson, fallback);
  assert.ok(pattern.test('So the sum is five sixths.'));
  assert.ok(!pattern.test('Who is the culprit?'));
  assert.ok(
    tutorStubWorldClosingPattern(null, fallback, { closingWords: ['final answer'] }).test('your final answer?'),
  );
  assert.equal(buildTutorStubClosingPattern([]), null);
  assert.ok(buildTutorStubClosingPattern(['a+b']).test('so a+b then'), 'regex characters are escaped');
});

test('validation reports authoring defects in plain words and accepts a good block', () => {
  assert.deepEqual(validateTutorStubWorldFrame(INQUIRY_WORLD), []);
  assert.deepEqual(
    validateTutorStubWorldFrame({ presentation: { frame: { kind: 'lesson', closing_words: ['equals'] } } }),
    [],
  );
  const issues = validateTutorStubWorldFrame({
    presentation: { frame: { kind: 'opera', task_noun: '', closing_words: [], colour: 'red' } },
  });
  assert.ok(issues.some((line) => line.includes('kind must be one of')));
  assert.ok(issues.some((line) => line.includes('task_noun must be a non-empty string')));
  assert.ok(issues.some((line) => line.includes('closing_words must be a non-empty list')));
  assert.ok(issues.some((line) => line.includes('colour is not a known frame field')));
});

test('the public prompt and charter for a lesson world carry lesson nouns and no detective words', () => {
  const world = loadWorld(path.join(WORLD_DIR, 'world-037-fraction-sum.yaml'));
  assert.equal(tutorStubWorldFrameIsLesson(world), true);
  const prompt = projectTutorStubWorldPublicPrompt(world).join('\n');
  const charter = projectTutorStubTeachingCharter(world).join('\n');
  assert.match(prompt, /^# Lesson world$/mu);
  assert.match(prompt, /Play the teacher guiding the learner through the problem\./u);
  assert.match(prompt, /Treat the learner as the pupil; do not solve the problem for them\./u);
  for (const text of [prompt, charter]) {
    assert.doesNotMatch(text, /\b(detective|investigator|suspect|culprit|verdict|case)\b/iu);
  }
});

test('an inquiry world still renders the detective heading and nouns', () => {
  const world = loadWorld(path.join(WORLD_DIR, 'world-001-nocturne.yaml'));
  const prompt = projectTutorStubWorldPublicPrompt(world).join('\n');
  assert.match(prompt, /^# Detective-story world$/mu);
  assert.match(prompt, /Play the tutor\/investigator guiding the learner through the case\./u);
});
