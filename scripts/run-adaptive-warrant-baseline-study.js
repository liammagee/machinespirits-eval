#!/usr/bin/env node

/**
 * Paired-seed baseline study for the explicit adaptive warrant gate.
 *
 * Design authority:
 *   docs/adaptation-refinement/baseline-comparison-design.md
 *
 * Conditions hold the tutor-stub pipeline, dynamic register policy, world,
 * models, learner profile, fixed eight-turn horizon, and run seed constant.
 * Only the warrant-gate mode changes: off, observe, or active.
 *
 * Live usage requires an explicit --launch-approved flag. Mechanism validation
 * additionally requires a digest-bound --launch-authorization artifact emitted
 * from a dry run. The default is the predeclared n=5 pilot; --runs 10 is the
 * full study.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';

import { deriveAdaptiveWarrantShadow } from './derive-adaptive-warrant-shadow.js';
import { ADAPTIVE_WARRANT_ACTION_FAMILY_CONTRACTS } from '../services/adaptiveWarrantActionContracts.js';
import {
  assessAdaptiveWarrantConfigurationTransition,
  assessAdaptiveWarrantSelectorApplicationAudit,
  changedAdaptiveWarrantTopLevelFields,
  hashAdaptiveWarrantResponseConfiguration,
} from '../services/adaptiveWarrantDeliveryContract.js';
import { buildAdaptiveWarrantObligationDirective } from '../services/adaptiveWarrantPolicy.js';
import {
  adaptiveWarrantStudyCliGuardEnvironment,
  adaptiveWarrantStudyEnvironmentContract,
  buildAdaptiveWarrantStudyEnvironment,
  collectAdaptiveWarrantStudyCliContract,
  collectAdaptiveWarrantStudyRuntimeResourcePaths,
  compareAdaptiveWarrantStudyPlans,
  compareStableAdaptiveWarrantDecisions,
  fingerprintAdaptiveWarrantStudyPlan,
  verifyAdaptiveWarrantStudyChildEvidence,
} from '../services/adaptiveWarrantStudyIntegrity.js';
import { collectTutorPrBenchmarkReachablePaths } from '../services/tutorStubPrBenchmarkHook.js';
import {
  ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS,
  ADAPTIVE_WARRANT_DIVERGENCE_INTERPRETATIONS,
  ADAPTIVE_WARRANT_DIVERGENCE_MAGNITUDES,
} from '../services/adaptiveWarrantDivergence.js';

export const ADAPTIVE_WARRANT_BASELINE_STUDY_SCHEMA = 'machinespirits.adaptation-refinement.baseline-study.v1';
export const ADAPTIVE_WARRANT_BASELINE_RESULT_SCHEMA = 'machinespirits.adaptation-refinement.baseline-study-results.v1';
export const ADAPTIVE_WARRANT_ANNOTATION_SCHEMA = 'machinespirits.adaptation-refinement.warrant-annotation-corpus.v4';
export const ADAPTIVE_WARRANT_ANNOTATION_SCORE_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-annotation-scores.v4';
const ADAPTIVE_WARRANT_ANNOTATION_RESPONSE_V3_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-annotation-response.v3';
export const ADAPTIVE_WARRANT_ANNOTATION_RESPONSE_V4_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-annotation-response.v4';
export const ADAPTIVE_WARRANT_ANNOTATION_MIN_NOTE_CHARACTERS = 24;
export const ADAPTIVE_WARRANT_LAUNCH_AUTHORIZATION_REQUEST_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-study-launch-authorization-request.v1';
export const ADAPTIVE_WARRANT_LAUNCH_AUTHORIZATION_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-study-launch-authorization.v1';
const ADAPTIVE_WARRANT_LAUNCH_CONTRACT_SCHEMA = 'machinespirits.adaptation-refinement.warrant-study-launch-contract.v1';
const ADAPTIVE_WARRANT_LAUNCH_AUTHORIZATION_FIELDS = Object.freeze([
  'approval_digest',
  'approved',
  'approved_at',
  'approved_by',
  'approved_child_policy_sha256',
  'approved_destinations',
  'approved_git_commit',
  'approved_source_provenance_sha256',
  'approved_study_plan_execution_sha256',
  'private_payload_scope_sha256',
  'schema',
]);

export const ADAPTIVE_WARRANT_DECISION_GATE = Object.freeze({
  schema: 'machinespirits.adaptation-refinement.warrant-decision-gate.v1',
  minimum_raw_annotator_agreement: 0.8,
  minimum_scored_consensus_cases: 12,
  minimum_consensus_positive_cases: 2,
  minimum_consensus_negative_cases: 6,
  minimum_precision: 0.7,
  minimum_recall: 0.7,
  minimum_accuracy: 0.75,
  minimum_transition_consensus_cases: 2,
  minimum_transition_accuracy: 0.7,
  minimum_diligent_consensus_negative_cases: 1,
  maximum_diligent_false_positive_rate: 0.25,
  required_live_shadow_agreement: 1,
  minimum_mechanism_hard_consensus_rate: 0.75,
  minimum_mechanism_consensus_positive_cases: 12,
  minimum_mechanism_consensus_negative_cases: 24,
  minimum_mechanism_transition_consensus_cases: 10,
  minimum_result_request_cases: 8,
  minimum_proposed_test_cases: 8,
  minimum_request_proposal_macro_f1: 0.8,
  minimum_obligation_lifecycle_accuracy: 0.8,
  minimum_obligation_persistence_cases: 8,
  minimum_obligation_resolution_cases: 6,
  maximum_proposed_test_false_obligation_rate: 0.1,
  minimum_inquiry_complete_cases: 8,
  minimum_inquiry_incomplete_cases: 12,
  minimum_inquiry_completion_precision: 0.9,
  minimum_inquiry_completion_recall: 0.75,
  minimum_commitment_transition_accuracy: 0.75,
  minimum_candidate_override_accuracy: 0.75,
  minimum_primary_warrant_basis_accuracy: 0.75,
  maximum_closure_safety_violations: 0,
  minimum_structured_parity_comparisons: 1,
  minimum_structured_parity_comparisons_per_mode: 1,
  maximum_structured_parity_mismatches: 0,
  minimum_divergence_dimension_consensus_rate: 0.75,
  minimum_divergence_nonaligned_cases_per_dimension: 2,
  minimum_divergence_interpretation_macro_f1: 0.7,
  minimum_divergence_magnitude_accuracy: 0.7,
  minimum_divergence_persistence_accuracy: 0.7,
  minimum_divergence_joint_accuracy: 0.65,
});

const ANNOTATION_ACTION_FAMILIES = Object.freeze(Object.keys(ADAPTIVE_WARRANT_ACTION_FAMILY_CONTRACTS));
const ANNOTATION_SPEECH_ACTS = Object.freeze([
  'tutor_directed_public_result_request',
  'learner_proposed_test',
  'criterion_question',
  'tutor_selection_request',
  'learner_record_entry_request',
  'withdrawal',
  'transfer_to_learner',
  'other',
  'uncertain',
]);
const ANNOTATION_OBLIGATION_STATES = Object.freeze([
  'none',
  'open',
  'overdue',
  'deferred',
  'satisfied',
  'withdrawn_or_transferred',
  'uncertain',
]);
const ANNOTATION_INQUIRY_STATES = Object.freeze(['complete', 'incomplete', 'uncertain']);
const ANNOTATION_WARRANT_BASES = Object.freeze([
  'immediate_repair',
  'public_obligation',
  'inquiry_completion',
  'candidate_safety',
  'action_contract',
  'register_or_accumulated_trouble',
  'none',
  'uncertain',
]);
const V3_ANNOTATION_RESPONSE_FIELDS = Object.freeze([
  'schema',
  'study_id',
  'corpus_sha256',
  'annotator_id',
  'annotation_run_id',
  'cases',
]);
const V3_ANNOTATION_CASE_FIELDS = Object.freeze([
  'sample_id',
  'speech_act',
  'open_obligation_source_turns',
  'obligation_state',
  'inquiry_state',
  'commitment_transition_warranted',
  'current_candidate_override_required',
  'primary_warrant_basis',
  'recommended_action_family',
  'note',
]);
const V3_ANNOTATION_CASE_SCALAR_FIELDS = Object.freeze(
  V3_ANNOTATION_CASE_FIELDS.filter((field) => field !== 'open_obligation_source_turns'),
);
const V4_ANNOTATION_CASE_FIELDS = Object.freeze([...V3_ANNOTATION_CASE_FIELDS, 'divergence_by_dimension']);
const V4_ANNOTATION_CASE_SCALAR_FIELDS = Object.freeze(
  V3_ANNOTATION_CASE_SCALAR_FIELDS,
);
const V4_DIVERGENCE_FIELDS = Object.freeze([
  'interpretation',
  'magnitude',
  'persistence',
  'note',
]);
const ANNOTATION_DIVERGENCE_INTERPRETATIONS = Object.freeze([
  ...ADAPTIVE_WARRANT_DIVERGENCE_INTERPRETATIONS,
  'uncertain',
]);
const ANNOTATION_DIVERGENCE_MAGNITUDES = Object.freeze([
  ...ADAPTIVE_WARRANT_DIVERGENCE_MAGNITUDES,
  'uncertain',
]);
const ANNOTATION_DIVERGENCE_PERSISTENCE = Object.freeze([
  'none',
  'single_turn',
  'sustained',
  'uncertain',
]);

export const STUDY_CONDITIONS = Object.freeze([
  { id: 'baseline', warrantGateMode: 'off' },
  { id: 'instrumented', warrantGateMode: 'observe' },
  { id: 'intervening', warrantGateMode: 'active' },
]);
export const STUDY_PROFILES = Object.freeze(['low_agency', 'diligent', 'affective_resistant']);
export const MECHANISM_VALIDATION_WORLDS = Object.freeze(['world_022_foxtrot_jukebox', 'world_028_larkspur_fridge']);
export const MECHANISM_VALIDATION_PROFILES = Object.freeze([
  'diligent',
  'low_agency',
  'answer_seeking',
  'counterexample_hunter',
  'goalpost_shifter',
  'fast_learner',
]);
export const MECHANISM_VALIDATION_CONDITIONS = Object.freeze([
  { id: 'instrumented', warrantGateMode: 'observe' },
  { id: 'intervening', warrantGateMode: 'active' },
]);
export const MECHANISM_VALIDATION_EXCLUDED_CORPORA = Object.freeze([
  '.tutor-stub-auto-eval/adaptive-warrant-baseline-pilot-v2-live-2026-08-10/annotation-sample.blinded.json',
  '.tutor-stub-auto-eval/adaptive-warrant-baseline-pilot-v2-live-2026-08-10/validation-sample.blinded.json',
  '.tutor-stub-auto-eval/adaptive-warrant-contract-validation-v1-live-2026-08-10/annotation-sample.blinded.json',
]);
const DEFAULT_MODEL = 'codex.gpt-5.6-luna';
export const ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC = Object.freeze({
  worlds: MECHANISM_VALIDATION_WORLDS,
  profiles: MECHANISM_VALIDATION_PROFILES,
  conditions: MECHANISM_VALIDATION_CONDITIONS,
  runs: 1,
  masterSeed: 401,
  horizon: 8,
  models: Object.freeze({
    tutor: DEFAULT_MODEL,
    learner_analysis: DEFAULT_MODEL,
    automated_learner: DEFAULT_MODEL,
  }),
  annotationConditions: Object.freeze(['instrumented']),
  annotationAllDecisions: true,
  excludedCorpora: MECHANISM_VALIDATION_EXCLUDED_CORPORA,
});

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const DEFAULT_HORIZON = 8;
const MECHANISM_MODEL_CALL_BUDGET_PER_DIALOGUE = 64;
const LEARNER_ANALYSIS_PROMPT_PROFILE = 'compact_v1';
const SOURCE_FILES = Object.freeze([
  'docs/adaptation-refinement/baseline-comparison-design.md',
  'docs/adaptation-refinement/gold-annotations-first-corpus.md',
  'docs/adaptation-refinement/normative-adaptive-dialogue-architecture.md',
  'docs/adaptation-refinement/README_adaptation-design-session.md',
  'docs/adaptation-refinement/semantic-audit-and-shadow-notes.md',
  'docs/adaptation-refinement/remaining-next-steps.md',
  'docs/adaptation-refinement/2026-08-09_living-research-log.md',
  'config/drama-derivation/world-005-marrick.yaml',
  'config/drama-derivation/world-022-foxtrot-jukebox.yaml',
  'config/drama-derivation/world-028-larkspur-fridge.yaml',
  'config/engagement-registers.yaml',
  'config/stability/baseline-v0.7.0.json',
  'scripts/prepare-adaptive-warrant-annotation-batches.js',
  'scripts/run-adaptive-warrant-baseline-study.js',
  'scripts/derive-adaptive-warrant-shadow.js',
  'scripts/run-tutor-stub-auto-eval.js',
  'scripts/tutor-stub.js',
  'scripts/tutor-stub-learner-profile-contracts.js',
  'services/adaptiveWarrantGateCore.js',
  'services/adaptiveWarrantActionContracts.js',
  'services/adaptiveWarrantInquiryCompletion.js',
  'services/adaptiveWarrantPolicy.js',
  'services/adaptiveWarrantPublicObligationLedger.js',
  'services/tutorStubPromptAudit.js',
  'services/tutorStubPublicLearnerAnalysis.js',
  'services/tutorStubResponseConfiguration.js',
  'services/tutorStubDialogueClosure.js',
  'services/tutorStubTurnProgressionContract.js',
  'services/tutorStubFirstDraftContract.js',
  'services/tutorStubGuardDisposition.js',
  'services/tutorStubInteractiveLearnerRuntime.js',
  'services/tutorStubSessionOrchestration.js',
  'services/tutorStubTutorTurnPreparation.js',
  'services/tutorStubWarrantGate.js',
  'services/tutorStubResponseConfigurationSelectionRuntime.js',
  'services/tutorStubTurnOrchestration.js',
  'tests/adaptiveWarrantAnnotationCollection.test.js',
  'tests/adaptiveWarrantBaselineStudy.test.js',
  'tests/adaptiveWarrantStudyIntegrity.test.js',
  'tests/adaptiveStateBenchmarkIntegrity.test.js',
  'tests/adaptiveWarrantGate.test.js',
  'tests/tutorStubFirstDraftContract.test.js',
  'tests/tutorStubAutoEvalEvidence.test.js',
  'tests/tutorStubGuardAccounting.test.js',
  'tests/tutorStubGuardDisposition.test.js',
  'tests/tutorStubLearnerAnalysisRuntime.test.js',
  'tests/tutorStubPointOfActionCoaching.test.js',
  'tests/tutorStubReleasePacing.test.js',
  'tests/tutorStubResponseConfigurationPresentation.test.js',
  'tests/tutorStubTurnProgressionContract.test.js',
  'tests/tutorStubTypedActionRestoration.test.js',
  'services/__tests__/tutorStubDiagnosticCollection.test.js',
  'services/__tests__/tutorStubDialogueClosure.test.js',
  'services/__tests__/tutorStubGuardDisposition.test.js',
]);

const SOURCE_IMPORT_ROOTS = Object.freeze([
  'scripts/run-adaptive-warrant-baseline-study.js',
  'scripts/derive-adaptive-warrant-shadow.js',
  'scripts/run-tutor-stub-auto-eval.js',
  'scripts/tutor-stub.js',
]);

function positiveInt(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/gu, '-');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalJsonValue(value[key])]),
  );
}

function canonicalJsonSha256(value) {
  return sha256(JSON.stringify(canonicalJsonValue(value)));
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonl(filePath) {
  const rows = [];
  for (const [index, line] of fs.readFileSync(filePath, 'utf8').split('\n').entries()) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch (error) {
      throw new Error(`Invalid JSONL at ${filePath}:${index + 1}: ${error.message}`);
    }
  }
  return rows;
}

function gitValue(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

export function collectAdaptiveWarrantStudySourceFiles() {
  const reachable = collectTutorPrBenchmarkReachablePaths({
    root: ROOT,
    entryPaths: SOURCE_IMPORT_ROOTS,
  });
  const runtimeResources = collectAdaptiveWarrantStudyRuntimeResourcePaths({ repoRoot: ROOT });
  return [...new Set([...SOURCE_FILES, ...reachable, ...runtimeResources])].sort();
}

export function adaptiveWarrantStudySourceFingerprint() {
  const sourceFiles = collectAdaptiveWarrantStudySourceFiles();
  const childPolicyFiles = collectTutorPrBenchmarkReachablePaths({
    root: ROOT,
    entryPaths: ['scripts/tutor-stub.js'],
  });
  const files = Object.fromEntries(
    sourceFiles.map((relative) => {
      const absolute = path.join(ROOT, relative);
      return [relative, fs.existsSync(absolute) ? fileSha256(absolute) : null];
    }),
  );
  const gitCommit = gitValue(['rev-parse', 'HEAD']);
  const gitBranch = gitValue(['branch', '--show-current']);
  const gitStatus = gitValue(['status', '--short']);
  if (gitCommit === null || gitStatus === null) {
    throw new Error('could not capture the Git commit and worktree status for study provenance');
  }
  const childPolicySha256 = canonicalJsonSha256(
    [...new Set(childPolicyFiles)]
      .sort()
      .map((relative) => ({ path: relative, sha256: fileSha256(path.join(ROOT, relative)) })),
  );
  return {
    gitCommit,
    gitBranch,
    gitStatus,
    sourceFileCount: sourceFiles.length,
    dependencyPolicy: {
      explicitAuthoritiesAndResources: true,
      recursiveStaticLocalImports: true,
      importRoots: [...SOURCE_IMPORT_ROOTS],
    },
    childPolicySha256,
    files,
    combinedSha256: sha256(JSON.stringify(files)),
  };
}

const ADAPTIVE_WARRANT_PRIVATE_PAYLOAD_SCOPE = Object.freeze({
  classification: 'unpublished_private_research_prompt_payload',
  transmitted: Object.freeze([
    'repository-authored speaking-tutor, learner-analysis, simulated-learner, and bounded recovery system or role instructions',
    'public world situation, question, rules, evidence, and dialogue history',
    'public staged fact arrays and public premise identifiers required by learner analysis',
    'current public learner or tutor candidate text',
    'bounded unpublished tutor-action and response-configuration instructions',
    'public-only learner-DAG preflight, prior public learner record, and compact public dialogue state',
    'behavior-only simulated-learner profile and public conversation',
    'role-specific output schemas and parsing constraints',
    'guard issue classes plus the compact public packet and minimal instructions required for one bounded recovery call',
    'generated model output returned to the local runtime for response auditing',
  ]),
  excluded: Object.freeze([
    'concealed answer',
    'future evidence identities or content',
    'private proof paths or planner-only premise identifiers',
    'annotation private key or either annotator response',
    'measurement targets inside the simulated-learner prompt',
    'repository files, Git metadata, source closure contents, or source-control credentials',
    'API keys, login tokens, credentials, or credential values inserted into prompts',
    'human-subject records or human-participant dialogue data',
    'complete technical traces, evaluator scores, consensus scores, or precision and recall artifacts',
    'the rejected tutor draft in a recovery prompt',
  ]),
  local_only_artifacts: Object.freeze([
    'repository and Git provenance closure',
    'complete technical traces',
    'annotation private key',
    'independent annotation responses',
    'consensus and precision/recall score artifacts',
    'measurement-target and scorer configuration',
  ]),
});

function modelDestination(modelRef) {
  const provider = oneLine(modelRef).split('.')[0] || 'unknown';
  const destinations = {
    codex: 'OpenAI Codex CLI (ChatGPT-account route)',
    openai: 'OpenAI API',
    openrouter: 'OpenRouter API',
    'claude-code': 'Anthropic Claude Code CLI',
    claude: 'Anthropic Claude CLI',
  };
  return {
    provider,
    destination: destinations[provider] || `${provider} model route`,
  };
}

function relativeAuthorizationPath(filePath) {
  const relative = path.relative(ROOT, filePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : filePath;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value, expectedKeys) {
  return isPlainObject(value) && isDeepStrictEqual(Object.keys(value).sort(), [...expectedKeys].sort());
}

function isLowerHex(value, length) {
  return typeof value === 'string' && new RegExp(`^[0-9a-f]{${length}}$`, 'u').test(value);
}

function isCanonicalUtcIsoTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function isStrictNonemptyString(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    ![...value].some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint <= 0x1f || codePoint === 0x7f;
    })
  );
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function buildAdaptiveWarrantLaunchAuthorizationRequest(plan) {
  const config = plan?.config || {};
  const studyPlanIdentity = fingerprintAdaptiveWarrantStudyPlan(plan, { ignoreDryRun: true });
  const routes = [
    ['speaking_tutor', config.model],
    ['learner_analysis', config.analysisModel],
    ['automated_learner', config.learnerModel],
  ].map(([role, modelRef]) => ({ role, model_ref: modelRef, ...modelDestination(modelRef) }));
  const destinations = [...new Set(routes.map((route) => route.destination))].sort();
  const excludedCorpora = (config.excludedAnnotationCorpora || []).map((corpusPath) => ({
    path: relativeAuthorizationPath(corpusPath),
    sha256: fs.existsSync(corpusPath) ? fileSha256(corpusPath) : null,
  }));
  const payloadScope = canonicalJsonValue(ADAPTIVE_WARRANT_PRIVATE_PAYLOAD_SCOPE);
  const contract = {
    schema: ADAPTIVE_WARRANT_LAUNCH_CONTRACT_SCHEMA,
    design: plan?.design || null,
    study_kind: config.mechanismValidation
      ? 'mechanism_validation'
      : config.contractValidation
        ? 'contract_validation'
        : 'baseline_comparison',
    execution: {
      dialogues: Array.isArray(plan?.jobs) ? plan.jobs.length : 0,
      maximum_tutor_decisions: (Array.isArray(plan?.jobs) ? plan.jobs.length : 0) * Number(config.horizon || 0),
      model_call_budget_per_dialogue: config.modelCallBudgetPerDialogue ?? null,
      maximum_model_calls:
        (Array.isArray(plan?.jobs) ? plan.jobs.length : 0) * Number(config.modelCallBudgetPerDialogue || 0),
      retry_policy: 'all retries consume the same per-dialogue model-call budget',
      runs: config.runs,
      master_seed: config.masterSeed,
      horizon: config.horizon,
      parallelism: config.parallelism,
      worlds: config.worlds,
      profiles: config.profiles,
      conditions: config.conditions,
      policy: config.policy,
      max_tokens_per_call: config.maxTokens,
      public_history_turns_for_auxiliary_analysis: config.historyTurns,
      learner_analysis_prompt_profile: config.learnerAnalysisPromptProfile,
      fixed_seams: config.fixedSeams,
      environment_contract: config.environmentContract || null,
      cli_contract: config.cliContract || null,
      study_plan_execution_sha256: studyPlanIdentity.sha256,
      job_order_sha256: canonicalJsonSha256((plan?.jobs || []).map((job) => job.id)),
    },
    annotation: {
      expected_cases: config.annotationExpectedCases,
      all_decisions: config.annotationAllDecisions,
      conditions: config.annotationConditions,
      excluded_prior_corpora: excludedCorpora,
    },
    model_routing: routes,
    authorized_destinations: destinations,
    private_payload_scope: payloadScope,
    private_payload_scope_sha256: canonicalJsonSha256(payloadScope),
    source: {
      git_commit: plan?.provenance?.gitCommit || null,
      worktree_clean: !oneLine(plan?.provenance?.gitStatus),
      source_provenance_sha256: plan?.provenance?.combinedSha256 || null,
      child_policy_sha256: plan?.provenance?.childPolicySha256 || null,
    },
    network_effect: 'launch model-backed CLI subprocesses and transmit the declared prompt payloads',
  };
  const approvalDigest = canonicalJsonSha256(contract);
  const approvable =
    isLowerHex(contract.source.git_commit, 40) &&
    contract.source.worktree_clean === true &&
    isLowerHex(contract.source.source_provenance_sha256, 64) &&
    isLowerHex(contract.source.child_policy_sha256, 64);
  return {
    schema: ADAPTIVE_WARRANT_LAUNCH_AUTHORIZATION_REQUEST_SCHEMA,
    study_id: plan?.studyId || null,
    approvable,
    approval_digest: approvalDigest,
    contract,
    authorization_template: {
      schema: ADAPTIVE_WARRANT_LAUNCH_AUTHORIZATION_SCHEMA,
      approved: false,
      approval_digest: approvalDigest,
      approved_destinations: destinations,
      private_payload_scope_sha256: contract.private_payload_scope_sha256,
      approved_git_commit: contract.source.git_commit,
      approved_source_provenance_sha256: contract.source.source_provenance_sha256,
      approved_child_policy_sha256: contract.source.child_policy_sha256,
      approved_study_plan_execution_sha256: contract.execution.study_plan_execution_sha256,
      approved_by: '',
      approved_at: '',
    },
  };
}

export function validateAdaptiveWarrantLaunchAuthorization(authorization, request) {
  const failures = [];
  const contract = request?.contract;
  let recomputedApprovalDigest = null;
  if (isPlainObject(contract)) {
    try {
      recomputedApprovalDigest = canonicalJsonSha256(contract);
    } catch {
      recomputedApprovalDigest = null;
    }
  }
  if (request?.schema !== ADAPTIVE_WARRANT_LAUNCH_AUTHORIZATION_REQUEST_SCHEMA) {
    failures.push('request_schema');
  }
  if (request?.approvable !== true) failures.push('request_not_approvable');
  if (!isLowerHex(request?.approval_digest, 64) || recomputedApprovalDigest !== request?.approval_digest) {
    failures.push('request_approval_digest');
  }
  if (contract?.schema !== ADAPTIVE_WARRANT_LAUNCH_CONTRACT_SCHEMA) failures.push('request_contract_schema');
  if (!isLowerHex(contract?.source?.git_commit, 40)) {
    failures.push('request_git_commit');
  }
  if (contract?.source?.worktree_clean !== true) failures.push('request_worktree_clean');
  if (!isLowerHex(contract?.source?.source_provenance_sha256, 64)) {
    failures.push('request_source_provenance_sha256');
  }
  if (!isLowerHex(contract?.source?.child_policy_sha256, 64)) {
    failures.push('request_child_policy_sha256');
  }
  if (!isLowerHex(contract?.private_payload_scope_sha256, 64)) {
    failures.push('request_private_payload_scope_sha256');
  }
  if (!isLowerHex(contract?.execution?.study_plan_execution_sha256, 64)) {
    failures.push('request_study_plan_execution_sha256');
  }
  if (!isStringArray(contract?.authorized_destinations)) failures.push('request_authorized_destinations');
  if (!hasExactKeys(authorization, ADAPTIVE_WARRANT_LAUNCH_AUTHORIZATION_FIELDS)) {
    failures.push('authorization_fields');
  }
  if (authorization?.schema !== ADAPTIVE_WARRANT_LAUNCH_AUTHORIZATION_SCHEMA) failures.push('schema');
  if (authorization?.approved !== true) failures.push('approved');
  if (!isLowerHex(authorization?.approval_digest, 64) || authorization.approval_digest !== request?.approval_digest) {
    failures.push('approval_digest');
  }
  if (!isStringArray(authorization?.approved_destinations)) failures.push('approved_destinations_type');
  if (!isDeepStrictEqual(authorization?.approved_destinations, contract?.authorized_destinations)) {
    failures.push('approved_destinations');
  }
  if (
    !isLowerHex(authorization?.private_payload_scope_sha256, 64) ||
    authorization.private_payload_scope_sha256 !== contract?.private_payload_scope_sha256
  ) {
    failures.push('private_payload_scope_sha256');
  }
  if (
    !isLowerHex(authorization?.approved_git_commit, 40) ||
    authorization.approved_git_commit !== contract?.source?.git_commit
  ) {
    failures.push('approved_git_commit');
  }
  if (
    !isLowerHex(authorization?.approved_source_provenance_sha256, 64) ||
    authorization.approved_source_provenance_sha256 !== contract?.source?.source_provenance_sha256
  ) {
    failures.push('approved_source_provenance_sha256');
  }
  if (
    !isLowerHex(authorization?.approved_child_policy_sha256, 64) ||
    authorization.approved_child_policy_sha256 !== contract?.source?.child_policy_sha256
  ) {
    failures.push('approved_child_policy_sha256');
  }
  if (
    !isLowerHex(authorization?.approved_study_plan_execution_sha256, 64) ||
    authorization?.approved_study_plan_execution_sha256 !== contract?.execution?.study_plan_execution_sha256
  ) {
    failures.push('approved_study_plan_execution_sha256');
  }
  if (!isStrictNonemptyString(authorization?.approved_by)) failures.push('approved_by');
  if (!isCanonicalUtcIsoTimestamp(authorization?.approved_at)) failures.push('approved_at');
  if (failures.length) {
    throw new Error(`launch authorization rejected: ${failures.join(', ')}`);
  }
  return {
    schema: 'machinespirits.adaptation-refinement.warrant-study-launch-authorization-audit.v1',
    accepted: true,
    approval_digest: request.approval_digest,
    approved_destinations: [...contract.authorized_destinations],
    private_payload_scope_sha256: contract.private_payload_scope_sha256,
    approved_git_commit: contract.source.git_commit,
    approved_source_provenance_sha256: contract.source.source_provenance_sha256,
    approved_child_policy_sha256: contract.source.child_policy_sha256,
    approved_study_plan_execution_sha256: contract.execution.study_plan_execution_sha256,
    approved_by: authorization.approved_by,
    approved_at: authorization.approved_at,
  };
}

export function assertAdaptiveWarrantLaunchSource(provenance, expectedSha) {
  const expected = oneLine(expectedSha).toLowerCase();
  if (!/^[0-9a-f]{40}$/u.test(expected)) {
    throw new Error('live mechanism validation requires --expected-sha with the exact 40-character HEAD SHA');
  }
  const actual = oneLine(provenance?.gitCommit).toLowerCase();
  if (!/^[0-9a-f]{40}$/u.test(actual)) {
    throw new Error('live mechanism validation could not resolve an exact 40-character HEAD SHA');
  }
  if (typeof provenance?.gitStatus !== 'string') {
    throw new Error('live mechanism validation could not verify worktree cleanliness');
  }
  if (!/^[0-9a-f]{64}$/u.test(String(provenance?.combinedSha256 || ''))) {
    throw new Error('live mechanism validation requires a complete 64-character source-closure hash');
  }
  if (!/^[0-9a-f]{64}$/u.test(String(provenance?.childPolicySha256 || ''))) {
    throw new Error('live mechanism validation requires a complete child policy-closure hash');
  }
  if (actual !== expected) {
    throw new Error(`live mechanism validation HEAD ${actual} does not match --expected-sha ${expected}`);
  }
  if (oneLine(provenance?.gitStatus)) {
    throw new Error('live mechanism validation requires a clean committed worktree');
  }
  return { git_commit: actual, worktree_clean: true };
}

export function assertAdaptiveWarrantMechanismModelRefs({ model, analysisModel, learnerModel } = {}) {
  const expected = ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.models;
  const observed = {
    tutor: model,
    learner_analysis: analysisModel,
    automated_learner: learnerModel,
  };
  const mismatches = Object.entries(observed).filter(([role, value]) => value !== expected[role]);
  if (mismatches.length) {
    throw new Error(
      `--mechanism-validation requires ${DEFAULT_MODEL} for tutor, learner analysis, and learner roles; mismatched ${mismatches.map(([role]) => role).join(', ')}`,
    );
  }
  return observed;
}

export function assertAdaptiveWarrantStudyRuntimeBoundary(plan, { checkCli = true } = {}) {
  const current = adaptiveWarrantStudySourceFingerprint();
  const expected = plan?.provenance || {};
  const failures = [];
  for (const [label, expectedValue, currentValue] of [
    ['git_commit', expected.gitCommit, current.gitCommit],
    ['git_status', expected.gitStatus, current.gitStatus],
    ['source_provenance_sha256', expected.combinedSha256, current.combinedSha256],
    ['child_policy_sha256', expected.childPolicySha256, current.childPolicySha256],
  ]) {
    if (typeof expectedValue !== 'string' || expectedValue !== currentValue) failures.push(label);
  }
  let cliContract = plan?.config?.cliContract || null;
  if (checkCli && plan?.config?.mechanismValidation === true) {
    const currentCli = collectAdaptiveWarrantStudyCliContract({ environment: process.env });
    if (!isDeepStrictEqual(currentCli, cliContract)) failures.push('cli_contract');
    const environmentContract = adaptiveWarrantStudyEnvironmentContract({ cliContract: currentCli });
    if (!isDeepStrictEqual(environmentContract, plan?.config?.environmentContract)) {
      failures.push('environment_contract');
    }
    cliContract = currentCli;
  }
  if (failures.length) {
    throw new Error(`adaptive-warrant study runtime boundary drift: ${failures.join(', ')}`);
  }
  return {
    source_provenance_sha256: current.combinedSha256,
    child_policy_sha256: current.childPolicySha256,
    cli_contract_sha256: cliContract?.sha256 || null,
  };
}

function shellDisplay(command, env = {}) {
  const quoted = command.map((part) => (/[\s'"$]/u.test(part) ? JSON.stringify(part) : part)).join(' ');
  const prefix = Object.entries(env)
    .map(([key, value]) => `${key}=${JSON.stringify(String(value))}`)
    .join(' ');
  return prefix ? `${prefix} ${quoted}` : quoted;
}

export function buildAdaptiveWarrantBaselineJobs({
  rootDir,
  runs = 5,
  masterSeed = 101,
  model = DEFAULT_MODEL,
  analysisModel = DEFAULT_MODEL,
  learnerModel = DEFAULT_MODEL,
  world = 'world_005_marrick',
  worlds = null,
  profiles = STUDY_PROFILES,
  conditions = STUDY_CONDITIONS,
  horizon = DEFAULT_HORIZON,
  maxTokens = 4096,
  historyTurns = 4,
  modelCallBudgetPerDialogue = MECHANISM_MODEL_CALL_BUDGET_PER_DIALOGUE,
  dryRun = false,
  studyId = path.basename(rootDir),
  mechanismValidation = false,
} = {}) {
  const jobs = [];
  const studyWorlds = worlds ? [...worlds] : [world];
  const orderSeed = canonicalJsonSha256({
    schema: 'machinespirits.adaptation-refinement.warrant-study-job-order.v1',
    runs,
    masterSeed,
    horizon,
    worlds: studyWorlds,
    profiles,
    conditions: conditions.map(({ id, warrantGateMode }) => ({ id, warrantGateMode })),
    mechanismValidation,
  });
  for (let runIndex = 1; runIndex <= runs; runIndex += 1) {
    const seed = masterSeed + runIndex - 1;
    const cells = studyWorlds
      .flatMap((cellWorld) =>
        profiles.flatMap((profile) => conditions.map((condition) => ({ world: cellWorld, profile, condition }))),
      )
      .sort((left, right) =>
        sha256(`${orderSeed}|${runIndex}|${left.world}|${left.profile}|${left.condition.id}`).localeCompare(
          sha256(`${orderSeed}|${runIndex}|${right.world}|${right.profile}|${right.condition.id}`),
        ),
      );
    for (const { world: cellWorld, profile, condition } of cells) {
      const worldPrefix = studyWorlds.length > 1 || mechanismValidation ? `${cellWorld}-` : '';
      const id = `${worldPrefix}${profile}-${condition.id}-r${runIndex}-s${seed}`;
      const jobDir = path.join(rootDir, 'jobs', id);
      const command = [
        process.execPath,
        'scripts/run-tutor-stub-auto-eval.js',
        '--runs',
        '1',
        '--run-seed',
        String(seed),
        '--turns',
        String(horizon),
        '--no-stop-on-grounded',
        '--primary-horizon',
        String(horizon),
        '--policies',
        'dynamic',
        '--warrant-gate',
        condition.warrantGateMode,
        '--auto-learner-profile-id',
        profile,
        '--world',
        cellWorld,
        '--dag-mode',
        'strict_dag',
        '--loop-mode',
        'strict',
        '--model',
        model,
        '--analysis-model',
        analysisModel,
        '--learner-analysis-prompt-profile',
        LEARNER_ANALYSIS_PROMPT_PROFILE,
        '--auto-learner-model',
        learnerModel,
        '--cli-effort',
        'medium',
        '--history-turns',
        String(historyTurns),
        '--max-tokens',
        String(maxTokens),
        '--model-call-budget',
        String(modelCallBudgetPerDialogue),
        '--register-temperature',
        '0.15',
        '--dag-fact-dropout',
        '0',
        '--release-speed',
        '1',
        '--parallelism',
        '1',
        '--progress-interval',
        '60',
        '--trace-dir',
        jobDir,
        '--parent-run-id',
        studyId,
        '--no-ledger',
        '--no-html-report',
        '--keep-going',
      ];
      if (dryRun) command.push('--dry-run');
      jobs.push({
        id,
        ordinal: jobs.length + 1,
        runIndex,
        seed,
        world: cellWorld,
        profile,
        condition: condition.id,
        warrantGateMode: condition.warrantGateMode,
        horizon,
        mechanismValidation,
        dryRun,
        parentRunId: studyId,
        jobDir,
        command,
      });
    }
  }
  return jobs;
}

// This measure is deliberately separate from adaptiveWarrantGateCore: it is a
// public-text outcome definition, not the gate's signal classifier.
const DEFERRED_OPENING =
  /^(?:may|might|should|shall|could|can|would) (?:i|we)\b|^(?:would|could|will|can) you\b|^do you want (?:me|us) to\b|^is it (?:all right|ok(?:ay)?) if\b/iu;
const HEDGE_OPENING = /^(?:i (?:think|suppose|guess)|maybe|perhaps|possibly|it (?:seems|might|may)|i'?m not sure)\b/iu;
const CLAIM_PREDICATE =
  /\b(?:is|are|was|were|shows?|supports?|means?|establish(?:es|ed)?|rules? out|proves?|indicates?|requires?|cannot|does not|did not|must)\b/iu;

export function isUnhedgedOwnVoiceClaim(text) {
  const surface = oneLine(text);
  if (!surface || surface.length < 12 || DEFERRED_OPENING.test(surface) || HEDGE_OPENING.test(surface)) return false;
  if (surface.endsWith('?')) return false;
  return CLAIM_PREDICATE.test(surface);
}

function dagTotal(record) {
  const dag = record?.stateObservation?.dag || {};
  return Number(dag.grounded_count || 0) + Number(dag.voiced_derived_count || 0);
}

function deliveredFamily(record) {
  return (
    record?.deliveredResponseConfiguration?.action_family ||
    record?.registerSelection?.response_configuration?.action_family ||
    record?.registerSelection?.action_family ||
    null
  );
}

/**
 * Verify that a recorded gate decision reached the configuration that was
 * actually delivered, rather than stopping at reducer or selection parity.
 * Observe decisions must leave no gate-owned delivery marker. Active
 * revisions must retain final-authority ownership of the complete frozen
 * bundle, and public-obligation directives must survive without structured
 * mutation.
 */
