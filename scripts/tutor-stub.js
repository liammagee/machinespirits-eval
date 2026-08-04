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
 * Edit the STUB defaults or the opening runtime prompt builder, then run:
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
import { collectGitActivity, collectGitHubMetrics, collectSourceMetrics, renderReport } from './repository-metrics.js';
import { call as callAI, callStream as streamAI } from '../tutor-core/services/unifiedAIProviderService.js';
import { callAIWithCliBridge, isCliProvider, normalizeCliEffort } from '../services/cliProviderBridge.js';
import { tutorStubCliPolicyRetryDecision } from '../services/tutorStubCliPolicyRetry.js';
import { getProviderConfig, loadProviders, resolveModel } from '../services/evalConfigLoader.js';
import {
  captureTutorStubRunProvenance,
  redactTraceSecrets,
  tutorStubTraceDisplayPath,
} from '../services/traceSchema.js';
import { runLabellingGameCli } from '../services/labellingGameCli.js';
import { buildTutorDesireDag } from '../services/dramaticDerivation/beliefDesire.js';
import { buildLearnerDag, buildLearnerDagSnapshot } from '../services/dramaticDerivation/learnerDag.js';
import {
  buildLearnerProxyDagMemory,
  buildTutorLearnerDagModel,
} from '../services/dramaticDerivation/proxyDagMemory.js';
import {
  getActorialPartDefinitions,
  getEngagementStanceDefinition,
  getEngagementStanceDefinitions,
  getEngagementStanceNames,
  getRegisterOntologyVersion,
  getRequestTypeDefinitions,
  resolveEngagementStance,
} from '../services/engagementRegisterRegistry.js';
import {
  projectTutorStubPublicWorldSummary as publicWorldSummary,
  tutorStubWorldFlavourPhrase as worldFlavourPhrase,
  tutorStubWorldLedgerTerm as worldLedgerTerm,
} from '../services/tutorStubWorldPresentation.js';
import {
  projectTutorStubWorldPublicPrompt,
  projectTutorStubWorldSpeakerDagPrompt,
} from '../services/tutorStubWorldPromptContext.js';
import {
  TUTOR_STUB_HUMAN_DISCOURSE_PHASE as HUMAN_DISCOURSE_PHASE,
  buildTutorStubHumanDiscourseRunConfig as buildHumanDiscourseRunConfig,
} from '../services/tutorStubHumanDiscourseConfig.js';
import {
  buildTutorStubRegisterPalette,
  createTutorStubRegisterPromptVocabulary,
} from '../services/tutorStubRegisterPalette.js';
import { projectTutorStubExactRepairSpans as exactTutorRepairSpans } from '../services/tutorStubGuardSpanProjection.js';
import { projectTutorStubGuardAttemptEnvelope } from '../services/tutorStubGuardAttemptProjection.js';
import { projectTutorStubScaffoldState } from '../services/tutorStubScaffoldState.js';
import { projectTutorStubSideArcState as buildSideArcState } from '../services/tutorStubSideArcState.js';
import {
  projectTutorStubPublicStocktakeRows,
  projectTutorStubWarrantPremiseAudit,
} from '../services/tutorStubWarrantPremiseAudit.js';
import { projectTutorStubStrictDagAuditState as buildStrictDagAuditState } from '../services/tutorStubStrictDagAuditState.js';
import {
  createTutorStubCurrentDebugReporter,
  createTutorStubDebugLinePrinters,
  formatTutorStubOpeningDebugId as openingDebugId,
  formatTutorStubSafeTimestamp as safeTimestampForFile,
  formatTutorStubStateTurnDebugId as turnDebugId,
  formatTutorStubTurnDebugId as formatTurnDebugId,
  printTutorStubAutomaticTechnicalDetails,
  resolveTutorStubStateRunDebugId as stateRunDebugId,
  tutorStubAutomaticTechnicalDetailsEnabled as automaticTechnicalDetailsEnabled,
} from '../services/tutorStubDebugIdentity.js';
import {
  listTutorStubCurriculumModules,
  loadTutorStubCurriculum,
  renderTutorStubCurriculumModule,
  selectTutorStubCurriculumModule,
  tutorStubCurriculumBundle,
} from '../services/curriculum/tutorStubCurriculum.js';
import {
  advanceTutorStubCurriculumRuntime,
  createTutorStubCurriculumRuntime,
  recordTutorStubCurriculumEvidence,
  selectTutorStubCurriculumRuntimeModule,
  tutorStubCurriculumPrivatePrompt,
  tutorStubCurriculumPublicProjection,
} from '../services/curriculum/tutorStubCurriculumRuntime.js';
import { projectTutorStubCurriculumProgressLines } from '../services/curriculum/tutorStubCurriculumProgressPresentation.js';
import {
  TUTOR_STUB_CURRICULUM_TRANSLATOR_SYSTEM_PROMPT,
  TUTOR_STUB_TUTOR_OUTPUT_TRANSLATOR_SYSTEM_PROMPT,
  buildTutorStubCurriculumTranslationPrompt,
  buildTutorStubTutorOutputTranslationPrompt,
  normalizeTutorStubCurriculumTranslationLevels,
  normalizeTutorStubTutorOutputTranslationLevels,
  parseTutorStubCurriculumTranslation,
  parseTutorStubTutorOutputTranslation,
  renderTutorStubCurriculumTranslation,
  renderTutorStubTutorOutputTranslation,
} from '../services/tutorStubCurriculumTranslation.js';
import {
  consumeMixedLearnerReadyAnnouncement,
  invalidateMixedLearnerCache,
  mixedLearnerAnalysisCacheKey,
  mixedLearnerGhostText,
  mixedLearnerSuggestionMove,
  mixedLearnerTutorPrefetchDecision,
  refreshMixedLearnerPrompt,
  renderMixedLearnerGhostText,
} from '../services/mixedLearnerArtifacts.js';
import { cleanTutorStubClarificationSpeech, cleanTutorStubStageSpeech } from '../services/tutorStubStageSpeech.js';
import {
  auditTutorStubGenerousInferenceResponse,
  deterministicTutorStubGenerousInferenceFallback as deterministicGenerousInferenceFallback,
  resolveTutorStubGenerousInference,
} from '../services/tutorStubGenerousInference.js';
import {
  applyTutorStubConversationalCompletionSelection,
  resolveTutorStubConversationalCompletion,
} from '../services/tutorStubConversationalCompletion.js';
import {
  auditTutorStubQuestionSupportResponse,
  buildTutorStubQuestionSupport,
} from '../services/tutorStubQuestionSupport.js';
import {
  auditTutorStubReleaseDelivery,
  auditTutorStubRepetitionResponse,
  deterministicTutorStubContextualFallback,
  snapshotTutorStubPublicPremiseIds,
} from '../services/tutorStubResponseGuard.js';
import { buildTutorStubObservedAudits } from '../services/tutorStubObservedAudits.js';
import { formatTutorStubFact as factText } from '../services/tutorStubFactModel.js';
import {
  createTutorStubPublicEvidenceModel,
  projectTutorStubLearnerPublicEvidenceState,
  projectTutorStubPublicReleaseLedger,
} from '../services/tutorStubPublicEvidence.js';
import { createTutorStubResponseLeakAudit } from '../services/tutorStubResponseLeakAudit.js';
import { compactTutorStubOneLine as oneLine } from '../services/tutorStubTextProjection.js';
import { effectiveTutorStubModelTemperature as effectiveTemperatureForModel } from '../services/tutorStubModelTemperature.js';
import {
  parseTutorStubAutoTurns as parseAutoTurns,
  parseTutorStubCommaSeparatedStrings as commaSeparatedStrings,
  parseTutorStubNumber as parseNumber,
  parseTutorStubOptionalBoundedInt as parseOptionalBoundedInt,
  parseTutorStubPositiveInt as parsePositiveInt,
} from '../services/tutorStubCliParsing.js';
import {
  createTutorStubPromptBlockModel,
  delimitTutorStubPrompt as delimitedPrompt,
  replaceDelimitedTutorStubPrompt as replaceDelimitedPrompt,
} from '../services/tutorStubPromptBlocks.js';
import {
  TUTOR_STUB_CHARACTER_RESTATEMENT_SCHEMA,
  TUTOR_STUB_CHARACTER_RESTATEMENT_SYSTEM_PROMPT,
  auditTutorStubCharacterRestatement,
  buildTutorStubCharacterRestatementPrompt,
  cleanTutorStubCharacterRestatement,
} from '../services/tutorStubCharacterRestatement.js';
import {
  TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE,
  TUTOR_STUB_QUARANTINE_CONTINUATION,
  auditTutorStubQuarantineContinuation,
  classifyTutorStubDiagnosticFailure,
  normalizeTutorStubLoopMode,
  restoreTutorStubDiagnosticTransaction,
  snapshotTutorStubDiagnosticTransaction,
} from '../services/tutorStubDiagnosticCollection.js';
import {
  auditTutorStubDramaticReleaseResponse,
  buildTutorStubDramaticReleaseFrame,
  deterministicTutorStubDramaticReleaseFallback,
  prepareTutorStubDueClueUptake,
} from '../services/tutorStubDramaticRelease.js';
import { buildTutorStubWorldScaffold } from '../services/tutorStubWorldScaffold.js';
import { buildTutorStubResumeHandoff } from '../services/tutorStubResumeHandoff.js';
import { buildTutorStubProofDebtState } from '../services/tutorStubProofDebt.js';
import {
  TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES,
  TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT,
  TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PROMPT_PROFILES,
  TUTOR_STUB_LEARNER_DAG_PREFLIGHT_SCHEMA,
  applyTutorStubPublicLearnerRecordUpdate as applyLearnerRecordUpdate,
  buildTutorStubLearnerDagPreflight,
  buildTutorStubPublicLearnerAnalysisPrompt,
  extractTutorStubPublicLearnerAnalysis,
  normalizeTutorStubEvidenceUseRubric,
  normalizeTutorStubPublicLearnerAnalysisPromptProfile,
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
  DEFAULT_TUTOR_STUB_LIGHT_ADAPTATION_THRESHOLD,
  TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA,
  buildTutorStubLightAdaptationDecision,
  normalizeTutorStubLightAdaptationThreshold,
} from '../services/tutorStubLightAdaptation.js';
import {
  DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
  DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_SEED,
  TUTOR_STUB_DAG_FACT_DROPOUT_SCHEMA,
  applyTutorStubDagFactDropout,
  normalizeTutorStubDagFactDropoutRate,
  normalizeTutorStubDagFactDropoutSeed,
  projectTutorStubDagMemoryReliability,
  tutorStubDagFactDropoutSnapshot,
} from '../services/tutorStubDagFactDropout.js';
import {
  applyTutorStubComprehensionRequest,
  applyTutorStubComprehensionResponse,
  createTutorStubComprehensionState,
  detectTutorStubComprehensionRequest,
  restoreTutorStubComprehensionState as restoreComprehensionState,
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
  normalizeTutorStubActorialPartId,
  selectTutorStubActorialPart,
  tutorStubConfigurableActorialPartIds,
  tutorStubRandomizableActorialPartIds,
} from '../services/tutorStubResponseConfiguration.js';
import { dramaticAudiencePromptLines } from '../services/tutorStubRegisterPragmatics.js';
import {
  freezeTutorStubLearnerRecordUpdateForDiscoursePlane,
  resolveTutorStubDiscoursePlane,
} from '../services/tutorStubDiscoursePlane.js';
import {
  auditTutorStubResponseComposition,
  buildTutorStubResponseCompositionFrame,
  composeTutorStubFallbackWithUptake,
  deterministicTutorStubConfiguredContinuationFallback,
  deterministicTutorStubLearnerUptake,
  deterministicTutorStubWritableEntryUptake,
  formatTutorStubResponseComposition,
  tutorStubLearnerSelectedToolMarkPath,
  tutorStubSubstantiveLearnerEcho,
} from '../services/tutorStubResponseComposition.js';
import {
  buildTutorStubFirstDraftContract,
  tutorStubFirstDraftContractPrompt,
} from '../services/tutorStubFirstDraftContract.js';
import {
  auditTutorStubLiveTurnProgressionV1,
  deterministicTutorStubTurnProgressionHandoff,
  deterministicTutorStubTurnProgressionUptake,
} from '../services/tutorStubTurnProgressionContract.js';
import {
  auditTutorStubLiveSourceActionAlignmentV1,
  tutorStubLiveResponseConfigurationSurface,
} from '../services/tutorStubLiveFirstDraftAudit.js';
import { compileTutorStubPerformanceObligationContract } from '../services/tutorStubPerformanceObligationContract.js';
import { projectTutorStubSpeakerPublicPremise } from '../services/tutorStubSpeakerPublicPremise.js';
import { resolveTutorStubPublicCounterpressure } from '../services/tutorStubCounterpressure.js';
import {
  tutorStubGuardIssueRows,
  tutorStubTerminalFallbackFailureMessage,
} from '../services/tutorStubGuardDisposition.js';
import {
  auditTutorStubSelfCorrectionDisclosure,
  detectTutorStubSelfCorrectionDisclosure,
  tutorStubDisclosableGuardCorrection,
  tutorStubSelfCorrectionDisclosurePrompt,
} from '../services/tutorStubSelfCorrectionDisclosure.js';
import {
  buildTutorStubSimplifiedRecoveryConfiguration,
  composeTutorStubGuardUptakeDevelopment,
  repairTutorStubMissingClarificationInvitation,
  repairTutorStubMissingActorialPart,
  repairTutorStubUnanswerableOpenRecall,
  repairTutorStubThirdPersonSourceLeadIn,
  tutorStubActorialPerformanceMayBeAdvisory,
  tutorStubGuardDeliveryDecision,
  tutorStubLearnerRequestedPlainStyle,
  tutorStubPlainRecoveryAllowsActorialAdvisory,
  tutorStubSimplifiedRecoveryPrompt,
} from '../services/tutorStubGuardRecovery.js';
import {
  auditTutorStubPrompt,
  auditTutorStubSpeakerPrivilege,
  recoverTutorStubDuplicateInstructionLines,
  recoverTutorStubSpeakerPrompt,
  sanitizeTutorStubSpeakerAdvisory,
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
  TUTOR_STUB_LEARNER_RESPONSE_PROVENANCE_SCHEMA,
  aggregateTutorStubLearnerResponseProvenance,
  createTutorStubLearnerResponseProvenance,
  summarizeTutorStubLearnerResponseProvenance,
} from '../services/tutorStubLearnerResponseProvenance.js';
import { buildTutorStubTurnFailureTraceEvents } from '../services/tutorStubTurnFailureBackfill.js';
import {
  TUTOR_STUB_TRANSCRIPT_HTML_SCHEMA,
  launchTutorStubTranscriptHtml,
  writeTutorStubTranscriptHtml,
} from '../services/tutorStubTranscriptHtml.js';
import { writeTutorStubLearningSummaryHtml } from '../services/tutorStubLearningSummaryHtml.js';
import {
  createTutorStubConsoleTokenSink,
  renderTutorStubStreamLabel,
  replayTutorStubTextAsConsoleStream,
  tutorStubProviderSupportsEventStreaming as providerSupportsEventStreaming,
  tutorStubProviderSupportsTokenStreaming as providerSupportsStreaming,
} from '../services/tutorStubDevelopmentSpeakerTransport.js';
import {
  TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA,
  buildTutorStubLearningSummary as buildDialogueLearningSummary,
} from '../services/tutorStubLearningSummary.js';
import {
  tutorStubDisplayDiagnosticLabel as displayDiagnosticLabel,
  tutorStubPlainPolicyLabel as plainPolicyLabel,
  tutorStubPlainSettingName as plainSettingName,
  tutorStubPlainStrategyText as plainStrategyText,
} from '../services/tutorStubResponseDetails.js';
import {
  createTutorStubInterimController,
  createTutorStubInterimState as createInterimState,
  formatTutorStubSignedInterimNumber as formatSignedInterimNumber,
  resolveTutorStubInterimState as getInterimState,
} from '../services/tutorStubInterimController.js';
import { createTutorStubLearnerEvidenceRuntime } from '../services/tutorStubLearnerEvidenceRuntime.js';
import { createTutorStubLearnerAnalysisRuntime } from '../services/tutorStubLearnerAnalysisRuntime.js';
import { createTutorStubPublicPresentationRuntime } from '../services/tutorStubPublicPresentationRuntime.js';
import { createTutorStubDebugReportRuntime } from '../services/tutorStubDebugReportRuntime.js';
import { createTutorStubLaunchSummaryPresentation } from '../services/tutorStubLaunchSummaryPresentation.js';
import { createTutorStubAutomatedLearnerGenerationRuntime } from '../services/tutorStubAutomatedLearnerGenerationRuntime.js';
import { createTutorStubTypedActionPlanningRuntime } from '../services/tutorStubTypedActionPlanningRuntime.js';
import { createTutorStubClarificationTranslationRuntime } from '../services/tutorStubClarificationTranslationRuntime.js';
import { createTutorStubOpeningRuntime } from '../services/tutorStubOpeningRuntime.js';
import { createTutorStubPromptTransport } from '../services/tutorStubPromptTransport.js';
import { createTutorStubRecoveryAccountingRuntime } from '../services/tutorStubRecoveryAccountingRuntime.js';
import { createTutorStubInteractiveLearnerRuntime } from '../services/tutorStubInteractiveLearnerRuntime.js';
import { createTutorStubInteractiveInputPresentation } from '../services/tutorStubInteractiveInputPresentation.js';
import { createTutorStubMixedLearnerController } from '../services/tutorStubMixedLearnerController.js';
import { createTutorStubInteractiveAutomationController } from '../services/tutorStubInteractiveAutomationController.js';
import { createTutorStubInteractiveDialogueController } from '../services/tutorStubInteractiveDialogueController.js';
import { createTutorStubInteractiveSessionController } from '../services/tutorStubInteractiveSessionController.js';
import { createTutorStubLiveSettingsController } from '../services/tutorStubLiveSettingsController.js';
import { createTutorStubFeedbackTuningController } from '../services/tutorStubFeedbackTuningController.js';
import { createTutorStubPerformanceControlController } from '../services/tutorStubPerformanceControlController.js';
import { createTutorStubCharacterControlController } from '../services/tutorStubCharacterControlController.js';
import { createTutorStubInteractiveTurnController } from '../services/tutorStubInteractiveTurnController.js';
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
  DEFAULT_TUTOR_STUB_VOICE_MODEL,
  DEFAULT_TUTOR_STUB_VOICE_NAME,
  TUTOR_STUB_VOICE_MODELS,
  createTutorStubVoiceBridge,
  normalizeTutorStubVoiceModel,
  normalizeTutorStubVoiceName,
} from '../services/tutorStubVoiceBridge.js';
import { copyTutorStubTextToClipboard, formatTutorStubDebugClipboardText } from '../services/tutorStubClipboard.js';
import {
  clearTutorStubTurnFeedbackRating,
  clearTutorStubTurnFeedbackTarget,
  commitTutorStubTurnFeedback,
  createTutorStubTurnFeedbackState,
  requestTutorStubTurnFeedback,
  setTutorStubTurnFeedbackEnabled,
  setTutorStubTurnFeedbackRating,
  tutorStubTurnFeedbackArrowRating,
  tutorStubTurnFeedbackEscapeDismissal,
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
  compactTutorStubPublicMessagesForBudget,
  createCompactTutorStubPublicTranscriptForPrompt,
  latestTutorStubMessage as latestTutorMessage,
  tutorStubTutorMessageContext as tutorMessageContext,
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
  normalizeTutorStubHumanSubjectClass,
  normalizeTutorStubTrainingReuseSetting,
  resolveTutorStubTrainingReuse,
  tutorStubTrainingReuseLabel,
} from '../services/tutorStubTrainingReuse.js';
import { projectTutorStubTrainingReuseStatusLines } from '../services/tutorStubTrainingReusePresentation.js';
import { projectTutorStubDialogueSettingsLines } from '../services/tutorStubDialogueSettingsPresentation.js';
import {
  createTutorStubModelSelection,
  projectTutorStubModelChoiceLines,
} from '../services/tutorStubModelChoicePresentation.js';
import {
  buildTutorStubDirectorInitialContext,
  createTutorStubDirectorNotesModel,
  projectTutorStubDirectorContextLines,
  projectTutorStubDirectorNotesLines,
} from '../services/tutorStubDirectorPresentation.js';
import {
  projectTutorStubClassifierWorldContext as classifierWorldContext,
  projectTutorStubLearnerClassificationLines,
} from '../services/tutorStubLearnerClassificationPresentation.js';
import {
  applyTutorStubLearnerAdvanceAssessment,
  buildTutorStubFailedClassification as failedClassification,
} from '../services/tutorStubLearnerClassification.js';
import {
  projectTutorStubLearnerDagLines,
  projectTutorStubLearnerDagPromptSummary as learnerDagPromptSummary,
} from '../services/tutorStubLearnerDagPresentation.js';
import { projectTutorStubResponseConfigurationLines } from '../services/tutorStubResponseConfigurationPresentation.js';
import { projectTutorStubResponsePolicyContext } from '../services/tutorStubResponsePolicyContext.js';
import { restoreTutorStubRegisterStateFromTurns as restoreRegisterStateFromTurns } from '../services/tutorStubRegisterStateRestoration.js';
import { replayTutorStubLearnerDagFromTurns } from '../services/tutorStubLearnerDagRestoration.js';
import { assertTutorStubTurnAttemptCurrent } from '../services/tutorStubTurnAttempt.js';
import { restoreTutorStubTypedActionState as restoreTypedActionState } from '../services/tutorStubTypedActionRestoration.js';
import {
  projectTutorStubDialogueClosureContext as dialogueClosureTutorContext,
  projectTutorStubHumanDiscourseContext as humanDiscourseTutorContext,
  projectTutorStubLearnerClassifierContext as classifierTutorContext,
  projectTutorStubLearnerDagModelContext as tutorLearnerDagModelContext,
  tutorPromptSurfaceKey,
} from '../services/tutorStubTutorPromptContext.js';
import { createTutorStubLearnerDagState as createLearnerDagState } from '../services/tutorStubLearnerDagState.js';
import {
  tutorStubCanonicalCommandToken,
  tutorStubCommandAvailable,
  tutorStubCommandReturnsToScene,
  tutorStubCommandSummary,
  tutorStubCommandTokens,
  tutorStubStaticCommandCompletions,
} from '../services/tutorStubCommandRegistry.js';
import {
  clearTutorStubDirectorGuidance,
  createTutorStubDirectorGuidanceState,
  mergeConcurrentTutorStubDirectorGuidance,
  restoreTutorStubDirectorGuidanceState as restoreDirectorGuidanceState,
  setTutorStubDirectorGuidance,
  tutorStubDirectorGuidanceEntry,
  tutorStubDirectorGuidancePrompt,
  tutorStubDirectorGuidanceSnapshot,
} from '../services/tutorStubDirectorGuidance.js';
import {
  TUTOR_STUB_CLI_DIRECTOR_SYSTEM_PROMPT,
  buildTutorStubCliDirectorPrompt,
  cleanTutorStubCliDirectorReply,
  normalizeTutorStubCliDirectorQuestion,
} from '../services/tutorStubCliDirector.js';
import {
  assertTutorStubCapabilityCompatibility,
  resolveTutorStubCapabilities,
} from '../services/tutorStubCapabilities.js';
import {
  assertTutorStubLabRequirements,
  createTutorStubModelCallBudget,
  formatTutorStubLabList,
  getTutorStubLab,
  listTutorStubLabs,
  resolveTutorStubLab,
  resolveTutorStubMeteredLabAdmission,
  tutorStubLabTraceMetadata,
} from '../services/tutorStubLabs.js';
import {
  applyTutorStubRecipeOptions,
  assertTutorStubResumeCompatibility,
  buildTutorStubSessionRecipe,
  compareTutorStubResumeRecipe,
  createTutorStubRecipeModelIdentityResolver,
  latestTutorStubResumeSource,
  readTutorStubSessionRecipe,
  resolveTutorStubResumeSource,
  tutorStubExactRelaunchCommand,
  writeTutorStubSessionRecipe,
} from '../services/tutorStubSessionRecipe.js';
import {
  TUTOR_STUB_SESSION_RUNTIME_SCHEMA,
  TUTOR_STUB_SESSION_RUNTIME_VERSION,
  createTutorStubCommandHandlers,
  createTutorStubSessionRuntime,
} from '../services/tutorStubSessionRuntime.js';
import { runTutorStubSessionRpc } from '../services/tutorStubSessionRpc.js';
import {
  TUTOR_STUB_CLI_MOTION_IDS,
  TUTOR_STUB_CLI_THEME_IDS,
  createTutorStubCliPresentation,
  normalizeTutorStubCliMotion,
  normalizeTutorStubCliThemeId,
  tutorStubCliPresentationSnapshot,
  tutorStubCliThemeOptions,
  tutorStubCliThemePreview,
} from '../services/tutorStubCliTheme.js';
import {
  projectTutorStubProofDagArtifactPaths,
  projectTutorStubProofDagSemanticLayerLines,
} from '../services/tutorStubProofCommandPresentation.js';
import {
  projectTutorStubInteractionModeBannerLines,
  projectTutorStubInteractionModeLabel,
} from '../services/tutorStubInteractionModePresentation.js';
import { normalizeTutorStubLaunchMode } from '../services/tutorStubLaunchMode.js';
import { projectTutorStubSessionStatusLines } from '../services/tutorStubSessionStatusPresentation.js';
import {
  DEFAULT_TUTOR_STUB_RELEASE_SPEED,
  MAX_TUTOR_STUB_RELEASE_SPEED,
  MIN_TUTOR_STUB_RELEASE_SPEED,
  acknowledgeTutorStubOpeningRelease,
  advanceTutorStubReleasePacing,
  commitTutorStubReleasePacing,
  createTutorStubReleasePacingState,
  normalizeTutorStubReleaseSpeed,
  projectTutorStubCommittedReleaseRows,
  projectTutorStubCurrentReleaseRows,
  projectTutorStubNextReleaseRow,
  restoreTutorStubReleasePacingFromTurns,
  setTutorStubReleaseSpeed,
  tutorStubReleasePacingSnapshot,
  tutorStubReleaseScheduleExhausted,
} from '../services/tutorStubReleasePacing.js';
import {
  advanceTutorStubMannerSwitch,
  advanceTutorStubQuietCheck,
  compileTutorStubTriggerArtifact,
  createTutorStubMannerSwitchState,
  createTutorStubQuietCheckState,
  tutorStubMannerCard,
  tutorStubQuietCheckCard,
  TUTOR_STUB_MANNER_SWITCH_SCHEMA,
  TUTOR_STUB_MOVE_CARDS_EXEMPLAR_VERSION,
  TUTOR_STUB_MOVE_CARDS_LICENCE_VERSION,
  TUTOR_STUB_MOVE_CARDS_VERSION,
  TUTOR_STUB_QUIET_CHECK_SCHEMA,
} from '../services/tutorStubMannerSwitch.js';
import {
  createTutorStubQuietDetectorState,
  detectTutorStubQuietState,
  tutorStubQuietStateCard,
} from '../services/tutorStubQuietDetector.js';
import { renderTutorStubDueSource } from '../services/tutorStubDueSourceRenderer.js';
import { composeTutorStubClueSpanReplacement } from '../services/tutorStubDramaticRelease.js';
import {
  buildDynamicalSystemRegisterScores,
  buildDynamicalSystemState,
  buildFieldRegisterScores,
  buildStateRegisterScores,
  buildTrajectoryRegisterScores,
  dagProgressFeatures,
  DYNAMICAL_SYSTEM_REGISTER_AFFINITY,
  DYNAMICAL_SYSTEM_TEMPERATURE,
  hasExplicitStepwiseSignal,
  latestRegisterEfficacy,
  latestRegisterSelection,
  normalizeEngagementStanceDistribution,
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
import { normalizeTutorStubDagMode } from '../services/tutorStubDagFeatures.js';
import { createTutorStubRegisterEmpiricalPriorModel } from '../services/tutorStubRegisterEmpiricalPrior.js';
import { projectTutorStubRegisterHistoryPrompt } from '../services/tutorStubRegisterHistoryProjection.js';
import {
  buildTutorStubLightweightDialogueField as buildLightweightDialogueField,
  projectTutorStubLightweightFieldTurn as lightweightFieldTurn,
} from '../services/tutorStubFieldTurnProjection.js';
import {
  applyTutorStubPointOfActionConstraint,
  auditTutorStubPointOfActionCompliance,
  buildTutorStubPointOfActionTurn,
  normalizeTutorStubPointOfActionArm,
  reconcileTutorStubPointOfActionHandoffEligibility,
  tutorStubPointOfActionPrompt,
  tutorStubPointOfActionStandingBook,
  tutorStubPointOfActionTargetText,
} from '../services/tutorStubPointOfActionCoaching.js';
import {
  PROGRAM2_COMMITTEE_DEFAULTS,
  PROGRAM2_COMMITTEE_SCHEMA,
  buildCommitteeCompositionBlock,
  committeeFallbackBatteryPass,
  committeeMiniGenerate,
  runCommitteeBattery,
  selectCommitteeCompositionQuestion,
  trimCommitteeFallback,
} from '../services/program2CommitteeEngine.js';
import { createProgram2ProviderBudgetFromEnvironment } from '../services/program2ExperimentSafety.js';
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
import { createScaffoldLifecycle, SCAFFOLD_LIFECYCLE_SCHEMA } from '../services/adaptiveTutor/scaffoldLifecycle.js';
import {
  createTutorStubTutorTurnPipeline,
  TUTOR_STUB_SPEAKER_GATED_BLOCK_IDS,
} from '../services/tutorStubTutorTurnPipeline.js';
import { createTutorStubCommandRuntime } from '../services/tutorStubCommandRuntime.js';
import { createTutorStubTraceRuntime } from '../services/tutorStubTraceRuntime.js';
import {
  createTutorStubLearningSummaryRuntime,
  createTutorStubSessionOrchestration,
} from '../services/tutorStubSessionOrchestration.js';
import { createTutorStubSessionStateRuntime } from '../services/tutorStubSessionStateRuntime.js';
import { createTutorStubResponsePolicy } from '../services/tutorStubResponsePolicy.js';
import { createTutorStubTurnOrchestration } from '../services/tutorStubTurnOrchestration.js';
import { createTutorStubVoiceController } from '../services/tutorStubVoiceController.js';
import { createTutorStubModelPickerController } from '../services/tutorStubModelPickerController.js';
import { parseTutorStubCliArguments } from '../services/tutorStubCliArguments.js';
import { createTutorStubLaunchRuntime } from '../services/tutorStubLaunchRuntime.js';
import { createTutorStubScenarioController } from '../services/tutorStubScenarioController.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_DIR = path.join(ROOT, 'config/drama-derivation');
const UNSUPPORTED_CODEX_MINI_REFS = new Set(['codex.mini', 'codex.gpt-mini', 'codex.gpt-5-mini']);
const NEGATIVE_FLOOR_REGISTERS = ['ironic', 'sarcastic', 'face_threat'];
const DAG_MODES = ['strict_dag', 'human_scaffold', 'defeasible_human_scaffold'];
const HUMAN_DISCOURSE_FRAME_SCHEMA = 'machinespirits.tutor-stub.human-discourse-frame.v1';
const TUTOR_GUARD_ACCOUNTING_SCHEMA = 'machinespirits.tutor-stub.guard-accounting.v1';
const TUTOR_TYPED_ACTION_CONFIG_SCHEMA = 'machinespirits.tutor-stub.typed-action-runtime-config.v1';
const DEFAULT_TUTOR_MODEL_REF = 'codex.gpt-5.6-terra';
const DEFAULT_INTERPRETATION_MODEL_REF = 'codex.gpt-5.6-sol';
const DEFAULT_AUTO_LEARNER_MODEL_REF = 'codex.gpt-5.6-terra';
const DEFAULT_INTERACTIVE_COMMITTEE_FALLBACK_POLICY = 'v2';

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
  learnerAnalysisPromptProfile:
    process.env.TUTOR_STUB_LEARNER_ANALYSIS_PROMPT_PROFILE ||
    TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PROMPT_PROFILES.BASELINE,
  learnerAnalysisEvidenceUseRubric:
    process.env.TUTOR_STUB_LEARNER_ANALYSIS_EVIDENCE_USE_RUBRIC || TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT,
  mixedTutorPrefetchPolicy: process.env.TUTOR_STUB_MIXED_TUTOR_PREFETCH_POLICY || 'always',
  topic: process.env.TUTOR_STUB_TOPIC || 'fractions',
  world: process.env.TUTOR_STUB_WORLD || 'world_005_marrick',
  learner: 'A curious learner who may be partly right, partly confused, and unsure how to explain their thinking.',
  goal: 'Help the learner make one small conceptual move. Prefer concrete examples and, when the compiled turn contract permits, one focused question over explanation dumps.',
  style: 'Calm, concise, Socratic, and specific. Do not perform the whole solution unless the learner is truly stuck.',
  temperature: 0.35,
  maxTokens: 2000,
  historyTurns: Number.parseInt(process.env.TUTOR_STUB_HISTORY_TURNS || '4', 10),
  memorySummary: process.env.TUTOR_STUB_MEMORY_SUMMARY !== '0',
  traceDir: process.env.TUTOR_STUB_TRACE_DIR || '.tutor-stub-traces',
  settingsFile: process.env.TUTOR_STUB_SETTINGS_FILE || '.tutor-stub-traces/last-settings.json',
  cliTheme: process.env.TUTOR_STUB_CLI_THEME || 'nocturne',
  motion: process.env.TUTOR_STUB_MOTION || 'auto',
  stream: process.env.TUTOR_STUB_STREAM !== '0',
  interimAnimation: process.env.TUTOR_STUB_INTERIM_ANIMATION !== '0',
  cliEffort: process.env.TUTOR_STUB_CLI_EFFORT || 'medium',
  registerPolicy: process.env.TUTOR_STUB_REGISTER_POLICY || 'dynamic',
  pointOfActionArm: process.env.TUTOR_STUB_POINT_OF_ACTION_ARM || '',
  registerOverlayThreshold:
    process.env.TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD || String(DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD),
  registerTemperature:
    process.env.TUTOR_STUB_REGISTER_TEMPERATURE || String(DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE),
  lightAdaptation: process.env.TUTOR_STUB_LIGHT_ADAPTATION === '1',
  lightAdaptationThreshold:
    process.env.TUTOR_STUB_LIGHT_ADAPTATION_THRESHOLD || String(DEFAULT_TUTOR_STUB_LIGHT_ADAPTATION_THRESHOLD),
  trainingReuse: process.env.TUTOR_STUB_TRAINING_REUSE || 'on',
  humanSubjectClass: process.env.TUTOR_STUB_HUMAN_SUBJECT_CLASS || 'owner_operator',
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
  responseDetails: process.env.TUTOR_STUB_RESPONSE_DETAILS !== '0',
  voiceModel: process.env.TUTOR_STUB_VOICE_MODEL || DEFAULT_TUTOR_STUB_VOICE_MODEL,
  voiceName: process.env.TUTOR_STUB_VOICE_NAME || DEFAULT_TUTOR_STUB_VOICE_NAME,
  speakerAdvisoryBlocks: process.env.TUTOR_STUB_SPEAKER_ADVISORY_BLOCKS || '',
};

