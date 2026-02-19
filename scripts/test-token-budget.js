#!/usr/bin/env node
import 'dotenv/config';
/**
 * Token Budget Sensitivity Test
 *
 * Runs a dose-response curve measuring how constraining max_tokens affects
 * evaluation scores. Useful for optimizing cost/latency without sacrificing quality.
 *
 * Usage:
 *   node scripts/test-token-budget.js [options]
 *
 * Options:
 *   --model <model>       Ego model (default: openrouter.haiku)
 *   --levels <csv>        Comma-separated max_tokens levels (default: 256,512,1024,2048,4000)
 *   --runs <n>            Runs per level×cell (default: 4)
 *   --profiles <csv>      Cell profiles (default: cell_1_base_single_unified,cell_5_recog_single_unified)
 *   --skip-judge          Skip rubric evaluation (generate only, judge later)
 *   --parallelism <n>     Parallelism per run (default: 2)
 *   --report-only <csv>   Skip generation, just build report from existing run IDs
 */

import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import * as evaluationStore from '../services/evaluationStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(__dirname, 'eval-cli.js');
const EXPORTS_DIR = path.join(__dirname, '..', 'exports');

// Parse CLI arguments
function getOption(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null;
}
function getFlag(name) {
  return process.argv.includes(`--${name}`);
}

const model = getOption('model') || 'openrouter.haiku';
const levels = (getOption('levels') || '256,512,1024,2048,4000').split(',').map((s) => parseInt(s.trim(), 10));
const runsPerLevel = parseInt(getOption('runs') || '4', 10);
const profiles = (getOption('profiles') || 'cell_1_base_single_unified,cell_5_recog_single_unified')
  .split(',')
  .map((s) => s.trim());
const skipJudge = getFlag('skip-judge');
const parallelism = getOption('parallelism') || '2';
const reportOnly = getOption('report-only');

// Summary
const totalEvals = levels.length * profiles.length * runsPerLevel * 3; // 3 scenarios
console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║       Token Budget Sensitivity Test              ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log(`  Model:      ${model}`);
console.log(`  Levels:     ${levels.join(', ')}`);
console.log(`  Profiles:   ${profiles.join(', ')}`);
console.log(`  Runs/level: ${runsPerLevel}`);
console.log(`  Total evals: ~${totalEvals}`);
console.log(`  Skip judge: ${skipJudge}`);
console.log('');

/**
 * Run evaluations for each token budget level and collect run IDs.
 */
