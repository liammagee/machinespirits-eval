/**
 * Dry-run mode tests — verifies that --dry-run produces valid results
 * through the full pipeline without any API calls or API keys.
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

/** Run the CLI with given args, stripping API keys from env. */
async function runCli(args = [], timeoutMs = 30000) {
  // Remove all API keys to prove dry-run needs none
  const cleanEnv = { ...process.env, NODE_NO_WARNINGS: '1' };
  delete cleanEnv.OPENROUTER_API_KEY;
  delete cleanEnv.ANTHROPIC_API_KEY;
  delete cleanEnv.GEMINI_API_KEY;
  delete cleanEnv.OPENAI_API_KEY;

  try {
    const { stdout, stderr } = await exec('node', [CLI, ...args], {
      timeout: timeoutMs,
      env: cleanEnv,
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
// CLI integration tests (no API keys needed)
// ---------------------------------------------------------------------------

describe('eval-cli --dry-run', () => {
  it('quick --dry-run succeeds without API keys', async () => {
    const { stdout, stderr, code } = await runCli(['quick', '--dry-run']);
    assert.strictEqual(code, 0, `should exit 0, stderr: ${stderr}`);
    assert.ok(stdout.includes('dry-run'), 'output should mention dry-run');
    // Should contain a JSON result with overallScore
    assert.ok(stdout.includes('overallScore'), 'should include overallScore in output');
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
    assert.ok(typeof result.overallScore === 'number', 'overallScore should be number');
    assert.ok(result.scores, 'should have dimension scores');
    assert.strictEqual(result.judgeModel, 'dry-run/mock-judge-v1', 'judge model should be dry-run');
  });

  it('quick --dry-run with recognition profile scores higher', async () => {
    const [baseRun, recogRun] = await Promise.all([
      runCli(['quick', '--dry-run', '--profile', 'cell_1_base_single_unified']),
      runCli(['quick', '--dry-run', '--profile', 'cell_5_recog_single_unified']),
    ]);
    assert.strictEqual(baseRun.code, 0, 'base should succeed');
    assert.strictEqual(recogRun.code, 0, 'recog should succeed');

    const baseJson = JSON.parse(baseRun.stdout.match(/Result:\s*\n([\s\S]+)/)[1]);
    const recogJson = JSON.parse(recogRun.stdout.match(/Result:\s*\n([\s\S]+)/)[1]);

    assert.ok(
      recogJson.overallScore > baseJson.overallScore,
      `recognition (${recogJson.overallScore}) should score higher than base (${baseJson.overallScore})`,
    );
  });
});
