#!/usr/bin/env node

/**
 * Tiny editable AI tutor stub.
 *
 * This is deliberately much smaller than the full evaluation/chat stack:
 * - no server
 * - no DB writes
 * - no cell registry
 * - no rubric scoring
 *
 * Edit the STUB defaults or buildSystemPrompt() below, then run:
 *   npm run tutor:stub
 *   npm run tutor:stub -- --model openai.mini
 *   npm run tutor:stub -- --model openrouter.sonnet-5
 *   npm run tutor:stub -- --model claude-code.sonnet
 */

import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { clearLine, cursorTo, emitKeypressEvents, moveCursor } from 'node:readline';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { call as callAI, callStream as streamAI } from '../tutor-core/services/unifiedAIProviderService.js';
import { callAIWithCliBridge, isCliProvider, normalizeCliEffort } from '../services/cliProviderBridge.js';
import { getProviderConfig, loadProviders, resolveModel } from '../services/evalConfigLoader.js';
import { buildTutorDesireDag } from '../services/dramaticDerivation/beliefDesire.js';
import { closure, factKey } from '../services/dramaticDerivation/chainer.js';
import { buildLearnerDag, buildLearnerDagSnapshot } from '../services/dramaticDerivation/learnerDag.js';
import {
  buildLearnerProxyDagMemory,
  buildTutorLearnerDagModel,
} from '../services/dramaticDerivation/proxyDagMemory.js';
import {
  getEngagementStanceDefinition,
  getEngagementStanceDefinitions,
  getEngagementStanceNames,
  getRegisterOntologyVersion,
  getRequestTypeDefinitions,
  resolveEngagementStance,
} from '../services/engagementRegisterRegistry.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  consumeMixedLearnerReadyAnnouncement,
  invalidateMixedLearnerCache,
  mixedLearnerAnalysisCacheKey,
  mixedLearnerSuggestionMove,
  parseMixedLearnerArtifacts,
  refreshMixedLearnerPrompt,
} from '../services/mixedLearnerArtifacts.js';
import { cleanTutorStubClarificationSpeech, cleanTutorStubStageSpeech } from '../services/tutorStubStageSpeech.js';
import {
  auditTutorStubGenerousInferenceResponse,
  resolveTutorStubGenerousInference,
} from '../services/tutorStubGenerousInference.js';
import {
  auditTutorStubQuestionSupportResponse,
  buildTutorStubQuestionSupport,
  deterministicTutorStubQuestionSupportFallback,
} from '../services/tutorStubQuestionSupport.js';
import {
  auditTutorStubReleaseDelivery,
  auditTutorStubRepetitionResponse,
  deterministicTutorStubContextualFallback,
  tutorStubAnswerNameIsPublic,
} from '../services/tutorStubResponseGuard.js';
import {
  auditTutorStubDramaticReleaseResponse,
  buildTutorStubDramaticReleaseFrame,
  deterministicTutorStubDramaticReleaseFallback,
  tutorStubDramaticReleasePrompt,
} from '../services/tutorStubDramaticRelease.js';
import { buildTutorStubWorldScaffold } from '../services/tutorStubWorldScaffold.js';
import { buildTutorStubProofDebtState } from '../services/tutorStubProofDebt.js';
import {
  TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES,
  TUTOR_STUB_LEARNER_DAG_PREFLIGHT_SCHEMA,
  applyTutorStubPublicLearnerRecordUpdate as applyLearnerRecordUpdate,
  buildTutorStubLearnerDagPreflight,
  buildTutorStubPublicLearnerAnalysisPrompt,
  extractTutorStubPublicLearnerAnalysis,
  normalizeTutorStubHumanDiscourseExtraction as normalizeHumanDiscourseExtraction,
  normalizeTutorStubHumanDiscourseRows as normalizeDiscourseRows,
  parseTutorStubPublicLearnerAnalysisInteractive as parseClassifierJson,
  tutorStubHumanDiscoursePromptSchema as humanDiscourseExtractionSchema,
  tutorStubPublicFactSurface as factSurface,
  tutorStubPublicStagedEvidence as stagedEvidenceRows,
} from '../services/tutorStubPublicLearnerAnalysis.js';
import {
  advanceTutorStubDialogueClosure,
  auditTutorStubDialogueClosureResponse,
  buildTutorStubDialogueClosureFrame,
  createTutorStubDialogueClosureLifecycle,
  deterministicTutorStubClosureResponse,
  tutorStubClosureAcknowledgement,
  tutorStubLearnerDagGrounded,
} from '../services/tutorStubDialogueClosure.js';
import {
  DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
  MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
  MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
  normalizeTutorStubEngagementStanceTemperature,
} from '../services/tutorStubRegisterTemperature.js';
import {
  DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
  DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_SEED,
  TUTOR_STUB_DAG_FACT_DROPOUT_SCHEMA,
  applyTutorStubDagFactDropout,
  createTutorStubDagFactDropoutState,
  normalizeTutorStubDagFactDropoutRate,
  normalizeTutorStubDagFactDropoutSeed,
  tutorStubDagFactDropoutSnapshot,
} from '../services/tutorStubDagFactDropout.js';
import {
  applyTutorStubComprehensionRequest,
  applyTutorStubComprehensionResponse,
  createTutorStubComprehensionState,
  detectTutorStubComprehensionRequest,
  tutorStubComprehensionFeatures,
  tutorStubComprehensionPrompt,
  tutorStubComprehensionSnapshot,
} from '../services/tutorStubComprehensionState.js';
import {
  buildContinuousRegisterPolicyMetadata,
  buildContinuousEngagementStanceVector,
  continuousEngagementStanceInstruction,
} from '../services/tutorStubContinuousRegister.js';
import {
  auditTutorStubResponseConfiguration,
  buildTutorStubResponseConfiguration,
  selectTutorStubActorialPart,
  selectTutorStubActorialPerformance,
  summarizeTutorStubResponseConfigurationAudits,
  tutorStubResponseConfigurationPrompt,
} from '../services/tutorStubResponseConfiguration.js';
import {
  auditTutorStubResponseComposition,
  buildTutorStubResponseCompositionFrame,
  deterministicTutorStubLearnerUptake,
  formatTutorStubResponseComposition,
  tutorStubResponseCompositionPrompt,
} from '../services/tutorStubResponseComposition.js';
import {
  auditTutorStubPrompt,
  auditTutorStubSpeakerPrivilege,
  recoverTutorStubDuplicateInstructionLines,
  recoverTutorStubSpeakerPrompt,
  tutorStubPromptArchitecture,
  tutorStubPromptSurfaceForRole,
} from '../services/tutorStubPromptAudit.js';
import {
  learnerProfileContract,
  learnerProfileDescription,
  learnerProfileIds,
  learnerProfileListText,
  learnerProfilePickerPresentation,
  learnerProfilePrompt,
  learnerProfileSpeakerLabel,
  learnerProfileSuiteIds,
} from './tutor-stub-learner-profile-contracts.js';
import {
  TUTOR_STUB_TRANSCRIPT_HTML_SCHEMA,
  launchTutorStubTranscriptHtml,
  writeTutorStubTranscriptHtml,
} from '../services/tutorStubTranscriptHtml.js';
import {
  TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA,
  writeTutorStubLearningSummaryHtml,
} from '../services/tutorStubLearningSummaryHtml.js';
import {
  listTutorStubTutorInstances,
  resolveTutorStubTutorInstance,
  tutorStubTutorInstancePrompt,
} from '../services/tutorStubTutorInstance.js';
import {
  TUTOR_STUB_FEEDBACK_REASONS,
  approveTutorStubTuningCandidate,
  createTutorStubTuningRuntime,
  listTutorStubTuningCandidates,
  normalizeTutorStubTuningMode,
  promoteTutorStubTuningCandidate,
  readTutorStubTuningCandidate,
  recordTutorStubTuningFeedback,
  recordTutorStubTuningNote,
  rejectTutorStubTuningCandidate,
  rollbackTutorStubTutorVersion,
  setTutorStubTuningMode,
  synthesizeTutorStubTuningCandidate,
  tutorStubTuningPrompt,
  tutorStubTuningReplayPath,
  tutorStubTuningSnapshot,
  tutorStubTuningTurnAdvisory,
  validateTutorStubTuningCandidate,
} from '../services/tutorStubTuning.js';
import { createTutorStubConcurrentTerminal } from '../services/tutorStubConcurrentTerminal.js';
import { createTutorStubLineSelection } from '../services/tutorStubLineSelection.js';
import {
  copyTutorStubTextToClipboard,
  formatTutorStubDebugClipboardText,
} from '../services/tutorStubClipboard.js';
import {
  clearTutorStubTurnFeedbackRating,
  clearTutorStubTurnFeedbackTarget,
  commitTutorStubTurnFeedback,
  createTutorStubTurnFeedbackState,
  requestTutorStubTurnFeedback,
  setTutorStubTurnFeedbackEnabled,
  setTutorStubTurnFeedbackRating,
  tutorStubTurnFeedbackArrowRating,
  tutorStubTurnFeedbackEnvelope,
  tutorStubTurnFeedbackLabel,
  tutorStubTurnFeedbackPrompt,
  tutorStubTurnFeedbackRegisterPrompt,
} from '../services/tutorStubTurnFeedback.js';
import {
  auditTutorStubFeedbackAdaptation,
  buildTutorStubFeedbackAdaptationPlan,
  buildTutorStubFeedbackObservation,
  buildTutorStubFeedbackRatingRecord,
  findTutorStubFeedbackTargetTurn,
} from '../services/tutorStubFeedbackLearning.js';
import {
  TUTOR_STUB_OPENING_REQUIREMENTS,
  auditTutorStubOpening,
  buildTutorStubOpeningFrame,
  deterministicTutorStubOpening,
  tutorStubOpeningPrompt,
  tutorStubOpeningSystemPrompt,
} from '../services/tutorStubOpening.js';
import {
  tutorStubPublicMessageContext,
  tutorStubPublicMessagesForSpeaker,
} from '../services/tutorStubPublicHistory.js';
import { buildTutorStubLearnerAdvance } from '../services/tutorStubLearnerAdvance.js';
import {
  clearTutorStubLastSettings,
  readTutorStubLastSettings,
  tutorStubRememberedPolicyStack,
  writeTutorStubLastSettings,
} from '../services/tutorStubLastSettings.js';
import {
  DEFAULT_TUTOR_STUB_RELEASE_SPEED,
  MAX_TUTOR_STUB_RELEASE_SPEED,
  MIN_TUTOR_STUB_RELEASE_SPEED,
  acknowledgeTutorStubOpeningRelease,
  advanceTutorStubReleasePacing,
  commitTutorStubReleasePacing,
  createTutorStubReleasePacingState,
  normalizeTutorStubReleaseSpeed,
  restoreTutorStubReleasePacingFromTurns,
  setTutorStubReleaseSpeed,
  tutorStubReleasePacingSnapshot,
} from '../services/tutorStubReleasePacing.js';
import {
  buildDynamicalSystemRegisterScores,
  buildDynamicalSystemState,
  buildFieldRegisterScores,
  buildStateRegisterScores,
  buildTrajectoryRegisterScores,
  clampField01,
  dagProgressFeatures,
  DYNAMICAL_SYSTEM_REGISTER_AFFINITY,
  DYNAMICAL_SYSTEM_TEMPERATURE,
  hasExplicitStepwiseSignal,
  latestRegisterEfficacy,
  latestRegisterSelection,
  normalizeEngagementStanceDistribution,
  normalizeStoredRegisterEfficacy,
  normalizeStoredRegisterSelection,
  numberOr,
  preferredLegacyRegister,
  recentRegisterCount,
  registerAffinityContributions,
  registerEfficacyFromDagProgress,
  roundField,
  scoreValue,
  topNumericEntries,
} from '../services/tutorStubRegisterPolicy.js';
import {
  applyTutorStubPointOfActionConstraint,
  auditTutorStubPointOfActionCompliance,
  buildTutorStubPointOfActionTurn,
  normalizeTutorStubPointOfActionArm,
  tutorStubPointOfActionPrompt,
  tutorStubPointOfActionStandingBook,
} from '../services/tutorStubPointOfActionCoaching.js';
import {
  DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
  TUTOR_STUB_REGISTER_OVERLAY_POLICIES,
  TUTOR_STUB_REGISTER_POLICY_COMPOSITION_SCHEMA,
  evaluateTutorStubRegisterPolicyOverlay,
  normalizeTutorStubRegisterOverlayThreshold,
  parseTutorStubRegisterPolicyStack,
  tutorStubRegisterPolicyStackId,
} from '../services/tutorStubRegisterPolicyComposition.js';
import { sampleTutorStubPolicyDistribution } from '../services/tutorStubPolicySampler.js';
import { captureGitProvenanceSummary, hashCanonicalJson } from '../services/experimentRunArtifacts.js';
import { buildTutorStubStateObservation } from '../services/adaptiveTutor/tutorStubStateAdapter.js';
import {
  ADAPTATION_ACTIONS,
  estimateLearnerStateBelief,
  selectPedagogicalAction,
} from '../services/adaptiveTutor/actionPolicy.js';
import { createAdaptationContract } from '../services/adaptiveTutor/adaptationContract.js';
import {
  appendPendingIntervention,
  closePendingIntervention,
  createPendingIntervention,
} from '../services/adaptiveTutor/interventionLedger.js';
import {
  buildTutorStubTypedActionDecision,
  tutorStubMoveFamilyForAction,
} from '../services/adaptiveTutor/tutorStubActionAdapter.js';
import {
  advanceScaffoldLifecycle,
  allowedMoveFamiliesForScaffoldPhase,
  createScaffoldLifecycle,
  SCAFFOLD_LIFECYCLE_SCHEMA,
  validateScaffoldLifecycle,
} from '../services/adaptiveTutor/scaffoldLifecycle.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_DIR = path.join(ROOT, 'config/drama-derivation');
const UNSUPPORTED_CODEX_MINI_REFS = new Set(['codex.mini', 'codex.gpt-mini', 'codex.gpt-5-mini']);
const NEGATIVE_FLOOR_REGISTERS = ['ironic', 'sarcastic', 'face_threat'];
const DAG_MODES = ['strict_dag', 'human_scaffold', 'defeasible_human_scaffold'];
const HUMAN_DISCOURSE_RUN_CONFIG_SCHEMA = 'machinespirits.tutor-stub.human-discourse-run-config.v1';
const HUMAN_DISCOURSE_FRAME_SCHEMA = 'machinespirits.tutor-stub.human-discourse-frame.v1';
const SCAFFOLD_STATE_SCHEMA = 'machinespirits.tutor-stub.scaffold-state.v1';
const SIDE_ARC_SCHEMA = 'machinespirits.tutor-stub.side-arc.v1';
const WARRANT_PREMISE_AUDIT_SCHEMA = 'machinespirits.tutor-stub.warrant-premise-audit.v1';
const HUMAN_DISCOURSE_PHASE = 'phase_2_human_scaffold_prompting';
const TUTOR_GUARD_ACCOUNTING_SCHEMA = 'machinespirits.tutor-stub.guard-accounting.v1';
const TUTOR_GUARD_SUMMARY_SCHEMA = 'machinespirits.tutor-stub.guard-accounting-summary.v1';
const TUTOR_TYPED_ACTION_CONFIG_SCHEMA = 'machinespirits.tutor-stub.typed-action-runtime-config.v1';
const TUTOR_TYPED_ACTION_OUTCOME_SCHEMA = 'machinespirits.tutor-stub.typed-action-outcome.v1';
const DEFAULT_TUTOR_MODEL_REF = 'codex.gpt-5.6-terra';
const DEFAULT_INTERPRETATION_MODEL_REF = 'codex.gpt-5.6-sol';
const DEFAULT_AUTO_LEARNER_MODEL_REF = 'codex.gpt-5.6-terra';

const STUB = {
  tutor: process.env.TUTOR_STUB_TUTOR || 'dramatic-detective',
  tuning: process.env.TUTOR_STUB_TUNING || 'off',
  allModels: process.env.TUTOR_STUB_ALL_MODELS || '',
  model: process.env.TUTOR_STUB_MODEL || DEFAULT_TUTOR_MODEL_REF,
  classifierModel: process.env.TUTOR_STUB_CLASSIFIER_MODEL || DEFAULT_INTERPRETATION_MODEL_REF,
  learnerRecordModel:
    process.env.TUTOR_STUB_LEARNER_RECORD_MODEL ||
    process.env.TUTOR_STUB_CLASSIFIER_MODEL ||
    DEFAULT_INTERPRETATION_MODEL_REF,
  topic: process.env.TUTOR_STUB_TOPIC || 'fractions',
  world: process.env.TUTOR_STUB_WORLD || 'world_005_marrick',
  learner: 'A curious learner who may be partly right, partly confused, and unsure how to explain their thinking.',
  goal: 'Help the learner make one small conceptual move. Prefer questions and concrete examples over explanation dumps.',
  style: 'Calm, concise, Socratic, and specific. Do not perform the whole solution unless the learner is truly stuck.',
  temperature: 0.35,
  maxTokens: 2000,
  historyTurns: Number.parseInt(process.env.TUTOR_STUB_HISTORY_TURNS || '4', 10),
  memorySummary: process.env.TUTOR_STUB_MEMORY_SUMMARY !== '0',
  traceDir: process.env.TUTOR_STUB_TRACE_DIR || '.tutor-stub-traces',
  settingsFile: process.env.TUTOR_STUB_SETTINGS_FILE || '.tutor-stub-traces/last-settings.json',
  stream: process.env.TUTOR_STUB_STREAM !== '0',
  interimAnimation: process.env.TUTOR_STUB_INTERIM_ANIMATION !== '0',
  cliEffort: process.env.TUTOR_STUB_CLI_EFFORT || 'medium',
  registerPolicy: process.env.TUTOR_STUB_REGISTER_POLICY || 'dynamic',
  pointOfActionArm: process.env.TUTOR_STUB_POINT_OF_ACTION_ARM || '',
  registerOverlayThreshold:
    process.env.TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD || String(DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD),
  registerTemperature:
    process.env.TUTOR_STUB_REGISTER_TEMPERATURE || String(DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE),
  dagFactDropout: process.env.TUTOR_STUB_DAG_FACT_DROPOUT || String(DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE),
  dagFactDropoutSeed: process.env.TUTOR_STUB_DAG_FACT_DROPOUT_SEED || String(DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_SEED),
  releaseSpeed: process.env.TUTOR_STUB_RELEASE_SPEED || String(DEFAULT_TUTOR_STUB_RELEASE_SPEED),
  runSeed: process.env.TUTOR_STUB_RUN_SEED || '1',
  typedActions: process.env.TUTOR_STUB_TYPED_ACTIONS === '1',
  typedActionTaskId: process.env.TUTOR_STUB_TYPED_ACTION_TASK_ID || 'tutor-stub-public-reasoning',
  typedActionKnowledgeComponent:
    process.env.TUTOR_STUB_TYPED_ACTION_KNOWLEDGE_COMPONENT || 'public-evidence-to-warrant-linkage',
  typedActionPrerequisites:
    process.env.TUTOR_STUB_TYPED_ACTION_PREREQUISITES || 'identify public evidence,state a warranted link',
  typedActionItemDifficulty: process.env.TUTOR_STUB_TYPED_ACTION_ITEM_DIFFICULTY || '0.5',
  typedActionSupportLevel: process.env.TUTOR_STUB_TYPED_ACTION_SUPPORT_LEVEL || '',
  dagMode: process.env.TUTOR_STUB_DAG_MODE || 'strict_dag',
  multipleChoice: process.env.TUTOR_STUB_MULTIPLE_CHOICE === '1',
  opening: process.env.TUTOR_STUB_OPENING !== '0',
  openingRealizer: process.env.TUTOR_STUB_OPENING_REALIZER || 'model',
  closeoutReport: process.env.TUTOR_STUB_CLOSEOUT_REPORT !== '0',
  fieldViz: process.env.TUTOR_STUB_FIELD_VIZ === '1',
  autoLearnerModel: process.env.TUTOR_STUB_AUTO_LEARNER_MODEL || DEFAULT_AUTO_LEARNER_MODEL_REF,
  autoTurns: process.env.TUTOR_STUB_AUTO_TURNS || 'until-grounded',
  autoSafetyTurns: Number.parseInt(process.env.TUTOR_STUB_AUTO_SAFETY_TURNS || '80', 10),
  autoLearnerProfile: process.env.TUTOR_STUB_AUTO_LEARNER_PROFILE || 'diligent',
  mixedLearner: process.env.TUTOR_STUB_MIXED_LEARNER === '1',
  turnFeedback: process.env.TUTOR_STUB_TURN_FEEDBACK !== '0',
};

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  brightBlue: '\x1b[94m',
  brightCyan: '\x1b[96m',
  brightMagenta: '\x1b[95m',
  brightYellow: '\x1b[93m',
  brightGreen: '\x1b[92m',
};

const REGISTER_TEMPERATURE_POLICIES = new Set([
  'state',
  'field',
  'trajectory',
  'dynamical_system',
  'empirical_dynamical_system',
  'continuous_dynamical_system',
  'continuous_empirical_dynamical_system',
]);

const SLASH_COMMANDS = [
  '/analysis',
  '/a',
  '/field',
  '/f',
  '/viz',
  '/v',
  '/visualization',
  '/clarify',
  '/explain',
  '/c',
  '/report',
  '/r',
  '/transcript',
  '/html',
  '/director',
  '/notes',
  '/up',
  '/down',
  '/feedback',
  '/tune',
  '/settings',
  '/status',
  '/debug',
  '/mode',
  '/learner',
  '/coach',
  '/auto',
  '/id',
  '/turn-id',
  '/debug-id',
  '/suggest',
  '/clue',
  '/hint',
  '/profile',
  '/scenario',
  '/use',
  '/accept',
  '/regen',
  '/reset',
  '/clear',
  '/help',
  '/quit',
  '/exit',
];

const PASSTHROUGH_SLASH_COMMANDS = [
  '/settings',
  '/status',
  '/transcript',
  '/html',
  '/director',
  '/notes',
  '/scenario',
  '/id',
  '/turn-id',
  '/debug-id',
  '/reset',
  '/clear',
  '/help',
  '/quit',
  '/exit',
];

const SCENE_RETURN_SLASH_COMMANDS = new Set([
  '/help',
  '/status',
  '/debug',
  '/settings',
  '/transcript',
  '/html',
  '/director',
  '/notes',
  '/analysis',
  '/a',
  '/field',
  '/f',
  '/viz',
  '/v',
  '/visualization',
  '/clarify',
  '/explain',
  '/c',
  '/report',
  '/r',
  '/id',
  '/turn-id',
  '/debug-id',
  '/profile',
  '/scenario',
]);

const SETTINGS_COMPLETIONS = [
  '/settings model ',
  '/settings models',
  '/settings models all ',
  '/settings models tutor ',
  '/settings models classifier ',
  '/settings models reasoning ',
  '/settings models learner ',
  '/settings temp ',
  '/settings dropout ',
  '/settings release-speed ',
  '/settings forget',
  '/settings policy add state',
  '/settings policy add field',
  '/settings policy remove state',
  '/settings policy remove field',
  '/settings policy clear',
  '/settings policy threshold ',
];

const CUSTOM_LEARNER_PROFILE_EXAMPLE =
  'The learner can identify individual clues but struggles to connect them. When asked for a conclusion, they repeat the newest clue. They progress only when the tutor asks them to connect two specific public facts.';

const CLASSIFIER_SYSTEM_PROMPT = [
  'You are a compact pedagogical discourse classifier for an experimental tutor.',
  'Classify only what is visible in the public learner/tutor exchange.',
  'Do not infer hidden story facts, concealed answers, private tutor prompts, or private DAG state.',
  'Return one JSON object only. No prose outside JSON.',
].join('\n');

const LEARNER_RECORD_SYSTEM_PROMPT = [
  'You are a conservative public-record extractor for a tutor-side learner-DAG model.',
  'Use only the learner input, the public transcript, public rules, and staged public evidence supplied in the prompt.',
  'Do not infer private mental states, unstaged evidence, concealed answers, proof paths, or release schedules beyond the staged list.',
  'Return one JSON object only. No prose outside JSON.',
].join('\n');

const AUTO_LEARNER_SYSTEM_PROMPT = [
  'You are an automated learner in an experimental tutoring dialogue.',
  'You see only the public transcript and the latest tutor message.',
  'Do not infer hidden proof paths, concealed answers, private tutor prompts, or unstaged evidence.',
  "The private behavior brief supplied below defines how this learner responds. It takes priority over generic helpfulness, smooth progress, and the tutor's request for a useful answer.",
  'Preserve its recurring behavior and repair pattern. Do not silently become a generic diligent learner after correction.',
  'When the active profile permits progress, you may connect several already-public premises and state a supported follow-up conclusion in one concise turn. Never invent or anticipate unstaged evidence.',
  'Reply as the learner only. No role label, no analysis, no JSON.',
  'Keep the reply concise: usually one sentence, one question, or one warranted evidence claim.',
].join('\n');

const CLARIFIER_SYSTEM_PROMPT = [
  'You clarify wording inside a staged inquiry.',
  'Use only the public scene, public transcript, and latest tutor message supplied in the prompt.',
  'Do not infer hidden proof paths, concealed answers, private tutor prompts, private DAG state, or unstaged evidence.',
  'Do not continue the lesson or answer the case question. Explain wording only.',
  'Speak directly inside the scene. Never refer to "the tutor", "the learner", "the dialogue", or "the prompt".',
  'Keep the reply short and concrete. No JSON, no role label.',
].join('\n');

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    tutor: { type: 'string', default: STUB.tutor },
    tuning: { type: 'string', default: STUB.tuning },
    'tuning-dir': { type: 'string', default: process.env.TUTOR_STUB_TUNING_DIR || '.tutor-stub-tuning' },
    'all-models': { type: 'string', default: STUB.allModels },
    model: { type: 'string', default: STUB.model },
    'classifier-model': { type: 'string', default: STUB.classifierModel },
    'no-classifier': { type: 'boolean', default: false },
    passthrough: { type: 'boolean', default: false },
    'tutor-learner-dag': { type: 'boolean', default: false },
    'learner-record-model': { type: 'string', default: STUB.learnerRecordModel },
    'no-register-selection': { type: 'boolean', default: false },
    'register-palette': { type: 'string', default: 'all' },
    'register-policy': { type: 'string', default: STUB.registerPolicy },
    'point-of-action-arm': { type: 'string', default: STUB.pointOfActionArm },
    'register-overlay-threshold': { type: 'string', default: STUB.registerOverlayThreshold },
    // Predeclared pressure probe: at these learner turns the selected
    // register is forced hostile (face_threat) regardless of policy, so
    // post-trigger recovery can be scored as a designed event rather than a
    // policy-endogenous one. CSV of learner turn numbers, e.g. "6".
    'pressure-turns': { type: 'string', default: '' },
    'register-temperature': { type: 'string', default: STUB.registerTemperature },
    'dag-fact-dropout': { type: 'string', default: STUB.dagFactDropout },
    'dag-fact-dropout-seed': { type: 'string', default: STUB.dagFactDropoutSeed },
    'release-speed': { type: 'string', default: STUB.releaseSpeed },
    'run-seed': { type: 'string', default: STUB.runSeed },
    'eval-repeat': { type: 'string', default: '1' },
    'eval-job-id': { type: 'string', default: '' },
    'typed-actions': { type: 'boolean', default: STUB.typedActions },
    'typed-action-task-id': { type: 'string', default: STUB.typedActionTaskId },
    'typed-action-knowledge-component': { type: 'string', default: STUB.typedActionKnowledgeComponent },
    'typed-action-prerequisites': { type: 'string', default: STUB.typedActionPrerequisites },
    'typed-action-item-difficulty': { type: 'string', default: STUB.typedActionItemDifficulty },
    'typed-action-support-level': { type: 'string', default: STUB.typedActionSupportLevel },
    'register-empirical-prior': {
      type: 'string',
      default: process.env.TUTOR_STUB_REGISTER_EMPIRICAL_PRIOR || '',
    },
    'safe-registers': { type: 'boolean', default: false },
    topic: { type: 'string', default: STUB.topic },
    world: { type: 'string', default: STUB.world },
    dag: { type: 'boolean', default: false },
    'dag-mode': { type: 'string', default: STUB.dagMode },
    'list-worlds': { type: 'boolean', default: false },
    'list-tutors': { type: 'boolean', default: false },
    'list-learner-profiles': { type: 'boolean', default: false },
    learner: { type: 'string', default: STUB.learner },
    goal: { type: 'string', default: STUB.goal },
    style: { type: 'string', default: STUB.style },
    system: { type: 'string' },
    once: { type: 'string' },
    'auto-learner': { type: 'boolean', default: false },
    'auto-learner-model': { type: 'string', default: STUB.autoLearnerModel },
    'auto-learner-profile': { type: 'string', default: STUB.autoLearnerProfile },
    'auto-turns': { type: 'string', default: String(STUB.autoTurns) },
    'auto-safety-turns': { type: 'string', default: String(STUB.autoSafetyTurns) },
    'no-auto-stop-on-grounded': { type: 'boolean', default: false },
    'mixed-learner': { type: 'boolean', default: STUB.mixedLearner },
    'mixed-mode': { type: 'boolean', default: false },
    save: { type: 'string' },
    'prompt-book-context': { type: 'string' },
    'trace-dir': { type: 'string', default: STUB.traceDir },
    'settings-file': { type: 'string', default: STUB.settingsFile },
    'no-remember-settings': {
      type: 'boolean',
      default: process.env.TUTOR_STUB_REMEMBER_SETTINGS === '0',
    },
    'no-trace': { type: 'boolean', default: false },
    'resume-last': { type: 'boolean', default: false },
    'no-stream': { type: 'boolean', default: false },
    'no-interim-animation': { type: 'boolean', default: false },
    'no-memory-summary': { type: 'boolean', default: false },
    'field-viz': { type: 'boolean', default: STUB.fieldViz },
    'multiple-choice': { type: 'boolean', default: STUB.multipleChoice },
    'no-opening': { type: 'boolean', default: false },
    'opening-realizer': { type: 'string', default: STUB.openingRealizer },
    'no-closeout-report': { type: 'boolean', default: false },
    'no-turn-feedback': { type: 'boolean', default: false },
    'cli-effort': { type: 'string', default: STUB.cliEffort },
    temperature: { type: 'string', default: String(STUB.temperature) },
    'max-tokens': { type: 'string', default: String(STUB.maxTokens) },
    'history-turns': { type: 'string', default: String(STUB.historyTurns) },
    'show-prompt': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function printHelp() {
  console.log(`Usage:
  npm run tutor:stub -- [options]
  node scripts/tutor-stub.js [options] [first learner message]

Options:
  --tutor <id[@vN]>     named, versioned speaking-tutor instance
                         (default: ${STUB.tutor})
  --tuning <off|capture|on|canary>
                         capture feedback and create reviewable tutor-version
                         candidates; canary runs the approved candidate version
                         (default: ${STUB.tuning})
  --tuning-dir <path>   local evidence, version, candidate, and replay store
                         (default: .tutor-stub-tuning; env TUTOR_STUB_TUNING_DIR)
  --passthrough          pure speaker baseline: system setup + full public
                         history + latest learner message; exactly one model
                         call per turn, with analysis and harness policy off
  --all-models <ref>     use one provider alias for tutor, classifier,
                         learner-DAG analysis, and automated/mixed learner;
                         overrides all four role-specific model flags
  --model <ref>          provider alias from config/providers.yaml
                         examples: openai.mini, openrouter.sonnet-5,
                         codex.gpt-5.6-terra, claude-code.sonnet
                         (default speaking tutor: ${STUB.model})
  --point-of-action-arm <standing_book|triggered_placebo|side_coach|compiled_constraint>
                         frozen final-stretch Step 4 intervention arm
  --classifier-model <ref>
                         learner-input classifier model (default: ${STUB.classifierModel})
  --no-classifier        skip the upfront learner-input classifier
  --tutor-learner-dag    track the learner's public evidence and reasoning privately
  --learner-record-model <ref>
                         model for --tutor-learner-dag; when the classifier is
                         also on, this single call returns both outputs
                         (default: ${STUB.learnerRecordModel})
  --no-register-selection
                         keep tutor speaking style fixed instead of adapting it
  --register-palette <all|safe|negative|non-simulated|csv>
                         tutor-register palette for selection (default: all);
                         all includes every register in the registry
  --register-policy <dynamic|state|field|trajectory|dynamical_system|empirical_dynamical_system|continuous_dynamical_system|continuous_empirical_dynamical_system|bland|random|negative>
                         dynamic lets the reviewer choose; field maps observed
                         field/DAG movement to a local probability distribution;
                         trajectory extends field with recent velocity, slope,
                         acceleration, and risk trends;
                         dynamical_system maps a continuous state/derivative
                         vector through theory priors plus empirical efficacy;
                         empirical_dynamical_system additionally loads
                         cross-run empirical priors when available;
                         continuous_* variants keep a nearest register label
                         but pass a weighted engagement-stance blend to the tutor;
                         state maps current classifier/DAG state to a local
                         probability distribution;
                         bland fixes a plain non-adaptive baseline register;
                         random samples uniformly from the active palette;
                         negative samples only ironic, sarcastic, face_threat
                         (default: ${STUB.registerPolicy}); append +state and/or
                         +field to add strong-change overlays, for example
                         dynamical_system+state+field
  --register-overlay-threshold <n>
                         minimum normalized turn-change strength in [0,1]
                         before an added state/field policy may override the
                         primary policy (default: ${STUB.registerOverlayThreshold})
  --safe-registers       limit tutor-register selection to router-selectable
                         safe registers
  --register-empirical-prior <path|auto|off>
                         JSON prior built by
                         scripts/build-tutor-stub-register-priors.js;
                         empirical_dynamical_system defaults to auto
  --register-temperature <n>
                         teaching-style range; lower concentrates the strongest
                         style and part, higher mixes in more alternatives (default: ${STUB.registerTemperature};
                         range: ${MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE}-${MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE})
  --dag-fact-dropout <n> probability in [0,1] that previously understood
                         evidence is temporarily forgotten after a learner turn
                         (default: ${STUB.dagFactDropout}; off at 0)
  --dag-fact-dropout-seed <n>
                         non-negative deterministic seed for fact dropout
                         (default: ${STUB.dagFactDropoutSeed})
  --release-speed <n>    base clue-release speed: 1 follows the authored schedule,
                         lower slows it, higher releases clues sooner; explicit
                         learner pace requests adapt it further (default: ${STUB.releaseSpeed};
                         range: ${MIN_TUTOR_STUB_RELEASE_SPEED}-${MAX_TUTOR_STUB_RELEASE_SPEED})
  --run-seed <n>         non-negative master seed for policy draws (default: ${STUB.runSeed})
  --eval-repeat <n>      repetition identity used in policy draw keys (default: 1)
  --eval-job-id <id>     optional stable job identity used in policy draw keys
  --typed-actions        opt into Plan 2 typed pedagogical-action selection;
                         default off, with the decision persisted before output
  --typed-action-task-id <id>
                         stable task identity for typed actions
  --typed-action-knowledge-component <text>
                         knowledge component targeted by the task
  --typed-action-prerequisites <csv>
                         ordered prerequisite path for the task
  --typed-action-item-difficulty <0..1>
                         task difficulty supplied independently of move/support/register
  --typed-action-support-level <0..3>
                         optional fixed support level; blank uses the action default
  --world <id|path|none> detective-story world (default: ${STUB.world})
  --dag                  add hidden proof DAG + release schedule to tutor prompt;
                         also prints the tutor desire-DAG after each turn
  --dag-mode <strict_dag|human_scaffold|defeasible_human_scaffold>
                         label the proof-discourse mode for traces/reports.
                         Phase 1 records scaffold/debt/side-arc fields without
                         changing tutor behavior (default: ${STUB.dagMode})
  --list-worlds          list available detective-story worlds and exit
  --list-tutors          list named, partitioned tutor instances and exit
  --list-learner-profiles
                         list built-in automated learner profiles and exit
  --topic <text>         tutoring topic (default: ${STUB.topic})
  --learner <text>       learner sketch
  --goal <text>          tutor objective
  --style <text>         tutor style constraints
  --system <path>        replace generated system prompt with a file
  --once <text>          run one turn and exit
  --auto-learner         run unattended with an LLM learner
  --auto-learner-model <ref>
                         provider alias for the automated learner
                         (default: ${STUB.autoLearnerModel})
  --auto-learner-profile <id|text>
                         built-in profile id or custom learner behavior sketch
                         (default: diligent)
  --auto-turns <n|until-grounded>
                         maximum learner turns in --auto-learner mode, or
                         until-grounded to stop only at grounded closure
                         (default: ${STUB.autoTurns})
  --auto-safety-turns <n>
                         runaway guard used when --auto-turns until-grounded
                         (default: ${STUB.autoSafetyTurns})
  --no-auto-stop-on-grounded
                         keep running until --auto-turns even after the
                         learner-DAG reaches grounded asserted-secret closure
  --mixed-learner        manual interactive mode with a background learner clue
                         and suggested reply after each tutor response; the prompt,
                         /suggest, and /use show how it expresses the active profile;
                         use /clue, Tab, /suggest, /use, or /regen
  --mixed-mode           alias for --mixed-learner
  --save <path>          write transcript JSON on exit
  --trace-dir <path>     write JSONL model-call traces here
                         (default: ${STUB.traceDir})
  --settings-file <path> local remembered interactive settings
                         (default: ${STUB.settingsFile})
  --no-remember-settings
                         ignore and do not update the last interactive settings
  --no-trace             disable automatic local tracing
  --resume-last          resume the newest completed dialogue found in trace-dir
  --no-stream            disable token streaming for API-backed model calls
  --no-interim-animation disable the temporary state/field status animation
                         shown while model calls are waiting
  --no-memory-summary    disable compact state/field dialogue memory in prompts
  --field-viz            write/update lightweight field SVG + JSON artifacts
                         in trace-dir after each completed turn
  --multiple-choice      allow compact multiple-choice tutor prompts
                         (off by default)
  --no-opening           do not print the tutor's default opening prompt
  --opening-realizer <model|deterministic>
                         realize unauthored public openings with the speaking
                         tutor model (default) or the world-grounded fallback
  --no-closeout-report   do not print the compact dialogue closeout on exit
  --no-turn-feedback     do not ask for optional thumbs feedback after tutor
                         messages (on by default in human learner mode)
  --cli-effort <level>   effort for codex/claude-code CLI calls:
                         low, medium, high, xhigh, max, or config
                         (default: ${STUB.cliEffort})
  --temperature <n>      API temperature (default: ${STUB.temperature})
  --max-tokens <n>       response token cap for API providers (default: ${STUB.maxTokens})
  --history-turns <n>    raw recent turns kept in compact analysis prompts
                         (speaker calls replay full role history; default: ${STUB.historyTurns})
  --show-prompt          print the system prompt before starting
  --dry-run              print resolved config and first payload, but do not call a model
  --help                 show this message

Interactive commands:
  /analysis              explain the learner reading and teaching approach plainly
  /analysis technical    show the full classifier, reasoning-map, field, and trace evidence
  /a                     alias for /analysis
  /field                 show a lightweight interaction-field trajectory
  /f                     alias for /field
  /viz                   write a lightweight field SVG + JSON now
  /v                     alias for /viz
  /clarify [phrase]      explain a complex or unclear term from tutor dialogue
  /explain [phrase]      alias for /clarify
  /c [phrase]            alias for /clarify
  /report                show the compact dialogue closeout report
  /r                     alias for /report
  /director              repeat all director notes issued so far
  /notes                 alias for /director
  Left/Right on an empty prompt
                         rate the latest tutor message down/up immediately
  /up, /down             rate the latest tutor message helpful or unhelpful
                         without sending a learner turn
  /feedback [up|down] [reason] [comment]
                         inspect, set, clear, enable, or disable optional ratings
  /tune                  show the named tutor version and tuning status
  /tune on|off|reasons|review
                         capture typed feedback and inspect bounded candidates
  /tune approve|replay|validate|promote|rollback ...
                         test and explicitly promote or revert a tutor version
  /scenario              choose another scenario and start it as a new inquiry
  /scenario <id>         start a named scenario directly
  /settings              open the live keyboard settings panel (TTY)
  /settings model        choose a configured tutor model (TTY) or list models
  /settings model <ref>  change the speaking tutor model for subsequent turns
  /settings models       show every tutor/learner model role
  /settings models all <ref>
                         use one model for every role
  /settings models tutor|classifier|reasoning|learner <ref>
                         change one role independently
  /settings temp [n]     adjust or set teaching-style range
  /settings dropout [n]  adjust or set recoverable evidence-memory loss (0-1)
  /settings release-speed [n]
                         adjust or set clue-release speed (0.5-2)
  /settings forget       stop using the saved defaults after this session
  /id                    show and copy the current debug id and trace path
  /turn-id, /debug-id    aliases for /id (automatic ids require technical debug)
  /profile               show the active suggested-learner profile
  /profile list          list the six ordinary learner profiles
  /profile list stress   list eight specialist failure-mode profiles
  /profile list all      list the complete v3 profile registry
  /profile example       show a copyable custom-profile example
  /profile <id>          switch profile and regenerate mixed artifacts
  /profile default       restore the command-line/default profile
  /profile custom <text> use a custom learner behavior sketch
  /clue, /hint           show the ready non-revealing learner clue
  /suggest               show the ready response and its profile expression
  /use                   show the profile expression, then submit the response
  /regen                 regenerate clue, answer, analysis, and tutor response
  /reset                 cancel unfinished work and restart this scenario
  /clear                 alias for /reset
  /help                  show interactive commands
  /quit                  exit

Passthrough baseline:
  npm run tutor:stub:passthrough
                         starts without an opening or auxiliary model calls;
                         type the first learner message to begin pure chat

Prompt editing:
  Alt/Option+Left/Right or Ctrl+Left/Right
                         move by word
  Shift+Left/Right       select by character
  Alt/Option+Shift+Left/Right or Ctrl+Shift+Left/Right
                         select by word
  Shift+Home/End         select to the beginning/end of the line
  Type or press Backspace/Delete to replace/remove selected text

Environment:
  OPENAI_API_KEY         required for openai.*
  OPENROUTER_API_KEY     required for openrouter.*
  TUTOR_STUB_ALL_MODELS  optional one-model override for all four model roles
  TUTOR_STUB_MODEL       optional default model override
  TUTOR_STUB_CLASSIFIER_MODEL
                         optional default classifier model override
  TUTOR_STUB_LEARNER_RECORD_MODEL
                         optional default learner-record / combined-analysis model override
  TUTOR_STUB_TOPIC       optional default topic override
  TUTOR_STUB_WORLD       optional default detective-story world
  TUTOR_STUB_TURN_FEEDBACK=0
                         disable optional per-message thumbs feedback
  TUTOR_STUB_DAG_MODE    optional DAG discourse mode: strict_dag,
                         human_scaffold, or defeasible_human_scaffold
  TUTOR_STUB_TRACE_DIR   optional default trace directory
  TUTOR_STUB_SETTINGS_FILE
                         optional remembered-settings file path
  TUTOR_STUB_REMEMBER_SETTINGS=0
                         disable remembered interactive settings; =1 also
                         enables them for non-TTY harness tests
  TUTOR_STUB_STREAM=0    disable token streaming by default
  TUTOR_STUB_INTERIM_ANIMATION=0
                         disable interim state/field animation by default
  TUTOR_STUB_FIELD_VIZ=1 enable field visualization artifacts by default
  TUTOR_STUB_MULTIPLE_CHOICE=1
                         enable multiple-choice prompts by default
  TUTOR_STUB_OPENING=0   disable default tutor opening prompt
  TUTOR_STUB_OPENING_REALIZER
                         model (default) or deterministic
  TUTOR_STUB_CLIPBOARD=0 disable automatic clipboard copying for /id
  TUTOR_STUB_CLOSEOUT_REPORT=0
                         disable default closeout report
  TUTOR_STUB_SUMMARY_OPEN=0
                         still write the automatic learning summary on
                         conclusion, but do not launch it
  TUTOR_STUB_CLI_EFFORT  optional default CLI effort override
  TUTOR_STUB_REGISTER_POLICY
                         optional default register policy: dynamic, state,
                         field, trajectory, dynamical_system,
                         empirical_dynamical_system,
                         continuous_dynamical_system,
                         continuous_empirical_dynamical_system, bland, random,
                         or negative
  TUTOR_STUB_REGISTER_EMPIRICAL_PRIOR
                         optional JSON prior path for empirical register mapping
  TUTOR_STUB_REGISTER_TEMPERATURE
                         optional default register-selection temperature
  TUTOR_STUB_TYPED_ACTIONS=1
                         enable opt-in typed pedagogical-action selection
  TUTOR_STUB_TYPED_ACTION_TASK_ID
  TUTOR_STUB_TYPED_ACTION_KNOWLEDGE_COMPONENT
  TUTOR_STUB_TYPED_ACTION_PREREQUISITES
  TUTOR_STUB_TYPED_ACTION_ITEM_DIFFICULTY
  TUTOR_STUB_TYPED_ACTION_SUPPORT_LEVEL
                         optional typed-action task/support defaults
  TUTOR_STUB_AUTO_LEARNER_MODEL
                         optional default automated learner model
  TUTOR_STUB_AUTO_TURNS  optional default automated learner turn cap
  TUTOR_STUB_AUTO_SAFETY_TURNS
                         optional runaway guard for until-grounded mode
  TUTOR_STUB_AUTO_LEARNER_PROFILE
                         optional built-in id or custom automated learner profile
  TUTOR_STUB_MIXED_LEARNER=1
                         enable mixed manual/autocomplete learner mode
`);
}

function parseNumber(value, name, { min = -Infinity, max = Infinity } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be a number between ${min} and ${max}`);
  }
  return parsed;
}

function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseOptionalBoundedInt(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function commaSeparatedStrings(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function assertSupportedModelRefs(refs) {
  for (const [label, ref] of Object.entries(refs)) {
    const normalized = String(ref || '')
      .trim()
      .toLowerCase();
    if (UNSUPPORTED_CODEX_MINI_REFS.has(normalized)) {
      throw new Error(
        `${label}=${ref} is not supported by the local Codex CLI ChatGPT-account route. ` +
          'Use codex.gpt-5.6-terra for the CLI-backed speaking tutor, codex.gpt-5.6-sol for interpretation, or openai.mini/openrouter.gpt-mini for GPT mini.',
      );
    }
  }
}

const PREFERRED_TUTOR_MODEL_REFS = [
  'codex.gpt-5.6-terra',
  'codex.gpt-5.6-sol',
  'codex.gpt-5.6-luna',
  'codex.gpt-5.5',
  'claude-code.sonnet',
  'claude-code.fable',
  'claude-code.opus',
  'claude-code.haiku',
];

function tutorModelChoiceEntries(currentRef = STUB.model) {
  const providers = loadProviders()?.providers || {};
  const entries = [];
  for (const [provider, config] of Object.entries(providers)) {
    let providerConfig;
    try {
      providerConfig = getProviderConfig(provider);
    } catch {
      continue;
    }
    if (!providerConfig.isConfigured && !String(currentRef).startsWith(`${provider}.`)) continue;
    for (const [alias, model] of Object.entries(config.models || {})) {
      const ref = `${provider}.${alias}`;
      if (UNSUPPORTED_CODEX_MINI_REFS.has(ref.toLowerCase())) continue;
      const access = isCliProvider(provider)
        ? 'CLI login'
        : config.api_key_env
          ? `${config.api_key_env} configured`
          : 'local endpoint';
      entries.push({ ref, provider, alias, model, access, current: ref === currentRef });
    }
  }
  if (!entries.some((entry) => entry.ref === currentRef)) {
    try {
      const resolved = resolveModel(currentRef);
      entries.push({
        ref: currentRef,
        provider: resolved.provider,
        alias: currentRef.slice(currentRef.indexOf('.') + 1),
        model: resolved.model,
        access: 'current launch model',
        current: true,
      });
    } catch {
      // The normal launch validation reports an invalid current model.
    }
  }
  const preferredIndex = new Map(PREFERRED_TUTOR_MODEL_REFS.map((ref, index) => [ref, index]));
  return entries.sort((left, right) => {
    if (left.current !== right.current) return left.current ? -1 : 1;
    const leftPreferred = preferredIndex.has(left.ref) ? preferredIndex.get(left.ref) : Number.MAX_SAFE_INTEGER;
    const rightPreferred = preferredIndex.has(right.ref) ? preferredIndex.get(right.ref) : Number.MAX_SAFE_INTEGER;
    return (
      leftPreferred - rightPreferred ||
      left.provider.localeCompare(right.provider) ||
      left.alias.localeCompare(right.alias)
    );
  });
}

function resolveTutorModelSelection(ref) {
  const modelRef = String(ref || '').trim();
  assertSupportedModelRefs({ model: modelRef });
  const resolved = resolveModel(modelRef);
  const providerConfig = getProviderConfig(resolved.provider);
  if (!providerConfig.isConfigured) {
    const requirement = providerConfig.api_key_env || providerConfig.base_url || 'provider configuration';
    throw new Error(`${modelRef} is unavailable; configure ${requirement} first`);
  }
  return { modelRef, resolved, providerConfig };
}

function parseAutoTurns(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (['0', 'none', 'unbounded', 'until-grounded', 'grounded'].includes(raw)) return null;
  return parsePositiveInt(value, '--auto-turns');
}

function resolveWorkspacePath(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function commandLineOptionProvided(name) {
  const flag = `--${name}`;
  return process.argv.slice(2).some((argument) => argument === flag || argument.startsWith(`${flag}=`));
}

function rememberedSettingExplicitSources() {
  const allModels = commandLineOptionProvided('all-models') || Boolean(process.env.TUTOR_STUB_ALL_MODELS);
  return {
    tutorInstance: commandLineOptionProvided('tutor') || Boolean(process.env.TUTOR_STUB_TUTOR),
    tuningMode: commandLineOptionProvided('tuning') || Boolean(process.env.TUTOR_STUB_TUNING),
    scenario: commandLineOptionProvided('world') || Boolean(process.env.TUTOR_STUB_WORLD),
    learnerProfile:
      commandLineOptionProvided('auto-learner-profile') || Boolean(process.env.TUTOR_STUB_AUTO_LEARNER_PROFILE),
    allModelsRef: allModels,
    tutorModelRef: allModels || commandLineOptionProvided('model') || Boolean(process.env.TUTOR_STUB_MODEL),
    classifierModelRef:
      allModels || commandLineOptionProvided('classifier-model') || Boolean(process.env.TUTOR_STUB_CLASSIFIER_MODEL),
    learnerRecordModelRef:
      allModels ||
      commandLineOptionProvided('learner-record-model') ||
      Boolean(process.env.TUTOR_STUB_LEARNER_RECORD_MODEL),
    autoLearnerModelRef:
      allModels || commandLineOptionProvided('auto-learner-model') || Boolean(process.env.TUTOR_STUB_AUTO_LEARNER_MODEL),
    engagementStanceTemperature:
      commandLineOptionProvided('register-temperature') || Boolean(process.env.TUTOR_STUB_REGISTER_TEMPERATURE),
    dagFactDropoutRate:
      commandLineOptionProvided('dag-fact-dropout') || Boolean(process.env.TUTOR_STUB_DAG_FACT_DROPOUT),
    releaseSpeed: commandLineOptionProvided('release-speed') || Boolean(process.env.TUTOR_STUB_RELEASE_SPEED),
    registerPolicy: commandLineOptionProvided('register-policy') || Boolean(process.env.TUTOR_STUB_REGISTER_POLICY),
    registerOverlayThreshold:
      commandLineOptionProvided('register-overlay-threshold') ||
      Boolean(process.env.TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD),
  };
}

function applyRememberedInteractiveDefaults({ interactiveSessionEnabled }) {
  const filePath = resolveWorkspacePath(args['settings-file']);
  const ttyDefault = Boolean(input.isTTY && output.isTTY);
  const nonTtyOptIn = process.env.TUTOR_STUB_REMEMBER_SETTINGS === '1';
  const enabled = Boolean(interactiveSessionEnabled && !args['no-remember-settings'] && (ttyDefault || nonTtyOptIn));
  const config = {
    enabled,
    writeEnabled: Boolean(enabled && !args['dry-run']),
    filePath,
    status: enabled ? 'missing' : 'disabled',
    loadedAt: null,
    savedAt: null,
    appliedFields: [],
    skippedExplicitFields: [],
    restoredAllModelsOverrideRef: null,
    warning: null,
  };
  if (!enabled) return config;

  const read = readTutorStubLastSettings(filePath);
  config.status = read.status;
  config.warning = read.error;
  if (read.status !== 'loaded') return config;
  config.loadedAt = read.settings.updatedAt;
  const saved = read.settings;
  const explicit = rememberedSettingExplicitSources();

  if (explicit.tutorInstance) {
    config.skippedExplicitFields.push('tutor_instance');
  } else if (saved.tutorInstanceRef) {
    args.tutor = saved.tutorInstanceRef;
    config.appliedFields.push('tutor_instance');
  }

  if (explicit.tuningMode) {
    config.skippedExplicitFields.push('tuning_mode');
  } else if (saved.tuningMode) {
    args.tuning = saved.tuningMode;
    config.appliedFields.push('tuning_mode');
  }

  if (explicit.scenario) {
    config.skippedExplicitFields.push('scenario');
  } else if (saved.scenarioId) {
    try {
      const savedWorld = resolveWorldRef(saved.scenarioId);
      args.world = savedWorld.filePath;
      config.appliedFields.push('scenario');
    } catch (error) {
      config.warning = `saved scenario ignored: ${error.message}`;
    }
  }

  if (explicit.learnerProfile) {
    config.skippedExplicitFields.push('learner_profile');
  } else if (saved.learnerProfileId || saved.learnerProfile) {
    if (saved.learnerProfileId && !learnerProfileIds().includes(saved.learnerProfileId)) {
      config.warning = [config.warning, `saved learner profile ignored: ${saved.learnerProfileId} is unavailable`]
        .filter(Boolean)
        .join('; ');
    } else {
      args['auto-learner-profile'] = saved.learnerProfileId || saved.learnerProfile;
      config.appliedFields.push('learner_profile');
    }
  }

  if (explicit.tutorModelRef) {
    config.skippedExplicitFields.push('tutor_model');
  } else {
    try {
      resolveTutorModelSelection(saved.tutorModelRef);
      args.model = saved.tutorModelRef;
      config.appliedFields.push('tutor_model');
    } catch (error) {
      config.warning = `saved tutor model ignored: ${error.message}`;
    }
  }

  const rememberedModelRoles = [
    {
      explicit: explicit.classifierModelRef,
      field: 'classifierModelRef',
      arg: 'classifier-model',
      applied: 'learner_interpretation_model',
    },
    {
      explicit: explicit.learnerRecordModelRef,
      field: 'learnerRecordModelRef',
      arg: 'learner-record-model',
      applied: 'learner_reasoning_model',
    },
    {
      explicit: explicit.autoLearnerModelRef,
      field: 'autoLearnerModelRef',
      arg: 'auto-learner-model',
      applied: 'learner_voice_model',
    },
  ];
  for (const role of rememberedModelRoles) {
    if (role.explicit) {
      config.skippedExplicitFields.push(role.applied);
      continue;
    }
    const savedRef = saved[role.field];
    if (!savedRef) continue;
    try {
      resolveTutorModelSelection(savedRef);
      args[role.arg] = savedRef;
      config.appliedFields.push(role.applied);
    } catch (error) {
      config.warning = [config.warning, `saved ${plainSettingName(role.applied)} ignored: ${error.message}`]
        .filter(Boolean)
        .join('; ');
    }
  }
  if (!explicit.allModelsRef && saved.allModelsOverrideRef) {
    const refs = [
      saved.tutorModelRef,
      saved.classifierModelRef,
      saved.learnerRecordModelRef,
      saved.autoLearnerModelRef,
    ];
    if (refs.every((ref) => ref === saved.allModelsOverrideRef)) {
      config.restoredAllModelsOverrideRef = saved.allModelsOverrideRef;
    }
  }

  if (explicit.engagementStanceTemperature) {
    config.skippedExplicitFields.push('engagement_stance_temperature');
  } else {
    args['register-temperature'] = String(saved.engagementStanceTemperature);
    config.appliedFields.push('engagement_stance_temperature');
  }

  if (explicit.dagFactDropoutRate) {
    config.skippedExplicitFields.push('dag_fact_dropout');
  } else {
    args['dag-fact-dropout'] = String(saved.dagFactDropoutRate);
    config.appliedFields.push('dag_fact_dropout');
  }

  if (explicit.releaseSpeed) {
    config.skippedExplicitFields.push('clue_release_speed');
  } else {
    args['release-speed'] = String(saved.releaseSpeed);
    config.appliedFields.push('clue_release_speed');
  }

  try {
    const savedPolicyStack = tutorStubRememberedPolicyStack(saved);
    parseTutorStubRegisterPolicyStack(savedPolicyStack);
    if (!explicit.registerPolicy) {
      args['register-policy'] = savedPolicyStack;
      config.appliedFields.push('register_policy', 'register_overlays');
    } else {
      const requested = parseTutorStubRegisterPolicyStack(args['register-policy']);
      if (
        requested.primary === saved.registerPolicy &&
        requested.overlays.length === 0 &&
        saved.registerOverlays.length
      ) {
        args['register-policy'] = savedPolicyStack;
        config.appliedFields.push('register_overlays');
        config.skippedExplicitFields.push('register_policy');
      } else {
        config.skippedExplicitFields.push('register_policy', 'register_overlays');
      }
    }
  } catch (error) {
    config.warning = [config.warning, `saved register policy ignored: ${error.message}`].filter(Boolean).join('; ');
  }

  if (explicit.registerOverlayThreshold) {
    config.skippedExplicitFields.push('register_overlay_threshold');
  } else {
    args['register-overlay-threshold'] = String(saved.registerOverlayThreshold);
    config.appliedFields.push('register_overlay_threshold');
  }
  return config;
}

function defaultRegisterEmpiricalPriorPath() {
  return path.join(ROOT, '.tutor-stub-auto-eval/register-empirical-priors.json');
}

function resolveRegisterEmpiricalPriorPath(value, { policy }) {
  const raw = String(value || '').trim();
  if (/^(off|none|false|0)$/iu.test(raw)) return null;
  if (raw && raw !== 'auto') return resolveWorkspacePath(raw);
  if (policy === 'empirical_dynamical_system' || policy === 'continuous_empirical_dynamical_system' || raw === 'auto') {
    return defaultRegisterEmpiricalPriorPath();
  }
  return null;
}

function loadRegisterEmpiricalPrior(value, { policy }) {
  const filePath = resolveRegisterEmpiricalPriorPath(value, { policy });
  if (!filePath) return { prior: null, filePath: null, status: 'off' };
  if (!fs.existsSync(filePath)) return { prior: null, filePath, status: 'missing' };
  const prior = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!/register-empirical-priors\.v[12]$/u.test(String(prior.schema || ''))) {
    throw new Error(`Invalid register empirical prior schema in ${filePath}: ${prior.schema || 'missing'}`);
  }
  const status = prior.schema.endsWith('.v1')
    ? 'loaded_legacy_requires_rebuild'
    : prior.deployment?.objectiveRegisterPriorEligible === false
      ? 'loaded_holdout_not_passed'
      : 'loaded';
  return { prior, filePath, status };
}

function safeTimestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function formatTurnDebugId(runId, turn) {
  const turnNumber = Number.parseInt(turn, 10);
  const normalizedRunId = String(runId || 'no-trace').trim() || 'no-trace';
  if (!Number.isFinite(turnNumber) || turnNumber < 1) return normalizedRunId;
  return `${normalizedRunId}:t${String(turnNumber).padStart(3, '0')}`;
}

function openingDebugId(runId) {
  return `${String(runId || 'no-trace').trim() || 'no-trace'}:opening`;
}

function factText(fact) {
  if (!Array.isArray(fact) || fact.length === 0) return String(fact || '');
  const [rel, ...args] = fact;
  return `${rel}(${args.join(', ')})`;
}

function splitSymbolWords(value) {
  return String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function textTokens(text) {
  return new Set(splitSymbolWords(text));
}

function tokenRegex(token) {
  return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'iu');
}

function textContainsToken(text, token) {
  return tokenRegex(token).test(String(text || ''));
}

function factMatches(a, b) {
  return factKey(a) === factKey(b);
}

function candidatePublicPremiseIds({ state = null, world = null, tutorTurn = null } = {}) {
  if (!world) return new Set();
  if (state?.releasePacing) {
    return new Set([
      ...committedReleaseRows(state, tutorTurn).map((row) => row.premise),
      ...currentReleaseRows(state, tutorTurn).map((row) => row.premise),
    ]);
  }
  return new Set(
    world.releaseSchedule.filter((entry) => Number(entry.turn) <= Number(tutorTurn)).map((entry) => entry.premise),
  );
}

function publicFactsAtTurn(world, tutorTurn, state = null) {
  if (!world) return [];
  const available = candidatePublicPremiseIds({ state, world, tutorTurn });
  const released = [...available]
    .map((premiseId) => world.premiseById.get(premiseId)?.fact)
    .filter(Boolean);
  return [...(world.background || []), ...released];
}

function entailedFactsAtTurn(world, tutorTurn, state = null) {
  return [...closure(publicFactsAtTurn(world, tutorTurn, state), world.rules || []).facts.values()];
}

function entailsFactAtTurn(world, tutorTurn, fact, state = null) {
  return entailedFactsAtTurn(world, tutorTurn, state).some((entailed) => factMatches(entailed, fact));
}

function answerTermForWorld(world) {
  const pattern = world?.questionPattern || [];
  const answerIndex = pattern.findIndex((part) => typeof part === 'string' && part.startsWith('?'));
  if (answerIndex < 0) return null;
  return world?.secret?.fact?.[answerIndex] || null;
}

function publicTextForTurn(world, tutorTurn, learnerText = '', state = null) {
  if (!world) return '';
  const available = candidatePublicPremiseIds({ state, world, tutorTurn });
  const releasedSurface = [...available]
    .map((premiseId) => world.premiseById.get(premiseId)?.surface || '')
    .join('\n');
  return [
    world.question,
    world.setting,
    world.openingFrame?.situation,
    world.openingFrame?.authoredText,
    world.learnerVoice,
    ...(world.rules || []).map((rule) => rule.gloss || ''),
    releasedSurface,
    learnerText,
  ].join('\n');
}

const PRIVATE_TOKEN_STOPWORDS = new Set([
  'about',
  'above',
  'after',
  'again',
  'alone',
  'answer',
  'assay',
  'because',
  'built',
  'before',
  'bench',
  'blank',
  'blanks',
  'came',
  'cast',
  'coin',
  'coins',
  'contrast',
  'counts',
  'could',
  'differs',
  'down',
  'every',
  'exactly',
  'evidence',
  'false',
  'finish',
  'finished',
  'hand',
  'lesson',
  'lessons',
  'line',
  'make',
  'measure',
  'measures',
  'mark',
  'name',
  'nothing',
  'only',
  'progress',
  'public',
  'record',
  'results',
  'rule',
  'says',
  'scored',
  'shilling',
  'shillings',
  'should',
  'shown',
  'single',
  'struck',
  'that',
  'their',
  'thing',
  'things',
  'them',
  'these',
  'this',
  'trial',
  'turn',
  'twice',
  'verdict',
  'warrant',
  'what',
  'when',
  'where',
  'which',
  'with',
  'would',
]);

function unreleasedPremiseLeakRows({ text, world, tutorTurn, learnerText, state = null }) {
  const available = candidatePublicPremiseIds({ state, world, tutorTurn });
  const publicTokens = textTokens(publicTextForTurn(world, tutorTurn, learnerText, state));
  const rows = [];
  for (const premise of world?.premises || []) {
    const release = world.releaseSchedule.find((entry) => entry.premise === premise.id);
    if (!release || available.has(premise.id)) continue;

    const factTokens = new Set(
      (premise.fact || [])
        .slice(1)
        .flatMap(splitSymbolWords)
        .filter((token) => token.length >= 4 && !PRIVATE_TOKEN_STOPWORDS.has(token) && !publicTokens.has(token)),
    );
    const surfaceTokens = new Set(
      splitSymbolWords(premise.surface).filter(
        (token) => token.length >= 5 && !PRIVATE_TOKEN_STOPWORDS.has(token) && !publicTokens.has(token),
      ),
    );
    const factMatches = [...factTokens].filter((token) => textContainsToken(text, token));
    const surfaceMatches = [...surfaceTokens].filter((token) => textContainsToken(text, token));
    const strongMatches = [...new Set([...factMatches, ...surfaceMatches])].sort();
    if (factMatches.length || surfaceMatches.length >= 2) {
      rows.push({
        premise: premise.id,
        scheduledTurn: release.turn,
        matches: strongMatches,
      });
    }
  }
  return rows;
}

function auditTutorResponseLeak({ text, world, tutorTurn, learnerText, state = null }) {
  if (!world) return { ok: true, leaks: [] };
  const leaks = [];
  const answerTerm = answerTermForWorld(world);
  const answerTokens = splitSymbolWords(answerTerm);
  const mentionsAnswer = answerTokens.some((token) => textContainsToken(text, token));
  const publicText = publicTextForTurn(world, tutorTurn, learnerText, state);
  const answerNamePublic = tutorStubAnswerNameIsPublic({ answerTerm, publicText });
  const finalEntailed = entailsFactAtTurn(world, tutorTurn, world.secret.fact, state);

  if (mentionsAnswer && !finalEntailed && !answerNamePublic) {
    leaks.push({
      type: 'concealed_answer_name',
      reason: `mentions ${answerTerm} before the public record entails the answer`,
      matches: answerTokens,
    });
  }

  if (mentionsAnswer) {
    const lower = String(text || '').toLowerCase();
    const intermediateChecks = [
      {
        fact: ['castBlankFor', world.questionPattern?.[1] || world.secret.fact?.[1], answerTerm],
        words: [/cast/u, /blank/u],
        label: 'private_blank_conclusion',
      },
      {
        fact: ['cutDieFor', world.questionPattern?.[1] || world.secret.fact?.[1], answerTerm],
        words: [/\bcut\b/u, /\bdie\b/u],
        label: 'private_die_conclusion',
      },
      {
        fact: world.secret.fact,
        words: [/\bstruck\b/u, /\bstrike\b/u, /\bcoiner\b/u, /\bcoined\b/u, /\bmade\b/u],
        label: 'private_final_conclusion',
      },
    ];
    const worldRulePredicates = new Set(
      (world.rules || []).flatMap((rule) => [...(rule.if || []), ...(rule.then || [])]).map((fact) => fact?.[0]),
    );
    for (const check of intermediateChecks) {
      // The intermediate-conclusion checks encode the assay worlds' law
      // (castBlankFor/cutDieFor/struckBy vocabulary). Apply them only where
      // the world's own rules carry those predicates; every other world is
      // covered by the generic concealed-answer + unreleased-premise audits.
      if (check.label === 'private_final_conclusion') {
        if (world.secret?.fact?.[0] !== 'struckBy') continue;
      } else if (!worldRulePredicates.has(check.fact[0])) {
        continue;
      }
      if (
        check.words.some((pattern) => pattern.test(lower)) &&
        !entailsFactAtTurn(world, tutorTurn, check.fact, state)
      ) {
        leaks.push({
          type: check.label,
          reason: `states a conclusion about ${answerTerm} before that conclusion is derivable from released evidence`,
          fact: factText(check.fact),
        });
      }
    }
  }

  for (const row of unreleasedPremiseLeakRows({ text, world, tutorTurn, learnerText, state })) {
    leaks.push({
      type: 'unreleased_premise_content',
      reason: `uses content from ${row.premise} before its scheduled release at turn ${row.scheduledTurn}`,
      premise: row.premise,
      matches: row.matches,
    });
  }

  return {
    ok: leaks.length === 0,
    leaks,
    finalEntailed,
    answerNamePublic,
  };
}

function tutorResponseRepairPrompt({
  originalUserPrompt,
  unsafeDraft,
  leakAudit = null,
  scaffoldAudit = null,
  questionSupportAudit = null,
  dramaticReleaseAudit = null,
  actorialRealizationAudit = null,
  responseConfiguration = null,
  responseCompositionAudit = null,
  preservedUptake = '',
  repetitionAudit = null,
  closureAudit = null,
  dialogueClosureFrame = null,
}) {
  const leakRows = (leakAudit?.leaks || [])
    .map((leak, index) => `${index + 1}. ${leak.type}: ${leak.reason}`)
    .join('\n');
  const scaffoldRows = (scaffoldAudit?.issues || [])
    .map((issue, index) => `${index + 1}. ${issue.type}: ${issue.reason}`)
    .join('\n');
  const questionSupportRows = (questionSupportAudit?.issues || [])
    .map((issue, index) => `${index + 1}. ${issue.type}: ${issue.reason}`)
    .join('\n');
  const dramaticReleaseRows = (dramaticReleaseAudit?.issues || [])
    .map((issue, index) => `${index + 1}. ${issue.type}: ${issue.reason}`)
    .join('\n');
  const actorialRealizationRows = (actorialRealizationAudit?.issues || [])
    .map((issue, index) => `${index + 1}. ${issue.type}: ${issue.reason}`)
    .join('\n');
  const responseCompositionRows = (responseCompositionAudit?.issues || [])
    .map((issue, index) => `${index + 1}. ${issue.type}: ${issue.reason}`)
    .join('\n');
  const repetitionRows = (repetitionAudit?.issues || [])
    .map((issue, index) => `${index + 1}. ${issue.type}: ${issue.reason}`)
    .join('\n');
  const closureRows = (closureAudit?.issues || [])
    .map((issue, index) => `${index + 1}. ${issue.type}: ${issue.reason}`)
    .join('\n');
  return [
    originalUserPrompt,
    '',
    '[Tutor-only repair instruction]',
    'Your previous draft failed a learner-facing safety or scaffold check and must not be shown to the learner.',
    preservedUptake
      ? 'The learner-responsive opening below passed its public-evidence check. Keep it verbatim at the start, then continue directly into the rewritten development without making a second paragraph or second voice.'
      : 'Rewrite the tutor reply from scratch.',
    preservedUptake ? `Safe learner uptake to preserve:\n${preservedUptake}` : null,
    leakRows ? 'Use only public setup, already released evidence, and public rules.' : null,
    leakRows
      ? 'Do not name the concealed answer, any hidden actor, any unreleased object, or any intermediate conclusion involving them.'
      : null,
    leakRows ? 'Do not use predicate/function notation, premise ids, rule ids, or route labels.' : null,
    leakRows
      ? 'Do not use compressed technical labels such as "sole-caster", "blank-route", or "die-route"; translate them into ordinary evidence language.'
      : null,
    scaffoldRows
      ? 'The learner already answered the immediately preceding local question through unambiguous context. Accept that answer as complete for the spoken exchange.'
      : null,
    scaffoldRows
      ? 'Do not ask the same question again in new words. Do not demand the omitted noun, a name, a warrant, a premise, or a public-record restatement for that same local step.'
      : null,
    scaffoldRows
      ? 'Acknowledge the completed move briefly and advance to a genuinely different public clue, contrast, implication, or learner choice.'
      : null,
    questionSupportRows
      ? 'The previous draft asked for information the learner could not know from the public discourse. Do not ask them to invent an unseen record, source, name, person, or fact.'
      : null,
    questionSupportRows
      ? 'Put the direction into the discourse first. If the active instruction calls for bounded choice, offer 2-3 short choices using only the people, objects, and records already named in this scene. Say concretely what each choice means here; avoid labels such as “one condition,” “the rule,” or “the whole case.” Do not reveal the unstaged record or answer.'
      : null,
    dramaticReleaseRows
      ? 'The previous draft made a newly available clue feel like invisible machinery. Rewrite the release as dramatic action flowing inside the same continuous utterance.'
      : null,
    dramaticReleaseRows
      ? 'Let the clue enter through a character, object, gesture, interruption, or spoken line; enact the supplied source role or physically handle the exhibit; then ask what it changes without stepping outside the scene.'
      : null,
    dramaticReleaseRows
      ? 'Stay inside the scene. Never say “let’s role-play,” “I’ll be,” “I’ll take the part,” “speaking as,” “back to us,” or announce that another piece of information is being supplied. Do not mention a director, release schedule, turn, prompt, harness, DAG, premise id, or evidence that has not been supplied for this turn.'
      : null,
    actorialRealizationRows
      ? `The previous draft did not visibly perform the selected public part (${responseConfiguration?.actorial_part_label || responseConfiguration?.actorial_part || 'current scene part'}) with its selected tactic (${responseConfiguration?.actorial_performance?.label || 'direct in-scene performance'}). Rewrite the development beat so both are unmistakable in the action and wording.`
      : null,
    actorialRealizationRows && responseConfiguration?.actorial_performance?.contract
      ? `Performance contract: ${responseConfiguration.actorial_performance.contract}`
      : null,
    actorialRealizationRows
      ? 'Do not name the character as a speaker label or write a stage direction. Speak from inside the role in first person, and make the stance change what that voice emphasizes and asks.'
      : null,
    responseCompositionRows
      ? 'The response must take up what the learner just said and then develop the inquiry without replacing acknowledgement with the next clue or question.'
      : null,
    responseCompositionRows
      ? 'Write one continuous paragraph in one voice. Do not insert a blank line, arrow, role label, stage direction, or mention private analysis.'
      : null,
    repetitionRows
      ? 'The previous draft repeated a recent tutor reply. Use the current concrete clue, add a genuinely new distinction, and do not restate the same question in different words.'
      : null,
    closureRows
      ? 'The response reached or stated the final verdict but failed to end the dialogue cleanly. Rewrite it as a natural closing act.'
      : null,
    closureRows
      ? 'Explicitly say that the case, book, or inquiry is closed. Do not reopen the proof or ask another evidentiary question.'
      : null,
    closureRows && dialogueClosureFrame?.allowCheckIn
      ? 'You may ask exactly one optional final check-in about whether a link should be revisited; ask no other question.'
      : null,
    closureRows && !dialogueClosureFrame?.allowCheckIn
      ? 'Do not ask any question. This is the terminal tutor turn.'
      : null,
    '',
    leakRows ? 'Leak audit:' : null,
    leakRows || null,
    scaffoldRows ? 'Human-scaffold audit:' : null,
    scaffoldRows || null,
    questionSupportRows ? 'Question-support audit:' : null,
    questionSupportRows || null,
    dramaticReleaseRows ? 'Dramatic-release audit:' : null,
    dramaticReleaseRows || null,
    actorialRealizationRows ? 'Actorial-realization audit:' : null,
    actorialRealizationRows || null,
    responseCompositionRows ? 'Response-composition audit:' : null,
    responseCompositionRows || null,
    repetitionRows ? 'Repetition audit:' : null,
    repetitionRows || null,
    closureRows ? 'Dialogue-closure audit:' : null,
    closureRows || null,
    '',
    'Unsafe draft to replace:',
    unsafeDraft,
    '[End tutor-only repair instruction]',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

// Authorial presentation (world.presentation): scenario ecology and
// narrative diction are the AUTHOR's costume for the world — deliberately
// not register (which controls speech) or engagement stance (the
// speaker-hearer relation). Defaults preserve the legacy assay costume
// exactly, so frozen worlds keep their learner-visible conditions.
function worldPresentation(world) {
  return (world && world.presentation) || {};
}

function worldLedgerTerm(world) {
  return String(worldPresentation(world).ledger_term || 'evidence record');
}

function worldFlavourPhrase(world) {
  const diction = worldPresentation(world).narrative_diction;
  return diction ? `${diction} flavour` : "world's authored diction";
}

function worldFamilyKey(world) {
  const p = worldPresentation(world);
  return String(p.family || p.variant_of || world.id);
}

function worldPickerSummary(world) {
  const p = worldPresentation(world);
  if (p.summary) return String(p.summary);
  const setting = String(world.setting || '')
    .trim()
    .replace(/\s+/gu, ' ');
  return setting.split(/(?<=\.)\s/u)[0] || world.question;
}

// One entry per presentation family, base world first, controlled variants
// indented after it — ten near-identical costumes stop reading as ten
// independent scenarios (presentation metadata, not register).
function groupedWorldEntries() {
  const families = new Map();
  for (const entry of selectableWorldSummaries()) {
    const key = worldFamilyKey(entry.world);
    if (!families.has(key)) families.set(key, []);
    families.get(key).push(entry);
  }
  const ordered = [];
  for (const members of families.values()) {
    const base = members.find((member) => !worldPresentation(member.world).variant_of) || members[0];
    ordered.push({ ...base, isVariant: false, familySize: members.length });
    for (const member of members) {
      if (member !== base) ordered.push({ ...member, isVariant: true, familySize: members.length });
    }
  }
  return ordered;
}

function deterministicGenerousInferenceFallback({ dueEvidence = [], latestEvidence = null, world = null } = {}) {
  const next = (Array.isArray(dueEvidence) ? dueEvidence : []).find((row) => row?.surface) || null;
  if (next) {
    return [
      'Yes—that answers the last point, so we can move on.',
      `The next concrete clue is: ${oneLine(next.surface, { max: 260 })}`,
      'What does this new clue add on its own?',
    ].join(' ');
  }
  if (latestEvidence?.surface) {
    return [
      'Yes—that answers the last point, so we can carry it forward.',
      `Keep the last concrete clue in view: ${oneLine(latestEvidence.surface, { max: 260 })}`,
      'We can leave the wider conclusion open until another clue enters the conversation.',
    ].join(' ');
  }
  return `Yes—that answers the last point. We can now return to the case question: ${oneLine(world?.question || '', { max: 240 })}`;
}

function tutorGuardIssueRows(audits) {
  return [
    ...(audits?.leakAudit?.leaks || []).map((issue) => ({ guard: 'leak', ...issue })),
    ...(audits?.scaffoldAudit?.issues || []).map((issue) => ({ guard: 'human_scaffold', ...issue })),
    ...(audits?.questionSupportAudit?.issues || []).map((issue) => ({ guard: 'question_support', ...issue })),
    ...(audits?.dramaticReleaseAudit?.issues || []).map((issue) => ({ guard: 'dramatic_release', ...issue })),
    ...(audits?.actorialRealizationAudit?.issues || []).map((issue) => ({
      guard: 'actorial_realization',
      ...issue,
    })),
    ...(audits?.responseCompositionAudit?.issues || []).map((issue) => ({
      guard: 'response_composition',
      ...issue,
    })),
    ...(audits?.repetitionAudit?.issues || []).map((issue) => ({ guard: 'repetition', ...issue })),
    ...(audits?.closureAudit?.issues || []).map((issue) => ({ guard: 'dialogue_closure', ...issue })),
  ];
}

function literalTutorGuardSpans(text, needle, issue) {
  const source = String(text || '');
  const target = String(needle || '').trim();
  if (!target) return [];
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const pattern = new RegExp(escaped, 'giu');
  return [...source.matchAll(pattern)].map((match) => ({
    guard: issue.guard,
    issueType: issue.type || 'unknown',
    reason: issue.reason || null,
    start: match.index,
    end: match.index + match[0].length,
    text: match[0],
    offsetEncoding: 'utf16_code_units',
    basis: 'literal_audit_match',
  }));
}

function tutorQuestionSpans(text, issue) {
  const source = String(text || '');
  const rows = [];
  for (const match of source.matchAll(/[^.!?]*\?/gu)) {
    const raw = match[0];
    const leading = raw.length - raw.trimStart().length;
    const surface = raw.trimStart();
    rows.push({
      guard: issue.guard,
      issueType: issue.type || 'unknown',
      reason: issue.reason || null,
      start: match.index + leading,
      end: match.index + raw.length,
      text: surface,
      offsetEncoding: 'utf16_code_units',
      basis: 'question_audit_match',
    });
  }
  return rows;
}

function tutorGuardedSpans(text, audits) {
  const source = String(text || '');
  const spans = [];
  for (const issue of tutorGuardIssueRows(audits)) {
    const needles = [...(issue.matches || []), issue.responseQuestion].filter(Boolean);
    let issueSpans = needles.flatMap((needle) => literalTutorGuardSpans(source, needle, issue));
    if (
      !issueSpans.length &&
      issue.guard === 'dialogue_closure' &&
      ['closure_response_opens_another_turn', 'multiple_closure_questions', 'closure_reopens_proof_work'].includes(
        issue.type,
      )
    ) {
      issueSpans = tutorQuestionSpans(source, issue);
    }
    if (!issueSpans.length && issue.type === 'missing_explicit_dialogue_close') {
      issueSpans = [
        {
          guard: issue.guard,
          issueType: issue.type,
          reason: issue.reason || null,
          start: source.length,
          end: source.length,
          text: '',
          offsetEncoding: 'utf16_code_units',
          basis: 'required_insertion_at_end',
        },
      ];
    }
    if (!issueSpans.length) {
      issueSpans = [
        {
          guard: issue.guard,
          issueType: issue.type || 'unknown',
          reason: issue.reason || null,
          start: 0,
          end: source.length,
          text: source,
          offsetEncoding: 'utf16_code_units',
          basis: 'whole_candidate_audit_scope',
        },
      ];
    }
    spans.push(...issueSpans);
  }
  const unique = new Map();
  for (const span of spans) {
    const key = [span.guard, span.issueType, span.start, span.end, span.text].join('\u0000');
    if (!unique.has(key)) unique.set(key, span);
  }
  return [...unique.values()].sort(
    (left, right) => left.start - right.start || left.end - right.end || left.guard.localeCompare(right.guard),
  );
}

function exactTutorRepairSpans(originalText, repairedText) {
  const original = String(originalText || '');
  const repaired = String(repairedText || '');
  if (original === repaired) return [];
  let prefix = 0;
  while (prefix < original.length && prefix < repaired.length && original[prefix] === repaired[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < original.length - prefix &&
    suffix < repaired.length - prefix &&
    original[original.length - 1 - suffix] === repaired[repaired.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  return [
    {
      offsetEncoding: 'utf16_code_units',
      original: {
        start: prefix,
        end: original.length - suffix,
        text: original.slice(prefix, original.length - suffix),
      },
      repaired: {
        start: prefix,
        end: repaired.length - suffix,
        text: repaired.slice(prefix, repaired.length - suffix),
      },
    },
  ];
}

function tutorGuardAttemptEnvelope({ kind, attempt, response, audits = null, repairedSpans = [] }) {
  const text = String(response?.text || '');
  return {
    kind,
    attempt,
    provider: response?.provider || null,
    model: response?.model || null,
    candidate: {
      start: 0,
      end: text.length,
      text,
      offsetEncoding: 'utf16_code_units',
    },
    audits,
    guardedSpans: audits ? tutorGuardedSpans(text, audits) : [],
    repairedSpans,
  };
}

function attachTutorGuardAccounting({
  response,
  state,
  trace,
  tutorTurn,
  role = 'tutor_stub_tutor',
  guards,
  attempts,
  repairsApplied,
  finalSource,
  finalAudits = null,
  outcome,
}) {
  const finalText = String(response?.text || '');
  const accounting = jsonClone({
    schema: TUTOR_GUARD_ACCOUNTING_SCHEMA,
    turn: tutorTurn,
    policy: state?.experiment?.policy || state?.register?.policy || null,
    profile: state?.experiment?.profile || null,
    guards,
    outcome,
    originalCandidate: attempts[0] || null,
    attempts,
    repairsApplied,
    finalDelivery: {
      source: finalSource,
      provider: response?.provider || null,
      model: response?.model || null,
      deterministicFallback: Boolean(response?.deterministicFallback),
      deterministicClosure: Boolean(response?.deterministicClosure),
      candidate: {
        start: 0,
        end: finalText.length,
        text: finalText,
        offsetEncoding: 'utf16_code_units',
      },
      audits: finalAudits,
      auditOk: finalAudits?.ok ?? null,
    },
  });
  response.guardAccounting = accounting;
  appendTraceEvent(trace, {
    type: 'tutor_response_guard_accounting',
    role,
    turn: tutorTurn,
    accounting,
  });
  return response;
}

async function buildTutorOpening(state, { signal = null } = {}) {
  const world = state.world;
  if (!world) {
    const text = [
      `Let's start ${state.topic ? `with ${state.topic}` : 'there'}.`,
      'Say your first idea, or name the one point you want to test first.',
    ].join(' ');
    return {
      text,
      source: 'deterministic_topic_fallback',
      frame: buildTutorStubOpeningFrame(),
      audit: null,
      model: null,
    };
  }

  const frame = buildTutorStubOpeningFrame({
    world,
    openingEvidence: currentReleaseRows(state, 1),
  });
  const openingSystemPrompt = tutorStubOpeningSystemPrompt();
  const openingUserPrompt = tutorStubOpeningPrompt(frame);
  const speakerPrivilegeAudit = auditTutorStubSpeakerPrivilege({
    world,
    tutorTurn: 1,
    systemPrompt: openingSystemPrompt,
    privateAdvisory: openingUserPrompt,
  });
  appendTraceEvent(state.trace, {
    type: 'tutor_opening_speaker_privilege_audit',
    turn: 0,
    audit: speakerPrivilegeAudit,
  });
  if (!speakerPrivilegeAudit.ok) {
    throw new Error(
      `Tutor opening frame crossed the private-planner boundary: ${speakerPrivilegeAudit.issues
        .map((issue) => `${issue.code}:${issue.source}`)
        .join(', ')}`,
    );
  }
  const authoredText = String(frame.authoredText || '').trim();
  let candidate = authoredText;
  let source = authoredText ? 'authored_world_opening' : 'speaking_tutor_model';
  let modelResponse = null;
  let generationError = null;

  if (!candidate && state.openingRealizer === 'deterministic') {
    candidate = deterministicTutorStubOpening(frame);
    source = 'world_grounded_deterministic';
  }

  if (!candidate) {
    startInterimAnimation(state, 'opening the scene', { tutorTurn: 0 });
    try {
      modelResponse = await callPromptModel({
        prompt: openingUserPrompt,
        resolved: state.resolved,
        systemPrompt: openingSystemPrompt,
        role: 'tutor_stub_opening',
        maxTokens: Math.min(700, state.maxTokens || 700),
        trace: state.trace,
        stream: { enabled: false, interim: state.interim },
        cliEffort: state.cliEffort,
        turn: 0,
        signal,
      });
      candidate = cleanTutorStubStageSpeech(modelResponse.text);
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      generationError = error.message;
      appendTraceEvent(state.trace, {
        type: 'tutor_opening_realization_error',
        turn: 0,
        provider: state.resolved.provider,
        model: state.resolved.model,
        error: error.message,
      });
    } finally {
      stopInterimAnimation(state);
    }
  }

  const leakAudit = auditTutorResponseLeak({
    text: candidate,
    world,
    tutorTurn: 1,
    learnerText: '',
    state,
  });
  let audit = auditTutorStubOpening({ text: candidate, frame, leakAudit });
  if (!audit.ok) {
    const rejectedSource = source;
    candidate = deterministicTutorStubOpening(frame);
    source = 'world_grounded_safe_fallback';
    const fallbackLeakAudit = auditTutorResponseLeak({
      text: candidate,
      world,
      tutorTurn: 1,
      learnerText: '',
      state,
    });
    const fallbackAudit = auditTutorStubOpening({ text: candidate, frame, leakAudit: fallbackLeakAudit });
    appendTraceEvent(state.trace, {
      type: 'tutor_opening_candidate_rejected',
      turn: 0,
      source: rejectedSource,
      audit,
      fallbackAudit,
    });
    audit = fallbackAudit;
    if (!audit.ok) {
      throw new Error(
        `Tutor opening failed its public-safe requirements: ${audit.issues.map((issue) => issue.type).join(', ')}`,
      );
    }
  }

  const realization = {
    schema: 'machinespirits.tutor-stub.opening-realization.v1',
    source,
    frame,
    requirements: TUTOR_STUB_OPENING_REQUIREMENTS,
    audit,
    speakerPrivilegeAudit,
    generationError,
    model: modelResponse
      ? {
          provider: modelResponse.provider,
          model: modelResponse.model,
          latencyMs: modelResponse.latencyMs,
          usage: modelResponse.usage,
          effort: modelResponse.effort || modelResponse.reasoningEffort || null,
        }
      : null,
  };
  appendTraceEvent(state.trace, {
    type: 'tutor_opening_realization',
    turn: 0,
    realization,
  });
  return {
    ...realization,
    text: candidate,
    promptSnapshot: modelResponse?.promptSnapshot || null,
  };
}

function ruleText(rule, index) {
  const left = (rule.if || []).map(factText).join(' + ');
  const right = (rule.then || []).map(factText).join(' + ');
  return `${index + 1}. ${rule.id}: ${left} -> ${right}\n   ${String(rule.gloss || '').trim()}`;
}

function worldFiles() {
  return fs
    .readdirSync(WORLD_DIR)
    .filter((file) => /^world-.*\.yaml$/.test(file))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => path.join(WORLD_DIR, file));
}

function loadWorldSummaries() {
  return worldFiles().map((filePath) => {
    const world = loadWorld(filePath);
    return { filePath, world };
  });
}

function selectableWorldSummaries() {
  return loadWorldSummaries().filter(({ world }) => world.eligibility?.status === 'production');
}

function printWorlds() {
  for (const { filePath, world, isVariant, familySize } of groupedWorldEntries()) {
    if (isVariant) {
      console.log(`  ↳ ${world.id.padEnd(34)} ${world.title}`);
      continue;
    }
    const p = worldPresentation(world);
    const tags = [p.temporal_frame, p.narrative_diction].filter(Boolean).join(', ');
    const familyNote = familySize > 1 ? ` — family of ${familySize}` : '';
    console.log(`${world.id.padEnd(38)} ${world.title}${tags ? ` [${tags}]` : ''}${familyNote}`);
    console.log(`  ${path.relative(ROOT, filePath)}`);
    console.log(`  ${worldPickerSummary(world)}`);
  }
}

function printAutomatedLearnerProfiles() {
  console.log(learnerProfileListText());
}

function resolveWorldRef(ref) {
  if (!ref || ref === 'none' || ref === 'off' || ref === 'false') return null;

  const directPath = path.resolve(ROOT, ref);
  if (fs.existsSync(directPath)) {
    return { filePath: directPath, world: loadWorld(directPath) };
  }

  const byFileName = path.join(WORLD_DIR, ref.endsWith('.yaml') ? ref : `${ref}.yaml`);
  if (fs.existsSync(byFileName)) {
    return { filePath: byFileName, world: loadWorld(byFileName) };
  }

  const needle = ref.toLowerCase();
  const matches = loadWorldSummaries().filter(({ filePath, world }) => {
    const stem = path.basename(filePath, '.yaml').toLowerCase();
    return (
      world.id.toLowerCase() === needle ||
      stem === needle ||
      stem.startsWith(`world-${needle}-`) ||
      stem.endsWith(`-${needle}`) ||
      world.title.toLowerCase().includes(needle)
    );
  });
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(`Ambiguous --world "${ref}". Matches: ${matches.map((m) => m.world.id).join(', ')}`);
  }
  throw new Error(`Unknown --world "${ref}". Use --list-worlds to see available IDs.`);
}

async function pickInitialScenarioWithKeyboard(defaultWorldRef) {
  const defaultBundle = resolveWorldRef(defaultWorldRef);
  const entries = groupedWorldEntries().map(({ filePath, world, isVariant }) => ({
    id: world.id,
    title: `${isVariant ? '↳ ' : ''}${world.title}`,
    discipline: world.discipline || 'Authored reasoning drama',
    question: world.question,
    description: worldPickerSummary(world) || world.setting || world.learnerVoice || world.question,
    filePath,
    world,
  }));
  if (defaultBundle && !entries.some((entry) => entry.id === defaultBundle.world.id)) {
    entries.unshift({
      id: defaultBundle.world.id,
      title: defaultBundle.world.title,
      discipline: defaultBundle.world.discipline || 'Custom reasoning drama',
      question: defaultBundle.world.question,
      description: defaultBundle.world.setting || defaultBundle.world.learnerVoice || defaultBundle.world.question,
      filePath: defaultBundle.filePath,
      world: defaultBundle.world,
    });
  }
  if (!entries.length) return null;

  let selectedIndex = Math.max(
    0,
    entries.findIndex((entry) => entry.id === defaultBundle?.world?.id),
  );
  const viewportHeight = Math.min(entries.length, Math.max(4, Math.min(8, Math.max(4, Number(output.rows || 24) - 9))));
  let viewportStart = Math.max(0, Math.min(selectedIndex, entries.length - viewportHeight));
  let renderedLineCount = 0;

  const keepSelectionVisible = () => {
    if (selectedIndex < viewportStart) viewportStart = selectedIndex;
    if (selectedIndex >= viewportStart + viewportHeight) viewportStart = selectedIndex - viewportHeight + 1;
  };
  const clearRenderedMenu = () => {
    if (!renderedLineCount) return;
    moveCursor(output, 0, -renderedLineCount);
    for (let index = 0; index < renderedLineCount; index += 1) {
      cursorTo(output, 0);
      clearLine(output, 0);
      if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
    }
    if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
    renderedLineCount = 0;
  };
  const renderMenu = () => {
    keepSelectionVisible();
    clearRenderedMenu();
    const width = Math.max(58, Math.min(Number(output.columns || 100), 150));
    const visible = entries.slice(viewportStart, viewportStart + viewportHeight);
    const selectedEntry = entries[selectedIndex];
    const lines = [
      `${C.dim}${viewportStart > 0 ? `  ↑ ${viewportStart} more` : '  '}${C.reset}`,
      ...visible.map((entry, visibleIndex) => {
        const absoluteIndex = viewportStart + visibleIndex;
        const selected = absoluteIndex === selectedIndex;
        const plain = `${selected ? '›' : ' '} ${entry.id.padEnd(29)} ${oneLine(entry.title, {
          max: Math.max(18, width - 35),
        })}`;
        return selected ? `${C.cyan}${C.bold}${plain}${C.reset}` : plain;
      }),
      `${C.dim}${
        viewportStart + viewportHeight < entries.length
          ? `  ↓ ${entries.length - viewportStart - viewportHeight} more`
          : '  '
      }${C.reset}`,
      `${C.brightYellow}${C.bold}  question >${C.reset} ${oneLine(selectedEntry.question, {
        max: Math.max(36, width - 13),
      })}`,
      `${C.dim}  setting > ${oneLine(selectedEntry.description, { max: Math.max(36, width - 12) })}${C.reset}`,
      `${C.dim}  discipline > ${oneLine(selectedEntry.discipline, { max: Math.max(30, width - 15) })}${C.reset}`,
    ];
    for (const line of lines) output.write(`${line}\n`);
    renderedLineCount = lines.length;
  };

  emitKeypressEvents(input);
  const priorKeypressListeners = input.listeners('keypress');
  for (const listener of priorKeypressListeners) input.removeListener('keypress', listener);
  const wasRaw = Boolean(input.isRaw);
  if (!wasRaw) input.setRawMode(true);

  return new Promise((resolve) => {
    const finish = (selection) => {
      input.removeListener('keypress', onKeypress);
      for (const listener of priorKeypressListeners) input.on('keypress', listener);
      if (!wasRaw) input.setRawMode(false);
      clearRenderedMenu();
      resolve(selection);
    };
    const moveSelection = (delta) => {
      selectedIndex = (selectedIndex + delta + entries.length) % entries.length;
      renderMenu();
    };
    const onKeypress = (character, key = {}) => {
      if ((key.ctrl && key.name === 'c') || key.name === 'escape') {
        finish(null);
        return;
      }
      if (key.name === 'up' || character === 'k') {
        moveSelection(-1);
        return;
      }
      if (key.name === 'down' || character === 'j') {
        moveSelection(1);
        return;
      }
      if (key.name === 'pageup') {
        moveSelection(-viewportHeight);
        return;
      }
      if (key.name === 'pagedown') {
        moveSelection(viewportHeight);
        return;
      }
      if (key.name === 'home') {
        selectedIndex = 0;
        renderMenu();
        return;
      }
      if (key.name === 'end') {
        selectedIndex = entries.length - 1;
        renderMenu();
        return;
      }
      if (key.name === 'return' || key.name === 'enter') finish(entries[selectedIndex]);
    };
    input.on('keypress', onKeypress);
    input.resume();
    renderMenu();
  });
}

function worldPublicPrompt(world) {
  if (!world) return [];
  return [
    '',
    '# Detective-story world',
    '',
    `World: ${world.id} — ${world.title}`,
    world.discipline ? `Discipline: ${world.discipline}` : null,
    `Public question: ${world.question}`,
    '',
    'Opening situation visible to the learner:',
    String(world.setting || '').trim(),
    '',
    'Learner role:',
    String(world.learnerVoice || '').trim(),
    '',
    'Your task in story mode:',
    '- Play the tutor/investigator guiding the learner through the case.',
    '- Treat the learner as the investigator; do not solve the case for them.',
    '- Keep the public question alive and ask for grounded inferences from evidence.',
    '- Treat a concrete learner question as a legitimate investigative move. When clarification is more useful than a guess, invite the investigator to ask what evidence, tool, or distinction needs explaining.',
    '- Make that permission visible: name the clue in plain language, or explicitly invite a short clarification question when a term or referent may be unclear. Never assume the investigator knows that a question may be answered with a clarifying question.',
    '- Stay inside the scene: address the investigator directly and never call either speaker "the tutor" or "the learner".',
    '- You are an adaptive scene actor as well as an investigator. A private turn instruction may cast you as a fellow investigator, examiner, record-keeper, witness/source, advocate, skeptic, or closer.',
    '- Take that part through a visible first-person action or voice, using only public evidence. Do not merely decorate the same question with theatrical language.',
  ].filter(Boolean);
}

function buildDirectorInitialContext(world) {
  if (!world) return null;
  return {
    stageNotes: [
      `Before the first exchange, ${world.title} is set as a public inquiry: ${world.question}`,
      String(world.setting || '').trim(),
    ]
      .filter(Boolean)
      .join('\n'),
    tutorCharacter:
      'The tutor enters as an adaptive scene actor: patient with the learner, but ready to examine, keep the record, argue, witness, or close as the public evidence demands.',
    learnerCharacter:
      String(world.learnerVoice || '').trim() ||
      'The learner enters as attentive but not yet committed, willing to test each claim aloud.',
    registerNote:
      "The tutor's voice should follow the public characters and scene pressure without adding hidden evidence or proof machinery.",
  };
}

function printDirectorInitialContext(context) {
  if (!context) return;
  const printField = (label, text) => {
    const lines = String(text || '').split('\n');
    console.log(`${C.dim}  ${label}:${C.reset} ${lines[0] || ''}`);
    for (const line of lines.slice(1)) {
      console.log(`    ${line}`);
    }
  };
  console.log(`${C.cyan}director context >${C.reset}`);
  printField('stage', context.stageNotes);
  printField('tutor', context.tutorCharacter);
  printField('learner', context.learnerCharacter);
  printField('voice', context.registerNote);
  console.log();
}

function printDirectorPreludeBeforeFirstTutor(state, { reason = 'first_tutor_message' } = {}) {
  if (!state?.directorContext || state.directorOpeningPresented) return false;
  state.directorOpeningPresented = true;
  appendTraceEvent(state.trace, {
    type: 'director_opening_prelude',
    reason,
    context: state.directorContext,
  });
  printDirectorInitialContext(state.directorContext);
  return true;
}

function directorNotesIssuedSoFar(state) {
  const throughTurn = Math.max(0, Number(state?.turns?.length || 0));
  const openingIssued = Boolean(
    state?.directorContext && (state.directorOpeningPresented || (state.history || []).length > 0),
  );
  const releases = committedReleaseRows(state, throughTurn)
    .filter((entry) => entry.via === 'director')
    .map((entry) => ({
      turn: Number(entry.turn),
      premise: entry.premise,
      via: 'director',
      surface: String(entry.surface || '').trim(),
    }));
  return {
    schema: 'machinespirits.tutor-stub.director-notes.v1',
    throughTurn,
    opening: openingIssued ? jsonClone(state.directorContext) : null,
    releases,
  };
}

function printDirectorNotesIssuedSoFar(state) {
  const notes = directorNotesIssuedSoFar(state);
  const printField = (label, text) => {
    const lines = String(text || '').split('\n');
    console.log(`${C.dim}  ${label}:${C.reset} ${lines[0] || ''}`);
    for (const line of lines.slice(1)) console.log(`    ${line}`);
  };
  console.log(`${C.cyan}director notes so far >${C.reset}`);
  if (!notes.opening && !notes.releases.length) {
    console.log(`${C.dim}  none have been issued yet${C.reset}\n`);
    return notes;
  }
  if (notes.opening) {
    console.log(`${C.dim}  opening directions${C.reset}`);
    printField('stage', notes.opening.stageNotes);
    printField('tutor', notes.opening.tutorCharacter);
    printField('learner', notes.opening.learnerCharacter);
    printField('voice', notes.opening.registerNote);
  }
  for (const release of notes.releases) {
    console.log(`${C.dim}  turn ${release.turn} · scene note${C.reset}`);
    for (const line of String(release.surface || '').split('\n')) console.log(`    ${line}`);
  }
  console.log(
    `${C.dim}  through ${
      notes.throughTurn > 0 ? `completed turn ${notes.throughTurn}` : 'the opening'
    }; future notes remain withheld${C.reset}\n`,
  );
  return notes;
}

function worldSpeakerDagPrompt(world) {
  if (!world) return [];
  return [
    '',
    '# Speaking-tutor evidence contract',
    '',
    'A private deterministic planner owns the answer, proof path, future evidence, and release schedule.',
    'You are the speaking tutor. You receive only the public scene, public rule glosses, public dialogue, and evidence available through the current turn.',
    'Never speculate about withheld evidence. The turn context will state exactly what evidence may enter the scene now.',
    '',
    'Public evidence rules in ordinary language:',
    ...world.rules.map((rule, index) => `${index + 1}. ${String(rule.gloss || '').trim()}`),
    '',
    'Speaking conduct:',
    '- Work only from evidence already public or explicitly made available in the current turn context.',
    '- Speak in ordinary scene language. Never invent formal notation, internal identifiers, paths, or hidden bookkeeping.',
    `- Treat the ${worldLedgerTerm(world)} as the learner's public reasoning record, not a second task. If the learner states a warranted inference from staged evidence, that one utterance counts as both the deduction and the ${worldLedgerTerm(world)} entry.`,
    '- Do not demand every obvious intermediate step from the learner. If an ordinary listener would supply the bridge from public evidence, carry it internally and keep the conversation moving.',
    "- Ask for an explicit missing bridge only when the learner's leap would close the case, contradict public evidence, rely on unstaged evidence, or name a suspect without licensed support.",
    '- If the learner guesses an answer, acknowledge it only as a hypothesis until the public evidence licenses it.',
    "- When new evidence is made available for this turn, introduce at most that one authored batch and ask for the learner's natural reading of what it changes, not a full proof ledger.",
    '- The one-new-clue limit constrains your staging, not the learner’s reasoning. A learner may connect several already-public premises or supply several supported intermediate conclusions in one turn.',
    '- When the learner makes a warranted multi-premise or multi-step advance, credit the whole chain. Do not make them restate its parts one by one; match their pace and test only the next unresolved edge.',
  ].filter(Boolean);
}

function responseChoiceModeRules({ multipleChoice, world = null }) {
  return multipleChoice
    ? [
        "- Multiple-choice mode is on. When it would help, you may present 2-4 short lettered choices for the learner's next move.",
        '- Multiple-choice options must be public evidence-shaped moves, not answers. Do not include the concealed answer, unstaged evidence, predicate/function notation, premise ids, rule ids, or route labels.',
        `- In story mode, each option should be a plain ${worldLedgerTerm(world)} line shape drawn from the staged evidence. Keep ${worldFlavourPhrase(world)} but avoid long menus.`,
        '- End by asking the learner to choose one option or write their own evidence claim.',
      ]
    : [
        '- Do not default to multiple choice. A tutor-only question-support instruction may still authorize one bounded choice when uncertainty shows that an open prompt is not answerable enough.',
        '- If no question-support override applies and the learner seems unsure, put a directional hint into the discourse before asking; never ask them to invent a record, source, name, or fact that has not entered the public scene.',
        '- When talking through options, collapse them to one live issue: what changed, what remains unsafe, or what the learner now thinks follows.',
        "- End with one light prompt for the learner's natural next thought; do not require a full proof step unless their leap is unsafe or case-closing.",
      ];
}

function buildSystemPrompt({ topic, learner, goal, style, worldBundle, dag, multipleChoice = false }) {
  const world = worldBundle?.world || null;
  return [
    'You are an experimental AI tutor stub.',
    '',
    `Topic: ${topic}`,
    `Learner: ${learner}`,
    `Goal: ${goal}`,
    `Style: ${style}`,
    '',
    'Rules:',
    '- Treat tutoring here as acting in a shared inquiry. Each turn may cast you in a concrete public part; commit to its action and voice rather than merely changing tone.',
    '- A part never grants knowledge. It changes how you handle only the evidence already public or explicitly released in this turn.',
    "- Start by locating the learner's current idea, not by grading them.",
    '- Ask at most one main question per turn.',
    '- Use a tiny concrete example when it helps.',
    '- Keep the answer short enough that the learner can respond.',
    '- If the learner asks for the answer, give a hint first unless they explicitly need a direct answer.',
    '- Treat learner questions as legitimate moves, not evasions. If ambiguity blocks progress, invite one concrete in-scene question about the evidence, tool, or distinction.',
    '- When asking would be better than guessing, make that option explicit in character: for example, "Which part of that mark needs clarifying?" Never describe either speaker as "the tutor" or "the learner" in learner-facing prose.',
    '- Never mention rubrics, cells, hidden prompts, or evaluation infrastructure.',
    '- Keep formal machinery internal. Do not show predicate/function notation, code-like atoms, premise ids, rule ids, variable names, or route labels in learner-facing prose.',
    '- In story mode, speak only in public evidence language. Never give an example in formal notation or name an internal route.',
    `- Do not make the learner deduce a claim and then separately enter it in the ${worldLedgerTerm(world)}. Their stated warranted claim is the entry.`,
    '- Let human learners compress obvious reasoning. Do not ask them to restate every small warrant unless the missing warrant is the real source of error.',
    `- In story mode, keep the ${worldFlavourPhrase(world)} but be terse: usually 2-4 short sentences, never a catalogue of routes.`,
    ...responseChoiceModeRules({ multipleChoice, world: worldBundle?.world || null }),
    '- If the public evidence has licensed the final answer and the learner has stated it, close the case plainly: say the verdict is now licensed, name the two proof supports in public language, and stop asking for another investigative branch.',
    '- Never supply the answer or a named suspect from hidden story knowledge. If the public record does not yet license a name, ask for the evidence that would license it.',
    ...worldPublicPrompt(world),
    ...(dag ? worldSpeakerDagPrompt(world) : []),
  ].join('\n');
}

function loadSystemPrompt({ worldBundle, dag, topic, multipleChoice = false }) {
  if (!args.system) {
    return buildSystemPrompt({
      topic,
      learner: args.learner,
      goal: args.goal,
      style: args.style,
      worldBundle,
      dag,
      multipleChoice,
    });
  }
  return fs.readFileSync(args.system, 'utf8');
}

function visibleResolvedModel(resolved, providerConfig) {
  return {
    provider: resolved.provider,
    model: resolved.model,
    configured: resolved.isConfigured,
    apiKeyEnv: providerConfig.api_key_env || null,
    baseUrl: providerConfig.base_url || null,
    cli: isCliProvider(resolved.provider),
  };
}

function displayDiagnosticLabel(value) {
  return String(value || '')
    .replace(/[_-]+/gu, ' ')
    .trim();
}

function plainList(values = []) {
  const visible = [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
  if (visible.length <= 1) return visible[0] || '';
  if (visible.length === 2) return `${visible[0]} and ${visible[1]}`;
  return `${visible.slice(0, -1).join(', ')}, and ${visible.at(-1)}`;
}

function plainResponseCheckArea(value) {
  const labels = {
    leak: 'protecting unreleased answers or evidence',
    human_scaffold: 'not repeating an already answered question',
    question_support: 'asking only from information already available',
    dramatic_release: 'bringing the new clue into the scene clearly',
    actorial_realization: 'making the selected character and teaching style visible',
    response_composition: 'responding to the learner before developing the scene',
    repetition: 'avoiding repeated wording or questions',
    dialogue_closure: 'ending the conversation clearly',
  };
  return labels[value] || displayDiagnosticLabel(value);
}

function plainSettingName(value) {
  const labels = {
    tutorModelRef: 'tutor model',
    classifierModelRef: 'learner interpretation model',
    learnerRecordModelRef: 'learner reasoning model',
    autoLearnerModelRef: 'learner voice model',
    allModelsOverrideRef: 'one model for all roles',
    learner_interpretation_model: 'learner interpretation model',
    learner_reasoning_model: 'learner reasoning model',
    learner_voice_model: 'learner voice model',
    engagementStanceTemperature: 'teaching-style range',
    dagFactDropoutRate: 'evidence-memory dropout',
    releaseSpeed: 'clue release speed',
    clue_release_speed: 'clue release speed',
    registerPolicy: 'teaching approach',
    registerOverlays: 'turn/conversation overrides',
    registerOverlayThreshold: 'override sensitivity',
  };
  return labels[value] || displayDiagnosticLabel(value);
}

function responseCheckTriggerAreas(turn) {
  const accounting = turn?.tutorGuardAccounting || null;
  const triggers = (accounting?.repairsApplied || []).flatMap((repair) => repair.triggeredBy || []);
  return [...new Set(triggers.map((trigger) => plainResponseCheckArea(trigger.guard)).filter(Boolean))];
}

function plainResponseCheckSummary(turn) {
  if (!turn?.tutorResponseRepaired) return null;
  const areas = responseCheckTriggerAreas(turn);
  const reason = areas.length ? ` for ${plainList(areas)}` : '';
  return turn.tutorDeterministicFallback
    ? `The first two drafts needed revision${reason}, so a safe fallback was shown instead.`
    : `The first draft needed revision${reason}. It was rewritten and rechecked before display.`;
}

function metadataLine(meta) {
  const usage = meta.usage || {};
  const total = Number(usage.totalTokens ?? (usage.inputTokens || 0) + (usage.outputTokens || 0));
  const tokens =
    meta.tokenUsageAvailable === false
      ? 'tokens unavailable'
      : `${Number.isFinite(total) ? total.toLocaleString('en-US') : 0} tokens`;
  const cost = usage.cost ? `, $${Number(usage.cost).toFixed(6)}` : '';
  const effort = meta.effort || meta.reasoningEffort ? `, effort ${meta.effort || meta.reasoningEffort}` : '';
  const guard = meta.deterministicFallback ? ', safe fallback used' : meta.repaired ? ', response revised' : '';
  const stream = meta.guardedStreamReplay ? ', checked before display' : meta.streamed ? ', streamed' : '';
  const cache = meta.speculativeCacheHit ? ', prefetched response' : '';
  const releasePacing = meta.releasePacing || null;
  const pace = releasePacing
    ? `, clue pace ${releasePacing.direction === 'accelerate' ? 'faster ' : releasePacing.direction === 'decelerate' ? 'slower ' : ''}${releasePacing.effectiveSpeed}x${releasePacing.releasedNow?.length ? `; ${releasePacing.releasedNow.length} new clue${releasePacing.releasedNow.length === 1 ? '' : 's'}` : ''}`
    : '';
  const selection = meta.registerSelection || null;
  const stance = selection?.engagement_stance || selection?.selected_register || null;
  const action = selection?.action_family || selection?.response_configuration?.action_family || null;
  const character =
    selection?.actorial_part_label ||
    selection?.response_configuration?.actorial_part_label ||
    selection?.actorial_part ||
    selection?.response_configuration?.actorial_part ||
    null;
  const performance =
    selection?.actorial_performance?.label ||
    selection?.response_configuration?.actorial_performance?.label ||
    null;
  const register = [
    stance ? `style ${displayDiagnosticLabel(stance)}` : null,
    action ? `move ${displayDiagnosticLabel(action)}` : null,
    character ? `character ${displayDiagnosticLabel(character)}` : null,
    performance ? `performance ${displayDiagnosticLabel(performance)}` : null,
  ]
    .filter(Boolean)
    .map((part) => `, ${part}`)
    .join('');
  const tutor = meta.tutorRef ? `, tutor ${meta.tutorRef}` : '';
  return `${meta.provider}/${meta.model}, ${meta.latencyMs || 0}ms, ${tokens}${cost}${effort}${register}${pace}${guard}${stream}${cache}${tutor}`;
}

function usesFixedOpenAITemperature(resolved) {
  return resolved.provider === 'openai' && /^gpt-5(?:[.-]|$)/.test(resolved.model);
}

function effectiveTemperatureForModel(resolved, requestedTemperature) {
  if (usesFixedOpenAITemperature(resolved)) {
    return 1;
  }
  return requestedTemperature;
}

function normalizeDagMode(value) {
  const mode = String(value || 'strict_dag')
    .trim()
    .toLowerCase()
    .replace(/-/gu, '_');
  if (DAG_MODES.includes(mode)) return mode;
  throw new Error(`Unknown --dag-mode: ${value}. Expected ${DAG_MODES.join(', ')}.`);
}

function buildHumanDiscourseRunConfig({ dagMode, dagEnabled, tutorLearnerDagEnabled }) {
  const scaffoldActive = dagMode !== 'strict_dag';
  const stepCompression =
    dagMode === 'defeasible_human_scaffold'
      ? {
          enabled: true,
          policy:
            'accept obvious public bridges as implied proof debt; ask for explicit warrants only when the leap is unsafe, conflicting, or case-closing',
          maxExplicitDemandsPerTurn: 1,
        }
      : {
          enabled: false,
          policy:
            dagMode === 'human_scaffold'
              ? 'frame one local warrant without expanding the whole proof chain'
              : 'strict proof audit only',
          maxExplicitDemandsPerTurn: dagMode === 'human_scaffold' ? 1 : 0,
        };
  return {
    schema: HUMAN_DISCOURSE_RUN_CONFIG_SCHEMA,
    dagMode,
    strictAuditDag: Boolean(dagEnabled),
    tutorLearnerDag: Boolean(tutorLearnerDagEnabled),
    phase: HUMAN_DISCOURSE_PHASE,
    scaffoldActive,
    stepCompression,
    scaffoldPolicy:
      dagMode === 'defeasible_human_scaffold'
        ? 'allow learner-owned compressed inference, keep implied proof debt internal, and only surface warrant gaps when they matter'
        : dagMode === 'human_scaffold'
          ? 'frame local human-facing warrants while strict DAG audit remains authoritative'
          : 'strict DAG audit only; no human-scaffold prompt adaptation',
    traceFields: [
      'humanDiscourseFrame',
      'scaffoldState',
      'sideArc',
      'proofDebt',
      'warrantPremiseAudit',
      'generousInference',
      'questionSupport',
    ],
    behaviorChange: scaffoldActive,
  };
}

function buildRegisterPalette(mode) {
  const definitions = getEngagementStanceDefinitions();
  const allNames = Object.keys(definitions);
  const safeNames = getEngagementStanceNames({ includeArmAssigned: false });
  const value = String(mode || 'all')
    .trim()
    .toLowerCase();

  let names;
  if (!value || value === 'safe' || value === 'router' || value === 'positive') {
    names = safeNames;
  } else if (value === 'negative' || value === 'negative-floor') {
    names = NEGATIVE_FLOOR_REGISTERS;
  } else if (value === 'non-simulated') {
    names = allNames.filter((name) => definitions[name]?.simulated_only !== true);
  } else if (value === 'all' || value === 'simulated') {
    names = allNames;
  } else {
    names = value
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
  }

  const resolvedNames = names.map((name) => resolveEngagementStance(name)?.register || name);
  const unknown = names.filter((name, index) => !definitions[resolvedNames[index]]);
  if (unknown.length) {
    throw new Error(`Unknown --register-palette register(s): ${unknown.join(', ')}. Known: ${allNames.join(', ')}`);
  }

  return [...new Set(resolvedNames)];
}

function engagementStanceDefinitionSummary(name) {
  const def = getEngagementStanceDefinition(name) || {};
  return {
    register: name,
    valence: def.valence || 'unknown',
    router_selectable: def.router_selectable === true,
    simulated_only: def.simulated_only === true,
    reviewer_cues: def.reviewer_cues || def.trigger || null,
    stance_contract: String(def.stance_contract || '').trim(),
    required_moves: Array.isArray(def.required_moves) ? def.required_moves : [],
    risk_flags: Array.isArray(def.risk_flags) ? def.risk_flags : [],
    forbidden_phrases: Array.isArray(def.forbidden_phrases) ? def.forbidden_phrases : [],
    recognition_guardrail: String(def.recognition_guardrail || '').trim() || null,
  };
}

function engagementStancePalettePromptRows(palette) {
  return JSON.stringify(palette.map(engagementStanceDefinitionSummary), null, 2);
}

function requestTypePromptRows() {
  const definitions = getRequestTypeDefinitions();
  const rows = Object.entries(definitions).map(([requestType, definition]) => ({
    request_type: requestType,
    role: definition.role || 'logical_armature',
    description: definition.description || '',
    dag_use: definition.dag_use || '',
  }));
  return rows.length ? JSON.stringify(rows, null, 2) : 'No request-type registry is configured.';
}

function learnerDagPromptSummary(model) {
  if (!model) return 'No prior tutor-side learner-DAG model is available yet.';
  const record = model.learnerRecord || {};
  return JSON.stringify(
    {
      turn: model.turn ?? null,
      metrics: model.metrics || {},
      assessment: model.assessment || {},
      memoryReliability: model.memoryReliability || null,
      learnerRecord: {
        grounded: (record.grounded || []).slice(-8),
        voicedDerived: (record.voicedDerived || []).slice(-8),
        hypotheses: (record.hypotheses || []).slice(-5),
        answerCandidates: record.answerCandidates || [],
      },
    },
    null,
    2,
  );
}

function registerHistoryPromptSummary(state) {
  const history = state.register?.history || [];
  if (!history.length) return 'No prior tutor-register choices.';
  return history
    .slice(-6)
    .map((entry) => {
      const normalized = normalizeStoredRegisterSelection(entry);
      const efficacy = normalized?.efficacy
        ? `${normalized.efficacy.label} (DAG score ${normalized.efficacy.progressScore}; ${
            normalized.efficacy.learnerFeedback?.rating
              ? `learner rating ${normalized.efficacy.learnerFeedback.rating}; `
              : ''
          }${normalized.efficacy.summary})`
        : 'pending next learner turn';
      return `Turn ${entry.turn}: ${normalized?.selected_register || 'unknown'} — ${entry.register_reason || 'no reason'}; efficacy: ${efficacy}`;
    })
    .join('\n');
}

function latestFieldStateMismatch(state) {
  return latestRegisterEfficacy(state)?.mismatch || null;
}

function engagementStanceSelectionPolicyPrompt(state) {
  const policy = state.register?.policy || 'dynamic';
  const overlays = state.register?.overlays || [];
  const latest = latestRegisterSelection(state);
  const latestEfficacy = latest?.efficacy?.label || 'pending';
  const recentBrisk = recentRegisterCount(state, 'brisk');
  const lines =
    policy === 'random'
      ? [
          '- Engagement-stance policy: random. The runtime will sample a register locally from the active palette.',
          '- Do not choose or justify an engagement stance in the model output for this policy.',
        ]
      : policy === 'negative'
        ? [
            '- Engagement-stance policy: negative. The runtime will sample locally only from ironic, sarcastic, and face_threat.',
            '- Do not choose or justify an engagement stance in the model output for this policy.',
          ]
        : policy === 'bland'
          ? [
              '- Engagement-stance policy: bland. The runtime uses a fixed plain register as a non-adaptive baseline.',
              '- Do not choose or justify an engagement stance in the model output for this policy.',
            ]
          : policy === 'trajectory'
            ? [
                '- Engagement-stance policy: trajectory. The runtime maps recent learner-field and learner-DAG trajectory into a local engagement-stance distribution.',
                '- Do not choose or justify an engagement stance in the model output for this policy.',
              ]
            : policy === 'dynamical_system'
              ? [
                  '- Engagement-stance policy: dynamical_system. The runtime maps a continuous state/derivative vector through theory priors plus local efficacy evidence.',
                  '- Do not choose or justify an engagement stance in the model output for this policy.',
                ]
              : policy === 'empirical_dynamical_system'
                ? [
                    '- Engagement-stance policy: empirical_dynamical_system. The runtime maps a continuous state/derivative vector through theory priors, local efficacy evidence, and cross-run empirical priors.',
                    '- Do not choose or justify an engagement stance in the model output for this policy.',
                  ]
                : policy === 'continuous_dynamical_system'
                  ? [
                      '- Engagement-stance policy: continuous_dynamical_system. The runtime maps a continuous state/derivative vector through theory priors plus local efficacy evidence into a weighted engagement-stance blend.',
                      '- Do not choose or justify an engagement stance in the model output for this policy.',
                    ]
                  : policy === 'continuous_empirical_dynamical_system'
                    ? [
                        '- Engagement-stance policy: continuous_empirical_dynamical_system. The runtime maps a continuous state/derivative vector through theory priors, local efficacy evidence, and cross-run empirical priors into a weighted engagement-stance blend.',
                        '- Do not choose or justify an engagement stance in the model output for this policy.',
                      ]
                    : [
                        '- Engagement-stance policy: dynamic. The up-front reviewer chooses the register; do not treat the learner request type as the register.',
                        '- Brisk pacing is available but must not be the default register.',
                        '- Penalize repeating the same register, especially brisk. A repeated register needs a concrete reviewer reason grounded in the current public turn.',
                        '- Use brisk only when tight pacing is the needed stance: explicit step-by-step request, visible procedural confusion about the immediate next evidence move, or a newly staged evidence item that needs one learner-owned inference.',
                        '- Do not choose brisk merely because the learner-DAG still has a release_or_pacing_gap, inference_gap, missing premise, or incomplete proof path.',
                        '- If the previous brisk choice produced no_clear_progress or regression_or_overreach, choose a non-brisk register unless the current learner explicitly asks for step-by-step help.',
                        '- Good dynamic alternatives: precise for a distinction/error in terms or accountable warrant; plain for compression/transfer; charismatic for resistant, rote, answer-seeking, or low-agency compliance; witnessing for affective exposure.',
                      ];
  if (latest) {
    lines.push(`- Last register: ${latest.selected_register}; observed efficacy: ${latestEfficacy}.`);
    if (latest.efficacy?.mismatch) {
      lines.push(
        `- Last field/state relation: ${latest.efficacy.mismatch}; field delta ${
          formatSignedInterimNumber(latest.efficacy.field?.delta, { decimals: 3 }) || '0'
        }, DAG progress ${latest.efficacy.dagProgress ? 'yes' : 'no'}.`,
      );
    }
  }
  if (policy === 'dynamic' && recentBrisk) {
    lines.push(`- Recent brisk count: ${recentBrisk} in the last four selections. Treat this as a repetition penalty.`);
  }
  if (policy === 'dynamic') {
    lines.push(
      '- If the last relation was field_without_dag, treat that as preparatory success: use plain or precise to convert the emerging learner move into one public evidence claim.',
    );
    lines.push(
      '- If the last relation was dag_without_field, the proof state moved but learner agency flattened: ask the learner to restate why the evidence matters in their own words before pushing another proof step.',
    );
  }
  if (overlays.length) {
    lines.push(
      `- Added strong-change policies: ${overlays.join(', ')}. Make the primary ${policy} choice normally; the runtime evaluates these overlays afterward and records whether one takes control.`,
    );
  }
  return lines.join('\n');
}

function classifierWorldContext(state) {
  if (!state.world) return 'No detective-story world is active.';
  return [
    `World: ${state.world.id} - ${state.world.title}`,
    state.world.discipline ? `Discipline: ${state.world.discipline}` : null,
    `Public question: ${state.world.question}`,
    `Opening situation: ${String(state.world.setting || '').trim()}`,
    `DAG mode: ${state.dag ? 'on, but hidden DAG state is intentionally withheld from this classifier' : 'off'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildLearnerClassifierPrompt({ learnerText, state }) {
  const comprehensionContext = tutorStubComprehensionPrompt(state.comprehension, {
    turn: state.turns.length + 1,
  });
  return [
    '# Task',
    '',
    'Classify the learner input before the tutor responds.',
    'Spell out exactly two headline judgments:',
    '1. What the learner has done in this turn.',
    '2. What the learner has done overall across the dialogue so far.',
    comprehensionContext || null,
    '',
    '# Public tutoring context',
    '',
    `Topic: ${state.topic}`,
    classifierWorldContext(state),
    '',
    '# Previous public transcript',
    '',
    compactPublicTranscriptForPrompt(state, state.historyTurns),
    '',
    '# Current learner turn',
    '',
    learnerText,
    '',
    '# Compact pedagogical discourse rubric',
    '',
    'Conceptual engagement score:',
    '1 = parrots or only asks for an answer; 2 = procedural or surface focus; 3 = some conceptual engagement but mostly paraphrase; 4 = substantive connections or reasoning; 5 = constructs, tests, or revises an interpretation.',
    '',
    'Epistemic readiness score:',
    '1 = pure information reception; 2 = minimal metacognition; 3 = generic awareness of confusion or strategy; 4 = distinguishes genuine understanding from performance and asks evidence-generating questions; 5 = actively monitors bias, uncertainty, evidence, and what would count as knowing.',
    '',
    'Use these controlled labels where possible:',
    '- request_type: conceptual_clarity_request, stepwise_support_request, authority_refusal_or_status_challenge, plain_language_request, plain_simplification_followup, transfer_demand_or_named_material, vulnerability_or_moral_exposure, resistance_or_low_agency, answer_seeking_or_overreach, off_task_or_mixed',
    '- discourse_move: question, claim, hypothesis, inference, evidence_adoption, challenge, repair_request, affective_signal, answer_seeking, metacognitive_reflection, off_task',
    '- evidence_use: none, repeats_setup, cites_public_evidence, omits_warrant, links_evidence_to_rule, overleaps_evidence, distorts_public_evidence, revises_from_evidence',
    '- Use omits_warrant when the learner states a correct public clue and a conclusion but leaves out the bridge that licenses the conclusion. Do not call that links_evidence_to_rule merely because the bridge is easy to infer.',
    '- Use distorts_public_evidence only when the learner misstates, blends, or reassigns an already public clue. Use overleaps_evidence for a premature conclusion or missing warrant without distorted recall.',
    '- Precedence rule: choose distorts_public_evidence, not overleaps_evidence, when the learner says or implies that an earlier/public clue existed when it did not, changes what a public clue said, or blends two public clues into a false remembered detail. This remains true when the distortion also supports a premature conclusion.',
    '- Otherwise choose omits_warrant over links_evidence_to_rule when the bridge is absent; reserve overleaps_evidence for a claim that outruns the currently public evidence, especially a premature culprit or case-closing inference.',
    '- Resolve short answers, pronouns, and ellipsis against the immediately preceding tutor question before classifying them. A reply such as "it will be the same" can fully answer a local single-referent question even though it does not repeat the noun.',
    '- Do not label a contextually complete short answer confused, passive, or evidence-free merely because it omits words already supplied by the preceding question. Preserve any genuinely missing warrant as a separate strict-audit issue.',
    '- epistemic_stance: receptive, confused, exploratory, overconfident, resistant, answer_seeking, reflective, grounded',
    '- agency: passive, complying, attempting, steering, self_correcting',
    '',
    '# Request type registry',
    '',
    'Request type belongs to the logical armature: it describes what kind of move/device the learner turn calls for in the DAG or proof path. It is not the tutor engagement stance.',
    requestTypePromptRows(),
    '',
    '# JSON schema',
    '',
    JSON.stringify(
      {
        turn: {
          summary: 'plain-language sentence naming what the learner did in this turn',
          request_type: 'logical request type, not a tutor engagement stance',
          discourse_move: 'one controlled label',
          evidence_use: 'one controlled label',
          epistemic_stance: 'one controlled label',
          affect: 'brief affect/energy label',
          agency: 'one controlled label',
          scores: {
            conceptual_engagement: { score: 1, reason: 'brief reason' },
            epistemic_readiness: { score: 1, reason: 'brief reason' },
          },
          pedagogical_need: 'what the tutor should attend to immediately',
        },
        overall: {
          summary: 'plain-language sentence naming what the learner has done overall',
          trajectory: 'how their participation is changing or not changing',
          recurring_pattern: 'dominant pattern across turns, or none yet',
          current_state: 'where the learner seems to be now',
          next_best_tutor_move: 'best immediate tutor move based on public evidence only',
        },
      },
      null,
      2,
    ),
  ]
    .filter((line) => line !== null)
    .join('\n');
}

async function callPromptModel({
  prompt,
  messageHistory = [],
  resolved,
  systemPrompt,
  role,
  maxTokens = 700,
  trace = null,
  stream = null,
  cliEffort = null,
  turn = null,
  signal = null,
}) {
  const startedAt = new Date().toISOString();
  const shouldStream = Boolean(stream?.enabled && !stream?.deferOutput && providerSupportsStreaming(resolved));
  const publicMessageHistory = (Array.isArray(messageHistory) ? messageHistory : []).map((message) => ({
    role: message?.role === 'assistant' ? 'assistant' : 'user',
    content: String(message?.content || ''),
  }));
  const requestMessages = [...publicMessageHistory, { role: 'user', content: prompt }];
  const promptAudit = auditTutorStubPrompt({
    surface: tutorStubPromptSurfaceForRole(role),
    systemPrompt,
    userPrompt: prompt,
    messageHistory: publicMessageHistory,
  });
  if (!promptAudit.ok) {
    appendTraceEvent(trace, {
      type: 'prompt_audit_failed',
      role,
      turn,
      audit: promptAudit,
    });
    throw new Error(
      `Prompt audit failed for ${role}: ${promptAudit.violations.map((violation) => violation.code).join(', ')}`,
    );
  }
  try {
    let response;
    if (isCliProvider(resolved.provider)) {
      const onEvent =
        resolved.provider === 'codex'
          ? (event) => {
              const item = event?.item || {};
              appendTraceEvent(trace, {
                type: 'cli_stream_event',
                role,
                turn,
                eventType: event?.type || 'unknown',
                itemType: item?.type || null,
              });
              if (!stream?.enabled) return;
              const active = getInterimState(stream?.interim)?.active;
              if (!active) return;
              const phase =
                event?.type === 'thread.started'
                  ? 'starting Codex'
                  : event?.type === 'turn.started'
                    ? 'model working'
                    : event?.type === 'item.started' && item?.type
                      ? item.type.replaceAll('_', ' ')
                      : event?.type === 'item.completed' && item?.type === 'agent_message'
                        ? 'finalizing result'
                        : null;
              if (phase) active.phase = `${active.basePhase || active.phase} · ${phase}`;
            }
          : null;
      const result = await callAIWithCliBridge(
        { provider: resolved.provider, model: resolved.model },
        systemPrompt,
        prompt,
        role,
        { messageHistory: publicMessageHistory, effort: cliEffort, onEvent, signal },
      );
      response = {
        text: result.text,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        usage: {
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          totalTokens: (result.inputTokens || 0) + (result.outputTokens || 0),
          cost: result.cost || 0,
        },
        effort: result.effort || result.reasoningEffort || null,
        reasoningEffort: result.reasoningEffort || result.effort || null,
        tokenUsageAvailable: result.tokenUsageAvailable,
        streamedEvents: result.streamedEvents || 0,
        invalidStreamLines: result.invalidStreamLines || 0,
        outputSource: result.outputSource || null,
      };
    } else if (shouldStream) {
      const temperature = effectiveTemperatureForModel(resolved, 0.1);
      const sink = createConsoleTokenSink(role, stream?.interim);
      let final = null;
      for await (const chunk of streamAI({
        provider: resolved.provider,
        model: resolved.model,
        systemPrompt,
        messages: requestMessages,
        preset: 'socratic',
        config: { temperature, maxTokens },
      })) {
        if (chunk.type === 'text_delta') {
          sink.write(chunk.content);
        } else if (chunk.type === 'done') {
          final = chunk;
        }
      }
      const streamed = sink.finish();
      response = {
        text: final?.content || '',
        provider: final?.provider || resolved.provider,
        model: final?.model || resolved.model,
        latencyMs: final?.latencyMs || 0,
        usage: final?.usage || null,
        streamed,
      };
    } else {
      const temperature = effectiveTemperatureForModel(resolved, 0.1);
      const result = await callAI({
        provider: resolved.provider,
        model: resolved.model,
        systemPrompt,
        messages: requestMessages,
        preset: 'socratic',
        config: { temperature, maxTokens },
      });
      response = {
        text: result.content,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        usage: result.usage,
      };
    }

    response.promptSnapshot = {
      systemPrompt,
      userPrompt: prompt,
      messageHistory: publicMessageHistory,
      role,
      promptAudit,
    };
    appendTraceEvent(trace, {
      type: 'model_call',
      role,
      turn,
      startedAt,
      provider: response.provider,
      model: response.model,
      request: {
        systemPrompt,
        prompt,
        messageHistory: publicMessageHistory,
        messages: requestMessages,
        maxTokens,
        cliEffort,
        promptAudit,
      },
      response: {
        text: response.text,
        latencyMs: response.latencyMs,
        usage: response.usage,
        streamed: Boolean(response.streamed),
        effort: response.effort || response.reasoningEffort || null,
        streamedEvents: response.streamedEvents || 0,
        invalidStreamLines: response.invalidStreamLines || 0,
        outputSource: response.outputSource || null,
      },
    });
    response.promptAudit = promptAudit;
    return response;
  } catch (err) {
    appendTraceEvent(trace, {
      type: err?.name === 'AbortError' ? 'model_call_aborted' : 'model_call_error',
      role,
      turn,
      startedAt,
      provider: resolved.provider,
      model: resolved.model,
      request: {
        systemPrompt,
        prompt,
        messageHistory: publicMessageHistory,
        messages: requestMessages,
        maxTokens,
        promptAudit,
      },
      error: err.message,
    });
    throw err;
  }
}

async function callClassifierModel({
  prompt,
  resolved,
  trace = null,
  stream = null,
  cliEffort = null,
  turn = null,
  signal = null,
}) {
  return await callPromptModel({
    prompt,
    resolved,
    systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
    role: 'tutor_stub_learner_classifier',
    maxTokens: 700,
    trace,
    stream,
    cliEffort,
    turn,
    signal,
  });
}

function failedClassification({ message, resolved, latencyMs = 0, usage = null }) {
  return {
    error: message,
    turn: {
      summary: 'Classifier failed before the tutor turn.',
      request_type: 'off_task_or_mixed',
      discourse_move: 'unknown',
      evidence_use: 'unknown',
      epistemic_stance: 'unknown',
      affect: 'unknown',
      agency: 'unknown',
      scores: {},
      pedagogical_need: 'Proceed cautiously and use the learner input directly.',
    },
    overall: {
      summary: 'Overall classification is unavailable because the classifier failed.',
      trajectory: 'unknown',
      recurring_pattern: 'unknown',
      current_state: 'unknown',
      next_best_tutor_move: 'Ask a focused diagnostic question.',
    },
    provider: resolved?.provider || null,
    model: resolved?.model || null,
    latencyMs,
    usage: usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
  };
}

async function classifyLearnerInput({ learnerText, state, signal = null }) {
  const startedAt = Date.now();
  try {
    const prompt = buildLearnerClassifierPrompt({ learnerText, state });
    const raw = await callClassifierModel({
      prompt,
      resolved: state.classifier.resolved,
      trace: state.trace,
      stream: state.stream,
      cliEffort: state.cliEffort,
      turn: state.turns.length + 1,
      signal,
    });
    const { parsed, parseError } = parseClassifierJson(raw.text);
    return {
      ...parsed,
      parseError,
      provider: raw.provider,
      model: raw.model,
      latencyMs: raw.latencyMs,
      usage: raw.usage,
    };
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    return failedClassification({
      message: err.message,
      resolved: state.classifier.resolved,
      latencyMs: Date.now() - startedAt,
    });
  }
}

function printClassification(classification) {
  if (!classification) return;
  const conceptual = scoreValue(classification.turn?.scores?.conceptual_engagement);
  const readiness = scoreValue(classification.turn?.scores?.epistemic_readiness);
  const requestType = classification.turn?.request_type || 'unknown_request';
  const move = classification.turn?.discourse_move || 'unknown';
  const stance = classification.turn?.epistemic_stance || 'unknown';
  const need = classification.turn?.pedagogical_need || classification.overall?.next_best_tutor_move || '';
  const errorPrefix =
    classification.error || classification.parseError ? `${C.red} learner-classifier warning${C.reset}` : '';

  console.log(`${C.cyan}learner classifier >${C.reset} ${classification.turn?.summary || 'No turn summary.'}`);
  console.log(
    `${C.dim}  request: ${requestType}; move: ${move}; stance: ${stance}; conceptual ${conceptual}/5, readiness ${readiness}/5${C.reset}`,
  );
  if (classification.turn?.learning_pace || classification.turn?.reasoning_span) {
    console.log(
      `${C.dim}  pace: ${classification.turn?.learning_pace || 'steady'}; reasoning span: ${
        classification.turn?.reasoning_span || 'unknown'
      }${C.reset}`,
    );
  }
  console.log(`${C.dim}  overall: ${classification.overall?.summary || 'No overall summary.'}${C.reset}`);
  if (need) console.log(`${C.dim}  tutor cue: ${need}${C.reset}`);
  if (errorPrefix)
    console.log(`${errorPrefix}${C.dim}: ${classification.error || classification.parseError}${C.reset}`);
}

function floorClassifierScore(score, minimum, reason) {
  const current = Number(scoreValue(score));
  if (Number.isFinite(current) && current >= minimum) return score;
  if (score && typeof score === 'object') return { ...score, score: minimum, reason };
  return { score: minimum, reason };
}

function applyLearnerAdvanceAssessment(classification, tutorLearnerDag) {
  const advance = tutorLearnerDag?.advance || tutorLearnerDag?.model?.learnerAdvance || null;
  const turn = classification?.turn;
  if (!advance || !turn) return classification;
  turn.learner_advance = advance;
  if (!advance.accelerated) return classification;
  turn.learning_pace = 'accelerating';
  turn.reasoning_span = advance.multiStep ? 'multi_step' : 'multi_premise';
  turn.discourse_move = advance.derivedFactCount > 0 ? 'inference' : 'evidence_adoption';
  if (['none', 'repeats_setup', 'cites_public_evidence'].includes(turn.evidence_use)) {
    turn.evidence_use = advance.derivedFactCount > 0 ? 'links_evidence_to_rule' : 'cites_public_evidence';
  }
  if (['passive', 'complying', 'attempting'].includes(turn.agency)) turn.agency = 'steering';
  turn.scores = turn.scores || {};
  const reason = `Accepted ${advance.supportedMoveCount} learner-owned public proof moves in one turn.`;
  turn.scores.conceptual_engagement = floorClassifierScore(turn.scores.conceptual_engagement, 4, reason);
  turn.scores.epistemic_readiness = floorClassifierScore(turn.scores.epistemic_readiness, 4, reason);
  return classification;
}

const INTERIM_FRAMES = ['|', '/', '-', '\\'];

function clearStatusLine() {
  process.stdout.write('\r\x1b[2K');
}

function printWithConcurrentTerminal(state, callback) {
  const terminal = state?.concurrentTerminal;
  return terminal?.enabled ? terminal.print(callback) : callback();
}

function createInterimState({ enabled }) {
  return { enabled, active: null, lastContext: null };
}

function getInterimState(holder) {
  if (!holder) return null;
  if (
    Object.prototype.hasOwnProperty.call(holder, 'active') &&
    Object.prototype.hasOwnProperty.call(holder, 'enabled')
  ) {
    return holder;
  }
  return holder.interim || null;
}

function interimAnimationAvailable(interim) {
  return Boolean(interim?.enabled && output.isTTY);
}

function formatSignedInterimNumber(value, { decimals = 2 } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) return null;
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(decimals)}`;
}

function compactInterimStateSummary(state) {
  const bits = [];
  if (state?.classifier?.enabled) bits.push('learner reading');
  if (state?.learnerDag?.enabled) bits.push('reasoning progress');
  if (state?.register?.enabled) bits.push('response style');
  if (state?.dag) bits.push('evidence pacing');
  return bits.length ? bits.join(', ') : 'plain tutor response';
}

function interimLevel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'not available';
  if (numeric < 0.25) return 'low';
  if (numeric < 0.5) return 'developing';
  if (numeric < 0.75) return 'strong';
  return 'very strong';
}

function plainInterimBottleneck(value) {
  const labels = {
    release_or_pacing_gap: 'the learner needs the next usable piece of evidence',
    warrant_gap: 'the learner needs a clearer reasoning link',
    unsupported_assertion: 'the conclusion has moved beyond the evidence',
    grounded_asserted_secret: 'the conclusion is supported and stated',
    grounded_unasserted_secret: 'the conclusion is supported but not yet stated',
  };
  return labels[value] || String(value || 'the next useful learner move').replaceAll('_', ' ');
}

function compactInterimFieldSummary(state) {
  if (!state?.turns?.length) return compactInterimStateSummary(state);
  const field = buildLightweightDialogueField(state.turns);
  const final = field.summary.final;
  const bottleneck = plainInterimBottleneck(final.bottleneck);
  return [
    `learner understanding ${interimLevel(final.learnerMastery)}`,
    `pressure ${interimLevel(final.learnerRisk)}`,
    `tutor fit ${interimLevel(final.tutorAlignment)}`,
    `momentum ${interimLevel(final.jointMomentum)}`,
    bottleneck,
  ].join(' | ');
}

function previousLearnerDagModel(state, context) {
  const currentTurn = Number(context?.tutorTurn || 0);
  return [...(state?.turns || [])].reverse().find((turn) => !currentTurn || Number(turn.turn || 0) < currentTurn)
    ?.tutorLearnerDagModel;
}

function compactPendingObjectiveSummary(state, context) {
  if (!context?.learnerText && !context?.classification && !context?.tutorLearnerDag?.model) return null;
  const turn = context.classification?.turn || {};
  const overall = context.classification?.overall || {};
  const assessment = context.tutorLearnerDag?.model?.assessment || {};
  const selection = context.registerSelection || {};
  const bottleneck = plainInterimBottleneck(assessment.bottleneck || turn.pedagogical_need || 'awaiting analysis');
  const register = selection.selected_register
    ? `style led by ${selection.selected_register}`
    : 'style still being chosen';
  const target =
    selection.expected_dag_move ||
    overall.next_best_tutor_move ||
    turn.pedagogical_need ||
    'choose one learner-owned next move';
  const due = currentReleaseRows(state, context.tutorTurn).map((row) => row.premise);
  return [
    `turn ${context.tutorTurn || '?'}`,
    `focus: ${oneLine(bottleneck, { max: 54 })}`,
    register,
    due.length ? `${due.length} new clue${due.length === 1 ? '' : 's'} available now` : null,
    `aim: ${oneLine(plainStrategyText(target), { max: 76 })}`,
  ]
    .filter(Boolean)
    .join(' | ');
}

function compactPendingLearnerSummary(context) {
  if (!context?.learnerText && !context?.classification) return null;
  const turn = context.classification?.turn || {};
  const overall = context.classification?.overall || {};
  const scores = turn.scores || {};
  const move = String(turn.discourse_move || 'still being read').replaceAll('_', ' ');
  const stance = String(turn.epistemic_stance || 'still being read').replaceAll('_', ' ');
  const need = turn.pedagogical_need || overall.next_best_tutor_move || '';
  const bits = [
    `turn ${context.tutorTurn || '?'}`,
    `${move}; ${stance}`,
    `conceptual engagement ${interimLevel(Number(scoreValue(scores.conceptual_engagement)) / 5)}`,
    `evidence awareness ${interimLevel(Number(scoreValue(scores.epistemic_readiness)) / 5)}`,
  ];
  if (need) bits.push(`needs: ${oneLine(plainStrategyText(need), { max: 62 })}`);
  if (!context.classification && context.learnerText) bits.push(oneLine(context.learnerText, { max: 72 }));
  return bits.join(' | ');
}

function compactPendingLearnerDagSummary(context) {
  const model = context?.tutorLearnerDag?.model || context?.tutorLearnerDagModel || null;
  if (!model) return null;
  const metrics = model.metrics || {};
  const assessment = model.assessment || {};
  const missing = metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0;
  return [
    `turn ${model.turn || context.tutorTurn || '?'}`,
    `${metrics.groundedCount || 0} public facts held`,
    `${metrics.voicedDerivedCount || 0} inferences stated`,
    `${missing} evidence pieces still needed`,
    plainInterimBottleneck(assessment.bottleneck),
  ].join(' | ');
}

function compactPendingDagMovementSummary(state, context) {
  const model = context?.tutorLearnerDag?.model || context?.tutorLearnerDagModel || null;
  if (!model) return null;
  const previous = previousLearnerDagModel(state, context);
  const currentFeatures = dagProgressFeatures(model);
  const previousFeatures = dagProgressFeatures(previous);
  const coverageDelta = formatSignedInterimNumber(currentFeatures.bestPathCoverage - previousFeatures.bestPathCoverage);
  const groundedDelta = currentFeatures.groundedCount - previousFeatures.groundedCount;
  const voicedDelta = currentFeatures.voicedDerivedCount - previousFeatures.voicedDerivedCount;
  const answersDelta = currentFeatures.answerCandidateCount - previousFeatures.answerCandidateCount;
  const missingDelta = currentFeatures.missingPremiseCount - previousFeatures.missingPremiseCount;
  const deltas = [
    coverageDelta ? `path coverage ${coverageDelta}` : null,
    groundedDelta
      ? `${Math.abs(groundedDelta)} public fact${Math.abs(groundedDelta) === 1 ? '' : 's'} ${groundedDelta > 0 ? 'added' : 'lost'}`
      : null,
    voicedDelta
      ? `${Math.abs(voicedDelta)} inference${Math.abs(voicedDelta) === 1 ? '' : 's'} ${voicedDelta > 0 ? 'added' : 'lost'}`
      : null,
    answersDelta
      ? `${Math.abs(answersDelta)} answer candidate${Math.abs(answersDelta) === 1 ? '' : 's'} ${answersDelta > 0 ? 'added' : 'removed'}`
      : null,
    missingDelta
      ? `${Math.abs(missingDelta)} needed piece${Math.abs(missingDelta) === 1 ? '' : 's'} ${missingDelta < 0 ? 'resolved' : 'added'}`
      : null,
  ].filter(Boolean);
  const assessment = model.assessment || {};
  return [
    `turn ${model.turn || context.tutorTurn || '?'}`,
    deltas.length ? deltas.join(', ') : 'no clear reasoning movement yet',
    assessment.finalSecretEntailed
      ? 'the conclusion is supported'
      : assessment.assertedSecret
        ? 'the conclusion was stated too early'
        : 'the conclusion remains open',
  ].join(' | ');
}

function compactLearnerRecordUpdateSummary(state, context) {
  const result = context?.tutorLearnerDag;
  if (!result?.accepted && !result?.rejected?.length) return null;
  const accepted = result.accepted || {};
  const adopted = (accepted.adopt || []).join(',') || null;
  const retracted = (accepted.retract || []).join(',') || null;
  const derived = (accepted.derive || []).map((fact) => oneLine(factSurface(state.world, fact), { max: 34 }));
  const rejected = result.rejected?.length || 0;
  const bits = [
    `turn ${context.tutorTurn || result.model?.turn || '?'}`,
    adopted ? `${accepted.adopt.length} evidence piece${accepted.adopt.length === 1 ? '' : 's'} accepted` : null,
    retracted ? `${accepted.retract.length} evidence piece${accepted.retract.length === 1 ? '' : 's'} withdrawn` : null,
    derived.length ? `new inference: ${derived.slice(0, 2).join('; ')}` : null,
    accepted.hypothesis ? `working idea: ${oneLine(accepted.hypothesis, { max: 52 })}` : null,
    accepted.assertAnswer ? `proposed answer: ${accepted.assertAnswer}` : null,
    rejected ? `${rejected} unsupported update${rejected === 1 ? '' : 's'} ignored` : null,
  ].filter(Boolean);
  return bits.length > 1 ? bits.join(' | ') : null;
}

function compactPendingRegisterSummary(context) {
  const selection = context?.registerSelection;
  const efficacy = context?.previousRegisterEfficacy;
  if (!selection && !efficacy) return null;
  const bits = [];
  if (selection) {
    const blend = formatEngagementStanceDistribution(selection.distribution, { limit: 4 });
    bits.push(blend ? `blend ${blend}` : `led by ${selection.selected_register || 'unknown'}`);
    if (selection.actorial_part_label || selection.actorial_part) {
      bits.push(`playing ${oneLine(selection.actorial_part_label || displayDiagnosticLabel(selection.actorial_part), { max: 42 })}`);
    }
    if (selection.actorial_performance?.label) {
      bits.push(`through ${oneLine(selection.actorial_performance.label, { max: 32 })}`);
    }
    if (selection.expected_field_move)
      bits.push(`aim: ${oneLine(plainStrategyText(selection.expected_field_move), { max: 68 })}`);
  }
  if (efficacy) {
    const result =
      efficacy.label === 'positive_progress'
        ? 'helped'
        : efficacy.label === 'regression_or_overreach'
          ? 'hurt progress'
          : 'had no clear effect yet';
    bits.push(`last ${efficacy.selected_register || 'style'} ${result}`);
    if (efficacy.learnerFeedback?.rating) {
      bits.push(`learner rated it ${efficacy.learnerFeedback.rating === 'up' ? 'helpful' : 'not helpful'}`);
    }
  }
  return bits.join(' | ');
}

function currentReleaseRows(state, tutorTurn) {
  const world = state?.world;
  if (!world || !Number.isFinite(Number(tutorTurn))) return [];
  const pointOfAction = state?.pointOfAction?.current || null;
  if (
    Number(pointOfAction?.turn) === Number(tutorTurn) &&
    pointOfAction?.compiled_constraint?.suppress_new_premise === true
  ) {
    return [];
  }
  const snapshot = tutorStubReleasePacingSnapshot(state?.releasePacing, world);
  const dueIds = snapshot
    ? snapshot.turn === Number(tutorTurn) && snapshot.dueNow.length
      ? snapshot.dueNow
      : snapshot.schedule
          .filter(
            (entry) =>
              Number(entry.effectiveTurn) === Number(tutorTurn) &&
              (entry.releasedTurn === null || entry.releasedTurn === undefined),
          )
          .map((entry) => entry.premise)
    : world.releaseSchedule
        .filter((entry) => Number(entry.turn) === Number(tutorTurn))
        .map((entry) => entry.premise);
  return dueIds.map((premiseId) => {
    const premise = world.premiseById.get(premiseId);
    const release = world.releaseSchedule.find((entry) => entry.premise === premiseId);
    return {
      premise: premiseId,
      turn: Number(tutorTurn),
      via: release?.via || null,
      presentation: release?.presentation || null,
      role: release?.role || null,
      cue: release?.cue || null,
      surface: String(premise?.surface || '').trim(),
      fact: premise?.fact || null,
    };
  });
}

function committedReleaseRows(state, throughTurn = Number.POSITIVE_INFINITY) {
  const world = state?.world;
  if (!world) return [];
  const snapshot = tutorStubReleasePacingSnapshot(state?.releasePacing, world);
  if (!snapshot) return stagedEvidenceRows(world, throughTurn);
  return snapshot.schedule
    .filter(
      (entry) =>
        entry.releasedTurn !== null &&
        entry.releasedTurn !== undefined &&
        Number.isFinite(Number(entry.releasedTurn)) &&
        Number(entry.releasedTurn) <= Number(throughTurn),
    )
    .map((entry) => {
      const premise = world.premiseById.get(entry.premise);
      return {
        premise: entry.premise,
        turn: Number(entry.releasedTurn),
        via: entry.via || null,
        surface: String(premise?.surface || '').trim(),
        fact: premise?.fact || null,
      };
    });
}

function publicReleaseLedger(state, throughTurn = Number.POSITIVE_INFINITY) {
  return committedReleaseRows(state, throughTurn).map((row) => ({
    turn: row.turn,
    premiseId: row.premise,
    via: row.via,
  }));
}

function learnerPublicEvidenceState(state, tutorTurn) {
  const staged = committedReleaseRows(state, tutorTurn);
  return {
    publicStagedEvidence: staged,
    publicReleaseLedger: staged,
  };
}

function learnerDagPreflightForTurn(state, tutorTurn, { traceSource = null } = {}) {
  if (!state?.learnerDag?.enabled || !state.world) return null;
  const publicEvidence = learnerPublicEvidenceState(state, tutorTurn);
  const preflight = buildTutorStubLearnerDagPreflight({
    world: state.world,
    record: state.learnerDag.record,
    tutorTurn,
    publicStagedEvidence: publicEvidence.publicStagedEvidence,
  });
  if (traceSource) {
    appendTraceEvent(state.trace, {
      type: 'learner_dag_preflight',
      turn: tutorTurn,
      source: traceSource,
      timing: 'before_model_call',
      preflight,
    });
  }
  return preflight;
}

function nextReleaseRow(state) {
  const world = state?.world;
  if (!world) return null;
  const snapshot = tutorStubReleasePacingSnapshot(state?.releasePacing, world);
  const next = snapshot?.nextRelease || null;
  if (!next) return null;
  const premise = world.premiseById.get(next.premise);
  return {
    premise: next.premise,
    turn: Number(next.effectiveTurn),
    authoredTurn: Number(next.authoredTurn),
    via: next.via || null,
    surface: String(premise?.surface || '').trim(),
    fact: premise?.fact || null,
  };
}

function compactEvidenceTimingSummary(state, context) {
  const world = state?.world;
  const tutorTurn = Number(context?.tutorTurn || (state?.turns?.length || 0) + 1);
  if (!world || !Number.isFinite(tutorTurn)) return null;
  const dueNow = currentReleaseRows(state, tutorTurn);
  const next = nextReleaseRow(state);
  const last = committedReleaseRows(state, tutorTurn).at(-1) || null;
  const dueSummary = dueNow.length
    ? `available now: ${oneLine(dueNow[0].surface, { max: 78 })}`
    : last
      ? 'no new evidence this turn; earlier evidence remains available'
      : 'no case evidence has been introduced yet';
  const nextSummary = next
    ? `next new clue is planned for turn ${next.turn} from the ${next.via === 'director' ? 'scene' : 'tutor'}`
    : 'all planned clues are available';
  return `turn ${tutorTurn} | ${dueSummary} | ${nextSummary}`;
}

function compactPendingTutorDagSummary(state, context) {
  const snapshot =
    context?.tutorDagSnapshot || buildTutorDagSnapshot(state, context?.tutorTurn || state?.turns?.length + 1);
  if (!snapshot) return null;
  const next = snapshot.nextRelease
    ? `next clue planned for turn ${snapshot.nextRelease.turn}`
    : 'all planned clues are available';
  return `turn ${snapshot.turn} | ${snapshot.leavesReleased} of ${snapshot.leavesTotal} key clues revealed | ${next}`;
}

function compactPendingFieldSummary(state, context) {
  if (!context?.classification && !context?.tutorLearnerDag?.model) return null;
  const completedField = buildLightweightDialogueField(state?.turns || []);
  const previous = completedField.rows.at(-1) || null;
  const pendingTurn = {
    turn: context.tutorTurn || (state?.turns?.length || 0) + 1,
    learner: context.learnerText || '',
    classification: context.classification || null,
    tutorLearnerDagModel: context.tutorLearnerDag?.model || null,
    registerSelection: context.registerSelection || null,
    previousRegisterEfficacy: context.previousRegisterEfficacy || null,
    tutor: '',
    tutorDag:
      context.tutorDagSnapshot || buildTutorDagSnapshot(state, context.tutorTurn || (state?.turns?.length || 0) + 1),
  };
  const row = lightweightFieldTurn(pendingTurn, previous);
  return [
    `turn ${row.turn}`,
    `learner understanding ${interimLevel(row.learnerMastery)}`,
    `pressure ${interimLevel(row.learnerRisk)}`,
    `tutor fit ${interimLevel(row.tutorAlignment)}`,
    `momentum ${interimLevel(row.jointMomentum)}`,
    plainInterimBottleneck(row.bottleneck),
  ].join(' | ');
}

function compactInterimPanels(active) {
  const context = active.context || {};
  const panels = [
    { label: 'Tutor focus', tone: 'focus', text: compactPendingObjectiveSummary(active.state, context) },
    { label: 'Dialogue outlook', tone: 'progress', text: compactPendingFieldSummary(active.state, context) },
    { label: 'Reasoning change', tone: 'progress', text: compactPendingDagMovementSummary(active.state, context) },
    { label: 'Learner reasoning', tone: 'learner', text: compactLearnerRecordUpdateSummary(active.state, context) },
    { label: 'Evidence pacing', tone: 'evidence', text: compactEvidenceTimingSummary(active.state, context) },
    { label: 'Learner reading', tone: 'learner', text: compactPendingLearnerSummary(context) },
    { label: 'Reasoning state', tone: 'progress', text: compactPendingLearnerDagSummary(context) },
    { label: 'Tutor style', tone: 'focus', text: compactPendingRegisterSummary(context) },
    { label: 'Clue progress', tone: 'evidence', text: compactPendingTutorDagSummary(active.state, context) },
    { label: 'Dialogue so far', tone: 'progress', text: compactInterimFieldSummary(active.state) },
  ].filter((panel) => panel.text);
  return panels.length
    ? panels
    : [{ label: 'Active checks', tone: 'neutral', text: compactInterimStateSummary(active.state) }];
}

function interimToneColor(tone) {
  if (tone === 'progress') return C.green;
  if (tone === 'evidence') return C.yellow;
  if (tone === 'learner') return C.cyan;
  if (tone === 'focus') return C.magenta;
  return C.dim;
}

function renderInterimStatus(active) {
  active.tick += 1;
  const frame = INTERIM_FRAMES[active.tick % INTERIM_FRAMES.length];
  const elapsed = ((Date.now() - active.startedAt) / 1000).toFixed(1).padStart(4);
  const width = Math.max(60, Math.min(output.columns || 140, 180) - 1);
  const panels = compactInterimPanels(active);
  const panelIndex = Math.floor(active.tick / 4) % panels.length;
  const panel = panels[panelIndex];
  const phase = oneLine(active.basePhase || active.phase, { max: 28 });
  const prefix = `${frame} ${phase} · ${elapsed}s · view ${panelIndex + 1}/${panels.length} | ${panel.label}: `;
  const panelText = oneLine(panel.text, { max: Math.max(12, width - prefix.length) });
  return [
    C.cyan,
    frame,
    ' ',
    C.bold,
    phase,
    C.reset,
    C.dim,
    ` · ${elapsed}s · `,
    C.reset,
    C.yellow,
    `view ${panelIndex + 1}/${panels.length}`,
    C.reset,
    C.dim,
    ' | ',
    C.reset,
    interimToneColor(panel.tone),
    panel.label,
    C.reset,
    `: ${panelText}`,
  ].join('');
}

function startInterimAnimation(state, phase, context = null) {
  const interim = getInterimState(state);
  stopInterimAnimation(interim, { clear: true });
  if (!interimAnimationAvailable(interim)) return null;

  interim.lastContext = context || null;
  const active = {
    state,
    context: context || {},
    phase,
    basePhase: phase,
    startedAt: Date.now(),
    tick: -1,
    interval: null,
    paused: false,
    rendered: false,
  };
  active.render = () => {
    if (active.paused) return;
    const rendered = `${renderInterimStatus(active)}${C.reset}`;
    if (active.state?.concurrentTerminal?.enabled) {
      active.state.concurrentTerminal.setStatus(rendered);
    } else {
      clearStatusLine();
      process.stdout.write(`${rendered}\r`);
    }
    active.rendered = true;
  };
  interim.active = active;
  active.render();
  active.interval = setInterval(active.render, 350);
  active.interval.unref?.();
  return active;
}

function stopInterimAnimation(holder, { clear = true } = {}) {
  const interim = getInterimState(holder);
  const active = interim?.active;
  if (!active) return false;
  if (active.interval) clearInterval(active.interval);
  interim.active = null;
  if (clear && active.rendered) {
    if (active.state?.concurrentTerminal?.enabled) active.state.concurrentTerminal.clearStatus();
    else clearStatusLine();
  }
  return true;
}

function buildTutorInterimContext({
  learnerText,
  state,
  classification = null,
  tutorLearnerDag = null,
  registerSelection = null,
  previousRegisterEfficacy = null,
}) {
  const tutorTurn = state.turns.length + 1;
  return {
    learnerText,
    tutorTurn,
    classification,
    tutorLearnerDag,
    registerSelection,
    previousRegisterEfficacy,
    tutorDagSnapshot: buildTutorDagSnapshot(state, tutorTurn),
    humanDiscourseFrame: buildHumanDiscourseFrame({
      state,
      tutorTurn,
      tutorLearnerDag,
      classification,
      learnerText,
    }),
  };
}

function pauseInterimAnimation(holder) {
  const interim = getInterimState(holder);
  const active = interim?.active;
  if (!active || active.paused) return false;
  if (active.interval) clearInterval(active.interval);
  active.interval = null;
  active.paused = true;
  if (active.rendered) {
    if (active.state?.concurrentTerminal?.enabled) active.state.concurrentTerminal.clearStatus();
    else clearStatusLine();
  }
  return true;
}

function resumeInterimAnimation(holder) {
  const interim = getInterimState(holder);
  const active = interim?.active;
  if (!active || !active.paused || !interimAnimationAvailable(interim)) return false;
  active.paused = false;
  active.render();
  active.interval = setInterval(active.render, 350);
  active.interval.unref?.();
  return true;
}

function captureTraceProvenance(metadata) {
  // Step 0.2 of PRECONSCIOUS-FINAL-STRETCH-PLAN.md: every run header carries
  // the commit and a hash of the resolved configuration, so model/config
  // drift is detectable from the trace alone (the terra flag-forwarding
  // incident was only caught by cross-checking run_start metadata by hand).
  // Failure-tolerant: an unreadable git state must never block the CLI.
  const provenance = { schema: 'machinespirits.tutor-stub.run-provenance.v1', configSha256: null, git: null };
  try {
    provenance.configSha256 = hashCanonicalJson(metadata ?? null);
  } catch (error) {
    provenance.configHashError = String(error?.message || error);
  }
  try {
    provenance.git = captureGitProvenanceSummary({ repoRoot: ROOT });
  } catch (error) {
    provenance.gitError = String(error?.message || error);
  }
  return provenance;
}

function createTraceState({ enabled, traceDir, metadata }) {
  if (!enabled) return { enabled: false };
  const dir = resolveWorkspacePath(traceDir);
  const runId = safeTimestampForFile();
  const filePath = path.join(dir, `${runId}.jsonl`);
  fs.mkdirSync(dir, { recursive: true });
  const trace = {
    enabled: true,
    dir,
    filePath,
    runId,
    seq: 0,
  };
  appendTraceEvent(trace, {
    type: 'run_start',
    metadata: { ...(metadata || {}), provenance: captureTraceProvenance(metadata) },
  });
  return trace;
}

function appendTraceEvent(trace, event) {
  if (!trace?.enabled) return;
  const entry = {
    ts: new Date().toISOString(),
    runId: trace.runId,
    seq: ++trace.seq,
    ...event,
  };
  if (!entry.turnId && entry.turn !== undefined && entry.turn !== null) {
    entry.turnId = formatTurnDebugId(trace.runId, entry.turn);
  } else if (!entry.turnId && entry.type === 'tutor_opening') {
    entry.turnId = openingDebugId(trace.runId);
  }
  fs.appendFileSync(trace.filePath, `${JSON.stringify(redactTraceSecrets(entry))}\n`);
}

function stateRunDebugId(state) {
  return state?.debugRunId || state?.trace?.runId || 'no-trace';
}

function turnDebugId(state, turn) {
  return formatTurnDebugId(stateRunDebugId(state), turn);
}

function printDebugIdLine(state, id, label = 'turn id') {
  if (!id) return null;
  if (!state.printedDebugIds) state.printedDebugIds = new Set();
  if (state.printedDebugIds.has(id)) return id;
  state.printedDebugIds.add(id);
  console.log(`${C.cyan}${label} >${C.reset} ${id}`);
  return id;
}

function automaticTechnicalDetailsEnabled(state) {
  return Boolean(state?.explanatoryDebug?.enabled && state.explanatoryDebug.format === 'technical');
}

function printTurnDebugLine(state, turn) {
  if (!automaticTechnicalDetailsEnabled(state)) return null;
  return printDebugIdLine(state, turnDebugId(state, turn), 'turn id');
}

function printOpeningDebugLine(state) {
  if (!automaticTechnicalDetailsEnabled(state)) return null;
  return printDebugIdLine(state, openingDebugId(stateRunDebugId(state)), 'turn id');
}

function printAutomaticTechnicalDetails(state, render) {
  if (!automaticTechnicalDetailsEnabled(state)) return false;
  printWithConcurrentTerminal(state, render);
  return true;
}

function printCurrentDebugId(state, { duringTurn = false } = {}) {
  const last = state?.turns?.at(-1) || null;
  const completedId = last?.turnId || (state?.history?.length ? openingDebugId(stateRunDebugId(state)) : null);
  const activeId = duringTurn ? turnDebugId(state, (last?.turn || 0) + 1) : null;
  const runId = stateRunDebugId(state);
  const selectedId = activeId || completedId || runId;
  const tracePath = state?.trace?.filePath || null;
  const clipboardText = formatTutorStubDebugClipboardText({
    runId,
    selectedId,
    completedId,
    activeId,
    tracePath,
  });
  const clipboard = copyTutorStubTextToClipboard(clipboardText);
  console.log(`${C.cyan}debug id >${C.reset} ${selectedId}`);
  console.log(`${C.dim}  run id: ${runId}${C.reset}`);
  if (last) console.log(`${C.dim}  last completed turn: ${last.turnId || turnDebugId(state, last.turn)}${C.reset}`);
  if (activeId) console.log(`${C.dim}  in-progress turn: ${activeId}${C.reset}`);
  console.log(
    `${C.dim}  trace: ${tracePath || 'disabled for this run; rerun without --no-trace for a local JSONL trace'}${C.reset}`,
  );
  console.log(
    clipboard.copied
      ? `${C.green}  copied this diagnostic block to the clipboard${C.reset}\n`
      : `${C.dim}  clipboard unavailable; select this block to copy it into Codex${C.reset}\n`,
  );
  return { runId, completedId, activeId, tracePath, clipboard };
}

function redactTraceSecrets(value, ancestors = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return /^sk-[A-Za-z0-9_-]{12,}/u.test(value) ? '[redacted]' : value;
  }
  if (typeof value !== 'object') return value;
  if (ancestors.has(value)) return '[circular]';
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => redactTraceSecrets(item, ancestors));
    const redacted = {};
    for (const [key, nested] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, '');
      if (
        ['apikey', 'authorization', 'bearer', 'secret', 'password', 'accesstoken', 'refreshtoken'].includes(
          normalizedKey,
        )
      ) {
        redacted[key] = '[redacted]';
      } else {
        redacted[key] = redactTraceSecrets(nested, ancestors);
      }
    }
    return redacted;
  } finally {
    ancestors.delete(value);
  }
}

function traceDisplayPath(trace) {
  if (!trace?.enabled) return null;
  return path.relative(ROOT, trace.filePath);
}

function jsonClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function abortTutorStubTurnAttempt(message = 'learner turn attempt was superseded') {
  const error = new Error(message);
  error.name = 'AbortError';
  error.code = 'TUTOR_STUB_TURN_SUPERSEDED';
  return error;
}

function assertTutorStubTurnAttemptCurrent({ signal = null, isCurrent = null } = {}) {
  if (signal?.aborted || (typeof isCurrent === 'function' && !isCurrent())) {
    throw abortTutorStubTurnAttempt();
  }
}

function readTraceEvents(filePath) {
  const events = [];
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') events.push(parsed);
    } catch (_) {
      // Ignore damaged trace lines; the next valid event may still be useful.
    }
  }
  return events;
}

function dialogueTurnsFromTraceEvents(events) {
  const turns = [];
  for (const event of events) {
    if (event?.type === 'history_clear') {
      turns.length = 0;
      continue;
    }
    if (event?.type !== 'turn_complete' || !event.turnRecord) continue;
    turns.push(jsonClone(event.turnRecord));
  }
  return turns;
}

function latestDialogueTrace(traceDir) {
  const dir = resolveWorkspacePath(traceDir);
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(dir, name))
    .filter((filePath) => fs.statSync(filePath).isFile())
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const { filePath } of files) {
    const events = readTraceEvents(filePath);
    const turns = dialogueTurnsFromTraceEvents(events);
    if (!turns.length) continue;
    const metadata = events.find((event) => event?.type === 'run_start')?.metadata || null;
    return { filePath, metadata, turns, events };
  }
  return null;
}

function restoreRegisterStateFromTurns(state, turns) {
  if (!state.register?.enabled) return { restored: 0 };
  const byTurn = new Map();
  for (const turn of turns) {
    if (!turn?.registerSelection) continue;
    const selection = jsonClone(turn.registerSelection);
    const key = Number(selection.turn || turn.turn);
    if (!Number.isFinite(key)) continue;
    byTurn.set(key, selection);
  }
  for (const turn of turns) {
    const efficacy = turn?.previousRegisterEfficacy;
    const key = Number(efficacy?.registerTurn);
    if (!Number.isFinite(key) || !byTurn.has(key)) continue;
    const selection = byTurn.get(key);
    if (!selection.efficacy) selection.efficacy = jsonClone(efficacy);
  }
  state.register.history = [...byTurn.values()].sort((a, b) => Number(a.turn || 0) - Number(b.turn || 0));
  state.register.current = state.register.history[state.register.history.length - 1] || null;
  return { restored: state.register.history.length };
}

function restoreComprehensionState(state, turns, events = []) {
  const eventSnapshot = [...events]
    .reverse()
    .find(
      (event) =>
        event?.comprehensionState || event?.state?.schema === 'machinespirits.tutor-stub.comprehension-side-state.v1',
    );
  const turnSnapshot = [...turns]
    .reverse()
    .map((turn) => turn?.comprehension?.afterTutor || turn?.comprehension?.state || null)
    .find(Boolean);
  const snapshot = eventSnapshot?.comprehensionState || eventSnapshot?.state || turnSnapshot || null;
  state.comprehension = createTutorStubComprehensionState(snapshot);
  return {
    restored: Boolean(snapshot),
    terms: state.comprehension.terms.length,
  };
}

function typedActionDecisionFromTurn(turn) {
  const candidates = [
    turn?.typedActionDecision,
    turn?.typed_action_decision,
    turn?.registerSelection?.typed_action_decision,
  ];
  return candidates.find((candidate) => candidate && typeof candidate === 'object' && candidate.contract_id) || null;
}

function restoreTypedActionState(state, turns, events = []) {
  if (!state.typedActions?.enabled) {
    return { enabled: false, restored: false, ledgerRecords: 0, pendingContractId: null, phase: null };
  }
  const lastClear = events.reduce(
    (index, event, candidate) => (event?.type === 'history_clear' ? candidate : index),
    -1,
  );
  const activeEvents = events.slice(lastClear + 1);
  const records = new Map();
  const order = [];
  const decisions = new Map();
  let lifecycle = null;
  const rememberRecord = (record) => {
    const contractId = record?.contract_id;
    if (!contractId) return;
    if (records.get(contractId)?.status === 'closed' && record.status !== 'closed') return;
    if (!records.has(contractId)) order.push(contractId);
    records.set(contractId, jsonClone(record));
  };
  const rememberDecision = (decision, pendingIntervention = null) => {
    const contractId = decision?.contract_id;
    if (!contractId || typeof decision !== 'object') return;
    decisions.set(contractId, jsonClone(decision));
    if (pendingIntervention?.contract_id === contractId) {
      rememberRecord(pendingIntervention);
      return;
    }
    if (!records.has(contractId) && decision.adaptation_contract?.contract_id === contractId) {
      rememberRecord(createPendingIntervention(decision.adaptation_contract));
    }
  };

  for (const event of activeEvents) {
    if (event?.type === 'tutor_typed_action_decision') {
      rememberDecision(event.decision, event.pendingIntervention);
    } else if (event?.type === 'tutor_typed_action_outcome_closed') {
      rememberRecord(event.outcome?.closed_record);
    } else if (event?.type === 'tutor_scaffold_lifecycle_transition' && event.lifecycle) {
      lifecycle = jsonClone(event.lifecycle);
    }
  }
  for (const turn of turns) {
    const decision = typedActionDecisionFromTurn(turn);
    if (decision) rememberDecision(decision);
    const closedRecord =
      turn?.typedActionOutcomeAfterNextLearner?.closed_record || turn?.typedActionPriorOutcome?.closed_record || null;
    if (closedRecord) rememberRecord(closedRecord);
  }

  const ledger = order.map((contractId) => records.get(contractId)).filter(Boolean);
  const pending = ledger.filter((record) => record.status === 'pending');
  if (pending.length > 1) {
    throw new Error(
      `resume typed-action trace has multiple pending interventions: ${pending.map((record) => record.contract_id).join(', ')}`,
    );
  }
  const pendingContractId = pending[0]?.contract_id || null;
  const currentDecision = pendingContractId ? decisions.get(pendingContractId) || null : null;
  if (pendingContractId && !currentDecision) {
    throw new Error(`resume typed-action trace is missing decision provenance for ${pendingContractId}`);
  }

  lifecycle =
    lifecycle ||
    [...turns]
      .reverse()
      .map((turn) => turn?.scaffoldLifecycle || null)
      .find(Boolean) ||
    createScaffoldLifecycle();
  if (pendingContractId && !lifecycle.pending_contract_id && currentDecision) {
    lifecycle = advanceScaffoldLifecycle(createScaffoldLifecycle(), {
      kind: 'typed_action_decision',
      turn: currentDecision.chosen_action?.turn || currentDecision.adaptation_contract?.turn_index || null,
      decision: currentDecision,
    }).lifecycle;
  }
  validateScaffoldLifecycle(lifecycle);
  if (pendingContractId && lifecycle.pending_contract_id !== pendingContractId) {
    throw new Error(
      `resume typed-action lifecycle pending contract ${lifecycle.pending_contract_id || 'none'} does not match ledger ${pendingContractId}`,
    );
  }
  if (!pendingContractId && lifecycle.pending_contract_id) {
    throw new Error(
      `resume typed-action lifecycle has orphaned pending contract ${lifecycle.pending_contract_id} without a ledger record`,
    );
  }
  state.typedActions.ledger = ledger;
  state.typedActions.currentDecision = currentDecision;
  state.typedActions.scaffoldLifecycle = lifecycle;
  return {
    enabled: true,
    restored: Boolean(ledger.length || currentDecision || lifecycle.transition_count),
    ledgerRecords: ledger.length,
    closedRecords: ledger.filter((record) => record.status === 'closed').length,
    pendingContractId,
    currentActionType: currentDecision?.chosen_action?.action_type || null,
    phase: lifecycle.phase,
    lifecycleTransitions: lifecycle.transition_count,
  };
}

function replayLearnerDagFromTurns(state, turns) {
  if (!state.learnerDag?.enabled || !state.world) return { replayed: 0, skipped: 0 };
  let replayed = 0;
  let skipped = 0;
  for (const turn of turns) {
    const accepted = turn?.tutorLearnerDagUpdate?.accepted;
    if (accepted) {
      const result = applyLearnerRecordUpdate({
        update: {
          adopt: accepted.adopt || [],
          retract: accepted.retract || [],
          derive: accepted.derive || [],
          hypothesis: accepted.hypothesis || null,
          assert_answer: accepted.assertAnswer || null,
          human_discourse: accepted.humanDiscourse || null,
        },
        state,
        tutorTurn: Number(turn.turn) || replayed + 1,
        learnerText: turn.learner || '',
        dropoutReplay: turn?.dagFactDropout || turn?.tutorLearnerDagUpdate?.dagFactDropout || { legacyNoDropout: true },
        ...learnerPublicEvidenceState(state, Number(turn.turn) || replayed + 1),
      });
      state.learnerDag.lastModel = result.model;
      replayed += 1;
      continue;
    }
    if (turn?.tutorLearnerDagModel) {
      state.learnerDag.lastModel = jsonClone(turn.tutorLearnerDagModel);
      skipped += 1;
    }
  }
  return { replayed, skipped };
}

function restoreDialogueFromTrace(state, resume, { currentWorld }) {
  if (!resume?.turns?.length) return null;
  const turns = resume.turns.map((turn) => jsonClone(turn));
  state.turns = turns;
  state.history = [];
  for (const turn of turns) {
    if (turn.learner) state.history.push({ role: 'user', content: turn.learner });
    if (turn.tutor) state.history.push({ role: 'assistant', content: turn.tutor });
  }

  const register = restoreRegisterStateFromTurns(state, turns);
  const comprehension = restoreComprehensionState(state, turns, resume.events || []);
  const learnerDag = replayLearnerDagFromTurns(state, turns);
  const typedActions = restoreTypedActionState(state, turns, resume.events || []);
  const storedClosure = turns.at(-1)?.dialogueClosure?.lifecycle || null;
  if (storedClosure && state.dialogueClosure?.enabled) {
    state.dialogueClosure = {
      ...state.dialogueClosure,
      ...jsonClone(storedClosure),
      enabled: true,
      allowCheckIn: state.dialogueClosure.allowCheckIn,
      allowAuthoredDagClosure: state.dialogueClosure.allowAuthoredDagClosure,
    };
  } else if (state.dialogueClosure?.enabled && turns.length) {
    const last = turns.at(-1);
    const frame = buildTutorStubDialogueClosureFrame({
      lifecycle: state.dialogueClosure,
      learnerDagModel: last?.tutorLearnerDagModel || null,
      tutorDagSnapshot: last?.tutorDag || null,
      answerTerm: answerTermForWorld(state.world),
    });
    const audit = auditTutorStubDialogueClosureResponse({ text: last?.tutor || '', frame });
    if (audit.ok && audit.closesDialogue) {
      state.dialogueClosure = advanceTutorStubDialogueClosure(state.dialogueClosure, {
        frame,
        audit,
        turn: last.turn,
      });
    } else if (audit.closesDialogue && state.dialogueClosure.allowCheckIn) {
      state.dialogueClosure = {
        ...state.dialogueClosure,
        phase: 'awaiting_checkin',
        reachedAtTurn: Number(last.turn) || null,
        basis: frame.basis || 'legacy_conversational_closure',
      };
    }
  }
  const warnings = [];
  const resumedWorld = resume.metadata?.world?.id || null;
  if (resumedWorld && currentWorld?.id && resumedWorld !== currentWorld.id) {
    warnings.push(`trace world ${resumedWorld} differs from current world ${currentWorld.id}`);
  }
  return {
    source: resume.filePath,
    turns: turns.length,
    register,
    comprehension,
    learnerDag,
    typedActions,
    dialogueClosure: state.dialogueClosure,
    metadata: resume.metadata || null,
    warnings,
  };
}

function providerSupportsStreaming(resolved) {
  return Boolean(resolved?.provider && !isCliProvider(resolved.provider));
}

function providerSupportsEventStreaming(resolved) {
  return resolved?.provider === 'codex';
}

function streamLabel(role) {
  if (role === 'tutor_stub_tutor') return `${C.brightMagenta}${C.bold}tutor >${C.reset} `;
  if (role === 'tutor_stub_learner_analysis') return `${C.cyan}learner analysis stream >${C.reset} `;
  if (role === 'tutor_stub_learner_record') return `${C.cyan}learner DAG stream >${C.reset} `;
  if (role === 'tutor_stub_learner_classifier') return `${C.cyan}learner classifier stream >${C.reset} `;
  return `${C.cyan}${role} >${C.reset} `;
}

function createConsoleTokenSink(role, interim = null) {
  let started = false;
  let buffered = '';
  const terminal = getInterimState(interim)?.concurrentTerminal || null;
  return {
    write(token) {
      if (terminal?.enabled) {
        buffered += token;
        started = true;
        return;
      }
      if (!started) {
        stopInterimAnimation(interim);
        clearStatusLine();
        process.stdout.write(streamLabel(role));
        started = true;
      }
      process.stdout.write(token);
    },
    finish() {
      if (started && terminal?.enabled) {
        stopInterimAnimation(interim);
        terminal.print(() => process.stdout.write(`${streamLabel(role)}${buffered}\n`));
        return true;
      }
      if (started) process.stdout.write('\n');
      return started;
    },
  };
}

function replayTextAsConsoleStream(role, text, stream = null) {
  const sink = createConsoleTokenSink(role, stream?.interim || stream);
  const tokens = String(text || '').match(/\S+\s*/g) || [];
  for (const token of tokens) sink.write(token);
  return sink.finish();
}

function printTutorResponse(response, stream = null) {
  if (response.guardedStreamReplay) {
    response.streamed = replayTextAsConsoleStream('tutor_stub_tutor', response.text, stream);
    return;
  }
  if (!response.streamed) {
    console.log(`${C.brightMagenta}${C.bold}tutor >${C.reset} ${response.text.trim()}`);
  }
}

async function classifyForTurn(learnerText, state, { signal = null } = {}) {
  if (!state.classifier.enabled) return null;
  startInterimAnimation(state, 'classifying learner');
  const classification = await classifyLearnerInput({ learnerText, state, signal });
  stopInterimAnimation(state);
  printAutomaticTechnicalDetails(state, () => printClassification(classification));
  return classification;
}

function activeDramaturgyAct(world, tutorTurn) {
  const acts = world?.dramaturgy?.acts;
  if (!Array.isArray(acts)) return null;
  const turn = Number(tutorTurn);
  if (!Number.isFinite(turn)) return null;
  const act = acts.find((entry) => {
    const [start, end] = Array.isArray(entry?.turns) ? entry.turns.map(Number) : [];
    return Number.isFinite(start) && Number.isFinite(end) && turn >= start && turn <= end;
  });
  if (!act) return null;
  return {
    act: act.act || null,
    title: String(act.title || '').trim() || null,
    intent: String(act.intent || '').trim() || null,
    turns: Array.isArray(act.turns) ? act.turns : null,
  };
}

function branchTemplateForEvidence(row = {}, world = null, { conclusionReady = false } = {}) {
  return buildTutorStubWorldScaffold({ world, evidence: row, conclusionReady });
}

function scaffoldBranchForTurn({ state, world, tutorTurn, tutorLearnerDag }) {
  if (!world) return branchTemplateForEvidence({}, world);
  const dueNow = currentReleaseRows(state, tutorTurn);
  if (dueNow.length) return branchTemplateForEvidence(dueNow[0], world);
  const latestReleased = committedReleaseRows(state, tutorTurn).at(-1);
  const assessment = tutorLearnerDag?.model?.assessment || tutorLearnerDag?.assessment || {};
  if (assessment.finalSecretEntailed || assessment.bottleneck === 'assertion_gap') {
    return branchTemplateForEvidence(latestReleased || {}, world, { conclusionReady: true });
  }
  if (latestReleased) return branchTemplateForEvidence(latestReleased, world);
  // A scheduled-but-not-due clue belongs to the private planner. The public
  // scaffold must remain open until that clue is actually due or released.
  return branchTemplateForEvidence({}, world);
}

function compactReleaseRow(row = {}) {
  return {
    premise: row.premise || null,
    turn: row.turn ?? null,
    via: row.via || null,
    surface: oneLine(row.surface || '', { max: 220 }) || null,
  };
}

function compactFutureReleaseWindow(row = {}) {
  return {
    turn: row.turn ?? null,
    via: row.via || null,
  };
}

function buildScaffoldState({ state, tutorTurn, dagMode, tutorLearnerDag }) {
  const enabled = dagMode !== 'strict_dag';
  const world = state?.world || null;
  const dueNow = currentReleaseRows(state, tutorTurn);
  const released = committedReleaseRows(state, tutorTurn);
  const next = nextReleaseRow(state);
  const branch = scaffoldBranchForTurn({ state, world, tutorTurn, tutorLearnerDag });
  const modeNote =
    dagMode === 'defeasible_human_scaffold'
      ? 'Learner may make compressed local leaps; tutor carries obvious public bridges internally and surfaces proof debt only when it matters.'
      : dagMode === 'human_scaffold'
        ? 'Tutor frames one local warrant and permits ordinary-language reasoning while strict proof remains the audit.'
        : 'Strict audit mode; no scaffold adaptation.';
  return {
    schema: SCAFFOLD_STATE_SCHEMA,
    mode: dagMode,
    enabled,
    source: enabled ? 'dramaturgy_release_projection' : 'strict_dag_disabled',
    turn: tutorTurn,
    activeAct: activeDramaturgyAct(world, tutorTurn),
    branch,
    localQuestion: enabled ? branch.localQuestion : null,
    warrantFrame: enabled ? branch.warrantFrame : null,
    joinReminder: enabled ? branch.joinReminder : null,
    releaseState: {
      releasedCount: released.length,
      dueNow: dueNow.map(compactReleaseRow),
      latestReleased: released.at(-1) ? compactReleaseRow(released.at(-1)) : null,
      // The public scaffold needs to know only that a future gap exists. Its
      // premise id and surface remain owned by the deterministic planner.
      nextRelease: next ? compactFutureReleaseWindow(next) : null,
    },
    returnTarget: enabled
      ? {
          kind: dueNow.length
            ? 'current_release'
            : branch.id === 'world_conclusion_join'
              ? 'join_warrant'
              : 'local_branch_warrant',
          prompt: branch.localQuestion,
          afterSideArc: `Return to: ${branch.localQuestion}`,
        }
      : null,
    modeNote,
    status: enabled ? 'projected_from_dramaturgy' : 'not_enabled_strict_dag',
  };
}

function buildSideArcState({
  dagMode,
  classification = null,
  learnerText = '',
  scaffoldState = null,
  generousInference = null,
}) {
  if (generousInference?.applied) {
    return {
      schema: SIDE_ARC_SCHEMA,
      mode: dagMode,
      detected: false,
      type: null,
      status: 'contextual_answer_resolved',
      returnTarget: null,
      learnerNeed: 'Acknowledge the resolved local inference and advance.',
      reason: 'A high-confidence adjacent elliptical answer completed the current local move.',
    };
  }
  const turn = classification?.turn || {};
  const labels = [turn.request_type, turn.discourse_move, turn.epistemic_stance, turn.affect]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const text = String(learnerText || '').toLowerCase();
  let type = null;
  let reason = 'no side arc detected';
  if (/plain|simpl|clarif|what do you mean|old language|confus|translate|wording/u.test(`${labels} ${text}`)) {
    type = 'clarification_or_plain_language';
    reason = 'learner is asking for clarification, translation, or simpler wording';
  } else if (/challenge|authority_refusal|low_trust|why|how do we know|prove|smuggling/u.test(`${labels} ${text}`)) {
    type = 'warrant_challenge';
    reason = 'learner is challenging the warrant or the tutor authority behind it';
  } else if (/resistant|affective|frustrat|pressure|defensive|too much|lost/u.test(`${labels} ${text}`)) {
    type = 'affective_repair';
    reason = 'learner is signalling affective resistance, pressure, or loss of agency';
  } else if (/off_task|unrelated/u.test(labels)) {
    type = 'off_task_or_contextual';
    reason = 'learner moved away from the proof path';
  }
  return {
    schema: SIDE_ARC_SCHEMA,
    mode: dagMode,
    detected: Boolean(type),
    type,
    status: type ? 'active_return_required' : 'none',
    returnTarget: type ? scaffoldState?.returnTarget || null : null,
    learnerNeed: type ? turn.pedagogical_need || classification?.overall?.next_best_tutor_move || null : null,
    reason,
  };
}

function buildStrictDagAuditState(tutorLearnerDag) {
  const model = tutorLearnerDag?.model || tutorLearnerDag || null;
  const assessment = model?.assessment || {};
  const metrics = model?.metrics || {};
  return {
    enabled: Boolean(model),
    coverage: assessment.bestPathCoverage ?? null,
    bottleneck: assessment.bottleneck || null,
    finalSecretEntailed: assessment.finalSecretEntailed === true,
    assertedSecret: assessment.assertedSecret === true,
    assertedMirror: assessment.assertedMirror === true,
    unsupportedAssertionCount: Number(assessment.unsupportedAssertionCount || 0),
    missingPremiseCount: Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0),
    missingPremiseBuckets: assessment.missingPremiseBuckets || {},
  };
}

function publicStocktakeRows(rows = [], source = 'learner_record') {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      surface: String(row?.surface || row?.text || '').trim(),
      turn: Number.isFinite(Number(row?.turn)) ? Number(row.turn) : null,
      source,
    }))
    .filter((row) => row.surface);
}

function buildWarrantPremiseAudit({ dagMode, tutorLearnerDag, classification = null, learnerText = '', world = null }) {
  const model = tutorLearnerDag?.model || tutorLearnerDag || null;
  const record = model?.learnerRecord || {};
  const explicitWarrants = publicStocktakeRows(record.voicedDerived, 'voiced_derived_public_claim');
  const explicitPublicPremises = publicStocktakeRows(record.grounded, 'grounded_public_record');
  const extraction = normalizeHumanDiscourseExtraction(
    tutorLearnerDag?.accepted?.humanDiscourse || tutorLearnerDag?.extractor?.humanDiscourse,
  );
  const turn = classification?.turn || {};
  const overleap = /overleaps_evidence|distorts_public_evidence|overconfident|answer_seeking/iu.test(
    [turn.evidence_use, turn.epistemic_stance, turn.discourse_move].filter(Boolean).join(' '),
  );
  const heuristicMissingWarrants =
    overleap && explicitWarrants.length === 0
      ? [
          {
            surface: oneLine(learnerText, { max: 180 }),
            reason: 'classifier marked overreach or answer-seeking before an explicit public warrant was stored',
            source: 'heuristic_overleap',
          },
        ].filter((row) => row.surface)
      : [];
  const rejectedDebt = normalizeDiscourseRows(
    (tutorLearnerDag?.rejected || [])
      .filter((row) => row?.type === 'derive' || row?.type === 'assert' || row?.reason === 'not staged')
      .map((row) => ({
        surface: Array.isArray(row.value) ? factSurface(world, row.value) : String(row.value || ''),
        reason: row.reason || 'rejected by strict learner-DAG update',
      })),
    'strict_dag_rejection',
  );
  const proofDebtCandidates = [
    ...extraction.proofDebtCandidates,
    ...extraction.provisionalClaims
      .filter((row) => row.warrantNeeded)
      .map((row) => ({ ...row, reason: row.reason || row.warrantNeeded })),
    ...heuristicMissingWarrants,
    ...rejectedDebt,
  ];
  const strictProofAdoptions = [
    ...(tutorLearnerDag?.accepted?.adopt || []).map((premise) => ({
      surface: premise,
      source: 'strict_adopted_premise',
    })),
    ...(tutorLearnerDag?.accepted?.derive || []).map((fact) => ({
      surface: factSurface(world, fact),
      source: 'strict_derived_public_claim',
    })),
  ].filter((row) => row.surface);
  const proofStatus =
    model?.assessment?.finalSecretEntailed && model?.assessment?.assertedSecret
      ? 'strict_grounded_closure'
      : extraction.proofStatus !== 'unclear'
        ? extraction.proofStatus
        : proofDebtCandidates.length
          ? 'provisional_or_debt_open'
          : 'strict_or_open';
  return {
    schema: WARRANT_PREMISE_AUDIT_SCHEMA,
    mode: dagMode,
    phase: HUMAN_DISCOURSE_PHASE,
    proofStatus,
    status:
      dagMode === 'strict_dag'
        ? 'strict_audit_only'
        : extraction.illicitHiddenPremises.length || extraction.suppressedPremises.length
          ? 'hidden_or_suppressed_premise_risk'
          : proofDebtCandidates.length
            ? 'proof_debt_open'
            : 'current_turn_clean',
    warrants: {
      explicit: explicitWarrants,
      implied: extraction.impliedWarrants,
      missing: [...extraction.missingWarrants, ...heuristicMissingWarrants],
    },
    premises: {
      explicitPublic: explicitPublicPremises,
      impliedPublic: extraction.impliedPremises,
      suppressedOrPrivate: extraction.suppressedPremises,
      commonSenseBridges: extraction.commonSenseBridges,
      illicitHidden: extraction.illicitHiddenPremises,
    },
    provisionalClaims: extraction.provisionalClaims,
    proofDebtCandidates,
    strictProofAdoptions,
    extractionSideArc: extraction.sideArc,
    counts: {
      explicitWarrants: explicitWarrants.length,
      impliedWarrants: extraction.impliedWarrants.length,
      missingWarrants: extraction.missingWarrants.length + heuristicMissingWarrants.length,
      explicitPublicPremises: explicitPublicPremises.length,
      impliedPremises: extraction.impliedPremises.length,
      suppressedPremises: extraction.suppressedPremises.length,
      commonSenseBridges: extraction.commonSenseBridges.length,
      illicitHiddenPremises: extraction.illicitHiddenPremises.length,
      provisionalClaims: extraction.provisionalClaims.length,
      proofDebtCandidates: proofDebtCandidates.length,
      strictProofAdoptions: strictProofAdoptions.length,
    },
  };
}

function buildHumanDiscourseFrame({ state, tutorTurn, tutorLearnerDag, classification = null, learnerText = '' }) {
  const dagMode = state?.dagMode || 'strict_dag';
  const scaffoldState = buildScaffoldState({ state, tutorTurn, dagMode, tutorLearnerDag });
  const generousInference = resolveTutorStubGenerousInference({
    mode: dagMode,
    learnerText,
    previousTutorText: latestTutorMessage(state),
    branchId: scaffoldState.branch?.id || null,
    classification,
  });
  const sideArc = buildSideArcState({
    dagMode,
    classification,
    learnerText,
    scaffoldState,
    generousInference,
  });
  const warrantPremiseAudit = buildWarrantPremiseAudit({
    dagMode,
    tutorLearnerDag,
    classification,
    learnerText,
    world: state?.world || null,
  });
  const strictDag = buildStrictDagAuditState(tutorLearnerDag);
  const proofDebt = buildTutorStubProofDebtState({
    dagMode,
    warrantPremiseAudit,
    strictDag,
    classification,
    generousInference,
  });
  const questionSupport =
    dagMode === 'strict_dag'
      ? null
      : buildTutorStubQuestionSupport({
          tutorTurn,
          scaffoldState,
          assessment: tutorLearnerDag?.model?.assessment || tutorLearnerDag?.assessment || null,
          classification,
          learnerText,
          recentTurns: state?.turns || [],
          multipleChoice: Boolean(state?.multipleChoice),
        });
  return {
    schema: HUMAN_DISCOURSE_FRAME_SCHEMA,
    mode: dagMode,
    phase: HUMAN_DISCOURSE_PHASE,
    scaffoldActive: dagMode !== 'strict_dag',
    stepCompression: state?.humanDiscourse?.stepCompression || null,
    turn: tutorTurn,
    strictDag,
    scaffoldState,
    sideArc,
    proofDebt,
    questionSupport,
    warrantPremiseAudit,
    generousInference,
  };
}

function buildLearnerRecordPrompt({ learnerText, state, tutorTurn, dagPreflight = null }) {
  const staged = committedReleaseRows(state, tutorTurn);
  const comprehensionContext = tutorStubComprehensionPrompt(state.comprehension, { turn: tutorTurn });
  return [
    '# Task',
    '',
    'Extract a conservative public learner-record update from the current learner turn.',
    "This update feeds a tutor-side model of the learner DAG. It is not the learner's private state.",
    comprehensionContext || null,
    '',
    '# Public question',
    state.world.question,
    '',
    '# Public rules',
    ...state.world.rules.map(ruleText),
    '',
    dagPreflight ? '# Deterministic learner-DAG preflight — computed before this model call' : null,
    dagPreflight ? JSON.stringify(dagPreflight, null, 2) : null,
    dagPreflight
      ? 'This constrains possible updates but commits nothing. Extract only what the current learner turn actually expresses; deterministic validation follows this call.'
      : null,
    dagPreflight ? '' : null,
    '# Staged public evidence available at or before this turn',
    staged.length
      ? staged
          .map((row) => {
            return [
              `- ${row.premise} (staged turn ${row.turn} via ${row.via})`,
              `  surface: ${row.surface}`,
              `  fact: ${JSON.stringify(row.fact)}`,
            ].join('\n');
          })
          .join('\n')
      : '- none',
    '',
    '# Previous public transcript',
    compactPublicTranscriptForPrompt(state, state.historyTurns),
    '',
    '# Current learner turn',
    learnerText,
    '',
    '# Extraction rules',
    '',
    '- adopt: include only staged premise ids the learner explicitly accepts, uses, restates, or treats as evidence.',
    '- retract: include only staged premise ids the learner explicitly rejects or withdraws.',
    '- derive: include fact arrays only when the learner voices a conclusion supported by adopted/staged evidence and public rules.',
    '- Single-step trial-book rule: if the learner states a warranted conclusion from staged evidence, include both the supporting staged premise ids in adopt and the conclusion fact in derive. Do not require a separate "add it to the book" utterance.',
    '- Multi-premise advance: one learner turn may explicitly use several staged premises and may voice several supported intermediate conclusions. Return every warranted adoption and derivation in the order voiced; do not stop after the first valid proof move.',
    '- A follow-up premise supplied by the learner counts only when it is public and derivable from staged/adopted evidence plus the public rules. Never promote an unstaged story fact merely because it would accelerate the proof.',
    '- Resolve pronouns and elliptical answers against the immediately preceding tutor question. If a short reply such as "the same" unambiguously answers a single-referent local question, treat the resolved content as learner-voiced; do not require the learner to repeat the noun or name.',
    '- hypothesis: one short sentence if the learner offers a conjecture, uncertainty, or provisional theory.',
    '- assert_answer: the named answer candidate if the learner directly answers the public question; otherwise null.',
    '- human_discourse.proof_status: strict_proof, provisional_scaffold, side_arc, hidden_premise_risk, or unclear.',
    '- human_discourse.provisional_claims: claims the learner is allowed to hold provisionally before the strict proof is complete.',
    '- human_discourse.implied_warrants: inference rules the learner is using in ordinary language without spelling them out.',
    '- human_discourse.missing_warrants: warrants the learner needs before the claim counts as strict proof.',
    '- human_discourse.implied_public_premises: public assumptions suggested by the transcript but not yet stored as strict grounded premises.',
    '- human_discourse.suppressed_or_private_premises: premises the learner seems to rely on that are not public in the staged evidence.',
    '- human_discourse.common_sense_bridges: harmless everyday bridges that can be allowed provisionally but may need repair.',
    '- human_discourse.illicit_hidden_premises: any apparent use of hidden or unstaged story facts.',
    '- human_discourse.proof_debt_candidates: provisional leaps or missing warrants the tutor should keep visible for later repair.',
    '- human_discourse.side_arc: clarification, vocabulary, affective, trust, or off-path requests that should be answered briefly before returning to the proof path.',
    '- A wording-only or vocabulary-only clarification request is a non-DAG side-state: record it as a side arc, but do not adopt premises, derive facts, or assert an answer from the request itself.',
    '- Be conservative. Do not mark staged evidence adopted merely because it exists.',
    '',
    '# JSON schema',
    '',
    JSON.stringify(
      {
        adopt: ['premise_id'],
        retract: ['premise_id'],
        derive: [['predicate', 'arg1', 'arg2']],
        hypothesis: 'short hypothesis or null',
        assert_answer: 'candidate name or null',
        human_discourse: humanDiscourseExtractionSchema(),
        notes: 'brief reason for the extraction',
      },
      null,
      2,
    ),
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function buildCombinedLearnerAnalysisPrompt({
  learnerText,
  state,
  tutorTurn,
  dagPreflight = null,
  tutorFeedback = null,
}) {
  const { publicStagedEvidence } = learnerPublicEvidenceState(state, tutorTurn);
  return buildTutorStubPublicLearnerAnalysisPrompt({
    learnerText,
    topic: state.topic,
    world: state.world,
    tutorTurn,
    publicTranscript: compactPublicTranscriptForPrompt(state, state.historyTurns),
    // Completed turns already contain their tutor response. Only the first
    // learner analysis needs the opening assistant message supplied
    // separately, matching the benchmark's T0 -> L1 chronology without
    // duplicating later tutor turns.
    currentTutorText: state.turns.length === 0 ? latestTutorMessage(state) : '',
    historyTurns: state.historyTurns,
    comprehensionContext: tutorStubComprehensionPrompt(state.comprehension, { turn: tutorTurn }),
    learnerDagEnabled: Boolean(state.dag),
    registerPolicy: state.register?.policy || null,
    registerEnabled: Boolean(state.register?.enabled),
    registerPalette: state.register?.palette || [],
    registerContext: {
      requestTypeRegistryPrompt: requestTypePromptRows(),
      selectionPolicyPrompt: engagementStanceSelectionPolicyPrompt(state),
      palettePrompt: engagementStancePalettePromptRows(state.register?.palette || []),
      priorPublicLearnerDagPrompt: learnerDagPromptSummary(state.learnerDag.lastModel),
      historyPrompt: registerHistoryPromptSummary(state),
      feedbackPrompt: tutorStubTurnFeedbackRegisterPrompt(tutorFeedback),
    },
    publicStagedEvidence,
    dagPreflight,
  });
}
async function extractLearnerRecordUpdate({
  learnerText,
  state,
  tutorTurn,
  dagPreflight = null,
  signal = null,
}) {
  const prompt = buildLearnerRecordPrompt({ learnerText, state, tutorTurn, dagPreflight });
  const raw = await callPromptModel({
    prompt,
    resolved: state.learnerDag.resolved,
    systemPrompt: LEARNER_RECORD_SYSTEM_PROMPT,
    role: 'tutor_stub_learner_record',
    maxTokens: 700,
    trace: state.trace,
    stream: state.stream,
    cliEffort: state.cliEffort,
    turn: tutorTurn,
    signal,
  });
  const { parsed, parseError } = parseClassifierJson(raw.text);
  return {
    ...parsed,
    parseError,
    provider: raw.provider,
    model: raw.model,
    latencyMs: raw.latencyMs,
    usage: raw.usage,
  };
}

async function extractCombinedLearnerAnalysis({
  learnerText,
  state,
  tutorTurn,
  role = 'tutor_stub_learner_analysis',
  stream = state.stream,
  dagPreflight = null,
  preflightSource = 'combined_learner_analysis',
  tutorFeedback = null,
  signal = null,
}) {
  const effectiveDagPreflight =
    dagPreflight || learnerDagPreflightForTurn(state, tutorTurn, { traceSource: preflightSource });
  const prompt = buildCombinedLearnerAnalysisPrompt({
    learnerText,
    state,
    tutorTurn,
    dagPreflight: effectiveDagPreflight,
    tutorFeedback,
  });
  const raw = await extractTutorStubPublicLearnerAnalysis({
    learnerText,
    topic: state.topic,
    world: state.world,
    tutorTurn,
    prompt,
    dagPreflight: effectiveDagPreflight,
    callModel: callPromptModel,
    parseMode: TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES.INTERACTIVE,
    role,
    maxTokens: Math.max(2500, state.maxTokens || 0),
    modelCallOptions: {
      resolved: state.learnerDag.resolved,
      trace: state.trace,
      stream,
      cliEffort: state.cliEffort,
      signal,
    },
  });
  return {
    ...raw,
    dagPreflight: effectiveDagPreflight,
  };
}

function classificationFromCombinedAnalysis(raw, state) {
  const parsed = raw?.parsed || {};
  const source =
    parsed.classification ||
    parsed.learner_classification ||
    parsed.classifier ||
    (parsed.turn && parsed.overall ? parsed : null);

  if (!source) {
    return failedClassification({
      message: 'Combined learner analysis did not include a classification object.',
      resolved: state.learnerDag.resolved,
      latencyMs: raw?.latencyMs || 0,
      usage: raw?.usage,
    });
  }

  return {
    ...source,
    parseError: raw.parseError,
    provider: raw.provider,
    model: raw.model,
    latencyMs: raw.latencyMs,
    usage: raw.usage,
    combined: true,
  };
}

function learnerRecordFromCombinedAnalysis(raw) {
  const parsed = raw?.parsed || {};
  const source = parsed.learner_record || parsed.learnerRecord || parsed.public_record || parsed.record || {};
  return {
    ...source,
    parseError: raw.parseError,
    provider: raw.provider,
    model: raw.model,
    latencyMs: raw.latencyMs,
    usage: raw.usage,
    combined: true,
  };
}

function registerSelectionFromCombinedAnalysis(raw) {
  const parsed = raw?.parsed || {};
  return parsed.register_selection || parsed.registerSelection || parsed.tutor_register || parsed.register || null;
}

function evaluatePendingRegisterEfficacy(state, currentDagResult, classification = null, tutorFeedback = null) {
  if (!state.register?.enabled || !currentDagResult?.model) return null;
  const pending = [...state.register.history]
    .reverse()
    .find((entry) => !entry.efficacy && entry.turn < currentDagResult.model.turn);
  if (!pending) return null;
  pending.efficacy = registerEfficacyFromDagProgress({
    selection: pending,
    currentModel: currentDagResult.model,
    accepted: currentDagResult.accepted,
    state,
    classification,
    tutorFeedback,
  });
  return pending.efficacy;
}

function firstAvailableRegister(palette, names, fallback = 'precise') {
  for (const name of names) {
    if (palette.has(name)) return name;
  }
  return palette.has(fallback) ? fallback : [...palette][0] || fallback;
}

function briskRepeatPenalty(state) {
  const latest = latestRegisterSelection(state);
  const latestBad =
    latest?.selected_register === 'brisk' &&
    /no_clear_progress|regression_or_overreach/.test(latest.efficacy?.label || '');
  return Boolean(latestBad || recentRegisterCount(state, 'brisk') >= 2);
}

function shouldUseDynamicBrisk({ state, classification, assessment }) {
  const bottleneck = assessment.bottleneck || '';
  const hasDagGap = /release_or_pacing_gap|inference_gap/.test(bottleneck);
  const explicitStepwise = hasExplicitStepwiseSignal(classification);
  const latestMismatch = latestFieldStateMismatch(state);
  if (/field_without_dag|dag_without_field/.test(latestMismatch || '') && !explicitStepwise) return false;
  if (!hasDagGap || !explicitStepwise) return false;
  if (briskRepeatPenalty(state) && !explicitStepwise) return false;
  return true;
}

function fallbackRegisterSelection({ state, classification, tutorLearnerDag }) {
  const palette = new Set(state.register?.palette || []);
  const policy = state.register?.policy || 'dynamic';
  const assessment = tutorLearnerDag?.model?.assessment || {};
  const requestType = classification?.turn?.request_type || 'unknown_request';
  const move = classification?.turn?.discourse_move || 'unknown';
  const stance = classification?.turn?.epistemic_stance || 'unknown';
  const evidenceUse = classification?.turn?.evidence_use || 'unknown';
  const agency = classification?.turn?.agency || 'unknown';
  const latestMismatch = latestFieldStateMismatch(state);
  let selected = 'precise';
  let actionFamily = 'clarify_distinction';
  let reason = '';
  let expectedFieldMove = '';

  if (palette.has('witnessing') && /vulnerable|affective/.test(`${move} ${stance}`)) {
    selected = 'witnessing';
    actionFamily = 'receive_vulnerability';
    reason = 'The reviewer sees affective exposure as the strongest current public cue.';
    expectedFieldMove = 'Lower learner risk enough for a concrete public-evidence move to become possible.';
  } else if (
    palette.has('precise') &&
    /challenge|omits_warrant|overleaps_evidence|distorts_public_evidence/.test(`${move} ${evidenceUse}`)
  ) {
    selected = 'precise';
    actionFamily = 'answer_accountably';
    reason =
      'The learner is challenging or overleaping the public evidence, so the tutor should hold the bid accountable.';
    expectedFieldMove = 'Shift from unsupported assertion toward a publicly warranted claim.';
  } else if (policy === 'dynamic' && latestMismatch === 'field_without_dag') {
    selected = firstAvailableRegister(palette, ['plain', 'precise', 'charismatic']);
    actionFamily = requestType === 'transfer_demand_or_named_material' ? 'ground_in_material' : 'compress_sayback';
    reason =
      'The previous register improved the learner field without proof-DAG movement; convert that preparatory movement into one public evidence claim.';
    expectedFieldMove = 'Turn improved orientation or agency into a learner-owned public-record statement.';
  } else if (policy === 'dynamic' && latestMismatch === 'dag_without_field') {
    selected = firstAvailableRegister(palette, ['plain', 'precise', 'witnessing']);
    actionFamily = 'compress_sayback';
    reason =
      'The proof-DAG advanced while learner field movement flattened; ask the learner to own the reason for the step before pushing another premise.';
    expectedFieldMove = 'Recover agency and explanatory ownership around the evidence just adopted.';
  } else if (
    palette.has('charismatic') &&
    /resistant|overconfident|answer_seeking|complying|passive/.test(`${stance} ${evidenceUse} ${agency}`)
  ) {
    selected = 'charismatic';
    actionFamily = 'challenge_resistance';
    reason =
      'Low-agency, answer-seeking, or overconfident posture warrants a compact challenge rather than another stepwise hint.';
    expectedFieldMove = 'Increase learner agency or evidence-seeking without supplying the concealed answer.';
  } else if (
    policy === 'dynamic' &&
    palette.has('brisk') &&
    shouldUseDynamicBrisk({ state, classification, assessment })
  ) {
    selected = 'brisk';
    actionFamily = 'stage_next_step';
    reason = 'The learner is explicitly asking for stepwise help on the immediate evidence move.';
    expectedFieldMove = 'Make the next learner-owned inference easier without turning it into a menu or answer.';
  } else if (!palette.has(selected)) {
    selected = firstAvailableRegister(palette, ['precise', 'charismatic', 'plain', 'warm', 'witnessing', 'brisk']);
  }

  if (!reason) {
    reason =
      policy === 'dynamic' && selected !== 'brisk'
        ? 'Dynamic fallback selected after missing or invalid model register output; brisk pacing is non-default.'
        : 'Fallback register selected after missing or invalid model register output.';
  }
  if (!expectedFieldMove) {
    expectedFieldMove = 'Improve the learner field enough that the next public evidence move becomes more likely.';
  }

  return {
    selected_register: selected,
    request_type: requestType,
    action_family: actionFamily,
    legacy_selected_register: preferredLegacyRegister({ register: selected, requestType, actionFamily }),
    reviewer_signal: `${requestType}; ${move}`,
    register_reason: reason,
    evidence_span: classification?.turn?.summary || '',
    risk_flags: [],
    expected_dag_move: 'Elicit one public, checkable learner move that can update the learner-DAG record.',
    expected_field_move: expectedFieldMove,
    expected_progress_marker:
      'Next learner turn adopts staged evidence, voices a derivable inference, or corrects an overreach.',
    confidence: 0.25,
    warning: 'fallback_register_selection',
    source: 'local_fallback_register_selection',
  };
}

function fixedBlandEngagementStanceSelection({ state, classification }) {
  const palette = new Set(state.register?.palette || []);
  const selected = firstAvailableRegister(palette, ['plain', 'precise', 'brisk']);
  const requestType = classification?.turn?.request_type || 'bland_baseline';
  return {
    selected_register: selected,
    request_type: requestType,
    action_family: 'baseline_plain_response',
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType,
      actionFamily: 'baseline_plain_response',
    }),
    reviewer_signal: 'fixed_bland_policy',
    register_reason:
      selected === 'plain'
        ? 'Bland policy fixes a plain non-adaptive baseline register.'
        : 'Bland policy requested plain, but the active palette did not include it; selected the nearest available baseline register.',
    evidence_span: classification?.turn?.summary || '',
    risk_flags: [],
    expected_dag_move: 'No adaptive register-specific DAG move is predicted for the bland baseline.',
    expected_field_move:
      'Use the fixed plain stance as a control condition for comparison with adaptive register policies.',
    expected_progress_marker: 'Observe learner-DAG and field movement without adaptive register selection.',
    confidence: null,
    source: 'fixed_bland_register_policy',
  };
}

function policySamplingContext(state, decisionKind) {
  const experiment = state.experiment || {};
  return {
    runSeed: experiment.runSeed ?? 1,
    profile: experiment.profile || automatedLearnerProfileId(args['auto-learner-profile']) || 'custom',
    policy: state.register?.policy || 'unknown',
    repeat: experiment.repeat ?? 1,
    learnerTurn: state.turns.length + 1,
    decisionKind,
    jobId: experiment.jobId || null,
  };
}

function uniformEngagementStanceDistribution(registers) {
  const probability = registers.length ? 1 / registers.length : 0;
  return registers.map((register) => ({ register, weight: 1, probability }));
}

function randomEngagementStanceSelection({ state, classification }) {
  const palette = state.register?.palette || [];
  const distribution = uniformEngagementStanceDistribution(palette);
  const sampled = sampleTutorStubPolicyDistribution(
    distribution,
    policySamplingContext(state, 'random_engagement_stance'),
  );
  const selected = sampled.entry?.register || firstAvailableRegister(new Set(palette), ['precise', 'plain', 'brisk']);
  return {
    selected_register: selected,
    request_type: classification?.turn?.request_type || 'random_policy',
    action_family: null,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: classification?.turn?.request_type || 'random_policy',
      actionFamily: null,
    }),
    reviewer_signal: 'random_policy',
    register_reason:
      'Random register policy sampled uniformly from the active palette; this choice is not a classifier- or learner-DAG-based recommendation.',
    evidence_span: classification?.turn?.summary || '',
    risk_flags: [],
    expected_dag_move:
      'No register-specific DAG move is predicted; preserve evidence safety while following the sampled register stance.',
    expected_field_move:
      'Observe whether the sampled stance changes learner agency, evidence use, stance, or conceptual engagement.',
    expected_progress_marker:
      'Use the next learner turn to observe whether this random register coincides with learner-DAG progress.',
    confidence: null,
    source: 'random_register_policy',
    distribution,
    selected_probability: sampled.entry?.probability ?? null,
    random: sampled.audit,
  };
}

function negativeEngagementStanceSelection({ state, classification }) {
  const active = new Set(state.register?.palette || []);
  const palette = NEGATIVE_FLOOR_REGISTERS.filter((register) => active.has(register));
  const population = palette.length ? palette : NEGATIVE_FLOOR_REGISTERS;
  const distribution = uniformEngagementStanceDistribution(population);
  const sampled = sampleTutorStubPolicyDistribution(
    distribution,
    policySamplingContext(state, 'negative_floor_engagement_stance'),
  );
  const selected = sampled.entry?.register || 'ironic';
  return {
    selected_register: selected,
    request_type: classification?.turn?.request_type || 'negative_floor_policy',
    action_family: null,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: classification?.turn?.request_type || 'negative_floor_policy',
      actionFamily: null,
    }),
    reviewer_signal: 'negative_floor_policy',
    register_reason:
      'Negative register floor sampled uniformly from ironic, sarcastic, and face_threat; this is a deliberate floor/control, not a recommended adaptive stance.',
    evidence_span: classification?.turn?.summary || '',
    risk_flags: ['negative_floor'],
    expected_dag_move:
      'No beneficial register-specific DAG move is predicted; preserve evidence safety while measuring whether negative stance harms uptake or agency.',
    expected_field_move:
      'Measure recognition cost, learner agency narrowing, disengagement, or coerced progress under a negative-only register floor.',
    expected_progress_marker:
      'Compare learner-DAG progress against field movement and recognition-cost signals after the negative stance.',
    confidence: null,
    source: 'negative_register_policy',
    distribution,
    selected_probability: sampled.entry?.probability ?? null,
    random: { ...sampled.audit, floor: NEGATIVE_FLOOR_REGISTERS },
  };
}

function expectedFieldMoveForRegister(selected, features) {
  const relation = features.field?.relation || 'unknown';
  if (Number(features.comprehension?.pressure || 0) > 0) {
    return 'Repair the wording gap with one immediate plain-language gloss before advancing the proof.';
  }
  if (features.dag.finalSecretEntailed && features.dag.assertedSecret) {
    return 'Close the now-warranted inquiry without opening another proof step.';
  }
  if (features.dag.finalSecretEntailed) return 'Invite the compact warranted verdict without adding another premise.';
  if (features.dag.assertedSecret) return 'Test the public warrant for the proposed verdict before accepting it.';
  if (features.advance?.accelerated) {
    return 'Credit the learner’s compressed chain, keep the quicker pace, and test only the next unresolved edge.';
  }
  if (relation === 'field_without_dag') {
    return 'Convert the learner field movement into one public evidence claim or warrant.';
  }
  if (relation === 'dag_without_field') {
    return 'Recover learner agency and ownership around the proof step that just moved.';
  }
  if (relation === 'neither_progress') {
    return 'Change the interaction posture enough to make either learner agency or evidence use move next.';
  }
  if (selected === 'witnessing') return 'Lower affective risk while preserving one concrete check.';
  if (selected === 'charismatic') return 'Interrupt low-agency compliance and create a learner-owned public move.';
  if (selected === 'ironic') return 'Let the learner notice the mismatch without turning the learner into the target.';
  if (selected === 'sarcastic') return 'Test whether a dry edge disrupts rote performance while leaving a repair path.';
  if (selected === 'face_threat')
    return 'Measure whether local face threat changes uptake while preserving a minimal repair path.';
  if (selected === 'brisk') return 'Increase pace without turning the next inference into an answer dump.';
  if (selected === 'plain') return "Make the next move sayable in the learner's own words.";
  return 'Sharpen the learner field toward one accountable public statement.';
}

function fallbackPolicySamplingContext(decisionKind) {
  // Every run path supplies state; this fixed context exists so that even a
  // state-less draw stays seeded and replayable (it is deterministic and
  // constant by construction — there is no turn identity without state).
  return {
    runSeed: 1,
    profile: 'interactive',
    policy: 'unknown',
    repeat: 1,
    learnerTurn: 1,
    decisionKind,
    jobId: null,
  };
}

function sampleEngagementStanceDistribution(distribution, { state = null, decisionKind = 'engagement_stance' } = {}) {
  const context = state ? policySamplingContext(state, decisionKind) : fallbackPolicySamplingContext(decisionKind);
  const sampled = sampleTutorStubPolicyDistribution(distribution, context);
  return { entry: sampled.entry, random: sampled.audit };
}

function selectEngagementStanceDistribution(
  distribution,
  { deterministic = false, state = null, decisionKind = 'engagement_stance' } = {},
) {
  if (!deterministic) return sampleEngagementStanceDistribution(distribution, { state, decisionKind });
  return {
    entry: distribution[0] || null,
    random: {
      method: 'argmax_policy_overlay',
      value: null,
      threshold: null,
    },
  };
}

function formatEngagementStanceDistribution(distribution, { limit = 5 } = {}) {
  const entries = Array.isArray(distribution) ? distribution : [];
  if (!entries.length) return '';
  return entries
    .slice(0, limit)
    .map((entry) => `${entry.register}:${Math.round(Number(entry.probability || 0) * 100)}%`)
    .join(', ');
}

function fieldEngagementStanceSelection({ state, classification, tutorLearnerDag, deterministic = false }) {
  const { features, scores, drivers } = buildFieldRegisterScores({ state, classification, tutorLearnerDag });
  const distribution = normalizeEngagementStanceDistribution(scores, { temperature: state.register?.temperature });
  const sampled = selectEngagementStanceDistribution(distribution, {
    deterministic,
    state,
    decisionKind: 'field_engagement_stance',
  });
  const selected =
    sampled.entry?.register || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
  const actionFamily = null;
  const selectedProbability = sampled.entry?.probability ?? null;
  const driverText = drivers.slice(0, 5).join('; ') || 'base field-policy weights only';
  return {
    selected_register: selected,
    request_type: features.requestType,
    action_family: actionFamily,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: features.requestType,
      actionFamily,
    }),
    reviewer_signal: `${features.field.relation}; ${features.discourseMove}; ${features.epistemicStance}; ${features.agency}`,
    register_reason: `Field policy sampled from local engagement-stance distribution. Main drivers: ${driverText}.`,
    evidence_span: classification?.turn?.summary || '',
    risk_flags: [],
    expected_dag_move:
      Number(features.comprehension?.pressure || 0) > 0
        ? 'Hold learner-DAG advancement while the wording gap is repaired.'
        : features.dag.finalSecretEntailed && features.dag.assertedSecret
          ? 'Close the warranted proof without asking for another premise.'
          : features.dag.finalSecretEntailed
            ? 'Invite the learner’s compact warranted verdict without adding another premise.'
            : features.dag.assertedSecret
              ? 'Test the warrant for the proposed verdict before accepting it.'
              : features.advance?.accelerated
                ? 'Accept every warranted learner-supplied premise and inference already made; probe only the next unresolved proof edge.'
                : features.field.relation === 'field_without_dag'
                  ? 'Elicit one public evidence claim that converts learner-field movement into proof-state movement.'
                  : 'Elicit one public, checkable learner move that can update the learner-DAG record.',
    expected_field_move: expectedFieldMoveForRegister(selected, features),
    expected_progress_marker:
      'Next learner turn should show movement in agency, evidence use, epistemic stance, or learner-DAG coverage.',
    confidence: selectedProbability,
    source: 'field_register_policy',
    distribution,
    selected_probability: selectedProbability,
    field_policy: {
      schema: 'machinespirits.tutor-stub.field-register-policy.v1',
      features,
      scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
      drivers,
      random: sampled.random,
    },
  };
}

function trajectoryRiskFlags(trajectory) {
  return Object.entries(trajectory.flags || {})
    .filter(([, value]) => value)
    .map(([key]) => `trajectory_${key}`);
}

function expectedTrajectoryDagMove(features, trajectory) {
  const flags = trajectory.flags || {};
  if (features.dag.finalSecretEntailed && features.dag.assertedSecret) {
    return 'Close the proof path without adding another premise or making the learner repeat the completed chain.';
  }
  if (features.dag.finalSecretEntailed) return 'Invite the compact warranted verdict without adding another premise.';
  if (features.dag.assertedSecret) return 'Test the warrant for the proposed verdict before accepting it.';
  if (flags.learnerAcceleration) {
    return 'Preserve every warranted step in the learner’s compressed chain and move directly to its next unresolved edge.';
  }
  if (flags.coerciveProgress) {
    return 'Hold proof-state progress until the learner can own the warrant without rising recognition risk.';
  }
  if (flags.fieldOnlyDrift) {
    return 'Convert improving learner posture into one public evidence adoption or warranted claim.';
  }
  if (flags.dagOnlyDrift) {
    return 'Ask the learner to explain the proof step already moving in the learner-DAG.';
  }
  if (flags.plateau) {
    return 'Change the local posture enough to create either learner-field movement or proof-state movement.';
  }
  if (features.dag.finalSecretEntailed || features.dag.assertedSecret) {
    return 'Close the proof path by having the learner state the public warrant for the answer.';
  }
  return 'Elicit one public, checkable learner move that changes the recent learner-field or learner-DAG trajectory.';
}

function expectedTrajectoryMoveForRegister(selected, features, trajectory) {
  const flags = trajectory.flags || {};
  if (features.dag.finalSecretEntailed && features.dag.assertedSecret) {
    return 'Use the learner’s completed chain for a concise, accountable closeout.';
  }
  if (features.dag.finalSecretEntailed) return 'Turn the completed chain into one compact learner-owned verdict.';
  if (features.dag.assertedSecret) return 'Slow only enough to test the warrant behind the proposed verdict.';
  if (flags.learnerAcceleration && !flags.nearClosure) {
    return 'Match the learner’s faster pace: acknowledge the chain once, then extend or test its next edge.';
  }
  if (flags.coerciveProgress) {
    return 'Trade speed for learner ownership: reduce risk while keeping one accountable public check.';
  }
  if (flags.riskRising) {
    return 'Lower rising field risk before asking for another proof-state advance.';
  }
  if (flags.plateau) {
    return 'Break a flat recent trajectory with a different learner-owned commitment.';
  }
  if (flags.fieldRegression) {
    return 'Recover agency, evidence use, or epistemic stance after negative field movement.';
  }
  if (flags.fieldOnlyDrift) {
    return 'Turn improved orientation into a sayable public claim.';
  }
  if (flags.dagOnlyDrift) {
    return 'Make the learner own the proof movement already appearing in the DAG.';
  }
  if (flags.stableConvergence) {
    return 'Preserve convergent field and DAG momentum without overprompting.';
  }
  return expectedFieldMoveForRegister(selected, features);
}

function trajectoryEngagementStanceSelection({ state, classification, tutorLearnerDag }) {
  const { features, trajectory, scores, drivers, baseScores, baseDrivers } = buildTrajectoryRegisterScores({
    state,
    classification,
    tutorLearnerDag,
  });
  const distribution = normalizeEngagementStanceDistribution(scores, { temperature: state.register?.temperature });
  const sampled = sampleEngagementStanceDistribution(distribution, {
    state,
    decisionKind: 'trajectory_engagement_stance',
  });
  const selected =
    sampled.entry?.register || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
  const actionFamily = null;
  const selectedProbability = sampled.entry?.probability ?? null;
  const driverText = drivers.slice(0, 6).join('; ') || 'trajectory policy used field baseline only';
  return {
    selected_register: selected,
    request_type: features.requestType,
    action_family: actionFamily,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: features.requestType,
      actionFamily,
    }),
    reviewer_signal: `${features.field.relation}; fieldSlope=${trajectory.field.slope ?? 'n/a'}; dagSlope=${
      trajectory.dag.slope ?? 'n/a'
    }; riskSlope=${trajectory.risk.slope ?? 'n/a'}`,
    register_reason: `Trajectory policy sampled from field baseline plus recent finite-difference dynamics. Main drivers: ${driverText}.`,
    evidence_span: classification?.turn?.summary || '',
    risk_flags: trajectoryRiskFlags(trajectory),
    expected_dag_move: expectedTrajectoryDagMove(features, trajectory),
    expected_field_move: expectedTrajectoryMoveForRegister(selected, features, trajectory),
    expected_progress_marker:
      'Next learner turn should improve the recent trajectory: field score, proof coverage, ownership, or risk trend.',
    confidence: selectedProbability,
    source: 'trajectory_register_policy',
    distribution,
    selected_probability: selectedProbability,
    trajectory_policy: {
      schema: 'machinespirits.tutor-stub.trajectory-register-policy.v1',
      base_field_schema: 'machinespirits.tutor-stub.field-register-policy.v1',
      features,
      trajectory,
      base_scores: Object.fromEntries(
        Object.entries(baseScores).map(([register, score]) => [register, roundField(score)]),
      ),
      scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
      base_drivers: baseDrivers,
      drivers,
      random: sampled.random,
    },
  };
}

function dynamicalSystemRiskFlags(system) {
  return Object.entries(system.state_vector || {})
    .filter(([key, value]) => Number(value) >= 0.7 && /risk|coercion|stagnation|regression|gap|deficit/iu.test(key))
    .map(([key]) => `dynamical_${key}`);
}

function expectedDynamicalDagMove(features, system) {
  const vector = system.state_vector || {};
  if (numberOr(vector.language_opacity) > 0) {
    return 'Hold proof-state advancement while the tutor repairs the learner-visible wording gap.';
  }
  if (numberOr(vector.coercion_risk) > 0.55) {
    return 'Stabilize learner ownership before taking more proof-state progress.';
  }
  if (numberOr(vector.warrant_gap) > 0.6) {
    return 'Elicit one public warrant that makes the current claim accountable.';
  }
  if (numberOr(vector.evidence_gap) > 0.6) {
    return 'Move one missing public premise into the learner-owned record.';
  }
  if (numberOr(vector.closure_pressure) > 0.65) {
    return 'Close by having the learner state the public evidence chain for the answer.';
  }
  if (features.dag.finalSecretEntailed || features.dag.assertedSecret) {
    return 'Convert near-closure into a public, warranted final statement.';
  }
  return 'Move the system toward evidence grounding, learner ownership, or accountable closure.';
}

function expectedDynamicalMoveForRegister(selected, features, system) {
  const vector = system.state_vector || {};
  if (numberOr(vector.language_opacity) > 0) {
    return 'Gloss the unresolved or recently queried term before applying further proof pressure.';
  }
  if (numberOr(vector.affective_risk) > 0.6 || numberOr(vector.coercion_risk) > 0.55) {
    return 'Reduce safety or coercion pressure while preserving one checkable public move.';
  }
  if (numberOr(vector.agency_deficit) > 0.65) {
    return 'Increase learner-owned commitment instead of supplying the next inference.';
  }
  if (numberOr(vector.warrant_gap) > 0.6) {
    return 'Turn the current claim into a warranted public statement.';
  }
  if (numberOr(vector.stagnation) > 0.6) {
    return 'Perturb a stuck trajectory without sacrificing recognition safety.';
  }
  if (numberOr(vector.momentum) > 0.55 && selected === 'brisk') {
    return 'Use the available pace to carry one learner-owned proof step.';
  }
  return expectedTrajectoryMoveForRegister(selected, features, system.trajectory || {});
}

function dynamicalSystemEngagementStanceSelection({ state, classification, tutorLearnerDag, useCorpusPrior = false }) {
  const { features, trajectory, system, empirical, corpusEmpirical, logits, scores, drivers } =
    buildDynamicalSystemRegisterScores({
      state,
      classification,
      tutorLearnerDag,
      useCorpusPrior,
    });
  const distribution = normalizeEngagementStanceDistribution(scores, { temperature: 1 });
  const sampled = sampleEngagementStanceDistribution(distribution, {
    state,
    decisionKind: useCorpusPrior
      ? 'empirical_dynamical_system_engagement_stance'
      : 'dynamical_system_engagement_stance',
  });
  const selected =
    sampled.entry?.register || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
  const actionFamily = null;
  const selectedProbability = sampled.entry?.probability ?? null;
  const selectedContributions = registerAffinityContributions(selected, system.state_vector).slice(0, 6);
  const driverText =
    [
      ...drivers.slice(0, 4),
      selectedContributions.length
        ? `selected ${selected}: ${selectedContributions
            .map((row) => `${row.axis}${row.contribution >= 0 ? '+' : ''}${roundField(row.contribution)}`)
            .join(', ')}`
        : null,
    ]
      .filter(Boolean)
      .join('; ') || 'dynamical-system base priors only';
  return {
    selected_register: selected,
    request_type: features.requestType,
    action_family: actionFamily,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: features.requestType,
      actionFamily,
    }),
    reviewer_signal: `attractors=${topNumericEntries(system.attractors, { limit: 3 }).join(', ')}; vector=${topNumericEntries(
      system.state_vector,
      { limit: 3 },
    ).join(', ')}`,
    register_reason: `${
      useCorpusPrior ? 'Empirical dynamical-system' : 'Dynamical-system'
    } policy sampled from theory affinity matrix plus local${
      useCorpusPrior ? ' and cross-run' : ''
    } efficacy correction. Main drivers: ${driverText}.`,
    evidence_span: classification?.turn?.summary || '',
    risk_flags: dynamicalSystemRiskFlags(system),
    expected_dag_move: expectedDynamicalDagMove(features, system),
    expected_field_move: expectedDynamicalMoveForRegister(selected, features, system),
    expected_progress_marker:
      'Next learner turn should move the system vector toward lower gap/risk and higher ownership, grounding, or closure.',
    confidence: selectedProbability,
    source: useCorpusPrior ? 'empirical_dynamical_system_register_policy' : 'dynamical_system_register_policy',
    distribution,
    selected_probability: selectedProbability,
    dynamical_system_policy: {
      schema: 'machinespirits.tutor-stub.dynamical-system-register-policy.v1',
      mapping: {
        type: useCorpusPrior
          ? 'softmax_affinity_matrix_with_local_and_corpus_empirical_correction'
          : 'softmax_affinity_matrix_with_empirical_correction',
        temperature: state.register?.temperature ?? DYNAMICAL_SYSTEM_TEMPERATURE,
        theory_priors:
          'recognition safety, learner ownership, accountable warranting, proof-state closure, and controlled productive disruption',
        affinity_matrix_version: 'v1',
      },
      state_vector: system.state_vector,
      derivative_vector: system.derivative_vector,
      attractors: system.attractors,
      selected_affinity: DYNAMICAL_SYSTEM_REGISTER_AFFINITY[selected] || {},
      selected_contributions: selectedContributions.map((row) => ({
        axis: row.axis,
        weight: row.weight,
        value: roundField(row.value),
        contribution: roundField(row.contribution),
      })),
      empirical,
      corpus_empirical: corpusEmpirical,
      logits: Object.fromEntries(Object.entries(logits).map(([register, logit]) => [register, roundField(logit)])),
      scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
      drivers,
      trajectory,
      features,
      random: sampled.random,
    },
  };
}

function continuousDynamicalSystemEngagementStanceSelection({
  state,
  classification,
  tutorLearnerDag,
  useCorpusPrior = false,
}) {
  const { features, trajectory, system, empirical, corpusEmpirical, logits, scores, drivers } =
    buildDynamicalSystemRegisterScores({
      state,
      classification,
      tutorLearnerDag,
      useCorpusPrior,
    });
  const definitions = getEngagementStanceDefinitions();
  const blend = buildContinuousEngagementStanceVector({
    scores,
    palette: state.register?.palette || [],
    definitions,
    allowUnsafe: state.register?.continuousUnsafe === true,
  });
  const selected =
    blend.selectedRegister || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
  const actionFamily = null;
  const selectedProbability = blend.selectedProbability ?? null;
  const selectedContributions = registerAffinityContributions(selected, system.state_vector).slice(0, 6);
  const blendInstruction = continuousEngagementStanceInstruction(blend, definitions);
  const continuousPolicy = buildContinuousRegisterPolicyMetadata({
    blend,
    temperature: state.register?.temperature ?? DYNAMICAL_SYSTEM_TEMPERATURE,
    useCorpusPrior,
    empirical,
    corpusEmpirical,
    styleInstruction: blendInstruction,
  });
  const driverText =
    [
      `blend ${blend.dominantBlend || selected}`,
      ...drivers.slice(0, 4),
      selectedContributions.length
        ? `selected ${selected}: ${selectedContributions
            .map((row) => `${row.axis}${row.contribution >= 0 ? '+' : ''}${roundField(row.contribution)}`)
            .join(', ')}`
        : null,
    ]
      .filter(Boolean)
      .join('; ') || 'continuous dynamical-system base priors only';
  return {
    selected_register: selected,
    request_type: features.requestType,
    action_family: actionFamily,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: features.requestType,
      actionFamily,
    }),
    reviewer_signal: `continuous blend=${blend.dominantBlend}; attractors=${topNumericEntries(system.attractors, {
      limit: 3,
    }).join(', ')}; vector=${topNumericEntries(system.state_vector, { limit: 3 }).join(', ')}`,
    register_reason: `${
      useCorpusPrior ? 'Continuous empirical dynamical-system' : 'Continuous dynamical-system'
    } policy blended register anchors from theory affinity matrix plus local${
      useCorpusPrior ? ' and cross-run' : ''
    } efficacy correction. Main drivers: ${driverText}.`,
    evidence_span: classification?.turn?.summary || '',
    risk_flags: dynamicalSystemRiskFlags(system),
    expected_dag_move: expectedDynamicalDagMove(features, system),
    expected_field_move: expectedDynamicalMoveForRegister(selected, features, system),
    expected_progress_marker:
      'Next learner turn should show the continuous stance blend moving the system vector toward lower gap/risk and higher ownership, grounding, or closure.',
    confidence: selectedProbability,
    source: useCorpusPrior
      ? 'continuous_empirical_dynamical_system_register_policy'
      : 'continuous_dynamical_system_register_policy',
    distribution: blend.rows,
    selected_probability: selectedProbability,
    register_vector: blend.vector,
    register_vector_entropy_bits: blend.entropyBits,
    continuous_register_policy: continuousPolicy,
    dynamical_system_policy: {
      schema: 'machinespirits.tutor-stub.dynamical-system-register-policy.v1',
      mapping: {
        type: useCorpusPrior
          ? 'softmax_affinity_matrix_with_local_and_corpus_empirical_correction'
          : 'softmax_affinity_matrix_with_empirical_correction',
        temperature: state.register?.temperature ?? DYNAMICAL_SYSTEM_TEMPERATURE,
        theory_priors:
          'recognition safety, learner ownership, accountable warranting, proof-state closure, and controlled productive disruption',
        affinity_matrix_version: 'v1',
      },
      state_vector: system.state_vector,
      derivative_vector: system.derivative_vector,
      attractors: system.attractors,
      selected_affinity: DYNAMICAL_SYSTEM_REGISTER_AFFINITY[selected] || {},
      selected_contributions: selectedContributions.map((row) => ({
        axis: row.axis,
        weight: row.weight,
        value: roundField(row.value),
        contribution: roundField(row.contribution),
      })),
      empirical,
      corpus_empirical: corpusEmpirical,
      logits: Object.fromEntries(Object.entries(logits).map(([register, logit]) => [register, roundField(logit)])),
      scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
      drivers,
      trajectory,
      features,
      continuous_register_policy: {
        register_vector: continuousPolicy.register_vector,
        entropy_bits: continuousPolicy.entropy_bits,
        dominant_blend: continuousPolicy.dominant_blend,
      },
    },
  };
}

function expectedStateMoveForRegister(selected, features) {
  if (Number(features.comprehension?.pressure || 0) > 0) {
    return 'Resolve the current vocabulary or wording gap before asking for another proof move.';
  }
  if (features.dag.finalSecretEntailed || features.dag.assertedSecret) {
    return 'Move the current learner state toward accountable closure without adding new evidence.';
  }
  if (features.advance?.accelerated) {
    return 'Address the learner as an informed peer, credit the full chain, and test only the next unresolved distinction.';
  }
  if (features.dag.bottleneck === 'premature_assertion') {
    return 'Move the learner from naming a verdict to naming the public support that licenses it.';
  }
  if (features.dag.bottleneck === 'assertion_gap') {
    return 'Move the learner from held evidence to a warranted final assertion.';
  }
  if (
    /answer_seeking|passive|complying/iu.test(`${features.epistemicStance} ${features.agency} ${features.evidenceUse}`)
  ) {
    return 'Move the learner from dependent answer-seeking to one small public commitment.';
  }
  if (selected === 'witnessing') return 'Lower current affective risk while keeping one concrete public test.';
  if (selected === 'warm') return 'Restore current learner readiness enough for the next evidence claim.';
  if (selected === 'charismatic') return 'Interrupt current low-agency posture and demand one owned move.';
  if (selected === 'precise') return 'Sharpen the current claim, distinction, or warrant into a checkable line.';
  if (selected === 'brisk') return 'Advance the current proof bottleneck with one learner-owned next step.';
  return 'Move the current learner state toward one public, checkable evidence statement.';
}

function stateEngagementStanceSelection({ state, classification, tutorLearnerDag, deterministic = false }) {
  const { features, scores, drivers } = buildStateRegisterScores({ state, classification, tutorLearnerDag });
  const distribution = normalizeEngagementStanceDistribution(scores, { temperature: state.register?.temperature });
  const sampled = selectEngagementStanceDistribution(distribution, {
    deterministic,
    state,
    decisionKind: 'state_engagement_stance',
  });
  const selected =
    sampled.entry?.register || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
  const actionFamily = null;
  const selectedProbability = sampled.entry?.probability ?? null;
  const driverText = drivers.slice(0, 5).join('; ') || 'base state-policy weights only';
  return {
    selected_register: selected,
    request_type: features.requestType,
    action_family: actionFamily,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: features.requestType,
      actionFamily,
    }),
    reviewer_signal: `${features.dag.bottleneck}; ${features.discourseMove}; ${features.epistemicStance}; ${features.agency}`,
    register_reason: `State policy sampled from current classifier/DAG distribution. Main drivers: ${driverText}.`,
    evidence_span: classification?.turn?.summary || '',
    risk_flags: [],
    expected_dag_move:
      Number(features.comprehension?.pressure || 0) > 0
        ? 'Hold learner-DAG advancement while the wording gap is repaired.'
        : features.dag.finalSecretEntailed && features.dag.assertedSecret
          ? 'Close the warranted proof without asking for another premise.'
          : features.dag.finalSecretEntailed
            ? 'Invite the learner’s compact warranted verdict without adding another premise.'
            : features.dag.assertedSecret
              ? 'Test the warrant for the proposed verdict before accepting it.'
              : features.advance?.accelerated
                ? 'Preserve the learner’s full multi-premise advance and ask only about the next unresolved proof edge.'
                : 'Elicit one public, checkable learner move that addresses the current learner-DAG bottleneck.',
    expected_field_move: expectedStateMoveForRegister(selected, features),
    expected_progress_marker:
      'Next learner turn should improve the current state: public evidence use, agency, assertion quality, or learner-DAG coverage.',
    confidence: selectedProbability,
    source: 'state_register_policy',
    distribution,
    selected_probability: selectedProbability,
    state_policy: {
      schema: 'machinespirits.tutor-stub.state-register-policy.v1',
      features,
      scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
      drivers,
      random: sampled.random,
    },
  };
}

function registerPolicySelectionSummary(selection) {
  return {
    selected_register: selection?.selected_register || selection?.engagement_stance || null,
    source: selection?.source || null,
    reason: selection?.register_reason || selection?.engagement_stance_reason || null,
    selected_probability: selection?.selected_probability ?? selection?.confidence ?? null,
    distribution: Array.isArray(selection?.distribution) ? selection.distribution : null,
  };
}

function composeRegisterPolicySelection({ primarySelection, state, classification, tutorLearnerDag }) {
  const overlays = Array.isArray(state.register?.overlays) ? state.register.overlays : [];
  if (!overlays.length) return primarySelection;
  const primaryRegister = primarySelection?.selected_register || primarySelection?.engagement_stance || null;
  const threshold = state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD;
  const evaluated = overlays.map((overlay, index) => {
    const candidate =
      overlay === 'state'
        ? stateEngagementStanceSelection({
            state,
            classification,
            tutorLearnerDag,
            deterministic: true,
          })
        : fieldEngagementStanceSelection({
            state,
            classification,
            tutorLearnerDag,
            deterministic: true,
          });
    const evaluation = evaluateTutorStubRegisterPolicyOverlay({
      overlay,
      state,
      classification,
      candidate,
      primaryRegister,
      threshold,
    });
    return {
      ...evaluation,
      order: index,
      candidate,
      candidate_reason: candidate.register_reason || null,
      candidate_distribution: candidate.distribution || null,
    };
  });
  const winner = evaluated
    .filter((entry) => entry.eligible)
    .sort((a, b) => b.signal_strength - a.signal_strength || a.order - b.order)[0];
  const composition = {
    schema: TUTOR_STUB_REGISTER_POLICY_COMPOSITION_SCHEMA,
    policy_stack: tutorStubRegisterPolicyStackId(state.register.policy, overlays),
    primary_policy: state.register.policy,
    overlay_policies: [...overlays],
    overlay_threshold: threshold,
    primary_selection: registerPolicySelectionSummary(primarySelection),
    overlay_evaluations: evaluated.map(({ candidate: _candidate, order: _order, ...entry }) => entry),
    activated_overlay: winner?.policy || null,
    activated_strength: winner?.signal_strength ?? null,
  };
  if (!winner) {
    return {
      ...primarySelection,
      policy_composition: composition,
    };
  }
  const candidate = winner.candidate;
  const reason = `${winner.policy} overlay replaced the ${state.register.policy} choice ${primaryRegister} with ${
    candidate.selected_register
  }: turn-change strength ${winner.signal_strength} met threshold ${threshold}. ${candidate.register_reason || ''}`.trim();
  return {
    ...primarySelection,
    ...candidate,
    register_reason: reason,
    engagement_stance_reason: reason,
    source: `register_policy_overlay_${winner.policy}`,
    policy_composition: composition,
  };
}

let cachedPressureTurns = null;
function predeclaredPressureTurns() {
  if (cachedPressureTurns) return cachedPressureTurns;
  cachedPressureTurns = new Set(
    String(args['pressure-turns'] || '')
      .split(',')
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((value) => Number.isFinite(value) && value > 0),
  );
  return cachedPressureTurns;
}

function applyEngagementStanceOverride(source, stance, patch = {}) {
  const priorDistribution =
    source?.engagement_stance_distribution || (Array.isArray(source?.distribution) ? source.distribution : null);
  const lockedDistribution = [
    {
      engagement_stance: stance,
      register: stance,
      weight: 1,
      probability: 1,
      sourceScore: 1,
    },
  ];
  return {
    ...source,
    ...patch,
    engagement_stance: stance,
    selected_register: stance,
    pre_override_engagement_stance_distribution: priorDistribution,
    distribution: lockedDistribution,
    engagement_stance_distribution: lockedDistribution,
    selected_probability: 1,
  };
}

function normalizeResponseConfigurationSelection(
  rawSelection,
  { state, classification, tutorLearnerDag, raw, learnerText = '' },
) {
  if (!state.register?.enabled) return null;
  const palette = new Set(state.register.palette || []);
  const policy = state.register?.policy || 'dynamic';
  if (policy === 'random') {
    rawSelection = randomEngagementStanceSelection({ state, classification });
  } else if (policy === 'negative') {
    rawSelection = negativeEngagementStanceSelection({ state, classification });
  } else if (policy === 'field') {
    rawSelection = fieldEngagementStanceSelection({ state, classification, tutorLearnerDag });
  } else if (policy === 'trajectory') {
    rawSelection = trajectoryEngagementStanceSelection({ state, classification, tutorLearnerDag });
  } else if (policy === 'dynamical_system') {
    rawSelection = dynamicalSystemEngagementStanceSelection({ state, classification, tutorLearnerDag });
  } else if (policy === 'empirical_dynamical_system') {
    rawSelection = dynamicalSystemEngagementStanceSelection({
      state,
      classification,
      tutorLearnerDag,
      useCorpusPrior: true,
    });
  } else if (policy === 'continuous_dynamical_system') {
    rawSelection = continuousDynamicalSystemEngagementStanceSelection({ state, classification, tutorLearnerDag });
  } else if (policy === 'continuous_empirical_dynamical_system') {
    rawSelection = continuousDynamicalSystemEngagementStanceSelection({
      state,
      classification,
      tutorLearnerDag,
      useCorpusPrior: true,
    });
  } else if (policy === 'state') {
    rawSelection = stateEngagementStanceSelection({ state, classification, tutorLearnerDag });
  } else if (policy === 'bland') {
    rawSelection = fixedBlandEngagementStanceSelection({ state, classification });
  }
  const normalizedRawSelection =
    typeof rawSelection === 'string' ? { engagement_stance: rawSelection } : rawSelection || {};
  const requested = String(
    normalizedRawSelection.engagement_stance ||
      normalizedRawSelection.selected_register ||
      normalizedRawSelection.register ||
      '',
  ).trim();
  const requestedResolution = resolveEngagementStance(requested);
  const requestedRegister = requestedResolution?.register || requested;
  const requestedIsKnown = Boolean(requestedRegister && palette.has(requestedRegister));
  const dynamicBriskBlocked = Boolean(
    requestedIsKnown &&
    policy === 'dynamic' &&
    requestedRegister === 'brisk' &&
    !shouldUseDynamicBrisk({ state, classification, assessment: tutorLearnerDag?.model?.assessment || {} }),
  );
  let source =
    policy === 'random'
      ? normalizedRawSelection
      : requestedIsKnown && !dynamicBriskBlocked
        ? normalizedRawSelection
        : fallbackRegisterSelection({ state, classification, tutorLearnerDag });
  source = composeRegisterPolicySelection({
    primarySelection: source,
    state,
    classification,
    tutorLearnerDag,
  });
  const comprehensionPressure = Number(
    tutorStubComprehensionFeatures(state.comprehension, {
      turn: tutorLearnerDag?.model?.turn ?? state.turns.length + 1,
    }).pressure || 0,
  );
  if (
    policy === 'dynamic' &&
    comprehensionPressure > 0 &&
    !['plain', 'warm', 'precise'].includes(
      String(source.engagement_stance || source.selected_register || source.register || ''),
    )
  ) {
    source = applyEngagementStanceOverride(source, 'plain', {
      register_reason: `Comprehension side-state overrode challenge pressure at ${comprehensionPressure}; use one immediate plain-language gloss.`,
      expected_dag_move: 'Hold learner-DAG advancement while the wording gap is repaired.',
      expected_field_move: 'Resolve the vocabulary or wording gap before asking for another proof move.',
      source: 'dynamic_comprehension_guard',
    });
  }
  const releasePacing = tutorStubReleasePacingSnapshot(state.releasePacing, state.world);
  if (
    comprehensionPressure === 0 &&
    releasePacing?.signal?.direction &&
    releasePacing.signal.direction !== 'steady' &&
    releasePacing.signal.source !== 'no_current_signal'
  ) {
    const requestedPace = releasePacing.signal.direction;
    const paceStance =
      requestedPace === 'accelerate'
        ? palette.has('brisk')
          ? 'brisk'
          : palette.has('precise')
            ? 'precise'
            : null
        : palette.has('warm')
          ? 'warm'
          : palette.has('plain')
            ? 'plain'
            : null;
    if (paceStance) {
      source = applyEngagementStanceOverride(source, paceStance, {
        register_reason:
          requestedPace === 'accelerate'
            ? `The learner asked for faster progress, so the tutor shifts to ${paceStance} while the clue-release controller brings one public clue forward.`
            : `The learner asked for more time, so the tutor shifts to ${paceStance} while the clue-release controller holds back new evidence.`,
        engagement_stance_reason:
          requestedPace === 'accelerate'
            ? `The learner asked for faster progress, so the tutor shifts to ${paceStance} while the clue-release controller brings one public clue forward.`
            : `The learner asked for more time, so the tutor shifts to ${paceStance} while the clue-release controller holds back new evidence.`,
        reviewer_signal: releasePacing.signal.reason,
        expected_dag_move:
          requestedPace === 'accelerate'
            ? 'Stage one newly available public clue and advance without re-testing a settled premise.'
            : 'Consolidate one public premise without releasing another clue yet.',
        expected_field_move:
          requestedPace === 'accelerate'
            ? 'Convert learner impatience into visible forward motion.'
            : 'Reduce pace pressure while preserving learner agency.',
        source: `learner_release_pacing_${requestedPace}`,
      });
    }
  }
  const learnerAdvance = tutorLearnerDag?.advance || tutorLearnerDag?.model?.learnerAdvance || null;
  if (
    policy === 'dynamic' &&
    comprehensionPressure === 0 &&
    learnerAdvance?.accelerated &&
    tutorLearnerDag?.model?.assessment?.finalSecretEntailed !== true &&
    tutorLearnerDag?.model?.assessment?.assertedSecret !== true
  ) {
    const currentStanceForAcceleration = String(
      source.engagement_stance || source.selected_register || source.register || 'plain',
    );
    const acceleratedStance = palette.has('brisk')
      ? 'brisk'
      : palette.has('precise')
        ? 'precise'
        : currentStanceForAcceleration;
    source = applyEngagementStanceOverride(source, acceleratedStance, {
      register_reason: `Learner-owned acceleration guard: ${learnerAdvance.supportedMoveCount} warranted proof moves were accepted, so the stance shifts to ${acceleratedStance} and tests only the next unresolved edge.`,
      engagement_stance_reason: `Learner-owned acceleration guard: ${learnerAdvance.supportedMoveCount} warranted proof moves were accepted, so the stance shifts to ${acceleratedStance} and tests only the next unresolved edge.`,
      reviewer_signal: `accelerating learner supplied ${learnerAdvance.supportedMoveCount} warranted proof moves`,
      expected_dag_move:
        'Preserve the entire learner-supplied chain and ask only about the next unresolved public proof edge.',
      expected_field_move: 'Match the learner’s quicker pace without forcing a restatement of already warranted steps.',
      source: 'dynamic_learner_acceleration_guard',
    });
  }
  const pressureProbeTurn = tutorLearnerDag?.model?.turn ?? state.turns.length + 1;
  if (predeclaredPressureTurns().has(pressureProbeTurn)) {
    source = applyEngagementStanceOverride(source, 'face_threat', {
      register_reason: `Predeclared pressure probe: hostile register forced at learner turn ${pressureProbeTurn} by design, independent of the register policy. The policy resumes control next turn.`,
      expected_dag_move: 'Learner-DAG advancement may stall or regress this turn; recovery is measured afterward.',
      expected_field_move: 'Interactional pressure spikes by design this turn.',
      source: 'predeclared_pressure_probe',
      predeclared_pressure: true,
    });
  }
  const selectedRaw = String(source.engagement_stance || source.selected_register || source.register || '').trim();
  const selectedResolution = resolveEngagementStance(selectedRaw, { fallback: 'precise' });
  const selected = selectedResolution?.register || selectedRaw;
  const definition = getEngagementStanceDefinition(selected) || {};
  const requestType = String(
    source.request_type ||
      selectedResolution?.request_type ||
      classification?.turn?.request_type ||
      classification?.turn?.discourse_move ||
      'unknown',
  );
  const proposedActionFamily = String(source.action_family || selectedResolution?.action_family || '');
  const policyStack = tutorStubRegisterPolicyStackId(policy, state.register?.overlays || []);
  const configurationInputs = {
    engagementStance: selected,
    legacySelectedRegister: source.legacy_selected_register || selectedResolution?.legacy_selected_register || null,
    stanceDistribution: source.engagement_stance_distribution || source.distribution || null,
    stanceVector: source.engagement_stance_vector || source.register_vector || null,
    temperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    policy: policyStack,
    learnerText,
    classification,
    tutorLearnerDag,
    comprehension: tutorStubComprehensionFeatures(state.comprehension, {
      turn: tutorLearnerDag?.model?.turn ?? state.turns.length + 1,
    }),
    world: state.world,
    proposedActionFamily: proposedActionFamily || null,
    releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
    dueEvidence: currentReleaseRows(state, tutorLearnerDag?.model?.turn ?? state.turns.length + 1),
    recentActorialParts: (state.register?.history || [])
      .map((entry) => entry.actorial_part || entry.response_configuration?.actorial_part)
      .filter(Boolean),
  };
  let responseConfiguration = buildTutorStubResponseConfiguration(configurationInputs);
  if (
    registerTemperatureApplies(policy) &&
    responseConfiguration.actorial_part_selection?.distribution?.length &&
    responseConfiguration.actorial_part_selection.locked !== true
  ) {
    const sampledPart = sampleTutorStubPolicyDistribution(
      responseConfiguration.actorial_part_selection.distribution.map((row) => ({
        register: row.part,
        weight: row.weight,
        probability: row.probability,
      })),
      policySamplingContext(state, 'actorial_part'),
    );
    const sampledSelection = selectTutorStubActorialPart({
      engagementStance: configurationInputs.engagementStance,
      stanceDistribution: configurationInputs.stanceDistribution,
      actionFamily: responseConfiguration.action_family,
      temperature: configurationInputs.temperature,
      classification,
      tutorLearnerDag,
      comprehension: configurationInputs.comprehension,
      world: state.world,
      dueEvidence: configurationInputs.dueEvidence,
      recentActorialParts: configurationInputs.recentActorialParts,
      selectedPartOverride: sampledPart.entry?.register || responseConfiguration.actorial_part,
    });
    sampledSelection.random = sampledPart.audit;
    responseConfiguration = buildTutorStubResponseConfiguration({
      ...configurationInputs,
      actorialPartOverride: sampledSelection,
    });
  }
  const actionFamily = responseConfiguration.action_family;
  const reviewerSignal = String(
    source.reviewer_signal ||
      source.register_signal ||
      source.learner_signal ||
      source.learnerSignal ||
      classification?.turn?.pedagogical_need ||
      requestType,
  );
  const selection = {
    schema: 'machinespirits.tutor-stub.response-configuration-selection.v4',
    register_ontology_version: getRegisterOntologyVersion(),
    policy: policyStack,
    primary_policy: policy,
    overlay_policies: [...(state.register?.overlays || [])],
    activated_policy: source.policy_composition?.activated_overlay || policy,
    policy_composition: source.policy_composition || null,
    turn: tutorLearnerDag?.model?.turn ?? state.turns.length + 1,
    engagement_stance: selected,
    selected_register: selected,
    selected_mode: selected,
    legacy_selected_register:
      source.legacy_selected_register ||
      selectedResolution?.legacy_selected_register ||
      preferredLegacyRegister({ register: selected, requestType, actionFamily }),
    action_family: actionFamily || null,
    audience_register: responseConfiguration.audience_register,
    lexical_accessibility: responseConfiguration.lexical_accessibility,
    scene_immersion: responseConfiguration.scene_immersion,
    actorial_part: responseConfiguration.actorial_part,
    actorial_part_label: responseConfiguration.actorial_part_label,
    actorial_part_selection: responseConfiguration.actorial_part_selection,
    actorial_performance: responseConfiguration.actorial_performance,
    unresolved_terms: responseConfiguration.unresolved_terms,
    valence: definition.valence || null,
    router_selectable: definition.router_selectable === true,
    simulated_only: definition.simulated_only === true,
    request_type: requestType,
    reviewer_signal: reviewerSignal,
    learner_signal: requestType,
    engagement_stance_reason: String(
      source.engagement_stance_reason || source.stance_reason || source.register_reason || source.reason || '',
    ),
    register_reason: String(
      source.engagement_stance_reason || source.stance_reason || source.register_reason || source.reason || '',
    ),
    evidence_span: String(source.evidence_span || source.evidence || ''),
    risk_flags: Array.isArray(source.risk_flags) ? source.risk_flags.map(String) : [],
    expected_dag_move: String(source.expected_dag_move || ''),
    expected_field_move: String(source.expected_field_move || source.expected_learner_field_move || ''),
    expected_progress_marker: String(source.expected_progress_marker || ''),
    temperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    engagement_stance_temperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    temperature_scope: 'engagement_stance_and_actorial_part',
    confidence: Number.isFinite(Number(source.confidence)) ? Number(source.confidence) : null,
    selected_probability: Number.isFinite(Number(source.selected_probability))
      ? Number(source.selected_probability)
      : null,
    distribution: Array.isArray(source.distribution) ? source.distribution : null,
    engagement_stance_distribution: Array.isArray(source.engagement_stance_distribution)
      ? source.engagement_stance_distribution
      : Array.isArray(source.distribution)
        ? source.distribution
        : null,
    pre_override_engagement_stance_distribution: Array.isArray(
      source.pre_override_engagement_stance_distribution,
    )
      ? source.pre_override_engagement_stance_distribution
      : null,
    register_vector:
      source.register_vector && typeof source.register_vector === 'object' ? source.register_vector : null,
    engagement_stance_vector:
      source.engagement_stance_vector && typeof source.engagement_stance_vector === 'object'
        ? source.engagement_stance_vector
        : source.register_vector && typeof source.register_vector === 'object'
          ? source.register_vector
          : null,
    register_vector_entropy_bits: Number.isFinite(Number(source.register_vector_entropy_bits))
      ? Number(source.register_vector_entropy_bits)
      : null,
    field_policy: source.field_policy || null,
    trajectory_policy: source.trajectory_policy || null,
    dynamical_system_policy: source.dynamical_system_policy || null,
    continuous_register_policy: source.continuous_register_policy || null,
    response_configuration: responseConfiguration,
    state_policy: source.state_policy || null,
    source: source.source || 'combined_learner_analysis',
    ...(source.predeclared_pressure === true ? { predeclared_pressure: true } : {}),
    random: source.random || null,
    model: raw ? { provider: raw.provider, model: raw.model, latencyMs: raw.latencyMs, usage: raw.usage } : null,
    selectedAtDag: tutorLearnerDag?.model || null,
    efficacy: null,
  };
  if (source.warning) {
    selection.warning = source.warning;
  } else if (!requestedIsKnown && selection.source === 'combined_learner_analysis') {
    selection.warning = source.warning || `invalid_register_selection:${requested || 'missing'}`;
  } else if (dynamicBriskBlocked) {
    selection.warning = 'dynamic_policy_brisk_demoted';
    selection.original_register = requested;
  }
  selection.response_configuration.compatibility.legacy_selected_register = selection.legacy_selected_register;
  state.register.history.push(selection);
  state.register.current = selection;
  return selection;
}

function emptyTutorLearnerDagModel(state, tutorTurn, dagPreflight = null) {
  const record = state.learnerDag.record;
  const world = state.world;
  const previousModel = state.learnerDag.lastModel || state.turns?.at(-1)?.tutorLearnerDagModel || null;
  const dagFactDropout = applyTutorStubDagFactDropout({
    dropout: state.learnerDag.dropout,
    board: record.board,
    world,
    turn: tutorTurn,
  });
  const snapshot = buildLearnerDagSnapshot(world, {
    turn: tutorTurn,
    boardFacts: [...record.board.values()],
    validFacts: [...record.board.values()],
    voiced: record.voiced,
    hypotheses: record.hypotheses,
    ledger: publicReleaseLedger(state, tutorTurn),
    source: 'tutor_stub_tutor_learner_dag_model',
  });
  record.snapshots.push(snapshot);
  const learnerDag = buildLearnerDag(record.snapshots, world);
  const proxyDagMemory = buildLearnerProxyDagMemory({
    turn: tutorTurn,
    questionPattern: world.questionPattern,
    rules: world.rules,
    groundedFacts: [...record.board.values()],
    voiced: record.voiced,
    hypotheses: record.hypotheses,
    factSurface: (fact) => factSurface(world, fact),
  });
  const model = buildTutorLearnerDagModel({
    turn: tutorTurn,
    role: 'tutor',
    proxyDagMemory,
    assessment: learnerDag.assessment,
  });
  model.memoryReliability = dagFactDropout
    ? {
        schema: TUTOR_STUB_DAG_FACT_DROPOUT_SCHEMA,
        configuredRate: dagFactDropout.configuredRate,
        activeDroppedCount: dagFactDropout.activeDropped.length,
        droppedThisTurn: dagFactDropout.droppedNow.length,
        repairedThisTurn: dagFactDropout.repairedNow.length,
        visibility: 'conduct',
      }
    : null;
  const advance = buildTutorStubLearnerAdvance({ beforeModel: previousModel, afterModel: model });
  model.learnerAdvance = advance;
  return { model, dagFactDropout, advance, preflight: dagPreflight };
}

async function buildTutorLearnerDagForTurn(
  learnerText,
  state,
  { dagPreflight = null, signal = null, isCurrent = null } = {},
) {
  if (!state.learnerDag.enabled || !state.world) return null;
  const tutorTurn = state.turns.length + 1;
  startInterimAnimation(state, 'modeling learner DAG', { learnerText, tutorTurn });
  try {
    const update = await extractLearnerRecordUpdate({ learnerText, state, tutorTurn, dagPreflight, signal });
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    const result = applyLearnerRecordUpdate({
      update,
      state,
      tutorTurn,
      learnerText,
      ...learnerPublicEvidenceState(state, tutorTurn),
    });
    result.preflight = dagPreflight;
    state.learnerDag.lastModel = result.model;
    stopInterimAnimation(state);
    printAutomaticTechnicalDetails(state, () => printTutorLearnerDagModel(result));
    return result;
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    const empty = emptyTutorLearnerDagModel(state, tutorTurn, dagPreflight);
    const model = empty.model;
    const result = {
      model,
      preflight: dagPreflight,
      advance: empty.advance,
      dagFactDropout: empty.dagFactDropout,
      accepted: {
        adopt: [],
        retract: [],
        derive: [],
        hypothesis: null,
        assertAnswer: null,
        humanDiscourse: normalizeHumanDiscourseExtraction(),
      },
      rejected: [],
      extractor: {
        error: err.message,
        provider: state.learnerDag.resolved.provider,
        model: state.learnerDag.resolved.model,
      },
    };
    state.learnerDag.lastModel = result.model;
    stopInterimAnimation(state);
    printAutomaticTechnicalDetails(state, () => printTutorLearnerDagModel(result));
    return result;
  }
}

function updateComprehensionForLearnerTurn({ learnerText, state, classification, tutorTurn, recordTrace = true }) {
  const request = detectTutorStubComprehensionRequest({
    text: learnerText,
    classification,
    source: 'learner_turn',
    turn: tutorTurn,
  });
  const previous = state.comprehension?.lastRequest || null;
  const duplicate = Boolean(
    request.detected &&
    previous &&
    Number(previous.turn) === Number(request.turn) &&
    previous.source === request.source &&
    previous.text === request.text,
  );
  if (request.detected) {
    if (duplicate) {
      if (request.requestType) previous.requestType = request.requestType;
    } else {
      applyTutorStubComprehensionRequest(state.comprehension, request);
    }
    if (recordTrace) {
      appendTraceEvent(state.trace, {
        type: 'comprehension_request',
        turn: tutorTurn,
        source: request.source,
        requestType: request.requestType,
        terms: request.terms,
        generic: request.generic,
        text: request.text,
        deduplicated: duplicate,
        advancesLearnerDag: false,
        state: tutorStubComprehensionSnapshot(state.comprehension, { turn: tutorTurn }),
      });
    }
  }
  return {
    request,
    snapshot: tutorStubComprehensionSnapshot(state.comprehension, { turn: tutorTurn }),
  };
}

function updateReleasePacingForLearnerTurn({
  learnerText,
  state,
  classification,
  tutorLearnerDag,
  tutorTurn,
  recordTrace = true,
}) {
  const releasePacing = advanceTutorStubReleasePacing({
    pacing: state.releasePacing,
    world: state.world,
    turn: tutorTurn,
    learnerText,
    classification,
    tutorLearnerDag,
  });
  if (!releasePacing) return null;
  if (recordTrace) {
    appendTraceEvent(state.trace, {
      type: 'release_pacing_update',
      turn: tutorTurn,
      direction: releasePacing.direction,
      baseSpeed: releasePacing.baseSpeed,
      effectiveSpeed: releasePacing.effectiveSpeed,
      signal: releasePacing.signal,
      dueNow: releasePacing.dueNow,
      nextRelease: releasePacing.nextRelease,
      releasePacing,
    });
  }
  return releasePacing;
}

async function analyzeLearnerTurnCombined(
  learnerText,
  state,
  { precomputedRaw = null, signal = null, isCurrent = null, tutorFeedback = null } = {},
) {
  const tutorTurn = state.turns.length + 1;
  const startedAt = Date.now();
  updateComprehensionForLearnerTurn({
    learnerText,
    state,
    classification: null,
    tutorTurn,
    recordTrace: false,
  });
  startInterimAnimation(state, 'analyzing learner', { learnerText, tutorTurn });
  let raw = precomputedRaw?.dagPreflight ? precomputedRaw : null;
  if (precomputedRaw && !precomputedRaw.dagPreflight) {
    appendTraceEvent(state.trace, {
      type: 'learner_dag_preflight_cache_rejected',
      turn: tutorTurn,
      reason: 'missing_pre_model_preflight',
    });
  }

  try {
    raw = raw || (await extractCombinedLearnerAnalysis({ learnerText, state, tutorTurn, tutorFeedback, signal }));
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    const classification = classificationFromCombinedAnalysis(raw, state);
    const update = learnerRecordFromCombinedAnalysis(raw);
    const tutorLearnerDag = applyLearnerRecordUpdate({
      update,
      state,
      tutorTurn,
      learnerText,
      ...learnerPublicEvidenceState(state, tutorTurn),
    });
    tutorLearnerDag.preflight = raw.dagPreflight || null;
    applyLearnerAdvanceAssessment(classification, tutorLearnerDag);
    state.learnerDag.lastModel = tutorLearnerDag.model;
    updateComprehensionForLearnerTurn({ learnerText, state, classification, tutorTurn });
    updateReleasePacingForLearnerTurn({ learnerText, state, classification, tutorLearnerDag, tutorTurn });
    const previousRegisterEfficacy = evaluatePendingRegisterEfficacy(
      state,
      tutorLearnerDag,
      classification,
      tutorFeedback,
    );
    const registerSelection = normalizeResponseConfigurationSelection(registerSelectionFromCombinedAnalysis(raw), {
      state,
      classification,
      tutorLearnerDag,
      raw,
      learnerText,
    });
    stopInterimAnimation(state);
    printAutomaticTechnicalDetails(state, () => {
      printClassification(classification);
      printTutorLearnerDagModel(tutorLearnerDag);
      printResponseConfigurationSelection(registerSelection, previousRegisterEfficacy);
    });
    return { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy };
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    const classification = failedClassification({
      message: err.message,
      resolved: state.learnerDag.resolved,
      latencyMs: Date.now() - startedAt,
    });
    const empty = emptyTutorLearnerDagModel(state, tutorTurn, raw?.dagPreflight || null);
    const model = empty.model;
    const tutorLearnerDag = {
      model,
      preflight: raw?.dagPreflight || null,
      advance: empty.advance,
      dagFactDropout: empty.dagFactDropout,
      accepted: {
        adopt: [],
        retract: [],
        derive: [],
        hypothesis: null,
        assertAnswer: null,
        humanDiscourse: normalizeHumanDiscourseExtraction(),
      },
      rejected: [],
      extractor: {
        error: err.message,
        provider: state.learnerDag.resolved.provider,
        model: state.learnerDag.resolved.model,
      },
    };
    state.learnerDag.lastModel = tutorLearnerDag.model;
    updateComprehensionForLearnerTurn({ learnerText, state, classification, tutorTurn });
    updateReleasePacingForLearnerTurn({ learnerText, state, classification, tutorLearnerDag, tutorTurn });
    const previousRegisterEfficacy = evaluatePendingRegisterEfficacy(
      state,
      tutorLearnerDag,
      classification,
      tutorFeedback,
    );
    const registerSelection = normalizeResponseConfigurationSelection(null, {
      state,
      classification,
      tutorLearnerDag,
      raw: null,
      learnerText,
    });
    stopInterimAnimation(state);
    printAutomaticTechnicalDetails(state, () => {
      printClassification(classification);
      printTutorLearnerDagModel(tutorLearnerDag);
      printResponseConfigurationSelection(registerSelection, previousRegisterEfficacy);
    });
    return { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy };
  }
}

async function analyzeLearnerTurn(
  learnerText,
  state,
  { precomputedRaw = null, signal = null, isCurrent = null, tutorFeedback = null } = {},
) {
  printWithConcurrentTerminal(state, () => printTurnDebugLine(state, state.turns.length + 1));
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  if (state.classifier.enabled && state.learnerDag.enabled && state.world) {
    return await analyzeLearnerTurnCombined(learnerText, state, {
      precomputedRaw,
      signal,
      isCurrent,
      tutorFeedback,
    });
  }

  updateComprehensionForLearnerTurn({
    learnerText,
    state,
    classification: null,
    tutorTurn: state.turns.length + 1,
    recordTrace: false,
  });
  const dagPreflight = learnerDagPreflightForTurn(state, state.turns.length + 1, {
    traceSource: 'separate_classifier_and_learner_record',
  });
  const classification = await classifyForTurn(learnerText, state, { signal });
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  updateComprehensionForLearnerTurn({
    learnerText,
    state,
    classification,
    tutorTurn: state.turns.length + 1,
  });
  const tutorLearnerDag = await buildTutorLearnerDagForTurn(learnerText, state, {
    dagPreflight,
    signal,
    isCurrent,
  });
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  applyLearnerAdvanceAssessment(classification, tutorLearnerDag);
  updateReleasePacingForLearnerTurn({
    learnerText,
    state,
    classification,
    tutorLearnerDag,
    tutorTurn: state.turns.length + 1,
  });
  const previousRegisterEfficacy = evaluatePendingRegisterEfficacy(
    state,
    tutorLearnerDag,
    classification,
    tutorFeedback,
  );
  const registerSelection = normalizeResponseConfigurationSelection(null, {
    state,
    classification,
    tutorLearnerDag,
    raw: null,
    learnerText,
  });
  printAutomaticTechnicalDetails(state, () =>
    printResponseConfigurationSelection(registerSelection, previousRegisterEfficacy),
  );
  return { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy };
}

function printTutorLearnerDagModel(result) {
  if (!result?.model) return;
  const model = result.model;
  const metrics = model.metrics || {};
  const assessment = model.assessment || {};
  const buckets = Object.entries(assessment.missingPremiseBuckets || {})
    .map(([bucket, count]) => `${bucket}:${count}`)
    .join(', ');
  const warning = result.extractor?.error || result.extractor?.parseError;
  console.log(
    `${C.cyan}tutor learner-DAG model >${C.reset} coverage ${assessment.bestPathCoverage ?? 'n/a'}; bottleneck ${
      assessment.bottleneck || 'unknown'
    }`,
  );
  const dropout = result.dagFactDropout || null;
  if (dropout?.droppedNow?.length || dropout?.repairedNow?.length || dropout?.activeDropped?.length) {
    const parts = [
      dropout.droppedNow?.length ? `${dropout.droppedNow.length} slipped now` : null,
      dropout.repairedNow?.length ? `${dropout.repairedNow.length} re-adopted` : null,
      `${dropout.activeDropped?.length || 0} currently dropped`,
    ].filter(Boolean);
    console.log(`${C.dim}  accumulated evidence memory: ${parts.join('; ')}${C.reset}`);
  }
  console.log(
    `${C.dim}  grounded ${metrics.groundedCount || 0}, voiced ${metrics.voicedDerivedCount || 0}, hypotheses ${
      metrics.hypothesisCount || 0
    }, answer candidates ${metrics.answerCandidateCount || 0}${buckets ? `; missing ${buckets}` : ''}${C.reset}`,
  );
  if (result.accepted?.adopt?.length || result.accepted?.derive?.length || result.accepted?.hypothesis) {
    console.log(
      `${C.dim}  update: adopted ${result.accepted.adopt.length}, derived ${result.accepted.derive.length}${
        result.accepted.hypothesis ? ', hypothesis noted' : ''
      }${C.reset}`,
    );
  }
  if (result.advance?.accelerated) {
    console.log(
      `${C.brightGreen}  learner pace: accelerating — ${result.advance.supportedMoveCount} warranted proof moves accepted in this turn${C.reset}`,
    );
  }
  if (warning) console.log(`${C.red} learner-DAG model warning${C.reset}${C.dim}: ${warning}${C.reset}`);
}

function printResponseConfigurationSelection(selection, previousEfficacy = null) {
  if (previousEfficacy) {
    const fieldDelta = formatSignedInterimNumber(previousEfficacy.field?.delta, { decimals: 3 }) || '0';
    const mismatch = previousEfficacy.mismatch ? `; ${previousEfficacy.mismatch}; field ${fieldDelta}` : '';
    console.log(
      `${C.cyan}stance efficacy >${C.reset} ${
        previousEfficacy.engagement_stance || previousEfficacy.selected_register
      } ${previousEfficacy.label}${mismatch} (${previousEfficacy.summary})`,
    );
    if (previousEfficacy.learnerFeedback?.rating) {
      console.log(
        `${C.dim}  explicit learner rating: ${previousEfficacy.learnerFeedback.rating === 'up' ? '👍 helpful' : '👎 not helpful'}; self-assessment ${previousEfficacy.selfAssessmentLabel}${C.reset}`,
      );
    }
  }
  if (!selection) return;
  const warning = selection.warning ? ` ${C.red}${selection.warning}${C.reset}` : '';
  const confidence = selection.confidence !== null ? `; confidence ${selection.confidence}` : '';
  const source =
    selection.source && selection.source !== 'combined_learner_analysis' ? `; source ${selection.source}` : '';
  console.log(
    `${C.cyan}engagement stance >${C.reset} ${
      selection.engagement_stance || selection.selected_register
    }${confidence}${source}${warning}`,
  );
  if (Number.isFinite(Number(selection.temperature))) {
    console.log(
      `${C.dim}  adaptive-performance temperature: ${selection.temperature} (stance + part; lower sharper, higher broader)${C.reset}`,
    );
  }
  if (selection.policy_composition) {
    const composition = selection.policy_composition;
    console.log(
      `${C.dim}  policy stack: ${composition.policy_stack}; overlay threshold ${composition.overlay_threshold}; activated ${
        composition.activated_overlay || 'primary'
      }${C.reset}`,
    );
  }
  const distribution = formatEngagementStanceDistribution(selection.distribution);
  if (distribution) console.log(`${C.dim}  distribution: ${distribution}${C.reset}`);
  if (selection.continuous_register_policy?.dominant_blend) {
    console.log(
      `${C.dim}  continuous blend: ${selection.continuous_register_policy.dominant_blend}; entropy ${
        selection.continuous_register_policy.entropy_bits ?? 'n/a'
      } bits${C.reset}`,
    );
  }
  if (selection.request_type || selection.reviewer_signal) {
    console.log(
      `${C.dim}  request: ${selection.request_type || 'unknown'}; action: ${
        selection.action_family || 'none'
      }; reviewer signal: ${selection.reviewer_signal || 'unknown'}${C.reset}`,
    );
  }
  console.log(
    `${C.dim}  audience: ${selection.audience_register || 'unknown'}; lexical: ${
      selection.lexical_accessibility || 'unknown'
    }; scene: ${selection.scene_immersion || 'unknown'}; part: ${
      selection.actorial_part_label || selection.actorial_part || 'unknown'
    }${C.reset}`,
  );
  if (selection.actorial_part_selection?.distribution) {
    console.log(
      `${C.dim}  part distribution: ${selection.actorial_part_selection.distribution
        .slice(0, 4)
        .map((row) => `${displayDiagnosticLabel(row.part)} ${Math.round(Number(row.probability || 0) * 100)}%`)
        .join(', ')}; reason: ${selection.actorial_part_selection.reason || 'n/a'}${C.reset}`,
    );
  }
  if (selection.register_reason) console.log(`${C.dim}  reason: ${selection.register_reason}${C.reset}`);
  if (selection.expected_dag_move) console.log(`${C.dim}  expected DAG move: ${selection.expected_dag_move}${C.reset}`);
  if (selection.expected_field_move) {
    const effectivePolicy = selection.activated_policy || selection.primary_policy || selection.policy;
    const expectedMoveLabel =
      effectivePolicy === 'state'
        ? 'expected state move'
        : effectivePolicy === 'trajectory'
          ? 'expected trajectory move'
          : effectivePolicy === 'dynamical_system' ||
              effectivePolicy === 'empirical_dynamical_system' ||
              effectivePolicy === 'continuous_dynamical_system' ||
              effectivePolicy === 'continuous_empirical_dynamical_system'
            ? 'expected dynamical move'
            : 'expected field move';
    console.log(`${C.dim}  ${expectedMoveLabel}: ${selection.expected_field_move}${C.reset}`);
  }
}

function responseConfigurationContext(
  selection,
  { multipleChoice = false, humanDiscourseFrame = null, dialogueClosureFrame = null, world = null } = {},
) {
  if (!selection) return '';
  const generousInference = humanDiscourseFrame?.generousInference || null;
  const engagementStance = selection.engagement_stance || selection.selected_register;
  const definition = getEngagementStanceDefinition(engagementStance) || {};
  const effectivePolicy = selection.activated_policy || selection.primary_policy || selection.policy;
  const expectedMoveLabel =
    effectivePolicy === 'state'
      ? 'Expected learner-state move'
      : effectivePolicy === 'trajectory'
        ? 'Expected learner-trajectory move'
        : effectivePolicy === 'dynamical_system' ||
            effectivePolicy === 'empirical_dynamical_system' ||
            effectivePolicy === 'continuous_dynamical_system' ||
            effectivePolicy === 'continuous_empirical_dynamical_system'
          ? 'Expected learner-dynamical move'
          : 'Expected learner-field move';
  const continuousStyleInstruction = String(selection.continuous_register_policy?.style_instruction || '').trim();
  const vectorSummary =
    selection.continuous_register_policy?.dominant_blend ||
    (selection.register_vector
      ? Object.entries(selection.register_vector)
          .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))
          .map(([register, weight]) => `${register} ${Math.round(Number(weight || 0) * 100)}%`)
          .join(', ')
      : '');
  const guardrails = [
    ...(Array.isArray(definition.forbidden_phrases) && definition.forbidden_phrases.length
      ? [`Forbidden phrase families: ${definition.forbidden_phrases.join(', ')}`]
      : []),
    definition.recognition_guardrail ? `Recognition guardrail: ${definition.recognition_guardrail}` : null,
    selection.simulated_only
      ? 'This is a simulated-only register; do not use it unless the operator explicitly enabled it.'
      : null,
  ].filter(Boolean);
  const responseConfiguration = selection.response_configuration || {
    engagement_stance: engagementStance,
    action_family: selection.action_family,
    audience_register: selection.audience_register,
    lexical_accessibility: selection.lexical_accessibility,
    scene_immersion: selection.scene_immersion,
    actorial_part: selection.actorial_part,
    actorial_part_label: selection.actorial_part_label,
    actorial_part_selection: selection.actorial_part_selection,
    actorial_performance:
      selection.actorial_performance ||
      selectTutorStubActorialPerformance({
        engagementStance,
        actorialPart: selection.actorial_part,
      }),
    unresolved_terms: selection.unresolved_terms || [],
  };
  const typedAction = selection.typed_action_decision?.chosen_action || null;
  const typedActionContext = typedAction
    ? [
        '[Tutor-only typed pedagogical action]',
        `Action type: ${typedAction.action_type}`,
        `Move family: ${typedAction.move_family}`,
        `Support level: ${typedAction.support_level} of 3`,
        `Task: ${typedAction.task_id}`,
        `Knowledge component: ${typedAction.knowledge_component}`,
        `Prerequisite path: ${typedAction.prerequisite_path.join(' -> ') || 'none specified'}`,
        `Item difficulty: ${typedAction.item_difficulty}`,
        `Expected learner evidence: ${typedAction.expected_evidence.success.join(', ') || 'none specified'}`,
        `Forbidden learner evidence: ${typedAction.expected_evidence.failure.join(', ') || 'none specified'}`,
        `Responsibility owner: ${typedAction.responsibility_owner}`,
        'The move family, support level, engagement stance, and task are independent controls. Realize each exactly as selected; do not infer one from another.',
        '[End tutor-only typed pedagogical action]',
      ].join('\n')
    : null;
  return [
    tutorStubResponseConfigurationPrompt(responseConfiguration),
    typedActionContext,
    '[Tutor-only response-policy evidence]',
    `Selected engagement stance: ${engagementStance}`,
    selection.policy_composition ? `Policy stack: ${selection.policy_composition.policy_stack}` : null,
    selection.policy_composition
      ? `Policy decision: ${selection.policy_composition.activated_overlay || 'primary policy retained'}; overlay threshold ${
          selection.policy_composition.overlay_threshold
        }.`
      : null,
    selection.legacy_selected_register ? `Legacy register alias: ${selection.legacy_selected_register}` : null,
    `Valence: ${selection.valence || 'unknown'}`,
    `Logical request type: ${selection.request_type || selection.learner_signal || 'unknown'}`,
    `Action family: ${selection.action_family || 'none'}`,
    `Reviewer signal: ${selection.reviewer_signal || 'unknown'}`,
    `Reason: ${selection.register_reason || 'No reason supplied.'}`,
    Number.isFinite(Number(selection.temperature))
      ? `Adaptive-performance temperature: ${selection.temperature} (applies to the engagement-stance and actorial-part distributions; lower means sharper and higher means broader).`
      : null,
    vectorSummary ? `Continuous register vector: ${vectorSummary}` : null,
    continuousStyleInstruction || null,
    `Expected learner-DAG move: ${selection.expected_dag_move || 'No expected move supplied.'}`,
    `${expectedMoveLabel}: ${selection.expected_field_move || 'No expected state/field move supplied.'}`,
    guardrails.length ? 'Guardrails:' : null,
    ...guardrails,
    'Write the next tutor message so the engagement stance, independent action family, actorial part, audience register, lexical accessibility, and scene immersion are all visible without naming the configuration, classifier, or learner-DAG machinery.',
    multipleChoice
      ? `Keep the turn compact. In story mode, if you use multiple choice, offer 2-4 short public evidence options and invite the learner to choose or write their own ${worldLedgerTerm(world)} line.`
      : "Keep the turn compact. In story mode, give one live issue and one light prompt for the learner's next thought; do not require a full warranted claim unless the learner is making an unsafe or case-closing leap.",
    generousInference?.applied
      ? `Human-scaffold override: the learner has already answered the immediately preceding local question by unambiguous context. This overrides any expected DAG/state/field move that would ask for a restatement, name, premise, warrant, or ${worldLedgerTerm(world)} version of the same answer. Acknowledge it and advance to a genuinely new pressure.`
      : null,
    dialogueClosureFrame?.mandatory
      ? 'Dialogue-closure override: the proof is complete for this dialogue. Closure now overrides every expected DAG/state/field move. Do not solicit another proof step.'
      : dialogueClosureFrame?.available
        ? 'Dialogue-closure override: the authored public proof is complete. If this response states the final verdict, it must close the inquiry rather than reopening another proof step.'
        : null,
    '[End tutor-only response-policy evidence]',
  ]
    .filter(Boolean)
    .join('\n');
}

function tutorPromptSurfaceKey(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function tutorLearnerDagModelContext(result, { releasedEvidence = [] } = {}) {
  const model = result?.model || result;
  if (!model) return '';
  const metrics = model.metrics || {};
  const assessment = model.assessment || {};
  const record = model.learnerRecord || {};
  const memoryReliability = model.memoryReliability || null;
  const groundedRows = Array.isArray(record.grounded) ? record.grounded : [];
  const groundedSurfaceKeys = new Set(groundedRows.map((row) => tutorPromptSurfaceKey(row?.surface)).filter(Boolean));
  const groundedReleasedCount = (Array.isArray(releasedEvidence) ? releasedEvidence : []).filter((row) =>
    groundedSurfaceKeys.has(tutorPromptSurfaceKey(row?.surface)),
  ).length;
  const groundedOtherCount = Math.max(0, groundedRows.length - groundedReleasedCount);
  const groundingStatus = [
    groundedReleasedCount
      ? `- ${groundedReleasedCount} released public evidence item${groundedReleasedCount === 1 ? '' : 's'} currently learner-grounded; exact item labels appear in the public evidence window.`
      : '- no released public evidence is currently learner-grounded',
    groundedOtherCount
      ? `- ${groundedOtherCount} additional public or derived fact${groundedOtherCount === 1 ? '' : 's'} currently grounded`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
  const hypotheses = (record.hypotheses || []).map((row) => `- ${row.text}`).join('\n') || '- none';
  const candidates = (record.answerCandidates || []).map((row) => `- ${row.surface}`).join('\n') || '- none';
  return [
    '[Tutor-only redacted learner-DAG model]',
    `Best-path coverage: ${assessment.bestPathCoverage ?? 'unavailable'}`,
    `Bottleneck: ${assessment.bottleneck || 'unavailable'}`,
    `Counts: grounded=${metrics.groundedCount || 0}, voiced=${metrics.voicedDerivedCount || 0}, hypotheses=${
      metrics.hypothesisCount || 0
    }, answerCandidates=${metrics.answerCandidateCount || 0}, missing=${metrics.missingPremiseCount || 0}`,
    memoryReliability?.activeDroppedCount
      ? `Memory reliability: ${memoryReliability.activeDroppedCount} previously accumulated public evidence item(s) are no longer active in the redacted record. Re-anchor gently from public evidence; do not announce forgetting, dropout, or an internal memory test.`
      : null,
    'Grounding status:',
    groundingStatus,
    'Learner hypotheses:',
    hypotheses,
    'Answer candidates derivable from the tutor model of the learner record:',
    candidates,
    'Use this as advisory context only. Do not mention DAGs, coverage, missing counts, hidden paths, or internal state.',
    '[End tutor-only redacted learner-DAG model]',
  ].join('\n');
}

function compactAuditRows(rows = [], limit = 3) {
  const visible = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      if (typeof row === 'string') return row.trim();
      const bits = [row?.surface, row?.warrantNeeded, row?.reason]
        .filter(Boolean)
        .map((value) => oneLine(value, { max: 120 }));
      return bits.join(' — ');
    })
    .filter(Boolean)
    .slice(0, limit);
  return visible.length ? visible.map((row) => `- ${row}`).join('\n') : '- none';
}

function humanDiscourseTutorContext(frame) {
  if (!frame || frame.mode === 'strict_dag') return '';
  const scaffold = frame.scaffoldState || {};
  const branch = scaffold.branch || {};
  const sideArc = frame.sideArc || {};
  const proofDebt = frame.proofDebt || {};
  const audit = frame.warrantPremiseAudit || {};
  const compression = frame.stepCompression || {};
  const generousInference = frame.generousInference || null;
  const questionSupport = frame.questionSupport || null;
  const due = scaffold.releaseState?.dueNow || [];
  const latest = scaffold.releaseState?.latestReleased || null;
  const promptRule =
    frame.mode === 'defeasible_human_scaffold'
      ? 'Treat plausible learner leaps as compressed human reasoning. Keep obvious omitted bridges as internal proof debt, and surface a warrant gap only when the leap is unsafe, conflicting, or would close the case.'
      : 'Frame one local warrant in ordinary language while preserving the strict proof audit; do not expand the whole proof chain or license the final answer early.';
  return [
    '[Tutor-only human discourse scaffold]',
    `Mode: ${frame.mode}; strict DAG remains the audit, but the learner-facing scaffold is active.`,
    compression.enabled
      ? `Step compression: on; ${compression.policy || 'accept obvious public bridges as implied'}; max explicit demands per turn ${compression.maxExplicitDemandsPerTurn ?? 1}.`
      : null,
    `Current branch: ${branch.label || branch.id || 'open scaffold'}.`,
    scaffold.localQuestion ? `Local question: ${scaffold.localQuestion}` : null,
    scaffold.warrantFrame ? `Warrant frame: ${scaffold.warrantFrame}` : null,
    scaffold.joinReminder ? `Join reminder: ${scaffold.joinReminder}` : null,
    due.length
      ? `Evidence available now: ${due
          .map(
            (row) =>
              `${row.via === 'director' ? 'scene evidence' : 'tutor exhibit'}: ${oneLine(row.surface, { max: 120 })}`,
          )
          .join(' | ')}`
      : latest
        ? `Latest public evidence: ${oneLine(latest.surface, { max: 140 })}`
        : null,
    generousInference.applied ? 'Contextual answer resolution: APPLIED with high confidence.' : null,
    generousInference.applied ? `Resolved learner move: ${generousInference.resolvedMeaning}` : null,
    generousInference.applied ? `Authoritative next-turn rule: ${generousInference.tutorInstruction}` : null,
    sideArc.detected
      ? `Side arc: ${sideArc.type}. Answer the learner's clarification/trust/affect need briefly, then ${sideArc.returnTarget?.afterSideArc || 'return to the local evidence question'}.`
      : 'Side arc: none detected; stay on the local warrant.',
    `Proof debt status: ${proofDebt.status || 'unknown'}; open=${proofDebt.counts?.open ?? 0}; harmful=${proofDebt.counts?.harmful ?? 0}.`,
    proofDebt.open?.length ? `Open proof debt:\n${compactAuditRows(proofDebt.open)}` : null,
    proofDebt.elision?.applied
      ? `Compressed bridge accepted: ${proofDebt.elision.count} ordinary warrant row(s) are elided from learner-facing demands.`
      : null,
    proofDebt.elision?.tutorInstruction || null,
    // proofDebt.open already contains every non-elided missing warrant. Rendering
    // audit.warrants.missing again duplicated learner-derived context and made the
    // prompt audit mistake repeated bookkeeping for repeated instructions.
    audit.premises?.suppressedOrPrivate?.length || audit.premises?.illicitHidden?.length
      ? `Hidden/private premise risk:\n${compactAuditRows([
          ...(audit.premises?.suppressedOrPrivate || []),
          ...(audit.premises?.illicitHidden || []),
        ])}`
      : null,
    promptRule,
    questionSupport
      ? `Question support: ${questionSupport.answerability}; modality ${questionSupport.modality}. ${questionSupport.reason}`
      : null,
    questionSupport?.tutorInstruction ? `Authoritative question rule: ${questionSupport.tutorInstruction}` : null,
    "Learner-facing behavior: use plain public evidence language, answer side clarifications briefly, and usually move with the learner's compressed inference rather than forcing them to spell out every link.",
    'When the learner skips an obvious public bridge, do not quiz them on it. Carry the bridge internally as implied proof debt and continue to the next useful pressure.',
    questionSupport?.answerability === 'direction_only_until_evidence_is_public'
      ? 'This epistemic-affordance rule overrides the local question, response action, and expected DAG move if any of them would ask the learner to supply unseen information.'
      : null,
    generousInference.applied
      ? 'The immediately preceding local question is closed for learner-facing purposes. Do not paraphrase it into another question, ask for a name, ask what it licenses, or request a public-record restatement. The strict learner-DAG may remain incomplete as an audit; that incompleteness must not control this spoken turn.'
      : null,
    'Ask for an explicit warrant only if the learner is about to name/confirm a suspect, contradicts public evidence, relies on unstaged evidence, or reaches a conclusion that would be false without the missing bridge.',
    'Default response shape: one short acknowledgement, one sentence naming the live evidence pressure, one light question. Avoid lists of routes, ledgers, or multiple required subclaims.',
    'Never mention scaffold state, proof debt, side arcs, DAGs, premise ids, rule ids, hidden facts, or release schedules.',
    '[End tutor-only human discourse scaffold]',
  ]
    .filter(Boolean)
    .join('\n');
}

function dialogueClosureTutorContext(frame) {
  if (!frame?.enabled || (!frame.mandatory && !frame.available)) return '';
  if (frame.phase === 'final_checkin_response') {
    return [
      '[Tutor-only dialogue closure]',
      'Phase: one final learner check-in after the case reached closure.',
      'Answer only the learner’s check-in from the public transcript. Do not introduce new evidence or restart the proof sequence.',
      'End with an explicit statement that the case, book, or inquiry is closed and complete.',
      'Do not ask any further question. This is the terminal tutor turn.',
      '[End tutor-only dialogue closure]',
    ].join('\n');
  }
  if (frame.mandatory) {
    return [
      '[Tutor-only dialogue closure]',
      `Closure basis: ${frame.basis}. The final conclusion is grounded and asserted; the dialogue must now wind down.`,
      'Briefly acknowledge the learner’s result and name the decisive public chain in ordinary language.',
      'Explicitly say that the case, book, or inquiry is closed. Do not ask another proof question.',
      frame.allowCheckIn
        ? 'You may end with one optional check-in about whether the learner wants one link revisited. If you ask it, it must be the only question.'
        : 'Do not ask a follow-up question; end the dialogue now.',
      '[End tutor-only dialogue closure]',
    ].join('\n');
  }
  return [
    '[Tutor-only dialogue closure]',
    'The authored proof DAG is now fully public, so conversational closure is available even if the strict learner-record audit remains incomplete.',
    'Do not announce the final verdict unless the learner’s current public move genuinely settles the public question.',
    'If you do state or confirm the final verdict, explicitly close the case instead of returning to another proof prompt.',
    frame.allowCheckIn
      ? 'After closing, you may ask one optional final check-in about a link to revisit; it must be the only question.'
      : 'If you close, do not ask a follow-up question.',
    'If the learner has not settled the public question, continue normally without pretending the dialogue is closed.',
    '[End tutor-only dialogue closure]',
  ].join('\n');
}

function createLearnerDagState({ enabled, modelRef = null, resolved, world, dropout = null }) {
  const board = new Map();
  if (world) {
    for (const fact of world.background || []) board.set(factKey(fact), fact);
  }
  return {
    enabled,
    modelRef,
    resolved,
    dropout: createTutorStubDagFactDropoutState(dropout || {}),
    record: {
      board,
      voiced: [],
      voicedKeys: new Set(),
      hypotheses: [],
      snapshots: [],
    },
  };
}

function tutorMessageContext(state, history) {
  const context = tutorStubPublicMessageContext(history, {
    speaker: 'tutor',
    activatedBy: state?.tutorContext?.activatedBy || 'session_start',
  });
  return {
    ...context,
    modelRef: state?.modelRef || null,
  };
}

function rawPublicTurnTranscript(turns, limit) {
  const safeLimit = Math.max(0, Number(limit) || 0);
  const recent = safeLimit > 0 ? turns.slice(-safeLimit) : [];
  if (recent.length === 0) return 'No previous turns in the raw recent window.';
  return recent
    .map((turn, index) => {
      const absoluteTurn = turns.length - recent.length + index + 1;
      return [`Turn ${absoluteTurn}`, `Learner: ${turn.learner}`, `Tutor: ${turn.tutor}`].join('\n');
    })
    .join('\n\n');
}

function publicDialogueMemorySummary(state, { includeAnalysis = true } = {}) {
  const turns = state?.turns || [];
  if (turns.length === 0) return 'No previous public dialogue to summarize.';

  const rawWindow = Math.max(0, Number(state?.historyTurns ?? STUB.historyTurns) || 0);
  const older = rawWindow > 0 ? turns.slice(0, Math.max(0, turns.length - rawWindow)) : turns;
  const latest = turns.at(-1);
  const latestClassification = latest?.classification || {};
  const lines = [
    '[Compact public dialogue memory]',
    `Completed public turns: ${turns.length}; raw recent window: ${Math.min(rawWindow, turns.length)} turn(s).`,
    older.length ? `Older turns compressed: 1-${older.length}.` : 'Older turns compressed: none yet.',
  ];

  if (older.length) {
    lines.push('Older public milestones:');
    for (const turn of older.slice(-6)) {
      lines.push(
        `- T${turn.turn}: learner ${oneLine(turn.learner, { max: 120 })}; tutor ${oneLine(turn.tutor, {
          max: 150,
        })}`,
      );
    }
  }

  if (includeAnalysis && latest) {
    lines.push('Latest public learner analysis:');
    lines.push(`- This turn: ${latestClassification.turn?.summary || oneLine(latest.learner, { max: 160 })}`);
    lines.push(`- Overall: ${latestClassification.overall?.summary || 'No public overall summary yet.'}`);
    lines.push(
      `- Trajectory: ${
        latestClassification.overall?.trajectory ||
        latestClassification.overall?.current_state ||
        'No public trajectory summary yet.'
      }`,
    );
    lines.push(
      `- Next likely need: ${
        latestClassification.turn?.pedagogical_need ||
        latestClassification.overall?.next_best_tutor_move ||
        'Ask one concrete evidence-generating question.'
      }`,
    );
  }

  lines.push('[End compact public dialogue memory]');
  return lines.join('\n');
}

function compactPublicTranscriptForPrompt(state, limit, { includeAnalysis = true } = {}) {
  const turns = state?.turns || [];
  const rawTranscript = rawPublicTurnTranscript(turns, limit);
  if (!state?.memory?.enabled || turns.length === 0) return rawTranscript;
  return [
    publicDialogueMemorySummary(state, { includeAnalysis }),
    '[Raw recent public transcript]',
    rawTranscript,
    '[End raw recent public transcript]',
  ].join('\n\n');
}

function classifierTutorContext(classification) {
  if (!classification) return '';
  return [
    '[Tutor-only learner classifier]',
    `This turn: ${classification.turn?.summary || 'No turn summary.'}`,
    `Overall: ${classification.overall?.summary || 'No overall summary.'}`,
    `Discourse move: ${classification.turn?.discourse_move || 'unknown'}`,
    `Evidence use: ${classification.turn?.evidence_use || 'unknown'}`,
    `Epistemic stance: ${classification.turn?.epistemic_stance || 'unknown'}`,
    `Immediate pedagogical need: ${
      classification.turn?.pedagogical_need || classification.overall?.next_best_tutor_move || 'unknown'
    }`,
    'Use this as advisory context. Do not mention classifier labels, scores, rubrics, or hidden analysis to the learner.',
    '[End tutor-only learner classifier]',
  ].join('\n');
}

function dagNodeFact(node) {
  const content = node?.statement?.content || {};
  if (content.rel === 'holds_L') return content.fact;
  if (content.rel === 'grounded_L') return content.of;
  return node?.fact || null;
}

function dagNodeLabel(node) {
  if (!node) return 'unknown';
  const fact = dagNodeFact(node);
  const renderedFact = fact ? factText(fact) : node.id;
  if (node.leaf) return `hold:${node.premiseId || renderedFact}`;
  return `ground:${renderedFact}`;
}

function buildTutorDagSnapshot(state, tutorTurn) {
  if (!state.dag || !state.world || !state.tutorDag) return null;
  const world = state.world;
  const dag = state.tutorDag;
  const nodesById = new Map((dag.nodes || []).map((node) => [node.id, node]));
  const releaseByPremise = new Map(world.releaseSchedule.map((entry) => [entry.premise, entry]));
  const releasedRows = committedReleaseRows(state, tutorTurn);
  const releasedPremises = new Set(releasedRows.map((entry) => entry.premise));
  const releasedTurnByPremise = new Map(releasedRows.map((entry) => [entry.premise, entry.turn]));
  const leaves = (dag.leaves || []).map((premiseId) => {
    const premise = world.premiseById.get(premiseId);
    const release = releaseByPremise.get(premiseId);
    return {
      premise: premiseId,
      fact: premise ? factText(premise.fact) : premiseId,
      released: releasedPremises.has(premiseId),
      scheduledTurn: release?.turn ?? null,
      releasedTurn: releasedTurnByPremise.get(premiseId) ?? null,
      via: release?.via || null,
    };
  });
  const nextRelease = nextReleaseRow(state);
  const nodes = (dag.nodes || []).map((node) => ({
    id: node.id,
    label: dagNodeLabel(node),
    origin: node.origin,
    rule: node.rule || null,
    leaf: Boolean(node.leaf),
    premise: node.premiseId || null,
    fact: dagNodeFact(node) ? factText(dagNodeFact(node)) : null,
  }));
  const edges = (dag.edges || []).map((edge) => ({
    from: edge.from,
    to: edge.to,
    fromLabel: dagNodeLabel(nodesById.get(edge.from)),
    toLabel: dagNodeLabel(nodesById.get(edge.to)),
    rule: edge.rule || null,
  }));

  return {
    schema: dag.schema,
    turn: tutorTurn,
    derivable: Boolean(dag.derivable),
    root: dag.root,
    rootLabel: dagNodeLabel(nodesById.get(dag.root)),
    leavesReleased: leaves.filter((leaf) => leaf.released).length,
    leavesTotal: leaves.length,
    nextRelease: nextRelease
      ? {
          premise: nextRelease.premise,
          turn: nextRelease.turn,
          via: nextRelease.via,
        }
      : null,
    leaves,
    nodes,
    edges,
  };
}

function printTutorDagSnapshot(snapshot) {
  if (!snapshot) return;
  console.log(
    `${C.cyan}tutor DAG >${C.reset} turn ${snapshot.turn}: ${snapshot.leavesReleased}/${snapshot.leavesTotal} proof leaves released`,
  );
  if (!snapshot.derivable) {
    console.log(`${C.dim}  not derivable from this world's authored proof data${C.reset}\n`);
    return;
  }
  console.log(`${C.dim}  root: ${snapshot.rootLabel}${C.reset}`);
  if (snapshot.nextRelease) {
    console.log(
      `${C.dim}  next release: ${snapshot.nextRelease.premise} at turn ${snapshot.nextRelease.turn} via ${snapshot.nextRelease.via}${C.reset}`,
    );
  } else {
    console.log(`${C.dim}  next release: none${C.reset}`);
  }

  console.log(`${C.dim}  edges:${C.reset}`);
  for (const edge of snapshot.edges) {
    console.log(`${C.dim}    ${edge.fromLabel} -> ${edge.toLabel}${edge.rule ? ` (${edge.rule})` : ''}${C.reset}`);
  }

  console.log(`${C.dim}  leaves:${C.reset}`);
  for (const leaf of snapshot.leaves) {
    const status = leaf.released ? 'x' : ' ';
    const schedule = leaf.scheduledTurn ? `t${leaf.scheduledTurn}/${leaf.via}` : 'unscheduled';
    console.log(`${C.dim}    [${status}] ${leaf.premise} ${schedule}: ${leaf.fact}${C.reset}`);
  }
  console.log();
}

function oneLine(value, { max = 220 } = {}) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function compactFactRow(row) {
  if (!row) return '';
  if (typeof row === 'string') return row;
  if (row.surface) return row.surface;
  if (row.text) return row.text;
  if (row.fact) return factText(row.fact);
  if (row.premise) return row.premise;
  return JSON.stringify(row);
}

function printAnalysisLine(label, value, { max = 220 } = {}) {
  const text = oneLine(value, { max });
  if (!text) return;
  console.log(`${C.dim}  ${label}: ${text}${C.reset}`);
}

function printAnalysisList(label, rows, { limit = 5 } = {}) {
  const visible = Array.isArray(rows) ? rows.map(compactFactRow).filter(Boolean).slice(-limit) : [];
  if (!visible.length) return;
  console.log(`${C.dim}  ${label}:${C.reset}`);
  for (const row of visible) {
    console.log(`${C.dim}    - ${oneLine(row)}${C.reset}`);
  }
}

function printInteractiveHelp(state = null) {
  if (state?.passthrough?.enabled) {
    console.log(`${C.brightCyan}${C.bold}passthrough commands${C.reset}`);
    console.log(`${C.cyan}  chat${C.reset}       type any ordinary line`);
    console.log(`${C.cyan}  model${C.reset}      /settings model [provider.alias]`);
    console.log(`${C.cyan}  inspect${C.reset}    /status · /transcript [no-open] · /director · /id`);
    console.log(`${C.cyan}  setup${C.reset}      /scenario · /reset`);
    console.log(`${C.cyan}  finish${C.reset}     /quit`);
    console.log(
      `${C.dim}  Each learner line goes directly to the speaker with the unchanged system setup and complete public message history. No classifier, reasoning tracker, register selection, response check, release planner, or auxiliary model call runs.${C.reset}\n`,
    );
    return;
  }
  console.log(
    `${C.brightCyan}${C.bold}commands${C.reset}${C.dim} · type / to browse; keep typing to filter; Tab completes${C.reset}`,
  );
  console.log(`${C.cyan}  take part${C.reset}    /learner · /coach [suggestion] · /auto [turns] · /mode`);
  console.log(
    `${C.cyan}  get help${C.reset}     /clue · /suggest · /use · /regen · /clarify [phrase] · /explain [phrase]`,
  );
  console.log(
    `${C.cyan}  understand${C.reset}   /analysis [technical] · /debug on|off · /status · /director · /transcript [no-open] · /id`,
  );
  console.log(`${C.cyan}  rate tutor${C.reset}   empty prompt: ← down · → up · /down [reason] · /tune reasons`);
  console.log(`${C.cyan}  adjust${C.reset}       /profile · /settings · /tune`);
  console.log(`${C.cyan}  recover${C.reset}      /reset (also works while the tutor or auto mode is thinking)`);
  console.log(`${C.cyan}  finish${C.reset}       /report · /quit`);
  console.log(
    `${C.dim}  Your ordinary lines are learner speech. /coach keeps your suggestion private. /auto lets the models continue the existing conversation; add a number to limit the turns.${C.reset}`,
  );
  console.log(
    `${C.dim}  If you add another learner line before the tutor replies, both lines become one learner turn and the tutor restarts from the complete message.${C.reset}`,
  );
  console.log(
    `${C.dim}  Tutor ratings are optional. On an empty prompt press ← for not helpful or → for helpful—no Enter needed. Add a typed reason with commands such as /down too_abstract or /up helpful_pacing.${C.reset}`,
  );
  console.log(
    `${C.dim}  If the exchange goes off the rails, /reset cancels unfinished work and restarts the same scenario while keeping your learner profile and settings. /clear is an alias.${C.reset}`,
  );
  console.log(
    `${C.dim}  /debug off shows only the dialogue and compact response line. /debug on adds a short plain explanation. /debug technical shows the full diagnostic evidence once.${C.reset}`,
  );
  console.log(
    `${C.dim}  /suggest previews the reply and profile expression; /use repeats the profile expression and sends it. /transcript opens raw, script, swimlane, analysis, prompt, settings, and Replay JS views.${C.reset}`,
  );
  console.log(`${C.dim}  A learner-centred summary is written when the conversation ends.${C.reset}\n`);
}

function registerTemperatureApplies(policy) {
  return REGISTER_TEMPERATURE_POLICIES.has(String(policy || ''));
}

function plainPolicyLabel(policy) {
  const labels = {
    continuous_dynamical_system: 'continuous adaptive blend',
    continuous_empirical_dynamical_system: 'continuous adaptive blend with cross-run evidence',
    dynamical_system: 'adaptive weighted choice',
    empirical_dynamical_system: 'adaptive weighted choice with cross-run evidence',
    trajectory: 'trajectory-aware choice',
    field: 'current interaction-state choice',
    state: 'classifier and reasoning-state choice',
    dynamic: 'model-reviewed adaptive choice',
    bland: 'fixed plain baseline',
    random: 'random control',
    negative: 'negative-register control',
  };
  return labels[policy] || String(policy || 'unknown policy').replaceAll('_', ' ');
}

function plainPolicySignal(axis) {
  const labels = {
    evidence_gap: 'the learner still needs public evidence',
    warrant_gap: 'a reasoning link is missing',
    agency_deficit: 'the learner needs more ownership of the next move',
    affective_risk: 'the learner may feel exposed or pressured',
    recognition_pressure: 'the response should acknowledge the learner’s independence',
    coercion_risk: 'the tutor should avoid forcing agreement',
    integration_need: 'the learner needs help connecting the pieces',
    compression_need: 'the next move should be simpler and shorter',
    language_opacity: 'the learner has encountered unclear or unfamiliar wording',
    momentum: 'the dialogue has useful forward movement',
    stagnation: 'the dialogue risks stalling',
    disruption_need: 'the current pattern needs a gentle interruption',
    tempo_affordance: 'the learner appears ready to move faster',
    closure_pressure: 'the dialogue is nearing a conclusion',
    field_regression: 'the learner’s engagement has slipped',
    empirical_uncertainty: 'there is little evidence yet about which style works best here',
    learner_acceleration: 'the learner supplied several warranted steps at once',
  };
  return labels[axis] || String(axis || '').replaceAll('_', ' ');
}

function dominantPlainPolicySignals(registerSelection, { limit = 3 } = {}) {
  const vector = registerSelection?.dynamical_system_policy?.state_vector || {};
  return Object.entries(vector)
    .filter(([, value]) => Number.isFinite(Number(value)) && Number(value) > 0.15)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, limit)
    .map(([axis]) => plainPolicySignal(axis));
}

function plainStrategyText(value) {
  return String(value || '')
    .replace(/learner-DAG/giu, 'learner’s reasoning')
    .replace(/DAG/gu, 'reasoning map')
    .replace(/proof-state/giu, 'reasoning')
    .replace(/public premise/giu, 'piece of public evidence')
    .replace(/learner-owned record/giu, 'learner’s stated reasoning')
    .replace(/low-agency compliance/giu, 'passive agreement')
    .replace(/learner-owned public move/giu, 'response in the learner’s own words')
    .replace(/coercion pressure/giu, 'pressure to agree')
    .replace(/final secret/giu, 'final conclusion');
}

function printCurrentTurnAnalysis(state, { technical = false } = {}) {
  if (technical) return printCurrentTurnTechnicalAnalysis(state);
  const turn = state.turns[state.turns.length - 1] || null;
  if (!turn) {
    console.log(`${C.cyan}analysis >${C.reset} no completed turns yet`);
    console.log(
      `${C.dim}  enter a learner turn first, then use /analysis; add "technical" for debugging evidence${C.reset}\n`,
    );
    return;
  }

  const classification = turn.classification || {};
  const turnAnalysis = classification.turn || {};
  const overall = classification.overall || {};
  const registerSelection = normalizeStoredRegisterSelection(turn.registerSelection || null);
  const previousEfficacy = normalizeStoredRegisterEfficacy(turn.previousRegisterEfficacy || null);
  const policy = registerSelection?.primary_policy || state.register?.policy || 'off';
  const distribution = formatEngagementStanceDistribution(registerSelection?.distribution, { limit: 4 });
  const signals = dominantPlainPolicySignals(registerSelection);
  const generousInference = turn.generousInference || turn.humanDiscourseFrame?.generousInference || null;
  const proofDebt = turn.humanDiscourseFrame?.proofDebt || null;
  const questionSupport = turn.humanDiscourseFrame?.questionSupport || null;
  const dialogueClosure = turn.dialogueClosure || null;
  const comprehension = turn.comprehension?.beforeTutor?.features || null;
  const dagFactDropout = turn.dagFactDropout || null;
  const learnerAdvance = turn.learnerAdvance || turn.tutorLearnerDagUpdate?.advance || null;

  console.log(`${C.cyan}analysis >${C.reset} turn ${turn.turn}`);
  printAnalysisLine('learner said', turn.learner);
  printAnalysisLine(
    'plain reading',
    turnAnalysis.summary || overall.summary || 'No plain-language reading is available.',
  );
  if (learnerAdvance?.accelerated) {
    printAnalysisLine(
      'learning pace',
      `accelerating: ${learnerAdvance.adoptedPremiseCount} public premise(s) and ${learnerAdvance.derivedFactCount} supported inference(s) were accepted together`,
    );
  }
  if (turn.releasePacing?.signal?.direction && turn.releasePacing.signal.direction !== 'steady') {
    printAnalysisLine(
      'clue pace',
      `${turn.releasePacing.signal.reason} The effective pace became ${turn.releasePacing.effectiveSpeed}x${
        turn.releasePacing.releasedNow?.length
          ? `, and ${turn.releasePacing.releasedNow.length} new clue${turn.releasePacing.releasedNow.length === 1 ? '' : 's'} entered this turn`
          : ''
      }.`,
    );
  }
  if (generousInference?.applied) {
    printAnalysisLine(
      'generous inference',
      'accepted the short answer in context; the local question counts as answered',
    );
    printAnalysisLine('what was carried forward', generousInference.resolvedMeaning);
  }
  if (proofDebt?.elision?.applied) {
    printAnalysisLine(
      'step compression',
      `${proofDebt.elision.count} obvious public bridge(s) were carried forward without asking for a restatement`,
    );
  }
  if (questionSupport) {
    const supportReadings = {
      open_question: 'the next question was answerable from public evidence',
      embedded_directional_hint:
        'the missing direction was put into the discourse because the exact evidence was not public yet',
      bounded_directional_choice: 'a small public-safe choice replaced an impossible open recall question',
      stage_then_ask: 'new evidence was stated before the learner was asked to interpret it',
      stage_then_bounded_choice: 'new evidence was stated first, then narrowed to a small interpretive choice',
      embedded_public_hint: 'an already-public clue was restated and narrowed before asking',
      bounded_public_choice: 'an already-public clue was narrowed to a small interpretive choice',
    };
    printAnalysisLine(
      'question support',
      supportReadings[questionSupport.modality] || questionSupport.reason || questionSupport.modality,
    );
  }
  if (dialogueClosure?.lifecycle?.phase && dialogueClosure.lifecycle.phase !== 'open') {
    printAnalysisLine(
      'dialogue ending',
      dialogueClosure.lifecycle.phase === 'awaiting_checkin'
        ? 'the public verdict has closed the proof sequence; one optional check-in remains'
        : 'the tutor has explicitly closed the inquiry',
    );
  }
  if (Number(comprehension?.pressure || 0) > 0) {
    printAnalysisLine(
      'wording gap',
      comprehension.unresolvedTerms?.length
        ? `the learner asked about ${comprehension.unresolvedTerms.join(', ')}`
        : 'the learner recently asked for plainer wording',
    );
  }
  if (dagFactDropout?.droppedNow?.length || dagFactDropout?.activeDropped?.length) {
    printAnalysisLine(
      'memory pressure',
      dagFactDropout.droppedNow?.length
        ? `${dagFactDropout.droppedNow.length} previously accumulated evidence item(s) slipped on this turn; the tutor should re-anchor without turning it into a memory test`
        : `${dagFactDropout.activeDropped.length} accumulated evidence item(s) remain out of the learner’s active reasoning record`,
    );
  } else if (dagFactDropout?.repairedNow?.length) {
    printAnalysisLine(
      'memory recovery',
      `${dagFactDropout.repairedNow.length} dropped evidence item(s) were re-adopted`,
    );
  }
  printAnalysisLine('teaching approach', plainPolicyLabel(policy));
  if (registerSelection?.policy_composition) {
    const composition = registerSelection.policy_composition;
    printAnalysisLine(
      'additional overrides',
      `${composition.overlay_policies.map(plainPolicyLabel).join(', ') || 'none'}; ${
        composition.activated_overlay
          ? `${plainPolicyLabel(composition.activated_overlay)} took priority because the change was strong enough`
          : 'the primary policy stayed in control'
      }`,
    );
  }
  if (registerSelection) {
    printAnalysisLine(
      'style blend',
      distribution ||
        registerSelection.engagement_stance ||
        registerSelection.selected_register ||
        'No teaching style was stored.',
    );
    printAnalysisLine(
      'next tutor move',
      plainStrategyText(displayDiagnosticLabel(registerSelection.action_family || 'No action was stored.')),
    );
    printAnalysisLine(
      'speaking level',
      `${displayDiagnosticLabel(registerSelection.audience_register || 'unknown audience')}; ${displayDiagnosticLabel(
        registerSelection.lexical_accessibility || 'unknown language level',
      )}`,
    );
    printAnalysisLine('in-scene voice', displayDiagnosticLabel(registerSelection.scene_immersion || 'unknown'));
    printAnalysisLine(
      'part in the scene',
      displayDiagnosticLabel(registerSelection.actorial_part_label || registerSelection.actorial_part || 'unknown'),
    );
    if (registerSelection.actorial_performance?.label) {
      printAnalysisLine(
        'performance tactic',
        `${displayDiagnosticLabel(registerSelection.actorial_performance.label)} — ${registerSelection.actorial_performance.contract}`,
      );
    }
    if (registerSelection.actorial_part_selection?.reason) {
      printAnalysisLine('why this part', registerSelection.actorial_part_selection.reason);
    }
    if (turn.responseConfigurationAudit) {
      printAnalysisLine(
        'style visible in the reply',
        `${turn.responseConfigurationAudit.visible_axis_count}/${turn.responseConfigurationAudit.axis_count} intended features were visible`,
      );
    }
    if (signals.length) {
      console.log(`${C.dim}  why this approach was chosen:${C.reset}`);
      for (const signal of signals) console.log(`${C.dim}    - ${signal}${C.reset}`);
    } else {
      printAnalysisLine('why', registerSelection.reviewer_signal || turnAnalysis.pedagogical_need);
    }
    printAnalysisLine(
      'tutor’s immediate aim',
      plainStrategyText(
        registerSelection.expected_field_move || overall.next_best_tutor_move || turnAnalysis.pedagogical_need,
      ),
    );
    printAnalysisLine('reasoning aim', plainStrategyText(registerSelection.expected_dag_move));
  } else {
    printAnalysisLine(
      'tutor’s immediate aim',
      plainStrategyText(overall.next_best_tutor_move || turnAnalysis.pedagogical_need),
    );
  }
  if (previousEfficacy) {
    const result =
      previousEfficacy.label === 'positive_progress'
        ? 'helped the learner move forward'
        : previousEfficacy.label === 'regression_or_overreach'
          ? 'was followed by regression or overreach'
          : 'did not yet produce clear reasoning progress';
    printAnalysisLine(
      'last teaching style result',
      `${displayDiagnosticLabel(previousEfficacy.selected_register)}: ${result}`,
    );
    if (previousEfficacy.learnerFeedback?.rating) {
      printAnalysisLine(
        'your rating of that reply',
        previousEfficacy.learnerFeedback.rating === 'up'
          ? 'helpful; this was retained as one positive self-assessment signal'
          : 'not helpful; the tutor was told to make an observable change rather than repeat the same realization',
      );
    }
  }
  const responseCheck = plainResponseCheckSummary(turn);
  if (responseCheck) printAnalysisLine('response check', responseCheck);
  console.log(`${C.dim}  technical details: /analysis technical (or /a technical)${C.reset}\n`);
}

function debugNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(3)) : 'n/a';
}

function debugDelta(current, previous) {
  if (previous === null || previous === undefined) return 'baseline';
  const delta = fieldDelta(current, previous);
  return `${delta >= 0 ? '+' : ''}${delta}`;
}

function registerPolicyCalculation(selection) {
  if (!selection) return { features: null, scores: null, drivers: [] };
  const policy =
    selection.dynamical_system_policy ||
    selection.trajectory_policy ||
    selection.field_policy ||
    selection.state_policy ||
    null;
  return {
    features: policy?.features || null,
    scores: policy?.scores || null,
    drivers: policy?.drivers || [],
  };
}

function printExplanatoryDebugTechnical(state, { force = false, terminalWrapped = false } = {}) {
  if (!force && !state.explanatoryDebug?.enabled) return false;
  if (!terminalWrapped && state.concurrentTerminal?.enabled) {
    return printWithConcurrentTerminal(state, () =>
      printExplanatoryDebugTechnical(state, { force, terminalWrapped: true }),
    );
  }
  const turn = state.turns.at(-1) || null;
  if (!turn) {
    console.log(`${C.brightBlue}${C.bold}debug explain >${C.reset} no completed turns yet\n`);
    return false;
  }

  const previousTurn = state.turns.at(-2) || null;
  const classification = turn.classification || {};
  const turnAnalysis = classification.turn || {};
  const overall = classification.overall || {};
  const learnerDag = turn.tutorLearnerDagModel || {};
  const assessment = learnerDag.assessment || {};
  const metrics = learnerDag.metrics || {};
  const selection = normalizeStoredRegisterSelection(turn.registerSelection || null);
  const previousSelection = normalizeStoredRegisterSelection(previousTurn?.registerSelection || null);
  const policyCalculation = registerPolicyCalculation(selection);
  const policyFeatures = policyCalculation.features || {};
  const policyField = policyFeatures.field || null;
  const policyDag = policyFeatures.dag || null;
  const field = buildLightweightDialogueField(state.turns);
  const fieldRow = field.rows.at(-1) || null;
  const previousFieldRow = field.rows.at(-2) || null;
  const inputs = fieldRow?.calculation?.inputs || {};
  const currentRegister = selection?.engagement_stance || selection?.selected_register || 'off';
  const previousRegister = previousSelection?.engagement_stance || previousSelection?.selected_register || 'none';
  const registerChanged = previousRegister !== 'none' && previousRegister !== currentRegister;
  const activatedPolicy = selection?.activated_policy || selection?.primary_policy || selection?.policy || 'off';
  const distribution = formatEngagementStanceDistribution(selection?.distribution, { limit: 4 });
  const releasePacing = turn.releasePacing || null;

  console.log(
    `${C.brightBlue}${C.bold}debug explain >${C.reset} turn ${turn.turn} · ${turn.turnId || turnDebugId(state, turn.turn)}`,
  );
  console.log(`${C.brightCyan}${C.bold}  A · learner analysis${C.reset}`);
  printAnalysisLine('reading', turnAnalysis.summary || overall.summary || 'No classifier summary was stored.');
  printAnalysisLine(
    'labels',
    `request=${turnAnalysis.request_type || 'unknown'}; move=${turnAnalysis.discourse_move || 'unknown'}; evidence=${
      turnAnalysis.evidence_use || 'unknown'
    }; stance=${turnAnalysis.epistemic_stance || 'unknown'}; agency=${turnAnalysis.agency || 'unknown'}`,
  );
  printAnalysisLine(
    'reasoning record',
    `coverage=${assessment.bestPathCoverage ?? 'n/a'}; grounded=${metrics.groundedCount || 0}; missing=${
      metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 'n/a'
    }; bottleneck=${assessment.bottleneck || 'unknown'}`,
  );

  console.log(`${C.brightYellow}${C.bold}  B · calculations and field update${C.reset}`);
  if (policyField) {
    printAnalysisLine(
      'policy input field',
      `surface ${policyField.beforeScore ?? 'n/a'} → ${policyField.afterScore ?? 'n/a'} (Δ ${
        policyField.delta === null || policyField.delta === undefined
          ? 'initial'
          : `${policyField.delta >= 0 ? '+' : ''}${policyField.delta}`
      }); relation=${policyField.relation || 'unknown'}`,
    );
  }
  if (policyDag) {
    printAnalysisLine(
      'policy proof calculation',
      `progressScore=${policyDag.progressScore ?? 'n/a'}; progress=${policyDag.progress ?? 'n/a'}; coverage=${
        policyDag.bestPathCoverage ?? 'n/a'
      }; missing=${policyDag.missingPremiseCount ?? 'n/a'}; bottleneck=${policyDag.bottleneck || 'unknown'}`,
    );
  }
  if (fieldRow) {
    printAnalysisLine(
      'mastery calculation',
      `0.34×${debugNumber(inputs.conceptual)} + 0.26×${debugNumber(inputs.readiness)} + 0.30×${debugNumber(
        inputs.coverage,
      )} + 0.10×${debugNumber(inputs.grounded)} = ${fieldRow.learnerMastery}`,
    );
    printAnalysisLine(
      'risk calculation',
      `0.45×${debugNumber(inputs.missing)} + 0.25×(1-${debugNumber(inputs.readiness)}) + ${debugNumber(
        inputs.overreach,
      )} overreach = ${fieldRow.learnerRisk}`,
    );
    printAnalysisLine(
      'alignment calculation',
      `0.30×${debugNumber(inputs.registerConfidence)} + 0.24×${debugNumber(
        inputs.efficacyScore,
      )} + 0.22×${debugNumber(inputs.brevity)} + 0.24×${inputs.leakOk ? 1 : 0} = ${fieldRow.tutorAlignment}`,
    );
    printAnalysisLine(
      'momentum calculation',
      `0.42×${debugNumber(inputs.masteryGain)} + 0.28×${debugNumber(
        inputs.coverageGain,
      )} + 0.18×${debugNumber(inputs.efficacyScore)} + 0.12×${debugNumber(inputs.releasedShare)} = ${
        fieldRow.jointMomentum
      }`,
    );
    printAnalysisLine(
      'field updated for next turn',
      `mastery=${fieldRow.learnerMastery} (${debugDelta(
        fieldRow.learnerMastery,
        previousFieldRow?.learnerMastery,
      )}); risk=${fieldRow.learnerRisk} (${debugDelta(
        fieldRow.learnerRisk,
        previousFieldRow?.learnerRisk,
      )}); alignment=${fieldRow.tutorAlignment} (${debugDelta(
        fieldRow.tutorAlignment,
        previousFieldRow?.tutorAlignment,
      )}); momentum=${fieldRow.jointMomentum} (${debugDelta(fieldRow.jointMomentum, previousFieldRow?.jointMomentum)})`,
    );
  }
  const dynamical = selection?.dynamical_system_policy || null;
  if (dynamical?.state_vector) {
    printAnalysisLine('system vector', topNumericEntries(dynamical.state_vector, { limit: 5 }).join(', '));
    printAnalysisLine(
      'derivatives',
      topNumericEntries(dynamical.derivative_vector, { limit: 4, abs: true }).join(', '),
    );
    printAnalysisLine('stance scores', topNumericEntries(dynamical.scores, { limit: 5 }).join(', '));
  } else if (policyCalculation.scores) {
    printAnalysisLine('stance scores', topNumericEntries(policyCalculation.scores, { limit: 5 }).join(', '));
  }

  console.log(`${C.brightMagenta}${C.bold}  C · resulting register decision${C.reset}`);
  printAnalysisLine(
    'register change',
    previousRegister === 'none'
      ? `initial choice → ${currentRegister}`
      : registerChanged
        ? `${previousRegister} → ${currentRegister}`
        : `${currentRegister} held`,
  );
  printAnalysisLine(
    'policy path',
    `stack=${selection?.policy || state.register?.policy || 'off'}; activated=${activatedPolicy}; temperature=${
      selection?.temperature ?? state.register?.temperature ?? 'n/a'
    }`,
  );
  if (selection?.policy_composition) {
    const composition = selection.policy_composition;
    printAnalysisLine(
      'overlay result',
      composition.activated_overlay
        ? `${composition.activated_overlay} overrode the primary at strength ${composition.activated_strength}`
        : `no overlay crossed ${composition.overlay_threshold}; primary retained`,
    );
  }
  if (distribution) printAnalysisLine('stance distribution', distribution);
  if (releasePacing) {
    printAnalysisLine(
      'clue release pace',
      `${releasePacing.baseSpeed}x base → ${releasePacing.effectiveSpeed}x effective (${releasePacing.direction}); ${
        releasePacing.signal?.reason || 'no pace-change request'
      }${releasePacing.releasedNow?.length ? `; released ${releasePacing.releasedNow.join(', ')}` : ''}`,
    );
  }
  printAnalysisLine('decision basis', selection?.register_reason || policyCalculation.drivers.slice(0, 4).join('; '));
  if (selection) {
    printAnalysisLine(
      'response configuration',
      `action=${selection.action_family || 'none'}; audience=${selection.audience_register || 'unknown'}; language=${
        selection.lexical_accessibility || 'unknown'
      }; scene=${selection.scene_immersion || 'unknown'}`,
    );
  }
  console.log(
    `${C.dim}  /debug off returns to dialogue plus the compact model/stance line · /debug on returns to concise prose${C.reset}\n`,
  );
  appendTraceEvent(state.trace, {
    type: 'explanatory_debug_output',
    format: 'technical',
    turn: turn.turn,
    turnId: turn.turnId || null,
    field: fieldRow,
    register: {
      previous: previousRegister,
      selected: currentRegister,
      changed: registerChanged,
      policy: selection?.policy || state.register?.policy || 'off',
      activatedPolicy,
    },
  });
  return true;
}

function explanatoryDebugModel(state) {
  if (state.learnerDag?.enabled && state.learnerDag.resolved) return state.learnerDag.resolved;
  if (state.classifier?.enabled && state.classifier.resolved) return state.classifier.resolved;
  return state.resolved;
}

function explanatoryDebugFrame(state, turn) {
  const previousTurn = state.turns.at(-2) || null;
  const classification = turn.classification || {};
  const turnAnalysis = classification.turn || {};
  const overall = classification.overall || {};
  const learnerDag = turn.tutorLearnerDagModel || {};
  const assessment = learnerDag.assessment || {};
  const metrics = learnerDag.metrics || {};
  const selection = normalizeStoredRegisterSelection(turn.registerSelection || null);
  const previousSelection = normalizeStoredRegisterSelection(previousTurn?.registerSelection || null);
  const policyCalculation = registerPolicyCalculation(selection);
  const field = buildLightweightDialogueField(state.turns);
  const fieldRow = field.rows.at(-1) || null;
  const previousFieldRow = field.rows.at(-2) || null;
  const currentRegister = selection?.engagement_stance || selection?.selected_register || 'off';
  const previousRegister = previousSelection?.engagement_stance || previousSelection?.selected_register || 'none';
  return {
    turn: turn.turn,
    public_exchange: {
      learner: turn.learner,
      tutor: turn.tutor,
    },
    learner_reading: {
      summary: turnAnalysis.summary || overall.summary || 'No classifier summary was stored.',
      request: turnAnalysis.request_type || 'unknown',
      discourse_move: turnAnalysis.discourse_move || 'unknown',
      evidence_use: turnAnalysis.evidence_use || 'unknown',
      epistemic_stance: turnAnalysis.epistemic_stance || 'unknown',
      pedagogical_need: turnAnalysis.pedagogical_need || overall.next_best_tutor_move || 'unknown',
      proof_coverage: assessment.bestPathCoverage ?? null,
      grounded_facts: metrics.groundedCount ?? null,
      missing_premises: metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? null,
      bottleneck: assessment.bottleneck || null,
      reasoning_span: turnAnalysis.reasoning_span || null,
      learning_pace: turnAnalysis.learning_pace || null,
      learner_advance: turn.learnerAdvance || turn.tutorLearnerDagUpdate?.advance || null,
      step_compression: turn.humanDiscourseFrame?.proofDebt?.elision || null,
      question_support: turn.humanDiscourseFrame?.questionSupport || null,
      clue_release_pacing: turn.releasePacing || null,
    },
    policy_input_for_this_tutor_turn: {
      field: policyCalculation.features?.field || null,
      proof: policyCalculation.features?.dag || null,
      drivers: policyCalculation.drivers || [],
    },
    post_response_field_for_next_turn: fieldRow
      ? {
          understanding: fieldRow.learnerMastery,
          pressure: fieldRow.learnerRisk,
          tutor_fit: fieldRow.tutorAlignment,
          momentum: fieldRow.jointMomentum,
          changes_from_previous: previousFieldRow
            ? {
                understanding: fieldDelta(fieldRow.learnerMastery, previousFieldRow.learnerMastery),
                pressure: fieldDelta(fieldRow.learnerRisk, previousFieldRow.learnerRisk),
                tutor_fit: fieldDelta(fieldRow.tutorAlignment, previousFieldRow.tutorAlignment),
                momentum: fieldDelta(fieldRow.jointMomentum, previousFieldRow.jointMomentum),
              }
            : null,
        }
      : null,
    response_choice: {
      previous_stance: previousRegister,
      selected_stance: currentRegister,
      changed: previousRegister !== 'none' && previousRegister !== currentRegister,
      policy: selection?.policy || state.register?.policy || 'off',
      activated_policy: selection?.activated_policy || selection?.primary_policy || selection?.policy || 'off',
      blend: selection?.distribution || null,
      reason: selection?.register_reason || policyCalculation.drivers.slice(0, 4).join('; '),
      action: selection?.action_family || null,
      audience: selection?.audience_register || null,
      language: selection?.lexical_accessibility || null,
      scene: selection?.scene_immersion || null,
      clue_release_pacing: turn.releasePacing || null,
    },
  };
}

function explanatoryDebugPrompt(frame) {
  return [
    '# Explanatory debug task',
    '',
    'Write the private, plain-language explanation of this completed tutoring turn.',
    '',
    'Output rules:',
    '- Write one compact paragraph of 45-80 words and no more than three sentences.',
    '- Use prose only: no heading, bullets, equations, JSON, variable names, or raw diagnostic labels.',
    '- First say what the learner appears to understand or need.',
    '- Then explain the meaningful movement in the interaction, using at most two numbers only if they clarify it.',
    '- Finally say whether the tutor stance changed or held, and why that choice suited this turn.',
    '- Distinguish evidence used to choose this response from the post-response field carried into the next turn.',
    '- Do not claim that a post-response measurement caused the response already given.',
    '- Refer to the participants as the learner and you, not as the tutor in the third person.',
    '',
    'Structured evidence:',
    JSON.stringify(frame, null, 2),
  ].join('\n');
}

function cleanExplanatoryDebugProse(value) {
  const text = String(value || '')
    .replace(/```(?:text|markdown)?/giu, '')
    .replace(/^\s*(?:debug(?: explanation)?|explanation)\s*:\s*/iu, '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!text) return '';
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/gu) || [text];
  return oneLine(sentences.slice(0, 3).join(' ').trim(), { max: 650 });
}

function fallbackExplanatoryDebugProse(frame) {
  const reading = oneLine(frame.learner_reading.summary, { max: 180 });
  const next = frame.post_response_field_for_next_turn;
  const fieldSentence = next
    ? `After this exchange, the running picture puts understanding at ${next.understanding} and pressure at ${next.pressure}, which will inform the next turn.`
    : 'The exchange did not produce a new interaction-field reading.';
  const choice = frame.response_choice;
  const stanceSentence =
    choice.previous_stance === 'none'
      ? `You began with ${choice.selected_stance} because ${oneLine(choice.reason || 'it best fit the learner signal', { max: 150 })}.`
      : `You ${choice.changed ? `moved from ${choice.previous_stance} to` : 'held'} ${choice.selected_stance} because ${oneLine(
          choice.reason || 'it still best fit the learner signal',
          { max: 150 },
        )}.`;
  return oneLine(`${reading} ${fieldSentence} ${stanceSentence}`, { max: 650 });
}

async function printExplanatoryDebugTurn(
  state,
  { force = false, format = null, signal = null, isCurrent = null } = {},
) {
  if (!force && !state.explanatoryDebug?.enabled) return false;
  const selectedFormat = format || state.explanatoryDebug?.format || 'prose';
  if (selectedFormat === 'technical') return printExplanatoryDebugTechnical(state, { force: true });

  const turn = state.turns.at(-1) || null;
  if (!turn) {
    console.log(`${C.brightBlue}${C.bold}debug >${C.reset} no completed turns yet\n`);
    return false;
  }

  const frame = explanatoryDebugFrame(state, turn);
  const resolved = explanatoryDebugModel(state);
  let response = null;
  let prose = '';
  let generated = true;
  const existingInterim = Boolean(getInterimState(state)?.active);
  if (!existingInterim) startInterimAnimation(state, 'explaining turn', { tutorTurn: turn.turn });
  try {
    response = await callPromptModel({
      prompt: explanatoryDebugPrompt(frame),
      resolved,
      systemPrompt:
        'You explain a tutoring harness to its operator. Be exact, terse, and readable. This is private meta-commentary, not dialogue in the scene.',
      role: 'tutor_stub_explanatory_debug',
      maxTokens: 220,
      trace: state.trace,
      stream: { enabled: false, interim: state.interim },
      cliEffort: state.cliEffort,
      turn: turn.turn,
      signal,
    });
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    prose = cleanExplanatoryDebugProse(response.text);
    if (!prose) throw new Error('empty explanatory debug response');
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    generated = false;
    prose = fallbackExplanatoryDebugProse(frame);
    appendTraceEvent(state.trace, {
      type: 'explanatory_debug_fallback',
      turn: turn.turn,
      turnId: turn.turnId || null,
      error: error.message,
    });
  } finally {
    if (!existingInterim) stopInterimAnimation(state);
  }

  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  printWithConcurrentTerminal(state, () => {
    console.log(`${C.brightBlue}${C.bold}debug >${C.reset} turn ${turn.turn} · prose${generated ? '' : ' fallback'}`);
    console.log(`${C.dim}${prose}${C.reset}`);
    console.log(`${C.dim}  technical evidence: /debug technical · stop: /debug off${C.reset}\n`);
  });
  appendTraceEvent(state.trace, {
    type: 'explanatory_debug_output',
    format: 'prose',
    generated,
    turn: turn.turn,
    turnId: turn.turnId || null,
    text: prose,
    provider: response?.provider || resolved?.provider || null,
    model: response?.model || resolved?.model || null,
    latencyMs: response?.latencyMs || null,
    usage: response?.usage || null,
    frame,
  });
  return true;
}

function printCurrentTurnTechnicalAnalysis(state) {
  const turn = state.turns[state.turns.length - 1] || null;
  if (!turn) {
    console.log(`${C.cyan}analysis >${C.reset} no completed turns yet`);
    console.log(
      `${C.dim}  enter a learner turn first, then use /analysis to inspect the stored classifier, learner-DAG, register, and tutor-DAG data${C.reset}\n`,
    );
    return;
  }

  const classification = turn.classification || null;
  const turnAnalysis = classification?.turn || {};
  const overall = classification?.overall || {};
  const conceptual = scoreValue(turnAnalysis.scores?.conceptual_engagement);
  const readiness = scoreValue(turnAnalysis.scores?.epistemic_readiness);
  const learnerDagModel = turn.tutorLearnerDagModel || null;
  const metrics = learnerDagModel?.metrics || {};
  const assessment = learnerDagModel?.assessment || {};
  const learnerRecord = learnerDagModel?.learnerRecord || {};
  const update = turn.tutorLearnerDagUpdate || null;
  const dagPreflight = update?.preflight || null;
  const accepted = update?.accepted || {};
  const rejected = update?.rejected || [];
  const extractor = update?.extractor || {};
  const registerSelection = normalizeStoredRegisterSelection(turn.registerSelection || null);
  const selectedEfficacy = registerSelection?.efficacy || null;
  const previousEfficacy = normalizeStoredRegisterEfficacy(turn.previousRegisterEfficacy || null);
  const tracePath = traceDisplayPath(state.trace);
  const comprehension = turn.comprehension?.beforeTutor || null;
  const dagFactDropout = turn.dagFactDropout || null;
  const learnerAdvance = turn.learnerAdvance || update?.advance || learnerDagModel?.learnerAdvance || null;
  const field = buildLightweightDialogueField(state.turns);
  const fieldRow = field.rows.at(-1) || null;
  const previousFieldRow = field.rows.at(-2) || null;
  const firstFieldRow = field.rows[0] || null;

  console.log(
    `${C.cyan}analysis technical >${C.reset} current completed turn ${turn.turn}; id ${turn.turnId || turnDebugId(state, turn.turn)}`,
  );
  printAnalysisLine('learner', turn.learner);
  if (comprehension?.features) {
    printAnalysisLine(
      'comprehension side-state',
      `pressure=${comprehension.features.pressure}; unresolved=${
        comprehension.features.unresolvedTerms?.join(',') || 'none'
      }; explained=${comprehension.features.explainedTerms?.join(',') || 'none'}; advancesDAG=false`,
    );
  }
  if (dagFactDropout) {
    printAnalysisLine(
      'DAG fact dropout',
      `rate=${dagFactDropout.configuredRate}; seed=${dagFactDropout.seed}; eligible=${dagFactDropout.eligibleCount}; droppedNow=${
        dagFactDropout.droppedNow?.map((row) => row.premiseId).join(',') || 'none'
      }; repairedNow=${dagFactDropout.repairedNow?.map((row) => row.premiseId).join(',') || 'none'}; active=${
        dagFactDropout.activeDropped?.map((row) => row.premiseId).join(',') || 'none'
      }; visibility=conduct`,
    );
  }

  if (classification) {
    printAnalysisLine('did this turn', turnAnalysis.summary || 'No turn summary.');
    printAnalysisLine('did overall', overall.summary || 'No overall summary.');
    printAnalysisLine('logical request type', turnAnalysis.request_type || 'unknown_request');
    printAnalysisLine(
      'rubric',
      `move=${turnAnalysis.discourse_move || 'unknown'}; stance=${turnAnalysis.epistemic_stance || 'unknown'}; evidence=${
        turnAnalysis.evidence_use || 'unknown'
      }; agency=${turnAnalysis.agency || 'unknown'}; conceptual=${conceptual}/5; readiness=${readiness}/5`,
    );
    printAnalysisLine(
      'reasoning pace',
      `${turnAnalysis.learning_pace || 'steady'}; span=${turnAnalysis.reasoning_span || 'unknown'}`,
    );
    printAnalysisLine('trajectory', overall.trajectory);
    printAnalysisLine('current state', overall.current_state);
    printAnalysisLine('next tutor move', overall.next_best_tutor_move || turnAnalysis.pedagogical_need);
    if (classification.error || classification.parseError) {
      printAnalysisLine('classifier warning', classification.error || classification.parseError);
    }
  } else {
    printAnalysisLine('classifier', state.classifier?.enabled ? 'no classifier output stored for this turn' : 'off');
  }

  if (learnerDagModel) {
    if (dagPreflight) {
      printAnalysisLine(
        'DAG preflight',
        `beforeModel=${dagPreflight.computedBeforeModelCall === true}; publicPremises=${
          dagPreflight.eligiblePublicPremiseIds?.length || 0
        }; candidateDerivations=${dagPreflight.possibleNextDerivations?.length || 0}; commitsProgress=${
          dagPreflight.authority?.commitsProgress === true
        }; hash=${dagPreflight.contentSha256 || 'n/a'}`,
      );
    }
    printAnalysisLine(
      'learner-DAG',
      `coverage=${assessment.bestPathCoverage ?? 'n/a'}; bottleneck=${assessment.bottleneck || 'unknown'}; grounded=${
        metrics.groundedCount || 0
      }; voiced=${metrics.voicedDerivedCount || 0}; hypotheses=${metrics.hypothesisCount || 0}; missing=${
        metrics.missingPremiseCount || 0
      }`,
    );
    if (update) {
      printAnalysisLine(
        'learner-record update',
        `adopted=${accepted.adopt?.length || 0}; derived=${accepted.derive?.length || 0}; retracted=${
          accepted.retract?.length || 0
        }; hypothesis=${accepted.hypothesis ? 'yes' : 'no'}; assertedAnswer=${accepted.assertAnswer || 'none'}`,
      );
      if (learnerAdvance) {
        printAnalysisLine(
          'learner advance',
          `pace=${learnerAdvance.pace}; supportedMoves=${learnerAdvance.supportedMoveCount}; multiPremise=${
            learnerAdvance.multiPremise
          }; multiStep=${learnerAdvance.multiStep}; strength=${learnerAdvance.strength}`,
        );
      }
      if (rejected.length)
        printAnalysisLine('learner-record rejected', `${rejected.length} extractor item(s) rejected`);
      if (extractor.error || extractor.parseError)
        printAnalysisLine('learner-record warning', extractor.error || extractor.parseError);
    }
    printAnalysisList('grounded public record', learnerRecord.grounded);
    printAnalysisList('learner hypotheses', learnerRecord.hypotheses);
    printAnalysisList('answer candidates', learnerRecord.answerCandidates);
  } else {
    printAnalysisLine('learner-DAG', state.learnerDag?.enabled ? 'no learner-DAG model stored for this turn' : 'off');
  }

  if (registerSelection) {
    const confidence =
      registerSelection.confidence === null || registerSelection.confidence === undefined
        ? ''
        : `; confidence=${registerSelection.confidence}`;
    printAnalysisLine(
      'engagement stance',
      `${registerSelection.engagement_stance || registerSelection.selected_register}${confidence}`,
    );
    printAnalysisLine(
      'stance temperature',
      `${registerSelection.temperature ?? state.register?.temperature ?? 'n/a'} (engagement stance and actorial part; lower sharper, higher broader)`,
    );
    printAnalysisLine(
      'logical request type',
      registerSelection.request_type || registerSelection.learner_signal || 'unknown',
    );
    printAnalysisLine('action family', registerSelection.action_family || 'none');
    printAnalysisLine('audience register', registerSelection.audience_register || 'unknown');
    printAnalysisLine('lexical accessibility', registerSelection.lexical_accessibility || 'unknown');
    printAnalysisLine('scene immersion', registerSelection.scene_immersion || 'unknown');
    printAnalysisLine(
      'actorial part',
      `${registerSelection.actorial_part || 'unknown'} (${registerSelection.actorial_part_label || 'no public label'})`,
    );
    if (registerSelection.actorial_performance) {
      printAnalysisLine(
        'actorial performance',
        `${registerSelection.actorial_performance.id || 'unknown'} (${registerSelection.actorial_performance.label || 'no public label'}): ${registerSelection.actorial_performance.contract || 'no contract stored'}`,
      );
    }
    if (registerSelection.actorial_part_selection?.distribution) {
      printAnalysisLine(
        'actorial-part distribution',
        registerSelection.actorial_part_selection.distribution
          .map((row) => `${row.part}:${Math.round(Number(row.probability || 0) * 100)}%`)
          .join(', '),
      );
      printAnalysisLine('actorial-part drivers', registerSelection.actorial_part_selection.reason || 'none');
      printAnalysisLine(
        'actorial-part selection',
        `${registerSelection.actorial_part_selection.selection_method || 'argmax'}; selected probability ${
          registerSelection.actorial_part_selection.probability ?? 'n/a'
        }${
          Number.isFinite(Number(registerSelection.actorial_part_selection.random?.decision?.draw))
            ? `; seeded draw ${registerSelection.actorial_part_selection.random.decision.draw}`
            : ''
        }`,
      );
    }
    if (registerSelection.legacy_selected_register) {
      printAnalysisLine('legacy register alias', registerSelection.legacy_selected_register);
    }
    printAnalysisLine('reviewer signal', registerSelection.reviewer_signal || 'unknown');
    printAnalysisLine('register reason', registerSelection.register_reason);
    if (registerSelection.policy_composition) {
      const composition = registerSelection.policy_composition;
      printAnalysisLine(
        'policy composition',
        `stack=${composition.policy_stack}; threshold=${composition.overlay_threshold}; activated=${
          composition.activated_overlay || 'primary'
        }`,
      );
      for (const overlay of composition.overlay_evaluations || []) {
        printAnalysisLine(
          `${overlay.policy} overlay`,
          `strength=${overlay.signal_strength}; candidate=${overlay.selected_register || 'none'}; thresholdMet=${
            overlay.threshold_met
          }; differs=${overlay.differs_from_primary}; ${overlay.reasons?.join('; ') || ''}`,
        );
      }
    }
    printAnalysisLine('expected DAG move', registerSelection.expected_dag_move);
    printAnalysisLine(
      (registerSelection.activated_policy || registerSelection.primary_policy || registerSelection.policy) === 'state'
        ? 'expected state move'
        : 'expected field move',
      registerSelection.expected_field_move,
    );
    printAnalysisLine('expected progress marker', registerSelection.expected_progress_marker);
    const distribution = formatEngagementStanceDistribution(registerSelection.distribution, { limit: 7 });
    if (distribution) printAnalysisLine('engagement-stance distribution', distribution);
    if (registerSelection.field_policy?.features) {
      const features = registerSelection.field_policy.features;
      printAnalysisLine(
        'field policy',
        `relation=${features.field?.relation || 'unknown'}; fieldDelta=${
          features.field?.delta ?? 'n/a'
        }; dagScore=${features.dag?.progressScore ?? 'n/a'}; bottleneck=${features.dag?.bottleneck || 'unknown'}`,
      );
    }
    if (registerSelection.trajectory_policy?.trajectory) {
      const trajectory = registerSelection.trajectory_policy.trajectory;
      const flags = Object.entries(trajectory.flags || {})
        .filter(([, value]) => value)
        .map(([key]) => key)
        .join(',');
      printAnalysisLine(
        'trajectory policy',
        `fieldSlope=${trajectory.field?.slope ?? 'n/a'}; dagSlope=${
          trajectory.dag?.slope ?? 'n/a'
        }; riskSlope=${trajectory.risk?.slope ?? 'n/a'}; flags=${flags || 'none'}`,
      );
    }
    if (registerSelection.dynamical_system_policy?.state_vector) {
      const policy = registerSelection.dynamical_system_policy;
      const vector = topNumericEntries(policy.state_vector, { limit: 4 }).join(', ');
      const attractors = topNumericEntries(policy.attractors, { limit: 3 }).join(', ');
      printAnalysisLine('dynamical policy', `vector=${vector || 'none'}; attractors=${attractors || 'none'}`);
      if (policy.corpus_empirical?.enabled) {
        const corrections = topNumericEntries(policy.corpus_empirical.corrections, { limit: 4, abs: true }).join(', ');
        printAnalysisLine('corpus prior', `corrections=${corrections || 'none'}`);
      } else if (policy.corpus_empirical?.reason) {
        printAnalysisLine('corpus prior', policy.corpus_empirical.reason);
      }
    }
    if (registerSelection.state_policy?.features) {
      const features = registerSelection.state_policy.features;
      printAnalysisLine(
        'state policy',
        `bottleneck=${features.dag?.bottleneck || 'unknown'}; coverage=${
          features.dag?.bestPathCoverage ?? 'n/a'
        }; missing=${features.dag?.missingPremiseCount ?? 'n/a'}; surface=${features.scores?.learnerSurface ?? 'n/a'}`,
      );
    }
    if (selectedEfficacy) {
      printAnalysisLine(
        'selected register efficacy',
        `${selectedEfficacy.label}; score=${selectedEfficacy.progressScore}; ${
          selectedEfficacy.mismatch || 'field-state unknown'
        }; fieldDelta=${selectedEfficacy.field?.delta ?? 'n/a'}; ${selectedEfficacy.summary}`,
      );
    } else {
      printAnalysisLine('selected register efficacy', 'pending the next learner turn');
    }
  } else {
    printAnalysisLine('selected register', state.register?.enabled ? 'none stored for this turn' : 'off');
  }
  if (turn.responseConfigurationAudit) {
    const audit = turn.responseConfigurationAudit;
    printAnalysisLine(
      'configuration realization',
      `${audit.visible_axis_count}/${audit.axis_count}; rate=${audit.realization_rate}; transcriptVisible=${audit.transcript_visible}`,
    );
    printAnalysisLine(
      'visible axes',
      Object.entries(audit.axes || {})
        .map(([axis, value]) => `${axis}=${value.visible ? 'yes' : 'no'}`)
        .join('; '),
    );
  }
  if (previousEfficacy) {
    printAnalysisLine(
      'previous register efficacy',
      `${previousEfficacy.selected_register}: ${previousEfficacy.label}; score=${previousEfficacy.progressScore}; ${
        previousEfficacy.mismatch || 'field-state unknown'
      }; fieldDelta=${previousEfficacy.field?.delta ?? 'n/a'}; ${previousEfficacy.summary}`,
    );
  }

  if (fieldRow) {
    printAnalysisLine(
      'field state',
      `mastery=${fieldRow.learnerMastery}; risk=${fieldRow.learnerRisk}; alignment=${fieldRow.tutorAlignment}; momentum=${fieldRow.jointMomentum}; speed=${fieldRow.speed}`,
    );
    printAnalysisLine('field shift', summarizeFieldShift(fieldRow, previousFieldRow, firstFieldRow));
    printAnalysisLine('field reading', describeFieldShift(fieldRow, previousFieldRow, field.summary));
  }

  if (turn.tutorLeakAudit) {
    const leaks = turn.tutorLeakAudit.leaks || [];
    printAnalysisLine(
      'answer-secrecy check',
      turn.tutorLeakAudit.ok ? 'passed' : `${leaks.length} issue(s) remained after revision and recheck`,
    );
    for (const leak of leaks.slice(0, 3)) {
      printAnalysisLine(`answer-secrecy issue ${leak.type || 'unknown'}`, leak.reason);
    }
  }
  const responseCheckAreas = responseCheckTriggerAreas(turn);
  if (turn.tutorResponseRepaired) {
    printAnalysisLine(
      'response revision',
      `${turn.tutorDeterministicFallback ? 'safe fallback' : 'model rewrite'}; triggered by ${
        responseCheckAreas.length ? plainList(responseCheckAreas) : 'an unsuccessful response check'
      }`,
    );
  }

  if (turn.tutorDag) {
    printTutorDagSnapshot(turn.tutorDag);
  } else {
    printAnalysisLine('tutor DAG', state.dag ? 'no snapshot stored for this turn' : 'off');
  }

  if (turn.humanDiscourseFrame) {
    const frame = turn.humanDiscourseFrame;
    const scaffold = frame.scaffoldState || {};
    const proofDebt = frame.proofDebt || {};
    const audit = frame.warrantPremiseAudit || {};
    const generousInference = frame.generousInference || {};
    const questionSupport = frame.questionSupport || {};
    printAnalysisLine(
      'human scaffold',
      `${frame.mode}; branch=${scaffold.branch?.label || scaffold.branch?.id || 'none'}; sideArc=${
        frame.sideArc?.detected ? frame.sideArc.type : 'none'
      }; proofDebt=${proofDebt.status || 'unknown'}`,
    );
    printAnalysisLine('local question', scaffold.localQuestion);
    printAnalysisLine(
      'generous inference',
      generousInference.applied
        ? `applied; kind=${generousInference.kind}; confidence=${generousInference.confidence}; ${generousInference.reason}`
        : `not applied; ${generousInference.reason || 'no contextual resolution recorded'}`,
    );
    if (generousInference.applied) {
      printAnalysisLine('resolved meaning', generousInference.resolvedMeaning);
      printAnalysisLine('spoken-turn override', generousInference.tutorInstruction);
    }
    if (proofDebt.elision?.applied) {
      printAnalysisLine(
        'proof-debt elision',
        `applied=${proofDebt.elision.applied}; elided=${proofDebt.elision.count}; open=${proofDebt.counts?.open || 0}; ${proofDebt.elision.reason}`,
      );
    }
    if (questionSupport.schema) {
      printAnalysisLine(
        'question support',
        `answerability=${questionSupport.answerability}; modality=${questionSupport.modality}; adaptiveChoice=${
          questionSupport.adaptiveMultipleChoice
        }; cooldown=${questionSupport.adaptiveChoiceCoolingDown}; ${questionSupport.reason}`,
      );
      if (turn.tutorQuestionSupportAudit) {
        printAnalysisLine(
          'question-answerability check',
          turn.tutorQuestionSupportAudit.ok
            ? 'ok'
            : `${turn.tutorQuestionSupportAudit.issues?.length || 0} issue(s) remained`,
        );
      }
    }
    if (turn.tutorHumanScaffoldAudit) {
      printAnalysisLine(
        'answered-question check',
        turn.tutorHumanScaffoldAudit.ok
          ? `ok; semantic re-question similarity=${turn.tutorHumanScaffoldAudit.similarity ?? 0}`
          : `${turn.tutorHumanScaffoldAudit.issues?.length || 0} issue(s) remained`,
      );
    }
    if (audit.counts) {
      printAnalysisLine(
        'warrant stocktake',
        `explicit=${audit.counts.explicitWarrants || 0}; implied=${audit.counts.impliedWarrants || 0}; missing=${
          audit.counts.missingWarrants || 0
        }; suppressed=${audit.counts.suppressedPremises || 0}; commonsense=${audit.counts.commonSenseBridges || 0}`,
      );
    }
  }

  if (turn.dialogueClosure) {
    const closure = turn.dialogueClosure;
    printAnalysisLine(
      'dialogue closure',
      `frame=${closure.frame?.phase || 'open'}; basis=${closure.frame?.basis || closure.lifecycle?.basis || 'none'}; lifecycle=${
        closure.lifecycle?.phase || 'open'
      }; strictGrounded=${closure.frame?.strictGrounded === true}; authoredDagSatisfied=${
        closure.frame?.authoredDagSatisfied === true
      }`,
    );
    if (closure.audit) {
      printAnalysisLine(
        'ending check',
        `ok=${closure.audit.ok}; closes=${closure.audit.closesDialogue}; checkIn=${closure.audit.invitesCheckIn}; issues=${
          closure.audit.issues?.length || 0
        }`,
      );
    }
  }

  printAnalysisLine('trace', tracePath);
  console.log();
}

function fieldScore(score) {
  const raw = scoreValue(score);
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? clampField01(numeric / 5) : 0;
}

function fieldDelta(current, previous) {
  return roundField((current || 0) - (previous || 0));
}

function fieldBar(value, { width = 12 } = {}) {
  const filled = Math.round(clampField01(value) * width);
  return `${'#'.repeat(filled)}${'.'.repeat(Math.max(0, width - filled))}`;
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

function wordsInText(text) {
  return String(text || '')
    .split(/\s+/)
    .filter(Boolean).length;
}

function lightweightFieldTurn(turn, previous = null) {
  const classification = turn?.classification || {};
  const turnAnalysis = classification.turn || {};
  const scores = turnAnalysis.scores || {};
  const model = turn?.tutorLearnerDagModel || {};
  const metrics = model.metrics || {};
  const assessment = model.assessment || {};
  const register = turn?.registerSelection || {};
  const priorEfficacy = turn?.previousRegisterEfficacy || null;
  const learnerAdvance = turn?.learnerAdvance || turn?.tutorLearnerDagUpdate?.advance || model.learnerAdvance || null;
  const leakOk = !turn?.tutorLeakAudit || turn.tutorLeakAudit.ok === true;
  const conceptual = fieldScore(scores.conceptual_engagement);
  const readiness = fieldScore(scores.epistemic_readiness);
  const coverage = clampField01(Number(assessment.bestPathCoverage || 0));
  const grounded = clampField01(Number(metrics.groundedCount || 0) / 8);
  const missing = clampField01(Number(metrics.missingPremiseCount || 0) / 8);
  const overreach =
    /overconfident|answer_seeking|omits_warrant|overleaps_evidence|distorts_public_evidence|unsupported|resistant/iu.test(
      [turnAnalysis.epistemic_stance, turnAnalysis.evidence_use, assessment.bottleneck, priorEfficacy?.label]
        .filter(Boolean)
        .join(' '),
    )
      ? 0.25
      : 0;
  const responseWords = wordsInText(turn?.tutor);
  const brevity = clampField01(1 - Math.max(0, responseWords - 95) / 130);
  const registerConfidence = Number.isFinite(Number(register.confidence))
    ? clampField01(Number(register.confidence))
    : 0.5;
  const efficacyScore = priorEfficacy
    ? clampField01(
        (Number(priorEfficacy.selfAssessmentScore ?? priorEfficacy.progressScore ?? 0) + 4) / 8,
      )
    : 0.5;
  const coverageGain = Math.max(0, fieldDelta(coverage, previous?.coverage));
  const releasedShare =
    Number(turn?.tutorDag?.leavesReleased || 0) / Math.max(1, Number(turn?.tutorDag?.leavesTotal || 1));

  const learnerMastery = roundField(0.34 * conceptual + 0.26 * readiness + 0.3 * coverage + 0.1 * grounded);
  const masteryGain = Math.max(0, fieldDelta(learnerMastery, previous?.learnerMastery));
  const learnerRisk = roundField(clampField01(0.45 * missing + 0.25 * (1 - readiness) + overreach));
  const tutorAlignment = roundField(
    clampField01(0.3 * registerConfidence + 0.24 * efficacyScore + 0.22 * brevity + 0.24 * (leakOk ? 1 : 0)),
  );
  const jointMomentum = roundField(
    clampField01(0.42 * masteryGain + 0.28 * coverageGain + 0.18 * efficacyScore + 0.12 * releasedShare),
  );

  return {
    turn: turn.turn,
    learnerMastery,
    learnerRisk,
    tutorAlignment,
    jointMomentum,
    coverage,
    groundedCount: Number(metrics.groundedCount || 0),
    missingCount: Number(metrics.missingPremiseCount || 0),
    conceptual,
    readiness,
    register: register.selected_register || null,
    bottleneck: assessment.bottleneck || 'unknown',
    learnerMove: turnAnalysis.discourse_move || 'unknown',
    learnerAdvance,
    calculation: {
      inputs: {
        conceptual,
        readiness,
        coverage,
        grounded,
        missing,
        overreach,
        responseWords,
        brevity: roundField(brevity),
        registerConfidence: roundField(registerConfidence),
        efficacyScore: roundField(efficacyScore),
        leakOk,
        masteryGain: roundField(masteryGain),
        coverageGain: roundField(coverageGain),
        releasedShare: roundField(releasedShare),
        learnerAdvanceStrength: roundField(learnerAdvance?.strength || 0),
      },
      formulas: {
        learnerMastery: '0.34*conceptual + 0.26*readiness + 0.30*coverage + 0.10*grounded',
        learnerRisk: '0.45*missing + 0.25*(1-readiness) + overreach',
        tutorAlignment: '0.30*registerConfidence + 0.24*efficacy + 0.22*brevity + 0.24*leakOk',
        jointMomentum: '0.42*masteryGain + 0.28*coverageGain + 0.18*efficacy + 0.12*releasedShare',
      },
    },
    speed: previous
      ? roundField(
          Math.sqrt(
            fieldDelta(learnerMastery, previous.learnerMastery) ** 2 +
              fieldDelta(learnerRisk, previous.learnerRisk) ** 2 +
              fieldDelta(tutorAlignment, previous.tutorAlignment) ** 2 +
              fieldDelta(jointMomentum, previous.jointMomentum) ** 2,
          ),
        )
      : 0,
  };
}

function buildLightweightDialogueField(turns = []) {
  const rows = [];
  for (const turn of turns) {
    rows.push(lightweightFieldTurn(turn, rows.at(-1) || null));
  }
  const first = rows[0] || {};
  const final = rows.at(-1) || {};
  return {
    schema: 'machinespirits.tutor-stub.lightweight-field.v1',
    turnCount: rows.length,
    rows,
    summary: {
      finalTurn: final.turn || null,
      meanSpeed: roundField(rows.reduce((sum, row) => sum + row.speed, 0) / Math.max(1, rows.length)),
      fieldDelta: {
        learnerMastery: fieldDelta(final.learnerMastery, first.learnerMastery),
        learnerRisk: fieldDelta(final.learnerRisk, first.learnerRisk),
        tutorAlignment: fieldDelta(final.tutorAlignment, first.tutorAlignment),
        jointMomentum: fieldDelta(final.jointMomentum, first.jointMomentum),
      },
      final: {
        learnerMastery: final.learnerMastery ?? null,
        learnerRisk: final.learnerRisk ?? null,
        tutorAlignment: final.tutorAlignment ?? null,
        jointMomentum: final.jointMomentum ?? null,
        coverage: final.coverage ?? null,
        bottleneck: final.bottleneck || null,
      },
    },
  };
}

function signedFieldDelta(current, previous) {
  if (!previous) return 'baseline';
  const delta = fieldDelta(current, previous);
  return `${delta >= 0 ? '+' : ''}${delta}`;
}

function summarizeFieldShift(row, previous = null, first = null) {
  const previousBits = previous
    ? [
        `prev M ${signedFieldDelta(row.learnerMastery, previous.learnerMastery)}`,
        `R ${signedFieldDelta(row.learnerRisk, previous.learnerRisk)}`,
        `A ${signedFieldDelta(row.tutorAlignment, previous.tutorAlignment)}`,
        `P ${signedFieldDelta(row.jointMomentum, previous.jointMomentum)}`,
      ]
    : ['prev baseline'];
  const totalBits =
    first && first !== row
      ? [
          `total M ${signedFieldDelta(row.learnerMastery, first.learnerMastery)}`,
          `R ${signedFieldDelta(row.learnerRisk, first.learnerRisk)}`,
          `A ${signedFieldDelta(row.tutorAlignment, first.tutorAlignment)}`,
          `P ${signedFieldDelta(row.jointMomentum, first.jointMomentum)}`,
        ]
      : ['total baseline'];
  return `${previousBits.join(', ')}; ${totalBits.join(', ')}`;
}

function describeFieldShift(row, previous = null, summary = {}) {
  const pace = row.learnerAdvance?.accelerated
    ? `accelerating learner span (${row.learnerAdvance.supportedMoveCount} warranted moves); `
    : '';
  if (!previous) {
    return `${pace}baseline field frame; bottleneck ${row.bottleneck || summary.final?.bottleneck || 'unknown'}`;
  }
  const masteryDelta = fieldDelta(row.learnerMastery, previous.learnerMastery);
  const riskDelta = fieldDelta(row.learnerRisk, previous.learnerRisk);
  const alignmentDelta = fieldDelta(row.tutorAlignment, previous.tutorAlignment);
  const momentumDelta = fieldDelta(row.jointMomentum, previous.jointMomentum);
  const tags = [];
  if (masteryDelta >= 0.05) tags.push('learner mastery rising');
  if (riskDelta <= -0.05) tags.push('risk easing');
  if (riskDelta >= 0.05) tags.push('risk increasing');
  if (alignmentDelta >= 0.05) tags.push('tutor alignment improving');
  if (alignmentDelta <= -0.05) tags.push('tutor alignment weakening');
  if (momentumDelta >= 0.05) tags.push('joint momentum gaining');
  if (momentumDelta <= -0.05) tags.push('joint momentum slowing');
  if (!tags.length) tags.push('field mostly flat');
  const direction =
    masteryDelta > 0 && riskDelta <= 0
      ? 'productive'
      : masteryDelta > 0 && riskDelta > 0
        ? 'productive but strained'
        : masteryDelta <= 0 && riskDelta > 0
          ? 'stalled or risk-heavy'
          : 'stabilizing';
  return `${pace}${direction}: ${tags.join('; ')}; bottleneck ${row.bottleneck || summary.final?.bottleneck || 'unknown'}`;
}

function printLightweightDialogueField(state) {
  if (!state.turns.length) {
    console.log(`${C.cyan}field >${C.reset} no completed turns yet`);
    console.log(`${C.dim}  enter a learner turn first, or run with --resume-last and then use /field${C.reset}\n`);
    return null;
  }

  const field = buildLightweightDialogueField(state.turns);
  const delta = field.summary.fieldDelta;
  const final = field.summary.final;
  console.log(`${C.cyan}field >${C.reset} ${field.turnCount} turn lightweight interaction field`);
  console.log(
    `${C.dim}  final: mastery ${final.learnerMastery}, risk ${final.learnerRisk}, alignment ${final.tutorAlignment}, momentum ${final.jointMomentum}, coverage ${final.coverage}${C.reset}`,
  );
  console.log(
    `${C.dim}  delta: mastery ${delta.learnerMastery >= 0 ? '+' : ''}${delta.learnerMastery}, risk ${
      delta.learnerRisk >= 0 ? '+' : ''
    }${delta.learnerRisk}, alignment ${delta.tutorAlignment >= 0 ? '+' : ''}${delta.tutorAlignment}, momentum ${
      delta.jointMomentum >= 0 ? '+' : ''
    }${delta.jointMomentum}; mean speed ${field.summary.meanSpeed}${C.reset}`,
  );
  console.log(`${C.dim}  bottleneck: ${final.bottleneck || 'unknown'}${C.reset}`);
  console.log(
    `${C.dim}  turn | mastery        | risk           | align          | momentum       | move / register / bottleneck${C.reset}`,
  );
  for (const row of field.rows) {
    const label = [row.learnerMove, row.register || 'no-register', row.bottleneck].filter(Boolean).join(' / ');
    console.log(
      `${C.dim}  ${String(row.turn).padStart(4)} | ${fieldBar(row.learnerMastery)} ${row.learnerMastery.toFixed(2)} | ${fieldBar(row.learnerRisk)} ${row.learnerRisk.toFixed(2)} | ${fieldBar(row.tutorAlignment)} ${row.tutorAlignment.toFixed(2)} | ${fieldBar(row.jointMomentum)} ${row.jointMomentum.toFixed(2)} | ${oneLine(label, { max: 96 })}${C.reset}`,
    );
  }
  console.log();
  return field;
}

function fieldVizBasePath(state) {
  const viz = state.fieldViz || {};
  const dir = viz.dir || resolveWorkspacePath(STUB.traceDir);
  const runId = viz.runId || state.trace?.runId || safeTimestampForFile();
  viz.dir = dir;
  viz.runId = runId;
  state.fieldViz = viz;
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${runId}-field`);
}

function fieldPolyline(rows, key, { width, height, padding }) {
  if (!rows.length) return '';
  const xSpan = Math.max(1, rows.length - 1);
  return rows
    .map((row, index) => {
      const x = padding.left + (index / xSpan) * width;
      const y = padding.top + (1 - clampField01(row[key])) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function fieldTurnMarkers(rows, { width, height, padding }) {
  if (!rows.length) return '';
  const xSpan = Math.max(1, rows.length - 1);
  return rows
    .map((row, index) => {
      const x = padding.left + (index / xSpan) * width;
      const label = escapeXml(`${row.turn}: ${row.learnerMove} / ${row.register || 'no-register'} / ${row.bottleneck}`);
      return `<circle cx="${x.toFixed(1)}" cy="${(padding.top + height + 18).toFixed(
        1,
      )}" r="2.8" fill="#475569"><title>${label}</title></circle>`;
    })
    .join('\n');
}

function renderLightweightFieldSvg(field, { title = 'Tutor Stub Interaction Field' } = {}) {
  const rows = field?.rows || [];
  const padding = { top: 78, right: 42, bottom: 78, left: 74 };
  const chartWidth = 780;
  const chartHeight = 280;
  const svgWidth = chartWidth + padding.left + padding.right;
  const svgHeight = chartHeight + padding.top + padding.bottom;
  const final = field?.summary?.final || {};
  const delta = field?.summary?.fieldDelta || {};
  const series = [
    ['learnerMastery', 'mastery', '#2563eb'],
    ['learnerRisk', 'risk', '#dc2626'],
    ['tutorAlignment', 'alignment', '#059669'],
    ['jointMomentum', 'momentum', '#7c3aed'],
  ];
  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((value) => {
      const y = padding.top + (1 - value) * chartHeight;
      return [
        `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${(padding.left + chartWidth).toFixed(
          1,
        )}" y2="${y.toFixed(1)}" stroke="#e2e8f0" />`,
        `<text x="${padding.left - 12}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#64748b">${value.toFixed(
          2,
        )}</text>`,
      ].join('\n');
    })
    .join('\n');
  const lines = series
    .map(
      ([key, label, color]) =>
        `<polyline points="${fieldPolyline(rows, key, {
          width: chartWidth,
          height: chartHeight,
          padding,
        })}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><title>${label}</title></polyline>`,
    )
    .join('\n');
  const legend = series
    .map(
      ([key, label, color], index) =>
        `<g transform="translate(${padding.left + index * 152}, ${svgHeight - 28})"><rect width="12" height="12" rx="2" fill="${color}" /><text x="18" y="11" font-size="12" fill="#334155">${label}: ${escapeXml(
          final[key] ?? 'n/a',
        )}</text></g>`,
    )
    .join('\n');
  const deltaText = `delta M ${delta.learnerMastery >= 0 ? '+' : ''}${delta.learnerMastery ?? 'n/a'} | R ${
    delta.learnerRisk >= 0 ? '+' : ''
  }${delta.learnerRisk ?? 'n/a'} | A ${delta.tutorAlignment >= 0 ? '+' : ''}${
    delta.tutorAlignment ?? 'n/a'
  } | P ${delta.jointMomentum >= 0 ? '+' : ''}${delta.jointMomentum ?? 'n/a'}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(title)}</title>
  <desc id="desc">Lightweight tutor-stub field visualization across ${rows.length} completed turn(s).</desc>
  <rect width="100%" height="100%" fill="#f8fafc" />
  <text x="${padding.left}" y="32" font-size="22" font-weight="700" fill="#0f172a">${escapeXml(title)}</text>
  <text x="${padding.left}" y="55" font-size="13" fill="#475569">turns ${field.turnCount}; mean speed ${escapeXml(
    field.summary?.meanSpeed ?? 'n/a',
  )}; ${escapeXml(deltaText)}; bottleneck ${escapeXml(final.bottleneck || 'unknown')}</text>
  <rect x="${padding.left}" y="${padding.top}" width="${chartWidth}" height="${chartHeight}" fill="#ffffff" stroke="#cbd5e1" />
  ${gridLines}
  ${lines}
  ${fieldTurnMarkers(rows, { width: chartWidth, height: chartHeight, padding })}
  <text x="${padding.left}" y="${svgHeight - 47}" font-size="11" fill="#64748b">Each marker title lists turn / learner move / register / bottleneck.</text>
  ${legend}
</svg>
`;
}

function writeFieldVisualization(state, { reason = 'field_viz', force = false } = {}) {
  if (!force && !state.fieldViz?.enabled) return null;
  if (!state.turns.length) return null;
  const field = buildLightweightDialogueField(state.turns);
  const basePath = fieldVizBasePath(state);
  const svgPath = `${basePath}.svg`;
  const jsonPath = `${basePath}.json`;
  fs.writeFileSync(svgPath, renderLightweightFieldSvg(field, { title: 'Tutor Stub Interaction Field' }));
  fs.writeFileSync(jsonPath, `${JSON.stringify(field, null, 2)}\n`);
  const result = {
    field,
    svgPath,
    jsonPath,
    svgDisplayPath: path.relative(ROOT, svgPath),
    jsonDisplayPath: path.relative(ROOT, jsonPath),
  };
  state.fieldViz.lastWrite = {
    svg: result.svgDisplayPath,
    json: result.jsonDisplayPath,
    turnCount: field.turnCount,
  };
  appendTraceEvent(state.trace, {
    type: 'field_visualization_write',
    reason,
    svg: result.svgDisplayPath,
    json: result.jsonDisplayPath,
    turnCount: field.turnCount,
    summary: field.summary,
  });
  return result;
}

function printFieldVisualization(state, { reason = 'viz' } = {}) {
  if (!state.turns.length) {
    console.log(`${C.cyan}viz >${C.reset} no completed turns yet`);
    console.log(`${C.dim}  enter a learner turn first, or run with --resume-last and then use /viz${C.reset}\n`);
    return null;
  }
  const result = writeFieldVisualization(state, { reason, force: true });
  if (!result) return null;
  console.log(`${C.cyan}viz >${C.reset} ${result.svgDisplayPath}`);
  console.log(`${C.dim}  data: ${result.jsonDisplayPath}${C.reset}\n`);
  return result;
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item) || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function compactCounts(items, { limit = 5 } = {}) {
  if (!items.length) return 'none';
  return items
    .slice(0, limit)
    .map(([key, count]) => `${key} ${count}`)
    .join(', ');
}

function uniqueSummaryText(items = []) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const text = oneLine(typeof item === 'string' ? item : item?.surface || item?.text || '', { max: 360 });
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function learnerRecordSummaryRows(model, key) {
  return uniqueSummaryText(Array.isArray(model?.learnerRecord?.[key]) ? model.learnerRecord[key] : []);
}

function learningSummaryEndReason(reason, natural) {
  if (natural) return 'The inquiry reached its natural conclusion on the public evidence.';
  const labels = {
    exit: 'You chose to end the session here.',
    sigint: 'You interrupted and ended the session here.',
    once: 'The requested single turn is complete.',
    report: 'You requested a summary at this point.',
    report_during_turn: 'You requested a summary while the next tutor response was being prepared.',
    exit_requested_during_turn: 'You ended the session while the next tutor response was still being prepared.',
    initial_profile_picker_exit: 'The session ended during setup.',
    initial_settings_exit: 'The session ended during setup.',
    auto_safety_turn_cap: 'The automated conversation paused at its safety limit.',
    auto_turn_limit: 'The automated conversation completed the requested number of turns.',
    auto_grounded_closure: 'The automated conversation reached its natural ending.',
    interactive_auto_grounded_closure: 'The automated conversation reached its natural ending.',
    dialogue_grounded_closure: 'The conversation reached its natural ending.',
    dialogue_closure_acknowledgement: 'The final check-in was completed.',
  };
  return (
    labels[reason] || `The session ended at ${String(reason || 'the current stopping point').replaceAll('_', ' ')}.`
  );
}

function buildDialogueLearningSummary(state, { reason = 'exit' } = {}) {
  const turns = state.turns || [];
  const last = turns.at(-1) || {};
  const finalModel = last.tutorLearnerDagModel || {};
  const assessment = finalModel.assessment || {};
  const metrics = finalModel.metrics || {};
  const finalOverall = last.classification?.overall || {};
  const comprehension = tutorStubComprehensionSnapshot(state.comprehension, { turn: turns.length + 1 });
  const evidenceHeld = learnerRecordSummaryRows(finalModel, 'grounded');
  const learnerAdvances = turns
    .map(
      (turn) => turn.learnerAdvance || turn.tutorLearnerDagUpdate?.advance || turn.tutorLearnerDagModel?.learnerAdvance,
    )
    .filter(Boolean);
  const acceleratedAdvances = learnerAdvances.filter((advance) => advance.accelerated);
  let reasoningVoiced = learnerRecordSummaryRows(finalModel, 'voicedDerived');
  if (!reasoningVoiced.length) {
    reasoningVoiced = uniqueSummaryText(
      turns
        .filter((turn) => {
          const analysis = turn.classification?.turn || {};
          return analysis.evidence_use && analysis.evidence_use !== 'none' && analysis.epistemic_stance === 'grounded';
        })
        .map((turn) => turn.learner),
    );
  }

  const journey = [];
  let previousEvidence = new Set();
  let previousReasoning = new Set();
  for (const turn of turns) {
    const model = turn.tutorLearnerDagModel || {};
    const evidence = learnerRecordSummaryRows(model, 'grounded');
    const reasoning = learnerRecordSummaryRows(model, 'voicedDerived');
    const evidenceKeys = new Set(evidence.map((item) => item.toLowerCase()));
    const reasoningKeys = new Set(reasoning.map((item) => item.toLowerCase()));
    journey.push({
      turn: turn.turn,
      turnId: turn.turnId || null,
      learner: turn.learner || '',
      tutor: turn.tutor || '',
      reading: turn.classification?.turn?.summary || turn.classification?.overall?.current_state || null,
      coverage: model.assessment?.bestPathCoverage ?? null,
      newEvidence: evidence.filter((item) => !previousEvidence.has(item.toLowerCase())),
      newReasoning: reasoning.filter((item) => !previousReasoning.has(item.toLowerCase())),
      learnerAdvance: turn.learnerAdvance || turn.tutorLearnerDagUpdate?.advance || model.learnerAdvance || null,
      releasePacing: turn.releasePacing || null,
    });
    previousEvidence = evidenceKeys;
    previousReasoning = reasoningKeys;
  }

  const missingPremiseCount = Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0);
  const closure = last.dialogueClosure?.lifecycle || state.dialogueClosure || null;
  const natural = Boolean(
    closure?.phase === 'closed' ||
    assessment.assertedSecret === true ||
    ['dialogue_grounded_closure', 'interactive_auto_grounded_closure'].includes(reason),
  );
  const openQuestions = [];
  if (comprehension.features.unresolvedTerms.length) {
    openQuestions.push(`Clarify the remaining terms: ${comprehension.features.unresolvedTerms.join(', ')}.`);
  }
  if (assessment.finalSecretEntailed && !assessment.assertedSecret) {
    openQuestions.push(
      'The public evidence supports a verdict, but it has not yet been stated in the learner’s own words.',
    );
  } else if (missingPremiseCount > 0) {
    openQuestions.push(
      `${missingPremiseCount} part${missingPremiseCount === 1 ? '' : 's'} of the best-supported reasoning path remained unestablished when the session ended.`,
    );
  } else if (!natural) {
    openQuestions.push('The inquiry ended before a natural close, so the current conclusion remains provisional.');
  }
  if (last.humanDiscourseFrame?.proofDebt?.counts?.open) {
    openQuestions.push('At least one compressed reasoning step still needs an explicit public warrant.');
  }

  let nextStep = 'Try the same reasoning pattern on a fresh case and explain which evidence licenses each step.';
  if (!natural) {
    if (comprehension.features.unresolvedTerms.length) {
      nextStep = `Resolve ${comprehension.features.unresolvedTerms[0]} first, then return to the evidence it affects.`;
    } else if (assessment.finalSecretEntailed && !assessment.assertedSecret) {
      nextStep = 'State the verdict in your own words and name the public evidence that licenses it.';
    } else if (missingPremiseCount > 0) {
      nextStep = 'Identify the remaining public evidence and connect it explicitly to the strongest current inference.';
    } else if (finalOverall.next_best_tutor_move) {
      nextStep = oneLine(finalOverall.next_best_tutor_move, { max: 300 });
    }
  }

  return {
    schema: TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA,
    generatedAt: new Date().toISOString(),
    runId: state.debugRunId || null,
    reason,
    turnCount: turns.length,
    topic: state.topic || null,
    world: state.world
      ? {
          id: state.world.id,
          title: state.world.title,
          question: state.world.question,
          discipline: state.world.discipline || null,
        }
      : null,
    trace: traceDisplayPath(state.trace),
    completion: {
      natural,
      plainReason: learningSummaryEndReason(reason, natural),
      closurePhase: closure?.phase || null,
    },
    finalStatus: turns.length ? dialogueCaseStatus(last) : 'No completed tutor turns.',
    arc: {
      summary: finalOverall.summary || last.classification?.turn?.summary || null,
      trajectory: finalOverall.trajectory || null,
      recurringPattern: finalOverall.recurring_pattern || null,
      currentState: finalOverall.current_state || null,
    },
    progress: {
      bestPathCoverage: assessment.bestPathCoverage ?? null,
      missingPremiseCount,
      finalSecretEntailed: assessment.finalSecretEntailed === true,
      assertedSecret: assessment.assertedSecret === true,
      plainStatus: turns.length ? dialogueCaseStatus(last) : 'No learning evidence was recorded.',
      acceleratedTurnCount: acceleratedAdvances.length,
      maxSupportedMoves: Math.max(0, ...learnerAdvances.map((advance) => Number(advance.supportedMoveCount || 0))),
    },
    releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
    evidenceHeld,
    reasoningVoiced,
    comprehension: {
      explainedTerms: comprehension.features.explainedTerms,
      unresolvedTerms: comprehension.features.unresolvedTerms,
    },
    openQuestions,
    nextStep,
    journey,
    boundary:
      'This report uses only public dialogue, public learner-record evidence, and learner-visible clarification state. It does not reveal unreleased premises, hidden proof paths, or a concealed answer that the learner had not earned.',
  };
}

function dialogueCaseStatus(turn) {
  const assessment = turn?.tutorLearnerDagModel?.assessment || {};
  const closure = turn?.dialogueClosure?.lifecycle || null;
  const missing = Number(
    turn?.tutorLearnerDagModel?.metrics?.missingPremiseCount ?? assessment.missingPremiseCount ?? 0,
  );
  if (assessment.finalSecretEntailed && assessment.assertedSecret) {
    return 'The learner reached and stated a conclusion supported by the public evidence.';
  }
  if (closure?.phase === 'closed') {
    return 'The conversation closed naturally from the public evidence.';
  }
  if (closure?.phase === 'awaiting_checkin') {
    return 'The conclusion has been stated; one optional final check-in remains.';
  }
  if (assessment.finalSecretEntailed) {
    return 'The evidence supports the conclusion, but the learner has not fully stated it.';
  }
  if (missing > 0) {
    return `${missing} evidence ${missing === 1 ? 'step remains' : 'steps remain'}. Next need: ${plainInterimBottleneck(
      assessment.bottleneck,
    )}.`;
  }
  return `The inquiry remains open. Next need: ${plainInterimBottleneck(assessment.bottleneck)}.`;
}

function plainCloseoutReason(reason) {
  const labels = {
    exit: 'ended by you',
    exit_requested_during_turn: 'ended by you while a response was being prepared',
    once: 'single-turn run complete',
    report: 'summary requested',
    report_during_turn: 'summary requested while the next response was being prepared',
    grounded_asserted_secret: 'the conclusion was supported and stated',
    auto_grounded: 'the automated conversation reached its conclusion',
    auto_safety_turn_cap: 'automation paused at its turn limit',
    auto_turn_limit: 'automation completed the requested number of turns',
    dialogue_grounded_closure: 'the conversation reached its natural ending',
    interactive_auto_grounded_closure: 'the automated conversation reached its natural ending',
    dialogue_closure_acknowledgement: 'the final check-in was completed',
  };
  return labels[reason] || displayDiagnosticLabel(reason || 'session ended');
}

function plainCloseoutStatus(turn) {
  const assessment = turn?.tutorLearnerDagModel?.assessment || {};
  const closure = turn?.dialogueClosure?.lifecycle || null;
  const missing = Number(
    turn?.tutorLearnerDagModel?.metrics?.missingPremiseCount ?? assessment.missingPremiseCount ?? 0,
  );
  if (assessment.finalSecretEntailed && assessment.assertedSecret)
    return 'The learner reached and stated the supported conclusion.';
  if (closure?.phase === 'closed') return 'The conversation closed naturally from the public evidence.';
  if (closure?.phase === 'awaiting_checkin') return 'The conclusion was stated; one optional final check-in remains.';
  if (assessment.finalSecretEntailed)
    return 'The evidence supports the conclusion, but the learner has not fully stated it.';
  if (missing > 0)
    return `${missing} evidence ${missing === 1 ? 'step remains' : 'steps remain'} before the conclusion is fully supported.`;
  return 'The inquiry remains open.';
}

function summarizeTutorGuardAccounting(turns, { policy = null, profile = null } = {}) {
  const rows = turns.map((turn) => turn?.tutorGuardAccounting).filter(Boolean);
  const outcomes = {};
  const deliveries = {};
  const guards = {
    leak: { issues: 0, guardedSpans: 0 },
    human_scaffold: { issues: 0, guardedSpans: 0 },
    question_support: { issues: 0, guardedSpans: 0 },
    dramatic_release: { issues: 0, guardedSpans: 0 },
    response_composition: { issues: 0, guardedSpans: 0 },
    repetition: { issues: 0, guardedSpans: 0 },
    dialogue_closure: { issues: 0, guardedSpans: 0 },
  };
  let repairActions = 0;
  let modelRepairTurns = 0;
  let deterministicFallbackTurns = 0;
  let guardTriggeredTurns = 0;
  let guardedSpans = 0;
  let repairedSpans = 0;
  let finalDeliveryAuditFailures = 0;
  for (const row of rows) {
    outcomes[row.outcome || 'unknown'] = (outcomes[row.outcome || 'unknown'] || 0) + 1;
    const delivery = row.finalDelivery?.source || 'unknown';
    deliveries[delivery] = (deliveries[delivery] || 0) + 1;
    if (row.attempts?.[0]?.guardedSpans?.length) guardTriggeredTurns += 1;
    if (row.repairsApplied?.some((repair) => repair.kind === 'model_rewrite')) modelRepairTurns += 1;
    if (delivery === 'deterministic_fallback') deterministicFallbackTurns += 1;
    repairActions += row.repairsApplied?.length || 0;
    if (row.finalDelivery?.auditOk === false) finalDeliveryAuditFailures += 1;
    for (const attempt of row.attempts || []) {
      guardedSpans += attempt.guardedSpans?.length || 0;
      repairedSpans += attempt.repairedSpans?.length || 0;
      for (const issue of tutorGuardIssueRows(attempt.audits)) {
        const bucket = guards[issue.guard] || (guards[issue.guard] = { issues: 0, guardedSpans: 0 });
        bucket.issues += 1;
      }
      for (const span of attempt.guardedSpans || []) {
        const bucket = guards[span.guard] || (guards[span.guard] = { issues: 0, guardedSpans: 0 });
        bucket.guardedSpans += 1;
      }
    }
  }
  const metrics = {
    turns: turns.length,
    accountedTurns: rows.length,
    guardEnabledTurns: rows.filter((row) => row.guards?.enabled).length,
    guardTriggeredTurns,
    modelRepairTurns,
    deterministicFallbackTurns,
    repairActions,
    guardedSpans,
    repairedSpans,
    finalDeliveryAuditFailures,
    outcomes,
    deliveries,
    guards,
  };
  return {
    schema: TUTOR_GUARD_SUMMARY_SCHEMA,
    policy,
    profile,
    ...metrics,
    byPolicyProfile: [{ policy, profile, ...metrics }],
  };
}

function printDialogueCloseout(state, { reason = 'report', trace = state.trace } = {}) {
  const tracePath = traceDisplayPath(trace);
  if (!state.turns.length) {
    console.log(`${C.cyan}session summary >${C.reset} ${plainCloseoutReason(reason)}; no completed tutor turns`);
    if (tracePath) console.log(`${C.dim}  technical trace: ${tracePath}${C.reset}`);
    console.log(
      `${C.dim}  start with the tutor opening prompt, then enter one learner turn to build a report${C.reset}\n`,
    );
    return null;
  }

  const field = buildLightweightDialogueField(state.turns);
  const delta = field.summary.fieldDelta;
  const final = field.summary.final;
  const last = state.turns[state.turns.length - 1] || {};
  const assessment = last.tutorLearnerDagModel?.assessment || {};
  const metrics = last.tutorLearnerDagModel?.metrics || {};
  const registerCounts = compactCounts(
    countBy(
      state.turns,
      (turn) => normalizeStoredRegisterSelection(turn.registerSelection)?.selected_register || 'none',
    ),
  );
  const bottleneckCounts = compactCounts(
    countBy(state.turns, (turn) => turn.tutorLearnerDagModel?.assessment?.bottleneck || 'unknown'),
  );
  const responseConfigurationVisibility = summarizeTutorStubResponseConfigurationAudits(
    state.turns.map((turn) => turn.responseConfigurationAudit),
  );
  const guardAccounting = summarizeTutorGuardAccounting(state.turns, {
    policy: state.experiment?.policy || state.register?.policy || null,
    profile: state.experiment?.profile || null,
  });
  const payload = {
    schema: 'machinespirits.tutor-stub.closeout-report.v1',
    reason,
    turnCount: state.turns.length,
    trace: tracePath,
    finalStatus: dialogueCaseStatus(last),
    finalAssessment: {
      bottleneck: assessment.bottleneck || null,
      bestPathCoverage: assessment.bestPathCoverage ?? null,
      finalSecretEntailed: assessment.finalSecretEntailed === true,
      assertedSecret: assessment.assertedSecret === true,
      missingPremiseCount: Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0),
    },
    humanDiscourse: {
      config: state.humanDiscourse || null,
      finalFrame: last.humanDiscourseFrame || null,
      finalStatus: last.humanDiscourseFrame?.warrantPremiseAudit?.proofStatus || null,
      proofDebtStatus: last.humanDiscourseFrame?.proofDebt?.status || null,
      sideArcCount: state.turns.filter((turn) => turn.humanDiscourseFrame?.sideArc?.detected).length,
      openProofDebtCount: state.turns.reduce(
        (sum, turn) => sum + Number(turn.humanDiscourseFrame?.proofDebt?.counts?.open || 0),
        0,
      ),
      elidedBridgeCount: state.turns.reduce(
        (sum, turn) => sum + Number(turn.humanDiscourseFrame?.proofDebt?.counts?.elided || 0),
        0,
      ),
      questionSupportModes: Object.fromEntries(
        countBy(state.turns, (turn) => turn.humanDiscourseFrame?.questionSupport?.modality || 'none'),
      ),
      questionSupportRepairCount: state.turns.filter(
        (turn) => turn.tutorResponseRepaired && turn.humanDiscourseFrame?.questionSupport?.guardRequired,
      ).length,
    },
    comprehension: tutorStubComprehensionSnapshot(state.comprehension, {
      turn: state.turns.length + 1,
    }),
    releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
    responseConfigurationVisibility,
    guardAccounting,
    dialogueClosure: last.dialogueClosure?.lifecycle || state.dialogueClosure || null,
    field: field.summary,
    finalTurn: {
      turnId: last.turnId || turnDebugId(state, last.turn),
      learner: last.learner || '',
      tutor: last.tutor || '',
      engagementStance:
        normalizeStoredRegisterSelection(last.registerSelection)?.engagement_stance ||
        normalizeStoredRegisterSelection(last.registerSelection)?.selected_register ||
        null,
      register: normalizeStoredRegisterSelection(last.registerSelection)?.selected_register || null,
      responseConfiguration: last.responseConfiguration || null,
      responseConfigurationAudit: last.responseConfigurationAudit || null,
      leakOk: last.tutorLeakAudit?.ok ?? null,
      closure: last.dialogueClosure || null,
    },
    learning: buildDialogueLearningSummary(state, { reason }),
  };

  console.log(
    `${C.cyan}session summary >${C.reset} ${plainCloseoutReason(reason)}; ${state.turns.length} completed turn(s)`,
  );
  if (tracePath) console.log(`${C.dim}  technical trace: ${tracePath}${C.reset}`);
  console.log(`${C.dim}  outcome: ${plainCloseoutStatus(last)}${C.reset}`);
  const coveragePercent = Number.isFinite(Number(payload.finalAssessment.bestPathCoverage))
    ? `${Math.round(Number(payload.finalAssessment.bestPathCoverage) * 100)}%`
    : 'not available';
  console.log(
    `${C.dim}  reasoning progress: ${coveragePercent} of the strongest proof path; ${
      payload.finalAssessment.missingPremiseCount
    } evidence step(s) still missing; current sticking point ${displayDiagnosticLabel(
      payload.finalAssessment.bottleneck || 'unknown',
    )}; answer-secrecy check ${
      payload.finalTurn.leakOk === null ? 'not available' : payload.finalTurn.leakOk ? 'passed' : 'failed'
    }${C.reset}`,
  );
  console.log(
    `${C.dim}  interaction measures: learner progress ${final.learnerMastery}, pressure ${final.learnerRisk}, tutor alignment ${final.tutorAlignment}, momentum ${final.jointMomentum}; progress change ${
      delta.learnerMastery >= 0 ? '+' : ''
    }${delta.learnerMastery}, pressure change ${delta.learnerRisk >= 0 ? '+' : ''}${delta.learnerRisk}${C.reset}`,
  );
  console.log(`${C.dim}  tutor styles used: ${registerCounts}${C.reset}`);
  if (payload.learning.progress?.acceleratedTurnCount) {
    console.log(
      `${C.dim}  learner pace: accelerated on ${payload.learning.progress.acceleratedTurnCount} turn(s); longest supported leap ${payload.learning.progress.maxSupportedMoves} moves${C.reset}`,
    );
  }
  if (payload.releasePacing) {
    console.log(
      `${C.dim}  clue pace: ${payload.releasePacing.baseSpeed}x base; ${payload.releasePacing.counts.accelerationSignals} faster request(s), ${payload.releasePacing.counts.decelerationSignals} slower request(s); ${payload.releasePacing.counts.early} clue(s) released early${C.reset}`,
    );
  }
  if (responseConfigurationVisibility.turns) {
    console.log(
      `${C.dim}  intended tutor style visible in wording: ${Math.round(
        responseConfigurationVisibility.mean_realization_rate * 100,
      )}%; visible difference between styles ${
        responseConfigurationVisibility.pairwise_visible_difference_rate === null
          ? 'n/a'
          : `${Math.round(responseConfigurationVisibility.pairwise_visible_difference_rate * 100)}%`
      } across ${responseConfigurationVisibility.distinct_configuration_count} configuration(s)${C.reset}`,
    );
  }
  console.log(
    `${C.dim}  response checks: recorded ${guardAccounting.accountedTurns}/${guardAccounting.turns}; revisions ${
      guardAccounting.guardTriggeredTurns
    }; model rewrites ${guardAccounting.modelRepairTurns}; safe fallbacks ${
      guardAccounting.deterministicFallbackTurns
    }; final check failures ${guardAccounting.finalDeliveryAuditFailures}${C.reset}`,
  );
  console.log(`${C.dim}  sticking points seen: ${bottleneckCounts}${C.reset}`);
  if (payload.humanDiscourse.config?.scaffoldActive) {
    console.log(
      `${C.dim}  human-friendly reasoning: ${payload.humanDiscourse.finalStatus || 'unknown'}; deferred proof steps ${
        payload.humanDiscourse.proofDebtStatus || 'unknown'
      }; side questions ${payload.humanDiscourse.sideArcCount}; open deferred steps ${
        payload.humanDiscourse.openProofDebtCount
      }; obvious steps carried forward ${payload.humanDiscourse.elidedBridgeCount}; question support ${compactCounts(
        Object.entries(payload.humanDiscourse.questionSupportModes),
      )}${C.reset}`,
    );
  }
  if (payload.comprehension.features.unresolvedTerms.length || payload.comprehension.features.explainedTerms.length) {
    console.log(
      `${C.dim}  language help: still unclear ${
        payload.comprehension.features.unresolvedTerms.join(', ') || 'none'
      }; explained ${payload.comprehension.features.explainedTerms.join(', ') || 'none'}; difficulty ${
        payload.comprehension.features.languageOpacity
      }${C.reset}`,
    );
  }
  console.log(`${C.dim}  technical turn id: ${payload.finalTurn.turnId}${C.reset}`);
  console.log(`${C.dim}  last learner: ${oneLine(last.learner, { max: 180 })}${C.reset}`);
  console.log(`${C.dim}  last tutor: ${oneLine(last.tutor, { max: 220 })}${C.reset}\n`);
  return payload;
}

function dagTurnContext(state, tutorTurn, tutorLearnerDagModel = null) {
  const world = state?.world;
  if (!world) return '';
  const learnerDagModel = tutorLearnerDagModel?.model || tutorLearnerDagModel || null;
  const learnerGroundedSurfaceKeys = new Set(
    (learnerDagModel?.learnerRecord?.grounded || [])
      .map((row) => tutorPromptSurfaceKey(row?.surface))
      .filter(Boolean),
  );
  const earlier = committedReleaseRows(state, tutorTurn);
  const dueNow = currentReleaseRows(state, tutorTurn);
  const earlierLines = earlier.length
    ? earlier
        .map((entry) => {
          const grounding = learnerGroundedSurfaceKeys.has(tutorPromptSurfaceKey(entry.surface))
            ? 'learner-grounded'
            : 'public, not yet learner-grounded';
          return `- [${grounding}] ${String(entry.surface || '').trim()}`;
        })
        .join('\n')
    : '- none yet';
  const dueLines = dueNow.length
    ? dueNow
        .map((entry) => {
          const source = entry.via === 'director' ? 'scene evidence' : 'tutor exhibit';
          return `- ${source}: ${String(entry.surface || '').trim()}`;
        })
        .join('\n')
    : '- no new evidence is available this turn';
  return [
    '[Tutor-only public evidence window]',
    `Current tutor turn in this lightweight stub: ${tutorTurn}`,
    'Evidence actually spoken before this turn:',
    earlierLines,
    'New evidence permitted now (it becomes public only if this reply says it):',
    dueLines,
    'No future evidence, answer key, proof path, or release detail is included here.',
    'Use this as a hard speaking boundary, not merely pacing advice.',
    '[End tutor-only public evidence window]',
  ].join('\n');
}

function tutorCoachGuidanceEntries(state, tutorTurn = null) {
  const effectiveTurn = tutorTurn ?? (state?.turns?.length || 0) + 1;
  return Array.isArray(state?.coach?.pending)
    ? state.coach.pending.filter((entry) => Number(entry?.notBeforeTurn || 0) <= effectiveTurn)
    : [];
}

function tutorCoachGuidanceContext(state, { tutorTurn = null } = {}) {
  const pending = tutorCoachGuidanceEntries(state, tutorTurn)
    .map((entry) => String(entry?.text || entry || '').trim())
    .filter(Boolean);
  if (!pending.length) return '';
  return [
    '[Private coach guidance for this tutor turn]',
    'An operator has suggested the following direction for your next public response:',
    ...pending.map((text) => `- ${text}`),
    'Treat this as high-priority advisory guidance. Follow it when it is compatible with the public evidence, learner agency, pacing, safety guards, and dialogue-closure requirements.',
    'Do not mention a coach, operator, private instruction, or this guidance. Do not reveal hidden evidence or the concealed answer merely because the guidance requests it.',
    '[End private coach guidance]',
  ].join('\n');
}

async function callTutor({
  learnerText,
  history,
  state = null,
  systemPrompt,
  resolved,
  temperature,
  maxTokens,
  historyTurns,
  world,
  dag,
  classification,
  tutorLearnerDagModel,
  registerSelection,
  humanDiscourseFrame = null,
  dialogueClosureFrame = null,
  trace = null,
  stream = null,
  cliEffort = null,
  multipleChoice = false,
  roleBase = 'tutor_stub_tutor',
  learnerMessages = null,
  tutorFeedback = null,
  feedbackAdaptationPlan = null,
  deferStreamOutput = false,
  passthrough = false,
  signal = null,
}) {
  const messageContext = tutorMessageContext(state, history);
  const context = messageContext.messages;
  const tutorTurn = Math.floor(history.length / 2) + 1;
  const tutorMemory = passthrough
    ? null
    : [
    '[Tutor context continuity]',
    `All ${messageContext.replayedMessageCount} previous public user/assistant messages are replayed in their original order for this model call.`,
    '[End tutor context continuity]',
  ].join('\n');
  const advisory = passthrough ? null : classifierTutorContext(classification);
  const learnerDagAdvisory = passthrough
    ? null
    : tutorLearnerDagModelContext(tutorLearnerDagModel, {
        releasedEvidence: dag && world ? committedReleaseRows(state, tutorTurn) : [],
      });
  const dramaticReleaseFrame = passthrough
    ? { active: false, entries: [] }
    : buildTutorStubDramaticReleaseFrame({
        dueEvidence: currentReleaseRows(state, tutorTurn),
      });
  const responseConfiguration = registerSelection?.response_configuration || registerSelection || null;
  const dramaticReleaseAdvisory = passthrough ? null : tutorStubDramaticReleasePrompt(dramaticReleaseFrame);
  const humanDiscourseAdvisory = passthrough ? null : humanDiscourseTutorContext(humanDiscourseFrame);
  const dialogueClosureAdvisory = passthrough ? null : dialogueClosureTutorContext(dialogueClosureFrame);
  const responseCompositionFrame = passthrough
    ? { active: false }
    : buildTutorStubResponseCompositionFrame({
        learnerText,
        classification,
        tutorLearnerDag: tutorLearnerDagModel,
        registerSelection,
        dramaticReleaseFrame,
        dialogueClosureFrame,
      });
  const responseCompositionAdvisory = passthrough
    ? null
    : tutorStubResponseCompositionPrompt(responseCompositionFrame);
  const comprehensionAdvisory = passthrough
    ? null
    : tutorStubComprehensionPrompt(state?.comprehension, { turn: tutorTurn });
  const coachAdvisory = passthrough ? null : tutorCoachGuidanceContext(state, { tutorTurn });
  const pointOfActionAdvisory = passthrough ? null : tutorStubPointOfActionPrompt(state?.pointOfAction?.current);
  const tuningAdvisory = passthrough ? null : tutorStubTuningTurnAdvisory(state?.tuning);
  const tutorFeedbackAdvisory = passthrough
    ? null
    : tutorStubTurnFeedbackPrompt(tutorFeedback, { adaptationPlan: feedbackAdaptationPlan });
  const responseConfigurationAdvisory = passthrough
    ? null
    : responseConfigurationContext(registerSelection, {
        multipleChoice,
        humanDiscourseFrame,
        dialogueClosureFrame,
        world: state?.world || null,
      });
  const effectiveSystemPrompt = responseConfigurationAdvisory
    ? `${systemPrompt}\n\n${responseConfigurationAdvisory}`
    : systemPrompt;
  const learnerMessageCount = Array.isArray(learnerMessages) ? learnerMessages.length : 1;
  const learnerPrompt = passthrough
    ? learnerText
    : learnerMessageCount > 1
      ? `Learner says in ${learnerMessageCount} consecutive messages before your reply (treat them as one compound turn):\n${learnerText}`
      : `Learner says:\n${learnerText}`;
  const promptParts = [
    tutorMemory,
    dag && world ? dagTurnContext(state, tutorTurn, tutorLearnerDagModel) : null,
    responseCompositionAdvisory,
    dramaticReleaseAdvisory,
    advisory,
    learnerDagAdvisory,
    humanDiscourseAdvisory,
    dialogueClosureAdvisory,
    comprehensionAdvisory,
    coachAdvisory,
    pointOfActionAdvisory,
    tuningAdvisory,
    tutorFeedbackAdvisory,
    learnerPrompt,
  ].filter(Boolean);
  const userPrompt = promptParts.join('\n\n');
  const machineAdvisoryParts = [
    tutorMemory,
    dag && world ? dagTurnContext(state, tutorTurn, tutorLearnerDagModel) : null,
    responseCompositionAdvisory,
    dramaticReleaseAdvisory,
    advisory,
    learnerDagAdvisory,
    humanDiscourseAdvisory,
    dialogueClosureAdvisory,
    comprehensionAdvisory,
    coachAdvisory,
    pointOfActionAdvisory,
    tuningAdvisory,
    tutorFeedbackAdvisory,
    responseConfigurationAdvisory,
  ].filter(Boolean);
  let effectiveSpeakerSystemPrompt = effectiveSystemPrompt;
  let effectiveSpeakerUserPrompt = userPrompt;
  let effectiveSpeakerInstructionTexts = [systemPrompt, ...machineAdvisoryParts].filter(Boolean);
  let speakerPrivilegeAudit = passthrough
    ? {
        schema: 'machinespirits.tutor-stub.speaker-privilege-audit.v1',
        ok: true,
        bypassed: true,
        reason: 'passthrough_uses_only_system_setup_public_history_and_latest_user_message',
      }
    : auditTutorStubSpeakerPrivilege({
        world: dag ? world : null,
        tutorTurn,
        systemPrompt: effectiveSystemPrompt,
        privateAdvisory: machineAdvisoryParts.join('\n\n'),
      });
  if (!speakerPrivilegeAudit.ok) {
    const blockedAudit = speakerPrivilegeAudit;
    appendTraceEvent(trace, {
      type: 'tutor_speaker_privilege_audit',
      turn: tutorTurn,
      audit: blockedAudit,
    });
    const recovery = recoverTutorStubSpeakerPrompt({
      world: dag ? world : null,
      tutorTurn,
      baseSystemPrompt: systemPrompt,
      continuityPrompt: tutorMemory,
      publicEvidencePrompt: dag && world ? dagTurnContext(state, tutorTurn, tutorLearnerDagModel) : null,
      responseCompositionPrompt: responseCompositionAdvisory,
      dramaticReleasePrompt: dramaticReleaseAdvisory,
      responseConfigurationPrompt: tutorStubResponseConfigurationPrompt(
        registerSelection?.response_configuration || registerSelection,
      ),
      learnerPrompt,
      messageHistory: context,
    });
    appendTraceEvent(trace, {
      type: 'tutor_speaker_privilege_recovery',
      turn: tutorTurn,
      method: recovery.method,
      applied: recovery.applied,
      originalIssues: blockedAudit.issues.map((issue) => ({ code: issue.code, source: issue.source })),
      speakerPrivilegeAudit: recovery.speakerPrivilegeAudit,
      promptAudit: recovery.promptAudit,
    });
    if (!recovery.applied) {
      throw new Error(
        `Speaking-tutor prompt crossed the private-planner boundary and public-only recovery failed: ${blockedAudit.issues
          .map((issue) => `${issue.code}:${issue.source}`)
          .join(', ')}`,
      );
    }
    effectiveSpeakerSystemPrompt = recovery.systemPrompt;
    effectiveSpeakerUserPrompt = recovery.userPrompt;
    effectiveSpeakerInstructionTexts = recovery.instructionTexts;
    speakerPrivilegeAudit = {
      ...recovery.speakerPrivilegeAudit,
      recovery: {
        applied: true,
        method: recovery.method,
        originalIssues: blockedAudit.issues.map((issue) => ({ code: issue.code, source: issue.source })),
      },
    };
  }
  const leakGuardEnabled = Boolean(!passthrough && dag && world);
  const scaffoldGuardEnabled = Boolean(!passthrough && humanDiscourseFrame?.generousInference?.applied);
  const questionSupportGuardEnabled = Boolean(!passthrough && humanDiscourseFrame?.questionSupport?.guardRequired);
  const dramaticReleaseGuardEnabled = Boolean(!passthrough && dramaticReleaseFrame.active);
  const actorialRealizationGuardEnabled = Boolean(
    dramaticReleaseGuardEnabled &&
      responseConfiguration?.actorial_part &&
      responseConfiguration?.actorial_performance,
  );
  const responseCompositionGuardEnabled = Boolean(!passthrough && responseCompositionFrame.active);
  const recentTutorTexts = context.filter((message) => message.role === 'assistant').map((message) => message.content);
  const repetitionGuardEnabled = Boolean(!passthrough && recentTutorTexts.length > 0);
  const closureGuardEnabled = Boolean(
    dialogueClosureFrame?.enabled && (dialogueClosureFrame.mandatory || dialogueClosureFrame.available),
  );
  const responseGuardEnabled =
    leakGuardEnabled ||
    scaffoldGuardEnabled ||
    questionSupportGuardEnabled ||
    dramaticReleaseGuardEnabled ||
    actorialRealizationGuardEnabled ||
    responseCompositionGuardEnabled ||
    repetitionGuardEnabled ||
    closureGuardEnabled;
  const guards = {
    enabled: responseGuardEnabled,
    leak: leakGuardEnabled,
    humanScaffold: scaffoldGuardEnabled,
    questionSupport: questionSupportGuardEnabled,
    dramaticRelease: dramaticReleaseGuardEnabled,
    actorialRealization: actorialRealizationGuardEnabled,
    responseComposition: responseCompositionGuardEnabled,
    repetition: repetitionGuardEnabled,
    dialogueClosure: closureGuardEnabled,
  };
  const canStreamTutor = Boolean(stream?.enabled && providerSupportsStreaming(resolved));
  const tutorStreamMode = canStreamTutor
    ? responseGuardEnabled || deferStreamOutput
      ? 'buffered'
      : 'live'
    : 'none';

  async function invokeTutorAttempt({ attemptUserPrompt, role, streamMode = 'none', repairAttempt = 0 }) {
    const startedAt = new Date().toISOString();
    const instructionTexts = passthrough
      ? [systemPrompt]
      : effectiveSpeakerInstructionTexts;
    let attemptSystemPrompt = effectiveSpeakerSystemPrompt;
    let effectiveAttemptUserPrompt = attemptUserPrompt;
    let effectiveInstructionTexts = instructionTexts;
    let promptAudit = passthrough
      ? {
          schema: 'machinespirits.tutor-stub.prompt-audit.v1',
          surface: 'tutor_turn_passthrough',
          ok: true,
          bypassed: true,
          reason: 'preserve_exact_system_history_and_user_payload',
          violations: [],
          duplicateInstructionLines: [],
        }
      : auditTutorStubPrompt({
          surface: 'tutor_turn',
          systemPrompt: attemptSystemPrompt,
          userPrompt: effectiveAttemptUserPrompt,
          messageHistory: context,
          instructionTexts: effectiveInstructionTexts,
        });
    const duplicateOnlyFailure =
      !passthrough &&
      !promptAudit.ok &&
      promptAudit.duplicateInstructionLines?.length > 0 &&
      promptAudit.violations.every((violation) => violation.code === 'duplicate_instruction_lines');
    if (duplicateOnlyFailure) {
      const originalAudit = promptAudit;
      const actualPromptRecovery = recoverTutorStubDuplicateInstructionLines({
        texts: [attemptSystemPrompt, effectiveAttemptUserPrompt],
        duplicateInstructionLines: originalAudit.duplicateInstructionLines,
      });
      const instructionRecovery = recoverTutorStubDuplicateInstructionLines({
        texts: effectiveInstructionTexts,
        duplicateInstructionLines: originalAudit.duplicateInstructionLines,
      });
      [attemptSystemPrompt, effectiveAttemptUserPrompt] = actualPromptRecovery.texts;
      effectiveInstructionTexts = instructionRecovery.texts;
      const recoveredAudit = auditTutorStubPrompt({
        surface: 'tutor_turn',
        systemPrompt: attemptSystemPrompt,
        userPrompt: effectiveAttemptUserPrompt,
        messageHistory: context,
        instructionTexts: effectiveInstructionTexts,
      });
      const recovery = {
        applied: actualPromptRecovery.applied && instructionRecovery.applied && recoveredAudit.ok,
        method: 'deduplicate_exact_instruction_lines',
        originalDuplicateInstructionLines: originalAudit.duplicateInstructionLines,
        removedPromptLineCount: actualPromptRecovery.removedLines.length,
        removedInstructionLineCount: instructionRecovery.removedLines.length,
      };
      promptAudit = { ...recoveredAudit, recovery };
      appendTraceEvent(trace, {
        type: 'prompt_audit_recovery',
        role,
        turn: tutorTurn,
        repairAttempt,
        recovery,
        audit: promptAudit,
      });
    }
    if (!promptAudit.ok) {
      appendTraceEvent(trace, {
        type: 'prompt_audit_failed',
        role,
        turn: tutorTurn,
        repairAttempt,
        audit: promptAudit,
      });
      throw new Error(
        `Tutor prompt audit failed: ${promptAudit.violations.map((violation) => violation.code).join(', ')}${
          promptAudit.duplicateInstructionLines?.length
            ? `; repeated instruction: ${promptAudit.duplicateInstructionLines[0].line}`
            : ''
        }`,
      );
    }
    const request = {
      systemPrompt: attemptSystemPrompt,
      messages: [...context, { role: 'user', content: effectiveAttemptUserPrompt }],
      config: {
        temperature,
        maxTokens,
        historyTurns,
        leakGuard: leakGuardEnabled,
        scaffoldGuard: scaffoldGuardEnabled,
        questionSupportGuard: questionSupportGuardEnabled,
        actorialRealizationGuard: actorialRealizationGuardEnabled,
        responseCompositionGuard: responseCompositionGuardEnabled,
        repetitionGuard: repetitionGuardEnabled,
        closureGuard: closureGuardEnabled,
        repairAttempt,
        messageHistoryMode: messageContext.historyMode,
        availableMessageCount: messageContext.availableMessageCount,
        replayedMessageCount: messageContext.replayedMessageCount,
        replayedUserMessageCount: messageContext.userMessageCount,
        replayedAssistantMessageCount: messageContext.assistantMessageCount,
        contextActivatedBy: messageContext.activatedBy,
        passthrough,
        promptAudit,
        speakerPrivilegeAudit,
      },
    };
    if (cliEffort) request.config.cliEffort = cliEffort;
    const useStreamingApi = streamMode === 'live' || streamMode === 'buffered';
    let response;
    if (isCliProvider(resolved.provider)) {
      const result = await callAIWithCliBridge(
        { provider: resolved.provider, model: resolved.model },
        attemptSystemPrompt,
        effectiveAttemptUserPrompt,
        role,
        { messageHistory: context, effort: cliEffort, signal },
      );
      response = {
        text: result.text,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        usage: {
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          totalTokens: (result.inputTokens || 0) + (result.outputTokens || 0),
          cost: result.cost || 0,
        },
        effort: result.effort || result.reasoningEffort || null,
        reasoningEffort: result.reasoningEffort || result.effort || null,
        tokenUsageAvailable: result.tokenUsageAvailable,
      };
    } else if (useStreamingApi) {
      const sink = streamMode === 'live' ? createConsoleTokenSink(role, stream?.interim) : null;
      let final = null;
      for await (const chunk of streamAI({
        provider: resolved.provider,
        model: resolved.model,
        systemPrompt: attemptSystemPrompt,
        messages: request.messages,
        preset: 'socratic',
        config: { temperature, maxTokens },
      })) {
        if (chunk.type === 'text_delta') {
          if (sink) sink.write(chunk.content);
        } else if (chunk.type === 'done') {
          final = chunk;
        }
      }
      const streamed = sink ? sink.finish() : false;
      response = {
        text: final?.content || '',
        provider: final?.provider || resolved.provider,
        model: final?.model || resolved.model,
        latencyMs: final?.latencyMs || 0,
        usage: final?.usage || null,
        streamed,
        generatedWithStreaming: true,
        bufferedStream: streamMode === 'buffered',
      };
    } else {
      const result = await callAI({
        provider: resolved.provider,
        model: resolved.model,
        systemPrompt: attemptSystemPrompt,
        messages: request.messages,
        preset: 'socratic',
        config: { temperature, maxTokens },
      });
      response = {
        text: result.content,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        usage: result.usage,
      };
    }

    response.promptSnapshot = {
      systemPrompt: attemptSystemPrompt,
      userPrompt: effectiveAttemptUserPrompt,
      messageHistory: context,
      role,
      repairAttempt,
      config: request.config,
      promptAudit,
      speakerPrivilegeAudit,
    };
    appendTraceEvent(trace, {
      type: 'model_call',
      role,
      turn: tutorTurn,
      startedAt,
      provider: response.provider,
      model: response.model,
      request,
      response: {
        text: response.text,
        latencyMs: response.latencyMs,
        usage: response.usage,
        tokenUsageAvailable: response.tokenUsageAvailable,
        streamed: Boolean(response.streamed),
        effort: response.effort || response.reasoningEffort || null,
      },
    });
    return response;
  }

  function auditTutorDraft(response, { role, attempt }) {
    let responseCompositionAudit = responseCompositionGuardEnabled
      ? auditTutorStubResponseComposition({
          text: response.text,
          frame: responseCompositionFrame,
          learnerText,
        })
      : { ok: true, active: false, issues: [], segments: null };
    const composedText = formatTutorStubResponseComposition(responseCompositionAudit);
    if (responseCompositionAudit.ok && composedText) {
      response.text = composedText;
      responseCompositionAudit = auditTutorStubResponseComposition({
        text: response.text,
        frame: responseCompositionFrame,
        learnerText,
      });
    }
    response.responseComposition = responseCompositionAudit.segments || null;
    response.responseCompositionFrame = responseCompositionFrame;
    response.responseCompositionAudit = responseCompositionAudit;
    const leakAudit = leakGuardEnabled
      ? auditTutorResponseLeak({ text: response.text, world, tutorTurn, learnerText, state })
      : { ok: true, leaks: [] };
    const scaffoldAudit = scaffoldGuardEnabled
      ? auditTutorStubGenerousInferenceResponse({
          text: response.text,
          resolution: humanDiscourseFrame.generousInference,
        })
      : { ok: true, issues: [], similarity: 0 };
    const questionSupportAudit = questionSupportGuardEnabled
      ? auditTutorStubQuestionSupportResponse({
          text: response.text,
          support: humanDiscourseFrame.questionSupport,
        })
      : { ok: true, issues: [] };
    const dramaticReleaseAudit = dramaticReleaseGuardEnabled
      ? auditTutorStubDramaticReleaseResponse({
          text: response.responseComposition?.development || response.text,
          frame: dramaticReleaseFrame,
        })
      : { ok: true, active: false, issues: [] };
    const responseConfigurationAudit = actorialRealizationGuardEnabled
      ? auditTutorStubResponseConfiguration({
          text: response.text,
          configuration: responseConfiguration,
          world,
          composition: response.responseComposition,
        })
      : null;
    const actorialRealizationAudit = responseConfigurationAudit?.actorial_realization || {
      ok: true,
      issues: [],
      active: false,
    };
    const repetitionAudit = repetitionGuardEnabled
      ? auditTutorStubRepetitionResponse({ text: response.text, recentTutorTexts })
      : { ok: true, issues: [], maxSimilarity: 0 };
    const closureAudit = closureGuardEnabled
      ? auditTutorStubDialogueClosureResponse({ text: response.text, frame: dialogueClosureFrame })
      : { ok: true, closesDialogue: false, invitesCheckIn: false, issues: [] };
    if (leakGuardEnabled) {
      appendTraceEvent(trace, {
        type: 'tutor_response_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: leakAudit.ok,
        leaks: leakAudit.leaks,
      });
    }
    if (scaffoldGuardEnabled) {
      appendTraceEvent(trace, {
        type: 'tutor_human_scaffold_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: scaffoldAudit.ok,
        issues: scaffoldAudit.issues,
        similarity: scaffoldAudit.similarity,
        generousInference: humanDiscourseFrame.generousInference,
      });
    }
    if (questionSupportGuardEnabled) {
      appendTraceEvent(trace, {
        type: 'tutor_question_support_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: questionSupportAudit.ok,
        issues: questionSupportAudit.issues,
        support: humanDiscourseFrame.questionSupport,
      });
    }
    if (dramaticReleaseGuardEnabled) {
      appendTraceEvent(trace, {
        type: 'tutor_dramatic_release_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: dramaticReleaseAudit.ok,
        issues: dramaticReleaseAudit.issues,
        frame: dramaticReleaseFrame,
      });
    }
    if (actorialRealizationGuardEnabled) {
      appendTraceEvent(trace, {
        type: 'tutor_actorial_realization_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: actorialRealizationAudit.ok,
        issues: actorialRealizationAudit.issues,
        selectedPart: responseConfiguration.actorial_part,
        selectedPartLabel: responseConfiguration.actorial_part_label,
        selectedPerformance: responseConfiguration.actorial_performance,
        responseConfigurationAudit,
      });
    }
    if (responseCompositionGuardEnabled) {
      appendTraceEvent(trace, {
        type: 'tutor_response_composition_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: responseCompositionAudit.ok,
        issues: responseCompositionAudit.issues,
        frame: responseCompositionFrame,
        segments: responseCompositionAudit.segments,
      });
    }
    if (repetitionGuardEnabled) {
      appendTraceEvent(trace, {
        type: 'tutor_repetition_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: repetitionAudit.ok,
        issues: repetitionAudit.issues,
        maxSimilarity: repetitionAudit.maxSimilarity,
      });
    }
    if (closureGuardEnabled) {
      appendTraceEvent(trace, {
        type: 'tutor_dialogue_closure_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: closureAudit.ok,
        closesDialogue: closureAudit.closesDialogue,
        invitesCheckIn: closureAudit.invitesCheckIn,
        issues: closureAudit.issues,
        frame: dialogueClosureFrame,
      });
    }
    return {
      ok:
        leakAudit.ok &&
        scaffoldAudit.ok &&
        questionSupportAudit.ok &&
        dramaticReleaseAudit.ok &&
        actorialRealizationAudit.ok &&
        responseCompositionAudit.ok &&
        repetitionAudit.ok &&
        closureAudit.ok,
      leakAudit,
      scaffoldAudit,
      questionSupportAudit,
      dramaticReleaseAudit,
      actorialRealizationAudit,
      responseConfigurationAudit,
      responseCompositionAudit,
      repetitionAudit,
      closureAudit,
    };
  }

  function preservableTutorUptake(audits) {
    if (
      (audits?.responseCompositionAudit?.issues || []).some((issue) =>
        ['missing_learner_uptake', 'generic_learner_uptake'].includes(issue.type),
      )
    ) {
      return '';
    }
    const uptake = String(audits?.responseCompositionAudit?.segments?.uptake || '').trim();
    if (!uptake) return '';
    if (!leakGuardEnabled) return uptake;
    const uptakeLeakAudit = auditTutorResponseLeak({ text: uptake, world, tutorTurn, learnerText, state });
    return uptakeLeakAudit.ok ? uptake : '';
  }

  function ensureFallbackComposition(text, uptake) {
    const baseAudit = auditTutorStubResponseComposition({
      text,
      frame: responseCompositionFrame,
      learnerText,
    });
    if (baseAudit.ok) return formatTutorStubResponseComposition(baseAudit) || String(text || '').trim();
    return [String(uptake || '').trim(), String(text || '').trim()].filter(Boolean).join(' ');
  }

  try {
    const attempts = [];
    const repairsApplied = [];
    let response = await invokeTutorAttempt({
      attemptUserPrompt: effectiveSpeakerUserPrompt,
      role: roleBase,
      streamMode: tutorStreamMode,
      repairAttempt: 0,
    });

    if (passthrough) {
      response.passthrough = true;
      return response;
    }
    if (!responseGuardEnabled) {
      attempts.push(tutorGuardAttemptEnvelope({ kind: 'original_candidate', attempt: 0, response }));
      return attachTutorGuardAccounting({
        response,
        state,
        trace,
        tutorTurn,
        role: roleBase,
        guards,
        attempts,
        repairsApplied,
        finalSource: 'original_candidate',
        outcome: 'unguarded_original',
      });
    }

    let audits = auditTutorDraft(response, { role: roleBase, attempt: 0 });
    attempts.push(tutorGuardAttemptEnvelope({ kind: 'original_candidate', attempt: 0, response, audits }));
    if (audits.ok) {
      response.leakAudit = audits.leakAudit;
      response.scaffoldAudit = audits.scaffoldAudit;
      response.questionSupportAudit = audits.questionSupportAudit;
      response.dramaticReleaseAudit = audits.dramaticReleaseAudit;
      response.actorialRealizationAudit = audits.actorialRealizationAudit;
      response.repetitionAudit = audits.repetitionAudit;
      response.closureAudit = audits.closureAudit;
      if (response.bufferedStream) {
        response.guardedStreamReplay = true;
      }
      return attachTutorGuardAccounting({
        response,
        state,
        trace,
        tutorTurn,
        role: roleBase,
        guards,
        attempts,
        repairsApplied,
        finalSource: 'original_candidate',
        finalAudits: audits,
        outcome: 'guarded_original_accepted',
      });
    }

    const firstRepairTriggers = tutorGuardIssueRows(audits);
    const firstPreservedUptake = preservableTutorUptake(audits);
    response = await invokeTutorAttempt({
      attemptUserPrompt: tutorResponseRepairPrompt({
        originalUserPrompt: effectiveSpeakerUserPrompt,
        unsafeDraft: response.text,
        leakAudit: audits.leakAudit,
        scaffoldAudit: audits.scaffoldAudit,
        questionSupportAudit: audits.questionSupportAudit,
        dramaticReleaseAudit: audits.dramaticReleaseAudit,
        actorialRealizationAudit: audits.actorialRealizationAudit,
        responseConfiguration,
        responseCompositionAudit: audits.responseCompositionAudit,
        preservedUptake: firstPreservedUptake,
        repetitionAudit: audits.repetitionAudit,
        closureAudit: audits.closureAudit,
        dialogueClosureFrame,
      }),
      role: `${roleBase}_repair`,
      streamMode: canStreamTutor ? 'buffered' : 'none',
      repairAttempt: 1,
    });
    audits = auditTutorDraft(response, { role: `${roleBase}_repair`, attempt: 1 });
    const modelRepairSpans = exactTutorRepairSpans(attempts[0].candidate.text, response.text);
    attempts.push(
      tutorGuardAttemptEnvelope({
        kind: 'model_repair_candidate',
        attempt: 1,
        response,
        audits,
        repairedSpans: modelRepairSpans,
      }),
    );
    repairsApplied.push({
      kind: 'model_rewrite',
      fromAttempt: 0,
      toAttempt: 1,
      triggeredBy: firstRepairTriggers,
      guardedSpans: attempts[0].guardedSpans,
      repairedSpans: modelRepairSpans,
    });
    if (audits.ok) {
      response.leakAudit = audits.leakAudit;
      response.scaffoldAudit = audits.scaffoldAudit;
      response.questionSupportAudit = audits.questionSupportAudit;
      response.dramaticReleaseAudit = audits.dramaticReleaseAudit;
      response.actorialRealizationAudit = audits.actorialRealizationAudit;
      response.repetitionAudit = audits.repetitionAudit;
      response.closureAudit = audits.closureAudit;
      response.repaired = true;
      if (response.bufferedStream) {
        response.guardedStreamReplay = true;
      }
      return attachTutorGuardAccounting({
        response,
        state,
        trace,
        tutorTurn,
        role: roleBase,
        guards,
        attempts,
        repairsApplied,
        finalSource: 'model_repair_candidate',
        finalAudits: audits,
        outcome: 'guarded_model_repair_accepted',
      });
    }

    const closureFallbackSelected = Boolean(
      closureGuardEnabled && (dialogueClosureFrame.mandatory || audits.closureAudit.closesDialogue),
    );
    const fallbackContext = {
      support: humanDiscourseFrame?.questionSupport || null,
      world,
      learnerText,
      dueEvidence: currentReleaseRows(state, tutorTurn),
      latestEvidence: humanDiscourseFrame?.scaffoldState?.releaseState?.latestReleased || null,
      recentTutorTexts,
    };
    const fallbackUptake =
      preservableTutorUptake(audits) ||
      firstPreservedUptake ||
      deterministicTutorStubLearnerUptake({
        learnerText,
        classification,
        actionFamily: responseCompositionFrame.selected_action_family || null,
      });
    const baseFallbackText = closureFallbackSelected
      ? deterministicTutorStubClosureResponse(dialogueClosureFrame)
      : dramaticReleaseGuardEnabled
        ? deterministicTutorStubDramaticReleaseFallback({
            frame: dramaticReleaseFrame,
            support: humanDiscourseFrame?.questionSupport || null,
            uptake: fallbackUptake,
            responseConfiguration: registerSelection?.response_configuration || registerSelection,
            variationKey: `${stateRunDebugId(state)}:${tutorTurn}`,
          })
        : scaffoldGuardEnabled
          ? deterministicGenerousInferenceFallback(fallbackContext)
          : questionSupportGuardEnabled
            ? deterministicTutorStubQuestionSupportFallback(fallbackContext)
            : deterministicTutorStubContextualFallback(fallbackContext);
    const fallbackText = dramaticReleaseGuardEnabled
      ? baseFallbackText
      : ensureFallbackComposition(baseFallbackText, fallbackUptake);
    const fallbackClosureAudit = closureGuardEnabled
      ? auditTutorStubDialogueClosureResponse({ text: fallbackText, frame: dialogueClosureFrame })
      : audits.closureAudit;
    const fallbackQuestionSupportAudit = questionSupportGuardEnabled
      ? auditTutorStubQuestionSupportResponse({
          text: fallbackText,
          support: humanDiscourseFrame.questionSupport,
        })
      : audits.questionSupportAudit;
    const fallback = {
      text: fallbackText,
      provider: resolved.provider,
      model: resolved.model,
      latencyMs: response.latencyMs || 0,
      usage: response.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
      effort: response.effort || response.reasoningEffort || cliEffort || null,
      reasoningEffort: response.reasoningEffort || response.effort || cliEffort || null,
      leakAudit: audits.leakAudit,
      scaffoldAudit: audits.scaffoldAudit,
      questionSupportAudit: fallbackQuestionSupportAudit,
      dramaticReleaseAudit: audits.dramaticReleaseAudit,
      actorialRealizationAudit: audits.actorialRealizationAudit,
      responseCompositionAudit: audits.responseCompositionAudit,
      repetitionAudit: audits.repetitionAudit,
      closureAudit: fallbackClosureAudit,
      repaired: true,
      deterministicFallback: true,
      deterministicClosure: closureFallbackSelected,
      tokenUsageAvailable: response.tokenUsageAvailable,
      promptSnapshot: response.promptSnapshot || null,
    };
    if (canStreamTutor) {
      fallback.guardedStreamReplay = true;
    }
    const fallbackAudits = auditTutorDraft(fallback, { role: `${roleBase}_fallback`, attempt: 2 });
    fallback.leakAudit = fallbackAudits.leakAudit;
    fallback.scaffoldAudit = fallbackAudits.scaffoldAudit;
    fallback.questionSupportAudit = fallbackAudits.questionSupportAudit;
    fallback.dramaticReleaseAudit = fallbackAudits.dramaticReleaseAudit;
    fallback.actorialRealizationAudit = fallbackAudits.actorialRealizationAudit;
    fallback.repetitionAudit = fallbackAudits.repetitionAudit;
    fallback.closureAudit = fallbackAudits.closureAudit;
    const fallbackRepairSpans = exactTutorRepairSpans(attempts[1].candidate.text, fallbackText);
    attempts.push(
      tutorGuardAttemptEnvelope({
        kind: 'deterministic_fallback',
        attempt: 2,
        response: fallback,
        audits: fallbackAudits,
        repairedSpans: fallbackRepairSpans,
      }),
    );
    repairsApplied.push({
      kind: 'deterministic_fallback',
      fromAttempt: 1,
      toAttempt: 2,
      triggeredBy: tutorGuardIssueRows(audits),
      guardedSpans: attempts[1].guardedSpans,
      repairedSpans: fallbackRepairSpans,
    });
    appendTraceEvent(trace, {
      type: 'tutor_response_fallback',
      role: roleBase,
      turn: tutorTurn,
      leaks: audits.leakAudit.leaks,
      scaffoldIssues: audits.scaffoldAudit.issues,
      questionSupportIssues: audits.questionSupportAudit.issues,
      dramaticReleaseIssues: audits.dramaticReleaseAudit.issues,
      actorialRealizationIssues: audits.actorialRealizationAudit.issues,
      responseCompositionIssues: audits.responseCompositionAudit.issues,
      repetitionIssues: audits.repetitionAudit.issues,
      closureIssues: audits.closureAudit.issues,
      text: fallbackText,
    });
    return attachTutorGuardAccounting({
      response: fallback,
      state,
      trace,
      tutorTurn,
      role: roleBase,
      guards,
      attempts,
      repairsApplied,
      finalSource: 'deterministic_fallback',
      finalAudits: fallbackAudits,
      outcome: 'guarded_deterministic_fallback',
    });
  } catch (err) {
    appendTraceEvent(trace, {
      type: err?.name === 'AbortError' ? 'model_call_aborted' : 'model_call_error',
      role: roleBase,
      turn: tutorTurn,
      provider: resolved.provider,
      model: resolved.model,
      error: err.message,
    });
    throw err;
  }
}

function saveTranscript(filePath, transcript) {
  fs.writeFileSync(filePath, `${JSON.stringify(transcript, null, 2)}\n`);
}

function publicWorldSummary(world) {
  if (!world) return 'No detective-story world is active; respond to the tutor topic directly.';
  return [
    `World: ${world.id} - ${world.title}`,
    `Discipline: ${world.discipline || 'investigation'}`,
    `Public question: ${world.question || world.publicQuestion || 'unknown'}`,
    'Opening situation:',
    String(world.openingFrame?.situation || world.setting || world.opening || world.openingSituation || '').trim() ||
      '(none supplied)',
    world.learnerVoice ? `Learner voice: ${world.learnerVoice}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function latestTutorMessage(state) {
  return [...(state?.history || [])].reverse().find((message) => message.role === 'assistant')?.content || '';
}

function buildTutorClarificationPrompt({ state, term = '' }) {
  const latestTutor = latestTutorMessage(state);
  const requestedTerm = String(term || '').trim();
  const comprehensionContext = tutorStubComprehensionPrompt(state.comprehension, {
    turn: state.turns.length,
  });
  return [
    '# Public scene',
    '',
    publicWorldSummary(state.world),
    '',
    '# Public transcript',
    '',
    compactPublicTranscriptForPrompt(state, state.historyTurns, { includeAnalysis: false }),
    '',
    '# Latest line to clarify',
    '',
    latestTutor || '(No tutor message is available yet.)',
    '',
    '# Learner clarification request',
    '',
    requestedTerm
      ? `Explain this term or phrase from the line above: "${requestedTerm}".`
      : 'No term was supplied. Pick up to three likely confusing words or phrases from the latest tutor message and explain them.',
    comprehensionContext || null,
    '',
    '# Output rules',
    '',
    '- Use only public wording already in the transcript.',
    '- Do not add new evidence, new suspects, hidden conclusions, or next proof steps.',
    '- Prefer one short paragraph, or at most three bullets.',
    '- If the requested term is not in the latest tutor message or public transcript, say so briefly and ask which phrase the learner means.',
    '- If the latest line ended with a question, explain the wording and then restate that live question directly. Never say that a tutor question is "pending".',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function cleanClarificationReply(text, latestTutor = '') {
  const cleaned = String(text || '')
    .replace(/^```(?:text|markdown)?/iu, '')
    .replace(/```$/u, '')
    .replace(/^\s*(clarify|clarification|explain|explanation)\s*:\s*/iu, '')
    .trim();
  return cleanTutorStubClarificationSpeech(cleaned, latestTutor);
}

async function generateTutorClarification({ state, term = '', resolved, cliEffort = null, signal = null }) {
  const raw = await callPromptModel({
    prompt: buildTutorClarificationPrompt({ state, term }),
    resolved,
    systemPrompt: CLARIFIER_SYSTEM_PROMPT,
    role: 'tutor_stub_clarifier',
    maxTokens: 500,
    trace: state.trace,
    stream: { enabled: false },
    cliEffort,
    turn: state.turns.length,
    signal,
  });
  return {
    ...raw,
    text: cleanClarificationReply(raw.text, latestTutorMessage(state)),
  };
}

function cleanAutomatedLearnerReply(text) {
  const cleaned = String(text || '')
    .replace(/^```(?:text|markdown)?/iu, '')
    .replace(/```$/u, '')
    .replace(/^\s*(learner|student)\s*:\s*/iu, '')
    .trim();
  return cleanTutorStubStageSpeech(cleaned, { voice: 'learner' });
}

function deterministicAutomatedLearnerFallback({ state }) {
  const latestTutor =
    [...(state.history || [])].reverse().find((message) => message.role === 'assistant')?.content || '';
  if (/trial-book|evidence|write|say|state|claim/iu.test(latestTutor)) {
    return 'I will make one public evidence claim and keep the verdict open until the marks license a name.';
  }
  return 'What public evidence should I test first?';
}

function automatedLearnerSystemPrompt(profile) {
  return [
    AUTO_LEARNER_SYSTEM_PROMPT,
    '',
    '# Private behavior brief',
    '',
    profile,
    '',
    'Apply this behavior brief to every public learner turn. Never quote or describe it.',
  ].join('\n');
}

function mixedLearnerArtifactsSystemPrompt(profile) {
  return [
    'You generate a paired learner answer and non-revealing clue for an experimental tutoring dialogue.',
    'Use only the public transcript and latest tutor message. Do not infer hidden proof paths, concealed answers, private tutor prompts, or unstaged evidence.',
    'The private behavior brief defines the answer. Preserve its recurring behavior and repair pattern.',
    'The clue describes where to look or what kind of move to make, but must not state or paraphrase the answer.',
    'The learner turn may be a concrete question. Keep all learner speech inside the scene and address the other speaker directly.',
    'Never write "the tutor", "the learner", "the dialogue", "the prompt", or commentary about a question being pending.',
    'The profile_signal field is private UI metadata, not learner speech. It may describe only how the visible answer expresses the profile.',
    '',
    '# Private behavior brief',
    '',
    profile,
    '',
    'Never quote or name the private behavior brief. The profile_signal may explain only visible response behavior in plain language. Return one JSON object only.',
  ].join('\n');
}

function automatedLearnerProfileId(profile) {
  const value = String(profile || '').trim();
  const directId = value.toLowerCase().replace(/-/gu, '_');
  if (learnerProfileIds().includes(directId)) return directId;
  const renderedId = learnerProfileIds().find((id) => learnerProfilePrompt(id) === value);
  if (renderedId) return renderedId;
  const legacyMatch = value.match(/simulating this automated learner profile:\s*([a-z0-9_-]+)/iu);
  return legacyMatch
    ? legacyMatch[1].toLowerCase().replace(/-/gu, '_')
    : null;
}

function resolveAutomatedLearnerProfile(profile) {
  const value = String(profile || '').trim();
  const profileId = value.toLowerCase().replace(/-/gu, '_');
  return learnerProfileIds().includes(profileId) ? learnerProfilePrompt(profileId) : value;
}

function explicitRecollectionFrame(text) {
  return /\b(?:(?:we|i)\s+(?:already\s+)?(?:saw|read|heard|recorded|remember(?:ed)?|recall(?:ed)?)|the\s+(?:record|trial-book|book)\s+(?:already\s+)?(?:said|showed|recorded|proved))\b/iu.test(
    String(text || ''),
  );
}

function automatedLearnerMarkerValue(turn, field) {
  const classifier = turn?.classification?.turn || {};
  const fields = {
    requestType: classifier.request_type,
    discourseMove: classifier.discourse_move,
    evidenceUse: classifier.evidence_use,
    epistemicStance: classifier.epistemic_stance,
    agency: classifier.agency,
    explicitRecollection: explicitRecollectionFrame(turn?.learner),
  };
  return fields[field] ?? null;
}

function automatedLearnerMarkerMatches(turn, clause) {
  return clause.every((group) => (group.values || []).includes(automatedLearnerMarkerValue(turn, group.field)));
}

function publicTutorPressure(text) {
  return /\b(miraculously|marvelous|wonderful|conveniently|apparently|nice trick|escape route|safe performance|hiding behind|not doing the work|lets you avoid|pressing|do not stall|don['’]t stall|fog and vibes|answer vending machine|mob|jab|jabs)\b/iu.test(
    String(text || ''),
  );
}

function negativeRegisterPressure(selection) {
  return NEGATIVE_FLOOR_REGISTERS.includes(selection?.selected_register);
}

function automatedLearnerProfileRuntimeState({ state, profile, turnNumber }) {
  const profileId = automatedLearnerProfileId(profile);
  const contract = learnerProfileContract(profileId);
  const observability = contract?.observabilityContract;
  if (!contract || !observability) return null;
  const policy = state.register?.policy || 'unknown';
  const eligiblePolicies = observability.eligiblePolicies || ['*'];
  const policyEligible = eligiblePolicies.includes('*') || eligiblePolicies.includes(policy);
  const latestTutor =
    [...(state.history || [])].reverse().find((message) => message.role === 'assistant')?.content || '';
  const currentStimulusEligible =
    observability.eligibility === 'public_tutor_pressure'
      ? publicTutorPressure(latestTutor) || negativeRegisterPressure(state.turns?.at(-1)?.registerSelection)
      : true;
  const eligible = policyEligible && currentStimulusEligible;
  const clauses = observability.markerClauses || [];
  const completedTurns = state.turns || [];
  const openingTutor = state.history?.[0]?.role === 'assistant' ? state.history[0].content : '';
  const priorTurns = policyEligible
    ? completedTurns.filter((turn, index) => {
        if (observability.eligibility !== 'public_tutor_pressure') return true;
        const stimulus = index === 0 ? openingTutor : completedTurns[index - 1]?.tutor;
        const stimulusSelection = index === 0 ? null : completedTurns[index - 1]?.registerSelection;
        return publicTutorPressure(stimulus) || negativeRegisterPressure(stimulusSelection);
      })
    : [];
  const observed = priorTurns.filter((turn) =>
    clauses.some((clause) => clause.length && automatedLearnerMarkerMatches(turn, clause)),
  ).length;
  const mustShowByTurn = Number(observability.mustShowByTurn || 0);
  const targetRate = Number(observability.minEligibleRate || 0);
  const eligibleOpportunities = priorTurns.length + (eligible ? 1 : 0);
  const targetCount =
    eligible && (!mustShowByTurn || turnNumber >= mustShowByTurn) ? Math.ceil(eligibleOpportunities * targetRate) : 0;
  const deadlineDue = eligible && mustShowByTurn > 0 && turnNumber >= mustShowByTurn && observed === 0;
  const requiredNow = Boolean(eligible && (deadlineDue || observed < targetCount));
  return {
    profileId,
    contract,
    observability,
    eligible,
    priorEligibleTurns: priorTurns.length,
    observed,
    targetCount,
    mustShowByTurn,
    requiredNow,
  };
}

function automatedLearnerProfileRuntime({ state, profile, turnNumber }) {
  const runtime = automatedLearnerProfileRuntimeState({ state, profile, turnNumber });
  if (!runtime) return '';
  return [
    '# Private behavior cue',
    '',
    `The latest public tutor move ${runtime.eligible ? 'does' : 'does not'} trigger the recurring behavior in the brief.`,
    runtime.requiredNow
      ? `This turn MUST visibly perform the recurring behavior: ${runtime.contract.intent.failureOperator}. Do not combine it with a fully repaired or fully warranted answer in the same turn.`
      : 'This turn may repair or progress if the behavior brief permits, but the recurring behavior remains active later.',
    'This cue is private. Never mention briefs, triggers, profiles, markers, or experimental conditions publicly.',
  ].join('\n');
}

function buildAutomatedLearnerPrompt({ state, profile, turnNumber, adherenceFeedback = '' }) {
  const hasTutorMessage = Boolean(latestTutorMessage(state));
  return [
    automatedLearnerProfileRuntime({ state, profile, turnNumber }),
    '',
    '# Public scene',
    '',
    publicWorldSummary(state.world),
    '',
    '# Dialogue context',
    '',
    hasTutorMessage
      ? 'The complete public dialogue precedes this task as native chat messages. Tutor speech is `user`; your own earlier learner speech is `assistant`.'
      : 'There is no prior tutor message. Start by asking or stating what you would investigate first.',
    '',
    '# Task',
    '',
    adherenceFeedback || null,
    adherenceFeedback ? '' : null,
    `Write learner turn ${turnNumber}. Use only public evidence and the public transcript.`,
    'First preserve the private behavior brief. A required distortion, omitted warrant, refusal, resistance, or withheld evidence step takes priority over generic progress.',
    `Only when the profile permits progress: if the tutor asks for a ${worldLedgerTerm(state?.world)} line, write one concise public evidence claim and treat it as both deduction and book entry.`,
    'Only when the profile permits progress: if several already-public premises form a warranted chain, you may state the connected premises and their supported follow-up conclusion in the same concise turn. Do not stop artificially after one step, but never add unstaged evidence.',
    'Only when the profile permits a help request: if you are stuck, ask one concrete question about what evidence would count.',
    'Write only speech the learner could say aloud inside the scene. Address the other speaker as "you"; never refer to "the tutor", "the learner", "the dialogue", or "the prompt".',
  ].join('\n');
}

async function generateAutomatedLearnerTurn({
  state,
  resolved,
  profile,
  turnNumber,
  adherenceFeedback = '',
  stream = null,
  cliEffort = null,
  signal = null,
}) {
  const prompt = buildAutomatedLearnerPrompt({ state, profile, turnNumber, adherenceFeedback });
  const systemPrompt = automatedLearnerSystemPrompt(profile);
  const messageHistory = tutorStubPublicMessagesForSpeaker(state.history, { speaker: 'learner' });
  const raw = await callPromptModel({
    prompt,
    messageHistory,
    resolved,
    systemPrompt,
    role: 'tutor_stub_auto_learner',
    maxTokens: 900,
    trace: state.trace,
    stream,
    cliEffort,
    turn: turnNumber,
    signal,
  });
  return {
    ...raw,
    text: cleanAutomatedLearnerReply(raw.text),
    promptSnapshot: {
      systemPrompt,
      userPrompt: prompt,
      messageHistory,
      turn: turnNumber,
      promptAudit: raw.promptAudit,
    },
  };
}

function buildMixedLearnerArtifactsPrompt({ state, profile, turnNumber }) {
  return [
    buildAutomatedLearnerPrompt({ state, profile, turnNumber }),
    '',
    '# Mixed learner artifacts',
    '',
    'Return one JSON object with exactly four string fields: "move", "clue", "answer", and "profile_signal".',
    'move: "ask_question" when the learner turn asks a useful question; otherwise "respond".',
    'answer: the learner turn requested above. It may be a direct in-scene question when clarification is the best next move.',
    'clue: a short directional cue that helps a human learner understand what kind of move the tutor is inviting.',
    'profile_signal: one short plain-language observation explaining how this exact answer visibly expresses the active learner profile. Describe behavior only; do not name a contract, failure operator, classifier label, hidden fact, or private instruction.',
    'When move is "ask_question", make the clue begin with "Ask" and name what uncertainty or evidence to ask about without writing the exact question.',
    'The clue must not contain, paraphrase, quote, complete, or reveal the answer. It may name the distinction, evidence source, operation, or question to attend to.',
    'The answer must be speakable inside the scene. Never mention "the tutor", "the learner", "the dialogue", "the prompt", or say a question is pending.',
    'Keep the clue under 18 words and the answer concise. Return JSON only.',
  ].join('\n');
}

async function generateMixedLearnerArtifacts({
  state,
  resolved,
  profile,
  turnNumber,
  cliEffort = null,
  signal = null,
}) {
  const prompt = buildMixedLearnerArtifactsPrompt({ state, profile, turnNumber });
  const systemPrompt = mixedLearnerArtifactsSystemPrompt(profile);
  const messageHistory = tutorStubPublicMessagesForSpeaker(state.history, { speaker: 'learner' });
  const raw = await callPromptModel({
    prompt,
    messageHistory,
    resolved,
    systemPrompt,
    role: 'tutor_stub_mixed_learner_artifacts',
    maxTokens: 1100,
    trace: state.trace,
    stream: { enabled: false, interim: state.interim },
    cliEffort,
    turn: turnNumber,
    signal,
  });
  const artifacts = parseMixedLearnerArtifacts(raw.text);
  const answer = cleanAutomatedLearnerReply(artifacts.answer);
  return {
    ...raw,
    answer,
    clue: artifacts.clue,
    move: mixedLearnerSuggestionMove(answer, artifacts.move),
    profileSignal: artifacts.profileSignal,
    parsedArtifacts: artifacts.parsed,
    promptSnapshot: {
      systemPrompt,
      userPrompt: prompt,
      messageHistory,
      turn: turnNumber,
      promptAudit: raw.promptAudit,
    },
  };
}

function automatedLearnerDraftMatchesRuntime({ text, raw, state, runtime }) {
  if (!runtime?.requiredNow) return true;
  const classification = classificationFromCombinedAnalysis(raw, state);
  const syntheticTurn = { learner: text, classification };
  return (runtime.observability.markerClauses || []).some(
    (clause) => clause.length > 0 && automatedLearnerMarkerMatches(syntheticTurn, clause),
  );
}

function automatedLearnerRepairInstruction(profileId) {
  if (profileId === 'proof_skipper') {
    return 'State an unsupported downstream attribution, source, actor, or public-record judgment as if the clue were sufficient; do not merely restate the clue. Remove because, since, so, therefore, if, then, would need, would want, and any sentence that explains or requests the missing bridge. Do not hedge or ask a question.';
  }
  if (profileId === 'false_memory') {
    return 'Begin naturally with "We already saw", "I remember", "The record said", or an equivalent explicit recollection, then state one concrete observation that the public record did not actually establish. Misquote the clue itself rather than drawing a bad inference from a true clue. Do not hedge, describe a future test, or correct the distortion in this turn.';
  }
  if (profileId === 'affective_resistant') {
    return "Object to the tutor's pressure only. Do not add a clue, public-record line, warrant, inference, or useful evidence step in the same turn.";
  }
  return 'Make the required failure public and unmistakable without repairing it in the same turn.';
}

async function enforceAutomatedLearnerProfile({
  state,
  resolved,
  profile,
  turnNumber,
  generated,
  cliEffort = null,
  signal = null,
  isCurrent = null,
}) {
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  const runtime = automatedLearnerProfileRuntimeState({ state, profile, turnNumber });
  const canPreclassify = Boolean(state.classifier.enabled && state.learnerDag.enabled && state.world);
  if (!runtime?.requiredNow || !canPreclassify || !generated.text) {
    return { generated, precomputedRaw: null, repaired: false, passed: null };
  }

  const maxRepairs = 2;
  let candidate = generated;
  let raw = null;
  let passed = false;
  let repairs = 0;
  while (repairs <= maxRepairs) {
    raw = await extractCombinedLearnerAnalysis({
      learnerText: candidate.text,
      state,
      tutorTurn: turnNumber,
      preflightSource: 'automated_learner_profile_adherence',
      signal,
    });
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    passed = automatedLearnerDraftMatchesRuntime({ text: candidate.text, raw, state, runtime });
    if (passed || repairs === maxRepairs) break;
    appendTraceEvent(state.trace, {
      type: 'auto_learner_profile_repair_requested',
      turn: turnNumber,
      profile: runtime.profileId,
      attempt: repairs + 1,
      failureOperator: runtime.contract.intent.failureOperator,
      draft: candidate.text,
    });
    const repaired = await generateAutomatedLearnerTurn({
      state,
      resolved,
      profile,
      turnNumber,
      adherenceFeedback: `Your previous draft was too normalized and did not visibly perform the required failure operator (${runtime.contract.intent.failureOperator}). Rewrite the learner turn. ${automatedLearnerRepairInstruction(runtime.profileId)} Keep it natural and concise.`,
      stream: { enabled: false, interim: state.interim },
      cliEffort,
      signal,
    });
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    if (repaired.text) candidate = repaired;
    repairs += 1;
  }
  appendTraceEvent(state.trace, {
    type: 'auto_learner_profile_adherence',
    turn: turnNumber,
    profile: runtime.profileId,
    required: true,
    passed,
    repaired: repairs > 0,
    repairAttempts: repairs,
  });
  return { generated: candidate, precomputedRaw: raw, repaired: repairs > 0, passed };
}

function tutorDialogueClosureFrameForTurn({ state, tutorTurn, tutorLearnerDag }) {
  const tutorDagSnapshot = buildTutorDagSnapshot(state, tutorTurn);
  return {
    tutorDagSnapshot,
    frame: buildTutorStubDialogueClosureFrame({
      lifecycle: state.dialogueClosure,
      learnerDagModel: tutorLearnerDag?.model || tutorLearnerDag || null,
      tutorDagSnapshot,
      answerTerm: answerTermForWorld(state.world),
    }),
  };
}

function typedActionStateBelief({ state, learnerText, stateObservation, turn }) {
  const dialogue = state.turns.flatMap((row) => [
    { role: 'learner', content: row.learner || '' },
    { role: 'tutor', content: row.tutor || '' },
  ]);
  dialogue.push({ role: 'learner', content: learnerText });
  const belief = estimateLearnerStateBelief({
    dialogue,
    interventionLedger: state.typedActions.ledger,
    turnIndex: turn,
  });
  belief.axes = {
    ...belief.axes,
    proof: stateObservation.axes.proof,
    release: stateObservation.axes.release,
    ownership: stateObservation.axes.ownership,
    conceptual_mastery: stateObservation.axes.conceptual_mastery,
    metacognitive_accuracy: stateObservation.axes.metacognitive_accuracy,
    affective_readiness: stateObservation.axes.affective_readiness,
  };
  return belief;
}

function advanceRuntimeScaffoldLifecycle(state, event) {
  if (!state.typedActions?.enabled) return null;
  const result = advanceScaffoldLifecycle(state.typedActions.scaffoldLifecycle, event);
  state.typedActions.scaffoldLifecycle = result.lifecycle;
  appendTraceEvent(state.trace, {
    type: 'tutor_scaffold_lifecycle_transition',
    turn: event.turn,
    transition: result.transition,
    lifecycle: result.lifecycle,
  });
  return result;
}

function scaffoldLifecycleActionGate(lifecycle) {
  const phase = lifecycle?.phase || 'diagnose';
  const allowedMoveFamilies = allowedMoveFamiliesForScaffoldPhase(phase);
  const allowedActionTypes = ADAPTATION_ACTIONS.filter((action) =>
    allowedMoveFamilies.includes(tutorStubMoveFamilyForAction(action.action_type)),
  ).map((action) => action.action_type);
  if (!allowedActionTypes.length) {
    throw new Error(`typed scaffold lifecycle phase ${phase} has no permitted pedagogical actions`);
  }
  return {
    phase,
    allowedMoveFamilies,
    allowedActionTypes,
    policySpec: {
      id: `tutor-stub-scaffold-lifecycle-${phase}`,
      version: '1.0',
      module_id: `scaffold_lifecycle:${phase}`,
      spec_hash: `scaffold-lifecycle.v1:${phase}:${allowedActionTypes.join(',')}`,
      action_policy: {
        allowed_action_families: allowedActionTypes,
        preferred_action_families: allowedActionTypes,
        disallowed_action_families: ADAPTATION_ACTIONS.map((action) => action.action_type).filter(
          (actionType) => !allowedActionTypes.includes(actionType),
        ),
      },
    },
  };
}

function closePriorTypedAction({ state, learnerText, turn }) {
  if (!state.typedActions?.enabled) return null;
  const result = closePendingIntervention({
    ledger: state.typedActions.ledger,
    learnerTurn: learnerText,
    turnIndex: turn,
    config: { semanticOutcomeObserver: true },
  });
  state.typedActions.ledger = result.ledger;
  if (!result.closedRecord) return null;
  const envelope = {
    schema: TUTOR_TYPED_ACTION_OUTCOME_SCHEMA,
    contract_id: result.closedRecord.contract_id,
    decision_turn: result.closedRecord.turn_index,
    observation_turn: turn,
    public_learner_observation: learnerText,
    outcome: result.closedRecord.outcome,
    observed_transition: result.closedRecord.observed_transition,
    evidence: result.closedRecord.evidence,
    evidence_contract: result.closedRecord.evidence_contract || null,
    policy_update: result.closedRecord.policy_update || null,
    closed_record: result.closedRecord,
  };
  const lifecycle = advanceRuntimeScaffoldLifecycle(state, {
    kind: 'closed_public_outcome',
    turn,
    outcome: envelope,
  });
  envelope.scaffold_lifecycle_transition = lifecycle?.transition || null;
  envelope.scaffold_lifecycle = lifecycle?.lifecycle || null;
  const priorTurn = [...state.turns]
    .reverse()
    .find((row) => Number(row.turn) === Number(result.closedRecord.turn_index));
  if (priorTurn?.typedActionDecision) priorTurn.typedActionOutcomeAfterNextLearner = jsonClone(envelope);
  appendTraceEvent(state.trace, {
    type: 'tutor_typed_action_outcome_closed',
    turn,
    decisionTurn: result.closedRecord.turn_index,
    outcome: envelope,
  });
  return envelope;
}

function typedActionRegisterSelection({
  state,
  learnerText,
  classification,
  tutorLearnerDag,
  registerSelection,
  decision,
}) {
  const register =
    registerSelection?.engagement_stance ||
    registerSelection?.selected_register ||
    decision.register_selection.engagement_stance ||
    'precise';
  const baseConfiguration =
    registerSelection?.response_configuration ||
    buildTutorStubResponseConfiguration({
      engagementStance: register,
      legacySelectedRegister: register,
      temperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
      policy: state.register?.policy || 'typed_action',
      learnerText,
      classification,
      tutorLearnerDag,
      comprehension: tutorStubComprehensionFeatures(state.comprehension, { turn: state.turns.length + 1 }),
      world: state.world,
    });
  const patch = decision.response_configuration_patch;
  const actorialInputs = {
    engagementStance: register,
    stanceDistribution:
      baseConfiguration.engagement_stance_distribution || registerSelection?.engagement_stance_distribution || null,
    actionFamily: patch.action_family,
    temperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    classification,
    tutorLearnerDag,
    comprehension: tutorStubComprehensionFeatures(state.comprehension, { turn: state.turns.length + 1 }),
    world: state.world,
    dueEvidence: currentReleaseRows(state, state.turns.length + 1),
    recentActorialParts: (state.register?.history || [])
      .filter((entry) => Number(entry.turn) < state.turns.length + 1)
      .map((entry) => entry.actorial_part || entry.response_configuration?.actorial_part)
      .filter(Boolean),
  };
  let actorialPart = selectTutorStubActorialPart(actorialInputs);
  if (
    registerTemperatureApplies(state.register?.policy) &&
    actorialPart.distribution.length &&
    actorialPart.locked !== true
  ) {
    const sampledPart = sampleTutorStubPolicyDistribution(
      actorialPart.distribution.map((row) => ({
        register: row.part,
        weight: row.weight,
        probability: row.probability,
      })),
      policySamplingContext(state, 'typed_action_actorial_part'),
    );
    actorialPart = selectTutorStubActorialPart({
      ...actorialInputs,
      selectedPartOverride: sampledPart.entry?.register || actorialPart.id,
    });
    actorialPart.random = sampledPart.audit;
  }
  const responseConfiguration = {
    ...jsonClone(baseConfiguration),
    action_family: patch.action_family,
    actorial_part: actorialPart.id,
    actorial_part_label: actorialPart.label,
    actorial_part_selection: actorialPart,
    actorial_performance: selectTutorStubActorialPerformance({
      engagementStance: register,
      actorialPart: actorialPart.id,
    }),
    support_level: patch.support_level,
    task_id: patch.task_id,
    knowledge_component: patch.knowledge_component,
    item_difficulty: patch.item_difficulty,
    typed_action_schema: decision.schema,
    selection_reasons: {
      ...(baseConfiguration.selection_reasons || {}),
      action_family: `Selected by the opt-in typed pedagogical-action policy as ${decision.chosen_action.action_type}.`,
      actorial_part: actorialPart.reason,
      support_level: 'Selected independently from move family, engagement stance, and task.',
      task: 'Supplied by the explicit typed-action task configuration.',
    },
  };
  const definition = getEngagementStanceDefinition(register) || {};
  const effective = {
    ...(registerSelection ? jsonClone(registerSelection) : {}),
    schema: registerSelection?.schema || 'machinespirits.tutor-stub.response-configuration-selection.v4',
    policy: registerSelection?.policy || state.register?.policy || 'typed_action',
    turn: registerSelection?.turn || state.turns.length + 1,
    engagement_stance: register,
    selected_register: register,
    selected_mode: register,
    legacy_selected_register: registerSelection?.legacy_selected_register || register,
    action_family: patch.action_family,
    support_level: patch.support_level,
    task_id: patch.task_id,
    knowledge_component: patch.knowledge_component,
    item_difficulty: patch.item_difficulty,
    audience_register: responseConfiguration.audience_register,
    lexical_accessibility: responseConfiguration.lexical_accessibility,
    scene_immersion: responseConfiguration.scene_immersion,
    actorial_part: responseConfiguration.actorial_part,
    actorial_part_label: responseConfiguration.actorial_part_label,
    actorial_part_selection: responseConfiguration.actorial_part_selection,
    actorial_performance: responseConfiguration.actorial_performance,
    unresolved_terms: responseConfiguration.unresolved_terms,
    valence: registerSelection?.valence || definition.valence || null,
    request_type:
      registerSelection?.request_type ||
      classification?.turn?.request_type ||
      classification?.turn?.discourse_move ||
      'unknown',
    reviewer_signal:
      registerSelection?.reviewer_signal || classification?.turn?.pedagogical_need || 'typed pedagogical action',
    register_reason: registerSelection?.register_reason || 'Default precise stance for the typed-action runtime.',
    response_configuration: responseConfiguration,
    typed_action_decision: decision,
    source: registerSelection?.source || 'typed_action_runtime',
  };
  if (state.register?.enabled) {
    if (state.register.history.length && state.register.history.at(-1)?.turn === effective.turn) {
      state.register.history[state.register.history.length - 1] = effective;
    } else {
      state.register.history.push(effective);
    }
    state.register.current = effective;
  }
  return effective;
}

function planTypedAction({
  state,
  learnerText,
  stateObservation,
  turn,
  classification,
  tutorLearnerDag,
  registerSelection,
}) {
  if (!state.typedActions?.enabled) {
    return { registerSelection, decision: null, priorOutcome: null };
  }
  const priorOutcome = closePriorTypedAction({ state, learnerText, turn });
  const stateBelief = typedActionStateBelief({ state, learnerText, stateObservation, turn });
  const lifecycleBeforeDecision = jsonClone(state.typedActions.scaffoldLifecycle);
  const lifecycleGate = scaffoldLifecycleActionGate(lifecycleBeforeDecision);
  const selection = selectPedagogicalAction({
    stateBelief,
    interventionLedger: state.typedActions.ledger,
    mode: 'closed_loop',
    config: {
      maxActionCandidates: ADAPTATION_ACTIONS.length,
      worldAdaptationSpec: lifecycleGate.policySpec,
    },
  });
  const considered = new Set(selection.candidateActions.map((candidate) => candidate.action_type));
  const vetoes = ADAPTATION_ACTIONS.filter((action) => !considered.has(action.action_type)).map((action) => {
    const moveFamily = tutorStubMoveFamilyForAction(action.action_type);
    const lifecycleVeto = !lifecycleGate.allowedMoveFamilies.includes(moveFamily);
    return {
      action_type: action.action_type,
      move_family: moveFamily,
      stage: lifecycleVeto ? 'scaffold_lifecycle_gate' : 'state_conditioned_candidate_generation',
      disposition: lifecycleVeto ? 'vetoed' : 'not_considered',
      reason: lifecycleVeto
        ? `Move family ${moveFamily} is not permitted during scaffold phase ${lifecycleGate.phase}.`
        : 'The current public learner-state hypotheses did not place this action in the policy candidate set.',
    };
  });
  const register = registerSelection?.engagement_stance || registerSelection?.selected_register || 'precise';
  let decision = buildTutorStubTypedActionDecision({
    selection,
    stateBelief,
    task: state.typedActions.config.task,
    register,
    supportLevel: state.typedActions.config.supportLevel,
    selectionProbability: 1,
    vetoes,
    modelVersion: 'programmatic/adaptive-action-policy',
  });
  const contractId = `${stateRunDebugId(state)}-typed-action-t${turn}`;
  const contract = createAdaptationContract({
    contractId,
    dialogueId: stateRunDebugId(state),
    turnIndex: turn,
    stateBelief,
    selectedAction: decision.chosen_action,
    candidateActions: selection.candidateActions,
    gateResult: { allowed: true, violations: [], repairs: [] },
    policyMode: 'closed_loop',
    worldAdaptationSpec: selection.worldAdaptationSpec,
  });
  decision = jsonClone({
    ...decision,
    contract_id: contractId,
    decision_provenance: {
      timing: 'after_current_public_learner_observation_before_tutor_output',
      public_observation_schema: stateObservation.schema,
      public_only: true,
      selection_method: 'deterministic_closed_loop_argmax',
      propensity: {
        selected_action_probability: 1,
        method: 'deterministic_policy',
      },
      candidate_universe: ADAPTATION_ACTIONS.map((action) => action.action_type),
      considered_candidates: selection.candidateActions.map((candidate) => candidate.action_type),
      vetoed_or_not_considered: vetoes.map((row) => row.action_type),
      task_axis_source: 'explicit_typed_action_config',
      register_axis_source: registerSelection ? 'existing_tutor_stub_register_policy' : 'typed_action_precise_fallback',
      support_axis_source:
        state.typedActions.config.supportLevel === null ? 'action_default' : 'explicit_typed_action_config',
      scaffold_lifecycle_gate: {
        phase: lifecycleGate.phase,
        allowed_move_families: lifecycleGate.allowedMoveFamilies,
        allowed_action_types: lifecycleGate.allowedActionTypes,
        policy_spec: lifecycleGate.policySpec,
      },
    },
    adaptation_contract: contract,
  });
  const lifecycleDecision = advanceRuntimeScaffoldLifecycle(state, {
    kind: 'typed_action_decision',
    turn,
    decision,
  });
  decision = jsonClone({
    ...decision,
    scaffold_lifecycle: {
      before: lifecycleBeforeDecision,
      transition: lifecycleDecision.transition,
      after: lifecycleDecision.lifecycle,
    },
  });
  const pending = appendPendingIntervention(state.typedActions.ledger, contract);
  state.typedActions.ledger = pending.ledger;
  state.typedActions.currentDecision = decision;
  const effectiveRegisterSelection = typedActionRegisterSelection({
    state,
    learnerText,
    classification,
    tutorLearnerDag,
    registerSelection,
    decision,
  });
  appendTraceEvent(state.trace, {
    type: 'tutor_typed_action_decision',
    turn,
    phase: 'before_tutor_output',
    stateObservation,
    decision,
    pendingIntervention: pending.pendingIntervention,
  });
  console.log(
    `${C.cyan}typed action >${C.reset} ${decision.chosen_action.action_type}; move ${
      decision.chosen_action.move_family
    }; support ${decision.chosen_action.support_level}; task ${decision.chosen_action.task_id}; stance ${register}`,
  );
  return { registerSelection: effectiveRegisterSelection, decision, priorOutcome };
}

async function runPassthroughTurn(learnerText, state, runtimeOptions = {}) {
  assertTutorStubTurnAttemptCurrent(runtimeOptions);
  const tutorTurn = state.turns.length + 1;
  const turnId = turnDebugId(state, tutorTurn);
  const learnerInput = runtimeOptions.learnerInput ? jsonClone(runtimeOptions.learnerInput) : null;
  const response = await callTutor({
    learnerText,
    history: state.history,
    state,
    systemPrompt: state.systemPrompt,
    resolved: state.resolved,
    temperature: state.temperature,
    maxTokens: state.maxTokens,
    historyTurns: state.historyTurns,
    world: null,
    dag: false,
    classification: null,
    tutorLearnerDagModel: null,
    registerSelection: null,
    humanDiscourseFrame: null,
    dialogueClosureFrame: null,
    trace: state.trace,
    stream: state.stream,
    cliEffort: state.cliEffort,
    multipleChoice: false,
    roleBase: 'tutor_stub_passthrough',
    learnerMessages: learnerInput?.messages || null,
    deferStreamOutput: Boolean(runtimeOptions.isCurrent),
    passthrough: true,
    signal: runtimeOptions.signal || null,
  });
  response.tutorRef = state.tuning?.activeRef || state.tutorInstance?.ref || null;
  assertTutorStubTurnAttemptCurrent(runtimeOptions);

  state.history.push({ role: 'user', content: learnerText });
  state.history.push({ role: 'assistant', content: response.text });
  const turnRecord = {
    turnId,
    turn: tutorTurn,
    tutorRef: response.tutorRef,
    learner: learnerText,
    ...(learnerInput
      ? {
          learnerInput,
          learnerMessages: learnerInput.messages,
        }
      : {}),
    passthrough: true,
    classification: null,
    tutorLearnerDagModel: null,
    registerSelection: null,
    responseConfiguration: null,
    responseComposition: null,
    tutor: response.text,
    prompts: {
      tutor: response.promptSnapshot || null,
    },
    provider: response.provider,
    model: response.model,
    latencyMs: response.latencyMs,
    usage: response.usage,
    tokenUsageAvailable: response.tokenUsageAvailable,
  };
  state.turns.push(turnRecord);
  appendTraceEvent(state.trace, {
    type: 'passthrough_turn_complete',
    turnId,
    turn: tutorTurn,
    modelCallCount: 1,
    requestSurface: ['system_setup', 'full_public_history', 'latest_learner_message'],
  });
  appendTraceEvent(state.trace, {
    type: 'turn_complete',
    turnId,
    turn: tutorTurn,
    turnRecord,
  });
  return {
    ...response,
    passthrough: true,
    dagSnapshot: null,
    registerSelection: null,
    releasePacing: null,
  };
}

async function runOneTurn(
  inputText,
  state,
  classification = null,
  tutorLearnerDag = null,
  registerSelection = null,
  previousRegisterEfficacy = null,
  precomputedResponse = null,
  runtimeOptions = {},
) {
  const learnerText = String(inputText || '').trim();
  if (!learnerText) {
    appendTraceEvent(state.trace, {
      type: 'empty_learner_turn_rejected',
      turn: state.turns.length + 1,
    });
    throw new Error('empty learner turn: no tutor response can be generated without learner text');
  }
  if (state.passthrough?.enabled) {
    return runPassthroughTurn(learnerText, state, runtimeOptions);
  }
  const learnerInput = runtimeOptions.learnerInput ? jsonClone(runtimeOptions.learnerInput) : null;
  assertTutorStubTurnAttemptCurrent(runtimeOptions);
  const tutorTurn = state.turns.length + 1;
  const turnId = turnDebugId(state, tutorTurn);
  const humanDiscourseFrame = buildHumanDiscourseFrame({
    state,
    tutorTurn,
    tutorLearnerDag,
    classification,
    learnerText,
  });
  const { tutorDagSnapshot: dagSnapshot, frame: dialogueClosureFrame } = tutorDialogueClosureFrameForTurn({
    state,
    tutorTurn,
    tutorLearnerDag,
  });
  const comprehensionBeforeTutor = tutorStubComprehensionSnapshot(state.comprehension, { turn: tutorTurn });
  const dagFactDropout = tutorLearnerDag?.dagFactDropout || null;
  const coachGuidance = precomputedResponse?.deterministicClosure
    ? []
    : tutorCoachGuidanceEntries(state, tutorTurn).map((entry) => ({ ...entry }));
  const stateObservation = buildTutorStubStateObservation({
    turnRecord: {
      turn: tutorTurn,
      learner: learnerText,
      tutorFeedback: learnerInput?.tutorFeedback || null,
      classification,
      tutorLearnerDagModel: tutorLearnerDag?.model || null,
      tutorLearnerDagUpdate: tutorLearnerDag
        ? {
            preflight: tutorLearnerDag.preflight || null,
            accepted: tutorLearnerDag.accepted || null,
            rejected: tutorLearnerDag.rejected || [],
            extractor: tutorLearnerDag.extractor || null,
            dagFactDropout,
          }
        : null,
      humanDiscourseFrame,
      scaffoldState: humanDiscourseFrame.scaffoldState,
      proofDebt: humanDiscourseFrame.proofDebt,
      warrantPremiseAudit: humanDiscourseFrame.warrantPremiseAudit,
      releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
    },
    previousObservation: state.turns.at(-1)?.stateObservation || null,
    previousTurnRecords: state.turns,
    provenance: {
      prediction_origin: 'after_learner_observation_before_tutor_realization',
      observed_before_tutor_call: true,
    },
  });

  const dynamicalState = state.pointOfAction?.enabled
    ? buildDynamicalSystemState({ state, classification, tutorLearnerDag })
    : null;
  const pointOfAction = state.pointOfAction?.enabled
    ? buildTutorStubPointOfActionTurn({
        arm: state.pointOfAction.arm,
        turn: tutorTurn,
        stagnation: dynamicalState?.state_vector?.stagnation || 0,
        proposedActionFamily:
          registerSelection?.action_family || registerSelection?.response_configuration?.action_family || null,
        previousActionFamilies: state.turns
          .map((turn) => turn?.registerSelection?.action_family || turn?.responseConfiguration?.action_family)
          .filter(Boolean),
        evidenceUse: classification?.turn?.evidence_use || null,
        unresolvedTerms: comprehensionBeforeTutor?.features?.unresolvedTerms || [],
        nearClosure: dynamicalState?.trajectory?.flags?.nearClosure === true,
        closeInquiry:
          registerSelection?.action_family === 'close_inquiry' || dialogueClosureFrame?.mandatory === true,
        duePremises: currentReleaseRows(state, tutorTurn).map((row) => row.premise),
      })
    : null;
  if (state.pointOfAction) state.pointOfAction.current = pointOfAction;
  if (pointOfAction) {
    appendTraceEvent(state.trace, {
      type: 'point_of_action_assignment',
      turn: tutorTurn,
      turnId,
      pointOfAction,
    });
    registerSelection = applyTutorStubPointOfActionConstraint(registerSelection, pointOfAction);
  }

  if (dagFactDropout?.droppedNow?.length || dagFactDropout?.repairedNow?.length) {
    appendTraceEvent(state.trace, {
      type: 'dag_fact_dropout_update',
      turn: tutorTurn,
      turnId,
      dropout: dagFactDropout,
    });
  }

  const typedAction =
    state.typedActions?.enabled && precomputedResponse?.deterministicClosure
      ? {
          registerSelection,
          decision: null,
          priorOutcome: closePriorTypedAction({ state, learnerText, turn: tutorTurn }),
        }
      : planTypedAction({
          state,
          learnerText,
          stateObservation,
          turn: tutorTurn,
          classification,
          tutorLearnerDag,
          registerSelection,
        });
  registerSelection = typedAction.registerSelection;
  registerSelection = applyTutorStubPointOfActionConstraint(registerSelection, pointOfAction);
  const tutorFeedback = learnerInput?.tutorFeedback || null;
  const feedbackTargetTurn = findTutorStubFeedbackTargetTurn({
    feedback: tutorFeedback,
    turns: state.turns,
    opening: {
      turnId: openingDebugId(stateRunDebugId(state)),
      text: state.history.find((message) => message.role === 'assistant')?.content || '',
      provider: state.openingRealization?.provider || null,
      model: state.openingRealization?.model || null,
    },
  });
  const feedbackAdaptationPlan = buildTutorStubFeedbackAdaptationPlan({
    feedback: tutorFeedback,
    targetTurn: feedbackTargetTurn,
    nextSelection: registerSelection,
  });
  assertTutorStubTurnAttemptCurrent(runtimeOptions);
  if (
    precomputedResponse?.speculativeCacheHit &&
    pointOfAction?.assigned_trigger &&
    pointOfAction.arm !== 'standing_book'
  ) {
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_tutor_prefetch_bypassed',
      turn: tutorTurn,
      reason: 'point_of_action_intervention_must_precede_tutor_output_generation',
    });
    precomputedResponse = null;
  }
  if (precomputedResponse?.speculativeCacheHit && typedAction.decision) {
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_tutor_prefetch_bypassed',
      turn: tutorTurn,
      reason: 'typed_action_must_precede_tutor_output_generation',
    });
    precomputedResponse = null;
  }
  if (precomputedResponse?.speculativeCacheHit && feedbackAdaptationPlan) {
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_tutor_prefetch_bypassed',
      turn: tutorTurn,
      reason: 'rated_response_adaptation_contract_must_precede_tutor_output_generation',
    });
    precomputedResponse = null;
  }

  const response =
    precomputedResponse ||
    (await callTutor({
      learnerText,
      history: state.history,
      state,
      systemPrompt: state.systemPrompt,
      resolved: state.resolved,
      temperature: state.temperature,
      maxTokens: state.maxTokens,
      historyTurns: state.historyTurns,
      world: state.world,
      dag: state.dag,
      classification,
      tutorLearnerDagModel: tutorLearnerDag,
      registerSelection,
      humanDiscourseFrame,
      dialogueClosureFrame,
      trace: state.trace,
      stream: state.stream,
      cliEffort: state.cliEffort,
      multipleChoice: state.multipleChoice,
      learnerMessages: learnerInput?.messages || null,
      tutorFeedback,
      feedbackAdaptationPlan,
      deferStreamOutput: Boolean(runtimeOptions.isCurrent),
      signal: runtimeOptions.signal || null,
    }));
  response.tutorRef = state.tuning?.activeRef || state.tutorInstance?.ref || null;
  assertTutorStubTurnAttemptCurrent(runtimeOptions);
  const priorDialogueClosure = state.dialogueClosure;
  state.dialogueClosure = advanceTutorStubDialogueClosure(priorDialogueClosure, {
    frame: dialogueClosureFrame,
    audit: response.closureAudit,
    turn: tutorTurn,
  });
  if (state.dialogueClosure?.phase !== priorDialogueClosure?.phase) {
    appendTraceEvent(state.trace, {
      type: 'dialogue_closure_transition',
      turn: tutorTurn,
      from: priorDialogueClosure?.phase || 'open',
      to: state.dialogueClosure.phase,
      basis: state.dialogueClosure.basis,
      audit: response.closureAudit || null,
    });
  }

  const responseConfigurationAudit = auditTutorStubResponseConfiguration({
    text: response.text,
    configuration: registerSelection?.response_configuration || registerSelection,
    world: state.world,
    composition: response.responseComposition,
  });
  if (responseConfigurationAudit) {
    appendTraceEvent(state.trace, {
      type: 'response_configuration_audit',
      turn: tutorTurn,
      turnId,
      configuration: registerSelection?.response_configuration || null,
      audit: responseConfigurationAudit,
    });
  }

  const feedbackAdaptationAudit = auditTutorStubFeedbackAdaptation({
    plan: feedbackAdaptationPlan,
    targetTurn: feedbackTargetTurn,
    currentTurn: {
      turn: tutorTurn,
      turnId,
      tutor: response.text,
      responseConfiguration: registerSelection?.response_configuration || null,
      responseConfigurationAudit,
      responseComposition: response.responseComposition || null,
      responseCompositionAudit: response.responseCompositionAudit || null,
    },
  });

  const comprehensionResponse = applyTutorStubComprehensionResponse(state.comprehension, {
    text: response.text,
    turn: tutorTurn,
    source: 'tutor_turn',
  });
  const comprehensionAfterTutor = comprehensionResponse.snapshot;
  if (comprehensionResponse.explainedTerms.length || comprehensionBeforeTutor.lastRequest?.turn === tutorTurn) {
    appendTraceEvent(state.trace, {
      type: 'comprehension_response',
      turn: tutorTurn,
      explainedTerms: comprehensionResponse.explainedTerms,
      unresolvedTerms: comprehensionAfterTutor?.features?.unresolvedTerms || [],
      comprehensionState: comprehensionAfterTutor,
    });
  }

  const dueReleaseRows = currentReleaseRows(state, tutorTurn);
  const dramaticReleaseFrame = buildTutorStubDramaticReleaseFrame({ dueEvidence: dueReleaseRows });
  const duePremiseIds = dueReleaseRows.map((row) => row?.premise).filter(Boolean);
  const releaseDeliveryAudit = auditTutorStubReleaseDelivery({
    text: response.text,
    world: state.world,
    premiseIds: duePremiseIds,
  });
  response.releaseDeliveryAudit = releaseDeliveryAudit;
  if (duePremiseIds.length) {
    appendTraceEvent(state.trace, {
      type: 'release_delivery_audit',
      turn: tutorTurn,
      turnId,
      audit: releaseDeliveryAudit,
    });
  }

  const releasePacing = commitTutorStubReleasePacing({
    pacing: state.releasePacing,
    world: state.world,
    turn: tutorTurn,
    deliveredPremises: releaseDeliveryAudit.deliveredPremises,
  });
  if (releasePacing) {
    appendTraceEvent(state.trace, {
      type: 'release_pacing_committed',
      turn: tutorTurn,
      turnId,
      releasedNow: releasePacing.releasedNow,
      notDeliveredNow: releasePacing.notDeliveredNow,
      direction: releasePacing.direction,
      effectiveSpeed: releasePacing.effectiveSpeed,
      nextRelease: releasePacing.nextRelease,
      releasePacing,
    });
  }

  const pointOfActionCompliance = auditTutorStubPointOfActionCompliance({
    turn: pointOfAction,
    tutorText: response.text,
    releasedPremiseCount: releasePacing?.releasedNow?.length || 0,
    realizedActionFamily:
      registerSelection?.action_family || registerSelection?.response_configuration?.action_family || null,
    guardsPassed:
      response.leakAudit?.ok !== false &&
      response.scaffoldAudit?.ok !== false &&
      response.questionSupportAudit?.ok !== false &&
      response.dramaticReleaseAudit?.ok !== false &&
      response.repetitionAudit?.ok !== false &&
      response.closureAudit?.ok !== false &&
      response.guardAccounting?.finalDelivery?.auditOk !== false,
  });
  if (pointOfAction) {
    const completedPointOfAction = { ...pointOfAction, compliance: pointOfActionCompliance };
    state.pointOfAction.current = completedPointOfAction;
    state.pointOfAction.history.push(completedPointOfAction);
    appendTraceEvent(state.trace, {
      type: 'point_of_action_compliance',
      turn: tutorTurn,
      turnId,
      compliance: pointOfActionCompliance,
    });
  }

  const feedbackObservation = buildTutorStubFeedbackObservation({
    feedback: tutorFeedback,
    targetTurn: feedbackTargetTurn,
    learnerTurn: {
      turn: tutorTurn,
      turnId,
      text: learnerText,
      messageCount: learnerInput?.messageCount || learnerInput?.messages?.length || 1,
      messages: learnerInput?.messages || null,
      classification,
    },
    currentTurn: {
      turn: tutorTurn,
      turnId,
      tutor: response.text,
      responseConfiguration: registerSelection?.response_configuration || null,
      responseConfigurationAudit,
      responseComposition: response.responseComposition || null,
      responseCompositionAudit: response.responseCompositionAudit || null,
      tutorLeakAudit: response.leakAudit || null,
      tutorHumanScaffoldAudit: response.scaffoldAudit || null,
      tutorQuestionSupportAudit: response.questionSupportAudit || null,
      tutorDramaticReleaseAudit: response.dramaticReleaseAudit || null,
      tutorRepetitionAudit: response.repetitionAudit || null,
      tutorDialogueClosureAudit: response.closureAudit || null,
      tutorResponseRepaired: Boolean(response.repaired),
      tutorDeterministicFallback: Boolean(response.deterministicFallback),
    },
    previousRegisterEfficacy,
    adaptationPlan: feedbackAdaptationPlan,
    adaptationAudit: feedbackAdaptationAudit,
    provenance: {
      runId: stateRunDebugId(state),
      trace: state.trace?.filePath ? path.relative(ROOT, state.trace.filePath) : null,
      worldId: state.world?.id || null,
      learnerProfileId: state.learnerProfileId || null,
      interactionMode: state.interaction?.mode || 'learner',
    },
  });

  state.history.push({ role: 'user', content: learnerText });
  state.history.push({ role: 'assistant', content: response.text });
  if (coachGuidance.length && state.coach) {
    const appliedIds = new Set(coachGuidance.map((entry) => entry.id));
    state.coach.pending = state.coach.pending.filter((entry) => !appliedIds.has(entry.id));
    state.coach.history.push({
      turn: tutorTurn,
      turnId,
      guidance: coachGuidance,
      tutor: response.text,
      appliedAt: new Date().toISOString(),
    });
    appendTraceEvent(state.trace, {
      type: 'coach_guidance_applied',
      turn: tutorTurn,
      turnId,
      guidance: coachGuidance,
      publicTranscriptChanged: false,
    });
  }
  const turnRecord = {
    turnId,
    turn: tutorTurn,
    tutorRef: response.tutorRef,
    learner: learnerText,
    ...(learnerInput
      ? {
          learnerInput,
          learnerMessages: learnerInput.messages,
        }
      : {}),
    coachGuidance,
    stateObservation,
    classification,
    tutorLearnerDagModel: tutorLearnerDag?.model || null,
    learnerAdvance: tutorLearnerDag?.advance || tutorLearnerDag?.model?.learnerAdvance || null,
    tutorLearnerDagUpdate: tutorLearnerDag
      ? {
          preflight: tutorLearnerDag.preflight || null,
          accepted: tutorLearnerDag.accepted || null,
          rejected: tutorLearnerDag.rejected || [],
          extractor: tutorLearnerDag.extractor || null,
          advance: tutorLearnerDag.advance || tutorLearnerDag.model?.learnerAdvance || null,
          dagFactDropout,
        }
      : null,
    dagFactDropout,
    humanDiscourseFrame,
    scaffoldState: humanDiscourseFrame.scaffoldState,
    sideArc: humanDiscourseFrame.sideArc,
    proofDebt: humanDiscourseFrame.proofDebt,
    warrantPremiseAudit: humanDiscourseFrame.warrantPremiseAudit,
    generousInference: humanDiscourseFrame.generousInference,
    questionSupport: humanDiscourseFrame.questionSupport,
    dramaticRelease: {
      frame: dramaticReleaseFrame,
      audit: response.dramaticReleaseAudit || null,
    },
    releasePacing,
    releaseDeliveryAudit,
    comprehension: {
      beforeTutor: comprehensionBeforeTutor,
      afterTutor: comprehensionAfterTutor,
    },
    dialogueClosure: {
      frame: dialogueClosureFrame,
      audit: response.closureAudit || null,
      lifecycle: state.dialogueClosure,
    },
    closureCheckIn: dialogueClosureFrame.phase === 'final_checkin_response',
    pointOfAction: state.pointOfAction?.current || null,
    registerSelection,
    responseConfiguration: jsonClone(registerSelection?.response_configuration || null),
    responseConfigurationAudit,
    feedbackAdaptationPlan,
    feedbackAdaptationAudit,
    feedbackObservation,
    responseComposition: {
      frame: jsonClone(response.responseCompositionFrame || null),
      audit: jsonClone(response.responseCompositionAudit || null),
      uptake: response.responseComposition?.uptake || null,
      development: response.responseComposition?.development || null,
      segmentation: response.responseComposition?.method || null,
      atomicAssistantTurn: true,
    },
    previousRegisterEfficacy,
    ...(typedAction.decision || typedAction.priorOutcome
      ? {
          typedActionDecision: jsonClone(typedAction.decision),
          typedActionPriorOutcome: jsonClone(typedAction.priorOutcome),
          scaffoldLifecycle: jsonClone(state.typedActions.scaffoldLifecycle),
          scaffoldLifecycleTransitions: [
            typedAction.priorOutcome?.scaffold_lifecycle_transition,
            typedAction.decision?.scaffold_lifecycle?.transition,
          ]
            .filter(Boolean)
            .map((transition) => jsonClone(transition)),
        }
      : {}),
    tutor: response.text,
    tutorDag: dagSnapshot,
    tutorLeakAudit: response.leakAudit || null,
    tutorHumanScaffoldAudit: response.scaffoldAudit || null,
    tutorQuestionSupportAudit: response.questionSupportAudit || null,
    tutorDramaticReleaseAudit: response.dramaticReleaseAudit || null,
    tutorRepetitionAudit: response.repetitionAudit || null,
    tutorDialogueClosureAudit: response.closureAudit || null,
    tutorResponseRepaired: Boolean(response.repaired),
    tutorDeterministicFallback: Boolean(response.deterministicFallback),
    tutorDeterministicClosure: Boolean(response.deterministicClosure),
    prompts: {
      tutor: response.promptSnapshot || null,
    },
    tutorGuardAccounting: response.guardAccounting || null,
    provider: response.provider,
    model: response.model,
    latencyMs: response.latencyMs,
    usage: response.usage,
    tokenUsageAvailable: response.tokenUsageAvailable,
  };
  state.turns.push(turnRecord);
  if (feedbackObservation) {
    recordTutorStubTuningFeedback(state.tuning, feedbackObservation);
    appendTraceEvent(state.trace, {
      type: 'tutor_feedback_observation',
      turnId,
      turn: tutorTurn,
      observation: feedbackObservation,
      publicTranscriptChanged: false,
    });
  }
  appendTraceEvent(state.trace, {
    type: 'turn_complete',
    turnId,
    turn: tutorTurn,
    turnRecord,
  });
  return {
    ...response,
    dagSnapshot,
    registerSelection: jsonClone(registerSelection || null),
    releasePacing: jsonClone(releasePacing),
  };
}

async function runAnalyzedTutorTurn(
  learnerText,
  state,
  { precomputedRaw = null, signal = null, isCurrent = null } = {},
) {
  const { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy } = await analyzeLearnerTurn(
    learnerText,
    state,
    { precomputedRaw, signal, isCurrent },
  );
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  startInterimAnimation(
    state,
    'calling tutor',
    buildTutorInterimContext({
      learnerText,
      state,
      classification,
      tutorLearnerDag,
      registerSelection,
      previousRegisterEfficacy,
    }),
  );
  let response;
  try {
    response = await runOneTurn(
      learnerText,
      state,
      classification,
      tutorLearnerDag,
      registerSelection,
      previousRegisterEfficacy,
      null,
      { signal, isCurrent },
    );
  } finally {
    stopInterimAnimation(state);
  }
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  printWithConcurrentTerminal(state, () => {
    if (automaticTechnicalDetailsEnabled(state)) printTutorDagSnapshot(response.dagSnapshot);
    printDirectorPreludeBeforeFirstTutor(state, { reason: 'first_generated_tutor_response' });
    printTutorResponse(response, state.stream);
    console.log(`${C.dim}${metadataLine(response)}${C.reset}\n`);
  });
  await printExplanatoryDebugTurn(state, { signal, isCurrent });
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  writeFieldVisualization(state, { reason: 'turn_complete' });
  return response;
}

async function emitTutorOpeningToState(state, { enabled = true, reason = 'start', signal = null } = {}) {
  if (!enabled || state.history.length) return null;
  const openingRealization = await buildTutorOpening(state, { signal });
  const opening = openingRealization.text;
  state.openingRealization = openingRealization;
  state.history.push({ role: 'assistant', content: opening });
  acknowledgeTutorStubOpeningRelease({ pacing: state.releasePacing, world: state.world });
  const turnId = openingDebugId(stateRunDebugId(state));
  appendTraceEvent(state.trace, {
    type: 'tutor_opening',
    turnId,
    reason,
    text: opening,
    realization: openingRealization,
  });
  printOpeningDebugLine(state);
  printDirectorPreludeBeforeFirstTutor(state, { reason });
  console.log(`${C.magenta}tutor >${C.reset} ${opening}\n`);
  return opening;
}

function learnerDagReachedGroundedClosure(state) {
  const model = state.turns.at(-1)?.tutorLearnerDagModel || null;
  return tutorStubLearnerDagGrounded(model);
}

async function runAutomatedLearnerDialogue({
  state,
  firstMessage = '',
  openingEnabled = true,
  autoLearnerResolved,
  autoLearnerProfile,
  autoTurns,
  autoSafetyTurns,
  autoStopOnGrounded,
  cliEffort = null,
  signal = null,
  isCurrent = null,
}) {
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  const autoLearnerSpeakerLabel = learnerProfileSpeakerLabel(automatedLearnerProfileId(autoLearnerProfile));
  appendTraceEvent(state.trace, {
    type: 'auto_learner_run_start',
    model: autoLearnerResolved,
    profile: autoLearnerProfile,
    maxTurns: autoTurns,
    untilGrounded: autoTurns === null,
    safetyTurns: autoSafetyTurns,
    stopOnGrounded: autoStopOnGrounded,
  });
  if (!firstMessage) {
    await emitTutorOpeningToState(state, { enabled: openingEnabled, reason: 'auto_start', signal });
  }

  let nextLearnerText = firstMessage.trim();
  let reason = 'auto_turn_cap';
  for (let i = 0; autoTurns === null || i < autoTurns; i += 1) {
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    if (autoTurns === null && i >= autoSafetyTurns) {
      reason = 'auto_safety_turn_cap';
      break;
    }
    const turnNumber = state.turns.length + 1;
    let precomputedRaw = null;
    if (!nextLearnerText) {
      startInterimAnimation(state, 'calling auto learner', { tutorTurn: turnNumber });
      let generated;
      try {
        generated = await generateAutomatedLearnerTurn({
          state,
          resolved: autoLearnerResolved,
          profile: autoLearnerProfile,
          turnNumber,
          stream: { enabled: false, interim: state.interim },
          cliEffort,
          signal,
        });
      } finally {
        stopInterimAnimation(state);
      }
      const enforced = await enforceAutomatedLearnerProfile({
        state,
        resolved: autoLearnerResolved,
        profile: autoLearnerProfile,
        turnNumber,
        generated,
        cliEffort,
        signal,
        isCurrent,
      });
      assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
      generated = enforced.generated;
      precomputedRaw = enforced.precomputedRaw;
      nextLearnerText = generated.text;
      if (!nextLearnerText) {
        nextLearnerText = deterministicAutomatedLearnerFallback({ state });
        appendTraceEvent(state.trace, {
          type: 'auto_learner_empty_fallback',
          turn: turnNumber,
          text: nextLearnerText,
          provider: generated.provider,
          model: generated.model,
        });
      }
      appendTraceEvent(state.trace, {
        type: 'auto_learner_turn',
        turn: turnNumber,
        text: nextLearnerText,
        provider: generated.provider,
        model: generated.model,
        latencyMs: generated.latencyMs,
        usage: generated.usage,
        profileRepaired: enforced.repaired,
        profileAdherencePassed: enforced.passed,
      });
      printWithConcurrentTerminal(state, () => {
        printTurnDebugLine(state, turnNumber);
        console.log(`${C.brightBlue}${C.bold}${autoLearnerSpeakerLabel} (auto) >${C.reset} ${nextLearnerText}\n`);
      });
    } else {
      printWithConcurrentTerminal(state, () => {
        printTurnDebugLine(state, turnNumber);
        console.log(`${C.brightBlue}${C.bold}${autoLearnerSpeakerLabel} (auto) >${C.reset} ${nextLearnerText}\n`);
      });
    }

    await runAnalyzedTutorTurn(nextLearnerText, state, { precomputedRaw, signal, isCurrent });
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    nextLearnerText = '';

    if (autoStopOnGrounded && learnerDagReachedGroundedClosure(state)) {
      reason = 'auto_grounded_closure';
      break;
    }
  }
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  appendTraceEvent(state.trace, {
    type: 'auto_learner_run_end',
    reason,
    turns: state.turns.length,
  });
  return { reason, turns: state.turns.length };
}

async function main() {
  if (args.help) {
    printHelp();
    return;
  }
  if (args['list-worlds']) {
    printWorlds();
    return;
  }
  if (args['list-tutors']) {
    for (const tutor of listTutorStubTutorInstances()) {
      console.log(`${tutor.id}@v${tutor.source_version || 1}\t${tutor.title}\t${tutor.description || ''}`);
    }
    return;
  }
  if (args['list-learner-profiles']) {
    printAutomatedLearnerProfiles();
    return;
  }

  const passthroughEnabled = Boolean(args.passthrough);
  if (passthroughEnabled) {
    args.dag = false;
    args['tutor-learner-dag'] = false;
    args['no-classifier'] = true;
    args['no-register-selection'] = true;
    args['typed-actions'] = false;
    args['point-of-action-arm'] = '';
    args['auto-learner'] = false;
    args['mixed-learner'] = false;
    args['mixed-mode'] = false;
    args['no-memory-summary'] = true;
    args['multiple-choice'] = false;
    args['no-opening'] = true;
    args['no-closeout-report'] = true;
    args['no-turn-feedback'] = true;
    args['no-interim-animation'] = true;
    args['field-viz'] = false;
    args.tuning = 'off';
  }

  let tutorInstance = resolveTutorStubTutorInstance(args.tutor);
  let tuningMode = normalizeTutorStubTuningMode(args.tuning);
  if (!commandLineOptionProvided('model') && !process.env.TUTOR_STUB_MODEL && tutorInstance.modelDefaults.tutor) {
    args.model = tutorInstance.modelDefaults.tutor;
  }
  if (
    !commandLineOptionProvided('classifier-model') &&
    !process.env.TUTOR_STUB_CLASSIFIER_MODEL &&
    tutorInstance.modelDefaults.interpretation
  ) {
    args['classifier-model'] = tutorInstance.modelDefaults.interpretation;
  }
  if (
    !commandLineOptionProvided('learner-record-model') &&
    !process.env.TUTOR_STUB_LEARNER_RECORD_MODEL &&
    tutorInstance.modelDefaults.interpretation
  ) {
    args['learner-record-model'] = tutorInstance.modelDefaults.interpretation;
  }
  if (
    !commandLineOptionProvided('auto-learner-model') &&
    !process.env.TUTOR_STUB_AUTO_LEARNER_MODEL &&
    tutorInstance.modelDefaults.learner
  ) {
    args['auto-learner-model'] = tutorInstance.modelDefaults.learner;
  }

  let allModelsOverrideRef = String(args['all-models'] || '').trim() || null;
  if (allModelsOverrideRef) {
    args.model = allModelsOverrideRef;
    args['classifier-model'] = allModelsOverrideRef;
    args['learner-record-model'] = allModelsOverrideRef;
    args['auto-learner-model'] = allModelsOverrideRef;
  }
  const interactiveSessionIntent = Boolean(!args['auto-learner'] && !args.once && !positionals.join(' ').trim());
  const explicitRememberedSources = rememberedSettingExplicitSources();
  const rememberedSettings = applyRememberedInteractiveDefaults({
    interactiveSessionEnabled: interactiveSessionIntent,
  });
  tutorInstance = resolveTutorStubTutorInstance(args.tutor);
  tuningMode = normalizeTutorStubTuningMode(args.tuning);
  if (!allModelsOverrideRef && rememberedSettings.restoredAllModelsOverrideRef) {
    allModelsOverrideRef = rememberedSettings.restoredAllModelsOverrideRef;
  }
  const allModelsOverride = allModelsOverrideRef
    ? {
        schema: 'machinespirits.tutor-stub.all-models-override.v1',
        modelRef: allModelsOverrideRef,
        source:
          rememberedSettings.restoredAllModelsOverrideRef === allModelsOverrideRef
            ? 'remembered_settings'
            : commandLineOptionProvided('all-models')
              ? 'cli'
              : 'environment',
        precedence: 'overrides_all_role_specific_model_settings',
        roles: ['tutor', 'classifier', 'learner_dag_analysis', 'automated_or_mixed_learner'],
      }
    : null;
  args['auto-learner-profile'] = resolveAutomatedLearnerProfile(args['auto-learner-profile']);

  const temperature = parseNumber(args.temperature, '--temperature', { min: 0, max: 2 });
  const registerTemperature = normalizeTutorStubEngagementStanceTemperature(args['register-temperature'], {
    label: '--register-temperature',
  });
  const dagFactDropoutRate = normalizeTutorStubDagFactDropoutRate(args['dag-fact-dropout'], {
    label: '--dag-fact-dropout',
  });
  const dagFactDropoutSeed = normalizeTutorStubDagFactDropoutSeed(args['dag-fact-dropout-seed'], {
    label: '--dag-fact-dropout-seed',
  });
  const releaseSpeed = normalizeTutorStubReleaseSpeed(args['release-speed'], {
    label: '--release-speed',
  });
  const openingRealizer = String(args['opening-realizer'] || 'model')
    .trim()
    .toLowerCase();
  if (!['model', 'deterministic'].includes(openingRealizer)) {
    throw new Error('--opening-realizer must be model or deterministic');
  }
  const experimentRunSeed = normalizeTutorStubDagFactDropoutSeed(args['run-seed'], {
    label: '--run-seed',
  });
  const experimentRepeat = parsePositiveInt(args['eval-repeat'], '--eval-repeat');
  const typedActionsEnabled = Boolean(args['typed-actions']);
  const typedActionSupportLevel = parseOptionalBoundedInt(
    args['typed-action-support-level'],
    '--typed-action-support-level',
    { min: 0, max: 3 },
  );
  const typedActionTask = {
    taskId: String(args['typed-action-task-id'] || '').trim(),
    knowledgeComponent: String(args['typed-action-knowledge-component'] || '').trim(),
    prerequisitePath: commaSeparatedStrings(args['typed-action-prerequisites']),
    itemDifficulty: parseNumber(args['typed-action-item-difficulty'], '--typed-action-item-difficulty', {
      min: 0,
      max: 1,
    }),
  };
  if (typedActionsEnabled && (!typedActionTask.taskId || !typedActionTask.knowledgeComponent)) {
    throw new Error('--typed-actions requires non-empty task id and knowledge component');
  }
  const typedActionConfig = {
    schema: TUTOR_TYPED_ACTION_CONFIG_SCHEMA,
    enabled: typedActionsEnabled,
    defaultOff: true,
    policyMode: 'closed_loop',
    decisionTiming: 'after_current_public_learner_observation_before_tutor_output',
    outcomeHorizon: 'next_public_learner_observation',
    selectionMethod: 'deterministic_closed_loop_argmax',
    selectionProbability: 1,
    scaffoldLifecycle: {
      enabled: typedActionsEnabled,
      schema: SCAFFOLD_LIFECYCLE_SCHEMA,
      phases: ['diagnose', 'support', 'observe_uptake', 'fade', 'independent_work', 'transfer', 'recover'],
      drivenBy: ['typed_action_decision', 'closed_public_outcome'],
    },
    supportLevel: typedActionSupportLevel,
    task: typedActionTask,
  };
  const dagFactDropoutConfig = {
    schema: TUTOR_STUB_DAG_FACT_DROPOUT_SCHEMA,
    rate: dagFactDropoutRate,
    seed: dagFactDropoutSeed,
    enabled: dagFactDropoutRate > 0,
    graceTurns: 2,
    maxConcurrent: 2,
    eligibleFacts: 'adopted_public_premises_only',
    backgroundFactsImmune: true,
    visibility: 'conduct',
  };
  const releasePacingConfig = {
    schema: 'machinespirits.tutor-stub.release-pacing.v1',
    baseSpeed: releaseSpeed,
    adaptive: true,
    range: [MIN_TUTOR_STUB_RELEASE_SPEED, MAX_TUTOR_STUB_RELEASE_SPEED],
    directLearnerRequests: true,
    maxReleaseBatchesPerTutorTurn: 1,
  };
  const maxTokens = parsePositiveInt(args['max-tokens'], '--max-tokens');
  const historyTurns = parsePositiveInt(args['history-turns'], '--history-turns');
  const memorySummaryEnabled = Boolean(STUB.memorySummary && !args['no-memory-summary']);
  const autoLearnerEnabled = Boolean(args['auto-learner']);
  const mixedLearnerRequested = Boolean(args['mixed-learner'] || args['mixed-mode']);
  const mixedLearnerEnabled = Boolean(mixedLearnerRequested && !autoLearnerEnabled);
  const interactiveSessionEnabled = interactiveSessionIntent;
  const turnFeedbackEnabled = Boolean(
    STUB.turnFeedback && !args['no-turn-feedback'] && interactiveSessionEnabled && !autoLearnerEnabled,
  );
  const learnerSuggestionEnabled = Boolean(
    !passthroughEnabled && (autoLearnerEnabled || mixedLearnerEnabled || interactiveSessionEnabled),
  );
  const autoTurns = parseAutoTurns(args['auto-turns']);
  const autoSafetyTurns = parsePositiveInt(args['auto-safety-turns'], '--auto-safety-turns');
  const autoStopOnGrounded = !args['no-auto-stop-on-grounded'];
  if (autoLearnerEnabled && autoTurns === null && !autoStopOnGrounded) {
    throw new Error(
      '--auto-turns until-grounded requires grounded-closure stopping; remove --no-auto-stop-on-grounded',
    );
  }
  const launchWorldBundle = resolveWorldRef(args.world);
  const rememberedScenarioAvailable = rememberedSettings.appliedFields.includes('scenario');
  const existingScenarioAvailable = Boolean(explicitRememberedSources.scenario || rememberedScenarioAvailable);
  const initialScenarioPickerEnabled = Boolean(
    interactiveSessionEnabled &&
    STUB.opening &&
    !args['no-opening'] &&
    !args['resume-last'] &&
    launchWorldBundle &&
    !existingScenarioAvailable,
  );
  const initialScenarioKeyboardMenuActive = Boolean(
    initialScenarioPickerEnabled &&
    !args['dry-run'] &&
    input.isTTY &&
    output.isTTY &&
    typeof input.setRawMode === 'function',
  );
  let initialScenarioSelection = null;
  if (initialScenarioKeyboardMenuActive) {
    const defaultScenarioId = launchWorldBundle.world.id;
    console.log(`${C.cyan}Pick a scenario${C.reset}`);
    console.log(
      `${C.dim}  ↑/↓ scroll · Enter select · highlighted scenario described below · Esc quit · ${defaultScenarioId} selected by default${C.reset}`,
    );
    const selection = await pickInitialScenarioWithKeyboard(args.world);
    if (!selection) {
      console.log(`${C.dim}scenario picker cancelled${C.reset}`);
      return;
    }
    args.world = selection.filePath;
    initialScenarioSelection = {
      scenarioId: selection.id,
      title: selection.title,
      defaultScenarioId,
      usedDefault: selection.id === defaultScenarioId,
      selectionMethod: 'keyboard_menu',
    };
    console.log(`${C.cyan}scenario >${C.reset} ${selection.id} — ${selection.title}\n`);
  }
  const worldBundle = resolveWorldRef(args.world);
  const directorContext = buildDirectorInitialContext(worldBundle?.world || null);
  const effectiveTopic = worldBundle && args.topic === STUB.topic ? worldBundle.world.title : args.topic;
  const dagMode = normalizeDagMode(args['dag-mode']);
  const pointOfActionArm = normalizeTutorStubPointOfActionArm(args['point-of-action-arm']);
  const multipleChoiceEnabled = Boolean(args['multiple-choice']);
  assertSupportedModelRefs({
    '--model': args.model,
    '--classifier-model': args['classifier-model'],
    '--learner-record-model': args['learner-record-model'],
    '--auto-learner-model': args['auto-learner-model'],
  });
  let systemPrompt = loadSystemPrompt({
    worldBundle,
    dag: args.dag,
    topic: effectiveTopic,
    multipleChoice: multipleChoiceEnabled,
  });
  const tuning = createTutorStubTuningRuntime({
    instance: tutorInstance,
    mode: tuningMode,
    dir: args['tuning-dir'],
    write: !args['dry-run'],
  });
  systemPrompt = `${systemPrompt}\n\n${tutorStubTutorInstancePrompt(tutorInstance)}`;
  const reviewedTutorMemory = tutorStubTuningPrompt(tuning);
  if (reviewedTutorMemory) systemPrompt = `${systemPrompt}\n\n${reviewedTutorMemory}`;
  // Green Room prompt-book injection (GREEN-ROOM-PLAN.md §0.1.6): a static,
  // per-performance role memory appended to the tutor system prompt. Frozen
  // for the whole run; craft guidance only — never overrides world rules or
  // the release schedule.
  if (args['prompt-book-context']) {
    const promptBookText = fs.readFileSync(path.resolve(args['prompt-book-context']), 'utf8');
    systemPrompt = `${systemPrompt}\n\n[Prompt book — your durable role memory from prior performances. Honour its notes as craft guidance; it never overrides world rules or the release schedule.]\n${promptBookText}\n[End prompt book]`;
    console.log(`[greenroom] prompt book injected: ${promptBookText.length} chars from ${args['prompt-book-context']}`);
  }
  if (pointOfActionArm === 'standing_book') {
    const standingBook = tutorStubPointOfActionStandingBook();
    systemPrompt = `${systemPrompt}\n\n${standingBook}`;
    console.log(`[step4] standing point-of-action book injected: ${standingBook.length} chars`);
  }
  const promptArchitecture = tutorStubPromptArchitecture({
    dagEnabled: Boolean(args.dag && worldBundle),
  });
  promptArchitecture.audit.baseSystem = auditTutorStubPrompt({
    surface: 'tutor_system',
    systemPrompt,
    instructionTexts: [systemPrompt],
  });
  promptArchitecture.audit.baseSpeakerPrivilege = auditTutorStubSpeakerPrivilege({
    world: args.dag ? worldBundle?.world || null : null,
    tutorTurn: 0,
    systemPrompt,
  });
  if (!promptArchitecture.audit.baseSystem.ok) {
    throw new Error(
      `Base prompt audit failed: ${promptArchitecture.audit.baseSystem.violations
        .map((violation) => violation.code)
        .join(', ')}`,
    );
  }
  if (!promptArchitecture.audit.baseSpeakerPrivilege.ok) {
    throw new Error(
      `Base speaking-tutor prompt crossed the private-planner boundary: ${promptArchitecture.audit.baseSpeakerPrivilege.issues
        .map((issue) => `${issue.code}:${issue.source}`)
        .join(', ')}`,
    );
  }
  const tutorDag = args.dag && worldBundle ? buildTutorDesireDag(worldBundle.world) : null;
  const resolved = resolveModel(args.model);
  const providerConfig = getProviderConfig(resolved.provider);
  let autoLearnerResolved = learnerSuggestionEnabled ? resolveModel(args['auto-learner-model']) : null;
  let autoLearnerProviderConfig = autoLearnerResolved ? getProviderConfig(autoLearnerResolved.provider) : null;
  const classifierEnabled = !args['no-classifier'];
  const tutorLearnerDagEnabled = Boolean(args['tutor-learner-dag'] && worldBundle);
  const humanDiscourseConfig = buildHumanDiscourseRunConfig({
    dagMode,
    dagEnabled: args.dag,
    tutorLearnerDagEnabled,
  });
  const humanDiscoursePreviewFrame = buildHumanDiscourseFrame({
    state: {
      world: worldBundle?.world || null,
      dag: args.dag,
      dagMode,
      humanDiscourse: humanDiscourseConfig,
      turns: [],
    },
    tutorTurn: 1,
    tutorLearnerDag: null,
    classification: null,
    learnerText: '',
  });
  const combinedLearnerAnalysisEnabled = Boolean(classifierEnabled && tutorLearnerDagEnabled);
  const registerPolicyStack = parseTutorStubRegisterPolicyStack(args['register-policy']);
  const registerPolicy = registerPolicyStack.primary;
  const registerPolicyOverlays = registerPolicyStack.overlays;
  const registerOverlayThreshold = normalizeTutorStubRegisterOverlayThreshold(args['register-overlay-threshold'], {
    label: '--register-overlay-threshold',
  });
  const experimentConfig = {
    schema: 'machinespirits.tutor-stub.experiment-identity.v1',
    runSeed: experimentRunSeed,
    profile: automatedLearnerProfileId(args['auto-learner-profile']) || 'custom',
    policy: registerPolicy,
    repeat: experimentRepeat,
    jobId: String(args['eval-job-id'] || '').trim() || null,
    dagFactDropoutSeed,
    independentSeeds: true,
  };
  const registerEmpiricalPrior = loadRegisterEmpiricalPrior(args['register-empirical-prior'], {
    policy: registerPolicy,
  });
  const registerPaletteMode =
    registerPolicy === 'negative' ? 'negative' : args['safe-registers'] ? 'safe' : args['register-palette'];
  const registerPalette = buildRegisterPalette(registerPaletteMode);
  const randomRegisterSelectionEnabled = registerPolicy === 'random';
  const negativeRegisterSelectionEnabled = registerPolicy === 'negative';
  const fieldRegisterSelectionEnabled = registerPolicy === 'field';
  const trajectoryRegisterSelectionEnabled = registerPolicy === 'trajectory';
  const dynamicalSystemRegisterSelectionEnabled = registerPolicy === 'dynamical_system';
  const empiricalDynamicalSystemRegisterSelectionEnabled = registerPolicy === 'empirical_dynamical_system';
  const continuousDynamicalSystemRegisterSelectionEnabled = registerPolicy === 'continuous_dynamical_system';
  const continuousEmpiricalDynamicalSystemRegisterSelectionEnabled =
    registerPolicy === 'continuous_empirical_dynamical_system';
  const continuousRegisterSelectionEnabled = Boolean(
    continuousDynamicalSystemRegisterSelectionEnabled || continuousEmpiricalDynamicalSystemRegisterSelectionEnabled,
  );
  const continuousUnsafeRegisterAnchorsEnabled = Boolean(
    continuousRegisterSelectionEnabled &&
    !args['safe-registers'] &&
    /(^|,)(all|simulated|negative|negative-floor|ironic|sarcastic|face_threat)(,|$)/iu.test(
      String(args['register-palette'] || ''),
    ),
  );
  const stateRegisterSelectionEnabled = registerPolicy === 'state';
  const registerSelectionEnabled = Boolean(
    !args['no-register-selection'] &&
    registerPalette.length &&
    (combinedLearnerAnalysisEnabled || randomRegisterSelectionEnabled || negativeRegisterSelectionEnabled),
  );
  let classifierResolved =
    classifierEnabled && !combinedLearnerAnalysisEnabled ? resolveModel(args['classifier-model']) : null;
  let classifierProviderConfig = classifierResolved ? getProviderConfig(classifierResolved.provider) : null;
  let learnerRecordResolved = tutorLearnerDagEnabled ? resolveModel(args['learner-record-model']) : null;
  let learnerRecordProviderConfig = learnerRecordResolved ? getProviderConfig(learnerRecordResolved.provider) : null;
  const firstMessage = args.once || positionals.join(' ').trim() || '';
  let visibleModel = visibleResolvedModel(resolved, providerConfig);
  let visibleAutoLearnerModel = autoLearnerResolved
    ? visibleResolvedModel(autoLearnerResolved, autoLearnerProviderConfig)
    : null;
  let visibleClassifierModel = classifierResolved
    ? visibleResolvedModel(classifierResolved, classifierProviderConfig)
    : null;
  let visibleLearnerRecordModel = learnerRecordResolved
    ? visibleResolvedModel(learnerRecordResolved, learnerRecordProviderConfig)
    : null;
  let visibleClassifierConfig = classifierEnabled
    ? combinedLearnerAnalysisEnabled
      ? {
          combined: true,
          classifierModelRef: args['classifier-model'],
          modelRef: args['learner-record-model'],
          resolved: visibleLearnerRecordModel,
        }
      : {
          modelRef: args['classifier-model'],
          resolved: visibleClassifierModel,
        }
    : { enabled: false };
  const effectiveTemperature = effectiveTemperatureForModel(resolved, temperature);
  const traceEnabled = !args['no-trace'];
  const traceDir = resolveWorkspacePath(args['trace-dir']);
  const streamEnabled = Boolean(STUB.stream && !args['no-stream']);
  const interimAnimationEnabled = Boolean(STUB.interimAnimation && !args['no-interim-animation']);
  const fieldVisualizationEnabled = Boolean(args['field-viz']);
  const openingEnabled = Boolean(STUB.opening && !args['no-opening']);
  const openingFramePreview = buildTutorStubOpeningFrame({
    world: worldBundle?.world || null,
    openingEvidence: worldBundle
      ? worldBundle.world.releaseSchedule
          .filter((entry) => Number(entry.turn) === 1)
          .map((entry) => ({
            premise: entry.premise,
            via: entry.via,
            surface: worldBundle.world.premiseById.get(entry.premise)?.surface || '',
          }))
      : [],
  });
  const openingConfig = {
    enabled: openingEnabled,
    printedByDefault: Boolean(openingEnabled && !firstMessage),
    schema: openingFramePreview.schema,
    realization:
      openingFramePreview.realization === 'authored_world_opening'
        ? openingFramePreview.realization
        : openingRealizer === 'model'
          ? 'speaking_tutor_model'
          : 'world_grounded_deterministic',
    speakingModelRef:
      openingFramePreview.realization !== 'authored_world_opening' && openingRealizer === 'model' ? args.model : null,
    authoredTextAvailable: Boolean(openingFramePreview.authoredText),
    requirements: TUTOR_STUB_OPENING_REQUIREMENTS,
    safetyAudit: true,
    fallback: 'world_grounded_safe_fallback',
  };
  const closeoutReportEnabled = Boolean(STUB.closeoutReport && !args['no-closeout-report']);
  const dialogueClosureConfig = createTutorStubDialogueClosureLifecycle({
    enabled: Boolean(
      args.dag && worldBundle && (!autoLearnerEnabled || (tutorLearnerDagEnabled && autoStopOnGrounded)),
    ),
    allowCheckIn: Boolean(!autoLearnerEnabled && !firstMessage),
    allowAuthoredDagClosure: Boolean(!autoLearnerEnabled),
  });
  const cliEffort = normalizeCliEffort(args['cli-effort']);
  const tutorStreamState = !streamEnabled
    ? 'off'
    : providerSupportsEventStreaming(resolved)
      ? 'cli_events'
      : !providerSupportsStreaming(resolved)
        ? 'unavailable_cli_buffered'
        : args.dag && worldBundle
          ? 'guarded_after_audit'
          : interactiveSessionEnabled
            ? 'buffered_for_concurrent_input'
            : 'live';
  const resumeCandidate = args['resume-last'] ? latestDialogueTrace(args['trace-dir']) : null;
  const rememberedDialogueSettingsAvailable = rememberedSettings.status === 'loaded';
  const initialProfilePromptEnabled = Boolean(
    mixedLearnerEnabled &&
    !explicitRememberedSources.learnerProfile &&
    !rememberedSettings.appliedFields.includes('learner_profile'),
  );
  const initialTemperaturePromptEnabled = Boolean(
    registerSelectionEnabled &&
    registerTemperatureApplies(registerPolicy) &&
    !rememberedDialogueSettingsAvailable &&
    !explicitRememberedSources.engagementStanceTemperature,
  );
  const initialDropoutPromptEnabled = Boolean(
    tutorLearnerDagEnabled && !rememberedDialogueSettingsAvailable && !explicitRememberedSources.dagFactDropoutRate,
  );
  const initialReleaseSpeedPromptEnabled = Boolean(
    worldBundle && !rememberedDialogueSettingsAvailable && !explicitRememberedSources.releaseSpeed,
  );
  const initialMixedLearnerSetupEnabled = Boolean(
    mixedLearnerEnabled &&
    openingEnabled &&
    !firstMessage &&
    !resumeCandidate &&
    (initialProfilePromptEnabled ||
      initialTemperaturePromptEnabled ||
      initialDropoutPromptEnabled ||
      initialReleaseSpeedPromptEnabled),
  );
  const initialScenarioPickerConfig = {
    enabled: initialScenarioPickerEnabled,
    defaultScenarioId: launchWorldBundle?.world?.id || null,
    selectedScenarioId: worldBundle?.world?.id || null,
    keyboardMenu: true,
    activeInThisTerminal: initialScenarioKeyboardMenuActive,
    navigation: ['up', 'down', 'pageup', 'pagedown', 'home', 'end', 'enter'],
    descriptionFields: ['question', 'setting', 'discipline'],
    nonTtyFallback: '--world',
    selection: initialScenarioSelection,
    reason: initialScenarioPickerEnabled
      ? 'no_saved_or_explicit_scenario'
      : existingScenarioAvailable
        ? 'existing_scenario_restored_or_explicit'
        : args['resume-last']
          ? 'resume_requested'
          : 'not_interactive_opening',
  };
  const mixedLearnerStartupPrompts = {
    enabled: initialMixedLearnerSetupEnabled,
    // Model selection was removed from first-run setup (2026-07-12): the
    // launch/default model is used and stays changeable via `/settings model`.
    order: [
      ...(initialProfilePromptEnabled ? ['learner_profile'] : []),
      ...(initialTemperaturePromptEnabled ? ['engagement_stance_temperature'] : []),
      ...(initialDropoutPromptEnabled ? ['dag_fact_dropout'] : []),
      ...(initialReleaseSpeedPromptEnabled ? ['clue_release_speed'] : []),
    ],
    tutorModel: {
      enabled: false,
      firstRunSelection: false,
      default: args.model,
      recommended: STUB.model,
      liveCommand: '/settings model <provider.alias>',
    },
    engagementStanceTemperature: {
      enabled: initialTemperaturePromptEnabled,
      default: registerTemperature,
      recommended: DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
      range: [MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE, MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE],
    },
    dagFactDropout: {
      enabled: initialDropoutPromptEnabled,
      default: dagFactDropoutRate,
      recommended: DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
      range: [0, 1],
      seed: dagFactDropoutSeed,
    },
    clueReleaseSpeed: {
      enabled: initialReleaseSpeedPromptEnabled,
      default: releaseSpeed,
      recommended: DEFAULT_TUTOR_STUB_RELEASE_SPEED,
      range: [MIN_TUTOR_STUB_RELEASE_SPEED, MAX_TUTOR_STUB_RELEASE_SPEED],
      adaptive: true,
    },
  };
  const interactiveRoleModes = {
    enabled: Boolean(interactiveSessionEnabled && !passthroughEnabled),
    default: 'learner',
    modes: ['learner', 'coach', 'auto'],
    commands: {
      learner: ['/mode learner', '/learner'],
      coach: ['/mode coach [guidance]', '/coach [guidance]'],
      auto: ['/mode auto [turns]', '/auto [turns]'],
      status: '/status',
    },
    coach: {
      private: true,
      appliesTo: 'next_tutor_turn',
      publicTranscriptChanged: false,
      evidenceAndSafetyGuardsRemainActive: true,
    },
    auto: {
      modelRef: args['auto-learner-model'],
      resolved: visibleAutoLearnerModel,
      profileId: automatedLearnerProfileId(args['auto-learner-profile']),
      defaultTurns: autoTurns ?? 'until-grounded',
      safetyTurns: autoSafetyTurns,
      stopOnGrounded: autoStopOnGrounded,
    },
    concurrentCommandSurface: {
      enabled: interactiveSessionEnabled,
      activityLine: 'above_prompt',
      inputLine: 'persistent_bottom_line',
      acceptsCommandsDuringTutorTurn: true,
      acceptsCommandsDuringAutoMode: true,
      streamingDisplay: 'buffered_while_command_line_is_live',
    },
    compoundLearnerTurns: {
      schema: 'machinespirits.tutor-stub.compound-learner-turn.v1',
      enabled: interactiveSessionEnabled,
      boundary: 'until_tutor_response_is_displayed',
      additionalMessages: 'abort_or_invalidate_then_regenerate',
      tracePreservesTypedMessages: true,
      analysisAndTutorView: 'one_compound_learner_turn',
    },
  };
  const turnFeedbackConfig = {
    schema: 'machinespirits.tutor-stub.turn-feedback-config.v1',
    enabled: turnFeedbackEnabled,
    defaultOn: true,
    optional: true,
    scope: 'human_learner_mode',
    ratings: ['up', 'down'],
    commands: ['/up [reason]', '/down [reason] [comment]', '/feedback up|down|clear|on|off'],
    reasons: Object.keys(TUTOR_STUB_FEEDBACK_REASONS),
    keyboardShortcuts: {
      scope: 'empty_input_line_with_pending_rating',
      immediate: true,
      leftArrow: 'down',
      rightArrow: 'up',
    },
    learnerMessageField: 'tutorFeedback',
    automatedLearner: 'disabled',
    tutorSelfAssessment: true,
    liveAdaptation: {
      horizon: 'next_tutor_response_only',
      private: true,
      observableChangeAudited: true,
      safetyPrecedence: true,
    },
    learningRecord: {
      schema: 'machinespirits.tutor-stub.feedback-observation.v1',
      joinsRatedResponseToLearnerReplyAndNextTutorOutcome: true,
      separatesSubjectiveHelpfulnessFromObjectiveProgress: true,
      causalClaim: false,
    },
  };
  const explanatoryDebugConfig = {
    enabledByDefault: false,
    defaultFormat: 'prose',
    command: '/debug on [prose|technical]|off|show [prose|technical]|technical',
    prose: {
      generatedBy: 'llm',
      targetWords: '45-80',
      maxSentences: 3,
    },
    technicalSections: ['learner_analysis', 'field_calculations', 'register_consequence'],
    automaticAfterCompletedTurn: true,
  };
  const learningSummaryReportConfig = {
    enabled: Boolean(!passthroughEnabled && (autoLearnerEnabled || firstMessage || interactiveSessionEnabled)),
    automaticOnConversationEnd: true,
    requiresCompletedTurn: true,
    format: 'html',
    publicEvidenceOnly: true,
    launchInInteractiveTty: process.env.TUTOR_STUB_SUMMARY_OPEN !== '0',
  };
  const rememberedSettingsConfig = {
    enabled: rememberedSettings.enabled,
    writeEnabled: Boolean(rememberedSettings.writeEnabled && !passthroughEnabled),
    file: path.relative(ROOT, rememberedSettings.filePath),
    status: rememberedSettings.status,
    loadedAt: rememberedSettings.loadedAt,
    appliedFields: [...rememberedSettings.appliedFields],
    skippedExplicitFields: [...rememberedSettings.skippedExplicitFields],
    warning: rememberedSettings.warning,
    scope: 'human_interactive_sessions_only',
    precedence: 'explicit_cli_or_environment_then_remembered_then_repository_default',
  };
  const learnerDagPreflightConfig = {
    schema: TUTOR_STUB_LEARNER_DAG_PREFLIGHT_SCHEMA,
    enabled: tutorLearnerDagEnabled,
    timing: 'before_first_learner_analysis_model_call',
    inputs: ['prior_public_learner_record', 'committed_public_evidence', 'public_rules'],
    output: ['eligible_public_premise_ids', 'possible_next_derivations'],
    semanticMapping: 'analysis_model_maps_free_text_to_candidate_updates',
    commitAuthority: 'deterministic_postprocessor_after_model',
  };
  const passthroughConfig = {
    schema: 'machinespirits.tutor-stub.passthrough.v1',
    enabled: passthroughEnabled,
    modelCallsPerTurn: passthroughEnabled ? 1 : null,
    requestSurface: passthroughEnabled
      ? ['system_setup', 'full_public_history', 'latest_learner_message']
      : null,
    bypassed: passthroughEnabled
      ? [
          'learner_classifier',
          'learner_dag',
          'register_selection',
          'human_discourse_scaffold',
          'response_composition',
          'response_checks_and_repair',
          'release_planner',
          'dialogue_closure',
          'mixed_prefetch',
          'tutor_feedback',
          'learning_summary',
        ]
      : [],
  };

  if (args['show-prompt']) {
    console.log(`${C.dim}--- system prompt ---${C.reset}`);
    console.log(systemPrompt);
    console.log(`${C.dim}--- end system prompt ---${C.reset}\n`);
  }

  if (args['dry-run']) {
    console.log(
      JSON.stringify(
        {
          modelRef: args.model,
          resolved: visibleModel,
          tutorInstance: {
            id: tutorInstance.id,
            title: tutorInstance.title,
            requestedRef: args.tutor,
            activeRef: tuning.activeRef,
            sourceVersion: tutorInstance.sourceVersion,
            rolePromptPath: path.relative(ROOT, tutorInstance.rolePromptPath),
            rolePromptHash: tutorInstance.rolePromptHash,
            policyPack: tutorInstance.policyPack,
            modelDefaults: tutorInstance.modelDefaults,
          },
          tuning: tutorStubTuningSnapshot(tuning),
          allModelsOverride,
          rememberedSettings: rememberedSettingsConfig,
          passthrough: passthroughConfig,
          topic: effectiveTopic,
          world: worldBundle
            ? {
                id: worldBundle.world.id,
                title: worldBundle.world.title,
                file: path.relative(ROOT, worldBundle.filePath),
                dag: args.dag,
              }
            : null,
          scenarioPicker: initialScenarioPickerConfig,
          humanDiscourse: humanDiscourseConfig,
          humanDiscoursePreviewFrame,
          comprehensionSideState: {
            enabled: true,
            schema: 'machinespirits.tutor-stub.comprehension-side-state.v1',
            sources: ['learner_turn', 'slash_explain'],
            advancesLearnerDag: false,
          },
          dagFactDropout: dagFactDropoutConfig,
          releasePacing: releasePacingConfig,
          experiment: experimentConfig,
          typedPedagogicalActions: typedActionConfig,
          responseConfiguration: {
            schema: 'machinespirits.tutor-stub.response-configuration.v2',
            primaryStanceField: 'engagement_stance',
            independentAxes: [
              'engagement_stance',
              'action_family',
              'audience_register',
              'lexical_accessibility',
              'scene_immersion',
              'actorial_part',
            ],
            temperatureScope: 'engagement_stance_and_actorial_part',
            transcriptVisibilityAudit: true,
          },
          promptArchitecture,
          directorContext,
          temperature: effectiveTemperature,
          requestedTemperature: temperature,
          cliEffort: cliEffort || null,
          classifier: visibleClassifierConfig,
          tutorLearnerDag: tutorLearnerDagEnabled
            ? {
                modelRef: args['learner-record-model'],
                resolved: visibleLearnerRecordModel,
                combinedClassifier: combinedLearnerAnalysisEnabled,
                preflight: learnerDagPreflightConfig,
                multiPremiseAdvance: {
                  enabled: true,
                  schema: 'machinespirits.tutor-stub.learner-advance.v1',
                  validation: 'staged_public_evidence_and_public_rules',
                  downstream: [
                    'classification',
                    'field',
                    'trajectory',
                    'register',
                    'response_configuration',
                    'reports',
                  ],
                },
              }
            : { enabled: false, requested: Boolean(args['tutor-learner-dag']) },
          autoLearner: autoLearnerEnabled
            ? {
                enabled: true,
                modelRef: args['auto-learner-model'],
                resolved: visibleAutoLearnerModel,
                maxTurns: autoTurns ?? 'until-grounded',
                untilGrounded: autoTurns === null,
                safetyTurns: autoTurns === null ? autoSafetyTurns : null,
                stopOnGrounded: autoStopOnGrounded,
                profileId: automatedLearnerProfileId(args['auto-learner-profile']),
                profile: args['auto-learner-profile'],
              }
            : { enabled: false },
          mixedLearner: mixedLearnerEnabled
            ? {
                enabled: true,
                modelRef: args['auto-learner-model'],
                resolved: visibleAutoLearnerModel,
                profileId: automatedLearnerProfileId(args['auto-learner-profile']),
                profile: args['auto-learner-profile'],
                clue: '/clue or /hint',
                accept: 'Tab on an empty learner prompt, /use, or /accept',
                inspect: '/suggest',
                regenerate: '/regen',
                profilePresentation: {
                  promptLabel: true,
                  intendedPattern: true,
                  visibleExpression: 'profile_signal',
                  readyAnnouncement: 'once_per_profile',
                  firstTutorOrdering: 'ready_profile_then_director_then_tutor',
                  initialPicker: {
                    enabled: initialMixedLearnerSetupEnabled,
                    defaultProfileId: automatedLearnerProfileId(args['auto-learner-profile']) || 'custom',
                    keyboardMenu: true,
                    navigation: ['up', 'down', 'enter'],
                    nonTtyFallback: 'typed_profile_id',
                  },
                },
                startupPrompts: mixedLearnerStartupPrompts,
              }
            : { enabled: false, requested: mixedLearnerRequested },
          interactiveRoleModes,
          turnFeedback: turnFeedbackConfig,
          explanatoryDebug: explanatoryDebugConfig,
          learningSummaryReport: learningSummaryReportConfig,
          registerSelection: registerSelectionEnabled
            ? {
                enabled: true,
                palette: registerPalette,
                policy: registerPolicyStack.id,
                primaryPolicy: registerPolicy,
                overlayPolicies: registerPolicyOverlays,
                overlayThreshold: registerOverlayThreshold,
                temperature: registerTemperature,
                engagementStanceTemperature: registerTemperature,
                temperatureScope: 'engagement_stance_and_actorial_part',
                combinedLearnerAnalysis: combinedLearnerAnalysisEnabled,
                localFieldPolicy: fieldRegisterSelectionEnabled,
                localTrajectoryPolicy: trajectoryRegisterSelectionEnabled,
                localDynamicalSystemPolicy: dynamicalSystemRegisterSelectionEnabled,
                localEmpiricalDynamicalSystemPolicy: empiricalDynamicalSystemRegisterSelectionEnabled,
                localContinuousDynamicalSystemPolicy: continuousDynamicalSystemRegisterSelectionEnabled,
                localContinuousEmpiricalDynamicalSystemPolicy:
                  continuousEmpiricalDynamicalSystemRegisterSelectionEnabled,
                continuousUnsafeRegisterAnchors: continuousUnsafeRegisterAnchorsEnabled,
                localStatePolicy: stateRegisterSelectionEnabled,
                random: randomRegisterSelectionEnabled,
                negative: negativeRegisterSelectionEnabled,
                empiricalPrior: {
                  status: registerEmpiricalPrior.status,
                  path: registerEmpiricalPrior.filePath ? path.relative(ROOT, registerEmpiricalPrior.filePath) : null,
                  observationCount: registerEmpiricalPrior.prior?.source?.observationCount ?? null,
                },
              }
            : { enabled: false },
          pointOfAction: pointOfActionArm
            ? {
                enabled: true,
                arm: pointOfActionArm,
                detectorVersion: 'step4-frozen-2026-07-14.v1',
                eligibleTurns: [3, 24],
                triggerPriority: ['stagnant_repeat', 'warrant_skip'],
              }
            : { enabled: false },
          maxTokens,
          historyTurns,
          speakerHistory: {
            mode: 'full_public_replay',
            perspectives: ['tutor', 'learner'],
            roles: ['system', 'user', 'assistant'],
            directApiTransport: 'native_messages',
            cliTransport: 'flattened_at_bridge_boundary',
          },
          memorySummary: {
            enabled: memorySummaryEnabled,
            rawRecentTurns: historyTurns,
            publicSummary: memorySummaryEnabled,
            scope: 'auxiliary_analysis_prompts',
          },
          trace: traceEnabled
            ? {
                enabled: true,
                dir: path.relative(ROOT, traceDir),
              }
            : { enabled: false },
          stream: {
            enabled: streamEnabled,
            tutor: tutorStreamState,
            tutorLive: tutorStreamState === 'live',
            tutorGuardedAfterAudit: tutorStreamState === 'guarded_after_audit',
            classifier:
              streamEnabled && classifierResolved
                ? providerSupportsStreaming(classifierResolved) || providerSupportsEventStreaming(classifierResolved)
                : false,
            learnerAnalysis:
              streamEnabled && learnerRecordResolved
                ? providerSupportsStreaming(learnerRecordResolved) ||
                  providerSupportsEventStreaming(learnerRecordResolved)
                : false,
          },
          opening: openingConfig,
          closeoutReport: { enabled: closeoutReportEnabled },
          dialogueClosure: dialogueClosureConfig,
          multipleChoice: { enabled: multipleChoiceEnabled },
          interimAnimation: {
            enabled: interimAnimationEnabled,
            activeInThisTerminal: Boolean(interimAnimationEnabled && output.isTTY),
          },
          fieldVisualization: {
            enabled: fieldVisualizationEnabled,
            dir: path.relative(ROOT, traceDir),
            automaticAfterTurns: fieldVisualizationEnabled,
            slashCommand: '/viz',
          },
          resumeLast: args['resume-last']
            ? resumeCandidate
              ? {
                  source: path.relative(ROOT, resumeCandidate.filePath),
                  turns: resumeCandidate.turns.length,
                  world: resumeCandidate.metadata?.world || null,
                }
              : { requested: true, found: false, traceDir: path.relative(ROOT, traceDir) }
            : { requested: false },
          systemPrompt,
          firstMessage: firstMessage || null,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!resolved.isConfigured && !isCliProvider(resolved.provider)) {
    const envName = providerConfig.api_key_env || 'provider API key';
    throw new Error(`${args.model} is not configured. Set ${envName} or choose a CLI-backed model.`);
  }
  if (
    classifierEnabled &&
    !combinedLearnerAnalysisEnabled &&
    !classifierResolved.isConfigured &&
    !isCliProvider(classifierResolved.provider)
  ) {
    const envName = classifierProviderConfig.api_key_env || 'provider API key';
    throw new Error(`${args['classifier-model']} is not configured. Set ${envName} or choose a CLI-backed classifier.`);
  }
  if (tutorLearnerDagEnabled && !learnerRecordResolved.isConfigured && !isCliProvider(learnerRecordResolved.provider)) {
    const envName = learnerRecordProviderConfig.api_key_env || 'provider API key';
    throw new Error(
      `${args['learner-record-model']} is not configured. Set ${envName} or choose a CLI-backed learner-record model.`,
    );
  }
  if (learnerSuggestionEnabled && !autoLearnerResolved.isConfigured && !isCliProvider(autoLearnerResolved.provider)) {
    const envName = autoLearnerProviderConfig.api_key_env || 'provider API key';
    throw new Error(
      `${args['auto-learner-model']} is not configured. Set ${envName} or choose a CLI-backed automated learner model.`,
    );
  }

  const trace = createTraceState({
    enabled: traceEnabled,
    traceDir: args['trace-dir'],
    metadata: {
      modelRef: args.model,
      resolved: visibleModel,
      tutorInstance: {
        schema: tutorInstance.schema,
        id: tutorInstance.id,
        title: tutorInstance.title,
        requestedRef: args.tutor,
        activeRef: tuning.activeRef,
        rolePromptPath: path.relative(ROOT, tutorInstance.rolePromptPath),
        rolePromptHash: tutorInstance.rolePromptHash,
        policyPack: tutorInstance.policyPack,
      },
      tuning: tutorStubTuningSnapshot(tuning),
      allModelsOverride,
      rememberedSettings: rememberedSettingsConfig,
      passthrough: passthroughConfig,
      humanDiscourse: humanDiscourseConfig,
      scenarioPicker: initialScenarioPickerConfig,
      comprehensionSideState: {
        enabled: true,
        schema: 'machinespirits.tutor-stub.comprehension-side-state.v1',
        sources: ['learner_turn', 'slash_explain'],
        advancesLearnerDag: false,
      },
      dagFactDropout: dagFactDropoutConfig,
      releasePacing: releasePacingConfig,
      experiment: experimentConfig,
      typedPedagogicalActions: typedActionConfig,
      responseConfiguration: {
        schema: 'machinespirits.tutor-stub.response-configuration.v2',
        primaryStanceField: 'engagement_stance',
        independentAxes: [
          'engagement_stance',
          'action_family',
          'audience_register',
          'lexical_accessibility',
          'scene_immersion',
          'actorial_part',
        ],
        temperatureScope: 'engagement_stance_and_actorial_part',
        transcriptVisibilityAudit: true,
      },
      pointOfAction: pointOfActionArm
        ? {
            enabled: true,
            arm: pointOfActionArm,
            detectorVersion: 'step4-frozen-2026-07-14.v1',
            eligibleTurns: [3, 24],
            triggerPriority: ['stagnant_repeat', 'warrant_skip'],
          }
        : { enabled: false },
      promptArchitecture,
      classifier: visibleClassifierConfig,
      tutorLearnerDag: tutorLearnerDagEnabled ? visibleLearnerRecordModel : null,
      learnerDagPreflight: learnerDagPreflightConfig,
      autoLearner: autoLearnerEnabled
        ? {
            enabled: true,
            modelRef: args['auto-learner-model'],
            resolved: visibleAutoLearnerModel,
            maxTurns: autoTurns ?? 'until-grounded',
            untilGrounded: autoTurns === null,
            safetyTurns: autoTurns === null ? autoSafetyTurns : null,
            stopOnGrounded: autoStopOnGrounded,
            profileId: automatedLearnerProfileId(args['auto-learner-profile']),
            profile: args['auto-learner-profile'],
          }
        : { enabled: false },
      mixedLearner: mixedLearnerEnabled
        ? {
            enabled: true,
            modelRef: args['auto-learner-model'],
            resolved: visibleAutoLearnerModel,
            profileId: automatedLearnerProfileId(args['auto-learner-profile']),
            profile: args['auto-learner-profile'],
            clue: '/clue or /hint',
            accept: 'Tab on an empty learner prompt, /use, or /accept',
            inspect: '/suggest',
            regenerate: '/regen',
            profilePresentation: {
              promptLabel: true,
              intendedPattern: true,
              visibleExpression: 'profile_signal',
              readyAnnouncement: 'once_per_profile',
              firstTutorOrdering: 'ready_profile_then_director_then_tutor',
              initialPicker: {
                enabled: initialMixedLearnerSetupEnabled,
                defaultProfileId: automatedLearnerProfileId(args['auto-learner-profile']) || 'custom',
                keyboardMenu: true,
                navigation: ['up', 'down', 'enter'],
                nonTtyFallback: 'typed_profile_id',
              },
            },
            startupPrompts: mixedLearnerStartupPrompts,
          }
        : { enabled: false, requested: mixedLearnerRequested },
      interactiveRoleModes,
      turnFeedback: turnFeedbackConfig,
      explanatoryDebug: explanatoryDebugConfig,
      learningSummaryReport: learningSummaryReportConfig,
      registerSelection: registerSelectionEnabled
        ? {
            enabled: true,
            palette: registerPalette,
            policy: registerPolicyStack.id,
            primaryPolicy: registerPolicy,
            overlayPolicies: registerPolicyOverlays,
            overlayThreshold: registerOverlayThreshold,
            temperature: registerTemperature,
            engagementStanceTemperature: registerTemperature,
            temperatureScope: 'engagement_stance_and_actorial_part',
            combinedLearnerAnalysis: combinedLearnerAnalysisEnabled,
            localFieldPolicy: fieldRegisterSelectionEnabled,
            localTrajectoryPolicy: trajectoryRegisterSelectionEnabled,
            localDynamicalSystemPolicy: dynamicalSystemRegisterSelectionEnabled,
            localEmpiricalDynamicalSystemPolicy: empiricalDynamicalSystemRegisterSelectionEnabled,
            localContinuousDynamicalSystemPolicy: continuousDynamicalSystemRegisterSelectionEnabled,
            localContinuousEmpiricalDynamicalSystemPolicy: continuousEmpiricalDynamicalSystemRegisterSelectionEnabled,
            continuousUnsafeRegisterAnchors: continuousUnsafeRegisterAnchorsEnabled,
            localStatePolicy: stateRegisterSelectionEnabled,
            random: randomRegisterSelectionEnabled,
            negative: negativeRegisterSelectionEnabled,
            empiricalPrior: {
              status: registerEmpiricalPrior.status,
              path: registerEmpiricalPrior.filePath ? path.relative(ROOT, registerEmpiricalPrior.filePath) : null,
              observationCount: registerEmpiricalPrior.prior?.source?.observationCount ?? null,
            },
          }
        : { enabled: false },
      cliEffort: cliEffort || null,
      stream: {
        enabled: streamEnabled,
        tutor: tutorStreamState,
        tutorLive: tutorStreamState === 'live',
        tutorBufferedForConcurrentInput: tutorStreamState === 'buffered_for_concurrent_input',
        tutorGuardedAfterAudit: tutorStreamState === 'guarded_after_audit',
        classifier:
          streamEnabled && classifierResolved
            ? providerSupportsStreaming(classifierResolved) || providerSupportsEventStreaming(classifierResolved)
            : false,
        learnerAnalysis:
          streamEnabled && learnerRecordResolved
            ? providerSupportsStreaming(learnerRecordResolved) || providerSupportsEventStreaming(learnerRecordResolved)
            : false,
      },
      memorySummary: {
        enabled: memorySummaryEnabled,
        rawRecentTurns: historyTurns,
        publicSummary: memorySummaryEnabled,
        scope: 'auxiliary_analysis_prompts',
      },
      speakerHistory: {
        mode: 'full_public_replay',
        perspectives: ['tutor', 'learner'],
        roles: ['system', 'user', 'assistant'],
        directApiTransport: 'native_messages',
        cliTransport: 'flattened_at_bridge_boundary',
      },
      opening: openingConfig,
      closeoutReport: { enabled: closeoutReportEnabled },
      dialogueClosure: dialogueClosureConfig,
      multipleChoice: { enabled: multipleChoiceEnabled },
      interimAnimation: {
        enabled: interimAnimationEnabled,
        activeInThisTerminal: Boolean(interimAnimationEnabled && output.isTTY),
      },
      fieldVisualization: {
        enabled: fieldVisualizationEnabled,
        dir: path.relative(ROOT, traceDir),
        automaticAfterTurns: fieldVisualizationEnabled,
        slashCommand: '/viz',
      },
      resumeLast: args['resume-last']
        ? resumeCandidate
          ? {
              source: path.relative(ROOT, resumeCandidate.filePath),
              turns: resumeCandidate.turns.length,
              world: resumeCandidate.metadata?.world || null,
            }
          : { requested: true, found: false, traceDir: path.relative(ROOT, traceDir) }
        : { requested: false },
      world: worldBundle ? { id: worldBundle.world.id, title: worldBundle.world.title, dag: args.dag } : null,
      firstMessage: firstMessage || null,
    },
  });
  if (initialScenarioSelection) {
    appendTraceEvent(trace, {
      type: 'initial_scenario_selected',
      ...initialScenarioSelection,
    });
  }
  const interim = createInterimState({ enabled: interimAnimationEnabled });

  const state = {
    topic: effectiveTopic,
    systemPrompt,
    promptArchitecture,
    tutorInstance,
    tuning,
    learnerProfileId: automatedLearnerProfileId(args['auto-learner-profile']),
    learnerProfile: args['auto-learner-profile'],
    modelRef: args.model,
    resolved,
    modelRouting: {
      schema: 'machinespirits.tutor-stub.model-routing.v1',
      allRolesOverrideRef: allModelsOverrideRef,
    },
    rememberedSettings: {
      ...rememberedSettingsConfig,
      filePath: rememberedSettings.filePath,
      savedAt: rememberedSettings.savedAt,
    },
    passthrough: passthroughConfig,
    requestedTemperature: temperature,
    temperature: effectiveTemperature,
    maxTokens,
    historyTurns,
    tutorContext: {
      schema: 'machinespirits.tutor-stub.tutor-context-policy.v2',
      historyMode: 'full_public_replay',
      activatedBy: 'session_start',
      activatedAtTurn: null,
      modelRef: args.model,
    },
    memory: {
      enabled: memorySummaryEnabled,
    },
    world: worldBundle?.world || null,
    openingRealization: null,
    openingRealizer,
    directorContext,
    directorOpeningPresented: false,
    dag: args.dag,
    dagMode,
    humanDiscourse: humanDiscourseConfig,
    dialogueClosure: { ...dialogueClosureConfig },
    tutorDag,
    classifier: {
      enabled: classifierEnabled,
      modelRef: args['classifier-model'],
      resolved: classifierResolved,
      combined: combinedLearnerAnalysisEnabled,
    },
    learnerDag: createLearnerDagState({
      enabled: tutorLearnerDagEnabled,
      modelRef: args['learner-record-model'],
      resolved: learnerRecordResolved,
      world: worldBundle?.world || null,
      dropout: {
        rate: dagFactDropoutRate,
        seed: dagFactDropoutSeed,
      },
    }),
    autoLearner: {
      modelRef: args['auto-learner-model'],
      resolved: autoLearnerResolved,
      providerConfig: autoLearnerProviderConfig,
    },
    comprehension: createTutorStubComprehensionState(),
    releasePacing: createTutorStubReleasePacingState({
      world: worldBundle?.world || null,
      speed: releaseSpeed,
    }),
    register: {
      enabled: registerSelectionEnabled,
      palette: registerPalette,
      policy: registerPolicy,
      overlays: [...registerPolicyOverlays],
      overlayThreshold: registerOverlayThreshold,
      temperature: registerTemperature,
      continuousUnsafe: continuousUnsafeRegisterAnchorsEnabled,
      empiricalPrior: registerEmpiricalPrior.prior,
      empiricalPriorStatus: registerEmpiricalPrior.status,
      empiricalPriorPath: registerEmpiricalPrior.filePath,
      current: null,
      history: [],
    },
    pointOfAction: {
      enabled: Boolean(pointOfActionArm),
      arm: pointOfActionArm,
      current: null,
      history: [],
    },
    experiment: experimentConfig,
    typedActions: {
      enabled: typedActionConfig.enabled,
      config: typedActionConfig,
      ledger: [],
      currentDecision: null,
      scaffoldLifecycle: createScaffoldLifecycle(),
    },
    trace,
    debugRunId: trace.runId || safeTimestampForFile(),
    printedDebugIds: new Set(),
    interim,
    stream: {
      enabled: streamEnabled,
      interim,
    },
    fieldViz: {
      enabled: fieldVisualizationEnabled,
      dir: traceDir,
      runId: trace.runId || safeTimestampForFile(),
    },
    cliEffort,
    multipleChoice: multipleChoiceEnabled,
    interaction: {
      mode: 'learner',
      previousMode: 'learner',
      autoRunning: false,
    },
    turnFeedback: createTutorStubTurnFeedbackState({
      enabled: turnFeedbackEnabled,
      automatedLearner: autoLearnerEnabled,
    }),
    explanatoryDebug: {
      enabled: false,
      format: 'prose',
    },
    coach: {
      pending: [],
      history: [],
    },
    history: [],
    turns: [],
  };

  function currentRememberedSettingsSnapshot() {
    return {
      scenarioId: state.world?.id || null,
      learnerProfileId: state.learnerProfileId || null,
      learnerProfile: state.learnerProfileId ? null : state.learnerProfile || null,
      tutorInstanceRef: state.tutorInstance.id,
      tuningMode: state.tuning.mode,
      tutorModelRef: state.modelRef,
      classifierModelRef: state.classifier?.modelRef || args['classifier-model'],
      learnerRecordModelRef: state.learnerDag?.modelRef || args['learner-record-model'],
      autoLearnerModelRef: state.autoLearner?.modelRef || args['auto-learner-model'],
      allModelsOverrideRef: state.modelRouting?.allRolesOverrideRef || null,
      engagementStanceTemperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
      dagFactDropoutRate: state.learnerDag?.dropout?.rate ?? DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
      releaseSpeed: state.releasePacing?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED,
      registerPolicy: state.register?.policy || STUB.registerPolicy,
      registerOverlays: [...(state.register?.overlays || [])],
      registerOverlayThreshold: state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    };
  }

  function persistCurrentInteractiveSettings(reason, overrides = {}) {
    if (!state.rememberedSettings?.writeEnabled) return null;
    try {
      const saved = writeTutorStubLastSettings(state.rememberedSettings.filePath, {
        ...currentRememberedSettingsSnapshot(),
        ...overrides,
      });
      state.rememberedSettings.status = 'saved';
      state.rememberedSettings.savedAt = saved.updatedAt;
      state.rememberedSettings.warning = null;
      appendTraceEvent(state.trace, {
        type: 'interactive_settings_remembered',
        schema: saved.schema,
        reason,
        file: path.relative(ROOT, state.rememberedSettings.filePath),
        savedAt: saved.updatedAt,
        settings: saved,
      });
      return saved;
    } catch (error) {
      state.rememberedSettings.status = 'write_error';
      state.rememberedSettings.warning = error.message;
      appendTraceEvent(state.trace, {
        type: 'interactive_settings_remember_error',
        reason,
        file: path.relative(ROOT, state.rememberedSettings.filePath),
        error: error.message,
      });
      return null;
    }
  }

  function forgetRememberedInteractiveSettings({ source = 'settings' } = {}) {
    const result = clearTutorStubLastSettings(state.rememberedSettings.filePath);
    state.rememberedSettings.enabled = false;
    state.rememberedSettings.writeEnabled = false;
    state.rememberedSettings.status = 'forgotten';
    state.rememberedSettings.savedAt = null;
    appendTraceEvent(state.trace, {
      type: 'interactive_settings_forgotten',
      source,
      file: path.relative(ROOT, state.rememberedSettings.filePath),
      existed: result.existed,
      currentSessionChanged: false,
    });
    return result;
  }

  const resumedDialogue = args['resume-last']
    ? restoreDialogueFromTrace(state, resumeCandidate, { currentWorld: worldBundle?.world || null })
    : null;
  if (resumedDialogue) {
    restoreTutorStubReleasePacingFromTurns({
      pacing: state.releasePacing,
      world: state.world,
      turns: state.turns,
    });
    state.turnFeedback.history = state.turns
      .map((turn) => {
        const feedback = turn.learnerInput?.tutorFeedback || null;
        return feedback?.requested
          ? {
              ...jsonClone(feedback),
              learnerTurn: turn.turn,
              learnerTurnId: turn.turnId || null,
              restored: true,
            }
          : null;
      })
      .filter(Boolean);
    appendTraceEvent(state.trace, {
      type: 'resume_loaded',
      source: path.relative(ROOT, resumedDialogue.source),
      turns: resumedDialogue.turns,
      register: resumedDialogue.register,
      learnerDag: resumedDialogue.learnerDag,
      typedActions: resumedDialogue.typedActions,
      dialogueClosure: resumedDialogue.dialogueClosure,
      warnings: resumedDialogue.warnings,
    });
  } else if (args['resume-last']) {
    appendTraceEvent(state.trace, {
      type: 'resume_empty',
      traceDir: path.relative(ROOT, traceDir),
    });
  }
  console.log(
    `\n${C.cyan}tutor-stub${C.reset} ${C.bold}${state.tuning.activeRef}${C.reset} ${C.dim}· ${args.model} -> ${visibleModel.provider}/${visibleModel.model} · tuning ${state.tuning.mode}${C.reset}`,
  );
  if (passthroughEnabled) {
    console.log(`${C.brightCyan}${C.bold}passthrough >${C.reset} pure speaker chat · one model call per turn`);
    console.log(
      `${C.dim}request: unchanged system setup + full public history + latest learner message${C.reset}`,
    );
    console.log(
      `${C.dim}setup: ${worldBundle ? `${worldBundle.world.id} — ${worldBundle.world.title}` : effectiveTopic}${C.reset}`,
    );
    console.log(`${C.dim}technical trace: ${trace.enabled ? traceDisplayPath(trace) : 'off'}${C.reset}`);
    console.log(`${C.dim}type a message to begin · /settings model changes the speaker · /quit exits${C.reset}\n`);
  } else {
  if (allModelsOverride) {
    console.log(
      `${C.dim}one model for every role: ${allModelsOverride.modelRef} (tutor, learner analysis, reasoning tracker, and automated/suggested learner)${C.reset}`,
    );
  }
  if (rememberedSettings.status === 'loaded' && rememberedSettings.appliedFields.length) {
    console.log(
      `${C.dim}saved settings: restored ${plainList(rememberedSettings.appliedFields.map(plainSettingName))} from the last interactive session${C.reset}`,
    );
  } else if (rememberedSettings.warning) {
    console.log(`${C.yellow}saved settings warning:${C.reset} ${rememberedSettings.warning}`);
  }
  if (classifierEnabled && combinedLearnerAnalysisEnabled) {
    console.log(
      `${C.dim}learner analysis: one combined reading via ${args['learner-record-model']} → ${visibleLearnerRecordModel.provider}/${visibleLearnerRecordModel.model}${C.reset}`,
    );
  } else if (classifierEnabled) {
    console.log(
      `${C.dim}learner analysis: ${args['classifier-model']} → ${visibleClassifierModel.provider}/${visibleClassifierModel.model}${C.reset}`,
    );
  } else {
    console.log(`${C.dim}learner analysis: off${C.reset}`);
  }
  if (tutorLearnerDagEnabled) {
    console.log(
      `${C.dim}learner reasoning tracker: on via ${args['learner-record-model']} → ${visibleLearnerRecordModel.provider}/${visibleLearnerRecordModel.model}${C.reset}`,
    );
  } else if (args['tutor-learner-dag'] && !worldBundle) {
    console.log(`${C.dim}learner reasoning tracker: unavailable because no scenario is active${C.reset}`);
  } else {
    console.log(`${C.dim}learner reasoning tracker: off${C.reset}`);
  }
  console.log(
    `${C.dim}reasoning mode: ${displayDiagnosticLabel(dagMode)} (${humanDiscourseConfig.phase}; ${
      humanDiscourseConfig.behaviorChange ? 'human-friendly inference active' : 'strict proof audit'
    })${C.reset}`,
  );
  if (autoLearnerEnabled) {
    const autoTurnSummary = autoTurns === null ? `until grounded; safety ${autoSafetyTurns}` : `${autoTurns}`;
    console.log(
      `${C.dim}automated learner: ${args['auto-learner-model']} → ${visibleAutoLearnerModel.provider}/${visibleAutoLearnerModel.model}; ${autoTurnSummary}; stop when complete: ${autoStopOnGrounded ? 'yes' : 'no'}${C.reset}`,
    );
  } else if (mixedLearnerEnabled) {
    console.log(
      `${C.dim}learner suggestions: on via ${args['auto-learner-model']} → ${visibleAutoLearnerModel.provider}/${visibleAutoLearnerModel.model}; use /clue, Tab, /suggest, /use, or /regen${C.reset}`,
    );
  } else if (mixedLearnerRequested) {
    console.log(`${C.dim}learner suggestions: off while the automated learner is running${C.reset}`);
  } else if (interactiveSessionEnabled && visibleAutoLearnerModel) {
    console.log(
      `${C.dim}interactive roles: learner + private coach; /auto hands off to ${visibleAutoLearnerModel.provider}/${visibleAutoLearnerModel.model}${C.reset}`,
    );
  } else {
    console.log(`${C.dim}automated learner: off${C.reset}`);
  }
  if (typedActionConfig.enabled) {
    console.log(
      `${C.dim}typed pedagogical actions: on | task ${typedActionTask.taskId} | knowledge component ${
        typedActionTask.knowledgeComponent
      } | difficulty ${typedActionTask.itemDifficulty} | support ${
        typedActionSupportLevel === null ? 'action default' : typedActionSupportLevel
      }${C.reset}`,
    );
  }
  if (registerSelectionEnabled) {
    console.log(
      `${C.dim}teaching style: ${plainPolicyLabel(state.register.policy)} | available stances [${registerPalette.join(', ')}] | policy ${tutorStubRegisterPolicyStackId(
        state.register.policy,
        state.register.overlays,
      )} | override sensitivity ${state.register.overlayThreshold} | style range ${state.register.temperature}${C.reset}`,
    );
    if (
      empiricalDynamicalSystemRegisterSelectionEnabled ||
      continuousEmpiricalDynamicalSystemRegisterSelectionEnabled ||
      registerEmpiricalPrior.status === 'loaded'
    ) {
      const priorPath = registerEmpiricalPrior.filePath ? path.relative(ROOT, registerEmpiricalPrior.filePath) : 'none';
      console.log(
        `${C.dim}cross-run style evidence: ${
          registerEmpiricalPrior.status === 'loaded_holdout_not_passed'
            ? 'available but not steering (independent-run check not passed)'
            : registerEmpiricalPrior.status === 'loaded_legacy_requires_rebuild'
              ? 'legacy artifact not steering (rebuild to add deduplication and independent-run checks)'
            : registerEmpiricalPrior.status
        }${
          priorPath ? ` | ${priorPath}` : ''
        }${C.reset}`,
      );
    }
    if (continuousRegisterSelectionEnabled) {
      console.log(
        `${C.dim}style blend sources: ${
          continuousUnsafeRegisterAnchorsEnabled ? 'active palette' : 'safe router-selectable only'
        }${C.reset}`,
      );
    }
  } else {
    console.log(`${C.dim}teaching-style selection: off${C.reset}`);
  }
  if (trace.enabled) {
    console.log(`${C.dim}technical trace: ${traceDisplayPath(trace)}${C.reset}`);
  } else {
    console.log(`${C.dim}technical trace: off${C.reset}`);
  }
  if (streamEnabled) {
    const streamBits = [
      tutorStreamState === 'live' ? 'tutor live' : null,
      tutorStreamState === 'buffered_for_concurrent_input' ? 'tutor buffered while command line is live' : null,
      tutorStreamState === 'guarded_after_audit' ? 'tutor guarded-after-audit' : null,
      tutorStreamState === 'cli_events' ? 'tutor CLI events' : null,
      classifierResolved && providerSupportsStreaming(classifierResolved) ? 'learner analysis' : null,
      learnerRecordResolved && providerSupportsStreaming(learnerRecordResolved) ? 'reasoning tracker' : null,
      classifierResolved && providerSupportsEventStreaming(classifierResolved) ? 'learner-analysis events' : null,
      learnerRecordResolved && providerSupportsEventStreaming(learnerRecordResolved)
        ? 'reasoning-tracker events'
        : null,
    ].filter(Boolean);
    const streamSummary = streamBits.length
      ? `on for ${streamBits.join(', ')}`
      : tutorStreamState === 'unavailable_cli_buffered'
        ? 'requested, but tutor provider is CLI-buffered'
        : 'requested, but selected providers are CLI-buffered';
    console.log(`${C.dim}live output: ${streamSummary}${C.reset}`);
  } else {
    console.log(`${C.dim}live output: off${C.reset}`);
  }
  console.log(
    `${C.dim}progress display: ${interimAnimationEnabled ? (output.isTTY ? 'on' : 'off outside an interactive terminal') : 'off'}${C.reset}`,
  );
  console.log(
    `${C.dim}interaction chart: ${
      fieldVisualizationEnabled ? `on -> ${path.relative(ROOT, traceDir)}` : 'off (/viz writes on demand)'
    }${C.reset}`,
  );
  console.log(`${C.dim}opening scene: ${openingEnabled && !firstMessage ? 'on' : 'off'}${C.reset}`);
  console.log(`${C.dim}terminal summary at the end: ${closeoutReportEnabled ? 'on' : 'off'}${C.reset}`);
  console.log(
    `${C.dim}optional tutor thumbs feedback: ${turnFeedbackEnabled ? 'on' : 'off'}${autoLearnerEnabled ? ' (automated learner)' : ''}${C.reset}`,
  );
  if (learningSummaryReportConfig.enabled) {
    console.log(
      `${C.dim}learning summary: automatic HTML on conclusion${
        process.env.TUTOR_STUB_SUMMARY_OPEN === '0' ? '; browser launch off' : '; opens in an interactive terminal'
      }${C.reset}`,
    );
  }
  console.log(
    `${C.dim}natural ending: ${dialogueClosureConfig.enabled ? `on; ${dialogueClosureConfig.allowCheckIn ? 'one optional final check-in' : 'close without a check-in'}` : 'off'}${C.reset}`,
  );
  if (cliEffort) {
    console.log(`${C.dim}cli effort: ${cliEffort}${C.reset}`);
  }
  if (resumedDialogue) {
    console.log(
      `${C.dim}resume: loaded ${resumedDialogue.turns} turn(s) from ${path.relative(ROOT, resumedDialogue.source)}${C.reset}`,
    );
    if (resumedDialogue.learnerDag.skipped) {
      console.log(
        `${C.dim}resume: rebuilt ${resumedDialogue.learnerDag.replayed} reasoning snapshot(s) and reused ${resumedDialogue.learnerDag.skipped}${C.reset}`,
      );
    }
    if (resumedDialogue.typedActions.enabled) {
      console.log(
        `${C.dim}resume: typed actions restored ${resumedDialogue.typedActions.ledgerRecords} ledger record(s); phase ${
          resumedDialogue.typedActions.phase
        }; pending ${resumedDialogue.typedActions.pendingContractId || 'none'}${C.reset}`,
      );
    }
    for (const warning of resumedDialogue.warnings) {
      console.log(`${C.red}resume warning${C.reset}${C.dim}: ${warning}${C.reset}`);
    }
    if (state.dialogueClosure?.phase === 'awaiting_checkin') {
      console.log(
        `${C.cyan}resume closure >${C.reset} the saved dialogue had already stated its verdict; one final learner check-in remains`,
      );
    } else if (state.dialogueClosure?.phase === 'closed') {
      console.log(`${C.cyan}resume closure >${C.reset} the saved dialogue is already closed`);
    }
  } else if (args['resume-last']) {
    console.log(`${C.dim}resume: no completed dialogue found in ${path.relative(ROOT, traceDir)}${C.reset}`);
  }
  if (temperature !== effectiveTemperature) {
    console.log(
      `${C.dim}temperature: requested ${temperature}; using ${effectiveTemperature} because ${visibleModel.model} only supports the default${C.reset}`,
    );
  }
  if (worldBundle) {
    console.log(
      `${C.dim}scenario: ${worldBundle.world.id} — ${worldBundle.world.title}${args.dag ? ' | proof map on' : ' | proof map off'}${C.reset}`,
    );
  }
  console.log(
    `${C.dim}topic: ${effectiveTopic} | type / for commands | /reset to recover | /quit to exit${C.reset}\n`,
  );
  }

  if (autoLearnerEnabled) {
    const result = await runAutomatedLearnerDialogue({
      state,
      firstMessage,
      openingEnabled,
      autoLearnerResolved,
      autoLearnerProfile: args['auto-learner-profile'],
      autoTurns,
      autoSafetyTurns,
      autoStopOnGrounded,
      cliEffort,
    });
    appendTraceEvent(state.trace, { type: 'run_end', reason: result.reason, turns: state.turns.length });
    if (args.save) {
      saveTranscript(args.save, {
        ...visibleModel,
        classifier: classifierEnabled ? visibleClassifierConfig : null,
        tutorLearnerDag: tutorLearnerDagEnabled ? visibleLearnerRecordModel : null,
        dagFactDropout: tutorStubDagFactDropoutSnapshot(state.learnerDag.dropout),
        autoLearner: {
          enabled: true,
          modelRef: args['auto-learner-model'],
          resolved: visibleAutoLearnerModel,
          maxTurns: autoTurns ?? 'until-grounded',
          untilGrounded: autoTurns === null,
          safetyTurns: autoTurns === null ? autoSafetyTurns : null,
          stopOnGrounded: autoStopOnGrounded,
          profile: args['auto-learner-profile'],
        },
        registerSelection: registerSelectionEnabled
          ? {
              enabled: true,
              palette: registerPalette,
              policy: tutorStubRegisterPolicyStackId(state.register.policy, state.register.overlays),
              primaryPolicy: state.register.policy,
              overlayPolicies: state.register.overlays,
              overlayThreshold: state.register.overlayThreshold,
              temperature: state.register.temperature,
              history: state.register.history,
            }
          : null,
        dialogueClosure: state.dialogueClosure,
        comprehension: tutorStubComprehensionSnapshot(state.comprehension, { turn: state.turns.length + 1 }),
        directorContext,
        trace: traceDisplayPath(state.trace),
        fieldVisualization: state.fieldViz?.lastWrite || null,
        world: worldBundle ? { id: worldBundle.world.id, title: worldBundle.world.title, dag: args.dag } : null,
        turns: state.turns,
      });
    }
    if (closeoutReportEnabled) {
      const report = printDialogueCloseout(state, { reason: result.reason, trace: state.trace });
      appendTraceEvent(state.trace, { type: 'closeout_report', reason: result.reason, report });
    }
    try {
      writeFinalLearningSummary(result.reason);
    } catch (error) {
      console.log(`${C.red}learning summary error:${C.reset} ${error.message}\n`);
      appendTraceEvent(state.trace, { type: 'learning_summary_error', reason: result.reason, error: error.message });
    }
    return;
  }

  if (firstMessage) {
    const analysis = state.passthrough?.enabled
      ? {
          classification: null,
          tutorLearnerDag: null,
          registerSelection: null,
          previousRegisterEfficacy: null,
        }
      : await analyzeLearnerTurn(firstMessage, state);
    const { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy } = analysis;
    startInterimAnimation(
      state,
      state.passthrough?.enabled ? 'calling speaker' : 'calling tutor',
      state.passthrough?.enabled
        ? { learnerText: firstMessage, tutorTurn: 1 }
        : buildTutorInterimContext({
            learnerText: firstMessage,
            state,
            classification,
            tutorLearnerDag,
            registerSelection,
            previousRegisterEfficacy,
          }),
    );
    let response;
    try {
      response = await runOneTurn(
        firstMessage,
        state,
        classification,
        tutorLearnerDag,
        registerSelection,
        previousRegisterEfficacy,
      );
    } finally {
      stopInterimAnimation(state);
    }
    if (automaticTechnicalDetailsEnabled(state)) printTutorDagSnapshot(response.dagSnapshot);
    if (!state.passthrough?.enabled) {
      printDirectorPreludeBeforeFirstTutor(state, { reason: 'first_message_response' });
    }
    printTutorResponse(response, state.stream);
    console.log(`${C.dim}${metadataLine(response)}${C.reset}\n`);
    await printExplanatoryDebugTurn(state);
    writeFieldVisualization(state, { reason: 'once' });
    appendTraceEvent(state.trace, { type: 'run_end', reason: 'once', turns: state.turns.length });
    if (args.save) {
      saveTranscript(args.save, {
        ...visibleModel,
        classifier: classifierEnabled ? visibleClassifierConfig : null,
        tutorLearnerDag: tutorLearnerDagEnabled ? visibleLearnerRecordModel : null,
        dagFactDropout: tutorStubDagFactDropoutSnapshot(state.learnerDag.dropout),
        registerSelection: registerSelectionEnabled
          ? {
              enabled: true,
              palette: registerPalette,
              policy: tutorStubRegisterPolicyStackId(state.register.policy, state.register.overlays),
              primaryPolicy: state.register.policy,
              overlayPolicies: state.register.overlays,
              overlayThreshold: state.register.overlayThreshold,
              temperature: state.register.temperature,
              history: state.register.history,
            }
          : null,
        dialogueClosure: state.dialogueClosure,
        comprehension: tutorStubComprehensionSnapshot(state.comprehension, { turn: state.turns.length + 1 }),
        directorContext,
        trace: traceDisplayPath(state.trace),
        fieldVisualization: state.fieldViz?.lastWrite || null,
        world: worldBundle ? { id: worldBundle.world.id, title: worldBundle.world.title, dag: args.dag } : null,
        turns: state.turns,
      });
    }
    if (closeoutReportEnabled) {
      const report = printDialogueCloseout(state, { reason: 'once', trace: state.trace });
      appendTraceEvent(state.trace, { type: 'closeout_report', reason: 'once', report });
    }
    try {
      writeFinalLearningSummary('once');
    } catch (error) {
      console.log(`${C.red}learning summary error:${C.reset} ${error.message}\n`);
      appendTraceEvent(state.trace, { type: 'learning_summary_error', reason: 'once', error: error.message });
    }
    return;
  }

  const mixedLearner = {
    enabled: mixedLearnerEnabled,
    resolved: autoLearnerResolved,
    profile: args['auto-learner-profile'],
    defaultProfile: args['auto-learner-profile'],
    profileId: automatedLearnerProfileId(args['auto-learner-profile']),
    seq: 0,
    pending: null,
    suggestion: null,
    error: null,
    artifactAbortController: null,
    analysisCache: null,
    readyAnnouncementProfileKey: null,
    promptHistory: [],
    cacheStats: {
      analysisStarted: 0,
      analysisHits: 0,
      analysisMisses: 0,
      tutorStarted: 0,
      tutorHits: 0,
      tutorMisses: 0,
      discarded: 0,
      errors: 0,
    },
  };

  function mixedLearnerProfilePresentation(suggestion = null) {
    const profileId = suggestion?.profileId || mixedLearner.profileId || null;
    const contract = profileId ? learnerProfileContract(profileId) : null;
    return {
      id: profileId || 'custom',
      name: contract?.intent?.shortName || 'Custom learner',
      speakerLabel: learnerProfileSpeakerLabel(profileId),
      pattern: contract?.intent?.failureOperator || oneLine(suggestion?.profile || mixedLearner.profile, { max: 180 }),
      signal:
        oneLine(suggestion?.profileSignal, { max: 220 }) ||
        'This draft was generated under the active profile; no separate visible-behavior note was returned.',
    };
  }

  function mixedLearnerPromptText() {
    if (state.interaction?.mode === 'coach') return `${C.brightYellow}${C.bold}coach >${C.reset} `;
    if (state.interaction?.mode === 'auto') return `${C.brightBlue}${C.bold}auto >${C.reset} `;
    if (!mixedLearner.enabled) return `${C.brightGreen}${C.bold}learner >${C.reset} `;
    return `${C.brightGreen}${C.bold}${mixedLearnerProfilePresentation().speakerLabel} >${C.reset} `;
  }

  function printMixedLearnerProfilePresentation(suggestion, { verb = 'drafted as' } = {}) {
    const presentation = mixedLearnerProfilePresentation(suggestion);
    console.log(`${C.magenta}profile >${C.reset} ${presentation.id} — ${presentation.name}`);
    console.log(`${C.dim}  tends to: ${presentation.pattern}${C.reset}`);
    console.log(`${C.dim}  ${verb === 'drafted as' ? 'this draft' : verb}: ${presentation.signal}${C.reset}`);
  }

  let initialSetupStage = 'off';
  const rl = readline.createInterface({
    input,
    output,
    prompt: mixedLearnerPromptText(),
    completer(line) {
      if (initialSetupStage === 'profile') {
        const raw = String(line || '');
        const normalized = raw.trim().toLowerCase().replace(/-/gu, '_');
        const candidates = ['list', 'stress', 'all', ...learnerProfileIds()];
        const matches = candidates.filter((candidate) => candidate.startsWith(normalized));
        return [matches.length ? matches : candidates, raw];
      }
      if (initialSetupStage === 'model') {
        const raw = String(line || '');
        const normalized = raw.trim().toLowerCase();
        const candidates = tutorModelChoiceEntries(state.modelRef).map((entry) => entry.ref);
        const matches = candidates.filter((candidate) => candidate.toLowerCase().startsWith(normalized));
        return [matches.length ? matches : candidates, raw];
      }
      const mixedCompletion = mixedLearnerCompletionForLine(line);
      if (mixedCompletion) return [[mixedCompletion], line];
      const completion = slashCommandCompletionForLine(line, { fallback: true });
      return [completion.candidates, completion.replacement];
    },
  });
  const lineSelection = createTutorStubLineSelection({ rl, output });
  const concurrentTerminal = createTutorStubConcurrentTerminal({
    rl,
    output,
    decorateLine: () => lineSelection.decorateLine(),
  });
  state.concurrentTerminal = concurrentTerminal;
  state.interim.concurrentTerminal = concurrentTerminal;
  let slashPaletteRefreshHandle = null;
  let onInteractiveKeypress = null;
  let processingTurn = false;
  let clarificationInFlight = null;
  let scenarioPickerActive = false;
  let awaitingAnotherScenario = false;
  let exiting = false;
  let finalized = false;
  const pendingLearnerLines = [];
  let activeLearnerTurn = null;
  let activeAutoRun = null;
  let resolveInteractive = null;
  const interactiveDone = new Promise((resolve) => {
    resolveInteractive = resolve;
  });

  function mixedLearnerCompletionForLine(line) {
    if (!mixedLearner.enabled || processingTurn || state.interaction?.mode !== 'learner') return null;
    const suggestion = mixedLearner.suggestion;
    const text = String(suggestion?.text || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return null;
    const raw = String(line || '');
    const trimmed = raw.trimStart();
    if (trimmed.startsWith('/')) return null;
    if (!trimmed) return text;
    return text.toLowerCase().startsWith(raw.trim().toLowerCase()) ? text : null;
  }

  function slashCommandCompletionForLine(line, { fallback = false } = {}) {
    const raw = String(line || '');
    const trimmed = raw.trimStart();
    if (!trimmed.startsWith('/')) return { candidates: [], replacement: raw };

      let pool = state.passthrough?.enabled ? PASSTHROUGH_SLASH_COMMANDS : SLASH_COMMANDS;
    if (trimmed.startsWith('/mode ')) {
      pool = ['/mode learner', '/mode coach', '/mode auto'];
    } else if (trimmed.startsWith('/debug ')) {
      pool = [
        '/debug on',
        '/debug on prose',
        '/debug on technical',
        '/debug off',
        '/debug show',
        '/debug show prose',
        '/debug show technical',
        '/debug technical',
      ];
    } else if (trimmed.startsWith('/feedback ')) {
      pool = [
        '/feedback up',
        '/feedback down',
        '/feedback clear',
        '/feedback on',
        '/feedback off',
        ...Object.keys(TUTOR_STUB_FEEDBACK_REASONS).map((reason) => `/feedback down ${reason}`),
      ];
    } else if (trimmed.startsWith('/down ')) {
      pool = Object.keys(TUTOR_STUB_FEEDBACK_REASONS).map((reason) => `/down ${reason}`);
    } else if (trimmed.startsWith('/up ')) {
      pool = Object.keys(TUTOR_STUB_FEEDBACK_REASONS)
        .filter((reason) => reason.startsWith('helpful_') || reason === 'custom')
        .map((reason) => `/up ${reason}`);
    } else if (trimmed.startsWith('/tune ')) {
      pool = [
        '/tune status', '/tune on', '/tune capture', '/tune off', '/tune canary', '/tune reasons',
        '/tune note ', '/tune review', '/tune show ', '/tune approve ', '/tune reject ',
        '/tune replay ', '/tune validate ', '/tune promote ', '/tune rollback',
      ];
    } else if (trimmed.startsWith('/settings model ')) {
      const modelCompletions = [
        '/settings model default',
        ...tutorModelChoiceEntries(state.modelRef).map((entry) => `/settings model ${entry.ref}`),
      ];
      pool = trimmed === '/settings model ' ? modelCompletions.slice(0, 16) : modelCompletions;
    } else if (trimmed.startsWith('/settings ')) {
      pool = SETTINGS_COMPLETIONS;
    } else if (trimmed.startsWith('/analysis ')) {
      pool = ['/analysis technical'];
    } else if (trimmed.startsWith('/transcript ') || trimmed.startsWith('/html ')) {
      const command = trimmed.startsWith('/html ') ? '/html' : '/transcript';
      pool = [`${command} no-open`, `${command} write`];
    } else if (trimmed.startsWith('/profile ')) {
      pool = [
        '/profile list',
        '/profile stress',
        '/profile all',
        '/profile example',
        '/profile default',
        '/profile custom ',
        ...learnerProfileIds().map((profileId) => `/profile ${profileId}`),
      ];
    } else if (trimmed.startsWith('/scenario ')) {
      pool = groupedWorldEntries().map(({ world }) => `/scenario ${world.id}`);
    }
    const matches = pool.filter((candidate) => candidate.startsWith(trimmed));
    return {
      candidates: matches.length || !fallback ? matches : pool,
      replacement: trimmed,
    };
  }

  function slashCommandPaletteForLine(line) {
    const raw = String(line || '');
    const trimmed = raw.trimStart();
    if (!trimmed.startsWith('/')) return [];
    const { candidates } = slashCommandCompletionForLine(trimmed);
    const commands = [...new Set(candidates.map((candidate) => candidate.trimEnd()))];
    const terminalWidth = Math.max(48, Number(output.columns) || 100);
    const countLabel =
      trimmed === '/'
        ? `${commands.length} available`
        : `${commands.length} ${commands.length === 1 ? 'match' : 'matches'} for ${trimmed}`;
    const header = `${C.brightCyan}${C.bold}slash commands${C.reset}${C.dim} · ${countLabel}${C.reset}`;
    if (!commands.length) {
      return [header, `${C.dim}  no match · Backspace to widen the list, or use /help${C.reset}`];
    }

    const widest = Math.max(...commands.map((command) => command.length));
    const columnWidth = Math.min(terminalWidth - 2, widest + 3);
    const columnCount = Math.max(1, Math.min(4, Math.floor((terminalWidth - 2) / columnWidth)));
    const rows = [];
    for (let start = 0; start < commands.length; start += columnCount) {
      const entries = commands.slice(start, start + columnCount);
      const row = entries
        .map((command, index) => {
          const padded = index === entries.length - 1 ? command : command.padEnd(columnWidth);
          return `${C.cyan}${padded}${C.reset}`;
        })
        .join('');
      rows.push(`  ${row}`);
    }
    rows.push(`${C.dim}  keep typing to filter · Tab completes · /help explains each command${C.reset}`);
    return [header, ...rows];
  }

  function resetMixedLearnerSuggestion(reason, { preserveAnalysisCache = false } = {}) {
    if (!mixedLearner.enabled) return;
    const cachedAnalysis = mixedLearner.analysisCache;
    const cachedAnalysisSnapshot = cachedAnalysis
      ? {
          key: cachedAnalysis.key,
          status: cachedAnalysis.status,
          tutorStatus: cachedAnalysis.tutorStatus,
          turn: cachedAnalysis.turn,
          turnId: cachedAnalysis.turnId,
        }
      : null;
    const invalidated = invalidateMixedLearnerCache(mixedLearner, { preserveAnalysisCache });
    if (invalidated.discardedAnalysis) {
      mixedLearner.cacheStats.discarded += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_analysis_cache_discarded',
        reason,
        turn: cachedAnalysisSnapshot.turn,
        turnId: cachedAnalysisSnapshot.turnId,
        status: cachedAnalysisSnapshot.status,
        tutorStatus: cachedAnalysisSnapshot.tutorStatus,
        tutorResponseDiscarded: invalidated.discardedTutorResponse,
        key: cachedAnalysisSnapshot.key,
      });
    }
    if (invalidated.hadState) {
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_suggestion_cleared',
        reason,
        turns: state.turns.length,
      });
    }
    return invalidated;
  }

  function currentMixedLearnerAnalysisKey(
    answer,
    turnNumber = state.turns.length + 1,
    tutorFeedback = null,
  ) {
    const dagPreflight = learnerDagPreflightForTurn(state, turnNumber);
    return mixedLearnerAnalysisCacheKey({
      answer: String(answer || '').trim(),
      turn: turnNumber,
      history: state.history,
      world: state.world?.id || null,
      learnerDag: state.learnerDag?.lastModel
        ? {
            turn: state.learnerDag.lastModel.turn || null,
            metrics: state.learnerDag.lastModel.metrics || null,
            assessment: state.learnerDag.lastModel.assessment || null,
          }
        : null,
      learnerDagPreflightHash: dagPreflight?.contentSha256 || null,
      registerPolicy: tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
      registerOverlayThreshold: state.register?.overlayThreshold ?? null,
      registerTemperature: state.register?.temperature ?? null,
      dagFactDropout: tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout),
      releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
      comprehension: tutorStubComprehensionSnapshot(state.comprehension, { turn: turnNumber }),
      registerHistory: (state.register?.history || []).map((entry) => ({
        turn: entry.turn || null,
        selectedRegister: entry.selected_register || null,
        source: entry.source || null,
      })),
      tutorFeedback: tutorFeedback?.supplied ? { rating: tutorFeedback.rating } : null,
      analysisModel: state.learnerDag?.resolved || state.classifier?.resolved || null,
      learnerProfile: mixedLearner.profile,
      dagMode: state.dagMode,
      systemPrompt: state.systemPrompt,
      schema: 'mixed-learner-analysis-cache.v1',
    });
  }

  function cloneStateForMixedLearnerSpeculation() {
    return {
      ...state,
      history: structuredClone(state.history),
      turns: structuredClone(state.turns),
      world: structuredClone(state.world),
      learnerDag: structuredClone(state.learnerDag),
      comprehension: structuredClone(state.comprehension),
      releasePacing: structuredClone(state.releasePacing),
      register: structuredClone(state.register),
      dialogueClosure: structuredClone(state.dialogueClosure),
      coach: structuredClone(state.coach),
      stream: { enabled: false, interim: state.interim },
    };
  }

  function cloneStateForInteractiveLearnerAttempt() {
    return {
      ...state,
      history: structuredClone(state.history),
      turns: structuredClone(state.turns),
      learnerDag: structuredClone(state.learnerDag),
      comprehension: structuredClone(state.comprehension),
      releasePacing: structuredClone(state.releasePacing),
      register: structuredClone(state.register),
      dialogueClosure: structuredClone(state.dialogueClosure),
      typedActions: structuredClone(state.typedActions),
      coach: structuredClone(state.coach),
      stream: { ...state.stream, interim: state.interim, deferOutput: true },
    };
  }

  function replayConcurrentComprehensionChanges(target, baseline, current) {
    const baselineHistoryLength = baseline?.history?.length || 0;
    const concurrentEntries = (current?.history || []).slice(baselineHistoryLength);
    for (const entry of concurrentEntries) {
      if (entry?.type === 'request') {
        applyTutorStubComprehensionRequest(target, {
          ...entry,
          detected: true,
          schema: 'machinespirits.tutor-stub.comprehension-request.v1',
        });
      } else if (entry?.type === 'response') {
        applyTutorStubComprehensionResponse(target, {
          text: entry.text,
          turn: entry.turn,
          source: entry.source,
          force: true,
          terms: entry.terms,
        });
      }
    }
    return target;
  }

  function mergeConcurrentCoachChanges(attemptCoach, baselineCoach, currentCoach) {
    const merged = structuredClone(attemptCoach || { pending: [], history: [] });
    const baselinePendingIds = new Set((baselineCoach?.pending || []).map((entry) => entry.id));
    const baselineHistoryKeys = new Set(
      (baselineCoach?.history || []).map((entry) => `${entry.turn || 0}:${entry.appliedAt || ''}`),
    );
    const mergedPendingIds = new Set((merged.pending || []).map((entry) => entry.id));
    for (const entry of currentCoach?.pending || []) {
      if (!baselinePendingIds.has(entry.id) && !mergedPendingIds.has(entry.id)) {
        merged.pending.push(structuredClone(entry));
        mergedPendingIds.add(entry.id);
      }
    }
    const mergedHistoryKeys = new Set(
      (merged.history || []).map((entry) => `${entry.turn || 0}:${entry.appliedAt || ''}`),
    );
    for (const entry of currentCoach?.history || []) {
      const key = `${entry.turn || 0}:${entry.appliedAt || ''}`;
      if (!baselineHistoryKeys.has(key) && !mergedHistoryKeys.has(key)) {
        merged.history.push(structuredClone(entry));
        mergedHistoryKeys.add(key);
      }
    }
    return merged;
  }

  function commitInteractiveLearnerAttempt(attemptState, baseline) {
    const currentComprehension = state.comprehension;
    const currentCoach = state.coach;
    state.history = attemptState.history;
    state.turns = attemptState.turns;
    state.learnerDag = attemptState.learnerDag;
    state.releasePacing = attemptState.releasePacing;
    state.register = attemptState.register;
    state.dialogueClosure = attemptState.dialogueClosure;
    state.typedActions = attemptState.typedActions;
    state.comprehension = replayConcurrentComprehensionChanges(
      attemptState.comprehension,
      baseline.comprehension,
      currentComprehension,
    );
    state.coach = mergeConcurrentCoachChanges(attemptState.coach, baseline.coach, currentCoach);
  }

  function mixedLearnerTutorContextKey({
    learnerText,
    classification,
    tutorLearnerDag,
    registerSelection,
    humanDiscourseFrame,
    dialogueClosureFrame,
    tutorFeedback = null,
    comprehensionState = state.comprehension,
    runtimeState = state,
  }) {
    return mixedLearnerAnalysisCacheKey({
      learnerText,
      history: runtimeState.history,
      classifier: classifierTutorContext(classification),
      learnerDag: tutorLearnerDagModelContext(tutorLearnerDag?.model || tutorLearnerDag, {
        releasedEvidence: committedReleaseRows(runtimeState, runtimeState.turns.length + 1),
      }),
      learnerDagPreflightHash: tutorLearnerDag?.preflight?.contentSha256 || null,
      dagFactDropout: tutorStubDagFactDropoutSnapshot(runtimeState.learnerDag?.dropout),
      releasePacing: tutorStubReleasePacingSnapshot(runtimeState.releasePacing, runtimeState.world),
      register: responseConfigurationContext(registerSelection, {
        world: runtimeState?.world || null,
        multipleChoice: runtimeState.multipleChoice,
        humanDiscourseFrame,
        dialogueClosureFrame,
      }),
      humanDiscourse: humanDiscourseTutorContext(humanDiscourseFrame),
      dialogueClosure: dialogueClosureTutorContext(dialogueClosureFrame),
      comprehension: tutorStubComprehensionPrompt(comprehensionState, {
        turn: runtimeState.turns.length + 1,
      }),
      dagTurn:
        runtimeState.dag && runtimeState.world
          ? dagTurnContext(runtimeState, runtimeState.turns.length + 1, tutorLearnerDag)
          : null,
      coachGuidance: tutorCoachGuidanceContext(runtimeState),
      tutorFeedback: tutorFeedback?.supplied ? { rating: tutorFeedback.rating } : null,
      systemPrompt: runtimeState.systemPrompt,
      tutorModel: runtimeState.resolved,
      temperature: runtimeState.temperature,
      maxTokens: runtimeState.maxTokens,
      historyTurns: runtimeState.historyTurns,
      schema: 'mixed-learner-tutor-cache.v1',
    });
  }

  async function startMixedLearnerTutorPrefetch(entry, raw) {
    if (mixedLearner.analysisCache !== entry || exiting) return null;
    if (state.typedActions?.enabled) {
      entry.tutorStatus = 'disabled';
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_prefetch_skipped',
        turn: entry.turn,
        turnId: entry.turnId,
        reason: 'typed_action_must_precede_tutor_output_generation',
      });
      return null;
    }
    entry.tutorStatus = 'pending';
    entry.tutorStartedAt = Date.now();
    mixedLearner.cacheStats.tutorStarted += 1;
    try {
      const speculativeState = cloneStateForMixedLearnerSpeculation();
      const classification = classificationFromCombinedAnalysis(raw, speculativeState);
      const update = learnerRecordFromCombinedAnalysis(raw);
      const tutorLearnerDag = applyLearnerRecordUpdate({
        update,
        state: speculativeState,
        tutorTurn: entry.turn,
        learnerText: entry.answer,
        ...learnerPublicEvidenceState(speculativeState, entry.turn),
      });
      tutorLearnerDag.preflight = raw.dagPreflight || null;
      speculativeState.learnerDag.lastModel = tutorLearnerDag.model;
      updateComprehensionForLearnerTurn({
        learnerText: entry.answer,
        state: speculativeState,
        classification,
        tutorTurn: entry.turn,
        recordTrace: false,
      });
      updateReleasePacingForLearnerTurn({
        learnerText: entry.answer,
        state: speculativeState,
        classification,
        tutorLearnerDag,
        tutorTurn: entry.turn,
        recordTrace: false,
      });
      evaluatePendingRegisterEfficacy(speculativeState, tutorLearnerDag, classification);
      const registerSelection = normalizeResponseConfigurationSelection(registerSelectionFromCombinedAnalysis(raw), {
        state: speculativeState,
        classification,
        tutorLearnerDag,
        raw,
        learnerText: entry.answer,
      });
      const humanDiscourseFrame = buildHumanDiscourseFrame({
        state: speculativeState,
        tutorTurn: entry.turn,
        tutorLearnerDag,
        classification,
        learnerText: entry.answer,
      });
      const { frame: dialogueClosureFrame } = tutorDialogueClosureFrameForTurn({
        state: speculativeState,
        tutorTurn: entry.turn,
        tutorLearnerDag,
      });
      entry.tutorContextKey = mixedLearnerTutorContextKey({
        learnerText: entry.answer,
        classification,
        tutorLearnerDag,
        registerSelection,
        humanDiscourseFrame,
        dialogueClosureFrame,
        comprehensionState: speculativeState.comprehension,
        runtimeState: speculativeState,
      });
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_prefetch_start',
        turn: entry.turn,
        turnId: entry.turnId,
        requestId: entry.requestId,
        analysisKey: entry.key,
        tutorContextKey: entry.tutorContextKey,
      });
      entry.tutorPromise = callTutor({
        learnerText: entry.answer,
        history: speculativeState.history,
        state: speculativeState,
        systemPrompt: speculativeState.systemPrompt,
        resolved: speculativeState.resolved,
        temperature: speculativeState.temperature,
        maxTokens: speculativeState.maxTokens,
        historyTurns: speculativeState.historyTurns,
        world: speculativeState.world,
        dag: speculativeState.dag,
        classification,
        tutorLearnerDagModel: tutorLearnerDag,
        registerSelection,
        humanDiscourseFrame,
        dialogueClosureFrame,
        trace: state.trace,
        stream: { enabled: false, interim: state.interim },
        cliEffort: speculativeState.cliEffort,
        multipleChoice: speculativeState.multipleChoice,
        roleBase: 'tutor_stub_tutor_prefetch',
        signal: entry.abortController.signal,
      });
      const response = await entry.tutorPromise;
      if (mixedLearner.analysisCache !== entry || exiting) return null;
      entry.tutorStatus = 'ready';
      entry.tutorResponse = response;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_prefetch_ready',
        turn: entry.turn,
        turnId: entry.turnId,
        requestId: entry.requestId,
        tutorContextKey: entry.tutorContextKey,
        latencyMs: Date.now() - entry.tutorStartedAt,
      });
      return response;
    } catch (err) {
      if (err?.name === 'AbortError') return null;
      if (mixedLearner.analysisCache === entry) {
        entry.tutorStatus = 'error';
        entry.tutorError = err.message;
      }
      mixedLearner.cacheStats.errors += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_prefetch_error',
        turn: entry.turn,
        turnId: entry.turnId,
        requestId: entry.requestId,
        error: err.message,
      });
      return null;
    }
  }

  async function takeMixedLearnerTutorPrefetch(
    entry,
    {
      learnerText,
      classification,
      tutorLearnerDag,
      registerSelection,
      humanDiscourseFrame,
      dialogueClosureFrame,
      tutorFeedback = null,
    },
  ) {
    if (!entry || mixedLearner.analysisCache !== entry) return null;
    const liveContextKey = mixedLearnerTutorContextKey({
      learnerText,
      classification,
      tutorLearnerDag,
      registerSelection,
      humanDiscourseFrame,
      dialogueClosureFrame,
      tutorFeedback,
    });
    if (!entry.tutorContextKey || entry.tutorContextKey !== liveContextKey) {
      mixedLearner.cacheStats.tutorMisses += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_cache_miss',
        turn: entry.turn,
        turnId: entry.turnId,
        reason: !entry.tutorContextKey ? 'not_prefetched' : 'context_changed',
        cachedKey: entry.tutorContextKey || null,
        liveKey: liveContextKey,
      });
      mixedLearner.analysisCache = null;
      return null;
    }
    const waited = entry.tutorStatus === 'pending';
    if (waited) {
      startInterimAnimation(state, 'awaiting prefetched tutor response', {
        learnerText,
        tutorTurn: entry.turn,
        classification,
        tutorLearnerDag,
        registerSelection,
      });
      await entry.tutorPromise;
      stopInterimAnimation(state);
    }
    if (!entry.tutorResponse || entry.tutorStatus !== 'ready') {
      mixedLearner.cacheStats.tutorMisses += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_cache_miss',
        turn: entry.turn,
        turnId: entry.turnId,
        reason: entry.tutorError ? 'prefetch_error' : 'prefetch_unavailable',
        key: liveContextKey,
      });
      mixedLearner.analysisCache = null;
      return null;
    }
    const response = { ...entry.tutorResponse, speculativeCacheHit: true };
    mixedLearner.analysisCache = null;
    mixedLearner.cacheStats.tutorHits += 1;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_tutor_cache_hit',
      turn: entry.turn,
      turnId: entry.turnId,
      key: liveContextKey,
      waited,
      ageMs: Date.now() - entry.tutorStartedAt,
    });
    return response;
  }

  function startMixedLearnerAnalysisPrefetch({ answer, turnNumber, turnId, requestId }) {
    if (!state.classifier.enabled || !state.learnerDag.enabled || !state.world || !answer) return false;
    const key = currentMixedLearnerAnalysisKey(answer, turnNumber);
    const analysisState = cloneStateForMixedLearnerSpeculation();
    updateComprehensionForLearnerTurn({
      learnerText: answer,
      state: analysisState,
      classification: null,
      tutorTurn: turnNumber,
      recordTrace: false,
    });
    const entry = {
      key,
      answer,
      turn: turnNumber,
      turnId,
      requestId,
      status: 'pending',
      startedAt: Date.now(),
      raw: null,
      error: null,
      promise: null,
      tutorStatus: 'idle',
      tutorContextKey: null,
      tutorPromise: null,
      tutorResponse: null,
      tutorError: null,
      abortController: new AbortController(),
    };
    mixedLearner.analysisCache = entry;
    mixedLearner.cacheStats.analysisStarted += 1;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_analysis_prefetch_start',
      turn: turnNumber,
      turnId,
      requestId,
      key,
    });
    entry.promise = extractCombinedLearnerAnalysis({
      learnerText: answer,
      state: analysisState,
      tutorTurn: turnNumber,
      role: 'tutor_stub_learner_analysis_prefetch',
      preflightSource: 'mixed_learner_analysis_prefetch',
      stream: { enabled: false, interim: state.interim },
      signal: entry.abortController.signal,
    })
      .then((raw) => {
        if (mixedLearner.analysisCache !== entry) return null;
        entry.status = 'ready';
        entry.raw = raw;
        appendTraceEvent(state.trace, {
          type: 'mixed_learner_analysis_prefetch_ready',
          turn: turnNumber,
          turnId,
          requestId,
          key,
          latencyMs: Date.now() - entry.startedAt,
        });
        void startMixedLearnerTutorPrefetch(entry, raw);
        return raw;
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return null;
        if (mixedLearner.analysisCache === entry) {
          entry.status = 'error';
          entry.error = err.message;
        }
        mixedLearner.cacheStats.errors += 1;
        appendTraceEvent(state.trace, {
          type: 'mixed_learner_analysis_prefetch_error',
          turn: turnNumber,
          turnId,
          requestId,
          key,
          error: err.message,
        });
        return null;
      });
    return true;
  }

  async function takeMixedLearnerAnalysisPrefetch(learnerText, tutorFeedback = null) {
    if (!mixedLearner.enabled) return null;
    const entry = mixedLearner.analysisCache;
    const answer = String(learnerText || '').trim();
    const expectedKey = currentMixedLearnerAnalysisKey(answer, state.turns.length + 1, tutorFeedback);
    if (!entry || entry.answer !== answer || entry.key !== expectedKey) {
      mixedLearner.cacheStats.analysisMisses += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_analysis_cache_miss',
        turn: state.turns.length + 1,
        reason: !entry ? 'not_prefetched' : entry.answer !== answer ? 'answer_changed' : 'state_changed',
        cachedKey: entry?.key || null,
        submittedKey: expectedKey,
      });
      return null;
    }
    const waited = entry.status === 'pending';
    if (waited) {
      startInterimAnimation(state, 'awaiting prefetched learner analysis', {
        learnerText: answer,
        tutorTurn: state.turns.length + 1,
      });
      await entry.promise;
      stopInterimAnimation(state);
    }
    if (!entry.raw || entry.status !== 'ready') {
      mixedLearner.cacheStats.analysisMisses += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_analysis_cache_miss',
        turn: entry.turn,
        turnId: entry.turnId,
        reason: entry.error ? 'prefetch_error' : 'prefetch_unavailable',
        key: entry.key,
      });
      return null;
    }
    mixedLearner.cacheStats.analysisHits += 1;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_analysis_cache_hit',
      turn: entry.turn,
      turnId: entry.turnId,
      key: entry.key,
      waited,
      ageMs: Date.now() - entry.startedAt,
    });
    return { raw: entry.raw, entry };
  }

  function startMixedLearnerPrefetch(reason = 'turn_complete', { force = false, refreshPrompt = true } = {}) {
    if (!mixedLearner.enabled || exiting || state.dialogueClosure?.phase === 'closed') return false;
    const turnNumber = state.turns.length + 1;
    const turnId = turnDebugId(state, turnNumber);
    if (!force && (mixedLearner.pending?.turn === turnNumber || mixedLearner.suggestion?.turn === turnNumber)) {
      return false;
    }
    if (force) resetMixedLearnerSuggestion(reason);
    const requestId = mixedLearner.seq + 1;
    mixedLearner.seq = requestId;
    mixedLearner.pending = { requestId, turn: turnNumber, turnId };
    mixedLearner.suggestion = null;
    mixedLearner.error = null;
    const artifactAbortController = new AbortController();
    mixedLearner.artifactAbortController = artifactAbortController;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_prefetch_start',
      turn: turnNumber,
      turnId,
      requestId,
      reason,
      model: mixedLearner.resolved,
    });
    const prefetchPromise = generateMixedLearnerArtifacts({
      state,
      resolved: mixedLearner.resolved,
      profile: mixedLearner.profile,
      turnNumber,
      cliEffort,
      signal: artifactAbortController.signal,
    })
      .then((generated) => {
        if (mixedLearner.artifactAbortController === artifactAbortController) {
          mixedLearner.artifactAbortController = null;
        }
        const text = String(generated.answer || '').trim();
        const clue = String(generated.clue || '').trim();
        const move = mixedLearnerSuggestionMove(text, generated.move);
        const profileSignal = String(generated.profileSignal || '').trim() || null;
        if (!mixedLearner.enabled || mixedLearner.seq !== requestId || exiting) {
          appendTraceEvent(state.trace, {
            type: 'mixed_learner_prefetch_discarded',
            turn: turnNumber,
            turnId,
            requestId,
            reason: exiting ? 'exiting' : 'stale',
          });
          return;
        }
        mixedLearner.pending = null;
        const promptSnapshot = generated.promptSnapshot
          ? {
              ...generated.promptSnapshot,
              requestId,
              profileId: mixedLearner.profileId,
            }
          : null;
        if (promptSnapshot) {
          mixedLearner.promptHistory.push(promptSnapshot);
          if (mixedLearner.promptHistory.length > 100) mixedLearner.promptHistory.shift();
        }
        mixedLearner.suggestion = {
          requestId,
          turn: turnNumber,
          turnId,
          text,
          clue: clue || null,
          move,
          profileId: mixedLearner.profileId,
          profile: mixedLearner.profile,
          profileSignal,
          provider: generated.provider,
          model: generated.model,
          latencyMs: generated.latencyMs,
          usage: generated.usage,
          promptSnapshot,
        };
        appendTraceEvent(state.trace, {
          type: 'mixed_learner_suggestion_ready',
          turn: turnNumber,
          turnId,
          requestId,
          text,
          clue: clue || null,
          move,
          profileId: mixedLearner.profileId,
          profileSignal,
          parsedArtifacts: generated.parsedArtifacts,
          provider: generated.provider,
          model: generated.model,
          latencyMs: generated.latencyMs,
          usage: generated.usage,
        });
        const analysisWarming = startMixedLearnerAnalysisPrefetch({
          answer: text,
          turnNumber,
          turnId,
          requestId,
        });
        if (!processingTurn && !exiting) {
          printWithConcurrentTerminal(state, () => {
            clearStatusLine();
            if (consumeMixedLearnerReadyAnnouncement(mixedLearner)) {
              const technicalSuffix = automaticTechnicalDetailsEnabled(state)
                ? ` · ${turnId}${analysisWarming ? ' · learner analysis running' : ''}`
                : '';
              console.log(
                `${C.brightGreen}learner suggestion ready >${C.reset} ${move === 'ask_question' ? 'ask a question' : 'respond'}${technicalSuffix}`,
              );
              console.log(
                `${C.dim}  Tab inserts it for editing · /clue gives direction · /suggest previews it · /use sends it${C.reset}`,
              );
              printMixedLearnerProfilePresentation(mixedLearner.suggestion);
              appendTraceEvent(state.trace, {
                type: 'mixed_learner_ready_announcement',
                turn: turnNumber,
                turnId,
                profileId: mixedLearner.profileId,
                move,
              });
            }
            if (refreshPrompt && !concurrentTerminal.enabled) refreshMixedLearnerPrompt(rl);
          });
        }
      })
      .catch((err) => {
        if (mixedLearner.artifactAbortController === artifactAbortController) {
          mixedLearner.artifactAbortController = null;
        }
        if (err?.name === 'AbortError') return;
        if (!mixedLearner.enabled || mixedLearner.seq !== requestId) return;
        mixedLearner.pending = null;
        mixedLearner.error = { turn: turnNumber, turnId, message: err.message };
        appendTraceEvent(state.trace, {
          type: 'mixed_learner_prefetch_error',
          turn: turnNumber,
          turnId,
          requestId,
          error: err.message,
        });
        if (!processingTurn && !exiting) {
          printWithConcurrentTerminal(state, () => {
            clearStatusLine();
            console.log(
              `${C.red}learner suggestion error:${C.reset} ${err.message}${C.dim} · use /regen to retry${C.reset}`,
            );
            if (refreshPrompt && !concurrentTerminal.enabled) refreshMixedLearnerPrompt(rl);
          });
        }
      });
    return prefetchPromise;
  }

  function showMixedLearnerSuggestion({ duringTurn = false } = {}) {
    clearStatusLine();
    if (!mixedLearner.enabled) {
      console.log(`${C.dim}learner suggestions are off; start with --mixed-learner to enable them${C.reset}\n`);
      return;
    }
    if (mixedLearner.suggestion?.text) {
      console.log(
        `${C.cyan}learner suggestion >${C.reset} ${mixedLearner.suggestion.move === 'ask_question' ? 'ask a question' : 'respond'}`,
      );
      printMixedLearnerProfilePresentation(mixedLearner.suggestion);
      console.log(`${mixedLearner.suggestion.text}\n`);
      return;
    }
    if (mixedLearner.pending) {
      console.log(`${C.dim}the learner suggestion is still being drafted; use /suggest again shortly${C.reset}\n`);
      return;
    }
    if (mixedLearner.error) {
      console.log(
        `${C.red}learner suggestion error:${C.reset} ${mixedLearner.error.message}${C.dim} · use /regen to retry${C.reset}\n`,
      );
      return;
    }
    if (duringTurn) {
      console.log(`${C.dim}the tutor is still responding; the next learner suggestion starts afterward${C.reset}\n`);
      return;
    }
    console.log(`${C.dim}no learner suggestion is ready; starting one now${C.reset}\n`);
    startMixedLearnerPrefetch('suggest');
  }

  function showMixedLearnerClue({ duringTurn = false } = {}) {
    clearStatusLine();
    if (!mixedLearner.enabled) {
      console.log(`${C.dim}learner suggestions are off; start with --mixed-learner to use /clue${C.reset}\n`);
      return;
    }
    if (mixedLearner.suggestion?.clue) {
      console.log(
        `${C.cyan}learner clue >${C.reset} ${mixedLearner.suggestion.move === 'ask_question' ? 'ask a question' : 'respond'}`,
      );
      console.log(`${mixedLearner.suggestion.clue}\n`);
      return;
    }
    if (mixedLearner.suggestion?.text) {
      console.log(
        `${C.dim}the answer is ready, but no safe non-revealing clue was returned; /regen retries the pair${C.reset}\n`,
      );
      return;
    }
    if (mixedLearner.pending) {
      console.log(`${C.dim}the clue and learner suggestion are still being drafted${C.reset}\n`);
      return;
    }
    if (mixedLearner.error) {
      console.log(
        `${C.red}learner suggestion error:${C.reset} ${mixedLearner.error.message}${C.dim} · use /regen to retry${C.reset}\n`,
      );
      return;
    }
    if (duringTurn) {
      console.log(`${C.dim}the tutor is still responding; clue generation starts afterward${C.reset}\n`);
      return;
    }
    console.log(`${C.dim}no learner clue is ready; starting the clue and suggestion now${C.reset}\n`);
    startMixedLearnerPrefetch('clue');
  }

  function printMixedLearnerProfileList(listScope = 'core', { picker = false } = {}) {
    const scopeConfig = {
      core: { suite: 'core', label: 'ordinary choices' },
      stress: { suite: 'stress', label: 'specialist failure modes' },
      all: { suite: 'audit', label: 'complete v3 registry' },
      audit: { suite: 'audit', label: 'complete v3 registry' },
    }[
      String(listScope || 'core')
        .trim()
        .toLowerCase()
    ];
    if (!scopeConfig) return false;
    const profileIds = learnerProfileSuiteIds(scopeConfig.suite);
    console.log(`${C.cyan}learner profiles > ${scopeConfig.label} (${profileIds.length})${C.reset}`);
    console.log(learnerProfileListText({ ids: profileIds, includeSuites: false }));
    if (picker) {
      console.log(
        `${C.dim}  choose a learner by entering one profile id above; browse list (ordinary), stress, or all${C.reset}\n`,
      );
    } else if (scopeConfig.suite === 'core') {
      console.log(
        `${C.dim}  specialist profiles: /profile list stress · complete registry: /profile list all${C.reset}\n`,
      );
    } else {
      console.log(`${C.dim}  ordinary choices: /profile list · complete registry: /profile list all${C.reset}\n`);
    }
    return true;
  }

  function handleMixedLearnerProfileCommand(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    if (!mixedLearner.enabled) {
      console.log(`${C.dim}learner suggestions are off; start with --mixed-learner to use /profile${C.reset}\n`);
      return;
    }
    const requested = String(argument || '').trim();
    if (!requested) {
      const label = mixedLearner.profileId
        ? `${mixedLearner.profileId}: ${learnerProfileDescription(mixedLearner.profileId)}`
        : `custom: ${oneLine(mixedLearner.profile, { max: 180 })}`;
      console.log(`${C.cyan}learner profile >${C.reset} ${label}`);
      console.log(
        `${C.dim}  use /profile list, /profile list stress, /profile list all, /profile example, /profile <id>, /profile default, or /profile custom <description>${C.reset}\n`,
      );
      return;
    }
    if (requested === 'list' || requested.startsWith('list ')) {
      const listScope = requested.slice('list'.length).trim().toLowerCase() || 'core';
      if (!printMixedLearnerProfileList(listScope)) {
        console.log(`${C.red}unknown learner profile list: ${listScope}${C.reset}`);
        console.log(`${C.dim}  use /profile list, /profile list stress, or /profile list all${C.reset}\n`);
      }
      return;
    }
    if (requested === 'example') {
      console.log(`${C.cyan}custom learner profile example >${C.reset}`);
      console.log(`/profile custom ${CUSTOM_LEARNER_PROFILE_EXAMPLE}`);
      console.log(
        `${C.dim}  describe an observable pattern, its trigger, and the tutor support that permits progress; do not add hidden case facts${C.reset}\n`,
      );
      return;
    }

    let nextProfile;
    let nextProfileId = null;
    if (requested === 'default') {
      nextProfile = mixedLearner.defaultProfile;
      nextProfileId = automatedLearnerProfileId(nextProfile);
    } else if (requested.startsWith('custom ')) {
      nextProfile = requested.slice('custom '.length).trim();
      if (!nextProfile) {
        console.log(`${C.red}profile error:${C.reset} custom profile text is empty\n`);
        return;
      }
    } else {
      nextProfileId = requested.toLowerCase().replace(/-/gu, '_');
      if (!learnerProfileIds().includes(nextProfileId)) {
        console.log(`${C.red}unknown learner profile:${C.reset} ${requested}`);
        console.log(
          `${C.dim}  use /profile list, /profile list stress, or /profile list all to see valid ids${C.reset}\n`,
        );
        return;
      }
      nextProfile = learnerProfilePrompt(nextProfileId);
    }

    const previousProfileId = mixedLearner.profileId;
    const invalidated = resetMixedLearnerSuggestion('profile_changed');
    mixedLearner.profile = nextProfile;
    mixedLearner.profileId = nextProfileId;
    state.learnerProfile = nextProfile;
    state.learnerProfileId = nextProfileId;
    args['auto-learner-profile'] = nextProfile;
    rl.setPrompt(mixedLearnerPromptText());
    const remembered = persistCurrentInteractiveSettings('learner_profile_changed');
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_profile_changed',
      previousProfileId,
      profileId: nextProfileId,
      custom: !nextProfileId,
      duringTurn,
      turn: state.turns.length + 1,
      cacheRefresh: {
        priorStateCleared: Boolean(invalidated?.hadState),
        analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
        tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
      },
      rememberedAt: remembered?.updatedAt || null,
    });
    const label = nextProfileId ? `${nextProfileId}: ${learnerProfileDescription(nextProfileId)}` : 'custom profile';
    console.log(`${C.cyan}learner profile >${C.reset} switched to ${label}`);
    if (duringTurn) {
      console.log(`${C.dim}  applies when the current tutor response completes${C.reset}\n`);
    } else if (latestTutorMessage(state)) {
      startMixedLearnerPrefetch('profile_changed');
      console.log(
        `${C.dim}  discarded the old clue and suggestion; rebuilding them for the current turn; Tab activates when the new suggestion is ready${C.reset}\n`,
      );
    } else {
      console.log(`${C.dim}  applies after the next tutor message${C.reset}\n`);
    }
  }

  function applyInitialMixedLearnerProfile(profileId, { usedDefault = false, selectionMethod = 'typed' } = {}) {
    if (profileId) {
      mixedLearner.profileId = profileId;
      mixedLearner.profile = learnerProfilePrompt(profileId);
    }
    state.learnerProfileId = mixedLearner.profileId || null;
    state.learnerProfile = mixedLearner.profile;
    args['auto-learner-profile'] = mixedLearner.profile;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_initial_profile_selected',
      profileId: profileId || null,
      custom: !profileId,
      usedDefault,
      selectionMethod,
    });
  }

  function applyTutorModelSelection(
    modelRef,
    { source = 'settings', usedDefault = false, deferEffects = false, preserveAllOverride = false } = {},
  ) {
    const selection = resolveTutorModelSelection(modelRef);
    const previousRef = state.modelRef;
    const previousResolved = state.resolved;
    state.modelRef = selection.modelRef;
    state.resolved = selection.resolved;
    state.temperature = effectiveTemperatureForModel(selection.resolved, state.requestedTemperature);
    args.model = selection.modelRef;
    visibleModel = visibleResolvedModel(selection.resolved, selection.providerConfig);
    const changed = previousRef !== selection.modelRef || previousResolved.model !== selection.resolved.model;
    if (changed && !preserveAllOverride) state.modelRouting.allRolesOverrideRef = null;
    const contextReplayRecorded = Boolean(changed && source !== 'initial_settings' && state.history.length > 0);
    if (contextReplayRecorded) {
      state.tutorContext = {
        ...state.tutorContext,
        modelRef: selection.modelRef,
      };
    }
    const invalidated = changed && !deferEffects ? resetMixedLearnerSuggestion('tutor_model_changed') : null;
    const remembered = changed && !deferEffects ? persistCurrentInteractiveSettings('tutor_model_changed') : null;
    appendTraceEvent(state.trace, {
      type: source === 'initial_settings' ? 'mixed_learner_initial_tutor_model_selected' : 'tutor_model_changed',
      schema: 'machinespirits.tutor-stub.tutor-model-selection.v1',
      source,
      previousRef,
      modelRef: selection.modelRef,
      provider: selection.resolved.provider,
      model: selection.resolved.model,
      cli: isCliProvider(selection.resolved.provider),
      usedDefault,
      changed,
      rememberedAt: remembered?.updatedAt || null,
      effectiveTurn: state.turns.length + 1,
      contextReplay: contextReplayRecorded
        ? {
            schema: 'machinespirits.tutor-stub.tutor-context-replay.v2',
            historyMode: state.tutorContext.historyMode,
            publicMessageCount: tutorStubPublicMessagesForSpeaker(state.history, { speaker: 'tutor' }).length,
            includesRoles: ['user', 'assistant'],
            persistence: 'every_subsequent_tutor_call_in_this_dialogue',
            alreadyActive: true,
          }
        : null,
      cacheRefresh: invalidated
        ? {
            priorStateCleared: Boolean(invalidated.hadState),
            analysisDiscarded: Boolean(invalidated.discardedAnalysis),
            tutorResponseDiscarded: Boolean(invalidated.discardedTutorResponse),
          }
        : null,
    });
    return { ...selection, previousRef, changed, invalidated };
  }

  const liveModelRoleDefinitions = {
    tutor: {
      label: 'Tutor voice',
      setting: 'tutor',
      defaultRef: STUB.model,
    },
    classifier: {
      label: 'Learner interpretation',
      setting: 'classifier',
      defaultRef: STUB.classifierModel,
    },
    reasoning: {
      label: 'Learner reasoning tracker',
      setting: 'reasoning',
      defaultRef: STUB.learnerRecordModel,
    },
    learner: {
      label: 'Learner voice',
      setting: 'learner',
      defaultRef: STUB.autoLearnerModel,
    },
  };

  function liveModelRoleRef(role) {
    if (role === 'tutor') return state.modelRef;
    if (role === 'classifier') return state.classifier?.modelRef || args['classifier-model'];
    if (role === 'reasoning') return state.learnerDag?.modelRef || args['learner-record-model'];
    if (role === 'learner') return state.autoLearner?.modelRef || args['auto-learner-model'];
    throw new Error(`unknown model role: ${role}`);
  }

  function liveModelRoleSnapshot(role) {
    const modelRef = liveModelRoleRef(role);
    const resolvedRole =
      role === 'tutor'
        ? state.resolved
        : role === 'classifier'
          ? state.classifier?.resolved || resolveModel(modelRef)
          : role === 'reasoning'
            ? state.learnerDag?.resolved || resolveModel(modelRef)
            : state.autoLearner?.resolved || resolveModel(modelRef);
    const providerConfigRole = getProviderConfig(resolvedRole.provider);
    return {
      role,
      label: liveModelRoleDefinitions[role].label,
      modelRef,
      resolved: visibleResolvedModel(resolvedRole, providerConfigRole),
      active:
        role === 'tutor' ||
        (role === 'classifier' && state.classifier?.enabled && !state.classifier?.combined) ||
        (role === 'reasoning' && state.learnerDag?.enabled) ||
        (role === 'learner' && learnerSuggestionEnabled),
      combinedOwner: role === 'reasoning' && Boolean(state.classifier?.enabled && state.classifier?.combined),
    };
  }

  function refreshVisibleClassifierConfig() {
    visibleClassifierConfig = classifierEnabled
      ? combinedLearnerAnalysisEnabled
        ? {
            combined: true,
            classifierModelRef: args['classifier-model'],
            modelRef: args['learner-record-model'],
            resolved: visibleLearnerRecordModel,
          }
        : {
            modelRef: args['classifier-model'],
            resolved: visibleClassifierModel,
          }
      : { enabled: false };
  }

  function applyRoleModelSelection(
    role,
    modelRef,
    { source = 'live_settings', deferEffects = false, preserveAllOverride = false } = {},
  ) {
    if (role === 'tutor') {
      return applyTutorModelSelection(modelRef, {
        source,
        deferEffects,
        preserveAllOverride,
      });
    }
    const selection = resolveTutorModelSelection(modelRef);
    const previousRef = liveModelRoleRef(role);
    const changed = previousRef !== selection.modelRef;
    if (role === 'classifier') {
      args['classifier-model'] = selection.modelRef;
      state.classifier.modelRef = selection.modelRef;
      state.classifier.resolved = selection.resolved;
      classifierResolved = selection.resolved;
      classifierProviderConfig = selection.providerConfig;
      visibleClassifierModel = visibleResolvedModel(selection.resolved, selection.providerConfig);
    } else if (role === 'reasoning') {
      args['learner-record-model'] = selection.modelRef;
      state.learnerDag.modelRef = selection.modelRef;
      state.learnerDag.resolved = selection.resolved;
      learnerRecordResolved = selection.resolved;
      learnerRecordProviderConfig = selection.providerConfig;
      visibleLearnerRecordModel = visibleResolvedModel(selection.resolved, selection.providerConfig);
    } else if (role === 'learner') {
      args['auto-learner-model'] = selection.modelRef;
      state.autoLearner = {
        modelRef: selection.modelRef,
        resolved: selection.resolved,
        providerConfig: selection.providerConfig,
      };
      mixedLearner.resolved = selection.resolved;
      autoLearnerResolved = selection.resolved;
      autoLearnerProviderConfig = selection.providerConfig;
      visibleAutoLearnerModel = visibleResolvedModel(selection.resolved, selection.providerConfig);
    } else {
      throw new Error(`unknown model role: ${role}`);
    }
    refreshVisibleClassifierConfig();
    if (changed && !preserveAllOverride) state.modelRouting.allRolesOverrideRef = null;
    const invalidated = changed && !deferEffects ? resetMixedLearnerSuggestion(`${role}_model_changed`) : null;
    const remembered = changed && !deferEffects ? persistCurrentInteractiveSettings(`${role}_model_changed`) : null;
    appendTraceEvent(state.trace, {
      type: 'role_model_changed',
      schema: 'machinespirits.tutor-stub.role-model-selection.v1',
      source,
      role,
      previousRef,
      modelRef: selection.modelRef,
      provider: selection.resolved.provider,
      model: selection.resolved.model,
      changed,
      effectiveTurn: state.turns.length + 1,
      rememberedAt: remembered?.updatedAt || null,
      cacheRefresh: invalidated
        ? {
            priorStateCleared: Boolean(invalidated.hadState),
            analysisDiscarded: Boolean(invalidated.discardedAnalysis),
            tutorResponseDiscarded: Boolean(invalidated.discardedTutorResponse),
          }
        : null,
    });
    return { ...selection, previousRef, changed, invalidated };
  }

  function applyAllRoleModelSelection(modelRef, { source = 'live_settings' } = {}) {
    const selection = resolveTutorModelSelection(modelRef);
    const previousOverrideRef = state.modelRouting.allRolesOverrideRef;
    state.modelRouting.allRolesOverrideRef = selection.modelRef;
    const results = Object.keys(liveModelRoleDefinitions).map((role) =>
      applyRoleModelSelection(role, selection.modelRef, {
        source: `${source}_all_roles`,
        deferEffects: true,
        preserveAllOverride: true,
      }),
    );
    const changed = results.some((result) => result.changed) || previousOverrideRef !== selection.modelRef;
    const invalidated = changed ? resetMixedLearnerSuggestion('all_role_models_changed') : null;
    const remembered = changed ? persistCurrentInteractiveSettings('all_role_models_changed') : null;
    appendTraceEvent(state.trace, {
      type: 'all_role_models_changed',
      schema: 'machinespirits.tutor-stub.all-models-override.v1',
      source,
      modelRef: selection.modelRef,
      changed,
      effectiveTurn: state.turns.length + 1,
      roles: Object.keys(liveModelRoleDefinitions),
      rememberedAt: remembered?.updatedAt || null,
      cacheRefresh: invalidated
        ? {
            priorStateCleared: Boolean(invalidated.hadState),
            analysisDiscarded: Boolean(invalidated.discardedAnalysis),
            tutorResponseDiscarded: Boolean(invalidated.discardedTutorResponse),
          }
        : null,
    });
    return { ...selection, changed, results, invalidated };
  }

  async function pickInitialTutorModelWithKeyboard(defaultRef) {
    const entries = tutorModelChoiceEntries(defaultRef);
    if (!entries.length) return null;
    let selectedIndex = Math.max(
      0,
      entries.findIndex((entry) => entry.ref === defaultRef),
    );
    const viewportHeight = Math.min(entries.length, Math.max(4, Math.min(8, Number(output.rows || 24) - 7)));
    let viewportStart = Math.max(0, Math.min(selectedIndex, entries.length - viewportHeight));
    let renderedLineCount = 0;
    const keepVisible = () => {
      if (selectedIndex < viewportStart) viewportStart = selectedIndex;
      if (selectedIndex >= viewportStart + viewportHeight) viewportStart = selectedIndex - viewportHeight + 1;
    };
    const clearMenu = () => {
      if (!renderedLineCount) return;
      moveCursor(output, 0, -renderedLineCount);
      for (let index = 0; index < renderedLineCount; index += 1) {
        cursorTo(output, 0);
        clearLine(output, 0);
        if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
      }
      if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
      renderedLineCount = 0;
    };
    const render = () => {
      keepVisible();
      clearMenu();
      const width = Math.max(60, Math.min(Number(output.columns || 100), 140));
      const visible = entries.slice(viewportStart, viewportStart + viewportHeight);
      const selected = entries[selectedIndex];
      const lines = [
        `${C.dim}${viewportStart > 0 ? `  ↑ ${viewportStart} more` : '  '}${C.reset}`,
        ...visible.map((entry, offset) => {
          const active = viewportStart + offset === selectedIndex;
          const plain = `${active ? '›' : ' '} ${entry.ref.padEnd(32)} ${oneLine(entry.model, { max: width - 38 })}`;
          return active ? `${C.cyan}${C.bold}${plain}${C.reset}` : plain;
        }),
        `${C.dim}${viewportStart + viewportHeight < entries.length ? `  ↓ ${entries.length - viewportStart - viewportHeight} more` : '  '}${C.reset}`,
        `${C.brightYellow}${C.bold}  uses >${C.reset} ${selected.provider} → ${selected.model} · ${selected.access}`,
      ];
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };
    emitKeypressEvents(input);
    const priorListeners = input.listeners('keypress');
    for (const listener of priorListeners) input.removeListener('keypress', listener);
    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);
    return new Promise((resolve) => {
      const finish = (selection) => {
        input.removeListener('keypress', onKeypress);
        for (const listener of priorListeners) input.on('keypress', listener);
        if (!wasRaw) input.setRawMode(false);
        clearMenu();
        resolve(selection);
      };
      const move = (delta) => {
        selectedIndex = (selectedIndex + delta + entries.length) % entries.length;
        render();
      };
      const onKeypress = (character, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') return finish(null);
        if (key.name === 'up' || character === 'k') return move(-1);
        if (key.name === 'down' || character === 'j') return move(1);
        if (key.name === 'pageup') return move(-viewportHeight);
        if (key.name === 'pagedown') return move(viewportHeight);
        if (key.name === 'home') {
          selectedIndex = 0;
          render();
          return;
        }
        if (key.name === 'end') {
          selectedIndex = entries.length - 1;
          render();
          return;
        }
        if (key.name === 'return' || key.name === 'enter') finish(entries[selectedIndex]);
      };
      input.on('keypress', onKeypress);
      input.resume();
      render();
    });
  }

  function liveSettingsPickerAvailable() {
    return Boolean(input.isTTY && output.isTTY && typeof input.setRawMode === 'function');
  }

  async function pickLiveSettingsActionWithKeyboard(defaultIndex = 0, draft = null) {
    const dropout = tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout);
    const overlays = new Set(draft?.overlays || state.register?.overlays || []);
    const entries = [
      {
        id: 'all_models',
        label: 'One model for all roles',
        value: draft?.allModelsOverrideRef || 'off · roles selected separately',
        description: 'Choose one model for tutor voice, learner interpretation, reasoning, and learner voice.',
      },
      {
        id: 'tutor_model',
        label: 'Tutor voice',
        value: draft?.tutorModelRef || state.modelRef,
        description: 'Choose the model that writes the public tutor response.',
      },
      {
        id: 'classifier_model',
        label: 'Learner interpretation',
        value: `${draft?.classifierModelRef || liveModelRoleRef('classifier')}${
          state.classifier?.combined ? ' · combined/inactive' : state.classifier?.enabled ? '' : ' · inactive'
        }`,
        description: state.classifier?.combined
          ? 'Saved separately, but the reasoning tracker currently performs this interpretation in its combined call.'
          : 'Choose the model that classifies what the learner just said.',
      },
      {
        id: 'reasoning_model',
        label: 'Reasoning tracker',
        value: `${draft?.reasoningModelRef || liveModelRoleRef('reasoning')}${
          state.learnerDag?.enabled ? ' · includes interpretation' : ' · inactive'
        }`,
        description: 'Choose the model that maps the learner turn onto the public reasoning record.',
      },
      {
        id: 'learner_model',
        label: 'Learner voice',
        value: `${draft?.learnerModelRef || liveModelRoleRef('learner')}${
          learnerSuggestionEnabled ? '' : ' · inactive'
        }`,
        description: 'Choose the model that writes automated turns and mixed-mode learner suggestions.',
      },
      {
        id: 'stance_temp',
        label: 'Teaching-style range',
        value: String(draft?.temperature ?? state.register?.temperature ?? registerTemperature),
        description: 'Lower concentrates the strongest teaching style; higher mixes in more alternatives.',
      },
      {
        id: 'dropout',
        label: 'Evidence-memory dropout',
        value: `${draft?.dropoutRate ?? dropout.rate}${state.learnerDag?.enabled ? '' : ' · inactive'}`,
        description:
          'Set the chance that previously understood evidence is temporarily forgotten and can be recovered.',
      },
      {
        id: 'release_speed',
        label: 'Clue release speed',
        value: `${draft?.releaseSpeed ?? state.releasePacing?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED}x`,
        description:
          'Set the baseline pace for new clues. The dialogue can still speed up or slow down when the learner asks.',
      },
      {
        id: 'state_overlay',
        label: 'Turn-change override',
        value: overlays.has('state') ? 'on' : 'off',
        description: 'Let a strong change in the latest learner turn alter the teaching style immediately.',
      },
      {
        id: 'field_overlay',
        label: 'Conversation override',
        value: overlays.has('field') ? 'on' : 'off',
        description: 'Let a strong change in the conversation as a whole alter the teaching style.',
      },
      {
        id: 'overlay_threshold',
        label: 'Override sensitivity',
        value: String(
          draft?.overlayThreshold ??
            state.register?.overlayThreshold ??
            DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
        ),
        description: 'Lower values react more often; higher values wait for a clearer change.',
      },
      {
        id: 'forget',
        label: 'Forget saved settings',
        value: draft?.forgetSavedSettings
          ? 'yes · apply on Done'
          : state.rememberedSettings?.enabled
            ? 'no · remembering on'
            : 'no · nothing saved',
        description: 'Choose whether Done should forget saved defaults; Escape leaves them untouched.',
      },
      {
        id: 'done',
        label: 'Done — apply and return',
        value: 'press Enter',
        description: 'Apply every pending change and return to the current learner or coach prompt.',
      },
    ];
    let selectedIndex = Math.max(0, Math.min(Number(defaultIndex) || 0, entries.length - 1));
    let renderedLineCount = 0;
    const clearMenu = () => {
      if (!renderedLineCount) return;
      moveCursor(output, 0, -renderedLineCount);
      for (let index = 0; index < renderedLineCount; index += 1) {
        cursorTo(output, 0);
        clearLine(output, 0);
        if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
      }
      if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
      renderedLineCount = 0;
    };
    const render = () => {
      clearMenu();
      const width = Math.max(68, Math.min(Number(output.columns || 100), 140));
      const valueWidth = Math.max(16, Math.min(38, Math.floor(width * 0.34)));
      const selected = entries[selectedIndex];
      const entryLines = entries.flatMap((entry, index) => {
        const active = index === selectedIndex;
        const value = oneLine(entry.value, { max: valueWidth }).padEnd(valueWidth);
        const plain = `${active ? '›' : ' '} ${entry.label.padEnd(21)} ${value}`;
        const row = active
          ? `${entry.id === 'done' ? C.brightGreen : C.cyan}${C.bold}${plain}${C.reset}`
          : entry.id === 'done'
            ? `${C.green}${plain}${C.reset}`
            : `${C.dim}${plain}${C.reset}`;
        return entry.id === 'done'
          ? [`${C.dim}  ${'─'.repeat(Math.max(24, Math.min(width - 4, 64)))}${C.reset}`, row]
          : [row];
      });
      const lines = [
        `${C.brightCyan}${C.bold}Settings · choose what to change${C.reset}`,
        `${C.dim}  ↑/↓ move · Enter edit or toggle · Esc discard changes and return${C.reset}`,
        ...entryLines,
        `${C.brightYellow}${C.bold}  about >${C.reset} ${oneLine(selected.description, {
          max: Math.max(44, width - 11),
        })}`,
      ];
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };
    emitKeypressEvents(input);
    const priorListeners = input.listeners('keypress');
    for (const listener of priorListeners) input.removeListener('keypress', listener);
    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);
    return new Promise((resolve) => {
      const finish = (selection) => {
        input.removeListener('keypress', onKeypress);
        for (const listener of priorListeners) input.on('keypress', listener);
        if (!wasRaw) input.setRawMode(false);
        clearMenu();
        resolve(selection);
      };
      const move = (delta) => {
        selectedIndex = (selectedIndex + delta + entries.length) % entries.length;
        render();
      };
      const onKeypress = (character, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') return finish(null);
        if (key.name === 'up' || character === 'k') return move(-1);
        if (key.name === 'down' || character === 'j') return move(1);
        if (key.name === 'home') {
          selectedIndex = 0;
          render();
          return;
        }
        if (key.name === 'end') {
          selectedIndex = entries.length - 1;
          render();
          return;
        }
        if (key.name === 'return' || key.name === 'enter') {
          finish({ ...entries[selectedIndex], index: selectedIndex });
        }
      };
      input.on('keypress', onKeypress);
      input.resume();
      render();
    });
  }

  async function pickLiveNumericSettingWithKeyboard({
    label,
    value,
    min,
    max,
    step,
    coarseStep,
    recommended,
    explanation,
  }) {
    let selected = Number(value);
    let renderedLineCount = 0;
    const precision = Math.max(
      String(step).split('.')[1]?.length || 0,
      String(coarseStep).split('.')[1]?.length || 0,
      2,
    );
    const normalize = (next) => Number(Math.max(min, Math.min(max, next)).toFixed(precision));
    const clearMenu = () => {
      if (!renderedLineCount) return;
      moveCursor(output, 0, -renderedLineCount);
      for (let index = 0; index < renderedLineCount; index += 1) {
        cursorTo(output, 0);
        clearLine(output, 0);
        if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
      }
      if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
      renderedLineCount = 0;
    };
    const render = () => {
      clearMenu();
      const width = Math.max(68, Math.min(Number(output.columns || 100), 140));
      const barWidth = Math.max(18, Math.min(36, width - 42));
      const position = Math.round(((selected - min) / Math.max(max - min, Number.EPSILON)) * barWidth);
      const bar = `${'━'.repeat(position)}●${'─'.repeat(Math.max(0, barWidth - position))}`;
      const lines = [
        `${C.brightCyan}${C.bold}${label}${C.reset}`,
        `${C.cyan}${C.bold}  ${bar}  ${selected}${C.reset}`,
        `${C.dim}  range ${min}–${max} · ←/→ ${step} · PgUp/PgDn ${coarseStep} · R recommended ${recommended}${C.reset}`,
        `${C.brightYellow}${C.bold}  effect >${C.reset} ${oneLine(explanation, { max: Math.max(44, width - 12) })}`,
        `${C.dim}  Enter keep · Esc back · saved only when you choose Done${C.reset}`,
      ];
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };
    emitKeypressEvents(input);
    const priorListeners = input.listeners('keypress');
    for (const listener of priorListeners) input.removeListener('keypress', listener);
    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);
    return new Promise((resolve) => {
      const finish = (next) => {
        input.removeListener('keypress', onKeypress);
        for (const listener of priorListeners) input.on('keypress', listener);
        if (!wasRaw) input.setRawMode(false);
        clearMenu();
        resolve(next);
      };
      const adjust = (delta) => {
        selected = normalize(selected + delta);
        render();
      };
      const onKeypress = (character, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') return finish(null);
        if (key.name === 'left' || key.name === 'down' || character === 'h' || character === 'j') {
          return adjust(-step);
        }
        if (key.name === 'right' || key.name === 'up' || character === 'l' || character === 'k') {
          return adjust(step);
        }
        if (key.name === 'pageup') return adjust(coarseStep);
        if (key.name === 'pagedown') return adjust(-coarseStep);
        if (String(character || '').toLowerCase() === 'r') {
          selected = normalize(recommended);
          render();
          return;
        }
        if (key.name === 'return' || key.name === 'enter') finish(selected);
      };
      input.on('keypress', onKeypress);
      input.resume();
      render();
    });
  }

  async function pickInitialMixedLearnerProfileWithKeyboard(defaultProfileId) {
    const coreIds = new Set(learnerProfileSuiteIds('core'));
    const entries = learnerProfileIds().map((id) => {
      const contract = learnerProfileContract(id);
      const presentation = learnerProfilePickerPresentation(id);
      return {
        id,
        label: contract?.intent?.shortName || id,
        group: presentation?.group || (coreIds.has(id) ? 'core' : 'stress probe'),
        description: presentation?.description || contract?.behaviorContract?.stableFailure?.description || '',
        nearestNeighbor: presentation?.nearestNeighbor || null,
        contrast: presentation?.contrast || null,
      };
    });
    if (!mixedLearner.profileId) {
      entries.unshift({
        id: null,
        label: 'Custom launch profile',
        group: 'custom',
        description: oneLine(mixedLearner.profile, { max: 180 }),
        nearestNeighbor: null,
        contrast: null,
      });
    }
    let selectedIndex = Math.max(
      0,
      entries.findIndex((entry) => (entry.id || 'custom') === defaultProfileId),
    );
    const viewportHeight = Math.min(
      entries.length,
      Math.max(4, Math.min(8, Math.max(4, Number(output.rows || 24) - 8))),
    );
    let viewportStart = Math.max(0, Math.min(selectedIndex, entries.length - viewportHeight));
    let renderedLineCount = 0;

    const keepSelectionVisible = () => {
      if (selectedIndex < viewportStart) viewportStart = selectedIndex;
      if (selectedIndex >= viewportStart + viewportHeight) {
        viewportStart = selectedIndex - viewportHeight + 1;
      }
    };
    const clearRenderedMenu = () => {
      if (!renderedLineCount) return;
      moveCursor(output, 0, -renderedLineCount);
      for (let index = 0; index < renderedLineCount; index += 1) {
        cursorTo(output, 0);
        clearLine(output, 0);
        if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
      }
      if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
      renderedLineCount = 0;
    };
    const renderMenu = () => {
      keepSelectionVisible();
      clearRenderedMenu();
      const width = Math.max(48, Math.min(Number(output.columns || 100), 140));
      const visible = entries.slice(viewportStart, viewportStart + viewportHeight);
      const selectedEntry = entries[selectedIndex];
      const descriptionWidth = Math.max(32, width - 11);
      const lines = [
        `${C.dim}${viewportStart > 0 ? `  ↑ ${viewportStart} more` : '  '}${C.reset}`,
        ...visible.map((entry, visibleIndex) => {
          const absoluteIndex = viewportStart + visibleIndex;
          const selected = absoluteIndex === selectedIndex;
          const id = entry.id || 'custom';
          const plain = `${selected ? '›' : ' '} ${id.padEnd(24)} ${oneLine(entry.label, {
            max: Math.max(12, width - 38),
          })} [${entry.group}]`;
          return selected ? `${C.cyan}${C.bold}${plain}${C.reset}` : plain;
        }),
        `${C.dim}${
          viewportStart + viewportHeight < entries.length
            ? `  ↓ ${entries.length - viewportStart - viewportHeight} more`
            : '  '
        }${C.reset}`,
        `${C.brightYellow}${C.bold}  pattern >${C.reset} ${oneLine(selectedEntry.description, {
          max: descriptionWidth,
        })}`,
        selectedEntry.nearestNeighbor && selectedEntry.contrast
          ? `${C.dim}  differs > from ${selectedEntry.nearestNeighbor}: ${oneLine(selectedEntry.contrast, {
              max: Math.max(24, width - selectedEntry.nearestNeighbor.length - 20),
            })}${C.reset}`
          : `${C.dim}  differs > baseline for ordinary partial reasoning and repair${C.reset}`,
      ];
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };

    emitKeypressEvents(input);
    const priorKeypressListeners = input.listeners('keypress');
    for (const listener of priorKeypressListeners) input.removeListener('keypress', listener);
    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);

    return new Promise((resolve) => {
      const finish = (selection) => {
        input.removeListener('keypress', onKeypress);
        for (const listener of priorKeypressListeners) input.on('keypress', listener);
        if (!wasRaw) input.setRawMode(false);
        clearRenderedMenu();
        resolve(selection);
      };
      const moveSelection = (delta) => {
        selectedIndex = (selectedIndex + delta + entries.length) % entries.length;
        renderMenu();
      };
      const onKeypress = (character, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') {
          finish(null);
          return;
        }
        if (key.name === 'up' || character === 'k') {
          moveSelection(-1);
          return;
        }
        if (key.name === 'down' || character === 'j') {
          moveSelection(1);
          return;
        }
        if (key.name === 'pageup') {
          moveSelection(-viewportHeight);
          return;
        }
        if (key.name === 'pagedown') {
          moveSelection(viewportHeight);
          return;
        }
        if (key.name === 'home') {
          selectedIndex = 0;
          renderMenu();
          return;
        }
        if (key.name === 'end') {
          selectedIndex = entries.length - 1;
          renderMenu();
          return;
        }
        if (key.name === 'return' || key.name === 'enter') finish(entries[selectedIndex]);
      };
      input.on('keypress', onKeypress);
      input.resume();
      renderMenu();
    });
  }

  async function runInitialMixedLearnerSetup() {
    if (!initialMixedLearnerSetupEnabled || !mixedLearner.enabled || !openingEnabled || state.history.length)
      return true;
    const defaultProfileId = mixedLearner.profileId || 'custom';
    const keyboardMenuEnabled = Boolean(input.isTTY && output.isTTY && typeof input.setRawMode === 'function');
    if (initialProfilePromptEnabled) {
      console.log(`${C.cyan}Pick a learner profile${C.reset}`);
      if (keyboardMenuEnabled) {
        console.log(
          `${C.dim}  ↑/↓ scroll · Enter select · highlighted learner described below · Esc quit · ${defaultProfileId} selected by default${C.reset}`,
        );
      } else {
        console.log(`${C.dim}  enter a profile id and press Enter, or press Enter for ${defaultProfileId}${C.reset}`);
        console.log(
          `${C.dim}  browse groups: list = ordinary profiles · stress = stress profiles · all = every profile${C.reset}`,
        );
      }
    }

    const queuedLines = [];
    let resolveNextLine = null;
    const enqueueLine = (line) => {
      if (resolveNextLine) {
        const resolve = resolveNextLine;
        resolveNextLine = null;
        resolve(line);
      } else {
        queuedLines.push(line);
      }
    };
    const nextLine = () =>
      queuedLines.length
        ? Promise.resolve(queuedLines.shift())
        : new Promise((resolve) => {
            resolveNextLine = resolve;
          });
    const onLine = (line) => enqueueLine(line);
    const onSigint = () => enqueueLine('/quit');
    let lineListenersAttached = false;
    const attachLineListeners = () => {
      if (lineListenersAttached) return;
      rl.on('line', onLine);
      rl.on('SIGINT', onSigint);
      lineListenersAttached = true;
    };
    try {
      let profileSelected = !initialProfilePromptEnabled;
      if (initialProfilePromptEnabled && keyboardMenuEnabled) {
        const selection = await pickInitialMixedLearnerProfileWithKeyboard(defaultProfileId);
        if (!selection) {
          requestExit('initial_profile_picker_exit');
          return false;
        }
        applyInitialMixedLearnerProfile(selection.id, {
          usedDefault: (selection.id || 'custom') === defaultProfileId,
          selectionMethod: 'keyboard_menu',
        });
        const selectedLabel = selection.id ? `${selection.id} — ${selection.label}` : `custom — ${selection.label}`;
        console.log(`${C.cyan}learner profile >${C.reset} ${selectedLabel}\n`);
        profileSelected = true;
      } else if (initialProfilePromptEnabled) {
        initialSetupStage = 'profile';
        attachLineListeners();
        while (!exiting) {
          rl.setPrompt(`${C.bold}learner profile [${defaultProfileId}] >${C.reset} `);
          rl.prompt();
          const answer = await nextLine();
          const rawRequested = String(answer || '')
            .trim()
            .toLowerCase();
          if (rawRequested === '/quit' || rawRequested === 'quit' || rawRequested === 'exit') {
            requestExit('initial_profile_picker_exit');
            return false;
          }
          const requested = rawRequested.replace(/^\/profile(?:\s+|$)/u, '');
          const browseScope =
            requested === 'list' || requested === 'core'
              ? 'core'
              : requested === 'stress' || requested === 'list stress'
                ? 'stress'
                : requested === 'all' || requested === 'audit' || requested === 'list all'
                  ? 'all'
                  : null;
          if (browseScope) {
            printMixedLearnerProfileList(browseScope, { picker: true });
            continue;
          }
          if (!requested) {
            applyInitialMixedLearnerProfile(mixedLearner.profileId, {
              usedDefault: true,
              selectionMethod: 'typed_default',
            });
            console.log();
            profileSelected = true;
            break;
          }
          const profileId = requested.replace(/-/gu, '_');
          if (!learnerProfileIds().includes(profileId)) {
            console.log(`${C.red}unknown learner profile: ${requested}${C.reset}`);
            console.log(`${C.dim}  type list, stress, or all to browse; press Enter for ${defaultProfileId}${C.reset}`);
            continue;
          }
          applyInitialMixedLearnerProfile(profileId, {
            usedDefault: false,
            selectionMethod: 'typed_profile_id',
          });
          console.log();
          profileSelected = true;
          break;
        }
      }
      if (!profileSelected || exiting) return false;

      const temperaturePromptEnabled = Boolean(
        initialTemperaturePromptEnabled && state.register?.enabled && registerTemperatureApplies(state.register.policy),
      );
      const dropoutPromptEnabled = Boolean(initialDropoutPromptEnabled && state.learnerDag?.enabled);
      const releaseSpeedPromptEnabled = Boolean(initialReleaseSpeedPromptEnabled && state.world && state.releasePacing);

      const promptForSetting = async ({ stage, label, defaultValue, recommendedValue, guidance, normalize }) => {
        console.log(`${C.dim}  ${guidance}${C.reset}`);
        while (!exiting) {
          initialSetupStage = stage;
          const defaultLabel =
            defaultValue === recommendedValue
              ? `${defaultValue}; recommended`
              : `${defaultValue}; recommended ${recommendedValue}`;
          rl.setPrompt(`${C.bold}${label} [${defaultLabel}] >${C.reset} `);
          rl.prompt();
          const answer = String((await nextLine()) || '').trim();
          if (['/quit', 'quit', 'exit'].includes(answer.toLowerCase())) {
            requestExit('initial_settings_exit');
            return null;
          }
          if (!answer) return { value: defaultValue, usedDefault: true };
          try {
            return { value: normalize(answer), usedDefault: false };
          } catch (error) {
            console.log(`${C.red}setting error:${C.reset} ${error.message}`);
          }
        }
        return null;
      };

      // First-run model selection was removed (user directive 2026-07-12): the
      // launch/default model is used as-is and stays changeable at runtime via
      // `/settings model`. Record the default in the trace so provenance is
      // unchanged; applying the same ref is a no-op that skips the prefetch.
      const appliedTutorModel = applyTutorModelSelection(state.modelRef, {
        source: 'initial_settings',
        usedDefault: true,
      });
      attachLineListeners();

      if (temperaturePromptEnabled || dropoutPromptEnabled || releaseSpeedPromptEnabled) {
        console.log(`${C.cyan}Tune the dialogue${C.reset}`);
        console.log(`${C.dim}  press Enter to accept each launch value; recommendations are shown beside it${C.reset}`);
      }

      let temperatureSelection = null;
      if (temperaturePromptEnabled) {
        temperatureSelection = await promptForSetting({
          stage: 'temperature',
          label: 'teaching-style range',
          defaultValue: state.register.temperature,
          recommendedValue: DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
          guidance: `0.15 strongly concentrates the leading teaching style and part to play; higher values mix in more alternatives (${MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE}-${MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE})`,
          normalize: (value) =>
            normalizeTutorStubEngagementStanceTemperature(value, {
              label: 'teaching-style range',
            }),
        });
        if (!temperatureSelection) return false;
        state.register.temperature = temperatureSelection.value;
        console.log();
      }

      let dropoutSelection = null;
      if (dropoutPromptEnabled) {
        dropoutSelection = await promptForSetting({
          stage: 'dropout',
          label: 'evidence-memory dropout',
          defaultValue: state.learnerDag.dropout.rate,
          recommendedValue: DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
          guidance:
            '0 keeps previously understood evidence reliable; values above 0 simulate occasional, recoverable forgetting (0-1)',
          normalize: (value) => normalizeTutorStubDagFactDropoutRate(value, { label: 'evidence-memory dropout' }),
        });
        if (!dropoutSelection) return false;
        state.learnerDag.dropout.rate = dropoutSelection.value;
        console.log();
      }

      let releaseSpeedSelection = null;
      if (releaseSpeedPromptEnabled) {
        releaseSpeedSelection = await promptForSetting({
          stage: 'release_speed',
          label: 'clue release speed',
          defaultValue: state.releasePacing.baseSpeed,
          recommendedValue: DEFAULT_TUTOR_STUB_RELEASE_SPEED,
          guidance: `1 follows the authored clue schedule; lower slows it and higher brings clues forward (${MIN_TUTOR_STUB_RELEASE_SPEED}-${MAX_TUTOR_STUB_RELEASE_SPEED}). Direct learner requests can adapt it further.`,
          normalize: (value) => normalizeTutorStubReleaseSpeed(value, { label: 'clue release speed' }),
        });
        if (!releaseSpeedSelection) return false;
        setTutorStubReleaseSpeed({
          pacing: state.releasePacing,
          world: state.world,
          speed: releaseSpeedSelection.value,
          turn: state.turns.length + 1,
        });
        console.log();
      }

      appendTraceEvent(state.trace, {
        type: 'mixed_learner_initial_settings_selected',
        schema: 'machinespirits.tutor-stub.initial-dialogue-settings.v1',
        tutorModel: {
          modelRef: appliedTutorModel.modelRef,
          provider: appliedTutorModel.resolved.provider,
          model: appliedTutorModel.resolved.model,
          recommended: STUB.model,
          usedDefault: true,
          selectionSkipped: true,
        },
        engagementStanceTemperature: temperatureSelection
          ? {
              value: temperatureSelection.value,
              recommended: DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
              usedDefault: temperatureSelection.usedDefault,
            }
          : null,
        dagFactDropout: dropoutSelection
          ? {
              value: dropoutSelection.value,
              recommended: DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
              seed: state.learnerDag.dropout.seed,
              usedDefault: dropoutSelection.usedDefault,
            }
          : null,
        clueReleaseSpeed: releaseSpeedSelection
          ? {
              value: releaseSpeedSelection.value,
              recommended: DEFAULT_TUTOR_STUB_RELEASE_SPEED,
              adaptive: true,
              usedDefault: releaseSpeedSelection.usedDefault,
            }
          : null,
      });
      return true;
    } finally {
      initialSetupStage = 'off';
      if (lineListenersAttached) {
        rl.removeListener('line', onLine);
        rl.removeListener('SIGINT', onSigint);
      }
      resolveNextLine = null;
      rl.setPrompt(mixedLearnerPromptText());
    }
  }

  function acceptMixedLearnerSuggestion({ duringTurn = false } = {}) {
    clearStatusLine();
    if (!mixedLearner.enabled) {
      console.log(`${C.dim}learner suggestions are off; start with --mixed-learner to use /use${C.reset}\n`);
      return;
    }
    if (duringTurn) {
      console.log(
        `${C.dim}tutor is still thinking; /use is available once the current tutor response completes${C.reset}\n`,
      );
      return;
    }
    const suggestion = mixedLearner.suggestion;
    if (!suggestion?.text) {
      showMixedLearnerSuggestion({ duringTurn });
      return;
    }
    mixedLearner.suggestion = null;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_suggestion_accepted',
      turn: suggestion.turn,
      turnId: suggestion.turnId,
      requestId: suggestion.requestId,
      text: suggestion.text,
      move: suggestion.move,
      profileId: suggestion.profileId,
      profileSignal: suggestion.profileSignal,
      duringTurn,
    });
    printMixedLearnerProfilePresentation(suggestion, { verb: 'visible in response' });
    console.log(`${C.bold}learner(mixed) >${C.reset} ${suggestion.text}\n`);
    if (processingTurn || duringTurn) {
      if (extendActiveLearnerTurn(suggestion.text)) return;
      pendingLearnerLines.push(suggestion.text);
      console.log(`${C.dim}learner reply queued (${pendingLearnerLines.length} waiting)${C.reset}`);
      return;
    }
    void processLearnerLine(suggestion.text);
  }

  function transcriptPayload() {
    return {
      ...visibleModel,
      tutorInstance: {
        id: state.tutorInstance.id,
        title: state.tutorInstance.title,
        activeRef: state.tuning.activeRef,
        rolePromptHash: state.tutorInstance.rolePromptHash,
      },
      tuning: {
        ...tutorStubTuningSnapshot(state.tuning),
        candidates: listTutorStubTuningCandidates(state.tuning),
      },
      modelRouting: {
        allRolesOverrideRef: state.modelRouting?.allRolesOverrideRef || null,
        roles: Object.fromEntries(
          Object.keys(liveModelRoleDefinitions).map((role) => [role, liveModelRoleSnapshot(role)]),
        ),
      },
      classifier: classifierEnabled ? visibleClassifierConfig : null,
      tutorLearnerDag: tutorLearnerDagEnabled ? visibleLearnerRecordModel : null,
      dagFactDropout: tutorStubDagFactDropoutSnapshot(state.learnerDag.dropout),
      releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
      openingRealization: jsonClone(state.openingRealization),
      registerSelection: registerSelectionEnabled
        ? {
            enabled: true,
            palette: registerPalette,
            policy: tutorStubRegisterPolicyStackId(state.register.policy, state.register.overlays),
            primaryPolicy: state.register.policy,
            overlayPolicies: state.register.overlays,
            overlayThreshold: state.register.overlayThreshold,
            temperature: state.register.temperature,
            history: state.register.history,
          }
        : null,
      dialogueClosure: state.dialogueClosure,
      comprehension: tutorStubComprehensionSnapshot(state.comprehension, { turn: state.turns.length + 1 }),
      interaction: jsonClone(state.interaction),
      turnFeedback: jsonClone(state.turnFeedback),
      explanatoryDebug: jsonClone(state.explanatoryDebug),
      coach: jsonClone(state.coach),
      directorContext,
      trace: traceDisplayPath(state.trace),
      fieldVisualization: state.fieldViz?.lastWrite || null,
      world: worldBundle ? { id: worldBundle.world.id, title: worldBundle.world.title, dag: args.dag } : null,
      turns: state.turns,
    };
  }

  function currentTranscriptHtmlSnapshot() {
    const opening = state.history?.[0]?.role === 'assistant' ? state.history[0].content : null;
    const dropout = tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout);
    const learnerProfile = mixedLearnerProfilePresentation(mixedLearner.suggestion);
    const learnerMode = mixedLearner.enabled ? 'mixed' : 'human';
    const interactionMode = state.interaction?.mode || 'learner';
    const learnerPromptHistory = mixedLearner.enabled ? jsonClone(mixedLearner.promptHistory) : [];
    const nextLearnerTurn = state.turns.length + 1;
    const tutorPromptTurns = state.turns
      .filter((turn) => turn.prompts?.tutor)
      .map((turn) => ({
        turn: turn.turn,
        turnId: turn.turnId,
        ...jsonClone(turn.prompts.tutor),
      }));

    return redactTraceSecrets({
      schema: TUTOR_STUB_TRANSCRIPT_HTML_SCHEMA,
      generatedAt: new Date().toISOString(),
      runId: state.debugRunId,
      title: state.world?.title || state.topic || 'Tutor Stub Transcript',
      directorContext: jsonClone(state.directorContext),
      directorNotes: directorNotesIssuedSoFar(state),
      opening,
      history: jsonClone(state.history),
      turns: jsonClone(state.turns),
      settings: {
        allModelsOverride: state.modelRouting?.allRolesOverrideRef
          ? {
              schema: 'machinespirits.tutor-stub.all-models-override.v1',
              modelRef: state.modelRouting.allRolesOverrideRef,
              roles: Object.keys(liveModelRoleDefinitions),
            }
          : null,
        modelRouting: {
          schema: state.modelRouting?.schema || 'machinespirits.tutor-stub.model-routing.v1',
          allRolesOverrideRef: state.modelRouting?.allRolesOverrideRef || null,
          roles: Object.fromEntries(
            Object.keys(liveModelRoleDefinitions).map((role) => [role, liveModelRoleSnapshot(role)]),
          ),
        },
        run: {
          id: state.debugRunId,
          completedTurns: state.turns.length,
          mode: interactionMode,
          learnerMode,
        },
        world: state.world
          ? {
              id: state.world.id,
              title: state.world.title,
              discipline: state.world.discipline || null,
              question: state.world.question || state.world.publicQuestion || null,
            }
          : {
              id: null,
              title: state.topic,
              discipline: null,
              question: null,
            },
        tutor: {
          instanceId: state.tutorInstance.id,
          instanceTitle: state.tutorInstance.title,
          activeRef: state.tuning.activeRef,
          sourceVersion: state.tutorInstance.sourceVersion,
          rolePromptPath: path.relative(ROOT, state.tutorInstance.rolePromptPath),
          rolePromptHash: state.tutorInstance.rolePromptHash,
          policyPack: jsonClone(state.tutorInstance.policyPack),
          modelRef: state.modelRef,
          provider: state.resolved.provider,
          model: state.resolved.model,
          temperature: state.temperature,
          maxTokens: state.maxTokens,
          cliEffort: state.cliEffort || null,
        },
        classifier: {
          enabled: classifierEnabled,
          combinedWithLearnerDag: combinedLearnerAnalysisEnabled,
          modelRef: args['classifier-model'],
          activeModelRef: classifierEnabled
            ? combinedLearnerAnalysisEnabled
              ? args['learner-record-model']
              : args['classifier-model']
            : null,
          provider: liveModelRoleSnapshot('classifier').resolved.provider,
          model: liveModelRoleSnapshot('classifier').resolved.model,
        },
        learnerRecord: {
          enabled: tutorLearnerDagEnabled,
          modelRef: args['learner-record-model'],
          provider: visibleLearnerRecordModel?.provider || null,
          model: visibleLearnerRecordModel?.model || null,
        },
        learner: {
          mode: learnerMode,
          profileId: mixedLearner.enabled ? learnerProfile.id : null,
          profileName: mixedLearner.enabled ? learnerProfile.name : null,
          profilePattern: mixedLearner.enabled ? learnerProfile.pattern : null,
          modelRef: args['auto-learner-model'],
          provider: visibleAutoLearnerModel?.provider || null,
          model: visibleAutoLearnerModel?.model || null,
        },
        coach: {
          mode: interactionMode === 'coach',
          pending: jsonClone(state.coach?.pending || []),
          applied: jsonClone(state.coach?.history || []),
          publicTranscriptChanged: false,
        },
        turnFeedback: {
          enabled: Boolean(state.turnFeedback?.enabled),
          optional: true,
          pending: tutorStubTurnFeedbackLabel(tutorStubTurnFeedbackEnvelope(state.turnFeedback)),
          completedRatings: jsonClone(state.turnFeedback?.history || []),
          automatedLearner: 'disabled',
          typedReasons: Object.keys(TUTOR_STUB_FEEDBACK_REASONS),
        },
        tuning: {
          ...tutorStubTuningSnapshot(state.tuning),
          candidates: listTutorStubTuningCandidates(state.tuning),
          rawCommentsEnterPrompt: false,
          promotionGate: 'approve_to_canary_then_validate_helpful_then_promote',
        },
        automation: {
          available: Boolean(autoLearnerResolved),
          running: Boolean(state.interaction?.autoRunning),
          modelRef: args['auto-learner-model'],
          provider: visibleAutoLearnerModel?.provider || null,
          model: visibleAutoLearnerModel?.model || null,
          profileId: mixedLearner.profileId || 'custom',
          defaultTurns: autoTurns ?? 'until-grounded',
          safetyTurns: autoSafetyTurns,
          stopOnGrounded: autoStopOnGrounded,
        },
        dag: {
          tutorDagEnabled: Boolean(state.dag),
          learnerDagEnabled: tutorLearnerDagEnabled,
          interpretation: state.dagMode,
          discoursePhase: state.humanDiscourse?.phase || null,
          generousInference: Boolean(state.humanDiscourse?.behaviorChange),
        },
        dagFactDropout: dropout,
        releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
        register: {
          enabled: state.register?.enabled || false,
          policy: tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
          primaryPolicy: state.register?.policy || null,
          overlayPolicies: state.register?.overlays || [],
          overlayThreshold: state.register?.overlayThreshold ?? null,
          palette: state.register?.palette || [],
          engagementStanceTemperature: state.register?.temperature ?? null,
          temperatureScope: 'engagement_stance_and_actorial_part',
          current: state.register?.current || null,
          empiricalPriorStatus: state.register?.empiricalPriorStatus || null,
        },
        rememberedDefaults: {
          enabled: Boolean(state.rememberedSettings?.enabled),
          status: state.rememberedSettings?.status || 'disabled',
          file: path.relative(ROOT, state.rememberedSettings?.filePath || rememberedSettings.filePath),
          loadedAt: state.rememberedSettings?.loadedAt || null,
          savedAt: state.rememberedSettings?.savedAt || null,
          appliedFields: state.rememberedSettings?.appliedFields || [],
          scope: 'human_interactive_sessions_only',
        },
        dialogue: {
          memorySummary: Boolean(state.memory?.enabled),
          rawHistoryTurns: state.historyTurns,
          tutorMessageHistory: {
            mode: state.tutorContext?.historyMode || 'full_public_replay',
            activatedBy: state.tutorContext?.activatedBy || 'session_start',
            activatedAtTurn: state.tutorContext?.activatedAtTurn ?? null,
            publicMessageCount: tutorStubPublicMessagesForSpeaker(state.history, { speaker: 'tutor' }).length,
          },
          multipleChoice: state.multipleChoice,
          opening: {
            enabled: openingEnabled,
            realization: jsonClone(state.openingRealization),
            requirements: TUTOR_STUB_OPENING_REQUIREMENTS,
          },
          closeoutReport: closeoutReportEnabled,
          closure: jsonClone(state.dialogueClosure),
        },
        output: {
          stream: state.stream?.enabled || false,
          trace: state.trace?.enabled ? traceDisplayPath(state.trace) : 'off',
          fieldVisualization: state.fieldViz?.enabled || false,
          explanatoryDebug: jsonClone(state.explanatoryDebug),
          learningSummary: {
            enabled: learningSummaryReportConfig.enabled,
            automaticOnConclusion: learningSummaryReportConfig.enabled,
            requiresCompletedTurn: true,
            publicEvidenceOnly: true,
            launchInInteractiveTty: process.env.TUTOR_STUB_SUMMARY_OPEN !== '0',
          },
          concurrentCommands: {
            enabled: concurrentTerminal.enabled,
            activityLine: 'above_prompt',
            inputLine: 'persistent_bottom_line',
            acceptsDuringAutoMode: true,
          },
        },
      },
      prompts: {
        tutor: {
          baseSystemPrompt: state.systemPrompt,
          namedInstance: {
            id: state.tutorInstance.id,
            title: state.tutorInstance.title,
            activeRef: state.tuning.activeRef,
            rolePrompt: state.tutorInstance.rolePrompt,
            rolePromptHash: state.tutorInstance.rolePromptHash,
            reviewedMemory: tutorStubTuningPrompt(state.tuning),
          },
          turns: tutorPromptTurns,
        },
        learner: {
          mode: learnerMode,
          interactionMode,
          activeSystemPrompt: mixedLearner.enabled
            ? mixedLearnerArtifactsSystemPrompt(mixedLearner.profile)
            : 'Human learner input is active; no learner model system prompt is used.',
          nextUserPrompt: mixedLearner.enabled
            ? buildMixedLearnerArtifactsPrompt({
                state,
                profile: mixedLearner.profile,
                turnNumber: nextLearnerTurn,
              })
            : 'Human learner input is active; no learner model user prompt is used.',
          history: learnerPromptHistory,
        },
      },
    });
  }

  function writeCurrentTranscriptHtml({ launch = true, duringTurn = false } = {}) {
    const filePath = path.join(traceDir, `${state.debugRunId}-transcript.html`);
    const absolute = writeTutorStubTranscriptHtml({
      snapshot: currentTranscriptHtmlSnapshot(),
      filePath,
    });
    const shouldLaunch = launch && process.env.TUTOR_STUB_TRANSCRIPT_OPEN !== '0';
    let launchResult = null;
    if (shouldLaunch) launchResult = launchTutorStubTranscriptHtml(absolute);
    const displayPath = path.relative(ROOT, absolute);
    console.log(`${C.cyan}transcript HTML >${C.reset} ${displayPath}`);
    console.log(
      `${C.dim}  ${shouldLaunch ? 'opened in the default browser' : 'written without opening'}; ${state.turns.length} completed turn${state.turns.length === 1 ? '' : 's'}${duringTurn ? '; the in-progress turn is excluded' : ''}${C.reset}\n`,
    );
    appendTraceEvent(state.trace, {
      type: 'transcript_html_snapshot',
      schema: TUTOR_STUB_TRANSCRIPT_HTML_SCHEMA,
      filePath: displayPath,
      turns: state.turns.length,
      duringTurn,
      launched: Boolean(launchResult),
    });
    return { filePath: absolute, launched: Boolean(launchResult) };
  }

  function writeFinalLearningSummary(reason) {
    if (!learningSummaryReportConfig.enabled) return null;
    if (!state.turns.length) return null;
    const summary = buildDialogueLearningSummary(state, { reason });
    summary.session = {
      learnerProfile: args['auto-learner-profile'] || null,
      tutorInstanceId: state.tutorInstance.id,
      tutorInstanceTitle: state.tutorInstance.title,
      tutorRef: state.tuning.activeRef,
      tutorModelRef: state.modelRef,
      tutorProvider: state.resolved.provider,
      tutorModel: state.resolved.model,
      registerPolicy: tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
      engagementStanceTemperature: state.register?.temperature ?? null,
      dagMode: state.dagMode,
    };
    summary.tuning = {
      ...tutorStubTuningSnapshot(state.tuning),
      candidates: listTutorStubTuningCandidates(state.tuning),
      promotionPolicy: 'candidate -> canary -> helpful replay validation -> stable promotion',
    };
    const filePath = path.join(traceDir, `${state.debugRunId}-learning-summary.html`);
    const absolute = writeTutorStubLearningSummaryHtml({ summary, filePath });
    const shouldLaunch = Boolean(output.isTTY && process.env.TUTOR_STUB_SUMMARY_OPEN !== '0');
    let launchResult = null;
    if (shouldLaunch) launchResult = launchTutorStubTranscriptHtml(absolute);
    const displayPath = path.relative(ROOT, absolute);
    console.log(`${C.brightGreen}${C.bold}learning summary >${C.reset} ${displayPath}`);
    console.log(
      `${C.dim}  ${shouldLaunch ? 'opened in the default browser' : 'written; browser launch is available in an interactive terminal'} · ${summary.turnCount} completed turn${summary.turnCount === 1 ? '' : 's'}${C.reset}\n`,
    );
    appendTraceEvent(state.trace, {
      type: 'learning_summary_html',
      schema: TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA,
      reason,
      filePath: displayPath,
      turns: summary.turnCount,
      natural: summary.completion.natural,
      launched: Boolean(launchResult),
    });
    return { filePath: absolute, launched: Boolean(launchResult), summary };
  }

  function finalizeInteractive(reason) {
    if (finalized) return;
    finalized = true;
    appendTraceEvent(state.trace, {
      type: 'tutor_tuning_session_closed',
      reason,
      tuning: tutorStubTuningSnapshot(state.tuning),
      candidates: listTutorStubTuningCandidates(state.tuning),
      publicTranscriptChanged: false,
    });
    appendTraceEvent(state.trace, {
      type: 'run_end',
      reason,
      turns: state.turns.length,
      mixedLearnerCache: { ...mixedLearner.cacheStats },
    });
    if (closeoutReportEnabled) {
      const report = printDialogueCloseout(state, { reason, trace: state.trace });
      appendTraceEvent(state.trace, { type: 'closeout_report', reason, report });
    }
    if (args.save) {
      saveTranscript(args.save, transcriptPayload());
    }
    try {
      writeFinalLearningSummary(reason);
    } catch (error) {
      console.log(`${C.red}learning summary error:${C.reset} ${error.message}\n`);
      appendTraceEvent(state.trace, { type: 'learning_summary_error', reason, error: error.message });
    }
  }

  function requestExit(reason) {
    exiting = true;
    activeLearnerTurn?.abortController?.abort();
    if (activeAutoRun) activeAutoRun.cancelledReason = reason;
    activeAutoRun?.abortController?.abort();
    if (clarificationInFlight) clarificationInFlight.cancelledReason = reason;
    clarificationInFlight?.abortController?.abort();
    stopInterimAnimation(state);
    concurrentTerminal.close();
    resetMixedLearnerSuggestion(reason);
    finalizeInteractive(reason);
    rl.close();
    resolveInteractive();
  }

  function relaunchArgumentsForScenario(filePath) {
    const current = process.argv.slice(2);
    const next = [];
    const replacedValueOptions = new Set([
      '--all-models',
      '--world',
      '--auto-learner-profile',
      '--model',
      '--classifier-model',
      '--learner-record-model',
      '--auto-learner-model',
      '--register-temperature',
      '--dag-fact-dropout',
      '--release-speed',
      '--register-policy',
      '--register-overlay-threshold',
    ]);
    for (let index = 0; index < current.length; index += 1) {
      const argument = current[index];
      if (argument === '--resume-last') continue;
      if (replacedValueOptions.has(argument)) {
        index += 1;
        continue;
      }
      if ([...replacedValueOptions].some((option) => argument.startsWith(`${option}=`))) continue;
      next.push(argument);
    }
    const modelArguments = state.modelRouting?.allRolesOverrideRef
      ? ['--all-models', state.modelRouting.allRolesOverrideRef]
      : [
          '--model',
          state.modelRef,
          '--classifier-model',
          args['classifier-model'],
          '--learner-record-model',
          args['learner-record-model'],
          '--auto-learner-model',
          args['auto-learner-model'],
        ];
    next.push(
      '--world',
      filePath,
      '--auto-learner-profile',
      state.learnerProfileId || state.learnerProfile,
      ...modelArguments,
      '--register-temperature',
      String(state.register?.temperature ?? registerTemperature),
      '--dag-fact-dropout',
      String(state.learnerDag?.dropout?.rate ?? dagFactDropoutRate),
      '--release-speed',
      String(state.releasePacing?.baseSpeed ?? releaseSpeed),
      '--register-policy',
      tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
      '--register-overlay-threshold',
      String(state.register?.overlayThreshold ?? registerOverlayThreshold),
    );
    return next;
  }

  function relaunchWithScenario(selection, reason = 'scenario_changed') {
    const scenarioId = selection?.id || selection?.world?.id;
    const title = selection?.title || selection?.world?.title;
    const filePath = selection?.filePath;
    if (!scenarioId || !filePath) throw new Error('scenario selection is incomplete');
    persistCurrentInteractiveSettings('scenario_selected', { scenarioId });
    appendTraceEvent(state.trace, {
      type: 'next_scenario_selected',
      reason,
      previousScenarioId: state.world?.id || null,
      scenarioId,
      title,
      file: path.relative(ROOT, filePath),
    });
    awaitingAnotherScenario = false;
    exiting = true;
    stopInterimAnimation(state);
    concurrentTerminal.close();
    resetMixedLearnerSuggestion(reason);
    finalizeInteractive(reason);
    rl.close();
    console.log(`${C.brightGreen}${C.bold}next scenario >${C.reset} ${scenarioId} — ${title}`);
    console.log(`${C.dim}  starting a fresh inquiry with your learner profile and dialogue settings${C.reset}\n`);
    const child = spawnSync(
      process.execPath,
      [fileURLToPath(import.meta.url), ...relaunchArgumentsForScenario(filePath)],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
      },
    );
    if (child.error) {
      console.log(`${C.red}scenario launch error:${C.reset} ${child.error.message}`);
      process.exitCode = 1;
    } else if (child.signal) {
      process.exitCode = 1;
    } else {
      process.exitCode = child.status ?? 0;
    }
    resolveInteractive();
  }

  async function chooseAnotherScenario(argument = '', { reason = 'scenario_changed', duringTurn = false } = {}) {
    clearStatusLine();
    if (duringTurn || processingTurn) {
      console.log(`${C.dim}the scenario picker is available after the current tutor response completes${C.reset}\n`);
      return false;
    }
    let selection = null;
    const requested = String(argument || '').trim();
    if (requested) {
      try {
        const bundle = resolveWorldRef(requested);
        selection = {
          id: bundle.world.id,
          title: bundle.world.title,
          filePath: bundle.filePath,
          world: bundle.world,
        };
      } catch (error) {
        console.log(`${C.red}scenario error:${C.reset} ${error.message}\n`);
        return false;
      }
    } else if (input.isTTY && output.isTTY && typeof input.setRawMode === 'function') {
      scenarioPickerActive = true;
      initialSetupStage = 'scenario';
      console.log(`${C.cyan}Pick another scenario${C.reset}`);
      console.log(`${C.dim}  ↑/↓ scroll · Enter select · highlighted scenario described below · Esc return${C.reset}`);
      try {
        selection = await pickInitialScenarioWithKeyboard(state.world?.id || args.world);
      } finally {
        scenarioPickerActive = false;
        initialSetupStage = 'off';
      }
      if (!selection) {
        rl.setPrompt(
          awaitingAnotherScenario
            ? `${C.brightCyan}${C.bold}another scenario? [y/N] >${C.reset} `
            : mixedLearnerPromptText(),
        );
        console.log(`${C.dim}scenario picker closed; the current inquiry is unchanged${C.reset}\n`);
        return false;
      }
    } else {
      console.log(`${C.cyan}scenario >${C.reset} type /scenario <id> to start another inquiry`);
      console.log(`${C.dim}  run with --list-worlds outside the dialogue to browse scenario ids${C.reset}\n`);
      return false;
    }
    relaunchWithScenario(selection, reason);
    return true;
  }

  function offerAnotherScenario(reason = 'dialogue_grounded_closure') {
    if (awaitingAnotherScenario || exiting) return;
    pendingLearnerLines.length = 0;
    resetMixedLearnerSuggestion(reason);
    finalizeInteractive(reason);
    awaitingAnotherScenario = true;
    rl.setPrompt(`${C.brightCyan}${C.bold}another scenario? [y/N] >${C.reset} `);
    console.log(`${C.brightGreen}${C.bold}scenario complete >${C.reset} would you like to do another scenario?`);
    console.log(
      `${C.dim}  y opens the scenario picker · Enter or n ends the session · /report revisits this inquiry${C.reset}\n`,
    );
    promptIfIdle();
  }

  function interactionModeLabel() {
    const mode = state.interaction?.mode || 'learner';
    if (mode === 'coach') return `${C.brightYellow}${C.bold}COACH${C.reset}`;
    if (mode === 'auto') return `${C.brightBlue}${C.bold}AUTO${C.reset}`;
    return `${C.brightGreen}${C.bold}LEARNER${C.reset}`;
  }

  function printInteractionModeBanner({ detail = true } = {}) {
    const mode = state.interaction?.mode || 'learner';
    const description =
      mode === 'coach'
        ? 'your lines are private suggestions for the next tutor response'
        : mode === 'auto'
          ? 'the automated learner and tutor now play without intervention'
          : 'your lines become public learner speech';
    console.log(`${C.dim}╭─${C.reset} ${interactionModeLabel()} ${C.dim}mode · ${description}${C.reset}`);
    if (detail && mode === 'coach') {
      console.log(
        `${C.dim}╰─ guidance stays out of the public transcript; switch with /learner, or use /use in mixed mode${C.reset}\n`,
      );
    } else if (detail && mode === 'learner') {
      console.log(`${C.dim}╰─ switch with /coach or hand off with /auto [turns]${C.reset}\n`);
    }
  }

  function setInteractionMode(mode, { announce = true } = {}) {
    const normalized = String(mode || '')
      .trim()
      .toLowerCase();
    if (!['learner', 'coach', 'auto'].includes(normalized)) {
      throw new Error('mode must be learner, coach, or auto');
    }
    const previous = state.interaction.mode;
    if (normalized !== 'auto') state.interaction.previousMode = normalized;
    state.interaction.mode = normalized;
    rl.setPrompt(mixedLearnerPromptText());
    appendTraceEvent(state.trace, {
      type: 'interactive_mode_changed',
      previous,
      mode: normalized,
      turn: state.turns.length + 1,
    });
    if (announce) printInteractionModeBanner();
  }

  function printInteractiveStatus() {
    if (state.passthrough?.enabled) {
      console.log(
        `${C.brightCyan}${C.bold}session status >${C.reset} passthrough · turn ${state.turns.length + 1}`,
      );
      console.log(
        `${C.dim}  speaker model: ${state.modelRef} → ${state.resolved.provider}/${state.resolved.model}${C.reset}`,
      );
      console.log(
        `${C.dim}  setup: ${state.world ? `${state.world.id} — ${state.world.title}` : state.topic}; public messages replayed next turn: ${state.history.length}${C.reset}`,
      );
      console.log(
        `${C.dim}  one speaker call per turn · classifier, DAG, register, response checks, releases, feedback, and summaries off${C.reset}\n`,
      );
      return;
    }
    const dropout = tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout);
    const releasePacing = tutorStubReleasePacingSnapshot(state.releasePacing, state.world);
    const profile = mixedLearnerProfilePresentation(mixedLearner.suggestion);
    const policy = tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays);
    const closure = state.dialogueClosure?.phase || 'open';
    const coachPending = state.coach?.pending?.length || 0;
    const suggestion = mixedLearner.enabled
      ? mixedLearner.suggestion?.text
        ? 'ready'
        : mixedLearner.pending
          ? 'warming'
          : 'idle'
      : 'off';
    console.log(
      `${C.brightCyan}${C.bold}session status >${C.reset} ${interactionModeLabel()} · turn ${state.turns.length + 1}`,
    );
    console.log(`${C.dim}  learner: ${profile.id} — ${profile.name}; suggested reply ${suggestion}${C.reset}`);
    console.log(
      `${C.dim}  tutor: ${state.tuning?.activeRef || state.tutorInstance?.ref || 'unpartitioned'} · model ${state.modelRef} → ${state.resolved.provider}/${state.resolved.model}${C.reset}`,
    );
    console.log(
      `${C.dim}  model routing: ${
        state.modelRouting?.allRolesOverrideRef
          ? `one model for all roles (${state.modelRouting.allRolesOverrideRef})`
          : `interpretation ${liveModelRoleRef('classifier')} · reasoning ${liveModelRoleRef('reasoning')} · learner voice ${liveModelRoleRef('learner')}`
      }${C.reset}`,
    );
    console.log(
      `${C.dim}  teaching approach: ${plainPolicyLabel(state.register?.policy)} (${policy}); style range ${state.register?.temperature}; evidence-memory dropout ${dropout.rate}; clue pace ${releasePacing?.baseSpeed ?? 1}x base / ${releasePacing?.effectiveSpeed ?? 1}x now${C.reset}`,
    );
    console.log(
      `${C.dim}  conversation: ${displayDiagnosticLabel(closure)}; private coaching: ${coachPending} waiting, ${state.coach?.history?.length || 0} used${C.reset}`,
    );
    console.log(
      `${C.dim}  tutor ratings: ${state.turnFeedback?.enabled ? `on · ${tutorStubTurnFeedbackLabel(tutorStubTurnFeedbackEnvelope(state.turnFeedback))}` : 'off'} · optional and private${C.reset}`,
    );
    console.log(
      `${C.dim}  tuning: ${state.tuning?.mode || 'off'} · stable v${state.tuning?.manifest?.stableVersion ?? state.tutorInstance?.sourceVersion ?? 1}${state.tuning?.manifest?.canaryVersion ? ` · canary v${state.tuning.manifest.canaryVersion}` : ''} · ${state.tuning?.sessionCandidateIds?.length || 0} session candidates${C.reset}`,
    );
    console.log(
      `${C.dim}  explanations: ${state.explanatoryDebug?.enabled ? `on (${state.explanatoryDebug.format === 'technical' ? 'technical details' : 'plain'})` : 'off'} · commands remain live while models work · /analysis · /transcript · /help${C.reset}\n`,
    );
  }

  function queueCoachGuidance(text, { duringTurn = false } = {}) {
    const guidance = String(text || '').trim();
    if (!guidance) {
      setInteractionMode('coach');
      return null;
    }
    const notBeforeTurn = state.turns.length + (duringTurn || processingTurn ? 2 : 1);
    const entry = {
      id: `coach-${String((state.coach?.pending?.length || 0) + (state.coach?.history?.length || 0) + 1).padStart(3, '0')}`,
      text: guidance,
      createdAt: new Date().toISOString(),
      notBeforeTurn,
    };
    state.coach.pending.push(entry);
    if (!duringTurn && !processingTurn) {
      resetMixedLearnerSuggestion('coach_guidance_added');
    }
    appendTraceEvent(state.trace, {
      type: 'coach_guidance_queued',
      guidance: entry,
      duringTurn: Boolean(duringTurn || processingTurn),
      publicTranscriptChanged: false,
    });
    clearStatusLine();
    console.log(`${C.brightYellow}${C.bold}coach queued >${C.reset} ${guidance}`);
    console.log(
      `${C.dim}  private; applies to tutor turn ${notBeforeTurn}${duringTurn || processingTurn ? ' after the response already in flight' : ''}${C.reset}`,
    );
    if (mixedLearner.enabled && !duringTurn && !processingTurn && latestTutorMessage(state)) {
      startMixedLearnerPrefetch('coach_guidance_added');
      console.log(`${C.dim}  rebuilding the learner suggestion and next tutor response with this guidance${C.reset}`);
    }
    console.log();
    return entry;
  }

  function parseInteractiveAutoTurns(value) {
    const raw = String(value || '')
      .trim()
      .toLowerCase();
    if (!raw || ['until-grounded', 'grounded', 'all'].includes(raw)) return null;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== raw) {
      throw new Error('auto expects a positive turn count or until-grounded');
    }
    return parsed;
  }

  async function runInteractiveAutoMode(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    if (duringTurn || processingTurn) {
      console.log(`${C.dim}auto mode can start after the current tutor response completes${C.reset}\n`);
      return;
    }
    let requestedTurns;
    try {
      requestedTurns = parseInteractiveAutoTurns(argument);
    } catch (error) {
      console.log(`${C.red}auto mode error:${C.reset} ${error.message}\n`);
      return;
    }
    const activeAutoLearnerResolved = state.autoLearner?.resolved || autoLearnerResolved;
    const activeAutoLearnerProviderConfig =
      state.autoLearner?.providerConfig || autoLearnerProviderConfig;
    if (!activeAutoLearnerResolved?.isConfigured && !isCliProvider(activeAutoLearnerResolved?.provider)) {
      const envName = activeAutoLearnerProviderConfig?.api_key_env || 'provider API key';
      console.log(
        `${C.red}auto mode error:${C.reset} ${args['auto-learner-model']} is not configured; set ${envName}\n`,
      );
      return;
    }
    resetMixedLearnerSuggestion('interactive_auto_started');
    const pendingFeedback = tutorStubTurnFeedbackEnvelope(state.turnFeedback);
    clearTutorStubTurnFeedbackTarget(state.turnFeedback);
    if (pendingFeedback.requested) {
      appendTraceEvent(state.trace, {
        type: 'tutor_turn_feedback_cancelled',
        reason: 'automated_learner_handoff',
        feedback: pendingFeedback,
        publicTranscriptChanged: false,
      });
    }
    setInteractionMode('auto', { announce: false });
    state.interaction.autoRunning = true;
    processingTurn = true;
    const active = {
      id: `${stateRunDebugId(state)}:auto:${Date.now()}`,
      abortController: new AbortController(),
      cancelledReason: null,
    };
    activeAutoRun = active;
    const isCurrent = () =>
      !exiting && activeAutoRun === active && !active.abortController.signal.aborted;
    const capLabel =
      requestedTurns === null
        ? `until grounded · safety cap ${autoSafetyTurns}`
        : `${requestedTurns} turn${requestedTurns === 1 ? '' : 's'}`;
    console.log(
      `${C.dim}╭─${C.reset} ${interactionModeLabel()} ${C.dim}mode · ${capLabel} · profile ${mixedLearner.profileId || 'custom'}${C.reset}`,
    );
    console.log(`${C.dim}╰─ tutor and learner now continue from the public transcript${C.reset}\n`);
    appendTraceEvent(state.trace, {
      type: 'interactive_auto_handoff',
      turn: state.turns.length + 1,
      maxTurns: requestedTurns,
      safetyTurns: autoSafetyTurns,
      profileId: mixedLearner.profileId,
    });
    try {
      const result = await runAutomatedLearnerDialogue({
        state,
        firstMessage: '',
        openingEnabled,
        autoLearnerResolved: activeAutoLearnerResolved,
        autoLearnerProfile: mixedLearner.profile,
        autoTurns: requestedTurns,
        autoSafetyTurns,
        autoStopOnGrounded,
        cliEffort,
        signal: active.abortController.signal,
        isCurrent,
      });
      assertTutorStubTurnAttemptCurrent({ signal: active.abortController.signal, isCurrent });
      if (result.reason === 'auto_grounded_closure' || state.dialogueClosure?.phase === 'closed') {
        printWithConcurrentTerminal(state, () =>
          console.log(`${C.brightGreen}${C.bold}automation complete >${C.reset} grounded closure reached\n`),
        );
        offerAnotherScenario('interactive_auto_grounded_closure');
        return;
      }
      const returnMode = state.interaction.previousMode === 'coach' ? 'coach' : 'learner';
      setInteractionMode(returnMode, { announce: false });
      printWithConcurrentTerminal(state, () => {
        console.log(`${C.brightBlue}${C.bold}automation paused >${C.reset} ${result.reason.replaceAll('_', ' ')}`);
        console.log(
          `${C.dim}  ${state.turns.length} total completed turn${state.turns.length === 1 ? '' : 's'}; use /auto to continue${C.reset}\n`,
        );
      });
    } catch (error) {
      if (error?.name === 'AbortError' && active.cancelledReason) {
        appendTraceEvent(state.trace, {
          type: 'interactive_auto_discarded',
          autoRunId: active.id,
          reason: active.cancelledReason,
        });
        return;
      }
      setInteractionMode(state.interaction.previousMode === 'coach' ? 'coach' : 'learner', { announce: false });
      printWithConcurrentTerminal(state, () => console.log(`${C.red}auto mode error:${C.reset} ${error.message}\n`));
      appendTraceEvent(state.trace, { type: 'interactive_auto_error', error: error.message });
    } finally {
      if (activeAutoRun === active) {
        activeAutoRun = null;
        state.interaction.autoRunning = false;
        processingTurn = false;
        if (!exiting) {
          rl.setPrompt(
            awaitingAnotherScenario
              ? `${C.brightCyan}${C.bold}another scenario? [y/N] >${C.reset} `
              : mixedLearnerPromptText(),
          );
        }
      }
    }
  }

  function promptIfIdle() {
    if (!exiting) concurrentTerminal.show();
  }

  async function runClarificationCommand(term = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const latestTutor = latestTutorMessage(state);
    if (!latestTutor) {
      console.log(`${C.cyan}clarify >${C.reset} no tutor message is available yet`);
      console.log(
        `${C.dim}  start the dialogue first, then use /clarify [phrase] after tutor wording that needs explanation${C.reset}\n`,
      );
      appendTraceEvent(state.trace, {
        type: 'clarification_unavailable',
        reason: 'no_tutor_message',
        duringTurn,
      });
      return;
    }
    if (clarificationInFlight) {
      console.log(`${C.dim}clarification is already running; wait for it to finish, then try again${C.reset}\n`);
      appendTraceEvent(state.trace, {
        type: 'clarification_skipped',
        reason: 'already_in_flight',
        duringTurn,
      });
      return;
    }

    const clarificationAttempt = {
      id: `${stateRunDebugId(state)}:clarify:${Date.now()}`,
      abortController: new AbortController(),
      cancelledReason: null,
    };
    clarificationInFlight = clarificationAttempt;
    const requestedTerm = String(term || '').trim();
    const comprehensionRequest = detectTutorStubComprehensionRequest({
      explicitTerm: requestedTerm,
      text: requestedTerm || 'Explain the latest tutor wording.',
      source: 'slash_explain',
      turn: state.turns.length,
    });
    applyTutorStubComprehensionRequest(state.comprehension, comprehensionRequest);
    resetMixedLearnerSuggestion('comprehension_request');
    appendTraceEvent(state.trace, {
      type: 'comprehension_request',
      source: 'slash_explain',
      turn: state.turns.length,
      terms: comprehensionRequest.terms,
      generic: comprehensionRequest.generic,
      text: comprehensionRequest.text,
      advancesLearnerDag: false,
      comprehensionState: tutorStubComprehensionSnapshot(state.comprehension, { turn: state.turns.length }),
    });
    appendTraceEvent(state.trace, {
      type: 'clarification_start',
      term: requestedTerm || null,
      duringTurn,
      turn: state.turns.length,
    });
    try {
      console.log(
        `${C.dim}clarifying${requestedTerm ? ` "${oneLine(requestedTerm, { max: 80 })}"` : ' latest tutor wording'}...${C.reset}`,
      );
      const response = await generateTutorClarification({
        state,
        term: requestedTerm,
        resolved: state.resolved,
        cliEffort: state.cliEffort,
        signal: clarificationAttempt.abortController.signal,
      });
      assertTutorStubTurnAttemptCurrent({
        signal: clarificationAttempt.abortController.signal,
        isCurrent: () => clarificationInFlight === clarificationAttempt,
      });
      printWithConcurrentTerminal(state, () => {
        clearStatusLine();
        console.log(`${C.cyan}clarify >${C.reset} ${response.text}\n`);
        if (duringTurn) {
          console.log(
            `${C.dim}tutor is still thinking; clarification used the latest completed tutor message${C.reset}\n`,
          );
        }
      });
      const comprehensionResponse = applyTutorStubComprehensionResponse(state.comprehension, {
        text: response.text,
        turn: state.turns.length,
        source: 'slash_explain',
        force: true,
        terms: comprehensionRequest.terms,
      });
      appendTraceEvent(state.trace, {
        type: 'comprehension_response',
        source: 'slash_explain',
        turn: state.turns.length,
        explainedTerms: comprehensionResponse.explainedTerms,
        advancesLearnerDag: false,
        comprehensionState: comprehensionResponse.snapshot,
      });
      appendTraceEvent(state.trace, {
        type: 'clarification_complete',
        term: requestedTerm || null,
        duringTurn,
        turn: state.turns.length,
        text: response.text,
        provider: response.provider,
        model: response.model,
        latencyMs: response.latencyMs,
        usage: response.usage,
      });
    } catch (err) {
      if (err?.name === 'AbortError' && clarificationAttempt.cancelledReason) {
        appendTraceEvent(state.trace, {
          type: 'clarification_discarded',
          clarificationId: clarificationAttempt.id,
          reason: clarificationAttempt.cancelledReason,
        });
        return;
      }
      printWithConcurrentTerminal(state, () => {
        clearStatusLine();
        console.log(`${C.red}clarify error:${C.reset} ${err.message}\n`);
      });
      appendTraceEvent(state.trace, {
        type: 'clarification_error',
        term: requestedTerm || null,
        duringTurn,
        turn: state.turns.length,
        error: err.message,
      });
    } finally {
      if (clarificationInFlight === clarificationAttempt) {
        clarificationInFlight = null;
        if (!duringTurn) startMixedLearnerPrefetch('comprehension_state_changed');
      }
    }
  }

  function printInteractiveTutorOpening(opening) {
    if (!opening || exiting) return false;
    printOpeningDebugLine(state);
    printDirectorPreludeBeforeFirstTutor(state, { reason: 'interactive_opening' });
    console.log(`${C.magenta}tutor >${C.reset} ${opening}\n`);
    printTutorFeedbackRequest({
      tutorTurn: 0,
      tutorTurnId: openingDebugId(stateRunDebugId(state)),
      kind: 'opening',
    });
    return true;
  }

  async function emitOpeningPrompt(reason = 'start', { display = true, signal = null } = {}) {
    if (!openingEnabled || state.history.length) return null;
    const openingRealization = await buildTutorOpening(state, { signal });
    const opening = openingRealization.text;
    state.openingRealization = openingRealization;
    state.history.push({ role: 'assistant', content: opening });
    acknowledgeTutorStubOpeningRelease({ pacing: state.releasePacing, world: state.world });
    const turnId = openingDebugId(stateRunDebugId(state));
    appendTraceEvent(state.trace, {
      type: 'tutor_opening',
      turnId,
      reason,
      text: opening,
      realization: openingRealization,
    });
    if (display) printInteractiveTutorOpening(opening);
    return opening;
  }

  function resetInteractiveState() {
    const currentRegisterTemperature =
      state.register?.temperature ?? registerTemperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE;
    const currentRegisterOverlays = [...(state.register?.overlays || registerPolicyOverlays)];
    const currentRegisterOverlayThreshold =
      state.register?.overlayThreshold ?? registerOverlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD;
    const currentDagFactDropout = tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout);
    const currentReleaseSpeed = state.releasePacing?.baseSpeed ?? releaseSpeed;
    state.history = [];
    state.turns = [];
    state.openingRealization = null;
    state.coach = { pending: [], history: [] };
    state.turnFeedback = createTutorStubTurnFeedbackState({ enabled: state.turnFeedback?.enabled !== false });
    mixedLearner.promptHistory = [];
    state.printedDebugIds = new Set();
    state.directorOpeningPresented = false;
    state.tutorContext = {
      schema: 'machinespirits.tutor-stub.tutor-context-policy.v2',
      historyMode: 'full_public_replay',
      activatedBy: 'dialogue_reset',
      activatedAtTurn: null,
      modelRef: state.modelRef,
    };
    state.dialogueClosure = { ...dialogueClosureConfig };
    state.learnerDag = createLearnerDagState({
      enabled: tutorLearnerDagEnabled,
      modelRef: args['learner-record-model'],
      resolved: learnerRecordResolved,
      world: worldBundle?.world || null,
      dropout: {
        rate: currentDagFactDropout.rate,
        seed: currentDagFactDropout.seed,
        graceTurns: currentDagFactDropout.graceTurns,
        maxConcurrent: currentDagFactDropout.maxConcurrent,
      },
    });
    state.comprehension = createTutorStubComprehensionState();
    state.releasePacing = createTutorStubReleasePacingState({
      world: state.world,
      speed: currentReleaseSpeed,
    });
    state.typedActions = {
      enabled: state.typedActions?.enabled || false,
      config: state.typedActions?.config || typedActionConfig,
      ledger: [],
      currentDecision: null,
      scaffoldLifecycle: createScaffoldLifecycle(),
    };
    if (state.fieldViz) state.fieldViz.lastWrite = null;
    state.register = {
      enabled: registerSelectionEnabled,
      palette: registerPalette,
      policy: registerPolicy,
      overlays: currentRegisterOverlays,
      overlayThreshold: currentRegisterOverlayThreshold,
      temperature: currentRegisterTemperature,
      continuousUnsafe: continuousUnsafeRegisterAnchorsEnabled,
      empiricalPrior: registerEmpiricalPrior.prior,
      empiricalPriorStatus: registerEmpiricalPrior.status,
      empiricalPriorPath: registerEmpiricalPrior.filePath,
      current: null,
      history: [],
    };
  }

  async function resetInteractiveDialogue({ command = '/reset', duringTurn = false } = {}) {
    const learnerAttempt = activeLearnerTurn;
    const autoAttempt = activeAutoRun;
    const clarificationAttempt = clarificationInFlight;
    const queuedLearnerLines = pendingLearnerLines.length;
    const interrupted = Boolean(
      learnerAttempt || autoAttempt || clarificationAttempt || duringTurn || processingTurn,
    );

    stopInterimAnimation(state);
    if (learnerAttempt) {
      learnerAttempt.cancelledReason = 'dialogue_reset';
      activeLearnerTurn = null;
      learnerAttempt.abortController?.abort();
    }
    if (autoAttempt) {
      autoAttempt.cancelledReason = 'dialogue_reset';
      activeAutoRun = null;
      autoAttempt.abortController?.abort();
    }
    if (clarificationAttempt) {
      clarificationAttempt.cancelledReason = 'dialogue_reset';
      clarificationInFlight = null;
      clarificationAttempt.abortController.abort();
    }
    processingTurn = false;
    pendingLearnerLines.length = 0;
    awaitingAnotherScenario = false;
    resetMixedLearnerSuggestion('dialogue_reset');
    resetInteractiveState();

    if (state.interaction?.mode === 'auto') {
      state.interaction.mode = state.interaction.previousMode === 'coach' ? 'coach' : 'learner';
    }
    if (state.interaction) state.interaction.autoRunning = false;
    rl.setPrompt(mixedLearnerPromptText());

    appendTraceEvent(state.trace, {
      type: 'history_clear',
      reason: 'dialogue_reset',
      command,
      duringTurn,
      interrupted,
    });
    appendTraceEvent(state.trace, {
      type: 'interactive_dialogue_reset',
      command,
      interrupted,
      interruptedLearnerTurn: learnerAttempt
        ? {
            turn: learnerAttempt.turn,
            turnId: learnerAttempt.turnId,
            revision: learnerAttempt.revision,
            messageCount: learnerAttempt.fragments.length,
          }
        : null,
      interruptedAutoRunId: autoAttempt?.id || null,
      interruptedClarificationId: clarificationAttempt?.id || null,
      queuedLearnerLinesDiscarded: queuedLearnerLines,
      preserved: ['scenario', 'learner_profile', 'settings'],
    });
    clearStatusLine();
    console.log(
      `${C.brightCyan}${C.bold}dialogue reset >${C.reset} ${
        interrupted ? 'unfinished work cancelled; ' : ''
      }starting this scenario again`,
    );
    console.log(`${C.dim}  previous turns discarded · learner profile and settings kept${C.reset}\n`);
    const opening = await emitOpeningPrompt('reset');
    if (opening) startMixedLearnerPrefetch('reset_opening');
    return true;
  }

  function printDialogueSettings() {
    const active = registerTemperatureApplies(state.register?.policy);
    const modelRoles = Object.keys(liveModelRoleDefinitions).map(liveModelRoleSnapshot);
    console.log(`${C.cyan}settings >${C.reset}`);
    console.log(
      `${C.dim}  one model for all roles: ${state.modelRouting?.allRolesOverrideRef || 'off — roles selected separately'}${C.reset}`,
    );
    for (const role of modelRoles) {
      const mode = role.combinedOwner
        ? 'active; also performs learner interpretation'
        : role.active
          ? 'active'
          : role.role === 'classifier' && state.classifier?.combined
            ? 'inactive; combined into reasoning tracker'
            : 'inactive in this mode';
      console.log(
        `${C.dim}  ${role.label.toLowerCase()}: ${role.modelRef} → ${role.resolved.provider}/${role.resolved.model}; ${mode}${C.reset}`,
      );
    }
    console.log(`${C.dim}  tutor effort: ${state.cliEffort || 'provider default'}${C.reset}`);
    console.log(
      `${C.dim}  conversation memory: tutor and learner replay all ${
        tutorStubPublicMessagesForSpeaker(state.history, { speaker: 'tutor' }).length
      } public messages with speaker-relative user/assistant roles${C.reset}`,
    );
    console.log(
      `${C.dim}  teaching approach: ${plainPolicyLabel(state.register?.policy)} (${tutorStubRegisterPolicyStackId(
        state.register?.policy,
        state.register?.overlays,
      )}); turn/conversation overrides ${state.register?.overlays?.join(', ') || 'off'}; sensitivity ${
        state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD
      }${C.reset}`,
    );
    console.log(
      `${C.dim}  teaching-style range: ${state.register?.temperature ?? registerTemperature} — lower concentrates the strongest style and part; higher mixes in more alternatives${C.reset}`,
    );
    console.log(
      `${C.dim}  style range is ${active ? 'active for this approach' : 'saved but not used by this approach'}${C.reset}`,
    );
    const dropout = tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout);
    console.log(
      `${C.dim}  evidence-memory dropout: ${dropout.rate} (${dropout.rate > 0 ? 'on' : 'off'}); currently forgotten ${dropout.activeCount}; understood items tracked ${dropout.adoptedCount}${C.reset}`,
    );
    const pace = tutorStubReleasePacingSnapshot(state.releasePacing, state.world);
    console.log(
      `${C.dim}  clue release speed: ${pace?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED}x base; ${pace?.effectiveSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED}x now (${pace?.direction || 'steady'}); adapts to explicit learner requests${C.reset}`,
    );
    console.log(
      `${C.dim}  reuse these settings next time: ${state.rememberedSettings?.enabled ? 'yes' : 'no'}; ${
        state.rememberedSettings?.status || 'disabled'
      }${C.reset}`,
    );
    console.log(
      `${C.dim}  advanced overrides: /settings policy add state|field · remove state|field · clear · threshold 0.7${C.reset}`,
    );
    console.log(
      `${C.dim}  use /settings models, /settings models all <ref>, /settings model, /settings temp 1.0, /settings dropout 0.15, /settings release-speed 1.5, or /settings forget${C.reset}\n`,
    );
  }

  function printModelChoices(role = 'tutor') {
    const definition = liveModelRoleDefinitions[role];
    const currentRef = liveModelRoleRef(role);
    const entries = tutorModelChoiceEntries(currentRef);
    const visible = entries.slice(0, 16);
    console.log(`${C.cyan}${definition.label.toLowerCase()} models >${C.reset} current ${currentRef}`);
    for (const entry of visible) {
      console.log(
        `${entry.current ? C.brightCyan : C.dim}${entry.current ? '›' : ' '} ${entry.ref.padEnd(34)} ${entry.model} · ${entry.access}${C.reset}`,
      );
    }
    if (entries.length > visible.length) {
      console.log(
        `${C.dim}  … ${entries.length - visible.length} more configured aliases; type /settings model and a prefix, then use Tab${C.reset}`,
      );
    }
    console.log(
      `${C.dim}  choose with /settings models ${definition.setting} <provider.alias>; default restores ${definition.defaultRef}${C.reset}\n`,
    );
  }

  function printTutorModelChoices() {
    printModelChoices('tutor');
  }

  async function chooseLiveTutorModel() {
    console.log(`${C.brightCyan}${C.bold}Tutor model · choose with ↑/↓ and Enter${C.reset}`);
    const selection = await pickInitialTutorModelWithKeyboard(state.modelRef);
    if (!selection) return false;
    await handleDialogueSettings(`model ${selection.ref}`);
    return true;
  }

  async function chooseLiveRoleModel(role) {
    const definition = liveModelRoleDefinitions[role];
    console.log(`${C.brightCyan}${C.bold}${definition.label} · choose with ↑/↓ and Enter${C.reset}`);
    const selection = await pickInitialTutorModelWithKeyboard(liveModelRoleRef(role));
    if (!selection) return false;
    await handleDialogueSettings(`models ${definition.setting} ${selection.ref}`);
    return true;
  }

  async function pickLiveNumericSettingValue(setting, value = undefined) {
    if (setting === 'stance_temp') {
      return pickLiveNumericSettingWithKeyboard({
        label: 'Teaching-style range',
        value: value ?? state.register?.temperature ?? registerTemperature,
        min: MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
        max: MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
        step: 0.05,
        coarseStep: 0.25,
        recommended: DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
        explanation: 'Lower values concentrate the strongest style; higher values retain more alternative signals.',
      });
    }
    if (setting === 'dropout') {
      return pickLiveNumericSettingWithKeyboard({
        label: 'Evidence-memory dropout',
        value: value ?? state.learnerDag?.dropout?.rate ?? DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
        min: 0,
        max: 1,
        step: 0.05,
        coarseStep: 0.1,
        recommended: DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
        explanation: 'Zero keeps understood evidence reliable; higher values simulate recoverable forgetting.',
      });
    }
    if (setting === 'release_speed') {
      return pickLiveNumericSettingWithKeyboard({
        label: 'Clue release speed',
        value: value ?? state.releasePacing?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED,
        min: MIN_TUTOR_STUB_RELEASE_SPEED,
        max: MAX_TUTOR_STUB_RELEASE_SPEED,
        step: 0.05,
        coarseStep: 0.25,
        recommended: DEFAULT_TUTOR_STUB_RELEASE_SPEED,
        explanation: 'One follows the authored schedule; lower slows new clues and higher brings them forward.',
      });
    }
    return pickLiveNumericSettingWithKeyboard({
      label: 'Override sensitivity',
      value: value ?? state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
      min: 0,
      max: 1,
      step: 0.05,
      coarseStep: 0.1,
      recommended: DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
      explanation: 'Lower values react more often; higher values wait for a stronger conversational change.',
    });
  }

  async function chooseLiveNumericSetting(setting) {
    const next = await pickLiveNumericSettingValue(setting);
    if (next === null) return false;
    const command =
      setting === 'stance_temp'
        ? `stance-temp ${next}`
        : setting === 'dropout'
          ? `dropout ${next}`
          : setting === 'release_speed'
            ? `release-speed ${next}`
            : `policy threshold ${next}`;
    await handleDialogueSettings(command);
    return true;
  }

  function createLiveSettingsDraft() {
    return {
      allModelsOverrideRef: state.modelRouting?.allRolesOverrideRef || null,
      tutorModelRef: state.modelRef,
      classifierModelRef: liveModelRoleRef('classifier'),
      reasoningModelRef: liveModelRoleRef('reasoning'),
      learnerModelRef: liveModelRoleRef('learner'),
      temperature: state.register?.temperature ?? registerTemperature,
      dropoutRate: state.learnerDag?.dropout?.rate ?? DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
      releaseSpeed: state.releasePacing?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED,
      overlays: [...(state.register?.overlays || [])],
      overlayThreshold: state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
      forgetSavedSettings: false,
    };
  }

  function liveSettingsDraftChangeIds(draft) {
    const currentOverlays = state.register?.overlays || [];
    const changes = [];
    if (
      draft.allModelsOverrideRef &&
      [draft.tutorModelRef, draft.classifierModelRef, draft.reasoningModelRef, draft.learnerModelRef].every(
        (ref) => ref === draft.allModelsOverrideRef,
      ) &&
      draft.allModelsOverrideRef !== state.modelRouting?.allRolesOverrideRef
    ) {
      changes.push('all_models');
    } else {
      if (draft.tutorModelRef !== state.modelRef) changes.push('tutor_model');
      if (draft.classifierModelRef !== liveModelRoleRef('classifier')) changes.push('classifier_model');
      if (draft.reasoningModelRef !== liveModelRoleRef('reasoning')) changes.push('reasoning_model');
      if (draft.learnerModelRef !== liveModelRoleRef('learner')) changes.push('learner_model');
    }
    if (draft.temperature !== (state.register?.temperature ?? registerTemperature)) changes.push('stance_temp');
    if (
      draft.dropoutRate !==
      (state.learnerDag?.dropout?.rate ?? DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE)
    ) {
      changes.push('dropout');
    }
    if (draft.releaseSpeed !== (state.releasePacing?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED)) {
      changes.push('release_speed');
    }
    if (
      currentOverlays.length !== draft.overlays.length ||
      currentOverlays.some((overlay) => !draft.overlays.includes(overlay))
    ) {
      changes.push('overlays');
    }
    if (
      draft.overlayThreshold !==
      (state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD)
    ) {
      changes.push('overlay_threshold');
    }
    if (draft.forgetSavedSettings) changes.push('forget');
    return changes;
  }

  async function applyLiveSettingsDraft(draft) {
    const changes = liveSettingsDraftChangeIds(draft);
    if (changes.includes('all_models')) {
      await handleDialogueSettings(`models all ${draft.allModelsOverrideRef}`);
    } else {
      if (changes.includes('tutor_model')) await handleDialogueSettings(`models tutor ${draft.tutorModelRef}`);
      if (changes.includes('classifier_model')) {
        await handleDialogueSettings(`models classifier ${draft.classifierModelRef}`);
      }
      if (changes.includes('reasoning_model')) {
        await handleDialogueSettings(`models reasoning ${draft.reasoningModelRef}`);
      }
      if (changes.includes('learner_model')) await handleDialogueSettings(`models learner ${draft.learnerModelRef}`);
    }
    if (changes.includes('stance_temp')) await handleDialogueSettings(`stance-temp ${draft.temperature}`);
    if (changes.includes('dropout')) await handleDialogueSettings(`dropout ${draft.dropoutRate}`);
    if (changes.includes('release_speed')) await handleDialogueSettings(`release-speed ${draft.releaseSpeed}`);
    if (changes.includes('overlays')) {
      const currentOverlays = [...(state.register?.overlays || [])];
      for (const overlay of currentOverlays.filter((entry) => !draft.overlays.includes(entry))) {
        await handleDialogueSettings(`policy remove ${overlay}`);
      }
      for (const overlay of draft.overlays.filter((entry) => !currentOverlays.includes(entry))) {
        await handleDialogueSettings(`policy add ${overlay}`);
      }
    }
    if (changes.includes('overlay_threshold')) {
      await handleDialogueSettings(`policy threshold ${draft.overlayThreshold}`);
    }
    if (changes.includes('forget')) await handleDialogueSettings('forget');
    return changes;
  }

  async function openLiveSettingsPanel() {
    const draft = createLiveSettingsDraft();
    appendTraceEvent(state.trace, {
      type: 'settings_panel_opened',
      turn: state.turns.length + 1,
      modelRef: state.modelRef,
      policyStack: tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
    });
    let selectedIndex = 0;
    let reason = 'cancelled';
    let changedSettings = [];
    while (!exiting) {
      const action = await pickLiveSettingsActionWithKeyboard(selectedIndex, draft);
      if (!action) {
        reason = 'cancelled';
        changedSettings = liveSettingsDraftChangeIds(draft);
        break;
      }
      selectedIndex = action.index;
      if (action.id === 'done') {
        changedSettings = await applyLiveSettingsDraft(draft);
        reason = changedSettings.length ? 'applied' : 'unchanged';
        break;
      }
      appendTraceEvent(state.trace, {
        type: 'settings_panel_action_selected',
        action: action.id,
        turn: state.turns.length + 1,
      });
      if (
        action.id === 'all_models' ||
        action.id === 'tutor_model' ||
        action.id === 'classifier_model' ||
        action.id === 'reasoning_model' ||
        action.id === 'learner_model'
      ) {
        const role =
          action.id === 'all_models'
            ? 'all'
            : action.id === 'tutor_model'
              ? 'tutor'
              : action.id === 'classifier_model'
                ? 'classifier'
                : action.id === 'reasoning_model'
                  ? 'reasoning'
                  : 'learner';
        const label = role === 'all' ? 'One model for all roles' : liveModelRoleDefinitions[role].label;
        const currentRef =
          role === 'all'
            ? draft.allModelsOverrideRef || draft.tutorModelRef
            : role === 'tutor'
              ? draft.tutorModelRef
              : role === 'classifier'
                ? draft.classifierModelRef
                : role === 'reasoning'
                  ? draft.reasoningModelRef
                  : draft.learnerModelRef;
        console.log(`${C.brightCyan}${C.bold}${label} · choose with ↑/↓ and Enter${C.reset}`);
        console.log(`${C.dim}  Esc back · saved only when you choose Done${C.reset}`);
        const selection = await pickInitialTutorModelWithKeyboard(currentRef);
        if (selection && role === 'all') {
          draft.allModelsOverrideRef = selection.ref;
          draft.tutorModelRef = selection.ref;
          draft.classifierModelRef = selection.ref;
          draft.reasoningModelRef = selection.ref;
          draft.learnerModelRef = selection.ref;
        } else if (selection) {
          draft.allModelsOverrideRef = null;
          if (role === 'tutor') draft.tutorModelRef = selection.ref;
          else if (role === 'classifier') draft.classifierModelRef = selection.ref;
          else if (role === 'reasoning') draft.reasoningModelRef = selection.ref;
          else draft.learnerModelRef = selection.ref;
        }
      } else if (
        action.id === 'stance_temp' ||
        action.id === 'dropout' ||
        action.id === 'release_speed' ||
        action.id === 'overlay_threshold'
      ) {
        const draftValue =
          action.id === 'stance_temp'
            ? draft.temperature
            : action.id === 'dropout'
              ? draft.dropoutRate
              : action.id === 'release_speed'
                ? draft.releaseSpeed
                : draft.overlayThreshold;
        const next = await pickLiveNumericSettingValue(action.id, draftValue);
        if (next !== null) {
          if (action.id === 'stance_temp') draft.temperature = next;
          else if (action.id === 'dropout') draft.dropoutRate = next;
          else if (action.id === 'release_speed') draft.releaseSpeed = next;
          else draft.overlayThreshold = next;
        }
      } else if (action.id === 'state_overlay' || action.id === 'field_overlay') {
        const overlay = action.id === 'state_overlay' ? 'state' : 'field';
        draft.overlays = draft.overlays.includes(overlay)
          ? draft.overlays.filter((entry) => entry !== overlay)
          : [...draft.overlays, overlay];
      } else if (action.id === 'forget') {
        draft.forgetSavedSettings = !draft.forgetSavedSettings;
      }
    }
    appendTraceEvent(state.trace, {
      type: 'settings_panel_closed',
      reason,
      changedSettings,
      changesDiscarded: reason === 'cancelled' ? changedSettings : [],
      turn: state.turns.length + 1,
      modelRef: state.modelRef,
      policyStack: tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
    });
    if (reason === 'cancelled') {
      console.log(
        `${C.dim}settings cancelled · ${changedSettings.length ? 'unsaved changes discarded' : 'nothing changed'}${C.reset}\n`,
      );
    } else {
      console.log(
        `${C.dim}${reason === 'applied' ? 'settings applied' : 'settings unchanged'} · returning to dialogue${C.reset}\n`,
      );
    }
  }

  async function handleDialogueSettings(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const parts = String(argument || '')
      .trim()
      .split(/\s+/u)
      .filter(Boolean);
    const temperatureNames = ['temp', 'temperature', 'stance-temp'];
    const dropoutNames = ['dropout', 'dag-dropout', 'dag-fact-dropout'];
    const releaseSpeedNames = ['release-speed', 'release_speed', 'pace', 'speed'];
    const modelNames = ['model', 'tutor-model'];
    const modelRoleAliases = {
      tutor: 'tutor',
      speaker: 'tutor',
      classifier: 'classifier',
      interpretation: 'classifier',
      assessment: 'classifier',
      reasoning: 'reasoning',
      tracker: 'reasoning',
      'learner-record': 'reasoning',
      learner: 'learner',
      'learner-voice': 'learner',
      auto: 'learner',
    };
    if (state.passthrough?.enabled && !parts.length) {
      console.log(`${C.cyan}passthrough settings >${C.reset}`);
      console.log(
        `${C.dim}  speaker model: ${state.modelRef} → ${state.resolved.provider}/${state.resolved.model}; effort ${state.cliEffort || 'provider default'}${C.reset}`,
      );
      console.log(
        `${C.dim}  use /settings model or /settings model <provider.alias>; all teaching-policy settings are bypassed${C.reset}\n`,
      );
      return;
    }
    if (state.passthrough?.enabled && !modelNames.includes(String(parts[0] || '').toLowerCase())) {
      console.log(
        `${C.dim}only the speaker model is adjustable in passthrough mode; use /settings model [provider.alias]${C.reset}\n`,
      );
      return;
    }
    if (!parts.length) {
      if (liveSettingsPickerAvailable() && !duringTurn) {
        await openLiveSettingsPanel();
      } else {
        printDialogueSettings();
        if (duringTurn && liveSettingsPickerAvailable()) {
          console.log(`${C.dim}  interactive editing is available after the current tutor turn completes${C.reset}\n`);
        }
      }
      return;
    }
    if (parts.length === 1 && modelNames.includes(parts[0].toLowerCase())) {
      if (liveSettingsPickerAvailable() && !duringTurn) await chooseLiveTutorModel();
      else printTutorModelChoices();
      return;
    }
    if (
      parts.length === 1 &&
      [...temperatureNames, ...dropoutNames, ...releaseSpeedNames].includes(parts[0].toLowerCase())
    ) {
      if (liveSettingsPickerAvailable() && !duringTurn) {
        const requested = parts[0].toLowerCase();
        await chooseLiveNumericSetting(
          temperatureNames.includes(requested)
            ? 'stance_temp'
            : releaseSpeedNames.includes(requested)
              ? 'release_speed'
              : 'dropout',
        );
      } else {
        printDialogueSettings();
      }
      return;
    }
    const setting = parts[0].toLowerCase();
    if (setting === 'models') {
      if (parts.length === 1) {
        printDialogueSettings();
        return;
      }
      const requestedRole = String(parts[1] || '').toLowerCase();
      const role = modelRoleAliases[requestedRole] || null;
      if (requestedRole !== 'all' && !role) {
        console.log(
          `${C.red}settings error:${C.reset} use /settings models all|tutor|classifier|reasoning|learner [provider.alias]\n`,
        );
        return;
      }
      if (parts.length === 2) {
        if (liveSettingsPickerAvailable() && !duringTurn) {
          if (requestedRole === 'all') {
            console.log(`${C.brightCyan}${C.bold}One model for all roles · choose with ↑/↓ and Enter${C.reset}`);
            const selection = await pickInitialTutorModelWithKeyboard(
              state.modelRouting?.allRolesOverrideRef || state.modelRef,
            );
            if (selection) await handleDialogueSettings(`models all ${selection.ref}`);
          } else {
            await chooseLiveRoleModel(role);
          }
        } else if (requestedRole === 'all') {
          printTutorModelChoices();
        } else {
          printModelChoices(role);
        }
        return;
      }
      if (parts.length !== 3) {
        console.log(
          `${C.red}settings error:${C.reset} use /settings models all|tutor|classifier|reasoning|learner <provider.alias>\n`,
        );
        return;
      }
      if (duringTurn) {
        console.log(`${C.dim}model routing is unchanged while a tutor turn is in progress${C.reset}`);
        console.log(`${C.dim}  change it after the response so each turn uses one stable route${C.reset}\n`);
        appendTraceEvent(state.trace, {
          type: 'role_model_change_rejected',
          reason: 'turn_in_progress',
          role: requestedRole,
          requested: parts[2],
          turn: state.turns.length + 1,
        });
        return;
      }
      const defaultRef =
        requestedRole === 'all'
          ? STUB.model
          : liveModelRoleDefinitions[role].defaultRef;
      const requestedRef = parts[2].toLowerCase() === 'default' ? defaultRef : parts[2];
      let selected;
      try {
        selected =
          requestedRole === 'all'
            ? applyAllRoleModelSelection(requestedRef, { source: 'live_settings' })
            : applyRoleModelSelection(role, requestedRef, { source: 'live_settings' });
      } catch (error) {
        console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
        return;
      }
      const label = requestedRole === 'all' ? 'all roles' : liveModelRoleDefinitions[role].label.toLowerCase();
      if (!selected.changed && state.modelRouting?.allRolesOverrideRef === requestedRef) {
        console.log(`${C.cyan}settings >${C.reset} ${label} already use ${selected.modelRef}\n`);
        return;
      }
      console.log(
        `${C.cyan}settings >${C.reset} ${label} → ${selected.modelRef}; applies from turn ${state.turns.length + 1}`,
      );
      console.log(`${C.dim}  resolved as ${selected.resolved.provider}/${selected.resolved.model}${C.reset}`);
      if (requestedRole === 'all') {
        console.log(`${C.dim}  tutor, interpretation, reasoning tracker, and learner voice now share this model${C.reset}`);
      } else {
        console.log(`${C.dim}  other model roles keep their current selections${C.reset}`);
      }
      if (latestTutorMessage(state)) {
        startMixedLearnerPrefetch(`${requestedRole}_model_changed`);
        console.log(`${C.dim}  rebuilding any affected learner suggestion, analysis, and prefetched tutor reply${C.reset}`);
      }
      console.log();
      return;
    }
    if (setting === 'forget' && parts.length === 1) {
      if (duringTurn) {
        console.log(`${C.dim}saved settings cannot be changed while the tutor is responding${C.reset}\n`);
        return;
      }
      const forgotten = forgetRememberedInteractiveSettings({ source: 'live_settings' });
      console.log(
        `${C.cyan}settings >${C.reset} ${forgotten.existed ? 'saved settings forgotten' : 'there were no saved settings'}`,
      );
      console.log(`${C.dim}  this conversation is unchanged; the next one starts from its launch settings${C.reset}\n`);
      return;
    }
    if (modelNames.includes(setting)) {
      if (parts.length !== 2) {
        console.log(`${C.red}settings error:${C.reset} use /settings model or /settings model <provider.alias>\n`);
        return;
      }
      if (duringTurn) {
        console.log(`${C.dim}tutor model is unchanged while a tutor turn is in progress${C.reset}`);
        console.log(`${C.dim}  change it after the response so the whole turn uses one model${C.reset}\n`);
        appendTraceEvent(state.trace, {
          type: 'tutor_model_change_rejected',
          reason: 'turn_in_progress',
          requested: parts[1],
          turn: state.turns.length + 1,
        });
        return;
      }
      const requestedRef = parts[1].toLowerCase() === 'default' ? STUB.model : parts[1];
      let selected;
      try {
        selected = applyTutorModelSelection(requestedRef, { source: 'live_settings' });
      } catch (error) {
        console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
        return;
      }
      if (!selected.changed) {
        console.log(`${C.cyan}settings >${C.reset} tutor model already ${selected.modelRef}\n`);
        return;
      }
      console.log(
        `${C.cyan}settings >${C.reset} tutor model ${selected.previousRef || 'previous'} → ${selected.modelRef}; applies from turn ${state.turns.length + 1}`,
      );
      console.log(`${C.dim}  resolved as ${selected.resolved.provider}/${selected.resolved.model}${C.reset}`);
      console.log(
        `${C.dim}  the new tutor model will continue replaying all ${
          tutorStubPublicMessagesForSpeaker(state.history, { speaker: 'tutor' }).length
        } earlier public messages before every later response${C.reset}`,
      );
      if (mixedLearner.enabled && latestTutorMessage(state)) {
        startMixedLearnerPrefetch('tutor_model_changed');
        console.log(`${C.dim}  rebuilding the learner suggestion, its analysis, and the next tutor response${C.reset}`);
      }
      console.log();
      return;
    }
    if (setting === 'policy' || setting === 'policies' || setting === 'overlay' || setting === 'overlays') {
      if (parts.length === 1) {
        printDialogueSettings();
        return;
      }
      if (duringTurn) {
        console.log(`${C.dim}teaching-style overrides cannot be changed while the tutor is responding${C.reset}`);
        console.log(`${C.dim}  change them afterward so the whole turn uses one set of settings${C.reset}\n`);
        appendTraceEvent(state.trace, {
          type: 'register_policy_composition_change_rejected',
          reason: 'turn_in_progress',
          requested: parts.slice(1),
          turn: state.turns.length + 1,
        });
        return;
      }
      const action = String(parts[1] || '').toLowerCase();
      let nextOverlays = [...(state.register?.overlays || [])];
      let nextThreshold = state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD;
      try {
        if (action === 'add') {
          const overlay = String(parts[2] || '')
            .toLowerCase()
            .replace(/-/gu, '_');
          if (parts.length !== 3 || !TUTOR_STUB_REGISTER_OVERLAY_POLICIES.includes(overlay)) {
            throw new Error(`policy add expects ${TUTOR_STUB_REGISTER_OVERLAY_POLICIES.join(' or ')}`);
          }
          nextOverlays = [...new Set([...nextOverlays, overlay])];
        } else if (action === 'remove') {
          const overlay = String(parts[2] || '')
            .toLowerCase()
            .replace(/-/gu, '_');
          if (parts.length !== 3 || !TUTOR_STUB_REGISTER_OVERLAY_POLICIES.includes(overlay)) {
            throw new Error(`policy remove expects ${TUTOR_STUB_REGISTER_OVERLAY_POLICIES.join(' or ')}`);
          }
          nextOverlays = nextOverlays.filter((entry) => entry !== overlay);
        } else if (action === 'clear') {
          if (parts.length !== 2) throw new Error('policy clear takes no additional argument');
          nextOverlays = [];
        } else if (action === 'threshold') {
          if (parts.length !== 3) throw new Error('policy threshold expects one number from 0 to 1');
          nextThreshold = normalizeTutorStubRegisterOverlayThreshold(parts[2], {
            label: 'register overlay threshold',
          });
        } else {
          throw new Error('use policy add <state|field>, remove <state|field>, clear, or threshold <0-1>');
        }
        parseTutorStubRegisterPolicyStack(tutorStubRegisterPolicyStackId(state.register.policy, nextOverlays));
      } catch (error) {
        console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
        return;
      }
      const previous = {
        overlays: [...(state.register?.overlays || [])],
        threshold: state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
      };
      const unchanged =
        previous.threshold === nextThreshold &&
        previous.overlays.length === nextOverlays.length &&
        previous.overlays.every((overlay, index) => overlay === nextOverlays[index]);
      if (unchanged) {
        console.log(
          `${C.cyan}settings >${C.reset} teaching approach is already ${tutorStubRegisterPolicyStackId(
            state.register.policy,
            state.register.overlays,
          )}; override sensitivity ${nextThreshold}\n`,
        );
        return;
      }
      state.register.overlays = nextOverlays;
      state.register.overlayThreshold = nextThreshold;
      const invalidated = resetMixedLearnerSuggestion('register_policy_composition_changed');
      const remembered = persistCurrentInteractiveSettings('register_policy_composition_changed');
      appendTraceEvent(state.trace, {
        type: 'register_policy_composition_changed',
        schema: TUTOR_STUB_REGISTER_POLICY_COMPOSITION_SCHEMA,
        primaryPolicy: state.register.policy,
        previous,
        overlays: nextOverlays,
        threshold: nextThreshold,
        policyStack: tutorStubRegisterPolicyStackId(state.register.policy, nextOverlays),
        effectiveTurn: state.turns.length + 1,
        rememberedAt: remembered?.updatedAt || null,
        cacheRefresh: {
          priorStateCleared: Boolean(invalidated?.hadState),
          analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
          tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
        },
      });
      console.log(
        `${C.cyan}settings >${C.reset} teaching approach ${tutorStubRegisterPolicyStackId(
          state.register.policy,
          nextOverlays,
        )}; override sensitivity ${nextThreshold}; applies from turn ${state.turns.length + 1}`,
      );
      console.log(
        `${C.dim}  the normal approach selects first; a strong turn or conversation change can override it${C.reset}`,
      );
      if (mixedLearner.enabled && latestTutorMessage(state)) {
        startMixedLearnerPrefetch('register_policy_composition_changed');
        console.log(`${C.dim}  rebuilding the learner suggestion, its analysis, and the next tutor response${C.reset}`);
      }
      console.log();
      return;
    }
    if (![...temperatureNames, ...dropoutNames, ...releaseSpeedNames].includes(setting) || parts.length !== 2) {
      console.log(
        `${C.red}settings error:${C.reset} use /settings, /settings model [provider.alias], /settings stance-temp <n>, /settings dropout <0-1>, /settings release-speed <0.5-2>, /settings policy add <state|field>, or /settings forget`,
      );
      console.log(
        `${C.dim}  examples: /settings model codex.gpt-5.6-luna | /settings temp 0.4 | /settings dropout 0.15 | /settings release-speed 1.5${C.reset}\n`,
      );
      return;
    }
    if (duringTurn) {
      console.log(`${C.dim}dialogue settings cannot be changed while the tutor is responding${C.reset}`);
      console.log(`${C.dim}  change them afterward so the whole turn uses one value${C.reset}\n`);
      appendTraceEvent(state.trace, {
        type: 'dialogue_setting_change_rejected',
        setting,
        reason: 'turn_in_progress',
        requested: parts[1],
        turn: state.turns.length + 1,
      });
      return;
    }

    if (dropoutNames.includes(setting)) {
      let nextRate;
      try {
        nextRate = normalizeTutorStubDagFactDropoutRate(parts[1], { label: 'evidence-memory dropout' });
      } catch (error) {
        console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
        return;
      }
      const previousRate = state.learnerDag.dropout.rate;
      if (nextRate === previousRate) {
        console.log(`${C.cyan}settings >${C.reset} evidence-memory dropout is already ${nextRate}\n`);
        return;
      }
      state.learnerDag.dropout.rate = nextRate;
      const invalidated = resetMixedLearnerSuggestion('dag_fact_dropout_changed');
      const remembered = persistCurrentInteractiveSettings('dag_fact_dropout_changed');
      appendTraceEvent(state.trace, {
        type: 'dag_fact_dropout_changed',
        schema: 'machinespirits.tutor-stub.dag-fact-dropout-change.v1',
        previous: previousRate,
        rate: nextRate,
        seed: state.learnerDag.dropout.seed,
        effectiveTurn: state.turns.length + 1,
        activeDroppedCount: Object.keys(state.learnerDag.dropout.activeDropped || {}).length,
        rememberedAt: remembered?.updatedAt || null,
        cacheRefresh: {
          priorStateCleared: Boolean(invalidated?.hadState),
          analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
          tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
        },
      });
      console.log(
        `${C.cyan}settings >${C.reset} evidence-memory dropout ${previousRate} → ${nextRate}; applies from turn ${state.turns.length + 1}`,
      );
      console.log(
        `${C.dim}  ${nextRate === 0 ? 'new forgetting is off; anything already forgotten can still be recalled in dialogue or reset with /reset' : 'previously understood evidence can now be temporarily forgotten at this per-turn rate'}${C.reset}`,
      );
      if (!state.learnerDag.enabled) {
        console.log(`${C.dim}  saved but inactive because learner evidence tracking is off${C.reset}`);
      }
      if (mixedLearner.enabled && latestTutorMessage(state)) {
        startMixedLearnerPrefetch('dag_fact_dropout_changed');
        console.log(`${C.dim}  rebuilding the learner suggestion, its analysis, and the next tutor response${C.reset}`);
      }
      console.log();
      return;
    }

    if (releaseSpeedNames.includes(setting)) {
      let nextSpeed;
      try {
        nextSpeed = normalizeTutorStubReleaseSpeed(parts[1], { label: 'clue release speed' });
      } catch (error) {
        console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
        return;
      }
      const previousSpeed = state.releasePacing?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED;
      if (nextSpeed === previousSpeed) {
        console.log(`${C.cyan}settings >${C.reset} clue release speed is already ${nextSpeed}x\n`);
        return;
      }
      const releasePacing = setTutorStubReleaseSpeed({
        pacing: state.releasePacing,
        world: state.world,
        speed: nextSpeed,
        turn: state.turns.length + 1,
      });
      const invalidated = resetMixedLearnerSuggestion('release_speed_changed');
      const remembered = persistCurrentInteractiveSettings('release_speed_changed');
      appendTraceEvent(state.trace, {
        type: 'release_speed_changed',
        schema: 'machinespirits.tutor-stub.release-speed-change.v1',
        previous: previousSpeed,
        speed: nextSpeed,
        effectiveSpeed: releasePacing?.effectiveSpeed ?? nextSpeed,
        effectiveTurn: state.turns.length + 1,
        rememberedAt: remembered?.updatedAt || null,
        releasePacing,
        cacheRefresh: {
          priorStateCleared: Boolean(invalidated?.hadState),
          analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
          tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
        },
      });
      console.log(
        `${C.cyan}settings >${C.reset} clue release speed ${previousSpeed}x → ${nextSpeed}x; applies from turn ${state.turns.length + 1}`,
      );
      console.log(
        `${C.dim}  1x follows the authored schedule; the learner can still ask to move faster or slow down${C.reset}`,
      );
      if (mixedLearner.enabled && latestTutorMessage(state)) {
        startMixedLearnerPrefetch('release_speed_changed');
        console.log(`${C.dim}  rebuilding the learner suggestion, its analysis, and the next tutor response${C.reset}`);
      }
      console.log();
      return;
    }

    let nextTemperature;
    try {
      nextTemperature = normalizeTutorStubEngagementStanceTemperature(parts[1], {
        label: 'teaching-style range',
      });
    } catch (error) {
      console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
      return;
    }
    const previousTemperature = state.register?.temperature ?? registerTemperature;
    if (nextTemperature === previousTemperature) {
      console.log(`${C.cyan}settings >${C.reset} teaching-style range is already ${nextTemperature}\n`);
      return;
    }

    state.register.temperature = nextTemperature;
    const invalidated = resetMixedLearnerSuggestion('register_temperature_changed');
    const remembered = persistCurrentInteractiveSettings('register_temperature_changed');
    appendTraceEvent(state.trace, {
      type: 'register_temperature_changed',
      schema: 'machinespirits.tutor-stub.engagement-stance-temperature-change.v1',
      previous: previousTemperature,
      temperature: nextTemperature,
      policy: state.register.policy,
      active: registerTemperatureApplies(state.register.policy),
      scope: 'engagement_stance_and_actorial_part',
      effectiveTurn: state.turns.length + 1,
      rememberedAt: remembered?.updatedAt || null,
      cacheRefresh: {
        priorStateCleared: Boolean(invalidated?.hadState),
        analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
        tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
      },
    });
    console.log(
      `${C.cyan}settings >${C.reset} teaching-style range ${previousTemperature} → ${nextTemperature}; applies to style and part from turn ${state.turns.length + 1}`,
    );
    console.log(
      `${C.dim}  ${nextTemperature < previousTemperature ? 'the next style and part choices will be sharper' : 'the next style and part choices will be broader'}${C.reset}`,
    );
    if (!registerTemperatureApplies(state.register.policy)) {
      console.log(
        `${C.dim}  the current teaching approach, ${plainPolicyLabel(state.register.policy)}, does not use this setting${C.reset}`,
      );
    }
    if (mixedLearner.enabled && latestTutorMessage(state)) {
      startMixedLearnerPrefetch('register_temperature_changed');
      console.log(`${C.dim}  rebuilding the learner suggestion, its analysis, and the next tutor response${C.reset}`);
    }
    console.log();
  }

  function repriseLatestTutorUtterance(command, { duringTurn = false } = {}) {
    if (duringTurn || exiting || !SCENE_RETURN_SLASH_COMMANDS.has(command)) return false;
    const utterance = String(latestTutorMessage(state) || '').trim();
    if (!utterance) return false;
    console.log(`${C.brightMagenta}${C.bold}tutor ↻ >${C.reset} ${utterance}\n`);
    appendTraceEvent(state.trace, {
      type: 'tutor_utterance_reprise',
      command,
      turn: state.turns[state.turns.length - 1]?.turn || 0,
      text: utterance,
      publicTranscriptChanged: false,
    });
    return true;
  }

  function latestTutorFeedbackTarget() {
    const turn = state.turns.at(-1);
    if (turn?.tutor) {
      return {
        tutorTurn: turn.turn,
        tutorTurnId: turn.turnId || turnDebugId(state, turn.turn),
        kind: 'tutor_response',
      };
    }
    if (state.history?.[0]?.role === 'assistant') {
      return {
        tutorTurn: 0,
        tutorTurnId: openingDebugId(stateRunDebugId(state)),
        kind: 'opening',
      };
    }
    return null;
  }

  function printTutorFeedbackRequest(target = latestTutorFeedbackTarget()) {
    if (!target || !state.turnFeedback?.enabled || state.interaction?.mode === 'auto' || exiting) return false;
    const feedback = requestTutorStubTurnFeedback(state.turnFeedback, target);
    if (!feedback) return false;
    console.log(
      `${C.brightYellow}optional tutor feedback >${C.reset} ${C.red}← 👎 not helpful${C.reset} · ${C.brightGreen}👍 helpful →${C.reset} · ${C.dim}empty prompt; no Enter · or just reply${C.reset}\n`,
    );
    appendTraceEvent(state.trace, {
      type: 'tutor_turn_feedback_requested',
      turn: target.tutorTurn,
      turnId: target.tutorTurnId,
      kind: target.kind,
      feedback,
      publicTranscriptChanged: false,
    });
    return true;
  }

  function handleTutorFeedbackCommand(action = '', { duringTurn = false, source = 'command' } = {}) {
    clearStatusLine();
    const rawAction = String(action || '').trim();
    const [ratingAction = '', reasonAction = '', ...commentParts] = rawAction.split(/\s+/u);
    const normalized = ratingAction.toLowerCase();
    if (!normalized) {
      const feedback = tutorStubTurnFeedbackEnvelope(state.turnFeedback);
      console.log(
        `${C.brightYellow}${C.bold}tutor feedback >${C.reset} ${state.turnFeedback?.enabled ? 'on' : 'off'} · ${tutorStubTurnFeedbackLabel(feedback)}`,
      );
      console.log(
        `${C.dim}  optional and private · on an empty prompt use ← for down or → for up; 👍, 👎, /up, /down, and /feedback controls also work${C.reset}\n`,
      );
      return true;
    }
    if (normalized === 'on') {
      setTutorStubTurnFeedbackEnabled(state.turnFeedback, true);
      appendTraceEvent(state.trace, {
        type: 'tutor_turn_feedback_setting_changed',
        enabled: true,
        duringTurn,
        effectiveTurn: state.turns.length + 1,
      });
      console.log(`${C.brightYellow}${C.bold}tutor feedback >${C.reset} on · optional`);
      if (!duringTurn && latestTutorFeedbackTarget()) printTutorFeedbackRequest();
      else console.log(`${C.dim}  the next displayed tutor message will invite a rating${C.reset}\n`);
      return true;
    }
    if (normalized === 'off') {
      setTutorStubTurnFeedbackEnabled(state.turnFeedback, false);
      appendTraceEvent(state.trace, {
        type: 'tutor_turn_feedback_setting_changed',
        enabled: false,
        duringTurn,
        effectiveTurn: state.turns.length + 1,
      });
      console.log(`${C.brightYellow}${C.bold}tutor feedback >${C.reset} off`);
      console.log(`${C.dim}  no rating will be attached to later learner messages${C.reset}\n`);
      return true;
    }
    if (duringTurn || processingTurn) {
      console.log(`${C.dim}the tutor is already responding; rate the next tutor message after it appears${C.reset}\n`);
      return true;
    }
    if (normalized === 'clear') {
      const feedback = clearTutorStubTurnFeedbackRating(state.turnFeedback);
      console.log(`${C.brightYellow}${C.bold}tutor feedback >${C.reset} ${tutorStubTurnFeedbackLabel(feedback)}`);
      console.log(`${C.dim}  no rating will accompany your next learner message unless you choose one${C.reset}\n`);
      appendTraceEvent(state.trace, {
        type: 'tutor_turn_feedback_cleared',
        turn: feedback?.targetTutorTurn ?? null,
        turnId: feedback?.targetTutorTurnId || null,
        publicTranscriptChanged: false,
      });
      return true;
    }
    if (normalized !== 'up' && normalized !== 'down') {
      console.log(
        `${C.red}feedback error:${C.reset} use /feedback up [reason], /feedback down [reason] [comment], /feedback clear, /feedback on, or /feedback off\n`,
      );
      return true;
    }
    let reason = null;
    let comment = '';
    if (reasonAction) {
      const candidateReason = reasonAction.toLowerCase().replace(/[\s-]+/gu, '_');
      if (TUTOR_STUB_FEEDBACK_REASONS[candidateReason]) {
        reason = candidateReason;
        comment = commentParts.join(' ');
      } else {
        reason = 'custom';
        comment = [reasonAction, ...commentParts].join(' ');
      }
    }
    let feedback;
    try {
      feedback = setTutorStubTurnFeedbackRating(state.turnFeedback, normalized, { reason, comment });
    } catch (error) {
      console.log(`${C.red}feedback error:${C.reset} ${error.message}\n`);
      return true;
    }
    if (!feedback) {
      console.log(`${C.dim}no tutor message is awaiting feedback; continue the dialogue first${C.reset}\n`);
      return true;
    }
    console.log(
      `${C.brightYellow}${C.bold}tutor feedback >${C.reset} ${tutorStubTurnFeedbackLabel(feedback)} · ${C.dim}private; send your learner reply whenever ready${C.reset}\n`,
    );
    const feedbackTargetTurn = findTutorStubFeedbackTargetTurn({
      feedback,
      turns: state.turns,
      opening: {
        turnId: openingDebugId(stateRunDebugId(state)),
        text: state.history.find((message) => message.role === 'assistant')?.content || '',
        provider: state.openingRealization?.provider || null,
        model: state.openingRealization?.model || null,
      },
    });
    const ratingRecord = buildTutorStubFeedbackRatingRecord({
      feedback,
      targetTurn: feedbackTargetTurn,
      provenance: {
        runId: stateRunDebugId(state),
        trace: state.trace?.filePath ? path.relative(ROOT, state.trace.filePath) : null,
        worldId: state.world?.id || null,
        learnerProfileId: state.learnerProfileId || null,
        interactionMode: state.interaction?.mode || 'learner',
        inputSource: source,
      },
    });
    appendTraceEvent(state.trace, {
      type: 'tutor_turn_feedback_selected',
      turn: feedback.targetTutorTurn,
      turnId: feedback.targetTutorTurnId,
      rating: feedback.rating,
      supplied: feedback.supplied,
      inputSource: source,
      publicTranscriptChanged: false,
    });
    if (ratingRecord) {
      appendTraceEvent(state.trace, {
        type: 'tutor_feedback_rating_recorded',
        turn: feedback.targetTutorTurn,
        turnId: feedback.targetTutorTurnId,
        record: ratingRecord,
        publicTranscriptChanged: false,
      });
      const ratedPromptSnapshot =
        feedbackTargetTurn?.prompts?.tutor ||
        (feedback.targetKind === 'opening' ? state.openingRealization?.promptSnapshot || null : null);
      const replaySystemPrompt = ratedPromptSnapshot?.systemPrompt || state.systemPrompt;
      const replayMessageHistory = Array.isArray(ratedPromptSnapshot?.messageHistory)
        ? ratedPromptSnapshot.messageHistory
        : state.history.slice(0, -1).map((message) => ({ role: message.role, content: message.content }));
      const tuningCandidate = synthesizeTutorStubTuningCandidate(state.tuning, {
        rating: feedback.rating,
        reason: feedback.reason,
        comment: feedback.comment,
        observation: ratingRecord,
        publicMessages: replayMessageHistory,
        runId: stateRunDebugId(state),
        targetTurnId: feedback.targetTutorTurnId,
        systemPromptHash: hashCanonicalJson({ systemPrompt: replaySystemPrompt }),
        systemPrompt: replaySystemPrompt,
        speaker: {
          userPrompt: ratedPromptSnapshot?.userPrompt || '',
          modelRef: state.modelRef,
          provider: state.resolved.provider,
          model: state.resolved.model,
          temperature: state.temperature,
          maxTokens: state.maxTokens,
          effort: state.cliEffort,
        },
      });
      if (tuningCandidate) {
        appendTraceEvent(state.trace, {
          type: 'tutor_tuning_candidate_created',
          candidate: tuningCandidate,
          publicTranscriptChanged: false,
        });
        console.log(
          `${C.brightCyan}tuning candidate >${C.reset} ${tuningCandidate.id} · ${displayDiagnosticLabel(tuningCandidate.status)} · ${tuningCandidate.evidence.reasonLabel}`,
        );
        console.log(`${C.dim}  /tune review · raw comment retained as evidence, never inserted into the tutor prompt${C.reset}\n`);
      }
    }
    return true;
  }

  function printTutorTuningStatus() {
    const snapshot = tutorStubTuningSnapshot(state.tuning);
    console.log(
      `${C.brightCyan}${C.bold}tutor tuning >${C.reset} ${snapshot.mode} · ${snapshot.activeRef} · stable v${snapshot.stableVersion}${snapshot.canaryVersion ? ` · canary v${snapshot.canaryVersion}` : ''}`,
    );
    console.log(
      `${C.dim}  ${snapshot.sessionFeedbackCount} feedback observation${snapshot.sessionFeedbackCount === 1 ? '' : 's'} this session · ${snapshot.sessionCandidateIds.length} candidate${snapshot.sessionCandidateIds.length === 1 ? '' : 's'} · ${snapshot.policyRuleCount} active learned rule${snapshot.policyRuleCount === 1 ? '' : 's'}${C.reset}`,
    );
    console.log(
      `${C.dim}  evidence store: ${path.relative(ROOT, snapshot.storeDir)} · /tune reasons · /tune review${C.reset}\n`,
    );
    return snapshot;
  }

  function handleTutorTuningCommand(argument = '') {
    clearStatusLine();
    const raw = String(argument || '').trim();
    const [actionRaw = 'status', id = '', value = '', ...rest] = raw.split(/\s+/u).filter(Boolean);
    const action = actionRaw.toLowerCase();
    try {
      if (action === 'status') {
        printTutorTuningStatus();
        return true;
      }
      if (action === 'on' || action === 'capture' || action === 'off' || action === 'canary') {
        const snapshot = setTutorStubTuningMode(state.tuning, action, { instance: state.tutorInstance });
        persistCurrentInteractiveSettings('tuning_mode_changed');
        appendTraceEvent(state.trace, {
          type: 'tutor_tuning_mode_changed',
          mode: snapshot.mode,
          activeRef: snapshot.activeRef,
          publicTranscriptChanged: false,
        });
        console.log(`${C.brightCyan}${C.bold}tutor tuning >${C.reset} ${snapshot.mode}`);
        console.log(
          `${C.dim}  ${snapshot.mode === 'capture' ? 'feedback is recorded as evidence, but no candidates are synthesized' : snapshot.enabled ? 'feedback is captured and typed candidates can be reviewed' : 'no tuning evidence or candidates will be written'}; the current tutor remains pinned to ${snapshot.activeRef}${C.reset}\n`,
        );
        return true;
      }
      if (action === 'reasons') {
        console.log(`${C.brightCyan}${C.bold}feedback reasons >${C.reset}`);
        for (const [reason, definition] of Object.entries(TUTOR_STUB_FEEDBACK_REASONS)) {
          console.log(`  ${reason.padEnd(24)} ${definition.label}`);
        }
        console.log(`${C.dim}  example: /down too_abstract Uses labels instead of the objects in the scene${C.reset}\n`);
        return true;
      }
      if (action === 'note') {
        const text = [id, value, ...rest].filter(Boolean).join(' ');
        const note = recordTutorStubTuningNote(state.tuning, text, {
          runId: stateRunDebugId(state),
          turn: state.turns.length + 1,
        });
        appendTraceEvent(state.trace, { type: 'tutor_tuning_note', note, publicTranscriptChanged: false });
        console.log(`${C.brightCyan}${C.bold}tuning note >${C.reset} ${note.text}`);
        console.log(`${C.dim}  provisional in this session; it is not a promoted tutor rule${C.reset}\n`);
        return true;
      }
      if (action === 'review') {
        const candidates = listTutorStubTuningCandidates(state.tuning);
        console.log(`${C.brightCyan}${C.bold}tuning candidates >${C.reset} ${candidates.length}`);
        if (!candidates.length) console.log(`${C.dim}  none yet; use /tune on and add a reason to a thumbs-down${C.reset}`);
        for (const candidate of candidates.slice(-12)) {
          console.log(
            `  ${candidate.id} · ${displayDiagnosticLabel(candidate.status)} · ${candidate.evidence?.reasonLabel || 'manual review'}`,
          );
          console.log(`${C.dim}    ${candidate.proposal?.rule || candidate.proposal?.explanation || ''}${C.reset}`);
        }
        console.log();
        return true;
      }
      if (!id && action !== 'rollback') throw new Error(`/tune ${action} needs a candidate id`);
      if (action === 'show') {
        const candidate = readTutorStubTuningCandidate(state.tuning, id);
        console.log(JSON.stringify(candidate, null, 2));
        return true;
      }
      if (action === 'approve') {
        const result = approveTutorStubTuningCandidate(state.tuning, id);
        console.log(
          `${C.brightYellow}${C.bold}candidate approved >${C.reset} ${id} → canary ${state.tutorInstance.id}@v${result.version.version}`,
        );
        console.log(`${C.dim}  test with --tutor ${state.tutorInstance.id}@v${result.version.version} or --tuning canary; then /tune validate ${id} up|down${C.reset}\n`);
        return true;
      }
      if (action === 'reject') {
        const candidate = rejectTutorStubTuningCandidate(state.tuning, id, [value, ...rest].join(' '));
        console.log(`${C.brightYellow}${C.bold}candidate rejected >${C.reset} ${candidate.id}\n`);
        return true;
      }
      if (action === 'replay') {
        const replayPath = tutorStubTuningReplayPath(state.tuning, id);
        console.log(`${C.brightCyan}${C.bold}frozen-prefix replay >${C.reset} ${path.relative(ROOT, replayPath)}`);
        console.log(`${C.dim}  exact public messages, tutor version, prompt hash, target turn, and candidate overlay are preserved${C.reset}\n`);
        return true;
      }
      if (action === 'validate') {
        const candidate = validateTutorStubTuningCandidate(state.tuning, id, value, rest.join(' '));
        console.log(`${C.brightYellow}${C.bold}candidate validation >${C.reset} ${candidate.id} · ${candidate.validation.rating === 'up' ? 'helpful' : 'not helpful'}\n`);
        return true;
      }
      if (action === 'promote') {
        const candidate = promoteTutorStubTuningCandidate(state.tuning, id);
        console.log(
          `${C.brightGreen}${C.bold}tutor promoted >${C.reset} ${state.tutorInstance.id}@v${candidate.promotedVersion} is now stable`,
        );
        console.log(`${C.dim}  this running dialogue stays pinned to ${state.tuning.activeRef}; the next run uses the promoted version${C.reset}\n`);
        return true;
      }
      if (action === 'rollback') {
        const requested = id === 'previous' ? null : id;
        const result = rollbackTutorStubTutorVersion(state.tuning, requested);
        console.log(`${C.brightYellow}${C.bold}tutor rolled back >${C.reset} v${result.fromVersion} → v${result.toVersion}`);
        console.log(`${C.dim}  this running dialogue remains pinned; the next run uses the restored stable version${C.reset}\n`);
        return true;
      }
      throw new Error('use /tune status|on|off|reasons|note|review|show|approve|reject|replay|validate|promote|rollback');
    } catch (error) {
      console.log(`${C.red}tuning error:${C.reset} ${error.message}\n`);
      return true;
    }
  }

  function handleSlashCommand(trimmed, { duringTurn = false } = {}) {
    if (!trimmed.startsWith('/')) return false;
    const command = trimmed.split(/\s+/u)[0];
    const commandArg = trimmed.slice(command.length).trim();
    if (trimmed === '/quit' || trimmed === '/exit') {
      if (duringTurn) {
        stopInterimAnimation(state);
        concurrentTerminal.close();
        clearStatusLine();
        console.log(`${C.dim}exit requested; stopping this stub now${C.reset}`);
        resetMixedLearnerSuggestion('exit_requested_during_turn');
        finalizeInteractive('exit_requested_during_turn');
        process.exit(0);
      }
      requestExit('exit');
      return true;
    }
    if ((command === '/reset' || command === '/clear') && !commandArg) {
      return resetInteractiveDialogue({ command, duringTurn });
    }
    if (state.passthrough?.enabled && !PASSTHROUGH_SLASH_COMMANDS.includes(command)) {
      clearStatusLine();
      console.log(
        `${C.dim}${command} is intentionally unavailable in passthrough mode; use /help for the pure-chat commands${C.reset}\n`,
      );
      appendTraceEvent(state.trace, {
        type: 'passthrough_command_rejected',
        command,
        duringTurn,
        publicTranscriptChanged: false,
      });
      return true;
    }
    const pausedInterim = duringTurn ? pauseInterimAnimation(state) : false;
    let slashCommandFinished = false;
    const finishSlashCommand = () => {
      if (slashCommandFinished) return;
      slashCommandFinished = true;
      repriseLatestTutorUtterance(command, { duringTurn });
      if (pausedInterim) resumeInterimAnimation(state);
    };
    if (command === '/up' || command === '/down' || command === '/feedback') {
      const action = command === '/up'
        ? ['up', commandArg].filter(Boolean).join(' ')
        : command === '/down'
          ? ['down', commandArg].filter(Boolean).join(' ')
          : commandArg;
      handleTutorFeedbackCommand(action, { duringTurn });
      finishSlashCommand();
      return true;
    }
    if (command === '/tune') {
      handleTutorTuningCommand(commandArg);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/help') {
      clearStatusLine();
      printInteractiveHelp(state);
      appendTraceEvent(state.trace, { type: 'interactive_help', turns: state.turns.length, duringTurn });
      if (duringTurn) console.log(`${C.dim}tutor is still thinking; slash commands remain available${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/status') {
      clearStatusLine();
      printInteractiveStatus();
      appendTraceEvent(state.trace, { type: 'interactive_status', turns: state.turns.length, duringTurn });
      finishSlashCommand();
      return true;
    }
    if (command === '/debug') {
      clearStatusLine();
      const parts = commandArg.toLowerCase().split(/\s+/u).filter(Boolean);
      const action = parts[0] || '';
      const requestedFormat = parts[1] || null;
      const validFormat = (value) => value === 'prose' || value === 'technical';
      if (!action) {
        const formatLabel = state.explanatoryDebug?.format === 'technical' ? 'technical details' : 'plain explanation';
        console.log(
          `${C.brightBlue}${C.bold}debug >${C.reset} ${state.explanatoryDebug?.enabled ? 'on' : 'off'} · ${
            formatLabel
          }`,
        );
        console.log(
          `${C.dim}  off shows only the dialogue and compact response line; /debug on adds a short plain explanation; /debug technical shows all diagnostic evidence once${C.reset}\n`,
        );
        finishSlashCommand();
        return true;
      }
      if (action === 'on' && parts.length <= 2 && (!requestedFormat || validFormat(requestedFormat))) {
        const format = requestedFormat || 'prose';
        state.explanatoryDebug.enabled = true;
        state.explanatoryDebug.format = format;
        appendTraceEvent(state.trace, {
          type: 'explanatory_debug_mode_changed',
          enabled: true,
          format,
          duringTurn,
          effectiveTurn: state.turns.length + 1,
        });
        console.log(
          `${C.brightBlue}${C.bold}debug >${C.reset} on · ${format === 'technical' ? 'technical details' : 'plain explanation'}`,
        );
        console.log(
          `${C.dim}  the ${duringTurn ? 'current' : 'next'} completed turn will show ${
            format === 'prose'
              ? 'a short model-written explanation'
              : 'the learner analysis, calculations, and teaching-style decision'
          }${C.reset}\n`,
        );
        finishSlashCommand();
        return true;
      }
      if (action === 'off' && parts.length === 1) {
        state.explanatoryDebug.enabled = false;
        appendTraceEvent(state.trace, {
          type: 'explanatory_debug_mode_changed',
          enabled: false,
          format: state.explanatoryDebug.format || 'prose',
          duringTurn,
          effectiveTurn: state.turns.length + 1,
        });
        console.log(`${C.brightBlue}${C.bold}debug >${C.reset} off`);
        console.log(
          `${C.dim}  automatic explanations stopped; the dialogue and compact response line remain; /debug show is still available${C.reset}\n`,
        );
        finishSlashCommand();
        return true;
      }
      const oneOffFormat =
        action === 'technical' && parts.length === 1
          ? 'technical'
          : action === 'prose' && parts.length === 1
            ? 'prose'
            : (action === 'show' || action === 'once') &&
                parts.length <= 2 &&
                (!requestedFormat || validFormat(requestedFormat))
              ? requestedFormat || 'prose'
              : null;
      if (oneOffFormat) {
        return printExplanatoryDebugTurn(state, { force: true, format: oneOffFormat }).finally(finishSlashCommand);
      }
      console.log(
        `${C.red}debug error:${C.reset} use /debug on [prose|technical], /debug off, /debug show [prose|technical], or /debug technical\n`,
      );
      finishSlashCommand();
      return true;
    }
    if (command === '/learner') {
      if (commandArg) {
        console.log(
          `${C.red}mode error:${C.reset} /learner takes no argument; type the learner line after switching\n`,
        );
      } else {
        setInteractionMode('learner');
      }
      finishSlashCommand();
      return true;
    }
    if (command === '/coach') {
      setInteractionMode('coach', { announce: !commandArg });
      if (commandArg) queueCoachGuidance(commandArg, { duringTurn });
      finishSlashCommand();
      return true;
    }
    if (command === '/auto') {
      const promise = runInteractiveAutoMode(commandArg, { duringTurn });
      finishSlashCommand();
      return promise;
    }
    if (command === '/mode') {
      const [requestedModeRaw = '', ...rest] = commandArg.split(/\s+/u).filter(Boolean);
      const requestedMode = requestedModeRaw.toLowerCase();
      const modeArgument = rest.join(' ');
      if (!requestedMode) {
        clearStatusLine();
        printInteractionModeBanner();
        finishSlashCommand();
        return true;
      }
      if (requestedMode === 'auto') {
        const promise = runInteractiveAutoMode(modeArgument, { duringTurn });
        finishSlashCommand();
        return promise;
      }
      if (requestedMode === 'coach') {
        setInteractionMode('coach', { announce: !modeArgument });
        if (modeArgument) queueCoachGuidance(modeArgument, { duringTurn });
        finishSlashCommand();
        return true;
      }
      if (requestedMode === 'learner' && !modeArgument) {
        setInteractionMode('learner');
        finishSlashCommand();
        return true;
      }
      clearStatusLine();
      console.log(`${C.red}mode error:${C.reset} use /mode learner, /mode coach [guidance], or /mode auto [turns]\n`);
      finishSlashCommand();
      return true;
    }
    if (command === '/scenario') {
      const promise = chooseAnotherScenario(commandArg, {
        reason: awaitingAnotherScenario ? 'next_scenario_after_closure' : 'scenario_changed_by_user',
        duringTurn,
      }).finally(finishSlashCommand);
      promise.tutorStubBlocksPrompt = true;
      return promise;
    }
    if (command === '/settings') {
      const promise = handleDialogueSettings(commandArg, { duringTurn }).finally(finishSlashCommand);
      promise.tutorStubBlocksPrompt = !duringTurn && liveSettingsPickerAvailable();
      return promise;
    }
    if (command === '/transcript' || command === '/html') {
      clearStatusLine();
      const option = commandArg.toLowerCase();
      if (option && !['no-open', 'write'].includes(option)) {
        console.log(`${C.red}transcript error:${C.reset} use ${command} or ${command} no-open\n`);
      } else {
        writeCurrentTranscriptHtml({ launch: !option, duringTurn });
      }
      finishSlashCommand();
      return true;
    }
    if (command === '/director' || command === '/notes') {
      clearStatusLine();
      if (commandArg) {
        console.log(`${C.red}director notes error:${C.reset} use /director or /notes\n`);
      } else {
        const notes = printDirectorNotesIssuedSoFar(state);
        appendTraceEvent(state.trace, {
          type: 'director_notes_reprise',
          command,
          duringTurn,
          throughTurn: notes.throughTurn,
          openingIncluded: Boolean(notes.opening),
          releasedNoteCount: notes.releases.length,
          notes,
          publicTranscriptChanged: false,
        });
        if (duringTurn) {
          console.log(
            `${C.dim}tutor is still thinking; future and in-progress director notes remain withheld${C.reset}\n`,
          );
        }
      }
      finishSlashCommand();
      return true;
    }
    if (command === '/analysis' || command === '/a') {
      clearStatusLine();
      const analysisMode = commandArg.toLowerCase();
      const technical = ['technical', 'tech', 'evidence', 'debug'].includes(analysisMode);
      if (analysisMode && !technical) {
        console.log(`${C.red}unknown analysis mode:${C.reset} ${commandArg}`);
        console.log(`${C.dim}  use /analysis or /analysis technical${C.reset}\n`);
      } else {
        printCurrentTurnAnalysis(state, { technical });
      }
      appendTraceEvent(state.trace, {
        type: 'analysis_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        mode: technical ? 'technical' : 'plain',
      });
      if (duringTurn) console.log(`${C.dim}tutor is still thinking; showing the latest completed turn${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/field' || trimmed === '/f') {
      clearStatusLine();
      const field = printLightweightDialogueField(state);
      appendTraceEvent(state.trace, {
        type: 'field_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        field,
      });
      if (duringTurn) console.log(`${C.dim}tutor is still thinking; field excludes the in-progress turn${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/viz' || trimmed === '/v' || trimmed === '/visualization') {
      clearStatusLine();
      const viz = printFieldVisualization(state, { reason: duringTurn ? 'viz_during_turn' : 'viz' });
      appendTraceEvent(state.trace, {
        type: 'field_visualization_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        viz: viz
          ? {
              svg: viz.svgDisplayPath,
              json: viz.jsonDisplayPath,
              turnCount: viz.field.turnCount,
            }
          : null,
      });
      if (duringTurn)
        console.log(`${C.dim}tutor is still thinking; visualization excludes the in-progress turn${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (command === '/clarify' || command === '/explain' || command === '/c') {
      return runClarificationCommand(commandArg, { duringTurn }).finally(finishSlashCommand);
    }
    if (trimmed === '/report' || trimmed === '/r') {
      clearStatusLine();
      const report = printDialogueCloseout(state, {
        reason: duringTurn ? 'report_during_turn' : 'report',
        trace: state.trace,
      });
      appendTraceEvent(state.trace, {
        type: 'closeout_report_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        report,
      });
      if (duringTurn)
        console.log(`${C.dim}tutor is still thinking; closeout excludes the in-progress turn${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/id' || trimmed === '/turn-id' || trimmed === '/debug-id') {
      clearStatusLine();
      const debug = printCurrentDebugId(state, { duringTurn });
      appendTraceEvent(state.trace, {
        type: 'debug_id_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        debug,
      });
      if (duringTurn)
        console.log(`${C.dim}tutor is still thinking; the in-progress trace may still be incomplete${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/suggest') {
      showMixedLearnerSuggestion({ duringTurn });
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_suggestion_popup',
        turn: mixedLearner.suggestion?.turn || state.turns.length + 1,
        duringTurn,
        ready: Boolean(mixedLearner.suggestion?.text),
        pending: Boolean(mixedLearner.pending),
      });
      finishSlashCommand();
      return true;
    }
    if (command === '/profile') {
      handleMixedLearnerProfileCommand(commandArg, { duringTurn });
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/clue' || trimmed === '/hint') {
      showMixedLearnerClue({ duringTurn });
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_clue_popup',
        turn: mixedLearner.suggestion?.turn || state.turns.length + 1,
        duringTurn,
        ready: Boolean(mixedLearner.suggestion?.clue),
        pending: Boolean(mixedLearner.pending),
      });
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/use' || trimmed === '/accept') {
      acceptMixedLearnerSuggestion({ duringTurn });
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/regen') {
      clearStatusLine();
      if (!mixedLearner.enabled) {
        console.log(`${C.dim}learner suggestions are off; start with --mixed-learner to use /regen${C.reset}\n`);
      } else if (duringTurn) {
        console.log(`${C.dim}tutor is still thinking; /regen is available after the tutor responds${C.reset}\n`);
      } else {
        startMixedLearnerPrefetch('regen', { force: true });
        console.log(`${C.dim}rebuilding the learner clue and suggestion${C.reset}\n`);
      }
      finishSlashCommand();
      return true;
    }
    clearStatusLine();
    console.log(`${C.red}unknown command:${C.reset} ${trimmed}${C.dim} · type / to browse or use /help${C.reset}\n`);
    appendTraceEvent(state.trace, { type: 'unknown_slash_command', command: trimmed, duringTurn });
    finishSlashCommand();
    return true;
  }

  function compoundLearnerInput(active, revision = active.revision) {
    const messages = active.fragments.map((fragment, index) => ({
      index: index + 1,
      text: fragment.text,
      receivedAt: fragment.receivedAt,
      tutorFeedback: jsonClone(active.tutorFeedback),
    }));
    return {
      schema: 'machinespirits.tutor-stub.compound-learner-turn.v1',
      compoundTurnId: active.id,
      turn: active.turn,
      turnId: active.turnId,
      revision,
      messageCount: messages.length,
      messages,
      tutorFeedback: jsonClone(active.tutorFeedback),
      combinedText: messages.map((message) => message.text).join('\n'),
      coalescedBeforeTutorReply: messages.length > 1,
    };
  }

  function extendActiveLearnerTurn(text) {
    const active = activeLearnerTurn;
    if (!active || active.responseDisplayed || active.committed) return false;
    const previousRevision = active.revision;
    const receivedAt = new Date().toISOString();
    active.fragments.push({ text, receivedAt });
    active.revision += 1;
    resetMixedLearnerSuggestion('learner_turn_extended');
    appendTraceEvent(state.trace, {
      type: 'learner_turn_fragment_received',
      schema: 'machinespirits.tutor-stub.compound-learner-turn.v1',
      turn: active.turn,
      turnId: active.turnId,
      compoundTurnId: active.id,
      fragmentIndex: active.fragments.length,
      revision: active.revision,
      text,
      receivedAt,
      tutorFeedback: jsonClone(active.tutorFeedback),
      whileTutorPending: true,
      publicTranscriptStatus: 'pending_compound_turn',
    });
    appendTraceEvent(state.trace, {
      type: 'learner_turn_attempt_superseded',
      turn: active.turn,
      turnId: active.turnId,
      compoundTurnId: active.id,
      previousRevision,
      revision: active.revision,
      messageCount: active.fragments.length,
      reason: 'additional_learner_message_before_tutor_reply',
    });
    active.abortController?.abort();
    console.log(
      `${C.cyan}learner turn updated >${C.reset} added message ${active.fragments.length}; restarting the tutor with all ${active.fragments.length} messages`,
    );
    console.log(`${C.dim}  the messages stay separate in the trace and count as one learner turn${C.reset}\n`);
    return true;
  }

  async function processLearnerLine(initialText) {
    if (exiting) return;
    if (state.dialogueClosure?.phase === 'closed') {
      offerAnotherScenario('dialogue_grounded_closure');
      return;
    }

    const tutorTurn = state.turns.length + 1;
    const turnId = turnDebugId(state, tutorTurn);
    const active = {
      id: `${turnId}:learner`,
      turn: tutorTurn,
      turnId,
      revision: 1,
      fragments: [{ text: initialText, receivedAt: new Date().toISOString() }],
      tutorFeedback: tutorStubTurnFeedbackEnvelope(state.turnFeedback),
      abortController: null,
      responseDisplayed: false,
      committed: false,
    };
    activeLearnerTurn = active;
    processingTurn = true;
    let completedTurn = false;
    appendTraceEvent(state.trace, {
      type: 'learner_turn_fragment_received',
      schema: 'machinespirits.tutor-stub.compound-learner-turn.v1',
      turn: tutorTurn,
      turnId,
      compoundTurnId: active.id,
      fragmentIndex: 1,
      revision: 1,
      text: initialText,
      receivedAt: active.fragments[0].receivedAt,
      tutorFeedback: jsonClone(active.tutorFeedback),
      whileTutorPending: false,
      publicTranscriptStatus: 'pending_compound_turn',
    });

    try {
      while (!exiting && !completedTurn && activeLearnerTurn === active) {
        const learnerInput = compoundLearnerInput(active);
        const revision = learnerInput.revision;
        const learnerText = learnerInput.combinedText;
        const abortController = new AbortController();
        active.abortController = abortController;
        const isCurrent = () =>
          !exiting && activeLearnerTurn === active && active.revision === revision && !abortController.signal.aborted;
        const attemptState = cloneStateForInteractiveLearnerAttempt();
        const baseline = {
          comprehension: structuredClone(state.comprehension),
          coach: structuredClone(state.coach),
        };
        appendTraceEvent(state.trace, {
          type: 'learner_turn_attempt_started',
          turn: tutorTurn,
          turnId,
          compoundTurnId: active.id,
          revision,
          messageCount: learnerInput.messageCount,
          messages: learnerInput.messages,
        });

        try {
          const closureAcknowledgement = Boolean(
            attemptState.dialogueClosure?.phase === 'awaiting_checkin' &&
              tutorStubClosureAcknowledgement(learnerText),
          );
          const prefetchedAnalysis = closureAcknowledgement || attemptState.passthrough?.enabled
            ? null
            : await takeMixedLearnerAnalysisPrefetch(learnerText, learnerInput.tutorFeedback);
          assertTutorStubTurnAttemptCurrent({ signal: abortController.signal, isCurrent });
          resetMixedLearnerSuggestion('learner_turn_started', {
            preserveAnalysisCache: Boolean(prefetchedAnalysis?.entry),
          });

          let response;
          let completionReason = 'turn_complete';
          if (attemptState.passthrough?.enabled) {
            startInterimAnimation(attemptState, 'calling speaker', { learnerText, tutorTurn });
            try {
              response = await runOneTurn(learnerText, attemptState, null, null, null, null, null, {
                signal: abortController.signal,
                isCurrent,
                learnerInput,
              });
            } finally {
              stopInterimAnimation(attemptState);
            }
            completionReason = 'passthrough_turn_complete';
          } else if (closureAcknowledgement) {
            const inheritedModel = attemptState.turns.at(-1)?.tutorLearnerDagModel || null;
            const tutorLearnerDag = { model: inheritedModel };
            const { frame } = tutorDialogueClosureFrameForTurn({
              state: attemptState,
              tutorTurn,
              tutorLearnerDag,
            });
            const text = deterministicTutorStubClosureResponse(frame, { acknowledgement: true });
            const closureAudit = auditTutorStubDialogueClosureResponse({ text, frame });
            printWithConcurrentTerminal(state, () => printTurnDebugLine(state, tutorTurn));
            response = await runOneTurn(
              learnerText,
              attemptState,
              {
                turn: {
                  summary: 'Learner declines the optional final check-in.',
                  request_type: 'off_task_or_mixed',
                  discourse_move: 'claim',
                  evidence_use: 'none',
                  epistemic_stance: 'grounded',
                  affect: 'settled',
                  agency: 'steering',
                  scores: {},
                  pedagogical_need: 'Close the inquiry without another question.',
                },
                overall: {
                  summary: 'The learner accepts dialogue closure.',
                  trajectory: 'terminal closure',
                  current_state: 'settled',
                  next_best_tutor_move: 'Close the inquiry.',
                },
              },
              tutorLearnerDag,
              null,
              null,
              {
                text,
                provider: attemptState.resolved.provider,
                model: attemptState.resolved.model,
                latencyMs: 0,
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
                leakAudit: { ok: true, leaks: [] },
                scaffoldAudit: { ok: true, issues: [], similarity: 0 },
                closureAudit,
                deterministicClosure: true,
              },
              { signal: abortController.signal, isCurrent, learnerInput },
            );
            completionReason = 'dialogue_closure_acknowledgement';
          } else {
            const { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy } =
              await analyzeLearnerTurn(learnerText, attemptState, {
                precomputedRaw: prefetchedAnalysis?.raw || null,
                signal: abortController.signal,
                isCurrent,
                tutorFeedback: learnerInput.tutorFeedback,
              });
            assertTutorStubTurnAttemptCurrent({ signal: abortController.signal, isCurrent });
            const humanDiscourseFrame = buildHumanDiscourseFrame({
              state: attemptState,
              tutorTurn,
              tutorLearnerDag,
              classification,
              learnerText,
            });
            const { frame: dialogueClosureFrame } = tutorDialogueClosureFrameForTurn({
              state: attemptState,
              tutorTurn,
              tutorLearnerDag,
            });
            const prefetchedResponse = await takeMixedLearnerTutorPrefetch(prefetchedAnalysis?.entry, {
              learnerText,
              classification,
              tutorLearnerDag,
              registerSelection,
              humanDiscourseFrame,
              dialogueClosureFrame,
              tutorFeedback: learnerInput.tutorFeedback,
            });
            assertTutorStubTurnAttemptCurrent({ signal: abortController.signal, isCurrent });
            if (!prefetchedResponse) {
              startInterimAnimation(
                attemptState,
                'calling tutor',
                buildTutorInterimContext({
                  learnerText,
                  state: attemptState,
                  classification,
                  tutorLearnerDag,
                  registerSelection,
                  previousRegisterEfficacy,
                }),
              );
            }
            try {
              response = await runOneTurn(
                learnerText,
                attemptState,
                classification,
                tutorLearnerDag,
                registerSelection,
                previousRegisterEfficacy,
                prefetchedResponse,
                { signal: abortController.signal, isCurrent, learnerInput },
              );
            } finally {
              stopInterimAnimation(attemptState);
            }
          }

          assertTutorStubTurnAttemptCurrent({ signal: abortController.signal, isCurrent });
          commitInteractiveLearnerAttempt(attemptState, baseline);
          const committedTutorFeedback = commitTutorStubTurnFeedback(state.turnFeedback, {
            learnerTurn: tutorTurn,
            learnerTurnId: turnId,
          });
          active.committed = true;
          active.responseDisplayed = true;
          appendTraceEvent(state.trace, {
            type: 'learner_turn_compound_committed',
            schema: learnerInput.schema,
            turn: tutorTurn,
            turnId,
            compoundTurnId: active.id,
            revision,
            messageCount: learnerInput.messageCount,
            messages: learnerInput.messages,
            combinedText: learnerInput.combinedText,
            tutorFeedback: learnerInput.tutorFeedback,
          });
          appendTraceEvent(state.trace, {
            type: 'learner_turn_tutor_feedback_committed',
            turn: tutorTurn,
            turnId,
            compoundTurnId: active.id,
            feedback: committedTutorFeedback,
            publicTranscriptChanged: false,
          });
          printWithConcurrentTerminal(state, () => {
            if (automaticTechnicalDetailsEnabled(state)) printTutorDagSnapshot(response.dagSnapshot);
            if (!state.passthrough?.enabled) {
              printDirectorPreludeBeforeFirstTutor(state, {
                reason: closureAcknowledgement
                  ? 'closure_response_without_opening'
                  : 'generated_response_without_opening',
              });
            }
            printTutorResponse(response, state.stream);
            console.log(`${C.dim}${metadataLine(response)}${C.reset}\n`);
            printTutorFeedbackRequest({ tutorTurn, tutorTurnId: turnId, kind: 'tutor_response' });
          });
          await printExplanatoryDebugTurn(state, { signal: abortController.signal, isCurrent });
          if (state.dialogueClosure?.phase === 'awaiting_checkin') {
            printWithConcurrentTerminal(state, () => {
              console.log(
                `${C.cyan}dialogue closing >${C.reset} the verdict has reached closure; one optional learner check-in remains`,
              );
              console.log(`${C.dim}  reply once to revisit a link, or say “no thanks” to close immediately${C.reset}\n`);
            });
          }
          writeFieldVisualization(state, { reason: completionReason });
          completedTurn = true;
        } catch (err) {
          stopInterimAnimation(attemptState);
          if (err?.name === 'AbortError' && activeLearnerTurn !== active) {
            appendTraceEvent(state.trace, {
              type: 'learner_turn_attempt_discarded',
              turn: tutorTurn,
              turnId,
              compoundTurnId: active.id,
              revision,
              reason: active.cancelledReason || 'learner_turn_cancelled',
              error: null,
            });
            break;
          }
          if (active.revision !== revision) {
            appendTraceEvent(state.trace, {
              type: 'learner_turn_attempt_discarded',
              turn: tutorTurn,
              turnId,
              compoundTurnId: active.id,
              revision,
              replacedByRevision: active.revision,
              reason: 'additional_learner_message_before_tutor_reply',
              error: err?.name === 'AbortError' ? null : err.message,
            });
            continue;
          }
          if (exiting && err?.name === 'AbortError') break;
          throw err;
        } finally {
          if (active.abortController === abortController) active.abortController = null;
        }
      }
    } catch (err) {
      stopInterimAnimation(state);
      printWithConcurrentTerminal(state, () => {
        clearStatusLine();
        console.error(`${C.red}error:${C.reset} ${err.message}\n`);
      });
    } finally {
      const ownsActiveTurn = activeLearnerTurn === active;
      if (ownsActiveTurn) activeLearnerTurn = null;
      if (!activeLearnerTurn && !activeAutoRun) processingTurn = false;
      if (!exiting && ownsActiveTurn && !active.cancelledReason) {
        if (state.dialogueClosure?.phase === 'closed') {
          offerAnotherScenario('dialogue_grounded_closure');
        } else {
          const next = pendingLearnerLines.shift();
          if (next) {
            printWithConcurrentTerminal(state, () =>
              console.log(`${C.dim}running queued learner turn (${pendingLearnerLines.length} still queued)${C.reset}`),
            );
            void processLearnerLine(next);
          } else {
            if (completedTurn) startMixedLearnerPrefetch('turn_complete');
            promptIfIdle();
          }
        }
      }
    }
  }

  const initialSetupCompleted = await runInitialMixedLearnerSetup();
  if (!initialSetupCompleted) {
    await interactiveDone;
    return;
  }
  persistCurrentInteractiveSettings(resumedDialogue ? 'resume_loaded' : 'session_ready');

  if (input.isTTY && output.isTTY) {
    emitKeypressEvents(input, rl);
    onInteractiveKeypress = (character, key) => {
      const arrowRating = tutorStubTurnFeedbackArrowRating({
        line: rl.line,
        key,
        feedback: tutorStubTurnFeedbackEnvelope(state.turnFeedback),
        busy: processingTurn,
        interactiveMode: state.interaction?.mode,
        interfaceBlocked: Boolean(
          exiting ||
            initialSetupStage !== 'off' ||
            scenarioPickerActive ||
            awaitingAnotherScenario
        ),
      });
      if (arrowRating) {
        lineSelection.clear();
        handleTutorFeedbackCommand(arrowRating, {
          source: key.name === 'right' ? 'empty_prompt_right_arrow' : 'empty_prompt_left_arrow',
        });
        promptIfIdle();
        return;
      }
      lineSelection.handleKeypress(character, key);
      if (slashPaletteRefreshHandle) clearImmediate(slashPaletteRefreshHandle);
      slashPaletteRefreshHandle = setImmediate(() => {
        slashPaletteRefreshHandle = null;
        if (exiting || initialSetupStage !== 'off') return;
        concurrentTerminal.setPalette(slashCommandPaletteForLine(rl.line));
      });
    };
    input.on('keypress', onInteractiveKeypress);
  }

  printInteractionModeBanner({ detail: false });

  rl.on('line', (line) => {
    lineSelection.clear();
    concurrentTerminal.acceptLine();
    if (scenarioPickerActive) return;
    const trimmed = line.trim();
    if (trimmed === '👍' || trimmed === '👎') {
      handleTutorFeedbackCommand(trimmed === '👍' ? 'up' : 'down', {
        duringTurn: processingTurn,
        source: 'emoji_line',
      });
      promptIfIdle();
      return;
    }
    if (awaitingAnotherScenario && !trimmed) {
      requestExit('dialogue_grounded_closure');
      return;
    }
    if (awaitingAnotherScenario && !trimmed.startsWith('/')) {
      const answer = trimmed.toLowerCase();
      if (['n', 'no', 'no thanks', 'quit', 'exit'].includes(answer)) {
        requestExit('dialogue_grounded_closure');
        return;
      }
      if (['y', 'yes', 'another', 'another scenario'].includes(answer)) {
        void chooseAnotherScenario('', { reason: 'next_scenario_after_closure' }).finally(() => {
          if (!exiting) promptIfIdle();
        });
        return;
      }
      console.log(`${C.dim}type y to choose another scenario, or press Enter to finish${C.reset}`);
      promptIfIdle();
      return;
    }
    if (!trimmed) {
      promptIfIdle();
      return;
    }
    const slashResult = handleSlashCommand(trimmed, { duringTurn: processingTurn });
    if (slashResult) {
      if (typeof slashResult.then === 'function') {
        if (!slashResult.tutorStubBlocksPrompt) promptIfIdle();
        void slashResult.finally(() => {
          promptIfIdle();
        });
      } else {
        promptIfIdle();
      }
      return;
    }
    if (state.interaction?.mode === 'coach') {
      const pausedInterim = processingTurn ? pauseInterimAnimation(state) : false;
      queueCoachGuidance(trimmed, { duringTurn: processingTurn });
      if (pausedInterim) resumeInterimAnimation(state);
      promptIfIdle();
      return;
    }
    if (processingTurn && state.interaction?.mode === 'auto') {
      console.log(`${C.dim}automation is running; enter a slash command, or wait for learner mode to resume${C.reset}`);
      appendTraceEvent(state.trace, {
        type: 'auto_mode_non_command_ignored',
        text: trimmed,
        turn: state.turns.length + 1,
      });
      promptIfIdle();
      return;
    }
    if (processingTurn) {
      const pausedInterim = pauseInterimAnimation(state);
      if (extendActiveLearnerTurn(trimmed)) {
        if (pausedInterim) resumeInterimAnimation(state);
        promptIfIdle();
        return;
      }
      pendingLearnerLines.push(trimmed);
      console.log(
        `${C.dim}queued next learner turn (${pendingLearnerLines.length} queued); use /analysis, /transcript, /field, /viz, or /clarify while waiting${C.reset}`,
      );
      appendTraceEvent(state.trace, {
        type: 'learner_turn_queued',
        queued: pendingLearnerLines.length,
        reason: 'previous_tutor_response_already_displayed',
      });
      if (pausedInterim) resumeInterimAnimation(state);
      promptIfIdle();
      return;
    }
    void processLearnerLine(trimmed);
    promptIfIdle();
  });

  rl.on('SIGINT', () => {
    stopInterimAnimation(state);
    console.log();
    requestExit('sigint');
  });

  rl.on('close', () => {
    exiting = true;
    stopInterimAnimation(state);
    if (slashPaletteRefreshHandle) clearImmediate(slashPaletteRefreshHandle);
    if (onInteractiveKeypress) input.removeListener('keypress', onInteractiveKeypress);
    concurrentTerminal.close();
    if (!finalized) finalizeInteractive('exit');
    resolveInteractive();
  });

  const deferOpeningForMixedPrelude = mixedLearner.enabled;
  const opening = await emitOpeningPrompt('start', { display: !deferOpeningForMixedPrelude });
  if (opening) {
    const openingPrefetch = startMixedLearnerPrefetch('opening', {
      refreshPrompt: !deferOpeningForMixedPrelude,
    });
    if (deferOpeningForMixedPrelude) {
      if (openingPrefetch) await openingPrefetch;
      printInteractiveTutorOpening(opening);
    }
  } else if (resumedDialogue) {
    printTutorFeedbackRequest(latestTutorFeedbackTarget());
  }

  promptIfIdle();
  await interactiveDone;
}

main().catch((err) => {
  console.error(`${C.red}Fatal:${C.reset} ${err.message}`);
  process.exit(1);
});
