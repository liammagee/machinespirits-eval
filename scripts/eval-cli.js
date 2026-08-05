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
 *   node scripts/eval-cli.js run              # Run 2x2x2 factorial evaluation (default)
 *   node scripts/eval-cli.js runs              # List past evaluation runs
 *   node scripts/eval-cli.js report <runId>   # Show report for a previous run
 *   node scripts/eval-cli.js transcript <runId> # Show transcripts for a run (filterable by scenario/profile/dialogue)
 *   node scripts/eval-cli.js status <runId>   # Quick snapshot of a run's state
 *   node scripts/eval-cli.js watch <runId>    # Live-updating progress table
 *   node scripts/eval-cli.js export <runId>   # Export results to file for offline review
 *   node scripts/eval-cli.js cleanup          # Preview stale runs (dry-run by default)
 *   node scripts/eval-cli.js cleanup --force # Actually mark stale runs as completed
 *   node scripts/eval-cli.js delete-runs      # Preview deletion of runs by filter (pass --force to delete)
 *   node scripts/eval-cli.js resume <runId>   # Resume an incomplete run (re-run missing tests)
 *   node scripts/eval-cli.js revert <runId>  # Revert a completed/failed run to 'running'
 *   node scripts/eval-cli.js rejudge <runId> # Re-run AI judge (adds new rows for reliability)
 *   node scripts/eval-cli.js rejudge <runId> --overwrite  # Re-run AI judge (replaces existing)
 *   node scripts/eval-cli.js evaluate <runId> # Judge skip-rubric results via claude CLI
 *   node scripts/eval-cli.js evaluate <runId> --follow  # Poll & judge results as they appear
 *   node scripts/eval-cli.js evaluate <runId> --rubric-version 2.2  # Score with versioned rubric (clones into derived run)
 *   node scripts/eval-cli.js backfill-first-turn <runId>  # Rejudge suggestions[0] and write first-turn scores
 *   node scripts/eval-cli.js evaluate-learner <runId>  # Score learner turns + holistic learner quality from multi-turn interactions
 *   node scripts/eval-cli.js evaluate-dialogue <runId>  # Score multi-turn dialogues: tutor last-turn, development delta, dialogue quality
 *   node scripts/eval-cli.js validate-config          # Validate all config files (profiles, providers, scenarios)
 *   node scripts/eval-cli.js chat            # AI conversational interface
 *   node scripts/eval-cli.js play            # Human-in-the-loop role-playing
 *   node scripts/eval-cli.js runs --live     # Auto-refreshing runs display
 *
 * Options:
 *   --scenario <id>        Scenario ID or comma-separated IDs (default: all scenarios)
 *   --cluster <name>       Scenario cluster filter: single-turn, multi-turn, core, mood, benchmark, recognition, multi_turn (comma-separated OK)
 *   --profile <name>       Override profile(s) — comma-separated or single name
 *   --all-profiles         Use ALL profiles instead of the 8 factorial cells
 *   --allow-model-mix      Allow mixed tutor ego models in canonical factorial cell runs
 *   --skip-rubric          Skip AI-based rubric evaluation
 *   --judge <ref>          Override provider-based rubric judge for 'run'
 *   --judge-cli <name>     Use CLI rubric judge for 'run' or 'rejudge' (claude, gemini, codex)
 *   --judge-cli-model <m>  Optional CLI judge model override for 'run'
 *   --effort <level>       CLI judge effort for 'evaluate' or 'rejudge' (low, medium, high, xhigh, max, config)
 *   --verbose              Enable verbose output
 *   --runs <n>             Replications per cell (for 'run' command, default: 1)
 *   --parallelism <n>      Parallel worker count (run/resume default: 2, evaluate-learner default: 1)
 *   --max-cost <usd>       For adaptive-runner cells with ADAPTIVE_TUTOR_LLM=real: hard USD ceiling.
 *                          Tracker aborts the run cleanly before issuing a call that would exceed it.
 *   --description <text>   Description for the evaluation run
 *   --db                   Use SQLite instead of JSONL for 'watch' (slower but persistent)
 *   --follow               Poll for new results in 'evaluate' (live follow mode)
 *   --refresh <ms>         Refresh interval for 'watch' (default: 2000) or 'evaluate --follow' (default: 5000)
 *   --force                Actually complete stale runs (for 'cleanup'; dry-run without it)
 *   --older-than <min>     Staleness threshold in minutes (for 'cleanup', default: 30)
 *   --run-id <ids>         Comma-separated run IDs for 'delete-runs'
 *   --dry-run-runs         Filter to mock/dry-run evals for 'delete-runs'
 *   --before <YYYY-MM-DD>  Only match runs created before this date for 'delete-runs'
 *   --dry-run              Use mock data instead of API calls (no API keys required)
 *   --show-messages        Print API messages during 'run' (system prompts truncated to 200 chars)
 *   --show-messages=full   Print API messages untruncated
 *   --live                 For 'run': stream one-line display per API call in real time
 *                          For 'runs': auto-refresh mode (default: 20 most recent; override with --limit)
 *   --as <side>            For 'play': tutor or learner (default: tutor)
 *   --role <role>          For 'play': ego, superego, or both (default: ego)
 *   --learner-id <id>      For 'run' (A7 Longitudinal): reuse a Writing Pad across runs.
 *                          When supplied, ALL dialogues in this invocation share the ID,
 *                          letting tutor-core's Writing Pad accumulate state session-over-session.
 *                          Omit for per-dialogue synthetic IDs (default behaviour).
 *   --thread-negotiation-resolution
 *                          For 'run' (A5): carry the negotiated dialectical resolution
 *                          into the delivered suggestion across revision rounds, instead
 *                          of letting a revision round silently discard it. Off by default
 *                          (byte-identical to pre-A5 behaviour). Survives resume-after-kill
 *                          via checkpoint + run metadata.
 *
 * The default `run` uses the 2x2x2 factorial design:
 *   Factor A: Recognition prompts (off / on)
 *   Factor B: Multi-agent tutor  (single / ego+superego)
 *   Factor C: Multi-agent learner (unified / ego_superego)
 *   = 8 cells, all nemotron (free tier) to isolate architecture effects.
 *
 * Examples:
 *   eval-cli.js run --runs 3                   # 8 cells × all scenarios × 3 reps
 *   eval-cli.js run --runs 1 --scenario new_user_first_visit  # Quick single-scenario check
 *   eval-cli.js run --cluster multi-turn --runs 1  # Only multi-turn scenarios
 *   eval-cli.js run --cluster core,mood --runs 1   # Core + mood scenarios
 *   eval-cli.js run --profile budget,baseline   # Override: only these profiles
 *   eval-cli.js run --all-profiles --runs 1     # Legacy: every profile in tutor-agents.yaml
 */

