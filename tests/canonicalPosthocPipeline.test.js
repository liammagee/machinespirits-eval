import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  materializeCanonicalPosthocFixture,
  projectCanonicalPosthocOutputs,
} from './helpers/canonicalPosthocFixture.js';

const exec = promisify(execFile);
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(ROOT_DIR, 'tests', 'fixtures', 'canonical-posthoc-analysis');
const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'fixture-v1.json'), 'utf8'));
const golden = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'golden-v1.json'), 'utf8'));
const tempDirs = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

function makeFixture() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-posthoc-'));
  tempDirs.push(tempDir);
  const inputs = materializeCanonicalPosthocFixture(fixture, path.join(tempDir, 'input'));
  return { tempDir, ...inputs, outputDir: path.join(tempDir, 'output') };
}

async function runPipeline(paths) {
  return exec(
    process.execPath,
    [
      path.join(ROOT_DIR, 'scripts', 'run-canonical-posthoc-pipeline.js'),
      '--db',
      paths.dbPath,
      '--logs',
      paths.logsDir,
      '--run-id',
      fixture.runId,
      '--judge',
      fixture.primaryJudge,
      '--output-dir',
      paths.outputDir,
    ],
    {
      cwd: ROOT_DIR,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
      timeout: 60_000,
      maxBuffer: 30 * 1024 * 1024,
    },
  );
}

async function expectBoundaryFailure(paths, pattern) {
  await assert.rejects(runPipeline(paths), (error) => {
    const output = `${error.stdout || ''}\n${error.stderr || ''}`;
    assert.match(output, /\[posthoc-boundary\]/u);
    assert.match(output, pattern);
    return true;
  });
}

describe('canonical post-hoc analysis pipeline', () => {
  it('runs every command against the frozen fixture and matches reviewed golden statistics', async () => {
    const paths = makeFixture();
    const { stdout, stderr } = await runPipeline(paths);
    assert.doesNotMatch(stderr, /Error:|\[posthoc-boundary\]/u);
    assert.match(stderr, /EPOCH: All Data/u);
    assert.match(stdout, /Canonical post-hoc pipeline complete/u);
    assert.deepEqual(projectCanonicalPosthocOutputs(paths.outputDir), golden);
  });

  it('rejects mixed tutor-rubric versions', async () => {
    const paths = makeFixture();
    const db = new Database(paths.dbPath);
    db.prepare(
      "UPDATE evaluation_results SET tutor_rubric_version = '2.1' WHERE id = 'dialogue-base-1-secondary'",
    ).run();
    db.close();
    await expectBoundaryFailure(paths, /tutor rubric version must be singular/u);
  });

  it('rejects an unpaired secondary judge row', async () => {
    const paths = makeFixture();
    const db = new Database(paths.dbPath);
    db.prepare(
      'UPDATE evaluation_results SET suggestions = \'[{"message":"unpaired"}]\' WHERE id = \'dialogue-base-1-secondary\'',
    ).run();
    db.close();
    await expectBoundaryFailure(paths, /not paired to the primary judge/u);
  });

  it('rejects provenance drift across repeated judgments', async () => {
    const paths = makeFixture();
    const db = new Database(paths.dbPath);
    db.prepare(
      "UPDATE evaluation_results SET dialogue_content_hash = 'drifted' WHERE id = 'dialogue-base-1-secondary'",
    ).run();
    db.close();
    await expectBoundaryFailure(paths, /dialogue_content_hash differs across repeated judgments/u);
  });

  it('rejects mixed trace schema versions', async () => {
    const paths = makeFixture();
    const logPath = path.join(paths.logsDir, 'dialogue-base-1.json');
    const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    log.schemaVersion = 4;
    fs.writeFileSync(logPath, `${JSON.stringify(log, null, 2)}\n`);
    await expectBoundaryFailure(paths, /trace schema version must be singular/u);
  });
});
