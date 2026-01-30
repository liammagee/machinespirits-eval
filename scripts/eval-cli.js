#!/usr/bin/env node

import 'dotenv/config';

/**
 * Evaluation CLI
 *
 * Command-line interface for running tutor evaluations.
 *
 * Usage:
 *   node scripts/eval-cli.js                  # List available options
 *   node scripts/eval-cli.js quick            # Run a quick test with defaults
 *   node scripts/eval-cli.js test             # Run a quick test (alias)
 *   node scripts/eval-cli.js run              # Run full evaluation
 *   node scripts/eval-cli.js report <runId>   # Show report for a previous run
 *   node scripts/eval-cli.js status <runId>   # Quick snapshot of a run's state
 *   node scripts/eval-cli.js watch <runId>    # Live-updating progress table
 *
 * Options:
 *   --scenario <id>        Scenario ID for quick/test (default: new_user_first_visit)
 *   --config <name>        Configuration name for quick/test
 *   --profile <name>       Profile name for quick/test
 *   --skip-rubric          Skip AI-based rubric evaluation
 *   --verbose              Enable verbose output
 *   --runs <n>             Number of runs per config (for 'run' command)
 *   --parallelism <n>      Parallel test count (for 'run' command)
 *   --description <text>   Description for the evaluation run
 *   --db                   Use SQLite instead of JSONL for 'watch' (slower but persistent)
 *   --refresh <ms>         Refresh interval for 'watch' (default: 2000)
 */

import * as evaluationRunner from '../services/evaluationRunner.js';
import { readProgressLog, getProgressLogPath } from '../services/progressLogger.js';
import fs from 'fs';

const args = process.argv.slice(2);
const command = args.find(a => !a.startsWith('--')) || 'list';

function getFlag(name) {
  return args.includes(`--${name}`);
}

function getOption(name, defaultValue = undefined) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return defaultValue;
  return args[idx + 1];
}

// ── watch / status helpers ────────────────────────────────────────

function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

/**
 * Build a scenario×profile grid from JSONL events.
 * Returns { scenarios, profiles, grid, completedTests, totalTests, runDone }.
 */
