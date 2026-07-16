import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

export const TUTOR_STUB_FIRST_DRAFT_CAMPAIGN_SCHEMA = 'machinespirits.tutor-stub.first-draft-campaign-plan.v1';

function integer(value, label, { minimum = 0 } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${label} must be an integer >= ${minimum}`);
  }
  return parsed;
}

function requiredString(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function absolute(root, value) {
  const normalized = requiredString(value, 'path');
  return path.isAbsolute(normalized) ? normalized : path.join(root, normalized);
}

function workingScreen(config) {
  return config?.schema === 'machinespirits.tutor-stub.first-draft-working-screen.v1';
}

function acceptanceCampaign(config) {
  return config?.schema === 'machinespirits.tutor-stub.first-draft-generalization-plan.v1';
}

export function loadTutorStubFirstDraftCampaign(configPath, { root = process.cwd() } = {}) {
  const resolvedPath = absolute(root, configPath);
  const config = YAML.parse(fs.readFileSync(resolvedPath, 'utf8')) || {};
  return { config, configPath: resolvedPath, root: path.resolve(root) };
}

function validateWorkingScreen(config, { root }) {
  if (config.held_out !== false) throw new Error('working screen must declare held_out: false');
  const cells = Array.isArray(config.matrix) ? config.matrix : [];
  if (!cells.length) throw new Error('working screen matrix is empty');
  const ids = new Set();
  const seeds = new Set();
  const requiredTurns = integer(config.gates_per_cell?.required_turns, 'required turns', { minimum: 1 });
  const requiredAccepted = integer(config.gates_per_cell?.required_originals_accepted, 'required originals accepted', {
    minimum: 1,
  });
  if (requiredAccepted > requiredTurns) throw new Error('required originals exceeds required turns');
  for (const cell of cells) {
    const id = requiredString(cell.id, 'cell id');
    if (ids.has(id)) throw new Error(`duplicate cell id ${id}`);
    ids.add(id);
    const seed = integer(cell.development_seed, `${id} development seed`, { minimum: 1 });
    if (seeds.has(seed)) throw new Error(`duplicate development seed ${seed}`);
    seeds.add(seed);
    if (cell.seed_status !== 'reusable_non_held_out_development') {
      throw new Error(`${id} must label its seed reusable_non_held_out_development`);
    }
    const trace = absolute(root, cell.source_trace);
    if (!fs.existsSync(trace)) throw new Error(`${id} source trace is missing: ${trace}`);
    const turns = [...new Set((cell.turns || []).map(Number))];
    if (turns.length !== requiredTurns || turns.some((turn) => !Number.isInteger(turn) || turn < 1)) {
      throw new Error(`${id} must declare exactly ${requiredTurns} distinct positive turns`);
    }
  }
  for (const fixture of config.preflight?.model_free_fixtures || []) {
    const fixturePath = absolute(root, fixture);
    if (!fs.existsSync(fixturePath)) throw new Error(`model-free fixture is missing: ${fixturePath}`);
  }
  return { kind: 'working_screen', requiredTurns, requiredAccepted };
}

function validateAcceptance(config) {
  const cells = Array.isArray(config.matrix) ? config.matrix : [];
  if (!cells.length) throw new Error('acceptance matrix is empty');
  if (config.first_draft_gates?.require_all_four_cells === true && cells.length !== 4) {
    throw new Error('acceptance matrix must declare exactly four cells');
  }
  const ids = new Set();
  const seeds = new Set();
  const priorities = new Set();
  for (const cell of cells) {
    const id = requiredString(cell.id, 'cell id');
    if (ids.has(id)) throw new Error(`duplicate cell id ${id}`);
    ids.add(id);
    const seed = integer(cell.seed, `${id} seed`, { minimum: 1 });
    if (seeds.has(seed)) throw new Error(`duplicate held-out seed ${seed}`);
    seeds.add(seed);
    if (cell.priority !== undefined && cell.priority !== null) {
      const priority = integer(cell.priority, `${id} priority`, { minimum: 1 });
      if (priorities.has(priority)) throw new Error(`duplicate acceptance priority ${priority}`);
      priorities.add(priority);
    }
    requiredString(cell.world, `${id} world`);
    requiredString(cell.learner_profile, `${id} learner profile`);
  }
  if (config.change_control?.hardest_cell_first === true) {
    const hardest = cells.find((cell) => Number(cell.priority) === 1) || (priorities.size === 0 ? cells[0] : null);
    if (!hardest) throw new Error('hardest-cell-first acceptance requires a priority 1 cell');
    if (hardest.learner_profile !== 'answer_seeking') {
      throw new Error('priority 1 must exercise the answer_seeking hard profile');
    }
  }
  requiredString(config.fixed_configuration?.register_palette, 'fixed register palette');
  integer(config.fixed_configuration?.safety_turns, 'fixed safety turns', { minimum: 1 });
  const maxConcurrency = integer(config.change_control?.maximum_concurrent_cells ?? 3, 'maximum concurrent cells', {
    minimum: 1,
  });
  if (maxConcurrency > 3) throw new Error('live model concurrency may not exceed three');
  return { kind: 'acceptance', maxConcurrency };
}

export function validateTutorStubFirstDraftCampaign({ config, root = process.cwd() } = {}) {
  requiredString(config?.id, 'campaign id');
  let details;
  if (workingScreen(config)) details = validateWorkingScreen(config, { root });
  else if (acceptanceCampaign(config)) details = validateAcceptance(config);
  else throw new Error(`unsupported first-draft campaign schema: ${config?.schema || 'missing'}`);
  return {
    schema: TUTOR_STUB_FIRST_DRAFT_CAMPAIGN_SCHEMA,
    id: config.id,
    valid: true,
    ...details,
  };
}

function replayCommand({ root, config, cell, turn, outputPath }) {
  return [
    process.execPath,
    path.join(root, 'scripts', 'replay-tutor-stub-frozen-turns.js'),
    '--trace',
    absolute(root, cell.source_trace),
    '--turns',
    String(turn),
    '--draws',
    String(config.fixed_configuration?.draws_per_turn || 1),
    '--concurrency',
    '1',
    '--development-seed',
    String(cell.development_seed),
    '--original-only',
    '--out',
    outputPath,
  ];
}

function autoEvalCommand({ root, config, cell, outputDir }) {
  const fixed = config.fixed_configuration || {};
  return [
    process.execPath,
    path.join(root, 'scripts', 'run-tutor-stub-auto-eval.js'),
    '--runs',
    '1',
    '--run-seed',
    String(cell.seed),
    '--policies',
    String(fixed.policy),
    '--parallelism',
    '1',
    '--turns',
    String(fixed.turns),
    '--primary-horizon',
    String(fixed.turns),
    '--model',
    String(fixed.tutor_model),
    '--analysis-model',
    String(fixed.analysis_model),
    '--auto-learner-model',
    String(fixed.learner_model),
    '--auto-learner-profile-id',
    String(cell.learner_profile),
    '--world',
    String(cell.world),
    '--dag-mode',
    String(fixed.dag_mode),
    '--register-temperature',
    String(fixed.register_temperature),
    '--register-palette',
    String(fixed.register_palette),
    '--register-overlay-threshold',
    String(fixed.register_overlay_threshold),
    '--dag-fact-dropout',
    String(fixed.dag_fact_dropout),
    '--dag-fact-dropout-seed',
    String(fixed.dag_fact_dropout_seed),
    '--release-speed',
    String(fixed.release_speed),
    '--cli-effort',
    String(fixed.cli_effort),
    '--max-tokens',
    String(fixed.max_tokens),
    '--history-turns',
    String(fixed.history_turns),
    '--safety-turns',
    String(fixed.safety_turns),
    '--trace-dir',
    outputDir,
    '--keep-going',
    '--no-ledger',
    '--loop-mode',
    String(fixed.mode || 'strict'),
  ];
}

export function expandTutorStubFirstDraftCampaign({ config, root = process.cwd(), iteration = 1 } = {}) {
  const validation = validateTutorStubFirstDraftCampaign({ config, root });
  const cells = [...config.matrix].sort(
    (left, right) =>
      Number(left.priority || Number.MAX_SAFE_INTEGER) - Number(right.priority || Number.MAX_SAFE_INTEGER),
  );
  const artifactRoot = workingScreen(config)
    ? absolute(root, config.artifacts.root)
    : absolute(root, config.artifacts.live_root);
  const iterationRoot = workingScreen(config)
    ? path.join(artifactRoot, `iteration-${integer(iteration, 'iteration', { minimum: 1 })}`)
    : artifactRoot;
  return {
    ...validation,
    artifactRoot,
    iterationRoot,
    maxConcurrency: workingScreen(config)
      ? Math.min(3, Number(config.fixed_configuration?.max_live_model_jobs || 1))
      : validation.maxConcurrency,
    cells: cells.map((cell) => {
      const outputDir = path.join(iterationRoot, cell.id);
      if (workingScreen(config)) {
        return {
          id: cell.id,
          priority: Number(cell.priority || Number.MAX_SAFE_INTEGER),
          seed: Number(cell.development_seed),
          seedStatus: cell.seed_status,
          world: cell.world,
          learnerProfile: cell.learner_profile,
          outputDir,
          turns: cell.turns.map(Number),
          commands: cell.turns.map((turn) => ({
            turn: Number(turn),
            outputPath: path.join(outputDir, `turn-${turn}.json`),
            argv: replayCommand({
              root,
              config,
              cell,
              turn,
              outputPath: path.join(outputDir, `turn-${turn}.json`),
            }),
          })),
        };
      }
      return {
        id: cell.id,
        priority: Number(cell.priority || Number.MAX_SAFE_INTEGER),
        seed: Number(cell.seed),
        seedStatus: 'unconsumed_held_out',
        world: cell.world,
        learnerProfile: cell.learner_profile,
        outputDir,
        argv: autoEvalCommand({ root, config, cell, outputDir }),
      };
    }),
  };
}

export function tutorStubFirstDraftGatePossibility({ accepted = 0, completed = 0, total = 4, required = 3 } = {}) {
  const remaining = Math.max(0, Number(total) - Number(completed));
  const maximumPossibleAccepted = Number(accepted) + remaining;
  return {
    accepted: Number(accepted),
    completed: Number(completed),
    remaining,
    required: Number(required),
    maximumPossibleAccepted,
    possible: maximumPossibleAccepted >= Number(required),
    passed: Number(completed) === Number(total) && Number(accepted) >= Number(required),
  };
}

export function summarizeTutorStubWorkingScreen({ cell, reports = [], config } = {}) {
  const requiredTurns = Number(config.gates_per_cell.required_turns);
  const requiredAccepted = Number(config.gates_per_cell.required_originals_accepted);
  const results = reports.flatMap((report) => report.results || []);
  const accepted = results.filter((row) => row.audit?.ok).length;
  const safetyFailures = results.filter((row) => row.audit?.safetyFailure).length;
  const transcriptSpecificUptakeFailures = results.filter(
    (row) => row.audit?.audits?.responseCompositionAudit?.ok === false,
  ).length;
  const originalLatencies = results.map((row) => Number(row.latencyMs || 0));
  const failureCounts = new Map();
  for (const row of results) {
    for (const cluster of row.audit?.hardFailureClusters || []) {
      failureCounts.set(cluster, Number(failureCounts.get(cluster) || 0) + 1);
    }
  }
  const possibility = tutorStubFirstDraftGatePossibility({
    accepted,
    completed: results.length,
    total: requiredTurns,
    required: requiredAccepted,
  });
  const gates = {
    originalsAccepted: results.length === requiredTurns && accepted >= requiredAccepted,
    safety: safetyFailures <= Number(config.gates_per_cell.maximum_safety_failures || 0),
    fallbacks: true,
    transcriptSpecificUptake:
      config.gates_per_cell.require_transcript_specific_uptake !== true || transcriptSpecificUptakeFailures === 0,
  };
  return {
    id: cell.id,
    world: cell.world,
    learnerProfile: cell.learnerProfile,
    seed: cell.seed,
    completedTurns: results.length,
    unstartedTurns: cell.turns.filter((turn) => !results.some((row) => Number(row.turn) === Number(turn))),
    originalCandidatesAccepted: accepted,
    originalCandidateAcceptanceRate: results.length ? accepted / results.length : null,
    mechanicalRepairs: 0,
    modelRewrites: 0,
    deterministicFallbacks: 0,
    safetyFailures,
    transcriptSpecificUptakeFailures,
    meanOriginalLatencyMs: originalLatencies.length
      ? originalLatencies.reduce((sum, latency) => sum + latency, 0) / originalLatencies.length
      : null,
    meanTotalTutorLatencyMs: originalLatencies.length
      ? originalLatencies.reduce((sum, latency) => sum + latency, 0) / originalLatencies.length
      : null,
    dominantFailureClusters: [...failureCounts.entries()]
      .map(([cluster, count]) => ({ cluster, count }))
      .sort((left, right) => right.count - left.count || left.cluster.localeCompare(right.cluster)),
    possibility,
    gates,
    status: Object.values(gates).every(Boolean)
      ? 'pass'
      : results.length === requiredTurns || !possibility.possible
        ? 'fail'
        : 'pending',
  };
}

export function assessTutorStubAcceptanceCell(summary, config) {
  const rows = (summary.rows || []).filter((row) => row.status === 'ok');
  const sum = (reader) => rows.reduce((total, row) => total + Number(reader(row) || 0), 0);
  const turns = sum((row) => row.turnCount);
  const original = sum((row) => row.guardAccounting?.originalCandidateAcceptedTurns);
  const hostVisible = sum((row) => row.characterAdaptation?.hostVisibleTurns);
  const realization = rows.reduce(
    (total, row) =>
      total + Number(row.responseConfigurationVisibility?.mean_realization_rate || 0) * Number(row.turnCount || 0),
    0,
  );
  const hostParts = new Set(
    rows.flatMap((row) => Object.keys(row.characterAdaptation?.hostPartCounts || row.actorialPartCounts || {})),
  );
  const observed = {
    turns,
    originalCandidatesAccepted: original,
    originalCandidateAcceptanceRate: turns ? original / turns : null,
    mechanicalRepairs: sum((row) => row.guardAccounting?.mechanicalRepairTurns),
    modelRewrites: sum((row) => row.guardAccounting?.modelRepairTurns),
    deterministicFallbacks: sum((row) => row.guardAccounting?.deterministicFallbackTurns),
    finalSafetyFailures: sum((row) => row.guardAccounting?.finalDeliveryAuditFailures),
    errorCount: Number(summary.aggregates?.errorCount || 0) + sum((row) => row.errorCount),
    quarantineCount: sum((row) => row.diagnosticCollection?.quarantineCount),
    metaPerformanceTurns: sum((row) => row.characterAdaptation?.metaPerformanceTurns),
    roleStageDirectionTurns: sum((row) => row.characterAdaptation?.roleStageDirectionTurns),
    sourceReplacementTurns: sum((row) => row.characterAdaptation?.sourceReplacementTurns),
    duplicateClueDeliveryTurns: sum((row) => row.characterAdaptation?.duplicateClueDeliveryTurns),
    hostVisibilityRate: turns ? hostVisible / turns : null,
    meanConfigurationRealization: turns ? realization / turns : null,
    distinctHostParts: hostParts.size,
    meanOriginalLatencyMs: turns ? sum((row) => row.guardAccounting?.totalOriginalCandidateLatencyMs) / turns : null,
    meanTotalTutorLatencyMs: turns ? sum((row) => row.guardAccounting?.totalTutorGenerationLatencyMs) / turns : null,
  };
  const strict = config.strict_delivery_gates_per_cell || {};
  const first = config.first_draft_gates || {};
  const gates = {
    complete: rows.length === 1 && turns > 0,
    finalSafety: observed.finalSafetyFailures === Number(strict.final_delivery_audit_failures || 0),
    fallback: observed.deterministicFallbacks <= Number(strict.maximum_deterministic_fallback_turns || 0),
    errors: observed.errorCount === Number(strict.error_count || 0),
    quarantine: observed.quarantineCount === Number(strict.quarantine_count || 0),
    metaPerformance: observed.metaPerformanceTurns === Number(strict.meta_performance_turns || 0),
    roleStageDirection: observed.roleStageDirectionTurns === Number(strict.role_stage_direction_turns || 0),
    sourceReplacement: observed.sourceReplacementTurns === Number(strict.source_replacement_turns || 0),
    duplicateClue: observed.duplicateClueDeliveryTurns === Number(strict.duplicate_clue_delivery_turns || 0),
    hostVisibility: observed.hostVisibilityRate >= Number(strict.minimum_host_visibility_rate || 0),
    configurationRealization:
      observed.meanConfigurationRealization >= Number(strict.minimum_mean_configuration_realization || 0),
    hostVariation: observed.distinctHostParts >= Number(strict.minimum_distinct_host_parts || 0),
    originalAcceptance:
      observed.originalCandidateAcceptanceRate >= Number(first.minimum_cell_original_candidate_acceptance_rate || 0),
    modelRewrite:
      observed.modelRewrites <= Number(first.maximum_model_rewrite_turns_per_cell ?? Number.MAX_SAFE_INTEGER),
  };
  return { observed, gates, status: Object.values(gates).every(Boolean) ? 'pass' : 'fail' };
}
