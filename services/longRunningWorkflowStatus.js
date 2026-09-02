import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const LONG_RUNNING_WORKFLOW_STATUS_SCHEMA = 'machinespirits.long-running-workflow-status.v1';

export const LONG_RUNNING_WORKFLOW_PHASES = Object.freeze([
  'PREFLIGHT',
  'GENERATING',
  'RECOVERING',
  'EXTRACTING',
  'AUDITING',
  'PACKAGING',
  'BLOCKED',
  'HANDOFF_PENDING',
  'WORKFLOW_COMPLETE',
]);

const PHASE_SET = new Set(LONG_RUNNING_WORKFLOW_PHASES);
const MODEL_ACTIVITY_STATES = new Set(['active', 'inactive', 'unverifiable']);
const ETA_BASES = new Set(['measured', 'inferred', 'unavailable']);
const WORKFLOW_STATES = new Set(['active', 'blocked', 'handoff_pending', 'complete']);
const PHASE_STATUSES = new Set(['active', 'blocked', 'complete', 'pending']);

function isoTime(value, label) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} must be an ISO timestamp`);
  return date.toISOString();
}

function nonnegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative integer`);
  return value;
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function normalizeUnits(units = {}) {
  return {
    complete: nonnegativeInteger(units.complete ?? 0, 'units.complete'),
    active: nonnegativeInteger(units.active ?? 0, 'units.active'),
    failed: nonnegativeInteger(units.failed ?? 0, 'units.failed'),
    missing: nonnegativeInteger(units.missing ?? 0, 'units.missing'),
  };
}

function normalizeCalls(calls = {}) {
  const normalized = {
    completed: nonnegativeInteger(calls.completed ?? 0, 'calls.completed'),
    failed: nonnegativeInteger(calls.failed ?? 0, 'calls.failed'),
    reserved: nonnegativeInteger(calls.reserved ?? 0, 'calls.reserved'),
    hard_ceiling: nonnegativeInteger(calls.hard_ceiling ?? 0, 'calls.hard_ceiling'),
  };
  if (normalized.reserved > normalized.hard_ceiling) {
    throw new Error('calls.reserved cannot exceed calls.hard_ceiling');
  }
  return normalized;
}

function normalizeModelActivity(modelActivity = {}) {
  const state = modelActivity.state || 'unverifiable';
  if (!MODEL_ACTIVITY_STATES.has(state)) throw new Error(`unsupported model activity state: ${state}`);
  return {
    state,
    explanation: requireText(
      modelActivity.explanation || 'No authorized evidence source established current provider activity.',
      'model_activity.explanation',
    ),
  };
}

function normalizeNextAction(nextAction = {}) {
  return {
    description: requireText(
      nextAction.description || 'Inspect the current workflow state.',
      'next_action.description',
    ),
    stopping_condition: requireText(
      nextAction.stopping_condition || 'Stop after the current state is verified.',
      'next_action.stopping_condition',
    ),
  };
}

function validDurations(values) {
  return (Array.isArray(values) ? values : [])
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)
    .slice(-8);
}

export function estimateLongRunningWorkflowEta({ recentUnitDurationsMs = [], remainingUnits = 0, asOf }) {
  const at = isoTime(asOf || new Date(), 'ETA asOf');
  const durations = validDurations(recentUnitDurationsMs);
  const remaining = nonnegativeInteger(remainingUnits, 'remainingUnits');
  if (remaining === 0) {
    return {
      recent_unit_durations_ms: durations,
      recent_observed_pace: durations.length
        ? {
            sample_size: durations.length,
            units_per_hour_low: 3_600_000 / Math.max(...durations),
            units_per_hour_high: 3_600_000 / Math.min(...durations),
          }
        : null,
      eta_range: {
        basis: 'measured',
        earliest_at: at,
        latest_at: at,
        explanation: 'No active or missing units remain in the current phase.',
      },
    };
  }
  if (durations.length < 2) {
    return {
      recent_unit_durations_ms: durations,
      recent_observed_pace: null,
      eta_range: {
        basis: 'unavailable',
        earliest_at: null,
        latest_at: null,
        explanation: `At least two completed-unit durations are required; ${durations.length} ${durations.length === 1 ? 'is' : 'are'} available.`,
      },
    };
  }
  const lowDuration = Math.min(...durations);
  const highDuration = Math.max(...durations);
  const nowMs = Date.parse(at);
  return {
    recent_unit_durations_ms: durations,
    recent_observed_pace: {
      sample_size: durations.length,
      units_per_hour_low: 3_600_000 / highDuration,
      units_per_hour_high: 3_600_000 / lowDuration,
    },
    eta_range: {
      basis: 'inferred',
      earliest_at: new Date(nowMs + lowDuration * remaining).toISOString(),
      latest_at: new Date(nowMs + highDuration * remaining).toISOString(),
      explanation: `Inferred from ${durations.length} recent completed-unit durations and ${remaining} active or missing unit(s).`,
    },
  };
}

