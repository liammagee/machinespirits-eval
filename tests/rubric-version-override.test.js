/**
 * Tests for rubric version overrides.
 *
 * Guarantees that --rubric-version correctly routes each evaluator to the
 * versioned rubric:
 *   1. Prompt example JSON uses the correct dimension keys (not hardcoded)
 *   2. calculateOverallScore matches the active rubric's weights/keys
 *   3. Learner prompt uses the correct dimension keys
 *   4. Overrides are isolated (set → clear round-trip)
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import yaml from 'yaml';

import {
  setRubricPathOverride,
  clearRubricPathOverride,
  getRubricDimensions,
  loadRubric,
} from '../services/evalConfigLoader.js';

import {
  buildEvaluationPrompt,
  calculateOverallScore,
} from '../services/rubricEvaluator.js';

import {
  setLearnerRubricPathOverride,
  clearLearnerRubricPathOverride,
  buildLearnerEvaluationPrompt,
  loadLearnerRubric,
} from '../services/learnerRubricEvaluator.js';

const RUBRICS_DIR = path.resolve(import.meta.dirname, '..', 'config', 'rubrics');

// Discover available rubric versions on disk
const availableVersions = fs.readdirSync(RUBRICS_DIR)
  .filter((d) => d.startsWith('v') && fs.statSync(path.join(RUBRICS_DIR, d)).isDirectory())
  .map((d) => d.slice(1)); // strip 'v' prefix

// Load expected dimension keys directly from each version's YAML
function loadExpectedDimKeys(version, rubricFile = 'evaluation-rubric.yaml') {
  const filePath = path.join(RUBRICS_DIR, `v${version}`, rubricFile);
  const data = yaml.parse(fs.readFileSync(filePath, 'utf-8'));
  return Object.keys(data.dimensions || {});
}

// Helper: build a minimal prompt for testing
function buildTestPrompt() {
  return buildEvaluationPrompt(
    { type: 'review', title: 'Test', message: 'Test message' },
    { name: 'Test Scenario', description: 'Test', expectedBehavior: 'Test' },
    {},
  );
}

// Helper: extract dimension keys from the JSON example in a prompt
function extractPromptDimKeys(prompt) {
  return [...prompt.matchAll(/"(\w+)": \{"score": \d/g)].map((m) => m[1]);
}

// Helper: build scores object matching a rubric's dimensions
function makeScoresForVersion(version, score = 4) {
  const keys = loadExpectedDimKeys(version);
  const scores = {};
  for (const key of keys) {
    scores[key] = { score, reasoning: 'test' };
  }
  return scores;
}

afterEach(() => {
  clearRubricPathOverride();
  clearLearnerRubricPathOverride();
});

// ============================================================================
// Tutor per-turn prompt: dimension keys match the active rubric
// ============================================================================
describe('Tutor per-turn prompt dimension keys', () => {
  for (const ver of availableVersions) {
    it(`v${ver}: prompt example JSON uses v${ver} dimension keys`, () => {
      setRubricPathOverride(path.join(RUBRICS_DIR, `v${ver}`, 'evaluation-rubric.yaml'));

      const prompt = buildTestPrompt();
      const promptKeys = extractPromptDimKeys(prompt);
      const expected = loadExpectedDimKeys(ver);

      assert.deepStrictEqual(
        promptKeys,
        expected,
        `v${ver} prompt keys should match rubric YAML dimensions`,
      );
    });
  }

  it('prompt keys change when override switches from one version to another', () => {
    // Ensure we're testing at least 2 versions
    if (availableVersions.length < 2) return;

    const [verA, verB] = availableVersions;
    const keysA = loadExpectedDimKeys(verA);
    const keysB = loadExpectedDimKeys(verB);

    setRubricPathOverride(path.join(RUBRICS_DIR, `v${verA}`, 'evaluation-rubric.yaml'));
    const promptKeysA = extractPromptDimKeys(buildTestPrompt());

    setRubricPathOverride(path.join(RUBRICS_DIR, `v${verB}`, 'evaluation-rubric.yaml'));
    const promptKeysB = extractPromptDimKeys(buildTestPrompt());

    assert.deepStrictEqual(promptKeysA, keysA);
    assert.deepStrictEqual(promptKeysB, keysB);
  });
});

// ============================================================================
// calculateOverallScore: uses active rubric's weights
// ============================================================================
describe('calculateOverallScore with rubric overrides', () => {
  for (const ver of availableVersions) {
    it(`v${ver}: returns >0 when scores match v${ver} dimension keys`, () => {
      setRubricPathOverride(path.join(RUBRICS_DIR, `v${ver}`, 'evaluation-rubric.yaml'));

      const scores = makeScoresForVersion(ver, 4);
      const result = calculateOverallScore(scores);

      assert.ok(result > 0, `v${ver} overall score should be > 0, got ${result}`);
    });

    it(`v${ver}: all-5s gives 100`, () => {
      setRubricPathOverride(path.join(RUBRICS_DIR, `v${ver}`, 'evaluation-rubric.yaml'));

      const scores = makeScoresForVersion(ver, 5);
      const result = calculateOverallScore(scores);

      assert.ok(
        Math.abs(result - 100) < 1,
        `v${ver} all-5s should give ~100, got ${result}`,
      );
    });

    it(`v${ver}: mismatched keys give 0`, () => {
      setRubricPathOverride(path.join(RUBRICS_DIR, `v${ver}`, 'evaluation-rubric.yaml'));

      // Use completely wrong keys
      const scores = { bogus_dim_1: { score: 5, reasoning: 'test' }, bogus_dim_2: { score: 5, reasoning: 'test' } };
      const result = calculateOverallScore(scores);

      assert.strictEqual(result, 0, `v${ver} mismatched keys should give 0`);
    });
  }
});

// ============================================================================
// Learner rubric: prompt uses correct dimension keys per version
// ============================================================================
describe('Learner prompt dimension keys', () => {
  for (const ver of availableVersions) {
    const learnerPath = path.join(RUBRICS_DIR, `v${ver}`, 'evaluation-rubric-learner.yaml');
    if (!fs.existsSync(learnerPath)) continue;

    it(`v${ver}: learner prompt uses v${ver} dimension keys`, () => {
      setLearnerRubricPathOverride(learnerPath);

      const rubric = loadLearnerRubric({ forceReload: true });
      const expectedKeys = Object.keys(rubric.dimensions || {});

      const prompt = buildLearnerEvaluationPrompt({
        turns: [
          { role: 'tutor', message: 'Hello student' },
          { role: 'learner', message: 'Test learner message' },
        ],
        targetTurnIndex: 1,
        personaId: 'test',
        personaDescription: 'Test persona',
        learnerArchitecture: 'unified',
        scenarioName: 'Test',
        topic: 'Test topic',
      });

      const promptKeys = [...prompt.matchAll(/"(\w+)": \{"score": \d/g)].map((m) => m[1]);

      assert.deepStrictEqual(
        promptKeys,
        expectedKeys,
        `v${ver} learner prompt keys should match learner rubric YAML`,
      );
    });
  }
});

// ============================================================================
// Override isolation: clearing restores defaults
// ============================================================================
describe('Override isolation', () => {
  it('clearRubricPathOverride restores default rubric', () => {
    const defaultDims = getRubricDimensions();
    const defaultKeys = Object.keys(defaultDims);

    // Set override to a different version
    const lastVer = availableVersions[availableVersions.length - 1];
    setRubricPathOverride(path.join(RUBRICS_DIR, `v${lastVer}`, 'evaluation-rubric.yaml'));

    // Clear override
    clearRubricPathOverride();

    const restoredDims = getRubricDimensions({ forceReload: true });
    const restoredKeys = Object.keys(restoredDims);

    assert.deepStrictEqual(restoredKeys, defaultKeys, 'clearing override should restore default dimensions');
  });

  it('version field in loaded rubric matches the override', () => {
    for (const ver of availableVersions) {
      setRubricPathOverride(path.join(RUBRICS_DIR, `v${ver}`, 'evaluation-rubric.yaml'));

      const rubric = loadRubric({ forceReload: true });
      assert.strictEqual(rubric.version, ver, `loaded rubric version should be ${ver}`);
    }
  });
});
