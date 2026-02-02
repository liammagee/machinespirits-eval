/**
 * Smoke tests for eval-cli.js — verifies that each CLI command parses
 * arguments correctly and reaches the expected code path without needing
 * live API keys.
 *
 * These tests spawn the CLI as a child process and check exit codes
 * and output patterns. Only commands that don't require external API
 * calls are tested end-to-end; commands that need APIs are tested for
 * correct argument parsing (usage output, error messages).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(__dirname, '..', 'scripts', 'eval-cli.js');

/** Run the CLI with given args, returning { stdout, stderr, code }. */
async function runCli(args = [], timeoutMs = 15000) {
  try {
    const { stdout, stderr } = await exec('node', [CLI, ...args], {
      timeout: timeoutMs,
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
// Commands that work without API keys (read-only / DB / config)
// ---------------------------------------------------------------------------

describe('eval-cli smoke — read-only commands', () => {
  it('list: shows scenarios and profiles', async () => {
    const { stdout, code } = await runCli(['list']);
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('Scenarios:'), 'should list scenarios');
    assert.ok(stdout.includes('new_user_first_visit'), 'should include a known scenario');
  });

  it('list: shows factorial cells', async () => {
    const { stdout } = await runCli(['list']);
    assert.ok(stdout.includes('cell_1_base_single_unified'), 'should show cell 1');
    assert.ok(stdout.includes('cell_8_recog_multi_psycho'), 'should show cell 8');
    assert.ok(stdout.includes('2x2x2 Factorial'), 'should show factorial header');
  });

  it('runs: lists past evaluation runs', async () => {
    const { stdout, code } = await runCli(['runs']);
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('Evaluation runs'), 'should show runs header');
    assert.ok(stdout.includes('Status'), 'should show status column');
  });

  it('cleanup: dry-run scans for stale runs', async () => {
    const { stdout, code } = await runCli(['cleanup']);
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('Scanning for stale runs'), 'should show scan message');
    assert.ok(stdout.includes('dry run'), 'should indicate dry run');
  });
});

// ---------------------------------------------------------------------------
// Commands that show usage when missing required args
// ---------------------------------------------------------------------------

describe('eval-cli smoke — usage / error handling', () => {
  it('report: shows usage when no runId', async () => {
    const { stderr, code } = await runCli(['report']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('Usage:'), 'should show usage');
  });

  it('status: shows usage when no runId', async () => {
    const { stderr, code } = await runCli(['status']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('Usage:'), 'should show usage');
  });

  it('transcript: shows usage when no runId', async () => {
    const { stderr, code } = await runCli(['transcript']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('Usage:'), 'should show usage');
  });

  it('export: shows usage when no runId', async () => {
    const { stderr, code } = await runCli(['export']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('Usage:'), 'should show usage');
  });

  it('evaluate: shows usage when no runId', async () => {
    const { stderr, code } = await runCli(['evaluate']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('Usage:'), 'should show usage');
  });

  it('rejudge: shows usage when no runId', async () => {
    const { stderr, code } = await runCli(['rejudge']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('Usage:'), 'should show usage');
  });

  it('unknown command: exits with error and lists available commands', async () => {
    const { stderr, code } = await runCli(['nonexistent_command']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('Unknown command'), 'should report unknown command');
    assert.ok(stderr.includes('Available commands'), 'should list available commands');
  });

  it('run --cluster and --scenario are mutually exclusive', async () => {
    const { stderr, code } = await runCli(['run', '--cluster', 'core', '--scenario', 'foo']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('mutually exclusive'), 'should reject combined flags');
  });
});

// ---------------------------------------------------------------------------
// Commands that read from DB with a known run ID
// ---------------------------------------------------------------------------

describe('eval-cli smoke — DB-backed commands', () => {
  // Use a run that exists in the test DB (from the runs list we saw earlier)
  // If no runs exist, these tests will still verify error handling.

  it('report: generates report for existing run', async () => {
    // First get a run ID from the runs list
    const { stdout: runsList } = await runCli(['runs']);
    const match = runsList.match(/(eval-\d{4}-\d{2}-\d{2}-[a-f0-9]+)/);
    if (!match) {
      // No runs in DB — skip gracefully
      return;
    }
    const runId = match[1];
    const { stdout, code } = await runCli(['report', runId]);
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('TUTOR EVALUATION REPORT'), 'should show report header');
  });

  it('status: shows status for existing run', async () => {
    const { stdout: runsList } = await runCli(['runs']);
    const match = runsList.match(/(eval-\d{4}-\d{2}-\d{2}-[a-f0-9]+)/);
    if (!match) return;
    const runId = match[1];
    const { stdout, code } = await runCli(['status', runId]);
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('Run:'), 'should show run ID');
    assert.ok(stdout.includes('Status:'), 'should show status');
  });

  it('report: errors on nonexistent run', async () => {
    const { stderr, code } = await runCli(['report', 'eval-9999-99-99-nonexistent']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('not found') || stderr.includes('Error'), 'should report not found');
  });
});
