import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROFILES = [
  'cell_21_recog_multi_unified_rewrite',
  'cell_48_base_dialectical_suspicious_unified_erosion',
  'cell_49_recog_dialectical_suspicious_unified_erosion',
];

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

describe('analyze-superego-framing-trajectory CLI', () => {
  let tmp;
  let dbPath;
  let logsDir;
  let codebookPath;
  let codingPath;
  let reportPath;
  let dbHashBefore;

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'superego-framing-cli-'));
    dbPath = path.join(tmp, 'evaluations.db');
    logsDir = path.join(tmp, 'tutor-dialogues');
    codebookPath = path.join(tmp, 'codebook.json');
    codingPath = path.join(tmp, 'coding.json');
    reportPath = path.join(tmp, 'report.md');
    fs.mkdirSync(logsDir);

    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE evaluation_results (
        run_id TEXT,
        profile_name TEXT,
        scenario_id TEXT,
        dialogue_id TEXT,
        judge_model TEXT,
        incorporation_rate REAL,
        dimension_convergence REAL,
        created_at TEXT,
        success INTEGER
      )
    `);
    const insert = db.prepare(
      `INSERT INTO evaluation_results
       (run_id, profile_name, scenario_id, dialogue_id, judge_model, created_at, success)
       VALUES (?, ?, ?, ?, 'fixture-judge', ?, 1)`,
    );

    const codingRows = [];
    for (const [index, profile] of PROFILES.entries()) {
      const dialogueId = `dialogue-fixture-${index + 1}`;
      insert.run('fixture-run', profile, `scenario-${index + 1}`, dialogueId, `2026-08-05T00:00:0${index}Z`);
      const log = {
        dialogueId,
        dialogueTrace: [
          { agent: 'ego', action: 'generate', suggestions: [{ message: 'Give the answer directly.' }] },
          {
            agent: 'superego',
            action: 'review',
            approved: false,
            interventionType: 'revise',
            feedback: 'Give the learner an evidential question instead.',
          },
          { agent: 'ego', action: 'revise', suggestions: [{ message: 'Which evidence would test that claim?' }] },
        ],
      };
      const bytes = Buffer.from(`${JSON.stringify(log, null, 2)}\n`);
      fs.writeFileSync(path.join(logsDir, `${dialogueId}.json`), bytes);
      codingRows.push({
        check_id: `${dialogueId}#check-1`,
        source_trace_sha256: sha256(bytes),
        label: index === 1 ? 'restate' : 'reframe',
        rationale: 'Fixture rationale records whether the organizing move changes.',
      });
    }
    db.close();

    fs.writeFileSync(
      codebookPath,
      `${JSON.stringify({ codebook_id: 'fixture-codebook', version: '1.0.0' }, null, 2)}\n`,
    );
    fs.writeFileSync(
      codingPath,
      `${JSON.stringify({ codebook_id: 'fixture-codebook', coding_date: '2026-08-05', rows: codingRows }, null, 2)}\n`,
    );
    dbHashBefore = sha256(fs.readFileSync(dbPath));
  });

  after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('produces a deterministic report without mutating the evaluation database', () => {
    const stdout = execFileSync(
      process.execPath,
      [
        'scripts/analyze-superego-framing-trajectory.js',
        '--db',
        dbPath,
        '--logs',
        logsDir,
        '--codebook',
        codebookPath,
        '--coding',
        codingPath,
        '--output',
        reportPath,
        '--json',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );

    assert.match(stdout, /Coded checks: 3/u);
    assert.match(fs.readFileSync(reportPath, 'utf8'), /Manual reframes: \*\*2\/3\*\*/u);
    const result = JSON.parse(fs.readFileSync(reportPath.replace(/\.md$/u, '.json'), 'utf8'));
    assert.equal(result.corpus.unique_dialogues, 3);
    assert.equal(result.summary.comparison.dimensionConvergenceMissing, 3);
    assert.equal(sha256(fs.readFileSync(dbPath)), dbHashBefore);
  });
});
