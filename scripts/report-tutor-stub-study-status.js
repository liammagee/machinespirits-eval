#!/usr/bin/env node

/**
 * Read-only tutor-stub QA/study status from existing artifacts.
 *
 * This command deliberately does not inspect or signal processes, call a model
 * provider, write reports, or mutate the artifact root. Artifact timestamps
 * describe recorded work; they do not prove that a provider call is live.
 *
 * Usage:
 *   node scripts/report-tutor-stub-study-status.js <qa-artifact-root>
 *   node scripts/report-tutor-stub-study-status.js <qa-artifact-root> --json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { tutorStubTraceModelRole, verifyExperimentRun } from '../services/experimentRunArtifacts.js';

const STATUS_SCHEMA = 'machinespirits.tutor-stub.study-status.v1';
const COMPLETE_STATUSES = new Set(['ok', 'complete', 'completed', 'dry_run']);
const FAILED_STATUSES = new Set(['failed', 'error', 'aborted', 'incomplete']);
const PROVIDER_FAILURE_TYPES = new Set(['model_call_error', 'model_call_aborted']);
const LOCAL_STOP_TYPES = new Set([
  'model_call_budget_exhausted',
  'program2_provider_budget_denied',
  'auto_safety_turn_cap',
  'auto_learner_profile_adherence_exhausted',
]);
const LOCAL_STOP_REASONS = new Set(['model_call_budget_exhausted', 'auto_safety_turn_cap']);

function usage() {
  process.stdout.write('usage: node scripts/report-tutor-stub-study-status.js <qa-artifact-root> [--json]\n');
}

function normalizeArguments(argv) {
  const json = argv.includes('--json');
  const help = argv.includes('--help') || argv.includes('-h');
  const positional = argv.filter((value) => !['--json', '--help', '-h'].includes(value));
  if (help) return { help: true, json, root: null };
  if (positional.length !== 1) throw new Error('exactly one tutor-stub artifact root is required');
  return { help: false, json, root: path.resolve(positional[0]) };
}

function readJsonSafe(filePath, warnings, label = path.basename(filePath)) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    warnings.push(`${label} could not be read: ${error.message}`);
    return null;
  }
}

function walkFiles(root) {
  const files = [];
  const stack = [root];
  while (stack.length) {
    const directory = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) stack.push(entryPath);
      else if (entry.isFile()) files.push(entryPath);
    }
  }
  return files.sort();
}

function readJsonlSafe(filePath, root, warnings) {
  let textValue = '';
  try {
    textValue = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    warnings.push(`${path.relative(root, filePath)} could not be read: ${error.message}`);
    return [];
  }
  const lines = textValue.split('\n');
  const lastContentIndex = lines.reduce((last, line, index) => (line.trim() ? index : last), -1);
  const records = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    try {
      records.push({ event: JSON.parse(line), filePath, line: index + 1 });
    } catch (error) {
      const fragment = index === lastContentIndex;
      warnings.push(
        `${path.relative(root, filePath)}:${index + 1} ignored ${fragment ? 'an incomplete trailing JSONL fragment' : `invalid JSONL (${error.message})`}`,
      );
    }
  }
  return records;
}

function flagValue(argumentsList, flag) {
  if (!Array.isArray(argumentsList)) return null;
  const index = argumentsList.indexOf(flag);
  return index >= 0 && argumentsList[index + 1] !== undefined ? argumentsList[index + 1] : null;
}

function positiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function plannedTurns(job, plan) {
  const direct = positiveNumber(job.plannedTurns ?? job.turns);
  if (direct !== null) return direct;
  const requested = flagValue(job.arguments, '--auto-turns') || flagValue(job.arguments, '--turns');
  if (requested && requested !== 'until-grounded') return positiveNumber(requested) || 0;
  const designedTurns = plan.intent?.design?.config?.turns ?? plan.intent?.qaMatrix?.turns;
  if (designedTurns && designedTurns !== 'until-grounded') return positiveNumber(designedTurns) || 0;
  const safety =
    flagValue(job.arguments, '--auto-safety-turns') ||
    flagValue(job.arguments, '--safety-turns') ||
    plan.intent?.design?.config?.safetyTurns ||
    plan.intent?.qaMatrix?.safetyTurns;
  return positiveNumber(safety) || 0;
}

function perUnitCallCeiling(job, plan) {
  const direct = positiveNumber(job.modelCallBudget ?? job.callBudget ?? job.maximumModelCalls);
  if (direct !== null) return direct;
  const flag = flagValue(job.arguments, '--model-call-budget');
  if (positiveNumber(flag) !== null) return positiveNumber(flag);
  return (
    positiveNumber(plan.intent?.design?.config?.modelCallBudget) ??
    positiveNumber(plan.intent?.qaMatrix?.modelCallBudget) ??
    positiveNumber(plan.metadata?.modelCallBudget) ??
    0
  );
}

function resolveArtifactRoot(root, job) {
  const value = String(job.artifactRoot || '').trim();
  if (!value || value === '{run_dir}') return root;
  if (value.startsWith('{run_dir}/')) return path.join(root, value.slice('{run_dir}/'.length));
  return path.isAbsolute(value) ? value : path.join(root, value);
}

function eventJobId(event) {
  return String(
    event.jobId ||
      event.evalJobId ||
      event.metadata?.jobId ||
      event.metadata?.evalJobId ||
      event.metadata?.experiment?.jobId ||
      event.experiment?.jobId ||
      '',
  ).trim();
}

function unitSourceIds(unit) {
  return unique([
    unit.id,
    flagValue(unit.arguments, '--eval-job-id'),
    unit.policy && unit.repeat !== null ? `${unit.policy}-r${unit.repeat}` : null,
  ]);
}

function fileRecordGroups(records) {
  const groups = new Map();
  for (const record of records) {
    if (!groups.has(record.filePath)) groups.set(record.filePath, []);
    groups.get(record.filePath).push(record);
  }
  return groups;
}

function pathIsWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

function recordsForUnit(unit, allTraceRecords, root, artifactRootMultiplicity) {
  const artifactRoot = path.resolve(unit.artifactRoot);
  const sourceIds = new Set(unitSourceIds(unit));
  const selected = [];
  for (const [filePath, records] of fileRecordGroups(allTraceRecords)) {
    if (!pathIsWithin(artifactRoot, filePath)) continue;
    const recordedIds = unique(records.map(({ event }) => eventJobId(event)));
    const pathParts = path.relative(root, filePath).split(path.sep);
    const attributed = recordedIds.some((id) => sourceIds.has(id)) || pathParts.some((part) => sourceIds.has(part));
    if (attributed || (artifactRootMultiplicity === 1 && recordedIds.length === 0)) selected.push(...records);
  }
  return selected;
}

function jobEventsForUnit(unit, runEventRecords, rootEventsPath) {
  const sourceIds = new Set(unitSourceIds(unit));
  return runEventRecords.filter((record) => {
    const id = String(record.event.jobId || '').trim();
    if (!sourceIds.has(id)) return false;
    if (record.filePath === rootEventsPath) return id === unit.id;
    return pathIsWithin(path.resolve(unit.artifactRoot), record.filePath);
  });
}

function lastByType(records, types) {
  return [...records].reverse().find(({ event }) => types.has(String(event.type || '')))?.event || null;
}

function countTypes(records, types) {
  return records.filter(({ event }) => types.has(String(event.type || ''))).length;
}

function hasLocalStop(records) {
  return records.some(
    ({ event }) => LOCAL_STOP_TYPES.has(String(event.type || '')) || LOCAL_STOP_REASONS.has(String(event.reason || '')),
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function unitStatus(jobEvents, traceRecords) {
  const completed = lastByType(jobEvents, new Set(['job_completed']));
  if (completed) {
    const status = String(completed.status || (Number(completed.exitCode || 0) === 0 ? 'complete' : 'failed'));
    if (FAILED_STATUSES.has(status) || Number(completed.exitCode || 0) !== 0) return 'failed';
    if (COMPLETE_STATUSES.has(status)) return 'complete';
  }
  if (traceRecords.some(({ event }) => event.type === 'run_end')) return 'complete';
  if (jobEvents.some(({ event }) => event.type === 'job_started') || traceRecords.length) return 'active';
  return 'missing';
}

function modelContractAccepts(plan, event) {
  const role = tutorStubTraceModelRole(event.role);
  const observed = [event.provider, event.model].filter(Boolean).join('/');
  if (!role || !observed || !plan.models?.[role]) return { checked: false, drift: false };
  const contract = plan.models[role];
  const allowed = contract.allowedObservedModels || [];
  if (allowed.length) return { checked: true, drift: !allowed.includes(observed) };
  if (contract.observed) return { checked: true, drift: contract.observed !== observed };
  if (contract.resolved === observed) return { checked: true, drift: false };
  if (contract.allowCliDefaultResolution && String(contract.resolved || '').endsWith('/(cli-default)')) {
    return { checked: true, drift: String(contract.resolved).split('/')[0] !== event.provider };
  }
  return { checked: true, drift: true };
}

function registeredVerdictFiles(files, root) {
  return files
    .filter((filePath) =>
      /(?:registered.*verdict|verdict.*registered|registration.*result)/iu.test(path.basename(filePath)),
    )
    .map((filePath) => path.relative(root, filePath));
}

function recoveryPlans(files, root, warnings) {
  return files
    .filter((filePath) => path.basename(filePath) === 'run-plan.json')
    .map((filePath) => ({ filePath, plan: readJsonSafe(filePath, warnings, path.relative(root, filePath)) }))
    .filter(({ plan }) => plan?.lineage?.resumeOf)
    .map(({ filePath, plan }) => ({ source: path.relative(root, filePath), resumeOf: plan.lineage.resumeOf }));
}

function lastVerifiedEvent(records, root) {
  const candidates = records
    .map((record) => ({ ...record, timestamp: record.event.recordedAt || record.event.ts || null }))
    .filter((record) => record.timestamp && Number.isFinite(Date.parse(record.timestamp)))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  const last = candidates.at(-1);
  if (!last) return null;
  return {
    timestamp: last.timestamp,
    type: String(last.event.type || 'unknown'),
    source: `${path.relative(root, last.filePath)}:${last.line}`,
  };
}

function sealStatus(root, files) {
  const sealPath = path.join(root, 'run-seal.json');
  if (!files.includes(sealPath)) {
    return { state: 'unsealed', verified: null, status: null, errors: [] };
  }
  try {
    const verification = verifyExperimentRun(root, { completeness: false });
    return {
      state: verification.ok ? 'sealed and integrity-verified' : 'sealed but integrity verification failed',
      verified: verification.ok,
      status: verification.seal?.status || null,
      errors: verification.errors,
    };
  } catch (error) {
    return { state: 'sealed but unreadable', verified: false, status: null, errors: [error.message] };
  }
}

export function deriveTutorStubStudyStatus(rootPath) {
  const root = path.resolve(rootPath);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`artifact root is not a directory: ${root}`);
  }
  const warnings = [];
  const files = walkFiles(root);
  const planPath = path.join(root, 'run-plan.json');
  const plan = readJsonSafe(planPath, warnings, 'run-plan.json');
  if (!plan || !Array.isArray(plan.jobs) || !plan.jobs.length) {
    throw new Error(`readable run-plan.json with planned jobs is required under ${root}`);
  }

  const rootEventsPath = path.join(root, 'run-events.jsonl');
  const rootEvents = files.includes(rootEventsPath) ? readJsonlSafe(rootEventsPath, root, warnings) : [];
  const nestedRunEventFiles = files.filter(
    (filePath) => path.basename(filePath) === 'run-events.jsonl' && filePath !== rootEventsPath,
  );
  const nestedRunEvents = nestedRunEventFiles.flatMap((filePath) => readJsonlSafe(filePath, root, warnings));
  const allRunEvents = [...rootEvents, ...nestedRunEvents];
  const traceFiles = files.filter(
    (filePath) => filePath.endsWith('.jsonl') && path.basename(filePath) !== 'run-events.jsonl',
  );
  const allTraceRecords = traceFiles.flatMap((filePath) => readJsonlSafe(filePath, root, warnings));

  const unitShells = plan.jobs.map((job, index) => {
    const id = String(job.id || `unit-${index + 1}`);
    const artifactRoot = resolveArtifactRoot(root, job);
    return {
      id,
      ordinal: Number(job.ordinal || index + 1),
      profile: job.profile || null,
      policy: job.policy || null,
      repeat: job.repeat ?? null,
      arguments: job.arguments || [],
      plannedTurns: plannedTurns(job, plan),
      hardCeiling: perUnitCallCeiling(job, plan),
      artifactRoot,
    };
  });
  const artifactRootCounts = new Map();
  for (const unit of unitShells) {
    artifactRootCounts.set(unit.artifactRoot, (artifactRootCounts.get(unit.artifactRoot) || 0) + 1);
  }
  const units = unitShells.map((shell) => {
    const records = recordsForUnit(shell, allTraceRecords, root, artifactRootCounts.get(shell.artifactRoot) || 1);
    const jobEvents = jobEventsForUnit(shell, allRunEvents, rootEventsPath);
    const turnsCompleted = countTypes(records, new Set(['turn_complete']));
    const callsReserved = countTypes(records, new Set(['model_call_budget_reserved']));
    const callsCompleted = countTypes(records, new Set(['model_call']));
    const callsFailed = countTypes(records, PROVIDER_FAILURE_TYPES);
    const repairRequests = countTypes(records, new Set(['auto_learner_profile_repair_requested']));
    const adherenceExhaustions = countTypes(records, new Set(['auto_learner_profile_adherence_exhausted']));
    const localStops = hasLocalStop(records) ? 1 : 0;
    const status = localStops > 0 ? 'failed' : unitStatus(jobEvents, records);
    return {
      ...shell,
      arguments: undefined,
      artifactRoot: path.relative(root, shell.artifactRoot) || '.',
      status,
      turnsCompleted,
      callsReserved,
      callsCompleted,
      callsFailed,
      repairRequests,
      adherenceExhaustions,
      localStops,
      lastEvent: lastVerifiedEvent(records, root),
    };
  });

  const counts = {
    complete: units.filter((unit) => unit.status === 'complete').length,
    active: units.filter((unit) => unit.status === 'active').length,
    failed: units.filter((unit) => unit.status === 'failed').length,
    missing: units.filter((unit) => unit.status === 'missing').length,
  };
  const calls = {
    reserved: units.reduce((sum, unit) => sum + unit.callsReserved, 0),
    completed: units.reduce((sum, unit) => sum + unit.callsCompleted, 0),
    failed: units.reduce((sum, unit) => sum + unit.callsFailed, 0),
    hardCeiling: units.reduce((sum, unit) => sum + unit.hardCeiling, 0),
  };
  calls.remaining = Math.max(0, calls.hardCeiling - calls.reserved);
  const turns = {
    completed: units.reduce((sum, unit) => sum + unit.turnsCompleted, 0),
    planned: units.reduce((sum, unit) => sum + unit.plannedTurns, 0),
  };
  const repairUnits = unique(units.filter((unit) => unit.repairRequests).map((unit) => unit.id));
  const exhaustedUnits = unique(units.filter((unit) => unit.adherenceExhaustions).map((unit) => unit.id));
  const localStopUnits = unique(units.filter((unit) => unit.localStops).map((unit) => unit.id));
  const recoveries = recoveryPlans(files, root, warnings);
  const seal = sealStatus(root, files);
  const verdictFiles = registeredVerdictFiles(files, root);
  const modelChecks = allTraceRecords
    .filter(({ event }) => event.type === 'model_call')
    .map(({ event }) => modelContractAccepts(plan, event))
    .filter((result) => result.checked);
  const planSha = plan.provenance?.git?.sha || null;
  const provenanceChecks = allTraceRecords
    .filter(({ event }) => event.type === 'run_start')
    .map(({ event }) => event.metadata?.provenance?.git?.sha || event.metadata?.provenance?.gitSha || null)
    .filter(Boolean);
  const driftCount =
    modelChecks.filter((result) => result.drift).length +
    (planSha ? provenanceChecks.filter((sha) => sha !== planSha).length : 0);
  const driftChecked = modelChecks.length + (planSha ? provenanceChecks.length : 0);
  const providerFailures = calls.failed;
  const localStops = units.reduce((sum, unit) => sum + unit.localStops, 0);

  const state =
    counts.failed > 0 || localStops > 0
      ? 'BLOCKED'
      : counts.complete === units.length && seal.verified && seal.status === 'complete'
        ? 'COMPLETE'
        : 'PAUSED';
  const noVerdict = verdictFiles.length === 0;
  const humanDecisionRequired = state === 'BLOCKED' && recoveries.length === 0;
  const failedDescription = units
    .filter((unit) => unit.status === 'failed')
    .map((unit) => `${unit.id} at turn ${unit.turnsCompleted}/${unit.plannedTurns || '?'}`)
    .join(', ');
  const currentIssue = noVerdict
    ? `${failedDescription ? `${failedDescription} failed. ` : ''}No registered verdict exists in this artifact root; recovery or continuation remains unresolved.`
    : failedDescription
      ? `${failedDescription} failed; the recorded verdict must not be widened by this status report.`
      : 'No execution failure is recorded in the readable artifacts.';
  const nextSafeAction = humanDecisionRequired
    ? 'Decide whether frozen authority permits recovery or continuation; stop before any model call until that boundary is resolved.'
    : state === 'COMPLETE'
      ? 'Preserve the sealed artifacts; stop unless separately authorized analysis is requested.'
      : 'Verify process/provider activity outside this artifact snapshot; stop if activity cannot be proved.';

  return {
    schema: STATUS_SCHEMA,
    artifactRoot: root,
    state,
    modelActivity: {
      state: 'not verifiable',
      explanation:
        'Artifact events and timestamps do not prove whether a process or provider call is currently running.',
    },
    unitCounts: counts,
    units,
    turns,
    calls,
    repairsOrRecovery: {
      profileRepairRequests: units.reduce((sum, unit) => sum + unit.repairRequests, 0),
      profileRepairUnits: repairUnits,
      adherenceExhaustions: units.reduce((sum, unit) => sum + unit.adherenceExhaustions, 0),
      adherenceExhaustionUnits: exhaustedUnits,
      recoveryRuns: recoveries.length,
      recoverySources: recoveries,
    },
    failures: {
      providerCallFailures: providerFailures,
      localBudgetOrRuntimeStops: localStops,
      localStopUnits,
    },
    configurationDrift: {
      state: driftCount > 0 ? 'observed' : driftChecked > 0 ? 'none observed' : 'not verifiable',
      checkedObservations: driftChecked,
      driftObservations: driftCount,
    },
    seal,
    lastVerifiedEvent: lastVerifiedEvent([...allRunEvents, ...allTraceRecords], root),
    registeredVerdict: { found: !noVerdict, sources: verdictFiles },
    currentIssue,
    nextSafeAction,
    humanDecisionRequired,
    warnings,
  };
}

function listUnits(values) {
  return values.length ? values.join(', ') : 'none';
}

export function renderTutorStubStudyStatus(status) {
  const lines = [
    `State: ${status.state}`,
    `Model activity: ${status.modelActivity.state} — ${status.modelActivity.explanation}`,
    `Units: ${status.unitCounts.complete} complete / ${status.unitCounts.active} active / ${status.unitCounts.failed} failed / ${status.unitCounts.missing} missing`,
    `Turns: ${status.turns.completed} completed / ${status.turns.planned} planned`,
    `Calls: ${status.calls.reserved} reserved / ${status.calls.completed} completed / ${status.calls.failed} failed / ${status.calls.hardCeiling} hard ceiling (${status.calls.remaining} remaining)`,
    'Per-unit progress:',
    ...status.units.map(
      (unit) =>
        `  ${unit.id}: ${unit.status}; turns ${unit.turnsCompleted}/${unit.plannedTurns || '?'}; calls ${unit.callsReserved} reserved, ${unit.callsCompleted} completed, ${unit.callsFailed} failed / ${unit.hardCeiling} ceiling`,
    ),
    `Repairs or recovery: ${status.repairsOrRecovery.profileRepairRequests} profile-repair requests in ${listUnits(status.repairsOrRecovery.profileRepairUnits)}; ${status.repairsOrRecovery.adherenceExhaustions} adherence exhaustions in ${listUnits(status.repairsOrRecovery.adherenceExhaustionUnits)}; ${status.repairsOrRecovery.recoveryRuns} recovery runs recorded.`,
    `Failure boundary: ${status.failures.providerCallFailures} provider-call failures; ${status.failures.localBudgetOrRuntimeStops} local budget/runtime stops in ${listUnits(status.failures.localStopUnits)}.`,
    `Configuration drift: ${status.configurationDrift.state} (${status.configurationDrift.checkedObservations} readable observations checked).`,
    `Seal/integrity: ${status.seal.state}${status.seal.status ? `; recorded status ${status.seal.status}` : ''}.`,
    `Last verified event: ${status.lastVerifiedEvent ? `${status.lastVerifiedEvent.timestamp} — ${status.lastVerifiedEvent.type} at ${status.lastVerifiedEvent.source}` : 'none readable'}`,
    `Registered verdict: ${status.registeredVerdict.found ? `found at ${status.registeredVerdict.sources.join(', ')}` : 'none found in artifact root'}.`,
    `Current issue: ${status.currentIssue}`,
    `Next safe action: ${status.nextSafeAction}`,
    `Human decision required: ${status.humanDecisionRequired ? 'yes' : 'no'}`,
  ];
  if (status.warnings.length)
    lines.push(`Read safety: ${status.warnings.length} warning(s); ${status.warnings.join('; ')}`);
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = normalizeArguments(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  const status = deriveTutorStubStudyStatus(args.root);
  process.stdout.write(args.json ? `${JSON.stringify(status, null, 2)}\n` : renderTutorStubStudyStatus(status));
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`tutor-stub study status: ${error.message}\n`);
    process.exitCode = 1;
  }
}