export function assessAdaptiveWarrantDeliveryApplication({ decision = null, record = null } = {}) {
  const mode = decision?.mode || null;
  if (!decision || !['observe', 'active'].includes(mode)) {
    return { checked: false, mode, ok: null, mismatches: [] };
  }

  const turnRecord = record || {};
  const selectorApplication = turnRecord.registerSelection?.warrant_gate_application || null;
  const selectedConfiguration = turnRecord.responseConfiguration || null;
  const speakingConfiguration = turnRecord.speakingResponseConfiguration || null;
  const deliveredConfiguration = turnRecord.deliveredResponseConfiguration || null;
  const finalDelivery = turnRecord.tutorGuardAccounting?.finalDelivery || null;
  const explicitDeliveryConfiguration = finalDelivery?.deliveryConfiguration || null;
  const deliveryTransition = turnRecord.responseConfigurationTransition || null;
  const finalConfigurationAudit =
    finalDelivery?.audits?.responseConfigurationAudit || turnRecord.responseConfigurationAudit || null;
  const finalProgressionAudit = finalDelivery?.audits?.liveTurnProgressionAudit || null;
  const firstDraftContract = turnRecord.firstDraftContract || null;
  const enforcement = selectedConfiguration?.adaptive_warrant_enforcement || null;
  const selectedDirective = selectedConfiguration?.public_obligation_directive || null;
  const deliveredDirective = deliveredConfiguration?.public_obligation_directive || null;
  const expectedFamily =
    mode === 'active' && decision.revision_warranted === true ? decision.policy?.family || null : null;
  const expectedStance = mode === 'active' ? decision.override?.engagement_stance || null : null;
  const expectedDirective = mode === 'active' ? decision.obligation_directive || null : null;
  const mismatches = [];

  if (decision.schema !== 'machinespirits.tutor-stub.warrant-gate.v5') {
    mismatches.push('warrant_gate_decision_schema_mismatch');
  }
  const candidateOverrideRequired = Boolean(
    decision.revision_warranted === true &&
    decision.policy?.family &&
    decision.policy.family !== decision.pre_gate_proposed_action_family,
  );
  if (decision.current_candidate_override_required !== candidateOverrideRequired) {
    mismatches.push('warrant_gate_override_requirement_mismatch');
  }
  if (Boolean(decision.override) !== (mode === 'active' && candidateOverrideRequired)) {
    mismatches.push('warrant_gate_override_presence_mismatch');
  }
  const expectedDecisionDirective =
    mode === 'active' ? buildAdaptiveWarrantObligationDirective(decision.public_obligation) : null;
  if (!isDeepStrictEqual(decision.obligation_directive || null, expectedDecisionDirective)) {
    mismatches.push('warrant_gate_obligation_directive_derivation_mismatch');
  }

  if (!selectedConfiguration) mismatches.push('selected_configuration_missing');
  if (!speakingConfiguration) mismatches.push('speaking_configuration_missing');
  if (!deliveredConfiguration) mismatches.push('delivered_configuration_missing');
  if (!String(selectedConfiguration?.action_family || '').trim()) mismatches.push('selected_action_family_missing');
  if (!String(deliveredConfiguration?.action_family || '').trim()) mismatches.push('delivered_action_family_missing');
  const selectorAssessment = assessAdaptiveWarrantSelectorApplicationAudit({
    application: selectorApplication,
    decision,
    selectedConfiguration,
  });
  mismatches.push(...selectorAssessment.issues);

  if (!explicitDeliveryConfiguration) mismatches.push('explicit_final_delivery_configuration_missing');
  else if (!isDeepStrictEqual(explicitDeliveryConfiguration, deliveredConfiguration)) {
    mismatches.push('explicit_final_delivery_configuration_mismatch');
  }
  if (!isDeepStrictEqual(finalDelivery?.configurationTransition || null, deliveryTransition || null)) {
    mismatches.push('final_delivery_transition_mismatch');
  }
  if (finalDelivery?.audits?.deliveryOk !== true || finalDelivery?.auditOk !== true) {
    mismatches.push('final_delivery_audit_not_passed');
  }
  if (!String(finalDelivery?.candidate?.text || '').trim() || !String(turnRecord.tutor || '').trim()) {
    mismatches.push('final_delivery_text_missing');
  } else if (String(finalDelivery.candidate.text) !== String(turnRecord.tutor)) {
    mismatches.push('final_delivery_text_mismatch');
  }
  const auditedText = finalDelivery?.audits?.auditedText || null;
  const expectedAuditedTextSha = crypto
    .createHash('sha256')
    .update(oneLine(finalDelivery?.candidate?.text))
    .digest('hex');
  if (
    auditedText?.schema !== 'machinespirits.tutor-stub.audited-public-text.v1' ||
    auditedText?.normalization !== 'one_line_whitespace' ||
    auditedText?.sha256 !== expectedAuditedTextSha
  ) {
    mismatches.push('final_delivery_audited_text_mismatch');
  }

  const configurationTransition = assessAdaptiveWarrantConfigurationTransition({
    selectedConfiguration,
    speakingConfiguration,
    deliveredConfiguration,
    transition: deliveryTransition,
    finalDeliverySource: finalDelivery?.source || null,
    performanceObligationContract: firstDraftContract?.performance?.obligation_contract || null,
    closureRequired: turnRecord.dialogueClosure?.frame?.mandatory === true,
  });
  if (!configurationTransition.ok) mismatches.push('configuration_transition_unlicensed');

  if (!firstDraftContract) {
    mismatches.push('first_draft_contract_missing');
  } else if (speakingConfiguration) {
    if (firstDraftContract.development?.action_family !== speakingConfiguration.action_family) {
      mismatches.push('first_draft_action_family_configuration_mismatch');
    }
    if (firstDraftContract.performance?.engagement_stance !== speakingConfiguration.engagement_stance) {
      mismatches.push('first_draft_stance_configuration_mismatch');
    }
    if (firstDraftContract.performance?.actorial_part !== speakingConfiguration.actorial_part) {
      mismatches.push('first_draft_actorial_part_configuration_mismatch');
    }
    if (firstDraftContract.performance?.tactic !== speakingConfiguration.actorial_performance?.id) {
      mismatches.push('first_draft_tactic_configuration_mismatch');
    }
  }

  if (!finalConfigurationAudit) {
    mismatches.push('final_response_configuration_audit_missing');
  } else if (deliveredConfiguration && expectedFamily) {
    // Observe and active-hold decisions do not own an action-family surface
    // intervention. Their mechanism contract is structural inertia. Requiring
    // the baseline selector's independently chosen family to be visibly
    // realized here conflates a general response-quality diagnostic with gate
    // delivery and massively overstates mechanism failures.
    const actionAxis = finalConfigurationAudit.axes?.action_family || null;
    if (actionAxis?.selected !== deliveredConfiguration.action_family || actionAxis?.visible !== true) {
      mismatches.push('delivered_action_family_not_visible');
    }
  }

  if (mode === 'observe') {
    if (decision.override !== null && decision.override !== undefined) mismatches.push('observe_override_recorded');
    if (decision.obligation_directive !== null && decision.obligation_directive !== undefined) {
      mismatches.push('observe_obligation_directive_recorded');
    }
    if (enforcement !== null && enforcement !== undefined) mismatches.push('observe_final_authority_delivered');
    if (turnRecord.registerSelection?.adaptive_warrant_enforcement) {
      mismatches.push('observe_top_level_final_authority_delivered');
    }
    if (
      selectedConfiguration?.compatibility?.pre_final_warrant_action_family !== undefined ||
      selectedConfiguration?.compatibility?.final_authority_configuration_source !== undefined
    ) {
      mismatches.push('observe_final_authority_compatibility_delivered');
    }
    if (selectedDirective) mismatches.push('observe_obligation_directive_selected');
    if (deliveredDirective) mismatches.push('observe_obligation_directive_delivered');
    if (selectorApplication) {
      if (selectorApplication.pre_gate_source_sha256 !== selectorApplication.post_gate_source_sha256) {
        mismatches.push('observe_selector_source_mutated');
      }
      if (selectorApplication.source_changed_fields?.length) mismatches.push('observe_selector_fields_mutated');
      if (selectorApplication.action_family_override_input !== null) {
        mismatches.push('observe_action_family_override_input_present');
      }
      if (selectorApplication.public_obligation_directive_input !== null) {
        mismatches.push('observe_obligation_directive_input_present');
      }
    }
  } else {
    if (decision.revision_warranted === true && !expectedFamily) {
      mismatches.push('active_warranted_policy_family_missing');
    }
    const overrideComplete = Boolean(
      decision.override &&
      String(decision.override.action_family || '').trim() &&
      String(decision.override.engagement_stance || '').trim() &&
      String(decision.override.reason || '').trim(),
    );
    if (decision.current_candidate_override_required === true && !overrideComplete) {
      mismatches.push('active_required_override_missing');
    }
    if (decision.override && decision.current_candidate_override_required !== true) {
      mismatches.push('active_unrequired_override_recorded');
    }
    if (decision.override?.action_family && decision.override.action_family !== decision.policy?.family) {
      mismatches.push('active_override_policy_family_mismatch');
    }
    if (decision.override) {
      const expectedOverrideStance = decision.policy?.stance_hint || 'plain';
      const expectedOverrideReason = `Adaptive warrant gate: ${decision.warrant_basis} — ${decision.policy?.rationale}`;
      if (
        decision.override.engagement_stance !== expectedOverrideStance ||
        decision.override.reason !== expectedOverrideReason
      ) {
        mismatches.push('active_override_policy_projection_mismatch');
      }
    }

    if (expectedFamily) {
      if (selectorApplication?.selected_action_family !== expectedFamily) {
        mismatches.push('active_selector_action_family_mismatch');
      }
      if (selectedConfiguration?.action_family !== expectedFamily) {
        mismatches.push('active_selected_action_family_mismatch');
      }
      if (deliveredConfiguration?.action_family !== expectedFamily) {
        mismatches.push('active_action_family_not_delivered');
      }
      if (enforcement?.applied !== true) mismatches.push('active_final_authority_not_delivered');
      if (enforcement?.schema !== 'machinespirits.tutor-stub.warrant-gate-final-authority.v2') {
        mismatches.push('active_final_authority_schema_mismatch');
      }
      if (enforcement?.desired_action_family !== expectedFamily) {
        mismatches.push('active_final_authority_family_mismatch');
      }
      if (enforcement?.warrant_basis !== decision.warrant_basis) {
        mismatches.push('active_final_authority_warrant_basis_mismatch');
      }
      if ((enforcement?.decision_kind || null) !== (decision.decision_kind || null)) {
        mismatches.push('active_final_authority_decision_kind_mismatch');
      }
      if (enforcement?.configuration_source !== 'frozen_pre_optional_gate_configuration') {
        mismatches.push('active_final_authority_configuration_source_mismatch');
      }
      if (enforcement?.configuration_restored !== true) {
        mismatches.push('active_frozen_bundle_not_restored');
      }
      if (typeof enforcement?.optional_configuration_displaced !== 'boolean') {
        mismatches.push('active_final_authority_displacement_flag_missing');
      }
      if (
        !Array.isArray(enforcement?.displaced_response_configuration_fields) ||
        !Array.isArray(enforcement?.displaced_selection_fields)
      ) {
        mismatches.push('active_final_authority_displacement_fields_missing');
      }
      const compatibility = selectedConfiguration?.compatibility || null;
      if (compatibility?.final_authority_configuration_source !== 'frozen_pre_optional_gate_configuration') {
        mismatches.push('active_final_authority_compatibility_source_mismatch');
      }
      const expectedPreFinalFamily = enforcement?.displaced_action_family || expectedFamily;
      if (compatibility?.pre_final_warrant_action_family !== expectedPreFinalFamily) {
        mismatches.push('active_final_authority_pre_final_family_mismatch');
      }
      if (!isDeepStrictEqual(turnRecord.registerSelection?.warrant_gate || null, decision)) {
        mismatches.push('active_final_selection_decision_mismatch');
      }
      if (
        turnRecord.registerSelection?.action_family !== expectedFamily ||
        turnRecord.registerSelection?.response_configuration?.action_family !== expectedFamily ||
        !isDeepStrictEqual(turnRecord.registerSelection?.response_configuration || null, selectedConfiguration)
      ) {
        mismatches.push('active_final_selection_configuration_mismatch');
      }
      if (
        !isDeepStrictEqual(turnRecord.registerSelection?.adaptive_warrant_enforcement || null, enforcement) ||
        !isDeepStrictEqual(selectedConfiguration?.adaptive_warrant_enforcement || null, enforcement)
      ) {
        mismatches.push('active_final_authority_enforcement_binding_mismatch');
      }
      const authorityAudit = enforcement?.final_authority_audit || null;
      const preFinalSelection = authorityAudit?.pre_final_selection || null;
      const frozenSelection = authorityAudit?.frozen_pre_optional_selection || null;
      const preFinalConfiguration = preFinalSelection?.response_configuration || null;
      const frozenConfiguration = frozenSelection?.response_configuration || null;
      if (
        authorityAudit?.schema !== 'machinespirits.tutor-stub.warrant-gate-final-authority-audit.v1' ||
        !preFinalSelection ||
        !frozenSelection ||
        !preFinalConfiguration ||
        !frozenConfiguration
      ) {
        mismatches.push('active_final_authority_audit_missing');
      } else {
        if (!isDeepStrictEqual(preFinalSelection, turnRecord.preFinalWarrantSelection || null)) {
          mismatches.push('active_pre_final_selection_record_mismatch');
        }
        if (!isDeepStrictEqual(frozenSelection.warrant_gate || null, decision)) {
          mismatches.push('active_frozen_selection_decision_mismatch');
        }
        if (
          hashAdaptiveWarrantResponseConfiguration(frozenConfiguration) !==
            selectorApplication?.selected_response_configuration_sha256 ||
          hashAdaptiveWarrantResponseConfiguration(selectedConfiguration) !==
            selectorApplication?.selected_response_configuration_sha256
        ) {
          mismatches.push('active_frozen_bundle_digest_mismatch');
        }
        const displacedResponseFields = changedAdaptiveWarrantTopLevelFields(
          preFinalConfiguration,
          frozenConfiguration,
        ).filter((field) => field !== 'adaptive_warrant_enforcement');
        const displacedSelectionFields = changedAdaptiveWarrantTopLevelFields(
          preFinalSelection,
          frozenSelection,
        ).filter(
          (field) => !['adaptive_warrant_enforcement', 'response_configuration', 'warrant_gate'].includes(field),
        );
        if (!isDeepStrictEqual(enforcement?.displaced_response_configuration_fields, displacedResponseFields)) {
          mismatches.push('active_final_authority_response_displacement_mismatch');
        }
        if (!isDeepStrictEqual(enforcement?.displaced_selection_fields, displacedSelectionFields)) {
          mismatches.push('active_final_authority_selection_displacement_mismatch');
        }
        const displaced = Boolean(displacedResponseFields.length || displacedSelectionFields.length);
        if (enforcement?.optional_configuration_displaced !== displaced) {
          mismatches.push('active_final_authority_displacement_flag_mismatch');
        }
        const rawPreFinalFamily = preFinalConfiguration.action_family || preFinalSelection.action_family || null;
        const expectedDisplacedFamily = rawPreFinalFamily !== expectedFamily ? rawPreFinalFamily : null;
        if (
          enforcement?.displaced_action_family !== expectedDisplacedFamily ||
          compatibility?.pre_final_warrant_action_family !== rawPreFinalFamily
        ) {
          mismatches.push('active_final_authority_displaced_family_mismatch');
        }
        const expectedFinalSelection = {
          ...structuredClone(frozenSelection),
          warrant_gate: structuredClone(decision),
          action_family: expectedFamily,
          adaptive_warrant_enforcement: structuredClone(enforcement),
          response_configuration: structuredClone(selectedConfiguration),
        };
        if (!isDeepStrictEqual(turnRecord.registerSelection, expectedFinalSelection)) {
          mismatches.push('active_final_selection_frozen_projection_mismatch');
        }
      }
    } else if (enforcement !== null && enforcement !== undefined) {
      mismatches.push('active_unwarranted_final_authority_delivered');
    } else if (
      turnRecord.registerSelection?.adaptive_warrant_enforcement ||
      selectedConfiguration?.compatibility?.pre_final_warrant_action_family !== undefined ||
      selectedConfiguration?.compatibility?.final_authority_configuration_source !== undefined
    ) {
      mismatches.push('active_unwarranted_final_authority_provenance_delivered');
    }

    if (expectedStance) {
      if (selectorApplication?.selected_engagement_stance !== expectedStance) {
        mismatches.push('active_selector_engagement_stance_mismatch');
      }
      if (selectedConfiguration?.engagement_stance !== expectedStance) {
        mismatches.push('active_selected_engagement_stance_mismatch');
      }
      const deliveredStance = deliveredConfiguration?.engagement_stance || null;
      const stanceAxis = finalConfigurationAudit?.axes?.engagement_stance || null;
      if (!configurationTransition.kind.includes('plain_recovery')) {
        if (
          deliveredStance !== expectedStance ||
          stanceAxis?.selected !== expectedStance ||
          stanceAxis?.visible !== true
        ) {
          mismatches.push('active_engagement_stance_not_delivered');
        }
      } else {
        if (deliveredStance !== 'plain' || stanceAxis?.selected !== 'plain' || stanceAxis?.visible !== true) {
          mismatches.push('active_recovery_stance_not_delivered');
        }
      }
    }

    const directiveComplete = Boolean(
      decision.obligation_directive &&
      String(decision.obligation_directive.obligation_id || '').trim() &&
      decision.obligation_directive.target &&
      (String(decision.obligation_directive.target.signature || '').trim() ||
        String(decision.obligation_directive.target.source_surface || '').trim()) &&
      Array.isArray(decision.obligation_directive.acceptable_outcomes) &&
      decision.obligation_directive.acceptable_outcomes.length,
    );
    if (decision.obligation_directive && !directiveComplete) {
      mismatches.push('active_obligation_directive_invalid');
    }
    if (decision.public_obligation?.blocking_obligation && !directiveComplete) {
      mismatches.push('active_blocking_obligation_directive_missing');
    }
    if (expectedDirective) {
      if (!isDeepStrictEqual(selectedDirective, expectedDirective)) {
        mismatches.push('active_obligation_directive_not_selected');
      }
      if (!isDeepStrictEqual(deliveredDirective, expectedDirective)) {
        mismatches.push('active_obligation_directive_mismatch');
      }
      const progressionContract = firstDraftContract?.progression?.public_obligation_contract || null;
      if (
        progressionContract?.complete !== true ||
        progressionContract?.obligation_id !== expectedDirective.obligation_id
      ) {
        mismatches.push('active_obligation_not_compiled_into_first_draft');
      }
      const expectedTarget = expectedDirective.target || {};
      const compiledTarget = progressionContract?.target || {};
      for (const field of [
        'kind',
        'signature',
        'source_surface',
        'public_terms',
        'subject_terms',
        'required_components',
      ]) {
        if (
          Object.prototype.hasOwnProperty.call(expectedTarget, field) &&
          !isDeepStrictEqual(compiledTarget[field], expectedTarget[field])
        ) {
          mismatches.push(`active_obligation_compiled_target_${field}_mismatch`);
        }
      }
      if (!isDeepStrictEqual(progressionContract?.acceptable_outcomes || [], expectedDirective.acceptable_outcomes)) {
        mismatches.push('active_obligation_compiled_outcomes_mismatch');
      }
      const obligationAudit = finalProgressionAudit?.public_obligation || null;
      const acceptableOutcomes = Array.isArray(expectedDirective.acceptable_outcomes)
        ? expectedDirective.acceptable_outcomes
        : [];
      if (
        finalProgressionAudit?.ok !== true ||
        obligationAudit?.active !== true ||
        obligationAudit?.resolved !== true ||
        obligationAudit?.obligation_id !== expectedDirective.obligation_id ||
        !acceptableOutcomes.includes(obligationAudit?.outcome)
      ) {
        mismatches.push('active_obligation_not_realized_in_public_delivery');
      }
      const deliveryAudit = obligationAudit?.delivery || null;
      const expectedComponentIds = (expectedDirective.target?.required_components || []).map((row) => row.id);
      const componentIdsMatch = isDeepStrictEqual(
        (deliveryAudit?.component_delivery || []).map((row) => row.id),
        expectedComponentIds,
      );
      const satisfiedTargetComplete =
        deliveryAudit?.status === 'satisfied' &&
        deliveryAudit.required_components_answered === true &&
        (deliveryAudit.component_delivery || []).every((row) => row.answered === true);
      const accountableDeferralComplete =
        deliveryAudit?.status === 'deferred' &&
        deliveryAudit.target_named === true &&
        deliveryAudit.unavailable_claimed === true &&
        Boolean(deliveryAudit.concrete_next_step) &&
        deliveryAudit.terminal_question_count === 0;
      if (
        deliveryAudit?.obligation_id !== expectedDirective.obligation_id ||
        !componentIdsMatch ||
        (!satisfiedTargetComplete && !accountableDeferralComplete)
      ) {
        mismatches.push('active_obligation_delivery_target_incomplete');
      }
    } else {
      if (selectedDirective) mismatches.push('active_unexpected_obligation_directive_selected');
      if (deliveredDirective) mismatches.push('active_unexpected_obligation_directive_delivered');
    }
  }

  return {
    checked: true,
    mode,
    ok: mismatches.length === 0,
    mismatches,
    selector_application_schema: selectorApplication?.schema || null,
    selector_application: selectorAssessment,
    explicit_final_delivery: Boolean(explicitDeliveryConfiguration),
    configuration_transition: configurationTransition,
    expected_action_family: expectedFamily,
    selected_action_family: selectedConfiguration?.action_family || null,
    speaking_action_family: speakingConfiguration?.action_family || null,
    delivered_action_family: deliveredConfiguration?.action_family || null,
    expected_engagement_stance: expectedStance,
    selected_engagement_stance: selectedConfiguration?.engagement_stance || null,
    speaking_engagement_stance: speakingConfiguration?.engagement_stance || null,
    delivered_engagement_stance: deliveredConfiguration?.engagement_stance || null,
    expected_obligation_id: expectedDirective?.obligation_id || null,
    delivered_obligation_id: deliveredDirective?.obligation_id || null,
    final_authority_applied: enforcement?.applied === true,
    frozen_bundle_restored: enforcement?.configuration_restored === true,
  };
}

