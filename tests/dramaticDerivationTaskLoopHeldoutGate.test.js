import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  evaluateTaskLoopHeldoutArtifact,
  evaluateTaskLoopHeldoutGate,
  renderTaskLoopHeldoutGateMarkdown,
} from '../services/dramaticDerivation/taskLoopHeldoutGate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_FILE = path.join(ROOT, 'tests/fixtures/taskloop-heldout-artifacts.json');

function loadArtifacts() {
  return JSON.parse(fs.readFileSync(FIXTURE_FILE, 'utf8')).artifacts;
}

function sourceExists(sourceArtifact) {
  return fs.existsSync(path.resolve(ROOT, sourceArtifact));
}

test('held-out task-loop gate beats fixed progression while preserving proof-control fingerprints', () => {
  const report = evaluateTaskLoopHeldoutGate(loadArtifacts(), { sourceExists });

  assert.equal(report.summary.count, 12);
  assert.equal(report.summary.adaptiveFail, 0);
  assert.equal(report.summary.fixedPass, 2);
  assert.equal(report.summary.publicOnlyFail, 0);
  assert.equal(report.summary.proofControlChanged, 0);
  assert.equal(report.summary.allPassed, true);
  assert.ok(report.summary.improvement >= 0.25);
});

test('held-out gate fails closed on hidden proof inputs', () => {
  const artifacts = loadArtifacts();
  const leaky = structuredClone(artifacts[0]);
  leaky.input.hiddenBoard = [['private']];

  const row = evaluateTaskLoopHeldoutArtifact(leaky, { sourceExists });
  assert.equal(row.publicOnlyOk, false);
  assert.equal(row.passed, false);
});

test('held-out gate fails closed on proof-control drift', () => {
  const artifacts = loadArtifacts();
  const drift = structuredClone(artifacts[1]);
  drift.adaptiveProofControlFingerprint.releaseSignature = 'changed-release-signature';

  const row = evaluateTaskLoopHeldoutArtifact(drift, { sourceExists });
  assert.equal(row.proofControlUnchanged, false);
  assert.equal(row.passed, false);
});

test('held-out gate requires held-out provenance and existing source artifacts', () => {
  const artifacts = loadArtifacts();
  const missing = structuredClone(artifacts[2]);
  missing.sourceArtifact = 'exports/dramatic-derivation/missing-heldout-artifact.json';

  const row = evaluateTaskLoopHeldoutArtifact(missing, { sourceExists });
  assert.equal(row.sourceArtifactOk, true);
  assert.equal(row.sourceExistsOk, false);
  assert.equal(row.passed, false);
});

test('held-out report states the boundary', () => {
  const report = evaluateTaskLoopHeldoutGate(loadArtifacts(), { sourceExists });
  const markdown = renderTaskLoopHeldoutGateMarkdown(report);

  assert.match(markdown, /held-out task-selection evidence/u);
  assert.match(markdown, /not proof-control adaptation/u);
  assert.match(markdown, /never passed into the task\/session selector/u);
});
