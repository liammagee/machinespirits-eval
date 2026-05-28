#!/usr/bin/env node
/**
 * Bounded adaptation-to-recognition loop.
 *
 * This script deliberately does not add another generator. It wraps the
 * production poetics batch runner, sidecar ingest, tutor-adaptation analyzer,
 * and sidecar report with an explicit gate:
 *
 *   clean routine/none controls
 *   branch-valid peripeteia-only adaptation
 *   learner actional breakthrough
 *   recognition origin = peripeteia_induced
 *
 * The loop is bounded by --max-iterations and --required-passes so the work
 * terminates with a useful success/failure report instead of drifting into
 * open-ended generation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openPoeticsStore } from '../services/poeticsStore.js';
import { classifyPoeticsConsensus } from './lib/poeticsConsensus.js';
import { originCounts, recognitionOriginForScoreRow } from './lib/recognitionOrigin.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const CAL_DIR = path.join(ROOT, 'config', 'poetics-calibration');
const EXPORTS_DIR = path.join(ROOT, 'exports');
const DEFAULT_BATCH_PREFIX = 'phase2-adaptation-recognition-loop';
const DEFAULT_TARGET_SPEC = path.join(CAL_DIR, 'phase2-classic-drama-adaptation-v1.yaml');
const DEFAULT_TARGETS = ['D42', 'D50', 'D53'];
const DEFAULT_ARMS = ['routine', 'none', 'peripeteia-only'];
const DEFAULT_CRITICS = [
  'qwen/qwen3.7-max',
  'google/gemini-3.5-flash',
  'deepseek/deepseek-v4-pro',
  'anthropic/claude-sonnet-4.6',
];
const DEFAULT_ANALYZER_VERSION = 'tutor-adaptation-v4';

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parsePositiveInt(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${name} must be a positive integer`);
  return n;
}

function compactTimestamp(date = new Date()) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function parseArgs(argv) {
  const args = {
    batchPrefix: DEFAULT_BATCH_PREFIX,
    runStamp: compactTimestamp(),
    targetSpec: DEFAULT_TARGET_SPEC,
    targetOnly: DEFAULT_TARGETS,
    targetArms: DEFAULT_ARMS,
    critics: DEFAULT_CRITICS,
    maxIterations: 3,
    requiredPasses: 2,
    minCritics: 4,
    recognitionVoteCut: 3,
    originVoteCut: 3,
    actionVoteCut: 3,
    controlMaxRecognitionVotes: 1,
    generationConcurrency: 1,
    scoreConcurrency: 3,
    structureCritic: 'rules',
    structureCriticConcurrency: 1,
    generator: null,
    rootParent: CAL_DIR,
    dbPath: null,
    mock: false,
    dryRun: false,
    force: false,
    skipGenerate: false,
    skipScore: false,
    skipExistingScores: false,
    allowQualityWarnings: false,
    failOnGate: true,
    reportPrefix: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--batch-prefix') args.batchPrefix = argv[++i];
    else if (token === '--run-stamp') args.runStamp = argv[++i];
    else if (token === '--target-spec') args.targetSpec = path.resolve(argv[++i]);
    else if (token === '--target-only') args.targetOnly = splitCsv(argv[++i]);
    else if (token === '--target-arms') args.targetArms = splitCsv(argv[++i]);
    else if (token === '--critics') args.critics = splitCsv(argv[++i]);
    else if (token === '--max-iterations') args.maxIterations = parsePositiveInt(argv[++i], '--max-iterations');
    else if (token === '--required-passes') args.requiredPasses = parsePositiveInt(argv[++i], '--required-passes');
    else if (token === '--min-critics') args.minCritics = parsePositiveInt(argv[++i], '--min-critics');
    else if (token === '--recognition-vote-cut')
      args.recognitionVoteCut = parsePositiveInt(argv[++i], '--recognition-vote-cut');
    else if (token === '--origin-vote-cut') args.originVoteCut = parsePositiveInt(argv[++i], '--origin-vote-cut');
    else if (token === '--action-vote-cut') args.actionVoteCut = parsePositiveInt(argv[++i], '--action-vote-cut');
    else if (token === '--control-max-recognition-votes') {
      args.controlMaxRecognitionVotes = Number(argv[++i]);
      if (!Number.isInteger(args.controlMaxRecognitionVotes) || args.controlMaxRecognitionVotes < 0) {
        throw new Error('--control-max-recognition-votes must be a non-negative integer');
      }
    } else if (token === '--generation-concurrency') {
      args.generationConcurrency = parsePositiveInt(argv[++i], '--generation-concurrency');
    } else if (token === '--score-concurrency') {
      args.scoreConcurrency = parsePositiveInt(argv[++i], '--score-concurrency');
    } else if (token === '--structure-critic') args.structureCritic = argv[++i];
    else if (token === '--structure-critic-concurrency') {
      args.structureCriticConcurrency = parsePositiveInt(argv[++i], '--structure-critic-concurrency');
    } else if (token === '--generator') args.generator = argv[++i];
    else if (token === '--root-parent') args.rootParent = path.resolve(argv[++i]);
    else if (token === '--db') args.dbPath = path.resolve(argv[++i]);
    else if (token === '--report-prefix') args.reportPrefix = path.resolve(argv[++i]);
    else if (token === '--mock') args.mock = true;
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--force') args.force = true;
    else if (token === '--skip-generate') args.skipGenerate = true;
    else if (token === '--skip-score') args.skipScore = true;
    else if (token === '--skip-existing-scores') args.skipExistingScores = true;
    else if (token === '--allow-quality-warnings') args.allowQualityWarnings = true;
    else if (token === '--no-fail-on-gate') args.failOnGate = false;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  npm run poetics:adaptation-loop -- [options]

Options:
  --batch-prefix ID                 Default: ${DEFAULT_BATCH_PREFIX}
  --target-spec FILE                Default: ${path.relative(ROOT, DEFAULT_TARGET_SPEC)}
  --target-only D42,D50,D53         Scenario ids to test
  --target-arms routine,none,peripeteia-only
  --critics qwen/qwen3.7-max,google/gemini-3.5-flash,deepseek/deepseek-v4-pro,anthropic/claude-sonnet-4.6
  --max-iterations N                Default: 3
  --required-passes N               Default: 2
  --generator codex|claude          Override generator (default: production-batch default = codex)
  --dry-run                         Print planned commands only
  --mock                            Use mock generation/scoring
  --skip-existing-scores            Reuse existing scorer JSON where present
  --no-fail-on-gate                 Write reports but exit 0 when gates fail`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(args.batchPrefix)) throw new Error('--batch-prefix must be path-safe');
  if (!/^[a-zA-Z0-9._-]+$/.test(args.runStamp)) throw new Error('--run-stamp must be path-safe');
  if (!fs.existsSync(args.targetSpec)) throw new Error(`--target-spec not found: ${args.targetSpec}`);
  if (!args.targetOnly.length) throw new Error('--target-only must name at least one drama id');
  if (!args.targetArms.length) throw new Error('--target-arms must name at least one arm');
  if (!args.targetArms.includes('peripeteia-only')) {
    throw new Error('--target-arms must include peripeteia-only for this gate');
  }
  if (!args.critics.length) throw new Error('--critics must name at least one critic');
  if (args.requiredPasses > args.maxIterations) {
    throw new Error('--required-passes cannot exceed --max-iterations');
  }
  if (!['off', 'rules', 'codex', 'claude', 'claude-code'].includes(args.structureCritic)) {
    throw new Error('--structure-critic must be off|rules|codex|claude|claude-code');
  }
  if (args.generator !== null && !['codex', 'claude', 'gemini'].includes(args.generator)) {
    throw new Error(
      '--generator must be codex|claude|gemini (unset defers to run-poetics-production-batch.js default)',
    );
  }
  return args;
}

function iterationLabel(iteration) {
  return `i${String(iteration).padStart(2, '0')}`;
}

function iterationBatchId(args, iteration) {
  return `${args.batchPrefix}-${args.runStamp}-${iterationLabel(iteration)}`;
}

function iterationRootDir(args, batchId) {
  return path.join(args.rootParent, batchId);
}

function rel(p) {
  return path.relative(ROOT, path.resolve(p));
}

function commandString(cmd) {
  return cmd.map((part) => (/\s/.test(String(part)) ? JSON.stringify(part) : String(part))).join(' ');
}

function buildIterationPlan(args, iteration) {
  const batchId = iterationBatchId(args, iteration);
  const rootDir = iterationRootDir(args, batchId);
  const production = [
    process.execPath,
    'scripts/run-poetics-production-batch.js',
    '--batch-id',
    batchId,
    '--root-dir',
    rootDir,
    '--target-spec',
    args.targetSpec,
    '--target-only',
    args.targetOnly.join(','),
    '--target-adaptation-arms',
    args.targetArms.join(','),
    '--repeats',
    '1',
    '--stress-repeats',
    '0',
    '--only',
    'target-r01',
    '--critics',
    args.critics.join(','),
    '--generation-concurrency',
    String(args.generationConcurrency),
    '--score-concurrency',
    String(args.scoreConcurrency),
    '--structure-critic',
    args.structureCritic,
    '--structure-critic-concurrency',
    String(args.structureCriticConcurrency),
    '--fail-on-structure-critic',
  ];
  if (args.generator) production.push('--generator', args.generator);
  if (args.mock) production.push('--mock');
  if (args.dryRun) production.push('--dry-run');
  if (args.force) production.push('--force');
  if (args.skipGenerate) production.push('--skip-generate');
  if (args.skipScore) production.push('--skip-score');
  if (args.skipExistingScores) production.push('--skip-existing-scores');
  if (args.allowQualityWarnings) production.push('--allow-quality-warnings');

  const ingest = [process.execPath, 'scripts/ingest-poetics-artifacts.js', '--root-dir', rootDir, '--run-id', batchId];
  const adaptation = [
    process.execPath,
    'scripts/analyze-poetics-tutor-adaptation.js',
    '--run-id',
    batchId,
    '--target-only',
    '--out',
    path.join(EXPORTS_DIR, `${batchId}-tutor-adaptation.json`),
    '--csv',
    path.join(EXPORTS_DIR, `${batchId}-tutor-adaptation.csv`),
  ];
  const report = [
    process.execPath,
    'scripts/report-poetics-sidecar.js',
    '--run-id',
    batchId,
    '--out',
    path.join(EXPORTS_DIR, `${batchId}-sidecar-report.md`),
    '--csv',
    path.join(EXPORTS_DIR, `${batchId}-sidecar-report.csv`),
    '--json',
    path.join(EXPORTS_DIR, `${batchId}-sidecar-report.json`),
  ];
  for (const cmd of [ingest, adaptation, report]) {
    if (args.dbPath) cmd.push('--db', args.dbPath);
  }

  return { iteration, batchId, rootDir, commands: { production, ingest, adaptation, report } };
}

function runCommand(cmd, args) {
  if (args.dryRun) {
    console.log(`  ${commandString(cmd)}`);
    return;
  }
  const result = spawnSync(cmd[0], cmd.slice(1), {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env },
  });
  if (result.status !== 0) {
    throw new Error(`command failed (${result.status}): ${commandString(cmd)}`);
  }
}

function decodeJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function scoreValue(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function scoreActionalValue(score) {
  const roles = score.metadata?.role_symmetric_scores || {};
  return scoreValue(score.metadata?.actional_breakthrough, roles.learner_actional_breakthrough?.score100);
}

function scoreTutorMechanismValue(score) {
  const roles = score.metadata?.role_symmetric_scores || {};
  return Math.max(
    scoreValue(score.metadata?.tutor_adaptive_mechanism, roles.tutor_adaptive_mechanism?.score100),
    scoreValue(score.metadata?.tutor_strategic_reversal, roles.tutor_strategy_reversal?.score100),
    scoreValue(score.metadata?.adaptive_mechanism_quality, roles.tutor_adaptive_mechanism_quality?.score100),
  );
}

function qualityProblems(item) {
  const warnings = Array.isArray(item.qualityWarnings) ? item.qualityWarnings : [];
  if (item.qualityStatus === 'review_before_scoring') return ['quality_warning'];
  if (warnings.length) return ['quality_warning'];
  if (item.qualityStatus && !['ok', 'legacy_unmarked'].includes(item.qualityStatus)) return ['quality_status'];
  return [];
}

function loadGateItems(db, runId, analyzerVersion = DEFAULT_ANALYZER_VERSION) {
  const rows = db
    .prepare(
      `
      SELECT
        i.id AS item_id,
        i.run_id,
        i.unit_id,
        i.repeat,
        i.arm,
        i.tid,
        i.drama_id,
        i.quality_status,
        i.quality_warnings,
        i.metadata AS item_metadata,
        s.critic_model,
        s.form_class,
        s.recontextualization,
        s.stated_insight,
        s.error_message,
        s.flags,
        s.metadata AS score_metadata,
        a.learner_self_reframe,
        a.tutor_contingent_adaptation,
        a.tutor_adaptation_score,
        a.uptake_delta,
        a.metadata AS adaptation_metadata
      FROM poetics_items i
      LEFT JOIN poetics_scores s ON s.item_id = i.id
      LEFT JOIN poetics_tutor_adaptations a
        ON a.item_id = i.id AND a.analyzer_version = @analyzerVersion
      WHERE i.run_id = @runId
      ORDER BY i.drama_id, i.arm, i.tid, s.critic_model
    `,
    )
    .all({ runId, analyzerVersion });

  const items = new Map();
  for (const row of rows) {
    if (!items.has(row.item_id)) {
      items.set(row.item_id, {
        itemId: row.item_id,
        runId: row.run_id,
        unitId: row.unit_id,
        repeat: row.repeat,
        arm: row.arm || 'default',
        tid: row.tid,
        dramaId: row.drama_id,
        qualityStatus: row.quality_status,
        qualityWarnings: decodeJson(row.quality_warnings, []),
        metadata: decodeJson(row.item_metadata, {}),
        adaptation: row.adaptation_metadata
          ? {
              learnerSelfReframe: Boolean(row.learner_self_reframe),
              tutorContingentAdaptation: Boolean(row.tutor_contingent_adaptation),
              tutorAdaptationScore: row.tutor_adaptation_score,
              uptakeDelta: row.uptake_delta,
              metadata: decodeJson(row.adaptation_metadata, {}),
            }
          : null,
        scores: [],
      });
    }
    if (row.critic_model) {
      const metadata = decodeJson(row.score_metadata, {});
      const score = {
        critic_model: row.critic_model,
        form_class: row.form_class,
        recontextualization: row.recontextualization,
        stated_insight: row.stated_insight,
        error: row.error_message || null,
        flags: decodeJson(row.flags, []),
        metadata,
      };
      score.recognitionOrigin = metadata?.recognition_origin || recognitionOriginForScoreRow(score);
      items.get(row.item_id).scores.push(score);
    }
  }
  return [...items.values()];
}

function expectedItemKey(dramaId, arm) {
  return `${dramaId}:${arm}`;
}

function summarizeItem(item, args) {
  const consensus = classifyPoeticsConsensus(item.scores, {
    version: 'adaptation-loop-gate-v1',
    minCritics: args.minCritics,
    claimableRecognitionVotes: args.recognitionVoteCut,
    boundaryRecognitionVotes: Math.max(1, args.recognitionVoteCut - 1),
    negativeMaxRecognitionVotes: args.controlMaxRecognitionVotes,
    description: 'Adaptation loop gate',
  });
  const origins = originCounts(item.scores);
  const actionalVotes = item.scores.filter((score) => scoreActionalValue(score) >= 75).length;
  const tutorMechanismVotes = item.scores.filter((score) => scoreTutorMechanismValue(score) >= 75).length;
  const branchValidity = item.adaptation?.metadata?.branch_validity || {};
  const peripeteia = item.adaptation?.metadata?.peripeteia || {};
  const scoreErrors = item.scores.filter((score) => score.error).length;
  const adaptationGate = {
    branchValid: Boolean(branchValidity.valid),
    reversalEventUsed: Boolean(branchValidity.learner_reversal_event_used),
    instrumentedPressure: Boolean(peripeteia.instrumented_pressure),
    privateRoute: Boolean(peripeteia.private_mechanism_declared),
    publicMechanism: Boolean(peripeteia.tutor_adaptive_mechanism || peripeteia.tutor_strategy_reversal),
  };
  const quality = qualityProblems(item);
  const failures = [];
  const isControlArm = ['routine', 'none'].includes(item.arm);
  const isPeripeteiaArm = item.arm === 'peripeteia-only';

  if (quality.length) failures.push(...quality);
  if (scoreErrors) failures.push('scorer_error');
  if (consensus.totalCritics < args.minCritics) failures.push('insufficient_scores');

  if (isControlArm && consensus.totalCritics >= args.minCritics) {
    if (consensus.claimStatus !== 'negative' || consensus.recognitionVotes > args.controlMaxRecognitionVotes) {
      failures.push('control_leak');
    }
  }

  if (isPeripeteiaArm && consensus.totalCritics >= args.minCritics) {
    if (consensus.recognitionVotes < args.recognitionVoteCut || consensus.claimStatus !== 'claimable') {
      failures.push(consensus.claimStatus === 'boundary' ? 'critic_split' : 'recognition_not_produced');
    }
    if ((origins.peripeteia_induced || 0) < args.originVoteCut) {
      failures.push('organic_or_ambiguous_recognition');
    }
    if (actionalVotes < args.actionVoteCut) failures.push('action_gap');
    if (!adaptationGate.branchValid || !adaptationGate.reversalEventUsed || !adaptationGate.instrumentedPressure) {
      failures.push('branch_invalid');
    }
    if (adaptationGate.branchValid && adaptationGate.privateRoute && !adaptationGate.publicMechanism) {
      failures.push('private_only_adaptation');
    } else if (!adaptationGate.privateRoute || !adaptationGate.publicMechanism) {
      failures.push('mechanism_not_publicly_resolved');
    }
  }

  return {
    itemId: item.itemId,
    dramaId: item.dramaId,
    arm: item.arm,
    tid: item.tid,
    qualityStatus: item.qualityStatus,
    qualityWarnings: item.qualityWarnings,
    scoreCount: item.scores.length,
    consensus,
    origins,
    actionalVotes,
    tutorMechanismVotes,
    adaptationGate,
    pass: failures.length === 0,
    failures: [...new Set(failures)],
  };
}

function evaluateRunGate(db, args) {
  const items = loadGateItems(db, args.runId, args.analyzerVersion || DEFAULT_ANALYZER_VERSION);
  const selected = items.filter(
    (item) =>
      args.targetOnly.includes(item.dramaId) &&
      args.targetArms.includes(item.arm) &&
      item.unitId?.startsWith('target-'),
  );
  const expected = new Set();
  for (const dramaId of args.targetOnly) {
    for (const arm of args.targetArms) expected.add(expectedItemKey(dramaId, arm));
  }
  const present = new Set(selected.map((item) => expectedItemKey(item.dramaId, item.arm)));
  const missing = [...expected].filter((key) => !present.has(key));
  const itemSummaries = selected.map((item) => summarizeItem(item, args));
  for (const key of missing) {
    const [dramaId, arm] = key.split(':');
    itemSummaries.push({
      itemId: null,
      dramaId,
      arm,
      tid: null,
      qualityStatus: null,
      qualityWarnings: [],
      scoreCount: 0,
      consensus: classifyPoeticsConsensus([]),
      origins: originCounts([]),
      actionalVotes: 0,
      tutorMechanismVotes: 0,
      adaptationGate: {},
      pass: false,
      failures: ['missing_item'],
    });
  }

  const failureCounts = {};
  for (const item of itemSummaries) {
    for (const failure of item.failures) failureCounts[failure] = (failureCounts[failure] || 0) + 1;
  }
  const pass = itemSummaries.length > 0 && itemSummaries.every((item) => item.pass);
  return {
    runId: args.runId,
    pass,
    targetOnly: args.targetOnly,
    targetArms: args.targetArms,
    itemCount: itemSummaries.length,
    passedItems: itemSummaries.filter((item) => item.pass).length,
    failureCounts,
    items: itemSummaries.sort((a, b) =>
      `${a.dramaId || ''}:${a.arm || ''}:${a.tid || ''}`.localeCompare(
        `${b.dramaId || ''}:${b.arm || ''}:${b.tid || ''}`,
      ),
    ),
  };
}

function renderMarkdown(summary) {
  const lines = [];
  lines.push(`# Adaptation Recognition Loop`);
  lines.push('');
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push(`Status: ${summary.status}`);
  lines.push(`Passes: ${summary.passes}/${summary.requiredPasses}`);
  lines.push('');
  lines.push(`## Gate`);
  lines.push('');
  lines.push(`- Targets: ${summary.config.targetOnly.join(', ')}`);
  lines.push(`- Arms: ${summary.config.targetArms.join(', ')}`);
  lines.push(`- Critics: ${summary.config.critics.join(', ')}`);
  lines.push(
    `- Required: controls <= ${summary.config.controlMaxRecognitionVotes} recognition vote(s); peripeteia recognition/action/origin votes >= ${summary.config.recognitionVoteCut}/${summary.config.actionVoteCut}/${summary.config.originVoteCut}`,
  );
  lines.push('');
  lines.push(`## Iterations`);
  lines.push('');
  lines.push('| iteration | run id | pass | items | failures |');
  lines.push('|---:|---|---:|---:|---|');
  for (const iteration of summary.iterations) {
    const failures = Object.entries(iteration.gate?.failureCounts || {})
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
    const stageError = iteration.stageError ? `${iteration.stageError.stage}: ${iteration.stageError.message}` : '';
    lines.push(
      `| ${iteration.iteration} | ${iteration.batchId} | ${iteration.gate?.pass ? 'yes' : 'no'} | ${
        iteration.gate?.passedItems || 0
      }/${iteration.gate?.itemCount || 0} | ${stageError || failures || 'none'} |`,
    );
  }
  for (const iteration of summary.iterations) {
    if (!iteration.gate) continue;
    lines.push('');
    lines.push(`## ${iteration.batchId}`);
    lines.push('');
    lines.push('| drama | arm | pass | recog | origin | action | branch | failures |');
    lines.push('|---|---|---:|---:|---|---:|---:|---|');
    for (const item of iteration.gate.items) {
      const origin = Object.entries(item.origins || {})
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}:${v}`)
        .join(' ');
      const branch =
        item.adaptationGate?.branchValid &&
        item.adaptationGate?.reversalEventUsed &&
        item.adaptationGate?.privateRoute &&
        item.adaptationGate?.publicMechanism
          ? 'yes'
          : 'no';
      lines.push(
        `| ${item.dramaId || ''} | ${item.arm || ''} | ${item.pass ? 'yes' : 'no'} | ${
          item.consensus?.recognitionVotes || 0
        }/${item.consensus?.totalCritics || 0} | ${origin || 'none'} | ${item.actionalVotes || 0} | ${branch} | ${
          item.failures.join(', ') || 'none'
        } |`,
      );
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeSummary(summary, args) {
  const prefix = args.reportPrefix || path.join(EXPORTS_DIR, `${args.batchPrefix}-${args.runStamp}-loop-status`);
  fs.mkdirSync(path.dirname(prefix), { recursive: true });
  const jsonPath = `${prefix}.json`;
  const mdPath = `${prefix}.md`;
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, renderMarkdown(summary), 'utf8');
  return { jsonPath, mdPath };
}

function runLoop(args) {
  const summary = {
    generatedAt: new Date().toISOString(),
    status: 'running',
    requiredPasses: args.requiredPasses,
    passes: 0,
    config: {
      batchPrefix: args.batchPrefix,
      runStamp: args.runStamp,
      targetSpec: rel(args.targetSpec),
      targetOnly: args.targetOnly,
      targetArms: args.targetArms,
      critics: args.critics,
      maxIterations: args.maxIterations,
      requiredPasses: args.requiredPasses,
      minCritics: args.minCritics,
      recognitionVoteCut: args.recognitionVoteCut,
      originVoteCut: args.originVoteCut,
      actionVoteCut: args.actionVoteCut,
      controlMaxRecognitionVotes: args.controlMaxRecognitionVotes,
      dryRun: args.dryRun,
      mock: args.mock,
    },
    iterations: [],
  };

  console.log(`\n══ Poetics adaptation-recognition loop ══`);
  console.log(`  targets: ${args.targetOnly.join(', ')}`);
  console.log(`  arms: ${args.targetArms.join(', ')}`);
  console.log(`  critics: ${args.critics.join(', ')}`);
  console.log(`  termination: ${args.requiredPasses} pass(es) within ${args.maxIterations} iteration(s)`);

  for (let iteration = 1; iteration <= args.maxIterations; iteration++) {
    const plan = buildIterationPlan(args, iteration);
    const iterationSummary = {
      iteration,
      batchId: plan.batchId,
      rootDir: rel(plan.rootDir),
      commands: Object.fromEntries(Object.entries(plan.commands).map(([key, cmd]) => [key, commandString(cmd)])),
      stageError: null,
      gate: null,
    };
    console.log(`\n── iteration ${iteration}/${args.maxIterations}: ${plan.batchId} ──`);
    console.log(`root: ${rel(plan.rootDir)}`);
    for (const [stage, cmd] of Object.entries(plan.commands)) {
      console.log(`\n# ${stage}`);
      try {
        runCommand(cmd, args);
      } catch (err) {
        iterationSummary.stageError = {
          stage,
          message: err?.message || String(err),
        };
        console.error(`stage failed: ${stage}: ${iterationSummary.stageError.message}`);
        break;
      }
    }

    if (iterationSummary.stageError) {
      summary.iterations.push(iterationSummary);
      summary.status = 'failed';
      break;
    }

    if (!args.dryRun) {
      const db = openPoeticsStore(args.dbPath || undefined);
      try {
        iterationSummary.gate = evaluateRunGate(db, { ...args, runId: plan.batchId });
      } finally {
        db.close();
      }
      if (iterationSummary.gate.pass) summary.passes += 1;
      console.log(
        `\n# gate ${iterationSummary.gate.pass ? 'PASS' : 'FAIL'}: ` +
          `${iterationSummary.gate.passedItems}/${iterationSummary.gate.itemCount} item(s)`,
      );
      const failures = Object.entries(iterationSummary.gate.failureCounts)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ');
      if (failures) console.log(`  failures: ${failures}`);
    }

    summary.iterations.push(iterationSummary);
    if (!args.dryRun && summary.passes >= args.requiredPasses) {
      summary.status = 'passed';
      break;
    }
  }

  if (args.dryRun) summary.status = 'dry_run';
  else if (summary.status !== 'passed') summary.status = 'failed';

  const written = writeSummary(summary, args);
  console.log(`\nloop status json → ${rel(written.jsonPath)}`);
  console.log(`loop status md   → ${rel(written.mdPath)}`);
  return summary;
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const summary = runLoop(args);
    if (summary.status === 'failed' && args.failOnGate) process.exitCode = 2;
  } catch (err) {
    console.error(err?.stack || String(err));
    process.exit(1);
  }
}

export {
  DEFAULT_ARMS,
  DEFAULT_BATCH_PREFIX,
  DEFAULT_CRITICS,
  DEFAULT_TARGETS,
  buildIterationPlan,
  evaluateRunGate,
  parseArgs,
  renderMarkdown,
  runLoop,
};