function compareCanonicalWarrantDecisions(live, shadow) {
  if (!live || !shadow) return { agree: null, mismatches: [], mode: null };
  // Historical v1-v3 gate traces predate the typed ledger/completion fields;
  // preserve their old boolean comparison without claiming structured parity.
  if (!/\.v(?:4|5)$/u.test(String(live.schema || ''))) {
    return {
      agree: live.revision_warranted === shadow.revision_warranted,
      mismatches: live.revision_warranted === shadow.revision_warranted ? [] : ['revision_warranted'],
      mode: 'legacy_boolean',
    };
  }
  const comparison = compareStableAdaptiveWarrantDecisions(live, shadow);
  return { agree: comparison.ok, mismatches: comparison.mismatches, mode: 'structured_v1' };
}

function traceDecisionRows(tracePath, turnRecords, { includeTurnOne = false } = {}) {
  const shadow = deriveAdaptiveWarrantShadow(tracePath, { includeTurnOne }).sessions[0]?.decisions || [];
  const shadowByTurn = new Map(shadow.map((decision) => [Number(decision.turn), decision]));
  const firstIndex = includeTurnOne ? 0 : 1;
  return turnRecords.slice(firstIndex).map((record, offset) => {
    const index = firstIndex + offset;
    const turn = Number(record.turn || index + 1);
    const prior = index > 0 ? turnRecords[index - 1] : null;
    const gate = record?.warrantGateDecision || record?.registerSelection?.warrant_gate || null;
    const shadowDecision = shadowByTurn.get(turn) || null;
    const family = deliveredFamily(record);
    const priorFamily = deliveredFamily(prior);
    const parity = compareCanonicalWarrantDecisions(gate, shadowDecision);
    const deliveryApplication = assessAdaptiveWarrantDeliveryApplication({
      decision: gate,
      record,
    });
    return {
      turn,
      strategy_in_force: gate?.strategy_in_force ?? shadowDecision?.strategy_in_force ?? priorFamily,
      actual_family: family,
      revised: Boolean(family && priorFamily && family !== priorFamily),
      gate,
      shadow: shadowDecision,
      live_shadow_agree: parity.agree,
      live_shadow_parity_mode: parity.mode,
      live_shadow_mismatches: parity.mismatches,
      delivery_application: deliveryApplication,
    };
  });
}

export function summarizeAdaptiveWarrantTrace({ tracePath, job, childStatus = null, summaryPath = null } = {}) {
  const events = readJsonl(tracePath);
  const openingEvent = events.find((event) => event.type === 'tutor_opening') || null;
  const openingFrame = openingEvent?.realization?.frame || null;
  const publicInquiryBrief = openingEvent
    ? {
        opening_text: oneLine(openingEvent.text),
        public_situation: oneLine(openingFrame?.publicSituation),
        public_question: oneLine(openingFrame?.publicQuestion),
        opening_evidence: (openingFrame?.openingEvidence || []).map((row) => ({
          premise: row?.premise || row?.id || null,
          surface: oneLine(row?.surface || row?.text),
        })),
        public_requirements: (openingFrame?.requirements || openingEvent?.realization?.requirements || []).map((row) =>
          oneLine(row?.text || row),
        ),
      }
    : null;
  const turnRecords = events
    .filter((event) => event.type === 'turn_complete' && event.turnRecord)
    .map((event) => event.turnRecord)
    .sort((left, right) => Number(left.turn) - Number(right.turn));
  const decisions = traceDecisionRows(tracePath, turnRecords, {
    includeTurnOne: job.mechanismValidation === true,
  });
  const learnerAnalysisCalls = events.filter(
    (event) => event.type === 'model_call' && event.role === 'tutor_stub_learner_analysis',
  );
  const learnerAnalysisPromptFailures = events.filter(
    (event) => event.type === 'prompt_audit_failed' && event.role === 'tutor_stub_learner_analysis',
  );
  const promptAuditFailures = events.filter((event) => event.type === 'prompt_audit_failed');
  const promptAuditRecoveries = events.filter((event) => event.type === 'prompt_audit_recovery');
  const successfulLearnerAnalysisTurns = turnRecords.filter(
    (record) => record.classification?.combined === true && !record.classification?.error,
  );
  const liveDecisions = decisions.filter((row) => row.gate);
  const shadowDecisions = decisions.filter((row) => row.shadow);
  const firstWarrant = shadowDecisions.find((row) => row.shadow.revision_warranted)?.turn || null;
  const firstRevision = firstWarrant
    ? decisions.find((row) => row.turn >= firstWarrant && row.revised)?.turn || null
    : null;
  const firstOwnVoiceClaim = turnRecords.find((record) => isUnhedgedOwnVoiceClaim(record.learner))?.turn || null;
  const initialDagTotal = turnRecords.length ? dagTotal(turnRecords[0]) : null;
  const finalDagTotal = turnRecords.length ? dagTotal(turnRecords.at(-1)) : null;
  const publicTurns = turnRecords.map((record) => ({
    turn: Number(record.turn),
    learner: oneLine(record.learner),
    tutor: oneLine(record.tutor),
    dag_total: dagTotal(record),
    grounded_count: Number(record?.stateObservation?.dag?.grounded_count || 0),
    voiced_derived_count: Number(record?.stateObservation?.dag?.voiced_derived_count || 0),
    action_family: deliveredFamily(record),
  }));
  return {
    schema: ADAPTIVE_WARRANT_BASELINE_RESULT_SCHEMA,
    jobId: job.id,
    runIndex: job.runIndex,
    seed: job.seed,
    world: job.world || null,
    profile: job.profile,
    condition: job.condition,
    warrantGateMode: job.warrantGateMode,
    childStatus,
    summaryPath,
    tracePath,
    turnCount: turnRecords.length,
    learnerAnalysisCallCount: learnerAnalysisCalls.length,
    learnerAnalysisPromptFailureCount: learnerAnalysisPromptFailures.length,
    promptAuditFailureCount: promptAuditFailures.length,
    promptAuditRecoveryCount: promptAuditRecoveries.length,
    learnerAnalysisErrorCount: turnRecords.filter((record) => record.classification?.error).length,
    learnerAnalysisCoverage: turnRecords.length
      ? Number((successfulLearnerAnalysisTurns.length / turnRecords.length).toFixed(3))
      : null,
    initialDagTotal,
    finalDagTotal,
    learnerRecordGrowth:
      initialDagTotal === null || finalDagTotal === null ? null : Number(finalDagTotal - initialDagTotal),
    firstUnhedgedOwnVoiceClaimTurn: firstOwnVoiceClaim,
    deferenceBreakByHorizon: firstOwnVoiceClaim !== null,
    firstWarrantTurn: firstWarrant,
    firstRevisionTurn: firstRevision,
    revisionLagTurns: firstWarrant === null || firstRevision === null ? null : firstRevision - firstWarrant,
    warrantedButUnrevisedByHorizon: firstWarrant !== null && firstRevision === null,
    liveWarrantCount: liveDecisions.filter((row) => row.gate.revision_warranted).length,
    shadowWarrantCount: shadowDecisions.filter((row) => row.shadow.revision_warranted).length,
    overrideCount: liveDecisions.filter((row) => row.gate.override).length,
    gateOutcomeCoverage: liveDecisions.length
      ? Number((liveDecisions.filter((row) => row.gate.prior_turn_outcome).length / liveDecisions.length).toFixed(3))
      : null,
    liveShadowAgreement: liveDecisions.filter((row) => row.live_shadow_agree !== null).length
      ? Number(
          (
            liveDecisions.filter((row) => row.live_shadow_agree === true).length /
            liveDecisions.filter((row) => row.live_shadow_agree !== null).length
          ).toFixed(3),
        )
      : null,
    liveShadowStructuredComparisonCount: liveDecisions.filter(
      (row) => row.live_shadow_parity_mode === 'structured_v1' && row.live_shadow_agree !== null,
    ).length,
    liveShadowStructuredMismatchCount: liveDecisions.reduce(
      (sum, row) =>
        sum + (row.live_shadow_parity_mode === 'structured_v1' ? Number(row.live_shadow_mismatches?.length || 0) : 0),
      0,
    ),
    deliveryApplicationComparisonCount: decisions.filter((row) => row.delivery_application?.checked === true).length,
    deliveryApplicationMismatchCount: decisions.filter(
      (row) => row.delivery_application?.checked === true && row.delivery_application?.ok !== true,
    ).length,
    deliveryApplicationIssueCount: decisions.reduce(
      (sum, row) => sum + Number(row.delivery_application?.mismatches?.length || 0),
      0,
    ),
    deliveryApplicationRecoveryCount: decisions.filter((row) =>
      row.delivery_application?.configuration_transition?.kind?.includes('plain_recovery'),
    ).length,
    deliveryApplicationSpeakingTransitionCount: decisions.filter((row) =>
      row.delivery_application?.configuration_transition?.kind?.includes('speaking'),
    ).length,
    fallbackCount: turnRecords.filter((record) => record.tutorDeterministicFallback).length,
    leakFailureCount: turnRecords.filter((record) => record.tutorLeakAudit?.ok === false).length,
    decisions,
    publicInquiryBrief,
    publicTurns,
  };
}

function mean(values) {
  const finite = values
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map(Number)
    .filter(Number.isFinite);
  return finite.length ? Number((finite.reduce((sum, value) => sum + value, 0) / finite.length).toFixed(3)) : null;
}

function aggregateGroup(rows) {
  const ok = rows.filter((row) => row.childStatus === 'ok' && row.turnCount > 0);
  const breaks = ok.filter((row) => row.deferenceBreakByHorizon);
  const warranted = ok.filter((row) => row.firstWarrantTurn !== null);
  return {
    planned: rows.length,
    ok: ok.length,
    failed: rows.length - ok.length,
    meanLearnerRecordGrowth: mean(ok.map((row) => row.learnerRecordGrowth)),
    meanLearnerAnalysisCoverage: mean(ok.map((row) => row.learnerAnalysisCoverage)),
    learnerAnalysisErrors: ok.reduce((sum, row) => sum + Number(row.learnerAnalysisErrorCount || 0), 0),
    deferenceBreakRate: ok.length ? Number((breaks.length / ok.length).toFixed(3)) : null,
    meanDeferenceBreakTurn: mean(breaks.map((row) => row.firstUnhedgedOwnVoiceClaimTurn)),
    warrantedSessions: warranted.length,
    warrantedButUnrevised: warranted.filter((row) => row.warrantedButUnrevisedByHorizon).length,
    meanRevisionLagTurns: mean(warranted.map((row) => row.revisionLagTurns)),
    meanLiveWarrants: mean(ok.map((row) => row.liveWarrantCount)),
    meanShadowWarrants: mean(ok.map((row) => row.shadowWarrantCount)),
    overrideSessions: ok.filter((row) => row.overrideCount > 0).length,
    meanOverrides: mean(ok.map((row) => row.overrideCount)),
    meanGateOutcomeCoverage: mean(ok.map((row) => row.gateOutcomeCoverage)),
    meanLiveShadowAgreement: mean(ok.map((row) => row.liveShadowAgreement)),
    structuredParityComparisons: ok.reduce((sum, row) => sum + Number(row.liveShadowStructuredComparisonCount || 0), 0),
    structuredParityMismatches: ok.reduce((sum, row) => sum + Number(row.liveShadowStructuredMismatchCount || 0), 0),
    deliveryApplicationComparisons: ok.reduce(
      (sum, row) => sum + Number(row.deliveryApplicationComparisonCount || 0),
      0,
    ),
    deliveryApplicationMismatches: ok.reduce((sum, row) => sum + Number(row.deliveryApplicationMismatchCount || 0), 0),
    deliveryApplicationIssues: ok.reduce((sum, row) => sum + Number(row.deliveryApplicationIssueCount || 0), 0),
    deliveryApplicationRecoveries: ok.reduce((sum, row) => sum + Number(row.deliveryApplicationRecoveryCount || 0), 0),
    deliveryApplicationSpeakingTransitions: ok.reduce(
      (sum, row) => sum + Number(row.deliveryApplicationSpeakingTransitionCount || 0),
      0,
    ),
    fallbacks: ok.reduce((sum, row) => sum + row.fallbackCount, 0),
    leakFailures: ok.reduce((sum, row) => sum + row.leakFailureCount, 0),
  };
}

export function aggregateAdaptiveWarrantStudy(
  rows,
  { horizon = DEFAULT_HORIZON, profiles = STUDY_PROFILES, conditions = STUDY_CONDITIONS, worlds = null } = {},
) {
  const studyWorlds = worlds ? [...worlds] : [...new Set(rows.map((row) => row.world).filter(Boolean))];
  const byCell = {};
  for (const profile of profiles) {
    byCell[profile] = {};
    for (const condition of conditions) {
      byCell[profile][condition.id] = aggregateGroup(
        rows.filter((row) => row.profile === profile && row.condition === condition.id),
      );
    }
  }
  const byWorld = {};
  for (const world of studyWorlds) {
    byWorld[world] = {};
    for (const profile of profiles) {
      byWorld[world][profile] = {};
      for (const condition of conditions) {
        byWorld[world][profile][condition.id] = aggregateGroup(
          rows.filter((row) => row.world === world && row.profile === profile && row.condition === condition.id),
        );
      }
    }
  }
  const pairedContrasts = {};
  for (const profile of profiles) {
    const pairs = [];
    const observePairs = [];
    const profileRows = rows.filter((row) => row.profile === profile && row.childStatus === 'ok');
    const bySeed = new Map();
    for (const row of profileRows) {
      const pairKey = `${row.world || 'default'}:${row.seed}`;
      if (!bySeed.has(pairKey)) bySeed.set(pairKey, {});
      bySeed.get(pairKey)[row.condition] = row;
    }
    for (const [pairKey, cells] of bySeed) {
      if (!cells.baseline) continue;
      const [world, seedText] = pairKey.split(':');
      const seed = Number(seedText);
      const baselineBreak = cells.baseline.firstUnhedgedOwnVoiceClaimTurn ?? horizon + 1;
      if (cells.intervening) {
        const activeBreak = cells.intervening.firstUnhedgedOwnVoiceClaimTurn ?? horizon + 1;
        pairs.push({
          world: world === 'default' ? null : world,
          seed,
          learnerRecordGrowthDifference: cells.intervening.learnerRecordGrowth - cells.baseline.learnerRecordGrowth,
          deferenceBreakRateDifference:
            Number(cells.intervening.deferenceBreakByHorizon) - Number(cells.baseline.deferenceBreakByHorizon),
          deferenceBreakTurnDifference: activeBreak - baselineBreak,
        });
      }
      if (cells.instrumented) {
        const observeBreak = cells.instrumented.firstUnhedgedOwnVoiceClaimTurn ?? horizon + 1;
        observePairs.push({
          world: world === 'default' ? null : world,
          seed,
          learnerRecordGrowthDifference: cells.instrumented.learnerRecordGrowth - cells.baseline.learnerRecordGrowth,
          deferenceBreakRateDifference:
            Number(cells.instrumented.deferenceBreakByHorizon) - Number(cells.baseline.deferenceBreakByHorizon),
          deferenceBreakTurnDifference: observeBreak - baselineBreak,
        });
      }
    }
    pairedContrasts[profile] = {
      pairs: pairs.length,
      instrumentedPairs: observePairs.length,
      activeMinusBaselineLearnerRecordGrowth: mean(pairs.map((row) => row.learnerRecordGrowthDifference)),
      activeMinusBaselineDeferenceBreakRate: mean(pairs.map((row) => row.deferenceBreakRateDifference)),
      activeMinusBaselineDeferenceBreakTurn: mean(pairs.map((row) => row.deferenceBreakTurnDifference)),
      instrumentedMinusBaselineLearnerRecordGrowth: mean(observePairs.map((row) => row.learnerRecordGrowthDifference)),
      instrumentedMinusBaselineDeferenceBreakRate: mean(observePairs.map((row) => row.deferenceBreakRateDifference)),
      instrumentedMinusBaselineDeferenceBreakTurn: mean(observePairs.map((row) => row.deferenceBreakTurnDifference)),
      rows: pairs,
      instrumentedRows: observePairs,
    };
  }
  return {
    axes: { worlds: studyWorlds, profiles: [...profiles], conditions: conditions.map((row) => ({ ...row })) },
    byCell,
    byWorld,
    pairedContrasts,
  };
}

export function resolveAdaptiveWarrantStudyStatus(
  rows,
  jobs,
  {
    dryRun = false,
    horizon = DEFAULT_HORIZON,
    requireStructuredParity = false,
    requireDeliveryApplication = false,
  } = {},
) {
  if (rows.length !== jobs.length) return 'incomplete';
  if (dryRun) return rows.every((row) => row.childStatus === 'dry_run') ? 'dry_run' : 'incomplete';
  if (!rows.every((row) => row.childStatus === 'ok')) return 'incomplete';
  const analysisValid = rows.every(
    (row) =>
      row.turnCount === horizon &&
      row.learnerAnalysisCallCount === row.turnCount &&
      row.learnerAnalysisErrorCount === 0 &&
      row.learnerAnalysisPromptFailureCount === 0 &&
      Number(row.promptAuditFailureCount || 0) === 0 &&
      Number(row.promptAuditRecoveryCount || 0) === 0 &&
      row.learnerAnalysisCoverage === 1,
  );
  if (!analysisValid) return 'invalid_analysis';
  if (
    requireStructuredParity &&
    !rows.every((row) => {
      const decisionTurns = (row.decisions || []).map((decision) => Number(decision.turn)).sort((a, b) => a - b);
      const expectedTurns = Array.from({ length: horizon }, (_, index) => index + 1);
      return (
        JSON.stringify(decisionTurns) === JSON.stringify(expectedTurns) &&
        row.liveShadowStructuredComparisonCount === horizon &&
        row.liveShadowStructuredMismatchCount === 0
      );
    })
  ) {
    return 'invalid_parity';
  }
  if (
    requireDeliveryApplication &&
    !rows.every((row) => {
      const applications = (row.decisions || []).map((decision) => decision.delivery_application);
      return (
        applications.length === horizon &&
        applications.every(
          (application) =>
            application?.checked === true && application.ok === true && application.mode === row.warrantGateMode,
        ) &&
        row.deliveryApplicationComparisonCount === horizon &&
        row.deliveryApplicationMismatchCount === 0 &&
        row.deliveryApplicationIssueCount === 0
      );
    })
  ) {
    return 'invalid_delivery_application';
  }
  return 'complete';
}

