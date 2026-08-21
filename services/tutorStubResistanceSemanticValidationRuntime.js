import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA,
  adjudicateTutorStubResistanceSemanticJudges,
  buildTutorStubResistanceSemanticAdjudicationPrompt,
  scoreTutorStubResistanceSemanticCorpus,
  tutorStubResistanceSemanticPromptSha256,
  tutorStubResistanceSemanticSha256,
  wrapTutorStubResistanceSemanticModelOutput,
} from './tutorStubResistanceSemanticAdjudication.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V2,
  adjudicateTutorStubResistanceSemanticJudgesV2,
  buildTutorStubResistanceSemanticAdjudicationPromptV2,
  scoreTutorStubResistanceSemanticCorpusV2,
  wrapTutorStubResistanceSemanticModelOutputV2,
} from './tutorStubResistanceSemanticAdjudicationV2.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3,
  adjudicateTutorStubResistanceSemanticJudgesV3,
  buildTutorStubResistanceSemanticAdjudicationPromptV3,
  scoreTutorStubResistanceSemanticCorpusV3,
  wrapTutorStubResistanceSemanticModelOutputV3,
} from './tutorStubResistanceSemanticAdjudicationV3.js';
import { TUTOR_STUB_RESISTANCE_SEMANTIC_SYSTEM_PROMPT } from './tutorStubResistanceSemanticRuntime.js';
import {
  buildTutorStubResistanceSemanticBlindedValidationCases,
  loadTutorStubResistanceSemanticValidation,
  tutorStubResistanceSemanticCorpusCaseForExecutionId,
  tutorStubResistanceSemanticValidationPlanFingerprint,
} from './tutorStubResistanceSemanticValidation.js';
import { tutorStubCliPolicyRetryDecision, waitTutorStubCliPolicyRetryDelay } from './tutorStubCliPolicyRetry.js';
import { resolveTutorStubArtifactArchiveDirectory } from './tutorStubArtifactArchive.js';

export const TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_PLAN_SCHEMA =
  'machinespirits.tutor-stub.resistance-semantic-validation-plan.v1';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_CHECKPOINT_SCHEMA =
  'machinespirits.tutor-stub.resistance-semantic-validation-case-checkpoint.v1';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_SEAL_SCHEMA =
  'machinespirits.tutor-stub.resistance-semantic-validation-seal.v1';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REPORT_SCHEMA =
  'machinespirits.tutor-stub.resistance-semantic-validation-report.v1';
const CLAUDE_EXIT_BEFORE_RESPONSE_REASON = 'claude CLI exited before an accepted semantic response';

function semanticInstrument(loaded) {
  const buildBlindedCases = loaded?.buildBlindedCases || buildTutorStubResistanceSemanticBlindedValidationCases;
  const corpusCaseForExecutionId =
    loaded?.corpusCaseForExecutionId || tutorStubResistanceSemanticCorpusCaseForExecutionId;
  if (loaded?.instrument?.registration?.version === 3) {
    return {
      outputSchema: TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3,
      buildPrompt: buildTutorStubResistanceSemanticAdjudicationPromptV3,
      wrapModelOutput: wrapTutorStubResistanceSemanticModelOutputV3,
      adjudicate: adjudicateTutorStubResistanceSemanticJudgesV3,
      scoreCorpus: scoreTutorStubResistanceSemanticCorpusV3,
      buildBlindedCases,
      corpusCaseForExecutionId,
    };
  }
  if (loaded?.instrument?.registration?.version === 2) {
    return {
      outputSchema: TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V2,
      buildPrompt: buildTutorStubResistanceSemanticAdjudicationPromptV2,
      wrapModelOutput: wrapTutorStubResistanceSemanticModelOutputV2,
      adjudicate: adjudicateTutorStubResistanceSemanticJudgesV2,
      scoreCorpus: scoreTutorStubResistanceSemanticCorpusV2,
      buildBlindedCases,
      corpusCaseForExecutionId,
    };
  }
  return {
    outputSchema: TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA,
    buildPrompt: buildTutorStubResistanceSemanticAdjudicationPrompt,
    wrapModelOutput: wrapTutorStubResistanceSemanticModelOutput,
    adjudicate: adjudicateTutorStubResistanceSemanticJudges,
    scoreCorpus: scoreTutorStubResistanceSemanticCorpus,
    buildBlindedCases,
    corpusCaseForExecutionId,
  };
}

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

function canonicalSha256(value) {
  return tutorStubResistanceSemanticSha256(JSON.stringify(canonicalJson(value)));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${crypto.randomUUID()}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  fs.renameSync(temporary, file);
}

function createJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function openValidationArchive({
  archiveDir: explicitArchiveDir,
  plan,
  resume = false,
  afterArchiveEntryWrite = null,
}) {
  const archiveDir = resolveTutorStubArtifactArchiveDirectory(explicitArchiveDir, { repoRoot: process.cwd() });
  if (!archiveDir) throw new Error('semantic validation requires a writable durable private archive');
  const root = path.join(
    archiveDir,
    'artifacts',
    'tutor-stub-live',
    'resistance-semantic-validation',
    `${plan.authorization.go_request_sha256.slice(0, 16)}-${plan.plan_sha256.slice(0, 16)}`,
  );
  const manifestPath = path.join(root, 'archive-manifest.json');
  let manifest;
  if (!resume) {
    fs.mkdirSync(path.dirname(root), { recursive: true });
    fs.mkdirSync(root, { recursive: false });
    manifest = {
      schema: 'machinespirits.tutor-stub.resistance-semantic-validation-durable-archive.v1',
      status: 'running',
      plan_sha256: plan.plan_sha256,
      go_request_sha256: plan.authorization.go_request_sha256,
      source: plan.source,
      entries: [],
    };
    createJson(manifestPath, manifest);
  } else {
    if (!fs.existsSync(manifestPath)) throw new Error('semantic validation resume requires its durable archive');
    manifest = readJson(manifestPath);
    if (
      manifest.schema !== 'machinespirits.tutor-stub.resistance-semantic-validation-durable-archive.v1' ||
      manifest.plan_sha256 !== plan.plan_sha256 ||
      manifest.go_request_sha256 !== plan.authorization.go_request_sha256 ||
      !exactJson(manifest.source, plan.source)
    ) {
      throw new Error('semantic validation durable archive binding drifted');
    }
  }
  function append(stage, logicalPath, value) {
    const bytes = jsonBytes(value);
    const digest = tutorStubResistanceSemanticSha256(bytes);
    const transitionId = tutorStubResistanceSemanticSha256(`${stage}\0${logicalPath}\0${digest}`);
    const relative = path.join('entries', `${transitionId}.json`);
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (fs.existsSync(target)) {
      if (!fs.readFileSync(target).equals(bytes)) {
        throw new Error('semantic validation durable archive transition identity collision');
      }
    } else {
      fs.writeFileSync(target, bytes, { flag: 'wx' });
    }
    if (tutorStubResistanceSemanticSha256(fs.readFileSync(target)) !== digest) {
      throw new Error('semantic validation durable archive byte verification failed');
    }
    afterArchiveEntryWrite?.({ stage, logicalPath, transitionId, target });
    manifest = readJson(manifestPath);
    const existing = manifest.entries.find((entry) => entry.transition_id === transitionId);
    if (existing) {
      if (
        existing.stage !== stage ||
        existing.logical_path !== logicalPath ||
        existing.path !== relative ||
        existing.bytes !== bytes.length ||
        existing.sha256 !== digest
      ) {
        throw new Error('semantic validation durable archive transition manifest drifted');
      }
      return { sequence: existing.sequence, transition_id: transitionId, sha256: digest };
    }
    const sequence = manifest.entries.length + 1;
    manifest.entries.push({
      sequence,
      transition_id: transitionId,
      stage,
      logical_path: logicalPath,
      path: relative,
      bytes: bytes.length,
      sha256: digest,
    });
    atomicWriteJson(manifestPath, manifest);
    return { sequence, transition_id: transitionId, sha256: digest };
  }
  function localArchiveCandidates(localRoot) {
    const candidates = [];
    for (const logicalPath of ['plan.json', 'seal.json', 'report.json']) {
      const file = path.join(localRoot, logicalPath);
      if (!fs.existsSync(file)) continue;
      candidates.push({ logicalPath, file, stage: logicalPath.split('.')[0], value: readJson(file) });
    }
    const casesRoot = path.join(localRoot, 'cases');
    if (fs.existsSync(casesRoot)) {
      for (const caseId of fs.readdirSync(casesRoot)) {
        const logicalPath = `cases/${caseId}/checkpoint.json`;
        const file = path.join(localRoot, logicalPath);
        if (!fs.existsSync(file)) continue;
        const value = readJson(file);
        candidates.push({ logicalPath, file, stage: checkpointArchiveStage(value), value });
      }
    }
    return candidates;
  }
  function verify({
    localRoot = null,
    requireCurrentLocalTransitions = false,
    allowUnmanifestedEntryFiles = false,
    allowedUnmanifestedTransitions = null,
  } = {}) {
    const issues = [];
    manifest = readJson(manifestPath);
    const manifestKeys = ['schema', 'status', 'plan_sha256', 'go_request_sha256', 'source', 'entries'];
    if (
      !exactJson(Object.keys(manifest).sort(), manifestKeys.sort()) ||
      manifest.schema !== 'machinespirits.tutor-stub.resistance-semantic-validation-durable-archive.v1' ||
      manifest.status !== 'running' ||
      manifest.plan_sha256 !== plan.plan_sha256 ||
      manifest.go_request_sha256 !== plan.authorization.go_request_sha256 ||
      !exactJson(manifest.source, plan.source) ||
      !Array.isArray(manifest.entries)
    ) {
      issues.push('archive manifest binding or keys drifted');
      return { valid: false, issues, root, manifest };
    }
    const entryKeys = ['sequence', 'transition_id', 'stage', 'logical_path', 'path', 'bytes', 'sha256'];
    const checkpointStages = new Set([
      'checkpoint_initialized',
      'checkpoint_prepared',
      'checkpoint_dispatched',
      'checkpoint_returned',
      'checkpoint_invalid',
      'checkpoint_transport_failed',
      'checkpoint_sealed',
      'checkpoint_partial_sealed',
      'checkpoint_dispatch_ambiguous_sealed',
    ]);
    const terminalCheckpointStages = new Set([
      'checkpoint_sealed',
      'checkpoint_partial_sealed',
      'checkpoint_dispatch_ambiguous_sealed',
    ]);
    const seenTransitions = new Set();
    const seenSequences = new Set();
    for (const [index, entry] of manifest.entries.entries()) {
      const expectedTransition = tutorStubResistanceSemanticSha256(
        `${entry.stage}\0${entry.logical_path}\0${entry.sha256}`,
      );
      const expectedPath = path.join('entries', `${expectedTransition}.json`);
      const checkpointLogical = /^cases\/[a-z0-9][a-z0-9-]*\/checkpoint\.json$/u.test(entry.logical_path);
      const stageLogicalValid =
        (entry.stage === 'plan' && entry.logical_path === 'plan.json') ||
        (entry.stage === 'seal' && entry.logical_path === 'seal.json') ||
        (entry.stage === 'report' && entry.logical_path === 'report.json') ||
        (checkpointStages.has(entry.stage) && checkpointLogical);
      if (
        !exactJson(Object.keys(entry).sort(), entryKeys.sort()) ||
        entry.sequence !== index + 1 ||
        seenSequences.has(entry.sequence) ||
        seenTransitions.has(entry.transition_id) ||
        entry.transition_id !== expectedTransition ||
        entry.path !== expectedPath ||
        !stageLogicalValid ||
        !Number.isInteger(entry.bytes) ||
        entry.bytes < 1 ||
        !/^[0-9a-f]{64}$/u.test(entry.sha256)
      ) {
        issues.push(`${index + 1}: archive entry topology drifted`);
      }
      seenSequences.add(entry.sequence);
      seenTransitions.add(entry.transition_id);
      const target = path.join(root, entry.path);
      const relative = path.relative(root, target);
      if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        issues.push(`${entry.sequence}: archive entry path escapes root`);
      } else if (!fs.existsSync(target)) issues.push(`${entry.sequence}: archive entry missing`);
      else {
        const archivedBytes = fs.readFileSync(target);
        if (archivedBytes.length !== entry.bytes || tutorStubResistanceSemanticSha256(archivedBytes) !== entry.sha256) {
          issues.push(`${entry.sequence}: archive entry byte metadata mismatch`);
        } else if (entry.stage === 'plan') {
          if (!exactJson(readJson(target), plan)) issues.push(`${entry.sequence}: archive plan bytes drifted`);
        } else if (checkpointStages.has(entry.stage)) {
          const archivedCheckpoint = readJson(target);
          const caseId = entry.logical_path.split('/')[1];
          if (
            archivedCheckpoint.schema !== TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_CHECKPOINT_SCHEMA ||
            archivedCheckpoint.plan_sha256 !== plan.plan_sha256 ||
            archivedCheckpoint.case_id !== caseId ||
            checkpointArchiveStage(archivedCheckpoint) !== entry.stage
          ) {
            issues.push(`${entry.sequence}: archive checkpoint binding or stage drifted`);
          }
        }
      }
    }
    const entriesDirectory = path.join(root, 'entries');
    const archivedEntryFiles = fs.existsSync(entriesDirectory)
      ? fs
          .readdirSync(entriesDirectory, { withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => path.join('entries', entry.name))
          .sort()
      : [];
    const manifestedEntryFiles = manifest.entries.map((entry) => entry.path).sort();
    const referencedFilesArePresent = manifestedEntryFiles.every((file) => archivedEntryFiles.includes(file));
    const unmanifestedTransitions = archivedEntryFiles
      .filter((file) => !manifestedEntryFiles.includes(file))
      .map((file) => path.basename(file, '.json'));
    const allowedUnmanifested =
      allowUnmanifestedEntryFiles ||
      (allowedUnmanifestedTransitions instanceof Set &&
        unmanifestedTransitions.every((transition) => allowedUnmanifestedTransitions.has(transition)));
    if (!referencedFilesArePresent || (!allowedUnmanifested && !exactJson(archivedEntryFiles, manifestedEntryFiles))) {
      issues.push('semantic validation archive entry inventory drifted');
    }
    if (localRoot) {
      for (const local of localArchiveCandidates(localRoot)) {
        const localBytes = fs.readFileSync(local.file);
        const localSha256 = tutorStubResistanceSemanticSha256(localBytes);
        if (
          !manifest.entries.some(
            (entry) =>
              entry.logical_path === local.logicalPath &&
              (requireCurrentLocalTransitions || !local.logicalPath.includes('/checkpoint.json')
                ? entry.stage === local.stage
                : terminalCheckpointStages.has(entry.stage)) &&
              entry.sha256 === localSha256 &&
              entry.bytes === localBytes.length,
          )
        ) {
          issues.push(`${local.logicalPath}: local final artifact has no byte-identical archive transition`);
        }
      }
    }
    return { valid: issues.length === 0, issues, root, manifest };
  }
  function reconcileResume(localRoot) {
    const initial = verify({ allowUnmanifestedEntryFiles: true });
    if (!initial.valid) throw new Error(initial.issues.join('; '));
    const candidates = localArchiveCandidates(localRoot);
    const expectedMissingTransitions = new Set(
      candidates.map((candidate) => {
        const sha256 = tutorStubResistanceSemanticSha256(fs.readFileSync(candidate.file));
        return tutorStubResistanceSemanticSha256(`${candidate.stage}\0${candidate.logicalPath}\0${sha256}`);
      }),
    );
    const entriesDirectory = path.join(root, 'entries');
    const manifestedTransitions = new Set(initial.manifest.entries.map((entry) => entry.transition_id));
    const orphanTransitions = fs.existsSync(entriesDirectory)
      ? fs
          .readdirSync(entriesDirectory, { withFileTypes: true })
          .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
          .map((entry) => entry.name.slice(0, -'.json'.length))
          .filter((transition) => !manifestedTransitions.has(transition))
      : [];
    if (orphanTransitions.some((transition) => !expectedMissingTransitions.has(transition))) {
      throw new Error('semantic validation archive contains a noncurrent orphan transition');
    }
    for (const candidate of candidates) append(candidate.stage, candidate.logicalPath, candidate.value);
    const reconciled = verify({ localRoot, requireCurrentLocalTransitions: true });
    if (!reconciled.valid) throw new Error(reconciled.issues.join('; '));
  }
  if (resume) {
    const initial = verify({ allowUnmanifestedEntryFiles: true });
    if (!initial.valid) throw new Error(initial.issues.join('; '));
  }
  return { append, verify, reconcileResume, root, manifestPath };
}

function exactJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function caseDirectory(destination, caseId) {
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(caseId)) throw new Error(`unsafe validation case id: ${caseId}`);
  return path.join(destination, 'cases', caseId);
}

function checkpointFile(destination, caseId) {
  return path.join(caseDirectory(destination, caseId), 'checkpoint.json');
}

function persistCheckpoint({ destination, checkpoint, archive, stage, afterLocalCheckpointWrite = null }) {
  const logicalPath = `cases/${checkpoint.case_id}/checkpoint.json`;
  atomicWriteJson(checkpointFile(destination, checkpoint.case_id), checkpoint);
  afterLocalCheckpointWrite?.({ stage, logicalPath, checkpoint });
  archive.append(stage, logicalPath, checkpoint);
}

function checkpointArchiveStage(checkpoint) {
  if (checkpoint.status === 'pending') return 'checkpoint_initialized';
  if (checkpoint.status === 'judge_in_flight') {
    const latestAttempt = Object.values(checkpoint.attempts_by_judge || {})
      .flat()
      .at(-1);
    if (latestAttempt?.status === 'prepared_not_dispatched') return 'checkpoint_prepared';
    if (latestAttempt?.status === 'dispatched') return 'checkpoint_dispatched';
  }
  if (checkpoint.status === 'judge_checkpointed') {
    const outcome = checkpoint.judge_results.at(-1)?.outcome;
    if (outcome === 'recorded_response') return 'checkpoint_returned';
    if (outcome === 'invalid_return') return 'checkpoint_invalid';
    if (outcome === 'transport_failed') return 'checkpoint_transport_failed';
  }
  if (checkpoint.status === 'sealed') {
    if (checkpoint.judge_results.at(-1)?.outcome === 'dispatch_ambiguous_no_recall') {
      return 'checkpoint_dispatch_ambiguous_sealed';
    }
    if (checkpoint.resumed_partial_without_rejudge) return 'checkpoint_partial_sealed';
    return 'checkpoint_sealed';
  }
  throw new Error(`cannot reconcile semantic validation checkpoint archive stage ${checkpoint.status}`);
}

function attemptCount(checkpoints) {
  return checkpoints.reduce(
    (sum, checkpoint) =>
      sum +
      Object.values(checkpoint.attempts_by_judge || {}).reduce((judgeSum, attempts) => judgeSum + attempts.length, 0),
    0,
  );
}

function loadExistingCheckpoints(destination, caseIds) {
  return caseIds.flatMap((caseId) => {
    const file = checkpointFile(destination, caseId);
    return fs.existsSync(file) ? [readJson(file)] : [];
  });
}

function blindCaseBinding(blindedCase, judges, instrument) {
  const prompts = Object.fromEntries(
    judges.map((judge) => [
      judge.id,
      instrument.buildPrompt({
        caseId: blindedCase.case_id,
        source: blindedCase.source,
        publicContext: blindedCase.public_context,
        judge,
      }),
    ]),
  );
  return {
    case_id: blindedCase.case_id,
    source_sha256: tutorStubResistanceSemanticSha256(blindedCase.source),
    public_context_sha256: canonicalSha256(blindedCase.public_context),
    packet_sha256: prompts[judges[0].id].packet_sha256,
    prompt_sha256_by_judge: Object.fromEntries(
      judges.map((judge) => [judge.id, tutorStubResistanceSemanticPromptSha256(prompts[judge.id])]),
    ),
  };
}

function validationRequestBinding(goRequest, loaded) {
  const request = goRequest && typeof goRequest === 'object' && !Array.isArray(goRequest) ? goRequest : null;
  const semantic = request?.semanticAdjudicationValidation;
  const budget = request?.budget;
  const readiness = loaded.registration.executionReadiness;
  const version = Number(loaded.registration.version);
  const revision = semantic?.requestRevision ?? null;
  const expectedType = `prospective_resistance_semantic_adjudication_heldout_validation_v${version}`;
  const budgetKeys = [
    'plannedCases',
    'plannedModelCalls',
    'maximumReservationsPerPlannedCall',
    'maximumPlannedModelAttempts',
    'programmeLedgerBefore',
    'programmeLedgerAfterMaximum',
    'programmeCeiling',
    'retryOrResumeAuthority',
  ];
  if (
    !request ||
    semantic?.type !== expectedType ||
    !budget ||
    !exactJson(Object.keys(budget).sort(), budgetKeys.sort()) ||
    budget.plannedCases !== readiness.plannedCases ||
    budget.plannedModelCalls !== readiness.plannedModelCalls ||
    budget.maximumReservationsPerPlannedCall !== readiness.maximumReservationsPerPlannedCall ||
    budget.maximumPlannedModelAttempts !== readiness.hardValidationReservations ||
    budget.programmeCeiling !== readiness.programmeCeiling ||
    budget.retryOrResumeAuthority !== 'bounded_technical_recovery' ||
    !Number.isInteger(budget.programmeLedgerBefore) ||
    budget.programmeLedgerBefore < readiness.programmeLedgerBefore ||
    budget.programmeLedgerAfterMaximum !== budget.programmeLedgerBefore + readiness.hardValidationReservations ||
    budget.programmeLedgerAfterMaximum > budget.programmeCeiling ||
    (revision === null &&
      (budget.programmeLedgerBefore !== readiness.programmeLedgerBefore ||
        budget.programmeLedgerAfterMaximum !== readiness.programmeLedgerAfterMaximum)) ||
    (version === 3 &&
      revision === 2 &&
      (budget.programmeLedgerBefore !== 661 || budget.programmeLedgerAfterMaximum !== 1141)) ||
    (revision !== null && (!Number.isInteger(revision) || revision < 2))
  ) {
    throw new Error('semantic validation GO request budget does not match the registered execution envelope');
  }
  return {
    revision,
    budget: {
      planned_calls: budget.plannedModelCalls,
      maximum_reservations_per_call: budget.maximumReservationsPerPlannedCall,
      hard_reservation_ceiling: budget.maximumPlannedModelAttempts,
      programme_ledger_before: budget.programmeLedgerBefore,
      programme_ledger_after_maximum: budget.programmeLedgerAfterMaximum,
      programme_ceiling: budget.programmeCeiling,
    },
  };
}