/**
 * Which private advisory blocks get pasted into the speaking model's final user
 * message. Ids match the feature registry the A/B bench measures them under
 * (`services/tutorStubAbArms.js`).
 *
 * The bench ran each block on its own against a bare tutor across three frozen
 * dialogues. The continuity note, the learner classifier and the redacted
 * learner-DAG readout all landed inside the noise band, and together they cost
 * about 1,250 characters a turn. They are off by default here.
 *
 * This drops them from the *prompt* only. Everything upstream still computes
 * them: the turn contract quotes the classifier's reading of the learner word
 * for word, and the planner picks its move after reading the DAG. Turning these
 * off stops pasting the working next to the answer; it does not remove the
 * working.
 */
const DEFAULT_SPEAKER_ADVISORY_BLOCKS = Object.freeze([
  'evidence_window',
  // Kept on: its own bench reading (-1.9) sits inside the band but never
  // changed sign, and it is the block that claims the human-scaffold and
  // question-support checks. Needs its own run before it can come out.
  'human_scaffold',
  'first_draft_contract',
]);

/**
 * `all` restores every block, `none` clears them, otherwise a comma-separated
 * subset. Fails closed on an unknown id: silently ignoring a typo would let a
 * run report a prompt shape it did not have.
 */
function resolveSpeakerAdvisoryBlocks(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return new Set(DEFAULT_SPEAKER_ADVISORY_BLOCKS);
  if (text === 'all') return new Set(TUTOR_STUB_SPEAKER_GATED_BLOCK_IDS);
  if (text === 'none') return new Set();
  const requested = text
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const unknown = requested.filter((id) => !TUTOR_STUB_SPEAKER_GATED_BLOCK_IDS.includes(id));
  if (unknown.length) {
    throw new Error(
      `unknown speaker advisory block: ${unknown.join(', ')} (known: ${TUTOR_STUB_SPEAKER_GATED_BLOCK_IDS.join(', ')})`,
    );
  }
  return new Set(requested);
}

const SPEAKER_ADVISORY_BLOCKS = resolveSpeakerAdvisoryBlocks(STUB.speakerAdvisoryBlocks);

let cliPresentation = createTutorStubCliPresentation({
  theme: STUB.cliTheme,
  motion: STUB.motion,
  output,
  env: process.env,
});
const C = { ...cliPresentation.colors };
const { printTurnDebugLine, printOpeningDebugLine } = createTutorStubDebugLinePrinters({
  write: console.log,
  colors: C,
});
const printCurrentDebugId = createTutorStubCurrentDebugReporter({
  formatClipboardText: formatTutorStubDebugClipboardText,
  copyClipboard: copyTutorStubTextToClipboard,
  write: console.log,
  colors: C,
});

function configureCliPresentation({ theme, motion, noColor = false } = {}) {
  cliPresentation = createTutorStubCliPresentation({
    theme: theme ?? cliPresentation.themeId,
    motion: motion ?? cliPresentation.requestedMotion,
    output,
    env: process.env,
    noColor,
  });
  Object.assign(C, cliPresentation.colors);
  return cliPresentation;
}

const REGISTER_TEMPERATURE_POLICIES = new Set([
  'state',
  'field',
  'trajectory',
  'dynamical_system',
  'empirical_dynamical_system',
  'continuous_dynamical_system',
  'continuous_empirical_dynamical_system',
]);

const DEFAULT_INTERACTIVE_DEMO_TURNS = 3;
const MAX_INTERACTIVE_DEMO_TURNS = 8;

const EXPLICIT_PERFORMANCE_CLEAR_WORDS = new Set(['auto', 'clear', 'off', 'reset']);

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

const CLARIFIER_SYSTEM_PROMPT = [
  'You clarify wording inside a staged inquiry.',
  'Use only the public scene, public transcript, and latest tutor message supplied in the prompt.',
  'Do not infer hidden proof paths, concealed answers, private tutor prompts, private DAG state, or unstaged evidence.',
  'Do not continue the lesson or answer the case question. Explain wording only.',
  'Speak directly inside the scene. Never refer to "the tutor", "the learner", "the dialogue", or "the prompt".',
  'Keep the reply short and concrete. No JSON, no role label.',
].join('\n');

const { values: args, positionals } = parseTutorStubCliArguments({
  stub: STUB,
  committeeDefaults: PROGRAM2_COMMITTEE_DEFAULTS,
});

const {
  defaultLaunchModePickerAvailable,
  groupedWorldEntries,
  pickInitialScenarioWithKeyboard,
  pickTutorStubLaunchModeWithKeyboard,
  pickWorkplanModuleWithKeyboard,
  printAutomatedLearnerProfiles,
  printCurriculumModules,
  printWorlds,
  resolveWorldRef,
} = createTutorStubScenarioController({
  root: ROOT,
  worldDir: WORLD_DIR,
  input,
  output,
  colors: C,
  learnerProfileListText,
});

const { assertSupportedModelRefs, tutorModelChoiceEntries, resolveTutorModelSelection, visibleResolvedModel } =
  createTutorStubModelSelection({
    loadProviders,
    getProviderConfig,
    isCliProvider,
    resolveModel,
    unsupportedRefs: UNSUPPORTED_CODEX_MINI_REFS,
  });

const tutorStubLaunchRuntime = createTutorStubLaunchRuntime({
  args,
  root: ROOT,
  input,
  output,
  applyTutorStubRecipeOptions,
  latestTutorStubResumeSource,
  learnerProfileIds,
  normalizeTutorStubLaunchMode,
  normalizeTutorStubVoiceModel,
  normalizeTutorStubVoiceName,
  parseTutorStubRegisterPolicyStack,
  plainSettingName,
  readTutorStubLastSettings,
  readTutorStubSessionRecipe,
  resolveTutorModelSelection,
  resolveTutorStubLab,
  resolveTutorStubResumeSource,
  resolveWorldRef,
  tutorStubRememberedPolicyStack,
});
const {
  applyRememberedInteractiveDefaults,
  commandLineOptionProvided,
  loadedRecipeApplication,
  loadedSessionRecipe,
  rawCommandLineOptionProvided,
  rememberedSettingExplicitSources,
  resumeRecipeApplication,
  resolvedHumanSubjectClassSource,
  resolvedResumeSource,
  resolvedTrainingReuseSource,
  resolveWorkspacePath,
  selectedLabResolution,
} = tutorStubLaunchRuntime;
let { loadedSessionRecipePath } = tutorStubLaunchRuntime;

let selectedLabAdmission = null;
let selectedLabModelCallBudget = null;
const program2ProviderBudget = createProgram2ProviderBudgetFromEnvironment();

configureCliPresentation({
  theme: args.theme,
  motion: args.motion,
  noColor: args['no-color'],
});

const { loadRegisterEmpiricalPrior } = createTutorStubRegisterEmpiricalPriorModel({
  resolveWorkspacePath,
  defaultPath: path.join(ROOT, '.tutor-stub-auto-eval/register-empirical-priors.json'),
  existsSync: fs.existsSync,
  readFileSync: fs.readFileSync,
});