export function buildBlindedAnnotationCorpus(
  rows,
  {
    perCell = 2,
    studyId = 'study',
    samplingSeed = studyId,
    offsetPerCell = 0,
    sampleIdPrefix = 'case',
    predictionBalanced = false,
    profiles = STUDY_PROFILES,
    conditions = STUDY_CONDITIONS,
    worlds = null,
    includeAllDecisions = false,
    minimumTurn = 2,
  } = {},
) {
  const cases = [];
  const key = [];
  const studyWorlds = worlds ? [...worlds] : [...new Set(rows.map((row) => row.world).filter(Boolean))];
  const worldAxis = studyWorlds.length ? studyWorlds : [null];
  for (const world of worldAxis) {
    for (const profile of profiles) {
      for (const condition of conditions) {
        const sortedCandidates = rows
          .filter(
            (row) =>
              (world === null || row.world === world) &&
              row.profile === profile &&
              row.condition === condition.id &&
              row.childStatus === 'ok',
          )
          .flatMap((row) =>
            row.decisions.map((decision) => ({ row, decision })).filter(({ decision }) => decision.turn >= minimumTurn),
          )
          .sort((left, right) =>
            sha256(`${samplingSeed}|${left.row.jobId}|${left.decision.turn}`).localeCompare(
              sha256(`${samplingSeed}|${right.row.jobId}|${right.decision.turn}`),
            ),
          );
        const available = sortedCandidates.slice(offsetPerCell);
        const candidates = includeAllDecisions
          ? available
          : predictionBalanced
            ? predictionBalancedCases(available, perCell)
            : available.slice(0, perCell);
        for (const { row, decision } of candidates) {
          const priorTurns = row.publicTurns.filter((turn) => turn.turn < decision.turn);
          const current = row.publicTurns.find((turn) => turn.turn === decision.turn);
          const decisionProjection = decision.gate || decision.shadow || {};
          const availability = decisionProjection.inquiry_completion?.checks || {};
          const reducerInputs = decisionProjection.input_snapshot?.current_reducer_inputs || {};
          const priorOutcome = decisionProjection.prior_turn_outcome || null;
          const learnerRecordTrajectory = row.publicTurns
            .filter((publicTurn) => publicTurn.turn <= decision.turn)
            .map((publicTurn) => ({
              turn: publicTurn.turn,
              grounded_count: publicTurn.grounded_count,
              voiced_derived_count: publicTurn.voiced_derived_count,
              total: publicTurn.dag_total,
            }));
          const corpusCase = {
            public_inquiry_brief: row.publicInquiryBrief || null,
            transcript_before_decision: priorTurns.map(({ turn, learner, tutor }) => ({ turn, learner, tutor })),
            current_learner_turn: current ? { turn: current.turn, learner: current.learner } : null,
            learner_record_at_decision: current
              ? {
                  grounded_count: current.grounded_count,
                  voiced_derived_count: current.voiced_derived_count,
                  total: current.dag_total,
                }
              : null,
            learner_record_trajectory: learnerRecordTrajectory,
            strategy_in_force: decision.strategy_in_force,
            prior_delivered_action_family:
              decisionProjection.prior_delivered_action_family || decision.strategy_in_force || null,
            pre_gate_proposed_action_family:
              decisionProjection.pre_gate_proposed_action_family || decision.actual_family || null,
            public_evidence_availability: {
              known: availability.release_scope_known === true,
              authored_release_count: Number(availability.authored_release_count || 0),
              released_before_decision_count: Number(availability.released_before_decision_count || 0),
              due_now_count: Number(availability.due_evidence_count || 0),
              future_licensed_count: Number(availability.future_licensed_evidence_count || 0),
              remaining_licensed_count: Number(availability.remaining_licensed_evidence_count || 0),
              release_scope_exhausted: availability.release_scope_exhausted === true,
            },
            normative_action_contract: decisionProjection.action_contract?.contract || null,
            descriptive_evidence_at_decision: {
              dag_growth:
                decisionProjection.dag_growth === null || decisionProjection.dag_growth === undefined
                  ? null
                  : Number(decisionProjection.dag_growth),
              turns_since_dag_growth: Number(decisionProjection.turns_since_dag_growth || 0),
              trouble_turns: structuredClone(reducerInputs.trouble_turns || []),
              complaint_turns: structuredClone(decisionProjection.complaint_turns || []),
              prior_tutor_outcome: priorOutcome
                ? {
                    turn: priorOutcome.turn,
                    uptake_ok: priorOutcome.uptake_ok,
                    repetition_max_similarity: priorOutcome.repetition_max_similarity,
                    deterministic_fallback: priorOutcome.deterministic_fallback,
                    mechanical_repair: priorOutcome.mechanical_repair,
                    guard_outcome: priorOutcome.guard_outcome,
                    defeaters: structuredClone(priorOutcome.defeaters || []),
                  }
                : null,
              pacing_signal: structuredClone(
                decisionProjection.input_snapshot?.pacing_signal || priorOutcome?.pacing_signal || null,
              ),
              epistemic_checks: {
                strict_grounded_asserted: availability.strict_grounded_asserted === true,
                answer_entailed_unasserted: availability.answer_entailed_unasserted === true,
                released_evidence_integrated: availability.released_evidence_integrated !== false,
                unsupported_assertion_count: Number(availability.unsupported_assertion_count || 0),
                active_dropped_fact_count: Number(availability.active_dropped_fact_count || 0),
              },
            },
            speech_act: null,
            open_obligation_source_turns: null,
            obligation_state: null,
            inquiry_state: null,
            commitment_transition_warranted: null,
            current_candidate_override_required: null,
            primary_warrant_basis: null,
            revision_warranted: null,
            recommended_action_family: null,
            divergence_by_dimension: Object.fromEntries(
              ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS.map((dimension) => [
                dimension,
                { interpretation: null, magnitude: null, persistence: null, note: null },
              ]),
            ),
            note: null,
          };
          const sampleId = `${sampleIdPrefix}-${canonicalJsonSha256({
            schema: 'machinespirits.adaptation-refinement.annotation-opaque-sample-id.v1',
            study_id: studyId,
            sampling_seed: String(samplingSeed),
            source_locator_sha256: sha256(`${row.jobId}|${decision.turn}`),
            source_fingerprint: annotationCaseFingerprint(corpusCase),
            projection_fingerprint: annotationProjectionFingerprint(corpusCase),
          }).slice(0, 24)}`;
          corpusCase.sample_id = sampleId;
          cases.push(corpusCase);
          key.push({
            sample_id: sampleId,
            source_fingerprint: annotationCaseFingerprint(cases.at(-1)),
            projection_fingerprint: annotationProjectionFingerprint(cases.at(-1)),
            job_id: row.jobId,
            world: row.world || world,
            profile: row.profile,
            condition: row.condition,
            seed: row.seed,
            trace: row.tracePath,
            turn: decision.turn,
            shadow: decision.shadow,
            gate: decision.gate,
            actual_family: decision.actual_family,
            revised: decision.revised,
          });
        }
      }
    }
  }
  const uniqueSampleIds = new Set(cases.map((row) => row.sample_id));
  if (uniqueSampleIds.size !== cases.length) {
    throw new Error('opaque annotation sample id collision');
  }
  const pairedCases = cases
    .map((corpusCase, index) => ({ corpusCase, keyCase: key[index] }))
    .sort((left, right) =>
      canonicalJsonSha256({
        schema: 'machinespirits.adaptation-refinement.annotation-global-order.v1',
        study_id: studyId,
        sampling_seed: String(samplingSeed),
        sample_id: left.corpusCase.sample_id,
      }).localeCompare(
        canonicalJsonSha256({
          schema: 'machinespirits.adaptation-refinement.annotation-global-order.v1',
          study_id: studyId,
          sampling_seed: String(samplingSeed),
          sample_id: right.corpusCase.sample_id,
        }),
      ),
    );
  const shuffledCases = pairedCases.map(({ corpusCase }) => corpusCase);
  const shuffledKey = pairedCases.map(({ keyCase }) => keyCase);
  return {
    corpus: {
      schema: ADAPTIVE_WARRANT_ANNOTATION_SCHEMA,
      study_id: studyId,
      blinded: true,
      instructions:
        'Independently label the public speech act, obligation lifecycle, inquiry completion, commitment transition, candidate override, primary warrant basis, successor family, and all six normative/descriptive divergence dimensions. For each dimension label interpretation (aligned, productive, stalled, unsafe), magnitude (none, low, moderate, high), and persistence (none, single_turn, sustained). Use only the frozen public inquiry brief, transcript, normative action contract, and raw decision-time evidence. Audit structured counters against the public transcript; do not treat a counter or learner analysis as self-validating. Productive departure is divergence without pedagogical failure. An answerable public obligation outranks closure; closure requires exhausted licensed evidence, a supported terminal learner assertion, and no actionable open obligation. Use uncertain when public inputs do not determine a label; never infer from hidden evidence or the eventual tutor reply.',
      allowed_recommended_action_families: [...ANNOTATION_ACTION_FAMILIES, 'hold', 'uncertain'],
      allowed_speech_acts: [...ANNOTATION_SPEECH_ACTS],
      allowed_obligation_states: [...ANNOTATION_OBLIGATION_STATES],
      allowed_inquiry_states: [...ANNOTATION_INQUIRY_STATES],
      allowed_primary_warrant_bases: [...ANNOTATION_WARRANT_BASES],
      divergence_dimensions: [...ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS],
      allowed_divergence_interpretations: [...ANNOTATION_DIVERGENCE_INTERPRETATIONS],
      allowed_divergence_magnitudes: [...ANNOTATION_DIVERGENCE_MAGNITUDES],
      allowed_divergence_persistence: [...ANNOTATION_DIVERGENCE_PERSISTENCE],
      sampling: {
        cases_per_world_profile_condition_cell: includeAllDecisions ? 'all' : perCell,
        minimum_decision_turn: minimumTurn,
        all_available_decisions: includeAllDecisions,
        prediction_balanced_within_cell: predictionBalanced,
        prediction_balance_is_diagnostic_not_prevalence_weighted: predictionBalanced,
        ordering: 'deterministic_global_sha256_v1',
        sample_id_scheme: 'opaque_sha256_96bit_v1',
      },
      cases: shuffledCases,
    },
    key: {
      schema: `${ADAPTIVE_WARRANT_ANNOTATION_SCHEMA}.key`,
      study_id: studyId,
      blinded: false,
      cases: shuffledKey,
    },
  };

  function predictionBalancedCases(candidates, count) {
    const predicted = (entry) =>
      entry.decision?.gate?.revision_warranted ?? entry.decision?.shadow?.revision_warranted ?? null;
    const selected = [];
    const positive = candidates.find((entry) => predicted(entry) === true);
    const negative = candidates.find((entry) => predicted(entry) === false);
    if (positive) selected.push(positive);
    if (negative && negative !== positive) selected.push(negative);
    for (const entry of candidates) {
      if (selected.length >= count) break;
      if (!selected.includes(entry)) selected.push(entry);
    }
    return selected.slice(0, count);
  }
}

export function annotationCaseFingerprint(row) {
  return canonicalJsonSha256({
    schema: 'machinespirits.adaptation-refinement.annotation-source-fingerprint.v1',
    transcript_before_decision: row.transcript_before_decision,
    current_learner_turn: row.current_learner_turn,
    learner_record_at_decision: row.learner_record_at_decision,
    learner_record_trajectory: row.learner_record_trajectory,
  });
}

export function annotationProjectionFingerprint(row) {
  return canonicalJsonSha256({
    schema: 'machinespirits.adaptation-refinement.annotation-projection-fingerprint.v1',
    source: annotationCaseFingerprint(row),
    public_inquiry_brief: row.public_inquiry_brief,
    strategy_in_force: row.strategy_in_force,
    prior_delivered_action_family: row.prior_delivered_action_family,
    pre_gate_proposed_action_family: row.pre_gate_proposed_action_family,
    public_evidence_availability: row.public_evidence_availability,
    normative_action_contract: row.normative_action_contract,
    descriptive_evidence_at_decision: row.descriptive_evidence_at_decision,
  });
}

function annotationLabel(value) {
  const label = String(value || '')
    .trim()
    .toLowerCase();
  return ['yes', 'no', 'uncertain'].includes(label) ? label : null;
}

function annotationActionFamily(value) {
  const family = String(value || '').trim();
  return [...ANNOTATION_ACTION_FAMILIES, 'hold', 'uncertain'].includes(family) ? family : null;
}

function annotationEnum(value, allowed) {
  const label = String(value || '').trim();
  return allowed.includes(label) ? label : null;
}

function exactUniqueAnnotationSampleIds(rows, label) {
  if (!Array.isArray(rows)) throw new Error(`${label} cases must be an array`);
  const ids = rows.map((row) => oneLine(row?.sample_id));
  if (ids.some((sampleId) => !sampleId)) throw new Error(`${label} contains an invalid sample id`);
  if (new Set(ids).size !== ids.length) throw new Error(`${label} contains duplicate sample ids`);
  return ids.sort();
}

function assertExactAnnotationFields(value, allowedFields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(value).filter((field) => !allowed.has(field));
  if (unknown.length) throw new Error(`${label} contains unknown fields: ${unknown.sort().join(', ')}`);
}

function assertV3AnnotationResponseShape(response) {
  assertExactAnnotationFields(response, V3_ANNOTATION_RESPONSE_FIELDS, 'v3 annotation response');
  for (const field of ['schema', 'study_id', 'corpus_sha256', 'annotator_id', 'annotation_run_id']) {
    if (field in response && typeof response[field] !== 'string') {
      throw new Error(`v3 annotation response ${field} must be a string`);
    }
  }
  if (!Array.isArray(response.cases)) throw new Error('v3 annotation response cases must be an array');
  for (const [index, row] of response.cases.entries()) {
    const label = `v3 annotation response case ${index + 1}`;
    assertExactAnnotationFields(row, V3_ANNOTATION_CASE_FIELDS, label);
    for (const field of V3_ANNOTATION_CASE_SCALAR_FIELDS) {
      if (typeof row[field] !== 'string') throw new Error(`${label} ${field} must be a string`);
    }
    if (!Array.isArray(row.open_obligation_source_turns)) {
      throw new Error(`${label} open_obligation_source_turns must be an array`);
    }
    if (
      row.open_obligation_source_turns.some((turn) => typeof turn !== 'number' || !Number.isInteger(turn) || turn < 1)
    ) {
      throw new Error(`${label} open_obligation_source_turns must contain positive integers`);
    }
  }
}

function assertV4AnnotationResponseShape(response) {
  assertExactAnnotationFields(response, V3_ANNOTATION_RESPONSE_FIELDS, 'v4 annotation response');
  for (const field of ['schema', 'study_id', 'corpus_sha256', 'annotator_id', 'annotation_run_id']) {
    if (field in response && typeof response[field] !== 'string') {
      throw new Error(`v4 annotation response ${field} must be a string`);
    }
  }
  if (!Array.isArray(response.cases)) throw new Error('v4 annotation response cases must be an array');
  for (const [index, row] of response.cases.entries()) {
    const label = `v4 annotation response case ${index + 1}`;
    assertExactAnnotationFields(row, V4_ANNOTATION_CASE_FIELDS, label);
    for (const field of V4_ANNOTATION_CASE_SCALAR_FIELDS) {
      if (typeof row[field] !== 'string') throw new Error(`${label} ${field} must be a string`);
    }
    if (!Array.isArray(row.open_obligation_source_turns)) {
      throw new Error(`${label} open_obligation_source_turns must be an array`);
    }
    if (
      row.open_obligation_source_turns.some((turn) => typeof turn !== 'number' || !Number.isInteger(turn) || turn < 1)
    ) {
      throw new Error(`${label} open_obligation_source_turns must contain positive integers`);
    }
    assertExactAnnotationFields(
      row.divergence_by_dimension,
      ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS,
      `${label} divergence_by_dimension`,
    );
    for (const dimension of ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS) {
      const divergence = row.divergence_by_dimension[dimension];
      assertExactAnnotationFields(divergence, V4_DIVERGENCE_FIELDS, `${label} ${dimension} divergence`);
      for (const field of V4_DIVERGENCE_FIELDS) {
        if (typeof divergence[field] !== 'string') {
          throw new Error(`${label} ${dimension} divergence ${field} must be a string`);
        }
      }
    }
  }
}

export function validateBlindedAnnotationResponse({ response, corpus, expectedCorpusSha256 = null } = {}) {
  if (
    ![
      'machinespirits.adaptation-refinement.warrant-annotation-response.v1',
      'machinespirits.adaptation-refinement.warrant-annotation-response.v2',
      'machinespirits.adaptation-refinement.warrant-annotation-response.v3',
      'machinespirits.adaptation-refinement.warrant-annotation-response.v4',
    ].includes(response?.schema)
  ) {
    throw new Error('annotation response has an unsupported schema');
  }
  if (!corpus?.blinded || !Array.isArray(corpus.cases)) throw new Error('annotation corpus is not a blinded corpus');
  if (
    corpus.schema === ADAPTIVE_WARRANT_ANNOTATION_SCHEMA &&
    response.schema !== ADAPTIVE_WARRANT_ANNOTATION_RESPONSE_V4_SCHEMA
  ) {
    throw new Error('v4 annotation corpus requires a v4 annotation response');
  }
  if (corpus.schema === ADAPTIVE_WARRANT_ANNOTATION_SCHEMA) {
    if (!oneLine(response.annotator_id)) throw new Error('v4 annotation response requires annotator_id');
    if (!oneLine(response.annotation_run_id)) throw new Error('v4 annotation response requires annotation_run_id');
  }
  if (response.schema === ADAPTIVE_WARRANT_ANNOTATION_RESPONSE_V3_SCHEMA) {
    assertV3AnnotationResponseShape(response);
  }
  if (response.schema === ADAPTIVE_WARRANT_ANNOTATION_RESPONSE_V4_SCHEMA) {
    assertV4AnnotationResponseShape(response);
  }
  if (response.study_id !== corpus.study_id) throw new Error('annotation response study_id does not match the corpus');
  if (expectedCorpusSha256 && response.corpus_sha256 !== expectedCorpusSha256) {
    throw new Error('annotation response corpus_sha256 does not match the frozen corpus');
  }
  const expectedIds = corpus.cases.map((row) => row.sample_id).sort();
  const corpusById = new Map(corpus.cases.map((row) => [row.sample_id, row]));
  const responseIds = (response.cases || []).map((row) => row.sample_id).sort();
  if (new Set(responseIds).size !== responseIds.length)
    throw new Error('annotation response contains duplicate sample ids');
  if (JSON.stringify(responseIds) !== JSON.stringify(expectedIds)) {
    throw new Error(`annotation response must label exactly ${expectedIds.length} frozen cases`);
  }
  for (const row of response.cases) {
    const mechanism = response.schema.endsWith('.v3') || response.schema.endsWith('.v4');
    const v4 = response.schema.endsWith('.v4');
    if (!mechanism && !annotationLabel(row.revision_warranted)) {
      throw new Error(`annotation response ${row.sample_id} has an invalid revision_warranted label`);
    }
    if (mechanism) {
      if (!annotationEnum(row.speech_act, ANNOTATION_SPEECH_ACTS)) {
        throw new Error(`annotation response ${row.sample_id} has an invalid speech_act`);
      }
      if (!annotationEnum(row.obligation_state, ANNOTATION_OBLIGATION_STATES)) {
        throw new Error(`annotation response ${row.sample_id} has an invalid obligation_state`);
      }
      if (!annotationEnum(row.inquiry_state, ANNOTATION_INQUIRY_STATES)) {
        throw new Error(`annotation response ${row.sample_id} has an invalid inquiry_state`);
      }
      if (!annotationLabel(row.commitment_transition_warranted)) {
        throw new Error(`annotation response ${row.sample_id} has an invalid commitment_transition_warranted`);
      }
      if (!annotationLabel(row.current_candidate_override_required)) {
        throw new Error(`annotation response ${row.sample_id} has an invalid current_candidate_override_required`);
      }
      const basis = annotationEnum(row.primary_warrant_basis, ANNOTATION_WARRANT_BASES);
      if (!basis) throw new Error(`annotation response ${row.sample_id} has an invalid primary_warrant_basis`);
      if (
        !Array.isArray(row.open_obligation_source_turns) ||
        row.open_obligation_source_turns.some((turn) => !Number.isInteger(turn) || turn < 1)
      ) {
        throw new Error(`annotation response ${row.sample_id} has invalid open_obligation_source_turns`);
      }
      const sourceTurns = row.open_obligation_source_turns;
      if (new Set(sourceTurns).size !== sourceTurns.length) {
        throw new Error(`annotation response ${row.sample_id} has duplicate open_obligation_source_turns`);
      }
      const decisionTurn = Number(corpusById.get(row.sample_id)?.current_learner_turn?.turn);
      if (Number.isFinite(decisionTurn) && sourceTurns.some((turn) => turn > decisionTurn)) {
        throw new Error(`annotation response ${row.sample_id} has a future open obligation source turn`);
      }
      const obligationState = annotationEnum(row.obligation_state, ANNOTATION_OBLIGATION_STATES);
      if (['open', 'overdue', 'deferred'].includes(obligationState) && sourceTurns.length === 0) {
        throw new Error(`annotation response ${row.sample_id} requires an open obligation source turn`);
      }
      if (['none', 'satisfied', 'withdrawn_or_transferred'].includes(obligationState) && sourceTurns.length > 0) {
        throw new Error(`annotation response ${row.sample_id} cannot retain open source turns for ${obligationState}`);
      }
      const family = annotationActionFamily(row.recommended_action_family);
      if (!family) throw new Error(`annotation response ${row.sample_id} has an invalid recommended_action_family`);
      if (basis === 'none' && family !== 'hold') {
        throw new Error(`annotation response ${row.sample_id} must use hold when primary_warrant_basis is none`);
      }
      if (basis === 'uncertain' && family !== 'uncertain') {
        throw new Error(
          `annotation response ${row.sample_id} must use uncertain when primary_warrant_basis is uncertain`,
        );
      }
      if (!['none', 'uncertain'].includes(basis) && ['hold', 'uncertain'].includes(family)) {
        throw new Error(`annotation response ${row.sample_id} requires an action family for a positive warrant basis`);
      }
      const publicCase = corpusById.get(row.sample_id) || {};
      const publicContract = publicCase.normative_action_contract || {};
      if (basis === 'action_contract' && publicContract.transition?.revision_warranted !== true) {
        throw new Error(
          `annotation response ${row.sample_id} cannot use action_contract without a public contract transition`,
        );
      }
      if (
        basis === 'action_contract' &&
        publicContract.transition?.recommended_action_family &&
        family !== publicContract.transition.recommended_action_family
      ) {
        throw new Error(
          `annotation response ${row.sample_id} action_contract family does not match the public contract successor`,
        );
      }
      if (
        basis === 'inquiry_completion' &&
        row.inquiry_state !== 'complete' &&
        publicCase.pre_gate_proposed_action_family !== 'close_inquiry'
      ) {
        throw new Error(
          `annotation response ${row.sample_id} cannot use inquiry_completion without completion or a close candidate`,
        );
      }
      if (basis === 'public_obligation' && !['open', 'overdue'].includes(obligationState)) {
        throw new Error(
          `annotation response ${row.sample_id} cannot use public_obligation without actionable public debt`,
        );
      }
      if (v4) {
        for (const dimension of ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS) {
          const divergence = row.divergence_by_dimension?.[dimension] || {};
          const interpretation = annotationEnum(
            divergence.interpretation,
            ANNOTATION_DIVERGENCE_INTERPRETATIONS,
          );
          const magnitude = annotationEnum(divergence.magnitude, ANNOTATION_DIVERGENCE_MAGNITUDES);
          const persistence = annotationEnum(divergence.persistence, ANNOTATION_DIVERGENCE_PERSISTENCE);
          if (!interpretation || !magnitude || !persistence) {
            throw new Error(`annotation response ${row.sample_id} has an invalid ${dimension} divergence label`);
          }
          if (interpretation === 'aligned' && (magnitude !== 'none' || persistence !== 'none')) {
            throw new Error(
              `annotation response ${row.sample_id} aligned ${dimension} divergence must have none magnitude and persistence`,
            );
          }
          if (interpretation === 'uncertain' && (magnitude !== 'uncertain' || persistence !== 'uncertain')) {
            throw new Error(
              `annotation response ${row.sample_id} uncertain ${dimension} divergence must be wholly uncertain`,
            );
          }
          if (!['aligned', 'uncertain'].includes(interpretation) && magnitude === 'none') {
            throw new Error(
              `annotation response ${row.sample_id} non-aligned ${dimension} divergence requires non-none magnitude`,
            );
          }
          if (oneLine(divergence.note).length < ADAPTIVE_WARRANT_ANNOTATION_MIN_NOTE_CHARACTERS) {
            throw new Error(
              `annotation response ${row.sample_id} ${dimension} divergence requires an evidence note of at least ${ADAPTIVE_WARRANT_ANNOTATION_MIN_NOTE_CHARACTERS} characters`,
            );
          }
        }
      }
    } else if (response.schema.endsWith('.v2')) {
      const family = annotationActionFamily(row.recommended_action_family);
      if (!family) {
        throw new Error(`annotation response ${row.sample_id} has an invalid recommended_action_family`);
      }
      const label = annotationLabel(row.revision_warranted);
      if (label === 'no' && family !== 'hold') {
        throw new Error(`annotation response ${row.sample_id} must use hold when revision_warranted is no`);
      }
      if (label === 'uncertain' && family !== 'uncertain') {
        throw new Error(`annotation response ${row.sample_id} must use uncertain when revision_warranted is uncertain`);
      }
      if (label === 'yes' && ['hold', 'uncertain'].includes(family)) {
        throw new Error(
          `annotation response ${row.sample_id} requires an action family when revision_warranted is yes`,
        );
      }
    }
    if (
      response.schema.endsWith('.v4') &&
      oneLine(row.note).length < ADAPTIVE_WARRANT_ANNOTATION_MIN_NOTE_CHARACTERS
    ) {
      throw new Error(
        `annotation response ${row.sample_id} requires a decision-time evidence note of at least ${ADAPTIVE_WARRANT_ANNOTATION_MIN_NOTE_CHARACTERS} characters`,
      );
    }
    if (!response.schema.endsWith('.v4') && !oneLine(row.note)) {
      throw new Error(`annotation response ${row.sample_id} requires a decision-time evidence note`);
    }
  }
  return {
    ok: true,
    cases: responseIds.length,
    counts: Object.fromEntries(
      ['yes', 'no', 'uncertain'].map((label) => [
        label,
        response.cases.filter(
          (row) =>
            annotationLabel(
              response.schema.endsWith('.v3') || response.schema.endsWith('.v4')
                ? row.commitment_transition_warranted
                : row.revision_warranted,
            ) === label,
        ).length,
      ]),
    ),
  };
}

function ratio(numerator, denominator) {
  return denominator ? Number((numerator / denominator).toFixed(3)) : null;
}

function v3WarrantLabel(row) {
  const basis = annotationEnum(row?.primary_warrant_basis, ANNOTATION_WARRANT_BASES);
  if (basis === 'none') return 'no';
  if (!basis || basis === 'uncertain') return 'uncertain';
  return 'yes';
}

function hardConsensus(left, right, uncertain = 'uncertain') {
  return left && right && left === right && left !== uncertain ? left : uncertain;
}

function annotationDivergence(row, dimension) {
  const value = row?.divergence_by_dimension?.[dimension] || {};
  return {
    interpretation: annotationEnum(value.interpretation, ANNOTATION_DIVERGENCE_INTERPRETATIONS),
    magnitude: annotationEnum(value.magnitude, ANNOTATION_DIVERGENCE_MAGNITUDES),
    persistence: annotationEnum(value.persistence, ANNOTATION_DIVERGENCE_PERSISTENCE),
  };
}

function divergencePersistenceBand(value) {
  const persistence = Number(value);
  if (!Number.isFinite(persistence) || persistence < 0) return null;
  if (persistence === 0) return 'none';
  if (persistence === 1) return 'single_turn';
  return 'sustained';
}

function predictedDivergence(decision, dimension) {
  const value = (decision?.divergence || []).find((row) => row?.dimension === dimension) || null;
  if (!value) return null;
  return {
    interpretation: annotationEnum(value.interpretation, ADAPTIVE_WARRANT_DIVERGENCE_INTERPRETATIONS),
    magnitude: annotationEnum(value.magnitude, ADAPTIVE_WARRANT_DIVERGENCE_MAGNITUDES),
    persistence: divergencePersistenceBand(value.persistence),
  };
}

