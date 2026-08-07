import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, it } from 'node:test';

import { createEvaluationScriptContext } from '../services/evaluationStore/scriptContext.js';
import { createEvaluationStore } from '../services/evaluationStore/createEvaluationStore.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDirs = [];
const MIGRATED_SCRIPTS = [
  'scripts/analyze-insight-action-gap.js',
  'scripts/assess-transcripts.js',
  'scripts/audit-message-chain.js',
  'scripts/code-dialectical-modulation.js',
  'scripts/generate-paper-figures.js',
  'scripts/render-sequence-diagram.js',
];

after(() => {
  for (const tempDir of tempDirs) fs.rmSync(tempDir, { recursive: true, force: true });
});

function makeContext(label) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `evaluation-script-context-${label}-`));
  tempDirs.push(tempDir);
  const databasePath = path.join(tempDir, 'data', 'evaluations.db');
  const logsRoot = path.join(tempDir, 'logs');
  return {
    tempDir,
    databasePath,
    logsRoot,
    context: createEvaluationScriptContext({
      rootDir: tempDir,
      env: { EVAL_DB_PATH: databasePath, EVAL_LOGS_DIR: logsRoot },
    }),
  };
}

describe('evaluation operational-script context', () => {
  it('resolves paths without opening a database or creating filesystem state', () => {
    const { databasePath, logsRoot, context } = makeContext('passive');

    assert.equal(context.databasePath, databasePath);
    assert.equal(context.logsRoot, logsRoot);
    assert.equal(fs.existsSync(databasePath), false);
    assert.equal(fs.existsSync(logsRoot), false);
    assert.equal(Object.isFrozen(context), true);
  });

  it('keeps dialogue-log readers isolated across script contexts', () => {
    const first = makeContext('first');
    const second = makeContext('second');
    const dialogueId = 'dialogue-shared-id';

    for (const fixture of [first, second]) {
      fs.mkdirSync(path.join(fixture.logsRoot, 'tutor-dialogues'), { recursive: true });
    }
    fs.writeFileSync(
      path.join(first.logsRoot, 'tutor-dialogues', `${dialogueId}.json`),
      JSON.stringify({ host: 'first' }),
    );
    fs.writeFileSync(
      path.join(second.logsRoot, 'tutor-dialogues', `${dialogueId}.json`),
      JSON.stringify({ host: 'second' }),
    );

    assert.deepEqual(first.context.dialogueLogs.loadDialogueLog(dialogueId), { host: 'first' });
    assert.deepEqual(second.context.dialogueLogs.loadDialogueLog(dialogueId), { host: 'second' });
  });

  it('removes the legacy facade from every migrated operational script', () => {
    for (const relativePath of MIGRATED_SCRIPTS) {
      const source = fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
      assert.doesNotMatch(source, /from ['"]\.\.\/services\/evaluationStore\.js['"]/u, relativePath);
      assert.match(source, /createEvaluationScriptContext/u, relativePath);
      assert.match(source, /dialogueLogs\.loadDialogueLog/u, relativePath);
    }
  });

  it('runs deterministic empty-data CLI paths against an explicitly selected database', () => {
    const fixture = makeContext('cli');
    const env = {
      ...process.env,
      EVAL_DB_PATH: fixture.databasePath,
      EVAL_LOGS_DIR: fixture.logsRoot,
      MS_DATA_HOME: path.join(fixture.tempDir, 'data-home'),
      OPENROUTER_API_KEY: '',
    };
    const store = createEvaluationStore({ rootDir: ROOT_DIR, env });
    store.close();

    const cases = [
      ['scripts/assess-transcripts.js', ['missing-run']],
      ['scripts/code-dialectical-modulation.js', ['--structural-only', '--run-id', 'missing-run']],
      ['scripts/analyze-insight-action-gap.js', ['missing-run', '--output', path.join(fixture.tempDir, 'gap.md')]],
      [
        'scripts/generate-paper-figures.js',
        ['--run', 'missing-run', '--scenario', 'missing-scenario', '--format', 'html', '--output', fixture.tempDir],
      ],
      ['scripts/render-sequence-diagram.js', ['missing-run', '--output', fixture.tempDir]],
    ];

    for (const [relativePath, args] of cases) {
      assert.doesNotThrow(
        () =>
          execFileSync(process.execPath, [relativePath, ...args], {
            cwd: ROOT_DIR,
            env,
            encoding: 'utf8',
            stdio: 'pipe',
          }),
        relativePath,
      );
    }
    assert.equal(fs.existsSync(path.join(fixture.tempDir, 'gap.md')), true);
  });
});
