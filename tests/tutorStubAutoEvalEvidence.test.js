import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyExperimentRun } from '../services/experimentRunArtifacts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUTO_EVAL = 'scripts/run-tutor-stub-auto-eval.js';

function dryRun(sourceDir, indexDir, extra = []) {
  return execFileSync(
    process.execPath,
    [
      AUTO_EVAL,
      '--dry-run',
      '--runs',
      '1',
      '--policies',
      'dynamic',
      '--turns',
      '1',
      '--trace-dir',
      sourceDir,
      '--index-root',
      indexDir,
      '--no-progress',
      '--no-html-report',
      '--no-ledger',
      ...extra,
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
}

function summaryPath(runDir) {
  const name = fs.readdirSync(runDir).find((entry) => /^auto-eval-.*\.json$/u.test(entry));
  assert.ok(name, `expected auto-eval summary under ${runDir}`);
  return path.join(runDir, name);
}

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function treeSnapshot(root) {
  const rows = [];
  const stack = [root];
  while (stack.length) {
    const directory = stack.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) stack.push(entryPath);
      else if (entry.isFile()) {
        rows.push({
          path: path.relative(root, entryPath),
          bytes: fs.statSync(entryPath).size,
          sha256: sha256(entryPath),
        });
      }
    }
  }
  return rows.sort((left, right) => left.path.localeCompare(right.path));
}

function writeFakeCodex(binDir, { failWhenInputIncludes = null } = {}) {
  const executable = path.join(binDir, 'codex');
  fs.writeFileSync(
    executable,
    `#!/usr/bin/env node
const fs = require('node:fs');
const failMarker = ${JSON.stringify(failWhenInputIncludes)};
const args = process.argv.slice(2);
const outputIndex = args.indexOf('-o');
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  if (failMarker && input.includes(failMarker)) {
    process.stderr.write('fake codex: induced failure for test marker\\n');
    process.exit(1);
  }
  const response = input.includes('You are an automated learner')
    ? 'I would test the newest public mark before deciding.'
    : input.includes('compact up-front reviewer')
      ? '{}'
      : 'Which public mark would you test next, and what would it show?';
  if (outputPath) fs.writeFileSync(outputPath, response);
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
});
`,
    'utf8',
  );
  fs.chmodSync(executable, 0o755);
}