function predictedWarrantBasis(decision) {
  const basis = String(decision?.warrant_basis || '');
  if (basis.startsWith('immediate:')) return 'immediate_repair';
  if (basis.startsWith('public_obligation_')) return 'public_obligation';
  if (basis.startsWith('inquiry_complete:')) return 'inquiry_completion';
  if (basis.startsWith('inquiry_incomplete_candidate:')) return 'candidate_safety';
  if (basis.startsWith('contract_')) return 'action_contract';
  if (basis.startsWith('register_escalation:') || basis.startsWith('accumulated:')) {
    return 'register_or_accumulated_trouble';
  }
  return basis === 'none' || basis === 'masked_by_engaged_analytic' ? 'none' : null;
}

function predictedObligationState(decision) {
  const ledger = decision?.public_obligation;
  if (!ledger) return null;
  const obligations = ledger.obligations || [];
  const blockingStatus = ledger.blocking_obligation?.status;
  if (['overdue', 'reactivated'].includes(blockingStatus)) return 'overdue';
  if (blockingStatus === 'open') return 'open';
  if (obligations.some((row) => ['overdue', 'reactivated'].includes(row.status))) return 'overdue';
  if (obligations.some((row) => row.status === 'open')) return 'open';
  if (obligations.some((row) => row.status === 'deferred')) return 'deferred';
  const latest = obligations.at(-1);
  if (!latest) return 'none';
  if (['withdrawn', 'transferred_to_learner'].includes(latest.status)) return 'withdrawn_or_transferred';
  return annotationEnum(latest.status, ANNOTATION_OBLIGATION_STATES) || 'none';
}

function predictedOpenObligationSourceTurns(decision) {
  const obligations = decision?.public_obligation?.obligations;
  if (!Array.isArray(obligations)) return null;
  const unresolved = obligations.filter((row) => ['open', 'overdue', 'reactivated', 'deferred'].includes(row?.status));
  const sourceTurns = unresolved.flatMap((row) => {
    if (Array.isArray(row?.source_turns) && row.source_turns.length) return row.source_turns.map(Number);
    const historyTurns = (row?.history || [])
      .filter((event) => ['created', 'reminded'].includes(event?.type))
      .map((event) => Number(event?.turn));
    return historyTurns.length ? historyTurns : [Number(row?.created_turn)];
  });
  if (sourceTurns.some((turn) => !Number.isInteger(turn) || turn < 1)) return null;
  return [...new Set(sourceTurns)].sort((left, right) => left - right);
}

function macroF1(rows, labels, consensusField, predictionField) {
  const scores = labels.map((label) => {
    const tp = rows.filter((row) => row[consensusField] === label && row[predictionField] === label).length;
    const fp = rows.filter((row) => row[consensusField] !== label && row[predictionField] === label).length;
    const fn = rows.filter((row) => row[consensusField] === label && row[predictionField] !== label).length;
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    return precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  });
  return scores.length ? Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(3)) : null;
}

export function scoreBlindedAnnotations({ annotatorA, annotatorB, key } = {}) {
  const v4 = annotatorA?.schema?.endsWith('.v4') && annotatorB?.schema?.endsWith('.v4');
  const v3 =
    (annotatorA?.schema?.endsWith('.v3') || annotatorA?.schema?.endsWith('.v4')) &&
    (annotatorB?.schema?.endsWith('.v3') || annotatorB?.schema?.endsWith('.v4'));
  const firstIds = exactUniqueAnnotationSampleIds(annotatorA?.cases, 'annotator A');
  const secondIds = exactUniqueAnnotationSampleIds(annotatorB?.cases, 'annotator B');
  const keyIds = exactUniqueAnnotationSampleIds(key?.cases, 'annotation key');
  if (JSON.stringify(firstIds) !== JSON.stringify(secondIds) || JSON.stringify(firstIds) !== JSON.stringify(keyIds)) {
    throw new Error('annotator responses and annotation key must contain exactly the same sample ids');
  }
  const first = new Map((annotatorA?.cases || []).map((row) => [row.sample_id, row]));
  const second = new Map((annotatorB?.cases || []).map((row) => [row.sample_id, row]));
  const keyed = new Map((key?.cases || []).map((row) => [row.sample_id, row]));
  const sampleIds = firstIds;
  const cases = sampleIds.map((sampleId) => {
    const firstRow = first.get(sampleId) || {};
    const secondRow = second.get(sampleId) || {};
    const labelA = v3 ? v3WarrantLabel(firstRow) : annotationLabel(firstRow.revision_warranted);
    const labelB = v3 ? v3WarrantLabel(secondRow) : annotationLabel(secondRow.revision_warranted);
    const familyA = annotationActionFamily(first.get(sampleId)?.recommended_action_family);
    const familyB = annotationActionFamily(second.get(sampleId)?.recommended_action_family);
    const consensus = labelA === labelB && ['yes', 'no'].includes(labelA) ? labelA : 'uncertain';
    const keyRow = keyed.get(sampleId) || null;
    const projection = keyRow?.gate || keyRow?.shadow || null;
    const rawPrediction = projection?.revision_warranted;
    const predicted = typeof rawPrediction === 'boolean' ? (rawPrediction ? 'yes' : 'no') : null;
    const rawPredictedFamily = projection?.policy?.family ?? null;
    const predictedFamily = predicted === 'no' ? 'hold' : annotationActionFamily(rawPredictedFamily);
    const speechActA = v3 ? annotationEnum(firstRow.speech_act, ANNOTATION_SPEECH_ACTS) : null;
    const speechActB = v3 ? annotationEnum(secondRow.speech_act, ANNOTATION_SPEECH_ACTS) : null;
    const obligationStateA = v3 ? annotationEnum(firstRow.obligation_state, ANNOTATION_OBLIGATION_STATES) : null;
    const obligationStateB = v3 ? annotationEnum(secondRow.obligation_state, ANNOTATION_OBLIGATION_STATES) : null;
    const inquiryStateA = v3 ? annotationEnum(firstRow.inquiry_state, ANNOTATION_INQUIRY_STATES) : null;
    const inquiryStateB = v3 ? annotationEnum(secondRow.inquiry_state, ANNOTATION_INQUIRY_STATES) : null;
    const basisA = v3 ? annotationEnum(firstRow.primary_warrant_basis, ANNOTATION_WARRANT_BASES) : null;
    const basisB = v3 ? annotationEnum(secondRow.primary_warrant_basis, ANNOTATION_WARRANT_BASES) : null;
    const commitmentA = v3 ? annotationLabel(firstRow.commitment_transition_warranted) : null;
    const commitmentB = v3 ? annotationLabel(secondRow.commitment_transition_warranted) : null;
    const overrideA = v3 ? annotationLabel(firstRow.current_candidate_override_required) : null;
    const overrideB = v3 ? annotationLabel(secondRow.current_candidate_override_required) : null;
    const commitmentTransitionConsensus = hardConsensus(commitmentA, commitmentB);
    const transitionConsensus =
      (v3 ? commitmentTransitionConsensus === 'yes' : consensus === 'yes') &&
      familyA === familyB &&
      ANNOTATION_ACTION_FAMILIES.includes(familyA)
        ? familyA
        : 'uncertain';
    const predictedCommitmentTransition = projection
      ? projection.commitment_transition_warranted
        ? 'yes'
        : 'no'
      : null;
    const sourceTurnsA = v3
      ? (firstRow.open_obligation_source_turns || []).map(Number).sort((left, right) => left - right)
      : [];
    const sourceTurnsB = v3
      ? (secondRow.open_obligation_source_turns || []).map(Number).sort((left, right) => left - right)
      : [];
    const sourceTurnsConsensus =
      JSON.stringify(sourceTurnsA) === JSON.stringify(sourceTurnsB) ? sourceTurnsA.map(Number) : null;
    const predictedSourceTurns = predictedOpenObligationSourceTurns(projection);
    const obligationStateConsensus = hardConsensus(obligationStateA, obligationStateB);
    const inquiryStateConsensus = hardConsensus(inquiryStateA, inquiryStateB);
    const inquiryChecks = projection?.inquiry_completion?.checks || {};
    const blockingGoldObligation = ['open', 'overdue'].includes(obligationStateConsensus);
    const licensedEvidenceRemains =
      Number(inquiryChecks.remaining_licensed_evidence_count || 0) > 0 ||
      Number(inquiryChecks.future_licensed_evidence_count || 0) > 0;
    const currentTurnObligationEvent = (projection?.public_obligation?.events || []).some(
      (event) =>
        ['created', 'reminded'].includes(event.type) &&
        (!Number.isFinite(Number(keyRow?.turn)) || Number(event.turn) === Number(keyRow.turn)),
    );
    const divergenceByDimension = Object.fromEntries(
      ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS.map((dimension) => {
        const divergenceA = v4 ? annotationDivergence(firstRow, dimension) : {};
        const divergenceB = v4 ? annotationDivergence(secondRow, dimension) : {};
        const predictedDivergenceRow = v4 ? predictedDivergence(projection, dimension) : null;
        const interpretationConsensus = hardConsensus(
          divergenceA.interpretation,
          divergenceB.interpretation,
        );
        const magnitudeConsensus = hardConsensus(divergenceA.magnitude, divergenceB.magnitude);
        const persistenceConsensus = hardConsensus(divergenceA.persistence, divergenceB.persistence);
        const fullyScored =
          interpretationConsensus !== 'uncertain' &&
          magnitudeConsensus !== 'uncertain' &&
          persistenceConsensus !== 'uncertain' &&
          predictedDivergenceRow !== null;
        return [
          dimension,
          {
            annotator_a_interpretation: divergenceA.interpretation || null,
            annotator_b_interpretation: divergenceB.interpretation || null,
            interpretation_consensus: interpretationConsensus,
            magnitude_consensus: magnitudeConsensus,
            persistence_consensus: persistenceConsensus,
            predicted_interpretation: predictedDivergenceRow?.interpretation || null,
            predicted_magnitude: predictedDivergenceRow?.magnitude || null,
            predicted_persistence: predictedDivergenceRow?.persistence || null,
            fully_scored: fullyScored,
            interpretation_match:
              interpretationConsensus !== 'uncertain' && predictedDivergenceRow
                ? interpretationConsensus === predictedDivergenceRow.interpretation
                : null,
            magnitude_match:
              magnitudeConsensus !== 'uncertain' && predictedDivergenceRow
                ? magnitudeConsensus === predictedDivergenceRow.magnitude
                : null,
            persistence_match:
              persistenceConsensus !== 'uncertain' && predictedDivergenceRow
                ? persistenceConsensus === predictedDivergenceRow.persistence
                : null,
            joint_match:
              fullyScored &&
              interpretationConsensus === predictedDivergenceRow.interpretation &&
              magnitudeConsensus === predictedDivergenceRow.magnitude &&
              persistenceConsensus === predictedDivergenceRow.persistence,
          },
        ];
      }),
    );
    return {
      sample_id: sampleId,
      annotator_a: labelA,
      annotator_b: labelB,
      annotator_a_action_family: familyA,
      annotator_b_action_family: familyB,
      action_family_consensus: hardConsensus(familyA, familyB),
      consensus,
      predicted,
      transition_consensus: transitionConsensus,
      predicted_action_family: predictedFamily,
      transition_scored: transitionConsensus !== 'uncertain',
      transition_match:
        transitionConsensus !== 'uncertain'
          ? predictedFamily !== null &&
            transitionConsensus === predictedFamily &&
            (!v3 || predictedCommitmentTransition === 'yes')
          : null,
      speech_act_consensus: hardConsensus(speechActA, speechActB),
      predicted_speech_act: projection?.public_obligation?.speech_act?.kind || null,
      obligation_state_consensus: obligationStateConsensus,
      predicted_obligation_state: predictedObligationState(projection),
      predicted_open_obligation_source_turns: predictedSourceTurns,
      predicted_current_turn_obligation_creation: Boolean(
        projection?.public_obligation?.speech_act?.creates_obligation || currentTurnObligationEvent,
      ),
      inquiry_state_consensus: inquiryStateConsensus,
      predicted_inquiry_state: projection?.inquiry_completion
        ? projection.inquiry_completion.status === 'complete'
          ? 'complete'
          : 'incomplete'
        : null,
      commitment_transition_consensus: commitmentTransitionConsensus,
      predicted_commitment_transition: predictedCommitmentTransition,
      candidate_override_consensus: hardConsensus(overrideA, overrideB),
      predicted_candidate_override: projection ? (projection.current_candidate_override_required ? 'yes' : 'no') : null,
      primary_warrant_basis_consensus: hardConsensus(basisA, basisB),
      predicted_primary_warrant_basis: predictedWarrantBasis(projection),
      obligation_source_turns_consensus: sourceTurnsConsensus,
      obligation_source_turns_match:
        sourceTurnsConsensus !== null && predictedSourceTurns !== null
          ? JSON.stringify(sourceTurnsConsensus) === JSON.stringify(predictedSourceTurns)
          : null,
      closure_safety_violation: Boolean(
        projection?.policy?.family === 'close_inquiry' &&
        (projection?.inquiry_completion?.status !== 'complete' ||
          inquiryStateConsensus === 'incomplete' ||
          blockingGoldObligation ||
          licensedEvidenceRemains),
      ),
      divergence_by_dimension: divergenceByDimension,
      scored: consensus !== 'uncertain' && predicted !== null,
      match: consensus !== 'uncertain' && predicted !== null ? consensus === predicted : null,
      profile: keyRow?.profile || null,
      condition: keyRow?.condition || null,
      seed: keyRow?.seed ?? null,
      turn: keyRow?.turn ?? null,
    };
  });
  const scored = cases.filter((row) => row.scored);
  const truePositive = scored.filter((row) => row.consensus === 'yes' && row.predicted === 'yes').length;
  const trueNegative = scored.filter((row) => row.consensus === 'no' && row.predicted === 'no').length;
  const falsePositive = scored.filter((row) => row.consensus === 'no' && row.predicted === 'yes').length;
  const falseNegative = scored.filter((row) => row.consensus === 'yes' && row.predicted === 'no').length;
  const rawAgreement = cases.filter(
    (row) => row.annotator_a !== null && row.annotator_b !== null && row.annotator_a === row.annotator_b,
  ).length;
  const jointlyLabeled = cases.filter((row) => row.annotator_a !== null && row.annotator_b !== null).length;
  const transitionScored = cases.filter((row) => row.transition_scored);
  const consensusPositive = scored.filter((row) => row.consensus === 'yes').length;
  const consensusNegative = scored.filter((row) => row.consensus === 'no').length;
  const diligentNegatives = scored.filter((row) => row.profile === 'diligent' && row.consensus === 'no');
  const diligentFalsePositives = diligentNegatives.filter((row) => row.predicted === 'yes').length;
  const speechScored = cases.filter((row) => row.speech_act_consensus !== 'uncertain');
  const requestProposalScored = speechScored.filter((row) =>
    ['tutor_directed_public_result_request', 'learner_proposed_test'].includes(row.speech_act_consensus),
  );
  const obligationScored = cases.filter(
    (row) => row.obligation_state_consensus !== 'uncertain' && row.obligation_source_turns_consensus !== null,
  );
  const persistenceScored = obligationScored.filter(
    (row) =>
      ['open', 'overdue'].includes(row.obligation_state_consensus) &&
      row.obligation_source_turns_consensus?.some((turn) => turn < row.turn),
  );
  const resolutionScored = obligationScored.filter((row) =>
    ['deferred', 'satisfied', 'withdrawn_or_transferred'].includes(row.obligation_state_consensus),
  );
  const proposalRows = speechScored.filter((row) => row.speech_act_consensus === 'learner_proposed_test');
  const proposalFalseObligations = proposalRows.filter((row) => row.predicted_current_turn_obligation_creation);
  const inquiryScored = cases.filter((row) => row.inquiry_state_consensus !== 'uncertain');
  const inquiryTruePositive = inquiryScored.filter(
    (row) => row.inquiry_state_consensus === 'complete' && row.predicted_inquiry_state === 'complete',
  ).length;
  const inquiryFalsePositive = inquiryScored.filter(
    (row) => row.inquiry_state_consensus === 'incomplete' && row.predicted_inquiry_state === 'complete',
  ).length;
  const inquiryFalseNegative = inquiryScored.filter(
    (row) => row.inquiry_state_consensus === 'complete' && row.predicted_inquiry_state !== 'complete',
  ).length;
  const mechanismHardConsensus = cases.filter(
    (row) =>
      row.speech_act_consensus !== 'uncertain' &&
      row.obligation_state_consensus !== 'uncertain' &&
      row.inquiry_state_consensus !== 'uncertain' &&
      row.commitment_transition_consensus !== 'uncertain' &&
      row.candidate_override_consensus !== 'uncertain' &&
      row.primary_warrant_basis_consensus !== 'uncertain' &&
      row.obligation_source_turns_consensus !== null &&
      row.action_family_consensus !== 'uncertain',
  );
  const divergenceDimensionMetrics = v4
    ? Object.fromEntries(
        ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS.map((dimension) => {
          const rows = cases.map((row) => row.divergence_by_dimension[dimension]);
          const interpretationScored = rows.filter(
            (row) => row.interpretation_consensus !== 'uncertain' && row.predicted_interpretation !== null,
          );
          const fullyScored = rows.filter((row) => row.fully_scored);
          const presentInterpretations = [
            ...new Set(interpretationScored.map((row) => row.interpretation_consensus)),
          ];
          const consensusRows = rows.filter(
            (row) =>
              row.annotator_a_interpretation !== null && row.annotator_b_interpretation !== null,
          );
          const hardConsensusRows = consensusRows.filter(
            (row) => row.interpretation_consensus !== 'uncertain',
          );
          return [
            dimension,
            {
              jointly_labeled_cases: consensusRows.length,
              hard_consensus_cases: hardConsensusRows.length,
              hard_consensus_rate: ratio(hardConsensusRows.length, consensusRows.length),
              nonaligned_consensus_cases: hardConsensusRows.filter(
                (row) => row.interpretation_consensus !== 'aligned',
              ).length,
              interpretation_macro_f1: presentInterpretations.length
                ? macroF1(
                    interpretationScored,
                    presentInterpretations,
                    'interpretation_consensus',
                    'predicted_interpretation',
                  )
                : null,
              interpretation_accuracy: ratio(
                interpretationScored.filter((row) => row.interpretation_match).length,
                interpretationScored.length,
              ),
              magnitude_accuracy: ratio(
                rows.filter((row) => row.magnitude_match !== null && row.magnitude_match).length,
                rows.filter((row) => row.magnitude_match !== null).length,
              ),
              persistence_accuracy: ratio(
                rows.filter((row) => row.persistence_match !== null && row.persistence_match).length,
                rows.filter((row) => row.persistence_match !== null).length,
              ),
              joint_accuracy: ratio(
                fullyScored.filter((row) => row.joint_match).length,
                fullyScored.length,
              ),
            },
          ];
        }),
      )
    : null;
  return {
    schema: ADAPTIVE_WARRANT_ANNOTATION_SCORE_SCHEMA,
    cases,
    metrics: {
      totalCases: cases.length,
      jointlyLabeled,
      rawAnnotatorAgreement: ratio(rawAgreement, jointlyLabeled),
      scoredConsensusCases: scored.length,
      consensusPositiveCases: consensusPositive,
      consensusNegativeCases: consensusNegative,
      uncertainCases: cases.length - scored.length,
      truePositive,
      trueNegative,
      falsePositive,
      falseNegative,
      precision: ratio(truePositive, truePositive + falsePositive),
      recall: ratio(truePositive, truePositive + falseNegative),
      accuracy: ratio(truePositive + trueNegative, scored.length),
      transitionConsensusCases: transitionScored.length,
      transitionCorrect: transitionScored.filter((row) => row.transition_match).length,
      transitionAccuracy: ratio(transitionScored.filter((row) => row.transition_match).length, transitionScored.length),
      diligentConsensusNegativeCases: diligentNegatives.length,
      diligentFalsePositives,
      diligentFalsePositiveRate: ratio(diligentFalsePositives, diligentNegatives.length),
      mechanismHardConsensusCases: v3 ? mechanismHardConsensus.length : null,
      mechanismHardConsensusRate: v3 ? ratio(mechanismHardConsensus.length, cases.length) : null,
      requestProposalConsensusCases: v3 ? requestProposalScored.length : null,
      resultRequestConsensusCases: v3
        ? requestProposalScored.filter((row) => row.speech_act_consensus === 'tutor_directed_public_result_request')
            .length
        : null,
      proposedTestConsensusCases: v3
        ? requestProposalScored.filter((row) => row.speech_act_consensus === 'learner_proposed_test').length
        : null,
      requestProposalMacroF1: v3
        ? macroF1(
            speechScored,
            ['tutor_directed_public_result_request', 'learner_proposed_test'],
            'speech_act_consensus',
            'predicted_speech_act',
          )
        : null,
      obligationLifecycleConsensusCases: v3 ? obligationScored.length : null,
      obligationLifecycleAccuracy: v3
        ? ratio(
            obligationScored.filter(
              (row) =>
                row.obligation_state_consensus === row.predicted_obligation_state &&
                row.obligation_source_turns_match === true,
            ).length,
            obligationScored.length,
          )
        : null,
      obligationPersistenceCases: v3 ? persistenceScored.length : null,
      obligationPersistenceAccuracy: v3
        ? ratio(
            persistenceScored.filter(
              (row) =>
                row.obligation_state_consensus === row.predicted_obligation_state &&
                row.obligation_source_turns_match === true,
            ).length,
            persistenceScored.length,
          )
        : null,
      obligationResolutionCases: v3 ? resolutionScored.length : null,
      proposedTestFalseObligationRate: v3 ? ratio(proposalFalseObligations.length, proposalRows.length) : null,
      inquiryCompleteConsensusCases: v3
        ? inquiryScored.filter((row) => row.inquiry_state_consensus === 'complete').length
        : null,
      inquiryIncompleteConsensusCases: v3
        ? inquiryScored.filter((row) => row.inquiry_state_consensus === 'incomplete').length
        : null,
      inquiryCompletionPrecision: v3 ? ratio(inquiryTruePositive, inquiryTruePositive + inquiryFalsePositive) : null,
      inquiryCompletionRecall: v3 ? ratio(inquiryTruePositive, inquiryTruePositive + inquiryFalseNegative) : null,
      commitmentTransitionAccuracy: v3
        ? ratio(
            cases.filter(
              (row) =>
                row.commitment_transition_consensus !== 'uncertain' &&
                row.commitment_transition_consensus === row.predicted_commitment_transition,
            ).length,
            cases.filter((row) => row.commitment_transition_consensus !== 'uncertain').length,
          )
        : null,
      candidateOverrideAccuracy: v3
        ? ratio(
            cases.filter(
              (row) =>
                row.candidate_override_consensus !== 'uncertain' &&
                row.candidate_override_consensus === row.predicted_candidate_override,
            ).length,
            cases.filter((row) => row.candidate_override_consensus !== 'uncertain').length,
          )
        : null,
      primaryWarrantBasisAccuracy: v3
        ? ratio(
            cases.filter(
              (row) =>
                row.primary_warrant_basis_consensus !== 'uncertain' &&
                row.primary_warrant_basis_consensus === row.predicted_primary_warrant_basis,
            ).length,
            cases.filter((row) => row.primary_warrant_basis_consensus !== 'uncertain').length,
          )
        : null,
      closureSafetyViolations: v3 ? cases.filter((row) => row.closure_safety_violation).length : null,
      divergenceDimensionMetrics,
    },
  };
}

export function evaluateAdaptiveWarrantDecisionGate(
  score,
  {
    liveShadowAgreement = null,
    structuredParityComparisons = null,
    structuredParityComparisonsByMode = {},
    structuredParityMismatches = null,
    requireMechanismMetrics = false,
    gate = ADAPTIVE_WARRANT_DECISION_GATE,
  } = {},
) {
  const metrics = score?.metrics || {};
  const checks = [
    check('raw_annotator_agreement', metrics.rawAnnotatorAgreement, gate.minimum_raw_annotator_agreement, 'min'),
    check('scored_consensus_cases', metrics.scoredConsensusCases, gate.minimum_scored_consensus_cases, 'min'),
    check('consensus_positive_cases', metrics.consensusPositiveCases, gate.minimum_consensus_positive_cases, 'min'),
    check('consensus_negative_cases', metrics.consensusNegativeCases, gate.minimum_consensus_negative_cases, 'min'),
    check('precision', metrics.precision, gate.minimum_precision, 'min'),
    check('recall', metrics.recall, gate.minimum_recall, 'min'),
    check('accuracy', metrics.accuracy, gate.minimum_accuracy, 'min'),
    check(
      'transition_consensus_cases',
      metrics.transitionConsensusCases,
      gate.minimum_transition_consensus_cases,
      'min',
    ),
    check('transition_accuracy', metrics.transitionAccuracy, gate.minimum_transition_accuracy, 'min'),
    check(
      'diligent_consensus_negative_cases',
      metrics.diligentConsensusNegativeCases,
      gate.minimum_diligent_consensus_negative_cases,
      'min',
    ),
    check(
      'diligent_false_positive_rate',
      metrics.diligentFalsePositiveRate,
      gate.maximum_diligent_false_positive_rate,
      'max',
    ),
    check('live_shadow_agreement', liveShadowAgreement, gate.required_live_shadow_agreement, 'min'),
  ];
  if (
    requireMechanismMetrics ||
    (metrics.mechanismHardConsensusRate !== null && metrics.mechanismHardConsensusRate !== undefined)
  ) {
    checks.push(
      check(
        'mechanism_hard_consensus_rate',
        metrics.mechanismHardConsensusRate,
        gate.minimum_mechanism_hard_consensus_rate,
        'min',
      ),
      check(
        'mechanism_consensus_positive_cases',
        metrics.consensusPositiveCases,
        gate.minimum_mechanism_consensus_positive_cases,
        'min',
      ),
      check(
        'mechanism_consensus_negative_cases',
        metrics.consensusNegativeCases,
        gate.minimum_mechanism_consensus_negative_cases,
        'min',
      ),
      check(
        'mechanism_transition_consensus_cases',
        metrics.transitionConsensusCases,
        gate.minimum_mechanism_transition_consensus_cases,
        'min',
      ),
      check('result_request_cases', metrics.resultRequestConsensusCases, gate.minimum_result_request_cases, 'min'),
      check('proposed_test_cases', metrics.proposedTestConsensusCases, gate.minimum_proposed_test_cases, 'min'),
      check('request_proposal_macro_f1', metrics.requestProposalMacroF1, gate.minimum_request_proposal_macro_f1, 'min'),
      check(
        'obligation_lifecycle_accuracy',
        metrics.obligationLifecycleAccuracy,
        gate.minimum_obligation_lifecycle_accuracy,
        'min',
      ),
      check(
        'obligation_persistence_cases',
        metrics.obligationPersistenceCases,
        gate.minimum_obligation_persistence_cases,
        'min',
      ),
      check(
        'obligation_resolution_cases',
        metrics.obligationResolutionCases,
        gate.minimum_obligation_resolution_cases,
        'min',
      ),
      check(
        'proposed_test_false_obligation_rate',
        metrics.proposedTestFalseObligationRate,
        gate.maximum_proposed_test_false_obligation_rate,
        'max',
      ),
      check(
        'inquiry_complete_cases',
        metrics.inquiryCompleteConsensusCases,
        gate.minimum_inquiry_complete_cases,
        'min',
      ),
      check(
        'inquiry_incomplete_cases',
        metrics.inquiryIncompleteConsensusCases,
        gate.minimum_inquiry_incomplete_cases,
        'min',
      ),
      check(
        'inquiry_completion_precision',
        metrics.inquiryCompletionPrecision,
        gate.minimum_inquiry_completion_precision,
        'min',
      ),
      check(
        'inquiry_completion_recall',
        metrics.inquiryCompletionRecall,
        gate.minimum_inquiry_completion_recall,
        'min',
      ),
      check(
        'commitment_transition_accuracy',
        metrics.commitmentTransitionAccuracy,
        gate.minimum_commitment_transition_accuracy,
        'min',
      ),
      check(
        'candidate_override_accuracy',
        metrics.candidateOverrideAccuracy,
        gate.minimum_candidate_override_accuracy,
        'min',
      ),
      check(
        'primary_warrant_basis_accuracy',
        metrics.primaryWarrantBasisAccuracy,
        gate.minimum_primary_warrant_basis_accuracy,
        'min',
      ),
      check(
        'closure_safety_violations',
        metrics.closureSafetyViolations,
        gate.maximum_closure_safety_violations,
        'max',
      ),
      check(
        'structured_parity_comparisons',
        structuredParityComparisons,
        gate.minimum_structured_parity_comparisons,
        'min',
      ),
      check(
        'structured_parity_observe_comparisons',
        structuredParityComparisonsByMode.observe,
        gate.minimum_structured_parity_comparisons_per_mode,
        'min',
      ),
      check(
        'structured_parity_active_comparisons',
        structuredParityComparisonsByMode.active,
        gate.minimum_structured_parity_comparisons_per_mode,
        'min',
      ),
      check(
        'structured_parity_mismatches',
        structuredParityMismatches,
        gate.maximum_structured_parity_mismatches,
        'max',
      ),
    );
    for (const dimension of metrics.divergenceDimensionMetrics ? ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS : []) {
      const divergence = metrics.divergenceDimensionMetrics?.[dimension] || {};
      checks.push(
        check(
          `divergence_${dimension}_consensus_rate`,
          divergence.hard_consensus_rate,
          gate.minimum_divergence_dimension_consensus_rate,
          'min',
        ),
        check(
          `divergence_${dimension}_nonaligned_cases`,
          divergence.nonaligned_consensus_cases,
          gate.minimum_divergence_nonaligned_cases_per_dimension,
          'min',
        ),
        check(
          `divergence_${dimension}_interpretation_macro_f1`,
          divergence.interpretation_macro_f1,
          gate.minimum_divergence_interpretation_macro_f1,
          'min',
        ),
        check(
          `divergence_${dimension}_magnitude_accuracy`,
          divergence.magnitude_accuracy,
          gate.minimum_divergence_magnitude_accuracy,
          'min',
        ),
        check(
          `divergence_${dimension}_persistence_accuracy`,
          divergence.persistence_accuracy,
          gate.minimum_divergence_persistence_accuracy,
          'min',
        ),
        check(
          `divergence_${dimension}_joint_accuracy`,
          divergence.joint_accuracy,
          gate.minimum_divergence_joint_accuracy,
          'min',
        ),
      );
    }
  }
  return {
    schema: gate.schema,
    gate,
    passed: checks.every((row) => row.passed),
    checks,
  };

  function check(id, actual, threshold, direction) {
    const measured = typeof actual === 'number' && Number.isFinite(actual) ? actual : null;
    const passed = measured !== null && (direction === 'max' ? measured <= threshold : measured >= threshold);
    return { id, actual: measured, direction, threshold, passed };
  }
}

