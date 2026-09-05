import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  analyzeCritiqueRevisionLinks,
  critiqueSpecificUptake,
} from '../services/communicationTopologyTraceAnalyzer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function makeLink(index, { count = 20, revisionMatches = true } = {}) {
  const token = `uniqueterm${index}`;
  return {
    checkId: `dialogue-${index}#check-1`,
    dialogueId: `dialogue-${index}`,
    runId: 'fixture-run',
    profileName: 'cell_22_base_suspicious_unified',
    scenarioId: 'fixture-scenario',
    egoModel: 'fixture-ego',
    superegoModel: 'fixture-superego',
    sourceTraceSha256: `hash-${index}`,
    ordinal: 1,
    requiresRevision: true,
    followupKind: 'immediate',
    immediateRevisionSignal: true,
    response: { traceIndex: 0, text: 'Give the answer directly.' },
    disciplinaryCheck: {
      traceIndex: 1,
      interventionType: 'revise',
      text: `Introduce ${token}.`,
    },
    nextEgo: {
      traceIndex: 2,
      action: 'revise',
      text: revisionMatches ? `Use ${token} in the response.` : `Use unrelated replacement${(index + 1) % count}.`,
    },
  };
}

describe('communication topology link statistics', () => {
  it('measures critique-specific additions rather than generic edit magnitude', () => {
    const result = critiqueSpecificUptake(
      'Give the answer directly.',
      'Introduce an evidential question.',
      'Ask an evidential question.',
    );
    assert.ok(result.score > 0);
    assert.deepEqual(result.matchedTokens, ['evidential', 'question']);

    const unrelated = critiqueSpecificUptake(
      'Give the answer directly.',
      'Add a warm greeting.',
      'Ask an evidential question.',
    );
    assert.equal(unrelated.score, 0);
  });

  it('detects uniquely paired lexical uptake against the broken-link null', () => {
    const links = Array.from({ length: 20 }, (_, index) => makeLink(index));
    const result = analyzeCritiqueRevisionLinks(links);

    assert.equal(result.eligibleLinks, 20);
    assert.equal(result.testableLinks, 20);
    assert.equal(result.positiveTestableLinks, 20);
    assert.deepEqual(result.outcomes, {
      lexical_association_detected: 20,
      not_detected: 0,
      indeterminate: 0,
    });
    assert.ok(result.rows.every((row) => row.nullComparatorCount === 19));
    assert.ok(result.rows.every((row) => row.empiricalP === 0.05));
    assert.ok(result.rows.every((row) => row.fdrQ === 0.05));
  });

  it('matches null critiques on deliberation ordinal', () => {
    const ordinalOne = Array.from({ length: 20 }, (_, index) => makeLink(index));
    const ordinalTwo = Array.from({ length: 20 }, (_, index) => ({
      ...makeLink(index + 20),
      dialogueId: `dialogue-${index}`,
      ordinal: 2,
    }));
    const result = analyzeCritiqueRevisionLinks([...ordinalOne, ...ordinalTwo]);
    assert.ok(result.rows.every((row) => row.nullComparatorCount === 19));
  });

  it('keeps a sufficient null result distinct from insufficient evidence', () => {
    const unmatched = Array.from({ length: 20 }, (_, index) => makeLink(index, { revisionMatches: false }));
    const nullResult = analyzeCritiqueRevisionLinks(unmatched);
    assert.equal(nullResult.outcomes.not_detected, 20);

    const tooSmall = analyzeCritiqueRevisionLinks(unmatched.slice(0, 2));
    assert.equal(tooSmall.outcomes.indeterminate, 2);
    assert.ok(tooSmall.rows.every((row) => row.empiricalP === null));
  });
});

describe('analyze-communication-topology-links CLI', () => {
  it('writes deterministic per-link evidence without mutating SQLite', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'communication-topology-'));
    try {
      const dbPath = path.join(tmp, 'evaluations.db');
      const logsDir = path.join(tmp, 'tutor-dialogues');
      const reportPath = path.join(tmp, 'report.md');
      fs.mkdirSync(logsDir);
      const db = new Database(dbPath);
      db.exec(`
        CREATE TABLE evaluation_results (
          id INTEGER PRIMARY KEY,
          run_id TEXT,
          profile_name TEXT,
          scenario_id TEXT,
          dialogue_id TEXT,
          ego_model TEXT,
          superego_model TEXT,
          judge_model TEXT,
          tutor_rubric_version TEXT,
          config_hash TEXT,
          dialogue_content_hash TEXT,
          incorporation_rate REAL,
          created_at TEXT,
          success INTEGER
        )
      `);
      const insert = db.prepare(
        `INSERT INTO evaluation_results
         (run_id, profile_name, scenario_id, dialogue_id, ego_model, superego_model,
          judge_model, tutor_rubric_version, created_at, success)
         VALUES ('fixture-run', 'cell_22_base_suspicious_unified', 'fixture-scenario', ?,
                 'fixture-ego', 'fixture-superego', 'fixture-judge', '2.2',
                 '2026-04-17T00:00:00.000Z', 1)`,
      );
      for (let index = 0; index < 20; index++) {
        const dialogueId = `dialogue-fixture-${index}`;
        insert.run(dialogueId);
        const trace = {
          dialogueId,
          dialogueTrace: [
            { agent: 'ego', action: 'generate', suggestions: [{ message: 'Give the answer directly.' }] },
            {
              agent: 'superego',
              action: 'review',
              approved: false,
              interventionType: 'revise',
              feedback: `Introduce uniqueterm${index}.`,
            },
            { agent: 'ego', action: 'revise', suggestions: [{ message: `Use uniqueterm${index} in the response.` }] },
          ],
        };
        fs.writeFileSync(path.join(logsDir, `${dialogueId}.json`), `${JSON.stringify(trace, null, 2)}\n`);
      }
      db.close();
      const before = crypto.createHash('sha256').update(fs.readFileSync(dbPath)).digest('hex');

      const stdout = execFileSync(
        process.execPath,
        [
          'scripts/analyze-communication-topology-links.js',
          '--db',
          dbPath,
          '--logs',
          logsDir,
          '--output',
          reportPath,
          '--json',
        ],
        { cwd: ROOT, encoding: 'utf8' },
      );

      assert.match(stdout, /Eligible links: 20/u);
      assert.match(stdout, /Detected: 20/u);
      const report = fs.readFileSync(reportPath, 'utf8');
      assert.match(report, /These are association results, not causal effects/u);
      const json = JSON.parse(fs.readFileSync(reportPath.replace(/\.md$/u, '.json'), 'utf8'));
      assert.equal(json.analysis.rows.length, 20);
      assert.ok(json.analysis.rows.every((row) => row.sourceTraceSha256));
      const after = crypto.createHash('sha256').update(fs.readFileSync(dbPath)).digest('hex');
      assert.equal(after, before);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
