import theme from '../../services/cliTheme.js';

export function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

export function buildGridFromEvents(events) {
  let scenarios = [];
  let profiles = [];
  let originalTotalTests = 0; // From first run_start (original plan)
  let completedTests = 0;
  let runDone = false;
  let durationMs = null;
  let _isResumed = false;
  const grid = {}; // grid[scenarioName][profileName] = { score, success, ... }

  for (const ev of events) {
    if (ev.eventType === 'run_start') {
      scenarios = ev.scenarios || [];
      profiles = ev.profiles || [];
      // Keep the FIRST run_start's totalTests (original plan), ignore resume's smaller count
      if (originalTotalTests === 0) {
        originalTotalTests = ev.totalTests || 0;
      } else {
        _isResumed = true; // This is a resume
      }
    } else if (ev.eventType === 'test_complete') {
      // Count actual events instead of relying on per-event completedCount
      completedTests++;
      const sName = ev.scenarioName || ev.scenarioId;
      const pName = ev.profileName || '?';
      if (!grid[sName]) grid[sName] = {};
      grid[sName][pName] = {
        score: ev.tutorFirstTurnScore ?? ev.overallScore,
        success: ev.success,
        latencyMs: ev.latencyMs,
      };
    } else if (ev.eventType === 'test_error') {
      completedTests++;
      const sName = ev.scenarioName || ev.scenarioId;
      const pName = ev.profileName || '?';
      if (!grid[sName]) grid[sName] = {};
      grid[sName][pName] = {
        score: null,
        success: false,
        error: ev.errorMessage,
      };
    } else if (ev.eventType === 'run_complete') {
      runDone = true;
      durationMs = ev.durationMs;
    }
  }

  // If no run_start was found, infer scenarios and profiles from the grid
  if (scenarios.length === 0) {
    scenarios = Object.keys(grid);
  }
  if (profiles.length === 0) {
    const profileSet = new Set();
    for (const scenarioData of Object.values(grid)) {
      for (const profile of Object.keys(scenarioData)) {
        profileSet.add(profile);
      }
    }
    profiles = [...profileSet];
  }

  return { scenarios, profiles, grid, completedTests, totalTests: originalTotalTests, runDone, durationMs };
}

/**
 * Infer currently active test(s) from progress events.
 * Returns the most recent in-flight test plus total active count, or null.
 */
export function deriveActiveTestProgress(events) {
  const active = new Map();

  for (const ev of events) {
    const isStart = ev.eventType === 'test_start';
    const isEnd = ev.eventType === 'test_complete' || ev.eventType === 'test_error';
    if (!isStart && !isEnd) continue;

    const scenarioKey = ev.scenarioId || ev.scenarioName;
    const profileKey = ev.profileName || '?';
    if (!scenarioKey) continue;
    const key = `${scenarioKey}::${profileKey}`;

    if (isStart) {
      const prev = active.get(key);
      if (prev) {
        prev.count += 1;
        if (ev.timestamp) prev.startedAt = ev.timestamp;
      } else {
        active.set(key, {
          scenarioId: ev.scenarioId || null,
          scenarioName: ev.scenarioName || ev.scenarioId || null,
          profileName: ev.profileName || '?',
          startedAt: ev.timestamp || null,
          count: 1,
        });
      }
      continue;
    }

    const prev = active.get(key);
    if (!prev) continue;
    if (prev.count > 1) {
      prev.count -= 1;
    } else {
      active.delete(key);
    }
  }

  if (active.size === 0) return null;

  const entries = [...active.values()].sort((a, b) => {
    const ta = a.startedAt ? new Date(a.startedAt).getTime() : 0;
    const tb = b.startedAt ? new Date(b.startedAt).getTime() : 0;
    return tb - ta;
  });

  const activeCount = entries.reduce((sum, entry) => sum + (entry.count || 1), 0);
  return {
    ...entries[0],
    activeCount,
  };
}

export function formatActiveTestProgress(activeTest) {
  if (!activeTest) return null;
  const scenario = activeTest.scenarioName || activeTest.scenarioId || '?';
  const profile = activeTest.profileName || '?';
  let label = `${profile} / ${scenario}`;

  if (activeTest.activeCount > 1) {
    label += ` (${activeTest.activeCount} active)`;
  }

  if (activeTest.startedAt) {
    const started = new Date(activeTest.startedAt).getTime();
    if (Number.isFinite(started)) {
      label += ` · ${formatMs(Math.max(0, Date.now() - started))}`;
    }
  }

  return label;
}

export function renderGrid({ scenarios, profiles, grid, completedTests, totalTests, runDone, durationMs }) {
  const lines = [];
  const pct = totalTests > 0 ? Math.round((completedTests / totalTests) * 100) : 0;
  const statusTag = runDone ? theme.success('  DONE') : theme.status('  running...');
  lines.push(
    `Progress: ${completedTests}/${totalTests} (${pct}%)${statusTag}${durationMs ? `  ${formatMs(durationMs)}` : ''}`,
  );
  lines.push('');

  // Determine column widths
  const scenarioColWidth = Math.max(20, ...scenarios.map((s) => s.length));
  const profileColWidth = Math.max(8, ...profiles.map((p) => p.length));

  // Header row
  const header =
    ''.padEnd(scenarioColWidth) + ' | ' + profiles.map((p) => theme.header(p.padEnd(profileColWidth))).join(' | ');
  lines.push(header);
  lines.push(theme.dim('-'.repeat(scenarioColWidth + 3 + (profileColWidth + 3) * profiles.length)));

  // Data rows
  for (const scenario of scenarios) {
    const cells = profiles.map((profile) => {
      const cell = grid[scenario]?.[profile];
      if (!cell) return ''.padEnd(profileColWidth);
      if (cell.error) return theme.error('ERR'.padEnd(profileColWidth));
      if (!cell.success) return theme.warn('FAIL'.padEnd(profileColWidth));
      if (cell.score != null) return theme.score(cell.score.toFixed(1).padEnd(profileColWidth));
      return theme.dim('--'.padEnd(profileColWidth));
    });
    const row = scenario.substring(0, scenarioColWidth).padEnd(scenarioColWidth) + ' | ' + cells.join(' | ');
    lines.push(row);
  }

  return lines.join('\n');
}
