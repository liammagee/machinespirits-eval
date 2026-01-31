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
 *   node scripts/eval-cli.js transcript <runId> # Show full transcripts for a run
 *   node scripts/eval-cli.js status <runId>   # Quick snapshot of a run's state
 *   node scripts/eval-cli.js watch <runId>    # Live-updating progress table
 *   node scripts/eval-cli.js cleanup          # Preview stale runs (dry-run by default)
 *   node scripts/eval-cli.js cleanup --force # Actually mark stale runs as completed
 *   node scripts/eval-cli.js revert <runId>  # Revert a completed/failed run to 'running'
 *   node scripts/eval-cli.js chat            # AI conversational interface
 *
 * Options:
 *   --scenario <id>        Scenario ID or comma-separated IDs (default: all scenarios)
 *   --cluster <name>       Scenario cluster filter: single-turn, multi-turn, core, mood, benchmark, recognition, multi_turn (comma-separated OK)
 *   --profile <name>       Override profile(s) — comma-separated or single name
 *   --all-profiles         Use ALL profiles instead of the 8 factorial cells
 *   --skip-rubric          Skip AI-based rubric evaluation
 *   --verbose              Enable verbose output
 *   --runs <n>             Replications per cell (for 'run' command, default: 1)
 *   --parallelism <n>      Parallel test count (for 'run' command, default: 2)
 *   --description <text>   Description for the evaluation run
 *   --db                   Use SQLite instead of JSONL for 'watch' (slower but persistent)
 *   --refresh <ms>         Refresh interval for 'watch' (default: 2000)
 *   --force                Actually complete stale runs (for 'cleanup'; dry-run without it)
 *   --older-than <min>     Staleness threshold in minutes (for 'cleanup', default: 30)
 *
 * The default `run` uses the 2x2x2 factorial design:
 *   Factor A: Recognition prompts (off / on)
 *   Factor B: Multi-agent tutor  (single / ego+superego)
 *   Factor C: Multi-agent learner (unified / psychodynamic)
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
import { getAvailableJudge } from '../services/rubricEvaluator.js';
import { readProgressLog, getProgressLogPath } from '../services/progressLogger.js';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, '..', 'logs', 'tutor-dialogues');

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

// ── chat command ─────────────────────────────────────────────────

