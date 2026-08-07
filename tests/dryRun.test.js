/**
 * Dry-run mode tests — verifies that --dry-run produces valid results
 * through the full pipeline without any API calls or API keys.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'path';
import { fileURLToPath } from 'url';

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(__dirname, '..', 'scripts', 'eval-cli.js');
const EMPTY_ENV_FILE = path.resolve(__dirname, 'fixtures', 'empty.env');
const DOTENV_PROBE = path.resolve(__dirname, 'fixtures', 'dotenv-probe.js');

/**
 * Vars that hand the child a live credential, or decide which provider it
 * would talk to. Dropped from the child's environment so the CLI sees the
 * same nothing on a developer box as it does in CI.
 */
const PROVIDER_ENV_VARS = [
  'OPENROUTER_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_API_KEY',
  'GROQ_API_KEY',
  'LEMONFOX_API_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'DEFAULT_AI_PROVIDER',
  'OPENROUTER_MODEL',
  'ANTHROPIC_MODEL',
  'OPENAI_MODEL',
  'GOOGLE_MODEL',
  'GEMINI_MODEL',
  'GROQ_MODEL',
];

/**
 * Build the environment for a CLI child that must run with no keys at all.
 *
 * Two ways a key reaches the child, and both are closed here:
 *
 * 1. The repo's own .env. scripts/eval-cli.js imports `dotenv/config`, which
 *    reads <cwd>/.env unless DOTENV_CONFIG_PATH says otherwise. Pointing it
 *    at an empty file neutralises the whole file, whatever it declares — so
 *    these tests no longer pass or fail on whether a .env happens to exist.
 * 2. The shell that started the test run. Those vars are deleted outright.
 *    Deleting is safe now that dotenv is looking elsewhere, and it models a
 *    missing key better than a blank one for any check that asks whether the
 *    name is present rather than whether it is truthy.
 *
 * @param {Record<string, string>} [extra] vars to put back, applied last
 * @param {Record<string, string>} [source] env to start from, for tests
 */
function buildChildEnv(extra = {}, source = process.env) {
  const env = {
    ...source,
    NODE_NO_WARNINGS: '1',
    DOTENV_CONFIG_PATH: EMPTY_ENV_FILE,
  };
  for (const name of PROVIDER_ENV_VARS) delete env[name];
  return { ...env, ...extra };
}

/**
 * Run the CLI with given args, with no API keys in reach.
 *
 * @param {string[]} args CLI arguments
 * @param {object} [options]
 * @param {number} [options.timeoutMs] kill the child after this long
 * @param {boolean} [options.closeStdin] send EOF, for commands that prompt
 * @param {Record<string, string>} [options.env] extra env for the child
 */
async function runCli(args = [], { timeoutMs = 30000, closeStdin = false, env = {} } = {}) {
  try {
    const pending = exec('node', [CLI, ...args], {
      timeout: timeoutMs,
      env: buildChildEnv(env),
    });
    // Without EOF an interactive command sits on the pipe until the timeout.
    if (closeStdin) pending.child.stdin.end();
    const { stdout, stderr } = await pending;
    return { stdout, stderr, code: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      code: err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? 'buffer' : (err.status ?? 1),
    };
  }
}

// ---------------------------------------------------------------------------
// Unit tests for mockProvider
// ---------------------------------------------------------------------------

