import { isPidAlive } from '../../../services/processUtils.js';
import {
  buildGridFromEvents,
  deriveActiveTestProgress,
  formatActiveTestProgress,
  formatMs,
} from '../runProgressPresentation.js';

export async function runStatusCommand(context) {
  const { expandRunId, args, readProgressLog, evaluationRunner, theme } = context;

  // Quick snapshot of a run's current state
  const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'status'));
  if (!runId) {
    console.error('Usage: eval-cli.js status <runId>');
    process.exit(1);
  }

  // Try JSONL first for in-progress runs
  const events = readProgressLog(runId);
  if (events.length > 0) {
    const gridResult = buildGridFromEvents(events);
    const activeTest = deriveActiveTestProgress(events);
    const { scenarios, profiles, grid, completedTests, runDone, durationMs } = gridResult;
    let { totalTests } = gridResult;

    // Check if process is still alive (for running runs)
    let statusLabel = runDone ? 'completed' : 'running';
    const runData = evaluationRunner.getRunResults(runId);
    const pid = runData?.run?.metadata?.pid;

    // If JSONL has no run_start (totalTests=0), fall back to DB for the total
    if (totalTests === 0 && runData?.run) {
      totalTests =
        (runData.run.totalScenarios || scenarios.length) * (runData.run.totalConfigurations || profiles.length);
    }

    // For resumed runs, completed can exceed total - cap display at total
    const displayCompleted = Math.min(completedTests, totalTests);
    const pct = totalTests > 0 ? Math.min(100, Math.round((displayCompleted / totalTests) * 100)) : 0;
    if (!runDone && pid) {
      const alive = isPidAlive(pid);
      if (!alive) {
        statusLabel = `STALE (pid ${pid} dead)`;
      } else {
        statusLabel = `running (pid ${pid})`;
      }
    }

    console.log(`\nRun: ${theme.id(runId)}`);
    console.log(`Status: ${theme.status(statusLabel)}`);
    console.log(
      `Progress: ${displayCompleted}/${totalTests} tests (${pct}%)${completedTests > totalTests ? ` [${completedTests - totalTests} retried]` : ''}`,
    );
    if (durationMs) console.log(`Duration: ${formatMs(durationMs)}`);
    if (!runDone && activeTest) {
      console.log(`Current test: ${theme.dim(formatActiveTestProgress(activeTest))}`);
    }
    console.log(`Scenarios: ${scenarios.length} | Profiles: ${profiles.length}`);

    // Per-scenario completion counts
    if (scenarios.length > 0) {
      console.log('\nScenario completion:');
      for (const s of scenarios) {
        const done = profiles.filter((p) => grid[s]?.[p]).length;
        const scores = profiles.filter((p) => grid[s]?.[p]?.score != null).map((p) => grid[s][p].score);
        const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '--';
        console.log(`  ${s}: ${done}/${profiles.length} profiles done, avg=${theme.score(avg)}`);
      }
    }

    // Top performers
    const profileScores = {};
    for (const s of scenarios) {
      for (const p of profiles) {
        const cell = grid[s]?.[p];
        if (cell?.score != null) {
          if (!profileScores[p]) profileScores[p] = [];
          profileScores[p].push(cell.score);
        }
      }
    }
    const ranked = Object.entries(profileScores)
      .map(([name, scores]) => ({
        name,
        avg: scores.reduce((a, b) => a + b, 0) / scores.length,
        count: scores.length,
      }))
      .sort((a, b) => b.avg - a.avg);
    if (ranked.length > 0) {
      console.log(theme.header('\nTop performers:'));
      for (const r of ranked.slice(0, 5)) {
        console.log(`  ${theme.model(r.name)}: avg=${theme.score(r.avg)} (${r.count} tests)`);
      }
    }
  } else {
    // Fallback: read from SQLite
    const runData = evaluationRunner.getRunResults(runId);
    console.log(`\nRun: ${theme.id(runId)}`);
    console.log(`Status: ${theme.status(runData.run.status)}`);
    const createdLocal = runData.run.createdAt ? new Date(runData.run.createdAt).toLocaleString() : '--';
    console.log(`Created: ${theme.dim(createdLocal)}`);
    console.log(`Description: ${runData.run.description || 'N/A'}`);
    // Count unique (scenario, profile) pairs to handle rejudge duplicates
    const uniqueTests = new Set(runData.results.map((r) => `${r.scenarioId}:${r.profileName}`)).size;
    console.log(`Tests: ${runData.run.totalTests || uniqueTests}`);

    if (runData.stats.length > 0) {
      console.log(theme.header('\nTop performers:'));
      for (const stat of runData.stats.slice(0, 10)) {
        const label = stat.profileName || `${stat.provider}/${stat.model}`;
        const base = stat.avgBaseScore != null ? ` base=${stat.avgBaseScore.toFixed(1)}` : '';
        const recog = stat.avgRecognitionScore != null ? ` recog=${stat.avgRecognitionScore.toFixed(1)}` : '';
        console.log(
          `  ${theme.model(label)}: avg=${theme.score(stat.avgScore)} ${base}${recog} (${stat.totalTests} tests)`,
        );
      }
    }
  }
  console.log('');
}
