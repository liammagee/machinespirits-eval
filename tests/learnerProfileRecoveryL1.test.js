import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  analyzeLeaveOneOutNearestCentroid,
  analyzeLearnerProfileRecoveryVectors,
  LearnerProfileRecoveryReplayError,
  loadLearnerProfileRecoveryCorpus,
  readLearnerProfileRecoveryManifest,
  validateLearnerProfileRecoveryManifest,
  verifyLearnerProfileRecoveryResult,
} from '../scripts/replay-learner-profile-recovery-l1.js';
import {
  createTutorStubQuietDetectorState as createQdV1State,
  detectTutorStubQuietState as detectQdV1,
} from '../services/tutorStubQuietDetectorV1.js';
import {
  createTutorStubQuietDetectorState as createQdV2State,
  detectTutorStubQuietState as detectQdV2,
} from '../services/tutorStubQuietDetector.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('learner-profile recovery restores the exact historical qd-v1 bytes and pins their provenance', () => {
  const manifest = readLearnerProfileRecoveryManifest();
  const report = validateLearnerProfileRecoveryManifest(manifest);
  const bytes = fs.readFileSync(report.quietPath);

  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), manifest.provenance.quiet_detector.sha256);
  assert.equal(
    manifest.provenance.quiet_detector.sha256,
    '318da00fff7fc8049fc21640f2978cc119ff3a45a53a5dd126e3df66656ec6c4',
  );
  assert.equal(report.expectedTotal, 64);
});

test('historical qd-v1 stays distinct from qd-v2 wordy-flat detection', () => {
  const line = 'Fine. The level is still the same as yesterday.';
  assert.equal(detectQdV1(createQdV1State(), line, { pressure: 'neutral' }).type, null);
  assert.equal(detectQdV2(createQdV2State(), line, { pressure: 'neutral' }).type, 'flat');
});

test('historical recovery replay fails closed when original trace arms are absent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-profile-recovery-'));
  const manifest = structuredClone(readLearnerProfileRecoveryManifest());
  manifest.corpus_root = 'exports/tutor-stub-outcome';

  assert.throws(
    () => loadLearnerProfileRecoveryCorpus(manifest, { root }),
    (error) => {
      assert.ok(error instanceof LearnerProfileRecoveryReplayError);
      assert.match(error.message, /original trace corpus is incomplete/u);
      assert.equal(error.details.missing.length, 18);
      return true;
    },
  );
});

test('recovery analyzer uses leave-one-out full centroids for full and opening-turn readings', () => {
  const manifest = {
    states: ['signal', 'neutral'],
    corpus: {
      first: { expected_dialogues: 2 },
      second: { expected_dialogues: 2 },
    },
    classifier: { opening_turns: [1, 2] },
    expected_result: {
      dialogues: 4,
      correct: 4,
      opening_turns: {
        1: { eligible: 4, correct: 4 },
        2: { eligible: 4, correct: 4 },
      },
    },
  };
  const vectors = [
    { persona: 'first', vec: { signal: 1, neutral: 0 }, perTurn: ['signal', 'signal'] },
    { persona: 'first', vec: { signal: 1, neutral: 0 }, perTurn: ['signal', 'signal'] },
    { persona: 'second', vec: { signal: 0, neutral: 1 }, perTurn: ['neutral', 'neutral'] },
    { persona: 'second', vec: { signal: 0, neutral: 1 }, perTurn: ['neutral', 'neutral'] },
  ];

  const result = analyzeLearnerProfileRecoveryVectors(manifest, vectors);
  assert.equal(result.correct, 4);
  assert.deepEqual(result.openingTurns['1'], { eligible: 4, correct: 4, accuracy: 1 });
  assert.equal(verifyLearnerProfileRecoveryResult(manifest, result), true);
});

test('persona and world readings use the identical generic classifier', () => {
  const states = ['signal', 'neutral'];
  const vectors = [
    {
      id: 'first-a',
      persona: 'first',
      world: 'a',
      vec: { signal: 1, neutral: 0 },
      perTurn: ['signal', 'signal'],
    },
    {
      id: 'first-b',
      persona: 'first',
      world: 'b',
      vec: { signal: 1, neutral: 0 },
      perTurn: ['signal', 'signal'],
    },
    {
      id: 'second-a',
      persona: 'second',
      world: 'a',
      vec: { signal: 0, neutral: 1 },
      perTurn: ['neutral', 'neutral'],
    },
    {
      id: 'second-b',
      persona: 'second',
      world: 'b',
      vec: { signal: 0, neutral: 1 },
      perTurn: ['neutral', 'neutral'],
    },
  ];

  const persona = analyzeLeaveOneOutNearestCentroid({
    vectors,
    states,
    labelKey: 'persona',
    labels: ['first', 'second'],
    openingTurns: [1],
  });
  const world = analyzeLeaveOneOutNearestCentroid({
    vectors,
    states,
    labelKey: 'world',
    labels: ['a', 'b'],
    openingTurns: [1],
  });

  assert.equal(persona.correct, 4);
  assert.equal(world.correct, 0);
  assert.deepEqual(Object.keys(persona), Object.keys(world));
});

test('frozen recovery manifest is tracked inside the repository', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'config', 'learner-profile-recovery-l1.json')));
});
