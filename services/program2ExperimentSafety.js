import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const PROGRAM2_LAUNCH_CERTIFICATE_SCHEMA = 'machinespirits.program2.launch-certificate.v1';
export const PROGRAM2_FUTILITY_SCHEMA = 'machinespirits.program2.live-futility-check.v1';

export const DEFAULT_PROGRAM2_GATE_SPEC = Object.freeze({
  coverageThreshold: 0.8,
  minSealedPerCell: 10,
  minCompleteBlocks: 8,
  minCompleteBlocksPerProfile: 4,
  minOpportunitiesPerCell: 60,
  minOpportunitiesPerProfileCell: 20,
  minPilotRowsPerProfileCell: 1,
  opportunityReserveFactor: 1.25,
  maxOpportunitiesPerDialogue: 40,
  maxAttritionDifference: 1,
  attritionPairs: [],
  requireCueBlind: true,
});

export const DEFAULT_PROGRAM2_BUDGET_POLICY = Object.freeze({
  maxAttemptsPerJob: 2,
  terraCallsPerTurn: 6,
  sonnetCallsPerTurn: 2,
});

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

export function program2PlanSha256(plan) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalJson(plan)))
    .digest('hex');
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function conditionFor(job) {
  return String(job?.condition ?? job?.arm ?? 'unknown');
}

function blockFor(job) {
  return String(job?.blockKey ?? `${job?.profile ?? 'unknown'}:${job?.repeat ?? job?.ordinal ?? 'unknown'}`);
}

