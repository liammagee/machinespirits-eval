import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  applyTutorStubLearnerAdvanceAssessment,
  buildTutorStubFailedClassification,
  floorTutorStubClassifierScore,
  isTutorStubUnanalyzedClassification,
  TUTOR_STUB_UNANALYZED_CLASSIFICATION_SCHEMA,
} from '../services/tutorStubLearnerClassification.js';
import { readTutorStubApplicationSource } from './helpers/tutorStubSourceContract.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('failed classification is a typed no-signal marker with supplied technical metadata', () => {
  const usage = { inputTokens: 12, outputTokens: 3, totalTokens: 15, cost: 0.001 };
  assert.deepEqual(
    buildTutorStubFailedClassification({
      code: 'provider_unavailable',
      resolved: { provider: 'codex', model: 'gpt-5.6-sol' },
      latencyMs: 41,
      usage,
    }),
    {
      schema: TUTOR_STUB_UNANALYZED_CLASSIFICATION_SCHEMA,
      analysis_status: 'unanalyzed',
      signal: { state: 'none' },
      failure_code: 'provider_unavailable',
      provider: 'codex',
      model: 'gpt-5.6-sol',
      latencyMs: 41,
      usage,
    },
  );
});

test('failed classification preserves null route metadata and fresh zero-usage defaults', () => {
  const first = buildTutorStubFailedClassification({ code: 'first' });
  const second = buildTutorStubFailedClassification({ code: 'second' });

  assert.deepEqual(first.usage, { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 });
  assert.equal(first.provider, null);
  assert.equal(first.model, null);
  assert.equal(first.latencyMs, 0);
  assert.notEqual(first.usage, second.usage);
  assert.notEqual(first.signal, second.signal);
  assert.equal(isTutorStubUnanalyzedClassification(first), true);
  assert.equal(JSON.stringify(first).includes('Classifier failed before the tutor turn.'), false);
});

test('the CLI imports rather than redeclares failed-classification construction', () => {
  const cliSource = readTutorStubApplicationSource();
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubLearnerClassification.js'), 'utf8');

  assert.match(cliSource, /buildTutorStubFailedClassification as failedClassification/u);
  assert.doesNotMatch(cliSource, /function failedClassification/u);
  assert.doesNotMatch(serviceSource, /^import\s/mu);
  assert.doesNotMatch(serviceSource, /\b(?:fs|console|process|fetch|Date\.now)\s*[.(]/u);
});

test('classifier score flooring preserves sufficient scores and upgrades missing or low envelopes', () => {
  const scoreValue = (score) => (score && typeof score === 'object' ? score.score : score);
  const high = { score: 5, reason: 'original' };

  assert.equal(floorTutorStubClassifierScore(high, 4, 'replacement', { scoreValue }), high);
  assert.deepEqual(floorTutorStubClassifierScore({ score: 2, detail: 'keep' }, 4, 'advance', { scoreValue }), {
    score: 4,
    detail: 'keep',
    reason: 'advance',
  });
  assert.deepEqual(floorTutorStubClassifierScore(null, 4, 'advance', { scoreValue }), {
    score: 4,
    reason: 'advance',
  });
});

test('learner advance assessment preserves no-op paths and maps accelerated proof movement', () => {
  const scoreValue = (score) => (score && typeof score === 'object' ? score.score : score);
  const unchanged = { turn: { evidence_use: 'none' } };
  assert.equal(applyTutorStubLearnerAdvanceAssessment(unchanged, null, { scoreValue }), unchanged);

  const classification = {
    turn: {
      evidence_use: 'repeats_setup',
      agency: 'attempting',
      scores: { conceptual_engagement: { score: 5, reason: 'already high' }, epistemic_readiness: 2 },
    },
  };
  const advance = {
    accelerated: true,
    multiStep: true,
    derivedFactCount: 2,
    supportedMoveCount: 3,
  };
  const result = applyTutorStubLearnerAdvanceAssessment(
    classification,
    { model: { learnerAdvance: advance } },
    {
      scoreValue,
    },
  );

  assert.equal(result, classification);
  assert.equal(result.turn.learner_advance, advance);
  assert.equal(result.turn.learning_pace, 'accelerating');
  assert.equal(result.turn.reasoning_span, 'multi_step');
  assert.equal(result.turn.discourse_move, 'inference');
  assert.equal(result.turn.evidence_use, 'links_evidence_to_rule');
  assert.equal(result.turn.agency, 'steering');
  assert.deepEqual(result.turn.scores.conceptual_engagement, { score: 5, reason: 'already high' });
  assert.deepEqual(result.turn.scores.epistemic_readiness, {
    score: 4,
    reason: 'Accepted 3 learner-owned public proof moves in one turn.',
  });
});

test('non-accelerated and evidence-adoption advances preserve their exact branch behavior', () => {
  const scoreValue = (score) => (score && typeof score === 'object' ? score.score : score);
  const held = { turn: { evidence_use: 'none' } };
  const nonAccelerated = { accelerated: false };
  applyTutorStubLearnerAdvanceAssessment(held, { advance: nonAccelerated }, { scoreValue });
  assert.equal(held.turn.learner_advance, nonAccelerated);
  assert.equal(held.turn.learning_pace, undefined);

  const adopted = { turn: { evidence_use: 'none', agency: 'resistant' } };
  applyTutorStubLearnerAdvanceAssessment(
    adopted,
    { advance: { accelerated: true, multiStep: false, derivedFactCount: 0, supportedMoveCount: 2 } },
    { scoreValue },
  );
  assert.equal(adopted.turn.reasoning_span, 'multi_premise');
  assert.equal(adopted.turn.discourse_move, 'evidence_adoption');
  assert.equal(adopted.turn.evidence_use, 'cites_public_evidence');
  assert.equal(adopted.turn.agency, 'resistant');
});
