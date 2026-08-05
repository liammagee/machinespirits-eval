import { readProgressLog } from '../../services/progressLogger.js';
import theme from '../../services/cliTheme.js';
import { deriveActiveTestProgress, formatActiveTestProgress } from './runProgressPresentation.js';

export function enrichRunsWithActiveTests(runs) {
  return runs.map((run) => {
    if (run.status !== 'running') return run;
    const events = readProgressLog(run.id);
    const activeTest = deriveActiveTestProgress(events);
    return activeTest ? { ...run, activeTest } : run;
  });
}

/**
 * Abbreviate cell/profile names into compact range notation.
 * e.g. ['cell_80_...', 'cell_81_...', 'cell_82_...', 'cell_84_...'] → '80..82, 84'
 * Non-cell profile names are kept as-is.
 */
function abbreviateCells(profileNames) {
  if (!profileNames || profileNames.length === 0) return '';
  const nums = [];
  const nonCell = [];
  for (const name of profileNames) {
    const m = name.match(/^cell_(\d+)/);
    if (m) nums.push(parseInt(m[1], 10));
    else nonCell.push(name);
  }
  nums.sort((a, b) => a - b);

  const parts = [];
  if (nums.length > 0) {
    // Detect contiguous ranges
    let start = nums[0],
      end = nums[0];
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] === end + 1) {
        end = nums[i];
      } else {
        parts.push(start === end ? `${start}` : `${start}..${end}`);
        start = end = nums[i];
      }
    }
    parts.push(start === end ? `${start}` : `${start}..${end}`);
  }
  parts.push(...nonCell);
  return parts.join(', ');
}

/**
 * Render the runs table as a formatted string (reusable for one-shot and --live).
 * Automatically switches to compact layout when terminal is narrower than 120 columns.
 */