const {
  buildHumanDiscourseFrame,
  committedReleaseRows,
  currentReleaseRows,
  learnerDagPreflightForTurn,
  learnerPublicEvidenceState,
  nextReleaseRow,
  publicReleaseLedger,
} = createTutorStubLearnerEvidenceRuntime({
  HUMAN_DISCOURSE_FRAME_SCHEMA,
  HUMAN_DISCOURSE_PHASE,
  appendTraceEvent: (...values) => appendTraceEvent(...values),
  buildSideArcState,
  buildStrictDagAuditState,
  buildTutorStubProofDebtState,
  buildTutorStubQuestionSupport,
  buildTutorStubWorldScaffold,
  buildTutorStubLearnerDagPreflight,
  factSurface,
  latestTutorMessage,
  normalizeDiscourseRows,
  normalizeHumanDiscourseExtraction,
  oneLine,
  projectTutorStubCommittedReleaseRows,
  projectTutorStubCurrentReleaseRows,
  projectTutorStubLearnerPublicEvidenceState,
  projectTutorStubNextReleaseRow,
  projectTutorStubPublicReleaseLedger,
  projectTutorStubPublicStocktakeRows,
  projectTutorStubScaffoldState,
  projectTutorStubSpeakerPublicPremise,
  projectTutorStubWarrantPremiseAudit,
  resolveTutorStubConversationalCompletion,
  resolveTutorStubDiscoursePlane,
  resolveTutorStubGenerousInference,
  stagedEvidenceRows,
});

const publicEvidenceModel = createTutorStubPublicEvidenceModel({ committedReleaseRows, currentReleaseRows });
const { answerTermForWorld } = publicEvidenceModel;
const { auditTutorResponseLeak } = createTutorStubResponseLeakAudit({ publicEvidenceModel });

const tutorStubRecipeModelIdentity = createTutorStubRecipeModelIdentityResolver({
  resolveModel,
  getProviderConfig,
  visibleResolvedModel,
});

const {
  buildTutorDagSnapshot,
  printInteractiveHelp,
  printTutorDagSnapshot,
  printTutorStubFeatureMap,
  printTutorStubReleaseNotes,
  printHelp,
} = createTutorStubPublicPresentationRuntime({
  C,
  DEFAULT_INTERACTIVE_DEMO_TURNS,
  PROGRAM2_COMMITTEE_DEFAULTS,
  ROOT,
  STUB,
  committedReleaseRows,
  nextReleaseRow,
  writeLine: (...values) => console.log(...values),
});

const normalizeDagMode = (value) => normalizeTutorStubDagMode(value, { modes: DAG_MODES });

function buildRegisterPalette(mode) {
  const definitions = getEngagementStanceDefinitions();
  return buildTutorStubRegisterPalette(mode, {
    definitions,
    safeNames: getEngagementStanceNames({ includeArmAssigned: false }),
    negativeFloorNames: NEGATIVE_FLOOR_REGISTERS,
    resolveStance: resolveEngagementStance,
  });
}

function humanDirectedRegisterPalette() {
  const definitions = getEngagementStanceDefinitions();
  return Object.keys(definitions).filter((name) => definitions[name]?.simulated_only !== true);
}

const { engagementStancePalettePromptRows, requestTypePromptRows } = createTutorStubRegisterPromptVocabulary({
  getEngagementStanceDefinition,
  getRequestTypeDefinitions,
});

const registerHistoryPromptSummary = (state) =>
  projectTutorStubRegisterHistoryPrompt(state, { normalizeSelection: normalizeStoredRegisterSelection });

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

const compactPublicTranscriptForPrompt = createCompactTutorStubPublicTranscriptForPrompt({
  defaultHistoryTurns: STUB.historyTurns,
});

const {
  buildTutorInterimContext,
  clearStatusLine,
  pauseInterimAnimation,
  printWithConcurrentTerminal,
  resumeInterimAnimation,
  startInterimAnimation,
  stopInterimAnimation,
} = createTutorStubInterimController({
  buildHumanDiscourseFrame,
  buildLightweightDialogueField,
  buildTutorDagSnapshot,
  colors: C,
  committedReleaseRows,
  currentReleaseRows,
  dagProgressFeatures,
  displayDiagnosticLabel,
  factSurface,
  formatEngagementStanceDistribution: (...values) => formatEngagementStanceDistribution(...values),
  getPresentation: () => cliPresentation,
  lightweightFieldTurn,
  nextReleaseRow,
  output,
  plainStrategyText,
  scoreValue,
  write: (text) => process.stdout.write(text),
});

const {
  appendTraceEvent,
  appendTutorStubTurnFailureTraceRecords,
  createTraceState,
  jsonClone,
  printAutomaticTechnicalDetails,
  reserveProgram2ProviderBudget,
  reserveTutorStubMeteredModelCall,
  restoreDialogueFromTrace,
  traceDisplayPath,
} = createTutorStubTraceRuntime({
  ROOT,
  advanceTutorStubDialogueClosure,
  answerTermForWorld,
  applyLearnerRecordUpdate,
  auditTutorStubDialogueClosureResponse,
  buildTutorStubDialogueClosureFrame,
  buildTutorStubTurnFailureTraceEvents,
  captureGitProvenanceSummary,
  captureTutorStubRunProvenance,
  formatTurnDebugId,
  fs,
  getSelectedLabModelCallBudget: () => selectedLabModelCallBudget,
  hashCanonicalJson,
  learnerPublicEvidenceState,
  openingDebugId,
  path,
  printTutorStubAutomaticTechnicalDetails,
  printWithConcurrentTerminal,
  program2ProviderBudget,
  redactTraceSecrets,
  replayTutorStubLearnerDagFromTurns,
  resolveWorkspacePath,
  restoreComprehensionState,
  restoreDirectorGuidanceState,
  restoreRegisterStateFromTurns,
  restoreTypedActionState,
  safeTimestampForFile,
  tutorStubTraceDisplayPath,
});

const { callPromptModel, createConsoleTokenSink, printTutorResponse } = createTutorStubPromptTransport({
  C,
  appendTraceEvent,
  auditTutorStubPrompt,
  callAI,
  callAIWithCliBridge,
  clearStatusLine,
  compactTutorStubPublicMessagesForBudget,
  createTutorStubConsoleTokenSink,
  effectiveTemperatureForModel,
  getInterimState,
  isCliProvider,
  providerSupportsStreaming,
  recoverTutorStubDuplicateInstructionLines,
  renderTutorStubStreamLabel,
  replayTutorStubTextAsConsoleStream,
  reserveProgram2ProviderBudget,
  reserveTutorStubMeteredModelCall,
  stopInterimAnimation,
  streamAI,
  tutorStubCliPolicyRetryDecision,
  tutorStubPromptSurfaceForRole,
  write: (text) => process.stdout.write(text),
});

const {
  attachTutorGuardAccounting,
  buildTutorGuardAccounting,
  tutorGuardAttemptEnvelope,
  tutorResponseRecoveryPrompt,
} = createTutorStubRecoveryAccountingRuntime({
  TUTOR_GUARD_ACCOUNTING_SCHEMA,
  appendTraceEvent,
  jsonClone,
  projectTutorStubGuardAttemptEnvelope,
  tutorStubGuardIssueRows,
});

const {
  CURRICULUM_MODULE_PROMPT_END,
  CURRICULUM_MODULE_PROMPT_START,
  CURRICULUM_PHASE_PROMPT_END,
  CURRICULUM_PHASE_PROMPT_START,
  buildDirectorInitialContext,
  buildTutorOpening,
  directorNotesIssuedSoFar,
  loadSystemPrompt,
  printDirectorNotesIssuedSoFar,
  printDirectorPreludeBeforeFirstTutor,
} = createTutorStubOpeningRuntime({
  C,
  TUTOR_STUB_OPENING_REQUIREMENTS,
  appendTraceEvent,
  args,
  auditTutorResponseLeak,
  auditTutorStubOpening,
  auditTutorStubSpeakerPrivilege,
  buildTutorStubDirectorInitialContext,
  buildTutorStubOpeningFrame,
  callPromptModel,
  cleanTutorStubStageSpeech,
  committedReleaseRows,
  contractLicenceEnabled: process.env.TUTOR_STUB_CONTRACT_LICENCE === '1',
  createTutorStubDirectorNotesModel,
  createTutorStubPromptBlockModel,
  currentReleaseRows,
  delimitedPrompt,
  deterministicTutorStubOpening,
  dramaticAudiencePromptLines,
  fs,
  projectTutorStubDirectorContextLines,
  projectTutorStubDirectorNotesLines,
  projectTutorStubWorldPublicPrompt,
  projectTutorStubWorldSpeakerDagPrompt,
  startInterimAnimation,
  stopInterimAnimation,
  tutorStubOpeningPrompt,
  tutorStubOpeningSystemPrompt,
  worldFlavourPhrase,
  worldLedgerTerm,
});

const { generateTutorClarification, generateTutorStubCurriculumTranslation, generateTutorStubTutorOutputTranslation } =
  createTutorStubClarificationTranslationRuntime({
    CLARIFIER_SYSTEM_PROMPT,
    TUTOR_STUB_CURRICULUM_TRANSLATOR_SYSTEM_PROMPT,
    TUTOR_STUB_TUTOR_OUTPUT_TRANSLATOR_SYSTEM_PROMPT,
    buildTutorStubCurriculumTranslationPrompt,
    buildTutorStubTutorOutputTranslationPrompt,
    callPromptModel,
    cleanTutorStubClarificationSpeech,
    compactPublicTranscriptForPrompt,
    latestTutorMessage,
    parseTutorStubCurriculumTranslation,
    parseTutorStubTutorOutputTranslation,
    publicWorldSummary,
    tutorStubComprehensionPrompt,
  });

const {
  automatedLearnerCorruptionEnabled,
  automatedLearnerProfileId,
  buildMixedLearnerArtifactsPrompt,
  deterministicAutomatedLearnerFallback,
  enforceAutomatedLearnerProfile,
  generateAutomatedLearnerTurn,
  generateMixedLearnerArtifacts,
  mixedLearnerArtifactsSystemPrompt,
  resolveAutomatedLearnerProfile,
} = createTutorStubAutomatedLearnerGenerationRuntime({
  appendTraceEvent,
  callPromptModel,
  classificationFromCombinedAnalysis: (...values) => classificationFromCombinedAnalysis(...values),
  extractCombinedLearnerAnalysis: (...values) => extractCombinedLearnerAnalysis(...values),
  learnerProfileContract,
  learnerProfileIds,
  learnerProfilePrompt,
  negativeFloorRegisters: NEGATIVE_FLOOR_REGISTERS,
});

const {
  evaluatePendingRegisterEfficacy,
  explicitPerformanceActorialPartSelection,
  explicitPerformanceDirectiveValue,
  formatEngagementStanceDistribution,
  normalizeResponseConfigurationSelection,
  performanceTemperatureScope,
  policySamplingContext,
  randomPerformanceActorialPartSelection,
  registerSelectionFromCombinedAnalysis,
  resolveTutorStubCharacterChoice,
} = createTutorStubResponsePolicy({
  DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
  DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
  DYNAMICAL_SYSTEM_REGISTER_AFFINITY,
  DYNAMICAL_SYSTEM_TEMPERATURE,
  EXPLICIT_PERFORMANCE_CLEAR_WORDS,
  NEGATIVE_FLOOR_REGISTERS,
  TUTOR_STUB_REGISTER_POLICY_COMPOSITION_SCHEMA,
  args,
  automatedLearnerProfileId,
  buildContinuousEngagementStanceVector,
  buildContinuousRegisterPolicyMetadata,
  buildDynamicalSystemRegisterScores,
  buildFieldRegisterScores,
  buildStateRegisterScores,
  buildTrajectoryRegisterScores,
  buildTutorStubLightAdaptationDecision,
  buildTutorStubResponseConfiguration,
  committedReleaseRows,
  continuousEngagementStanceInstruction,
  currentReleaseRows,
  displayDiagnosticLabel,
  evaluateTutorStubRegisterPolicyOverlay,
  getActorialPartDefinitions,
  getEngagementStanceDefinition,
  getEngagementStanceDefinitions,
  getRegisterOntologyVersion,
  hasExplicitStepwiseSignal,
  latestFieldStateMismatch,
  latestRegisterSelection,
  normalizeEngagementStanceDistribution,
  normalizeTutorStubActorialPartId,
  numberOr,
  oneLine,
  preferredLegacyRegister,
  recentRegisterCount,
  registerAffinityContributions,
  registerEfficacyFromDagProgress,
  registerTemperatureApplies,
  resolveEngagementStance,
  resolveTutorStubDiscoursePlane,
  roundField,
  sampleTutorStubPolicyDistribution,
  selectTutorStubActorialPart,
  topNumericEntries,
  tutorStubComprehensionFeatures,
  tutorStubConfigurableActorialPartIds,
  tutorStubRandomizableActorialPartIds,
  tutorStubRegisterPolicyStackId,
  tutorStubReleasePacingSnapshot,
});

const {
  analyzeLearnerTurn,
  applyConversationalCompletionForLearnerTurn,
  applyLearnerAdvanceAssessment,
  classificationFromCombinedAnalysis,
  extractCombinedLearnerAnalysis,
  learnerRecordFromCombinedAnalysis,
  resolveConversationalCompletionForLearnerTurn,
  tutorStubNewEvidenceAvailable,
  updateComprehensionForLearnerTurn,
} = createTutorStubLearnerAnalysisRuntime({
  CLASSIFIER_SYSTEM_PROMPT,
  LEARNER_RECORD_SYSTEM_PROMPT,
  TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES,
  applyLearnerRecordUpdate,
  applyTutorStubComprehensionRequest,
  applyTutorStubConversationalCompletionSelection,
  applyTutorStubDagFactDropout,
  applyTutorStubLearnerAdvanceAssessment,
  appendTraceEvent,
  assertTutorStubTurnAttemptCurrent,
  buildLearnerDag,
  buildLearnerDagSnapshot,
  buildLearnerProxyDagMemory,
  buildTutorLearnerDagModel,
  buildTutorStubLearnerAdvance,
  buildTutorStubPublicLearnerAnalysisPrompt,
  callPromptModel,
  classifierWorldContext,
  colors: C,
  committedReleaseRows,
  compactPublicTranscriptForPrompt,
  detectTutorStubComprehensionRequest,
  displayDiagnosticLabel,
  engagementStancePalettePromptRows,
  engagementStanceSelectionPolicyPrompt,
  evaluatePendingRegisterEfficacy,
  extractTutorStubPublicLearnerAnalysis,
  factSurface,
  factText,
  failedClassification,
  formatEngagementStanceDistribution,
  formatSignedInterimNumber,
  freezeTutorStubLearnerRecordUpdateForDiscoursePlane,
  humanDiscourseExtractionSchema,
  latestTutorMessage,
  learnerDagPreflightForTurn,
  learnerDagPromptSummary,
  learnerPublicEvidenceState,
  normalizeHumanDiscourseExtraction,
  normalizeResponseConfigurationSelection,
  parseClassifierJson,
  printAutomaticTechnicalDetails,
  printLine: (line) => console.log(line),
  printTurnDebugLine,
  printWithConcurrentTerminal,
  projectTutorStubDagMemoryReliability,
  projectTutorStubLearnerClassificationLines,
  projectTutorStubLearnerDagLines,
  projectTutorStubResponseConfigurationLines,
  publicReleaseLedger,
  registerHistoryPromptSummary,
  registerSelectionFromCombinedAnalysis,
  requestTypePromptRows,
  resolveTutorStubConversationalCompletion,
  resolveTutorStubDiscoursePlane,
  scoreValue,
  startInterimAnimation,
  stopInterimAnimation,
  tutorStubComprehensionPrompt,
  tutorStubComprehensionSnapshot,
  tutorStubReleasePacingSnapshot,
  tutorStubReleaseScheduleExhausted,
  tutorStubTurnFeedbackRegisterPrompt,
  updateReleasePacingForLearnerTurn,
});

const {
  printCurrentTurnAnalysis,
  printDialogueCloseout,
  printExplanatoryDebugTurn,
  printFieldVisualization,
  printLightweightDialogueField,
  printResponseDetails,
  recordTutorStubTurnTiming,
  writeFieldVisualization,
} = createTutorStubDebugReportRuntime({
  C,
  ROOT,
  STUB,
  appendTraceEvent,
  assertTutorStubTurnAttemptCurrent,
  callPromptModel,
  formatEngagementStanceDistribution,
  getInterimState,
  jsonClone,
  printWithConcurrentTerminal,
  resolveWorkspacePath,
  startInterimAnimation,
  stopInterimAnimation,
  traceDisplayPath,
  writeLine: (...values) => console.log(...values),
});

const { printTutorStubLaunchSummary } = createTutorStubLaunchSummaryPresentation({
  C,
  ROOT,
  getCliPresentation: () => cliPresentation,
  output,
  traceDisplayPath,
  writeLine: (...values) => console.log(...values),
});

const { closePriorTypedAction, planTypedAction, tutorDialogueClosureFrameForTurn } =
  createTutorStubTypedActionPlanningRuntime({
    C,
    answerTermForWorld,
    appendTraceEvent,
    buildTutorDagSnapshot,
    currentReleaseRows,
    explicitPerformanceActorialPartSelection,
    explicitPerformanceDirectiveValue,
    jsonClone,
    policySamplingContext,
    randomPerformanceActorialPartSelection,
    registerTemperatureApplies,
    stateRunDebugId,
    writeLine: (...values) => console.log(...values),
  });

// Opt-in manner switch (TUTOR_STUB_MANNER_SWITCH=1): butler ↔ exacting
// schoolmaster, driven by deterministic learner-pressure classification with
// pacing-style hysteresis. Advanced here beside release pacing so every
// learner-turn path updates it; the pipeline reads state.mannerSwitch.card.
const MANNER_SWITCH_ENABLED = process.env.TUTOR_STUB_MANNER_SWITCH === '1';

// TUTOR_STUB_MANNER_TRIGGER=<artifact.json> selects a trigger version
// (config/manner-trigger/); unset uses the built-in v1 patterns.
const MANNER_TRIGGER_PATH = process.env.TUTOR_STUB_MANNER_TRIGGER || null;

// Phase Q1: TUTOR_STUB_QUIET_CHECK=<gap> arms the scheduled quiet check —
// after <gap> consecutive pressure-silent learner turns, one quiet-repair
// card. Requires the manner switch (the classifier supplies "silent").
const QUIET_CHECK_GAP = Number(process.env.TUTOR_STUB_QUIET_CHECK) || 0;

// Phase Q2: TUTOR_STUB_QUIET_DETECTOR=1 arms the typed quiet-state
// detector — confusion, flatness, or quiet defiance on a pressure-silent
// turn hands the tutor that state's typed card. Requires the manner switch.
const QUIET_DETECTOR_ENABLED = process.env.TUTOR_STUB_QUIET_DETECTOR === '1';

// Phase H1: TUTOR_STUB_CARD_EXEMPLARS=1 appends a worked example of the
// move's shape to cards that carry one (currently: demand). The cards
// version travels in every switch trace so arms never pool across it.
const CARD_EXEMPLARS_ENABLED = process.env.TUTOR_STUB_CARD_EXEMPLARS === '1';

// Phase S2: TUTOR_STUB_CARD_LICENCE=1 adds the scoped contract exception to
// cards that carry one (currently: demand). Leak audits are co-primary.
const CARD_LICENCE_ENABLED = process.env.TUTOR_STUB_CARD_LICENCE === '1';

// Phase L2: TUTOR_STUB_CARD_DOSE_LADDER=1 escalates a state's card one dose
// step each time that state RECURS after a carded moment (the repair missed
// for this learner): dose 1 = card, 2 = +exemplar, 3 = +exemplar+licence.
// Dial-setting only — no learner description enters any prompt.
const CARD_DOSE_LADDER = process.env.TUTOR_STUB_CARD_DOSE_LADDER === '1';
// TUTOR_STUB_CARD_FORCE='9=settled_claim,10=stake' (crossed-effects arms).
const CARD_FORCE_MAP = (() => {
  const raw = process.env.TUTOR_STUB_CARD_FORCE;
  if (!raw) return null;
  const map = new Map();
  for (const part of raw.split(',')) {
    const [turn, card] = part.split('=').map((x) => x.trim());
    if (turn && card) map.set(Number(turn), card);
  }
  return map.size ? map : null;
})();
let mannerTriggerCache;
function activeMannerTrigger() {
  if (!MANNER_TRIGGER_PATH) return null;
  if (mannerTriggerCache === undefined) {
    mannerTriggerCache = compileTutorStubTriggerArtifact(
      JSON.parse(fs.readFileSync(path.resolve(MANNER_TRIGGER_PATH), 'utf8')),
    );
  }
  return mannerTriggerCache;
}

