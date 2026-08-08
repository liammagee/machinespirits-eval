#!/usr/bin/env node
import 'dotenv/config';

/**
 * Token Budget Sensitivity Test
 *
 * Runs a dose-response curve measuring how constraining max_tokens affects
 * evaluation scores. Useful for optimizing cost/latency without sacrificing quality.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { withEvaluationScriptStore } from '../services/evaluationStore/scriptContext.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_PATH = path.join(ROOT_DIR, 'scripts', 'eval-cli.js');
const DEFAULT_LEVELS = '256,512,1024,2048,4000';
const DEFAULT_PROFILES = 'cell_1_base_single_unified,cell_5_recog_single_unified';

const HELP = `Token Budget Sensitivity Test

Usage:
  node scripts/test-token-budget.js [options]

Options:
  --model <model>       Ego model (default: openrouter.haiku)
  --levels <csv>        Comma-separated max_tokens levels (default: ${DEFAULT_LEVELS})
  --runs <n>            Runs per level×cell (default: 4)
  --profiles <csv>      Cell profiles (default: ${DEFAULT_PROFILES})
  --skip-judge          Skip rubric evaluation (generate only, judge later)
  --parallelism <n>     Parallelism per run (default: 2)
  --report-only <csv>   Skip generation, just build report from existing run IDs
  -h, --help            Show this help`;

function getOption(args, name) {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : null;
}

function getFlag(args, name) {
  return args.includes(`--${name}`);
}

function splitCsv(value) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseTokenBudgetArgs(args = process.argv.slice(2)) {
  return {
    help: getFlag(args, 'help') || args.includes('-h'),
    model: getOption(args, 'model') || 'openrouter.haiku',
    levels: splitCsv(getOption(args, 'levels') || DEFAULT_LEVELS).map((level) => Number.parseInt(level, 10)),
    runsPerLevel: Number.parseInt(getOption(args, 'runs') || '4', 10),
    profiles: splitCsv(getOption(args, 'profiles') || DEFAULT_PROFILES),
    skipJudge: getFlag(args, 'skip-judge'),
    parallelism: getOption(args, 'parallelism') || '2',
    reportOnly: getOption(args, 'report-only'),
  };
}

function printSummary(options, logger) {
  const totalEvals = options.levels.length * options.profiles.length * options.runsPerLevel * 3;
  logger.log('\n╔══════════════════════════════════════════════════╗');
  logger.log('║       Token Budget Sensitivity Test              ║');
  logger.log('╚══════════════════════════════════════════════════╝');
  logger.log(`  Model:      ${options.model}`);
  logger.log(`  Levels:     ${options.levels.join(', ')}`);
  logger.log(`  Profiles:   ${options.profiles.join(', ')}`);
  logger.log(`  Runs/level: ${options.runsPerLevel}`);
  logger.log(`  Total evals: ~${totalEvals}`);
  logger.log(`  Skip judge: ${options.skipJudge}`);
  logger.log('');
}

/**
 * Run evaluations for each token budget level and collect run IDs. Each child
 * eval CLI owns its evaluation store; this process opens no store until it has
 * completed run IDs to report.
 */
export async function runAllLevels(
  options,
  { cliPath = CLI_PATH, cwd = ROOT_DIR, env = process.env, execFile = execFileSync, logger = console } = {},
) {
  if (options.reportOnly) {
    const ids = splitCsv(options.reportOnly);
    logger.log(`Report-only mode: using ${ids.length} existing run IDs\n`);
    return ids;
  }

  const runIds = [];

  for (const level of options.levels) {
    logger.log(`\n${'─'.repeat(60)}`);
    logger.log(`Running max_tokens=${level}...`);
    logger.log(`${'─'.repeat(60)}`);

    const args = [
      cliPath,
      'run',
      '--profiles',
      options.profiles.join(','),
      '--runs',
      String(options.runsPerLevel),
      '--max-tokens',
      String(level),
      '--model',
      options.model,
      '--parallelism',
      options.parallelism,
      '--description',
      `Token budget test: max_tokens=${level}`,
    ];
    if (options.skipJudge) args.push('--skip-rubric');

    try {
      const output = execFile(process.execPath, args, {
        cwd,
        env,
        encoding: 'utf8',
        stdio: ['inherit', 'pipe', 'inherit'],
        timeout: 600_000,
      });
      const match = output.match(/Run ID:\s*(eval-[\w-]+)/u) || output.match(/(eval-\d{4}-\d{2}-\d{2}-[a-f0-9]+)/u);

      if (match) {
        runIds.push(match[1]);
        logger.log(`  ✓ Completed: ${match[1]}`);
      } else {
        logger.error(`  ✗ Could not extract run ID for max_tokens=${level}`);
        logger.error('    Output:', output.slice(-200));
      }
    } catch (error) {
      logger.error(`  ✗ Failed for max_tokens=${level}:`, error.message);
    }
  }

  return runIds;
}

