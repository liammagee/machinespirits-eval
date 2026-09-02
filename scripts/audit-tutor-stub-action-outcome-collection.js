#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { buildActionOutcomeMemoryReadiness } from './action-outcome-memory-readiness.js';
import { loadTutorStubActionOutcomeCollectionDesign } from '../services/tutorStubActionOutcomeCollectionPilot.js';

const ALL_OBSERVED_CONDITION = {
  id: 'audit_all_observed',
  stagnationAtLeast: 0,
  fieldVelocityAtMost: Number.MAX_SAFE_INTEGER,
  dagVelocityAtMost: Number.MAX_SAFE_INTEGER,
};
const BINARY_OUTCOMES = new Set(['success', 'failure']);
const HUMAN_CONSENSUS_AUXILIARY_VETO_V2 = 'human_consensus_auxiliary_veto_v2';

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function unique(values) {
  return [...new Set(values)].sort();
}

function sourceWorld(source) {
  return source?.metadata?.world?.id || source?.metadata?.world || null;
}

function jobIdFromSource(sourcePath) {
  const normalized = String(sourcePath || '')
    .split(path.sep)
    .join('/');
  return normalized.match(/\/jobs\/([^/]+)\/traces\//u)?.[1] || null;
}

function enrichRows(readiness) {
  const sources = new Map(readiness.sources.map((source) => [source.path, source]));
  return readiness.evidenceRows.map((row) => {
    const source = sources.get(row.source);
    return {
      ...row,
      runId: source?.runId || null,
      worldId: sourceWorld(source),
      family: row.prospectiveAssignment?.selected_move_family || null,
      eligibleSet: unique((row.prospectiveAssignment?.eligible_move_families || []).map((entry) => entry.family)),
    };
  });
}

function conditionDisposition(observation, conditions) {
  const quantities = observation?.quantities;
  if (
    observation?.observed !== true ||
    !Number.isFinite(quantities?.stagnation) ||
    !Number.isFinite(quantities?.fieldVelocity) ||
    !Number.isFinite(quantities?.dagVelocity)
  ) {
    return 'malformed';
  }
  const matches = conditions.filter(
    (condition) =>
      quantities.stagnation >= condition.stagnationAtLeast &&
      Math.abs(quantities.fieldVelocity) <= condition.fieldVelocityAtMost &&
      Math.abs(quantities.dagVelocity) <= condition.dagVelocityAtMost,
  );
  if (matches.length > 1) return 'overlapping';
  return matches.length === 1 ? 'matched' : 'unmatched';
}

export function readCollectionDecisionInventory(sources, conditions) {
  const rows = [];
  for (const source of sources) {
    const lines = fs.readFileSync(source.path, 'utf8').split(/\r?\n/u);
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      if (event.type !== 'tutor_typed_action_decision') continue;
      const assignment = event.decision?.decision_provenance?.prospective_assignment;
      rows.push({
        runId: source.runId,
        jobId: jobIdFromSource(source.path),
        worldId: sourceWorld(source),
        contractId: event.decision?.contract_id || null,
        turn: event.turn,
        assignmentStatus: assignment?.disposition || 'not_recorded',
        selectedFamily: assignment?.selected_move_family || null,
        conditionDisposition: conditionDisposition(event.decision?.decision_provenance?.memory_observation, conditions),
      });
    }
  }
  return rows.sort(
    (left, right) =>
      String(left.jobId).localeCompare(String(right.jobId)) || Number(left.turn || 0) - Number(right.turn || 0),
  );
}

