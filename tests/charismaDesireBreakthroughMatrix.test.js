import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'report-charisma-desire-breakthrough-matrix.js');

describe('charisma desire resistance-breakthrough matrix', () => {
  it('validates the controlled resistance-signal scenario grid', async () => {
    const { stdout } = await exec('node', [SCRIPT, '--check'], {
      timeout: 15000,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });

    assert.match(stdout, /Scenario set: charisma_desire_resistance_breakthrough_controlled/);
    assert.match(stdout, /Controlled scenarios: 5/);
    assert.match(stdout, /cell_188_id_director_charisma_resistance_owned_test_breakthrough_dynamic_verified/);
    assert.match(stdout, /cell_189_id_director_charisma_resistance_precision_breakthrough_dynamic_verified/);
    assert.match(stdout, /cell_190_id_director_charisma_resistance_generation_breakthrough_dynamic_verified/);
    assert.match(stdout, /cell_191_id_director_charisma_resistance_question_lock_breakthrough_dynamic_verified/);
    assert.match(stdout, /cell_192_id_director_charisma_resistance_commitment_probe_breakthrough_dynamic_verified/);
    assert.match(stdout, /cell_193_id_director_charisma_resistance_boredom_stake_breakthrough_dynamic_verified/);
    assert.match(stdout, /cell_194_id_director_charisma_resistance_glm_compact_breakthrough_dynamic_verified/);
    assert.match(stdout, /Question-flood gate: /);
    assert.match(stdout, /Status: (READY_NO_ROWS|ANALYZED_ROWS)/);
  });

  it('honors explicit DB and logs path overrides in fresh worktrees', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'charisma-matrix-paths-'));
    const dbPath = path.join(tmpDir, 'evaluations.db');
    const logsRoot = path.join(tmpDir, 'logs');
    const dialogueDir = path.join(logsRoot, 'tutor-dialogues');
    fs.mkdirSync(dialogueDir, { recursive: true });

    const dialogueId = 'dlg-path-override';
    fs.writeFileSync(
      path.join(dialogueDir, `${dialogueId}.json`),
      JSON.stringify(
        {
          learnerArchitecture: 'ego_superego',
          turnResults: [
            { turnIndex: 0, learnerMessage: 'Start.' },
            {
              turnIndex: 1,
              learnerMessage: 'This is dead and boring.',
              learnerMessageGenerated: true,
            },
            {
              turnIndex: 2,
              learnerMessage: 'Okay, now I can test the recognition passage with a concrete example.',
              learnerMessageGenerated: true,
            },
          ],
        },
        null,
        2,
      ),
    );

    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE evaluation_runs (
        id TEXT PRIMARY KEY,
        description TEXT,
        total_tests INTEGER,
        status TEXT
      );
      CREATE TABLE evaluation_results (
        id TEXT,
        run_id TEXT,
        scenario_id TEXT,
        profile_name TEXT,
        dialogue_id TEXT,
        suggestions TEXT,
        id_construction_trace TEXT,
        tutor_scores TEXT,
        dialogue_content_hash TEXT,
        success INTEGER,
        judge_model TEXT
      )
    `);
    db.prepare(
      `INSERT INTO evaluation_runs
       (id, description, total_tests, status)
       VALUES (?, ?, ?, ?)`,
    ).run(
      'eval-path-override',
      'Charisma desire role isolation: baseline_codex_tutor_codex_learner guarded',
      10,
      'completed',
    );
    db.prepare(
      `INSERT INTO evaluation_results
       (id, run_id, scenario_id, profile_name, dialogue_id, suggestions, id_construction_trace, tutor_scores, dialogue_content_hash, success, judge_model)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'row-path-override',
      'eval-path-override',
      'charisma_desire_resistance_breakthrough_boredom',
      'cell_193_id_director_charisma_resistance_boredom_stake_breakthrough_dynamic_verified',
      dialogueId,
      '[]',
      JSON.stringify([
        {
          turn: 1,
          engagementState: {
            selected_register: 'charismatic_challenge',
            resistance_signal: 'boredom',
            resistance_strategy: 'live_stake',
          },
        },
      ]),
      '{}',
      null,
      1,
      null,
    );
    db.close();

    try {
      const { stdout } = await exec('node', [SCRIPT, '--runs', 'eval-path-override', '--check'], {
        timeout: 15000,
        env: {
          ...process.env,
          NODE_NO_WARNINGS: '1',
          EVAL_DB_PATH: dbPath,
          EVAL_LOGS_DIR: logsRoot,
        },
      });

      assert.match(stdout, /Status: ANALYZED_ROWS/);
      assert.match(stdout, /Rows found: 1/);
      assert.match(stdout, /Positive local outcomes: 1/);
      assert.match(stdout, /Role-isolation arms: 1\/6/);
      assert.match(stdout, /Role-isolation diagnosis: INCOMPLETE_ROLE_ISOLATION_GRID/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('counts ordinary provisional hold language as question-flood commitment', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'charisma-qf-commitment-'));
    const dbPath = path.join(tmpDir, 'evaluations.db');
    const logsRoot = path.join(tmpDir, 'logs');
    const dialogueDir = path.join(logsRoot, 'tutor-dialogues');
    fs.mkdirSync(dialogueDir, { recursive: true });

    const profiles = {
      owned: 'cell_188_id_director_charisma_resistance_owned_test_breakthrough_dynamic_verified',
      probe: 'cell_192_id_director_charisma_resistance_commitment_probe_breakthrough_dynamic_verified',
    };
    const rows = [
      {
        id: 'owned-1',
        profile: profiles.owned,
        post: 'My answer is hold: the passage decides it because paragraph 196 gives the servant a durable object and a failure test.',
      },
      {
        id: 'owned-2',
        profile: profiles.owned,
        post: 'The hinge is hold because the deciding phrase is durable work; I would reopen it if the line only shaped the object.',
      },
      {
        id: 'probe-1',
        profile: profiles.probe,
        post: "Okay, I'll make the commitment provisionally: I'd hold the claim. The warrant is the phrase being-for-itself becomes his own.",
      },
      {
        id: 'probe-2',
        profile: profiles.probe,
        post: "I'll tentatively hold it: durable existence marks the difference, but I would reopen it if forming names only the object.",
      },
    ];

    for (const row of rows) {
      fs.writeFileSync(
        path.join(dialogueDir, `${row.id}.json`),
        JSON.stringify(
          {
            learnerArchitecture: 'ego_superego',
            turnResults: [
              { turnIndex: 0, learnerMessage: 'Start.' },
              {
                turnIndex: 1,
                learnerMessage: 'Why this paragraph? Why this phrase? What does it prove?',
                learnerMessageGenerated: true,
                learnerResistanceSignalGate: { matched: true, observedSignal: 'question_flood', attempts: [{}] },
              },
              {
                turnIndex: 2,
                learnerMessage: row.post,
                learnerMessageGenerated: true,
              },
            ],
          },
          null,
          2,
        ),
      );
    }

    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE evaluation_runs (
        id TEXT PRIMARY KEY,
        description TEXT,
        total_tests INTEGER,
        status TEXT
      );
      CREATE TABLE evaluation_results (
        id TEXT,
        run_id TEXT,
        scenario_id TEXT,
        profile_name TEXT,
        dialogue_id TEXT,
        suggestions TEXT,
        id_construction_trace TEXT,
        tutor_scores TEXT,
        dialogue_content_hash TEXT,
        success INTEGER,
        judge_model TEXT
      )
    `);
    db.prepare(
      `INSERT INTO evaluation_runs
       (id, description, total_tests, status)
       VALUES (?, ?, ?, ?)`,
    ).run('eval-qf-commitment', 'Question-flood commitment fixture', rows.length, 'completed');
    const insert = db.prepare(
      `INSERT INTO evaluation_results
       (id, run_id, scenario_id, profile_name, dialogue_id, suggestions, id_construction_trace, tutor_scores, dialogue_content_hash, success, judge_model)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const row of rows) {
      insert.run(
        row.id,
        'eval-qf-commitment',
        'charisma_desire_resistance_breakthrough_question_flood',
        row.profile,
        row.id,
        '[]',
        JSON.stringify([
          {
            turn: 1,
            engagementState: {
              selected_register: 'charismatic_challenge',
              resistance_signal: 'question_flood',
              resistance_strategy: 'question_collapse',
            },
          },
        ]),
        '{}',
        null,
        1,
        null,
      );
    }
    db.close();

    try {
      const { stdout } = await exec('node', [SCRIPT, '--runs', 'eval-qf-commitment', '--check'], {
        timeout: 15000,
        env: {
          ...process.env,
          NODE_NO_WARNINGS: '1',
          EVAL_DB_PATH: dbPath,
          EVAL_LOGS_DIR: logsRoot,
        },
      });

      assert.match(stdout, /Rows found: 4/);
      assert.match(stdout, /Question-flood gate: PROMOTE_COMMITMENT_PROBE_FOR_QUESTION_FLOOD/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
