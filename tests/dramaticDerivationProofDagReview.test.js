import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { ruleFirings } from '../services/dramaticDerivation/chainer.js';
import {
  buildProofDagReviewArtifacts,
  compareProofDagReviewSubmissions,
  createProofDagReviewSubmissionTemplate,
  validateProofDagReviewSubmission,
} from '../services/dramaticDerivation/proofDagReview.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = path.join(ROOT, 'config/proof-dag-validation/cross-world-v1.yaml');

function loadArtifacts() {
  const spec = yaml.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
  const loadedWorlds = spec.worlds.map((selection) => loadWorld(path.join(ROOT, selection.source)));
  return buildProofDagReviewArtifacts({ spec, loadedWorlds });
}

function caseById(rows) {
  return new Map(rows.map((row) => [row.case_id, row]));
}

function filledSubmission(packet, machineKey, reviewerId) {
  const submission = createProofDagReviewSubmissionTemplate(packet);
  submission.reviewer_id = reviewerId;
  const machineById = caseById(machineKey.cases);
  for (const row of submission.cases) {
    const machine = machineById.get(row.case_id);
    for (const field of [
      'available_premise_ids',
      'enabled_rule_ids',
      'licensed_candidate_ids',
      'forbidden_candidate_ids',
    ]) {
      row[field] = [...machine[field]];
    }
  }
  return submission;
}

test('cross-world packet is small, outcome-blind, and spans three distinct authored domains', () => {
  const { packet } = loadArtifacts();
  assert.equal(packet.worlds.length, 3);
  assert.equal(
    packet.worlds.reduce((total, world) => total + world.cases.length, 0),
    6,
  );
  assert.equal(new Set(packet.worlds.map((world) => world.discipline)).size, 3);
  assert.deepEqual(
    packet.worlds.map((world) => world.world_id),
    ['world_030_rowan_flat', 'world_016_ai_syllabus_af1', 'world_001_nocturne'],
  );

  const forbiddenStructuralKeys = new Set([
    'secret',
    'mirror',
    'expected',
    'machine_key',
    'licensed_candidate_ids',
    'forbidden_candidate_ids',
    'enabled_rule_ids',
  ]);
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!forbiddenStructuralKeys.has(key), `review packet leaked answer-bearing key ${key}`);
      visit(child);
    }
  };
  visit(packet);
  assert.deepEqual(packet.blinding.excludes, [
    'tutor outputs',
    'learner outputs',
    'downstream outcomes',
    'machine rulings',
  ]);
});

test('machine rulings reproduce early, intermediate, and licensed release cuts', () => {
  const { machineKey } = loadArtifacts();
  const cases = caseById(machineKey.cases);

  assert.deepEqual(cases.get('case_01').available_premise_ids, ['p_shower']);
  assert.deepEqual(cases.get('case_01').enabled_rule_ids, []);
  assert.deepEqual(cases.get('case_01').licensed_candidate_ids, []);
  assert.deepEqual(cases.get('case_01').forbidden_candidate_ids, ['candidate_1', 'candidate_2']);

  assert.deepEqual(cases.get('case_02').enabled_rule_ids, ['R1_mapping', 'R2_baseline']);
  assert.deepEqual(cases.get('case_02').licensed_candidate_ids, []);
  assert.deepEqual(cases.get('case_05').enabled_rule_ids, ['R1_mapping', 'R2_baseline', 'R3_decision', 'R4_choice']);
  assert.deepEqual(cases.get('case_05').licensed_candidate_ids, ['candidate_2']);
  assert.deepEqual(cases.get('case_05').forbidden_candidate_ids, ['candidate_1']);

  assert.deepEqual(cases.get('case_03').enabled_rule_ids, ['R1_watermark_dating', 'R2_presence']);
  assert.deepEqual(cases.get('case_03').licensed_candidate_ids, []);
  assert.deepEqual(cases.get('case_06').enabled_rule_ids, [
    'R1_watermark_dating',
    'R2_presence',
    'R2a_ledger_presence',
    'R3_source_access',
    'R4_attribution',
  ]);
  assert.deepEqual(cases.get('case_06').licensed_candidate_ids, ['candidate_1']);
  assert.deepEqual(cases.get('case_06').forbidden_candidate_ids, ['candidate_2']);
});

test('rule firing introspection keeps alternate enabled paths even when their conclusion already exists', () => {
  const firings = ruleFirings(
    [
      ['seed', 'a'],
      ['seed', 'b'],
    ],
    [
      { id: 'R_a', if: [['seed', 'a']], then: [['shared', 'result']] },
      { id: 'R_b', if: [['seed', 'b']], then: [['shared', 'result']] },
    ],
  );
  assert.deepEqual(
    firings.map((row) => row.rule),
    ['R_a', 'R_b'],
  );
});

test('two complete independent submissions compare only after both are validated', () => {
  const { packet, machineKey } = loadArtifacts();
  const reviewerA = filledSubmission(packet, machineKey, 'reviewer_a');
  const reviewerB = filledSubmission(packet, machineKey, 'reviewer_b');
  assert.equal(validateProofDagReviewSubmission(packet, reviewerA), reviewerA);

  const report = compareProofDagReviewSubmissions({ packet, machineKey, submissions: [reviewerA, reviewerB] });
  assert.deepEqual(report.reviewer_ids, ['reviewer_a', 'reviewer_b']);
  assert.deepEqual(report.summary, {
    total_cases: 6,
    determinate_cases: 6,
    indeterminate_cases: 0,
    all_determinate_dimensions_match_machine: true,
  });
});

test('reviewer disagreement remains indeterminate instead of becoming a negative ruling', () => {
  const { packet, machineKey } = loadArtifacts();
  const reviewerA = filledSubmission(packet, machineKey, 'reviewer_a');
  const reviewerB = filledSubmission(packet, machineKey, 'reviewer_b');
  reviewerB.cases.find((row) => row.case_id === 'case_01').enabled_rule_ids = ['R3_shower'];

  const report = compareProofDagReviewSubmissions({ packet, machineKey, submissions: [reviewerA, reviewerB] });
  const disputed = report.cases.find((row) => row.case_id === 'case_01');
  assert.equal(disputed.status, 'indeterminate');
  assert.equal(disputed.dimensions.enabled_rule_ids.status, 'indeterminate');
  assert.equal(report.summary.indeterminate_cases, 1);
});

test('an explicit reviewer uncertainty remains indeterminate even when entered arrays agree', () => {
  const { packet, machineKey } = loadArtifacts();
  const reviewerA = filledSubmission(packet, machineKey, 'reviewer_a');
  const reviewerB = filledSubmission(packet, machineKey, 'reviewer_b');
  const uncertain = reviewerB.cases.find((row) => row.case_id === 'case_03');
  uncertain.disposition = 'indeterminate';
  uncertain.indeterminate_fields = ['licensed_candidate_ids'];
  uncertain.notes = 'The ordinary-language rule appears semantically under-specified.';

  const report = compareProofDagReviewSubmissions({ packet, machineKey, submissions: [reviewerA, reviewerB] });
  const disputed = report.cases.find((row) => row.case_id === 'case_03');
  assert.equal(disputed.status, 'indeterminate');
  assert.deepEqual(disputed.dimensions.licensed_candidate_ids.indeterminate_by, ['reviewer_b']);
  assert.equal(
    disputed.reviewer_rulings.reviewer_b.notes,
    'The ordinary-language rule appears semantically under-specified.',
  );
});