describe('mockProvider', () => {
  let mockProvider;

  it('loads mockProvider module', async () => {
    mockProvider = await import('../services/mockProvider.js');
    assert.ok(mockProvider.mockGenerateResult, 'should export mockGenerateResult');
    assert.ok(mockProvider.mockJudgeResult, 'should export mockJudgeResult');
  });

  it('mockGenerateResult returns valid structure', async () => {
    if (!mockProvider) mockProvider = await import('../services/mockProvider.js');
    const result = mockProvider.mockGenerateResult({ profileName: 'budget' }, { scenarioName: 'test scenario' });
    assert.strictEqual(result.success, true);
    assert.ok(Array.isArray(result.suggestions), 'suggestions should be array');
    assert.ok(result.suggestions.length > 0, 'should have at least one suggestion');
    assert.ok(result.suggestions[0].title, 'suggestion should have title');
    assert.ok(result.suggestions[0].message, 'suggestion should have message');
    assert.ok(result.metadata, 'should have metadata');
    assert.strictEqual(result.metadata.totalCost, 0, 'cost should be 0');
  });

  it('mockGenerateResult varies content by recognition mode', async () => {
    if (!mockProvider) mockProvider = await import('../services/mockProvider.js');
    const base = mockProvider.mockGenerateResult({ profileName: 'budget' }, { scenarioName: 'test' });
    const recog = mockProvider.mockGenerateResult({ profileName: 'recognition' }, { scenarioName: 'test' });
    assert.notStrictEqual(
      base.suggestions[0].title,
      recog.suggestions[0].title,
      'recognition and base should have different titles',
    );
  });

  it('mockJudgeResult scores recognition higher than base', async () => {
    if (!mockProvider) mockProvider = await import('../services/mockProvider.js');
    const baseResult = mockProvider.mockJudgeResult({ profileName: 'budget' }, 'seed1');
    const recogResult = mockProvider.mockJudgeResult({ profileName: 'recognition' }, 'seed1');

    assert.ok(baseResult.success, 'base result should succeed');
    assert.ok(recogResult.success, 'recog result should succeed');
    assert.ok(typeof baseResult.overallScore === 'number', 'base should have numeric score');
    assert.ok(typeof recogResult.overallScore === 'number', 'recog should have numeric score');
    assert.ok(
      recogResult.overallScore > baseResult.overallScore,
      `recognition (${recogResult.overallScore}) should score higher than base (${baseResult.overallScore})`,
    );
  });

  it('mockJudgeResult orders recognition above base for every seed', async () => {
    if (!mockProvider) mockProvider = await import('../services/mockProvider.js');
    // Deterministic seed battery: runner-style seeds (scenarioId:scenarioName),
    // legacy timestamp-suffixed seeds, degenerate strings, and a generated sweep.
    const seeds = [
      '',
      'stuck_student:Stuck Student',
      'stuck_student:Stuck Student - Turn 3',
      'scenario_confused_learner1719268412345',
      'a',
      'The quick brown fox jumps over the lazy dog',
      ...Array.from({ length: 100 }, (_, i) => `seed_${i}`),
    ];
    // Raw eval-cell names AND the tutor-core names they remap to — the CLI
    // dry-run path passes the remapped names (resolveEvalProfile).
    const pairs = [
      ['budget', 'recognition'],
      ['cell_1_base_single_unified', 'cell_5_recog_single_unified'],
    ];
    for (const [baseName, recogName] of pairs) {
      for (const seed of seeds) {
        const base = mockProvider.mockJudgeResult({ profileName: baseName }, seed);
        const recog = mockProvider.mockJudgeResult({ profileName: recogName }, seed);
        assert.ok(
          recog.overallScore > base.overallScore,
          `seed "${seed}": ${recogName} (${recog.overallScore}) should beat ${baseName} (${base.overallScore})`,
        );
      }
    }
  });

  it('mockJudgeResult has all 6 dimensions', async () => {
    if (!mockProvider) mockProvider = await import('../services/mockProvider.js');
    const result = mockProvider.mockJudgeResult({ profileName: 'budget' });
    const dims = Object.keys(result.scores);
    assert.ok(dims.includes('relevance'), 'should have relevance');
    assert.ok(dims.includes('specificity'), 'should have specificity');
    assert.ok(dims.includes('pedagogical'), 'should have pedagogical');
    assert.ok(dims.includes('personalization'), 'should have personalization');
    assert.ok(dims.includes('actionability'), 'should have actionability');
    assert.ok(dims.includes('tone'), 'should have tone');
    assert.strictEqual(dims.length, 6, 'should have exactly 6 dimensions');
  });

  it('mockJudgeResult is deterministic with same seed', async () => {
    if (!mockProvider) mockProvider = await import('../services/mockProvider.js');
    const r1 = mockProvider.mockJudgeResult({ profileName: 'budget' }, 'same_seed');
    const r2 = mockProvider.mockJudgeResult({ profileName: 'budget' }, 'same_seed');
    assert.strictEqual(r1.overallScore, r2.overallScore, 'same seed should produce same score');
  });
});

