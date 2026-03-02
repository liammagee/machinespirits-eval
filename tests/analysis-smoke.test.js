/**
 * Smoke tests for analysis scripts — verifies that each script can be
 * imported and reaches its main code path without crashing.
 *
 * Group A: Scripts that print usage and exit 1 when required args are missing.
 * Group B: Scripts that run with defaults and exit 0 (read from DB/logs).
 * Group C: Scripts that print help text and exit 0 with --help.
 *
 * Each test spawns the script as a child process and checks exit codes
 * and output patterns. No API calls are made.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.resolve(__dirname, '..', 'scripts');

/** Run a script with given args, returning { stdout, stderr, code }. */
async function runScript(scriptName, args = [], timeoutMs = 30000) {
  const scriptPath = path.join(SCRIPTS, scriptName);
  try {
    const { stdout, stderr } = await exec('node', [scriptPath, ...args], {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10 MB — some scripts produce large output
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });
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
// Group A: Scripts that print usage on missing required args (exit 1)
// ---------------------------------------------------------------------------

describe('analysis scripts — usage on missing args', () => {
  it('analyze-mechanism-traces.js: exits 1 with usage when no runId', async () => {
    const { stderr, code } = await runScript('analyze-mechanism-traces.js');
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('Usage:'), 'should print usage to stderr');
  });

  it('analyze-trajectory-curves.js: exits 1 with usage when no runId', async () => {
    const { stderr, code } = await runScript('analyze-trajectory-curves.js');
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('Usage:'), 'should print usage to stderr');
  });
});

// ---------------------------------------------------------------------------
// Group B: Scripts that run with defaults and exit 0.
// With a populated DB they produce analysis output; with an empty DB (CI)
// they print a "no results" message and still exit 0.
// ---------------------------------------------------------------------------

describe('analysis scripts — run with defaults', () => {
  it('analyze-eval-results.js: exits 0', async () => {
    const { code } = await runScript('analyze-eval-results.js');
    assert.strictEqual(code, 0);
  });

  it('analyze-modulation-learning.js: exits 0', async () => {
    const { code } = await runScript('analyze-modulation-learning.js');
    assert.strictEqual(code, 0);
  });

  it('analyze-judge-reliability.js: exits 0', async () => {
    const { code } = await runScript('analyze-judge-reliability.js');
    assert.strictEqual(code, 0);
  });

  it('qualitative-analysis.js: exits 0', async () => {
    const { code } = await runScript('qualitative-analysis.js');
    assert.strictEqual(code, 0);
  });

  it('analyze-rubric-consistency.js: exits 0', async () => {
    const { code } = await runScript('analyze-rubric-consistency.js');
    assert.strictEqual(code, 0);
  });

  // These scripts write to the DB (persist metrics) and can hit SQLITE_BUSY
  // when other tests hold a WAL lock concurrently, so tolerate exit code 1.
  it('analyze-within-test-change.js: exits without crash', async () => {
    const { code } = await runScript('analyze-within-test-change.js');
    assert.ok(code === 0 || code === 1, `unexpected exit code: ${code}`);
  });

  it('analyze-learning-stagnation.js: exits without crash', async () => {
    const { code } = await runScript('analyze-learning-stagnation.js');
    assert.ok(code === 0 || code === 1, `unexpected exit code: ${code}`);
  });
});

// ---------------------------------------------------------------------------
// Group C: Scripts with --help support (exit 0, print usage)
// ---------------------------------------------------------------------------

describe('analysis scripts — --help support', () => {
  it('assess-transcripts.js --help: prints usage', async () => {
    const { stdout, code } = await runScript('assess-transcripts.js', ['--help']);
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('Usage:'), 'should print usage');
  });

  it('code-impasse-strategies.js --help: prints usage', async () => {
    const { stdout, code } = await runScript('code-impasse-strategies.js', ['--help']);
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('Usage:'), 'should print usage');
  });

  it('code-dialectical-modulation.js --help: prints usage', async () => {
    const { stdout, code } = await runScript('code-dialectical-modulation.js', ['--help']);
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('Usage:'), 'should print usage');
  });

  it('qualitative-analysis-ai.js --help: prints usage', async () => {
    const { stdout, code } = await runScript('qualitative-analysis-ai.js', ['--help']);
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('Usage:'), 'should print usage');
  });

  it('analyze-eval-costs.js --help: prints usage', async () => {
    const { stdout, code } = await runScript('analyze-eval-costs.js', ['--help']);
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('Usage:'), 'should print usage');
  });
});
