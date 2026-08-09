import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildTranscriptArtifacts as buildTranscriptArtifactsDirect,
  buildDialoguePublicTranscript as buildDialoguePublicTranscriptDirect,
  buildDialogueFullTranscript as buildDialogueFullTranscriptDirect,
  isEgoSuperegoLearner as isEgoSuperegoLearnerDirect,
  extractInitialLearnerMessage as extractInitialLearnerMessageDirect,
} from '../services/dialogueTranscriptProjection.js';
import {
  buildTranscriptArtifacts,
  buildDialoguePublicTranscript,
  buildDialogueFullTranscript,
  isEgoSuperegoLearner,
  extractInitialLearnerMessage,
} from '../services/rubricEvaluator.js';

test('rubricEvaluator preserves the transcript projection compatibility exports', () => {
  assert.equal(buildTranscriptArtifacts, buildTranscriptArtifactsDirect);
  assert.equal(buildDialoguePublicTranscript, buildDialoguePublicTranscriptDirect);
  assert.equal(buildDialogueFullTranscript, buildDialogueFullTranscriptDirect);
  assert.equal(isEgoSuperegoLearner, isEgoSuperegoLearnerDirect);
  assert.equal(extractInitialLearnerMessage, extractInitialLearnerMessageDirect);
});

test('the extracted owner preserves bilateral tutor and learner deliberation order', () => {
  const turns = [
    {
      turnIndex: 0,
      suggestions: [{ message: 'Final tutor explanation.' }],
    },
  ];
  const trace = [
    { agent: 'ego', action: 'generate', turnIndex: 0, suggestions: [{ message: 'Tutor draft.' }] },
    { agent: 'superego', action: 'review', turnIndex: 0, feedback: 'Tutor critique.' },
    { agent: 'tutor', action: 'final_output', turnIndex: 0 },
    { agent: 'learner_ego_initial', action: 'deliberation', turnIndex: 0, detail: 'Learner draft.' },
    { agent: 'learner_superego', action: 'deliberation', turnIndex: 0, detail: 'Learner critique.' },
    { agent: 'learner_ego_revision', action: 'deliberation', turnIndex: 0, detail: 'Learner revision.' },
  ];

  assert.equal(
    buildDialogueFullTranscriptDirect(turns, trace, null),
    '\n--- Turn 1 ---\n' +
      '[Tutor Ego] Tutor draft.\n' +
      '[Tutor Superego] Tutor critique.\n' +
      '[Tutor Ego] (revised) Final tutor explanation.\n' +
      '[Learner Ego] Learner draft.\n' +
      '[Learner Superego] Learner critique.\n' +
      '[Learner Ego] (revised) Learner revision.',
  );
});

test('transcript consumers depend on the extracted owner, not the rubric implementation', () => {
  const rubricSource = readFileSync(new URL('../services/rubricEvaluator.js', import.meta.url), 'utf8');
  const projectionSource = readFileSync(new URL('../services/transcriptProjection.js', import.meta.url), 'utf8');

  assert.match(rubricSource, /from '\.\/dialogueTranscriptProjection\.js'/);
  assert.doesNotMatch(rubricSource, /function buildDialogueFullTranscript\(/);
  assert.match(projectionSource, /from '\.\/dialogueTranscriptProjection\.js'/);
  assert.doesNotMatch(projectionSource, /from '\.\/rubricEvaluator\.js'/);
});