// ---------------------------------------------------------------------------
// The harness itself — every case below leans on this being true
// ---------------------------------------------------------------------------

describe('keyless CLI harness', () => {
  it('keeps a .env on disk out of the child', async () => {
    // Plant a .env in a temp directory and run the probe from there, rather
    // than writing one at the repo root, where it would overwrite whatever a
    // developer keeps for paid runs. The probe file still resolves dotenv
    // from the repo, because module lookup follows the file, not the cwd.
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dryrun-env-'));
    try {
      await fs.writeFile(
        path.join(dir, '.env'),
        'OPENROUTER_API_KEY=sentinel-from-dotenv\nDEFAULT_AI_PROVIDER=sentinel-provider\n',
      );

      const isolated = await exec('node', [DOTENV_PROBE], { cwd: dir, env: buildChildEnv() });
      const seen = JSON.parse(isolated.stdout);
      assert.strictEqual(seen.OPENROUTER_API_KEY, null, 'child should read no key from a .env');
      assert.strictEqual(seen.DEFAULT_AI_PROVIDER, null, 'child should read no provider from a .env');

      // Control: without the DOTENV_CONFIG_PATH redirect the sentinel gets
      // through, so a regression fails here instead of passing on a machine
      // that simply has no .env.
      const leaky = { ...process.env, NODE_NO_WARNINGS: '1' };
      delete leaky.OPENROUTER_API_KEY;
      delete leaky.DEFAULT_AI_PROVIDER;
      const unguarded = await exec('node', [DOTENV_PROBE], { cwd: dir, env: leaky });
      assert.strictEqual(
        JSON.parse(unguarded.stdout).OPENROUTER_API_KEY,
        'sentinel-from-dotenv',
        'control: deleting the var alone lets dotenv refill it, which is the bug being guarded',
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps an exported shell key out of the child', async () => {
    // The other route in: a developer who exported a key for a paid run and
    // then ran the tests in the same shell.
    const exported = {
      ...process.env,
      OPENROUTER_API_KEY: 'sentinel-from-shell',
      DEFAULT_AI_PROVIDER: 'sentinel-provider',
    };
    const { stdout } = await exec('node', [DOTENV_PROBE], {
      cwd: __dirname,
      env: buildChildEnv({}, exported),
    });
    const seen = JSON.parse(stdout);
    assert.strictEqual(seen.OPENROUTER_API_KEY, null, 'exported key should not reach the child');
    assert.strictEqual(seen.DEFAULT_AI_PROVIDER, null, 'exported provider should not reach the child');
  });

  it('still lets a test hand the child a key on purpose', async () => {
    // The chat-with-a-key case depends on this: the scrub must not outrank
    // what a caller passes in.
    const { stdout } = await exec('node', [DOTENV_PROBE], {
      cwd: __dirname,
      env: buildChildEnv({ OPENROUTER_API_KEY: 'test-key-never-sent' }),
    });
    assert.strictEqual(JSON.parse(stdout).OPENROUTER_API_KEY, 'test-key-never-sent');
  });
});

// ---------------------------------------------------------------------------
// CLI integration tests (no API keys needed)
// ---------------------------------------------------------------------------

describe('eval-cli --dry-run', () => {
  it('quick --dry-run succeeds without API keys', async () => {
    const { stdout, stderr, code } = await runCli(['quick', '--dry-run']);
    assert.strictEqual(code, 0, `should exit 0, stderr: ${stderr}`);
    assert.ok(stdout.includes('dry-run'), 'output should mention dry-run');
    // Should contain a JSON result with tutorFirstTurnScore
    assert.ok(stdout.includes('tutorFirstTurnScore'), 'should include tutorFirstTurnScore in output');
  });

  it('quick --dry-run result has valid structure', async () => {
    const { stdout, code } = await runCli(['quick', '--dry-run']);
    assert.strictEqual(code, 0);
    // Extract JSON from output (after "Result:" line)
    const jsonMatch = stdout.match(/Result:\s*\n([\s\S]+)/);
    assert.ok(jsonMatch, 'should have Result: section');
    const result = JSON.parse(jsonMatch[1]);
    assert.strictEqual(result.success, true, 'result should be success');
    assert.ok(result.suggestions?.length > 0, 'should have suggestions');
    assert.ok(typeof result.tutorFirstTurnScore === 'number', 'tutorFirstTurnScore should be number');
    assert.ok(result.scores, 'should have dimension scores');
    assert.strictEqual(result.judgeModel, 'dry-run/mock-judge-v1', 'judge model should be dry-run');
  });

  it('quick --dry-run with recognition profile scores higher, reproducibly', async () => {
    const [baseRun, baseRerun, recogRun] = await Promise.all([
      runCli(['quick', '--dry-run', '--profile', 'cell_1_base_single_unified']),
      runCli(['quick', '--dry-run', '--profile', 'cell_1_base_single_unified']),
      runCli(['quick', '--dry-run', '--profile', 'cell_5_recog_single_unified']),
    ]);
    assert.strictEqual(baseRun.code, 0, 'base should succeed');
    assert.strictEqual(baseRerun.code, 0, 'base rerun should succeed');
    assert.strictEqual(recogRun.code, 0, 'recog should succeed');

    const baseJson = JSON.parse(baseRun.stdout.match(/Result:\s*\n([\s\S]+)/)[1]);
    const baseRerunJson = JSON.parse(baseRerun.stdout.match(/Result:\s*\n([\s\S]+)/)[1]);
    const recogJson = JSON.parse(recogRun.stdout.match(/Result:\s*\n([\s\S]+)/)[1]);

    // Mock scoring is seeded by stable identifiers only — identical invocations
    // must score identically (guards against per-invocation entropy like
    // Date.now() sneaking back into the seed).
    assert.strictEqual(
      baseRerunJson.tutorFirstTurnScore,
      baseJson.tutorFirstTurnScore,
      'same profile + scenario should score identically across invocations',
    );

    assert.ok(
      recogJson.tutorFirstTurnScore > baseJson.tutorFirstTurnScore,
      `recognition (${recogJson.tutorFirstTurnScore}) should score higher than base (${baseJson.tutorFirstTurnScore})`,
    );
  });

  it('run --dry-run completes one selected scenario without API keys', async () => {
    const { stdout, stderr, code } = await runCli([
      'run',
      '--dry-run',
      '--profile',
      'budget',
      '--scenario',
      'new_user_first_visit',
      '--runs',
      '1',
    ]);
    assert.strictEqual(code, 0, `should exit 0, stderr: ${stderr}`);
    assert.ok(stdout.includes('EVALUATION COMPLETE'), 'should finish the evaluation');
    assert.ok(stdout.includes('"totalTests": 1'), 'should run exactly one test');
    assert.ok(stdout.includes('"failedTests": 0'), 'should complete without failures');
  });

  it('chat fails cleanly without an OpenRouter API key', async () => {
    // chat talks to one endpoint only (OpenRouter completions), whatever judge
    // model resolves, so with no key it must bail instead of opening a prompt
    // it cannot use. stdin gets EOF: if the check ever regresses the test fails
    // on the assertions below rather than hanging until the timeout.
    const { stderr, code } = await runCli(['chat'], { closeStdin: true, timeoutMs: 15000 });
    assert.strictEqual(code, 1, `should exit 1, stderr: ${stderr}`);
    assert.ok(stderr.includes('OPENROUTER_API_KEY not set'), 'should preserve the missing-key error');
  });

  it('chat starts and exits on EOF when a key is present', async () => {
    // Guards the other half: the prompt must close itself when stdin ends.
    // No line is ever typed, so the key is never spent on a request.
    const { stdout, stderr, code } = await runCli(['chat'], {
      closeStdin: true,
      timeoutMs: 15000,
      env: { OPENROUTER_API_KEY: 'test-key-never-sent' },
    });
    assert.strictEqual(code, 0, `should exit 0, stderr: ${stderr}`);
    assert.ok(stdout.includes('Eval Chat (model:'), 'should print the chat banner');
    assert.ok(stdout.includes('Bye.'), 'should close out on EOF');
  });
});
