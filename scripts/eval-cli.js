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
import {
  adaptiveTraceScenarioContext,
  adaptiveTraceToDialogueLog,
  extractLearnerTurnsFromTrace,
  isAdaptiveTraceLog,
} from '../services/adaptiveTraceProjection.js';
import { callModelCliText } from '../services/cliProviderBridge.js';
import theme from '../services/cliTheme.js';
import { getOperationalCommandHandler } from './eval-cli/commands/index.js';
import { getGenerationCommandHandler } from './eval-cli/commands/generationIndex.js';
import { createHash } from 'crypto';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, '..', 'logs', 'tutor-dialogues');
const RUBRICS_DIR = path.resolve(__dirname, '..', 'config', 'rubrics');

function positiveIntEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const CLI_JUDGE_TIMEOUT_MS = positiveIntEnv('EVAL_CLI_JUDGE_TIMEOUT_MS', 600_000);

async function callSelectedCliJudgeText(judgeCli, model, prompt, role, effort = null) {
  return await callModelCliText({
    provider: judgeCli,
    model,
    prompt,
    role,
    timeoutMs: CLI_JUDGE_TIMEOUT_MS,
    effort,
  });
}
function resolveEvaluationScenarioAndDialogueLog(result) {
  const standardScenario = getScenario(result.scenarioId);
  let dialogueLog = null;
  if (result.dialogueId) {
    dialogueLog = evaluationStore.loadDialogueLog(result.dialogueId);
  }
  if (standardScenario) return { scenario: standardScenario, dialogueLog };
  if (isAdaptiveTraceLog(dialogueLog)) {
    return {
      scenario: adaptiveTraceScenarioContext(dialogueLog, result),
      dialogueLog: adaptiveTraceToDialogueLog(dialogueLog),
    };
  }
  return { scenario: null, dialogueLog };
}

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
        setAllRubricOverrides,
        resolveRubricPaths,
        clearAllRubricOverrides,
        getAvailableJudge,
        readline,
      });
      return;
    }

    switch (command) {
      case 'evaluate': {
        const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'evaluate'));
        if (!runId) {
          console.error(
            'Usage: eval-cli.js evaluate <runId> [--scenario <id>] [--profile <name>] [--judge-cli <claude|gemini|codex>] [--model <model>] [--effort <level>] [--judge <judge>] [--force] [--multiturn-only] [--restore-turn0] [--tutor-only] [--skip-deliberation] [--follow] [--review] [--refresh <ms>] [--rubric-version <ver>] [--parallelism N] [--verbose]',
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
        const judgeCliEffort = getOption('effort') || null;
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
        const judgeModelLabel = evaluationRunner.getCliJudgeModelLabel(judgeCli, effectiveJudgeModel, judgeCliEffort);

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

          if (verbose) {
            console.log(`${tag} ${scenarioId} / ${profileName} ... calling ${judgeCli}`);
          }
          const stdout = await callSelectedCliJudgeText(
            judgeCli,
            effectiveJudgeModel,
            prompt,
            'eval-cli-tutor-evaluation',
            judgeCliEffort,
          );

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
          const stdout = await callSelectedCliJudgeText(
            judgeCli,
            effectiveJudgeModel,
            prompt,
            'eval-cli-holistic-evaluation',
            judgeCliEffort,
          );

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

          const resolved = resolveEvaluationScenarioAndDialogueLog(result);
          const scenario = resolved.scenario;
          if (!scenario) {
            console.log(`${tag} ${scenarioId} / ${profileName} ... SKIP (scenario not found)`);
            return null;
          }

          // Load dialogue log
          const dialogueId = result.dialogueId;
          const dialogueLog = resolved.dialogueLog || evaluationStore.loadDialogueLog(dialogueId);
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
                    scores: publicScores,
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
                    scores: fullScores,
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
              dialogueQualityScores: dgpResult.scores,
              dialogueQualitySummary: dgpResult.summary || null,
              dialogueQualityJudgeModel: judgeModel,
            });
            console.log(`${tag}   dialogue-quality(public)=${dgpScore.toFixed(1)}`);
          }
          if (dgiResult?.success) {
            dgiScore = dgiResult.score;
            evaluationStore.updateDialogueQualityInternalScore(result.id, {
              dialogueQualityInternalScore: dgiScore,
              dialogueQualityInternalScores: dgiResult.scores,
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
          const _profileName = result.profileName || `${result.provider}/${result.model}`;
          const judgeModel = judgeModelLabel;

          const resolved = resolveEvaluationScenarioAndDialogueLog(result);
          const scenario = resolved.scenario;
          if (!scenario) return;

          const dialogueId = result.dialogueId;
          if (!dialogueId) return;

          const dialogueLog = resolved.dialogueLog;
          if (!dialogueLog) return;

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
              dialogueQualityScores: publicScores,
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
              dialogueQualityInternalScores: fullScores,
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
              const formattedBase = baseScore == null ? '--' : baseScore.toFixed(1);
              const formattedRecognition = recognitionScore == null ? '--' : recognitionScore.toFixed(1);
              console.log(
                `  ${scenarioId} / ${profileName} ... holistic=${overallScore.toFixed(1)} (base=${formattedBase} recog=${formattedRecognition})`,
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
          if (judgeCliEffort) console.log(`  Judge effort: ${judgeCliEffort}`);
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

            const stdout = await callSelectedCliJudgeText(
              judgeCli,
              effectiveJudgeModel,
              prompt,
              'eval-cli-backfill-first-turn',
            );

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

          let lastError = null;
          for (let attempt = 0; attempt < attemptPrompts.length; attempt++) {
            try {
              const stdout = await callSelectedCliJudgeText(
                judgeCli,
                effectiveJudgeModel,
                attemptPrompts[attempt],
                'eval-cli-learner-evaluation',
              );

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
              const raw = await callSelectedCliJudgeText(
                judgeCli,
                effectiveJudgeModel,
                prompt,
                'eval-cli-dialogue-evaluation',
              );

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

              return { overall, scores, summary: parsed.summary || null };
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
                dialogueQualityScores: publicResult.scores,
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
                dialogueQualityInternalScores: fullResult.scores,
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