function phasePlan(values) {
  if (!Array.isArray(values) || values.length < 2) throw new Error('phase_plan must contain at least two phases');
  const normalized = values.map((phase) => requireText(phase, 'phase_plan phase'));
  if (normalized.some((phase) => !PHASE_SET.has(phase))) throw new Error('phase_plan contains an unsupported phase');
  if (normalized.some((phase) => ['BLOCKED', 'HANDOFF_PENDING'].includes(phase))) {
    throw new Error('phase_plan cannot contain transient BLOCKED or HANDOFF_PENDING states');
  }
  if (new Set(normalized).size !== normalized.length) throw new Error('phase_plan phases must be unique');
  if (normalized.at(-1) !== 'WORKFLOW_COMPLETE') throw new Error('phase_plan must end with WORKFLOW_COMPLETE');
  return normalized;
}

function phaseHistoryEntry(phase, status, startedAt, completedAt = null) {
  return {
    phase,
    status,
    started_at: startedAt,
    completed_at: completedAt,
  };
}

export function createLongRunningWorkflowStatus({
  workflowId,
  phasePlan: requestedPhasePlan,
  at = new Date(),
  units,
  calls,
  modelActivity,
  nextAction,
} = {}) {
  const startedAt = isoTime(at, 'workflow start');
  const checkedPlan = phasePlan(requestedPhasePlan || ['PREFLIGHT', 'WORKFLOW_COMPLETE']);
  const firstPhase = checkedPlan[0];
  const record = {
    schema_version: LONG_RUNNING_WORKFLOW_STATUS_SCHEMA,
    workflow_id: requireText(workflowId, 'workflow_id'),
    phase_plan: checkedPlan,
    current_phase: firstPhase,
    phase_status: 'active',
    workflow_status: 'active',
    completed_phases: [],
    workflow_started_at: startedAt,
    phase_started_at: startedAt,
    last_material_progress_at: startedAt,
    units: normalizeUnits(units),
    calls: normalizeCalls(calls),
    timing: estimateLongRunningWorkflowEta({
      recentUnitDurationsMs: [],
      remainingUnits: (units?.active || 0) + (units?.missing || 0),
      asOf: startedAt,
    }),
    blocker: null,
    next_action: normalizeNextAction(nextAction),
    human_action_required: false,
    model_activity: normalizeModelActivity(modelActivity),
    repair_or_recovery_history: [],
    phase_history: [phaseHistoryEntry(firstPhase, 'active', startedAt)],
  };
  validateLongRunningWorkflowStatus(record);
  return record;
}

function clone(record) {
  return structuredClone(record);
}

function completeOpenHistory(record, phase, at) {
  const entry = [...record.phase_history]
    .reverse()
    .find((candidate) => candidate.phase === phase && candidate.completed_at === null);
  if (entry) {
    entry.status = 'complete';
    entry.completed_at = at;
  } else {
    record.phase_history.push(phaseHistoryEntry(phase, 'complete', record.phase_started_at, at));
  }
}

function applyProgress(record, { at, units, calls, recentUnitDurationsMs }) {
  if (units) record.units = normalizeUnits(units);
  if (calls) record.calls = normalizeCalls(calls);
  if (units || calls || recentUnitDurationsMs) record.last_material_progress_at = at;
  const durations = recentUnitDurationsMs ?? record.timing?.recent_unit_durations_ms ?? [];
  record.timing = estimateLongRunningWorkflowEta({
    recentUnitDurationsMs: durations,
    remainingUnits: record.units.active + record.units.missing,
    asOf: at,
  });
}

