/**
 * Tests for loadDialogueLog — the centralized dialogue log loader.
 *
 * Uses real temp files on disk to verify exact-match and fallback-scan
 * strategies, error handling, and null returns.
 *
 * Run: node --test services/__tests__/loadDialogueLog.test.js
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const LOGS_DIR = path.join(ROOT, 'logs', 'tutor-dialogues');

// ── Fixtures ──────────────────────────────────────────────────────────────

const TEST_DIALOGUE_ID = `test-loadDialogueLog-${Date.now()}`;
const TEST_FILE = path.join(LOGS_DIR, `${TEST_DIALOGUE_ID}.json`);

const SAMPLE_LOG = {
  dialogueId: TEST_DIALOGUE_ID,
  isMultiTurn: true,
  learnerArchitecture: 'ego_superego',
  learnerContext: '### Recent Chat History\n- User: "I need help with dialectics"',
  turnResults: [
    { turnId: 'turn-0', learnerMessage: 'I need help', suggestions: [{ message: 'Let me help' }] },
    { turnId: 'turn-1', learnerMessage: 'Thanks', suggestions: [{ message: 'Glad to help' }] },
  ],
  dialogueTrace: [
    { agent: 'tutor', action: 'context_input', turnIndex: 0 },
    { agent: 'ego', action: 'generate', turnIndex: 0 },
    { agent: 'learner_ego_initial', action: 'deliberation', turnIndex: 1, detail: 'thinking...' },
    { agent: 'learner_superego', action: 'deliberation', turnIndex: 1, detail: 'dig deeper' },
    { agent: 'learner_ego_revision', action: 'deliberation', turnIndex: 1, detail: 'revised thought' },
    { agent: 'ego', action: 'generate', turnIndex: 1 },
  ],
  metrics: { totalLatencyMs: 5000, apiCalls: 4 },
};

// ── Setup / Teardown ──────────────────────────────────────────────────────

// Dynamically import after ensuring LOGS_DIR exists
let loadDialogueLog;

before(async () => {
  // Ensure the logs directory exists
  fs.mkdirSync(LOGS_DIR, { recursive: true });

  // Write the test fixture
  fs.writeFileSync(TEST_FILE, JSON.stringify(SAMPLE_LOG), 'utf-8');

  // Import the function under test (after fs setup to avoid DB init races)
  const mod = await import('../evaluationStore.js');
  loadDialogueLog = mod.loadDialogueLog;
});

after(() => {
  // Clean up test file
  try {
    fs.unlinkSync(TEST_FILE);
  } catch {
    // ignore
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('loadDialogueLog', () => {
  // ── Null / missing inputs ─────────────────────────────────────────────

  it('returns null for null dialogueId', () => {
    assert.equal(loadDialogueLog(null), null);
  });

  it('returns null for undefined dialogueId', () => {
    assert.equal(loadDialogueLog(undefined), null);
  });

  it('returns null for empty string dialogueId', () => {
    assert.equal(loadDialogueLog(''), null);
  });

  it('returns null for non-existent dialogueId', () => {
    assert.equal(loadDialogueLog('dialogue-does-not-exist-999999'), null);
  });

  // ── Exact-match loading ───────────────────────────────────────────────

  it('loads a dialogue log by exact dialogueId', () => {
    const result = loadDialogueLog(TEST_DIALOGUE_ID);
    assert.ok(result, 'should return a non-null result');
    assert.equal(result.dialogueId, TEST_DIALOGUE_ID);
  });

  it('returns full parsed JSON with all fields', () => {
    const result = loadDialogueLog(TEST_DIALOGUE_ID);
    assert.equal(result.isMultiTurn, true);
    assert.equal(result.learnerArchitecture, 'ego_superego');
    assert.ok(result.learnerContext.includes('dialectics'));
    assert.equal(result.turnResults.length, 2);
    assert.equal(result.dialogueTrace.length, 6);
    assert.equal(result.metrics.apiCalls, 4);
  });

  it('returns turnResults with correct structure', () => {
    const result = loadDialogueLog(TEST_DIALOGUE_ID);
    const turn0 = result.turnResults[0];
    assert.equal(turn0.turnId, 'turn-0');
    assert.equal(turn0.suggestions[0].message, 'Let me help');
  });

  it('returns dialogueTrace with correct agent labels', () => {
    const result = loadDialogueLog(TEST_DIALOGUE_ID);
    const agents = result.dialogueTrace.map((e) => e.agent);
    assert.ok(agents.includes('tutor'));
    assert.ok(agents.includes('ego'));
    assert.ok(agents.includes('learner_ego_initial'));
    assert.ok(agents.includes('learner_superego'));
    assert.ok(agents.includes('learner_ego_revision'));
  });

  // ── Partial-match fallback ────────────────────────────────────────────

  it('finds a log via partial-match scan when exact path misses', () => {
    // The test file is named `test-loadDialogueLog-<ts>.json`.
    // Searching for a substring that includes the timestamp should find it
    // via the readdirSync fallback (no file at `<substring>.json`).
    const partialId = TEST_DIALOGUE_ID.slice(5); // drop "test-" prefix
    const result = loadDialogueLog(partialId);
    assert.ok(result, 'partial match should find the file');
    assert.equal(result.dialogueId, TEST_DIALOGUE_ID);
  });

  // ── Invalid JSON handling ─────────────────────────────────────────────

  it('returns null for a file with invalid JSON', () => {
    const badId = `test-badjson-${Date.now()}`;
    const badFile = path.join(LOGS_DIR, `${badId}.json`);
    try {
      fs.writeFileSync(badFile, '{ this is not valid json }}}', 'utf-8');
      const result = loadDialogueLog(badId);
      assert.equal(result, null, 'should return null for invalid JSON');
    } finally {
      try {
        fs.unlinkSync(badFile);
      } catch {
        /* ignore */
      }
    }
  });

  // ── Return type ───────────────────────────────────────────────────────

  it('returns a plain object (not wrapped in {path, json})', () => {
    const result = loadDialogueLog(TEST_DIALOGUE_ID);
    // Should have dialogueTrace directly, not nested under .json
    assert.ok(Array.isArray(result.dialogueTrace), 'dialogueTrace should be on the object directly');
    assert.equal(result.path, undefined, 'should not have a .path wrapper');
    assert.equal(result.json, undefined, 'should not have a .json wrapper');
  });
});
