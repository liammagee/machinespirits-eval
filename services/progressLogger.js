/**
 * Progress Logger — JSONL event writer for cross-process eval monitoring.
 *
 * One file per run at logs/eval-progress/<runId>.jsonl.
 * Each line is a self-contained JSON object with timestamp + runId + eventType.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PROGRESS_DIR = path.join(ROOT_DIR, 'logs', 'eval-progress');

export class ProgressLogger {
  constructor(runId) {
    this.runId = runId;
    // Ensure directory exists
    fs.mkdirSync(PROGRESS_DIR, { recursive: true });
    this.filePath = path.join(PROGRESS_DIR, `${runId}.jsonl`);
  }

  /** Append a single JSON line */
  writeEvent(eventType, data = {}) {
    const event = {
      timestamp: new Date().toISOString(),
      runId: this.runId,
      eventType,
      ...data,
    };
    fs.appendFileSync(this.filePath, JSON.stringify(event) + '\n');
  }

  // ── Convenience methods ──────────────────────────────────────────

  runStart({ totalTests, totalScenarios, totalConfigurations, scenarios, profiles, description }) {
    this.writeEvent('run_start', {
      totalTests,
      totalScenarios,
      totalConfigurations,
      scenarios,
      profiles,
      description,
    });
  }

  testStart({ scenarioId, scenarioName, profileName }) {
    this.writeEvent('test_start', { scenarioId, scenarioName, profileName });
  }

  testComplete({ scenarioId, scenarioName, profileName, success, overallScore, baseScore, recognitionScore, latencyMs, completedCount, totalTests }) {
    this.writeEvent('test_complete', {
      scenarioId, scenarioName, profileName,
      success, overallScore, baseScore, recognitionScore, latencyMs,
      completedCount, totalTests,
    });
  }

  testError({ scenarioId, scenarioName, profileName, errorMessage, completedCount, totalTests }) {
    this.writeEvent('test_error', {
      scenarioId, scenarioName, profileName, errorMessage,
      completedCount, totalTests,
    });
  }

  scenarioComplete({ scenarioId, scenarioName, profileNames, avgScore, completedScenarios, totalScenarios }) {
    this.writeEvent('scenario_complete', {
      scenarioId, scenarioName, profileNames, avgScore,
      completedScenarios, totalScenarios,
    });
  }

  runComplete({ totalTests, successfulTests, failedTests, durationMs }) {
    this.writeEvent('run_complete', {
      totalTests, successfulTests, failedTests, durationMs,
    });
  }
}

/** Resolve the JSONL path for a given runId (may not exist yet). */
export function getProgressLogPath(runId) {
  return path.join(PROGRESS_DIR, `${runId}.jsonl`);
}

/** Read all events from a JSONL progress file. Returns [] if missing. */
export function readProgressLog(runId) {
  const filePath = path.join(PROGRESS_DIR, `${runId}.jsonl`);
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  return lines.map(line => {
    try { return JSON.parse(line); }
    catch { return null; }
  }).filter(Boolean);
}

export default { ProgressLogger, getProgressLogPath, readProgressLog };