function updateMannerSwitchForLearnerTurn({ learnerText, state, tutorTurn, recordTrace = true }) {
  if (!MANNER_SWITCH_ENABLED || !state) return null;
  state.mannerSwitch = state.mannerSwitch || createTutorStubMannerSwitchState(activeMannerTrigger());
  advanceTutorStubMannerSwitch(state.mannerSwitch, { learnerText, turn: tutorTurn });
  let cardOptions = { exemplars: CARD_EXEMPLARS_ENABLED, licence: CARD_LICENCE_ENABLED };
  if (CARD_DOSE_LADDER) {
    // Recurrence of a previously-carded state = the repair missed for this
    // learner; that state's dose climbs one step (1 card, 2 +exemplar,
    // 3 +exemplar+licence). Stamped in the switch trace event.
    state.cardDose = state.cardDose || {};
    const dosePressure = state.mannerSwitch.lastAdvance?.pressure;
    if (dosePressure && dosePressure !== 'neutral' && dosePressure !== 'concession') {
      const entry = (state.cardDose[dosePressure] = state.cardDose[dosePressure] || { seen: 0, dose: 1 });
      if (entry.seen > 0) entry.dose = Math.min(3, entry.seen + 1);
      entry.seen += 1;
      cardOptions = { exemplars: entry.dose >= 2, licence: entry.dose >= 3 };
      state.mannerSwitch.currentDose = entry.dose;
    } else {
      state.mannerSwitch.currentDose = null;
    }
  }
  state.mannerSwitch.card = tutorStubMannerCard(state.mannerSwitch, cardOptions);
  // Crossed-effects experiment knob (card: adaptive-causality-crossed-effects).
  // TUTOR_STUB_CARD_FORCE='9=settled_claim,10=stake' forces the named card
  // at the named tutor turn regardless of detection ('none' suppresses).
  // Fixed/random/oracle policies are realized by the launcher setting this
  // per dialogue; the router arm leaves it unset. Stamped in-trace.
  if (CARD_FORCE_MAP && CARD_FORCE_MAP.has(tutorTurn)) {
    const forced = CARD_FORCE_MAP.get(tutorTurn);
    const naturalCard = state.mannerSwitch.card;
    state.mannerSwitch.card =
      forced === 'none'
        ? null
        : forced.startsWith('quiet:')
          ? tutorStubQuietStateCard(forced.slice(6))
          : tutorStubMannerCard({ lastAdvance: { pressure: forced } }, cardOptions);
    if (recordTrace) {
      appendTraceEvent(state.trace, {
        type: 'tutor_card_force',
        turn: tutorTurn,
        forced,
        displacedNaturalCard: Boolean(naturalCard),
        cardActive: Boolean(state.mannerSwitch.card),
      });
    }
  }
  // Phase Q2 (TUTOR_STUB_QUIET_DETECTOR=1): typed quiet-state detection on
  // card-silent turns. A move card outranks it — pressure is never quiet.
  if (QUIET_DETECTOR_ENABLED && !state.mannerSwitch.card) {
    state.quietDetector = state.quietDetector || createTutorStubQuietDetectorState();
    const detection = detectTutorStubQuietState(state.quietDetector, learnerText, {
      pressure: state.mannerSwitch.lastAdvance?.pressure || null,
    });
    state.mannerSwitch.card = tutorStubQuietStateCard(detection.type);
    if (recordTrace) {
      appendTraceEvent(state.trace, {
        type: 'tutor_quiet_detect',
        turn: tutorTurn,
        quietType: detection.type,
        version: state.quietDetector.version,
        cardActive: Boolean(state.mannerSwitch.card),
      });
    }
  }
  // Phase Q1 (TUTOR_STUB_QUIET_CHECK=<gap>): harness-timed quiet-repair card
  // on long pressure-silent stretches. A move card outranks it — pressure is
  // never quiet — so the quiet card fills only card-silent turns.
  if (QUIET_CHECK_GAP && !state.mannerSwitch.card) {
    state.quietCheck = state.quietCheck || createTutorStubQuietCheckState({ gapAt: QUIET_CHECK_GAP });
    advanceTutorStubQuietCheck(state.quietCheck, {
      turn: tutorTurn,
      pressure: state.mannerSwitch.lastAdvance?.pressure || null,
    });
    state.mannerSwitch.card = tutorStubQuietCheckCard(state.quietCheck);
    if (recordTrace) {
      appendTraceEvent(state.trace, {
        type: 'tutor_quiet_check',
        schema: TUTOR_STUB_QUIET_CHECK_SCHEMA,
        turn: tutorTurn,
        ...state.quietCheck.lastAdvance,
        cardActive: Boolean(state.mannerSwitch.card),
      });
    }
  } else if (QUIET_CHECK_GAP && state.quietCheck) {
    // Pressure turn: the quiet counter resets through advance so stretches
    // are measured between pressures, not across them.
    advanceTutorStubQuietCheck(state.quietCheck, {
      turn: tutorTurn,
      pressure: state.mannerSwitch.lastAdvance?.pressure || 'pressure',
    });
  }
  if (recordTrace) {
    appendTraceEvent(state.trace, {
      type: 'tutor_manner_switch',
      schema: TUTOR_STUB_MANNER_SWITCH_SCHEMA,
      turn: tutorTurn,
      ...state.mannerSwitch.lastAdvance,
      cardActive: Boolean(state.mannerSwitch.card),
      cardsVersion: CARD_DOSE_LADDER
        ? 'mc-v4-dose-ladder'
        : CARD_LICENCE_ENABLED
          ? TUTOR_STUB_MOVE_CARDS_LICENCE_VERSION
          : CARD_EXEMPLARS_ENABLED
            ? TUTOR_STUB_MOVE_CARDS_EXEMPLAR_VERSION
            : TUTOR_STUB_MOVE_CARDS_VERSION,
      dose: state.mannerSwitch.currentDose ?? null,
    });
  }
  return state.mannerSwitch;
}

