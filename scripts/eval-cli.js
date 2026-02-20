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
 *   node scripts/eval-cli.js export <runId>   # Export results to file for offline review
 *   node scripts/eval-cli.js cleanup          # Preview stale runs (dry-run by default)
 *   node scripts/eval-cli.js cleanup --force # Actually mark stale runs as completed
 *   node scripts/eval-cli.js resume <runId>   # Resume an incomplete run (re-run missing tests)
 *   node scripts/eval-cli.js revert <runId>  # Revert a completed/failed run to 'running'
 *   node scripts/eval-cli.js rejudge <runId> # Re-run AI judge (adds new rows for reliability)
 *   node scripts/eval-cli.js rejudge <runId> --overwrite  # Re-run AI judge (replaces existing)
 *   node scripts/eval-cli.js evaluate <runId> # Judge skip-rubric results via claude CLI
 *   node scripts/eval-cli.js evaluate <runId> --follow  # Poll & judge results as they appear
 *   node scripts/eval-cli.js evaluate-learner <runId>  # Score learner turns from multi-turn interactions
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
 *   --skip-rubric          Skip AI-based rubric evaluation
 *   --verbose              Enable verbose output
 *   --runs <n>             Replications per cell (for 'run' command, default: 1)
 *   --parallelism <n>      Parallel test count (for 'run' command, default: 2)
 *   --description <text>   Description for the evaluation run
 *   --db                   Use SQLite instead of JSONL for 'watch' (slower but persistent)
 *   --follow               Poll for new results in 'evaluate' (live follow mode)
 *   --refresh <ms>         Refresh interval for 'watch' (default: 2000) or 'evaluate --follow' (default: 5000)
 *   --force                Actually complete stale runs (for 'cleanup'; dry-run without it)
 *   --older-than <min>     Staleness threshold in minutes (for 'cleanup', default: 30)
 *   --dry-run              Use mock data instead of API calls (no API keys required)
 *   --live                 Auto-refresh mode for 'runs' command
 *   --as <side>            For 'play': tutor or learner (default: tutor)
 *   --role <role>          For 'play': ego, superego, or both (default: ego)
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
import {
  getAvailableJudge,
  buildEvaluationPrompt,
  calculateOverallScore,
  calculateBaseScore,
  calculateRecognitionScore,
} from '../services/rubricEvaluator.js';
import { buildLearnerEvaluationPrompt, calculateLearnerOverallScore } from '../services/learnerRubricEvaluator.js';
import { readProgressLog, getProgressLogPath } from '../services/progressLogger.js';
import * as evalConfigLoader from '../services/evalConfigLoader.js';
const { getScenario } = evalConfigLoader;
import { formatTranscript } from '../services/transcriptFormatter.js';
import theme from '../services/cliTheme.js';
import { spawn } from 'child_process';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, '..', 'logs', 'tutor-dialogues');

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith('--')) || 'list';

function getFlag(name) {
  return args.includes(`--${name}`);
}

function getOption(name, defaultValue = undefined) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return defaultValue;
  return args[idx + 1];
}

import { isPidAlive } from '../services/processUtils.js';

// ── watch / status helpers ────────────────────────────────────────

function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

/**
 * Format a single dialogue trace entry for display.
 * Handles both legacy format (role/speaker/content) and the structured
 * multi-agent format (agent/action/suggestions/feedback).
 */
function formatTraceEntry(entry) {
  // Legacy format
  if (entry.role || entry.speaker) {
    const role = (entry.role || entry.speaker).toUpperCase();
    const content = entry.content || entry.message || entry.text || '';
    return `[${role}] ${content}`;
  }

  // Structured multi-agent format
  const agent = (entry.agent || 'unknown').toUpperCase();
  const action = entry.action || '';

  switch (action) {
    case 'context_input': {
      const ctx = entry.contextData || {};
      const parts = [];
      if (ctx.currentPage) parts.push(ctx.currentPage.replace(/^\*+:\s*/, ''));
      if (ctx.strugglesCount) parts.push(`${ctx.strugglesCount} struggle signals`);
      if (ctx.sessions) parts.push(`${ctx.sessions} prior sessions`);
      return `[CONTEXT] ${parts.length ? parts.join(', ') : '(scenario input)'}`;
    }
    case 'generate': {
      const titles = (entry.suggestions || []).map((s) => s.title || s.type).join('; ');
      return `[EGO → SUPEREGO] Generated: ${titles}`;
    }
    case 'review': {
      const verdict = entry.verdict || {};
      const approved = entry.approved ?? verdict.approved;
      const tag = approved ? '✓ APPROVED' : '→ REVISE';
      const feedback = entry.feedback || verdict.feedback || '';
      const summary = feedback.length > 200 ? feedback.substring(0, 200) + '…' : feedback;
      return `[SUPEREGO ${tag}] ${summary}`;
    }
    case 'revise': {
      const titles = (entry.suggestions || []).map((s) => s.title || s.type).join('; ');
      return `[EGO revised] ${titles}`;
    }
    case 'final_output': {
      const detail = entry.contextSummary || entry.detail || `Turn ${(entry.turnIndex || 0) + 1} complete`;
      return `[OUTPUT] ${detail}`;
    }
    case 'turn_action': {
      const learnerMsg = entry.contextSummary || entry.detail || '';
      return `[LEARNER] ${learnerMsg}`;
    }
    default: {
      const content = entry.content || entry.message || entry.text || entry.contextSummary || action;
      return `[${agent}:${action}] ${content}`;
    }
  }
}

/**
 * Build a scenario×profile grid from JSONL events.
 * Returns { scenarios, profiles, grid, completedTests, totalTests, runDone }.
 */
