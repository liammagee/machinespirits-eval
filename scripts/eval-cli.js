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
 *   --verbose              Enable verbose output
 *   --runs <n>             Replications per cell (for 'run' command, default: 1)
 *   --parallelism <n>      Parallel worker count (run/resume default: 2, evaluate-learner default: 1)
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
  buildPerTurnTutorEvaluationPrompt,
  buildBatchedPerTurnTutorPrompt,
  buildTutorHolisticEvaluationPrompt,
  buildDialogueQualityPrompt,
  calculateOverallScore,
  calculateBaseScore,
  calculateRecognitionScore,
  calculateDialogueQualityScore,
  calculateTutorHolisticScore,
  buildDialoguePublicTranscript,
  buildDialogueFullTranscript,
  hasTutorSuperego,
  buildTutorDeliberationPrompt,
  buildLearnerDeliberationPrompt,
  calculateDeliberationScore,
  setTutorHolisticRubricPathOverride,
  clearTutorHolisticRubricPathOverride,
  setDialogueRubricPathOverride,
  clearDialogueRubricPathOverride,
  setDeliberationRubricPathOverride,
  clearDeliberationRubricPathOverride,
} from '../services/rubricEvaluator.js';
import {
  buildLearnerEvaluationPrompt,
  buildBatchedLearnerPrompt,
  buildLearnerHolisticEvaluationPrompt,
  calculateLearnerOverallScore,
  setLearnerRubricPathOverride,
  clearLearnerRubricPathOverride,
} from '../services/learnerRubricEvaluator.js';
import { setRubricPathOverride, clearRubricPathOverride } from '../services/evalConfigLoader.js';
import { readProgressLog, getProgressLogPath } from '../services/progressLogger.js';
import * as evalConfigLoader from '../services/evalConfigLoader.js';
const { getScenario } = evalConfigLoader;
import { projectTranscriptArtifacts } from '../services/transcriptProjection.js';
import theme from '../services/cliTheme.js';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, '..', 'logs', 'tutor-dialogues');
const RUBRICS_DIR = path.resolve(__dirname, '..', 'config', 'rubrics');

/**
 * Resolve versioned rubric file paths for --rubric-version.
 * @param {string} version - Rubric version (e.g. "2.2")
 * @returns {{ tutor, learner, tutorHolistic, dialogue, deliberation }} Absolute paths
 */
