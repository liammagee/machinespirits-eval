#!/usr/bin/env node

import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { loadLongRunningWorkflowStatus } from '../services/longRunningWorkflowStatus.js';

function number(value, digits = 1) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : 'unavailable';
}

function timingText(status) {
  const pace = status.timing.recent_observed_pace;
  const paceText = pace
    ? `${number(pace.units_per_hour_low)}–${number(pace.units_per_hour_high)} units/hour from ${pace.sample_size} recent unit(s)`
    : 'unavailable';
  const eta = status.timing.eta_range;
  const etaText =
    eta.basis === 'unavailable'
      ? `unavailable — ${eta.explanation}`
      : `${eta.basis} ${eta.earliest_at} to ${eta.latest_at} — ${eta.explanation}`;
  return `workflow started ${status.workflow_started_at}; phase started ${status.phase_started_at}; last material progress ${status.last_material_progress_at}; recent pace ${paceText}; ETA ${etaText}`;
}

export function renderLongRunningWorkflowStatus(status, recovery = {}) {
  const blocker = status.blocker?.observed_error || status.blocker?.message || 'none';
  const completed = status.completed_phases.length ? status.completed_phases.join(', ') : 'none';
  const latestRepair = status.repair_or_recovery_history.at(-1);
  const repairs = latestRepair
    ? `${status.repair_or_recovery_history.length} recorded; latest ${latestRepair.kind}: ${latestRepair.observed_error || latestRepair.operation}`
    : 'none recorded';
  const happening =
    status.current_phase === 'HANDOFF_PENDING'
      ? `${status.blocker?.next_phase || 'the next phase'} is waiting to start: ${status.blocker?.message || 'no explanation recorded'}`
      : status.current_phase === 'BLOCKED'
        ? `${status.blocker?.blocked_phase || 'the workflow'} is blocked after ${status.blocker?.operation || 'an operation failed'}`
        : status.current_phase === 'WORKFLOW_COMPLETE'
          ? 'Every phase in the requested workflow plan is complete.'
          : `${status.current_phase} is ${status.phase_status}: ${status.next_action.description}`;
  const lines = [
    `State: ${status.current_phase} (${status.workflow_status})`,
    `What is happening now: ${happening}`,
    `Overall progress: completed phases ${completed}; plan ${status.phase_plan.join(' → ')}`,
    `Timing: ${timingText(status)}`,
    `Model activity: ${status.model_activity.state} — ${status.model_activity.explanation}`,
    `Units: ${status.units.complete} complete / ${status.units.active} active / ${status.units.failed} failed / ${status.units.missing} missing`,
    `Calls: ${status.calls.completed} completed / ${status.calls.failed} failed / ${status.calls.reserved} reserved / ${status.calls.hard_ceiling} hard ceiling`,
    `Repairs or recovery: ${repairs}`,
    `Current issue: ${blocker}`,
    `Next action: ${status.next_action.description} Stop condition: ${status.next_action.stopping_condition}`,
    `Human decision required: ${status.human_action_required ? 'yes' : 'no'}`,
  ];
  if (recovery.recovered_from) lines.push(`Status recovery: recovered from ${recovery.recovered_from}.`);
  if (recovery.warnings?.length) lines.push(`Read warnings: ${recovery.warnings.join('; ')}`);
  return `${lines.join('\n')}\n`;
}

function usage() {
  return 'usage: node scripts/report-long-running-workflow-status.js <workflow-status.json> [--json]\n';
}

function main() {
  const { values, positionals } = parseArgs({
    options: {
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
  });
  if (values.help) return process.stdout.write(usage());
  if (positionals.length !== 1) throw new Error('exactly one workflow-status path is required');
  const loaded = loadLongRunningWorkflowStatus(path.resolve(positionals[0]));
  process.stdout.write(
    values.json ? `${JSON.stringify(loaded, null, 2)}\n` : renderLongRunningWorkflowStatus(loaded.status, loaded),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`workflow status: ${error.message}\n`);
    process.exitCode = 1;
  }
}
