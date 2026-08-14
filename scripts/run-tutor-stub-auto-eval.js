#!/usr/bin/env node
/**
 * Run unattended tutor-stub dialogues with an automated learner.
 *
 * Default comparison:
 *   negative floor vs dynamic preconscious register policy vs random register policy.
 *
 * Usage:
 *   npm run tutor:stub:auto-eval -- --dry-run
 *   npm run tutor:stub:auto-eval -- --runs 2
 *   npm run tutor:stub:auto-eval -- --runs 1 --turns 8
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { resolveModel } from '../services/evalConfigLoader.js';
import { requiredTutorStubArtifactArchiveArgs } from '../services/tutorStubArtifactArchive.js';
import {
  appendRunEvent,
  assertExperimentRun,
  buildExperimentRunPlan,
  captureGitFingerprint,
  createRunPlan,
  createRunSeal,
  EXPERIMENT_RANDOM_DRAW_CONTRACT_SCHEMA,
  extractTutorStubPolicyDrawDecisions,
  hashCanonicalJson,
  hashFile,
  verifyExperimentRun,
} from '../services/experimentRunArtifacts.js';
import { tutorStubPolicyRequiresDeterministicDraw } from '../services/tutorStubPolicySampler.js';
import {
  resolveTutorStubLearnerAnalysisSealDisposition,
  summarizeTutorStubLearnerAnalysisCoverage,
  TUTOR_STUB_LEARNER_ANALYSIS_INCOMPLETE_STATUS,
} from '../services/tutorStubLearnerAnalysisCoverage.js';
import {
  recordTutorStubModelObservation,
  summarizeTutorStubFixedHorizon,
  summarizeTutorStubFixedHorizonRows,
  tutorStubMissingFixedHorizonOutcome,
} from '../services/tutorStubEvalIntegrity.js';
import {
  DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
  normalizeTutorStubEngagementStanceTemperature,
} from '../services/tutorStubRegisterTemperature.js';
import {
  DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
  normalizeTutorStubRegisterOverlayThreshold,
} from '../services/tutorStubRegisterPolicyComposition.js';
import {
  DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
  DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_SEED,
  normalizeTutorStubDagFactDropoutRate,
  normalizeTutorStubDagFactDropoutSeed,
  summarizeTutorStubDagFactDropoutTrace,
} from '../services/tutorStubDagFactDropout.js';
import { summarizeTutorStubResponseConfigurationAudits } from '../services/tutorStubResponseConfiguration.js';
import { auditTutorStubCharacterAdaptationTurns } from '../services/tutorStubCharacterAdaptationAudit.js';
import {
  normalizeTutorStubLoopMode,
  summarizeTutorStubDiagnosticCollection,
} from '../services/tutorStubDiagnosticCollection.js';
import { normalizeTutorStubPointOfActionArm } from '../services/tutorStubPointOfActionCoaching.js';
import { tutorStubStrictOriginalCandidateAccepted } from '../services/tutorStubFirstDraftCampaign.js';
import { collectTutorPrBenchmarkReachablePaths } from '../services/tutorStubPrBenchmarkHook.js';
import { resolveTutorStubWarrantGateMode } from '../services/tutorStubWarrantGate.js';
import { resolveAdaptiveWarrantChallengeResistanceSelectable } from '../services/adaptiveWarrantPolicy.js';
import { readSelectedJsonlEventsSync } from '../services/jsonlEventReader.js';
import {
  DEFAULT_TUTOR_STUB_RELEASE_SPEED,
  normalizeTutorStubReleaseSpeed,
} from '../services/tutorStubReleasePacing.js';
import {
  buildTutorStubAutoEvalLightweightDialogueField as buildLightweightDialogueField,
  projectTutorStubAutoEvalLightweightFieldTurn as lightweightFieldTurn,
} from '../services/tutorStubFieldTurnProjection.js';
import { machineSpiritsReportCss, tutorStubIndexClientJs } from '../services/tutorStubAutoEvalReportAssets.js';
import {
  animatedVizRowId,
  escapeHtml,
  infoTerm,
  renderAnimatedVizSection,
  reportRowId,
  safeJsonForScript,
} from '../services/tutorStubAutoEvalVisualizationReport.js';
import {
  learnerProfileContract,
  learnerProfileContractSummary,
  learnerProfileDescription,
  learnerProfileIds,
  learnerProfileListText,
  learnerProfilePrompt,
  normalizeLearnerProfileId,
} from './tutor-stub-learner-profile-contracts.js';

const AUTO_EVAL_SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(AUTO_EVAL_SCRIPT), '..');
const UNSUPPORTED_CODEX_MINI_REFS = new Set(['codex.mini', 'codex.gpt-mini', 'codex.gpt-5-mini']);
const DEFAULT_CODEX_MODEL_REF = 'codex.gpt-5.6-luna';
const DEFAULT_AUTO_EVAL_MODEL_CALL_BUDGET = 120;

function resolveWarrantChallengeResistance(value) {
  return resolveAdaptiveWarrantChallengeResistanceSelectable(value) ? 'selectable' : 'unselectable';
}
const argvHasOption = (name) => process.argv.slice(2).some((arg) => arg === name || arg.startsWith(`${name}=`));
const MODEL_OVERRIDE = Boolean(process.env.TUTOR_STUB_EVAL_MODEL || argvHasOption('--model'));
const ANALYSIS_MODEL_OVERRIDE = Boolean(
  process.env.TUTOR_STUB_EVAL_ANALYSIS_MODEL || argvHasOption('--analysis-model'),
);
const LEARNER_ANALYSIS_PROMPT_PROFILE_OVERRIDE = Boolean(
  process.env.TUTOR_STUB_EVAL_LEARNER_ANALYSIS_PROMPT_PROFILE || argvHasOption('--learner-analysis-prompt-profile'),
);
const AUTO_LEARNER_MODEL_OVERRIDE = Boolean(
  process.env.TUTOR_STUB_EVAL_AUTO_LEARNER_MODEL ||
  process.env.TUTOR_STUB_AUTO_LEARNER_MODEL ||
  argvHasOption('--auto-learner-model'),
);
const ENGAGEMENT_STANCE_TEMPERATURE_OVERRIDE = Boolean(
  process.env.TUTOR_STUB_EVAL_REGISTER_TEMPERATURE ||
  process.env.TUTOR_STUB_REGISTER_TEMPERATURE ||
  process.argv.slice(2).some((arg) => arg === '--register-temperature' || arg.startsWith('--register-temperature=')),
);
const REGISTER_OVERLAY_THRESHOLD_OVERRIDE = Boolean(
  process.env.TUTOR_STUB_EVAL_REGISTER_OVERLAY_THRESHOLD ||
  process.env.TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD ||
  argvHasOption('--register-overlay-threshold'),
);
const DAG_FACT_DROPOUT_OVERRIDE = Boolean(
  process.env.TUTOR_STUB_EVAL_DAG_FACT_DROPOUT ||
  process.env.TUTOR_STUB_DAG_FACT_DROPOUT ||
  argvHasOption('--dag-fact-dropout'),
);
const DAG_FACT_DROPOUT_SEED_OVERRIDE = Boolean(
  process.env.TUTOR_STUB_EVAL_DAG_FACT_DROPOUT_SEED ||
  process.env.TUTOR_STUB_DAG_FACT_DROPOUT_SEED ||
  argvHasOption('--dag-fact-dropout-seed'),
);
const RELEASE_SPEED_OVERRIDE = Boolean(
  process.env.TUTOR_STUB_EVAL_RELEASE_SPEED || process.env.TUTOR_STUB_RELEASE_SPEED || argvHasOption('--release-speed'),
);
const RUN_SEED_OVERRIDE = Boolean(process.env.TUTOR_STUB_EVAL_RUN_SEED || argvHasOption('--run-seed'));
const WARRANT_GATE_OVERRIDE = Boolean(
  process.env.TUTOR_STUB_EVAL_WARRANT_GATE || process.env.TUTOR_STUB_WARRANT_GATE || argvHasOption('--warrant-gate'),
);
const WARRANT_CHALLENGE_RESISTANCE_OVERRIDE = Boolean(
  process.env.TUTOR_STUB_EVAL_WARRANT_CHALLENGE_RESISTANCE ||
  process.env.TUTOR_STUB_WARRANT_CHALLENGE_RESISTANCE ||
  argvHasOption('--warrant-challenge-resistance'),
);
const MODEL_CALL_BUDGET_OVERRIDE = Boolean(
  process.env.TUTOR_STUB_EVAL_MODEL_CALL_BUDGET || argvHasOption('--model-call-budget'),
);
let activeReadOnlySourceDir = null;

const { values: args } = parseArgs({
  options: {
    runs: { type: 'string', default: '1' },
    'run-seed': { type: 'string', default: process.env.TUTOR_STUB_EVAL_RUN_SEED || '1' },
    turns: { type: 'string', default: 'until-grounded' },
    policies: { type: 'string', default: 'negative,dynamic,random' },
    'warrant-gate': {
      type: 'string',
      default: process.env.TUTOR_STUB_EVAL_WARRANT_GATE || process.env.TUTOR_STUB_WARRANT_GATE || 'off',
    },
    'warrant-challenge-resistance': {
      type: 'string',
      default:
        process.env.TUTOR_STUB_EVAL_WARRANT_CHALLENGE_RESISTANCE ||
        process.env.TUTOR_STUB_WARRANT_CHALLENGE_RESISTANCE ||
        'selectable',
    },
    'point-of-action-arm': {
      type: 'string',
      default: process.env.TUTOR_STUB_EVAL_POINT_OF_ACTION_ARM || '',
    },
    model: { type: 'string', default: process.env.TUTOR_STUB_EVAL_MODEL || DEFAULT_CODEX_MODEL_REF },
    'analysis-model': {
      type: 'string',
      default: process.env.TUTOR_STUB_EVAL_ANALYSIS_MODEL || DEFAULT_CODEX_MODEL_REF,
    },
    'learner-analysis-prompt-profile': {
      type: 'string',
      default: process.env.TUTOR_STUB_EVAL_LEARNER_ANALYSIS_PROMPT_PROFILE || '',
    },
    'auto-learner-model': {
      type: 'string',
      default:
        process.env.TUTOR_STUB_EVAL_AUTO_LEARNER_MODEL ||
        process.env.TUTOR_STUB_AUTO_LEARNER_MODEL ||
        DEFAULT_CODEX_MODEL_REF,
    },
    'model-call-budget': {
      type: 'string',
      default: process.env.TUTOR_STUB_EVAL_MODEL_CALL_BUDGET || String(DEFAULT_AUTO_EVAL_MODEL_CALL_BUDGET),
    },
    'auto-learner-profile': {
      type: 'string',
      default: process.env.TUTOR_STUB_EVAL_AUTO_LEARNER_PROFILE || '',
    },
    'auto-learner-profile-id': {
      type: 'string',
      default: process.env.TUTOR_STUB_EVAL_AUTO_LEARNER_PROFILE_ID || 'diligent',
    },
    'parent-run-id': { type: 'string', default: process.env.TUTOR_STUB_EVAL_PARENT_RUN_ID || '' },
    'standing-instructions-file': { type: 'string', default: '' },
    'report-from': { type: 'string', default: '' },
    'resume-from': { type: 'string', default: '' },
    'resume-statuses': { type: 'string', default: 'failed' },
    index: { type: 'boolean', default: false },
    'index-root': { type: 'string', default: process.env.TUTOR_STUB_EVAL_INDEX_ROOT || '.tutor-stub-auto-eval' },
    world: { type: 'string', default: process.env.TUTOR_STUB_EVAL_WORLD || 'world_005_marrick' },
    'trace-dir': { type: 'string', default: process.env.TUTOR_STUB_EVAL_TRACE_DIR || '.tutor-stub-auto-eval' },
    ledger: { type: 'string', default: process.env.TUTOR_STUB_EVAL_LEDGER || '.tutor-stub-auto-eval/ledger.jsonl' },
    'register-palette': { type: 'string', default: 'all' },
    'register-temperature': {
      type: 'string',
      default:
        process.env.TUTOR_STUB_EVAL_REGISTER_TEMPERATURE ||
        process.env.TUTOR_STUB_REGISTER_TEMPERATURE ||
        String(DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE),
    },
    'register-overlay-threshold': {
      type: 'string',
      default:
        process.env.TUTOR_STUB_EVAL_REGISTER_OVERLAY_THRESHOLD ||
        process.env.TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD ||
        String(DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD),
    },
    'dag-fact-dropout': {
      type: 'string',
      default:
        process.env.TUTOR_STUB_EVAL_DAG_FACT_DROPOUT ||
        process.env.TUTOR_STUB_DAG_FACT_DROPOUT ||
        String(DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE),
    },
    'dag-fact-dropout-seed': {
      type: 'string',
      default:
        process.env.TUTOR_STUB_EVAL_DAG_FACT_DROPOUT_SEED ||
        process.env.TUTOR_STUB_DAG_FACT_DROPOUT_SEED ||
        String(DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_SEED),
    },
    'release-speed': {
      type: 'string',
      default:
        process.env.TUTOR_STUB_EVAL_RELEASE_SPEED ||
        process.env.TUTOR_STUB_RELEASE_SPEED ||
        String(DEFAULT_TUTOR_STUB_RELEASE_SPEED),
    },
    'loop-mode': {
      type: 'string',
      default: process.env.TUTOR_STUB_EVAL_LOOP_MODE || 'strict',
    },
    'dag-mode': {
      type: 'string',
      default: process.env.TUTOR_STUB_EVAL_DAG_MODE || process.env.TUTOR_STUB_DAG_MODE || 'strict_dag',
    },
    'first-message': { type: 'string', default: '' },
    'cli-effort': { type: 'string', default: process.env.TUTOR_STUB_EVAL_CLI_EFFORT || '' },
    'max-tokens': { type: 'string', default: process.env.TUTOR_STUB_EVAL_MAX_TOKENS || '' },
    'history-turns': { type: 'string', default: process.env.TUTOR_STUB_EVAL_HISTORY_TURNS || '' },
    parallelism: { type: 'string', default: process.env.TUTOR_STUB_EVAL_PARALLELISM || '1' },
    'progress-interval': { type: 'string', default: process.env.TUTOR_STUB_EVAL_PROGRESS_INTERVAL || '30' },
    'until-grounded': { type: 'boolean', default: false },
    'safety-turns': { type: 'string', default: process.env.TUTOR_STUB_EVAL_SAFETY_TURNS || '80' },
    'primary-horizon': { type: 'string', default: process.env.TUTOR_STUB_EVAL_PRIMARY_HORIZON || '16' },
    'no-dag': { type: 'boolean', default: false },
    'no-stop-on-grounded': { type: 'boolean', default: false },
    'no-progress': { type: 'boolean', default: false },
    'no-html-report': { type: 'boolean', default: false },
    'no-ledger': { type: 'boolean', default: false },
    'no-memory-summary': { type: 'boolean', default: false },
    'keep-going': { type: 'boolean', default: false },
    'interleave-policies': { type: 'boolean', default: false },
    'pressure-turns': { type: 'string', default: '' },
    'dry-run': { type: 'boolean', default: false },
    'list-learner-profiles': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function printHelp() {
  console.log(`Usage:
  npm run tutor:stub:auto-eval -- [options]

Options:
  --runs <n>                 repetitions per policy (default: 1)
  --run-seed <n>             non-negative master seed for policy draws (default: 1)
  --turns <n|until-grounded> max automated learner turns per dialogue (default: until-grounded)
  --policies <csv>           register policies to compare (default: negative,dynamic,random)
                              known: dynamic,state,field,trajectory,dynamical_system,empirical_dynamical_system,continuous_dynamical_system,continuous_empirical_dynamical_system,bland,random,negative
  --warrant-gate <mode>      adaptive warrant gate: off, observe, or active (default: off)
  --warrant-challenge-resistance <selectable|unselectable>
                              whether the active gate may select challenge_resistance
  --point-of-action-arm <standing_book|triggered_placebo|side_coach|compiled_constraint>
                              frozen final-stretch Step 4 arm; forwarded unchanged to every dialogue
  --model <ref>              tutor model (default: codex.gpt-5.6-luna)
  --analysis-model <ref>     classifier + learner-DAG model (default: codex.gpt-5.6-luna)
  --learner-analysis-prompt-profile <baseline|compact_v1|handbook_v1>
                              forwarded learner-analysis prompt profile
  --auto-learner-model <ref> automated learner model (default: codex.gpt-5.6-luna)
  --model-call-budget <n>   finite model-call cap per child dialogue (default: 120)
                              children run under --lab automated_eval so the cap is enforced
  --auto-learner-profile <text>
  --auto-learner-profile-id <id>
                              built-in profile when no custom text is supplied
                              (default: diligent; use --list-learner-profiles)
  --parent-run-id <id>        semantic parent evidence run (set by QA orchestration)
  --standing-instructions-file <path>
                              append a byte-frozen conditional instruction menu to the tutor system prompt
  --report-from <json>       verify when sealed and write a derived sibling report; source stays read-only
  --resume-from <json>       rerun rows in a new sealed sibling transaction; source stays read-only
  --resume-statuses <csv>    statuses to rerun with --resume-from (default: failed)
  --index                    build/update the local report index and exit
  --index-root <path>        report index root (default: .tutor-stub-auto-eval)
  --world <id|path|none>     default: world_005_marrick
  --trace-dir <path>         new run directory/root (non-empty roots get a unique child run)
                              default: .tutor-stub-auto-eval/run-<timestamp>
  --ledger <path>            append/upsert eval ledger JSONL (default: .tutor-stub-auto-eval/ledger.jsonl)
  --register-palette <mode>  default: all
  --register-temperature <n> style + actorial part: lower sharpens; higher broadens (default: 0.15)
  --register-overlay-threshold <n>
                              minimum strong-change score for +state/+field overlays (default: 0.7)
  --dag-fact-dropout <n>     accumulated learner-DAG premise loss rate, 0-1 (default: 0)
  --dag-fact-dropout-seed <n> deterministic non-negative dropout seed (default: 1)
  --release-speed <n>          base clue-release speed, 0.5-2 (default: 1)
  --loop-mode <strict|diagnostic>
                              strict preserves fail-fast response verification;
                              diagnostic rolls back recoverable failed turns,
                              publishes only a fixed quarantine continuation,
                              and continues the requested fixed horizon
  --dag-mode <mode>          strict_dag, human_scaffold, or defeasible_human_scaffold
  --first-message <text>     seed the first learner turn instead of using tutor opening
  --cli-effort <level>       low, medium, high, xhigh, max, or config for CLI providers
  --max-tokens <n>           tutor response token cap passed to tutor-stub
  --history-turns <n>        raw recent turns retained in compact auxiliary analysis prompts
  --parallelism <n>          child dialogues to run concurrently (default: 1)
  --progress-interval <sec>  active turn progress cadence (default: 30)
  --until-grounded           legacy alias for --turns until-grounded
  --safety-turns <n>         runaway guard for --until-grounded (default: 80)
  --primary-horizon <n>      frozen raw-outcome horizon (default: 16)
  --no-dag                   omit tutor proof-DAG context
  --no-stop-on-grounded      run until --turns even after grounded closure
  --no-progress              suppress the terminal progress bar
  --no-html-report           skip the rich standalone HTML report
  --no-ledger                skip the ignored auto-eval ledger
  --no-memory-summary        disable tutor-stub compact dialogue memory
  --keep-going               continue after a failed run
  --interleave-policies      order jobs run-index-major (round-robin across
                             policies) so provider timing and quota windows do
                             not band with the policy factor
  --pressure-turns <csv>     predeclared pressure probe: force the hostile
                             face_threat register at these learner turns in
                             EVERY arm (design event; recovery scored post-hoc)
  --dry-run                  print commands only
  --list-learner-profiles    print built-in automated learner profiles
`);
}

function positiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function turnsArg() {
  return args['until-grounded'] || args.turns === 'until-grounded'
    ? 'until-grounded'
    : String(positiveInt(args.turns, '--turns'));
}

function csv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizePolicyName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/-/gu, '_');
}

function policyCsv(value) {
  return csv(value).map(normalizePolicyName).filter(Boolean);
}

function assertSupportedModelRefs(refs) {
  for (const [label, ref] of Object.entries(refs)) {
    const normalized = String(ref || '')
      .trim()
      .toLowerCase();
    if (UNSUPPORTED_CODEX_MINI_REFS.has(normalized)) {
      throw new Error(
        `${label}=${ref} is not supported by the local Codex CLI ChatGPT-account route. ` +
          'Use codex.gpt-5.6-luna for CLI-backed Codex, or openai.mini/openrouter.gpt-mini for GPT mini.',
      );
    }
  }
}

function resolvedAutoLearnerProfileId() {
  const id = normalizeLearnerProfileId(args['auto-learner-profile-id']);
  if (!learnerProfileContract(id)) {
    throw new Error(
      `Unknown --auto-learner-profile-id: ${args['auto-learner-profile-id']}. ` +
        `Known: ${learnerProfileIds().join(', ')}`,
    );
  }
  return id;
}

function resolvedAutoLearnerProfile() {
  const custom = String(args['auto-learner-profile'] || '').trim();
  if (custom) return custom;
  return learnerProfilePrompt(resolvedAutoLearnerProfileId());
}

function autoLearnerProfileLabel() {
  return String(args['auto-learner-profile'] || '').trim() ? 'custom' : resolvedAutoLearnerProfileId();
}

function printLearnerProfiles() {
  console.log(learnerProfileListText());
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function safeTimestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function safeSlug(value) {
  return String(value || 'run')
    .replace(/[^a-z0-9._-]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80);
}

function uniqueSiblingDirectory(sourceDir, kind) {
  const parent = path.dirname(path.resolve(sourceDir));
  const base = `${path.basename(path.resolve(sourceDir))}-${kind}-${safeTimestampForFile()}`;
  let candidate = path.join(parent, base);
  let suffix = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(parent, `${base}-${suffix}`);
    suffix += 1;
  }
  return candidate;
}

function freshTraceDir() {
  const requested = resolvePath(args['trace-dir']);
  const sharedDefault = resolvePath('.tutor-stub-auto-eval');
  const needsChildRun =
    path.resolve(requested) === path.resolve(sharedDefault) ||
    (fs.existsSync(requested) && fs.readdirSync(requested).length > 0);
  return needsChildRun ? path.join(requested, `run-${safeTimestampForFile()}`) : requested;
}

function posixRelative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function hashFileSet(files) {
  return hashCanonicalJson(
    [...new Set(files)].sort().map((file) => ({ path: posixRelative(file), sha256: hashFile(file) })),
  );
}

function worldSourcePath(world) {
  const raw = String(world || '').trim();
  if (!raw || raw === 'none') return null;
  const candidates = [
    path.isAbsolute(raw) ? raw : path.resolve(ROOT, raw),
    path.join(ROOT, 'config', 'drama-derivation', `${raw.replaceAll('_', '-')}.yaml`),
    path.join(ROOT, 'config', 'drama-derivation', `${raw}.yaml`),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`Cannot resolve world source for evidence hashing: ${world}`);
  return found;
}

function evidenceModel(reference) {
  const resolved = resolveModel(reference);
  return {
    requested: reference,
    resolved: `${resolved.provider}/${resolved.model}`,
    observed: null,
  };
}

function readOptionalJson(filePath) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null;
}

function pathIsWithin(filePath, parentDir) {
  if (!filePath || !parentDir) return false;
  const relative = path.relative(path.resolve(parentDir), path.resolve(filePath));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function displayCommand(parts) {
  const redacted = [];
  for (let index = 0; index < parts.length; index += 1) {
    redacted.push(parts[index]);
    if (parts[index] === '--auto-learner-profile') {
      redacted.push('[auto learner profile omitted]');
      index += 1;
    }
  }
  return `node ${redacted.map((part) => JSON.stringify(part)).join(' ')}`;
}

function flagValue(parts, flag) {
  const index = parts.indexOf(flag);
  return index === -1 ? null : parts[index + 1] || null;
}

function withFlagValue(parts, flag, value) {
  if (value === undefined || value === null || value === '') return parts;
  const out = [...parts];
  const index = out.indexOf(flag);
  if (index === -1) {
    out.push(flag, String(value));
  } else {
    out[index + 1] = String(value);
  }
  return out;
}

function withBooleanFlag(parts, flag, enabled) {
  if (!enabled || parts.includes(flag)) return parts;
  return [...parts, flag];
}

function assertSupportedChildArgs(childArgs) {
  assertSupportedModelRefs({
    '--model': flagValue(childArgs, '--model'),
    '--classifier-model': flagValue(childArgs, '--classifier-model'),
    '--learner-record-model': flagValue(childArgs, '--learner-record-model'),
    '--auto-learner-model': flagValue(childArgs, '--auto-learner-model'),
  });
  if (flagValue(childArgs, '--lab') !== 'automated_eval') {
    throw new Error('auto-eval child command must use --lab automated_eval');
  }
  positiveInt(flagValue(childArgs, '--model-call-budget'), 'child --model-call-budget');
}

function listTraceFiles(traceDir) {
  if (!fs.existsSync(traceDir)) return [];
  return fs
    .readdirSync(traceDir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(traceDir, name))
    .sort();
}

function runStatePath(traceDir) {
  return path.join(traceDir, 'run-state.json');
}

function writeJsonAtomic(filePath, value) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
  );
  fs.writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmpPath, filePath);
}

function countBy(values) {
  const counts = {};
  for (const value of values) {
    const key = String(value || 'none');
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function formatCounts(counts, { limit = 6 } = {}) {
  return Object.entries(counts || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, value]) => `${key} ${value}`)
    .join(', ');
}

const REPORT_POLICY_ORDER = [
  'bland',
  'random',
  'state',
  'field',
  'trajectory',
  'dynamic',
  'dynamical_system',
  'empirical_dynamical_system',
  'continuous_dynamical_system',
  'continuous_empirical_dynamical_system',
  'negative',
];

function reportPolicyRank(policy) {
  const rank = REPORT_POLICY_ORDER.indexOf(String(policy || ''));
  return rank === -1 ? REPORT_POLICY_ORDER.length : rank;
}

function compareReportPolicies(left, right) {
  const rankDelta = reportPolicyRank(left) - reportPolicyRank(right);
  if (rankDelta) return rankDelta;
  return String(left || '').localeCompare(String(right || ''));
}

function compareReportRows(left, right) {
  const policyDelta = compareReportPolicies(left?.policy, right?.policy);
  if (policyDelta) return policyDelta;
  return Number(left?.runIndex || 0) - Number(right?.runIndex || 0);
}

function mean(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) return 0;
  return Number((finite.reduce((sum, value) => sum + value, 0) / finite.length).toFixed(3));
}

function meanOrNull(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? Number((finite.reduce((sum, value) => sum + value, 0) / finite.length).toFixed(3)) : null;
}

function entropy(values) {
  const filtered = values.filter(Boolean);
  if (!filtered.length) return 0;
  const counts = Object.values(countBy(filtered));
  const total = filtered.length;
  const raw = counts.reduce((sum, count) => {
    const p = count / total;
    return sum - p * Math.log2(p);
  }, 0);
  return Number(raw.toFixed(3));
}

function scoreValue(score) {
  if (score && typeof score === 'object' && score.score !== undefined) return score.score;
  if (score !== undefined && score !== null) return score;
  return '?';
}

function clampField01(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.max(0, Math.min(1, Number(value)));
}

function roundField(value) {
  return Number((Number(value) || 0).toFixed(3));
}

function fieldScore(score) {
  const raw = scoreValue(score);
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? clampField01(numeric / 5) : 0;
}

function fieldDelta(current, previous) {
  return roundField((current || 0) - (previous || 0));
}

function numericScore(score) {
  const raw = scoreValue(score);
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatSignedField(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'n/a';
  return `${numeric >= 0 ? '+' : ''}${numeric}`;
}

function formatPositiveField(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'n/a';
  return numeric.toFixed(3);
}

function displayBottleneck(value, { groundedClosure = false } = {}) {
  const raw = String(value || '').trim();
  if (groundedClosure || raw === 'grounded_asserted_secret') return 'closed';
  if (!raw) return 'open';
  return raw;
}

function displayStopReason(value) {
  if (value === 'auto_grounded_closure') return 'grounded closure';
  return value || 'no stop reason';
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

function wordsInText(text) {
  return String(text || '')
    .split(/\s+/)
    .filter(Boolean).length;
}

function roundOptionalField(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(3)) : null;
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizedField01(value, fallback = 0) {
  const numeric = numberOrNull(value);
  return numeric === null ? fallback : clampField01(numeric);
}

function textSnippet(value, maxLength = 180) {
  const text = String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function compactNumericMap(object, { limit = Infinity, abs = false, minAbs = 0 } = {}) {
  const entries = Object.entries(object || {})
    .map(([key, value]) => [key, numberOrNull(value)])
    .filter(([, value]) => value !== null && Math.abs(value) >= minAbs)
    .sort((a, b) => {
      const left = abs ? Math.abs(a[1]) : a[1];
      const right = abs ? Math.abs(b[1]) : b[1];
      return right - left || a[0].localeCompare(b[0]);
    })
    .slice(0, limit);
  return Object.fromEntries(entries.map(([key, value]) => [key, roundOptionalField(value)]));
}

function mergeCounts(countObjects = []) {
  const out = {};
  for (const counts of countObjects) {
    for (const [key, value] of Object.entries(counts || {})) {
      out[key] = (out[key] || 0) + Number(value || 0);
    }
  }
  return out;
}

function compactRegisterDistribution(selection = {}) {
  const distribution = Array.isArray(selection.distribution)
    ? selection.distribution
        .map((entry) => ({
          register: String(entry?.register || entry?.selected_register || '').trim(),
          probability: roundOptionalField(entry?.probability),
          weight: roundOptionalField(entry?.weight),
        }))
        .filter((entry) => entry.register)
    : [];
  if (distribution.length) {
    return {
      source: 'policy_distribution',
      rows: distribution.sort(
        (a, b) => Number(b.probability || 0) - Number(a.probability || 0) || a.register.localeCompare(b.register),
      ),
    };
  }
  const selected = String(selection.selected_register || '').trim();
  if (!selected) return { source: 'none', rows: [] };
  return {
    source: 'selected_only',
    rows: [
      {
        register: selected,
        probability: roundOptionalField(selection.selected_probability ?? 1),
        weight: null,
      },
    ],
  };
}

function seriesMetric(values) {
  const finite = values.map(numberOrNull).filter((value) => value !== null);
  const current = finite.at(-1) ?? null;
  const previous = finite.length >= 2 ? finite.at(-2) : null;
  const beforePrevious = finite.length >= 3 ? finite.at(-3) : null;
  const velocity = current !== null && previous !== null ? current - previous : null;
  const previousVelocity = previous !== null && beforePrevious !== null ? previous - beforePrevious : null;
  const acceleration = velocity !== null && previousVelocity !== null ? velocity - previousVelocity : null;
  let slope = null;
  if (finite.length >= 2) {
    const points = finite.map((value, index) => ({ x: index, y: value }));
    const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    const denominator = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
    if (denominator) {
      const numerator = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);
      slope = numerator / denominator;
    }
  }
  return {
    current: roundOptionalField(current),
    previous: roundOptionalField(previous),
    velocity: roundOptionalField(velocity),
    previousVelocity: roundOptionalField(previousVelocity),
    acceleration: roundOptionalField(acceleration),
    slope: roundOptionalField(slope),
  };
}

function reconstructedTrajectoryFromFieldRows(fieldRows, index, { window = 5 } = {}) {
  const rows = fieldRows.slice(Math.max(0, index + 1 - window), index + 1);
  const fieldValues = rows.map((row) => row.learnerMastery);
  const dagValues = rows.map((row) => row.coverage);
  const riskValues = rows.map((row) => row.learnerRisk);
  const field = seriesMetric(fieldValues);
  const dag = seriesMetric(dagValues);
  const risk = seriesMetric(riskValues);
  const fieldSlope = Number(field.slope || 0);
  const dagSlope = Number(dag.slope || 0);
  const riskSlope = Number(risk.slope || 0);
  const fieldVelocity = Number(field.velocity || 0);
  const dagVelocity = Number(dag.velocity || 0);
  const riskVelocity = Number(risk.velocity || 0);
  return {
    schema: 'machinespirits.tutor-stub.reconstructed-trajectory.v1',
    window,
    pointCount: rows.length,
    points: rows.map((row) => ({
      turn: row.turn,
      fieldScore: row.learnerMastery,
      dagScore: row.coverage,
      riskScore: row.learnerRisk,
      bottleneck: row.bottleneck,
    })),
    field,
    dag,
    risk,
    flags: {
      plateau: rows.length >= 3 && Math.abs(fieldSlope) < 0.025 && Math.abs(dagSlope) < 0.025 && riskSlope >= -0.025,
      fieldRegression: rows.length >= 2 && (fieldVelocity < -0.04 || fieldSlope < -0.025),
      riskRising: rows.length >= 2 && (riskVelocity > 0.04 || riskSlope > 0.025),
      fieldOnlyDrift: rows.length >= 3 && fieldSlope > 0.025 && dagSlope <= 0.015,
      dagOnlyDrift: rows.length >= 3 && dagSlope > 0.025 && fieldSlope < 0.015,
      stableConvergence: rows.length >= 3 && dagSlope > 0.025 && fieldSlope >= -0.015 && riskSlope <= 0.025,
      coerciveProgress: rows.length >= 2 && dagVelocity > 0.08 && (fieldVelocity < -0.02 || riskVelocity > 0.04),
      noisyAcceleration:
        rows.length >= 3 &&
        (Math.abs(Number(field.acceleration || 0)) > 0.08 ||
          Math.abs(Number(dag.acceleration || 0)) > 0.08 ||
          Math.abs(Number(risk.acceleration || 0)) > 0.08),
      nearClosure: Number(rows.at(-1)?.coverage || 0) >= 0.8,
    },
  };
}

function compactTrajectoryMetric(metric = {}) {
  return {
    current: roundOptionalField(metric.current),
    previous: roundOptionalField(metric.previous),
    velocity: roundOptionalField(metric.velocity),
    previousVelocity: roundOptionalField(metric.previousVelocity),
    acceleration: roundOptionalField(metric.acceleration),
    slope: roundOptionalField(metric.slope),
  };
}

function compactTrajectory(trajectory, fallbackTrajectory) {
  const source = trajectory ? 'register_policy' : 'reconstructed_field';
  const selected = trajectory || fallbackTrajectory || {};
  return {
    schema: selected.schema || null,
    source,
    window: selected.window ?? null,
    pointCount: selected.pointCount ?? null,
    points: (selected.points || []).map((point) => ({
      turn: point.turn ?? null,
      fieldScore: roundOptionalField(point.fieldScore),
      dagScore: roundOptionalField(point.dagScore),
      riskScore: roundOptionalField(point.riskScore),
      bottleneck: point.bottleneck || null,
    })),
    field: compactTrajectoryMetric(selected.field),
    dag: compactTrajectoryMetric(selected.dag),
    risk: compactTrajectoryMetric(selected.risk),
    flags: Object.fromEntries(Object.entries(selected.flags || {}).map(([key, value]) => [key, Boolean(value)])),
  };
}

function classifierStateFeatures(turn = {}, fieldRow = {}) {
  const classification = turn.classification || {};
  const turnAnalysis = classification.turn || {};
  const scores = turnAnalysis.scores || {};
  return {
    requestType: turnAnalysis.request_type || 'unknown',
    discourseMove: turnAnalysis.discourse_move || 'unknown',
    evidenceUse: turnAnalysis.evidence_use || 'unknown',
    epistemicStance: turnAnalysis.epistemic_stance || 'unknown',
    agency: turnAnalysis.agency || 'unknown',
    affect: turnAnalysis.affect || 'unknown',
    scores: {
      conceptual: roundOptionalField(fieldRow.conceptual ?? fieldScore(scores.conceptual_engagement)),
      epistemicReadiness: roundOptionalField(fieldRow.readiness ?? fieldScore(scores.epistemic_readiness)),
      learnerSurface: roundOptionalField(mean([fieldRow.conceptual, fieldRow.readiness])),
    },
  };
}

function approximateDynamicalStateVector({ turn, fieldRow, trajectory, selection }) {
  const assessment = turn?.tutorLearnerDagModel?.assessment || {};
  const metrics = turn?.tutorLearnerDagModel?.metrics || {};
  const flags = trajectory?.flags || {};
  const coverage = normalizedField01(assessment.bestPathCoverage ?? fieldRow.coverage, 0);
  const missingNeed = clampField01(
    Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? fieldRow.missingCount ?? 0) / 8,
  );
  const unsupportedNeed = clampField01(Number(assessment.unsupportedAssertionCount || 0) / 3);
  const conceptual = normalizedField01(fieldRow.conceptual, 0.5);
  const readiness = normalizedField01(fieldRow.readiness, 0.5);
  const risk = normalizedField01(fieldRow.learnerRisk, 0);
  const alignment = normalizedField01(fieldRow.tutorAlignment, 0.5);
  const momentum = normalizedField01(fieldRow.jointMomentum, 0);
  const selectedProbability = numberOrNull(selection?.selected_probability);
  const negativeValence =
    selection?.valence === 'negative' || ['ironic', 'sarcastic', 'face_threat'].includes(selection?.selected_register);
  return {
    evidence_gap: roundField(clampField01((1 - coverage) * 0.58 + missingNeed * 0.32 + (1 - conceptual) * 0.1)),
    warrant_gap: roundField(
      clampField01(
        unsupportedNeed * 0.45 +
          (assessment.bottleneck === 'assertion_gap' ? 0.3 : 0) +
          (assessment.bottleneck === 'premature_assertion' ? 0.35 : 0) +
          (1 - readiness) * 0.15,
      ),
    ),
    agency_deficit: roundField(clampField01(1 - readiness + (selection?.action_family === 'answer_supply' ? 0.2 : 0))),
    affective_risk: roundField(risk),
    recognition_pressure: roundField(clampField01((1 - alignment) * 0.45 + risk * 0.3 + (negativeValence ? 0.25 : 0))),
    coercion_risk: roundField(
      clampField01((negativeValence ? 0.35 : 0) + (flags.coerciveProgress ? 0.35 : 0) + risk * 0.2),
    ),
    integration_need: roundField(
      clampField01(1 - conceptual + (assessment.bottleneck === 'learner_integration_gap' ? 0.25 : 0)),
    ),
    compression_need: roundField(clampField01((1 - conceptual) * 0.45 + (1 - readiness) * 0.25 + missingNeed * 0.3)),
    momentum: roundField(momentum),
    stagnation: roundField(clampField01((flags.plateau ? 0.55 : 0) + (Number(fieldRow.speed || 0) < 0.035 ? 0.18 : 0))),
    disruption_need: roundField(
      clampField01((flags.plateau ? 0.5 : 0) + (flags.fieldRegression ? 0.25 : 0) + (1 - readiness) * 0.2),
    ),
    tempo_affordance: roundField(
      clampField01(
        momentum * (1 - risk) + (selection?.request_type === 'transfer_demand_or_named_material' ? 0.12 : 0),
      ),
    ),
    closure_pressure: roundField(
      clampField01(
        coverage * 0.65 + (assessment.finalSecretEntailed ? 0.25 : 0) + (assessment.assertedSecret ? 0.2 : 0),
      ),
    ),
    field_regression: roundField(
      clampField01((flags.fieldRegression ? 0.65 : 0) + Math.max(0, -Number(trajectory?.field?.velocity || 0)) * 3),
    ),
    empirical_uncertainty: roundField(selectedProbability === null ? 0.8 : clampField01(1 - selectedProbability)),
  };
}

function frameEvents({ turn, fieldRow, trajectory, selection }) {
  const events = new Set();
  if (fieldRow.bottleneck) events.add(fieldRow.bottleneck);
  if (turn?.humanDiscourseFrame?.sideArc?.detected)
    events.add(`side_arc:${turn.humanDiscourseFrame.sideArc.type || 'unknown'}`);
  if (turn?.humanDiscourseFrame?.proofDebt?.status && turn.humanDiscourseFrame.proofDebt.status !== 'none_open') {
    events.add(`proof_debt:${turn.humanDiscourseFrame.proofDebt.status}`);
  }
  if (turn?.humanDiscourseFrame?.warrantPremiseAudit?.status) {
    events.add(`warrant_stocktake:${turn.humanDiscourseFrame.warrantPremiseAudit.status}`);
  }
  for (const flag of selection?.risk_flags || []) events.add(flag);
  for (const [flag, enabled] of Object.entries(trajectory?.flags || {})) {
    if (enabled) events.add(flag);
  }
  if (turn?.tutorLeakAudit?.ok === false) events.add('leak_audit_flag');
  if (turn?.tutorResponseRepaired) events.add('repaired_response');
  if (turn?.tutorDeterministicFallback) events.add('deterministic_fallback');
  return Array.from(events).filter(Boolean).slice(0, 10);
}

function compactFrameState({ turn, fieldRow, selection }) {
  const stateObservation = turn?.stateObservation || null;
  if (stateObservation) {
    return {
      observation: stateObservation,
      classifier: {
        requestType: stateObservation.classifier?.request_type || 'unknown',
        discourseMove: stateObservation.classifier?.discourse_move || 'unknown',
        evidenceUse: stateObservation.classifier?.evidence_use || 'unknown',
        epistemicStance: stateObservation.classifier?.epistemic_stance || 'unknown',
        agency: stateObservation.classifier?.agency || 'unknown',
        affect: stateObservation.classifier?.affect || 'unknown',
        scores: {
          conceptual: stateObservation.classifier?.conceptual_score ?? null,
          epistemicReadiness: stateObservation.classifier?.epistemic_readiness_score ?? null,
          learnerSurface: mean([
            stateObservation.classifier?.conceptual_score,
            stateObservation.classifier?.epistemic_readiness_score,
          ]),
        },
      },
      dag: {
        bottleneck: stateObservation.dag?.bottleneck || 'unknown',
        bestPathCoverage: stateObservation.dag?.best_path_coverage ?? null,
        missingPremiseCount: stateObservation.dag?.missing_premise_count ?? null,
        groundedCount: stateObservation.dag?.grounded_count ?? null,
        voicedDerivedCount: stateObservation.dag?.voiced_derived_count ?? null,
        unsupportedAssertionCount: stateObservation.dag?.unsupported_assertion_count ?? null,
        finalSecretEntailed: stateObservation.dag?.final_secret_entailed === true,
        assertedSecret: stateObservation.dag?.asserted_secret === true,
        assertedMirror: stateObservation.dag?.asserted_mirror === true,
      },
    };
  }
  const model = turn?.tutorLearnerDagModel || {};
  const metrics = model.metrics || {};
  const assessment = model.assessment || {};
  const policyFeatures =
    selection?.state_policy?.features ||
    selection?.field_policy?.features ||
    selection?.trajectory_policy?.features ||
    selection?.dynamical_system_policy?.features;
  const classifier = {
    ...classifierStateFeatures(turn, fieldRow),
    ...(policyFeatures
      ? {
          requestType: policyFeatures.requestType || policyFeatures.request_type || undefined,
          discourseMove: policyFeatures.discourseMove || policyFeatures.discourse_move || undefined,
          evidenceUse: policyFeatures.evidenceUse || policyFeatures.evidence_use || undefined,
          epistemicStance: policyFeatures.epistemicStance || policyFeatures.epistemic_stance || undefined,
          agency: policyFeatures.agency || undefined,
          affect: policyFeatures.affect || undefined,
          scores: policyFeatures.scores || classifierStateFeatures(turn, fieldRow).scores,
        }
      : {}),
  };
  return {
    classifier,
    dag: {
      bottleneck: assessment.bottleneck || 'unknown',
      bestPathCoverage: roundOptionalField(assessment.bestPathCoverage ?? fieldRow.coverage),
      missingPremiseCount: Number(
        metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? fieldRow.missingCount ?? 0,
      ),
      groundedCount: Number(metrics.groundedCount ?? fieldRow.groundedCount ?? 0),
      voicedDerivedCount: Number(metrics.voicedDerivedCount || 0),
      unsupportedAssertionCount: Number(assessment.unsupportedAssertionCount || 0),
      finalSecretEntailed: assessment.finalSecretEntailed === true,
      assertedSecret: assessment.assertedSecret === true,
      assertedMirror: assessment.assertedMirror === true,
    },
  };
}

function buildAnimatedVizFrame({ turn, index, fieldRows }) {
  const fieldRow = fieldRows[index] || lightweightFieldTurn(turn, fieldRows[index - 1] || null);
  const selection = turn?.registerSelection || {};
  const fallbackTrajectory = reconstructedTrajectoryFromFieldRows(fieldRows, index);
  const policyTrajectory =
    selection.dynamical_system_policy?.trajectory || selection.trajectory_policy?.trajectory || null;
  const trajectory = compactTrajectory(policyTrajectory, fallbackTrajectory);
  const stateVector =
    selection.dynamical_system_policy?.state_vector ||
    approximateDynamicalStateVector({ turn, fieldRow, trajectory, selection });
  const derivativeVector = selection.dynamical_system_policy?.derivative_vector || {
    field_velocity: trajectory.field.velocity,
    field_slope: trajectory.field.slope,
    field_acceleration: trajectory.field.acceleration,
    dag_velocity: trajectory.dag.velocity,
    dag_slope: trajectory.dag.slope,
    dag_acceleration: trajectory.dag.acceleration,
    risk_velocity: trajectory.risk.velocity,
    risk_slope: trajectory.risk.slope,
    risk_acceleration: trajectory.risk.acceleration,
  };
  const distribution = compactRegisterDistribution(selection);
  return {
    schema: 'machinespirits.tutor-stub.animated-viz-frame.v1',
    turn: turn?.turn ?? index + 1,
    policy: selection.policy || null,
    selectedEngagementStance: selection.engagement_stance || selection.selected_register || null,
    selectedRegister: selection.selected_register || selection.engagement_stance || null,
    responseConfiguration: turn?.responseConfiguration || selection.response_configuration || null,
    responseConfigurationAudit: turn?.responseConfigurationAudit || null,
    pointOfAction: turn?.pointOfAction || null,
    dagFactDropout: turn?.dagFactDropout || null,
    releasePacing: turn?.releasePacing || null,
    register: {
      policy: selection.policy || null,
      engagementStance: selection.engagement_stance || selection.selected_register || null,
      selected: selection.selected_register || selection.engagement_stance || null,
      probability: roundOptionalField(selection.selected_probability),
      vector: selection.register_vector || selection.continuous_register_policy?.register_vector || null,
      vectorEntropyBits: roundOptionalField(
        selection.register_vector_entropy_bits ?? selection.continuous_register_policy?.entropy_bits,
      ),
      continuous: selection.continuous_register_policy || null,
      distributionSource: distribution.source,
      distribution: distribution.rows,
      scores: compactNumericMap(
        selection.dynamical_system_policy?.scores ||
          selection.trajectory_policy?.scores ||
          selection.state_policy?.scores ||
          selection.field_policy?.scores ||
          {},
        { limit: 12 },
      ),
      logits: compactNumericMap(selection.dynamical_system_policy?.logits || {}, { limit: 12 }),
    },
    state: compactFrameState({ turn, fieldRow, selection }),
    humanDiscourse: turn?.humanDiscourseFrame || null,
    field: {
      learnerMastery: fieldRow.learnerMastery,
      learnerRisk: fieldRow.learnerRisk,
      tutorAlignment: fieldRow.tutorAlignment,
      jointMomentum: fieldRow.jointMomentum,
      coverage: fieldRow.coverage,
      speed: fieldRow.speed,
      bottleneck: fieldRow.bottleneck,
      learnerMove: fieldRow.learnerMove,
    },
    trajectory,
    dynamics: {
      source: selection.dynamical_system_policy ? 'dynamical_system_policy' : 'reconstructed_state',
      stateVector: compactNumericMap(stateVector),
      derivativeVector: compactNumericMap(derivativeVector),
      attractors: compactNumericMap(selection.dynamical_system_policy?.attractors || {}, { limit: 12 }),
      selectedContributions: (selection.dynamical_system_policy?.selected_contributions || []).slice(0, 8),
      empirical: selection.dynamical_system_policy?.empirical || null,
      corpusEmpirical: selection.dynamical_system_policy?.corpus_empirical || null,
      continuous:
        selection.continuous_register_policy || selection.dynamical_system_policy?.continuous_register_policy || null,
      mapping: selection.dynamical_system_policy?.mapping || null,
    },
    events: frameEvents({ turn, fieldRow, trajectory, selection }),
    snippets: {
      learner: textSnippet(turn?.learner),
      tutor: textSnippet(turn?.tutor),
    },
  };
}

function buildAnimatedRunVisualization(turnRecords = [], fieldViz = null) {
  const fieldRows = fieldViz?.rows?.length ? fieldViz.rows : buildLightweightDialogueField(turnRecords).rows;
  const frames = turnRecords.map((turn, index) => buildAnimatedVizFrame({ turn, index, fieldRows }));
  if (!frames.length) return null;
  const registerPalette = Array.from(
    new Set(
      frames.flatMap((frame) => [
        frame.selectedRegister,
        ...frame.register.distribution.map((entry) => entry.register),
        ...Object.keys(frame.register.scores || {}),
      ]),
    ),
  ).filter(Boolean);
  const dynamicsAxes = Array.from(new Set(frames.flatMap((frame) => Object.keys(frame.dynamics.stateVector || {}))));
  return {
    schema: 'machinespirits.tutor-stub.run-animation.v1',
    turnCount: frames.length,
    registerPalette,
    dynamicsAxes,
    layers: {
      state: true,
      field: true,
      trajectory: true,
      dynamicalSystem: frames.some((frame) => frame.dynamics.source === 'dynamical_system_policy'),
      registers: frames.some((frame) => frame.register.distribution.length),
    },
    frames,
  };
}

function compactTranscriptTurn({ turn, index, fieldRows }) {
  const fieldRow = fieldRows[index] || lightweightFieldTurn(turn, fieldRows[index - 1] || null);
  const selection = turn?.registerSelection || {};
  const fallbackTrajectory = reconstructedTrajectoryFromFieldRows(fieldRows, index);
  const policyTrajectory =
    selection.dynamical_system_policy?.trajectory || selection.trajectory_policy?.trajectory || null;
  const trajectory = compactTrajectory(policyTrajectory, fallbackTrajectory);
  const state = compactFrameState({ turn, fieldRow, selection });
  const analysis = turn?.classification?.turn || {};
  const efficacy = turn?.previousRegisterEfficacy || null;
  const leakAudit = turn?.tutorLeakAudit || null;
  return {
    schema: 'machinespirits.tutor-stub.transcript-turn.v1',
    turn: turn?.turn ?? index + 1,
    learner: String(turn?.learner || ''),
    tutor: String(turn?.tutor || ''),
    excerpts: {
      learner: textSnippet(turn?.learner, 260),
      tutor: textSnippet(turn?.tutor, 260),
    },
    register: {
      policy: selection.policy || null,
      engagementStance: selection.engagement_stance || selection.selected_register || null,
      selected: selection.selected_register || selection.engagement_stance || null,
      mode: selection.selected_mode || null,
      actionFamily: selection.action_family || null,
      audienceRegister: selection.audience_register || null,
      lexicalAccessibility: selection.lexical_accessibility || null,
      sceneImmersion: selection.scene_immersion || null,
      actorialPart: selection.actorial_part || selection.response_configuration?.actorial_part || null,
      actorialPartLabel: selection.actorial_part_label || selection.response_configuration?.actorial_part_label || null,
      valence: selection.valence || null,
      probability: roundOptionalField(selection.selected_probability ?? selection.confidence),
      vector: selection.register_vector || selection.continuous_register_policy?.register_vector || null,
      vectorEntropyBits: roundOptionalField(
        selection.register_vector_entropy_bits ?? selection.continuous_register_policy?.entropy_bits,
      ),
      continuous: selection.continuous_register_policy || null,
      reason: textSnippet(selection.register_reason, 360),
      evidenceSpan: textSnippet(selection.evidence_span, 260),
      expectedDagMove: textSnippet(selection.expected_dag_move, 260),
      expectedFieldMove: textSnippet(selection.expected_field_move, 260),
      riskFlags: Array.isArray(selection.risk_flags) ? selection.risk_flags.slice(0, 8) : [],
    },
    responseConfiguration: turn?.responseConfiguration || selection.response_configuration || null,
    responseConfigurationAudit: turn?.responseConfigurationAudit || null,
    pointOfAction: turn?.pointOfAction || null,
    learnerState: {
      summary: textSnippet(analysis.summary, 320),
      requestType: state.classifier.requestType || analysis.request_type || 'unknown',
      discourseMove: state.classifier.discourseMove || analysis.discourse_move || 'unknown',
      evidenceUse: state.classifier.evidenceUse || analysis.evidence_use || 'unknown',
      epistemicStance: state.classifier.epistemicStance || analysis.epistemic_stance || 'unknown',
      agency: state.classifier.agency || analysis.agency || 'unknown',
      affect: state.classifier.affect || analysis.affect || 'unknown',
      scores: state.classifier.scores || {},
    },
    dag: state.dag,
    humanDiscourse: turn?.humanDiscourseFrame || null,
    field: {
      learnerMastery: fieldRow.learnerMastery,
      learnerRisk: fieldRow.learnerRisk,
      tutorAlignment: fieldRow.tutorAlignment,
      jointMomentum: fieldRow.jointMomentum,
      coverage: fieldRow.coverage,
      speed: fieldRow.speed,
      bottleneck: fieldRow.bottleneck,
      learnerMove: fieldRow.learnerMove,
    },
    trajectory: {
      source: trajectory.source,
      fieldVelocity: roundOptionalField(trajectory.field?.velocity),
      dagVelocity: roundOptionalField(trajectory.dag?.velocity),
      riskVelocity: roundOptionalField(trajectory.risk?.velocity),
      flags: trajectory.flags || {},
    },
    events: frameEvents({ turn, fieldRow, trajectory, selection }),
    response: {
      repaired: Boolean(turn?.tutorResponseRepaired),
      deterministicFallback: Boolean(turn?.tutorDeterministicFallback),
      leakOk: leakAudit ? leakAudit.ok !== false : null,
      leaks: Array.isArray(leakAudit?.leaks) ? leakAudit.leaks.map((leak) => textSnippet(leak, 160)).slice(0, 5) : [],
      efficacyLabel: efficacy?.label || null,
      efficacyProgressScore: roundOptionalField(efficacy?.progressScore),
    },
  };
}

function buildTranscriptDrilldown(turnRecords = [], fieldViz = null) {
  const fieldRows = fieldViz?.rows?.length ? fieldViz.rows : buildLightweightDialogueField(turnRecords).rows;
  const turns = turnRecords.map((turn, index) => compactTranscriptTurn({ turn, index, fieldRows }));
  if (!turns.length) return null;
  return {
    schema: 'machinespirits.tutor-stub.transcript-drilldown.v1',
    turnCount: turns.length,
    turns,
  };
}

function trainingDelta(nextField = {}, currentField = {}, key) {
  if (!nextField || nextField[key] === undefined || !currentField || currentField[key] === undefined) return null;
  return fieldDelta(nextField[key], currentField[key]);
}

function rewardProxyFromFrames({ frame, nextFrame, transcriptTurn }) {
  const currentField = frame?.field || {};
  const nextField = nextFrame?.field || null;
  const deltas = nextField
    ? {
        learnerMastery: trainingDelta(nextField, currentField, 'learnerMastery'),
        learnerRisk: trainingDelta(nextField, currentField, 'learnerRisk'),
        coverage: trainingDelta(nextField, currentField, 'coverage'),
        tutorAlignment: trainingDelta(nextField, currentField, 'tutorAlignment'),
        jointMomentum: trainingDelta(nextField, currentField, 'jointMomentum'),
      }
    : {
        learnerMastery: null,
        learnerRisk: null,
        coverage: null,
        tutorAlignment: null,
        jointMomentum: null,
      };
  const leakPenalty = transcriptTurn?.response?.leakOk === false ? 1 : 0;
  const repairedPenalty = transcriptTurn?.response?.repaired ? 0.25 : 0;
  const score =
    deltas.learnerMastery === null
      ? null
      : roundOptionalField(
          Number(deltas.learnerMastery || 0) * 0.38 -
            Number(deltas.learnerRisk || 0) * 0.28 +
            Number(deltas.coverage || 0) * 0.24 +
            Number(deltas.jointMomentum || 0) * 0.1 -
            leakPenalty * 0.8 -
            repairedPenalty,
        );
  return {
    schema: 'machinespirits.tutor-stub.reward-proxy.v1',
    score,
    deltas,
    penalties: {
      leak: leakPenalty,
      repaired: repairedPenalty,
    },
    note: 'Exploratory proxy only: positive mastery/coverage/momentum and falling risk are useful for transition-model fitting, not a paper-grade learning effect.',
  };
}

function buildTurnTrainingExamples({ animatedViz = null, transcript = null } = {}) {
  const frames = Array.isArray(animatedViz?.frames) ? animatedViz.frames : [];
  const turns = Array.isArray(transcript?.turns) ? transcript.turns : [];
  if (!frames.length && !turns.length) return null;
  const count = Math.max(frames.length, turns.length);
  const examples = [];
  for (let index = 0; index < count; index += 1) {
    const frame = frames[index] || {};
    const turn = turns[index] || {};
    const nextFrame = frames[index + 1] || null;
    const rewardProxy = rewardProxyFromFrames({ frame, nextFrame, transcriptTurn: turn });
    examples.push({
      schema: 'machinespirits.tutor-stub.turn-training-example.v1',
      turn: frame.turn ?? turn.turn ?? index + 1,
      policy: frame.policy || turn.register?.policy || null,
      action: {
        engagementStance:
          frame.selectedEngagementStance ||
          frame.selectedRegister ||
          turn.register?.engagementStance ||
          turn.register?.selected ||
          null,
        selectedRegister: frame.selectedRegister || turn.register?.selected || null,
        actionFamily: turn.register?.actionFamily || frame.responseConfiguration?.action_family || null,
        audienceRegister: turn.register?.audienceRegister || frame.responseConfiguration?.audience_register || null,
        lexicalAccessibility:
          turn.register?.lexicalAccessibility || frame.responseConfiguration?.lexical_accessibility || null,
        sceneImmersion: turn.register?.sceneImmersion || frame.responseConfiguration?.scene_immersion || null,
        actorialPart: turn.register?.actorialPart || frame.responseConfiguration?.actorial_part || null,
        actorialPartLabel: turn.register?.actorialPartLabel || frame.responseConfiguration?.actorial_part_label || null,
        responseConfiguration: turn.responseConfiguration || frame.responseConfiguration || null,
        responseConfigurationAudit: turn.responseConfigurationAudit || frame.responseConfigurationAudit || null,
        registerPolicy: frame.register?.policy || turn.register?.policy || null,
        registerVector: frame.register?.vector || turn.register?.vector || null,
        registerDistribution: frame.register?.distribution || null,
        registerVectorEntropyBits: frame.register?.vectorEntropyBits ?? turn.register?.vectorEntropyBits ?? null,
        tutorText: turn.tutor || frame.snippets?.tutor || '',
      },
      stateBeforeAction: {
        observation: frame.state?.observation || null,
        learnerText: turn.learner || frame.snippets?.learner || '',
        learnerState: turn.learnerState || frame.state?.classifier || {},
        dag: frame.state?.dag || turn.dag || {},
        field: frame.field || turn.field || {},
        stateVector: frame.dynamics?.stateVector || {},
        derivativeVector: frame.dynamics?.derivativeVector || {},
        trajectory: frame.trajectory || turn.trajectory || {},
        humanDiscourse: frame.humanDiscourse || turn.humanDiscourse || null,
      },
      outcomeAfterNextLearner: nextFrame
        ? {
            nextTurn: nextFrame.turn ?? null,
            dag: nextFrame.state?.dag || {},
            field: nextFrame.field || {},
            stateVector: nextFrame.dynamics?.stateVector || {},
            derivativeVector: nextFrame.dynamics?.derivativeVector || {},
            groundedClosure:
              nextFrame.state?.dag?.bottleneck === 'grounded_asserted_secret' ||
              (nextFrame.state?.dag?.finalSecretEntailed === true && nextFrame.state?.dag?.assertedSecret === true),
          }
        : null,
      response: turn.response || {},
      events: Array.from(new Set([...(frame.events || []), ...(turn.events || [])])).filter(Boolean),
      rewardProxy,
      frame,
      transcriptTurn: turn,
    });
  }
  return {
    schema: 'machinespirits.tutor-stub.turn-training-examples.v1',
    purpose: 'transition_and_reward_modeling',
    turnCount: examples.length,
    examples,
  };
}

function summarizeLearnerBehavior(turnRecords = []) {
  const analyses = turnRecords.map((turn) => turn?.classification?.turn || null).filter(Boolean);
  const conceptualScores = analyses
    .map((turn) => numericScore(turn.scores?.conceptual_engagement))
    .filter((value) => value !== null);
  const readinessScores = analyses
    .map((turn) => numericScore(turn.scores?.epistemic_readiness))
    .filter((value) => value !== null);
  const learnerWords = turnRecords.map((turn) => wordsInText(turn?.learner)).filter((value) => value > 0);
  const firstTurn = turnRecords[0] || {};
  const finalTurn = turnRecords.at(-1) || {};
  const explicitPaceRequests = turnRecords
    .map((turn) => turn?.releasePacing?.signal || null)
    .filter((signal) => signal?.source === 'explicit_learner_request');
  return {
    schema: 'machinespirits.tutor-stub.learner-behavior-summary.v1',
    turnCount: turnRecords.length,
    classifiedTurnCount: analyses.length,
    meanLearnerWords: mean(learnerWords),
    meanConceptualEngagement: mean(conceptualScores),
    meanEpistemicReadiness: mean(readinessScores),
    requestTypeCounts: countBy(analyses.map((turn) => turn.request_type).filter(Boolean)),
    discourseMoveCounts: countBy(analyses.map((turn) => turn.discourse_move).filter(Boolean)),
    evidenceUseCounts: countBy(analyses.map((turn) => turn.evidence_use).filter(Boolean)),
    epistemicStanceCounts: countBy(analyses.map((turn) => turn.epistemic_stance).filter(Boolean)),
    agencyCounts: countBy(analyses.map((turn) => turn.agency).filter(Boolean)),
    affectCounts: countBy(analyses.map((turn) => turn.affect).filter(Boolean)),
    explicitCluePaceRequestCounts: countBy(explicitPaceRequests.map((signal) => signal.direction).filter(Boolean)),
    firstLearner: textSnippet(firstTurn.learner, 220),
    finalLearner: textSnippet(finalTurn.learner, 220),
    firstClassification: textSnippet(firstTurn.classification?.turn?.summary, 220),
    finalClassification: textSnippet(finalTurn.classification?.turn?.summary, 220),
  };
}

function summarizeHumanDiscourse(turnRecords = []) {
  const frames = turnRecords.map((turn) => turn?.humanDiscourseFrame).filter(Boolean);
  if (!frames.length) return null;
  const finalFrame = frames.at(-1) || null;
  const proofDebtCounts = frames.reduce(
    (acc, frame) => {
      acc.open += Number(frame?.proofDebt?.counts?.open || 0);
      acc.harmful += Number(frame?.proofDebt?.counts?.harmful || 0);
      acc.discharged += Number(frame?.proofDebt?.counts?.discharged || 0);
      return acc;
    },
    { open: 0, harmful: 0, discharged: 0 },
  );
  return {
    schema: 'machinespirits.tutor-stub.human-discourse-summary.v1',
    mode: finalFrame?.mode || frames[0]?.mode || null,
    scaffoldActive: frames.some((frame) => frame.scaffoldActive),
    turnCount: frames.length,
    sideArcCount: frames.filter((frame) => frame.sideArc?.detected).length,
    proofDebtCounts,
    finalStatus: finalFrame?.warrantPremiseAudit?.proofStatus || null,
    finalProofDebtStatus: finalFrame?.proofDebt?.status || null,
    finalBranch: finalFrame?.scaffoldState?.branch || null,
    finalFrame,
  };
}

function fieldPolyline(rows, key, { width, height, padding }) {
  if (!rows.length) return '';
  const xSpan = Math.max(1, rows.length - 1);
  return rows
    .map((row, index) => {
      const x = padding.left + (index / xSpan) * width;
      const y = padding.top + (1 - clampField01(row[key])) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function fieldTurnMarkers(rows, { width, height, padding }) {
  if (!rows.length) return '';
  const xSpan = Math.max(1, rows.length - 1);
  return rows
    .map((row, index) => {
      const x = padding.left + (index / xSpan) * width;
      const label = escapeXml(
        `${row.turn}: ${row.learnerMove} / ${row.register || 'no-register'} / ${displayBottleneck(row.bottleneck)}`,
      );
      return `<circle cx="${x.toFixed(1)}" cy="${(padding.top + height + 9).toFixed(
        1,
      )}" r="2.5" fill="#0A0A0A"><title>${label}</title></circle>`;
    })
    .join('\n');
}

function fieldTurnAxis(rows, { width, height, padding }) {
  if (!rows.length) return '';
  const xSpan = Math.max(1, rows.length - 1);
  const tickEvery = Math.max(1, Math.ceil(rows.length / 6));
  const baseline = padding.top + height;
  const ticks = rows
    .map((row, index) => {
      const x = padding.left + (index / xSpan) * width;
      const showLabel = rows.length <= 8 || index === 0 || index === rows.length - 1 || index % tickEvery === 0;
      return [
        `<line x1="${x.toFixed(1)}" y1="${baseline.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(baseline + 7).toFixed(
          1,
        )}" stroke="#0A0A0A" stroke-width="1" />`,
        showLabel
          ? `<text x="${x.toFixed(1)}" y="${(baseline + 22).toFixed(
              1,
            )}" text-anchor="middle" font-size="10" fill="#525252">${escapeXml(row.turn ?? index + 1)}</text>`
          : '',
      ].join('');
    })
    .join('\n');
  return `${ticks}
  <text x="${(padding.left + width / 2).toFixed(1)}" y="${(baseline + 44).toFixed(
    1,
  )}" text-anchor="middle" font-size="11" font-weight="700" fill="#0A0A0A">turns</text>`;
}

function renderLightweightFieldSvg(field, { title = 'Tutor Stub Interaction Field' } = {}) {
  const rows = field?.rows || [];
  const padding = { top: 88, right: 34, bottom: 68, left: 58 };
  const chartWidth = 660;
  const chartHeight = 220;
  const svgWidth = chartWidth + padding.left + padding.right;
  const svgHeight = chartHeight + padding.top + padding.bottom;
  const final = field?.summary?.final || {};
  const delta = field?.summary?.fieldDelta || {};
  const series = [
    ['learnerMastery', 'mastery', '#0A0A0A', ''],
    ['learnerRisk', 'risk', '#E63946', '8 5'],
    ['tutorAlignment', 'alignment', '#0057B8', '2 5'],
    ['jointMomentum', 'momentum', '#D98E04', '12 4 2 4'],
  ];
  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((value) => {
      const y = padding.top + (1 - value) * chartHeight;
      return [
        `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${(padding.left + chartWidth).toFixed(
          1,
        )}" y2="${y.toFixed(1)}" stroke="#D4D4D8" />`,
        `<text x="${padding.left - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#525252">${value.toFixed(
          2,
        )}</text>`,
      ].join('\n');
    })
    .join('\n');
  const lines = series
    .map(
      ([key, label, color, dash]) =>
        `<polyline points="${fieldPolyline(rows, key, {
          width: chartWidth,
          height: chartHeight,
          padding,
        })}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"${
          dash ? ` stroke-dasharray="${dash}"` : ''
        }><title>${label}</title></polyline>`,
    )
    .join('\n');
  const legend = series
    .map(
      ([key, label, color], index) =>
        `<g transform="translate(${padding.left + index * 145}, 62)"><rect width="11" height="11" fill="${color}" stroke="#0A0A0A" /><text x="16" y="10" font-size="11" font-weight="700" fill="#0A0A0A">${label}: ${escapeXml(
          final[key] ?? 'n/a',
        )}</text></g>`,
    )
    .join('\n');
  const riskReduction = Number.isFinite(Number(delta.learnerRisk)) ? -Number(delta.learnerRisk) : Number.NaN;
  const deltaText = `mastery gain ${formatSignedField(delta.learnerMastery)} | risk reduction ${formatPositiveField(
    riskReduction,
  )} | alignment change ${formatSignedField(delta.tutorAlignment)} | momentum change ${formatSignedField(delta.jointMomentum)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img">
  <title>${escapeXml(title)}</title>
  <desc>Lightweight tutor-stub field visualization across ${rows.length} completed turn(s).</desc>
  <rect width="100%" height="100%" fill="#FFFFFF" />
  <rect width="100%" height="8" fill="#E63946" />
  <text x="${padding.left}" y="28" font-size="18" font-weight="700" fill="#0A0A0A">${escapeXml(title)}</text>
  <text x="${padding.left}" y="49" font-size="12" fill="#525252">turns ${field.turnCount}; mean speed ${escapeXml(
    field.summary?.meanSpeed ?? 'n/a',
  )}; ${escapeXml(deltaText)}; status ${escapeXml(displayBottleneck(final.bottleneck))}</text>
  <rect x="${padding.left}" y="${padding.top}" width="${chartWidth}" height="${chartHeight}" fill="#FAFAFA" stroke="#0A0A0A" stroke-width="1.5" />
  ${gridLines}
  ${lines}
  ${fieldTurnAxis(rows, { width: chartWidth, height: chartHeight, padding })}
  ${fieldTurnMarkers(rows, { width: chartWidth, height: chartHeight, padding })}
  ${legend}
</svg>`;
}

function progressBar(completed, total, { width = 28 } = {}) {
  const ratio = total ? Math.max(0, Math.min(1, completed / total)) : 0;
  const filled = Math.round(ratio * width);
  const bar = `${'#'.repeat(filled)}${'-'.repeat(Math.max(0, width - filled))}`;
  return `[${bar}] ${completed}/${total} ${Math.round(ratio * 100)}%`;
}

function printProgress({ completed, total, label = '' }) {
  if (args['no-progress']) return;
  const suffix = label ? ` ${label}` : '';
  console.log(`[auto-eval] ${progressBar(completed, total)}${suffix}`);
}

function printTurnProgress({ completed, total, activeJobs, results }) {
  if (args['no-progress'] || args['dry-run']) return;
  const active = Array.from(activeJobs.values());
  if (!active.length) return;
  const turnCap =
    turnsArg() === 'until-grounded'
      ? positiveInt(args['safety-turns'], '--safety-turns')
      : positiveInt(args.turns, '--turns');
  const completedTurns = results.reduce((sum, result) => {
    const summaries = Array.isArray(result.traceSummaries) ? result.traceSummaries : [];
    return sum + summaries.reduce((inner, summary) => inner + Number(summary.turnCount || 0), 0);
  }, 0);
  const activeSummaries = active.map(summarizeJobProgress);
  const activeTurns = activeSummaries.reduce((sum, summary) => sum + summary.turns, 0);
  const totalTurns = completedTurns + activeTurns;
  const maxTurns = total * turnCap;
  const activeText = activeSummaries
    .map((summary) => {
      const coverage = summary.coverage === null ? '' : ` c${summary.coverage}`;
      const bottleneck = summary.bottleneck ? ` ${displayBottleneck(summary.bottleneck)}` : '';
      const last = summary.lastType ? ` ${summary.lastType}` : '';
      return `${summary.key}:${summary.turns}t${coverage}${bottleneck}${last}`;
    })
    .join(' | ');
  console.log(
    `[auto-eval] ${progressBar(completed, total)} turns ${totalTurns}/${maxTurns} max; active ${active.length}/${total - completed}: ${activeText}`,
  );
}

function readTraceEvents(tracePath) {
  return readSelectedJsonlEventsSync(tracePath, {
    retainTypes: ['turn_complete', 'run_end', 'auto_learner_run_end', 'field_visualization_write'],
    retainErrorTypes: true,
  });
}

function latestTraceFile(traceDir) {
  return listTraceFiles(traceDir).at(-1) || null;
}

function summarizeJobProgress(job) {
  const tracePath = latestTraceFile(job.traceDir);
  if (!tracePath) {
    return {
      key: job.key,
      turns: 0,
      coverage: null,
      bottleneck: '',
      lastType: 'starting',
    };
  }
  const trace = readTraceEvents(tracePath);
  const events = trace.events;
  const turns = events.filter((event) => event.type === 'turn_complete');
  const lastTurn = turns.at(-1)?.turnRecord || {};
  const assessment = lastTurn.tutorLearnerDagModel?.assessment || {};
  return {
    key: job.key,
    turns: turns.length,
    coverage: assessment.bestPathCoverage ?? null,
    bottleneck: assessment.bottleneck || '',
    lastType: trace.lastType || '',
  };
}

function summarizeResultProgress(result) {
  const summary = Array.isArray(result?.traceSummaries) ? result.traceSummaries.at(-1) : null;
  return {
    key: result?.key || `${safeSlug(result?.policy || 'unknown')}-r${result?.runIndex || '?'}`,
    turns: Number(summary?.turnCount || 0),
    coverage: summary?.bestPathCoverage ?? null,
    bottleneck: summary?.bottleneck || '',
    lastType: summary?.stopReason || result?.status || '',
  };
}

function summarizeTrace(
  tracePath,
  traceDir,
  { primaryHorizon = positiveInt(args['primary-horizon'], '--primary-horizon') } = {},
) {
  const trace = readTraceEvents(tracePath);
  const events = trace.events;
  const turns = events.filter((event) => event.type === 'turn_complete');
  const turnRecords = turns.map((event) => event.turnRecord).filter(Boolean);
  const runEnds = events.filter((event) => event.type === 'run_end' || event.type === 'auto_learner_run_end');
  const fieldWrite = events.filter((event) => event.type === 'field_visualization_write').at(-1) || null;
  const fieldViz = buildLightweightDialogueField(turnRecords);
  const animatedViz = buildAnimatedRunVisualization(turnRecords, fieldViz);
  const transcript = buildTranscriptDrilldown(turnRecords, fieldViz);
  const trainingExamples = buildTurnTrainingExamples({ animatedViz, transcript });
  const learnerBehavior = summarizeLearnerBehavior(turnRecords);
  const humanDiscourse = summarizeHumanDiscourse(turnRecords);
  const responseConfigurationVisibility = summarizeTutorStubResponseConfigurationAudits(
    turnRecords.map((turn) => turn.responseConfigurationAudit),
  );
  const characterAdaptation = auditTutorStubCharacterAdaptationTurns(turnRecords);
  const diagnosticCollection = summarizeTutorStubDiagnosticCollection(turnRecords);
  const pointOfActionTurns = turnRecords.map((turn) => turn?.pointOfAction).filter(Boolean);
  const pointOfActionOpportunities = pointOfActionTurns.filter((turn) => turn.assigned_trigger);
  const pointOfActionCompliant = pointOfActionOpportunities.filter(
    (turn) => turn.compliance?.compliant === true,
  ).length;
  const pointOfAction = pointOfActionTurns.length
    ? {
        schema: 'machinespirits.tutor-stub.point-of-action-summary.v1',
        arm: pointOfActionTurns[0]?.arm || null,
        detectorVersion: pointOfActionTurns[0]?.detector_version || null,
        observedTurns: pointOfActionTurns.length,
        opportunities: pointOfActionOpportunities.length,
        triggers: countBy(pointOfActionOpportunities.map((turn) => turn.assigned_trigger)),
        compliant: pointOfActionCompliant,
        complianceRate: pointOfActionOpportunities.length
          ? pointOfActionCompliant / pointOfActionOpportunities.length
          : null,
        turns: pointOfActionTurns,
      }
    : null;
  const dagFactDropout = summarizeTutorStubDagFactDropoutTrace(turnRecords);
  const releasePacingRows = turnRecords.map((turn) => turn.releasePacing).filter(Boolean);
  const finalReleasePacing = releasePacingRows.at(-1) || null;
  const releasePacing = finalReleasePacing
    ? {
        schema: 'machinespirits.tutor-stub.release-pacing-summary.v1',
        baseSpeed: finalReleasePacing.baseSpeed,
        finalEffectiveSpeed: finalReleasePacing.effectiveSpeed,
        directionCounts: countBy(releasePacingRows.map((row) => row.direction).filter(Boolean)),
        explicitRequestCounts: countBy(
          releasePacingRows
            .filter((row) => row.signal?.source === 'explicit_learner_request')
            .map((row) => row.signal.direction),
        ),
        releasedPremiseCount: Number(finalReleasePacing.counts?.released || 0),
        earlyReleaseCount: Number(finalReleasePacing.counts?.early || 0),
        lateReleaseCount: Number(finalReleasePacing.counts?.late || 0),
        authoredTurnReleaseCount: Number(finalReleasePacing.counts?.onAuthoredTurn || 0),
      }
    : null;
  const lastTurn = turns.at(-1)?.turnRecord || {};
  const assessment = lastTurn.tutorLearnerDagModel?.assessment || {};
  const metrics = lastTurn.tutorLearnerDagModel?.metrics || {};
  const registers = turns
    .map(
      (event) =>
        event.turnRecord?.registerSelection?.engagement_stance ||
        event.turnRecord?.registerSelection?.selected_register,
    )
    .filter(Boolean);
  const actionFamilies = turnRecords.map((turn) => turn.registerSelection?.action_family).filter(Boolean);
  const audienceRegisters = turnRecords.map((turn) => turn.registerSelection?.audience_register).filter(Boolean);
  const lexicalAccessibility = turnRecords.map((turn) => turn.registerSelection?.lexical_accessibility).filter(Boolean);
  const sceneImmersion = turnRecords.map((turn) => turn.registerSelection?.scene_immersion).filter(Boolean);
  const actorialParts = turnRecords.map((turn) => turn.registerSelection?.actorial_part).filter(Boolean);
  const efficacies = turns.map((event) => event.turnRecord?.previousRegisterEfficacy?.label).filter(Boolean);
  const leakCount = turns.reduce((sum, event) => {
    const leaks = event.turnRecord?.tutorLeakAudit?.leaks;
    if (Array.isArray(leaks)) return sum + leaks.length;
    return sum + (event.turnRecord?.tutorLeakAudit?.ok === false ? 1 : 0);
  }, 0);
  const guardRows = turnRecords.map((turn) => turn.tutorGuardAccounting).filter(Boolean);
  const originalCandidateAcceptedTurns = guardRows.filter(
    (row) => row.finalDelivery?.source === 'original_candidate',
  ).length;
  const strictOriginalCandidateAcceptedTurns = guardRows.filter(tutorStubStrictOriginalCandidateAccepted).length;
  const totalTutorGenerationLatencyMs = guardRows.reduce(
    (sum, row) => sum + Number(row.generation?.totalModelLatencyMs || 0),
    0,
  );
  const totalOriginalCandidateLatencyMs = guardRows.reduce(
    (sum, row) => sum + Number(row.generation?.originalCandidateLatencyMs || 0),
    0,
  );
  const guardAccounting = {
    schema: 'machinespirits.tutor-stub.guard-accounting-summary.v1',
    turns: turnRecords.length,
    accountedTurns: guardRows.length,
    guardTriggeredTurns: guardRows.filter(
      (row) =>
        (row.originalCandidate?.guardedSpans || []).length > 0 ||
        (row.attempts || []).some((attempt) => attempt.auditOk === false),
    ).length,
    guardedSpanCount: guardRows.reduce((sum, row) => sum + Number(row.originalCandidate?.guardedSpans?.length || 0), 0),
    originalCandidateAcceptedTurns,
    originalCandidateAcceptanceRate: guardRows.length
      ? Number((originalCandidateAcceptedTurns / guardRows.length).toFixed(4))
      : null,
    strictOriginalCandidateAcceptedTurns,
    strictOriginalCandidateAcceptanceRate: guardRows.length
      ? Number((strictOriginalCandidateAcceptedTurns / guardRows.length).toFixed(4))
      : null,
    mechanicalRepairTurns: guardRows.filter(
      (row) =>
        row.finalDelivery?.source !== 'original_candidate' &&
        (row.repairsApplied || []).some((repair) => String(repair.kind || '').startsWith('mechanical_')),
    ).length,
    modelRepairTurns: guardRows.filter((row) =>
      (row.repairsApplied || []).some((repair) => ['model_rewrite', 'model_plain_recovery'].includes(repair.kind)),
    ).length,
    repairActionCount: guardRows.reduce((sum, row) => sum + Number(row.repairsApplied?.length || 0), 0),
    deterministicFallbackTurns: guardRows.filter((row) => row.finalDelivery?.deterministicFallback === true).length,
    finalDeliveryAuditFailures: guardRows.filter((row) => row.finalDelivery?.auditOk === false).length,
    totalTutorGenerationLatencyMs,
    meanTutorGenerationLatencyMs: guardRows.length ? totalTutorGenerationLatencyMs / guardRows.length : null,
    totalOriginalCandidateLatencyMs,
    meanOriginalCandidateLatencyMs: guardRows.length ? totalOriginalCandidateLatencyMs / guardRows.length : null,
  };
  const fixedHorizon = summarizeTutorStubFixedHorizon(turnRecords, { primaryHorizon });
  const groundedClosure = Boolean(
    assessment.bottleneck === 'grounded_asserted_secret' ||
    (assessment.finalSecretEntailed === true && assessment.assertedSecret === true),
  );
  const modelErrors = events.filter((event) => /error/i.test(String(event.type)));
  return {
    trace: path.relative(ROOT, tracePath),
    traceRelative: path.relative(traceDir, tracePath),
    events: trace.eventCount,
    turnCount: turns.length,
    lastTurn: turns.at(-1)?.turn ?? null,
    stopReason: runEnds.at(-1)?.reason || null,
    groundedClosure,
    bestPathCoverage: Number(assessment.bestPathCoverage ?? 0),
    missingPremiseCount: Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0),
    bottleneck: assessment.bottleneck || 'unknown',
    finalLearner: lastTurn.learner || '',
    finalTutor: lastTurn.tutor || '',
    registerCounts: countBy(registers),
    registerEntropy: entropy(registers),
    engagementStanceCounts: countBy(registers),
    engagementStanceEntropy: entropy(registers),
    actionFamilyCounts: countBy(actionFamilies),
    audienceRegisterCounts: countBy(audienceRegisters),
    lexicalAccessibilityCounts: countBy(lexicalAccessibility),
    sceneImmersionCounts: countBy(sceneImmersion),
    actorialPartCounts: countBy(actorialParts),
    responseConfigurationVisibility,
    characterAdaptation,
    diagnosticCollection,
    pointOfAction,
    dagFactDropout,
    releasePacing,
    efficacyCounts: countBy(efficacies),
    leakCount,
    guardAccounting,
    fixedHorizon,
    repairedCount: turns.filter((event) => event.turnRecord?.tutorResponseRepaired).length,
    fallbackCount: turns.filter((event) => event.turnRecord?.tutorDeterministicFallback).length,
    errorCount: modelErrors.length,
    field: fieldViz.turnCount
      ? {
          final: fieldViz.summary.final || null,
          delta: fieldViz.summary.fieldDelta || null,
          meanSpeed: fieldViz.summary.meanSpeed ?? null,
          source: fieldWrite?.summary ? 'trace_event' : 'reconstructed',
        }
      : fieldWrite?.summary
        ? {
            final: fieldWrite.summary.final || null,
            delta: fieldWrite.summary.fieldDelta || null,
            meanSpeed: fieldWrite.summary.meanSpeed ?? null,
            source: 'trace_event',
          }
        : null,
    fieldViz: fieldViz.turnCount ? fieldViz : null,
    animatedViz,
    transcript,
    trainingExamples,
    learnerBehavior,
    humanDiscourse,
  };
}

function resolveTracePath(tracePath, traceDir) {
  if (!tracePath) return null;
  if (path.isAbsolute(tracePath)) return tracePath;
  const fromTraceDir = path.join(traceDir, tracePath);
  if (fs.existsSync(fromTraceDir)) return fromTraceDir;
  return path.join(ROOT, tracePath);
}

function resultRows(results, { plannedJobs = [], primaryHorizon } = {}) {
  const horizon = positiveInt(primaryHorizon || args['primary-horizon'], '--primary-horizon');
  const sourceResults = Array.isArray(results) ? [...results] : [];
  const completedKeys = new Set(sourceResults.map((result) => result.key).filter(Boolean));
  for (const job of plannedJobs || []) {
    const key = job.key || job.id;
    if (!key || completedKeys.has(key) || !job.policy) continue;
    sourceResults.push({
      key,
      policy: job.policy,
      runIndex: Number(job.runIndex || job.repeat || 0) || null,
      status: 'missing',
      exitCode: null,
      signal: null,
      traces: [],
      traceSummaries: [],
      log: job.logPath ? path.relative(ROOT, job.logPath) : null,
    });
  }
  return sourceResults.flatMap((result) => {
    const summaries = Array.isArray(result.traceSummaries) ? result.traceSummaries : [];
    if (!summaries.length) {
      return [
        {
          policy: result.policy,
          runIndex: result.runIndex,
          status: result.status,
          exitCode: result.exitCode ?? null,
          signal: result.signal || null,
          trace: null,
          log: result.log || null,
          turnCount: 0,
          groundedClosure: false,
          bestPathCoverage: 0,
          missingPremiseCount: null,
          bottleneck: 'none',
          stopReason: result.status,
          registerCounts: {},
          registerEntropy: 0,
          efficacyCounts: {},
          leakCount: 0,
          fixedHorizon: tutorStubMissingFixedHorizonOutcome(horizon),
          repairedCount: 0,
          fallbackCount: 0,
          errorCount: 0,
          field: null,
          fieldViz: null,
          animatedViz: null,
          transcript: null,
          trainingExamples: null,
          learnerBehavior: null,
        },
      ];
    }
    return summaries.map((summary) => ({
      policy: result.policy,
      runIndex: result.runIndex,
      status: result.status,
      exitCode: result.exitCode ?? null,
      signal: result.signal || null,
      log: result.log || null,
      ...summary,
    }));
  });
}

function summarizeRows(rows) {
  const liveRows = rows.filter((row) => row.status !== 'dry_run');
  const completed = liveRows.filter((row) => row.status === 'ok' || row.status === 'failed');
  const scored = liveRows.filter((row) => row.status === 'ok');
  const scoredRegisters = scored.flatMap((row) =>
    Object.entries(row.registerCounts || {}).flatMap(([register, count]) =>
      Array.from({ length: count }, () => register),
    ),
  );
  const scoredActorialParts = scored.flatMap((row) =>
    Object.entries(row.actorialPartCounts || {}).flatMap(([part, count]) => Array.from({ length: count }, () => part)),
  );
  const byPolicy = {};
  for (const row of rows) {
    if (!byPolicy[row.policy]) byPolicy[row.policy] = [];
    byPolicy[row.policy].push(row);
  }
  const summarizeBucket = (bucketRows) => {
    const liveRows = bucketRows.filter((row) => row.status !== 'dry_run');
    const okRows = liveRows.filter((row) => row.status === 'ok');
    const registers = okRows.flatMap((row) =>
      Object.entries(row.registerCounts || {}).flatMap(([register, count]) =>
        Array.from({ length: count }, () => register),
      ),
    );
    const actorialParts = okRows.flatMap((row) =>
      Object.entries(row.actorialPartCounts || {}).flatMap(([part, count]) =>
        Array.from({ length: count }, () => part),
      ),
    );
    return {
      rows: bucketRows.length,
      ok: okRows.length,
      failed: liveRows.filter((row) => row.status === 'failed').length,
      missing: liveRows.filter((row) => row.status === 'missing').length,
      dryRun: bucketRows.filter((row) => row.status === 'dry_run').length,
      grounded: okRows.filter((row) => row.groundedClosure).length,
      groundedRate: okRows.length
        ? Number((okRows.filter((row) => row.groundedClosure).length / okRows.length).toFixed(3))
        : 0,
      meanTurns: mean(okRows.map((row) => row.turnCount)),
      meanCoverage: mean(okRows.map((row) => row.bestPathCoverage)),
      meanMissing: mean(okRows.map((row) => row.missingPremiseCount)),
      meanFieldMasteryDelta: mean(okRows.map((row) => row.field?.delta?.learnerMastery)),
      meanFieldRiskDelta: mean(okRows.map((row) => row.field?.delta?.learnerRisk)),
      registerCounts: countBy(registers),
      registerEntropy: entropy(registers),
      actorialPartCounts: countBy(actorialParts),
      actorialPartEntropy: entropy(actorialParts),
      meanConfigurationRealization: mean(
        okRows
          .map((row) => row.responseConfigurationVisibility?.mean_realization_rate)
          .filter((value) => value !== null && value !== undefined),
      ),
      meanConfigurationVisibleDifference: meanOrNull(
        okRows
          .map((row) => row.responseConfigurationVisibility?.pairwise_visible_difference_rate)
          .filter((value) => value !== null && value !== undefined),
      ),
      leakCount: okRows.reduce((sum, row) => sum + Number(row.leakCount || 0), 0),
      guardTriggeredTurns: okRows.reduce((sum, row) => sum + Number(row.guardAccounting?.guardTriggeredTurns || 0), 0),
      originalCandidateAcceptedTurns: okRows.reduce(
        (sum, row) => sum + Number(row.guardAccounting?.originalCandidateAcceptedTurns || 0),
        0,
      ),
      strictOriginalCandidateAcceptedTurns: okRows.reduce(
        (sum, row) => sum + Number(row.guardAccounting?.strictOriginalCandidateAcceptedTurns || 0),
        0,
      ),
      mechanicalRepairTurns: okRows.reduce(
        (sum, row) => sum + Number(row.guardAccounting?.mechanicalRepairTurns || 0),
        0,
      ),
      modelRepairTurns: okRows.reduce((sum, row) => sum + Number(row.guardAccounting?.modelRepairTurns || 0), 0),
      deterministicFallbackTurns: okRows.reduce(
        (sum, row) => sum + Number(row.guardAccounting?.deterministicFallbackTurns || 0),
        0,
      ),
      guardedSpanCount: okRows.reduce((sum, row) => sum + Number(row.guardAccounting?.guardedSpanCount || 0), 0),
      finalDeliveryAuditFailures: okRows.reduce(
        (sum, row) => sum + Number(row.guardAccounting?.finalDeliveryAuditFailures || 0),
        0,
      ),
      totalTutorGenerationLatencyMs: okRows.reduce(
        (sum, row) => sum + Number(row.guardAccounting?.totalTutorGenerationLatencyMs || 0),
        0,
      ),
      errorCount: okRows.reduce((sum, row) => sum + Number(row.errorCount || 0), 0),
      ...summarizeTutorStubFixedHorizonRows(liveRows),
    };
  };
  return {
    rows: rows.length,
    completed: completed.length,
    ok: scored.length,
    failed: completed.filter((row) => row.status === 'failed').length,
    missing: liveRows.filter((row) => row.status === 'missing').length,
    dryRun: rows.filter((row) => row.status === 'dry_run').length,
    grounded: scored.filter((row) => row.groundedClosure).length,
    groundedRate: scored.length
      ? Number((scored.filter((row) => row.groundedClosure).length / scored.length).toFixed(3))
      : 0,
    meanTurns: mean(scored.map((row) => row.turnCount)),
    meanCoverage: mean(scored.map((row) => row.bestPathCoverage)),
    meanMissing: mean(scored.map((row) => row.missingPremiseCount)),
    registerCounts: countBy(scoredRegisters),
    registerEntropy: entropy(scoredRegisters),
    actorialPartCounts: countBy(scoredActorialParts),
    actorialPartEntropy: entropy(scoredActorialParts),
    meanConfigurationRealization: mean(
      scored
        .map((row) => row.responseConfigurationVisibility?.mean_realization_rate)
        .filter((value) => value !== null && value !== undefined),
    ),
    meanConfigurationVisibleDifference: meanOrNull(
      scored
        .map((row) => row.responseConfigurationVisibility?.pairwise_visible_difference_rate)
        .filter((value) => value !== null && value !== undefined),
    ),
    leakCount: scored.reduce((sum, row) => sum + Number(row.leakCount || 0), 0),
    guardTriggeredTurns: scored.reduce((sum, row) => sum + Number(row.guardAccounting?.guardTriggeredTurns || 0), 0),
    originalCandidateAcceptedTurns: scored.reduce(
      (sum, row) => sum + Number(row.guardAccounting?.originalCandidateAcceptedTurns || 0),
      0,
    ),
    strictOriginalCandidateAcceptedTurns: scored.reduce(
      (sum, row) => sum + Number(row.guardAccounting?.strictOriginalCandidateAcceptedTurns || 0),
      0,
    ),
    mechanicalRepairTurns: scored.reduce(
      (sum, row) => sum + Number(row.guardAccounting?.mechanicalRepairTurns || 0),
      0,
    ),
    modelRepairTurns: scored.reduce((sum, row) => sum + Number(row.guardAccounting?.modelRepairTurns || 0), 0),
    deterministicFallbackTurns: scored.reduce(
      (sum, row) => sum + Number(row.guardAccounting?.deterministicFallbackTurns || 0),
      0,
    ),
    guardedSpanCount: scored.reduce((sum, row) => sum + Number(row.guardAccounting?.guardedSpanCount || 0), 0),
    finalDeliveryAuditFailures: scored.reduce(
      (sum, row) => sum + Number(row.guardAccounting?.finalDeliveryAuditFailures || 0),
      0,
    ),
    totalTutorGenerationLatencyMs: scored.reduce(
      (sum, row) => sum + Number(row.guardAccounting?.totalTutorGenerationLatencyMs || 0),
      0,
    ),
    errorCount: scored.reduce((sum, row) => sum + Number(row.errorCount || 0), 0),
    ...summarizeTutorStubFixedHorizonRows(liveRows),
    byPolicy: Object.fromEntries(
      Object.entries(byPolicy).map(([policy, bucketRows]) => [policy, summarizeBucket(bucketRows)]),
    ),
  };
}

function pctBar(value, { max = 1 } = {}) {
  const ratio = max ? Math.max(0, Math.min(1, Number(value || 0) / max)) : 0;
  return `<span class="mini-bar"><span style="width:${Math.round(ratio * 100)}%"></span></span>`;
}

function htmlMetric(label, value, sub = '') {
  return `<div class="metric"><div class="metric-label">${escapeHtml(label)}</div><div class="metric-value">${escapeHtml(value)}</div><div class="metric-sub">${escapeHtml(sub)}</div></div>`;
}

function htmlMetricInfo(label, tooltip, value, sub = '') {
  return `<div class="metric"><div class="metric-label">${infoTerm(label, tooltip)}</div><div class="metric-value">${escapeHtml(value)}</div><div class="metric-sub">${escapeHtml(sub)}</div></div>`;
}

function hrefRelative(fromDir, targetPath) {
  return path.relative(fromDir, targetPath).split(path.sep).join('/');
}

function formatFieldValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(3) : 'n/a';
}

function fieldSummaryText(row) {
  const final = row.field?.final || {};
  const delta = row.field?.delta || {};
  const riskReduction = Number.isFinite(Number(delta.learnerRisk)) ? -Number(delta.learnerRisk) : Number.NaN;
  return [
    `final mastery ${formatFieldValue(final.learnerMastery)}`,
    `risk ${formatFieldValue(final.learnerRisk)}`,
    `alignment ${formatFieldValue(final.tutorAlignment)}`,
    `momentum ${formatFieldValue(final.jointMomentum)}`,
    `mastery gain ${formatSignedField(delta.learnerMastery)}`,
    `risk reduction ${formatPositiveField(riskReduction)}`,
    `status ${displayBottleneck(final.bottleneck || row.bottleneck, { groundedClosure: row.groundedClosure })}`,
  ].join(' · ');
}

function fieldRowTitle(row) {
  return `${row.policy} run ${row.runIndex}`;
}

function learnerProfileFromSummary(summary = {}) {
  const config = summary.config || {};
  const id = String(config.autoLearnerProfileId || '').trim();
  const builtInDescription = learnerProfileDescription(id);
  const commandProfile = (summary.results || [])
    .map((result) => (Array.isArray(result.command) ? flagValue(result.command, '--auto-learner-profile') : null))
    .find(Boolean);
  const description = builtInDescription || commandProfile || '';
  return {
    id: id || (description ? 'custom' : 'unknown'),
    source: builtInDescription ? 'built-in contract' : description ? 'custom' : 'unknown',
    description,
    model: config.autoLearnerModel || null,
  };
}

function aggregateLearnerBehavior(rows = []) {
  const behaviors = rows.map((row) => row.learnerBehavior).filter(Boolean);
  if (!behaviors.length) return null;
  return {
    rowCount: behaviors.length,
    turnCount: behaviors.reduce((sum, behavior) => sum + Number(behavior.turnCount || 0), 0),
    classifiedTurnCount: behaviors.reduce((sum, behavior) => sum + Number(behavior.classifiedTurnCount || 0), 0),
    meanLearnerWords: mean(behaviors.map((behavior) => behavior.meanLearnerWords)),
    meanConceptualEngagement: mean(behaviors.map((behavior) => behavior.meanConceptualEngagement)),
    meanEpistemicReadiness: mean(behaviors.map((behavior) => behavior.meanEpistemicReadiness)),
    requestTypeCounts: mergeCounts(behaviors.map((behavior) => behavior.requestTypeCounts)),
    discourseMoveCounts: mergeCounts(behaviors.map((behavior) => behavior.discourseMoveCounts)),
    evidenceUseCounts: mergeCounts(behaviors.map((behavior) => behavior.evidenceUseCounts)),
    epistemicStanceCounts: mergeCounts(behaviors.map((behavior) => behavior.epistemicStanceCounts)),
    agencyCounts: mergeCounts(behaviors.map((behavior) => behavior.agencyCounts)),
    affectCounts: mergeCounts(behaviors.map((behavior) => behavior.affectCounts)),
    examples: behaviors
      .map((behavior, index) => ({
        label: `run ${index + 1}`,
        firstLearner: behavior.firstLearner,
        finalLearner: behavior.finalLearner,
        firstClassification: behavior.firstClassification,
        finalClassification: behavior.finalClassification,
      }))
      .filter((example) => example.firstLearner || example.finalLearner)
      .slice(0, 3),
  };
}

function renderCountChips(counts, { limit = 6 } = {}) {
  const entries = Object.entries(counts || {})
    .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))
    .slice(0, limit);
  if (!entries.length) return '<span class="learner-empty">none</span>';
  return entries
    .map(([key, value]) => `<span class="learner-chip">${escapeHtml(key)} <b>${escapeHtml(value)}</b></span>`)
    .join('');
}

function learnerStat(label, value, sub = '') {
  return `<div class="learner-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><em>${escapeHtml(sub)}</em></div>`;
}

function renderLearnerProfileSection(summary, rows) {
  const profile = learnerProfileFromSummary(summary);
  const behavior = aggregateLearnerBehavior(rows);
  const description = profile.description || 'No automated learner profile text was preserved in this summary.';
  const examples = behavior?.examples?.length
    ? `<div class="learner-examples">
        ${behavior.examples
          .map(
            (example) => `<div class="learner-example">
              <div class="learner-example-label">${escapeHtml(example.label)}</div>
              <div><strong>Opening:</strong> ${escapeHtml(example.firstClassification || example.firstLearner || '')}</div>
              <div><strong>Final:</strong> ${escapeHtml(example.finalClassification || example.finalLearner || '')}</div>
            </div>`,
          )
          .join('\n')}
      </div>`
    : '';
  return `<section class="learner-panel">
    <div class="learner-profile-card">
      <div class="learner-eyebrow">Automated learner</div>
      <h3>${escapeHtml(profile.id)}</h3>
      <p>${escapeHtml(description)}</p>
      <dl>
        <div><dt>source</dt><dd>${escapeHtml(profile.source)}</dd></div>
        <div><dt>model</dt><dd>${escapeHtml(profile.model || 'unknown')}</dd></div>
      </dl>
    </div>
    <div class="learner-behavior-card">
      <div class="learner-eyebrow">Observed behavior</div>
      <div class="learner-score-grid">
        ${learnerStat('Turns', behavior?.turnCount ?? 0, `${behavior?.classifiedTurnCount ?? 0} classified`)}
        ${learnerStat('Words/Turn', behavior?.meanLearnerWords ?? 0, 'mean learner length')}
        ${learnerStat('Conceptual', behavior?.meanConceptualEngagement ?? 0, 'mean 1-5 score')}
        ${learnerStat('Readiness', behavior?.meanEpistemicReadiness ?? 0, 'mean 1-5 score')}
      </div>
      <div class="learner-chip-grid">
        <div><strong>Moves</strong>${renderCountChips(behavior?.discourseMoveCounts)}</div>
        <div><strong>Stance</strong>${renderCountChips(behavior?.epistemicStanceCounts)}</div>
        <div><strong>Evidence</strong>${renderCountChips(behavior?.evidenceUseCounts)}</div>
        <div><strong>Agency</strong>${renderCountChips(behavior?.agencyCounts)}</div>
        <div><strong>Requests</strong>${renderCountChips(behavior?.requestTypeCounts)}</div>
      </div>
      ${examples}
    </div>
  </section>`;
}

function fieldSvgDirForReport(htmlPath) {
  const ext = path.extname(htmlPath);
  const stem = path.basename(htmlPath, ext || '.html');
  return path.join(path.dirname(htmlPath), `${stem}-field-svg`);
}

function fieldSvgFilename(row, index) {
  const traceStem = row.trace ? path.basename(row.trace, path.extname(row.trace)) : '';
  const bits = [
    String(index + 1).padStart(2, '0'),
    safeSlug(row.policy || 'policy'),
    `r${safeSlug(row.runIndex || 'x')}`,
    safeSlug(traceStem).slice(0, 42),
  ].filter(Boolean);
  return `${bits.join('-')}.svg`;
}

function writeFieldSvgArtifacts({ rows, htmlPath }) {
  if (!htmlPath) return [];
  const fieldRows = rows.filter((row) => row.fieldViz?.rows?.length);
  if (!fieldRows.length) return [];
  const svgDir = fieldSvgDirForReport(htmlPath);
  fs.mkdirSync(svgDir, { recursive: true });
  return fieldRows.map((row, index) => {
    const svgPath = path.join(svgDir, fieldSvgFilename(row, index));
    fs.writeFileSync(svgPath, `${renderLightweightFieldSvg(row.fieldViz, { title: fieldRowTitle(row) })}\n`);
    row.fieldSvg = {
      path: path.relative(ROOT, svgPath),
      href: path.relative(path.dirname(htmlPath), svgPath),
    };
    return svgPath;
  });
}

function transcriptRowId(row, index) {
  return reportRowId(row, index, 'transcript', safeSlug);
}

function transcriptReportPayload(rows) {
  return {
    schema: 'machinespirits.tutor-stub.report-transcripts.v1',
    rows: rows.flatMap((row, index) =>
      row.transcript?.turns?.length
        ? [
            {
              id: transcriptRowId(row, index),
              title: fieldRowTitle(row),
              policy: row.policy,
              runIndex: row.runIndex,
              status: row.status,
              groundedClosure: row.groundedClosure,
              stopReason: row.stopReason || null,
              turnCount: row.turnCount,
              trace: row.trace || null,
              transcript: row.transcript,
            },
          ]
        : [],
    ),
  };
}

const REPORT_TERM_TOOLTIPS = {
  ok: 'Rows that completed without a technical failure. Dry-run rows are configuration checks and failed rows are excluded from most means.',
  grounded:
    'Rows where the learner reached grounded asserted-secret closure: the final secret was asserted and entailed by grounded evidence in the learner-DAG.',
  meanTurns: 'Mean number of learner turns used by OK rows before grounded closure or another stop condition.',
  meanCoverage:
    'Mean learner-DAG best-path coverage across OK rows. It is a 0 to 1 score for how much of the target evidence path is grounded.',
  meanMissing:
    'Mean count of still-missing premises on the learner-DAG best path at the end of OK rows. Lower is better.',
  dagFactDropout:
    'Accumulated learner-DAG premise-loss audit: configured rate, eligible fact-turn opportunities, premises dropped, premises explicitly re-adopted, and premises still dropped at the end.',
  masteryDelta:
    'Mean change in the reconstructed learner-mastery field from first to final turn for OK rows. Higher gain is better.',
  riskDelta:
    'Risk reduction is the fall in reconstructed learner risk from first to final turn. Positive values mean risk went down.',
  topRegisters: 'Most frequently selected tutor engagement stances in the OK rows for this policy.',
  entropy:
    'Shannon entropy in bits over selected engagement stances for OK rows. 0 means one stance dominated; higher means more stance diversity.',
  bottleneck:
    'The final learner-DAG limiting condition. Grounded asserted-secret closure is displayed as closed rather than as a remaining bottleneck.',
  fieldDelta: 'Compact field movement: learner mastery gain and learner risk reduction from first to final turn.',
  efficacy: 'Counts of engagement-stance efficacy labels emitted by the policy or classifier.',
  leaks: 'Tutor leak audit count: places where the tutor appears to reveal or overgive protected solution information.',
};

function reportInfoTerm(key, label) {
  return infoTerm(label, REPORT_TERM_TOOLTIPS[key] || label);
}

function formatDagFactDropoutSummary(value) {
  if (!value || value.configuredRate === null || value.configuredRate === undefined) return 'not recorded';
  return `${Math.round(Number(value.configuredRate || 0) * 100)}% · ${Number(value.eligibleOpportunities || 0)} eligible · ${Number(value.dropped || 0)} dropped / ${Number(value.repaired || 0)} re-adopted · ${Number(value.activeAtEnd || 0)} active at end`;
}

function categoricalEntropy(values = []) {
  const present = values.map((value) => String(value || '').trim()).filter(Boolean);
  return entropy(present);
}

function normalizedMutualInformation(pairs = []) {
  const valid = pairs.filter(([left, right]) => left && right);
  if (valid.length < 2) return 0;
  const leftCounts = countBy(valid.map(([left]) => left));
  const rightCounts = countBy(valid.map(([, right]) => right));
  const jointCounts = countBy(valid.map(([left, right]) => `${left}\u241f${right}`));
  const total = valid.length;
  let mutualInformation = 0;
  for (const [jointKey, jointCount] of Object.entries(jointCounts)) {
    const [left, right] = jointKey.split('\u241f');
    const jointProbability = jointCount / total;
    const independentProbability = (Number(leftCounts[left] || 0) / total) * (Number(rightCounts[right] || 0) / total);
    if (jointProbability > 0 && independentProbability > 0) {
      mutualInformation += jointProbability * Math.log2(jointProbability / independentProbability);
    }
  }
  const denominator = Math.max(
    categoricalEntropy(valid.map(([left]) => left)),
    categoricalEntropy(valid.map(([, right]) => right)),
  );
  return denominator > 0 ? roundField(mutualInformation / denominator) : 0;
}

function adaptationStateKey(example = {}) {
  const state = example.stateBeforeAction?.learnerState || {};
  const dag = example.stateBeforeAction?.dag || {};
  return [
    state.requestType || state.discourseMove || 'unknown_move',
    state.evidenceUse || state.epistemicStance || 'unknown_evidence',
    dag.bottleneck || 'unknown_bottleneck',
  ].join('|');
}

function adaptationPolicyMetrics(policyRows = [], safetyTurns = 120) {
  const liveRows = policyRows.filter((row) => row.status !== 'dry_run');
  const okRows = liveRows.filter((row) => row.status === 'ok');
  const examples = okRows.flatMap((row) => row.trainingExamples?.examples || []);
  const transitions = examples.filter((example) => Number.isFinite(Number(example.rewardProxy?.score)));
  const rewards = transitions.map((example) => Number(example.rewardProxy.score));
  const registers = examples.map((example) => example.action?.selectedRegister).filter(Boolean);
  const fallbackRegisters = okRows.flatMap((row) =>
    Object.entries(row.registerCounts || {}).flatMap(([register, count]) =>
      Array.from({ length: Number(count || 0) }, () => register),
    ),
  );
  const observedRegisters = registers.length ? registers : fallbackRegisters;
  const actorialParts = examples.map((example) => example.action?.actorialPart).filter(Boolean);
  const fallbackActorialParts = okRows.flatMap((row) =>
    Object.entries(row.actorialPartCounts || {}).flatMap(([part, count]) =>
      Array.from({ length: Number(count || 0) }, () => part),
    ),
  );
  const observedActorialParts = actorialParts.length ? actorialParts : fallbackActorialParts;
  const stateActionPairs = examples
    .map((example) => [adaptationStateKey(example), example.action?.selectedRegister || ''])
    .filter(([, register]) => register);
  const statePartPairs = examples
    .map((example) => [adaptationStateKey(example), example.action?.actorialPart || ''])
    .filter(([, part]) => part);
  const closureRate = okRows.length ? okRows.filter((row) => row.groundedClosure).length / okRows.length : null;
  const meanTurns = mean(okRows.map((row) => row.turnCount));
  const meanCoverage = mean(okRows.map((row) => row.bestPathCoverage));
  const masteryGain = mean(okRows.map((row) => row.field?.delta?.learnerMastery));
  const riskReduction = mean(okRows.map((row) => -Number(row.field?.delta?.learnerRisk)));
  const leakCount = okRows.reduce((sum, row) => sum + Number(row.leakCount || 0), 0);
  const guardTurns = okRows.reduce((sum, row) => sum + Number(row.turnCount || 0), 0);
  const guardTriggeredTurns = okRows.reduce(
    (sum, row) => sum + Number(row.guardAccounting?.guardTriggeredTurns || 0),
    0,
  );
  const modelRepairTurns = okRows.reduce((sum, row) => sum + Number(row.guardAccounting?.modelRepairTurns || 0), 0);
  const originalCandidateAcceptedTurns = okRows.reduce(
    (sum, row) => sum + Number(row.guardAccounting?.originalCandidateAcceptedTurns || 0),
    0,
  );
  const strictOriginalCandidateAcceptedTurns = okRows.reduce(
    (sum, row) => sum + Number(row.guardAccounting?.strictOriginalCandidateAcceptedTurns || 0),
    0,
  );
  const mechanicalRepairTurns = okRows.reduce(
    (sum, row) => sum + Number(row.guardAccounting?.mechanicalRepairTurns || 0),
    0,
  );
  const deterministicFallbackTurns = okRows.reduce(
    (sum, row) => sum + Number(row.guardAccounting?.deterministicFallbackTurns || 0),
    0,
  );
  const totalTutorGenerationLatencyMs = okRows.reduce(
    (sum, row) => sum + Number(row.guardAccounting?.totalTutorGenerationLatencyMs || 0),
    0,
  );
  const positiveTransitions = rewards.filter((score) => score > 0.005).length;
  const negativeTransitions = rewards.filter((score) => score < -0.005).length;
  return {
    policy: policyRows[0]?.policy || 'unknown',
    rows: policyRows.length,
    ok: okRows.length,
    failed: liveRows.filter((row) => row.status === 'failed').length,
    missing: liveRows.filter((row) => row.status === 'missing').length,
    outcome: {
      closureRate: closureRate === null ? null : roundField(closureRate),
      meanCoverage,
      meanTurns,
      masteryGain,
      riskReduction,
      leakCount,
      guardTriggeredTurns,
      originalCandidateAcceptedTurns,
      originalCandidateAcceptanceRate: guardTurns ? roundField(originalCandidateAcceptedTurns / guardTurns) : null,
      strictOriginalCandidateAcceptedTurns,
      strictOriginalCandidateAcceptanceRate: guardTurns
        ? roundField(strictOriginalCandidateAcceptedTurns / guardTurns)
        : null,
      mechanicalRepairTurns,
      modelRepairTurns,
      deterministicFallbackTurns,
      totalTutorGenerationLatencyMs,
      meanTutorGenerationLatencyMs: guardTurns ? roundField(totalTutorGenerationLatencyMs / guardTurns) : null,
      guardExposureRate: guardTurns ? roundField(guardTriggeredTurns / guardTurns) : null,
      repairRate: guardTurns ? roundField(modelRepairTurns / guardTurns) : null,
      deterministicFallbackRate: guardTurns ? roundField(deterministicFallbackTurns / guardTurns) : null,
      turnEfficiency: Number.isFinite(Number(meanTurns))
        ? roundField(clampField01(1 - Number(meanTurns) / safetyTurns))
        : null,
    },
    variation: {
      registerEntropyBits: categoricalEntropy(observedRegisters),
      distinctRegisters: new Set(observedRegisters).size,
      observations: observedRegisters.length,
      actorialPartEntropyBits: categoricalEntropy(observedActorialParts),
      distinctActorialParts: new Set(observedActorialParts).size,
      actorialPartObservations: observedActorialParts.length,
    },
    contingency: {
      normalizedMutualInformation: normalizedMutualInformation(stateActionPairs),
      stateActionObservations: stateActionPairs.length,
      distinctStates: new Set(stateActionPairs.map(([state]) => state)).size,
      actorialPartNormalizedMutualInformation: normalizedMutualInformation(statePartPairs),
      statePartObservations: statePartPairs.length,
    },
    consequence: {
      transitionCount: transitions.length,
      positiveTransitions,
      neutralTransitions: Math.max(0, transitions.length - positiveTransitions - negativeTransitions),
      negativeTransitions,
      positiveRate: transitions.length ? roundField(positiveTransitions / transitions.length) : null,
      meanRewardProxy: rewards.length ? mean(rewards) : null,
    },
    validity: {
      technical:
        liveRows.length && liveRows.every((row) => row.status === 'ok')
          ? 'pass'
          : liveRows.length
            ? 'attention'
            : 'pending',
      transitionEvidence: transitions.length >= 3 ? 'pass' : 'pending',
      exploratory: true,
    },
  };
}

function adaptationEvidenceForRows(rows = [], summary = {}) {
  const byPolicy = new Map();
  for (const row of rows) {
    const key = row.policy || 'unknown';
    if (!byPolicy.has(key)) byPolicy.set(key, []);
    byPolicy.get(key).push(row);
  }
  const safetyTurns = Number(summary.config?.safetyTurns || 120) || 120;
  const policies = [...byPolicy.values()].map((policyRows) => adaptationPolicyMetrics(policyRows, safetyTurns));
  const declaredBaseline = summary.config?.baselinePolicy || summary.qaMatrix?.baselinePolicy;
  const baselinePolicy =
    declaredBaseline || (policies.some((row) => row.policy === 'bland') ? 'bland' : policies[0]?.policy || '');
  const baseline = policies.find((row) => row.policy === baselinePolicy) || null;
  for (const row of policies) {
    const reference = baseline?.outcome || {};
    const current = row.outcome || {};
    const benefitComponents = {
      closure: Number(current.closureRate || 0) - Number(reference.closureRate || 0),
      coverage: Number(current.meanCoverage || 0) - Number(reference.meanCoverage || 0),
      mastery: Number(current.masteryGain || 0) - Number(reference.masteryGain || 0),
      riskReduction: Number(current.riskReduction || 0) - Number(reference.riskReduction || 0),
      turnEfficiency: Number(current.turnEfficiency || 0) - Number(reference.turnEfficiency || 0),
    };
    const benefitScore =
      row.policy === baselinePolicy
        ? 0
        : roundField(
            0.35 * benefitComponents.closure +
              0.25 * benefitComponents.coverage +
              0.15 * benefitComponents.mastery +
              0.15 * benefitComponents.riskReduction +
              0.1 * benefitComponents.turnEfficiency,
          );
    const hasVariation = row.variation.distinctRegisters >= 2 && row.variation.registerEntropyBits >= 0.35;
    const hasDramaticVariation =
      row.variation.distinctActorialParts >= 2 && row.variation.actorialPartEntropyBits >= 0.35;
    const hasContingency =
      row.contingency.stateActionObservations >= 6 && row.contingency.normalizedMutualInformation >= 0.05;
    const hasDramaticContingency =
      row.contingency.statePartObservations >= 6 && row.contingency.actorialPartNormalizedMutualInformation >= 0.05;
    const hasConsequence = row.consequence.transitionCount >= 3 && Number(row.consequence.meanRewardProxy || 0) > 0;
    let verdict = 'not_established';
    if (row.policy === baselinePolicy) verdict = 'baseline';
    else if (row.validity.technical !== 'pass' || row.validity.transitionEvidence !== 'pass') verdict = 'pending';
    else if (benefitScore < -0.05 && row.consequence.transitionCount >= 6) verdict = 'contradicted';
    else if (hasVariation && hasContingency && hasConsequence && benefitScore > 0.02) verdict = 'supported';
    else if ((hasVariation && hasContingency) || hasConsequence || Math.abs(benefitScore) > 0.02) verdict = 'mixed';
    row.benefit = { baselinePolicy, score: benefitScore, components: benefitComponents };
    row.verdict = verdict;
    row.dimensions = {
      variation: hasVariation ? 'present' : 'not_established',
      dramaticVariation: hasDramaticVariation ? 'present' : 'not_established',
      contingency: hasContingency ? 'present' : 'not_established',
      dramaticContingency: hasDramaticContingency ? 'present' : 'not_established',
      consequence: hasConsequence ? 'positive' : row.consequence.transitionCount ? 'not_established' : 'pending',
      benefit: benefitScore > 0.02 ? 'positive' : benefitScore < -0.02 ? 'negative' : 'not_established',
      validity: row.validity.technical === 'pass' && row.validity.transitionEvidence === 'pass' ? 'usable' : 'pending',
    };
  }
  const usable = policies.filter((row) => row.policy !== baselinePolicy);
  const outcomeAchieved = policies.some(
    (row) => Number(row.outcome.closureRate || 0) >= 0.95 && Number(row.outcome.meanCoverage || 0) >= 0.95,
  );
  const supported = usable.filter((row) => row.verdict === 'supported');
  const contradicted = usable.filter((row) => row.verdict === 'contradicted');
  const verdict = supported.length
    ? 'supported'
    : contradicted.length === usable.length && usable.length
      ? 'contradicted'
      : usable.some((row) => row.verdict === 'mixed')
        ? 'mixed'
        : usable.some((row) => row.verdict === 'pending')
          ? 'pending'
          : 'not_established';
  return {
    schema: 'machinespirits.tutor-stub.adaptation-evidence.v1',
    baselinePolicy,
    outcomeAchieved,
    verdict,
    headline: outcomeAchieved
      ? supported.length
        ? `Outcome achieved; adaptation advantage supported for ${supported.map((row) => row.policy).join(', ')}.`
        : 'Outcome achieved; adaptation advantage not established.'
      : supported.length
        ? 'Adaptation signal present, but the target outcome is not yet robust.'
        : 'Outcome and adaptation advantage are not yet established.',
    policies: policies.sort((left, right) => compareReportPolicies(left.policy, right.policy)),
    note: 'Exploratory transition evidence. It is designed for research triage and does not by itself establish a causal learning effect.',
  };
}

function renderSignalGuide() {
  const signals = [
    [
      'Mastery gain',
      'How far the learner moved toward owning the proof. Read it with final mastery, because a large gain can still end below full command.',
    ],
    [
      'Risk reduction',
      'How much overreach, missing-premise, or readiness risk fell. Read it with final risk, because the best rows end low, not merely lower.',
    ],
    [
      'Leak discipline',
      'Whether closure was earned without protected-answer leakage. Clean closure is stronger evidence than fast closure with leaks.',
    ],
    [
      'Turn count',
      'Efficiency after the safety checks pass. Shorter is only better when closure, coverage, and leak discipline are already clean.',
    ],
    [
      'Register variation',
      'Entropy or diversity in tutor registers. It is purposeful when it coincides with progress, and just noisy when the field does not move.',
    ],
    [
      'Part variation',
      'Diversity in the public parts the tutor actually plays. Read it with state-to-part contingency and transcript realization, not as theatrical variety for its own sake.',
    ],
  ];
  return `<div class="signal-guide" aria-label="Signal guide">
    ${signals
      .map(
        ([label, description]) => `<div>
          <strong>${escapeHtml(label)}</strong>
          <p>${escapeHtml(description)}</p>
        </div>`,
      )
      .join('\n')}
  </div>`;
}

function adaptationVerdictLabel(value) {
  return String(value || 'pending').replaceAll('_', ' ');
}

function renderAdaptationVerdict(rows, summary) {
  const evidence = adaptationEvidenceForRows(rows, summary);
  const cards = evidence.policies
    .map(
      (row) => `<article class="read-first-card adaptation-${escapeHtml(row.verdict)}">
        <div class="read-first-card-head"><span>${escapeHtml(adaptationVerdictLabel(row.verdict))}</span><strong>${escapeHtml(row.policy)}</strong></div>
        <p>${row.policy === evidence.baselinePolicy ? 'Reference condition for within-profile differences.' : `Adaptation benefit vs ${escapeHtml(evidence.baselinePolicy)}: ${escapeHtml(formatSignedField(row.benefit.score))}.`}</p>
        <div class="read-first-card-stats">
          <span><b>${escapeHtml(`${row.variation.distinctRegisters} / ${row.variation.registerEntropyBits}b`)}</b> variation</span>
          <span><b>${escapeHtml(`${row.variation.distinctActorialParts} / ${row.variation.actorialPartEntropyBits}b`)}</b> parts played</span>
          <span><b>${escapeHtml(formatFieldValue(row.contingency.normalizedMutualInformation))}</b> contingency NMI</span>
          <span><b>${escapeHtml(row.consequence.transitionCount ? `${Math.round(Number(row.consequence.positiveRate || 0) * 100)}% / ${row.consequence.transitionCount}` : 'pending')}</b> positive transitions</span>
          <span><b>${row.outcome.closureRate === null ? 'pending' : `${Math.round(row.outcome.closureRate * 100)}%`}</b> outcome closure</span>
        </div>
      </article>`,
    )
    .join('\n');
  const body = evidence.policies
    .map(
      (row) => `<tr>
        <td><strong>${escapeHtml(row.policy)}</strong></td>
        <td><span class="status adaptation-${escapeHtml(row.verdict)}">${escapeHtml(adaptationVerdictLabel(row.verdict))}</span></td>
        <td>${escapeHtml(row.dimensions.variation)}</td>
        <td>${escapeHtml(row.dimensions.contingency)} · ${escapeHtml(formatFieldValue(row.contingency.normalizedMutualInformation))} NMI</td>
        <td>${escapeHtml(row.dimensions.consequence)} · ${escapeHtml(formatSignedField(row.consequence.meanRewardProxy))} mean proxy</td>
        <td>${escapeHtml(row.dimensions.benefit)} · ${escapeHtml(formatSignedField(row.benefit.score))}</td>
        <td>${escapeHtml(row.dimensions.validity)}</td>
        <td>${row.outcome.closureRate === null ? 'pending' : `${Math.round(row.outcome.closureRate * 100)}%`} / ${escapeHtml(formatFieldValue(row.outcome.meanCoverage))}</td>
      </tr>`,
    )
    .join('\n');
  return `<section id="read-first" class="report-section read-first">
    <h2>Adaptation Verdict</h2>
    <div class="adaptation-headline adaptation-${escapeHtml(evidence.verdict)}"><strong>${escapeHtml(evidence.headline)}</strong><span>Outcome and adaptation are reported separately. No policy is ranked when the evidence does not establish an adaptive advantage.</span></div>
    <p class="read-first-note">${escapeHtml(evidence.note)}</p>
    <div class="read-first-cards">${cards || '<p>No policy evidence is available.</p>'}</div>
    <details class="read-first-details">
      <summary>Evidence dimensions and baseline differences</summary>
      <div class="table-scroll" role="region" aria-label="Adaptation evidence dimensions" tabindex="0">
        <table class="read-first-table">
          <thead><tr>
            <th>Policy</th>
            <th>Verdict</th>
            <th>Variation</th>
            <th>Contingency</th>
            <th>Consequence</th>
            <th>Benefit vs baseline</th>
            <th>Validity</th>
            <th>Closure / coverage</th>
          </tr></thead>
          <tbody>${body || '<tr><td colspan="8">No policy evidence is available.</td></tr>'}</tbody>
        </table>
      </div>
    </details>
    ${renderSignalGuide()}
  </section>`;
}

function renderReportMetricGuide() {
  const terms = [
    ['Mastery Gain', REPORT_TERM_TOOLTIPS.masteryDelta],
    ['Risk Reduction', REPORT_TERM_TOOLTIPS.riskDelta],
    ['Leak Discipline', REPORT_TERM_TOOLTIPS.leaks],
    ['Mean Coverage', REPORT_TERM_TOOLTIPS.meanCoverage],
    ['Register Entropy', REPORT_TERM_TOOLTIPS.entropy],
  ];
  return `<aside class="metric-guide" aria-label="Metric explanations">
    <h3>Reading The Metrics</h3>
    <dl>
      ${terms
        .map(
          ([term, description]) => `<div>
            <dt>${escapeHtml(term)}</dt>
            <dd>${escapeHtml(description)}</dd>
          </div>`,
        )
        .join('\n')}
    </dl>
  </aside>`;
}

function renderReportSectionNav() {
  const sections = [
    ['run-summary', 'Profile Summary'],
    ['read-first', 'Adaptation Verdict'],
    ['learner-profile', 'Learner Profile'],
    ['policy-comparison', 'Policy Comparison'],
    ['adaptation-timeline', 'Adaptation Timeline'],
    ['turn-replay', 'Turn Replay'],
    ['transcripts', 'Transcripts'],
    ['field-trajectories', 'Field Trajectories'],
    ['run-details', 'Trial Details'],
  ];
  return `<aside class="report-nav" aria-label="Eval report sections">
    <div class="report-nav-title">Sections</div>
    <nav class="report-nav-list">
      ${sections.map(([id, label]) => `<a href="#${escapeHtml(id)}">${escapeHtml(label)}</a>`).join('\n')}
    </nav>
  </aside>`;
}

function adaptationMomentTone(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return 'pending';
  if (numeric > 0.005) return 'positive';
  if (numeric < -0.005) return 'negative';
  return 'neutral';
}

function renderAdaptationTimeline(rows) {
  const trials = rows
    .map((row, index) => ({ row, index, examples: row.trainingExamples?.examples || [] }))
    .filter((entry) => entry.examples.length);
  if (!trials.length) {
    return '<p class="sub">No transition examples were captured for these trials.</p>';
  }
  const content = trials
    .map(({ row, index, examples }) => {
      const vizId = animatedVizRowId(row, index, safeSlug);
      const transcriptId = transcriptRowId(row, index);
      const positive = examples.filter(
        (example) => adaptationMomentTone(example.rewardProxy?.score) === 'positive',
      ).length;
      const negative = examples.filter(
        (example) => adaptationMomentTone(example.rewardProxy?.score) === 'negative',
      ).length;
      const moments = examples
        .map((example) => {
          const score = example.rewardProxy?.score;
          const tone = adaptationMomentTone(score);
          const state = example.stateBeforeAction?.learnerState || {};
          const register = example.action?.selectedRegister || 'no register';
          const stateLabel = state.requestType || state.discourseMove || state.evidenceUse || 'unclassified state';
          return `<button type="button" class="adaptation-moment ${escapeHtml(tone)}" data-adaptation-replay="${escapeHtml(vizId)}" data-adaptation-turn="${escapeHtml(example.turn)}" title="${escapeHtml(`${stateLabel} → ${register}; reward proxy ${score ?? 'pending'}`)}"><span>t${escapeHtml(example.turn)}</span><strong>${escapeHtml(register)}</strong><em>${score === null || score === undefined ? 'pending' : formatSignedField(score)}</em></button>`;
        })
        .join('');
      return `<details class="adaptation-trial" data-persist-details="adaptation:${escapeHtml(vizId)}">
        <summary><strong>${escapeHtml(row.policy)} · trial ${escapeHtml(row.runIndex)}</strong><span>${escapeHtml(examples.length)} decisions · ${escapeHtml(positive)} positive · ${escapeHtml(negative)} negative</span></summary>
        <div class="adaptation-trial-body">
          <div class="adaptation-strip" aria-label="${escapeHtml(`${row.policy} trial ${row.runIndex} adaptation transitions`)}">${moments}</div>
          <div class="adaptation-links"><a href="#turn-replay" data-adaptation-replay="${escapeHtml(vizId)}" data-adaptation-turn="1">open replay</a><a href="#transcripts" data-transcript-jump="${escapeHtml(transcriptId)}">open transcript</a></div>
        </div>
      </details>`;
    })
    .join('\n');
  return `<div class="adaptation-timeline">
    <div class="adaptation-timeline-key"><span class="positive">positive next-turn proxy</span><span class="neutral">flat / unclear</span><span class="negative">negative next-turn proxy</span><span>Click any turn to open replay at that decision.</span></div>
    ${content}
  </div>
  <script>
  (function () {
    document.addEventListener('click', function (event) {
      var trigger = event.target && event.target.closest ? event.target.closest('[data-adaptation-replay]') : null;
      if (!trigger) return;
      var id = trigger.getAttribute('data-adaptation-replay');
      var turn = Number(trigger.getAttribute('data-adaptation-turn') || 1);
      if (window.tutorStubVizSelect) window.tutorStubVizSelect(id, turn);
    });
  })();
  </script>`;
}

function renderTranscriptExplorer(rows) {
  const payload = transcriptReportPayload(rows);
  if (!payload.rows.length) {
    return '<p class="sub">No transcript turns were found in these traces.</p>';
  }
  return `<div class="transcript-explorer" id="tutor-stub-transcript-explorer">
    <div class="transcript-toolbar">
      <label class="transcript-run-control"><span>Policy Run</span><select data-transcript-run></select></label>
      <div class="transcript-control-group transcript-view-control">
        <span class="transcript-group-label">View</span>
        <div class="transcript-mode-buttons" role="tablist" aria-label="Transcript view">
          <button type="button" data-transcript-mode="plates" class="active">Plates</button>
          <button type="button" data-transcript-mode="excerpts">Excerpts</button>
          <button type="button" data-transcript-mode="script">Script</button>
          <button type="button" data-transcript-mode="swimlanes">Swimlanes</button>
          <button type="button" data-transcript-mode="notes">Notes</button>
        </div>
      </div>
      <label class="transcript-turn-control"><span>Turn</span><select data-transcript-turn></select></label>
      <label class="transcript-search-control"><span>Search</span><input type="search" data-transcript-search placeholder="text, stance, action, event"></label>
    </div>
    <div class="transcript-summary" data-transcript-summary></div>
    <div class="transcript-body" data-transcript-body aria-live="polite"></div>
  </div>
  <script type="application/json" id="tutor-stub-transcript-data">${safeJsonForScript(JSON.stringify(payload))}</script>
  <script>
  (function () {
    var root = document.getElementById('tutor-stub-transcript-explorer');
    var dataNode = document.getElementById('tutor-stub-transcript-data');
    if (!root || !dataNode) return;
    var payload;
    try {
      payload = JSON.parse(dataNode.textContent || '{}');
    } catch (error) {
      return;
    }
    var rows = payload.rows || [];
    if (!rows.length) return;
    var runSelect = root.querySelector('[data-transcript-run]');
    var turnSelect = root.querySelector('[data-transcript-turn]');
    var searchInput = root.querySelector('[data-transcript-search]');
    var summary = root.querySelector('[data-transcript-summary]');
    var body = root.querySelector('[data-transcript-body]');
    var modeButtons = Array.prototype.slice.call(root.querySelectorAll('[data-transcript-mode]'));
    var activeRow = rows[0];
    var activeMode = 'plates';
    var activeTurn = '';
    var registerMeta = {
      plain: { label: 'Plain', color: '#0A0A0A', ink: '#FFFFFF' },
      precise: { label: 'Precise', color: '#0057B8', ink: '#FFFFFF' },
      brisk: { label: 'Brisk', color: '#D98E04', ink: '#0A0A0A' },
      warm: { label: 'Warm', color: '#E63946', ink: '#FFFFFF' },
      witnessing: { label: 'Witnessing', color: '#009B72', ink: '#FFFFFF' },
      charismatic: { label: 'Charismatic', color: '#6B4EFF', ink: '#FFFFFF' },
      ironic: { label: 'Ironic', color: '#737373', ink: '#FFFFFF' },
      sarcastic: { label: 'Sarcastic', color: '#000000', ink: '#FFFFFF' },
      face_threat: { label: 'Face threat', color: '#D72670', ink: '#FFFFFF' }
    };

    function esc(value) {
      return String(value == null ? '' : value).replace(/[&<>"]/g, function (char) {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;'
        }[char];
      });
    }

    function normal(value) {
      return String(value == null ? '' : value).toLowerCase();
    }

    function pct(value) {
      var number = Number(value);
      return Number.isFinite(number) ? Math.round(number * 100) + '%' : 'n/a';
    }

    function fmt(value) {
      var number = Number(value);
      return Number.isFinite(number) ? number.toFixed(3) : 'n/a';
    }

    function proofStatus(value) {
      return value === 'grounded_asserted_secret' ? 'closed' : value || 'open';
    }

    function metaForRegister(register) {
      var key = String(register || 'none');
      return registerMeta[key] || { label: key.replace(/_/g, ' '), color: '#0A0A0A', ink: '#FFFFFF' };
    }

    function registerMark(turn) {
      var key = turn.register && turn.register.selected ? turn.register.selected : 'none';
      var meta = metaForRegister(key);
      return '<span class="transcript-register-mark" style="--style-color:' + esc(meta.color) + ';--style-ink:' + esc(meta.ink) + '">' +
        '<span class="transcript-dot" aria-hidden="true"></span>' + esc(meta.label) + '</span>';
    }

    function chip(label, value, tone) {
      if (value === undefined || value === null || value === '') return '';
      return '<span class="transcript-pill' + (tone ? ' ' + esc(tone) : '') + '">' + esc(label) + ': ' + esc(value) + '</span>';
    }

    function eventChips(turn) {
      var events = (turn.events || []).slice(0, 8);
      var risks = ((turn.register && turn.register.riskFlags) || []).slice(0, 5);
      var all = events.concat(risks.filter(function (flag) { return events.indexOf(flag) === -1; }));
      if (!all.length) return '<span class="transcript-pill">events: none</span>';
      return all.map(function (event) {
        return '<span class="transcript-pill hot">' + esc(proofStatus(event)) + '</span>';
      }).join('');
    }

    function turnSearchText(turn) {
      return [
        turn.learner,
        turn.tutor,
        turn.register && turn.register.selected,
        turn.register && turn.register.actionFamily,
        turn.register && turn.register.audienceRegister,
        turn.register && turn.register.lexicalAccessibility,
        turn.register && turn.register.sceneImmersion,
        turn.register && turn.register.reason,
        turn.field && turn.field.bottleneck,
        turn.learnerState && turn.learnerState.discourseMove,
        turn.learnerState && turn.learnerState.epistemicStance,
        (turn.events || []).join(' ')
      ].filter(Boolean).join(' ');
    }

    function filteredTurns() {
      var query = normal(searchInput && searchInput.value);
      return ((activeRow.transcript && activeRow.transcript.turns) || []).filter(function (turn) {
        if (activeTurn && String(turn.turn) !== String(activeTurn)) return false;
        return !query || normal(turnSearchText(turn)).indexOf(query) !== -1;
      });
    }

    function metaStrip(turn) {
      var state = turn.learnerState || {};
      var dag = turn.dag || {};
      var response = turn.response || {};
      var configuration = turn.responseConfiguration || {};
      var configurationAudit = turn.responseConfigurationAudit || {};
      return '<div class="transcript-meta-strip">' +
        chip('proof status', proofStatus((turn.field && turn.field.bottleneck) || dag.bottleneck)) +
        chip('coverage', pct(dag.bestPathCoverage)) +
        chip('missing', dag.missingPremiseCount) +
        chip('move', state.discourseMove) +
        chip('stance', state.epistemicStance) +
        chip('agency', state.agency) +
        chip('action', configuration.action_family || (turn.register && turn.register.actionFamily)) +
        chip('audience', configuration.audience_register || (turn.register && turn.register.audienceRegister)) +
        chip('language', configuration.lexical_accessibility || (turn.register && turn.register.lexicalAccessibility)) +
        chip('scene', configuration.scene_immersion || (turn.register && turn.register.sceneImmersion)) +
        chip('part', configuration.actorial_part_label || configuration.actorial_part || (turn.register && (turn.register.actorialPartLabel || turn.register.actorialPart))) +
        chip('configuration visible', configurationAudit.axis_count ? configurationAudit.visible_axis_count + '/' + configurationAudit.axis_count : null) +
        chip('efficacy', response.efficacyLabel) +
        (response.repaired ? chip('repair', 'yes', 'good') : '') +
        eventChips(turn) +
      '</div>';
    }

    function voiceBlock(kind, text, compact) {
      return '<section class="transcript-voice transcript-voice-' + esc(kind) + '">' +
        '<span class="transcript-speaker ' + esc(kind) + '">' + esc(kind) + '</span>' +
        '<div class="transcript-speech">' + esc(text || (compact ? '' : 'No text captured.')) + '</div>' +
      '</section>';
    }

    function renderExcerpts(turns) {
      if (!turns.length) return '<div class="transcript-empty">No matching transcript turns.</div>';
      return turns.map(function (turn) {
        return '<article class="transcript-card" data-transcript-turn-card="' + esc(turn.turn) + '">' +
          '<div class="transcript-card-head"><span>Turn ' + esc(turn.turn) + '</span>' + registerMark(turn) + '</div>' +
          '<div class="transcript-voice-grid">' +
            voiceBlock('learner', turn.excerpts && turn.excerpts.learner, false) +
            voiceBlock('tutor', turn.excerpts && turn.excerpts.tutor, false) +
          '</div>' +
          metaStrip(turn) +
        '</article>';
      }).join('');
    }

    function renderScript(turns) {
      if (!turns.length) return '<div class="transcript-empty">No matching transcript turns.</div>';
      return '<div class="transcript-script">' + turns.map(function (turn) {
        return '<section class="transcript-line learner">' +
          '<div class="transcript-line-head"><span>Learner · turn ' + esc(turn.turn) + '</span>' + registerMark(turn) + '</div>' +
          '<div class="transcript-speech">' + esc(turn.learner || '') + '</div>' +
        '</section>' +
        '<section class="transcript-line tutor">' +
          '<div class="transcript-line-head"><span>Tutor · turn ' + esc(turn.turn) + '</span></div>' +
          '<div class="transcript-speech">' + esc(turn.tutor || '') + '</div>' +
          metaStrip(turn) +
        '</section>';
      }).join('') + '</div>';
    }

    function renderSwimlanes(turns) {
      if (!turns.length) return '<div class="transcript-empty">No matching transcript turns.</div>';
      return '<div class="transcript-swimlane">' +
        '<div class="transcript-swim-head">' +
          '<span class="transcript-swim-label tutor">tutor</span>' +
          '<span class="transcript-swim-label spine" aria-hidden="true"></span>' +
          '<span class="transcript-swim-label learner">learner</span>' +
        '</div>' +
        turns.map(function (turn) {
          return '<div class="transcript-swim-row">' +
            '<section class="transcript-lane tutor">' +
              '<span class="transcript-speaker tutor">tutor</span>' +
              '<div class="transcript-speech">' + esc(turn.tutor || '') + '</div>' +
            '</section>' +
            '<div class="transcript-spine"><span class="transcript-bead">' + esc(turn.turn) + '</span></div>' +
            '<section class="transcript-lane learner">' +
              '<span class="transcript-speaker learner">learner</span>' +
              '<div class="transcript-speech">' + esc(turn.learner || '') + '</div>' +
              metaStrip(turn) +
            '</section>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    function renderPlates(turns) {
      if (!turns.length) return '<div class="transcript-empty">No matching transcript turns.</div>';
      return turns.map(function (turn) {
        var register = turn.register || {};
        return '<article class="transcript-plate">' +
          '<div class="transcript-plate-head"><span>Turn ' + esc(turn.turn) + ' · ' + esc(activeRow.policy) + '</span>' + registerMark(turn) + '</div>' +
          '<div class="transcript-plate-voices">' +
            voiceBlock('learner', turn.learner, false) +
            voiceBlock('tutor', turn.tutor, false) +
          '</div>' +
          metaStrip(turn) +
          '<div class="transcript-plate-reason">' +
            '<strong>Engagement-stance rationale:</strong> ' + esc(register.reason || 'No stance rationale was captured for this turn.') +
            (register.expectedDagMove ? '<br><strong>DAG move:</strong> ' + esc(register.expectedDagMove) : '') +
            (register.expectedFieldMove ? '<br><strong>Field move:</strong> ' + esc(register.expectedFieldMove) : '') +
          '</div>' +
        '</article>';
      }).join('');
    }

    function renderNotes(turns) {
      if (!turns.length) return '<div class="transcript-empty">No matching transcript turns.</div>';
      return '<div class="transcript-notes-grid">' + turns.map(function (turn) {
        var state = turn.learnerState || {};
        var dag = turn.dag || {};
        var field = turn.field || {};
        var trajectory = turn.trajectory || {};
        var human = turn.humanDiscourse || {};
        var scaffold = human.scaffoldState || {};
        var debt = human.proofDebt || {};
        var audit = human.warrantPremiseAudit || {};
        return '<article class="transcript-note-card">' +
          '<div class="transcript-note-head"><span>Turn ' + esc(turn.turn) + '</span>' + registerMark(turn) + '</div>' +
          '<p><strong>Learner state:</strong> ' + esc([state.requestType, state.discourseMove, state.evidenceUse, state.epistemicStance, state.agency].filter(Boolean).join(' · ')) + '</p>' +
          (state.summary ? '<p><strong>Classifier summary:</strong> ' + esc(state.summary) + '</p>' : '') +
          '<p><strong>DAG:</strong> coverage ' + esc(pct(dag.bestPathCoverage)) + ', missing ' + esc(dag.missingPremiseCount) + ', grounded ' + esc(dag.groundedCount) + ', proof status ' + esc(proofStatus(dag.bottleneck || field.bottleneck)) + '</p>' +
          (human.mode && human.mode !== 'strict_dag' ? '<p><strong>Human scaffold:</strong> ' + esc((scaffold.branch && (scaffold.branch.label || scaffold.branch.id)) || 'open scaffold') + '; side arc ' + esc((human.sideArc && human.sideArc.detected) ? human.sideArc.type : 'none') + '; proof debt ' + esc(debt.status || 'unknown') + '; warrants explicit/missing ' + esc((audit.counts && audit.counts.explicitWarrants) || 0) + '/' + esc((audit.counts && audit.counts.missingWarrants) || 0) + '</p>' : '') +
          '<p><strong>Field:</strong> mastery ' + esc(fmt(field.learnerMastery)) + ', risk ' + esc(fmt(field.learnerRisk)) + ', alignment ' + esc(fmt(field.tutorAlignment)) + ', momentum ' + esc(fmt(field.jointMomentum)) + '</p>' +
          '<p><strong>Trajectory:</strong> field v ' + esc(fmt(trajectory.fieldVelocity)) + ', DAG v ' + esc(fmt(trajectory.dagVelocity)) + ', risk v ' + esc(fmt(trajectory.riskVelocity)) + '</p>' +
          metaStrip(turn) +
        '</article>';
      }).join('') + '</div>';
    }

    function renderBody() {
      var turns = filteredTurns();
      modeButtons.forEach(function (button) {
        button.classList.toggle('active', button.getAttribute('data-transcript-mode') === activeMode);
      });
      var finalTurn = ((activeRow.transcript && activeRow.transcript.turns) || []).slice(-1)[0] || {};
      if (summary) {
        summary.innerHTML = [
          chip('policy', activeRow.policy),
          chip('run', activeRow.runIndex),
          chip('turns', activeRow.turnCount),
          chip('status', activeRow.status, activeRow.status === 'ok' ? 'good' : ''),
          chip('closure', activeRow.groundedClosure ? 'grounded' : 'open', activeRow.groundedClosure ? 'good' : 'hot'),
          chip('final status', proofStatus(finalTurn.field && finalTurn.field.bottleneck)),
          chip('shown', turns.length + '/' + (((activeRow.transcript && activeRow.transcript.turns) || []).length))
        ].join('');
      }
      if (activeMode === 'script') body.innerHTML = renderScript(turns);
      else if (activeMode === 'swimlanes') body.innerHTML = renderSwimlanes(turns);
      else if (activeMode === 'notes') body.innerHTML = renderNotes(turns);
      else if (activeMode === 'excerpts') body.innerHTML = renderExcerpts(turns);
      else body.innerHTML = renderPlates(turns);
    }

    function syncTurnOptions() {
      var turns = (activeRow.transcript && activeRow.transcript.turns) || [];
      turnSelect.innerHTML = '<option value="">All turns</option>' + turns.map(function (turn) {
        return '<option value="' + esc(turn.turn) + '"' + (String(turn.turn) === String(activeTurn) ? ' selected' : '') + '>turn ' + esc(turn.turn) + '</option>';
      }).join('');
    }

    function selectRunById(id) {
      var index = rows.findIndex(function (row) { return row.id === id; });
      if (index < 0) return;
      activeRow = rows[index];
      activeTurn = '';
      runSelect.value = String(index);
      syncTurnOptions();
      renderBody();
      root.classList.add('transcript-jump-active');
      window.setTimeout(function () { root.classList.remove('transcript-jump-active'); }, 900);
    }

    rows.forEach(function (row, index) {
      var option = document.createElement('option');
      option.value = String(index);
      option.textContent = 'policy ' + row.policy + ' · run ' + row.runIndex + ' · ' + row.turnCount + 't · ' + row.status;
      runSelect.appendChild(option);
    });
    runSelect.addEventListener('change', function () {
      activeRow = rows[Number(runSelect.value) || 0] || rows[0];
      activeTurn = '';
      if (searchInput) searchInput.value = '';
      syncTurnOptions();
      renderBody();
    });
    turnSelect.addEventListener('change', function () {
      activeTurn = turnSelect.value;
      renderBody();
    });
    searchInput.addEventListener('input', renderBody);
    modeButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        activeMode = button.getAttribute('data-transcript-mode') || 'plates';
        renderBody();
      });
    });
    document.addEventListener('click', function (event) {
      var trigger = event.target && event.target.closest ? event.target.closest('[data-transcript-jump]') : null;
      if (!trigger) return;
      selectRunById(trigger.getAttribute('data-transcript-jump'));
    });
    window.tutorStubTranscriptSelect = selectRunById;
    syncTurnOptions();
    renderBody();
  })();
  </script>`;
}

function renderFieldTrajectories(rows) {
  const fieldRows = rows.filter((row) => row.fieldViz?.rows?.length);
  if (!fieldRows.length) {
    return '<p class="sub">No field trajectory data was found in these traces.</p>';
  }
  return `<div class="field-grid">
    ${fieldRows
      .map((row) => {
        const title = fieldRowTitle(row);
        const final = row.field?.final || {};
        return `<article class="field-card">
          <div class="field-card-head">
            <div>
              <h3>${escapeHtml(title)}</h3>
              <div class="sub">${escapeHtml(row.status)} · ${escapeHtml(row.turnCount)} turns · ${escapeHtml(
                displayStopReason(row.stopReason),
              )}</div>
            </div>
            <div class="field-actions">
              ${row.fieldSvg?.href ? `<a class="field-link" href="${escapeHtml(row.fieldSvg.href)}">svg</a>` : ''}
              <div class="field-badge">${escapeHtml(displayBottleneck(final.bottleneck || row.bottleneck, { groundedClosure: row.groundedClosure }))}</div>
            </div>
          </div>
          <div class="field-card-summary">${escapeHtml(fieldSummaryText(row))}</div>
          <div class="field-svg">${renderLightweightFieldSvg(row.fieldViz, { title })}</div>
        </article>`;
      })
      .join('\n')}
  </div>`;
}

function renderHtmlReport(summary, rows, { htmlPath = '' } = {}) {
  const reportDir = htmlPath
    ? path.dirname(resolvePath(htmlPath))
    : resolveTracePath(summary.config?.traceDir || '.', ROOT);
  const indexHref = hrefRelative(reportDir, path.join(indexRootDir(), 'index.html'));
  const guideHref = hrefRelative(reportDir, path.join(ROOT, 'docs', 'tutor-stub-arc-guide.html'));
  const reportScope = reportScopeForSummary({
    jsonPath: summary.report?.json || '',
    summary,
    config: summary.config || {},
    rootDir: reportDir,
  });
  const orderedRows = rows.slice().sort(compareReportRows);
  const policyRows = Object.entries(summary.aggregates.byPolicy)
    .sort(([left], [right]) => compareReportPolicies(left, right))
    .map(
      ([policy, bucket]) => `<tr>
        <td><strong>${escapeHtml(policy)}</strong></td>
        <td>${bucket.ok}</td>
        <td>${bucket.grounded}/${bucket.ok}</td>
        <td>${Math.round(bucket.groundedRate * 100)}%</td>
        <td>${bucket.groundedByHorizon}/${bucket.fixedHorizonRows}</td>
        <td>${bucket.meanCoverageAtHorizon} [${bucket.coverageAtHorizonLowerBound}, ${bucket.coverageAtHorizonUpperBound}]</td>
        <td>${bucket.horizonSafetyPassed}/${bucket.fixedHorizonRows}</td>
        <td>${bucket.horizonSafetyIncomplete}</td>
        <td>${bucket.fixedHorizonComplete}/${bucket.fixedHorizonRows}</td>
        <td>${bucket.meanTurns}</td>
        <td>${bucket.meanCoverage} ${pctBar(bucket.meanCoverage)}</td>
        <td>${bucket.meanMissing}</td>
        <td>${bucket.meanFieldMasteryDelta}</td>
        <td>${formatPositiveField(-Number(bucket.meanFieldRiskDelta))}</td>
        <td>${escapeHtml(formatCounts(bucket.registerCounts))}</td>
        <td>${bucket.registerEntropy}</td>
        <td>${Math.round(Number(bucket.meanConfigurationRealization || 0) * 100)}%</td>
        <td>${
          bucket.meanConfigurationVisibleDifference === null
            ? 'n/a'
            : `${Math.round(Number(bucket.meanConfigurationVisibleDifference) * 100)}%`
        }</td>
      </tr>`,
    )
    .join('\n');
  const runRows = orderedRows
    .map((row, index) => {
      const transcriptId = row.transcript?.turns?.length ? transcriptRowId(row, index) : '';
      return `<tr>
        <td>${escapeHtml(row.policy)}</td>
        <td>${escapeHtml(row.runIndex)}</td>
        <td><span class="status ${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td>
        <td>${row.groundedClosure ? 'yes' : 'no'}</td>
        <td>${escapeHtml(displayStopReason(row.stopReason))}</td>
        <td>${escapeHtml(row.turnCount)}</td>
        <td>${row.bestPathCoverage} ${pctBar(row.bestPathCoverage)}</td>
        <td>${escapeHtml(row.missingPremiseCount ?? '')}</td>
        <td>${escapeHtml(formatDagFactDropoutSummary(row.dagFactDropout))}</td>
        <td>${escapeHtml(displayBottleneck(row.bottleneck, { groundedClosure: row.groundedClosure }))}</td>
        <td>${escapeHtml(
          row.field?.delta
            ? `mastery gain ${formatSignedField(row.field.delta.learnerMastery)} / risk reduction ${formatPositiveField(
                -Number(row.field.delta.learnerRisk),
              )}`
            : '',
        )}</td>
        <td>${escapeHtml(formatCounts(row.registerCounts, { limit: 4 }))}</td>
        <td>${escapeHtml(formatCounts(row.efficacyCounts, { limit: 4 }))}</td>
        <td>${Math.round(Number(row.responseConfigurationVisibility?.mean_realization_rate || 0) * 100)}%</td>
        <td>${
          row.responseConfigurationVisibility?.pairwise_visible_difference_rate === null ||
          row.responseConfigurationVisibility?.pairwise_visible_difference_rate === undefined
            ? 'n/a'
            : `${Math.round(Number(row.responseConfigurationVisibility.pairwise_visible_difference_rate) * 100)}%`
        }</td>
        <td>${escapeHtml(row.leakCount)}</td>
        <td>${escapeHtml(row.fixedHorizon?.safetyStatus || 'safety_incomplete')}</td>
        <td>${transcriptId ? `<a href="#transcripts" data-transcript-jump="${escapeHtml(transcriptId)}">transcript</a>` : ''}</td>
        <td>${row.trace ? `<a href="${escapeHtml(hrefRelative(reportDir, path.join(ROOT, row.trace)))}">trace</a>` : ''}</td>
        <td>${row.log ? `<a href="${escapeHtml(hrefRelative(reportDir, path.join(ROOT, row.log)))}">log</a>` : ''}</td>
      </tr>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${reportScope.kind === 'qa_matrix_child' ? 'Tutor Stub Profile Report' : 'Tutor Stub Auto-Eval Report'}</title>
  <style>
    ${machineSpiritsReportCss()}
  </style>
</head>
<body>
  <header>
    <h1>${reportScope.kind === 'qa_matrix_child' ? 'Tutor Stub Profile Report' : 'Tutor Stub Auto-Eval Report'}</h1>
    ${renderReportScopeBadge(reportScope)}
    <div class="sub">Started ${escapeHtml(summary.startedAt)} · completed ${escapeHtml(summary.completedAt)} · world ${escapeHtml(summary.config.world)} · DAG discourse ${escapeHtml(summary.config.dagMode || 'strict_dag')}</div>
    <div class="header-links">
      <a href="${escapeHtml(indexHref)}">report index</a>
      <a href="${escapeHtml(guideHref)}">arc guide</a>
    </div>
  </header>
  <main class="report-main">
    <div class="report-shell">
      ${renderReportSectionNav()}
      <div class="report-content">
        <section id="run-summary" class="report-section">
          <h2 class="visually-hidden">Profile Summary</h2>
          ${renderReportScopeNotice(reportScope)}
          <div class="summary-panel">
            <div class="metrics">
              ${htmlMetricInfo('Trials', REPORT_TERM_TOOLTIPS.ok, summary.aggregates.rows, `${summary.aggregates.failed} failed · ${summary.aggregates.missing} missing · ${summary.aggregates.dryRun} dry-run`)}
              ${htmlMetricInfo('Horizon Grounded', 'Grounded by the frozen primary horizon over every planned non-dry row.', `${summary.aggregates.groundedByHorizon}/${summary.aggregates.fixedHorizonRows}`, `turn ${summary.aggregates.primaryHorizon}`)}
              ${htmlMetricInfo('Horizon Coverage', 'Worst-case all-planned-row fixed-horizon coverage. Failed or missing rows contribute zero; brackets show lower and upper missingness bounds.', summary.aggregates.meanCoverageAtHorizon, `bounds ${summary.aggregates.coverageAtHorizonLowerBound}–${summary.aggregates.coverageAtHorizonUpperBound}`)}
              ${htmlMetricInfo('Horizon Safety', 'A pass requires complete guard evidence for every observed horizon turn. Safety failures and incomplete evidence are distinct.', `${summary.aggregates.horizonSafetyPassed}/${summary.aggregates.fixedHorizonRows}`, `${summary.aggregates.horizonSafetyFailed} failed · ${summary.aggregates.horizonSafetyIncomplete} safety_incomplete`)}
              ${htmlMetricInfo('Horizon Complete', 'Rows that reached the frozen primary horizon or grounded early, over every planned non-dry row.', `${summary.aggregates.fixedHorizonComplete}/${summary.aggregates.fixedHorizonRows}`, `${summary.aggregates.fixedHorizonOutcomeMissing} missing outcomes`)}
              ${htmlMetricInfo('Grounded', REPORT_TERM_TOOLTIPS.grounded, `${summary.aggregates.grounded}/${summary.aggregates.ok}`, `${Math.round(summary.aggregates.groundedRate * 100)}% closure`)}
              ${htmlMetricInfo('Mean Turns', REPORT_TERM_TOOLTIPS.meanTurns, summary.aggregates.meanTurns, `safety cap ${summary.config.safetyTurns}`)}
              ${htmlMetricInfo('Mean Coverage', REPORT_TERM_TOOLTIPS.meanCoverage, summary.aggregates.meanCoverage, 'learner-DAG best path')}
              ${htmlMetricInfo('Mean Missing', REPORT_TERM_TOOLTIPS.meanMissing, summary.aggregates.meanMissing, 'remaining premises')}
              ${htmlMetricInfo('Configuration Realization', 'Mean share of independently selected response axes with deterministic transcript-visible evidence.', `${Math.round(Number(summary.aggregates.meanConfigurationRealization || 0) * 100)}%`, 'stance · action · audience · language · scene')}
              ${htmlMetricInfo('Visible Difference', 'For pairs of turns with different selected configurations, the share with different surface-feature signatures.', summary.aggregates.meanConfigurationVisibleDifference === null ? 'n/a' : `${Math.round(Number(summary.aggregates.meanConfigurationVisibleDifference) * 100)}%`, 'n/a when a run used only one configuration')}
              ${htmlMetricInfo('DAG Mode', 'Discourse mode for translating the strict proof DAG into tutor behavior. strict_dag is the audit baseline; human_scaffold and defeasible_human_scaffold add human-facing warrant/proof-debt scaffolds.', summary.config.dagMode || 'strict_dag', summary.config.dagMode === 'strict_dag' || !summary.config.dagMode ? 'strict audit' : 'human scaffold active')}
            </div>
            ${renderReportMetricGuide()}
          </div>
        </section>

        ${renderAdaptationVerdict(orderedRows, summary)}

        <section id="learner-profile" class="report-section">
          <h2>Learner Profile</h2>
          ${renderLearnerProfileSection(summary, rows)}
        </section>

        <section id="policy-comparison" class="report-section">
          <h2>Policy Comparison</h2>
          <div class="table-scroll" role="region" aria-label="Policy comparison table" tabindex="0">
          <table class="policy-comparison-table">
      <thead><tr>
        <th>Policy</th>
        <th>${reportInfoTerm('ok', 'OK')}</th>
        <th>${reportInfoTerm('grounded', 'Grounded')}</th>
        <th>Rate</th>
        <th>Horizon Grounded</th>
        <th>Horizon Coverage [bounds]</th>
        <th>Horizon Safety</th>
        <th>Safety Incomplete</th>
        <th>Horizon Complete</th>
        <th>${reportInfoTerm('meanTurns', 'Mean Turns')}</th>
        <th>${reportInfoTerm('meanCoverage', 'Mean Coverage')}</th>
        <th>${reportInfoTerm('meanMissing', 'Mean Missing')}</th>
        <th>${reportInfoTerm('masteryDelta', 'Mastery Gain')}</th>
        <th>${reportInfoTerm('riskDelta', 'Risk Reduction')}</th>
        <th>${reportInfoTerm('topRegisters', 'Top Stances')}</th>
        <th>${reportInfoTerm('entropy', 'Entropy')}</th>
        <th>Configuration Realization</th>
        <th>Visible Difference</th>
      </tr></thead>
      <tbody>${policyRows || '<tr><td colspan="18">No policy rows.</td></tr>'}</tbody>
          </table>
          </div>
        </section>

        <section id="adaptation-timeline" class="report-section">
          <h2>Adaptation Timeline</h2>
          <p class="read-first-note">Each turn connects the learner state seen by the policy, the selected engagement stance and independent response configuration, and the next-turn exploratory reward proxy. Use it to inspect whether strategy changes were contingent, transcript-visible, and useful, not merely relabeled.</p>
          ${renderAdaptationTimeline(orderedRows)}
        </section>

        <section id="turn-replay" class="report-section">
          <h2>Turn Replay</h2>
          ${renderAnimatedVizSection(orderedRows, { safeSlug, fieldRowTitle })}
        </section>

        <section id="transcripts" class="report-section">
          <h2>Transcripts</h2>
          ${renderTranscriptExplorer(orderedRows)}
        </section>

        <section id="field-trajectories" class="report-section">
          <h2>Field Trajectories</h2>
          ${renderFieldTrajectories(orderedRows)}
        </section>

        <section id="run-details" class="report-section">
          <h2>Trial Details</h2>
          <div class="table-scroll" role="region" aria-label="Trial details table" tabindex="0">
          <table class="run-details-table">
      <thead><tr>
        <th>Policy</th>
        <th>Trial</th>
        <th>Status</th>
        <th>${reportInfoTerm('grounded', 'Grounded')}</th>
        <th>Stop</th>
        <th>${reportInfoTerm('meanTurns', 'Turns')}</th>
        <th>${reportInfoTerm('meanCoverage', 'Coverage')}</th>
        <th>${reportInfoTerm('meanMissing', 'Missing')}</th>
        <th>${reportInfoTerm('dagFactDropout', 'DAG Dropout')}</th>
        <th>${reportInfoTerm('bottleneck', 'Proof Status')}</th>
        <th>${reportInfoTerm('fieldDelta', 'Field Movement')}</th>
        <th>${reportInfoTerm('topRegisters', 'Engagement Stances')}</th>
        <th>${reportInfoTerm('efficacy', 'Efficacy')}</th>
        <th>Configuration Realization</th>
        <th>Visible Difference</th>
        <th>${reportInfoTerm('leaks', 'Leaks')}</th>
        <th>Horizon Safety</th>
        <th>Transcript</th>
        <th>Trace</th>
        <th>Log</th>
      </tr></thead>
      <tbody>${runRows || '<tr><td colspan="20">No run rows.</td></tr>'}</tbody>
          </table>
          </div>
        </section>
      </div>
    </div>
  </main>
</body>
</html>
`;
}

function writeHtmlReport({ summary, rows, htmlPath, updateIndex = true }) {
  const fieldSvgPaths = writeFieldSvgArtifacts({ rows, htmlPath });
  fs.writeFileSync(htmlPath, renderHtmlReport(summary, rows, { htmlPath }));
  console.log(`[auto-eval] wrote ${htmlPath}`);
  if (fieldSvgPaths.length) {
    console.log(`[auto-eval] wrote ${fieldSvgPaths.length} field SVGs to ${fieldSvgDirForReport(htmlPath)}`);
  }
  if (updateIndex) writeReportIndex();
}

function relativeReportPath(filePath) {
  if (!filePath) return null;
  return path.relative(ROOT, resolvePath(filePath));
}

function compactPolicyLedger(aggregates = {}) {
  return Object.fromEntries(
    Object.entries(aggregates.byPolicy || {}).map(([policy, row]) => [
      policy,
      {
        rows: row.rows || 0,
        ok: row.ok || 0,
        failed: row.failed || 0,
        missing: row.missing || 0,
        grounded: row.grounded || 0,
        groundedRate: row.groundedRate || 0,
        meanTurns: row.meanTurns ?? null,
        meanCoverage: row.meanCoverage ?? null,
        meanMissing: row.meanMissing ?? null,
        registerCounts: row.registerCounts || {},
        registerEntropy: row.registerEntropy ?? null,
        leakCount: row.leakCount || 0,
        errorCount: row.errorCount || 0,
        primaryHorizon: row.primaryHorizon ?? null,
        fixedHorizonRows: row.fixedHorizonRows || 0,
        fixedHorizonObserved: row.fixedHorizonObserved || 0,
        fixedHorizonOutcomeMissing: row.fixedHorizonOutcomeMissing || 0,
        fixedHorizonComplete: row.fixedHorizonComplete || 0,
        fixedHorizonIncomplete: row.fixedHorizonIncomplete || 0,
        groundedByHorizon: row.groundedByHorizon || 0,
        groundedByHorizonRate: row.groundedByHorizonRate || 0,
        meanCoverageAtHorizon: row.meanCoverageAtHorizon ?? null,
        meanObservedCoverageAtHorizon: row.meanObservedCoverageAtHorizon ?? null,
        coverageAtHorizonLowerBound: row.coverageAtHorizonLowerBound ?? null,
        coverageAtHorizonUpperBound: row.coverageAtHorizonUpperBound ?? null,
        horizonSafetyPassed: row.horizonSafetyPassed || 0,
        horizonSafetyFailed: row.horizonSafetyFailed || 0,
        horizonSafetyIncomplete: row.horizonSafetyIncomplete || 0,
        horizonSafetyPassRate: row.horizonSafetyPassRate || 0,
        horizonSafetyFailureRate: row.horizonSafetyFailureRate || 0,
        horizonSafetyIncompleteRate: row.horizonSafetyIncompleteRate || 0,
      },
    ]),
  );
}

function ledgerEntryForSummary({ summary, summaryPath, htmlPath }) {
  const config = summary.config || {};
  const aggregates = summary.aggregates || {};
  return {
    schema: 'machinespirits.tutor-stub.auto-eval-ledger.v1',
    recordedAt: new Date().toISOString(),
    startedAt: summary.startedAt || null,
    completedAt: summary.completedAt || null,
    runId: path.basename(summaryPath || summary.report?.json || 'auto-eval', '.json'),
    report: {
      json: relativeReportPath(summaryPath || summary.report?.json),
      html: relativeReportPath(htmlPath || summary.report?.html),
    },
    config: {
      runs: config.runs ?? null,
      policies: config.policies || [],
      turns: config.turns ?? null,
      safetyTurns: config.safetyTurns ?? null,
      primaryHorizon: config.primaryHorizon ?? null,
      parallelism: config.parallelism ?? null,
      model: config.model || null,
      analysisModel: config.analysisModel || null,
      autoLearnerModel: config.autoLearnerModel || null,
      autoLearnerProfileId: config.autoLearnerProfileId || null,
      world: config.world || null,
      maxTokens: config.maxTokens ?? null,
      historyTurns: config.historyTurns ?? null,
      memorySummary: config.memorySummary || null,
      resumedFrom: config.resumedFrom || null,
      resumeStatuses: config.resumeStatuses || null,
      dryRun: Boolean(config.dryRun),
    },
    totals: {
      rows: aggregates.rows || 0,
      completed: aggregates.completed || 0,
      ok: aggregates.ok || 0,
      failed: aggregates.failed || 0,
      missing: aggregates.missing || 0,
      dryRun: aggregates.dryRun || 0,
      grounded: aggregates.grounded || 0,
      groundedRate: aggregates.groundedRate || 0,
      meanTurns: aggregates.meanTurns ?? null,
      meanCoverage: aggregates.meanCoverage ?? null,
      meanMissing: aggregates.meanMissing ?? null,
      registerCounts: aggregates.registerCounts || {},
      registerEntropy: aggregates.registerEntropy ?? null,
      leakCount: aggregates.leakCount || 0,
      errorCount: aggregates.errorCount || 0,
      primaryHorizon: aggregates.primaryHorizon ?? null,
      fixedHorizonRows: aggregates.fixedHorizonRows || 0,
      fixedHorizonObserved: aggregates.fixedHorizonObserved || 0,
      fixedHorizonOutcomeMissing: aggregates.fixedHorizonOutcomeMissing || 0,
      fixedHorizonComplete: aggregates.fixedHorizonComplete || 0,
      fixedHorizonIncomplete: aggregates.fixedHorizonIncomplete || 0,
      groundedByHorizon: aggregates.groundedByHorizon || 0,
      groundedByHorizonRate: aggregates.groundedByHorizonRate || 0,
      meanCoverageAtHorizon: aggregates.meanCoverageAtHorizon ?? null,
      meanObservedCoverageAtHorizon: aggregates.meanObservedCoverageAtHorizon ?? null,
      coverageAtHorizonLowerBound: aggregates.coverageAtHorizonLowerBound ?? null,
      coverageAtHorizonUpperBound: aggregates.coverageAtHorizonUpperBound ?? null,
      horizonSafetyPassed: aggregates.horizonSafetyPassed || 0,
      horizonSafetyFailed: aggregates.horizonSafetyFailed || 0,
      horizonSafetyIncomplete: aggregates.horizonSafetyIncomplete || 0,
      horizonSafetyPassRate: aggregates.horizonSafetyPassRate || 0,
      horizonSafetyFailureRate: aggregates.horizonSafetyFailureRate || 0,
      horizonSafetyIncompleteRate: aggregates.horizonSafetyIncompleteRate || 0,
    },
    byPolicy: compactPolicyLedger(aggregates),
  };
}

function readLedgerEntries(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) return [];
  return fs
    .readFileSync(ledgerPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function markdownEscape(value) {
  return String(value ?? '')
    .replace(/\|/gu, '\\|')
    .replace(/\n/gu, ' ');
}

function formatLedgerPolicies(entry) {
  const policies = Array.isArray(entry.config?.policies) ? entry.config.policies : Object.keys(entry.byPolicy || {});
  return policies.join(', ');
}

function formatLedgerReports(entry) {
  const links = [];
  if (entry.report?.html) links.push(`[html](${entry.report.html})`);
  if (entry.report?.json) links.push(`[json](${entry.report.json})`);
  return links.join(' ');
}

function renderLedgerMarkdown(entries) {
  const lines = [
    '# Tutor Stub Auto-Eval Ledger',
    '',
    'This ledger is local/ignored and separate from the main evaluation database.',
    '',
    '| Recorded | Run | Policies | OK/Failed | Grounded | Mean Turns | Registers | Reports |',
    '|---|---|---|---:|---:|---:|---|---|',
  ];
  for (const entry of entries.slice().reverse()) {
    lines.push(
      [
        markdownEscape(entry.recordedAt || ''),
        markdownEscape(entry.runId || ''),
        markdownEscape(formatLedgerPolicies(entry)),
        `${entry.totals?.ok ?? 0}/${entry.totals?.failed ?? 0}`,
        markdownEscape(entry.totals?.groundedRate ?? ''),
        markdownEscape(entry.totals?.meanTurns ?? ''),
        markdownEscape(
          Object.entries(entry.totals?.registerCounts || {})
            .map(([key, value]) => `${key}:${value}`)
            .join(', '),
        ),
        formatLedgerReports(entry),
      ].join(' | '),
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function indexRootDir() {
  return resolvePath(args['index-root']);
}

function skipIndexScanDir(name) {
  return name === 'logs' || name === 'traces' || name.endsWith('-field-svg');
}

function listAutoEvalSummaryFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const files = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipIndexScanDir(entry.name)) stack.push(entryPath);
        continue;
      }
      if (/^auto-eval-.*\.json$/u.test(entry.name)) files.push(entryPath);
    }
  }
  return files;
}

function listAutoEvalRunStateFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const files = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipIndexScanDir(entry.name)) stack.push(entryPath);
        continue;
      }
      if (entry.name === 'run-state.json') files.push(entryPath);
    }
  }
  return files;
}

function listTutorStubExperimentPlanFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const files = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipIndexScanDir(entry.name)) stack.push(entryPath);
        continue;
      }
      if (entry.name === 'experiment-plan.json') files.push(entryPath);
    }
  }
  return files;
}

function indexPathIsWithin(filePath, parentDir) {
  if (!filePath || !parentDir) return false;
  const relative = path.relative(parentDir, filePath);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function reportHtmlPathForSummary(summary, jsonPath) {
  const sibling = jsonPath.replace(/\.json$/u, '.html');
  const reported = summary?.report?.html ? resolvePath(summary.report.html) : null;
  if (reported && fs.existsSync(reported)) return reported;
  if (fs.existsSync(sibling)) return sibling;
  return reported || sibling;
}

function reportFieldSvgFiles(htmlPath) {
  const svgDir = fieldSvgDirForReport(htmlPath);
  if (!fs.existsSync(svgDir)) return [];
  return fs
    .readdirSync(svgDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.svg'))
    .map((entry) => path.join(svgDir, entry.name))
    .sort();
}

function shortDate(value) {
  if (!value) return '';
  return String(value)
    .replace(/\.\d{3}Z$/u, 'Z')
    .replace('T', ' ');
}

function indexAggregates(summary) {
  if (summary?.aggregates?.byPolicy) return summary.aggregates;
  return summarizeRows(resultRows(summary?.results || []));
}

function indexNumberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function indexDetailRows(summary) {
  const rows = Array.isArray(summary?.rows) ? summary.rows : resultRows(summary?.results || []);
  return rows.map((row) => {
    const efficacyCounts = row.efficacyCounts || {};
    const efficacyTotal = Object.values(efficacyCounts).reduce((sum, value) => sum + Number(value || 0), 0);
    return {
      policy: row.policy || 'unknown',
      status: row.status || 'unknown',
      groundedClosure: row.groundedClosure === true,
      turnCount: indexNumberOrNull(row.turnCount),
      bestPathCoverage: indexNumberOrNull(row.bestPathCoverage),
      missingPremiseCount: indexNumberOrNull(row.missingPremiseCount),
      leakCount: Number(row.leakCount || 0),
      errorCount: Number(row.errorCount || 0),
      registerEntropy: indexNumberOrNull(row.registerEntropy),
      registerCounts: row.registerCounts || {},
      efficacyCounts,
      efficacyTotal,
      positiveProgress: Number(efficacyCounts.positive_progress || 0),
      finalMastery: indexNumberOrNull(row.field?.final?.learnerMastery),
      finalRisk: indexNumberOrNull(row.field?.final?.learnerRisk),
      masteryGain: indexNumberOrNull(row.field?.delta?.learnerMastery),
      riskReduction:
        row.field?.delta?.learnerRisk === undefined || row.field?.delta?.learnerRisk === null
          ? null
          : -Number(row.field.delta.learnerRisk),
    };
  });
}

function qaMatrixChildInfoForPath(filePath) {
  if (!filePath) return null;
  const resolved = resolvePath(String(filePath));
  const startDir = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory() ? resolved : path.dirname(resolved);
  let matrixRoot = '';
  let current = startDir;
  for (let depth = 0; depth < 8; depth += 1) {
    if (fs.existsSync(path.join(current, 'qa-plan.json'))) {
      matrixRoot = current;
      break;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  if (!matrixRoot) {
    const parts = resolved.split(path.sep).filter(Boolean);
    const matrixIndex = parts.findIndex((part) => /^qa-matrix-\d{4}-/u.test(part));
    if (matrixIndex === -1 || matrixIndex + 1 >= parts.length) return null;
    const rootPrefix = resolved.startsWith(path.sep) ? path.sep : '';
    matrixRoot = path.join(rootPrefix, ...parts.slice(0, matrixIndex + 1));
  }
  const relativeToMatrix = path.relative(matrixRoot, resolved).split(path.sep).filter(Boolean);
  const matrixId = path.basename(matrixRoot);
  const profile = relativeToMatrix[0];
  if (!profile || profile === 'logs' || profile === 'traces' || profile.endsWith('.json') || profile.endsWith('.md')) {
    return null;
  }
  return {
    kind: 'qa_matrix_child',
    matrixId,
    profile,
    matrixRoot,
    planPath: path.join(matrixRoot, 'qa-plan.json'),
  };
}

function qaMatrixChildInfoForSummary({ jsonPath = '', summary = {}, config = {} } = {}) {
  const candidates = [
    jsonPath,
    summary.report?.json,
    summary.report?.html,
    config.traceDir,
    summary.resume?.sourcePath,
  ].filter(Boolean);
  for (const candidate of candidates) {
    const info = qaMatrixChildInfoForPath(candidate);
    if (info) return info;
  }
  return null;
}

function reportScopeForSummary({ jsonPath = '', summary = {}, config = {}, rootDir = ROOT } = {}) {
  const qaChild = qaMatrixChildInfoForSummary({ jsonPath, summary, config });
  if (!qaChild) {
    return {
      kind: 'standalone',
      label: 'Standalone auto-eval',
      note: 'Standalone auto-eval report.',
      matrixId: '',
      profile: '',
      planHref: '',
      matrixRootHref: '',
      qaMatrixMarkdownHref: '',
      qaMatrixJsonHref: '',
      discriminationMarkdownHref: '',
      discriminationJsonHref: '',
    };
  }
  const artifactHref = (name) => {
    const artifactPath = path.join(qaChild.matrixRoot, name);
    return fs.existsSync(artifactPath) ? hrefRelative(rootDir, artifactPath) : '';
  };
  return {
    kind: qaChild.kind,
    label: `Profile: ${qaChild.profile}`,
    note: `Part of evaluation ${qaChild.matrixId}.`,
    matrixId: qaChild.matrixId,
    profile: qaChild.profile,
    matrixRootHref: hrefRelative(rootDir, qaChild.matrixRoot),
    planHref: artifactHref('qa-plan.json'),
    qaMatrixMarkdownHref: artifactHref('qa-matrix.md'),
    qaMatrixJsonHref: artifactHref('qa-matrix.json'),
    discriminationMarkdownHref: artifactHref('profile-discrimination.md'),
    discriminationJsonHref: artifactHref('profile-discrimination.json'),
  };
}

function reportScopeLinks(scope) {
  if (scope?.kind !== 'qa_matrix_child') return [];
  return [
    ['QA summary', scope.qaMatrixMarkdownHref],
    ['QA data', scope.qaMatrixJsonHref],
    ['profile gate', scope.discriminationMarkdownHref],
    ['gate data', scope.discriminationJsonHref],
    ['QA plan', scope.planHref],
  ].filter(([, href]) => Boolean(href));
}

function renderReportScopeBadge(scope) {
  if (scope?.kind === 'qa_matrix_child') {
    return `<span class="scope-badge matrix">${escapeHtml(scope.label)}</span>`;
  }
  return '';
}

function renderReportScopeNotice(scope) {
  if (scope?.kind !== 'qa_matrix_child') return '';
  const links = reportScopeLinks(scope)
    .map(([label, href]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`)
    .join(' ');
  return `<div class="scope-notice">
    <strong>Evaluation → Profile → Trial</strong>
    <p><b>${escapeHtml(scope.matrixId)}</b> → ${escapeHtml(scope.profile)}. Individual trials are listed below. ${links}</p>
  </div>`;
}

function indexRunKind({ reportName, summary, config, aggregates, status }) {
  if (config.dryRun || aggregates.dryRun === aggregates.rows || status === 'dry_run') return 'dry';
  const smokeText = [
    reportName,
    config.traceDir,
    summary?.resume?.sourcePath,
    summary?.report?.json,
    summary?.report?.html,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/(^|[^a-z0-9])smoke([^a-z0-9]|$)/u.test(smokeText)) return 'smoke';
  return 'real';
}

function indexRunKindLabel(kind) {
  if (kind === 'dry') return 'dry run';
  if (kind === 'smoke') return 'smoke run';
  return 'real run';
}

function readIndexSummary(jsonPath, rootDir) {
  try {
    const summary = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const aggregates = indexAggregates(summary);
    const config = summary.config || {};
    const sourceRows = Array.isArray(summary?.rows) ? summary.rows : resultRows(summary?.results || []);
    const adaptationEvidence = adaptationEvidenceForRows(sourceRows, summary);
    const htmlPath = reportHtmlPathForSummary(summary, jsonPath);
    const svgFiles = reportFieldSvgFiles(htmlPath);
    const detailRows = indexDetailRows(summary);
    const okDetailRows = detailRows.filter((row) => row.status === 'ok');
    const efficacyCounts = mergeCounts(okDetailRows.map((row) => row.efficacyCounts));
    const efficacyTotal = Object.values(efficacyCounts).reduce((sum, value) => sum + Number(value || 0), 0);
    const relJson = hrefRelative(rootDir, jsonPath);
    const relParent = path.dirname(relJson);
    const reportName =
      relParent && relParent !== '.'
        ? `${relParent}/${path.basename(jsonPath, '.json')}`
        : path.basename(jsonPath, '.json');
    const reportScope = reportScopeForSummary({ jsonPath, summary, config, rootDir });
    const policies =
      Array.isArray(config.policies) && config.policies.length
        ? config.policies
        : Object.keys(aggregates.byPolicy || {});
    const policyText = policies.join(' ');
    const completedAt = summary.completedAt || summary.startedAt || '';
    const completedMs =
      Date.parse(completedAt) || Date.parse(summary.startedAt || '') || fs.statSync(jsonPath).mtimeMs || 0;
    const status =
      config.dryRun || aggregates.dryRun === aggregates.rows
        ? 'dry_run'
        : aggregates.failed || aggregates.missing
          ? 'failed'
          : 'ok';
    const runKind = indexRunKind({ reportName, summary, config, aggregates, status });
    const htmlExists = fs.existsSync(htmlPath);
    return {
      reportName,
      reportScope,
      runKind,
      jsonPath,
      htmlPath,
      htmlExists,
      jsonHref: hrefRelative(rootDir, jsonPath),
      htmlHref: htmlExists ? hrefRelative(rootDir, htmlPath) : '',
      svgHref: svgFiles.length ? `${hrefRelative(rootDir, fieldSvgDirForReport(htmlPath))}/` : '',
      svgCount: svgFiles.length,
      completedAt,
      startedAt: summary.startedAt || '',
      status,
      policies,
      learnerProfile: config.autoLearnerProfileId || '',
      world: config.world || '',
      dagMode: config.dagMode || 'strict_dag',
      turns: config.turns || '',
      safetyTurns: config.safetyTurns ?? '',
      model: config.model || '',
      analysisModel: config.analysisModel || '',
      autoLearnerModel: config.autoLearnerModel || '',
      rows: aggregates.rows || 0,
      ok: aggregates.ok || 0,
      failed: aggregates.failed || 0,
      dryRun: aggregates.dryRun || 0,
      grounded: aggregates.grounded || 0,
      groundedRate: aggregates.groundedRate || 0,
      meanTurns: aggregates.meanTurns ?? '',
      meanCoverage: aggregates.meanCoverage ?? '',
      meanMissing: aggregates.meanMissing ?? '',
      leakCount: aggregates.leakCount || 0,
      registerEntropy: aggregates.registerEntropy ?? '',
      finalMastery: mean(okDetailRows.map((row) => row.finalMastery)),
      finalRisk: mean(okDetailRows.map((row) => row.finalRisk)),
      masteryGain: mean(okDetailRows.map((row) => row.masteryGain)),
      riskReduction: mean(okDetailRows.map((row) => row.riskReduction)),
      progressRate: efficacyTotal
        ? Number((Number(efficacyCounts.positive_progress || 0) / efficacyTotal).toFixed(3))
        : 0,
      adaptationEvidence,
      detailRows,
      policyText,
      completedMs,
      searchText: [
        reportName,
        reportScope.label,
        reportScope.note,
        reportScope.matrixId,
        reportScope.profile,
        runKind,
        indexRunKindLabel(runKind),
        status,
        policyText,
        config.autoLearnerProfileId,
        config.world,
        config.dagMode || 'strict_dag',
        config.turns,
        config.safetyTurns,
        config.model,
        config.analysisModel,
        config.autoLearnerModel,
        aggregates.rows ? `${aggregates.rows} rows` : '',
        aggregates.ok ? `${aggregates.ok} ok` : '',
        aggregates.failed ? `${aggregates.failed} failed` : '',
        aggregates.grounded ? `${aggregates.grounded} grounded` : '',
        shortDate(completedAt),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    };
  } catch (error) {
    return {
      reportName: path.basename(jsonPath, '.json'),
      reportScope: {
        kind: 'unknown',
        label: 'Unreadable report',
        note: 'Could not parse report summary.',
        matrixId: '',
        profile: '',
        planHref: '',
      },
      runKind: 'smoke',
      jsonPath,
      htmlPath: '',
      htmlExists: false,
      jsonHref: hrefRelative(rootDir, jsonPath),
      htmlHref: '',
      svgHref: '',
      svgCount: 0,
      completedAt: '',
      startedAt: '',
      status: 'failed',
      policies: [],
      learnerProfile: '',
      world: '',
      dagMode: 'strict_dag',
      turns: '',
      safetyTurns: '',
      model: '',
      analysisModel: '',
      autoLearnerModel: '',
      rows: 0,
      ok: 0,
      failed: 1,
      dryRun: 0,
      grounded: 0,
      groundedRate: 0,
      meanTurns: '',
      meanCoverage: '',
      meanMissing: '',
      leakCount: 0,
      registerEntropy: '',
      finalMastery: 0,
      finalRisk: 0,
      masteryGain: 0,
      riskReduction: 0,
      progressRate: 0,
      adaptationEvidence: null,
      detailRows: [],
      policyText: '',
      completedMs: fs.existsSync(jsonPath) ? fs.statSync(jsonPath).mtimeMs : 0,
      searchText: `${path.basename(jsonPath)} parse error`.toLowerCase(),
      parseError: error.message,
    };
  }
}

function readIndexRunState(statePath, rootDir) {
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const updatedMs = Date.parse(state.updatedAt || '') || fs.statSync(statePath).mtimeMs || 0;
    const stale = state.status === 'running' && Date.now() - updatedMs > 15 * 60 * 1000;
    const status = stale ? 'stale' : state.status || 'running';
    const relState = hrefRelative(rootDir, statePath);
    const relParent = path.dirname(relState);
    const runName = relParent && relParent !== '.' ? relParent : path.basename(path.dirname(statePath));
    const reportScope = reportScopeForSummary({
      jsonPath: statePath,
      summary: { report: { json: statePath } },
      config: state.config || {},
      rootDir,
    });
    const jobs = (state.jobs || []).map((job) => {
      const traceDir = job.traceDir ? resolvePath(job.traceDir) : '';
      const latestTrace = traceDir ? latestTraceFile(traceDir) : null;
      const logPath = job.log ? resolvePath(job.log) : '';
      return {
        ...job,
        logHref: logPath ? hrefRelative(rootDir, logPath) : '',
        traceHref: latestTrace ? hrefRelative(rootDir, latestTrace) : '',
        traceDirHref: traceDir ? hrefRelative(rootDir, traceDir) : '',
      };
    });
    const activeJobs = jobs.filter((job) => job.status === 'running');
    return {
      runName,
      reportScope,
      statePath,
      stateHref: relState,
      status,
      pid: state.pid || '',
      startedAt: state.startedAt || '',
      updatedAt: state.updatedAt || '',
      updatedMs,
      traceDir: state.traceDir || '',
      traceDirHref: state.traceDir ? hrefRelative(rootDir, resolvePath(state.traceDir)) : '',
      config: state.config || {},
      resume: state.resume || null,
      policies: state.config?.policies || [],
      learnerProfile: state.config?.autoLearnerProfileId || '',
      world: state.config?.world || '',
      dagMode: state.config?.dagMode || 'strict_dag',
      totals: state.totals || {},
      jobs,
      activeJobs,
      searchText: [
        runName,
        reportScope.label,
        reportScope.note,
        reportScope.matrixId,
        reportScope.profile,
        status,
        state.config?.autoLearnerProfileId,
        state.config?.world,
        state.config?.dagMode || 'strict_dag',
        ...(state.config?.policies || []),
        shortDate(state.startedAt || ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    };
  } catch (error) {
    return {
      runName: path.basename(path.dirname(statePath)),
      reportScope: {
        kind: 'unknown',
        label: 'Unreadable run state',
        note: 'Could not parse run-state file.',
        matrixId: '',
        profile: '',
        planHref: '',
      },
      statePath,
      stateHref: hrefRelative(rootDir, statePath),
      status: 'stale',
      pid: '',
      startedAt: '',
      updatedAt: '',
      updatedMs: fs.existsSync(statePath) ? fs.statSync(statePath).mtimeMs : 0,
      traceDir: '',
      traceDirHref: '',
      config: {},
      resume: null,
      policies: [],
      learnerProfile: '',
      world: '',
      dagMode: 'strict_dag',
      totals: { jobs: 0, completed: 0, active: 0, queued: 0, failed: 0 },
      jobs: [],
      activeJobs: [],
      searchText: `${path.basename(statePath)} parse error`.toLowerCase(),
      parseError: error.message,
    };
  }
}

function policyChips(policies) {
  if (!policies?.length) return '<span class="muted">none</span>';
  return policies.map((policy) => `<span class="chip">${escapeHtml(policy)}</span>`).join('');
}

function indexSelectOptions(values) {
  return values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
}

function formatIndexMeasure(value, digits = 3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return numeric.toFixed(digits).replace(/\.?0+$/u, '');
}

function renderIndexCoverageCell(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '<span class="muted">not scored</span>';
  const bounded = Math.max(0, Math.min(1, numeric));
  return `<div class="index-measure">
    <strong>${Math.round(bounded * 100)}% <span>evidence path</span></strong>
    <em>mean learner-DAG coverage ${escapeHtml(formatIndexMeasure(numeric))}</em>
  </div>`;
}

function indexReportActionLinks(row) {
  return `${
    row.htmlHref ? `<a href="${escapeHtml(row.htmlHref)}">report</a>` : '<span class="muted">report</span>'
  } <a href="${escapeHtml(row.jsonHref)}">json</a>`;
}

function renderIndexFieldSnapshotCell(row) {
  const count = Number(row.svgCount || 0);
  const label = `${count} field ${count === 1 ? 'snapshot' : 'snapshots'}`;
  const body = row.svgHref ? `<a href="${escapeHtml(row.svgHref)}">${escapeHtml(label)}</a>` : escapeHtml(label);
  return `<div class="index-measure">
    <strong>${body}</strong>
    <em>${count ? 'static SVG exports for inspection' : 'no exported field artifacts'}</em>
  </div>`;
}

function uniqueIndexValues(rows, selector) {
  return Array.from(
    new Set(
      rows
        .flatMap((row) => selector(row))
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function indexProgressBar(rate) {
  const bounded = Math.max(0, Math.min(1, Number(rate || 0)));
  return `<span class="live-progress" aria-label="${Math.round(bounded * 100)}% complete"><span style="width:${Math.round(
    bounded * 100,
  )}%"></span></span>`;
}

function renderLiveJob(job) {
  const coverage = job.coverage === null || job.coverage === undefined ? '' : ` · c${escapeHtml(job.coverage)}`;
  const bottleneck = job.bottleneck ? ` · ${escapeHtml(displayBottleneck(job.bottleneck))}` : '';
  const lastType = job.lastType ? ` · ${escapeHtml(job.lastType)}` : '';
  const links = [
    job.logHref ? `<a href="${escapeHtml(job.logHref)}">log</a>` : '',
    job.traceHref ? `<a href="${escapeHtml(job.traceHref)}">trace</a>` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return `<article class="live-job ${escapeHtml(job.status || 'queued')}">
    <div><strong>${escapeHtml(job.policy)} r${escapeHtml(job.runIndex)}</strong> <span>${escapeHtml(job.status || 'queued')}</span></div>
    <p>${escapeHtml(job.turns || 0)} turns${coverage}${bottleneck}${lastType}</p>
    <div class="live-links">${links || '<span class="muted">waiting for trace</span>'}</div>
  </article>`;
}

function renderLiveRuns(activeRuns) {
  if (!activeRuns.length) return '';
  return `<section class="live-runs" aria-label="Runs in progress">
    <div class="live-runs-head">
      <div>
        <h2><span class="live-dot"></span>Runs In Progress</h2>
        <p>Updated as active auto-eval workers write trace and log files. This page refreshes every 30 seconds while runs are visible.</p>
      </div>
      <span class="live-count">${escapeHtml(activeRuns.length)} active</span>
    </div>
    ${activeRuns
      .map((run) => {
        const totals = run.totals || {};
        const rate =
          totals.progressRate ?? (totals.jobs ? Number(totals.completed || 0) / Number(totals.jobs || 1) : 0);
        const activeJobs = run.activeJobs.length
          ? run.activeJobs
          : run.jobs.filter((job) => job.status !== 'queued').slice(-6);
        return `<article class="live-run-card ${escapeHtml(run.status)}" data-search="${escapeHtml(run.searchText)}">
          <div class="live-run-top">
            <div>
              <h3>${escapeHtml(run.runName)}</h3>
              <p>${escapeHtml(run.learnerProfile || 'unknown learner')} · ${escapeHtml(run.world || 'unknown world')} · ${escapeHtml(
                run.dagMode || 'strict_dag',
              )} · pid ${escapeHtml(run.pid || 'n/a')}</p>
            </div>
            <span class="status ${escapeHtml(run.status)}">${escapeHtml(run.status)}</span>
          </div>
          <div class="live-run-progress">
            ${indexProgressBar(rate)}
            <span>${escapeHtml(totals.completed || 0)}/${escapeHtml(totals.jobs || 0)} jobs · ${escapeHtml(totals.active || 0)} active · ${escapeHtml(
              totals.queued || 0,
            )} queued · ${escapeHtml(totals.failed || 0)} failed</span>
          </div>
          <div class="live-run-meta">
            <span>started ${escapeHtml(shortDate(run.startedAt))}</span>
            <span>updated ${escapeHtml(shortDate(run.updatedAt))}</span>
            <span>${policyChips(run.policies)}</span>
          </div>
          <div class="live-jobs">${activeJobs.map(renderLiveJob).join('\n') || '<span class="muted">No active jobs.</span>'}</div>
          <div class="live-actions">
            <a href="${escapeHtml(run.stateHref)}">state json</a>
            ${run.traceDirHref ? `<a href="${escapeHtml(run.traceDirHref)}">trace dir</a>` : ''}
          </div>
        </article>`;
      })
      .join('\n')}
  </section>`;
}

function meanIndexNumbers(values) {
  const finite = values
    .filter((value) => value !== null && value !== undefined)
    .map(Number)
    .filter(Number.isFinite);
  if (!finite.length) return null;
  return Number((finite.reduce((sum, value) => sum + value, 0) / finite.length).toFixed(3));
}

function formatIndexPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'n/a';
  return `${Math.round(numeric * 100)}%`;
}

function formatIndexField(value) {
  return value === null || value === undefined ? 'n/a' : formatFieldValue(value);
}

function formatIndexSigned(value) {
  return value === null || value === undefined ? 'n/a' : formatSignedField(value);
}

function formatIndexPositive(value) {
  return value === null || value === undefined ? 'n/a' : formatPositiveField(value);
}

function indexProjectionPoint(row, index = 0) {
  const meanTurns = Number(row.meanTurns);
  const turnEfficiency = Number.isFinite(meanTurns) ? clampField01(1 - meanTurns / 120) : 0;
  return {
    key: row.key,
    x: Number(row.closureRate || 0),
    y: turnEfficiency,
    z: Number(row.signalScore || 0),
    radius: Math.max(4, Math.min(18, 4 + Math.sqrt(Number(row.ok || 0)) * 2)),
    colorIndex: index,
    metrics: {
      ok: row.ok,
      failed: row.failed,
      closureRate: row.closureRate,
      meanTurns: row.meanTurns,
      meanCoverage: row.meanCoverage,
      leakCount: row.leakCount,
      signalScore: row.signalScore,
    },
  };
}

function recentIndexReportRows(rows, { limit = 12 } = {}) {
  return rows.filter((row) => row.runKind === 'real' && Number(row.ok || 0) > 0).slice(0, limit);
}

function indexReportTime(row = {}) {
  const parsed = Date.parse(row.completedAt || row.startedAt || '');
  if (Number.isFinite(parsed)) return parsed;
  const numeric = Number(row.completedMs || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function indexLatestReportByLearner(reportRows) {
  const byLearner = new Map();
  for (const row of reportRows) {
    const learner = row.learnerProfile || row.reportScope?.profile || 'default';
    if (!learner) continue;
    const existing = byLearner.get(learner);
    if (!existing || indexReportTime(row) > indexReportTime(existing)) {
      byLearner.set(learner, row);
    }
  }
  return [...byLearner.values()].sort((left, right) =>
    String(left.learnerProfile || left.reportScope?.profile || '').localeCompare(
      String(right.learnerProfile || right.reportScope?.profile || ''),
    ),
  );
}

function indexLearnerLensReports(rows, { activeRuns = [] } = {}) {
  const realReports = rows.filter((row) => row.runKind === 'real' && Number(row.ok || 0) > 0);
  const activeMatrixIds = new Set(activeRuns.map((run) => run.reportScope?.matrixId).filter(Boolean));
  const matrixGroups = new Map();
  for (const row of realReports) {
    const scope = row.reportScope || {};
    if (scope.kind !== 'qa_matrix_child' || !scope.matrixId) continue;
    if (!matrixGroups.has(scope.matrixId)) matrixGroups.set(scope.matrixId, []);
    matrixGroups.get(scope.matrixId).push(row);
  }
  const cohorts = [...matrixGroups.entries()]
    .map(([matrixId, groupRows]) => {
      const reports = indexLatestReportByLearner(groupRows);
      const activeProfiles = new Set(
        activeRuns
          .filter((run) => run.reportScope?.matrixId === matrixId)
          .map((run) => run.learnerProfile || run.reportScope?.profile)
          .filter(Boolean),
      );
      return {
        kind: 'qa_matrix_matched',
        matrixId,
        reports,
        profileCount: reports.length,
        rowCount: reports.reduce((sum, row) => sum + Number(row.ok || 0), 0),
        completedMs: Math.max(...reports.map(indexReportTime), 0),
        active: activeMatrixIds.has(matrixId),
        activeProfiles: [...activeProfiles],
      };
    })
    .filter((cohort) => cohort.profileCount >= 2)
    .sort(
      (left, right) =>
        Number(right.active) - Number(left.active) ||
        right.completedMs - left.completedMs ||
        right.profileCount - left.profileCount ||
        right.rowCount - left.rowCount,
    );
  const selected = cohorts[0];
  if (selected) {
    const selectedNames = new Set(selected.reports.map((row) => row.reportName).filter(Boolean));
    return {
      ...selected,
      label: `${selected.active ? 'current' : 'latest'} matched QA cohort`,
      note: `One latest report per learner profile from ${selected.matrixId}.`,
      omittedReportCount: realReports.filter((row) => !selectedNames.has(row.reportName)).length,
    };
  }
  const reports = recentIndexReportRows(rows);
  return {
    kind: 'recent_reports',
    matrixId: '',
    label: 'recent real reports',
    note: 'No comparable QA-matrix learner cohort was available, so this falls back to the recent real-report lens.',
    reports,
    profileCount: new Set(reports.map((row) => row.learnerProfile || 'default')).size,
    rowCount: reports.reduce((sum, row) => sum + Number(row.ok || 0), 0),
    completedMs: Math.max(...reports.map(indexReportTime), 0),
    active: false,
    activeProfiles: [],
    omittedReportCount: 0,
  };
}

function readIndexJsonArtifact(rootDir, href) {
  if (!href) return null;
  try {
    return JSON.parse(fs.readFileSync(path.resolve(rootDir, href), 'utf8'));
  } catch {
    return null;
  }
}

function inferStudyId(matrixId = '') {
  const normalized = String(matrixId || '')
    .replace(/^qa-matrix-/u, '')
    .replace(/-\d{4}-\d{2}-\d{2}t.*$/iu, '')
    .replace(/-(?:n\d+|v\d+|live|dry|smoke|rerun|retry)(?=-|$).*$/iu, '')
    .replace(/-\d{4}-\d{2}-\d{2}.*$/u, '')
    .replace(/-+$/u, '');
  return normalized || matrixId || 'unassigned-study';
}

function studyMetadataForCohort(matrixId, qaPlan = {}) {
  const declared = qaPlan.study && typeof qaPlan.study === 'object' ? qaPlan.study : {};
  return {
    id: qaPlan.studyId || declared.id || inferStudyId(matrixId),
    researchQuestion:
      qaPlan.researchQuestion ||
      declared.researchQuestion ||
      'Does the tutor change strategy in response to learner state, and does that adaptation improve grounded learning outcomes?',
    hypothesis: qaPlan.hypothesis || declared.hypothesis || '',
    primaryContrast: qaPlan.primaryContrast || declared.primaryContrast || '',
    decisionRule: qaPlan.decisionRule || declared.decisionRule || '',
    supersedes: qaPlan.supersedes || declared.supersedes || '',
    source: qaPlan.studyId || declared.id ? 'declared' : 'inferred',
  };
}

function cohortAdaptationModel(profileReports, policies, baselinePolicy) {
  const cells = [];
  for (const report of profileReports) {
    const evidence = report.adaptationEvidence;
    for (const policy of policies) {
      const row = evidence?.policies?.find((candidate) => candidate.policy === policy) || null;
      cells.push({
        profile: report.learnerProfile,
        policy,
        verdict: row?.verdict || 'pending',
        benefit: row?.benefit?.score ?? null,
        contingency: row?.contingency?.normalizedMutualInformation ?? null,
        positiveRate: row?.consequence?.positiveRate ?? null,
        transitionCount: row?.consequence?.transitionCount ?? 0,
        closureRate: row?.outcome?.closureRate ?? null,
        coverage: row?.outcome?.meanCoverage ?? null,
        technical: row?.validity?.technical || 'pending',
      });
    }
  }
  const nonBaseline = cells.filter((cell) => cell.policy !== baselinePolicy);
  const verdict = nonBaseline.some((cell) => cell.verdict === 'supported')
    ? 'supported'
    : nonBaseline.some((cell) => cell.verdict === 'mixed')
      ? 'mixed'
      : nonBaseline.length && nonBaseline.every((cell) => cell.verdict === 'contradicted')
        ? 'contradicted'
        : nonBaseline.some((cell) => cell.verdict === 'pending')
          ? 'pending'
          : 'not_established';
  const outcomeAchieved =
    profileReports.length > 0 && profileReports.every((report) => report.adaptationEvidence?.outcomeAchieved === true);
  const headline = outcomeAchieved
    ? verdict === 'supported'
      ? 'Outcome achieved; an adaptive advantage is supported in at least one matched profile.'
      : 'Outcome achieved; adaptation advantage not established.'
    : verdict === 'supported'
      ? 'Adaptation signal present, but outcome robustness is incomplete.'
      : 'Outcome and adaptation advantage are not yet established.';
  return {
    schema: 'machinespirits.tutor-stub.adaptation-matrix.v1',
    verdict,
    headline,
    outcomeAchieved,
    baselinePolicy,
    profiles: profileReports.map((report) => report.learnerProfile),
    policies,
    cells,
    note: 'Exploratory within-profile differences against the declared baseline. Cells do not imply causal proof.',
  };
}

function readTutorStubExperimentPlan(planPath) {
  try {
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    if (plan?.schema !== 'machinespirits.tutor-stub.experiment-plan.v1') return null;
    if (!Array.isArray(plan.arms) || !plan.arms.length) return null;
    return plan;
  } catch {
    return null;
  }
}

function latestIndexArtifact(items, timeSelector) {
  return (
    items.slice().sort((left, right) => Number(timeSelector(right) || 0) - Number(timeSelector(left) || 0))[0] || null
  );
}

function indexExperimentModels(rows, activeRuns, rootDir) {
  return listTutorStubExperimentPlanFiles(rootDir)
    .map((planPath) => {
      const plan = readTutorStubExperimentPlan(planPath);
      if (!plan) return null;
      const experimentRoot = path.dirname(planPath);
      const id = String(plan.id || path.basename(experimentRoot));
      const arms = plan.arms.map((arm, armIndex) => {
        const armId = String(arm.id || `arm-${armIndex + 1}`);
        const armPath = path.resolve(experimentRoot, arm.path || armId);
        const report = latestIndexArtifact(
          rows.filter((row) => indexPathIsWithin(row.jsonPath, armPath)),
          (row) => row.completedMs,
        );
        const active = latestIndexArtifact(
          activeRuns.filter((run) => indexPathIsWithin(run.statePath, armPath)),
          (run) => run.updatedMs,
        );
        const completedTrials = active ? Number(active.totals?.completed || 0) : Number(report?.rows || 0);
        const expectedTrials = active
          ? Number(active.totals?.jobs || 0)
          : Number(arm.expectedTrials || report?.rows || plan.expectedTrialsPerArm || 0);
        const status = active?.status || (report ? (report.failed ? 'attention' : 'completed') : 'pending');
        return {
          armId,
          learnerProfile: String(arm.label || armId),
          description: String(arm.description || ''),
          status,
          configuration: arm.configuration || {},
          completedTrials,
          expectedTrials,
          ok: active ? Number(active.totals?.ok || 0) : Number(report?.ok || 0),
          failed: active ? Number(active.totals?.failed || 0) : Number(report?.failed || 0),
          grounded: Number(report?.grounded || 0),
          groundedRate: report?.groundedRate ?? null,
          meanCoverage: report?.meanCoverage ?? null,
          meanTurns: report?.meanTurns ?? null,
          policies: report?.policies || active?.policies || arm.policies || plan.sharedConfig?.policies || [],
          model: report?.autoLearnerModel || active?.config?.autoLearnerModel || plan.sharedConfig?.model || '',
          completedAt: report?.completedAt || active?.updatedAt || '',
          htmlHref: report?.htmlHref || '',
          jsonHref: report?.jsonHref || '',
          stateHref: active?.stateHref || hrefRelative(rootDir, path.join(armPath, 'run-state.json')),
          artifactHref: `${hrefRelative(rootDir, armPath).replace(/\/$/u, '')}/`,
          activeJobs: active?.activeJobs || [],
          totals: active?.totals || null,
        };
      });
      const running = arms.filter((arm) => arm.status === 'running');
      const stale = arms.filter((arm) => arm.status === 'stale');
      const completedArms = arms.filter((arm) => arm.status === 'completed').length;
      const status = running.length
        ? 'running'
        : stale.length
          ? 'stale'
          : completedArms === arms.length
            ? 'completed'
            : 'pending';
      const trialsCompleted = arms.reduce((sum, arm) => sum + Number(arm.completedTrials || 0), 0);
      const trialsExpected = arms.reduce((sum, arm) => sum + Number(arm.expectedTrials || 0), 0);
      const failed = arms.reduce((sum, arm) => sum + Number(arm.failed || 0), 0);
      const completedMs = Math.max(
        ...arms.map((arm) => Date.parse(arm.completedAt || '') || 0),
        fs.statSync(planPath).mtimeMs,
      );
      const headline =
        status === 'completed'
          ? 'Data collection is complete; the declared paired analysis is ready to run.'
          : status === 'stale'
            ? 'Work in progress is stale; inspect the affected arm before interpreting partial data.'
            : `Work in progress: ${trialsCompleted}/${trialsExpected || '?'} planned trials have finished across ${arms.length} arms.`;
      return {
        kind: 'experiment_placeholder',
        id,
        key: hrefRelative(rootDir, experimentRoot),
        title: String(plan.title || id),
        status,
        decision: headline,
        decisionTone: status === 'stale' || failed ? 'attention' : 'pending',
        completedAt: new Date(completedMs).toISOString(),
        profiles: arms.map((arm) => arm.learnerProfile),
        policies: [...new Set(arms.flatMap((arm) => arm.policies || []))],
        baselinePolicy: String(plan.baselinePolicy || ''),
        completedProfiles: completedArms,
        expectedProfiles: arms.length,
        unitLabel: 'arm',
        progress: {
          trialsCompleted,
          trialsExpected,
          trialRate: trialsExpected ? Number((trialsCompleted / trialsExpected).toFixed(3)) : null,
          liveProfiles: arms
            .filter((arm) => arm.status === 'running' || arm.status === 'stale')
            .map((arm) => ({
              profile: arm.learnerProfile,
              status: arm.status,
              completedTrials: arm.completedTrials,
              expectedTrials: arm.expectedTrials,
              repairPass: false,
              retriedStatuses: [],
            })),
          lastActivityAt: new Date(completedMs).toISOString(),
        },
        ok: arms.reduce((sum, arm) => sum + Number(arm.ok || 0), 0),
        failed,
        grounded: arms.reduce((sum, arm) => sum + Number(arm.grounded || 0), 0),
        closureRate: null,
        meanCoverage: null,
        runningCount: running.length,
        staleCount: stale.length,
        topPolicy: null,
        discriminationGate: null,
        links: [
          { label: 'experiment plan', href: hrefRelative(rootDir, planPath) },
          { label: 'live report', href: `${hrefRelative(rootDir, experimentRoot).replace(/\/$/u, '')}/` },
        ],
        childReports: arms,
        adaptation: {
          schema: 'machinespirits.tutor-stub.adaptation-matrix.v1',
          verdict: 'pending',
          headline,
          outcomeAchieved: false,
          baselinePolicy: String(plan.baselinePolicy || ''),
          profiles: [],
          policies: [],
          cells: [],
          note: 'No comparative verdict is computed from an in-progress experiment placeholder.',
        },
        study: studyMetadataForCohort(id, plan),
        experiment: {
          factor: plan.factor || null,
          sharedConfig: plan.sharedConfig || {},
          measures: Array.isArray(plan.measures) ? plan.measures : [],
          analysisStatus: status === 'completed' ? 'ready' : 'waiting_for_all_arms',
          statusNote: String(plan.statusNote || ''),
        },
        lab3d: {
          eligible: false,
          reasons: ['paired analysis has not been generated'],
          linked2dRequired: true,
          drivesVerdict: false,
        },
      };
    })
    .filter(Boolean);
}

function indexCohortModels(rows, activeRuns, rootDir) {
  const buckets = new Map();
  const add = (scope, kind, value) => {
    if (scope?.kind !== 'qa_matrix_child' || !scope.matrixId) return;
    const key = scope.matrixRootHref || scope.matrixId;
    if (!buckets.has(key)) buckets.set(key, { key, scope, rows: [], activeRuns: [] });
    buckets.get(key)[kind].push(value);
  };
  rows.forEach((row) => add(row.reportScope, 'rows', row));
  activeRuns.forEach((run) => add(run.reportScope, 'activeRuns', run));

  const cohorts = [...buckets.values()]
    .map((bucket) => {
      const scope = bucket.scope || {};
      const latestReports = indexLatestReportByLearner(bucket.rows);
      if (!bucket.activeRuns.length && latestReports.length && latestReports.every((row) => row.runKind !== 'real'))
        return null;
      const qaPlan = readIndexJsonArtifact(rootDir, scope.planHref);
      const qaData = readIndexJsonArtifact(rootDir, scope.qaMatrixJsonHref);
      const discrimination = readIndexJsonArtifact(rootDir, scope.discriminationJsonHref);
      const matrix = qaData?.qaMatrix || {};
      const profiles = Array.isArray(matrix.learnerProfiles)
        ? matrix.learnerProfiles
        : Array.isArray(qaPlan?.profiles)
          ? qaPlan.profiles
          : [...new Set(latestReports.map((row) => row.learnerProfile).filter(Boolean))];
      const policies = Array.isArray(matrix.policies)
        ? matrix.policies
        : Array.isArray(qaPlan?.policies)
          ? qaPlan.policies
          : [...new Set(latestReports.flatMap((row) => row.policies || []))];
      const baselinePolicy =
        matrix.baselinePolicy || qaPlan?.baselinePolicy || (policies.includes('bland') ? 'bland' : '');
      const ok = latestReports.reduce((sum, row) => sum + Number(row.ok || 0), 0);
      const failed = latestReports.reduce((sum, row) => sum + Number(row.failed || 0), 0);
      const grounded = latestReports.reduce((sum, row) => sum + Number(row.grounded || 0), 0);
      const coverage = meanIndexNumbers(latestReports.map((row) => row.meanCoverage));
      const running = bucket.activeRuns.filter((run) => run.status === 'running');
      const stale = bucket.activeRuns.filter((run) => run.status === 'stale');
      const status = running.length ? 'running' : stale.length ? 'stale' : 'completed';
      const discriminationPass = typeof discrimination?.gate?.pass === 'boolean' ? discrimination.gate.pass : null;
      const decisionTone =
        status === 'running' || discriminationPass === null
          ? 'pending'
          : status === 'stale' || failed || discriminationPass === false
            ? 'attention'
            : 'pass';
      const topPolicy = (qaData?.policySummary || [])
        .slice()
        .sort((left, right) => Number(right.meanScore || 0) - Number(left.meanScore || 0))[0];
      const completedMs = Math.max(
        ...latestReports.map(indexReportTime),
        ...bucket.activeRuns.map((run) => Number(run.updatedMs || 0)),
        0,
      );
      const reportsByProfile = new Map(
        latestReports.map((row) => [row.learnerProfile || row.reportScope?.profile || 'default', row]),
      );
      const activeByProfile = new Map();
      for (const run of bucket.activeRuns) {
        const profile = run.learnerProfile || run.reportScope?.profile || 'default';
        const previous = activeByProfile.get(profile);
        if (!previous || Number(run.updatedMs || 0) > Number(previous.updatedMs || 0))
          activeByProfile.set(profile, run);
      }
      const profileNames = [...new Set([...profiles, ...reportsByProfile.keys(), ...activeByProfile.keys()])];
      const profileReports = profileNames.map((profile) => {
        const row = reportsByProfile.get(profile);
        const active = activeByProfile.get(profile);
        const completedTrials = active ? Number(active.totals?.completed || 0) : Number(row?.rows || 0);
        const expectedTrials = active
          ? Number(active.totals?.jobs || 0)
          : Number(row?.rows || (row?.policies?.length || policies.length) * Number(qaPlan?.runs || 0));
        return {
          learnerProfile: profile,
          status: active?.status || row?.status || 'pending',
          resume: active?.resume || null,
          completedTrials,
          expectedTrials,
          ok: active ? Number(active.totals?.ok || 0) : Number(row?.ok || 0),
          failed: active ? Number(active.totals?.failed || 0) : Number(row?.failed || 0),
          grounded: Number(row?.grounded || 0),
          groundedRate: row?.groundedRate ?? null,
          meanCoverage: row?.meanCoverage ?? null,
          meanTurns: row?.meanTurns ?? null,
          policies: row?.policies || active?.policies || policies,
          model: row?.autoLearnerModel || active?.config?.autoLearnerModel || '',
          completedAt: row?.completedAt || active?.updatedAt || '',
          htmlHref: row?.htmlHref || '',
          jsonHref: row?.jsonHref || '',
          stateHref: active?.stateHref || '',
          adaptationEvidence: row?.adaptationEvidence || null,
        };
      });
      const adaptation = cohortAdaptationModel(profileReports, policies, baselinePolicy);
      const trialsCompleted = profileReports.reduce((sum, report) => sum + Number(report.completedTrials || 0), 0);
      const trialsExpected = profileReports.reduce((sum, report) => sum + Number(report.expectedTrials || 0), 0);
      const liveProfiles = profileReports
        .filter((report) => report.status === 'running' || report.status === 'stale')
        .map((report) => ({
          profile: report.learnerProfile,
          status: report.status,
          completedTrials: Number(report.completedTrials || 0),
          expectedTrials: Number(report.expectedTrials || 0),
          repairPass: Boolean(report.resume),
          retriedStatuses: report.resume?.statuses || [],
        }));
      const progress = {
        trialsCompleted,
        trialsExpected,
        trialRate: trialsExpected ? Number((trialsCompleted / trialsExpected).toFixed(3)) : null,
        liveProfiles,
        lastActivityAt: completedMs ? new Date(completedMs).toISOString() : '',
      };
      const study = studyMetadataForCohort(scope.matrixId, qaPlan || {});
      const labReasons = [];
      if (!baselinePolicy) labReasons.push('declare a baseline policy');
      if (latestReports.length < profiles.length) labReasons.push('complete every planned profile');
      if (failed) labReasons.push('resolve technical failures');
      if (!adaptation.cells.some((cell) => cell.policy !== baselinePolicy && cell.transitionCount >= 3)) {
        labReasons.push('capture linked turn-transition evidence');
      }
      if (discriminationPass !== true) labReasons.push('pass the profile-discrimination validity gate');
      return {
        id: scope.matrixId,
        key: bucket.key,
        status,
        decision: adaptation.headline,
        decisionTone,
        completedAt: completedMs ? new Date(completedMs).toISOString() : '',
        profiles,
        policies,
        baselinePolicy,
        completedProfiles: latestReports.length,
        expectedProfiles: profiles.length,
        progress,
        ok,
        failed,
        grounded,
        closureRate: ok ? Number((grounded / ok).toFixed(3)) : 0,
        meanCoverage: coverage,
        runningCount: running.length,
        staleCount: stale.length,
        topPolicy: topPolicy
          ? {
              policy: topPolicy.policy,
              meanScore: topPolicy.meanScore,
              meanTurns: topPolicy.meanTurns,
              effectiveClosure: topPolicy.meanEffectiveClosure,
            }
          : null,
        discriminationGate: discrimination
          ? {
              pass: discriminationPass,
              mode: discrimination.gate?.mode || 'pooled',
              averagePairwiseCosine: discrimination.summary?.averagePairwiseCosine ?? null,
              maxSimilarityToControl: discrimination.summary?.maxSimilarityToControl ?? null,
              targetAverageCosine: discrimination.gate?.targetAverageCosine ?? null,
              targetMaxToControl: discrimination.gate?.targetMaxToControl ?? null,
              failedProfiles: (discrimination.gate?.conditioned?.profiles || [])
                .filter((profile) => profile.pass === false)
                .map((profile) => profile.profile),
            }
          : null,
        links: reportScopeLinks(scope).map(([label, href]) => ({ label, href })),
        childReports: profileReports,
        adaptation,
        study,
        lab3d: {
          eligible: labReasons.length === 0,
          reasons: labReasons,
          linked2dRequired: true,
          drivesVerdict: false,
        },
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const rank = { running: 3, completed: 2, stale: 1 };
      return (
        (rank[right.status] || 0) - (rank[left.status] || 0) ||
        Date.parse(right.completedAt) - Date.parse(left.completedAt)
      );
    });
  cohorts.push(...indexExperimentModels(rows, activeRuns, rootDir));
  cohorts.sort((left, right) => {
    const rank = { running: 4, pending: 3, completed: 2, stale: 1 };
    return (
      (rank[right.status] || 0) - (rank[left.status] || 0) ||
      Date.parse(right.completedAt || '') - Date.parse(left.completedAt || '')
    );
  });
  const byStudy = new Map();
  for (const cohort of cohorts) {
    const studyId = cohort.study?.id || 'unassigned-study';
    if (!byStudy.has(studyId)) byStudy.set(studyId, []);
    byStudy.get(studyId).push(cohort);
  }
  for (const studyCohorts of byStudy.values()) {
    const ordered = studyCohorts
      .slice()
      .sort((left, right) => Date.parse(left.completedAt || '') - Date.parse(right.completedAt || ''));
    ordered.forEach((cohort, index) => {
      cohort.lineage = {
        position: index + 1,
        total: ordered.length,
        previous: ordered[index - 1]?.id || '',
        next: ordered[index + 1]?.id || '',
        evaluations: ordered.map((item) => ({
          id: item.id,
          completedAt: item.completedAt,
          status: item.status,
          verdict: item.adaptation?.verdict || 'pending',
        })),
      };
    });
  }
  return cohorts;
}

function expandIndexDetailRows(reportRows) {
  return reportRows.flatMap((report) =>
    (report.detailRows || []).map((row) => ({
      ...row,
      reportName: report.reportName,
      learnerProfile: report.learnerProfile || 'default',
    })),
  );
}

function summarizeIndexDetailRows(rows) {
  const liveRows = rows.filter((row) => row.status !== 'dry_run');
  const okRows = liveRows.filter((row) => row.status === 'ok');
  const totalTurns = okRows.reduce((sum, row) => sum + Number(row.turnCount || 0), 0);
  const efficacyCounts = mergeCounts(okRows.map((row) => row.efficacyCounts));
  const efficacyTotal = Object.values(efficacyCounts).reduce((sum, value) => sum + Number(value || 0), 0);
  const leakCount = okRows.reduce((sum, row) => sum + Number(row.leakCount || 0), 0);
  const registerCounts = mergeCounts(okRows.map((row) => row.registerCounts));
  const registers = Object.entries(registerCounts).flatMap(([register, count]) =>
    Array.from({ length: Number(count || 0) }, () => register),
  );
  return {
    rows: liveRows.length,
    ok: okRows.length,
    failed: liveRows.filter((row) => row.status === 'failed').length,
    missing: liveRows.filter((row) => row.status === 'missing').length,
    grounded: okRows.filter((row) => row.groundedClosure).length,
    closureRate: okRows.length
      ? Number((okRows.filter((row) => row.groundedClosure).length / okRows.length).toFixed(3))
      : 0,
    meanTurns: meanIndexNumbers(okRows.map((row) => row.turnCount)),
    meanCoverage: meanIndexNumbers(okRows.map((row) => row.bestPathCoverage)),
    meanMissing: meanIndexNumbers(okRows.map((row) => row.missingPremiseCount)),
    finalMastery: meanIndexNumbers(okRows.map((row) => row.finalMastery)),
    finalRisk: meanIndexNumbers(okRows.map((row) => row.finalRisk)),
    masteryGain: meanIndexNumbers(okRows.map((row) => row.masteryGain)),
    riskReduction: meanIndexNumbers(okRows.map((row) => row.riskReduction)),
    registerEntropy: entropy(registers),
    progressRate: efficacyTotal
      ? Number((Number(efficacyCounts.positive_progress || 0) / efficacyTotal).toFixed(3))
      : 0,
    leakCount,
    leakDiscipline: clampField01(1 - leakCount / Math.max(1, totalTurns)),
    reportCount: new Set(rows.map((row) => row.reportName).filter(Boolean)).size,
  };
}

function indexSignalScore(stats) {
  const finalMastery = stats.finalMastery === null ? Number(stats.meanCoverage || 0) : Number(stats.finalMastery);
  const finalRisk = stats.finalRisk === null ? 0.5 : Number(stats.finalRisk);
  const masteryGain = stats.masteryGain === null ? 0 : Number(stats.masteryGain);
  const riskReduction = stats.riskReduction === null ? 0 : Number(stats.riskReduction);
  const turnEfficiency = clampField01(1 - Number(stats.meanTurns || 0) / 120);
  return roundField(
    0.22 * Number(stats.closureRate || 0) +
      0.16 * Number(stats.meanCoverage || 0) +
      0.14 * clampField01(finalMastery) +
      0.12 * clampField01(1 - finalRisk) +
      0.12 * clampField01(masteryGain) +
      0.1 * clampField01(riskReduction) +
      0.08 * Number(stats.leakDiscipline || 0) +
      0.04 * turnEfficiency +
      0.02 * Number(stats.progressRate || 0),
  );
}

function aggregateIndexDetailRows(rows, keyFn) {
  const buckets = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  return [...buckets.entries()].map(([key, bucketRows]) => {
    const stats = summarizeIndexDetailRows(bucketRows);
    return {
      key,
      ...stats,
      signalScore: indexSignalScore(stats),
    };
  });
}

function indexBigPictureBullets({ stats, policyStats, learnerStats, reports, learnerLens = null }) {
  if (!reports.length)
    return ['No completed real reports are available yet. Run or rebuild a report to populate the dashboard.'];
  const bullets = [];
  const coverageText =
    stats.meanCoverage === null
      ? 'coverage is not yet available'
      : `${formatIndexPercent(stats.meanCoverage)} mean evidence coverage`;
  bullets.push(
    `Recent lens covers ${reports.length} real report${reports.length === 1 ? '' : 's'} and ${stats.ok} completed row${
      stats.ok === 1 ? '' : 's'
    }: ${stats.grounded}/${stats.ok} reached closed proof-state (${formatIndexPercent(stats.closureRate)}), with ${coverageText}.`,
  );
  const topPolicy = policyStats[0];
  if (topPolicy) {
    bullets.push(
      `Strongest policy signal in this lens is ${topPolicy.key}: ${formatIndexPercent(topPolicy.closureRate)} closure, ${
        topPolicy.meanTurns === null ? 'n/a' : topPolicy.meanTurns
      } mean turns, final M/R ${formatIndexField(topPolicy.finalMastery)}/${formatIndexField(topPolicy.finalRisk)}, and ${topPolicy.leakCount} leak${
        topPolicy.leakCount === 1 ? '' : 's'
      }.`,
    );
  }
  if (learnerStats.length > 1) {
    const slowest = learnerStats
      .filter((row) => Number.isFinite(Number(row.meanTurns)))
      .slice()
      .sort((left, right) => Number(right.meanTurns) - Number(left.meanTurns))[0];
    const lensLabel = learnerLens?.kind === 'qa_matrix_matched' ? ` in the ${learnerLens.label}` : '';
    bullets.push(
      `Learner robustness is being checked across ${learnerStats.length} profile${
        learnerStats.length === 1 ? '' : 's'
      }${lensLabel}; ${
        slowest
          ? `${slowest.key} is currently the slowest at ${slowest.meanTurns} mean turns.`
          : 'turn counts are not yet comparable.'
      }`,
    );
  }
  if (stats.leakCount > 0) {
    bullets.push(
      `Main open caution is leak discipline: ${stats.leakCount} leak audit flag${
        stats.leakCount === 1 ? '' : 's'
      } appear in the recent lens, so closure should be read alongside proof safety.`,
    );
  }
  if (stats.failed > 0) {
    bullets.push(
      `There ${stats.failed === 1 ? 'is' : 'are'} ${stats.failed} failed row${
        stats.failed === 1 ? '' : 's'
      } in the recent lens; inspect those before treating policy differences as pedagogical effects.`,
    );
  }
  return bullets;
}

function indexLearnerRobustnessRead({ learnerStats, activeRuns = [], learnerLens = null }) {
  const rows = learnerStats.slice(0, 6);
  if (!rows.length) {
    return [
      {
        label: 'No Data',
        text: 'No learner-profile rows are available yet.',
      },
    ];
  }
  const comparable = rows.filter(
    (row) => Number.isFinite(Number(row.closureRate)) && Number.isFinite(Number(row.meanTurns)),
  );
  const strong = comparable.filter((row) => Number(row.closureRate) >= 0.95 && Number(row.meanCoverage || 0) >= 0.95);
  const turns = strong.map((row) => Number(row.meanTurns)).filter(Number.isFinite);
  const minTurns = turns.length ? Math.min(...turns) : null;
  const maxTurns = turns.length ? Math.max(...turns) : null;
  const weaker = comparable.filter((row) => Number(row.closureRate) < 0.95 || Number(row.meanCoverage || 0) < 0.95);
  const reportCounts = rows.map((row) => Number(row.reportCount || 0)).filter(Number.isFinite);
  const minReports = reportCounts.length ? Math.min(...reportCounts) : null;
  const maxReports = reportCounts.length ? Math.max(...reportCounts) : null;
  const notes = [
    learnerLens?.kind === 'qa_matrix_matched'
      ? {
          label: 'Matched Lens',
          text: `${learnerLens.label}: ${learnerLens.note} ${learnerLens.omittedReportCount} older or non-matching real report${
            learnerLens.omittedReportCount === 1 ? ' is' : 's are'
          } excluded from this learner-profile comparison.`,
        }
      : {
          label: 'Lens',
          text: learnerLens?.note || 'Learner rows are read from the same recent-report lens as the overall summary.',
        },
    {
      label: 'How To Read',
      text: 'Right means more closed proof-state. Up means fewer turns because the y-axis is turn efficiency. Larger bubbles mean more completed OK rows.',
    },
  ];
  const closureValues = comparable.map((row) => Number(row.closureRate)).filter(Number.isFinite);
  const coverageValues = comparable.map((row) => Number(row.meanCoverage)).filter(Number.isFinite);
  const allTurns = comparable.map((row) => Number(row.meanTurns)).filter(Number.isFinite);
  const closureSpread = closureValues.length ? Math.max(...closureValues) - Math.min(...closureValues) : null;
  const coverageSpread = coverageValues.length ? Math.max(...coverageValues) - Math.min(...coverageValues) : null;
  const turnSpread = allTurns.length ? Math.max(...allTurns) - Math.min(...allTurns) : null;
  if (strong.length >= Math.max(2, rows.length - 1)) {
    notes.push({
      label: 'Main Pattern',
      text: `${strong.length}/${rows.length} profiles cluster at high closure and full evidence coverage${
        minTurns !== null && maxTurns !== null ? `, with about ${minTurns.toFixed(1)}-${maxTurns.toFixed(1)} turns` : ''
      }. That reads as high learner robustness, not strong learner separation.`,
    });
  } else {
    notes.push({
      label: 'Main Pattern',
      text: `${strong.length}/${rows.length} profiles are currently in the high-closure/full-coverage region. The learner profile effect is not flat yet.`,
    });
  }
  if (
    rows.length > 1 &&
    closureSpread !== null &&
    coverageSpread !== null &&
    turnSpread !== null &&
    closureSpread <= 0.02 &&
    coverageSpread <= 0.02 &&
    turnSpread <= 2
  ) {
    notes.push({
      label: 'Differentiation',
      text: `Closure, evidence coverage, and turn counts are nearly flat in this matched lens. The current profiles are not drawing a strong learner-separation signal here; read cost, leaks, and policy deltas before scaling profile sweeps.`,
    });
  }
  if (weaker.length) {
    const weakerNames = weaker.map((row) => row.key).join(', ');
    const lensName = learnerLens?.label || 'learner lens';
    notes.push({
      label: 'Caution',
      text: `${weakerNames} ${weaker.length === 1 ? 'sits' : 'sit'} outside the main cluster in this ${lensName}. Treat that as provisional when report counts differ or a QA slice is still running.`,
    });
  } else if (minReports !== null && maxReports !== null && minReports !== maxReports) {
    notes.push({
      label: 'Caution',
      text: `Report counts vary from ${minReports} to ${maxReports}, so small differences should not be read as stable learner-profile effects yet.`,
    });
  }
  const activeLearners = activeRuns.map((run) => run.learnerProfile).filter(Boolean);
  if (activeLearners.length) {
    const sameMatrixActive =
      learnerLens?.matrixId &&
      activeRuns.some((run) => run.reportScope?.matrixId === learnerLens.matrixId && run.status !== 'completed');
    notes.push({
      label: 'Live Run',
      text: `${[...new Set(activeLearners)].join(', ')} still has an active slice${
        sameMatrixActive ? ` in ${learnerLens.matrixId}` : ''
      }; refresh after completion before treating this as final.`,
    });
  }
  notes.push({
    label: 'Where To Look',
    text: 'If closure and coverage are flat, the remaining differences are mostly turn cost, leaks, and policy/register behavior rather than basic learner reachability.',
  });
  return notes;
}

function renderIndexBigPicture({ rows, activeRuns = [], hiddenByDefault = 0 }) {
  const reports = recentIndexReportRows(rows);
  const detailRows = expandIndexDetailRows(reports);
  const stats = summarizeIndexDetailRows(detailRows);
  const learnerLens = indexLearnerLensReports(rows, { activeRuns });
  const learnerDetailRows = expandIndexDetailRows(learnerLens.reports);
  const policyStats = aggregateIndexDetailRows(detailRows, (row) => row.policy).sort(
    (left, right) => right.signalScore - left.signalScore || compareReportPolicies(left.key, right.key),
  );
  const learnerStats = aggregateIndexDetailRows(learnerDetailRows, (row) => row.learnerProfile).sort(
    (left, right) => right.closureRate - left.closureRate || Number(left.meanTurns || 0) - Number(right.meanTurns || 0),
  );
  const bullets = indexBigPictureBullets({ stats, policyStats, learnerStats, reports, learnerLens });
  const cautions = [
    hiddenByDefault
      ? `${hiddenByDefault} dry/smoke report${hiddenByDefault === 1 ? '' : 's'} are hidden from this lens by default.`
      : null,
    activeRuns.length
      ? `${activeRuns.length} run${activeRuns.length === 1 ? ' is' : 's are'} active or stale; refresh after completion for the final picture.`
      : null,
    reports.length < rows.filter((row) => row.runKind === 'real' && Number(row.ok || 0) > 0).length
      ? 'The headline uses the latest 12 real reports with completed rows; use filters below for older history.'
      : null,
  ].filter(Boolean);
  const policyRows = policyStats
    .slice(0, 7)
    .map(
      (row) => `<tr>
        <td><strong>${escapeHtml(row.key)}</strong></td>
        <td class="numeric">${escapeHtml(row.ok)}/${escapeHtml(row.failed)}</td>
        <td class="numeric">${escapeHtml(formatIndexPercent(row.closureRate))}</td>
        <td class="numeric">${escapeHtml(formatIndexField(row.meanCoverage))}</td>
        <td class="numeric">${escapeHtml(formatIndexField(row.finalMastery))}/${escapeHtml(formatIndexField(row.finalRisk))}</td>
        <td class="numeric">${escapeHtml(formatIndexSigned(row.masteryGain))}/${escapeHtml(formatIndexPositive(row.riskReduction))}</td>
        <td class="numeric">${escapeHtml(row.leakCount)}</td>
        <td class="numeric">${escapeHtml(formatIndexMeasure(row.signalScore))}</td>
      </tr>`,
    )
    .join('\n');
  const learnerVizRows = learnerStats.slice(0, 6);
  const learnerVizColors = ['#E63946', '#0057B8', '#009B72', '#F2B705', '#6B4EFF', '#D72670'];
  const learnerOk = learnerVizRows.reduce((sum, row) => sum + Number(row.ok || 0), 0);
  const learnerFailed = learnerVizRows.reduce((sum, row) => sum + Number(row.failed || 0), 0);
  const learnerClosure = meanIndexNumbers(learnerVizRows.map((row) => row.closureRate));
  const learnerCoverage = meanIndexNumbers(learnerVizRows.map((row) => row.meanCoverage));
  const learnerTurns = learnerVizRows.map((row) => Number(row.meanTurns)).filter(Number.isFinite);
  const learnerTurnRange = learnerTurns.length
    ? `${Number(Math.min(...learnerTurns).toFixed(1))}${
        Math.max(...learnerTurns) === Math.min(...learnerTurns)
          ? ''
          : `-${Number(Math.max(...learnerTurns).toFixed(1))}`
      }`
    : 'n/a';
  const learnerActiveProfiles = learnerLens.activeProfiles || [];
  const learnerKpis = [
    {
      label: 'Profiles',
      value: learnerVizRows.length || learnerLens.profileCount || 0,
      sub: learnerLens.label,
      color: '#0057B8',
    },
    {
      label: 'Closure',
      value: formatIndexPercent(learnerClosure),
      sub: 'mean across shown profiles',
      color: '#009B72',
    },
    {
      label: 'Coverage',
      value: formatIndexPercent(learnerCoverage),
      sub: 'mean evidence path',
      color: '#E63946',
    },
    {
      label: 'Turn Spread',
      value: learnerTurnRange,
      sub: 'lower is faster closure',
      color: '#F2B705',
    },
    {
      label: 'Rows',
      value: `${learnerOk}/${learnerFailed}`,
      sub: 'OK/failed in matched lens',
      color: '#6B4EFF',
    },
    {
      label: 'Live',
      value: learnerActiveProfiles.length ? learnerActiveProfiles.join(', ') : 'none',
      sub: learnerActiveProfiles.length ? 'slice still running' : 'no active learner slice',
      color: '#0A0A0A',
    },
  ]
    .map(
      (item) =>
        `<div class="learner-kpi" style="--kpi-accent:${escapeHtml(item.color)}"><span>${escapeHtml(
          item.label,
        )}</span><strong>${escapeHtml(item.value)}</strong><em>${escapeHtml(item.sub)}</em></div>`,
    )
    .join('\n');
  const learnerMiniBar = (label, value, color) => {
    const bounded = clampField01(value);
    return `<div class="learner-mini-bar"><span>${escapeHtml(label)}</span><span class="learner-mini-track"><span style="--bar-width:${Math.round(
      bounded * 100,
    )}%;--bar-color:${escapeHtml(color)}"></span></span><b>${Math.round(bounded * 100)}%</b></div>`;
  };
  const learnerProfileBars = learnerVizRows
    .map((row, index) => {
      const color = learnerVizColors[index % learnerVizColors.length];
      const turnEfficiency = Number.isFinite(Number(row.meanTurns)) ? clampField01(1 - Number(row.meanTurns) / 120) : 0;
      return `<article class="learner-rowbar" style="--row-accent:${escapeHtml(color)}">
        <div class="learner-rowbar-head"><strong>${escapeHtml(row.key)}</strong><span>${escapeHtml(row.ok)}/${escapeHtml(
          row.failed,
        )} rows</span></div>
        <div class="learner-mini-bars">
          ${learnerMiniBar('Closure', row.closureRate, color)}
          ${learnerMiniBar('Coverage', row.meanCoverage, '#0A0A0A')}
          ${learnerMiniBar('Speed', turnEfficiency, '#E63946')}
        </div>
      </article>`;
    })
    .join('\n');
  const learnerReadoutCards = indexLearnerRobustnessRead({ learnerStats, activeRuns, learnerLens })
    .map(
      (row) =>
        `<article class="learner-readout-card"><strong>${escapeHtml(row.label || 'Read')}</strong><p>${escapeHtml(
          row.text || '',
        )}</p></article>`,
    )
    .join('\n');
  return `<section class="big-picture" id="big-picture" aria-label="Big picture summary">
    <div class="big-picture-head">
      <div>
        <h2>Big Picture</h2>
        <p>Deterministic rollup over the latest real, completed reports. It summarizes closure, evidence coverage, policy signal, learner-profile robustness, and the main cautions before you open individual reports.</p>
      </div>
      <span class="live-count">${escapeHtml(reports.length)} report${reports.length === 1 ? '' : 's'}</span>
    </div>
    <div class="big-picture-grid">
      <div class="big-picture-panel">
        <h3>Overall Read</h3>
        <ul class="big-picture-read">
          ${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('\n')}
        </ul>
        ${
          cautions.length
            ? `<div class="big-picture-cautions">${cautions.map((caution) => `<div>${escapeHtml(caution)}</div>`).join('\n')}</div>`
            : ''
        }
      </div>
      <div class="big-picture-panel">
        <h3>Learner Robustness</h3>
        <p class="muted">${escapeHtml(learnerLens.label)} · ${escapeHtml(learnerLens.note)}</p>
        <div class="learner-infographic">
          <div class="learner-dashboard-grid">
            <div class="viz-frame">
              <div class="learner-profile-bars">${learnerProfileBars || '<span class="muted">No learner-profile rows yet.</span>'}</div>
              <div class="viz-caption"><span>Each learner bar shows closure, evidence coverage, and speed as normalized rates.</span><span>Use the dynamic index for the full scatter map when JavaScript is available.</span></div>
            </div>
            <div class="learner-snapshot">
              <div class="learner-snapshot-head"><div><strong>Learner Snapshot</strong><span>${escapeHtml(
                learnerLens.note,
              )}</span></div></div>
              <div class="learner-kpi-grid">${learnerKpis}</div>
            </div>
          </div>
          <div class="learner-readout">${learnerReadoutCards}</div>
        </div>
      </div>
    </div>
    <div class="table-scroll" role="region" aria-label="Policy signal table" tabindex="0">
      <table class="big-picture-table">
        <thead><tr>
          <th>Policy</th>
          <th>OK/Failed</th>
          <th>Closure</th>
          <th>Coverage</th>
          <th>Final M/R</th>
          <th>Gain/Reduction</th>
          <th>Leaks</th>
          <th>Signal</th>
        </tr></thead>
        <tbody>${policyRows || '<tr><td colspan="8">No policy rows yet.</td></tr>'}</tbody>
      </table>
    </div>
  </section>`;
}

function indexBigPictureModel({ rows, activeRuns = [], hiddenByDefault = 0 }) {
  const reports = recentIndexReportRows(rows);
  const detailRows = expandIndexDetailRows(reports);
  const stats = summarizeIndexDetailRows(detailRows);
  const learnerLens = indexLearnerLensReports(rows, { activeRuns });
  const learnerDetailRows = expandIndexDetailRows(learnerLens.reports);
  const policyStats = aggregateIndexDetailRows(detailRows, (row) => row.policy).sort(
    (left, right) => right.signalScore - left.signalScore || compareReportPolicies(left.key, right.key),
  );
  const learnerStats = aggregateIndexDetailRows(learnerDetailRows, (row) => row.learnerProfile).sort(
    (left, right) => right.closureRate - left.closureRate || Number(left.meanTurns || 0) - Number(right.meanTurns || 0),
  );
  const bullets = indexBigPictureBullets({ stats, policyStats, learnerStats, reports, learnerLens });
  const cautions = [
    hiddenByDefault
      ? `${hiddenByDefault} dry/smoke report${hiddenByDefault === 1 ? '' : 's'} are hidden from this lens by default.`
      : null,
    activeRuns.length
      ? `${activeRuns.length} run${activeRuns.length === 1 ? ' is' : 's are'} active or stale; refresh after completion for the final picture.`
      : null,
    reports.length < rows.filter((row) => row.runKind === 'real' && Number(row.ok || 0) > 0).length
      ? 'The headline uses the latest 12 real reports with completed rows; use filters below for older history.'
      : null,
  ].filter(Boolean);
  return {
    reportCount: reports.length,
    bullets,
    cautions,
    learnerLens: {
      kind: learnerLens.kind,
      matrixId: learnerLens.matrixId,
      label: learnerLens.label,
      note: learnerLens.note,
      profileCount: learnerLens.profileCount,
      rowCount: learnerLens.rowCount,
      omittedReportCount: learnerLens.omittedReportCount,
      active: learnerLens.active,
      activeProfiles: learnerLens.activeProfiles,
    },
    learnerReadout: indexLearnerRobustnessRead({ learnerStats, activeRuns, learnerLens }),
    policyStats: policyStats.slice(0, 7),
    learnerStats: learnerStats.slice(0, 6),
    projections: {
      axes: {
        x: 'closureRate',
        y: 'turnEfficiency',
        z: 'signalScore',
        radius: 'completedRows',
      },
      learners: learnerStats.slice(0, 6).map(indexProjectionPoint),
      policies: policyStats.slice(0, 7).map(indexProjectionPoint),
    },
  };
}

function indexRowData(row) {
  return {
    reportName: row.reportName || '',
    reportScope: row.reportScope || {
      kind: 'standalone',
      label: 'Standalone auto-eval',
      note: 'Standalone auto-eval report.',
      matrixId: '',
      profile: '',
      planHref: '',
    },
    runKind: row.runKind || 'real',
    htmlExists: Boolean(row.htmlExists),
    jsonHref: row.jsonHref || '',
    htmlHref: row.htmlHref || '',
    svgHref: row.svgHref || '',
    svgCount: Number(row.svgCount || 0),
    completedAt: row.completedAt || '',
    startedAt: row.startedAt || '',
    status: row.status || '',
    policies: row.policies || [],
    learnerProfile: row.learnerProfile || '',
    world: row.world || '',
    turns: row.turns || '',
    safetyTurns: row.safetyTurns ?? '',
    model: row.model || '',
    analysisModel: row.analysisModel || '',
    autoLearnerModel: row.autoLearnerModel || '',
    rows: Number(row.rows || 0),
    ok: Number(row.ok || 0),
    failed: Number(row.failed || 0),
    dryRun: Number(row.dryRun || 0),
    grounded: Number(row.grounded || 0),
    groundedRate: Number(row.groundedRate || 0),
    meanTurns: row.meanTurns ?? '',
    meanCoverage: row.meanCoverage ?? '',
    meanMissing: row.meanMissing ?? '',
    leakCount: Number(row.leakCount || 0),
    registerEntropy: row.registerEntropy ?? '',
    finalMastery: row.finalMastery ?? 0,
    finalRisk: row.finalRisk ?? 0,
    masteryGain: row.masteryGain ?? 0,
    riskReduction: row.riskReduction ?? 0,
    progressRate: row.progressRate ?? 0,
    adaptationEvidence: row.adaptationEvidence || null,
    detailRows: row.detailRows || [],
    policyText: row.policyText || '',
    completedMs: Number(row.completedMs || 0),
    searchText: row.searchText || '',
    parseError: row.parseError || '',
  };
}

function indexDataModel({ rows, activeRuns = [], rootDir, generatedAt }) {
  const guideHref = hrefRelative(rootDir, path.join(ROOT, 'docs', 'tutor-stub-arc-guide.html'));
  const defaultRows = rows.filter((row) => row.runKind === 'real');
  const hiddenByDefault = rows.length - defaultRows.length;
  const totals = {
    reports: defaultRows.length,
    htmlReports: defaultRows.filter((row) => row.htmlExists).length,
    totalReports: rows.length,
    ok: defaultRows.reduce((sum, row) => sum + Number(row.ok || 0), 0),
    failed: defaultRows.reduce((sum, row) => sum + Number(row.failed || 0), 0),
    dryRun: defaultRows.reduce((sum, row) => sum + Number(row.dryRun || 0), 0),
    grounded: defaultRows.reduce((sum, row) => sum + Number(row.grounded || 0), 0),
    svgs: defaultRows.reduce((sum, row) => sum + Number(row.svgCount || 0), 0),
    hiddenByDefault,
  };
  const cohorts = indexCohortModels(rows, activeRuns, rootDir);
  return {
    schema: 'machinespirits.tutor-stub.report-index-data.v2',
    generatedAt,
    rootLabel: path.relative(ROOT, rootDir) || '.',
    guideHref,
    refreshMs: 30000,
    totals,
    options: {
      status: uniqueIndexValues(rows, (row) => [row.status]),
      learner: uniqueIndexValues(rows, (row) => [row.learnerProfile]),
      policy: uniqueIndexValues(rows, (row) => row.policies || []),
      world: uniqueIndexValues(rows, (row) => [row.world]),
    },
    cohorts,
    bigPicture: indexBigPictureModel({ rows, activeRuns, hiddenByDefault }),
    rows: rows.map(indexRowData),
    activeRuns,
  };
}

function renderReportIndexShell({ rootDir, generatedAt }) {
  const assetVersion = encodeURIComponent(generatedAt || new Date().toISOString());
  const cssHref = `${hrefRelative(rootDir, path.join(rootDir, 'assets', 'tutor-stub-report.css'))}?v=${assetVersion}`;
  const appHref = `${hrefRelative(rootDir, path.join(rootDir, 'assets', 'tutor-stub-index.js'))}?v=${assetVersion}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tutor Stub Reports</title>
  <link rel="stylesheet" href="${escapeHtml(cssHref)}">
</head>
<body>
  <div id="tutor-stub-index-app" data-index-root data-index-data="index-data.json" data-generated-at="${escapeHtml(generatedAt)}">
    <header>
      <h1>Tutor Stub Reports</h1>
      <div class="muted">Loading report index...</div>
    </header>
  </div>
  <script src="${escapeHtml(appHref)}"></script>
</body>
</html>
`;
}

function renderTutorStubExperimentPlaceholderShell({ plan, planPath, rootDir }) {
  const experimentRoot = path.dirname(planPath);
  const id = String(plan.id || path.basename(experimentRoot));
  const title = String(plan.title || id);
  const cssHref = hrefRelative(experimentRoot, path.join(rootDir, 'assets', 'tutor-stub-report.css'));
  const consoleHref = `${hrefRelative(experimentRoot, path.join(rootDir, 'index.html'))}?evaluation=${encodeURIComponent(id)}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · work in progress</title>
  <link rel="stylesheet" href="${escapeHtml(cssHref)}">
  <style>
    .experiment-live-shell { max-width:1280px; margin:0 auto; }
    .experiment-live-head { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; }
    .experiment-live-head h1 { margin-bottom:4px; }
    .experiment-live-head nav { display:flex; flex-wrap:wrap; gap:8px; }
    .experiment-live-head nav a { border:2px solid var(--ink); box-shadow:3px 3px 0 var(--red-mark); padding:6px 9px; font-family:"JetBrains Mono",ui-monospace,monospace; font-size:10px; font-weight:800; text-transform:uppercase; }
    .experiment-live-arms { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:14px; margin-top:14px; }
    .experiment-live-arm { border:2px solid var(--ink); background:var(--paper); box-shadow:5px 5px 0 var(--ink); padding:12px; }
    .experiment-live-arm h3 { margin:3px 0; }
    .experiment-live-arm-meta { display:flex; flex-wrap:wrap; gap:6px 12px; align-items:center; margin:8px 0; font-size:11px; }
    .experiment-live-jobs { display:grid; gap:5px; margin-top:10px; }
    .experiment-live-job { display:grid; grid-template-columns:minmax(120px,1fr) auto; gap:8px; border-top:1px solid var(--ink); padding-top:5px; font-size:10px; }
    .experiment-live-job span:last-child { text-align:right; color:var(--ink-3); }
    @media (max-width:560px) { .experiment-live-head { display:block; } .experiment-live-head nav { margin-top:10px; } }
  </style>
</head>
<body>
  <div class="experiment-live-shell" data-experiment-live>
    <header class="experiment-live-head">
      <div><span class="cohort-eyebrow">Paired experiment · live placeholder</span><h1>${escapeHtml(title)}</h1><p class="muted">Live arm state refreshes every 15 seconds.</p></div>
      <nav><a href="${escapeHtml(consoleHref)}">Research console</a><a href="experiment-plan.json">Experiment plan</a></nav>
    </header>
    <main data-experiment-body><section class="cohort-card primary"><p>Loading run state…</p></section></main>
  </div>
  <script>
  (function () {
    var body = document.querySelector('[data-experiment-body]');
    function esc(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
    function pct(value) { var n = Number(value); return Number.isFinite(n) ? Math.round(Math.max(0,Math.min(1,n))*100) + '%' : 'pending'; }
    function status(state) {
      if (!state) return 'pending';
      var updated = Date.parse(state.updatedAt || '');
      return state.status === 'running' && Number.isFinite(updated) && Date.now() - updated > 900000 ? 'stale' : (state.status || 'pending');
    }
    function bar(completed, expected) {
      var rate = expected ? Math.max(0,Math.min(1,completed/expected)) : 0;
      return '<span class="live-progress" aria-label="' + Math.round(rate*100) + '% complete"><span style="width:' + Math.round(rate*100) + '%"></span></span>';
    }
    function armHtml(arm, state) {
      var totals = state && state.totals || {};
      var expected = Number(totals.jobs || arm.expectedTrials || 0);
      var completed = Number(totals.completed || 0);
      var jobs = state && state.jobs || [];
      var visible = jobs.filter(function (job) { return job.status !== 'queued'; }).slice(-8);
      var config = Object.entries(arm.configuration || {}).map(function (entry) { return entry[0] + ' ' + entry[1]; }).join(' · ');
      var jobRows = visible.map(function (job) {
        var detail = (job.turns || 0) + ' turns' + (job.coverage == null ? '' : ' · ' + pct(job.coverage) + ' coverage') + (job.bottleneck ? ' · ' + (job.bottleneck === 'grounded_asserted_secret' ? 'closed' : job.bottleneck) : '');
        return '<div class="experiment-live-job"><strong>' + esc(job.policy) + ' r' + esc(job.runIndex) + ' · ' + esc(job.status) + '</strong><span>' + esc(detail) + '</span></div>';
      }).join('');
      return '<article class="experiment-live-arm"><span class="cohort-eyebrow">' + esc(arm.id) + '</span><h3>' + esc(arm.label || arm.id) + '</h3><p>' + esc(arm.description || config || 'Declared experiment arm') + '</p><div class="experiment-live-arm-meta"><span class="status ' + esc(status(state)) + '">' + esc(status(state)) + '</span><strong>' + completed + '/' + (expected || '?') + ' trials</strong><span>' + Number(totals.active || 0) + ' active · ' + Number(totals.queued || 0) + ' queued · ' + Number(totals.failed || 0) + ' failed</span></div>' + bar(completed,expected) + '<div class="experiment-live-jobs">' + (jobRows || '<span class="muted">Waiting for the first trajectory.</span>') + '</div><div class="cohort-actions"><a href="' + esc((arm.path || arm.id).replace(/\\/$/,'') + '/run-state.json') + '">state json</a> <a href="' + esc((arm.path || arm.id).replace(/\\/$/,'') + '/') + '">artifacts</a></div></article>';
    }
    async function load() {
      try {
        var planResponse = await fetch('experiment-plan.json?ts=' + Date.now(), { cache:'no-store' });
        if (!planResponse.ok) throw new Error('experiment plan ' + planResponse.status);
        var plan = await planResponse.json();
        var states = await Promise.all((plan.arms || []).map(async function (arm) {
          try {
            var response = await fetch((arm.path || arm.id).replace(/\\/$/,'') + '/run-state.json?ts=' + Date.now(), { cache:'no-store' });
            return response.ok ? response.json() : null;
          } catch (error) { return null; }
        }));
        var totalExpected = 0, totalCompleted = 0, running = 0, failed = 0, completedArms = 0;
        states.forEach(function (state, index) {
          var totals = state && state.totals || {};
          totalExpected += Number(totals.jobs || plan.arms[index].expectedTrials || 0);
          totalCompleted += Number(totals.completed || 0);
          failed += Number(totals.failed || 0);
          if (status(state) === 'running') running += 1;
          if (status(state) === 'completed') completedArms += 1;
        });
        var allComplete = completedArms === (plan.arms || []).length;
        var headline = allComplete ? 'Data collection complete; paired analysis is ready.' : 'Work in progress: no comparative verdict is reported until every arm completes.';
        var study = plan.study || {};
        var question = plan.researchQuestion || study.researchQuestion || '';
        var factor = plan.factor || {};
        var factorRows = Object.entries(factor).filter(function (entry) { return entry[0] !== 'name'; }).map(function (entry) { return '<div><dt>' + esc(entry[0]) + '</dt><dd>' + esc(entry[1]) + '</dd></div>'; }).join('');
        body.innerHTML = '<section class="cohort-card primary"><div class="cohort-card-head"><div><span class="cohort-eyebrow">' + esc(plan.id || '${escapeHtml(id)}') + '</span><h2>' + esc(headline) + '</h2></div><span class="status ' + (allComplete ? 'completed' : running ? 'running' : 'pending') + '">' + (allComplete ? 'completed' : running ? 'running' : 'pending') + '</span></div><div class="evaluation-progress"><div class="evaluation-progress-track">' + bar(totalCompleted,totalExpected) + '<strong>' + totalCompleted + '/' + (totalExpected || '?') + ' trials finished</strong></div><div class="evaluation-progress-meta"><span>' + completedArms + '/' + (plan.arms || []).length + ' arms complete</span><span>' + failed + ' technical failures</span><span>updated ' + esc(new Date().toLocaleString()) + '</span></div><p class="evaluation-progress-note">This page refreshes live run-state files. Progress is operational evidence only; it does not establish the treatment effect.</p></div><section class="study-panel"><span class="cohort-eyebrow">Declared design</span><h4>Research question</h4><p>' + esc(question) + '</p><dl><div><dt>Primary contrast</dt><dd>' + esc(plan.primaryContrast || study.primaryContrast || '') + '</dd></div><div><dt>Decision rule</dt><dd>' + esc(plan.decisionRule || study.decisionRule || '') + '</dd></div><div><dt>Factor</dt><dd>' + esc(factor.name || '') + '</dd></div>' + factorRows + '</dl></section><div class="experiment-live-arms">' + (plan.arms || []).map(function (arm,index) { return armHtml(arm,states[index]); }).join('') + '</div></section>';
      } catch (error) {
        body.innerHTML = '<section class="cohort-card primary"><h2>Placeholder unavailable</h2><p>' + esc(error.message || error) + '</p></section>';
      }
      window.setTimeout(load, 15000);
    }
    load();
  })();
  </script>
</body>
</html>
`;
}

function writeTutorStubExperimentPlaceholderShells(rootDir) {
  for (const planPath of listTutorStubExperimentPlanFiles(rootDir)) {
    const plan = readTutorStubExperimentPlan(planPath);
    if (!plan) continue;
    fs.writeFileSync(
      path.join(path.dirname(planPath), 'index.html'),
      renderTutorStubExperimentPlaceholderShell({ plan, planPath, rootDir }),
    );
  }
}

function writeReportIndexAssets(rootDir) {
  const assetDir = path.join(rootDir, 'assets');
  fs.mkdirSync(assetDir, { recursive: true });
  fs.writeFileSync(path.join(assetDir, 'tutor-stub-report.css'), machineSpiritsReportCss());
  fs.writeFileSync(path.join(assetDir, 'tutor-stub-index.js'), `${tutorStubIndexClientJs()}\n`);
}

function _renderReportIndex({ rows, activeRuns = [], rootDir, generatedAt }) {
  const guideHref = hrefRelative(rootDir, path.join(ROOT, 'docs', 'tutor-stub-arc-guide.html'));
  const defaultRows = rows.filter((row) => row.runKind === 'real');
  const hiddenByDefault = rows.length - defaultRows.length;
  const totals = {
    reports: defaultRows.length,
    ok: defaultRows.reduce((sum, row) => sum + Number(row.ok || 0), 0),
    failed: defaultRows.reduce((sum, row) => sum + Number(row.failed || 0), 0),
    dryRun: defaultRows.reduce((sum, row) => sum + Number(row.dryRun || 0), 0),
    grounded: defaultRows.reduce((sum, row) => sum + Number(row.grounded || 0), 0),
    svgs: defaultRows.reduce((sum, row) => sum + Number(row.svgCount || 0), 0),
  };
  const groundedRate = totals.ok ? Number((totals.grounded / totals.ok).toFixed(3)) : 0;
  const statusOptions = uniqueIndexValues(rows, (row) => [row.status]);
  const learnerOptions = uniqueIndexValues(rows, (row) => [row.learnerProfile]);
  const policyOptions = uniqueIndexValues(rows, (row) => row.policies || []);
  const worldOptions = uniqueIndexValues(rows, (row) => [row.world]);
  const reportRows = rows
    .map(
      (row) => `<tr
        data-search="${escapeHtml(row.searchText)}"
        data-status="${escapeHtml(row.status)}"
        data-learner="${escapeHtml(row.learnerProfile || '')}"
        data-policies="${escapeHtml((row.policies || []).join('|'))}"
        data-policy-text="${escapeHtml(row.policyText || '')}"
        data-world="${escapeHtml(row.world || '')}"
        data-dag-mode="${escapeHtml(row.dagMode || 'strict_dag')}"
        data-completed-ms="${escapeHtml(row.completedMs || 0)}"
        data-report-name="${escapeHtml(row.reportName || '')}"
        data-run-kind="${escapeHtml(row.runKind || 'real')}"
        data-grounded-rate="${escapeHtml(row.groundedRate ?? '')}"
        data-turns="${escapeHtml(row.meanTurns ?? '')}"
        data-coverage="${escapeHtml(row.meanCoverage ?? '')}"
        data-rows="${escapeHtml(row.rows || 0)}"
        data-ok="${escapeHtml(row.ok || 0)}"
        data-failed="${escapeHtml(row.failed || 0)}"
        data-svgs="${escapeHtml(row.svgCount || 0)}">
        <td>
          <div><strong>${escapeHtml(shortDate(row.completedAt) || row.reportName)}</strong></div>
          <div class="muted">${escapeHtml(row.reportName)}</div>
          <div class="muted">${escapeHtml(row.world || '')} · ${escapeHtml(row.dagMode || 'strict_dag')} · ${escapeHtml(indexRunKindLabel(row.runKind || 'real'))}</div>
        </td>
        <td class="actions links-cell">${indexReportActionLinks(row)}</td>
        <td><span class="status ${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td>
        <td>${policyChips(row.policies)}</td>
        <td>
          <div>${escapeHtml(row.learnerProfile || '')}</div>
          <div class="muted">${escapeHtml(row.autoLearnerModel || '')}</div>
        </td>
        <td>${escapeHtml(row.ok)}/${escapeHtml(row.failed)}${row.dryRun ? ` · ${escapeHtml(row.dryRun)} dry` : ''}</td>
        <td>${escapeHtml(row.grounded)}/${escapeHtml(row.ok)} · ${Math.round(Number(row.groundedRate || 0) * 100)}%</td>
        <td>${escapeHtml(row.meanTurns)}</td>
        <td>${renderIndexCoverageCell(row.meanCoverage)}</td>
        <td>${renderIndexFieldSnapshotCell(row)}</td>
      </tr>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${activeRuns.length ? '<meta http-equiv="refresh" content="30">' : ''}
  <title>Tutor Stub Reports</title>
  <style>
    ${machineSpiritsReportCss()}
  </style>
</head>
<body>
  <header>
    <h1>Tutor Stub Reports</h1>
    <div class="muted">
      Generated ${escapeHtml(shortDate(generatedAt))} · root ${escapeHtml(path.relative(ROOT, rootDir) || '.')} ·
      <a href="${escapeHtml(guideHref || 'docs/tutor-stub-arc-guide.html')}">arc guide</a>
    </div>
  </header>
  <main>
    ${renderLiveRuns(activeRuns)}
    ${renderIndexBigPicture({ rows, activeRuns, hiddenByDefault })}
    <section class="metrics">
      ${htmlMetric('Reports', totals.reports, `${defaultRows.filter((row) => row.htmlExists).length} with HTML · ${rows.length} total`)}
      ${htmlMetric('Rows', totals.ok + totals.failed + totals.dryRun, `${totals.failed} failed · ${hiddenByDefault} hidden by default`)}
      ${htmlMetric('Grounded', `${totals.grounded}/${totals.ok}`, `${Math.round(groundedRate * 100)}% closure`)}
      ${htmlMetricInfo(
        'Field Snapshots',
        "Static SVG exports written beside reports for inspecting each row's interaction-field visualization. They are report artifacts, not scored rows.",
        totals.svgs,
        'static visualization exports',
      )}
      ${htmlMetric('Active', activeRuns.length, 'running or stale')}
    </section>
    <div class="toolbar">
      <label class="control">
        <span>Search</span>
        <input data-filter placeholder="Search reports, policies, learner, model" aria-label="Search reports">
      </label>
      <label class="control">
        <span>Run Set</span>
        <select data-scope-filter aria-label="Choose which reports to include">
          <option value="real" selected>Real runs</option>
          <option value="all">Everything</option>
        </select>
      </label>
      <label class="control">
        <span>From</span>
        <input type="date" data-date-from aria-label="Filter from completed date">
      </label>
      <label class="control">
        <span>To</span>
        <input type="date" data-date-to aria-label="Filter to completed date">
      </label>
      <label class="control">
        <span>Status</span>
        <select data-status-filter aria-label="Filter by status">
          <option value="">All</option>
          ${indexSelectOptions(statusOptions)}
        </select>
      </label>
      <label class="control">
        <span>Learner</span>
        <select data-learner-filter aria-label="Filter by learner">
          <option value="">All</option>
          ${indexSelectOptions(learnerOptions)}
        </select>
      </label>
      <label class="control">
        <span>Policy</span>
        <select data-policy-filter aria-label="Filter by policy">
          <option value="">All</option>
          ${indexSelectOptions(policyOptions)}
        </select>
      </label>
      <label class="control">
        <span>World</span>
        <select data-world-filter aria-label="Filter by world">
          <option value="">All</option>
          ${indexSelectOptions(worldOptions)}
        </select>
      </label>
      <label class="control">
        <span>Sort</span>
        <select data-sort-key aria-label="Sort reports">
          <option value="date">Date</option>
          <option value="status">Status</option>
          <option value="learner">Learner</option>
          <option value="policy">Policy</option>
          <option value="grounded">Grounded</option>
          <option value="coverage">Evidence Path</option>
          <option value="turns">Turns</option>
          <option value="rows">Rows</option>
          <option value="failed">Failed</option>
          <option value="svgs">Field Snapshots</option>
          <option value="report">Report</option>
        </select>
      </label>
      <label class="control">
        <span>Direction</span>
        <select data-sort-dir aria-label="Sort direction">
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
      </label>
      <button type="button" data-reset>Reset</button>
      <span class="muted" data-count>${defaultRows.length} shown</span>
    </div>
    <div class="table-scroll report-index-scroll" role="region" aria-label="Report table" tabindex="0">
    <table class="report-index-table">
      <thead><tr>
        <th>Completed</th>
        <th class="links-cell">Links</th>
        <th>${infoTerm('Status', 'Run-level technical status: ok has no failed rows, failed has one or more failed rows, dry_run is configuration-only output.')}</th>
        <th>Policies</th>
        <th>Learner</th>
        <th>${infoTerm('OK/Failed', 'OK rows completed without a technical failure. Failed rows are generation, resume, or evaluation failures.')}</th>
        <th>${infoTerm('Grounded', 'Rows where the learner reached grounded asserted-secret closure, shown as grounded over OK rows plus percentage.')}</th>
        <th>${infoTerm('Turns', 'Mean learner turns used by completed rows before grounded closure or another stop condition.')}</th>
        <th>${infoTerm('Evidence Path', 'Mean learner-DAG best-path coverage: how much of the target evidence path is grounded, shown as a percentage with the raw 0 to 1 coverage score underneath.')}</th>
        <th>${infoTerm('Field Snapshots', 'Count of static SVG exports emitted beside the report for inspecting per-row interaction-field visualizations. This is an artifact count, not an evaluation score.')}</th>
      </tr></thead>
      <tbody>${reportRows || '<tr><td colspan="10">No reports found.</td></tr>'}</tbody>
    </table>
    </div>
  </main>
  <script>
    const input = document.querySelector('[data-filter]');
    const scopeFilter = document.querySelector('[data-scope-filter]');
    const dateFrom = document.querySelector('[data-date-from]');
    const dateTo = document.querySelector('[data-date-to]');
    const statusFilter = document.querySelector('[data-status-filter]');
    const learnerFilter = document.querySelector('[data-learner-filter]');
    const policyFilter = document.querySelector('[data-policy-filter]');
    const worldFilter = document.querySelector('[data-world-filter]');
    const sortKey = document.querySelector('[data-sort-key]');
    const sortDir = document.querySelector('[data-sort-dir]');
    const reset = document.querySelector('[data-reset]');
    const tbody = document.querySelector('tbody');
    const rows = Array.from(document.querySelectorAll('tbody tr[data-search]'));
    const count = document.querySelector('[data-count]');
    const numericSortKeys = new Set(['date', 'grounded', 'coverage', 'turns', 'rows', 'failed', 'svgs']);
    const sortMap = {
      date: 'completedMs',
      status: 'status',
      learner: 'learner',
      policy: 'policyText',
      grounded: 'groundedRate',
      coverage: 'coverage',
      turns: 'turns',
      rows: 'rows',
      failed: 'failed',
      svgs: 'svgs',
      report: 'reportName',
    };
    function numberValue(row, key) {
      const value = Number(row.dataset[key] || '');
      return Number.isFinite(value) ? value : null;
    }
    function stringValue(row, key) {
      return String(row.dataset[key] || '').toLowerCase();
    }
    function dayStartMs(value) {
      if (!value) return null;
      const parsed = Date.parse(value + 'T00:00:00');
      return Number.isFinite(parsed) ? parsed : null;
    }
    function dayEndMs(value) {
      if (!value) return null;
      const parsed = Date.parse(value + 'T23:59:59.999');
      return Number.isFinite(parsed) ? parsed : null;
    }
    function compareValues(a, b, direction) {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      if (typeof a === 'number' && typeof b === 'number') {
        return direction === 'asc' ? a - b : b - a;
      }
      const base = String(a).localeCompare(String(b));
      return direction === 'asc' ? base : -base;
    }
    function rowMatches(row) {
      const q = (input?.value || '').trim().toLowerCase();
      const scope = scopeFilter?.value || 'real';
      const status = statusFilter?.value || '';
      const learner = learnerFilter?.value || '';
      const policy = policyFilter?.value || '';
      const world = worldFilter?.value || '';
      const fromMs = dayStartMs(dateFrom?.value || '');
      const toMs = dayEndMs(dateTo?.value || '');
      const completedMs = numberValue(row, 'completedMs');
      if (scope === 'real' && row.dataset.runKind !== 'real') return false;
      if (q && !row.dataset.search.includes(q)) return false;
      if (fromMs !== null && (completedMs === null || completedMs < fromMs)) return false;
      if (toMs !== null && (completedMs === null || completedMs > toMs)) return false;
      if (status && row.dataset.status !== status) return false;
      if (learner && row.dataset.learner !== learner) return false;
      if (world && row.dataset.world !== world) return false;
      if (policy && !String(row.dataset.policies || '').split('|').includes(policy)) return false;
      return true;
    }
    function applyIndexControls() {
      const key = sortKey?.value || 'date';
      const direction = sortDir?.value || 'desc';
      const datasetKey = sortMap[key] || 'completedMs';
      const sortedRows = rows.slice().sort((a, b) => {
        const aValue = numericSortKeys.has(key) ? numberValue(a, datasetKey) : stringValue(a, datasetKey);
        const bValue = numericSortKeys.has(key) ? numberValue(b, datasetKey) : stringValue(b, datasetKey);
        return compareValues(aValue, bValue, direction) || stringValue(a, 'reportName').localeCompare(stringValue(b, 'reportName'));
      });
      let shown = 0;
      for (const row of sortedRows) {
        const visible = rowMatches(row);
        row.hidden = !visible;
        if (visible) shown += 1;
        tbody?.appendChild(row);
      }
      if (count) count.textContent = shown + ' shown';
    }
    for (const control of [input, scopeFilter, dateFrom, dateTo, statusFilter, learnerFilter, policyFilter, worldFilter, sortKey, sortDir]) {
      control?.addEventListener(control === input ? 'input' : 'change', applyIndexControls);
    }
    reset?.addEventListener('click', () => {
      if (input) input.value = '';
      if (scopeFilter) scopeFilter.value = 'real';
      if (dateFrom) dateFrom.value = '';
      if (dateTo) dateTo.value = '';
      if (statusFilter) statusFilter.value = '';
      if (learnerFilter) learnerFilter.value = '';
      if (policyFilter) policyFilter.value = '';
      if (worldFilter) worldFilter.value = '';
      if (sortKey) sortKey.value = 'date';
      if (sortDir) sortDir.value = 'desc';
      applyIndexControls();
    });
    applyIndexControls();
  </script>
</body>
</html>
`;
}

function writeReportIndex({ rootDir = indexRootDir(), quiet = false, updateShell = true, updateAssets = true } = {}) {
  if (activeReadOnlySourceDir && pathIsWithin(rootDir, activeReadOnlySourceDir)) {
    if (!quiet) console.log(`[auto-eval] preserved read-only source index root ${rootDir}`);
    return path.join(rootDir, 'index.html');
  }
  fs.mkdirSync(rootDir, { recursive: true });
  const rows = listAutoEvalSummaryFiles(rootDir)
    .map((jsonPath) => readIndexSummary(jsonPath, rootDir))
    .sort((a, b) => {
      const aTime = Date.parse(a.completedAt || a.startedAt || '') || fs.statSync(a.jsonPath).mtimeMs;
      const bTime = Date.parse(b.completedAt || b.startedAt || '') || fs.statSync(b.jsonPath).mtimeMs;
      return bTime - aTime || a.reportName.localeCompare(b.reportName);
    });
  const activeRuns = listAutoEvalRunStateFiles(rootDir)
    .map((statePath) => readIndexRunState(statePath, rootDir))
    .filter((state) => !['completed', 'dry_run'].includes(state.status))
    .sort((a, b) => b.updatedMs - a.updatedMs || a.runName.localeCompare(b.runName));
  const generatedAt = new Date().toISOString();
  if (updateAssets) writeReportIndexAssets(rootDir);
  writeTutorStubExperimentPlaceholderShells(rootDir);
  const dataModel = indexDataModel({ rows, activeRuns, rootDir, generatedAt });
  writeJsonAtomic(path.join(rootDir, 'index-data.json'), dataModel);
  writeJsonAtomic(path.join(rootDir, 'index-research-data.json'), dataModel);
  writeJsonAtomic(path.join(rootDir, 'index-experiment-data.json'), {
    schema: 'machinespirits.tutor-stub.experiment-index-data.v1',
    generatedAt,
    cohorts: dataModel.cohorts.filter((cohort) => cohort.kind === 'experiment_placeholder'),
  });
  const indexPath = path.join(rootDir, 'index.html');
  const dynamicIndexPath = path.join(rootDir, 'index-dynamic.html');
  const dynamicShell = renderReportIndexShell({ rootDir, generatedAt });
  if (updateShell || !fs.existsSync(dynamicIndexPath)) {
    fs.writeFileSync(dynamicIndexPath, dynamicShell);
  }
  const existingShell = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
  const hasDynamicShell = existingShell.includes('data-index-root') && existingShell.includes('index-data.json');
  if (updateShell || !hasDynamicShell) {
    fs.writeFileSync(indexPath, dynamicShell);
  }
  if (!quiet) console.log(`[auto-eval] index ${indexPath}`);
  return indexPath;
}

function writeEvalLedger({ summary, summaryPath, htmlPath }) {
  if (args['no-ledger']) return;
  const ledgerPath = resolvePath(args.ledger);
  if (activeReadOnlySourceDir && pathIsWithin(ledgerPath, activeReadOnlySourceDir)) {
    console.log(`[auto-eval] preserved read-only source ledger root ${activeReadOnlySourceDir}`);
    return;
  }
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  const entry = ledgerEntryForSummary({ summary, summaryPath, htmlPath });
  const entries = readLedgerEntries(ledgerPath).filter((row) => row.report?.json !== entry.report?.json);
  entries.push(entry);
  fs.writeFileSync(ledgerPath, `${entries.map((row) => JSON.stringify(row)).join('\n')}\n`);
  const markdownPath = ledgerPath.replace(/\.jsonl$/u, '.md');
  fs.writeFileSync(markdownPath, renderLedgerMarkdown(entries));
  console.log(`[auto-eval] ledger ${ledgerPath}`);
  console.log(`[auto-eval] ledger ${markdownPath}`);
}

function writeReportFromSummary(summaryPath) {
  const resolvedSummaryPath = resolvePath(summaryPath);
  const sourceDir = path.dirname(resolvedSummaryPath);
  const sourceSealPath = path.join(sourceDir, 'run-seal.json');
  const sourceVerification = fs.existsSync(sourceSealPath) ? assertExperimentRun(sourceDir) : null;
  const sourceSummarySha256 = hashFile(resolvedSummaryPath);
  const summary = JSON.parse(fs.readFileSync(resolvedSummaryPath, 'utf8'));
  const traceDir = resolveTracePath(summary.config?.traceDir || path.dirname(resolvedSummaryPath), ROOT);
  for (const result of summary.results || []) {
    const refreshed = (result.traces || [])
      .map((tracePath) => resolveTracePath(tracePath, traceDir))
      .filter((tracePath) => tracePath && fs.existsSync(tracePath))
      .map((tracePath) =>
        summarizeTrace(tracePath, traceDir, {
          primaryHorizon: positiveInt(summary.config?.primaryHorizon || 16, 'summary.config.primaryHorizon'),
        }),
      );
    if (refreshed.length) {
      result.traceSummaries = refreshed;
    } else if (!Array.isArray(result.traceSummaries)) {
      result.traceSummaries = [];
    }
  }
  const rows = resultRows(summary.results || []);
  summary.aggregates = summarizeRows(rows);
  summary.rows = rows;
  summary.adaptationEvidence = adaptationEvidenceForRows(rows, summary);
  summary.evidence = {
    runPlan: path.join(traceDir, 'run-plan.json'),
    runEvents: path.join(traceDir, 'run-events.jsonl'),
    runSeal: path.join(traceDir, 'run-seal.json'),
  };
  const derivedDir = uniqueSiblingDirectory(sourceDir, 'derived');
  fs.mkdirSync(derivedDir, { recursive: false });
  const derivedSummaryPath = path.join(derivedDir, `${path.basename(resolvedSummaryPath, '.json')}-derived.json`);
  const derivedHtmlPath = derivedSummaryPath.replace(/\.json$/u, '.html');
  summary.derivedFrom = {
    sourceSummary: posixRelative(resolvedSummaryPath),
    sourceSummarySha256,
    sourceRunId: sourceVerification?.plan?.runId || null,
    sourcePlanSha256: sourceVerification?.seal?.planSha256 || null,
    sourceSealSha256: sourceVerification ? hashFile(sourceSealPath) : null,
    sourceVerified: Boolean(sourceVerification),
    derivedAt: new Date().toISOString(),
  };
  summary.report = {
    ...(summary.report || {}),
    json: derivedSummaryPath,
    html: derivedHtmlPath,
  };
  writeJsonAtomic(derivedSummaryPath, summary);
  writeHtmlReport({ summary, rows, htmlPath: derivedHtmlPath, updateIndex: false });
  writeEvalLedger({ summary, summaryPath: derivedSummaryPath, htmlPath: derivedHtmlPath });
  console.log(`[auto-eval] ${sourceVerification ? 'verified sealed source; ' : ''}preserved ${resolvedSummaryPath}`);
  console.log(`[auto-eval] derived summary ${derivedSummaryPath}`);
  console.log(`[auto-eval] derived report ${derivedHtmlPath}`);
  return { sourcePath: resolvedSummaryPath, derivedDir, summaryPath: derivedSummaryPath, htmlPath: derivedHtmlPath };
}

function tutorStubArgs({ policy, runIndex, totalRuns, traceDir }) {
  const autoTurns = turnsArg();
  const registerPalette = policy === 'negative' ? 'negative' : args['register-palette'];
  const command = [
    'scripts/tutor-stub.js',
    '--lab',
    'automated_eval',
    '--model-call-budget',
    String(positiveInt(args['model-call-budget'], '--model-call-budget')),
    '--auto-learner',
    '--auto-turns',
    autoTurns,
    '--auto-safety-turns',
    String(positiveInt(args['safety-turns'], '--safety-turns')),
    '--model',
    args.model,
    '--classifier-model',
    args['analysis-model'],
    '--learner-record-model',
    args['analysis-model'],
    '--auto-learner-model',
    args['auto-learner-model'],
    '--auto-learner-profile',
    resolvedAutoLearnerProfile(),
    '--tutor-learner-dag',
    '--world',
    args.world,
    '--dag-mode',
    args['dag-mode'],
    '--register-policy',
    policy,
    '--register-palette',
    registerPalette,
    '--register-temperature',
    String(
      normalizeTutorStubEngagementStanceTemperature(args['register-temperature'], { label: '--register-temperature' }),
    ),
    '--register-overlay-threshold',
    String(
      normalizeTutorStubRegisterOverlayThreshold(args['register-overlay-threshold'], {
        label: '--register-overlay-threshold',
      }),
    ),
    '--dag-fact-dropout',
    String(normalizeTutorStubDagFactDropoutRate(args['dag-fact-dropout'], { label: '--dag-fact-dropout' })),
    '--dag-fact-dropout-seed',
    String(normalizeTutorStubDagFactDropoutSeed(args['dag-fact-dropout-seed'], { label: '--dag-fact-dropout-seed' })),
    '--release-speed',
    String(normalizeTutorStubReleaseSpeed(args['release-speed'], { label: '--release-speed' })),
    '--run-seed',
    String(normalizeTutorStubDagFactDropoutSeed(args['run-seed'], { label: '--run-seed' })),
    '--eval-repeat',
    String(runIndex),
    '--eval-job-id',
    `${safeSlug(policy)}-r${runIndex}`,
    '--trace-dir',
    traceDir,
    ...requiredTutorStubArtifactArchiveArgs(),
    '--loop-mode',
    normalizeTutorStubLoopMode(args['loop-mode'], { label: '--loop-mode' }),
    '--no-stream',
    '--no-interim-animation',
  ];
  if (!args['no-dag']) command.push('--dag');
  if (args['no-stop-on-grounded']) command.push('--no-auto-stop-on-grounded');
  if (args['pressure-turns']) command.push('--pressure-turns', args['pressure-turns']);
  if (args['point-of-action-arm']) {
    command.push('--point-of-action-arm', normalizeTutorStubPointOfActionArm(args['point-of-action-arm']));
  }
  if (args['standing-instructions-file']) {
    command.push('--standing-instructions-file', args['standing-instructions-file']);
  }
  if (args['first-message']) command.push('--once', args['first-message']);
  if (args['cli-effort']) command.push('--cli-effort', args['cli-effort']);
  if (args['max-tokens']) command.push('--max-tokens', String(positiveInt(args['max-tokens'], '--max-tokens')));
  if (args['history-turns'])
    command.push('--history-turns', String(positiveInt(args['history-turns'], '--history-turns')));
  if (args['learner-analysis-prompt-profile']) {
    command.push('--learner-analysis-prompt-profile', args['learner-analysis-prompt-profile']);
  }
  if (args['no-memory-summary']) command.push('--no-memory-summary');
  command.push('--learner', `Automated learner run ${runIndex}/${totalRuns} for policy ${policy}.`);
  return command;
}

function buildJobs({ policies, runs, traceDir, parallelism, interleavePolicies = false }) {
  // Default order is policy-major (all runs of policy A, then B, ...), which
  // bands provider timing and quota windows with the policy factor. With
  // --interleave-policies the order is run-index-major (round-robin across
  // policies), spreading each policy across the run's wall-clock windows.
  // Both orders are deterministic functions of the CLI args.
  const pairs = [];
  if (interleavePolicies) {
    for (let runIndex = 1; runIndex <= runs; runIndex += 1) {
      for (const policy of policies) pairs.push({ policy, runIndex });
    }
  } else {
    for (const policy of policies) {
      for (let runIndex = 1; runIndex <= runs; runIndex += 1) pairs.push({ policy, runIndex });
    }
  }
  const jobs = [];
  for (const { policy, runIndex } of pairs) {
    const key = `${safeSlug(policy)}-r${runIndex}`;
    const childTraceDir = parallelism > 1 ? path.join(traceDir, 'traces', key) : traceDir;
    const logPath = path.join(traceDir, 'logs', `${key}.log`);
    const childArgs = tutorStubArgs({ policy, runIndex, totalRuns: runs, traceDir: childTraceDir });
    assertSupportedChildArgs(childArgs);
    jobs.push({
      ordinal: jobs.length + 1,
      policy,
      runIndex,
      runs,
      key,
      traceDir: childTraceDir,
      logPath,
      warrantGateMode: resolveTutorStubWarrantGateMode(args['warrant-gate']),
      warrantChallengeResistance: resolveWarrantChallengeResistance(args['warrant-challenge-resistance']),
      childArgs,
    });
  }
  return jobs;
}

function buildResumePlan(summaryPath) {
  const resolvedSummaryPath = resolvePath(summaryPath);
  const sourceDir = path.dirname(resolvedSummaryPath);
  const sourceSealPath = path.join(sourceDir, 'run-seal.json');
  const source = JSON.parse(fs.readFileSync(resolvedSummaryPath, 'utf8'));
  const traceDir = uniqueSiblingDirectory(sourceDir, 'resume');
  const retryStatuses = new Set(csv(args['resume-statuses']));
  // The rows we are about to re-run legitimately have no draw decisions (a
  // failed or window-killed dialogue never drew), so exempt exactly those job
  // ids from the source's draw-contract check. Every other integrity check
  // (event chain, replay of rows that did draw, model provenance, inventory,
  // seal) still gates the source before it can seed the resume.
  const exemptDrawContractJobIds = new Set(
    (source.results || [])
      .filter((result) => retryStatuses.has(result.status))
      .map((result) => result.key)
      .filter(Boolean),
  );
  let sourceVerification = null;
  if (fs.existsSync(sourceSealPath)) {
    const verification = verifyExperimentRun(sourceDir, { exemptDrawContractJobIds });
    if (!verification.ok) {
      throw new Error(`Resume source verification failed:\n- ${verification.errors.join('\n- ')}`);
    }
    sourceVerification = verification;
  }
  const parallelism = positiveInt(args.parallelism, '--parallelism');
  const runSeed = normalizeTutorStubDagFactDropoutSeed(
    RUN_SEED_OVERRIDE ? args['run-seed'] : (source.config?.runSeed ?? args['run-seed']),
    { label: '--run-seed' },
  );
  const warrantGateMode = resolveTutorStubWarrantGateMode(
    WARRANT_GATE_OVERRIDE ? args['warrant-gate'] : source.config?.warrantGateMode || args['warrant-gate'],
  );
  const warrantChallengeResistance = resolveWarrantChallengeResistance(
    WARRANT_CHALLENGE_RESISTANCE_OVERRIDE
      ? args['warrant-challenge-resistance']
      : source.config?.warrantChallengeResistance || args['warrant-challenge-resistance'],
  );
  const savedModelCallBudget = (source.results || [])
    .map((result) => {
      const command = Array.isArray(result.command) ? result.command : [];
      const childArgs = command[0] === 'node' ? command.slice(1) : command;
      return flagValue(childArgs, '--model-call-budget');
    })
    .find(Boolean);
  const modelCallBudget = positiveInt(
    MODEL_CALL_BUDGET_OVERRIDE
      ? args['model-call-budget']
      : (source.config?.modelCallBudget ?? savedModelCallBudget ?? args['model-call-budget']),
    '--model-call-budget',
  );
  const retainedResults = [];
  const jobs = [];

  for (const result of source.results || []) {
    if (!retryStatuses.has(result.status)) {
      retainedResults.push(result);
      continue;
    }
    const command = Array.isArray(result.command) ? result.command : null;
    if (!command || command.length < 2) {
      throw new Error(
        `Cannot resume ${result.policy || 'unknown'} run ${result.runIndex || '?'}: missing saved command`,
      );
    }
    const childArgs = command[0] === 'node' ? command.slice(1) : command;
    let adjustedChildArgs = withFlagValue(childArgs, '--lab', 'automated_eval');
    adjustedChildArgs = withFlagValue(adjustedChildArgs, '--model-call-budget', modelCallBudget);
    adjustedChildArgs = withFlagValue(
      adjustedChildArgs,
      '--model',
      MODEL_OVERRIDE ? args.model : flagValue(childArgs, '--model') || source.config?.model || args.model,
    );
    adjustedChildArgs = withFlagValue(
      adjustedChildArgs,
      '--classifier-model',
      ANALYSIS_MODEL_OVERRIDE
        ? args['analysis-model']
        : flagValue(childArgs, '--classifier-model') || source.config?.analysisModel || args['analysis-model'],
    );
    adjustedChildArgs = withFlagValue(
      adjustedChildArgs,
      '--learner-record-model',
      ANALYSIS_MODEL_OVERRIDE
        ? args['analysis-model']
        : flagValue(childArgs, '--learner-record-model') || source.config?.analysisModel || args['analysis-model'],
    );
    adjustedChildArgs = withFlagValue(
      adjustedChildArgs,
      '--auto-learner-model',
      AUTO_LEARNER_MODEL_OVERRIDE
        ? args['auto-learner-model']
        : flagValue(childArgs, '--auto-learner-model') || source.config?.autoLearnerModel || args['auto-learner-model'],
    );
    adjustedChildArgs = withFlagValue(
      adjustedChildArgs,
      '--max-tokens',
      args['max-tokens'] ? positiveInt(args['max-tokens'], '--max-tokens') : '',
    );
    adjustedChildArgs = withFlagValue(
      adjustedChildArgs,
      '--history-turns',
      args['history-turns'] ? positiveInt(args['history-turns'], '--history-turns') : '',
    );
    adjustedChildArgs = withFlagValue(
      adjustedChildArgs,
      '--learner-analysis-prompt-profile',
      LEARNER_ANALYSIS_PROMPT_PROFILE_OVERRIDE ? args['learner-analysis-prompt-profile'] : '',
    );
    adjustedChildArgs = withFlagValue(
      adjustedChildArgs,
      '--register-temperature',
      ENGAGEMENT_STANCE_TEMPERATURE_OVERRIDE
        ? normalizeTutorStubEngagementStanceTemperature(args['register-temperature'], {
            label: '--register-temperature',
          })
        : '',
    );
    adjustedChildArgs = withFlagValue(
      adjustedChildArgs,
      '--register-overlay-threshold',
      REGISTER_OVERLAY_THRESHOLD_OVERRIDE
        ? normalizeTutorStubRegisterOverlayThreshold(args['register-overlay-threshold'], {
            label: '--register-overlay-threshold',
          })
        : '',
    );
    adjustedChildArgs = withFlagValue(
      adjustedChildArgs,
      '--dag-fact-dropout',
      DAG_FACT_DROPOUT_OVERRIDE
        ? normalizeTutorStubDagFactDropoutRate(args['dag-fact-dropout'], { label: '--dag-fact-dropout' })
        : '',
    );
    adjustedChildArgs = withFlagValue(
      adjustedChildArgs,
      '--dag-fact-dropout-seed',
      DAG_FACT_DROPOUT_SEED_OVERRIDE
        ? normalizeTutorStubDagFactDropoutSeed(args['dag-fact-dropout-seed'], {
            label: '--dag-fact-dropout-seed',
          })
        : '',
    );
    adjustedChildArgs = withFlagValue(
      adjustedChildArgs,
      '--release-speed',
      RELEASE_SPEED_OVERRIDE
        ? normalizeTutorStubReleaseSpeed(args['release-speed'], { label: '--release-speed' })
        : flagValue(childArgs, '--release-speed') || source.config?.releaseSpeed || DEFAULT_TUTOR_STUB_RELEASE_SPEED,
    );
    adjustedChildArgs = withFlagValue(adjustedChildArgs, '--run-seed', runSeed);
    adjustedChildArgs = withBooleanFlag(adjustedChildArgs, '--no-memory-summary', args['no-memory-summary']);
    const policy = result.policy || 'unknown';
    const runIndex = Number(result.runIndex || jobs.length + 1);
    const key = `${safeSlug(policy)}-r${runIndex}`;
    const childTraceDir = parallelism > 1 ? path.join(traceDir, 'traces', key) : traceDir;
    adjustedChildArgs = withFlagValue(adjustedChildArgs, '--trace-dir', childTraceDir);
    adjustedChildArgs = withFlagValue(adjustedChildArgs, '--eval-repeat', runIndex);
    adjustedChildArgs = withFlagValue(adjustedChildArgs, '--eval-job-id', key);
    assertSupportedChildArgs(adjustedChildArgs);
    jobs.push({
      ordinal: jobs.length + 1,
      policy,
      runIndex,
      runs: source.config?.runs || result.runIndex || 1,
      key,
      traceDir: childTraceDir,
      logPath: path.join(traceDir, 'logs', `${key}.log`),
      warrantGateMode,
      warrantChallengeResistance,
      childArgs: adjustedChildArgs,
      resumedFrom: {
        summary: path.relative(ROOT, resolvedSummaryPath),
        status: result.status,
        traces: result.traces || [],
        log: result.log || null,
      },
    });
  }

  const sourcePlanPath = path.join(sourceDir, 'run-plan.json');
  const sourceEventsPath = path.join(sourceDir, 'run-events.jsonl');
  const sourcePlan = readOptionalJson(sourcePlanPath);
  const sourceSeal = readOptionalJson(sourceSealPath);
  const lineageArtifacts = {
    sourceSummary: posixRelative(resolvedSummaryPath),
    sourceSummarySha256: hashFile(resolvedSummaryPath),
    sourcePlanSha256: fs.existsSync(sourcePlanPath) ? hashFile(sourcePlanPath) : null,
    sourceEventsSha256: fs.existsSync(sourceEventsPath) ? hashFile(sourceEventsPath) : null,
    sourceSealSha256: fs.existsSync(sourceSealPath) ? hashFile(sourceSealPath) : null,
    sourceInventorySha256: sourceSeal?.inventorySha256 || null,
    sourceVerified: Boolean(sourceVerification),
  };

  return {
    source,
    sourcePath: resolvedSummaryPath,
    sourceDir,
    sourceRunId: sourcePlan?.runId || path.basename(sourceDir),
    lineageArtifacts,
    traceDir,
    retainedResults,
    jobs,
    config: {
      ...(source.config || {}),
      traceDir,
      runSeed,
      warrantGateMode,
      warrantChallengeResistance,
      lab: 'automated_eval',
      modelCallBudget,
      dryRun: Boolean(args['dry-run']),
      model: MODEL_OVERRIDE ? args.model : source.config?.model || args.model,
      analysisModel: ANALYSIS_MODEL_OVERRIDE
        ? args['analysis-model']
        : source.config?.analysisModel || args['analysis-model'],
      autoLearnerModel: AUTO_LEARNER_MODEL_OVERRIDE
        ? args['auto-learner-model']
        : source.config?.autoLearnerModel || args['auto-learner-model'],
      maxTokens: args['max-tokens']
        ? positiveInt(args['max-tokens'], '--max-tokens')
        : source.config?.maxTokens || source.config?.max_tokens || null,
      historyTurns: args['history-turns']
        ? positiveInt(args['history-turns'], '--history-turns')
        : source.config?.historyTurns || null,
      registerTemperature: ENGAGEMENT_STANCE_TEMPERATURE_OVERRIDE
        ? normalizeTutorStubEngagementStanceTemperature(args['register-temperature'], {
            label: '--register-temperature',
          })
        : (source.config?.registerTemperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE),
      engagementStanceTemperature: ENGAGEMENT_STANCE_TEMPERATURE_OVERRIDE
        ? normalizeTutorStubEngagementStanceTemperature(args['register-temperature'], {
            label: '--register-temperature',
          })
        : (source.config?.engagementStanceTemperature ??
          source.config?.registerTemperature ??
          DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE),
      temperatureScope: 'engagement_stance_and_actorial_part',
      registerOverlayThreshold: REGISTER_OVERLAY_THRESHOLD_OVERRIDE
        ? normalizeTutorStubRegisterOverlayThreshold(args['register-overlay-threshold'], {
            label: '--register-overlay-threshold',
          })
        : (source.config?.registerOverlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD),
      dagFactDropout: DAG_FACT_DROPOUT_OVERRIDE
        ? normalizeTutorStubDagFactDropoutRate(args['dag-fact-dropout'], { label: '--dag-fact-dropout' })
        : (source.config?.dagFactDropout ?? DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE),
      dagFactDropoutSeed: DAG_FACT_DROPOUT_SEED_OVERRIDE
        ? normalizeTutorStubDagFactDropoutSeed(args['dag-fact-dropout-seed'], {
            label: '--dag-fact-dropout-seed',
          })
        : (source.config?.dagFactDropoutSeed ?? DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_SEED),
      releaseSpeed: RELEASE_SPEED_OVERRIDE
        ? normalizeTutorStubReleaseSpeed(args['release-speed'], { label: '--release-speed' })
        : (source.config?.releaseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED),
      memorySummary: args['no-memory-summary'] ? { enabled: false } : source.config?.memorySummary || null,
      resumedFrom: path.relative(ROOT, resolvedSummaryPath),
      resumeStatuses: Array.from(retryStatuses),
    },
  };
}

function logicalArtifactPath(filePath, runDir) {
  const absolute = path.resolve(filePath);
  const relative = path.relative(path.resolve(runDir), absolute);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
    return path.posix.join('{run_dir}', relative.split(path.sep).join('/'));
  }
  return posixRelative(absolute);
}

function logicalChildArgs(childArgs, runDir) {
  const logical = [...childArgs];
  for (const flag of ['--trace-dir']) {
    const index = logical.indexOf(flag);
    if (index !== -1 && logical[index + 1]) logical[index + 1] = logicalArtifactPath(logical[index + 1], runDir);
  }
  return logical;
}

function evidenceDesign(config, jobs, resumePlan = null) {
  return {
    config: {
      ...config,
      traceDir: '{run_dir}',
    },
    jobOrder: jobs.map((job) => job.key),
    commands: jobs.map((job) => ({ id: job.key, arguments: logicalChildArgs(job.childArgs, config.traceDir) })),
    resume: resumePlan
      ? {
          sourceRunId: resumePlan.sourceRunId,
          statuses: csv(args['resume-statuses']),
          retainedRows: resumePlan.retainedResults.length,
          retriedRows: jobs.length,
          artifacts: resumePlan.lineageArtifacts,
        }
      : null,
  };
}

function buildAutoEvalEvidencePlan({ traceDir, startedAt, jobs, config, resumePlan = null }) {
  const design = evidenceDesign(config, jobs, resumePlan);
  const git = captureGitFingerprint({ repoRoot: ROOT });
  delete git.repoRoot;
  const tutorStub = path.join(ROOT, 'scripts', 'tutor-stub.js');
  const profileContracts = path.join(ROOT, 'scripts', 'tutor-stub-learner-profile-contracts.js');
  // Bind the complete static local import closure of the actual child
  // entrypoint. A hand-maintained policy list can silently omit a newly active
  // delivery, cancellation, or persistence module while still producing a
  // nominally sealed run.
  const policySources = [
    ...collectTutorPrBenchmarkReachablePaths({ root: ROOT, entryPaths: ['scripts/tutor-stub.js'] }),
  ].map((relative) => path.join(ROOT, relative));
  const worldPath = worldSourcePath(config.world);
  const plannedJobs = jobs.length
    ? jobs.map((job) => ({
        id: job.key,
        profile: config.autoLearnerProfileId,
        policy: job.policy,
        repeat: job.runIndex,
        ordinal: job.ordinal,
        world: config.world,
        artifactRoot: logicalArtifactPath(job.traceDir, traceDir),
        log: logicalArtifactPath(job.logPath, traceDir),
        arguments: logicalChildArgs(job.childArgs, traceDir),
      }))
    : [{ id: 'resume-noop', ordinal: 1, operation: 'preserve_completed_source_rows' }];
  const modelRefs = {
    tutor: config.model || args.model,
    analyzer: config.analysisModel || args['analysis-model'],
    learner: config.autoLearnerModel || args['auto-learner-model'],
  };
  const requiredRandomDrawJobIds = config.dryRun
    ? []
    : plannedJobs.filter((job) => tutorStubPolicyRequiresDeterministicDraw(job.policy)).map((job) => job.id);
  return buildExperimentRunPlan({
    runId: path.basename(path.resolve(traceDir)),
    createdAt: startedAt,
    runner: 'scripts/run-tutor-stub-auto-eval.js',
    provenance: { git },
    models: {
      tutor: evidenceModel(modelRefs.tutor),
      analyzer: evidenceModel(modelRefs.analyzer),
      learner: evidenceModel(modelRefs.learner),
    },
    requiredObservedModelRoles: config.dryRun || !jobs.length ? [] : ['tutor', 'analyzer', 'learner'],
    hashes: {
      runner: hashFile(AUTO_EVAL_SCRIPT),
      analyzer: hashFile(AUTO_EVAL_SCRIPT),
      policy: hashFileSet(policySources),
      profile: hashFile(profileContracts),
      prompt: hashFile(tutorStub),
      world: worldPath ? hashFile(worldPath) : hashCanonicalJson({ world: config.world || 'none' }),
      config: hashCanonicalJson(design),
    },
    masterSeed: config.runSeed,
    jobs: plannedJobs,
    lineage: resumePlan
      ? { parentRunId: resumePlan.sourceRunId, resumeOf: resumePlan.sourceRunId, supersedes: [] }
      : { parentRunId: config.parentRunId || null, resumeOf: null, supersedes: [] },
    intent: {
      design,
      sourceLineage: resumePlan?.lineageArtifacts || null,
      claimBoundary: 'Dry runs validate orchestration only; simulated learner outcomes do not estimate human learning.',
    },
    metadata: {
      designSha256: hashCanonicalJson(design),
      sourceSummarySha256: resumePlan?.lineageArtifacts?.sourceSummarySha256 || null,
      sourcePlanSha256: resumePlan?.lineageArtifacts?.sourcePlanSha256 || null,
      sourceSealSha256: resumePlan?.lineageArtifacts?.sourceSealSha256 || null,
      randomDrawContract: {
        schema: EXPERIMENT_RANDOM_DRAW_CONTRACT_SCHEMA,
        requiredJobIds: requiredRandomDrawJobIds,
        minimumPerJob: 1,
      },
    },
  });
}

function collectPolicyDrawsFromResults(results, traceDir, evidencePlan) {
  const order = new Map(evidencePlan.randomization.jobOrder.map((jobId, index) => [jobId, index]));
  const traces = [...new Set((results || []).flatMap((result) => result.traces || []))];
  const rows = [];
  const seen = new Set();
  for (const trace of traces) {
    const tracePath = resolveTracePath(trace, traceDir);
    if (!tracePath || !fs.existsSync(tracePath)) continue;
    const lines = fs.readFileSync(tracePath, 'utf8').split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      if (!lines[index].trim()) continue;
      let event;
      try {
        event = JSON.parse(lines[index]);
      } catch (error) {
        throw new Error(`Invalid JSONL evidence at ${tracePath}:${index + 1}: ${error.message}`);
      }
      for (const decision of extractTutorStubPolicyDrawDecisions(event)) {
        const jobId = String(decision?.material?.jobId || '').trim();
        if (!jobId || !order.has(jobId)) {
          throw new Error(
            `Policy draw at ${tracePath}:${index + 1} names unknown evidence-plan job ${JSON.stringify(jobId || null)}`,
          );
        }
        const digest = hashCanonicalJson(decision);
        if (seen.has(digest)) continue;
        seen.add(digest);
        rows.push({
          jobId,
          decision,
          sourceTrace: logicalArtifactPath(tracePath, traceDir),
          sourceRecord: index + 1,
          digest,
        });
      }
    }
  }
  return rows.sort(
    (left, right) =>
      order.get(left.jobId) - order.get(right.jobId) ||
      Number(left.decision.material?.learnerTurn || 0) - Number(right.decision.material?.learnerTurn || 0) ||
      String(left.decision.material?.decisionKind || '').localeCompare(
        String(right.decision.material?.decisionKind || ''),
      ) ||
      left.digest.localeCompare(right.digest),
  );
}

function appendPolicyDrawEvents(traceDir, results, evidencePlan) {
  for (const row of collectPolicyDrawsFromResults(results, traceDir, evidencePlan)) {
    appendRunEvent(traceDir, {
      type: 'random_draw',
      jobId: row.jobId,
      sourceJobId: row.jobId,
      sourceTrace: row.sourceTrace,
      sourceRecord: row.sourceRecord,
      decision: row.decision,
    });
  }
}

function collectObservedModelsFromResults(results, traceDir) {
  const observations = new Map();
  const traces = [...new Set((results || []).flatMap((result) => result.traces || []))];
  for (const trace of traces) {
    const tracePath = resolveTracePath(trace, traceDir);
    if (!tracePath || !fs.existsSync(tracePath)) continue;
    const lines = fs.readFileSync(tracePath, 'utf8').split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      if (!lines[index].trim()) continue;
      let event;
      try {
        event = JSON.parse(lines[index]);
      } catch (error) {
        throw new Error(`Invalid JSONL evidence at ${tracePath}:${index + 1}: ${error.message}`);
      }
      recordTutorStubModelObservation(observations, event, {
        source: `${tracePath}:${index + 1}`,
      });
    }
  }
  return observations;
}

function appendObservedModelEvents(traceDir, results, evidencePlan) {
  const observations = collectObservedModelsFromResults(results, traceDir);
  for (const [role, models] of [...observations.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    for (const observed of [...models].sort()) {
      appendRunEvent(traceDir, {
        type: 'model_observed',
        role,
        requested: evidencePlan.models?.[role]?.requested || null,
        resolved: evidencePlan.models?.[role]?.resolved || null,
        observed,
      });
    }
  }
}

function startEvidenceTransaction({ traceDir, startedAt, jobs, config, resumePlan = null }) {
  fs.mkdirSync(traceDir, { recursive: true });
  const evidencePlan = buildAutoEvalEvidencePlan({ traceDir, startedAt, jobs, config, resumePlan });
  createRunPlan(traceDir, evidencePlan);
  appendRunEvent(traceDir, {
    type: 'run_planned',
    dryRun: config.dryRun,
    jobs: jobs.length,
    policies: [...new Set(jobs.map((job) => job.policy))],
    resumeOf: resumePlan?.sourceRunId || null,
  });
  appendRunEvent(traceDir, { type: 'run_started', dryRun: config.dryRun });
  return evidencePlan;
}

function learnerAnalysisSealDisposition(results, traceDir) {
  return resolveTutorStubLearnerAnalysisSealDisposition(
    (results || []).flatMap((result) =>
      (result.traces || []).map((tracePath) => {
        const resolved = resolveTracePath(tracePath, traceDir);
        const { events } = readSelectedJsonlEventsSync(resolved, { retainTypes: ['turn_complete'] });
        return {
          jobId: result.key || null,
          coverage: summarizeTutorStubLearnerAnalysisCoverage(events),
        };
      }),
    ),
  );
}

function sealEvidenceTransaction({
  traceDir,
  evidencePlan,
  results,
  observedResults = results,
  status,
  summaryPath,
  resumePlan = null,
}) {
  appendPolicyDrawEvents(traceDir, observedResults, evidencePlan);
  appendObservedModelEvents(traceDir, observedResults, evidencePlan);
  const learnerAnalysis = status === 'complete' ? learnerAnalysisSealDisposition(results, traceDir) : null;
  const effectiveStatus = learnerAnalysis?.status || status;
  appendRunEvent(traceDir, {
    type: 'run_completed',
    status: effectiveStatus,
    resultCount: results.length,
    summary: logicalArtifactPath(summaryPath, traceDir),
  });
  createRunSeal(traceDir, {
    status: effectiveStatus,
    metadata: {
      results: results.length,
      ok: results.filter((result) => result.status === 'ok').length,
      failed: results.filter((result) => result.status === 'failed').length,
      dryRun: results.filter((result) => result.status === 'dry_run').length,
      resumeOf: resumePlan?.sourceRunId || null,
      learnerAnalysis,
    },
  });
  if (!['complete', 'dry_run'].includes(effectiveStatus)) {
    // Failed jobs never recorded their contracted draws, so full verification
    // cannot pass. Require the sealed partial evidence to be integrity-clean
    // and surface the unmet contract items without discarding the run.
    const verification = assertExperimentRun(traceDir, { completeness: false });
    const unmet = verifyExperimentRun(traceDir).errors;
    console.warn(
      `[auto-eval] sealed ${traceDir} with status ${effectiveStatus}; integrity verified, ${unmet.length} unmet contract item(s)${
        learnerAnalysis?.unanalyzed?.length
          ? `; unanalyzed turns ${learnerAnalysis.unanalyzed.map((row) => `${row.jobId || 'unknown'}:${row.turn}`).join(', ')}`
          : ''
      }`,
    );
    return verification;
  }
  const verification = assertExperimentRun(traceDir);
  console.log(`[auto-eval] sealed and verified ${traceDir}`);
  return verification;
}

function autoEvalConfigForState({ traceDir, configOverride = null }) {
  return (
    configOverride || {
      runs: positiveInt(args.runs, '--runs'),
      turns: turnsArg(),
      untilGrounded: Boolean(args['until-grounded']),
      safetyTurns: positiveInt(args['safety-turns'], '--safety-turns'),
      primaryHorizon: positiveInt(args['primary-horizon'], '--primary-horizon'),
      parallelism: positiveInt(args.parallelism, '--parallelism'),
      policies: policyCsv(args.policies),
      model: args.model,
      analysisModel: args['analysis-model'],
      learnerAnalysisPromptProfile: args['learner-analysis-prompt-profile'] || null,
      autoLearnerModel: args['auto-learner-model'],
      lab: 'automated_eval',
      modelCallBudget: positiveInt(args['model-call-budget'], '--model-call-budget'),
      autoLearnerProfileId: autoLearnerProfileLabel(),
      parentRunId: String(args['parent-run-id'] || '').trim() || null,
      autoLearnerProfileContract:
        autoLearnerProfileLabel() === 'custom' ? null : learnerProfileContractSummary(resolvedAutoLearnerProfileId()),
      interleavePolicies: Boolean(args['interleave-policies']),
      pressureTurns: args['pressure-turns'] || null,
      pointOfActionArm: normalizeTutorStubPointOfActionArm(args['point-of-action-arm']),
      dagMode: args['dag-mode'],
      registerTemperature: normalizeTutorStubEngagementStanceTemperature(args['register-temperature'], {
        label: '--register-temperature',
      }),
      engagementStanceTemperature: normalizeTutorStubEngagementStanceTemperature(args['register-temperature'], {
        label: '--register-temperature',
      }),
      temperatureScope: 'engagement_stance_and_actorial_part',
      registerOverlayThreshold: normalizeTutorStubRegisterOverlayThreshold(args['register-overlay-threshold'], {
        label: '--register-overlay-threshold',
      }),
      dagFactDropout: normalizeTutorStubDagFactDropoutRate(args['dag-fact-dropout'], {
        label: '--dag-fact-dropout',
      }),
      dagFactDropoutSeed: normalizeTutorStubDagFactDropoutSeed(args['dag-fact-dropout-seed'], {
        label: '--dag-fact-dropout-seed',
      }),
      releaseSpeed: normalizeTutorStubReleaseSpeed(args['release-speed'], { label: '--release-speed' }),
      loopMode: normalizeTutorStubLoopMode(args['loop-mode'], { label: '--loop-mode' }),
      runSeed: normalizeTutorStubDagFactDropoutSeed(args['run-seed'], { label: '--run-seed' }),
      warrantGateMode: resolveTutorStubWarrantGateMode(args['warrant-gate']),
      warrantChallengeResistance: resolveWarrantChallengeResistance(args['warrant-challenge-resistance']),
      dagFactDropoutSemantics: {
        eligibleFacts: 'adopted_public_premises_only',
        backgroundFactsImmune: true,
        graceTurns: 2,
        maxConcurrent: 2,
        visibility: 'conduct',
      },
      responseConfiguration: {
        schema: 'machinespirits.tutor-stub.response-configuration.v3',
        independentAxes: [
          'engagement_stance',
          'action_family',
          'addressee_profile',
          'lexical_accessibility',
          'scene_immersion',
          'actorial_part',
        ],
        transcriptVisibilityAudit: true,
      },
      maxTokens: args['max-tokens'] ? positiveInt(args['max-tokens'], '--max-tokens') : null,
      historyTurns: args['history-turns'] ? positiveInt(args['history-turns'], '--history-turns') : null,
      memorySummary: {
        enabled: !args['no-memory-summary'],
        rawRecentTurns: args['history-turns'] ? positiveInt(args['history-turns'], '--history-turns') : null,
      },
      world: args.world,
      traceDir,
      dryRun: Boolean(args['dry-run']),
    }
  );
}

function buildRunState({
  traceDir,
  startedAt,
  jobs,
  activeJobs,
  results,
  completed,
  status,
  configOverride = null,
  resume = null,
}) {
  const totalJobs = jobs.length;
  const resultByKey = new Map(
    results.map((result) => [
      result.key || `${safeSlug(result.policy || 'unknown')}-r${result.runIndex || '?'}`,
      result,
    ]),
  );
  const activeKeys = new Set(activeJobs.keys());
  const jobRows = jobs.map((job) => {
    const result = resultByKey.get(job.key);
    const active = activeKeys.has(job.key);
    const progress = active ? summarizeJobProgress(job) : result ? summarizeResultProgress(result) : null;
    return {
      ordinal: job.ordinal,
      key: job.key,
      policy: job.policy,
      runIndex: job.runIndex,
      runs: job.runs,
      status: result?.status || (active ? 'running' : 'queued'),
      turns: progress?.turns || 0,
      coverage: progress?.coverage ?? null,
      bottleneck: progress?.bottleneck || '',
      lastType: progress?.lastType || '',
      log: path.relative(ROOT, job.logPath),
      traceDir: path.relative(ROOT, job.traceDir),
    };
  });
  return {
    schema: 'machinespirits.tutor-stub.auto-eval-run-state.v1',
    pid: process.pid,
    status,
    startedAt,
    updatedAt: new Date().toISOString(),
    traceDir: path.relative(ROOT, traceDir),
    config: autoEvalConfigForState({ traceDir, configOverride }),
    resume,
    totals: {
      jobs: totalJobs,
      completed,
      active: activeJobs.size,
      queued: Math.max(0, totalJobs - completed - activeJobs.size),
      ok: results.filter((result) => result.status === 'ok').length,
      failed: results.filter((result) => result.status === 'failed').length,
      dryRun: results.filter((result) => result.status === 'dry_run').length,
      progressRate: totalJobs ? Number((completed / totalJobs).toFixed(3)) : 0,
    },
    jobs: jobRows,
  };
}

function writeRunState(state) {
  const traceDir = resolvePath(state.config?.traceDir || state.traceDir || args['trace-dir']);
  const statePath = runStatePath(traceDir);
  writeJsonAtomic(statePath, state);
  return statePath;
}

function writeRunStateSnapshot(context) {
  const state = buildRunState(context);
  const statePath = writeRunState(state);
  if (!args['no-html-report']) writeReportIndex({ quiet: true, updateShell: false, updateAssets: false });
  return statePath;
}

function runChildJob(job, { primaryHorizon = positiveInt(args['primary-horizon'], '--primary-horizon') } = {}) {
  return new Promise((resolve) => {
    fs.mkdirSync(job.traceDir, { recursive: true });
    fs.mkdirSync(path.dirname(job.logPath), { recursive: true });
    const before = new Set(listTraceFiles(job.traceDir));
    const log = fs.createWriteStream(job.logPath, { flags: 'w' });
    log.write(`[auto-eval] ${job.policy} run ${job.runIndex}/${job.runs}\n`);
    log.write(`${displayCommand(job.childArgs)}\n\n`);
    const child = spawn(process.execPath, job.childArgs, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TUTOR_STUB_EVAL_POLICY: job.policy,
        TUTOR_STUB_EVAL_RUN_INDEX: String(job.runIndex),
        TUTOR_STUB_WARRANT_GATE: job.warrantGateMode,
        TUTOR_STUB_WARRANT_CHALLENGE_RESISTANCE: job.warrantChallengeResistance,
      },
    });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.on('error', (error) => {
      log.write(`\n[auto-eval] spawn error: ${error.message}\n`);
    });
    child.on('close', (status, signal) => {
      const after = listTraceFiles(job.traceDir);
      const newTraces = after.filter((file) => !before.has(file));
      const traceSummaries = newTraces.map((tracePath) =>
        summarizeTrace(tracePath, job.traceDir, {
          primaryHorizon,
        }),
      );
      const result = {
        key: job.key,
        policy: job.policy,
        runIndex: job.runIndex,
        status: status === 0 ? 'ok' : 'failed',
        exitCode: status,
        signal: signal || null,
        traces: newTraces,
        traceSummaries,
        log: path.relative(ROOT, job.logPath),
        command: ['node', ...job.childArgs],
      };
      log.write(`\n[auto-eval] exit status=${status} signal=${signal || ''}\n`);
      log.end(() => resolve(result));
    });
  });
}

async function runJobs({
  jobs,
  parallelism,
  traceDir,
  startedAt,
  configOverride = null,
  resume = null,
  evidenceDir = null,
}) {
  const results = [];
  const activeJobs = new Map();
  let cursor = 0;
  let completed = 0;
  let aborted = false;
  const totalJobs = jobs.length;
  const stateContext = (status = aborted ? 'aborted' : 'running') => ({
    traceDir,
    startedAt,
    jobs,
    activeJobs,
    results,
    completed,
    status,
    configOverride,
    resume,
  });
  const progressIntervalSec = positiveInt(args['progress-interval'], '--progress-interval');
  const progressTimer = args['dry-run']
    ? null
    : setInterval(() => {
        printTurnProgress({ completed, total: totalJobs, activeJobs, results });
        writeRunStateSnapshot(stateContext());
      }, progressIntervalSec * 1000);
  writeRunStateSnapshot(stateContext(args['dry-run'] ? 'dry_run' : 'running'));

  async function worker() {
    while (!aborted && cursor < jobs.length) {
      const job = jobs[cursor];
      cursor += 1;
      activeJobs.set(job.key, job);
      if (evidenceDir) {
        appendRunEvent(evidenceDir, {
          type: 'job_started',
          jobId: job.key,
          ordinal: job.ordinal,
          policy: job.policy,
          repeat: job.runIndex,
        });
      }
      writeRunStateSnapshot(stateContext());
      console.log(`\n[auto-eval] policy=${job.policy} run=${job.runIndex}/${job.runs}`);
      printProgress({
        completed,
        total: totalJobs,
        label: `running ${job.ordinal}/${totalJobs}: ${job.policy} ${job.runIndex}/${job.runs}; log ${path.relative(ROOT, job.logPath)}`,
      });
      console.log(displayCommand(job.childArgs));
      const result = args['dry-run']
        ? {
            key: job.key,
            policy: job.policy,
            runIndex: job.runIndex,
            status: 'dry_run',
            traces: [],
            traceSummaries: [],
            log: path.relative(ROOT, job.logPath),
            command: ['node', ...job.childArgs],
          }
        : await runChildJob(job, {
            primaryHorizon: positiveInt(configOverride?.primaryHorizon || args['primary-horizon'], 'primary horizon'),
          });
      activeJobs.delete(job.key);
      results.push(result);
      completed += 1;
      if (evidenceDir) {
        appendRunEvent(evidenceDir, {
          type: 'job_completed',
          jobId: job.key,
          ordinal: job.ordinal,
          status: result.status,
          exitCode: result.exitCode ?? null,
          traceCount: result.traces?.length || 0,
        });
      }
      writeRunStateSnapshot(stateContext());
      const primary = result.traceSummaries?.at(-1);
      const outcome = primary
        ? `${result.status}; turns ${primary.turnCount}; coverage ${primary.bestPathCoverage}; stop ${primary.stopReason || 'none'}`
        : result.status;
      printProgress({
        completed,
        total: totalJobs,
        label: `finished ${job.policy} ${job.runIndex}/${job.runs}: ${outcome}`,
      });
      if (result.status === 'failed' && !args['keep-going']) aborted = true;
    }
  }

  const workers = Array.from({ length: Math.min(parallelism, jobs.length) }, () => worker());
  try {
    await Promise.all(workers);
  } finally {
    if (progressTimer) clearInterval(progressTimer);
    writeRunStateSnapshot(stateContext(aborted ? 'aborted' : args['dry-run'] ? 'dry_run' : 'completed'));
  }
  return {
    results: results.sort((a, b) => {
      const policyOrder = jobs.findIndex((job) => job.policy === a.policy && job.runIndex === a.runIndex);
      const otherOrder = jobs.findIndex((job) => job.policy === b.policy && job.runIndex === b.runIndex);
      return policyOrder - otherOrder;
    }),
    aborted,
  };
}

async function main() {
  if (args.help) {
    printHelp();
    return;
  }
  if (args['list-learner-profiles']) {
    printLearnerProfiles();
    return;
  }
  if (args.index) {
    writeReportIndex();
    return;
  }
  if (args['report-from']) {
    writeReportFromSummary(args['report-from']);
    return;
  }
  if (args['resume-from']) {
    const plan = buildResumePlan(args['resume-from']);
    activeReadOnlySourceDir = plan.sourceDir;
    const parallelism = positiveInt(args.parallelism, '--parallelism');
    const startedAt = new Date().toISOString();
    const evidencePlan = startEvidenceTransaction({
      traceDir: plan.traceDir,
      startedAt,
      jobs: plan.jobs,
      config: plan.config,
      resumePlan: plan,
    });
    if (!plan.jobs.length) {
      console.log(
        `[auto-eval] no rows with status ${args['resume-statuses']} found in ${path.relative(ROOT, plan.sourcePath)}`,
      );
      appendRunEvent(plan.traceDir, {
        type: 'job_started',
        jobId: 'resume-noop',
        ordinal: 1,
      });
      appendRunEvent(plan.traceDir, {
        type: 'job_completed',
        jobId: 'resume-noop',
        ordinal: 1,
        status: 'complete',
      });
      const report = writeSummary({
        traceDir: plan.traceDir,
        startedAt,
        results: plan.retainedResults,
        plannedJobs: [],
        failed: false,
        configOverride: plan.config,
        resume: { sourcePath: plan.sourcePath, retried: 0, statuses: csv(args['resume-statuses']) },
      });
      appendRunEvent(plan.traceDir, {
        type: 'report_written',
        summary: logicalArtifactPath(report.summaryPath, plan.traceDir),
        html: report.htmlPath ? logicalArtifactPath(report.htmlPath, plan.traceDir) : null,
      });
      const sealed = sealEvidenceTransaction({
        traceDir: plan.traceDir,
        evidencePlan,
        results: plan.retainedResults,
        observedResults: [],
        status: args['dry-run'] ? 'dry_run' : 'complete',
        summaryPath: report.summaryPath,
        resumePlan: plan,
      });
      if (sealed.seal?.status === TUTOR_STUB_LEARNER_ANALYSIS_INCOMPLETE_STATUS) process.exit(1);
      return;
    }
    printProgress({
      completed: 0,
      total: plan.jobs.length,
      label: `resuming ${plan.jobs.length} rows from ${path.relative(ROOT, plan.sourcePath)}; parallelism ${parallelism}`,
    });
    const resumeState = {
      sourcePath: path.relative(ROOT, plan.sourcePath),
      retried: plan.jobs.length,
      statuses: csv(args['resume-statuses']),
    };
    const { results: retriedResults, aborted } = await runJobs({
      jobs: plan.jobs,
      parallelism,
      traceDir: plan.traceDir,
      startedAt,
      configOverride: plan.config,
      resume: resumeState,
      evidenceDir: plan.traceDir,
    });
    const combinedResults = [...plan.retainedResults, ...retriedResults];
    const report = writeSummary({
      traceDir: plan.traceDir,
      startedAt,
      results: combinedResults,
      plannedJobs: plan.jobs,
      failed: aborted,
      configOverride: plan.config,
      resume: {
        sourcePath: plan.sourcePath,
        retried: retriedResults.length,
        statuses: csv(args['resume-statuses']),
      },
    });
    appendRunEvent(plan.traceDir, {
      type: 'report_written',
      summary: logicalArtifactPath(report.summaryPath, plan.traceDir),
      html: report.htmlPath ? logicalArtifactPath(report.htmlPath, plan.traceDir) : null,
    });
    const failedRows = combinedResults.some((result) => result.status === 'failed');
    const sealed = sealEvidenceTransaction({
      traceDir: plan.traceDir,
      evidencePlan,
      results: combinedResults,
      observedResults: retriedResults,
      status: aborted || failedRows ? 'incomplete' : args['dry-run'] ? 'dry_run' : 'complete',
      summaryPath: report.summaryPath,
      resumePlan: plan,
    });
    if (aborted || failedRows || sealed.seal?.status === TUTOR_STUB_LEARNER_ANALYSIS_INCOMPLETE_STATUS) process.exit(1);
    return;
  }

  const runs = positiveInt(args.runs, '--runs');
  const parallelism = positiveInt(args.parallelism, '--parallelism');
  assertSupportedModelRefs({
    '--model': args.model,
    '--analysis-model': args['analysis-model'],
    '--auto-learner-model': args['auto-learner-model'],
  });
  if (args['until-grounded'] && args['no-stop-on-grounded']) {
    throw new Error('--until-grounded cannot be combined with --no-stop-on-grounded');
  }
  const policies = policyCsv(args.policies);
  if (!policies.length) throw new Error('--policies must include at least one policy');
  const traceDir = freshTraceDir();
  const startedAt = new Date().toISOString();
  const jobs = buildJobs({
    policies,
    runs,
    traceDir,
    parallelism,
    interleavePolicies: Boolean(args['interleave-policies']),
  });
  const config = autoEvalConfigForState({ traceDir });
  const evidencePlan = startEvidenceTransaction({ traceDir, startedAt, jobs, config });
  printProgress({ completed: 0, total: jobs.length, label: `starting; parallelism ${parallelism}` });
  const { results, aborted } = await runJobs({
    jobs,
    parallelism,
    traceDir,
    startedAt,
    evidenceDir: traceDir,
  });
  const report = writeSummary({ traceDir, startedAt, results, plannedJobs: jobs, failed: aborted });
  appendRunEvent(traceDir, {
    type: 'report_written',
    summary: logicalArtifactPath(report.summaryPath, traceDir),
    html: report.htmlPath ? logicalArtifactPath(report.htmlPath, traceDir) : null,
  });
  const failedRows = results.some((result) => result.status === 'failed');
  const sealed = sealEvidenceTransaction({
    traceDir,
    evidencePlan,
    results,
    status: aborted || failedRows ? 'incomplete' : args['dry-run'] ? 'dry_run' : 'complete',
    summaryPath: report.summaryPath,
  });
  if (aborted || failedRows || sealed.seal?.status === TUTOR_STUB_LEARNER_ANALYSIS_INCOMPLETE_STATUS) process.exit(1);
}

function writeSummary({
  traceDir,
  startedAt,
  results,
  plannedJobs = [],
  failed,
  configOverride = null,
  resume = null,
}) {
  fs.mkdirSync(traceDir, { recursive: true });
  const summaryConfig = autoEvalConfigForState({ traceDir, configOverride });
  const summary = {
    schema: 'machinespirits.tutor-stub.auto-eval.v1',
    startedAt,
    completedAt: new Date().toISOString(),
    failed,
    config: summaryConfig,
    results,
  };
  if (resume) {
    summary.resume = {
      ...resume,
      sourcePath: resume.sourcePath ? path.relative(ROOT, resume.sourcePath) : null,
    };
  }
  const rows = resultRows(results, {
    plannedJobs,
    primaryHorizon: summaryConfig.primaryHorizon,
  });
  summary.aggregates = summarizeRows(rows);
  summary.rows = rows;
  summary.adaptationEvidence = adaptationEvidenceForRows(rows, summary);
  summary.evidence = {
    runPlan: path.join(traceDir, 'run-plan.json'),
    runEvents: path.join(traceDir, 'run-events.jsonl'),
    runSeal: path.join(traceDir, 'run-seal.json'),
  };
  const timestamp = safeTimestampForFile();
  const summaryPath = path.join(traceDir, `auto-eval-${timestamp}.json`);
  const htmlPath = path.join(traceDir, `auto-eval-${timestamp}.html`);
  summary.report = {
    json: summaryPath,
    html: args['no-html-report'] ? null : htmlPath,
  };
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`\n[auto-eval] wrote ${summaryPath}`);
  if (!args['no-html-report']) {
    writeHtmlReport({ summary, rows, htmlPath });
  }
  writeEvalLedger({ summary, summaryPath, htmlPath: args['no-html-report'] ? null : htmlPath });
  if (args['no-html-report']) {
    writeReportIndex();
  }
  return { summary, rows, summaryPath, htmlPath: args['no-html-report'] ? null : htmlPath };
}

try {
  await main();
} catch (error) {
  console.error(`[auto-eval] error: ${error.message}`);
  process.exit(1);
}
