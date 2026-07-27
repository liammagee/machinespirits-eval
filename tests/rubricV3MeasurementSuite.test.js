import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import yaml from 'yaml';

import { EPOCHS, getEpochFilter } from '../services/epochFilter.js';
import { clearRubricPathOverride, setRubricPathOverride } from '../services/evalConfigLoader.js';
import { buildEvaluationPrompt, calculateOverallScore } from '../services/rubricEvaluator.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const RUBRIC_DIR = path.join(ROOT, 'config', 'rubrics', 'v3.0');
const RUBRIC_FILES = [
  'evaluation-rubric.yaml',
  'evaluation-rubric-learner.yaml',
  'evaluation-rubric-tutor-holistic.yaml',
  'evaluation-rubric-dialogue.yaml',
  'evaluation-rubric-deliberation.yaml',
];

function load(file) {
  return yaml.parse(fs.readFileSync(path.join(RUBRIC_DIR, file), 'utf8'));
}

test('v3.0 is a complete opt-in measurement suite while active rubrics remain v2.2', () => {
  for (const file of RUBRIC_FILES) {
    const rubric = load(file);
    assert.equal(rubric.version, '3.0', file);
    assert.equal(rubric.status, 'calibration', file);
    const totalWeight = Object.values(rubric.dimensions).reduce((sum, dimension) => sum + dimension.weight, 0);
    assert.ok(Math.abs(totalWeight - 1) < 1e-9, `${file} weights sum to ${totalWeight}`);
    for (const [key, dimension] of Object.entries(rubric.dimensions)) {
      const scale = dimension.scale || rubric.scale;
      assert.ok(scale.min < scale.max, `${file}:${key} has a valid scale`);
      assert.ok(dimension.criteria?.[scale.min], `${file}:${key} anchors its minimum`);
      assert.ok(dimension.criteria?.[scale.max], `${file}:${key} anchors its maximum`);
    }
  }

  for (const file of RUBRIC_FILES) {
    const active = yaml.parse(fs.readFileSync(path.join(ROOT, 'config', file), 'utf8'));
    assert.equal(active.version, '2.2', `${file} must remain active v2.2`);
  }
});

test('measurement manifest separates evidence levels and resolves every rubric', () => {
  const suite = load('measurement-suite.yaml');
  assert.equal(suite.version, '3.0');
  assert.equal(suite.active_by_default, false);
  assert.equal(suite.reliability_layer.minimum_design.distinct_candidate_generators, 2);
  assert.equal(suite.reliability_layer.minimum_design.distinct_judges, 2);
  assert.equal(suite.calibration_gates.enforcement, 'report_only');
  assert.deepEqual(
    suite.reliability_layer.preferred_local_models.judges.map(({ provider, model, reasoning_effort }) => ({
      provider,
      model,
      reasoning_effort,
    })),
    [
      { provider: 'codex', model: 'gpt-5.6-terra', reasoning_effort: 'medium' },
      { provider: 'claude-code', model: 'claude-sonnet-5', reasoning_effort: 'medium' },
    ],
  );

  const evidenceLevels = new Set();
  for (const instrument of Object.values(suite.instruments)) {
    assert.ok(instrument.evidence);
    assert.ok(instrument.measures);
    evidenceLevels.add(instrument.evidence);
    assert.ok(fs.existsSync(path.resolve(RUBRIC_DIR, instrument.rubric)), instrument.rubric);
  }
  assert.ok(evidenceLevels.size >= 4, 'suite must preserve distinct evidence levels');
});

test('v3 tutor prompt and score support the mixed 1-10 and 1-5 scales', (t) => {
  t.after(clearRubricPathOverride);
  setRubricPathOverride(path.join(RUBRIC_DIR, 'evaluation-rubric.yaml'));
  const prompt = buildEvaluationPrompt(
    { message: 'Let us test that relation with your example.' },
    { name: 'Test', description: 'Test', expectedBehavior: 'Respond', requiredElements: [], forbiddenElements: [] },
    {},
  );
  assert.match(prompt, /Overall Pedagogical Quality\*\* \(scale: 1-10/u);
  assert.match(prompt, /Content Accuracy\*\* \(scale: 1-5/u);
  assert.match(prompt, /Use each dimension's declared scale/u);
  assert.match(prompt, /score=null and not_applicable=true/u);
  assert.match(prompt, /"content_accuracy": \{"score": 3, "not_applicable": false/u);
  assert.equal(
    calculateOverallScore({ overall_pedagogical_quality: { score: 10 }, content_accuracy: { score: 1 } }),
    85,
  );
  assert.ok(
    Math.abs(
      calculateOverallScore({
        overall_pedagogical_quality: { score: 7 },
        content_accuracy: { score: null, not_applicable: true },
      }) -
        200 / 3,
    ) < 1e-9,
  );
});

test('v3.0 has an exact rubric-version database epoch', () => {
  assert.deepEqual(EPOCHS['3.0'].rubricVersions, ['3.0']);
  assert.equal(getEpochFilter('3.0').where, "tutor_rubric_version = '3.0'");
});