export function buildTutorStubResistanceSemanticValidationPlan({
  sourceCommit,
  sourceTree,
  destination,
  goRequestPath,
  goRequestSha256,
  goRequest,
  loaded = loadTutorStubResistanceSemanticValidation(),
}) {
  if (!/^[0-9a-f]{40}$/u.test(String(sourceCommit || ''))) throw new Error('source commit must be a full SHA-1');
  if (!/^[0-9a-f]{40}$/u.test(String(sourceTree || ''))) throw new Error('source tree must be a full SHA-1');
  if (!path.isAbsolute(String(destination || ''))) throw new Error('validation destination must be absolute');
  if (!String(goRequestPath || '').trim() || !/^[0-9a-f]{64}$/u.test(String(goRequestSha256 || ''))) {
    throw new Error('validation plan requires a digest-bound GO request');
  }
  const judges = loaded.instrument.registration.measurement.judges;
  const instrument = semanticInstrument(loaded);
  const readiness = loaded.registration.executionReadiness;
  const requestBinding = validationRequestBinding(goRequest, loaded);
  const blindedCases = instrument.buildBlindedCases(loaded.corpus.cases);
  const plan = {
    schema: TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_PLAN_SCHEMA,
    status: 'prospective_unlaunched',
    source: { commit: sourceCommit, tree: sourceTree, clean_required: true },
    destination,
    authorization: { go_request_path: goRequestPath, go_request_sha256: goRequestSha256 },
    durable_archive: {
      policy: 'required',
      namespace: 'artifacts/tutor-stub-live/resistance-semantic-validation',
      immutable_transition_entries: true,
      byte_digest_verification: 'sha256_after_each_write',
    },
    registration: {
      path: loaded.registrationPath,
      sha256: loaded.registrationSha256,
    },
    instrument: {
      path: loaded.instrument.path,
      sha256: loaded.instrument.sha256,
      freeze_commit: loaded.registration.instrument.instrumentFreezeCommit,
    },
    heldout: {
      path: loaded.registration.heldout.corpusPath,
      sha256: loaded.corpusSha256,
      cases: readiness.plannedCases,
      gold_in_execution_artifacts: false,
    },
    judges: judges.map((judge) => ({
      id: judge.id,
      model_ref: judge.modelRef,
      provider: judge.provider,
      model: judge.model,
      effort: judge.effort,
      maximum_reservations: 3,
    })),
    budget: requestBinding.budget,
    lifecycle: {
      checkpoint_after_each_judge_response: true,
      technical_recovery_zero_response_cases_only: true,
      partial_case_restart: false,
      valid_case_rerun: false,
      replacement: false,
      outcome_selection: false,
      analyzer_requires_all_cases_sealed: true,
      gold_joined_only_after_seal: true,
    },
    cases: blindedCases.map((blindedCase) => blindCaseBinding(blindedCase, judges, instrument)),
  };
  plan.plan_sha256 = tutorStubResistanceSemanticValidationPlanFingerprint(plan);
  return plan;
}

export function validateTutorStubResistanceSemanticValidationPlan({ plan, expected }) {
  const issues = [];
  if (!exactJson(plan, expected)) issues.push('validation plan does not match deterministic registered plan');
  if (JSON.stringify(plan).includes('"expected"')) issues.push('validation plan contains a gold expected label');
  if (plan?.cases?.length !== 80 || new Set(plan.cases.map((row) => row.case_id)).size !== 80) {
    issues.push('validation plan must bind exactly 80 unique cases');
  }
  return { valid: issues.length === 0, issues };
}

function newCheckpoint({ plan, corpusCase, executionCaseId }) {
  return {
    schema: TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_CHECKPOINT_SCHEMA,
    case_id: executionCaseId,
    plan_sha256: plan.plan_sha256,
    source_sha256: tutorStubResistanceSemanticSha256(corpusCase.source),
    public_context_sha256: canonicalSha256(corpusCase.public_context),
    packet_sha256: plan.cases.find((row) => row.case_id === executionCaseId).packet_sha256,
    status: 'pending',
    attempts_by_judge: {},
    invocation_id_by_judge: {},
    judge_results: [],
    aggregate: null,
    aggregate_sha256: null,
    resumed_partial_without_rejudge: false,
  };
}

function observedRaw(result) {
  return {
    text: result.text,
    provider: result.provider || null,
    model: result.model || null,
    effort: result.effort || result.reasoningEffort || null,
    structured_output: result.structuredOutput === true,
    prohibited_tool_event_count: Number.isInteger(result.prohibitedToolEventCount)
      ? result.prohibitedToolEventCount
      : null,
    prohibited_tool_event_count_observed:
      Object.hasOwn(result, 'prohibitedToolEventCount') && Number.isInteger(result.prohibitedToolEventCount),
    model_attestation_basis: result.modelAttestationBasis || null,
    model_independently_attested: result.modelIndependentlyAttested === true,
  };
}

function wrapRawResponse({ raw, prompt, judge, independentRunId, instrument }) {
  const modelOutput = JSON.parse(String(raw.text || '').trim());
  if (modelOutput.case_id !== prompt.case_id) throw new Error('semantic response case id mismatch');
  return instrument.wrapModelOutput({
    modelOutput,
    prompt,
    judge,
    observedProvider: raw.provider,
    observedModel: raw.model,
    observedEffort: raw.effort,
    independentRunId,
    structuredOutput: raw.structured_output,
    prohibitedToolEvents: raw.prohibited_tool_event_count_observed ? raw.prohibited_tool_event_count : null,
    modelAttestationBasis: raw.model_attestation_basis,
    modelIndependentlyAttested: raw.model_independently_attested,
  });
}

function finalizeCheckpoint({ checkpoint, corpusCase, loaded, prompts, resumedPartial = false }) {
  const responses = checkpoint.judge_results.map((row) => row.record).filter(Boolean);
  const aggregate = semanticInstrument(loaded).adjudicate({
    source: corpusCase.source,
    publicContext: corpusCase.public_context,
    caseId: corpusCase.case_id,
    responses,
    registration: loaded.instrument.registration,
    prompts,
    advisorySignals: [],
  });
  return {
    ...checkpoint,
    status: 'sealed',
    aggregate,
    aggregate_sha256: canonicalSha256(aggregate),
    resumed_partial_without_rejudge: resumedPartial,
  };
}

