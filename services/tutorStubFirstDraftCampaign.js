import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import {
  TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA,
  TUTOR_STUB_JOINT_PERFORMANCE_COMPOSITION_SCHEMA,
  TUTOR_STUB_JOINT_PERFORMANCE_FIRST_DRAFT_SCHEMA,
} from './tutorStubJointPerformanceFirstDraft.js';

export const TUTOR_STUB_FIRST_DRAFT_CAMPAIGN_SCHEMA = 'machinespirits.tutor-stub.first-draft-campaign-plan.v1';

function integer(value, label, { minimum = 0 } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${label} must be an integer >= ${minimum}`);
  }
  return parsed;
}

function rate(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${label} must be a number between 0 and 1`);
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

export function tutorStubFirstDraftCampaignValidationArtifactPath({
  artifactRoot,
  mode,
  iteration = 1,
} = {}) {
  const root = requiredString(artifactRoot, 'campaign artifact root');
  const normalizedMode = requiredString(mode, 'campaign mode').toLowerCase();
  if (!['validate', 'development', 'acceptance'].includes(normalizedMode)) {
    throw new Error(`unsupported campaign mode for validation artifact: ${normalizedMode}`);
  }
  if (normalizedMode === 'development') {
    const workingIteration = integer(iteration, 'working iteration', { minimum: 1 });
    return path.join(root, `iteration-${workingIteration}`, 'campaign-validation.json');
  }
  return path.join(root, 'campaign-validation.json');
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
  if (
    config.fixed_configuration?.structured_generation === true &&
    config.fixed_configuration?.joint_performance_generation === true
  ) {
    throw new Error('working screen generation modes are mutually exclusive');
  }
  if (config.fixed_configuration?.structured_generation === true) {
    for (const gate of [
      'require_structured_output',
      'require_structured_slot_ownership',
      'require_exact_source_once',
    ]) {
      if (config.gates_per_cell?.[gate] !== true) {
        throw new Error(`structured working screen must declare gates_per_cell.${gate}: true`);
      }
    }
  }
  if (config.fixed_configuration?.joint_performance_generation === true) {
    const expectedSchemas = {
      joint_performance_schema: TUTOR_STUB_JOINT_PERFORMANCE_FIRST_DRAFT_SCHEMA,
      joint_performance_composition_schema: TUTOR_STUB_JOINT_PERFORMANCE_COMPOSITION_SCHEMA,
      joint_performance_audit_schema: TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA,
    };
    for (const [field, expected] of Object.entries(expectedSchemas)) {
      if (config.fixed_configuration?.[field] !== expected) {
        throw new Error(`joint-performance working screen must declare fixed_configuration.${field}: ${expected}`);
      }
    }
    for (const gate of [
      'require_joint_performance_output',
      'require_joint_performance_ownership',
      'require_exact_host_source_occurrences',
    ]) {
      if (config.gates_per_cell?.[gate] !== true) {
        throw new Error(`joint-performance working screen must declare gates_per_cell.${gate}: true`);
      }
    }
  }
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
  const strict = config.strict_delivery_gates_per_cell || {};
  const first = config.first_draft_gates || {};
  if (first.require_all_four_cells !== true) {
    throw new Error('acceptance must require all four cells');
  }
  if (cells.length !== 4) {
    throw new Error('acceptance matrix must declare exactly four cells');
  }
  integer(config.fixed_configuration?.turns, 'fixed turns', { minimum: 1 });
  integer(strict.final_delivery_audit_failures, 'final delivery audit failures');
  integer(strict.maximum_deterministic_fallback_turns, 'maximum deterministic fallback turns');
  integer(strict.error_count, 'error count');
  integer(strict.quarantine_count, 'quarantine count');
  integer(strict.meta_performance_turns, 'meta performance turns');
  integer(strict.role_stage_direction_turns, 'role stage direction turns');
  integer(strict.source_replacement_turns, 'source replacement turns');
  integer(strict.duplicate_clue_delivery_turns, 'duplicate clue delivery turns');
  rate(strict.minimum_host_visibility_rate, 'minimum host visibility rate');
  rate(strict.minimum_mean_configuration_realization, 'minimum mean configuration realization');
  integer(strict.minimum_distinct_host_parts, 'minimum distinct host parts', { minimum: 1 });
  rate(first.minimum_accounted_turn_rate, 'minimum accounted turn rate');
  rate(first.minimum_aggregate_original_candidate_acceptance_rate, 'minimum aggregate original acceptance rate');
  rate(first.minimum_cell_original_candidate_acceptance_rate, 'minimum cell original acceptance rate');
  rate(first.maximum_aggregate_model_rewrite_rate, 'maximum aggregate model rewrite rate');
  integer(first.maximum_model_rewrite_turns_per_cell, 'maximum model rewrite turns per cell');
  integer(first.maximum_total_deterministic_fallback_turns, 'maximum total deterministic fallback turns');
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
  const command = [
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
  if (config.fixed_configuration?.semantic_adjudication === true) {
    command.splice(command.length - 2, 0, '--semantic-adjudication');
  }
  if (config.fixed_configuration?.structured_generation === true) {
    command.splice(command.length - 2, 0, '--structured-generation');
  }
  if (config.fixed_configuration?.joint_performance_generation === true) {
    command.splice(command.length - 2, 0, '--joint-performance-generation');
  }
  if (config.fixed_configuration?.adjudicator_model) {
    command.splice(
      command.length - 2,
      0,
      '--adjudicator-model',
      String(config.fixed_configuration.adjudicator_model),
    );
  }
  if (config.fixed_configuration?.adjudicator_effort) {
    command.splice(
      command.length - 2,
      0,
      '--adjudicator-effort',
      String(config.fixed_configuration.adjudicator_effort),
    );
  }
  return command;
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

export function tutorStubStrictOriginalCandidateAccepted(accounting = null) {
  return Boolean(
    accounting?.finalDelivery?.source === 'original_candidate' &&
      accounting?.originalCandidate?.audits?.actorialRealizationAudit?.ok === true,
  );
}

function exactTextOccurrences(text, needle) {
  const haystack = String(text || '');
  const target = String(needle || '');
  if (!target) return 0;
  let count = 0;
  let offset = 0;
  while (offset <= haystack.length - target.length) {
    const index = haystack.indexOf(target, offset);
    if (index < 0) break;
    count += 1;
    offset = index + target.length;
  }
  return count;
}

function hostSourceOccurrenceMetric({ row, bundle, generationField = 'structuredGeneration' }) {
  const frame = bundle?.frames?.dramaticRelease || null;
  const active = frame?.active === true;
  const entries = active && Array.isArray(frame?.entries) ? frame.entries : [];
  const composition = row?.[generationField]?.composition || null;
  const sourceSpans = Array.isArray(composition?.spans)
    ? composition.spans.filter((span) => span?.kind === 'source')
    : [];
  const expectedOccurrenceCount = active ? entries.length : 0;
  const declaredSourceCount = Number(composition?.sourceCount);
  const sourceSpanCount = sourceSpans.length;
  const hostOwnedSourceSpanCount = sourceSpans.filter((span) => span?.owner === 'host').length;
  const actualOccurrenceCount = active
    ? entries.reduce(
        (sum, entry) => sum + exactTextOccurrences(composition?.text, entry?.surface),
        0,
      )
    : sourceSpans.length;
  return {
    turn: Number(row?.turn),
    active,
    expectedOccurrenceCount,
    declaredSourceCount: Number.isFinite(declaredSourceCount) ? declaredSourceCount : null,
    sourceSpanCount,
    hostOwnedSourceSpanCount,
    actualOccurrenceCount,
    ok:
      composition !== null &&
      (!active || entries.length > 0) &&
      declaredSourceCount === expectedOccurrenceCount &&
      sourceSpanCount === expectedOccurrenceCount &&
      (generationField !== 'jointPerformanceGeneration' ||
        hostOwnedSourceSpanCount === expectedOccurrenceCount) &&
      actualOccurrenceCount === expectedOccurrenceCount,
  };
}

export function tutorStubFirstDraftIterationStopping({
  current = null,
  previous = null,
  maximumConsecutiveWithoutImprovement = 2,
  requireWorkingScreenPass = false,
} = {}) {
  const maximum = integer(
    maximumConsecutiveWithoutImprovement,
    'maximum consecutive iterations without improvement',
    { minimum: 1 },
  );
  if (!previous) {
    return {
      measurableImprovement: null,
      consecutiveWithoutImprovement: 0,
      maximumConsecutiveWithoutImprovement: maximum,
      stop: false,
      reason: 'first_measured_iteration',
    };
  }
  const currentCompleted = Number(current?.completedTurns || 0);
  const previousCompleted = Number(previous?.completedTurns || 0);
  const currentAccepted = Number(current?.originalCandidatesAccepted || 0);
  const previousAccepted = Number(previous?.originalCandidatesAccepted || 0);
  const currentRate = currentCompleted ? currentAccepted / currentCompleted : 0;
  const previousRate = previousCompleted ? previousAccepted / previousCompleted : 0;
  const currentConfigurationRealization = Number(current?.meanConfigurationRealization);
  const previousConfigurationRealization = Number(previous?.meanConfigurationRealization);
  const comparableCompletion = currentCompleted >= previousCompleted;
  const configurationRealizationImproved =
    comparableCompletion &&
    Number.isFinite(currentConfigurationRealization) &&
    Number.isFinite(previousConfigurationRealization) &&
    currentConfigurationRealization > previousConfigurationRealization;
  const comparableAcceptanceRateImproved =
    currentCompleted === previousCompleted && currentRate > previousRate;
  const comparableAcceptedCountImproved =
    comparableCompletion && currentAccepted > previousAccepted;
  const improved =
    comparableAcceptanceRateImproved ||
    comparableAcceptedCountImproved ||
    configurationRealizationImproved ||
    (comparableCompletion &&
      Number(current?.safetyFailures || 0) < Number(previous?.safetyFailures || 0)) ||
    (comparableCompletion &&
      Number(current?.deterministicFallbacks || 0) < Number(previous?.deterministicFallbacks || 0));
  const consecutive = improved
    ? 0
    : Number(previous?.stopping?.consecutiveWithoutImprovement || 0) + 1;
  const requiredPassMissed = requireWorkingScreenPass && current?.workingScreenPassed !== true;
  return {
    measurableImprovement: improved,
    configurationRealizationImproved,
    comparableCompletion,
    semanticRecognitionCorrections: Number(current?.semanticRecognitionCorrections || 0),
    consecutiveWithoutImprovement: consecutive,
    maximumConsecutiveWithoutImprovement: maximum,
    stop: requiredPassMissed || consecutive >= maximum,
    reason: requiredPassMissed
      ? 'predeclared_final_frontier_attempt_failed'
      : consecutive >= maximum
        ? 'two_consecutive_iterations_without_measurable_improvement'
        : improved
          ? 'improved'
          : 'no_improvement',
  };
}

export function summarizeTutorStubWorkingScreen({ cell, reports = [], config } = {}) {
  const requiredTurns = Number(config.gates_per_cell.required_turns);
  const requiredAccepted = Number(config.gates_per_cell.required_originals_accepted);
  const resultEntries = reports.flatMap((report) => {
    const bundles = Array.isArray(report.bundles) ? report.bundles : [];
    return (report.results || []).map((row) => ({
      row,
      bundle:
        bundles.find((bundle) => bundle?.turnId && bundle.turnId === row?.turnId) ||
        bundles.find((bundle) => Number(bundle?.turn) === Number(row?.turn)) ||
        null,
    }));
  });
  const results = resultEntries.map((entry) => entry.row);
  const strictlyAccepted = (audit) =>
    audit?.ok === true && audit?.audits?.actorialRealizationAudit?.ok === true;
  const accepted = results.filter((row) => strictlyAccepted(row.audit)).length;
  const deterministicAccepted = results.filter((row) =>
    strictlyAccepted(row.deterministicAudit || row.audit),
  ).length;
  const semanticCorrections = results.filter(
    (row) =>
      row.deterministicAudit?.audits?.actorialRealizationAudit?.ok === false &&
      row.audit?.audits?.actorialRealizationAudit?.ok === true,
  ).length;
  const safetyFailures = results.filter((row) => row.audit?.safetyFailure).length;
  const transcriptSpecificUptakeFailures = results.filter(
    (row) => row.audit?.audits?.responseCompositionAudit?.ok === false,
  ).length;
  const originalLatencies = results.map((row) => Number(row.latencyMs || 0));
  const configurationRealizationRates = results.map((row) =>
    Number(row.audit?.audits?.responseConfigurationAudit?.realization_rate || 0),
  );
  const configurationRealizationTotal = configurationRealizationRates.reduce(
    (sum, rate) => sum + rate,
    0,
  );
  const meanConfigurationRealization = results.length
    ? configurationRealizationTotal / results.length
    : null;
  const minimumConfigurationRealization = Number(
    config.gates_per_cell.minimum_mean_configuration_realization || 0,
  );
  const configurationRealizationEnforcement =
    config.gates_per_cell.configuration_realization_enforcement === 'report_only'
      ? 'report_only'
      : 'gate';
  const configurationRealizationIsGate = configurationRealizationEnforcement === 'gate';
  const adjudicationRows = results.filter((row) => row.semanticAdjudication?.called === true);
  const structuredGenerationEnabled = config.fixed_configuration?.structured_generation === true;
  const jointPerformanceGenerationEnabled =
    config.fixed_configuration?.joint_performance_generation === true;
  const typedGenerationEnabled = structuredGenerationEnabled || jointPerformanceGenerationEnabled;
  const generationField = jointPerformanceGenerationEnabled
    ? 'jointPerformanceGeneration'
    : 'structuredGeneration';
  const ownershipAuditField = jointPerformanceGenerationEnabled
    ? 'jointPerformanceAudit'
    : 'structuredSlotOwnershipAudit';
  const validStructuredOutputs = results.filter(
    (row) =>
      row?.[generationField]?.ok === true &&
      row?.[generationField]?.composition !== null,
  ).length;
  const structuredSlotOwnershipPasses = results.filter(
    (row) => row.audit?.audits?.[ownershipAuditField]?.ok === true,
  ).length;
  const structuredSourceOccurrences = resultEntries.map((entry) =>
    hostSourceOccurrenceMetric({ ...entry, generationField }),
  );
  const exactSourceOccurrencePasses = structuredSourceOccurrences.filter((metric) => metric.ok).length;
  const failureCounts = new Map();
  for (const row of results) {
    // Original-only screening rejects a candidate when semantic recognition
    // does not clear an advisory performance miss, even though strict delivery
    // could expose that advisory draft. Count the actual screen failures here,
    // not only strict-delivery hard failures, so the development report does
    // not hide a repeated first-draft generation problem.
    for (const cluster of row.audit?.failureClusters || []) {
      failureCounts.set(cluster, Number(failureCounts.get(cluster) || 0) + 1);
    }
  }
  const originalPossibility = tutorStubFirstDraftGatePossibility({
    accepted,
    completed: results.length,
    total: requiredTurns,
    required: requiredAccepted,
  });
  const configurationMaximumPossibleMean =
    (configurationRealizationTotal + Math.max(0, requiredTurns - results.length)) / requiredTurns;
  const configurationPossibility = {
    enforcement: configurationRealizationEnforcement,
    observedTotal: configurationRealizationTotal,
    completed: results.length,
    remaining: Math.max(0, requiredTurns - results.length),
    requiredMean: minimumConfigurationRealization,
    maximumPossibleMean: configurationMaximumPossibleMean,
    possible: configurationMaximumPossibleMean >= minimumConfigurationRealization,
    passed:
      results.length === requiredTurns &&
      meanConfigurationRealization >= minimumConfigurationRealization,
  };
  const possibility = {
    ...originalPossibility,
    originalAcceptance: originalPossibility,
    configurationRealization: configurationPossibility,
    possible:
      originalPossibility.possible &&
      (!configurationRealizationIsGate || configurationPossibility.possible),
  };
  const gates = {
    originalsAccepted: results.length === requiredTurns && accepted >= requiredAccepted,
    configurationRealization:
      !configurationRealizationIsGate || configurationPossibility.passed,
    safety: safetyFailures <= Number(config.gates_per_cell.maximum_safety_failures || 0),
    fallbacks: true,
    transcriptSpecificUptake:
      config.gates_per_cell.require_transcript_specific_uptake !== true || transcriptSpecificUptakeFailures === 0,
    structuredOutput:
      config.gates_per_cell.require_structured_output !== true ||
      (structuredGenerationEnabled && validStructuredOutputs === results.length),
    structuredSlotOwnership:
      config.gates_per_cell.require_structured_slot_ownership !== true ||
      (structuredGenerationEnabled && structuredSlotOwnershipPasses === results.length),
    exactSourceOnce:
      config.gates_per_cell.require_exact_source_once !== true ||
      (structuredGenerationEnabled && exactSourceOccurrencePasses === results.length),
    jointPerformanceOutput:
      config.gates_per_cell.require_joint_performance_output !== true ||
      (jointPerformanceGenerationEnabled && validStructuredOutputs === results.length),
    jointPerformanceOwnership:
      config.gates_per_cell.require_joint_performance_ownership !== true ||
      (jointPerformanceGenerationEnabled && structuredSlotOwnershipPasses === results.length),
    exactHostSourceOccurrences:
      config.gates_per_cell.require_exact_host_source_occurrences !== true ||
      (jointPerformanceGenerationEnabled && exactSourceOccurrencePasses === results.length),
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
    deterministicOriginalCandidatesAccepted: deterministicAccepted,
    semanticRecognitionCorrections: semanticCorrections,
    semanticAdjudicatorCalls: adjudicationRows.length,
    semanticAdjudicatorErrors: results.filter((row) => row.semanticAdjudication?.error).length,
    mechanicalRepairs: 0,
    modelRewrites: 0,
    deterministicFallbacks: 0,
    safetyFailures,
    transcriptSpecificUptakeFailures,
    structuredModelOutputs: structuredGenerationEnabled ? results.length : 0,
    validStructuredOutputs: structuredGenerationEnabled ? validStructuredOutputs : 0,
    structuredOutputFailures: structuredGenerationEnabled ? results.length - validStructuredOutputs : 0,
    structuredSlotOwnershipPasses: structuredGenerationEnabled ? structuredSlotOwnershipPasses : 0,
    structuredSlotOwnershipFailures: structuredGenerationEnabled
      ? results.length - structuredSlotOwnershipPasses
      : 0,
    exactSourceOccurrencePasses: structuredGenerationEnabled ? exactSourceOccurrencePasses : 0,
    exactSourceOccurrenceFailures: structuredGenerationEnabled
      ? results.length - exactSourceOccurrencePasses
      : 0,
    structuredSourceOccurrences: structuredGenerationEnabled ? structuredSourceOccurrences : [],
    jointPerformanceModelOutputs: jointPerformanceGenerationEnabled ? results.length : 0,
    validJointPerformanceOutputs: jointPerformanceGenerationEnabled ? validStructuredOutputs : 0,
    jointPerformanceOutputFailures: jointPerformanceGenerationEnabled
      ? results.length - validStructuredOutputs
      : 0,
    jointPerformanceOwnershipPasses: jointPerformanceGenerationEnabled
      ? structuredSlotOwnershipPasses
      : 0,
    jointPerformanceOwnershipFailures: jointPerformanceGenerationEnabled
      ? results.length - structuredSlotOwnershipPasses
      : 0,
    exactHostSourceOccurrencePasses: jointPerformanceGenerationEnabled
      ? exactSourceOccurrencePasses
      : 0,
    exactHostSourceOccurrenceFailures: jointPerformanceGenerationEnabled
      ? results.length - exactSourceOccurrencePasses
      : 0,
    hostSourceOccurrences: typedGenerationEnabled ? structuredSourceOccurrences : [],
    meanConfigurationRealization,
    configurationRealizationEnforcement,
    meanOriginalLatencyMs: originalLatencies.length
      ? originalLatencies.reduce((sum, latency) => sum + latency, 0) / originalLatencies.length
      : null,
    meanTotalTutorLatencyMs: originalLatencies.length
      ? results.reduce(
          (sum, row) =>
            sum + Number(row.latencyMs || 0) + Number(row.semanticAdjudication?.latencyMs || 0),
          0,
        ) / originalLatencies.length
      : null,
    meanSemanticAdjudicationLatencyMs: adjudicationRows.length
      ? adjudicationRows.reduce(
          (sum, row) => sum + Number(row.semanticAdjudication?.latencyMs || 0),
          0,
        ) / adjudicationRows.length
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
  const declaredTurns = integer(config.fixed_configuration?.turns, 'fixed turns', { minimum: 1 });
  const reportedGuardTurns = sum((row) => row.guardAccounting?.turns);
  const accountedTurns = sum((row) => row.guardAccounting?.accountedTurns);
  const accountedTurnRate = turns ? accountedTurns / turns : null;
  const deliveredOriginal = sum((row) => row.guardAccounting?.originalCandidateAcceptedTurns);
  const strictOriginal = sum((row) => row.guardAccounting?.strictOriginalCandidateAcceptedTurns);
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
    declaredTurns,
    reportedGuardTurns,
    accountedTurns,
    accountedTurnRate,
    originalCandidatesDelivered: deliveredOriginal,
    originalCandidateDeliveryRate: turns ? deliveredOriginal / turns : null,
    strictOriginalCandidatesAccepted: strictOriginal,
    strictOriginalCandidateAcceptanceRate: turns ? strictOriginal / turns : null,
    // Compatibility aliases now intentionally name the stricter first-draft
    // measurement rather than ordinary safe delivery of an original draft.
    originalCandidatesAccepted: strictOriginal,
    originalCandidateAcceptanceRate: turns ? strictOriginal / turns : null,
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
    complete: rows.length === 1 && turns === declaredTurns,
    accountedTurns:
      reportedGuardTurns === turns &&
      accountedTurns <= turns &&
      accountedTurnRate >= rate(first.minimum_accounted_turn_rate, 'minimum accounted turn rate'),
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
