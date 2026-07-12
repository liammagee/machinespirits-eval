export const PHASE6_VERDICT_SCHEMA = 'machinespirits.derivation.phase6a-verdict.v2.1';
export const PHASE6_VERDICT_EVALUATOR_VERSION = 'phase6a-verdict-v2.1';

const PLANNER_ARMS = ['field_planner_advisory', 'field_planner_enforce'];
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function mean(values) {
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
}

function rate(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function round(value, digits = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function unique(values) {
  return [...new Set(values)];
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function groupBy(rows, keyOf) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validateNumericRow(row, index) {
  const errors = [];
  const prefix = `rows[${index}]`;
  const requirePositiveInteger = (value, field) => {
    if (!Number.isSafeInteger(value) || value <= 0) errors.push(`${prefix}.${field} must be a positive integer`);
  };
  const requireNonNegativeInteger = (value, field) => {
    if (!isNonNegativeInteger(value)) errors.push(`${prefix}.${field} must be a non-negative integer`);
  };
  const requireNonNegativeFinite = (value, field) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      errors.push(`${prefix}.${field} must be a non-negative finite number`);
    }
  };

  if (row?.ok !== true) errors.push(`${prefix}.ok must be true`);
  if (typeof row?.grounded !== 'boolean') errors.push(`${prefix}.grounded must be boolean`);
  requirePositiveInteger(row?.turnsPlayed, 'turnsPlayed');
  requirePositiveInteger(row?.turnCap, 'turnCap');
  if (Number.isSafeInteger(row?.turnsPlayed) && Number.isSafeInteger(row?.turnCap) && row.turnsPlayed > row.turnCap) {
    errors.push(`${prefix}.turnsPlayed must not exceed turnCap`);
  }

  requireNonNegativeInteger(row?.decay?.events, 'decay.events');
  requireNonNegativeFinite(row?.decay?.degradedTurnIntegral, 'decay.degradedTurnIntegral');

  for (const field of [
    'count',
    'candidateCountMismatches',
    'missingOutcomes',
    'missingSelectedScores',
    'nonLeakAuditFailures',
  ]) {
    requireNonNegativeInteger(row?.fieldPlanner?.[field], `fieldPlanner.${field}`);
  }
  for (const field of ['count', 'nonLeakAuditFailures']) {
    requireNonNegativeInteger(row?.fieldReportContext?.[field], `fieldReportContext.${field}`);
  }
  for (const field of ['loggedTurns', 'complianceChecked', 'complianceFailed', 'enforcementChanged']) {
    requireNonNegativeInteger(row?.conductPolicy?.[field], `conductPolicy.${field}`);
  }
  if (
    isNonNegativeInteger(row?.conductPolicy?.complianceChecked) &&
    isNonNegativeInteger(row?.conductPolicy?.complianceFailed) &&
    row.conductPolicy.complianceFailed > row.conductPolicy.complianceChecked
  ) {
    errors.push(`${prefix}.conductPolicy.complianceFailed must not exceed complianceChecked`);
  }
  if (
    isNonNegativeInteger(row?.conductPolicy?.complianceChecked) &&
    isNonNegativeInteger(row?.conductPolicy?.loggedTurns) &&
    row.conductPolicy.complianceChecked > row.conductPolicy.loggedTurns
  ) {
    errors.push(`${prefix}.conductPolicy.complianceChecked must not exceed loggedTurns`);
  }
  if (
    isNonNegativeInteger(row?.conductPolicy?.enforcementChanged) &&
    isNonNegativeInteger(row?.conductPolicy?.loggedTurns) &&
    row.conductPolicy.enforcementChanged > row.conductPolicy.loggedTurns
  ) {
    errors.push(`${prefix}.conductPolicy.enforcementChanged must not exceed loggedTurns`);
  }

  for (const field of [
    'hardFailures',
    'overreaches',
    'earlyLateReleases',
    'reachableReleases',
    'invalidReleaseClaims',
    'transcriptLeakHits',
  ]) {
    requireNonNegativeInteger(row?.safety?.[field], `safety.${field}`);
  }
  if (
    isNonNegativeInteger(row?.safety?.earlyLateReleases) &&
    isNonNegativeInteger(row?.safety?.reachableReleases) &&
    row.safety.earlyLateReleases > row.safety.reachableReleases
  ) {
    errors.push(`${prefix}.safety.earlyLateReleases must not exceed reachableReleases`);
  }
  if (row?.transcriptLeakAudit?.checked !== true) {
    errors.push(`${prefix}.transcriptLeakAudit.checked must be true`);
  }
  requireNonNegativeInteger(row?.transcriptLeakAudit?.hitCount, 'transcriptLeakAudit.hitCount');
  if (
    isNonNegativeInteger(row?.transcriptLeakAudit?.hitCount) &&
    isNonNegativeInteger(row?.safety?.transcriptLeakHits) &&
    row.transcriptLeakAudit.hitCount !== row.safety.transcriptLeakHits
  ) {
    errors.push(`${prefix}.transcriptLeakAudit.hitCount must equal safety.transcriptLeakHits`);
  }
  return errors;
}

function validateEvidenceMatrix(report, rows, contract) {
  const errors = [];
  const seeds = unique(rows.map((row) => String(row?.seed ?? ''))).sort((a, b) => Number(a) - Number(b));
  const firstSeeds = contract.seedBlocks?.[0] || [];
  const fullSeeds = (contract.seedBlocks || []).flat();
  if (![firstSeeds, fullSeeds].some((expected) => sameJson(seeds, expected))) {
    errors.push(`seed set must be ${firstSeeds.join(',')} or ${fullSeeds.join(',')}; found ${seeds.join(',')}`);
  }

  const expectedKeys = new Set();
  for (const world of contract.worlds || []) {
    for (const seed of seeds) {
      for (const arm of contract.arms || []) expectedKeys.add(`${world}\t${arm}\t${seed}`);
    }
  }
  const seen = new Set();
  rows.forEach((row, index) => {
    const key = `${row?.worldKey}\t${row?.armKey}\t${String(row?.seed ?? '')}`;
    if (!expectedKeys.has(key)) errors.push(`rows[${index}] is outside the frozen world x arm x seed matrix: ${key}`);
    if (seen.has(key)) errors.push(`duplicate frozen matrix cell: ${key}`);
    seen.add(key);
    errors.push(...validateNumericRow(row, index));
  });
  for (const key of expectedKeys) {
    if (!seen.has(key)) errors.push(`missing frozen matrix cell: ${key}`);
  }
  if (rows.length !== expectedKeys.size) {
    errors.push(`expected ${expectedKeys.size} unique rows for the frozen matrix; found ${rows.length}`);
  }

  const usesCombinedEvidence = Array.isArray(report.evidenceRows);
  const reportedCount = usesCombinedEvidence ? report.evidenceRowCount : report.rowCount;
  const reportedOk = usesCombinedEvidence ? report.evidenceOkRows : report.okRows;
  if (reportedCount !== rows.length)
    errors.push(`reported evidence row count ${reportedCount} does not equal ${rows.length}`);
  if (reportedOk !== rows.length)
    errors.push(`reported complete evidence rows ${reportedOk} does not equal ${rows.length}`);
  return { errors: [...new Set(errors)], seeds };
}

function technicalCanaryAudit(report, contract) {
  const rows = Array.isArray(report.rows) ? report.rows : [];
  const expected = new Set();
  for (const world of contract.technicalCanary?.worlds || []) {
    for (const seed of contract.technicalCanary?.seeds || []) {
      for (const arm of contract.technicalCanary?.arms || []) expected.add(`${world}\t${arm}\t${seed}`);
    }
  }
  const errors = [];
  const seen = new Set();
  rows.forEach((row, index) => {
    const key = `${row?.worldKey}\t${row?.armKey}\t${String(row?.seed ?? '')}`;
    if (!expected.has(key)) errors.push(`rows[${index}] is outside the technical-canary matrix: ${key}`);
    if (seen.has(key)) errors.push(`duplicate technical-canary cell: ${key}`);
    seen.add(key);
    errors.push(...validateNumericRow(row, index));
    if (row?.safety?.hardFailures !== 0) errors.push(`rows[${index}].safety.hardFailures must be zero`);
    if (row?.transcriptLeakAudit?.hitCount !== 0) {
      errors.push(`rows[${index}].transcriptLeakAudit.hitCount must be zero`);
    }
    if (row?.fieldPlanner?.nonLeakAuditFailures !== 0 || row?.fieldReportContext?.nonLeakAuditFailures !== 0) {
      errors.push(`rows[${index}] contains a field non-leak audit failure`);
    }
  });
  for (const key of expected) {
    if (!seen.has(key)) errors.push(`missing technical-canary cell: ${key}`);
  }
  if (rows.length !== expected.size) errors.push(`technical canary requires exactly ${expected.size} rows`);
  if (report.rowCount !== rows.length || report.okRows !== rows.length) {
    errors.push('technical-canary report counts must show every planned row complete');
  }

  const byArm = groupBy(rows, (row) => row.armKey);
  const baseline = byArm.get('baseline') || [];
  const reportOnly = byArm.get('field_report_only') || [];
  const baselineTraceClean =
    baseline.length === 1 &&
    baseline.every((row) => row?.fieldPlanner?.count === 0 && row?.fieldReportContext?.count === 0);
  const reportOnlyCoverage =
    reportOnly.length === 1 &&
    reportOnly.every((row) => row?.fieldPlanner?.count === 0 && row?.fieldReportContext?.count === row?.turnsPlayed);
  if (!baselineTraceClean) errors.push('technical-canary baseline trace must contain no field/report instrumentation');
  if (!reportOnlyCoverage) errors.push('technical-canary report-only trace must cover every tutor turn');

  const planners = {};
  for (const arm of PLANNER_ARMS) {
    const armRows = byArm.get(arm) || [];
    const row = armRows[0];
    const pass =
      armRows.length === 1 &&
      row?.fieldPlanner?.count === row?.turnsPlayed &&
      row?.fieldPlanner?.candidateCountMismatches === 0 &&
      row?.fieldPlanner?.missingOutcomes === 0 &&
      row?.fieldPlanner?.missingSelectedScores === 0 &&
      row?.conductPolicy?.loggedTurns === row?.turnsPlayed &&
      row?.conductPolicy?.complianceChecked === row?.turnsPlayed;
    planners[arm] = { pass, rowCount: armRows.length };
    if (!pass) errors.push(`technical-canary ${arm} trace/audit coverage is incomplete`);
  }
  return {
    pass: errors.length === 0,
    errors: [...new Set(errors)],
    expectedRows: expected.size,
    observedRows: rows.length,
    baselineTraceClean,
    reportOnlyCoverage,
    planners,
  };
}

function fixedTurnCost(row) {
  return row.grounded === true ? row.turnsPlayed : row.turnCap + 1;
}

function summarizeArm(rows, worlds) {
  const byWorld = groupBy(rows, (row) => row.worldKey);
  const perWorld = {};
  for (const world of worlds) {
    const worldRows = byWorld.get(world) || [];
    const grounded = worldRows.filter((row) => row.grounded === true).length;
    perWorld[world] = {
      n: worldRows.length,
      grounded,
      groundedRate: round(rate(grounded, worldRows.length)),
      fixedTurnCost: round(mean(worldRows.map(fixedTurnCost))),
      decayEvents: worldRows.reduce((sum, row) => sum + row.decay.events, 0),
      degradedTurnIntegral: worldRows.reduce((sum, row) => sum + row.decay.degradedTurnIntegral, 0),
    };
  }
  const grounded = rows.filter((row) => row.grounded === true).length;
  const hardSafetyFailures = rows.reduce((sum, row) => sum + row.safety.hardFailures, 0);
  const overreaches = rows.reduce((sum, row) => sum + row.safety.overreaches, 0);
  const earlyLateReleases = rows.reduce((sum, row) => sum + row.safety.earlyLateReleases, 0);
  const reachableReleases = rows.reduce((sum, row) => sum + row.safety.reachableReleases, 0);
  return {
    n: rows.length,
    grounded,
    groundedRate: round(rate(grounded, rows.length)),
    macroFixedTurnCost: round(mean(worlds.map((world) => perWorld[world].fixedTurnCost))),
    perWorld,
    safety: {
      hardFailures: hardSafetyFailures,
      overreachRate: round(rate(overreaches, rows.length)),
      earlyLateReleaseRate: round(rate(earlyLateReleases, reachableReleases)),
    },
  };
}

function summarizeArms(rows, contract) {
  const grouped = groupBy(rows, (row) => row.armKey);
  return Object.fromEntries(contract.arms.map((arm) => [arm, summarizeArm(grouped.get(arm) || [], contract.worlds)]));
}

function comparison(candidate, comparator, thresholds) {
  const completionDelta = candidate.groundedRate - comparator.groundedRate;
  const efficiencyDelta = comparator.macroFixedTurnCost - candidate.macroFixedTurnCost;
  const completionLift = completionDelta + Number.EPSILON >= thresholds.completionLift;
  const efficiencyLift = completionDelta >= 0 && efficiencyDelta + Number.EPSILON >= thresholds.efficiencyLiftTurns;
  const negativeTransfer = Object.keys(comparator.perWorld).some((world) => {
    const candidateWorld = candidate.perWorld[world];
    const comparatorWorld = comparator.perWorld[world];
    return (
      candidateWorld.groundedRate <
        comparatorWorld.groundedRate - thresholds.worldCompletionLossMargin - Number.EPSILON ||
      candidateWorld.fixedTurnCost >
        comparatorWorld.fixedTurnCost + thresholds.worldEfficiencyLossTurns + Number.EPSILON
    );
  });
  return {
    completionDelta: round(completionDelta),
    efficiencyDeltaTurns: round(efficiencyDelta),
    completionLift,
    efficiencyLift,
    negativeTransfer,
    material: (completionLift || efficiencyLift) && !negativeTransfer,
  };
}

function safetyComparison(candidate, baseline, thresholds) {
  const hardPass = candidate.safety.hardFailures === 0;
  const overreachPass = candidate.safety.overreachRate <= baseline.safety.overreachRate + Number.EPSILON;
  const releasePass =
    candidate.safety.earlyLateReleaseRate <=
    baseline.safety.earlyLateReleaseRate + thresholds.releaseDeviationRateMargin + Number.EPSILON;
  return {
    pass: hardPass && overreachPass && releasePass,
    hardPass,
    overreachPass,
    releasePass,
  };
}

function plannerInstrumentation(rows, arm, thresholds) {
  const armRows = rows.filter((row) => row.armKey === arm);
  const exactTurnCoverage = armRows.every((row) => row.fieldPlanner.count === row.turnsPlayed);
  const loggedTurnCoverage = armRows.every((row) => row.conductPolicy.loggedTurns === row.turnsPlayed);
  const candidatesComplete = armRows.every((row) => row.fieldPlanner.candidateCountMismatches === 0);
  const outcomesComplete = armRows.every((row) => row.fieldPlanner.missingOutcomes === 0);
  const scoresComplete = armRows.every((row) => row.fieldPlanner.missingSelectedScores === 0);
  const complianceChecked = armRows.reduce((sum, row) => sum + row.conductPolicy.complianceChecked, 0);
  const complianceFailed = armRows.reduce((sum, row) => sum + row.conductPolicy.complianceFailed, 0);
  const plannerTurns = armRows.reduce((sum, row) => sum + row.fieldPlanner.count, 0);
  const enforcementChanged = armRows.reduce((sum, row) => sum + row.conductPolicy.enforcementChanged, 0);
  const compliancePassed = complianceChecked - complianceFailed;
  const complianceRate = rate(compliancePassed, complianceChecked);
  const requiredComplianceRate = arm === 'field_planner_enforce' ? 1 : finite(thresholds.advisoryMinComplianceRate, 1);
  const compliancePass = complianceChecked > 0 && complianceRate + Number.EPSILON >= requiredComplianceRate;
  const pass =
    armRows.length > 0 &&
    exactTurnCoverage &&
    loggedTurnCoverage &&
    candidatesComplete &&
    outcomesComplete &&
    scoresComplete &&
    complianceChecked === plannerTurns &&
    compliancePass &&
    (arm !== 'field_planner_enforce' || enforcementChanged > 0);
  return {
    pass,
    exactTurnCoverage,
    loggedTurnCoverage,
    candidatesComplete,
    outcomesComplete,
    scoresComplete,
    complianceChecked,
    complianceFailed,
    compliancePassed,
    complianceRate: round(complianceRate),
    requiredComplianceRate,
    plannerTurns,
    enforcementChanged,
    requiredCandidateCount: thresholds.requiredCandidateCount,
  };
}

function instrumentationAudit(rows, contract) {
  const baselineRows = rows.filter((row) => row.armKey === 'baseline');
  const reportRows = rows.filter((row) => row.armKey === 'field_report_only');
  const baselineClean = baselineRows.every((row) => row.fieldPlanner.count === 0 && row.fieldReportContext.count === 0);
  const reportCoverage =
    reportRows.length > 0 && reportRows.every((row) => row.fieldReportContext.count === row.turnsPlayed);
  const planners = Object.fromEntries(
    PLANNER_ARMS.map((arm) => [arm, plannerInstrumentation(rows, arm, contract.thresholds)]),
  );
  return {
    pass: baselineClean && reportCoverage && PLANNER_ARMS.some((arm) => planners[arm].pass),
    baselineClean,
    reportCoverage,
    planners,
  };
}

function manipulationAudit(arms, contract) {
  const baseline = arms.baseline;
  const worlds = Object.fromEntries(
    contract.worlds.map((world) => {
      const summary = baseline.perWorld[world];
      return [
        world,
        {
          decayEvents: summary.decayEvents,
          degradedTurnIntegral: summary.degradedTurnIntegral,
          pass: summary.decayEvents > 0 && summary.degradedTurnIntegral > 0,
        },
      ];
    }),
  );
  return { pass: Object.values(worlds).every((world) => world.pass), worlds };
}

function placeboMatches(candidate, placebo, thresholds) {
  return (
    Math.abs(candidate.groundedRate - placebo.groundedRate) < thresholds.placeboCompletionMatch &&
    Math.abs(candidate.macroFixedTurnCost - placebo.macroFixedTurnCost) < thresholds.placeboEfficiencyMatchTurns
  );
}

function evaluateBlock(rows, contract) {
  const arms = summarizeArms(rows, contract);
  const baseline = arms.baseline;
  const placebo = arms.field_report_only;
  const placeboSafety = safetyComparison(placebo, baseline, contract.thresholds);
  const planner = {};
  for (const arm of PLANNER_ARMS) {
    planner[arm] = {
      againstBaseline: comparison(arms[arm], baseline, contract.thresholds),
      againstPlacebo: comparison(arms[arm], placebo, contract.thresholds),
      safety: safetyComparison(arms[arm], baseline, contract.thresholds),
      placeboMatch: placeboMatches(arms[arm], placebo, contract.thresholds),
    };
    planner[arm].qualifies =
      placeboSafety.pass &&
      planner[arm].againstBaseline.material &&
      planner[arm].againstPlacebo.material &&
      planner[arm].safety.pass;
  }
  return {
    arms,
    baselineSafetyPass: baseline.safety.hardFailures === 0,
    placeboSafety,
    placeboAgainstBaseline: comparison(placebo, baseline, contract.thresholds),
    planner,
  };
}

function rankPlannerArms(block, instrumentation) {
  return [...PLANNER_ARMS]
    .sort((left, right) => {
      const a = block.arms[left];
      const b = block.arms[right];
      return (
        b.groundedRate - a.groundedRate ||
        a.macroFixedTurnCost - b.macroFixedTurnCost ||
        a.safety.earlyLateReleaseRate - b.safety.earlyLateReleaseRate ||
        (left === 'field_planner_advisory' ? -1 : 1)
      );
    })
    .filter((arm) => instrumentation.planners[arm].pass);
}

function result(verdict, reason, details) {
  return {
    schema: PHASE6_VERDICT_SCHEMA,
    evaluatorVersion: PHASE6_VERDICT_EVALUATOR_VERSION,
    verdict,
    reason,
    ...details,
  };
}

function validReplicationParent(prior, contract) {
  const expectedRows = contract.worlds.length * contract.arms.length * contract.seedBlocks[0].length;
  return (
    typeof prior?.parentRunId === 'string' &&
    prior.parentRunId.trim().length > 0 &&
    prior?.verdict === 'provisional_promote' &&
    PLANNER_ARMS.includes(prior?.winner) &&
    sameJson(prior?.seeds, contract.seedBlocks[0]) &&
    prior?.verdictEvaluatorVersion === contract.verdictEvaluatorVersion &&
    SHA256_PATTERN.test(String(prior?.reportSha256 || '')) &&
    SHA256_PATTERN.test(String(prior?.sealSha256 || '')) &&
    prior?.rowCount === expectedRows &&
    SHA256_PATTERN.test(String(prior?.rowsSha256 || '')) &&
    SHA256_PATTERN.test(String(prior?.decisionContractSha256 || '')) &&
    SHA256_PATTERN.test(String(prior?.verdictEvaluatorSha256 || ''))
  );
}

export function evaluatePhase6Verdict(report = {}, contract = {}) {
  if (report.mode !== 'real') {
    return result('mock_plumbing_only', 'Mock and dry runs do not license a Phase 6A outcome verdict.', {});
  }
  if (report.evidenceKind === 'technical_canary') {
    const audit = technicalCanaryAudit(report, contract);
    if (!audit.pass) {
      return result('technical_canary_failed', 'The excluded route canary did not pass its technical contract.', {
        claimStatus: 'excluded',
        passed: false,
        audit,
      });
    }
    return result('technical_canary_only', 'The bounded real route canary is excluded from both evidence blocks.', {
      claimStatus: 'excluded',
      passed: true,
      audit,
    });
  }

  const rows = Array.isArray(report.evidenceRows) ? report.evidenceRows : Array.isArray(report.rows) ? report.rows : [];
  if (!rows.length) return result('incomplete', 'Expected real rows are missing.', {});
  const validation = validateEvidenceMatrix(report, rows, contract);
  if (validation.errors.length) {
    return result('incomplete', 'The frozen evidence matrix or required numeric row schema is incomplete.', {
      seeds: validation.seeds,
      validationErrors: validation.errors,
    });
  }

  const seeds = validation.seeds;
  const pooled = evaluateBlock(rows, contract);
  const instrumentation = instrumentationAudit(rows, contract);
  const manipulation = manipulationAudit(pooled.arms, contract);
  if (!instrumentation.pass || !manipulation.pass || !pooled.baselineSafetyPass || !pooled.placeboSafety.pass) {
    return result(
      'null_invalid_instrumentation',
      'Instrumentation, manipulation, baseline safety, or report-only comparator safety did not pass.',
      {
        seeds,
        instrumentation,
        manipulation,
        pooled,
      },
    );
  }

  const ranked = rankPlannerArms(pooled, instrumentation);
  const firstBlockSeeds = contract.seedBlocks[0];
  const secondBlockSeeds = contract.seedBlocks[1];
  const rowsForSeeds = (blockSeeds) => rows.filter((row) => blockSeeds.includes(String(row.seed)));
  if (sameJson(seeds, contract.seedBlocks.flat())) {
    if (!validReplicationParent(report.priorProvisional, contract)) {
      return result('null_invalid_instrumentation', 'The pooled k=10 result lacks a compatible sealed k=5 parent.', {
        seeds,
        instrumentation,
        manipulation,
        pooled,
      });
    }
    const firstRows = rowsForSeeds(firstBlockSeeds);
    const secondRows = rowsForSeeds(secondBlockSeeds);
    const first = evaluateBlock(firstRows, contract);
    const second = evaluateBlock(secondRows, contract);
    const firstInstrumentation = instrumentationAudit(firstRows, contract);
    const secondInstrumentation = instrumentationAudit(secondRows, contract);
    const firstManipulation = manipulationAudit(first.arms, contract);
    const secondManipulation = manipulationAudit(second.arms, contract);
    if (!firstManipulation.pass || !secondManipulation.pass) {
      return result(
        'null_invalid_instrumentation',
        'The decay manipulation was not reached in both five-seed blocks.',
        {
          seeds,
          instrumentation,
          manipulation,
          pooled,
          replicationBlocks: {
            first,
            second,
            firstInstrumentation,
            secondInstrumentation,
            firstManipulation,
            secondManipulation,
          },
        },
      );
    }
    const parentWinner = report.priorProvisional.winner;
    const pooledWinner = ranked.find((arm) => pooled.planner[arm].qualifies) || null;
    const firstWinner =
      rankPlannerArms(first, firstInstrumentation).find((arm) => first.planner[arm].qualifies) || null;
    const secondWinner =
      rankPlannerArms(second, secondInstrumentation).find((arm) => second.planner[arm].qualifies) || null;
    const sameWinnerPasses =
      pooledWinner === parentWinner &&
      firstWinner === parentWinner &&
      secondWinner === parentWinner &&
      pooled.planner[parentWinner].qualifies &&
      first.planner[parentWinner].qualifies &&
      second.planner[parentWinner].qualifies;
    if (sameWinnerPasses) {
      return result('promote_local', 'The sealed parent winner passed both five-seed blocks and pooled k=10.', {
        winner: parentWinner,
        seeds,
        instrumentation,
        manipulation,
        pooled,
        replicationBlocks: {
          first,
          second,
          firstWinner,
          secondWinner,
          firstInstrumentation,
          secondInstrumentation,
          firstManipulation,
          secondManipulation,
        },
      });
    }
  } else {
    const winner = ranked.find((arm) => pooled.planner[arm].qualifies);
    if (winner) {
      return result('provisional_promote', 'A planner arm passed the frozen k=5 feasibility gate.', {
        winner,
        seeds,
        instrumentation,
        manipulation,
        pooled,
      });
    }
  }

  const unsafeImprover = PLANNER_ARMS.find(
    (arm) =>
      instrumentation.planners[arm].pass &&
      pooled.planner[arm].againstBaseline.material &&
      !pooled.planner[arm].safety.pass,
  );
  if (unsafeImprover) {
    return result('negative_control', 'Outcome improvement was accompanied by a frozen safety-gate failure.', {
      winner: unsafeImprover,
      seeds,
      instrumentation,
      manipulation,
      pooled,
    });
  }

  const placeboImproves = pooled.placeboAgainstBaseline.material && pooled.placeboSafety.pass;
  const plannerIncrementAbsent = ranked.every(
    (arm) => !pooled.planner[arm].againstPlacebo.material || pooled.planner[arm].placeboMatch,
  );
  if (placeboImproves && plannerIncrementAbsent) {
    return result('instrumentation_effect', 'Report-only context reproduced the gain without planner control.', {
      seeds,
      instrumentation,
      manipulation,
      pooled,
    });
  }

  const baselineAtCeiling = contract.worlds.every((world) => pooled.arms.baseline.perWorld[world].groundedRate === 1);
  const plannerEfficiencyAbsent = ranked.every(
    (arm) =>
      pooled.arms.baseline.macroFixedTurnCost - pooled.arms[arm].macroFixedTurnCost <
      contract.thresholds.efficiencyLiftTurns,
  );
  if (baselineAtCeiling && plannerEfficiencyAbsent) {
    return result('ceiling', 'Baseline grounded every world and no safe planner cleared the efficiency margin.', {
      seeds,
      instrumentation,
      manipulation,
      pooled,
    });
  }

  return result('null', 'The valid frozen gate produced no promotable, placebo, negative-control, or ceiling result.', {
    seeds,
    instrumentation,
    manipulation,
    pooled,
  });
}