async function executeJudge({
  destination,
  plan,
  checkpoint,
  corpusCase,
  judge,
  prompt,
  callModel,
  resolveModelRef,
  waitForRetry,
  afterPreparedCheckpoint,
  afterDispatchCheckpoint,
  afterLocalCheckpointWrite,
  archive,
  instrument,
  allowClaudeExitFailureCodeOne,
}) {
  const resolved = resolveModelRef(judge.modelRef);
  if (resolved.provider !== judge.provider || resolved.model !== judge.model) {
    throw new Error(`semantic validation judge route drift for ${judge.id}`);
  }
  const result = {
    judge_id: judge.id,
    role: `tutor_stub_resistance_semantic_${judge.id}`,
    independent_run_id: checkpoint.invocation_id_by_judge[judge.id] || crypto.randomUUID(),
    prompt,
    prompt_sha256: tutorStubResistanceSemanticPromptSha256(prompt),
    attempts: checkpoint.attempts_by_judge[judge.id] || [],
    outcome: null,
    raw_response: null,
    record: null,
    invalid_reason: null,
  };
  checkpoint.invocation_id_by_judge[judge.id] = result.independent_run_id;
  checkpoint.attempts_by_judge[judge.id] = result.attempts;
  for (;;) {
    const prepared = result.attempts.at(-1)?.status === 'prepared_not_dispatched';
    if (!prepared) {
      const checkpoints = loadExistingCheckpoints(
        destination,
        plan.cases.map((row) => row.case_id),
      );
      if (attemptCount(checkpoints) >= plan.budget.hard_reservation_ceiling) {
        throw new Error('semantic validation hard reservation ceiling exhausted');
      }
      if (result.attempts.length >= judge.maximumReservations) {
        result.outcome = 'transport_failed';
        break;
      }
      result.attempts.push({ attempt: result.attempts.length + 1, status: 'prepared_not_dispatched' });
      checkpoint.status = 'judge_in_flight';
      persistCheckpoint({
        destination,
        checkpoint,
        archive,
        stage: 'checkpoint_prepared',
        afterLocalCheckpointWrite,
      });
      await afterPreparedCheckpoint?.({ caseId: corpusCase.case_id, judgeId: judge.id });
    }
    result.attempts.at(-1).status = 'dispatched';
    persistCheckpoint({
      destination,
      checkpoint,
      archive,
      stage: 'checkpoint_dispatched',
      afterLocalCheckpointWrite,
    });
    await afterDispatchCheckpoint?.({ caseId: corpusCase.case_id, judgeId: judge.id });
    try {
      const bridgeResult = await callModel(
        { provider: resolved.provider, model: resolved.model },
        TUTOR_STUB_RESISTANCE_SEMANTIC_SYSTEM_PROMPT,
        JSON.stringify(prompt),
        result.role,
        { effort: judge.effort, outputSchema: instrument.outputSchema },
      );
      result.attempts.at(-1).status = 'returned';
      result.raw_response = observedRaw(bridgeResult);
      try {
        result.record = wrapRawResponse({
          raw: result.raw_response,
          prompt,
          judge,
          independentRunId: result.independent_run_id,
          instrument,
        });
        result.outcome = 'recorded_response';
      } catch (error) {
        result.outcome = 'invalid_return';
        result.invalid_reason = error.message;
      }
      break;
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      result.attempts.at(-1).status = 'transport_failed';
      result.attempts.at(-1).error_code = error?.code || null;
      if (allowClaudeExitFailureCodeOne && error?.code === 'CLI_PROVIDER_EXIT_FAILED') {
        result.attempts.at(-1).exit_code = Number.isInteger(error?.exitCode) ? error.exitCode : null;
        result.attempts.at(-1).stdout_bytes = Number.isInteger(error?.stdoutBytes) ? error.stdoutBytes : null;
        result.attempts.at(-1).stderr_bytes = Number.isInteger(error?.stderrBytes) ? error.stderrBytes : null;
      }
      const retry = tutorStubCliPolicyRetryDecision(error, {
        retryCount: result.attempts.length - 1,
        allowClaudeExitFailureCodeOne,
      });
      if (!retry.retry) {
        result.outcome = 'transport_failed';
        result.invalid_reason =
          allowClaudeExitFailureCodeOne && error?.code === 'CLI_PROVIDER_EXIT_FAILED'
            ? CLAUDE_EXIT_BEFORE_RESPONSE_REASON
            : error?.message || 'semantic validation judge transport failed';
        break;
      }
      await waitForRetry(retry.delay_ms);
    }
  }
  checkpoint.judge_results.push(result);
  checkpoint.status = 'judge_checkpointed';
  persistCheckpoint({
    destination,
    checkpoint,
    archive,
    stage:
      result.outcome === 'recorded_response'
        ? 'checkpoint_returned'
        : result.outcome === 'invalid_return'
          ? 'checkpoint_invalid'
          : 'checkpoint_transport_failed',
    afterLocalCheckpointWrite,
  });
}

function buildValidationSeal({ destination, plan }) {
  const checkpoints = loadExistingCheckpoints(
    destination,
    plan.cases.map((row) => row.case_id),
  );
  if (checkpoints.length !== 80 || checkpoints.some((checkpoint) => checkpoint.status !== 'sealed')) {
    throw new Error('semantic validation cannot seal before all 80 cases are sealed');
  }
  return {
    schema: TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_SEAL_SCHEMA,
    plan_sha256: plan.plan_sha256,
    cases: 80,
    judge_results: checkpoints.reduce((sum, checkpoint) => sum + checkpoint.judge_results.length, 0),
    reservations: attemptCount(checkpoints),
    case_checkpoint_sha256: Object.fromEntries(
      checkpoints.map((checkpoint) => [checkpoint.case_id, canonicalSha256(checkpoint)]),
    ),
    gold_joined: false,
  };
}

function createOrVerifyExactJson(file, value, label) {
  const expected = jsonBytes(value);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, expected, { flag: 'wx' });
    return 'created';
  }
  if (!fs.readFileSync(file).equals(expected)) {
    throw new Error(`${label} exists with noncanonical bytes`);
  }
  return 'verified';
}

