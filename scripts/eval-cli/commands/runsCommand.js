import { enrichRunsWithActiveTests, renderRunsTable } from '../runsPresentation.js';

export async function runRunsCommand(context) {
  const { getOption, getFlag, evaluationStore, theme } = context;

  const limitOpt = getOption('limit');
  const limit = limitOpt ? parseInt(limitOpt, 10) : null;
  const statusFilter = getOption('status') || null;
  const cellsFilter = getOption('cells') || null;
  const groupByConfig = getFlag('group');
  const isLive = getFlag('live');
  const refreshMs = parseInt(getOption('refresh', '3000'), 10);

  // Post-filter: keep runs matching --cells pattern (matches on cell numbers or profile names)
  const applyRunsFilters = (runs) => {
    let filtered = runs;
    if (cellsFilter) {
      const patterns = cellsFilter.split(',').map((p) => p.trim());
      filtered = filtered.filter((run) => {
        const names = run.profileNames || [];
        return patterns.some((pat) =>
          names.some((name) => {
            const m = name.match(/^cell_(\d+)/);
            return (m && m[1] === pat) || name.includes(pat);
          }),
        );
      });
    }
    if (groupByConfig) {
      // Sort by model fingerprint (grouping like-for-like runs together), then by date within groups
      filtered.sort((a, b) => {
        const fa = a.modelFingerprint || '';
        const fb = b.modelFingerprint || '';
        if (fa !== fb) return fa.localeCompare(fb);
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      });
    }
    return filtered;
  };

  if (isLive) {
    // Live auto-refreshing mode — use alternate screen buffer (like top/htop)
    const liveLimit = limit || 20;
    let lastOutput = '';
    process.stdout.write('\x1b[?1049h'); // enter alternate screen buffer
    const poll = () => {
      let runs = enrichRunsWithActiveTests(evaluationStore.listRuns({ limit: liveLimit, status: statusFilter }));
      runs = applyRunsFilters(runs);
      if (runs.length === 0) {
        const output = '\nNo evaluation runs found.';
        if (output !== lastOutput) {
          process.stdout.write('\x1b[H\x1b[2J');
          console.log(theme.dim(`Runs  (${new Date().toLocaleTimeString()}, refresh ${refreshMs}ms, Ctrl+C to exit)`));
          console.log(output);
          lastOutput = output;
        }
        return;
      }
      if (!groupByConfig) runs.reverse(); // oldest first → newest at bottom (nearest to cursor)
      const output = renderRunsTable(runs);
      if (output !== lastOutput) {
        process.stdout.write('\x1b[H\x1b[2J');
        console.log(
          theme.dim(
            `Runs: ${runs.length} most recent  (${new Date().toLocaleTimeString()}, refresh ${refreshMs}ms, Ctrl+C to exit)`,
          ),
        );
        console.log('');
        console.log(output);
        console.log('');
        lastOutput = output;
      }
    };
    poll();
    const interval = setInterval(poll, refreshMs);
    process.on('SIGINT', () => {
      clearInterval(interval);
      process.stdout.write('\x1b[?1049l'); // leave alternate screen buffer
      console.log('Stopped watching.');
      process.exit(0);
    });
    await new Promise(() => {});
  } else {
    // One-shot mode
    let runs = enrichRunsWithActiveTests(evaluationStore.listRuns({ limit, status: statusFilter }));
    runs = applyRunsFilters(runs);
    if (runs.length === 0) {
      console.log('\nNo evaluation runs found.');
      return;
    }
    if (!groupByConfig) runs.reverse(); // oldest first → newest at bottom
    const label = groupByConfig ? 'grouped by model config' : `${runs.length} total`;
    console.log(`\nEvaluation runs (${label}):\n`);
    console.log(renderRunsTable(runs));
    console.log('');
  }
}
