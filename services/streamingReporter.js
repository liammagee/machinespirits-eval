/**
 * Streaming Reporter — console progress output during eval `run`.
 *
 * Shows a progress bar, per-test result lines, scenario summaries,
 * and a final run summary. Always active (not gated on --verbose).
 */

const BAR_WIDTH = 20;

function progressBar(completed, total) {
  const pct = total > 0 ? completed / total : 0;
  const filled = Math.round(pct * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  return `[${bar}] ${Math.round(pct * 100)}%`;
}

function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

function formatEta(completedCount, totalTests, elapsedMs) {
  if (completedCount === 0) return '?';
  const avgMs = elapsedMs / completedCount;
  const remainingMs = avgMs * (totalTests - completedCount);
  return formatMs(Math.round(remainingMs));
}

export class StreamingReporter {
  constructor({ totalTests, totalScenarios, profiles, scenarios }) {
    this.totalTests = totalTests;
    this.totalScenarios = totalScenarios;
    this.profiles = profiles;
    this.scenarios = scenarios;
    this.completedCount = 0;
    this.startTime = Date.now();
  }

  /**
   * Called after each test completes successfully.
   * Prints: [████░░] 42% 10/24 | ✓ 85.5 | budget | New User | 7333ms | ETA 4m 12s
   */
  onTestComplete(result) {
    this.completedCount++;
    const elapsed = Date.now() - this.startTime;
    const bar = progressBar(this.completedCount, this.totalTests);
    const count = `${this.completedCount}/${this.totalTests}`;
    const score = result.overallScore != null ? result.overallScore.toFixed(1) : ' -- ';
    const status = result.success ? '\u2713' : '\u2717';
    const profile = result.profileName || '';
    const scenario = result.scenarioName || result.scenarioId || '';
    const latency = result.latencyMs ? formatMs(result.latencyMs) : '';
    const eta = formatEta(this.completedCount, this.totalTests, elapsed);

    console.log(`${bar} ${count} | ${status} ${score} | ${profile} | ${scenario} | ${latency} | ETA ${eta}`);
  }

  /**
   * Called when a test errors.
   */
  onTestError({ scenarioName, profileName, errorMessage }) {
    this.completedCount++;
    const elapsed = Date.now() - this.startTime;
    const bar = progressBar(this.completedCount, this.totalTests);
    const count = `${this.completedCount}/${this.totalTests}`;
    const eta = formatEta(this.completedCount, this.totalTests, elapsed);
    const errShort = (errorMessage || 'unknown error').slice(0, 60);

    console.log(
      `${bar} ${count} | \u2717 ERROR | ${profileName || ''} | ${scenarioName || ''} | ${errShort} | ETA ${eta}`,
    );
  }

  /**
   * Called when all profiles for a scenario are done.
   */
  onScenarioComplete({ scenarioName, avgScore, completedScenarios, totalScenarios }) {
    const scoreStr = avgScore != null ? avgScore.toFixed(1) : '--';
    console.log(`${'─'.repeat(60)}`);
    console.log(`  Scenario ${completedScenarios}/${totalScenarios} complete: ${scenarioName}  avg=${scoreStr}`);
    console.log(`${'─'.repeat(60)}`);
  }

  /**
   * Called when the entire run finishes.
   */
  onRunComplete({ totalTests, successfulTests, failedTests, durationMs }) {
    console.log('');
    console.log('═'.repeat(60));
    console.log('EVALUATION COMPLETE');
    console.log('═'.repeat(60));
    console.log(`  Tests: ${successfulTests} passed, ${failedTests} failed, ${totalTests} total`);
    console.log(`  Duration: ${formatMs(durationMs)}`);
    console.log('═'.repeat(60));
  }
}

export default { StreamingReporter };