function updateReleasePacingForLearnerTurn({
  learnerText,
  state,
  classification,
  tutorLearnerDag,
  tutorTurn,
  recordTrace = true,
}) {
  updateMannerSwitchForLearnerTurn({ learnerText, state, tutorTurn, recordTrace });
  // Frozen pacing (TUTOR_STUB_RELEASE_PACING=fixed): the stress bench needs a
  // controlled timetable — planted impatience otherwise reads as an accelerate
  // signal and compresses the world, giving arms unequal plant exposure
  // (observed 2026-07-31: a book arm closed at turn 15 and saw 4 of 11
  // plants). Freezing blinds the pacing engine's signal inputs; the authored
  // schedule runs at speed 1.
  const pacingFrozen = process.env.TUTOR_STUB_RELEASE_PACING === 'fixed';
  const releasePacing = advanceTutorStubReleasePacing({
    pacing: state.releasePacing,
    world: state.world,
    turn: tutorTurn,
    learnerText: pacingFrozen ? '' : learnerText,
    classification: pacingFrozen ? null : classification,
    tutorLearnerDag,
    conversationalCompletion: pacingFrozen ? null : tutorLearnerDag?.conversationalCompletion || null,
  });
  if (!releasePacing) return null;
  if (recordTrace) {
    appendTraceEvent(state.trace, {
      type: 'release_pacing_update',
      ...(pacingFrozen ? { pacingFrozen: true } : {}),
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

function responseConfigurationContext(
  selection,
  { multipleChoice = false, humanDiscourseFrame = null, dialogueClosureFrame = null, world = null } = {},
) {
  return projectTutorStubResponsePolicyContext(selection, {
    multipleChoice,
    humanDiscourseFrame,
    dialogueClosureFrame,
    world,
    ledgerTerm: worldLedgerTerm(world),
  });
}

function registerTemperatureApplies(policy) {
  return REGISTER_TEMPERATURE_POLICIES.has(String(policy || ''));
}

function dagTurnContext(state, tutorTurn, tutorLearnerDagModel = null) {
  const world = state?.world;
  if (!world) return '';
  const learnerDagModel = tutorLearnerDagModel?.model || tutorLearnerDagModel || null;
  const learnerGroundedSurfaceKeys = new Set(
    (learnerDagModel?.learnerRecord?.grounded || []).map((row) => tutorPromptSurfaceKey(row?.surface)).filter(Boolean),
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

const callTutor = createTutorStubTutorTurnPipeline({
  PROGRAM2_COMMITTEE_SCHEMA,
  appendTraceEvent,
  attachTutorGuardAccounting,
  auditTutorResponseLeak,
  auditTutorStubDialogueClosureResponse,
  auditTutorStubDramaticReleaseResponse,
  auditTutorStubGenerousInferenceResponse,
  auditTutorStubLiveSourceActionAlignmentV1,
  auditTutorStubLiveTurnProgressionV1,
  auditTutorStubPrompt,
  auditTutorStubQuestionSupportResponse,
  auditTutorStubReleaseDelivery,
  auditTutorStubRepetitionResponse,
  auditTutorStubResponseComposition,
  auditTutorStubResponseConfiguration,
  auditTutorStubSelfCorrectionDisclosure,
  auditTutorStubSpeakerPrivilege,
  buildCommitteeCompositionBlock,
  buildTutorGuardAccounting,
  buildTutorStubDramaticReleaseFrame,
  buildTutorStubFirstDraftContract,
  buildTutorStubResponseCompositionFrame,
  buildTutorStubSimplifiedRecoveryConfiguration,
  callAI,
  callAIWithCliBridge,
  classifierTutorContext,
  committedReleaseRows,
  committeeFallbackBatteryPass,
  committeeMiniGenerate,
  compileTutorStubPerformanceObligationContract,
  composeTutorStubFallbackWithUptake,
  composeTutorStubGuardUptakeDevelopment,
  createConsoleTokenSink,
  currentReleaseRows,
  dagTurnContext,
  detectTutorStubSelfCorrectionDisclosure,
  deterministicGenerousInferenceFallback,
  deterministicTutorStubClosureResponse,
  deterministicTutorStubConfiguredContinuationFallback,
  deterministicTutorStubContextualFallback,
  deterministicTutorStubDramaticReleaseFallback,
  deterministicTutorStubLearnerUptake,
  deterministicTutorStubTurnProgressionHandoff,
  deterministicTutorStubTurnProgressionUptake,
  deterministicTutorStubWritableEntryUptake,
  exactTutorRepairSpans,
  formatTutorStubResponseComposition,
  humanDiscourseTutorContext,
  isCliProvider,
  jsonClone,
  prepareTutorStubDueClueUptake,
  providerSupportsStreaming,
  reconcileTutorStubPointOfActionHandoffEligibility,
  recoverTutorStubDuplicateInstructionLines,
  recoverTutorStubSpeakerPrompt,
  repairTutorStubMissingActorialPart,
  repairTutorStubMissingClarificationInvitation,
  repairTutorStubThirdPersonSourceLeadIn,
  repairTutorStubUnanswerableOpenRecall,
  reserveProgram2ProviderBudget,
  reserveTutorStubMeteredModelCall,
  resolveTutorStubPublicCounterpressure,
  runCommitteeBattery,
  sanitizeTutorStubSpeakerAdvisory,
  selectCommitteeCompositionQuestion,
  snapshotTutorStubPublicPremiseIds,
  speakerAdvisoryBlocks: SPEAKER_ADVISORY_BLOCKS,
  styleGuardsAdvisory: process.env.TUTOR_STUB_STYLE_GUARDS_ADVISORY === '1',
  guardBoundaryPolicy: process.env.TUTOR_STUB_GUARD_POLICY === 'shadow_advisory' ? 'shadow_advisory' : 'strict',
  // Q3: TUTOR_STUB_CORRUPT_RELIEF=1 demotes ALL hard guard issues to
  // advisory at deliberately-corrupted turns so the model's repair ships.
  corruptReliefTurn: (turn) => process.env.TUTOR_STUB_CORRUPT_RELIEF === '1' && automatedLearnerCorruptionEnabled(turn),
  // Untangling 1: TUTOR_STUB_CLUE_INSERTION=1 keeps the model draft at
  // release-only failures and appends the due clue's rendered sentences.
  clueInsertion: process.env.TUTOR_STUB_CLUE_INSERTION === '1',
  composeClueSpanReplacement: composeTutorStubClueSpanReplacement,
  // Phase S revisit: TUTOR_STUB_CARD_AFTER_LEARNER=1 places the manner card
  // after the learner's line — the last thing the model reads (P1 finding).
  cardAfterLearner: process.env.TUTOR_STUB_CARD_AFTER_LEARNER === '1',
  renderTutorStubDueSource,
  stateRunDebugId,
  streamAI,
  trimCommitteeFallback,
  tutorCoachGuidanceContext,
  tutorGuardAttemptEnvelope,
  tutorLearnerDagModelContext,
  tutorMessageContext,
  tutorResponseRecoveryPrompt,
  tutorStubActorialPerformanceMayBeAdvisory,
  tutorStubComprehensionPrompt,
  tutorStubDirectorGuidancePrompt,
  tutorStubDisclosableGuardCorrection,
  tutorStubFirstDraftContractPrompt,
  tutorStubGuardDeliveryDecision,
  tutorStubGuardIssueRows,
  tutorStubLearnerRequestedPlainStyle,
  tutorStubLearnerSelectedToolMarkPath,
  tutorStubLiveResponseConfigurationSurface,
  tutorStubPlainRecoveryAllowsActorialAdvisory,
  tutorStubPointOfActionPrompt,
  tutorStubPointOfActionTargetText,
  tutorStubSelfCorrectionDisclosurePrompt,
  tutorStubSimplifiedRecoveryPrompt,
  tutorStubSubstantiveLearnerEcho,
  tutorStubTerminalFallbackFailureMessage,
  tutorStubTuningTurnAdvisory,
  tutorStubTurnFeedbackPrompt,
  worldLedgerTerm,
});

function saveTranscript(filePath, transcript) {
  fs.writeFileSync(filePath, `${JSON.stringify(transcript, null, 2)}\n`);
}

const { runAutomatedLearnerDialogue, runOneTurn } = createTutorStubTurnOrchestration({
  C,
  ROOT,
  TUTOR_GUARD_ACCOUNTING_SCHEMA,
  TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE,
  TUTOR_STUB_QUARANTINE_CONTINUATION,
  acknowledgeTutorStubOpeningRelease,
  advanceTutorStubDialogueClosure,
  analyzeLearnerTurn,
  appendTraceEvent,
  appendTutorStubTurnFailureTraceRecords,
  applyTutorStubComprehensionResponse,
  applyTutorStubConversationalCompletionSelection,
  applyTutorStubPointOfActionConstraint,
  assertTutorStubTurnAttemptCurrent,
  auditTutorResponseLeak,
  auditTutorStubFeedbackAdaptation,
  auditTutorStubPointOfActionCompliance,
  auditTutorStubQuarantineContinuation,
  auditTutorStubReleaseDelivery,
  auditTutorStubRepetitionResponse,
  auditTutorStubResponseConfiguration,
  automatedLearnerProfileId,
  automaticTechnicalDetailsEnabled,
  buildDynamicalSystemState,
  buildHumanDiscourseFrame,
  buildTutorInterimContext,
  buildTutorOpening,
  buildTutorStubDramaticReleaseFrame,
  buildTutorStubFeedbackAdaptationPlan,
  buildTutorStubFeedbackObservation,
  buildTutorStubObservedAudits,
  buildTutorStubPointOfActionTurn,
  buildTutorStubStateObservation,
  callTutor,
  classifyTutorStubDiagnosticFailure,
  closePriorTypedAction,
  commitTutorStubReleasePacing,
  createTutorStubLearnerResponseProvenance,
  currentReleaseRows,
  deterministicAutomatedLearnerFallback,
  enforceAutomatedLearnerProfile,
  findTutorStubFeedbackTargetTurn,
  generateAutomatedLearnerTurn,
  jsonClone,
  learnerProfileSpeakerLabel,
  openingDebugId,
  path,
  planTypedAction,
  printDirectorPreludeBeforeFirstTutor,
  printExplanatoryDebugTurn,
  printOpeningDebugLine,
  printResponseDetails,
  printTurnDebugLine,
  printTutorDagSnapshot,
  printTutorResponse,
  printWithConcurrentTerminal,
  recordTutorStubTuningFeedback,
  recordTutorStubTurnTiming,
  restoreTutorStubDiagnosticTransaction,
  snapshotTutorStubDiagnosticTransaction,
  startInterimAnimation,
  stateRunDebugId,
  stopInterimAnimation,
  turnDebugId,
  tutorCoachGuidanceEntries,
  tutorDialogueClosureFrameForTurn,
  tutorMessageContext,
  tutorStubComprehensionSnapshot,
  tutorStubDirectorGuidanceEntry,
  tutorStubLearnerDagGrounded,
  tutorStubNewEvidenceAvailable,
  tutorStubReleasePacingSnapshot,
  writeFieldVisualization,
});

async function main() {
  if (args.help) {
    printHelp();
    return;
  }
  if (args['list-labs']) {
    console.log(formatTutorStubLabList());
    return;
  }
  if (args.features) {
    printTutorStubFeatureMap();
    return;
  }
  if (args['list-worlds']) {
    printWorlds();
    return;
  }
  if (args['list-curriculum-modules']) {
    if (!args.curriculum) throw new Error('--list-curriculum-modules requires --curriculum <workplan|path>');
    printCurriculumModules(args.curriculum);
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
  if (selectedLabResolution) {
    assertTutorStubLabRequirements(selectedLabResolution, args);
    selectedLabAdmission = resolveTutorStubMeteredLabAdmission(selectedLabResolution, args);
    selectedLabModelCallBudget = createTutorStubModelCallBudget(selectedLabAdmission);
  }
  const resumeRequested = Boolean(args.resume || args['resume-last']);
  const requestedLaunchMode = normalizeTutorStubLaunchMode(args['launch-mode'], { allowEmpty: true });
  if (args['labelling-game'] && requestedLaunchMode && requestedLaunchMode !== 'labelling-game') {
    throw new Error('--labelling-game conflicts with --launch-mode chat');
  }
  const launchPickerEnabled = !args['labelling-game'] && !requestedLaunchMode && defaultLaunchModePickerAvailable();
  let launchMode = args['labelling-game'] ? 'labelling-game' : requestedLaunchMode || 'chat';
  if (launchPickerEnabled) {
    console.log(`${C.brightCyan}${C.bold}Machine Spirits${C.reset}`);
    console.log(`${C.dim}Choose a mode${C.reset}\n`);
    const selection = await pickTutorStubLaunchModeWithKeyboard('chat');
    if (!selection) return;
    launchMode = selection.id;
  }
  while (launchMode === 'labelling-game') {
    if (launchPickerEnabled) console.log(`${C.cyan}${C.bold}mode >${C.reset} Labelling game\n`);
    await runLabellingGameCli({
      datasetId: args['label-dataset'],
      coderId: args['label-coder'],
    });
    if (!launchPickerEnabled) return;
    console.log(`\n${C.dim}Choose a mode${C.reset}\n`);
    const selection = await pickTutorStubLaunchModeWithKeyboard('chat');
    if (!selection) return;
    launchMode = selection.id;
  }
  if (launchPickerEnabled) {
    const chatMode = args.lab === 'mixed_drafting' ? 'Mixed tutor chat' : 'Tutor chat';
    console.log(`${C.cyan}${C.bold}mode >${C.reset} ${chatMode}\n`);
  }

  args.theme = normalizeTutorStubCliThemeId(args.theme, { strict: true });
  args.motion = normalizeTutorStubCliMotion(args.motion, { strict: true });
  configureCliPresentation({
    theme: args.theme,
    motion: args.motion,
    noColor: args['no-color'],
  });

  const explicitPointOfActionArm =
    commandLineOptionProvided('point-of-action-arm') || Boolean(process.env.TUTOR_STUB_POINT_OF_ACTION_ARM);
  if (args.committee && args['no-committee']) {
    throw new Error('--committee and --no-committee cannot be used together');
  }
  if (
    args.committee &&
    explicitPointOfActionArm &&
    normalizeTutorStubPointOfActionArm(args['point-of-action-arm']) !== 'committee'
  ) {
    throw new Error('--committee conflicts with the explicit --point-of-action-arm value');
  }
  if (args['no-committee'] && explicitPointOfActionArm) {
    throw new Error('--no-committee conflicts with --point-of-action-arm');
  }
  if (args.committee) args['point-of-action-arm'] = 'committee';
  if (args['no-committee']) args['point-of-action-arm'] = '';

  const passthroughEnabled = Boolean(args.passthrough);
  const observedAuditsEnabled = Boolean(args['observe-audits']);
  if (observedAuditsEnabled && !passthroughEnabled) {
    // A guarded run already evaluates all seven audits and records them as
    // guard results. Accepting the flag there would write a second, weaker copy
    // of two of them under a name that promises no enforcement, which is a
    // reading hazard rather than a feature.
    throw new Error(
      '--observe-audits requires --passthrough: a guarded run already records these audits as enforced guard results',
    );
  }
  if (passthroughEnabled) {
    args.dag = false;
    args['tutor-learner-dag'] = false;
    args['no-classifier'] = true;
    args['no-register-selection'] = true;
    args['typed-actions'] = false;
    args['point-of-action-arm'] = '';
    // Passthrough defaults to pure human chat, but an evaluation harness needs a
    // genuinely bare arm that still talks to itself: passthrough is the only
    // mode that bypasses the guard suite, first-draft recovery and the closure
    // lifecycle, and a bare arm is useless as a comparison if nobody answers it.
    // An explicit --auto-learner therefore survives; everything else passthrough
    // strips stays stripped, and the automated-learner labs still gate the flag.
    if (!commandLineOptionProvided('auto-learner')) args['auto-learner'] = false;
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
  if (commandLineOptionProvided('learner-character')) {
    if (
      commandLineOptionProvided('auto-learner-profile') &&
      String(args['auto-learner-profile']).trim() !== String(args['learner-character']).trim()
    ) {
      throw new Error('--learner-character conflicts with --auto-learner-profile');
    }
    args['auto-learner-profile'] = args['learner-character'];
  }
  const interactiveSessionIntent = Boolean(!args['auto-learner'] && !args.once && !positionals.join(' ').trim());
  const explicitRememberedSources = rememberedSettingExplicitSources();
  const rememberedSettings = applyRememberedInteractiveDefaults({
    interactiveSessionEnabled: interactiveSessionIntent,
  });
  if (
    interactiveSessionIntent &&
    !passthroughEnabled &&
    !explicitRememberedSources.committeeEnabled &&
    !rememberedSettings.appliedFields.includes('committee_mode')
  ) {
    args['point-of-action-arm'] = 'committee';
  }
  const committeeFallbackPolicyExplicit =
    commandLineOptionProvided('committee-fallback-policy') || Boolean(process.env.TUTOR_STUB_COMMITTEE_FALLBACK_POLICY);
  if ((args.committee || (interactiveSessionIntent && !passthroughEnabled)) && !committeeFallbackPolicyExplicit) {
    args['committee-fallback-policy'] = DEFAULT_INTERACTIVE_COMMITTEE_FALLBACK_POLICY;
  }
  args['committee-fallback-policy'] = String(args['committee-fallback-policy'] || '')
    .trim()
    .toLowerCase();
  if (!['v1', 'v2'].includes(args['committee-fallback-policy'])) {
    throw new Error('--committee-fallback-policy must be v1 or v2');
  }
  if (args.module && !args.curriculum) {
    throw new Error('--module requires --curriculum <workplan|path>');
  }
  let curriculumBundle = null;
  let curriculumRuntime = null;
  if (args.curriculum) {
    if (args.system) throw new Error('--curriculum cannot be combined with --system because --system replaces it');
    if (args.dag || args['tutor-learner-dag']) {
      throw new Error(
        'A canonical curriculum module is not a proof DAG. Remove --dag/--tutor-learner-dag, or hand-author and validate a dramatic-derivation world for this module.',
      );
    }
    if (commandLineOptionProvided('world') && !['none', 'off', 'false'].includes(String(args.world).toLowerCase())) {
      throw new Error(
        '--curriculum cannot be combined with an active --world; use the curriculum module or a separately authored world',
      );
    }
    curriculumBundle = tutorStubCurriculumBundle(args.curriculum, args.module, { root: ROOT });
    curriculumRuntime = createTutorStubCurriculumRuntime(curriculumBundle, { moduleId: curriculumBundle.module.id });
    // A remembered scenario must not silently costume or constrain reflective
    // curriculum work. The curriculum source is complete public context and
    // intentionally runs without a scenario proof DAG.
    args.world = 'none';
  }
  args.theme = normalizeTutorStubCliThemeId(args.theme, { strict: true });
  args.motion = normalizeTutorStubCliMotion(args.motion, { strict: true });
  configureCliPresentation({
    theme: args.theme,
    motion: args.motion,
    noColor: args['no-color'],
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
  const voiceModel = normalizeTutorStubVoiceModel(args['voice-model']);
  const voiceName = normalizeTutorStubVoiceName(args['voice-name']);
  const voiceLaunchRequested = Boolean(args.voice);
  const registerTemperature = normalizeTutorStubEngagementStanceTemperature(args['register-temperature'], {
    label: '--register-temperature',
  });
  // Recipe replay marks captured options as resolved launch sources, including
  // an explicitly captured `light-adaptation: false`. Treat the boolean value,
  // not mere option presence, as the opt-in/opt-out signal so passthrough
  // recipes remain valid and deterministic.
  const lightAdaptationCliOptIn = commandLineOptionProvided('light-adaptation') && Boolean(args['light-adaptation']);
  const lightAdaptationCliOptOut =
    commandLineOptionProvided('no-light-adaptation') && Boolean(args['no-light-adaptation']);
  if (lightAdaptationCliOptIn && lightAdaptationCliOptOut) {
    throw new Error('--light-adaptation cannot be combined with --no-light-adaptation');
  }
  const lightAdaptationRemembered = rememberedSettings.appliedFields.includes('light_adaptation');
  const lightAdaptationRequested = lightAdaptationCliOptOut
    ? false
    : lightAdaptationCliOptIn
      ? true
      : lightAdaptationRemembered
        ? Boolean(args['light-adaptation'])
        : process.env.TUTOR_STUB_LIGHT_ADAPTATION !== undefined
          ? STUB.lightAdaptation
          : interactiveSessionIntent && !passthroughEnabled;
  const lightAdaptationAvailable = Boolean(!passthroughEnabled && !args['no-register-selection']);
  const lightAdaptationEnabled = Boolean(lightAdaptationRequested && lightAdaptationAvailable);
  // Session recipes and config hashes record the effective value rather than
  // the raw parser default, so relaunches reproduce this mode boundary.
  args['light-adaptation'] = lightAdaptationEnabled;
  args['no-light-adaptation'] = !lightAdaptationEnabled;
  const lightAdaptationThreshold = normalizeTutorStubLightAdaptationThreshold(args['light-adaptation-threshold']);
  const lightAdaptationExplicitOptIn = lightAdaptationCliOptIn || process.env.TUTOR_STUB_LIGHT_ADAPTATION === '1';
  if (lightAdaptationExplicitOptIn && passthroughEnabled) {
    throw new Error('--light-adaptation is unavailable in --passthrough because learner assessment is disabled');
  }
  if (lightAdaptationExplicitOptIn && args['no-register-selection']) {
    throw new Error('--light-adaptation requires teaching-style selection; remove --no-register-selection');
  }
  const dagFactDropoutRate = normalizeTutorStubDagFactDropoutRate(args['dag-fact-dropout'], {
    label: '--dag-fact-dropout',
  });
  const dagFactDropoutSeed = normalizeTutorStubDagFactDropoutSeed(args['dag-fact-dropout-seed'], {
    label: '--dag-fact-dropout-seed',
  });
  const releaseSpeed = normalizeTutorStubReleaseSpeed(args['release-speed'], {
    label: '--release-speed',
  });
  const loopMode = normalizeTutorStubLoopMode(args['loop-mode'], { label: '--loop-mode' });
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
  const responseDetailsEnabled = Boolean(STUB.responseDetails && !args['no-response-details']);
  const learnerSuggestionEnabled = Boolean(
    !passthroughEnabled && (autoLearnerEnabled || mixedLearnerEnabled || interactiveSessionEnabled),
  );
  // Suggesting learner turns to a human is a harness feature and stays off under
  // passthrough. Resolving a learner model is not the same question: if the
  // automated learner is going to speak, it needs a model whatever the tutor is
  // running. Keeping these separate is what lets an evaluation harness point a
  // learner at a bare tutor.
  const learnerModelRequired = Boolean(learnerSuggestionEnabled || autoLearnerEnabled);
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
    !resumeRequested &&
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
  const effectiveTopic =
    curriculumBundle && args.topic === STUB.topic
      ? curriculumBundle.module.title
      : worldBundle && args.topic === STUB.topic
        ? worldBundle.world.title
        : args.topic;
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
    curriculumBundle,
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
  if (curriculumBundle && curriculumRuntime) {
    systemPrompt = `${systemPrompt}\n\n${delimitedPrompt(
      CURRICULUM_PHASE_PROMPT_START,
      tutorStubCurriculumPrivatePrompt(curriculumBundle, curriculumRuntime),
      CURRICULUM_PHASE_PROMPT_END,
    )}`;
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
  let autoLearnerResolved = learnerModelRequired ? resolveModel(args['auto-learner-model']) : null;
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
    (combinedLearnerAnalysisEnabled ||
      randomRegisterSelectionEnabled ||
      negativeRegisterSelectionEnabled ||
      lightAdaptationEnabled),
  );
  const requestedTutorCharacter = resolveTutorStubCharacterChoice(args['tutor-character']);
  const initialTutorCharacter =
    requestedTutorCharacter.raw && !requestedTutorCharacter.clearing ? requestedTutorCharacter.id : null;
  if (initialTutorCharacter && !requestedTutorCharacter.options.includes(initialTutorCharacter)) {
    throw new Error(`--tutor-character must be one of ${requestedTutorCharacter.options.join(', ')}, or auto`);
  }
  if (initialTutorCharacter && !registerSelectionEnabled) {
    throw new Error(
      '--tutor-character requires adaptive delivery; remove --no-register-selection and enable learner analysis',
    );
  }
  let classifierResolved =
    classifierEnabled && !combinedLearnerAnalysisEnabled ? resolveModel(args['classifier-model']) : null;
  let classifierProviderConfig = classifierResolved ? getProviderConfig(classifierResolved.provider) : null;
  let learnerRecordResolved = tutorLearnerDagEnabled ? resolveModel(args['learner-record-model']) : null;
  let learnerRecordProviderConfig = learnerRecordResolved ? getProviderConfig(learnerRecordResolved.provider) : null;
  const firstMessage = args.once || positionals.join(' ').trim() || '';
  if (
    rawCommandLineOptionProvided('training-reuse') &&
    rawCommandLineOptionProvided('no-training-reuse') &&
    args['no-training-reuse']
  ) {
    throw new Error('--training-reuse cannot be combined with --no-training-reuse');
  }
  const requestedTrainingReuse = args['no-training-reuse']
    ? 'off'
    : normalizeTutorStubTrainingReuseSetting(args['training-reuse'], { label: '--training-reuse' });
  const humanSubjectClass = normalizeTutorStubHumanSubjectClass(args['human-subject-class'], {
    label: '--human-subject-class',
  });
  const trainingReuseConfig = resolveTutorStubTrainingReuse({
    requested: requestedTrainingReuse,
    source: resolvedTrainingReuseSource(rememberedSettings),
    humanSubjectClass,
    humanSubjectClassSource: resolvedHumanSubjectClassSource(),
    humanInputExpected: Boolean(interactiveSessionIntent || firstMessage),
  });
  // Recipes store the canonical requested value. The effective status remains
  // fail-closed for external/unknown users and is recorded separately.
  args['training-reuse'] = trainingReuseConfig.requested;
  args['human-subject-class'] = trainingReuseConfig.declaredHumanSubjectClass;
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
  const closeoutReportEnabled = Boolean(STUB.closeoutReport && !args['no-closeout-report']);
  const dialogueClosureConfig = createTutorStubDialogueClosureLifecycle({
    enabled: Boolean(
      args.dag && worldBundle && (!autoLearnerEnabled || (tutorLearnerDagEnabled && autoStopOnGrounded)),
    ),
    allowCheckIn: Boolean(!autoLearnerEnabled && !firstMessage),
    allowAuthoredDagClosure: Boolean(!autoLearnerEnabled),
  });
  const cliEffort = normalizeCliEffort(args['cli-effort']);
  const learnerAnalysisPromptProfile = normalizeTutorStubPublicLearnerAnalysisPromptProfile(
    args['learner-analysis-prompt-profile'],
  );
  const learnerAnalysisEvidenceUseRubric = normalizeTutorStubEvidenceUseRubric(
    args['learner-analysis-evidence-use-rubric'],
  );
  const mixedTutorPrefetchPolicy = String(args['mixed-tutor-prefetch-policy'] || 'always')
    .trim()
    .toLowerCase();
  if (!['always', 'analysis_only'].includes(mixedTutorPrefetchPolicy)) {
    throw new Error('--mixed-tutor-prefetch-policy must be always or analysis_only');
  }
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
  const resumeCandidate = resolvedResumeSource;
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
  const instantExistingScenarioOpening = Boolean(
    interactiveSessionEnabled &&
    openingEnabled &&
    !firstMessage &&
    !resumeRequested &&
    rememberedScenarioAvailable &&
    rememberedDialogueSettingsAvailable &&
    !initialMixedLearnerSetupEnabled,
  );
  const startupOpeningRealizer =
    openingFramePreview.realization === 'authored_world_opening'
      ? 'authored_world_opening'
      : instantExistingScenarioOpening
        ? 'deterministic'
        : openingRealizer;
  const openingConfig = {
    enabled: openingEnabled,
    printedByDefault: Boolean(openingEnabled && !firstMessage),
    schema: openingFramePreview.schema,
    realization:
      startupOpeningRealizer === 'authored_world_opening'
        ? startupOpeningRealizer
        : startupOpeningRealizer === 'model'
          ? 'speaking_tutor_model'
          : instantExistingScenarioOpening
            ? 'remembered_scenario_instant_opening'
            : 'world_grounded_deterministic',
    speakingModelRef: startupOpeningRealizer === 'model' ? args.model : null,
    authoredTextAvailable: Boolean(openingFramePreview.authoredText),
    requirements: TUTOR_STUB_OPENING_REQUIREMENTS,
    safetyAudit: true,
    fallback: 'world_grounded_safe_fallback',
    startup: {
      mode: instantExistingScenarioOpening ? 'instant_existing_scenario' : 'normal',
      restoredScenario: rememberedScenarioAvailable,
      blocksOnOpeningModel: startupOpeningRealizer === 'model',
      blocksOnMixedPrefetch: Boolean(mixedLearnerEnabled && !instantExistingScenarioOpening),
    },
  };
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
        : resumeRequested
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
      learner: ['/mode learner'],
      coach: ['/mode coach [guidance]', '/coach [guidance]'],
      auto: ['/mode auto [turns]', '/auto [turns]'],
      demo: ['/demo [turns]'],
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
    demo: {
      launchRequested: Boolean(args.demo),
      command: '/demo [turns]',
      defaultTurns: DEFAULT_INTERACTIVE_DEMO_TURNS,
      maxTurns: MAX_INTERACTIVE_DEMO_TURNS,
      sequence: ['bounded_live_dialogue', 'plain_analysis', 'transcript_html', 'compact_outcome_report'],
      returnsControl: true,
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
    learnerResponseProvenance: {
      schema: TUTOR_STUB_LEARNER_RESPONSE_PROVENANCE_SCHEMA,
      categories: ['human', 'ai', 'hybrid', 'unknown'],
      recordedOn: ['learner_message_fragment', 'completed_turn', 'trace_event', 'html_transcript', 'learning_summary'],
      humanSources: ['terminal', 'voice_transcription', 'command_line_argument'],
      aiSources: ['automated_learner', 'mixed_suggestion_accepted'],
      hybridSource: 'mixed_suggestion_edited',
      compoundAggregation: true,
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
      escape: 'disable_for_session',
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
  const responseDetailsConfig = {
    schema: 'machinespirits.tutor-stub.response-details.v1',
    enabled: responseDetailsEnabled,
    defaultOn: true,
    scope: 'terminal_session',
    order: 'before_tutor_speech',
    timingSchema: 'machinespirits.tutor-stub.turn-timing.v1',
    timingScope: 'foreground_wait_from_accepted_learner_input',
    command: '/details on|off|status',
    launchFlag: '--no-response-details',
    environment: 'TUTOR_STUB_RESPONSE_DETAILS=0',
    publicTranscriptChanged: false,
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
    requestSurface: passthroughEnabled ? ['system_setup', 'full_public_history', 'latest_learner_message'] : null,
    // Observation is not a bypass reversal: every entry in `bypassed` below
    // stays bypassed with this on. The audits run after the draft is final and
    // cannot send it back, so the call count and request surface are unchanged.
    observedAudits: observedAuditsEnabled,
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
  const capabilitySnapshot = resolveTutorStubCapabilities({
    passthrough: passthroughEnabled,
    interactive: interactiveSessionEnabled,
    world: Boolean(worldBundle),
    curriculum: Boolean(curriculumBundle),
    dag: Boolean(args.dag && worldBundle),
    learnerDag: tutorLearnerDagEnabled,
    classifier: classifierEnabled,
    registerSelection: registerSelectionEnabled,
    mixedLearner: mixedLearnerEnabled,
    autoLearner: autoLearnerEnabled,
    demo: Boolean(args.demo),
    turnFeedback: turnFeedbackEnabled,
    tuning: tuningMode !== 'off',
    voice: voiceLaunchRequested,
    trace: traceEnabled,
    fieldVisualization: fieldVisualizationEnabled,
    learningSummary: learningSummaryReportConfig.enabled,
    responseChecks: !passthroughEnabled,
  });
  assertTutorStubCapabilityCompatibility(capabilitySnapshot);
  const selectedLabMetadata = selectedLabResolution
    ? {
        ...tutorStubLabTraceMetadata(selectedLabResolution),
        resolvedCapabilities: [...capabilitySnapshot.active],
        admission: selectedLabAdmission,
      }
    : null;
  const sessionRecipe = buildTutorStubSessionRecipe({
    args,
    lab: selectedLabResolution?.lab?.id || null,
    identity: {
      schema: TUTOR_STUB_SESSION_RUNTIME_SCHEMA,
      world: worldBundle?.world?.id ? { id: worldBundle.world.id } : curriculumBundle ? { id: null } : null,
      prompt: {
        systemPromptHash: hashCanonicalJson({ systemPrompt }),
        tutorRolePromptHash: tutorInstance.rolePromptHash,
      },
      tutor: {
        ref: tuning.activeRef,
        rolePromptHash: tutorInstance.rolePromptHash,
      },
      models: {
        tutor: tutorStubRecipeModelIdentity(args.model, visibleModel),
        classifier: tutorStubRecipeModelIdentity(args['classifier-model'], visibleClassifierModel),
        reasoning: tutorStubRecipeModelIdentity(args['learner-record-model'], visibleLearnerRecordModel),
        learner: tutorStubRecipeModelIdentity(args['auto-learner-model'], visibleAutoLearnerModel),
      },
    },
  });
  const recipeDrift = loadedSessionRecipe
    ? compareTutorStubResumeRecipe(loadedSessionRecipe, sessionRecipe, {
        extraDrift: (loadedRecipeApplication?.explicitOverrides || []).map((entry) => ({
          ...entry,
          axis: `option.${entry.axis}`,
        })),
      })
    : null;
  if (recipeDrift) {
    assertTutorStubResumeCompatibility(recipeDrift, {
      acknowledgeDrift: args['acknowledge-drift'],
      context: 'recipe',
    });
  }
  const resumeDrift = resumeCandidate
    ? compareTutorStubResumeRecipe(resumeCandidate.recipe, sessionRecipe, {
        extraDrift: (resumeRecipeApplication?.explicitOverrides || []).map((entry) => ({
          ...entry,
          axis: `option.${entry.axis}`,
        })),
      })
    : null;
  if (resumeDrift) {
    assertTutorStubResumeCompatibility(resumeDrift, { acknowledgeDrift: args['acknowledge-drift'] });
  }
  const loadedRecipeProvenance = loadedSessionRecipe
    ? {
        source: path.relative(ROOT, loadedSessionRecipe.filePath),
        drift: recipeDrift,
        driftAcknowledged: Boolean(args['acknowledge-drift'] && !recipeDrift?.ok),
      }
    : null;
  if (args['write-recipe']) {
    loadedSessionRecipePath = writeTutorStubSessionRecipe({
      recipe: sessionRecipe,
      filePath: resolveWorkspacePath(args['write-recipe']),
    });
  }

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
          voice: {
            schema: 'machinespirits.tutor-stub.voice-runtime.v1',
            launchRequested: voiceLaunchRequested,
            model: voiceModel,
            voice: voiceName,
            transcriptionModel: 'gpt-realtime-whisper',
            apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
            automaticRealtimeResponses: false,
            authority: 'existing_cli_analysis_dag_register_guard_pipeline',
          },
          rememberedSettings: rememberedSettingsConfig,
          trainingReuse: trainingReuseConfig,
          lab: selectedLabMetadata,
          sessionRecipe,
          recipeFile: loadedSessionRecipePath ? path.relative(ROOT, loadedSessionRecipePath) : null,
          recipeSource: loadedRecipeProvenance,
          resume: resumeCandidate
            ? {
                source: path.relative(ROOT, resumeCandidate.filePath),
                runId: resumeCandidate.runId,
                turns: resumeCandidate.turns.length,
                migration: resumeCandidate.migration,
                drift: resumeDrift,
                driftAcknowledged: Boolean(args['acknowledge-drift'] && !resumeDrift?.ok),
              }
            : { requested: resumeRequested, found: false },
          passthrough: passthroughConfig,
          capabilities: capabilitySnapshot,
          sessionRuntime: {
            schema: TUTOR_STUB_SESSION_RUNTIME_SCHEMA,
            version: TUTOR_STUB_SESSION_RUNTIME_VERSION,
            lifecycle: ['create', 'load', 'resume', 'step', 'reset', 'finalize'],
            stateIsolation: 'per_runtime_instance',
            commandHandlers: 'registry_owned',
            traceEvents: 'versioned_session_event_envelopes',
          },
          topic: effectiveTopic,
          curriculum: curriculumBundle
            ? {
                id: curriculumBundle.curriculum.id,
                title: curriculumBundle.curriculum.title,
                sourceRef: curriculumBundle.sourceRef,
                sourceHash: curriculumBundle.curriculum.source?.source_hash || null,
                moduleId: curriculumBundle.module.id,
                moduleTitle: curriculumBundle.module.title,
                mode: 'public_reflective_non_dag',
                completionAuthority: curriculumRuntime.completionAuthority,
              }
            : null,
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
          loopExecution: {
            mode: loopMode,
            fixedPublicSafeQuarantine: loopMode === TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE,
            recoverableFailurePolicy:
              loopMode === TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE
                ? 'rollback_turn_state_commit_mechanical_quarantine_and_continue'
                : 'fail_fast',
          },
          experiment: experimentConfig,
          typedPedagogicalActions: typedActionConfig,
          responseConfiguration: {
            schema: 'machinespirits.tutor-stub.response-configuration.v3',
            primaryStanceField: 'engagement_stance',
            independentAxes: [
              'engagement_stance',
              'action_family',
              'addressee_profile',
              'lexical_accessibility',
              'scene_immersion',
              'actorial_part',
            ],
            temperatureScope: 'engagement_stance_and_actorial_part',
            transcriptVisibilityAudit: true,
          },
          randomPerformance: {
            available: registerSelectionEnabled,
            enabled: false,
            slashCommand: '/random',
            scope: ['engagement_stance', 'actorial_part'],
            assessmentInfluence: false,
            preservedControls: ['action_family', 'evidence_release', 'dialogue_closure', 'response_safety'],
          },
          lightAdaptation: {
            schema: TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA,
            available: registerSelectionEnabled,
            enabled: lightAdaptationEnabled,
            threshold: lightAdaptationThreshold,
            slashCommand: '/light on|off|status',
            settingsCommand: '/settings light on|off|status',
            defaultScope: 'adaptive_interactive_sessions',
            rememberedPreference: true,
            trigger: 'continued_learner_confusion_or_frustration',
            scope: ['engagement_stance', 'actorial_part'],
            selectionMethod: 'seeded_uniform_excluding_previous',
            preservedControls: [
              'action_family',
              'authored_evidence_source',
              'evidence_release',
              'dialogue_closure',
              'response_safety',
            ],
          },
          performanceDirectives: {
            available: registerSelectionEnabled,
            sessionOnly: true,
            register: null,
            character: initialTutorCharacter,
            slashCommands: ['/register', '/character'],
            precedence: 'light_adaptation_then_explicit_axis_then_random_axis_then_adaptive_policy',
          },
          promptArchitecture,
          learnerAnalysisPromptProfile,
          learnerAnalysisEvidenceUseRubric,
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
                tutorPrefetchPolicy: mixedTutorPrefetchPolicy,
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
          responseDetails: responseDetailsConfig,
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
                committee:
                  pointOfActionArm === 'committee'
                    ? {
                        model: args['committee-mini-model'],
                        fallbackPolicy: args['committee-fallback-policy'],
                        control: '/committee on|off|status',
                      }
                    : null,
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
            automatedLearnerBudgetFallback: {
              enabled: true,
              trigger: 'prompt_audit_budget_violation',
              mode: 'budget_window_public_replay',
              recentTurns: historyTurns,
              publicOnly: true,
            },
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
            activeInThisTerminal: Boolean(interimAnimationEnabled && output.isTTY && cliPresentation.motion !== 'off'),
          },
          presentation: tutorStubCliPresentationSnapshot(cliPresentation),
          fieldVisualization: {
            enabled: fieldVisualizationEnabled,
            dir: path.relative(ROOT, traceDir),
            automaticAfterTurns: fieldVisualizationEnabled,
            slashCommand: '/viz',
          },
          resumeLast: resumeRequested
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
  if (learnerModelRequired && !autoLearnerResolved.isConfigured && !isCliProvider(autoLearnerResolved.provider)) {
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
      trainingReuse: trainingReuseConfig,
      lab: selectedLabMetadata,
      sessionRecipe,
      recipeFile: loadedSessionRecipePath ? path.relative(ROOT, loadedSessionRecipePath) : null,
      recipeSource: loadedRecipeProvenance,
      resume: resumeCandidate
        ? {
            source: path.relative(ROOT, resumeCandidate.filePath),
            runId: resumeCandidate.runId,
            turns: resumeCandidate.turns.length,
            migration: resumeCandidate.migration,
            drift: resumeDrift,
            driftAcknowledged: Boolean(args['acknowledge-drift'] && !resumeDrift?.ok),
          }
        : { requested: resumeRequested, found: false },
      passthrough: passthroughConfig,
      capabilities: capabilitySnapshot,
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
      loopExecution: {
        mode: loopMode,
        fixedPublicSafeQuarantine: loopMode === TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE,
        recoverableFailurePolicy:
          loopMode === TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE
            ? 'rollback_turn_state_commit_mechanical_quarantine_and_continue'
            : 'fail_fast',
      },
      experiment: experimentConfig,
      typedPedagogicalActions: typedActionConfig,
      responseConfiguration: {
        schema: 'machinespirits.tutor-stub.response-configuration.v3',
        primaryStanceField: 'engagement_stance',
        independentAxes: [
          'engagement_stance',
          'action_family',
          'addressee_profile',
          'lexical_accessibility',
          'scene_immersion',
          'actorial_part',
        ],
        temperatureScope: 'engagement_stance_and_actorial_part',
        transcriptVisibilityAudit: true,
      },
      randomPerformance: {
        available: registerSelectionEnabled,
        enabled: false,
        slashCommand: '/random',
        scope: ['engagement_stance', 'actorial_part'],
        assessmentInfluence: false,
        preservedControls: ['action_family', 'evidence_release', 'dialogue_closure', 'response_safety'],
      },
      lightAdaptation: {
        schema: TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA,
        available: registerSelectionEnabled,
        enabled: lightAdaptationEnabled,
        threshold: lightAdaptationThreshold,
        slashCommand: '/light on|off|status',
        settingsCommand: '/settings light on|off|status',
        defaultScope: 'adaptive_interactive_sessions',
        rememberedPreference: true,
        trigger: 'continued_learner_confusion_or_frustration',
        scope: ['engagement_stance', 'actorial_part'],
        selectionMethod: 'seeded_uniform_excluding_previous',
        preservedControls: [
          'action_family',
          'authored_evidence_source',
          'evidence_release',
          'dialogue_closure',
          'response_safety',
        ],
      },
      performanceDirectives: {
        available: registerSelectionEnabled,
        sessionOnly: true,
        register: null,
        character: initialTutorCharacter,
        slashCommands: ['/register', '/character'],
        precedence: 'light_adaptation_then_explicit_axis_then_random_axis_then_adaptive_policy',
      },
      pointOfAction: pointOfActionArm
        ? {
            enabled: true,
            arm: pointOfActionArm,
            detectorVersion: 'step4-frozen-2026-07-14.v1',
            eligibleTurns: [3, 24],
            triggerPriority: ['stagnant_repeat', 'warrant_skip'],
            committee:
              pointOfActionArm === 'committee'
                ? {
                    model: args['committee-mini-model'],
                    fallbackPolicy: args['committee-fallback-policy'],
                    control: '/committee on|off|status',
                  }
                : null,
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
      learnerResponseProvenance: interactiveRoleModes.learnerResponseProvenance,
      interactiveRoleModes,
      turnFeedback: turnFeedbackConfig,
      responseDetails: responseDetailsConfig,
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
      learnerAnalysisPromptProfile,
      learnerAnalysisEvidenceUseRubric,
      mixedTutorPrefetchPolicy,
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
        automatedLearnerBudgetFallback: {
          enabled: true,
          trigger: 'prompt_audit_budget_violation',
          mode: 'budget_window_public_replay',
          recentTurns: historyTurns,
          publicOnly: true,
        },
      },
      opening: openingConfig,
      closeoutReport: { enabled: closeoutReportEnabled },
      dialogueClosure: dialogueClosureConfig,
      multipleChoice: { enabled: multipleChoiceEnabled },
      interimAnimation: {
        enabled: interimAnimationEnabled,
        activeInThisTerminal: Boolean(interimAnimationEnabled && output.isTTY && cliPresentation.motion !== 'off'),
      },
      presentation: tutorStubCliPresentationSnapshot(cliPresentation),
      fieldVisualization: {
        enabled: fieldVisualizationEnabled,
        dir: path.relative(ROOT, traceDir),
        automaticAfterTurns: fieldVisualizationEnabled,
        slashCommand: '/viz',
      },
      resumeLast: resumeRequested
        ? resumeCandidate
          ? {
              source: path.relative(ROOT, resumeCandidate.filePath),
              turns: resumeCandidate.turns.length,
              world: resumeCandidate.metadata?.world || null,
            }
          : { requested: true, found: false, traceDir: path.relative(ROOT, traceDir) }
        : { requested: false },
      world: worldBundle ? { id: worldBundle.world.id, title: worldBundle.world.title, dag: args.dag } : null,
      curriculum: curriculumBundle
        ? {
            id: curriculumBundle.curriculum.id,
            title: curriculumBundle.curriculum.title,
            sourceRef: curriculumBundle.sourceRef,
            sourceHash: curriculumBundle.curriculum.source?.source_hash || null,
            moduleId: curriculumBundle.module.id,
            moduleTitle: curriculumBundle.module.title,
            mode: 'public_reflective_non_dag',
            completionAuthority: curriculumRuntime.completionAuthority,
          }
        : null,
      firstMessage: firstMessage || null,
    },
  });
  if (initialScenarioSelection) {
    appendTraceEvent(trace, {
      type: 'initial_scenario_selected',
      ...initialScenarioSelection,
    });
  }
  appendTraceEvent(trace, {
    type: 'capability_snapshot_resolved',
    schema: capabilitySnapshot.schema,
    registryVersion: capabilitySnapshot.registryVersion,
    mode: capabilitySnapshot.mode,
    active: capabilitySnapshot.active,
    available: capabilitySnapshot.available,
    compatibility: capabilitySnapshot.compatibility,
    publicTranscriptChanged: false,
  });
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
    trainingReuse: trainingReuseConfig,
    presentation: tutorStubCliPresentationSnapshot(cliPresentation),
    responseDetails: { ...responseDetailsConfig },
    capabilities: capabilitySnapshot,
    lab: selectedLabMetadata,
    sessionRecipe,
    recipeSource: loadedRecipeProvenance,
    resume: resumeCandidate
      ? {
          source: resumeCandidate.filePath,
          runId: resumeCandidate.runId,
          migration: resumeCandidate.migration,
          drift: resumeDrift,
          driftAcknowledged: Boolean(args['acknowledge-drift'] && !resumeDrift?.ok),
        }
      : null,
    passthrough: passthroughConfig,
    learnerResponseProvenance: interactiveRoleModes.learnerResponseProvenance,
    turnFailureFeedbackRecords: [],
    requestedTemperature: temperature,
    temperature: effectiveTemperature,
    maxTokens,
    historyTurns,
    learnerAnalysisPromptProfile,
    learnerAnalysisEvidenceUseRubric,
    mixedTutorPrefetchPolicy,
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
    curriculum: curriculumBundle
      ? {
          id: curriculumBundle.curriculum.id,
          title: curriculumBundle.curriculum.title,
          sourceRef: curriculumBundle.sourceRef,
          sourceHash: curriculumBundle.curriculum.source?.source_hash || null,
          module: curriculumBundle.module,
          mode: 'public_reflective_non_dag',
          runtime: curriculumRuntime,
        }
      : null,
    world: worldBundle?.world || null,
    openingRealization: null,
    resumeHandoff: null,
    openingRealizer,
    directorContext,
    directorOpeningPresented: false,
    directorGuidance: createTutorStubDirectorGuidanceState(),
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
    loopMode,
    diagnosticCollection: {
      enabled: loopMode === TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE,
      firstQuarantinedTurn: null,
      quarantinedTurns: [],
    },
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
    randomPerformance: {
      schema: 'machinespirits.tutor-stub.random-performance-mode.v1',
      enabled: false,
      scope: ['engagement_stance', 'actorial_part'],
      assessmentInfluence: false,
      sessionOnly: true,
    },
    lightAdaptation: {
      schema: TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA,
      enabled: lightAdaptationEnabled,
      threshold: lightAdaptationThreshold,
      scope: ['engagement_stance', 'actorial_part'],
      trigger: 'continued_learner_confusion_or_frustration',
      selectionMethod: 'seeded_uniform_excluding_previous',
      rememberedPreference: true,
    },
    performanceDirectives: {
      schema: 'machinespirits.tutor-stub.explicit-performance-directives.v1',
      register: null,
      character: initialTutorCharacter,
      sessionOnly: true,
      precedence: 'light_adaptation_then_explicit_axis_then_random_axis_then_adaptive_policy',
    },
    pointOfAction: {
      enabled: Boolean(pointOfActionArm),
      arm: pointOfActionArm,
      current: null,
      history: [],
    },
    committee: {
      enabled: pointOfActionArm === 'committee',
      miniModel: args['committee-mini-model'],
      ollamaUrl: args['committee-ollama-url'],
      fallbackPolicy: args['committee-fallback-policy'] === 'v2' ? 'v2' : 'v1',
      numCtx: PROGRAM2_COMMITTEE_DEFAULTS.numCtx,
      timeoutMs: PROGRAM2_COMMITTEE_DEFAULTS.timeoutMs,
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
    voice: {
      schema: 'machinespirits.tutor-stub.voice-runtime.v1',
      enabled: false,
      model: voiceModel,
      voice: voiceName,
      transcriptionModel: 'gpt-realtime-whisper',
      bridge: null,
      lastStartedAt: null,
      lastStoppedAt: null,
      deliveries: [],
      interruptions: 0,
    },
    coach: {
      pending: [],
      history: [],
    },
    history: [],
    turns: [],
  };

  const {
    forgetRememberedInteractiveSettings,
    handleUnknownSessionCommand,
    persistCurrentInteractiveSettings,
    recordSessionRuntimeEvent,
    rejectUnavailableSessionCommand,
    sessionRuntimeStateSnapshot,
  } = createTutorStubSessionStateRuntime({
    C,
    DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
    DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    DEFAULT_TUTOR_STUB_RELEASE_SPEED,
    ROOT,
    STUB,
    appendTraceEvent,
    args,
    clearStatusLine,
    clearTutorStubLastSettings,
    curriculumBundle,
    getCliPresentation: () => cliPresentation,
    jsonClone,
    path,
    state,
    tutorStubCurriculumPublicProjection,
    voiceModel,
    voiceName,
    writeTutorStubLastSettings,
  });

  const { writeFinalLearningSummary } = createTutorStubLearningSummaryRuntime({
    C,
    ROOT,
    TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA,
    appendTraceEvent,
    args,
    buildDialogueLearningSummary,
    launchTutorStubTranscriptHtml,
    learningSummaryReportConfig,
    listTutorStubTuningCandidates,
    output,
    path,
    state,
    traceDir,
    traceDisplayPath,
    tutorStubRegisterPolicyStackId,
    tutorStubTuningSnapshot,
    writeTutorStubLearningSummaryHtml,
  });

  const sessionRuntime = createTutorStubSessionRuntime({
    id: args['session-id'] || state.debugRunId,
    capabilities: state.capabilities,
    initialState: sessionRuntimeStateSnapshot(),
    commandHandlers: createTutorStubCommandHandlers(executeSlashCommand),
    onEvent: recordSessionRuntimeEvent,
    adapters: {
      snapshot: sessionRuntimeStateSnapshot,
      step: ({ payload }) =>
        routeLearnerText(payload.input, {
          source: payload.context?.source || 'runtime',
          provenance: payload.context?.provenance || null,
          awaitCompletion: Boolean(payload.context?.awaitCompletion),
        }),
      reset: ({ payload }) => performInteractiveDialogueReset(payload),
      finalize: ({ payload }) => performInteractiveFinalize(payload.reason),
      commandUnavailable: rejectUnavailableSessionCommand,
      unknownCommand: handleUnknownSessionCommand,
    },
  });
  sessionRuntime.load({ source: 'cli_launch', state: sessionRuntimeStateSnapshot() });

  const resumedDialogue = resumeRequested
    ? restoreDialogueFromTrace(state, resumeCandidate, {
        currentWorld: worldBundle?.world || null,
        restoreOpening: Boolean(args['session-rpc']),
      })
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
      directorGuidance: resumedDialogue.directorGuidance,
      learnerDag: resumedDialogue.learnerDag,
      typedActions: resumedDialogue.typedActions,
      dialogueClosure: resumedDialogue.dialogueClosure,
      warnings: resumedDialogue.warnings,
    });
  } else if (resumeRequested) {
    appendTraceEvent(state.trace, {
      type: 'resume_empty',
      traceDir: path.relative(ROOT, traceDir),
    });
  }
  if (resumeRequested) {
    sessionRuntime.resume({
      source: resumedDialogue ? path.relative(ROOT, resumedDialogue.source) : null,
      found: Boolean(resumedDialogue),
      turns: resumedDialogue?.turns || 0,
      state: sessionRuntimeStateSnapshot(),
    });
  }
  printTutorStubLaunchSummary({
    state,
    worldBundle,
    args,
    visibleModel,
    passthroughEnabled,
    observedAuditsEnabled,
    effectiveTopic,
    trace,
    allModelsOverride,
    rememberedSettings,
    classifierEnabled,
    combinedLearnerAnalysisEnabled,
    visibleLearnerRecordModel,
    visibleClassifierModel,
    tutorLearnerDagEnabled,
    humanDiscourseConfig,
    dagMode,
    autoLearnerEnabled,
    autoTurns,
    autoSafetyTurns,
    autoStopOnGrounded,
    visibleAutoLearnerModel,
    mixedLearnerEnabled,
    mixedLearnerRequested,
    interactiveSessionEnabled,
    typedActionConfig,
    typedActionTask,
    typedActionSupportLevel,
    registerSelectionEnabled,
    registerPalette,
    empiricalDynamicalSystemRegisterSelectionEnabled,
    continuousEmpiricalDynamicalSystemRegisterSelectionEnabled,
    registerEmpiricalPrior,
    continuousRegisterSelectionEnabled,
    continuousUnsafeRegisterAnchorsEnabled,
    streamEnabled,
    tutorStreamState,
    classifierResolved,
    learnerRecordResolved,
    interimAnimationEnabled,
    fieldVisualizationEnabled,
    traceDir,
    openingEnabled,
    firstMessage,
    closeoutReportEnabled,
    turnFeedbackEnabled,
    responseDetailsEnabled,
    learningSummaryReportConfig,
    summaryBrowserLaunchEnabled: process.env.TUTOR_STUB_SUMMARY_OPEN !== '0',
    dialogueClosureConfig,
    cliEffort,
    resumedDialogue,
    resumeRequested,
    temperature,
    effectiveTemperature,
  });

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
    appendTutorStubTurnFailureTraceRecords(state, { sealed: true });
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
    const startedAtMs = Date.now();
    const analysisStartedAtMs = Date.now();
    const analysis = state.passthrough?.enabled
      ? {
          classification: null,
          tutorLearnerDag: null,
          registerSelection: null,
          previousRegisterEfficacy: null,
        }
      : await analyzeLearnerTurn(firstMessage, state);
    const analysisCompletedAtMs = Date.now();
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
    const tutorStartedAtMs = Date.now();
    try {
      response = await runOneTurn(
        firstMessage,
        state,
        classification,
        tutorLearnerDag,
        registerSelection,
        previousRegisterEfficacy,
        null,
        {
          learnerResponseProvenance: createTutorStubLearnerResponseProvenance({
            authorship: 'human',
            origin: 'launch_first_message',
            inputMethod: 'command_line_argument',
            humanInLoop: true,
          }),
          turnTiming: {
            startedAtMs,
            analysisStartedAtMs,
            analysisCompletedAtMs,
            tutorStartedAtMs,
            analysisSource: state.passthrough?.enabled ? 'disabled' : 'foreground',
            tutorSource: 'foreground',
          },
        },
      );
    } finally {
      stopInterimAnimation(state);
    }
    if (automaticTechnicalDetailsEnabled(state)) printTutorDagSnapshot(response.dagSnapshot);
    printResponseDetails(response, state);
    if (!state.passthrough?.enabled) {
      printDirectorPreludeBeforeFirstTutor(state, { reason: 'first_message_response' });
    }
    printTutorResponse(response, state.stream);
    await printExplanatoryDebugTurn(state);
    writeFieldVisualization(state, { reason: 'once' });
    appendTraceEvent(state.trace, { type: 'run_end', reason: 'once', turns: state.turns.length });
    appendTutorStubTurnFailureTraceRecords(state, { sealed: true });
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
    draftInsertion: null,
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

  const {
    mixedLearnerCompletionForLine,
    mixedLearnerProfilePresentation,
    mixedLearnerPromptText,
    printMixedLearnerProfilePresentation,
    slashCommandCompletionForLine,
    slashCommandPaletteForLine,
  } = createTutorStubInteractiveInputPresentation({
    C,
    ROOT,
    TUTOR_STUB_FEEDBACK_REASONS,
    groupedWorldEntries,
    humanDirectedRegisterPalette,
    isProcessingTurn: () => processingTurn,
    learnerProfileContract,
    learnerProfileIds,
    learnerProfileSpeakerLabel,
    listTutorStubCurriculumModules,
    listTutorStubLabs,
    loadTutorStubCurriculum,
    mixedLearner,
    oneLine,
    output,
    state,
    tutorModelChoiceEntries,
    tutorStubCanonicalCommandToken,
    tutorStubCommandAvailable,
    tutorStubCommandSummary,
    tutorStubCommandTokens,
    tutorStubConfigurableActorialPartIds,
    tutorStubStaticCommandCompletions,
  });

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
    decorateLine: () => {
      lineSelection.decorateLine();
      renderMixedLearnerGhostText({
        rl,
        output,
        text: mixedLearnerGhostText({
          enabled: mixedLearner.enabled,
          suggestion: mixedLearner.suggestion,
          line: rl.line,
          processingTurn,
          interactionMode: state.interaction?.mode,
          interfaceBlocked:
            exiting ||
            initialSetupStage !== 'off' ||
            scenarioPickerActive ||
            awaitingAnotherScenario ||
            interactiveDemoRunning,
        }),
        style: (text) => `${C.dim}${text}${C.reset}`,
      });
    },
  });
  state.concurrentTerminal = concurrentTerminal;
  state.interim.concurrentTerminal = concurrentTerminal;
  let slashPaletteRefreshHandle = null;
  let onInteractiveKeypress = null;
  let processingTurn = false;
  let clarificationInFlight = null;
  let translationInFlight = null;
  let scenarioPickerActive = false;
  let awaitingAnotherScenario = false;
  let interactiveDemoRunning = false;
  let exiting = false;
  let finalized = false;
  const pendingLearnerLines = [];
  let activeLearnerTurn = null;
  let activeAutoRun = null;
  let pendingAutoRequest = null;
  let pendingAutoRequestSequence = 0;
  let resolveInteractive = null;
  const interactiveDone = new Promise((resolve) => {
    resolveInteractive = resolve;
  });

  const { handleVoiceCommand, publishAcceptedTutorToVoice, stopVoiceBridge, voiceRuntimeSnapshot } =
    createTutorStubVoiceController({
      C,
      TUTOR_STUB_VOICE_MODELS,
      appendTraceEvent,
      clearStatusLine,
      createTutorStubVoiceBridge,
      getActiveAutoRun: () => activeAutoRun,
      getActiveLearnerTurn: () => activeLearnerTurn,
      isProcessingTurn: () => processingTurn,
      latestTutorMessage,
      normalizeTutorStubVoiceModel,
      normalizeTutorStubVoiceName,
      openingDebugId,
      persistCurrentInteractiveSettings,
      printWithConcurrentTerminal,
      sessionRuntime,
      setInteractionMode: (...parameters) => setInteractionMode(...parameters),
      state,
      stateRunDebugId,
    });

  const {
    cloneStateForInteractiveLearnerAttempt,
    commitInteractiveLearnerAttempt,
    resetMixedLearnerSuggestion,
    startMixedLearnerPrefetch,
    takeMixedLearnerAnalysisPrefetch,
    takeMixedLearnerTutorPrefetch,
  } = createTutorStubInteractiveLearnerRuntime({
    C,
    DEFAULT_TUTOR_STUB_LIGHT_ADAPTATION_THRESHOLD,
    appendTraceEvent,
    applyConversationalCompletionForLearnerTurn,
    applyLearnerAdvanceAssessment,
    applyLearnerRecordUpdate,
    applyTutorStubComprehensionRequest,
    applyTutorStubComprehensionResponse,
    automaticTechnicalDetailsEnabled,
    buildHumanDiscourseFrame,
    callTutor,
    classificationFromCombinedAnalysis,
    classifierTutorContext,
    clearStatusLine,
    cliEffort,
    committedReleaseRows,
    consumeMixedLearnerReadyAnnouncement,
    dagTurnContext,
    dialogueClosureTutorContext,
    evaluatePendingRegisterEfficacy,
    explicitPerformanceDirectiveValue,
    extractCombinedLearnerAnalysis,
    freezeTutorStubLearnerRecordUpdateForDiscoursePlane,
    generateMixedLearnerArtifacts,
    getConcurrentTerminal: () => concurrentTerminal,
    getReadline: () => rl,
    humanDiscourseTutorContext,
    invalidateMixedLearnerCache,
    isExiting: () => exiting,
    isProcessingTurn: () => processingTurn,
    learnerDagPreflightForTurn,
    learnerPublicEvidenceState,
    learnerRecordFromCombinedAnalysis,
    mergeConcurrentTutorStubDirectorGuidance,
    mixedLearner,
    mixedLearnerAnalysisCacheKey,
    mixedLearnerSuggestionMove,
    mixedLearnerTutorPrefetchDecision,
    normalizeResponseConfigurationSelection,
    printMixedLearnerProfilePresentation,
    printWithConcurrentTerminal,
    refreshMixedLearnerPrompt,
    registerSelectionFromCombinedAnalysis,
    resolveConversationalCompletionForLearnerTurn,
    resolveTutorStubDiscoursePlane,
    responseConfigurationContext,
    startInterimAnimation,
    state,
    stopInterimAnimation,
    tutorCoachGuidanceContext,
    tutorDialogueClosureFrameForTurn,
    tutorLearnerDagModelContext,
    tutorStubComprehensionPrompt,
    tutorStubComprehensionSnapshot,
    tutorStubDagFactDropoutSnapshot,
    tutorStubDirectorGuidancePrompt,
    tutorStubDirectorGuidanceSnapshot,
    tutorStubRegisterPolicyStackId,
    tutorStubReleasePacingSnapshot,
    turnDebugId,
    updateComprehensionForLearnerTurn,
    updateReleasePacingForLearnerTurn,
  });

  const {
    applyAllRoleModelSelection,
    applyRoleModelSelection,
    applyTutorModelSelection,
    liveModelRoleDefinitions,
    liveModelRoleRef,
    liveModelRoleSnapshot,
    liveSettingsPickerAvailable,
    pickInitialMixedLearnerProfileWithKeyboard,
    pickInitialTutorModelWithKeyboard,
    pickLiveCharacterTargetWithKeyboard,
    pickLiveNumericSettingWithKeyboard,
    pickLiveSettingsActionWithKeyboard,
    pickLiveTutorCharacterWithKeyboard,
    pickLiveTutorRegisterWithKeyboard,
  } = createTutorStubModelPickerController({
    C,
    DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    DEFAULT_TUTOR_STUB_RELEASE_SPEED,
    STUB,
    appendTraceEvent,
    args,
    classifierEnabled,
    clearLine,
    combinedLearnerAnalysisEnabled,
    cursorTo,
    displayDiagnosticLabel,
    effectiveTemperatureForModel,
    emitKeypressEvents,
    explicitPerformanceDirectiveValue,
    getActorialPartDefinitions,
    getCliPresentation: () => cliPresentation,
    getEngagementStanceDefinitions,
    getProviderConfig,
    humanDirectedRegisterPalette,
    input,
    isCliProvider,
    learnerProfileContract,
    learnerProfileIds,
    learnerProfilePickerPresentation,
    learnerProfileSuiteIds,
    learnerSuggestionEnabled,
    mixedLearner,
    moveCursor,
    oneLine,
    output,
    persistCurrentInteractiveSettings,
    registerTemperature,
    resetMixedLearnerSuggestion,
    resolveModel,
    resolveTutorModelSelection,
    resolveTutorStubTrainingReuse,
    setModelBinding(name, value) {
      if (name === 'visibleModel') visibleModel = value;
      else if (name === 'classifierResolved') classifierResolved = value;
      else if (name === 'classifierProviderConfig') classifierProviderConfig = value;
      else if (name === 'visibleClassifierModel') visibleClassifierModel = value;
      else if (name === 'learnerRecordResolved') learnerRecordResolved = value;
      else if (name === 'learnerRecordProviderConfig') learnerRecordProviderConfig = value;
      else if (name === 'visibleLearnerRecordModel') visibleLearnerRecordModel = value;
      else if (name === 'autoLearnerResolved') autoLearnerResolved = value;
      else if (name === 'autoLearnerProviderConfig') autoLearnerProviderConfig = value;
      else if (name === 'visibleAutoLearnerModel') visibleAutoLearnerModel = value;
      else if (name === 'visibleClassifierConfig') visibleClassifierConfig = value;
      else throw new Error(`unknown model binding: ${name}`);
    },
    state,
    tutorModelChoiceEntries,
    tutorStubCliThemeOptions,
    tutorStubConfigurableActorialPartIds,
    tutorStubDagFactDropoutSnapshot,
    tutorStubPublicMessagesForSpeaker,
    tutorStubTrainingReuseLabel,
    visibleClassifierModel,
    visibleLearnerRecordModel,
    visibleResolvedModel,
  });

  const {
    acceptMixedLearnerSuggestion,
    handleMixedLearnerProfileCommand,
    runInitialMixedLearnerSetup,
    showMixedLearnerClue,
    showMixedLearnerSuggestion,
  } = createTutorStubMixedLearnerController({
    C,
    CUSTOM_LEARNER_PROFILE_EXAMPLE,
    DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
    DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    DEFAULT_TUTOR_STUB_RELEASE_SPEED,
    MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    MAX_TUTOR_STUB_RELEASE_SPEED,
    MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    MIN_TUTOR_STUB_RELEASE_SPEED,
    STUB,
    appendTraceEvent,
    applyTutorModelSelection,
    args,
    automatedLearnerProfileId,
    clearStatusLine,
    createTutorStubLearnerResponseProvenance,
    extendActiveLearnerTurn: (...parameters) => extendActiveLearnerTurn(...parameters),
    initialDropoutPromptEnabled,
    initialMixedLearnerSetupEnabled,
    initialProfilePromptEnabled,
    initialReleaseSpeedPromptEnabled,
    initialTemperaturePromptEnabled,
    input,
    isExiting: () => exiting,
    isProcessingTurn: () => processingTurn,
    learnerProfileDescription,
    learnerProfileIds,
    learnerProfileListText,
    learnerProfilePrompt,
    learnerProfileSuiteIds,
    latestTutorMessage,
    mixedLearner,
    mixedLearnerPromptText,
    normalizeTutorStubDagFactDropoutRate,
    normalizeTutorStubEngagementStanceTemperature,
    normalizeTutorStubReleaseSpeed,
    oneLine,
    openingEnabled,
    output,
    pendingLearnerLines,
    persistCurrentInteractiveSettings,
    pickInitialMixedLearnerProfileWithKeyboard,
    printMixedLearnerProfilePresentation,
    processLearnerLine: (...parameters) => processLearnerLine(...parameters),
    registerTemperatureApplies,
    requestExit: (...parameters) => requestExit(...parameters),
    resetMixedLearnerSuggestion,
    rl,
    setInitialSetupStage: (stage) => {
      initialSetupStage = stage;
    },
    setTutorStubReleaseSpeed,
    startMixedLearnerPrefetch,
    state,
  });

  const {
    chooseAnotherScenario,
    chooseWorkplanModule,
    emitOpeningPrompt,
    emitResumeHandoff,
    resetInteractiveState,
    transcriptPayload,
    writeCurrentTranscriptHtml,
  } = createTutorStubSessionOrchestration({
    C,
    DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    ROOT,
    TUTOR_STUB_FEEDBACK_REASONS,
    TUTOR_STUB_OPENING_REQUIREMENTS,
    TUTOR_STUB_TRANSCRIPT_HTML_SCHEMA,
    acknowledgeTutorStubOpeningRelease,
    appendTraceEvent,
    args,
    autoLearnerResolved,
    autoSafetyTurns,
    autoStopOnGrounded,
    autoTurns,
    buildMixedLearnerArtifactsPrompt,
    buildTutorOpening,
    buildTutorStubResumeHandoff,
    classifierEnabled,
    clearStatusLine,
    closeoutReportEnabled,
    combinedLearnerAnalysisEnabled,
    concurrentTerminal,
    continuousUnsafeRegisterAnchorsEnabled,
    createLearnerDagState,
    createScaffoldLifecycle,
    createTutorStubComprehensionState,
    createTutorStubReleasePacingState,
    createTutorStubTurnFeedbackState,
    dagFactDropoutRate,
    dialogueClosureConfig,
    directorContext,
    directorNotesIssuedSoFar,
    entrypointPath: fileURLToPath(import.meta.url),
    finalizeInteractive: (...parameters) => finalizeInteractive(...parameters),
    getCliPresentation: () => cliPresentation,
    input,
    isAwaitingAnotherScenario: () => awaitingAnotherScenario,
    isExiting: () => exiting,
    isProcessingTurn: () => processingTurn,
    jsonClone,
    launchTutorStubTranscriptHtml,
    learnerRecordResolved,
    learningSummaryReportConfig,
    listTutorStubTuningCandidates,
    liveModelRoleDefinitions,
    liveModelRoleSnapshot,
    loadedSessionRecipePath,
    mixedLearner,
    mixedLearnerArtifactsSystemPrompt,
    mixedLearnerProfilePresentation,
    mixedLearnerPromptText,
    openingDebugId,
    openingEnabled,
    output,
    path,
    persistCurrentInteractiveSettings,
    pickInitialScenarioWithKeyboard,
    pickWorkplanModuleWithKeyboard,
    printCurriculumModules,
    printInteractiveTutorOpening: (...parameters) => printInteractiveTutorOpening(...parameters),
    redactTraceSecrets,
    registerEmpiricalPrior,
    registerOverlayThreshold,
    registerPalette,
    registerPolicy,
    registerPolicyOverlays,
    registerSelectionEnabled,
    registerTemperature,
    releaseSpeed,
    rememberedSettings,
    resetMixedLearnerSuggestion,
    resolveInteractive,
    resolveWorldRef,
    resumedDialogue,
    rl,
    setAwaitingAnotherScenario: (value) => {
      awaitingAnotherScenario = value;
    },
    setExiting: (value) => {
      exiting = value;
    },
    setInitialSetupStage: (value) => {
      initialSetupStage = value;
    },
    setScenarioPickerActive: (value) => {
      scenarioPickerActive = value;
    },
    spawnSync,
    state,
    stateRunDebugId,
    stopInterimAnimation,
    summarizeTutorStubLearnerResponseProvenance,
    traceDir,
    traceDisplayPath,
    tutorLearnerDagEnabled,
    tutorStubCliPresentationSnapshot,
    tutorStubComprehensionSnapshot,
    tutorStubCurriculumBundle,
    tutorStubDagFactDropoutSnapshot,
    tutorStubDirectorGuidanceSnapshot,
    tutorStubExactRelaunchCommand,
    tutorStubPublicMessagesForSpeaker,
    tutorStubRegisterPolicyStackId,
    tutorStubReleasePacingSnapshot,
    tutorStubTuningPrompt,
    tutorStubTuningSnapshot,
    tutorStubTurnFeedbackEnvelope,
    tutorStubTurnFeedbackLabel,
    typedActionConfig,
    visibleAutoLearnerModel,
    visibleClassifierConfig,
    visibleLearnerRecordModel,
    visibleModel,
    voiceRuntimeSnapshot,
    worldBundle,
    writeTutorStubTranscriptHtml,
  });

  const {
    answerCliDirectorQuestion,
    finalizeInteractive,
    handleCurriculumModuleCommand,
    handleCurriculumNextCommand,
    handleDirectorGuidanceCommand,
    handleProofDagCommand,
    interactionModeLabel,
    offerAnotherScenario,
    performInteractiveFinalize,
    printCurriculumProgress,
    printInteractionModeBanner,
    printInteractiveStatus,
    queueCoachGuidance,
    requestExit,
    setInteractionMode,
  } = createTutorStubInteractiveSessionController({
    C,
    CURRICULUM_MODULE_PROMPT_END,
    CURRICULUM_MODULE_PROMPT_START,
    CURRICULUM_PHASE_PROMPT_END,
    CURRICULUM_PHASE_PROMPT_START,
    ROOT,
    TUTOR_STUB_CLI_DIRECTOR_SYSTEM_PROMPT,
    advanceTutorStubCurriculumRuntime,
    appendTraceEvent,
    appendTutorStubTurnFailureTraceRecords,
    args,
    buildTutorStubCliDirectorPrompt,
    callPromptModel,
    cleanTutorStubCliDirectorReply,
    clearStatusLine,
    clearTutorStubDirectorGuidance,
    closeoutReportEnabled,
    concurrentTerminal,
    curriculumBundle,
    discardPendingInteractiveAuto: (...parameters) => discardPendingInteractiveAuto(...parameters),
    displayDiagnosticLabel,
    explicitPerformanceDirectiveValue,
    getActorialPartDefinitions,
    getActiveAutoRun: () => activeAutoRun,
    getActiveLearnerTurn: () => activeLearnerTurn,
    getClarificationInFlight: () => clarificationInFlight,
    getCliPresentation: () => cliPresentation,
    getInterimState,
    getPendingAutoRequest: () => pendingAutoRequest,
    getTranslationInFlight: () => translationInFlight,
    isAwaitingAnotherScenario: () => awaitingAnotherScenario,
    isExiting: () => exiting,
    isFinalized: () => finalized,
    isProcessingTurn: () => processingTurn,
    jsonClone,
    latestTutorMessage,
    learnerProfileDescription,
    learnerProfileIds,
    listTutorStubTuningCandidates,
    liveModelRoleRef,
    mixedLearner,
    mixedLearnerProfilePresentation,
    mixedLearnerPromptText,
    normalizeTutorStubCliDirectorQuestion,
    oneLine,
    pendingLearnerLines,
    plainPolicyLabel,
    printDialogueCloseout,
    printWithConcurrentTerminal,
    projectTutorStubCurriculumProgressLines,
    projectTutorStubInteractionModeBannerLines,
    projectTutorStubInteractionModeLabel,
    projectTutorStubProofDagArtifactPaths,
    projectTutorStubProofDagSemanticLayerLines,
    projectTutorStubSessionStatusLines,
    promptIfIdle: (...parameters) => promptIfIdle(...parameters),
    renderTutorStubCurriculumModule,
    replaceDelimitedPrompt,
    resetMixedLearnerSuggestion,
    resolveInteractive,
    rl,
    saveTranscript,
    selectTutorStubCurriculumModule,
    selectTutorStubCurriculumRuntimeModule,
    sessionRuntime,
    setActiveAutoRun: (value) => {
      activeAutoRun = value;
    },
    setAwaitingAnotherScenario: (value) => {
      awaitingAnotherScenario = value;
    },
    setClarificationInFlight: (value) => {
      clarificationInFlight = value;
    },
    setExiting: (value) => {
      exiting = value;
    },
    setFinalized: (value) => {
      finalized = value;
    },
    setTranslationInFlight: (value) => {
      translationInFlight = value;
    },
    setTutorStubDirectorGuidance,
    spawnSync,
    startInterimAnimation,
    startMixedLearnerPrefetch,
    state,
    stopInterimAnimation,
    stopVoiceBridge,
    summarizeTutorStubLearnerResponseProvenance,
    transcriptPayload,
    tutorStubCanonicalCommandToken,
    tutorStubCommandSummary,
    tutorStubCommandTokens,
    tutorStubConfigurableActorialPartIds,
    tutorStubCurriculumPrivatePrompt,
    tutorStubCurriculumPublicProjection,
    tutorStubDagFactDropoutSnapshot,
    tutorStubDirectorGuidanceSnapshot,
    tutorStubRegisterPolicyStackId,
    tutorStubReleasePacingSnapshot,
    tutorStubStaticCommandCompletions,
    tutorStubTuningSnapshot,
    tutorStubTurnFeedbackEnvelope,
    tutorStubTurnFeedbackLabel,
    writeFinalLearningSummary,
  });

  const { discardPendingInteractiveAuto, runInteractiveAutoMode, runInteractiveDemo, startPendingInteractiveAuto } =
    createTutorStubInteractiveAutomationController({
      C,
      DEFAULT_INTERACTIVE_DEMO_TURNS,
      MAX_INTERACTIVE_DEMO_TURNS,
      ROOT,
      appendTraceEvent,
      args,
      assertTutorStubTurnAttemptCurrent,
      autoLearnerProviderConfig,
      autoLearnerResolved,
      autoSafetyTurns,
      autoStopOnGrounded,
      clearStatusLine,
      clearTutorStubTurnFeedbackTarget,
      cliEffort,
      getActiveAutoRun: () => activeAutoRun,
      getActiveLearnerTurn: () => activeLearnerTurn,
      getPendingAutoRequest: () => pendingAutoRequest,
      interactionModeLabel,
      isAwaitingAnotherScenario: () => awaitingAnotherScenario,
      isCliProvider,
      isExiting: () => exiting,
      isInteractiveDemoRunning: () => interactiveDemoRunning,
      isProcessingTurn: () => processingTurn,
      latestTutorMessage,
      mixedLearner,
      mixedLearnerPromptText,
      nextPendingAutoRequestSequence: () => {
        pendingAutoRequestSequence += 1;
        return pendingAutoRequestSequence;
      },
      offerAnotherScenario,
      openingEnabled,
      path,
      pendingLearnerLines,
      printCurrentTurnAnalysis,
      printDialogueCloseout,
      printWithConcurrentTerminal,
      resetMixedLearnerSuggestion,
      rl,
      runAutomatedLearnerDialogue,
      setActiveAutoRun: (value) => {
        activeAutoRun = value;
      },
      setInteractionMode,
      setInteractiveDemoRunning: (value) => {
        interactiveDemoRunning = value;
      },
      setPendingAutoRequest: (value) => {
        pendingAutoRequest = value;
      },
      setProcessingTurn: (value) => {
        processingTurn = value;
      },
      state,
      stateRunDebugId,
      tutorStubRegisterPolicyStackId,
      tutorStubTurnFeedbackEnvelope,
      writeCurrentTranscriptHtml,
    });

  const {
    performInteractiveDialogueReset,
    printInteractiveTutorOpening,
    promptIfIdle,
    resetInteractiveDialogue,
    runClarificationCommand,
    runCurriculumTranslationCommand,
  } = createTutorStubInteractiveDialogueController({
    C,
    appendTraceEvent,
    applyTutorStubComprehensionRequest,
    applyTutorStubComprehensionResponse,
    assertTutorStubTurnAttemptCurrent,
    clearStatusLine,
    concurrentTerminal,
    detectTutorStubComprehensionRequest,
    discardPendingInteractiveAuto,
    emitOpeningPrompt,
    generateTutorClarification,
    generateTutorStubCurriculumTranslation,
    generateTutorStubTutorOutputTranslation,
    getActiveAutoRun: () => activeAutoRun,
    getActiveLearnerTurn: () => activeLearnerTurn,
    getClarificationInFlight: () => clarificationInFlight,
    getPendingAutoRequest: () => pendingAutoRequest,
    getTranslationInFlight: () => translationInFlight,
    isExiting: () => exiting,
    isProcessingTurn: () => processingTurn,
    latestTutorMessage,
    mixedLearnerPromptText,
    normalizeTutorStubCurriculumTranslationLevels,
    normalizeTutorStubTutorOutputTranslationLevels,
    oneLine,
    openingDebugId,
    pendingLearnerLines,
    printDirectorPreludeBeforeFirstTutor,
    printOpeningDebugLine,
    printTutorFeedbackRequest: (...parameters) => printTutorFeedbackRequest(...parameters),
    printWithConcurrentTerminal,
    publishAcceptedTutorToVoice,
    renderTutorStubCurriculumTranslation,
    renderTutorStubTutorOutputTranslation,
    resetInteractiveState,
    resetMixedLearnerSuggestion,
    rl,
    sessionRuntime,
    setActiveAutoRun: (value) => {
      activeAutoRun = value;
    },
    setActiveLearnerTurn: (value) => {
      activeLearnerTurn = value;
    },
    setAwaitingAnotherScenario: (value) => {
      awaitingAnotherScenario = value;
    },
    setClarificationInFlight: (value) => {
      clarificationInFlight = value;
    },
    setProcessingTurn: (value) => {
      processingTurn = value;
    },
    setTranslationInFlight: (value) => {
      translationInFlight = value;
    },
    startMixedLearnerPrefetch,
    state,
    stateRunDebugId,
    stopInterimAnimation,
    tutorStubComprehensionSnapshot,
    tutorStubDirectorGuidanceSnapshot,
  });

  const {
    chooseLiveNumericSetting,
    chooseLiveRoleModel,
    chooseLiveTutorModel,
    handleTrainingReuseSetting,
    openLiveSettingsPanel,
    printDialogueSettings,
    printModelChoices,
    printTrainingReuseStatus,
    printTutorModelChoices,
  } = createTutorStubLiveSettingsController({
    C,
    DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
    DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    DEFAULT_TUTOR_STUB_RELEASE_SPEED,
    MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    MAX_TUTOR_STUB_RELEASE_SPEED,
    MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    MIN_TUTOR_STUB_RELEASE_SPEED,
    TUTOR_STUB_CLI_MOTION_IDS,
    TUTOR_STUB_CLI_THEME_IDS,
    appendTraceEvent,
    args,
    configureCliPresentation,
    displayDiagnosticLabel,
    explicitPerformanceDirectiveValue,
    getCliPresentation: () => cliPresentation,
    getCommandRuntime: () => commandRuntime,
    isExiting: () => exiting,
    liveModelRoleDefinitions,
    liveModelRoleRef,
    liveModelRoleSnapshot,
    mixedLearnerPromptText,
    normalizeTutorStubTrainingReuseSetting,
    performanceTemperatureScope,
    persistCurrentInteractiveSettings,
    pickInitialTutorModelWithKeyboard,
    pickLiveNumericSettingWithKeyboard,
    pickLiveSettingsActionWithKeyboard,
    plainPolicyLabel,
    projectTutorStubDialogueSettingsLines,
    projectTutorStubModelChoiceLines,
    projectTutorStubTrainingReuseStatusLines,
    registerTemperature,
    resolveTutorStubTrainingReuse,
    rl,
    state,
    tutorModelChoiceEntries,
    tutorStubDagFactDropoutSnapshot,
    tutorStubPublicMessagesForSpeaker,
    tutorStubRegisterPolicyStackId,
    tutorStubReleasePacingSnapshot,
    tutorStubTrainingReuseLabel,
  });

  const {
    handleResponseDetailsCommand,
    handleTutorFeedbackCommand,
    handleTutorTuningCommand,
    latestTutorFeedbackTarget,
    printTutorFeedbackRequest,
    repriseLatestTutorUtterance,
  } = createTutorStubFeedbackTuningController({
    C,
    ROOT,
    TUTOR_STUB_FEEDBACK_REASONS,
    appendTraceEvent,
    appendTutorStubTurnFailureTraceRecords,
    approveTutorStubTuningCandidate,
    buildTutorStubFeedbackRatingRecord,
    clearStatusLine,
    clearTutorStubTurnFeedbackRating,
    displayDiagnosticLabel,
    findTutorStubFeedbackTargetTurn,
    hashCanonicalJson,
    isExiting: () => exiting,
    isProcessingTurn: () => processingTurn,
    jsonClone,
    latestTutorMessage,
    listTutorStubTuningCandidates,
    openingDebugId,
    path,
    persistCurrentInteractiveSettings,
    promoteTutorStubTuningCandidate,
    readTutorStubTuningCandidate,
    recordTutorStubTuningNote,
    rejectTutorStubTuningCandidate,
    requestTutorStubTurnFeedback,
    responseDetailsConfig,
    rollbackTutorStubTutorVersion,
    setTutorStubTuningMode,
    setTutorStubTurnFeedbackEnabled,
    setTutorStubTurnFeedbackRating,
    state,
    stateRunDebugId,
    synthesizeTutorStubTuningCandidate,
    turnDebugId,
    tutorStubCommandReturnsToScene,
    tutorStubTuningReplayPath,
    tutorStubTuningSnapshot,
    tutorStubTurnFeedbackEnvelope,
    tutorStubTurnFeedbackLabel,
    validateTutorStubTuningCandidate,
  });

  const {
    handleCommitteeCommand,
    handleExplicitPerformanceDirectiveCommand,
    handleLightAdaptationCommand,
    handleRandomPerformanceCommand,
  } = createTutorStubPerformanceControlController({
    C,
    DEFAULT_TUTOR_STUB_LIGHT_ADAPTATION_THRESHOLD,
    EXPLICIT_PERFORMANCE_CLEAR_WORDS,
    TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA,
    appendTraceEvent,
    args,
    clearStatusLine,
    displayDiagnosticLabel,
    explicitPerformanceDirectiveValue,
    getActorialPartDefinitions,
    getEngagementStanceDefinition,
    humanDirectedRegisterPalette,
    isProcessingTurn: () => processingTurn,
    latestTutorMessage,
    liveSettingsPickerAvailable,
    mixedLearner,
    oneLine,
    persistCurrentInteractiveSettings,
    pickLiveTutorRegisterWithKeyboard,
    plainPolicyLabel,
    resetMixedLearnerSuggestion,
    resolveEngagementStance,
    resolveTutorStubCharacterChoice,
    startMixedLearnerPrefetch,
    state,
  });

  const { handleCharacterCommand } = createTutorStubCharacterControlController({
    C,
    TUTOR_STUB_CHARACTER_RESTATEMENT_SCHEMA,
    TUTOR_STUB_CHARACTER_RESTATEMENT_SYSTEM_PROMPT,
    appendTraceEvent,
    auditTutorResponseLeak,
    auditTutorStubCharacterRestatement,
    buildTutorStubCharacterRestatementPrompt,
    callPromptModel,
    cleanTutorStubCharacterRestatement,
    clearStatusLine,
    displayDiagnosticLabel,
    explicitPerformanceDirectiveValue,
    getActorialPartDefinitions,
    handleExplicitPerformanceDirectiveCommand,
    handleMixedLearnerProfileCommand,
    isExiting: () => exiting,
    isProcessingTurn: () => processingTurn,
    jsonClone,
    latestTutorFeedbackTarget,
    latestTutorMessage,
    liveSettingsPickerAvailable,
    mixedLearner,
    openingDebugId,
    pickInitialMixedLearnerProfileWithKeyboard,
    pickLiveCharacterTargetWithKeyboard,
    pickLiveTutorCharacterWithKeyboard,
    printTutorFeedbackRequest,
    publicWorldSummary,
    publishAcceptedTutorToVoice,
    sessionRuntime,
    startInterimAnimation,
    startMixedLearnerPrefetch,
    state,
    stateRunDebugId,
    stopInterimAnimation,
    turnDebugId,
  });

  const commandRuntime = createTutorStubCommandRuntime({
    C,
    DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    DEFAULT_TUTOR_STUB_RELEASE_SPEED,
    STUB,
    TUTOR_STUB_CLI_MOTION_IDS,
    TUTOR_STUB_CLI_THEME_IDS,
    TUTOR_STUB_REGISTER_OVERLAY_POLICIES,
    TUTOR_STUB_REGISTER_POLICY_COMPOSITION_SCHEMA,
    acceptMixedLearnerSuggestion,
    answerCliDirectorQuestion,
    appendTraceEvent,
    applyAllRoleModelSelection,
    applyRoleModelSelection,
    applyTutorModelSelection,
    args,
    chooseAnotherScenario,
    chooseLiveNumericSetting,
    chooseLiveRoleModel,
    chooseLiveTutorModel,
    chooseWorkplanModule,
    clearStatusLine,
    collectGitActivity,
    collectGitHubMetrics,
    collectSourceMetrics,
    concurrentTerminal,
    configureCliPresentation,
    discardPendingInteractiveAuto,
    finalizeInteractive,
    forgetRememberedInteractiveSettings,
    formatTutorStubLabList,
    getCliPresentation: () => cliPresentation,
    getTutorStubLab,
    handleCharacterCommand,
    handleCommitteeCommand,
    handleCurriculumModuleCommand,
    handleCurriculumNextCommand,
    handleDirectorGuidanceCommand,
    handleExplicitPerformanceDirectiveCommand,
    handleLightAdaptationCommand,
    handleMixedLearnerProfileCommand,
    handleProofDagCommand,
    handleRandomPerformanceCommand,
    handleResponseDetailsCommand,
    handleTrainingReuseSetting,
    handleTutorFeedbackCommand,
    handleTutorTuningCommand,
    handleVoiceCommand,
    isAwaitingAnotherScenario: () => awaitingAnotherScenario,
    latestTutorMessage,
    liveModelRoleDefinitions,
    liveSettingsPickerAvailable,
    mixedLearner,
    mixedLearnerPromptText,
    normalizeTutorStubCliMotion,
    normalizeTutorStubCliThemeId,
    normalizeTutorStubDagFactDropoutRate,
    normalizeTutorStubEngagementStanceTemperature,
    normalizeTutorStubRegisterOverlayThreshold,
    normalizeTutorStubReleaseSpeed,
    openLiveSettingsPanel,
    parseTutorStubRegisterPolicyStack,
    pauseInterimAnimation,
    persistCurrentInteractiveSettings,
    pickInitialTutorModelWithKeyboard,
    plainPolicyLabel,
    printCurrentDebugId,
    printCurrentTurnAnalysis,
    printCurriculumProgress,
    printDialogueCloseout,
    printDialogueSettings,
    printDirectorNotesIssuedSoFar,
    printExplanatoryDebugTurn,
    printFieldVisualization,
    printInteractionModeBanner,
    printInteractiveHelp,
    printInteractiveStatus,
    printLightweightDialogueField,
    printModelChoices,
    printTrainingReuseStatus,
    printTutorModelChoices,
    printTutorStubFeatureMap,
    printTutorStubReleaseNotes,
    queueCoachGuidance,
    registerTemperature,
    registerTemperatureApplies,
    renderReport,
    repriseLatestTutorUtterance,
    requestExit,
    resetInteractiveDialogue,
    resetMixedLearnerSuggestion,
    resumeInterimAnimation,
    rl,
    runClarificationCommand,
    runCurriculumTranslationCommand,
    runInteractiveAutoMode,
    runInteractiveDemo,
    setInteractionMode,
    setTutorStubReleaseSpeed,
    showMixedLearnerClue,
    showMixedLearnerSuggestion,
    startMixedLearnerPrefetch,
    state,
    stopInterimAnimation,
    stopVoiceBridge,
    tutorStubCliPresentationSnapshot,
    tutorStubCliThemeOptions,
    tutorStubCliThemePreview,
    tutorStubPublicMessagesForSpeaker,
    tutorStubRegisterPolicyStackId,
    writeCurrentTranscriptHtml,
  });

  function executeSlashCommand(...parameters) {
    return commandRuntime.executeSlashCommand(...parameters);
  }

  function handleSlashCommand(trimmed, { duringTurn = false } = {}) {
    if (
      !String(trimmed || '')
        .trim()
        .startsWith('/')
    )
      return false;
    return sessionRuntime.step(trimmed, { kind: 'command', context: { duringTurn } });
  }

  const { extendActiveLearnerTurn, mixedDraftLearnerResponseProvenance, processLearnerLine, routeLearnerText } =
    createTutorStubInteractiveTurnController({
      C,
      aggregateTutorStubLearnerResponseProvenance,
      analyzeLearnerTurn,
      appendTraceEvent,
      assertTutorStubTurnAttemptCurrent,
      auditTutorStubDialogueClosureResponse,
      automaticTechnicalDetailsEnabled,
      buildHumanDiscourseFrame,
      buildTutorInterimContext,
      clearStatusLine,
      cloneStateForInteractiveLearnerAttempt,
      commitInteractiveLearnerAttempt,
      commitTutorStubTurnFeedback,
      createTutorStubLearnerResponseProvenance,
      deterministicTutorStubClosureResponse,
      discardPendingInteractiveAuto,
      getActiveAutoRun: () => activeAutoRun,
      getActiveLearnerTurn: () => activeLearnerTurn,
      getPendingAutoRequest: () => pendingAutoRequest,
      isExiting: () => exiting,
      isProcessingTurn: () => processingTurn,
      jsonClone,
      mixedLearner,
      offerAnotherScenario,
      pauseInterimAnimation,
      pendingLearnerLines,
      printDirectorPreludeBeforeFirstTutor,
      printExplanatoryDebugTurn,
      printResponseDetails,
      printTurnDebugLine,
      printTutorDagSnapshot,
      printTutorFeedbackRequest,
      printTutorResponse,
      printWithConcurrentTerminal,
      promptIfIdle,
      publishAcceptedTutorToVoice,
      queueCoachGuidance,
      recordTutorStubCurriculumEvidence,
      resetMixedLearnerSuggestion,
      resumeInterimAnimation,
      runOneTurn,
      sessionRuntime,
      setActiveLearnerTurn: (value) => {
        activeLearnerTurn = value;
      },
      setProcessingTurn: (value) => {
        processingTurn = value;
      },
      startInterimAnimation,
      startMixedLearnerPrefetch,
      startPendingInteractiveAuto,
      state,
      stopInterimAnimation,
      takeMixedLearnerAnalysisPrefetch,
      takeMixedLearnerTutorPrefetch,
      turnDebugId,
      tutorDialogueClosureFrameForTurn,
      tutorStubClosureAcknowledgement,
      tutorStubTurnFeedbackEnvelope,
      writeFieldVisualization,
    });

  const initialSetupCompleted = await runInitialMixedLearnerSetup();
  if (!initialSetupCompleted) {
    await interactiveDone;
    return;
  }
  persistCurrentInteractiveSettings(resumedDialogue ? 'resume_loaded' : 'session_ready');

  if (args['session-rpc']) {
    const rpcInput = fs.createReadStream('', { fd: 3, autoClose: false });
    const rpcOutput = fs.createWriteStream('', { fd: 4, autoClose: false });
    try {
      const opening = await emitOpeningPrompt('session_rpc_start', {
        display: false,
        realizer: 'deterministic',
        deterministicSource: 'session_rpc',
      });
      const resumeHandoff = opening ? null : emitResumeHandoff('session_rpc_start', { display: false });
      if ((opening || resumeHandoff) && sessionRuntime.status === 'active') {
        sessionRuntime.sync(opening ? 'opening_committed' : 'resume_handoff_committed');
      }
      await runTutorStubSessionRpc({ input: rpcInput, output: rpcOutput, runtime: sessionRuntime });
    } finally {
      if (sessionRuntime.status === 'active') await sessionRuntime.finalize('session_rpc_closed');
      rl.close();
      rpcInput.destroy();
      rpcOutput.end();
    }
    return;
  }

  if (input.isTTY && output.isTTY) {
    emitKeypressEvents(input, rl);
    onInteractiveKeypress = (character, key) => {
      if (key?.name === 'tab') {
        const completion = mixedLearnerCompletionForLine(rl.line);
        if (completion && mixedLearner.suggestion?.text) {
          mixedLearner.draftInsertion = {
            insertedAt: new Date().toISOString(),
            lineBeforeInsertion: rl.line,
            completion,
            suggestion: jsonClone(mixedLearner.suggestion),
          };
          appendTraceEvent(state.trace, {
            type: 'mixed_learner_suggestion_inserted',
            turn: mixedLearner.suggestion.turn,
            turnId: mixedLearner.suggestion.turnId,
            requestId: mixedLearner.suggestion.requestId,
            inputMethod: 'tab_completion',
            publicTranscriptChanged: false,
          });
        }
      }
      const feedbackInterfaceBlocked = Boolean(
        exiting || initialSetupStage !== 'off' || scenarioPickerActive || awaitingAnotherScenario,
      );
      const pendingTutorFeedback = tutorStubTurnFeedbackEnvelope(state.turnFeedback);
      const escapeDismissesFeedback = tutorStubTurnFeedbackEscapeDismissal({
        line: rl.line,
        key,
        feedback: pendingTutorFeedback,
        interactiveMode: state.interaction?.mode,
        interfaceBlocked: feedbackInterfaceBlocked,
        selectionActive: lineSelection.snapshot().active,
      });
      if (escapeDismissesFeedback) {
        lineSelection.clear();
        handleTutorFeedbackCommand('off', { source: 'empty_prompt_escape' });
        promptIfIdle();
        return;
      }
      const arrowRating = tutorStubTurnFeedbackArrowRating({
        line: rl.line,
        key,
        feedback: pendingTutorFeedback,
        busy: processingTurn,
        interactiveMode: state.interaction?.mode,
        interfaceBlocked: feedbackInterfaceBlocked,
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
        const paletteChanged = concurrentTerminal.setPalette(slashCommandPaletteForLine(rl.line));
        if (!paletteChanged) concurrentTerminal.show();
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
    const draftInsertion = mixedLearner.draftInsertion;
    mixedLearner.draftInsertion = null;
    const draftProvenance = trimmed ? mixedDraftLearnerResponseProvenance(draftInsertion, trimmed) : null;
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
    sessionRuntime.step(trimmed, {
      kind: 'learner',
      context: { source: 'terminal', provenance: draftProvenance },
    });
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
    void stopVoiceBridge('terminal_closed');
    if (slashPaletteRefreshHandle) clearImmediate(slashPaletteRefreshHandle);
    if (onInteractiveKeypress) input.removeListener('keypress', onInteractiveKeypress);
    concurrentTerminal.close();
    if (!finalized) finalizeInteractive('exit');
    resolveInteractive();
  });

  const deferOpeningForMixedPrelude = Boolean(mixedLearner.enabled && !instantExistingScenarioOpening);
  const opening = await emitOpeningPrompt('start', {
    display: !deferOpeningForMixedPrelude,
    realizer: instantExistingScenarioOpening ? 'deterministic' : null,
    deterministicSource: instantExistingScenarioOpening ? 'remembered_scenario_instant_opening' : null,
  });
  if (opening) {
    const openingPrefetch = startMixedLearnerPrefetch('opening', {
      refreshPrompt: !deferOpeningForMixedPrelude,
    });
    if (deferOpeningForMixedPrelude) {
      if (openingPrefetch) {
        startInterimAnimation(state, 'preparing scenario', { tutorTurn: state.turns.length + 1 });
        try {
          await openingPrefetch;
        } finally {
          stopInterimAnimation(state);
        }
      }
      printInteractiveTutorOpening(opening);
    }
  } else if (resumedDialogue) {
    const resumeHandoff = emitResumeHandoff('interactive_start');
    if (resumeHandoff) startMixedLearnerPrefetch('resume_handoff');
  }

  if (voiceLaunchRequested && !exiting) {
    await handleVoiceCommand('on', { source: 'launch_flag' });
  }

  if (args.demo && !exiting) {
    await runInteractiveDemo('', { source: 'launch_flag' });
  }

  promptIfIdle();
  await interactiveDone;
}

main().catch((err) => {
  console.error(`${C.red}Fatal:${C.reset} ${err.message}`);
  process.exit(1);
});
