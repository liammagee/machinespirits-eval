import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { auditEvaluationStoreBoundary } from '../scripts/audit-evaluation-store-boundary.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inventory = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'config', 'evaluation-store-boundary-inventory.json'), 'utf8'),
);
const tempDirs = [];

after(() => {
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

function isolatedStoreContract() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluation-store-boundary-'));
  tempDirs.push(tempDir);
  const databasePath = path.join(tempDir, 'missing-parent', 'evaluations.db');
  const script = `
    import fs from 'node:fs';
    import Database from 'better-sqlite3';

    const direct = await import('@machinespirits/eval/services/evaluationStore');
    const root = await import('@machinespirits/eval');
    const fileFacade = await import('./services/evaluationStore.js');
    await import('./routes/evalRoutes.js');
    await import('./services/evaluationRunner.js');
    const lifecycle = await import('./services/evaluationStore/lifecycle.js');
    const databaseExistsAfterImports = fs.existsSync(process.env.EVAL_DB_PATH);
    const store = lifecycle.startDefaultEvaluationStore({ rootDir: process.cwd() });
    const db = new Database(process.env.EVAL_DB_PATH, { readonly: true });
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => row.name);
    const journalMode = db.pragma('journal_mode', { simple: true });
    db.close();
    const storeOpenBeforeStop = store.isOpen;
    lifecycle.stopDefaultEvaluationStore();

    console.log(JSON.stringify({
      databaseExistsAfterImports,
      databaseExistsAfterStart: fs.existsSync(process.env.EVAL_DB_PATH),
      journalMode,
      storeOpenBeforeStop,
      storeOpenAfterStop: store.isOpen,
      tables,
      namedExports: Object.keys(direct).filter((name) => name !== 'default').sort(),
      defaultMembers: Object.keys(direct.default).sort(),
      rootMatchesDirect: root.evaluationStore.createRun === direct.createRun,
      directMatchesFile: direct.createRun === fileFacade.createRun,
    }));
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      EVAL_DB_PATH: databasePath,
      EVAL_LOGS_DIR: path.join(tempDir, 'logs'),
      MS_DATA_HOME: path.join(tempDir, 'data-home'),
    },
    encoding: 'utf8',
  });

  return JSON.parse(output.trim());
}

describe('evaluationStore boundary inventory', () => {
  it('ratchets every tracked consumer, import mode, export, and package path', () => {
    const result = auditEvaluationStoreBoundary({ rootDir: ROOT_DIR });
    assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result, null, 2));

    const counts = {};
    for (const consumer of inventory.consumers) {
      counts[consumer.classification] = (counts[consumer.classification] ?? 0) + 1;
    }
    assert.deepEqual(counts, {
      'package-entrypoint': 1,
      'application-runtime': 1,
      'operational-script': 22,
      'archived-oneoff': 4,
      test: 14,
    });
  });

  it('keeps imports side-effect free and preserves explicit startup plus package compatibility', () => {
    const contract = isolatedStoreContract();

    assert.equal(contract.databaseExistsAfterImports, false);
    assert.equal(contract.databaseExistsAfterStart, true);
    assert.equal(contract.journalMode, 'wal');
    assert.equal(contract.storeOpenBeforeStop, true);
    assert.equal(contract.storeOpenAfterStop, false);
    assert.deepEqual(contract.tables, inventory.startupContract.tables);
    assert.deepEqual(contract.namedExports, inventory.exports.named);
    assert.deepEqual(contract.defaultMembers, inventory.exports.defaultMembers);
    assert.equal(contract.rootMatchesDirect, true);
    assert.equal(contract.directMatchesFile, true);
  });

  it('records the three named-only compatibility exports explicitly', () => {
    assert.deepEqual(
      inventory.exports.named.filter((name) => !inventory.exports.defaultMembers.includes(name)),
      ['updateResultTutorCharismaScores', 'updateResultTutorRegisterScore', 'updateResultTutorScores'],
    );
  });
});