function markdownReport(study) {
  const axes = planAxes(study.plan);
  const mechanismValidation = study.plan.config.mechanismValidation === true;
  const lines = [
    mechanismValidation ? '# Adaptive warrant mechanism-validation study' : '# Adaptive warrant baseline study',
    '',
    `Study: \`${study.studyId}\`  `,
    `Status: **${study.status}**  `,
    `Rows: ${study.rows.length}/${study.plan.jobs.length} collected`,
    '',
    '## Decision and downstream measures',
    '',
    '| World | Learner | Condition | OK/planned | Analysis | Record growth | Deference break | Break turn | Warrant sessions | Unrevised | Lag | Live/shadow | Structured parity | Delivered gate | Speaking transitions | Guard recoveries | Override sessions | Overrides/row |',
    '|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];
  const reportWorlds = axes.worlds.length ? axes.worlds : [null];
  for (const world of reportWorlds) {
    for (const profile of axes.profiles) {
      for (const condition of axes.conditions) {
        const worldCell = world ? study.aggregates.byWorld?.[world]?.[profile]?.[condition.id] : null;
        const cell = worldCell?.planned ? worldCell : study.aggregates.byCell[profile][condition.id];
        lines.push(
          `| ${world || 'default'} | ${profile} | ${condition.id} | ${cell.ok}/${cell.planned} | ${cell.meanLearnerAnalysisCoverage ?? 'n/a'} | ${cell.meanLearnerRecordGrowth ?? 'n/a'} | ${cell.deferenceBreakRate ?? 'n/a'} | ${cell.meanDeferenceBreakTurn ?? 'n/a'} | ${cell.warrantedSessions} | ${cell.warrantedButUnrevised} | ${cell.meanRevisionLagTurns ?? 'n/a'} | ${cell.meanLiveShadowAgreement ?? 'n/a'} | ${cell.structuredParityComparisons - cell.structuredParityMismatches}/${cell.structuredParityComparisons} | ${cell.deliveryApplicationComparisons - cell.deliveryApplicationMismatches}/${cell.deliveryApplicationComparisons} | ${cell.deliveryApplicationSpeakingTransitions} | ${cell.deliveryApplicationRecoveries} | ${cell.overrideSessions} | ${cell.meanOverrides ?? 'n/a'} |`,
        );
      }
    }
  }
  if (study.decisionQuality) {
    const metrics = study.decisionQuality.metrics;
    lines.push(
      '',
      '## Blinded decision quality',
      '',
      '| Scored consensus | Uncertain | Annotator agreement | Precision | Recall | Accuracy |',
      '|---:|---:|---:|---:|---:|---:|',
      `| ${metrics.scoredConsensusCases} | ${metrics.uncertainCases} | ${metrics.rawAnnotatorAgreement ?? 'n/a'} | ${metrics.precision ?? 'n/a'} | ${metrics.recall ?? 'n/a'} | ${metrics.accuracy ?? 'n/a'} |`,
    );
  }
  if (study.postRepairValidation) {
    const metrics = study.postRepairValidation.metrics;
    lines.push(
      '',
      '## Post-repair zero-overlap holdout',
      '',
      '| Scored consensus | Uncertain | Annotator agreement | Precision | Recall | Accuracy | Disposition |',
      '|---:|---:|---:|---:|---:|---:|---|',
      `| ${metrics.scoredConsensusCases} | ${metrics.uncertainCases} | ${metrics.rawAnnotatorAgreement ?? 'n/a'} | ${metrics.precision ?? 'n/a'} | ${metrics.recall ?? 'n/a'} | ${metrics.accuracy ?? 'n/a'} | candidate rejected and reverted |`,
    );
  }
  if (axes.conditions.some((condition) => condition.id === 'baseline')) {
    lines.push('', '## Paired active and inert-observe minus baseline contrasts', '');
    lines.push(
      '| Learner | Pairs | Observe record growth | Active record growth | Observe break rate | Active break rate | Observe break turn | Active break turn |',
    );
    lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
    for (const profile of axes.profiles) {
      const contrast = study.aggregates.pairedContrasts[profile];
      lines.push(
        `| ${profile} | ${contrast.pairs} | ${contrast.instrumentedMinusBaselineLearnerRecordGrowth ?? 'n/a'} | ${contrast.activeMinusBaselineLearnerRecordGrowth ?? 'n/a'} | ${contrast.instrumentedMinusBaselineDeferenceBreakRate ?? 'n/a'} | ${contrast.activeMinusBaselineDeferenceBreakRate ?? 'n/a'} | ${contrast.instrumentedMinusBaselineDeferenceBreakTurn ?? 'n/a'} | ${contrast.activeMinusBaselineDeferenceBreakTurn ?? 'n/a'} |`,
      );
    }
  }
  lines.push(
    '',
    '## Reading boundary',
    '',
    ...(study.decisionQuality
      ? [
          '- Decision precision/recall is complete for the frozen two-annotator sample; uncertain rows are reported but not scored.',
        ]
      : [
          '- Decision precision/recall is pending two independent annotations of the blinded sample; uncertain rows are not scored.',
        ]),
    '- A complete status requires one successful combined learner-analysis call per turn with no prompt-audit or classification fallback.',
    ...(mechanismValidation
      ? [
          '- Mechanism-validation completion additionally requires every observe/active decision to match the delivered gate-owned configuration or inert-observe contract.',
        ]
      : []),
    '- Gate firings and revision lag are manipulation checks. Improvement claims, if any, must rest on learner-record growth, deference break, or a separately blinded tutor-turn score.',
    '- These are automated-learner sessions, not evidence of human learning.',
    '- Diligent-profile firings are the false-positive control and must accompany every headline result.',
    ...(study.postRepairValidation
      ? [
          '- The post-repair holdout failed its decision gate; it does not license n=10 or promotion of the candidate rule.',
        ]
      : []),
    '',
  );
  return `${lines.join('\n')}\n`;
}

function jobCommandValue(job, flag) {
  const index = Array.isArray(job?.command) ? job.command.indexOf(flag) : -1;
  return index >= 0 && job.command[index + 1] !== undefined ? String(job.command[index + 1]) : null;
}

function baseJobResult(job, processResult, childEvidence) {
  return {
    schema: ADAPTIVE_WARRANT_BASELINE_RESULT_SCHEMA,
    jobId: job.id,
    runIndex: job.runIndex,
    seed: job.seed,
    world: job.world || null,
    profile: job.profile,
    condition: job.condition,
    warrantGateMode: job.warrantGateMode,
    processStatus: processResult?.status ?? null,
    childEvidence,
  };
}

function sealedChildArtifactPaths(job, childEvidence, matcher) {
  return (childEvidence?.artifacts || [])
    .filter((artifact) => matcher(artifact.path, artifact))
    .map((artifact) => {
      const artifactPath = path.resolve(job.jobDir, artifact.path);
      const relative = path.relative(path.resolve(job.jobDir), artifactPath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`sealed child artifact escapes its run directory: ${artifact.path}`);
      }
      return { ...artifact, absolutePath: artifactPath };
    });
}

function childSummary(job, childEvidence) {
  const summaries = sealedChildArtifactPaths(job, childEvidence, (artifactPath) =>
    /^auto-eval-[^/]+\.json$/u.test(artifactPath),
  );
  if (summaries.length !== 1) {
    throw new Error(`sealed child evidence requires exactly one auto-eval summary; found ${summaries.length}`);
  }
  const summaryPath = summaries[0].absolutePath;
  const summary = readJson(summaryPath);
  if (!Array.isArray(summary.results) || summary.results.length !== 1) {
    throw new Error('sealed child auto-eval summary must contain exactly one result');
  }
  return { summaryPath, summary, result: summary.results[0] };
}

function childTraceArtifact(job, childEvidence, result) {
  const traces = sealedChildArtifactPaths(
    job,
    childEvidence,
    (artifactPath) => artifactPath.endsWith('.jsonl') && artifactPath !== 'run-events.jsonl',
  );
  const declared = Array.isArray(result?.traces) ? result.traces : [];
  const declaredRelative = declared.map((tracePath) => {
    const absolute = path.isAbsolute(tracePath) ? path.resolve(tracePath) : path.resolve(ROOT, tracePath);
    return path.relative(path.resolve(job.jobDir), absolute).split(path.sep).join('/');
  });
  if (traces.length !== declaredRelative.length) {
    throw new Error(
      `sealed child trace inventory (${traces.length}) does not match the auto-eval summary (${declaredRelative.length})`,
    );
  }
  const sealedRelative = traces.map((row) => row.path).sort();
  if (!isDeepStrictEqual(sealedRelative, [...declaredRelative].sort())) {
    throw new Error('sealed child trace paths do not match the auto-eval summary');
  }
  if (result?.status === 'ok' && traces.length !== 1) {
    throw new Error(`successful sealed child requires exactly one dialogue trace; found ${traces.length}`);
  }
  return traces[0] || null;
}

export function collectAdaptiveWarrantStudyJobResult(job, processResult = null) {
  const dryRun = job.dryRun === true || job.command?.includes('--dry-run');
  const expectedParentRunId = job.parentRunId || jobCommandValue(job, '--parent-run-id');
  const childEvidence = verifyAdaptiveWarrantStudyChildEvidence({
    runDir: job.jobDir,
    expectedRunId: job.id,
    expectedParentRunId,
    expectedStatus: dryRun ? 'dry_run' : 'complete',
    expectedGitSha: job.expectedGitSha || null,
    expectedGitDirty: typeof job.expectedGitDirty === 'boolean' ? job.expectedGitDirty : null,
    expectedPolicySha256: job.expectedChildPolicySha256 || null,
    completeness: true,
  });
  const base = baseJobResult(job, processResult, childEvidence);
  if (!childEvidence.ok) {
    return {
      ...base,
      childStatus: 'evidence_invalid',
      summaryPath: null,
      tracePath: null,
      turnCount: 0,
      error: childEvidence.errors.join('; '),
    };
  }
  try {
    const { summaryPath, result } = childSummary(job, childEvidence);
    const trace = childTraceArtifact(job, childEvidence, result);
    if (!trace) {
      return {
        ...base,
        childStatus: result.status || (dryRun ? 'dry_run' : 'failed'),
        summaryPath,
        tracePath: null,
        turnCount: 0,
        error: result.error || processResult?.error || null,
      };
    }
    return {
      ...summarizeAdaptiveWarrantTrace({
        tracePath: trace.absolutePath,
        job,
        childStatus: result.status || (processResult?.status === 0 ? 'ok' : 'failed'),
        summaryPath,
      }),
      processStatus: processResult?.status ?? null,
      childEvidence,
      error: result.error || processResult?.error || null,
    };
  } catch (error) {
    return {
      ...base,
      childStatus: 'evidence_invalid',
      summaryPath: null,
      tracePath: null,
      turnCount: 0,
      error: error.message,
    };
  }
}

function collectJobResult(job, processResult = null) {
  return collectAdaptiveWarrantStudyJobResult(job, processResult);
}

export function adaptiveWarrantStudyPreflightChecks() {
  return [
    ['npm', ['run', 'derivation:quality']],
    [process.execPath, ['--test', 'tests/tutorStubPromptAudit.test.js', 'tests/derivationWorldQuality.test.js']],
    [
      process.execPath,
      [
        '--test',
        'tests/adaptiveWarrantGate.test.js',
        'tests/adaptiveWarrantAnnotationCollection.test.js',
        'tests/adaptiveWarrantBaselineStudy.test.js',
        'tests/adaptiveWarrantStudyIntegrity.test.js',
        'tests/tutorStubAutoEvalEvidence.test.js',
        'tests/tutorStubGuardAccounting.test.js',
        'tests/tutorStubTurnProgressionContract.test.js',
      ],
    ],
  ];
}

function runPreflight() {
  for (const [command, commandArgs] of adaptiveWarrantStudyPreflightChecks()) {
    console.log(`[warrant-study] preflight: ${shellDisplay([command, ...commandArgs])}`);
    const result = spawnSync(command, commandArgs, { cwd: ROOT, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`preflight failed: ${command} ${commandArgs.join(' ')}`);
  }
}

function runJob(job, { logsDir, beforeSpawn = null, cliContract = null }) {
  return new Promise((resolve) => {
    beforeSpawn?.();
    fs.mkdirSync(logsDir, { recursive: true });
    const logPath = path.join(logsDir, `${job.id}.log`);
    const log = fs.createWriteStream(logPath, { flags: 'a' });
    log.write(`\n[warrant-study] ${new Date().toISOString()}\n${shellDisplay(job.command)}\n\n`);
    const childEnvironment = {
      ...buildAdaptiveWarrantStudyEnvironment(process.env),
      ...adaptiveWarrantStudyCliGuardEnvironment(cliContract),
    };
    const child = spawn(job.command[0], job.command.slice(1), {
      cwd: ROOT,
      env: childEnvironment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    let spawnError = null;
    child.on('error', (error) => {
      spawnError = error;
      log.write(`\n[warrant-study] spawn error: ${error.message}\n`);
    });
    child.on('close', (status, signal) => {
      log.end(`\n[warrant-study] exit=${status} signal=${signal || 'none'}\n`);
      resolve({ status, signal, error: spawnError?.message || null, logPath });
    });
  });
}

async function runPool(jobs, parallelism, worker, onFinish) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(parallelism, jobs.length) }, async () => {
    while (cursor < jobs.length) {
      const index = cursor;
      cursor += 1;
      const job = jobs[index];
      const result = await worker(job);
      await onFinish(job, result, index);
    }
  });
  await Promise.all(runners);
}

export function mechanismAnnotationHandbook() {
  return `# Adaptive warrant mechanism annotation handbook

This handbook is frozen with the mechanism-validation corpus. Annotate only public decision-time evidence: the public inquiry brief (opening, situation, question, opening evidence, and public rules), the transcript through the current learner turn, the learner-record trajectory, the prior delivered family, its normative expected-uptake contract, the pre-gate candidate, prior public audit outcomes, and the supplied public evidence-availability and epistemic counts. Treat structured counters as evidence to audit against the transcript, not as self-validating labels. Do not infer from the eventual tutor reply, arm, profile, world, or private model prediction. If those public inputs do not determine a typed state, use \`uncertain\`; the support gate must fail rather than importing hidden evidence.

Each response envelope must use \`${ADAPTIVE_WARRANT_ANNOTATION_RESPONSE_V4_SCHEMA}\` and name a non-empty \`annotator_id\` plus a unique \`annotation_run_id\`. The two readers must work from separate response files without seeing one another's labels or the private key; the scorer rejects reused identities before it reads that key.

## Labels

- Speech act: \`${ANNOTATION_SPEECH_ACTS.join('` | `')}\`.
- Obligation state: \`${ANNOTATION_OBLIGATION_STATES.join('` | `')}\`. Record every creation or reminder turn for a still-unresolved obligation. A satisfied, withdrawn, or transferred obligation keeps its resolved lifecycle label at the next decision but has no open source turns; use \`none\` only when no public obligation has occurred.
- Inquiry state: \`${ANNOTATION_INQUIRY_STATES.join('` | `')}\`.
- Commitment transition and current-candidate override: \`yes | no | uncertain\`; these are separate judgments.
- Primary warrant basis: \`${ANNOTATION_WARRANT_BASES.join('` | `')}\`.
- Recommended family: one declared action family, \`hold\`, or \`uncertain\`.
- Divergence dimensions: \`${ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS.join('` | `')}\`. Supply exactly one judgment for every dimension.
- Divergence interpretation: \`${ANNOTATION_DIVERGENCE_INTERPRETATIONS.join('` | `')}\`. \`productive\` means a real departure from the norm that is useful rather than failed; it is not \`aligned\`.
- Divergence magnitude: \`${ANNOTATION_DIVERGENCE_MAGNITUDES.join('` | `')}\`.
- Divergence persistence: \`${ANNOTATION_DIVERGENCE_PERSISTENCE.join('` | `')}\`. Use \`single_turn\` for one current or prior event and \`sustained\` for two or more linked turns/events.

Magnitude is semantic distance, not sentiment intensity: \`low\` is one bounded non-safety departure, \`moderate\` is repeated/sustained departure or one epistemic-safety conflict, and \`high\` is four or more linked turns/events, sustained deference, a required strategy exit not taken, or multiple epistemic-safety conflicts. \`aligned\` must pair with \`none/none\`; \`uncertain\` must be uncertain on all three labels.

Every case-level and per-dimension note must contain at least ${ADAPTIVE_WARRANT_ANNOTATION_MIN_NOTE_CHARACTERS} characters of public decision-time evidence. Do not leave a dimension note blank or substitute the case-level conclusion for dimension-specific evidence. The collection assembler applies only two declared mechanical canonicalizations: \`primary_warrant_basis=none\` forces \`recommended_action_family=hold\`, and \`primary_warrant_basis=uncertain\` forces \`recommended_action_family=uncertain\`. It records every such edit in a normalization audit; it never infers a positive basis or family.

## Disjoint calibration examples

- Result request: “What does the next public clue show?” asks the tutor to supply an available result and can create tutor-owned debt.
- If one learner turn contains both a tutor-selection phrase and a direct result-request clause, code the direct result request as the operative speech act.
- Proposed test: “Can we inspect the next clue?” proposes an investigation; it does not yet ask the tutor to report a known result.
- Criterion: “What would the next clue need to establish?” asks for a standard of proof, not a result.
- Selection: “Could you choose which public record we should inspect?” delegates a choice, not result production.
- Record entry: “I can record that finding now” offers to write an already-public claim; it is neither a test proposal nor tutor-owned result debt.
- Commitment transition and candidate override are independent. A prior family may warrant transition while the current candidate already realizes the correct successor, or a prior family may remain valid while this particular candidate still needs correction.
- A request answered in tutor turn 1 remains \`satisfied\` at learner turn 2 with an empty source-turn array; it is not \`none\`. Use \`none\` only when no request occurred anywhere in the public transcript.
- An \`open\` request becomes \`overdue\` when a completed tutor turn neither answers it nor accountably defers it. A later reminder preserves \`overdue\`; it does not reset the obligation to \`open\`.
- Apply warrant-basis precedence exactly: immediate repair, actionable public obligation, strict inquiry completion, candidate safety for an unsafe close while inquiry is incomplete, action-contract result, then register or accumulated trouble. Use \`none/hold\` only when none applies.
- Explicit analytic work can be conceptually aligned even when the learner record stays flat. Conceptual stalling needs a public failure signal such as an explicit stall or low-agency deferral; productive testing is not conceptual failure.
- Strategy exhaustion follows the supplied typed expected-uptake contract. If the contract says the learner adopted or used the staged evidence, do not mark the family exhausted only because the learner's surface wording still sounds dependent. Mark exhaustion when that contract is defeated, expired, or repeatedly failed.
- \`aligned\` means the descriptive state satisfies that dimension's stated norm, even when the move is valuable. Record growth or explicit analytic work is conceptually aligned; voluntary agentive participation is engagement-aligned. Use \`productive\` only for a useful departure from the stated norm, not as a synonym for good, active, or successful.
- Keep contract defeat on the strategy-exhaustion axis unless separate public uptake, repetition, register, or tutor-debt evidence establishes interactional trouble; do not duplicate the contract label onto interactional by default.
- A polite preface such as “May I ask you this?” before a concrete result request is not low-agency deferral. Low agency requires handing the substantive choice or record move back to the tutor.

## Precedence and safety

1. An explicit repair request or stall is an immediate repair warrant.
2. A tutor-directed request for an available public result creates a tutor obligation; a learner proposal to run a test does not. For multiple obligations use the state precedence overdue, then open/reactivated, then deferred, then the latest resolved state, then none. An actionable open, overdue, or reactivated public obligation outranks closure and unrelated questioning. An accountable deferral remains recorded but is nonblocking until its named public condition occurs or the obligation is reminded or released.
3. Whole-inquiry completion requires a supported terminal learner assertion, known exhausted licensed evidence, integrated released evidence, no unsupported assertion or active dropped fact, and no actionable open, overdue, or reactivated public obligation. A fixed horizon or locally fluent turn is not completion.
4. A \`close_inquiry\` candidate while whole-inquiry state is incomplete has \`candidate_safety\` as its primary basis. Recommend a safe nonterminal family; do not call the inquiry complete, and do not infer a held-family transition when the safe successor retains the prior family.
5. Action-contract success, defeat, or expiry is judged against the prior delivered family and its deadline.
6. Register or accumulated trouble is considered only after the higher-priority cases above. Productive analytic resistance is not a stall.
7. \`commitment_transition_warranted\` asks whether the held pedagogical family should change beyond the current response. Public-obligation fulfilment is a response-level requirement and therefore does not by itself change that commitment; it can require a current-candidate override. A strict terminal close or a contract/immediate/trouble-driven pedagogical switch does change the commitment when its successor differs from the prior family. \`current_candidate_override_required\` asks whether the concrete pre-gate candidate must change; either label can differ from the other.
8. Judge divergence before judging whether it warrants a commitment revision. Conceptual concerns learner-record progress; interactional concerns uptake, repetition, register trouble, and tutor-owned public debt; engagement concerns voluntary agency; pacing concerns publicly evidenced acceleration or deceleration from authored pace; epistemic concerns unsupported, dropped, unintegrated, or prematurely terminal claims; strategy exhaustion concerns a held family whose expected-uptake contract has been defeated, expired, or repeatedly failed.

When the evidence cannot distinguish the permitted labels, use \`uncertain\` and explain the decision-time ambiguity in the note.
`;
}

function planAxes(plan) {
  return {
    worlds: plan.config.worlds || (plan.config.world ? [plan.config.world] : []),
    profiles: plan.config.profiles || STUDY_PROFILES,
    conditions: plan.config.conditions || STUDY_CONDITIONS,
  };
}

function mechanismCoverage(rows, annotationKey, axes, { runs, horizon }) {
  const expectedTurns = Array.from({ length: horizon }, (_, index) => index + 1);
  const cells = axes.worlds.flatMap((world) =>
    axes.profiles.flatMap((profile) =>
      axes.conditions.map((condition) => {
        const cellRows = rows.filter(
          (row) => row.world === world && row.profile === profile && row.condition === condition.id,
        );
        const dialogues = cellRows.map((row) => {
          const decisionTurns = (row.decisions || [])
            .map((decision) => Number(decision.turn))
            .sort((left, right) => left - right);
          return {
            job_id: row.jobId,
            seed: row.seed,
            decision_turns: decisionTurns,
            exact_turn_coverage: JSON.stringify(decisionTurns) === JSON.stringify(expectedTurns),
            structured_parity_comparisons: Number(row.liveShadowStructuredComparisonCount || 0),
            structured_parity_mismatches: Number(row.liveShadowStructuredMismatchCount || 0),
          };
        });
        return {
          world,
          profile,
          condition: condition.id,
          warrant_gate_mode: condition.warrantGateMode,
          expected_dialogues: runs,
          observed_dialogues: dialogues.length,
          exact:
            dialogues.length === runs &&
            dialogues.every(
              (row) =>
                row.exact_turn_coverage &&
                row.structured_parity_comparisons === horizon &&
                row.structured_parity_mismatches === 0,
            ),
          dialogues,
        };
      }),
    ),
  );
  const annotationRows = annotationKey.cases || [];
  const expectedObserveCases = axes.worlds.length * axes.profiles.length * horizon;
  const annotationCells = axes.worlds.flatMap((world) =>
    axes.profiles.map((profile) => {
      const cellRows = annotationRows.filter(
        (row) => row.world === world && row.profile === profile && row.condition === 'instrumented',
      );
      const turns = cellRows.map((row) => Number(row.turn)).sort((left, right) => left - right);
      return {
        world,
        profile,
        condition: 'instrumented',
        cases: cellRows.length,
        turns,
        exact: cellRows.length === horizon && JSON.stringify(turns) === JSON.stringify(expectedTurns),
      };
    }),
  );
  return {
    expected_turns_per_dialogue: expectedTurns,
    expected_dialogues: axes.worlds.length * axes.profiles.length * axes.conditions.length * runs,
    observed_dialogues: rows.length,
    exact_dialogue_coverage: cells.every((cell) => cell.exact),
    cells,
    annotation: {
      arm: 'instrumented',
      expected_cases: expectedObserveCases,
      observed_cases: annotationRows.length,
      exact: annotationRows.length === expectedObserveCases && annotationCells.every((cell) => cell.exact),
      active_cases: annotationRows.filter((row) => row.condition === 'intervening').length,
      turns: [...new Set(annotationRows.map((row) => Number(row.turn)))].sort((left, right) => left - right),
      cells: annotationCells,
    },
  };
}

