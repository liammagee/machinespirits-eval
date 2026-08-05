import { buildGridFromEvents, renderGrid } from '../runProgressPresentation.js';

export async function runWatchCommand(context) {
  const { expandRunId, args, getOption, getFlag, readProgressLog, evaluationRunner, getProgressLogPath, fs } = context;

  // Live-updating scenario×profile grid table
  const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'watch'));
  if (!runId) {
    console.error('Usage: eval-cli.js watch <runId> [--refresh 2000] [--db]');
    process.exit(1);
  }

  const refreshMs = parseInt(getOption('refresh', '2000'), 10);
  const useDb = getFlag('db');

  console.log(`Watching run: ${runId} (refresh every ${refreshMs}ms, source: ${useDb ? 'SQLite' : 'JSONL'})`);
  console.log('Press Ctrl+C to stop.\n');

  const renderFromJsonl = () => {
    const events = readProgressLog(runId);
    if (events.length === 0) {
      return { output: 'Waiting for progress data...', done: false };
    }
    const data = buildGridFromEvents(events);
    // If JSONL has no run_start (totalTests=0), fall back to DB for the total
    if (data.totalTests === 0) {
      try {
        const runData = evaluationRunner.getRunResults(runId);
        const run = runData.run;
        data.totalTests = (run.totalScenarios || 1) * (run.totalConfigurations || 1);
      } catch {
        // If DB lookup fails, infer from grid
        data.totalTests = data.scenarios.length * data.profiles.length || data.completedTests;
      }
    }
    return { output: renderGrid(data), done: data.runDone };
  };

  const renderFromDb = () => {
    try {
      const runData = evaluationRunner.getRunResults(runId);
      const results = runData.results || [];
      // Build grid from DB results
      const scenarios = [...new Set(results.map((r) => r.scenarioName || r.scenarioId))];
      const profiles = [...new Set(results.map((r) => r.profileName || `${r.provider}/${r.model}`))];
      const grid = {};
      for (const r of results) {
        const sName = r.scenarioName || r.scenarioId;
        const pName = r.profileName || `${r.provider}/${r.model}`;
        if (!grid[sName]) grid[sName] = {};
        grid[sName][pName] = {
          score: r.tutorFirstTurnScore,
          success: r.success,
          latencyMs: r.latencyMs,
        };
      }
      const totalTests =
        (runData.run.totalScenarios || scenarios.length) * (runData.run.totalConfigurations || profiles.length);
      const done = runData.run.status === 'completed';
      // Count unique (scenario, profile) pairs instead of total rows (handles rejudge duplicates)
      const uniqueCompleted = new Set(results.map((r) => `${r.scenarioId}:${r.profileName}`)).size;
      return {
        output: renderGrid({
          scenarios,
          profiles,
          grid,
          completedTests: uniqueCompleted,
          totalTests,
          runDone: done,
          durationMs: null,
        }),
        done,
      };
    } catch (e) {
      return { output: `Error reading DB: ${e.message}`, done: false };
    }
  };

  const render = useDb ? renderFromDb : renderFromJsonl;

  // Initial check — if JSONL doesn't exist yet, wait for it
  if (!useDb) {
    const logPath = getProgressLogPath(runId);
    if (!fs.existsSync(logPath)) {
      console.log(`Waiting for progress log: ${logPath}`);
    }
  }

  // Poll loop
  let lastOutput = '';
  const poll = () => {
    const { output, done } = render();
    if (output !== lastOutput) {
      // Clear screen and redraw
      process.stdout.write('\x1b[2J\x1b[H');
      console.log(`Watch: ${runId}  (${new Date().toLocaleTimeString()})`);
      console.log('');
      console.log(output);
      lastOutput = output;
    }
    if (done) {
      console.log('\nRun complete. Exiting watch.');
      process.exit(0);
    }
  };

  poll();
  const interval = setInterval(poll, refreshMs);

  // Clean exit on Ctrl+C
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\nStopped watching.');
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}