export async function runTutorStubResistanceSemanticValidation({
  destination,
  sourceCommit,
  sourceTree,
  goRequestPath,
  goRequestSha256,
  goRequest,
  resume = false,
  callModel,
  resolveModelRef,
  waitForRetry = (delayMs) => waitTutorStubCliPolicyRetryDelay(delayMs),
  afterPreparedCheckpoint = null,
  afterDispatchCheckpoint = null,
  afterJudgeCheckpoint = null,
  afterArchiveEntryWrite = null,
  afterLocalCheckpointWrite = null,
  afterSealLocalWrite = null,
  sourceDirty,
  archiveDir,
  loaded = loadTutorStubResistanceSemanticValidation(),
}) {
  if (sourceDirty !== false) throw new Error('semantic validation execution requires an explicitly clean source tree');
  if (typeof callModel !== 'function' || typeof resolveModelRef !== 'function') {
    throw new Error('semantic validation execution requires explicit model-call and route-resolution dependencies');
  }
  const instrument = semanticInstrument(loaded);
  const plan = buildTutorStubResistanceSemanticValidationPlan({
    sourceCommit,
    sourceTree,
    destination,
    goRequestPath,
    goRequestSha256,
    goRequest,
    loaded,
  });
  const requestBinding = validationRequestBinding(goRequest, loaded);
  const allowClaudeExitFailureCodeOne =
    loaded.registration.version === 3 && requestBinding.revision !== null && requestBinding.revision >= 2;
  const blindedCases = instrument.buildBlindedCases(loaded.corpus.cases);
  const planPath = path.join(destination, 'plan.json');
  const sealPath = path.join(destination, 'seal.json');
  const reportPath = path.join(destination, 'report.json');
  let archive;
  if (!resume) {
    fs.mkdirSync(destination, { recursive: false });
    createJson(planPath, plan);
    archive = openValidationArchive({ archiveDir, plan, afterArchiveEntryWrite });
    archive.append('plan', 'plan.json', plan);
  } else {
    if (!fs.existsSync(planPath)) throw new Error('semantic validation resume requires the original plan');
    const planValidation = validateTutorStubResistanceSemanticValidationPlan({
      plan: readJson(planPath),
      expected: plan,
    });
    if (!planValidation.valid) throw new Error(planValidation.issues.join('; '));
    archive = openValidationArchive({ archiveDir, plan, resume: true, afterArchiveEntryWrite });
    if (fs.existsSync(reportPath) && !fs.existsSync(sealPath)) {
      throw new Error('semantic validation report exists without its required seal');
    }
    archive.reconcileResume(destination);
    if (fs.existsSync(sealPath)) {
      const seal = buildValidationSeal({ destination, plan });
      createOrVerifyExactJson(sealPath, seal, 'semantic validation seal');
      archive.append('seal', 'seal.json', seal);
      const archiveVerification = archive.verify({ localRoot: destination });
      if (!archiveVerification.valid) throw new Error(archiveVerification.issues.join('; '));
      return { plan, seal };
    }
  }
  for (const blindedCase of blindedCases) {
    const corpusCase = instrument.corpusCaseForExecutionId(loaded.corpus.cases, blindedCase.case_id);
    if (!corpusCase) throw new Error(`unknown opaque validation case ${blindedCase.case_id}`);
    const file = checkpointFile(destination, blindedCase.case_id);
    let checkpoint = fs.existsSync(file)
      ? readJson(file)
      : newCheckpoint({ plan, corpusCase, executionCaseId: blindedCase.case_id });
    if (!fs.existsSync(file)) {
      persistCheckpoint({
        destination,
        checkpoint,
        archive,
        stage: 'checkpoint_initialized',
        afterLocalCheckpointWrite,
      });
    } else {
      archive.append(checkpointArchiveStage(checkpoint), `cases/${checkpoint.case_id}/checkpoint.json`, checkpoint);
    }
    if (checkpoint.status === 'sealed') continue;
    const prompts = Object.fromEntries(
      loaded.instrument.registration.measurement.judges.map((judge) => [
        judge.id,
        instrument.buildPrompt({
          caseId: blindedCase.case_id,
          source: corpusCase.source,
          publicContext: corpusCase.public_context,
          judge,
        }),
      ]),
    );
    const ambiguousJudge = loaded.instrument.registration.measurement.judges.find(
      (judge) =>
        checkpoint.attempts_by_judge?.[judge.id]?.at(-1)?.status === 'dispatched' &&
        !checkpoint.judge_results.some((row) => row.judge_id === judge.id),
    );
    if (ambiguousJudge) {
      checkpoint.judge_results.push({
        judge_id: ambiguousJudge.id,
        role: `tutor_stub_resistance_semantic_${ambiguousJudge.id}`,
        independent_run_id: checkpoint.invocation_id_by_judge[ambiguousJudge.id],
        prompt: prompts[ambiguousJudge.id],
        prompt_sha256: tutorStubResistanceSemanticPromptSha256(prompts[ambiguousJudge.id]),
        attempts: checkpoint.attempts_by_judge[ambiguousJudge.id],
        outcome: 'dispatch_ambiguous_no_recall',
        raw_response: null,
        record: null,
        invalid_reason: 'dispatch completed without a preserved response checkpoint; recall is forbidden',
      });
      checkpoint = finalizeCheckpoint({
        checkpoint,
        corpusCase: { ...corpusCase, case_id: blindedCase.case_id },
        loaded,
        prompts,
        resumedPartial: true,
      });
      persistCheckpoint({
        destination,
        checkpoint,
        archive,
        stage: 'checkpoint_dispatch_ambiguous_sealed',
        afterLocalCheckpointWrite,
      });
      continue;
    }
    if (checkpoint.judge_results.some((row) => row.outcome !== 'recorded_response')) {
      checkpoint = finalizeCheckpoint({
        checkpoint,
        corpusCase: { ...corpusCase, case_id: blindedCase.case_id },
        loaded,
        prompts,
        resumedPartial: true,
      });
      persistCheckpoint({
        destination,
        checkpoint,
        archive,
        stage: 'checkpoint_partial_sealed',
        afterLocalCheckpointWrite,
      });
      continue;
    }
    for (const judge of loaded.instrument.registration.measurement.judges) {
      if (checkpoint.judge_results.some((row) => row.judge_id === judge.id)) continue;
      await executeJudge({
        destination,
        plan,
        checkpoint,
        corpusCase: { ...corpusCase, case_id: blindedCase.case_id },
        judge,
        prompt: prompts[judge.id],
        callModel,
        resolveModelRef,
        waitForRetry,
        afterPreparedCheckpoint,
        afterDispatchCheckpoint,
        afterLocalCheckpointWrite,
        archive,
        instrument,
        allowClaudeExitFailureCodeOne: allowClaudeExitFailureCodeOne && judge.provider === 'claude-code',
      });
      await afterJudgeCheckpoint?.({ caseId: blindedCase.case_id, judgeId: judge.id });
    }
    checkpoint = finalizeCheckpoint({
      checkpoint,
      corpusCase: { ...corpusCase, case_id: blindedCase.case_id },
      loaded,
      prompts,
    });
    persistCheckpoint({
      destination,
      checkpoint,
      archive,
      stage: 'checkpoint_sealed',
      afterLocalCheckpointWrite,
    });
  }
  const seal = buildValidationSeal({ destination, plan });
  createOrVerifyExactJson(sealPath, seal, 'semantic validation seal');
  afterSealLocalWrite?.({ sealPath, seal });
  archive.append('seal', 'seal.json', seal);
  const archiveVerification = archive.verify({ localRoot: destination });
  if (!archiveVerification.valid) throw new Error(archiveVerification.issues.join('; '));
  return { plan, seal };
}

function reconstructJudgeResult({ row, corpusCase, judge, expectedPrompt, instrument }) {
  const issues = [];
  if (row.judge_id !== judge.id || row.role !== `tutor_stub_resistance_semantic_${judge.id}`) {
    issues.push('judge identity or role mismatch');
  }
  if (!exactJson(row.prompt, expectedPrompt)) issues.push('blind prompt drifted');
  if (row.prompt_sha256 !== tutorStubResistanceSemanticPromptSha256(expectedPrompt)) {
    issues.push('prompt digest drifted');
  }
  if (!Array.isArray(row.attempts) || row.attempts.length < 1 || row.attempts.length > 3) {
    issues.push('judge attempt envelope is invalid');
  }
  let rebuilt = null;
  if (row.raw_response) {
    try {
      rebuilt = wrapRawResponse({
        raw: row.raw_response,
        prompt: expectedPrompt,
        judge,
        independentRunId: row.independent_run_id,
        instrument,
      });
    } catch {
      if (row.outcome !== 'invalid_return' || row.record !== null) {
        issues.push('invalid returned response disposition is not reproducible');
      }
    }
    if (rebuilt && (!exactJson(rebuilt, row.record) || row.outcome !== 'recorded_response')) {
      issues.push('stored semantic record does not derive from the returned response');
    }
  } else if (!['transport_failed', 'dispatch_ambiguous_no_recall'].includes(row.outcome) || row.record !== null) {
    issues.push('missing response is not a typed transport failure');
  }
  if (row.outcome === 'recorded_response' && !rebuilt) issues.push('recorded response cannot be rebuilt');
  if (!String(row.independent_run_id || '').trim()) issues.push('judge invocation id is missing');
  return { issues, response: rebuilt, prompt: expectedPrompt, corpusCase };
}