export function wilsonInterval(successes, total, z = 1.959963984540054) {
  if (!Number.isInteger(successes) || !Number.isInteger(total) || successes < 0 || total <= 0 || successes > total) {
    return null;
  }
  const estimate = successes / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = (estimate + z2 / (2 * total)) / denominator;
  const margin = (z * Math.sqrt((estimate * (1 - estimate)) / total + z2 / (4 * total * total))) / denominator;
  return {
    successes,
    total,
    estimate,
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}

function familySummary(rows, families) {
  return families.map((family) => {
    const selected = rows.filter((row) => row.family === family);
    return {
      family,
      cases: selected.length,
      visibleDeliveries: selected.filter((row) => row.auxiliaryDeliveryVisible === true).length,
      dialogues: unique(selected.map((row) => row.runId).filter(Boolean)).length,
      worlds: unique(selected.map((row) => row.worldId).filter(Boolean)).length,
      auxiliaryOutcomes: countBy(selected.map((row) => row.recordedOutcome || 'missing')),
    };
  });
}

function eligibleSetSummary(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.eligibleSet.join('+') || 'none';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([eligibleSet, members]) => ({
      eligibleSet,
      cases: members.length,
      assignments: countBy(members.map((row) => row.family || 'none')),
      worlds: unique(members.map((row) => row.worldId).filter(Boolean)),
    }));
}

function gate(section, id, expected, observed, status, note) {
  return { section, id, expected, observed, status, note };
}

function minimum(values) {
  return values.length ? Math.min(...values) : 0;
}

function sameMembers(left, right) {
  return JSON.stringify(unique(left)) === JSON.stringify(unique(right));
}

function comparativeMoveFamilies(design) {
  const registered = design.comparability?.moveFamilies;
  return Array.isArray(registered) && registered.length ? registered : design.typedActionAssignment.moveFamilies;
}

