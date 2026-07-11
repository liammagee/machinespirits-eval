#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import yaml from 'yaml';
import {
  appendRunEvent,
  assertExperimentRun,
  buildExperimentRunPlan,
  canonicalJson,
  captureGitFingerprint,
  createRunPlan,
  createRunSeal,
  hashCanonicalJson,
  hashFile,
} from '../services/experimentRunArtifacts.js';
import {
  buildAdaptiveStateBenchmarkRow,
  buildTutorStubStateObservation,
  validateCommonLeanBaselineRepresentations,
} from '../services/adaptiveTutor/tutorStubStateAdapter.js';
import {
  buildStateValiditySplitManifest,
  stateValidityGatePolicyFromConfig,
  validateLatentGeneratorFamilyClaim,
} from '../services/adaptiveTutor/stateValidityMetrics.js';

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'adaptive-state-benchmark.yaml');
const DEFAULT_TASKS = path.join(ROOT, 'config', 'adaptive-state-task-metadata.yaml');
const DEFAULT_OUT = path.join(ROOT, 'exports', 'adaptive-state-benchmark');

function timestamp() {
  return new Date().toISOString().replace(/[:.]/gu, '-');
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

function readStructured(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return filePath.endsWith('.json') ? JSON.parse(text) : yaml.parse(text);
}

function writeExclusive(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(filePath, content, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`Refusing to overwrite benchmark artifact at ${filePath}`);
    throw error;
  }
}