export function startLongRunningWorkflowPhase(
  source,
  { phase, at = new Date(), units, calls, recentUnitDurationsMs, modelActivity, nextAction } = {},
) {
  validateLongRunningWorkflowStatus(source);
  const next = clone(source);
  const timestamp = isoTime(at, 'phase start');
  if (!PHASE_SET.has(phase) || ['BLOCKED', 'HANDOFF_PENDING', 'WORKFLOW_COMPLETE'].includes(phase)) {
    throw new Error(`cannot start workflow phase: ${phase}`);
  }
  if (!next.phase_plan.includes(phase) && phase !== 'RECOVERING') {
    throw new Error(`phase ${phase} is not in the workflow phase plan`);
  }
  if (phase !== 'RECOVERING') {
    const phaseIndex = next.phase_plan.indexOf(phase);
    const incompletePredecessors = next.phase_plan
      .slice(0, phaseIndex)
      .filter((candidate) => candidate !== 'WORKFLOW_COMPLETE' && !next.completed_phases.includes(candidate));
    if (incompletePredecessors.length) {
      throw new Error(`cannot start ${phase}; incomplete preceding phases: ${incompletePredecessors.join(', ')}`);
    }
  }
  if (next.current_phase === 'HANDOFF_PENDING' && next.blocker?.next_phase && next.blocker.next_phase !== phase) {
    throw new Error(`handoff is pending for ${next.blocker.next_phase}, not ${phase}`);
  }
  if (next.current_phase === 'HANDOFF_PENDING') completeOpenHistory(next, 'HANDOFF_PENDING', timestamp);
  next.current_phase = phase;
  next.phase_status = 'active';
  next.workflow_status = 'active';
  next.phase_started_at = timestamp;
  next.blocker = null;
  next.human_action_required = false;
  if (modelActivity) next.model_activity = normalizeModelActivity(modelActivity);
  if (nextAction) next.next_action = normalizeNextAction(nextAction);
  next.phase_history.push(phaseHistoryEntry(phase, 'active', timestamp));
  applyProgress(next, { at: timestamp, units, calls, recentUnitDurationsMs });
  validateLongRunningWorkflowStatus(next);
  return next;
}

export function updateLongRunningWorkflowProgress(
  source,
  { at = new Date(), units, calls, recentUnitDurationsMs, modelActivity, nextAction } = {},
) {
  validateLongRunningWorkflowStatus(source);
  const next = clone(source);
  const timestamp = isoTime(at, 'progress time');
  if (modelActivity) next.model_activity = normalizeModelActivity(modelActivity);
  if (nextAction) next.next_action = normalizeNextAction(nextAction);
  applyProgress(next, { at: timestamp, units, calls, recentUnitDurationsMs });
  validateLongRunningWorkflowStatus(next);
  return next;
}

export function completeLongRunningWorkflowPhase(
  source,
  {
    phase,
    nextPhase,
    at = new Date(),
    handoffExplanation,
    startNextImmediately = false,
    units,
    calls,
    recentUnitDurationsMs,
    modelActivity,
    nextAction,
  } = {},
) {
  validateLongRunningWorkflowStatus(source);
  const timestamp = isoTime(at, 'phase completion');
  if (!source.phase_plan.includes(phase) || phase === 'WORKFLOW_COMPLETE') {
    throw new Error(`cannot complete planned workflow phase: ${phase}`);
  }
  if (source.current_phase !== phase && !(source.current_phase === 'RECOVERING' && phase === 'GENERATING')) {
    throw new Error(`cannot complete ${phase} while current phase is ${source.current_phase}`);
  }
  const next = clone(source);
  completeOpenHistory(next, phase, timestamp);
  if (!next.completed_phases.includes(phase)) next.completed_phases.push(phase);
  applyProgress(next, { at: timestamp, units, calls, recentUnitDurationsMs });
  if (modelActivity) next.model_activity = normalizeModelActivity(modelActivity);
  if (nextAction) next.next_action = normalizeNextAction(nextAction);
  if (startNextImmediately) {
    if (nextPhase === 'WORKFLOW_COMPLETE') {
      return completeLongRunningWorkflow(next, {
        at: timestamp,
        units: next.units,
        calls: next.calls,
        recentUnitDurationsMs: next.timing.recent_unit_durations_ms,
        nextAction: next.next_action,
      });
    }
    return startLongRunningWorkflowPhase(next, {
      phase: nextPhase,
      at: timestamp,
      modelActivity: next.model_activity,
      nextAction: next.next_action,
    });
  }
  next.current_phase = 'HANDOFF_PENDING';
  next.phase_status = 'pending';
  next.workflow_status = 'handoff_pending';
  next.phase_started_at = timestamp;
  next.blocker = {
    kind: 'handoff',
    message: requireText(handoffExplanation, 'handoff explanation'),
    next_phase: requireText(nextPhase, 'next phase'),
  };
  next.phase_history.push(phaseHistoryEntry('HANDOFF_PENDING', 'pending', timestamp));
  validateLongRunningWorkflowStatus(next);
  return next;
}