test('auto-eval dry run is a sealed canonical transaction with ordered job events', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-auto-evidence-'));
  const runDir = path.join(root, 'source');
  try {
    dryRun(runDir, path.join(root, 'index'));

    const verification = verifyExperimentRun(runDir);
    assert.equal(verification.ok, true, verification.errors.join('\n'));
    assert.deepEqual(verification.plan.randomization.jobOrder, ['dynamic-r1']);
    assert.deepEqual(verification.plan.metadata.randomDrawContract.requiredJobIds, []);
    assert.equal(verification.plan.jobs[0].arguments.includes('{run_dir}'), true);
    assert.deepEqual(verification.plan.requiredObservedModelRoles, []);

    const eventTypes = fs
      .readFileSync(path.join(runDir, 'run-events.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line).type);
    assert.deepEqual(eventTypes, [
      'run_planned',
      'run_started',
      'job_started',
      'job_completed',
      'report_written',
      'run_completed',
    ]);

    const summary = JSON.parse(fs.readFileSync(summaryPath(runDir), 'utf8'));
    assert.equal(summary.config.runSeed, 1);
    assert.equal(summary.results[0].status, 'dry_run');
    assert.equal(summary.evidence.runSeal, path.join(runDir, 'run-seal.json'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('live-like auto-eval seals tutor, analyzer, and learner observations under their frozen roles', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-auto-live-provenance-'));
  const runDir = path.join(root, 'source');
  const binDir = path.join(root, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  writeFakeCodex(binDir);
  try {
    execFileSync(
      process.execPath,
      [
        AUTO_EVAL,
        '--runs',
        '1',
        '--policies',
        'field',
        '--turns',
        '1',
        '--primary-horizon',
        '1',
        '--model',
        'codex.gpt-5.6-terra',
        '--analysis-model',
        'codex.gpt-5.6-terra',
        '--auto-learner-model',
        'codex.gpt-5.6-terra',
        '--trace-dir',
        runDir,
        '--index-root',
        path.join(root, 'index'),
        '--no-progress',
        '--no-html-report',
        '--no-ledger',
        '--no-memory-summary',
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 20_000,
        env: {
          ...process.env,
          PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
          CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
        },
      },
    );

    const verification = verifyExperimentRun(runDir);
    assert.equal(verification.ok, true, verification.errors.join('\n'));
    assert.deepEqual(verification.plan.metadata.randomDrawContract.requiredJobIds, ['field-r1']);
    assert.ok(verification.replay.decisions.length >= 1);
    assert.ok(verification.replay.decisions.every((decision) => decision.matches));
    assert.deepEqual(verification.plan.requiredObservedModelRoles, ['analyzer', 'learner', 'tutor']);
    const observations = fs
      .readFileSync(path.join(runDir, 'run-events.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
      .filter((event) => event.type === 'model_observed');
    assert.deepEqual(observations.map((event) => event.role).sort(), ['analyzer', 'learner', 'tutor']);
    assert.ok(observations.every((event) => event.resolved === 'codex/gpt-5.6-terra'));
    assert.ok(observations.every((event) => event.observed === 'codex/gpt-5.6-terra'));
    const draws = fs
      .readFileSync(path.join(runDir, 'run-events.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
      .filter((event) => event.type === 'random_draw');
    assert.ok(draws.length >= 1);
    assert.ok(draws.every((event) => event.jobId === 'field-r1'));
    const summary = JSON.parse(fs.readFileSync(summaryPath(runDir), 'utf8'));
    assert.equal(summary.config.primaryHorizon, 1);
    assert.equal(summary.aggregates.primaryHorizon, 1);
    assert.equal(summary.aggregates.fixedHorizonRows, 1);
    assert.equal(summary.aggregates.fixedHorizonObserved, 1);
    assert.equal(summary.aggregates.fixedHorizonOutcomeMissing, 0);
    assert.equal(summary.aggregates.fixedHorizonComplete, 1);
    assert.equal(summary.aggregates.fixedHorizonIncomplete, 0);
    assert.ok(Number.isFinite(summary.aggregates.meanCoverageAtHorizon));
    assert.equal(summary.rows[0].fixedHorizon.horizon, 1);
    assert.equal(summary.rows[0].fixedHorizon.complete, true);
    assert.equal(summary.rows[0].fixedHorizon.safetyStatus, 'safety_passed');
    assert.equal(summary.rows[0].fixedHorizon.guardTurnsComplete, 1);
    assert.equal(summary.aggregates.horizonSafetyIncomplete, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('report-from verifies a sealed source and writes a byte-preserving derived sibling', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-auto-report-derived-'));
  const runDir = path.join(root, 'source');
  try {
    dryRun(runDir, path.join(root, 'index'));
    const sourceSummary = summaryPath(runDir);
    const before = treeSnapshot(runDir);

    const output = execFileSync(
      process.execPath,
      [AUTO_EVAL, '--report-from', sourceSummary, '--index-root', path.join(root, 'derived-index'), '--no-ledger'],
      { cwd: ROOT, encoding: 'utf8' },
    );

    assert.deepEqual(treeSnapshot(runDir), before);
    assert.match(output, /verified sealed source; preserved/u);
    const derivedDir = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('source-derived-'))
      .map((entry) => path.join(root, entry.name))
      .at(0);
    assert.ok(derivedDir);
    const derivedSummary = JSON.parse(fs.readFileSync(summaryPath(derivedDir), 'utf8'));
    assert.equal(derivedSummary.derivedFrom.sourceVerified, true);
    assert.equal(derivedSummary.derivedFrom.sourceSummarySha256, sha256(sourceSummary));
    assert.ok(fs.existsSync(derivedSummary.report.html));
    assert.notEqual(derivedSummary.report.json, sourceSummary);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resume creates a sealed sibling transaction with source hashes and no source writes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-auto-resume-lineage-'));
  const runDir = path.join(root, 'source');
  try {
    dryRun(runDir, path.join(root, 'index'));
    const sourceSummary = summaryPath(runDir);
    const before = treeSnapshot(runDir);

    execFileSync(
      process.execPath,
      [
        AUTO_EVAL,
        '--resume-from',
        sourceSummary,
        '--resume-statuses',
        'dry_run',
        '--dry-run',
        '--parallelism',
        '1',
        '--index-root',
        runDir,
        '--ledger',
        path.join(runDir, 'ledger.jsonl'),
        '--no-progress',
        '--no-html-report',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );

    assert.deepEqual(treeSnapshot(runDir), before);
    const resumeDir = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('source-resume-'))
      .map((entry) => path.join(root, entry.name))
      .at(0);
    assert.ok(resumeDir);
    const verification = verifyExperimentRun(resumeDir);
    assert.equal(verification.ok, true, verification.errors.join('\n'));
    assert.equal(verification.plan.lineage.resumeOf, path.basename(runDir));
    assert.equal(verification.plan.metadata.sourceSummarySha256, sha256(sourceSummary));
    assert.equal(verification.plan.metadata.sourcePlanSha256, sha256(path.join(runDir, 'run-plan.json')));
    assert.equal(verification.plan.metadata.sourceSealSha256, sha256(path.join(runDir, 'run-seal.json')));
    assert.equal(verification.plan.intent.sourceLineage.sourceVerified, true);

    const resumedSummary = JSON.parse(fs.readFileSync(summaryPath(resumeDir), 'utf8'));
    const traceFlag = resumedSummary.results[0].command.indexOf('--trace-dir');
    assert.equal(resumedSummary.results[0].command[traceFlag + 1], resumeDir);
    assert.notEqual(resumedSummary.results[0].command[traceFlag + 1], runDir);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resume replaces drawless failed rows without weakening retained-row verification', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-auto-resume-incomplete-'));
  const runDir = path.join(root, 'source');
  const binDir = path.join(root, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  writeFakeCodex(binDir, { failWhenInputIncludes: 'Automated learner run 2/2 for policy field.' });
  const env = {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
    CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
  };
  try {
    const sourceError = (() => {
      try {
        execFileSync(
          process.execPath,
          [
            AUTO_EVAL,
            '--runs',
            '2',
            '--policies',
            'field',
            '--turns',
            '1',
            '--primary-horizon',
            '1',
            '--model',
            'codex.gpt-5.6-terra',
            '--analysis-model',
            'codex.gpt-5.6-terra',
            '--auto-learner-model',
            'codex.gpt-5.6-terra',
            '--parallelism',
            '1',
            '--trace-dir',
            runDir,
            '--index-root',
            path.join(root, 'index'),
            '--keep-going',
            '--no-progress',
            '--no-html-report',
            '--no-ledger',
            '--no-memory-summary',
          ],
          { cwd: ROOT, encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024, stdio: 'pipe', env },
        );
        return null;
      } catch (error) {
        return error;
      }
    })();
    assert.ok(sourceError, 'the induced source failure must exit non-zero');
    assert.equal(sourceError.status, 1);

    const sourceSummary = summaryPath(runDir);
    const source = JSON.parse(fs.readFileSync(sourceSummary, 'utf8'));
    assert.deepEqual(
      source.results.map((result) => [result.key, result.status]),
      [
        ['field-r1', 'ok'],
        ['field-r2', 'failed'],
      ],
    );
    const fullSourceVerification = verifyExperimentRun(runDir);
    assert.equal(fullSourceVerification.ok, false);
    assert.match(fullSourceVerification.errors.join('\n'), /random draw contract missing decisions for field-r2/u);
    const scopedSourceVerification = verifyExperimentRun(runDir, {
      exemptDrawContractJobIds: new Set(['field-r2']),
    });
    assert.equal(scopedSourceVerification.ok, true, scopedSourceVerification.errors.join('\n'));
    const before = treeSnapshot(runDir);

    writeFakeCodex(binDir);
    execFileSync(
      process.execPath,
      [
        AUTO_EVAL,
        '--resume-from',
        sourceSummary,
        '--resume-statuses',
        'failed',
        '--parallelism',
        '1',
        '--index-root',
        path.join(root, 'resume-index'),
        '--no-progress',
        '--no-html-report',
        '--no-ledger',
        '--no-memory-summary',
      ],
      { cwd: ROOT, encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024, env },
    );

    assert.deepEqual(treeSnapshot(runDir), before);
    const resumeDir = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('source-resume-'))
      .map((entry) => path.join(root, entry.name))
      .at(0);
    assert.ok(resumeDir);
    const resumeVerification = verifyExperimentRun(resumeDir);
    assert.equal(resumeVerification.ok, true, resumeVerification.errors.join('\n'));
    assert.equal(resumeVerification.plan.lineage.resumeOf, path.basename(runDir));
    assert.deepEqual(resumeVerification.plan.randomization.jobOrder, ['field-r2']);
    assert.equal(resumeVerification.plan.intent.sourceLineage.sourceVerified, true);
    const resumedSummary = JSON.parse(fs.readFileSync(summaryPath(resumeDir), 'utf8'));
    assert.deepEqual(
      resumedSummary.results.map((result) => [result.key, result.status]),
      [
        ['field-r1', 'ok'],
        ['field-r2', 'ok'],
      ],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