function relativeChildEvidencePath(row, artifactPath) {
  if (!artifactPath || !row?.childEvidence?.run_dir) return null;
  const relative = path.relative(path.resolve(row.childEvidence.run_dir), path.resolve(artifactPath));
  return relative.startsWith('..') || path.isAbsolute(relative) ? null : relative.split(path.sep).join('/');
}

function adaptiveWarrantExecutionEvidenceRow(row) {
  const {
    childEvidence = null,
    processStatus: _processStatus,
    summaryPath = null,
    tracePath = null,
    ...semanticRow
  } = row || {};
  const artifacts = (childEvidence?.artifacts || []).map(({ path: artifactPath, sha256: digest, bytes, schema }) => ({
    path: artifactPath,
    sha256: digest,
    bytes,
    schema: schema || null,
  }));
  return {
    job_id: row?.jobId || null,
    child_status: row?.childStatus || null,
    child_evidence_ok: childEvidence?.ok === true,
    child_run_id: childEvidence?.run_id || null,
    child_parent_run_id: childEvidence?.parent_run_id || null,
    child_plan_sha256: childEvidence?.plan_sha256 || null,
    child_seal_sha256: childEvidence?.seal_sha256 || null,
    child_event_count: childEvidence?.event_count ?? null,
    sealed_artifacts_sha256: canonicalJsonSha256(artifacts),
    summary_artifact: relativeChildEvidencePath(row, summaryPath),
    trace_artifact: relativeChildEvidencePath(row, tracePath),
    semantic_row_sha256: canonicalJsonSha256(semanticRow),
  };
}

export function buildAdaptiveWarrantStudyExecutionEvidence(rows = []) {
  const evidenceRows = rows.map(adaptiveWarrantExecutionEvidenceRow);
  return {
    schema: 'machinespirits.adaptation-refinement.warrant-study-execution-evidence.v1',
    row_count: evidenceRows.length,
    rows_sha256: canonicalJsonSha256(evidenceRows),
    rows: evidenceRows,
  };
}

export function writeStudyArtifacts({ rootDir, plan, rows, status }) {
  const axes = planAxes(plan);
  const mechanismValidation = plan.config.mechanismValidation === true;
  const annotationConditions = mechanismValidation
    ? axes.conditions.filter((condition) =>
        (plan.config.annotationConditions || ['instrumented']).includes(condition.id),
      )
    : axes.conditions;
  const aggregates = aggregateAdaptiveWarrantStudy(rows, {
    horizon: plan.config.horizon,
    ...axes,
  });
  const annotation = buildBlindedAnnotationCorpus(rows, {
    perCell: plan.config.annotationPerCell,
    studyId: plan.studyId,
    predictionBalanced: plan.config.contractValidation === true,
    worlds: axes.worlds,
    profiles: axes.profiles,
    conditions: annotationConditions,
    includeAllDecisions: mechanismValidation && plan.config.annotationAllDecisions === true,
    minimumTurn: mechanismValidation ? 1 : 2,
  });
  const handbookPath = mechanismValidation ? path.join(rootDir, 'annotation-handbook.md') : null;
  const studyPlanPath = path.join(rootDir, 'study-plan.json');
  if (!fs.existsSync(studyPlanPath)) writeJson(studyPlanPath, plan);
  if (handbookPath && !fs.existsSync(handbookPath)) fs.writeFileSync(handbookPath, mechanismAnnotationHandbook());
  if (handbookPath) {
    annotation.corpus.provenance = {
      annotation_handbook: { path: handbookPath, sha256: fileSha256(handbookPath) },
    };
  }
  const annotationScorePath = path.join(rootDir, 'annotation-consensus-and-scores.json');
  const validationScorePath = path.join(rootDir, 'validation-consensus-and-scores.json');
  const decisionQuality = fs.existsSync(annotationScorePath) ? readJson(annotationScorePath) : null;
  const postRepairValidation = fs.existsSync(validationScorePath) ? readJson(validationScorePath) : null;
  const existingStudyPath = path.join(rootDir, 'study-results.json');
  const existingStudy = fs.existsSync(existingStudyPath) ? readJson(existingStudyPath) : null;
  const preserveFrozenAnnotation =
    existingStudy?.status === 'complete' &&
    fs.existsSync(path.join(rootDir, 'annotation-sample.blinded.json')) &&
    fs.existsSync(path.join(rootDir, 'annotation-key.private.json'));
  const analysisProvenance = adaptiveWarrantStudySourceFingerprint();
  const executionEvidence = buildAdaptiveWarrantStudyExecutionEvidence(rows);
  if (
    status === 'complete' &&
    mechanismValidation &&
    executionEvidence.rows.some(
      (row) =>
        row.child_evidence_ok !== true ||
        !/^[0-9a-f]{64}$/u.test(String(row.child_plan_sha256 || '')) ||
        !/^[0-9a-f]{64}$/u.test(String(row.child_seal_sha256 || '')),
    )
  ) {
    throw new Error('mechanism-validation freeze requires verified sealed child evidence for every dialogue');
  }
  if (preserveFrozenAnnotation && mechanismValidation) {
    const manifestPath = path.join(rootDir, 'annotation-freeze-manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('mechanism-validation frozen corpus is missing its freeze manifest');
    }
    const manifest = readJson(manifestPath);
    const protocolPath = path.resolve(ROOT, plan.design || 'docs/adaptation-refinement/baseline-comparison-design.md');
    const frozenBindings = [
      ['source provenance', manifest.provenance?.combinedSha256, analysisProvenance.combinedSha256],
      ['study plan', manifest.study_plan?.sha256, fileSha256(studyPlanPath)],
      ['protocol', manifest.protocol?.sha256, fileSha256(protocolPath)],
      ['annotation handbook', manifest.annotation_handbook?.sha256, fileSha256(handbookPath)],
      ['annotation corpus', manifest.corpus?.sha256, fileSha256(path.join(rootDir, 'annotation-sample.blinded.json'))],
      ['annotation key', manifest.key?.sha256, fileSha256(path.join(rootDir, 'annotation-key.private.json'))],
      ['execution evidence', manifest.execution_evidence?.rows_sha256, executionEvidence.rows_sha256],
    ];
    const drift = frozenBindings.filter(([, frozen, current]) => !frozen || frozen !== current);
    if (drift.length) {
      throw new Error(
        `mechanism-validation freeze burned by ${drift.map(([label]) => label).join(', ')} drift; fresh dialogues and annotations are required`,
      );
    }
  }
  const study = {
    schema: ADAPTIVE_WARRANT_BASELINE_STUDY_SCHEMA,
    studyId: plan.studyId,
    status,
    updatedAt: new Date().toISOString(),
    plan,
    analysisProvenance,
    executionEvidence,
    rows,
    aggregates,
    decisionQuality,
    postRepairValidation,
    annotation: {
      blindedCorpus: path.join(rootDir, 'annotation-sample.blinded.json'),
      privateKey: path.join(rootDir, 'annotation-key.private.json'),
      scores: decisionQuality ? annotationScorePath : null,
    },
  };
  writeJson(existingStudyPath, study);
  fs.writeFileSync(path.join(rootDir, 'study-results.md'), markdownReport(study));
  if (!preserveFrozenAnnotation) {
    const freezeStudy = plan.config.contractValidation === true || mechanismValidation;
    if (status === 'complete' && mechanismValidation) {
      if (!(plan.config.excludedAnnotationCorpora || []).length) {
        throw new Error('mechanism-validation freeze requires at least one explicitly excluded prior corpus');
      }
      const excludedSet = new Set((plan.config.excludedAnnotationCorpora || []).map((row) => path.resolve(row)));
      const missingRequiredExclusions = (plan.config.requiredExcludedAnnotationCorpora || []).filter(
        (row) => !excludedSet.has(path.resolve(row)),
      );
      if (missingRequiredExclusions.length) {
        throw new Error(
          `mechanism-validation freeze is missing ${missingRequiredExclusions.length} required prior corpora`,
        );
      }
      const expectedCases =
        axes.worlds.length * axes.profiles.length * annotationConditions.length * plan.config.horizon;
      if (annotation.corpus.cases.length !== expectedCases) {
        throw new Error(
          `mechanism-validation annotation freeze expected ${expectedCases} cases, got ${annotation.corpus.cases.length}`,
        );
      }
      if (
        annotation.corpus.cases.some(
          (row) =>
            !oneLine(row.public_inquiry_brief?.opening_text) || !oneLine(row.public_inquiry_brief?.public_question),
        )
      ) {
        throw new Error('mechanism-validation annotation freeze requires a public inquiry brief for every case');
      }
      if (
        annotation.key.cases.some(
          (row) => row.condition !== 'instrumented' || row.turn < 1 || row.turn > plan.config.horizon,
        )
      ) {
        throw new Error('mechanism-validation annotation freeze must contain all observe decisions only');
      }
    }
    if (status === 'complete' && freezeStudy) {
      const currentFingerprints = new Set(annotation.corpus.cases.map(annotationCaseFingerprint));
      const overlapRows = [];
      for (const excludedPath of plan.config.excludedAnnotationCorpora || []) {
        const excluded = readJson(excludedPath);
        for (const row of excluded.cases || []) {
          const fingerprint = annotationCaseFingerprint(row);
          if (currentFingerprints.has(fingerprint)) overlapRows.push({ excludedPath, fingerprint });
        }
      }
      if (overlapRows.length) {
        throw new Error(`annotation freeze overlaps ${overlapRows.length} excluded cases`);
      }
    }
    writeJson(study.annotation.blindedCorpus, annotation.corpus);
    writeJson(study.annotation.privateKey, annotation.key);
    if (status === 'complete' && freezeStudy) {
      const structuredParityComparisonsByMode = Object.fromEntries(
        ['observe', 'active'].map((mode) => [
          mode,
          rows
            .filter((row) => row.warrantGateMode === mode)
            .reduce((sum, row) => sum + Number(row.liveShadowStructuredComparisonCount || 0), 0),
        ]),
      );
      const coverage = mechanismValidation
        ? mechanismCoverage(rows, annotation.key, axes, {
            runs: plan.config.runs,
            horizon: plan.config.horizon,
          })
        : null;
      if (
        coverage &&
        (!coverage.exact_dialogue_coverage ||
          !coverage.annotation.exact ||
          coverage.annotation.active_cases !== 0 ||
          JSON.stringify(coverage.annotation.turns) !==
            JSON.stringify(Array.from({ length: plan.config.horizon }, (_, index) => index + 1)))
      ) {
        throw new Error('mechanism-validation freeze does not have exact cell, turn, and observe-only coverage');
      }
      const protocolPath = path.resolve(
        ROOT,
        plan.design || 'docs/adaptation-refinement/baseline-comparison-design.md',
      );
      writeJson(path.join(rootDir, 'annotation-freeze-manifest.json'), {
        schema: mechanismValidation
          ? 'machinespirits.adaptation-refinement.warrant-mechanism-validation-freeze.v1'
          : 'machinespirits.adaptation-refinement.warrant-contract-validation-freeze.v1',
        study_id: plan.studyId,
        status: 'frozen',
        frozen_at: new Date().toISOString(),
        newly_generated_dialogues: true,
        prediction_balanced_diagnostic_sample: plan.config.contractValidation === true,
        all_observe_decisions: mechanismValidation,
        sampling: mechanismValidation
          ? {
              worlds: axes.worlds,
              profiles: axes.profiles,
              conditions: annotationConditions.map((row) => row.id),
              turns_per_dialogue: plan.config.horizon,
              total_cases: annotation.corpus.cases.length,
            }
          : null,
        zero_overlap: {
          source_fingerprint_schema: 'machinespirits.adaptation-refinement.annotation-source-fingerprint.v1',
          projection_fingerprint_schema: 'machinespirits.adaptation-refinement.annotation-projection-fingerprint.v1',
          excluded_corpora: (plan.config.excludedAnnotationCorpora || []).map((excludedPath) => ({
            path: excludedPath,
            sha256: fileSha256(excludedPath),
          })),
          verified_overlap_count: 0,
        },
        decision_gate: ADAPTIVE_WARRANT_DECISION_GATE,
        protocol: {
          path: protocolPath,
          sha256: fileSha256(protocolPath),
        },
        study_plan: {
          path: studyPlanPath,
          sha256: fileSha256(studyPlanPath),
        },
        projection_schemas: mechanismValidation
          ? {
              annotation_corpus: ADAPTIVE_WARRANT_ANNOTATION_SCHEMA,
              live_warrant_gate: 'machinespirits.tutor-stub.warrant-gate.v5',
              decision_input: 'machinespirits.adaptation-refinement.warrant-decision-input.v2',
              structured_parity: 'structured_v1',
            }
          : null,
        coverage,
        structured_parity: mechanismValidation
          ? {
              comparisons: Object.values(structuredParityComparisonsByMode).reduce((sum, value) => sum + value, 0),
              comparisons_by_mode: structuredParityComparisonsByMode,
              mismatches: rows.reduce((sum, row) => sum + Number(row.liveShadowStructuredMismatchCount || 0), 0),
            }
          : null,
        execution_evidence: executionEvidence,
        annotation_handbook: handbookPath ? { path: handbookPath, sha256: fileSha256(handbookPath) } : null,
        corpus: {
          path: study.annotation.blindedCorpus,
          sha256: fileSha256(study.annotation.blindedCorpus),
          cases: annotation.corpus.cases.length,
        },
        key: { path: study.annotation.privateKey, sha256: fileSha256(study.annotation.privateKey) },
        provenance: analysisProvenance,
      });
    }
  }
  return study;
}

export function validateAdaptiveWarrantAnnotationFreeze({
  rootDir,
  corpusPath,
  keyPath,
  manifestFilename = 'annotation-freeze-manifest.json',
  corpus = null,
  requireMechanismCorpus = false,
} = {}) {
  const frozenCorpus = corpus || readJson(corpusPath);
  if (frozenCorpus?.schema !== ADAPTIVE_WARRANT_ANNOTATION_SCHEMA) {
    if (requireMechanismCorpus) {
      throw new Error('mechanism annotation scoring requires the frozen v4 corpus schema');
    }
    const key = readJson(keyPath);
    return {
      key,
      manifest: null,
      audit: { ok: true, legacy: true, manifest: null },
    };
  }
  const key = readJson(keyPath);

  const manifestPath = path.join(rootDir, manifestFilename);
  if (!fs.existsSync(manifestPath)) throw new Error('v4 annotation corpus is missing its freeze manifest');
  const manifest = readJson(manifestPath);
  const annotationManifest = manifestFilename === 'annotation-freeze-manifest.json';
  const allowedSchemas = annotationManifest
    ? [
        'machinespirits.adaptation-refinement.warrant-mechanism-validation-freeze.v1',
        'machinespirits.adaptation-refinement.warrant-contract-validation-freeze.v1',
      ]
    : ['machinespirits.adaptation-refinement.warrant-validation-freeze.v1'];
  if (!allowedSchemas.includes(manifest?.schema)) throw new Error('annotation freeze manifest has an invalid schema');
  if (manifest.status !== 'frozen') throw new Error('annotation freeze manifest is not frozen');
  if (manifest.study_id !== frozenCorpus.study_id) {
    throw new Error('annotation freeze manifest study_id does not match the corpus');
  }
  if (manifest.corpus?.sha256 !== fileSha256(corpusPath)) {
    throw new Error('annotation freeze burned by corpus drift');
  }
  if (manifest.key?.sha256 !== fileSha256(keyPath)) {
    throw new Error('annotation freeze burned by key drift');
  }
  if (manifest.corpus?.cases !== undefined && Number(manifest.corpus.cases) !== frozenCorpus.cases.length) {
    throw new Error('annotation freeze manifest corpus count does not match the frozen corpus');
  }
  if (
    manifest.sampling?.total_cases !== undefined &&
    Number(manifest.sampling.total_cases) !== frozenCorpus.cases.length
  ) {
    throw new Error('annotation freeze manifest sampling count does not match the frozen corpus');
  }
  if (key?.schema !== `${ADAPTIVE_WARRANT_ANNOTATION_SCHEMA}.key` || key.blinded !== false) {
    throw new Error('annotation key has an invalid v4 schema or blindness marker');
  }
  if (key.study_id !== frozenCorpus.study_id || key.study_id !== manifest.study_id) {
    throw new Error('annotation key study_id does not match the frozen corpus');
  }

  const corpusIds = exactUniqueAnnotationSampleIds(frozenCorpus.cases, 'annotation corpus');
  const keyIds = exactUniqueAnnotationSampleIds(key.cases, 'annotation key');
  if (JSON.stringify(corpusIds) !== JSON.stringify(keyIds)) {
    throw new Error('annotation key must contain exactly the frozen corpus sample ids');
  }
  const corpusById = new Map(frozenCorpus.cases.map((row) => [row.sample_id, row]));
  for (const keyRow of key.cases) {
    const corpusRow = corpusById.get(keyRow.sample_id);
    if (keyRow.source_fingerprint !== annotationCaseFingerprint(corpusRow)) {
      throw new Error(`annotation key source fingerprint mismatch for ${keyRow.sample_id}`);
    }
    if (keyRow.projection_fingerprint !== annotationProjectionFingerprint(corpusRow)) {
      throw new Error(`annotation key projection fingerprint mismatch for ${keyRow.sample_id}`);
    }
  }

  if (!manifest.provenance?.combinedSha256) {
    throw new Error('annotation freeze manifest is missing source provenance');
  }
  const currentProvenance = adaptiveWarrantStudySourceFingerprint();
  if (manifest.provenance.combinedSha256 !== currentProvenance.combinedSha256) {
    throw new Error('annotation freeze burned by source provenance drift');
  }

  if (annotationManifest) {
    verifyBoundFile('study plan', manifest.study_plan, true);
    verifyBoundFile('protocol', manifest.protocol, true);
    if (!isDeepStrictEqual(manifest.decision_gate, ADAPTIVE_WARRANT_DECISION_GATE)) {
      throw new Error('annotation freeze burned by decision gate drift');
    }
    const mechanismManifest = manifest.schema.includes('mechanism-validation');
    if (mechanismManifest && !manifest.execution_evidence?.rows_sha256) {
      throw new Error('mechanism annotation freeze is missing sealed execution evidence');
    }
    verifyBoundFile('annotation handbook', manifest.annotation_handbook, mechanismManifest);
    if (
      mechanismManifest &&
      frozenCorpus.provenance?.annotation_handbook?.sha256 !== manifest.annotation_handbook?.sha256
    ) {
      throw new Error('annotation corpus handbook binding does not match the freeze manifest');
    }
    if (mechanismManifest && manifest.projection_schemas?.annotation_corpus !== ADAPTIVE_WARRANT_ANNOTATION_SCHEMA) {
      throw new Error('annotation freeze projection schema does not match the v4 corpus');
    }
    for (const binding of manifest.zero_overlap?.excluded_corpora || []) {
      verifyBoundFile('excluded annotation corpus', binding, true);
    }
  }

  return {
    key,
    manifest,
    audit: {
      ok: true,
      legacy: false,
      manifest: { path: manifestPath, sha256: fileSha256(manifestPath), schema: manifest.schema },
      corpus_cases: corpusIds.length,
      key_cases: keyIds.length,
      source_provenance_sha256: currentProvenance.combinedSha256,
    },
  };

  function verifyBoundFile(label, binding, required) {
    if (!binding?.path || !binding?.sha256) {
      if (required) throw new Error(`annotation freeze manifest is missing its ${label} binding`);
      return;
    }
    const boundPath = path.isAbsolute(binding.path) ? binding.path : path.resolve(ROOT, binding.path);
    if (!fs.existsSync(boundPath) || fileSha256(boundPath) !== binding.sha256) {
      throw new Error(`annotation freeze burned by ${label} drift`);
    }
  }
}

function validateFrozenAnnotationStudyBindings({ manifest, study, corpus } = {}) {
  if (!manifest) return;
  if (!study) throw new Error('v3 annotation scoring requires the frozen study results');
  const expectedStudyId = manifest.source_study_id || corpus.study_id;
  if (study.studyId !== expectedStudyId) throw new Error('frozen study results do not match the annotation freeze');
  if (manifest.structured_parity) {
    const comparisonsByMode = Object.fromEntries(
      ['observe', 'active'].map((mode) => [
        mode,
        (study.rows || [])
          .filter((row) => row.warrantGateMode === mode)
          .reduce((sum, row) => sum + Number(row.liveShadowStructuredComparisonCount || 0), 0),
      ]),
    );
    const comparisons = Object.values(comparisonsByMode).reduce((sum, value) => sum + value, 0);
    const mismatches = (study.rows || []).reduce(
      (sum, row) => sum + Number(row.liveShadowStructuredMismatchCount || 0),
      0,
    );
    if (
      comparisons !== Number(manifest.structured_parity.comparisons) ||
      mismatches !== Number(manifest.structured_parity.mismatches) ||
      !isDeepStrictEqual(comparisonsByMode, manifest.structured_parity.comparisons_by_mode)
    ) {
      throw new Error('annotation freeze burned by structured study parity drift');
    }
  }
  const mechanismManifest = manifest.schema?.includes('mechanism-validation');
  if (mechanismManifest && !manifest.execution_evidence) {
    throw new Error('mechanism annotation freeze is missing sealed execution evidence');
  }
  if (manifest.execution_evidence) {
    const storedEvidence = buildAdaptiveWarrantStudyExecutionEvidence(study.rows || []);
    if (!isDeepStrictEqual(storedEvidence, manifest.execution_evidence)) {
      throw new Error('annotation freeze burned by stored execution evidence drift');
    }
    const jobs = study.plan?.jobs || [];
    if (jobs.length !== storedEvidence.row_count) {
      throw new Error('annotation freeze execution evidence does not cover the frozen study plan');
    }
    const sealedRows = jobs.map((job) => collectAdaptiveWarrantStudyJobResult(job));
    const sealedEvidence = buildAdaptiveWarrantStudyExecutionEvidence(sealedRows);
    if (!isDeepStrictEqual(sealedEvidence, manifest.execution_evidence)) {
      throw new Error('annotation freeze burned by sealed child execution drift');
    }
  }
}

export function scoreAnnotationArtifacts({
  rootDir,
  annotationAPath,
  annotationBPath,
  corpusFilename,
  keyFilename,
  outputFilename,
  evaluationBoundary,
  requireMechanismCorpus = false,
}) {
  const corpusPath = path.join(rootDir, corpusFilename);
  const keyPath = path.join(rootDir, keyFilename);
  const resolvedAnnotationAPath = path.resolve(annotationAPath);
  const resolvedAnnotationBPath = path.resolve(annotationBPath);
  if (resolvedAnnotationAPath === resolvedAnnotationBPath) {
    throw new Error('independent annotations must use distinct response files');
  }
  const corpus = readJson(corpusPath);
  const studyPlanPath = path.join(rootDir, 'study-plan.json');
  const studyResultsPath = path.join(rootDir, 'study-results.json');
  const freezeManifestPath = path.join(rootDir, 'annotation-freeze-manifest.json');
  const plannedMechanismStudy =
    (fs.existsSync(studyPlanPath) && readJson(studyPlanPath)?.config?.mechanismValidation === true) ||
    (fs.existsSync(studyResultsPath) && readJson(studyResultsPath)?.plan?.config?.mechanismValidation === true) ||
    (fs.existsSync(freezeManifestPath) &&
      readJson(freezeManifestPath)?.schema ===
        'machinespirits.adaptation-refinement.warrant-mechanism-validation-freeze.v1');
  const mechanismCorpusRequired = requireMechanismCorpus || plannedMechanismStudy;
  if (mechanismCorpusRequired && corpus.schema !== ADAPTIVE_WARRANT_ANNOTATION_SCHEMA) {
    throw new Error('mechanism annotation scoring requires the frozen v4 corpus schema');
  }
  const annotatorA = readJson(annotationAPath);
  const annotatorB = readJson(annotationBPath);
  const corpusSha256 = fileSha256(corpusPath);
  const annotatorASha256 = fileSha256(annotationAPath);
  const annotatorBSha256 = fileSha256(annotationBPath);
  const validation = {
    annotatorA: validateBlindedAnnotationResponse({
      response: annotatorA,
      corpus,
      expectedCorpusSha256: corpusSha256,
    }),
    annotatorB: validateBlindedAnnotationResponse({
      response: annotatorB,
      corpus,
      expectedCorpusSha256: corpusSha256,
    }),
  };
  const mechanismCorpus = mechanismCorpusRequired || corpus.schema === ADAPTIVE_WARRANT_ANNOTATION_SCHEMA;
  if (mechanismCorpus) {
    if (oneLine(annotatorA.annotator_id) === oneLine(annotatorB.annotator_id)) {
      throw new Error('v3 annotation responses require distinct annotator_id values');
    }
    if (oneLine(annotatorA.annotation_run_id) === oneLine(annotatorB.annotation_run_id)) {
      throw new Error('v3 annotation responses require distinct annotation_run_id values');
    }
  }
  // Read the private condition/decision key only after both blind files have
  // passed completeness, vocabulary, study-id, corpus-hash, schema, and
  // independent-identity validation.
  const freezeValidation = validateAdaptiveWarrantAnnotationFreeze({
    rootDir,
    corpusPath,
    keyPath,
    manifestFilename:
      corpusFilename === 'validation-sample.blinded.json'
        ? 'validation-freeze-manifest.json'
        : 'annotation-freeze-manifest.json',
    corpus,
    requireMechanismCorpus: mechanismCorpusRequired,
  });
  const { key, manifest } = freezeValidation;
  const studyPath = path.join(rootDir, 'study-results.json');
  const study = fs.existsSync(studyPath) ? readJson(studyPath) : null;
  validateFrozenAnnotationStudyBindings({ manifest, study, corpus });
  const liveShadowRows = (study?.rows || []).filter((row) => Number.isFinite(row.liveShadowAgreement));
  const frozenStructuredParity = manifest?.structured_parity || null;
  const liveShadowAgreement = frozenStructuredParity
    ? ratio(
        Number(frozenStructuredParity.comparisons) - Number(frozenStructuredParity.mismatches),
        Number(frozenStructuredParity.comparisons),
      )
    : mean(liveShadowRows.map((row) => row.liveShadowAgreement));
  const structuredParityMismatches = frozenStructuredParity
    ? Number(frozenStructuredParity.mismatches)
    : (study?.rows || []).reduce((sum, row) => sum + Number(row.liveShadowStructuredMismatchCount || 0), 0);
  const structuredParityComparisons = frozenStructuredParity
    ? Number(frozenStructuredParity.comparisons)
    : (study?.rows || []).reduce((sum, row) => sum + Number(row.liveShadowStructuredComparisonCount || 0), 0);
  const structuredParityComparisonsByMode = frozenStructuredParity
    ? frozenStructuredParity.comparisons_by_mode
    : Object.fromEntries(
        ['observe', 'active'].map((mode) => [
          mode,
          (study?.rows || [])
            .filter((row) => row.warrantGateMode === mode)
            .reduce((sum, row) => sum + Number(row.liveShadowStructuredComparisonCount || 0), 0),
        ]),
      );
  const scored = scoreBlindedAnnotations({ annotatorA, annotatorB, key });
  const score = {
    ...scored,
    studyId: corpus.study_id,
    scoredAt: new Date().toISOString(),
    evaluationBoundary,
    blindValidation: validation,
    freezeValidation: freezeValidation.audit,
    sources: {
      annotatorA: { path: annotationAPath, sha256: annotatorASha256 },
      annotatorB: { path: annotationBPath, sha256: annotatorBSha256 },
      corpus: { path: corpusPath, sha256: corpusSha256 },
      key: { path: keyPath, sha256: fileSha256(keyPath) },
      freezeManifest: freezeValidation.audit.manifest,
    },
    decisionGate: evaluateAdaptiveWarrantDecisionGate(scored, {
      liveShadowAgreement,
      structuredParityComparisons,
      structuredParityComparisonsByMode,
      structuredParityMismatches,
      requireMechanismMetrics: mechanismCorpus,
    }),
  };
  const outputPath = path.join(rootDir, outputFilename);
  writeJson(outputPath, score);
  return { outputPath, score };
}

