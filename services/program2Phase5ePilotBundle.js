import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { program2PlanSha256 } from './program2ExperimentSafety.js';
import { summarizeTutorStubFixedHorizon } from './tutorStubEvalIntegrity.js';

export const PROGRAM2_PHASE5E_PILOT_BUNDLE_SCHEMA = 'machinespirits.program2.phase5e-r2-pilot-bundle.v1';
export const PROGRAM2_PHASE5F_PILOT_BUNDLE_SCHEMA = 'machinespirits.program2.phase5f-pilot-bundle.v1';
export const PROGRAM2_PHASE5F_A3_SOURCE_SHA = '473640a4ae8aa159e5b8a395686bcfc9ee0a5c69';

const VARIABLE_COMMAND_FLAGS = new Set(['--eval-job-id', '--trace-dir']);

function flagValue(command = [], flag) {
  const index = command.indexOf(flag);
  return index >= 0 ? command[index + 1] : null;
}

function canonicalCommand(command = []) {
  const result = [];
  for (let index = 0; index < command.length; index += 1) {
    const token = command[index];
    if (VARIABLE_COMMAND_FLAGS.has(token)) {
      result.push(token, `<${token.slice(2)}>`);
      index += 1;
    } else {
      result.push(token);
    }
  }
  return result;
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function readJsonLines(file) {
  const events = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      events.push({ type: 'invalid_json_line' });
    }
  }
  return events;
}

function sealedTraceFiles(pilotRoot, job) {
  const directory = path.join(pilotRoot, 'traces', job.id);
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith('.jsonl'))
    .map((file) => path.join(directory, file))
    .filter((file) => /"type"\s*:\s*"run_end"/u.test(fs.readFileSync(file, 'utf8')))
    .sort();
}

function traceRow(job, file, primaryHorizon) {
  const events = readJsonLines(file);
  const runStart = events.find((event) => event.type === 'run_start') || null;
  const runEnd = events.findLast((event) => event.type === 'run_end') || null;
  const turnRecords = events
    .filter((event) => event.type === 'turn_complete' && event.turnRecord)
    .map((event) => event.turnRecord);
  const verdicts = events
    .filter((event) => event.type === 'point_of_action_compliance' && event.compliance?.trigger === 'warrant_skip')
    .map((event) => event.compliance);
  const moments = events
    .filter((event) => event.type === 'program2_committee_moment' && event.moment)
    .map((event) => ({ turn: event.turn, ...event.moment }));
  const leakTurns = turnRecords
    .filter((turn) => turn?.tutorLeakAudit?.ok === false || (turn?.tutorLeakAudit?.leaks || []).length > 0)
    .map((turn) => Number(turn.turn));
  return {
    row: {
      job: {
        id: job.id,
        ordinal: job.ordinal,
        profile: job.profile,
        arm: job.arm,
        repeat: job.repeat,
        blockKey: `${job.profile}:${job.repeat}`,
      },
      warrant: { opp: verdicts.length, comp: verdicts.filter((verdict) => verdict.compliant === true).length },
      fixedHorizon: summarizeTutorStubFixedHorizon(turnRecords, { primaryHorizon }),
      leakTurns,
      moments,
      trace: { file, sha256: sha256File(file) },
    },
    runStart,
    runEnd,
    invalidJsonLines: events.filter((event) => event.type === 'invalid_json_line').length,
  };
}

export function loadProgram2Phase5eRows({ plan, root } = {}) {
  return (plan?.jobs || [])
    .map((job) => {
      const files = sealedTraceFiles(root, job);
      return files.length === 1 ? traceRow(job, files[0], plan.primaryHorizon).row : null;
    })
    .filter(Boolean);
}

function check(id, pass, detail) {
  return { id, pass: Boolean(pass), detail };
}

function expectedCohortJob(cohortPlan, pilotJob) {
  return cohortPlan.jobs.find(
    (job) => job.profile === pilotJob.profile && job.arm === pilotJob.arm && Number(job.repeat) === Number(pilotJob.repeat),
  );
}

