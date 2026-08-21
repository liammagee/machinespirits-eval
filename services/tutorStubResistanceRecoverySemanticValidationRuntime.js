import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { resolveTutorStubArtifactArchiveDirectory } from './tutorStubArtifactArchive.js';
import { tutorStubCliPolicyRetryDecision, waitTutorStubCliPolicyRetryDelay } from './tutorStubCliPolicyRetry.js';
import {
  TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_OUTPUT_SCHEMA,
  adjudicateTutorStubResistanceRecoverySemanticJudges,
  buildTutorStubResistanceRecoverySemanticPrompt,
  scoreTutorStubResistanceRecoverySemanticCorpus,
  tutorStubResistanceRecoverySemanticPromptSha256,
  tutorStubResistanceRecoverySemanticSha256,
  wrapTutorStubResistanceRecoverySemanticModelOutput,
} from './tutorStubResistanceRecoverySemanticAdjudication.js';
import {
  buildTutorStubResistanceRecoverySemanticBlindedValidationCases,
  loadTutorStubResistanceRecoverySemanticValidation,
  tutorStubResistanceRecoverySemanticOpaqueCaseId,
} from './tutorStubResistanceRecoverySemanticValidation.js';

export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_SYSTEM_PROMPT =
  'Independently judge only the supplied public dialogue packet under the frozen response schema. Do not use tools, hidden state, lexical heuristics, profile labels, assignments, gold labels, or another judge response. Return only schema-valid JSON.';
export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_PLAN_SCHEMA =
  'machinespirits.tutor-stub.resistance-recovery-semantic-validation-plan.v1';
export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_CHECKPOINT_SCHEMA =
  'machinespirits.tutor-stub.resistance-recovery-semantic-validation-case-checkpoint.v1';
export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_SEAL_SCHEMA =
  'machinespirits.tutor-stub.resistance-recovery-semantic-validation-seal.v1';
export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_REPORT_SCHEMA =
  'machinespirits.tutor-stub.resistance-recovery-semantic-validation-report.v1';

const PACKET_FIELDS = ['trigger', 'intervention', 'prior_post_trigger', 'current_learner'];

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function digest(value) {
  return tutorStubResistanceRecoverySemanticSha256(Buffer.isBuffer(value) ? value : JSON.stringify(canonical(value)));
}

