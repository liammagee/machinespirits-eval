import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  analyzeArtifact,
  buildAudit,
  parseArgs,
  renderMarkdown,
  writeReports,
} from '../scripts/audit-derivation-ownership-replay-candidates.js';

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function result(overrides = {}) {
  return {
    verdict: 'grounded_anagnorisis',
    turnsPlayed: 12,
    firstForcedTurn: 11,
    assertedGroundedTurn: 12,
    trajectory: [{ turn: 12, D: 0 }],
    ...overrides,
  };
}

function diagnosis(overrides = {}) {
  return {
    label: 'world015-ownership-r1',
    worldId: 'world_015_hethel_public_reversal',
    ownershipProof: true,
    ownershipTransferGate: false,
    ...overrides,
  };
}

function finalPost(overrides = {}) {
  return {
    status: 'partial_ownership',
    complete: false,
    finalAssertionAvailable: true,
    missingFamilies: ['near_transfer'],
    inputAuditOk: true,
    nonLeakAuditOk: true,
    turn: 12,
    ...overrides,
  };
}

function writeArtifact(root, relDir, { resultValue = result(), diagnosisValue = diagnosis() } = {}) {
  const dir = path.join(root, relDir);
  writeJson(path.join(dir, 'result.json'), resultValue);
  if (diagnosisValue) writeJson(path.join(dir, 'diagnosis.json'), diagnosisValue);
  return path.join(dir, 'result.json');
}

test('parseArgs accepts root, out, and json flags', () => {
  const opts = parseArgs(['--root', 'exports/a', '--out', 'exports/b', '--json']);
  assert.match(opts.root, /exports\/a$/u);
  assert.match(opts.out, /exports\/b$/u);
  assert.equal(opts.json, true);
});

test('analyzeArtifact marks first-pass near-transfer miss as actionable when gate is off', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ownership-replay-audit-'));
  const file = writeArtifact(tmp, 'runs/world015-ownership-r1', {
    resultValue: result({ learnerTransformationPost: [finalPost()] }),
  });

  const row = analyzeArtifact(file);
  assert.equal(row.firstPass, true);
  assert.equal(row.triggerEligible, true);
  assert.equal(row.actionableGateReplay, true);
  assert.equal(row.alreadyGatedFailure, false);
  assert.match(row.replayCommand, /--ownership-transfer-gate on/u);
  assert.match(row.replayCommand, /--turn 11/u);
});

test('analyzeArtifact excludes missing instrumentation and non-near-transfer misses from actionable gate replay', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ownership-replay-audit-'));
  const oldFile = writeArtifact(tmp, 'runs/not-instrumented', {
    resultValue: result(),
    diagnosisValue: diagnosis({ label: 'not-instrumented' }),
  });
  const otherMissFile = writeArtifact(tmp, 'runs/wrong-family', {
    resultValue: result({ learnerTransformationPost: [finalPost({ missingFamilies: ['purpose_link'] })] }),
    diagnosisValue: diagnosis({ label: 'wrong-family' }),
  });

  const oldRow = analyzeArtifact(oldFile);
  const otherMissRow = analyzeArtifact(otherMissFile);
  assert.equal(oldRow.triggerEligible, false);
  assert.equal(otherMissRow.triggerEligible, true);
  assert.equal(otherMissRow.actionableGateReplay, false);
});

test('analyzeArtifact separates already-gated failures and excludes mock or episode sources', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ownership-replay-audit-'));
  const gatedFile = writeArtifact(tmp, 'runs/world015-transfer-r1', {
    resultValue: result({ learnerTransformationPost: [finalPost()] }),
    diagnosisValue: diagnosis({ label: 'world015-transfer-r1', ownershipTransferGate: true }),
  });
  const mockFile = writeArtifact(tmp, 'runs/world015-mock-r1', {
    resultValue: result({ learnerTransformationPost: [finalPost()] }),
    diagnosisValue: diagnosis({ label: 'world015-mock-r1' }),
  });
  const episodeFile = writeArtifact(tmp, 'episodes/world015-from-t11', {
    resultValue: result({ learnerTransformationPost: [finalPost()] }),
    diagnosisValue: diagnosis({
      label: 'world015-from-t11',
      episode: { source: { label: 'world015-ownership-r1' }, overrides: ['ownership-transfer-gate'] },
      ownershipTransferGate: true,
    }),
  });

  const gatedRow = analyzeArtifact(gatedFile);
  const mockRow = analyzeArtifact(mockFile);
  const episodeRow = analyzeArtifact(episodeFile);
  assert.equal(gatedRow.triggerEligible, true);
  assert.equal(gatedRow.alreadyGatedFailure, true);
  assert.equal(gatedRow.actionableGateReplay, false);
  assert.equal(mockRow.triggerEligible, false);
  assert.equal(episodeRow.triggerEligible, false);
});

test('buildAudit attaches existing gate replay to an actionable source', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ownership-replay-audit-'));
  writeArtifact(tmp, 'runs/world015-ownership-r1', {
    resultValue: result({ learnerTransformationPost: [finalPost()] }),
    diagnosisValue: diagnosis({ label: 'world015-ownership-r1' }),
  });
  writeArtifact(tmp, 'episodes/world015-replay-from-t11', {
    resultValue: result({
      learnerTransformationPost: [finalPost({ status: 'transformed', complete: true, missingFamilies: [] })],
    }),
    diagnosisValue: diagnosis({
      label: 'world015-replay-from-t11',
      ownershipTransferGate: true,
      episode: {
        source: { label: 'world015-ownership-r1', dir: 'runs/world015-ownership-r1' },
        overrides: ['ownership-transfer-gate'],
        prefixIntegrity: { ok: true },
      },
    }),
  });

  const audit = buildAudit({ root: tmp });
  assert.equal(audit.summary.triggerCandidates, 1);
  assert.equal(audit.summary.actionableGateCandidates, 1);
  assert.equal(audit.actionableGateCandidates[0].existingGateReplays.length, 1);
  assert.equal(audit.actionableGateCandidates[0].existingGateReplays[0].finalOwnershipComplete, true);
  assert.match(renderMarkdown(audit), /Every actionable source already has/u);
});

test('writeReports emits markdown and json', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ownership-replay-audit-'));
  const out = path.join(tmp, 'out');
  writeArtifact(tmp, 'runs/world015-ownership-r1', {
    resultValue: result({ learnerTransformationPost: [finalPost()] }),
  });

  const audit = buildAudit({ root: tmp });
  const files = writeReports(audit, out);
  assert.ok(fs.existsSync(files.jsonFile));
  assert.match(fs.readFileSync(files.mdFile, 'utf8'), /Ownership Replay Candidate Audit/u);
});
