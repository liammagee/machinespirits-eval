import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, it } from 'node:test';

import { createEvaluationScriptContext, withEvaluationScriptStore } from '../services/evaluationStore/scriptContext.js';
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
const OWNED_STORE_SCRIPTS = [
  'scripts/report-longitudinal-drift-stage-a2-live.js',
  'scripts/report-longitudinal-drift-stage-a3-live.js',
  'scripts/report-longitudinal-drift-stage-a4-live.js',
  'scripts/report-longitudinal-drift-stage-a5-live.js',
];
const OWNED_SCORE_SCRIPTS = [
  'scripts/evaluate-charisma.js',
  'scripts/evaluate-register-rubric.js',
  'scripts/evaluate-learner-standalone.js',
  'scripts/score-d4-first-turns.js',
];
const OWNED_RUN_SCRIPTS = [
  'scripts/run-adaptive-cell-smoke.js',
  'scripts/run-adaptive-persistence-smoke.js',
  'scripts/run-dialogue-engine-trap-baseline.js',
  'scripts/run-id-director-trap-pilot.js',
];
const OWNED_INGEST_SEED_SCRIPTS = ['scripts/ingest-pilot-sessions.js', 'scripts/seed-db.js'];
const OWNED_TOKEN_BUDGET_SCRIPTS = ['scripts/test-token-budget.js'];

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

  it('closes stores it creates after success and failure', async () => {
    for (const shouldThrow of [false, true]) {
      let closes = 0;
      const store = { close: () => (closes += 1) };
      const operation = async (receivedStore) => {
        assert.equal(receivedStore, store);
        if (shouldThrow) throw new Error('expected failure');
        return 'done';
      };
      const invocation = withEvaluationScriptStore(operation, {
        rootDir: ROOT_DIR,
        createStore: () => store,
      });

      if (shouldThrow) await assert.rejects(invocation, /expected failure/u);
      else assert.equal(await invocation, 'done');
      assert.equal(closes, 1);
    }
  });

  it('does not close a host-owned injected store', async () => {
    let closes = 0;
    const store = { close: () => (closes += 1) };

    const result = await withEvaluationScriptStore(async (receivedStore) => receivedStore, {
      evaluationStore: store,
    });

    assert.equal(result, store);
    assert.equal(closes, 0);
  });

  it('fails closed when no script operation is supplied', async () => {
    await assert.rejects(withEvaluationScriptStore(null), {
      name: 'TypeError',
      message: 'withEvaluationScriptStore requires an operation function',
    });
  });

  it('removes the legacy facade from every migrated operational script', () => {
    for (const relativePath of MIGRATED_SCRIPTS) {
      const source = fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
      assert.doesNotMatch(source, /from ['"]\.\.\/services\/evaluationStore\.js['"]/u, relativePath);
      assert.match(source, /createEvaluationScriptContext/u, relativePath);
      assert.match(source, /dialogueLogs\.loadDialogueLog/u, relativePath);
    }
  });

  it('gives each longitudinal live report an explicit, naturally closing store boundary', () => {
    for (const relativePath of OWNED_STORE_SCRIPTS) {
      const source = fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
      assert.doesNotMatch(source, /\.\.\/services\/evaluationStore\.js/u, relativePath);
      assert.match(source, /withEvaluationScriptStore/u, relativePath);
      assert.doesNotMatch(source, /process\.exit\(/u, relativePath);
    }
  });

  it('gives each operational scorer an explicit, naturally closing store boundary', () => {
    for (const relativePath of OWNED_SCORE_SCRIPTS) {
      const source = fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
      assert.doesNotMatch(source, /\.\.\/services\/evaluationStore\.js/u, relativePath);
      assert.match(source, /withEvaluationScriptStore/u, relativePath);
      assert.doesNotMatch(source, /process\.exit\(/u, relativePath);
    }
  });

  it('gives each operational run launcher an explicit, naturally closing store boundary', () => {
    for (const relativePath of OWNED_RUN_SCRIPTS) {
      const source = fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
      assert.doesNotMatch(source, /\.\.\/services\/evaluationStore\.js/u, relativePath);
      assert.match(source, /withEvaluationScriptStore/u, relativePath);
      assert.match(source, /export async function main/u, relativePath);
      assert.doesNotMatch(source, /process\.exit\(/u, relativePath);
    }
  });

  it('gives ingestion and seed-data scripts explicit, naturally closing store boundaries', () => {
    for (const relativePath of OWNED_INGEST_SEED_SCRIPTS) {
      const source = fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
      assert.doesNotMatch(source, /\.\.\/services\/evaluationStore\.js/u, relativePath);
      assert.match(source, /withEvaluationScriptStore/u, relativePath);
      assert.match(source, /export async function main/u, relativePath);
      assert.doesNotMatch(source, /process\.exit\(/u, relativePath);
    }
  });

  it('gives token-budget reporting an explicit, naturally closing store boundary', () => {
    for (const relativePath of OWNED_TOKEN_BUDGET_SCRIPTS) {
      const source = fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
      assert.doesNotMatch(source, /\.\.\/services\/evaluationStore\.js/u, relativePath);
      assert.match(source, /withEvaluationScriptStore/u, relativePath);
      assert.match(source, /export async function main/u, relativePath);
      assert.doesNotMatch(source, /process\.exit\(/u, relativePath);
    }
  });

  it('keeps token-budget help and failed-generation paths database-free', async () => {
    const { main } = await import('../scripts/test-token-budget.js');
    const messages = [];
    const logger = {
      log: (...values) => messages.push(values.join(' ')),
      warn: (...values) => messages.push(values.join(' ')),
      error: (...values) => messages.push(values.join(' ')),
    };
    let storesCreated = 0;
    const createStore = () => {
      storesCreated++;
      throw new Error('evaluation store should not open');
    };

    assert.equal(await main(['--help'], { createStore, logger }), 0);
    assert.match(messages.join('\n'), /--report-only/u);

    assert.equal(
      await main(['--levels', '256', '--runs', '1'], {
        createStore,
        execFile: () => {
          throw new Error('expected generation failure');
        },
        logger,
      }),
      0,
    );
    assert.equal(storesCreated, 0);
  });

  it('preserves token-budget run arguments and extracts completed run IDs without a parent store', async () => {
    const { parseTokenBudgetArgs, runAllLevels } = await import('../scripts/test-token-budget.js');
    const options = parseTokenBudgetArgs([
      '--model',
      'openrouter.test-model',
      '--levels',
      '256,1024',
      '--runs',
      '2',
      '--profiles',
      'cell_a,cell_b',
      '--parallelism',
      '3',
      '--skip-judge',
    ]);
    const calls = [];
    const runIds = await runAllLevels(options, {
      cliPath: '/repo/scripts/eval-cli.js',
      cwd: '/repo',
      env: { EVAL_DB_PATH: '/tmp/evaluations.db' },
      execFile: (executable, args, execOptions) => {
        calls.push({ executable, args, execOptions });
        return `Run ID: eval-2026-08-08-${calls.length === 1 ? 'aaa11111' : 'bbb22222'}`;
      },
      logger: { log() {}, warn() {}, error() {} },
    });

    assert.deepEqual(runIds, ['eval-2026-08-08-aaa11111', 'eval-2026-08-08-bbb22222']);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].executable, process.execPath);
    assert.deepEqual(calls[0].args, [
      '/repo/scripts/eval-cli.js',
      'run',
      '--profiles',
      'cell_a,cell_b',
      '--runs',
      '2',
      '--max-tokens',
      '256',
      '--model',
      'openrouter.test-model',
      '--parallelism',
      '3',
      '--description',
      'Token budget test: max_tokens=256',
      '--skip-rubric',
    ]);
    assert.equal(calls[0].execOptions.cwd, '/repo');
    assert.equal(calls[0].execOptions.env.EVAL_DB_PATH, '/tmp/evaluations.db');
  });

  it('builds token-budget reports from one injected store and closes only owned stores', async () => {
    const fixture = makeContext('token-budget-report');
    const outputDir = path.join(fixture.tempDir, 'exports');
    const rowsByRun = new Map([
      [
        'eval-low',
        [
          {
            hyperparameters: { max_tokens: 256 },
            profileName: 'cell_1_base_single_unified',
            tutorFirstTurnScore: 70,
            outputTokens: 250,
            apiCalls: 1,
          },
          {
            hyperparameters: { max_tokens: 256 },
            profileName: 'cell_5_recog_single_unified',
            tutorFirstTurnScore: 80,
            outputTokens: 100,
            apiCalls: 1,
          },
        ],
      ],
      [
        'eval-high',
        [
          {
            hyperparameters: JSON.stringify({ max_tokens: 1024 }),
            profile_name: 'cell_1_base_single_unified',
            tutor_first_turn_score: 90,
            output_tokens: 500,
            api_calls: 1,
          },
          {
            hyperparameters: JSON.stringify({ max_tokens: 1024 }),
            profile_name: 'cell_5_recog_single_unified',
            tutor_first_turn_score: 92,
            output_tokens: 1000,
            api_calls: 1,
          },
        ],
      ],
    ]);
    let closes = 0;
    const store = {
      getResults: (runId) => rowsByRun.get(runId) ?? [],
      close: () => {
        closes++;
      },
    };
    const logger = { log() {}, warn() {}, error() {} };
    const { main } = await import('../scripts/test-token-budget.js');
    const args = ['--report-only', 'eval-low,eval-high', '--model', 'openrouter.test-model', '--runs', '2'];
    const now = () => new Date('2026-08-08T00:00:00.000Z');

    assert.equal(await main(args, { evaluationStore: store, outputDir, now, logger }), 0);
    assert.equal(closes, 0);

    const outputPath = path.join(outputDir, 'token-budget-sensitivity-2026-08-08T00-00-00.md');
    const report = fs.readFileSync(outputPath, 'utf8');
    assert.match(report, /\*\*Model:\*\* test-model/u);
    assert.match(report, /\*\*Run IDs:\*\* eval-low, eval-high/u);
    assert.match(report, /\| 256 \| cell_1_base_single_unified \| 1 \| 70\.0 \| 0\.0 \| 100% \|/u);
    assert.match(report, /\| 1024 \| cell_5_recog_single_unified \| 1 \| 92\.0 \| 0\.0 \| 100% \|/u);

    assert.equal(await main(args, { createStore: () => store, outputDir, now, logger }), 0);
    assert.equal(closes, 1);

    let failureCloses = 0;
    const failingStore = {
      getResults: () => {
        throw new Error('expected report read failure');
      },
      close: () => {
        failureCloses++;
      },
    };
    await assert.rejects(main(args, { createStore: () => failingStore, outputDir, now, logger }), {
      message: 'expected report read failure',
    });
    assert.equal(failureCloses, 1);
  });

  it('keeps help and empty pilot-ingestion paths database-free', async () => {
    const { main } = await import('../scripts/ingest-pilot-sessions.js');
    let storesCreated = 0;
    const createStore = () => {
      storesCreated++;
      throw new Error('evaluation store should not open');
    };

    assert.equal(await main(['--help'], { createStore }), 0);
    assert.equal(
      await main([], {
        createStore,
        pilotStore: { listSessions: () => [] },
      }),
      0,
    );
    assert.equal(storesCreated, 0);
  });

  it('leaves injected ingest and seed stores open on bounded early returns', async () => {
    const ingestStore = {
      database: { prepare: () => ({ get: () => ({ run_id: 'existing-run' }) }) },
      close: () => {
        throw new Error('host-owned ingest store must remain open');
      },
    };
    const pilotStore = {
      listSessions: () => [{ id: 'pilot-1' }],
    };
    const { main: ingest } = await import('../scripts/ingest-pilot-sessions.js');
    assert.equal(await ingest([], { evaluationStore: ingestStore, pilotStore }), 0);

    const seedStore = {
      getRun: () => ({ id: 'seed-sample-factorial' }),
      close: () => {
        throw new Error('host-owned seed store must remain open');
      },
    };
    const { main: seed } = await import('../scripts/seed-db.js');
    assert.equal(await seed([], { evaluationStore: seedStore }), 0);
  });

  it('closes ingest and seed stores created for bounded early returns', async () => {
    let ingestCloses = 0;
    const ingestStore = {
      database: { prepare: () => ({ get: () => ({ run_id: 'existing-run' }) }) },
      close: () => {
        ingestCloses++;
      },
    };
    const { main: ingest } = await import('../scripts/ingest-pilot-sessions.js');
    assert.equal(
      await ingest([], {
        createStore: () => ingestStore,
        pilotStore: { listSessions: () => [{ id: 'pilot-1' }] },
      }),
      0,
    );
    assert.equal(ingestCloses, 1);

    let seedCloses = 0;
    const seedStore = {
      getRun: () => ({ id: 'seed-sample-factorial' }),
      close: () => {
        seedCloses++;
      },
    };
    const { main: seed } = await import('../scripts/seed-db.js');
    assert.equal(await seed([], { createStore: () => seedStore }), 0);
    assert.equal(seedCloses, 1);
  });

  it('ingests a pilot transcript into one isolated store and matching logs root', async () => {
    const fixture = makeContext('pilot-ingest');
    const env = {
      ...process.env,
      EVAL_DB_PATH: fixture.databasePath,
      EVAL_LOGS_DIR: fixture.logsRoot,
      MS_DATA_HOME: path.join(fixture.tempDir, 'data-home'),
    };
    const store = createEvaluationStore({ rootDir: ROOT_DIR, env });
    const session = {
      id: 'pilot-ingest-1',
      condition_cell: 'cell_1_base_single_unified',
      scenario_lecture_ref: '101-lecture-1',
      participant_pid_hash: 'participant-hash',
      tutoring_started_at: 1,
      tutoring_completed_at: 2,
      total_tutoring_ms: 1,
    };
    const turns = [
      { role: 'learner', content: 'I am unsure about equivalent fractions.' },
      {
        role: 'tutor',
        content: 'Let us compare the numerator and denominator changes.',
        latency_ms: 10,
        input_tokens: 20,
        output_tokens: 10,
      },
    ];
    const pilotStore = {
      listSessions: () => [session],
      listTurns: () => turns,
    };
    const { main } = await import('../scripts/ingest-pilot-sessions.js');

    try {
      assert.equal(
        await main([], {
          evaluationStore: store,
          pilotStore,
          env,
          rootDir: ROOT_DIR,
          now: () => new Date('2026-08-08T00:00:00.000Z'),
        }),
        0,
      );
      const runs = store.listRuns();
      assert.equal(runs.length, 1);
      assert.equal(runs[0].status, 'completed');
      const rows = store.getResults(runs[0].id);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].learnerId, session.id);
      assert.equal(rows[0].learnerArchitecture, 'human_pilot');
      assert.equal(store.isOpen, true);
      assert.equal(fs.existsSync(path.join(fixture.logsRoot, 'tutor-dialogues', `pilot-${session.id}.json`)), true);
    } finally {
      store.close();
    }
  });

  it('persists the eight-row seed dataset in an isolated CLI database', () => {
    const fixture = makeContext('seed-cli');
    const env = {
      ...process.env,
      EVAL_DB_PATH: fixture.databasePath,
      EVAL_LOGS_DIR: fixture.logsRoot,
      MS_DATA_HOME: path.join(fixture.tempDir, 'data-home'),
    };
    const result = spawnSync(process.execPath, ['scripts/seed-db.js'], {
      cwd: ROOT_DIR,
      env,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /8 factorial cells, 1 scenario each/u);

    const store = createEvaluationStore({ rootDir: ROOT_DIR, env });
    try {
      const runs = store.listRuns();
      assert.equal(runs.length, 1);
      assert.equal(runs[0].status, 'completed');
      assert.equal(runs[0].totalTests, 8);
      const rows = store.getResults(runs[0].id);
      assert.equal(rows.length, 8);
      assert.equal(new Set(rows.map((row) => row.profileName)).size, 8);
    } finally {
      store.close();
    }
  });

  it('rejects longitudinal usage and empty score requests before opening a database', () => {
    const cases = OWNED_STORE_SCRIPTS.flatMap((relativePath) => [
      { relativePath, args: [], expectedStatus: 1, stderrPattern: /Usage:/u },
      { relativePath, args: ['--score'], expectedStatus: 1, stderrPattern: /No .* triples supplied/u },
    ]);

    for (const { relativePath, args, expectedStatus, stderrPattern } of cases) {
      const fixture = makeContext(`${path.basename(relativePath, '.js')}-${args.length}`);
      const result = spawnSync(process.execPath, [relativePath, ...args], {
        cwd: ROOT_DIR,
        env: {
          ...process.env,
          EVAL_DB_PATH: fixture.databasePath,
          EVAL_LOGS_DIR: fixture.logsRoot,
          MS_DATA_HOME: path.join(fixture.tempDir, 'data-home'),
        },
        encoding: 'utf8',
      });
      assert.equal(result.status, expectedStatus, result.stderr);
      assert.match(result.stderr, stderrPattern, relativePath);
      assert.equal(fs.existsSync(fixture.databasePath), false, relativePath);
    }
  });

  it('rejects operational-scoring usage before opening a database', () => {
    for (const relativePath of OWNED_SCORE_SCRIPTS) {
      const fixture = makeContext(`${path.basename(relativePath, '.js')}-usage`);
      const result = spawnSync(process.execPath, [relativePath], {
        cwd: ROOT_DIR,
        env: {
          ...process.env,
          EVAL_DB_PATH: fixture.databasePath,
          EVAL_LOGS_DIR: fixture.logsRoot,
          MS_DATA_HOME: path.join(fixture.tempDir, 'data-home'),
        },
        encoding: 'utf8',
      });
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /Usage:/u, relativePath);
      assert.equal(fs.existsSync(fixture.databasePath), false, relativePath);
    }
  });

  it('rejects invalid trap-launcher profiles before opening a database or calling a model', () => {
    for (const relativePath of [
      'scripts/run-dialogue-engine-trap-baseline.js',
      'scripts/run-id-director-trap-pilot.js',
    ]) {
      const fixture = makeContext(`${path.basename(relativePath, '.js')}-invalid-profile`);
      const result = spawnSync(process.execPath, [relativePath, '--profile=missing-profile'], {
        cwd: ROOT_DIR,
        env: {
          ...process.env,
          EVAL_DB_PATH: fixture.databasePath,
          EVAL_LOGS_DIR: fixture.logsRoot,
          MS_DATA_HOME: path.join(fixture.tempDir, 'data-home'),
          ANTHROPIC_API_KEY: '',
          OPENAI_API_KEY: '',
          OPENROUTER_API_KEY: '',
        },
        encoding: 'utf8',
      });
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /profile missing-profile not found/u, relativePath);
      assert.equal(fs.existsSync(fixture.databasePath), false, relativePath);
    }
  });

  it('runs deterministic empty-run scorer paths against an isolated database without model calls', () => {
    const fixture = makeContext('score-cli');
    const env = {
      ...process.env,
      EVAL_DB_PATH: fixture.databasePath,
      EVAL_LOGS_DIR: fixture.logsRoot,
      MS_DATA_HOME: path.join(fixture.tempDir, 'data-home'),
      ANTHROPIC_API_KEY: '',
      OPENAI_API_KEY: '',
      OPENROUTER_API_KEY: '',
    };
    const store = createEvaluationStore({ rootDir: ROOT_DIR, env });
    store.close();

    const cases = [
      ['scripts/evaluate-charisma.js', ['missing-run'], 1, /No results for run/u],
      ['scripts/evaluate-register-rubric.js', ['missing-run', '--check'], 0, /Rows: 0/u],
      ['scripts/evaluate-learner-standalone.js', ['missing-run'], 1, /No dialogue results found/u],
      ['scripts/score-d4-first-turns.js', ['missing-run'], 1, /Run not found/u],
    ];

    for (const [relativePath, args, expectedStatus, outputPattern] of cases) {
      const result = spawnSync(process.execPath, [relativePath, ...args], {
        cwd: ROOT_DIR,
        env,
        encoding: 'utf8',
      });
      assert.equal(result.status, expectedStatus, `${relativePath}\n${result.stderr}`);
      assert.match(`${result.stdout}\n${result.stderr}`, outputPattern, relativePath);
    }
  });

  it('leaves injected scorer stores open on deterministic no-row paths', async () => {
    const cases = [
      ['../scripts/evaluate-charisma.js', ['missing-run'], { getResults: () => [] }, 1],
      ['../scripts/evaluate-register-rubric.js', ['missing-run', '--check'], { getResults: () => [] }, 0],
      ['../scripts/evaluate-learner-standalone.js', ['missing-run'], { getResults: () => [] }, 1],
      ['../scripts/score-d4-first-turns.js', ['missing-run'], { getRun: () => null }, 1],
    ];

    for (const [modulePath, args, methods, expectedCode] of cases) {
      let closes = 0;
      const injectedStore = { ...methods, close: () => (closes += 1) };
      const { main } = await import(modulePath);
      const code = await main(args, { evaluationStore: injectedStore, rootDir: ROOT_DIR });
      assert.equal(code, expectedCode, modulePath);
      assert.equal(closes, 0, modulePath);
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
