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
    // Empty DB says "No evaluation runs found"; populated DB shows table
    assert.ok(stdout.includes('Evaluation runs') || stdout.includes('No evaluation runs'), 'should show runs output');
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
  it('run --help: prints usage without starting an evaluation', async () => {
    const { stdout, stderr, code } = await runCli(['run', '--help']);
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('Usage:'), 'should show usage');
    assert.ok(stdout.includes('node scripts/eval-cli.js run'), 'should include run examples');
    assert.equal(stdout.includes('Starting evaluation run'), false, 'should not start an evaluation');
    assert.equal(stderr.includes('Starting evaluation run'), false, 'should not start an evaluation');
  });

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

  it('watch: shows usage when no runId', async () => {
    const { stderr, code } = await runCli(['watch']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('Usage:'), 'should show usage');
  });

  it('resume: shows usage when no runId', async () => {
    const { stderr, code } = await runCli(['resume']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('Usage:'), 'should show usage');
  });

  it('revert: shows usage when no runId', async () => {
    const { stderr, code } = await runCli(['revert']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('Usage:'), 'should show usage');
  });

  it('delete-runs: rejects an unbounded deletion request', async () => {
    const { stderr, code } = await runCli(['delete-runs']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('requires at least one filter'), 'should require an explicit deletion filter');
  });

  it('play: validates the human side before loading the interactive host', async () => {
    const { stderr, code } = await runCli(['play', '--as', 'observer']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('Invalid --as value'), 'should preserve the play-side validation error');
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

  it('run --max-cost requires a positive number', async () => {
    const { stderr, code } = await runCli(['run', '--max-cost', 'nope']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('positive number'), 'should reject an invalid cost budget');
  });

  it('run rejects simultaneous --judge and --judge-cli flags', async () => {
    const { stderr, code } = await runCli(['run', '--judge', 'openrouter.gpt', '--judge-cli', 'codex']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('either'), 'should preserve the mutually exclusive judge error');
  });

  it('run rejects an unsupported --judge-cli value', async () => {
    const { stderr, code } = await runCli(['run', '--judge-cli', 'nope']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('--judge-cli must be'), 'should preserve judge CLI validation');
  });

  it('rejudge rejects simultaneous --judge and --judge-cli flags', async () => {
    const { stderr, code } = await runCli([
      'rejudge',
      'eval-9999-99-99-nonexistent',
      '--judge',
      'openrouter.gpt',
      '--judge-cli',
      'codex',
    ]);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('either'), 'should preserve the mutually exclusive judge error');
  });

  it('rejudge rejects an unsupported --judge-cli value', async () => {
    const { stderr, code } = await runCli(['rejudge', 'eval-9999-99-99-nonexistent', '--judge-cli', 'nope']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('--judge-cli must be'), 'should preserve judge CLI validation');
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

// ---------------------------------------------------------------------------
// evaluate-learner --judge filter
// ---------------------------------------------------------------------------

describe('eval-cli smoke — evaluate-learner', () => {
  it('usage includes --judge option', async () => {
    const { stderr, code } = await runCli(['evaluate-learner']);
    assert.strictEqual(code, 1, 'should exit with error when no runId given');
    assert.ok(stderr.includes('--judge'), 'usage should mention --judge option');
  });

  it('errors on nonexistent run', async () => {
    const { stderr, code } = await runCli(['evaluate-learner', 'eval-9999-99-99-nonexistent']);
    assert.strictEqual(code, 1);
    assert.ok(
      stderr.includes('not found') || stderr.includes('No multi-turn'),
      'should report not found or no results',
    );
  });
});

describe('eval-cli smoke — extracted scoring command process contracts', () => {
  it('evaluate preserves judge validation before result lookup', async () => {
    const { stderr, code } = await runCli(['evaluate', 'eval-9999-99-99-nonexistent', '--judge-cli', 'nope']);
    assert.strictEqual(code, 1);
    assert.strictEqual(stderr.trim(), "Error: --judge-cli must be 'claude', 'gemini', or 'codex', got 'nope'");
  });

  it('backfill-first-turn preserves usage and missing-run exits', async () => {
    const missingArgument = await runCli(['backfill-first-turn']);
    assert.strictEqual(missingArgument.code, 1);
    assert.ok(missingArgument.stderr.includes('Usage: eval-cli.js backfill-first-turn <runId>'));

    const missingRun = await runCli(['backfill-first-turn', 'eval-9999-99-99-nonexistent']);
    assert.strictEqual(missingRun.code, 1);
    assert.ok(missingRun.stderr.includes('No results found for run'));
  });

  it('evaluate-dialogue preserves usage and missing-run exits', async () => {
    const missingArgument = await runCli(['evaluate-dialogue']);
    assert.strictEqual(missingArgument.code, 1);
    assert.ok(missingArgument.stderr.includes('Usage: eval-cli.js evaluate-dialogue <runId>'));

    const missingRun = await runCli(['evaluate-dialogue', 'eval-9999-99-99-nonexistent']);
    assert.strictEqual(missingRun.code, 1);
    assert.ok(missingRun.stderr.includes('No results found for run'));
  });
});

describe('eval-cli smoke — configuration validation', () => {
  it('validate-config: reaches the complete repository validation summary', async () => {
    const { stdout, stderr, code } = await runCli(['validate-config'], 30000);
    assert.strictEqual(code, 0, stderr);
    assert.ok(stdout.includes('Validating configuration'), 'should start configuration validation');
    assert.ok(stdout.includes('0 error(s)'), 'should preserve the successful summary');
  });
});