function buildGridFromEvents(events) {
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
        score: ev.overallScore,
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
 * Render the runs table as a formatted string (reusable for one-shot and --live).
 */
function renderRunsTable(runs) {
  const lines = [];
  lines.push(
    '  ' +
      theme.header('ID'.padEnd(40)) +
      theme.header('Status'.padEnd(12)) +
      theme.header('Progress'.padEnd(18)) +
      theme.header('Avg'.padEnd(7)) +
      theme.header('Duration'.padEnd(10)) +
      theme.header('Created'.padEnd(24)) +
      theme.header('Description'),
  );
  lines.push('  ' + theme.dim('-'.repeat(130)));

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
    const avg = run.avgScore != null ? run.avgScore.toFixed(1) : '--';
    let duration = '--';
    if (run.durationMs != null) {
      const totalSec = Math.round(run.durationMs / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      duration = m > 0 ? `${m}m ${s}s` : `${s}s`;
    }
    const desc = run.description || '';
    const models = run.models && run.models.length > 0 ? run.models.join(', ') : '--';
    lines.push(
      '  ' +
        theme.id(run.id.padEnd(40)) +
        theme.status((run.status || '--').padEnd(12)) +
        progress.padEnd(18) +
        theme.score(avg.padEnd(7)) +
        duration.padEnd(10) +
        theme.dim(created.padEnd(24)) +
        desc,
    );
    if (models !== '--') {
      lines.push('  ' + `  Models: ${theme.model(models)}`);
    }
  }
  return lines.join('\n');
}

/**
 * Render the scenario×profile grid table as a string.
 */
function renderGrid({ scenarios, profiles, grid, completedTests, totalTests, runDone, durationMs }) {
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
  const header = ''.padEnd(scenarioColWidth) + ' | ' + profiles.map((p) => theme.header(p.padEnd(profileColWidth))).join(' | ');
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
      description:
        'Generate a full text report for a run including rankings, dimension breakdown, scenario performance, and ANOVA.',
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
      description:
        'Run a 2x2x2 three-way ANOVA on factorial cell data for a given run. Requires factor-tagged results.',
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
            description:
              'Scenario cluster filter: single-turn, multi-turn, or category names (core, mood, benchmark, recognition, multi_turn). Comma-separated for multiple.',
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
        lines.push(
          `--- ${r.scenarioName || r.scenarioId} | ${r.profileName} | score=${r.overallScore?.toFixed(1) ?? '--'} ---`,
        );
        let printed = false;
        if (r.dialogueId) {
          const files = fs.existsSync(LOGS_DIR) ? fs.readdirSync(LOGS_DIR).filter((f) => f.includes(r.dialogueId)) : [];
          if (files.length > 0) {
            try {
              const dialogue = JSON.parse(fs.readFileSync(path.join(LOGS_DIR, files[0]), 'utf-8'));
              for (const entry of dialogue.dialogueTrace || []) {
                lines.push(`[${(entry.role || 'unknown').toUpperCase()}] ${entry.content || ''}`);
              }
              printed = true;
            } catch (e) {
              /* fall through */
            }
          }
        }
        if (!printed && r.suggestions?.length > 0) {
          lines.push('Suggestions:');
          for (const s of r.suggestions) {
            lines.push(`  • ${typeof s === 'string' ? s : s.text || s.message || JSON.stringify(s)}`);
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
        configurations = params.profiles.map((name) => ({
          provider: null,
          model: null,
          profileName: name,
          label: name,
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
      return truncate(
        JSON.stringify(
          {
            scenarios: opts.scenarios.map((s) => ({ id: s.id, name: s.name, isMultiTurn: s.isMultiTurn })),
            profiles: opts.profiles?.map((p) => ({ name: p.name, description: p.description })),
          },
          null,
          2,
        ),
      );
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
      return truncate(
        JSON.stringify(
          {
            run: runData.run,
            stats: runData.stats,
            resultCount: runData.results.length,
          },
          null,
          2,
        ),
      );
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
      Authorization: `Bearer ${apiKey}`,
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
  const _model = `${judge.provider === 'openrouter' ? '' : judge.provider + '/'}${judge.model}`;
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
    if (!input) {
      prompt();
      continue;
    }
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
            try {
              fnArgs = JSON.parse(tc.function.arguments || '{}');
            } catch (e) {
              /* empty */
            }

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
          const cellProfiles = options.profiles.filter((p) => p.name.startsWith('cell_'));
          const regularProfiles = options.profiles.filter((p) => !p.name.startsWith('cell_'));

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
        const dryRun = getFlag('dry-run');
        const evalSettingsQt = evalConfigLoader.getEvalSettings();
        const skipRubricEval = dryRun ? false : getFlag('skip-rubric') || !evalSettingsQt.useAIJudge;
        const config = { profileName: profile };

        console.log(
          `\nRunning quick test (profile: ${profile}, scenario: ${scenarioId}${dryRun ? ', dry-run' : ''})...\n`,
        );
        const result = await evaluationRunner.quickTest(config, {
          scenarioId,
          verbose,
          skipRubricEval,
          dryRun,
        });
        console.log('\nResult:');
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'run': {
        const verbose = getFlag('verbose');
        const dryRun = getFlag('dry-run');
        // CLI --use-rubric forces rubric on; --skip-rubric forces off; otherwise use config default
        // --dry-run always enables rubric (mock judge has no cost)
        const evalSettings = evalConfigLoader.getEvalSettings();
        const skipRubricEval = dryRun
          ? false
          : getFlag('use-rubric')
            ? false
            : getFlag('skip-rubric') || !evalSettings.useAIJudge;
        const runsPerConfig = parseInt(getOption('runs', '1'), 10);
        const parallelism = parseInt(getOption('parallelism', '2'), 10);
        const description = getOption('description');
        const clusterOpt = getOption('cluster');
        const scenarioOpt = getOption('scenario') || getOption('scenarios');
        const allProfiles = getFlag('all-profiles');
        const modelOverride = getOption('model');
        const egoModelOverride = getOption('ego-model');
        const superegoModelOverride = getOption('superego-model');
        const learnerModelOverride = getOption('learner-model');
        const learnerEgoModelOverride = getOption('learner-ego-model');
        const learnerSuperegoModelOverride = getOption('learner-superego-model');
        const transcriptMode = getFlag('transcript');
        const maxTokensOverride = getOption('max-tokens');

        // --cluster and --scenario are mutually exclusive
        if (clusterOpt && scenarioOpt) {
          console.error('Error: --cluster and --scenario are mutually exclusive.');
          process.exit(1);
        }

        const scenarios = scenarioOpt ? scenarioOpt.split(',').map((s) => s.trim()) : 'all';

        // Determine configurations: explicit --profile overrides everything,
        // --all-profiles loads every profile, default is the 8 factorial cells.
        const profileOpt = getOption('config') || getOption('profile') || getOption('profiles');
        let configurations;
        let isFactorial = false;

        if (profileOpt) {
          // Explicit profile selection (single or comma-separated)
          const profileNames = profileOpt.includes(',') ? profileOpt.split(',').map((s) => s.trim()) : [profileOpt];
          configurations = profileNames.map((name) => ({
            provider: null,
            model: null,
            profileName: name,
            label: name,
          }));
          // Check if the selection happens to be factorial cells
          isFactorial = profileNames.every((n) => n.startsWith('cell_'));
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
          console.log(`  Factor C: Learner arch.    (unified / ego_superego)`);
          console.log(
            `  Cells: ${cellCount}  |  Runs/cell: ${runsPerConfig}  |  Per scenario: ${cellCount * runsPerConfig}`,
          );
          if (modelOverride) {
            console.log(`  Model override: ${modelOverride}`);
          } else if (egoModelOverride || superegoModelOverride) {
            if (egoModelOverride) console.log(`  Ego model override: ${egoModelOverride}`);
            if (superegoModelOverride) console.log(`  Superego model override: ${superegoModelOverride}`);
          }
          if (learnerModelOverride) {
            console.log(`  Learner model override: ${learnerModelOverride}`);
          } else if (learnerEgoModelOverride || learnerSuperegoModelOverride) {
            if (learnerEgoModelOverride) console.log(`  Learner ego model override: ${learnerEgoModelOverride}`);
            if (learnerSuperegoModelOverride) console.log(`  Learner superego model override: ${learnerSuperegoModelOverride}`);
          }
          if (maxTokensOverride) console.log(`  Max tokens override: ${maxTokensOverride}`);
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
          description:
            description ||
            (dryRun ? 'Dry-run evaluation (mock data)' : isFactorial ? '2x2x2 Factorial Evaluation' : null),
          verbose,
          scenarioFilter: clusterOpt || null,
          modelOverride: modelOverride || null,
          egoModelOverride: egoModelOverride || null,
          superegoModelOverride: superegoModelOverride || null,
          learnerModelOverride: learnerModelOverride || null,
          learnerEgoModelOverride: learnerEgoModelOverride || null,
          learnerSuperegoModelOverride: learnerSuperegoModelOverride || null,
          dryRun,
          transcriptMode,
          maxTokensOverride: maxTokensOverride ? parseInt(maxTokensOverride, 10) : null,
        });
        // Extract unique model aliases used across all configs (ego + superego)
        const extractAlias = (raw) => {
          if (!raw) return null;
          const dotIdx = raw.indexOf('.');
          return dotIdx !== -1 ? raw.slice(dotIdx + 1) : raw;
        };
        const modelAliases = [
          ...new Set(
            (result.stats || [])
              .flatMap((s) => [extractAlias(s.egoModel || s.model), extractAlias(s.superegoModel)])
              .filter(Boolean),
          ),
        ];

        console.log('\nEvaluation complete.');
        if (modelAliases.length > 0) {
          console.log(`Models: ${modelAliases.join(', ')}`);
        }

        // Token / cost / latency summary report
        if (result.runId) {
          const runResults = evaluationStore.getResults(result.runId);
          if (runResults.length > 0) {
            console.log('\n' + '='.repeat(80));
            console.log('  TOKEN & COST SUMMARY');
            console.log('='.repeat(80));

            // Per-result breakdown
            const header =
              '  #  | Scenario                         | In Tok  | Out Tok | API  | Rounds | Latency   | Cost';
            const divider = '  ' + '-'.repeat(header.length - 2);
            console.log(header);
            console.log(divider);

            let totalIn = 0,
              totalOut = 0,
              totalApi = 0,
              totalRounds = 0,
              totalLatency = 0,
              totalCost = 0;

            runResults.forEach((r, i) => {
              const inTok = r.input_tokens || r.inputTokens || 0;
              const outTok = r.output_tokens || r.outputTokens || 0;
              const apiCalls = r.api_calls || r.apiCalls || 0;
              const rounds = r.dialogue_rounds || r.dialogueRounds || 0;
              const latMs = r.latency_ms || r.latencyMs || 0;
              const cost = r.cost || 0;

              totalIn += inTok;
              totalOut += outTok;
              totalApi += apiCalls;
              totalRounds += rounds;
              totalLatency += latMs;
              totalCost += cost;

              const scenLabel = (r.scenario_id || r.scenarioId || '').substring(0, 32).padEnd(32);
              const latStr = latMs >= 1000 ? `${(latMs / 1000).toFixed(1)}s` : `${latMs}ms`;
              const costStr = cost > 0 ? `$${cost.toFixed(4)}` : '-';
              console.log(
                `  ${String(i + 1).padStart(2)} | ${scenLabel} | ${String(inTok).padStart(7)} | ${String(outTok).padStart(7)} | ${String(apiCalls).padStart(4)} | ${String(rounds).padStart(6)} | ${latStr.padStart(9)} | ${costStr}`,
              );
            });

            console.log(divider);
            const totalLatStr = totalLatency >= 1000 ? `${(totalLatency / 1000).toFixed(1)}s` : `${totalLatency}ms`;
            const totalCostStr = totalCost > 0 ? `$${totalCost.toFixed(4)}` : '-';
            console.log(
              `  ${'TOTAL'.padStart(2)} | ${''.padEnd(32)} | ${String(totalIn).padStart(7)} | ${String(totalOut).padStart(7)} | ${String(totalApi).padStart(4)} | ${String(totalRounds).padStart(6)} | ${totalLatStr.padStart(9)} | ${totalCostStr}`,
            );

            // Per-token cost efficiency
            const totalTok = totalIn + totalOut;
            if (totalTok > 0) {
              const avgLatPerCall = totalApi > 0 ? (totalLatency / totalApi / 1000).toFixed(2) : '-';
              console.log(
                `\n  Tokens: ${totalTok.toLocaleString()} total (${totalIn.toLocaleString()} in + ${totalOut.toLocaleString()} out)`,
              );
              console.log(
                `  Avg latency/API call: ${avgLatPerCall}s  |  Results: ${runResults.length}  |  API calls: ${totalApi}`,
              );
              if (totalCost > 0) {
                console.log(`  Cost/1K tokens: $${((totalCost / totalTok) * 1000).toFixed(4)}`);
              }
            }
            console.log('='.repeat(80));
          }
        }

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
              const sd =
                scores.length > 1
                  ? Math.sqrt(scores.reduce((acc, s) => acc + (s - mean) ** 2, 0) / (scores.length - 1))
                  : 0;
              const cellLabel = key.replace(
                /r(\d)_t(\d)_l(\d)/,
                (_, r, t, l) =>
                  `Recog=${r === '1' ? 'Y' : 'N'}  Tutor=${t === '1' ? 'Multi' : 'Single'}  Learner=${l === '1' ? 'Psycho' : 'Unified'}`,
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
        const limitOpt = getOption('limit');
        const limit = limitOpt ? parseInt(limitOpt, 10) : null;
        const statusFilter = getOption('status') || null;
        const isLive = getFlag('live');
        const refreshMs = parseInt(getOption('refresh', '3000'), 10);

        if (isLive) {
          // Live auto-refreshing mode
          let lastOutput = '';
          const poll = () => {
            const runs = evaluationStore.listRuns({ limit, status: statusFilter });
            if (runs.length === 0) {
              const output = '\nNo evaluation runs found.';
              if (output !== lastOutput) {
                process.stdout.write('\x1b[2J\x1b[H');
                console.log(theme.dim(`Runs  (${new Date().toLocaleTimeString()}, refresh ${refreshMs}ms)`));
                console.log(output);
                lastOutput = output;
              }
              return;
            }
            const output = renderRunsTable(runs);
            if (output !== lastOutput) {
              process.stdout.write('\x1b[2J\x1b[H');
              console.log(theme.dim(`Runs: ${runs.length} total  (${new Date().toLocaleTimeString()}, refresh ${refreshMs}ms)`));
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
            console.log('\nStopped watching.');
            process.exit(0);
          });
          await new Promise(() => {});
        } else {
          // One-shot mode
          const runs = evaluationStore.listRuns({ limit, status: statusFilter });
          if (runs.length === 0) {
            console.log('\nNo evaluation runs found.');
            break;
          }
          console.log(`\nEvaluation runs (${runs.length} total):\n`);
          console.log(renderRunsTable(runs));
          console.log('');
        }
        break;
      }

      case 'report': {
        const runId = args.find((a) => !a.startsWith('--') && a !== 'report');
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
        const runId = args.find((a) => !a.startsWith('--') && a !== 'status');
        if (!runId) {
          console.error('Usage: eval-cli.js status <runId>');
          process.exit(1);
        }

        // Try JSONL first for in-progress runs
        const events = readProgressLog(runId);
        if (events.length > 0) {
          const gridResult = buildGridFromEvents(events);
          const { scenarios, profiles, grid, completedTests, runDone, durationMs } = gridResult;
          let { totalTests } = gridResult;

          // Check if process is still alive (for running runs)
          let statusLabel = runDone ? 'completed' : 'running';
          const runData = evaluationRunner.getRunResults(runId);
          const pid = runData?.run?.metadata?.pid;

          // If JSONL has no run_start (totalTests=0), fall back to DB for the total
          if (totalTests === 0 && runData?.run) {
            totalTests =
              (runData.run.totalScenarios || scenarios.length) * (runData.run.totalConfigurations || profiles.length);
          }

          // For resumed runs, completed can exceed total - cap display at total
          const displayCompleted = Math.min(completedTests, totalTests);
          const pct = totalTests > 0 ? Math.min(100, Math.round((displayCompleted / totalTests) * 100)) : 0;
          if (!runDone && pid) {
            const alive = isPidAlive(pid);
            if (!alive) {
              statusLabel = `STALE (pid ${pid} dead)`;
            } else {
              statusLabel = `running (pid ${pid})`;
            }
          }

          console.log(`\nRun: ${theme.id(runId)}`);
          console.log(`Status: ${theme.status(statusLabel)}`);
          console.log(
            `Progress: ${displayCompleted}/${totalTests} tests (${pct}%)${completedTests > totalTests ? ` [${completedTests - totalTests} retried]` : ''}`,
          );
          if (durationMs) console.log(`Duration: ${formatMs(durationMs)}`);
          console.log(`Scenarios: ${scenarios.length} | Profiles: ${profiles.length}`);

          // Per-scenario completion counts
          if (scenarios.length > 0) {
            console.log('\nScenario completion:');
            for (const s of scenarios) {
              const done = profiles.filter((p) => grid[s]?.[p]).length;
              const scores = profiles.filter((p) => grid[s]?.[p]?.score != null).map((p) => grid[s][p].score);
              const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '--';
              console.log(`  ${s}: ${done}/${profiles.length} profiles done, avg=${theme.score(avg)}`);
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
            console.log(theme.header('\nTop performers:'));
            for (const r of ranked.slice(0, 5)) {
              console.log(`  ${theme.model(r.name)}: avg=${theme.score(r.avg)} (${r.count} tests)`);
            }
          }
        } else {
          // Fallback: read from SQLite
          const runData = evaluationRunner.getRunResults(runId);
          console.log(`\nRun: ${theme.id(runId)}`);
          console.log(`Status: ${theme.status(runData.run.status)}`);
          const createdLocal = runData.run.createdAt ? new Date(runData.run.createdAt).toLocaleString() : '--';
          console.log(`Created: ${theme.dim(createdLocal)}`);
          console.log(`Description: ${runData.run.description || 'N/A'}`);
          // Count unique (scenario, profile) pairs to handle rejudge duplicates
          const uniqueTests = new Set(runData.results.map((r) => `${r.scenarioId}:${r.profileName}`)).size;
          console.log(`Tests: ${runData.run.totalTests || uniqueTests}`);

          if (runData.stats.length > 0) {
            console.log(theme.header('\nTop performers:'));
            for (const stat of runData.stats.slice(0, 10)) {
              const label = stat.profileName || `${stat.provider}/${stat.model}`;
              const base = stat.avgBaseScore != null ? ` base=${stat.avgBaseScore.toFixed(1)}` : '';
              const recog = stat.avgRecognitionScore != null ? ` recog=${stat.avgRecognitionScore.toFixed(1)}` : '';
              console.log(
                `  ${theme.model(label)}: avg=${theme.score(stat.avgScore)} ${base}${recog} (${stat.totalTests} tests)`,
              );
            }
          }
        }
        console.log('');
        break;
      }

      case 'watch': {
        // Live-updating scenario×profile grid table
        const runId = args.find((a) => !a.startsWith('--') && a !== 'watch');
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
                score: r.overallScore,
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
        break;
      }

      case 'transcript': {
        const runId = args.find((a) => !a.startsWith('--') && a !== 'transcript');
        if (!runId) {
          console.error(
            'Usage: eval-cli.js transcript <runId> [--scenario <id>] [--detail play|compact|messages-only|full|bilateral]',
          );
          process.exit(1);
        }

        const scenarioFilter = getOption('scenario');
        // Determine detail level: --compact and --messages-only are shortcuts, --detail is explicit
        let detailLevel = getOption('detail') || 'play';
        if (getFlag('compact')) detailLevel = 'compact';
        if (getFlag('messages-only')) detailLevel = 'messages-only';
        if (getFlag('full')) detailLevel = 'full';
        if (getFlag('bilateral')) detailLevel = 'bilateral';

        const results = evaluationStore.getResults(runId, {
          scenarioId: scenarioFilter || null,
        });

        if (results.length === 0) {
          console.log(`\nNo results found for run: ${runId}`);
          break;
        }

        console.log(`\nTranscripts for run: ${theme.id(runId)} (${results.length} results, detail: ${detailLevel})\n`);

        for (const result of results) {
          console.log(theme.dim('='.repeat(80)));
          console.log(`Scenario: ${theme.header(result.scenarioName || result.scenarioId)}`);
          console.log(`Profile:  ${theme.model(result.profileName || `${result.provider}/${result.model}`)}`);
          console.log(
            `Score:    ${theme.score(result.overallScore != null ? result.overallScore.toFixed(1) : '--')}  |  Success: ${result.success ? theme.success('true') : theme.error('false')}`,
          );
          console.log(theme.dim('-'.repeat(80)));

          // Try dialogue log file first (rich trace with metadata)
          let printed = false;
          if (result.dialogueId) {
            const files = fs.existsSync(LOGS_DIR)
              ? fs.readdirSync(LOGS_DIR).filter((f) => f.includes(result.dialogueId))
              : [];

            if (files.length > 0) {
              try {
                const dialogue = JSON.parse(fs.readFileSync(path.join(LOGS_DIR, files[0]), 'utf-8'));
                const trace = dialogue.dialogueTrace || [];
                if (trace.length > 0) {
                  const formatted = formatTranscript(trace, {
                    detail: detailLevel,
                    scenarioName: result.scenarioName || result.scenarioId,
                    profileName: result.profileName,
                    totalTurns: dialogue.totalTurns || 0,
                  });
                  console.log(formatted);
                  printed = true;
                }
              } catch (e) {
                // Fall through to legacy format
              }
            }
          }

          // Fall back to legacy format (suggestions / raw response from DB)
          if (!printed) {
            if (result.suggestions?.length > 0) {
              console.log('Suggestions:');
              for (const s of result.suggestions) {
                const text = typeof s === 'string' ? s : s.text || s.content || JSON.stringify(s);
                console.log(`  \u2022 ${text}`);
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
        const runInteractions = interactionEvals.filter((e) => e.runId === runId);

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
            console.log(
              `  ${run.id}  age=${run.ageMinutes}m  results=${run.resultsFound}  desc="${run.description || ''}"`,
            );
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

      case 'resume': {
        const runId = args.find((a) => !a.startsWith('--') && a !== 'resume');
        if (!runId) {
          console.error('Usage: eval-cli.js resume <runId> [--parallelism N] [--verbose] [--force]');
          process.exit(1);
        }

        const verbose = getFlag('verbose');
        const force = getFlag('force');
        const parallelism = parseInt(getOption('parallelism', '2'), 10);

        const result = await evaluationRunner.resumeEvaluation({
          runId,
          parallelism,
          verbose,
          force,
        });

        if (result.alreadyComplete) {
          break;
        }

        // Extract unique model aliases (same as `run` command)
        const extractAlias = (raw) => {
          if (!raw) return null;
          const dotIdx = raw.indexOf('.');
          return dotIdx !== -1 ? raw.slice(dotIdx + 1) : raw;
        };
        const modelAliases = [
          ...new Set(
            (result.stats || [])
              .flatMap((s) => [extractAlias(s.egoModel || s.model), extractAlias(s.superegoModel)])
              .filter(Boolean),
          ),
        ];

        console.log('\nResume complete.');
        if (modelAliases.length > 0) {
          console.log(`Models: ${modelAliases.join(', ')}`);
        }
        console.log(`  Total tests (all): ${result.totalTests}`);
        console.log(`  Resumed tests: ${result.resumedTests}`);
        console.log(`  Successful (this run): ${result.successfulTests}`);
        console.log(JSON.stringify(result, null, 2));

        // Factorial post-analysis (same as `run` command)
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
              const sd =
                scores.length > 1
                  ? Math.sqrt(scores.reduce((acc, s) => acc + (s - mean) ** 2, 0) / (scores.length - 1))
                  : 0;
              const cellLabel = key.replace(
                /r(\d)_t(\d)_l(\d)/,
                (_, r, t, l) =>
                  `Recog=${r === '1' ? 'Y' : 'N'}  Tutor=${t === '1' ? 'Multi' : 'Single'}  Learner=${l === '1' ? 'Psycho' : 'Unified'}`,
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

      case 'revert': {
        const runId = args.find((a) => !a.startsWith('--') && a !== 'revert');
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

      case 'rejudge': {
        const runId = args.find((a) => !a.startsWith('--') && a !== 'rejudge');
        if (!runId) {
          console.error(
            'Usage: eval-cli.js rejudge <runId> [--judge <model>] [--scenario <id>] [--verbose] [--overwrite]',
          );
          console.error('');
          console.error('By default, creates new rows (preserves history for inter-judge reliability).');
          console.error('Use --overwrite to replace existing scores instead.');
          process.exit(1);
        }

        // Restore env overrides from run metadata
        {
          const runData = evaluationStore.getRun(runId);
          const meta = typeof runData?.metadata === 'string' ? JSON.parse(runData.metadata) : runData?.metadata;
          if (meta?.scenariosFile && !process.env.EVAL_SCENARIOS_FILE) {
            process.env.EVAL_SCENARIOS_FILE = meta.scenariosFile;
            console.log(`[rejudge] Restored EVAL_SCENARIOS_FILE from run metadata: ${meta.scenariosFile}`);
          }
          if (meta?.contentPath && !process.env.EVAL_CONTENT_PATH) {
            process.env.EVAL_CONTENT_PATH = meta.contentPath;
            console.log(`[rejudge] Restored EVAL_CONTENT_PATH from run metadata: ${meta.contentPath}`);
          }
        }

        const verbose = getFlag('verbose');
        const overwrite = getFlag('overwrite');
        const judgeOverride = getOption('judge') || null;
        const scenarioFilter = getOption('scenario') || null;

        console.log(`\nRejudging run: ${runId}`);
        if (judgeOverride) console.log(`  Judge override: ${judgeOverride}`);
        if (scenarioFilter) console.log(`  Scenario filter: ${scenarioFilter}`);
        console.log(`  Mode: ${overwrite ? 'overwrite (replace existing)' : 'preserve history (add new rows)'}`);
        console.log('');

        const summary = await evaluationRunner.rejudgeRun(runId, {
          judgeOverride,
          verbose,
          scenarioFilter,
          overwrite,
        });

        console.log('\n' + '='.repeat(60));
        console.log('  REJUDGE SUMMARY');
        console.log('='.repeat(60));
        console.log(`  Run:       ${summary.runId}`);
        console.log(`  Total:     ${summary.total}`);
        console.log(`  Succeeded: ${summary.succeeded}`);
        console.log(`  Failed:    ${summary.failed}`);
        console.log(`  Old avg:   ${summary.oldAvgScore?.toFixed(2) ?? 'N/A'}`);
        console.log(`  New avg:   ${summary.newAvgScore?.toFixed(2) ?? 'N/A'}`);
        if (summary.scoreDelta != null) {
          const sign = summary.scoreDelta >= 0 ? '+' : '';
          console.log(`  Delta:     ${sign}${summary.scoreDelta.toFixed(2)}`);
        }
        console.log('');
        break;
      }

      case 'export': {
        const runId = args.find((a) => !a.startsWith('--') && a !== 'export');
        if (!runId) {
          console.error('Usage: eval-cli.js export <runId> [--scenario <id>] [--profile <name>] [--output <path>]');
          process.exit(1);
        }

        const scenarioFilter = getOption('scenario') || null;
        const profileFilter = getOption('profile') || null;
        const outputOption = getOption('output') || null;

        const results = evaluationStore.getResults(runId, {
          scenarioId: scenarioFilter,
          profileName: profileFilter,
        });

        if (results.length === 0) {
          console.log(`\nNo results found for run: ${runId}`);
          break;
        }

        // Build output
        const lines = [];
        lines.push(`# Evaluation Export — Run ${runId}`);
        lines.push(`# ${results.length} result(s)`);
        if (scenarioFilter) lines.push(`# Scenario filter: ${scenarioFilter}`);
        if (profileFilter) lines.push(`# Profile filter: ${profileFilter}`);
        lines.push('');

        for (const result of results) {
          const scenario = getScenario(result.scenarioId);

          lines.push('='.repeat(80));
          lines.push(`Scenario: ${result.scenarioName || result.scenarioId}`);
          lines.push(`Profile:  ${result.profileName || `${result.provider}/${result.model}`}`);
          lines.push(`Provider: ${result.provider}  Model: ${result.model}`);
          if (result.egoModel || result.superegoModel) {
            lines.push(`Ego: ${result.egoModel || 'N/A'}  Superego: ${result.superegoModel || 'N/A'}`);
          }
          lines.push(`Score:    ${result.overallScore != null ? result.overallScore.toFixed(1) : 'NOT EVALUATED'}`);
          lines.push('='.repeat(80));
          lines.push('');

          if (scenario) {
            if (scenario.learner_context) {
              lines.push('### Scenario Context');
              lines.push(scenario.learner_context.trim());
              lines.push('');
            }
            if (scenario.expected_behavior) {
              lines.push('### Expected Behavior');
              lines.push(scenario.expected_behavior);
              lines.push('');
            }
            if (scenario.required_elements?.length > 0) {
              lines.push('### Required Elements');
              for (const el of scenario.required_elements) lines.push(`- ${el}`);
              lines.push('');
            }
            if (scenario.forbidden_elements?.length > 0) {
              lines.push('### Forbidden Elements');
              for (const el of scenario.forbidden_elements) lines.push(`- ${el}`);
              lines.push('');
            }
          }

          // Tutor suggestion(s)
          if (result.suggestions?.length > 0) {
            lines.push('### Tutor Suggestion');
            for (const s of result.suggestions) {
              if (typeof s === 'string') {
                lines.push(s);
              } else {
                if (s.title) lines.push(`Title: ${s.title}`);
                if (s.message || s.text || s.content) lines.push(`Message: ${s.message || s.text || s.content}`);
                if (s.action) lines.push(`Action: ${s.action}${s.actionTarget ? ' → ' + s.actionTarget : ''}`);
                if (s.reasoning) lines.push(`Reasoning: ${s.reasoning}`);
              }
            }
            lines.push('');
          }

          // Dialogue trace
          if (result.dialogueId) {
            const files = fs.existsSync(LOGS_DIR)
              ? fs.readdirSync(LOGS_DIR).filter((f) => f.includes(result.dialogueId))
              : [];

            if (files.length > 0) {
              try {
                const dialogue = JSON.parse(fs.readFileSync(path.join(LOGS_DIR, files[0]), 'utf-8'));
                const trace = dialogue.dialogueTrace || [];
                if (trace.length > 0) {
                  lines.push('### Dialogue Trace');
                  for (const entry of trace) {
                    lines.push(formatTraceEntry(entry));
                  }
                  lines.push('');
                }
              } catch (e) {
                // skip
              }
            }
          }

          if (result.errorMessage) {
            lines.push(`### Error`);
            lines.push(result.errorMessage);
            lines.push('');
          }

          lines.push('');
        }

        // Determine output path
        let outputPath = outputOption;
        if (!outputPath) {
          const exportsDir = path.resolve(__dirname, '..', 'exports');
          if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });
          let filename = `eval-${runId}`;
          if (scenarioFilter) filename += `-${scenarioFilter}`;
          if (profileFilter) filename += `-${profileFilter}`;
          filename += '.md';
          outputPath = path.join(exportsDir, filename);
        }

        fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
        console.log(`\nExported ${results.length} result(s) to: ${outputPath}`);
        break;
      }

      case 'evaluate': {
        const runId = args.find((a) => !a.startsWith('--') && a !== 'evaluate');
        if (!runId) {
          console.error(
            'Usage: eval-cli.js evaluate <runId> [--scenario <id>] [--profile <name>] [--model <model>] [--force] [--follow] [--review] [--refresh <ms>] [--verbose]',
          );
          process.exit(1);
        }

        const verbose = getFlag('verbose');
        const force = getFlag('force');
        const follow = getFlag('follow');
        const review = getFlag('review');
        const refreshMs = parseInt(getOption('refresh', '5000'), 10);
        const scenarioFilter = getOption('scenario') || getOption('scenarios') || null;
        const profileFilter = getOption('profile') || getOption('profiles') || null;
        const modelOverride = getOption('model') || null;

        // Restore env overrides from run metadata (e.g. EVAL_SCENARIOS_FILE for domain generalizability runs)
        {
          const runData = evaluationStore.getRun(runId);
          const meta = typeof runData?.metadata === 'string' ? JSON.parse(runData.metadata) : runData?.metadata;
          if (meta?.scenariosFile && !process.env.EVAL_SCENARIOS_FILE) {
            process.env.EVAL_SCENARIOS_FILE = meta.scenariosFile;
            console.log(`[evaluate] Restored EVAL_SCENARIOS_FILE from run metadata: ${meta.scenariosFile}`);
          }
          if (meta?.contentPath && !process.env.EVAL_CONTENT_PATH) {
            process.env.EVAL_CONTENT_PATH = meta.contentPath;
            console.log(`[evaluate] Restored EVAL_CONTENT_PATH from run metadata: ${meta.contentPath}`);
          }
        }

        // Helper: evaluate a single result via claude CLI
        async function evaluateOneResult(result, tag) {
          const startTime = Date.now();
          const scenarioId = result.scenarioId;
          const profileName = result.profileName || `${result.provider}/${result.model}`;

          const scenario = getScenario(scenarioId);
          if (!scenario) {
            console.log(`${tag} ${scenarioId} / ${profileName} ... SKIP (scenario not found)`);
            return null;
          }

          const suggestion = result.suggestions?.[0];
          if (!suggestion) {
            console.log(`${tag} ${scenarioId} / ${profileName} ... SKIP (no suggestion)`);
            return null;
          }

          // Load dialogue log for multi-turn context (if available)
          let dialogueContext = null;
          const dialogueId = result.dialogueId;
          if (dialogueId) {
            const logPath = path.join(LOGS_DIR, `${dialogueId}.json`);
            try {
              if (fs.existsSync(logPath)) {
                const dialogueLog = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
                if (dialogueLog.isMultiTurn && dialogueLog.dialogueTrace?.length > 0) {
                  dialogueContext = {
                    consolidatedTrace: dialogueLog.dialogueTrace,
                    conversationHistory: (dialogueLog.turnResults || []).map((t, i) => ({
                      turnIndex: i,
                      turnId: t.turnId,
                      suggestion: t.suggestions?.[0],
                      learnerAction: t.learnerAction,
                      learnerMessage: t.learnerMessage,
                    })),
                  };
                  if (verbose) {
                    console.log(
                      `${tag}   loaded dialogue transcript (${dialogueLog.dialogueTrace.length} trace entries)`,
                    );
                  }
                }
              }
            } catch (e) {
              if (verbose) console.log(`${tag}   could not load dialogue log: ${e.message}`);
            }
          }

          const prompt = buildEvaluationPrompt(
            suggestion,
            {
              name: scenario.name,
              description: scenario.description,
              expectedBehavior: scenario.expected_behavior,
              learnerContext: scenario.learner_context,
              requiredElements: scenario.required_elements,
              forbiddenElements: scenario.forbidden_elements,
            },
            { dialogueContext },
          );

          const claudeArgs = ['-p', '-', '--output-format', 'text'];
          if (modelOverride) {
            claudeArgs.push('--model', modelOverride);
          }

          if (verbose) {
            console.log(`${tag} ${scenarioId} / ${profileName} ... calling claude`);
          }

          const stdout = await new Promise((resolve, reject) => {
            const env = { ...process.env };
            delete env.ANTHROPIC_API_KEY;
            const child = spawn('claude', claudeArgs, {
              stdio: ['pipe', 'pipe', 'pipe'],
              env,
            });
            let out = '';
            let err = '';
            child.stdout.on('data', (d) => {
              out += d;
            });
            child.stderr.on('data', (d) => {
              err += d;
            });
            child.on('error', reject);
            child.on('close', (code) => {
              if (code !== 0) reject(new Error(err || out || `claude exited with code ${code}`));
              else resolve(out);
            });
            child.stdin.write(prompt);
            child.stdin.end();
          });

          let jsonStr = stdout.trim();
          const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (fenceMatch) {
            jsonStr = fenceMatch[1].trim();
          } else {
            const firstBrace = jsonStr.indexOf('{');
            const lastBrace = jsonStr.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
              jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
            }
          }

          const parsed = JSON.parse(jsonStr);

          const dimensionMap = {
            relevance: 'relevance',
            specificity: 'specificity',
            pedagogical_soundness: 'pedagogical',
            pedagogical: 'pedagogical',
            personalization: 'personalization',
            actionability: 'actionability',
            tone: 'tone',
          };

          const normalizedScores = {};
          for (const [key, value] of Object.entries(parsed.scores || {})) {
            const normalizedKey = dimensionMap[key] || key;
            if (typeof value === 'object' && value !== null) {
              normalizedScores[normalizedKey] = { score: value.score, reasoning: value.reasoning };
            } else if (typeof value === 'number') {
              normalizedScores[normalizedKey] = { score: value, reasoning: null };
            }
          }

          const overallScore =
            Object.keys(normalizedScores).length > 0 ? calculateOverallScore(normalizedScores) : parsed.overall_score;
          const baseScore = calculateBaseScore(normalizedScores);
          const recognitionScore = calculateRecognitionScore(normalizedScores);

          const judgeLatencyMs = Date.now() - startTime;
          const evaluation = {
            scores: normalizedScores,
            overallScore,
            baseScore,
            recognitionScore,
            passesRequired: parsed.validation?.passes_required ?? true,
            passesForbidden: parsed.validation?.passes_forbidden ?? true,
            requiredMissing: parsed.validation?.required_missing || [],
            forbiddenFound: parsed.validation?.forbidden_found || [],
            summary: parsed.summary,
            judgeModel: modelOverride ? `claude-code/${modelOverride}` : 'claude-opus-4.6',
            judgeLatencyMs,
          };

          evaluationStore.updateResultScores(result.id, evaluation);

          // Score line
          const dimScores = Object.entries(normalizedScores)
            .map(([k, v]) => `${k}=${v.score}`)
            .join(' ');
          console.log(`${tag} ${scenarioId} / ${profileName} ... ${overallScore.toFixed(1)}  (${dimScores})`);

          if (verbose) {
            // Truncated suggestion excerpt
            const suggText =
              typeof suggestion === 'string'
                ? suggestion
                : suggestion.message || suggestion.text || suggestion.content || JSON.stringify(suggestion);
            const truncSugg =
              suggText.length > 200 ? suggText.slice(0, 200).replace(/\n/g, ' ') + '...' : suggText.replace(/\n/g, ' ');
            console.log(`     Suggestion: ${truncSugg}`);

            // Judge summary
            if (parsed.summary) {
              const truncSummary =
                parsed.summary.length > 300
                  ? parsed.summary.slice(0, 300).replace(/\n/g, ' ') + '...'
                  : parsed.summary.replace(/\n/g, ' ');
              console.log(`     Judge: ${truncSummary}`);
            }
            console.log('');
          }

          return overallScore;
        }

        // Helper: print summary
        function printEvaluateSummary(succeeded, failed, totalAttempted, scores) {
          const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

          console.log('\n' + '='.repeat(50));
          console.log('  EVALUATE SUMMARY');
          console.log('='.repeat(50));
          console.log(`  Total:     ${totalAttempted}`);
          console.log(`  Succeeded: ${succeeded}`);
          console.log(`  Failed:    ${failed}`);
          if (scores.length > 0) {
            console.log(`  Avg score: ${avgScore.toFixed(1)}`);
          }
          console.log('');
        }

        // Helper: run holistic dialogue evaluation for multi-turn dialogues
        async function evaluateHolisticDialogues(evaluatedResults) {
          // Group results by dialogueId to find multi-turn dialogues
          const dialogueGroups = new Map();
          for (const result of evaluatedResults) {
            if (result.dialogueId) {
              if (!dialogueGroups.has(result.dialogueId)) {
                dialogueGroups.set(result.dialogueId, []);
              }
              dialogueGroups.get(result.dialogueId).push(result);
            }
          }

          // Filter to multi-turn dialogues (2+ results sharing a dialogueId)
          const multiTurnDialogues = [...dialogueGroups.entries()].filter(([, results]) => results.length > 1);
          if (multiTurnDialogues.length === 0) return;

          console.log(`\n${'─'.repeat(50)}`);
          console.log(`  HOLISTIC DIALOGUE EVALUATION (${multiTurnDialogues.length} dialogue(s))`);
          console.log(`${'─'.repeat(50)}\n`);

          for (const [dialogueId, results] of multiTurnDialogues) {
            const logPath = path.join(LOGS_DIR, `${dialogueId}.json`);
            let dialogueLog;
            try {
              if (!fs.existsSync(logPath)) {
                console.log(`  ${dialogueId} ... SKIP (dialogue log not found)`);
                continue;
              }
              dialogueLog = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
            } catch (e) {
              console.log(`  ${dialogueId} ... SKIP (could not load: ${e.message})`);
              continue;
            }

            if (!dialogueLog.isMultiTurn || !dialogueLog.dialogueTrace?.length) {
              console.log(`  ${dialogueId} ... SKIP (not multi-turn or no trace)`);
              continue;
            }

            // Build context from the dialogue log
            const consolidatedTrace = dialogueLog.dialogueTrace;
            const conversationHistory = (dialogueLog.turnResults || []).map((t, i) => ({
              turnIndex: i,
              turnId: t.turnId,
              suggestion: t.suggestions?.[0],
              learnerAction: t.learnerAction,
              learnerMessage: t.learnerMessage,
            }));

            // Use the last turn's suggestion as the focal point
            const lastResult = results[results.length - 1];
            const lastSuggestion = lastResult.suggestions?.[0];
            if (!lastSuggestion) {
              console.log(`  ${dialogueId} ... SKIP (no suggestion on last turn)`);
              continue;
            }

            const scenarioId = lastResult.scenarioId;
            const scenario = getScenario(scenarioId);
            if (!scenario) {
              console.log(`  ${dialogueId} ... SKIP (scenario ${scenarioId} not found)`);
              continue;
            }

            const prompt = buildEvaluationPrompt(
              lastSuggestion,
              {
                name: `${scenario.name} (holistic dialogue)`,
                description: `Holistic evaluation of ${results.length}-turn dialogue. Score the overall quality of the tutoring interaction across all turns, not just this final response.`,
                expectedBehavior: scenario.expected_behavior,
                learnerContext: scenario.learner_context,
                requiredElements: scenario.required_elements,
                forbiddenElements: scenario.forbidden_elements,
              },
              {
                dialogueContext: { conversationHistory, consolidatedTrace },
              },
            );

            try {
              const claudeArgs = ['-p', '-', '--output-format', 'text'];
              if (modelOverride) claudeArgs.push('--model', modelOverride);

              const stdout = await new Promise((resolve, reject) => {
                const env = { ...process.env };
                delete env.ANTHROPIC_API_KEY;
                const child = spawn('claude', claudeArgs, {
                  stdio: ['pipe', 'pipe', 'pipe'],
                  env,
                });
                let out = '';
                let err = '';
                child.stdout.on('data', (d) => {
                  out += d;
                });
                child.stderr.on('data', (d) => {
                  err += d;
                });
                child.on('error', reject);
                child.on('close', (code) => {
                  if (code !== 0) reject(new Error(err || out || `claude exited with code ${code}`));
                  else resolve(out);
                });
                child.stdin.write(prompt);
                child.stdin.end();
              });

              let jsonStr = stdout.trim();
              const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
              if (fenceMatch) {
                jsonStr = fenceMatch[1].trim();
              } else {
                const firstBrace = jsonStr.indexOf('{');
                const lastBrace = jsonStr.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace > firstBrace) {
                  jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
                }
              }

              const parsed = JSON.parse(jsonStr);

              const normalizedScores = {};
              const dimensionMap = {
                relevance: 'relevance',
                specificity: 'specificity',
                pedagogical_soundness: 'pedagogical',
                pedagogical: 'pedagogical',
                personalization: 'personalization',
                actionability: 'actionability',
                tone: 'tone',
              };
              for (const [key, value] of Object.entries(parsed.scores || {})) {
                const normalizedKey = dimensionMap[key] || key;
                if (typeof value === 'object' && value !== null) {
                  normalizedScores[normalizedKey] = { score: value.score, reasoning: value.reasoning };
                } else if (typeof value === 'number') {
                  normalizedScores[normalizedKey] = { score: value, reasoning: null };
                }
              }

              const overallScore =
                Object.keys(normalizedScores).length > 0
                  ? calculateOverallScore(normalizedScores)
                  : parsed.overall_score;
              const baseScore = calculateBaseScore(normalizedScores);
              const recognitionScore = calculateRecognitionScore(normalizedScores);

              const holisticScore = {
                overallScore,
                baseScore,
                recognitionScore,
                scores: normalizedScores,
                summary: parsed.summary,
                judgeModel: modelOverride ? `claude-code/${modelOverride}` : 'claude-opus-4.6',
              };

              // Save to dialogue log
              dialogueLog.holisticDialogueScore = holisticScore;
              fs.writeFileSync(logPath, JSON.stringify(dialogueLog, null, 2));

              const profileName = lastResult.profileName || `${lastResult.provider}/${lastResult.model}`;
              console.log(
                `  ${scenarioId} / ${profileName} ... holistic=${overallScore.toFixed(1)} (base=${baseScore.toFixed(1)} recog=${recognitionScore.toFixed(1)})`,
              );
              if (verbose && parsed.summary) {
                const truncSummary =
                  parsed.summary.length > 300
                    ? parsed.summary.slice(0, 300).replace(/\n/g, ' ') + '...'
                    : parsed.summary.replace(/\n/g, ' ');
                console.log(`     Judge: ${truncSummary}\n`);
              }
            } catch (err) {
              const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
              console.log(`  ${dialogueId} ... FAIL: ${msg}`);
            }
          }
        }

        // ── Review mode: show stored reasoning without re-evaluating ──
        if (review) {
          const results = evaluationStore.getResults(runId, {
            scenarioId: scenarioFilter,
            profileName: profileFilter,
          });

          if (results.length === 0) {
            console.error(`No results found for run: ${runId}`);
            process.exit(1);
          }

          const evaluated = results.filter((r) => r.baseScore != null);
          if (evaluated.length === 0) {
            console.log('No evaluated results to review. Run evaluate first.');
            break;
          }

          console.log(`\nReviewing ${evaluated.length} evaluated result(s) for run: ${runId}\n`);

          for (let i = 0; i < evaluated.length; i++) {
            const r = evaluated[i];
            const profileName = r.profileName || `${r.provider}/${r.model}`;

            // Dimension scores on one line
            const dimScores = Object.entries(r.scores || {})
              .filter(([, v]) => v != null)
              .map(([k, v]) => {
                const score = typeof v === 'object' ? v.score : v;
                return `${k}=${score}`;
              })
              .join(' ');

            console.log(
              `[${i + 1}/${evaluated.length}] ${r.scenarioId} / ${profileName} ... ${r.overallScore?.toFixed(1) ?? '--'}  (${dimScores})`,
            );

            // Suggestion excerpt
            const suggestion = r.suggestions?.[0];
            if (suggestion) {
              const suggText =
                typeof suggestion === 'string'
                  ? suggestion
                  : suggestion.message || suggestion.text || suggestion.content || JSON.stringify(suggestion);
              const truncSugg =
                suggText.length > 200
                  ? suggText.slice(0, 200).replace(/\n/g, ' ') + '...'
                  : suggText.replace(/\n/g, ' ');
              console.log(`     Suggestion: ${truncSugg}`);
            }

            // Judge summary
            if (r.evaluationReasoning) {
              const truncReasoning =
                r.evaluationReasoning.length > 300
                  ? r.evaluationReasoning.slice(0, 300).replace(/\n/g, ' ') + '...'
                  : r.evaluationReasoning.replace(/\n/g, ' ');
              console.log(`     Judge: ${truncReasoning}`);
            }

            // Per-dimension reasoning (verbose only)
            if (verbose && r.scores) {
              for (const [dim, val] of Object.entries(r.scores)) {
                if (typeof val === 'object' && val?.reasoning) {
                  const truncDim =
                    val.reasoning.length > 150
                      ? val.reasoning.slice(0, 150).replace(/\n/g, ' ') + '...'
                      : val.reasoning.replace(/\n/g, ' ');
                  console.log(`       ${dim} (${val.score}): ${truncDim}`);
                }
              }
            }
            console.log('');
          }

          // Quick stats
          const reviewScores = evaluated.map((r) => r.overallScore).filter((s) => s != null);
          if (reviewScores.length > 0) {
            const avg = reviewScores.reduce((a, b) => a + b, 0) / reviewScores.length;
            const sd = Math.sqrt(reviewScores.reduce((acc, s) => acc + (s - avg) ** 2, 0) / (reviewScores.length - 1));
            console.log(`Reviewed ${evaluated.length} results: avg=${avg.toFixed(1)} sd=${sd.toFixed(1)}`);
          }
          break;
        }

        let succeeded = 0;
        let failed = 0;
        const scores = [];

        if (follow) {
          // ── Follow mode: poll for new unevaluated results ──
          // Show initial status
          const initialResults = evaluationStore.getResults(runId, {
            scenarioId: scenarioFilter,
            profileName: profileFilter,
          });
          const initialTotal = initialResults.filter((r) => r.success).length;
          const initialUnevaluated = initialResults.filter((r) => r.baseScore == null && r.success).length;
          const initialEvaluated = initialTotal - initialUnevaluated;

          console.log(`\nFollowing run: ${runId}`);
          console.log(`  Already scored: ${initialEvaluated}/${initialTotal}`);
          console.log(`  Need scoring: ${initialUnevaluated}`);
          if (modelOverride) console.log(`  Model: ${modelOverride}`);
          console.log(`  Polling every ${refreshMs}ms for new results...`);
          console.log('');

          const processedIds = new Set();
          let _evalCounter = 0;
          let interrupted = false;

          // SIGINT handler: print summary so far and exit
          const sigintHandler = () => {
            interrupted = true;
            console.log('\n\nInterrupted by user.');
            printEvaluateSummary(succeeded, failed, succeeded + failed, scores);
            process.exit(0);
          };
          process.on('SIGINT', sigintHandler);

          const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

          while (!interrupted) {
            // Fetch results that have a suggestion but no rubric evaluation
            const results = evaluationStore.getResults(runId, {
              scenarioId: scenarioFilter,
              profileName: profileFilter,
            });

            const unevaluated = results.filter((r) => r.baseScore == null && r.success && !processedIds.has(r.id));

            // Total results available so far (for progress display)
            const totalResults = results.filter((r) => r.success).length;
            const alreadyEvaluated = results.filter((r) => r.baseScore != null && r.success).length;

            // Process each new unevaluated result
            let batchIndex = 0;
            const batchSize = unevaluated.length;
            for (const result of unevaluated) {
              if (interrupted) break;
              processedIds.add(result.id);
              _evalCounter++;
              batchIndex++;
              // Show: [batch progress] (overall: evaluated/total)
              const tag = `[${batchIndex}/${batchSize}] (${alreadyEvaluated + batchIndex}/${totalResults} scored)`;

              try {
                const score = await evaluateOneResult(result, tag);
                if (score != null) {
                  scores.push(score);
                  succeeded++;
                } else {
                  failed++;
                }
              } catch (err) {
                failed++;
                const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
                const profileName = result.profileName || `${result.provider}/${result.model}`;
                console.log(`${tag} ${result.scenarioId} / ${profileName} ... FAIL: ${msg}`);
                if (verbose) console.error(err);
              }
            }

            // Check if run is done and no unevaluated results remain
            const run = evaluationStore.getRun(runId);
            const runStatus = run?.status || 'unknown';

            if (runStatus !== 'running' && unevaluated.length === 0) {
              // Re-check one more time to avoid race condition
              const finalResults = evaluationStore.getResults(runId, {
                scenarioId: scenarioFilter,
                profileName: profileFilter,
              });
              const finalUnevaluated = finalResults.filter(
                (r) => r.baseScore == null && r.success && !processedIds.has(r.id),
              );
              if (finalUnevaluated.length === 0) {
                console.log(`\nRun ${runStatus}. All results evaluated.`);
                break;
              }
            }

            // Status line while waiting
            const evaluatedCount = results.filter((r) => r.baseScore != null).length;
            console.log(
              `Waiting for new results... (${evaluatedCount} evaluated of ${totalResults} total, run ${runStatus})`,
            );

            await sleep(refreshMs);
          }

          process.removeListener('SIGINT', sigintHandler);
          printEvaluateSummary(succeeded, failed, succeeded + failed, scores);

          // Holistic dialogue evaluation for multi-turn dialogues
          const allResults = evaluationStore
            .getResults(runId, {
              scenarioId: scenarioFilter,
              profileName: profileFilter,
            })
            .filter((r) => r.success && r.baseScore != null);
          await evaluateHolisticDialogues(allResults);
        } else {
          // ── One-shot mode (existing behavior) ──

          // Load results for this run
          const results = evaluationStore.getResults(runId, {
            scenarioId: scenarioFilter,
            profileName: profileFilter,
          });

          if (results.length === 0) {
            console.error(`No results found for run: ${runId}`);
            process.exit(1);
          }

          // Filter to unevaluated results unless --force
          // Use baseScore == null to detect skip-rubric results (overallScore=100 but no rubric dims)
          const toEvaluate = force ? results : results.filter((r) => r.baseScore == null && r.success);

          if (toEvaluate.length === 0) {
            console.log(
              'All results already have rubric scores. Use --review to inspect reasoning, or --force to re-evaluate.',
            );
            break;
          }

          console.log(`\nEvaluating ${toEvaluate.length} result(s) for run: ${runId}`);
          if (modelOverride) console.log(`  Model: ${modelOverride}`);
          console.log('');

          for (let i = 0; i < toEvaluate.length; i++) {
            const result = toEvaluate[i];
            const tag = `[${i + 1}/${toEvaluate.length}]`;

            try {
              const score = await evaluateOneResult(result, tag);
              if (score != null) {
                scores.push(score);
                succeeded++;
              } else {
                failed++;
              }
            } catch (err) {
              failed++;
              const profileName = result.profileName || `${result.provider}/${result.model}`;
              const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
              console.log(`${tag} ${result.scenarioId} / ${profileName} ... FAIL: ${msg}`);
              if (verbose) console.error(err);
            }
          }

          printEvaluateSummary(succeeded, failed, toEvaluate.length, scores);

          // Holistic dialogue evaluation for multi-turn dialogues
          await evaluateHolisticDialogues(toEvaluate.filter((r) => r.success));
        }
        break;
      }

      case 'evaluate-learner': {
        // ── Learner-side evaluation: score learner turns from multi-turn dialogues ──
        //
        // Data lives in evaluation_results (per-dialogue rows with dialogueId)
        // and logs/tutor-dialogues/*.json (full dialogue traces with learner turns).
        //
        // For each dialogue:
        //   1. Load the log file to get learner turn messages + deliberation traces
        //   2. Build a learner evaluation prompt per learner turn (truncated context)
        //   3. Call Claude as judge
        //   4. Store per-turn scores as JSON + overall learner score on the result row

        const runId = args.find((a) => !a.startsWith('--') && a !== 'evaluate-learner');
        if (!runId) {
          console.error(
            'Usage: eval-cli.js evaluate-learner <runId> [--model <model>] [--force] [--verbose] [--arch <architecture>]',
          );
          console.error('  Scores learner turns from dialogue logs using the learner rubric.');
          console.error('  Only works on multi-turn runs with learner turns (e.g., bilateral transformation).');
          console.error('  --arch filters by learner_architecture (e.g., ego_superego_recognition)');
          process.exit(1);
        }

        const verbose = getFlag('verbose');
        const force = getFlag('force');
        const modelOverride = getOption('model') || null;
        const profileFilter = getOption('profile') || getOption('profiles') || null;
        const archFilter = getOption('arch') || null;

        // Load results with dialogue IDs (multi-turn data)
        const allResults = evaluationStore.getResults(runId, { profileName: profileFilter });
        let dialogueResults = allResults.filter((r) => r.dialogueId && r.success);
        if (archFilter) {
          dialogueResults = dialogueResults.filter((r) => r.learnerArchitecture === archFilter);
        }

        if (dialogueResults.length === 0) {
          console.error(`No multi-turn dialogue results found for run: ${runId}`);
          console.error('This command only works on runs that produced dialogue log files.');
          process.exit(1);
        }

        // Filter to those needing learner evaluation (unless --force).
        // Also detect partially-scored rows where some turns failed mid-run.
        let toEvaluate;
        let partialCount = 0;
        if (force) {
          toEvaluate = dialogueResults;
        } else {
          toEvaluate = dialogueResults.filter((r) => {
            // No score at all — needs evaluation
            if (r.learnerOverallScore == null) return true;

            // Has a score — check if all turns were scored by comparing
            // the number of scored turns against the dialogue log's learner turns
            if (r.learnerScores && r.dialogueId) {
              const logPath = path.join(LOGS_DIR, `${r.dialogueId}.json`);
              try {
                if (fs.existsSync(logPath)) {
                  const log = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
                  const trace = log.dialogueTrace || [];
                  const expectedTurns = trace.filter((t) => t.agent === 'user' && t.action === 'turn_action').length;
                  const scoredTurns = Object.keys(r.learnerScores).length;
                  if (scoredTurns < expectedTurns) {
                    partialCount++;
                    return true;
                  }
                }
              } catch {
                // If log can't be read, skip partial detection for this row
              }
            }

            return false;
          });
        }

        if (partialCount > 0) {
          console.log(`Found ${partialCount} partially-scored dialogue(s) — will re-evaluate all turns.`);
        }

        if (toEvaluate.length === 0) {
          console.log('All dialogue results already have learner scores. Use --force to re-evaluate.');
          break;
        }

        console.log(`\nEvaluating learner turns for ${toEvaluate.length} dialogue(s) from run: ${runId}`);
        if (modelOverride) console.log(`  Model: ${modelOverride}`);
        console.log('');

        let succeeded = 0;
        let failed = 0;
        const allScores = [];

        for (let i = 0; i < toEvaluate.length; i++) {
          const result = toEvaluate[i];
          const profileName = result.profileName || `${result.provider}/${result.model}`;
          const tag = `[${i + 1}/${toEvaluate.length}]`;

          // Load dialogue log file
          const logPath = path.join(LOGS_DIR, `${result.dialogueId}.json`);
          let dialogueLog;
          try {
            if (!fs.existsSync(logPath)) {
              console.log(`${tag} ${result.scenarioId} / ${profileName} ... SKIP (log file not found)`);
              failed++;
              continue;
            }
            dialogueLog = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
          } catch (e) {
            console.log(`${tag} ${result.scenarioId} / ${profileName} ... SKIP (${e.message})`);
            failed++;
            continue;
          }

          if (!dialogueLog.isMultiTurn) {
            console.log(`${tag} ${result.scenarioId} / ${profileName} ... SKIP (not multi-turn)`);
            failed++;
            continue;
          }

          const trace = dialogueLog.dialogueTrace || [];
          const learnerArch = dialogueLog.learnerArchitecture || 'unified';
          const isMultiAgent =
            learnerArch.includes('ego_superego') ||
            learnerArch === 'multi_agent' ||
            learnerArch.includes('psychodynamic');

          // Extract learner turns from dialogue trace.
          // Each learner turn consists of:
          //   - turn_action entry (contextSummary = external message)
          //   - For multi-agent: preceding learner_ego_initial, learner_superego, learner_ego_revision entries
          const learnerTurns = [];
          const turnActionEntries = trace.filter((t) => t.agent === 'user' && t.action === 'turn_action');

          for (const ta of turnActionEntries) {
            const turnData = {
              turnIndex: ta.turnIndex,
              externalMessage: ta.contextSummary || '',
              internalDeliberation: [],
            };

            // Find deliberation entries associated with this turn action
            // They appear before the turn_action in the trace and after the previous tutor turn
            if (isMultiAgent) {
              const taIdx = trace.indexOf(ta);
              // Walk backward from turn_action to find learner deliberation entries
              for (let j = taIdx - 1; j >= 0; j--) {
                const entry = trace[j];
                if (entry.agent === 'learner_ego_initial' && entry.action === 'deliberation') {
                  turnData.internalDeliberation.unshift({ role: 'ego_initial', content: entry.contextSummary || '' });
                  break; // ego_initial is the first step, stop here
                } else if (entry.agent === 'learner_superego' && entry.action === 'deliberation') {
                  turnData.internalDeliberation.unshift({ role: 'superego', content: entry.contextSummary || '' });
                } else if (entry.agent === 'learner_ego_revision' && entry.action === 'deliberation') {
                  turnData.internalDeliberation.unshift({ role: 'ego_revision', content: entry.contextSummary || '' });
                } else if (entry.agent === 'learner_synthesis' && entry.action === 'response') {
                  // synthesis is the final merged output, skip (same as external message)
                } else if (entry.agent === 'ego' || entry.agent === 'system') {
                  break; // Reached the tutor's turn, stop
                }
              }
            }

            learnerTurns.push(turnData);
          }

          if (learnerTurns.length === 0) {
            console.log(`${tag} ${result.scenarioId} / ${profileName} ... SKIP (no learner turns in trace)`);
            failed++;
            continue;
          }

          // Build a reconstructed turn array for the prompt builder
          // Interleave tutor suggestions and learner messages
          const reconstructedTurns = [];
          const turnResults = dialogueLog.turnResults || [];

          // Turn 0: initial tutor suggestion
          if (turnResults.length > 0) {
            const sug = turnResults[0].suggestions?.[0];
            reconstructedTurns.push({
              turnNumber: 0,
              phase: 'tutor',
              externalMessage: sug?.message || sug?.text || JSON.stringify(sug),
            });
          }

          // Subsequent turns: learner → tutor pairs
          for (let lt = 0; lt < learnerTurns.length; lt++) {
            reconstructedTurns.push({
              turnNumber: lt + 1,
              phase: 'learner',
              externalMessage: learnerTurns[lt].externalMessage,
              internalDeliberation: learnerTurns[lt].internalDeliberation,
            });

            // Add corresponding tutor response (if exists)
            const tutorTurn = turnResults[lt + 1];
            if (tutorTurn) {
              const sug = tutorTurn.suggestions?.[0];
              reconstructedTurns.push({
                turnNumber: lt + 1,
                phase: 'tutor',
                externalMessage: sug?.message || sug?.text || JSON.stringify(sug),
              });
            }
          }

          // Get scenario info
          const scenario = getScenario(result.scenarioId);
          const scenarioName = scenario?.name || result.scenarioId;

          // Use learnerContext from the dialogue log as persona description
          const personaDescription = dialogueLog.learnerContext || 'No persona description available';

          const turnScores = {};
          let turnSucceeded = 0;

          // Score each learner turn
          for (let lt = 0; lt < learnerTurns.length; lt++) {
            // Find the learner turn's index in reconstructedTurns
            const targetIdx = reconstructedTurns.findIndex(
              (t, idx) => t.phase === 'learner' && t.externalMessage === learnerTurns[lt].externalMessage && idx > 0,
            );

            if (targetIdx === -1) continue;

            const turnTag = `${tag} ${result.scenarioId} / ${profileName} learner-turn-${lt + 1}`;

            try {
              const prompt = buildLearnerEvaluationPrompt({
                turns: reconstructedTurns,
                targetTurnIndex: targetIdx,
                personaId: profileName,
                personaDescription,
                learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
                scenarioName,
                topic: result.scenarioId,
              });

              const claudeArgs = ['-p', '-', '--output-format', 'text'];
              if (modelOverride) {
                claudeArgs.push('--model', modelOverride);
              }

              if (verbose) {
                console.log(`${turnTag} ... calling claude`);
              }

              const stdout = await new Promise((resolve, reject) => {
                const env = { ...process.env };
                delete env.ANTHROPIC_API_KEY;
                const child = spawn('claude', claudeArgs, {
                  stdio: ['pipe', 'pipe', 'pipe'],
                  env,
                });
                let out = '';
                let err = '';
                child.stdout.on('data', (d) => {
                  out += d;
                });
                child.stderr.on('data', (d) => {
                  err += d;
                });
                child.on('error', reject);
                child.on('close', (code) => {
                  if (code !== 0) reject(new Error(err || out || `claude exited with code ${code}`));
                  else resolve(out);
                });
                child.stdin.write(prompt);
                child.stdin.end();
              });

              // Parse JSON response
              let jsonStr = stdout.trim();
              const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
              if (fenceMatch) {
                jsonStr = fenceMatch[1].trim();
              } else {
                const firstBrace = jsonStr.indexOf('{');
                const lastBrace = jsonStr.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace > firstBrace) {
                  jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
                }
              }

              const parsed = JSON.parse(jsonStr);
              const turnOverall = calculateLearnerOverallScore(parsed.scores || {}, isMultiAgent);

              turnScores[lt] = {
                turnIndex: lt + 1,
                scores: parsed.scores,
                overallScore: turnOverall,
                summary: parsed.summary,
              };

              const dimScores = Object.entries(parsed.scores || {})
                .map(([k, v]) => `${k}=${typeof v === 'object' ? v.score : v}`)
                .join(' ');
              console.log(`${turnTag} ... ${turnOverall.toFixed(1)}  (${dimScores})`);

              if (verbose && parsed.summary) {
                console.log(`     Judge: ${parsed.summary}`);
              }

              turnSucceeded++;
            } catch (err) {
              const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
              console.log(`${turnTag} ... FAIL: ${msg}`);
              if (verbose) console.error(err);
            }
          }

          if (turnSucceeded > 0) {
            // Calculate dialogue-level learner score (average across turns)
            const turnOveralls = Object.values(turnScores).map((ts) => ts.overallScore);
            const dialogueLearnerScore = turnOveralls.reduce((a, b) => a + b, 0) / turnOveralls.length;

            // Store in database on the evaluation_results row
            evaluationStore.updateResultLearnerScores(result.id, {
              scores: turnScores,
              overallScore: dialogueLearnerScore,
              judgeModel: modelOverride ? `claude-code/${modelOverride}` : 'claude-opus-4.6',
            });

            allScores.push(dialogueLearnerScore);
            succeeded++;

            console.log(
              `  → Dialogue learner score: ${dialogueLearnerScore.toFixed(1)} (${turnSucceeded} turns scored)`,
            );
            console.log('');
          } else {
            failed++;
          }
        }

        // Summary
        console.log('\n' + '='.repeat(50));
        console.log('  EVALUATE-LEARNER SUMMARY');
        console.log('='.repeat(50));
        console.log(`  Total dialogues:  ${toEvaluate.length}`);
        console.log(`  Succeeded: ${succeeded}`);
        console.log(`  Failed:    ${failed}`);
        if (allScores.length > 0) {
          const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
          const sd =
            allScores.length > 1
              ? Math.sqrt(allScores.reduce((acc, s) => acc + (s - avg) ** 2, 0) / (allScores.length - 1))
              : 0;
          console.log(`  Avg learner score: ${avg.toFixed(1)} (SD=${sd.toFixed(1)})`);
        }
        console.log('');
        break;
      }

      case 'validate-config': {
        const verbose = getFlag('verbose');
        const filterProfile = getOption('profile');

        console.log('\nValidating configuration...\n');

        let errors = 0;
        let warnings = 0;

        // ── Load core configs ─────────────────────────────────────────
        const tutorAgentsData = evalConfigLoader.loadTutorAgents({ forceReload: true });
        if (!tutorAgentsData?.profiles) {
          console.error('  FATAL: Could not load tutor-agents.yaml');
          process.exit(1);
        }
        const allProfiles = tutorAgentsData.profiles;
        const profileNames = Object.keys(allProfiles);

        const providersData = evalConfigLoader.loadProviders({ forceReload: true });
        if (!providersData?.providers) {
          console.error('  FATAL: Could not load providers.yaml');
          process.exit(1);
        }
        const providerNames = Object.keys(providersData.providers);

        const scenarios = evalConfigLoader.listScenarios();
        const contentConfig = evalConfigLoader.getContentConfig();

        console.log(`  Profiles:  ${profileNames.length} cells loaded from tutor-agents.yaml`);
        console.log(`  Scenarios: ${scenarios.length} scenarios loaded`);
        console.log(`  Providers: ${providerNames.length} providers configured (${providerNames.join(', ')})`);
        console.log('');

        // Determine which profiles to validate
        const profilesToCheck = filterProfile ? filterProfile.split(',').map((p) => p.trim()) : profileNames;

        if (filterProfile) {
          const missing = profilesToCheck.filter((p) => !allProfiles[p]);
          if (missing.length > 0) {
            console.error(`  Profile(s) not found in YAML: ${missing.join(', ')}`);
            process.exit(1);
          }
          console.log(`  Validating ${profilesToCheck.length} profile(s): ${profilesToCheck.join(', ')}\n`);
        }

        console.log('Checks:');

        // ── 1. EVAL_ONLY_PROFILES coverage ────────────────────────────
        const { EVAL_ONLY_PROFILES } = evaluationRunner;
        // Legacy aliases (single_baseline, recognition, etc.) map to tutor-core profiles
        // and are not expected to exist in tutor-agents.yaml — only check cell_* entries
        const cellProfiles = EVAL_ONLY_PROFILES.filter((name) => name.startsWith('cell_'));
        const missingInYaml = cellProfiles.filter((name) => !allProfiles[name]);
        if (missingInYaml.length > 0) {
          console.log(
            `  \u2717 EVAL_ONLY_PROFILES: ${missingInYaml.length} cell entries missing from tutor-agents.yaml`,
          );
          for (const name of missingInYaml) {
            console.log(`      - ${name}`);
          }
          errors += missingInYaml.length;
        } else {
          const legacyCount = EVAL_ONLY_PROFILES.length - cellProfiles.length;
          console.log(
            `  \u2713 All ${cellProfiles.length} cell entries in EVAL_ONLY_PROFILES exist in YAML (${legacyCount} legacy aliases skipped)`,
          );
        }

        // ── 2. Provider resolution ────────────────────────────────────
        const providerErrors = [];
        for (const name of profilesToCheck) {
          const profile = allProfiles[name];
          if (profile.ego?.provider && !providersData.providers[profile.ego.provider]) {
            providerErrors.push(`${name}: ego provider '${profile.ego.provider}' not found`);
          }
          if (profile.superego?.provider && !providersData.providers[profile.superego.provider]) {
            providerErrors.push(`${name}: superego provider '${profile.superego.provider}' not found`);
          }
        }
        if (providerErrors.length > 0) {
          console.log(`  \u2717 Provider resolution: ${providerErrors.length} error(s)`);
          for (const e of providerErrors) console.log(`      - ${e}`);
          errors += providerErrors.length;
        } else {
          console.log('  \u2713 All provider references resolve');
        }

        // ── 3. Model alias resolution ─────────────────────────────────
        const modelErrors = [];
        for (const name of profilesToCheck) {
          const profile = allProfiles[name];
          if (profile.ego?.provider && profile.ego?.model) {
            try {
              evalConfigLoader.resolveModel(`${profile.ego.provider}.${profile.ego.model}`);
            } catch (e) {
              modelErrors.push(`${name}: ego model '${profile.ego.provider}.${profile.ego.model}' — ${e.message}`);
            }
          }
          if (profile.superego?.provider && profile.superego?.model) {
            try {
              evalConfigLoader.resolveModel(`${profile.superego.provider}.${profile.superego.model}`);
            } catch (e) {
              modelErrors.push(
                `${name}: superego model '${profile.superego.provider}.${profile.superego.model}' — ${e.message}`,
              );
            }
          }
        }
        if (modelErrors.length > 0) {
          console.log(`  \u2717 Model alias resolution: ${modelErrors.length} error(s)`);
          for (const e of modelErrors) console.log(`      - ${e}`);
          errors += modelErrors.length;
        } else {
          console.log('  \u2713 All model aliases resolve');
        }

        // ── 4. Dialogue consistency ───────────────────────────────────
        const dialogueErrors = [];
        let multiAgentCount = 0;
        let singleAgentCount = 0;
        for (const name of profilesToCheck) {
          const profile = allProfiles[name];
          const dialogueEnabled = profile.dialogue?.enabled ?? false;
          if (dialogueEnabled) {
            multiAgentCount++;
            const maxRounds = profile.dialogue?.max_rounds ?? 0;
            if (maxRounds <= 0) {
              dialogueErrors.push(`${name}: dialogue enabled but max_rounds=${maxRounds}`);
            }
            if (!profile.superego || profile.superego === null) {
              dialogueErrors.push(`${name}: dialogue enabled but superego is null`);
            }
          } else {
            singleAgentCount++;
          }
        }
        if (dialogueErrors.length > 0) {
          console.log(`  \u2717 Dialogue config: ${dialogueErrors.length} inconsistency(ies)`);
          for (const e of dialogueErrors) console.log(`      - ${e}`);
          errors += dialogueErrors.length;
        } else {
          console.log(
            `  \u2713 Dialogue config consistent (${multiAgentCount} multi-agent, ${singleAgentCount} single-agent)`,
          );
        }

        // ── 5. Learner architecture ───────────────────────────────────
        const VALID_LEARNER_ARCHS = ['unified', 'unified_recognition', 'ego_superego', 'ego_superego_recognition', 'ego_superego_authentic', 'ego_superego_recognition_authentic'];
        const learnerErrors = [];
        for (const name of profilesToCheck) {
          const profile = allProfiles[name];
          if (profile.learner_architecture && !VALID_LEARNER_ARCHS.includes(profile.learner_architecture)) {
            learnerErrors.push(
              `${name}: learner_architecture='${profile.learner_architecture}' (expected one of: ${VALID_LEARNER_ARCHS.join(', ')})`,
            );
          }
        }
        if (learnerErrors.length > 0) {
          console.log(`  \u2717 Learner architectures: ${learnerErrors.length} invalid`);
          for (const e of learnerErrors) console.log(`      - ${e}`);
          errors += learnerErrors.length;
        } else {
          console.log('  \u2713 Learner architectures valid');
        }

        // ── 6. Scenario course_ids ────────────────────────────────────
        if (contentConfig?.content_package_path) {
          const { isConfigured, listAvailableCourses, configure } = await import('../services/contentResolver.js');
          configure({
            contentPackagePath: contentConfig.content_package_path,
            maxLectureChars: contentConfig.max_lecture_chars,
            includeSpeakerNotes: contentConfig.include_speaker_notes,
          });

          if (isConfigured()) {
            const availableCourses = listAvailableCourses();
            const courseErrors = [];
            const scenarioData = evalConfigLoader.loadSuggestionScenarios({ forceReload: true });
            const scenarioMap = scenarioData?.scenarios || {};
            for (const [id, scenario] of Object.entries(scenarioMap)) {
              if (scenario.course_ids) {
                for (const courseId of scenario.course_ids) {
                  if (!availableCourses.includes(courseId)) {
                    courseErrors.push(`scenario '${id}': course_id '${courseId}' not found in content directory`);
                  }
                }
              }
            }
            if (courseErrors.length > 0) {
              console.log(`  \u2717 Scenario course_ids: ${courseErrors.length} unresolved`);
              for (const e of courseErrors) console.log(`      - ${e}`);
              warnings += courseErrors.length;
            } else {
              console.log(`  \u2713 Scenario course_ids resolve to content directories`);
            }
          } else {
            console.log('  - Scenario course_ids: content directory not found (skipped)');
          }
        } else {
          console.log('  - Scenario course_ids: no content_package_path configured (skipped)');
        }

        // ── 7. Hyperparameters ────────────────────────────────────────
        const hyperErrors = [];
        for (const name of profilesToCheck) {
          const profile = allProfiles[name];
          for (const role of ['ego', 'superego']) {
            const hyper = profile[role]?.hyperparameters;
            if (!hyper) continue;
            if (hyper.temperature != null && (hyper.temperature < 0 || hyper.temperature > 2)) {
              hyperErrors.push(`${name}: ${role} temperature=${hyper.temperature} (expected 0-2)`);
            }
            if (hyper.max_tokens != null && hyper.max_tokens <= 0) {
              hyperErrors.push(`${name}: ${role} max_tokens=${hyper.max_tokens} (expected > 0)`);
            }
          }
        }
        if (hyperErrors.length > 0) {
          console.log(`  \u2717 Hyperparameters: ${hyperErrors.length} issue(s)`);
          for (const e of hyperErrors) console.log(`      - ${e}`);
          warnings += hyperErrors.length;
        } else {
          console.log('  \u2713 Hyperparameters within valid ranges');
        }

        // ── 8. Prompt file existence ──────────────────────────────────
        // Prompt files live in tutor-core's prompts/ directory (npm-linked)
        let tutorCorePromptsDir = null;
        try {
          const tutorCorePath = path.dirname(
            (await import('module')).createRequire(import.meta.url).resolve('@machinespirits/tutor-core/package.json'),
          );
          tutorCorePromptsDir = path.join(tutorCorePath, 'prompts');
        } catch {
          // tutor-core not linked — try common local path
          const localPath = path.resolve(__dirname, '..', '..', 'machinespirits-tutor-core', 'prompts');
          if (fs.existsSync(localPath)) tutorCorePromptsDir = localPath;
        }

        if (tutorCorePromptsDir && fs.existsSync(tutorCorePromptsDir)) {
          const promptErrors = [];
          const checkedFiles = new Set();
          for (const name of profilesToCheck) {
            const profile = allProfiles[name];
            for (const role of ['ego', 'superego']) {
              const promptFile = profile[role]?.prompt_file;
              if (promptFile && !checkedFiles.has(promptFile)) {
                checkedFiles.add(promptFile);
                const fullPath = path.join(tutorCorePromptsDir, promptFile);
                if (!fs.existsSync(fullPath)) {
                  promptErrors.push(`${name}: ${role} prompt_file '${promptFile}' not found`);
                }
              }
            }
          }
          if (promptErrors.length > 0) {
            console.log(`  \u2717 Prompt files: ${promptErrors.length} missing`);
            for (const e of promptErrors) console.log(`      - ${e}`);
            errors += promptErrors.length;
          } else {
            console.log(`  \u2713 All ${checkedFiles.size} prompt files exist in tutor-core`);
          }
        } else {
          console.log('  - Prompt files: tutor-core prompts directory not found (skipped)');
        }

        // ── Verbose: per-profile detail ───────────────────────────────
        if (verbose) {
          console.log('\n' + '─'.repeat(60));
          console.log('  Per-profile details:');
          console.log('─'.repeat(60));
          for (const name of profilesToCheck) {
            const profile = allProfiles[name];
            const arch = profile.dialogue?.enabled ? 'ego+superego' : 'single-agent';
            const learner = profile.learner_architecture || '(default)';
            const egoRef = profile.ego ? `${profile.ego.provider}.${profile.ego.model}` : '(none)';
            const supRef = profile.superego ? `${profile.superego.provider}.${profile.superego.model}` : '(none)';
            const recog = profile.recognition_mode ? 'yes' : 'no';
            console.log(`  ${name}`);
            console.log(`    arch: ${arch}  learner: ${learner}  recog: ${recog}`);
            console.log(`    ego: ${egoRef}  superego: ${supRef}`);
          }
        }

        // ── Summary ───────────────────────────────────────────────────
        console.log(`\n${warnings} warning(s), ${errors} error(s)`);
        if (errors > 0) {
          process.exit(1);
        }
        break;
      }

      case 'play': {
        const humanSide = getOption('as') || 'tutor';
        const humanRole = getOption('role') || 'ego';
        const scenarioId = getOption('scenario') || null;
        const profileName = getOption('profile') || null;

        if (!['tutor', 'learner'].includes(humanSide)) {
          console.error(theme.error(`Invalid --as value: ${humanSide}. Use 'tutor' or 'learner'.`));
          process.exit(1);
        }
        if (!['ego', 'superego', 'both'].includes(humanRole)) {
          console.error(theme.error(`Invalid --role value: ${humanRole}. Use 'ego', 'superego', or 'both'.`));
          process.exit(1);
        }

        const { runPlay } = await import('./playCommand.js');
        await runPlay({ humanSide, humanRole, scenarioId, profileName });
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error(
          'Available commands: list, quick, test, run, runs, report, status, watch, transcript, export, cleanup, resume, revert, rejudge, evaluate, evaluate-learner, validate-config, chat, play',
        );
        process.exit(1);
    }
  } catch (error) {
    console.error(theme.error(`\nError: ${error.message}`));
    if (getFlag('verbose')) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