export function buildProgram2PilotBundle({
  cohortPlan,
  pilotPlan,
  pilotRoot,
  repositoryRoot,
  cohortSourceSha = null,
  pilotSourceSha = null,
  bundleSchema = PROGRAM2_PHASE5E_PILOT_BUNDLE_SCHEMA,
  expectedCohortSchema = 'machinespirits.tutor-stub.program2-phase5e-r2-plan.v1',
  expectedPilotSchemas = ['machinespirits.tutor-stub.program2-phase5e-r2-pilot-plan.v1'],
  acceptedPilotSourceSha = null,
} = {}) {
  const cohortSha256 = program2PlanSha256(cohortPlan);
  const expectedGroups = ['affective_resistant|committee', 'affective_resistant|silent_control', 'proof_skipper|committee', 'proof_skipper|silent_control'];
  const observedGroups = (pilotPlan?.jobs || []).map((job) => `${job.profile}|${job.arm}`).sort();
  const traces = (pilotPlan?.jobs || []).map((job) => {
    const files = sealedTraceFiles(pilotRoot, job);
    return { job, files, parsed: files.length === 1 ? traceRow(job, files[0], pilotPlan.primaryHorizon) : null };
  });
  const rows = traces.map((entry) => entry.parsed?.row).filter(Boolean);
  const exactPipeline = traces.every(({ job }) => {
    const cohortJob = expectedCohortJob(cohortPlan, job);
    return cohortJob && JSON.stringify(canonicalCommand(job.command)) === JSON.stringify(canonicalCommand(cohortJob.command));
  });
  const identitiesMatch = traces.every(({ job, parsed }) => {
    const experiment = parsed?.runStart?.metadata?.experiment || {};
    return (
      experiment.jobId === job.id &&
      experiment.profile === job.profile &&
      Number(experiment.repeat) === Number(job.repeat) &&
      parsed?.runEnd &&
      parsed.invalidJsonLines === 0
    );
  });
  const worldAndSeedMatch = traces.every(({ job, parsed }) => {
    const metadata = parsed?.runStart?.metadata || {};
    const options = metadata?.sessionRecipe?.config?.options || {};
    return (
      metadata?.scenarioPicker?.selectedScenarioId === pilotPlan.world &&
      options.world === flagValue(job.command, '--world') &&
      String(options['run-seed']) === String(flagValue(job.command, '--run-seed'))
    );
  });
  const modelStackMatches = traces.every(({ job, parsed }) => {
    const options = parsed?.runStart?.metadata?.sessionRecipe?.config?.options || {};
    return ['--model', '--classifier-model', '--learner-record-model', '--auto-learner-model', '--committee-mini-model'].every(
      (flag) => String(options[flag.slice(2)] ?? '') === String(flagValue(job.command, flag) ?? ''),
    );
  });
  const apparatusMatches = traces.every(({ job, parsed }) => {
    const options = parsed?.runStart?.metadata?.sessionRecipe?.config?.options || {};
    const pointOfAction = parsed?.runStart?.metadata?.pointOfAction || {};
    const commandRubric = flagValue(job.command, '--learner-analysis-evidence-use-rubric');
    const commandFallback = flagValue(job.command, '--committee-fallback-policy');
    const runtimeRubric = options['learner-analysis-evidence-use-rubric'];
    const armMatches =
      options['point-of-action-arm'] === job.arm &&
      (!pointOfAction.arm || pointOfAction.arm === job.arm);
    const rubricMatches =
      commandRubric === pilotPlan.evidenceUseRubric &&
      (runtimeRubric === undefined || runtimeRubric === pilotPlan.evidenceUseRubric);
    const fallbackMatches =
      job.arm === 'committee'
        ? commandFallback === pilotPlan.fallbackPolicy &&
          options['committee-fallback-policy'] === pilotPlan.fallbackPolicy &&
          (!pointOfAction.committee?.fallbackPolicy ||
            pointOfAction.committee.fallbackPolicy === pilotPlan.fallbackPolicy)
        : commandFallback === null;
    return armMatches && rubricMatches && fallbackMatches;
  });
  const normalizedRowsComplete = rows.length === 4 && rows.every((row) => {
    return (
      Number.isFinite(row.warrant.opp) &&
      row.fixedHorizon?.complete === true &&
      typeof row.fixedHorizon?.coverageAtHorizon === 'number' &&
      typeof row.fixedHorizon?.hardSafetyPassed === 'boolean'
    );
  });
  const sourceTransitionAccepted =
    pilotSourceSha === cohortSourceSha ||
    (acceptedPilotSourceSha !== null && pilotSourceSha === acceptedPilotSourceSha);
  const checks = [
    check('cohort_plan_schema', cohortPlan?.schema === expectedCohortSchema, cohortPlan?.schema),
    check(
      'pilot_plan_schema',
      expectedPilotSchemas.includes(pilotPlan?.schema) && pilotPlan?.jobs?.length === 4,
      `${pilotPlan?.schema || 'missing'}; jobs=${pilotPlan?.jobs?.length || 0}`,
    ),
    check(
      'cohort_plan_and_source_bound',
      /^[0-9a-f]{64}$/u.test(cohortSha256) &&
        /^[0-9a-f]{40}$/u.test(cohortSourceSha || '') &&
        /^[0-9a-f]{40}$/u.test(pilotSourceSha || '') &&
        sourceTransitionAccepted,
      {
        planSha256: cohortSha256,
        cohortSourceSha,
        pilotSourceSha,
        sourceTransition: pilotSourceSha === cohortSourceSha ? 'same_source' : 'accepted_frozen_pilot_source',
      },
    ),
    check('profile_arm_coverage', JSON.stringify(observedGroups) === JSON.stringify(expectedGroups), observedGroups),
    check('exact_pipeline_commands', exactPipeline, 'pilot commands equal their repeat-1 cohort counterparts except job and trace paths'),
    check('sealed_trace_count', traces.every((entry) => entry.files.length === 1), traces.map((entry) => `${entry.job.id}:${entry.files.length}`)),
    check('run_identity', identitiesMatch, 'run_start experiment identity, run_end, and JSONL parse'),
    check('world_and_seed', worldAndSeedMatch, `${pilotPlan?.world}; seed=${pilotPlan?.runSeed}`),
    check('model_stack', modelStackMatches, 'tutor, classifier, learner-record, learner, and committee-mini pins'),
    check(
      'rubric_and_intervention',
      apparatusMatches,
      `${pilotPlan?.evidenceUseRubric}; command-bound rubric (legacy traces may omit the runtime option), point-of-action arms, and active committee fallback policy`,
    ),
    check('normalized_rows_complete', normalizedRowsComplete, `${rows.length}/4 rows with complete fixed-horizon outcomes`),
  ];
  const status = checks.every((entry) => entry.pass) ? 'pass' : 'fail';
  const root = path.resolve(repositoryRoot);
  return {
    schema: bundleSchema,
    generatedAt: new Date().toISOString(),
    zeroModel: true,
    expectedPlanSha256: cohortSha256,
    expectedSourceSha: cohortSourceSha,
    rows: rows.map((row) => ({
      ...row,
      trace: { ...row.trace, file: path.relative(root, row.trace.file) },
    })),
    audit: {
      status,
      plan: {
        schema: cohortPlan?.schema || null,
        sha256: cohortSha256,
        sourceSha: cohortSourceSha,
        pilotSourceSha,
      },
      checks,
    },
    evidenceBindings: {
      files: rows.map((row) => ({
        role: `pilot_trace:${row.job.id}`,
        file: path.relative(root, row.trace.file),
        sha256: row.trace.sha256,
      })),
    },
  };
}

export function buildProgram2Phase5ePilotBundle(options = {}) {
  return buildProgram2PilotBundle(options);
}

export function buildProgram2Phase5fPilotBundle(options = {}) {
  return buildProgram2PilotBundle({
    ...options,
    bundleSchema: PROGRAM2_PHASE5F_PILOT_BUNDLE_SCHEMA,
    expectedCohortSchema: 'machinespirits.tutor-stub.program2-phase5f-plan.v1',
    expectedPilotSchemas: ['machinespirits.tutor-stub.program2-phase5f-pilot-a3-plan.v1'],
    acceptedPilotSourceSha: PROGRAM2_PHASE5F_A3_SOURCE_SHA,
  });
}
