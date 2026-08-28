#!/usr/bin/env node
/**
 * Bounded adaptation-to-recognition loop.
 *
 * This script deliberately does not add another generator. It wraps the
 * production poetics batch runner, sidecar ingest, tutor-adaptation analyzer,
 * and sidecar report with an explicit, two-stage semantic workflow:
 *
 *   --prepare-semantic  generates, scores, and ingests every bounded iteration
 *   independent semantic adjudication happens only after transcripts exist
 *   --resume-prepared   analyzes the prepared items and applies the gate
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
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { openPoeticsStore } from '../services/poeticsStore.js';
import { detectPublicTextRepair, extractFinalLearnerPublicText } from '../services/ontology/hamartiaRepairDetector.js';
import { SEMANTIC_ADJUDICATION_PACKET_SCHEMA } from './analyze-poetics-tutor-adaptation.js';
import { classifyPoeticsConsensus } from './lib/poeticsConsensus.js';
import { originCounts, recognitionOriginForScoreRow } from './lib/recognitionOrigin.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const CAL_DIR = path.join(ROOT, 'config', 'poetics-calibration');
const EXPORTS_DIR = path.join(ROOT, 'exports');
const DEFAULT_BATCH_PREFIX = 'phase2-adaptation-recognition-loop';
const DEFAULT_TARGET_SPEC = path.join(CAL_DIR, 'phase2-classic-drama-adaptation-v1.yaml');
const DEFAULT_TARGETS = [];
const DEFAULT_ARMS = ['routine', 'none', 'peripeteia-only'];
const DEFAULT_CRITICS = [
  'qwen/qwen3.7-max',
  'google/gemini-3.5-flash',
  'deepseek/deepseek-v4-pro',
  'anthropic/claude-sonnet-4.6',
];
const DEFAULT_ANALYZER_VERSION = 'tutor-adaptation-v4';
const SEMANTIC_ANALYZER_VERSION = 'tutor-adaptation-v5-semantic-change';

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
    effort: null,
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
    originHardGate: false,
    reportPrefix: null,
    semanticAdjudicationsPath: null,
    analyzerVersion: DEFAULT_ANALYZER_VERSION,
    prepareSemantic: false,
    resumePrepared: false,
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
    else if (token === '--origin-hard-gate') args.originHardGate = true;
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
    else if (token === '--effort') args.effort = argv[++i];
    else if (token === '--root-parent') args.rootParent = path.resolve(argv[++i]);
    else if (token === '--db') args.dbPath = path.resolve(argv[++i]);
    else if (token === '--report-prefix') args.reportPrefix = path.resolve(argv[++i]);
    else if (token === '--semantic-adjudications' || token === '--representation-adjudications') {
      args.semanticAdjudicationsPath = path.resolve(argv[++i]);
      args.analyzerVersion = SEMANTIC_ANALYZER_VERSION;
    } else if (token === '--prepare-semantic') {
      args.prepareSemantic = true;
      args.analyzerVersion = SEMANTIC_ANALYZER_VERSION;
    } else if (token === '--resume-prepared') {
      args.resumePrepared = true;
      args.analyzerVersion = SEMANTIC_ANALYZER_VERSION;
    } else if (token === '--mock') args.mock = true;
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
  --target-only IDS                 Required once a complete clean-anchor set is registered
  --target-arms routine,none,peripeteia-only
  --critics qwen/qwen3.7-max,google/gemini-3.5-flash,deepseek/deepseek-v4-pro,anthropic/claude-sonnet-4.6
  --max-iterations N                Default: 3
  --required-passes N               Default: 2
  --generator codex|claude          Override generator (default: production-batch default = codex)
  --dry-run                         Print planned commands only
  --mock                            Use mock generation/scoring
  --skip-existing-scores            Reuse existing scorer JSON where present
  --prepare-semantic                Generate/score/ingest bounded items, then stop for judgments
  --resume-prepared                 Analyze/gate the same prepared batches; requires a packet
  --semantic-adjudications FILE     Create-once tutor + learner semantic judgments
  --no-fail-on-gate                 Write reports but exit 0 when gates fail`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(args.batchPrefix)) throw new Error('--batch-prefix must be path-safe');
  if (!/^[a-zA-Z0-9._-]+$/.test(args.runStamp)) throw new Error('--run-stamp must be path-safe');
  if (!fs.existsSync(args.targetSpec)) throw new Error(`--target-spec not found: ${args.targetSpec}`);
  if (args.semanticAdjudicationsPath && !fs.existsSync(args.semanticAdjudicationsPath)) {
    throw new Error(`--semantic-adjudications not found: ${args.semanticAdjudicationsPath}`);
  }
  const targetSpec = yaml.parse(fs.readFileSync(args.targetSpec, 'utf8'));
  const cleanAnchorSet = targetSpec?.meta?.clean_anchor_set || null;
  if (!cleanAnchorSet?.claim_gate_ready || cleanAnchorSet.status !== 'complete') {
    throw new Error(
      'clean anchor set is incomplete: D42 is calibration-only and no D54-D57 third anchor qualified; ' +
        'the claim loop cannot use a reduced denominator',
    );
  }
  const registeredTargets = [...(cleanAnchorSet.required_core || []), cleanAnchorSet.qualified_third_anchor].filter(
    Boolean,
  );
  if (!args.targetOnly.length) throw new Error(`--target-only must name ${registeredTargets.join(',')}`);
  const registeredTargetSet = [...new Set(registeredTargets)].sort();
  const requestedTargetSet = [...new Set(args.targetOnly)].sort();
  if (
    args.targetOnly.length !== requestedTargetSet.length ||
    requestedTargetSet.length !== registeredTargetSet.length ||
    requestedTargetSet.some((target, index) => target !== registeredTargetSet[index])
  ) {
    throw new Error(`--target-only must match the registered clean anchor set: ${registeredTargets.join(',')}`);
  }
  if (!args.targetArms.length) throw new Error('--target-arms must name at least one arm');
  const registeredArms = [...DEFAULT_ARMS].sort();
  const requestedArms = [...new Set(args.targetArms)].sort();
  if (
    args.targetArms.length !== requestedArms.length ||
    requestedArms.length !== registeredArms.length ||
    requestedArms.some((arm, index) => arm !== registeredArms[index])
  ) {
    throw new Error(`--target-arms must match the registered matched arm set: ${DEFAULT_ARMS.join(',')}`);
  }
  if (!args.critics.length) throw new Error('--critics must name at least one critic');
  if (args.prepareSemantic === args.resumePrepared) {
    throw new Error(
      'new adaptation claim loops require exactly one staged mode: ' + '--prepare-semantic or --resume-prepared',
    );
  }
  if (args.prepareSemantic && args.semanticAdjudicationsPath) {
    throw new Error('--prepare-semantic cannot accept judgments before the transcripts exist');
  }
  if (args.resumePrepared && !args.semanticAdjudicationsPath) {
    throw new Error('--resume-prepared requires --semantic-adjudications and semantic v5');
  }
  if (args.analyzerVersion !== SEMANTIC_ANALYZER_VERSION) {
    throw new Error('new adaptation claim loops require semantic v5');
  }
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

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function workflowIdentity(args) {
  return {
    batchPrefix: args.batchPrefix,
    runStamp: args.runStamp,
    rootParent: rel(args.rootParent),
    dbPath: args.dbPath ? rel(args.dbPath) : null,
    targetSpec: rel(args.targetSpec),
    targetOnly: [...args.targetOnly].sort(),
    targetArms: [...args.targetArms].sort(),
    critics: [...args.critics].sort(),
    maxIterations: args.maxIterations,
    requiredPasses: args.requiredPasses,
    minCritics: args.minCritics,
    recognitionVoteCut: args.recognitionVoteCut,
    originVoteCut: args.originVoteCut,
    originHardGate: args.originHardGate,
    actionVoteCut: args.actionVoteCut,
    controlMaxRecognitionVotes: args.controlMaxRecognitionVotes,
    allowQualityWarnings: args.allowQualityWarnings,
    generator: args.generator,
    effort: args.effort,
    mock: args.mock,
    structureCritic: args.structureCritic,
    generationConcurrency: args.generationConcurrency,
    scoreConcurrency: args.scoreConcurrency,
    structureCriticConcurrency: args.structureCriticConcurrency,
    force: args.force,
    skipGenerate: args.skipGenerate,
    skipScore: args.skipScore,
    skipExistingScores: args.skipExistingScores,
    analyzerVersion: args.analyzerVersion,
  };
}

function workflowStageName(args) {
  return args.prepareSemantic ? 'prepare-semantic' : 'resume-prepared';
}

function summaryPrefix(args, stage = workflowStageName(args)) {
  const base = args.reportPrefix || path.join(EXPORTS_DIR, `${args.batchPrefix}-${args.runStamp}-loop-status`);
  return `${base}-${stage}`;
}

function summaryPaths(args, stage = workflowStageName(args)) {
  const prefix = summaryPrefix(args, stage);
  return { jsonPath: `${prefix}.json`, mdPath: `${prefix}.md` };
}

function writableSummaryPaths(args) {
  const base = summaryPaths(args);
  if (!args.resumePrepared || (!fs.existsSync(base.jsonPath) && !fs.existsSync(base.mdPath))) return base;
  const prefix = summaryPrefix(args);
  for (let attempt = 2; attempt < 1000; attempt++) {
    const suffix = `-attempt-${String(attempt).padStart(2, '0')}`;
    const candidate = { jsonPath: `${prefix}${suffix}.json`, mdPath: `${prefix}${suffix}.md` };
    if (!fs.existsSync(candidate.jsonPath) && !fs.existsSync(candidate.mdPath)) return candidate;
  }
  throw new Error('no unused semantic resume summary attempt slot remains');
}

function validatePreparedSummary(args) {
  const { jsonPath } = summaryPaths(args, 'prepare-semantic');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`prepared semantic summary not found: ${jsonPath}`);
  }
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const prepared = JSON.parse(raw);
  if (prepared.status !== 'awaiting_semantic_adjudication') {
    throw new Error(`prepared semantic stage is not complete: ${prepared.status || 'unknown_status'}`);
  }
  const expected = prepared.config?.workflowIdentity || null;
  const actual = workflowIdentity(args);
  if (!expected) throw new Error('prepared semantic summary lacks workflow identity');
  const fields = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
  const drift = fields.filter((field) => JSON.stringify(expected[field]) !== JSON.stringify(actual[field]));
  if (drift.length) {
    throw new Error(`prepared semantic workflow configuration drift: ${drift.join(', ')}`);
  }
  const expectedBatchIds = Array.from({ length: args.maxIterations }, (_, index) => iterationBatchId(args, index + 1));
  const preparedBatchIds = (prepared.iterations || []).map((iteration) => iteration.batchId);
  if (JSON.stringify(preparedBatchIds) !== JSON.stringify(expectedBatchIds)) {
    throw new Error('prepared semantic workflow batch identity is incomplete or changed');
  }
  return {
    summary: prepared,
    provenance: {
      path: rel(jsonPath),
      sha256: createHash('sha256').update(raw).digest('hex'),
      recorded_not_enforced_as_source_authorization: true,
    },
  };
}

function validateResumePreflight(db, args, preparedSummary) {
  const raw = fs.readFileSync(args.semanticAdjudicationsPath, 'utf8');
  const packet = JSON.parse(raw);
  if (packet?.schema !== SEMANTIC_ADJUDICATION_PACKET_SCHEMA || !packet?.items) {
    throw new Error(`semantic adjudications must use schema ${SEMANTIC_ADJUDICATION_PACKET_SCHEMA}`);
  }
  const packetSha256 = createHash('sha256').update(raw).digest('hex');
  const batchStates = {};
  let selectedItemCount = 0;

  for (const iteration of preparedSummary.iterations || []) {
    const batchId = iteration.batchId;
    const selected = db
      .prepare(
        `SELECT id, drama_id, arm
           FROM poetics_items
          WHERE run_id = @runId
            AND unit_id LIKE 'target-%'
          ORDER BY drama_id, arm, id`,
      )
      .all({ runId: batchId })
      .filter((row) => args.targetOnly.includes(row.drama_id) && args.targetArms.includes(row.arm));
    const byKey = new Map();
    for (const row of selected) {
      const key = expectedItemKey(row.drama_id, row.arm);
      const rows = byKey.get(key) || [];
      rows.push(row);
      byKey.set(key, rows);
    }
    const coverageProblems = [];
    for (const dramaId of args.targetOnly) {
      for (const arm of args.targetArms) {
        const key = expectedItemKey(dramaId, arm);
        const count = byKey.get(key)?.length || 0;
        if (count !== 1) coverageProblems.push(`${batchId}:${key}:${count}`);
      }
    }
    if (coverageProblems.length) {
      throw new Error(`prepared semantic item coverage is incomplete or duplicated: ${coverageProblems.join(', ')}`);
    }

    const expectedItemIds = selected.map((row) => row.id).sort();
    selectedItemCount += expectedItemIds.length;
    const incompletePacketItems = expectedItemIds.filter((itemId) => {
      const packetItem = packet.items[itemId];
      return (
        !packetItem ||
        !Array.isArray(packetItem.tutor_judgments) ||
        packetItem.tutor_judgments.length !== 2 ||
        !Array.isArray(packetItem.learner_judgments) ||
        packetItem.learner_judgments.length !== 2
      );
    });
    if (incompletePacketItems.length) {
      throw new Error(
        `semantic adjudication packet coverage is incomplete across prepared batches: ${incompletePacketItems.join(
          ', ',
        )}`,
      );
    }

    const persisted = db
      .prepare(
        `SELECT a.item_id, a.metadata
           FROM poetics_tutor_adaptations a
           JOIN poetics_items i ON i.id = a.item_id
          WHERE i.run_id = @runId
            AND a.analyzer_version = @analyzerVersion`,
      )
      .all({ runId: batchId, analyzerVersion: SEMANTIC_ANALYZER_VERSION })
      .filter((row) => expectedItemIds.includes(row.item_id));
    if (persisted.length > 0 && persisted.length !== expectedItemIds.length) {
      throw new Error(
        `partial semantic v5 persistence for ${batchId}: ${persisted.length}/${expectedItemIds.length}; ` +
          'no new analysis was started',
      );
    }
    const analysisCompleted = persisted.length === expectedItemIds.length;
    if (analysisCompleted) {
      const persistedIds = persisted.map((row) => row.item_id).sort();
      if (JSON.stringify(persistedIds) !== JSON.stringify(expectedItemIds)) {
        throw new Error(`conflicting semantic v5 item coverage for ${batchId}`);
      }
      const conflicting = persisted.filter((row) => {
        const metadata = decodeJson(row.metadata, {});
        const provenance = metadata?.semantic_adjudication_provenance || {};
        return (
          provenance.packet_schema !== SEMANTIC_ADJUDICATION_PACKET_SCHEMA ||
          provenance.packet_sha256 !== packetSha256 ||
          provenance.create_once !== true ||
          provenance.historical_recompute_allowed !== false
        );
      });
      if (conflicting.length) {
        throw new Error(
          `conflicting semantic v5 provenance for ${batchId}: ${conflicting.map((row) => row.item_id).join(', ')}`,
        );
      }
      const malformed = persisted.filter((row) => {
        const peripeteia = decodeJson(row.metadata, {})?.peripeteia || {};
        return ![
          peripeteia.tutor_adaptive_mechanism_measurement || peripeteia.adaptive_mechanism_measurement,
          peripeteia.tutor_representation_change_measurement || peripeteia.representation_change_measurement,
          peripeteia.learner_actional_change_measurement,
          peripeteia.learner_representation_change_measurement,
        ].every(isValidSemanticMeasurement);
      });
      if (malformed.length) {
        throw new Error(
          `malformed semantic v5 persistence for ${batchId}: ${malformed.map((row) => row.item_id).join(', ')}`,
        );
      }
    }
    batchStates[batchId] = {
      analysisCompleted,
      expectedItemCount: expectedItemIds.length,
    };
  }

  return {
    packet: {
      schema: packet.schema,
      path: rel(args.semanticAdjudicationsPath),
      sha256: packetSha256,
    },
    selectedItemCount,
    batchStates,
  };
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
  if (args.effort) production.push('--claude-effort', args.effort);
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
  if (args.semanticAdjudicationsPath) {
    adaptation.push('--semantic-adjudications', args.semanticAdjudicationsPath);
  }
  report.push('--analyzer-version', args.analyzerVersion);
  for (const cmd of [ingest, adaptation, report]) {
    if (args.dbPath) cmd.push('--db', args.dbPath);
  }

  return { iteration, batchId, rootDir, commands: { production, ingest, adaptation, report } };
}

function workflowStages(args, { analysisCompleted = false } = {}) {
  if (args.prepareSemantic) return ['production', 'ingest'];
  if (args.resumePrepared) return analysisCompleted ? ['report'] : ['adaptation', 'report'];
  throw new Error('semantic workflow stage is not selected');
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

function firstTextCandidate(candidates) {
  for (const candidate of candidates) {
    const value = String(candidate?.value || '').trim();
    if (value) return { value, source: candidate.source };
  }
  return { value: '', source: null };
}

function loadRepairInputsByDrama(targetSpec) {
  if (!targetSpec || !fs.existsSync(targetSpec)) return {};
  try {
    const spec = yaml.parse(fs.readFileSync(targetSpec, 'utf8')) || {};
    const raw = spec.dramas || spec.target || [];
    const dramas = Array.isArray(raw) ? raw : Object.values(raw);
    return Object.fromEntries(
      dramas
        .filter((drama) => drama?.id)
        .map((drama) => [
          drama.id,
          {
            hamartia: String(drama.hamartia || '').trim(),
            correctedRule: String(drama.corrected_rule || drama.correctedRule || '').trim(),
            learnerStartState: String(drama.learner_start_state || '').trim(),
            lessonObjective: String(
              drama.lesson_objective || drama.curriculum_script_notes?.curriculum?.lesson_objective || '',
            ).trim(),
          },
        ]),
    );
  } catch {
    return {};
  }
}

function repairInputsForItem(item, args) {
  const keyItem = item.metadata?.keyItem || {};
  const notes = keyItem.curriculum_script_notes || {};
  const registered = args.repairInputsByDrama?.[item.dramaId] || {};
  const hamartia = firstTextCandidate([
    { value: keyItem.hamartia, source: 'item.metadata.keyItem.hamartia' },
    {
      value: notes.script_lowering?.hamartia,
      source: 'item.metadata.keyItem.curriculum_script_notes.script_lowering.hamartia',
    },
    { value: registered.hamartia, source: 'target_spec.hamartia' },
    { value: keyItem.learner_start_state, source: 'item.metadata.keyItem.learner_start_state' },
    {
      value: notes.script_lowering?.learner_start_state,
      source: 'item.metadata.keyItem.curriculum_script_notes.script_lowering.learner_start_state',
    },
    { value: registered.learnerStartState, source: 'target_spec.learner_start_state' },
  ]);
  const correctedRule = firstTextCandidate([
    { value: keyItem.corrected_rule, source: 'item.metadata.keyItem.corrected_rule' },
    { value: keyItem.correctedRule, source: 'item.metadata.keyItem.correctedRule' },
    {
      value: notes.curriculum?.corrected_rule,
      source: 'item.metadata.keyItem.curriculum_script_notes.curriculum.corrected_rule',
    },
    { value: registered.correctedRule, source: 'target_spec.corrected_rule' },
    { value: keyItem.lesson_objective, source: 'item.metadata.keyItem.lesson_objective' },
    {
      value: notes.curriculum?.lesson_objective,
      source: 'item.metadata.keyItem.curriculum_script_notes.curriculum.lesson_objective',
    },
    { value: registered.lessonObjective, source: 'target_spec.lesson_objective' },
  ]);
  return { hamartia, correctedRule };
}

function readFinalPublicLearnerTurn(samplePath) {
  if (!samplePath) return { status: 'missing_path', turn: null };
  const absolute = path.isAbsolute(samplePath) ? samplePath : path.resolve(ROOT, samplePath);
  if (!fs.existsSync(absolute)) return { status: 'file_not_found', turn: null };
  try {
    const turn = extractFinalLearnerPublicText(fs.readFileSync(absolute, 'utf8'));
    return turn ? { status: 'ok', turn } : { status: 'no_public_learner_turn', turn: null };
  } catch (error) {
    return { status: 'read_error', turn: null, errorCode: error?.code || null };
  }
}

function summarizeHamartiaRepair(item, args) {
  const inputs = repairInputsForItem(item, args);
  const publicTurn = readFinalPublicLearnerTurn(item.samplePath);
  const finalTurn = publicTurn.turn;
  return {
    ...detectPublicTextRepair({
      hamartia: inputs.hamartia.value,
      correctedRule: inputs.correctedRule.value,
      publicText: finalTurn?.publicText || '',
    }),
    source: {
      hamartia: inputs.hamartia.source,
      correctedRule: inputs.correctedRule.source,
      publicText: item.samplePath || null,
      publicTextStatus: publicTurn.status,
      publicTextErrorCode: publicTurn.errorCode || null,
      learnerTurnNumber: finalTurn?.turnNumber ?? null,
    },
  };
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

function isValidSemanticMeasurement(measurement) {
  return Boolean(
    (measurement?.status === 'determinate' && typeof measurement.value === 'boolean') ||
    (measurement?.status === 'measurement_indeterminate' && measurement.value == null),
  );
}

function semanticMeasurementOrIndeterminate(measurement, semanticV5, axis) {
  if (!semanticV5 || isValidSemanticMeasurement(measurement)) return measurement || null;
  return {
    status: 'measurement_indeterminate',
    value: null,
    reasons: [`missing_or_invalid_${axis}_measurement`],
  };
}

function scoreProtocolPanel(scores, axis) {
  const metadataKey =
    axis === 'learner_action'
      ? 'learner_action_measurement_protocol_version'
      : 'mechanism_measurement_protocol_version';
  const roleKey = axis === 'learner_action' ? 'learner_actional_change' : 'tutor_adaptive_mechanism';
  const versions = [
    ...new Set(
      scores
        .filter((score) => !score.error)
        .map(
          (score) =>
            score.metadata?.[metadataKey] ||
            score.metadata?.role_measurement_protocols?.[roleKey]?.version ||
            'unversioned',
        ),
    ),
  ].sort();
  return {
    status: versions.length > 1 ? 'measurement_indeterminate' : versions.length ? 'consistent' : 'no_data',
    versions,
  };
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
        i.sample_path,
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
        samplePath: row.sample_path || null,
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
  const originInducedVotes = origins.peripeteia_induced || 0;
  // Reported secondary diagnostic, NOT a pass-gate by default (see D1 below).
  const originAmbiguous = originInducedVotes < args.originVoteCut;
  const learnerScorePanel = scoreProtocolPanel(item.scores, 'learner_action');
  const tutorScorePanel = scoreProtocolPanel(item.scores, 'tutor_mechanism');
  const actionalVotes =
    learnerScorePanel.status === 'measurement_indeterminate'
      ? null
      : item.scores.filter((score) => scoreActionalValue(score) >= 75).length;
  const tutorMechanismVotes =
    tutorScorePanel.status === 'measurement_indeterminate'
      ? null
      : item.scores.filter((score) => scoreTutorMechanismValue(score) >= 75).length;
  const branchValidity = item.adaptation?.metadata?.branch_validity || {};
  const peripeteia = item.adaptation?.metadata?.peripeteia || {};
  const semanticV5 = args.analyzerVersion === SEMANTIC_ANALYZER_VERSION;
  const tutorAdaptiveMechanismMeasurement = semanticMeasurementOrIndeterminate(
    peripeteia.tutor_adaptive_mechanism_measurement || peripeteia.adaptive_mechanism_measurement,
    semanticV5,
    'tutor_adaptive_mechanism',
  );
  const tutorRepresentationChangeMeasurement = semanticMeasurementOrIndeterminate(
    peripeteia.tutor_representation_change_measurement || peripeteia.representation_change_measurement,
    semanticV5,
    'tutor_representation_change',
  );
  const learnerActionalChangeMeasurement = semanticMeasurementOrIndeterminate(
    peripeteia.learner_actional_change_measurement,
    semanticV5,
    'learner_actional_change',
  );
  const learnerRepresentationChangeMeasurement = semanticMeasurementOrIndeterminate(
    peripeteia.learner_representation_change_measurement,
    semanticV5,
    'learner_representation_change',
  );
  const mechanismMeasurementIndeterminate =
    tutorAdaptiveMechanismMeasurement?.status === 'measurement_indeterminate' ||
    tutorRepresentationChangeMeasurement?.status === 'measurement_indeterminate';
  const learnerMeasurementIndeterminate =
    learnerActionalChangeMeasurement?.status === 'measurement_indeterminate' ||
    learnerRepresentationChangeMeasurement?.status === 'measurement_indeterminate';
  const scoreErrors = item.scores.filter((score) => score.error).length;
  const adaptationGate = {
    branchValid: Boolean(branchValidity.valid),
    reversalEventUsed: Boolean(branchValidity.learner_reversal_event_used),
    instrumentedPressure: Boolean(peripeteia.instrumented_pressure),
    tutorPrivateMechanismRoute: Boolean(peripeteia.private_mechanism_declared),
    tutorAdaptiveMechanism: mechanismMeasurementIndeterminate
      ? null
      : semanticV5
        ? tutorAdaptiveMechanismMeasurement.value
        : Boolean(peripeteia.tutor_adaptive_mechanism || peripeteia.tutor_strategy_reversal),
    tutorAdaptiveMechanismStatus: tutorAdaptiveMechanismMeasurement?.status || null,
    tutorRepresentationChange:
      tutorRepresentationChangeMeasurement?.status === 'determinate'
        ? tutorRepresentationChangeMeasurement.value
        : null,
    tutorRepresentationChangeStatus: tutorRepresentationChangeMeasurement?.status || null,
    learnerActionalChange: learnerMeasurementIndeterminate ? null : (learnerActionalChangeMeasurement?.value ?? null),
    learnerActionalChangeStatus: learnerActionalChangeMeasurement?.status || null,
    learnerRepresentationChange:
      learnerRepresentationChangeMeasurement?.status === 'determinate'
        ? learnerRepresentationChangeMeasurement.value
        : null,
    learnerRepresentationChangeStatus: learnerRepresentationChangeMeasurement?.status || null,
    learnerScorePanel,
    tutorScorePanel,
  };
  const hamartiaRepair = summarizeHamartiaRepair(item, args);
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
    // D1: origin attribution (peripeteia_induced vs organic) is a REPORTED secondary
    // diagnostic, not a pass-gate, unless --origin-hard-gate is set. peripeteia_induced
    // is derived from a brittle, author-family-dependent mechanism gate and is
    // critic-unreachable as a 3/4 cross-family consensus, so gating on it fails items
    // whose drama is sound (notes/poetics/2026-05-28-edra-m3-surgery-spec.md D1).
    // originAmbiguous is always recorded for origin_ambiguity_rate reporting.
    if (args.originHardGate && originAmbiguous) {
      failures.push('organic_or_ambiguous_recognition');
    }
    if (learnerMeasurementIndeterminate) {
      failures.push('learner_measurement_indeterminate');
    } else if (learnerActionalChangeMeasurement?.status === 'determinate') {
      if (learnerActionalChangeMeasurement.value === false) failures.push('action_gap');
    } else if (learnerScorePanel.status === 'measurement_indeterminate') {
      failures.push('learner_measurement_indeterminate');
    } else if (actionalVotes < args.actionVoteCut) {
      failures.push('action_gap');
    }
    if (!adaptationGate.branchValid || !adaptationGate.reversalEventUsed || !adaptationGate.instrumentedPressure) {
      failures.push('branch_invalid');
    }
    if (mechanismMeasurementIndeterminate) {
      failures.push('mechanism_measurement_indeterminate');
    } else if (!tutorAdaptiveMechanismMeasurement && tutorScorePanel.status === 'measurement_indeterminate') {
      failures.push('mechanism_measurement_indeterminate');
    } else if (
      adaptationGate.branchValid &&
      adaptationGate.tutorPrivateMechanismRoute &&
      !adaptationGate.tutorAdaptiveMechanism
    ) {
      failures.push('private_only_adaptation');
    } else if (!adaptationGate.tutorPrivateMechanismRoute || !adaptationGate.tutorAdaptiveMechanism) {
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
    originInducedVotes,
    originAmbiguous,
    actionalVotes,
    tutorMechanismVotes,
    adaptationGate,
    hamartiaRepair,
    pass: failures.length === 0,
    failures: [...new Set(failures)],
  };
}

function evaluateRunGate(db, args) {
  const summaryArgs = {
    ...args,
    repairInputsByDrama: args.repairInputsByDrama || loadRepairInputsByDrama(args.targetSpec),
  };
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
  const itemSummaries = selected.map((item) => summarizeItem(item, summaryArgs));
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
      hamartiaRepair: summarizeHamartiaRepair({ dramaId, metadata: {}, samplePath: null }, summaryArgs),
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
  lines.push(
    `Passes: ${
      summary.config.workflowStage === 'prepare_semantic'
        ? 'not evaluated; awaiting independent semantic adjudication'
        : `${summary.passes}/${summary.requiredPasses}`
    }`,
  );
  lines.push('');
  lines.push(`## Gate`);
  lines.push('');
  lines.push(`- Targets: ${summary.config.targetOnly.join(', ')}`);
  lines.push(`- Arms: ${summary.config.targetArms.join(', ')}`);
  lines.push(`- Critics: ${summary.config.critics.join(', ')}`);
  lines.push(
    `- Required: controls <= ${summary.config.controlMaxRecognitionVotes} recognition vote(s); peripeteia recognition/action votes >= ${summary.config.recognitionVoteCut}/${summary.config.actionVoteCut}`,
    `- Origin: peripeteia_induced >= ${summary.config.originVoteCut} ${
      summary.config.originHardGate
        ? '(HARD GATE)'
        : '(reported diagnostic — not gated; pass --origin-hard-gate to enforce)'
    }`,
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
    const pass = iteration.gate ? (iteration.gate.pass ? 'yes' : 'no') : 'not evaluated';
    const items = iteration.gate ? `${iteration.gate.passedItems}/${iteration.gate.itemCount}` : 'not evaluated';
    lines.push(
      `| ${iteration.iteration} | ${iteration.batchId} | ${pass} | ${items} | ${stageError || failures || 'none'} |`,
    );
  }
  for (const iteration of summary.iterations) {
    if (!iteration.gate) continue;
    lines.push('');
    lines.push(`## ${iteration.batchId}`);
    lines.push('');
    lines.push('| drama | arm | pass | recog | origin | action | branch | repair | failures |');
    lines.push('|---|---|---:|---:|---|---:|---:|---|---|');
    for (const item of iteration.gate.items) {
      const origin = Object.entries(item.origins || {})
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}:${v}`)
        .join(' ');
      const branch =
        item.adaptationGate?.branchValid &&
        item.adaptationGate?.reversalEventUsed &&
        item.adaptationGate?.tutorPrivateMechanismRoute &&
        item.adaptationGate?.tutorAdaptiveMechanism
          ? 'yes'
          : 'no';
      lines.push(
        `| ${item.dramaId || ''} | ${item.arm || ''} | ${item.pass ? 'yes' : 'no'} | ${
          item.consensus?.recognitionVotes || 0
        }/${item.consensus?.totalCritics || 0} | ${origin || 'none'} | ${
          item.adaptationGate?.learnerScorePanel?.status === 'measurement_indeterminate'
            ? 'measurement_indeterminate'
            : item.actionalVotes || 0
        } | ${branch} | ${item.hamartiaRepair?.disposition || 'indeterminate'} | ${
          item.failures.join(', ') || 'none'
        } |`,
      );
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeSummary(summary, args) {
  const { jsonPath, mdPath } = writableSummaryPaths(args);
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, renderMarkdown(summary), 'utf8');
  return { jsonPath, mdPath };
}

function runLoop(args) {
  if (!args.dryRun && args.prepareSemantic) {
    const existing = summaryPaths(args, 'prepare-semantic');
    if (fs.existsSync(existing.jsonPath) || fs.existsSync(existing.mdPath)) {
      throw new Error('prepared semantic summary already exists; use a new run stamp to preserve the prior attempt');
    }
  }
  const prepared = !args.dryRun && args.resumePrepared ? validatePreparedSummary(args) : null;
  let resumePreflight = null;
  if (prepared) {
    const db = openPoeticsStore(args.dbPath || undefined);
    try {
      resumePreflight = validateResumePreflight(db, args, prepared.summary);
    } finally {
      db.close();
    }
  }
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
      originHardGate: args.originHardGate,
      actionVoteCut: args.actionVoteCut,
      controlMaxRecognitionVotes: args.controlMaxRecognitionVotes,
      dryRun: args.dryRun,
      mock: args.mock,
      analyzerVersion: args.analyzerVersion,
      semanticAdjudicationsPath: args.semanticAdjudicationsPath ? rel(args.semanticAdjudicationsPath) : null,
      workflowStage: args.prepareSemantic ? 'prepare_semantic' : 'resume_prepared',
      workflowIdentity: workflowIdentity(args),
      targetSpecProvenance: {
        path: rel(args.targetSpec),
        sha256: sha256File(args.targetSpec),
        recorded_not_enforced_as_source_authorization: true,
      },
      preparedSummaryProvenance: prepared?.provenance || null,
      semanticResumePreflight: resumePreflight
        ? {
            packet: resumePreflight.packet,
            selectedItemCount: resumePreflight.selectedItemCount,
          }
        : null,
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
    const stages = workflowStages(args, resumePreflight?.batchStates?.[plan.batchId]);
    iterationSummary.executedStages = stages;
    for (const stage of stages) {
      const cmd = plan.commands[stage];
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

    if (!args.dryRun && args.resumePrepared) {
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
    if (!args.dryRun && args.resumePrepared && summary.passes >= args.requiredPasses) {
      summary.status = 'passed';
      break;
    }
  }

  if (args.dryRun) summary.status = 'dry_run';
  else if (args.prepareSemantic && summary.status === 'running') summary.status = 'awaiting_semantic_adjudication';
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
  DEFAULT_ANALYZER_VERSION,
  DEFAULT_TARGETS,
  SEMANTIC_ANALYZER_VERSION,
  buildIterationPlan,
  evaluateRunGate,
  loadRepairInputsByDrama,
  parseArgs,
  readFinalPublicLearnerTurn,
  repairInputsForItem,
  renderMarkdown,
  runLoop,
  summaryPaths,
  validatePreparedSummary,
  validateResumePreflight,
  writableSummaryPaths,
  workflowIdentity,
  workflowStages,
};