const CHAT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_runs',
      description: 'List recent evaluation runs. Returns run IDs, statuses, scores, and descriptions.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max runs to return (default 20)' },
          status: { type: 'string', description: 'Filter by status: running, completed, failed' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_run_report',
      description: 'Generate a full text report for a run including rankings, dimension breakdown, scenario performance, and ANOVA.',
      parameters: {
        type: 'object',
        properties: {
          runId: { type: 'string', description: 'The evaluation run ID' },
        },
        required: ['runId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_transcript',
      description: 'Get dialogue transcripts for a run, optionally filtered to a single scenario.',
      parameters: {
        type: 'object',
        properties: {
          runId: { type: 'string', description: 'The evaluation run ID' },
          scenarioId: { type: 'string', description: 'Optional scenario ID to filter' },
        },
        required: ['runId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_anova',
      description: 'Run a 2x2x2 three-way ANOVA on factorial cell data for a given run. Requires factor-tagged results.',
      parameters: {
        type: 'object',
        properties: {
          runId: { type: 'string', description: 'The evaluation run ID' },
        },
        required: ['runId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_evaluation',
      description: 'Start a new evaluation run. Can specify scenarios, profiles, cluster filters, and replications.',
      parameters: {
        type: 'object',
        properties: {
          scenarios: {
            type: 'array',
            items: { type: 'string' },
            description: 'Scenario IDs to run (omit for all)',
          },
          profiles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Profile names to test (omit for default factorial)',
          },
          cluster: {
            type: 'string',
            description: 'Scenario cluster filter: single-turn, multi-turn, or category names (core, mood, benchmark, recognition, multi_turn). Comma-separated for multiple.',
          },
          runs: { type: 'number', description: 'Replications per cell (default 1)' },
          description: { type: 'string', description: 'Description for this run' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'quick_test',
      description: 'Run a quick single-scenario test with one profile.',
      parameters: {
        type: 'object',
        properties: {
          scenarioId: { type: 'string', description: 'Scenario ID (default: new_user_first_visit)' },
          profile: { type: 'string', description: 'Profile name (default: budget)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cleanup_stale',
      description: 'Find and optionally complete stale runs stuck in "running" state.',
      parameters: {
        type: 'object',
        properties: {
          olderThanMinutes: { type: 'number', description: 'Staleness threshold (default 30)' },
          force: { type: 'boolean', description: 'Actually complete them (default false = dry run)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_options',
      description: 'List available scenarios, configurations, and profiles.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'export_results',
      description: 'Export full results for a run as JSON (run metadata, stats, scenario stats, individual results).',
      parameters: {
        type: 'object',
        properties: {
          runId: { type: 'string', description: 'The evaluation run ID' },
        },
        required: ['runId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_run',
      description: 'Mark an incomplete run as completed with whatever results exist.',
      parameters: {
        type: 'object',
        properties: {
          runId: { type: 'string', description: 'The evaluation run ID' },
        },
        required: ['runId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'revert_run',
      description: 'Revert a completed/failed run back to "running" status.',
      parameters: {
        type: 'object',
        properties: {
          runId: { type: 'string', description: 'The evaluation run ID' },
        },
        required: ['runId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_run_status',
      description: 'Get detailed status of a run including per-profile stats and scenario breakdown.',
      parameters: {
        type: 'object',
        properties: {
          runId: { type: 'string', description: 'The evaluation run ID' },
        },
        required: ['runId'],
      },
    },
  },
];

function truncate(str, maxLen = 4000) {
  if (typeof str !== 'string') str = JSON.stringify(str, null, 2);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + `\n... (truncated, ${str.length - maxLen} chars omitted)`;
}

async function executeTool(name, params) {
  switch (name) {
    case 'list_runs': {
      const runs = evaluationStore.listRuns({
        limit: params.limit || 20,
        status: params.status || null,
      });
      return JSON.stringify(runs, null, 2);
    }
    case 'get_run_report': {
      const report = evaluationRunner.generateReport(params.runId);
      return truncate(report);
    }
    case 'get_transcript': {
      const results = evaluationStore.getResults(params.runId, {
        scenarioId: params.scenarioId || null,
      });
      if (results.length === 0) return 'No results found for this run.';

      const lines = [];
      for (const r of results) {
        lines.push(`--- ${r.scenarioName || r.scenarioId} | ${r.profileName} | score=${r.overallScore?.toFixed(1) ?? '--'} ---`);
        let printed = false;
        if (r.dialogueId) {
          const files = fs.existsSync(LOGS_DIR)
            ? fs.readdirSync(LOGS_DIR).filter(f => f.includes(r.dialogueId))
            : [];
          if (files.length > 0) {
            try {
              const dialogue = JSON.parse(fs.readFileSync(path.join(LOGS_DIR, files[0]), 'utf-8'));
              for (const entry of (dialogue.dialogueTrace || [])) {
                lines.push(`[${(entry.role || 'unknown').toUpperCase()}] ${entry.content || ''}`);
              }
              printed = true;
            } catch (e) { /* fall through */ }
          }
        }
        if (!printed && r.suggestions?.length > 0) {
          lines.push('Suggestions:');
          for (const s of r.suggestions) {
            lines.push(`  • ${typeof s === 'string' ? s : (s.text || s.message || JSON.stringify(s))}`);
          }
        }
        if (r.evaluationReasoning) lines.push(`Judge: ${r.evaluationReasoning}`);
        lines.push('');
      }
      return truncate(lines.join('\n'));
    }
    case 'run_anova': {
      const scoreTypes = [
        { column: 'overall_score', label: 'Overall Score' },
        { column: 'base_score', label: 'Base Score' },
        { column: 'recognition_score', label: 'Recognition Score' },
      ];
      const parts = [];
      for (const { column, label } of scoreTypes) {
        const cellData = evaluationStore.getFactorialCellData(params.runId, { scoreColumn: column });
        const totalSamples = Object.values(cellData).reduce((s, arr) => s + arr.length, 0);
        if (totalSamples === 0) continue;
        if (totalSamples <= 8) {
          parts.push(`${label}: Only ${totalSamples} samples — need > 8 for ANOVA.`);
          continue;
        }
        const result = anovaStats.runThreeWayANOVA(cellData);
        parts.push(anovaStats.formatANOVAReport(result, { scoreLabel: label }));
      }
      return parts.length > 0 ? parts.join('\n') : 'No factorial cell data found for this run.';
    }
    case 'run_evaluation': {
      const scenarios = params.scenarios?.length > 0 ? params.scenarios : 'all';
      let configurations = 'factorial';
      if (params.profiles?.length > 0) {
        configurations = params.profiles.map(name => ({
          provider: null, model: null, profileName: name, label: name,
        }));
      }
      const result = await evaluationRunner.runEvaluation({
        scenarios,
        configurations,
        runsPerConfig: params.runs || 1,
        description: params.description || 'Chat-initiated evaluation',
        scenarioFilter: params.cluster || null,
      });
      return JSON.stringify(result, null, 2);
    }
    case 'quick_test': {
      const config = { profileName: params.profile || 'budget' };
      const result = await evaluationRunner.quickTest(config, {
        scenarioId: params.scenarioId || 'new_user_first_visit',
      });
      return truncate(JSON.stringify(result, null, 2));
    }
    case 'cleanup_stale': {
      const result = evaluationStore.autoCompleteStaleRuns({
        olderThanMinutes: params.olderThanMinutes || 30,
        dryRun: !params.force,
      });
      return JSON.stringify(result, null, 2);
    }
    case 'list_options': {
      const opts = evaluationRunner.listOptions();
      return truncate(JSON.stringify({
        scenarios: opts.scenarios.map(s => ({ id: s.id, name: s.name, isMultiTurn: s.isMultiTurn })),
        profiles: opts.profiles?.map(p => ({ name: p.name, description: p.description })),
      }, null, 2));
    }
    case 'export_results': {
      const data = evaluationStore.exportToJson(params.runId);
      return truncate(JSON.stringify(data, null, 2));
    }
    case 'complete_run': {
      const result = evaluationStore.completeRun(params.runId);
      return JSON.stringify(result, null, 2);
    }
    case 'revert_run': {
      const run = evaluationStore.getRun(params.runId);
      if (!run) return `Run not found: ${params.runId}`;
      if (run.status === 'running') return `Run ${params.runId} is already running.`;
      evaluationStore.updateRun(params.runId, { status: 'running' });
      return `Reverted run ${params.runId} from '${run.status}' to 'running'.`;
    }
    case 'get_run_status': {
      const runData = evaluationRunner.getRunResults(params.runId);
      return truncate(JSON.stringify({
        run: runData.run,
        stats: runData.stats,
        resultCount: runData.results.length,
      }, null, 2));
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

async function callOpenRouter(messages, model, apiKey) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools: CHAT_TOOLS,
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter API error: ${res.status} — ${body.slice(0, 300)}`);
  }

  return res.json();
}

async function runChat() {
  const judge = getAvailableJudge();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY not set. Required for chat mode.');
    process.exit(1);
  }
  const model = `${judge.provider === 'openrouter' ? '' : judge.provider + '/'}${judge.model}`;
  const chatModel = judge.provider === 'openrouter' ? judge.model : `${judge.provider}/${judge.model}`;

  console.log(`\nEval Chat (model: ${chatModel})`);
  console.log('Type your questions about evaluation runs. Use "quit" or "exit" to leave.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'eval> ',
  });

  const messages = [
    {
      role: 'system',
      content: `You are an AI assistant for a tutor evaluation system. You help users inspect evaluation runs, view reports, run ANOVA analyses, start new evaluations, and manage run lifecycle.

You have access to tools that query a SQLite database of evaluation runs and results. Each run tests tutor AI configurations against pedagogical scenarios and scores them with an AI judge.

Key concepts:
- Runs contain multiple test results (scenario × profile combinations)
- The 2×2×2 factorial design tests: Recognition prompts (A), Multi-agent tutor (B), Multi-agent learner (C)
- ANOVA analyses test significance of these factors
- Profiles define tutor configurations (model, architecture, etc.)
- Scenarios define learner situations to evaluate

When showing data, be concise. Summarise key findings rather than dumping raw JSON. Use tables where helpful.
When the user asks to see "recent runs" or "latest", use list_runs.
When asked about a specific run, use get_run_report or get_run_status.
For statistical analysis, use run_anova.
To see available test scenarios and profiles, use list_options.`,
    },
  ];

  const prompt = () => rl.prompt();

  rl.on('close', () => {
    console.log('\nBye.');
    process.exit(0);
  });

  prompt();

  for await (const line of rl) {
    const input = line.trim();
    if (!input) { prompt(); continue; }
    if (input === 'quit' || input === 'exit') {
      console.log('Bye.');
      process.exit(0);
    }

    messages.push({ role: 'user', content: input });

    try {
      let done = false;
      while (!done) {
        const response = await callOpenRouter(messages, chatModel, apiKey);
        const choice = response.choices?.[0];
        if (!choice) {
          console.log('[No response from model]');
          done = true;
          break;
        }

        const msg = choice.message;
        messages.push(msg);

        // Handle tool calls
        if (msg.tool_calls?.length > 0) {
          for (const tc of msg.tool_calls) {
            const fnName = tc.function.name;
            let fnArgs = {};
            try { fnArgs = JSON.parse(tc.function.arguments || '{}'); } catch (e) { /* empty */ }

            process.stdout.write(`  [calling ${fnName}...]\n`);
            let result;
            try {
              result = await executeTool(fnName, fnArgs);
            } catch (err) {
              result = `Error: ${err.message}`;
            }

            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: typeof result === 'string' ? result : JSON.stringify(result),
            });
          }
          // Loop back to get the model's summary of tool results
        } else {
          // Text response — print it
          const text = msg.content || '';
          console.log(`\n${text}\n`);
          done = true;
        }
      }
    } catch (err) {
      console.error(`\nError: ${err.message}\n`);
    }

    prompt();
  }
}

async function main() {
  try {
    switch (command) {
      case 'list': {
        const options = evaluationRunner.listOptions();

        // Factorial design — the default run mode
        if (options.profiles?.length) {
          const cellProfiles = options.profiles.filter(p => p.name.startsWith('cell_'));
          const regularProfiles = options.profiles.filter(p => !p.name.startsWith('cell_'));

          if (cellProfiles.length > 0) {
            console.log('\n2x2x2 Factorial Cells (default `run` configuration):');
            console.log('  A: Recognition  B: Tutor arch.  C: Learner arch.\n');
            for (const p of cellProfiles) {
              const arch = p.dialogueEnabled ? 'ego+superego' : 'single-agent';
              console.log(`  ${p.name.padEnd(32)} ${arch.padEnd(14)} ${p.description || ''}`);
            }
          }

          if (regularProfiles.length > 0) {
            console.log('\nOther Profiles (use --profile <name> or --all-profiles):');
            for (const p of regularProfiles) {
              const ego = p.egoProvider && p.egoModel ? ` [${p.egoProvider}/${p.egoModel}]` : '';
              const dialogue = p.dialogueEnabled ? ` (dialogue: ${p.maxRounds}r)` : ' (single)';
              console.log(`  ${p.name}${ego}${dialogue} - ${p.description || ''}`);
            }
          }
        }

        console.log('\nScenarios:');
        for (const s of options.scenarios) {
          const mt = s.isMultiTurn ? ` [${s.turnCount}T]` : '';
          console.log(`  ${s.id}${mt} - ${s.name || s.id}`);
        }

        console.log('\nProvider Configurations:');
        for (const c of options.configurations) {
          console.log(`  ${c.provider}/${c.model}`);
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
        const clusterOpt = getOption('cluster');
        const scenarioOpt = getOption('scenario');
        const allProfiles = getFlag('all-profiles');

        // --cluster and --scenario are mutually exclusive
        if (clusterOpt && scenarioOpt) {
          console.error('Error: --cluster and --scenario are mutually exclusive.');
          process.exit(1);
        }

        const scenarios = scenarioOpt
          ? scenarioOpt.split(',').map(s => s.trim())
          : 'all';

        // Determine configurations: explicit --profile overrides everything,
        // --all-profiles loads every profile, default is the 8 factorial cells.
        const profileOpt = getOption('config') || getOption('profile');
        let configurations;
        let isFactorial = false;

        if (profileOpt) {
          // Explicit profile selection (single or comma-separated)
          const profileNames = profileOpt.includes(',')
            ? profileOpt.split(',').map(s => s.trim())
            : [profileOpt];
          configurations = profileNames.map(name => ({
            provider: null,
            model: null,
            profileName: name,
            label: name,
          }));
          // Check if the selection happens to be factorial cells
          isFactorial = profileNames.every(n => n.startsWith('cell_'));
        } else if (allProfiles) {
          configurations = 'profiles';
        } else {
          // Default: 2×2×2 factorial design
          isFactorial = true;
          configurations = 'factorial';
        }

        if (isFactorial) {
          const cellCount = 8;
          console.log('\n2x2x2 Factorial Design');
          console.log(`  Factor A: Recognition      (off / on)`);
          console.log(`  Factor B: Tutor arch.      (single / ego+superego)`);
          console.log(`  Factor C: Learner arch.    (unified / psychodynamic)`);
          console.log(`  Cells: ${cellCount}  |  Runs/cell: ${runsPerConfig}  |  Per scenario: ${cellCount * runsPerConfig}`);
          console.log('');
        }

        if (clusterOpt) {
          console.log(`Cluster filter: ${clusterOpt}\n`);
        }
        console.log('Starting evaluation run...\n');
        const result = await evaluationRunner.runEvaluation({
          scenarios,
          configurations,
          runsPerConfig,
          parallelism,
          skipRubricEval,
          description: description || (isFactorial ? '2x2x2 Factorial Evaluation' : null),
          verbose,
          scenarioFilter: clusterOpt || null,
        });
        console.log('\nEvaluation complete.');
        console.log(JSON.stringify(result, null, 2));

        // Factorial post-analysis: print cell means and ANOVA for each score type
        if (result.runId) {
          const scoreTypes = [
            { column: 'overall_score', label: 'Overall Score' },
            { column: 'base_score', label: 'Base Score' },
            { column: 'recognition_score', label: 'Recognition Score' },
          ];

          for (const { column, label } of scoreTypes) {
            const cellData = evaluationStore.getFactorialCellData(result.runId, { scoreColumn: column });
            const cellKeys = Object.keys(cellData);
            const totalSamples = cellKeys.reduce((sum, k) => sum + cellData[k].length, 0);

            if (totalSamples === 0) continue;

            console.log('\n' + '='.repeat(70));
            console.log(`  FACTORIAL ANALYSIS: ${label.toUpperCase()}`);
            console.log('='.repeat(70));

            for (const key of cellKeys.sort()) {
              const scores = cellData[key];
              const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
              const sd = scores.length > 1
                ? Math.sqrt(scores.reduce((acc, s) => acc + (s - mean) ** 2, 0) / (scores.length - 1))
                : 0;
              const cellLabel = key.replace(/r(\d)_t(\d)_l(\d)/, (_, r, t, l) =>
                `Recog=${r === '1' ? 'Y' : 'N'}  Tutor=${t === '1' ? 'Multi' : 'Single'}  Learner=${l === '1' ? 'Psycho' : 'Unified'}`
              );
              console.log(`  ${cellLabel.padEnd(52)} mean=${mean.toFixed(1)}  sd=${sd.toFixed(1)}  n=${scores.length}`);
            }

            if (totalSamples > 8) {
              const anovaResult = anovaStats.runThreeWayANOVA(cellData);
              console.log(anovaStats.formatANOVAReport(anovaResult, { scoreLabel: label }));
            } else {
              console.log(`\n  Need > 8 total samples for ANOVA (have ${totalSamples}). Increase --runs.`);
            }
          }
        }
        break;
      }

      case 'runs': {
        const limit = parseInt(getOption('limit', '20'), 10);
        const statusFilter = getOption('status') || null;
        const runs = evaluationStore.listRuns({ limit, status: statusFilter });

        if (runs.length === 0) {
          console.log('\nNo evaluation runs found.');
          break;
        }

        console.log(`\nEvaluation runs (${runs.length} most recent):\n`);
        console.log(
          '  ' +
          'ID'.padEnd(40) +
          'Status'.padEnd(12) +
          'Progress'.padEnd(18) +
          'Avg'.padEnd(7) +
          'Created'.padEnd(24) +
          'Description'
        );
        console.log('  ' + '-'.repeat(120));

        for (const run of runs) {
          const created = run.createdAt
            ? new Date(run.createdAt).toLocaleString()
            : '--';
          // Progress: show completed/total (pct%)
          let progress = '--';
          if (run.totalTests > 0) {
            const pct = run.progressPct != null ? run.progressPct : 100;
            progress = `${run.completedResults}/${run.totalTests} (${pct}%)`;
          } else if (run.completedResults > 0) {
            progress = `${run.completedResults} done`;
          }
          const avg = run.avgScore != null ? run.avgScore.toFixed(1) : '--';
          const desc = run.description || '';
          console.log(
            '  ' +
            run.id.padEnd(40) +
            (run.status || '--').padEnd(12) +
            progress.padEnd(18) +
            avg.padEnd(7) +
            created.padEnd(24) +
            desc
          );
        }
        console.log('');
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
          const createdLocal = runData.run.createdAt
            ? new Date(runData.run.createdAt).toLocaleString()
            : '--';
          console.log(`Created: ${createdLocal}`);
          console.log(`Description: ${runData.run.description || 'N/A'}`);
          console.log(`Tests: ${runData.run.totalTests || runData.results.length}`);

          if (runData.stats.length > 0) {
            console.log('\nTop performers:');
            for (const stat of runData.stats.slice(0, 10)) {
              const label = stat.profileName || `${stat.provider}/${stat.model}`;
              const base = stat.avgBaseScore != null ? ` base=${stat.avgBaseScore.toFixed(1)}` : '';
              const recog = stat.avgRecognitionScore != null ? ` recog=${stat.avgRecognitionScore.toFixed(1)}` : '';
              console.log(`  ${label}: avg=${stat.avgScore?.toFixed(1) || '--'}${base}${recog} (${stat.totalTests} tests)`);
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

      case 'transcript': {
        const runId = args.find(a => !a.startsWith('--') && a !== 'transcript');
        if (!runId) {
          console.error('Usage: eval-cli.js transcript <runId> [--scenario <id>]');
          process.exit(1);
        }

        const scenarioFilter = getOption('scenario');
        const results = evaluationStore.getResults(runId, {
          scenarioId: scenarioFilter || null,
        });

        if (results.length === 0) {
          console.log(`\nNo results found for run: ${runId}`);
          break;
        }

        console.log(`\nTranscripts for run: ${runId} (${results.length} results)\n`);

        for (const result of results) {
          console.log('='.repeat(80));
          console.log(`Scenario: ${result.scenarioName || result.scenarioId}`);
          console.log(`Profile:  ${result.profileName || `${result.provider}/${result.model}`}`);
          console.log(`Score:    ${result.overallScore != null ? result.overallScore.toFixed(1) : '--'}  |  Success: ${result.success}`);
          console.log('-'.repeat(80));

          // Try dialogue log file first
          let printed = false;
          if (result.dialogueId) {
            // Search for the dialogue file (may include date prefix in filename)
            const files = fs.existsSync(LOGS_DIR)
              ? fs.readdirSync(LOGS_DIR).filter(f => f.includes(result.dialogueId))
              : [];

            if (files.length > 0) {
              try {
                const dialogue = JSON.parse(fs.readFileSync(path.join(LOGS_DIR, files[0]), 'utf-8'));
                const trace = dialogue.dialogueTrace || [];
                for (const entry of trace) {
                  const role = (entry.role || entry.speaker || 'unknown').toUpperCase();
                  const content = entry.content || entry.message || entry.text || '';
                  console.log(`[${role}] ${content}`);
                  console.log('');
                }
                if (trace.length > 0) printed = true;
              } catch (e) {
                // Fall through to suggestions
              }
            }
          }

          // Fall back to suggestions / raw response from DB
          if (!printed) {
            if (result.suggestions?.length > 0) {
              console.log('Suggestions:');
              for (const s of result.suggestions) {
                const text = typeof s === 'string' ? s : (s.text || s.content || JSON.stringify(s));
                console.log(`  • ${text}`);
              }
              console.log('');
            }
            if (result.evaluationReasoning) {
              console.log('Judge reasoning:');
              console.log(`  ${result.evaluationReasoning}`);
              console.log('');
            }
          }

          if (result.errorMessage) {
            console.log(`ERROR: ${result.errorMessage}`);
            console.log('');
          }
        }

        // Also check for interaction evals
        const interactionEvals = evaluationStore.listInteractionEvals({ limit: 200 });
        const runInteractions = interactionEvals.filter(e => e.runId === runId);

        if (runInteractions.length > 0) {
          console.log('\n' + '='.repeat(80));
          console.log('  INTERACTION TRANSCRIPTS');
          console.log('='.repeat(80));

          for (const ie of runInteractions) {
            const full = evaluationStore.getInteractionEval(ie.evalId);
            if (!full) continue;

            console.log(`\nScenario: ${full.scenarioName || full.scenarioId}`);
            console.log(`Tutor:    ${full.tutorProfile}  |  Learner: ${full.learnerProfile}`);
            console.log(`Turns:    ${full.turnCount}  |  Score: ${full.judgeOverallScore ?? '--'}`);
            console.log('-'.repeat(80));

            if (full.formattedTranscript) {
              console.log(full.formattedTranscript);
            } else if (full.turns?.length > 0) {
              for (const turn of full.turns) {
                const speaker = (turn.phase || turn.role || 'unknown').toUpperCase();
                console.log(`[Turn ${turn.turnNumber || '?'}] ${speaker}:`);
                console.log(turn.externalMessage || turn.content || '');
                console.log('');
              }
            }
          }
        }

        break;
      }

      case 'cleanup': {
        const force = getFlag('force');
        const threshold = parseInt(getOption('older-than', '30'), 10);

        console.log(`\nScanning for stale runs (running > ${threshold} minutes)...`);

        // Dry-run by default; require --force to actually complete
        const dryRun = !force;
        if (dryRun) console.log('  (dry run — pass --force to actually complete stale runs)\n');

        const result = evaluationStore.autoCompleteStaleRuns({
          olderThanMinutes: threshold,
          dryRun,
        });

        if (result.found === 0) {
          console.log('No stale runs found.');
        } else if (dryRun) {
          console.log(`Found ${result.found} stale run(s):\n`);
          for (const run of result.runs) {
            console.log(`  ${run.id}  age=${run.ageMinutes}m  results=${run.resultsFound}  desc="${run.description || ''}"` );
          }
          console.log('\nRe-run with --force to mark these as completed.');
        } else {
          console.log(`Processed ${result.completed} stale run(s):\n`);
          for (const run of result.runs) {
            const status = run.status || (run.alreadyCompleted ? 'already completed' : 'unknown');
            const partial = run.wasPartial ? ` (partial: ${run.completionRate}%)` : '';
            console.log(`  ${run.runId}  → ${status}${partial}  results=${run.resultsFound || '--'}`);
          }
        }

        console.log('');
        break;
      }

      case 'revert': {
        const runId = args.find(a => !a.startsWith('--') && a !== 'revert');
        if (!runId) {
          console.error('Usage: eval-cli.js revert <runId>');
          process.exit(1);
        }

        const run = evaluationStore.getRun(runId);
        if (!run) {
          console.error(`Run not found: ${runId}`);
          process.exit(1);
        }

        if (run.status === 'running') {
          console.log(`Run ${runId} is already in 'running' state.`);
          break;
        }

        console.log(`Reverting run ${runId} from '${run.status}' → 'running'...`);
        evaluationStore.updateRun(runId, { status: 'running' });
        console.log('Done.');
        break;
      }

      case 'chat': {
        await runChat();
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Available commands: list, quick, test, run, runs, report, status, watch, transcript, cleanup, revert, chat');
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