function resolveRubricPaths(version) {
  const dir = path.join(RUBRICS_DIR, `v${version}`);
  if (!fs.existsSync(dir)) {
    throw new Error(`Rubric version directory not found: ${dir}`);
  }
  const files = {
    tutor: path.join(dir, 'evaluation-rubric.yaml'),
    learner: path.join(dir, 'evaluation-rubric-learner.yaml'),
    tutorHolistic: path.join(dir, 'evaluation-rubric-tutor-holistic.yaml'),
    dialogue: path.join(dir, 'evaluation-rubric-dialogue.yaml'),
    deliberation: path.join(dir, 'evaluation-rubric-deliberation.yaml'),
  };
  for (const [key, filePath] of Object.entries(files)) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Rubric file missing for ${key}: ${filePath}`);
    }
  }
  return files;
}

/**
 * Set all 5 rubric path overrides for versioned scoring.
 */
function setAllRubricOverrides(paths) {
  setRubricPathOverride(paths.tutor);
  setLearnerRubricPathOverride(paths.learner);
  setTutorHolisticRubricPathOverride(paths.tutorHolistic);
  setDialogueRubricPathOverride(paths.dialogue);
  setDeliberationRubricPathOverride(paths.deliberation);
}

/**
 * Clear all 5 rubric path overrides.
 */
function clearAllRubricOverrides() {
  clearRubricPathOverride();
  clearLearnerRubricPathOverride();
  clearTutorHolisticRubricPathOverride();
  clearDialogueRubricPathOverride();
  clearDeliberationRubricPathOverride();
}

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith('--')) || 'list';
const FACTORIAL_2X2X2_PROFILES = [
  'cell_1_base_single_unified',
  'cell_2_base_single_psycho',
  'cell_3_base_multi_unified',
  'cell_4_base_multi_psycho',
  'cell_5_recog_single_unified',
  'cell_6_recog_single_psycho',
  'cell_7_recog_multi_unified',
  'cell_8_recog_multi_psycho',
];
const FACTORIAL_2X2X2_PROFILE_SET = new Set(FACTORIAL_2X2X2_PROFILES);

function getFlag(name) {
  return args.includes(`--${name}`);
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

function resolveDefaultCliJudgeModelOverride(judgeCli) {
  try {
    const cli = String(judgeCli || '').toLowerCase();
    if (cli !== 'claude') return null;
    return evalConfigLoader.loadRubric()?.claude_code_judge?.model || null;
  } catch {
    return null;
  }
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

function matchesTextFilter(values, patterns) {
  if (!patterns || patterns.length === 0) return true;
  const haystack = (values || []).map((value) => String(value || '').toLowerCase());
  return patterns.some((pattern) => haystack.some((value) => value.includes(pattern.toLowerCase())));
}

function filterRunsForDeletion(runs, filters = {}) {
  const {
    runIds = [],
    dryRunOnly = false,
    descriptionContains = null,
    profileFilters = [],
    scenarioFilters = [],
    statusFilter = null,
    beforeDate = null,
  } = filters;

  const wantedRunIds = new Set(runIds.map((id) => expandRunId(id)));

  return runs.filter((run) => {
    if (wantedRunIds.size > 0 && !wantedRunIds.has(run.id)) return false;
    if (dryRunOnly && !run.metadata?.dryRun) return false;
    if (statusFilter && run.status !== statusFilter) return false;
    if (descriptionContains) {
      const desc = String(run.description || '').toLowerCase();
      if (!desc.includes(descriptionContains.toLowerCase())) return false;
    }

    const allProfiles = [
      ...new Set([...(run.profileNames || []), ...(run.metadata?.profileNames || []).filter(Boolean)]),
    ];
    if (!matchesTextFilter(allProfiles, profileFilters)) return false;

    const scenarioIds = [...new Set((run.metadata?.scenarioIds || []).filter(Boolean))];
    if (!matchesTextFilter(scenarioIds, scenarioFilters)) return false;

    if (beforeDate) {
      const createdAt = run.createdAt ? new Date(run.createdAt) : null;
      if (!createdAt || Number.isNaN(createdAt.getTime()) || createdAt >= beforeDate) return false;
    }

    return true;
  });
}

function renderDeleteRunsPreview(runs) {
  return runs
    .map((run) => {
      const mode = run.metadata?.dryRun ? 'mock' : 'live';
      const profiles = (run.profileNames || run.metadata?.profileNames || []).slice(0, 2).join(',') || '--';
      const scenarios = (run.metadata?.scenarioIds || []).slice(0, 2).join(',') || '--';
      return `${run.id}  ${mode.padEnd(4)}  ${String(run.status || '--').padEnd(9)}  profiles=${profiles}  scenarios=${scenarios}  desc="${run.description || ''}"`;
    })
    .join('\n');
}

function validateCanonicalFactorialTutorEgoModels({
  profileNames,
  modelOverride = null,
  egoModelOverride = null,
  allowModelMix = false,
}) {
  if (allowModelMix) return { ok: true, skipped: 'allow-model-mix' };
  if (!Array.isArray(profileNames) || profileNames.length < 2) return { ok: true, skipped: 'not-enough-profiles' };
  if (!profileNames.every((name) => FACTORIAL_2X2X2_PROFILE_SET.has(name))) {
    return { ok: true, skipped: 'non-canonical-profile-set' };
  }

  let overrideModel = null;
  let overrideSource = null;
  if (modelOverride) {
    const resolved = evalConfigLoader.resolveModel(modelOverride);
    overrideModel = resolved.model;
    overrideSource = '--model';
  } else if (egoModelOverride) {
    const resolved = evalConfigLoader.resolveModel(egoModelOverride);
    overrideModel = resolved.model;
    overrideSource = '--ego-model';
  }

  const rows = profileNames.map((profileName) => {
    const profile = evalConfigLoader.getTutorProfile(profileName);
    if (!profile?.ego?.provider || !profile?.ego?.model) {
      throw new Error(`Profile "${profileName}" is missing tutor ego provider/model.`);
    }

    return {
      profileName,
      model: overrideModel || profile.ego.resolvedModel || profile.ego.model,
      source: overrideSource || `${profile.ego.provider}.${profile.ego.model}`,
    };
  });

  const uniqueModels = [...new Set(rows.map((row) => row.model))];
  if (uniqueModels.length <= 1) return { ok: true, rows };

  return {
    ok: false,
    uniqueModels,
    rows,
  };
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
function deriveActiveTestProgress(events) {
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

function formatActiveTestProgress(activeTest) {
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

function enrichRunsWithActiveTests(runs) {
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
function renderRunsTable(runs) {
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

/**
 * Extract learner turns from a dialogue trace, handling both conversation modes.
 *
 * Single-prompt mode: learner turns are `user/turn_action` or `learner/turn_action` entries.
 * Messages mode: no turn_action entries exist; use `learner/final_output` entries
 * (or legacy `learner_synthesis/response`) as learner turn markers,
 * with conversationHistory providing message content.
 *
 * @param {Array} trace - dialogueTrace array
 * @param {boolean} isMultiAgent - whether the learner is ego_superego
 * @param {Array} [conversationHistory] - optional conversationHistory from dialogue log
 * @returns {Array} learnerTurns: [{turnIndex, externalMessage, internalDeliberation}]
 */
function extractLearnerTurnsFromTrace(trace, isMultiAgent, conversationHistory) {
  const learnerTurns = [];

  // Strategy 1: look for explicit turn_action entries (single-prompt mode)
  let turnMarkers = trace.filter((t) => (t.agent === 'learner' || t.agent === 'user') && t.action === 'turn_action');

  // Strategy 2: fall back to learner final output entries (messages mode — any learner architecture).
  // Matches both current (learner/final_output) and legacy (learner_synthesis/response) schemas.
  if (turnMarkers.length === 0) {
    turnMarkers = trace.filter(
      (t) =>
        (t.agent === 'learner_synthesis' && t.action === 'response') ||
        (t.agent === 'learner' && t.action === 'final_output'),
    );
  }

  // Build conversationHistory lookup for supplementing empty messages
  const convHistByTurn = {};
  if (Array.isArray(conversationHistory)) {
    conversationHistory.forEach((ch, i) => {
      if (ch.learnerMessage) convHistByTurn[i] = ch.learnerMessage;
    });
  }

  for (const ta of turnMarkers) {
    // For final_output entries, contextSummary is truncated to 100 chars — use detail instead
    let rawMessage = ta.action === 'final_output' ? ta.detail || ta.contextSummary || '' : ta.contextSummary || '';

    // Strip [INTERNAL] section from unified learner output (prompt requests [INTERNAL]/[EXTERNAL] format)
    const externalMatch = rawMessage.match(/\[EXTERNAL\]:?\s*([\s\S]*)/i);
    if (externalMatch) rawMessage = externalMatch[1].trim();

    const turnData = {
      turnIndex: ta.turnIndex,
      externalMessage: rawMessage,
      internalDeliberation: [],
    };

    // If message is empty, try conversationHistory (turn indices are offset by 1 since
    // convHistory[0] is the learner response after tutor Turn 0 → maps to turnIndex 1)
    if (!turnData.externalMessage && ta.turnIndex != null) {
      turnData.externalMessage = convHistByTurn[ta.turnIndex - 1] || '';
    }

    // Collect internal deliberation entries for multi-agent learners
    if (isMultiAgent) {
      const taIdx = trace.indexOf(ta);
      for (let j = taIdx - 1; j >= 0; j--) {
        const entry = trace[j];
        if (entry.agent === 'learner_ego_initial' && entry.action === 'deliberation') {
          turnData.internalDeliberation.unshift({ role: 'ego_initial', content: entry.contextSummary || '' });
          break;
        } else if (entry.agent === 'learner_superego' && entry.action === 'deliberation') {
          turnData.internalDeliberation.unshift({ role: 'superego', content: entry.contextSummary || '' });
        } else if (entry.agent === 'learner_ego_revision' && entry.action === 'deliberation') {
          turnData.internalDeliberation.unshift({ role: 'ego_revision', content: entry.contextSummary || '' });
        } else if (
          (entry.agent === 'learner_synthesis' && entry.action === 'response') ||
          (entry.agent === 'learner' && entry.action === 'final_output')
        ) {
          // final learner output — if this IS our marker, skip it
        } else if (entry.agent === 'ego' || entry.agent === 'system' || entry.agent === 'superego') {
          break;
        }
      }
    }

    learnerTurns.push(turnData);
  }

  return learnerTurns;
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
          `--- ${r.scenarioName || r.scenarioId} | ${r.profileName} | score=${r.tutorFirstTurnScore?.toFixed(1) ?? '--'} ---`,
        );
        let printed = false;
        if (r.dialogueId) {
          const dialogue = evaluationStore.loadDialogueLog(r.dialogueId);
          if (dialogue) {
            for (const entry of dialogue.dialogueTrace || []) {
              lines.push(`[${(entry.role || 'unknown').toUpperCase()}] ${entry.content || ''}`);
            }
            printed = true;
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
        { column: 'tutor_first_turn_score', label: 'Tutor First-Turn Score' },
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

async function callOpenRouter(messages, model, apiKey, hyperparameters = {}) {
  const { temperature, max_tokens } = hyperparameters;
  if (temperature === undefined) throw new Error('Explicit temperature setting required for judge chat model.');
  if (max_tokens === undefined) throw new Error('Explicit max_tokens setting required for judge chat model.');

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
      temperature,
      max_tokens,
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
        const response = await callOpenRouter(messages, chatModel, apiKey, judge.hyperparameters || {});
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
        const allowModelMix = getFlag('allow-model-mix');
        const modelOverride = getOption('model');
        const judgeOverride = getOption('judge');
        const judgeCli = getOption('judge-cli') || null;
        const judgeCliModel = getOption('judge-cli-model') || null;
        const tutorModelOverride = getOption('tutor-model');
        const egoModelOverride = getOption('ego-model');
        const superegoModelOverride = getOption('superego-model');
        const learnerModelOverride = getOption('learner-model');
        const learnerEgoModelOverride = getOption('learner-ego-model');
        const learnerSuperegoModelOverride = getOption('learner-superego-model');
        const transcriptMode = getFlag('transcript');
        const maxTokensOverride = getOption('max-tokens');

        // --show-messages or --show-messages=full
        const showMessagesRaw = args.find((a) => a === '--show-messages' || a.startsWith('--show-messages='));
        const showMessages =
          showMessagesRaw === '--show-messages'
            ? true
            : showMessagesRaw?.startsWith('--show-messages=')
              ? showMessagesRaw.split('=')[1] || true
              : false;

        // --live: stream one-line display per API call in real time
        const liveApi = getFlag('live');

        // --cluster and --scenario are mutually exclusive
        if (clusterOpt && scenarioOpt) {
          console.error('Error: --cluster and --scenario are mutually exclusive.');
          process.exit(1);
        }
        if (judgeOverride && judgeCli) {
          console.error('Error: use either --judge or --judge-cli, not both.');
          process.exit(1);
        }
        if (judgeCli && !['claude', 'gemini', 'codex'].includes(judgeCli.toLowerCase())) {
          console.error(`Error: --judge-cli must be 'claude', 'gemini', or 'codex', got '${judgeCli}'`);
          process.exit(1);
        }

        const scenarios = scenarioOpt ? scenarioOpt.split(',').map((s) => s.trim()) : 'all';

        // Determine configurations: explicit --profile overrides everything,
        // --all-profiles loads every profile, default is the 8 factorial cells.
        const profileOpt = getOption('config') || getOption('profile') || getOption('profiles');
        let configurations;
        let isFactorial = false;
        let selectedProfileNames = [];

        if (profileOpt) {
          // Explicit profile selection (single or comma-separated)
          const profileNames = profileOpt.includes(',') ? profileOpt.split(',').map((s) => s.trim()) : [profileOpt];
          selectedProfileNames = profileNames;
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
          selectedProfileNames = [...FACTORIAL_2X2X2_PROFILES];
        }

        const shouldGuardFactorialModels =
          selectedProfileNames.length > 1 &&
          selectedProfileNames.every((name) => FACTORIAL_2X2X2_PROFILE_SET.has(name));

        if (shouldGuardFactorialModels) {
          const yamlOverrides = evalConfigLoader.getTutorModelOverrides();
          const effectiveModelOverride = modelOverride || yamlOverrides.modelOverride || null;
          const effectiveEgoModelOverride = egoModelOverride || yamlOverrides.egoModelOverride || null;
          let modelGuard;

          try {
            modelGuard = validateCanonicalFactorialTutorEgoModels({
              profileNames: selectedProfileNames,
              modelOverride: effectiveModelOverride,
              egoModelOverride: effectiveEgoModelOverride,
              allowModelMix,
            });
          } catch (err) {
            console.error('\nFactorial model consistency check failed.');
            console.error(`  ${err.message}`);
            process.exit(1);
          }

          if (!modelGuard.ok) {
            console.error('\nError: Canonical 2x2x2 factorial run has mixed tutor ego models.');
            console.error('This introduces a model confound across cells (e.g., 6/8 vs others).');
            console.error('\nDetected tutor ego models by profile:');
            for (const row of modelGuard.rows) {
              console.error(`  - ${row.profileName}: ${row.model} (source: ${row.source})`);
            }
            console.error('\nFix options:');
            console.error('  1) Align profile ego models in config/tutor-agents.yaml');
            console.error('  2) Run with --model <provider.alias> or --ego-model <provider.alias>');
            console.error('  3) Bypass explicitly with --allow-model-mix');
            process.exit(1);
          }
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
          if (judgeOverride) {
            console.log(`  Judge override: ${judgeOverride}`);
          } else if (judgeCli) {
            console.log(`  Judge CLI: ${judgeCli}${judgeCliModel ? ` (${judgeCliModel})` : ''}`);
          }
          if (learnerModelOverride) {
            console.log(`  Learner model override: ${learnerModelOverride}`);
          } else if (learnerEgoModelOverride || learnerSuperegoModelOverride) {
            if (learnerEgoModelOverride) console.log(`  Learner ego model override: ${learnerEgoModelOverride}`);
            if (learnerSuperegoModelOverride)
              console.log(`  Learner superego model override: ${learnerSuperegoModelOverride}`);
          }
          if (maxTokensOverride) console.log(`  Max tokens override: ${maxTokensOverride}`);
          console.log('');
        }

        if (clusterOpt) {
          console.log(`Cluster filter: ${clusterOpt}\n`);
        }
        const runStartTime = new Date();
        console.log(
          `Starting evaluation run at ${runStartTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})...\n`,
        );
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
          judgeOverride: judgeOverride || null,
          judgeCli: judgeCli ? judgeCli.toLowerCase() : null,
          judgeCliModel: judgeCliModel || null,
          tutorModelOverride: tutorModelOverride || null,
          egoModelOverride: egoModelOverride || null,
          superegoModelOverride: superegoModelOverride || null,
          learnerModelOverride: learnerModelOverride || null,
          learnerEgoModelOverride: learnerEgoModelOverride || null,
          learnerSuperegoModelOverride: learnerSuperegoModelOverride || null,
          dryRun,
          transcriptMode,
          maxTokensOverride: maxTokensOverride ? parseInt(maxTokensOverride, 10) : null,
          showMessages,
          liveApi,
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
            const runEndTime = new Date();
            console.log('\n' + '='.repeat(80));
            console.log('  TOKEN & COST SUMMARY');
            console.log('='.repeat(80));
            console.log(
              `  Finished:  ${runEndTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
            );
            console.log(`  Duration:  ${((runEndTime - runStartTime) / 1000 / 60).toFixed(1)} min`);

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
            { column: 'tutor_first_turn_score', label: 'Tutor First-Turn Score' },
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
                console.log(
                  theme.dim(`Runs  (${new Date().toLocaleTimeString()}, refresh ${refreshMs}ms, Ctrl+C to exit)`),
                );
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
            break;
          }
          if (!groupByConfig) runs.reverse(); // oldest first → newest at bottom
          const label = groupByConfig ? 'grouped by model config' : `${runs.length} total`;
          console.log(`\nEvaluation runs (${label}):\n`);
          console.log(renderRunsTable(runs));
          console.log('');
        }
        break;
      }

      case 'report': {
        const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'report'));
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
        const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'status'));
        if (!runId) {
          console.error('Usage: eval-cli.js status <runId>');
          process.exit(1);
        }

        // Try JSONL first for in-progress runs
        const events = readProgressLog(runId);
        if (events.length > 0) {
          const gridResult = buildGridFromEvents(events);
          const activeTest = deriveActiveTestProgress(events);
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
          if (!runDone && activeTest) {
            console.log(`Current test: ${theme.dim(formatActiveTestProgress(activeTest))}`);
          }
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
        const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'watch'));
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
                score: r.tutorFirstTurnScore,
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
        const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'transcript'));
        if (!runId) {
          console.error(
            'Usage: eval-cli.js transcript <runId> [--scenario <id>] [--profile <name>] [--dialogue <id>] [--all-matches] [--detail play|compact|messages-only|full|bilateral]',
          );
          process.exit(1);
        }

        const scenarioFilter = getOption('scenario') || getOption('test') || null;
        const profileFilter = getOption('profile') || null;
        const dialogueFilter = getOption('dialogue') || getOption('dialogue-id') || null;
        const showAllMatches = getFlag('all-matches');
        // Determine detail level: --compact and --messages-only are shortcuts, --detail is explicit
        let detailLevel = getOption('detail') || 'play';
        if (getFlag('compact')) detailLevel = 'compact';
        if (getFlag('messages-only')) detailLevel = 'messages-only';
        if (getFlag('full')) detailLevel = 'full';
        if (getFlag('bilateral')) detailLevel = 'bilateral';

        let results = evaluationStore.getResults(runId, {
          scenarioId: scenarioFilter,
          profileName: profileFilter,
        });

        if (dialogueFilter) {
          const exact = results.filter((r) => (r.dialogueId || '') === dialogueFilter);
          results = exact.length > 0 ? exact : results.filter((r) => (r.dialogueId || '').includes(dialogueFilter));
          if (!showAllMatches && results.length > 1) {
            results = [results[results.length - 1]];
          }
        }

        if (results.length === 0) {
          console.log(`\nNo results found for run: ${runId}`);
          if (scenarioFilter) console.log(`  scenario filter: ${scenarioFilter}`);
          if (profileFilter) console.log(`  profile filter: ${profileFilter}`);
          if (dialogueFilter) console.log(`  dialogue filter: ${dialogueFilter}`);
          break;
        }

        console.log(`\nTranscripts for run: ${theme.id(runId)} (${results.length} results, detail: ${detailLevel})\n`);
        if (scenarioFilter) console.log(`${theme.dim('scenario filter:')} ${scenarioFilter}`);
        if (profileFilter) console.log(`${theme.dim('profile filter:')} ${profileFilter}`);
        if (dialogueFilter) {
          console.log(
            `${theme.dim('dialogue filter:')} ${dialogueFilter}${showAllMatches ? '' : ' (latest match only)'}`,
          );
        }
        if (scenarioFilter || profileFilter || dialogueFilter) console.log('');

        for (const result of results) {
          console.log(theme.dim('='.repeat(80)));
          console.log(`Scenario: ${theme.header(result.scenarioName || result.scenarioId)}`);
          console.log(`Profile:  ${theme.model(result.profileName || `${result.provider}/${result.model}`)}`);
          console.log(
            `Score:    ${theme.score(result.tutorFirstTurnScore != null ? result.tutorFirstTurnScore.toFixed(1) : '--')}  |  Success: ${result.success ? theme.success('true') : theme.error('false')}`,
          );
          console.log(theme.dim('-'.repeat(80)));

          // Try dialogue log file first (rich trace with metadata)
          let printed = false;
          if (result.dialogueId) {
            const dialogue = evaluationStore.loadDialogueLog(result.dialogueId);
            if (dialogue) {
              const trace = dialogue.dialogueTrace || [];
              if (trace.length > 0) {
                const projection = projectTranscriptArtifacts({
                  trace,
                  turnResults: dialogue.turnResults || [],
                  learnerContext: dialogue.learnerContext || '',
                  scenarioName: result.scenarioName || result.scenarioId,
                  profileName: result.profileName || '',
                  totalTurns: dialogue.totalTurns || 0,
                  detail: detailLevel,
                });

                console.log(projection.formatted);

                if (projection.judged?.publicTranscript || projection.judged?.fullTranscript) {
                  console.log(theme.dim('Judge-visible transcript (public):'));
                  console.log(projection.judged.publicTranscript || '(missing)');
                  console.log('');
                  console.log(theme.dim('Judge-visible transcript (full/internal):'));
                  console.log(projection.judged.fullTranscript || '(missing)');
                  console.log('');
                }

                if (projection.diagnostics?.effectCount > 0) {
                  console.log(theme.warn('Projection Diagnostics:'));
                  for (const effect of projection.diagnostics.effects) {
                    const sev = effect.severity?.toUpperCase?.() || 'INFO';
                    console.log(`  - [${sev}] ${effect.message}`);
                    for (const step of effect.remedialSteps || []) {
                      console.log(`      remediation: ${step}`);
                    }
                  }
                  console.log('');
                }
                printed = true;
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

      case 'delete-runs': {
        const force = getFlag('force');
        const runIds = getCsvOption('run-id');
        const dryRunOnly = getFlag('dry-run-runs');
        const descriptionContains = getOption('description', null);
        const profileFilters = getCsvOption('profile');
        const scenarioFilters = getCsvOption('scenario');
        const statusFilter = getOption('status', null);
        const beforeRaw = getOption('before', null);
        const beforeDate = beforeRaw ? new Date(beforeRaw) : null;

        if (beforeRaw && Number.isNaN(beforeDate?.getTime?.())) {
          console.error('Error: --before must be a valid date in YYYY-MM-DD format');
          process.exit(1);
        }

        const hasFilter =
          runIds.length > 0 ||
          dryRunOnly ||
          Boolean(descriptionContains) ||
          profileFilters.length > 0 ||
          scenarioFilters.length > 0 ||
          Boolean(statusFilter) ||
          Boolean(beforeRaw);

        if (!hasFilter) {
          console.error(
            'Error: delete-runs requires at least one filter (--run-id, --dry-run-runs, --description, --profile, --scenario, --status, or --before)',
          );
          process.exit(1);
        }

        let runs = evaluationStore.listRuns({ limit: null, status: statusFilter });
        runs = filterRunsForDeletion(runs, {
          runIds,
          dryRunOnly,
          descriptionContains,
          profileFilters,
          scenarioFilters,
          statusFilter,
          beforeDate,
        });

        if (runs.length === 0) {
          console.log('\nNo runs matched the delete filters.\n');
          break;
        }

        runs.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

        console.log(`\nMatched ${runs.length} run(s) for deletion:\n`);
        console.log(renderDeleteRunsPreview(runs));
        console.log('');

        if (!force) {
          console.log('Dry run only. Re-run with --force to actually delete these runs.\n');
          break;
        }

        let deletedRuns = 0;
        let deletedResults = 0;
        let deletedInteractionEvals = 0;
        let deletedAuditRows = 0;

        for (const run of runs) {
          const summary = evaluationStore.deleteRun(run.id);
          deletedRuns += summary?.deletedRuns || 0;
          deletedResults += summary?.deletedResults || 0;
          deletedInteractionEvals += summary?.deletedInteractionEvals || 0;
          deletedAuditRows += summary?.deletedAuditRows || 0;
        }

        console.log(
          `Deleted ${deletedRuns} run(s), ${deletedResults} evaluation row(s), ${deletedInteractionEvals} interaction eval(s), ${deletedAuditRows} audit row(s).\n`,
        );
        break;
      }

      case 'resume': {
        const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'resume'));
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
            { column: 'tutor_first_turn_score', label: 'Tutor First-Turn Score' },
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
        const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'revert'));
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
        const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'rejudge'));
        if (!runId) {
          console.error(
            'Usage: eval-cli.js rejudge <runId> [--judge <model> | --judge-cli <claude|gemini|codex> [--model <model>]] [--scenario <id>] [--source-judge <label>] [--limit <N>] [--verbose] [--overwrite] [--skip-learner] [--skip-deliberation]',
          );
          console.error('');
          console.error('By default, creates new rows (preserves history for inter-judge reliability).');
          console.error('Use --overwrite to replace existing scores instead.');
          console.error('Use --skip-learner to skip learner + dialogue + holistic scoring (tutor-only rejudge).');
          console.error('Use --skip-deliberation to skip deliberation scoring.');
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
        const skipLearner = getFlag('skip-learner');
        const skipDeliberation = getFlag('skip-deliberation');
        const judgeOverride = getOption('judge') || null;
        const judgeCli = getOption('judge-cli') || null;
        const judgeCliModel = getOption('model') || null;
        const scenarioFilter = getOption('scenario') || null;
        const limitStr = getOption('limit') || null;
        const limit = limitStr ? parseInt(limitStr, 10) : null;
        const sourceJudge = getOption('source-judge') || null;

        if (judgeOverride && judgeCli) {
          console.error('Error: rejudge accepts either --judge or --judge-cli, not both');
          process.exit(1);
        }
        if (judgeCli && !['claude', 'gemini', 'codex'].includes(judgeCli.toLowerCase())) {
          console.error(`Error: --judge-cli must be 'claude', 'gemini', or 'codex', got '${judgeCli}'`);
          process.exit(1);
        }

        const rejudgeStartTime = new Date();
        console.log(`\nRejudging run: ${runId}`);
        console.log(
          `  Started:   ${rejudgeStartTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
        );
        if (judgeOverride) console.log(`  Judge override: ${judgeOverride}`);
        if (judgeCli) console.log(`  Judge CLI: ${judgeCli}${judgeCliModel ? ` (${judgeCliModel})` : ''}`);
        if (scenarioFilter) console.log(`  Scenario filter: ${scenarioFilter}`);
        if (sourceJudge) console.log(`  Source judge: ${sourceJudge}`);
        if (limit) console.log(`  Limit: ${limit} records`);
        console.log(`  Mode: ${overwrite ? 'overwrite (replace existing)' : 'preserve history (add new rows)'}`);
        if (skipLearner) console.log('  Skipping: learner + dialogue + holistic scoring');
        if (skipDeliberation) console.log('  Skipping: deliberation scoring');
        console.log('');

        const summary = await evaluationRunner.rejudgeRun(runId, {
          judgeOverride,
          judgeCli,
          judgeCliModel,
          verbose,
          scenarioFilter,
          overwrite,
          skipLearner,
          skipDeliberation,
          limit,
          sourceJudge,
        });

        const rejudgeEndTime = new Date();
        console.log('\n' + '='.repeat(60));
        console.log('  REJUDGE SUMMARY');
        console.log('='.repeat(60));
        console.log(`  Run:       ${summary.runId}`);
        console.log(
          `  Finished:  ${rejudgeEndTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
        );
        console.log(`  Duration:  ${((rejudgeEndTime - rejudgeStartTime) / 1000 / 60).toFixed(1)} min`);
        console.log(`  Total:     ${summary.total}`);
        console.log(`  Succeeded: ${summary.succeeded}`);
        console.log(`  Failed:    ${summary.failed}`);
        console.log(`  Old avg:   ${summary.oldAvgScore?.toFixed(2) ?? 'N/A'}`);
        console.log(`  New avg:   ${summary.newAvgScore?.toFixed(2) ?? 'N/A'}`);
        if (summary.scoreDelta != null) {
          const sign = summary.scoreDelta >= 0 ? '+' : '';
          console.log(`  Delta:     ${sign}${summary.scoreDelta.toFixed(2)}`);
        }
        if (summary.usage && summary.usage.calls > 0) {
          console.log(`  API calls: ${summary.usage.calls}`);
          console.log(
            `  Tokens:    ${summary.usage.inputTokens.toLocaleString()} in / ${summary.usage.outputTokens.toLocaleString()} out (${(summary.usage.inputTokens + summary.usage.outputTokens).toLocaleString()} total)`,
          );
          if (summary.usage.cost > 0) {
            console.log(`  Cost:      $${summary.usage.cost.toFixed(4)}`);
          }
        }
        console.log('');
        break;
      }

      case 'export': {
        const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'export'));
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
          lines.push(
            `Score:    ${result.tutorFirstTurnScore != null ? result.tutorFirstTurnScore.toFixed(1) : 'NOT EVALUATED'}`,
          );
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
        const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'evaluate'));
        if (!runId) {
          console.error(
            'Usage: eval-cli.js evaluate <runId> [--scenario <id>] [--profile <name>] [--model <model>] [--judge <judge>] [--force] [--multiturn-only] [--restore-turn0] [--tutor-only] [--skip-deliberation] [--follow] [--review] [--refresh <ms>] [--rubric-version <ver>] [--parallelism N] [--verbose]',
          );
          process.exit(1);
        }

        const verbose = getFlag('verbose');
        const force = getFlag('force');
        const follow = getFlag('follow');
        const review = getFlag('review');
        const multiturnOnly = getFlag('multiturn-only');
        const restoreTurn0 = getFlag('restore-turn0');
        const tutorOnly = getFlag('tutor-only');
        const skipDeliberation = getFlag('skip-deliberation');
        const refreshMs = parseInt(getOption('refresh', '5000'), 10);
        const scenarioFilter = getOption('scenario') || getOption('scenarios') || null;
        const profileFilter = getOption('profile') || getOption('profiles') || null;
        const modelOverride = getOption('model') || null;
        const judgeCli = (getOption('judge-cli') || 'claude').toLowerCase();
        const judgeFilter = getOption('judge') || null;
        const rubricVersionOpt = getOption('rubric-version') || null;
        const parsedParallelism = parseInt(getOption('parallelism', '1'), 10);
        const parallelism = Number.isFinite(parsedParallelism) && parsedParallelism > 0 ? parsedParallelism : 1;

        if (!['claude', 'gemini', 'codex'].includes(judgeCli)) {
          console.error(`Error: --judge-cli must be 'claude', 'gemini', or 'codex', got '${judgeCli}'`);
          process.exit(1);
        }

        // Resolve effective judge model: CLI --model > YAML config > default
        // YAML claude_code_judge.model is only relevant for Claude CLI — skip for Gemini/Codex
        const effectiveJudgeModel = modelOverride || resolveDefaultCliJudgeModelOverride(judgeCli);
        const judgeModelLabel =
          judgeCli === 'gemini'
            ? `gemini-cli/${effectiveJudgeModel || 'auto'}`
            : judgeCli === 'codex'
              ? `codex-cli/${effectiveJudgeModel || 'auto'}`
              : effectiveJudgeModel
                ? `claude-code/${effectiveJudgeModel}`
                : 'claude-opus-4.6';

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

          const suggestion = restoreTurn0
            ? result.suggestions?.[0]
            : result.dialogueId && result.suggestions?.length > 1
              ? result.suggestions[result.suggestions.length - 1]
              : result.suggestions?.[0];
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

          // Build CLI command based on --judge-cli selection
          let cliBinary, cliArgs, cliEnv;
          if (judgeCli === 'gemini') {
            cliBinary = 'gemini';
            cliArgs = ['-s', '-o', 'text'];
            if (effectiveJudgeModel) {
              cliArgs.push('-m', effectiveJudgeModel);
            }
            cliEnv = { ...process.env };
          } else if (judgeCli === 'codex') {
            cliBinary = 'codex';
            cliArgs = ['exec', '-'];
            if (effectiveJudgeModel) {
              cliArgs.push('-m', effectiveJudgeModel);
            }
            cliEnv = { ...process.env };
          } else {
            cliBinary = 'claude';
            cliArgs = ['-p', '-', '--output-format', 'text'];
            if (effectiveJudgeModel) {
              cliArgs.push('--model', effectiveJudgeModel);
            }
            cliEnv = { ...process.env };
            delete cliEnv.ANTHROPIC_API_KEY;
            delete cliEnv.CLAUDECODE;
          }

          if (verbose) {
            console.log(`${tag} ${scenarioId} / ${profileName} ... calling ${cliBinary}`);
          }

          const stdout = await new Promise((resolve, reject) => {
            const child = spawn(cliBinary, cliArgs, {
              stdio: ['pipe', 'pipe', 'pipe'],
              env: cliEnv,
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
              if (code !== 0) reject(new Error(err || out || `${cliBinary} exited with code ${code}`));
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

          const tutorFirstTurnScore =
            Object.keys(normalizedScores).length > 0 ? calculateOverallScore(normalizedScores) : parsed.overall_score;
          const baseScore = calculateBaseScore(normalizedScores);
          const recognitionScore = calculateRecognitionScore(normalizedScores);

          const judgeLatencyMs = Date.now() - startTime;
          const evaluation = {
            scores: normalizedScores,
            tutorFirstTurnScore,
            baseScore,
            recognitionScore,
            passesRequired: parsed.validation?.passes_required ?? true,
            passesForbidden: parsed.validation?.passes_forbidden ?? true,
            requiredMissing: parsed.validation?.required_missing || [],
            forbiddenFound: parsed.validation?.forbidden_found || [],
            summary: parsed.summary,
            judgeModel: judgeModelLabel,
            judgeLatencyMs,
          };

          if (restoreTurn0) {
            // --restore-turn0: re-score suggestions[0] and write to tutor_first_turn_score
            evaluationStore.updateResultScores(result.id, evaluation);
          } else if (multiturnOnly) {
            // --multiturn-only: write ONLY tutor_last_turn_score, preserving the original tutor_first_turn_score (Turn 0)
            evaluationStore.updateTutorLastTurnScore(result.id, { tutorLastTurnScore: evaluation.tutorFirstTurnScore });
          } else {
            evaluationStore.updateResultScores(result.id, evaluation);

            // For single-turn results, also populate the tutor_scores/tutor_overall_score/tutor_last_turn_score
            // columns so that downstream queries (TuH fallback, runs display) see consistent data.
            evaluationStore.updateResultTutorScores(result.id, {
              tutorScores: {
                0: { scores: normalizedScores, overallScore: tutorFirstTurnScore, summary: parsed.summary },
              },
              tutorOverallScore: tutorFirstTurnScore,
              tutorFirstTurnScore,
              tutorLastTurnScore: tutorFirstTurnScore,
              tutorDevelopmentScore: 0,
            });
          }

          // Score line
          const dimScores = Object.entries(normalizedScores)
            .map(([k, v]) => `${k}=${v.score}`)
            .join(' ');
          console.log(`${tag} ${scenarioId} / ${profileName} ... ${tutorFirstTurnScore.toFixed(1)}  (${dimScores})`);

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

          return tutorFirstTurnScore;
        }

        // Helper: call CLI judge (claude or gemini) and parse JSON response
        async function callClaudeJudge(prompt) {
          let cliBin, cliJudgeArgs, cliJudgeEnv;
          if (judgeCli === 'gemini') {
            cliBin = 'gemini';
            cliJudgeArgs = ['-s', '-o', 'text'];
            if (effectiveJudgeModel) cliJudgeArgs.push('-m', effectiveJudgeModel);
            cliJudgeEnv = { ...process.env };
          } else if (judgeCli === 'codex') {
            cliBin = 'codex';
            cliJudgeArgs = ['exec', '-'];
            if (effectiveJudgeModel) cliJudgeArgs.push('-m', effectiveJudgeModel);
            cliJudgeEnv = { ...process.env };
          } else {
            cliBin = 'claude';
            cliJudgeArgs = ['-p', '-', '--output-format', 'text'];
            if (effectiveJudgeModel) cliJudgeArgs.push('--model', effectiveJudgeModel);
            cliJudgeEnv = { ...process.env };
            delete cliJudgeEnv.ANTHROPIC_API_KEY;
            delete cliJudgeEnv.CLAUDECODE;
          }

          const stdout = await new Promise((resolve, reject) => {
            const child = spawn(cliBin, cliJudgeArgs, { stdio: ['pipe', 'pipe', 'pipe'], env: cliJudgeEnv });
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
              if (code !== 0) reject(new Error(err || out || `${cliBin} exited with code ${code}`));
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
          return JSON.parse(jsonStr);
        }

        // Helper: evaluate a multi-turn result with per-turn tutor + learner scoring
        async function evaluateMultiTurnResult(result, tag) {
          const startTime = Date.now();
          const scenarioId = result.scenarioId;
          const profileName = result.profileName || `${result.provider}/${result.model}`;
          const judgeModel = judgeModelLabel;

          const scenario = getScenario(scenarioId);
          if (!scenario) {
            console.log(`${tag} ${scenarioId} / ${profileName} ... SKIP (scenario not found)`);
            return null;
          }

          // Load dialogue log
          const dialogueId = result.dialogueId;
          const dialogueLog = evaluationStore.loadDialogueLog(dialogueId);
          if (!dialogueLog) {
            console.log(`${tag} ${scenarioId} / ${profileName} ... SKIP (dialogue log not found)`);
            return null;
          }

          // P0 Provenance: verify dialogue log integrity
          if (result.dialogueContentHash) {
            const logPath = path.join(LOGS_DIR, `${dialogueId}.json`);
            try {
              const logContent = fs.readFileSync(logPath, 'utf8');
              const loadedHash = createHash('sha256').update(logContent).digest('hex');
              if (loadedHash !== result.dialogueContentHash) {
                console.error(
                  `[PROVENANCE] Hash mismatch for ${dialogueId}: expected ${result.dialogueContentHash.slice(0, 12)}..., got ${loadedHash.slice(0, 12)}...`,
                );
              }
            } catch {
              // File loaded via fallback path — skip hash check
            }
          }

          if (!dialogueLog.isMultiTurn) {
            console.log(`${tag} ${scenarioId} / ${profileName} ... SKIP (not multi-turn)`);
            return null;
          }

          const turnResults = dialogueLog.turnResults || [];
          const dialogueTrace = dialogueLog.dialogueTrace || [];
          const totalTurns = turnResults.length;

          if (totalTurns === 0) {
            console.log(`${tag} ${scenarioId} / ${profileName} ... SKIP (no turns)`);
            return null;
          }

          console.log(`${tag} ${scenarioId} / ${profileName} ... per-turn scoring (${totalTurns} turns)`);

          // ── Print transcripts ──
          const transcriptTurns = turnResults.map((t, idx) => ({
            turnIndex: idx,
            turnId: t.turnId,
            suggestion: t.suggestions?.[0],
            learnerAction: t.learnerAction,
            learnerMessage: t.learnerMessage,
          }));
          const learnerCtx = dialogueLog.learnerContext || null;
          const transcriptArtifacts = dialogueLog.transcripts || null;

          const publicTranscript = buildDialoguePublicTranscript(
            transcriptTurns,
            dialogueTrace,
            learnerCtx,
            transcriptArtifacts,
          );
          console.log(`──── Public Transcript (${totalTurns} turns) ────────────────`);
          console.log(publicTranscript);

          if (verbose) {
            const fullTranscript = buildDialogueFullTranscript(
              transcriptTurns,
              dialogueTrace,
              learnerCtx,
              transcriptArtifacts,
            );
            console.log(`──── Full Transcript (with internals) ──────────`);
            console.log(fullTranscript);
          }

          console.log(`─────────────────────────────────────────────────`);

          const scenarioContext = {
            name: scenario.name,
            description: scenario.description,
            expectedBehavior: scenario.expected_behavior,
            learnerContext: scenario.learner_context,
            requiredElements: scenario.required_elements,
            forbiddenElements: scenario.forbidden_elements,
          };

          const dimensionMap = {
            relevance: 'relevance',
            specificity: 'specificity',
            pedagogical_soundness: 'pedagogical',
            pedagogical: 'pedagogical',
            personalization: 'personalization',
            actionability: 'actionability',
            tone: 'tone',
          };

          // ── Prepare learner data for parallel scoring ──
          let learnerTurns = [];
          const reconstructedTurns = [];
          let isMultiAgent = false;
          let personaDescription = '';
          let scenarioNameForLearner = '';
          const learnerTurnTargets = []; // [{lt, targetIdx}]

          if (!tutorOnly) {
            const learnerArch = dialogueLog.learnerArchitecture || 'unified';
            isMultiAgent =
              learnerArch.includes('ego_superego') ||
              learnerArch === 'multi_agent' ||
              learnerArch.includes('psychodynamic');
            personaDescription = dialogueLog.learnerContext || 'No persona description available';
            scenarioNameForLearner = scenario.name || scenarioId;

            // Build reconstructed turns for learner prompt builder
            const trace = dialogueLog.dialogueTrace || [];
            learnerTurns = extractLearnerTurnsFromTrace(trace, isMultiAgent, dialogueLog.conversationHistory);

            // Interleave learner turns with tutor turns
            for (let lt = 0; lt < learnerTurns.length; lt++) {
              reconstructedTurns.push({
                turnNumber: lt + 1,
                phase: 'learner',
                externalMessage: learnerTurns[lt].externalMessage,
                internalDeliberation: learnerTurns[lt].internalDeliberation,
              });

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

            // Pre-compute target indices for learner turn scoring
            for (let lt = 0; lt < learnerTurns.length; lt++) {
              const targetIdx = reconstructedTurns.findIndex(
                (t) => t.phase === 'learner' && t.externalMessage === learnerTurns[lt].externalMessage,
              );
              if (targetIdx !== -1) {
                learnerTurnTargets.push({ lt, targetIdx });
              }
            }
          }

          // ── Prepare dialogue quality prompt params ──
          const dqPromptParams = !tutorOnly
            ? {
                turns: transcriptTurns,
                dialogueTrace,
                scenarioName: scenario.name,
                scenarioDescription: scenario.description,
                topic: scenario.topic || scenario.name,
                turnCount: totalTurns,
                learnerContext: learnerCtx,
                transcriptArtifacts,
              }
            : null;

          // ════════════════════════════════════════════
          // Wave 1: All independent judge calls (concurrent)
          // ════════════════════════════════════════════

          // Per-turn tutor scoring: batch N turns into 1 subprocess when possible
          const tutorPromises = [];

          // Helper: normalize a single turn's parsed scores
          function normalizeTutorTurnResult(turnIndex, parsed, judgeInputHash) {
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

            return {
              turnIndex,
              success: true,
              scores: normalizedScores,
              overallScore,
              baseScore: calculateBaseScore(normalizedScores),
              recognitionScore: calculateRecognitionScore(normalizedScores),
              summary: parsed.summary,
              judgeInputHash,
              judgeTimestamp: new Date().toISOString(),
            };
          }

          if (totalTurns > 1) {
            // Multi-turn: attempt batched prompt (N turns → 1 subprocess)
            tutorPromises.push(
              (async () => {
                try {
                  const batchedPrompt = buildBatchedPerTurnTutorPrompt({
                    turnResults,
                    dialogueTrace,
                    scenario: scenarioContext,
                    learnerContext: learnerCtx,
                  });
                  if (!batchedPrompt) return { batched: true, results: [] };

                  const judgeInputHash = createHash('sha256').update(batchedPrompt).digest('hex');
                  if (verbose) console.log(`${tag}   tutor-batch (${totalTurns} turns) ... calling claude`);
                  const parsed = await callClaudeJudge(batchedPrompt);

                  if (!Array.isArray(parsed.turns)) {
                    throw new Error('Batched response missing "turns" array');
                  }

                  const results = parsed.turns.map((turnData) => {
                    return normalizeTutorTurnResult(turnData.turn_index, turnData, judgeInputHash);
                  });

                  return { batched: true, success: true, results };
                } catch (err) {
                  const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
                  console.log(`${tag}   tutor-batch ... FAIL (falling back to per-turn): ${msg}`);
                  if (verbose) console.error(err);
                  return { batched: true, success: false };
                }
              })(),
            );
          } else {
            // Single-turn: use individual prompt (no batching benefit)
            tutorPromises.push(
              (async () => {
                const turnIndex = 0;
                const turnTag = `${tag}   tutor-turn-${turnIndex}`;
                try {
                  const prompt = buildPerTurnTutorEvaluationPrompt({
                    turnResults,
                    dialogueTrace,
                    targetTurnIndex: turnIndex,
                    scenario: scenarioContext,
                    learnerContext: learnerCtx,
                  });

                  if (!prompt) {
                    if (verbose) console.log(`${turnTag} ... SKIP (no suggestion)`);
                    return { turnIndex, skipped: true };
                  }

                  const judgeInputHash = createHash('sha256').update(prompt).digest('hex');
                  if (verbose) console.log(`${turnTag} ... calling claude`);
                  const parsed = await callClaudeJudge(prompt);
                  return normalizeTutorTurnResult(turnIndex, parsed, judgeInputHash);
                } catch (err) {
                  const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
                  console.log(`${turnTag} ... FAIL: ${msg}`);
                  if (verbose) console.error(err);
                  return { turnIndex, success: false };
                }
              })(),
            );
          }

          // Per-turn learner scoring: batch M turns into 1 subprocess when possible
          const learnerPromises = [];

          // Helper: normalize a single learner turn result
          function normalizeLearnerTurnResult(lt, parsed, judgeInputHash) {
            const turnOverall = calculateLearnerOverallScore(parsed.scores || {}, isMultiAgent);
            return {
              lt,
              success: true,
              turnIndex: lt + 1,
              scores: parsed.scores,
              overallScore: turnOverall,
              summary: parsed.summary,
              judgeInputHash,
              judgeTimestamp: new Date().toISOString(),
            };
          }

          if (learnerTurnTargets.length > 1) {
            // Multi-turn: attempt batched prompt (M turns → 1 subprocess)
            learnerPromises.push(
              (async () => {
                try {
                  const batchedPrompt = buildBatchedLearnerPrompt({
                    turns: reconstructedTurns,
                    learnerTurnTargets,
                    personaId: profileName,
                    personaDescription,
                    learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
                    scenarioName: scenarioNameForLearner,
                    topic: scenarioId,
                  });
                  if (!batchedPrompt) return { batched: true, results: [] };

                  const judgeInputHash = createHash('sha256').update(batchedPrompt).digest('hex');
                  if (verbose)
                    console.log(`${tag}   learner-batch (${learnerTurnTargets.length} turns) ... calling claude`);
                  const parsed = await callClaudeJudge(batchedPrompt);

                  if (!Array.isArray(parsed.turns)) {
                    throw new Error('Batched response missing "turns" array');
                  }

                  const results = parsed.turns.map((turnData, i) => {
                    const lt = turnData.learner_turn_index ?? i;
                    return normalizeLearnerTurnResult(lt, turnData, judgeInputHash);
                  });

                  return { batched: true, success: true, results };
                } catch (err) {
                  const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
                  console.log(`${tag}   learner-batch ... FAIL (falling back to per-turn): ${msg}`);
                  if (verbose) console.error(err);
                  return { batched: true, success: false };
                }
              })(),
            );
          } else {
            // Single learner turn or no turns: use individual prompt
            for (const { lt, targetIdx } of learnerTurnTargets) {
              learnerPromises.push(
                (async () => {
                  const turnTag = `${tag}   learner-turn-${lt}`;
                  try {
                    const prompt = buildLearnerEvaluationPrompt({
                      turns: reconstructedTurns,
                      targetTurnIndex: targetIdx,
                      personaId: profileName,
                      personaDescription,
                      learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
                      scenarioName: scenarioNameForLearner,
                      topic: scenarioId,
                    });

                    const judgeInputHash = createHash('sha256').update(prompt).digest('hex');
                    if (verbose) console.log(`${turnTag} ... calling claude`);
                    const parsed = await callClaudeJudge(prompt);
                    return normalizeLearnerTurnResult(lt, parsed, judgeInputHash);
                  } catch (err) {
                    const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
                    console.log(`${turnTag} ... FAIL: ${msg}`);
                    if (verbose) console.error(err);
                    return { lt, success: false };
                  }
                })(),
              );
            }
          }

          // Dialogue quality promises (DgP + DgI)
          const dgpPromise = dqPromptParams
            ? (async () => {
                try {
                  const publicPrompt = buildDialogueQualityPrompt({ ...dqPromptParams, transcriptMode: 'public' });
                  const judgeInputHash = createHash('sha256').update(publicPrompt).digest('hex');
                  const publicParsed = await callClaudeJudge(publicPrompt);
                  const publicScores = {};
                  for (const [key, value] of Object.entries(publicParsed.scores || {})) {
                    if (typeof value === 'object' && value !== null) {
                      publicScores[key] = { score: value.score, reasoning: value.reasoning };
                    } else if (typeof value === 'number') {
                      publicScores[key] = { score: value, reasoning: null };
                    }
                  }
                  const score =
                    Object.keys(publicScores).length > 0
                      ? calculateDialogueQualityScore(publicScores)
                      : publicParsed.overall_score;
                  return {
                    success: true,
                    score,
                    summary: publicParsed.summary,
                    judgeInputHash,
                    judgeTimestamp: new Date().toISOString(),
                  };
                } catch (err) {
                  const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
                  console.log(`${tag}   dialogue-quality(public) ... FAIL: ${msg}`);
                  if (verbose) console.error(err);
                  return { success: false };
                }
              })()
            : Promise.resolve(null);

          const dgiPromise = dqPromptParams
            ? (async () => {
                try {
                  const fullPrompt = buildDialogueQualityPrompt({ ...dqPromptParams, transcriptMode: 'full' });
                  const judgeInputHash = createHash('sha256').update(fullPrompt).digest('hex');
                  const fullParsed = await callClaudeJudge(fullPrompt);
                  const fullScores = {};
                  for (const [key, value] of Object.entries(fullParsed.scores || {})) {
                    if (typeof value === 'object' && value !== null) {
                      fullScores[key] = { score: value.score, reasoning: value.reasoning };
                    } else if (typeof value === 'number') {
                      fullScores[key] = { score: value, reasoning: null };
                    }
                  }
                  const score =
                    Object.keys(fullScores).length > 0
                      ? calculateDialogueQualityScore(fullScores)
                      : fullParsed.overall_score;
                  return {
                    success: true,
                    score,
                    summary: fullParsed.summary,
                    judgeInputHash,
                    judgeTimestamp: new Date().toISOString(),
                  };
                } catch (err) {
                  const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
                  console.log(`${tag}   dialogue-quality(full) ... FAIL: ${msg}`);
                  if (verbose) console.error(err);
                  return { success: false };
                }
              })()
            : Promise.resolve(null);

          // Deliberation quality promises (tutor + learner, multi-agent only)
          const hasTutorDelib = !skipDeliberation && !tutorOnly && hasTutorSuperego(dialogueTrace);
          const hasLearnerDelib = !skipDeliberation && !tutorOnly && isMultiAgent;
          const deliberationPromptParams = {
            turns: transcriptTurns,
            dialogueTrace,
            scenarioName: scenario.name || scenarioId,
            scenarioDescription: scenario.description,
            learnerContext: learnerCtx,
          };

          const tutorDelibPromise = hasTutorDelib
            ? (async () => {
                const delibTag = `${tag}   tutor-deliberation`;
                try {
                  const prompt = buildTutorDeliberationPrompt(deliberationPromptParams);
                  const judgeInputHash = createHash('sha256').update(prompt).digest('hex');
                  if (verbose) console.log(`${delibTag} ... calling claude`);
                  const parsed = await callClaudeJudge(prompt);
                  const scores = parsed.scores || {};
                  const score =
                    Object.keys(scores).length > 0 ? calculateDeliberationScore(scores) : parsed.overall_score;
                  return {
                    success: true,
                    scores,
                    score,
                    summary: parsed.summary,
                    judgeInputHash,
                    judgeTimestamp: new Date().toISOString(),
                  };
                } catch (err) {
                  const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
                  console.log(`${delibTag} ... FAIL: ${msg}`);
                  if (verbose) console.error(err);
                  return { success: false };
                }
              })()
            : Promise.resolve(null);

          const learnerDelibPromise = hasLearnerDelib
            ? (async () => {
                const delibTag = `${tag}   learner-deliberation`;
                try {
                  const prompt = buildLearnerDeliberationPrompt(deliberationPromptParams);
                  const judgeInputHash = createHash('sha256').update(prompt).digest('hex');
                  if (verbose) console.log(`${delibTag} ... calling claude`);
                  const parsed = await callClaudeJudge(prompt);
                  const scores = parsed.scores || {};
                  const score =
                    Object.keys(scores).length > 0 ? calculateDeliberationScore(scores) : parsed.overall_score;
                  return {
                    success: true,
                    scores,
                    score,
                    summary: parsed.summary,
                    judgeInputHash,
                    judgeTimestamp: new Date().toISOString(),
                  };
                } catch (err) {
                  const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
                  console.log(`${delibTag} ... FAIL: ${msg}`);
                  if (verbose) console.error(err);
                  return { success: false };
                }
              })()
            : Promise.resolve(null);

          // Holistic promises (no dependency on per-turn scores — use totalTurns gate)
          const tutorHolisticPromise =
            totalTurns > 1 && !tutorOnly
              ? (async () => {
                  const holisticTutorTag = `${tag}   tutor-holistic`;
                  const hasRecognition = result.factors?.recognition || profileName.includes('recog');
                  try {
                    const holisticPrompt = buildTutorHolisticEvaluationPrompt({
                      turns: transcriptTurns,
                      dialogueTrace,
                      scenarioName: scenario.name || scenarioId,
                      scenarioDescription: scenario.description,
                      learnerContext: learnerCtx,
                      hasRecognition,
                      transcriptArtifacts,
                    });

                    const judgeInputHash = createHash('sha256').update(holisticPrompt).digest('hex');
                    if (verbose) console.log(`${holisticTutorTag} ... calling claude`);
                    const parsedHolistic = await callClaudeJudge(holisticPrompt);
                    const holisticScores = parsedHolistic.scores || {};
                    const score = calculateTutorHolisticScore(holisticScores, hasRecognition);

                    return {
                      success: true,
                      score,
                      holisticScores,
                      summary: parsedHolistic.summary,
                      judgeInputHash,
                      judgeTimestamp: new Date().toISOString(),
                    };
                  } catch (err) {
                    const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
                    console.log(`${holisticTutorTag} ... FAIL: ${msg}`);
                    if (verbose) console.error(err);
                    return { success: false };
                  }
                })()
              : Promise.resolve(null);

          const learnerHolisticPromise =
            !tutorOnly && learnerTurns.length > 0
              ? (async () => {
                  const holisticTag = `${tag}   learner-holistic`;
                  try {
                    const holisticPrompt = buildLearnerHolisticEvaluationPrompt({
                      turns: reconstructedTurns,
                      personaId: profileName,
                      personaDescription,
                      learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
                      scenarioName: scenarioNameForLearner,
                      topic: scenarioId,
                    });

                    const judgeInputHash = createHash('sha256').update(holisticPrompt).digest('hex');
                    if (verbose) console.log(`${holisticTag} ... calling claude`);
                    const parsedHolistic = await callClaudeJudge(holisticPrompt);
                    const holisticScores = parsedHolistic.scores || {};
                    const holisticOverallScore = calculateLearnerOverallScore(holisticScores, isMultiAgent);

                    return {
                      success: true,
                      score: holisticOverallScore,
                      holisticScores,
                      summary: parsedHolistic.summary,
                      judgeInputHash,
                      judgeTimestamp: new Date().toISOString(),
                    };
                  } catch (err) {
                    const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
                    console.log(`${holisticTag} ... FAIL: ${msg}`);
                    if (verbose) console.error(err);
                    return { success: false };
                  }
                })()
              : Promise.resolve(null);

          // Fire all independent judge calls concurrently (single wave)
          const [
            tutorSettled,
            learnerSettled,
            dgpResult,
            dgiResult,
            tutorDelibResult,
            learnerDelibResult,
            tutorHolisticResult,
            learnerHolisticResult,
          ] = await Promise.all([
            Promise.allSettled(tutorPromises),
            Promise.allSettled(learnerPromises),
            dgpPromise,
            dgiPromise,
            tutorDelibPromise,
            learnerDelibPromise,
            tutorHolisticPromise,
            learnerHolisticPromise,
          ]);

          // ── P0 Provenance: build contentTurnId map from dialogue log ──
          const turnContentIds = {};
          for (const tr of turnResults) {
            if (tr.contentTurnId) {
              turnContentIds[tr.turnIndex ?? turnResults.indexOf(tr)] = tr.contentTurnId;
            }
          }

          // ── Process tutor per-turn results ──
          const tutorTurnScores = {};
          let needsTutorFallback = false;

          // Helper: store a single tutor turn result
          function storeTutorTurnResult(r) {
            if (!r || r.skipped || !r.success) return;
            tutorTurnScores[r.turnIndex] = {
              scores: r.scores,
              overallScore: r.overallScore,
              baseScore: r.baseScore,
              recognitionScore: r.recognitionScore,
              summary: r.summary,
              judgeInputHash: r.judgeInputHash,
              judgeTimestamp: r.judgeTimestamp,
              judgeModel,
              contentTurnId: turnContentIds[r.turnIndex] || null,
            };
            const dimScores = Object.entries(r.scores)
              .map(([k, v]) => `${k}=${v.score}`)
              .join(' ');
            console.log(`${tag}   tutor-turn-${r.turnIndex} ... ${r.overallScore.toFixed(1)}  (${dimScores})`);
          }

          for (const settled of tutorSettled) {
            const r = settled.status === 'fulfilled' ? settled.value : null;
            if (!r) continue;
            if (r.batched) {
              // Batched result: contains array of individual turn results
              if (r.success && r.results) {
                for (const turnResult of r.results) {
                  storeTutorTurnResult(turnResult);
                }
              } else {
                // Batch failed — need fallback to individual per-turn calls
                needsTutorFallback = true;
              }
            } else {
              // Individual turn result (single-turn case)
              storeTutorTurnResult(r);
            }
          }

          // Fallback: if batched call failed or returned partial results, fill gaps individually
          const missingTutorTurns = [];
          for (let i = 0; i < totalTurns; i++) {
            if (!tutorTurnScores[i]) missingTutorTurns.push(i);
          }
          if (needsTutorFallback || missingTutorTurns.length > 0) {
            if (!needsTutorFallback && missingTutorTurns.length > 0) {
              console.log(
                `${tag}   tutor-batch partial: got ${Object.keys(tutorTurnScores).length}/${totalTurns} turns, filling gaps [${missingTutorTurns.join(',')}]`,
              );
            } else {
              console.log(`${tag}   tutor-batch fallback: retrying ${totalTurns} turns individually`);
            }
            const fallbackPromises = [];
            for (const turnIndex of needsTutorFallback
              ? Array.from({ length: totalTurns }, (_, i) => i)
              : missingTutorTurns) {
              fallbackPromises.push(
                (async () => {
                  const turnTag = `${tag}   tutor-turn-${turnIndex}`;
                  try {
                    const prompt = buildPerTurnTutorEvaluationPrompt({
                      turnResults,
                      dialogueTrace,
                      targetTurnIndex: turnIndex,
                      scenario: scenarioContext,
                      learnerContext: learnerCtx,
                    });
                    if (!prompt) return { turnIndex, skipped: true };

                    const judgeInputHash = createHash('sha256').update(prompt).digest('hex');
                    if (verbose) console.log(`${turnTag} ... calling claude (fallback)`);
                    const parsed = await callClaudeJudge(prompt);
                    return normalizeTutorTurnResult(turnIndex, parsed, judgeInputHash);
                  } catch (err) {
                    const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
                    console.log(`${turnTag} ... FAIL: ${msg}`);
                    return { turnIndex, success: false };
                  }
                })(),
              );
            }
            const fallbackSettled = await Promise.allSettled(fallbackPromises);
            for (const settled of fallbackSettled) {
              const r = settled.status === 'fulfilled' ? settled.value : null;
              storeTutorTurnResult(r);
            }
          }

          // ── Process learner per-turn results ──
          const learnerTurnScores = {};
          let needsLearnerFallback = false;

          function storeLearnerTurnResult(r) {
            if (!r || !r.success) return;
            if (r.overallScore == null) {
              const dimScores = Object.entries(r.scores || {})
                .map(([k, v]) => `${k}=${typeof v === 'object' ? v.score : v}`)
                .join(' ');
              console.log(`${tag}   learner-turn-${r.lt} ... FAIL: scores out of range (${dimScores})`);
              return;
            }
            learnerTurnScores[r.lt] = {
              turnIndex: r.turnIndex,
              scores: r.scores,
              overallScore: r.overallScore,
              summary: r.summary,
              judgeInputHash: r.judgeInputHash,
              judgeTimestamp: r.judgeTimestamp,
              judgeModel,
            };
            const dimScores = Object.entries(r.scores || {})
              .map(([k, v]) => `${k}=${typeof v === 'object' ? v.score : v}`)
              .join(' ');
            console.log(`${tag}   learner-turn-${r.lt} ... ${r.overallScore.toFixed(1)}  (${dimScores})`);
          }

          for (const settled of learnerSettled) {
            const r = settled.status === 'fulfilled' ? settled.value : null;
            if (!r) continue;
            if (r.batched) {
              if (r.success && r.results) {
                for (const turnResult of r.results) {
                  storeLearnerTurnResult(turnResult);
                }
              } else {
                needsLearnerFallback = true;
              }
            } else {
              storeLearnerTurnResult(r);
            }
          }

          // Fallback: if batched learner call failed or returned partial results, fill gaps
          const missingLearnerTurns = learnerTurnTargets.filter(({ lt }) => !learnerTurnScores[lt]);
          if (needsLearnerFallback || missingLearnerTurns.length > 0) {
            const targetsToRetry = needsLearnerFallback ? learnerTurnTargets : missingLearnerTurns;
            if (!needsLearnerFallback && missingLearnerTurns.length > 0) {
              console.log(
                `${tag}   learner-batch partial: got ${Object.keys(learnerTurnScores).length}/${learnerTurnTargets.length} turns, filling gaps [${missingLearnerTurns.map((t) => t.lt).join(',')}]`,
              );
            } else {
              console.log(`${tag}   learner-batch fallback: retrying ${learnerTurnTargets.length} turns individually`);
            }
            const fallbackPromises = targetsToRetry.map(({ lt, targetIdx }) => {
              return (async () => {
                const turnTag = `${tag}   learner-turn-${lt}`;
                try {
                  const prompt = buildLearnerEvaluationPrompt({
                    turns: reconstructedTurns,
                    targetTurnIndex: targetIdx,
                    personaId: profileName,
                    personaDescription,
                    learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
                    scenarioName: scenarioNameForLearner,
                    topic: scenarioId,
                  });
                  const judgeInputHash = createHash('sha256').update(prompt).digest('hex');
                  if (verbose) console.log(`${turnTag} ... calling claude (fallback)`);
                  const parsed = await callClaudeJudge(prompt);
                  return normalizeLearnerTurnResult(lt, parsed, judgeInputHash);
                } catch (err) {
                  const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
                  console.log(`${turnTag} ... FAIL: ${msg}`);
                  return { lt, success: false };
                }
              })();
            });
            const fallbackSettled = await Promise.allSettled(fallbackPromises);
            for (const settled of fallbackSettled) {
              const r = settled.status === 'fulfilled' ? settled.value : null;
              storeLearnerTurnResult(r);
            }
          }

          // ── Process Wave 1: dialogue quality ──
          let dgpScore = null;
          let dgiScore = null;
          if (dgpResult?.success) {
            dgpScore = dgpResult.score;
            evaluationStore.updateDialogueQualityScore(result.id, {
              dialogueQualityScore: dgpScore,
              dialogueQualitySummary: dgpResult.summary || null,
              dialogueQualityJudgeModel: judgeModel,
            });
            console.log(`${tag}   dialogue-quality(public)=${dgpScore.toFixed(1)}`);
          }
          if (dgiResult?.success) {
            dgiScore = dgiResult.score;
            evaluationStore.updateDialogueQualityInternalScore(result.id, {
              dialogueQualityInternalScore: dgiScore,
              dialogueQualityInternalSummary: dgiResult.summary || null,
            });
            console.log(`${tag}   dialogue-quality(full)=${dgiScore.toFixed(1)}`);
          }

          // ── Process Wave 1: deliberation quality ──
          let tutorDelibScore = null;
          let learnerDelibScore = null;
          if (tutorDelibResult?.success) {
            tutorDelibScore = tutorDelibResult.score;
            evaluationStore.updateTutorDeliberationScores(result.id, {
              deliberationScores: tutorDelibResult.scores,
              deliberationScore: tutorDelibScore,
              deliberationSummary: tutorDelibResult.summary || null,
              deliberationJudgeModel: judgeModel,
            });
            console.log(`${tag}   tutor-deliberation=${tutorDelibScore.toFixed(1)}`);
          }
          if (learnerDelibResult?.success) {
            learnerDelibScore = learnerDelibResult.score;
            evaluationStore.updateLearnerDeliberationScores(result.id, {
              deliberationScores: learnerDelibResult.scores,
              deliberationScore: learnerDelibScore,
              deliberationSummary: learnerDelibResult.summary || null,
              deliberationJudgeModel: judgeModel,
            });
            console.log(`${tag}   learner-deliberation=${learnerDelibScore.toFixed(1)}`);
          }

          // ── Aggregate tutor scores ──
          const tutorTurnOveralls = Object.values(tutorTurnScores).map((s) => s.overallScore);
          if (tutorTurnOveralls.length === 0) {
            console.log(`${tag} ${scenarioId} / ${profileName} ... NO tutor turns scored`);
            return null;
          }

          const tutorOverall = tutorTurnOveralls.reduce((a, b) => a + b, 0) / tutorTurnOveralls.length;
          const tutorFirst = tutorTurnScores[0]?.overallScore ?? null;
          const lastTurnIdx = Math.max(...Object.keys(tutorTurnScores).map(Number));
          const tutorLast = tutorTurnScores[lastTurnIdx]?.overallScore ?? null;
          const tutorDevelopment = tutorFirst != null && tutorLast != null ? tutorLast - tutorFirst : null;

          // Also write the first turn's per-dimension scores to the legacy dimension columns
          const firstTurnScores = tutorTurnScores[0]?.scores || {};
          evaluationStore.updateResultTutorScores(result.id, {
            tutorScores: tutorTurnScores,
            tutorOverallScore: tutorOverall,
            tutorFirstTurnScore: tutorFirst,
            tutorLastTurnScore: tutorLast,
            tutorDevelopmentScore: tutorDevelopment,
            judgeModel: judgeModel,
            judgeLatencyMs: Date.now() - startTime,
          });

          // Also update the per-dimension columns from the first turn for backward compat
          if (Object.keys(firstTurnScores).length > 0) {
            const firstTurnEval = {
              scores: firstTurnScores,
              tutorFirstTurnScore: tutorFirst,
              baseScore: tutorTurnScores[0]?.baseScore ?? null,
              recognitionScore: tutorTurnScores[0]?.recognitionScore ?? null,
              passesRequired: true,
              passesForbidden: true,
              requiredMissing: [],
              forbiddenFound: [],
              summary: tutorTurnScores[0]?.summary || null,
              judgeModel: judgeModel,
              judgeLatencyMs: Date.now() - startTime,
            };
            evaluationStore.updateResultScores(result.id, firstTurnEval);
            // Re-apply the per-turn tutor scores (updateResultScores may have overwritten some fields)
            evaluationStore.updateResultTutorScores(result.id, {
              tutorScores: tutorTurnScores,
              tutorOverallScore: tutorOverall,
              tutorFirstTurnScore: tutorFirst,
              tutorLastTurnScore: tutorLast,
              tutorDevelopmentScore: tutorDevelopment,
            });
          }

          let tutorHolistic = null;
          let learnerAvg = null;
          let learnerHolistic = null;

          // ── Process holistic results ──
          if (tutorHolisticResult?.success) {
            tutorHolistic = tutorHolisticResult.score;
            evaluationStore.updateResultTutorHolisticScores(result.id, {
              holisticScores: tutorHolisticResult.holisticScores,
              holisticOverallScore: tutorHolistic,
              holisticSummary: tutorHolisticResult.summary || null,
              holisticJudgeModel: judgeModel,
            });
            console.log(`${tag}   tutor-holistic ... ${tutorHolistic.toFixed(1)}`);
          }

          // ── Process learner holistic + per-turn DB write ──
          if (!tutorOnly) {
            // Echo detection: reject identical score vectors across turns
            const learnerEntries = Object.values(learnerTurnScores);
            if (learnerEntries.length >= 2) {
              const sigs = learnerEntries.map((ts) =>
                Object.keys(ts.scores || {})
                  .sort()
                  .map((k) => `${k}=${typeof ts.scores[k] === 'object' ? ts.scores[k].score : ts.scores[k]}`)
                  .join(','),
              );
              if (sigs.every((s) => s === sigs[0])) {
                console.log(
                  `${tag}   WARN: all ${learnerEntries.length} learner turns have identical scores — likely echoed example pattern; skipping learner storage`,
                );
                // Clear turn scores so they don't get stored
                for (const k of Object.keys(learnerTurnScores)) delete learnerTurnScores[k];
              }
            }

            learnerAvg =
              Object.keys(learnerTurnScores).length > 0
                ? Object.values(learnerTurnScores).reduce((a, b) => a + b.overallScore, 0) /
                  Object.values(learnerTurnScores).length
                : null;

            if (learnerHolisticResult?.success) {
              learnerHolistic = learnerHolisticResult.score;
              evaluationStore.updateResultLearnerScores(result.id, {
                scores: learnerTurnScores,
                overallScore: learnerAvg,
                judgeModel: judgeModel,
                holisticScores: learnerHolisticResult.holisticScores,
                holisticOverallScore: learnerHolistic,
                holisticSummary: learnerHolisticResult.summary || null,
                holisticJudgeModel: judgeModel,
              });
              console.log(`${tag}   learner-holistic ... ${learnerHolistic.toFixed(1)}`);
            } else if (Object.keys(learnerTurnScores).length > 0) {
              // Fallback: write per-turn learner scores even if holistic failed
              evaluationStore.updateResultLearnerScores(result.id, {
                scores: learnerTurnScores,
                overallScore: learnerAvg,
                judgeModel: judgeModel,
              });
            }
          }

          // ── Process Measures (extract from dialogue log, store in DB) ──
          const tm = dialogueLog.transformationMetrics;
          if (tm) {
            evaluationStore.updateProcessMeasures(result.id, {
              adaptationIndex: tm.tutorAdaptationIndex ?? null,
              learnerGrowthIndex: tm.learnerGrowthIndex ?? null,
              bilateralTransformationIndex: tm.bilateralTransformationIndex ?? null,
              incorporationRate: tm.superegoMetrics?.incorporationRate ?? null,
              dimensionConvergence: tm.dimensionConvergence ?? null,
              transformationQuality: tm.transformationQuality ?? null,
            });
          }

          // ── Summary ──
          const tutorHolisticPart = tutorHolistic != null ? ` holistic=${tutorHolistic.toFixed(1)}` : '';
          const learnerPart =
            learnerAvg != null
              ? `  learner: avg=${learnerAvg.toFixed(1)}${learnerHolistic != null ? ` holistic=${learnerHolistic.toFixed(1)}` : ''}`
              : '';
          const dgPart = dgpScore != null ? `  DgP=${dgpScore.toFixed(1)}` : '';
          const dgiPart = dgiScore != null ? ` DgI=${dgiScore.toFixed(1)}` : '';
          const delibPart =
            tutorDelibScore != null || learnerDelibScore != null
              ? `  delib: ${tutorDelibScore != null ? `T=${tutorDelibScore.toFixed(1)}` : ''}${learnerDelibScore != null ? ` L=${learnerDelibScore.toFixed(1)}` : ''}`
              : '';
          const overallPart = learnerAvg != null ? `  overall=${((tutorOverall + learnerAvg) / 2).toFixed(1)}` : '';

          console.log(
            `${tag} ${scenarioId} / ${profileName} ... tutor: avg=${tutorOverall.toFixed(1)}${tutorHolisticPart} first=${tutorFirst?.toFixed(1)} last=${tutorLast?.toFixed(1)} Δ=${tutorDevelopment != null ? (tutorDevelopment >= 0 ? '+' : '') + tutorDevelopment.toFixed(1) : '?'}${learnerPart}${dgPart}${dgiPart}${delibPart}${overallPart}`,
          );

          return tutorOverall;
        }

        // Helper: run dialogue quality scoring for a multi-turn result
        async function _scoreDialogueQuality(result, tag) {
          const scenarioId = result.scenarioId;
          const _profileName = result.profileName || `${result.provider}/${result.model}`;
          const judgeModel = judgeModelLabel;

          const scenario = getScenario(scenarioId);
          if (!scenario) return;

          const dialogueId = result.dialogueId;
          if (!dialogueId) return;

          const logPath = path.join(LOGS_DIR, `${dialogueId}.json`);
          let dialogueLog;
          try {
            if (!fs.existsSync(logPath)) return;
            dialogueLog = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
          } catch (e) {
            return;
          }

          const dialogueTrace = dialogueLog?.dialogueTrace || [];
          const conversationHistory = (dialogueLog?.turnResults || []).map((t, idx) => ({
            turnIndex: idx,
            turnId: t.turnId,
            suggestion: t.suggestions?.[0],
            learnerAction: t.learnerAction,
            learnerMessage: t.learnerMessage,
          }));

          const promptParams = {
            turns: conversationHistory,
            dialogueTrace,
            scenarioName: scenario.name,
            scenarioDescription: scenario.description,
            topic: scenario.topic || scenario.name,
            turnCount: result.suggestions?.length || conversationHistory.length,
            learnerContext: dialogueLog?.learnerContext || null,
            transcriptArtifacts: dialogueLog?.transcripts || null,
          };

          // DgP and DgI use independent try/catch so a transient failure
          // in one judge call doesn't silently skip the other.
          try {
            const publicPrompt = buildDialogueQualityPrompt({ ...promptParams, transcriptMode: 'public' });
            const publicParsed = await callClaudeJudge(publicPrompt);
            const publicScores = {};
            for (const [key, value] of Object.entries(publicParsed.scores || {})) {
              if (typeof value === 'object' && value !== null) {
                publicScores[key] = { score: value.score, reasoning: value.reasoning };
              } else if (typeof value === 'number') {
                publicScores[key] = { score: value, reasoning: null };
              }
            }
            const publicOverall =
              Object.keys(publicScores).length > 0
                ? calculateDialogueQualityScore(publicScores)
                : publicParsed.overall_score;

            evaluationStore.updateDialogueQualityScore(result.id, {
              dialogueQualityScore: publicOverall,
              dialogueQualitySummary: publicParsed.summary || null,
              dialogueQualityJudgeModel: judgeModel,
            });

            console.log(`${tag}   dialogue-quality(public)=${publicOverall.toFixed(1)}`);
          } catch (err) {
            const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
            console.log(`${tag}   dialogue-quality(public) ... FAIL: ${msg}`);
            if (verbose) console.error(err);
          }

          try {
            const fullPrompt = buildDialogueQualityPrompt({ ...promptParams, transcriptMode: 'full' });
            const fullParsed = await callClaudeJudge(fullPrompt);
            const fullScores = {};
            for (const [key, value] of Object.entries(fullParsed.scores || {})) {
              if (typeof value === 'object' && value !== null) {
                fullScores[key] = { score: value.score, reasoning: value.reasoning };
              } else if (typeof value === 'number') {
                fullScores[key] = { score: value, reasoning: null };
              }
            }
            const fullOverall =
              Object.keys(fullScores).length > 0 ? calculateDialogueQualityScore(fullScores) : fullParsed.overall_score;

            evaluationStore.updateDialogueQualityInternalScore(result.id, {
              dialogueQualityInternalScore: fullOverall,
              dialogueQualityInternalSummary: fullParsed.summary || null,
            });

            console.log(`${tag}   dialogue-quality(full)=${fullOverall.toFixed(1)}`);
          } catch (err) {
            const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
            console.log(`${tag}   dialogue-quality(full) ... FAIL: ${msg}`);
            if (verbose) console.error(err);
          }
        }

        // Helper: determine if a result is multi-turn
        function isMultiTurnResult(result) {
          if (!result.dialogueId) return false;
          // Messages-mode stores only Turn 0 in suggestions; check dialogueRounds or conversationMode
          if (result.conversationMode === 'messages' && result.dialogueRounds > 1) return true;
          return Array.isArray(result.suggestions) && result.suggestions.length > 1;
        }

        // Helper: print summary
        function printEvaluateSummary(succeeded, failed, totalAttempted, scores, evalStartTime) {
          const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
          const evalEndTime = new Date();

          console.log('\n' + '='.repeat(50));
          console.log('  EVALUATE SUMMARY');
          console.log('='.repeat(50));
          console.log(
            `  Finished:  ${evalEndTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
          );
          if (evalStartTime) {
            console.log(`  Duration:  ${((evalEndTime - evalStartTime) / 1000 / 60).toFixed(1)} min`);
          }
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
              const parsed = await callClaudeJudge(prompt);

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
                judgeModel: judgeModelLabel,
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
              `[${i + 1}/${evaluated.length}] ${r.scenarioId} / ${profileName} ... ${r.tutorFirstTurnScore?.toFixed(1) ?? '--'}  (${dimScores})`,
            );

            // Suggestion excerpt
            const suggestion =
              r.dialogueId && r.suggestions?.length > 1 ? r.suggestions[r.suggestions.length - 1] : r.suggestions?.[0];
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
          const reviewScores = evaluated.map((r) => r.tutorFirstTurnScore).filter((s) => s != null);
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

            // Process each new unevaluated result (work-stealing queue)
            const batchSize = unevaluated.length;
            // Mark all as processed upfront to avoid re-fetching in next poll
            for (const result of unevaluated) processedIds.add(result.id);
            let batchNext = 0;
            const batchWorkerCount = Math.min(parallelism, batchSize);
            const batchWorkers = Array.from({ length: batchWorkerCount }, async () => {
              while (batchNext < batchSize && !interrupted) {
                const bi = batchNext++;
                const result = unevaluated[bi];
                _evalCounter++;
                const tag = `[${bi + 1}/${batchSize}] (${alreadyEvaluated + bi + 1}/${totalResults} scored)`;

                try {
                  const score = isMultiTurnResult(result)
                    ? await evaluateMultiTurnResult(result, tag)
                    : await evaluateOneResult(result, tag);
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
            });
            await Promise.all(batchWorkers);

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

          // Legacy holistic dialogue evaluation (only for --multiturn-only / --restore-turn0 paths)
          if (multiturnOnly || restoreTurn0) {
            const allResults = evaluationStore
              .getResults(runId, {
                scenarioId: scenarioFilter,
                profileName: profileFilter,
              })
              .filter((r) => r.success && r.baseScore != null);
            await evaluateHolisticDialogues(allResults);
          }
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
          // Use baseScore == null to detect skip-rubric results (tutorFirstTurnScore=100 but no rubric dims)
          let toEvaluate = force ? results : results.filter((r) => r.baseScore == null && r.success);

          // --judge: only process rows from a specific judge model
          if (judgeFilter) {
            const before = toEvaluate.length;
            toEvaluate = toEvaluate.filter((r) => r.judgeModel === judgeFilter);
            if (before !== toEvaluate.length) {
              console.log(`  --judge ${judgeFilter}: filtered ${before} → ${toEvaluate.length} rows`);
            }
          }

          // --restore-turn0: only target damaged rows (multi-turn with holistic already set = overwritten by previous --force)
          if (restoreTurn0) {
            const before = toEvaluate.length;
            toEvaluate = toEvaluate.filter(
              (r) => Array.isArray(r.suggestions) && r.suggestions.length > 1 && r.tutorLastTurnScore != null,
            );
            console.log(
              `  --restore-turn0: filtered ${before} → ${toEvaluate.length} damaged rows (multi-turn with holistic already set)`,
            );
          }

          // --multiturn-only: only re-score rows with multiple suggestions (actual multi-turn)
          if (multiturnOnly) {
            const before = toEvaluate.length;
            toEvaluate = toEvaluate.filter((r) => Array.isArray(r.suggestions) && r.suggestions.length > 1);
            if (before !== toEvaluate.length) {
              console.log(`  --multiturn-only: filtered ${before} → ${toEvaluate.length} rows with >1 turn`);
            }
          }

          // Safeguard: warn if --force would overwrite rows from multiple judges without --judge
          if (force && !judgeFilter) {
            const judges = [...new Set(toEvaluate.map((r) => r.judgeModel).filter(Boolean))];
            if (judges.length > 1) {
              console.error(
                `\n⚠  SAFETY: --force targets rows from ${judges.length} different judges: ${judges.join(', ')}`,
              );
              console.error('  This will overwrite ALL of them with the current judge (Opus).');
              console.error('  Use --judge <model> to scope to a single judge. Aborting.\n');
              process.exit(1);
            }
          }

          // ── Rubric version override: clone rows into derived run ──
          let effectiveRunId = runId;
          if (rubricVersionOpt) {
            const _rubricPaths = resolveRubricPaths(rubricVersionOpt);
            console.log(
              `\n  --rubric-version ${rubricVersionOpt}: scoring with versioned rubrics from config/rubrics/v${rubricVersionOpt}/`,
            );

            // Clone source rows into derived run (idempotent)
            const { derivedRunId, clonedIds } = evaluationStore.cloneRowsForRubricVersion(
              runId,
              toEvaluate,
              rubricVersionOpt,
            );
            effectiveRunId = derivedRunId;
            if (clonedIds.length > 0) {
              console.log(`  Cloned ${clonedIds.length} row(s) into derived run: ${derivedRunId}`);
            } else {
              console.log(`  Derived run already exists: ${derivedRunId} (reusing cloned rows)`);
            }

            // Re-fetch from derived run so scoring writes to the clones
            const derivedResults = evaluationStore.getResults(derivedRunId, {
              scenarioId: scenarioFilter,
              profileName: profileFilter,
            });
            // Always force-evaluate cloned rows (they have NULL scores)
            toEvaluate = derivedResults.filter((r) => r.success);
          }

          if (toEvaluate.length === 0) {
            console.log(
              'All results already have rubric scores. Use --review to inspect reasoning, or --force to re-evaluate.',
            );
            break;
          }

          const singleTurn = toEvaluate.filter((r) => !isMultiTurnResult(r));
          const multiTurn = toEvaluate.filter((r) => isMultiTurnResult(r));

          const evalStartTime = new Date();
          console.log(`\nEvaluating ${toEvaluate.length} result(s) for run: ${effectiveRunId}`);
          console.log(
            `  Started:     ${evalStartTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
          );
          if (singleTurn.length > 0) console.log(`  Single-turn: ${singleTurn.length}`);
          if (multiTurn.length > 0) console.log(`  Multi-turn:  ${multiTurn.length} (per-turn scoring)`);
          if (tutorOnly) console.log('  --tutor-only: skipping learner + dialogue scoring');
          if (skipDeliberation) console.log('  --skip-deliberation: skipping deliberation quality scoring');
          if (rubricVersionOpt) console.log(`  Rubric version: v${rubricVersionOpt}`);
          if (modelOverride) console.log(`  Model: ${modelOverride}`);
          console.log('');

          // ── Set rubric overrides if --rubric-version was specified ──
          if (rubricVersionOpt) {
            setAllRubricOverrides(resolveRubricPaths(rubricVersionOpt));
          }

          try {
            // ── Score single-turn + multi-turn results via work-stealing queue ──
            const toProcess = [
              ...singleTurn.map((r) => ({ r, mt: false })),
              ...multiTurn.map((r) => ({ r, mt: true })),
            ];
            let nextIndex = 0;
            const workerCount = Math.min(parallelism, toProcess.length);
            if (parallelism > 1) console.log(`  Parallelism: ${workerCount} workers\n`);
            const workers = Array.from({ length: workerCount }, async () => {
              while (nextIndex < toProcess.length) {
                const i = nextIndex++;
                const { r, mt } = toProcess[i];
                const tag = `[${i + 1}/${toProcess.length}]`;
                try {
                  const score = mt ? await evaluateMultiTurnResult(r, tag) : await evaluateOneResult(r, tag);
                  if (score != null) {
                    scores.push(score);
                    succeeded++;
                  } else {
                    failed++;
                  }
                } catch (err) {
                  failed++;
                  const profileName = r.profileName || `${r.provider}/${r.model}`;
                  const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
                  console.log(`${tag} ${r.scenarioId} / ${profileName} ... FAIL: ${msg}`);
                  if (verbose) console.error(err);
                }
              }
            });
            await Promise.all(workers);

            printEvaluateSummary(succeeded, failed, toEvaluate.length, scores, evalStartTime);

            // Legacy holistic dialogue evaluation for any remaining multi-turn results
            // (kept for backward compat with evaluate --multiturn-only path)
            if (multiturnOnly || restoreTurn0) {
              await evaluateHolisticDialogues(toEvaluate.filter((r) => r.success));
            }

            // Mark derived run as complete
            if (rubricVersionOpt) {
              evaluationStore.completeRun(effectiveRunId);
              console.log(`\nDerived run ${effectiveRunId} marked complete.`);
            }
          } finally {
            // Always clear overrides, even on error
            if (rubricVersionOpt) {
              clearAllRubricOverrides();
            }
          }
        }
        break;
      }

      case 'backfill-first-turn': {
        const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'backfill-first-turn'));
        if (!runId) {
          console.error(
            'Usage: eval-cli.js backfill-first-turn <runId> [--scenario <id>] [--profile <name>] [--model <model>] [--judge <judge>] [--created-after <iso>] [--created-before <iso>] [--dry-run] [--verbose]',
          );
          console.error('  Rejudges suggestions[0] (turn 0) with NO dialogue context.');
          console.error('  Updates both overall_score and tutor_first_turn_score.');
          process.exit(1);
        }

        const verbose = getFlag('verbose');
        const dryRun = getFlag('dry-run');
        const scenarioFilter = getOption('scenario') || getOption('scenarios') || null;
        const profileFilter = getOption('profile') || getOption('profiles') || null;
        const modelOverride = getOption('model') || null;
        const judgeFilter = getOption('judge') || null;
        const createdAfter = getOption('created-after') || null;
        const createdBefore = getOption('created-before') || null;

        // Resolve effective judge model: CLI --model > YAML config > opus default
        const effectiveJudgeModel =
          modelOverride ||
          (() => {
            try {
              return evalConfigLoader.loadRubric()?.claude_code_judge?.model || null;
            } catch {
              return null;
            }
          })();
        const judgeModelLabel = effectiveJudgeModel ? `claude-code/${effectiveJudgeModel}` : 'claude-opus-4.6';

        // Restore env overrides from run metadata (e.g. domain generalizability runs)
        {
          const runData = evaluationStore.getRun(runId);
          const meta = typeof runData?.metadata === 'string' ? JSON.parse(runData.metadata) : runData?.metadata;
          if (meta?.scenariosFile && !process.env.EVAL_SCENARIOS_FILE) {
            process.env.EVAL_SCENARIOS_FILE = meta.scenariosFile;
            console.log(`[backfill-first-turn] Restored EVAL_SCENARIOS_FILE from run metadata: ${meta.scenariosFile}`);
          }
          if (meta?.contentPath && !process.env.EVAL_CONTENT_PATH) {
            process.env.EVAL_CONTENT_PATH = meta.contentPath;
            console.log(`[backfill-first-turn] Restored EVAL_CONTENT_PATH from run metadata: ${meta.contentPath}`);
          }
        }

        const results = evaluationStore.getResults(runId, {
          scenarioId: scenarioFilter,
          profileName: profileFilter,
        });

        if (results.length === 0) {
          console.error(`No results found for run: ${runId}`);
          process.exit(1);
        }

        let toBackfill = results.filter((r) => r.success && Array.isArray(r.suggestions) && r.suggestions.length > 1);

        if (judgeFilter) {
          const before = toBackfill.length;
          toBackfill = toBackfill.filter((r) => r.judgeModel === judgeFilter);
          if (before !== toBackfill.length) {
            console.log(`  --judge ${judgeFilter}: filtered ${before} → ${toBackfill.length} rows`);
          }
        }

        if (createdAfter) {
          const before = toBackfill.length;
          toBackfill = toBackfill.filter((r) => typeof r.createdAt === 'string' && r.createdAt >= createdAfter);
          if (before !== toBackfill.length) {
            console.log(`  --created-after ${createdAfter}: filtered ${before} → ${toBackfill.length} rows`);
          }
        }

        if (createdBefore) {
          const before = toBackfill.length;
          toBackfill = toBackfill.filter((r) => typeof r.createdAt === 'string' && r.createdAt <= createdBefore);
          if (before !== toBackfill.length) {
            console.log(`  --created-before ${createdBefore}: filtered ${before} → ${toBackfill.length} rows`);
          }
        }

        if (toBackfill.length === 0) {
          console.log('No multi-turn rows found in scope. Nothing to backfill.');
          break;
        }

        console.log(`\nBackfilling first-turn scores for ${toBackfill.length} multi-turn row(s) in run: ${runId}`);
        console.log('  Mode: strict turn-0 rejudge (suggestions[0], no dialogue context)');
        if (dryRun) console.log('  Dry-run: no DB writes');
        if (modelOverride) console.log(`  Judge model override: ${modelOverride}`);
        console.log('');

        const judgeCli = (getOption('judge-cli') || 'claude').toLowerCase();
        let succeeded = 0;
        let failed = 0;
        let changed = 0;
        const deltas = [];

        for (let i = 0; i < toBackfill.length; i++) {
          const result = toBackfill[i];
          const tag = `[${i + 1}/${toBackfill.length}]`;
          const startTime = Date.now();
          const scenarioId = result.scenarioId;
          const profileName = result.profileName || `${result.provider}/${result.model}`;

          try {
            const scenario = getScenario(scenarioId);
            if (!scenario) {
              console.log(`${tag} ${scenarioId} / ${profileName} ... SKIP (scenario not found)`);
              failed++;
              continue;
            }

            const suggestion = result.suggestions?.[0];
            if (!suggestion) {
              console.log(`${tag} ${scenarioId} / ${profileName} ... SKIP (no turn-0 suggestion)`);
              failed++;
              continue;
            }

            // Intentionally no dialogue context: strict cold-start turn-0 evaluation.
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
              { dialogueContext: null },
            );

            let cliBin, cliJudgeArgs, cliJudgeEnv;
            if (judgeCli === 'gemini') {
              cliBin = 'gemini';
              cliJudgeArgs = ['-o', 'text'];
              if (effectiveJudgeModel) cliJudgeArgs.push('-m', effectiveJudgeModel);
              cliJudgeEnv = { ...process.env };
            } else {
              cliBin = 'claude';
              cliJudgeArgs = ['-p', '-', '--output-format', 'text'];
              if (effectiveJudgeModel) cliJudgeArgs.push('--model', effectiveJudgeModel);
              cliJudgeEnv = { ...process.env };
              delete cliJudgeEnv.ANTHROPIC_API_KEY;
              delete cliJudgeEnv.CLAUDECODE;
            }

            const stdout = await new Promise((resolve, reject) => {
              const child = spawn(cliBin, cliJudgeArgs, {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: cliJudgeEnv,
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
                if (code !== 0) reject(new Error(err || out || `${cliBin} exited with code ${code}`));
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
            const oldFirstTurn = result.tutorFirstTurnScore ?? result.overallScore ?? null;
            const delta = oldFirstTurn != null ? overallScore - oldFirstTurn : null;
            const judgeLatencyMs = Date.now() - startTime;

            const evaluation = {
              scores: normalizedScores,
              overallScore,
              tutorFirstTurnScore: overallScore,
              baseScore,
              recognitionScore,
              passesRequired: parsed.validation?.passes_required ?? true,
              passesForbidden: parsed.validation?.passes_forbidden ?? true,
              requiredMissing: parsed.validation?.required_missing || [],
              forbiddenFound: parsed.validation?.forbidden_found || [],
              summary: parsed.summary,
              judgeModel: judgeModelLabel,
              judgeLatencyMs,
            };

            if (!dryRun) {
              evaluationStore.updateResultScores(result.id, evaluation);
            }

            if (delta != null) {
              deltas.push(delta);
              if (Math.abs(delta) > 0.01) changed++;
            }

            succeeded++;
            const deltaLabel = delta == null ? '' : `  delta=${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`;
            console.log(`${tag} ${scenarioId} / ${profileName} ... first-turn=${overallScore.toFixed(1)}${deltaLabel}`);

            if (verbose && parsed.summary) {
              const truncSummary =
                parsed.summary.length > 250
                  ? parsed.summary.slice(0, 250).replace(/\n/g, ' ') + '...'
                  : parsed.summary.replace(/\n/g, ' ');
              console.log(`     Judge: ${truncSummary}`);
            }
          } catch (err) {
            failed++;
            const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
            console.log(`${tag} ${scenarioId} / ${profileName} ... FAIL: ${msg}`);
            if (verbose) console.error(err);
          }
        }

        const avgDelta = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;

        console.log('\n' + '='.repeat(60));
        console.log('  BACKFILL FIRST-TURN SUMMARY');
        console.log('='.repeat(60));
        console.log(`  Run:        ${runId}`);
        console.log(`  Processed:  ${toBackfill.length}`);
        console.log(`  Succeeded:  ${succeeded}`);
        console.log(`  Failed:     ${failed}`);
        console.log(`  Changed:    ${changed}`);
        if (avgDelta != null) {
          const sign = avgDelta >= 0 ? '+' : '';
          console.log(`  Avg delta:  ${sign}${avgDelta.toFixed(2)}`);
        }
        if (dryRun) {
          console.log('  Mode:       dry-run (no writes)');
        }
        console.log('');
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
        //   3. Build a holistic learner prompt over the full dialogue
        //   4. Call Claude as judge
        //   5. Store per-turn + holistic learner scores on the result row

        const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'evaluate-learner'));
        if (!runId) {
          console.error(
            'Usage: eval-cli.js evaluate-learner <runId> [--model <model>] [--judge <judge>] [--force] [--verbose] [--arch <architecture>] [--parallelism N]',
          );
          console.error(
            '  Scores learner turns and holistic learner dialogue quality from logs using the learner rubric.',
          );
          console.error('  Only works on multi-turn runs with learner turns (e.g., bilateral transformation).');
          console.error('  --arch filters by learner_architecture (e.g., ego_superego_recognition)');
          process.exit(1);
        }

        const verbose = getFlag('verbose');
        const force = getFlag('force');
        const modelOverride = getOption('model') || null;
        const judgeCli = (getOption('judge-cli') || 'claude').toLowerCase();
        const judgeFilter = getOption('judge') || null;
        const profileFilter = getOption('profile') || getOption('profiles') || null;
        const archFilter = getOption('arch') || null;
        const parsedParallelism = parseInt(getOption('parallelism', '1'), 10);
        const parallelism = Number.isFinite(parsedParallelism) && parsedParallelism > 0 ? parsedParallelism : 1;

        if (!['claude', 'gemini', 'codex'].includes(judgeCli)) {
          console.error(`Error: --judge-cli must be 'claude', 'gemini', or 'codex', got '${judgeCli}'`);
          process.exit(1);
        }

        // Resolve effective judge model: CLI --model > YAML config > default
        // YAML claude_code_judge.model is only relevant for Claude CLI — skip for Gemini/Codex
        const effectiveJudgeModel = modelOverride || resolveDefaultCliJudgeModelOverride(judgeCli);
        const judgeModelLabel =
          judgeCli === 'gemini'
            ? `gemini-cli/${effectiveJudgeModel || 'auto'}`
            : judgeCli === 'codex'
              ? `codex-cli/${effectiveJudgeModel || 'auto'}`
              : effectiveJudgeModel
                ? `claude-code/${effectiveJudgeModel}`
                : 'claude-opus-4.6';

        // Load results with dialogue IDs (multi-turn data)
        const allResults = evaluationStore.getResults(runId, { profileName: profileFilter });
        let dialogueResults = allResults.filter((r) => r.dialogueId && r.success);
        if (archFilter) {
          dialogueResults = dialogueResults.filter((r) => r.learnerArchitecture === archFilter);
        }
        if (judgeFilter) {
          const before = dialogueResults.length;
          dialogueResults = dialogueResults.filter((r) => r.judgeModel === judgeFilter);
          if (before !== dialogueResults.length) {
            console.log(`  --judge ${judgeFilter}: filtered ${before} → ${dialogueResults.length} rows`);
          }
        }

        if (dialogueResults.length === 0) {
          console.error(`No multi-turn dialogue results found for run: ${runId}`);
          console.error('This command only works on runs that produced dialogue log files.');
          process.exit(1);
        }

        // Filter to those needing learner evaluation.
        // Supports two paths:
        //   1) turn-level learner scoring (existing)
        //   2) holistic learner dialogue scoring (new)
        // This enables historical backfill of missing holistic scores without
        // re-scoring all learner turns.
        let partialCount = 0;
        let missingHolisticCount = 0;
        let echoedLearnerCount = 0;
        const PLACEHOLDER_LEARNER_SIGNATURE =
          'conceptual_progression=2,engagement_quality=2,learner_authenticity=3,metacognitive_awareness=3,revision_signals=4';

        const getLearnerScoreSignature = (scoreMap = {}) =>
          Object.keys(scoreMap)
            .sort()
            .map((k) => `${k}=${typeof scoreMap[k] === 'object' ? scoreMap[k].score : scoreMap[k]}`)
            .join(',');

        const isPromptExamplePlaceholder = (parsed) => {
          if (!parsed || typeof parsed !== 'object' || !parsed.scores || typeof parsed.scores !== 'object') {
            return false;
          }

          const signature = getLearnerScoreSignature(parsed.scores);
          const reasonings = Object.values(parsed.scores)
            .map((entry) =>
              typeof entry === 'object' && entry !== null ? String(entry.reasoning || '').toLowerCase() : '',
            )
            .filter(Boolean);
          const hasTemplateReasoning = reasonings.some((reasoning) => reasoning.includes('your assessment of'));
          const hasTemplateSummary = String(parsed.summary || '')
            .toLowerCase()
            .includes('brief overall assessment');
          const overall = Number(parsed.overall_score);
          const hasTemplateOverall = Number.isFinite(overall) && overall === 55;

          if (hasTemplateReasoning) return true;

          return signature === PLACEHOLDER_LEARNER_SIGNATURE && (hasTemplateSummary || hasTemplateOverall);
        };

        const hasEchoedLearnerScorePattern = (learnerScores) => {
          const turnEntries = Object.values(learnerScores || {});
          if (turnEntries.length < 2) return false;
          const signatures = turnEntries.map((turnScore) => getLearnerScoreSignature(turnScore.scores || {}));
          return signatures.every((signature) => signature === signatures[0]);
        };

        const toEvaluate = dialogueResults
          .map((r) => {
            if (force) {
              return { result: r, needsTurnEval: true, needsHolisticEval: true };
            }

            let hasCompleteTurnScores = r.learnerOverallScore != null && !!r.learnerScores;

            // If turn scores exist, verify expected turn count against dialogue log.
            if (hasCompleteTurnScores && r.dialogueId) {
              const logPath = path.join(LOGS_DIR, `${r.dialogueId}.json`);
              try {
                if (fs.existsSync(logPath)) {
                  const log = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
                  const trace = log.dialogueTrace || [];
                  let expectedTurns = trace.filter(
                    (t) => (t.agent === 'learner' || t.agent === 'user') && t.action === 'turn_action',
                  ).length;
                  if (expectedTurns === 0) {
                    expectedTurns = trace.filter(
                      (t) =>
                        (t.agent === 'learner_synthesis' && t.action === 'response') ||
                        (t.agent === 'learner' && t.action === 'final_output'),
                    ).length;
                  }
                  const scoredTurns = Object.keys(r.learnerScores || {}).length;
                  if (scoredTurns < expectedTurns) {
                    hasCompleteTurnScores = false;
                  }
                }
              } catch {
                // If log can't be read, preserve existing behavior and trust stored turn score completeness.
              }
            }

            const needsTurnEval = !hasCompleteTurnScores;
            let needsHolisticEval = r.learnerHolisticOverallScore == null;

            if (!needsTurnEval && hasEchoedLearnerScorePattern(r.learnerScores)) {
              echoedLearnerCount++;
              partialCount++;
              needsHolisticEval = true;
              return { result: r, needsTurnEval: true, needsHolisticEval };
            }

            if (r.learnerOverallScore != null && needsTurnEval) partialCount++;
            if (!needsTurnEval && needsHolisticEval) missingHolisticCount++;

            if (!needsTurnEval && !needsHolisticEval) return null;
            return { result: r, needsTurnEval, needsHolisticEval };
          })
          .filter(Boolean);

        if (partialCount > 0) {
          console.log(`Found ${partialCount} partially-scored dialogue(s) — will re-evaluate learner turns.`);
        }
        if (echoedLearnerCount > 0) {
          console.log(
            `Found ${echoedLearnerCount} dialogue(s) with echoed learner score patterns — will re-evaluate with robust CLI parsing.`,
          );
        }
        if (missingHolisticCount > 0) {
          console.log(`Found ${missingHolisticCount} dialogue(s) with missing learner holistic scores.`);
        }

        if (toEvaluate.length === 0) {
          console.log('All dialogue results already have learner turn + holistic scores. Use --force to re-evaluate.');
          break;
        }

        const learnerStartTime = new Date();
        console.log(`\nEvaluating learner turns for ${toEvaluate.length} dialogue(s) from run: ${runId}`);
        console.log(
          `  Started:     ${learnerStartTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
        );
        if (modelOverride) console.log(`  Model: ${modelOverride}`);
        if (parallelism > 1) console.log(`  Parallelism: ${parallelism}`);
        console.log('');

        let succeeded = 0;
        let failed = 0;
        const allScores = [];
        const allHolisticScores = [];
        const learnerJudgeModel = judgeModelLabel;

        const callLearnerJudge = async (prompt) => {
          const attemptPrompts = [
            prompt,
            `${prompt}\n\nIMPORTANT RETRY DIRECTIVE: Your prior response appeared to copy the example template. Return ONLY fresh JSON scores for this specific learner transcript. Do NOT reuse example scores or example summary text.`,
          ];

          let cliBin, cliJudgeArgs, cliJudgeEnv;
          if (judgeCli === 'gemini') {
            cliBin = 'gemini';
            cliJudgeArgs = ['-s', '-o', 'text'];
            if (effectiveJudgeModel) cliJudgeArgs.push('-m', effectiveJudgeModel);
            cliJudgeEnv = { ...process.env };
          } else if (judgeCli === 'codex') {
            cliBin = 'codex';
            cliJudgeArgs = ['exec', '-'];
            if (effectiveJudgeModel) cliJudgeArgs.push('-m', effectiveJudgeModel);
            cliJudgeEnv = { ...process.env };
          } else {
            cliBin = 'claude';
            cliJudgeArgs = ['-p', '-', '--output-format', 'text'];
            if (effectiveJudgeModel) cliJudgeArgs.push('--model', effectiveJudgeModel);
            cliJudgeEnv = { ...process.env };
            delete cliJudgeEnv.ANTHROPIC_API_KEY;
            delete cliJudgeEnv.CLAUDECODE;
          }

          let lastError = null;
          for (let attempt = 0; attempt < attemptPrompts.length; attempt++) {
            try {
              const stdout = await new Promise((resolve, reject) => {
                const child = spawn(cliBin, cliJudgeArgs, {
                  stdio: ['pipe', 'pipe', 'pipe'],
                  env: cliJudgeEnv,
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
                  if (code !== 0) reject(new Error(err || out || `${cliBin} exited with code ${code}`));
                  else resolve(out);
                });
                child.stdin.write(attemptPrompts[attempt]);
                child.stdin.end();
              });

              const parsed = evaluationRunner.parseCliJudgeJsonResponse(stdout);

              if (!parsed?.scores || typeof parsed.scores !== 'object') {
                throw new Error('CLI judge response missing scores object');
              }

              if (isPromptExamplePlaceholder(parsed)) {
                throw new Error('CLI judge echoed prompt example scores');
              }

              return parsed;
            } catch (error) {
              lastError = error;
              if (attempt < attemptPrompts.length - 1) {
                continue;
              }
            }
          }

          throw lastError || new Error('CLI judge failed to return a valid learner evaluation payload');
        };

        const evaluateDialogue = async (workItem, index) => {
          const { result, needsTurnEval, needsHolisticEval } = workItem;
          const profileName = result.profileName || `${result.provider}/${result.model}`;
          const tag = `[${index + 1}/${toEvaluate.length}]`;

          // Load dialogue log file
          const logPath = path.join(LOGS_DIR, `${result.dialogueId}.json`);
          let dialogueLog;
          try {
            if (!fs.existsSync(logPath)) {
              console.log(`${tag} ${result.scenarioId} / ${profileName} ... SKIP (log file not found)`);
              return { ok: false };
            }
            dialogueLog = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
          } catch (e) {
            console.log(`${tag} ${result.scenarioId} / ${profileName} ... SKIP (${e.message})`);
            return { ok: false };
          }

          if (!dialogueLog.isMultiTurn) {
            console.log(`${tag} ${result.scenarioId} / ${profileName} ... SKIP (not multi-turn)`);
            return { ok: false };
          }

          const trace = dialogueLog.dialogueTrace || [];
          const learnerArch = dialogueLog.learnerArchitecture || 'unified';
          const isMultiAgent =
            learnerArch.includes('ego_superego') ||
            learnerArch === 'multi_agent' ||
            learnerArch.includes('psychodynamic');

          const learnerTurns = extractLearnerTurnsFromTrace(trace, isMultiAgent, dialogueLog.conversationHistory);

          if (learnerTurns.length === 0) {
            console.log(`${tag} ${result.scenarioId} / ${profileName} ... SKIP (no learner turns in trace)`);
            return { ok: false };
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

          let turnScores = result.learnerScores || {};
          let turnSucceeded = 0;
          let dialogueLearnerScore = result.learnerOverallScore ?? null;

          let holisticScores = result.learnerHolisticScores || null;
          let holisticOverallScore = result.learnerHolisticOverallScore ?? null;
          let holisticSummary = result.learnerHolisticSummary || null;

          if (!needsTurnEval && needsHolisticEval) {
            console.log(`${tag} ${result.scenarioId} / ${profileName} ... holistic-only (reusing learner turn scores)`);
          }

          if (needsTurnEval) {
            turnScores = {};

            // Score each learner turn
            for (let lt = 0; lt < learnerTurns.length; lt++) {
              // Find the learner turn's index in reconstructedTurns
              const targetIdx = reconstructedTurns.findIndex(
                (t) => t.phase === 'learner' && t.externalMessage === learnerTurns[lt].externalMessage,
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

                if (verbose) {
                  console.log(`${turnTag} ... calling ${judgeCli}`);
                }

                const parsed = await callLearnerJudge(prompt);
                const turnOverall = calculateLearnerOverallScore(parsed.scores || {}, isMultiAgent);

                if (turnOverall == null) {
                  const dimScores = Object.entries(parsed.scores || {})
                    .map(([k, v]) => `${k}=${typeof v === 'object' ? v.score : v}`)
                    .join(' ');
                  console.log(`${turnTag} ... FAIL: scores out of range or missing (${dimScores})`);
                  continue;
                }

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
              // Echo detection: if all turns produced identical score vectors, reject as echoed
              const turnEntries = Object.values(turnScores);
              if (turnEntries.length >= 2) {
                const signatures = turnEntries.map((ts) => {
                  const scores = ts.scores || {};
                  return getLearnerScoreSignature(scores);
                });
                const allIdentical = signatures.every((s) => s === signatures[0]);
                if (allIdentical) {
                  console.log(
                    `${tag} ${result.scenarioId} / ${profileName} ... SKIP: all ${turnEntries.length} turns produced identical scores (judge echoed example pattern)`,
                  );
                  return { ok: false };
                }
              }

              // Calculate dialogue-level learner score (average across turns)
              const turnOveralls = Object.values(turnScores).map((ts) => ts.overallScore);
              dialogueLearnerScore = turnOveralls.reduce((a, b) => a + b, 0) / turnOveralls.length;
            } else {
              return { ok: false };
            }
          }

          let holisticFailed = false;
          if (needsHolisticEval) {
            const holisticTag = `${tag} ${result.scenarioId} / ${profileName} learner-holistic`;
            try {
              const holisticPrompt = buildLearnerHolisticEvaluationPrompt({
                turns: reconstructedTurns,
                personaId: profileName,
                personaDescription,
                learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
                scenarioName,
                topic: result.scenarioId,
              });

              if (verbose) {
                console.log(`${holisticTag} ... calling ${judgeCli}`);
              }

              const parsedHolistic = await callLearnerJudge(holisticPrompt);
              holisticScores = parsedHolistic.scores || {};
              holisticOverallScore = calculateLearnerOverallScore(holisticScores, isMultiAgent);
              holisticSummary = parsedHolistic.summary || null;

              const holisticDimScores = Object.entries(holisticScores)
                .map(([k, v]) => `${k}=${typeof v === 'object' ? v.score : v}`)
                .join(' ');
              if (holisticOverallScore == null) {
                console.log(`${holisticTag} ... FAIL: scores out of range or missing (${holisticDimScores})`);
                holisticFailed = true;
              } else {
                console.log(`${holisticTag} ... ${holisticOverallScore.toFixed(1)}  (${holisticDimScores})`);
              }
              if (verbose && holisticSummary) {
                console.log(`     Judge: ${holisticSummary}`);
              }
            } catch (err) {
              const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
              console.log(`${holisticTag} ... FAIL: ${msg}`);
              if (verbose) console.error(err);
              holisticFailed = true;
            }
          }

          if (dialogueLearnerScore == null) {
            return { ok: false };
          }

          // Store in database on the evaluation_results row
          evaluationStore.updateResultLearnerScores(result.id, {
            scores: turnScores,
            overallScore: dialogueLearnerScore,
            judgeModel: result.learnerJudgeModel || learnerJudgeModel,
            holisticScores,
            holisticOverallScore,
            holisticSummary,
            holisticJudgeModel:
              holisticOverallScore != null ? learnerJudgeModel : result.learnerHolisticJudgeModel || null,
          });

          if (needsTurnEval) {
            console.log(
              `  → Dialogue learner score: ${dialogueLearnerScore.toFixed(1)} (${turnSucceeded} turns scored)`,
            );
          } else {
            console.log(`  → Dialogue learner score: ${dialogueLearnerScore.toFixed(1)} (existing turn scores)`);
          }
          if (holisticOverallScore != null) {
            console.log(`  → Holistic learner score: ${holisticOverallScore.toFixed(1)}`);
          } else if (needsHolisticEval) {
            console.log('  → Holistic learner score: MISSING (judge failed; rerun to backfill)');
          }
          console.log('');

          return {
            ok: !holisticFailed || !needsHolisticEval,
            score: dialogueLearnerScore,
            holisticScore: holisticOverallScore,
          };
        };

        if (parallelism === 1 || toEvaluate.length === 1) {
          for (let i = 0; i < toEvaluate.length; i++) {
            const outcome = await evaluateDialogue(toEvaluate[i], i);
            if (outcome.ok) {
              allScores.push(outcome.score);
              if (outcome.holisticScore != null) allHolisticScores.push(outcome.holisticScore);
              succeeded++;
            } else {
              failed++;
            }
          }
        } else {
          let nextIndex = 0;
          const workerCount = Math.min(parallelism, toEvaluate.length);
          const workers = Array.from({ length: workerCount }, async () => {
            while (nextIndex < toEvaluate.length) {
              const i = nextIndex++;
              const outcome = await evaluateDialogue(toEvaluate[i], i);
              if (outcome.ok) {
                allScores.push(outcome.score);
                if (outcome.holisticScore != null) allHolisticScores.push(outcome.holisticScore);
                succeeded++;
              } else {
                failed++;
              }
            }
          });
          await Promise.all(workers);
        }

        // Summary
        const learnerEndTime = new Date();
        console.log('\n' + '='.repeat(50));
        console.log('  EVALUATE-LEARNER SUMMARY');
        console.log('='.repeat(50));
        console.log(
          `  Finished:  ${learnerEndTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
        );
        console.log(`  Duration:  ${((learnerEndTime - learnerStartTime) / 1000 / 60).toFixed(1)} min`);
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
        if (allHolisticScores.length > 0) {
          const avgHolistic = allHolisticScores.reduce((a, b) => a + b, 0) / allHolisticScores.length;
          const sdHolistic =
            allHolisticScores.length > 1
              ? Math.sqrt(
                  allHolisticScores.reduce((acc, s) => acc + (s - avgHolistic) ** 2, 0) /
                    (allHolisticScores.length - 1),
                )
              : 0;
          console.log(`  Avg learner holistic: ${avgHolistic.toFixed(1)} (SD=${sdHolistic.toFixed(1)})`);
        }
        console.log('');
        break;
      }

      case 'evaluate-dialogue': {
        // ── Dialogue-level evaluation: score multi-turn dialogues on three axes ──
        //
        // For each multi-turn row:
        //   1. tutor_first_turn_score (Turn 0) — already populated by 'evaluate'
        //   2. Read tutor_last_turn_score (already populated by per-turn scoring)
        //   3. Compute delta → tutor_development_score (arithmetic, no judge call)
        //   4. Run dialogue quality prompt → dialogue_quality_score (ONE judge call)
        //
        // Single-turn rows are skipped (NULL for all new columns).

        const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'evaluate-dialogue'));
        if (!runId) {
          console.error(
            'Usage: eval-cli.js evaluate-dialogue <runId> [--scenario <id>] [--profile <name>] [--model <model>] [--judge <judge>] [--force] [--verbose]',
          );
          console.error('  Scores multi-turn dialogues: tutor last-turn, development delta, and dialogue quality.');
          console.error('  --scenario <id>  Filter to specific scenario(s) (comma-separated)');
          console.error('  --profile <name> Filter to specific profile(s) (comma-separated)');
          process.exit(1);
        }

        const verbose = getFlag('verbose');
        const force = getFlag('force');
        const modelOverride = getOption('model') || null;
        const judgeCli = (getOption('judge-cli') || 'claude').toLowerCase();
        const judgeFilter = getOption('judge') || null;
        const scenarioFilter = getOption('scenario') || getOption('scenarios') || null;
        const profileFilter = getOption('profile') || getOption('profiles') || null;

        if (!['claude', 'gemini', 'codex'].includes(judgeCli)) {
          console.error(`Error: --judge-cli must be 'claude', 'gemini', or 'codex', got '${judgeCli}'`);
          process.exit(1);
        }

        // Resolve judge model: CLI --model > YAML config > default
        // YAML claude_code_judge.model is only relevant for Claude CLI — skip for Gemini/Codex
        const effectiveJudgeModel = modelOverride || resolveDefaultCliJudgeModelOverride(judgeCli);
        const judgeModelLabel =
          judgeCli === 'gemini'
            ? `gemini-cli/${effectiveJudgeModel || 'auto'}`
            : judgeCli === 'codex'
              ? `codex-cli/${effectiveJudgeModel || 'auto'}`
              : effectiveJudgeModel
                ? `claude-code/${effectiveJudgeModel}`
                : 'claude-opus-4.6';

        // Restore env overrides from run metadata
        {
          const runData = evaluationStore.getRun(runId);
          const meta = typeof runData?.metadata === 'string' ? JSON.parse(runData.metadata) : runData?.metadata;
          if (meta?.scenariosFile && !process.env.EVAL_SCENARIOS_FILE) {
            process.env.EVAL_SCENARIOS_FILE = meta.scenariosFile;
            console.log(`[evaluate-dialogue] Restored EVAL_SCENARIOS_FILE from run metadata: ${meta.scenariosFile}`);
          }
          if (meta?.contentPath && !process.env.EVAL_CONTENT_PATH) {
            process.env.EVAL_CONTENT_PATH = meta.contentPath;
            console.log(`[evaluate-dialogue] Restored EVAL_CONTENT_PATH from run metadata: ${meta.contentPath}`);
          }
        }

        // Load all results for this run (with optional filters)
        const results = evaluationStore.getResults(runId, {
          scenarioId: scenarioFilter?.split(',')[0] || null,
          profileName: profileFilter?.split(',')[0] || null,
        });
        if (results.length === 0) {
          console.error(`No results found for run: ${runId}`);
          process.exit(1);
        }

        // Filter to multi-turn rows only (suggestions array with >1 entry,
        // OR messages-mode with >1 dialogue round)
        let toEvaluate = results.filter(
          (r) =>
            r.success &&
            ((Array.isArray(r.suggestions) && r.suggestions.length > 1) ||
              (r.conversationMode === 'messages' && r.dialogueRounds > 1)),
        );

        // Apply additional comma-separated scenario/profile filters
        if (scenarioFilter) {
          const scenarios = scenarioFilter.split(',').map((s) => s.trim());
          toEvaluate = toEvaluate.filter((r) => scenarios.includes(r.scenarioId));
        }
        if (profileFilter) {
          const profiles = profileFilter.split(',').map((p) => p.trim());
          toEvaluate = toEvaluate.filter((r) => profiles.includes(r.profileName));
        }

        if (toEvaluate.length === 0) {
          console.log('No multi-turn results found in this run. Nothing to evaluate.');
          break;
        }

        // --force: re-evaluate everything; otherwise only rows missing dialogue scores
        if (!force) {
          toEvaluate = toEvaluate.filter(
            (r) =>
              r.tutorLastTurnScore == null || r.dialogueQualityScore == null || r.dialogueQualityInternalScore == null,
          );
        }

        // --judge: only process rows from a specific judge model
        if (judgeFilter) {
          const before = toEvaluate.length;
          toEvaluate = toEvaluate.filter((r) => r.judgeModel === judgeFilter);
          if (before !== toEvaluate.length) {
            console.log(`  --judge ${judgeFilter}: filtered ${before} → ${toEvaluate.length} rows`);
          }
        }

        if (toEvaluate.length === 0) {
          console.log('All multi-turn results already have dialogue scores. Use --force to re-evaluate.');
          break;
        }

        const dialogueStartTime = new Date();
        console.log(`\nEvaluating ${toEvaluate.length} multi-turn dialogue(s) for run: ${runId}`);
        console.log(
          `  Started:   ${dialogueStartTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
        );
        if (modelOverride) console.log(`  Model: ${modelOverride}`);
        console.log('');

        let succeeded = 0;
        let failed = 0;
        const lastTurnScores = [];
        const dialogueQualityScores = [];
        const dialogueQualityInternalScores = [];
        const developmentScores = [];

        for (let i = 0; i < toEvaluate.length; i++) {
          const result = toEvaluate[i];
          const tag = `[${i + 1}/${toEvaluate.length}]`;
          const scenarioId = result.scenarioId;
          const profileName = result.profileName || `${result.provider}/${result.model}`;

          const scenario = getScenario(scenarioId);
          if (!scenario) {
            console.log(`${tag} ${scenarioId} / ${profileName} ... SKIP (scenario not found)`);
            failed++;
            continue;
          }

          // Load dialogue log for full transcript
          let dialogueLog = null;
          const dialogueId = result.dialogueId;
          if (dialogueId) {
            const logPath = path.join(LOGS_DIR, `${dialogueId}.json`);
            try {
              if (fs.existsSync(logPath)) {
                dialogueLog = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
              }
            } catch (e) {
              if (verbose) console.log(`${tag}   could not load dialogue log: ${e.message}`);
            }
          }

          const dialogueTrace = dialogueLog?.dialogueTrace || [];
          const conversationHistory = (dialogueLog?.turnResults || []).map((t, idx) => ({
            turnIndex: idx,
            turnId: t.turnId,
            suggestion: t.suggestions?.[0],
            learnerAction: t.learnerAction,
            learnerMessage: t.learnerMessage,
          }));
          const _dialogueContext =
            dialogueTrace.length > 0 || conversationHistory.length > 0
              ? { consolidatedTrace: dialogueTrace, conversationHistory }
              : null;

          try {
            // ── Step A: Read tutor_last_turn_score (already populated by per-turn scoring) ──
            const tutorLastTurnScore = result.tutorLastTurnScore ?? null;
            const judgeModel = judgeModelLabel;

            let cliBin, cliJudgeArgs, cliJudgeEnv;
            if (judgeCli === 'gemini') {
              cliBin = 'gemini';
              cliJudgeArgs = ['-o', 'text'];
              if (effectiveJudgeModel) cliJudgeArgs.push('-m', effectiveJudgeModel);
              cliJudgeEnv = { ...process.env };
            } else {
              cliBin = 'claude';
              cliJudgeArgs = ['-p', '-', '--output-format', 'text'];
              if (effectiveJudgeModel) cliJudgeArgs.push('--model', effectiveJudgeModel);
              cliJudgeEnv = { ...process.env };
              delete cliJudgeEnv.ANTHROPIC_API_KEY;
              delete cliJudgeEnv.CLAUDECODE;
            }

            if (tutorLastTurnScore != null) {
              lastTurnScores.push(tutorLastTurnScore);

              const devScore = result.tutorDevelopmentScore ?? null;
              if (devScore != null) developmentScores.push(devScore);

              const devLabel = devScore != null ? `Δ=${devScore >= 0 ? '+' : ''}${devScore.toFixed(1)}` : 'Δ=?';
              console.log(
                `${tag} ${scenarioId} / ${profileName} ... last-turn=${tutorLastTurnScore.toFixed(1)} ${devLabel}`,
              );
            } else {
              console.log(
                `${tag} ${scenarioId} / ${profileName} ... last-turn=NULL (run 'evaluate' with per-turn scoring first)`,
              );
            }

            // ── Helper: call judge and parse JSON response ──
            async function callDialogueJudge(prompt) {
              const raw = await new Promise((resolve, reject) => {
                const child = spawn(cliBin, cliJudgeArgs, { stdio: ['pipe', 'pipe', 'pipe'], env: cliJudgeEnv });
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
                  if (code !== 0) reject(new Error(err || out || `${cliBin} exited with code ${code}`));
                  else resolve(out);
                });
                child.stdin.write(prompt);
                child.stdin.end();
              });

              let jsonStr = raw.trim();
              const fm = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
              if (fm) {
                jsonStr = fm[1].trim();
              } else {
                const firstBrace = jsonStr.indexOf('{');
                const lastBrace = jsonStr.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace > firstBrace) {
                  jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
                }
              }

              const parsed = JSON.parse(jsonStr);
              const scores = {};
              for (const [key, value] of Object.entries(parsed.scores || {})) {
                if (typeof value === 'object' && value !== null) {
                  scores[key] = { score: value.score, reasoning: value.reasoning };
                } else if (typeof value === 'number') {
                  scores[key] = { score: value, reasoning: null };
                }
              }

              const overall =
                Object.keys(scores).length > 0 ? calculateDialogueQualityScore(scores) : parsed.overall_score;

              return { overall, summary: parsed.summary || null };
            }

            const promptParams = {
              turns: conversationHistory,
              dialogueTrace,
              scenarioName: scenario.name,
              scenarioDescription: scenario.description,
              topic: scenario.topic || scenario.name,
              turnCount:
                result.suggestions?.length > 1
                  ? result.suggestions.length
                  : result.dialogueRounds || conversationHistory.length,
              learnerContext: dialogueLog?.learnerContext || null,
              transcriptArtifacts: dialogueLog?.transcripts || null,
            };

            // ── Step B: Score dialogue quality (PUBLIC transcript) → dialogue_quality_score ──
            try {
              if (verbose) console.log(`${tag} ${scenarioId} / ${profileName} ... scoring dialogue quality (public)`);

              const publicPrompt = buildDialogueQualityPrompt({ ...promptParams, transcriptMode: 'public' });
              const publicResult = await callDialogueJudge(publicPrompt);

              evaluationStore.updateDialogueQualityScore(result.id, {
                dialogueQualityScore: publicResult.overall,
                dialogueQualitySummary: publicResult.summary,
                dialogueQualityJudgeModel: judgeModel,
              });
              dialogueQualityScores.push(publicResult.overall);

              console.log(
                `${tag} ${scenarioId} / ${profileName} ... dialogue-quality(public)=${publicResult.overall.toFixed(1)}`,
              );

              if (verbose && publicResult.summary) {
                const truncSummary =
                  publicResult.summary.length > 300
                    ? publicResult.summary.slice(0, 300).replace(/\n/g, ' ') + '...'
                    : publicResult.summary.replace(/\n/g, ' ');
                console.log(`     Public judge: ${truncSummary}`);
              }
            } catch (err) {
              const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
              console.log(`${tag} ${scenarioId} / ${profileName} ... dialogue-quality(public) FAIL: ${msg}`);
              if (verbose) console.error(err);
            }

            // ── Step C: Score dialogue quality (FULL transcript) → dialogue_quality_internal_score ──
            try {
              if (verbose) console.log(`${tag} ${scenarioId} / ${profileName} ... scoring dialogue quality (full)`);

              const fullPrompt = buildDialogueQualityPrompt({ ...promptParams, transcriptMode: 'full' });
              const fullResult = await callDialogueJudge(fullPrompt);

              evaluationStore.updateDialogueQualityInternalScore(result.id, {
                dialogueQualityInternalScore: fullResult.overall,
                dialogueQualityInternalSummary: fullResult.summary,
              });
              dialogueQualityInternalScores.push(fullResult.overall);

              console.log(
                `${tag} ${scenarioId} / ${profileName} ... dialogue-quality(full)=${fullResult.overall.toFixed(1)}`,
              );

              if (verbose && fullResult.summary) {
                const truncSummary =
                  fullResult.summary.length > 300
                    ? fullResult.summary.slice(0, 300).replace(/\n/g, ' ') + '...'
                    : fullResult.summary.replace(/\n/g, ' ');
                console.log(`     Full judge: ${truncSummary}\n`);
              }
            } catch (err) {
              const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
              console.log(`${tag} ${scenarioId} / ${profileName} ... dialogue-quality(full) FAIL: ${msg}`);
              if (verbose) console.error(err);
            }

            succeeded++;
          } catch (err) {
            failed++;
            const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
            console.log(`${tag} ${scenarioId} / ${profileName} ... FAIL: ${msg}`);
            if (verbose) console.error(err);
          }
        }

        // Summary
        const dialogueEndTime = new Date();
        console.log('\n' + '='.repeat(50));
        console.log('  EVALUATE-DIALOGUE SUMMARY');
        console.log('='.repeat(50));
        console.log(
          `  Finished:  ${dialogueEndTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
        );
        console.log(`  Duration:  ${((dialogueEndTime - dialogueStartTime) / 1000 / 60).toFixed(1)} min`);
        console.log(`  Total:     ${toEvaluate.length}`);
        console.log(`  Succeeded: ${succeeded}`);
        console.log(`  Failed:    ${failed}`);
        if (lastTurnScores.length > 0) {
          const avgLast = lastTurnScores.reduce((a, b) => a + b, 0) / lastTurnScores.length;
          console.log(`  Avg tutor last-turn:   ${avgLast.toFixed(1)}`);
        }
        if (developmentScores.length > 0) {
          const avgDev = developmentScores.reduce((a, b) => a + b, 0) / developmentScores.length;
          console.log(`  Avg tutor development: ${avgDev >= 0 ? '+' : ''}${avgDev.toFixed(1)}`);
        }
        if (dialogueQualityScores.length > 0) {
          const avgDQ = dialogueQualityScores.reduce((a, b) => a + b, 0) / dialogueQualityScores.length;
          console.log(`  Avg dialogue quality (public):   ${avgDQ.toFixed(1)}`);
        }
        if (dialogueQualityInternalScores.length > 0) {
          const avgDQI =
            dialogueQualityInternalScores.reduce((a, b) => a + b, 0) / dialogueQualityInternalScores.length;
          console.log(`  Avg dialogue quality (full):     ${avgDQI.toFixed(1)}`);
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
        const VALID_LEARNER_ARCHS = [
          'unified',
          'unified_recognition',
          'ego_superego',
          'ego_superego_recognition',
          'ego_superego_authentic',
          'ego_superego_recognition_authentic',
        ];
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
          'Available commands: list, quick, test, run, runs, report, status, watch, transcript, export, cleanup, delete-runs, resume, revert, rejudge, evaluate, backfill-first-turn, evaluate-learner, validate-config, chat, play',
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