import * as evaluationRunner from '../services/evaluationRunner.js';
import * as anovaStats from '../services/anovaStats.js';
import * as evaluationStore from '../services/evaluationStore.js';
import { readProgressLog, getProgressLogPath } from '../services/progressLogger.js';
import * as evalConfigLoader from '../services/evalConfigLoader.js';
const { getScenario } = evalConfigLoader;
import { projectTranscriptArtifacts } from '../services/transcriptProjection.js';
import theme from '../services/cliTheme.js';
import { getOperationalCommandHandler } from './eval-cli/commands/index.js';
import { getGenerationCommandHandler } from './eval-cli/commands/generationIndex.js';
import { getScoringCommandHandler } from './eval-cli/commands/scoringIndex.js';
import { generationRubricDependencies, scoringCommandDependencies } from './eval-cli/scoringCommandDependencies.js';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, '..', 'logs', 'tutor-dialogues');

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith('--')) || 'list';
const HELP_TEXT = `Usage:
  node scripts/eval-cli.js [command] [options]

Commands:
  list, quick, test, run, runs, report, status, watch, transcript, export,
  cleanup, delete-runs, resume, revert, rejudge, evaluate, backfill-first-turn,
  evaluate-learner, evaluate-dialogue, validate-config, chat, play

Run examples:
  node scripts/eval-cli.js run --profiles cell_169_id_director_charisma_accountable_bid_clean_floor_verified --scenario charisma_desire_authority_withheld --runs 1 --skip-rubric
  node scripts/eval-cli.js run --profiles cell_169_id_director_charisma_accountable_bid_clean_floor_verified --scenario charisma_desire_authority_withheld --runs 1 --judge-cli codex

Options:
  --scenario <id>        Scenario ID or comma-separated IDs
  --profile <name>       Profile(s), comma-separated
  --profiles <names>     Alias for --profile
  --runs <n>             Replications per cell
  --skip-rubric          Generate without AI rubric judging
  --judge-cli <name>     CLI rubric judge: claude, gemini, codex
  --dry-run              Use mock data instead of API calls
  --help                 Print this help and exit
`;
function getFlag(name) {
  return args.includes(`--${name}`);
}