function freezePostRepairValidation({ rootDir, offsetPerCell = 2, perCell = 2 } = {}) {
  const plan = readJson(path.join(rootDir, 'study-plan.json'));
  if (plan.config.mechanismValidation) {
    throw new Error('--freeze-validation is not used for the all-decisions mechanism-validation corpus');
  }
  const rows = plan.jobs.map((job) => collectJobResult(job));
  const status = resolveAdaptiveWarrantStudyStatus(rows, plan.jobs, {
    dryRun: plan.config.dryRun,
    horizon: plan.config.horizon,
  });
  if (status !== 'complete') throw new Error(`cannot freeze validation from study status ${status}`);
  const validationId = `${plan.studyId}-post-repair-validation-v1`;
  const annotation = buildBlindedAnnotationCorpus(rows, {
    perCell,
    studyId: validationId,
    samplingSeed: plan.studyId,
    offsetPerCell,
    sampleIdPrefix: 'validation-case',
  });
  const expectedCases = STUDY_PROFILES.length * STUDY_CONDITIONS.length * perCell;
  if (annotation.corpus.cases.length !== expectedCases) {
    throw new Error(`validation freeze expected ${expectedCases} cases, got ${annotation.corpus.cases.length}`);
  }
  annotation.key.cases = annotation.key.cases.map((row) => ({
    ...row,
    prediction_source: 'post_repair_offline_shadow',
    recorded_pre_repair_gate: row.gate,
    gate: null,
  }));
  const primaryKeyPath = path.join(rootDir, 'annotation-key.private.json');
  const primaryKey = readJson(primaryKeyPath);
  const primarySources = new Set(primaryKey.cases.map((row) => `${row.job_id}:${row.turn}`));
  const overlaps = annotation.key.cases.filter((row) => primarySources.has(`${row.job_id}:${row.turn}`));
  if (overlaps.length) throw new Error(`validation freeze overlaps ${overlaps.length} primary annotation cases`);
  const corpusPath = path.join(rootDir, 'validation-sample.blinded.json');
  const keyPath = path.join(rootDir, 'validation-key.private.json');
  writeJson(corpusPath, annotation.corpus);
  writeJson(keyPath, annotation.key);
  const manifest = {
    schema: 'machinespirits.adaptation-refinement.warrant-validation-freeze.v1',
    study_id: validationId,
    status: 'frozen',
    frozen_at: new Date().toISOString(),
    source_study_id: plan.studyId,
    sampling: {
      offset_per_profile_condition_cell: offsetPerCell,
      cases_per_profile_condition_cell: perCell,
      total_cases: annotation.corpus.cases.length,
      excludes_primary_annotation_sample: true,
      verified_primary_overlap_count: overlaps.length,
    },
    prediction_source:
      'current offline shadow over already-generated traces; recorded pre-repair live decisions ignored',
    calibration_boundary:
      'Fresh decision-point holdout from the valid n=5 pilot, but not fresh dialogue generation or live-v3 intervention evidence.',
    corpus: { path: corpusPath, sha256: fileSha256(corpusPath) },
    key: { path: keyPath, sha256: fileSha256(keyPath) },
    provenance: adaptiveWarrantStudySourceFingerprint(),
  };
  const manifestPath = path.join(rootDir, 'validation-freeze-manifest.json');
  writeJson(manifestPath, manifest);
  return { corpusPath, keyPath, manifestPath, manifest };
}

function printHelp() {
  console.log(`Usage:
  node scripts/run-adaptive-warrant-baseline-study.js --dry-run [options]
  node scripts/run-adaptive-warrant-baseline-study.js --launch-approved [options]
  node scripts/run-adaptive-warrant-baseline-study.js --analyze <study-root>
  node scripts/run-adaptive-warrant-baseline-study.js --refresh-report <study-root>
  node scripts/run-adaptive-warrant-baseline-study.js --score-annotations <study-root> --annotation-a <file> --annotation-b <file>
  node scripts/run-adaptive-warrant-baseline-study.js --freeze-validation <study-root>
  node scripts/run-adaptive-warrant-baseline-study.js --score-validation <study-root> --annotation-a <file> --annotation-b <file>

Options:
  --runs <1|5|10>           n per cell (1 with validation modes)
  --master-seed <n>         first paired seed (401 mechanism; 301 contract; otherwise 101)
  --parallelism <n>         concurrent dialogues (default: 6)
  --root <path>             output root (default: ignored timestamped directory)
  --model <ref>             speaking tutor model (default: codex.gpt-5.6-luna)
  --analysis-model <ref>    classifier and learner-record model (default: same)
  --learner-model <ref>     automated learner model (default: same)
  --dry-run                 execute every child auto-eval in dry-run mode
  --launch-approved         required for model-backed execution
  --launch-authorization <file>
                            digest-bound approval artifact required for a live mechanism study
  --expected-sha <40-hex>   exact clean HEAD authorized for a live mechanism study
  --contract-validation     fresh 9-dialogue decision-validation stage; no downstream claim
  --mechanism-validation    frozen 2-world x 6-profile x observe/active mechanism study
  --exclude-corpus <path>   prior blinded corpus to exclude by content hash (repeatable; required for mechanism)
  --resume                  skip already successful job-result files
  --analyze <root>          rebuild results from existing job artifacts only
  --refresh-report <root>   recompute aggregates/report without replaying traces
  --score-annotations <root> score two independent blinded annotation files
  --freeze-validation <root> freeze a disjoint post-repair decision holdout
  --score-validation <root> score the frozen post-repair validation holdout
  --annotation-a <file>     first completed blinded corpus
  --annotation-b <file>     second completed blinded corpus
`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      runs: { type: 'string' },
      'master-seed': { type: 'string' },
      parallelism: { type: 'string', default: '6' },
      root: { type: 'string' },
      model: { type: 'string', default: DEFAULT_MODEL },
      'analysis-model': { type: 'string', default: DEFAULT_MODEL },
      'learner-model': { type: 'string', default: DEFAULT_MODEL },
      'max-tokens': { type: 'string', default: '4096' },
      'history-turns': { type: 'string', default: '4' },
      'annotation-per-cell': { type: 'string', default: '2' },
      'dry-run': { type: 'boolean', default: false },
      'launch-approved': { type: 'boolean', default: false },
      'launch-authorization': { type: 'string' },
      'expected-sha': { type: 'string' },
      'contract-validation': { type: 'boolean', default: false },
      'mechanism-validation': { type: 'boolean', default: false },
      'exclude-corpus': { type: 'string', multiple: true, default: [] },
      resume: { type: 'boolean', default: false },
      analyze: { type: 'string' },
      'refresh-report': { type: 'string' },
      'score-annotations': { type: 'string' },
      'freeze-validation': { type: 'string' },
      'score-validation': { type: 'string' },
      'annotation-a': { type: 'string' },
      'annotation-b': { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) return printHelp();

  if (values['refresh-report']) {
    const rootDir = path.resolve(ROOT, values['refresh-report']);
    const studyPath = path.join(rootDir, 'study-results.json');
    const study = readJson(studyPath);
    study.aggregates = aggregateAdaptiveWarrantStudy(study.rows, {
      horizon: study.plan.config.horizon,
      ...planAxes(study.plan),
    });
    const validationScorePath = path.join(rootDir, 'validation-consensus-and-scores.json');
    study.postRepairValidation = fs.existsSync(validationScorePath) ? readJson(validationScorePath) : null;
    study.updatedAt = new Date().toISOString();
    writeJson(studyPath, study);
    fs.writeFileSync(path.join(rootDir, 'study-results.md'), markdownReport(study));
    console.log(`[warrant-study] refreshed ${path.join(rootDir, 'study-results.md')}`);
    return;
  }

  if (values['freeze-validation']) {
    const rootDir = path.resolve(ROOT, values['freeze-validation']);
    const frozen = freezePostRepairValidation({ rootDir });
    console.log(`[warrant-study] validation corpus ${frozen.corpusPath}`);
    console.log(`[warrant-study] sha256=${frozen.manifest.corpus.sha256}`);
    return;
  }

  if (values['score-validation']) {
    if (!values['annotation-a'] || !values['annotation-b']) {
      throw new Error('--score-validation requires --annotation-a and --annotation-b');
    }
    const rootDir = path.resolve(ROOT, values['score-validation']);
    const { outputPath, score } = scoreAnnotationArtifacts({
      rootDir,
      annotationAPath: path.resolve(ROOT, values['annotation-a']),
      annotationBPath: path.resolve(ROOT, values['annotation-b']),
      corpusFilename: 'validation-sample.blinded.json',
      keyFilename: 'validation-key.private.json',
      outputFilename: 'validation-consensus-and-scores.json',
      evaluationBoundary: 'fresh_post_repair_decision_holdout_from_existing_pilot_dialogues',
    });
    console.log(`[warrant-study] validation scores ${outputPath}`);
    console.log(
      `[warrant-study] scored=${score.metrics.scoredConsensusCases} uncertain=${score.metrics.uncertainCases}`,
    );
    return;
  }

  if (values['score-annotations']) {
    if (!values['annotation-a'] || !values['annotation-b']) {
      throw new Error('--score-annotations requires --annotation-a and --annotation-b');
    }
    const rootDir = path.resolve(ROOT, values['score-annotations']);
    const annotationAPath = path.resolve(ROOT, values['annotation-a']);
    const annotationBPath = path.resolve(ROOT, values['annotation-b']);
    const plan = readJson(path.join(rootDir, 'study-plan.json'));
    const { outputPath, score } = scoreAnnotationArtifacts({
      rootDir,
      annotationAPath,
      annotationBPath,
      corpusFilename: 'annotation-sample.blinded.json',
      keyFilename: 'annotation-key.private.json',
      outputFilename: 'annotation-consensus-and-scores.json',
      evaluationBoundary: plan.config.contractValidation
        ? 'fresh_dialogue_zero_overlap_action_contract_validation'
        : plan.config.mechanismValidation
          ? 'fresh_two_world_all_observe_decisions_mechanism_validation'
          : 'pre_repair_primary_calibration_sample',
      requireMechanismCorpus: plan.config.mechanismValidation === true,
    });
    const study = readJson(path.join(rootDir, 'study-results.json'));
    study.decisionQuality = score;
    study.annotation.scores = outputPath;
    writeJson(path.join(rootDir, 'study-results.json'), study);
    fs.writeFileSync(path.join(rootDir, 'study-results.md'), markdownReport(study));
    console.log(`[warrant-study] annotation scores ${outputPath}`);
    console.log(
      `[warrant-study] scored=${score.metrics.scoredConsensusCases} uncertain=${score.metrics.uncertainCases}`,
    );
    return;
  }

  if (values.analyze) {
    const rootDir = path.resolve(ROOT, values.analyze);
    const plan = readJson(path.join(rootDir, 'study-plan.json'));
    const rows = plan.jobs.map((job) => collectJobResult(job));
    for (const row of rows) writeJson(path.join(rootDir, 'job-results', `${row.jobId}.json`), row);
    const status = resolveAdaptiveWarrantStudyStatus(rows, plan.jobs, {
      dryRun: plan.config.dryRun,
      horizon: plan.config.horizon,
      requireStructuredParity: plan.config.mechanismValidation === true,
      requireDeliveryApplication: plan.config.mechanismValidation === true,
    });
    const study = writeStudyArtifacts({ rootDir, plan, rows, status });
    console.log(`[warrant-study] rebuilt ${path.join(rootDir, 'study-results.md')}`);
    console.log(`[warrant-study] status=${study.status} rows=${study.rows.length}/${study.plan.jobs.length}`);
    return;
  }

  const contractValidation = values['contract-validation'];
  const mechanismValidation = values['mechanism-validation'];
  if (contractValidation && mechanismValidation) {
    throw new Error('--contract-validation and --mechanism-validation are mutually exclusive');
  }
  if (mechanismValidation) {
    assertAdaptiveWarrantMechanismModelRefs({
      model: values.model,
      analysisModel: values['analysis-model'],
      learnerModel: values['learner-model'],
    });
  }
  const validationMode = contractValidation || mechanismValidation;
  const runs = positiveInt(values.runs || (validationMode ? '1' : '5'), '--runs');
  if (validationMode ? runs !== 1 : ![5, 10].includes(runs)) {
    throw new Error(
      validationMode ? 'validation modes require --runs 1' : '--runs must be 5 (pilot) or 10 (full study)',
    );
  }
  if (!values['dry-run'] && !values['launch-approved']) {
    throw new Error('Model-backed execution requires --launch-approved; run the same matrix with --dry-run first');
  }
  const masterSeed = positiveInt(
    values['master-seed'] ||
      (mechanismValidation
        ? String(ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.masterSeed)
        : contractValidation
          ? '301'
          : '101'),
    '--master-seed',
  );
  if (mechanismValidation && masterSeed !== ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.masterSeed) {
    throw new Error(
      `--mechanism-validation requires the predeclared master seed ${ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.masterSeed}`,
    );
  }
  const parallelism = positiveInt(values.parallelism, '--parallelism');
  const excludedAnnotationCorpora = (values['exclude-corpus'] || []).map((corpusPath) =>
    path.resolve(ROOT, corpusPath),
  );
  for (const corpusPath of excludedAnnotationCorpora) {
    if (!fs.existsSync(corpusPath)) throw new Error(`excluded annotation corpus not found: ${corpusPath}`);
  }
  const requiredExcludedAnnotationCorpora = mechanismValidation
    ? ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.excludedCorpora.map((corpusPath) => path.resolve(ROOT, corpusPath))
    : [];
  if (mechanismValidation && excludedAnnotationCorpora.length === 0) {
    throw new Error('--mechanism-validation requires one or more --exclude-corpus paths covering prior corpora');
  }
  const excludedSet = new Set(excludedAnnotationCorpora);
  const missingRequiredExclusions = requiredExcludedAnnotationCorpora.filter(
    (corpusPath) => !excludedSet.has(corpusPath),
  );
  if (missingRequiredExclusions.length) {
    throw new Error(
      `--mechanism-validation is missing required --exclude-corpus paths: ${missingRequiredExclusions.join(', ')}`,
    );
  }
  const rootDir = values.root
    ? path.resolve(ROOT, values.root)
    : path.join(
        ROOT,
        '.tutor-stub-auto-eval',
        mechanismValidation
          ? `adaptive-warrant-mechanism-validation-${safeTimestamp()}`
          : contractValidation
            ? `adaptive-warrant-contract-validation-${safeTimestamp()}`
            : `adaptive-warrant-baseline-${runs === 5 ? 'pilot' : 'full'}-${safeTimestamp()}`,
      );
  if (fs.existsSync(rootDir) && !values.resume) {
    throw new Error(`study root already exists; choose a new --root or pass --resume: ${rootDir}`);
  }
  const studyId = path.basename(rootDir);
  const worlds = mechanismValidation ? ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.worlds : ['world_005_marrick'];
  const profiles = mechanismValidation ? ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.profiles : STUDY_PROFILES;
  const conditions = mechanismValidation ? ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.conditions : STUDY_CONDITIONS;
  const horizon = mechanismValidation ? ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.horizon : DEFAULT_HORIZON;
  let jobs = buildAdaptiveWarrantBaselineJobs({
    rootDir,
    runs,
    masterSeed,
    model: values.model,
    analysisModel: values['analysis-model'],
    learnerModel: values['learner-model'],
    worlds,
    profiles,
    conditions,
    horizon,
    maxTokens: positiveInt(values['max-tokens'], '--max-tokens'),
    historyTurns: positiveInt(values['history-turns'], '--history-turns'),
    modelCallBudgetPerDialogue: MECHANISM_MODEL_CALL_BUDGET_PER_DIALOGUE,
    dryRun: values['dry-run'],
    studyId,
    mechanismValidation,
  });
  const provenance = adaptiveWarrantStudySourceFingerprint();
  if (!values['dry-run'] && mechanismValidation) {
    assertAdaptiveWarrantLaunchSource(provenance, values['expected-sha']);
  }
  const cliContract = mechanismValidation
    ? collectAdaptiveWarrantStudyCliContract({
        environment: process.env,
      })
    : null;
  jobs = jobs.map((job) => ({
    ...job,
    expectedGitSha: provenance.gitCommit,
    expectedGitDirty: Boolean(provenance.gitStatus),
    expectedChildPolicySha256: provenance.childPolicySha256,
  }));
  let plan = {
    schema: ADAPTIVE_WARRANT_BASELINE_STUDY_SCHEMA,
    studyId,
    createdAt: new Date().toISOString(),
    design: 'docs/adaptation-refinement/baseline-comparison-design.md',
    config: {
      runs,
      masterSeed,
      parallelism,
      horizon,
      policy: 'dynamic',
      world: mechanismValidation ? null : worlds[0],
      worlds,
      profiles,
      conditions,
      model: values.model,
      analysisModel: values['analysis-model'],
      learnerModel: values['learner-model'],
      maxTokens: positiveInt(values['max-tokens'], '--max-tokens'),
      historyTurns: positiveInt(values['history-turns'], '--history-turns'),
      modelCallBudgetPerDialogue: MECHANISM_MODEL_CALL_BUDGET_PER_DIALOGUE,
      annotationPerCell: mechanismValidation
        ? horizon
        : positiveInt(values['annotation-per-cell'], '--annotation-per-cell'),
      contractValidation,
      mechanismValidation,
      annotationAllDecisions: mechanismValidation && ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.annotationAllDecisions,
      annotationConditions: mechanismValidation
        ? ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.annotationConditions
        : conditions.map((condition) => condition.id),
      annotationPredictionBalanced: contractValidation,
      annotationExpectedCases: mechanismValidation
        ? worlds.length *
          profiles.length *
          ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.annotationConditions.length *
          horizon
        : null,
      annotationHandbook: mechanismValidation ? 'annotation-handbook.md' : null,
      excludedAnnotationCorpora,
      requiredExcludedAnnotationCorpora,
      learnerAnalysisPromptProfile: LEARNER_ANALYSIS_PROMPT_PROFILE,
      cliContract,
      environmentContract: adaptiveWarrantStudyEnvironmentContract({ cliContract }),
      dryRun: values['dry-run'],
      fixedSeams: [
        'dynamic register policy',
        'strict DAG',
        'eight learner turns',
        'no stop on grounded closure',
        'no light adaptation',
        'no DAG fact dropout',
        'same model routing',
        'compact_v1 learner-analysis prompt profile',
        'same seed within profile x session index',
        ...(mechanismValidation
          ? [
              'two predeclared worlds',
              'observe and active arms only',
              'all eight observe decisions enter the primary annotation corpus',
              'active decisions excluded from primary gold annotations',
              'zero structured live/offline parity mismatches with nonzero observe and active denominators',
            ]
          : []),
      ],
    },
    provenance,
    jobs,
  };
  const launchAuthorizationRequest = buildAdaptiveWarrantLaunchAuthorizationRequest(plan);
  let acceptedLaunchAuthorization = null;
  let launchAuthorizationPath = null;
  if (!values['dry-run'] && mechanismValidation) {
    if (!values['launch-authorization']) {
      throw new Error(
        'Live mechanism validation requires --launch-authorization <file> from the matching dry-run approval request',
      );
    }
    launchAuthorizationPath = path.resolve(ROOT, values['launch-authorization']);
    if (!fs.existsSync(launchAuthorizationPath)) {
      throw new Error(`launch authorization not found: ${launchAuthorizationPath}`);
    }
    const authorization = readJson(launchAuthorizationPath);
    acceptedLaunchAuthorization = validateAdaptiveWarrantLaunchAuthorization(authorization, launchAuthorizationRequest);
    plan.launchAuthorization = {
      ...acceptedLaunchAuthorization,
      source_path: relativeAuthorizationPath(launchAuthorizationPath),
      source_sha256: fileSha256(launchAuthorizationPath),
    };
  }
  const studyPlanPath = path.join(rootDir, 'study-plan.json');
  const launchAuthorizationRequestPath = path.join(rootDir, 'launch-authorization-request.json');
  if (values.resume) {
    if (!fs.existsSync(studyPlanPath)) {
      throw new Error(`--resume requires the immutable existing study plan: ${studyPlanPath}`);
    }
    const existingPlan = readJson(studyPlanPath);
    const comparison = compareAdaptiveWarrantStudyPlans(existingPlan, plan);
    if (!comparison.ok) {
      throw new Error(
        `resume plan drift: existing ${comparison.expected_sha256} != requested ${comparison.observed_sha256}; use a fresh study root`,
      );
    }
    if (acceptedLaunchAuthorization && !isDeepStrictEqual(existingPlan.launchAuthorization, plan.launchAuthorization)) {
      throw new Error('resume launch authorization does not match the immutable existing study plan');
    }
    if (!fs.existsSync(launchAuthorizationRequestPath)) {
      throw new Error('--resume requires the existing launch-authorization request');
    }
    const existingRequest = readJson(launchAuthorizationRequestPath);
    if (
      existingRequest.approval_digest !== launchAuthorizationRequest.approval_digest ||
      !isDeepStrictEqual(existingRequest.contract, launchAuthorizationRequest.contract) ||
      existingRequest.study_plan?.sha256 !== fileSha256(studyPlanPath)
    ) {
      throw new Error('resume launch-authorization request drift; use a fresh study root');
    }
    plan = existingPlan;
    jobs = existingPlan.jobs;
  } else {
    fs.mkdirSync(rootDir, { recursive: true });
    writeJson(studyPlanPath, plan);
    writeJson(launchAuthorizationRequestPath, {
      ...launchAuthorizationRequest,
      study_plan: {
        path: studyPlanPath,
        sha256: fileSha256(studyPlanPath),
      },
    });
    if (acceptedLaunchAuthorization) {
      writeJson(path.join(rootDir, 'launch-authorization.accepted.json'), {
        ...readJson(launchAuthorizationPath),
        acceptance_audit: plan.launchAuthorization,
      });
    }
  }
  console.log(`[warrant-study] plan ${studyPlanPath}`);
  console.log(
    `[warrant-study] launch authorization request ${launchAuthorizationRequestPath} digest=${launchAuthorizationRequest.approval_digest}`,
  );
  console.log(
    `[warrant-study] ${jobs.length} dialogues; ${runs} per ${worlds.length} worlds x ${conditions.length} conditions x ${profiles.length} learners`,
  );
  if (!values['dry-run']) runPreflight();
  assertAdaptiveWarrantStudyRuntimeBoundary(plan, { checkCli: plan.config.mechanismValidation === true });

  const resultDir = path.join(rootDir, 'job-results');
  const rowsById = new Map();
  if (values.resume) {
    for (const job of jobs) {
      if (!fs.existsSync(job.jobDir)) continue;
      const row = collectJobResult(job);
      const rowStatus = resolveAdaptiveWarrantStudyStatus([row], [job], {
        dryRun: plan.config.dryRun,
        horizon: plan.config.horizon,
        requireStructuredParity: plan.config.mechanismValidation === true,
        requireDeliveryApplication: plan.config.mechanismValidation === true,
      });
      const expectedRowStatus = plan.config.dryRun ? 'dry_run' : 'complete';
      if (rowStatus !== expectedRowStatus) {
        throw new Error(
          `resume refuses to replace or mix sealed child ${job.id} with status ${row.childStatus}; use a fresh study root`,
        );
      }
      rowsById.set(job.id, row);
      writeJson(path.join(resultDir, `${job.id}.json`), row);
    }
  }
  const pending = jobs.filter((job) => !rowsById.has(job.id));
  let completed = rowsById.size;
  await runPool(
    pending,
    parallelism,
    (job) =>
      runJob(job, {
        logsDir: path.join(rootDir, 'logs'),
        beforeSpawn: () =>
          assertAdaptiveWarrantStudyRuntimeBoundary(plan, {
            checkCli: plan.config.mechanismValidation === true,
          }),
        cliContract: plan.config.mechanismValidation === true ? plan.config.cliContract : null,
      }),
    async (job, processResult) => {
      const row = collectJobResult(job, processResult);
      rowsById.set(job.id, row);
      writeJson(path.join(resultDir, `${job.id}.json`), row);
      completed += 1;
      console.log(
        `[warrant-study] ${completed}/${jobs.length} ${job.id}: ${row.childStatus} ${row.turnCount || 0} turns`,
      );
      writeStudyArtifacts({
        rootDir,
        plan,
        rows: jobs.map((candidate) => rowsById.get(candidate.id)).filter(Boolean),
        status: 'running',
      });
    },
  );
  const rows = jobs.map((job) => rowsById.get(job.id)).filter(Boolean);
  const status = resolveAdaptiveWarrantStudyStatus(rows, jobs, {
    dryRun: values['dry-run'],
    horizon: plan.config.horizon,
    requireStructuredParity: plan.config.mechanismValidation === true,
    requireDeliveryApplication: plan.config.mechanismValidation === true,
  });
  const study = writeStudyArtifacts({ rootDir, plan, rows, status });
  console.log(`[warrant-study] report ${path.join(rootDir, 'study-results.md')}`);
  console.log(`[warrant-study] status=${study.status}`);
  if (!['complete', 'dry_run'].includes(status)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(`[warrant-study] error: ${error.message}`);
    process.exitCode = 1;
  });
}
