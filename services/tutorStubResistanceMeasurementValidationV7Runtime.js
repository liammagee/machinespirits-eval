import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { resolveTutorStubArtifactArchiveDirectory } from './tutorStubArtifactArchive.js';
import { writeTutorStubResistanceRecoverySemanticValidationReport } from './tutorStubResistanceSplitMeasurementValidationRuntime.js';
import {
  TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V7,
  TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V7,
} from './tutorStubResistanceRecoverySemanticValidationV7.js';

export const TUTOR_STUB_RESISTANCE_MEASUREMENT_COMBINED_VALIDATION_REPORT_SCHEMA_V7 =
  'machinespirits.tutor-stub.resistance-measurement-combined-validation-report.v7';

function bytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(Buffer.isBuffer(value) ? value : bytes(value))
    .digest('hex');
}

function read(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function createOrVerify(file, value, label) {
  const expected = bytes(value);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, expected, { flag: 'wx' });
  else if (!fs.readFileSync(file).equals(expected)) throw new Error(`${label} exists with noncanonical bytes`);
}

export function writeTutorStubResistanceMeasurementCombinedValidationReportV7({
  primaryDestination,
  fidelityDestination,
  combinedDestination,
  expectedSourceCommit,
  expectedSourceTree,
  expectedGoRequestPath,
  expectedGoRequestSha256,
  expectedGoRequest,
  sourceDirty,
  archiveDir,
}) {
  if (sourceDirty !== false) throw new Error('combined V7 validation analysis requires a clean source tree');
  if (
    !path.isAbsolute(primaryDestination) ||
    !path.isAbsolute(fidelityDestination) ||
    !path.isAbsolute(combinedDestination)
  ) {
    throw new Error('combined V7 validation analysis requires absolute destinations');
  }
  if (
    primaryDestination === fidelityDestination ||
    [primaryDestination, fidelityDestination].includes(combinedDestination)
  ) {
    throw new Error('combined V7 validation destinations must be distinct');
  }
  for (const destination of [primaryDestination, fidelityDestination]) {
    if (!fs.existsSync(path.join(destination, 'seal.json'))) {
      throw new Error('both V7 validation stages must seal before any outcome analysis');
    }
  }
  const common = {
    expectedSourceCommit,
    expectedSourceTree,
    expectedGoRequestPath,
    expectedGoRequestSha256,
    expectedGoRequest,
    sourceDirty,
    archiveDir,
  };
  const primary = writeTutorStubResistanceRecoverySemanticValidationReport({
    ...common,
    destination: primaryDestination,
    validationRegistration: TUTOR_STUB_RESISTANCE_RECOVERY_PRIMARY_VALIDATION_REGISTRATION_V7,
  });
  const fidelity = writeTutorStubResistanceRecoverySemanticValidationReport({
    ...common,
    destination: fidelityDestination,
    validationRegistration: TUTOR_STUB_RESISTANCE_FIDELITY_VALIDATION_REGISTRATION_V7,
  });
  const primarySeal = read(path.join(primaryDestination, 'seal.json'));
  const fidelitySeal = read(path.join(fidelityDestination, 'seal.json'));
  const report = {
    schema: TUTOR_STUB_RESISTANCE_MEASUREMENT_COMBINED_VALIDATION_REPORT_SCHEMA_V7,
    status: primary.status === 'passed' && fidelity.status === 'passed' ? 'passed' : 'failed',
    source: { commit: expectedSourceCommit, tree: expectedSourceTree },
    go_request: { path: expectedGoRequestPath, sha256: expectedGoRequestSha256 },
    analysis_timing: 'one_combined_analysis_after_both_stages_sealed',
    primary: {
      status: primary.status,
      stage_report_sha256: sha256(primary),
      plan_sha256: primary.plan_sha256,
      seal_sha256: primary.seal_sha256,
      reservations: primarySeal.reservations,
      judge_results: primarySeal.judge_results,
      metrics: primary.score.metrics,
    },
    fidelity: {
      status: fidelity.status,
      stage_report_sha256: sha256(fidelity),
      plan_sha256: fidelity.plan_sha256,
      seal_sha256: fidelity.seal_sha256,
      reservations: fidelitySeal.reservations,
      judge_results: fidelitySeal.judge_results,
      metrics: fidelity.score.metrics,
    },
    accounting: {
      planned_calls: 720,
      hard_validation_reservations: 2160,
      observed_reservations: primarySeal.reservations + fidelitySeal.reservations,
      observed_judge_results: primarySeal.judge_results + fidelitySeal.judge_results,
      programme_ledger_before: 2273,
      programme_ledger_after_observed: 2273 + primarySeal.reservations + fidelitySeal.reservations,
      programme_ceiling: 10000,
      attempt_counts_role: 'operational_safeguard_only_not_design_objective',
    },
    verdict_separation: {
      primary_and_fidelity_claims_separate: true,
      fidelity_failure_may_erase_primary_validation: false,
      both_must_pass_before_confirmation: true,
      validation_outcomes_enter_confirmation: false,
    },
    confirmation_ready: primary.status === 'passed' && fidelity.status === 'passed',
    claim_boundary:
      'Measurement validation only. No validation case enters the confirmation and no warm-versus-plain efficacy, null, learning, transfer, human, cell, or profile claim is licensed.',
  };
  if (report.accounting.observed_reservations > report.accounting.hard_validation_reservations) {
    throw new Error('combined V7 validation reservation ceiling exceeded');
  }
  const reportFile = path.join(combinedDestination, 'report.json');
  createOrVerify(reportFile, report, 'combined V7 validation report');
  const base = resolveTutorStubArtifactArchiveDirectory(archiveDir, { repoRoot: process.cwd() });
  if (!base) throw new Error('combined V7 validation report requires a durable private archive');
  const archiveRoot = path.join(
    base,
    'artifacts/tutor-stub-live/resistance-measurement-validation-v7',
    expectedGoRequestSha256.slice(0, 24),
  );
  const archiveReport = path.join(archiveRoot, 'combined-report.json');
  const archiveManifest = path.join(archiveRoot, 'manifest.json');
  createOrVerify(archiveReport, report, 'archived combined V7 validation report');
  createOrVerify(
    archiveManifest,
    {
      schema: 'machinespirits.tutor-stub.resistance-measurement-combined-validation-archive.v7',
      go_request_sha256: expectedGoRequestSha256,
      report_sha256: sha256(report),
      report_bytes: bytes(report).length,
      source: report.source,
    },
    'combined V7 validation archive manifest',
  );
  if (!fs.readFileSync(reportFile).equals(fs.readFileSync(archiveReport))) {
    throw new Error('combined V7 validation local and archived report bytes disagree');
  }
  return report;
}