export function buildTutorStubActionOutcomeCollectionAudit({
  design,
  generationReport,
  registeredReadiness,
  allObservedReadiness,
  decisionInventory,
  asOf,
}) {
  if (generationReport.study_id !== design.studyId) throw new Error('generation report study identity mismatch');
  if (generationReport.memory_controller_enabled !== false)
    throw new Error('collection report enabled memory controller');
  if (registeredReadiness.modelCalls !== 0 || allObservedReadiness.modelCalls !== 0) {
    throw new Error('readiness audit must remain zero-call');
  }
  const expectedJobs = design.randomization.jobs;
  const expectedJobIds = expectedJobs.map((job) => job.jobId);
  const observedJobIds = generationReport.rows.map((row) => row.job_id);
  const duplicateJobs = observedJobIds.filter((jobId, index) => observedJobIds.indexOf(jobId) !== index);
  const unregisteredJobs = observedJobIds.filter((jobId) => !expectedJobIds.includes(jobId));
  const missingJobs = expectedJobIds.filter((jobId) => !observedJobIds.includes(jobId));
  const completeRows = generationReport.rows.filter((row) => row.status === 'complete');
  const technicalRows = generationReport.rows.filter((row) => row.status === 'technical_failure');
  const unbalancedJobs = generationReport.rows
    .filter((row) => row.model_attempts?.accounting_balanced !== true)
    .map((row) => row.job_id)
    .sort();
  const perWorldExecution = design.population.collectionWorlds.map((worldId) => {
    const rows = generationReport.rows.filter((row) => row.world_id === worldId);
    return {
      worldId,
      planned: expectedJobs.filter((job) => job.worldId === worldId).length,
      complete: rows.filter((row) => row.status === 'complete').length,
      technicalFailure: rows.filter((row) => row.status === 'technical_failure').length,
    };
  });
  const registeredRows = enrichRows(registeredReadiness);
  const allClosedRows = enrichRows(allObservedReadiness);
  const families = comparativeMoveFamilies(design);
  const matchedFamilies = familySummary(registeredRows, families);
  const allClosedFamilies = familySummary(
    allClosedRows.filter((row) => row.assignmentStatus === 'seeded_uniform_family_assignment'),
    families,
  );
  const matchedDialogues = unique(registeredRows.map((row) => row.runId).filter(Boolean));
  const matchedWorlds = unique(registeredRows.map((row) => row.worldId).filter(Boolean));
  const visibleDeliveries = registeredRows.filter((row) => row.auxiliaryDeliveryVisible === true).length;
  const closedOpportunities = allObservedReadiness.summary.closedOutcomes;
  const matchedAssignments = registeredRows.length;
  const unmatchedAssignments = registeredReadiness.exclusionCounts.no_declared_condition_matched || 0;
  const terminalWithoutNextObservation = registeredReadiness.exclusionCounts.non_unique_required_join || 0;
  const seededClosed = allClosedRows.filter(
    (row) => row.assignmentStatus === 'seeded_uniform_family_assignment',
  ).length;
  const matchedOutcomeCounts = countBy(registeredRows.map((row) => row.recordedOutcome || 'missing'));
  const auxiliaryVetoPolicy = design.humanReview?.measurementPolicy === HUMAN_CONSENSUS_AUXILIARY_VETO_V2;
  const canBecomeBinary = (row) =>
    row.auxiliaryDeliveryVisible === true && (auxiliaryVetoPolicy || BINARY_OUTCOMES.has(row.recordedOutcome));
  const maximumPotentialBinaryRecords = registeredRows.filter(canBecomeBinary).length;
  const maximumPotentialBinaryByFamily = Object.fromEntries(
    families.map((family) => [
      family,
      registeredRows.filter((row) => row.family === family && canBecomeBinary(row)).length,
    ]),
  );
  const registered = design.feasibilityEndpoints.authoritativeGates;
  const coverageGates = registered.exchangeabilityAndCoverage;
  const everyFamilyGateId = Object.hasOwn(coverageGates, 'everyComparativeMoveFamilyAssignedAndDelivered')
    ? 'everyComparativeMoveFamilyAssignedAndDelivered'
    : 'everyMoveFamilyAssignedAndDelivered';
  const minimumDeliveredGateId = Object.hasOwn(coverageGates, 'minimumDeliveredCasesPerComparativeMoveFamily')
    ? 'minimumDeliveredCasesPerComparativeMoveFamily'
    : 'minimumDeliveredCasesPerMoveFamily';
  const minimumDialoguesGateId = Object.hasOwn(coverageGates, 'minimumIndependentDialoguesPerComparativeMoveFamily')
    ? 'minimumIndependentDialoguesPerComparativeMoveFamily'
    : 'minimumIndependentDialoguesPerMoveFamily';
  const minimumWorldsGateId = Object.hasOwn(coverageGates, 'minimumCollectionWorldsPerComparativeMoveFamily')
    ? 'minimumCollectionWorldsPerComparativeMoveFamily'
    : 'minimumCollectionWorldsPerMoveFamily';
  const reviewGates = registered.review;
  const minimumBinaryPerFamilyGateId = Object.hasOwn(
    reviewGates,
    'minimumFinalUsableBinaryRecordsPerComparativeMoveFamily',
  )
    ? 'minimumFinalUsableBinaryRecordsPerComparativeMoveFamily'
    : 'minimumFinalUsableBinaryRecordsPerMoveFamily';
  const familyDeliveries = matchedFamilies.map((row) => row.visibleDeliveries);
  const familyDialogues = matchedFamilies.map((row) => row.dialogues);
  const familyWorlds = matchedFamilies.map((row) => row.worlds);
  const visibleDeliveryRate = matchedAssignments ? visibleDeliveries / matchedAssignments : 0;
  const gates = [
    gate(
      'execution',
      'minimumCompleteDialogues',
      registered.execution.minimumCompleteDialogues,
      completeRows.length,
      completeRows.length >= registered.execution.minimumCompleteDialogues ? 'pass' : 'fail',
      `${technicalRows.length} technical failures remain preserved.`,
    ),
    gate(
      'execution',
      'minimumCompleteDialoguesPerCollectionWorld',
      registered.execution.minimumCompleteDialoguesPerCollectionWorld,
      Object.fromEntries(perWorldExecution.map((row) => [row.worldId, row.complete])),
      perWorldExecution.every((row) => row.complete >= registered.execution.minimumCompleteDialoguesPerCollectionWorld)
        ? 'pass'
        : 'fail',
      'Evaluated on the four registered collection worlds.',
    ),
    gate(
      'execution',
      'allAttemptAccountingBalances',
      true,
      { balanced: unbalancedJobs.length === 0, unbalancedJobs },
      unbalancedJobs.length === 0 ? 'pass' : 'fail',
      unbalancedJobs.length
        ? `${unbalancedJobs.length} preserved unit(s) have unresolved child-attempt accounting.`
        : 'Every unit balances reserved attempts against completed and failed attempts.',
    ),
    gate(
      'execution',
      'noUnregisteredOrDuplicateJob',
      true,
      { unregisteredJobs, duplicateJobs, missingJobs },
      !unregisteredJobs.length && !duplicateJobs.length && !missingJobs.length ? 'pass' : 'fail',
      `Compared with the ${expectedJobs.length} registered job identities.`,
    ),
    gate(
      'exchangeabilityAndCoverage',
      'minimumConditionMatchedSeededClosedAssignments',
      registered.exchangeabilityAndCoverage.minimumConditionMatchedSeededClosedAssignments,
      matchedAssignments,
      matchedAssignments >= registered.exchangeabilityAndCoverage.minimumConditionMatchedSeededClosedAssignments
        ? 'pass'
        : 'fail',
      `${unmatchedAssignments} closed decisions did not match the registered condition.`,
    ),
    gate(
      'exchangeabilityAndCoverage',
      'minimumContributingDialogues',
      registered.exchangeabilityAndCoverage.minimumContributingDialogues,
      matchedDialogues.length,
      matchedDialogues.length >= registered.exchangeabilityAndCoverage.minimumContributingDialogues ? 'pass' : 'fail',
      'A dialogue contributes when at least one seeded closed assignment matches the condition.',
    ),
    gate(
      'exchangeabilityAndCoverage',
      'minimumContributingCollectionWorlds',
      registered.exchangeabilityAndCoverage.minimumContributingCollectionWorlds,
      matchedWorlds.length,
      matchedWorlds.length >= registered.exchangeabilityAndCoverage.minimumContributingCollectionWorlds
        ? 'pass'
        : 'fail',
      'World identities remain separate.',
    ),
    gate(
      'exchangeabilityAndCoverage',
      everyFamilyGateId,
      coverageGates[everyFamilyGateId],
      Object.fromEntries(matchedFamilies.map((row) => [row.family, row.visibleDeliveries])),
      matchedFamilies.every((row) => row.visibleDeliveries > 0) ? 'pass' : 'fail',
      'Only condition-matched, seeded, visibly delivered cases count.',
    ),
    gate(
      'exchangeabilityAndCoverage',
      minimumDeliveredGateId,
      coverageGates[minimumDeliveredGateId],
      Object.fromEntries(matchedFamilies.map((row) => [row.family, row.visibleDeliveries])),
      minimum(familyDeliveries) >= coverageGates[minimumDeliveredGateId] ? 'pass' : 'fail',
      `Minimum observed visible family yield: ${minimum(familyDeliveries)}.`,
    ),
    gate(
      'exchangeabilityAndCoverage',
      minimumDialoguesGateId,
      coverageGates[minimumDialoguesGateId],
      Object.fromEntries(matchedFamilies.map((row) => [row.family, row.dialogues])),
      minimum(familyDialogues) >= coverageGates[minimumDialoguesGateId] ? 'pass' : 'fail',
      `Minimum observed dialogue support: ${minimum(familyDialogues)}.`,
    ),
    gate(
      'exchangeabilityAndCoverage',
      minimumWorldsGateId,
      coverageGates[minimumWorldsGateId],
      Object.fromEntries(matchedFamilies.map((row) => [row.family, row.worlds])),
      minimum(familyWorlds) >= coverageGates[minimumWorldsGateId] ? 'pass' : 'fail',
      `Minimum observed world support: ${minimum(familyWorlds)}.`,
    ),
    gate(
      'exchangeabilityAndCoverage',
      'minimumVisibleDeliveryRateAmongConditionMatchedAssignments',
      registered.exchangeabilityAndCoverage.minimumVisibleDeliveryRateAmongConditionMatchedAssignments,
      visibleDeliveryRate,
      visibleDeliveryRate >=
        registered.exchangeabilityAndCoverage.minimumVisibleDeliveryRateAmongConditionMatchedAssignments
        ? 'pass'
        : 'fail',
      `${visibleDeliveries}/${matchedAssignments} condition-matched assignments were visibly delivered.`,
    ),
    gate(
      'review',
      'bothOriginalCoderSubmissionsComplete',
      true,
      null,
      'pending',
      'The zero-call extraction does not perform human coding.',
    ),
    gate(
      'review',
      'minimumJointDeliveryAndOutcomeExactAgreement',
      registered.review.minimumJointDeliveryAndOutcomeExactAgreement,
      null,
      'pending',
      'No coder submissions exist.',
    ),
    gate(
      'review',
      'maximumMeasurementIndeterminateRate',
      registered.review.maximumMeasurementIndeterminateRate,
      null,
      'pending',
      'No coder comparison exists.',
    ),
    gate(
      'review',
      'minimumFinalUsableBinaryRecords',
      registered.review.minimumFinalUsableBinaryRecords,
      { current: 0, maximumPossibleFromFrozenAuxiliaryOutcomes: maximumPotentialBinaryRecords },
      maximumPotentialBinaryRecords >= registered.review.minimumFinalUsableBinaryRecords ? 'pending' : 'fail',
      auxiliaryVetoPolicy
        ? 'Human consensus supplies the semantic label; an opposite binary auxiliary result or invisible delivery can veto it.'
        : 'Binary admission requires human consensus to agree with a saved binary auxiliary outcome.',
    ),
    gate(
      'review',
      minimumBinaryPerFamilyGateId,
      reviewGates[minimumBinaryPerFamilyGateId],
      {
        current: Object.fromEntries(families.map((family) => [family, 0])),
        maximumPossible: maximumPotentialBinaryByFamily,
      },
      minimum(Object.values(maximumPotentialBinaryByFamily)) >= reviewGates[minimumBinaryPerFamilyGateId]
        ? 'pending'
        : 'fail',
      auxiliaryVetoPolicy
        ? 'Human consensus is pending; frozen auxiliary outcomes remain nonconfirmatory unless they supply an opposite binary veto.'
        : 'Potential binary yield is bounded by the frozen condition-matched auxiliary labels.',
    ),
  ];
  const heldOutWorlds = design.population.laterEvaluationWorldsExcludedFromCollectionAndMemory;
  const observedWorlds = unique(allObservedReadiness.sources.map(sourceWorld).filter(Boolean));
  const integrity = {
    sourceTraceFiles: registeredReadiness.summary.sourceFiles,
    quarantinedSourceFiles: registeredReadiness.summary.quarantinedSources,
    allClosedAssignmentsValidated:
      allObservedReadiness.summary.joinedMemoryRecords === allObservedReadiness.summary.closedOutcomes,
    sourceSetsAgree:
      registeredReadiness.summary.sourceFiles === allObservedReadiness.summary.sourceFiles &&
      sameMembers(
        registeredReadiness.sources.map((source) => source.sha256),
        allObservedReadiness.sources.map((source) => source.sha256),
      ),
    heldOutWorldLeak: observedWorlds.filter((worldId) => heldOutWorlds.includes(worldId)),
  };
  const failedGates = gates.filter((entry) => entry.status === 'fail');
  const pendingGates = gates.filter((entry) => entry.status === 'pending');
  return {
    schema: 'machinespirits.tutor-stub.action-outcome-collection-quality-audit.v1',
    studyId: design.studyId,
    asOf,
    modelCalls: 0,
    measurementPolicy: design.humanReview?.measurementPolicy || null,
    verdict: failedGates.length
      ? 'registered_feasibility_gates_failed'
      : pendingGates.length
        ? 'pending_human_review'
        : 'pass',
    controllerStudyLicensed: failedGates.length === 0 && pendingGates.length === 0,
    claimBoundary: design.claimBoundary,
    decisionRule: design.feasibilityEndpoints.decision,
    generation: {
      status: generationReport.status,
      source: generationReport.source,
      plannedDialogues: generationReport.execution.planned_units,
      completeDialogues: completeRows.length,
      technicalFailures: technicalRows.map((row) => row.job_id),
      missingDialogues: generationReport.execution.missing_units,
      turns: {
        completed: generationReport.execution.completed_turns,
        planned: generationReport.execution.planned_turns,
      },
      modelAttempts: generationReport.execution.model_attempts,
      perWorld: perWorldExecution,
    },
    integrity,
    extraction: {
      traceFiles: registeredReadiness.summary.sourceFiles,
      traceEvents: registeredReadiness.summary.events,
      typedDecisions: registeredReadiness.summary.typedDecisions,
      closedNextTurnOpportunities: closedOpportunities,
      terminalDecisionsWithoutNextObservation: terminalWithoutNextObservation,
      decisionAssignmentDisposition: countBy(decisionInventory.map((row) => row.assignmentStatus)),
      decisionConditionDisposition: countBy(decisionInventory.map((row) => row.conditionDisposition)),
      closedAssignmentDisposition: countBy(allClosedRows.map((row) => row.assignmentStatus)),
      conditionMatchedSeededClosedAssignments: matchedAssignments,
      conditionUnmatchedClosedAssignments: unmatchedAssignments,
      contributingDialogues: matchedDialogues.length,
      contributingWorlds: matchedWorlds.length,
      visibleDeliveries,
      matchedAuxiliaryOutcomes: matchedOutcomeCounts,
      maximumPotentialBinaryRecords,
      rates: {
        assignableClosedTurnPrevalence: wilsonInterval(seededClosed, closedOpportunities),
        conditionMatchedClosedTurnPrevalence: wilsonInterval(matchedAssignments, closedOpportunities),
        visibleDeliveryRate: wilsonInterval(visibleDeliveries, matchedAssignments),
        auxiliaryInconclusiveRate: wilsonInterval(matchedOutcomeCounts.inconclusive || 0, matchedAssignments),
      },
      matchedByFamily: matchedFamilies,
      allClosedSeededByFamily: allClosedFamilies,
      matchedByEligibleSet: eligibleSetSummary(registeredRows),
      allClosedSeededByEligibleSet: eligibleSetSummary(
        allClosedRows.filter((row) => row.assignmentStatus === 'seeded_uniform_family_assignment'),
      ),
      matchedByWorld: design.population.collectionWorlds.map((worldId) => {
        const rows = registeredRows.filter((row) => row.worldId === worldId);
        return {
          worldId,
          cases: rows.length,
          dialogues: unique(rows.map((row) => row.runId).filter(Boolean)).length,
          families: unique(rows.map((row) => row.family).filter(Boolean)),
        };
      }),
    },
    gates,
    failedGates: failedGates.map((entry) => `${entry.section}.${entry.id}`),
    pendingGates: pendingGates.map((entry) => `${entry.section}.${entry.id}`),
    implications: [
      'The prospective trace, assignment, join, and delivery paths were checked without model calls.',
      failedGates.length
        ? `${failedGates.length} registered gate(s) failed; the collection closes without top-up or threshold changes.`
        : 'Every execution and coverage gate passed; the registered review gates remain authoritative.',
      pendingGates.length
        ? `${pendingGates.length} gate(s) remain pending independent human review.`
        : 'No registered gate remains pending.',
      'This audit does not estimate learning, transfer, controller benefit, or relative family effectiveness.',
    ],
    provenance: {
      designPath: generationReport.design?.path || null,
      generationReportSchema: generationReport.schema,
      traces: registeredReadiness.sources.map((source) => ({
        jobId: jobIdFromSource(source.path),
        runId: source.runId,
        worldId: sourceWorld(source),
        sha256: source.sha256,
        bytes: source.bytes,
        errors: source.errors,
      })),
    },
  };
}