function summarize(values) {
  if (values.length === 0) return { mean: 0, sd: 0, n: 0 };
  const n = values.length;
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const sd = n > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)) : 0;
  return { mean, sd, n };
}

function truncationPercent(entry) {
  const truncated = entry.outputTokens.filter((tokens, index) => {
    const calls = entry.apiCalls[index] || 1;
    return tokens >= Math.floor(entry.budget * calls * 0.95);
  }).length;
  return entry.outputTokens.length > 0 ? Math.round((100 * truncated) / entry.outputTokens.length) : 0;
}

/**
 * Build the dose-response report from completed run IDs using one explicitly
 * supplied store. Returns the report and path to support embedding and tests.
 */
export function buildTokenBudgetReport(
  runIds,
  {
    evaluationStore,
    model = 'openrouter.haiku',
    runsPerLevel = 4,
    outputDir = path.join(ROOT_DIR, 'exports'),
    fileSystem = fs,
    now = () => new Date(),
    logger = console,
  } = {},
) {
  if (!evaluationStore) throw new TypeError('buildTokenBudgetReport requires an evaluationStore');

  logger.log(`\n${'═'.repeat(60)}`);
  logger.log('  BUILDING DOSE-RESPONSE REPORT');
  logger.log(`${'═'.repeat(60)}\n`);

  const data = new Map();

  for (const runId of runIds) {
    const results = evaluationStore.getResults(runId);
    if (results.length === 0) {
      logger.warn(`  Warning: no results for ${runId}`);
      continue;
    }

    const firstHyper =
      typeof results[0].hyperparameters === 'string'
        ? JSON.parse(results[0].hyperparameters || '{}')
        : results[0].hyperparameters || {};
    const budget = firstHyper.max_tokens || null;

    if (!budget) {
      logger.warn(`  Warning: no max_tokens in hyperparameters for ${runId}`);
      continue;
    }

    for (const result of results) {
      const profile = result.profileName || result.profile_name;
      const score = result.tutorFirstTurnScore ?? result.tutor_first_turn_score;
      const outputTokens = result.outputTokens ?? result.output_tokens ?? 0;
      const apiCalls = result.apiCalls ?? result.api_calls ?? 1;

      if (score == null) continue;

      const key = `${budget}|${profile}`;
      if (!data.has(key)) {
        data.set(key, { budget, profile, scores: [], outputTokens: [], apiCalls: [] });
      }
      const entry = data.get(key);
      entry.scores.push(score);
      entry.outputTokens.push(outputTokens);
      entry.apiCalls.push(apiCalls);
    }
  }

  if (data.size === 0) {
    logger.log('No scored data found. Run without --skip-judge or judge the runs first.');
    return { report: null, outputPath: null };
  }

  const modelAlias = model.includes('.') ? model.split('.').slice(1).join('.') : model;
  const profileNames = [...new Set([...data.values()].map((entry) => entry.profile))].sort();
  const budgetLevels = [...new Set([...data.values()].map((entry) => entry.budget))].sort((a, b) => a - b);
  const generatedAt = now();
  const timestamp = generatedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const lines = [
    '# Token Budget Sensitivity Test',
    '',
    `- **Date:** ${generatedAt.toISOString().slice(0, 10)}`,
    `- **Model:** ${modelAlias}`,
    `- **Runs per level×cell:** ${runsPerLevel}`,
    `- **Run IDs:** ${runIds.join(', ')}`,
    '',
  ];

  const profileLabels = profileNames.map((profile) => {
    if (profile.includes('base')) return `Base (${profile})`;
    if (profile.includes('recog')) return `Recognition (${profile})`;
    return profile;
  });
  const columnWidth = 28;
  let header = ' Budget  |';
  let divider = '---------|';
  for (const label of profileLabels) {
    const shortLabel = label.length > columnWidth - 2 ? `${label.slice(0, columnWidth - 5)}...` : label;
    header += ` ${shortLabel.padEnd(columnWidth)}|`;
    divider += `${'-'.repeat(columnWidth + 1)}|`;
  }

  lines.push('## Dose-Response Table', '', '```', header);
  lines.push(`         | ${profileLabels.map(() => 'Mean   SD    N   Trunc%'.padEnd(columnWidth)).join('| ')}|`);
  lines.push(divider);

  for (const budget of budgetLevels) {
    let row = ` ${String(budget).padStart(5)}   |`;
    for (const profile of profileNames) {
      const entry = data.get(`${budget}|${profile}`);
      if (!entry) {
        row += ` ${'—'.padEnd(columnWidth)}|`;
        continue;
      }
      const summary = summarize(entry.scores);
      const cell = `${summary.mean.toFixed(1).padStart(5)}  ${summary.sd.toFixed(1).padStart(5)}  ${String(summary.n).padStart(3)}   ${String(truncationPercent(entry)).padStart(3)}%`;
      row += ` ${cell.padEnd(columnWidth)}|`;
    }
    lines.push(row);
  }
  lines.push('```', '');

  if (profileNames.length >= 2 && budgetLevels.length >= 2) {
    lines.push('## Key Observations', '');
    const highBudget = budgetLevels.at(-1);
    const lowBudget = budgetLevels[0];

    for (const profile of profileNames) {
      const highEntry = data.get(`${highBudget}|${profile}`);
      const lowEntry = data.get(`${lowBudget}|${profile}`);
      if (!highEntry || !lowEntry) continue;

      const high = summarize(highEntry.scores);
      const low = summarize(lowEntry.scores);
      const delta = high.mean - low.mean;
      const pooledSD = Math.sqrt((high.sd ** 2 + low.sd ** 2) / 2);
      const effectSize = pooledSD > 0 ? delta / pooledSD : 0;
      lines.push(
        `- **${profile}**: ${highBudget} vs ${lowBudget} tokens → Δ=${delta.toFixed(1)} pts (d=${effectSize.toFixed(2)})`,
      );
    }
    lines.push('');
  }

  lines.push('## Raw Data', '', '| Budget | Profile | N | Mean | SD | Trunc% |');
  lines.push('|--------|---------|---|------|-----|--------|');
  for (const budget of budgetLevels) {
    for (const profile of profileNames) {
      const entry = data.get(`${budget}|${profile}`);
      if (!entry) continue;
      const summary = summarize(entry.scores);
      lines.push(
        `| ${budget} | ${profile} | ${summary.n} | ${summary.mean.toFixed(1)} | ${summary.sd.toFixed(1)} | ${truncationPercent(entry)}% |`,
      );
    }
  }

  const report = lines.join('\n');
  logger.log(report);

  if (!fileSystem.existsSync(outputDir)) fileSystem.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `token-budget-sensitivity-${timestamp}.md`);
  fileSystem.writeFileSync(outputPath, `${report}\n`);
  logger.log(`\nReport written to: ${outputPath}`);
  return { report, outputPath };
}

export async function main(
  args = process.argv.slice(2),
  {
    rootDir = ROOT_DIR,
    env = process.env,
    evaluationStore = null,
    createStore,
    execFile = execFileSync,
    outputDir = path.join(rootDir, 'exports'),
    fileSystem = fs,
    now,
    logger = console,
  } = {},
) {
  const options = parseTokenBudgetArgs(args);
  if (options.help) {
    logger.log(HELP);
    return 0;
  }

  printSummary(options, logger);
  const runIds = await runAllLevels(options, {
    cliPath: path.join(rootDir, 'scripts', 'eval-cli.js'),
    cwd: rootDir,
    env,
    execFile,
    logger,
  });
  if (runIds.length === 0) {
    logger.log('\nNo runs completed. Nothing to report.');
    return 0;
  }

  return withEvaluationScriptStore(
    async (store) => {
      buildTokenBudgetReport(runIds, {
        evaluationStore: store,
        model: options.model,
        runsPerLevel: options.runsPerLevel,
        outputDir,
        fileSystem,
        now,
        logger,
      });
      return 0;
    },
    { rootDir, env, evaluationStore, createStore },
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error('[test-token-budget] error:', error);
      process.exitCode = 1;
    },
  );
}
