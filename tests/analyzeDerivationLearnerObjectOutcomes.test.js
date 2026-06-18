import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  analyzeRefs,
  analyzeResult,
  buildSummary,
  classifyOutcome,
  finalD,
  parseArgs,
  resolveResultRef,
  writeReports,
} from '../scripts/analyze-derivation-learner-object-outcomes.js';

function result(overrides = {}) {
  return {
    worldId: 'world_probe',
    verdict: 'grounded_anagnorisis',
    turnsPlayed: 8,
    firstForcedTurn: 7,
    assertedGroundedTurn: 8,
    trajectory: [{ turn: 1, D: 3 }, { turn: 8, D: 0 }],
    ...overrides,
  };
}

function transformedRow(overrides = {}) {
  return {
    turn: 8,
    status: 'transformed',
    complete: true,
    ownershipLevel: 'durable',
    ownershipScore: 6,
    passedFamilies: ['own_words', 'use_in_path'],
    missingFamilies: [],
    finalAssertionAvailable: true,
    inputAuditOk: true,
    nonLeakAuditOk: true,
    ...overrides,
  };
}

function durability(overrides = {}) {
  return {
    status: 'durable_transformation',
    durable: true,
    firstCompleteTurn: 5,
    finalStatus: 'transformed',
    finalComplete: true,
    releaseChallengeCount: 2,
    survivedAllReleaseChallenges: true,
    inputAudit: { ok: true },
    nonLeakAudit: { ok: true },
    ...overrides,
  };
}

function writeResult(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

test('parseArgs collects runs, output path, and search dirs', () => {
  const opts = parseArgs(['--run', 'a', '--run', 'b', '--search-dir', 'exports/custom', '--out', 'exports/out']);
  assert.deepEqual(opts.runs, ['a', 'b']);
  assert.match(opts.searchDirs.at(-1), /exports\/custom$/u);
  assert.match(opts.out, /exports\/out$/u);
});

test('resolveResultRef accepts direct result.json paths', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-object-outcomes-'));
  const file = path.join(tmp, 'result.json');
  writeResult(file, result());

  assert.equal(resolveResultRef(file, []), file);
});

test('resolveResultRef accepts run directories and label search dirs', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-object-outcomes-'));
  const directDir = path.join(tmp, 'direct-run');
  const searchDir = path.join(tmp, 'search');
  writeResult(path.join(directDir, 'result.json'), result());
  writeResult(path.join(searchDir, 'label-run', 'result.json'), result());

  assert.equal(resolveResultRef(directDir, []), path.join(directDir, 'result.json'));
  assert.equal(resolveResultRef('label-run', [searchDir]), path.join(searchDir, 'label-run', 'result.json'));
});

test('finalD reads the latest numeric trajectory value', () => {
  assert.equal(finalD(result({ trajectory: [{ D: 5 }, { D: '2' }, { note: 'skip' }] })), 2);
  assert.equal(finalD(result({ trajectory: [] })), null);
});

test('classifyOutcome distinguishes missing instrumentation, partial ownership, transformed ownership, and proof failure', () => {
  assert.equal(classifyOutcome({ result: result(), finalPost: null }), 'not_instrumented');
  assert.equal(
    classifyOutcome({ result: result(), finalPost: transformedRow({ complete: false, missingFamilies: ['near_transfer'] }) }),
    'proof_grounded_ownership_partial',
  );
  assert.equal(classifyOutcome({ result: result(), finalPost: transformedRow() }), 'proof_and_ownership_grounded');
  assert.equal(classifyOutcome({ result: result({ verdict: 'cap_reached' }), finalPost: null }), 'proof_failed');
});

test('analyzeResult reports grounded proof with transformed durable ownership', () => {
  const row = analyzeResult(
    result({
      learnerTransformationPost: [transformedRow()],
      learnerTransformationDurability: durability(),
    }),
    { ref: 'probe' },
  );

  assert.equal(row.outcome, 'proof_and_ownership_grounded');
  assert.equal(row.finalD, 0);
  assert.equal(row.forcedToAssertedGap, 1);
  assert.equal(row.ownership.status, 'transformed');
  assert.equal(row.durability.status, 'durable_transformation');
  assert.equal(row.leakAudit.ok, true);
});

test('analyzeResult reports grounded proof with partial ownership', () => {
  const row = analyzeResult(
    result({
      learnerTransformationPost: [
        transformedRow({
          status: 'partial_ownership',
          complete: false,
          missingFamilies: ['near_transfer'],
        }),
      ],
    }),
  );

  assert.equal(row.outcome, 'proof_grounded_ownership_partial');
  assert.deepEqual(row.ownership.missingFamilies, ['near_transfer']);
});

test('buildSummary and writeReports produce JSON and Markdown reports', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-object-outcomes-'));
  const runDir = path.join(tmp, 'runs');
  const outDir = path.join(tmp, 'out');
  writeResult(
    path.join(runDir, 'ok', 'result.json'),
    result({
      learnerTransformationPost: [transformedRow()],
      learnerTransformationDurability: durability(),
    }),
  );
  writeResult(path.join(runDir, 'old', 'result.json'), result());
  writeResult(path.join(runDir, 'failed', 'result.json'), result({ verdict: 'cap_reached', trajectory: [{ D: 2 }] }));

  const summary = buildSummary(['ok', 'old', 'failed'], { searchDirs: [runDir] });
  assert.equal(summary.counts.proof_and_ownership_grounded, 1);
  assert.equal(summary.counts.not_instrumented, 1);
  assert.equal(summary.counts.proof_failed, 1);

  const files = writeReports(summary, outDir);
  assert.match(fs.readFileSync(files.mdFile, 'utf8'), /Learner Object Outcome Report/u);
  assert.equal(JSON.parse(fs.readFileSync(files.jsonFile, 'utf8')).counts.total, 3);
});

test('analyzeRefs resolves direct result files', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-object-outcomes-'));
  const file = path.join(tmp, 'result.json');
  writeResult(file, result({ learnerTransformationPost: [transformedRow()] }));

  const rows = analyzeRefs([file], { searchDirs: [] });
  assert.equal(rows[0].outcome, 'proof_and_ownership_grounded');
});
