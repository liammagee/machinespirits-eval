import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

export const TUTOR_STUB_FROZEN_REPLAY_CHECKPOINT_SCHEMA = 'machinespirits.tutor_stub_frozen_replay_checkpoint.v1';

let temporaryFileSequence = 0;

function strictAcceptedByDefault(result) {
  return result?.audit?.ok === true && result?.audit?.audits?.actorialRealizationAudit?.ok === true;
}

export function validateTutorStubFrozenReplayStopMode({
  enabled = false,
  originalOnly = false,
  concurrency = 1,
  out = null,
} = {}) {
  if (!enabled) return { enabled: false };
  if (!originalOnly) {
    throw new Error('--stop-on-first-rejection requires --original-only');
  }
  if (Number(concurrency) !== 1) {
    throw new Error('--stop-on-first-rejection requires --concurrency 1');
  }
  if (!String(out || '').trim()) {
    throw new Error('--stop-on-first-rejection requires --out so admission is checkpointed before generation');
  }
  return {
    enabled: true,
    mode: 'stop_on_first_strict_rejection',
    predeclared: true,
    concurrency: 1,
  };
}

export function buildTutorStubFrozenReplayAdmissionPlan(jobs = []) {
  return jobs.map((job, index) => ({
    id: `admission_${index + 1}`,
    index,
    turn: Number(job?.bundle?.turn ?? job?.turn ?? 0) || null,
    turnId: job?.bundle?.turnId || job?.turnId || null,
    draw: Number(job?.draw ?? 0) || null,
  }));
}

export function buildTutorStubFrozenReplayAdmissionState({
  plan = [],
  results = [],
  strictAccepted = strictAcceptedByDefault,
} = {}) {
  const completedCount = Math.min(results.length, plan.length);
  const firstRejectedIndex = results.findIndex((result) => !strictAccepted(result));
  const stopped = firstRejectedIndex >= 0;
  const status = stopped ? 'stopped_gate_impossible' : completedCount >= plan.length ? 'complete' : 'in_progress';
  const firstRejectedPlan = stopped ? plan[firstRejectedIndex] : null;
  const firstRejectedResult = stopped ? results[firstRejectedIndex] : null;
  const admissions = plan.map((entry, index) => ({
    ...entry,
    status: index < completedCount ? 'completed' : 'unstarted',
    ...(index < completedCount ? { strictAccepted: strictAccepted(results[index]) } : {}),
  }));

  return {
    schema: TUTOR_STUB_FROZEN_REPLAY_CHECKPOINT_SCHEMA,
    status,
    admissionClosed: stopped || status === 'complete',
    stopReason: stopped ? 'first_strict_rejection' : status === 'complete' ? 'plan_complete' : null,
    plannedDraws: plan.length,
    admittedDraws: completedCount,
    completedDraws: completedCount,
    acceptedDraws: results.slice(0, completedCount).filter((result) => strictAccepted(result)).length,
    rejectedDraws: results.slice(0, completedCount).filter((result) => !strictAccepted(result)).length,
    activeDraws: 0,
    unstartedDraws: Math.max(0, plan.length - completedCount),
    firstRejectedAdmission: firstRejectedPlan
      ? {
          ...firstRejectedPlan,
          failureClusters: [...(firstRejectedResult?.audit?.hardFailureClusters || [])],
          safetyFailure: firstRejectedResult?.audit?.safetyFailure === true,
        }
      : null,
    admissions,
  };
}

export function addTutorStubFrozenReplayAdmissionState(report, { admissionState = null, admissionPolicy = null } = {}) {
  if (!admissionState) return report;
  return {
    ...report,
    status: admissionState.status,
    admissionPolicy,
    admissionState,
  };
}

export async function runTutorStubFrozenReplayStopMode({
  jobs = [],
  runJob,
  checkpoint,
  strictAccepted = strictAcceptedByDefault,
} = {}) {
  if (typeof runJob !== 'function') throw new TypeError('runJob must be a function');
  if (typeof checkpoint !== 'function') throw new TypeError('checkpoint must be a function');
  const plan = buildTutorStubFrozenReplayAdmissionPlan(jobs);
  const results = [];

  let admissionState = buildTutorStubFrozenReplayAdmissionState({ plan, results, strictAccepted });
  await checkpoint({ plan, results: [...results], admissionState });

  for (let index = 0; index < jobs.length; index += 1) {
    const result = await runJob(jobs[index], index);
    results.push(result);
    admissionState = buildTutorStubFrozenReplayAdmissionState({ plan, results, strictAccepted });
    await checkpoint({ plan, results: [...results], admissionState });
    if (admissionState.status === 'stopped_gate_impossible') break;
  }

  return { plan, results, admissionState };
}

export function atomicWriteTutorStubFrozenReplayCheckpoint(filePath, value) {
  const target = path.resolve(filePath);
  const directory = path.dirname(target);
  fs.mkdirSync(directory, { recursive: true });
  temporaryFileSequence += 1;
  const temporary = path.join(directory, `.${path.basename(target)}.${process.pid}.${temporaryFileSequence}.tmp`);
  let descriptor = null;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    fs.renameSync(temporary, target);
  } catch (error) {
    if (descriptor !== null) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    throw error;
  }
  return target;
}
