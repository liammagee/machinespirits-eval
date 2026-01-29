#!/usr/bin/env node

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
 */

import * as evaluationRunner from '../services/evaluationRunner.js';

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
        const configurations = getOption('config') || getOption('profile') ? undefined : 'all';

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

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Available commands: list, quick, test, run, report');
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