function exact(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function bytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function createOrVerify(file, value, label) {
  const expected = bytes(value);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, expected, { flag: 'wx' });
  else if (!fs.readFileSync(file).equals(expected)) throw new Error(`${label} exists with noncanonical bytes`);
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${crypto.randomUUID()}`;
  fs.writeFileSync(temporary, bytes(value), { flag: 'wx' });
  fs.renameSync(temporary, file);
}

function read(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function packet(row) {
  return Object.fromEntries(PACKET_FIELDS.map((field) => [field, row[field]]));
}

function originalCase(loaded, executionId) {
  return loaded.corpus.cases.find((row) => tutorStubResistanceRecoverySemanticOpaqueCaseId(row) === executionId);
}

function archiveFor({ archiveDir, plan, resume, afterEntry }) {
  const base = resolveTutorStubArtifactArchiveDirectory(archiveDir, { repoRoot: process.cwd() });
  if (!base) throw new Error('outcome semantic validation requires a durable private archive');
  const root = path.join(
    base,
    'artifacts/tutor-stub-live/resistance-recovery-semantic-validation',
    `${plan.authorization.go_request_sha256.slice(0, 16)}-${plan.plan_sha256.slice(0, 16)}`,
  );
  const manifestFile = path.join(root, 'archive-manifest.json');
  if (!resume) {
    fs.mkdirSync(path.dirname(root), { recursive: true });
    fs.mkdirSync(root, { recursive: false });
    createOrVerify(
      manifestFile,
      {
        schema: 'machinespirits.tutor-stub.resistance-recovery-semantic-validation-archive.v1',
        plan_sha256: plan.plan_sha256,
        source: plan.source,
        entries: [],
      },
      'outcome archive manifest',
    );
  }
  if (!fs.existsSync(manifestFile)) throw new Error('outcome semantic validation archive is absent');
  function append(stage, logicalPath, value) {
    const content = bytes(value);
    const sha256 = digest(content);
    const transition = digest(`${stage}\0${logicalPath}\0${sha256}`);
    const relative = `entries/${transition}.json`;
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target)) fs.writeFileSync(target, content, { flag: 'wx' });
    else if (!fs.readFileSync(target).equals(content)) throw new Error('outcome archive transition collision');
    afterEntry?.({ stage, logicalPath, transition, target });
    const manifest = read(manifestFile);
    const existing = manifest.entries.find((entry) => entry.transition === transition);
    if (existing) return;
    manifest.entries.push({
      sequence: manifest.entries.length + 1,
      transition,
      stage,
      logical_path: logicalPath,
      path: relative,
      bytes: content.length,
      sha256,
    });
    atomicWrite(manifestFile, manifest);
  }
  function verify() {
    const manifest = read(manifestFile);
    const issues = manifest.entries.flatMap((entry) => {
      const file = path.join(root, entry.path);
      return !fs.existsSync(file) || digest(fs.readFileSync(file)) !== entry.sha256
        ? [`archive entry ${entry.sequence} is absent or corrupt`]
        : [];
    });
    return { valid: issues.length === 0, issues, manifest };
  }
  return { append, verify };
}

function caseFile(destination, caseId) {
  if (!/^[a-z0-9-]+$/u.test(caseId)) throw new Error('unsafe outcome validation case id');
  return path.join(destination, 'cases', caseId, 'checkpoint.json');
}

function promptsFor(loaded, row) {
  return Object.fromEntries(
    loaded.instrument.measurement.judges.map((judge) => [
      judge.id,
      buildTutorStubResistanceRecoverySemanticPrompt({ caseId: row.case_id, publicPacket: packet(row), judge }),
    ]),
  );
}

export function buildTutorStubResistanceRecoverySemanticValidationPlan({
  sourceCommit,
  sourceTree,
  destination,
  goRequestPath,
  goRequestSha256,
  loaded = loadTutorStubResistanceRecoverySemanticValidation(),
}) {
  if (!/^[0-9a-f]{40}$/u.test(sourceCommit) || !/^[0-9a-f]{40}$/u.test(sourceTree)) {
    throw new Error('outcome validation requires exact source commit and tree');
  }
  if (!path.isAbsolute(destination) || !goRequestPath || !/^[0-9a-f]{64}$/u.test(goRequestSha256)) {
    throw new Error('outcome validation requires absolute destination and digest-bound request');
  }
  const cases = buildTutorStubResistanceRecoverySemanticBlindedValidationCases(loaded.corpus.cases);
  const plan = {
    schema: TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_PLAN_SCHEMA,
    status: 'prospective_unlaunched',
    source: { commit: sourceCommit, tree: sourceTree, clean_required: true },
    destination,
    authorization: { go_request_path: goRequestPath, go_request_sha256: goRequestSha256 },
    durable_archive: { policy: 'required', immutable_transition_entries: true },
    registration: { path: loaded.registrationPath, sha256: loaded.registrationSha256 },
    instrument: { path: loaded.instrumentPath, sha256: loaded.instrumentSha256 },
    heldout: { path: loaded.registration.heldout.corpusPath, sha256: loaded.corpusSha256, cases: 120 },
    judges: loaded.instrument.measurement.judges.map((judge) => ({
      id: judge.id,
      model_ref: judge.modelRef,
      provider: judge.provider,
      model: judge.model,
      effort: judge.effort,
      maximum_reservations: 3,
    })),
    budget: {
      planned_calls: 240,
      hard_reservation_ceiling: 720,
      programme_maximum_after_both_validations: 1531,
      programme_ceiling: 5000,
    },
    lifecycle: {
      preserved_judge_recalled: false,
      never_prepared_peer_may_complete: true,
      dispatched_without_response_recalled: false,
      partial_case_restart: false,
      replacement: false,
      outcome_selection: false,
      gold_joined_only_after_seal: true,
    },
    cases: cases.map((row) => {
      const prompts = promptsFor(loaded, row);
      return {
        case_id: row.case_id,
        packet_sha256: prompts[loaded.instrument.measurement.judges[0].id].packet_sha256,
        prompt_sha256_by_judge: Object.fromEntries(
          loaded.instrument.measurement.judges.map((judge) => [
            judge.id,
            tutorStubResistanceRecoverySemanticPromptSha256(prompts[judge.id]),
          ]),
        ),
      };
    }),
  };
  plan.plan_sha256 = digest(plan);
  return plan;
}

function newCheckpoint(plan, row) {
  return {
    schema: TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_CHECKPOINT_SCHEMA,
    case_id: row.case_id,
    plan_sha256: plan.plan_sha256,
    packet_sha256: plan.cases.find((entry) => entry.case_id === row.case_id).packet_sha256,
    status: 'pending',
    attempts_by_judge: {},
    invocation_id_by_judge: {},
    judge_results: [],
    aggregate: null,
    aggregate_sha256: null,
  };
}

function persist(destination, checkpoint, archive, stage, hook) {
  const logical = `cases/${checkpoint.case_id}/checkpoint.json`;
  atomicWrite(caseFile(destination, checkpoint.case_id), checkpoint);
  hook?.({ stage, checkpoint });
  archive.append(stage, logical, checkpoint);
}

function aggregateCheckpoint(checkpoint, row, loaded, prompts) {
  const aggregate = adjudicateTutorStubResistanceRecoverySemanticJudges({
    caseId: row.case_id,
    publicPacket: packet(row),
    responses: checkpoint.judge_results.map((result) => result.record).filter(Boolean),
    registration: loaded.instrument,
    prompts,
  });
  return { ...checkpoint, status: 'sealed', aggregate, aggregate_sha256: digest(aggregate) };
}

function observed(result) {
  return {
    text: result.text,
    provider: result.provider || null,
    model: result.model || null,
    effort: result.effort || result.reasoningEffort || null,
    structured_output: result.structuredOutput === true,
    prohibited_tool_event_count: Number.isInteger(result.prohibitedToolEventCount)
      ? result.prohibitedToolEventCount
      : null,
    model_attestation_basis: result.modelAttestationBasis || null,
    model_independently_attested: result.modelIndependentlyAttested === true,
  };
}

function wrapRaw({ raw, prompt, judge, independentRunId }) {
  return wrapTutorStubResistanceRecoverySemanticModelOutput({
    modelOutput: JSON.parse(String(raw.text || '').trim()),
    prompt,
    judge,
    observedProvider: raw.provider,
    observedModel: raw.model,
    observedEffort: raw.effort,
    independentRunId,
    structuredOutput: raw.structured_output,
    prohibitedToolEvents: raw.prohibited_tool_event_count,
    modelAttestationBasis: raw.model_attestation_basis,
    modelIndependentlyAttested: raw.model_independently_attested,
  });
}

async function executeJudge({ checkpoint, row, judge, prompt, callModel, resolveModelRef, waitForRetry, persistNow }) {
  const route = resolveModelRef(judge.modelRef);
  if (route.provider !== judge.provider || route.model !== judge.model) throw new Error('outcome judge route drifted');
  const result = {
    judge_id: judge.id,
    independent_run_id: checkpoint.invocation_id_by_judge[judge.id] || crypto.randomUUID(),
    prompt,
    prompt_sha256: tutorStubResistanceRecoverySemanticPromptSha256(prompt),
    attempts: checkpoint.attempts_by_judge[judge.id] || [],
    outcome: null,
    raw_response: null,
    record: null,
    invalid_reason: null,
  };
  checkpoint.invocation_id_by_judge[judge.id] = result.independent_run_id;
  checkpoint.attempts_by_judge[judge.id] = result.attempts;
  while (result.attempts.length < 3) {
    if (result.attempts.at(-1)?.status !== 'prepared_not_dispatched') {
      result.attempts.push({ attempt: result.attempts.length + 1, status: 'prepared_not_dispatched' });
      checkpoint.status = 'judge_in_flight';
      persistNow('checkpoint_prepared');
    }
    result.attempts.at(-1).status = 'dispatched';
    persistNow('checkpoint_dispatched');
    try {
      const response = await callModel(
        { provider: route.provider, model: route.model },
        TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_SYSTEM_PROMPT,
        JSON.stringify(prompt),
        `tutor_stub_resistance_recovery_semantic_${judge.id}`,
        { effort: judge.effort, outputSchema: TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_OUTPUT_SCHEMA },
      );
      result.attempts.at(-1).status = 'returned';
      result.raw_response = observed(response);
      try {
        result.record = wrapRaw({
          raw: result.raw_response,
          prompt,
          judge,
          independentRunId: result.independent_run_id,
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
      const retry = tutorStubCliPolicyRetryDecision(error, { retryCount: result.attempts.length - 1 });
      if (!retry.retry) {
        result.outcome = 'transport_failed';
        result.invalid_reason = error.message;
        break;
      }
      await waitForRetry(retry.delay_ms);
    }
  }
  if (!result.outcome) result.outcome = 'transport_failed';
  checkpoint.judge_results.push(result);
  checkpoint.status = 'judge_checkpointed';
  persistNow(result.outcome === 'recorded_response' ? 'checkpoint_returned' : 'checkpoint_terminal');
}

export async function runTutorStubResistanceRecoverySemanticValidation({
  destination,
  sourceCommit,
  sourceTree,
  goRequestPath,
  goRequestSha256,
  sourceDirty,
  archiveDir,
  resume = false,
  callModel,
  resolveModelRef,
  waitForRetry = waitTutorStubCliPolicyRetryDelay,
  afterArchiveEntryWrite,
  afterLocalCheckpointWrite,
}) {
  if (sourceDirty !== false) throw new Error('outcome validation requires a clean source tree');
  const loaded = loadTutorStubResistanceRecoverySemanticValidation();
  const plan = buildTutorStubResistanceRecoverySemanticValidationPlan({
    sourceCommit,
    sourceTree,
    destination,
    goRequestPath,
    goRequestSha256,
    loaded,
  });
  const planFile = path.join(destination, 'plan.json');
  if (!resume) {
    fs.mkdirSync(destination, { recursive: false });
    createOrVerify(planFile, plan, 'outcome validation plan');
  } else if (!fs.existsSync(planFile) || !exact(read(planFile), plan)) {
    throw new Error('outcome validation resume plan drifted');
  }
  const archive = archiveFor({ archiveDir, plan, resume, afterEntry: afterArchiveEntryWrite });
  archive.append('plan', 'plan.json', plan);
  const cases = buildTutorStubResistanceRecoverySemanticBlindedValidationCases(loaded.corpus.cases);
  for (const blinded of cases) {
    const source = originalCase(loaded, blinded.case_id);
    const row = { ...source, case_id: blinded.case_id };
    const file = caseFile(destination, row.case_id);
    let checkpoint = fs.existsSync(file) ? read(file) : newCheckpoint(plan, row);
    const persistNow = (stage) => persist(destination, checkpoint, archive, stage, afterLocalCheckpointWrite);
    if (!fs.existsSync(file)) persistNow('checkpoint_initialized');
    if (checkpoint.status === 'sealed') continue;
    const prompts = promptsFor(loaded, row);
    const ambiguous = loaded.instrument.measurement.judges.find(
      (judge) =>
        checkpoint.attempts_by_judge[judge.id]?.at(-1)?.status === 'dispatched' &&
        !checkpoint.judge_results.some((result) => result.judge_id === judge.id),
    );
    if (ambiguous) {
      checkpoint.judge_results.push({
        judge_id: ambiguous.id,
        independent_run_id: checkpoint.invocation_id_by_judge[ambiguous.id],
        prompt: prompts[ambiguous.id],
        prompt_sha256: tutorStubResistanceRecoverySemanticPromptSha256(prompts[ambiguous.id]),
        attempts: checkpoint.attempts_by_judge[ambiguous.id],
        outcome: 'dispatch_ambiguous_no_recall',
        raw_response: null,
        record: null,
        invalid_reason: 'dispatched response was not durably recorded; recall is forbidden',
      });
    }
    if (!ambiguous && checkpoint.judge_results.every((result) => result.outcome === 'recorded_response')) {
      for (const judge of loaded.instrument.measurement.judges) {
        if (checkpoint.judge_results.some((result) => result.judge_id === judge.id)) continue;
        await executeJudge({
          checkpoint,
          row,
          judge,
          prompt: prompts[judge.id],
          callModel,
          resolveModelRef,
          waitForRetry,
          persistNow,
        });
        if (checkpoint.judge_results.at(-1).outcome !== 'recorded_response') break;
      }
    }
    checkpoint = aggregateCheckpoint(checkpoint, row, loaded, prompts);
    persist(destination, checkpoint, archive, 'checkpoint_sealed', afterLocalCheckpointWrite);
  }
  const checkpoints = cases.map((row) => read(caseFile(destination, row.case_id)));
  const seal = {
    schema: TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_SEAL_SCHEMA,
    plan_sha256: plan.plan_sha256,
    cases: 120,
    judge_results: checkpoints.reduce((sum, row) => sum + row.judge_results.length, 0),
    reservations: checkpoints.reduce((sum, row) => sum + Object.values(row.attempts_by_judge).flat().length, 0),
    case_checkpoint_sha256: Object.fromEntries(checkpoints.map((row) => [row.case_id, digest(row)])),
    gold_joined: false,
  };
  createOrVerify(path.join(destination, 'seal.json'), seal, 'outcome validation seal');
  archive.append('seal', 'seal.json', seal);
  const verified = archive.verify();
  if (!verified.valid) throw new Error(verified.issues.join('; '));
  return { plan, seal };
}

export function analyzeTutorStubResistanceRecoverySemanticValidation({
  destination,
  expectedSourceCommit,
  expectedSourceTree,
  expectedGoRequestPath,
  expectedGoRequestSha256,
  sourceDirty,
  archiveDir,
  allowExistingReport = false,
}) {
  if (sourceDirty !== false) throw new Error('outcome validation analysis requires a clean source tree');
  const loaded = loadTutorStubResistanceRecoverySemanticValidation();
  const expectedPlan = buildTutorStubResistanceRecoverySemanticValidationPlan({
    sourceCommit: expectedSourceCommit,
    sourceTree: expectedSourceTree,
    destination,
    goRequestPath: expectedGoRequestPath,
    goRequestSha256: expectedGoRequestSha256,
    loaded,
  });
  if (!exact(read(path.join(destination, 'plan.json')), expectedPlan)) throw new Error('outcome plan drifted');
  const rootEntries = fs.readdirSync(destination).sort();
  const expectedRoot = allowExistingReport
    ? ['cases', 'plan.json', 'report.json', 'seal.json']
    : ['cases', 'plan.json', 'seal.json'];
  if (!exact(rootEntries, expectedRoot)) throw new Error('outcome validation root artifact set drifted');
  const seal = read(path.join(destination, 'seal.json'));
  if (
    seal.schema !== TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_SEAL_SCHEMA ||
    seal.plan_sha256 !== expectedPlan.plan_sha256 ||
    seal.cases !== 120 ||
    seal.gold_joined !== false ||
    Object.keys(seal.case_checkpoint_sha256 || {}).length !== 120
  ) {
    throw new Error('outcome validation seal drifted');
  }
  const archive = archiveFor({ archiveDir, plan: expectedPlan, resume: true });
  const archiveVerification = archive.verify();
  if (!archiveVerification.valid) throw new Error(archiveVerification.issues.join('; '));
  const responsePairs = {};
  const scoredCases = [];
  const runIds = [];
  for (const blinded of buildTutorStubResistanceRecoverySemanticBlindedValidationCases(loaded.corpus.cases)) {
    const original = originalCase(loaded, blinded.case_id);
    const row = { ...original, case_id: blinded.case_id };
    scoredCases.push(row);
    const checkpoint = read(caseFile(destination, blinded.case_id));
    if (
      checkpoint.schema !== TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_CHECKPOINT_SCHEMA ||
      checkpoint.status !== 'sealed' ||
      checkpoint.plan_sha256 !== expectedPlan.plan_sha256 ||
      seal.case_checkpoint_sha256[blinded.case_id] !== digest(checkpoint) ||
      !exact(fs.readdirSync(path.dirname(caseFile(destination, blinded.case_id))).sort(), ['checkpoint.json'])
    ) {
      throw new Error('outcome validation checkpoint or sealed digest drifted');
    }
    const prompts = promptsFor(loaded, row);
    const responses = [];
    responsePairs[row.case_id] = {};
    for (const judge of loaded.instrument.measurement.judges) {
      const stored = checkpoint.judge_results.find((result) => result.judge_id === judge.id);
      if (!stored) continue;
      runIds.push(stored.independent_run_id);
      let rebuilt = null;
      if (stored.raw_response) {
        try {
          rebuilt = wrapRaw({
            raw: stored.raw_response,
            prompt: prompts[judge.id],
            judge,
            independentRunId: stored.independent_run_id,
          });
        } catch {
          if (stored.outcome !== 'invalid_return') throw new Error('outcome invalid return disposition drifted');
        }
      }
      if (rebuilt && (!exact(rebuilt, stored.record) || stored.outcome !== 'recorded_response')) {
        throw new Error('outcome stored record does not derive from raw model response');
      }
      if (rebuilt) responses.push(rebuilt);
      responsePairs[row.case_id][judge.id] = { prompt: prompts[judge.id], response: rebuilt };
    }
    const aggregate = adjudicateTutorStubResistanceRecoverySemanticJudges({
      caseId: row.case_id,
      publicPacket: packet(row),
      responses,
      registration: loaded.instrument,
      prompts,
    });
    if (!exact(aggregate, checkpoint.aggregate) || digest(aggregate) !== checkpoint.aggregate_sha256) {
      throw new Error('outcome aggregate does not reproduce from persisted judge records');
    }
  }
  if (new Set(runIds).size !== runIds.length) throw new Error('outcome judge invocation IDs are not globally unique');
  const checkpoints = buildTutorStubResistanceRecoverySemanticBlindedValidationCases(loaded.corpus.cases).map((row) =>
    read(caseFile(destination, row.case_id)),
  );
  const reservations = checkpoints.reduce((sum, row) => sum + Object.values(row.attempts_by_judge).flat().length, 0);
  const judgeResults = checkpoints.reduce((sum, row) => sum + row.judge_results.length, 0);
  if (seal.reservations !== reservations || seal.judge_results !== judgeResults || reservations > 720) {
    throw new Error('outcome validation seal accounting drifted');
  }
  const score = scoreTutorStubResistanceRecoverySemanticCorpus({
    corpus: { ...loaded.corpus, cases: scoredCases },
    responsePairs,
    registration: loaded.instrument,
  });
  return {
    schema: TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_VALIDATION_REPORT_SCHEMA,
    status: score.status,
    instrument_registration_sha256: loaded.instrumentSha256,
    heldout_corpus_sha256: loaded.corpusSha256,
    score,
    claim_boundary:
      'Outcome-and-treatment-fidelity instrument validation only; excluded from confirmation outcomes and all efficacy claims.',
  };
}

export function writeTutorStubResistanceRecoverySemanticValidationReport(options) {
  const reportFile = path.join(options.destination, 'report.json');
  const report = analyzeTutorStubResistanceRecoverySemanticValidation({
    ...options,
    allowExistingReport: fs.existsSync(reportFile),
  });
  createOrVerify(reportFile, report, 'outcome validation report');
  options.afterReportLocalWrite?.({ reportFile, report });
  const plan = read(path.join(options.destination, 'plan.json'));
  const archive = archiveFor({
    archiveDir: options.archiveDir,
    plan,
    resume: true,
    afterEntry: options.afterArchiveEntryWrite,
  });
  archive.append('report', 'report.json', report);
  const verified = archive.verify();
  if (!verified.valid) throw new Error(verified.issues.join('; '));
  return report;
}

export default {
  analyzeTutorStubResistanceRecoverySemanticValidation,
  buildTutorStubResistanceRecoverySemanticValidationPlan,
  runTutorStubResistanceRecoverySemanticValidation,
  writeTutorStubResistanceRecoverySemanticValidationReport,
};