export function analyzeTutorStubResistanceSemanticValidation({
  destination,
  expectedSourceCommit,
  expectedSourceTree,
  expectedGoRequestPath,
  expectedGoRequestSha256,
  expectedGoRequest,
  sourceDirty,
  archiveDir,
  allowExistingReport = false,
  loaded = loadTutorStubResistanceSemanticValidation(),
}) {
  const instrument = semanticInstrument(loaded);
  const plan = readJson(path.join(destination, 'plan.json'));
  const expectedPlan = buildTutorStubResistanceSemanticValidationPlan({
    sourceCommit: expectedSourceCommit,
    sourceTree: expectedSourceTree,
    destination,
    goRequestPath: expectedGoRequestPath,
    goRequestSha256: expectedGoRequestSha256,
    goRequest: expectedGoRequest,
    loaded,
  });
  const planValidation = validateTutorStubResistanceSemanticValidationPlan({ plan, expected: expectedPlan });
  if (!planValidation.valid) throw new Error(planValidation.issues.join('; '));
  const requestBinding = validationRequestBinding(expectedGoRequest, loaded);
  if (sourceDirty !== false) throw new Error('semantic validation analysis requires an explicitly clean source tree');
  const seal = readJson(path.join(destination, 'seal.json'));
  const sealKeys = [
    'schema',
    'plan_sha256',
    'cases',
    'judge_results',
    'reservations',
    'case_checkpoint_sha256',
    'gold_joined',
  ];
  if (
    JSON.stringify(Object.keys(seal).sort()) !== JSON.stringify(sealKeys.sort()) ||
    seal.schema !== TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_SEAL_SCHEMA ||
    seal.plan_sha256 !== plan.plan_sha256 ||
    seal.cases !== 80 ||
    seal.gold_joined !== false
  ) {
    throw new Error('semantic validation seal does not bind the registered plan');
  }
  const rootEntries = fs.readdirSync(destination).sort();
  const expectedRootEntries = allowExistingReport
    ? ['cases', 'plan.json', 'report.json', 'seal.json']
    : ['cases', 'plan.json', 'seal.json'];
  if (!exactJson(rootEntries, expectedRootEntries)) {
    throw new Error('semantic validation root file set is not exact or analysis already exists');
  }
  const archive = openValidationArchive({ archiveDir, plan, resume: true });
  const allowedUnmanifestedTransitions = new Set();
  if (allowExistingReport) {
    const reportBytes = fs.readFileSync(path.join(destination, 'report.json'));
    const reportSha256 = tutorStubResistanceSemanticSha256(reportBytes);
    allowedUnmanifestedTransitions.add(tutorStubResistanceSemanticSha256(`report\0report.json\0${reportSha256}`));
  }
  const archiveVerification = archive.verify({
    localRoot: allowExistingReport ? null : destination,
    allowedUnmanifestedTransitions,
  });
  if (!archiveVerification.valid) {
    throw new Error(`semantic validation durable archive invalid: ${archiveVerification.issues.join('; ')}`);
  }
  const caseRoot = path.join(destination, 'cases');
  const directoryCaseIds = fs
    .readdirSync(caseRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const plannedCaseIds = plan.cases.map((row) => row.case_id).sort();
  if (!exactJson(directoryCaseIds, plannedCaseIds)) throw new Error('validation case directory set drifted');
  const responsePairs = {};
  const caseRows = [];
  const allIssues = [];
  const independentRunIds = [];
  const checkpoints = [];
  const blindedCases = instrument.buildBlindedCases(loaded.corpus.cases);
  const blindedCorpusCases = [];
  for (const blindedCase of blindedCases) {
    const corpusCase = instrument.corpusCaseForExecutionId(loaded.corpus.cases, blindedCase.case_id);
    if (!corpusCase) throw new Error(`unknown opaque validation case ${blindedCase.case_id}`);
    const scoredCase = { ...corpusCase, case_id: blindedCase.case_id };
    blindedCorpusCases.push(scoredCase);
    const checkpoint = readJson(checkpointFile(destination, blindedCase.case_id));
    checkpoints.push(checkpoint);
    const checkpointSha256 = canonicalSha256(checkpoint);
    const issues = [];
    const checkpointKeys = [
      'schema',
      'case_id',
      'plan_sha256',
      'source_sha256',
      'public_context_sha256',
      'packet_sha256',
      'status',
      'attempts_by_judge',
      'invocation_id_by_judge',
      'judge_results',
      'aggregate',
      'aggregate_sha256',
      'resumed_partial_without_rejudge',
    ];
    if (!exactJson(Object.keys(checkpoint).sort(), checkpointKeys.sort())) {
      issues.push('case checkpoint keys are not exact');
    }
    const caseEntries = fs.readdirSync(caseDirectory(destination, blindedCase.case_id)).sort();
    if (!exactJson(caseEntries, ['checkpoint.json'])) issues.push('case directory file set is not exact');
    if (
      checkpoint.schema !== TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_CHECKPOINT_SCHEMA ||
      checkpoint.status !== 'sealed' ||
      checkpoint.case_id !== blindedCase.case_id ||
      checkpoint.plan_sha256 !== plan.plan_sha256 ||
      checkpoint.source_sha256 !== tutorStubResistanceSemanticSha256(corpusCase.source) ||
      checkpoint.public_context_sha256 !== canonicalSha256(corpusCase.public_context) ||
      seal.case_checkpoint_sha256?.[blindedCase.case_id] !== checkpointSha256
    ) {
      issues.push('case checkpoint binding or seal digest drifted');
    }
    const judges = loaded.instrument.registration.measurement.judges;
    const ids = checkpoint.judge_results.map((row) => row.judge_id);
    if (
      ids.length < 1 ||
      ids.length > 2 ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !judges.some((j) => j.id === id))
    ) {
      issues.push('case has duplicate, extra, or unregistered judge results');
    }
    if (
      !checkpoint.attempts_by_judge ||
      Object.keys(checkpoint.attempts_by_judge).some((id) => !judges.some((judge) => judge.id === id))
    ) {
      issues.push('case attempt ledger has an unregistered judge');
    }
    for (const row of checkpoint.judge_results) {
      const rowJudge = judges.find((judge) => judge.id === row.judge_id);
      const safeClaudeExitTelemetryAllowed =
        loaded.registration.version === 3 &&
        requestBinding.revision !== null &&
        requestBinding.revision >= 2 &&
        rowJudge?.provider === 'claude-code';
      independentRunIds.push(row.independent_run_id);
      if (checkpoint.invocation_id_by_judge?.[row.judge_id] !== row.independent_run_id) {
        issues.push('judge invocation id does not match the checkpoint ledger');
      }
      const attempts = checkpoint.attempts_by_judge?.[row.judge_id];
      if (!exactJson(attempts, row.attempts)) issues.push('judge result attempt ledger does not match checkpoint');
      for (const [index, attempt] of (Array.isArray(attempts) ? attempts : []).entries()) {
        const keys = Object.keys(attempt).sort();
        const hasSafeExitTelemetry = Object.hasOwn(attempt, 'exit_code');
        const allowed =
          attempt.status === 'transport_failed'
            ? hasSafeExitTelemetry
              ? ['attempt', 'error_code', 'exit_code', 'status', 'stderr_bytes', 'stdout_bytes']
              : ['attempt', 'error_code', 'status']
            : ['attempt', 'status'];
        if (
          !exactJson(keys, allowed.sort()) ||
          attempt.attempt !== index + 1 ||
          !['returned', 'transport_failed', 'dispatched'].includes(attempt.status) ||
          (index < attempts.length - 1 && attempt.status !== 'transport_failed') ||
          (hasSafeExitTelemetry &&
            (!safeClaudeExitTelemetryAllowed ||
              attempt.error_code !== 'CLI_PROVIDER_EXIT_FAILED' ||
              !Number.isInteger(attempt.exit_code) ||
              !Number.isInteger(attempt.stdout_bytes) ||
              attempt.stdout_bytes < 0 ||
              !Number.isInteger(attempt.stderr_bytes) ||
              attempt.stderr_bytes < 0))
        ) {
          issues.push('judge attempt status sequence is invalid');
        }
      }
      const finalStatus = attempts?.at(-1)?.status;
      if (
        (['recorded_response', 'invalid_return'].includes(row.outcome) && finalStatus !== 'returned') ||
        (row.outcome === 'transport_failed' && finalStatus !== 'transport_failed') ||
        (row.outcome === 'dispatch_ambiguous_no_recall' && finalStatus !== 'dispatched')
      ) {
        issues.push('judge result outcome does not match final attempt status');
      }
      if (
        row.outcome === 'transport_failed' &&
        row.attempts.some((attempt) => Object.hasOwn(attempt, 'exit_code')) &&
        row.invalid_reason !== CLAUDE_EXIT_BEFORE_RESPONSE_REASON
      ) {
        issues.push('Claude exit failure reason is not the registered content-free disposition');
      }
    }
    const prompts = {};
    const responses = [];
    responsePairs[blindedCase.case_id] = {};
    for (const judge of judges) {
      const expectedPrompt = instrument.buildPrompt({
        caseId: blindedCase.case_id,
        source: corpusCase.source,
        publicContext: corpusCase.public_context,
        judge,
      });
      prompts[judge.id] = expectedPrompt;
      const stored = checkpoint.judge_results.find((row) => row.judge_id === judge.id);
      if (!stored) continue;
      const rebuilt = reconstructJudgeResult({ row: stored, corpusCase, judge, expectedPrompt, instrument });
      issues.push(...rebuilt.issues);
      if (rebuilt.response) responses.push(rebuilt.response);
      responsePairs[blindedCase.case_id][judge.id] = {
        prompt: expectedPrompt,
        response: rebuilt.response,
      };
    }
    const aggregate = instrument.adjudicate({
      source: corpusCase.source,
      publicContext: corpusCase.public_context,
      caseId: blindedCase.case_id,
      responses,
      registration: loaded.instrument.registration,
      prompts,
      advisorySignals: [],
    });
    if (!exactJson(checkpoint.aggregate, aggregate) || checkpoint.aggregate_sha256 !== canonicalSha256(aggregate)) {
      issues.push('case aggregate does not reproduce from sealed judge records');
    }
    allIssues.push(...issues.map((issue) => `${blindedCase.case_id}: ${issue}`));
    caseRows.push({
      case_id: corpusCase.case_id,
      execution_case_id: blindedCase.case_id,
      expected_label: corpusCase.expected.label,
      observed_label: aggregate.final_label,
      status: aggregate.status,
      judge_results: checkpoint.judge_results.length,
      reservations: checkpoint.judge_results.reduce((sum, row) => sum + row.attempts.length, 0),
      issues,
    });
  }
  if (allIssues.length) throw new Error(`semantic validation trace invalid: ${allIssues.join('; ')}`);
  if (new Set(independentRunIds).size !== independentRunIds.length) {
    throw new Error('semantic validation judge invocation ids are not globally unique');
  }
  const observedReservations = attemptCount(checkpoints);
  const observedJudgeResults = checkpoints.reduce((sum, checkpoint) => sum + checkpoint.judge_results.length, 0);
  if (
    seal.reservations !== observedReservations ||
    seal.judge_results !== observedJudgeResults ||
    Object.keys(seal.case_checkpoint_sha256 || {})
      .sort()
      .join(',') !== plannedCaseIds.join(',')
  ) {
    throw new Error('semantic validation seal counts or checkpoint map drifted');
  }
  const stageCounts = Object.fromEntries(
    [...new Set(archiveVerification.manifest.entries.map((entry) => entry.stage))].map((stage) => [
      stage,
      archiveVerification.manifest.entries.filter((entry) => entry.stage === stage).length,
    ]),
  );
  const archivedJudgeOutcomes =
    Number(stageCounts.checkpoint_returned || 0) +
    Number(stageCounts.checkpoint_invalid || 0) +
    Number(stageCounts.checkpoint_transport_failed || 0) +
    Number(stageCounts.checkpoint_dispatch_ambiguous_sealed || 0);
  const archivedCaseSeals =
    Number(stageCounts.checkpoint_sealed || 0) +
    Number(stageCounts.checkpoint_partial_sealed || 0) +
    Number(stageCounts.checkpoint_dispatch_ambiguous_sealed || 0);
  if (
    stageCounts.plan !== 1 ||
    stageCounts.seal !== 1 ||
    stageCounts.checkpoint_initialized !== 80 ||
    stageCounts.checkpoint_prepared !== observedReservations ||
    stageCounts.checkpoint_dispatched !== observedReservations ||
    archivedJudgeOutcomes !== observedJudgeResults ||
    archivedCaseSeals !== 80
  ) {
    throw new Error('semantic validation durable archive transition inventory drifted');
  }
  const score = instrument.scoreCorpus({
    corpus: { ...loaded.corpus, cases: blindedCorpusCases },
    responsePairs,
    registration: loaded.instrument.registration,
  });
  return {
    schema: TUTOR_STUB_RESISTANCE_SEMANTIC_VALIDATION_REPORT_SCHEMA,
    status: score.status,
    source: plan.source,
    plan_sha256: plan.plan_sha256,
    seal_sha256: canonicalSha256(seal),
    instrument_registration_sha256: loaded.instrument.sha256,
    heldout_corpus_sha256: loaded.corpusSha256,
    cases: caseRows,
    score,
    claim_boundary:
      'Heldout semantic-instrument validation only. Excluded from confirmation outcomes and from any warm/plain, efficacy, learning, transfer, human, or cell claim.',
  };
}

export function writeTutorStubResistanceSemanticValidationReport(options) {
  const reportPath = path.join(options.destination, 'report.json');
  const report = analyzeTutorStubResistanceSemanticValidation({
    ...options,
    allowExistingReport: fs.existsSync(reportPath),
  });
  createOrVerifyExactJson(reportPath, report, 'semantic validation report');
  options.afterReportLocalWrite?.({ reportPath, report });
  const plan = readJson(path.join(options.destination, 'plan.json'));
  const archive = openValidationArchive({
    archiveDir: options.archiveDir,
    plan,
    resume: true,
    afterArchiveEntryWrite: options.afterArchiveEntryWrite,
  });
  archive.append('report', 'report.json', report);
  const archiveVerification = archive.verify({ localRoot: options.destination });
  if (!archiveVerification.valid) throw new Error(archiveVerification.issues.join('; '));
  return report;
}

export default {
  analyzeTutorStubResistanceSemanticValidation,
  buildTutorStubResistanceSemanticValidationPlan,
  runTutorStubResistanceSemanticValidation,
  writeTutorStubResistanceSemanticValidationReport,
};