function percent(interval) {
  if (!interval) return 'n/a';
  return `${(interval.estimate * 100).toFixed(1)}% (${(interval.lower * 100).toFixed(1)}%–${(
    interval.upper * 100
  ).toFixed(1)}%)`;
}

function observedText(value) {
  if (value === null) return 'pending';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(3);
  if (typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export function renderTutorStubActionOutcomeCollectionAudit(audit) {
  const rates = audit.extraction.rates;
  const failedCount = audit.failedGates.length;
  const pendingCount = audit.pendingGates.length;
  const gateRows = audit.gates.map(
    (entry) =>
      `| ${entry.section} | ${entry.id} | ${entry.status.toUpperCase()} | ${observedText(entry.observed)} | ${observedText(entry.expected)} |`,
  );
  const familyRows = audit.extraction.matchedByFamily.map(
    (row) =>
      `| ${row.family} | ${row.cases} | ${row.visibleDeliveries} | ${row.dialogues} | ${row.worlds} | ${observedText(row.auxiliaryOutcomes)} |`,
  );
  return [
    '# Action-outcome collection pilot: zero-call quality audit',
    '',
    `Study: \`${audit.studyId}\`. As of: ${audit.asOf}. Model calls: 0.`,
    '',
    `**Verdict: ${audit.verdict}. This result does not license a held-out controller study.**`,
    '',
    `The audit found ${failedCount} failed gate(s) and ${pendingCount} gate(s) pending human review. It read ${audit.integrity.sourceTraceFiles} trace files and quarantined ${audit.integrity.quarantinedSourceFiles}.`,
    '',
    `Generation closed with ${audit.generation.completeDialogues}/${audit.generation.plannedDialogues} complete dialogues, ${audit.generation.technicalFailures.length} preserved technical failure(s), and ${audit.generation.missingDialogues} missing dialogue(s).`,
    '',
    '## Extraction',
    '',
    '| Quantity | Result |',
    '| --- | ---: |',
    `| Planned / complete / technical-failure dialogues | ${audit.generation.plannedDialogues} / ${audit.generation.completeDialogues} / ${audit.generation.technicalFailures.length} |`,
    `| Completed / planned turns | ${audit.generation.turns.completed} / ${audit.generation.turns.planned} |`,
    `| Typed decisions / closed next-turn opportunities | ${audit.extraction.typedDecisions} / ${audit.extraction.closedNextTurnOpportunities} |`,
    `| Seeded closed assignments | ${audit.extraction.closedAssignmentDisposition.seeded_uniform_family_assignment || 0} |`,
    `| Condition-matched seeded closed assignments | ${audit.extraction.conditionMatchedSeededClosedAssignments} |`,
    `| Contributing dialogues / worlds | ${audit.extraction.contributingDialogues} / ${audit.extraction.contributingWorlds} |`,
    `| Visible deliveries | ${audit.extraction.visibleDeliveries} |`,
    `| Maximum possible binary records | ${audit.extraction.maximumPotentialBinaryRecords} |`,
    '',
    'Wilson 95% intervals:',
    '',
    `- assignable closed-turn prevalence: ${percent(rates.assignableClosedTurnPrevalence)}`,
    `- registered-condition prevalence among closed turns: ${percent(rates.conditionMatchedClosedTurnPrevalence)}`,
    `- visible delivery among matched assignments: ${percent(rates.visibleDeliveryRate)}`,
    `- auxiliary inconclusive outcomes among matched assignments: ${percent(rates.auxiliaryInconclusiveRate)}`,
    '',
    '## Condition-matched family coverage',
    '',
    '| Family | Cases | Visible | Dialogues | Worlds | Auxiliary outcomes |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    ...familyRows,
    '',
    `The registered condition produced ${audit.extraction.conditionMatchedSeededClosedAssignments} seeded closed assignment(s) across ${audit.extraction.contributingDialogues} dialogue(s) and ${audit.extraction.contributingWorlds} world(s).`,
    '',
    '## Registered gates',
    '',
    '| Section | Gate | Status | Observed | Required |',
    '| --- | --- | --- | --- | --- |',
    ...gateRows,
    '',
    pendingCount
      ? 'Pending coder gates remain unmeasured; no human outcome labels are inferred by this zero-call audit.'
      : 'No registered gate remains pending.',
    '',
    '## Implications',
    '',
    ...audit.implications.map((entry) => `- ${entry}`),
    '',
    audit.claimBoundary,
    '',
    'Machine-readable provenance, source hashes, rates, family/world summaries, and every gate disposition are in `audit.json`. No transcript text is copied into either audit artifact.',
    '',
  ].join('\n');
}

async function main() {
  const { values } = parseArgs({
    options: {
      design: { type: 'string' },
      'generation-report': { type: 'string' },
      'readiness-input': { type: 'string' },
      out: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    process.stdout.write(
      'Usage: node scripts/audit-tutor-stub-action-outcome-collection.js --design <design.json> --generation-report <report.json> --readiness-input <input.json> --out <new-dir>\nZero-call extraction and registered feasibility-gate audit.\n',
    );
    return;
  }
  const designPath = path.resolve(requireString(values.design, '--design'));
  const generationReportPath = path.resolve(requireString(values['generation-report'], '--generation-report'));
  const readinessInputPath = path.resolve(requireString(values['readiness-input'], '--readiness-input'));
  const outputPath = path.resolve(requireString(values.out, '--out'));
  if (fs.existsSync(outputPath)) throw new Error(`refusing to overwrite audit output: ${outputPath}`);
  const loaded = loadTutorStubActionOutcomeCollectionDesign({
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
    designPath: path.relative(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), designPath),
  });
  const input = readJson(readinessInputPath);
  if (input.reviewsFile || input.replay) throw new Error('quality audit input must not contain reviews or replay');
  if (JSON.stringify(input.conditions) !== JSON.stringify(loaded.design.condition.conditions)) {
    throw new Error('readiness input conditions must exactly match the registered design');
  }
  if (
    !Array.isArray(input.sources) ||
    input.sources.some(
      (source) => source.role !== 'memory' || source.contextKey !== loaded.design.taskContract.contextKey,
    )
  ) {
    throw new Error('readiness sources must use the registered memory role and context key');
  }
  const registered = await buildActionOutcomeMemoryReadiness(input, {
    inputDirectory: path.dirname(readinessInputPath),
  });
  const allObserved = await buildActionOutcomeMemoryReadiness(
    { ...input, conditions: [ALL_OBSERVED_CONDITION] },
    { inputDirectory: path.dirname(readinessInputPath) },
  );
  const decisionInventory = readCollectionDecisionInventory(registered.report.sources, input.conditions);
  const audit = buildTutorStubActionOutcomeCollectionAudit({
    design: loaded.design,
    generationReport: readJson(generationReportPath),
    registeredReadiness: registered.report,
    allObservedReadiness: allObserved.report,
    decisionInventory,
    asOf: input.asOf,
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.mkdirSync(outputPath);
  fs.writeFileSync(path.join(outputPath, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`, { flag: 'wx' });
  fs.writeFileSync(path.join(outputPath, 'README.md'), renderTutorStubActionOutcomeCollectionAudit(audit), {
    flag: 'wx',
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        output: outputPath,
        verdict: audit.verdict,
        failedGates: audit.failedGates,
        pendingGates: audit.pendingGates,
        modelCalls: audit.modelCalls,
      },
      null,
      2,
    )}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
