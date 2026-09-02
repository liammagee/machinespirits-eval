#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { buildActionOutcomeMemoryReadiness } from './action-outcome-memory-readiness.js';
import {
  buildTutorStubActionOutcomeCollectionAudit,
  loadTutorStubActionOutcomeAuditDesign,
  readCollectionDecisionInventory,
  renderTutorStubActionOutcomeCollectionAudit,
} from './audit-tutor-stub-action-outcome-collection.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALL_OBSERVED_CONDITION = {
  id: 'audit_all_observed',
  stagnationAtLeast: 0,
  fieldVelocityAtMost: Number.MAX_SAFE_INTEGER,
  dagVelocityAtMost: Number.MAX_SAFE_INTEGER,
};

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonLines(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function writeOnce(filePath, value) {
  fs.writeFileSync(filePath, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function sourceRecord(filePath) {
  const stat = fs.statSync(filePath);
  return { path: filePath, sha256: sha256File(filePath), bytes: stat.size };
}

export function validateOperatorPauseEvidence({ generationReport, unitIds }) {
  if (!Array.isArray(unitIds) || unitIds.length !== 2 || new Set(unitIds).size !== 2) {
    throw new Error('the retrospective amendment requires exactly two distinct operator-pause units');
  }
  return unitIds.map((unitId) => {
    const row = generationReport.rows.find((candidate) => candidate.job_id === unitId);
    if (
      !row ||
      row.status !== 'technical_failure' ||
      row.exit?.signal !== 'SIGINT' ||
      !String(row.interruption_reason || '').includes('operator-requested pause')
    ) {
      throw new Error(`unit ${unitId} lacks explicit operator-requested SIGINT evidence`);
    }
    const reserved = Number(row.model_attempts?.reserved || 0);
    const completed = Number(row.model_attempts?.completed || 0);
    const failed = Number(row.model_attempts?.failed || 0);
    if (reserved - completed - failed !== 1) {
      throw new Error(`unit ${unitId} does not have exactly one unexplained reservation`);
    }
    const artifactRoot = path.resolve(row.artifact_root || '');
    const runLedgerPath = path.join(artifactRoot, 'run-ledger.jsonl');
    const runLedger = readJsonLines(runLedgerPath);
    const reservation = runLedger.find((event) => event.type === 'model_attempt_reserved' && event.unit === unitId);
    const unitCompletion = runLedger.find((event) => event.type === 'unit_complete' && event.job_id === unitId);
    const seal = runLedger.at(-1);
    if (
      !reservation ||
      unitCompletion ||
      seal?.type !== 'run_sealed' ||
      seal.status !== 'technical_failure' ||
      seal.recovery_permitted !== true ||
      !String(seal.reason || '').includes('operator-requested pause')
    ) {
      throw new Error(`unit ${unitId} is not independently supported by its sealed run ledger`);
    }
    const tracePath = path.resolve(artifactRoot, row.trace || '');
    if (!fs.existsSync(tracePath)) throw new Error(`unit ${unitId} trace is missing`);
    return {
      unit_id: unitId,
      world_id: row.world_id,
      disposition: 'interrupted_after_dispatch',
      count: 1,
      semantic_status_preserved: row.status,
      exit_signal: row.exit.signal,
      interruption_reason: row.interruption_reason,
      original_model_attempts: { reserved, completed, failed },
      evidence: {
        run_ledger: sourceRecord(runLedgerPath),
        trace: sourceRecord(tracePath),
        run_seal: {
          status: seal.status,
          recovery_permitted: seal.recovery_permitted,
          reason: seal.reason,
        },
      },
    };
  });
}

export function amendGenerationReportForOperatorPauses({ generationReport, evidence, amendmentPath }) {
  const amended = JSON.parse(JSON.stringify(generationReport));
  const evidenceByUnit = new Map(evidence.map((entry) => [entry.unit_id, entry]));
  for (const row of amended.rows) {
    const applied = evidenceByUnit.get(row.job_id);
    const attempts = row.model_attempts;
    attempts.cancelled_before_dispatch = Number(attempts.cancelled_before_dispatch || 0);
    attempts.interrupted_after_dispatch = Number(attempts.interrupted_after_dispatch || 0) + (applied?.count || 0);
    attempts.unexplained = Math.max(
      0,
      Number(attempts.reserved || 0) -
        Number(attempts.completed || 0) -
        Number(attempts.failed || 0) -
        attempts.cancelled_before_dispatch -
        attempts.interrupted_after_dispatch,
    );
    attempts.accounting_balanced = attempts.unexplained === 0;
    attempts.accounting_equation =
      'reserved = completed + failed + cancelled_before_dispatch + interrupted_after_dispatch + unexplained';
    if (applied) {
      row.pause_accounting_amendment = {
        disposition: applied.disposition,
        count: applied.count,
        semantic_status_changed: false,
      };
    }
  }
  const sums = (field) => amended.rows.reduce((sum, row) => sum + Number(row.model_attempts?.[field] || 0), 0);
  Object.assign(amended.execution.model_attempts, {
    cancelled_before_dispatch: sums('cancelled_before_dispatch'),
    interrupted_after_dispatch: sums('interrupted_after_dispatch'),
    unexplained: sums('unexplained'),
    accounting_balanced: sums('unexplained') === 0,
    accounting_equation:
      'reserved_by_children = completed + failed + cancelled_before_dispatch + interrupted_after_dispatch + unexplained',
  });
  amended.pause_accounting_amendment = {
    schema: 'machinespirits.tutor-stub.operator-pause-accounting-amendment.v1',
    path: amendmentPath,
    raw_artifacts_mutated: false,
    semantic_outcomes_changed: false,
    units: evidence.map((entry) => entry.unit_id),
  };
  return amended;
}

export async function buildOperatorPauseAmendment({
  designPath,
  generationReportPath,
  readinessInputPath,
  sourceAuditPath,
  packetManifestPath,
  outputPath,
  unitIds,
} = {}) {
  if (fs.existsSync(outputPath)) throw new Error(`refusing to overwrite amendment output: ${outputPath}`);
  const relativeDesignPath = path.relative(ROOT, designPath).split(path.sep).join('/');
  const loaded = loadTutorStubActionOutcomeAuditDesign({ root: ROOT, designPath: relativeDesignPath });
  const generationReport = readJson(generationReportPath);
  const sourceAudit = readJson(sourceAuditPath);
  const packetManifest = readJson(packetManifestPath);
  if (
    sourceAudit.verdict !== 'registered_feasibility_gates_failed' ||
    JSON.stringify(sourceAudit.failedGates) !== JSON.stringify(['execution.allAttemptAccountingBalances']) ||
    sourceAudit.extraction?.conditionMatchedSeededClosedAssignments !== 35
  ) {
    throw new Error('source audit is not the preserved corrected 35-case accounting-only failure');
  }
  if (
    packetManifest.modelCalls !== 0 ||
    packetManifest.measurementPolicy !== loaded.design.humanReview.measurementPolicy
  ) {
    throw new Error('coder packet manifest does not match the registered zero-call measurement policy');
  }
  const evidence = validateOperatorPauseEvidence({ generationReport, unitIds });
  const amendedReportPath = path.join(outputPath, 'amended-generation-report.json');
  const amendedReport = amendGenerationReportForOperatorPauses({
    generationReport,
    evidence,
    amendmentPath: path.join(outputPath, 'amendment.json'),
  });
  const input = readJson(readinessInputPath);
  const registered = await buildActionOutcomeMemoryReadiness(input, {
    inputDirectory: path.dirname(readinessInputPath),
  });
  const allObserved = await buildActionOutcomeMemoryReadiness(
    { ...input, conditions: [ALL_OBSERVED_CONDITION] },
    { inputDirectory: path.dirname(readinessInputPath) },
  );
  const decisionInventory = readCollectionDecisionInventory(registered.report.sources, input.conditions);
  const amendedAudit = buildTutorStubActionOutcomeCollectionAudit({
    design: loaded.design,
    generationReport: amendedReport,
    registeredReadiness: registered.report,
    allObservedReadiness: allObserved.report,
    decisionInventory,
    asOf: input.asOf,
  });
  if (
    amendedAudit.verdict !== 'pending_human_review' ||
    amendedAudit.failedGates.length !== 0 ||
    amendedAudit.extraction.conditionMatchedSeededClosedAssignments !== 35
  ) {
    throw new Error('amended audit did not close the accounting-only failure while preserving the 35-case extraction');
  }
  amendedAudit.amendment = {
    schema: 'machinespirits.tutor-stub.operator-pause-accounting-amendment.v1',
    originalAudit: sourceRecord(sourceAuditPath),
    originalVerdict: sourceAudit.verdict,
    amendedVerdict: amendedAudit.verdict,
    rawArtifactsMutated: false,
    semanticOutcomesChanged: false,
    terminalDispositionAdded: { interrupted_after_dispatch: evidence.length },
    explanation:
      'The original audit remains failed as written. This derived audit treats only the two independently evidenced operator-requested SIGINT interruptions as terminal attempt dispositions.',
  };
  amendedAudit.implications.unshift(
    'This is an explicit pause-accounting amendment. It does not rewrite or retroactively pass the preserved original audit.',
  );
  const amendment = {
    schema: 'machinespirits.tutor-stub.operator-pause-accounting-amendment.v1',
    study_id: loaded.design.studyId,
    recorded_at: new Date().toISOString(),
    model_calls: 0,
    scope: 'attempt-accounting only',
    original_audit_verdict: sourceAudit.verdict,
    amended_audit_verdict: amendedAudit.verdict,
    raw_artifacts_mutated: false,
    semantic_outcomes_changed: false,
    exact_comparative_cases: 35,
    attempt_accounting: amendedReport.execution.model_attempts,
    units: evidence,
    sources: {
      design: sourceRecord(designPath),
      generation_report: sourceRecord(generationReportPath),
      readiness_input: sourceRecord(readinessInputPath),
      original_audit: sourceRecord(sourceAuditPath),
      coder_packet_manifest: sourceRecord(packetManifestPath),
    },
  };
  const derivedLedger = [
    {
      type: 'operator_pause_accounting_amendment_opened',
      study_id: loaded.design.studyId,
      raw_artifacts_mutated: false,
      semantic_outcomes_changed: false,
    },
    ...evidence.map((entry) => ({
      type: 'model_attempt_interrupted_after_dispatch',
      unit_id: entry.unit_id,
      count: entry.count,
      basis: 'independently_evidenced_operator_requested_SIGINT',
      source_trace_sha256: entry.evidence.trace.sha256,
      source_run_ledger_sha256: entry.evidence.run_ledger.sha256,
    })),
    {
      type: 'operator_pause_accounting_amendment_sealed',
      reserved: amendedReport.execution.model_attempts.reserved_by_children,
      completed: amendedReport.execution.model_attempts.completed,
      failed: amendedReport.execution.model_attempts.failed,
      cancelled_before_dispatch: amendedReport.execution.model_attempts.cancelled_before_dispatch,
      interrupted_after_dispatch: amendedReport.execution.model_attempts.interrupted_after_dispatch,
      unexplained: amendedReport.execution.model_attempts.unexplained,
    },
  ];
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.mkdirSync(outputPath);
  writeOnce(path.join(outputPath, 'amendment.json'), amendment);
  writeOnce(amendedReportPath, amendedReport);
  writeOnce(path.join(outputPath, 'amended-audit.json'), amendedAudit);
  writeOnce(path.join(outputPath, 'derived-ledger.jsonl'), `${derivedLedger.map(JSON.stringify).join('\n')}\n`);
  writeOnce(
    path.join(outputPath, 'README.md'),
    [
      '# Operator-pause accounting amendment',
      '',
      'This create-once, zero-call artifact preserves the original generation report and both earlier audits unchanged.',
      '',
      `Two independently evidenced operator-requested SIGINT interruptions are recorded as \`interrupted_after_dispatch\`. The amended child-attempt equation is ${amendedReport.execution.model_attempts.reserved_by_children} reserved = ${amendedReport.execution.model_attempts.completed} completed + ${amendedReport.execution.model_attempts.failed} failed + ${amendedReport.execution.model_attempts.cancelled_before_dispatch} cancelled before dispatch + ${amendedReport.execution.model_attempts.interrupted_after_dispatch} interrupted after dispatch, leaving ${amendedReport.execution.model_attempts.unexplained} unexplained.`,
      '',
      `The preserved original audit verdict is \`${sourceAudit.verdict}\`. The amended verdict is \`${amendedAudit.verdict}\`, with ${amendedAudit.pendingGates.length} registered human-review gates still pending.`,
      '',
      'No dialogue, action assignment, auxiliary outcome, semantic label, inclusion decision, or threshold changed. The existing 35-case coder packet remains the registered packet.',
      '',
      renderTutorStubActionOutcomeCollectionAudit(amendedAudit),
    ].join('\n'),
  );
  return { amendment, amendedReport, amendedAudit };
}

async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      design: { type: 'string' },
      'generation-report': { type: 'string' },
      'readiness-input': { type: 'string' },
      'source-audit': { type: 'string' },
      'packet-manifest': { type: 'string' },
      unit: { type: 'string', multiple: true },
      out: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    process.stdout.write(
      'Usage: node scripts/amend-tutor-stub-action-outcome-operator-pauses.js --design <json> --generation-report <json> --readiness-input <json> --source-audit <json> --packet-manifest <json> --unit <id> --unit <id> --out <new-dir>\n',
    );
    return;
  }
  const result = await buildOperatorPauseAmendment({
    designPath: path.resolve(requireString(values.design, '--design')),
    generationReportPath: path.resolve(requireString(values['generation-report'], '--generation-report')),
    readinessInputPath: path.resolve(requireString(values['readiness-input'], '--readiness-input')),
    sourceAuditPath: path.resolve(requireString(values['source-audit'], '--source-audit')),
    packetManifestPath: path.resolve(requireString(values['packet-manifest'], '--packet-manifest')),
    outputPath: path.resolve(requireString(values.out, '--out')),
    unitIds: values.unit || [],
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        output: path.resolve(values.out),
        originalVerdict: result.amendment.original_audit_verdict,
        amendedVerdict: result.amendment.amended_audit_verdict,
        exactComparativeCases: result.amendment.exact_comparative_cases,
        attemptAccounting: result.amendment.attempt_accounting,
        modelCalls: 0,
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