function wantsHelp() {
  return getFlag('help') || args.includes('-h');
}

function printHelp() {
  console.log(HELP_TEXT);
}

function getOption(name, defaultValue = undefined) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return defaultValue;
  return args[idx + 1];
}

function getCsvOption(name) {
  const value = getOption(name);
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Expand shorthand run ID to full form.
 *   '02-28-24ae5093'      → 'eval-2026-02-28-24ae5093'
 *   '2026-02-28-24ae5093' → 'eval-2026-02-28-24ae5093'
 *   'eval-2026-02-28-...' → unchanged
 */
function expandRunId(id) {
  if (!id || id.startsWith('eval-')) return id;
  // MM-DD-hex
  if (/^\d{2}-\d{2}-[0-9a-f]{6,}/.test(id)) {
    const year = new Date().getFullYear();
    return `eval-${year}-${id}`;
  }
  // YYYY-MM-DD-hex
  if (/^\d{4}-\d{2}-\d{2}-[0-9a-f]{6,}/.test(id)) {
    return `eval-${id}`;
  }
  return id;
}

async function main() {
  try {
    if (wantsHelp()) {
      printHelp();
      return;
    }

    const operationalCommandHandler = getOperationalCommandHandler(command);
    if (operationalCommandHandler) {
      await operationalCommandHandler({
        args,
        evaluationRunner,
        evaluationStore,
        anovaStats,
        evalConfigLoader,
        getScenario,
        readProgressLog,
        getProgressLogPath,
        projectTranscriptArtifacts,
        theme,
        fs,
        path,
        __dirname,
        LOGS_DIR,
        getFlag,
        getOption,
        getCsvOption,
        expandRunId,
        loadContentResolver: () => import('../services/contentResolver.js'),
        runPlayCommand: async (options) => {
          const { runPlay } = await import('./playCommand.js');
          return await runPlay(options);
        },
      });
      return;
    }

    const generationCommandHandler = getGenerationCommandHandler(command);
    if (generationCommandHandler) {
      await generationCommandHandler({
        args,
        evaluationRunner,
        evaluationStore,
        anovaStats,
        evalConfigLoader,
        fs,
        getFlag,
        getOption,
        expandRunId,
        ...generationRubricDependencies,
        readline,
      });
      return;
    }

    const scoringCommandHandler = getScoringCommandHandler(command);
    if (scoringCommandHandler) {
      await scoringCommandHandler({
        args,
        expandRunId,
        getFlag,
        getOption,
        ...scoringCommandDependencies,
      });
      return;
    }

    console.error(`Unknown command: ${command}`);
    console.error(
      'Available commands: list, quick, test, run, runs, report, status, watch, transcript, export, cleanup, delete-runs, resume, revert, rejudge, evaluate, backfill-first-turn, evaluate-learner, evaluate-dialogue, validate-config, chat, play',
    );
    process.exit(1);
  } catch (error) {
    console.error(theme.error(`\nError: ${error.message}`));
    if (getFlag('verbose')) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