function parseJsonl(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL ${filePath}:${index + 1}: ${error.message}`);
      }
    });
}

function autoEvalSummary(sourceDir, verification) {
  const entries = verification.inventory.filter((entry) => /^auto-eval-.*\.json$/u.test(entry.path));
  if (entries.length !== 1) {
    throw new Error(`Expected exactly one auto-eval summary in ${sourceDir}; found ${entries.length}`);
  }
  const filePath = path.join(sourceDir, entries[0].path);
  return { filePath, value: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
}

function traceEntries(sourceDir, verification) {
  return verification.inventory
    .filter(
      (entry) =>
        entry.path.endsWith('.jsonl') && entry.path !== 'run-events.jsonl' && !entry.path.endsWith('ledger.jsonl'),
    )
    .map((entry) => ({ ...entry, filePath: path.join(sourceDir, entry.path) }));
}

function modelLabel(value) {
  if (!value) return 'unknown';
  if (typeof value === 'string') return value;
  return [value.provider, value.model].filter(Boolean).join('/') || 'unknown';
}

function observedModel(events, role, plan) {
  const event = events.find((row) => row.type === 'model_observed' && row.role === role);
  return event?.observed || plan.models?.[role]?.observed || plan.models?.[role]?.resolved || 'unknown';
}

function dropoutRepairContext(currentTurn, nextTurn) {
  const current = currentTurn?.dagFactDropout || currentTurn?.tutorLearnerDagUpdate?.dagFactDropout || null;
  const next = nextTurn?.dagFactDropout || nextTurn?.tutorLearnerDagUpdate?.dagFactDropout || null;
  if (!current && !next) return null;
  return {
    activePremiseIds: (current?.activeDropped || []).map((row) => row?.premiseId).filter(Boolean),
    repairedPremiseIds: (next?.repairedNow || []).map((row) => row?.premiseId).filter(Boolean),
  };
}

function typedActionDecision(turnRecord = {}) {
  return [
    turnRecord.typedActionDecision,
    turnRecord.typed_action_decision,
    turnRecord.registerSelection?.typed_action_decision,
  ].find((candidate) => candidate && typeof candidate === 'object' && candidate.chosen_action);
}

export function actionRecord(turnRecord, task) {
  const typed = typedActionDecision(turnRecord);
  if (typed?.chosen_action) {
    return {
      action_type: typed.chosen_action.action_type,
      move_family: typed.chosen_action.move_family,
      support_level: typed.chosen_action.support_level,
      task_id: typed.chosen_action.task_id,
      knowledge_component: typed.chosen_action.knowledge_component,
      item_difficulty: typed.chosen_action.item_difficulty,
      register: typed.chosen_action.register,
      expected_evidence: typed.chosen_action.expected_evidence,
      fade_condition: typed.chosen_action.fade_condition,
      independent_work_window: typed.chosen_action.independent_work_window,
      responsibility_owner: typed.chosen_action.responsibility_owner,
      selection_probability: typed.selection_probability,
    };
  }
  const selection = turnRecord.registerSelection || {};
  return {
    move_family: selection.action_family || 'legacy_register_only',
    support_level: null,
    task_id: task.task_id,
    item_difficulty: task.item_difficulty,
    register: selection.selected_register || selection.engagement_stance || 'unknown',
    selection_probability: selection.selected_probability ?? null,
  };
}

export function actionSourceProvenance(turnRecord = {}) {
  const selection = turnRecord.registerSelection || {};
  return {
    schema: 'machinespirits.adaptive-state-action-source-provenance.v1',
    source: typedActionDecision(turnRecord) ? 'typed_action_decision' : 'legacy_register_selection',
    source_controller_policy: selection.policy || null,
    excluded_from_prediction_features: true,
  };
}

export function fixedLearnerTurnTarget(observations, requestedTurn) {
  const turn = Number(requestedTurn);
  if (!Number.isInteger(turn) || turn < 1) {
    throw new Error('Fixed learner-turn target needs a positive integer requested turn');
  }
  const eligible = [...(observations || [])]
    .filter((observation) => Number(observation?.turn) <= turn)
    .sort((left, right) => Number(left.turn) - Number(right.turn));
  const horizonObservation = eligible.at(-1) || null;
  if (!horizonObservation) {
    throw new Error(`No observation exists at or before fixed learner turn ${turn}`);
  }
  return {
    horizonObservation,
    targetHorizon: {
      kind: 'fixed_learner_turn',
      requested_turn: turn,
    },
  };
}

function sourceRows({
  sourceDir,
  verification,
  benchmarkConfig,
  taskMetadata,
  benchmarkConfigSha256,
  taskMetadataSha256,
}) {
  const summary = autoEvalSummary(sourceDir, verification);
  const world = summary.value.config?.world;
  const task = taskMetadata.worlds?.[world];
  if (!task) throw new Error(`No frozen task metadata for world ${JSON.stringify(world)} in ${sourceDir}`);
  const events = parseJsonl(path.join(sourceDir, 'run-events.jsonl'));
  const learnerModel = observedModel(events, 'learner', verification.plan);
  const modelFamily = modelLabel(learnerModel);
  const learnerProfile = summary.value.config?.autoLearnerProfileId || 'unknown';
  const learnerSource = `prompt_persona_not_independent:${learnerProfile}`;
  const latentGeneratorFamily =
    summary.value.config?.latentGeneratorFamily ||
    summary.value.config?.latent_generator_family ||
    'prompt_persona_shared_generator';
  const rows = [];
  for (const trace of traceEntries(sourceDir, verification)) {
    const traceEvents = parseJsonl(trace.filePath);
    const rawTurns = traceEvents
      .filter((event) => event.type === 'turn_complete' && event.turnRecord)
      .map((event) => event.turnRecord)
      .sort((left, right) => Number(left.turn || 0) - Number(right.turn || 0));
    if (rawTurns.length < 2) continue;
    const observations = [];
    for (const turnRecord of rawTurns) {
      observations.push(
        buildTutorStubStateObservation({
          turnRecord,
          previousObservation: observations.at(-1) || null,
          provenance: {
            source_run_id: verification.plan.runId,
            source_trace: trace.path,
            source_trace_sha256: trace.sha256,
          },
        }),
      );
    }
    const horizonTurn = Number(benchmarkConfig.fixed_horizon_turns || benchmarkConfig.primary_horizon || 16);
    const fixedHorizon = fixedLearnerTurnTarget(observations, horizonTurn);
    let previousRepresentations = null;
    for (let index = 0; index < observations.length - 1; index += 1) {
      const observation = observations[index];
      const nextObservation = observations[index + 1];
      const dialogueId = `${verification.plan.runId}:${trace.path}`;
      const row = buildAdaptiveStateBenchmarkRow({
        id: `${dialogueId}:t${observation.turn}`,
        groups: {
          dialogue_id: dialogueId,
          world,
          scenario_family: summary.value.config?.dagMode || world,
          latent_generator_family: latentGeneratorFamily,
          learner_source: learnerSource,
          model_family: modelFamily,
        },
        observation,
        nextObservation,
        horizonObservation: fixedHorizon.horizonObservation,
        targetHorizon: fixedHorizon.targetHorizon,
        previousRepresentations,
        task,
        action: actionRecord(rawTurns[index], task),
        dropoutRepair: dropoutRepairContext(rawTurns[index], rawTurns[index + 1]),
        scrambleSeed: Number(verification.plan.randomization?.masterSeed || 0) + observation.turn,
        featureProvenance: {
          benchmark_config_sha256: benchmarkConfigSha256,
          task_metadata_sha256: taskMetadataSha256,
          target_source: 'public_harness_transition',
          action_source: actionSourceProvenance(rawTurns[index]),
        },
      });
      validateLatentGeneratorFamilyClaim(row);
      previousRepresentations = row.representations;
      rows.push(row);
    }
  }
  return { rows, summaryPath: summary.filePath, world, latentGeneratorFamily, learnerSource, modelFamily };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function representationState(representation) {
  return representation && Object.hasOwn(representation, 'additional_state')
    ? representation.additional_state
    : representation;
}

function replaceAdditionalState(representation, state) {
  if (representation && Object.hasOwn(representation, 'lean_baseline')) {
    return {
      lean_baseline: cloneJson(representation.lean_baseline),
      additional_state: cloneJson(state),
    };
  }
  return cloneJson(state);
}

export function applyCrossDialoguePlacebos(rows, seed) {
  if (!Array.isArray(rows) || rows.length < 2) {
    throw new Error('At least two benchmark rows are required to construct cross-dialogue placebos');
  }
  const ordered = [...rows].sort((left, right) => {
    const leftRank = hashCanonicalJson({ seed, sampleId: left.id });
    const rightRank = hashCanonicalJson({ seed, sampleId: right.id });
    return leftRank.localeCompare(rightRank) || left.id.localeCompare(right.id);
  });

  // A cyclic shift is not sufficient when dialogue groups have unequal row
  // counts: a valid derangement can exist even though no single offset finds
  // it. Solve the deterministic bipartite matching directly instead. Each
  // recipient may receive every donor except one from its own dialogue, and
  // each donor is consumed exactly once so the placebo preserves marginals.
  const candidateDonors = ordered.map((recipient) =>
    ordered
      .map((donor, donorIndex) => ({
        donorIndex,
        rank: hashCanonicalJson({ seed, recipientId: recipient.id, donorId: donor.id }),
      }))
      .filter(({ donorIndex }) => ordered[donorIndex].groups.dialogue_id !== recipient.groups.dialogue_id)
      .sort((left, right) => left.rank.localeCompare(right.rank) || left.donorIndex - right.donorIndex)
      .map(({ donorIndex }) => donorIndex),
  );
  const recipientForDonor = Array(ordered.length).fill(-1);

  function assignRecipient(recipientIndex, visitedDonors) {
    for (const donorIndex of candidateDonors[recipientIndex]) {
      if (visitedDonors.has(donorIndex)) continue;
      visitedDonors.add(donorIndex);
      const currentRecipient = recipientForDonor[donorIndex];
      if (currentRecipient === -1 || assignRecipient(currentRecipient, visitedDonors)) {
        recipientForDonor[donorIndex] = recipientIndex;
        return true;
      }
    }
    return false;
  }

  for (let recipientIndex = 0; recipientIndex < ordered.length; recipientIndex += 1) {
    if (!assignRecipient(recipientIndex, new Set())) {
      throw new Error(
        'Cannot construct a one-to-one cross-dialogue placebo permutation; add independent dialogue groups or rebalance the export',
      );
    }
  }
  const donorForRecipient = Array(ordered.length).fill(-1);
  recipientForDonor.forEach((recipientIndex, donorIndex) => {
    if (recipientIndex >= 0) donorForRecipient[recipientIndex] = donorIndex;
  });
  if (donorForRecipient.some((donorIndex) => donorIndex < 0)) {
    throw new Error(
      'Cannot construct a one-to-one cross-dialogue placebo permutation; add independent dialogue groups or rebalance the export',
    );
  }

  ordered.forEach((row, index) => {
    const donor = ordered[donorForRecipient[index]];
    const donorState = representationState(donor.representations.plan2_belief);
    row.representations.state_scramble = replaceAdditionalState(row.representations.state_scramble, donorState);
    const shuffledEvidence = cloneJson(representationState(row.representations.plan2_belief));
    const donorEvidence = representationState(donor.representations.plan2_belief)?.evidence || {};
    const donorFallback = Object.values(donorEvidence)[0] || { supporting_ids: [] };
    for (const [hypothesisId, bundle] of Object.entries(shuffledEvidence.evidence || {})) {
      const source = donorEvidence[hypothesisId] || donorFallback;
      bundle.supporting_ids = [...(source.supporting_ids || [])];
    }
    row.representations.shuffled_evidence_ids = replaceAdditionalState(
      row.representations.shuffled_evidence_ids,
      shuffledEvidence,
    );
    row.feature_provenance.placebos = {
      schema: 'machinespirits.adaptive-state-placebo-lineage.v1',
      algorithm: 'sha256_ranked_cross_dialogue_perfect_matching_v1',
      state_scramble_donor_id: donor.id,
      evidence_id_donor_id: donor.id,
      donor_dialogue_id: donor.groups.dialogue_id,
    };
    if (row.representations.lean?.lean_baseline) {
      validateCommonLeanBaselineRepresentations(row.representations);
    }
  });
  return rows;
}

function leakageAudit(rows, config) {
  const forbidden = [...new Set([...(config.forbidden_keys || []), 'legacy_policy'])];
  const serialized = rows.map((row) => canonicalJson(row)).join('\n');
  const hits = forbidden.filter((key) =>
    new RegExp(`"${String(key).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}"`, 'u').test(serialized),
  );
  return {
    passed: hits.length === 0,
    forbiddenKeyHits: hits,
    policyInvariantRows: rows.filter((row) => row.feature_provenance?.policy_invariant === true).length,
    rows: rows.length,
  };
}

export function exportAdaptiveStateBenchmark({
  sourceDirs,
  outDir,
  configPath = DEFAULT_CONFIG,
  taskMetadataPath = DEFAULT_TASKS,
  runSeed = 20260711,
} = {}) {
  const sources = (sourceDirs || []).map(resolvePath);
  if (!sources.length) throw new Error('At least one sealed --run-dir is required');
  const output = resolvePath(outDir || path.join(DEFAULT_OUT, `benchmark-${timestamp()}`));
  const configFile = resolvePath(configPath);
  const tasksFile = resolvePath(taskMetadataPath);
  const benchmarkConfig = readStructured(configFile);
  const taskMetadata = readStructured(tasksFile);
  const benchmarkConfigSha256 = hashFile(configFile);
  const taskMetadataSha256 = hashFile(tasksFile);
  const sourceVerifications = sources.map((sourceDir) => ({ sourceDir, verification: assertExperimentRun(sourceDir) }));
  const sourceRunIds = new Set();
  for (const { sourceDir, verification } of sourceVerifications) {
    if (sourceRunIds.has(verification.plan.runId)) {
      throw new Error(`Duplicate sealed source run id ${verification.plan.runId} (including ${sourceDir})`);
    }
    sourceRunIds.add(verification.plan.runId);
  }
  const sourceData = sourceVerifications.map(({ sourceDir, verification }) =>
    sourceRows({
      sourceDir,
      verification,
      benchmarkConfig,
      taskMetadata,
      benchmarkConfigSha256,
      taskMetadataSha256,
    }),
  );
  const rows = sourceData.flatMap((source) => source.rows);
  if (!rows.length) throw new Error('No eligible t to t+1 turn transitions found in sealed sources');
  applyCrossDialoguePlacebos(rows, runSeed);
  const ids = new Set();
  for (const row of rows) {
    if (ids.has(row.id)) throw new Error(`Duplicate benchmark sample id ${row.id}`);
    ids.add(row.id);
  }
  const audit = leakageAudit(rows, benchmarkConfig);
  if (!audit.passed || audit.policyInvariantRows !== rows.length) {
    throw new Error(`Benchmark leakage audit failed: ${audit.forbiddenKeyHits.join(', ') || 'non-invariant rows'}`);
  }
  const holdoutAxes = benchmarkConfig.splits?.group_axes || [
    'world',
    'scenario_family',
    'latent_generator_family',
    'learner_source',
    'model_family',
  ];
  const splitManifest = buildStateValiditySplitManifest(rows, {
    method: benchmarkConfig.splits?.method || 'leave_one_group_level_out',
    atomicUnit: benchmarkConfig.splits?.atomic_unit || 'dialogue_id',
    holdoutAxes,
    gatePolicy: stateValidityGatePolicyFromConfig(benchmarkConfig),
  });
  const folds = splitManifest.folds;

  const git = captureGitFingerprint({ repoRoot: ROOT });
  delete git.repoRoot;
  const plan = buildExperimentRunPlan({
    runId: path.basename(output),
    runner: 'scripts/export-adaptive-state-benchmark.js',
    provenance: { git },
    models: { exporter: { requested: 'node/offline', resolved: process.version, observed: process.version } },
    requiredObservedModelRoles: [],
    hashes: {
      runner: hashFile(SCRIPT),
      analyzer: hashFile(path.join(ROOT, 'services', 'adaptiveTutor', 'stateValidityMetrics.js')),
      policy: hashFile(path.join(ROOT, 'services', 'adaptiveTutor', 'actionPolicy.js')),
      profile: hashFile(tasksFile),
      prompt: hashCanonicalJson(sourceVerifications.map(({ verification }) => verification.seal.planSha256)),
      world: hashCanonicalJson(sourceData.map((source) => source.world)),
      config: hashFile(configFile),
    },
    masterSeed: runSeed,
    jobs: sourceVerifications.map(({ sourceDir, verification }) => ({
      id: verification.plan.runId,
      source: path.basename(sourceDir),
      sourcePlanSha256: verification.seal.planSha256,
      sourceSealSha256: hashFile(path.join(sourceDir, 'run-seal.json')),
    })),
    lineage: {
      parentRunId: sourceVerifications.length === 1 ? sourceVerifications[0].verification.plan.runId : null,
      resumeOf: null,
      supersedes: [],
    },
    intent: {
      predictionOrigin: benchmarkConfig.prediction_origin,
      targetHorizon: {
        kind: 'fixed_learner_turn',
        requestedTurn: Number(benchmarkConfig.fixed_horizon_turns || benchmarkConfig.primary_horizon || 16),
      },
      claimBoundary: benchmarkConfig.claim_boundary,
      sourceRuns: sourceVerifications.map(({ verification }) => verification.plan.runId),
    },
    metadata: {
      benchmarkConfigSha256: hashFile(configFile),
      taskMetadataSha256: hashFile(tasksFile),
    },
  });
  createRunPlan(output, plan);
  appendRunEvent(output, { type: 'export_started', sourceRuns: plan.intent.sourceRuns });
  writeExclusive(path.join(output, 'benchmark.jsonl'), `${rows.map((row) => canonicalJson(row)).join('\n')}\n`);
  writeExclusive(
    path.join(output, 'split-manifest.json'),
    canonicalJson(splitManifest, { space: 2, trailingNewline: true }),
  );
  writeExclusive(
    path.join(output, 'benchmark-metadata.json'),
    canonicalJson(
      {
        schema: 'machinespirits.adaptive-state-benchmark-metadata.v1',
        rowCount: rows.length,
        sources: sourceVerifications.map(({ sourceDir, verification }) => ({
          runId: verification.plan.runId,
          sourceDir,
          planSha256: verification.seal.planSha256,
          sealSha256: hashFile(path.join(sourceDir, 'run-seal.json')),
        })),
        coverage: {
          worlds: [...new Set(rows.map((row) => row.groups.world))].sort(),
          latentGeneratorFamilies: [...new Set(rows.map((row) => row.groups.latent_generator_family))].sort(),
          learnerSources: [...new Set(rows.map((row) => row.groups.learner_source))].sort(),
          modelFamilies: [...new Set(rows.map((row) => row.groups.model_family))].sort(),
        },
        leakageAudit: audit,
      },
      { space: 2, trailingNewline: true },
    ),
  );
  appendRunEvent(output, { type: 'export_completed', rows: rows.length, folds: folds.length });
  createRunSeal(output, { metadata: { rows: rows.length, folds: folds.length, leakageAuditPassed: true } });
  const verification = assertExperimentRun(output);
  return { output, rows, splitManifest, verification };
}

async function main() {
  const { values } = parseArgs({
    options: {
      'run-dir': { type: 'string', multiple: true },
      out: { type: 'string' },
      config: { type: 'string', default: DEFAULT_CONFIG },
      'task-metadata': { type: 'string', default: DEFAULT_TASKS },
      seed: { type: 'string', default: '20260711' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help || !values['run-dir']?.length) {
    console.log(
      'Usage: node scripts/export-adaptive-state-benchmark.js --run-dir SEALED_DIR [--run-dir SEALED_DIR ...] [--out DIR] [--config YAML] [--task-metadata YAML]',
    );
    if (!values.help) process.exitCode = 1;
    return;
  }
  const result = exportAdaptiveStateBenchmark({
    sourceDirs: values['run-dir'],
    outDir: values.out,
    configPath: values.config,
    taskMetadataPath: values['task-metadata'],
    runSeed: Number(values.seed),
  });
  console.log(`exported ${result.rows.length} rows to ${result.output}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}