async function runAllLevels() {
  if (reportOnly) {
    const ids = reportOnly.split(',').map((s) => s.trim());
    console.log(`Report-only mode: using ${ids.length} existing run IDs\n`);
    return ids;
  }

  const runIds = [];

  for (const level of levels) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Running max_tokens=${level}...`);
    console.log(`${'─'.repeat(60)}`);

    const args = [
      CLI_PATH,
      'run',
      '--profiles',
      profiles.join(','),
      '--runs',
      String(runsPerLevel),
      '--max-tokens',
      String(level),
      '--model',
      model,
      '--parallelism',
      parallelism,
      '--description',
      `Token budget test: max_tokens=${level}`,
    ];
    if (skipJudge) args.push('--skip-rubric');

    try {
      const output = execFileSync('node', args, {
        encoding: 'utf-8',
        stdio: ['inherit', 'pipe', 'inherit'],
        timeout: 600_000, // 10 min per level
      });

      // Extract run ID from output (format: "Run ID: eval-YYYY-MM-DD-XXXXXXXX")
      const match = output.match(/Run ID:\s*(eval-[\w-]+)/);
      if (match) {
        runIds.push(match[1]);
        console.log(`  ✓ Completed: ${match[1]}`);
      } else {
        // Try alternative format
        const altMatch = output.match(/(eval-\d{4}-\d{2}-\d{2}-[a-f0-9]+)/);
        if (altMatch) {
          runIds.push(altMatch[1]);
          console.log(`  ✓ Completed: ${altMatch[1]}`);
        } else {
          console.error(`  ✗ Could not extract run ID for max_tokens=${level}`);
          console.error('    Output:', output.slice(-200));
        }
      }
    } catch (err) {
      console.error(`  ✗ Failed for max_tokens=${level}:`, err.message);
    }
  }

  return runIds;
}

/**
 * Build the dose-response report from completed run IDs.
 */
function buildReport(runIds) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  BUILDING DOSE-RESPONSE REPORT');
  console.log(`${'═'.repeat(60)}\n`);

  // Collect data per level × profile
  const data = new Map(); // key: `${level}|${profileName}` → { scores, outputTokens, budget }

  for (const runId of runIds) {
    const results = evaluationStore.getResults(runId);
    if (results.length === 0) {
      console.warn(`  Warning: no results for ${runId}`);
      continue;
    }

    // Extract max_tokens from hyperparameters of first result
    const firstHyper =
      typeof results[0].hyperparameters === 'string'
        ? JSON.parse(results[0].hyperparameters || '{}')
        : results[0].hyperparameters || {};
    const budget = firstHyper.max_tokens || null;

    if (!budget) {
      console.warn(`  Warning: no max_tokens in hyperparameters for ${runId}`);
      continue;
    }

    for (const r of results) {
      const profile = r.profile_name || r.profileName;
      const score = r.overall_score;
      const outTokens = r.output_tokens || r.outputTokens || 0;
      const apiCalls = r.api_calls || r.apiCalls || 1;

      if (score == null) continue; // unjudged

      const key = `${budget}|${profile}`;
      if (!data.has(key)) {
        data.set(key, { budget, profile, scores: [], outputTokens: [], apiCalls: [] });
      }
      const entry = data.get(key);
      entry.scores.push(score);
      entry.outputTokens.push(outTokens);
      entry.apiCalls.push(apiCalls);
    }
  }

  if (data.size === 0) {
    console.log('No scored data found. Run without --skip-judge or judge the runs first.');
    return;
  }

  // Compute statistics
  const stats = (arr) => {
    if (arr.length === 0) return { mean: 0, sd: 0, n: 0 };
    const n = arr.length;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const sd = n > 1 ? Math.sqrt(arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1)) : 0;
    return { mean, sd, n };
  };

  // Extract model alias from the model string
  const modelAlias = model.includes('.') ? model.split('.').slice(1).join('.') : model;

  // Build table rows grouped by profile
  const profileNames = [...new Set([...data.values()].map((d) => d.profile))].sort();
  const budgetLevels = [...new Set([...data.values()].map((d) => d.budget))].sort((a, b) => a - b);

  // Format the report
  const lines = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  lines.push(`# Token Budget Sensitivity Test`);
  lines.push('');
  lines.push(`- **Date:** ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`- **Model:** ${modelAlias}`);
  lines.push(`- **Runs per level×cell:** ${runsPerLevel}`);
  lines.push(`- **Run IDs:** ${runIds.join(', ')}`);
  lines.push('');

  // Build the table
  const profileLabels = profileNames.map((p) => {
    if (p.includes('base')) return `Base (${p})`;
    if (p.includes('recog')) return `Recognition (${p})`;
    return p;
  });

  // Header
  const colWidth = 28;
  let header = ' Budget  |';
  let divider = '---------|';
  for (const label of profileLabels) {
    const shortLabel = label.length > colWidth - 2 ? label.slice(0, colWidth - 5) + '...' : label;
    header += ` ${shortLabel.padEnd(colWidth)}|`;
    divider += `${'-'.repeat(colWidth + 1)}|`;
  }
  lines.push('## Dose-Response Table');
  lines.push('');
  lines.push('```');
  lines.push(header);
  lines.push(`         | ${profileLabels.map(() => 'Mean   SD    N   Trunc%'.padEnd(colWidth)).join('| ')}|`);
  lines.push(divider);

  for (const budget of budgetLevels) {
    let row = ` ${String(budget).padStart(5)}   |`;
    for (const profile of profileNames) {
      const key = `${budget}|${profile}`;
      const entry = data.get(key);
      if (!entry) {
        row += ` ${'—'.padEnd(colWidth)}|`;
        continue;
      }

      const s = stats(entry.scores);
      // Truncation: per-row check whether output tokens >= budget × api_calls (within 95%).
      // output_tokens is cumulative across all API calls (including inner retries),
      // so we scale the threshold by api_calls to avoid false positives.
      const truncCount = entry.outputTokens.filter((t, i) => {
        const calls = entry.apiCalls[i] || 1;
        return t >= Math.floor(budget * calls * 0.95);
      }).length;
      const truncPct = entry.outputTokens.length > 0 ? Math.round((100 * truncCount) / entry.outputTokens.length) : 0;

      const cell = `${s.mean.toFixed(1).padStart(5)}  ${s.sd.toFixed(1).padStart(5)}  ${String(s.n).padStart(3)}   ${String(truncPct).padStart(3)}%`;
      row += ` ${cell.padEnd(colWidth)}|`;
    }
    lines.push(row);
  }
  lines.push('```');
  lines.push('');

  // Effect size summary
  if (profileNames.length >= 2 && budgetLevels.length >= 2) {
    lines.push('## Key Observations');
    lines.push('');

    const highBudget = budgetLevels[budgetLevels.length - 1];
    const lowBudget = budgetLevels[0];

    for (const profile of profileNames) {
      const highKey = `${highBudget}|${profile}`;
      const lowKey = `${lowBudget}|${profile}`;
      const highEntry = data.get(highKey);
      const lowEntry = data.get(lowKey);

      if (highEntry && lowEntry) {
        const highStats = stats(highEntry.scores);
        const lowStats = stats(lowEntry.scores);
        const delta = highStats.mean - lowStats.mean;
        const pooledSD = Math.sqrt((highStats.sd ** 2 + lowStats.sd ** 2) / 2);
        const d = pooledSD > 0 ? delta / pooledSD : 0;

        lines.push(
          `- **${profile}**: ${highBudget} vs ${lowBudget} tokens → Δ=${delta.toFixed(1)} pts (d=${d.toFixed(2)})`,
        );
      }
    }
    lines.push('');
  }

  // Raw data table
  lines.push('## Raw Data');
  lines.push('');
  lines.push('| Budget | Profile | N | Mean | SD | Trunc% |');
  lines.push('|--------|---------|---|------|-----|--------|');
  for (const budget of budgetLevels) {
    for (const profile of profileNames) {
      const key = `${budget}|${profile}`;
      const entry = data.get(key);
      if (!entry) continue;
      const s = stats(entry.scores);
      const truncCount = entry.outputTokens.filter((t, i) => {
        const calls = entry.apiCalls[i] || 1;
        return t >= Math.floor(budget * calls * 0.95);
      }).length;
      const truncPct = entry.outputTokens.length > 0 ? Math.round((100 * truncCount) / entry.outputTokens.length) : 0;
      lines.push(`| ${budget} | ${profile} | ${s.n} | ${s.mean.toFixed(1)} | ${s.sd.toFixed(1)} | ${truncPct}% |`);
    }
  }

  const report = lines.join('\n');

  // Print to console
  console.log(report);

  // Write to file
  if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  const outPath = path.join(EXPORTS_DIR, `token-budget-sensitivity-${timestamp}.md`);
  fs.writeFileSync(outPath, report + '\n');
  console.log(`\nReport written to: ${outPath}`);
}

// Main
(async () => {
  try {
    const runIds = await runAllLevels();
    if (runIds.length > 0) {
      buildReport(runIds);
    } else {
      console.log('\nNo runs completed. Nothing to report.');
    }
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
})();