function groupCount(rows, keyFor) {
  const counts = new Map();
  for (const row of rows) {
    const key = keyFor(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function objectFromKeys(keys, valueFor) {
  return Object.fromEntries(keys.map((key) => [key, valueFor(key)]));
}

function proofPathRows(world = {}) {
  const proofPaths = Array.isArray(world.proof_paths) ? world.proof_paths : [];
  return proofPaths
    .map((entry, index) => ({
      id: entry?.id || `proof_path_${index + 1}`,
      premises: Array.isArray(entry?.premises) ? entry.premises.map(String) : [],
    }))
    .filter((entry) => entry.premises.length > 0);
}

/**
 * Compute the best proof-path coverage the authored release schedule can make
 * public by a fixed horizon. This is structural and makes no model calls.
 */
export function deriveProgram2WorldReachability(
  world,
  { horizon, coverageThreshold = DEFAULT_PROGRAM2_GATE_SPEC.coverageThreshold } = {},
) {
  const resolvedHorizon = finiteNumber(horizon, Number.NaN);
  const paths = proofPathRows(world);
  const releases = new Map(
    (Array.isArray(world?.release_schedule) ? world.release_schedule : [])
      .filter((entry) => entry?.premise)
      .map((entry) => [String(entry.premise), finiteNumber(entry.turn, Infinity)]),
  );
  const pathResults = paths.map((entry) => {
    const released = entry.premises.filter((premise) => (releases.get(premise) ?? Infinity) <= resolvedHorizon);
    const unavailable = entry.premises.filter((premise) => (releases.get(premise) ?? Infinity) > resolvedHorizon);
    return {
      id: entry.id,
      premiseCount: entry.premises.length,
      releasedCount: released.length,
      released,
      unavailable,
      coverageAtHorizon: entry.premises.length ? released.length / entry.premises.length : 0,
    };
  });
  const maxCoverageAtHorizon = pathResults.length
    ? Math.max(...pathResults.map((entry) => entry.coverageAtHorizon))
    : 0;
  const pass = Number.isFinite(resolvedHorizon) && paths.length > 0 && maxCoverageAtHorizon >= coverageThreshold;
  return {
    pass,
    horizon: Number.isFinite(resolvedHorizon) ? resolvedHorizon : null,
    coverageThreshold,
    maxCoverageAtHorizon,
    paths: pathResults,
    reason: pass
      ? null
      : paths.length === 0
        ? 'world has no authored proof path'
        : `authored release schedule can reach at most ${maxCoverageAtHorizon.toFixed(3)} coverage by turn ${resolvedHorizon}; threshold is ${coverageThreshold.toFixed(3)}`,
  };
}

/** Shared by analyzers, launch certificates, and live stop-loss checks. */
export function evaluateProgram2RowGuardrails(
  rows,
  { coverageThreshold = DEFAULT_PROGRAM2_GATE_SPEC.coverageThreshold } = {},
) {
  const coverageFailures = rows
    .filter((row) => finiteNumber(row?.fixedHorizon?.coverageAtHorizon, 0) < coverageThreshold)
    .map((row) => ({
      jobId: row?.job?.id || null,
      coverageAtHorizon: finiteNumber(row?.fixedHorizon?.coverageAtHorizon, 0),
    }));
  const safetyFailures = rows
    .filter((row) => row?.fixedHorizon?.hardSafetyPassed !== true || (row?.leakTurns || []).length > 0)
    .map((row) => ({
      jobId: row?.job?.id || null,
      hardSafetyPassed: row?.fixedHorizon?.hardSafetyPassed === true,
      leakTurns: row?.leakTurns || [],
    }));
  return {
    pass: coverageFailures.length === 0 && safetyFailures.length === 0,
    coverage: { pass: coverageFailures.length === 0, threshold: coverageThreshold, failures: coverageFailures },
    safety: { pass: safetyFailures.length === 0, failures: safetyFailures },
  };
}

function plannedGroupKeys(plan) {
  const profiles = [...new Set(plan.jobs.map((job) => String(job.profile)))].sort();
  const conditions = [...new Set(plan.jobs.map(conditionFor))].sort();
  return {
    profiles,
    conditions,
    profileConditions: profiles.flatMap((profile) => conditions.map((condition) => `${profile}|${condition}`)),
  };
}

export function evaluateProgram2PilotEvidence({ plan, rows, gateSpec = {} } = {}) {
  const spec = { ...DEFAULT_PROGRAM2_GATE_SPEC, ...gateSpec };
  const keys = plannedGroupKeys(plan);
  const plannedByProfileCondition = groupCount(plan.jobs, (job) => `${job.profile}|${conditionFor(job)}`);
  const pilotByProfileCondition = new Map();
  for (const row of rows) {
    const key = `${row?.job?.profile}|${conditionFor(row?.job)}`;
    const bucket = pilotByProfileCondition.get(key) || [];
    bucket.push(row);
    pilotByProfileCondition.set(key, bucket);
  }
  const missingGroups = keys.profileConditions.filter(
    (key) => (pilotByProfileCondition.get(key) || []).length < spec.minPilotRowsPerProfileCell,
  );
  const projectedByProfileCondition = objectFromKeys(keys.profileConditions, (key) => {
    const pilotRows = pilotByProfileCondition.get(key) || [];
    const observed = pilotRows.map((row) => finiteNumber(row?.warrant?.opp, 0));
    const meanPerDialogue = observed.length ? observed.reduce((sum, value) => sum + value, 0) / observed.length : 0;
    const plannedDialogues = plannedByProfileCondition.get(key) || 0;
    const projectedOpportunities = meanPerDialogue * plannedDialogues;
    const requiredWithReserve = spec.minOpportunitiesPerProfileCell * spec.opportunityReserveFactor;
    return {
      pilotRows: observed.length,
      observed,
      meanPerDialogue,
      plannedDialogues,
      projectedOpportunities,
      required: spec.minOpportunitiesPerProfileCell,
      requiredWithReserve,
      pass: observed.length >= spec.minPilotRowsPerProfileCell && projectedOpportunities >= requiredWithReserve,
    };
  });
  const projectedByCondition = objectFromKeys(keys.conditions, (condition) => {
    const groupRows = keys.profiles.map((profile) => projectedByProfileCondition[`${profile}|${condition}`]);
    const projectedOpportunities = groupRows.reduce((sum, entry) => sum + entry.projectedOpportunities, 0);
    const requiredWithReserve = spec.minOpportunitiesPerCell * spec.opportunityReserveFactor;
    return {
      projectedOpportunities,
      required: spec.minOpportunitiesPerCell,
      requiredWithReserve,
      pass:
        groupRows.every((entry) => entry.pilotRows >= spec.minPilotRowsPerProfileCell) &&
        projectedOpportunities >= requiredWithReserve,
    };
  });
  const guardrails = evaluateProgram2RowGuardrails(rows, spec);
  const opportunityPowerPass =
    missingGroups.length === 0 &&
    Object.values(projectedByProfileCondition).every((entry) => entry.pass) &&
    Object.values(projectedByCondition).every((entry) => entry.pass);
  return {
    pass: rows.length > 0 && guardrails.pass && opportunityPowerPass,
    exactPipelineRows: rows.length,
    missingGroups,
    guardrails,
    opportunityPower: {
      pass: opportunityPowerPass,
      reserveFactor: spec.opportunityReserveFactor,
      byCondition: projectedByCondition,
      byProfileCondition: projectedByProfileCondition,
    },
  };
}

export function deriveProgram2Budget(plan, policy = {}) {
  const resolved = { ...DEFAULT_PROGRAM2_BUDGET_POLICY, ...policy };
  const jobs = plan.jobs.length;
  const turnsPerAttempt = finiteNumber(plan.safetyTurns, 0);
  const maxTokensPerCall = finiteNumber(plan.maxTokens, 0);
  const callsPerTurn = resolved.terraCallsPerTurn + resolved.sonnetCallsPerTurn;
  const callsPerAttempt = turnsPerAttempt * callsPerTurn;
  const maxAttempts = jobs * resolved.maxAttemptsPerJob;
  return {
    pass:
      jobs > 0 && turnsPerAttempt > 0 && maxTokensPerCall > 0 && resolved.maxAttemptsPerJob === 2 && callsPerTurn > 0,
    maxJobs: jobs,
    maxAttemptsPerJob: resolved.maxAttemptsPerJob,
    maxRetries: jobs * (resolved.maxAttemptsPerJob - 1),
    maxTurnsPerAttempt: turnsPerAttempt,
    terraCallsPerTurn: resolved.terraCallsPerTurn,
    sonnetCallsPerTurn: resolved.sonnetCallsPerTurn,
    maxProviderCallsPerAttempt: callsPerAttempt,
    maxProviderCalls: callsPerAttempt * maxAttempts,
    maxTokensPerCall,
    maxReservedOutputTokensPerAttempt: callsPerAttempt * maxTokensPerCall,
    maxReservedOutputTokens: callsPerAttempt * maxAttempts * maxTokensPerCall,
  };
}

function provenanceResult(pilotAudits = []) {
  const audits = pilotAudits.map((entry) => ({
    bound: entry?.bound === true,
    status: entry?.audit?.status || null,
    checks: entry?.audit?.checks || [],
    expectedPlanSha256: entry?.expectedPlanSha256 || null,
    observedPlanSha256: entry?.audit?.plan?.sha256 || null,
  }));
  return {
    pass:
      audits.length > 0 &&
      audits.every(
        (entry) =>
          entry.bound &&
          entry.status === 'pass' &&
          entry.checks.length === 11 &&
          entry.checks.every((check) => check?.pass === true),
      ),
    auditCount: audits.length,
    audits: audits.map(({ checks, ...entry }) => ({ ...entry, checkCount: checks.length })),
  };
}

export function buildProgram2LaunchCertificate({
  phase,
  plan,
  sourceSha,
  world,
  pilotRows = [],
  pilotAudits = [],
  gateSpec = {},
  budgetPolicy = {},
  planValidation = { ok: true, errors: [] },
  evidenceBindings = { files: [] },
} = {}) {
  const spec = { ...DEFAULT_PROGRAM2_GATE_SPEC, ...gateSpec };
  const staticReachability = deriveProgram2WorldReachability(world, {
    horizon: plan.primaryHorizon,
    coverageThreshold: spec.coverageThreshold,
  });
  const budget = deriveProgram2Budget(plan, budgetPolicy);
  const pilot =
    phase === 'cohort'
      ? evaluateProgram2PilotEvidence({ plan, rows: pilotRows, gateSpec: spec })
      : { pass: true, skipped: true, reason: 'pilot certificate precedes exact-pipeline pilot evidence' };
  const provenance = phase === 'cohort' ? provenanceResult(pilotAudits) : { pass: true, skipped: true };
  const checks = {
    planValidation: { pass: planValidation?.ok === true, errors: planValidation?.errors || [] },
    staticReachability,
    exactPipelinePilot: pilot,
    pilotProvenance: provenance,
    opportunityPower: phase === 'cohort' ? pilot.opportunityPower : { pass: true, skipped: true },
    budget,
  };
  const pass = Object.values(checks).every((check) => check.pass === true);
  return {
    schema: PROGRAM2_LAUNCH_CERTIFICATE_SCHEMA,
    generatedAt: new Date().toISOString(),
    phase,
    status: pass ? 'pass' : 'fail',
    modelCallsBeforeCertificate: 0,
    sourceSha,
    planSha256: program2PlanSha256(plan),
    planSchema: plan.schema,
    evidenceBindings,
    gateSpec: spec,
    checks,
    budget,
    liveFutility: {
      enabled: true,
      schema: PROGRAM2_FUTILITY_SCHEMA,
      gateSpec: spec,
      budget,
      rule: 'stop only when a preregistered completion gate becomes mathematically unreachable; never stop for a null treatment effect',
    },
  };
}

export function validateProgram2LaunchCertificate(certificate, { plan, sourceSha, phase } = {}) {
  const errors = [];
  if (certificate?.schema !== PROGRAM2_LAUNCH_CERTIFICATE_SCHEMA) errors.push('certificate schema mismatch');
  if (certificate?.status !== 'pass') errors.push('certificate status is not pass');
  if (certificate?.phase !== phase) errors.push(`certificate phase ${certificate?.phase || 'missing'} != ${phase}`);
  if (certificate?.modelCallsBeforeCertificate !== 0) errors.push('certificate was not zero-model');
  if (certificate?.sourceSha !== sourceSha) errors.push('certificate source SHA mismatch');
  if (certificate?.planSha256 !== program2PlanSha256(plan)) errors.push('certificate plan hash mismatch');
  if (certificate?.budget?.maxAttemptsPerJob !== 2) errors.push('certificate retry cap is not two attempts');
  if (certificate?.liveFutility?.enabled !== true) errors.push('certificate does not enable live futility checks');
  if (!Object.values(certificate?.checks || {}).every((check) => check?.pass === true)) {
    errors.push('certificate contains a failed check');
  }
  const expectedBudget = deriveProgram2Budget(plan);
  for (const key of [
    'maxJobs',
    'maxAttemptsPerJob',
    'maxRetries',
    'maxTurnsPerAttempt',
    'maxProviderCallsPerAttempt',
    'maxProviderCalls',
    'maxTokensPerCall',
    'maxReservedOutputTokensPerAttempt',
    'maxReservedOutputTokens',
  ]) {
    if (certificate?.budget?.[key] !== expectedBudget[key]) errors.push(`certificate budget mismatch: ${key}`);
  }
  if (JSON.stringify(certificate?.liveFutility?.gateSpec) !== JSON.stringify(certificate?.gateSpec)) {
    errors.push('certificate live-futility gate spec drift');
  }
  if (!Array.isArray(certificate?.evidenceBindings?.files) || certificate.evidenceBindings.files.length === 0) {
    errors.push('certificate has no evidence-file bindings');
  }
  return { pass: errors.length === 0, errors };
}

export function validateProgram2CertificateEvidenceBindings(certificate, { root }) {
  const errors = [];
  const resolvedRoot = path.resolve(root);
  const rootPrefix = `${resolvedRoot}${path.sep}`;
  for (const binding of certificate?.evidenceBindings?.files || []) {
    const file = path.resolve(resolvedRoot, String(binding?.file || ''));
    if (file !== resolvedRoot && !file.startsWith(rootPrefix)) {
      errors.push(`${binding?.role || 'evidence'} escapes the repository root`);
      continue;
    }
    if (!fs.existsSync(file)) {
      errors.push(`${binding?.role || 'evidence'} is missing: ${binding?.file || 'unknown'}`);
      continue;
    }
    const observed = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (observed !== binding?.sha256) errors.push(`${binding?.role || 'evidence'} hash mismatch`);
  }
  return { pass: errors.length === 0, errors };
}

function cueBlindViolation(row) {
  return (row?.moments || []).some(
    (moment) =>
      moment?.fallback?.policy !== 'cue_blind' ||
      moment?.enforcementLedger?.cueInspectedAfterExtraction === true ||
      finiteNumber(moment?.enforcementLedger?.miniResamples, 0) !== 0 ||
      finiteNumber(moment?.enforcementLedger?.composerCalls, 0) > 1,
  );
}

function intervalDistance([leftMin, leftMax], [rightMin, rightMax]) {
  if (leftMax < rightMin) return rightMin - leftMax;
  if (rightMax < leftMin) return leftMin - rightMax;
  return 0;
}

export function evaluateProgram2LiveFutility({ plan, launchState = {}, rows = [], contract = {} } = {}) {
  const spec = { ...DEFAULT_PROGRAM2_GATE_SPEC, ...(contract.gateSpec || {}) };
  const budget = { ...deriveProgram2Budget(plan), ...(contract.budget || {}) };
  const rowById = new Map(rows.map((row) => [row.job.id, row]));
  const statusFor = (job) => {
    if (rowById.has(job.id) || launchState.jobs?.[job.id]?.status === 'sealed') return 'sealed';
    const state = launchState.jobs?.[job.id];
    if (state?.status === 'failed' && state?.attrition === true && finiteNumber(state.attempts, 0) >= 2) {
      return 'attrition';
    }
    return 'pending';
  };
  const statuses = new Map(plan.jobs.map((job) => [job.id, statusFor(job)]));
  const sealedJobs = plan.jobs.filter((job) => statuses.get(job.id) === 'sealed');
  const attritionJobs = plan.jobs.filter((job) => statuses.get(job.id) === 'attrition');
  const pendingJobs = plan.jobs.filter((job) => statuses.get(job.id) === 'pending');
  const unknownSealedJobs = sealedJobs.filter((job) => !rowById.has(job.id));
  const reasons = [];

  const guardrails = evaluateProgram2RowGuardrails(rows, spec);
  for (const failure of guardrails.coverage.failures) {
    reasons.push(
      `${failure.jobId}: coverage ${failure.coverageAtHorizon.toFixed(3)} is below ${spec.coverageThreshold.toFixed(3)}`,
    );
  }
  for (const failure of guardrails.safety.failures) reasons.push(`${failure.jobId}: frozen all-row safety gate failed`);
  if (spec.requireCueBlind) {
    for (const row of rows.filter(cueBlindViolation)) reasons.push(`${row.job.id}: cue-blind enforcement failed`);
  }

  const { profiles, conditions, profileConditions } = plannedGroupKeys(plan);
  const sealedByCondition = groupCount(sealedJobs, conditionFor);
  const pendingByCondition = groupCount(pendingJobs, conditionFor);
  for (const condition of conditions) {
    const maximum = (sealedByCondition.get(condition) || 0) + (pendingByCondition.get(condition) || 0);
    if (maximum < spec.minSealedPerCell) {
      reasons.push(`${condition}: at most ${maximum} sealed dialogues remain possible; need ${spec.minSealedPerCell}`);
    }
  }

  const jobsByBlock = new Map();
  for (const job of plan.jobs) {
    const key = blockFor(job);
    const bucket = jobsByBlock.get(key) || [];
    bucket.push(job);
    jobsByBlock.set(key, bucket);
  }
  const completeBlocks = [];
  const possibleBlocks = [];
  for (const [blockKey, jobs] of jobsByBlock) {
    if (jobs.every((job) => statuses.get(job.id) === 'sealed')) completeBlocks.push(blockKey);
    if (jobs.every((job) => statuses.get(job.id) !== 'attrition')) possibleBlocks.push(blockKey);
  }
  if (possibleBlocks.length < spec.minCompleteBlocks) {
    reasons.push(`at most ${possibleBlocks.length} complete blocks remain possible; need ${spec.minCompleteBlocks}`);
  }
  for (const profile of profiles) {
    const maximum = possibleBlocks.filter((key) => key.startsWith(`${profile}:`)).length;
    if (maximum < spec.minCompleteBlocksPerProfile) {
      reasons.push(
        `${profile}: at most ${maximum} complete blocks remain possible; need ${spec.minCompleteBlocksPerProfile}`,
      );
    }
  }

  const currentOppCondition = new Map();
  const currentOppProfileCondition = new Map();
  for (const row of rows) {
    const opportunities = finiteNumber(row?.warrant?.opp, 0);
    const condition = conditionFor(row.job);
    currentOppCondition.set(condition, (currentOppCondition.get(condition) || 0) + opportunities);
    const key = `${row.job.profile}|${condition}`;
    currentOppProfileCondition.set(key, (currentOppProfileCondition.get(key) || 0) + opportunities);
  }
  const unresolvedByCondition = groupCount([...pendingJobs, ...unknownSealedJobs], conditionFor);
  const unresolvedByProfileCondition = groupCount(
    [...pendingJobs, ...unknownSealedJobs],
    (job) => `${job.profile}|${conditionFor(job)}`,
  );
  for (const condition of conditions) {
    const maximum =
      (currentOppCondition.get(condition) || 0) +
      (unresolvedByCondition.get(condition) || 0) * spec.maxOpportunitiesPerDialogue;
    if (maximum < spec.minOpportunitiesPerCell) {
      reasons.push(
        `${condition}: at most ${maximum} opportunities remain possible; need ${spec.minOpportunitiesPerCell}`,
      );
    }
  }
  for (const key of profileConditions) {
    const maximum =
      (currentOppProfileCondition.get(key) || 0) +
      (unresolvedByProfileCondition.get(key) || 0) * spec.maxOpportunitiesPerDialogue;
    if (maximum < spec.minOpportunitiesPerProfileCell) {
      reasons.push(
        `${key}: at most ${maximum} opportunities remain possible; need ${spec.minOpportunitiesPerProfileCell}`,
      );
    }
  }

  const attritionByCondition = groupCount(attritionJobs, conditionFor);
  const pendingAttritionByCondition = groupCount(pendingJobs, conditionFor);
  for (const [left, right] of spec.attritionPairs || []) {
    if (!conditions.includes(left) || !conditions.includes(right)) continue;
    const distance = intervalDistance(
      [
        attritionByCondition.get(left) || 0,
        (attritionByCondition.get(left) || 0) + (pendingAttritionByCondition.get(left) || 0),
      ],
      [
        attritionByCondition.get(right) || 0,
        (attritionByCondition.get(right) || 0) + (pendingAttritionByCondition.get(right) || 0),
      ],
    );
    if (distance > spec.maxAttritionDifference) {
      reasons.push(`${left} vs ${right}: attrition balance can no longer return within ${spec.maxAttritionDifference}`);
    }
  }

  const consumedAttempts = Object.values(launchState.jobs || {}).reduce(
    (sum, entry) => sum + finiteNumber(entry?.attempts, 0),
    0,
  );
  if (consumedAttempts > budget.maxJobs * budget.maxAttemptsPerJob) {
    reasons.push(`attempt budget exceeded: ${consumedAttempts}/${budget.maxJobs * budget.maxAttemptsPerJob}`);
  }

  return {
    schema: PROGRAM2_FUTILITY_SCHEMA,
    checkedAt: new Date().toISOString(),
    pass: reasons.length === 0,
    reasons,
    terminal: { sealed: sealedJobs.length, finalizedAttrition: attritionJobs.length, pending: pendingJobs.length },
    completeBlocks: { observed: completeBlocks.length, maximumReachable: possibleBlocks.length },
    guardrails,
    note: 'Treatment-effect estimates are intentionally absent from this stop rule.',
  };
}

export function createProgram2ProviderBudget({ callLimit, outputTokenLimit } = {}) {
  if (!Number.isSafeInteger(callLimit) || callLimit < 1) {
    throw new Error('Program 2 provider call limit must be a positive integer');
  }
  if (!Number.isSafeInteger(outputTokenLimit) || outputTokenLimit < 1) {
    throw new Error('Program 2 provider output-token limit must be a positive integer');
  }
  let callsReserved = 0;
  let outputTokensReserved = 0;
  return Object.freeze({
    reserve({ maxTokens = 0 } = {}) {
      const requestedOutputTokens = Math.max(0, finiteNumber(maxTokens, 0));
      const nextCalls = callsReserved + 1;
      const nextTokens = outputTokensReserved + requestedOutputTokens;
      if (nextCalls > callLimit || nextTokens > outputTokenLimit) {
        const error = new Error(
          `Program 2 provider budget exhausted before dispatch: calls ${nextCalls}/${callLimit}, ` +
            `reserved output tokens ${nextTokens}/${outputTokenLimit}`,
        );
        error.code = 'PROGRAM2_PROVIDER_BUDGET_EXCEEDED';
        throw error;
      }
      callsReserved = nextCalls;
      outputTokensReserved = nextTokens;
      return Object.freeze({ callsReserved, outputTokensReserved, requestedOutputTokens, callLimit, outputTokenLimit });
    },
    snapshot() {
      return Object.freeze({ callsReserved, outputTokensReserved, callLimit, outputTokenLimit });
    },
  });
}

export function createProgram2ProviderBudgetFromEnvironment(env = process.env) {
  const callLimit = Number(env.PROGRAM2_PROVIDER_CALL_LIMIT_PER_ATTEMPT || 0);
  const outputTokenLimit = Number(env.PROGRAM2_PROVIDER_OUTPUT_TOKEN_LIMIT_PER_ATTEMPT || 0);
  if (!callLimit && !outputTokenLimit) return null;
  return createProgram2ProviderBudget({ callLimit, outputTokenLimit });
}