export function blockLongRunningWorkflow(
  source,
  {
    blockedPhase,
    error,
    at = new Date(),
    operation,
    repairRequired = false,
    repair,
    units,
    calls,
    modelActivity,
    nextAction,
    humanActionRequired = false,
  } = {},
) {
  validateLongRunningWorkflowStatus(source);
  const next = clone(source);
  const timestamp = isoTime(at, 'blocked time');
  const observedError = requireText(error, 'observed error');
  const failedOperation = requireText(operation || blockedPhase, 'failed operation');
  next.current_phase = 'BLOCKED';
  next.phase_status = 'blocked';
  next.workflow_status = 'blocked';
  next.phase_started_at = timestamp;
  next.blocker = {
    kind: repairRequired ? 'repair_required' : 'workflow_blocked',
    blocked_phase: requireText(blockedPhase, 'blocked phase'),
    operation: failedOperation,
    observed_error: observedError,
    repair_required: Boolean(repairRequired),
  };
  next.human_action_required = Boolean(humanActionRequired);
  next.model_activity = normalizeModelActivity(
    modelActivity || {
      state: 'unverifiable',
      explanation: 'The failure record does not independently establish whether provider activity continues.',
    },
  );
  next.next_action = normalizeNextAction(nextAction);
  next.phase_history.push(phaseHistoryEntry('BLOCKED', 'blocked', timestamp));
  applyProgress(next, { at: timestamp, units, calls });
  if (repairRequired) {
    next.repair_or_recovery_history.push({
      at: timestamp,
      kind: repair?.kind || 'repair_required',
      operation: failedOperation,
      observed_error: observedError,
      paid_work_or_data_affected: requireText(
        repair?.paid_work_or_data_affected || 'unverified',
        'repair paid-work or data effect',
      ),
      why_code_change_required: requireText(repair?.why_code_change_required, 'repair reason'),
      proposed_change: requireText(repair?.proposed_change, 'proposed repair change'),
      remains_blocked: requireText(repair?.remains_blocked || 'The failed phase cannot continue.', 'repair blocker'),
      model_activity: next.model_activity.state,
      eta_after_repair: requireText(repair?.eta_after_repair || 'unavailable', 'repair ETA'),
    });
  }
  validateLongRunningWorkflowStatus(next);
  return next;
}

export function recordLongRunningWorkflowRecovery(
  source,
  { at = new Date(), operation, reason, scope, modelActivity } = {},
) {
  validateLongRunningWorkflowStatus(source);
  const next = clone(source);
  const timestamp = isoTime(at, 'recovery time');
  if (modelActivity) next.model_activity = normalizeModelActivity(modelActivity);
  next.repair_or_recovery_history.push({
    at: timestamp,
    kind: 'recovery',
    operation: requireText(operation, 'recovery operation'),
    reason: requireText(reason, 'recovery reason'),
    scope: requireText(scope, 'recovery scope'),
    model_activity: next.model_activity.state,
  });
  validateLongRunningWorkflowStatus(next);
  return next;
}

export function completeLongRunningWorkflow(
  source,
  { at = new Date(), units, calls, recentUnitDurationsMs, nextAction } = {},
) {
  validateLongRunningWorkflowStatus(source);
  const required = source.phase_plan.filter((phase) => phase !== 'WORKFLOW_COMPLETE');
  const missing = required.filter((phase) => !source.completed_phases.includes(phase));
  if (missing.length) throw new Error(`cannot complete workflow; incomplete phases: ${missing.join(', ')}`);
  const next = clone(source);
  const timestamp = isoTime(at, 'workflow completion');
  next.current_phase = 'WORKFLOW_COMPLETE';
  next.phase_status = 'complete';
  next.workflow_status = 'complete';
  next.phase_started_at = timestamp;
  next.last_material_progress_at = timestamp;
  next.blocker = null;
  next.human_action_required = false;
  next.model_activity = {
    state: 'inactive',
    explanation: 'The complete workflow has no active model-backed phase.',
  };
  next.next_action = normalizeNextAction(
    nextAction || {
      description: 'Preserve the completed workflow artifacts.',
      stopping_condition: 'Stop unless a separately scoped follow-up is requested.',
    },
  );
  if (!next.completed_phases.includes('WORKFLOW_COMPLETE')) next.completed_phases.push('WORKFLOW_COMPLETE');
  next.phase_history.push(phaseHistoryEntry('WORKFLOW_COMPLETE', 'complete', timestamp, timestamp));
  applyProgress(next, { at: timestamp, units, calls, recentUnitDurationsMs });
  validateLongRunningWorkflowStatus(next);
  return next;
}

