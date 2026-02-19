/**
 * Tests for progressLogger.js — JSONL event writer.
 *
 * Uses node:test (built-in). Run: node --test tests/progressLogger.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProgressLogger, getProgressLogPath, readProgressLog } from '../services/progressLogger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROGRESS_DIR = path.resolve(__dirname, '..', 'logs', 'eval-progress');

// Use a unique run ID per test to avoid collisions
let testRunId;
let logger;

function cleanup() {
  if (testRunId) {
    const filePath = path.join(PROGRESS_DIR, `${testRunId}.jsonl`);
    try {
      fs.unlinkSync(filePath);
    } catch {
      // OK if not found
    }
  }
}

describe('ProgressLogger', () => {
  beforeEach(() => {
    testRunId = `test-progress-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    logger = new ProgressLogger(testRunId);
  });

  afterEach(cleanup);

  it('creates the progress file on first writeEvent', () => {
    logger.writeEvent('test_event', { key: 'value' });
    assert.ok(fs.existsSync(logger.filePath), 'JSONL file should exist');
  });

  it('writes valid JSONL with timestamp and runId', () => {
    logger.writeEvent('test_event', { foo: 42 });
    const content = fs.readFileSync(logger.filePath, 'utf-8').trim();
    const parsed = JSON.parse(content);
    assert.equal(parsed.eventType, 'test_event');
    assert.equal(parsed.runId, testRunId);
    assert.equal(parsed.foo, 42);
    assert.ok(parsed.timestamp, 'should have timestamp');
    // Timestamp should be ISO 8601
    assert.ok(!isNaN(Date.parse(parsed.timestamp)), 'timestamp should be valid ISO');
  });

  it('appends multiple events as separate lines', () => {
    logger.writeEvent('event_1');
    logger.writeEvent('event_2');
    logger.writeEvent('event_3');
    const lines = fs.readFileSync(logger.filePath, 'utf-8').trim().split('\n');
    assert.equal(lines.length, 3);
    assert.equal(JSON.parse(lines[0]).eventType, 'event_1');
    assert.equal(JSON.parse(lines[2]).eventType, 'event_3');
  });

  it('runStart writes correct event type and fields', () => {
    logger.runStart({
      totalTests: 24,
      totalScenarios: 3,
      totalConfigurations: 8,
      scenarios: ['s1', 's2', 's3'],
      profiles: ['p1', 'p2'],
      description: 'test run',
    });
    const events = readProgressLog(testRunId);
    assert.equal(events.length, 1);
    assert.equal(events[0].eventType, 'run_start');
    assert.equal(events[0].totalTests, 24);
    assert.equal(events[0].totalScenarios, 3);
    assert.deepEqual(events[0].scenarios, ['s1', 's2', 's3']);
  });

  it('testComplete writes score and latency', () => {
    logger.testComplete({
      scenarioId: 'new_user',
      scenarioName: 'New User',
      profileName: 'cell_1',
      success: true,
      overallScore: 85.5,
      baseScore: 80.0,
      recognitionScore: 91.0,
      latencyMs: 1234,
      completedCount: 1,
      totalTests: 10,
    });
    const events = readProgressLog(testRunId);
    assert.equal(events[0].eventType, 'test_complete');
    assert.equal(events[0].overallScore, 85.5);
    assert.equal(events[0].latencyMs, 1234);
    assert.equal(events[0].success, true);
  });

  it('testError writes error message', () => {
    logger.testError({
      scenarioId: 'new_user',
      scenarioName: 'New User',
      profileName: 'cell_1',
      errorMessage: 'API timeout',
      completedCount: 0,
      totalTests: 10,
    });
    const events = readProgressLog(testRunId);
    assert.equal(events[0].eventType, 'test_error');
    assert.equal(events[0].errorMessage, 'API timeout');
  });

  it('scenarioComplete writes aggregated data', () => {
    logger.scenarioComplete({
      scenarioId: 'new_user',
      scenarioName: 'New User',
      profileNames: ['cell_1', 'cell_5'],
      avgScore: 82.3,
      completedScenarios: 1,
      totalScenarios: 3,
    });
    const events = readProgressLog(testRunId);
    assert.equal(events[0].eventType, 'scenario_complete');
    assert.equal(events[0].avgScore, 82.3);
    assert.deepEqual(events[0].profileNames, ['cell_1', 'cell_5']);
  });

  it('runComplete writes duration and counts', () => {
    logger.runComplete({
      totalTests: 24,
      successfulTests: 22,
      failedTests: 2,
      durationMs: 60000,
    });
    const events = readProgressLog(testRunId);
    assert.equal(events[0].eventType, 'run_complete');
    assert.equal(events[0].durationMs, 60000);
    assert.equal(events[0].failedTests, 2);
  });
});

describe('getProgressLogPath', () => {
  it('returns expected path for a run ID', () => {
    const p = getProgressLogPath('eval-2026-01-01-abc123');
    assert.ok(p.endsWith('eval-2026-01-01-abc123.jsonl'));
    assert.ok(p.includes('eval-progress'));
  });
});

describe('readProgressLog', () => {
  beforeEach(() => {
    testRunId = `test-read-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  });

  afterEach(cleanup);

  it('returns empty array for nonexistent run', () => {
    const events = readProgressLog('nonexistent-run-id');
    assert.deepEqual(events, []);
  });

  it('skips malformed JSON lines', () => {
    const filePath = path.join(PROGRESS_DIR, `${testRunId}.jsonl`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '{"valid":true}\nNOT JSON\n{"also":"valid"}\n');
    const events = readProgressLog(testRunId);
    assert.equal(events.length, 2);
    assert.equal(events[0].valid, true);
    assert.equal(events[1].also, 'valid');
  });

  it('handles empty file', () => {
    const filePath = path.join(PROGRESS_DIR, `${testRunId}.jsonl`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '');
    const events = readProgressLog(testRunId);
    assert.deepEqual(events, []);
  });

  it('round-trips through ProgressLogger', () => {
    const logger = new ProgressLogger(testRunId);
    logger.runStart({ totalTests: 5, totalScenarios: 1, totalConfigurations: 5, scenarios: ['s1'], profiles: ['p1'] });
    logger.testComplete({
      scenarioId: 's1',
      scenarioName: 'S1',
      profileName: 'p1',
      success: true,
      overallScore: 90,
      latencyMs: 500,
      completedCount: 1,
      totalTests: 5,
    });
    logger.runComplete({ totalTests: 5, successfulTests: 5, failedTests: 0, durationMs: 3000 });

    const events = readProgressLog(testRunId);
    assert.equal(events.length, 3);
    assert.equal(events[0].eventType, 'run_start');
    assert.equal(events[1].eventType, 'test_complete');
    assert.equal(events[2].eventType, 'run_complete');
  });
});