export function renderRunsTable(runs) {
  const termWidth = process.stdout.columns || 120;
  if (termWidth < 120) return renderRunsCompact(runs, termWidth);

  const lines = [];
  lines.push(
    '  ' +
      theme.header('ID'.padEnd(40)) +
      theme.header('Cfg'.padEnd(8)) +
      theme.header('Status'.padEnd(12)) +
      theme.header('Progress'.padEnd(20)) +
      theme.header('TutPT'.padEnd(6)) +
      theme.header('TutH'.padEnd(6)) +
      theme.header('LrnPT'.padEnd(6)) +
      theme.header('LrnH'.padEnd(6)) +
      theme.header('DlgP'.padEnd(6)) +
      theme.header('DlgI'.padEnd(6)) +
      theme.header('Duration'.padEnd(10)) +
      theme.header('Created'.padEnd(24)) +
      theme.header('Description'),
  );
  lines.push('  ' + theme.dim('-'.repeat(168)));

  for (const run of runs) {
    const created = run.createdAt ? new Date(run.createdAt).toLocaleString() : '--';
    let progress = '--';
    if (run.totalTests > 0) {
      const pct = run.progressPct != null ? run.progressPct : 100;
      progress = `${run.completedResults}/${run.totalTests} (${pct}%)`;
    } else if (run.completedResults > 0) {
      progress = `${run.completedResults} done`;
    }
    const turnProgress = run.metadata?.turnProgress;
    if (run.status === 'running' && turnProgress) {
      progress += ` T${turnProgress.current}/${turnProgress.total}`;
    }
    const activeTest = run.activeTest || run.metadata?.testProgress || null;
    const tutPT = run.avgScore != null ? run.avgScore.toFixed(1) : '--';
    const tutH = run.avgTutorHolisticScore != null ? run.avgTutorHolisticScore.toFixed(1) : '--';
    const lrnPT = run.avgLearnerScore != null ? run.avgLearnerScore.toFixed(1) : '--';
    const lrnH = run.avgLearnerHolisticScore != null ? run.avgLearnerHolisticScore.toFixed(1) : '--';
    const dlgP = run.avgDialogueScore != null ? run.avgDialogueScore.toFixed(1) : '--';
    const dlgI = run.avgDialogueInternalScore != null ? run.avgDialogueInternalScore.toFixed(1) : '--';
    let duration = '--';
    if (run.durationMs != null) {
      const totalSec = Math.round(run.durationMs / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      duration = m > 0 ? `${m}m ${s}s` : `${s}s`;
    }
    const desc = run.description || '';
    const models = run.models && run.models.length > 0 ? run.models.join(', ') : '--';
    const cfg = run.modelFingerprint || '--';
    lines.push(
      '  ' +
        theme.id(run.id.padEnd(40)) +
        theme.dim(cfg.padEnd(8)) +
        theme.status((run.status || '--').padEnd(12)) +
        progress.padEnd(20) +
        theme.score(tutPT.padEnd(6)) +
        theme.score(tutH.padEnd(6)) +
        theme.score(lrnPT.padEnd(6)) +
        theme.score(lrnH.padEnd(6)) +
        theme.score(dlgP.padEnd(6)) +
        theme.score(dlgI.padEnd(6)) +
        duration.padEnd(10) +
        theme.dim(created.padEnd(24)) +
        desc,
    );
    if (models !== '--') {
      lines.push('  ' + `  Models: ${theme.model(models)}`);
    }
    const cells = abbreviateCells(run.profileNames);
    if (cells) {
      lines.push('  ' + `  Cells:  ${theme.dim(cells)}`);
    }
    if (run.status === 'running' && activeTest) {
      const activeLabel = formatActiveTestProgress(activeTest);
      if (activeLabel) lines.push('  ' + `  Active: ${theme.dim(activeLabel)}`);
    }
  }
  // Repeat header at bottom for easy reference
  lines.push('  ' + theme.dim('-'.repeat(168)));
  lines.push(
    '  ' +
      theme.header('ID'.padEnd(40)) +
      theme.header('Cfg'.padEnd(8)) +
      theme.header('Status'.padEnd(12)) +
      theme.header('Progress'.padEnd(20)) +
      theme.header('TutPT'.padEnd(6)) +
      theme.header('TutH'.padEnd(6)) +
      theme.header('LrnPT'.padEnd(6)) +
      theme.header('LrnH'.padEnd(6)) +
      theme.header('DlgP'.padEnd(6)) +
      theme.header('DlgI'.padEnd(6)) +
      theme.header('Duration'.padEnd(10)) +
      theme.header('Created'.padEnd(24)) +
      theme.header('Description'),
  );
  return lines.join('\n');
}

/**
 * Compact runs table for narrow terminals (<120 columns).
 * Uses shortened IDs (MM-DD-hash) and drops Created/Description to a second line.
 */
function renderRunsCompact(runs, termWidth) {
  const lines = [];
  // Compact header: ~98 chars
  lines.push(
    '  ' +
      theme.header('Run'.padEnd(16)) +
      theme.header('Status'.padEnd(10)) +
      theme.header('Progress'.padEnd(18)) +
      theme.header('TuPT'.padEnd(5)) +
      theme.header('TuH'.padEnd(5)) +
      theme.header('LrPT'.padEnd(5)) +
      theme.header('LrH'.padEnd(5)) +
      theme.header('DgP'.padEnd(5)) +
      theme.header('DgI'.padEnd(5)) +
      theme.header('Duration'),
  );
  lines.push('  ' + theme.dim('─'.repeat(Math.min(98, termWidth - 4))));

  for (const run of runs) {
    // Short ID: extract MM-DD-hash from eval-YYYY-MM-DD-hash
    const shortId = run.id.replace(/^eval-\d{4}-/, '');

    const status = (run.status || '--').replace('completed', 'done');

    let progress = '--';
    if (run.totalTests > 0) {
      const pct = run.progressPct != null ? run.progressPct : 100;
      progress = `${run.completedResults}/${run.totalTests} (${pct}%)`;
    } else if (run.completedResults > 0) {
      progress = `${run.completedResults} done`;
    }
    const turnProgress = run.metadata?.turnProgress;
    if (run.status === 'running' && turnProgress) {
      progress += ` T${turnProgress.current}/${turnProgress.total}`;
    }

    const tutPT = run.avgScore != null ? run.avgScore.toFixed(1) : '--';
    const tutH = run.avgTutorHolisticScore != null ? run.avgTutorHolisticScore.toFixed(1) : '--';
    const lrnPT = run.avgLearnerScore != null ? run.avgLearnerScore.toFixed(1) : '--';
    const lrnH = run.avgLearnerHolisticScore != null ? run.avgLearnerHolisticScore.toFixed(1) : '--';
    const dlgP = run.avgDialogueScore != null ? run.avgDialogueScore.toFixed(1) : '--';
    const dlgI = run.avgDialogueInternalScore != null ? run.avgDialogueInternalScore.toFixed(1) : '--';

    let duration = '--';
    if (run.durationMs != null) {
      const totalSec = Math.round(run.durationMs / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      duration = m > 0 ? `${m}m${s}s` : `${s}s`;
    }

    lines.push(
      '  ' +
        theme.id(shortId.padEnd(16)) +
        theme.status(status.padEnd(10)) +
        progress.padEnd(18) +
        theme.score(tutPT.padEnd(5)) +
        theme.score(tutH.padEnd(5)) +
        theme.score(lrnPT.padEnd(5)) +
        theme.score(lrnH.padEnd(5)) +
        theme.score(dlgP.padEnd(5)) +
        theme.score(dlgI.padEnd(5)) +
        duration,
    );

    // Second line: fingerprint + models + cells + description (truncated to terminal width)
    const cfg = run.modelFingerprint ? `[${run.modelFingerprint}]` : '';
    const models = run.models?.length > 0 ? run.models.join(', ') : '';
    const cells = abbreviateCells(run.profileNames);
    const cellsPart = cells ? `cells:${cells}` : '';
    const desc = run.description || '';
    const detail = [cfg, models, cellsPart, desc].filter(Boolean).join(' · ');
    if (detail) {
      const maxDetail = termWidth - 6;
      lines.push('    ' + theme.dim(detail.length > maxDetail ? detail.slice(0, maxDetail - 1) + '…' : detail));
    }

    // Active test line
    if (run.status === 'running') {
      const activeTest = run.activeTest || run.metadata?.testProgress || null;
      if (activeTest) {
        const activeLabel = formatActiveTestProgress(activeTest);
        if (activeLabel) {
          const maxActive = termWidth - 8;
          lines.push(
            '    ' +
              theme.dim(
                '> ' + (activeLabel.length > maxActive ? activeLabel.slice(0, maxActive - 1) + '…' : activeLabel),
              ),
          );
        }
      }
    }
  }
  // Repeat header at bottom for easy reference
  lines.push('  ' + theme.dim('─'.repeat(Math.min(98, termWidth - 4))));
  lines.push(
    '  ' +
      theme.header('Run'.padEnd(16)) +
      theme.header('Status'.padEnd(10)) +
      theme.header('Progress'.padEnd(18)) +
      theme.header('TuPT'.padEnd(5)) +
      theme.header('TuH'.padEnd(5)) +
      theme.header('LrPT'.padEnd(5)) +
      theme.header('LrH'.padEnd(5)) +
      theme.header('DgP'.padEnd(5)) +
      theme.header('DgI'.padEnd(5)) +
      theme.header('Duration'),
  );
  return lines.join('\n');
}

/**
 * Render the scenario×profile grid table as a string.
 */