export function validateLongRunningWorkflowStatus(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record))
    throw new Error('workflow status must be an object');
  if (record.schema_version !== LONG_RUNNING_WORKFLOW_STATUS_SCHEMA) {
    throw new Error(`unsupported workflow status schema: ${record.schema_version}`);
  }
  requireText(record.workflow_id, 'workflow_id');
  const plan = phasePlan(record.phase_plan);
  if (!PHASE_SET.has(record.current_phase)) throw new Error(`unsupported current phase: ${record.current_phase}`);
  if (!PHASE_STATUSES.has(record.phase_status)) throw new Error(`unsupported phase status: ${record.phase_status}`);
  if (!WORKFLOW_STATES.has(record.workflow_status)) {
    throw new Error(`unsupported whole-workflow status: ${record.workflow_status}`);
  }
  isoTime(record.workflow_started_at, 'workflow_started_at');
  isoTime(record.phase_started_at, 'phase_started_at');
  isoTime(record.last_material_progress_at, 'last_material_progress_at');
  normalizeUnits(record.units);
  normalizeCalls(record.calls);
  normalizeModelActivity(record.model_activity);
  normalizeNextAction(record.next_action);
  if (!Array.isArray(record.completed_phases) || record.completed_phases.some((phase) => !plan.includes(phase))) {
    throw new Error('completed_phases must be members of phase_plan');
  }
  if (new Set(record.completed_phases).size !== record.completed_phases.length) {
    throw new Error('completed_phases must not contain duplicates');
  }
  const completedIndexes = record.completed_phases.map((phase) => plan.indexOf(phase));
  if (completedIndexes.some((value, index) => index > 0 && value <= completedIndexes[index - 1])) {
    throw new Error('completed_phases must follow phase_plan order');
  }
  if (!record.timing || !ETA_BASES.has(record.timing.eta_range?.basis)) {
    throw new Error('timing.eta_range requires a supported basis');
  }
  validDurations(record.timing.recent_unit_durations_ms);
  if (!Array.isArray(record.repair_or_recovery_history)) {
    throw new Error('repair_or_recovery_history must be an array');
  }
  if (!Array.isArray(record.phase_history)) throw new Error('phase_history must be an array');
  return record;
}

function fsyncDirectory(directory) {
  let descriptor;
  try {
    descriptor = fs.openSync(directory, 'r');
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (!['EINVAL', 'ENOTSUP', 'EBADF'].includes(error.code)) throw error;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function writeDurably(filePath, bytes) {
  const descriptor = fs.openSync(filePath, 'wx');
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

export function writeLongRunningWorkflowStatusAtomic(filePath, record) {
  validateLongRunningWorkflowStatus(record);
  const target = path.resolve(filePath);
  const directory = path.dirname(target);
  fs.mkdirSync(directory, { recursive: true });
  const suffix = `${process.pid}-${randomUUID()}`;
  const temporary = `${target}.tmp-${suffix}`;
  const previous = `${target}.previous`;
  const previousTemporary = `${previous}.tmp-${suffix}`;
  const bytes = `${JSON.stringify(record, null, 2)}\n`;
  try {
    writeDurably(temporary, bytes);
    if (fs.existsSync(target)) {
      const currentBytes = fs.readFileSync(target);
      try {
        validateLongRunningWorkflowStatus(JSON.parse(currentBytes.toString('utf8')));
        writeDurably(previousTemporary, currentBytes);
        fs.renameSync(previousTemporary, previous);
      } catch {
        // Preserve the last valid previous record rather than backing up a corrupt primary.
      }
    }
    fs.renameSync(temporary, target);
    fsyncDirectory(directory);
  } finally {
    for (const residue of [temporary, previousTemporary]) {
      if (fs.existsSync(residue)) fs.rmSync(residue, { force: true });
    }
  }
  return target;
}

function statusCandidatePaths(target) {
  const directory = path.dirname(target);
  const basename = path.basename(target);
  const temporary = fs.existsSync(directory)
    ? fs
        .readdirSync(directory)
        .filter((name) => name.startsWith(`${basename}.tmp-`))
        .map((name) => path.join(directory, name))
        .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
    : [];
  return [target, `${target}.previous`, ...temporary];
}

export function loadLongRunningWorkflowStatus(filePath) {
  const target = path.resolve(filePath);
  const errors = [];
  for (const candidate of statusCandidatePaths(target)) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const status = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      validateLongRunningWorkflowStatus(status);
      return {
        status,
        recovered_from: candidate === target ? null : candidate,
        warnings:
          candidate === target
            ? []
            : [
                `Recovered workflow status from ${path.basename(candidate)} because the primary record was unavailable or invalid.`,
              ],
      };
    } catch (error) {
      errors.push(`${path.basename(candidate)}: ${error.message}`);
    }
  }
  throw new Error(`no recoverable workflow status at ${target}${errors.length ? ` (${errors.join('; ')})` : ''}`);
}