function buildGridFromEvents(events) {
  let scenarios = [];
  let profiles = [];
  let totalTests = 0;
  let completedTests = 0;
  let runDone = false;
  let durationMs = null;
  const grid = {}; // grid[scenarioName][profileName] = { score, success, ... }

  for (const ev of events) {
    if (ev.eventType === 'run_start') {
      scenarios = ev.scenarios || [];
      profiles = ev.profiles || [];
      totalTests = ev.totalTests || 0;
    } else if (ev.eventType === 'test_complete') {
      completedTests = ev.completedCount || completedTests + 1;
      const sName = ev.scenarioName || ev.scenarioId;
      const pName = ev.profileName || '?';
      if (!grid[sName]) grid[sName] = {};
      grid[sName][pName] = {
        score: ev.overallScore,
        success: ev.success,
        latencyMs: ev.latencyMs,
      };
    } else if (ev.eventType === 'test_error') {
      completedTests = ev.completedCount || completedTests + 1;
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

  return { scenarios, profiles, grid, completedTests, totalTests, runDone, durationMs };
}

/**
 * Render the scenario×profile grid table as a string.
 */
function renderGrid({ scenarios, profiles, grid, completedTests, totalTests, runDone, durationMs }) {
  const lines = [];
  const pct = totalTests > 0 ? Math.round((completedTests / totalTests) * 100) : 0;
  lines.push(`Progress: ${completedTests}/${totalTests} (${pct}%)${runDone ? '  DONE' : '  running...'}${durationMs ? `  ${formatMs(durationMs)}` : ''}`);
  lines.push('');

  // Determine column widths
  const scenarioColWidth = Math.max(20, ...scenarios.map(s => s.length));
  const profileColWidth = Math.max(8, ...profiles.map(p => p.length));

  // Header row
  const header = ''.padEnd(scenarioColWidth) + ' | ' + profiles.map(p => p.padEnd(profileColWidth)).join(' | ');
  lines.push(header);
  lines.push('-'.repeat(header.length));

  // Data rows
  for (const scenario of scenarios) {
    const cells = profiles.map(profile => {
      const cell = grid[scenario]?.[profile];
      if (!cell) return ''.padEnd(profileColWidth);
      if (cell.error) return 'ERR'.padEnd(profileColWidth);
      if (!cell.success) return 'FAIL'.padEnd(profileColWidth);
      const scoreStr = cell.score != null ? cell.score.toFixed(1) : '--';
      return scoreStr.padEnd(profileColWidth);
    });
    const row = scenario.substring(0, scenarioColWidth).padEnd(scenarioColWidth) + ' | ' + cells.join(' | ');
    lines.push(row);
  }

  return lines.join('\n');
}

async function main() {
  try {
    switch (command) {
      case 'list': {
        const options = evaluationRunner.listOptions();
        console.log('\nAvailable Scenarios:');
        for (const s of options.scenarios) {
          console.log(`  ${s.id} - ${s.name || s.id}`);
        }
        console.log('\nAvailable Configurations:');
        for (const c of options.configurations) {
          console.log(`  ${c.provider}/${c.model}`);
        }
        if (options.profiles?.length) {
          console.log('\nAvailable Profiles (local tutor-agents.yaml):');
          for (const p of options.profiles) {
            const ego = p.egoProvider && p.egoModel ? ` [${p.egoProvider}/${p.egoModel}]` : '';
            const dialogue = p.dialogueEnabled ? ` (dialogue: ${p.maxRounds} rounds)` : ' (single-agent)';
            console.log(`  ${p.name}${ego}${dialogue} - ${p.description || ''}`);
          }
        }
        break;
      }

      case 'quick':
      case 'test': {
        const scenarioId = getOption('scenario', 'new_user_first_visit');
        const profile = getOption('profile', 'budget');
        const verbose = getFlag('verbose');
        const skipRubricEval = getFlag('skip-rubric');
        const config = { profileName: profile };

        console.log(`\nRunning quick test (profile: ${profile}, scenario: ${scenarioId})...\n`);
        const result = await evaluationRunner.quickTest(config, {
          scenarioId,
          verbose,
          skipRubricEval,
        });
        console.log('\nResult:');
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'run': {
        const verbose = getFlag('verbose');
        const skipRubricEval = getFlag('skip-rubric');
        const runsPerConfig = parseInt(getOption('runs', '1'), 10);
        const parallelism = parseInt(getOption('parallelism', '2'), 10);
        const description = getOption('description');
        const scenarios = getOption('scenario') ? [getOption('scenario')] : 'all';
        const configurations = getOption('config') || getOption('profile') || 'profiles';

        console.log('\nStarting full evaluation run...\n');
        const result = await evaluationRunner.runEvaluation({
          scenarios,
          configurations,
          runsPerConfig,
          parallelism,
          skipRubricEval,
          description,
          verbose,
        });
        console.log('\nEvaluation complete.');
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'report': {
        const runId = args.find(a => !a.startsWith('--') && a !== 'report');
        if (!runId) {
          console.error('Usage: eval-cli.js report <runId>');
          process.exit(1);
        }
        const report = evaluationRunner.generateReport(runId);
        console.log(report);
        break;
      }

      case 'status': {
        // Quick snapshot of a run's current state
        const runId = args.find(a => !a.startsWith('--') && a !== 'status');
        if (!runId) {
          console.error('Usage: eval-cli.js status <runId>');
          process.exit(1);
        }

        // Try JSONL first for in-progress runs
        const events = readProgressLog(runId);
        if (events.length > 0) {
          const { scenarios, profiles, grid, completedTests, totalTests, runDone, durationMs } = buildGridFromEvents(events);
          const pct = totalTests > 0 ? Math.round((completedTests / totalTests) * 100) : 0;

          console.log(`\nRun: ${runId}`);
          console.log(`Status: ${runDone ? 'completed' : 'running'}`);
          console.log(`Progress: ${completedTests}/${totalTests} tests (${pct}%)`);
          if (durationMs) console.log(`Duration: ${formatMs(durationMs)}`);
          console.log(`Scenarios: ${scenarios.length} | Profiles: ${profiles.length}`);

          // Per-scenario completion counts
          if (scenarios.length > 0) {
            console.log('\nScenario completion:');
            for (const s of scenarios) {
              const done = profiles.filter(p => grid[s]?.[p]).length;
              const scores = profiles
                .filter(p => grid[s]?.[p]?.score != null)
                .map(p => grid[s][p].score);
              const avg = scores.length > 0
                ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
                : '--';
              console.log(`  ${s}: ${done}/${profiles.length} profiles done, avg=${avg}`);
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
            console.log('\nTop performers:');
            for (const r of ranked.slice(0, 5)) {
              console.log(`  ${r.name}: avg=${r.avg.toFixed(1)} (${r.count} tests)`);
            }
          }
        } else {
          // Fallback: read from SQLite
          const runData = evaluationRunner.getRunResults(runId);
          console.log(`\nRun: ${runId}`);
          console.log(`Status: ${runData.run.status}`);
          console.log(`Created: ${runData.run.createdAt}`);
          console.log(`Description: ${runData.run.description || 'N/A'}`);
          console.log(`Tests: ${runData.run.totalTests || runData.results.length}`);

          if (runData.stats.length > 0) {
            console.log('\nTop performers:');
            for (const stat of runData.stats.slice(0, 5)) {
              console.log(`  ${stat.provider}/${stat.model}: avg=${stat.avgScore?.toFixed(1) || '--'} (${stat.totalTests} tests)`);
            }
          }
        }
        console.log('');
        break;
      }

      case 'watch': {
        // Live-updating scenario×profile grid table
        const runId = args.find(a => !a.startsWith('--') && a !== 'watch');
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
          return { output: renderGrid(data), done: data.runDone };
        };

        const renderFromDb = () => {
          try {
            const runData = evaluationRunner.getRunResults(runId);
            const results = runData.results || [];
            // Build grid from DB results
            const scenarios = [...new Set(results.map(r => r.scenarioName || r.scenarioId))];
            const profiles = [...new Set(results.map(r => r.profileName || `${r.provider}/${r.model}`))];
            const grid = {};
            for (const r of results) {
              const sName = r.scenarioName || r.scenarioId;
              const pName = r.profileName || `${r.provider}/${r.model}`;
              if (!grid[sName]) grid[sName] = {};
              grid[sName][pName] = {
                score: r.overallScore,
                success: r.success,
                latencyMs: r.latencyMs,
              };
            }
            const totalTests = (runData.run.totalScenarios || scenarios.length) * (runData.run.totalConfigurations || profiles.length);
            const done = runData.run.status === 'completed';
            return {
              output: renderGrid({ scenarios, profiles, grid, completedTests: results.length, totalTests, runDone: done, durationMs: null }),
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
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Available commands: list, quick, test, run, report, status, watch');
        process.exit(1);
    }
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    if (getFlag('verbose')) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
