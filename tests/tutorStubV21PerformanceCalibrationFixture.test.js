import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_PATH = path.join(
  ROOT,
  'tests',
  'fixtures',
  'tutor-stub-performance-calibration',
  'gazette-answer-seeking-v21.json',
);

function readFixture() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

test('V21 Gazette calibration fixture preserves provenance, public prefixes, and selected contracts', () => {
  const fixture = readFixture();

  assert.equal(fixture.schema, 'machinespirits.tutor-stub.performance-calibration.v1');
  assert.equal(fixture.campaign, 'first-draft-generalization-v21');
  assert.equal(fixture.run.id, '2026-07-16T08-35-26-101Z');
  assert.equal(fixture.run.worldId, 'world_027_gazette_recall');
  assert.equal(fixture.run.learnerProfile, 'answer_seeking');

  for (const artifact of Object.values(fixture.sourceArtifacts)) {
    assert.equal(path.isAbsolute(artifact.path), true);
    assert.match(artifact.sha256, /^[a-f0-9]{64}$/u);
  }

  assert.equal(fixture.publicTranscript.exchanges.length, 6);
  assert.deepEqual(
    fixture.publicTranscript.exchanges.map((exchange) => exchange.turn),
    [1, 2, 3, 4, 5, 6],
  );

  for (const calibrationCase of fixture.cases) {
    assert.equal(calibrationCase.id, `${fixture.run.id}:t${String(calibrationCase.turn).padStart(3, '0')}`);
    assert.equal(calibrationCase.publicPrefixThroughTurn, calibrationCase.turn - 1);
    assert.equal(
      fixture.publicTranscript.exchanges.slice(0, calibrationCase.publicPrefixThroughTurn).at(-1)?.turn,
      calibrationCase.turn - 1,
    );
    assert.ok(calibrationCase.learnerMessage.length > 0);
    assert.ok(calibrationCase.originalCandidate.length > 0);
    assert.equal(calibrationCase.selectedConfiguration.performance_tactic, 'dramatic_counterpressure');
    assert.equal(calibrationCase.selectedConfiguration.engagement_stance, 'charismatic');
    assert.equal(calibrationCase.recordedAudit.safetyOk, true);
    assert.equal(calibrationCase.recordedAudit.actorialRealizationOk, false);
    assert.deepEqual(
      calibrationCase.recordedAudit.issues.map((issue) => issue.type),
      ['missing_selected_performance_tactic'],
    );
  }
});

test('V21 Gazette calibration labels separate a structural false negative from a genuine miss', () => {
  const fixture = readFixture();
  const falseNegative = fixture.cases.find((row) => row.turn === 4);
  const genuineMiss = fixture.cases.find((row) => row.turn === 7);

  assert.ok(falseNegative);
  assert.equal(falseNegative.calibration.expectedLabel, 'semantic_realization_structural_false_negative');
  assert.equal(falseNegative.calibration.expectedPerformanceRealized, true);
  assert.deepEqual(falseNegative.calibration.missingComponents, []);
  for (const span of Object.values(falseNegative.calibration.componentEvidence)) {
    assert.ok(falseNegative.originalCandidate.includes(span), `missing embedded turn-4 evidence span: ${span}`);
  }

  assert.ok(genuineMiss);
  assert.equal(genuineMiss.calibration.expectedLabel, 'genuine_performance_miss');
  assert.equal(genuineMiss.calibration.expectedPerformanceRealized, false);
  assert.deepEqual(genuineMiss.calibration.missingComponents, [
    'contrary_evidence_applied_to_pressure',
    'performed_counterpressure',
  ]);
  assert.equal(genuineMiss.calibration.componentEvidence.contrary_evidence, null);
  assert.equal(genuineMiss.calibration.componentEvidence.dramatic_action, null);
  assert.ok(genuineMiss.originalCandidate.includes(genuineMiss.calibration.componentEvidence.public_pressure_target));
  assert.ok(genuineMiss.originalCandidate.includes(genuineMiss.calibration.componentEvidence.learner_handoff));
  assert.equal(genuineMiss.deliveredRecovery.kind, 'plain_recovery_candidate');
});
