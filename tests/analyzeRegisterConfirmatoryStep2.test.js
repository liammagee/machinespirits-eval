import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  bootstrapFamily,
  summarizeQaFamily,
} from '../scripts/analyze-register-confirmatory-step2.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROFILES = ['diligent', 'affective_resistant', 'false_memory', 'proof_skipper'];
const POLICIES = ['bland', 'field', 'negative'];

function syntheticRows() {
  const values = {
    diligent: { bland: 0.8, field: 0.2, negative: 0.3 },
    affective_resistant: { bland: 0.2, field: 0.8, negative: 0.1 },
    false_memory: { bland: 0.3, field: 0.7, negative: 0.2 },
    proof_skipper: { bland: 0.4, field: 0.6, negative: 0.1 },
  };
  return PROFILES.flatMap((profile) =>
    POLICIES.flatMap((policy) =>
      [1, 2, 3, 4, 5].map((runIndex) => ({
        profile,
        policy,
        runIndex,
        sourceLeg: 'fixture',
        primaryOnly: false,
        primaryEndpoint: {
          complete: true,
          coverage: values[profile][policy],
          grounded: false,
          hardSafetyPassed: true,
          safetyEvidenceComplete: true,
          leakCount: 0,
        },
        secondaryEndpoint: {
          available: true,
          groundedClosure: false,
          turnCount: 20,
        },
      })),
    ),
  );
}

test('frozen selection declares exactly 60 unique rows per family and four primary-only top-ups', () => {
  const selection = JSON.parse(
    fs.readFileSync(
      path.join(
        ROOT,
        'config/adaptive-tutor-evidence/tutor-stub-register-confirmatory-final-selection.json',
      ),
      'utf8',
    ),
  );
  for (const [familyId, family] of Object.entries(selection.families)) {
    const ids = family.sources.flatMap((source) =>
      source.keys.map((key) => `${source.profile}/${key}`),
    );
    assert.equal(ids.length, 60, familyId);
    assert.equal(new Set(ids).size, 60, familyId);
  }
  const topups = selection.families.sonnet.sources.filter((source) => source.primaryOnly);
  assert.equal(topups.length, 1);
  assert.deepEqual(topups[0].keys, ['negative-r4', 'bland-r5', 'field-r5', 'negative-r5']);
});

test('bootstrap is byte-deterministic under the frozen seed and detects a crossing', () => {
  const rows = syntheticRows();
  const settings = { bootstrapDraws: 500, bootstrapSeed: 20260713 };
  const first = bootstrapFamily(rows, settings);
  const second = bootstrapFamily(rows, settings);
  assert.deepEqual(first, second);
  assert.equal(first.cellMeans.diligent.bland, 0.8);
  assert.equal(first.cellMeans.affective_resistant.field, 0.8);
  assert.equal(first.crossingProbability, 1);
  assert.equal(first.interactionsVsDiligent.affective_resistant.field.supported, true);
});

test('final QA summary separates primary completeness from secondary availability', () => {
  const rows = syntheticRows();
  rows[0].primaryOnly = true;
  rows[0].secondaryEndpoint = {
    available: false,
    groundedClosure: null,
    turnCount: null,
  };
  const qa = summarizeQaFamily('fixture', rows, { confirmation: false });
  assert.equal(qa.selectedRows, 60);
  assert.equal(qa.primaryCompleteRows, 60);
  assert.equal(qa.secondaryAvailableRows, 59);
  assert.equal(qa.primaryOnlyRows, 1);
});

test('tracked compact artifacts lock the 24 means, frozen gates, and affective lineage', () => {
  const bootstrap = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'exports/register-confirmatory-evidence/final/interaction-bootstrap.json'),
      'utf8',
    ),
  );
  assert.deepEqual(bootstrap.families.terra.bootstrap.cellMeans, {
    diligent: { bland: 0.5, field: 0.467, negative: 0.667 },
    affective_resistant: { bland: 0.533, field: 0.567, negative: 0.366 },
    false_memory: { bland: 0.4, field: 0.433, negative: 0.467 },
    proof_skipper: { bland: 0.433, field: 0.366, negative: 0.533 },
  });
  assert.deepEqual(bootstrap.families.sonnet.bootstrap.cellMeans, {
    diligent: { bland: 0.367, field: 0.467, negative: 0.167 },
    affective_resistant: { bland: 0.233, field: 0.233, negative: 0.1 },
    false_memory: { bland: 0.133, field: 0.2, negative: 0.233 },
    proof_skipper: { bland: 0.2, field: 0.2, negative: 0.167 },
  });
  assert.equal(bootstrap.families.terra.verdict.confirmation, false);
  assert.equal(bootstrap.families.sonnet.verdict.confirmation, false);

  const discrimination = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'exports/register-confirmatory-evidence/final/profile-discrimination.json'),
      'utf8',
    ),
  );
  assert.deepEqual(discrimination.families.terra.frozenCosineGate, {
    averagePairwiseCosine: 0.812,
    targetAveragePairwiseCosine: 0.85,
    averagePass: true,
    maxSimilarityToControl: 0.912,
    targetMaxSimilarityToControl: 0.9,
    controlPass: false,
    pass: false,
  });
  assert.equal(discrimination.families.sonnet.frozenCosineGate.pass, true);

  const lineage = JSON.parse(
    fs.readFileSync(
      path.join(
        ROOT,
        'exports/register-confirmatory-evidence/sonnet5-n5-block-b/affective-lineage.json',
      ),
      'utf8',
    ),
  );
  assert.equal(lineage.selectedRows, 15);
  assert.equal(lineage.primaryCompleteRows, 15);
  assert.equal(lineage.secondaryAvailableRows, 11);
  assert.equal(lineage.primaryOnlyRows, 4);
});
